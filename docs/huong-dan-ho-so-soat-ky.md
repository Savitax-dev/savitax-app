# Soát kỳ tháng / quý — Hồ sơ cần để trong thư mục công ty

Màn **Soát kỳ** (phân hệ Soát xét báo cáo) đọc thẳng thư mục công ty trên Drive để kiểm tờ khai, hóa đơn,
lương, bảo hiểm của từng kỳ. App **chỉ đọc**: không sửa, không đổi tên, không ghi file nào vào thư mục.

Nhân viên chỉ cần **để đúng file vào đúng chỗ**. Thiếu file nào thì app ghi rõ "Thiếu hồ sơ" và tên file
cần có — các kiểm tra khác vẫn chạy.

> Bản hướng dẫn soạn trước khi code (26/10/2026). Tên nút và màn hình có thể đổi chút khi làm xong.

---

## Việc hằng kỳ: thêm đúng 2 bước

Tờ khai đã có phân hệ Tờ khai tự tải về. Mỗi kỳ nhân viên chỉ thêm:

> Cây thư mục chuẩn là **cây ISO SVT.MB09** (08/11/2026). Chỗ lưu và cách đặt tên file của từng thư mục 1–11: xem
> **`docs/quy-uoc-luu-ho-so.md`** (bản Word cùng tên). Dưới đây `BCT-<kỳ>` = `7. BỘ BÁO CÁO\1. BỘ BCT QUÝ_THÁNG\BCT-Q3`
> (khai tháng: `BCT-T09`). Kỳ phân hệ Tờ khai tự tải về nằm ở `7. BỘ BÁO CÁO\BAOCAOTHUE_<kỳ>_…` — app đọc cả hai.

1. **Tải bảng kê chi tiết hóa đơn trên cổng hóa đơn điện tử** — cả **mua vào** và **bán ra**, dạng Excel.
   Bỏ vào `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO` / `HĐ BÁN RA` — **chỉ ở mục 2** (Excel trong `7. BỘ BÁO CÁO` app hiểu là
   bảng kê kèm tờ khai). App tự nhận file nào
   mua vào, file nào bán ra (theo MST công ty trong file), và tự tính file phủ những tháng nào (theo ngày lập
   từng hóa đơn).
2. **Hóa đơn mua vào: tải thêm file XML** về `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO`. Công ty khai tháng dùng
   thư mục `THÁNG 01…THÁNG 12` thay cho `QUÝ n` (để trong `QUÝ n` thì app gán hóa đơn cho cả 3 tháng). **Hóa đơn bán ra không cần tải file** — đã
   xuất thẳng từ phần mềm, chỉ cần bảng kê ở bước 1.
3. **Làm xong báo cáo kỳ → xuất bảng kê mua vào / bán ra từ phần mềm kế toán** (Excel) → bỏ vào
   `BCT-<kỳ>\BẢNG KÊ`. Kỳ của bảng kê phần mềm lấy theo
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
| Tờ khai 01/GTGT của kỳ (XML) | Bản đã nộp: `BCT-<kỳ>\TỜ KHAI THUẾ\01GTGT` (hoặc thư mục phân hệ Tờ khai tự tải). Bản chưa nộp: `BCT-<kỳ>\BẢNG KÊ` |
| Bảng kê chi tiết mua vào + bán ra tải từ cổng HĐĐT (Excel) | `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO` / `HĐ BÁN RA` — chỉ ở mục 2 |
| File hóa đơn XML **mua vào** từng tháng (bán ra không cần) | `2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n\HĐ MUA VÀO` |

### Mức 2 — nên có (soát đủ phần thuế GTGT)

| Hồ sơ | Để ở đâu | Để làm gì |
| --- | --- | --- |
| Bảng kê xuất từ phần mềm kế toán (Excel) | `BCT-<kỳ>\BẢNG KÊ` | Chỉ ra từng hóa đơn có trên cổng mà chưa vào phần mềm |
| Tờ khai 01/GTGT kỳ trước | Thư mục `BCT-<kỳ>` kỳ trước | Kiểm [22] kỳ này = [43] kỳ trước |
| Tờ khai các kỳ trong năm và năm trước | Các thư mục `BCT-<kỳ>` | Kiểm kỳ khai tháng/quý có đúng không |

### Mức 3 — có thì app soát thêm

| Hồ sơ | Để ở đâu |
| --- | --- |
| Tờ khai 05/KK-TNCN của kỳ | `BCT-<kỳ>\TỜ KHAI THUẾ\05KK TNCN` |
| Bảng lương các tháng trong kỳ | `6. LƯƠNG\1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG` |
| C12 tháng cuối kỳ | `5. BẢO HIỂM XÃ HỘI\1. C12` |
| Sổ phụ ngân hàng | `9. SỔ PHỤ NGÂN HÀNG\QUÝ n` |
| Sổ chi tiết TK 112 | `8. SỔ SÁCH KẾ TOÁN\8. SỔ CHI TIẾT CÁC TÀI KHOẢN` |
| Sổ quỹ tiền mặt | `8. SỔ SÁCH KẾ TOÁN\1. PHIẾU THU_PHIẾU CHI` |
| Bảng cân đối tài khoản lũy kế | `8. SỔ SÁCH KẾ TOÁN\3. BẢNG CÂN ĐỐI TÀI KHOẢN MẪU 2 BÊN (BẬC 3)` |

Công ty **không phát sinh** loại hồ sơ nào (không có lao động, không nhập khẩu…) thì đặt đuôi `(kps)` vào
tên thư mục đó như đang làm — app hiểu là không phát sinh, không báo thiếu.

---

## Lưu ý để app đọc đúng

- **Giữ nguyên file Excel** tải từ cổng / xuất từ phần mềm. Đừng sửa dòng tiêu đề cột, đừng gộp nhiều
  quý vào một sheet bằng tay.
- **App nhận loại file theo nội dung** (đặt tên theo quy ước để người tìm cho nhanh; file tải từ cổng / MISA giữ tên gốc). Lỡ để file bán ra vào thư mục mua vào, app vẫn
  nhận đúng và nhắc để lại cho gọn.
- **Tờ khai nên có XML.** Không có XML thì app đọc bản PDF in từ cổng / HTKK (PDF có chữ). PDF chụp / scan
  thì chưa đọc được.
- **Công ty khai tháng** dùng thư mục `THÁNG 01…12` ở mục 2, mỗi tháng một bảng kê cổng đúng khoảng ngày của tháng.
- **File nén (`.rar`, `.zip`) phải giải nén** ra thư mục — app không mở file nén, chỉ báo "File cần xem".
- **Kỳ khai (tháng / quý) cố định cả năm.** Nếu app báo "hồ sơ công ty đang ghi Quý nhưng tờ khai là
  Tháng" (hoặc ngược lại) thì kiểm lại ô loại báo cáo trong hồ sơ công ty — thường là tick nhầm.
