// Kiểm bộ đọc tiêu đề mail "bộ báo cáo thuế" — dữ liệu giả, không đụng Supabase.
//
//   node scripts/test-mail-baocao.mjs
//
// Vì sao phải có bộ kiểm riêng: tính năng này TICK HỘ NGƯỜI. Tick nhầm công ty là báo "đã gửi báo
// cáo cho khách" trong khi chưa gửi — không ai phát hiện ra bằng mắt, vì dấu tick tự động trông y
// hệt dấu tick tay. Nên mọi ca mơ hồ phải ra KHÔNG TICK, và bộ kiểm canh đúng chuyện đó.
//
// Tiêu đề dưới đây lấy nguyên văn từ ảnh anh gửi ngày 14/10/2026.
import { docTieuDe, docKy, kyGuiMail, timViecGuiMail, khopCongTy, khopMaKH, docMail, laTraLoi }
  from '../lib/mailBaoCao.js'

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log(`  ✗ ${ten}\n      ra      ${a}\n      đáng lẽ ${b}`) }
}
const dung = (ten, dk, them) => {
  if (dk) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log('  ✗ ' + ten + (them ? '  → ' + them : '')) }
}

console.log('\n[1] Tách tiêu đề thật — ba kiểu phân cách khác nhau:')
const t1 = docTieuDe('CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ Q3.2026')
kiem('dấu " - " · tên công ty', t1.tenTruoc, 'CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY')
kiem('dấu " - " · kỳ', t1.ky, { loai: 'quy', so: 3, nam: 2026 })

const t2 = docTieuDe('STUDIO BY DREW_BÁO CÁO THUẾ QUÝ 3/2026')
kiem('dấu "_" · tên công ty', t2.tenTruoc, 'STUDIO BY DREW')
kiem('dấu "_" · kỳ', t2.ky, { loai: 'quy', so: 3, nam: 2026 })

const t3 = docTieuDe('CÔNG TY TNHH TM DV ĐẦU TƯ TỔNG HỢP TƯỜNG VY_BÁO CÁO THUẾ THÁNG 9/2026')
kiem('kỳ tháng', t3.ky, { loai: 'thang', so: 9, nam: 2026 })

console.log('')
console.log('[2] Các dạng ghi kỳ:')
const k = (s) => docKy(s)
kiem('"Q3.2026"',      k('BÁO CÁO THUẾ Q3.2026'),      { loai: 'quy',   so: 3, nam: 2026 })
kiem('"QUÝ 3/2026"',   k('BÁO CÁO THUẾ QUÝ 3/2026'),   { loai: 'quy',   so: 3, nam: 2026 })
kiem('"THÁNG 12/2025"', k('BÁO CÁO THUẾ THÁNG 12/2025'), { loai: 'thang', so: 12, nam: 2025 })
kiem('"T9/2026"',      k('BÁO CÁO THUẾ T9/2026'),      { loai: 'thang', so: 9, nam: 2026 })
kiem('"09/2026" trần', k('BÁO CÁO THUẾ 09/2026'),      { loai: 'thang', so: 9, nam: 2026 })
kiem('BCTC "NĂM 2025"', k('BÁO CÁO TÀI CHÍNH NĂM 2025'), { loai: 'nam', so: null, nam: 2025 })
kiem('không có kỳ → null', k('BÁO CÁO THUẾ'), null)

console.log('')
console.log('[3] Thiếu năm thì suy từ NGÀY GỬI, và chỉ nhận kỳ ở quá khứ:')
// Mail tháng 12 thường gửi đầu tháng 1 năm sau — đoán bừa là sai nguyên một năm.
const g = (s, ngay) => docTieuDe(s, new Date(ngay)).ky
kiem('"QUÝ 3" gửi 14/10/2026 → Q3/2026', g('X - BÁO CÁO THUẾ QUÝ 3', '2026-10-14'), { loai: 'quy', so: 3, nam: 2026 })
kiem('"THÁNG 12" gửi 05/01/2027 → T12/2026', g('X - BÁO CÁO THUẾ THÁNG 12', '2027-01-05'), { loai: 'thang', so: 12, nam: 2026 })
kiem('"THÁNG 9" gửi 14/10/2026 → T9/2026', g('X - BÁO CÁO THUẾ THÁNG 9', '2026-10-14'), { loai: 'thang', so: 9, nam: 2026 })

console.log('')
console.log('[4] Kỳ → tháng phải tick (chỗ sai thì tick vào ô trống năm cũ):')
kiem('tháng 9/2026 → tick T10/2026', kyGuiMail({ loai: 'thang', so: 9, nam: 2026 }), { year: 2026, month: 10 })
kiem('THÁNG 12/2026 → tick T1/2027 (sang NĂM SAU)', kyGuiMail({ loai: 'thang', so: 12, nam: 2026 }), { year: 2027, month: 1 })
kiem('Quý 3/2026 → tick T10/2026', kyGuiMail({ loai: 'quy', so: 3, nam: 2026 }), { year: 2026, month: 10 })
kiem('QUÝ 4/2026 → tick T1/2027 (sang NĂM SAU)', kyGuiMail({ loai: 'quy', so: 4, nam: 2026 }), { year: 2027, month: 1 })
kiem('Quý 1/2026 → tick T4/2026', kyGuiMail({ loai: 'quy', so: 1, nam: 2026 }), { year: 2026, month: 4 })
kiem('Quý 2/2026 → tick T7/2026', kyGuiMail({ loai: 'quy', so: 2, nam: 2026 }), { year: 2026, month: 7 })

console.log('')
console.log('[5] Thư trả lời / chuyển tiếp KHÔNG tính là lượt gửi:')
dung('"Re: ..." → bỏ qua', laTraLoi('Re: CÔNG TY X - BÁO CÁO THUẾ Q3.2026'))
dung('"FW: ..." → bỏ qua', laTraLoi('FW: CÔNG TY X - BÁO CÁO THUẾ Q3.2026'))
dung('"Fwd: ..." → bỏ qua', laTraLoi('Fwd: CÔNG TY X - BÁO CÁO THUẾ Q3.2026'))
dung('thư gốc → KHÔNG bỏ qua', !laTraLoi('CÔNG TY X - BÁO CÁO THUẾ Q3.2026'))

console.log('')
console.log('[6] Khớp công ty — mơ hồ là KHÔNG tick:')
const dsCty = [
  { id: 'c1', name: 'CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY', client_code: 'QQ', tax_code: '0311111111', report_type: 'quarterly' },
  { id: 'c2', name: 'CÔNG TY TNHH THƯƠNG MẠI TAM', client_code: 'TAM', tax_code: '0322222222', report_type: 'quarterly' },
  { id: 'c3', name: 'CÔNG TY TNHH THƯƠNG MẠI TAM', client_code: 'TAM2', tax_code: '0333333333', report_type: 'monthly' },
]
dung('tên trùng khít → khớp đúng công ty',
  khopCongTy('CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY', dsCty).client?.id === 'c1')
dung('thừa loại hình pháp lý vẫn khớp (TNHH/CÔNG TY bị bỏ qua)',
  khopCongTy('CTY ĐẦU TƯ QQ PROPERTY', dsCty).client?.id === 'c1')
dung('HAI công ty cùng tên → KHÔNG khớp, trả lý do',
  khopCongTy('CÔNG TY TNHH THƯƠNG MẠI TAM', dsCty).client === null,
  JSON.stringify(khopCongTy('CÔNG TY TNHH THƯƠNG MẠI TAM', dsCty).lyDo))
dung('tên lạ → không khớp', khopCongTy('CÔNG TY KHÔNG CÓ THẬT ABC XYZ', dsCty).client === null)
dung('tên quá ngắn → không khớp', khopCongTy('ABC', dsCty).client === null)
// Ca thật: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TAM" rút gọn còn đúng "TAM" (3 ký tự) vì mọi từ còn
// lại đều là từ pháp lý. Lúc đó phải đòi trùng khít TOÀN BỘ tên, không được bỏ qua công ty.
const dsNgan = [
  { id: 'n1', name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TAM', client_code: 'TAM', tax_code: '0344444444', report_type: 'quarterly' },
  { id: 'n2', name: 'CÔNG TY TNHH DỊCH VỤ ABC XYZ LONG HƠN', client_code: 'ABC', tax_code: '0355555555', report_type: 'monthly' },
]
dung('tên riêng chỉ còn "TAM" → vẫn khớp nhờ trùng khít toàn bộ tên',
  khopCongTy('CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TAM', dsNgan).client?.id === 'n1',
  JSON.stringify(khopCongTy('CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TAM', dsNgan).lyDo))
dung('… nhưng thiếu một chữ thì KHÔNG khớp nữa (đòi khít tuyệt đối)',
  khopCongTy('CÔNG TY TNHH DỊCH VỤ TAM', dsNgan).client === null)

console.log('')
console.log('[7] Tìm việc trong danh mục THẬT (tên lấy từ task_definitions đang chạy):')
const DANH_MUC = [
  { id: 'm10', month: 10, report_type: 'monthly',   is_active: true, name: 'Gửi mail bộ báo cáo thuế tháng 9 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào+bán ra) (File XML+PDF)' },
  { id: 'q10', month: 10, report_type: 'quarterly', is_active: true, name: 'Gửi mail bộ báo cáo thuế Quý 3 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  { id: 'q7',  month: 7,  report_type: 'quarterly', is_active: true, name: 'Gửi mail bộ báo cáo thuế Quý (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  { id: 'q1',  month: 1,  report_type: 'quarterly', is_active: true, name: 'Gửi mail bộ báo cáo thuế Quý 4 (Tờ khai + Thông báo chấp nhận + Bảng kê mua vào + bán ra) (File XML+PDF)' },
  { id: 'x10', month: 10, report_type: 'monthly',   is_active: true, name: 'Gửi đề nghị thanh toán cho khách hàng tháng 10' },
]
const tim = (ky, rt) => timViecGuiMail(DANH_MUC, ky, rt)
dung('cty THÁNG, kỳ T9/2026 → đúng việc tháng 9',
  tim({ loai: 'thang', so: 9, nam: 2026 }, 'monthly').task?.id === 'm10')
dung('cty QUÝ, kỳ Q3/2026 → đúng việc Quý 3',
  tim({ loai: 'quy', so: 3, nam: 2026 }, 'quarterly').task?.id === 'q10')
dung('cty QUÝ, kỳ Q4/2026 → việc ở THÁNG 1 năm sau',
  tim({ loai: 'quy', so: 4, nam: 2026 }, 'quarterly').task?.id === 'q1')
// Việc tháng 7 trong danh mục thật tên là "Quý" KHÔNG CÓ SỐ.
dung('cty QUÝ, kỳ Q2/2026 → nhận việc "Quý" không số ở tháng 7',
  tim({ loai: 'quy', so: 2, nam: 2026 }, 'quarterly').task?.id === 'q7')
// Và việc không số đó KHÔNG được nhận bừa quý khác.
dung('việc "Quý" không số KHÔNG nhận bừa Q3',
  tim({ loai: 'quy', so: 3, nam: 2026 }, 'quarterly').task?.id !== 'q7')
dung('không lấy nhầm việc khác có chữ "tháng 10"',
  tim({ loai: 'thang', so: 9, nam: 2026 }, 'monthly').task?.id !== 'x10')
// Lỗ hổng thật của danh mục: KHÔNG có việc gửi mail Quý 1 ở tháng 4.
dung('kỳ Q1 → không có việc nào, trả lý do rõ ràng',
  tim({ loai: 'quy', so: 1, nam: 2026 }, 'quarterly').task === null,
  JSON.stringify(tim({ loai: 'quy', so: 1, nam: 2026 }, 'quarterly').lyDo))
dung('cty THÁNG nhưng kỳ là Quý → không khớp việc nào',
  tim({ loai: 'quy', so: 3, nam: 2026 }, 'monthly').task === null)

console.log('')
console.log('[8] Chạy trọn một lá mail:')
const chay = (tieuDe, ngay) => docMail({ tieuDe, ngayGui: ngay, dsCty, taskDefs: DANH_MUC })
const ok1 = chay('CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ Q3.2026', '2026-10-14')
dung('mail hợp lệ → ok', ok1.ok === true, JSON.stringify(ok1.lyDo))
dung('… đúng công ty', ok1.client?.id === 'c1')
dung('… đúng việc', ok1.task?.id === 'q10')
dung('… tick vào T10/2026', ok1.dich?.year === 2026 && ok1.dich?.month === 10)

const xau = [
  ['Re: CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ Q3.2026', 'thư trả lời'],
  ['CÔNG TY TNHH THƯƠNG MẠI TAM - BÁO CÁO THUẾ Q3.2026',          'hai công ty cùng tên'],
  ['CÔNG TY LẠ HOẮC KHÔNG CÓ - BÁO CÁO THUẾ Q3.2026',             'không có công ty'],
  ['CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ',              'không có kỳ'],
  ['CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - gửi anh file nhé',           'không có cụm BÁO CÁO'],
  ['BÁO CÁO THUẾ Q3.2026',                                         'không có tên công ty'],
  ['',                                                             'tiêu đề rỗng'],
]
for (const [tieuDe, vi] of xau) {
  const r = chay(tieuDe, '2026-10-14')
  dung('KHÔNG tick — ' + vi, r.ok === false && !!r.lyDo, JSON.stringify(r.lyDo))
}

console.log('')
console.log('[9] Kỳ lệch quá xa ngày gửi thì không tick:')
const xa = chay('CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ Q3.2020', '2026-10-14')
dung('Q3/2020 gửi năm 2026 → không tick', xa.ok === false, JSON.stringify(xa.lyDo))

console.log('')
console.log('[10] Không nổ với đầu vào rác:')
dung('null', docTieuDe(null).ky === null)
dung('số', docTieuDe(12345).ky === null)
dung('chuỗi dài toàn ký tự lạ', docTieuDe('###@@@!!!').ky === null)

console.log('')
console.log('[11] TÊN ĐỨNG SAU cụm "BÁO CÁO" — 3/6 lá mail thật viết kiểu này:')
// Đo thật trên hộp thư congnosavitax@gmail.com ngày 15/10/2026: hai nhân viên dùng hai quy ước
// ngược nhau. Chỉ đọc một phía là mất trắng một nửa số mail, mà lỗi đó IM LẶNG — người gửi rồi
// vẫn bị báo chưa làm.
const sau1 = docTieuDe('BÁO CÁO THUẾ _QUÝ 3.2026_KIMOANH')
kiem('lấy được tên ở phía sau', sau1.tenSau, 'KIMOANH')
kiem('và vẫn đọc đúng kỳ', sau1.ky, { loai: 'quy', so: 3, nam: 2026 })
const sau2 = docTieuDe('BÁO CÁO THUẾ QUÝ 3.2026 _HKD NGUYENTRONGDUC')
kiem('bỏ được chữ THUẾ và kỳ, còn lại phần tên/mã', sau2.tenSau, 'HKD NGUYENTRONGDUC')
const truoc1 = docTieuDe('HKD NGÔ THỊ THANH THẢO_BÁO CÁO THUẾ QUÝ 3/2026')
kiem('kiểu cũ (tên đứng trước) vẫn nguyên vẹn', truoc1.tenTruoc, 'HKD NGÔ THỊ THANH THẢO')

console.log('')
console.log('[12] Khớp theo MÃ KHÁCH HÀNG — đường duy nhất gỡ được ca trùng tên:')
// Hai HỘ KINH DOANH ĐỨC DESIGN khác MST nhưng TRÙNG KHÍT tên thương mại. Khớp theo tên thì vĩnh
// viễn mơ hồ; mã khách hàng phân biệt sạch sẽ.
const dsMa = [
  { id: 'd1', name: 'HỘ KINH DOANH ĐỨC DESIGN', client_code: 'NGUYENTRONGDUC', tax_code: '052095010595', report_type: 'quarterly' },
  { id: 'd2', name: 'HỘ KINH DOANH ĐỨC DESIGN', client_code: 'TRANTHIHOAKY',   tax_code: '075197009328', report_type: 'quarterly' },
  { id: 'd3', name: 'HỘ KINH DOANH NGUYỄN THỊ KIM OANH', client_code: 'KIMOANH', tax_code: '0366666666', report_type: 'quarterly' },
  { id: 'd4', name: 'CÔNG TY TNHH TAM ABC', client_code: 'TAM', tax_code: '0377777777', report_type: 'quarterly' },
]
dung('mã NGUYENTRONGDUC → đúng hộ thứ nhất', khopMaKH('HKD NGUYENTRONGDUC', dsMa).client?.id === 'd1')
dung('mã TRANTHIHOAKY → đúng hộ thứ hai', khopMaKH('HKD TRANTHIHOAKY', dsMa).client?.id === 'd2')
dung('hai hộ TRÙNG TÊN vẫn tách được bằng mã',
  khopMaKH('HKD NGUYENTRONGDUC', dsMa).client?.id !== khopMaKH('HKD TRANTHIHOAKY', dsMa).client?.id)
dung('mã dưới 4 ký tự KHÔNG nhận (dễ trùng chữ thường)', khopMaKH('BÁO CÁO TAM', dsMa).client === null)
dung('hai mã trong cùng tiêu đề → không dám chọn',
  khopMaKH('KIMOANH và TRANTHIHOAKY', dsMa).client === null)
dung('không có mã nào → trả null, không nổ', khopMaKH('abc def', dsMa).client === null)

console.log('')
console.log('[13] Sáu tiêu đề THẬT lấy từ hộp thư ngày 15/10/2026:')
const dsThat = [...dsMa,
  { id: 'd5', name: 'HỘ KINH DOANH NGÔ THỊ THANH THẢO', client_code: 'NTTTHAO', tax_code: '0388888888', report_type: 'quarterly' },
  { id: 'd6', name: 'HỘ KINH DOANH MÌ CAY SEOUL TÂN SƠN NHÌ 86', client_code: 'MICAY86', tax_code: '0399999999', report_type: 'quarterly' },
  { id: 'd7', name: 'HỘ KINH DOANH NGÔ ĐÌNH DŨNG', client_code: 'NDDUNG', tax_code: '0300000001', report_type: 'quarterly' },
]
for (const [tieuDe, mongDoi] of [
  ['HKD NGÔ THỊ THANH THẢO_BÁO CÁO THUẾ QUÝ 3/2026', 'd5'],
  ['HKD MÌ CAY SEOUL TÂN SƠN NHÌ 86_BÁO CÁO THUẾ QUÝ 3/2026', 'd6'],
  ['BÁO CÁO THUẾ _QUÝ 3.2026_KIMOANH', 'd3'],
  ['BÁO CÁO THUẾ QUÝ 3.2026 _HKD NGUYENTRONGDUC', 'd1'],
  ['BÁO CÁO THUẾ QUÝ 3.2026_HKD TRANTHIHOAKY', 'd2'],
  ['HKD NGÔ ĐÌNH DŨNG_BÁO CÁO THUẾ QUÝ 3.2026', 'd7'],
]) {
  const r = docMail({ tieuDe, ngayGui: '2026-10-15', dsCty: dsThat, taskDefs: DANH_MUC })
  dung(tieuDe.slice(0, 48), r.ok && r.client?.id === mongDoi,
    r.ok ? 'ra ' + r.client?.id : JSON.stringify(r.lyDo))
}
console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
