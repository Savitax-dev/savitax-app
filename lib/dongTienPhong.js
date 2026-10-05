import { countsForMonth } from './contractDates.js'
import { feeCountsForMonth, resolveFeeForMonth } from './feeDue.js'
import { resolveHcnsFeeForMonth } from './hcnsFee.js'

// DÒNG TIỀN CÔNG NỢ CỦA MỘT PHÒNG (khối 5 thẻ ở trang Phòng → tab Công nợ phòng).
//
//   Tồn đầu kỳ  +  phí phát sinh trong kỳ  −  đã thu trong kỳ  =  còn phải thu chuyển kỳ sau
//
// Tách 3 loại thu: kế toán · HCNS · dịch vụ khác. Ba loại đi BA ĐƯỜNG khác nhau vì dữ liệu gốc
// khác nhau — chỗ này là lý do cả file tồn tại, đừng gộp lại cho "gọn":
//
//   · Kế toán      — có sổ chốt thật (`debt_rollovers`, mỗi kỳ quá hạn 1 dòng). Tồn đầu kỳ =
//                    TỔNG `rolled_amount` của các kỳ TRƯỚC trừ tiền đã thu nợ tồn
//                    (`service_fees.type='no_ton'`) ở các kỳ TRƯỚC. Cố ý KHÔNG dùng
//                    `remaining_amount`: cột đó là số còn lại TÍNH ĐẾN HÔM NAY, nên xem lại T8
//                    sẽ ra nợ của hôm nay chứ không phải nợ đầu T8 (đúng cái bẫy của thẻ
//                    "Nợ tồn · tính đến hiện tại" cũ).
//   · HCNS         — CHƯA có sổ chốt. Người dùng chốt ở Excel rồi nạp vào `debt_rollovers` với
//                    `source='hcns'` (anh chốt 2026-10-05). Chưa có dòng nào thì trả
//                    `hcnsCoSoLieu: false` để giao diện ghi "chưa chốt" — KHÔNG hiện 0đ, vì 0đ
//                    đọc thành "HCNS không nợ gì" là sai sự thật.
//   · Dịch vụ khác — tính từ chính hồ sơ (`other_services` + `other_service_payments`, sql/24).
//                    Hồ sơ chỉ có từ lúc lên app nên các kỳ trước ra 0 — đúng ý người dùng
//                    ("DV khác cập nhật từ lúc build lên app"), không phải thiếu dữ liệu.
//
// Dùng TẤT CẢ công ty của phòng kể cả đã ngưng dịch vụ / chưa tới mốc hợp đồng: còn nợ thì vẫn
// phải đòi. Riêng PHÍ PHÁT SINH trong kỳ mới gate theo `countsForMonth` + `feeCountsForMonth`
// (công ty quý chưa tới cuối quý thì kỳ này không phát sinh phí).

// Phí HCNS bắt đầu được tách riêng khỏi phí kế toán từ kỳ này — trước đó không có số HCNS để
// cộng vào tồn đầu kỳ (và cộng vào là nhân đôi phần đã nằm trong phí kế toán).
const HCNS_TU = { year: 2026, month: 9 }

const num = (v) => Math.round(Number(v) || 0)
const moc = (y, m) => y * 12 + m           // so sánh kỳ: kỳ nào trước kỳ nào
const pct = (thu, phi) => phi <= 0 ? (thu > 0 ? 100 : 0) : Math.round(thu / phi * 100)

// Gộp 1 số vào map theo công ty
const cong = (map, id, loai, v) => {
  if (!v) return
  if (!map.has(id)) map.set(id, { ketoan: 0, hcns: 0, dvk: 0 })
  map.get(id)[loai] += v
}
const tong = (map, loai) => [...map.values()].reduce((a, x) => a + x[loai], 0)

export async function tinhDongTienPhong(supabase, {
  clients,          // mọi công ty NHÂN VIÊN CHÍNH của phòng (mọi trạng thái)
  year, month,
  feePlanRows = [], // service_fees type='fee_plan'
  changeLogRows = [],
  feeKetoanMap = {},// clientId -> đã thu phí kế toán TRONG KỲ
  hcnsByClient = {},// clientId -> { due, fee, collected } của kỳ này
  hcnsLichSu = null,// { links, plans, paid } — mọi tháng, để tính tồn đầu kỳ phần HCNS
}) {
  const ids = clients.map(c => c.id)
  const mocXem = moc(year, month)
  const rong = {
    tonDau: { ketoan: 0, hcns: 0, dvk: 0, total: 0, soCty: 0, hcnsCoSoLieu: false, daThuTrongKy: 0, theoCty: [] },
    phiKetoan: { phi: 0, daThu: 0, pct: 0, soCty: 0 },
    phiHcns: { phi: 0, daThu: 0, pct: 0, soCty: 0 },
    thuKhac: { phaiThu: 0, daThu: 0, pct: 0, soCty: 0, hoSo: [] },
    chuyenKySau: { ketoan: 0, hcns: 0, dvk: 0, total: 0, soCty: 0, theoCty: [] },
  }
  if (!ids.length) return rong

  // --- lấy dữ liệu gốc (hết trang, PostgREST cắt im ở 1000 dòng) ---
  const hetTrang = async (q) => {
    let all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await q().range(from, from + 999)
      if (error) throw error
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
    }
    return all
  }
  const bo = async (fn) => { try { return await fn() } catch { return [] } }

  const [rollovers, noTonThu, hoSoDvk, thuDvk, thuKhachLe] = await Promise.all([
    bo(() => hetTrang(() => supabase.from('debt_rollovers')
      .select('client_id, year, month, rolled_amount, source').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('service_fees')
      .select('client_id, year, month, amount').in('client_id', ids).eq('type', 'no_ton'))),
    bo(() => hetTrang(() => supabase.from('other_services')
      .select('id, client_id, name, amount, year, month, status').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('other_service_payments')
      .select('service_id, client_id, amount, year, month').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('service_fees')
      .select('client_id, amount, note').in('client_id', ids).eq('type', 'khach').eq('year', year).eq('month', month))),
  ])

  // ================= 1. TỒN ĐẦU KỲ =================
  const tonDau = new Map()

  // Kế toán. KHÔNG cộng thuần `rolled_amount` của các kỳ trước: phần lớn nợ tồn hiện có là NỢ CŨ
  // NHẬP TAY thẳng vào `clients.other_debt` từ hồi chưa có module, chẳng có dòng chốt sổ nào.
  // Cộng thuần thì tiền thu nợ tồn trừ vào hư không -> công ty ra số ÂM, tổng thẻ không khớp 3
  // dòng bên trong (đo thật 05/10/2026: phòng Grand tổng 32.240.000 mà dòng kế toán ra 0).
  // Nên suy ngược từ số nợ tồn ĐANG CÓ:
  //     nợ cũ nhập tay = other_debt hôm nay − Σ đã chốt sổ (mọi kỳ) + Σ đã thu nợ tồn (mọi kỳ)
  //     tồn đầu kỳ P   = nợ cũ nhập tay + Σ đã chốt sổ (kỳ < P) − Σ đã thu nợ tồn (kỳ < P)
  // Đặt P sau kỳ cuối cùng thì công thức tự rút về đúng `other_debt` hôm nay — khớp với con số
  // nhân viên đang nhìn thấy ở thẻ "Nợ tồn", chỉ khác là lùi được về đúng mốc từng kỳ.
  const rolledTruoc = new Map(), rolledTong = new Map()
  const thuTruoc = new Map(), thuTong = new Map()
  const themVao = (map, id, v) => map.set(id, (map.get(id) || 0) + v)
  for (const r of rollovers) {
    const src = r.source || 'ketoan'
    if (src === 'hcns') {
      if (moc(r.year, r.month) < mocXem) cong(tonDau, r.client_id, 'hcns', num(r.rolled_amount))
      continue
    }
    themVao(rolledTong, r.client_id, num(r.rolled_amount))
    if (moc(r.year, r.month) < mocXem) themVao(rolledTruoc, r.client_id, num(r.rolled_amount))
  }
  for (const p of noTonThu) {
    themVao(thuTong, p.client_id, num(p.amount))
    if (moc(p.year, p.month) < mocXem) themVao(thuTruoc, p.client_id, num(p.amount))
  }
  for (const c of clients) {
    const noCu = num(c.other_debt) - (rolledTong.get(c.id) || 0) + (thuTong.get(c.id) || 0)
    const v = noCu + (rolledTruoc.get(c.id) || 0) - (thuTruoc.get(c.id) || 0)
    cong(tonDau, c.id, 'ketoan', v)
  }
  // HCNS. Ưu tiên sổ chốt (`debt_rollovers` source='hcns') nếu sau này có nạp từ Excel; chưa có
  // thì tính thẳng từ lịch sử phí HCNS — phí tách riêng từ T9/2026 (anh chốt 05/10/2026) nên
  // phần chưa thu của T9 trở đi phải chuyển sang kỳ sau, KHÔNG được để trống chờ file.
  const coSoChotHcns = rollovers.some(r => r.source === 'hcns')
  let hcnsCoSoLieu = coSoChotHcns
  if (!coSoChotHcns && hcnsLichSu?.links?.length) {
    const daThuHcns = new Map(hcnsLichSu.paid || [])
    const plans = hcnsLichSu.plans || []
    const idSet = new Set(ids)
    for (const l of hcnsLichSu.links) {
      // Chỉ công ty nhân viên CHÍNH của phòng — danh sách links có thể rộng hơn (gồm cả công ty
      // phụ trách phụ), cộng vào là tính nợ của phòng khác sang phòng này.
      if (!idSet.has(l.linked_client_id)) continue
      let con = 0
      for (let k = moc(HCNS_TU.year, HCNS_TU.month); k < mocXem; k++) {
        const y = Math.floor((k - 1) / 12), m = k - y * 12
        if (!feeCountsForMonth(l.fee_period, y, m)) continue
        const phi = num(resolveHcnsFeeForMonth(plans, l.id, y, m, Number(l.hcns_fee) || 0, l.created_at))
        const thu = num(daThuHcns.get(l.id + '_' + y + '_' + m))
        con += phi - thu
      }
      if (con !== 0) cong(tonDau, l.linked_client_id, 'hcns', con)
    }
    hcnsCoSoLieu = mocXem > moc(HCNS_TU.year, HCNS_TU.month)
  }

  // Dịch vụ khác: hồ sơ mở ở kỳ TRƯỚC, trừ tiền đã thu ở các kỳ TRƯỚC.
  for (const s of hoSoDvk) {
    if (moc(s.year, s.month) >= mocXem) continue
    cong(tonDau, s.client_id, 'dvk', num(s.amount))
  }
  const hoSoCuaKyTruoc = new Set(hoSoDvk.filter(s => moc(s.year, s.month) < mocXem).map(s => s.id))
  for (const p of thuDvk) {
    if (moc(p.year, p.month) >= mocXem) continue
    if (!hoSoCuaKyTruoc.has(p.service_id)) continue
    cong(tonDau, p.client_id, 'dvk', -num(p.amount))
  }

  // Chặn sàn 0 cho TỪNG công ty ngay tại đây: nếu chỉ chặn ở tổng thì một công ty âm sẽ ăn bớt
  // nợ của công ty khác, mà danh sách bấm vào lại bỏ công ty âm -> tổng thẻ khác tổng danh sách.
  for (const [id, v] of tonDau) {
    v.ketoan = Math.max(0, v.ketoan); v.hcns = Math.max(0, v.hcns); v.dvk = Math.max(0, v.dvk)
    if (v.ketoan + v.hcns + v.dvk === 0) tonDau.delete(id)
  }

  // ================= 2+3. PHÍ PHÁT SINH TRONG KỲ =================
  let phiKt = 0, thuKt = 0, ctyKt = 0
  let phiH = 0, thuH = 0, ctyH = 0
  const phatSinh = new Map()   // clientId -> { ketoan, hcns, dvk } phí phát sinh kỳ này
  const daThu = new Map()      // clientId -> { ketoan, hcns, dvk } đã thu kỳ này

  for (const c of clients) {
    const dungKy = (c.status || 'active') === 'active' && countsForMonth(c, year, month)
    if (dungKy && feeCountsForMonth(c.fee_period, year, month)) {
      const phi = num(resolveFeeForMonth(feePlanRows, c.id, year, month, c.monthly_fee, changeLogRows))
      const thu = num(feeKetoanMap[c.id])
      phiKt += phi; thuKt += thu; if (phi > 0) ctyKt++
      cong(phatSinh, c.id, 'ketoan', phi)
      cong(daThu, c.id, 'ketoan', thu)
    }
    const h = hcnsByClient[c.id]
    if (dungKy && h?.due) {
      phiH += num(h.fee); thuH += num(h.collected); if (num(h.fee) > 0) ctyH++
      cong(phatSinh, c.id, 'hcns', num(h.fee))
      cong(daThu, c.id, 'hcns', num(h.collected))
    }
  }
  // Tiền thu nợ tồn CỦA KỲ NÀY — không phải phí phát sinh, nhưng là tiền thu làm giảm tồn.
  let thuNoTonTrongKy = 0
  for (const p of noTonThu) {
    if (moc(p.year, p.month) !== mocXem) continue
    thuNoTonTrongKy += num(p.amount)
    cong(daThu, p.client_id, 'ketoan', num(p.amount))
  }

  // ================= 4. PHÍ THU KHÁC TRONG KỲ =================
  const tenCty = new Map(clients.map(c => [c.id, c.name]))
  const nvCty = new Map(clients.map(c => [c.id, c.assigned_to]))
  const thuTheoHoSo = new Map()
  for (const p of thuDvk) thuTheoHoSo.set(p.service_id, (thuTheoHoSo.get(p.service_id) || 0) + num(p.amount))
  const thuTrongKyTheoHoSo = new Map()
  for (const p of thuDvk) {
    if (moc(p.year, p.month) !== mocXem) continue
    thuTrongKyTheoHoSo.set(p.service_id, (thuTrongKyTheoHoSo.get(p.service_id) || 0) + num(p.amount))
  }

  let khacPhaiThu = 0, khacDaThu = 0
  const hoSo = []
  const ctyKhac = new Set()
  for (const s of hoSoDvk) {
    const moTrongKy = moc(s.year, s.month) === mocXem
    const thuKy = thuTrongKyTheoHoSo.get(s.id) || 0
    if (!moTrongKy && !thuKy) continue     // hồ sơ cũ, kỳ này không động tới -> chỉ nằm ở dòng tồn
    const daThuHs = thuTheoHoSo.get(s.id) || 0
    if (moTrongKy) khacPhaiThu += num(s.amount)
    khacDaThu += thuKy
    ctyKhac.add(s.client_id)
    cong(phatSinh, s.client_id, 'dvk', moTrongKy ? num(s.amount) : 0)
    cong(daThu, s.client_id, 'dvk', thuKy)
    hoSo.push({
      id: s.id, clientId: s.client_id, clientName: tenCty.get(s.client_id) || '—', name: s.name,
      phaiThu: num(s.amount), daThu: daThuHs, thuTrongKy: thuKy,
      conLai: Math.max(0, num(s.amount) - daThuHs),
      status: s.status, moTrongKy,
    })
  }
  // Thu khác LẺ (service_fees type='khach') — chỉ là tiền đã thu, không có khoản phải thu đi kèm;
  // tính cả vào phải thu lẫn đã thu để không tạo nợ ảo chuyển kỳ sau.
  for (const f of thuKhachLe) {
    const v = num(f.amount)
    if (!v) continue
    khacPhaiThu += v; khacDaThu += v
    ctyKhac.add(f.client_id)
    hoSo.push({
      id: 'le-' + f.client_id, clientId: f.client_id, clientName: tenCty.get(f.client_id) || '—',
      name: f.note || 'Thu khác (không mở hồ sơ)', phaiThu: v, daThu: v, thuTrongKy: v, conLai: 0,
      status: 'done', le: true, moTrongKy: true,
    })
  }

  // ================= 5. CÒN PHẢI THU CHUYỂN KỲ SAU =================
  const chuyen = new Map()
  for (const id of new Set([...tonDau.keys(), ...phatSinh.keys(), ...daThu.keys()])) {
    const t = tonDau.get(id) || { ketoan: 0, hcns: 0, dvk: 0 }
    const p = phatSinh.get(id) || { ketoan: 0, hcns: 0, dvk: 0 }
    const d = daThu.get(id) || { ketoan: 0, hcns: 0, dvk: 0 }
    const r = {
      ketoan: Math.max(0, t.ketoan + p.ketoan - d.ketoan),
      hcns: Math.max(0, t.hcns + p.hcns - d.hcns),
      dvk: Math.max(0, t.dvk + p.dvk - d.dvk),
    }
    if (r.ketoan + r.hcns + r.dvk > 0) chuyen.set(id, r)
  }

  const danhSach = (map) => [...map.entries()]
    .map(([clientId, v]) => ({
      clientId, name: tenCty.get(clientId) || '—', staffId: nvCty.get(clientId) || null,
      ...v, total: v.ketoan + v.hcns + v.dvk,
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const dsTon = danhSach(tonDau)
  const dsChuyen = danhSach(chuyen)

  return {
    tonDau: {
      ketoan: tong(tonDau, 'ketoan'),
      hcns: tong(tonDau, 'hcns'),
      dvk: tong(tonDau, 'dvk'),
      total: dsTon.reduce((a, x) => a + x.total, 0),
      soCty: dsTon.length,
      hcnsCoSoLieu,
      daThuTrongKy: thuNoTonTrongKy,
      theoCty: dsTon,
    },
    phiKetoan: { phi: phiKt, daThu: thuKt, pct: pct(thuKt, phiKt), soCty: ctyKt },
    phiHcns: { phi: phiH, daThu: thuH, pct: pct(thuH, phiH), soCty: ctyH },
    thuKhac: {
      phaiThu: khacPhaiThu, daThu: khacDaThu, pct: pct(khacDaThu, khacPhaiThu),
      soCty: ctyKhac.size, soHoSo: hoSo.filter(h => !h.le).length,
      hoSo: hoSo.sort((a, b) => b.phaiThu - a.phaiThu),
    },
    chuyenKySau: {
      ketoan: dsChuyen.reduce((a, x) => a + x.ketoan, 0),
      hcns: dsChuyen.reduce((a, x) => a + x.hcns, 0),
      dvk: dsChuyen.reduce((a, x) => a + x.dvk, 0),
      total: dsChuyen.reduce((a, x) => a + x.total, 0),
      soCty: dsChuyen.length,
      theoCty: dsChuyen,
    },
  }
}
