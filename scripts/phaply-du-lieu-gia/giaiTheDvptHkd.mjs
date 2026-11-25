// Dữ liệu GIẢ cho bộ kiểm mẫu Word nhóm CHẤM DỨT ĐƠN VỊ PHỤ THUỘC (giai_the_dvpt) + CHẤM DỨT HỘ KINH DOANH (giai_the_hkd).
// (G = DU_LIEU_GIA đã có, h = người / hàm giả dùng chung) → { tên bộ: hồ sơ }. Mọi tên / số đều bịa (MST 0319…, CCCD 079…).
// Hồ sơ đơn vị phụ thuộc gắn CÔNG TY MẸ (bộ gốc 1tv / 2tv / cp), thông tin đơn vị cần chấm dứt ở thong_tin, người đứng đầu = nguoi_dung_dau.
export default (G, h) => {
  const dv = (goc, loai, them = {}) => ({
    ...G[goc], bien_the: 'giai_the_dvpt', don_vi_loai: loai, nguoi_dung_dau: h.CUONG,
    thong_tin: {
      ma_so: loai === 'ddkd' ? '00001' : '0319000001-001', ngay_cap: '04/05/2023', dia_chi: h.hcm('300 Đường Mẫu Số 5', 'Phường Bình Thạnh'),
      dien_thoai: '0283333333', ly_do: 'Tình hình hoạt động kinh doanh không hiệu quả',
      dn_ngay_cap: '17/12/2020', cqt_quan_ly: 'Thuế cơ sở 5 Thành phố Hồ Chí Minh', hai_quan: 'Chi cục Hải quan khu vực II',
      xn_hai_quan: true, hq_du_phong: true, khong_xnk: true, khong_hoa_don: true, cam_ket_khong_ps: true, hach_toan: 'phu_thuoc',
      ...them,
    },
  })
  return {
    gtd_cn_1tv: dv('1tv', 'chi_nhanh', { ten: 'CHI NHÁNH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT - BÌNH THẠNH' }),
    gtd_cn_1tv_tc: dv('1tv_tc', 'chi_nhanh', { ten: 'CHI NHÁNH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT - BÌNH THẠNH' }),
    // ĐĐKD trực thuộc chi nhánh: điền mục 3 Mẫu 28; không có bộ thuế
    gtd_ddkd_1tv: dv('1tv', 'ddkd', { ten: 'ĐỊA ĐIỂM KINH DOANH KHO HÀNG - CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT',
      cn_chu_quan_ten: 'CHI NHÁNH CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT - BÌNH THẠNH', cn_chu_quan_ma: '0319000001-001',
      cn_chu_quan_dia_chi: '300 Đường Mẫu Số 5, Phường Bình Thạnh, Thành phố Hồ Chí Minh' }),
    gtd_cn_2tv: dv('2tv', 'chi_nhanh', { ten: 'CHI NHÁNH CÔNG TY TNHH CÔNG NGHỆ BÌNH MINH - BÌNH THẠNH', hach_toan: 'doc_lap' }),
    // VPĐD: tick hết ô chi nhánh vẫn không đổi gì (ô bị lọc theo loại đơn vị); để trống Hải quan + nơi cấp → chỗ chấm
    gtd_vpdd_2tv: dv('2tv', 'vpdd', { ten: 'VĂN PHÒNG ĐẠI DIỆN CÔNG TY TNHH CÔNG NGHỆ BÌNH MINH', hai_quan: '', dien_thoai: '',
      ly_do: 'Công ty không còn nhu cầu sử dụng văn phòng đại diện' }),
    gtd_cn_cp: dv('cp', 'chi_nhanh', { ten: 'CHI NHÁNH CÔNG TY CỔ PHẦN THƯƠNG MẠI CỬU LONG - BÌNH THẠNH', khong_xnk: false, khong_hoa_don: false,
      cam_ket_khong_ps: false, hq_du_phong: false }),
    // Hộ kinh doanh: mã số hộ = số định danh của chủ hộ (giả)
    gth_hkd: { ...G.hkd, bien_the: 'giai_the_hkd', cty: { ...G.hkd.cty, ma_so: '079085000111' },
      co_quan_thue: 'Thuế cơ sở 3 Thành phố Hồ Chí Minh',
      thong_tin: { ngay_cap_gcn: '15/08/2025', noi_cap_gcn: 'Ủy ban nhân dân phường Xuân Hòa', khong_phat_sinh_dt: true, khong_hoa_don: true } },
  }
}
