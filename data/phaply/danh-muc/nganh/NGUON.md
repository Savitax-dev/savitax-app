# Danh mục ngành kinh tế Việt Nam (VSIC 2025) — nguồn và cách lấy

Lập ngày 17/11/2026, dùng cho cây chọn ngành nghề của phân hệ Pháp lý. Mẫu 2/3/4 (TT 121/2026/TT-BTC) yêu cầu "tên và mã
theo ngành cấp 4 trong Hệ thống ngành kinh tế của Việt Nam".

## Văn bản hiện hành

- **Quyết định 36/2025/QĐ-TTg ngày 29/9/2025** của Thủ tướng Chính phủ ban hành Hệ thống ngành kinh tế Việt Nam.
- **Hiệu lực: 15/11/2025** (Điều 4 khoản 1).
- **Thay thế QĐ 27/2018/QĐ-TTg ngày 06/7/2018**: QĐ 27 hết hiệu lực từ 15/11/2025 (Điều 4 khoản 2).
- Gồm Phụ lục I (Danh mục, 5 cấp) và Phụ lục II (Nội dung). Điều 3 khoản 2 quy định số ngành: cấp 1 có 22 (A–V),
  cấp 2 có 87, cấp 3 có 259, cấp 4 có 495, cấp 5 có 743.
- **Văn bản sửa đổi tới 11/2026: không tìm thấy.** Đã tra web và Cổng ĐKDN, không thấy văn bản nào sửa QĐ 36. Chưa tra
  được Công báo / vbpl.vn (vbpl chặn truy cập tự động), nên chưa thể khẳng định chắc chắn.
- **Cổng thông tin quốc gia về đăng ký doanh nghiệp đang dùng VSIC 2025.** Trang "Tra cứu ngành nghề kinh doanh"
  (https://dangkykinhdoanh.gov.vn/vn/Pages/NganhNghe.aspx, đọc ngày 17/11/2026) có tiêu đề "HỆ THỐNG NGÀNH KINH TẾ VIỆT
  NAM 2025 (Ban hành kèm theo Quyết định số 36/2025/QĐ-TTg…)", cây đủ 5 cấp, đúng 22/87/259/495/743 mã.

## Nguồn đã dùng

| # | Nguồn | Vai trò | Ghi chú |
|---|-------|---------|---------|
| 1 | Bản toàn văn HTML của QĐ 36 trên ketoananpha.vn (https://ketoananpha.vn/quyet-dinh-36-2025-qd-ttg) | **Nguồn chính để trích** (bảng 6 cột Cấp 1–5 + Tên ngành của Phụ lục I) | Trang của bên thứ ba. Có dòng tổng cuối bảng "22 87 259 495 743", khớp đúng Điều 3 |
| 2 | Cổng ĐKDN: https://dangkykinhdoanh.gov.vn/vn/Pages/NganhNghe.aspx | **Kiểm chéo bằng máy, nguồn chính thống** | Cả 1.606 mục (cấp 1–5) trùng mã, cấp và tên **từng ký tự** với nguồn 1 (0 khác biệt). Thứ tự cấp 1–4 cũng trùng |
| 3 | Bản scan có chữ ký số, 483 trang, 43 MB, do luatvietnam.vn lưu: https://static3.luatvietnam.vn/uploaded/others/2025/10/01/quyet_dinh-36-2025-qd-ttg_0110161918.pdf | **Kiểm bằng mắt** so với bản gốc | Phụ lục I nằm ở trang PDF 4–41 (số in 1–38). Bản này là ảnh, không có lớp chữ |
| 4 | Cổng Chính phủ: https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/36-ttg.signed.pdf | Xác nhận số hiệu, ngày | Chữ ký số của Cổng TTĐT Chính phủ, ký lúc 01/10/2025 12:05. Chỉ có phần quyết định (ảnh scan), không kèm phụ lục |

Bản sao các tệp đã tải (dữ liệu chưa kiểm chứng, không đưa vào repo) để ở
`C:\Users\win\AppData\Local\Temp\claude\713e623ce7287656\cc2b79b0-0558-40ca-8a3e-fee7be10d17a\scratchpad\vsic\tai-ve\`.

## Cách lấy

1. Tách bảng Phụ lục I từ HTML nguồn 1 (đoạn giữa neo `chuong_pl_1_name` và `chuong_pl_2`): 1.068 hàng × 6 cột. Bỏ hàng
   tiêu đề và hàng tổng. Giải mã thực thể HTML; không còn thực thể nào chưa biết.
2. Kiểm cấu trúc: mã đúng số chữ số theo cấp. Mỗi mã có tiền tố khớp mã cha (cấp 3 bắt đầu bằng mã cấp 2…). Không trùng
   mã, không hàng trống tên. Kết quả: 0 lỗi.
3. Kiểm chéo với cây trên Cổng ĐKDN (nguồn 2). Kết quả: 0 khác biệt trên 1.606 mục.
4. Kiểm bằng mắt 14 trang scan (nguồn 3), gồm trang 5, 16–20, 25–29, 33, 39, 40. Các trang này phủ khoảng 37% Phụ lục I và
   21/24 mã kiểm thử (trừ 2592, 7710, 7721). Mọi dòng xem được đều khớp mã và tên.

`vsic.csv` chỉ giữ cấp 1→4 (đủ để dựng cây; Mẫu 2/3/4 yêu cầu cấp 4). `ma_cha`: cấp 2 → chữ cái cấp 1, cấp 3 → mã cấp 2,
cấp 4 → mã cấp 3. Thứ tự hàng giữ đúng thứ tự Phụ lục I. Tên giữ nguyên văn bản gốc, kể cả cách bỏ dấu không đồng nhất
(vd "điều hoà", "hàng hóa"), viết hoa ở cấp 1.

## Số dòng mỗi cấp (`vsic.csv`)

| Cấp | Số mã | Theo Điều 3 |
|-----|-------|-------------|
| 1 | 22 | 22 |
| 2 | 87 | 87 |
| 3 | 259 | 259 |
| 4 | 495 | 495 |
| Tổng | 863 | |

## Đối chiếu với danh mục cũ của phòng (`doi-chieu-ban-cu.csv`)

Danh mục cũ lấy từ `D:\savitax-phaply\Mau-Phap-Ly\1.TLM_Congty_chinhanh_diadiemkinhdoanh_VPDD\NHAP\6. TLM_CHINHANH_1TV.xlsx`,
sheet "MaNganh" (6.474 dòng, có kèm mô tả). Tách ra được 21 cấp 1, 88 cấp 2, 240 cấp 3 và **432 cấp 4**.

⚠ **Danh mục cũ KHÔNG phải VSIC 2018, mà gần với VSIC 2007.** Dấu hiệu:
- Còn mã `4100 Xây dựng nhà các loại` chưa tách.
- Không có 4101/4102, 4211/4212, 4221–4229, 4291–4299. Theo hiểu biết của người lập, các mã này đã có từ VSIC 2018.
- Còn các mã 2007 như `6201`, `6202`, `6209`, `4511`, `4520`.

Vì vậy cột "moi" gồm cả những mã đã có từ năm 2018. Phần này chưa đối chiếu với văn bản QĐ 27/2018.

| Loại | Số mã cấp 4 | Ý nghĩa |
|------|-------------|---------|
| moi | 135 | Có ở VSIC 2025, không có trong file cũ |
| bo | 72 | Có trong file cũ, không còn ở VSIC 2025 (vd 4100, 4669, 4791, 4799, 6201, 6202, 6209, 8211, 9639) |
| doi_ten | 105 | Cùng mã, tên khác về nội dung |
| (không ghi vào CSV) | 28 | Chỉ khác cách viết: hoá/hóa, thuỷ/thủy, dấu phẩy, viết hoa. Mã: 0311, 0312, 0321, 0322, 0891, 1080, 1512, 1520, 1629, 2011, 2021, 2029, 2100, 2310, 2396, 2431, 3530, 3821, 3822, 4933, 5022, 5120, 5210, 5222, 5224, 6411, 8411, 8552 |

⚠ **Mã được dùng lại với nghĩa khác hẳn.** Đây là nhóm nguy hiểm nhất khi chuyển hồ sơ cũ, vì giữ nguyên mã là đăng ký sai
ngành. Các mã này nằm trong `doi_ten`:
- 1104
- 4661, 4662, 4663 (cũ là nhiên liệu / kim loại / vật liệu xây dựng; mới là ô tô / phụ tùng / mô tô; vật liệu xây dựng nay
  là **4673**)
- 4762, 4763, 4781, 4782
- 5510, 5812, 6110, 6120, 6492, 6530, 8129, 8413
- 8531, 8532, 8542, 8691, 8692, 9610

Ngoài ra nhiều mã đổi phạm vi: 7020 thêm "tư vấn quản lý kinh doanh"; 3311–3319 thêm "bảo dưỡng"; các mã 47xx bỏ đuôi
"trong các cửa hàng chuyên doanh".

## Kiểm thử 24 mã trong hồ sơ đã nộp tháng 9–10/2026

**Cả 24 mã đều có trong VSIC 2025:** 2592, 4321, 4312, 4933, 5224, 7110, 5229, 4101, 4102, 4221, 4222, 4223, 3312, 4229,
4291, 4673, 7020, 4292, 4293, 7710, 4299, 4322, 7721, 4649.

- 11 mã **không có** trong file Excel cũ: 4101, 4102, 4221, 4222, 4223, 4229, 4291, 4292, 4293, 4299, 4673. Phòng không
  thể chọn các mã này từ file cũ, nghĩa là đã lấy mã từ nguồn khác (Cổng ĐKDN).
- 3 mã đổi tên: 3312 ("Sửa chữa, bảo dưỡng máy móc, thiết bị"), 4322 ("…hệ thống sưởi…" thay "lò sưởi") và 7020
  ("Hoạt động tư vấn quản lý kinh doanh và hoạt động tư vấn quản lý khác"). Nếu hồ sơ ghi tên cũ thì nên ghi lại theo
  tên mới.

## Độ tin cậy

**Cao.** Hai nguồn văn bản độc lập về đường đi (ketoananpha và Cổng ĐKDN của Cục Quản lý đăng ký kinh doanh) trùng nhau
100% ở cả 1.606 mục. Số mã mỗi cấp khớp đúng Điều 3. Khoảng 37% Phụ lục I (14/38 trang) đã so bằng mắt với bản scan có chữ ký và không
thấy lệch.

## Chỗ còn nghi ngờ / chưa làm

- Hai nguồn chữ có thể cùng chép từ một tệp Word gốc, nên chỉ "độc lập" về nơi đăng. Khoảng 63% số trang scan còn lại
  chưa so bằng mắt (máy không có OCR).
- Chưa tìm được văn bản sửa đổi; chưa tra Công báo / vbpl.vn.
- Cổng ĐKDN có đặt liên kết "Bảng chuyển đổi VSIC 2018 – VSIC 2025"
  (`/Images/editor/files/7_10_Bang so sanh VSIC 2018 - 2025(2).docx`), nhưng gọi thử thì trả 404. Bảng này hữu ích để tự
  chuyển mã hồ sơ cũ — nên tải tay. Cục Thống kê cũng có bảng chuyển đổi hai chiều 2018↔2025 phục vụ Tổng điều tra kinh
  tế 2026.
- Liên kết "Quyết định số 36/2025/QĐ-TTg" trên trang Cổng ĐKDN trỏ tới tệp tên `27_2018_QĐ_TTg_nganhnghekinhte.pdf`
  (đặt nhầm tên / nhầm tệp). Không ảnh hưởng nội dung cây tra cứu.
- File Excel cũ có một dòng gõ sai `143 - 1430 - 1430` (cấp 5 đúng phải là 14300) và một số tên cấp 4 bị cắt cụt (vd 8299).
  Tên cũ ở `doi-chieu-ban-cu.csv` lấy nguyên văn file đó.
- Không xét cấp 5, cũng không xét Phụ lục II (nội dung ngành).
