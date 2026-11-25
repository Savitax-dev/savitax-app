import tamNgung from './phaply-du-lieu-gia/tamNgung.mjs'
import giaiThe from './phaply-du-lieu-gia/giaiThe.mjs'
import giaiTheDvptHkd from './phaply-du-lieu-gia/giaiTheDvptHkd.mjs'
import thayDoi from './phaply-du-lieu-gia/thayDoi.mjs'
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
  ban_giao: { ngay: '2026-11-20', nguoi_nhan: 'Trần Văn An', ghi_chu: 'Bên nhận đã kiểm tra con dấu',
    muc: [{ ten: 'Giấy chứng nhận đăng ký doanh nghiệp (bản gốc)', so_luong: '01' }, { ten: 'Con dấu doanh nghiệp', so_luong: '01', ghi_chu: 'Dấu tròn' }] },
  ben_giao: { ten: 'Công ty Cổ phần Tư vấn Thuế Mẫu', dia_chi: '1 Đường Mẫu, Phường Mẫu, Thành phố Hồ Chí Minh', mst: '0300000000', dien_thoai: '0280000000' },
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

// ── Biến thể Điều lệ bổ sung (25/11/2026) — DANH_MUC.duLieuThu chọn bộ dữ liệu này cho mẫu tương ứng ──
// Tổ chức GIẢ (MST 0399…, không có thật)
const TO_CHUC = {
  ho_ten: 'Công ty Cổ phần Đầu tư Mẫu Thử', la_to_chuc: true, ma_so_dn: '0399000001', ngay_cap_dn: '10/01/2020',
  noi_cap_dn: 'Phòng Đăng ký kinh doanh thuộc Sở Tài chính Thành phố Hồ Chí Minh', thuong_tru: hcm('200 Đường Mẫu', 'Phường Bến Nghé'),
  dien_thoai: '0287777777', email: 'mauthu@vidu.vn', dai_dien_ten: 'Đỗ Văn Em', dai_dien_chuc_danh: 'Tổng giám đốc', person_id: 'tc1',
}
const UQ = (p, von, cua = 'tc1') => ({ ...p, chuc_danh: '', von_uy_quyen: von, cua_person_id: cua, cua_ten: TO_CHUC.ho_ten,
  thoi_diem_dai_dien: 'Kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp' })
const HAI_DAI_DIEN = [{ ...AN, chuc_danh: 'Chủ tịch công ty' }, { ...BINH, chuc_danh: 'Giám đốc', quyen_han: 'Ký kết hợp đồng lao động, hợp đồng mua bán hàng hóa có giá trị dưới 500.000.000 đồng; đại diện công ty làm việc với cơ quan thuế.' }]

// 1TV — chủ sở hữu là TỔ CHỨC, 2 người đại diện theo ủy quyền, 2 người đại diện theo pháp luật
DU_LIEU_GIA['1tv_tc'] = { ...DU_LIEU_GIA['1tv'],
  cty: { ...DU_LIEU_GIA['1tv'].cty, csh_la_to_chuc: true, mo_hinh: 'chu_tich', thoi_han_hoat_dong: 'vô thời hạn' },
  chu_so_huu: TO_CHUC, dai_dien_uy_quyen: [UQ(AN, 1200000000), UQ(BINH, 800000000)], ds_dai_dien: HAI_DAI_DIEN, dai_dien: HAI_DAI_DIEN[0], giam_doc: HAI_DAI_DIEN[1] }
DU_LIEU_GIA['1tv_tc_hdtv'] = { ...DU_LIEU_GIA['1tv_tc'], cty: { ...DU_LIEU_GIA['1tv_tc'].cty, mo_hinh: 'hdtv' },
  dai_dien_uy_quyen: [UQ(AN, 1000000000), UQ(BINH, 600000000), UQ(CUONG, 400000000)] }
// 2TV — một thành viên là TỔ CHỨC (người đại diện theo ủy quyền: Đỗ Văn Em), 2 người đại diện theo pháp luật
const DD_2TV = [{ ...AN, chuc_danh: 'Chủ tịch Hội đồng thành viên' }, { ...BINH, chuc_danh: 'Giám đốc', quyen_han: HAI_DAI_DIEN[1].quyen_han }]
DU_LIEU_GIA['2tv_tc'] = { ...DU_LIEU_GIA['2tv'], ds_dai_dien: DD_2TV, dai_dien: DD_2TV[0], giam_doc: DD_2TV[1],
  thanh_vien: [...DU_LIEU_GIA['2tv'].thanh_vien.slice(0, 2), { ...TO_CHUC, von_gop: 250000000, thoi_han_gop: DU_LIEU_GIA['2tv'].thanh_vien[2].thoi_han_gop }],
  dai_dien_uy_quyen: [UQ(EM, 250000000)] }
// CP — 3 người đại diện theo pháp luật (Chủ tịch HĐQT, Giám đốc, người thứ 3)
const DD_CP = [{ ...EM, chuc_danh: 'Chủ tịch Hội đồng quản trị' }, { ...DUNG, chuc_danh: 'Giám đốc' }, { ...CUONG, chuc_danh: 'Phó Giám đốc', quyen_han: 'Đại diện công ty trong các giao dịch với ngân hàng.' }]
DU_LIEU_GIA['cp_nhieu_dd'] = { ...DU_LIEU_GIA.cp, ds_dai_dien: DD_CP, dai_dien: DD_CP[0], giam_doc: DD_CP[1] }
// CP — một cổ đông là TỔ CHỨC (thay cổ đông thứ 4), người đại diện theo ủy quyền: Nguyễn Văn An
DU_LIEU_GIA['cp_tc'] = { ...DU_LIEU_GIA.cp,
  co_dong: [...DU_LIEU_GIA.cp.co_dong.slice(0, 3), { ...TO_CHUC, so_co_phan: 8000, thoi_han_gop: DU_LIEU_GIA.cp.co_dong[3].thoi_han_gop }, DU_LIEU_GIA.cp.co_dong[4]],
  dai_dien_uy_quyen: [UQ(AN, 80000000)] }

// ── Hộ kinh doanh (1b) — chủ hộ = chu_so_huu, thành viên hộ gia đình = thanh_vien_ho ──
DU_LIEU_GIA.hkd = { loai_hinh: 'hkd', bien_the: 'tlm_hkd',
  cty: { ten: 'Hộ kinh doanh Mẫu Thử An Bình', tru_so: hcm('15 Đường Mẫu Số 3', 'Phường Xuân Hòa'), dien_thoai: '0909000111', email: '',
    von_dieu_le: 100000000, so_lao_dong: 2, nganh: [nganh[0]] },
  chu_so_huu: AN, thanh_vien_ho: [BINH], uy_quyen: NHAN_VIEN, phong_dkkd: 'Phòng Kinh tế Ủy ban nhân dân phường Xuân Hòa', ban_giao: DU_LIEU_GIA['1tv'].ban_giao,
  thong_tin: { chu_the: 'ho_gia_dinh', pp_thue: 'khoan', co_quan_dk: 'Phòng Kinh tế Ủy ban nhân dân phường Xuân Hòa' } }

// hộ kinh doanh của MỘT cá nhân, kê khai thuế, không kinh doanh tại trụ sở
DU_LIEU_GIA.hkd_cn = { ...DU_LIEU_GIA.hkd, thanh_vien_ho: [], thong_tin: { chu_the: 'ca_nhan', pp_thue: 'ke_khai', khong_tai_tru_so: true, co_quan_dk: 'Ủy ban nhân dân phường Xuân Hòa' } }

// ── Đơn vị phụ thuộc (1c) — hồ sơ gắn CÔNG TY MẸ; thông tin đơn vị ở thong_tin, người đứng đầu = nguoi_dung_dau ──
const dvpt = (goc, loai, ten) => ({ ...DU_LIEU_GIA[goc], bien_the: 'tlm_dvpt', don_vi_loai: loai, nguoi_dung_dau: CUONG,
  thong_tin: { ten, dia_chi: hcm('300 Đường Mẫu Số 5', 'Phường Bình Thạnh'), dien_thoai: '0283333333', email: 'donvi@vidu.vn',
    nganh: [nganh[0], nganh[1]], hach_toan: 'phu_thuoc', so_lao_dong: 5,
    ...(loai === 'vpdd' ? { noi_dung_hd: 'Thực hiện chức năng văn phòng liên lạc, xúc tiến thương mại; nghiên cứu thị trường cho công ty.' } : {}),
    ...(loai === 'chi_nhanh' ? { pp_gtgt: 'khau_tru' } : {}) } })
DU_LIEU_GIA.cn_1tv = dvpt('1tv', 'chi_nhanh', 'Chi nhánh Công ty TNHH Thương mại Dịch vụ An Phát - Bình Thạnh')
DU_LIEU_GIA.cn_2tv = dvpt('2tv', 'chi_nhanh', 'Chi nhánh Công ty TNHH Công nghệ Bình Minh - Bình Thạnh')
DU_LIEU_GIA.cn_cp = dvpt('cp', 'chi_nhanh', 'Chi nhánh Công ty Cổ phần Thương mại Cửu Long - Bình Thạnh')
DU_LIEU_GIA.vpdd_1tv = dvpt('1tv', 'vpdd', 'Văn phòng đại diện Công ty TNHH Thương mại Dịch vụ An Phát')
DU_LIEU_GIA.vpdd_2tv = dvpt('2tv', 'vpdd', 'Văn phòng đại diện Công ty TNHH Công nghệ Bình Minh')
DU_LIEU_GIA.vpdd_cp = dvpt('cp', 'vpdd', 'Văn phòng đại diện Công ty Cổ phần Thương mại Cửu Long')
DU_LIEU_GIA.ddkd_1tv = dvpt('1tv', 'ddkd', 'Địa điểm kinh doanh Công ty TNHH Thương mại Dịch vụ An Phát')

// ── Nhóm thủ tục khác (tạm ngừng, giải thể, thay đổi…) — mỗi nhóm một file ở scripts/phaply-du-lieu-gia/ ──
const H = { AN, BINH, CUONG, DUNG, EM, KE_TOAN, NHAN_VIEN, TO_CHUC, UQ, hcm, nguoi, nganh, dvpt }
for (const f of [tamNgung, giaiThe, giaiTheDvptHkd, thayDoi]) Object.assign(DU_LIEU_GIA, f(DU_LIEU_GIA, H))
