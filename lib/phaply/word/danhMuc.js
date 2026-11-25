// Phân hệ Pháp lý — danh mục mẫu Word thủ tục THÀNH LẬP MỚI (1TV / 2TV / CP).
// Nguồn: bộ hồ sơ phòng pháp lý đã nộp thật 09–10/2026 + các file "Hướng dẫn in ký" kèm theo (anh gửi 06/11/2026).
// Hai đợt: 'so'   = hồ sơ thành lập nộp Phòng ĐKKD (trước khi có mã số doanh nghiệp)
//          'thue' = hồ sơ pháp lý ban đầu (HSPLBD), làm sau khi có GCN ĐKDN / mã số thuế.
// thuTu = thứ tự in + đặt tên file trong bộ; nguoiKy = dòng hướng dẫn in ký (theo loại hình nếu khác nhau).
// kyBoi = ai ký, để tờ hướng dẫn in ký ghi luôn HỌ TÊN (18/11/2026): dd đại diện PL · csh chủ sở hữu · ct chủ tịch HĐTV/HĐQT ·
//         tv các thành viên · cd các cổ đông · uq nhân viên phụ trách · nhan người nhận bàn giao.
//         uqtc người đại diện theo ủy quyền của chủ sở hữu là tổ chức · tctv người đại diện của thành viên / cổ đông là tổ chức ·
//         uqtv người đại diện theo ủy quyền của thành viên / cổ đông đó (csh là tổ chức → người đại diện của tổ chức ký)
// Sau này nạp vào bảng legal_doc_templates; đây là bản gốc để dựng file và kiểm.

import { MAU_THU_TUC, LUU_Y_THU_TUC_NHOM } from './mauThuTuc/index.js'
export const LOAI_HINH = { '1tv': 'TNHH một thành viên', '2tv': 'TNHH hai thành viên trở lên', cp: 'Cổ phần' }

export const LUU_Y_THU_TUC = {}   // '<biến thể>|<bộ>' → lưu ý in ký (thủ tục khác TLM gốc)

export const DANH_MUC = [
  // ─── Đợt 1: nộp Phòng ĐKKD ───
  { ma: 'UQ_SO', kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp Phòng ĐKKD)', dot: 'so', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 1,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên' } },
  { ma: 'DL_1TV', kyBoi: ['csh'], ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['1tv'], thuTu: 2, nguoiKy: { '1tv': 'Chủ sở hữu ký tên (trang cuối)' },
    // chủ sở hữu là TỔ CHỨC → Điều lệ nền khác (mẫu phòng gửi 25/11/2026), theo mô hình Chủ tịch công ty / Hội đồng thành viên
    thayBang: d => d.csh_to_chuc ? (d.mo_hinh_hdtv ? 'DL_1TV_TC_HDTV' : 'DL_1TV_TC_CT') : null,
    duLieuThu: { '1tv': ['1tv', '1tv_tc'] } },
  { ma: 'DL_2TV', kyBoi: ['tv'], ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['2tv'], thuTu: 2, nguoiKy: { '2tv': 'Các thành viên ký tên (trang cuối)' }, duLieuThu: { '2tv': ['2tv', '2tv_tc'] } },
  { ma: 'DL_CP', kyBoi: ['cd'], ten: 'Điều lệ công ty', dot: 'so', loaiHinh: ['cp'], thuTu: 2, nguoiKy: { cp: 'Các cổ đông sáng lập ký tên (trang cuối)' }, duLieuThu: { cp: ['cp', 'cp_nhieu_dd'] } },
  { ma: 'MAU2', kyBoi: ['dd'], ten: 'Mẫu số 2 — Giấy đề nghị đăng ký doanh nghiệp (TNHH 1TV)', dot: 'so', loaiHinh: ['1tv'], thuTu: 3, nguoiKy: { '1tv': 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU3', kyBoi: ['dd'], ten: 'Mẫu số 3 — Giấy đề nghị đăng ký doanh nghiệp (TNHH 2TV trở lên)', dot: 'so', loaiHinh: ['2tv'], thuTu: 3, nguoiKy: { '2tv': 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU4', kyBoi: ['dd'], ten: 'Mẫu số 4 — Giấy đề nghị đăng ký doanh nghiệp (Công ty cổ phần)', dot: 'so', loaiHinh: ['cp'], thuTu: 3, nguoiKy: { cp: 'Giám đốc ký tên (trang cuối)' } },
  { ma: 'MAU6', kyBoi: ['tv', 'dd'], ten: 'Mẫu số 6 — Danh sách thành viên công ty TNHH hai thành viên trở lên', dot: 'so', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Các thành viên ký tên (ở cột thứ 13) và Giám đốc ký tên (ở cuối trang)' }, duLieuThu: { '2tv': ['2tv', '2tv_tc'] } },
  { ma: 'MAU7', kyBoi: ['cd', 'dd'], ten: 'Mẫu số 7 — Danh sách cổ đông sáng lập', dot: 'so', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Các cổ đông ký tên (ở cột thứ 18) và Giám đốc ký tên (ở cuối trang)' }, duLieuThu: { cp: ['cp', 'cp_tc'] } },
  { ma: 'MAU10', kyBoi: ['dd'], ten: 'Mẫu số 10 — Danh sách chủ sở hữu hưởng lợi của doanh nghiệp', dot: 'so', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 5,
    nguoiKy: { '1tv': 'Giám đốc ký tên (trang cuối)', '2tv': 'Giám đốc ký tên (trang cuối)', cp: 'Giám đốc ký tên (trang cuối)' } },

  // ─── Đợt 2: hồ sơ pháp lý ban đầu (sau khi có mã số doanh nghiệp) ───
  { ma: 'GGT', kyBoi: ['dd'], ten: 'Giấy giới thiệu', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 1,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'UQ_THUE', kyBoi: ['dd'], ten: 'Giấy ủy quyền (làm việc với cơ quan thuế)', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 2,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'KHTS', kyBoi: ['dd'], ten: 'Đăng ký phương pháp khấu hao tài sản cố định', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 3,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  { ma: 'SSKT', kyBoi: ['dd'], ten: 'Đăng ký mở sổ sách kế toán trên máy vi tính', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 4,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu' } },
  // Pháp lý chốt 17/11/2026: 08-MST cần cho CẢ 3 loại hình (bộ 1TV đã nộp 10/2026 thiếu)
  { ma: 'MAU08', kyBoi: ['dd'], ten: 'Mẫu số 08-MST — Tờ khai điều chỉnh, bổ sung thông tin đăng ký thuế', dot: 'thue', loaiHinh: ['1tv', '2tv', 'cp'], thuTu: 5,
    nguoiKy: { '1tv': 'Giám đốc ký tên', '2tv': 'Giám đốc ký tên', cp: 'Giám đốc ký tên, đóng dấu, giáp lai' } },
  { ma: 'QD_GD_CSH', kyBoi: ['csh'], ten: 'Quyết định bổ nhiệm Giám đốc (Chủ sở hữu)', dot: 'thue', loaiHinh: ['1tv'], thuTu: 6, nguoiKy: { '1tv': 'Chủ sở hữu ký tên, đóng dấu' } },
  { ma: 'QD_GD_HDTV', kyBoi: ['ct'], ten: 'Quyết định bổ nhiệm Giám đốc (Hội đồng thành viên)', dot: 'thue', loaiHinh: ['2tv'], thuTu: 6, nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' } },
  { ma: 'QD_GD_HDQT', kyBoi: ['ct'], ten: 'Quyết định bổ nhiệm Giám đốc (Hội đồng quản trị)', dot: 'thue', loaiHinh: ['cp'], thuTu: 6, nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu' } },
  { ma: 'BBH_HDTV', kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng thành viên — bổ nhiệm Giám đốc', dot: 'thue', loaiHinh: ['2tv'], thuTu: 7, nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' } },
  { ma: 'BBH_HDQT', kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng quản trị — bổ nhiệm Giám đốc', dot: 'thue', loaiHinh: ['cp'], thuTu: 7, nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu, giáp lai' } },
]

// ─── Điều lệ bổ sung (mẫu phòng gửi 25/11/2026) ───
// an: true = mẫu THAY THẾ (không đứng riêng trong bộ — DL_1TV.thayBang chọn nó khi chủ sở hữu là tổ chức)
// dieuKien(duLieu): chỉ vào bộ khi đúng trường hợp (mauCuaBo vẫn liệt kê để nhân viên biết có tờ này; xuatBo lọc theo dữ liệu thật)
DANH_MUC.push(
  { ma: 'DL_1TV_TC_CT', an: true, kyBoi: ['csh'], ten: 'Điều lệ công ty (chủ sở hữu là tổ chức — Chủ tịch công ty)', dot: 'so', loaiHinh: ['1tv'], thuTu: 2,
    nguoiKy: { '1tv': 'Người đại diện theo pháp luật của chủ sở hữu ký tên, đóng dấu (trang cuối)' }, duLieuThu: { '1tv': '1tv_tc' } },
  { ma: 'DL_1TV_TC_HDTV', an: true, kyBoi: ['csh'], ten: 'Điều lệ công ty (chủ sở hữu là tổ chức — Hội đồng thành viên)', dot: 'so', loaiHinh: ['1tv'], thuTu: 2,
    nguoiKy: { '1tv': 'Người đại diện theo pháp luật của chủ sở hữu ký tên, đóng dấu (trang cuối)' }, duLieuThu: { '1tv': '1tv_tc_hdtv' } },
  { ma: 'QD_CU_DD', kyBoi: ['csh'], ten: 'Quyết định cử người đại diện theo ủy quyền (chủ sở hữu là tổ chức)', dot: 'so', loaiHinh: ['1tv'], thuTu: 2.5,
    nguoiKy: { '1tv': 'Người đại diện theo pháp luật của chủ sở hữu ký tên, đóng dấu' }, dieuKien: d => d.csh_to_chuc && !d.mo_hinh_hdtv, duLieuThu: { '1tv': '1tv_tc' } },
  { ma: 'VB_CU_DD', kyBoi: ['csh', 'uqtc'], ten: 'Văn bản cử người đại diện theo ủy quyền (chủ sở hữu là tổ chức — Hội đồng thành viên)', dot: 'so', loaiHinh: ['1tv'], thuTu: 2.5,
    nguoiKy: { '1tv': 'Đại diện bên ủy quyền ký tên, đóng dấu; các người được ủy quyền ký tên' }, dieuKien: d => d.csh_to_chuc && d.mo_hinh_hdtv, duLieuThu: { '1tv': '1tv_tc_hdtv' } },
  { ma: 'VB_CU_DD_TV', kyBoi: ['tctv', 'uqtv'], ten: 'Văn bản cử người đại diện phần vốn góp (thành viên / cổ đông là tổ chức)', dot: 'so', loaiHinh: ['2tv', 'cp'], thuTu: 2.5,
    nguoiKy: { '2tv': 'Đại diện thành viên là tổ chức ký tên, đóng dấu; người được ủy quyền ký tên', cp: 'Đại diện cổ đông là tổ chức ký tên, đóng dấu; người được ủy quyền ký tên' },
    dieuKien: d => !!d.co_tc_gop_von, duLieuThu: { '2tv': '2tv_tc', cp: 'cp_tc' } },
)

// ─── 1b Thành lập HỘ KINH DOANH (mẫu phòng gửi 25/11/2026: Giấy ủy quyền + Mẫu 01 Phụ lục II) ───
const DN3 = ['1tv', '2tv', 'cp']
DANH_MUC.push(
  { ma: 'UQ_HKD', thuTuc: ['tlm_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (nộp cơ quan đăng ký kinh doanh cấp xã)', dot: 'so', loaiHinh: ['hkd'], thuTu: 1, nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: ['hkd', 'hkd_cn'] } },
  { ma: 'MAU01_HKD', thuTuc: ['tlm_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 01 — Giấy đề nghị đăng ký hộ kinh doanh', dot: 'so', loaiHinh: ['hkd'], thuTu: 2, nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên (trang cuối)' }, duLieuThu: { hkd: ['hkd', 'hkd_cn'] } },
)
// ─── 1c Thành lập ĐƠN VỊ PHỤ THUỘC (chi nhánh / VPĐD / ĐĐKD): loại hình = loại hình CÔNG TY MẸ; donVi lọc giấy tờ riêng ───
const dvThu = { '1tv': ['cn_1tv', 'vpdd_1tv', 'ddkd_1tv'], '2tv': ['cn_2tv', 'vpdd_2tv'], cp: ['cn_cp', 'vpdd_cp'] }
DANH_MUC.push(
  { ma: 'UQ_DVPT', thuTuc: ['tlm_dvpt'], kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp Phòng ĐKKD)', dot: 'so', loaiHinh: DN3, thuTu: 1,
    nguoiKy: { '1tv': 'Người đại diện theo pháp luật ký tên', '2tv': 'Người đại diện theo pháp luật ký tên', cp: 'Người đại diện theo pháp luật ký tên' }, duLieuThu: dvThu },
  { ma: 'MAU17', thuTuc: ['tlm_dvpt'], kyBoi: ['dd'], ten: 'Mẫu số 17 — Giấy đề nghị đăng ký hoạt động chi nhánh / văn phòng đại diện (Thông báo lập địa điểm kinh doanh)', dot: 'so', loaiHinh: DN3, thuTu: 2,
    nguoiKy: { '1tv': 'Người đại diện theo pháp luật ký tên (trang cuối)', '2tv': 'Người đại diện theo pháp luật ký tên (trang cuối)', cp: 'Người đại diện theo pháp luật ký tên (trang cuối)' }, duLieuThu: dvThu },
  { ma: 'QD_CSH_DVPT', thuTuc: ['tlm_dvpt'], donVi: ['chi_nhanh', 'vpdd'], kyBoi: ['csh'], ten: 'Quyết định của chủ sở hữu thành lập đơn vị phụ thuộc', dot: 'so', loaiHinh: ['1tv'], thuTu: 3,
    nguoiKy: { '1tv': 'Chủ sở hữu ký tên, đóng dấu' }, duLieuThu: { '1tv': ['cn_1tv', 'vpdd_1tv'] } },
  { ma: 'BBH_HDTV_DVPT', thuTuc: ['tlm_dvpt'], donVi: ['chi_nhanh', 'vpdd'], kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng thành viên thành lập đơn vị phụ thuộc', dot: 'so', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên + thư ký ký tên' }, duLieuThu: { '2tv': ['cn_2tv', 'vpdd_2tv'] } },
  { ma: 'QD_HDTV_DVPT', thuTuc: ['tlm_dvpt'], donVi: ['chi_nhanh', 'vpdd'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên thành lập đơn vị phụ thuộc', dot: 'so', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên, đóng dấu' }, duLieuThu: { '2tv': ['cn_2tv', 'vpdd_2tv'] } },
  { ma: 'BBH_HDQT_DVPT', thuTuc: ['tlm_dvpt'], donVi: ['chi_nhanh', 'vpdd'], kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng quản trị thành lập đơn vị phụ thuộc', dot: 'so', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị + thư ký ký tên' }, duLieuThu: { cp: ['cn_cp', 'vpdd_cp'] } },
  { ma: 'QD_HDQT_DVPT', thuTuc: ['tlm_dvpt'], donVi: ['chi_nhanh', 'vpdd'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng quản trị thành lập đơn vị phụ thuộc', dot: 'so', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu' }, duLieuThu: { cp: ['cn_cp', 'vpdd_cp'] } },
)
LUU_Y_THU_TUC['tlm_hkd|so'] = ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.']
LUU_Y_THU_TUC['tlm_dvpt|so'] = ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh, đóng dấu công ty ở quyết định / biên bản.']

// ─── Tạm ngừng / hoạt động lại / giải thể / thay đổi — mỗi nhóm một file ở ./mauThuTuc/ ───
DANH_MUC.push(...MAU_THU_TUC)
Object.assign(LUU_Y_THU_TUC, LUU_Y_THU_TUC_NHOM)

// ─── Bàn giao (mọi thủ tục) — app soạn 17/11/2026, CHỜ phòng pháp lý duyệt câu chữ ───
DANH_MUC.push({ ma: 'BBBG', kyBoi: ['uq', 'nhan'], ten: 'Biên bản bàn giao hồ sơ, giấy tờ', dot: 'ban_giao', loaiHinh: ['1tv', '2tv', 'cp', 'hkd'], thuTu: 1,
  nguoiKy: { '1tv': 'Nhân viên phụ trách + người nhận ký', '2tv': 'Nhân viên phụ trách + người nhận ký', cp: 'Nhân viên phụ trách + người nhận ký', hkd: 'Nhân viên phụ trách + người nhận ký' } })

// Lưu ý in ký theo (đợt, loại hình) — chép từ file "Hướng dẫn in ký" của phòng
export const LUU_Y_IN_KY = {
  so: { '1tv': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'],
        '2tv': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'],
        cp: ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.'] },
  thue: { '1tv': ['In trên 1 mặt giấy.', 'Mỗi file 4 bản.', 'Ký bằng bút mực xanh.'],
          '2tv': ['Ký bằng bút mực xanh.'],
          cp: ['Ký mực xanh.', 'Kèm 2 bản GPKD photo đóng mộc treo.'] },
}

// Mỗi mẫu thuộc một hay nhiều biến thể thủ tục (lib/phaply/boHoSo.js — bienThe): thuTuc trống = ['tlm'] (bộ Thành lập mới gốc).
// donVi (chỉ mẫu đơn vị phụ thuộc): giới hạn theo loại đơn vị — VD quyết định thành lập chỉ cho chi nhánh / VPĐD, ĐĐKD không cần.
const thuTucCua = d => d.thuTuc || ['tlm']
export const mauCuaBo = (dot, loaiHinh, bt = 'tlm', donVi = null) => DANH_MUC
  .filter(d => !d.an && d.dot === dot && d.loaiHinh.includes(loaiHinh) && (dot === 'ban_giao' || thuTucCua(d).includes(bt)) && (!d.donVi || !donVi || d.donVi.includes(donVi)))
  .sort((a, b) => a.thuTu - b.thuTu)

// Lưu ý in ký: bộ Thành lập mới gốc theo LUU_Y_IN_KY[dot][loaiHinh]; thủ tục khác theo LUU_Y_THU_TUC['<biến thể>|<bộ>']
export const luuYInKy = (bt, dot, loaiHinh) => (bt === 'tlm' ? LUU_Y_IN_KY[dot]?.[loaiHinh] : LUU_Y_THU_TUC[bt + '|' + dot]) || ['In trên 1 mặt giấy.', 'Ký bằng bút mực xanh.']
