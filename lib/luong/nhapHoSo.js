// Phân hệ Tiền lương — NHẬP FILE "Hồ sơ lương nhân viên" (file mẫu lib/luong/fileHoSoLuong.js). BƯỚC 1.
// Tách khỏi route (23/10/2026) để nút "Nhập file hồ sơ" trên app và script nhập hộ dùng ĐÚNG một luật kiểm.
// Nhận người theo EMAIL. ghi=false → xem trước từng dòng (đổi gì, lỗi gì); ghi=true → lưu.
// Trả { loi, status? } | { preview, dong } | { ok, soGhi, loiGhi }.
import { tienHopLe, pad } from './api.js'

const MA_NV_HOP_LE = /^[\p{L}\p{N}._\-/]{1,20}$/u
const laRemote = s => s?.rooms?.type === 'remote'

export async function nhapHoSo(supabase, dsFile, { ghi = false, callerId = null } = {}) {
  dsFile = Array.isArray(dsFile) ? dsFile.slice(0, 500) : []
  if (!dsFile.length) return { loi: 'File không có dòng nhân viên nào' }
  const [{ data: st, error: eSt }, { data: cap }, { data: ls }, nhRes] = await Promise.all([
    supabase.from('staff').select('id, full_name, email, is_active, ma_nhan_vien, ngay_vao_lam, cham_cong_may, rooms(type)'),
    supabase.from('luong_cap_bac').select('*'),
    supabase.from('luong_nhan_vien').select('*').limit(5000),
    supabase.from('luong_ngan_hang').select('*').limit(5000),
  ])
  if (eSt) return { loi: /ma_nhan_vien|ngay_vao_lam|cham_cong_may/.test(eSt.message) ? 'Chưa chạy sql/38_luong_ma_nv_may_cham_cong.sql' : eSt.message, status: 500 }
  const theoEmail = new Map((st || []).map(s => [String(s.email).toLowerCase(), s]))
  const capTheoTen = new Map((cap || []).map(c => [String(c.ten).trim().toLowerCase(), c]))
  const chu = v => String(v ?? '').trim()
  const tien = v => { const t = chu(v).replace(/[^\d]/g, ''); return t === '' ? null : Number(t) }
  const coKhong = v => { const t = chu(v).toLowerCase(); return t === 'có' || t === 'co' || t === 'x' ? true : t === 'không' || t === 'khong' ? false : null }
  const ngayIso = v => {
    // Ô gõ thành NGÀY của Excel đọc ra số sê-ri (44935 = 09/01/2023).
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10)
    const t = chu(v); if (!t) return ''
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[1] + '-' + m[2] + '-' + m[3]
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1])
    return null
  }
  const maTrongFile = new Map()
  const ketQua = []
  for (const x of dsFile) {
    const r = { hang: Number(x.hang) || null, email: chu(x.email).toLowerCase(), loi: [], doi: [] }
    const s = theoEmail.get(r.email)
    if (!s || !s.is_active) { ketQua.push({ ...r, tt: 'khong_thay', loi: ['Không có nhân viên đang làm việc với email này'] }); continue }
    r.staff_id = s.id; r.ten = s.full_name
    if (laRemote(s)) { ketQua.push({ ...r, tt: 'remote' }); continue }
    // 1) Hồ sơ: mã, ngày vào làm, chấm công bằng máy
    const hs = {}
    const ma = chu(x.ma).toUpperCase()
    if (ma && !MA_NV_HOP_LE.test(ma)) r.loi.push('Mã NV "' + ma + '" không hợp lệ')
    else if (ma && maTrongFile.has(ma)) r.loi.push('Mã ' + ma + ' trùng với dòng ' + maTrongFile.get(ma))
    else if (ma) {
      maTrongFile.set(ma, r.hang)
      const khac = (st || []).find(o => o.id !== s.id && String(o.ma_nhan_vien || '').toUpperCase() === ma)
      if (khac && !dsFile.some(y => chu(y.email).toLowerCase() === String(khac.email).toLowerCase())) r.loi.push('Mã ' + ma + ' đang là của ' + khac.full_name)
      if (ma !== (s.ma_nhan_vien || '')) { hs.ma_nhan_vien = ma; r.doi.push('mã ' + (s.ma_nhan_vien || '—') + ' → ' + ma) }
    }
    const ngay = ngayIso(x.ngayVao)
    if (ngay === null) r.loi.push('Ngày vào làm "' + chu(x.ngayVao) + '" không đúng dạng dd/mm/yyyy')
    else if (ngay && ngay !== (s.ngay_vao_lam || '')) { hs.ngay_vao_lam = ngay; r.doi.push('vào làm ' + ngay.split('-').reverse().join('/')) }
    const may = coKhong(x.mayCC)
    if (may !== null && may !== (s.cham_cong_may !== false)) { hs.cham_cong_may = may; r.doi.push(may ? 'chấm công bằng máy' : 'tự khai công') }
    // 2) Lương: chỉ khi có cấp bậc hoặc lương cơ bản
    let luong = null
    const capRow = chu(x.cap) ? capTheoTen.get(chu(x.cap).toLowerCase()) : null
    if (chu(x.cap) && !capRow) r.loi.push('Cấp bậc "' + chu(x.cap) + '" không có trong bảng cấp')
    let lcb = tien(x.lcb), dt = tien(x.dt), bh = tien(x.bhxh)
    if (capRow && lcb === null) { lcb = Number(capRow.luong_co_ban); dt = capRow.doanh_thu_toi_thieu == null ? null : Number(capRow.doanh_thu_toi_thieu); bh = capRow.luong_bhxh == null ? null : Number(capRow.luong_bhxh) }
    if (lcb !== null) {
      const m = /^(\d{1,2})\/(\d{4})$/.exec(chu(x.tuThang))
      const thamGia = coKhong(x.thamGia) ?? false
      const npt = chu(x.npt) === '' ? 0 : Number(x.npt)
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) r.loi.push('Áp dụng từ tháng "' + chu(x.tuThang) + '" không đúng dạng MM/YYYY')
      else if (!tienHopLe(lcb) || !tienHopLe(dt) || !tienHopLe(bh)) r.loi.push('Số tiền lương không hợp lệ')
      else if (thamGia && !bh) r.loi.push('Tham gia BHXH thì phải có lương đóng BHXH')
      else if (!Number.isInteger(npt) || npt < 0 || npt > 20) r.loi.push('Người phụ thuộc phải là số nguyên 0–20')
      else {
        luong = { staff_id: s.id, ap_dung_tu: m[2] + '-' + pad(m[1]) + '-01', cap_bac: capRow?.ma || null, luong_co_ban: lcb, doanh_thu_toi_thieu: dt,
          luong_bhxh: bh, tham_gia_bhxh: thamGia, so_nguoi_phu_thuoc: npt, ghi_chu: chu(x.ghiChu).slice(0, 300) || 'Nhập từ file hồ sơ lương' }
        const cu = (ls || []).find(l => l.staff_id === s.id && String(l.ap_dung_tu).slice(0, 10) === luong.ap_dung_tu)
        const giong = cu && ['cap_bac', 'luong_co_ban', 'doanh_thu_toi_thieu', 'luong_bhxh', 'tham_gia_bhxh', 'so_nguoi_phu_thuoc']
          .every(k => String(cu[k] ?? '') === String(luong[k] ?? '') || (typeof luong[k] === 'number' && Number(cu[k]) === luong[k]))
        if (giong) luong = null
        else r.doi.push('lương ' + (capRow?.ten || 'riêng') + ' ' + lcb.toLocaleString('vi-VN') + (thamGia ? ' · BHXH ' + Number(bh).toLocaleString('vi-VN') : ' · không BHXH') + (npt ? ' · ' + npt + ' NPT' : '') + ' từ ' + m[1] + '/' + m[2])
      }
    }
    // 3) Tài khoản ngân hàng
    let nh = null
    const stk = chu(x.stk).replace(/\s+/g, ''), maNh = chu(x.maNh)
    if (stk || chu(x.nh) || maNh) {
      if (stk && !/^[0-9A-Za-z.-]{4,30}$/.test(stk)) r.loi.push('Số tài khoản "' + stk + '" không hợp lệ')
      else if (maNh && !/^\d{1,10}$/.test(maNh)) r.loi.push('Mã ngân hàng "' + maNh + '" chỉ gồm chữ số')
      else {
        nh = { staff_id: s.id, ngan_hang: chu(x.nh).slice(0, 120) || null, so_tai_khoan: stk || null, ma_ngan_hang: maNh || null, chu_tai_khoan: chu(x.chuTk).toUpperCase().slice(0, 120) || null }
        const cu = (nhRes.data || []).find(b => b.staff_id === s.id)
        if (cu && ['ngan_hang', 'so_tai_khoan', 'ma_ngan_hang', 'chu_tai_khoan'].every(k => (cu[k] || null) === nh[k])) nh = null
        else r.doi.push('tài khoản ' + (nh.ngan_hang || '') + ' ' + (nh.so_tai_khoan || ''))
      }
    }
    r.hs = Object.keys(hs).length ? hs : null; r.luong = luong; r.nh = nh
    r.tt = r.loi.length ? 'loi' : (r.hs || r.luong || r.nh) ? 'doi' : 'giu'
    ketQua.push(r)
  }
  if (!ghi) return { preview: true, dong: ketQua.map(({ hs, luong, nh, ...r }) => r) }

  let soGhi = 0
  const loiGhi = []
  for (const r of ketQua) {
    if (r.tt !== 'doi') continue
    const nay = new Date().toISOString()
    if (r.hs) {
      const { error } = await supabase.from('staff').update(r.hs).eq('id', r.staff_id)
      if (error) { loiGhi.push(r.ten + ': ' + (/uniq|duplicate/i.test(error.message) ? 'mã nhân viên đã dùng cho người khác' : error.message)); continue }
    }
    if (r.luong) {
      const { error } = await supabase.from('luong_nhan_vien').upsert({ ...r.luong, tao_boi: callerId, tao_luc: nay }, { onConflict: 'staff_id,ap_dung_tu' })
      if (error) { loiGhi.push(r.ten + ' (lương): ' + error.message); continue }
    }
    if (r.nh) {
      const { error } = await supabase.from('luong_ngan_hang').upsert({ ...r.nh, sua_boi: callerId, sua_luc: nay }, { onConflict: 'staff_id' })
      if (error) { loiGhi.push(r.ten + ' (tài khoản): ' + error.message); continue }
    }
    soGhi++
  }
  return { ok: true, soGhi, loiGhi }
}
