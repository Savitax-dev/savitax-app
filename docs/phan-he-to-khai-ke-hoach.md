# Phân hệ Tờ khai — kế hoạch triển khai trên app.savitax.vn

Bản này thay phần **kiến trúc kỹ thuật** của gói bàn giao `PhanHe-ToKhai-Savitax-BanGiao/`.
Phần nghiệp vụ (màn hình, quy tắc, mockup) vẫn dùng tài liệu gốc.

Lý do phải viết lại: gói bàn giao thiết kế cho một hệ thống có worker chạy nền, Redis, WebSocket,
S3 và KMS — app hiện tại **không có thứ nào trong đó**. Các số liệu dưới đây đo thật trên cổng
`dichvucong.gdt.gov.vn` ngày 18/09/2026 bằng tài khoản doanh nghiệp thật.

---

## 1. Kết quả kiểm chứng GĐ 0

Chạy bằng `scripts/test-dvc-login.mjs` và `scripts/test-dvc-tracuu.mjs` (captcha do người gõ).

| Câu hỏi | Kết quả đo |
| --- | --- |
| Cổng có cần trình duyệt ảo (Playwright) không? | **Không.** HTTP thuần chạy trọn vẹn: đăng nhập → tra cứu → chi tiết → tải file → đăng xuất |
| Có cần thuê VPS riêng không? | **Chưa cần** — viết thành các API route ngắn trên Vercel là đủ |
| Một lượt của một công ty tốn mấy mã captcha? | **2 mã** (đăng nhập + tra cứu) |
| Đồng bộ lần đầu 90 ngày (3 cửa sổ) | **2 mã** — mã tra cứu dùng lại được cho nhiều cửa sổ trong cùng phiên (tài liệu tính 4) |
| Cập nhật trạng thái hồ sơ đã biết mã | **1 mã** — trang chi tiết không đòi captcha |
| Dữ liệu có đủ để tự tick Checklist/KPI? | **Đủ** — xem mục 3 |

**Chi phí thật cho 293 công ty:** khoảng **293 mã** mỗi đợt cập nhật trạng thái (tài liệu ước 590),
chia theo nhân viên phụ trách thì mỗi người gõ vài phút.

### Ẩn số còn lại

**IP Singapore của Vercel** có bị cổng chặn không. Máy tại Việt Nam thì thông. Đo bằng route tạm
`app/api/admin/tokhai-probe/route.js` (chỉ mở trang công khai + tải ảnh captcha, không đăng nhập),
**xóa ngay sau khi đo**.

Nếu bị chặn, phương án dự phòng theo thứ tự ưu tiên:
1. Tiện ích Chrome chạy trên máy nhân viên (IP Việt Nam thật, dùng luôn phiên nhân viên tự đăng nhập).
2. Thuê 1 VPS tại Việt Nam làm nơi trung chuyển (~200–400k/tháng).

---

## 2. Kiến trúc trên hạ tầng hiện tại

Không có tiến trình chạy nền. **Mỗi bước của một lượt là một API route ngắn**, trạng thái giữa các
bước nằm trong bảng `tax_portal_sessions`.

```
Trình duyệt nhân viên            app.savitax.vn (Vercel)              Cổng DVC
  bấm Đồng bộ ──────────────────> POST /sync/start   ───────────────> GET /tthc/login
                                  lưu cookie+token vào DB             GET login/getCaptcha
  <──── ảnh captcha (base64) ───── trả ảnh về
  gõ mã ────────────────────────> POST /sync/login   ───────────────> POST /tthc/loginLDAP
                                                                      GET  /tthc/tchs
  <──── xin mã captcha thứ 2 ────
  gõ mã ────────────────────────> POST /sync/search  ───────────────> GET  checkCaptcha
                                                                      GET  ho-so/search
                                                                      (ngay trong lượt này)
                                                                      GET  files/detail/<mã>
                                                                      GET  validateIdTkhai
                                                                      POST downloadhoso
                                                                      POST downloadthongbao
  <──── kết quả + số file đã tải ─ ghi tax_filings, tax_notices        POST /tthc/logout
```

| Thành phần trong tài liệu | Thay bằng |
| --- | --- |
| Worker chạy nền + Redis/BullMQ | API route ngắn + bảng `tax_sync_jobs` làm hàng đợi |
| WebSocket đẩy ảnh captcha | Trình duyệt gọi API lấy ảnh (base64) rồi gửi mã lên — hợp quy ước "mọi thứ qua API route" |
| Playwright | `fetch` thường + cookie jar lưu trong DB |
| S3 | Supabase Storage, bucket riêng `tax-files` (private) |
| KMS | AES-256-GCM, khóa trong biến môi trường Vercel (`TAX_ENC_KEY`), chỉ route server giải mã |

**Giới hạn phải tôn trọng** (đo thật, không đổi được):

- Mỗi công ty **1 phiên tại một thời điểm** — cổng khóa tài khoản vào một phiên duy nhất.
- Tra cứu tối đa **30 ngày** mỗi lần (`RANGE_SEARCH_DAYS = "30"` trong mã cổng).
- **Tra cửa sổ nào phải tải hết file của cửa sổ đó NGAY**, rồi mới tra cửa sổ tiếp theo. Cổng chỉ
  cho tải hồ sơ thuộc lần tra cứu gần nhất trong phiên; tra tiếp là mất quyền tải cửa sổ cũ.
- Luôn `POST /tthc/logout` kể cả khi lỗi, nếu không để lại phiên treo.
- Vercel giới hạn thời gian mỗi route → mỗi route chỉ làm **một bước**, không gom cả lượt.

---

## 3. Dữ liệu lấy được từ cổng

Tra cứu trả về bảng có: mã hồ sơ, mã TTHC, tên tờ khai, **kỳ tính thuế**, loại (Chính thức/Bổ sung).

Tờ khai tải về là **ZIP chứa XML** chuẩn HTKK:

| Trường XML | Ví dụ thật | Dùng để |
| --- | --- | --- |
| `maTKhai` / `tenTKhai` | `864` — TK 05/KK-TNCN (TT80/2021) | Khớp loại tờ khai |
| `kyKKhai` | `2/2026` | Khớp kỳ → nghĩa vụ |
| `loaiTKhai` | `C` (chính thức) | Phân biệt chính thức / bổ sung |
| `soLan` | `0` | Lần nộp bổ sung |

Thông báo tải về là **XML** (không phải PDF như tài liệu giả định):

| Trường XML | Ví dụ thật | Dùng để |
| --- | --- | --- |
| `tenTBao` | `V/v: Tiếp nhận hồ sơ thuế điện tử TT19` | Phân loại thông báo |
| `ngayTBao` | `2026-07-23` | **Xét đúng/trễ hạn** |
| `ngayHoSo` | `2026-07-23T09:30:43+07:00` | Mốc nộp |

Nghĩa là **không phải bóc chữ từ PDF** — chỗ dễ sai nhất trong tài liệu gốc đã tự biến mất.

> Cần chốt: lưu thẳng XML, hay dựng thêm PDF cho kế toán mở xem? Cây thư mục Savitax đang đặt tên
> `TBTN_….pdf` / `TBCN_….pdf`. Đề xuất: lưu cả hai.

---

## 4. Mô hình dữ liệu

DDL trong gói bàn giao dùng bảng `companies`, `users`, `files` — app thật là `clients`, `staff`,
và không có bảng `files`. Viết lại trong `sql/15_tokhai_module.sql`, đặt tiền tố `tax_` để **tách
rời được** như HCNS và Sales (xem `project_clone_accounting_core_only`).

| Bảng | Vai trò | Khác tài liệu |
| --- | --- | --- |
| `tax_accounts` | Tài khoản cổng thuế mỗi công ty | `client_id` → `clients`, mật khẩu mã hóa |
| `tax_filing_types` | Danh mục tờ khai | Thêm `ma_tkhai_portal` để khớp `maTKhai` trong XML |
| `tax_client_filings` | Công ty phải nộp gì, kỳ nào | Mặc định suy từ `clients.report_type` |
| `tax_obligations` | Lịch hạn nộp sinh sẵn | |
| `tax_filings` | Hồ sơ thật lấy từ cổng | Khóa `(client_id, portal_code)` |
| `tax_notices` | Thông báo | Lưu `ngay_tbao` tách riêng để xét hạn |
| `tax_sync_jobs` | Mỗi lượt đồng bộ | Kiêm luôn hàng đợi (thay Redis) |
| `tax_portal_sessions` | Cookie + token giữa các bước, tự xóa sau 3 phút | **Mới** — hệ quả của kiến trúc không worker |
| `tax_access_logs` | Nhật ký truy cập | |
| `tax_holidays` | Ngày lễ để đẩy hạn nộp | |

Không dùng `CREATE TYPE ... ENUM` như tài liệu — app hiện dùng `text` + ràng buộc, giữ cho đồng bộ
và dễ sửa.

---

## 5. Quy tắc nghiệp vụ phải code

- **Hạn nộp**: tháng → ngày 20 tháng sau; quý → ngày cuối tháng đầu quý sau; quyết toán năm → ngày
  cuối tháng thứ 3. Rơi vào **thứ Bảy, Chủ nhật hoặc ngày lễ → đẩy sang ngày làm việc kế tiếp**.
  `lib/deadline.js` hiện chỉ đẩy Chủ nhật → **viết hàm riêng, không dùng lại hàm cũ**.
- **Lệ phí môn bài đã bỏ từ 01/01/2026** (NQ 198/2025/QH15) — không sinh nghĩa vụ này từ kỳ 2026.
- **Xét đúng hạn theo `ngayTBao` của thông báo TIẾP NHẬN lần nộp đầu tiên**, không phải ngày chấp nhận.
- Khớp hồ sơ với nghĩa vụ bằng bộ ba **(MST, loại tờ khai, kỳ)**.
- Luôn lưu nguyên văn trạng thái cổng bên cạnh trạng thái chuẩn hóa.
- **Mốc chuyển cổng là 01/07/2025** (cổng ghi rõ), tài liệu bàn giao ghi nhầm 01/06/2025.

---

## 6. Lộ trình

| GĐ | Nội dung | Ước lượng | Nghiệm thu |
| --- | --- | --- | --- |
| **0** | Kiểm chứng cổng | **Xong**, còn đo IP Vercel | Đã chạy thật 1 công ty |
| **1** | `sql/15_tokhai_module.sql`, mã hóa mật khẩu, chuyển 20 tài khoản `thue` đang lưu chữ rõ sang, bỏ mật khẩu rõ khỏi nhật ký và backup, khối Tài khoản cổng thuế | 1 tuần | Không API nào trả mật khẩu rõ cho nhân viên |
| **2** | Danh mục tờ khai, kỳ khai, lịch hạn nộp, ngày lễ, màn Tờ khai phòng | 1,5 tuần | Sinh đúng nghĩa vụ 1 quý cho cả phòng |
| **3** | Luồng đồng bộ (5 route), màn Đồng bộ theo lô, hàng đợi mã captcha | 2 tuần | Lô 16 công ty chạy hết, không sót hồ sơ |
| **4** | Gắn Checklist + KPI (tỉ lệ nộp đúng hạn) | 1 tuần | Không làm lệch % KPI hiện có |
| **5** | Tải file vào thư mục công ty + tải hàng loạt | 1,5 tuần | Đúng cây thư mục cho 5 công ty khác quy ước |
| **6** | Cổng thuế điện tử cho hồ sơ trước 01/07/2025 | 1 tuần | Lấy được hồ sơ 2024 của 3 công ty |

---

## 7. Việc phải làm trước khi code

1. **Đo IP Vercel** — chờ duyệt đẩy route tạm.
2. **Đổi mật khẩu tài khoản DVC dùng để test** (đã lộ qua khung chat).
3. **Thu tài khoản cổng thuế của 274 công ty còn thiếu** — hiện chỉ 19/293 công ty có. Đây là nút
   thắt thật của dự án, không phải phần code.
4. **Bổ sung mã khách hàng cho 16 công ty** đang trống `client_code` — thiếu là không tải file được.
5. **Chốt**: thông báo lưu XML hay dựng thêm PDF.
6. **Điều khoản ủy quyền** trong hợp đồng dịch vụ — nhờ pháp chế rà.

---

## 8. Chỗ tài liệu bàn giao ghi sai, đã sửa ở bản này

| Tài liệu gốc | Thực tế đo được |
| --- | --- |
| Mốc chuyển cổng 01/06/2025 | **01/07/2025** |
| Đồng bộ lần đầu 90 ngày tốn 4 mã | **2 mã** |
| Cập nhật trạng thái tốn 2 mã | **1 mã** |
| Thông báo là file PDF | **XML có cấu trúc** |
| Cần worker riêng + Redis + WebSocket | **Không cần** |
| Lô 16 công ty ~3 phút (§bàn giao) / 10–15 phút (§đặc tả) | Hai chỗ mâu thuẫn nhau; đo lại ở GĐ 3 |
| "Không ai xem lại mật khẩu rõ" (§15) vs "Trưởng phòng có nút Hiện" (§1) | Mâu thuẫn — chờ anh chốt |
