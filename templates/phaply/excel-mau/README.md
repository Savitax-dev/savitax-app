# Mẫu Excel trống — Phân hệ Pháp lý

Tách từ hồ sơ khách thật trong thư mục mẫu của phòng (01/11/2026), dùng làm **nguồn dựng mẫu Word** và **bài kiểm đối chiếu**
(golden test). Không phải file nhân viên dùng trực tiếp. Phân hệ Pháp lý chưa lên app — chưa commit.

| File | Thủ tục | Loại hình | Sheet | Công thức | Trỏ lại | Để trống |
|---|---|---|---|---|---|---|
| GT_1TV.xlsx | Giải thể | TNHH 1TV | 31 | 267 | 12 | 0 |
| GT_2TV.xlsx | Giải thể | TNHH 2TV | 27 | 244 | 7 | 10 |
| GT_VPDD_2TV.xlsx | Chấm dứt VPĐD | TNHH 2TV | 15 | 127 | 11 | 0 |
| GT_VPDD_CP.xlsx | Chấm dứt VPĐD | Cổ phần | 13 | 107 | 0 | 109 |
| CAPLAI_GPKD_1TV.xlsx | Cấp lại GCN ĐKDN | TNHH 1TV | 3 | 25 | 1 | 0 |
| KP_MST_1TV.xlsx | Khôi phục MST | TNHH 1TV | 5 | 30 | 2 | 0 |

**Đã làm sạch**: giá trị khách + người được ủy quyền ở sheet `ThôngTin` (giữ nhãn cột A, tiêu đề bảng, chữ chung);
kết quả cũ của mọi công thức; chữ khách gõ thẳng ở sheet khác (kể cả chữ bị cắt giữa các đoạn định dạng); số CCCD/MST/
điện thoại/email; tác giả comment (→ "Savitax", "Savitax 2"…); người tạo/sửa file; đường dẫn thư mục Drive cũ
(`x15ac:absPath`); liên kết file ngoài + calcChain. Excel tự tính lại khi mở (`fullCalcOnLoad`).

**Đã kiểm**: mở bằng Excel thật không báo Repair; điền dữ liệu giả `§B<n>` vào `ThôngTin` → 0 ô lỗi, 16/16 công thức trỏ
lại lấy đúng ô.

**Cần pháp lý xem**
- GT_2TV — Biên bản họp: thành viên 5–6 trỏ sang file khác nên để trống (bảng thành viên ở `ThôngTin` chỉ 4 dòng).
- GT_VPDD_2TV — QĐ HĐTV Điều 7 ("Ông/bà … là Chủ tịch HĐTV") trỏ về Người đại diện PL vì `ThôngTin` không có ô Chủ tịch.
- GT_VPDD_CP — sheet BBH chép từ biên bản đổi tên / đổi người đại diện của khách khác, 109 công thức hỏng → để trống,
  cần soạn lại BBH chấm dứt VPĐD.

Làm lại / làm thêm mẫu: `scripts/phaply-lam-sach-mau.cjs` (đọc phần đầu file), kiểm bằng `scripts/phaply-thu-mau-excel.ps1`.
