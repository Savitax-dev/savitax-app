// Kiểm màn "Hồ sơ dữ liệu": đọc tờ khai trong bộ báo cáo + kiểm kê một năm (lib/phanTich/docHoSo.js, kiemKe.js).
//   node scripts/test-phantich-kiemke.mjs
//
// Cây thư mục GIẢ dựng trong bộ nhớ (không đụng ổ đĩa), tờ khai lấy từ file mẫu giả lập rồi đổi kỳ sang 2026.
import fs from 'node:fs'
import path from 'node:path'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import { docToKhaiCuaNam, vaiTroBangKe } from '../lib/phanTich/docHoSo.js'
import { kiemKeNam, cacKy, gomCay } from '../lib/phanTich/kiemKe.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

const MAU = fs.readFileSync(path.resolve('scripts/du-lieu-mau-phantich/ruiro-mau/0109999982_01GTGT_Q3-2023_L0.xml'), 'utf8')
const tkQuy = q => MAU.replace('<kyKKhai>3/2023</kyKKhai>', `<kyKKhai>${q}/2026</kyKKhai>`)
const tkThang = m => MAU.replace('<kieuKy>Q</kieuKy>', '<kieuKy>M</kieuKy>').replace('<kyKKhai>3/2023</kyKKhai>', `<kyKKhai>${String(m).padStart(2, '0')}/2026</kyKKhai>`)

let soLanMo = 0
const tep = (ten, noiDung = 'x', co = 100) => ({
  name: ten, kind: 'file',
  getFile: async () => ({ size: co, lastModified: 1761400000000, text: async () => { soLanMo++; return noiDung } }),
})
const tepChuaTai = ten => ({ name: ten, kind: 'file', getFile: async () => { throw new Error('chưa tải về máy') } })
const thu = (ten, ...cac) => ({ name: ten, kind: 'directory', async *entries() { for (const c of cac) yield [c.name, c] } })

const nam2026 = thu('2026',
  thu('1. HỢP ĐỒNG MUA VÀO_BÁN RA', tep('hd.pdf')),
  thu('2. HÓA ĐƠN MUA VÀO_BÁN RA',
    thu('QUÝ 1', thu('HĐ MUA VÀO', tep('a.xml')), thu('HĐ BÁN RA ( KPS )')),
    thu('QUÝ 3', thu('HĐ MUA VÀO', tep('b.xml')), thu('HĐ BÁN RA', tep('c.xml')))),
  thu('4. TỜ KHAI HẢI QUAN(kps)'),
  thu('6. LƯƠNG', thu('1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG', tep('Bang luong T7.xlsx'))),
  thu('7. BỘ BÁO CÁO',
    thu('BỘ BÁO CÁO THUẾ QUÝ_THÁNG',
      thu('BAOCAOTHUE -Q1', thu('TỜ KHAI THUẾ', tep('TK_GTGT_Q1.2026.xml', tkQuy(1))), thu('TB CHẤP NHẬN', tep('TBCN_Q1.xml', '<TBaoThueDTu/>')), thu('BẢNG KÊ', tep('BANG KE HOA DON CHU.xlsx'))),
      // Tên thư mục ghi Q2 nhưng tờ khai chỉ có PDF
      thu('BAOCAOTHUE -Q2', thu('BAO CAO THUE_PDF', tep('TK_Q2.pdf'))),
      // Thư mục bổ sung không thay cho bản chính thức
      thu('BAOCAOTHUE -Q2_BSL1', thu('TỜ KHAI THUẾ', tep('hong.xml', '<HSoThueDTu><rác')))),
    thu('BỘ BÁO CÁO TÀI CHÍNH NĂM')),
  thu('8. SỔ SÁCH KẾ TOÁN', thu('1. PHIẾU THU_PHIẾU CHI', tep('so quy.xlsx')), thu('8. SỔ CHI TIẾT CÁC TÀI KHOẢN', tep('sct.rar'), tepChuaTai('sct2.xlsx'))),
  thu('Tài liệu linh tinh', tep('x.docx')))

const kq = await quetCongTy(nam2026)
const quet = kq.nam[2026]

console.log('Đọc tờ khai trong bộ báo cáo (có bộ nhớ đệm):')
const kho = new Map()
const dem = { khoa: (t, l) => `${l}|${t.duongDan.join('\\')}\\${t.ten}|${t.co}|${t.sua}`, lay: async k => kho.get(k), ghi: async (k, v) => { kho.set(k, v) } }
const lan1 = await docToKhaiCuaNam(quet, { dem })
kiem('đọc được 1 tờ khai 01/GTGT Q1/2026', lan1.toKhai.map(t => [t.loai, t.maKy]), [['01/GTGT', 'Q1.2026']])
kiem('thông báo chấp nhận không bị coi là tờ khai, không báo lỗi', lan1.toKhai.length + lan1.loi.length, 2)
kiem('file tờ khai hỏng → vào danh sách lỗi', lan1.loi.map(l => l.tep.ten), ['hong.xml'])
const moLan1 = soLanMo
const lan2 = await docToKhaiCuaNam(quet, { dem })
kiem('mở lần 2: tờ khai + thông báo lấy từ đệm, chỉ file lỗi đọc lại', [lan2.tuDem, soLanMo - moLan1], [2, 1])

console.log('\nCông ty khai QUÝ, hôm nay 26/10/2026 (Q3 đã hết nhưng chưa tới hạn 31/10):')
const kk = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'quy', homNay: '2026-10-26', loiDoc: lan1.loi.length })
const luoi = ten => kk.luoi.find(l => l.nhan === ten).o.map(x => x.tt)
kiem('01/GTGT: Q1 có (nội dung), Q2 có (PDF), Q3 chờ hạn, Q4 chưa tới', luoi('Tờ khai 01/GTGT'), ['co', 'co', 'cho', 'chua_toi'])
kiem('Q2 ghi chú chưa đọc được nội dung', kk.luoi[0].o[1].ghiChu, 'có file trong thư mục kỳ, chưa đọc được nội dung')
kiem('Thông báo chấp nhận: Q2 thiếu', luoi('Thông báo chấp nhận'), ['co', 'thieu', 'cho', 'chua_toi'])
kiem('HĐ mua vào (file XML): Q1 có, Q2 thiếu, Q3 có', luoi('HĐ mua vào (file XML)'), ['co', 'thieu', 'co', 'chua_toi'])
kiem('không còn dòng đòi file hóa đơn bán ra', kk.luoi.some(l => l.nhan.includes('HĐ bán ra')), false)
const d = ma => kk.dong.find(x => x.ma === ma)
kiem('bộ báo cáo thuế → Thiếu kỳ', d('bo_bao_cao_thue').trangThai, 'thieu_ky')
kiem('hải quan (kps)', d('hai_quan').trangThai, 'kps')
kiem('hợp đồng chỉ ghi nhận', d('hop_dong').trangThai, 'ghi_nhan')
kiem('BHXH không có thư mục → xám, không đỏ', d('bhxh').trangThai, 'khong_co')
kiem('BCTC năm trống khi chưa hết năm → không báo', d('bo_bao_cao_bctc').trangThai, 'ghi_nhan')
const soSach = kk.dong.filter(x => x.ma === 'so_sach')
kiem('sổ sách tách theo thư mục con', soSach.map(x => [x.ten.split(' \\ ')[1], x.trangThai, x.canXem]), [['1. PHIẾU THU_PHIẾU CHI', 'da_co', 0], ['8. SỔ CHI TIẾT CÁC TÀI KHOẢN', 'can_xem', 2]])
kiem('thư mục lạ được liệt kê', kk.dong.filter(x => x.trangThai === 'la').map(x => x.ten), ['Tài liệu linh tinh'])
kiem('ô tổng: file cần xem = .rar + chưa tải + XML hỏng', kk.oTong.canXem, 3)
kiem('ô tổng: thiếu kỳ có kèm tên ô', kk.oTong.thieuO.includes('Thông báo chấp nhận Q2'), true)
kiem('tóm tắt tờ khai đọc được', kk.toKhaiTom, ['01/GTGT Q1'])
kiem('không cảnh báo kỳ khai (thư mục quý, hồ sơ quý)', kk.canhBao.some(c => c.includes('tick nhầm')), false)

console.log('\nCùng thư mục, hôm nay 05/11/2026 (Q3 đã quá hạn):')
const kk2 = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'quy', homNay: '2026-11-05' })
kiem('01/GTGT Q3 → thiếu', kk2.luoi[0].o.map(x => x.tt), ['co', 'co', 'thieu', 'chua_toi'])

console.log('\nHợp đồng bắt đầu 05/2026:')
const kk3 = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'quy', homNay: '2026-11-05', batDau: '2026-05-10' })
kiem('Q1 ngoài hợp đồng, Q2 vẫn phải có', kk3.luoi.find(l => l.nhan === 'Bảng kê cổng HĐĐT — bán ra').o.map(x => x.tt), ['ngoai_hd', 'thieu', 'thieu', 'chua_toi'])

console.log('\nHồ sơ công ty ghi khai THÁNG nhưng thư mục + tờ khai theo quý (tick nhầm):')
const kk4 = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'thang', homNay: '2026-10-26' })
kiem('cảnh báo có thể tick nhầm', kk4.canhBao.some(c => c.includes('tick nhầm')), true)
kiem('lưới xếp theo tháng: T1–T9 thiếu (T9 hạn 20/10 đã qua), T10–T12 chưa tới', kk4.luoi[0].o.map(x => x.tt),
  [...Array(9).fill('thieu'), 'chua_toi', 'chua_toi', 'chua_toi'])
const kk4b = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'thang', homNay: '2026-10-15' })
kiem('hôm nay 15/10: T9 chưa tới hạn 20/10 → chờ', kk4b.luoi[0].o[8].tt, 'cho')

console.log('\nBảng kê (quy trình 26/10/2026: bán ra chỉ cần bảng kê cổng; mua vào cần bảng kê cổng + XML):')
const BK = [
  { mau: 'cong', chieu: 'mua_vao', thang: ['2026-01', '2026-02', '2026-03'] },
  { mau: 'cong', chieu: 'ban_ra', thang: ['2026-07', '2026-08', '2025-09'] },
  { mau: 'pm_quantri', chieu: 'mua_vao', kyThuMuc: { ma: 'Q1', nam: 2026 }, thang: ['2025-12', '2026-01'] },
  // không nằm trong thư mục kỳ → kỳ theo tháng nhiều hóa đơn nhất (có lẫn 2 hóa đơn T3 kê khai muộn)
  { mau: 'pm_quantri', chieu: 'ban_ra', kyThuMuc: null, thang: ['2026-03', '2026-04'], soTheoThang: { '2026-03': 2, '2026-04': 50 } },
]
const kb = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'quy', homNay: '2026-11-05', bangKe: BK })
const lb = ten => kb.luoi.find(l => l.nhan === ten).o
kiem('cổng mua vào: Q1 đủ 3 tháng, Q2–Q3 thiếu', lb('Bảng kê cổng HĐĐT — mua vào').map(x => x.tt), ['co', 'thieu', 'thieu', 'chua_toi'])
kiem('cổng bán ra: Q1 không phát sinh (thư mục HĐ BÁN RA (KPS)), Q3 thiếu một phần T9 — T9 năm trước không tính', lb('Bảng kê cổng HĐĐT — bán ra').map(x => [x.tt, x.ghiChu || '']),
  [['kps', ''], ['thieu', 'thiếu T4, T5, T6'], ['mot_phan', 'thiếu T9'], ['chua_toi', '']])
kiem('phần mềm: Q1 có mua vào thiếu bán ra, Q2 có bán ra thiếu mua vào (kỳ theo tháng nhiều HĐ nhất)', lb('Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)').slice(0, 3).map(x => [x.tt, x.ghiChu || '']),
  [['mot_phan', 'thiếu bán ra'], ['mot_phan', 'thiếu mua vào'], ['thieu', '']])
const nhomHd = gomCay(kb.dong).find(n => n.loai === 'nhom' && n.ten === '2. HÓA ĐƠN MUA VÀO_BÁN RA')
kiem('hóa đơn dạng cây: con theo thư mục quý/tháng, nhóm → Thiếu kỳ khi bảng kê cổng thiếu', [nhomHd.con.map(c => c.d.tenCon), nhomHd.trangThai], [['QUÝ 1', 'QUÝ 3'], 'thieu_ky'])
kiem('… từng thư mục con vẫn giữ trạng thái riêng (không bị đè Thiếu kỳ)', nhomHd.con.map(c => c.d.trangThai), ['da_co', 'da_co'])
kiem('… dòng cha có tóm tắt XML mua vào', nhomHd.moTa.startsWith('XML mua vào'), true)
kiem('ô tổng Thiếu kỳ đếm theo thư mục cấp 1 (hóa đơn + bộ báo cáo)', kb.oTong.thieuKy, 2)
const tk0 = [{ loai: '01/GTGT', ky: { loai: 'Q', so: 2, nam: 2026 }, maKy: 'Q2.2026', lanBoSung: 0, chiTieu: { 23: 0, 34: 7000000 } }]
const kz = kiemKeNam(quet, tk0, { kyKhai: 'quy', homNay: '2026-11-05', bangKe: BK })
kiem('tờ khai Q2 ghi [23] = 0 → không đòi bảng kê / XML mua vào Q2', [kz.luoi.find(l => l.nhan === 'Bảng kê cổng HĐĐT — mua vào').o[1].tt, kz.luoi.find(l => l.nhan === 'HĐ mua vào (file XML)').o[1].tt], ['kps', 'kps'])
kiem('… và bảng kê phần mềm Q2 chỉ cần bán ra → đủ', kz.luoi.find(l => l.nhan === 'Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)').o[1].tt, 'co')
// HONGDUC (anh chốt 30/10): "BẢNG KÊ MV-BR.xlsx" ở BAOCAOTHUE_Q2\BẢNG KÊ (mục 7) là bảng kê KÈM TỜ KHAI, không phải bảng kê cổng
// → docHoSo trả mau 'pm_kem_tk'. Bảng kê cổng chỉ là file ở 2. HÓA ĐƠN (ở đây có Q3).
const BKH = [vaiTroBangKe({ mau: 'cong', chieu: 'mua_vao', kyThuMuc: { ma: 'Q2', nam: 2026 }, thang: ['2026-04', '2026-05', '2026-06'], soTheoThang: { '2026-05': 3 } }, true),
  vaiTroBangKe({ mau: 'cong', chieu: 'ban_ra', kyThuMuc: { ma: 'Q2', nam: 2026 }, thang: ['2026-04', '2026-05', '2026-06'], soTheoThang: { '2026-05': 3 } }, true),
  vaiTroBangKe({ mau: 'cong', chieu: 'mua_vao', kyThuMuc: null, thang: ['2026-07', '2026-08', '2026-09'] }, false)]
const kh = kiemKeNam(quet, lan1.toKhai, { kyKhai: 'quy', homNay: '2026-11-05', bangKe: BKH }).luoi
const oKh = ten => kh.find(l => l.nhan === ten).o.slice(1, 3).map(x => x.tt)
kiem('MV-BR mục 7 Q2 → "Bảng kê kèm tờ khai" Q2 có, Q3 thiếu', oKh('Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)'), ['co', 'thieu'])
kiem('… và KHÔNG làm xanh "Bảng kê cổng HĐĐT — mua vào" Q2; Q3 (file ở 2. HÓA ĐƠN) có', oKh('Bảng kê cổng HĐĐT — mua vào'), ['thieu', 'co'])

console.log('\nThiếu hẳn thư mục bắt buộc:')
const kk5 = kiemKeNam({ nam: 2026, thuMuc: [{ ten: '6. LƯƠNG', ma: 'luong', kps: false }], vung: { luong: [] } }, [], { kyKhai: 'quy', homNay: '2026-10-26' })
kiem('hóa đơn, bộ báo cáo → Chưa có thư mục (đỏ)', [kk5.dong.find(x => x.ma === 'hoa_don').trangThai, kk5.dong.find(x => x.ma === 'bo_bao_cao').trangThai], ['chua_co', 'chua_co'])
kiem('lương thư mục trống', kk5.dong.find(x => x.ma === 'luong').trangThai, 'trong')

console.log('\nBảng dạng cây (gom dòng cùng thư mục cha):')
const cay = gomCay(kk.dong)
const nhomBbc = cay.find(n => n.loai === 'nhom' && n.ten === '7. BỘ BÁO CÁO')
kiem('7. BỘ BÁO CÁO thành 1 nhóm, con: thuế theo kỳ + BCTC năm', nhomBbc.con.map(c => c.d.tenCon), ['Báo cáo thuế theo kỳ', 'Báo cáo tài chính năm'])
kiem('trạng thái nhóm = con nặng nhất (Thiếu kỳ)', nhomBbc.trangThai, 'thieu_ky')
const nhomSs = cay.find(n => n.loai === 'nhom' && n.ten === '8. SỔ SÁCH KẾ TOÁN')
kiem('8. SỔ SÁCH: cộng file + file cần xem của con', [nhomSs.con.length, nhomSs.soFile, nhomSs.canXem, nhomSs.trangThai], [2, 3, 2, 'can_xem'])
kiem('thư mục chỉ có một thư mục con vẫn là dòng đơn (6. LƯƠNG)', cay.find(n => n.loai === 'don' && n.d.ma === 'luong') != null, true)
kiem('không mất dòng nào khi gom', cay.reduce((s, n) => s + (n.loai === 'nhom' ? n.con.length : 1), 0), kk.dong.length)

console.log('\nKỳ và hạn nộp:')
kiem('tháng 12 hạn 20/01 năm sau', cacKy(2026, 'thang')[11].han, '2027-01-20')
kiem('quý 4 hạn 31/01 năm sau', cacKy(2026, 'quy')[3].han, '2027-01-31')
kiem('quý 1 hạn 30/04', cacKy(2026, 'quy')[0].han, '2026-04-30')
kiem('tháng 2/2028 có 29 ngày', cacKy(2028, 'thang')[1].den, '2028-02-29')

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
