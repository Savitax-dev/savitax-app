// Kiểm các chỉnh sửa mẫu Word theo góp ý phòng pháp lý 18/11/2026 (chạy offline, dữ liệu giả):
//   node scripts/test-phaply-word-chuan.mjs
// 1 Điều lệ không đánh số trang · 2 Điều lệ 1TV không sang trang mỗi chương, tiêu đề chương đi cùng điều đầu · 3 cỡ chữ 12
// 4 địa chỉ nhận thông báo thuế in điện thoại / fax / email · 5 loại giấy tờ theo người · 6 dòng trống nhỏ + đầu trang 2 hàng
// 7 (giao diện — không kiểm ở đây) · 8 tỷ lệ 3 số thập phân, dấu phẩy · 9 hướng dẫn in ký có họ tên người ký
import { readFileSync, readdirSync } from 'node:fs'
import { inTyLe, chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { dungThan } from '../lib/phaply/word/khung.js'
import { nguonHuongDanInKy, dongHuongDan } from '../lib/phaply/word/huongDanInKy.js'

let dat = 0, hong = 0
const ok = (dk, ten, ct = '') => { if (dk) dat++; else { hong++; console.log('✗', ten, ct) } }
const NGUON = 'lib/phaply/word/nguon'
const doc = ma => readFileSync(`${NGUON}/${ma}.txt`, 'utf8')

// 1–3
// 25/11/2026: KHÔNG file nào đánh số trang, KHÔNG Điều lệ nào ép mỗi chương sang trang mới (pháp lý: "vẫn còn ngắt trang")
for (const f of readdirSync(NGUON).filter(f => f.endsWith('.txt'))) ok(!/^@so-trang$/m.test(readFileSync(`${NGUON}/${f}`, 'utf8')), `${f} không đánh số trang`)
for (const ma of ['DL_1TV', 'DL_2TV', 'DL_CP']) ok(!/^#cbkp Chương|^@ngat-trang$/m.test(doc(ma)), `${ma} không ép sang trang`)
for (const ma of ['DL_1TV', 'DL_2TV', 'DL_CP']) {
  const d = doc(ma).split('\n')
  d.forEach((l, i) => { if (/^#cbkp? Chương/.test(l)) ok(/^#cbk /.test(d[i + 1]), `${ma}: tên chương sau "${l.slice(-12)}" giữ cùng trang`, d[i + 1]) })
  ok(!/^#b Điều/m.test(doc(ma)), `${ma}: mọi tiêu đề Điều giữ cùng trang với đoạn sau`)
}
const BANG_NGANG = ['MAU6', 'MAU7', 'MAU10', 'TD_MAU6', 'TD_MAU7', 'TD_MAU10'] // bảng 14–19 cột khổ ngang: chữ trong bảng nhỏ hơn, cỡ chữ văn bản vẫn theo mẫu
for (const f of readdirSync(NGUON).filter(f => f.endsWith('.txt'))) {
  const ma = f.slice(0, -4), co = (doc(ma).match(/^@co (\d+)$/m) || [, '12'])[1]
  if (!BANG_NGANG.includes(ma)) ok(co === '12', `${ma} cỡ chữ 12`, co)
}

// 4
for (const ma of ['MAU2', 'MAU3', 'MAU4']) {
  const s = doc(ma), dong = s.split('\n').find(l => l.includes('Địa chỉ nhận thông báo thuế')) || ''
  ok(dong.includes('{cty_dien_thoai}') && dong.includes('{cty_email}') && dong.includes('{cty_fax}'), `${ma}: mục nhận thông báo thuế in điện thoại / fax / email`)
}

// 5
const nguoi = (ten, loai, x = {}) => ({ ho_ten: ten, gioi_tinh: 'Nam', loai_giay_to: loai, so_giay_to: '079000000001', ...x })
const d5 = chuanBiDuLieu({ loai_hinh: '1tv', cty: { von_dieu_le: 1e9 }, dai_dien: nguoi('A', 'Căn cước'), giam_doc: nguoi('B', 'Hộ chiếu'), chu_so_huu: nguoi('C', 'Căn cước công dân') })
ok(d5.dd_giay_to_so === 'Thẻ Căn cước số', 'Căn cước → "Thẻ Căn cước số"', d5.dd_giay_to_so)
ok(d5.gd_giay_to_so === 'Hộ chiếu số', 'Hộ chiếu → "Hộ chiếu số"', d5.gd_giay_to_so)
ok(d5.csh_giay_to_so === 'Thẻ Căn cước công dân số', 'Căn cước công dân → "Thẻ Căn cước công dân số"', d5.csh_giay_to_so)
for (const ma of ['QD_GD_CSH', 'QD_GD_HDTV', 'QD_GD_HDQT', 'BBH_HDTV', 'BBH_HDQT'])
  ok(doc(ma).includes('{gd_giay_to_so}') && !/Căn cước công dân số:|Số căn cước/.test(doc(ma)), `${ma}: loại giấy tờ lấy theo người`)

// 6
const { than } = dungThan('#c A\n~\n#c B\n~\n~\n#c C')
ok((than.match(/w:line="120" w:lineRule="exact"/g) || []).length === 1, '"~" đơn = khoảng nhỏ 6pt')
ok((than.match(/<w:p\/>/g) || []).length === 2, '"~ ~" = 2 dòng trống đủ cao (chỗ ký)')
const { than: dau } = dungThan('::cot 45/55\n#cb CTY\n||\n#cb QUỐC HIỆU\n==\n#c Số: 01\n||\n#ci ngày\n::')
ok((dau.match(/<w:tr>/g) || []).length === 2, 'đầu trang chia 2 hàng → "Số" và ngày tháng thẳng hàng')
for (const ma of ['GGT', 'QD_GD_CSH', 'BBH_HDTV', 'UQ_THUE', 'KHTS', 'SSKT'].filter(m => /#l Số|#c Số/.test(doc(m))))
  ok(/^==$/m.test(doc(ma)), `${ma}: đầu trang 2 hàng`)

// 8
ok(inTyLe(200 / 3) === '66,667%', 'tỷ lệ 66,667%', inTyLe(200 / 3))
ok(inTyLe(100 / 3) === '33,333%', 'tỷ lệ 33,333%', inTyLe(100 / 3))
ok(inTyLe(50) === '50%', 'tỷ lệ tròn 50%', inTyLe(50))
ok(inTyLe(12.5) === '12,5%', 'tỷ lệ 12,5%', inTyLe(12.5))
const d8 = chuanBiDuLieu({ loai_hinh: '2tv', cty: { von_dieu_le: 3e9 }, thanh_vien: [nguoi('X', 'Căn cước', { von_gop: 2e9 }), nguoi('Y', 'Căn cước', { von_gop: 1e9 })] })
ok(d8.thanh_vien.map(v => v.ty_le).join('|') === '66,667%|33,333%', '2TV: tỷ lệ góp vốn 66,667% / 33,333%', d8.thanh_vien.map(v => v.ty_le).join('|'))
ok(d8.huong_loi.length === 2, 'chủ sở hữu hưởng lợi vẫn nhận đủ người ≥ 25% (so số, không đọc chuỗi có dấu phẩy)', d8.huong_loi.length)
const d8b = chuanBiDuLieu({ loai_hinh: 'cp', cty: { von_dieu_le: 3e8, menh_gia: 10000 }, co_dong: [nguoi('P', 'Căn cước', { so_co_phan: 24990 }), nguoi('Q', 'Căn cước', { so_co_phan: 5010 })] })
ok(d8b.co_dong[0].ty_le === '83,3%' && d8b.huong_loi.length === 1, 'CP: 83,3% và cổ đông 16,7% không vào hưởng lợi', d8b.co_dong.map(v => v.ty_le).join('|'))

// 9
const duLieu = chuanBiDuLieu({ loai_hinh: '2tv', cty: { von_dieu_le: 3e9 }, dai_dien: nguoi('Nguyễn Văn Đại', 'Căn cước'),
  thanh_vien: [nguoi('Trần Thị Một', 'Căn cước', { von_gop: 2e9, chu_tich: true }), nguoi('Lê Văn Hai', 'Căn cước', { von_gop: 1e9 })] })
const hd = dongHuongDan('so', '2tv', duLieu)
const mau6 = hd.ds.find(x => x.ma === 'MAU6')
ok(mau6?.hoTen.join('|') === 'TRẦN THỊ MỘT|LÊ VĂN HAI|NGUYỄN VĂN ĐẠI', 'Mẫu 6: các thành viên + người đại diện ký', mau6?.hoTen.join('|'))
ok(hd.luuY.length > 0, 'hướng dẫn có phần lưu ý in')
const hdThue = dongHuongDan('thue', '2tv', duLieu)
ok(hdThue.ds.find(x => x.ma === 'QD_GD_HDTV')?.hoTen[0] === 'TRẦN THỊ MỘT', 'QĐ bổ nhiệm (HĐTV): Chủ tịch HĐTV ký')
ok(nguonHuongDanInKy('so', '2tv', { duLieu }).includes('Họ tên'), 'tờ hướng dẫn Word có cột họ tên')
ok(!nguonHuongDanInKy('so', '2tv').includes('Họ tên'), 'chưa có dữ liệu thì không in cột họ tên trống')

console.log(`${dat} đạt, ${hong} hỏng`)
process.exit(hong ? 1 : 0)
