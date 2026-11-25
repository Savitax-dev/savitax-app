// Dữ liệu GIẢ cho bộ kiểm mẫu Word nhóm GIẢI THỂ CÔNG TY (biến thể giai_the: so1 / thue / so2) — (G = DU_LIEU_GIA đã có, h = người / hàm giả)
// Mọi tên / số / địa chỉ đều bịa (MST 0319…, CCCD 0790…). Bộ gt_*_kps bật các ô "không phát sinh…" để dựng thử các tờ có dieuKien.
const TT = {
  ngay_thanh_lap: '15/03/2021', ngay_qd: '01/12/2026', so_qd: '01/QĐ-GT', ly_do: 'Tình hình kinh doanh không hiệu quả',
  linh_vuc: 'Bán buôn thực phẩm (không hoạt động tại trụ sở)', hai_quan: 'Chi cục Hải quan khu vực II',
}
const KPS = { khong_doanh_thu: true, khong_hoa_don: true, khong_xnk: true }
// "có phát sinh": có người lao động, còn chủ nợ, có tài sản thanh lý / tài sản cố định → bảng + đoạn để trống cho viết tay
const CO_PS = { co_nld: true, co_chu_no: true, co_ts_thanh_ly: true, co_tscd: true, noi_luu_so: '9 Đường Mẫu Số 7, Phường Bến Thành, Thành phố Hồ Chí Minh' }

export default (G, h) => {
  const gt = (goc, them = {}) => ({ ...G[goc], bien_the: 'giai_the', thu_tuc: 'giai_the', thong_tin: { ...TT, ...them } })
  return {
    gt_1tv: gt('1tv'),
    gt_2tv: gt('2tv'),
    gt_cp: gt('cp'),
    // chủ sở hữu là tổ chức (1TV) / thành viên là tổ chức (2TV)
    gt_1tv_tc: gt('1tv_tc'),
    gt_2tv_tc: gt('2tv_tc'),
    // bật các cam kết "không phát sinh doanh thu / hóa đơn / xuất nhập khẩu"
    gt_1tv_kps: gt('1tv', KPS),
    gt_2tv_kps: gt('2tv', KPS),
    gt_cp_kps: gt('cp', { ...KPS, ...CO_PS }),
    // có lao động / chủ nợ / tài sản; các ô thông tin chính để trống → mẫu in chỗ chấm
    gt_1tv_ps: gt('1tv', { ...CO_PS, ngay_thanh_lap: '', ngay_qd: '', so_qd: '', linh_vuc: '', hai_quan: '' }),
  }
}
