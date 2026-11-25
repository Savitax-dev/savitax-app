// Phân hệ Pháp lý — mẫu Word nhóm GIẢI THỂ CÔNG TY (1TV / 2TV / CP), biến thể 'giai_the', 3 bộ (bộ biểu mẫu phòng gửi 25/11/2026):
//   so1  = Sở bước 1 — quyết định giải thể (nộp Phòng ĐKKD)
//   thue = hồ sơ thuế — đóng mã số thuế (nộp Thuế cơ sở + Hải quan)
//   so2  = Sở bước 2 — thông báo giải thể Mẫu 30 (sau khi cơ quan thuế chấm dứt hiệu lực MST)
// Nguồn: PHONGPHAPLY_BIEUMAU\4_GIẢI THỂ_CÔNG TY + các file "Hướng dẫn in ký" kèm theo. Dữ liệu thuần, không import danhMuc / thongTin.
// Quyết định / biên bản họp giống nhau giữa so1 và thue (chỉ khác dòng ký: hồ sơ thuế đóng dấu) → tách mã, bản thuế đuôi _T.
// Giấy ủy quyền Sở bước 1 / bước 2 cùng chữ → GT_UQ_SO + GT_UQ_SO2; Báo cáo thanh lý tài sản gửi Thuế / Sở → GT_BC_TLTS + GT_BC_TLTS_SO.
const LH = ['1tv', '2tv', 'cp']
const ba = s => ({ '1tv': s, '2tv': s, cp: s })
const D3 = { '1tv': ['gt_1tv', 'gt_1tv_ps'], '2tv': ['gt_2tv'], cp: ['gt_cp', 'gt_cp_kps'] }
const KPS = { '1tv': 'gt_1tv_kps', '2tv': 'gt_2tv_kps', cp: 'gt_cp_kps' }
const DD = 'Người đại diện theo pháp luật ký tên, đóng dấu'
const dd = (ma, ten, dot, thuTu, them = {}) => ({ ma, thuTuc: ['giai_the'], kyBoi: ['dd'], ten, dot, loaiHinh: LH, thuTu, nguoiKy: ba(DD), duLieuThu: D3, ...them })

const mau = [
  // ─── Sở bước 1: quyết định giải thể ───
  dd('GT_UQ_SO', 'Giấy ủy quyền (nộp hồ sơ giải thể — Phòng ĐKKD)', 'so1', 1),
  { ma: 'GT_QD_CSH', thuTuc: ['giai_the'], kyBoi: ['csh'], ten: 'Quyết định giải thể doanh nghiệp (Chủ sở hữu)', dot: 'so1', loaiHinh: ['1tv'], thuTu: 2,
    nguoiKy: { '1tv': 'Chủ sở hữu ký tên' }, duLieuThu: { '1tv': ['gt_1tv', 'gt_1tv_tc'] } },
  { ma: 'GT_BBH_HDTV', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng thành viên — giải thể doanh nghiệp', dot: 'so1', loaiHinh: ['2tv'], thuTu: 2,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên (chủ tọa) ký tên; thư ký ký tên' }, duLieuThu: { '2tv': ['gt_2tv', 'gt_2tv_tc'] } },
  { ma: 'GT_QD_HDTV', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Quyết định giải thể doanh nghiệp (Hội đồng thành viên)', dot: 'so1', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' }, duLieuThu: { '2tv': ['gt_2tv', 'gt_2tv_tc'] } },
  { ma: 'GT_BBH_DHDCD', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Biên bản họp Đại hội đồng cổ đông — giải thể doanh nghiệp', dot: 'so1', loaiHinh: ['cp'], thuTu: 2,
    nguoiKy: { cp: 'Chủ tọa cuộc họp (Chủ tịch Hội đồng quản trị) ký tên; thư ký ký tên' }, duLieuThu: { cp: 'gt_cp' } },
  { ma: 'GT_QD_DHDCD', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Quyết định giải thể doanh nghiệp (Đại hội đồng cổ đông)', dot: 'so1', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên' }, duLieuThu: { cp: 'gt_cp' } },

  // ─── Hồ sơ thuế: đóng mã số thuế (thứ tự theo "Hướng dẫn in ký hồ sơ thuế" của phòng) ───
  dd('GT_GGT', 'Giấy giới thiệu (cơ quan thuế)', 'thue', 1),
  dd('GT_UQ_THUE', 'Giấy ủy quyền (làm việc với cơ quan thuế — giải thể)', 'thue', 2),
  { ma: 'GT_BBH_HDTV_T', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng thành viên — giải thể doanh nghiệp', dot: 'thue', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên, đóng dấu, giáp lai; thư ký ký tên' }, duLieuThu: { '2tv': 'gt_2tv' } },
  { ma: 'GT_BBH_DHDCD_T', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Biên bản họp Đại hội đồng cổ đông — giải thể doanh nghiệp', dot: 'thue', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tọa (Chủ tịch Hội đồng quản trị) ký tên, đóng dấu, giáp lai; thư ký ký tên' }, duLieuThu: { cp: 'gt_cp' } },
  { ma: 'GT_QD_CSH_T', thuTuc: ['giai_the'], kyBoi: ['csh'], ten: 'Quyết định giải thể doanh nghiệp (Chủ sở hữu)', dot: 'thue', loaiHinh: ['1tv'], thuTu: 4,
    nguoiKy: { '1tv': 'Chủ sở hữu ký tên, đóng dấu, giáp lai' }, duLieuThu: { '1tv': 'gt_1tv' } },
  { ma: 'GT_QD_HDTV_T', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Quyết định giải thể doanh nghiệp (Hội đồng thành viên)', dot: 'thue', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên, đóng dấu, giáp lai' }, duLieuThu: { '2tv': 'gt_2tv' } },
  { ma: 'GT_QD_DHDCD_T', thuTuc: ['giai_the'], kyBoi: ['ct'], ten: 'Quyết định giải thể doanh nghiệp (Đại hội đồng cổ đông)', dot: 'thue', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu, giáp lai' }, duLieuThu: { cp: 'gt_cp' } },
  dd('GT_MAU24', 'Mẫu số 24/ĐKT — Văn bản đề nghị chấm dứt hiệu lực mã số thuế', 'thue', 5),
  dd('GT_TNPL', 'Văn thư xác định trách nhiệm pháp lý sau giải thể', 'thue', 6),
  dd('GT_BC_TLTS', 'Báo cáo thanh lý tài sản doanh nghiệp (gửi cơ quan thuế)', 'thue', 7),
  dd('GT_MAU56', 'Mẫu 56 — Công văn đề nghị xác nhận hoàn thành nghĩa vụ nộp thuế (gửi Hải quan)', 'thue', 8),
  dd('GT_MAU56_TRONG', 'Mẫu 56 — Công văn đề nghị xác nhận hoàn thành nghĩa vụ nộp thuế (bản dự phòng, để trống nơi nhận)', 'thue', 9),
  dd('GT_KHOA_MST', 'Công văn đề nghị khóa mã số thuế', 'thue', 10),
  dd('GT_HT_NVT', 'Văn bản đề nghị xác nhận hoàn thành nghĩa vụ thuế', 'thue', 11),
  dd('GT_CK_NLD', 'Cam kết đã giải quyết chế độ cho người lao động', 'thue', 12),
  dd('GT_CV_GTGT', 'Công văn không hoàn thuế giá trị gia tăng', 'thue', 13),
  dd('GT_BC_TSCD', 'Báo cáo thanh lý tài sản cố định', 'thue', 14),
  dd('GT_CV_QTT', 'Công văn đề nghị quyết toán thuế', 'thue', 15),
  dd('GT_MAU01_DNKHT', 'Mẫu số 01/ĐNKHT — Văn bản từ chối nhận lại số tiền nộp thừa', 'thue', 16, { nguoiKy: ba(DD + ', giáp lai') }),
  // chỉ soạn khi KHÔNG phát sinh (nhân viên tick ở "Thông tin thủ tục")
  dd('GT_CK_KPS_DT', 'Cam kết không phát sinh doanh thu, hoạt động sản xuất kinh doanh', 'thue', 17, { dieuKien: d => !!d.tt_khong_doanh_thu, duLieuThu: KPS }),
  dd('GT_CK_KPS_HD', 'Cam kết chưa mua, chưa phát hành và sử dụng hóa đơn', 'thue', 18, { dieuKien: d => !!d.tt_khong_hoa_don, duLieuThu: KPS }),
  dd('GT_CK_XNK', 'Cam kết không hoạt động xuất nhập khẩu', 'thue', 19, { dieuKien: d => !!d.tt_khong_xnk, duLieuThu: KPS }),
  dd('GT_CK_XNK_DP', 'Cam kết không hoạt động xuất nhập khẩu (bản dự phòng, nội dung viết tay)', 'thue', 20, { dieuKien: d => !!d.tt_khong_xnk, duLieuThu: KPS }),

  // ─── Sở bước 2: thông báo giải thể ───
  dd('GT_UQ_SO2', 'Giấy ủy quyền (nộp hồ sơ giải thể — Phòng ĐKKD, bước 2)', 'so2', 1),
  dd('GT_MAU30', 'Mẫu số 30 — Thông báo về việc giải thể doanh nghiệp', 'so2', 2, { nguoiKy: ba('Người đại diện theo pháp luật ký tên') }),
  dd('GT_BC_TLTS_SO', 'Báo cáo thanh lý tài sản doanh nghiệp (gửi Phòng ĐKKD)', 'so2', 3),
  dd('GT_DSCN', 'Danh sách chủ nợ và số nợ đã thanh toán', 'so2', 4, { kyBoi: ['dd', 'uq'], nguoiKy: ba(DD + ', giáp lai; người lập biểu ký tên') }),
  dd('GT_DSNLD', 'Danh sách người lao động', 'so2', 5, { kyBoi: ['dd', 'uq'], nguoiKy: ba(DD + ', giáp lai; người lập biểu ký tên') }),
]

// Ô thông tin riêng của thủ tục (tab "Thông tin thủ tục") → thẻ {tt_<k>}. Mặc định (md) = câu chữ phòng pháp lý hay dùng.
const thongTin = {
  giai_the: [
    { k: 'ly_do', nhan: 'Lý do giải thể', kieu: 'chu', md: 'Tình hình kinh doanh không hiệu quả' },
    // TẠM: ngày cấp GCN ĐKDN lần đầu đã có ở legal_entities.ngay_cap_gcn nhưng duLieu.js chưa xuất thẻ (đề xuất thẻ ngay_cap_gcn)
    { k: 'ngay_thanh_lap', nhan: 'Ngày thành lập (ngày cấp GCN đăng ký doanh nghiệp lần đầu)', kieu: 'ngay' },
    { k: 'ngay_qd', nhan: 'Ngày ký quyết định giải thể', kieu: 'ngay' },
    { k: 'so_qd', nhan: 'Số quyết định giải thể', kieu: 'chu', goiY: '01/QĐ-CSH' },
    { k: 'hop_dong', nhan: 'Quyết định — thanh lý các hợp đồng đã ký kết (dòng đầu)', kieu: 'dai', md: 'Doanh nghiệp không phát sinh hợp đồng kinh tế.' },
    { k: 'no', nhan: 'Quyết định — thanh toán các khoản nợ (dòng đầu)', kieu: 'dai', md: 'Doanh nghiệp không còn các khoản nợ.' },
    { k: 'lao_dong', nhan: 'Quyết định — xử lý nghĩa vụ hợp đồng lao động', kieu: 'dai', md: 'Doanh nghiệp đã hoàn tất các thủ tục về hợp đồng lao động đã ký kết với nhân viên.' },
    { k: 'tai_san', nhan: 'Quyết định — thanh lý tài sản', kieu: 'dai', md: 'Doanh nghiệp không phát sinh.' },
    { k: 'linh_vuc', nhan: 'Ngành nghề / lĩnh vực hoạt động (ghi trong các cam kết gửi thuế)', kieu: 'chu', goiY: 'Bán buôn thực phẩm (không hoạt động tại trụ sở)' },
    { k: 'noi_luu_so', nhan: 'Nơi lưu trữ sổ sách kế toán sau giải thể (để trống = địa chỉ trụ sở)', kieu: 'chu' },
    { k: 'hai_quan', nhan: 'Chi cục Hải quan nhận Mẫu 56 (Kính gửi)', kieu: 'chu', goiY: 'Chi cục Hải quan khu vực II' },
    { k: 'co_nld', nhan: 'Có người lao động phải kê (Danh sách người lao động in bảng trống để viết tay)', kieu: 'co' },
    { k: 'co_chu_no', nhan: 'Có chủ nợ phải kê (Danh sách chủ nợ in bảng trống để viết tay)', kieu: 'co' },
    { k: 'co_ts_thanh_ly', nhan: 'Có tài sản thanh lý khi giải thể (Báo cáo thanh lý tài sản để trống phần kê)', kieu: 'co' },
    { k: 'co_tscd', nhan: 'Còn tài sản cố định (Báo cáo thanh lý TSCĐ để trống phần kê)', kieu: 'co' },
    { k: 'khong_doanh_thu', nhan: 'Từ khi thành lập KHÔNG phát sinh doanh thu → thêm Cam kết không phát sinh doanh thu', kieu: 'co' },
    { k: 'khong_hoa_don', nhan: 'Chưa mua / phát hành / sử dụng hóa đơn → thêm Cam kết chưa sử dụng hóa đơn', kieu: 'co' },
    { k: 'khong_xnk', nhan: 'Không hoạt động xuất nhập khẩu → thêm Cam kết không xuất nhập khẩu (kèm bản dự phòng)', kieu: 'co' },
    // chỉ để nhân viên ghi nhớ khi theo dõi hồ sơ (file "Các thông tin cần khai thác" + quy trình của phòng) — không in ra mẫu
    { k: 'ngay_kq_so1', nhan: 'Ngày có kết quả Sở bước 1', kieu: 'ngay' },
    { k: 'ngay_mst_03', nhan: 'Ngày MST đổi trạng thái 03 (ngừng hoạt động, chưa hoàn thành thủ tục chấm dứt hiệu lực MST)', kieu: 'ngay' },
    { k: 'can_bo_thue', nhan: 'Cán bộ thuế quản lý / thanh tra quyết toán (tên, số điện thoại, tổ)', kieu: 'dai' },
  ],
}

const luuY = {
  'giai_the|so1': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.',
    'Công ty TNHH một thành viên: kèm Giấy chứng nhận đăng ký doanh nghiệp LẦN GẦN NHẤT photo, đóng mộc treo — 4 bản.'],
  'giai_the|thue': ['In trên 1 mặt giấy.', 'Mỗi file 4 bản.', 'Ký bằng bút mực xanh.', 'Đóng dấu giáp lai nếu file có từ 2 trang trở lên.',
    'Giấy chứng nhận đăng ký doanh nghiệp LẦN GẦN NHẤT photo 4 bản; Giám đốc ký tên, ghi rõ họ tên, đóng dấu bên trái 1/3 chữ ký.'],
  'giai_the|so2': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Giáp lai khi có từ 2 trang trở lên.', 'Ký bằng bút mực xanh.'],
}

export default { mau, thongTin, luuY }
