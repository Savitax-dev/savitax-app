// Dữ liệu GIẢ cho bộ kiểm mẫu Word nhóm THAY ĐỔI ĐĂNG KÝ — (G = DU_LIEU_GIA đã có, h = người / hàm giả dùng chung) → { tên bộ: hồ sơ }
// td_* = thay đổi. Chỉ tiêu thay đổi = noi_dung_thay_doi (mã ở lib/phaply/nhom.js NOI_DUNG_THAY_DOI); giá trị mới ở thong_tin.
// Bộ "đủ" bật nhiều chỉ tiêu cùng lúc (mẫu dài nhất → bộ kiểm ngắt trang soi trường hợp xấu nhất); td_1tv_it chỉ đổi ngành.
// Mọi tên / số đều GIẢ (CCCD 0790…, MST 0399…).

// nhóm ô một người trong thong_tin: tien_ho_ten, tien_gioi_tinh ('nam'/'nu'), …, tien_dia_chi { so_nha, xa, tinh }
const ttNguoi = (t, p, them = {}) => ({
  [t + '_ho_ten']: p.ho_ten.toLocaleUpperCase('vi-VN'), [t + '_gioi_tinh']: p.gioi_tinh === 'Nữ' ? 'nu' : 'nam', [t + '_ngay_sinh']: p.ngay_sinh,
  [t + '_so_giay_to']: p.so_giay_to, [t + '_ngay_cap']: p.ngay_cap, [t + '_noi_cap']: p.noi_cap,
  [t + '_dia_chi']: { so_nha: p.thuong_tru.so_nha, xa: p.thuong_tru.xa, tinh: p.thuong_tru.tinh }, [t + '_dien_thoai']: p.dien_thoai, [t + '_email']: '', ...them,
})

export default (G, h) => {
  const { hcm, nguoi, BINH, CUONG, DUNG, EM } = h
  const GIAU = nguoi('Mai Văn Giàu', 'Nam', '14/02/1987', '079087000888', hcm('5 Đường Mẫu Số 7', 'Phường Gia Định'))
  const HANH = nguoi('Lý Thị Hạnh', 'Nữ', '06/06/1993', '079193000999', hcm('19 Đường Mẫu Số 9', 'Phường Tân Sơn Nhất'))
  const TS = { so_nha: '27 Đường Mẫu Số 11', xa: 'Phường Bình Thạnh', tinh: 'Thành phố Hồ Chí Minh' }
  const NG_THEM = [
    { ma: '4649', ten: 'Bán buôn đồ dùng khác cho gia đình', chi_tiet: 'Bán buôn mỹ phẩm', chinh: false },
    { ma: '8299', ten: 'Hoạt động dịch vụ hỗ trợ kinh doanh khác còn lại chưa được phân vào đâu', chi_tiet: 'Xuất nhập khẩu các mặt hàng công ty kinh doanh', chinh: true },
  ]
  const NG_BO = [{ ma: '7310', ten: 'Quảng cáo', chi_tiet: '', chinh: false }]
  const NG_SUA = [{ ma: '7020', ten: 'Hoạt động tư vấn quản lý', chi_tiet: 'Tư vấn quản lý doanh nghiệp (trừ tư vấn tài chính, kế toán, pháp luật)', chinh: false }]

  const chung = {
    kinh_gui: '', ten_moi: 'CÔNG TY TNHH MẪU THỬ ĐỔI TÊN', ten_moi_nn: 'MAU THU DOI TEN COMPANY LIMITED', ten_moi_viet_tat: '',
    tru_so_moi: TS, ts_dien_thoai: '0284444444', dc_thue_cung: true,
    ...ttNguoi('dm', HANH, { dm_chuc_danh: 'Giám đốc' }),
    thoi_diem_von: 'Kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp', hinh_thuc_von: 'Góp thêm vốn bằng tiền Việt Nam đồng',
    nganh_them: NG_THEM, nganh_bo: NG_BO, nganh_sua: NG_SUA,
    cap_nhat: 'Cập nhật số định danh cá nhân của người đại diện theo pháp luật.\nCập nhật địa chỉ liên lạc của chủ sở hữu theo địa giới hành chính mới.',
    xac_nhan: true, ngay_gcn: '05/10/2026', cn_hinh_thuc: 'tiền mặt hoặc chuyển khoản',
  }
  const td = (goc, nd, tt) => ({ ...G[goc], thu_tuc: 'thay_doi', bien_the: 'thay_doi', noi_dung_thay_doi: nd, thong_tin: tt })

  const ra = {
    // 1TV: đổi tên + trụ sở + người đại diện + tăng vốn + ngành + chủ sở hữu (chủ sở hữu mới ký)
    td_1tv: td('1tv', ['ten', 'dia_chi', 'dai_dien', 'tang_von', 'nganh', 'chu_so_huu', 'cap_nhat'], {
      ...chung, nguoi_ky: 'nb', von_moi: 3000000000,
      ...ttNguoi('nb', GIAU), cn_von: 2000000000, cn_ty_le: '100%', cn_gia: 2000000000 }),
    // 1TV: chỉ bổ sung / bỏ ngành (bộ hồ sơ ngắn nhất)
    td_1tv_it: td('1tv', ['nganh'], { nganh_them: NG_THEM.slice(0, 1), nganh_bo: NG_BO, nganh_sua: NG_SUA }),
    // 2TV: thành viên mới do chuyển nhượng + đổi người đại diện (chủ tịch ký) + tăng vốn + chủ sở hữu hưởng lợi
    td_2tv: td('2tv', ['ten', 'dia_chi', 'dai_dien', 'tang_von', 'nganh', 'thanh_vien', 'cap_nhat'], {
      ...chung, nguoi_ky: 'ct', doi_cshhl: true, tv_kieu: 'cn_moi', von_cu: 1000000000, von_moi: 1500000000,
      ...ttNguoi('cn', CUONG), cn_von_truoc: 250000000, cn_ty_le_truoc: '25%',
      ...ttNguoi('nb', GIAU), cn_von: 250000000, cn_ty_le: '25%', cn_gia: 250000000 }),
    // 2TV: chuyển nhượng giữa thành viên hiện có (chỉ đổi tỷ lệ) — không quyết định
    td_2tv_noi_bo: td('2tv', ['thanh_vien'], {
      tv_kieu: 'cn_noi_bo', ...ttNguoi('cn', CUONG), cn_von_truoc: 250000000, cn_ty_le_truoc: '25%',
      ...ttNguoi('nb', BINH), cn_von: 100000000, cn_ty_le: '10%', cn_gia: 100000000, ngay_gcn: '05/10/2026' }),
    // CP: chuyển nhượng cổ phần cho người mới + đổi trụ sở + người đại diện + tăng vốn + ngành
    td_cp: td('cp', ['dia_chi', 'dai_dien', 'tang_von', 'nganh', 'thanh_vien'], {
      ...chung, nguoi_ky: 'ct', tv_kieu: 'cn_moi', von_moi: 600000000, so_cp_moi: 60000,
      ...ttNguoi('cn', EM), cn_von_truoc: 100000000, cn_cp_truoc: 10000, cn_ty_le_truoc: '25%',
      ...ttNguoi('nb', GIAU), cn_so_cp: 5000, cn_von: 50000000, cn_ty_le: '12,5%', cn_gia: 50000000 }),
    // thành viên / cổ đông là TỔ CHỨC (Mẫu 6 / 7 phần II) — chỉ đổi thành viên do chuyển nhượng giữa thành viên hiện có
    td_2tv_tc: td('2tv_tc', ['thanh_vien'], { tv_kieu: 'cn_noi_bo', ...ttNguoi('cn', BINH), ...ttNguoi('nb', CUONG), cn_von: 50000000, cn_ty_le: '5%', cn_gia: 50000000 }),
    td_cp_tc: td('cp_tc', ['thanh_vien'], { tv_kieu: 'cn_noi_bo', ...ttNguoi('cn', BINH), ...ttNguoi('nb', CUONG), cn_so_cp: 1000, cn_von: 10000000, cn_ty_le: '2,5%', cn_gia: 10000000 }),
  }

  // ─── hộ kinh doanh ───
  const hkd = (nd, tt, them = {}) => ({ ...G.hkd, cty: { ...G.hkd.cty, ma_so: '0399000002' }, thu_tuc: 'thay_doi', bien_the: 'thay_doi_hkd', noi_dung_thay_doi: nd, thong_tin: tt, ...them })
  ra.td_hkd = hkd(['ten', 'dia_chi', 'tang_von', 'nganh', 'cap_nhat'], {
    co_quan_dk: 'Ủy ban nhân dân phường Bình Thạnh', ten_moi: 'HỘ KINH DOANH MẪU THỬ ĐỔI TÊN', tru_so_moi: TS, ts_dien_thoai: '0909000222',
    von_moi: 300000000, thoi_diem_von: '01/12/2026', hinh_thuc_von: 'Chủ hộ kinh doanh góp thêm vốn bằng tiền Việt Nam đồng',
    nganh_them: NG_THEM, nganh_bo: NG_BO, nganh_sua: NG_SUA, doi_thue: true,
    thue_chi_tieu: 'Chỉ tiêu 5.1: Địa chỉ nhận thông báo thuế', thue_cu: '15 Đường Mẫu Số 3, Phường Xuân Hòa', thue_moi: '27 Đường Mẫu Số 11, Phường Bình Thạnh',
    cap_nhat: 'Cập nhật địa chỉ thường trú của chủ hộ theo địa giới hành chính mới.', cap_doi: true })
  // đổi chủ hộ + thành viên hộ gia đình, không kê khai Mục C
  ra.td_hkd_chu_ho = hkd(['chu_so_huu', 'thanh_vien'], { chu_ho_do: 'uy_quyen', ...ttNguoi('ch', BINH), cap_doi: false }, { thanh_vien_ho: [{ ...h.AN, chuc_danh: '' }, DUNG] }) // chủ hộ mới BINH; chủ hộ cũ AN ở lại làm thành viên

  // ─── đơn vị phụ thuộc ───
  const dv = (goc, nd, tt) => ({ ...G[goc], thu_tuc: 'thay_doi', bien_the: 'thay_doi_dvpt', noi_dung_thay_doi: nd, thong_tin: tt })
  ra.td_cn_1tv = dv('cn_1tv', ['ten', 'dia_chi', 'nganh', 'dai_dien', 'cap_nhat'], {
    dv_ten: 'CHI NHÁNH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT - BÌNH THẠNH', dv_ma_so: '0319000001-001',
    ten_moi: 'CHI NHÁNH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT - GIA ĐỊNH', dia_chi_moi: TS, dv_dien_thoai: '0285555555',
    nganh_sau: [{ ...h.nganh[0], chinh: true }, h.nganh[1]], doi_thue: true,
    cap_nhat: 'Cập nhật địa chỉ trụ sở chính của doanh nghiệp tại Mục 4 trên Giấy chứng nhận đăng ký hoạt động chi nhánh.' })
  ra.td_ddkd_1tv = dv('ddkd_1tv', ['dia_chi'], {
    dv_ten: 'ĐỊA ĐIỂM KINH DOANH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT', dv_ma_so: '00002', dia_chi_moi: TS,
    doi_cn_chu_quan: true, cn_chu_quan: 'Chi nhánh Mẫu Thử A — 1 Đường Mẫu, Phường Bến Thành — 0319000001-001',
    cn_chu_quan_moi: 'Chi nhánh Mẫu Thử B — 2 Đường Mẫu, Phường Gia Định — 0319000001-002' })
  ra.td_vpdd_2tv = dv('vpdd_2tv', ['ten', 'nganh'], {
    dv_ten: 'VĂN PHÒNG ĐẠI DIỆN CÔNG TY TNHH CÔNG NGHỆ BÌNH MINH', dv_ma_so: '0319000001-003',
    ten_moi: 'VĂN PHÒNG ĐẠI DIỆN CÔNG TY TNHH CÔNG NGHỆ BÌNH MINH TẠI THÀNH PHỐ HỒ CHÍ MINH',
    noi_dung_hd: 'Liên lạc, nghiên cứu thị trường, xúc tiến thương mại cho công ty; không hoạt động kinh doanh.' })
  ra.td_cn_cp = dv('cn_cp', ['dia_chi', 'dai_dien'], {
    dv_ten: 'CHI NHÁNH CÔNG TY CỔ PHẦN THƯƠNG MẠI CỬU LONG - BÌNH THẠNH', dia_chi_moi: TS })
  return ra
}
