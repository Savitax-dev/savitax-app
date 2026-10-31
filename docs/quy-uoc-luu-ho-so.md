# Quy ước lưu hồ sơ khách hàng — thư mục 1 đến 12

Áp dụng cho mọi công ty, mọi nhân viên, **từ ngày 01/11/2026**. Mục đích: mở thư mục công ty nào cũng thấy
cùng một bố cục, ai thay ai cũng tìm ra file, và app (Tờ khai, Soát xét báo cáo, Rủi ro thuế) đọc đúng.

> **File cũ không cần đổi tên.** App nhận loại file theo **nội dung**, không theo tên. Quy ước này áp dụng
> cho file lưu MỚI từ nay. Riêng chỗ để (đúng thư mục nào) thì nên sửa cả file cũ nếu đang để sai.

---

## 1. Quy tắc chung

### 1.1 Cây thư mục

```
<Số>. <TÊN CÔNG TY>\
└─ 2. HỒ SƠ KẾ TOÁN\
   └─ Năm 2026\                              ← mỗi năm một thư mục
      ├─ 1. HỢP ĐỒNG MUA VÀO_BÁN RA\
      ├─ 2. HÓA ĐƠN MUA VÀO_BÁN RA\
      ├─ 3. HỢP ĐỒNG KHÁC\
      ├─ 4. TỜ KHAI HẢI QUAN\
      ├─ 5. BẢO HIỂM XÃ HỘI\
      ├─ 6. LƯƠNG\
      ├─ 7. BỘ BÁO CÁO\
      ├─ 8. SỔ SÁCH KẾ TOÁN\
      ├─ 9. SỔ PHỤ NGÂN HÀNG\
      ├─ 10. GIẤY NỘP TIỀN\
      ├─ 11. CÁC THÔNG BÁO_CÔNG VĂN\
      └─ 12. HÌNH ẢNH\
```

- **Giữ đủ 12 thư mục, đúng số và tên như trên.** Không đổi tên, không thêm thư mục cấp 1 khác, không để file
  thẳng trong thư mục năm.
- Công ty **không phát sinh** loại hồ sơ nào thì thêm ` (kps)` vào cuối tên thư mục đó, ví dụ
  `4. TỜ KHAI HẢI QUAN (kps)`. App hiểu là không phát sinh, không báo thiếu. Phát sinh trở lại thì bỏ ` (kps)`.
- Thư mục năm đặt **`Năm 2026`** cho thống nhất. Thư mục đã đặt `2026`, `NĂM 2026`, `1. NĂM 2026` thì **không cần
  đổi** — app nhận cả các kiểu này. Mỗi công ty chỉ MỘT thư mục cho một năm.

### 1.2 Tên file

```
<LOẠI>_<KỲ>.<NĂM>_<MÃ KH>[_<ghi chú>].<đuôi>
```

| Phần | Viết thế nào | Ví dụ |
| --- | --- | --- |
| `LOẠI` | Mã loại hồ sơ trong bảng ở mục 2 | `TK_GTGT`, `C12`, `LUONG`, `SOPHU` |
| `KỲ` | `T01`…`T12` (tháng) · `Q1`…`Q4` (quý) · `NAM` (cả năm) | `T09`, `Q3`, `NAM` |
| `NĂM` | 4 số | `2026` |
| `MÃ KH` | **Mã khách hàng trên app** (Danh sách công ty) | `HONGDUC`, `THINHPHAT` |
| `ghi chú` | Chỉ khi cần phân biệt: ngân hàng, mã đơn vị BHXH, lần bổ sung… | `_VCB`, `_BSL1` |

- **Chữ in hoa, không dấu, nối bằng gạch dưới `_`**, không dấu cách. Không dùng các ký tự `\ / : * ? " < > |`
  (Windows cấm — số hóa đơn, số hợp đồng có `/` thì đổi thành `-`).
- Ví dụ đầy đủ: `TK_GTGT_Q3.2026_HONGDUC.xml` · `C12_T09.2026_HONGDUC.pdf` · `SOPHU_VCB_T09.2026_HONGDUC.xlsx`.
- **Nộp bổ sung** lần n: thêm `_BSLn` (`TK_GTGT_Q1.2026_HONGDUC_BSL1.xml`).
- **Sửa lại một file đã lưu**: giữ file cũ, thêm `_v2`, `_v3`… — không ghi đè (file cũ có thể đã gửi khách).
  Riêng sổ sách MISA xuất lũy kế (mục 8) thì thay file cũ.
- **Không đổi tên file tải hàng loạt** từ cổng hóa đơn điện tử (mục 2) và từ MISA (mục 8) — giữ tên mặc định. Quy tắc
  đặt tên ở trên dành cho file nhân viên tự lưu từng cái.

### 1.3 Định dạng file

- **Giữ file gốc** tải từ cổng thuế / cổng hóa đơn / phần mềm kế toán: XML, Excel. Không sửa dòng tiêu đề cột,
  không gộp tay nhiều kỳ vào một sheet, không chỉ lưu bản PDF thay cho XML/Excel.
- PDF, ảnh chụp chỉ là bản **để xem**, lưu **kèm** bản gốc. App chưa đọc được PDF scan / ảnh chụp.
- **File nén (`.rar`, `.zip`, `.7z`) phải giải nén** ra thư mục cùng tên. App không mở file nén.

---

## 2. Từng thư mục

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
└─ QUÝ 1\                    ← công ty khai tháng: THÁNG 01, THÁNG 02…
   ├─ Mua vào\
   │  ├─ XML\                 ← file XML hóa đơn mua vào tải từ cổng (BẮT BUỘC)
   │  ├─ HTML\                ← bản xem hóa đơn mua vào
   │  └─ <MST> - Mua vào - Tổng quan - <từ ngày>_<đến ngày>.xlsx
   └─ Bán ra\
      └─ <MST> - Bán ra - Tổng quan - <từ ngày>_<đến ngày>.xlsx
```

| Thư mục | Lưu gì | Tên file |
| --- | --- | --- |
| `Mua vào\XML` | File XML từng hóa đơn mua vào, tải từ cổng hóa đơn điện tử | Giữ nguyên tên cổng đặt |
| `Mua vào\HTML` | Bản xem từng hóa đơn mua vào | Giữ nguyên tên cổng đặt |
| `Mua vào` | Bảng kê Excel **"Tổng quan" mua vào** tải từ cổng, phủ đủ kỳ | Giữ nguyên tên cổng đặt |
| `Bán ra` | Bảng kê Excel **"Tổng quan" bán ra** tải từ cổng, phủ đủ kỳ | Giữ nguyên tên cổng đặt |

- **Không đổi tên file tải từ cổng** — cả hóa đơn lẻ lẫn bảng kê. Tên cổng đặt sẵn có MST và khoảng ngày, app dựa
  vào đó để nhận mua vào / bán ra và kỳ.
- **Hóa đơn mua vào bắt buộc có file XML** (app đếm, đối chiếu từng hóa đơn). Bán ra **không lưu file lẻ**, chỉ cần
  bảng kê "Tổng quan" — hóa đơn bán ra đã có trong phần mềm xuất hóa đơn.
- **Không lưu PDF** hóa đơn (trùng với HTML, nặng Drive).
- Bảng kê "Tổng quan" tải **đúng khoảng ngày của kỳ** (quý: 01/07–30/09; tháng: cả tháng). Công ty khai tháng tải cả
  quý một lần cũng được — app tự chia hóa đơn vào từng tháng theo ngày lập.

### 3. HỢP ĐỒNG KHÁC

Hợp đồng thuê nhà / thuê xe, vay, góp vốn, đại lý, bảo hiểm…: `HD_<loại>_<đối tác>_<ngày ký YYYYMMDD>.pdf`,
ví dụ `HD_THUENHA_NGUYENVANA_20260105.pdf`, `HD_VAY_VCB_20260301.pdf`. App chỉ ghi nhận.

### 4. TỜ KHAI HẢI QUAN

Mỗi tờ khai một thư mục con **`<số tờ khai>_<ngày đăng ký YYYYMMDD>`**, bên trong để cả bộ:

| File | Tên file |
| --- | --- |
| Tờ khai hải quan (Excel / PDF từ hệ thống hải quan) | `TKHQ_<số tờ khai>.xlsx` / `.pdf` |
| Hóa đơn thương mại, packing list, vận đơn | `INVOICE_<số>.pdf` · `PL_<số>.pdf` · `BL_<số>.pdf` |
| Chứng từ nộp thuế nhập khẩu / lệ phí | `GNT_HQ_<số tờ khai>.pdf` · `LEPHI_<số tờ khai>.pdf` |
| Hóa đơn cước tàu, vận chuyển, phí hạ tầng | `HD_CUOC_<số>.pdf` · `HD_VANCHUYEN_<số>.pdf` · `PHIHATANG_<số>.pdf` |

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
| `6. HỒ SƠ ĐĂNG KÝ NGƯỜI PHỤ THUỘC` | Đăng ký NPT + thông báo kết quả | `NPT_<HỌ TÊN NLĐ>_<ngày>.pdf` |

Bảng lương: **tháng nào để trống thì xoá sheet hoặc để trống hẳn**, đừng chép số tháng trước rồi bỏ đó. Lỡ chia
2 file (ví dụ nửa năm đầu / nửa năm sau) app vẫn đọc được, nhưng mỗi tháng chỉ để số ở MỘT file.

### 7. BỘ BÁO CÁO

**Kỳ tháng / quý** — mỗi kỳ một thư mục, đặt thẳng trong `7. BỘ BÁO CÁO`:

```
7. BỘ BÁO CÁO\
├─ BAOCAOTHUE_Q3_2026_HONGDUC\           ← quý: Q1…Q4 · tháng: T01…T12
│  ├─ TỜ KHAI THUẾ\           TK_GTGT_Q3.2026_HONGDUC.xml · TK_TNCN_Q3.2026_HONGDUC.xml (+ .pdf)
│  ├─ THÔNG BÁO CHẤP NHẬN\    TBCN_GTGT_Q3.2026_HONGDUC.xml (+ .pdf)
│  └─ BẢNG KÊ\                BK_MVBR_Q3.2026_HONGDUC.xlsx (bảng kê tải kèm tờ khai)
├─ BAOCAOTHUE_Q3_2026_HONGDUC_BSL1\      ← nộp bổ sung lần 1, ngang hàng bản chính thức
├─ BỘ BÁO CÁO TÀI CHÍNH_2025_HONGDUC\    ← quyết toán + BCTC năm 2025 (để trong thư mục Năm 2025)
└─ BÁO CÁO KHÁC\
```

- **Chỉ lưu thông báo CHẤP NHẬN** (`TBCN_…`). Thông báo tiếp nhận **không lưu**.
- **Phân hệ Tờ khai tự tạo thư mục kỳ và tải tờ khai + thông báo về đúng tên.** Kỳ nào app đã tải thì dùng
  luôn thư mục đó, **không tạo thêm thư mục kỳ bằng tay**. Kỳ chưa dùng phân hệ Tờ khai thì tự tạo đúng tên trên.
- Năm cũ đã xếp kiểu `BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE -Q1` thì **giữ nguyên**, app đọc được cả hai kiểu.
  Trong cùng một năm chỉ dùng một kiểu.

`BẢNG KÊ` của từng kỳ = **bảng kê mua vào + bán ra tải kèm tờ khai đã nộp trên cổng thuế** (một file Excel, hai
sheet MV và BR):

| File | Tên file |
| --- | --- |
| Bảng kê mua vào / bán ra kèm tờ khai 01/GTGT (sheet MV, BR) | `BK_MVBR_Q3.2026_<MÃ KH>.xlsx` |
| Nộp bổ sung: bảng kê kèm tờ khai bổ sung — để trong thư mục kỳ `_BSLn` của lần đó | `BK_MVBR_Q3.2026_<MÃ KH>_BSL1.xlsx` |

- Bảng kê "Tổng quan" tải từ **cổng hóa đơn điện tử** lưu ở **mục 2** (`Mua vào` / `Bán ra`), không lưu ở đây.
- Muốn **soát trước khi nộp** (không bắt buộc): xuất tờ khai nháp từ HTKK (`TKNHAP_GTGT_Q3.2026_<MÃ KH>.xml`) và bảng kê
  từ phần mềm kế toán (`BKPM_MV_…`, `BKPM_BR_…`) bỏ tạm vào `BẢNG KÊ`, bấm Tải lại thư mục trên app. Nộp xong thì
  **xoá các file nháp đó**, chỉ để lại bảng kê kèm tờ khai đã nộp.

**Quyết toán + BCTC năm** — thư mục `BỘ BÁO CÁO TÀI CHÍNH_<năm>_<MÃ KH>` nằm trong thư mục **năm của số liệu**
(BCTC 2025 nộp tháng 3/2026 vẫn để trong `Năm 2025`):

| Thư mục con | File | Tên file |
| --- | --- | --- |
| `TỜ KHAI THUẾ` | Quyết toán TNDN, quyết toán TNCN, BCTC (XML đã nộp + PDF) | `TK_03TNDN_NAM.2025_<MÃ KH>.xml` · `TK_05QTT_NAM.2025_…` · `TK_BCTC_NAM.2025_…` |
| `THÔNG BÁO CHẤP NHẬN` | Thông báo chấp nhận | `TBCN_03TNDN_NAM.2025_…` · `TBCN_BCTC_NAM.2025_…` |
| `BẢNG KÊ` | **BCTC bản Excel** | `BCTC_NAM.2025_<MÃ KH>.xlsx` hoặc giữ tên MISA |

Bảng cân đối tài khoản cả năm **không lưu thêm ở đây**: lần xuất cuối năm ở `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI
KHOẢN…` (lũy kế đến 31/12) chính là bảng cả năm — app tự tìm. Mọi file Excel trong thư mục `BỘ BÁO CÁO TÀI CHÍNH_…`
đều được Rủi ro thuế mở đọc, nên BCTC Excel giữ tên MISA cũng được.

`BÁO CÁO KHÁC`: báo cáo thống kê, báo cáo tình hình sử dụng hóa đơn, báo cáo lao động… —
`BC_<loại>_<kỳ>.<năm>_<MÃ KH>.pdf`.

### 8. SỔ SÁCH KẾ TOÁN

Giữ 9 thư mục con như mẫu. Sổ sách **tải hàng loạt từ MISA** nên **giữ nguyên tên mặc định MISA đặt**, không đổi
tên (app nhận các tên này). Báo cáo xuất **bản Excel**, chứng từ xuất **PDF**:

| Thư mục con | Báo cáo MISA → tên file mặc định |
| --- | --- |
| `1. PHIẾU THU_PHIẾU CHI` | Sổ quỹ tiền mặt `So_quy_tien_mat.xlsx` · chứng từ PDF `Phieuthu.pdf`, `Phieuchi.pdf`, `Uynhiemchi.pdf`, `Thutiengui.pdf` |
| `2. PHIẾU XUẤT KHO_PHIẾU NHẬP KHO` | `Nhapkho.pdf` · `Xuatkho.pdf` |
| `3. BẢNG CÂN ĐỐI TÀI KHOẢN MẪU 2 BÊN (BẬC 3)` | `Bang_can_doi_tai_khoan_mau_quan_tri.xlsx` — **lũy kế từ đầu năm**, bậc 3 |
| `4. CÔNG NỢ PHẢI THU_PHẢI TRẢ` | `Tong_hop_cong_no_phai_thu_khach_hang.xlsx` · `Chi_tiet_cong_no_phai_thu_khach_hang.xlsx` · `Tong_hop_cong_no_phai_tra_nha_cung_cap.xlsx` · `Chi_tiet_cong_no_phai_tra_nha_cung_cap.xlsx` |
| `5. HÀNG TỒN KHO` | `Tong_hop_ton_kho.xlsx` · `So_chi_tiet_vat_tu_hang_hoa.xlsx` |
| `6. BẢNG TÍNH KHẤU HAO CCDC_TSCĐ` | `So_tai_san_co_dinh.xlsx` · `So_theo_doi_cong_cu_dung_cu.xlsx` · `Bang_tinh_phan_bo_chi_phi_tra_truoc.xlsx` |
| `7. SỔ NHẬT KÝ CHUNG` | `So_nhat_ky_chung.xlsx` |
| `8. SỔ CHI TIẾT CÁC TÀI KHOẢN` | `So_chi_tiet_cac_tai_khoan.xlsx` · `So_tien_gui_ngan_hang.xlsx` · `So_cai.xlsx` |
| `9. BẢNG TÍNH GIÁ THÀNH` | `Bang_tinh_gia_thanh.xlsx` · công trình: `Bao_cao_tong_hop_lai_lo_theo_cong_trinh.xlsx`, `Bao_cao_chi_tiet_lai_lo_theo_cong_trinh.xlsx` |

- **Mỗi báo cáo MỘT file, luôn xuất LŨY KẾ từ đầu năm đến hết kỳ vừa làm.** Kỳ sau xuất lại thì **thay file cũ**
  (xoá file cũ rồi chép file mới vào) — không để `(1)`, `(2)` cạnh nhau, app không biết file nào mới.
- **Chứng từ tải hàng loạt ra file nén** (`N-Phieuchi-31-12-2025.zip`, `N-Nhapkho-…`, `N-PhanboCCDC-…`): **giải nén** ra
  thư mục cùng tên ngay chỗ đó, giữ nguyên tên MISA đặt. Giải nén rồi thì xoá file `.zip` (hoặc để cũng được — app tự
  bỏ qua file nén đã có thư mục giải nén cùng tên).
- Sổ quỹ tiền mặt để ở `1.`, sổ tiền gửi ngân hàng + sổ cái để ở `8.` — **không tạo thêm** thư mục `10. SỔ QUỸ`,
  `11. SỔ TIỀN GỬI`, `9. SỔ CÁI`…
- Bảng kê mua vào / bán ra mẫu quản trị của MISA không để ở đây (xem mục 7, chỉ để tạm khi soát trước khi nộp).

### 9. SỔ PHỤ NGÂN HÀNG

```
9. SỔ PHỤ NGÂN HÀNG\
└─ QUÝ 3\          ← công ty khai tháng vẫn chia theo quý, mỗi tháng một file
```

Tên file: `SOPHU_<NGÂN HÀNG>_<4 số cuối tài khoản>_T09.2026_<MÃ KH>.xlsx`, ví dụ `SOPHU_VCB_6906_T09.2026_HONGDUC.xlsx`.
**Mỗi file một tài khoản, một tháng** — sao kê ngân hàng trả về theo khoảng ngày khác thì vẫn đặt theo tháng chính
của nó. Ưu tiên Excel tải từ ngân hàng, PDF chỉ khi ngân hàng không cho tải Excel. Không tạo thư mục riêng theo
ngân hàng (tên ngân hàng đã nằm trong tên file).

### 10. GIẤY NỘP TIỀN

`GNT_<sắc thuế>_<kỳ>.<năm>_<MÃ KH>_<ngày nộp YYYYMMDD>.pdf`, ví dụ `GNT_GTGT_Q3.2026_HONGDUC_20261030.pdf`,
`GNT_MONBAI_NAM.2026_HONGDUC_20260128.pdf`. Nộp tiền chậm nộp / phạt: sắc thuế ghi `CHAMNOP` / `PHAT`.

### 11. CÁC THÔNG BÁO_CÔNG VĂN

Thông báo, công văn, quyết định của cơ quan thuế, BHXH, ngân hàng…:
`CV_<cơ quan>_<số văn bản>_<ngày YYYYMMDD>.pdf`, ví dụ `CV_CQT_1234-TB-CCT_20260915.pdf`,
`CV_BHXH_56-TB_20260820.pdf`. Cơ quan: `CQT` (thuế), `BHXH`, `HQ` (hải quan), `NH` (ngân hàng), `KHAC`.
Số văn bản có `/` thì đổi thành `-`.

### 12. HÌNH ẢNH

Ảnh chèn vào **nhật ký làm việc với khách hàng** (file `SVT.MB07.NHẬT KÝ CÔNG VIỆC - KHÁCH HÀNG.xlsx`): ảnh chụp
tin nhắn, chứng từ khách gửi qua Zalo / email, ảnh hiện trạng kho, biển hiệu…

- Tên file: `ANH_<ngày YYYYMMDD>_<nội dung ngắn>.jpg`, ví dụ `ANH_20261031_KHACH_GUI_HD_DIEN.jpg`,
  `ANH_20261031_ZALO_XAC_NHAN_SO_DU.png`. Một ngày nhiều ảnh cùng nội dung thì thêm `_01`, `_02`.
- **Ngày trong tên file = ngày của dòng nhật ký** chèn ảnh đó — mở nhật ký là tìm ra ảnh, và ngược lại.
- Ảnh **chứng từ kế toán** (hóa đơn, phiếu chi, sao kê khách chụp gửi) vẫn lưu thêm vào đúng thư mục 1–11 của nó;
  thư mục 12 chỉ giữ ảnh đi kèm nhật ký. App chỉ ghi nhận thư mục, không soát.

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
| `ANH` | Ảnh chèn nhật ký làm việc với khách hàng | 12 |

Sắc thuế: `GTGT` · `TNCN` · `TNDN` · `MONBAI` (lệ phí môn bài) · `03TNDN` · `05QTT` · `BCTC` · `CNKD` (hộ kinh doanh).

---

## 4. Lưu xong thì kiểm trên app

Mở **Soát xét báo cáo → Hồ sơ dữ liệu**, chọn công ty, bấm **↻ Tải lại thư mục**:

- Ô **xanh** = đã có. Ô **đỏ** = thiếu — app ghi rõ thiếu kỳ nào, file gì.
- **"File cần xem"** = file nén chưa giải nén, file app không mở được, hoặc file để lạc thư mục.
- Ô vàng chấm = kỳ chưa tới hạn nộp, chưa cần.
