// Luật sinh lịch hạn nộp (tax_obligations) cho MỘT công ty — dùng chung cho:
//   - scripts/seed-tax-obligations.mjs  (sinh cả năm cho mọi công ty, chạy tay đầu năm)
//   - app/api/admin/tokhai/ky-khai       (đổi kỳ khai một loại tờ khai của một công ty)
//
// VÌ SAO GOM VỀ MỘT CHỖ (anh chốt hướng A ngày 19/10/2026): trước đây luật nằm gọn trong script
// năm. Nếu nút "Lưu kỳ khai" tự viết luật riêng thì năm sau chạy script, nó lại sinh TNCN theo
// THÁNG cho công ty đã đổi sang QUÝ — đúng cái lỗi vừa sửa xong quay về. Hai đường phải đọc cùng
// một luật.
//
// KỲ KHAI của một (công ty, loại tờ khai) tại một thời điểm:
//   1. Có dòng ghi đè trong tax_client_filings có hiệu lực (effective_from <= thời điểm) thì theo
//      dòng MỚI NHẤT trong số đó.
//   2. Không có thì theo clients.report_type của công ty — như từ trước tới nay.
//
// Ca thật dẫn tới việc này: VINA HSIN GON và CHARGEPOINT kê GTGT theo THÁNG nhưng kê TNCN theo
// QUÝ (cổng ghi 'Q3/2026'). App sinh nghĩa vụ TNCN theo tháng cho họ, nên tờ khai quý đã được
// chấp nhận vẫn bị báo "Chưa nộp" — hạn 20/10/2026.
//
// Hàm THUẦN, không gọi cơ sở dữ liệu: dễ kiểm (scripts/test-tokhai-lich.mjs).
import { cacKyTrongNam, kyQuyetToanNam, hanNop } from './taxDeadline.js'

// 'month' | 'quarter' (cách bảng tax_client_filings ghi) <-> 'monthly' | 'quarterly' (cách
// clients.report_type và cacKyTrongNam ghi). Hai bảng đặt tên khác nhau từ trước.
const sangKieu = (pk) => (pk === 'month' ? 'monthly' : 'quarterly')

// Kỳ khai (monthly | quarterly) của công ty cho một loại tờ khai, tại ngày `ngayISO`.
// ghiDe: các dòng tax_client_filings của ĐÚNG công ty + loại tờ khai này.
export function kyKhaiTai(client, ghiDe, ngayISO) {
  const hieuLuc = (ghiDe || [])
    .filter(g => g.effective_from && g.effective_from <= ngayISO && (g.period_kind === 'month' || g.period_kind === 'quarter'))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  if (hieuLuc.length) return sangKieu(hieuLuc[0].period_kind)
  return client.report_type === 'monthly' ? 'monthly' : 'quarterly'
}

// Các nghĩa vụ ĐỊNH KỲ của một (công ty, loại tờ khai) trong năm `nam`.
//
// Một kỳ được sinh khi kỳ khai CÓ HIỆU LỰC TẠI NGÀY ĐẦU KỲ đúng bằng loại của kỳ đó: tháng 8 chỉ
// sinh nếu ngày 01/08 công ty đang khai tháng; quý 3 chỉ sinh nếu ngày 01/07 công ty đang khai
// quý. Vì thế ngày đổi kỳ khai PHẢI là ngày đầu quý (nút Lưu chỉ cho chọn quý) — đổi giữa quý thì
// sẽ có tháng không thuộc kỳ nào.
//
// tuNgay: chỉ lấy kỳ BẮT ĐẦU từ ngày này trở đi (dùng khi sinh lại sau khi đổi kỳ khai).
export function nghiaVuDinhKy({ client, loai, nam, ngayLe = new Set(), ghiDe = [], tuNgay = null }) {
  const ra = []
  for (const kieu of ['monthly', 'quarterly']) {
    for (const k of cacKyTrongNam(kieu, nam)) {
      if (kyKhaiTai(client, ghiDe, k.period_start) !== kieu) continue
      if (tuNgay && k.period_start < tuNgay) continue
      // Công ty ký hợp đồng giữa năm: không sinh cho kỳ TRƯỚC khi ký — Savitax chưa hề nhận làm.
      if (client.contract_start && k.period_end < client.contract_start) continue
      ra.push({
        client_id: client.id, filing_type_id: loai.id,
        period_code: k.period_code, period_start: k.period_start, period_end: k.period_end,
        due_date: hanNop(k.period_kind, k.period_end, ngayLe),
        state: 'not_filed',
      })
    }
  }
  return ra.sort((a, b) => (a.period_start < b.period_start ? -1 : 1))
}

// Nghĩa vụ QUYẾT TOÁN năm của một (công ty, loại tờ khai) — không đổi theo kỳ khai.
export function nghiaVuQuyetToan({ client, loai, nam, ngayLe = new Set() }) {
  const k = kyQuyetToanNam(nam)
  if (client.contract_start && k.period_end < client.contract_start) return []
  return [{
    client_id: client.id, filing_type_id: loai.id,
    period_code: k.period_code, period_start: k.period_start, period_end: k.period_end,
    due_date: hanNop(k.period_kind, k.period_end, ngayLe),
    state: 'not_filed',
  }]
}

// 'Q3.2026' -> '2026-07-01'. Ngày đổi kỳ khai luôn là đầu một quý.
export function ngayDauQuy(maQuy) {
  const m = String(maQuy || '').match(/^Q([1-4])\.(\d{4})$/)
  if (!m) return null
  return m[2] + '-' + String((+m[1]) * 3 - 2).padStart(2, '0') + '-01'
}

// Quý BAO TRÙM một kỳ tháng: 'T09.2026' -> 'Q3.2026'. Không phải kỳ tháng thì null.
//
// Dùng khi XEM theo tháng (Lịch hạn nộp, Hồ sơ đã nộp): công ty kê LẪN tháng và quý — vd HSIN kê
// GTGT theo tháng, TNCN theo quý — thì tờ khai TNCN quý 3 nộp cùng ngày với GTGT tháng 9 cũng phải
// hiện khi xem tháng 9. Không thì nó biến mất khỏi màn hình (anh thấy ngày 19/10/2026: cột TNCN
// tháng 9 hiện "—", trang Hồ sơ đã nộp chỉ còn 1 trên 2 tờ khai).
export function quyBaoTrum(maKy) {
  const m = String(maKy || '').match(/^T(\d{2})\.(\d{4})$/)
  if (!m) return null
  return 'Q' + Math.ceil(+m[1] / 3) + '.' + m[2]
}
