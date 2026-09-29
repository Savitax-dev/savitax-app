// Kiểm quy tắc đặt tên và cây thư mục file tờ khai.
//   node scripts/test-tokhai-thumuc.mjs
//
// Chỉ kiểm phần TÍNH TÊN (thuần), không đụng đĩa — phần ghi đĩa phải thử trên trình duyệt thật.
import {
  chuanHoaTen, laCungThuMuc, tachKy, tenFileToKhai, tenFileThongBao,
  duongDanToKhai, duongDanThongBao, soLanBoSung, hauToBoSung,
} from '../lib/tokhaiThuMuc.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

console.log('So tên thư mục (bỏ dấu, bỏ khoảng trắng, không phân biệt hoa thường):')
kiem('THÔNG BÁO CHẤP NHẬN ≡ TB CHẤP NHẬN', laCungThuMuc('TB CHẤP NHẬN', 'THÔNG BÁO CHẤP NHẬN'), true)
kiem('BẢNG KÊ ≡ BẢNG KÊ MUA VÀO BÁN RA', laCungThuMuc('BẢNG KÊ MUA VÀO BÁN RA', 'BẢNG KÊ'), true)
kiem('TỜ KHAI THUẾ ≡ to khai thue', laCungThuMuc('to khai thue', 'TỜ KHAI THUẾ'), true)
kiem('đ và d coi như một', chuanHoaTen('Đơn') === chuanHoaTen('Don'), true)
kiem('không nhận nhầm hai thư mục khác nghĩa', laCungThuMuc('TỜ KHAI THUẾ', 'TB CHẤP NHẬN'), false)

console.log('')
console.log('Tách kỳ:')
kiem('Q2.2026', tachKy('Q2.2026'), { ky: 'Q2', nam: '2026', laNam: false })
kiem('T09.2026', tachKy('T09.2026'), { ky: 'T09', nam: '2026', laNam: false })
kiem('NAM.2026', tachKy('NAM.2026'), { ky: 'NAM', nam: '2026', laNam: true })
kiem('PS.2026-07-13', tachKy('PS.2026-07-13'), { ky: 'PS0713', nam: '2026', laNam: false, laPhatSinh: true })
kiem('chuỗi lạ → null', tachKy('linh tinh'), null)

console.log('')
console.log('Tên file:')
kiem('tờ khai GTGT quý 2',
  tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'PAPERARTVIET' }),
  'TK_GTGT_Q2.2026_PAPERARTVIET.xml')
kiem('tờ khai TNCN tháng 9',
  tenFileToKhai({ sacThue: 'TNCN', periodCode: 'T09.2026', maKH: 'ZENIS' }),
  'TK_TNCN_T09.2026_ZENIS.xml')
kiem('thông báo TIẾP NHẬN → TBTN',
  tenFileThongBao({ loaiThongBao: 'tiep_nhan', sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'ZENIS' }),
  'TBTN_GTGT_Q2.2026_ZENIS.xml')
kiem('thông báo CHẤP NHẬN → TBCN',
  tenFileThongBao({ loaiThongBao: 'xac_nhan_nop', sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'ZENIS' }),
  'TBCN_GTGT_Q2.2026_ZENIS.xml')

let batLoi = false
try { tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: null }) } catch { batLoi = true }
kiem('THIẾU MÃ KH thì báo lỗi, không tự bịa tên', batLoi, true)

console.log('')
console.log('Đường dẫn thư mục:')
kiem('tờ khai quý',
  duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'ZENIS' }),
  ['BAOCAOTHUE_Q2_2026_ZENIS', 'TỜ KHAI THUẾ'])
kiem('thông báo quý',
  duongDanThongBao({ periodCode: 'Q2.2026', maKH: 'ZENIS' }),
  ['BAOCAOTHUE_Q2_2026_ZENIS', 'THÔNG BÁO CHẤP NHẬN'])
// Kỳ NĂM cũng là một thư mục kỳ ngang hàng, bên trong đúng hai thư mục con như mọi kỳ khác.
// Bỏ hẳn tầng chia theo loại tờ khai: tên file đã mang sẵn sắc thuế nên không đụng nhau.
kiem('quyết toán năm',
  duongDanToKhai({ periodCode: 'NAM.2026', maKH: 'ZENIS' }),
  ['BỘ BÁO CÁO TÀI CHÍNH_2026_ZENIS', 'TỜ KHAI THUẾ'])
kiem('thông báo của kỳ năm',
  duongDanThongBao({ periodCode: 'NAM.2026', maKH: 'ZENIS' }),
  ['BỘ BÁO CÁO TÀI CHÍNH_2026_ZENIS', 'THÔNG BÁO CHẤP NHẬN'])
kiem('kỳ năm có CÙNG SỐ TẦNG với kỳ quý',
  duongDanToKhai({ periodCode: 'NAM.2026', maKH: 'ZENIS' }).length
    === duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'ZENIS' }).length, true)
kiem('hai sắc thuế khác nhau của cùng kỳ năm KHÔNG đụng tên',
  tenFileToKhai({ sacThue: 'TNDN', periodCode: 'NAM.2026', maKH: 'ZENIS' })
    === tenFileToKhai({ sacThue: 'TNCN', periodCode: 'NAM.2026', maKH: 'ZENIS' }), false)

console.log('')
console.log('Đối chiếu với BỘ FILE THẬT anh gửi (THỊNH PHÁT quý 1/2026):')
kiem('thư mục tờ khai',
  duongDanToKhai({ periodCode: 'Q1.2026', maKH: 'THINHPHAT' }),
  ['BAOCAOTHUE_Q1_2026_THINHPHAT', 'TỜ KHAI THUẾ'])
kiem('thư mục thông báo',
  duongDanThongBao({ periodCode: 'Q1.2026', maKH: 'THINHPHAT' }),
  ['BAOCAOTHUE_Q1_2026_THINHPHAT', 'THÔNG BÁO CHẤP NHẬN'])
kiem('tên file tờ khai GTGT',
  tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q1.2026', maKH: 'THINHPHAT' }),
  'TK_GTGT_Q1.2026_THINHPHAT.xml')
kiem('tên file thông báo chấp nhận TNCN',
  tenFileThongBao({ loaiThongBao: 'xac_nhan_nop', sacThue: 'TNCN', periodCode: 'Q1.2026', maKH: 'THINHPHAT' }),
  'TBCN_TNCN_Q1.2026_THINHPHAT.xml')

// ── Tờ khai bổ sung ─────────────────────────────────────────────────────────
//
// Cùng kỳ, cùng sắc thuế, tờ khai BỔ SUNG trùng tên y hệt tờ khai chính thức. Trước đây nó rơi
// thành '_v2' — nhìn không biết là bản bổ sung hay bản tải trùng, mà đây là hai thứ khác hẳn nhau
// về nghiệp vụ. Anh chốt 29/09: mỗi lần bổ sung một thư mục BSL<n>.

console.log('')
console.log('Đọc số lần bổ sung từ bảng của cổng:')
kiem('Chính thức → 0', soLanBoSung({ loaiToKhai: 'Chính thức', lanBoSung: 0 }), 0)
kiem('Bổ sung lần 1', soLanBoSung({ loaiToKhai: 'Bổ sung', lanBoSung: 1 }), 1)
kiem('Bổ sung lần 2', soLanBoSung({ loaiToKhai: 'Bổ sung', lanBoSung: 2 }), 2)
// Cổng có dòng ghi 'Bổ sung' mà ô số lần để trống — không được rơi về chính thức, vì như vậy là
// bản bổ sung ghi đè lên bản chính thức.
kiem('Bổ sung mà số lần TRỐNG → coi là lần 1', soLanBoSung({ loaiToKhai: 'Bổ sung', lanBoSung: 0 }), 1)
kiem('không dấu vẫn nhận ra', soLanBoSung({ loaiToKhai: 'Bo sung', lanBoSung: 1 }), 1)
kiem('không có gì → 0', soLanBoSung(null), 0)
kiem('hậu tố', hauToBoSung(2), '_BSL2')
kiem('chính thức không có hậu tố', hauToBoSung(0), '')

console.log('')
console.log('Tờ khai bổ sung tách khỏi tờ khai chính thức:')
// Thư mục kỳ RIÊNG, cùng cấp với thư mục kỳ chính thức; bên trong vẫn đủ 3 thư mục con như mọi kỳ.
kiem('thư mục tờ khai bổ sung lần 1',
  duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }),
  ['BAOCAOTHUE_Q2_2026_VANLANG_BSL1', 'TỜ KHAI THUẾ'])
kiem('thông báo của bản bổ sung nằm trong CHÍNH thư mục kỳ bổ sung',
  duongDanThongBao({ periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }),
  ['BAOCAOTHUE_Q2_2026_VANLANG_BSL1', 'THÔNG BÁO CHẤP NHẬN'])
kiem('bổ sung lần 2 sang thư mục kỳ khác',
  duongDanToKhai({ periodCode: 'Q4.2025', maKH: 'VANLANG', boSung: 2 }),
  ['BAOCAOTHUE_Q4_2025_VANLANG_BSL2', 'TỜ KHAI THUẾ'])
kiem('thư mục bổ sung CÙNG CẤP với thư mục chính thức (cùng số tầng)',
  duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }).length
    === duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG' }).length, true)
kiem('chính thức KHÔNG đổi chỗ',
  duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 0 }),
  ['BAOCAOTHUE_Q2_2026_VANLANG', 'TỜ KHAI THUẾ'])

kiem('tên file bổ sung mang _BSL1',
  tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }),
  'TK_GTGT_Q2.2026_VANLANG_BSL1.xml')
kiem('thông báo bổ sung cũng mang _BSL1',
  tenFileThongBao({ loaiThongBao: 'xac_nhan_nop', sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }),
  'TBCN_GTGT_Q2.2026_VANLANG_BSL1.xml')
kiem('tên file chính thức KHÔNG đổi',
  tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'VANLANG' }),
  'TK_GTGT_Q2.2026_VANLANG.xml')

// Đây chính là thứ phải chặn: hai tờ khai khác nhau mà cùng đường dẫn + cùng tên.
const chinh = duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG' }).join('/')
  + '/' + tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'VANLANG' })
const bs1 = duongDanToKhai({ periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 }).join('/')
  + '/' + tenFileToKhai({ sacThue: 'GTGT', periodCode: 'Q2.2026', maKH: 'VANLANG', boSung: 1 })
kiem('bản chính thức và bản bổ sung KHÔNG còn đụng nhau', chinh === bs1, false)

console.log('')
console.log('Quyết toán năm bổ sung:')
kiem('kỳ năm bổ sung lần 1',
  duongDanToKhai({ periodCode: 'NAM.2025', maKH: 'VANLANG', boSung: 1 }),
  ['BỘ BÁO CÁO TÀI CHÍNH_2025_VANLANG_BSL1', 'TỜ KHAI THUẾ'])
kiem('thông báo của kỳ năm bổ sung lần 1',
  duongDanThongBao({ periodCode: 'NAM.2025', maKH: 'VANLANG', boSung: 1 }),
  ['BỘ BÁO CÁO TÀI CHÍNH_2025_VANLANG_BSL1', 'THÔNG BÁO CHẤP NHẬN'])

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
