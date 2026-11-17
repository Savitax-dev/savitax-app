// Phân hệ Pháp lý — tiền của hồ sơ (hàm THUẦN, không đọc DB; kiểm: node scripts/test-phaply-tien.mjs).
// Quy tắc anh chốt 31/10/2026 (kế hoạch mục 8):
//   • Mỗi hồ sơ tách PHÍ DỊCH VỤ (doanh số Savitax) và THU HỘ (lệ phí Sở, dấu, CKS… — không bao giờ là doanh số).
//   • Thu theo ĐỢT; đợt đến hạn khi hồ sơ sang bước due_stage (lần đầu) hoặc tới ngày due_date.
//   • Doanh số tháng T = tổng phần dịch vụ ĐÃ THU có paid_at trong T (thu đợt nào tính đợt đó, đúng tháng thu).
//   • Khách trả thiếu một đợt → mặc định trừ THU HỘ TRƯỚC rồi mới tới phí dịch vụ (nhân viên sửa được).
//   • Số tiền GỒM VAT; doanh số hiện thêm bản ÷1,08 (phân hệ Lương tính doanh thu như vậy).
// Dòng tiền (mục 8.2): tồn đầu kỳ + phát sinh − đã thu = chuyển kỳ sau. Một đợt "phát sinh" ở tháng đến hạn; khách trả
// TRƯỚC hạn thì phần trả trước phát sinh ngay tháng trả (cộng rồi trừ trong cùng tháng) — vì thế "đã thu" của thẻ
// luôn bằng tiền thật về trong tháng và số dư không bao giờ âm vì trả sớm.

const so = v => Math.round(Number(v) || 0)
export const thang = iso => String(iso || '').slice(0, 7)          // 'YYYY-MM'
export const truocVat = n => Math.round(so(n) / 1.08)

// Chia một khoản khách trả vào (thu hộ, dịch vụ) của một đợt: thu hộ còn thiếu trước.
export function tachKhoanThu(soTien, conThuHo) {
  const t = Math.max(0, so(soTien))
  const th = Math.min(t, Math.max(0, so(conThuHo)))
  return { amount_thu_ho: th, amount_dich_vu: t - th }
}

// Ngày (YYYY-MM-DD) hồ sơ LẦN ĐẦU tới bước >= n, theo nhật ký chuyển bước; hồ sơ tạo thẳng ở bước >= n → ngày nhận.
export function ngayToiBuoc(hoSo, nhatKy, n) {
  if (!n) return null
  // Hồ sơ ở bước 1 ngay từ ngày nhận — nhật ký chỉ ghi các lần chuyển SAU đó (lỗi 17/11: đợt "khi nhận" ra ngày chuyển bước)
  if (n <= 1) return String(hoSo.received_at || '').slice(0, 10) || null
  if (Number(hoSo.stage) < n && !(nhatKy || []).some(l => laChuyenBuoc(l) && Number(l.to_value) >= n)) return null
  const lan = (nhatKy || []).filter(l => laChuyenBuoc(l) && Number(l.to_value) >= n)
    .map(l => homNay(l.created_at)).sort()[0]
  if (lan) return lan
  return String(hoSo.received_at || '').slice(0, 10) || null
}
const laChuyenBuoc = l => l.kind === 'stage' || l.kind === 'close'
const homNay = ts => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts))

// Ngày đến hạn của một đợt (null = chưa đến hạn). Không đặt mốc nào → đến hạn ngay ngày nhận hồ sơ.
export function ngayDenHan(dot, hoSo, nhatKy) {
  if (dot.due_date) return String(dot.due_date).slice(0, 10)
  if (dot.due_stage) return ngayToiBuoc(hoSo, nhatKy, Number(dot.due_stage))
  return String(hoSo.received_at || '').slice(0, 10) || null
}

const conHieuLuc = p => !p.deleted_at

// Tổng hợp tiền một hồ sơ: phí, từng đợt (đến hạn / đã thu / còn lại), cảnh báo lịch thu lệch tổng phí.
export function tongHopHoSo({ hoSo, fees = [], dots = [], payments = [], nhatKy = [], homNayISO }) {
  const phiDv = fees.filter(f => f.kind === 'dich_vu').reduce((a, f) => a + so(f.amount), 0)
  const phiTh = fees.filter(f => f.kind === 'thu_ho').reduce((a, f) => a + so(f.amount), 0)
  const pays = payments.filter(conHieuLuc)
  const hn = homNayISO || homNay(Date.now())
  const dsDot = [...dots].sort((a, b) => so(a.seq) - so(b.seq)).map(d => {
    const tra = pays.filter(p => p.installment_id === d.id)
    const daDv = tra.reduce((a, p) => a + so(p.amount_dich_vu), 0)
    const daTh = tra.reduce((a, p) => a + so(p.amount_thu_ho), 0)
    const han = ngayDenHan(d, hoSo, nhatKy)
    const tong = so(d.amount_dich_vu) + so(d.amount_thu_ho)
    return {
      ...d, den_han_ngay: han, da_den_han: !!han && han <= hn,
      da_thu_dich_vu: daDv, da_thu_thu_ho: daTh, da_thu: daDv + daTh,
      con_dich_vu: so(d.amount_dich_vu) - daDv, con_thu_ho: so(d.amount_thu_ho) - daTh, con: tong - daDv - daTh,
      tong,
    }
  })
  const daDv = pays.reduce((a, p) => a + so(p.amount_dich_vu), 0)
  const daTh = pays.reduce((a, p) => a + so(p.amount_thu_ho), 0)
  const lichDv = dots.reduce((a, d) => a + so(d.amount_dich_vu), 0)
  const lichTh = dots.reduce((a, d) => a + so(d.amount_thu_ho), 0)
  const denHan = dsDot.filter(d => d.da_den_han)
  const canhBao = []
  if (dots.length && (lichDv !== phiDv || lichTh !== phiTh))
    canhBao.push(`Lịch thu (${(lichDv + lichTh).toLocaleString('vi-VN')}) chưa khớp tổng phí (${(phiDv + phiTh).toLocaleString('vi-VN')})`)
  if (!dots.length && phiDv + phiTh > 0) canhBao.push('Chưa lập lịch thu theo đợt')
  return {
    phi_dich_vu: phiDv, phi_thu_ho: phiTh, phi: phiDv + phiTh,
    da_thu_dich_vu: daDv, da_thu_thu_ho: daTh, da_thu: daDv + daTh,
    con_phai_thu: phiDv + phiTh - daDv - daTh,
    // Nợ = phần ĐÃ đến hạn mà chưa thu (khác "còn phải thu" của cả hồ sơ)
    no_den_han: denHan.reduce((a, d) => a + Math.max(0, d.con), 0),
    dots: dsDot, canh_bao: canhBao,
  }
}

// Doanh số theo tháng thu: { 'YYYY-MM': { gom_vat, truoc_vat, theo_nv: { staffId: gom_vat } } }
export function doanhSoTheoThang(payments) {
  const ra = {}
  for (const p of payments.filter(conHieuLuc)) {
    const m = thang(p.paid_at), v = so(p.amount_dich_vu)
    if (!m || !v) continue
    const o = (ra[m] ||= { gom_vat: 0, truoc_vat: 0, theo_nv: {} })
    o.gom_vat += v
    const k = p.staff_id || '_'
    o.theo_nv[k] = (o.theo_nv[k] || 0) + v
  }
  for (const o of Object.values(ra)) o.truoc_vat = truocVat(o.gom_vat)
  return ra
}

// Sự kiện tiền theo tháng của một hồ sơ: [{ thang, loai: 'dich_vu'|'thu_ho', phat_sinh, da_thu }]
// dots đã qua tongHopHoSo (có den_han_ngay). Đợt chưa đến hạn chỉ phát sinh phần khách trả trước.
export function suKienTien(dots, payments) {
  const ev = []
  const pays = payments.filter(conHieuLuc)
  const dotIds = new Set(dots.map(d => d.id))
  for (const d of dots) {
    const D = d.den_han_ngay ? thang(d.den_han_ngay) : null
    for (const [loai, cot] of [['dich_vu', 'amount_dich_vu'], ['thu_ho', 'amount_thu_ho']]) {
      let traTruoc = 0
      for (const p of pays.filter(x => x.installment_id === d.id)) {
        const P = thang(p.paid_at), v = so(p[cot])
        if (!v) continue
        if (!D || P < D) { traTruoc += v; ev.push({ thang: P, loai, phat_sinh: v, da_thu: v }) }
        else ev.push({ thang: P, loai, phat_sinh: 0, da_thu: v })
      }
      if (D) { const ps = so(d[cot]) - traTruoc; if (ps > 0) ev.push({ thang: D, loai, phat_sinh: ps, da_thu: 0 }) }
    }
  }
  // Khoản thu không gắn đợt nào: phát sinh = thu ngay tháng đó
  for (const p of pays.filter(x => !x.installment_id || !dotIds.has(x.installment_id)))
    for (const [loai, cot] of [['dich_vu', 'amount_dich_vu'], ['thu_ho', 'amount_thu_ho']]) {
      const v = so(p[cot]); if (v) ev.push({ thang: thang(p.paid_at), loai, phat_sinh: v, da_thu: v })
    }
  return ev
}

// Dòng tiền các tháng (danh sách 'YYYY-MM' tăng dần): mỗi tháng { dich_vu, thu_ho, tong } × { ton_dau, phat_sinh, da_thu, chuyen }
export function dongTien(suKien, cacThang) {
  const rong = () => ({ ton_dau: 0, phat_sinh: 0, da_thu: 0, chuyen: 0 })
  const dau = cacThang[0]
  const ra = cacThang.map(m => ({ thang: m, dich_vu: rong(), thu_ho: rong(), tong: rong() }))
  for (const loai of ['dich_vu', 'thu_ho']) {
    let du = suKien.filter(e => e.loai === loai && e.thang < dau).reduce((a, e) => a + e.phat_sinh - e.da_thu, 0)
    for (const o of ra) {
      const t = o[loai]; t.ton_dau = du
      for (const e of suKien) if (e.loai === loai && e.thang === o.thang) { t.phat_sinh += e.phat_sinh; t.da_thu += e.da_thu }
      t.chuyen = t.ton_dau + t.phat_sinh - t.da_thu; du = t.chuyen
    }
  }
  for (const o of ra) for (const k of ['ton_dau', 'phat_sinh', 'da_thu', 'chuyen']) o.tong[k] = o.dich_vu[k] + o.thu_ho[k]
  return ra
}

// Danh sách tháng từ..tới (YYYY-MM, gồm cả hai đầu)
export function cacThangTu(tu, toi) {
  const ra = []
  let [y, m] = tu.split('-').map(Number)
  const [y2, m2] = toi.split('-').map(Number)
  while (y < y2 || (y === y2 && m <= m2)) { ra.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } }
  return ra
}

// Áp lịch thu mẫu (items: [{ten, pt_dich_vu, pt_thu_ho, due_stage}]) lên tổng phí → các đợt; phần lẻ dồn vào đợt cuối
export function apLichMau(items, phiDv, phiTh) {
  const ds = (items || []).map((it, i) => ({
    seq: i + 1, name: it.ten || `Đợt ${i + 1}`, due_stage: it.due_stage || null,
    amount_dich_vu: Math.round(so(phiDv) * (Number(it.pt_dich_vu) || 0) / 100),
    amount_thu_ho: Math.round(so(phiTh) * (Number(it.pt_thu_ho) || 0) / 100),
  }))
  if (ds.length) {
    const cuoi = ds[ds.length - 1]
    cuoi.amount_dich_vu += so(phiDv) - ds.reduce((a, d) => a + d.amount_dich_vu, 0)
    cuoi.amount_thu_ho += so(phiTh) - ds.reduce((a, d) => a + d.amount_thu_ho, 0)
  }
  return ds
}
