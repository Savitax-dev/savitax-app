# Kế hoạch dựng bản demo `demo.savitax.vn`

Bản demo để gửi khách xem trước khi triển khai: đủ phân hệ, đầy đủ số liệu, **toàn bộ dữ liệu là giả**.
Anh chốt 01/11/2026: code **cố định một bản** (chỉ cập nhật khi anh bảo) · khách **được sửa**, dữ liệu **tự làm mới
mỗi đêm** · đăng nhập bằng **tài khoản + mật khẩu** anh gửi khách.

## 1. Nguyên tắc an toàn (không thương lượng)

- **Database riêng hoàn toàn** (Supabase project mới). Không một dòng dữ liệu thật nào được chép sang — kể cả tên công ty,
  MST, tên nhân viên, email. Dữ liệu demo do script SINH RA, không lấy từ production.
- **Lệnh làm mới dữ liệu tự chặn chính nó** nếu chạy nhầm vào production: chỉ chạy khi `DEMO_MODE=1` **và** địa chỉ
  Supabase KHÔNG phải project thật (`ykorxlkgsmzskdybebzg`). Hai điều kiện cùng lúc, thiếu một là từ chối.
- **Tắt mọi thứ nối ra ngoài** ở bản demo: cổng thuế (Tờ khai), VPS ngân hàng, Google Drive (nộp báo giá), gửi email
  (Resend), backup tuần, tự tick theo mail báo cáo. Khoá riêng `TAX_ENC_KEY` mới cho demo.

## 2. Cách dựng

| Phần | Cách làm | Ai làm |
|---|---|---|
| Code | Nhánh `demo` trong cùng repo. Vercel project demo chỉ build nhánh này → đẩy `main` KHÔNG làm demo đổi. Muốn cập nhật: em gộp `main` → `demo` khi anh bảo. | Em |
| Database | Supabase project mới `savitax-demo`, vùng Singapore. Em sinh 1 file SQL dựng đủ ~70 bảng từ cấu trúc production (chỉ cấu trúc, không dữ liệu). | Anh tạo project + dán SQL · em sinh file |
| Hosting | Vercel project mới `savitax-demo`, cùng repo, production branch = `demo`, biến môi trường riêng. | Anh tạo (em hướng dẫn từng bước) |
| Tên miền | Thêm `demo.savitax.vn` ở Vercel → trỏ bản ghi CNAME `demo` → `cname.vercel-dns.com` ở nhà cung cấp tên miền. | Anh |
| Công tắc demo | `DEMO_MODE=1`: dải băng "Bản demo — dữ liệu giả, tự làm mới lúc 2h sáng"; các nút gọi ra ngoài hiện "Chỉ có ở bản chính thức"; khoá đổi mật khẩu tài khoản demo. | Em |
| Làm mới mỗi đêm | Cron 2h sáng gọi `/api/cron/demo-reset`: xoá sạch dữ liệu nghiệp vụ, sinh lại bộ demo, đặt lại mật khẩu tài khoản demo. | Em |

## 3. Bộ dữ liệu demo (sinh lại mỗi đêm, **ngày tháng chạy theo hôm nay**)

Mỗi đêm sinh lại theo tháng hiện tại → khách xem lúc nào cũng thấy "tháng này", hạn sắp tới, nợ quá hạn… như thật.

- **Tổ chức**: Giám đốc, 2 phòng Kế toán, phòng HCNS, phòng Kinh doanh, phòng Pháp lý; ~12 nhân viên tên giả.
- **Khách hàng**: ~40 công ty tên + MST giả (khai tháng / quý, vài hộ kinh doanh, vài công ty dùng HCNS, dịch vụ khác,
  1–2 công ty đã ngưng, 1 công ty không VAT, 1 công ty gia hạn thu). Mật khẩu cổng giả.
- **Checklist + KPI**: 12 tháng gần nhất, có việc đúng hạn / trễ / chưa làm → báo cáo KPI, xếp hạng phòng có số.
- **Công nợ**: phí, đã thu, nợ tồn chuyển kỳ, thu nợ tồn — giữ đúng 2 bất biến khối dòng tiền (em chạy 4 bộ kiểm trên DB demo).
- **HCNS**: khách Thời kỳ + hồ sơ Thời điểm, dịch vụ, hạn, thu phí.
- **Kinh doanh**: khách tiềm năng đủ 7 tình trạng, báo giá (xuất Word được), báo cáo phễu.
- **Đối soát ngân hàng**: giao dịch đủ các loại Sẵn sàng / Cần xem / Đã khớp / Tự ghi.
- **Tờ khai**: lịch hạn nộp + hồ sơ "đã đồng bộ" sẵn, có tờ khai đã nộp / chưa nộp / nộp bổ sung. (Nút lấy từ cổng thuế tắt.)
- **Tiền lương**: cấp bậc, lương, chấm công, thưởng KPI, hoa hồng giới thiệu, 1 tháng đã chốt + phiếu lương.
- **Soát xét báo cáo / Rủi ro thuế**: hai phân hệ này đọc thư mục trên máy người dùng → giai đoạn 2 em làm 1 bộ hồ sơ mẫu
  (file giả) để khách tải về rồi trỏ vào xem.

## 4. Tài khoản demo (mật khẩu chung anh gửi khách, mỗi đêm đặt lại)

`giamdoc@demo.savitax.vn` (quản trị) · `truongphong@demo.savitax.vn` · `nhanvien@demo.savitax.vn` ·
`ketoannoibo@demo.savitax.vn` (lương) · `hcns@demo.savitax.vn` · `kinhdoanh@demo.savitax.vn`.
Mật khẩu em đặt trong biến môi trường Vercel của demo, không ghi vào code.

## 5. Các bước & thời gian dự kiến

1. **Anh**: tạo Supabase project + Vercel project, gửi em (không dán khoá vào chat — dán vào `.env.demo` trên máy). ~15 phút.
2. **Em**: sinh file SQL dựng bảng → anh dán chạy một lần → em kiểm đủ bảng.
3. **Em**: công tắc `DEMO_MODE` + băng demo + tắt tính năng nối ngoài (code trên nhánh `demo`, không đụng app thật).
4. **Em**: script sinh dữ liệu + cron làm mới; chạy thử trên DB demo, chạy bộ kiểm dòng tiền / KPI.
5. **Anh**: trỏ tên miền. **Em**: kiểm từng phân hệ dưới cả 6 tài khoản, chụp ảnh gửi anh duyệt.
6. Giai đoạn 2: bộ hồ sơ mẫu cho Soát xét / Rủi ro thuế.

## 6. Chi phí / lưu ý

- Supabase gói miễn phí cho 2 project/tổ chức; project miễn phí tự ngủ sau 7 ngày không hoạt động — cron làm mới mỗi
  đêm giữ nó thức. Nếu tổ chức đã đủ 2 project miễn phí thì cần gói Pro (~25 USD/tháng) hoặc tạo ở tổ chức khác.
- Vercel: thêm 1 project trong tài khoản hiện có, cron 1 lần/ngày chạy được ở gói Hobby.
- Bản demo đứng yên một phiên bản: tính năng mới ở app thật chỉ hiện ở demo khi anh bảo em cập nhật.
