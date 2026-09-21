# Savitax — Hệ thống nội bộ

Web app quản lý nội bộ cho công ty dịch vụ kế toán/thuế Savitax: quản lý khách hàng, checklist
công việc hàng tháng/quý, công nợ dịch vụ, KPI nhân viên/phòng ban, phân quyền theo vai trò.

- **Production**: https://app.savitax.vn (deploy qua Vercel, region Singapore `sin1`)
- **Repo**: https://github.com/Savitax-dev/savitax-app (nhánh `main`, push là tự deploy)
- **Database**: Supabase (Postgres + Auth + Storage), project ref `ykorxlkgsmzskdybebzg`

## Stack & quy ước code

- Next.js 16 App Router, React 19, JS thuần (không TypeScript), Tailwind.
- **Mọi đọc/ghi dữ liệu nhạy cảm đi qua API route** (`app/api/admin/**/route.js`) dùng
  `SUPABASE_SERVICE_ROLE_KEY` (bỏ qua RLS). Browser chỉ dùng `lib/supabase.js` (anon key) để
  check session đăng nhập — KHÔNG dùng anon key để đọc/ghi nghiệp vụ trực tiếp (dễ vướng RLS
  hỏng/đệ quy đã từng gặp).
- Phân quyền: bảng `roles`/`permissions`/`role_permissions`, helper `lib/permissions.js`
  (`hasPermission(role, key)`). Vai trò `admin` có `is_system=true` → luôn full quyền, không cần
  gán permission riêng. Trang admin mới phải gọi `hasPermission` để gate, không hard-code role.
- KPI (xem `/api/admin/kpi-overview`, `/api/admin/room`): **%-công việc** = % của 1 công ty →
  trung bình cộng theo nhân viên (mỗi công ty tính ngang nhau) → trung bình cộng theo phòng.
  **%-công nợ** (đổi 2026-08-24, khác công việc) = TỔNG tiền đã thu / TỔNG phí phải thu **gộp
  tất cả công ty** của 1 nhân viên (không phải trung bình cộng % từng công ty — công ty phí lớn
  ảnh hưởng đúng theo tỉ trọng tiền) → sau đó mới trung bình cộng theo nhân viên lên mức phòng
  (bước phòng→cty vẫn trung bình cộng như %-công việc, không đổi). Không tính điểm KPI gộp (%
  công việc + % công nợ) — đã bỏ theo yêu cầu, chỉ hiển thị 2 chỉ số riêng.
- Công nợ: `service_fees.type` phân biệt `ketoan` (phí dịch vụ kế toán chính), `khach` (dịch vụ
  khác), `no_ton` (tiền thu hồi nợ tồn cũ), `fee_plan` (lịch sử thay đổi mức phí, không phải
  tiền đã thu).
- **Thu qua "Nợ tồn cũ" KHÔNG quay lại tháng gốc**: tháng quá hạn thì phần chưa thu chuyển thành
  nợ tồn (`debt_rollovers` + `clients.other_debt`), thu ở tab "Nợ tồn cũ" tạo dòng `no_ton` ở
  THÁNG THU chứ không tạo `ketoan` cho tháng gốc. Vì vậy mọi chỗ hiển thị "còn phải thu" của một
  tháng ĐÃ có dòng `debt_rollovers` phải lấy theo `remaining_amount`, KHÔNG lấy "phí trừ đã thu"
  — nếu không sẽ báo nợ oan khoản khách đã trả (đã gây ghi thu trùng thật). Bất biến khi audit:
  `SUM(debt_rollovers.remaining_amount)` của 1 công ty không được lớn hơn `clients.other_debt`.
- **Trả gộp nhiều kỳ** (`periods` ở `save-debt`): CHỈ cho phép khi công ty `other_debt = 0`. Còn
  nợ tồn thì ghi đúng phí kỳ, phần dư tự trừ vào nợ tồn qua `save-old-debt` (dư hơn nợ tồn thì
  báo cho nhân viên tự quyết, không tự ghi). Khi gộp, `suggestPeriods` ưu tiên các THÁNG SAU
  (gộp ở T9 → T9+T10). Áp cho cả phí kế toán lẫn phí HCNS. Xem `lib/feeCap.js`.
- Nhân viên chính/phụ: `clients.assigned_to` = nhân viên chính (toàn quyền, doanh thu tính cho
  họ + phòng họ). `client_secondary_staff` = nhân viên phụ (chỉ theo dõi, KHÔNG cộng doanh thu).
- Checklist mẫu (`task_definitions`) theo `report_type` (`monthly`/`quarterly`) + `month` cố
  định — đã bỏ logic "chỉ hiện task quý vào tháng cuối quý", mỗi tháng có bộ task riêng. Đổi
  checklist mẫu tự áp dụng cho mọi công ty cùng `report_type`, không cần đụng dữ liệu công ty.
- Soft-delete cho `task_definitions` (`is_active=false`) khi seed lại — KHÔNG hard-delete vì
  `task_records` cũ tham chiếu tới, xóa cứng sẽ vi phạm foreign key.
- File đính kèm công ty: Supabase Storage bucket `client-files`, key phải encode bằng
  base64url (không dùng `encodeURIComponent` thường — SDK tự decode lại trước khi validate nên
  ký tự tiếng Việt/khoảng trắng vẫn bị từ chối).
- Ngày hạn công việc (`deadline_day`) phải clamp về số ngày thực của tháng (VD ngày 30 ở tháng
  2 → ngày 28/29) và task chỉ "Quá hạn" sau khi qua HẾT ngày hạn (0h ngày kế), không phải ngay
  khi vừa tới ngày hạn.

## Module Phòng Kinh doanh (`/sales`)

Khách tiềm năng + báo giá SVT.MB03 + báo cáo, dựng 2026-09-11 (commit `78c529d`), tách rời như HCNS: SQL
`sql/13_sales_module.sql` + `sql/14_sales_room.sql` (đã chạy), route `app/api/admin/sales/**`, quyền nhóm
"Phòng Kinh doanh" (`view_sales`, `manage_sales_all`, `approve_sales_quote`). Đặc tả gốc: gói bàn giao
`app.baogia/` (gitignore — chứa dữ liệu khách thật, KHÔNG commit).

- **Engine phí** `lib/salesPricing.js` chép nguyên bản chạy thử Giám đốc đã chốt — đổi gì cũng phải chạy
  `node scripts/test-sales-pricing.mjs` (5 báo giá thật phải khớp từng dòng). Server luôn tính lại phí lúc lưu,
  không tin số trình duyệt gửi. `fees` lưu ảnh chụp lúc lập để in lại vẫn đúng khi biểu phí đổi.
- **Số báo giá DDMMNN không có năm** → khoá duy nhất là `(quote_date, seq)`, sinh ở server theo **giờ VN**
  (`todayVN`; Vercel chạy UTC, 6h sáng VN vẫn là hôm qua). Xoá mềm để số đã phát không dùng lại.
- **File Word** `lib/salesDocx.js`: mỗi ô bảng phải có ≥1 `<w:p>`, thứ tự thẻ trong `<w:pPr>` cố định (sai là
  Word báo file hỏng). Bản gửi khách KHÔNG in dòng BCTC năm và "Căn cứ" (mẫu Giám đốc sửa 11/09); có đề xuất
  mức khác thì phần chênh dồn vào dòng kế toán trọn gói để cộng ra đúng tổng (`printedMonthlyLines`).
- **Duyệt báo giá**: công tắc `APPROVE_ALL_QUOTES` (lib/salesPricing.js) — **đang TẮT** (người dùng tạm tắt
  2026-09-21, "sẽ bật lại sau"): đúng biểu phí (`ok`) xuất ngay, chỉ giá đề xuất khác biểu phí (`pending`) chờ
  quản trị (`approve_sales_quote`) duyệt. Bật = mọi báo giá phải duyệt mới xuất Word / gửi, chốt HĐ / nộp file
  báo giá vào Drive — nhớ chạy `scripts/approve-existing-sales-quotes.mjs --apply` TRƯỚC khi deploy. Lưu lại báo
  giá đã duyệt: phí + số liệu không đổi thì giữ duyệt (`nextPriceStatus` / `pricingChanged`).
- **Phí HCNS 300.000 đ/người/tháng** (`HCNS_PER_HEAD`, đổi từ 200.000 ngày 2026-09-21). Báo giá cũ giữ số trong
  ảnh chụp `fees` tới khi Lưu lại.
- **Google Drive**: service account `savitax-app-drive@savitax-app.iam.gserviceaccount.com` (thành viên Shared
  drive Phòng PTKH), env `GOOGLE_SA_EMAIL` / `GOOGLE_SA_PRIVATE_KEY` / `SALES_DRIVE_FOLDER_ID`. Bấm Lưu tự nộp
  phiếu khảo sát + file báo giá (`lib/salesFiling.js fileOnSave`, TUẦN TỰ — song song sinh 2 thư mục trùng tên).
  Service account không có dung lượng riêng: chỉ ghi được vào Shared drive. Kiểm:
  `node --env-file=.env.local scripts/test-drive-connection.mjs`.
- **Tình trạng khách 7 bước** (2026-09-21, `sql/15_sales_stage_7.sql`): Đang chăm sóc → Gửi khảo sát → Gửi báo
  giá → Chốt báo giá → Gửi hợp đồng → Chốt hợp đồng | Thất bại, lưu ở `sales_leads.stage` (mã `tu_van`,
  `gui_khao_sat`, `bao_gia`, `chot_bao_gia`, `gui_hd`, `chot`, `that_bai`; `moi` cũ = Đang chăm sóc). Đổi ở cột
  "Tình trạng" của danh sách báo giá (action `stage`) → trạng thái HĐ của báo giá đi theo (`contractForStage`).
  Tự đẩy chỉ đi TIẾN. Báo cáo: phễu 6 bước lũy kế + bảng tình trạng hiện tại (`lib/salesReport.js`).
- **Dò trùng**: `phone_norm` / `tax_norm` (MST bỏ số 0 đầu), so cả với `clients` đang phục vụ.
- Phòng `rooms.type='kinhdoanh'` bị loại khỏi KPI/công nợ phòng nghiệp vụ như `hcns`; người chỉ thuộc phòng
  KD/HCNS ẩn phân khu Kế toán (`/api/admin/me` → `noAccounting`).
- Giao diện riêng (phương án B "Xanh báo giá"): `app/sales/sales.css` (mọi selector dưới `.sales-ui`),
  `app/sales/layout.js` chỉ khai biến font Be Vietnam Pro / IBM Plex Mono — menu trái dùng chung không đổi.
- Script: `verify-sales-schema`, `seed-sales-channels` (thứ tự kênh), `refile-sales-quote <số>`,
  `cleanup-sales-test --quote <số> | --all` (xem trước trước khi `--apply`), `probe-sales-quotes`.

## Quy trình làm việc

- Sửa code tại đây → `git push` lên `main` → Vercel tự build & deploy `app.savitax.vn` (~1-2
  phút). Không cần thao tác tay phía hosting.
- SQL migration mới (cột/bảng/policy thêm) phải đưa file vào `sql/` **và** nhờ người dùng tự
  chạy trong Supabase SQL Editor — không có kết nối Postgres trực tiếp từ máy này (project
  dùng IPv6, sandbox không hỗ trợ), chỉ dùng được REST API qua `@supabase/supabase-js`.
- Đây là **dữ liệu production thật** — khi cần test (tạo nhân viên, đổi mật khẩu, ghi công
  nợ...), luôn dùng tài khoản/bản ghi tạm rồi xóa sạch ngay sau khi xác nhận, không để lại dữ
  liệu rác, không sửa trực tiếp tài khoản/dữ liệu thật của nhân viên đang dùng.
- Toàn bộ giao diện/giao tiếp bằng tiếng Việt.
