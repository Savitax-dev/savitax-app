// Kiểm luật bảng cấp bậc (lib/luong/capBac.js) — nhân viên NB tự thêm cấp (02/11/2026). Không đụng database.
//   node scripts/test-luong-cap-bac.mjs
import { chuanHoaCapBac, sinhMaCap } from '../lib/luong/capBac.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

const coSan = [
  { ma: 'CAP_1', ten: 'Cấp 1', nhom: 'nhan_vien', thu_tu: 1, luong_co_ban: 5100000, doanh_thu_toi_thieu: 23000000, luong_bhxh: null, mo_ta: 'Dưới 2 tháng' },
  { ma: 'CAP_8', ten: 'Cấp 8', nhom: 'nhan_vien', thu_tu: 8, luong_co_ban: 11273570, doanh_thu_toi_thieu: 51536320, luong_bhxh: 8551808, mo_ta: 'Trên 5 năm – dưới 6 năm' },
  { ma: 'CAP_A', ten: 'Cấp A', nhom: 'truong_phong', thu_tu: 11, luong_co_ban: 10000000, doanh_thu_toi_thieu: null, luong_bhxh: 8000000, mo_ta: 'Trưởng phòng' },
  { ma: 'CAP_C', ten: 'Cấp C', nhom: 'truong_phong', thu_tu: 13, luong_co_ban: 14400000, doanh_thu_toi_thieu: null, luong_bhxh: 9680000, mo_ta: 'Trưởng phòng' },
]

console.log('Sinh mã:')
const co = new Set(coSan.map(c => c.ma))
kiem('Cấp 9 → CAP_9', sinhMaCap('Cấp 9', co), 'CAP_9')
kiem('Cấp D → CAP_D', sinhMaCap('Cấp D', co), 'CAP_D')
kiem('cấp 10 (thường) → CAP_10', sinhMaCap('cấp 10', co), 'CAP_10')
kiem('Trưởng nhóm → CAP_TRU', sinhMaCap('Trưởng nhóm', co), 'CAP_TRU')
kiem('trùng mã có sẵn → CAP_X1', sinhMaCap('Cấp 1 mới', new Set(['CAP_1M', ...co])).startsWith('CAP_'), true)
kiem('tên toàn ký tự lạ → CAP_X1', sinhMaCap('***', co), 'CAP_X1')

console.log('\nThêm cấp nhân viên + trưởng phòng:')
const kq = chuanHoaCapBac([...coSan,
  { ma: null, ten: ' Cấp  9 ', nhom: 'nhan_vien', luong_co_ban: 12400000, doanh_thu_toi_thieu: 56000000, luong_bhxh: '9400000', mo_ta: 'Trên 6 năm' },
  { ten: 'Cấp D', nhom: 'truong_phong', luong_co_ban: 16000000 },
], 't')
kiem('không lỗi', kq.loi, undefined)
const c9 = kq.rows.find(r => r.ten === 'Cấp 9'), cD = kq.rows.find(r => r.ten === 'Cấp D')
kiem('Cấp 9: mã + thứ tự sau Cấp 8 + gọn khoảng trắng', [c9?.ma, c9?.thu_tu, c9?.luong_bhxh], ['CAP_9', 9, 9400000])
kiem('Cấp D: mã + thứ tự sau Cấp C', [cD?.ma, cD?.thu_tu, cD?.nhom, cD?.doanh_thu_toi_thieu], ['CAP_D', 14, 'truong_phong', null])
kiem('cấp cũ giữ nguyên mã + thứ tự', kq.rows.filter(r => coSan.some(c => c.ma === r.ma)).map(r => [r.ma, r.thu_tu]), coSan.map(c => [c.ma, c.thu_tu]))
const hai = chuanHoaCapBac([...coSan, { ten: 'Cấp 9', luong_co_ban: 1 }, { ten: 'Cấp 10', luong_co_ban: 2 }], 't')
kiem('thêm 2 cấp cùng lúc → thứ tự 9, 10', hai.rows.slice(-2).map(r => [r.ma, r.thu_tu]), [['CAP_9', 9], ['CAP_10', 10]])

console.log('\nChặn nhập sai:')
kiem('trùng tên (khác hoa thường)', !!chuanHoaCapBac([...coSan, { ten: 'cấp 8', luong_co_ban: 1 }]).loi, true)
kiem('thiếu tên', !!chuanHoaCapBac([...coSan, { ten: '  ', luong_co_ban: 1 }]).loi, true)
kiem('thiếu lương cơ bản', !!chuanHoaCapBac([...coSan, { ten: 'Cấp 9', luong_co_ban: null }]).loi, true)
kiem('lương âm', !!chuanHoaCapBac([...coSan, { ten: 'Cấp 9', luong_co_ban: -5 }]).loi, true)
kiem('mã lạ do trình duyệt tự đặt', !!chuanHoaCapBac([...coSan, { ma: 'cap-9; drop', ten: 'Cấp 9', luong_co_ban: 1 }]).loi, true)
kiem('danh sách rỗng', !!chuanHoaCapBac([]).loi, true)

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
