// Kiểm kết nối Google Drive của module Phòng Kinh doanh: đăng nhập bằng tài khoản dịch vụ, tạo 1 thư
// mục "[TEST] kiểm tra kết nối" trong thư mục "1. BÁO GIÁ", nộp 1 file nhỏ, rồi bỏ cả hai vào thùng rác.
//
//   node --env-file=.env.local scripts/test-drive-connection.mjs
//
// Không đụng file nào khác trên Drive.
import { driveConfigured, ensureFolder, uploadFile, trashFile } from '../lib/googleDrive.js'

const step = (ok, text) => console.log((ok ? '  [OK]   ' : '  [LỖI]  ') + text)

if (!driveConfigured()) {
  console.log('Thiếu biến môi trường. Cần đủ GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, SALES_DRIVE_FOLDER_ID trong .env.local')
  process.exit(1)
}
console.log('Tài khoản dịch vụ: ' + process.env.GOOGLE_SA_EMAIL)
console.log('Thư mục gốc:       https://drive.google.com/drive/folders/' + process.env.SALES_DRIVE_FOLDER_ID + '\n')

let folder, file
try {
  folder = await ensureFolder('[TEST] kiểm tra kết nối app ' + new Date().toISOString().slice(0, 16).replace('T', ' '))
  step(true, 'Đăng nhập Google + tạo thư mục thử: ' + (folder.webViewLink || folder.id))
  file = await uploadFile(folder.id, 'thu-ket-noi.txt', 'text/plain', new TextEncoder().encode('Savitax app — kiểm tra kết nối Drive'))
  step(true, 'Nộp file thử: ' + (file.webViewLink || file.id))
} catch (e) {
  step(false, e.message)
  const m = String(e.message)
  if (/storage quota/i.test(m)) console.log('\n  → Thư mục đang nằm trong "Drive của tôi". Tài khoản dịch vụ KHÔNG có dung lượng riêng, chỉ ghi được vào Shared drive (Drive dùng chung).')
  else if (/not found|404/i.test(m)) console.log('\n  → Tài khoản dịch vụ chưa được thêm vào Shared drive, hoặc SALES_DRIVE_FOLDER_ID sai.')
  else if (/invalid_grant|private key|PEM|DECODER/i.test(m)) console.log('\n  → GOOGLE_SA_PRIVATE_KEY chép thiếu/sai. Chép nguyên giá trị "private_key" trong file JSON, kể cả dòng BEGIN/END.')
  else if (/has not been used|disabled/i.test(m)) console.log('\n  → Chưa bật Google Drive API cho project trên Google Cloud.')
  process.exitCode = 1
}
// Dọn: bỏ file + thư mục thử vào thùng rác
try {
  if (file) await trashFile(file.id)
  if (folder) await trashFile(folder.id)
  if (folder) step(true, 'Đã bỏ file + thư mục thử vào thùng rác')
} catch (e) {
  step(false, 'Chưa dọn được thư mục thử (xoá tay giúp): ' + e.message)
}
console.log(process.exitCode ? '\nKết nối CHƯA dùng được.' : '\nKết nối Drive dùng được.')
