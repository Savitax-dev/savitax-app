# Quy ước lưu hồ sơ khách hàng — cây thư mục SVT.MB09

Áp dụng cho mọi công ty, mọi nhân viên. Mục đích: mở thư mục công ty nào cũng thấy cùng một bố cục, ai thay ai cũng
tìm ra file, và app (Tờ khai, Soát xét báo cáo, Rủi ro thuế) đọc đúng.

**Chuẩn duy nhất là cây thư mục mẫu ISO SVT.MB09** (anh chốt 08/11/2026), bản gốc ở:
`G:\Shared drives\5. SAVITAX - NỘI BỘ & KẾ TOÁN THUẾ\5.7 QUY TRINH ISO 9001 - 2004\5.7.2.2 MẪU BIỄU ISO v2\SVT.MB09. CAY THU MUC\TÊN CÔNG TY - CÂY THU MỤC MẪU`.
Công ty mới: chép nguyên cây này (chỉ các thư mục) rồi đổi tên theo mục 1.1.

> **File cũ không cần đổi tên.** App nhận phần lớn loại file theo **nội dung**, không theo tên. Quy ước này áp dụng
> cho file lưu MỚI từ nay. Riêng chỗ để (đúng thư mục nào) thì nên sửa cả file cũ nếu đang để sai.

---

## 1. Quy tắc chung

### 1.1 Cây thư mục

```
<Mã KH> - <TÊN CÔNG TY>\                        ← đổi từ "TÊN CÔNG TY - CÂY THU MỤC MẪU"
├─ 1. HỒ SƠ PHÁP LÝ\
├─ 2. HỒ SƠ KẾ TOÁN\
│  └─ Năm 2026\                                 ← đổi từ "NĂM TÀI CHÍNH"; mỗi năm một thư mục
│     ├─ 1. HỢP ĐỒNG MUA VÀO_BÁN RA\
│     ├─ 2. HÓA ĐƠN MUA VÀO_BÁN RA\
│     ├─ 3. HỢP ĐỒNG KHÁC\
│     ├─ 4. TỜ KHAI HẢI QUAN\
│     ├─ 5. BẢO HIỂM XÃ HỘI\
│     ├─ 6. LƯƠNG\
│     ├─ 7. BỘ BÁO CÁO\
│     ├─ 8. SỔ SÁCH KẾ TOÁN\
│     ├─ 9. SỔ PHỤ NGÂN HÀNG\
│     ├─ 10. GIẤY NỘP TIỀN\
│     └─ 11. CÁC THÔNG BÁO_CÔNG VĂN (Nếu có)\
├─ 3. ĐỀ NGHỊ TT_CN\
├─ 4. KHÁCH HÀNG\
└─ 5. NHẬT KÝ LÀM VIỆC\
```

- **`NĂM TÀI CHÍNH` trong cây mẫu là tên giữ chỗ — phải đổi thành `Năm 2026`.** Để nguyên thì app không nhận ra
  thư mục năm. Năm sau: chép thư mục năm (chỉ thư mục, không file) rồi đổi thành `Năm 2027`. Thư mục đã đặt `2026`,
  `NĂM 2026`, `1. NĂM 2026` thì **không cần đổi** — app nhận cả các kiểu này. Mỗi công ty chỉ MỘT thư mục cho một năm.
- **Giữ đủ 11 thư mục trong năm, đúng số và tên như trên.** Không đổi tên, không thêm thư mục cấp 1 khác, không để file
  thẳng trong thư mục năm. Thư mục con cũng giữ đúng tên như cây mẫu.
- Công ty **không phát sinh** loại hồ sơ nào thì thêm ` (kps)` vào cuối tên thư mục đó, ví dụ
  `4. TỜ KHAI HẢI QUAN (kps)`. App hiểu là không phát sinh, không báo thiếu. Phát sinh trở lại thì bỏ ` (kps)`.
- **Công ty khai thuế theo THÁNG**: đổi các thư mục `QUÝ 1…QUÝ 4` ở mục 2 thành `THÁNG 01…THÁNG 12`, và `BCT-Q1…BCT-Q4`
  ở mục 7 thành `BCT-T01…BCT-T12`. Mục 9 (sổ phụ) vẫn chia theo quý.

### 1.2 Tên file

```
<LOẠI>_<KỲ>.<NĂM>_<MÃ KH>[_<ghi chú>].<đuôi>
```

| Phần | Viết thế nào | Ví dụ |
| --- | --- | --- |
| `LOẠI` | Mã loại hồ sơ trong bảng ở mục 3 | `TK_GTGT`, `C12`, `LUONG`, `SOPHU` |
| `KỲ` | `T01`…`T12` (tháng) · `Q1`…`Q4` (quý) · `NAM` (cả năm) | `T09`, `Q3`, `NAM` |
| `NĂM` | 4 số | `2026` |
| `MÃ KH` | **Mã khách hàng trên app** (Danh sách công ty) | `HONGDUC`, `THINHPHAT` |
| `ghi chú` | Chỉ khi cần phân biệt: ngân hàng, mã đơn vị BHXH, lần bổ sung… | `_VCB`, `_BSL1` |

- **Chữ in hoa, không dấu, nối bằng gạch dưới `_`**, không dấu cách. Không dùng các ký tự `\ / : * ? " < > |`
  (Windows cấm — số hóa đơn, số hợp đồng có `/` thì đổi thành `-`).
- Ví dụ đầy đủ: `TK_GTGT_Q3.2026_HONGDUC.xml` · `C12_T09.2026_HONGDUC.pdf` · `SOPHU_VCB_6906_T09.2026_HONGDUC.xlsx`.
- **Nộp bổ sung** lần n: thêm `_BSLn` (`TK_GTGT_Q1.2026_HONGDUC_BSL1.xml`).
- **Sửa lại một file đã lưu**: giữ file cũ, thêm `_v2`, `_v3`… — không ghi đè (file cũ có thể đã gửi khách).
  Riêng sổ sách xuất lũy kế (mục 8) thì thay file cũ.
- **Không đổi tên file tải hàng loạt** từ cổng hóa đơn điện tử (mục 2) và từ MISA (mục 8) — giữ tên mặc định. Quy tắc
  đặt tên ở trên dành cho file nhân viên tự lưu từng cái.

### 1.3 Định dạng file

- **Giữ file gốc** tải từ cổng thuế / cổng hóa đơn / phần mềm kế toán: XML, Excel. Không sửa dòng tiêu đề cột,
  không gộp tay nhiều kỳ vào một sheet, không chỉ lưu bản PDF thay cho XML/Excel.
- PDF, ảnh chụp chỉ là bản **để xem**, lưu **kèm** bản gốc. App chưa đọc được PDF scan / ảnh chụp.
- **File nén (`.rar`, `.zip`, `.7z`) phải giải nén** ra thư mục cùng tên. App không mở file nén.

---

## 2. Từng thư mục trong `Năm 2026`

### 1. HỢP ĐỒNG MUA VÀO_BÁN RA

| Thư mục con | Lưu gì | Tên file |
| --- | --- | --- |
| `HĐ KHÁCH HÀNG` | Hợp đồng bán hàng / cung cấp dịch vụ, phụ lục, biên bản thanh lý | `HD_BAN_<đối tác>_<ngày ký YYYYMMDD>.pdf` |
| `HĐ NHÀ CUNG CẤP` | Hợp đồng mua hàng / dịch vụ đầu vào | `HD_MUA_<đối tác>_<ngày ký YYYYMMDD>.pdf` |

`<đối tác>` = tên viết tắt không dấu (`VINAMILK`, `HOAPHAT`). Phụ lục: thêm `_PL01`; thanh lý: thêm `_TL`.
App chỉ ghi nhận có thư mục, không soát.

### 2. HÓA ĐƠN MUA VÀO_BÁN RA

```
2. HÓA ĐƠN MUA VÀO_BÁN RA\
└─ QUÝ 1 … QUÝ 4\            ← công ty khai tháng: THÁNG 01 … THÁNG 12
   ├─ HĐ MUA VÀO\             ← bảng kê "Chi tiết" mua vào + XML từng hóa đơn (có thể chia thư mục con XML\, HTML\)
   └─ HĐ BÁN RA\              ← bảng kê "Chi tiết" bán ra
```

| Thư mục | Lưu gì | Tên file |
| --- | --- | --- |
| `HĐ MUA VÀO` | Bảng kê Excel **"Chi tiết" mua vào** tải từ cổng hóa đơn điện tử, phủ đủ kỳ | Giữ nguyên tên cổng đặt |
| `HĐ MUA VÀO` | File **XML từng hóa đơn mua vào** (bắt buộc); HTML là bản xem kèm | Giữ nguyên tên cổng đặt |
| `HĐ BÁN RA` | Bảng kê Excel **"Chi tiết" bán ra** tải từ cổng, phủ đủ kỳ | Giữ nguyên tên cổng đặt |

- **Không đổi tên file tải từ cổng** — cả hóa đơn lẻ lẫn bảng kê. Tên cổng đặt sẵn có MST và khoảng ngày, app dựa
  vào đó để nhận mua vào / bán ra và kỳ.
- **Hóa đơn mua vào bắt buộc có file XML** (app đếm, đối chiếu từng hóa đơn). Bán ra **không lưu file lẻ**, chỉ cần
  bảng kê "Chi tiết" — hóa đơn bán ra đã có trong phần mềm xuất hóa đơn.
- **Không lưu PDF** hóa đơn (trùng với HTML, nặng Drive).
- Bảng kê "Chi tiết" tải **đúng khoảng ngày của kỳ** (quý: 01/07–30/09; tháng: cả tháng).
- **Công ty khai tháng phải dùng thư mục `THÁNG 01…THÁNG 12`**: để trong `QUÝ n` thì app gán hóa đơn cho cả 3 tháng của
  quý, không tách được từng tháng.

### 3. HỢP ĐỒNG KHÁC

Hợp đồng thuê nhà / thuê xe, vay, góp vốn, đại lý, bảo hiểm…: `HD_<loại>_<đối tác>_<ngày ký YYYYMMDD>.pdf`,
ví dụ `HD_THUENHA_NGUYENVANA_20260105.pdf`, `HD_VAY_VCB_20260301.pdf`. App chỉ ghi nhận.

### 4. TỜ KHAI HẢI QUAN

Cây mẫu có sẵn thư mục `MẪU BỘ TỜ KHAI HẢI QUAN` (bên trong có `GIẤY TỜ LIÊN QUAN`) — **mỗi tờ khai chép một thư mục
theo mẫu đó, đặt tên `<số tờ khai>_<ngày đăng ký YYYYMMDD>`**, rồi để cả bộ vào:

| Để ở | File | Tên file |
| --- | --- | --- |
| `<số TK>_<ngày>` | Tờ khai hải quan (Excel / PDF từ hệ thống hải quan) | `TKHQ_<số tờ khai>.xlsx` / `.pdf` |
| `<số TK>_<ngày>` | Chứng từ nộp thuế nhập khẩu / lệ phí | `GNT_HQ_<số tờ khai>.pdf` · `LEPHI_<số tờ khai>.pdf` |
| `<số TK>_<ngày>` | Hóa đơn cước tàu, vận chuyển, phí hạ tầng, hạ rỗng cont | `HD_CUOC_<số>.pdf` · `HD_VANCHUYEN_<số>.pdf` · `PHIHATANG_<số>.pdf` |
| `<số TK>_<ngày>\GIẤY TỜ LIÊN QUAN` | Hóa đơn thương mại, packing list, vận đơn, danh sách hàng | `INVOICE_<số>.pdf` · `PL_<số>.pdf` · `BL_<số>.pdf` |

Công ty không xuất nhập khẩu: đổi thành `4. TỜ KHAI HẢI QUAN (kps)`.

### 5. BẢO HIỂM XÃ HỘI

| Thư mục con | Lưu gì | Tên file |
| --- | --- | --- |
| `1. C12` | Thông báo đóng BHXH (C12) **từng tháng**, bản PDF tải từ cổng BHXH (có chữ, không scan) | `C12_T09.2026_<MÃ KH>.pdf` |
| `2. HỒ SƠ BHXH` | Báo tăng / giảm lao động (D02), điều chỉnh, quyết định… | `D02_T09.2026_<MÃ KH>.pdf` · `BHXH_<nội dung>_<ngày>.pdf` |

Công ty có **nhiều mã đơn vị BHXH** (ví dụ người lao động + giám đốc): mỗi mã một file, thêm mã đơn vị vào ghi chú —
`C12_T09.2026_HONGDUC_TZ1234A.pdf`. App cộng theo từng mã.

### 6. LƯƠNG

| Thư mục con | Lưu gì | Tên file |
| --- | --- | --- |
| `1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG` | **Một file Excel cả năm, mỗi tháng một sheet đặt tên `T01`…`T12`** (gồm chấm công + bảng lương) | `LUONG_NAM.2026_<MÃ KH>.xlsx` |
| `2. HỢP ĐỒNG LAO ĐỘNG` | HĐLĐ, phụ lục, quyết định nghỉ việc | `HDLD_<HỌ TÊN không dấu>_<ngày YYYYMMDD>.pdf` |
| `3. QUY CHẾ LƯƠNG_THANG BẢNG LƯƠNG` | Quy chế lương thưởng, thang bảng lương | `QUYCHE_LUONG_2026_<MÃ KH>.pdf` |
| `4. BẢNG TÍNH THƯỞNG` | Bảng thưởng tháng / năm | `THUONG_<kỳ>.<năm>_<MÃ KH>.xlsx` |
| `5. CCDC NHÂN VIÊN` | Giấy tờ tùy thân, bằng cấp nhân viên | `CCCD_<HỌ TÊN>.pdf` … |
| `6. HỒ SƠ ĐĂNG KÝ NGƯỜI PHỤ THUỘC\1. THÔNG TIN NGƯỜI PHỤ THUỘC` | Hồ sơ đăng ký người phụ thuộc | `NPT_<HỌ TÊN NLĐ>_<ngày>.pdf` |
| `6. HỒ SƠ ĐĂNG KÝ NGƯỜI PHỤ THUỘC\2. THÔNG BÁO KẾT QUẢ` | Thông báo kết quả đăng ký | `NPT_TB_<HỌ TÊN NLĐ>_<ngày>.pdf` |

Bảng lương: **tháng nào để trống thì xoá sheet hoặc để trống hẳn**, đừng chép số tháng trước rồi bỏ đó. Lỡ chia
2 file (ví dụ nửa năm đầu / nửa năm sau) app vẫn đọc được, nhưng mỗi tháng chỉ để số ở MỘT file.

### 7. BỘ BÁO CÁO

```
7. BỘ BÁO CÁO\
├─ 1. BỘ BCT QUÝ_THÁNG\
│  ├─ BCT-Q1 … BCT-Q4\                    ← khai tháng: BCT-T01 … BCT-T12
│  │  ├─ TỜ KHAI THUẾ\01GTGT\  · \05KK TNCN\
│  │  ├─ TB CHẤP NHẬN\01GTGT\  · \05KK TNCN\
│  │  └─ BẢNG KÊ\
│  └─ BCT-Q2_BSL1\                        ← nộp bổ sung lần 1, ngang hàng BCT-Q2, bên trong y như kỳ chính thức
├─ 2. BỘ BCTC NĂM\                        ← để trong thư mục NĂM CỦA SỐ LIỆU (BCTC 2025 → Năm 2025)
│  ├─ TỜ KHAI\03TNDN QTT TNDN\ · \05QTT QTT TNCN\ · \BCTC\
│  └─ TB CHẤP NHẬN\03 TNDN\ · \05QTT TNCN\ · \BCTC\
└─ 3. BÁO CÁO KHÁC\
```

**Kỳ tháng / quý** (`1. BỘ BCT QUÝ_THÁNG\BCT-Qn`):

| Thư mục | File | Tên file |
| --- | --- | --- |
| `TỜ KHAI THUẾ\01GTGT` | Tờ khai GTGT đã nộp — **XML** tải từ cổng thuế (+ PDF) | `TK_GTGT_Q3.2026_<MÃ KH>.xml` |
| `TỜ KHAI THUẾ\05KK TNCN` | Tờ khai khấu trừ TNCN đã nộp — XML (+ PDF) | `TK_TNCN_Q3.2026_<MÃ KH>.xml` |
| `TB CHẤP NHẬN\01GTGT` · `\05KK TNCN` | **Chỉ thông báo CHẤP NHẬN** — thông báo tiếp nhận không lưu | `TBCN_GTGT_Q3.2026_<MÃ KH>.xml` · `TBCN_TNCN_…` (+ .pdf) |
| `BẢNG KÊ` | Bảng kê mua vào + bán ra **tải kèm tờ khai đã nộp** trên cổng thuế (một file, sheet MV và BR) | `BK_MVBR_Q3.2026_<MÃ KH>.xlsx` |

- Nộp bổ sung lần n: thư mục kỳ riêng `BCT-Qn_BSLn` **ngang hàng** kỳ chính thức, file thêm `_BSLn`
  (`TK_GTGT_Q2.2026_<MÃ KH>_BSL1.xml`, `BK_MVBR_Q2.2026_<MÃ KH>_BSL1.xlsx`).
- Bảng kê "Chi tiết" tải từ **cổng hóa đơn điện tử** lưu ở **mục 2** (`HĐ MUA VÀO` / `HĐ BÁN RA`), không lưu ở đây.
- Muốn **soát trước khi nộp** (không bắt buộc): xuất tờ khai nháp từ HTKK (`TKNHAP_GTGT_Q3.2026_<MÃ KH>.xml`) và bảng kê
  từ phần mềm kế toán (`BKPM_MV_…`, `BKPM_BR_…`) bỏ tạm vào `BẢNG KÊ`, bấm Tải lại thư mục trên app. Nộp xong thì
  **xoá các file nháp đó**, chỉ để lại bảng kê kèm tờ khai đã nộp.
- **Phân hệ Tờ khai** hiện vẫn tự tải về thư mục `BAOCAOTHUE_<kỳ>_<năm>_<MÃ KH>` đặt thẳng trong `7. BỘ BÁO CÁO`. App
  đọc được cả hai kiểu, **không cần chép tay sang `BCT-Qn`**; năm cũ đã xếp kiểu khác cũng giữ nguyên.

**Quyết toán + BCTC năm** (`2. BỘ BCTC NĂM`, trong thư mục **năm của số liệu** — BCTC 2025 nộp tháng 3/2026 vẫn để
trong `Năm 2025`):

| Thư mục | File | Tên file |
| --- | --- | --- |
| `TỜ KHAI\03TNDN QTT TNDN` | Quyết toán TNDN (XML đã nộp + PDF) | `TK_03TNDN_NAM.2025_<MÃ KH>.xml` |
| `TỜ KHAI\05QTT QTT TNCN` | Quyết toán TNCN (XML + PDF) | `TK_05QTT_NAM.2025_<MÃ KH>.xml` |
| `TỜ KHAI\BCTC` | BCTC (XML đã nộp + PDF) + **BCTC bản Excel** | `TK_BCTC_NAM.2025_<MÃ KH>.xml` · `BCTC_NAM.2025_<MÃ KH>.xlsx` (hoặc giữ tên MISA) |
| `TB CHẤP NHẬN\03 TNDN` · `\05QTT TNCN` · `\BCTC` | Thông báo chấp nhận | `TBCN_03TNDN_NAM.2025_…` · `TBCN_05QTT_…` · `TBCN_BCTC_…` |

Bảng cân đối tài khoản cả năm **không lưu thêm ở đây**: lần xuất cuối năm ở `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI
KHOẢN…` (lũy kế đến 31/12) chính là bảng cả năm — app tự tìm. Mọi file Excel trong `2. BỘ BCTC NĂM` đều được Rủi ro thuế
mở đọc, nên BCTC Excel giữ tên MISA cũng được.

`3. BÁO CÁO KHÁC`: báo cáo thống kê, báo cáo tình hình sử dụng hóa đơn, báo cáo lao động… —
`BC_<loại>_<kỳ>.<năm>_<MÃ KH>.pdf`.

### 8. SỔ SÁCH KẾ TOÁN

Giữ 10 thư mục con như mẫu. Sổ sách **tải hàng loạt từ MISA** nên **giữ nguyên tên mặc định MISA đặt**, không đổi
tên (app nhận các tên này). Báo cáo xuất **bản Excel**, chứng từ xuất **PDF**:

| Thư mục con | Báo cáo MISA → tên file mặc định |
| --- | --- |
| `1. PHIẾU THU_PHIẾU CHI` | Sổ quỹ tiền mặt `So_quy_tien_mat.xlsx` · chứng từ PDF `Phieuthu.pdf`, `Phieuchi.pdf`, `Uynhiemchi.pdf`, `Thutiengui.pdf` |
| `2. PHIẾU XUẤT KHO_PHIẾU NHẬP KHO` | `Nhapkho.pdf` · `Xuatkho.pdf` |
| `3. BẢNG CÂN ĐỐI TÀI KHOẢN MẪU 2 BÊN (BẬC 3)` | `Bang_can_doi_tai_khoan_mau_quan_tri.xlsx` — **lũy kế từ đầu năm**, bậc 3 |
| `4. CÔNG NỢ PHẢI THU_PHẢI TRẢ (TỔNG HỢP + CHI TIẾT)` | `Tong_hop_cong_no_phai_thu_khach_hang.xlsx` · `Chi_tiet_cong_no_phai_thu_khach_hang.xlsx` · `Tong_hop_cong_no_phai_tra_nha_cung_cap.xlsx` · `Chi_tiet_cong_no_phai_tra_nha_cung_cap.xlsx` |
| `5. HÀNG TỒN KHO (TỔNG HỢP + CHI TIẾT)` | `Tong_hop_ton_kho.xlsx` · `So_chi_tiet_vat_tu_hang_hoa.xlsx` |
| `6. BẢNG TÍNH KHẤU HAO CCDC_TSCĐ` | `So_tai_san_co_dinh.xlsx` · `So_theo_doi_cong_cu_dung_cu.xlsx` · `Bang_tinh_phan_bo_chi_phi_tra_truoc.xlsx` |
| `7. SỔ NHẬT KÝ CHUNG` | `So_nhat_ky_chung.xlsx` |
| `8. SỔ CHI TIẾT CÁC TÀI KHOẢN` | `So_chi_tiet_cac_tai_khoan.xlsx` · `So_tien_gui_ngan_hang.xlsx` · `So_cai.xlsx` |
| `9. BẢNG TÍNH GIÁ THÀNH` | `Bang_tinh_gia_thanh.xlsx` · công trình: `Bao_cao_tong_hop_lai_lo_theo_cong_trinh.xlsx`, `Bao_cao_chi_tiet_lai_lo_theo_cong_trinh.xlsx` |
| `10. BẢNG KÊ MUA VÀO - BÁN RA` | Bảng kê mua vào / bán ra xuất từ phần mềm kế toán — giữ tên phần mềm đặt |

- **Mỗi báo cáo MỘT file, luôn xuất LŨY KẾ từ đầu năm đến hết kỳ vừa làm.** Kỳ sau xuất lại thì **thay file cũ**
  (xoá file cũ rồi chép file mới vào) — không để `(1)`, `(2)` cạnh nhau, app không biết file nào mới.
- **Chứng từ tải hàng loạt ra file nén** (`N-Phieuchi-31-12-2025.zip`, `N-Nhapkho-…`, `N-PhanboCCDC-…`): **giải nén** ra
  thư mục cùng tên ngay chỗ đó, giữ nguyên tên MISA đặt. Giải nén rồi thì xoá file `.zip` (hoặc để cũng được — app tự
  bỏ qua file nén đã có thư mục giải nén cùng tên).
- Sổ quỹ tiền mặt để ở `1.`, sổ tiền gửi ngân hàng + sổ cái để ở `8.` — **không tạo thêm** thư mục `11. SỔ QUỸ`,
  `12. SỔ TIỀN GỬI`, `13. SỔ CÁI`…
- `10. BẢNG KÊ MUA VÀO - BÁN RA` là bảng kê **của phần mềm**. Bảng kê kèm tờ khai ĐÃ NỘP để ở mục 7, bảng kê "Chi tiết"
  của cổng hóa đơn để ở mục 2.

### 9. SỔ PHỤ NGÂN HÀNG

```
9. SỔ PHỤ NGÂN HÀNG\
└─ QUÝ 1 … QUÝ 4\    ← công ty khai tháng vẫn chia theo quý, mỗi tháng một file
```

Tên file: `SOPHU_<NGÂN HÀNG>_<4 số cuối tài khoản>_T09.2026_<MÃ KH>.xlsx`, ví dụ `SOPHU_VCB_6906_T09.2026_HONGDUC.xlsx`.
**Mỗi file một tài khoản, một tháng** — sao kê ngân hàng trả về theo khoảng ngày khác thì vẫn đặt theo tháng chính
của nó. Ưu tiên Excel tải từ ngân hàng, PDF chỉ khi ngân hàng không cho tải Excel. Không tạo thư mục riêng theo
ngân hàng (tên ngân hàng đã nằm trong tên file).

### 10. GIẤY NỘP TIỀN

`GNT_<sắc thuế>_<kỳ>.<năm>_<MÃ KH>_<ngày nộp YYYYMMDD>.pdf`, ví dụ `GNT_GTGT_Q3.2026_HONGDUC_20261030.pdf`,
`GNT_MONBAI_NAM.2026_HONGDUC_20260128.pdf`. Nộp tiền chậm nộp / phạt: sắc thuế ghi `CHAMNOP` / `PHAT`.

### 11. CÁC THÔNG BÁO_CÔNG VĂN (Nếu có)

Thông báo, công văn, quyết định của cơ quan thuế, BHXH, ngân hàng…:
`CV_<cơ quan>_<số văn bản>_<ngày YYYYMMDD>.pdf`, ví dụ `CV_CQT_1234-TB-CCT_20260915.pdf`,
`CV_BHXH_56-TB_20260820.pdf`. Cơ quan: `CQT` (thuế), `BHXH`, `HQ` (hải quan), `NH` (ngân hàng), `KHAC`.
Số văn bản có `/` thì đổi thành `-`.

### Thư mục cấp công ty (ngoài `2. HỒ SƠ KẾ TOÁN`)

| Thư mục | Lưu gì |
| --- | --- |
| `1. HỒ SƠ PHÁP LÝ\1. GIẤY PHÉP KINH DOANH` … `\6. HỒ SƠ QUYẾT TOÁN THUẾ CÁC NĂM CŨ` | Giấy phép kinh doanh, CCCD giám đốc, điều lệ, hồ sơ đăng ký thuế, hồ sơ góp vốn, quyết toán các năm trước khi Savitax nhận làm |
| `2. HỒ SƠ KẾ TOÁN` (để thẳng) | File nhật ký công việc với khách hàng `SVT.MB07.NHẬT KÝ CÔNG VIỆC - KHÁCH HÀNG.xlsx` (vị trí theo cây mẫu) |
| `3. ĐỀ NGHỊ TT_CN` | Phiếu đề nghị thanh toán phí dịch vụ (mẫu `SVT.MB13`) |
| `4. KHÁCH HÀNG` · `5. NHẬT KÝ LÀM VIỆC` | Theo quy trình ISO |

Ảnh đi kèm nhật ký làm việc (trước đây ở `12. HÌNH ẢNH`): để ở `5. NHẬT KÝ LÀM VIỆC`, tên
`ANH_<ngày YYYYMMDD>_<nội dung ngắn>.jpg` (ngày = ngày của dòng nhật ký). Ảnh **chứng từ kế toán** (hóa đơn, phiếu chi,
sao kê khách chụp gửi) vẫn lưu vào đúng mục 1–11 của nó. Cây ISO không có thư mục `12. HÌNH ẢNH` trong năm — công ty nào
đã có thì giữ, app vẫn ghi nhận, không cần xoá.

---

## 3. Bảng mã loại hồ sơ (tra nhanh)

| Mã | Hồ sơ | Thư mục |
| --- | --- | --- |
| `HD_BAN` · `HD_MUA` · `HD_<loại>` | Hợp đồng | 1 · 3 |
| `TKHQ` | Tờ khai hải quan | 4 |
| `C12` · `D02` | Thông báo đóng BHXH · báo tăng giảm lao động | 5 |
| `LUONG` · `HDLD` · `THUONG` · `NPT` | Lương, hợp đồng lao động, thưởng, người phụ thuộc | 6 |
| `TK_<sắc thuế>` · `TBCN` | Tờ khai, thông báo chấp nhận | 7 |
| `BK_MVBR` | Bảng kê mua vào / bán ra tải kèm tờ khai đã nộp | 7 |
| `BKPM_MV` · `BKPM_BR` · `TKNHAP` | Bảng kê phần mềm, tờ khai nháp — chỉ để tạm khi soát trước khi nộp | 7 |
| `BCTC` | BCTC bản Excel (hoặc giữ tên MISA) | 7 |
| Giữ tên MISA | Sổ sách, chứng từ tải hàng loạt từ MISA | 8 |
| `SOPHU_<NH>` | Sổ phụ ngân hàng | 9 |
| `GNT_<sắc thuế>` | Giấy nộp tiền | 10 |
| `CV_<cơ quan>` | Thông báo, công văn | 11 |
| `ANH` | Ảnh đi kèm nhật ký làm việc | `5. NHẬT KÝ LÀM VIỆC` (cấp công ty) |

Sắc thuế: `GTGT` · `TNCN` · `TNDN` · `MONBAI` (lệ phí môn bài) · `03TNDN` · `05QTT` · `BCTC` · `CNKD` (hộ kinh doanh).

---

## 4. Lưu xong thì kiểm trên app

Mở **Soát xét báo cáo → Hồ sơ dữ liệu**, chọn công ty, bấm **↻ Tải lại thư mục**:

- Ô **xanh** = đã có. Ô **đỏ** = thiếu — app ghi rõ thiếu kỳ nào, file gì.
- **"File cần xem"** = file nén chưa giải nén, file app không mở được, hoặc file để lạc thư mục.
- Ô vàng chấm = kỳ chưa tới hạn nộp, chưa cần.
- App báo **không thấy thư mục năm**: kiểm đã đổi `NĂM TÀI CHÍNH` thành `Năm 2026` chưa.
