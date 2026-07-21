import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Checklist mẫu — "Checklist công việc công ty báo cáo tháng.docx"
const MONTHLY_TASKS = [
  // ── THÁNG 1 ──
  { month: 1, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 12' },
  { month: 1, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 1' },
  { month: 1, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 12 tháng 1' },
  { month: 1, deadline_day: 15, name: 'Gửi khách hàng báo cáo tài chính tạm tính của năm trước để xác định nộp 80% thuế TNDN' },
  { month: 1, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 1, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 12' },
  { month: 1, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT + TNCN + Tạm nộp 80% Thuế TNDN năm)' },
  { month: 1, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 1' },
  { month: 1, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 1 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 1, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 12' },
  { month: 1, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 12 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + Bán ra) (PDF+XML)' },
  // ── THÁNG 2 ──
  { month: 2, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 1' },
  { month: 2, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 2' },
  { month: 2, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 1 tháng 2' },
  { month: 2, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 1 xác nhận với khách hàng' },
  { month: 2, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 2, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 1' },
  { month: 2, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 2, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 2' },
  { month: 2, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 2 (Kèm bảng kê mua vào + bán ra)' },
  { month: 2, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 1' },
  { month: 2, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 1' },
  { month: 2, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 1 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + Bán ra) (PDF+XML)' },
  // ── THÁNG 3 ──
  { month: 3, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 2' },
  { month: 3, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 3' },
  { month: 3, deadline_day: 10, name: 'Gửi BCTC năm hoàn thành cho khách hàng' },
  { month: 3, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 2 tháng 3' },
  { month: 3, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 2 xác nhận với khách hàng' },
  { month: 3, deadline_day: 15, name: 'Ngày 15: Truy vấn nợ thuế đến hiện tại' },
  { month: 3, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 2' },
  { month: 3, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 3, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 3' },
  { month: 3, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 3 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 3, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 2' },
  { month: 3, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 2' },
  { month: 3, deadline_day: 25, name: 'Nộp báo cáo tài chính năm hoàn thành' },
  { month: 3, deadline_day: 25, name: 'Nộp các khoản thuế phải nộp năm (TNCN+TNDN)' },
  { month: 3, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 2 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + Bán ra) (PDF+XML)' },
  { month: 3, deadline_day: 30, name: 'Gửi mail bộ báo cáo tài chính năm (Tờ khai + Thông báo chấp nhận) (PDF+XML)' },
  // ── THÁNG 4 ──
  { month: 4, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 3' },
  { month: 4, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 4' },
  { month: 4, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 3 tháng 4' },
  { month: 4, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 3 xác nhận với khách hàng' },
  { month: 4, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 4, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 3' },
  { month: 4, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT + TNCN)' },
  { month: 4, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 4' },
  { month: 4, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 4 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 4, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 3' },
  { month: 4, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 3' },
  { month: 4, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 3 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 5 ──
  { month: 5, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 4' },
  { month: 5, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 5' },
  { month: 5, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 4 tháng 5' },
  { month: 5, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 4 xác nhận với khách hàng' },
  { month: 5, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 5, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 4' },
  { month: 5, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 5, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 5' },
  { month: 5, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 5 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 5, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 4' },
  { month: 5, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 4' },
  { month: 5, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 4 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 6 ──
  { month: 6, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 5' },
  { month: 6, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 6' },
  { month: 6, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 5 tháng 6' },
  { month: 6, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 5 xác nhận với khách hàng' },
  { month: 6, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 6, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 5' },
  { month: 6, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 6, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 6' },
  { month: 6, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 6 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 6, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 5' },
  { month: 6, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 5' },
  { month: 6, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 5 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 7 ──
  { month: 7, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 6' },
  { month: 7, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 7' },
  { month: 7, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 6 tháng 7' },
  { month: 7, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 6 xác nhận với khách hàng' },
  { month: 7, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 7, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 6' },
  { month: 7, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 7, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 7' },
  { month: 7, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 7 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 7, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 6' },
  { month: 7, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 6' },
  { month: 7, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 6 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 8 ──
  { month: 8, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 7' },
  { month: 8, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 8' },
  { month: 8, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 7 tháng 8' },
  { month: 8, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 7 xác nhận với khách hàng' },
  { month: 8, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 8, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 7' },
  { month: 8, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 8, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 8' },
  { month: 8, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 8 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 8, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 7' },
  { month: 8, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 7' },
  { month: 8, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 7 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 9 ──
  { month: 9, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 8' },
  { month: 9, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 9' },
  { month: 9, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 8 tháng 9' },
  { month: 9, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 8 xác nhận với khách hàng' },
  { month: 9, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 9, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 8' },
  { month: 9, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 9, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 9' },
  { month: 9, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 9 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 9, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 8' },
  { month: 9, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 8' },
  { month: 9, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 8 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 10 ──
  { month: 10, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 9' },
  { month: 10, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 10' },
  { month: 10, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 9 tháng 10' },
  { month: 10, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 9 xác nhận với khách hàng' },
  { month: 10, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 10, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 9' },
  { month: 10, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 10, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 10' },
  { month: 10, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 10 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 10, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 9' },
  { month: 10, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 9' },
  { month: 10, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 9 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 11 ──
  { month: 11, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 10' },
  { month: 11, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 11' },
  { month: 11, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 10 tháng 11' },
  { month: 11, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 11 xác nhận với khách hàng' },
  { month: 11, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 11, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 10' },
  { month: 11, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 11, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 11' },
  { month: 11, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 10 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 11, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 10' },
  { month: 11, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 10' },
  { month: 11, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 10 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  // ── THÁNG 12 ──
  { month: 12, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 11' },
  { month: 12, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 12' },
  { month: 12, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 11 tháng 12' },
  { month: 12, deadline_day: 15, name: 'Gửi báo cáo thuế tháng 12 xác nhận với khách hàng' },
  { month: 12, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 12, deadline_day: 15, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 11' },
  { month: 12, deadline_day: 20, name: 'Nộp báo cáo thuế tháng 11' },
  { month: 12, deadline_day: 20, name: 'Nộp các khoản thuế phải nộp (GTGT)' },
  { month: 12, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 12' },
  { month: 12, deadline_day: 25, name: 'Gửi BCT tạm tính tháng 12 (Kèm Bảng kê mua vào + Bán ra)' },
  { month: 12, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến tháng 12' },
  { month: 12, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 11' },
  { month: 12, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế tháng 11 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
]

// Checklist mẫu — "Checklist công việc công ty báo cáo quý.docx"
const QUARTERLY_TASKS = [
  // ── THÁNG 1 ──
  { month: 1, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 12' },
  { month: 1, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 1' },
  { month: 1, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 12 tháng 1' },
  { month: 1, deadline_day: 15, name: 'Gửi khách hàng báo cáo tài chính tạm tính của năm trước để xác định nộp 80% thuế TNDN' },
  { month: 1, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 1, deadline_day: 20, name: 'Gửi báo cáo thuế quý 4 cho khách hàng (Kèm bảng kê mua vào+bán ra)' },
  { month: 1, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 1' },
  { month: 1, deadline_day: 25, name: 'Nộp hoàn thành báo cáo thuế quý 4' },
  { month: 1, deadline_day: 25, name: 'Nộp các khoản thuế phải nộp (GTGT + TNCN + Tạm nộp 80% Thuế TNDN năm)' },
  { month: 1, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính tháng 1 (Kèm bảng kê mua vào + bán ra)' },
  { month: 1, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 12' },
  { month: 1, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế Quý 4 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  // ── THÁNG 2 ──
  { month: 2, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 1' },
  { month: 2, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 2' },
  { month: 2, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 1 tháng 2' },
  { month: 2, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 2, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 2' },
  { month: 2, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Qúy 1 (Kèm bảng kê mua vào + bán ra)' },
  { month: 2, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 1' },
  { month: 2, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 1' },
  // ── THÁNG 3 ──
  { month: 3, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 2' },
  { month: 3, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 3' },
  { month: 3, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 2 tháng 3' },
  { month: 3, deadline_day: 10, name: 'Gửi BCTC năm hoàn thành cho khách hàng' },
  { month: 3, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 3, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 3' },
  { month: 3, deadline_day: 25, name: 'Gửi BCT tạm tính Qúy 1 (Kèm Bảng kê mua vào + bán ra)' },
  { month: 3, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 2' },
  { month: 3, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 2' },
  { month: 3, deadline_day: 25, name: 'Nộp báo cáo tài chính năm hoàn thành' },
  { month: 3, deadline_day: 25, name: 'Nộp các khoản thuế phải nộp (TNCN+ TNDN)' },
  { month: 3, deadline_day: 30, name: 'Gửi mail bộ báo cáo tài chính năm (Tờ khai + Thông báo chấp nhận) (FILE XML+PDF)' },
  // ── THÁNG 4 ──
  { month: 4, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 3' },
  { month: 4, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 4' },
  { month: 4, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 3 tháng 4' },
  { month: 4, deadline_day: 10, name: 'Gửi BCTC năm hoàn thành cho khách hàng' },
  { month: 4, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 4, deadline_day: 20, name: 'Gửi báo cáo thuế Qúy 1 xác nhận với khách hàng' },
  { month: 4, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 4' },
  { month: 4, deadline_day: 25, name: 'Nộp Báo cáo thuế Quý 1' },
  { month: 4, deadline_day: 25, name: 'Nộp tiền thuế (GTGT + TNCN)' },
  { month: 4, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Qúy 2 (Kèm bảng kê mua vào + bán ra)' },
  { month: 4, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 3' },
  { month: 4, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 3' },
  { month: 4, deadline_day: 30, name: 'Gửi mail bộ báo cáo tài chính năm (Tờ khai + Thông báo chấp nhận) (FILE XML+PDF)' },
  // ── THÁNG 5 ──
  { month: 5, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 4' },
  { month: 5, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 5' },
  { month: 5, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 4 tháng 5' },
  { month: 5, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 5, deadline_day: 15, name: 'Gửi mail sổ sách kế toán cho khách hàng tháng 5' },
  { month: 5, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 5' },
  { month: 5, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Qúy 2 (Kèm bảng kê mua vào + bán ra)' },
  { month: 5, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 4' },
  { month: 5, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 4' },
  // ── THÁNG 6 ──
  { month: 6, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 5' },
  { month: 6, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 6' },
  { month: 6, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 5 tháng 6' },
  { month: 6, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 6, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 6' },
  { month: 6, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 2 (Kèm bảng kê mua vào + bán ra)' },
  { month: 6, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 5' },
  { month: 6, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 5' },
  // ── THÁNG 7 ──
  { month: 7, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 6' },
  { month: 7, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 7' },
  { month: 7, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 6 tháng 7' },
  { month: 7, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 7, deadline_day: 20, name: 'Gửi báo cáo thuế Quý 2 xác nhận với khách hàng (Kèm bảng kê mua vào + bảng kê)' },
  { month: 7, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 4' },
  { month: 7, deadline_day: 25, name: 'Nộp Báo cáo thuế Quý 2' },
  { month: 7, deadline_day: 25, name: 'Nộp tiền thuế (GTGT + TNCN)' },
  { month: 7, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 3 (Kèm bảng kê mua vào + bán ra)' },
  { month: 7, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 6' },
  { month: 7, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 6' },
  { month: 7, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế Quý (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  // ── THÁNG 8 ──
  { month: 8, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 7' },
  { month: 8, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 8' },
  { month: 8, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 7 tháng 8' },
  { month: 8, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 8, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 8' },
  { month: 8, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 3 (Kèm bảng kê mua vào + bán ra)' },
  { month: 8, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 7' },
  { month: 8, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 7' },
  // ── THÁNG 9 ──
  { month: 9, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 8' },
  { month: 9, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 9' },
  { month: 9, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 8 tháng 9' },
  { month: 9, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 9, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 9' },
  { month: 9, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 3 (Kèm bảng kê mua vào + bán ra)' },
  { month: 9, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 8' },
  { month: 9, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 8' },
  // ── THÁNG 10 ──
  { month: 10, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 9' },
  { month: 10, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 10' },
  { month: 10, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 9 tháng 10' },
  { month: 10, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 10, deadline_day: 20, name: 'Gửi báo cáo thuế Quý 3 xác nhận với khách hàng (Kèm bảng kê mua vào + bảng kê)' },
  { month: 10, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 10' },
  { month: 10, deadline_day: 25, name: 'Nộp Báo cáo thuế Quý 3' },
  { month: 10, deadline_day: 25, name: 'Nộp tiền thuế (GTGT + TNCN)' },
  { month: 10, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 4 (Kèm bảng kê mua vào + bán ra)' },
  { month: 10, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 9' },
  { month: 10, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 9' },
  { month: 10, deadline_day: 30, name: 'Gửi mail bộ báo cáo thuế Quý 3 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  // ── THÁNG 11 ──
  { month: 11, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 10' },
  { month: 11, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 11' },
  { month: 11, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 10 tháng 11' },
  { month: 11, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 11, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 11' },
  { month: 11, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 4 (Kèm bảng kê mua vào + bán ra)' },
  { month: 11, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 10' },
  { month: 11, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 10' },
  // ── THÁNG 12 ──
  { month: 12, deadline_day: 5, name: 'Gửi thông báo cung cấp chứng từ tháng 11' },
  { month: 12, deadline_day: 10, name: 'Cập nhật file đề nghị xuất hóa đơn cho khách hàng tháng 12' },
  { month: 12, deadline_day: 10, name: 'Đối chiếu công nợ khách hàng với kế toán nội bộ tháng 11 tháng 12' },
  { month: 12, deadline_day: 15, name: 'Truy vấn nợ thuế đến hiện tại' },
  { month: 12, deadline_day: 15, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 11' },
  { month: 12, deadline_day: 20, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 12' },
  { month: 12, deadline_day: 25, name: 'Gửi Báo cáo thuế tạm tính Quý 4 (Kèm bảng kê mua vào + bán ra)' },
  { month: 12, deadline_day: 25, name: 'Báo cáo kết quả hoạt động kinh doanh từ đầu năm đến Tháng 12' },
  { month: 12, deadline_day: 25, name: 'Đối chiếu kho + Đối chiếu công nợ từ đầu năm đến tháng 11' },
]

export async function POST(request) {
  const auth = await callerHasPermission('manage_checklist_template')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const { replace = false, reportType = 'monthly' } = body

  const supabase = getAdmin()
  const SRC = reportType === 'quarterly' ? QUARTERLY_TASKS : MONTHLY_TASKS

  // Optionally clear existing tasks of this report_type first.
  // Old task_definitions may still be referenced by task_records (staff history),
  // so soft-delete (is_active: false) instead of a hard delete to avoid FK violations.
  if (replace) {
    const { error: deactivateError } = await supabase.from('task_definitions')
      .update({ is_active: false })
      .eq('report_type', reportType)
      .not('month', 'is', null)
    if (deactivateError) return Response.json({ error: deactivateError.message }, { status: 400 })
  }

  // Build insert payload
  const inserts = SRC.map((t, i) => ({
    name:         t.name,
    deadline_day: t.deadline_day,
    month:        t.month,
    report_type:  reportType,
    applies_to:   'monthly',
    is_active:    true,
    sort_order:   t.month * 100 + t.deadline_day * 10 + i,
  }))

  const { data, error } = await supabase
    .from('task_definitions')
    .insert(inserts)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true, inserted: data ? data.length : 0 })
}
