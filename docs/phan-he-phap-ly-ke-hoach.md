# Kế hoạch phân hệ "Phòng Pháp lý" (`/phaply`) — app.savitax.vn

> Bản kế hoạch để anh duyệt TRƯỚC khi viết code (quy trình B1). Soạn 31/10/2026.
> Chưa đụng vào code / SQL / production. Mọi con số về mẫu biểu lấy từ thư mục `D:\savitax-phaply\Mau-Phap-Ly`.

## 0. Tóm tắt một trang

- **Làm gì**: một phân hệ mới, tách biệt trong app.savitax.vn (phân khu menu riêng "PHÁP LÝ" ngay dưới HCNS – BHXH), phục vụ trọn vòng đời
  pháp lý của doanh nghiệp: thành lập → thay đổi → tạm ngưng/hoạt động lại → giải thể (kể cả Hộ kinh doanh).
- **Chuỗi nghiệp vụ trong một hồ sơ**: Tiếp nhận → Thu thập (up CCCD, tự điền) → Báo giá / ĐNTT / công nợ →
  Soạn hồ sơ (xuất **Word + PDF**) → In & trình ký → Nộp Sở → Nhận kết quả (kể cả sửa đổi bổ sung) → Hồ sơ thuế →
  Bàn giao → Đóng hồ sơ & lưu trữ.
- **Hai vai trò**: Nhân viên pháp lý, Trưởng phòng pháp lý. Báo cáo tháng/quý/năm: từng hồ sơ, doanh số phòng,
  doanh số nhân viên, công nợ (tồn đầu kỳ – thu trong kỳ – chuyển kỳ sau).
- **Khác bản thử `phaply.savitax.vn`**: bản thử chứng minh được 3 việc (điền Excel, đọc CCCD bằng Claude, quản
  hồ sơ) nhưng đi ngả riêng (tài khoản, schema `legal`, xuất Excel 17 sheet khó in). Phân hệ chính thức xây
  **trong app.savitax.vn**, dùng chung đăng nhập/phân quyền/công nợ/Drive, **xuất Word + PDF** thay cho Excel.
  Bản thử giữ làm kho tham chiếu rồi gỡ (mục 12).
- **Chia 7 giai đoạn**, mỗi giai đoạn dùng được ngay và chờ anh duyệt mới sang giai đoạn sau (mục 10).
  Giai đoạn 1 (nền + tiếp nhận + hồ sơ + công nợ) chưa cần Word/CCCD nên ra sớm nhất.
- **Anh đã chốt đủ 10 câu ngày 31/10** — bảng quyết định ở mục 13 trước khi vào code — chỗ nào em đã có đề xuất mặc định em ghi sẵn.

---

## 1. Hiện trạng đem ra tận dụng (đã khảo sát, không phải đoán)

| Của | Có gì | Dùng cho |
|---|---|---|
| **HCNS** (`hcns_clients` thoi_diem, `hcns_case_services`, `hcns_case_payments`) | Hồ sơ theo vụ việc có phí, nhiều dịch vụ song song, trạng thái 5 bước + nhật ký, checklist theo mẫu, sổ thu **ghi nối tiếp** có `paid_at` ngày thu thật, hạn xử lý tính ngày lịch **bỏ chủ nhật** (`lib/hcnsDue.js`) | Khuôn cho bảng/route/giao diện — **sao chép mô hình, không dùng chung bảng** (lý do mục 2) |
| **ĐNTT** (`/api/admin/dntt`) | Phiếu đề nghị thanh toán có QR VietQR, dòng B1…B7, VAT 8%; đã có nhánh `hcnsClientId` | Thêm nhánh `legalCaseId` — cùng mẫu phiếu, nhân viên đã quen |
| **Dòng tiền** (`lib/dongTienPhong.js`, `KhoiDongTien.js`) | Tồn đầu – phát sinh – thu – chuyển kỳ sau, quý/năm, 2 bất biến anh hay tự cộng | Viết `lib/dongTienPhapLy.js` theo cùng bất biến; hồ sơ pháp lý là việc một lần nên đơn giản hơn công nợ định kỳ |
| **Excel** (`lib/excelDep.js`, exceljs) | Xuất Excel tô màu/kẻ khung đồng bộ | Mọi báo cáo pháp lý |
| **Word** (`docxtemplater` + `pizzip`, đã có trong `/api/admin/contract`; `salesDocx.js` dựng OOXML) | Điền Word từ file mẫu | Engine xuất hồ sơ |
| **Drive** (`lib/googleDrive.js`, `salesFiling.js`) | Tự tạo thư mục + nộp file bằng service account vào Shared drive | Lưu trữ hồ sơ pháp lý theo cây thư mục 1–8 |
| **Phân quyền** (`serverAuth`, `quyenCache`, `khoiDong`, `roles/permissions`) | Quyền theo vai trò, kiêm nhiệm, nhớ 5 phút | Nhóm quyền "Phòng Pháp lý" |
| **Bản thử phaply** | `cccdVision.js` (đọc CCCD đã chạy tốt trên ảnh thật), `CompanyForm` (thành viên/cổ đông/đại diện), mô hình `companies` + `company_members`, các bẫy đã gặp (cột `date`/`numeric` rỗng phải gửi `null`) | Chuyển nguyên logic sang |
| **Mẫu biểu** (`Mau-Phap-Ly`) | Xem mục 5 | Nguồn dựng bộ mẫu Word |

**Điều em phát hiện khi khảo sát và ảnh hưởng thiết kế:**

1. File `30042026_TLM_DN_1TV_2TV_CP_ĐANG SOẠN.xlsx` có sheet **"Ma trận"**: bảng loại hồ sơ (TLM × 1TV/2TV/CP)
   → bộ giấy tờ phải có (UQ, Điều lệ, BBH HĐTV/ĐHĐCĐ/HĐQT, QĐ CSH/HĐTV/ĐHĐCĐ/HĐQT, Sổ ĐKCĐ, Mẫu 2/3/4/6/7/10/11/17/19/27/28/30/31/33).
   Đây chính là **cấu hình "mỗi thủ tục cần giấy tờ nào"** — em đưa thẳng vào DB thành ma trận chỉnh được, không code cứng.
2. Công thức trong Excel mẫu **là bản đặc tả** "ô nào của giấy tờ lấy dữ liệu nào" (131 công thức chỉ ở sheet Điều lệ).
   Em dùng chúng để dựng bản đồ trường và làm bài kiểm đối chiếu: Word xuất ra phải có cùng chữ với Excel mẫu.
3. Sheet `MaNganh` (6.470 dòng, hệ thống ngành đủ cấp A→5 chữ số kèm mô tả) là nguồn danh mục mã ngành sẵn có.
4. Các file "Hướng dẫn in ký_…" (một file cho mỗi loại hồ sơ) cho biết **in bộ nào, ai ký chỗ nào, nộp Sở hay Thuế** →
   thành dữ liệu của bước Trình ký, không phải tài liệu rời.
5. Các Excel mẫu cũ còn **tham chiếu ngoại lệ hỏng** (187 công thức) — là lý do file xuất Excel bị Excel "Repair".
   Phân hệ chính thức **không đi qua Excel** nên hết lớp rủi ro này.

---

## 2. Quyết định kiến trúc (em đề xuất — anh duyệt hoặc đổi)

| # | Quyết định | Vì sao |
|---|---|---|
| A1 | **Bảng riêng `legal_*`** (SQL mới `sql/42_phap_ly_module.sql`), không nhét vào `hcns_clients`/`hcns_case_services` | Hồ sơ pháp lý có dữ liệu có cấu trúc (pháp nhân, thành viên, CCCD, ngành nghề) và 10 bước, HCNS chỉ có 5 bước. Đúng nguyên tắc "module tách rời, gỡ được" — bản clone chỉ bỏ `sql/42` + `app/phaply` + `app/api/admin/phaply` + `lib/phapLy*` + mục menu. |
| A2 | **Menu & trang**: phân khu **riêng "PHÁP LÝ"** trong Sidebar, đặt **ngay dưới** khu HCNS – BHXH (không lồng vào trong) — `/phaply` (+ `/phaply/ho-so/[id]`, `/phaply/mau`, `/phaply/bao-cao`, `/phaply/checklist`), tự ẩn theo quyền `view_phaply` như HCNS/Kinh doanh | Anh chốt 31/10: phân hệ tách biệt, nằm dưới HCNS – BHXH. Nhân viên pháp lý vẫn thuộc phòng HCNS (`rooms.type='hcns'`) để không lẫn vào KPI/công nợ phòng nghiệp vụ. |
| A3 | **Vai trò mới**: `phaply` (nhân viên), `phaply_leader` (trưởng phòng). Nhóm quyền "Phòng Pháp lý" (mục 9) | Giống cách làm `hcns`/`hcns_leader`; quyền theo phòng, kiêm nhiệm xử lý bằng `roomsWithRole` như đã chốt 12/10 |
| A4 | **Đầu ra Word (.docx) và PDF** (anh chốt 31/10), không xuất Excel nhiều sheet. Word = bản sửa được; PDF = bản đóng để in, gửi khách duyệt, lưu trữ | Anh phản hồi file Excel "không phù hợp in/trình ký". PDF sinh **từ chính file Word** (một nguồn), sửa Word → PDF sinh lại. |
| A5 | **Dữ liệu là nguồn duy nhất**: nhập một lần ở "Thông tin hồ sơ", mọi giấy tờ sinh ra từ đó; sửa dữ liệu → xuất lại. Cho phép **tải lên bản đã sửa tay** thay bản sinh ra (có phiên bản v1, v2…) | Đúng ý "sửa hồ sơ nếu cần" mà không mất dấu bản gốc |
| A6 | **Đổi Word → PDF bằng LibreOffice chạy trên VPS Linux sẵn có** (máy đang chạy đồng bộ ngân hàng), không qua dịch vụ ngoài | Vercel không chạy được LibreOffice. VPS là hạ tầng của Savitax nên dữ liệu khách (CCCD, vốn…) không ra bên thứ ba, không tốn phí theo lượt. Chi tiết mục 5.5. |
| A7 | **Mọi đọc/ghi qua `app/api/admin/phaply/**`**, bắt buộc `requireLogin`/quyền + lọc phạm vi; browser không đụng bảng | Quy ước app (AGENTS.md) |
| A8 | **Ảnh CCCD là dữ liệu nhạy cảm nhất hệ thống**: bucket riêng **private** `phaply-cccd`, chỉ ký URL 5 phút, truy cập theo phạm vi hồ sơ, ghi nhật ký ai xem | Mục 6.3 |

---

## 3. Vòng đời hồ sơ & công việc ở từng bước

Một **hồ sơ pháp lý** = một vụ việc cho một doanh nghiệp (VD "Thành lập mới CÔNG TY X"). Trạng thái chính (khớp cây thư mục
`1…8` mà nhân viên đang dùng trên ổ chung, nên lưu trữ Drive tự khớp):

| Bước | Việc nhân viên làm trong app | Đầu ra / hệ thống tự làm |
|---|---|---|
| **1. Tiếp nhận** | Tạo hồ sơ: chọn loại thủ tục + loại hình (1TV/2TV/CP/HKD/CN/VPĐD/ĐĐKD), khách (chọn lại khách cũ hoặc tạo mới, dò trùng theo MST/SĐT như Kinh doanh), nguồn (khách mới / từ báo giá Kinh doanh), người phụ trách | Mã hồ sơ `PL-AAMM-NN`, hạn xử lý dự kiến, nhật ký |
| **2. Thu thập thông tin** | Nhập/ up **CCCD mặt trước + mặt sau** → tự điền → sửa; nhập ngành nghề (chọn mã), vốn, địa chỉ, tên công ty, nhiều thành viên/cổ đông | Danh sách "còn thiếu gì" (CCCD thiếu mặt sau, chưa chọn ngành chính, chưa có tỷ lệ góp vốn…) |
| **3. Báo giá – ĐNTT – công nợ** | Nhập phí (phí dịch vụ, lệ phí/chi phí thu hộ), in **ĐNTT** có QR, ghi tiền khách trả nhiều lần | Công nợ hồ sơ: phải thu / đã thu / còn nợ; đưa vào dòng tiền phòng |
| **4. Soạn hồ sơ** | Bấm **Xuất bộ hồ sơ**: chọn nhóm "Hồ sơ Sở – bước 1/2", "Hồ sơ Thuế", "Phiếu thu/ BBBG"; app sinh các file Word theo ma trận | Bộ Word đặt tên chuẩn, lưu vào hồ sơ + Drive (tự khớp thư mục `4. SOẠN HỒ SƠ`) |
| **5. Trình ký** | Xem danh sách "in bộ nào – ai ký – ký chỗ nào" (lấy từ file Hướng dẫn in ký), in, đánh dấu từng tờ đã ký | Thư mục `5. TRÌNH KÝ`, nhắc tờ chưa ký |
| **6. Nộp & theo dõi** | Ghi ngày nộp Sở (online/giấy), mã biên nhận; nhập **thông báo sửa đổi bổ sung** (nhiều lần), hạn trả lời | Đồng hồ hạn (số ngày làm việc của Sở, thời hạn bổ sung — **số ngày cụ thể để phòng pháp lý xác nhận theo quy định hiện hành**, em không tự điền), nhắc việc, nhật ký từng vòng nộp |
| **7. Kết quả** | Up Giấy chứng nhận ĐKDN/GXN, ghi số – ngày cấp, **MST** | Tự cập nhật hồ sơ pháp nhân (MST, ngày cấp, nơi cấp) → dùng điền hồ sơ thuế bước sau |
| **8. Hồ sơ thuế** | Xuất bộ thuế (ủy quyền thuế, 08-MST, đăng ký hình thức hóa đơn/kế toán/khấu hao…) — bước này dùng dữ liệu đã có MST | Bộ Word thuế; trình ký + nộp thuế như bước 5–6 |
| **9. Bàn giao** | Xuất **Biên bản bàn giao**, ghi người nhận, đính bản scan ký nhận | Thư mục `8. BÀN GIAO` |
| **10. Đóng & lưu trữ** | Kiểm "đủ điều kiện đóng" (đã thu đủ tiền hoặc trưởng phòng duyệt thiếu; đã bàn giao; đủ scan), bấm **Đóng hồ sơ** | Khóa sửa (chỉ trưởng phòng mở lại, ghi lý do), gói lưu trữ lên Drive, ghi hạn lưu |

Mỗi bước có **checklist theo mẫu** (như `/hcns/checklist`): trưởng phòng sửa danh sách việc cho từng thủ tục mà không cần code.
Hồ sơ nhiều vòng (bổ sung/sửa đổi) lặp bước 5–6; trạng thái "Chờ khách" / "Chờ Sở" / "Cần bổ sung" tách riêng khỏi bước để
trưởng phòng nhìn một màn hình biết **hồ sơ nào đang kẹt ở ai**.

**Hạn xử lý** (anh chốt 31/10): **trước mắt chỉ hạn nội bộ** — tái dùng quy tắc `hcnsDueDate` (đếm ngày lịch, bỏ chủ nhật),
số ngày theo từng thủ tục do trưởng phòng đặt ở checklist mẫu. Hạn xử lý của cơ quan (ngày làm việc, trừ lễ, hạn bổ sung) **làm sau**;
thiết kế bảng chừa sẵn cột để thêm không phải sửa dữ liệu cũ.

---

## 4. Mô hình dữ liệu (SQL `sql/42_phap_ly_module.sql`, chạy tay trong SQL Editor như mọi lần)

Tiền tố `legal_`, `id uuid`, RLS bật + policy `allow_authenticated` + `grant` đúng khuôn `sql/06`. Chạy lại nhiều lần an toàn.

**Khách / pháp nhân**
- `legal_entities` — pháp nhân (có thể chưa có MST): `entity_type` (1tv|2tv|cp|hkd|chi_nhanh|vpdd|ddkd), tên VN / nước ngoài / viết tắt, địa chỉ (số nhà, phường/xã, tỉnh), điện thoại, email, MST, mã & tên cơ quan thuế, vốn điều lệ (số/chữ), số lao động, `linked_client_id` (khớp `clients` nếu là khách kế toán).
- `legal_people` — người (đại diện PL / chủ sở hữu / thành viên / cổ đông / kế toán…): họ tên, giới tính, ngày sinh, dân tộc, quốc tịch, CCCD (số, ngày cấp, hết hạn, nơi cấp), quê quán, thường trú, liên lạc, **cccd_front_path / cccd_back_path**, `cccd_extract_json` (kết quả đọc + độ tin cậy).
- `legal_entity_people` — gắn người với pháp nhân: vai trò, chức danh, tỷ lệ/ giá trị góp vốn, loại tài sản góp, số cổ phần/loại, thứ tự. (Một người nhiều vai trò / nhiều công ty; đổi vốn, đổi đại diện cho hồ sơ thay đổi chỉ tạo thêm dòng.)
- `legal_entity_industries` — ngành nghề: mã, tên, ngành chính, thứ tự.

**Hồ sơ**
- `legal_cases` — mã hồ sơ, `entity_id`, `procedure_code` (tlm|thay_doi_*|tam_ngung|hoat_dong_lai|cap_lai_gpkd|giai_the|rut_ho_so|khac), `stage`, `wait_state` (khach|so|thue|bo_sung|null), nhân viên phụ trách, người nhận ban đầu, `received_at`, `due_at`, `closed_at`, `closed_by`, `archive_url`, `drive_folder_id`, ghi chú, `from_sales_quote_id` (nếu chuyển từ Kinh doanh).
- `legal_case_stage_log`, `legal_case_notes` — nhật ký chuyển bước/ghi chú (giống `hcns_case_notes`).
- `legal_case_tasks` — checklist thực tế của hồ sơ (sinh từ mẫu khi tạo, tích như HCNS).
- `legal_task_templates`, `legal_task_template_items` — mẫu việc theo thủ tục (soft-delete `is_active`).
- `legal_submissions` — mỗi lần nộp (Sở/Thuế): kênh, ngày nộp, mã biên nhận, hạn hẹn, kết quả; `legal_submission_notices` — thông báo sửa đổi bổ sung + hạn + ngày trả lời.

**Tiền**
- `legal_case_fees` — các khoản phí của hồ sơ: loại (`dich_vu` | `thu_ho`), tên khoản (phí DV, lệ phí Sở, khắc dấu, CKS…), số tiền (**đã gồm VAT** theo quy ước app).
- `legal_case_installments` — lịch thu từng đợt: thứ tự, tên đợt, phần dịch vụ, phần thu hộ, mốc đến hạn (`due_stage` hoặc `due_date`), ngày thực sự đến hạn.
- `legal_payment_plans` — lịch thu mẫu theo thủ tục (100%, 50/50…) để chọn nhanh.
- `legal_case_payments` — sổ thu **ghi nối tiếp** (copy `hcns_case_payments`): `installment_id`, `amount_dich_vu`, `amount_thu_ho`, `paid_at` ngày khách trả thật, `staff_id` người phụ trách lúc thu (để tính doanh số nhân viên), ghi chú, ai ghi. Chỉ xoá bằng quyền trưởng phòng/admin + lý do.

**Giấy tờ**
- `legal_doc_templates` — danh mục mẫu: mã (`UQ`, `DL_1TV`, `MAU2`, …), tên, file Word trong `templates/phaply/`, **phiên bản + ngày hiệu lực** (mẫu NĐ 168 đổi là thêm bản mới, hồ sơ cũ vẫn in đúng mẫu lúc đó), nhóm xuất (so_b1|so_b2|thue|ban_giao), cơ quan nhận, người ký, số bản in.
- `legal_doc_matrix` — (thủ tục, loại hình, điều kiện) → mẫu nào bắt buộc/tuỳ chọn; **nạp từ sheet "Ma trận"**.
- `legal_case_docs` — file thực tế đã sinh: mẫu, phiên bản mẫu, số phiên bản file, nguồn (`generated`|`uploaded`), đường dẫn Storage + id Drive, đã in/đã ký/ngày ký, ai sinh.

**Danh mục** (nạp 1 lần, chỉnh được ở `/phaply/mau`)
- `legal_vsic` — mã ngành (cấp, mã, tên, mô tả, cha) từ sheet `MaNganh`.
- `legal_tax_offices` — cơ quan thuế (mã, tên, tỉnh) + bảng gán **phường/xã → cơ quan thuế**.
- `legal_places` — tỉnh/phường-xã theo đơn vị hành chính hiện hành; `legal_registries` — Phòng ĐKKD theo tỉnh; hằng số (nơi cấp CCCD, chức danh…).

**Quyền/nhật ký**: `legal_access_log` (ai xem/tải ảnh CCCD & file hồ sơ, lúc nào) — chỉ ghi, dùng cho rà soát.

---

## 5. Engine xuất giấy tờ Word (lõi của phân hệ)

### 5.1 Nguồn mẫu hiện có
- **Có Word sẵn**: Mẫu 2 (1TV), Mẫu 3 (2TV), Mẫu 4 (CP) — 16–18 bảng, ~66–88 chỗ chấm "…" cần điền;
  Điều lệ 1TV/2TV/CP (văn bản dài, giá trị đã nằm trong lời văn); Giấy ủy quyền; Quyết định bổ nhiệm giám đốc/kế toán;
  Đăng ký khấu hao TSCĐ; Đăng ký hình thức hóa đơn; Phiếu thu góp vốn (1TV/2TV/CP/HKD); Biên bản bàn giao.
- **Chỉ có trong Excel**: các mẫu thuế (08-MST, sổ kế toán, KHTSCĐ…), Mẫu 6/7/10/17… ở các sheet. Với những mẫu này em dựng Word từ chính bố cục sheet.
- Chưa có mẫu cho: thay đổi (tăng vốn/đổi tên/đổi địa chỉ/đổi đại diện), tạm ngưng/hoạt động lại, giải thể, cấp lại GPKD — chỉ có file Excel sheet-per-giấy-tờ trong từng thư mục `2.`–`8.` → dựng ở Giai đoạn 5.

### 5.2 Cách chuẩn hoá một mẫu
1. Mở file Word mẫu, thay mỗi chỗ chấm bằng thẻ `{ten_cong_ty}`, bảng lặp bằng `{#thanh_vien}…{/thanh_vien}`, đoạn tuỳ chọn bằng `{#la_gdoc}…{/}` (docxtemplater, đã chạy ổn trong hợp đồng dịch vụ).
2. Đăng ký vào `legal_doc_templates` kèm bản đồ trường + điều kiện áp dụng.
3. **Bài kiểm đối chiếu (golden test)**: nạp bộ dữ liệu mẫu → sinh Word → lấy text → so với text của sheet tương ứng trong Excel mẫu (đã điền cùng dữ liệu). Khác chỗ nào báo chỗ đó. Mỗi mẫu có test riêng — thêm mẫu mới thì thêm test.
4. **Anh/chị pháp lý duyệt từng mẫu trên bản in** trước khi bật cho nhân viên dùng (em không tự tin thay chuyên môn pháp lý của phòng).

### 5.3 Quy tắc định dạng tiếng Việt đã ghi trong sheet "Thông tin" (em đưa vào hàm chuẩn hoá, không để nhân viên nhớ)
- Hộ KD/công ty 1TV: bỏ "thời điểm góp vốn" trong Điều lệ; chức danh **Giám đốc** thì mọi chỗ trong Điều lệ bỏ cụm "Tổng giám đốc" và ngược lại.
- Ngõ, hẻm, ngách, đường phố/tổ/xóm/ấp/thôn… **không viết hoa chữ đầu** khi nằm giữa địa chỉ.
- Nơi cấp CCCD chuẩn: "Cục Cảnh sát quản lý hành chính về trật tự xã hội" (không viết "tỉnh" hoa).
- Công ty 2TV: biên bản họp phải quy ước **1 phiếu biểu quyết = bao nhiêu tiền**.
- Sở Đồng Nai bắt buộc địa chỉ đủ tổ + ấp + xã + huyện + tỉnh → cờ "yêu cầu địa chỉ chi tiết" theo tỉnh nộp.
- Số tiền bằng chữ, ngày dạng "ngày … tháng … năm …": dùng `lib/numberToWords.js`, `lib/contractDates.js`.

### 5.4 Điều khiển xuất
- **Gói xuất theo nhóm** (Sở bước 1 / Sở bước 2 / Thuế / Bàn giao), lấy danh sách mẫu từ `legal_doc_matrix`; có tick bỏ bớt từng giấy.
- Trước khi xuất, **kiểm "đủ dữ liệu"**: chỗ nào còn trống bắt buộc thì liệt kê tên trường + dẫn tới ô cần nhập (không xuất file thiếu mà báo thành công).
- Đặt tên `PL-xxxx_<MÃ MẪU>_<tên công ty>_v<n>.docx`; mỗi lần xuất tạo phiên bản mới, giữ bản cũ.
- Tải riêng từng file hoặc **tải .zip cả bộ** (zip dựng bằng `pizzip`, sắp thứ tự theo thứ tự in trong "Hướng dẫn in ký").
- **Một file một giấy tờ** (đúng quy trình in từng tờ hiện nay), không gộp một workbook.
- Mỗi giấy tờ có **2 nút: Word / PDF**; gói xuất có tuỳ chọn "Word", "PDF" hoặc cả hai.

### 5.5 PDF

**Hai loại PDF, khác mục đích:**

| Loại | Nguồn | Dùng để |
|---|---|---|
| **PDF sinh ra** | Đổi từ file Word vừa xuất | Xem nhanh trên app không cần mở Word, gửi khách duyệt nội dung, **in cả bộ trình ký một lần** (gộp nhiều giấy tờ thành 1 PDF theo đúng thứ tự trong "Hướng dẫn in ký", có trang bìa liệt kê tờ nào – ai ký – ký mấy bản), lưu trữ |
| **PDF scan đã ký** | Nhân viên up bản scan sau khi khách ký | Nộp hồ sơ trực tuyến lên cổng Đăng ký kinh doanh / Thuế: app **ghép, sắp thứ tự, đặt tên** từng tệp theo đúng giấy tờ, kiểm dung lượng theo giới hạn của cổng (số liệu phòng pháp lý xác nhận), lưu vào `6. SCAN` |

**Cách đổi Word → PDF (đề xuất):**
- Cài **LibreOffice chạy nền** (khuyến nghị gói Gotenberg — LibreOffice đóng sẵn, có API HTTP) trên VPS Linux đang chạy đồng bộ ngân hàng,
  kèm **bộ font Times New Roman / Arial** để PDF giống bản in từ Word.
- Route `app/api/admin/phaply/pdf` gửi file Word sang VPS qua HTTPS + khoá bí mật (`PHAPLY_PDF_SECRET`), nhận PDF về; VPS **không lưu** file sau khi đổi.
- Gộp nhiều PDF thành bộ trình ký bằng `pdf-lib` (chạy được trên Vercel).
- **Kiểm tra bắt buộc trước khi dùng**: Vercel (Singapore) gọi được VPS; PDF từ LibreOffice khớp bản in Word với **từng mẫu** (bảng biểu, chỗ chấm, xuống trang) — mẫu nào lệch thì sửa file mẫu Word cho LibreOffice dựng đúng, không chấp nhận "gần đúng".
- **Phương án dự phòng** nếu VPS không dùng được: đổi qua Google Drive (service account đã có) — miễn phí, không cần cài gì, nhưng bố cục bảng/biểu mẫu dễ lệch hơn; hoặc dịch vụ đổi PDF trả phí (dữ liệu ra bên thứ ba — không khuyến nghị vì có CCCD).

---

## 6. Up CCCD → tự điền

### 6.1 Luồng
Hai nút riêng **CCCD mặt trước / mặt sau** trên từng người (đã chạy tốt ở bản thử): lưu ảnh trước, rồi đọc; đọc lỗi không mất ảnh.
Kết quả điền vào form, **mọi trường sửa tay được**, trường nào đọc lệch bị tô nổi.

### 6.2 Chất lượng đọc (nâng so với bản thử)
- Chuẩn hoá trước khi điền: viết hoa tên, ngày `YYYY-MM-DD`, tách "thường trú" thành số nhà / phường-xã / tỉnh bằng bảng `legal_places` (để điền được các ô tách của Mẫu 2).
- **Kiểm chéo tự động** (bắt lỗi đọc sai): số CCCD 12 chữ số; 3 số đầu = mã tỉnh nơi đăng ký khai sinh; chữ số thứ 4 = thế kỷ + giới tính khớp trường giới tính; 2 số kế = năm sinh khớp ngày sinh; **dòng MRZ ở mặt sau** (số, ngày sinh, giới tính, ngày hết hạn có chữ số kiểm tra) khớp mặt trước. Lệch thì cảnh báo, không tự sửa.
- CCCD **dạng 2** (anh nói chiếm ~10%): anh gửi mẫu thì em đối chiếu bố cục rồi chỉnh lời nhắc; cơ chế không đổi vì Claude đọc chữ in chứ không dựa vào vị trí cố định. Test bằng ảnh thật **anh cho phép từng ảnh**.
- Hộ chiếu / CMND 9 số (khách nước ngoài, người cũ): nhập tay trước, bổ sung đọc ở giai đoạn sau.

### 6.3 Bảo mật & chi phí — anh chốt 31/10: **dùng Claude, xoá ảnh CCCD 24 tháng sau khi đóng hồ sơ**
- Xoá tự động bằng **Vercel Cron hằng ngày** (cùng cơ chế cron backup đang chạy): hồ sơ `closed_at` quá 24 tháng → xoá ảnh trong
  `phaply-cccd`, giữ lại số liệu đã nhập (số CCCD, ngày cấp…) để hồ sơ vẫn tra cứu được; ghi nhật ký đã xoá. Mở lại hồ sơ đã đóng thì dừng đếm.
- Hồ sơ **không đóng** (bỏ dở) quá 24 tháng không cập nhật cũng xoá ảnh, sau khi báo trưởng phòng trước 30 ngày.

Các điểm bảo mật giữ nguyên:
- Ảnh CCCD sang **API Claude của Anthropic** để đọc: ra khỏi hạ tầng Savitax/Supabase. Em đề nghị: bật tuỳ chọn không lưu dữ liệu phía nhà cung cấp, chỉ gửi ảnh cần đọc, **không ghi nội dung ảnh/kết quả vào log máy chủ**, ghi `legal_access_log`.
- Lưu ảnh: bucket private `phaply-cccd`, tên file base64url (đúng bẫy `client-files`), ký URL 5 phút, chỉ người phụ trách/ trưởng phòng/ admin xem được. **Chính sách xoá ảnh sau X tháng kể từ khi đóng hồ sơ** (anh định X).
- Chi phí đọc: vài trăm đồng/lượt; không đáng kể so với doanh số hồ sơ.
- **Khoá API Anthropic đã từng hiện trong cuộc trò chuyện làm bản thử → em đề nghị tạo khoá MỚI cho app.savitax.vn, đặt trên Vercel, và thu hồi khoá cũ.**
- Phương án không dùng AI: nhập tay hoàn toàn (nhanh hơn việc đọc sai phải sửa?) — em không khuyến nghị, nhưng để anh chọn.

---

## 7. Mã ngành, mã cơ quan thuế, địa danh — "chọn trong danh sách, không gõ tay"

| Danh mục | Nguồn | Thao tác của nhân viên |
|---|---|---|
| **Mã ngành VSIC** | Sheet `MaNganh` (6.470 dòng) → tách thành bảng phân cấp `legal_vsic` | Ô tìm gõ mã **hoặc từ khoá** ("bán buôn máy tính") → tick; tick "ngành chính" (chỉ cho 1); kéo thứ tự; **bộ ngành mẫu** lưu theo lĩnh vực (thương mại điện tử, xây dựng, F&B…) bấm một lần ra cả bộ; xuất ra Mẫu 2/3/4 + Điều lệ đúng định dạng "mã – tên – ngành chính". |
| **Cơ quan thuế (CCT)** | Anh gửi danh sách chính thức (Thuế cơ sở/Thuế tỉnh + mã cơ quan thuế). Trong thư mục mẫu mới chỉ có dạng chữ ("Thuế cơ sở 11 Thành phố Hà Nội"), chưa có danh mục. | **Tự gợi ý theo phường/xã** của trụ sở (bảng gán), nhân viên chỉ xác nhận hoặc đổi; điền vào Giấy ủy quyền thuế, 08-MST, đăng ký hóa đơn… |
| **Địa danh** (tỉnh/phường-xã **sau sáp nhập 2025**, 2 cấp) | Danh mục hành chính hiện hành | Chọn tỉnh → phường/xã từ danh sách (nhập số nhà/đường tự do); tự ra "Phòng ĐKKD" & cơ quan thuế tương ứng. |
| **Phòng ĐKKD** theo tỉnh | Bảng nhỏ nhập tay 1 lần | Tự điền "Kính gửi: Phòng Đăng ký kinh doanh…". |
| Chức danh, dân tộc, quốc tịch, loại tài sản góp vốn | Hằng số | Danh sách chọn. |

Mọi danh mục chỉnh được ở `/phaply/mau` (quyền `manage_phaply_template`), không phải sửa code khi cơ quan đổi tên/gộp địa bàn.
**Cần anh cung cấp**: danh sách cơ quan thuế + mã (câu 5); nguồn danh mục phường/xã hiện hành nếu anh có file sẵn (không có thì em tìm nguồn chính thống và đưa anh duyệt trước khi nạp).

---

## 8. Công nợ, doanh số, báo cáo

### 8.1 Mô hình tiền (anh chốt 31/10)
- **Tách 2 loại tiền** trong mỗi hồ sơ: **phí dịch vụ** (doanh số Savitax) và **thu hộ** (lệ phí Sở, khắc dấu, chữ ký số… — phải thu của khách, **không tính doanh số**).
- **Thu theo đợt** (`legal_case_installments`): mỗi hồ sơ có lịch thu từng giai đoạn tuỳ thoả thuận với khách, VD đợt 1 khi nhận hồ sơ,
  đợt 2 khi có kết quả. Mỗi đợt ghi rõ **phần phí dịch vụ + phần thu hộ** và **mốc đến hạn** — theo bước (VD "khi sang bước Kết quả")
  hoặc theo ngày. Có sẵn vài **lịch thu mẫu** theo thủ tục (100% khi nhận; 50/50; …), nhân viên chọn rồi sửa.
- Quy ước app: **số tiền lưu ĐÃ GỒM VAT**; ĐNTT chia 1,08 ra dòng B rồi cộng VAT 8% cuối phiếu — dùng nguyên.
- Thu tiền = sổ ghi nối tiếp có `paid_at` **ngày khách trả thật** (bài học ca DT. GROUP ở HCNS: đừng lấy ngày ghi làm kỳ thu).
  Mỗi lần thu ghi vào **đợt nào**; một khoản thu được tách thành phần dịch vụ / phần thu hộ.
  **Khách trả thiếu một đợt** → mặc định trừ **thu hộ trước** (tiền Savitax đã/ sẽ nộp hộ nhà nước), phần còn lại mới là phí dịch vụ;
  nhân viên sửa được tách khác nếu khách chỉ định. *(Mặc định này em đặt — anh đổi được.)*
- **ĐNTT**: thêm nhánh `legalCaseId` vào `/api/admin/dntt`; in **theo đợt đang đến hạn**, dòng phí dịch vụ và dòng thu hộ tách riêng; QR nội dung `PL-mã hồ sơ_ThanhToan…`.
- Đóng hồ sơ chỉ khi thu đủ, hoặc trưởng phòng bấm "đóng còn nợ" kèm lý do (tiền còn lại thành nợ tồn theo dõi tiếp).

### 8.2 Doanh số (anh chốt 31/10): **ghi nhận khi THU ĐƯỢC TIỀN**
- Doanh số tháng T = **tổng phần phí dịch vụ đã thu có `paid_at` trong tháng T** (thu đợt nào tính đợt đó, đúng tháng thu). Thu hộ không bao giờ vào doanh số.
- Hiển thị cả **gồm VAT** và **trước VAT (÷1,08)** — phân hệ Lương đang tính doanh thu theo ÷1,08, để sau này nối vào thưởng không phải đổi số.
- Doanh số nhân viên = doanh số các hồ sơ người đó **phụ trách chính tại thời điểm thu** (chuyển hồ sơ cho người khác thì tiền thu trước khi chuyển vẫn tính người cũ).
- **Công nợ** (khác doanh số): phát sinh khi một đợt **đến hạn**. Tồn đầu kỳ + đợt đến hạn trong kỳ − đã thu trong kỳ = chuyển kỳ sau; thu trước hạn
  (khách trả sớm) vẫn tính doanh số tháng thu và làm giảm phải thu của đợt đó.

### 8.3 Báo cáo (`/phaply/bao-cao`, Excel qua `excelDep`) — tháng / quý / năm
1. **Theo hồ sơ**: mã, khách, thủ tục, người phụ trách, ngày nhận → hiện bước, phí, đã thu, còn nợ, số ngày xử lý, trễ hạn?
2. **Doanh số phòng & theo nhân viên**: số hồ sơ mới/ hoàn thành/ đang làm, doanh số (phí dịch vụ), thu hộ, so kỳ trước.
3. **Dòng tiền công nợ** (khối 5 thẻ dùng chung `KhoiDongTien`): **Tồn đầu kỳ** + phát sinh − **thu trong kỳ** = **chuyển kỳ sau**, tách phí dịch vụ / thu hộ; quý/năm chạy số dư từng tháng.
4. **Hồ sơ treo**: chờ khách / chờ Sở / quá hạn bổ sung (cho trưởng phòng).
5. Không chấm điểm KPI gộp (giữ đúng nguyên tắc đã chốt: chỉ số liệu riêng). **Chưa** đưa doanh số pháp lý vào thưởng phân hệ Lương (anh chốt 31/10) — làm báo cáo trước, quy tắc thưởng chốt riêng sau.

Bất biến bắt buộc (anh hay tự cộng): (1) cộng trừ trên thẻ khớp; (2) chuyển kỳ sau của tháng n = tồn đầu kỳ tháng n+1; (3) tổng nhân viên = tổng phòng.
Em viết 3 bộ kiểm `test-phaply-dong-tien`, `-nhan-vien`, `-quy-nam` ngay khi viết hàm tính, chạy trước mỗi lần đề nghị anh duyệt.

---

## 9. Vai trò, quyền, phạm vi

Nhóm quyền "Phòng Pháp lý":

| Quyền | Nhân viên pháp lý | Trưởng phòng PL |
|---|---|---|
| `view_phaply` — vào phân hệ, **thấy hồ sơ mình phụ trách + hồ sơ chưa ai nhận** | ✔ | ✔ |
| `manage_phaply` — tạo/sửa hồ sơ, nhập CCCD, xuất file, ghi thu | ✔ (hồ sơ mình) | ✔ |
| `view_phaply_all_staff` — xem cả phòng, giao/chuyển hồ sơ, báo cáo phòng & nhân viên | — | ✔ |
| `manage_phaply_template` — sửa mẫu giấy tờ, ma trận, checklist, danh mục | — | ✔ |
| `close_phaply_case` / mở lại hồ sơ đã đóng, xoá khoản thu, sửa giá | — | ✔ |
| `view_phaply_fee` — thấy số tiền phí/ doanh số | ✔ (hồ sơ mình) | ✔ |
| `view_phaply_cccd_image` — mở ảnh CCCD gốc | người phụ trách | ✔ |

`admin` luôn đủ. Cố ý **không** gán sẵn cho vai trò cũ nào (như `uncheck_task`, `bank_reconcile`) — tích tay ở "Vai trò & phân quyền".
Phạm vi lọc ở **máy chủ**, từng route (bài học Tờ khai/Soát xét: kiểm cả trong vòng lặp chọn hàng loạt). Nhớ dùng vai trò **kiêm nhiệm** (`roomsWithRole`), không `caller.role` đơn.

---

## 10. Lộ trình — 7 giai đoạn, mỗi giai đoạn dùng được và dừng chờ anh duyệt

| GĐ | Nội dung | Kết quả anh thấy | Cỡ |
|---|---|---|---|
| **0. Chốt** | Anh trả lời mục 13; em dựng mockup 3–4 màn (hồ sơ, tab Thông tin, xuất bộ hồ sơ, báo cáo) cho anh góp ý hình thức trước khi viết | Bản mockup + quyết định | nhỏ |
| **1. Nền & tiếp nhận & công nợ** | `sql/42` (bảng cốt lõi, vai trò, quyền, phòng), menu, danh sách + bảng việc (kanban theo bước), tạo hồ sơ, chuyển bước + nhật ký, checklist theo mẫu, hạn xử lý nội bộ, khoản phí (dịch vụ / thu hộ) + **lịch thu theo đợt** + sổ thu + **ĐNTT** theo đợt, doanh số theo tháng thu, thẻ dòng tiền cơ bản | Nhân viên tạo & theo dõi hồ sơ, in ĐNTT, ghi thu — **chưa Word/CCCD** | vừa |
| **2. Dữ liệu pháp nhân & CCCD & danh mục** | `legal_entities/people/industries`; form thông tin pháp nhân (1TV/2TV/CP/HKD…); CCCD 2 mặt + kiểm chéo + lưu private; chọn **mã ngành**, **cơ quan thuế**, **địa danh** từ danh mục; "còn thiếu gì" | Nhập một lần đủ dữ liệu cho cả bộ hồ sơ; CCCD điền tự động | lớn |
| **3. Engine Word + PDF — Thành lập mới** | Chuẩn hoá bộ mẫu TLM (1TV rồi 2TV, CP, rồi chi nhánh/VPĐD/ĐĐKD, HKD): ma trận, bản đồ trường, golden test, gói xuất theo nhóm, .zip, phiên bản, tải bản sửa tay; **cài LibreOffice/Gotenberg trên VPS + route PDF + gộp bộ trình ký 1 PDF**, đối chiếu PDF từng mẫu | **Bấm Xuất → ra bộ Word + PDF đúng, in được, sửa được** — mục tiêu chính của phân hệ | lớn nhất |
| **4. Trình ký → Nộp → Kết quả → Thuế → Bàn giao → Đóng & lưu trữ** | Danh sách in/ký từ "Hướng dẫn in ký", nhật ký nộp + thông báo bổ sung + đồng hồ hạn, nhập kết quả & MST, bộ hồ sơ thuế, BBBG, kiểm điều kiện đóng, đẩy gói lưu trữ lên **Drive** theo cây 1–8 | Vòng đời đầy đủ từ tiếp nhận đến lưu trữ cho TLM | vừa |
| **5. Các thủ tục khác** | Thay đổi (tăng vốn, đổi tên/địa chỉ/đại diện, chuyển đổi loại hình…), tạm ngưng/hoạt động lại, cấp lại GPKD, giải thể, rút hồ sơ: mỗi thủ tục = checklist + dòng ma trận + mẫu Word; tái dùng toàn bộ lõi GĐ 1–4 | Phủ hết dịch vụ pháp lý anh liệt kê | lớn (theo số mẫu) |
| **6. Báo cáo & đưa vào dùng thật** | 4 báo cáo mục 8.3, bộ kiểm dòng tiền, hướng dẫn nhân viên (`docs/huong-dan-phan-he-phap-ly.md/.docx`), chạy thử với 1–2 hồ sơ thật, rà soát bảo mật CCCD, gỡ bản thử | Dùng thật, có tài liệu | vừa |

Nguyên tắc triển khai (đúng quy trình đã chốt với anh): mỗi GĐ em **test local → anh duyệt → anh bảo "đẩy" em mới đẩy**; SQL đưa file, anh tự chạy
trong SQL Editor, em kiểm lại bằng GET thật (không dùng `head:true`); không đụng dữ liệu kế toán đang chạy; test bằng bản ghi tạm rồi xoá sạch.
Làm trên nhánh riêng, không đi ké push với phiên khác (bài học 24/09).

---

## 11. Rủi ro & cách chặn

| Rủi ro | Cách chặn |
|---|---|
| **Lộ CCCD** (dữ liệu nhạy cảm nhất) | Bucket private + URL ngắn hạn + quyền riêng + `legal_access_log` + chính sách xoá; không log ảnh/kết quả; xoay khoá API; rà soát trước khi mở cho nhân viên |
| **Mẫu biểu đổi** (NĐ 168 và các văn bản sửa đổi) | Mẫu có **phiên bản + ngày hiệu lực**, sửa ở `/phaply/mau`; hồ sơ giữ phiên bản mẫu đã dùng |
| **Word sai định dạng/ font** khi sinh | Chỉ **thay chữ trong file mẫu gốc** của phòng (không dựng lại bằng tay), golden test, pháp lý duyệt trên bản in; tránh bẫy OOXML đã gặp ở `salesDocx` (ô bảng phải có ≥1 `<w:p>`, thứ tự thẻ `<w:pPr>`) |
| **Dữ liệu nhập tay sai làm sai cả bộ** | Kiểm chéo CCCD, kiểm "đủ dữ liệu" trước xuất, so sánh vốn = tổng góp vốn, tỷ lệ = 100%, đúng 1 ngành chính |
| **Công nợ lệch** (khối anh soi kỹ nhất) | Cùng một hàm tính cho mọi trang + 3 bộ kiểm bất biến; ngày thu thật `paid_at` |
| **Danh mục địa bàn/cơ quan thuế lạc hậu** | Danh mục chỉnh được ở màn quản trị; ghi nguồn + ngày nạp |
| **Hai hệ song song** (bản thử + chính thức) gây nhầm | Giai đoạn 6 gỡ bản thử; từ nay chỉ nhập hồ sơ thật ở app.savitax.vn |
| **PDF lệch bố cục so với Word** (LibreOffice khác Word) | Cài đủ font trên VPS; đối chiếu PDF ↔ bản in Word **từng mẫu** khi chuẩn hoá; sửa mẫu Word cho tương thích; Word vẫn luôn tải được làm phương án cuối |
| **VPS ngừng / Vercel không gọi tới được** | Nút PDF báo lỗi rõ, Word vẫn xuất bình thường (PDF không chặn quy trình); dự phòng đổi qua Google Drive; theo dõi như VPS ngân hàng |

---

## 12. Bản thử `phaply.savitax.vn` — số phận

- **Giữ để tham chiếu** đến hết GĐ 3, rồi gỡ. Chưa deploy gì (repo local, chưa có remote/Vercel) nên không có gì đang chạy production.
- **Chuyển sang app chính**: logic `cccdVision`, form pháp nhân/thành viên, mô hình `companies`/`company_members`, các hàm chuẩn hoá (số tiền bằng chữ, ngày), bài học xử lý `null` cho cột date/numeric.
- **Không chuyển**: `fillXlsxTemplate` + xuất Excel 17 sheet (thay bằng Word), schema `legal` riêng, đăng nhập riêng, bucket `legal-*`.
- **Dọn ở Supabase** (cần anh đồng ý lúc đó, vì là production): `drop schema legal cascade`, xoá bucket `legal-case-files` và `legal-member-files` (còn ảnh CCCD **test** của chính chủ cung cấp lúc thử — xoá hết), bỏ `legal` khỏi Exposed schemas.
- Template Excel đã làm sạch (`templates/TLM_1TV.xlsx`) chỉ giữ làm **nguồn đối chiếu golden test**, không đưa vào deploy.

---

## 13. Quyết định đã chốt (31/10/2026)

| # | Nội dung | Anh chốt |
|---|---|---|
| 1 | Ghi nhận doanh số | **Khi thu được tiền**: hồ sơ thu phí theo từng đợt, thu phần nào tính doanh số phần đó vào **tháng thu** (mục 8.2) |
| 2 | Cấu thành phí | **Tách** phí dịch vụ / thu hộ; thu hộ **không** tính doanh số |
| 3 | Vị trí menu | Phân khu riêng **"PHÁP LÝ"**, ngay dưới HCNS – BHXH |
| 4 | Đọc CCCD | **Dùng Claude**; xoá ảnh **24 tháng sau khi đóng hồ sơ** (mục 6.3) |
| 5 | Danh mục cơ quan thuế + phường/xã | **Em tìm nguồn chính thống, đưa anh duyệt rồi mới nạp** |
| 6 | Mẫu Word | Chuyên viên pháp lý **duyệt lại mẫu em chuyển**, hoặc **gửi mẫu Word chuẩn** cho em |
| 7 | Lưu trữ Drive | Giữ cây **8 thư mục 1 → 8**; em xin ID thư mục gốc khi tới GĐ 4 |
| 8 | Hạn xử lý | **Lịch nội bộ trước**; hạn xử lý của cơ quan áp dụng sau |
| 9 | Thưởng doanh số Lương | **Chưa** — làm báo cáo trước |
| 10 | PDF trên VPS | **Đồng ý**; em tự cân đối tài nguyên VPS (đo RAM/CPU trước khi cài, VPS yếu thì đề xuất VPS riêng) |
| — | Đầu ra | **Word + PDF** |

**Mặc định em tự đặt, anh đổi được**: khách trả thiếu một đợt → trừ phần **thu hộ trước**, rồi mới tới phí dịch vụ (mục 8.1).

**Còn cần anh cung cấp** (không gấp): ảnh **CCCD dạng 2** (trước GĐ 2), **danh sách nhân viên pháp lý + trưởng phòng** (trước GĐ 1 lên thật),
**mẫu Word chuẩn** nếu bên pháp lý có (trước GĐ 3), **ID thư mục Drive** (trước GĐ 4).

---

## 14. Danh sách file dự kiến tạo (để anh hình dung phạm vi — chưa tạo gì)

```
sql/42_phap_ly_module.sql                    schema + vai trò + quyền + phòng + danh mục rỗng
sql/43_phap_ly_danh_muc.sql                  nạp VSIC / cơ quan thuế / địa danh (sau khi anh duyệt dữ liệu)
app/phaply/page.js                           danh sách + kanban
app/phaply/ho-so/[id]/page.js                chi tiết hồ sơ (tab Thông tin, Người & CCCD, Ngành nghề,
                                             Soạn & Xuất, Trình ký, Nộp & Kết quả, Công nợ, Lịch sử)
app/phaply/mau/page.js | checklist | bao-cao
app/api/admin/phaply/{cases,entities,people,industries,fees,payments,docs,export,
                      submissions,cccd,catalog,report,templates,archive}/route.js
lib/phapLy*.js                               hạn, trạng thái, phạm vi, chuẩn hoá địa chỉ/tên, bộ kiểm "đủ dữ liệu"
lib/phapLyDocx.js                            engine điền Word + zip + phiên bản
lib/phapLyPdf.js                             gọi VPS đổi Word→PDF, gộp bộ trình ký (pdf-lib), ghép/đặt tên PDF scan
vps/phaply-pdf/README.md                     cài Gotenberg/LibreOffice + font + HTTPS + khoá bí mật trên VPS
lib/phapLyCccd.js                            đọc CCCD + kiểm chéo
lib/dongTienPhapLy.js                        dòng tiền (dùng chung KhoiDongTien)
templates/phaply/*.docx                      bộ mẫu đã gắn thẻ
scripts/test-phaply-*.mjs                    golden test từng mẫu + 3 bộ kiểm dòng tiền + kiểm phạm vi
docs/huong-dan-phan-he-phap-ly.md/.docx      hướng dẫn nhân viên
```

**Bản clone** (ABS, NYD, Linh Phong): KHÔNG đưa phân hệ này — bỏ `sql/42,43`, `app/phaply`, `app/api/admin/phaply`, `lib/phapLy*`,
`lib/dongTienPhapLy.js`, `templates/phaply`, mục menu, và `'legal_*'` khỏi danh sách backup (quyền không tồn tại thì menu tự ẩn).
