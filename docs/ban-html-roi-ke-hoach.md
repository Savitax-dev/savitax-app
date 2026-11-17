# Phương án: bản HTML chạy riêng trên máy — Soát xét báo cáo + Rủi ro thuế + Hồ sơ chứng từ

Lập 07/11/2026. Các quyết định của anh trong ngày:
- Phân hệ thứ hai là **Rủi ro thuế** thay cho Tờ khai & Hạn nộp (Tờ khai để lại ở cuối file).
- **Gộp tất cả thành MỘT file HTML**.
- App Hồ sơ chứng từ (file `05. APP CHECK & QUAN LY HO SO CHUNG TU KE TOAN_V2.0.0.html`) **đổi thành của Savitax, làm theo
  giao diện Savitax**.
- **Bản quyền Savitax**, khách được đổi logo + tên công ty mình.
- KHÔNG thêm nút "Xuất cho bản rời" trong app chính.

ĐANG LÀM — GĐ 1 xong 15/11/2026 (xem "Tiến độ" ở mục Thứ tự làm).

**Demo giao diện + cấu trúc chạy (08/11/2026)**: `docs/mockup-ban-roi/Savitax-HoSo-demo.html` (bấm qua lại được, dữ liệu
giả, không gọi mạng; Cài đặt có ô thử điều kiện chạy + nút thử trỏ thư mục chỉ đọc) và `docs/mockup-ban-roi/cau-truc-chay.html`.
Mở bằng cách bấm đúp file trên Chrome / Edge.

## Mục tiêu

- Một file `Savitax-HoSo-v1.0.html` mở trên Chrome / Edge ở máy tính: **không cần đăng nhập app.savitax.vn, không cần
  Supabase, không cần Claude, không cần mạng**. Thư viện, phông chữ, logo nhúng sẵn trong file.
- Dữ liệu lưu trên máy, có Sao lưu / Khôi phục ra file JSON để chuyển máy.
- App chính trên app.savitax.vn **giữ nguyên hành vi**.

## Bố cục file

```
┌ Thanh trên: [logo công ty khách] Tên công ty khách        Công ty đang làm: [▼]
├ Menu trái (giống app Savitax)
│   🔎 Soát xét báo cáo   — Hồ sơ · Soát kỳ · Soát xét năm · Tăng trưởng & phí
│   ⚖️ Rủi ro thuế        — Hồ sơ đã đọc · Bảng 39 tiêu chí · Chi tiết tiêu chí · Nhiều năm · Tải Excel
│   📑 Hồ sơ chứng từ     — Tổng quan · Lập hồ sơ từ hóa đơn · Sổ hồ sơ · Bộ hồ sơ & checklist · Mẫu chứng từ
│   🏢 Danh sách công ty  — dùng chung cho cả 3 (gộp "Danh bạ" của Hồ sơ chứng từ)
│   ⚙️ Cài đặt            — logo + tên + địa chỉ công ty khách, ngày nghỉ lễ, sao lưu / khôi phục, giao diện sáng / tối
└ Chân trang: Bản quyền © Savitax · phiên bản
```

**Dùng chung giữa 3 phân hệ**: danh sách công ty, công ty đang làm (chọn một lần ở thanh trên), thư mục Drive đã trỏ (Soát xét
và Rủi ro thuế cùng một tay cầm), ngày nghỉ lễ (Hồ sơ chứng từ dùng để lùi ngày chứng từ, Soát xét dùng để tính hạn nộp).

## Thương hiệu

- Cố định, khách không sửa được: "Bản quyền © Savitax" ở chân trang + mục Giới thiệu trong Cài đặt.
- Khách đổi được ở Cài đặt: logo, tên, địa chỉ, MST công ty mình → hiện ở thanh trên, bản gửi khách của Tăng trưởng & phí,
  tiêu đề file Excel. Mặc định là Savitax. **Chứng từ của Hồ sơ chứng từ KHÔNG dùng mục này**: Bên A là CÔNG TY ĐANG LÀM
  (khách hàng kế toán, lấy từ Danh sách công ty), bên B lấy từ hóa đơn.

## Hướng dẫn + cây thư mục mẫu (anh yêu cầu 08/11/2026)

- Mỗi phân hệ có tab **📘 Hướng dẫn** (đã dựng trong demo). Hướng dẫn Soát xét báo cáo có nút **tải cây thư mục mẫu
  SVT.MB09** (ZIP nhúng trong file, ~55 KB) + xem trước cây, đánh dấu thư mục app đọc số liệu.
- Nguồn: `G:\Shared drives\5. SAVITAX - NỘI BỘ & KẾ TOÁN THUẾ\5.7 QUY TRINH ISO 9001 - 2004\5.7.2.2 MẪU BIỄU ISO v2\SVT.MB09.
  CAY THU MUC\TÊN CÔNG TY - CÂY THU MỤC MẪU` — 94 thư mục. ZIP **chỉ lấy thư mục rỗng** + file "ĐỌC TRƯỚC": cây gốc có 23 file,
  trong đó bộ "MẪU BỘ TỜ KHAI HẢI QUAN" là chứng từ hải quan thật của khách → không đóng vào file giao ra ngoài. Ba file mẫu
  (`SVT.MB07` nhật ký, `SVT.MB13` đề nghị thanh toán, `BANG KE HOA DON CHU.xlsx`) chờ anh quyết có kèm không.
- Hướng dẫn Soát xét có **quy tắc lưu file & đặt tên**: quy tắc chung `<LOẠI>_<KỲ>.<NĂM>_<MÃ KH>[_ghi chú]` + 11 mục bấm mở
  (thư mục con · lưu gì · tên file), chuyển từ `docs/quy-uoc-luu-ho-so.md` sang đúng thư mục con của cây ISO. Đã kiểm
  `phanLoaiTepHoaDon`: công ty khai THÁNG phải đổi `QUÝ n` → `THÁNG 01…12` ở mục 2 (để trong `QUÝ n` thì hóa đơn bị gán cả 3 tháng).
- Đã chạy bộ quét thật (`quetCongTy`) trên cây này: đọc đủ 11 thư mục + 4 kỳ `BCT-Q1…Q4` trong `1. BỘ BCT QUÝ_THÁNG`, với
  điều kiện đổi `NĂM TÀI CHÍNH` → `Năm 2026` (tên giữ chỗ không phải năm). Cây ISO không có `12. HÌNH ẢNH` mà
  `docs/quy-uoc-luu-ho-so.md` có; hai tài liệu còn lệch kiểu thư mục hóa đơn (`HĐ MUA VÀO` vs `Mua vào\XML`) và kiểu kỳ báo
  cáo (`BCT-Q1` vs `BAOCAOTHUE_Q3_2026_<mã>`) — app đọc được cả hai, nhưng nên thống nhất một chuẩn.
- Xoá hết dấu đơn vị nguồn của bản V2.0.0: tên công ty (12 chỗ), chữ viết tắt (17 chỗ: logo, tên biến, khoá lưu trữ, tác giả
  file Word / Excel), trang "Đơn vị sở hữu", chân trang. Kiểm: chạy `test-phantich-thuong-hieu` trên file dựng xong (từ khóa
  ở `~/.savitax-keys/`, thêm tên + chữ viết tắt đơn vị nguồn của bản V2.0.0 vào đó).
- ⚠ **Dữ liệu mẫu**: hóa đơn mẫu số 37 và danh bạ ví dụ đang chứa 2 công ty trông như thật (CTCP SX & TM Sơn Việt HD
  0801377174, Công ty TNHH Mosan Tech 2301145813, kèm số điện thoại, ngân hàng) → thay bằng công ty giả, MST giả.

## Tra MST khi thêm công ty (anh yêu cầu 15/11/2026, đã có trong demo)

Nút 🔍 trong ô MST (hoặc Enter): 1) tìm trong danh sách công ty + đối tác trên máy (báo trùng nếu đã có) → 2) không thấy thì tra
`https://api.vietqr.io/v2/business/<MST>` (dữ liệu tổng hợp từ trang Cục Thuế, cho phép gọi từ file HTML, giới hạn ~2 lượt / vài
giây) → tự điền tên + địa chỉ + báo trạng thái NNT. Đây là chức năng DUY NHẤT của bản rời cần mạng; không mạng thì báo "gõ tay".
Chỉ gửi đi MST (thông tin công khai). Công ty lưu thêm `dc` (địa chỉ) → in vào Bên A của Hồ sơ chứng từ.

## Đã soát mã — mỗi phân hệ cần làm gì

| | Soát xét báo cáo | Rủi ro thuế | Hồ sơ chứng từ |
|---|---|---|---|
| Mã hiện có | React, `lib/phanTich`, `lib/soatbaocao` | React, `lib/ruiro` | JS thuần trong file HTML (lõi `CORE` ~500 dòng + giao diện ~850 dòng + thư viện mẫu / bộ hồ sơ ~2.000 dòng) |
| Gọi máy chủ | 3 chỗ: danh sách công ty, phí, hạn nộp | 1 chỗ: danh sách công ty | Không (đã có chế độ chạy trên máy) |
| Cần mạng | Không | Không | html2pdf + Google Fonts từ CDN → nhúng vào file |
| Việc chính | Thay 3 chỗ gọi máy chủ | Thay 1 chỗ | Đổi giao diện sang Savitax, đổi thương hiệu, dùng chung danh sách công ty + kho lưu |

## Cách làm

**Một nguồn mã, dựng ra hai nơi** — không chép Soát xét / Rủi ro thuế sang chỗ khác để sửa riêng:

1. **KHÔNG sửa mã app** (đổi so với dự kiến ban đầu, làm ở GĐ 1 ngày 15/11/2026): lúc gói, mấy chỗ app dựa vào Next.js / máy
   chủ được thay bằng bản chạy trên máy — `next/navigation` + `next/link` → `banRoi/shim` (đường dẫn trang sau dấu `#`),
   `@/lib/supabase` → bỏ đăng nhập, `@/components/AppShell` → `banRoi/khung/AppShell.jsx`, và `fetch('/api/admin/phantich/
   {cong-ty,phi,han-nop}')` → `banRoi/apiMay.js` trả lời từ kho trên máy **đúng khuôn JSON của route**. ⚠ Đổi khuôn 3 route đó
   ở app thì phải sửa cả `apiMay.js`.
2. **Hồ sơ chứng từ đưa vào repo** ở `banRoi/hoSoChungTu/` (tách khỏi file HTML: lõi, giao diện, thư viện mẫu, CSS). Giữ nguyên
   lõi `CORE` (đọc hóa đơn, nhận diện nghiệp vụ, điền mẫu, xuất Word / Excel / PDF), chỉ:
   - thay CSS bằng bộ màu Savitax (đỏ `#8B1A1A`, vàng `#C9A84C`, nền sáng như app), bỏ thanh thương hiệu riêng → nằm trong khung chung;
   - danh bạ → đọc / ghi danh sách công ty chung; lưu trữ localStorage → kho IndexedDB chung (localStorage chỉ ~5 MB,
     sổ hồ sơ dài là đầy);
   - dùng chung thư viện với hai phân hệ kia (JSZip, pdfjs — hiện mỗi bên nhúng một bản), html2pdf nhúng vào file.
   Không viết lại sang React: lõi đang chạy đúng, viết lại là rủi ro mà không được gì.
3. **Script `scripts/dung-ban-roi.mjs`** (esbuild — thêm vào devDependencies) gói khung chung + 3 phân hệ + thư viện + phông
   (Be Vietnam Pro, Tinos) + logo thành một file ở `dist-ban-roi/`. `next/link`, `next/navigation`, `AppShell` thay bằng bản nhẹ.
4. Sửa nghiệp vụ trong app → chạy lại script → ra bản mới cùng số phiên bản.

**Kích thước ước tính**: ~6–8 MB (pdfjs + worker, xlsx, exceljs, html2pdf là phần nặng). File mở bình thường; sau này có thể
bỏ bớt một trong hai thư viện Excel.

**Chuyển dữ liệu cũ**: ai đang dùng bản V2.0.0 cũ thì Khôi phục từ file sao lưu JSON cũ → app tự đổi sang kho mới
(cùng cấu trúc hồ sơ, mẫu, bộ hồ sơ).

**Bỏ ở bản rời**: đăng nhập, phân quyền theo phòng / vai trò, quyền xem phí, liên kết KPI / checklist / công nợ.

**Giữ nguyên bất biến**: Soát xét + Rủi ro thuế CHỈ ĐỌC thư mục (grep `createWritable|removeEntry` trên phần đó phải rỗng);
chuyển tab không đọc lại thư mục.

## Từng phân hệ

- **Soát xét báo cáo** — giữ 4 màn. Danh sách công ty → mục chung. Hạn nộp → tự tính bằng `taxDeadline` + `tokhaiLich` + ngày
  nghỉ lễ; trạng thái "đã nộp" lấy từ tờ khai XML trong thư mục. Phí → cột phí trong danh sách công ty.
- **Rủi ro thuế** — giữ 5 màn + Tải Excel, `lib/ruiro` giữ nguyên logic bản 3.2.0. Chỉ thay danh sách công ty.
- **Hồ sơ chứng từ** — giữ đủ chức năng của bản V2.0.0 (đọc XML / PDF / ZIP hóa đơn, nhận diện nghiệp vụ, checklist, cảnh báo
  tuân thủ, Word / Excel / PDF / ZIP, sửa mẫu, nhập mẫu Word, sổ hồ sơ). Thử lại bằng chính các hóa đơn mẫu trước và sau khi đổi:
  bộ chứng từ xuất ra phải giống hệt ngoài logo / tên.

## Thứ tự làm

| GĐ | Việc | Thời gian |
|---|---|---|
| 0 | Thử kỹ thuật: mở file HTML từ ổ đĩa → chọn thư mục, nhớ tay cầm, đọc file; IndexedDB trên `file://` | 0,5 ngày |
| 1 | Khung chung (menu, thanh trên, Cài đặt, logo khách, danh sách công ty, sao lưu) + script dựng + lớp nguồn dữ liệu | 1,5 ngày |
| 2 | Soát xét báo cáo vào khung | 1,5 ngày |
| 3 | Rủi ro thuế vào khung | 0,5 ngày |
| 4 | Hồ sơ chứng từ: đưa vào repo, đổi giao diện + thương hiệu, dữ liệu mẫu giả, dùng chung kho + thư viện | 2–3 ngày |
| 5 | Đóng gói, hướng dẫn sử dụng, thử trên một máy sạch không mạng | 0,5 ngày |

Tổng ~6,5–7,5 ngày. Mỗi giai đoạn: thử ở máy → gửi anh file xem → anh duyệt. Không giai đoạn nào sửa mã app chính.

### Tiến độ

- **GĐ 1 xong (15/11/2026)**: `scripts/dung-ban-roi.mjs` → `dist-ban-roi/Savitax-HoSo.html` (~4,5 MB: pdfjs 1,4 MB, exceljs
  0,9 MB, xlsx 0,4 MB, mã 1,5 MB). Khung + Tổng quan (có tự kiểm máy: trỏ thư mục, lưu trữ, đọc PDF) + Danh sách công ty (thêm /
  sửa / xoá, tra MST, trỏ thư mục, nhập / xuất Excel) + Cài đặt (thương hiệu, ngày nghỉ lễ, sao lưu / khôi phục). Vì dùng nguyên mã
  app nên **cả 10 màn Soát xét + Rủi ro thuế đã chạy luôn** (GĐ 2–3 rút ngắn còn phần hạn nộp). Thử bằng thư mục ảo (OPFS) theo cây
  SVT.MB09 + tờ khai / quyết toán / BCTC giả của bản demo: Rủi ro thuế ra Bảng 39 tiêu chí, Soát kỳ đủ 12 tháng + BS lần 1;
  Excel xuất → nhập lại đúng; worker pdf.js nhúng chạy được.
- **GĐ 0 xong (15/11/2026)**: anh mở file:// trên Chrome, trỏ thư mục thật 355 DECOR, đọc được. Lỗi gặp + đã sửa: worker pdf.js
  dạng module dựng từ Blob bị Chrome chặn trên file:// → kẹt ở file PDF đầu tiên; nay dựng sẵn worker dạng classic (IIFE).
  Đo thư mục thật: 8 file tờ khai đọc 0,5 s ngoài trình duyệt — ổ G: không chậm.
- **Anh bỏ tab Tăng trưởng & phí khỏi bản rời (15/11/2026)**: lọc ở `banRoi/shim/ThanhTab.jsx`, gỡ trang + route `phi` giả; bỏ
  luôn ô / cột "Phí / tháng" ở Danh sách công ty và file Excel mẫu — bản rời không có phí dịch vụ.
- **GĐ 2 xong (16/11/2026)**: `apiMay.js` han-nop sinh lịch tại máy bằng đúng `loaiApDung` + `nghiaVuDinhKy` / `nghiaVuQuyetToan`
  (lib/tokhaiLich.js), danh mục loại tờ khai chép từ bảng `tax_filing_types`, ngày nghỉ = Cài đặt (để trống → mặc định chép từ
  `tax_holidays`: 1/1, 30/4, 1/5, 2/9 năm 2026–2027; khách tự thêm Tết, Giỗ Tổ, nghỉ bù). Khung "Hạn nộp và trạng thái nộp" thay
  bằng `banRoi/shim/HanNopKy.jsx`: chỉ hạn nộp + còn N ngày, trạng thái nộp xem dải kỳ (đọc thư mục). Giới hạn: một kỳ khai / công
  ty (TNCN theo kỳ của GTGT); hộ kinh doanh chỉ 01/CNKD. Đã thử: Q1/2026 → 04/05 (30/4, 1/5, cuối tuần), Q3 → 02/11, T08 → 21/09.

## Bộ bàn giao

```
Savitax-HoSo-v1.0/
  Savitax-HoSo-v1.0.html
  Mau-danh-sach-cong-ty.xlsx
  HUONG-DAN.pdf
```

---

## Để sau — Tờ khai & Hạn nộp (không làm ở đợt này)

Ghi lại để khi anh mở lại khỏi soát lại từ đầu:

- Chrome không cho file HTML mở từ ổ đĩa (`file://`) nói chuyện với tiện ích (`externally_connectable` chỉ nhận trang
  http/https), mà không có tiện ích thì không vào được cổng thuế → phải đặt trang app NẰM TRONG một tiện ích riêng (tên +
  khóa khác tiện ích production `affcgkip…`), trang tiện ích gọi thẳng cổng. Nghĩa là Tờ khai không gộp được vào file HTML trên.
- Phải tách lõi 3 route `connect-ext` / `sync-ext` / `tai-file` (dựng yêu cầu + đọc phản hồi) thành hàm thuần dùng chung, và
  thay 11 bảng (`clients`, `tax_accounts`, `tax_obligations`, `tax_filings`, …) bằng kho trên máy.
- Mật khẩu cổng của khách: lưu mã hóa bằng mật khẩu chủ (WebCrypto) hoặc không lưu, gõ mỗi lần.
- Ước tính 4–5 ngày + thử thật trên cổng.
