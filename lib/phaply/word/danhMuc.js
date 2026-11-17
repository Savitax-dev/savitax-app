// Phân hệ Pháp lý — danh mục mẫu Word thủ tục THÀNH LẬP MỚI (1TV / 2TV / CP).
// Nguồn: bộ hồ sơ phòng pháp lý đã nộp thật 09–10/2026 + các file "Hướng dẫn in ký" kèm theo (anh gửi 06/11/2026).
// Hai đợt: 'so'   = hồ sơ thành lập nộp Phòng ĐKKD (trước khi có mã số doanh nghiệp)
//          'thue' = hồ sơ pháp lý ban đầu (HSPLBD), làm sau khi có GCN ĐKDN / mã số thuế.
// thuTu = thứ tự in + đặt tên file trong bộ; nguoiKy = dòng hướng dẫn in ký (theo loại hình nếu khác nhau).
// Sau này nạp vào bảng legal_doc_templates; đây là bản gốc để dựng file và kiểm.

export const LOAI_HINH = { '1tv': 'TNHH một thành viên', '2tv': 'TNHH hai thành viên trở lên', cp: 'Cổ phần' }

export const DANH_MUC = [
  // ─── Đợt 1: nộp Phòng ĐKKD ───
  { ma: 'UQ_SO', ten: 'Giấy ủy quyền (nộp Phòng ĐKKD)', dot: 'so', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 1,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên' } },
  { ma: 'DL_1TV', ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['1tv'], thuTu: 2, nguoiKy: { '1tv': 'Chủ sở hữu ký tên (trang cuối)' } },
  { ma: 'DL_2TV', ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['2tv'], thuTu: 2, nguoiKy: { '2tv': 'Các thành viên ký tên (trang cuối)' } },
  { ma: 'DL_CP', ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['cp'], thuTu: 2, nguoiKy: { cp: 'Các cổ đông ký tên (trang cuối), Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU2', ten: 'Mẫu số 2 — Giấy đề nghị đăng ký doanh nghiệp (TNHH 1TV)', dot: 'so', loaiHinh: ['1tv'], thuTu: 3, nguoiKy: { '1tv': 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU3', ten: 'Mẫu số 3 — Giấy đề nghị đăng ký doanh nghiệp (TNHH 2TV trở lên)', dot: 'so', loaiHinh: ['2tv'], thuTu: 3, nguoiKy: { '2tv': 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU4', ten: 'Mẫu số 4 — Giấy đề nghị đăng ký doanh nghiệp (Công ty cổ phần)', dot: 'so', loaiHinh: ['cp'], thuTu: 3, nguoiKy: { cp: 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU6', ten: 'Mẫu số 6 — Danh sách thành viên công ty TNHH hai thành viên trở lên', dot: 'so', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Các thành viên ký tên (ở cột thứ 13) và Giám đốc ký tên (ở cuối trang)' } },
  { ma: 'MAU7', ten: 'Mẫu số 7 — Danh sách cổ đông sáng lập', dot: 'so', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Các cổ đông ký tên (ở cột thứ 18) và Giám đốc ký tên (ở cuối trang)' } },
  { ma: 'MAU10', ten: 'Mẫu số 10 — Danh sách chủ sở hữu hưởng lợi của doanh nghiệp', dot: 'so', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 5,
    nguoiKy: { '1tv': 'Giám đốc ký tên (trang cuối)', '2tv': 'Giám đốc ký tên (trang cuối)', cp: 'Giám đốc ký tên (trang cuối)' } },

  // ─── Đợt 2: hồ sơ pháp lý ban đầu (sau khi có mã số doanh nghiệp) ───
  { ma: 'GGT', ten: 'Giấy giới thiệu', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 1,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'UQ_THUE', ten: 'Giấy ủy quyền (làm việc với cơ quan thuế)', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 2,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'KHTS', ten: 'Đăng ký phương pháp khấu hao tài sản cố định', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 3,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'SSKT', ten: 'Đăng ký mở sổ sách kế toán trên máy vi tính', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 4,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  // Pháp lý chốt 17/11/2026: 08-MST cần cho CẢ 3 loại hình (bộ 1TV đã nộp 10/2026 thiếu)
  { ma: 'MAU08', ten: 'Mẫu số 08-MST — Tờ khai điều chỉnh, bổ sung thông tin đăng ký thuế', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 5,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu, giáp lai' } },
  { ma: 'QD_GD_CSH', ten: 'Quyết định bổ nhiệm Giám đốc (Chủ sở hữu)', dot: 'thue', loaiHinh: ['1tv'], thuTu: 6, nguoiKy: { '1tv': 'Chủ sở hữu ký tên, đóng dấu' } },
  { ma: 'QD_GD_HDTV', ten: 'Quyết định bổ nhiệm Giám đốc (Hội đồng thành viên)', dot: 'thue', loaiHinh: ['2tv'], thuTu: 6, nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' } },
  { ma: 'QD_GD_HDQT', ten: 'Quyết định bổ nhiệm Giám đốc (Hội đồng quản trị)', dot: 'thue', loaiHinh: ['cp'], thuTu: 6, nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu' } },
  { ma: 'BBH_HDTV', ten: 'Biên bản họp Hội đồng thành viên — bổ nhiệm Giám đốc', dot: 'thue', loaiHinh: ['2tv'], thuTu: 7, nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' } },
  { ma: 'BBH_HDQT', ten: 'Biên bản họp Hội đồng quản trị — bổ nhiệm Giám đốc', dot: 'thue', loaiHinh: ['cp'], thuTu: 7, nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu, giáp lai' } },
]

// Lưu ý in ký theo (đợt, loại hình) — chép từ file "Hướng dẫn in ký" của phòng
export const LUU_Y_IN_KY = {
  so: { '1tv': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'],
        '2tv': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'],
        cp: ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'] },
  thue: { '1tv': ['In trên 1 mặt giấy.', 'Mỗi file 4 bản.', 'Ký bằng bút mực xanh.'],
          '2tv': ['Ký bằng bút mực xanh.'],
          cp: ['Ký mực xanh.', 'Kèm 2 bản GPKD photo đóng mộc treo.'] },
}

export const mauCuaBo = (dot, loaiHinh) => DANH_MUC.filter(d => d.dot === dot && d.loaiHinh.includes(loaiHinh)).sort((a, b) => a.thuTu - b.thuTu)
