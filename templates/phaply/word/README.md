# Mẫu Word — Phân hệ Pháp lý, thủ tục Thành lập mới

19 mẫu (`<MÃ>.docx`) có thẻ docxtemplater, **sinh tự động** — đừng sửa file .docx bằng tay; sửa văn bản nguồn
`lib/phaply/word/nguon/<MÃ>.txt` (cú pháp ở đầu `lib/phaply/word/khung.js`) rồi chạy `node scripts/test-phaply-word.mjs`.

Soạn 06/11/2026 theo bộ hồ sơ phòng pháp lý đã nộp thật 09–10/2026 (Mẫu 2/3/4/10 theo TT 121/2026/TT-BTC, 08-MST theo
TT 90/2026). Khớp chữ với bản đã nộp 97–99% khi điền cùng dữ liệu. Phân hệ Pháp lý CHƯA lên app.

| Mã | Giấy tờ | Loại hình | Đợt |
|---|---|---|---|
| UQ_SO | Giấy ủy quyền nộp Phòng ĐKKD | 1TV / 2TV / CP | Sở |
| DL_1TV, DL_2TV, DL_CP | Điều lệ | theo loại hình | Sở |
| MAU2, MAU3, MAU4 | Giấy đề nghị đăng ký doanh nghiệp | 1TV / 2TV / CP | Sở |
| MAU6, MAU7 | Danh sách thành viên / cổ đông sáng lập | 2TV / CP | Sở |
| MAU10 | Danh sách chủ sở hữu hưởng lợi | 1TV / 2TV / CP | Sở |
| GGT, UQ_THUE, KHTS, SSKT | Giấy giới thiệu, ủy quyền thuế, khấu hao TSCĐ, mở sổ kế toán | 1TV / 2TV / CP | Hồ sơ pháp lý ban đầu |
| MAU08 | 08-MST | 1TV / 2TV / CP | Hồ sơ pháp lý ban đầu |
| QD_GD_CSH / _HDTV / _HDQT | Quyết định bổ nhiệm Giám đốc | 1TV / 2TV / CP | Hồ sơ pháp lý ban đầu |
| BBH_HDTV / BBH_HDQT | Biên bản họp bổ nhiệm Giám đốc | 2TV / CP | Hồ sơ pháp lý ban đầu |

- Danh mục, người ký, thứ tự in: `lib/phaply/word/danhMuc.js`; tờ hướng dẫn in ký sinh từ đó (`huongDanInKy.js`).
- Từ điển trường DUY NHẤT: `lib/phaply/word/duLieu.js` (`chuanBiDuLieu`). Điền: `lib/phaply/word/xuat.js` (`dienMau`).
- Kiểm: `node scripts/test-phaply-word.mjs [--pdf]` (dữ liệu giả `scripts/phaply-du-lieu-gia.mjs`; `--pdf` cần Microsoft Word).
- Đối chiếu với bản thật: `node scripts/phaply-dien-thu.mjs <MÃ> <ho-so.json> <ra.docx>` — file hồ sơ thật ĐỂ NGOÀI REPO.
- Bộ duyệt cho phòng pháp lý: `node scripts/phaply-mau-word-cho-duyet.mjs` → `data/phaply/mau-word-cho-duyet/`
  (PDF từng loại hình + `Can-chot-mau-Word.xlsx` 24 chỗ cần chốt). Mẫu chưa bật cho nhân viên khi pháp lý chưa duyệt.
