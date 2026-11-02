// Bảng cấp bậc (luong_cap_bac, sql/31) — hàm THUẦN kiểm + chuẩn hoá danh sách trước khi lưu. Nhân viên NB tự
// thêm cấp mới (anh yêu cầu 02/11/2026): dòng mới gửi lên không có `ma` → máy chủ tự sinh từ tên.
// Tên cấp phải KHÔNG TRÙNG: file hồ sơ lương nhận cấp theo TÊN (nhapHoSo.js, VLOOKUP trong fileHoSoLuong.js).
// Bộ kiểm: node scripts/test-luong-cap-bac.mjs
// Giống soTien / tienHopLe ở api.js — chép lại để file này không kéo theo supabase (dùng được cả ở trình duyệt).
const soTien = v => (v === '' || v === null || v === undefined) ? null : Number(v)
const tienHopLe = v => v === null || (isFinite(v) && v >= 0 && v < 1e10)

const MA_HOP_LE = /^CAP_[A-Z0-9]{1,3}$/
const SO_CAP_TOI_DA = 50

// "Cấp 9" → CAP_9, "Cấp D" → CAP_D, "Trưởng nhóm" → CAP_TRU; trùng thì thêm số / dùng X1, X2…
export function sinhMaCap(ten, daCo) {
  const goc = String(ten || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
    .toUpperCase().replace(/^CAP\s+/, '').replace(/[^A-Z0-9]/g, '').slice(0, 3)
  if (goc && !daCo.has('CAP_' + goc)) return 'CAP_' + goc
  for (let i = 1; i < 1000; i++) {
    const ma = 'CAP_X' + i
    if (ma.length <= 8 && !daCo.has(ma)) return ma
  }
  return null
}

// ds: danh sách người dùng gửi (cũ có `ma`, mới thì không). Trả { loi } hoặc { rows } để upsert.
export function chuanHoaCapBac(ds, luc = new Date().toISOString()) {
  if (!Array.isArray(ds) || !ds.length || ds.length > SO_CAP_TOI_DA) return { loi: 'Danh sách cấp bậc không hợp lệ' }
  const daCo = new Set(ds.map(r => r?.ma).filter(Boolean))
  const tenDaDung = new Map()
  // Thứ tự mới: cấp thêm vào nối sau cấp cuối CÙNG NHÓM (nhân viên < trưởng phòng)
  const maxThuTu = { nhan_vien: 0, truong_phong: 10 }
  for (const r of ds) if (r?.ma) { const n = r.nhom === 'truong_phong' ? 'truong_phong' : 'nhan_vien'; maxThuTu[n] = Math.max(maxThuTu[n], Number(r.thu_tu) || 0) }
  const rows = []
  for (const r of ds) {
    const ten = String(r?.ten || '').trim().replace(/\s+/g, ' ').slice(0, 30)
    if (!ten) return { loi: 'Có cấp bậc chưa đặt tên' }
    const k = ten.toLowerCase()
    if (tenDaDung.has(k)) return { loi: 'Trùng tên cấp "' + ten + '" — file hồ sơ lương nhận cấp theo tên nên mỗi cấp phải một tên riêng' }
    tenDaDung.set(k, true)
    const nhom = r.nhom === 'truong_phong' ? 'truong_phong' : 'nhan_vien'
    const v = { lcb: soTien(r.luong_co_ban), dt: soTien(r.doanh_thu_toi_thieu), bh: soTien(r.luong_bhxh) }
    if (v.lcb === null || !v.lcb) return { loi: ten + ': chưa nhập lương cơ bản' }
    if (!tienHopLe(v.lcb) || !tienHopLe(v.dt) || !tienHopLe(v.bh)) return { loi: ten + ': số tiền không hợp lệ' }
    let ma = r.ma, thuTu = Number(r.thu_tu) || 0
    if (!ma) {
      ma = sinhMaCap(ten, daCo)
      if (!ma) return { loi: 'Không sinh được mã cho cấp "' + ten + '"' }
      daCo.add(ma)
      thuTu = ++maxThuTu[nhom]
    }
    if (!MA_HOP_LE.test(String(ma))) return { loi: 'Dòng cấp bậc không hợp lệ: ' + ten }
    rows.push({
      ma, ten, nhom, thu_tu: thuTu, luong_co_ban: v.lcb, doanh_thu_toi_thieu: v.dt, luong_bhxh: v.bh,
      mo_ta: r.mo_ta ? String(r.mo_ta).trim().slice(0, 200) || null : null, updated_at: luc,
    })
  }
  return { rows }
}
