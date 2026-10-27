# Phân hệ Soát xét báo cáo + Rủi ro thuế — kế hoạch đưa lên app.savitax.vn

Bản 4 (25/10/2026), viết lại theo góp ý của anh. Các câu hỏi đã chốt hết, xem mục 7.

0. **Chỉ đọc và phân tích, không sửa gì.** App chỉ đưa số liệu phân tích lên màn hình: không sửa tay
   số liệu, không ô giải trình, không ghi bất cứ file nào vào Drive.

1. **Đọc thẳng thư mục công ty trên Drive**, theo đúng cây thư mục Savitax, như phân hệ Tờ khai.
2. **Không tải file lên Vercel hay Supabase.** Dữ liệu lớn đọc ngay tại thư mục.
3. **Giao diện làm mới theo app Savitax**, không bê nguyên app cũ. Chỉ giữ phần công thức nghiệp vụ.
4. **Không liên thông phân hệ Tiền lương** (phân hệ nội bộ riêng của Savitax).
5. **Toàn bộ mang thương hiệu Savitax.** Không giữ tên, mã, tài liệu hay ghi chú nào của đơn vị cũ.
6. **Dữ liệu khách chỉ nằm trên Drive** công ty cấp cho từng nhân viên.
7. **Chưa chấm điểm, chưa xếp loại.** Savitax chưa chốt ngưỡng, nên app chỉ hiện số liệu, chênh lệch
   và tỷ lệ (mục 3).
8. **Phạm vi năm: từ năm 2026 trở đi** (anh chốt 26/10/2026). Năm 2025 trở về trước không đọc mặc định; khi cần,
   nhân viên tải dữ liệu vào một thư mục rồi trỏ app vào (mục 1b).

Nguồn nghiệp vụ: hai bản offline đang dùng nội bộ, "Check BCTC V3" và "Phân tích rủi ro thuế 39 tiêu chí 3.2.0".

| | **Soát xét báo cáo** | **Rủi ro thuế** |
| --- | --- | --- |
| Mục đích | Soát xét sổ sách → BCTC → tờ khai của một công ty, nhiều năm | Đối chiếu chéo 01/GTGT – 03/TNDN – BCTC theo mẫu 39 tiêu chí của CQT |
| Phần nghiệp vụ giữ lại | 8 nhóm kiểm tra (cân đối BCTC, CĐPS, sổ sách, ngân hàng, GTGT, TNDN, TNCN-BH, đối chiếu chéo), 203 quy tắc checklist, 35 chỉ số + chỉ số đặc thù 8 loại hình, thư viện 45 tham số chính sách 2021–2026 | 39 tiêu chí (13 đối chiếu SL1−SL2, 26 xét số dư), 24 chỉ số, mapping mã số TT99/TT133/TT200. Ngưỡng mức độ và điểm giữ trong mã nhưng tắt |
| Bỏ đi | Toàn bộ giao diện, cách lưu trữ, sửa tay số liệu, giải trình, checklist "Đã KS", tài liệu Word nhúng sẵn, tên và mã của đơn vị cũ | như bên trái, thêm mẫu văn bản giải trình |

---

## 1. Dữ liệu đọc từ đâu: cây thư mục thật của Savitax

Nhân viên **trỏ vào thư mục công ty một lần**, ví dụ
`G:\Shared drives\12. SAVITAX - PHÒNG NGHIỆP VỤ GRAND\<Nhân viên>\3.THỊNH PHÁT\`.
Đây là **cùng tay cầm thư mục mà phân hệ Tờ khai đã lưu** (`lib/tokhaiLuuDia.js`, khóa
`thu-muc-cty:<clientId>`). Ai đã trỏ thư mục cho Tờ khai thì không phải chọn lại.

Từ đó app tự đi vào `2. HỒ SƠ KẾ TOÁN\Năm <năm>\`. Khảo sát ngày 25/10/2026 (công ty THỊNH PHÁT,
năm 2024–2026, chỉ đọc tên thư mục và đuôi file):

| Thư mục trong `Năm <năm>` | App lấy gì | Đuôi file thực tế | Dùng cho |
| --- | --- | --- | --- |
| `7. BỘ BÁO CÁO\BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_<kỳ>…\` | Tờ khai 01/GTGT, 05/KK-TNCN (mọi lần bổ sung), thông báo chấp nhận | xml, pdf | cả hai |
| `7. BỘ BÁO CÁO\BỘ BÁO CÁO TÀI CHÍNH…\` | BCTC (B01, B02, B03, thuyết minh), 03/TNDN + phụ lục, 05/QTT-TNCN | xml, xlsx, xls, pdf | cả hai |
| `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI KHOẢN…` | Bảng cân đối tài khoản | xlsx | cả hai |
| `8. SỔ SÁCH KẾ TOÁN\4. CÔNG NỢ PHẢI THU_PHẢI TRẢ…` | Tổng hợp + chi tiết công nợ 131/331 | xlsx | cả hai |
| `8. SỔ SÁCH KẾ TOÁN\5. HÀNG TỒN KHO…` · `9. BẢNG TÍNH GIÁ THÀNH` | Nhập – xuất – tồn, giá thành | xlsx | Soát BCTC |
| `8. SỔ SÁCH KẾ TOÁN\7. SỔ NHẬT KÝ CHUNG` · `8. SỔ CHI TIẾT CÁC TÀI KHOẢN` | NKC, sổ chi tiết, quỹ, TGNH | xlsx, zip | Soát BCTC |
| `8. SỔ SÁCH KẾ TOÁN\6. BẢNG TÍNH KHẤU HAO CCDC_TSCĐ` | Khấu hao, phân bổ | xlsx | Soát BCTC |
| `9. SỔ PHỤ NGÂN HÀNG\QUÝ n` | Sao kê ngân hàng | xlsx, csv | Soát BCTC |
| `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO` · `HĐ BÁN RA` | **Bảng kê tải từ cổng hóa đơn điện tử** (`<MST>_HDTQMuaVao <từ>_<đến>.xlsx`, `…_HDTQBanra …`) | xlsx | cả hai |
| `7. BỘ BÁO CÁO\BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_<kỳ>\BẢNG KÊ` | **Bảng kê xuất từ phần mềm kế toán** sau khi làm xong báo cáo quý (`To khai thue GTGT khau tru 01GTGT.xlsx`, `BANG KE HOA DON CHU.xlsx`…) | xlsx | cả hai |
| `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n` | Hóa đơn điện tử từng tờ: XML (126 file ở công ty khảo sát), PDF (12), HTML (118). Dùng để **xem chi tiết một hóa đơn** và dự phòng khi thiếu bảng kê | xml, pdf, html | cả hai |
| `6. LƯƠNG\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG` | Bảng lương **của khách**, để soát TNCN và BHXH (không liên quan phân hệ Tiền lương nội bộ) | xlsx | Soát BCTC |
| `5. BẢO HIỂM XÃ HỘI\1. C12` | Thông báo C12 của BHXH | pdf, xlsx | Soát BCTC |

### Đối chiếu bảng kê hóa đơn (theo quy trình nhân viên đang làm)

Quy trình (anh mô tả 25/10/2026, khớp với file đang có trên Drive):
1. Nhân viên tải **bảng kê mua vào / bán ra trên cổng hóa đơn điện tử** dạng Excel, bỏ vào
   `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO` / `HĐ BÁN RA`.
2. Làm xong báo cáo quý, nhân viên xuất **bảng kê mua vào / bán ra từ phần mềm kế toán** dạng Excel, bỏ
   vào `7. BỘ BÁO CÁO\BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_<kỳ>\BẢNG KÊ`.
3. App đọc cả hai, đối chiếu với nhau và với tờ khai đã nộp (XML trong `TỜ KHAI THUẾ`).

Ba mẫu Excel đã gặp trên Drive (đọc dòng tiêu đề, 25/10/2026):

| Nguồn | Mẫu | Cột chính |
| --- | --- | --- |
| Cổng HĐĐT | Danh sách hóa đơn, tiêu đề cột ở dòng 6, 15 cột | Ký hiệu mẫu số, ký hiệu, số, ngày lập, MST + tên đối tác, tổng tiền chưa thuế, thuế, chiết khấu thương mại, phí, thanh toán, đơn vị tiền, **trạng thái hóa đơn**, **kết quả kiểm tra hóa đơn** |
| Phần mềm kế toán, kiểu 1 | 1 file 3 sheet: tờ khai 01/GTGT, bảng kê bán ra, bảng kê mua vào; dòng nhóm theo thuế suất | Mẫu số, ký hiệu, số, ngày, đối tác, MST, giá trị chưa thuế, thuế, thuế được khấu trừ (mua vào), HĐ giảm thuế (bán ra) |
| Phần mềm kế toán, kiểu 2 | `BANG KE HOA DON CHU.xlsx`, 1 sheet có dòng nhóm | Số, ngày, người bán, MST, mặt hàng, giá trị, thuế suất, thuế, tài khoản thuế |

Cách đọc:
- **Nhận file theo nội dung** (dòng tiêu đề, tên cột), không theo vị trí ô hay tên thư mục. Thực tế đã có
  file bán ra để nhầm trong `HĐ MUA VÀO` (năm 2026, quý 2): app nhận đúng là bán ra và nhắc nhân viên.
- **Chiều mua/bán** xác định theo tên file + tiêu đề + MST công ty. Không tin nhãn cột: file mua vào
  của cổng vẫn ghi cột đối tác là "MST người mua".
- **Kỳ** lấy từ khoảng ngày trong tên file / tiêu đề cổng (`1-7-2025_30-9-2025`) và từ thư mục kỳ báo cáo.
- Đọc được cả bảng kê **chi tiết** (từng dòng hàng) của cổng nếu nhân viên tải bản chi tiết: cộng
  dồn theo hóa đơn trước khi đối chiếu.
- Mẫu phần mềm kế toán khác (Fast, Bravo…) thêm vào bằng một bảng ánh xạ tên cột, không phải sửa code.

Khóa ghép: **MST đối tác + ký hiệu (gộp mẫu số) + số hóa đơn** (bỏ số 0 đầu). Kết quả mỗi quý, chia mua
vào / bán ra, chỉ nêu sự việc:

| Nhóm kết quả | Nghĩa |
| --- | --- |
| Khớp | Có ở cả hai, tiền và thuế bằng nhau |
| Có trên cổng, chưa có trong phần mềm | Hóa đơn chưa đưa vào bảng kê đã khai |
| Có trong phần mềm, không có trên cổng | Kèm lý do app nhận ra được: ngày hóa đơn ngoài khoảng tra cứu (hóa đơn kỳ trước kê khai kỳ này), chứng từ nhập khẩu / biên lai (không có trên cổng HĐĐT), còn lại ghi "không tìm thấy" |
| Lệch tiền / thuế | Cùng hóa đơn, số tiền hoặc thuế khác nhau |
| Trạng thái trên cổng | Hóa đơn bị thay thế, bị điều chỉnh, đã hủy, hoặc kết quả kiểm tra không phải "đã cấp mã" mà phần mềm vẫn kê |
| Tổng ↔ tờ khai | Tổng bảng kê phần mềm ↔ [23] [24] [26]–[35] tờ khai đã nộp; sheet tờ khai trong file phần mềm ↔ XML đã nộp |

Bảng kê **không thay** hóa đơn XML/PDF: bấm một hóa đơn trong kết quả thì app mở file XML/PDF của chính
hóa đơn đó (nếu có trong thư mục) để xem dòng hàng. Thiếu bảng kê cổng của quý nào thì app dựng tạm bảng kê
từ file XML/PDF/HTML trong thư mục, ghi rõ "dựng từ file hóa đơn, có thể thiếu".

App cũng dùng bảng kê để dò hóa đơn trùng, hóa đơn từ 5 triệu trả tiền mặt (ghép với sổ quỹ), và đối chiếu
[23]/[24]/[34]/[35].

### Đọc file PDF

Khảo sát PDF ở công ty THỊNH PHÁT (2024–2026; chỉ đếm số ký tự trích được, không mở nội dung):

| Thư mục | PDF có chữ | PDF ảnh scan | Lỗi mở |
| --- | --- | --- | --- |
| `2. HÓA ĐƠN MUA VÀO_BÁN RA` | 5 | 7 | 0 |
| `7. BỘ BÁO CÁO` | 40 | 15 | 2 |
| `8. SỔ SÁCH KẾ TOÁN` | 4 | 0 | 0 |
| `5. BẢO HIỂM XÃ HỘI` | 6 | 0 | 0 |

Vì vậy app đọc PDF theo hai đường, **cả hai đều chạy trên máy nhân viên, không gửi file đi đâu**:

1. **PDF có chữ** (hóa đơn do phần mềm HĐĐT xuất, tờ khai in từ HTKK/cổng thuế, BCTC, sổ sách,
   C12): trích chữ kèm vị trí bằng `pdfjs-dist`, chỉ nạp thư viện khi gặp file PDF. Bộ đọc theo từng
   loại giấy tờ: hóa đơn (ký hiệu, số, ngày, MST bán/mua, tiền hàng, thuế suất, tiền thuế, tổng thanh
   toán), tờ khai (số theo mã chỉ tiêu [xx]), BCTC (số theo mã số), C12, sổ sách dạng bảng.
2. **PDF ảnh scan**: nhận dạng chữ ngay trong trình duyệt bằng `tesseract.js` (có tiếng Việt). Bộ dữ
   liệu ngôn ngữ để sẵn trong `public/` của app, không tải từ trang ngoài. Chậm hơn, khoảng vài giây
   mỗi trang, nên chỉ chạy khi không có bản XML hoặc PDF có chữ của cùng giấy tờ.

Quy tắc chống sai số:
- **Thứ tự tin cậy: XML → PDF có chữ → HTML → PDF scan.** Cùng một hóa đơn (ghép theo MST người bán +
  ký hiệu + số hóa đơn) hoặc cùng một tờ khai (loại + kỳ + lần nộp) có nhiều bản thì chỉ lấy bản tin cậy
  nhất, không cộng hai lần.
- **Số đọc từ PDF phải tự khớp:** tiền hàng + tiền thuế = tổng thanh toán (hóa đơn), các dòng tổng của
  tờ khai và BCTC phải cộng đúng. Không khớp thì xếp **"Không đọc chắc chắn — mở file xem tay"**, không
  đưa vào phép tính.
- Số lấy từ PDF hiện nhãn nguồn **PDF** hoặc **Ảnh scan** cạnh con số. Tiêu chí chỉ dựa vào số từ ảnh
  scan thì ghi rõ "cần đối chiếu file gốc".
- PDF có mật khẩu hoặc hỏng: báo tên file, không bỏ qua im lặng.

**Quy tắc nhận diện thư mục** (lấy từ thực tế, tên giữa các năm và các công ty không đồng nhất):
- So bằng **số thứ tự + từ khóa đã chuẩn hóa** (dùng lại `chuanHoaTen`, `boSoThuTu` của
  `lib/tokhaiThuMuc.js`), không so nguyên tên. Ví dụ năm 2024 là `BAOCAOTAICHINH_THINHPHAT_2024`, năm
  2025 là `BỘ BÁO CÁO TÀI CHÍNH_2025_THỊNH PHÁT`, năm 2026 là `BỘ BÁO CÁO TÀI CHÍNH NĂM`.
- Đuôi `(kps)` / `(KPS)` ở tên thư mục = **công ty không phát sinh** loại hồ sơ đó (anh xác nhận
  25/10/2026): hiện "Không phát sinh", không báo "Thiếu", và tiêu chí cần hồ sơ đó coi là không phát sinh
  chứ không phải thiếu dữ liệu.
- Không dò tự động thư mục công ty theo tên, giữ đúng nguyên tắc anh chốt ngày 28/09 cho Tờ khai.
- File `.rar` trình duyệt không mở được: báo "cần giải nén", không bỏ qua im lặng. File `.zip` mở được.
- Không chắc một file thuộc loại nào thì **hỏi người dùng**, không đoán.

---

## 1b. Phạm vi năm: 2026 trở đi, năm cũ trỏ thư mục riêng

- **Mặc định** hai phân hệ chỉ đọc thư mục năm **2026 trở đi** trong cây công ty (`2. HỒ SƠ KẾ TOÁN\<năm>\…`).
  Ô chọn năm chỉ có 2026, 2027…; dải kỳ của Soát kỳ bắt đầu từ T01/Q1 2026.
- **Năm 2025 trở về trước — khi cần:** nút **"Thêm dữ liệu năm cũ"** → nhân viên chọn thư mục đã tải sẵn dữ liệu
  năm đó (thư mục năm cũ của công ty, hoặc một thư mục riêng do nhân viên tải về). App đọc bằng **cùng quy tắc nhận
  diện** (mục 1), không đòi đúng cây chuẩn. Tay cầm thư mục nhớ trong trình duyệt của máy đó (như Tờ khai), không
  lưu lên Supabase. Năm cũ hiện nhãn **"Năm cũ · thư mục trỏ riêng"** ở thanh công ty.
- **Chỗ năm 2026 cần số của năm 2025** — thiếu thì dòng đó hiện "Thiếu hồ sơ năm 2025 — trỏ thư mục năm cũ", các
  dòng khác vẫn chạy:

| Kiểm tra năm 2026 | Cần từ năm 2025 | Thay thế khi chưa trỏ năm cũ |
| --- | --- | --- |
| Chuỗi khấu trừ kỳ đầu năm: [22] T01 / Q1 = [43] kỳ cuối 2025 | Tờ khai T12 hoặc Q4/2025 | — (thiếu hồ sơ) |
| Ngưỡng 50 tỷ cho kỳ khai 2026 | Σ[34] cả năm 2025 | Cột "năm trước" của KQKD trong BCTC 2026 (khi đã có) |
| Rủi ro thuế: số đầu năm (R05, R23–R27…), chuyển lỗ (R20) | BCĐKT / CĐTK cuối 2025, phụ lục 03-2 các năm trước | Cột "đầu năm" của BCĐKT trong BCTC 2026 |
| Tăng trưởng: % so cùng kỳ năm trước, mốc đổi phí trước 2026 | 6 chỉ tiêu theo quý năm 2025 | Chỉ hiện % so quý trước trong năm 2026 |
| Nhiều năm (Rủi ro thuế, Soát xét) | Dữ liệu các năm cũ | Chỉ hiện năm 2026 |

- **Hệ quả về thời điểm:** phân tích **cả năm 2026** (39 tiêu chí đủ bộ, soát xét BCTC năm) cần BCTC và quyết toán 2026
  → có số từ **quý 1/2027**. Trong năm 2026 dùng được ngay: **Soát kỳ** (T10–T12 / Q4/2026), **Rủi ro thuế lũy kế
  tạm tính**, **Tăng trưởng** (so quý trước). Thứ tự lộ trình đề xuất lại ở mục 5.
- Mockup đang hiện số năm 2025 / 2023–2025 chỉ để minh họa; app thật mở mặc định năm 2026.

---

## 2. Kiến trúc: không có dữ liệu khách nào rời khỏi Drive

```
Drive công ty (G:\Shared drives\…\<Công ty>)           Trình duyệt nhân viên (Chrome/Edge)             Vercel / Supabase
────────────────────────────────────────────           ────────────────────────────────────            ─────────────────────────
2. HỒ SƠ KẾ TOÁN\Năm <năm>\…  ── chỉ đọc ──────────→  lib/phanTich/thuMuc.js (nhận diện cây)
                                                      lib/phanTich/doc/*  (đọc XML, Excel, CSV, PDF)
                                                      Web Worker tính 39 tiêu chí / soát BCTC
                                                      Bộ nhớ đệm trên máy (IndexedDB), khóa
                                                      = đường dẫn + cỡ + ngày sửa file
                                                      → Màn hình số liệu phân tích (chỉ xem)
                                                      → (tùy chọn) tải Excel về máy
                                                      Đăng nhập, danh sách công ty, phân quyền  ←──  có sẵn (không đổi)
```

Giai đoạn này **không lưu gì lên Supabase**, kể cả dòng trạng thái cho trưởng phòng (anh chốt 25/10/2026:
chạy ổn định rồi mới tính). Không có bảng mới. File SQL duy nhất là thêm quyền `xem_phi_de_xuat` (mục 3b).

- **Vercel chỉ phục vụ mã chương trình.** Không có API route nào nhận file hay số liệu của khách, nên
  không vướng giới hạn 4,5 MB và không tốn dung lượng Supabase.
- **Nguồn đúng là Drive.** Bộ nhớ đệm trên máy chỉ để mở lần sau nhanh hơn. Xóa đi thì app đọc lại từ
  Drive, không mất gì. File đổi ngày sửa hoặc cỡ là tự đọc lại.
- **App chỉ đọc.** Xin quyền đọc (`mode: 'read'`) khi trỏ thư mục, không bao giờ ghi, đổi tên hay xóa
  file trong Drive. Số liệu trên màn hình luôn là số trong file hiện có; muốn đổi số thì kế toán sửa
  file gốc rồi bấm "Đọc lại".
- **Không có ô nhập tay.** Các thông tin bản offline bắt nhập tay thì app tự tìm trong hồ sơ: số hoàn
  thuế (quyết định hoàn trong `11. CÁC THÔNG BÁO_CÔNG VĂN`, hoặc [42] tờ khai), lỗ còn được chuyển
  (phụ lục 03-2 của các năm trước), ý kiến kiểm toán (BCTC đã kiểm toán), có ngoại tệ (sổ 1112/1122/413).
  Không tìm thấy thì tiêu chí đó hiện **"Thiếu dữ liệu" kèm tên file cần có**, không đoán.
- Hai người mở cùng một công ty cùng lúc không ảnh hưởng nhau, vì không ai ghi gì.
- **Đọc chậm lần đầu:** Google Drive cho máy tính có thể chỉ tải file khi được mở. App đọc theo nhu cầu
  của từng phân hệ (Rủi ro thuế chỉ cần mục 7, bảng cân đối tài khoản, công nợ và hóa đơn) và hiện tiến
  độ từng file.
- **Trình duyệt:** chỉ Chrome/Edge trên máy tính (File System Access API), giống Tờ khai.
- **Ai được dùng:** **mọi nhân viên kế toán**, mỗi người chỉ mở được công ty mình phụ trách chính/phụ;
  trưởng phòng cả phòng, admin tất cả, giống phạm vi của Tờ khai (`lib/checklistScope.js`,
  `lib/clientRoom.js`, không đọc `clients.room_id`). Không cần quyền riêng; người chỉ thuộc phòng
  KD/HCNS (`noAccounting`) không thấy mục menu. Lọc phạm vi chạy ở máy chủ khi trả danh sách công ty.
- **KHÔNG đưa vào bản clone** (ABS, NYD, Linh Phong). Làm module rời như Ngân hàng: gom trong
  `app/soatbaocao`, `app/ruirothue`, `lib/phanTich`, `lib/ruiro`, `lib/soatbaocao`, `components/phanTich` và
  2 mục menu, để khi dựng bản clone chỉ việc bỏ các thư mục đó. Lúc code xong thì ghi vào `AGENTS.md` và
  `docs/clone-app-checklist.md` như mục Ngân hàng.

### Thư mục mã

| Thư mục | Nội dung |
| --- | --- |
| `lib/phanTich/thuMuc.js` | Đi cây `2. HỒ SƠ KẾ TOÁN\Năm <năm>`, nhận loại tài liệu theo bảng ở mục 1 |
| `lib/phanTich/doc/` | Bộ đọc: tờ khai XML (dùng chung `lib/tokhaiXml.js` khi được), BCTC XML/Excel, bảng cân đối tài khoản, sổ sách, công nợ, kho, sao kê, **hóa đơn điện tử XML/PDF/HTML** |
| `lib/phanTich/doc/pdf/` | Trích chữ PDF (`pdfjs-dist`), nhận dạng ảnh scan (`tesseract.js`, chạy trong Web Worker), bộ đọc theo loại giấy tờ, kiểm tự khớp |
| `lib/phanTich/boNhoDem.js` | Bộ nhớ đệm trên máy (chỉ để mở lại nhanh) |
| `lib/phanTich/chinhSach.js`, `maSo.js` | Thư viện chính sách theo thời kỳ; mapping mã số TT99/TT133/TT200 |
| `lib/ruiro/` | 39 tiêu chí, chỉ số; ngưỡng và điểm để riêng một file, tắt bằng cờ `CHAM_DIEM = false` |
| `lib/soatbaocao/` | 8 nhóm kiểm tra, 203 quy tắc, 35 chỉ số, đặc thù ngành |
| `app/ruirothue/`, `app/soatbaocao/`, `components/phanTich/` | Giao diện |

**Chuyển phần nghiệp vụ:** công thức, ngưỡng, quy tắc viết lại thành mã Savitax (module ES, tên biến
tiếng Việt như phần còn lại của repo). Kiểm bằng dữ liệu mẫu: số ra phải **khớp từng đồng** với bản
offline (mục 5), trừ đúng các chỗ sửa lỗi ở mục 6.

---

## 3. Giao diện: làm mới theo app Savitax

- Dùng khung có sẵn: `AppShell`, menu trái `Sidebar` (nhóm Kế toán), màu thương hiệu đỏ đô `#8B1A1A`
  và vàng `#C9A84C`, Tailwind. Dùng lại thành phần chung của Tờ khai (`components/tokhaiUI.js`: `Chip`,
  `OTong`, `ThanhPhanTram`, bảng màu `MAU`) để hai phân hệ trông cùng một app.
- Menu: **🔎 Soát xét báo cáo** (`/soatbaocao`), **⚖️ Rủi ro thuế** (`/ruirothue`). Ở hồ sơ công
  ty thêm nút **Phân tích** mở thẳng công ty đó.
- Bố cục mỗi phân hệ (gọn hơn bản offline, theo kiểu trang Tờ khai):
  1. **Hồ sơ dữ liệu:** cây thư mục công ty theo năm, mỗi loại tài liệu Đã có / Thiếu kỳ / Không phát
     sinh / Không đọc được, bấm vào là thấy file nguồn.
  2. **Kết quả:** ô tổng (số tiêu chí có chênh lệch, số tiêu chí thiếu dữ liệu / không phát sinh), bảng
     tiêu chí có lọc theo nhóm và mã rủi ro, **sắp theo tỷ lệ chênh lệch lớn nhất**.
  3. **Chi tiết:** số SL1/SL2 kèm file nguồn (tên file, sheet, ô), nguyên nhân thường gặp, căn cứ đúng
     năm, hồ sơ cần chuẩn bị. Chỉ xem, không có ô nhập.
  4. **Nhiều năm:** số liệu, chênh lệch và chỉ số qua các năm.
  5. **Tải Excel** (qua `lib/excelDep.js`) về máy người xem, không ghi vào Drive.
- **Chỉ hiện tỷ lệ, chưa đánh giá** (anh chốt 25/10/2026, ngưỡng chưa chốt):
  - Tiêu chí đối chiếu: SL1, SL2, chênh lệch (đồng) và **tỷ lệ chênh lệch** = chênh lệch ÷ số lớn hơn.
  - Tiêu chí số dư: số dư và các tỷ lệ của nó (vd phải thu khác / tổng tài sản, tăng so với đầu năm, số
    ngày thu tiền bình quân), không kết luận.
  - **Tạm ẩn:** điểm rủi ro, xếp loại Cao/Trung bình/Thấp, màu đỏ/vàng/xanh, thuế ảnh hưởng ước tính.
    Soát xét báo cáo cũng vậy: tạm ẩn "điểm tin cậy số liệu" và "điểm sức khỏe tài chính", 35 chỉ số chỉ
    hiện giá trị, chưa so ngưỡng ngành.
  - Lỗi tính toán không phụ thuộc ngưỡng thì vẫn báo, vì đó là số liệu sai chứ không phải đánh giá: bảng
    cân đối không cân, tờ khai cộng sai, hóa đơn trùng, số đầu năm khác số cuối năm trước.
  - Ngưỡng và điểm vẫn chuyển sang mã nhưng để tắt; anh chốt ngưỡng thì bật lại, không phải viết lại.
- Hướng dẫn sử dụng **soạn mới dưới tên Savitax**, không chuyển tài liệu cũ.
- **Kiểu giao diện chung cho cả 2 phân hệ** (anh yêu cầu 25/10/2026, đồng bộ với màn Tăng trưởng & phí), làm thành
  component dùng chung trong `components/phanTich/`:
  - Bảng: đầu bảng nền đỏ đô chữ trắng; **mỗi dòng là một dải tách rời** (khoảng cách 6px), **xen kẽ 2 màu nền**
    (trắng / xanh nhạt), **không vạch màu đầu dòng**; dòng nhóm nền vàng nhạt.
  - Ô tổng: vạch màu trên đầu, nền ánh màu, số to cùng màu.
  - Tiêu đề mục có vạch đỏ đô; tiêu đề thẻ nền ánh đỏ nhạt.
  - Ô "có chênh lệch" nền vàng nhạt — đánh dấu để mắt dừng lại, không phải đánh giá.

### Mockup (duyệt trước khi code)

Ở `docs/mockup-phan-tich/` (HTML tĩnh, dữ liệu giả lập) và ảnh chụp ở `docs/mockup-phan-tich/anh/`.
Chụp lại sau khi sửa: `node scripts/chup-mockup-phan-tich.mjs [tên-file.html]`. Số liệu màn Rủi ro thuế lấy từ
kết quả bộ máy 39 tiêu chí chạy trên bộ dữ liệu mẫu giả lập (`du-lieu-mau.js`).

| Phân hệ | Màn hình |
| --- | --- |
| Rủi ro thuế | `ruiro-1-cong-ty` · `ruiro-2-ho-so-du-lieu` · `ruiro-3-bang-39-tieu-chi` · `ruiro-4-chi-tiet` (R01) · `ruiro-5-nhieu-nam` |
| Soát xét báo cáo | `soat-1-ho-so-du-lieu` · `soat-8-soat-ky` (công ty khai tháng, tick nhầm Quý) · `soat-9-soat-ky-quy` (công ty khai quý, soát bản chưa nộp) · `soat-2-tong-quan` · `soat-3-kiem-tra-gtgt` · `soat-4-bang-ke-hoa-don` · `soat-5-chi-so` · `soat-6-tang-truong` · `soat-7-bao-cao-khach-hang` |

---

## 3b. Dashboard tăng trưởng theo quý (báo cáo khách hàng + căn cứ điều chỉnh phí)

Thêm tab **Tăng trưởng & phí** trong phân hệ Soát xét báo cáo (anh yêu cầu 25/10/2026). Mục đích: báo cáo
với khách hàng tình hình hoạt động qua các quý, và lấy số liệu làm căn cứ tăng phí dịch vụ.

### 6 chỉ tiêu theo quý — lấy từ đâu

| Chỉ tiêu | Nguồn chính trong thư mục | Dự phòng khi thiếu nguồn chính |
| --- | --- | --- |
| 1. Doanh thu | Σ[34] tờ khai 01/GTGT các kỳ trong quý (bản nộp sau cùng) | Tổng tiền chưa thuế bảng kê bán ra cổng HĐĐT |
| 2. Số lao động trên bảng lương | Số người có lương trong bảng lương của khách (`6. LƯƠNG\1. BẢNG LƯƠNG…`), bình quân các tháng trong quý; tách có / không đóng BHXH (đối chiếu C12) | Chỉ tiêu tổng số người lao động trên 05/KK-TNCN của quý |
| 3. Số hóa đơn đầu vào | Số hóa đơn trên bảng kê mua vào cổng HĐĐT (không tính hóa đơn đã hủy, mỗi hóa đơn một lần) | Bảng kê phần mềm kế toán → file XML/PDF trong thư mục |
| 4. Số hóa đơn đầu ra | Số hóa đơn trên bảng kê bán ra cổng HĐĐT | như trên |
| 5. Số tờ khai hải quan | Số tờ khai (đếm theo số tờ khai, không theo số file) trong `4. TỜ KHAI HẢI QUAN`; thư mục `(kps)` = 0 | Dòng chứng từ nhập khẩu trên bảng kê mua vào của phần mềm |
| 6. Số giao dịch sao kê ngân hàng | Số dòng giao dịch trong sổ phụ `9. SỔ PHỤ NGÂN HÀNG\QUÝ n`, cộng mọi tài khoản | Sổ chi tiết TK 112 |

Mỗi con số có nhãn nguồn và bấm ra được file gốc như các màn khác. Quý thiếu nguồn hiện "—", không đoán.

### So sánh tăng trưởng

- Bảng quý × 6 chỉ tiêu, mặc định **8 quý gần nhất** (chọn được khoảng).
- Mỗi chỉ tiêu có **% so với quý trước** và **% so với cùng kỳ năm trước**, kèm đồ thị cột theo quý.
- Thêm dòng dẫn xuất **chứng từ/tháng = (HĐ đầu vào + HĐ đầu ra + giao dịch sao kê) ÷ 3** — đúng đơn vị
  biểu phí của phân hệ Kinh doanh (`lib/salesPricing.js`).
- **Mốc so sánh để tăng phí** = quý của lần đổi mức phí gần nhất (dòng `service_fees` loại `fee_plan`; chưa từng
  đổi thì lấy quý bắt đầu hợp đồng `contract_start`). App so khối lượng hiện tại với khối lượng ở mốc đó.

### Căn cứ điều chỉnh phí (dùng đúng engine biểu phí đang chạy)

- Đưa số thực tế vào **`computeFees` của `lib/salesPricing.js`** (một engine, không viết lại): chứng từ/tháng,
  có tờ khai hải quan hay không, doanh thu 4 quý gần nhất, kê khai tháng hay quý (`clients.report_type`). Ra
  **phí theo biểu phí hiện hành** kèm câu căn cứ engine đã sinh sẵn ("bậc từ 41 đến 50 chứng từ/tháng…",
  "vượt bậc cao nhất, áp dụng biểu phí theo doanh thu…") và các cảnh báo của engine (vd doanh thu trên 30 tỷ
  là "thỏa thuận", cần Giám đốc duyệt).
- **Mọi số phí hiển thị đều GỒM VAT** (anh chốt 25/10/2026). `clients.monthly_fee` đã gồm VAT; biểu phí
  `salesPricing` là **chưa VAT** (báo giá in "Giá trên chưa bao gồm thuế GTGT"), nên phí theo biểu phí × 1,08
  (cùng hằng số VAT phân hệ Lương đang dùng, để một chỗ) rồi mới so. Mọi ô phí ghi chú **"Giá đã bao gồm VAT"**.
- So với **phí đang thu** (quy về tháng với công ty thu theo quý) và **phí theo biểu phí ở mốc** → mức chênh và %.
- **Không cần nhóm ngành:** gọi engine với ngành mặc định (thương mại), không thêm cột vào hồ sơ công ty.
- **Phí đề xuất sửa được:** mặc định = phí theo biểu phí gồm VAT; trưởng phòng / admin sửa tay nếu thấy không phù
  hợp. Số sửa chỉ dùng cho màn hình và bản in lúc đó, **không lưu** (đúng nguyên tắc không lưu gì lên Supabase),
  đổi công ty hoặc tải lại trang là về mặc định. Bản in ghi số đã sửa.
- Nếu công ty từng có báo giá ở phân hệ Kinh doanh (dò theo MST) thì hiện thêm số liệu khảo sát lúc báo giá.
- **Chỉ đọc**: đọc `monthly_fee`, lịch sử phí, báo giá cũ qua một route có lọc phạm vi công ty. Không ghi gì, không
  tự tạo báo giá. (Nút "Tạo báo giá điều chỉnh" mở phân hệ Kinh doanh với số đã điền sẵn để GĐ 5, nếu anh muốn.)

### Bản gửi khách hàng

- Nút **Xem bản gửi khách hàng**: trang khổ A4, logo và màu Savitax, tiêu đề "Báo cáo tình hình hoạt động và khối
  lượng công việc kế toán", 6 đồ thị + bảng quý, nhận xét chỉ nêu số (vd "Số hóa đơn đầu vào quý 3/2026 tăng
  51% so với cùng kỳ"), mục **Đề xuất điều chỉnh phí dịch vụ** (mặc định bật, tắt được trước khi in).
- **Không hiện** cho khách: phí theo biểu phí ở mốc, cảnh báo nội bộ của engine, tên nhân viên phụ trách.
- Nhân viên không có quyền xem phí vẫn in được bản gửi khách, nhưng **không có** mục đề xuất phí.

### Ai thấy gì

| | Nhân viên phụ trách | Trưởng phòng, admin |
| --- | --- | --- |
| 6 chỉ tiêu, bảng quý, đồ thị | ✓ | ✓ |
| Khối "Căn cứ điều chỉnh phí", ô phí đề xuất | — | ✓ |
| Bản gửi khách có mục đề xuất phí | — | ✓ |

Gate bằng quyền mới `xem_phi_de_xuat` (`hasPermission`, không hard-code vai trò), gán sẵn cho vai trò trưởng
phòng; admin luôn có. Chỉ cần 1 file SQL nhỏ thêm dòng quyền, **không có bảng mới**. Máy chủ chỉ trả
`monthly_fee` và lịch sử phí cho người có quyền này.

### Màu sắc

Màn này sinh động hơn các màn soát xét (anh yêu cầu 25/10/2026): mỗi chỉ tiêu một màu riêng (thẻ, đồ thị, cột bảng
cùng màu), mũi tên tăng/giảm có màu, khối phí nền gradient đỏ đô → vàng thương hiệu. Bản gửi khách dùng cùng bộ
màu. Đây là màu để **phân biệt chỉ tiêu**, không phải màu đánh giá tốt/xấu.
- Tải **PDF** (in từ trình duyệt) và **Excel** (`lib/excelDep.js`) về máy người xem; không ghi vào Drive.

---

## 3c. Soát theo kỳ tháng / quý

Thêm tab **Soát kỳ** trong phân hệ Soát xét báo cáo (anh yêu cầu 26/10/2026). Đây là lúc dùng app nhiều nhất:
làm xong báo cáo tháng/quý là mở ra soát, kể cả **trước khi bấm nộp**.

### Kỳ của từng công ty

- **Kỳ khai cố định trọn năm tài chính** (anh chốt 26/10/2026). Chỉ đổi khi sang năm mới: quý → tháng khi
  doanh thu năm trước trên 50 tỷ. Trong một năm **không có** chuyện nửa tháng nửa quý.
- **Không bắt chọn tháng hay quý.** Nguồn đúng là **kỳ ghi trên tờ khai XML** của năm đó trong thư mục. Loại báo
  cáo tháng/quý trong hồ sơ công ty và kỳ khai riêng ở phân hệ Tờ khai chỉ để đối chiếu.
- **Bắt tick nhầm** — đổi kỳ giữa chừng thường là do nhân viên tick nhầm loại báo cáo (tháng → quý):
  - Loại báo cáo trong hồ sơ công ty **khác** kỳ trên tờ khai → dòng "Có chênh lệch", nhắc sửa hồ sơ công ty.
    App **không tự sửa** (chỉ đọc). Soát vẫn theo kỳ trên tờ khai.
  - Tờ khai trong **cùng một năm** lẫn cả tháng và quý → báo bất thường (tick nhầm khi nộp hoặc file để nhầm
    năm), không coi là đổi kỳ.
  - **Ngưỡng 50 tỷ:** doanh thu năm trước (Σ[34] cả năm) trên 50 tỷ mà năm nay vẫn khai quý → nêu sự việc để
    nhân viên xem lại.
- Chuỗi khấu trừ nối qua năm: [22] kỳ đầu năm = [43] kỳ cuối năm trước (kỳ cuối năm trước có thể là Q4 nếu
  năm trước khai quý).
- Thanh chọn: **Năm ▾** + dải các kỳ trong năm, mỗi kỳ có chấm trạng thái hồ sơ: đủ hồ sơ / thiếu / bản
  chưa nộp / chưa đến kỳ. Trạng thái tính từ thư mục mỗi lần mở, **không lưu**.
- Công ty khai tháng mà bảng kê cổng tải cả quý: app tự chia hóa đơn theo ngày vào từng tháng.

### Mỗi kỳ soát gì

| Kiểm tra | So giữa | Nguồn trong thư mục |
| --- | --- | --- |
| Kỳ khai | Kỳ trên tờ khai ↔ loại báo cáo trong hồ sơ công ty; cả năm cùng một loại kỳ; ngưỡng doanh thu năm trước 50 tỷ | Tờ khai cả năm + hồ sơ công ty trên app |
| Chuỗi khấu trừ | [22] kỳ này = [43] kỳ trước (kỳ đầu năm nối với kỳ cuối năm trước) | Tờ khai 2 kỳ liền nhau |
| Tờ khai tự khớp | [36] = [35] − [25]; [40], [41] đúng công thức | Tờ khai kỳ |
| Đầu vào | [23] [24] ↔ bảng kê cổng mua vào ↔ bảng kê phần mềm, chi tiết từng hóa đơn | `BAOCAOTHUE_<kỳ>\BẢNG KÊ`, `HĐ MUA VÀO` |
| Đầu ra | [26]–[35] ↔ bảng kê cổng bán ra ↔ bảng kê phần mềm | `HĐ BÁN RA`, `BẢNG KÊ` |
| Bảng kê phần mềm ↔ tờ khai | Sheet tờ khai trong file phần mềm ↔ XML | cùng thư mục kỳ |
| Hóa đơn bất thường | Bị thay thế / điều chỉnh / hủy mà vẫn kê; từ 5 triệu trả tiền mặt; ngày hóa đơn ngoài kỳ | Bảng kê cổng + sổ quỹ |
| TNCN kỳ | 05/KK-TNCN ↔ bảng lương (số người, thu nhập chịu thuế, thuế khấu trừ) | `6. LƯƠNG`, tờ khai TNCN |
| Bảo hiểm | Số người tham gia trên C12 ↔ số người đóng BHXH trên bảng lương | `5. BẢO HIỂM XÃ HỘI\1. C12` |
| Ngân hàng (nếu có sổ) | Sổ phụ ↔ sổ TGNH 112 trong kỳ | `9. SỔ PHỤ NGÂN HÀNG\QUÝ n` |

Kết quả mỗi dòng: **Khớp** / **Có chênh lệch** (kèm số và danh sách hóa đơn gây lệch) / **Thiếu hồ sơ** (kèm tên
file cần có). Chỉ nêu sự việc, không chấm điểm.

### Hồ sơ tối thiểu trong thư mục (3 mức)

Thiếu file nào thì **chỉ các dòng cần file đó** hiện "Thiếu hồ sơ" kèm tên file; các dòng khác vẫn chạy. Hướng
dẫn cho nhân viên: `docs/huong-dan-ho-so-soat-ky.md`.

| Mức | Hồ sơ | Để ở đâu | Mở được kiểm tra |
| --- | --- | --- | --- |
| **1 · bắt buộc** | Tờ khai 01/GTGT của kỳ (XML) | `BAOCAOTHUE_<kỳ>\TỜ KHAI THUẾ` (bản đã nộp, phân hệ Tờ khai tự tải) hoặc `BAOCAOTHUE_<kỳ>\BẢNG KÊ` (bản xuất HTKK chưa nộp) | Tờ khai tự khớp |
| **1 · bắt buộc** | Bảng kê mua vào + bán ra tải từ cổng HĐĐT (Excel) | `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO`, `HĐ BÁN RA` | [24], [34] ↔ cổng; hóa đơn thay thế/hủy, ngoài kỳ |
| 2 · nên có | Bảng kê xuất từ phần mềm kế toán (Excel) | `BAOCAOTHUE_<kỳ>\BẢNG KÊ` | Từng hóa đơn chưa vào phần mềm, lệch tiền; file phần mềm ↔ XML |
| 2 · nên có | Tờ khai 01/GTGT kỳ trước | `BAOCAOTHUE` kỳ trước (kỳ đầu năm: kỳ cuối năm trước) | Chuỗi [22] = [43] |
| 2 · nên có | Tờ khai các kỳ trong năm và năm trước | các thư mục `BAOCAOTHUE` | Kỳ khai, ngưỡng 50 tỷ, tick nhầm |
| 3 · có thì soát thêm | 05/KK-TNCN (XML) + bảng lương các tháng (Excel) | `TỜ KHAI THUẾ`; `6. LƯƠNG\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG` | Số người, thu nhập chịu thuế, thuế khấu trừ |
| 3 · có thì soát thêm | C12 tháng cuối kỳ | `5. BẢO HIỂM XÃ HỘI\1. C12` | Người đóng BHXH ↔ bảng lương |
| 3 · có thì soát thêm | Sổ phụ ngân hàng + sổ chi tiết TK 112 | `9. SỔ PHỤ NGÂN HÀNG\QUÝ n`; `8. SỔ SÁCH KẾ TOÁN\8. SỔ CHI TIẾT…` | Sổ phụ ↔ sổ TGNH |
| 3 · có thì soát thêm | Sổ quỹ tiền mặt | `8. SỔ SÁCH KẾ TOÁN\1. PHIẾU THU_PHIẾU CHI` | Hóa đơn từ 5 triệu trả tiền mặt |
| 3 · có thì soát thêm | Bảng cân đối tài khoản lũy kế | `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI KHOẢN…` | Rủi ro thuế lũy kế (R07, R08) |

Thư mục đuôi `(kps)` = không phát sinh → không báo thiếu. Excel giữ nguyên như tải từ cổng / xuất từ phần mềm; tờ
khai chỉ cần XML; bảng kê cổng tải cả quý là đủ cho công ty khai tháng; file `.rar` phải giải nén.

### Soát trước khi nộp

- XML tờ khai xuất từ HTKK **trước khi nộp** có cùng định dạng bản nộp thật. Nhân viên để file này trong
  `BAOCAOTHUE_<kỳ>\BẢNG KÊ` cùng 2 bảng kê → app soát ngay, lệch thì sửa kịp trước hạn.
- Trên màn hình ghi rõ đang soát **"bản chưa nộp"** hay **"bản đã nộp"** (bản phân hệ Tờ khai đã tải về
  `TỜ KHAI THUẾ`). Có cả hai thì so luôn hai bản với nhau.
- Hạn nộp và trạng thái nộp của kỳ lấy từ dữ liệu phân hệ Tờ khai đã có (chỉ đọc, qua route lọc phạm vi công ty).

### Rủi ro thuế giữa năm

39 tiêu chí cần BCTC và quyết toán năm nên vẫn là việc cuối năm. Giữa năm, phân hệ Rủi ro thuế có chế độ
**"Lũy kế đến kỳ — tạm tính"** cho các tiêu chí chỉ cần tờ khai GTGT và sổ sách (R02, R03, R04, R05, R07, R08…);
tiêu chí còn lại ghi "chờ BCTC / quyết toán". Màn Soát kỳ hiện tóm tắt phần này ở cột phải.

---

## 4. Thương hiệu: xóa sạch đơn vị cũ

- Bản offline Rủi ro thuế còn **10 chỗ** ghi tên hoặc mã của đơn vị cũ, bản Check BCTC còn **29 chỗ**
  (tên công ty, tiền tố khóa dữ liệu, tên kho trình duyệt, nhãn tài liệu). Thêm vào đó là các tài liệu
  Word nhúng sẵn.
- Khi chuyển: đổi tên mọi khóa và trường dữ liệu, bỏ chú thích ghi nguồn, không chép tài liệu Word nhúng.
  Repo, commit, tài liệu và giao diện **không nhắc tới đơn vị cũ**.
- Bộ kiểm `scripts/test-phantich-thuong-hieu.mjs` quét toàn bộ mã và bản build tìm các từ khóa cấm. Danh
  sách từ khóa **để ngoài repo** (như file mẫu của bộ kiểm ngân hàng), để chính repo không chứa các tên đó.

---

## 5. Lộ trình

| GĐ | Việc | Xong khi | Ước lượng |
| --- | --- | --- | --- |
| **0** ✅ | Soát lỗi phần nghiệp vụ Check BCTC bằng 8 bộ dữ liệu mẫu. Ghi kết quả của 2 bản offline làm mốc so sánh. Khảo sát cây thư mục thêm 5–10 công ty ở các phòng (chỉ đọc tên thư mục và đuôi file) để chốt bảng nhận diện | **XONG 26/10/2026** — xem mục 9 | 1 ngày |
| **1** | Lớp đọc thư mục (chỉ đọc): `thuMuc`, bộ đọc XML/Excel/CSV/HTML, **bảng kê cổng HĐĐT + 2 mẫu bảng kê phần mềm kế toán**, **PDF có chữ**, bộ nhớ đệm, màn hình **Hồ sơ dữ liệu** | Trỏ thư mục công ty khảo sát → hiện đủ tài liệu từng năm; đọc lại lần 2 không tải lại file chưa đổi; không có lệnh ghi nào tới Drive | 2 tuần |
| **1b** | **PDF ảnh scan**: `tesseract.js` trong Web Worker, bộ đọc hóa đơn và tờ khai từ ảnh, kiểm tự khớp | Hóa đơn scan mẫu đọc đúng số; số không tự khớp thì xếp "Không đọc chắc chắn" | 1 tuần |
| **2** | Rủi ro thuế: `lib/ruiro`, giao diện mới, tự tìm các thông tin trước đây nhập tay, tải Excel. Sửa các lỗi ở mục 6 | `test-ruiro-mau` khớp mốc GĐ 0 (trừ đúng chỗ sửa lỗi, có ghi lý do) | 2 tuần |
| **3** | Soát xét báo cáo: `lib/soatbaocao`, Web Worker cho sổ lớn, giao diện mới, màn **Bảng kê hóa đơn** (đối chiếu cổng HĐĐT ↔ phần mềm kế toán ↔ tờ khai) | `test-soatbaocao-mau`: 8 bộ mẫu × 4 năm bắt đủ lỗi cài sẵn, số khớp mốc | 3–4 tuần |
| **3a** | **Soát kỳ tháng/quý**: dải kỳ theo kỳ trên tờ khai (cố định cả năm), bắt tick nhầm loại báo cáo, 10 nhóm kiểm tra mỗi kỳ, soát bản chưa nộp, Rủi ro thuế "lũy kế đến kỳ — tạm tính" | `test-phantich-soatky`: bộ mẫu có hồ sơ công ty tick nhầm Quý, năm lẫn tháng/quý, doanh thu năm trước > 50 tỷ, bản chưa nộp, chuỗi [22]/[43] đứt một chỗ (cả chỗ nối năm) — app bắt đúng | 1 tuần |
| **3b** | **Dashboard tăng trưởng & phí**: đếm 6 chỉ tiêu theo quý, % so quý trước / cùng kỳ / mốc đổi phí, chạy `computeFees` trên số thực tế, bản gửi khách hàng (PDF, Excel) | `test-phantich-tangtruong`: bộ mẫu 11 quý ra đúng số đếm; phí theo biểu phí khớp `computeFees` gọi tay | 1–1,5 tuần |
| **4** | Hai phân hệ dùng chung tài liệu đã đọc; nút Phân tích ở hồ sơ công ty; ghi `AGENTS.md` + danh sách loại khỏi bản clone | Đọc một lần, mở được cả hai phân hệ | 3–5 ngày |
| **5** | (Sau khi chạy ổn định, anh quyết) chốt ngưỡng → bật điểm/xếp loại; lưu dòng trạng thái cho trưởng phòng; AI viết nhận xét; nối Checklist/KPI | — | sau khi chạy thật |

### Thứ tự làm đề xuất theo phạm vi năm 2026 (26/10/2026 — chờ anh duyệt)

Vì chỉ soát từ năm 2026, phần có số **ngay trong năm 2026** làm trước; phần cần BCTC / quyết toán năm 2026 làm sau,
xong trước mùa quyết toán (hạn nộp BCTC, quyết toán năm 2026: 31/03/2027).

| Thứ tự | GĐ | Dùng được cho | Mốc nên xong |
| --- | --- | --- | --- |
| 1 | **1** Lớp đọc thư mục + bảng kê + PDF có chữ + màn Hồ sơ dữ liệu, kèm nút "Thêm dữ liệu năm cũ" | Nền cho mọi phần sau | giữa tháng 11/2026 |
| 2 | **3a** Soát kỳ tháng/quý | Kỳ T11, T12 (hạn 20/12/2026, 20/01/2027) và Q4/2026 (hạn 31/01/2027) | cuối tháng 11/2026 |
| 3 | **3b** Tăng trưởng & phí | Rà phí đầu năm 2027 với số Q1–Q4/2026 | giữa tháng 12/2026 |
| 4 | **2** Rủi ro thuế (39 tiêu chí đủ bộ năm 2026 + lũy kế tạm tính) | Soát trước khi nộp quyết toán 2026 | cuối tháng 1/2027 |
| 5 | **3** Soát xét báo cáo năm (BCTC 2026) | Soát BCTC 2026 trước 31/03/2027 | cuối tháng 2/2027 |
| 6 | **1b** PDF ảnh scan, **4** liên thông, **5** | Sau khi chạy ổn định | — |

Bộ kiểm chạy bằng **dữ liệu mẫu giả lập**: `test-phantich-thumuc` (cây thư mục giả theo đúng cấu trúc
thật), `test-phantich-doc`, `test-phantich-pdf` (hóa đơn/tờ khai PDF có chữ và ảnh scan tự dựng), `test-phantich-bangke` (bảng kê cổng + phần mềm tự dựng đúng 3 mẫu thật, có sẵn các ca: thiếu, thừa, lệch tiền, hóa đơn bị thay thế, file để nhầm thư mục), `test-ruiro-mau`, `test-soatbaocao-mau`, `test-phantich-thuong-hieu`. Thử
trên thư mục công ty thật chỉ **đọc**, không ghi, và phải được anh đồng ý trước.

---

## 6. Lỗi đã tìm thấy ở bản Rủi ro thuế 3.2.0 (sửa trong GĐ 2)

Đã chạy lại bộ máy của bản offline bằng dữ liệu mẫu đi kèm (CÔNG TY TNHH MẪU RỦI RO, 2023–2025):

| Lỗi | Hậu quả | Cách sửa |
| --- | --- | --- |
| R05/R06: `nz(cdtk.tk133.dn_dau) ?? bcdkt.thue_gtgt_kt.dau` — `nz()` đổi trống thành 0 nên không bao giờ lấy số BCĐKT | Thiếu bảng cân đối tài khoản → báo **Cao** sai (mẫu 2023: "khấu trừ vượt 120 triệu", trong khi BCĐKT ghi đúng 120 triệu) | Bỏ `nz()` |
| R20: chưa nhập "lỗ còn được chuyển" thì coi là 0 | Mọi công ty có chuyển lỗ bị **Cao**. Mẫu 2025: Cao; nhập 500 triệu → Thấp | Tự tính từ phụ lục 03-2 các năm trước trên Drive; thiếu năm thì "Thiếu dữ liệu" |
| Giải trình khớp chênh lệch chính → đặt mức về "Không" | Mất luôn kiểm tra phụ (R02-b/c, R12-b). Mẫu 2025: R02 Trung bình → Không | Hết lỗi vì bỏ phần giải trình |
| Thang 0–100 nhưng ngưỡng "Rủi ro cao" ≈ 14,5 (60/415 điểm thô) | 15/100 mà "Rủi ro cao", người đọc hiểu nhầm | Tạm không gặp vì chưa hiện điểm. Khi bật lại: hiện điểm thô /415 hoặc đổi thang |
| Mẫu số điểm cố định 415 | Thiếu dữ liệu làm điểm thấp đi (bỏ QT TNDN 2025: 40,2 → 30,6) | Tạm không gặp. Khi bật lại: hiện "đã đánh giá x/39 tiêu chí" cạnh điểm |

---

## 7. Đã chốt (25/10/2026)

| Câu hỏi | Anh chốt | Áp vào kế hoạch |
| --- | --- | --- |
| Lưu dòng trạng thái lên Supabase cho trưởng phòng xem tổng hợp? | Tạm thời chưa lưu, ổn định rồi tính | Mục 2: không lưu gì; GĐ 5 |
| Đuôi `(kps)` ở tên thư mục? | Công ty không phát sinh | Mục 1: hiện "Không phát sinh", không báo thiếu |
| Ai được dùng? | Mọi nhân viên, theo công ty phụ trách | Mục 2: phạm vi như Tờ khai, không cần quyền riêng |
| Đưa vào bản clone? | Không | Mục 2: module rời, ghi vào danh sách loại khỏi bản clone |
| Ngưỡng điểm và trọng số? | Chưa chốt, chỉ hiện tỷ lệ | Mục 3: tạm ẩn điểm, xếp loại, màu, thuế ảnh hưởng ước tính |

Không còn câu hỏi nào chặn việc bắt đầu GĐ 0.

Đổi tên (25/10/2026): **Rủi ro thuế 39 tiêu chí → Rủi ro thuế**, **Soát xét BCTC → Soát xét báo cáo**
(route `/ruirothue`, `/soatbaocao`).

## 8. Dashboard tăng trưởng & phí — đã chốt (25/10/2026)

| Câu hỏi | Anh chốt |
| --- | --- |
| Cơ sở VAT khi so phí | Phí hiển thị luôn gồm VAT; phí đề xuất cũng gồm VAT, ghi chú "Giá đã bao gồm VAT" |
| Nhóm ngành theo biểu phí | Chưa cần; phí đề xuất sửa được nếu thấy không phù hợp |
| Ai xem phần phí | Trưởng phòng, admin |
| Màu màn Tăng trưởng & phí | Sinh động hơn |
| Mặc định in mục đề xuất phí | Chưa trả lời — kế hoạch tạm để **mặc định bật** cho trưởng phòng / admin |

---

## 9. Kết quả GĐ 0 (26/10/2026)

### 9.1 File mốc (dữ liệu mẫu giả lập, để so khớp từng số khi viết lại)

| File | Nội dung |
| --- | --- |
| `scripts/du-lieu-mau-phantich/moc-ruiro-3.2.0.json` | 39 tiêu chí × 2023–2025 (mức, SL1, SL2, chênh lệch, điểm cũ) + 2 ca lỗi đã chứng minh kèm kết quả mong đợi |
| `scripts/du-lieu-mau-phantich/ruiro-mau/` | 42 file mẫu gốc (XML 01/GTGT kể cả bổ sung, 03/TNDN, BCTC Excel TT133) — cho bộ kiểm đọc file |
| `scripts/du-lieu-mau-phantich/moc-soatbctc-v3.json` | 8 loại hình × 2023–2026 = 32 dòng: cân đối, đối chiếu chéo, vấn đề (mã, mức, tiền), 35 chỉ số, điểm cũ; mã lỗi cài sẵn. Chạy 2 lần ra cùng sha256 |

Cả ba đã quét: không có tên / mã đơn vị cũ (kể cả thuộc tính file Excel).

### 9.2 Soát bản offline Check BCTC V3

- **Lỗi cài sẵn trong bộ mẫu: app bắt được cả 30 mã** (ở mức từng chứng từ). Một ca "CT_LO du lịch 2025" không có lỗ
  thật do bộ sinh chia chi phí đều — lỗi dữ liệu, không phải lỗi app.
- **14 lỗi logic đã chứng minh** (ca tái hiện → sai → đúng). Sửa khi viết lại `lib/soatbaocao` (GĐ 3):

| Mã | Lỗi | Hậu quả |
| --- | --- | --- |
| B1 | ROE/ROA thiếu số liệu bị nhân thành 0% | Chỉ số sai "Thấp" thay vì "Thiếu số liệu" |
| B2 | Đoán chỉ tiêu 05/KK-TNCN bằng quan hệ cộng | Kỳ thuế TNCN nhỏ: lấy nhầm thu nhập làm thuế → 3 báo động giả |
| B3 | Một ngày khóa sổ cho cả hồ sơ nhiều năm | Năm 2026 báo ~650 chứng từ "sau khóa sổ" giả; năm cũ ghi lùi ngày lại không báo |
| B4 | Liên kết năm trước dung sai "≤ 1 tài khoản lệch" | Lệch đúng 1 tài khoản (vd 1121 lệch 5 triệu) không báo |
| B5 | Sai chỉ số mảng khi kỳ là quý | Kiểm giá vốn/doanh thu theo tháng không bao giờ chạy |
| B6 | Đơn vị BCTC "nghìn/triệu" không quy đổi | ~50 báo động giả, điểm tin cậy 93 → 69 |
| B7 | Ngưỡng miễn thuế TNDN viết cứng, không theo thư viện chính sách | DN miễn thuế 2026 bị báo "không ghi chi phí thuế" |
| B8 | Từ khóa "phạt" không có ranh giới từ | "phát sinh" bị coi là tiền phạt |
| B9 | Từ khóa nhạy cảm so trên chuỗi đã bỏ dấu | "biểu mẫu", "bảo hành" bị coi là quà biếu / chi phí chủ DN |
| B10 | Tài khoản ngân hàng không có giao dịch bị bỏ khỏi tổng sao kê | Báo lệch số dư bằng đúng số dư tài khoản đó |
| B11 | "Hóa đơn chưa thanh toán qua NH" chỉ dò tên người bán trong sao kê | 12 hóa đơn đã chuyển khoản bị báo chưa thanh toán |
| B12 | Mỗi dòng lương được giảm trừ trọn vẹn | Tháng có thêm dòng thưởng: tính lại TNCN sai, quyết toán cộng 13 tháng giảm trừ |
| B13 | Kiểm "chưa thanh toán qua NH" tự tắt khi TẤT CẢ đều chưa thanh toán | Ca nặng nhất lại không báo |
| B14 | Tờ khai thiếu [24] bị coi là 0, còn lấy [28] (đầu ra) thay | Báo lệch đầu vào 1,4 tỷ giả |

- **Nghi ngờ chưa chứng minh** (kiểm lại khi viết): tỷ lệ BH viết cứng ở một chỗ, từ khóa "khoản chi / mua cho / chi khác" và
  "phí" dễ bắt nhầm, năm nhuận luôn 365 ngày, cờ −1 trùng giá trị thật; chế độ TT133 và kỳ 6/9 tháng gần như chưa được bộ
  mẫu chạy tới.
- **Dữ liệu mẫu tự sai — biết để không tưởng là lỗi khi so mốc:** 242 dư Có từ năm thứ 2; 33311 bù trừ vào 1331 ở bộ
  thương mại (lệch 60,6 triệu); giá thành không mang dở dang đầu kỳ; thuế suất TNDN 15%/17% cho 2023–2024 và chi phí thuế
  × 1,04 (TNDN_D lệch ở cả 32 dòng); lương phải trả cộng dồn; lương đóng BH 2026 dưới tối thiểu vùng. Bộ kiểm mới đánh dấu
  các vấn đề này là "do dữ liệu mẫu".
- Chưa chạy được headless (cần trình duyệt): đọc file XLSX/PDF/XML của bản offline — sẽ do bộ đọc mới và bộ kiểm riêng lo.

### 9.3 Khảo sát cây thư mục — 11 công ty, 8 phòng nghiệp vụ (chỉ tên thư mục, đuôi file)

- **Cây chuẩn rất đều:** 11/11 công ty có `2. HỒ SƠ KẾ TOÁN`; trong năm luôn có đủ `1.` → `11.` đúng tên chuẩn (thêm `12. HÌNH ẢNH
  ĐÍNH KÈM` ở 1 công ty). Biến thể chỉ ở `3. HỢP ĐỒNG KHÁC (…)`, `4. BỘ BÁO CÁO TỜ KHAI HẢI QUAN`.
- **Thư mục năm KHÔNG đồng nhất:** `2025` (trơn) 9/16, `NĂM 2025` 3, `2. NĂM 2025` / `1. Năm 2025`… → nhận theo **4 chữ số năm**,
  bỏ số thứ tự, không đòi chữ "Năm".
- **Không phát sinh** viết nhiều kiểu: `(kps)`, `(KPS)`, `( KPS )`, `(ko phát sinh)` — nhận cả bốn, kể cả ở cấp con (`HĐ BÁN RA (KPS)`).
- **Thư mục kỳ trong `BỘ BÁO CÁO THUẾ…`:** đa số `BAOCAOTHUE -Q1`; còn `BAOCAOTHUE_Q1.2025_<mã KH>`, `BAOCAOTHUE QUY 1_2025_…`,
  `BÁO CÁO THUẾ_QUÝ 1.2025`, `1. BAOCAOTHUE_…_QUY1_…`, `BCT Q1-…` → nhận theo **"BAO CAO THUE / BCT" + Q/QUÝ/T + số kỳ (+ năm)**;
  thư mục cha cũng có thể là `1. BỘ BÁO CÁO THUẾ QUÝ`.
- **Trong thư mục kỳ:** `BẢNG KÊ` (112), `TỜ KHAI THUẾ` (111), `TB CHẤP NHẬN` (96) / `THÔNG BÁO CHẤP NHẬN` (21) / `TBCN`, `TỜ KHAI`,
  `BẢNG KÊ HĐ MV-BR`… → bảng tên tương đương như `TEN_TUONG_DUONG` của Tờ khai.
- **Trong `2. HÓA ĐƠN…\QUÝ n`:** `HĐ MUA VÀO` / `HĐ BÁN RA` gần như mọi nơi; có công ty để file hóa đơn trong `XML <từ ngày>_<đến ngày>`,
  `HTML …`.
- **Bảng kê phần mềm trong `BẢNG KÊ`:** `BANG KE HOA DON CHU.xlsx` phổ biến nhất (47); `Bang_ke_hoa_don_chung_tu_hang_hoa_dich_vu_
  mua_vao/ban_ra_mau_quan_tri.xlsx` (28) — **cùng bộ cột** với BANG KE HOA DON CHU, thêm `Tờ khai`, `Kỳ kê khai`, tiêu đề cột ở
  dòng 6 hoặc 8; `To khai thue GTGT khau tru 01GTGT.xlsx` (11); vài file tự đặt tên. ⚠ Mẫu "mẫu quản trị" **không có cột ký
  hiệu hóa đơn** → khóa ghép dự phòng: **MST đối tác + số hóa đơn + ngày**.
- **Bảng kê cổng HĐĐT mới có ở vài công ty** (`<MST>_HDTQMuaVao/Banra …`, `<MST> - Mua vào - Tổng quan - …`) → bước "tải bảng kê
  cổng" là **việc mới** với đa số nhân viên; cần đưa vào hướng dẫn và checklist khi chạy thật. Mẫu "Tổng quan" chưa đọc được
  tiêu đề (chưa gặp file trong thời gian quét) — lấy mẫu ở GĐ 1.
- Đuôi file trong `Năm 2025–2026` của 11 công ty: pdf 1.479, xml 1.309, html 301, xlsx 259, **jpg 237** (ảnh chụp chứng từ —
  chưa nằm trong phạm vi đọc), zip 38, **rar 35**, xls 19.

### 9.4 Lỗi tìm thấy ngoài phạm vi (phân hệ Tờ khai đang chạy)

`laCungThuMuc` / `moThuMuc` (`lib/tokhaiThuMuc.js`) so tên thư mục năm với `Năm <năm>`; `boSoThuTu` chỉ bỏ "2. " nên thư mục tên trơn
**`2025`** không khớp → khi tải tờ khai, app **tạo thêm thư mục `Năm 2025` bên cạnh `2025`** và ghi file vào đó. 8 thư mục năm
trong mẫu khảo sát đặt tên trơn; chưa thấy công ty nào bị tạo trùng. Đề xuất sửa riêng (một phiên khác), không gộp vào phân hệ này.
