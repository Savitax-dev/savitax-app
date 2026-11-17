# Danh mục địa danh hành chính: nguồn, cách chuẩn hoá, kiểm tra

Dựng ngày **01/11/2026** để chọn địa chỉ trụ sở trong hồ sơ đăng ký doanh nghiệp (phân hệ Pháp lý).
Dữ liệu tính đến **01/11/2026**: 34 tỉnh/thành và **3.321** đơn vị cấp xã (709 phường, 2.599 xã, 13 đặc khu).

| File | Nội dung | Số dòng |
|---|---|---|
| `tinh.csv` | `ma_tinh, ten_tinh, loai (tinh/thanh_pho), ghi_chu` | 34 |
| `xa.csv` | `ma_xa, ten_xa, loai (phuong/xa/dac_khu), ma_tinh, ten_tinh, ghi_chu` | 3.321 |
| `phong-dkkd.csv` | `ma_tinh, ten_tinh, ten_phong, ten_co_quan, ten_tren_cong, tinh_tren_cong, dia_chi, so_dien_thoai, email, nguon` | 34 |

Cả 3 file đều là UTF-8 **có BOM** và xuống dòng CRLF, nên Excel mở đúng tiếng Việt. Mã tỉnh và mã xã là chuỗi giữ nguyên số 0 đầu ("01", "00070"). Khi mở bằng Excel phải nhập dạng Text, nếu không Excel sẽ cắt mất số 0.

---

## 1. Nguồn đã dùng

Các file gốc được tải ngày 01/11/2026 vào `scratchpad\tai-ve-dia-danh\` (không đưa vào repo).

| # | Văn bản / nguồn | Cơ quan | Ban hành | Hiệu lực | URL tải | Vai trò |
|---|---|---|---|---|---|---|
| 1 | **Quyết định 19/2025/QĐ-TTg** ban hành Bảng danh mục và mã số các đơn vị hành chính Việt Nam (Phụ lục I: cấp tỉnh, Phụ lục II: cấp xã) | Thủ tướng Chính phủ (PTTg Thường trực Nguyễn Hòa Bình ký) | 30/06/2025 | 01/07/2025 | https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/19ttg.signed.pdf (Cổng TTĐT Chính phủ ký số 04/07/2025; trang thuộc tính: https://vanban.chinhphu.vn/?pageid=27160&docid=214409, https://congbao.chinhphu.vn/van-ban/quyet-dinh-so-19-2025-qd-ttg-45430.htm) | **Văn bản pháp lý gốc.** 143 trang ảnh quét, không trích được chữ. Dùng để lấy mã 34 tỉnh và đối chiếu tổng số xã/phường/đặc khu của từng tỉnh |
| 2 | **Phụ lục I kèm Công văn 1027/CTK-CSCL** "Danh mục và mã số các đơn vị hành chính cấp xã" | Cục Thống kê (Bộ Tài chính), cơ quan quản lý mã ĐVHC theo QĐ 19 | 25/06/2025 | áp dụng 01/07/2025 | https://www.nso.gov.vn/wp-content/uploads/2025/06/Danh-sach-va-ma-so-cac-don-vi-hanh-chinh-cap-xa.pdf | **Nguồn dữ liệu chính cho từng xã** (PDF có lớp chữ, 112 trang, đủ 3.321 dòng: STT, mã, tên, tỉnh) |
| 3 | **Công văn 1123/CTK-CSCL** thông báo mã số và tên ĐVHC mới, gồm các thay đổi từ **02/07/2025 đến 30/04/2026** | Cục Thống kê | 05/05/2026 | — | Bản sao trên trang một trường THCS ở Ninh Bình: https://thcsminhthuan.ninhbinh.edu.vn/wp-content/uploads/2026/05/CV-thong-bao-toan-quoc.pdf (luatvietnam.vn có ghi nhận văn bản này nhưng khoá nội dung) | Thay đổi đợt 1 (Đồng Nai). ⚠ Chưa tìm được bản đăng trên nso.gov.vn, xem mục 5 |
| 4 | **Nghị quyết 30/2026/QH16** thành lập thành phố Đồng Nai | Quốc hội | 24/04/2026 | 30/04/2026 | Toàn văn: https://xaydungchinhsach.chinhphu.vn/nghi-quyet-so-30-2026-qh16-thanh-lap-thanh-pho-dong-nai-119260430102336551.htm | Tỉnh Đồng Nai thành **Thành phố Đồng Nai**, mã 75 giữ nguyên |
| 5 | **Nghị quyết 237/NQ-UBTVQH16** thành lập 10 phường thuộc tỉnh Đồng Nai | UBTVQH | thông qua 14/04/2026 (báo chí ghi ngày ký 23/4) | 30/04/2026 | Nêu trong CV 1123 (nguồn 3); tin: https://xaydungchinhsach.chinhphu.vn/thanh-lap-10-phuong-thuoc-tinh-dong-nai-119260421072221129.htm | 10 xã chuyển thành phường, mã giữ nguyên |
| 6 | **Nghị quyết 388/NQ-UBTVQH16** về việc thành lập các phường thuộc tỉnh Bắc Ninh (Công báo số 495 ngày 28/08/2026) | UBTVQH (Chủ tịch QH Trần Thanh Mẫn ký) | 04/08/2026 | **20/09/2026** | https://congbao.chinhphu.vn/van-ban/nghi-quyet-so-388-nq-ubtvqh16-470313.htm (đã tải file PDF Công báo và đọc trực tiếp bản quét) | 12 xã chuyển thành phường, giữ nguyên địa giới |
| 7 | **Cổng thông tin quốc gia về đăng ký doanh nghiệp**, trang "Cơ quan đăng ký kinh doanh các tỉnh, thành phố" | Bộ Tài chính | — | tra ngày 01/11/2026 | https://dangkykinhdoanh.gov.vn/vn/Pages/Phongdangkykinhdoanh.aspx. Dữ liệu lấy qua chính lệnh AJAX trang này gọi: `/_layouts/15/NCS.Control.QTDKDN/Ajax/SearchPhongDKKD.ashx` với `TinhID`, `DonviHC=1` (Sở Tài chính) | Tên phòng, địa chỉ, điện thoại, email của cơ quan ĐKKD cấp tỉnh |

Nguồn phụ chỉ dùng để đối chiếu, không lấy số liệu: bài "Bảng danh mục và mã số của 34 tỉnh thành mới…" trên
xaydungchinhsach.chinhphu.vn (mã 34 tỉnh khớp QĐ 19); tin baoquocte.vn và nhandan.vn về NQ 388 (danh sách 12 phường khớp bản Công báo).

**Độ tin cậy**
- Mã và tên tỉnh: cao. Lấy từ QĐ 19 Phụ lục I và đã đọc trực tiếp trên bản quét.
- Mã và tên xã: cao. Nguồn là file chữ của Cục Thống kê. Tổng số theo loại của **cả 34 tỉnh** đã khớp với dòng "Tổng số đơn vị hành chính cấp xã: …, gồm … xã, … phường, … đặc khu" ở đầu mỗi tỉnh trong Phụ lục II QĐ 19 (đọc trên ảnh quét). Một số mã/tên đã được soi ngẫu nhiên trên ảnh quét và đều khớp (VD 00004 Ba Đình, 21172 Trương Quang Trọng, 22015 Tuy Hòa, 23497 Kon Braih, 31237 Vĩnh Trinh, 32248 Đất Mũi). **Chưa so từng dòng** trong 3.321 dòng với bản quét QĐ 19, vì không có OCR.
- Thay đổi sau 07/2025: Đồng Nai lấy từ công văn Cục Thống kê (bản sao ở trang trường học). Bắc Ninh lấy từ Công báo gốc.
- Phòng ĐKKD: tên lấy nguyên từ cổng quốc gia. Tuy vậy, cổng này **chưa cập nhật hết sau sắp xếp**, xem mục 5.

---

## 2. Cách chuẩn hoá

1. Trích chữ từ PDF của nguồn 2 bằng `pdftotext -layout -enc UTF-8`. Lấy mọi dòng khớp mẫu `STT  mã(5 số)  tên`, được đúng **3.321 dòng**, STT liền 1→3.321 và không có dòng thừa.
2. Gán tỉnh cho từng xã **theo tiêu đề nhóm tỉnh** (dòng "THÀNH PHỐ HÀ NỘI", "TỈNH CAO BẰNG"…), không theo cột "Tỉnh (thành phố)". Lý do: khi trích chữ, cột tỉnh ở 42 dòng cuối mỗi nhóm bị dính tên tỉnh kế tiếp (VD 00430 Xã Đa Phúc hiện "Tỉnh Cao Bằng"). Cả 42 dòng này đã được kiểm lại: đều là dòng cuối nhóm, và số đếm theo tiêu đề khớp QĐ 19.
3. Mã tỉnh lấy theo QĐ 19 Phụ lục I. Tên tỉnh viết đầy đủ "Tỉnh …"/"Thành phố …". Bản CV 1027 có chỗ viết tắt "Tp Hải Phòng", "Tp Đà Nẵng", nay đã viết đầy đủ.
4. `loai` của xã lấy theo tiền tố tên: "Phường " → `phuong`, "Xã " → `xa`, "Đặc khu " → `dac_khu`. Không có tên nào ngoài 3 tiền tố này.
5. Tên xã giữ **đúng chính tả của nguồn**: kiểu bỏ dấu "Hòa"/"Hóa" (không phải "Hoà"), có số La Mã/Ả Rập (VD "Xã A Lưới 2", "Phường Móng Cái 3"), dấu nháy ’ (U+2019) trong tên Tây Nguyên ("Xã Ea M’Droh", "Xã Cư M’gar", "Xã M’Drắk"…). Chỉ gộp khoảng trắng thừa.
6. Áp các thay đổi sau 01/07/2025 (mục 3). Mã giữ nguyên theo QĐ 19 Điều 2: mã số không đổi khi đơn vị hành chính đổi tên hoặc chuyển từ nông thôn sang thành thị. Cột `ghi_chu` ghi tên cũ và văn bản căn cứ.
7. Phòng ĐKKD: `ten_tren_cong` giữ nguyên chữ in hoa của cổng. `ten_phong` viết lại dạng câu ("Phòng Đăng ký kinh doanh…"). `ten_co_quan` = `ten_phong` + " - Sở Tài chính tỉnh/thành phố <tên>", theo Nghị định 168/2025/NĐ-CP (hiệu lực 01/07/2025): cơ quan đăng ký kinh doanh cấp tỉnh là phòng thuộc Sở Tài chính. Địa chỉ, điện thoại và email chép nguyên văn từ cổng.

Script chuẩn hoá nằm ngoài repo (`scratchpad\lam-viec\phan-tich.mjs`, `xuat.mjs`) và chỉ đọc các file đã tải.

---

## 3. Thay đổi sau 07/2025 đã áp vào dữ liệu

| Hiệu lực | Văn bản | Thay đổi | Mã |
|---|---|---|---|
| 30/04/2026 | NQ 30/2026/QH16 | "Tỉnh Đồng Nai" → **"Thành phố Đồng Nai"** (trực thuộc TW, `loai = thanh_pho`); áp cho cả 95 dòng xã của Đồng Nai | 75 |
| 30/04/2026 | NQ 237/NQ-UBTVQH16 + CV 1123/CTK-CSCL | Xã → Phường: Lộc Ninh (25270), Tân Khai (25357), Đồng Phú (25363), Tân Phú (26116), Trị An (26170), Trảng Bom (26248), Dầu Giây (26326), Long Thành (26368), Xuân Lộc (26425), Nhơn Trạch (26485) | giữ nguyên |
| 20/09/2026 | NQ 388/NQ-UBTVQH16 | Xã → Phường (Bắc Ninh): Yên Phong (09193), Tiên Du (09319), Chi Lăng (09313), Phù Lãng (09292), Lương Tài (09496), Gia Bình (09454), Nhân Thắng (09475), Hiệp Hòa (07840), Bố Hạ (07294), Lạng Giang (07375), Kép (07399), Lục Nam (07444) | giữ nguyên (xem mục 5) |

Sau khi áp: Đồng Nai có 95 đơn vị gồm 33 phường và 62 xã, **khớp NQ 237**. Bắc Ninh có 99 đơn vị gồm 45 phường và 54 xã, **khớp Điều 1 khoản 2 NQ 388**.
Toàn quốc thay đổi từ 687 phường / 2.621 xã / 13 đặc khu (QĐ 19) sang **709 / 2.599 / 13**. Tổng vẫn là 3.321, không có đơn vị nào nhập, chia hay xoá.

---

## 4. Số đếm và kiểm tra

**Tổng:** 34 tỉnh/thành (28 tỉnh, 6 thành phố trước 30/4/2026; nay **27 tỉnh, 7 thành phố**). Cấp xã có **3.321** đơn vị: 709 phường, 2.599 xã, 13 đặc khu.

Bảng dưới là số liệu sau khi áp thay đổi. Cột "khớp QĐ 19" so với số liệu trước khi áp thay đổi.

| Mã | Tỉnh/thành | Tổng | Phường | Xã | Đặc khu |
|---|---|---|---|---|---|
| 01 | Thành phố Hà Nội | 126 | 51 | 75 | 0 |
| 04 | Tỉnh Cao Bằng | 56 | 3 | 53 | 0 |
| 08 | Tỉnh Tuyên Quang | 124 | 7 | 117 | 0 |
| 11 | Tỉnh Điện Biên | 45 | 3 | 42 | 0 |
| 12 | Tỉnh Lai Châu | 38 | 2 | 36 | 0 |
| 14 | Tỉnh Sơn La | 75 | 8 | 67 | 0 |
| 15 | Tỉnh Lào Cai | 99 | 10 | 89 | 0 |
| 19 | Tỉnh Thái Nguyên | 92 | 15 | 77 | 0 |
| 20 | Tỉnh Lạng Sơn | 65 | 4 | 61 | 0 |
| 22 | Tỉnh Quảng Ninh | 54 | 30 | 22 | 2 |
| 24 | Tỉnh Bắc Ninh | 99 | 45 | 54 | 0 |
| 25 | Tỉnh Phú Thọ | 148 | 15 | 133 | 0 |
| 31 | Thành phố Hải Phòng | 114 | 45 | 67 | 2 |
| 33 | Tỉnh Hưng Yên | 104 | 11 | 93 | 0 |
| 37 | Tỉnh Ninh Bình | 129 | 32 | 97 | 0 |
| 38 | Tỉnh Thanh Hóa | 166 | 19 | 147 | 0 |
| 40 | Tỉnh Nghệ An | 130 | 11 | 119 | 0 |
| 42 | Tỉnh Hà Tĩnh | 69 | 9 | 60 | 0 |
| 44 | Tỉnh Quảng Trị | 78 | 8 | 69 | 1 |
| 46 | Thành phố Huế | 40 | 21 | 19 | 0 |
| 48 | Thành phố Đà Nẵng | 94 | 23 | 70 | 1 |
| 51 | Tỉnh Quảng Ngãi | 96 | 9 | 86 | 1 |
| 52 | Tỉnh Gia Lai | 135 | 25 | 110 | 0 |
| 56 | Tỉnh Khánh Hòa | 65 | 16 | 48 | 1 |
| 66 | Tỉnh Đắk Lắk | 102 | 14 | 88 | 0 |
| 68 | Tỉnh Lâm Đồng | 124 | 20 | 103 | 1 |
| 75 | Thành phố Đồng Nai | 95 | 33 | 62 | 0 |
| 79 | Thành phố Hồ Chí Minh | 168 | 113 | 54 | 1 |
| 80 | Tỉnh Tây Ninh | 96 | 14 | 82 | 0 |
| 82 | Tỉnh Đồng Tháp | 102 | 20 | 82 | 0 |
| 86 | Tỉnh Vĩnh Long | 124 | 19 | 105 | 0 |
| 91 | Tỉnh An Giang | 102 | 14 | 85 | 3 |
| 92 | Thành phố Cần Thơ | 103 | 31 | 72 | 0 |
| 96 | Tỉnh Cà Mau | 64 | 9 | 55 | 0 |

Trong QĐ 19, Bắc Ninh là 33 phường/66 xã và Đồng Nai là 23 phường/72 xã. 32 tỉnh còn lại không đổi so với QĐ 19.

**Các kiểm tra đã chạy (đều đạt):**
- 3.321 dòng trích được = 3.321 trong QĐ 19 / CV 1027. STT liền 1→3.321, không có dòng lạ.
- Trùng mã xã: 0. Mã không đủ 5 chữ số: 0.
- Xã không có tỉnh, hoặc mã tỉnh không thuộc 34 mã: 0.
- Trùng tên trong cùng một tỉnh: 0. Tên có khoảng trắng thừa: 0. Tên không bắt đầu bằng Phường/Xã/Đặc khu: 0.
- Tổng theo loại (xã/phường/đặc khu) của **cả 34 tỉnh** khớp dòng tổng của từng tỉnh trong Phụ lục II QĐ 19. Các dòng tổng này đọc trên ảnh quét.
- Tổng toàn quốc 2.621 xã + 687 phường + 13 đặc khu = 3.321 khớp các số đã công bố của QĐ 19.
- Đồng Nai và Bắc Ninh sau khi áp thay đổi khớp đúng số mà nghị quyết ghi.
- 10 mã Đồng Nai trong CV 1123 trùng đúng 10 xã cùng tên trong danh mục. 12 tên xã Bắc Ninh trong NQ 388 đều có đúng 1 "Xã …" tương ứng trong tỉnh 24.
- `phong-dkkd.csv`: 34/34 tỉnh đều có đúng 1 phòng ĐKKD thuộc "Sở Tài chính" trên cổng.

---

## 5. Điểm còn nghi ngờ, cần anh xem

1. **Mã của 12 phường Bắc Ninh chưa có thông báo của Cục Thống kê.** CV 1123 chỉ tính tới 30/04/2026, và em chưa tìm thấy công văn nào sau NQ 388. Em giữ mã cũ vì QĐ 19 Điều 2 quy định đổi loại hình thì không đổi mã, đúng như Cục Thống kê đã làm với Đồng Nai. Dù vậy anh nên kiểm lại khi Cục Thống kê ra công văn mới.
2. **CV 1123/CTK-CSCL chỉ có bản sao** trên trang một trường THCS ở Ninh Bình. Nội dung khớp với NQ 30, NQ 237 và tin chính phủ. Chưa thấy bản trên nso.gov.vn vì trang tra cứu danh mục hành chính (danhmuchanhchinh.gso.gov.vn) không phân giải được tên miền.
3. **Thay đổi đang chờ, chưa áp**: HĐND tỉnh Gia Lai ngày 21/10/2026 đã tán thành chủ trương thành lập **5 phường mới** trong năm 2026. Đây mới là chủ trương địa phương, chưa có nghị quyết UBTVQH. Bộ Nội vụ (07/2026) cho biết sẽ không sắp xếp lại xã đồng loạt, nhưng từng địa phương vẫn có thể lên phường. Em đã tìm thêm các nghị quyết UBTVQH16 từ 05/2026 tới 01/11/2026 và chỉ thấy NQ 388. Em không duyệt được toàn bộ danh mục Công báo, nên **nên soát lại định kỳ** (Công báo, mục văn bản UBTVQH, và các công văn "thông báo mã số và tên ĐVHC mới" của Cục Thống kê).
4. **Cổng ĐKKD quốc gia chưa cập nhật hết sau sắp xếp:**
   - Danh sách chọn tỉnh vẫn là **63 tỉnh cũ**. Em lấy theo tên tỉnh được giữ lại (VD Tuyên Quang, mã cổng 5). Riêng Đồng Nai, cổng vẫn ghi "Tỉnh Đồng Nai" nhưng file đã ghi "Thành phố Đồng Nai", và `ten_co_quan` ghi "Sở Tài chính thành phố Đồng Nai" theo NQ 30 (cơ quan mang địa danh tự đổi tên từ 30/4/2026).
   - **Địa chỉ của nhiều phòng còn ghi đơn vị cũ** như quận, huyện, thành phố thuộc tỉnh (VD Hà Nội "Quận Hai Bà Trưng", Cao Bằng "Thành phố Cao Bằng", Tuyên Quang "thành phố Tuyên Quang"). Không dùng cột `dia_chi` để in hồ sơ nếu chưa sửa tay.
   - **Tên phòng mỗi tỉnh một kiểu**, không phải lúc nào cũng là "Phòng Đăng ký kinh doanh". Ví dụ: Hà Nội "Phòng Đăng ký kinh doanh và tài chính doanh nghiệp", Bắc Ninh và Hải Phòng "…và quản lý doanh nghiệp", Lào Cai và Ninh Bình "Phòng Doanh nghiệp", Quảng Ninh, Khánh Hòa và Đắk Lắk "Phòng Quản lý doanh nghiệp", Gia Lai "Phòng Doanh nghiệp và kinh tế tập thể", Vĩnh Long "Phòng Phát triển doanh nghiệp và kinh tế tập thể", An Giang "Phòng Doanh nghiệp - hợp tác đầu tư". Đây là tên cổng đang ghi, có thể khác quyết định tổ chức của từng Sở Tài chính. Trên giấy chứng nhận ĐKDN và các mẫu hồ sơ (Thông tư hướng dẫn NĐ 168), dòng "Kính gửi" thường chỉ ghi chung "Phòng Đăng ký kinh doanh – Sở Tài chính …". **Anh chốt 01/11/2026: tên riêng từng tỉnh. Pháp lý chốt 17/11/2026 cách ghi trên hồ sơ = cột `ten_ghi_ho_so` = "<tên phòng> <tên tỉnh>"** (VD "Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh"), không kèm "Sở Tài chính"; tên phòng mỗi tỉnh kiểm lại trên dangkykinhdoanh.gov.vn.
   - Bộ Tài chính đang soạn nghị định sửa NĐ 168/2025 về tổ chức cơ quan ĐKKD (tin 24/06/2026), nên tên và cấp cơ quan ĐKKD có thể đổi.
5. **Tên xã giữ đúng chính tả nguồn**, cụ thể:
   - Kiểu bỏ dấu "Hòa"/"Hóa". Cổng ĐKKD lại viết "Thanh Hoá"/"Khánh Hoà", nên khi so tên phải chuẩn hoá trước.
   - Dấu nháy cong ’ trong tên Tây Nguyên. Người dùng gõ dấu ' thẳng sẽ không khớp, ô tìm kiếm nên coi hai dấu này là một.
   - Chữ hoa/thường không đồng đều như ở nguồn ("Cư M’gar" và "Ea M’Droh").
6. **Chưa đối chiếu từng dòng** tên và mã của 3.321 xã với ảnh quét QĐ 19, chỉ soi mẫu và khớp tổng từng tỉnh. Nếu cần chắc tuyệt đối thì cần OCR bản quét để so, hoặc nhờ người soát vài tỉnh hay dùng như HCM, Hà Nội, Đồng Nai, Bình Dương cũ thuộc HCM.
   - **Xã Ia Mơ (Gia Lai)**: phụ lục CV 1027 ghi 23737, nhưng bản quét QĐ 19 (trang 90) và danh mục địa bàn thuế đều ghi
     **23938** → dùng 23938 (đã sửa 01/11/2026). Ngoài chỗ này, 3.320/3.321 mã xã của CV 1027 khớp nguồn thuế độc lập.
7. Mã xã **không** sắp theo tỉnh: một tỉnh mới gồm mã của nhiều tỉnh cũ (VD Lạng Sơn có cả 05977 và 06001). Muốn biết xã thuộc tỉnh nào thì phải đọc cột `ma_tinh`, không suy được từ dải mã.
