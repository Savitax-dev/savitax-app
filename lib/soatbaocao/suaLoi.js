// 14 lỗi logic của bản offline Check BCTC V3 đã chứng minh ở GĐ 0 (kế hoạch mục 9.2) + 3 lỗi đọc file tìm thêm khi chạy thư mục
// thật (B15, B16 BCTC XML; B17 bảng cân đối tài khoản HTKK) — đều đã sửa trong lib/soatbaocao/boMay.js.
// Mỗi chỗ sửa có công tắc __SUA.Bx trong mã; taoBoMay({ suaLoi: false }) tắt hết để so mốc bản gốc.
// Bộ kiểm: node scripts/test-soatbaocao-mau.mjs — tắt hết khớp mốc 32/32; từng ca tái hiện: tắt ra kết quả sai, bật ra đúng;
// bật hết vẫn bắt đủ lỗi cài sẵn trong 8 bộ mẫu.
export const SUA_LOI = [
  { ma: 'B1', noi: 'Chỉ số CS05 ROE, CS06 ROA', loi: 'Thiếu số liệu (chưa có BCĐKT) bị nhân thành 0%', sua: 'Thiếu số liệu thì giữ "thiếu số liệu"' },
  { ma: 'B2', noi: 'Đối chiếu 05/KK-TNCN', loi: 'Đoán chỉ tiêu thuế bằng quan hệ cộng — kỳ thuế nhỏ lấy nhầm thu nhập làm thuế (3 báo động giả)', sua: 'Đọc đúng mã chỉ tiêu theo mẫu: TT80/2021 [21] thu nhập chịu thuế, [29] thuế đã khấu trừ; TT156/2013 [26], [32]' },
  { ma: 'B3', noi: 'Chứng từ sau ngày khóa sổ', loi: 'Một ngày khóa sổ cho cả hồ sơ nhiều năm: năm sau báo ~650 chứng từ giả, năm trước ghi lùi ngày không báo', sua: 'Ngày khóa sổ theo từng năm (meta.khoaSoNam); không có ngày của năm đó thì không kiểm' },
  { ma: 'B4', noi: 'Liên kết CĐPS năm trước', loi: 'Dung sai "≤ 1 tài khoản lệch" — lệch đúng 1 tài khoản (vd 1121 lệch 5 triệu) không báo', sua: 'So tổng số tiền lệch' },
  { ma: 'B5', noi: 'Giá vốn / doanh thu theo tháng', loi: 'Sai chỉ số mảng khi kỳ là quý — phép kiểm không bao giờ chạy', sua: 'Lấy đúng vị trí tháng trong kỳ' },
  { ma: 'B6', noi: 'BCTC nhập theo nghìn / triệu đồng', loi: 'Không quy đổi khi so với tờ khai, CĐPS, sổ — ~50 báo động giả', sua: 'Quy BCTC năm đang xem về đồng trước khi tính' },
  { ma: 'B7', noi: 'Có lợi nhuận mà không ghi chi phí thuế TNDN', loi: 'DN được miễn thuế 2026 (doanh thu năm trước ≤ 1 tỷ) vẫn bị báo', sua: 'Dùng cùng điều kiện miễn thuế như phần đối chiếu tờ khai' },
  { ma: 'B8', noi: 'Chi phí không được trừ: tiền phạt', loi: 'Từ khóa "phat" không có ranh giới từ — "phát sinh" bị coi là tiền phạt', sua: 'Chỉ bắt cụm phạt vi phạm / nộp phạt / xử phạt / tiền phạt / chậm nộp' },
  { ma: 'B9', noi: 'Diễn giải nhạy cảm', loi: 'So trên chuỗi đã bỏ dấu: "biểu mẫu" thành quà biếu, "giả định" thành gia đình', sua: 'Khi chỉ trùng nhờ bỏ dấu thì kiểm lại trên chữ còn dấu' },
  { ma: 'B10', noi: 'Tổng số dư sao kê ↔ TK 112', loi: 'Tài khoản ngân hàng không có giao dịch bị bỏ khỏi tổng — báo lệch đúng bằng số dư tài khoản đó', sua: 'Cộng cả tài khoản chỉ có số dư' },
  { ma: 'B11', noi: 'Hóa đơn từ ngưỡng chưa thanh toán qua ngân hàng', loi: 'Chỉ dò tên người bán trong nội dung sao kê — 12 hóa đơn đã chuyển khoản bị báo chưa thanh toán', sua: 'Hóa đơn ghi sổ cùng chứng từ chi qua TK 112 đã ghép được với sao kê là đã thanh toán' },
  { ma: 'B12', noi: 'Tính lại thuế TNCN từng tháng', loi: 'Mỗi dòng lương được giảm trừ trọn vẹn — tháng có thêm dòng thưởng tính sai, quyết toán cộng 13 tháng giảm trừ', sua: 'Gộp các dòng cùng người cùng tháng trước khi tính' },
  { ma: 'B13', noi: 'Hóa đơn từ ngưỡng chưa thanh toán qua ngân hàng', loi: 'Tự tắt khi TẤT CẢ hóa đơn đều chưa thanh toán — ca nặng nhất lại không báo', sua: 'Có hóa đơn chưa thanh toán là báo' },
  { ma: 'B15', noi: 'Đọc BCTC XML (HTKK)', loi: 'Một mã số mang nghĩa khác nhau theo chế độ (200 = TS dài hạn ở TT200, = TỔNG tài sản ở TT133) nhưng bộ đọc XML gán cả hai — BCTC TT200 thật ra tổng tài sản sai, báo lệch cân đối giả (soát LUCKY HOUSE 2024, 27/10/2026)', sua: 'Chọn chế độ như bộ đọc Excel (TT133 nếu có mã 500, hoặc 200 + 300 không có 270) rồi chỉ lấy nghĩa của chế độ đó' },
  { ma: 'B16', noi: 'Đọc BCTC XML (HTKK)', loi: 'KQKD nằm trong thẻ PL_KQHDSXKD nhưng bộ đọc chỉ nhận "kqkd" — cả báo cáo KQKD bị đọc như BCĐKT, mất doanh thu / lợi nhuận', sua: 'Nhận cả "kqhd"' },
  { ma: 'B17', noi: 'Đọc bảng cân đối tài khoản Excel', loi: 'Coi ô trống là 0 rồi lấy 6 số cuối dòng — bảng HTKK (cột tiền giãn cách bởi ô gộp, có cột thuyết minh) đọc sai hết: số cuối kỳ thành đầu kỳ, phát sinh thành 0', sua: 'Lấy đúng 6 cột tiền theo hàng tiêu đề Nợ / Có; không có hàng đó mới dùng cách cũ' },
  { ma: 'B18', noi: 'Nhận loại file Excel không có tiêu đề', loi: 'Mọi ô số ≥ 3 chữ số (tiền, MST) đều bị coi là mã tài khoản — sheet quyết toán TNCN trong file lương thành bảng cân đối phát sinh 408 "tài khoản" (DOEL 2026)', sua: 'Chỉ nhận là bảng cân đối phát sinh khi sheet có ít nhất 3 tên tài khoản chuẩn (tiền mặt, phải thu khách hàng, phải trả người bán…)' },
  { ma: 'B14', noi: 'Thuế GTGT đầu vào: sổ / bảng kê ↔ tờ khai', loi: 'Tờ khai thiếu [24] bị coi là 0, còn lấy [28] (thuế ĐẦU RA) thay — báo lệch đầu vào 1,4 tỷ giả', sua: 'Thiếu [24] ở kỳ nào thì không so (thiếu dữ liệu), không thay bằng chỉ tiêu khác' },
]
