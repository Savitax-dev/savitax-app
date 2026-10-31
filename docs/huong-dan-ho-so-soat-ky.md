# Soát kỳ tháng / quý — Hồ sơ cần để trong thư mục công ty

Màn **Soát kỳ** (phân hệ Soát xét báo cáo) đọc thẳng thư mục công ty trên Drive để kiểm tờ khai, hóa đơn,
lương, bảo hiểm của từng kỳ. App **chỉ đọc**: không sửa, không đổi tên, không ghi file nào vào thư mục.

Nhân viên chỉ cần **để đúng file vào đúng chỗ**. Thiếu file nào thì app ghi rõ "Thiếu hồ sơ" và tên file
cần có — các kiểm tra khác vẫn chạy.

> Bản hướng dẫn soạn trước khi code (26/10/2026). Tên nút và màn hình có thể đổi chút khi làm xong.

---

## Việc hằng kỳ: thêm đúng 2 bước

Tờ khai đã có phân hệ Tờ khai tự tải về. Mỗi kỳ nhân viên chỉ thêm:

> Chỗ lưu và cách đặt tên file của từng thư mục 1–12: xem **`docs/quy-uoc-luu-ho-so.md`** (bản Word cùng tên).

1. **Tải bảng kê chi tiết hóa đơn trên cổng hóa đơn điện tử** — cả **mua vào** và **bán ra**, dạng Excel.
   Bỏ vào `2. HÓA ĐƠN MUA VÀO_BÁN RA\<kỳ>\Mua vào` / `Bán ra` — **chỉ ở mục 2** (Excel trong `7. BỘ BÁO CÁO` app hiểu là
   bảng kê kèm tờ khai). App tự nhận file nào
   mua vào, file nào bán ra (theo MST công ty trong file), và tự tính file phủ những tháng nào (theo ngày lập
   từng hóa đơn).
2. **Hóa đơn mua vào: tải thêm file XML** về `2. HÓA ĐƠN MUA VÀO_BÁN RA\<tháng>\…\Mua vào`. Thư mục tháng
   đặt kiểu nào cũng được (`THÁNG 04`, `T01+02+03`, `QUÝ 2`…). **Hóa đơn bán ra không cần tải file** — đã
   xuất thẳng từ phần mềm, chỉ cần bảng kê ở bước 1.
3. **Làm xong báo cáo kỳ → xuất bảng kê mua vào / bán ra từ phần mềm kế toán** (Excel) → bỏ vào
   `7. BỘ BÁO CÁO\BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_<kỳ>\BẢNG KÊ`. Kỳ của bảng kê phần mềm lấy theo
   thư mục kỳ chứa nó (bảng kê hay có lẫn hóa đơn tháng trước kê khai muộn).

Tháng nào tờ khai ghi giá trị mua vào [23] = 0 thì app không đòi bảng kê / XML mua vào; doanh thu [34] = 0
thì không đòi bảng kê bán ra.

Muốn **soát trước khi nộp**: xuất tờ khai từ HTKK (XML) bỏ cùng thư mục `BẢNG KÊ`, mở app bấm **Đọc lại**.
Lệch thì sửa trong phần mềm, xuất lại, đọc lại — rồi mới nộp.

---

## Hồ sơ theo 3 mức

### Mức 1 — bắt buộc (thiếu thì không soát được kỳ)

| Hồ sơ | Để ở đâu |
| --- | --- |
| Tờ khai 01/GTGT của kỳ (XML) | Bản đã nộp: `BAOCAOTHUE_<kỳ>\TỜ KHAI THUẾ` (phân hệ Tờ khai tự tải). Bản chưa nộp: `BAOCAOTHUE_<kỳ>\BẢNG KÊ` |
| Bảng kê chi tiết mua vào + bán ra tải từ cổng HĐĐT (Excel) | `BAOCAOTHUE_<kỳ>\BẢNG KÊ` hoặc `2. HÓA ĐƠN MUA VÀO_BÁN RA` |
| File hóa đơn XML **mua vào** từng tháng (bán ra không cần) | `2. HÓA ĐƠN MUA VÀO_BÁN RA\<tháng>\…\Mua vào` |

### Mức 2 — nên có (soát đủ phần thuế GTGT)

| Hồ sơ | Để ở đâu | Để làm gì |
| --- | --- | --- |
| Bảng kê xuất từ phần mềm kế toán (Excel) | `BAOCAOTHUE_<kỳ>\BẢNG KÊ` | Chỉ ra từng hóa đơn có trên cổng mà chưa vào phần mềm |
| Tờ khai 01/GTGT kỳ trước | Thư mục `BAOCAOTHUE` kỳ trước | Kiểm [22] kỳ này = [43] kỳ trước |
| Tờ khai các kỳ trong năm và năm trước | Các thư mục `BAOCAOTHUE` | Kiểm kỳ khai tháng/quý có đúng không |

### Mức 3 — có thì app soát thêm

| Hồ sơ | Để ở đâu |
| --- | --- |
| Tờ khai 05/KK-TNCN của kỳ | `BAOCAOTHUE_<kỳ>\TỜ KHAI THUẾ` |
| Bảng lương các tháng trong kỳ | `6. LƯƠNG\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG` |
| C12 tháng cuối kỳ | `5. BẢO HIỂM XÃ HỘI\1. C12` |
| Sổ phụ ngân hàng | `9. SỔ PHỤ NGÂN HÀNG\QUÝ n` |
| Sổ chi tiết TK 112 | `8. SỔ SÁCH KẾ TOÁN\8. SỔ CHI TIẾT CÁC TÀI KHOẢN` |
| Sổ quỹ tiền mặt | `8. SỔ SÁCH KẾ TOÁN\1. PHIẾU THU_PHIẾU CHI` |
| Bảng cân đối tài khoản lũy kế | `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI KHOẢN MẪU 2 BÊN` |

Công ty **không phát sinh** loại hồ sơ nào (không có lao động, không nhập khẩu…) thì đặt đuôi `(kps)` vào
tên thư mục đó như đang làm — app hiểu là không phát sinh, không báo thiếu.

---

## Lưu ý để app đọc đúng

- **Giữ nguyên file Excel** tải từ cổng / xuất từ phần mềm. Đừng sửa dòng tiêu đề cột, đừng gộp nhiều
  quý vào một sheet bằng tay.
- **Tên file đặt tự do.** App nhận loại file theo nội dung. Lỡ để file bán ra vào thư mục mua vào, app vẫn
  nhận đúng và nhắc để lại cho gọn.
- **Tờ khai nên có XML.** Không có XML thì app đọc bản PDF in từ cổng / HTKK (PDF có chữ). PDF chụp / scan
  thì chưa đọc được.
- **Công ty khai tháng** tải bảng kê cổng cả quý là được — app tự chia hóa đơn theo ngày vào từng tháng.
- **File nén (`.rar`, `.zip`) phải giải nén** ra thư mục — app không mở file nén, chỉ báo "File cần xem".
- **Kỳ khai (tháng / quý) cố định cả năm.** Nếu app báo "hồ sơ công ty đang ghi Quý nhưng tờ khai là
  Tháng" (hoặc ngược lại) thì kiểm lại ô loại báo cáo trong hồ sơ công ty — thường là tick nhầm.
