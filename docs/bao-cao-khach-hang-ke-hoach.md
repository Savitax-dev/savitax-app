# Báo cáo khách hàng trên app — kế hoạch (anh duyệt 28/11/2026)

Đưa các sheet báo cáo khách hàng của **SVT.MB07 Nhật ký công việc – khách hàng** lên app: nhân viên nhập / app tự lấy
số, app dựng ảnh + lời nhắn gửi khách, lưu theo đúng công ty. Nhân viên vẫn **tự tick** việc trên Checklist.

## Đợt 1 — Sheet "5. BC Tháng_Quý" (ĐÃ LÀM, chờ anh chạy sql/64 + thử)

- Tab **📊 Báo cáo KH** trên thẻ công ty (Checklist, Phòng, Quản lý công nợ — mọi chỗ dùng `ClientChecklist`); nút
  **📊 Lập BC** cạnh việc "Gửi BCT tạm tính… / Gửi báo cáo thuế…" mở đúng kỳ suy từ tên việc.
- Kỳ tháng / quý / năm (mã `T11.2026`, `Q4.2026`, `NAM.2025`). 12 dòng như Excel (+ dòng 13, 14 TNDN ở báo cáo năm).
- App tự tính: dòng 1 = 1.1 + 1.2 + 1.3; dòng 8 = 8.1 + 8.2 + 8.3; dòng 7 = bán ra − mua vào − đầu kỳ, ghi bằng chữ
  "phải nộp" / "còn được khấu trừ" (bỏ dấu âm); hạn nộp lấy từ lịch Tờ khai (`tax_obligations`), không có thì tính theo
  luật + ngày nghỉ; thuế đầu kỳ gợi ý từ phần còn khấu trừ của báo cáo kỳ trước.
- Ảnh 1080px (bố cục bảng Excel, Times New Roman) + lời nhắn Zalo (văn mẫu chị Mỹ Lệ, sửa được, nhớ trên máy).
- **📷 Chép ảnh / ⬇ Tải ảnh** tự lưu luôn (số liệu không đổi thì không lưu ảnh trùng); "Lưu nháp" chỉ lưu số. Số liệu vào bảng `bao_cao_khach` (một dòng mỗi công ty – kỳ), ảnh vào tab Tài liệu tên
  `BCKD_<kỳ>_<MÃ KH>_<YYYYMMDD-HHmm>.png` — xem lại theo ngày.
- Mã: `lib/baoCaoKh.js` (hàm thuần), `components/BaoCaoKhachHang.js`, `components/AnhBaoCaoKH.js`,
  `app/api/admin/bao-cao-kh`, `sql/64_bao_cao_khach.sql`. Kiểm: `node scripts/test-bao-cao-kh.mjs`.

## Đợt 2 — Tự điền số từ thư mục công ty

Phân hệ Soát xét đã đọc được bảng kê cổng HĐĐT (mục 2) và tờ khai XML (mục 7) của từng kỳ. Thêm nút **"Lấy số từ thư
mục"** trong tab Báo cáo KH: điền sẵn dòng 1.1 (số HĐ mua vào), 2 (số HĐ bán ra), 3 (doanh số), 5 – 6 (thuế GTGT mua vào,
bán ra) từ bảng kê kỳ đó, dòng 4 từ chỉ tiêu [22] tờ khai 01/GTGT; dòng 8.3 từ C12 BHXH; dòng 9 từ 05/KK-TNCN.
Nhân viên vẫn soát lại trước khi lưu. Chỉ đọc thư mục (bất biến của Soát xét), chạy trên máy nhân viên.

## Đợt 3 — Sheet "6. So sánh_Phân tích" (báo cáo tốc độ tăng trưởng)

Sheet này so các kỳ: phí kế toán, phí HCNS, số HĐ mua vào / bán ra, doanh số, số lao động, và **tốc độ tăng trưởng** kỳ
này / các kỳ trước. Toàn bộ số đã có trên app sau đợt 1: báo cáo các kỳ đã lưu (`bao_cao_khach`) + lịch sử phí (công nợ).
- Trong tab Báo cáo KH thêm chế độ **"So sánh các kỳ"**: chọn tối đa 5 kỳ (VD Q1 – Q4/2025 + Q1/2026), bảng + biểu đồ
  cột, tỷ lệ tăng trưởng tự tính; xuất ảnh / Excel (exceljs) và lưu vào Tài liệu như đợt 1.
- Lưu ý: phân hệ Soát xét đã có tab "Tăng trưởng & phí" (đọc thẳng từ thư mục, có phí) — dùng chung cách tính để hai nơi
  ra cùng số; phí chỉ hiện cho người có quyền `xem_phi_de_xuat` như bên đó.

## Đợt 4 — Sheet "7. BC Thực trạng" (báo cáo kết quả kinh doanh năm)

Bảng 17 chỉ tiêu KQKD (doanh thu, giá vốn, lợi nhuận gộp, chi phí, lợi nhuận trước / sau thuế) năm nay so với BCTC 2 năm
trước, có tỷ trọng / doanh thu và tăng trưởng; cột "thực trạng sau khi thay đổi" để tư vấn khách.
- Số năm trước lấy từ BCTC đã nộp (XML B02 trong `7. BỘ BÁO CÁO\2. BỘ BCTC NĂM` — Soát xét năm đã đọc được), năm nay nhân
  viên nhập hoặc lấy từ sổ sách; tỷ trọng, chênh lệch, tăng trưởng app tự tính.
- Dùng cho buổi họp báo cáo định kỳ quý / năm (SVT.QT.04 mục 3.5): xuất ảnh / PDF + lưu Tài liệu.

## Việc cần anh làm

1. Chạy `sql/64_bao_cao_khach.sql` trong Supabase SQL Editor.
2. Thử trên máy (localhost) rồi báo em đẩy lên app.
3. Sau khi chạy ổn: cập nhật SVT.QT.04 mục 3.5 + SVT.QT.05 (ngày 25) sang "lập báo cáo trên tab 📊 Báo cáo KH" thay sheet 5.
