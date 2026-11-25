// Phân hệ Pháp lý — mẫu Word nhóm TẠM NGỪNG KINH DOANH + HOẠT ĐỘNG LẠI (tiếp tục kinh doanh trước thời hạn), công ty 1TV / 2TV / CP
// và hộ kinh doanh (bộ biểu mẫu mới phòng gửi 25/11/2026: PHONGPHAPLY_BIEUMAU\7_TẠM NGỪNG). Dữ liệu thuần, không import danhMuc /
// thongTin (hai file đó import file này). Gộp ở lib/phaply/word/mauThuTuc/index.js.
//   mau:      mục DANH_MUC (cùng khuôn danhMuc.js: ma, thuTuc, donVi?, kyBoi, ten, dot, loaiHinh, thuTu, nguoiKy, dieuKien?, duLieuThu?)
//   thongTin: { '<biến thể>': [ô …] } — khuôn ô như lib/phaply/thongTin.js
//   luuY:     { '<biến thể>|<bộ>': ['…'] } — lưu ý in ký
//
// Bộ hồ sơ (phòng chốt):  công ty = Giấy ủy quyền + Mẫu 27 + Quyết định của Chủ sở hữu (1TV) / HĐTV (2TV) / HĐQT (CP)
//                         hộ KD   = Giấy ủy quyền + Mẫu 3 (Phụ lục II)
// Hoạt động lại dùng CÙNG mẫu nhà nước (Mẫu 27 / Mẫu 3 đều gồm cả tạm ngừng lẫn tiếp tục kinh doanh) nhưng phần điền khác hẳn → mã
// riêng TN_HDL_… (chưa có cờ la_tam_ngung / la_hoat_dong_lai trong duLieu.js để gộp một mẫu; {thu_tuc} là chuỗi, không làm cờ được).
// Ngày: cột hồ sơ tam_ngung_tu / tam_ngung_den / hoat_dong_lai_tu → {tn_tu} {tn_den} {hdl_tu} (+ _ngay/_thang/_nam); trống = chỗ chấm.
const DN = ['1tv', '2tv', 'cp']
const moi = (s, ds = DN) => Object.fromEntries(ds.map(l => [l, s]))
const thuTN = { '1tv': ['tn_1tv', 'tn_1tv_tc'], '2tv': 'tn_2tv', cp: 'tn_cp' }
const thuHDL = { '1tv': ['hdl_1tv', 'hdl_1tv_tc'], '2tv': 'hdl_2tv', cp: 'hdl_cp' }
const KY_CSH = 'Chủ sở hữu ký tên (chủ sở hữu là tổ chức: người đại diện của tổ chức ký tên, đóng dấu)'

const mau = [
  // ─── Tạm ngừng — công ty ───
  { ma: 'TN_UQ', thuTuc: ['tam_ngung'], kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp Phòng ĐKKD — tạm ngừng kinh doanh)', dot: 'so', loaiHinh: DN, thuTu: 1,
    nguoiKy: moi('Người đại diện theo pháp luật ký tên, đóng dấu'), duLieuThu: thuTN },
  { ma: 'TN_MAU27', thuTuc: ['tam_ngung'], kyBoi: ['dd'], ten: 'Mẫu số 27 — Thông báo về việc tạm ngừng kinh doanh', dot: 'so', loaiHinh: DN, thuTu: 2,
    nguoiKy: moi('Người đại diện theo pháp luật ký tên (trang cuối)'), duLieuThu: thuTN },
  { ma: 'TN_QD_CSH', thuTuc: ['tam_ngung'], kyBoi: ['csh'], ten: 'Quyết định của Chủ sở hữu về việc tạm ngừng kinh doanh', dot: 'so', loaiHinh: ['1tv'], thuTu: 3,
    nguoiKy: { '1tv': KY_CSH }, duLieuThu: { '1tv': thuTN['1tv'] } },
  { ma: 'TN_QD_HDTV', thuTuc: ['tam_ngung'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên về việc tạm ngừng kinh doanh', dot: 'so', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' }, duLieuThu: { '2tv': thuTN['2tv'] } },
  { ma: 'TN_QD_HDQT', thuTuc: ['tam_ngung'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng quản trị về việc tạm ngừng kinh doanh', dot: 'so', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên' }, duLieuThu: { cp: thuTN.cp } },

  // ─── Hoạt động lại (tiếp tục kinh doanh trước thời hạn) — công ty ───
  { ma: 'TN_HDL_UQ', thuTuc: ['hoat_dong_lai'], kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp Phòng ĐKKD — tiếp tục kinh doanh trước thời hạn)', dot: 'so', loaiHinh: DN, thuTu: 1,
    nguoiKy: moi('Người đại diện theo pháp luật ký tên, đóng dấu'), duLieuThu: thuHDL },
  { ma: 'TN_HDL_MAU27', thuTuc: ['hoat_dong_lai'], kyBoi: ['dd'], ten: 'Mẫu số 27 — Thông báo về việc tiếp tục kinh doanh trước thời hạn đã thông báo', dot: 'so', loaiHinh: DN, thuTu: 2,
    nguoiKy: moi('Người đại diện theo pháp luật ký tên (trang cuối)'), duLieuThu: thuHDL },
  { ma: 'TN_HDL_QD_CSH', thuTuc: ['hoat_dong_lai'], kyBoi: ['csh'], ten: 'Quyết định của Chủ sở hữu về việc tiếp tục kinh doanh trước thời hạn', dot: 'so', loaiHinh: ['1tv'], thuTu: 3,
    nguoiKy: { '1tv': KY_CSH }, duLieuThu: { '1tv': thuHDL['1tv'] } },
  { ma: 'TN_HDL_QD_HDTV', thuTuc: ['hoat_dong_lai'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên về việc tiếp tục kinh doanh trước thời hạn', dot: 'so', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' }, duLieuThu: { '2tv': thuHDL['2tv'] } },
  { ma: 'TN_HDL_QD_HDQT', thuTuc: ['hoat_dong_lai'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng quản trị về việc tiếp tục kinh doanh trước thời hạn', dot: 'so', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên' }, duLieuThu: { cp: thuHDL.cp } },

  // ─── Hộ kinh doanh (chủ hộ = csh_) ───
  { ma: 'TN_UQ_HKD', thuTuc: ['tam_ngung_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (tạm ngừng kinh doanh hộ kinh doanh)', dot: 'so', loaiHinh: ['hkd'], thuTu: 1,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'tn_hkd' } },
  { ma: 'TN_MAU03_HKD', thuTuc: ['tam_ngung_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 3 — Giấy đề nghị đăng ký tạm ngừng kinh doanh của hộ kinh doanh', dot: 'so', loaiHinh: ['hkd'], thuTu: 2,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'tn_hkd' } },
  { ma: 'TN_HDL_UQ_HKD', thuTuc: ['hoat_dong_lai_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (tiếp tục kinh doanh trước thời hạn — hộ kinh doanh)', dot: 'so', loaiHinh: ['hkd'], thuTu: 1,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'hdl_hkd' } },
  { ma: 'TN_HDL_MAU03_HKD', thuTuc: ['hoat_dong_lai_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 3 — Giấy đề nghị đăng ký tiếp tục kinh doanh trước thời hạn của hộ kinh doanh', dot: 'so', loaiHinh: ['hkd'], thuTu: 2,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'hdl_hkd' } },
]

// Ô thông tin riêng (thẻ {tt_<k>}). Ngày tạm ngừng / hoạt động lại là cột hồ sơ — KHÔNG khai ở đây.
const coQuanDk = { k: 'co_quan_dk', nhan: 'Cơ quan đăng ký kinh doanh cấp xã (Kính gửi — để trống = theo hồ sơ)', kieu: 'chu', goiY: 'Ủy ban nhân dân phường …' }
const thongTin = {
  tam_ngung: [{ k: 'ly_do', nhan: 'Lý do tạm ngừng kinh doanh', kieu: 'dai', md: 'Tình hình hoạt động kinh doanh không hiệu quả' }],
  hoat_dong_lai: [{ k: 'ly_do', nhan: 'Lý do tiếp tục kinh doanh trước thời hạn (in ở quyết định; để trống = chỗ chấm)', kieu: 'dai' }],
  tam_ngung_hkd: [coQuanDk, { k: 'ly_do', nhan: 'Lý do tạm ngừng kinh doanh', kieu: 'dai', md: 'Hoạt động kinh doanh không hiệu quả' }],
  hoat_dong_lai_hkd: [coQuanDk, { k: 'ly_do', nhan: 'Lý do tiếp tục kinh doanh (để trống = chỗ chấm)', kieu: 'dai' }],
}

// Hướng dẫn in ký của phòng (TẠM NGỪNG HỘ KINH DOANH\3_Huongdan_inky): Mẫu 3 + Giấy ủy quyền mỗi file in 2 bản, ký bút mực xanh, gửi
// 2 bản đã ký về Savitax. Bộ công ty phòng chưa gửi hướng dẫn in ký → để lưu ý mặc định.
const LUU_Y_HKD = ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký tên bằng bút mực xanh.', 'Gửi lại Savitax đủ 2 bản đã ký của mỗi file.']
const luuY = { 'tam_ngung_hkd|so': LUU_Y_HKD, 'hoat_dong_lai_hkd|so': LUU_Y_HKD }

export default { mau, thongTin, luuY }
