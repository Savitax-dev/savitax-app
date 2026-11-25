// Phân hệ Pháp lý — mẫu Word nhóm THAY ĐỔI ĐĂNG KÝ (công ty · hộ kinh doanh · đơn vị phụ thuộc), bộ biểu mẫu phòng gửi 25/11/2026.
// Dữ liệu thuần, không import danhMuc / thongTin (hai file đó import file này). Gộp ở lib/phaply/word/mauThuTuc/index.js.
//
// XƯƠNG SỐNG = bảng "CÁC CHỈ TIÊU THAY ĐỔI VÀ THÀNH PHẦN HỒ SƠ" của phòng (5_THAY ĐỔI_…\THAY ĐỔI_CÔNG TY\): mỗi chỉ tiêu thay đổi
// kéo theo một nhóm giấy tờ; nhiều chỉ tiêu thì GỘP thành một bộ. Chỉ tiêu lấy từ danh sách chọn lúc tạo hồ sơ
// (legal_cases.noi_dung_thay_doi → cờ {td_ten} {td_dia_chi} {td_dai_dien} {td_tang_von} {td_giam_von} {td_thanh_vien}
// {td_chu_so_huu} {td_nganh} {td_cap_nhat} {td_khac} — lib/phaply/nhom.js NOI_DUNG_THAY_DOI); chỉ tiêu bảng phòng có mà danh sách
// chưa có (chủ sở hữu hưởng lợi, chi tiết "thành viên" theo cách thay đổi) khai thêm ô ở thongTin dưới đây.
//   Chỉ tiêu (bảng phòng)                    → thành phần hồ sơ
//   Tên · trụ sở · ngành · vốn               → Giấy ủy quyền + Mẫu 12 + Quyết định CSH/HĐTV/ĐHĐCĐ
//   Người đại diện theo pháp luật            → Giấy ủy quyền + Mẫu 13 + Quyết định
//   Chủ sở hữu (1TV)                         → Giấy ủy quyền + Mẫu 15 + Hợp đồng chuyển nhượng
//   Phần vốn góp / tỷ lệ (2TV, không đổi TV) → Giấy ủy quyền + Mẫu 12 + Mẫu 6 + Hợp đồng chuyển nhượng + Mẫu 10
//   Thành viên (2TV)                         → Giấy ủy quyền + Mẫu 12 + Mẫu 6 + Mẫu 10 (+ HĐ chuyển nhượng nếu do chuyển nhượng;
//                                              + Quyết định HĐTV nếu tiếp nhận thành viên mới do tăng vốn)
//   Chủ sở hữu hưởng lợi                     → Giấy ủy quyền + Mẫu 12 + Mẫu 10
// Thay đổi trụ sở làm đổi CƠ QUAN THUẾ quản lý còn có hồ sơ thuế cũ / mới (08-MST, 30-TT90, công văn…) — chưa có bộ thuế cho
// biến thể thay_doi (boHoSo.js) nên chưa soạn.
//
// Giá trị CŨ = dữ liệu doanh nghiệp đang có (ten_cty, trụ sở, von_dieu_le, dd_, csh_…); giá trị MỚI = ô thông tin thủ tục {tt_…}.
// Mẫu 6 / 7 / 10 in danh sách thành viên / cổ đông / người hưởng lợi ĐANG LƯU ở tab Người → nhân viên cập nhật danh sách SAU thay
// đổi trước khi xuất các tờ đó (lưu ý in ký nhắc). Chưa có kiểu ô "người" / "bảng" → người mới khai bằng nhóm ô chữ (dm_, nb_, cn_, ch_).

const NOI_CAP = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội'
const DN3 = ['1tv', '2tv', 'cp']
const GT = [['nam', 'Nam'], ['nu', 'Nữ']]

// nhóm ô một NGƯỜI (khai tay — chưa có kiểu ô chọn người trong danh bạ): thẻ {tt_<t>_ho_ten} …, danh xưng qua cờ {#tt_<t>_gioi_tinh_nam}
// khi: cờ td_… / ô co mà ô này phục vụ — giao diện CHƯA dùng (đề xuất: chỉ hiện ô khi chỉ tiêu được chọn)
const nguoiO = (t, ai, khi, them = []) => [
  { k: t + '_ho_ten', nhan: `${ai} — họ, chữ đệm và tên (CHỮ IN HOA)`, kieu: 'chu', khi },
  { k: t + '_gioi_tinh', nhan: `${ai} — giới tính`, kieu: 'chon', chon: GT, khi },
  { k: t + '_ngay_sinh', nhan: `${ai} — ngày sinh`, kieu: 'ngay', khi },
  { k: t + '_so_giay_to', nhan: `${ai} — số định danh cá nhân`, kieu: 'chu', khi },
  { k: t + '_ngay_cap', nhan: `${ai} — ngày cấp`, kieu: 'ngay', khi },
  { k: t + '_noi_cap', nhan: `${ai} — nơi cấp`, kieu: 'chu', md: NOI_CAP, khi },
  ...them,
  { k: t + '_dia_chi', nhan: `${ai} — địa chỉ thường trú / liên lạc`, kieu: 'dia_chi', khi },
  { k: t + '_dien_thoai', nhan: `${ai} — điện thoại (nếu có)`, kieu: 'chu', khi },
  { k: t + '_email', nhan: `${ai} — thư điện tử (nếu có)`, kieu: 'chu', khi },
]

const TEN_MOI = [
  { k: 'ten_moi', nhan: 'Tên mới (tiếng Việt, CHỮ IN HOA)', kieu: 'chu', khi: 'td_ten' },
  { k: 'ten_moi_nn', nhan: 'Tên mới bằng tiếng nước ngoài (nếu có)', kieu: 'chu', khi: 'td_ten' },
  { k: 'ten_moi_viet_tat', nhan: 'Tên viết tắt mới (nếu có)', kieu: 'chu', khi: 'td_ten' },
]
const NGANH = [
  { k: 'nganh_them', nhan: 'Ngành, nghề BỔ SUNG', kieu: 'nganh', khi: 'td_nganh' },
  { k: 'nganh_bo', nhan: 'Ngành, nghề BỎ khỏi danh sách đã đăng ký', kieu: 'nganh', khi: 'td_nganh' },
  { k: 'nganh_sua', nhan: 'Ngành, nghề SỬA ĐỔI chi tiết / chọn làm ngành chính', kieu: 'nganh', khi: 'td_nganh' },
]

const thongTin = {
  thay_doi: [
    // chỉ tiêu bảng phòng có mà NOI_DUNG_THAY_DOI chưa có
    { k: 'doi_cshhl', nhan: 'Thay đổi / kê khai bổ sung thông tin chủ sở hữu hưởng lợi (Mẫu 10)', kieu: 'co' },
    { k: 'tv_kieu', nhan: 'Thay đổi thành viên / cổ đông do', kieu: 'chon', khi: 'td_thanh_vien', md: 'cn_moi',
      chon: [['cn_moi', 'Chuyển nhượng vốn / cổ phần cho người mới'], ['cn_noi_bo', 'Chuyển nhượng giữa các thành viên / cổ đông hiện có (chỉ đổi tỷ lệ vốn)'],
        ['tang_von', 'Tiếp nhận thành viên / cổ đông mới do tăng vốn'], ['khac', 'Khác (thừa kế, tặng cho, rút vốn…)']] },
    // người ký Giấy ủy quyền + Giấy đề nghị (bảng phòng: đổi người đại diện → Chủ tịch ký; đổi chủ sở hữu → chủ sở hữu mới ký)
    { k: 'nguoi_ky', nhan: 'Người ký giấy ủy quyền / giấy đề nghị', kieu: 'chon', md: 'dd',
      chon: [['dd', 'Người đại diện theo pháp luật (hiện tại)'], ['ct', 'Chủ tịch công ty / Chủ tịch HĐTV / Chủ tịch HĐQT'],
        ['dm', 'Người đại diện theo pháp luật MỚI (khai ở nhóm “Người đại diện mới”)'], ['nb', 'Chủ sở hữu MỚI (khai ở nhóm “Bên nhận chuyển nhượng”)']] },
    { k: 'kinh_gui', nhan: 'Kính gửi (để trống = Phòng ĐKKD của doanh nghiệp; đổi trụ sở khác tỉnh ghi Phòng ĐKKD nơi đặt trụ sở mới)', kieu: 'chu' },
    // tên
    ...TEN_MOI,
    // trụ sở
    { k: 'tru_so_moi', nhan: 'Địa chỉ trụ sở chính MỚI', kieu: 'dia_chi', khi: 'td_dia_chi' },
    { k: 'ts_dien_thoai', nhan: 'Điện thoại trụ sở mới (để trống = giữ số cũ)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'ts_email', nhan: 'Thư điện tử (để trống = giữ như cũ)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'dc_thue_cung', nhan: 'Đồng thời thay đổi địa chỉ nhận thông báo thuế theo trụ sở mới', kieu: 'co', md: true, khi: 'td_dia_chi' },
    // người đại diện theo pháp luật mới (Mẫu 13)
    ...nguoiO('dm', 'Người đại diện mới', 'td_dai_dien', [{ k: 'dm_chuc_danh', nhan: 'Người đại diện mới — chức danh', kieu: 'chu', md: 'Giám đốc', khi: 'td_dai_dien' }]),
    // vốn
    { k: 'von_cu', nhan: 'Vốn điều lệ đã đăng ký (để trống = vốn đang lưu ở hồ sơ doanh nghiệp)', kieu: 'so', khi: 'td_tang_von' },
    { k: 'von_moi', nhan: 'Vốn điều lệ SAU khi thay đổi (đồng)', kieu: 'so', khi: 'td_tang_von' },
    { k: 'so_cp_moi', nhan: 'Tổng số cổ phần sau khi thay đổi (chỉ công ty cổ phần)', kieu: 'so', khi: 'td_tang_von' },
    { k: 'thoi_diem_von', nhan: 'Thời điểm thay đổi vốn', kieu: 'chu', khi: 'td_tang_von', goiY: 'Kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
    { k: 'hinh_thuc_von', nhan: 'Hình thức tăng, giảm vốn', kieu: 'chu', khi: 'td_tang_von', goiY: 'Chủ sở hữu góp thêm vốn bằng tiền Việt Nam đồng' },
    // ngành
    ...NGANH,
    // chuyển nhượng (Hợp đồng chuyển nhượng; 1TV: bên chuyển nhượng = chủ sở hữu hiện tại)
    ...nguoiO('cn', 'Bên chuyển nhượng (2TV / CP)', 'td_thanh_vien'),
    { k: 'cn_von_truoc', nhan: 'Phần vốn góp bên chuyển nhượng đang sở hữu (đồng; CP: giá trị cổ phần)', kieu: 'so', khi: 'td_thanh_vien' },
    { k: 'cn_cp_truoc', nhan: 'Số cổ phần bên chuyển nhượng đang sở hữu (CP)', kieu: 'so', khi: 'td_thanh_vien' },
    { k: 'cn_ty_le_truoc', nhan: 'Tỷ lệ vốn bên chuyển nhượng đang sở hữu (VD 90%)', kieu: 'chu', khi: 'td_thanh_vien' },
    ...nguoiO('nb', 'Bên nhận chuyển nhượng / chủ sở hữu mới', 'td_chu_so_huu'),
    { k: 'cn_von', nhan: 'Phần vốn góp chuyển nhượng (đồng; CP: giá trị theo mệnh giá)', kieu: 'so', khi: 'td_thanh_vien' },
    { k: 'cn_so_cp', nhan: 'Số cổ phần chuyển nhượng (CP)', kieu: 'so', khi: 'td_thanh_vien' },
    { k: 'cn_ty_le', nhan: 'Tỷ lệ chuyển nhượng trên vốn điều lệ (VD 60%)', kieu: 'chu', khi: 'td_thanh_vien' },
    { k: 'cn_gia', nhan: 'Giá chuyển nhượng (đồng)', kieu: 'so', khi: 'td_thanh_vien' },
    { k: 'cn_hinh_thuc', nhan: 'Hình thức thanh toán', kieu: 'chu', md: 'tiền mặt hoặc chuyển khoản', khi: 'td_thanh_vien' },
    { k: 'ngay_gcn', nhan: 'Ngày cấp Giấy chứng nhận đăng ký doanh nghiệp (ghi trong hợp đồng)', kieu: 'chu', khi: 'td_thanh_vien' },
    // Mẫu 12 mục B + ô cuối
    { k: 'cap_nhat', nhan: 'Mục B — bổ sung, cập nhật thông tin đăng ký doanh nghiệp (mỗi dòng một nội dung)', kieu: 'dai', khi: 'td_cap_nhat' },
    { k: 'xac_nhan', nhan: 'Đề nghị cấp Giấy xác nhận thay đổi nội dung đăng ký doanh nghiệp', kieu: 'co' },
  ],
  thay_doi_hkd: [
    { k: 'co_quan_dk', nhan: 'Kính gửi — cơ quan đăng ký kinh doanh cấp xã (đổi trụ sở: nơi đặt trụ sở MỚI)', kieu: 'chu', goiY: 'Ủy ban nhân dân Phường …' },
    ...TEN_MOI,
    { k: 'tru_so_moi', nhan: 'Trụ sở hộ kinh doanh MỚI', kieu: 'dia_chi', khi: 'td_dia_chi' },
    { k: 'ts_dien_thoai', nhan: 'Điện thoại trụ sở mới (để trống = giữ số cũ)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'ts_email', nhan: 'Thư điện tử (để trống = giữ như cũ)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'khong_tai_tru_so', nhan: 'Không kinh doanh tại trụ sở (không có địa điểm kinh doanh cố định)', kieu: 'co', khi: 'td_dia_chi' },
    { k: 'chu_ho_do', nhan: 'Thay đổi chủ hộ do', kieu: 'chon', khi: 'td_chu_so_huu', md: 'uy_quyen',
      chon: [['uy_quyen', 'Thành viên hộ gia đình ủy quyền cho thành viên khác làm chủ hộ'], ['chet', 'Chủ hộ chết / mất tích / mất năng lực hành vi dân sự…']] },
    ...nguoiO('ch', 'Chủ hộ MỚI', 'td_chu_so_huu'),
    { k: 'von_moi', nhan: 'Vốn kinh doanh SAU khi thay đổi (đồng)', kieu: 'so', khi: 'td_tang_von' },
    { k: 'thoi_diem_von', nhan: 'Thời điểm thay đổi vốn', kieu: 'chu', khi: 'td_tang_von' },
    { k: 'hinh_thuc_von', nhan: 'Hình thức tăng, giảm vốn', kieu: 'chu', khi: 'td_tang_von', goiY: 'Chủ hộ kinh doanh góp thêm vốn bằng tiền Việt Nam đồng' },
    ...NGANH,
    { k: 'doi_thue', nhan: 'Thay đổi nội dung đăng ký thuế', kieu: 'co' },
    { k: 'thue_chi_tieu', nhan: 'Đăng ký thuế — chỉ tiêu thay đổi', kieu: 'chu', khi: 'doi_thue', goiY: 'Chỉ tiêu 5.1: Địa chỉ nhận thông báo thuế' },
    { k: 'thue_cu', nhan: 'Đăng ký thuế — thông tin cũ', kieu: 'chu', khi: 'doi_thue' },
    { k: 'thue_moi', nhan: 'Đăng ký thuế — thông tin mới', kieu: 'chu', khi: 'doi_thue' },
    { k: 'cap_nhat', nhan: 'Mục B — cập nhật, bổ sung, hiệu đính thông tin (mỗi dòng một nội dung)', kieu: 'dai', khi: 'td_cap_nhat' },
    // Mục C: hộ được cấp giấy chứng nhận TRƯỚC 01/07/2025 (NĐ 168/2025) — cả 2 bản phòng làm đều kê khai
    { k: 'cap_doi', nhan: 'Kê khai Mục C — cấp đổi sang Giấy chứng nhận đăng ký hộ kinh doanh (hộ đăng ký trước 01/07/2025)', kieu: 'co', md: true },
  ],
  thay_doi_dvpt: [
    { k: 'dv_ten', nhan: 'Tên đơn vị hiện tại (CHỮ IN HOA)', kieu: 'chu', bat_buoc: true },
    { k: 'dv_ma_so', nhan: 'Mã số đơn vị / mã số thuế của chi nhánh, VPĐD', kieu: 'chu' },
    { k: 'kinh_gui', nhan: 'Kính gửi (để trống = Phòng ĐKKD của doanh nghiệp; ghi Phòng ĐKKD nơi đặt đơn vị nếu khác tỉnh)', kieu: 'chu' },
    { k: 'cn_chu_quan', nhan: 'Chi nhánh chủ quản (chỉ địa điểm kinh doanh trực thuộc chi nhánh: tên — địa chỉ — mã số)', kieu: 'dai' },
    ...TEN_MOI,
    { k: 'dia_chi_moi', nhan: 'Địa chỉ đơn vị MỚI', kieu: 'dia_chi', khi: 'td_dia_chi' },
    { k: 'dv_dien_thoai', nhan: 'Điện thoại đơn vị (nếu có)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'dv_email', nhan: 'Thư điện tử đơn vị (nếu có)', kieu: 'chu', khi: 'td_dia_chi' },
    { k: 'nganh_sau', nhan: 'Ngành, nghề kinh doanh của đơn vị SAU khi thay đổi (chi nhánh, địa điểm kinh doanh)', kieu: 'nganh', khi: 'td_nganh' },
    { k: 'noi_dung_hd', nhan: 'Nội dung hoạt động sau khi thay đổi (chỉ văn phòng đại diện)', kieu: 'dai', khi: 'td_nganh' },
    { k: 'doi_cn_chu_quan', nhan: 'Thay đổi chi nhánh chủ quản (địa điểm kinh doanh trực thuộc chi nhánh)', kieu: 'co' },
    { k: 'cn_chu_quan_moi', nhan: 'Chi nhánh chủ quản MỚI (tên — địa chỉ — mã số)', kieu: 'dai', khi: 'doi_cn_chu_quan' },
    { k: 'doi_thue', nhan: 'Thay đổi thông tin đăng ký thuế của đơn vị (in mục để điền tay)', kieu: 'co' },
    { k: 'cap_nhat', nhan: 'Mục B — bổ sung, cập nhật thông tin (mỗi dòng một nội dung)', kieu: 'dai', khi: 'td_cap_nhat' },
  ],
}

// ─── điều kiện từng tờ (d = chuanBiDuLieu: cờ td_…, thẻ tt_…) ───
const coVon = d => d.td_tang_von || d.td_giam_von
const tvCn = d => d.td_thanh_vien && (d.tt_tv_kieu_cn_moi || d.tt_tv_kieu_cn_noi_bo)
const canMau12 = d => d.td_ten || d.td_dia_chi || coVon(d) || d.td_nganh || d.td_thanh_vien || d.tt_doi_cshhl || d.td_cap_nhat || d.td_khac
// Quyết định CSH / HĐTV / ĐHĐCĐ: tên, trụ sở, người đại diện, vốn, ngành; tiếp nhận thành viên mới do tăng vốn
const canQd = d => d.td_ten || d.td_dia_chi || d.td_dai_dien || coVon(d) || d.td_nganh || (d.td_thanh_vien && d.tt_tv_kieu_tang_von)

const ky = s => Object.fromEntries(DN3.map(l => [l, s]))
const thu = { '1tv': 'td_1tv', '2tv': ['td_2tv', 'td_2tv_noi_bo'], cp: 'td_cp' }
const kyGd = 'Người ký theo ô “Người ký giấy ủy quyền / giấy đề nghị” (mặc định người đại diện theo pháp luật)'
const dvThu = { '1tv': ['td_cn_1tv', 'td_ddkd_1tv'], '2tv': 'td_vpdd_2tv', cp: 'td_cn_cp' }

const mau = [
  // ─── Thay đổi đăng ký DOANH NGHIỆP ───
  { ma: 'TD_UQ', thuTuc: ['thay_doi'], kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp hồ sơ thay đổi tại Phòng ĐKKD)', dot: 'so', loaiHinh: DN3, thuTu: 1,
    nguoiKy: ky(kyGd), duLieuThu: thu },
  { ma: 'TD_MAU12', thuTuc: ['thay_doi'], kyBoi: ['dd'], ten: 'Mẫu số 12 — Giấy đề nghị đăng ký thay đổi / thông báo thay đổi nội dung đăng ký doanh nghiệp', dot: 'so', loaiHinh: DN3, thuTu: 2,
    nguoiKy: ky(kyGd + ' (trang cuối)'), dieuKien: canMau12, duLieuThu: { ...thu, '1tv': ['td_1tv', 'td_1tv_it'] } },
  { ma: 'TD_MAU13', thuTuc: ['thay_doi'], kyBoi: ['ct'], ten: 'Mẫu số 13 — Giấy đề nghị đăng ký thay đổi người đại diện theo pháp luật', dot: 'so', loaiHinh: DN3, thuTu: 3,
    nguoiKy: ky('Chủ tịch công ty / Chủ tịch HĐTV / Chủ tịch HĐQT ký (chủ tịch đồng thời là người đại diện bị thay → chủ tịch mới ký)'), dieuKien: d => d.td_dai_dien, duLieuThu: thu },
  { ma: 'TD_MAU15', thuTuc: ['thay_doi'], kyBoi: ['csh'], ten: 'Mẫu số 15 — Giấy đề nghị đăng ký thay đổi chủ sở hữu công ty TNHH một thành viên', dot: 'so', loaiHinh: ['1tv'], thuTu: 3,
    nguoiKy: { '1tv': 'Chủ sở hữu mới + chủ sở hữu cũ ký tên (trang cuối)' }, dieuKien: d => d.td_chu_so_huu, duLieuThu: { '1tv': 'td_1tv' } },
  { ma: 'TD_QD_CSH', thuTuc: ['thay_doi'], kyBoi: ['csh'], ten: 'Quyết định của Chủ sở hữu về việc thay đổi nội dung đăng ký doanh nghiệp', dot: 'so', loaiHinh: ['1tv'], thuTu: 4,
    nguoiKy: { '1tv': 'Chủ sở hữu ký tên' }, dieuKien: canQd, duLieuThu: { '1tv': ['td_1tv', 'td_1tv_it'] } },
  { ma: 'TD_QD_HDTV', thuTuc: ['thay_doi'], kyBoi: ['ct'], ten: 'Quyết định của Hội đồng thành viên về việc thay đổi nội dung đăng ký doanh nghiệp', dot: 'so', loaiHinh: ['2tv'], thuTu: 4,
    nguoiKy: { '2tv': 'Chủ tịch Hội đồng thành viên ký tên' }, dieuKien: canQd, duLieuThu: { '2tv': 'td_2tv' } },
  { ma: 'TD_QD_DHDCD', thuTuc: ['thay_doi'], kyBoi: ['ct'], ten: 'Quyết định của Đại hội đồng cổ đông về việc thay đổi nội dung đăng ký doanh nghiệp', dot: 'so', loaiHinh: ['cp'], thuTu: 4,
    nguoiKy: { cp: 'Chủ tịch Hội đồng quản trị ký tên (TM. Đại hội đồng cổ đông)' }, dieuKien: canQd, duLieuThu: { cp: 'td_cp' } },
  { ma: 'TD_MAU6', thuTuc: ['thay_doi'], kyBoi: ['tv', 'dd'], ten: 'Mẫu số 6 — Danh sách thành viên công ty TNHH hai thành viên trở lên (sau thay đổi)', dot: 'so', loaiHinh: ['2tv'], thuTu: 5,
    nguoiKy: { '2tv': 'Thành viên có phần vốn góp thay đổi ký ở cột 13; người đại diện theo pháp luật ký cuối trang' }, dieuKien: d => d.td_thanh_vien, duLieuThu: { '2tv': ['td_2tv', 'td_2tv_tc'] } },
  { ma: 'TD_MAU7', thuTuc: ['thay_doi'], kyBoi: ['cd', 'dd'], ten: 'Mẫu số 7 — Danh sách cổ đông sáng lập (sau thay đổi)', dot: 'so', loaiHinh: ['cp'], thuTu: 5,
    nguoiKy: { cp: 'Cổ đông sáng lập có cổ phần thay đổi ký ở cột 18; người đại diện theo pháp luật ký cuối trang' }, dieuKien: d => d.td_thanh_vien, duLieuThu: { cp: ['td_cp', 'td_cp_tc'] } },
  { ma: 'TD_MAU10', thuTuc: ['thay_doi'], kyBoi: ['dd'], ten: 'Mẫu số 10 — Danh sách chủ sở hữu hưởng lợi của doanh nghiệp (sau thay đổi)', dot: 'so', loaiHinh: DN3, thuTu: 6,
    nguoiKy: ky('Người đại diện theo pháp luật (CŨ) ký tên (trang cuối)'), dieuKien: d => d.td_thanh_vien || d.tt_doi_cshhl, duLieuThu: thu },
  { ma: 'TD_HDCN_VON', thuTuc: ['thay_doi'], kyBoi: ['dd'], ten: 'Hợp đồng chuyển nhượng phần vốn góp', dot: 'so', loaiHinh: ['1tv', '2tv'], thuTu: 7,
    nguoiKy: { '1tv': 'Chủ sở hữu cũ (Bên A) + chủ sở hữu mới (Bên B) ký tên; người đại diện theo pháp luật ký xác nhận, đóng dấu', '2tv': 'Bên chuyển nhượng + bên nhận chuyển nhượng ký tên; người đại diện theo pháp luật ký xác nhận, đóng dấu' },
    dieuKien: d => (d.la_1tv && d.td_chu_so_huu) || (d.la_2tv && tvCn(d)), duLieuThu: { '1tv': 'td_1tv', '2tv': ['td_2tv', 'td_2tv_noi_bo'] } },
  { ma: 'TD_HDCN_CP', thuTuc: ['thay_doi'], kyBoi: ['dd'], ten: 'Hợp đồng chuyển nhượng cổ phần', dot: 'so', loaiHinh: ['cp'], thuTu: 7,
    nguoiKy: { cp: 'Bên chuyển nhượng + bên nhận chuyển nhượng ký tên; người đại diện theo pháp luật ký xác nhận, đóng dấu' }, dieuKien: tvCn, duLieuThu: { cp: 'td_cp' } },

  // ─── Thay đổi đăng ký HỘ KINH DOANH ───
  { ma: 'TD_UQ_HKD', thuTuc: ['thay_doi_hkd'], kyBoi: ['csh'], ten: 'Giấy ủy quyền (nộp hồ sơ thay đổi hộ kinh doanh)', dot: 'so', loaiHinh: ['hkd'], thuTu: 1,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên' }, duLieuThu: { hkd: 'td_hkd' } },
  { ma: 'TD_MAU2_HKD', thuTuc: ['thay_doi_hkd'], kyBoi: ['csh'], ten: 'Mẫu số 2 — Giấy đề nghị đăng ký thay đổi nội dung đăng ký hộ kinh doanh', dot: 'so', loaiHinh: ['hkd'], thuTu: 2,
    nguoiKy: { hkd: 'Chủ hộ kinh doanh ký tên (trang cuối); đổi chủ hộ thì chủ hộ MỚI ký' }, duLieuThu: { hkd: ['td_hkd', 'td_hkd_chu_ho'] } },

  // ─── Thay đổi ĐƠN VỊ PHỤ THUỘC (loại hình = loại hình công ty mẹ) ───
  { ma: 'TD_UQ_DVPT', thuTuc: ['thay_doi_dvpt'], kyBoi: ['dd'], ten: 'Giấy ủy quyền (nộp hồ sơ thay đổi đơn vị phụ thuộc)', dot: 'so', loaiHinh: DN3, thuTu: 1,
    nguoiKy: ky('Người đại diện theo pháp luật ký tên'), duLieuThu: dvThu },
  { ma: 'TD_MAU19', thuTuc: ['thay_doi_dvpt'], kyBoi: ['dd'], ten: 'Mẫu số 19 — Giấy đề nghị đăng ký thay đổi nội dung đăng ký hoạt động chi nhánh / văn phòng đại diện / địa điểm kinh doanh', dot: 'so', loaiHinh: DN3, thuTu: 2,
    nguoiKy: ky('Người đại diện theo pháp luật ký tên (trang cuối)'), duLieuThu: dvThu },
]

const IN = ['In trên 1 mặt giấy.', 'Mỗi file 2 bản.', 'Ký bằng bút mực xanh, không điền ngày tháng.']
const luuY = {
  'thay_doi|so': [...IN, 'Mẫu 6 / 7 / 10 in danh sách thành viên / cổ đông / chủ sở hữu hưởng lợi đang lưu ở tab Người — cập nhật danh sách SAU thay đổi trước khi xuất.',
    'Tăng vốn: kèm phiếu thu (góp tiền mặt) hoặc giấy báo có ngân hàng (chuyển khoản).',
    'Đổi tên / đổi địa chỉ hành chính (phường, tỉnh): nhắc khách khắc lại con dấu.',
    'Đổi trụ sở làm đổi cơ quan thuế quản lý: làm thêm hồ sơ thuế nơi cũ (trước) và nơi mới (sau khi có giấy phép).'],
  'thay_doi_hkd|so': [...IN, 'Kèm bản photo căn cước của chủ hộ (2 bản).'],
  'thay_doi_dvpt|so': [...IN],
}

export default { mau, thongTin, luuY }
