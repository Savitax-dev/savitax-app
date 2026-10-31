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
- **Quyền phía trình duyệt lấy từ `lib/khoiDong.js`** (`layMe`, `layQuyenLuong`; `loadPermissionData` dùng chung):
  MỘT yêu cầu `/api/admin/khoi-dong` (me + vai trò + bảng quyền + quyền lương), nhớ 5 phút trong phiên. Trang mới
  đừng tự `fetch('/api/admin/me')` / `/roles` / `/role-permissions` (23/10/2026: mỗi trang 4–5 lần kiểm đăng nhập,
  localhost chậm thấy rõ). Sửa phân quyền / đăng nhập / đăng xuất phải gọi `clearPermissionCache()` (xoá luôn bộ nhớ này).
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
  - **Một hàm duy nhất** `lib/kpiTongQuan.js` (`tinhKpiToanCty`) — Báo cáo KPI, Trang chủ và phân hệ
    Tiền lương đều gọi hàm này; trang Phòng (`/api/admin/room`) tự tính nhưng phải giữ cùng quy tắc.
  - **Trung bình phòng BỎ QUA người không có gì để chấm** (anh duyệt 17/10/2026): không có công ty
    nào trong tháng (tài khoản dùng chung "TP …", chưa nhận công ty) thì không vào trung bình cả hai
    chỉ số; chỉ ôm công ty "chỉ Dịch vụ khác" thì bỏ khỏi %-công việc nhưng VẪN tính %-công nợ (loại
    này thu phí hằng tháng). Riêng người đó vẫn hiện 0% ở danh sách nhân viên.
  - **Hạn công việc theo GIỜ VIỆT NAM** (`lib/deadline.js`): `effectiveDeadlineDate` trả 0h ngày hạn
    giờ VN bất kể máy chạy ở múi giờ nào — Vercel chạy giờ quốc tế, trước 17/10/2026 việc tích từ 0h
    tới 7h sáng hôm sau vẫn bị tính đúng hạn. Lấy ngày/tháng của kết quả dùng `ngayVN()`, đừng
    `getDate()`. Phòng HCNS dùng đúng luật này (tích trong ngày hạn = đúng hạn).
- **Lật trang PHẢI `.order('id')`** — PostgREST cắt im lặng ở 1000 dòng, và lật trang không sắp thứ tự
  thì trang sau lặp / sót dòng (17/10/2026: %-KPI tháng 8 mỗi lần tính ra một số). Có order theo cột
  khác thì thêm `.order('id')` làm khoá phụ. Soát: chạy cùng hàm 2–3 lần trên tháng nhiều dữ liệu,
  kết quả phải giống hệt.
- **Xuất Excel dùng exceljs qua `lib/excelDep.js`** (`soExcelMoi` → `themSheetMang(wb, ten, mảngHàng,
  {doRong, cotTien, cotPhanTram})` → `taiVeExcel`): tự tô tiêu đề, hàng tên cột, dòng tổng, kẻ khung,
  cố định tiêu đề. KHÔNG dùng SheetJS (`xlsx`) để XUẤT nữa — anh chê xấu; SheetJS còn bỏ mất ô công
  thức nếu không kèm giá trị. Trang mới có nút Excel thì dùng helper này cho đồng bộ.
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
- **Tick thì ai cũng tick, BỎ TICK thì không**: bỏ tick xoá mất dấu "hoàn thành đúng hạn" gốc mà
  KPI chấm theo. Cần quyền `uncheck_task` (bật/tắt ở Vai trò & phân quyền, `sql/23`, cố ý KHÔNG gán
  sẵn cho vai trò nào) **và** đúng phạm vi công ty — `lib/checklistScope.js`: nhân viên chỉ công ty
  mình phụ trách chính/phụ, trưởng phòng chỉ trong phòng mình, "không đụng lẫn nhau" (anh chốt
  01/10/2026). Nút sửa "trễ hạn → đúng hạn" vẫn CHỈ admin — đó là sửa thẳng số liệu KPI.
- ⚠ Xét phòng của một công ty thì **suy từ nhân viên phụ trách** (`lib/clientRoom.js`), đừng đọc
  `clients.room_id` — cột đó 0/294 công ty có giá trị, tin vào nó là trưởng phòng mất quyền trên
  chính công ty phòng mình. `lib/debtScope.js` còn đọc thẳng cột này, là chỗ nên soát lại.
- File đính kèm công ty: Supabase Storage bucket `client-files`, key phải encode bằng
  base64url (không dùng `encodeURIComponent` thường — SDK tự decode lại trước khi validate nên
  ký tự tiếng Việt/khoảng trắng vẫn bị từ chối).
- Ngày hạn công việc (`deadline_day`) phải clamp về số ngày thực của tháng (VD ngày 30 ở tháng
  2 → ngày 28/29) và task chỉ "Quá hạn" sau khi qua HẾT ngày hạn (0h ngày kế), không phải ngay
  khi vừa tới ngày hạn.

## Khối dòng tiền công nợ (5 thẻ) — Phòng, Quản lý công nợ, Công nợ toàn công ty, Báo cáo KPI

Tồn đầu kỳ + phí phát sinh − đã thu (− đã xoá nợ) = còn phải thu chuyển kỳ sau, tách 3 loại thu: kế
toán · HCNS · dịch vụ khác. Dựng 2026-10-05/06. Lõi `lib/dongTienPhong.js`, hiển thị
`components/KhoiDongTien.js` — **một hàm tính, một component cho cả 4 trang**; trang KHÔNG tự cộng lại.

- ⚠ **Hai bất biến người dùng tự cộng trên màn hình và hỏi ngay khi lệch**: (1) cộng trừ trên thẻ phải
  khớp; (2) chuyển kỳ sau của T(n) = tồn đầu kỳ của T(n+1). Sửa gì ở đây cũng phải chạy đủ 4 bộ kiểm
  (chỉ đọc, dữ liệu thật): `test-dong-tien-phong` · `-nhan-vien` (cộng nhân viên = phòng) · `-toan-cty`
  · `-quy-nam` (quý nối đúng sang tháng kế).
- **Tồn đầu kỳ là SỐ DƯ CHẠY DẦN từng kỳ**, không đọc từ `debt_rollovers`: sổ chỉ chốt sau ngày 10 nên
  đọc sổ là hụt phần chưa thu của kỳ vừa qua. Điểm xuất phát suy ngược từ nợ đang có
  (`other_debt − Σ đã chốt + Σ đã thu nợ tồn`) vì nợ cũ nhập tay không có dòng chốt nào; chặn sàn 0
  cho TỪNG công ty.
- **Mốc bắt đầu chạy số dư = kỳ chốt sổ sớm nhất của CẢ PHÒNG**, ở mọi trang (kể cả khi tính cho một
  nhân viên / một công ty — truyền `lichSuTu`). Toàn công ty = `gopDongTien` CỘNG từng phòng, không tính
  gộp một lần. Sai mốc là cùng một công ty mà hai trang ra hai số.
- `clients.status` là trạng thái HÔM NAY — đừng dùng nó để quyết định phí của kỳ cũ. Bộ kiểm phải nạp
  dữ liệu GIỐNG route (lịch sử phí chỉ của công ty đang dùng dịch vụ), nạp rộng hơn là che mất lỗi.
- **HCNS** tính từ T9/2026 (`HCNS_TU`, kỳ tách phí HCNS khỏi phí kế toán). **Dịch vụ khác**
  (`other_services`, sql/24) đi theo từng tháng tới khi thu đủ, KHÔNG bao giờ chuyển vào nợ tồn.
- **Quý / Năm**: tham số `months`; số dư cuối kỳ chạy lần lượt từng tháng; tháng chưa tới không tính.
- **Ngưng dịch vụ** (sql/25): phải chọn THÁNG NGƯNG → `clients.service_end` (ngày 01 của tháng). Từ
  tháng đó không phí, không KPI; phí các tháng trước chưa thu vẫn là nợ, hiện ở khối "Đã ngưng dịch vụ
  — còn phải thu" (trang Phòng + Quản lý công nợ) để ghi thu. Công ty ngưng vẫn mở được hồ sơ Dịch vụ
  khác ở Danh sách công ty. Đặt tháng ngưng muộn hơn thực tế là đẻ nợ ảo cho các tháng giữa.
- **Xoá nợ** (`/api/admin/debt-writeoff`, bảng `debt_writeoffs`): chỉ role admin thật, chỉ công ty đã
  ngưng, bắt buộc lý do, chỉ phí kế toán. Xoá là giảm số dư nhưng KHÔNG phải tiền thu. Phải ghi luôn
  dòng chốt `remaining_amount = 0` cho kỳ chưa chốt sổ, không thì sau ngày 10 khoản vừa xoá mọc lại.
- **Báo cáo "Phí đã thu"** (`/api/admin/fee-collected`): chọn theo NGÀY ghi vào app; dòng tiền lấy các
  tháng mà khoảng ngày chạm tới, nên có HAI cột đã thu cố ý để riêng ("của kỳ" và "ghi trong khoảng
  ngày"). `service_fees` mỗi (công ty, kỳ, loại) chỉ một dòng luỹ kế và `created_at` bị đặt lại mỗi lần
  ghi — không có sổ từng lần thu.
- ⏳ Chưa xử lý: nợ HCNS đã chốt mà trả qua "Nợ tồn cũ" thì ghi `no_ton` chung túi với kế toán, nên
  phần trả đó đang trừ vào dòng KẾ TOÁN của thẻ (tổng đúng, chia dòng lệch).

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
- Phòng `rooms.type='kinhdoanh'` (và `phaply` — Phòng Pháp lý, sql/43, 31/10/2026, tạm để gán nhân viên) bị loại khỏi KPI/công
  nợ phòng nghiệp vụ như `hcns` — danh sách DUY NHẤT ở `lib/loaiPhong.js` (`PHONG_NGOAI_NGHIEP_VU`); người chỉ thuộc phòng
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
  với kỳ chính thức. Tên file `TK_` / `TBCN_` (chấp nhận; thông báo TIẾP NHẬN không tải từ 31/10/2026 — Savitax không lưu,
  `canTaiThongBao` ở route tai-file; ngày tiếp nhận vẫn lấy từ trang chi tiết) + sắc thuế + kỳ +
  mã KH + `_BSLn`. Nhân viên **tự trỏ thư mục từng công ty** (File System Access API, tay lưu trong
  IndexedDB) — không dò tự động; app cảnh báo khi hai công ty trỏ trùng nhưng **không chặn**. Thư mục năm nhận
  mọi kiểu `namCuaTen` (`lib/tokhaiLuuDia.js`): `Năm 2026`, `NĂM 2026`, `2026` (144 thư mục trên ổ G:), `1. NĂM 2026`,
  `NĂM_2026`; chưa có mới tạo `Năm <năm>`. Quy ước lưu file thư mục 1–12 cho nhân viên: `docs/quy-uoc-luu-ho-so.md`.
- **Cổng trả TỜ KHAI dạng .zip** chứa XML tên máy (mở nén bằng `pizzip` rồi đổi tên), **thông báo
  dạng .xml**. ✅ **PDF tờ khai ĐÚNG MẪU cổng** (31/10/2026, cờ `DUNG_PDF_MAU`, `lib/tokhaiPdfMau.js`): chép
  theo bản PDF cổng in từ XML (PD4ML) anh gửi — **01/GTGT + 05/KK-TNCN (TT80)**, đã so từng cụm
  chữ với bản gốc (`node scripts/test-tokhai-pdf-mau.mjs <xml> <pdf gốc>`, file thật để ngoài repo). Mẫu mới / phụ lục
  (vd giảm thuế NQ 142) phải có bản PDF cổng in để đo, chưa có thì CHỈ lưu XML.
  **HAI MẪU, chọn theo phiên bản XML** (anh chốt 31/10: "QUANG là mới nhất, PLATINUM cũ rồi"): XML 01/GTGT ≤ 2.7.4 /
  05/KK ≤ 2.5.1 in mẫu cũ (PLATINUM); bản sau in mẫu mới (QUANG 2.8.3 / 2.9.3): ô Mẫu số dời phải, [11a]/[07]
  "Xã/phường/đặc khu", cột khác, hàng 3 dòng 42,25, 05/KK thêm hàng 4.1 [25.1], khối chữ ký mới + dòng xanh "Ký điện tử
  bởi" (phông Arimo, SIL OFL, ở public/fonts) khi XML có chữ ký số. Mẫu mới dựng được **phụ lục giảm thuế GTGT NQ
  204/2025** (PL_NQ142_GTGT đủ mua vào + bán ra, kỳ từ 07/2025) — trang riêng, đánh số riêng. Phụ lục NQ 142/174 (kỳ trước
  07/2025) và mẫu cũ có phụ lục: chưa có bản gốc → chỉ XML. Khác bản cổng duy nhất: cổng cắt đôi một hàng bảng qua 2 trang,
  app chuyển nguyên hàng sang trang sau. Thêm **thông báo CHẤP NHẬN 01-2/TB-TĐT**
  (maTBao 844, trạng thái Y) chép theo trang cổng anh in. **Thông báo TIẾP NHẬN (843) KHÔNG tải nữa** (route tai-file bỏ
  qua, anh chốt 31/10). ⚠ Phông: `subset: true` của pdf-lib 1.17 + fontkit 1.1.1 làm HỎNG Tinos (mất chữ có dấu, đọc lại
  báo lỗi — bộ dựng cũ `lib/tokhaiPdf.js` dính lỗi này) → tự cắt bằng `lib/catPhong.js` (giữ nguyên số hiệu nét chữ,
  dựng 2 lượt), nhúng `subset: false`: ~60–80 KB/file, ảnh in giống hệt bản nhúng nguyên. ⛔ Bộ dựng cũ (cờ `DUNG_PDF`) vẫn TẮT.
- **Hộ kinh doanh**: `clients.is_hkd` (ô tick ở hồ sơ công ty). Từ 28/10/2026 (anh chốt, `sql/41`):
  nộp **01/CNKD** (TT40/2021, gộp GTGT + TNCN chủ hộ, kỳ/hạn như 01/GTGT); **05/KK-TNCN và 01/GTGT CHỈ
  sinh lịch khi hộ đã TỪNG nộp loại đó** trên cổng (có người lao động…), không quyết toán năm; doanh
  nghiệp KHÔNG BAO GIỜ có 01/CNKD. Một luật duy nhất `loaiApDung` (`lib/tokhaiLich.js`) — script năm,
  nút Lưu kỳ khai, tự đổi kỳ, đồng bộ đều đi qua nó; chỗ nào nạp `clients` để sinh lịch PHẢI chọn cột
  `is_hkd` (thiếu cột thì luật không lọc). Cổng không kèm mã tờ khai cho 01/CNKD → nhận theo mã thủ tục
  `1.011022`. Hộ lần đầu nộp 05/KK thì đồng bộ tự sinh lịch (`boSungLichHkdTheoHoSo`). Nạp một lần:
  `scripts/hkd-01cnkd.mjs` (xem trước, `--ghi` mới ghi).
- **Phạm vi xem**: 8 route đều có `requireLogin` **và** lọc theo vai trò. Nhân viên chỉ thấy công ty
  mình phụ trách chính/phụ; trưởng phòng thấy cả phòng; admin thấy hết. Route đụng mật khẩu kiểm
  từng công ty qua `lib/credentialScope.js`, kiểm cả trong vòng lặp nên chọn hàng loạt không lọt.
- Mọi câu truy vấn không giới hạn phải lật trang (`docHet`) — **PostgREST cắt im lặng ở 1000 dòng**.
- Bộ kiểm: `test-tokhai-xml | -thumuc | -ghidia | -thongke | -tienich | -pdf`.
- ⏸ **Đang chờ người dùng, đừng tự làm**: GĐ 5 Checklist + KPI (hoãn tới sau khi chạy demo), và bản
  PDF thật do cổng xuất.

## Phân hệ Soát xét báo cáo (`/soatbaocao`) + Rủi ro thuế (`/ruirothue`)

Soát hồ sơ khách ngay trên thư mục Drive của công ty, dựng 25–28/10/2026. Kế hoạch + mockup:
`docs/phan-he-phan-tich-ke-hoach.md`, `docs/mockup-phan-tich/`. Hướng dẫn nhân viên xếp hồ sơ: `docs/huong-dan-ho-so-soat-ky.md`.
SQL `sql/40_phantich_xem_phi.sql` (đã chạy). **KHÔNG đưa vào bản clone**: bỏ `app/soatbaocao`, `app/ruirothue`,
`app/api/admin/phantich`, `lib/phanTich`, `lib/ruiro`, `lib/soatbaocao`, `components/phanTich`, 2 mục menu trong
`components/Sidebar.js`, `sql/40`; hai thư viện `jszip`, `pdfjs-dist` chỉ phân hệ này dùng.

- ⚠ **BẤT BIẾN: CHỈ ĐỌC.** Thư mục mở bằng File System Access API chế độ `read`; không ghi file nào vào Drive, không lưu
  gì lên Supabase (anh chốt 25/10). Máy chủ chỉ có 3 route `api/admin/phantich/*` (danh sách công ty, phí, hạn nộp) —
  không nhận file của khách. Bộ nhớ đệm đọc file nằm ở IndexedDB trên máy (`lib/phanTich/khoMay.js`). Kiểm nhanh:
  `grep -rnE "createWritable|removeEntry|\.insert\(|\.update\(" lib/phanTich lib/ruiro lib/soatbaocao components/phanTich` phải rỗng.
- **Chưa chấm điểm / xếp loại** — chỉ số liệu, chênh lệch, tỷ lệ (ngưỡng giữ trong mã nhưng tắt). Chỉ soát từ 2026; năm cũ
  nhân viên trỏ thư mục năm riêng ("＋ Năm cũ"), thư mục năm trỏ riêng THẮNG thư mục chính khi trùng năm.
- **Thư mục chính dùng chung tay cầm với Tờ khai** (`layThuMucCongTy(…, { cheDo: 'read' })`) — trỏ lại ở đây là đổi luôn chỗ
  Tờ khai tải file về. Trỏ nhầm tầng "7. BỘ BÁO CÁO" thì nhắc trỏ lại thư mục công ty; thư mục con hỏng / bị đổi tên giữa
  chừng chỉ cảnh báo (`conAnToan`), thư mục gốc hỏng thì báo đỏ.
- **Phạm vi** như Tờ khai: nhân viên công ty mình chính/phụ, trưởng phòng phòng mình làm trưởng, admin hết. Phí (Tăng trưởng &
  phí, bản gửi khách) cần quyền `xem_phi_de_xuat` (gán leader) **và** làm trưởng đúng phòng của công ty. Phí luôn GỒM VAT.
- **Chuyển tab KHÔNG đọc lại thư mục** (anh yêu cầu 29/10): `useHoSoCty` giữ lượt quét + bản đọc từng công ty trong phiên
  (Map cấp module, 6 công ty gần nhất); Soát xét năm / Rủi ro thuế / Rủi ro lũy kế giữ kết quả theo đúng đối tượng `quet`
  (WeakMap). Chỉ "↻ Tải lại thư mục", Trỏ lại, Năm cũ, F5 mới đọc lại. Màn mới đọc thư mục cũng phải giữ theo `quet` như vậy.
- **Kỳ khai cố định cả năm**, lấy theo tờ khai XML; hồ sơ công ty khác kỳ = nhân viên tick nhầm, chỉ báo không sửa.
- **Cây "7. BỘ BÁO CÁO" có hai kiểu, đều có thật**: nhân viên tự xếp qua nhóm `BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_…`, và phân
  hệ Tờ khai tải về đặt `BAOCAOTHUE_<kỳ>_<năm>_<mã KH>[_BSLn]` + `BAOCAOTHUE_PS<mmdd>_…` THẲNG trong bộ báo cáo. Thư mục nhóm
  tên giống kỳ ("QUÝ 1-2-3-4") có kỳ con thì vẫn là nhóm; thư mục phát sinh xét trước kỳ.
- **Vai trò bảng kê theo THƯ MỤC, không theo bố cục file** (anh chốt 30/10/2026, `vaiTroBangKe` ở `docHoSo.js`): Excel ở
  `2. HÓA ĐƠN MUA VÀO_BÁN RA` = **bảng kê cổng** (bảng kê chi tiết tải từ hoadondientu theo kỳ); Excel ở `7. BỘ BÁO CÁO` = **bảng kê
  kèm tờ khai** — xuất từ phần mềm, hoặc "BẢNG KÊ MV-BR" cùng bố cục cổng (đổi `mau` thành `pm_kem_tk`, bỏ HĐ hủy / thay thế).
  Soát kỳ đối chiếu từng hóa đơn mục 2 ↔ mục 7. Trước đó MV-BR bị tính là bảng kê cổng → ô "Bảng kê cổng HĐĐT" HONGDUC Q1, Q2
  xanh dù mục 2 không có file. Trên màn hình gọi là "bảng kê kèm tờ khai" (trước đây "bảng kê phần mềm").
- **Đối chiếu bảng kê cổng HĐĐT ↔ kèm tờ khai ↔ tờ khai** (`lib/phanTich/soatKy.js`): khoá MST đối tác + ký hiệu + số. Bảng kê cổng
  MUA VÀO có thể không có cột MST người bán → khi MỘT bên thiếu MST ghép theo ký hiệu + số (bán ra) / + ngày (mua vào), khoá
  trùng thì không đoán. Bỏ trùng giữa sheet bằng MST + số + ngày CHỈ khi một bên thiếu ký hiệu (từng nuốt hóa đơn thật).
  Sheet "BẢNG KÊ HÓA ĐƠN GIẢM THUẾ GTGT THEO NGHỊ QUYẾT…" trong file HTKK là PHỤ LỤC (liệt kê lại hóa đơn bán ra) → bỏ. Sheet
  "TỜ KHAI THUẾ GTGT" trong file phần mềm → `mau: 'tk_pm'` (không có tiền tố `pm_`, không lẫn vào đếm hóa đơn), so từng chỉ
  tiêu với XML đã nộp. Cả năm chỉ cộng kỳ có ĐỦ bảng kê cổng + phần mềm (`gopBangKeKy` kyDu/kyBo). Đổi cách đọc bảng kê thì
  đổi khoá đệm (`'bangke5|'` ở `docHoSo.js`) — không thì máy nhân viên dùng kết quả đọc cũ.
- **05/KK-TNCN mã chỉ tiêu theo MẪU**: TT80/2021 (HTKK 2.9.x, maTKhai 864) [16] số lao động, [21] thu nhập chịu thuế, [29]
  thuế đã khấu trừ ([32] chỉ là thuế trên phí bảo hiểm); TT156/2013 lùi 5 ([26], [32], có [33][34]).
- **Bảng lương / C12** (HOANGTIENSG 28/10): file `.xls` có liên kết ngoài tên trống làm SheetJS ném "Unexpected SupBook type: 0"
  và bỏ cả file → mọi chỗ đọc Excel đi qua `docWorkbook` (`lib/phanTich/doc/excel.js`, tự vá rồi đọc lại). Một năm có thể
  có 2 file lương mỗi file để trống nửa năm → tháng nào lấy sheet CÓ NGƯỜI. Một công ty có thể có NHIỀU mã đơn vị BHXH
  (người lao động + giám đốc), mỗi mã một C12 → cộng theo mã, cùng mã chỉ tính một lần.
- **Hạn nộp + trạng thái nộp** ở Soát kỳ lấy từ phân hệ Tờ khai (`api/admin/phantich/han-nop`, chỉ đọc), GỘP lịch nghĩa vụ +
  hồ sơ đồng bộ theo (kỳ, loại) — lịch có thể chỉ sinh từ giữa năm trong khi hồ sơ kỳ trước vẫn có. Hạn theo lịch (đã đẩy
  ngày nghỉ) ưu tiên hơn hạn app tự tính.
- **Soát xét năm** — `lib/soatbaocao/boMay.js` là bộ máy bản offline SINH TỰ ĐỘNG (script sinh để ngoài repo), mọi chỗ sửa nằm
  sau công tắc `__SUA.B1…B18`, danh sách + lý do ở `lib/soatbaocao/suaLoi.js`; sửa tay boMay thì sửa cả script sinh.
  **Rủi ro thuế** — `lib/ruiro` giữ nguyên logic bản 3.2.0; chỗ sửa ghi "Savitax sửa" tại chỗ hoặc trong `quyTac.js` SUA_LOI.
- **Thương hiệu**: không ghi tên đơn vị nguồn cũ ở đâu cả — `node scripts/test-phantich-thuong-hieu.mjs` (từ khóa ở
  `~/.savitax-keys/`, ngoài repo).
- Bộ kiểm (đều chạy offline, dữ liệu giả): `test-phantich-{thumuc,doc,kiemke,soatky,sotien,tangtruong,luong,pdf,thuong-hieu}`,
  `test-ruiro-{mau,thumuc}`, `test-soatbaocao-{mau,thumuc}`. Thử trên thư mục thật (CHỈ ĐỌC, anh cho phép từng công ty):
  `scripts/soat-thu-muc-that.mjs`, `soat-ruiro-thu-muc-that.mjs`, `soat-soatbaocao-thu-muc-that.mjs`.
- ⏳ Chưa làm: màn Hóa đơn (danh sách từng hóa đơn từ file XML/PDF/HTML), đọc BCTC PDF ở Soát xét năm, đọc ảnh scan, bảng
  lương DOEL quý 2 chỉ đọc ra 1/2 người (anh để sau), mẫu 05/KK theo TT89/2026.

## Phân hệ Tiền lương (`/luong`)

Chấm công + thưởng + khoản trừ + chốt bảng lương + Excel + phiếu lương, dựng 17–19/10/2026 (production
`c4ebe81`, `a1f1f71`), SQL `sql/31` → `sql/34` (đã chạy). Hướng dẫn nhân viên: `docs/huong-dan-cham-cong-luong.md` (+ .docx).
**Mã tách theo 3 bước — đọc `lib/luong/README.md` trước khi sửa** (bảng "bước nào ở file nào" + toàn
bộ quy tắc). Anh yêu cầu tách cho dễ sửa: đổi quy tắc bước nào chỉ đụng file của bước đó.

- Bước 1 `lib/luong/ngayCong.js` + `api/admin/luong`: cấp bậc (`luong_cap_bac`), lương từng người
  có LỊCH SỬ theo tháng (`luong_nhan_vien`, đổi lương = dòng mới), ngày lễ (`luong_ngay_le`, lễ rơi
  chủ nhật anh muốn BỎ khỏi danh sách), chấm công tự khai → xác nhận là khoá, TP sửa phải ghi lý do.
- Bước 2 `thuong.js`, `bangLuong.js` + `api/admin/luong/thuong`: lương tháng N lấy %-việc **N**,
  %-nợ **N−1**, doanh thu **N** (anh đổi 19/10/2026). Doanh thu = `monthly_fee ÷ 1,08` (phí lưu GỒM VAT) của công ty phụ trách
  chính, công ty quý ÷ 3 — đã khớp file lương mẫu của anh từng đồng (4/4 người). Thưởng KPI mỗi chỉ
  số 0 / 300k / 500k; vượt doanh số × 20% (TP: 20% doanh thu tự làm, không cần tối thiểu). Thưởng
  dịch vụ khác: nhân viên tự khai (tiền × %), TP duyệt; dịch vụ ngoài app bắt buộc ghi chú.
- Bước 3 `khauTru.js`, `chot.js`, `excel.js` + `api/admin/luong/chot`: BHXH 10,5% + KPCĐ 0,5% ×
  lương đóng BHXH + Đoàn phí 40.000 (chỉ người tick tham gia BHXH). **Thuế TNCN** (`thueTncn.js`, từ 20/10/2026): có BHXH → lũy tiến 5 bậc sau
  giảm trừ 15,5tr + 6,2tr/người phụ thuộc + BHXH; thử việc/học việc → 10% tổng thu nhập (cố ý không áp mốc
  2 triệu). Công ty đóng BHXH 17,5% + BHYT 3% + BHTN 1% + KPCĐ 2% (`congTyDong`, không trừ lương) → Excel có
  sheet "Tong hop BHXH" (tổng nộp 32%). Nút 🏦 File chuyển khoản (`fileChuyenKhoan.js`, chỉ khi đã chốt) xuất đúng 12 cột mẫu ngân hàng,
  không thêm dòng lạ; mã ngân hàng nhập ở ô Lương trang nhân viên (sql/36). Chốt = chụp
  nguyên bảng lương vào `luong_bang_chot`; mở chốt bắt buộc lý do. Excel có công thức: KPI tác
  phong tự tính theo phòng; phụ cấp / điều chỉnh ngoại lệ prefill từ app, sửa trên file thì file tự tính.
- **Phòng remote không tính lương.** Nhập file máy chấm công (`mayChamCong.js`, sql/38) → bảng công nháp từ máy, NV chỉ
  Xác nhận / Báo sai; mã NV ở `staff.ma_nhan_vien` (mã trên file sẽ đổi), `staff.cham_cong_may = false` cho NV online /
  ban giám đốc. File hồ sơ lương (`fileHoSoLuong.js`) nhận người theo email. Quy đổi cột: xem lib/luong/README.md.
  Báo cáo thâm niên (`thamNien.js`, tab Báo cáo KPI, chỉ view_payroll): mốc lên cấp đọc từ MÔ TẢ cấp bậc.
- **Hoa hồng giới thiệu** (sql/39, `lib/luong/hoaHong.js`): `clients.gioi_thieu_boi/_tu` (cột "Giới thiệu" trang khách
  hàng, chỉ manage_payroll); % bậc theo số công ty đang dùng DV × tiền khách trả THÊM từ lần chốt trước (÷1,08);
  sổ `luong_hoa_hong_so` ghi khi chốt, xoá khi mở chốt; "Đã chuyển lương" = đã chi. Tab báo cáo ở Báo cáo KPI.
- Tác phong (sql/34): nhân viên TỰ KHAI số lần vi phạm cùng ngày công; người = 100 − 20 × số lần, phòng =
  trung bình; điểm KPI phòng = TB(việc, nợ, tác phong) → thưởng phòng app tự tính. Phụ cấp / điều chỉnh nhập
  trên tab Bảng lương (`luong_dieu_chinh`) trước khi chốt.
- Bước 4 `api/admin/luong/phieu` + `PhieuLuongCuaToi`: chốt → "Gửi nhân viên xác nhận"; mỗi người CHỈ thấy
  phiếu mình (máy chủ lọc theo người đăng nhập), Xác nhận / Báo sai kèm ghi chú. Mở chốt = thu hồi phiếu.
- Quyền: `cham_cong` (mọi vai trò), `view_payroll` / `manage_payroll` (chỉ Nhân viên NB, anh tự cấp
  thêm). Trưởng phòng thấy CÔNG của phòng mình nhưng KHÔNG thấy lương. **`cham_cong_toan_cty`** (sql/42, 31/10/2026,
  không gán sẵn): xem + nhập file máy + sửa công MỌI nhân viên, KHÔNG thấy lương — cho HCNS phụ trách chấm công. Luật quyền
  một chỗ: `quyenTuKhoa` (`lib/luong/api.js`), `/api/admin/khoi-dong` dùng chung. Quản trị không chấm công trừ khi đã đặt lương.
- Bộ kiểm: `node scripts/test-luong-ngay-cong.mjs`, `node --env-file=.env.local
  scripts/test-luong-thuong.mjs --that`. Dọn dữ liệu thử 1 tài khoản: `scripts/don-luong-tai-khoan-test.mjs`.
- ⏳ Chưa làm (chờ anh thử): nạp cấp bậc + lương cho toàn bộ nhân viên (anh gửi file Excel nhân sự
  gốc hoặc kế toán nội bộ tự đặt), chưa chốt tháng nào.

## Phân hệ Hóa đơn điện tử — ĐANG GÁC (13/10/2026)

Cổng hoadondientu.gdt.gov.vn **chặn** cả đăng nhập gửi từ tiện ích lẫn lượt đọc chạy trong tab đã
đăng nhập ("Hệ thống phát hiện hành vi không hợp lệ"). Muốn qua phải giả dấu nhận diện = lách lớp
chống tự động của cơ quan thuế → **không làm**. Mã thử nằm ở nhánh local `gac/hoa-don-dien-tu`
(worktree D:\savitax-bank). Hướng còn lại nếu anh mở lại: app chỉ XẾP FILE nhân viên đã tải về
(đọc XML, kiểm MST người mua, đổi tên, xếp thư mục tháng), hoặc hỏi kênh kết nối chính thức.

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
