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

## Module Đối soát ngân hàng (`/bank`)

Tiền vào ngân hàng → tự nhận ra công ty + kỳ phí → người dùng bấm mới ghi công nợ. Dựng 2026-09-22,
SQL `sql/21_bank_transactions.sql`. **KHÔNG đưa vào bản clone** (ABS, NYD, Linh Phong): module rời như
HCNS/Kinh doanh — bỏ `sql/21`, `app/bank`, `app/api/bank`, `app/api/admin/bank-transactions`,
`lib/bank*.js`, `vps/`, mục menu trong `components/Sidebar.js` và `'bank_transactions'` trong danh sách
backup. Quyền không tồn tại thì mục menu tự ẩn, backup tự bỏ qua bảng thiếu.

- **Không có gì tự ghi công nợ.** VPS chỉ đẩy giao dịch vào bảng `bank_transactions` qua
  `/api/bank/incoming` (header `Authorization: Bearer $BANK_WEBHOOK_SECRET`, chống trùng bằng `ext_id`).
  Phân loại tính LẠI mỗi lần mở trang (không lưu) nên luôn khớp công nợ hiện tại; server tính lại đề
  xuất + so `planSignature` ngay trước khi ghi, lệch là từ chối, và `update ... eq('state','open')` làm
  chốt chống 2 người bấm cùng lúc.
- **Ghi tiền theo đúng luật đang có**: `lib/bankPost.js` CỘNG THÊM vào số đã thu của kỳ (khác nút ghi
  tay — nhập tổng mới), kỳ đã có `debt_rollovers`/quá hạn 10 ngày thì tiền vào nợ tồn (không ghi lại
  tháng gốc), trả gộp nhiều kỳ chỉ khi `other_debt = 0`.
- **Đọc nội dung chuyển khoản** (`lib/bankMatch.js`): mốc `TTPHIDICHVU`/`THANHTOANPHIDICHVU`… → mã KH
  hoặc MST đứng NGAY TRƯỚC mốc, kỳ đứng ngay sau (`T09`, `T9.2026`, `Q3`). Chỉ `ready` khi nhận bằng mã
  KH/MST + có kỳ + phí đáng tin + khớp đúng phần còn phải thu; nhận theo TÊN luôn là "Cần xem".
  Kiểm bằng `node --env-file=.env.local scripts/test-bank-match.mjs <mau.json>` (file mẫu để ngoài repo).
- **Quyền `bank_reconcile`** nằm nhóm "Công nợ", mặc định KHÔNG gán vai trò nào (Quản trị luôn có). Mục
  menu ở phân hệ Kế toán để tích thêm cho kế toán / trưởng phòng kế toán; người có quyền xem TOÀN BỘ
  giao dịch (không giới hạn theo phòng) để ghép lệnh chuyển khoản vào đúng công ty.
- **VPS** `vps/app_sync.py` chạy độc lập với `acb_zalo.py`/`tcb_zalo.py` (import hàm của chúng, file
  chống trùng riêng `app_posted.json`): lần chạy đầu của MỖI nguồn tự seed — đánh dấu giao dịch cũ,
  không gửi lên app. `--dry` xem trước, `--tcb` cho sao kê Techcombank.

## Module HCNS (`/hcns`)

Khách HCNS/BHXH: **Thời kỳ** (thu phí đều hằng tháng, gắn 1 công ty kế toán), **Thời kỳ – Phát
sinh** (việc thời điểm của chính công ty Thời kỳ, KHÔNG thu phí riêng), **Thời điểm** (hồ sơ theo
vụ việc, có phí). Vãng lai đã ẩn (2026-09-21), code server vẫn giữ. SQL `sql/06,07,10,11,12,17-21`.

- **`clients.uses_hcns` là NGUỒN ĐÚNG**: công ty bỏ tick bên kế toán thì Phòng HCNS coi như đã
  ngưng, kể cả khi `hcns_clients.is_active` còn true (từng lệch 9 công ty phí 0đ). Phí HCNS 0đ =
  "Miễn phí", vẫn ở tag Thời kỳ và vẫn làm checklist.
- **Hạn hoàn thành dịch vụ** (`lib/hcnsDue.js`) = ngày nhận + `hcns_service_templates.sla_days`,
  **bỏ chủ nhật**, ngày nhận tính là ngày 1; chốt vào `hcns_case_services.due_at` LÚC THÊM dịch vụ —
  đổi `sla_days` không kéo hạn hồ sơ cũ. Đổi `received_at` (chỉ admin) thì tính lại hạn.
  %-công việc Thời điểm chỉ tính việc tích trong hạn; thẻ "Hoàn thành đúng hạn" lấy mẫu số = đã
  xong + đang trễ (bỏ dịch vụ chưa tới hạn).
- **Công nợ hồ sơ Thời điểm**: `hcns_case_payments.paid_at` = ngày khách trả THẬT (ghi muộn khoản
  của tháng trước mà lấy ngày ghi sẽ thổi phồng "Tồn đầu kỳ" — ca DT. GROUP). Tiền "thu chung cho
  cả hồ sơ" được chia lần lượt vào từng dịch vụ, dịch vụ nhận trước trừ trước (`allocatePayments`).
- **Phân quyền**: `manage_hcns` sửa phí/ngưng/dùng lại DV HCNS ngay trong Phòng HCNS và ghi chú;
  `edit_hcns_case_info` sửa thông tin hồ sơ; `view_hcns_all_staff` (TP HCNS) + admin xoá dịch vụ;
  **chỉ admin** xoá hồ sơ, xoá ghi chú, sửa hạn/ngày nhận. Kế toán phụ trách công ty được đổi phí
  HCNS của công ty mình (PATCH `hcns/clients` chỉ gửi `hcns_fee`).
- Việc "Cập nhật số lượng nhân sự" (`requires_headcount`) bắt buộc nhập số người hoặc tick "Không
  thay đổi" → lưu `hcns_headcount`, dùng cho sheet Excel "Biến động nhân sự" (phí đề xuất = số
  người × `HCNS_PER_HEAD`).

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

## Module Tờ khai (`/tokhai`)

Tự lấy tờ khai + thông báo từ cổng Dịch vụ công thuế (`dichvucong.gdt.gov.vn`), đối chiếu với lịch
hạn nộp app tự sinh, rồi tải file về đúng thư mục từng công ty trên ổ chung. Lên production
30/09/2026 (`b93d320`), **mở cho mọi nhân viên**. SQL `sql/15_tokhai_module.sql` + `sql/22_tokhai_hkd.sql`
(đã chạy). 6 màn hình con gom trong `components/TabToKhai.js`. Tài liệu người dùng:
`docs/huong-dan-phan-he-to-khai.md` (+ `.docx` + ảnh ở `docs/img/`).

- ⚠ **BẤT BIẾN: MÁY CHỦ KHÔNG BAO GIỜ GỌI CỔNG THUẾ.** Vercel ở Singapore bị cổng chặn theo vùng
  (đo thật 21/09: TCP 443 hết giờ chờ, gói tin bị nuốt im lặng). Mọi lượt gọi đi qua **tiện ích
  Chrome** trên máy nhân viên; máy chủ chỉ dựng sẵn yêu cầu HTTP rồi đọc phản hồi nguyên văn.
  Đã xoá 666 dòng đường máy chủ tự gọi — **đừng nối lại**. Kiểm: `grep -rn "fetch(" app/api | grep
  gdt.gov.vn` phải ra rỗng. Luồng 11 bước của cổng ghi ở **đầu `lib/dvcPortal.js`** (nguồn tra cứu chính).
- **Mã tiện ích cố định `affcgkipcpdjoiednghajbahjanhlnnn`** nhờ trường `key` trong
  `chrome-extension/manifest.json`. Không có nó thì Chrome băm ĐƯỜNG DẪN thư mục → mỗi máy một mã,
  mà `NEXT_PUBLIC_TOKHAI_EXT_ID` chỉ giữ được một giá trị (nướng lúc build) → mọi máy trừ một máy
  mất kết nối. Khóa riêng ở `C:\Users\win\.savitax-keys\`, ngoài git, CỐ Ý. Giữ bất biến:
  `node scripts/test-tokhai-tienich.mjs`. Cách cài: `chrome-extension/CAI-DAT.md`.
- **Nhịp gọi cổng**: tiện ích có MỘT hàng đợi chung, sàn 2.200 ms/lượt (`chrome-extension/phien.js`).
  Từ bản 1.1 có **phiên ảo** — tráo cookie trước mỗi lượt nên nhiều công ty sống song song, nhân
  viên gõ captcha liên tục. **Song song là để NGƯỜI khỏi chờ, không phải để nhanh hơn**: bị cổng
  chặn thì cả phòng đứng việc.
- **Bẫy của cổng** (đã trả giá): token `_csrf` đổi sau đăng nhập, phải đọc lại; đăng xuất là POST
  (GET trả 500, để lại phiên treo); tra theo cửa sổ **30 ngày**, và **chỉ tải được file của lần tra
  GẦN NHẤT** (tra cửa sổ mới là mất quyền tải cửa sổ cũ); tải tờ khai phải `validateIdTkhai` trước;
  cổng kiểm captcha TRƯỚC mật khẩu nên **sai captcha vô hại, sai mật khẩu phải DỪNG HẲN** (thử lại
  là khoá tài khoản thuế của khách); gọi dồn quá nhanh → 429. Hồ sơ nộp trước 01/07/2025 nằm ở cổng
  Thuế điện tử cũ, cổng này không có.
- **Cây thư mục** (`lib/tokhaiThuMuc.js`): mỗi kỳ là MỘT thư mục NGANG HÀNG trong
  `<cty>\2. HỒ SƠ KẾ TOÁN\Năm <năm>\7. BỘ BÁO CÁO\`, bên trong luôn `TỜ KHAI THUẾ` /
  `THÔNG BÁO CHẤP NHẬN` / `BẢNG KÊ`. Bổ sung lần n = thư mục kỳ riêng đuôi `_BSLn`, **cùng cấp**
  với kỳ chính thức. Tên file `TK_` / `TBTN_` (tiếp nhận) / `TBCN_` (chấp nhận) + sắc thuế + kỳ +
  mã KH + `_BSLn`. Nhân viên **tự trỏ thư mục từng công ty** (File System Access API, tay lưu trong
  IndexedDB) — không dò tự động; app cảnh báo khi hai công ty trỏ trùng nhưng **không chặn**.
- **Cổng trả TỜ KHAI dạng .zip** chứa XML tên máy (mở nén bằng `pizzip` rồi đổi tên), **thông báo
  dạng .xml**. ⛔ **Phần dựng PDF ĐANG TẮT** (cờ `DUNG_PDF` ở `lib/tokhaiTaiFileClient.js`): bản in
  còn sai, và chưa từng có bản gốc cơ quan thuế phát để đối chiếu. Đừng bật lại khi chưa có bản gốc.
- **Hộ kinh doanh**: `clients.is_hkd` (ô tick ở hồ sơ công ty) — nhóm này nộp 01/CNKD (TT40/2021),
  KHÔNG nộp 01/GTGT/05/KK-TNCN/03/TNDN/BCTC. Lịch hạn nộp **bỏ qua** nhóm này cho tới khi có danh
  mục riêng — CỐ Ý, thà trống còn hơn báo "Quá hạn" cho việc không tồn tại (đã dọn 421 nghĩa vụ ảo
  của 59 hộ, `scripts/soat-hkd.mjs`).
- **Phạm vi xem**: 8 route đều có `requireLogin` **và** lọc theo vai trò. Nhân viên chỉ thấy công ty
  mình phụ trách chính/phụ; trưởng phòng thấy cả phòng; admin thấy hết. Route đụng mật khẩu kiểm
  từng công ty qua `lib/credentialScope.js`, kiểm cả trong vòng lặp nên chọn hàng loạt không lọt.
- Mọi câu truy vấn không giới hạn phải lật trang (`docHet`) — **PostgREST cắt im lặng ở 1000 dòng**.
- Bộ kiểm: `test-tokhai-xml | -thumuc | -ghidia | -thongke | -tienich | -pdf`.
- ⏸ **Đang chờ người dùng, đừng tự làm**: GĐ 5 Checklist + KPI (hoãn tới sau khi chạy demo), danh
  mục tờ khai 01/CNKD, và bản PDF thật do cổng xuất.

## Mật khẩu khách & khóa mã hóa

- Mật khẩu khách (thuế, hóa đơn, CKS, ngân hàng, BHXH) nằm ở `client_credentials.password_enc` và
  `tax_accounts.password_enc`, mã hóa AES-256-GCM (`lib/taxCrypto.js`), khóa ở `TAX_ENC_KEY`.
- **Đừng in lệnh sinh khóa vào mã nguồn làm mẫu.** Chỗ đó từng ghi sẵn câu `node -e "...randomBytes
  (32)..."` và ngày 29/09/2026 soát ra `TAX_ENC_KEY` thật CHÍNH LÀ câu lệnh đó — 66 mật khẩu khách
  khóa bằng một chuỗi công khai trên GitHub. Guard "ít nhất 32 ký tự" không bắt được vì nó dài 70.
- Xoay khóa: `scripts/xoay-tax-enc-key.mjs` (mặc định chỉ soát, `--apply` mới ghi). `TAX_ENC_KEY_OLD`
  là khóa giải mã dự phòng → đặt cả hai lên Vercel **trước** khi deploy, mã hóa lại, rồi mới bỏ khóa
  cũ; làm đúng thứ tự thì production không gãy giây nào. Đã xoay 66/66 dòng ngày 30/09.
- Cột `client_credentials.password` chữ rõ đã xoá sạch (`scripts/xoa-mat-khau-chu-ro.mjs`).
  **Còn một việc tay**: `alter table client_credentials drop column password;` — giữ cột rỗng thì có
  ngày mã nào đó lại ghi chữ rõ vào đấy mà không ai biết.

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
