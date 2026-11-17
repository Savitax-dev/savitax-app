# Danh mục cơ quan thuế + địa bàn quản lý (dựng 01/11/2026)

Dùng để app **gợi ý** cơ quan thuế quản lý theo phường/xã nơi đặt trụ sở. **Chờ duyệt, chưa nạp.**

## 1. Nguồn

| # | Văn bản / file | Nơi lấy | Loại | Dùng cho |
|---|---|---|---|---|
| A | **QĐ 1378/QĐ-CT ngày 30/6/2025** của Cục trưởng Cục Thuế: tên gọi, trụ sở, địa bàn quản lý của **350 Thuế cơ sở**. Hiệu lực 01/7/2025, thay QĐ 111/QĐ-CT ngày 05/3/2025 | gdt.gov.vn → Giới thiệu → Tổ chức ngành Thuế, file đính kèm `Quyết định số 1378-QĐ-CT.pdf` (36 trang, bản quét có chữ ký số Cục Thuế) | **CHÍNH THỐNG**, nhưng là ảnh quét, không có lớp chữ | Căn cứ pháp lý của địa bàn + nơi đặt trụ sở; dùng làm **trọng tài** khi các bản chép lệch nhau |
| B | **CV 4334/CT-CĐS ngày 10/10/2025** của Cục Thuế: danh mục cơ quan thuế, cơ quan thu, địa bàn thu, mã KBNN (PL I–IV; PL IV = 350 Thuế cơ sở, 3.321 cơ quan thu) | Bản quét PL I (25 trang) qua luatvietnam: `static3.luatvietnam.vn/uploaded/others/2025/11/06/phu_luc_cong_van-4334-ct-cds_0611074257.pdf`. **Chưa tìm được** bản gốc trên gdt.gov.vn | Văn bản chính thống, bản sao qua trang thứ ba | Mã cơ quan thu NSNN cấp tỉnh/Cục (đối chiếu) |
| C | Excel `Danh-muc-ma-CQT-KBNN-DBHC.xlsx` (3.387 dòng = toàn bộ CV 4334 gõ lại: mã cơ quan thu, tên, **mã ĐBHC xã 5 số**, mã KBNN) | manaboxvietnam.com (đăng 15/10/2025) | **NGUỒN PHỤ** (doanh nghiệp tư nhân chép lại) | Dữ liệu dòng xã → Thuế cơ sở, mã xã, mã cơ quan thu |
| D | PDF `PL2_Danh-sach-ma-CQT-DBHC-KBNN-HN.pdf` (PL II CV 4334 phần Hà Nội, có lớp chữ) | cdn.thuvienphapluat.vn | NGUỒN PHỤ | Đối chiếu C phần Hà Nội |
| E | Bản chép chữ QĐ 1378 trên luatvietnam.vn (trang văn bản 404228) | luatvietnam.vn | NGUỒN PHỤ, **nhiều lỗi** | Lấy nơi đặt trụ sở; đối chiếu chéo với C |
| F | **QĐ 1011/QĐ-CT ngày 15/7/2026** (luatvietnam đọc được tóm tắt, ký Mai Xuân Thành, hiệu lực từ ngày ký): đổi nơi đặt trụ sở Thuế cơ sở 5 tỉnh Đồng Tháp (Phường Mỹ Trà → **Phường Cao Lãnh**) và Thuế cơ sở 2 tỉnh Gia Lai (Phường Bình Định → **Xã Tuy Phước**); địa bàn hai đơn vị KHÔNG đổi, phần khác của 1378 giữ nguyên | luatvietnam.vn (bản PDF cần đăng nhập — không tải) | NGUỒN PHỤ (chưa thấy bản gốc) | Sửa cột `noi_dat_tru_so` |

File tải về (không chạy, chỉ đọc): `%TEMP%\claude\D--savitax-app\cc2b79b0-…\scratchpad\tai-ve-cqt\`.

## 2. Cách dựng

1. Dòng xã lấy từ C (đủ 350 Thuế cơ sở / 3.321 xã, có mã xã). Tên xã = cột "Tên địa bàn hành chính" của C (trùng 100% phần tên trong "Tên cơ quan thu").
2. Đối chiếu chéo C với E (bản chép 1378): khớp tên + đơn vị ở ~3.080 xã; ~240 chỗ lệch. Mọi nhóm lệch về **đơn vị quản lý** đều đã soi bằng mắt trên bản quét chính thức A: Hà Nội (Thuế cơ sở 16–25), Thái Nguyên (TCS 8 — E bỏ sót cả đơn vị), Ninh Bình (E đánh số 11/13 thay cho 10/12), Lào Cai (TCS 8–9), Thanh Hóa (Quý Lộc / Quý Lương / Bát Mọt), Quảng Ngãi (Xã Mỏ Cày), Quảng Trị (TCS 3/5/7), TP HCM (Phường Bình Cơ), Vĩnh Long (TCS 8/12), Hưng Yên (TCS 9). **Mọi chỗ soi, A đều khớp C, E sai** → dùng C. ~200 chỗ lệch còn lại chỉ là chính tả của E (Nông/Nùng Trí Cao, Đinh/Đình Phong…), cùng đơn vị — giữ tên theo C.
3. Hà Nội: 126/126 cặp (mã cơ quan thu, mã xã) của C khớp D.
4. `noi_dat_tru_so` lấy từ E, ghép vào tên xã chuẩn **trong địa bàn của chính đơn vị đó** (345/350 khớp đúng chữ); sửa tay theo A: Thái Nguyên TCS 8 = Xã Chợ Mới, Hưng Yên TCS 9 = Xã Tiền Hải; rồi áp F cho 2 đơn vị.
5. Tên đơn vị chuẩn hoá: `Thuế tỉnh X` / `Thuế thành phố X`, `Thuế cơ sở N tỉnh X` / `Thuế cơ sở N thành phố X` (A viết hoa không thống nhất: "Tỉnh Quảng Trị", "Thành phố Hồ Chí Minh" ở vài trang — đã đưa về chữ thường như đa số trang).
6. `ma_tinh` = mã ĐBHC cấp tỉnh mới (2 số) lấy từ các dòng cấp tỉnh trong C/B. `khoa` (VD `T79-CS28`) là **khoá nội bộ do em đặt**, không phải mã của ngành thuế.

## 3. Cột

- `co-quan-thue.csv`: khoa, **ma_cqt** (mã trên tờ khai, có thể nhiều mã "; "), ten_cqt, cap (`cuc` | `chi_cuc` | `tinh` | `co_so`), ma_tinh, ten_tinh, khoa_cap_tren, ma_cqt_cap_tren, noi_dat_tru_so (tên phường/xã theo QĐ), dia_chi_tru_so (trống — QĐ không ghi số nhà), so_xa, ma_co_quan_thu_nsnn (mã cơ quan thu NSNN 7 số của Cục / Chi cục / Thuế tỉnh, Thuế tỉnh có thể nhiều mã theo phòng QL-HT doanh nghiệp), ghi_chu.
- `dia-ban.csv`: ma_tinh, ten_tinh, ma_xa (mã ĐBHC 5 số), ten_xa, khoa_cqt, ma_cqt (trống — lấy theo co-quan-thue.csv), ten_cqt, ma_co_quan_thu_nsnn (mã cơ quan thu cấp xã, VD 1139647 = "Phường Hoàn Kiếm - Thuế cơ sở 1 …").
- Mã hoá UTF-8 có BOM, xuống dòng CRLF.

## 4. Số đếm & kiểm tra

- 1 Cục Thuế + 2 Chi cục (DN lớn, TMĐT) + **34 Thuế tỉnh/thành phố** + **350 Thuế cơ sở** = 387 dòng.
- **3.321 xã** đã gán (34/34 tỉnh), mỗi xã đúng **một** Thuế cơ sở; không mã xã trùng/rỗng; không tên xã trùng trong cùng tỉnh; không mã cơ quan thu trùng.
- Không Thuế cơ sở nào thiếu xã; nơi đặt trụ sở của cả 350 đơn vị đều nằm trong địa bàn của chính đơn vị.
- Không có mã cơ quan thuế để kiểm trùng (xem mục 5).

## 5. Còn thiếu / nghi ngờ

1. **Mã cơ quan thuế trên tờ khai (`maCQTNoiNop`)** — không có nguồn công khai (chỉ trong bộ cài HTKK). Anh cho phép
   01/11/2026 đọc từ tờ khai XML khách đã nộp trên ổ chung G: (chỉ thư mục 7. BỘ BÁO CÁO năm 2025–2026, CHỈ lấy cặp mã + tên
   cơ quan, không lấy dữ liệu khách): `node scripts/phaply-ma-cqt-tu-to-khai.mjs <ket-qua.json>…` → cột `ma_cqt` +
   `ma-cqt-tu-to-khai.csv` (mỗi mã kèm tên chi cục cũ). Ô trống = chưa có khách nào nộp ở cơ quan đó.
   ⚠ **Một Thuế cơ sở có thể có NHIỀU mã** — mã giữ theo chi cục / quận-huyện CŨ (VD Thuế cơ sở 5 Đồng Nai = 71315 Long
   Thành + 71317 Nhơn Trạch; Thuế cơ sở 16 HCM = 70127 Tân Bình cũ). Cột `ma_cqt` ghi mọi mã cách nhau "; ", mã nhiều tờ
   khai nhất đứng đầu; khách đã có tờ khai thì lấy đúng mã trên tờ khai của khách.
   Đồng Nai: đã đổi "tỉnh Đồng Nai" → "thành phố Đồng Nai" (NQ 30/2026/QH16) — tờ khai 2026 trên cổng ghi cả hai.
2. Mã 7 số `ma_co_quan_thu_nsnn` là **mã cơ quan thu NSNN** (ghi trên giấy nộp tiền), KHÔNG phải mã CQT trên tờ khai. Thuế cơ sở không có một mã riêng — mỗi xã là một cơ quan thu.
3. Dữ liệu dòng xã là nguồn PHỤ (C), mới đối chiếu với bản quét chính thức ở các nhóm lệch kể trên; các tỉnh hai bản chép khớp nhau thì chưa soi từng chữ trên bản quét.
4. Nghệ An: C ghi "Xã Hùng Chân", "Xã Mường Ham", "Xã Quỳ Châu", "Xã Mường Quàng" (TCS 5), E ghi "Hùng Châu / Mường Hạnh / Quý Châu / Mường Quang" — chưa soi trang Nghệ An của A; theo quy luật trên giữ C. Nên đối chiếu với danh mục xã của agent dia-danh.
5. Lào Cai: bản quét PL I CV 4334 ghi 1054077 = "Thuế tỉnh Lào Cai 01", 1054639 = "…02"; C lại gắn nhãn ngược (phòng số 2 / số 1). Mã không ảnh hưởng địa bàn xã, chỉ nhãn phòng ở cột ghi chú mã tỉnh.
6. QĐ 1011/QĐ-CT chỉ đọc qua luatvietnam (ngày ghi 15/7/2026). Chưa tìm thấy quyết định sửa **địa bàn** nào khác sau 07/2025 — tìm trên gdt.gov.vn (mục Tổ chức ngành Thuế chỉ có 1375–1378, 1384, 381, 2229) và luatvietnam; không loại trừ có văn bản chưa đăng.
7. Không có địa chỉ (số nhà, đường) trụ sở; tên Thuế tỉnh lấy theo tiêu đề phụ lục QĐ 1378 (không có văn bản 34 Thuế tỉnh bản đọc được — PDF QĐ 2229/QĐ-BTC trên gdt trả lỗi 500).
8. Chưa ghép `xa.csv` (thư mục `dia-danh` chưa có lúc dựng). Ghép được ngay theo `ma_xa`.
