// Bộ kiểm (offline, dữ liệu GIẢ) — chuẩn hoá + kiểm chéo kết quả đọc CCCD (lib/phaply/cccd.js). Không gọi Claude.
//   node scripts/test-phaply-cccd.mjs
import { veNguoi, kiemCheo, docMrz, soKiemMrz, tachDiaChi, chuanNgay, chuHoaDau, NOI_CAP_CCCD, KHUON_DOC } from '../lib/phaply/cccd.js'

let pass = 0, fail = 0
const ok = (dk, ten, ct = '') => { if (dk) pass++; else { fail++; console.log('✗', ten, ct) } }

// Danh mục giả thu nhỏ (tên thật của danh mục mới, mã thật)
const places = {
  tinh: [{ ma: '79', ten: 'Thành phố Hồ Chí Minh' }, { ma: '01', ten: 'Thành phố Hà Nội' }, { ma: '24', ten: 'Tỉnh Bắc Ninh' }],
  xa: [{ ma: '26740', ten: 'Phường Sài Gòn', ma_tinh: '79' }, { ma: '26737', ten: 'Phường Tân Định', ma_tinh: '79' },
    { ma: '00070', ten: 'Phường Hoàn Kiếm', ma_tinh: '01' }],
}

// MRZ hợp lệ dựng bằng chữ số kiểm tra thật
const mrz = (so12, sinh, gioi, hetHan) => [
  `IDVNM${so12.slice(3)}${soKiemMrz(so12.slice(3))}${so12}<<0`,
  `${sinh}${soKiemMrz(sinh)}${gioi}${hetHan}${soKiemMrz(hetHan)}VNM<<<<<<<<<<<0`,
  'TRAN<<VAN<AN<<<<<<<<<<<<<<<<<<',
]
const DOC = {
  loai_the: 'cccd_chip', so: '079 090 000 111', ho_ten: 'TRẦN VĂN AN', ngay_sinh: '12/4/1990', gioi_tinh: 'Nam', quoc_tich: 'Việt Nam',
  que_quan: 'Bến Tre', noi_thuong_tru: '12 Đường Mẫu, Phường Sài Gòn, Thành phố Hồ Chí Minh', ngay_cap: '15/03/2022',
  noi_cap: 'CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI', ngay_het_han: '12/04/2065',
  mrz: mrz('079090000111', '900412', 'M', '650412'), khong_chac: [], ghi_chu: '',
}

// Chuẩn hoá
{
  const { nguoi, diaChiKhop } = veNguoi(DOC, places)
  ok(nguoi.so_giay_to === '079090000111', 'số bỏ khoảng trắng', nguoi.so_giay_to)
  ok(nguoi.ho_ten === 'Trần Văn An', 'tên viết hoa chữ đầu', nguoi.ho_ten)
  ok(nguoi.ngay_sinh === '12/04/1990', 'ngày chuẩn dd/mm/yyyy', nguoi.ngay_sinh)
  ok(nguoi.loai_giay_to === 'Căn cước công dân' && nguoi.noi_cap === NOI_CAP_CCCD, 'loại + nơi cấp đầy đủ', nguoi.noi_cap)
  ok(diaChiKhop && nguoi.thuong_tru.ma_xa === '26740' && nguoi.thuong_tru.ma_tinh === '79' && nguoi.thuong_tru.so_nha === '12 Đường Mẫu', 'tách địa chỉ theo danh mục', JSON.stringify(nguoi.thuong_tru))
  ok(kiemCheo(nguoi, DOC).length === 0, 'CCCD giả hợp lệ không cảnh báo', JSON.stringify(kiemCheo(nguoi, DOC)))
}
// Thẻ căn cước 2024: nơi cấp Bộ Công an, nữ sinh 2001
{
  const d = { ...DOC, loai_the: 'can_cuoc_2024', so: '001301000222', ho_ten: 'LÊ THỊ BÌNH', ngay_sinh: '01/02/2001', gioi_tinh: 'Nữ', noi_cap: 'BỘ CÔNG AN',
    noi_thuong_tru: 'Số 5 Ngõ Mẫu, phường Hoàn Kiếm, thành phố Hà Nội', mrz: mrz('001301000222', '010201', 'F', '410201'), ngay_het_han: '01/02/2041' }
  const { nguoi } = veNguoi(d, places)
  ok(nguoi.loai_giay_to === 'Căn cước' && nguoi.noi_cap === 'Bộ Công an' && nguoi.gioi_tinh === 'Nữ', 'thẻ 2024', JSON.stringify(nguoi))
  ok(nguoi.thuong_tru.ma_xa === '00070', 'địa chỉ chữ thường vẫn khớp danh mục')
  ok(kiemCheo(nguoi, d).length === 0, 'thẻ 2024 hợp lệ không cảnh báo', JSON.stringify(kiemCheo(nguoi, d)))
}
// Địa chỉ địa giới CŨ → không khớp, giữ nguyên văn
{
  const r = tachDiaChi('12 Nguyễn Trãi, Phường 2, Quận 5, Thành phố Hồ Chí Minh', places)
  ok(!r.khop && r.diaChi.so_nha === '12 Nguyễn Trãi, Phường 2, Quận 5, Thành phố Hồ Chí Minh' && !r.diaChi.ma_tinh, 'địa chỉ cũ giữ nguyên văn, không mã', JSON.stringify(r))
  ok(!tachDiaChi('Thôn A, Xã B, Huyện C, Tỉnh Bình Dương', places).khop, 'tỉnh cũ không khớp')
}
// Kiểm chéo bắt lỗi đọc
const lech = (sua, truong, ten) => {
  const d = { ...DOC, ...sua }
  const { nguoi } = veNguoi(d, places)
  const cb = kiemCheo(nguoi, d)
  ok(cb.some(c => c.truong === truong), ten, JSON.stringify(cb))
}
lech({ gioi_tinh: 'Nữ' }, 'gioi_tinh', 'giới tính ngược chữ số thứ 4 → cảnh báo')
lech({ ngay_sinh: '12/04/1991' }, 'ngay_sinh', 'năm sinh lệch số CCCD → cảnh báo')
lech({ so: '079090000118' }, 'so_giay_to', 'đọc sai 1 chữ số (khác MRZ) → cảnh báo')
lech({ so: '07909000011' }, 'so_giay_to', 'thiếu chữ số → cảnh báo')
lech({ mrz: ['IDVNM0900001115079090000111<<0', DOC.mrz[1]] }, 'mrz', 'MRZ sai chữ số kiểm tra → cảnh báo')
lech({ ngay_het_han: '12/04/2020', mrz: [] }, 'ngay_het_han', 'giấy tờ hết hạn → cảnh báo')
lech({ khong_chac: ['noi_cap'] }, 'noi_cap', 'Claude không chắc → tô ô')
{
  const d = { ...DOC, ngay_het_han: 'Không thời hạn', mrz: mrz('079090000111', '900412', 'M', '<<<<<<').map(x => x) }
  d.mrz[1] = `900412${soKiemMrz('900412')}M<<<<<<<VNM<<<<<<<<<<<0`
  const { nguoi } = veNguoi(d, places)
  ok(nguoi.ngay_het_han === 'Không thời hạn' && !kiemCheo(nguoi, d).some(c => c.truong === 'ngay_het_han' || c.truong === 'mrz'), 'không thời hạn không báo lỗi', JSON.stringify(kiemCheo(nguoi, d)))
}
// Hàm lẻ
ok(soKiemMrz('090000111') === soKiemMrz('090000111') && soKiemMrz('<<<') === 0, 'soKiemMrz')
ok(soKiemMrz('520727') === 3, 'soKiemMrz đúng ví dụ chuẩn ICAO (520727 → 3)')
ok(docMrz(['xyz']) === null, 'không có MRZ → null')
ok(chuanNgay('3-7-1985') === '03/07/1985' && chuanNgay('') === '', 'chuanNgay')
ok(chuHoaDau('  ĐỖ   thị  ÁNH ') === 'Đỗ Thị Ánh', 'chuHoaDau', chuHoaDau('  ĐỖ   thị  ÁNH '))
// Khuôn structured outputs: mọi object phải additionalProperties:false + required đủ khoá
ok(KHUON_DOC.additionalProperties === false && KHUON_DOC.required.length === Object.keys(KHUON_DOC.properties).length, 'khuôn JSON đúng luật structured outputs')

console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
