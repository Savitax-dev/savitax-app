// Dữ liệu GIẢ (tên, số giấy tờ, địa chỉ đều bịa) cho bộ kiểm mẫu Word phân hệ Pháp lý — 1 hồ sơ mỗi loại hình.
const NC = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội'
const hcm = (so_nha, xa) => ({ so_nha, xa, tinh: 'Thành phố Hồ Chí Minh', quoc_gia: 'Việt Nam' })
const nguoi = (ho_ten, gioi_tinh, ngay_sinh, so, dc, them = {}) => ({
  ho_ten, gioi_tinh, ngay_sinh, dan_toc: 'Kinh', quoc_tich: 'Việt Nam', loai_giay_to: 'Căn cước công dân',
  so_giay_to: so, ngay_cap: '15/03/2022', noi_cap: NC, thuong_tru: dc, lien_lac: dc, dien_thoai: '0900' + so.slice(-6), email: '', ...them,
})

const AN = nguoi('Trần Văn An', 'Nam', '12/04/1985', '079085000111', hcm('12 Lê Lợi', 'Phường Sài Gòn'), { chuc_danh: 'Giám đốc' })
const BINH = nguoi('Lê Thị Bình', 'Nữ', '20/08/1990', '079190000222', hcm('45/6 Nguyễn Trãi', 'Phường Bến Thành'))
const CUONG = nguoi('Phạm Quốc Cường', 'Nam', '03/01/1988', '079088000333', hcm('7 Hoàng Văn Thụ', 'Phường Phú Nhuận'))
const DUNG = nguoi('Võ Thị Dung', 'Nữ', '09/09/1995', '079195000444', hcm('101 Cách Mạng Tháng Tám', 'Phường Bàn Cờ'))
const EM = nguoi('Đỗ Văn Em', 'Nam', '30/11/1979', '079079000555', hcm('22 Phan Xích Long', 'Phường Cầu Kiệu'))
const KE_TOAN = nguoi('Ngô Thị Hoa', 'Nữ', '25/05/1992', '079192000666', hcm('3 Đinh Tiên Hoàng', 'Phường Tân Định'))
const NHAN_VIEN = nguoi('Hồ Thị Thu', 'Nữ', '11/11/1996', '079196000777', hcm('9 Trần Quang Khải', 'Phường Tân Định'))

const nganh = [
  { ten: 'Bán buôn thực phẩm', chi_tiet: 'Bán buôn cà phê, chè', ma: '4632', chinh: true },
  { ten: 'Hoạt động tư vấn quản lý', chi_tiet: 'Tư vấn quản lý doanh nghiệp (trừ tư vấn tài chính, kế toán, pháp luật)', ma: '7020' },
  { ten: 'Quảng cáo', ma: '7310' },
]
const chung = (ten) => ({
  ten, ten_nn: '', ten_viet_tat: '', ma_so: '0319000001', tru_so: hcm('88 Võ Văn Tần', 'Phường Xuân Hòa'),
  dien_thoai: '0281234567', email: 'lienhe@vidu.vn', so_lao_dong: 3, nganh,
})
const tiep = {
  phong_dkkd: 'Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh',
  co_quan_thue: 'Thuế cơ sở 3 thành phố Hồ Chí Minh',
  ke_toan: KE_TOAN, uy_quyen: NHAN_VIEN, thu_ky: NHAN_VIEN,
  thue: { hach_toan: 'doc_lap', pp_gtgt: 'khau_tru', bhxh: 'hang_thang' },
  so_sach: { phan_mem: 'Misa', nien_do_dau_tu: '05/10/2026', nien_do_dau_den: '31/12/2026', ky: 'nam' },
  quy_uoc_phieu: 10000,
}

export const DU_LIEU_GIA = {
  '1tv': { loai_hinh: '1tv', cty: { ...chung('Công ty TNHH Thương mại Dịch vụ An Phát'), von_dieu_le: 2000000000, mo_hinh: 'chu_tich' },
    dai_dien: AN, giam_doc: AN, chu_so_huu: AN, ...tiep },
  '2tv': { loai_hinh: '2tv', cty: { ...chung('Công ty TNHH Công nghệ Bình Minh'), von_dieu_le: 1000000000 },
    dai_dien: AN, giam_doc: AN, ...tiep,
    thanh_vien: [
      { ...AN, von_gop: 400000000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...BINH, von_gop: 350000000, chu_tich: true, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...CUONG, von_gop: 250000000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
    ] },
  cp: { loai_hinh: 'cp', cty: { ...chung('Công ty Cổ phần Thương mại Cửu Long'), von_dieu_le: 400000000, menh_gia: 10000 },
    dai_dien: { ...DUNG, chuc_danh: 'Giám đốc' }, giam_doc: { ...DUNG, chuc_danh: 'Giám đốc' }, ...tiep,
    co_dong: [
      { ...EM, so_co_phan: 10000, chu_tich: true, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...BINH, so_co_phan: 10000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...CUONG, so_co_phan: 10000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...AN, so_co_phan: 8000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
      { ...DUNG, chuc_danh: 'Giám đốc', so_co_phan: 2000, thoi_han_gop: 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' },
    ] },
}
