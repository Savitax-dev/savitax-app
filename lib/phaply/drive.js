// Phân hệ Pháp lý — lưu hồ sơ lên Shared drive phòng pháp lý ("7. SAVITAX - PHÁP LÝ DENALI"), anh duyệt 17/11/2026.
// Tài khoản dịch vụ dùng chung với phòng Kinh doanh (lib/googleDrive.js, GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY) — anh đã chia sẻ
// thư mục gốc cho nó. Mỗi thủ tục một thư mục gốc (biến môi trường); chưa đặt biến = chưa lưu Drive được (bản demo cố ý KHÔNG đặt).
// Cây mỗi hồ sơ: <gốc>/<PL-AAMM-NN - TÊN CÔNG TY>/{8 thư mục THU_MUC}. Đổi tên thư mục con chỉ sửa THU_MUC.

// Thư mục gốc theo thủ tục (đoạn cuối URL thư mục). tlm = "3. HỒ SƠ THÀNH LẬP" (id 1GfnVapMRGmPKPaCooq4FLFXtxHOPshjt).
export const GOC_THEO_THU_TUC = { tlm: 'PHAPLY_DRIVE_TLM' }
export const thuMucGoc = thuTuc => process.env[GOC_THEO_THU_TUC[thuTuc]] || null
export const coDrive = thuTuc => !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && thuMucGoc(thuTuc))

// 8 thư mục con theo bước hồ sơ (kế hoạch mục 3) — tạo đủ cả 8 ngay lần lưu đầu để nhân viên thả bản scan vào đúng chỗ
export const THU_MUC = {
  tiep_nhan: '1. TIẾP NHẬN',
  thu_thap: '2. THU THẬP THÔNG TIN',
  bao_gia: '3. BÁO GIÁ - ĐNTT',
  soan: '4. SOẠN HỒ SƠ',
  trinh_ky: '5. TRÌNH KÝ',
  nop: '6. NỘP HỒ SƠ',
  ket_qua: '7. KẾT QUẢ',
  ban_giao: '8. BÀN GIAO',
}
export const THU_MUC_BO = { so: 'Hồ sơ thành lập (nộp Phòng ĐKKD)', thue: 'Hồ sơ pháp lý ban đầu' }   // bộ TLM gốc; thủ tục khác: tên bộ (boHoSo.tenBo)
export const THU_MUC_CCCD = 'CCCD'
export const linkThuMuc = id => (id ? 'https://drive.google.com/drive/folders/' + id : null)
