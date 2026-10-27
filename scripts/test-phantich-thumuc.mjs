// Kiểm nhận diện cây thư mục công ty — Phân hệ Soát xét báo cáo + Rủi ro thuế (lib/phanTich/thuMuc.js).
//   node scripts/test-phantich-thumuc.mjs
//
// Các tên thư mục dưới đây lấy đúng các BIẾN THỂ có thật trên Drive (khảo sát 11 công ty, 26/10/2026),
// đã bỏ tên công ty thật. Cây thư mục ở cuối là cây GIẢ dựng trong bộ nhớ, không đụng ổ đĩa.
import {
  namCuaThuMuc, tangTheoTen, laKhongPhatSinh, loaiThuMucNam, loaiThuMucBoBaoCao, kyCuaThuMuc,
  loaiThuMucKy, quyCuaThuMuc, loaiThuMucHoaDon, goiYTheoTen, quetCongTy, quetNam, laThuMucNamTheoCon, thangCuaTen, thangTuKhoangNgay, phanLoaiTepHoaDon,
} from '../lib/phanTich/thuMuc.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

console.log('Thư mục năm (đủ các kiểu đặt tên thật):')
for (const [ten, nam] of [['2025', 2025], ['2026', 2026], ['NĂM 2025', 2025], ['Năm 2026', 2026], ['2. NĂM 2025', 2025],
  ['1. Năm 2025', 2025], ['4. Năm 2025', 2025], ['2025 ', 2025], [' 2026', 2026], ['12. NĂM 2026', 2026]]) kiem(`"${ten}" → ${nam}`, namCuaThuMuc(ten), nam)
for (const ten of ['7. BỘ BÁO CÁO', '2. HỒ SƠ KẾ TOÁN', 'BỘ BÁO CÁO TÀI CHÍNH_2025_X', '2025-2026', '1925', 'QUÝ 1'])
  kiem(`"${ten}" không phải năm`, namCuaThuMuc(ten), null)

console.log('\nTầng nhân viên đã trỏ:')
kiem('thư mục công ty', tangTheoTen('3.THỊNH PHÁT'), 'cong_ty')
kiem('2. HỒ SƠ KẾ TOÁN', tangTheoTen('2. HỒ SƠ KẾ TOÁN'), 'ho_so')
kiem('thư mục năm trơn "2025"', tangTheoTen('2025'), 'nam')
kiem('"NĂM 2024"', tangTheoTen('NĂM 2024'), 'nam')

console.log('\nKhông phát sinh (4 cách viết):')
for (const ten of ['6. LƯƠNG (KPS)', '4. TỜ KHAI HẢI QUAN(kps)', 'HĐ BÁN RA ( KPS )', '5. BẢO HIỂM XÃ HỘI (ko phát sinh)', '9. BẢNG TÍNH GIÁ THÀNH(KPS)', 'X (không phát sinh)'])
  kiem(`"${ten}"`, laKhongPhatSinh(ten), true)
for (const ten of ['6. LƯƠNG', 'KPS TECH', '2. HÓA ĐƠN MUA VÀO_BÁN RA']) kiem(`"${ten}" không phải kps`, laKhongPhatSinh(ten), false)

console.log('\nThư mục cấp 1 trong năm:')
for (const [ten, ma] of [['1. HỢP ĐỒNG MUA VÀO_BÁN RA', 'hop_dong'], ['2. HÓA ĐƠN MUA VÀO_BÁN RA', 'hoa_don'],
  ['3. HỢP ĐỒNG KHÁC (HĐ VAY_THUÊ NHÀ_THUÊ XE_THUÊ KHO)', 'hop_dong_khac'], ['4. BỘ BÁO CÁO TỜ KHAI HẢI QUAN', 'hai_quan'],
  ['4. TỜ KHAI HẢI QUAN', 'hai_quan'], ['5. BẢO HIỂM XÃ HỘI', 'bhxh'], ['6. LƯƠNG (KPS)', 'luong'], ['7. BỘ BÁO CÁO', 'bo_bao_cao'],
  ['8. SỔ SÁCH KẾ TOÁN', 'so_sach'], ['9. SỔ PHỤ NGÂN HÀNG', 'so_phu'], ['10. GIẤY NỘP TIỀN', 'giay_nop_tien'],
  ['11. CÁC THÔNG BÁO_CÔNG VĂN (Nếu có)', 'cong_van'], ['12. HÌNH ẢNH ĐÍNH KÈM', 'hinh_anh']]) kiem(`"${ten}" → ${ma}`, loaiThuMucNam(ten).ma, ma)
kiem('"4. BỘ BÁO CÁO TỜ KHAI HẢI QUAN" KHÔNG phải bộ báo cáo', loaiThuMucNam('4. BỘ BÁO CÁO TỜ KHAI HẢI QUAN').ma !== 'bo_bao_cao', true)
kiem('tên lạ → null', loaiThuMucNam('Tài liệu linh tinh').ma, null)

console.log('\nTrong 7. BỘ BÁO CÁO:')
for (const [ten, ma] of [['BỘ BÁO CÁO THUẾ QUÝ_THÁNG', 'bao_cao_thue'], ['1. BỘ BÁO CÁO THUẾ QUÝ', 'bao_cao_thue'], ['BỘ BÁO CÁO THUẾ QUÝ', 'bao_cao_thue'],
  ['BỘ BÁO CÁO TÀI CHÍNH NĂM', 'bctc'], ['2. BỘ BÁO CÁO TÀI CHÍNH NĂM', 'bctc'], ['BỘ BCTC NĂM 2025 - QQ', 'bctc'], ['BAOCAOTAICHINH_THINHPHAT_2024', 'bctc'],
  ['BÁO CÁO KHÁC', 'khac'], ['3. BÁO CÁO KHÁC', 'khac']]) kiem(`"${ten}" → ${ma}`, loaiThuMucBoBaoCao(ten), ma)

console.log('\nThư mục kỳ (các kiểu đặt tên thật):')
const ky = t => { const k = kyCuaThuMuc(t); return k && [k.loai + k.so, k.nam, k.boSung] }
for (const [ten, mong] of [
  ['BAOCAOTHUE -Q1', ['Q1', null, 0]], ['BAOCAOTHUE - Q2', ['Q2', null, 0]], ['BAOCAOTHUE_Q3.2025_ANBINH', ['Q3', 2025, 0]],
  ['BAOCAOTHUE QUY 4_2025_SONG HUONG', ['Q4', 2025, 0]], ['BÁO CÁO THUẾ_QUÝ 1.2025', ['Q1', 2025, 0]], ['BAO CAO THUE_Q2.2026_BAU SEN', ['Q2', 2026, 0]],
  ['1. BAOCAOTHUE_HOANG ANH_QUY2_HA', ['Q2', null, 0]], ['BCT Q3-HKD NGỌC CHÂU', ['Q3', null, 0]], ['BAOCAOTHUE -Q4_2025 AN DƯƠNG VƯƠNG', ['Q4', 2025, 0]],
  ['BAOCAOTHUE_T09_2026_MAUSAVITAX', ['T9', 2026, 0]], ['BAOCAOTHUE_T09_2026_MAUSAVITAX_BSL1', ['T9', 2026, 1]], ['BAOCAOTHUE_Q2_2026_THINHPHAT', ['Q2', 2026, 0]],
  ['BAOCAOTHUE_QUY_3_2025_THINHPHAT', ['Q3', 2025, 0]], ['BAOCAOTHUE T12 2026', ['T12', 2026, 0]],
]) kiem(`"${ten}"`, ky(ten), mong)
for (const ten of ['BẢNG KÊ', 'TỜ KHAI THUẾ', 'THÔNG BÁO CHẤP NHẬN', 'BAOCAOTHUE', 'BÁO CÁO KHÁC']) kiem(`"${ten}" không phải kỳ`, kyCuaThuMuc(ten), null)

console.log('\nTrong thư mục kỳ:')
for (const [ten, ma] of [['BẢNG KÊ', 'bang_ke'], ['BẢNG KÊ HĐ MV-BR', 'bang_ke'], ['BẢNG KÊ MUA VÀO BÁN RA', 'bang_ke'], ['BẢNG KÊ HÀNG HÓA', 'bang_ke'],
  ['TỜ KHAI THUẾ', 'to_khai'], ['TỜ KHAI', 'to_khai'], ['2. TO KHAI', 'to_khai'], ['BAO CAO THUE_XML', 'to_khai'], ['BAO CAO THUE_PDF', 'to_khai_pdf'],
  ['TB CHẤP NHẬN', 'thong_bao'], ['THÔNG BÁO CHẤP NHẬN', 'thong_bao'], ['TBCN', 'thong_bao'], ['3. TBCN', 'thong_bao']]) kiem(`"${ten}" → ${ma}`, loaiThuMucKy(ten), ma)

console.log('\nTrong 2. HÓA ĐƠN:')
kiem('"QUÝ 3" → 3', quyCuaThuMuc('QUÝ 3'), 3)
kiem('"QUÝ 2(kps)" → 2', quyCuaThuMuc('QUÝ 2(kps)'), 2)
for (const [ten, ma] of [['HĐ MUA VÀO', 'mua_vao'], ['HĐ BÁN RA', 'ban_ra'], ['HĐ BÁN RA ( KPS )', 'ban_ra'], ['XML 1-7-2025_30-9-2025', 'xml'], ['HTML 1-10-2025_31-12-2025', 'html']])
  kiem(`"${ten}" → ${ma}`, loaiThuMucHoaDon(ten), ma)

console.log('\nGợi ý loại file theo tên:')
for (const [ten, mong] of [
  ['0318355371_HDTQMuaVao 1-7-2025_30-9-2025.xlsx', { loai: 'bang_ke_cong', chieu: 'mua_vao' }],
  ['0318355371_HDTQBanra 1-4-2026_30-6-2026.xlsx', { loai: 'bang_ke_cong', chieu: 'ban_ra' }],
  ['0300000001 - Mua vào - Tổng quan - 1-7-2025_30-9-2025.xlsx', { loai: 'bang_ke_cong', chieu: 'mua_vao' }],
  ['Bang_ke_hoa_don_chung_tu_hang_hoa_dich_vu_mua_vao_mau_quan_tri (2).xlsx', { loai: 'bang_ke_pm', chieu: 'mua_vao' }],
  ['Bang_ke_hoa_don_chung_tu_hang_hoa_dich_vu_ban_ra_mau_quan_tri.xlsx', { loai: 'bang_ke_pm', chieu: 'ban_ra' }],
  ['BANG KE HOA DON CHU.xlsx', { loai: 'bang_ke_pm', chieu: null }],
  ['To khai thue GTGT khau tru 01GTGT (17).xlsx', { loai: 'bang_ke_pm', chieu: null }],
  ['TK_GTGT_Q3.2026_ANBINH.xml', { loai: 'to_khai', chieu: null }],
]) kiem(ten, goiYTheoTen(ten), mong)

// ── Cây giả ─────────────────────────────────────────────────────────────────
const tep = (ten, co = 100) => ({ name: ten, kind: 'file', getFile: async () => ({ size: co, lastModified: 1761400000000 }) })
const thu = (ten, ...cac) => ({ name: ten, kind: 'directory', async *entries() { for (const c of cac) yield [c.name, c] } })
const cayNam = (nam, thuong = true) => thu(nam,
  thu('1. HỢP ĐỒNG MUA VÀO_BÁN RA', tep('hd.pdf')),
  thu('2. HÓA ĐƠN MUA VÀO_BÁN RA',
    thu('QUÝ 3', thu('HĐ MUA VÀO', tep('0300000002_HDTQMuaVao 1-7-2026_30-9-2026.xlsx'), tep('hd1.xml')), thu('HĐ BÁN RA ( KPS )'))),
  thu('4. TỜ KHAI HẢI QUAN(kps)'),
  thu('6. LƯƠNG', thu('1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG', tep('Bang luong T7.xlsx'), tep('~$Bang luong T7.xlsx'))),
  thu('7. BỘ BÁO CÁO',
    thu('BỘ BÁO CÁO THUẾ QUÝ_THÁNG',
      thu('BAOCAOTHUE -Q3', thu('TỜ KHAI THUẾ', tep('TK_GTGT_Q3.2026_ANBINH.xml')), thu('BẢNG KÊ', tep('BANG KE HOA DON CHU.xlsx'), tep('TK_GTGT_Q3.2026.xml'))),
      thu('BẢNG KÊ', tep('lac.xlsx'))),
    thu('BỘ BÁO CÁO TÀI CHÍNH NĂM', tep('bctc.xml')),
    thu('BÁO CÁO KHÁC')),
  thu('9. SỔ PHỤ NGÂN HÀNG', thu('QUÝ 3', tep('saoke.xlsx'))),
  ...(thuong ? [] : []))
const goc = thu('1.AN BÌNH', thu('2. HỒ SƠ KẾ TOÁN', cayNam('2025'), cayNam('2026'), thu('Ghi chú')))

console.log('\nQuét cây giả (thư mục công ty, mặc định từ 2026):')
const kq = await quetCongTy(goc)
kiem('tầng = công ty', kq.tang, 'cong_ty')
kiem('chỉ quét 2026, bỏ qua 2025', [Object.keys(kq.nam), kq.namBoQua], [['2026'], [2025]])
const n = kq.nam[2026]
kiem('thư mục kps không quét', n.thuMuc.filter(x => x.kps).map(x => x.ma), ['hai_quan'])
const q3 = n.boBaoCao.ky.find(k => k.ky)
kiem('kỳ Q3 nhận năm theo thư mục cha', [q3.ky.ma, q3.ky.nam], ['Q3', 2026])
kiem('tờ khai trong TỜ KHAI THUẾ', q3.vung.to_khai.map(f => f.ten), ['TK_GTGT_Q3.2026_ANBINH.xml'])
kiem('bảng kê + bản xuất HTKK trong BẢNG KÊ', q3.vung.bang_ke.map(f => f.ten), ['BANG KE HOA DON CHU.xlsx', 'TK_GTGT_Q3.2026.xml'])
kiem('BẢNG KÊ để thẳng không qua thư mục kỳ → kỳ chưa rõ', n.boBaoCao.ky.filter(k => k.khongRoKy).length, 1)
kiem('BCTC năm', n.boBaoCao.bctc.map(f => f.ten), ['bctc.xml'])
kiem('hóa đơn Q3: 2 file mua vào tháng 7–9', n.hoaDon.tep.map(t => [t.chieu, t.thang.join('+')]), [['mua_vao', '7+8+9'], ['mua_vao', '7+8+9']])
kiem('hóa đơn Q3: bán ra (kps) ghi nhận theo tháng', n.hoaDon.kps, [{ chieu: 'ban_ra', thang: [7, 8, 9], nguonThang: 'thu_muc' }])
kiem('bỏ file khoá tạm ~$ của Excel', n.vung.luong.map(f => f.ten), ['Bang luong T7.xlsx'])
kiem('đường dẫn tương đối đầy đủ', n.vung.so_phu[0].duongDan, ['1.AN BÌNH', '2. HỒ SƠ KẾ TOÁN', '2026', '9. SỔ PHỤ NGÂN HÀNG', 'QUÝ 3'])

console.log('\nTrỏ thẳng vào thư mục năm cũ ("Thêm dữ liệu năm cũ"):')
const kqCu = await quetCongTy(cayNam('2025'))
kiem('tầng = năm, lấy đúng 2025 dù < 2026', [kqCu.tang, Object.keys(kqCu.nam)], ['nam', ['2025']])

console.log('\nHóa đơn xếp theo tháng (các kiểu có thật ở 127HOME, 26/10/2026):')
for (const [ten, mong] of [['THÁNG 04', [4]], ['T01+02+03', [1, 2, 3]], ['THÁNG 06+07', [6, 7]], ['T9', [9]], ['Tháng 10', [10]], ['THÁNG 11 + 12', [11, 12]],
  ['0300000002', null], ['Mua vào', null], ['THÁNG 13', null], ['XML 1-4-2026_30-4-2026', null]]) kiem(`tháng của "${ten}"`, thangCuaTen(ten), mong)
kiem('khoảng ngày d-m-yyyy', thangTuKhoangNgay('XML 1-4-2026_30-4-2026'), { nam: 2026, thang: [4] })
kiem('khoảng ngày yyyy-mm-dd', thangTuKhoangNgay('HTML 2026-08-01_2026-08-31'), { nam: 2026, thang: [8] })
kiem('khoảng ngày nhiều tháng', thangTuKhoangNgay('PDF 1-1-2026_31-3-2026').thang, [1, 2, 3])
const pl = (cap, f = 'hd.xml', nam = 2026) => (x => [x.chieu, x.thang])(phanLoaiTepHoaDon(cap, f, nam))
kiem('T01+02+03\\XML …\\Mua vao', pl(['T01+02+03', 'XML 1-1-2026_31-3-2026', 'Mua vao']), ['mua_vao', [1, 2, 3]])
kiem('THÁNG 06+07: theo tên thư mục tháng, KHÔNG theo khoảng ngày 1/1–31/7', pl(['THÁNG 06+07', 'HTML 1-1-2026_31-7-2026', 'Mua vao']), ['mua_vao', [6, 7]])
kiem('THÁNG 08\\MST\\Bán ra\\XML …', pl(['THÁNG 08', '0300000002', 'Bán ra', 'XML 2026-08-01_2026-08-31']), ['ban_ra', [8]])
kiem('không có thư mục tháng → lấy khoảng ngày', pl(['Mua vao', 'XML 1-4-2026_30-4-2026']), ['mua_vao', [4]])
kiem('khoảng ngày khác năm → không nhận tháng', pl(['Mua vao', 'XML 1-4-2025_30-4-2025']), ['mua_vao', null])
kiem('chiều theo tên file cổng HĐĐT', pl(['QUÝ 2'], '0300000002_HDTQBanra 1-4-2026_30-6-2026.xlsx'), ['ban_ra', [4, 5, 6]])

console.log('\nThư mục năm đặt tên tự do (anh thử "2026 - Test BCT", 26/10/2026):')
for (const [ten, nam] of [['2026 - Test BCT', 2026], ['Năm 2025 (bản cũ)', 2025], ['2026_BAN THU', 2026], ['2. NĂM 2026 - KIỂM TRA', 2026]]) kiem(`"${ten}" → ${nam}`, namCuaThuMuc(ten), nam)
for (const ten of ['2025-2026', '2025 2026', '7. BỘ BÁO CÁO 2025', 'BỘ BCTC NĂM 2025 - QQ']) kiem(`"${ten}" vẫn không phải năm`, namCuaThuMuc(ten), null)
kiem('cây con có "7. BỘ BÁO CÁO" → thư mục năm', laThuMucNamTheoCon(['6. LƯƠNG', '7. BỘ BÁO CÁO']), true)
kiem('thư mục công ty (có "2. HỒ SƠ KẾ TOÁN") → không', laThuMucNamTheoCon(['1. HỒ SƠ PHÁP LÝ', '2. HỒ SƠ KẾ TOÁN']), false)
const tuDo = thu('Bản thử của Hà', thu('7. BỘ BÁO CÁO', thu('BỘ BÁO CÁO THUẾ QUÝ_THÁNG', thu('BAOCAOTHUE_Q3_2026_127HOME', thu('TỜ KHAI THUẾ', tep('TK_GTGT_Q3.2026_127HOME.pdf'))))))
const kqTuDo = await quetCongTy(tuDo)
kiem('tên không có năm, bên trong là cây một năm → năm lấy từ thư mục kỳ', [kqTuDo.tang, Object.keys(kqTuDo.nam)], ['nam', ['2026']])
kiem('kỳ Q3 trong đó nhận năm 2026', kqTuDo.nam[2026].boBaoCao.ky[0].ky.nam, 2026)
const kqTen = await quetCongTy(thu('2026 - Test BCT', thu('7. BỘ BÁO CÁO')))
kiem('"2026 - Test BCT" quét như thư mục năm 2026', [kqTen.tang, Object.keys(kqTen.nam)], ['nam', ['2026']])

console.log('\nCây do phân hệ Tờ khai tải về — thư mục kỳ nằm THẲNG trong "7. BỘ BÁO CÁO" (ca DOEL, 27/10/2026):')
const { kiemKeNam } = await import('../lib/phanTich/kiemKe.js')
const kyTk = (ten, ...f) => thu(ten, thu('TỜ KHAI THUẾ', ...f.filter(x => x.startsWith('TK_')).map(x => tep(x))), thu('THÔNG BÁO CHẤP NHẬN', ...f.filter(x => x.startsWith('TB')).map(x => tep(x))))
const namTk = thu('Năm 2026', thu('7. BỘ BÁO CÁO',
  kyTk('BAOCAOTHUE_PS0929_2026_DOEL', 'TK_HDDT_PS0929.2026_DOEL.xml'),
  kyTk('BAOCAOTHUE_Q1_2026_DOEL', 'TK_GTGT_Q1.2026_DOEL.xml', 'TBCN_GTGT_Q1.2026_DOEL.xml'),
  kyTk('BAOCAOTHUE_Q1_2026_DOEL_BSL1', 'TK_TNCN_Q1.2026_DOEL_BSL1.xml', 'TBCN_TNCN_Q1.2026_DOEL_BSL1.xml'),
  kyTk('BAOCAOTHUE_Q2_2026_DOEL', 'TK_GTGT_Q2.2026_DOEL.xml', 'TBCN_GTGT_Q2.2026_DOEL.xml'),
  thu('BỘ BÁO CÁO TÀI CHÍNH_2025_DOEL', tep('bctc.xml'))))
const qTk = await quetNam(namTk)
kiem('nhận 3 thư mục kỳ + 1 phát sinh, bổ sung tách riêng', qTk.boBaoCao.ky.map(k => [k.ten.replace(/^BAOCAOTHUE_/, ''), k.ky?.ma || null, k.ky?.boSung || 0, !!k.phatSinh]).sort(),
  [['PS0929_2026_DOEL', null, 0, true], ['Q1_2026_DOEL', 'Q1', 0, false], ['Q1_2026_DOEL_BSL1', 'Q1', 1, false], ['Q2_2026_DOEL', 'Q2', 0, false]])
kiem('không còn thư mục "không rõ kỳ"', qTk.boBaoCao.ky.some(k => k.khongRoKy), false)
kiem('vùng tờ khai / thông báo của Q2 đúng chỗ', [qTk.boBaoCao.ky.find(k => k.ky?.ma === 'Q2').vung.to_khai.length, qTk.boBaoCao.ky.find(k => k.ky?.ma === 'Q2').vung.thong_bao.length], [1, 1])
kiem('BCTC Tờ khai tải về vẫn vào nhánh BCTC', qTk.boBaoCao.bctc.map(t => t.ten), ['bctc.xml'])
const kkTk = kiemKeNam({ ...qTk, nam: 2026 }, [], { kyKhai: 'quy', homNay: '2026-10-27' })
const dThue = kkTk.dong.find(d => d.ma === 'bo_bao_cao_thue')
kiem('dòng "Báo cáo thuế theo kỳ" ghi 2 thư mục kỳ (Q1, Q2) + phát sinh', /2 thư mục kỳ/.test(dThue.moTa) && /1 bổ sung/.test(dThue.moTa) && /1 tờ khai phát sinh/.test(dThue.moTa), true)
const oTb = kkTk.luoi.find(l => l.nhan === 'Thông báo chấp nhận').o
kiem('lưới thông báo chấp nhận: Q1, Q2 đã có (trước đây báo thiếu)', oTb.slice(0, 2).map(o => [o.ma, o.tt]), [['Q1', 'co'], ['Q2', 'co']])
// Rà soát 27/10: thư mục NHÓM tên giống kỳ; thư mục phát sinh có mã KH chứa "Q2"
const qNhom = await quetNam(thu('Năm 2026', thu('7. BỘ BÁO CÁO', thu('BỘ BÁO CÁO THUẾ QUÝ 1-2-3-4', kyTk('BAOCAOTHUE_Q1_2026_X', 'TK_GTGT_Q1.2026_X.xml'), kyTk('BAOCAOTHUE_Q2_2026_X', 'TK_GTGT_Q2.2026_X.xml')))))
kiem('nhóm "BỘ BÁO CÁO THUẾ QUÝ 1-2-3-4" chứa thư mục kỳ → vẫn là nhóm, nhận Q1 + Q2', qNhom.boBaoCao.ky.map(k => k.ky?.ma).sort(), ['Q1', 'Q2'])
const qPs = await quetNam(thu('Năm 2026', thu('7. BỘ BÁO CÁO', kyTk('BAOCAOTHUE_PS0929_2026_AQ2', 'TK_HDDT_PS0929.2026_AQ2.xml'))))
kiem('thư mục phát sinh mã KH "AQ2" không bị đọc thành kỳ Q2', qPs.boBaoCao.ky.map(k => [k.phatSinh, k.ky?.ma ?? null]), [[true, null]])
kiem('cây cũ (nhóm "BỘ BÁO CÁO THUẾ QUÝ_THÁNG") vẫn đọc như trước', kq.nam[2026].boBaoCao.ky.filter(k => k.ky).map(k => k.ky.ma), ['Q3'])

console.log('\nTrùng năm giữa thư mục chính và thư mục năm trỏ riêng (ca DOEL, 27/10/2026):')
const { gopNamTroRieng } = await import('../lib/phanTich/thuMuc.js')
const chinhDoel = thu('_kiem-xml', thu('Năm 2026', thu('7. BỘ BÁO CÁO', kyTk('BAOCAOTHUE_Q2_2026_DOEL', 'TK_GTGT_Q2.2026_DOEL.xml'))), tep('TBCN_GTGT_Q2.2026_DOEL.xml'))
const rieng = thu('Năm 2026', thu('2. HÓA ĐƠN MUA VÀO_BÁN RA', thu('QUÝ 2', thu('HĐ MUA VÀO', tep('1_C26TAA_167_2026-04-20_0300000004.xml'), tep('0300000003_HDTQMuaVao 1-4-2026_30-6-2026.xlsx')))),
  thu('7. BỘ BÁO CÁO', kyTk('BAOCAOTHUE_Q2_2026_DOEL', 'TK_GTGT_Q2.2026_DOEL.xml')))
const kqChinh = await quetCongTy(chinhDoel)
kiem('thư mục chính (chỉ có tờ khai tải về) cũng ra năm 2026', Object.keys(kqChinh.nam), ['2026'])
const gopDoel = { nam: { ...kqChinh.nam }, namBoQua: [], canhBao: [] }
gopNamTroRieng(gopDoel, await quetCongTy(rieng, { tuNam: 0 }), 'Năm 2026')
kiem('năm 2026 lấy từ thư mục trỏ riêng → thấy được hóa đơn', [gopDoel.nam[2026].tuNamCu, gopDoel.nam[2026].hoaDon?.tep?.length > 0], ['Năm 2026', true])
kiem('có cảnh báo đang dùng thư mục trỏ riêng', gopDoel.canhBao.some(c => c.includes('đang dùng thư mục năm "Năm 2026"')), true)
gopNamTroRieng(gopDoel, await quetCongTy(thu('2026 bản khác', thu('7. BỘ BÁO CÁO')), { tuNam: 0 }), '2026 bản khác')
kiem('hai thư mục trỏ riêng trùng năm → giữ cái đầu', gopDoel.nam[2026].tuNamCu, 'Năm 2026')

console.log('\nThư mục bị đổi tên / xóa trên Drive (ca THỊNH PHÁT, 27/10/2026):')
// Tay cầm còn nhớ nhưng thư mục đã mất → trình duyệt ném NotFoundError khi liệt kê
const thuMat = ten => ({ name: ten, kind: 'directory', async *entries() { const e = new Error('A requested file or directory could not be found at the time an operation was processed.'); e.name = 'NotFoundError'; throw e } })
kiem('"7. BỘ BÁO CÁO" là tầng bộ báo cáo', tangTheoTen('7. BỘ BÁO CÁO'), 'bo_bao_cao')
const kqBbc = await quetCongTy(thu('7. BỘ BÁO CÁO', thu('BỘ BÁO CÁO THUẾ QUÝ_THÁNG')))
kiem('trỏ "7. BỘ BÁO CÁO" → không quét, không lỗi, tầng bo_bao_cao', [kqBbc.tang, Object.keys(kqBbc.nam)], ['bo_bao_cao', []])
let loiGoc = null
try { await quetCongTy(thuMat('3.THỊNH PHÁT')) } catch (e) { loiGoc = e.name }
kiem('thư mục GỐC đã mất → ném NotFoundError (màn hình báo "Trỏ lại")', loiGoc, 'NotFoundError')
const namMat = cayNam('2026'); const conNam = []
for await (const x of namMat.entries()) conNam.push(x[1])
const cayLoi = thu('3.THỊNH PHÁT', thu('2. HỒ SƠ KẾ TOÁN', thu('2026', ...conNam.filter(c => c.name !== '9. SỔ PHỤ NGÂN HÀNG'), thuMat('9. SỔ PHỤ NGÂN HÀNG')), thuMat('2027')))
const kqLoi = await quetCongTy(cayLoi)
const cbLoi = [...kqLoi.canhBao, ...Object.values(kqLoi.nam).flatMap(n => n.canhBao)]
kiem('thư mục con mất → vẫn quét phần còn lại (tờ khai Q3 vẫn thấy)', kqLoi.nam[2026]?.boBaoCao?.ky?.length > 0, true)
kiem('ghi cảnh báo đúng thư mục hỏng', ['9. SỔ PHỤ NGÂN HÀNG', '2027'].map(t => cbLoi.some(c => c.includes(`"${t}"`) && c.includes('đổi tên'))), [true, true])

console.log('\nQuét rộng (Rủi ro thuế, Soát xét năm) chịu được thư mục con mất:')
const { tepRuiRoCuaNam } = await import('../lib/ruiro/docThuMuc.js')
const { tepSoatNam } = await import('../lib/soatbaocao/docThuMuc.js')
const namRong = thu('2025', thu('QUÝ 4.2024', tep('tk.xml')), thuMat('BCTC_2024'), tep('qt.xml'))
for (const [ten, f] of [['Rủi ro thuế', tepRuiRoCuaNam], ['Soát xét năm', tepSoatNam]]) {
  const r = await f({ nam: 2025, tay: namRong, ten: '2025' })
  kiem(`${ten}: vẫn lấy 2 file, cảnh báo "BCTC_2024"`, [r.tep.map(t => t.ten).sort(), r.canhBao.some(c => c.includes('"BCTC_2024"'))], [['qt.xml', 'tk.xml'], true])
  let e2 = null
  try { await f({ nam: 2025, tay: thuMat('2025'), ten: '2025' }) } catch (e) { e2 = e.name }
  kiem(`${ten}: thư mục năm gốc mất → ném lỗi`, e2, 'NotFoundError')
}

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
