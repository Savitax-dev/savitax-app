// Công ty "đặc thù" về công nợ — anh chốt 01/11/2026, sql/45. Admin bật ở Danh sách công ty (chỉ admin thật).
//
// 1) THU PHÍ KHÔNG VAT (clients.khong_vat): công ty không lấy hóa đơn, phí nhập vào app KHÔNG gồm VAT 8%.
//    → Mọi chỗ "tách VAT ÷ 1,08" (doanh thu tính lương, hoa hồng giới thiệu, thưởng dịch vụ khác của công ty
//      đó) và phiếu Đề nghị thanh toán (dòng VAT) KHÔNG chia / không cộng VAT. %-thu hồi công nợ không đổi
//      (đã thu và phải thu cùng một gốc).
//
// 2) GIA HẠN THU (clients.gia_han_thu_thang = N tháng, 0 = bình thường; kèm gia_han_thu_ly_do): admin cho phép
//    khách trả chậm. Áp cho PHÍ KẾ TOÁN (phí HCNS chưa áp).
//    → Hạn sửa công nợ + hạn tự chuyển "nợ tồn" của kỳ M lùi từ ngày 10 tháng M+1 sang ngày 10 tháng M+1+N:
//      trong thời gian đó nhân viên vẫn ghi tiền vào ĐÚNG tháng gốc (loại 'ketoan').
//    → %-công nợ: kỳ còn trong gia hạn mà CHƯA THU ĐỦ thì TẠM KHÔNG TÍNH công ty đó (bỏ khỏi CẢ tử số lẫn mẫu
//      số); thu đủ thì tính bình thường; hết gia hạn vẫn chưa thu thì chuyển nợ tồn + tính chưa thu như cũ.
//    → Khối dòng tiền 5 thẻ KHÔNG đổi (số dư chạy dần, phí vẫn phát sinh đúng tháng).
//
// Cột đọc bằng truy vấn RIÊNG (docCtyDacThu), lỗi / chưa chạy sql/45 thì coi như không công ty nào đặc thù —
// thêm cột vào SELECT chung từng làm hỏng NGUYÊN truy vấn (ca dvk_only, project_cty_dvk_only).

export const HE_SO_VAT = 1.08

// ── Đọc ──────────────────────────────────────────────────────────────────────
const TRONG = () => ({ khongVat: new Set(), giaHan: new Map(), lyDo: new Map() })

export async function docCtyDacThu(supabase) {
  const kq = TRONG()
  try {
    const { data, error } = await supabase.from('clients')
      .select('id, khong_vat, gia_han_thu_thang, gia_han_thu_ly_do')
      .or('khong_vat.eq.true,gia_han_thu_thang.gt.0')
      .order('id').range(0, 4999)
    if (error) return kq
    for (const r of data || []) {
      if (r.khong_vat === true) kq.khongVat.add(r.id)
      const g = Number(r.gia_han_thu_thang) || 0
      if (g > 0) { kq.giaHan.set(r.id, g); if (r.gia_han_thu_ly_do) kq.lyDo.set(r.id, r.gia_han_thu_ly_do) }
    }
  } catch (_) { /* chưa chạy sql/45 */ }
  return kq
}

// Gắn 2 trường vào danh sách công ty đã đọc (để hàm thuần dùng c.khong_vat / c.gia_han_thu_thang)
export function ganDacThu(ds, dt) {
  for (const c of ds || []) {
    c.khong_vat = dt.khongVat.has(c.id)
    c.gia_han_thu_thang = dt.giaHan.get(c.id) || 0
  }
  return ds
}

// ── 1) Không VAT ─────────────────────────────────────────────────────────────
// Số trước thuế của một khoản tiền (phí / tiền thu) của công ty
export const truocThue = (soTien, khongVat) => Math.round((Number(soTien) || 0) / (khongVat ? 1 : HE_SO_VAT))

// ── 2) Gia hạn thu ───────────────────────────────────────────────────────────
// Mốc cuối kỳ M (tháng 1–12): 23:59:59 ngày `ngayKhoan` của tháng M+1+N. N = 0 là luật cũ (ngày 10 tháng sau).
export const hanCuoiKy = (nam, thang, giaHanThang = 0, ngayKhoan = 10) =>
  new Date(nam, thang + (Number(giaHanThang) || 0), ngayKhoan, 23, 59, 59, 999)

// Kỳ M của công ty còn trong thời gian gia hạn (chỉ đúng khi N > 0)
export function trongGiaHan(giaHanThang, nam, thang, now = new Date()) {
  const g = Number(giaHanThang) || 0
  return g > 0 && now <= hanCuoiKy(nam, thang, g)
}

// %-công nợ: kỳ (tháng cuối = thangCuoi) đang gia hạn mà chưa thu đủ → TẠM KHÔNG TÍNH (cả tử lẫn mẫu)
export function tamBoQuaCongNo(giaHanThang, nam, thangCuoi, phi, daThu, now = new Date()) {
  return trongGiaHan(giaHanThang, nam, thangCuoi, now) && (Number(daThu) || 0) < (Number(phi) || 0)
}

// Nhãn hiển thị: "Gia hạn thu 2 tháng — kỳ T9/2026 hạn 10/12/2026"
export function nhanGiaHan(giaHanThang, nam, thang) {
  const g = Number(giaHanThang) || 0
  if (!g) return ''
  const h = hanCuoiKy(nam, thang, g)
  return `Gia hạn thu ${g} tháng — kỳ T${thang}/${nam} hạn ${String(h.getDate()).padStart(2, '0')}/${String(h.getMonth() + 1).padStart(2, '0')}/${h.getFullYear()}`
}
