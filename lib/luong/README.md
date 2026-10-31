# Phân hệ Tiền lương — cấu trúc mã theo 3 bước

Anh yêu cầu 18/10/2026: tách mã theo từng bước để dễ sửa, dễ phát triển. Mỗi bước có SQL, thư viện,
route API và giao diện riêng; bước sau chỉ ĐỌC kết quả của bước trước, không sửa ngược.

| Bước | Việc | SQL | Thư viện (`lib/luong/`) | API (`app/api/admin/luong/`) | Giao diện (`components/luong/`) |
|---|---|---|---|---|---|
| 1 | Cấp bậc, lương từng nhân viên, ngày lễ, chấm công, nhập file máy chấm công, file hồ sơ lương | `sql/31_tien_luong.sql`, `sql/38_…` | `ngayCong.js`, `mayChamCong.js`, `fileHoSoLuong.js` | `route.js` | `ChamCongCuaToi`, `ChamCongPhong`, `NhapChamCong`, `CapBacNgayLe`, `HoSoLuongExcel`, `OLuongNhanVien` (ô ở trang Quản lý nhân viên) |
| 2 | Thưởng KPI, thưởng doanh số, thưởng dịch vụ khác, bảng lương | `sql/32_luong_thuong_dvk.sql` | `thuong.js`, `bangLuong.js` | `thuong/route.js` | `ThuongDvk`, `BangLuong` |
| 3 | Khoản trừ, thuế TNCN, phụ cấp / điều chỉnh, chốt bảng lương, xuất Excel | `sql/33_luong_chot.sql`, `sql/34_…`, `sql/35_luong_thue_ngan_hang.sql` | `khauTru.js`, `thueTncn.js`, `chot.js`, `excel.js` | `chot/route.js` | `ThanhChotLuong` |
| 4 | Gửi phiếu lương, nhân viên xác nhận / báo sai | `sql/34_luong_tac_phong_phieu.sql` | — | `phieu/route.js` | `PhieuLuongCuaToi` |
| 5 | File chuyển khoản chi lương hàng loạt (mẫu ngân hàng) | `sql/36_luong_ma_ngan_hang.sql` | `fileChuyenKhoan.js` | (đọc `?viec=luong_nv`) | nút 🏦 ở `ThanhChotLuong` |

Dùng chung: `lib/luong/api.js` (quyền, đọc ngày lễ, kiểm tham số — chỉ máy chủ), `components/luong/chung.js`
(gọi API, màu, hộp thông báo — trình duyệt). Trang `app/luong/page.js` chỉ còn khung + thanh tab.

## Quy tắc đã chốt (đổi gì thì sửa đúng file của bước đó)
- **Phòng remote** (`rooms.type = 'remote'`: Danxia, Dakshin, CTV Savitax) KHÔNG tính lương trên app: không chấm công,
  không bảng lương, không KPI phòng (anh chốt 23/10/2026).
- **Nhập file máy chấm công** (`mayChamCong.js`, sql/38). Từ T10/2026 (anh gửi 31/10) đọc sheet **"Bảng chấm công chi
  tiết_XuLy"** do HCNS xử lý (`mau = 'xuly'`, nhận ra nhờ cột "Tổng"): đi làm = **Tổng − Nghỉ phép** (Tổng = HC + Onl, đã gồm
  thứ Bảy VÀ ngày phép — T10: Tổng + không lương = 27 = công chuẩn, 35/36 người); phép = cột Nghỉ phép (ĐÃ gồm phép đột xuất
  BGĐ duyệt, không cộng lại); không lương = KL + thai sản; vi phạm = **Tổng vi phạm** (đi muộn, về sớm + không chấm công);
  KHÔNG cộng thứ Bảy. Tiền gây quỹ 20.000 đ/lần và sheet Phép KHÔNG đưa vào app (HCNS tự theo dõi / app chấm công lo).
  ⚠ File có sheet ẨN "_30.10" đứng đầu — trước 31/10 app lấy sheet đầu nên đọc nhầm; nay `docFileMayChamCong` ưu tiên sheet
  tên "XuLy"/"Xử lý", không bao giờ lấy sheet ẩn. File thô cũ (`mau = 'tho'`): đi làm = HC + công tác + số thứ Bảy làm việc
  (máy không chấm thứ Bảy online); phép = phép + đột xuất BGĐ duyệt; không lương = KL + thai sản; vi phạm tác phong = lần
  đi muộn + về sớm; nghỉ lễ bỏ qua. Ghép theo `staff.ma_nhan_vien`, chưa có mã thì theo họ tên (mã trên file SẼ ĐỔI — đừng tin mã cũ).
  Ghi vào bảng công ở trạng thái nháp, `nguon = may_cham_cong`: nhân viên KHÔNG sửa số, chỉ Xác nhận / Báo sai; TP sửa
  có lý do. Người `cham_cong_may = false` (online, ban giám đốc) tự khai như cũ, nhập file bỏ qua. Số máy có lẻ
  (15,38) — giữ nguyên tới 2 chữ số thập phân. File phải xuất SAU ngày cuối tháng (tiêu đề luôn ghi cả tháng).
- **File hồ sơ lương** (`fileHoSoLuong.js`): tải mẫu điền sẵn danh sách (trừ remote), nhận người theo EMAIL; ô lương
  trống mà có cấp bậc thì lấy lương theo cấp; ô ngày gõ thành ngày Excel đọc ra số sê-ri — máy chủ tự đổi.
- **Ngày công chuẩn** = số ngày của tháng − chủ nhật − ngày lễ; thứ Bảy đủ công (`ngayCong.js`).
- **Bảng lương tháng N** lấy %-công việc **N**, %-công nợ **N−1** (đúng hàm Báo cáo KPI: `lib/kpiTongQuan.js`),
  doanh thu **N** = phí kế toán phải thu của công ty phụ trách chính, chia 1,08 (tách VAT), quý chia 3.
  (Anh đổi 19/10/2026; trước đó là việc N−1 / nợ N−2 / doanh thu N−1.)
- **Thưởng KPI** công việc / công nợ / phòng: dưới 80% → 0; 80–90% → 300.000; trên 90% → 500.000.
- **Thưởng vượt doanh số**: nhân viên (DT − tối thiểu theo cấp) × 20%; trưởng phòng 20% DT công ty tự làm.
- **Thưởng dịch vụ khác**: nhân viên tự khai (số tiền × tỉ lệ), trưởng phòng duyệt; dịch vụ ngoài app bắt buộc ghi chú.
- **Khoản trừ** (chỉ người tham gia BHXH): BHXH 10,5% + KPCĐ 0,5% × lương đóng BHXH + Đoàn phí 40.000.
- **Công ty đóng** (`congTyDong`, 23/10/2026, KHÔNG trừ lương): BHXH 17,5% + BHYT 3% + BHTN 1% (cùng 10,5% NLĐ = 32% nộp
  cơ quan BHXH) + KPCĐ 2%, trên lương đóng BHXH. Excel: nhóm cột "CÔNG TY ĐÓNG" + sheet "Tong hop BHXH"; tỉ lệ ở Tham so B14:B17.
- **Thuế TNCN** (`thueTncn.js`, anh chốt 20/10/2026 — trước đó không tính): người tham gia BHXH → thu nhập
  tính thuế = tổng thu nhập (lương theo công + mọi thưởng + phụ cấp + điều chỉnh) − 15,5tr − 6,2tr × người phụ
  thuộc − BHXH 10,5% → biểu lũy tiến 5 bậc; người KHÔNG tham gia BHXH (thử việc, học việc) → 10% tổng thu nhập, CỐ Ý không áp mốc 2 triệu của luật (anh
  chốt: khấu trừ mọi khoản cho chắc). Lương từng người do công ty nhập tay theo năng lực, không tự gán.
  Thực lĩnh = thu nhập − BHXH − KPCĐ − Đoàn phí − thuế. Số người phụ thuộc đi theo lịch sử lương
  (`luong_nhan_vien.so_nguoi_phu_thuoc`); tài khoản nhận lương một dòng mỗi người (`luong_ngan_hang`).
- **Tác phong** (19/10/2026): nhân viên tự khai số lần vi phạm cùng ngày công; % của người = 100 − 20 × số lần
  (sàn 0); % tác phong phòng = trung bình cả phòng. **Điểm KPI phòng** = TB(%-việc, %-nợ, %-tác phong) →
  thưởng phòng 0 / 300k / 500k, MỖI người trong phòng nhận đủ. App tự tính, Excel cũng tự tính lại.
- **Phụ cấp / điều chỉnh ngoại lệ**: kế toán nội bộ nhập trên tab Bảng lương (`luong_dieu_chinh`) TRƯỚC khi chốt.
- **Phiếu lương**: chốt → "Gửi nhân viên xác nhận" → mỗi người chỉ thấy phiếu mình (tab Phiếu lương của tôi),
  Xác nhận / Báo sai (ghi chú). Mở chốt = thu hồi phiếu. Gửi lại: ai đã xác nhận mà thực lĩnh không đổi thì giữ.

- **File chuyển khoản** (20/10/2026): đúng 12 cột mẫu ngân hàng anh gửi, tiêu đề ở dòng 1, KHÔNG thêm dòng
  tiêu đề / dòng tổng (ngân hàng từ chối file lạ). Chỉ xuất khi đã chốt; số tiền = thực lĩnh bản chốt; tên chủ TK
  HOA không dấu; mã ngân hàng là mã SỐ theo danh mục ngân hàng chi lương (`luong_ngan_hang.ma_ngan_hang`).
  Thiếu số TK / mã NH hoặc thực lĩnh ≤ 0 thì không vào file, app liệt kê để chuyển tay.

- **Hoa hồng giới thiệu** (sql/39, `hoaHong.js`, 3 bước xong 23/10/2026): `clients.gioi_thieu_boi` + `gioi_thieu_tu`
  ghi ở cột "Giới thiệu" trang Quản lý khách hàng (chỉ manage_payroll, có nhật ký); bậc % ở `luong_hoa_hong_bac`
  (tab Cấp bậc & ngày lễ). Quy tắc tính (bước 2): % theo số công ty ĐANG dùng DV × tiền khách trả THÊM từ lần chốt
  trước (KT + HCNS + DVK + nợ tồn, ÷ 1,08), sổ `luong_hoa_hong_so` ghi khi chốt (mở chốt xoá); đã chi = nút
  "Đã chuyển lương". Không còn công ty đang dùng → bậc thấp nhất. Người giới thiệu không có dòng lương (remote…)
  → `hoaHongNgoai`, chi tay, không ghi sổ. Báo cáo: tab "Hoa hồng giới thiệu" ở Báo cáo KPI (`BaoCaoHoaHong.js`).
- **Báo cáo thâm niên** (`thamNien.js` + `components/BaoCaoThamNien.js`, tab ở trang Báo cáo KPI, chỉ view_payroll):
  thâm niên = số tháng tròn từ `staff.ngay_vao_lam`; cấp theo thâm niên đọc mốc "dưới X tháng/năm" trong MÔ TẢ cấp bậc
  (sửa mô tả là báo cáo đổi theo); cấp trưởng phòng không xét. Đánh dấu đến hạn lên cấp, sắp đủ mốc 1–6 tháng.

## Bộ kiểm
`node scripts/test-luong-ngay-cong.mjs` · `node scripts/test-luong-may-cham-cong.mjs [file.xlsx]` · `node scripts/test-luong-tham-nien.mjs` · `node scripts/test-luong-hoa-hong.mjs` · `node --env-file=.env.local scripts/test-luong-thuong.mjs --that`
