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
- **Công ty đặc thù về công nợ** (anh chốt 01/11/2026, `sql/45`, MỘT chỗ luật `lib/ctyDacThu.js`, admin đặt ở khung
  "⚙️ Công nợ đặc thù" trong thẻ công ty — route `/api/admin/clients/dac-thu`, ghi `client_change_log`):
  - `clients.khong_vat`: thu phí KHÔNG VAT → doanh thu tính lương, hoa hồng giới thiệu, thưởng DVK KHÔNG chia 1,08; ĐNTT
    không có dòng VAT. %-thu hồi công nợ không đổi (tử và mẫu cùng gốc).
  - `clients.gia_han_thu_thang` (N, + lý do): hạn sửa công nợ + hạn chuyển nợ tồn của kỳ M lùi sang ngày 10 tháng M+1+N
    (`isPastEditDeadline` / `isPastRolloverDeadline` nhận thêm N); kỳ còn gia hạn mà CHƯA THU ĐỦ thì tạm KHÔNG tính
    %-công nợ (bỏ cả tử lẫn mẫu) ở CẢ 4 nơi: `kpiTongQuan`, `room`, `my-room` (cờ `feeCounted`/`tamBoQuaNo`), `debt-overview`.
    Chỉ phí kế toán (HCNS chưa áp). Khối dòng tiền 5 thẻ KHÔNG đổi. Đọc cột bằng truy vấn RIÊNG (`docCtyDacThu`) — thiếu
    cột thì coi như không công ty nào. Bộ kiểm: `node scripts/test-cty-dac-thu.mjs`.
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

- **Tiền hồ sơ PHÁP LÝ** (anh yêu cầu 18/11/2026, `lib/phaply/nganHang.js` + `nganHangMayChu.js`, bộ kiểm `test-phaply-ngan-hang` offline +
  `test-phaply-ngan-hang-api` trên demo): nội dung CK có mã hồ sơ (`PL261192_ThanhToan_Phidichvu_MM_YYYY` của phiếu ĐNTT pháp lý — nhận cả
  "PL 2611 92", "PL-2611-92", bị bỏ dấu) → thẻ giao dịch hiện ⚖ Pháp lý + nút "Ghi … vào công nợ pháp lý", nhóm "Cần xem". **KHÔNG tự ghi**
  tiền pháp lý, và `bankAuto` BỎ QUA giao dịch có mã pháp lý (không tự ghi / tự khớp phí kế toán). Ghép tay: nút "Hồ sơ pháp lý" ở "Ghi vào
  hồ sơ" (`?phapLyCases=1`, action `postPhapLy`). Tiền chia vào các đợt còn nợ, đợt cũ trước, mỗi đợt trừ THU HỘ trước (`phanBoVaoDot`,
  như nút Ghi thu); lịch thu chưa phủ hết phí thì phần còn lại ghi không gắn đợt; vượt phần còn phải thu thì chặn. Phần ghi `kind: 'phap_ly'`
  trong `post_detail.parts` (giữ `paymentIds`). ⚠ Trưởng phòng pháp lý xoá khoản thu ở tab Công nợ thì giao dịch NH vẫn "Đã ghi" — chưa
  nối hai chiều. Bản clone không có phân hệ Pháp lý → bỏ luôn 2 file `lib/phaply/nganHang*.js` và các dòng pháp lý trong route + page /bank.
- **TỰ GHI có điều kiện** (anh duyệt 01/11/2026, `lib/bankAuto.js`, công tắc `TU_GHI_CONG_NO`): chạy khi VPS đẩy giao
  dịch mới và khi mở trang /bank. CHỈ tự ghi lệnh "Sẵn sàng" nhận bằng MÃ KH / MST của công ty NỢ TỒN = 0đ, đề xuất không có
  dòng nợ tồn (dùng đúng `executePlan`, `posted_by` trống, `post_detail.tuDong`). Khoản "Đã khớp sổ" (nhân viên đã ghi tay —
  kể cả ghi tay vào Nợ tồn cũ đúng số tiền, −1..+7 ngày quanh lúc tiền về) thì TỰ KHOÁ (state `ignored`, ghi chú "Tự khớp
  sổ"). Còn lại (nợ tồn > 0, nhận theo tên, thiếu / thừa…) vẫn chờ người bấm.
- Trước 01/11/2026: không có gì tự ghi công nợ. VPS chỉ đẩy giao dịch vào bảng `bank_transactions` qua
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
  `NĂM_2026`; chưa có mới tạo `Năm <năm>`. Quy ước lưu file cho nhân viên: `docs/quy-uoc-luu-ho-so.md` — **chuẩn duy nhất
  là cây ISO SVT.MB09** (anh chốt 08/11/2026, bản gốc ở ổ G: `…\5.7.2.2 MẪU BIỄU ISO v2\SVT.MB09. CAY THU MUC\`): 11 thư mục
  trong năm (không có `12. HÌNH ẢNH` — kiểm kê bỏ dòng này khi thiếu), kỳ báo cáo `7. BỘ BÁO CÁO\1. BỘ BCT QUÝ_THÁNG\BCT-Q1`
  (Tờ khai vẫn tải về `BAOCAOTHUE_…`, app đọc cả hai), hóa đơn `QUÝ n\HĐ MUA VÀO|HĐ BÁN RA` (khai tháng: `THÁNG 01…12`, để
  `QUÝ n` thì hóa đơn bị gán cả 3 tháng). Thư mục năm trong cây mẫu tên giữ chỗ `NĂM TÀI CHÍNH` — app KHÔNG nhận, phải đổi.
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
  đổi khoá đệm (`'bangke8|'` ở `docHoSo.js`) — không thì máy nhân viên dùng kết quả đọc cũ.
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
- **Tra cứu tình trạng MST** (tab 🔎 của Rủi ro thuế, tên cũ "Tra cứu NCC", `app/ruirothue/tra-cuu-ncc`, lõi `lib/phanTich/traNcc.js`, anh duyệt 19/11/2026): hóa đơn
  mua vào (bảng kê mục 2 của thư mục, không có thì mục 7; hoặc file tải lên) → gom MST người bán → trạng thái MST + CQT quản lý,
  xuất Excel. HAI nguồn: **VietQR** tra hàng loạt (trình duyệt gọi thẳng, không mã xác nhận, dữ liệu Cục Thuế trễ 1–2 tuần, KHÔNG
  có CQT; chạy cả bản rời; ⚠ tra liền ~20 MST là bị khoá ~10 phút — 429 không có header CORS nên trình duyệt thấy như mất mạng →
  trang tự chờ rồi tra tiếp, nhịp 3,5 giây/MST) và **tracuunnt.gdt.gov.vn** "Tra chính xác" qua tiện ích **1.3** — NHÂN VIÊN TỰ GÕ mã xác nhận, app
  không đọc mã. ⛔ Đã loại, đừng thử lại: masothue.com (Cloudflare chặn mọi lượt không phải người — tra tự động = vượt lớp chặn),
  `hoadondientu…:30000/category/public/dsdkts` của file Excel cũ (cổng 30000 đã đóng, VPS cũng "Connection refused" 19/11).
  Kết quả nhớ trên máy (khoMay, khoá `ncc1|vietqr|` / `ncc1|gdt|`), KHÔNG lên Supabase. Bộ đọc trang kết quả tracuunnt (`docKetQuaTcnnt`, nhận
  theo hàng tiêu đề) đã chạy đúng trên trang thật 21/11/2026. Tick nhiều MST → gõ mã lần lượt; link masothue đã bỏ (anh 21/11). Bộ kiểm: `node scripts/test-tra-ncc.mjs`.
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
  sổ `luong_hoa_hong_so` ghi khi chốt, xoá khi mở chốt; "Đã chuyển lương" = đã chi. Tab báo cáo ở Báo cáo KPI. Bậc theo chính sách "Lợi ích hợp tác" (sql/46, 01/11/2026): số khách HOẶC doanh số (tổng phí hằng tháng chưa VAT, KT + HCNS, quý ÷ 3, chỉ công ty đang dùng DV) — điều kiện nào đến trước, lấy % cao hơn (`tyLeTheoBac`); trên bậc cao nhất giữ 20%.
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

## Mẫu nhắc khách gửi chứng từ (`/nhac-chung-tu`) + Zalo Bot (đang gác)

Anh chốt 26/11/2026. Trang KHÔNG ở menu trái — mở từ Checklist: nút "📣 Mẫu nhắc chứng từ" đầu trang và nút "📣 Mẫu" cạnh việc
"Gửi thông báo cung cấp chứng từ tháng M" (truyền `?nam=&thang=` = tháng chứng từ = tháng trước của checklist). App dựng ẢNH
thông báo 1080×1350 (`components/AnhThongBaoChungTu.js`, bản khai quý / khai tháng, chụp bằng `html2canvas` trên trình duyệt) +
LỜI NHẮN (`lib/nhacChungTu.js`, sửa được, nhớ ở localStorage) → nhân viên Chép ảnh (Ctrl+V vào Zalo PC) / Tải ảnh / Chép lời
nhắn rồi TỰ TICK Checklist. Không gọi máy chủ, không lưu gì. Kiểm: `node scripts/test-nhac-chung-tu.mjs`.

- ⚠ Zalo hiện MỖI lần xuống dòng thành một khoảng cách lớn → lời nhắn tự bỏ dòng trống (`dienLoiNhan`).
- ⚠ html2canvas vẽ khác trình duyệt: `inline-flex` mất nội dung, `boxShadow` thành lớp phủ xám, chữ trong ô flex lệch xuống →
  khung ảnh dùng `flex` có kích thước cố định, viền thay bóng, số trong vòng tròn căn bằng `lineHeight`.
- **Zalo Bot ĐANG GÁC** (gỡ khỏi main 26/11, chờ Zalo ra gói Pro): bot chính thức (bot.zapps.me) trong nhóm CHỈ nhận tin có
  nhắc tên bot; gói miễn phí 3 bot × **3 nhóm**, 50 người dùng, 3.000 tin/tháng; Pro 129.000 đ/tháng "sắp ra mắt"; nhóm OA
  25–50k/nhóm/tháng — anh chê đắt. Code bot tự đăng ảnh vào nhóm khách + gắn nhóm ↔ công ty nằm ở nhánh local
  `thu/zalo-bot-gui-nhom` (20e48c1). Trên Supabase còn bảng `zalo_tin_nhan` (sql/62) và `zalo_nhom` / `zalo_mau_anh` /
  `zalo_gui` + bucket `zalo-mau` (sql/63, chỉ ở nhánh đó) — để nguyên, không mã nào dùng. Bot "Bot Kế Toán Savitax" khác
  "Bot Savitax" của phòng KD (chỉ gửi form website, đừng đụng).

## Báo cáo khách hàng (tab "📊 Báo cáo KH" trên thẻ công ty)

Anh chốt 28/11/2026: sheet "5. BC Tháng_Quý" của SVT.MB07 (báo cáo tình hình kinh doanh gửi khách, ngày 25 / 15–20) nhập
TRÊN APP. Tab trong `ClientChecklist` + nút "📊 Lập BC" cạnh việc "Gửi BCT… / Gửi báo cáo thuế…" (kỳ suy từ tên việc,
`kyTuTenViec`). Nhân viên TỰ TICK Checklist. Kế hoạch các đợt sau (tự điền từ thư mục, sheet 6 so sánh, sheet 7 thực trạng):
`docs/bao-cao-khach-hang-ke-hoach.md`.

- Bảng `bao_cao_khach` (sql/64, RLS bật không policy): một dòng mỗi (công ty, kỳ `T11.2026` / `Q4.2026` / `NAM.2025`),
  `so_lieu` jsonb — máy chủ `chuanHoa` lại, không tin số trình duyệt gửi. Phạm vi = `canAccessCredentials` (NV chính/phụ, TP
  phòng đó, quản trị). Route `app/api/admin/bao-cao-kh`.
- Hàm thuần `lib/baoCaoKh.js`: dòng 7 = bán ra − mua vào − đầu kỳ, in bằng CHỮ "phải nộp" / "còn được khấu trừ" (không dấu
  âm); hạn nộp lấy `tax_obligations` (01/GTGT, 01/CNKD; năm: 03/TNDN) rồi mới tự tính; đầu kỳ gợi ý = phần còn khấu trừ kỳ
  trước. Dòng tùy chọn (1.2, 1.3, 8.x, 9–14) để trống HOẶC bằng 0 không in lên ảnh (anh chốt 28/11). Kiểm: `node scripts/test-bao-cao-kh.mjs`.
- Ảnh `components/AnhBaoCaoKH.js` (1080px, Times New Roman, màu thương hiệu, chụp html2canvas — cùng lưu ý với mẫu nhắc chứng từ). ⚠ Ô bo tròn có chữ (Thời gian) PHẢI là `<img>` SVG data-URL: html2canvas làm lệch chữ Times trong inline-block và BỎ QUA thẻ `<svg>` đặt tuyệt đối. "Lưu + ảnh
  vào Tài liệu" (gắn luôn vào nút Chép ảnh / Tải ảnh — anh yêu cầu 28/11, khỏi bấm 2 lần; số liệu không đổi thì không tải ảnh trùng) tải PNG vào bucket `client-files` (key base64url) tên `BCKD_<kỳ>_<MÃ KH>_<YYYYMMDD-HHmm>.png`; mỗi lần lưu
  một file mới, `file_path` giữ ảnh mới nhất. Lời nhắn Zalo bỏ dòng trống.


## Phân hệ Pháp lý (`/phaply`) — ĐANG LÀM trên nhánh `feat/phap-ly`, CHƯA lên app

Kế hoạch: `docs/phan-he-phap-ly-ke-hoach.md` (7 giai đoạn). **Anh dặn 01/11/2026: toàn bộ phân hệ CHƯA đưa lên app** cho tới khi anh
duyệt bản hoàn chỉnh — không push, không chạy SQL production. Làm trong worktree `D:\savitax-pl` (đã bỏ upstream). Thử trên DATABASE
DEMO: `node --env-file=.env.local scripts/phaply-chuan-bi-demo.mjs [--mau]` (chạy sql/56 + sql/57 + mẫu mặc định + hồ sơ giả; demo bị làm
mới mỗi đêm nên chạy lại mỗi lần), máy chủ thử `pl-dev` cổng 3010. **KHÔNG đưa vào bản clone** (bỏ `sql/56`, `sql/57`, `app/phaply`,
`app/api/admin/phaply`, `lib/phaply`, `templates/phaply`, `data/phaply`, mục menu "Pháp lý" trong Sidebar).

- GĐ 1 (17/11/2026, `sql/56_phap_ly_ho_so.sql`): hồ sơ `legal_cases` mã `PL-YYMM-NN` (giờ VN), 10 bước + trạng thái chờ tách riêng, checklist
  theo thủ tục (mẫu xoá MỀM), hạn nội bộ bỏ chủ nhật, nhật ký, ghi chú; tiền TÁCH phí dịch vụ / thu hộ, thu theo ĐỢT (đến hạn khi sang bước
  hoặc theo ngày), sổ thu ghi nối tiếp xoá mềm có lý do; ĐNTT riêng (`ho-so/[id]/dntt`) — chỉ phí dịch vụ chịu VAT, thu hộ KHÔNG.
- **Bảng `legal_*` bật RLS KHÔNG policy** (chỉ service_role) — cố ý khác sql/06, vì sẽ giữ CCCD. Mọi đọc ghi qua `app/api/admin/phaply/**`.
- Quyền nhóm "Phòng Pháp lý" (`lib/phaply/quyen.js` + luật thuần `phamVi.js`): nhân viên thấy hồ sơ mình + chưa ai nhận; trưởng phòng
  (`view_phaply_all_staff`) cả phòng; `close_phaply_case` đóng còn nợ / mở lại / xoá khoản thu / sửa phí sau khi đã thu.
- Tiền (`lib/phaply/tien.js`, hàm thuần): **doanh số = phần dịch vụ ĐÃ THU theo tháng paid_at**, tính cho người phụ trách LÚC THU; khách trả
  thiếu → trừ THU HỘ trước; dòng tiền: đợt phát sinh ở tháng đến hạn, trả TRƯỚC hạn thì phát sinh ngay tháng trả (đã thu = tiền thật về).
  Đợt "khi nhận" (bước 1) đến hạn = ngày nhận, không phải ngày chuyển bước đầu (lỗi đã vá).
- Bộ kiểm: `node scripts/test-phaply-tien.mjs` (offline) · `node --env-file=.env.local scripts/test-phaply-api.mjs` (demo + máy chủ thử;
  CHỈ cấp phiên cho tài khoản đăng nhập ĐÃ CÓ — `generateLink` với email chưa có sẽ TẠO tài khoản mới) · `node scripts/test-phaply-word.mjs`.
- Mẫu Word thành lập mới (19 mẫu, pháp lý đã chốt 17/11): `templates/phaply/word/README.md`, từ điển trường DUY NHẤT `lib/phaply/word/duLieu.js`.
- **Bộ biểu mẫu mới 25/11/2026** (phòng gửi `PHONGPHAPLY_BIEUMAU`: Điều lệ bổ sung, hộ kinh doanh, đơn vị phụ thuộc, tạm ngừng / hoạt động lại,
  giải thể, thay đổi). **Biến thể thủ tục** = `bienThe(procedure_code, entity_type)` (`lib/phaply/boHoSo.js`: `tlm_hkd`, `tlm_dvpt`, `giai_the_dvpt`…)
  → MỘT bảng `BO` "thủ tục nào có những bộ nào" (giải thể: so1 / thue / so2) — xuất Word / PDF / Drive / trình ký / còn thiếu / hướng dẫn in
  ký đều đọc từ đó, đừng viết cứng `['so','thue']`. **Hồ sơ đơn vị phụ thuộc gắn CÔNG TY MẸ** (entity_id = công ty mẹ): mẫu chọn theo loại
  hình công ty mẹ (`loaiHinhMau`), lọc thêm theo loại đơn vị (`donVi` ở danh mục). Danh mục mẫu: `danhMuc.js` (TLM) + mỗi nhóm thủ tục MỘT
  file `lib/phaply/word/mauThuTuc/<nhóm>.js` (mẫu + ô thông tin + lưu ý in ký) và MỘT file dữ liệu giả `scripts/phaply-du-lieu-gia/<nhóm>.mjs`.
  Mục danh mục: `thuTuc` (biến thể), `dieuKien(duLieu)` (tờ chỉ có khi đúng trường hợp — VD cam kết "không phát sinh…"), `thayBang`
  (đổi sang mẫu thay thế — Điều lệ 1TV chủ sở hữu là tổ chức), `an` (chỉ để thay thế), `duLieuThu` (bộ dữ liệu giả cho bộ kiểm — BẮT BUỘC
  với mẫu ngoài TLM). Số thứ tự file đánh theo bộ SAU khi lọc `dieuKien`.
- **Thông tin thủ tục** (`legal_cases.thong_tin` jsonb, sql/61): khuôn ô khai MỘT chỗ (`lib/phaply/thongTin.js` + `thongTin` của file nhóm)
  → tab "Thông tin thủ tục" tự dựng form, máy chủ `locThongTin` khi lưu (PATCH phap-nhan `action: 'thong_tin'`), mẫu nhận `{tt_<ô>}`
  (sinh cho MỌI ô của thủ tục, kể cả ô `chi` loại đơn vị khác — thẻ rỗng), ô `bat_buoc` vào "Còn thiếu". Không cần cột DB mới cho ô mới.
  Cột sẵn của hồ sơ vào mẫu: tạm ngừng từ/đến, hoạt động lại từ → `{tn_tu}` `{tn_den}` `{hdl_tu}` (+ `_ngay/_thang/_nam`); nội dung thay
  đổi (`noi_dung_thay_doi`, `lib/phaply/nhom.js`) → cờ `{#td_tang_von}`…
- Người là TỔ CHỨC (`legal_people.la_to_chuc`, sql/61) làm chủ sở hữu / thành viên / cổ đông + **người đại diện theo ủy quyền**
  (`dai_dien_uy_quyen`, `cua_person_id` = tổ chức nào); nhiều người đại diện theo pháp luật (`ds_dai_dien`, `quyen_han` in vào Điều lệ).
  Mẫu 6/7 tách phần I cá nhân / phần II tổ chức (`thanh_vien_cn/_tc`, `co_dong_cn/_tc`, `uq_tv`).
- Bộ kiểm Word: thẻ nằm trong danh sách RỖNG ở một bộ dữ liệu giả được soi bằng bộ khác; thẻ không bộ nào soi tới = lỗi.
- GĐ 2 (17/11/2026, `sql/57_phap_ly_phap_nhan.sql`): doanh nghiệp (cột thêm vào `legal_entities`), người `legal_people` (cả hồ sơ cá nhân
  của nhân viên pháp lý: `staff_id`, trang `/phaply/toi` → người được ủy quyền ở Giấy ủy quyền nộp sở = người PHỤ TRÁCH hồ sơ), vai trò
  `legal_entity_people` (một người nhiều vai trò = nhiều dòng; Chủ tịch HĐTV/HĐQT chỉ một), ngành `legal_entity_industries`.
  **DB → mẫu Word đi qua MỘT hàm thuần `hoSoDauVao` (`lib/phaply/phapNhan.js`)** — đổi cột thì sửa ở đó; `conThieu` = "Còn thiếu gì"
  (không chặn xuất: ô thiếu in "…………"). Bộ kiểm khứ hồi `node scripts/test-phaply-phap-nhan.mjs`: dữ liệu giả của bộ kiểm Word tách thành
  dòng DB rồi dựng lại phải ra GIỐNG HỆT mọi thẻ. API + xuất Word: `node --env-file=.env.local scripts/test-phaply-phap-nhan-api.mjs`.
- Danh mục (`legal_places` 34 tỉnh + 3.321 xã, `legal_registries` Phòng ĐKKD, `legal_tax_offices` + `legal_place_tax` xã → Thuế cơ sở,
  `legal_vsic`) nạp từ `data/phaply/danh-muc` bằng `scripts/phaply-nap-danh-muc.mjs [--ghi] [--vsic]`. Phòng ĐKKD / cơ quan thuế lưu ở
  doanh nghiệp CHỈ khi gõ tay; để trống = gợi ý theo địa chỉ trụ sở lúc xuất. Ngành kinh tế theo **QĐ 36/2025/QĐ-TTg** (hiệu lực 15/11/2025,
  495 mã cấp 4) — ~24 mã cũ được DÙNG LẠI với nghĩa khác (4661–4663, 4762…, xem `data/phaply/danh-muc/nganh/NGUON.md`), chép mã từ hồ sơ cũ
  là đăng ký sai ngành.
- Xuất Word `ho-so/[id]/word?dot=so|thue[&ma=]` đọc `templates/phaply/word/*.docx` bằng readFileSync → **phải có trong
  `outputFileTracingIncludes`** (next.config.mjs), thiếu là Vercel báo không thấy file. Dựng bộ ở MỘT hàm `lib/phaply/xuatBo.js`
  (nút tải về và nút lưu Drive ra file giống hệt).
- **CCCD** (GĐ 2b, 17/11/2026): trình duyệt thu nhỏ ảnh (cạnh 1800px — Vercel nhận tối đa 4,5 MB/lượt) → `ho-so/[id]/cccd` lưu bucket
  PRIVATE `phaply-cccd/<case_id>/<uuid>-<mặt>.jpg` SONG SONG với đọc (đọc lỗi không mất ảnh) → Claude `claude-sonnet-5-5` effort thấp, structured outputs
  (anh chọn 17/11/2026 sau khi đo 24 lượt thẻ giả: Opus vừa ~11 giây, Sonnet ~4 giây, cùng đúng 6/6; Haiku đọc sai MRZ 1/6 — đổi model phải đo lại)
  (`lib/phaply/cccdDoc.js`, khoá `ANTHROPIC_API_KEY` MỚI — khoá bản thử đã lộ) → `lib/phaply/cccd.js` chuẩn hoá + kiểm chéo (12 số, chữ số 4 =
  thế kỷ + giới tính, số 5–6 = năm sinh, MRZ mặt sau có chữ số kiểm tra ICAO) → lệch thì tô vàng, KHÔNG tự sửa. Địa chỉ trên thẻ cũ (quận/huyện)
  không khớp danh mục → giữ nguyên văn, bắt chọn lại. Ảnh gốc: link ký 5 phút, cần `view_phaply_cccd_image`. Người chỉ nhận đường dẫn ảnh nằm
  trong thư mục của CHÍNH hồ sơ. **Bản demo**: anh cho mở 17/11/2026 nhưng CHỈ tài khoản vai trò phòng pháp lý (phaply / phaply_leader) tải +
  xem ảnh (Giám đốc demo — tài khoản khách hay dùng — bị chặn), và lần làm mới mỗi đêm XOÁ SẠCH kho phaply-cccd demo. Kiểm `test-phaply-cccd`.
- **Drive** (anh duyệt 17/11/2026, lưu CẢ ảnh CCCD): Shared drive "7. SAVITAX - PHÁP LÝ DENALI", gốc theo thủ tục ở biến môi trường
  (`PHAPLY_DRIVE_TLM` = thư mục "3. HỒ SƠ THÀNH LẬP", id `1GfnVapMRGmPKPaCooq4FLFXtxHOPshjt`, đã chia sẻ cho service account). Cây
  `<gốc>/<PL-… - TÊN CTY>/{8 thư mục THU_MUC ở lib/phaply/drive.js}`; id thư mục lưu `legal_cases.drive_folder_id`; ghi đè file cùng tên.
  Demo KHÔNG đặt biến → không lưu Drive. Thử thật: `test-phaply-drive` (hồ sơ giả, bỏ thùng rác thư mục thử).
- **Hạn lưu ảnh CCCD**: cron hằng ngày `api/cron/phaply-xoa-cccd` xoá ảnh trong kho `phaply-cccd` của hồ sơ đóng quá 24 tháng (pháp nhân còn hồ sơ
  đang làm thì chưa xoá), giữ số liệu. **Bản trên Drive GIỮ NGUYÊN** (anh dặn 17/11/2026) — đừng thêm bước xoá Drive. Kiểm `test-phaply-han-luu [--that]`.
- **GĐ 4** (17/11/2026, `sql/58_phap_ly_nop_ket_qua.sql`), tab "Trình ký & nộp" (`app/phaply/ho-so/[id]/_nop.js`, route `ho-so/[id]/nop`, `/tep`):
  trình ký từng tờ (`legal_case_signing`, mã mẫu theo danhMuc), mỗi LẦN nộp một dòng `legal_case_submissions` (nộp lại sau bổ sung = dòng mới)
  → **trạng thái chờ của hồ sơ TỰ đặt theo lần nộp mới nhất** (`choTheoNop`: chờ → Chờ Sở/Thuế, bổ sung → Cần bổ sung, đạt → bỏ chờ);
  kết quả GCN ghi mã số vào `legal_entities.tax_code` + ngày/nơi cấp; tệp scan (≤ 4 MB) tải THẲNG lên Drive đúng thư mục bước
  (`legal_case_files` chỉ là chỉ mục; xoá = thùng rác Drive). Thư mục hồ sơ dùng chung `lib/phaply/driveMayChu.js`. Kiểm `test-phaply-nop [--that]`.
- **Bàn giao + đóng hồ sơ** (17/11/2026, `sql/59`): danh mục bàn giao lưu jsonb trên hồ sơ (`ban_giao_*`), in **Biên bản bàn giao** (mẫu `BBBG`,
  app tự soạn — CHỜ pháp lý duyệt câu chữ; bên giao = `BEN_GIAO` ở `lib/phaply/banGiao.js`, đang theo ĐNTT: CTCP Tư vấn Thuế Savitax).
  **Đóng hồ sơ phải đủ điều kiện** (`dieuKienDong`): thu đủ tiền · có một lần nộp "Đạt" · đã ghi ngày bàn giao · có scan trong 8. BÀN GIAO
  (chỉ khi thủ tục có Drive). Thiếu: nhân viên 409; `close_phaply_case` đóng được kèm lý do. Máy chủ xét lại ở PATCH dong (cả khi chuyển
  thẳng sang bước 10). Kiểm `test-phaply-ban-giao [--that]`.
- **PDF** (GĐ 3, 17/11/2026 — anh chọn DÙNG CHUNG VPS ngân hàng 103.126.161.187, khuyên nâng gói CheapSSD 2 cho dư): LibreOffice 7.3 headless
  + dịch vụ `vps/phaply-pdf/pdf_server.py` (systemd `phaply-pdf`, tài khoản `phaplypdf`, MemoryMax 700M, CPUQuota 90%, Nice 10, IO idle — cron
  ngân hàng luôn được ưu tiên; đã thêm swap 2 GB). Cổng **8443 HTTPS chứng chỉ TỰ KÝ** gắn IP; app GHIM chứng chỉ (`PHAPLY_PDF_CA`) + khoá
  `PHAPLY_PDF_SECRET` + `PHAPLY_PDF_URL` — xem trên VPS: `/etc/phaply-pdf/{env,cert.pem}`. Một lượt gửi .zip nhiều .docx → .zip PDF (một lần chạy
  LibreOffice cho cả bộ, ~3,4 giây/5 mẫu, RAM đỉnh ~210 MB). Log CHỈ ghi số file + thời gian. Phông: Times New Roman → Liberation Serif (cùng
  kích thước), Segoe UI Symbol → DejaVu; bản in khớp Word (đường chấm, ô ☐☒, số trang) — Google Drive làm MẤT đường chấm, đừng dùng.
  App: `lib/phaply/pdf.js` (doiPdf, gopPdf), route `ho-so/[id]/pdf` (cả bộ = từng PDF + "00. Bo trinh ky (gop).pdf"), nút Lưu Drive kèm PDF.
  PDF lỗi không chặn Word. Kiểm `node --env-file=.env.local scripts/test-phaply-pdf.mjs [--that]`.
- **GĐ 6** (17/11/2026): báo cáo thêm tab **Theo hồ sơ** + **Hồ sơ treo** + đếm hồ sơ mới/xong/đang làm theo nhân viên (`lib/phaply/baoCao.js`,
  route bao-cao, Excel 4 sheet). Bộ kiểm `test-phaply-bao-cao [--that]` chạy 3 BẤT BIẾN trên kết quả API thật. Hướng dẫn nhân viên
  `docs/huong-dan-phan-he-phap-ly.md` = trang `/phaply/huong-dan` (TrangTaiLieu) + `.docx` dựng bằng `node scripts/phaply-huong-dan-docx.mjs`
  (Word trên máy; mỗi Phần sang trang mới). Sửa giao diện thì sửa cả tài liệu.
- Mẫu Word: **KHÔNG ép sang trang, KHÔNG đánh số trang ở bất kỳ file nào** (pháp lý chốt 25/11/2026 — trước đó Chương II+ của Điều lệ
  2TV/CP sang trang mới bằng `#p`, Mẫu 2/3/4 có số trang). Mã `#p` vẫn còn trong khung.js nhưng mẫu không dùng. Lịch sử: 17/11 — **TRỪ Điều lệ 1TV** (chương ngắn, sang trang thành nhiều nửa trang trắng — pháp lý báo "ngắt trang bừa bãi" 18/11): 1TV chạy
  liền như bản phòng nộp, tên chương + tiêu đề Điều luôn giữ cùng trang với đoạn sau (`#cbk` / `#bk`).
- **Chuẩn trình bày mẫu Word** (pháp lý góp ý 18/11/2026, bộ kiểm `node scripts/test-phaply-word-chuan.mjs`): Times New Roman **12** (trừ
  bảng ngang 14–19 cột Mẫu 6/7/10); Điều lệ KHÔNG đánh số trang; `~` đơn = khoảng 6pt, `~~`/nhiều `~` liền = dòng trống đủ cao (chỗ ký) — trước
  đây mỗi `~` là dòng 17pt nên mẫu thưa; đầu trang 2 cột chia 2 hàng bằng `==` để "Số: …" và "…, ngày … tháng … năm …" thẳng hàng; tỷ lệ góp
  vốn / sở hữu **3 chữ số thập phân, dấu phẩy** (66,667% — `inTyLe`, so ngưỡng hưởng lợi bằng SỐ `ty_le_so`, đừng parseFloat chuỗi có
  dấu phẩy); loại giấy tờ trong lời văn QĐ / BB bổ nhiệm lấy theo người (`*_giay_to_so`: "Thẻ Căn cước số", "Hộ chiếu số"…); Mẫu 2/3/4 mục
  "Địa chỉ nhận thông báo thuế" in sẵn điện thoại / fax / email công ty nếu có; tờ **Hướng dẫn in + ký** có cột họ tên người ký (`kyBoi` ở
  danhMuc.js), tải riêng `?ma=HUONG_DAN` (Word / PDF) + khung trên tab "Còn thiếu & xuất Word", PDF của nó KHÔNG gộp vào bộ trình ký.
  PDF đổi ở VPS: đã cài `ttf-mscorefonts-installer` (anh cho đồng ý EULA 18/11/2026) → PDF nhúng đúng Times New Roman; dựng VPS mới
  phải cài lại gói này, thiếu thì LibreOffice lặng lẽ thay bằng Liberation Serif (pháp lý nhận ra ngay vì khác nét).
- **Mỗi nhóm thủ tục một trang** (anh yêu cầu 17/11/2026, `sql/60`, `lib/phaply/nhom.js`): /phaply/thanh-lap · thay-doi · tam-ngung · giai-the · khac
  (+ /phaply = tất cả), cùng khuôn `app/phaply/_danhSach.js`, API `ho-so?nhom=`. Thủ tục trên công ty ĐÃ CÓ → chọn công ty (`api/admin/phaply/
  doanh-nghiep`: pháp nhân trong phạm vi + khách kế toán) → **dùng LẠI legal_entities** (doanh nghiệp, người, CCCD, ngành nghề chung);
  `case_goc_id` nối hồ sơ tiếp theo. **Tạm ngừng**: `tam_ngung_tu/den` (tối đa 1 năm), theo dõi CẢ hồ sơ đã đóng, cảnh báo còn 30 / 7 ngày, có hồ
  sơ tiếp theo (hoạt động lại / gia hạn / giải thể) = đã xử lý; nhắc khách được cả khi hồ sơ đã đóng. Dải cảnh báo hiện ở MỌI trang nhóm.
  Kiểm `test-phaply-nhom [--that]`. Hạn thông báo = 3 ngày làm việc (T2–T6, CHƯA trừ ngày lễ).

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

## Bản demo (`demo.savitax.vn`) — nhánh `demo`, KHÔNG gộp vào `main`

Bản trải nghiệm gửi khách xem trước khi triển khai (anh duyệt 01/11/2026, kế hoạch `docs/demo-app-ke-hoach.md`). Cùng repo,
nhánh `demo` (Vercel project riêng, production branch = `demo`, vùng `hnd1` vì Supabase demo ở Tokyo), Supabase project RIÊNG
toàn dữ liệu giả. Code **cố định một bản**: đẩy `main` không đổi demo; muốn cập nhật thì gộp `main` → `demo` khi anh bảo.

- ⚠ **Chốt an toàn 3 lớp** trước mọi lệnh xoá / nạp: `NEXT_PUBLIC_DEMO_MODE=1`, URL Supabase KHÔNG phải `ykorxlkgsmzskdybebzg`
  (`lib/demo/canh.js`), và hàm SQL `demo_xoa_sach()` tự kiểm bảng đánh dấu `demo_la_ban_demo` chỉ DB demo có (`sql/demo/`).
- **Làm mới mỗi đêm** 2h VN: `/api/cron/demo-reset` → `lib/demo/datLai.js`: tài khoản demo (6 vai trò, `@demo.savitax.vn`,
  mật khẩu `DEMO_PASSWORD`, chỉ đặt lại khi bị đổi) → xoá sạch → nạp `lib/demo/sinhDuLieu.js` (sinh theo NGÀY HÔM NAY, hạt giống
  cố định) → phần suy ra đi qua đúng hàm app: `ensureRollovers`, `applyOldDebtPayment`, `nghiaVuDinhKy`, `tinhBangLuong`.
  Tay: `node --env-file=.env.local scripts/demo/lam-moi.mjs` (trong thư mục `D:\savitax-demo`).
- Cấu trúc DB: `scripts/demo/dung-csdl.mjs` chạy các file `sql/` (+ ràng buộc production tạo tay không có file), `--so <defs>`
  so cột với production. Danh mục cấu hình (vai trò, quyền, checklist mẫu…) chụp từ production: `scripts/demo/chup-cau-hinh.mjs`
  → `lib/demo/cauHinh.js` — CHỈ bảng cấu hình, không khách / nhân viên / tiền.
- **Phân hệ Pháp lý trên demo** (anh cho đưa lên 17/11/2026 để phòng pháp lý thử, production CHƯA có): ảnh chụp cấu hình không có
  quyền Pháp lý nên `lib/demo/phapLy.js` (gọi cuối `datLaiDemo`) nạp lại 7 quyền + gán 2 vai trò pháp lý, checklist + lịch thu mặc
  định và 4 hồ sơ GIẢ mỗi đêm. Bảng `legal_*` do `sql/56` tạo (dung-csdl chạy được); chưa có bảng thì bước này tự bỏ qua.
  GĐ 2 (`sql/57`): hồ sơ mẫu đầu tiên (1TV) có sẵn doanh nghiệp + người + ngành, trưởng phòng có thông tin cá nhân → xuất Word thử được ngay.
  **Danh mục tĩnh** (`legal_places`, `legal_tax_offices`, `legal_place_tax`, `legal_registries`, `legal_vsic`) nạp MỘT lần bằng
  `scripts/phaply-nap-danh-muc.mjs --ghi` và `demo_xoa_sach()` (sql/demo/90) cố ý KHÔNG xoá chúng mỗi đêm.
- Tắt nối ra ngoài khi `DEMO_MODE`: cổng thuế (`lib/portalBridge.js`), webhook ngân hàng + mail, backup, Google Drive (không đặt
  biến môi trường), đổi mật khẩu / email tài khoản demo. Sửa sinh dữ liệu xong PHẢI chạy lại 4 bộ kiểm dòng tiền trên DB demo.
- **Bộ hồ sơ mẫu** Soát xét / Rủi ro thuế: `scripts/demo/sinh-ho-so-mau.mjs` → `public/demo/ho-so-mau.zip` (nút tải ở
  `ThanhCongTy` khi DEMO_MODE). Công ty CÁT TƯỜNG VIỆT (khai THÁNG — ép trong sinhDuLieu `stt === 2`): 2025 chép bộ mẫu ruiro-mau
  đổi MST, 2026 T01–T09 sinh mới, cài sẵn lỗi T03 / T04 / T06 / T08. Đổi MST / tên công ty demo thì sinh lại file nén.
  Kiểm: `--thu-muc <nơi giải nén>` rồi chạy `soat-thu-muc-that`, `soat-ruiro-thu-muc-that`, `soat-soatbaocao-thu-muc-that`.
- **Trang tài liệu** (Quy ước lưu hồ sơ, Hướng dẫn dùng Tờ khai — `components/TrangTaiLieu.js`): docs lấy mã KH / MST / tên NV THẬT
  làm ví dụ → bản demo thay qua `lamSachTaiLieu` (`lib/demo/canh.js`) và ẩn ảnh chụp màn hình (route ảnh trả 404). Gộp main → demo
  mà tài liệu có ví dụ thật mới thì bổ sung bảng thay trước khi đẩy.
