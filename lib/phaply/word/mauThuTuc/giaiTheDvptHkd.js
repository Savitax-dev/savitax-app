// Phân hệ Pháp lý — mẫu Word nhóm CHẤM DỨT ĐƠN VỊ PHỤ THUỘC (chi nhánh / VPĐD / ĐĐKD, biến thể giai_the_dvpt) và CHẤM DỨT HỘ KINH
// DOANH (giai_the_hkd) — bộ biểu mẫu mới phòng gửi 25/11/2026 (PHONGPHAPLY_BIEUMAU\5_GIẢI THỂ_ĐƠN VỊ PHỤ THUỘC, 6_GIẢI THỂ_HỘ KINH DOANH).
// Dữ liệu thuần, không import danhMuc / thongTin (hai file đó import file này). Gộp ở lib/phaply/word/mauThuTuc/index.js.
//   mau:      mục DANH_MUC (cùng khuôn danhMuc.js: ma, thuTuc, donVi?, kyBoi, ten, dot, loaiHinh, thuTu, nguoiKy, dieuKien?, duLieuThu?)
//   thongTin: { '<biến thể>': [ô …] } — khuôn ô như lib/phaply/thongTin.js
//   luuY:     { '<biến thể>|<bộ>': ['…'] } — lưu ý in ký
//
// ĐƠN VỊ PHỤ THUỘC — hồ sơ gắn CÔNG TY MẸ (loaiHinh = loại hình công ty mẹ), thông tin đơn vị cần chấm dứt ở thong_tin, người đứng đầu = ndd_.
//   Bộ thuế (chỉ chi nhánh / VPĐD — ĐĐKD không có mã số thuế riêng, phòng chỉ gửi bộ Sở cho ĐĐKD):
//     Giấy giới thiệu · Giấy ủy quyền · Mẫu 24/ĐK-TCT · Quyết định (CSH / HĐTV / HĐQT) · Cam kết không XNK* · VB xác nhận hoàn thành
//     nghĩa vụ thuế · Công văn gửi Hải quan* (+ bản dự phòng*) · VB khóa mã số thuế · Cam kết không sử dụng hóa đơn* · Công văn cam kết
//     không phát sinh* (VPĐD luôn có)                                                            (* = chỉ khi tick ô tương ứng)
//   Bộ Sở (mọi loại đơn vị): Giấy ủy quyền · Mẫu 28 · Quyết định (CSH / HĐTV / HĐQT) · Biên bản họp HĐTV / HĐQT (2TV / CP).
//   Quyết định in ở CẢ hai bộ (phòng in 4 bản bộ thuế, 2 bản bộ Sở): mẫu gốc nằm ở bộ Sở (GTD_QD_*), bộ thuế là mục GTD_QD_*_T dùng lại
//   đúng file đó qua thayBang (không có văn bản nguồn riêng — bộ kiểm báo "·" cho mã _T là bình thường).
// HỘ KINH DOANH — chủ hộ = csh_, mã số hộ = {ma_dn}.
//   Bộ thuế: Giấy ủy quyền (+ bản dự phòng) · Mẫu 24/ĐK-TCT · Cam kết không phát sinh doanh thu* · Cam kết không sử dụng hóa đơn*
//   Bộ cấp xã: Giấy ủy quyền (chứng thực) · Mẫu 4 thông báo chấm dứt hoạt động hộ kinh doanh.
const DN = ['1tv', '2tv', 'cp']
const moi = (s, ds = DN) => Object.fromEntries(ds.map(l => [l, s]))
const CN_VP = ['chi_nhanh', 'vpdd']
const bt = ['giai_the_dvpt']

// bộ dữ liệu giả (scripts/phaply-du-lieu-gia/giaiTheDvptHkd.mjs)
const thuThue = { '1tv': 'gtd_cn_1tv', '2tv': 'gtd_vpdd_2tv', cp: 'gtd_cn_cp' }            // chi nhánh + VPĐD đều có mặt
const thuCn = { '1tv': 'gtd_cn_1tv', '2tv': 'gtd_cn_2tv', cp: 'gtd_cn_cp' }
const thuSo = { '1tv': ['gtd_cn_1tv', 'gtd_ddkd_1tv'], '2tv': 'gtd_vpdd_2tv', cp: 'gtd_cn_cp' }
const KY_DD = 'Người đại diện theo pháp luật ký tên, đóng dấu'
const KY_CSH = 'Chủ sở hữu ký tên (chủ sở hữu là tổ chức: người đại diện của tổ chức ký tên, đóng dấu)'

const mau = [
  // ─── Đơn vị phụ thuộc — bộ THUẾ (chi nhánh / VPĐD) ───
  { ma: 'GTD_GGT', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Giấy giới thiệu (cơ quan thuế — chấm dứt đơn vị phụ thuộc)', dot: 'thue', loaiHinh: DN, thuTu: 1,
    nguoiKy: moi(KY_DD), duLieuThu: thuThue },
  { ma: 'GTD_UQ_THUE', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Giấy ủy quyền (làm việc với cơ quan thuế)', dot: 'thue', loaiHinh: DN, thuTu: 2,
    nguoiKy: moi(KY_DD), duLieuThu: thuThue },
  { ma: 'GTD_MAU24', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Mẫu số 24/ĐK-TCT — Văn bản đề nghị chấm dứt hiệu lực mã số thuế', dot: 'thue', loaiHinh: DN, thuTu: 3,
    nguoiKy: moi(KY_DD), duLieuThu: thuThue },
  { ma: 'GTD_QD_CSH_T', thuTuc: bt, donVi: CN_VP, kyBoi: ['csh'], ten: 'Quyết định của Chủ sở hữu về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'thue', loaiHinh: ['1tv'], thuTu: 4,
    nguoiKy: { '1tv': 'Chủ sở hữu ký tên, đóng dấu' }, thayBang: () => 'GTD_QD_CSH', duLieuThu: { '1tv': 'gtd_cn_1tv' } },
  { ma: 'GTD_QD_HDTV_T', thuTuc: bt, donVi: CN_VP, kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'thue', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên, đóng dấu' }, thayBang: () => 'GTD_QD_HDTV', duLieuThu: { '2tv': 'gtd_vpdd_2tv' } },
  { ma: 'GTD_QD_HDQT_T', thuTuc: bt, donVi: CN_VP, kyBoi: ['ct'], ten: 'Quyết định của Hội đồng quản trị về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'thue', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên, đóng dấu' }, thayBang: () => 'GTD_QD_HDQT', duLieuThu: { cp: 'gtd_cn_cp' } },
  { ma: 'GTD_CK_XNK', thuTuc: bt, donVi: ['chi_nhanh'], kyBoi: ['dd'], ten: 'Cam kết không hoạt động xuất nhập khẩu', dot: 'thue', loaiHinh: DN, thuTu: 5,
    nguoiKy: moi(KY_DD), dieuKien: d => !!d.tt_khong_xnk, duLieuThu: thuCn },
  { ma: 'GTD_VB_NVT', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Văn bản đề nghị xác nhận hoàn thành nghĩa vụ thuế', dot: 'thue', loaiHinh: DN, thuTu: 6,
    nguoiKy: moi(KY_DD), duLieuThu: thuThue },
  { ma: 'GTD_CV_HQ', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Công văn đề nghị Hải quan xác nhận hoàn thành nghĩa vụ nộp thuế (Mẫu 56)', dot: 'thue', loaiHinh: DN, thuTu: 7,
    nguoiKy: moi(KY_DD), dieuKien: d => !!d.tt_xn_hai_quan, duLieuThu: thuThue },
  { ma: 'GTD_CV_HQ_DP', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Công văn đề nghị Hải quan xác nhận hoàn thành nghĩa vụ nộp thuế (bản dự phòng — để trống nơi nhận)', dot: 'thue', loaiHinh: DN, thuTu: 8,
    nguoiKy: moi(KY_DD), dieuKien: d => !!d.tt_xn_hai_quan && !!d.tt_hq_du_phong, duLieuThu: thuThue },
  { ma: 'GTD_VB_KHOA_MST', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Văn bản đề nghị xác nhận không phát sinh thuế và khóa mã số thuế', dot: 'thue', loaiHinh: DN, thuTu: 9,
    nguoiKy: moi(KY_DD), duLieuThu: thuThue },
  { ma: 'GTD_CK_HD', thuTuc: bt, donVi: ['chi_nhanh'], kyBoi: ['dd'], ten: 'Cam kết chưa mua, chưa phát hành và sử dụng hóa đơn', dot: 'thue', loaiHinh: DN, thuTu: 10,
    nguoiKy: moi(KY_DD), dieuKien: d => !!d.tt_khong_hoa_don, duLieuThu: thuCn },
  { ma: 'GTD_CK_KPS', thuTuc: bt, donVi: CN_VP, kyBoi: ['dd'], ten: 'Công văn cam kết không phát sinh hoạt động', dot: 'thue', loaiHinh: DN, thuTu: 11,
    nguoiKy: moi(KY_DD), dieuKien: d => !!d.la_vpdd || !!d.tt_cam_ket_khong_ps, duLieuThu: thuThue },

  // ─── Đơn vị phụ thuộc — bộ SỞ (chi nhánh / VPĐD / ĐĐKD) ───
  { ma: 'GTD_UQ_SO', thuTuc: bt, kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp Phòng ĐKKD — chấm dứt hoạt động đơn vị phụ thuộc)', dot: 'so', loaiHinh: DN, thuTu: 1,
    nguoiKy: moi(KY_DD), duLieuThu: thuSo },
  { ma: 'GTD_MAU28', thuTuc: bt, kyBoi: ['dd'], ten: 'Mẫu số 28 — Thông báo về việc chấm dứt hoạt động chi nhánh / văn phòng đại diện / địa điểm kinh doanh', dot: 'so', loaiHinh: DN, thuTu: 2,
    nguoiKy: moi('Người đại diện theo pháp luật ký tên (trang cuối)'), duLieuThu: thuSo },
  { ma: 'GTD_QD_CSH', thuTuc: bt, kyBoi: ['csh'], ten: 'Quyết định của Chủ sở hữu về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'so', loaiHinh: ['1tv'], thuTu: 3,
    nguoiKy: { '1tv': KY_CSH }, duLieuThu: { '1tv': ['gtd_cn_1tv', 'gtd_cn_1tv_tc', 'gtd_ddkd_1tv'] } },
  { ma: 'GTD_QD_HDTV', thuTuc: bt, kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'so', loaiHinh: ['2tv'], thuTu: 3,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' }, duLieuThu: { '2tv': ['gtd_vpdd_2tv', 'gtd_cn_2tv'] } },
  { ma: 'GTD_QD_HDQT', thuTuc: bt, kyBoi: ['ct'], ten: 'Quyết định của Hội đồng quản trị về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'so', loaiHinh: ['cp'], thuTu: 3,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên' }, duLieuThu: { cp: 'gtd_cn_cp' } },
  { ma: 'GTD_BBH_HDTV', thuTuc: bt, kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng thành viên về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'so', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên (chủ tọa) + thư ký ký tên' }, duLieuThu: { '2tv': 'gtd_vpdd_2tv' } },
  { ma: 'GTD_BBH_HDQT', thuTuc: bt, kyBoi: ['ct'], ten: 'Biên bản họp Hội đồng quản trị về việc chấm dứt hoạt động đơn vị phụ thuộc', dot: 'so', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị (chủ tọa) + thư ký ký tên' }, duLieuThu: { cp: 'gtd_cn_cp' } },

  // ─── Hộ kinh doanh (chủ hộ = csh_) ───
  { ma: 'GTH_UQ_THUE', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (làm việc với cơ quan thuế — chấm dứt hộ kinh doanh)', dot: 'thue', loaiHinh: ['hkd'], thuTu: 1,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_UQ_THUE_DP', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (bản dự phòng — để trống cơ quan thuế)', dot: 'thue', loaiHinh: ['hkd'], thuTu: 1.5,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_MAU24', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 24/ĐK-TCT — Văn bản đề nghị chấm dứt hiệu lực mã số thuế (hộ kinh doanh)', dot: 'thue', loaiHinh: ['hkd'], thuTu: 2,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên (không đóng dấu)' }, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_CK_KPS_DT', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Cam kết không phát sinh doanh thu', dot: 'thue', loaiHinh: ['hkd'], thuTu: 3,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, dieuKien: d => !!d.tt_khong_phat_sinh_dt, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_CK_HD', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Cam kết chưa mua, chưa phát hành và sử dụng hóa đơn', dot: 'thue', loaiHinh: ['hkd'], thuTu: 4,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, dieuKien: d => !!d.tt_khong_hoa_don, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_UQ_SO', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (chứng thực chữ ký — chấm dứt hộ kinh doanh)', dot: 'so', loaiHinh: ['hkd'], thuTu: 1,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên trước công chứng viên / người chứng thực' }, duLieuThu: { hkd: 'gth_hkd' } },
  { ma: 'GTH_MAU04', thuTuc: ['giai_the_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 4 — Thông báo về việc chấm dứt hoạt động hộ kinh doanh', dot: 'so', loaiHinh: ['hkd'], thuTu: 2,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'gth_hkd' } },
]

// Ô thông tin riêng (thẻ {tt_<k>}). KHÔNG đặt chi: [...] cho ô mà mẫu dùng chung nhiều loại đơn vị đọc tới (theThongTin bỏ thẻ của ô bị
// lọc → bộ kiểm báo thiếu thẻ); chỉ ô dùng riêng ở mẫu chi nhánh / VPĐD hoặc chỉ ở điều kiện mới lọc theo loại đơn vị.
const cqt = { k: 'cqt_quan_ly', nhan: 'Cơ quan thuế quản lý (Kính gửi các văn bản thuế — để trống = cơ quan thuế của hồ sơ)', kieu: 'chu', goiY: 'Thuế cơ sở … Thành phố Hồ Chí Minh' }
const thongTin = {
  giai_the_dvpt: [
    { k: 'ten', nhan: 'Tên đơn vị chấm dứt hoạt động (chữ in hoa, đúng như Giấy chứng nhận)', kieu: 'chu', bat_buoc: true },
    { k: 'ma_so', nhan: 'Mã số đơn vị / mã số thuế (VD 0312345678-001; ĐĐKD: mã 5 số)', kieu: 'chu', bat_buoc: true },
    { k: 'ngay_cap', nhan: 'Ngày cấp Giấy chứng nhận đăng ký hoạt động của đơn vị', kieu: 'ngay' },
    { k: 'noi_cap', nhan: 'Nơi cấp (để trống = Phòng ĐKKD của hồ sơ)', kieu: 'chu', goiY: 'Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh' },
    { k: 'dia_chi', nhan: 'Địa chỉ đơn vị', kieu: 'dia_chi', bat_buoc: true },
    { k: 'dien_thoai', nhan: 'Điện thoại đơn vị (Mẫu 28, nếu có)', kieu: 'chu' },
    { k: 'email', nhan: 'Email đơn vị (Mẫu 28, nếu có)', kieu: 'chu' },
    { k: 'ly_do', nhan: 'Lý do chấm dứt hoạt động', kieu: 'dai', bat_buoc: true, goiY: 'Tình hình hoạt động kinh doanh không hiệu quả' },
    // Mẫu 28 mục 3 — chỉ khi chấm dứt ĐĐKD trực thuộc chi nhánh (để trống = chỗ chấm như bản phòng)
    { k: 'cn_chu_quan_ten', nhan: 'Chi nhánh chủ quản — tên (chỉ ĐĐKD trực thuộc chi nhánh)', kieu: 'chu' },
    { k: 'cn_chu_quan_dia_chi', nhan: 'Chi nhánh chủ quản — địa chỉ', kieu: 'chu' },
    { k: 'cn_chu_quan_ma', nhan: 'Chi nhánh chủ quản — mã số chi nhánh / mã số thuế', kieu: 'chu' },
    // văn bản thuế kê lại thông tin CÔNG TY MẸ: mã số thuế + ngày cấp + nơi cấp GCN ĐKDN
    { k: 'dn_ngay_cap', nhan: 'Ngày cấp GCN đăng ký doanh nghiệp của công ty (in ở văn bản thuế)', kieu: 'ngay' },
    { k: 'dn_noi_cap', nhan: 'Nơi cấp GCN đăng ký doanh nghiệp của công ty (để trống = Phòng ĐKKD của hồ sơ)', kieu: 'chu' },
    cqt,
    // tờ "chỉ khi…" của bộ thuế
    { k: 'xn_hai_quan', nhan: 'Có công văn đề nghị Hải quan xác nhận hoàn thành nghĩa vụ nộp thuế', kieu: 'co', md: true, chi: CN_VP },
    { k: 'hai_quan', nhan: 'Hải quan nhận công văn (Kính gửi — VD Chi cục Hải quan khu vực II)', kieu: 'chu', chi: CN_VP },
    { k: 'hq_du_phong', nhan: 'Kèm công văn Hải quan bản dự phòng (để trống nơi nhận)', kieu: 'co', chi: CN_VP },
    { k: 'khong_xnk', nhan: 'Chi nhánh không hoạt động xuất nhập khẩu (kèm cam kết)', kieu: 'co', chi: ['chi_nhanh'] },
    { k: 'khong_hoa_don', nhan: 'Chi nhánh chưa mua, chưa phát hành, chưa sử dụng hóa đơn (kèm cam kết)', kieu: 'co', chi: ['chi_nhanh'] },
    { k: 'hach_toan', nhan: 'Hình thức hạch toán của chi nhánh', kieu: 'chon', chon: [['doc_lap', 'Hạch toán độc lập'], ['phu_thuoc', 'Hạch toán phụ thuộc']], md: 'phu_thuoc', chi: ['chi_nhanh'] },
    { k: 'cam_ket_khong_ps', nhan: 'Kèm công văn cam kết không phát sinh (chi nhánh — khi cơ quan thuế yêu cầu bổ sung; VPĐD luôn có)', kieu: 'co', chi: ['chi_nhanh'] },
  ],
  giai_the_hkd: [
    { k: 'ngay_cap_gcn', nhan: 'Ngày cấp (đăng ký lần đầu) Giấy chứng nhận đăng ký hộ kinh doanh', kieu: 'ngay' },
    { k: 'noi_cap_gcn', nhan: 'Nơi cấp Giấy chứng nhận đăng ký hộ kinh doanh (để trống = cơ quan đăng ký kinh doanh của hồ sơ)', kieu: 'chu', goiY: 'Ủy ban nhân dân phường …' },
    cqt,
    { k: 'ly_do', nhan: 'Lý do chấm dứt hiệu lực mã số thuế (Mẫu 24)', kieu: 'dai', md: 'Chấm dứt mã số thuế để hoàn thiện thủ tục giải thể cho hộ kinh doanh.' },
    { k: 'khong_phat_sinh_dt', nhan: 'Hộ chưa hoạt động, chưa phát sinh doanh thu (kèm cam kết)', kieu: 'co' },
    { k: 'khong_hoa_don', nhan: 'Hộ chưa mua, chưa phát hành, chưa sử dụng hóa đơn (kèm cam kết)', kieu: 'co' },
  ],
}

// Lưu ý in ký — theo file "Hướng dẫn in ký" của phòng (bộ chi nhánh + VPĐD); hộ kinh doanh phòng chưa gửi hướng dẫn → soạn theo bộ mẫu
const luuY = {
  'giai_the_dvpt|thue': [
    'In trên 1 mặt giấy.',
    'Mỗi file 2 bản (riêng Quyết định chấm dứt: 4 bản). Văn phòng đại diện: mỗi file 4 bản.',
    'Ký bằng bút mực xanh, đóng dấu công ty ở mọi văn bản.',
    'Photo Giấy chứng nhận đăng ký hoạt động của đơn vị cần chấm dứt LẦN GẦN NHẤT 2 bản và Giấy chứng nhận đăng ký doanh nghiệp của công ty LẦN GẦN NHẤT 2 bản: người đại diện theo pháp luật ký tên, ghi rõ họ tên, đóng dấu (bên trái 1/3 chữ ký).',
  ],
  'giai_the_dvpt|so': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.', 'Chỉ đóng dấu Giấy ủy quyền.'],
  'giai_the_hkd|thue': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Chủ hộ ký bằng bút mực xanh, ghi rõ họ tên (hộ kinh doanh không đóng dấu).'],
  'giai_the_hkd|so': ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh.', 'Giấy ủy quyền: chủ hộ ký tại nơi công chứng / chứng thực chữ ký.',
    'Nộp kèm bản gốc Giấy chứng nhận đăng ký hộ kinh doanh.'],
}

export default { mau, thongTin, luuY }
