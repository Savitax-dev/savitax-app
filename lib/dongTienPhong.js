import { countsForMonth } from './contractDates.js'
import { feeCountsForMonth, resolveFeeForMonth } from './feeDue.js'
import { resolveHcnsFeeForMonth } from './hcnsFee.js'

// DÒNG TIỀN CÔNG NỢ CỦA MỘT PHÒNG (khối 5 thẻ ở trang Phòng → tab Công nợ phòng).
//
//   Tồn đầu kỳ  +  phí phát sinh trong kỳ  −  đã thu trong kỳ  =  còn phải thu chuyển kỳ sau
//
// BẤT BIẾN SỐ MỘT (anh chốt 05/10/2026): "còn phải thu chuyển kỳ sau" của T9 phải đúng bằng
// "tồn đầu kỳ chuyển sang" của T10. Muốn giữ được thì hai số đó phải do CÙNG MỘT công thức sinh
// ra, nên ở đây tính SỐ DƯ CHẠY DẦN qua từng kỳ cho từng công ty:
//
//     sodu(kỳ kế) = max(0, sodu(kỳ) + phí kỳ đó − tiền thu kỳ đó)
//
// "Tồn đầu kỳ P" = số dư chạy tới P; "chuyển kỳ sau" = thêm đúng một bước nữa, nên hai kỳ liền
// nhau tự khớp. Lần đầu em lấy tồn đầu kỳ từ SỔ NỢ TỒN (`debt_rollovers`) — sai, vì sổ chỉ chốt
// sau ngày 10 của tháng kế, nên xem T10 vào 05/10 thì phần chưa thu của T9 chưa có dòng nào và
// tồn đầu kỳ hụt mất (đo thật: Aoraki T9 chuyển kỳ sau 98.380.000 mà T10 tồn đầu ra 44.080.000).
//
// Ba loại thu đi ba đường vì dữ liệu gốc khác nhau:
//   · Kế toán      — số dư chạy từ kỳ chốt sổ sớm nhất. Điểm xuất phát suy ngược từ nợ tồn ĐANG
//                    CÓ: `clients.other_debt` − Σ đã chốt sổ + Σ đã thu nợ tồn = nợ cũ nhập tay
//                    hồi chưa có app. Khoản nợ cũ đó không có dòng chốt nào, nên cộng thuần
//                    `rolled_amount` thì tiền thu nợ tồn trừ vào hư không rồi ra số âm.
//   · HCNS         — phí HCNS mới tách riêng khỏi phí kế toán từ T9/2026 (HCNS_TU) nên số dư chạy
//                    từ đó, xuất phát 0. Kỳ trước T9 không có số -> giao diện ghi "chưa tách
//                    riêng" chứ không phải 0đ. Sau này nạp sổ chốt HCNS từ Excel
//                    (`debt_rollovers` source='hcns') thì ưu tiên số trong sổ, không cộng chồng.
//   · Dịch vụ khác — tính thẳng từ hồ sơ (`other_services` + `other_service_payments`, sql/24).
//                    Hồ sơ chỉ có từ lúc lên app nên kỳ trước đó ra 0 — đúng ý người dùng.
//
// Phí chỉ phát sinh khi công ty ĐANG dùng dịch vụ, đã tới mốc hợp đồng và tới kỳ thu
// (`phiKetoanCua`) — dùng CHUNG một hàm cho cả số dư chạy dần lẫn thẻ "phí trong kỳ"; lệch điều
// kiện ở một chỗ là bất biến trên gãy ngay.

const num = (v) => Math.round(Number(v) || 0)
const moc = (y, m) => y * 12 + m
const thang = (k) => { const y = Math.floor((k - 1) / 12); return { y, m: k - y * 12 } }
const pct = (thu, phi) => phi <= 0 ? (thu > 0 ? 100 : 0) : Math.round(thu / phi * 100)

// Phí HCNS bắt đầu tách riêng khỏi phí kế toán từ kỳ này.
const HCNS_TU = { year: 2026, month: 9 }

const cong = (map, id, loai, v) => {
  if (!v) return
  if (!map.has(id)) map.set(id, { ketoan: 0, hcns: 0, dvk: 0 })
  map.get(id)[loai] += v
}
const tong = (map, loai) => [...map.values()].reduce((a, x) => a + x[loai], 0)

export async function tinhDongTienPhong(supabase, {
  clients,          // mọi công ty NHÂN VIÊN CHÍNH của phòng (mọi trạng thái)
  year, month,
  feePlanRows = [],
  changeLogRows = [],
  feeKetoanMap = {},// clientId -> đã thu phí kế toán TRONG KỲ
  hcnsByClient = {},// clientId -> { due, fee, collected } của kỳ này
  hcnsLichSu = null,// { links, plans, paid } — mọi kỳ, để chạy số dư HCNS
}) {
  const ids = clients.map(c => c.id)
  const mocXem = moc(year, month)
  if (!ids.length) {
    return {
      tonDau: { ketoan: 0, hcns: 0, dvk: 0, total: 0, soCty: 0, hcnsCoSoLieu: false, daThuTrongKy: 0, theoCty: [] },
      phiKetoan: { phi: 0, daThu: 0, pct: 0, soCty: 0 },
      phiHcns: { phi: 0, daThu: 0, pct: 0, soCty: 0 },
      thuKhac: { phaiThu: 0, daThu: 0, pct: 0, soCty: 0, soHoSo: 0, hoSo: [] },
      chuyenKySau: { ketoan: 0, hcns: 0, dvk: 0, total: 0, soCty: 0, theoCty: [] },
    }
  }

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

  const [rollovers, noTonThu, thuKetoanMoiKy, hoSoDvk, thuDvk, thuKhachLe] = await Promise.all([
    bo(() => hetTrang(() => supabase.from('debt_rollovers')
      .select('client_id, year, month, rolled_amount, source').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('service_fees')
      .select('client_id, year, month, amount').in('client_id', ids).eq('type', 'no_ton'))),
    bo(() => hetTrang(() => supabase.from('service_fees')
      .select('client_id, year, month, amount').in('client_id', ids).eq('type', 'ketoan'))),
    bo(() => hetTrang(() => supabase.from('other_services')
      .select('id, client_id, name, amount, year, month, status').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('other_service_payments')
      .select('service_id, client_id, amount, year, month').in('client_id', ids))),
    bo(() => hetTrang(() => supabase.from('service_fees')
      .select('client_id, amount, note').in('client_id', ids).eq('type', 'khach').eq('year', year).eq('month', month))),
  ])

  const gop = (rows) => {
    const m = new Map()
    for (const r of rows) {
      const k = r.client_id + '_' + moc(r.year, r.month)
      m.set(k, (m.get(k) || 0) + num(r.amount))
    }
    return m
  }
  const thuKetoanKy = gop(thuKetoanMoiKy)
  const thuNoTonKy = gop(noTonThu)

  const rolledTong = new Map(), thuNoTonTong = new Map()
  let mocSom = Infinity
  for (const r of rollovers) {
    if ((r.source || 'ketoan') === 'hcns') continue
    rolledTong.set(r.client_id, (rolledTong.get(r.client_id) || 0) + num(r.rolled_amount))
    mocSom = Math.min(mocSom, moc(r.year, r.month))
  }
  for (const p of noTonThu) thuNoTonTong.set(p.client_id, (thuNoTonTong.get(p.client_id) || 0) + num(p.amount))
  if (mocSom === Infinity) mocSom = mocXem   // chưa chốt sổ lần nào -> không có lịch sử để chạy

  // Phí kế toán của 1 công ty ở 1 kỳ — dùng chung cho số dư chạy dần VÀ cho thẻ "phí trong kỳ".
  const phiKetoanCua = (c, y, m) => {
    if ((c.status || 'active') !== 'active') return 0
    if (!countsForMonth(c, y, m)) return 0
    if (!feeCountsForMonth(c.fee_period, y, m)) return 0
    return num(resolveFeeForMonth(feePlanRows, c.id, y, m, c.monthly_fee, changeLogRows))
  }

  const hcnsPaidKy = new Map(hcnsLichSu?.paid || [])
  const hcnsPlans = hcnsLichSu?.plans || []
  const idSet = new Set(ids)
  // Công ty phụ trách phụ cũng có mặt trong hcns_clients của phòng khác — chỉ lấy công ty của
  // phòng này, không thì kéo nợ phòng khác sang đây.
  const hcnsLinks = (hcnsLichSu?.links || []).filter(l => idSet.has(l.linked_client_id))
  const clientById = new Map(clients.map(c => [c.id, c]))

  // ================= 1. TỒN ĐẦU KỲ (số dư chạy dần) =================
  const tonDau = new Map()

  for (const c of clients) {
    // Xuất phát: nợ cũ nhập tay hồi chưa có app (không có dòng chốt sổ nào).
    // CHẶN SÀN 0 ngay tại đây, đừng để số âm chạy vào vòng lặp: có công ty đã chốt sổ nợ tồn mà
    // `other_debt` lại bằng 0 (ca thật 05/10/2026: GOLD TEA ĐỒNG NAI, chốt T8 20.000.000 nhưng
    // other_debt = 0 — sai bất biến "Σ remaining_amount ≤ other_debt"). Để âm thì số âm đó ăn
    // mất phí của kỳ đầu tiên, mà ăn nhiều hay ít lại tuỳ kỳ đang xem -> tồn đầu kỳ T9 ra 0
    // trong khi chuyển kỳ sau của T8 ra 20.000.000.
    let soDu = Math.max(0, num(c.other_debt) - (rolledTong.get(c.id) || 0) + (thuNoTonTong.get(c.id) || 0))
    for (let k = mocSom; k < mocXem; k++) {
      const { y, m } = thang(k)
      const thu = (thuKetoanKy.get(c.id + '_' + k) || 0) + (thuNoTonKy.get(c.id + '_' + k) || 0)
      soDu = Math.max(0, soDu + phiKetoanCua(c, y, m) - thu)
    }
    if (soDu > 0) cong(tonDau, c.id, 'ketoan', soDu)
  }

  const coSoChotHcns = rollovers.some(r => r.source === 'hcns')
  let hcnsCoSoLieu = coSoChotHcns
  if (coSoChotHcns) {
    for (const r of rollovers) {
      if (r.source !== 'hcns' || moc(r.year, r.month) >= mocXem) continue
      cong(tonDau, r.client_id, 'hcns', num(r.rolled_amount))
    }
  } else if (hcnsLinks.length) {
    const mocHcns = moc(HCNS_TU.year, HCNS_TU.month)
    for (const l of hcnsLinks) {
      const c = clientById.get(l.linked_client_id)
      let soDu = 0
      for (let k = mocHcns; k < mocXem; k++) {
        const { y, m } = thang(k)
        const dungKy = c && (c.status || 'active') === 'active' && countsForMonth(c, y, m)
        const phi = dungKy && feeCountsForMonth(l.fee_period, y, m)
          ? num(resolveHcnsFeeForMonth(hcnsPlans, l.id, y, m, Number(l.hcns_fee) || 0, l.created_at))
          : 0
        soDu = Math.max(0, soDu + phi - num(hcnsPaidKy.get(l.id + '_' + y + '_' + m)))
      }
      if (soDu > 0) cong(tonDau, l.linked_client_id, 'hcns', soDu)
    }
    hcnsCoSoLieu = mocXem > mocHcns
  }

  const hoSoKyTruoc = new Set(hoSoDvk.filter(s => moc(s.year, s.month) < mocXem).map(s => s.id))
  for (const s of hoSoDvk) {
    if (moc(s.year, s.month) >= mocXem) continue
    cong(tonDau, s.client_id, 'dvk', num(s.amount))
  }
  for (const p of thuDvk) {
    if (moc(p.year, p.month) >= mocXem || !hoSoKyTruoc.has(p.service_id)) continue
    cong(tonDau, p.client_id, 'dvk', -num(p.amount))
  }
  // Chặn sàn 0 cho TỪNG công ty: chỉ chặn ở tổng thì một công ty âm sẽ ăn bớt nợ công ty khác,
  // mà danh sách bấm vào lại bỏ công ty âm -> tổng thẻ khác tổng danh sách.
  for (const [id, v] of tonDau) {
    v.ketoan = Math.max(0, v.ketoan); v.hcns = Math.max(0, v.hcns); v.dvk = Math.max(0, v.dvk)
    if (v.ketoan + v.hcns + v.dvk === 0) tonDau.delete(id)
  }

  // ================= 2+3. PHÍ PHÁT SINH TRONG KỲ =================
  let phiKt = 0, thuKt = 0, ctyKt = 0, phiH = 0, thuH = 0, ctyH = 0
  const phatSinh = new Map(), daThu = new Map()

  for (const c of clients) {
    const phi = phiKetoanCua(c, year, month)
    const thu = num(feeKetoanMap[c.id])
    if (phi > 0) { phiKt += phi; thuKt += thu; ctyKt++ }
    cong(phatSinh, c.id, 'ketoan', phi)
    cong(daThu, c.id, 'ketoan', thu)

    const h = hcnsByClient[c.id]
    const dungKy = (c.status || 'active') === 'active' && countsForMonth(c, year, month)
    if (h?.due && dungKy) {
      phiH += num(h.fee); thuH += num(h.collected); if (num(h.fee) > 0) ctyH++
      cong(phatSinh, c.id, 'hcns', num(h.fee))
      cong(daThu, c.id, 'hcns', num(h.collected))
    }
  }
  // Tiền thu NỢ TỒN của kỳ này: không phải phí phát sinh, nhưng là tiền thu làm giảm số dư.
  let thuNoTonTrongKy = 0
  for (const p of noTonThu) {
    if (moc(p.year, p.month) !== mocXem) continue
    thuNoTonTrongKy += num(p.amount)
    cong(daThu, p.client_id, 'ketoan', num(p.amount))
  }

  // ================= 4. PHÍ THU KHÁC TRONG KỲ =================
  const tenCty = new Map(clients.map(c => [c.id, c.name]))
  const nvCty = new Map(clients.map(c => [c.id, c.assigned_to]))
  const thuCaHoSo = new Map(), thuHoSoTrongKy = new Map()
  for (const p of thuDvk) {
    thuCaHoSo.set(p.service_id, (thuCaHoSo.get(p.service_id) || 0) + num(p.amount))
    if (moc(p.year, p.month) === mocXem) thuHoSoTrongKy.set(p.service_id, (thuHoSoTrongKy.get(p.service_id) || 0) + num(p.amount))
  }

  let khacPhaiThu = 0, khacDaThu = 0
  const hoSo = [], ctyKhac = new Set()
  for (const s of hoSoDvk) {
    const moTrongKy = moc(s.year, s.month) === mocXem
    const thuKy = thuHoSoTrongKy.get(s.id) || 0
    if (!moTrongKy && !thuKy) continue
    const daThuHs = thuCaHoSo.get(s.id) || 0
    if (moTrongKy) khacPhaiThu += num(s.amount)
    khacDaThu += thuKy
    ctyKhac.add(s.client_id)
    cong(phatSinh, s.client_id, 'dvk', moTrongKy ? num(s.amount) : 0)
    cong(daThu, s.client_id, 'dvk', thuKy)
    hoSo.push({
      id: s.id, clientId: s.client_id, clientName: tenCty.get(s.client_id) || '—', name: s.name,
      phaiThu: num(s.amount), daThu: daThuHs, thuTrongKy: thuKy,
      conLai: Math.max(0, num(s.amount) - daThuHs), status: s.status, moTrongKy,
    })
  }
  // Thu khác LẺ (service_fees type='khach') chỉ là tiền đã thu, không có khoản phải thu đi kèm
  // -> tính cả vào phải thu lẫn đã thu để không đẻ ra nợ ảo chuyển kỳ sau.
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
  // Đúng MỘT bước của số dư chạy dần ở trên -> tồn đầu kỳ của kỳ sau ra y hệt số này.
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

  const dsTon = danhSach(tonDau), dsChuyen = danhSach(chuyen)

  return {
    tonDau: {
      ketoan: tong(tonDau, 'ketoan'), hcns: tong(tonDau, 'hcns'), dvk: tong(tonDau, 'dvk'),
      total: dsTon.reduce((a, x) => a + x.total, 0),
      soCty: dsTon.length, hcnsCoSoLieu, daThuTrongKy: thuNoTonTrongKy, theoCty: dsTon,
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
      soCty: dsChuyen.length, theoCty: dsChuyen,
    },
  }
}
