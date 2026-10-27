// Bộ kiểm lát 2 Rủi ro thuế: đọc thẳng thư mục công ty + tự tìm số bản cũ bắt nhập tay.
//   node scripts/test-ruiro-thumuc.mjs
// Cây thư mục GIẢ dựng trong bộ nhớ từ bộ hồ sơ mẫu giả lập (MST 0109999982), không đụng ổ đĩa.
import fs from 'node:fs'
import path from 'node:path'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import Risk from '../lib/ruiro/risk.js'
import { napHoSo } from '../lib/ruiro/napHoSo.js'
import { docHoSoRuiRo, tepRuiRoCuaNam, laTenCanDoiTaiKhoan } from '../lib/ruiro/docThuMuc.js'
import { docPl032, tinhLoConDuocChuyen, coGiaoDichLienKet } from '../lib/ruiro/chuyenLo.js'
import { loaiThanhToan, docHoaDonXml, tienMatTren5tr } from '../lib/ruiro/hoaDonXml.js'
import { tuTimSoLieu, ganSoLieu } from '../lib/ruiro/tuTim.js'

let hong = 0, dat = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  if (a === b) { dat++; return }
  hong++; console.log(`  HỎNG ${ten}\n         ra ${a}\n         đáng lẽ ${b}`)
}

const MAU = path.resolve('scripts/du-lieu-mau-phantich/ruiro-mau')
const doc = f => fs.readFileSync(path.join(MAU, f))
const moc = JSON.parse(fs.readFileSync(path.resolve('scripts/du-lieu-mau-phantich/moc-ruiro-3.2.0.json'), 'utf8'))

// ── 1. PL 03-2/TNDN ─────────────────────────────────────────────────────────────
const dongTT80 = (i, [nam, ps, dc, kn, cs]) => `<noiDungNamThu${i}><ct2>${nam}</ct2><ct3>${ps}</ct3><ct4>${dc}</ct4><ct5>${kn}</ct5><ct6>${cs}</ct6></noiDungNamThu${i}>`
const pl032 = (sx, bds = []) => `<PLuc_03_2_TNDN><Lo_HDSXKD><BangChiTietSoLo>${sx.map((d, i) => dongTT80(i + 1, d)).join('')}</BangChiTietSoLo><tongCong>0</tongCong></Lo_HDSXKD><Lo_CNBDS><BangChiTietSoLo>${bds.map((d, i) => dongTT80(i + 1, d)).join('')}${dongTT80(bds.length + 1, ['', 0, 0, 0, 0])}</BangChiTietSoLo></Lo_CNBDS></PLuc_03_2_TNDN>`
{
  const p = docPl032(`<PLuc>${pl032([[2022, 500, 100, 150, 250]], [[2023, 40, 0, 0, 40]])}</PLuc>`)
  kiem('PL 03-2 TT80: đọc 2 bảng, bỏ dòng trống', p, { co: true, dong: [{ nhom: 'sxkd', nam: 2022, phatSinh: 500, daChuyen: 100, kyNay: 150, conSau: 250 }, { nhom: 'bds', nam: 2023, phatSinh: 40, daChuyen: 0, kyNay: 0, conSau: 40 }] })
  const cu = docPl032('<PL03_2A_TNDN><BangChiTietSoLo><noiDungNamThu1><namPSinhLo>2012</namPSinhLo><soLoPSinh>9</soLoPSinh><soLoDaChuyen>2</soLoDaChuyen><soLoKyNay>3</soLoKyNay><soLoChuyenSau>4</soLoChuyenSau></noiDungNamThu1></BangChiTietSoLo></PL03_2A_TNDN>')
  kiem('PL 03-2 mẫu cũ (PL03_2A)', cu.dong, [{ nhom: 'sxkd', nam: 2012, phatSinh: 9, daChuyen: 2, kyNay: 3, conSau: 4 }])
  kiem('không có PL 03-2', docPl032('<PLuc><PLuc_03_1A_TNDN/></PLuc>'), { co: false })
  kiem('dấu GDLK', [coGiaoDichLienKet('<PLuc><PL_01_ND132_GDLK/></PLuc>'), coGiaoDichLienKet('<PLuc><PLuc_03_1A_TNDN/></PLuc>')], [true, false])

  const pl24 = docPl032(pl032([[2018, 300, 250, 0, 50], [2022, 500, 100, 150, 250]]))
  const pl25 = docPl032(pl032([[2022, 500, 250, 250, 0], [2024, 50, 0, 50, 0]]))
  const r = tinhLoConDuocChuyen({ nam: 2025, pl: pl25, plTruoc: pl24, c3: 300 })
  kiem('lỗ còn chuyển 2025 = còn sau 2024 trong hạn (bỏ lỗ 2018 quá 5 năm) + lỗ 2024', [r.giaTri, r.ghiChu], [300, []])
  const chiNamNay = tinhLoConDuocChuyen({ nam: 2025, pl: pl25, plTruoc: null, c3: 300 })
  kiem('không có năm trước → theo PL 03-2 năm nay', [chiNamNay.giaTri, /năm 2025/.test(chiNamNay.nguon)], [300, true])
  const M = 1e6, pl24M = docPl032(pl032([[2018, 300 * M, 250 * M, 0, 50 * M], [2022, 500 * M, 100 * M, 150 * M, 250 * M]]))
  const lech = tinhLoConDuocChuyen({ nam: 2025, pl: docPl032(pl032([[2022, 500 * M, 100 * M, 300 * M, 50 * M]])), plTruoc: pl24M, c3: 250 * M })
  kiem('PL năm nay khai lại số đã chuyển khác năm trước + C3 lệch + dòng không khớp → 3 ghi chú', [lech.giaTri, lech.ghiChu.length], [250 * M, 3])
  const quaHan = tinhLoConDuocChuyen({ nam: 2025, pl: docPl032(pl032([[2019, 100, 0, 100, 0]])), plTruoc: null, c3: 100 })
  kiem('chuyển lỗ năm đã quá 5 năm', [quaHan.giaTri, quaHan.ghiChu.some(s => /quá 5 năm/.test(s))], [0, true])
}

// ── 2. Hóa đơn: hình thức thanh toán ────────────────────────────────────────────
{
  kiem('loại thanh toán', ['Tiền mặt', 'TM', 'CK', 'CK/CTCN', 'Chuyển khoản', 'TM/CK', 'Tiền mặt/Chuyển khoản', ''].map(loaiThanhToan),
    ['tien_mat', 'tien_mat', 'khong_tien_mat', 'khong_tien_mat', 'khong_tien_mat', 'khong_ro', 'khong_ro', 'khong_ro'])
  const hd = (so, ngay, tong, ht, mstMua = '0109999982') => `<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TAA</KHHDon><SHDon>${so}</SHDon><NLap>${ngay}</NLap><HTTToan>${ht}</HTTToan></TTChung><NDHDon><NBan><MST>0300000001</MST></NBan><NMua><MST>${mstMua}</MST></NMua><TToan><TgTTTBSo>${tong}</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`
  const ds = [hd(1, '2025-03-01', 6000000, 'Tiền mặt'), hd(1, '2025-03-01', 6000000, 'Tiền mặt'), hd(2, '2025-04-01', 4000000, 'Tiền mặt'),
    hd(3, '2025-05-01', 8000000, 'TM/CK'), hd(4, '2025-06-01', 9000000, 'CK'), hd(5, '2024-12-31', 7000000, 'Tiền mặt'), hd(6, '2025-07-01', 7000000, 'Tiền mặt', '0300000009')].map(docHoaDonXml)
  kiem('đọc hóa đơn XML', [ds[0].ok, ds[0].ngay, ds[0].tong, ds[0].mstMua, docHoaDonXml('<TBaoThueDTu/>').ok], [true, '2025-03-01', 6000000, '0109999982', false])
  kiem('Σ tiền mặt ≥ 5 triệu: bỏ trùng, bỏ < 5tr, bỏ năm khác, bỏ HĐ người mua khác', tienMatTren5tr(ds, { nam: 2025, mstCty: '0109999982' }),
    { soHoaDon: 4, tienMat: { so: 1, tien: 6000000 }, khongRo: { so: 1, tien: 8000000 } })
}

// ── 3. Thư mục công ty giả ──────────────────────────────────────────────────────
const tep = (ten, buf) => ({
  name: ten, kind: 'file',
  getFile: async () => ({ name: ten, size: buf.length, lastModified: 1761400000000, text: async () => buf.toString('utf8'), arrayBuffer: async () => buf }),
})
const thu = (ten, ...cac) => ({ name: ten, kind: 'directory', async *entries() { for (const c of cac) yield [c.name, c] } })
const PL24 = pl032([[2022, 500000000, 100000000, 150000000, 250000000]])
const PL25 = pl032([[2022, 500000000, 250000000, 250000000, 0], [2024, 50000000, 0, 50000000, 0]])
const ganPl = (ten, pl) => Buffer.from(doc(ten).toString('utf8').replace('</PLuc>', pl + '</PLuc>'), 'utf8')
const gtgtCuaNam = nam => fs.readdirSync(MAU).filter(f => f.includes('_01GTGT_') && f.includes('-' + nam + '_'))
const thangCua = f => (f.match(/_[MQ](\d\d?)-/) || [])[1]
const boBaoCao = (nam, bctc) => thu('7. BỘ BÁO CÁO',
  thu('BỘ BÁO CÁO THUẾ QUÝ_THÁNG', ...[...new Set(gtgtCuaNam(nam).map(thangCua))].map(t =>
    thu(`BAOCAOTHUE_T${t.padStart(2, '0')}_${nam}_MAU`, thu('TỜ KHAI THUẾ', ...gtgtCuaNam(nam).filter(f => thangCua(f) === t).map(f => tep(f, doc(f))))))),
  thu('BỘ BÁO CÁO TÀI CHÍNH NĂM', ...bctc))
const cty = thu('0109999982 MAU RUI RO', thu('2. HỒ SƠ KẾ TOÁN',
  thu('Năm 2024', boBaoCao(2024, [tep('QT TNDN 2024.xml', ganPl('0109999982_03TNDN_2024_L0.xml', PL24)), tep('BCTC 2024.xlsx', doc('0109999982_BCTC_TT133_B01a_2024.xlsx'))]),
    thu('8. SỔ SÁCH KẾ TOÁN', tep('So chi tiet 131 ca nam.xlsx', Buffer.from('khong doc')))),
  // Quyết toán + BCTC 2025 nộp tháng 3/2026 nằm ở thư mục năm 2026 — phải vẫn tìm thấy
  thu('Năm 2025', boBaoCao(2025, [])),
  thu('Năm 2026', boBaoCao(2026, [tep('QT TNDN 2025.xml', ganPl('0109999982_03TNDN_2025_L0.xml', PL25)), tep('QT TNDN 2025 bs1.xml', ganPl('0109999982_03TNDN_2025_L1.xml', PL25)), tep('BCTC 2025.xlsx', doc('0109999982_BCTC_TT133_B01a_2025.xlsx'))])),
))

kiem('tên bảng cân đối tài khoản', ['Bang can doi tai khoan 2025.xlsx', 'CDPS nam 2025.xls', 'So chi tiet 131.xlsx'].map(laTenCanDoiTaiKhoan), [true, true, false])

const quet = await quetCongTy(cty, { tuNam: 2000 })
kiem('quét được 3 năm', Object.keys(quet.nam), ['2024', '2025', '2026'])
kiem('sổ chi tiết không phải bảng cân đối → không đọc', (await tepRuiRoCuaNam(quet.nam[2024])).tep.some(x => /So chi tiet/.test(x.ten)), false)

// Thư mục năm cũ KHÔNG theo cây chuẩn (thực tế năm 2024): kỳ + BCTC để thẳng trong thư mục năm
{
  const tuDo = thu('cty TU DO', thu('2. HỒ SƠ KẾ TOÁN', thu('NĂM 2025',
    thu('QUÝ 1.2025', tep('HCM-0109999982-01_GTGT-M01.xml', doc('0109999982_01GTGT_M01-2025_L0.xml')), tep('ghi chu.xlsx', Buffer.from('x'))),
    thu('BAOCAOTHUE_QUY 2_2025_MAU', thu('TỜ KHAI THUẾ', thu('Tờ khai 01GTGT', tep('Tờ khai thuế GTGT.xml', doc('0109999982_01GTGT_M04-2025_L0.xml'))))),
    thu('BCTC_2025', tep('0109999982-03_TNDN-Y2025-L00.xml', doc('0109999982_03TNDN_2025_L0.xml')), tep('ETAX1122025.xlsx', doc('0109999982_BCTC_TT133_B01a_2025.xlsx'))),
    tep('BCTC_2025.rar', Buffer.from('rar')), tep('Q4_2025.rar', Buffer.from('rar')),
    thu('6. LƯƠNG', tep('luong.xml', doc('0109999982_01GTGT_M05-2025_L0.xml'))),
    thu('2. HÓA ĐƠN MUA VÀO_BÁN RA', thu('Mua vao', tep('1_C25TAA_1.xml', Buffer.from('<HDon><DLHDon><TTChung><SHDon>1</SHDon><NLap>2025-02-01</NLap><HTTToan>Tiền mặt</HTTToan></TTChung><NDHDon><NMua><MST>0109999982</MST></NMua><TToan><TgTTTBSo>6000000</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>')))),
  )))
  const q = await quetCongTy(tuDo, { tuNam: 2000 })
  const r = await tepRuiRoCuaNam(q.nam[2025])
  kiem('cây tự do: lấy XML mọi nơi + Excel trong nhánh BCTC, bỏ lương/hóa đơn; chỉ nhắc file nén CHƯA giải nén',
    [r.tep.map(t => t.vai + ':' + t.ten).sort(), r.nen.map(x => x.split(String.fromCharCode(92)).pop())], [['excel:ETAX1122025.xlsx', 'xml:0109999982-03_TNDN-Y2025-L00.xml', 'xml:HCM-0109999982-01_GTGT-M01.xml', 'xml:Tờ khai thuế GTGT.xml'], ['Q4_2025.rar']])
  const kqTd = await docHoSoRuiRo({ nam: 2025, quetTheoNam: q.nam, mst: '0109999982', docHoaDon: true })
  kiem('cây tự do: đọc ra 2 tờ khai GTGT + quyết toán + BCTC, hóa đơn mua vào khi được yêu cầu',
    [kqTd.items.map(i => i.kind).sort(), kqTd.hoaDon.length, kqTd.nen.length], [['BCTC', 'GTGT', 'GTGT', 'TNDN'], 1, 1])
}

// bộ nhớ đệm giả: lần đọc thứ hai không mở lại file
const kho = new Map(); let soLanGhi = 0
const dem = { khoa: (t, loai) => `${loai}|${t.duongDan.join('/')}/${t.ten}|${t.co}`, lay: async k => kho.get(k), ghi: async (k, v) => { soLanGhi++; kho.set(k, structuredClone(v)) } }
const kq = await docHoSoRuiRo({ nam: 2025, quetTheoNam: quet.nam, mst: '0109999982', dem })
const dem2 = kq.items.reduce((m, i) => (m[i.kind + i.year] = (m[i.kind + i.year] || 0) + 1, m), {})
kiem('đọc đúng tờ khai 2024–2025 (quyết toán 2025 ở thư mục 2026)', Object.fromEntries(Object.entries(dem2).sort()), { BCTC2024: 1, BCTC2025: 1, GTGT2024: 14, GTGT2025: 16, TNDN2024: 1, TNDN2025: 2 })
kiem('không lỗi đọc', kq.loi.map(l => l.tep.ten + ': ' + l.loi), [])
const lanGhi = soLanGhi
const kq2 = await docHoSoRuiRo({ nam: 2025, quetTheoNam: quet.nam, mst: '0109999982', dem })
kiem('lần hai lấy từ bộ nhớ đệm, kết quả như cũ', [soLanGhi === lanGhi, kq2.items.length === kq.items.length], [true, true])

// Chế độ màn hình: đọc mọi năm một lần — chấm năm 2025 phải ra y như chỉ đọc 2024–2025
{
  const tat = await docHoSoRuiRo({ nam: 2025, quetTheoNam: quet.nam, mst: '0109999982', dem, tatCaNam: true })
  kiem('đọc mọi năm: có dữ liệu năm 2025, 2024', tat.cacNamCoDuLieu, [2025, 2024])
  const g = r => [r.id, r.level, r.sl1 ?? null, r.sl2 ?? null]
  const a = Risk.evaluateYear(structuredClone(tat.client), 2025).results.map(g), b = Risk.evaluateYear(structuredClone(kq.client), 2025).results.map(g)
  kiem('đọc mọi năm = đọc 2 năm (chấm 2025)', a.filter((x, i) => JSON.stringify(x) !== JSON.stringify(b[i])), [])
}

// Lũy kế đến kỳ (màn Soát kỳ): giữ tờ khai tới hết kỳ, bỏ quyết toán + BCTC đầy đủ của năm khi chưa hết năm
{
  const { catDenKy } = await import('../lib/ruiro/luyKe.js')
  const c6 = catDenKy(kq.client, 2025, 6), c12 = catDenKy(kq.client, 2025, 12)
  const d25 = c => c.decls.filter(d => +d.nam === 2025)
  kiem('lũy kế T6: chỉ tờ khai 2025 tới tháng 6, giữ nguyên năm 2024', [d25(c6).every(d => (d.kieuKy === 'Q' ? 3 * d.ky : d.ky) <= 6), d25(c6).length > 0, c6.decls.filter(d => +d.nam === 2024).length === kq.client.decls.filter(d => +d.nam === 2024).length], [true, true, true])
  kiem('lũy kế T6: bỏ quyết toán + BCTC 2025, giữ năm 2024', [c6.tndnList.some(t => +t.nam === 2025), c6.bctcList.some(b => +b.nam === 2025), c6.bctcList.some(b => +b.nam === 2024)], [false, false, true])
  kiem('lũy kế T12 (hết năm): giữ đủ', [c12.tndnList.some(t => +t.nam === 2025), c12.bctcList.some(b => +b.nam === 2025), d25(c12).length === d25(kq.client).length], [true, true, true])
  const r01 = Risk.evaluateYear(c6, 2025).results.find(r => r.id === 'R01')
  kiem('lũy kế T6: R01 (cần BCTC + quyết toán) chờ dữ liệu, không so nửa năm với cả năm', r01.level, 'missing')
  kiem('hồ sơ gốc không bị sửa khi cắt', kq.client.tndnList.some(t => +t.nam === 2025), true)
}

// Kết quả bộ máy năm 2025 từ thư mục = từ bộ file phẳng (cùng file 2024–2025), và = mốc trừ R20
{
  const phang = [...gtgtCuaNam(2024), ...gtgtCuaNam(2025), '0109999982_03TNDN_2024_L0.xml', '0109999982_03TNDN_2025_L0.xml', '0109999982_03TNDN_2025_L1.xml', '0109999982_BCTC_TT133_B01a_2024.xlsx', '0109999982_BCTC_TT133_B01a_2025.xlsx']
  const { client: cPhang } = await napHoSo(phang.map(f => [f, doc(f)]), '0109999982')
  const a = Risk.evaluateYear(structuredClone(kq.client), 2025).results, b = Risk.evaluateYear(structuredClone(cPhang), 2025).results
  const g = r => [r.id, r.level, r.sl1 ?? null, r.sl2 ?? null, r.cl ?? null]
  kiem('thư mục = file phẳng (39 tiêu chí 2025)', a.map(g).filter((x, i) => JSON.stringify(x) !== JSON.stringify(g(b[i]))), [])
  const khacMoc = a.filter(r => { const m = moc.nam[2025].tieuChi.find(t => t.id === r.id); return r.id !== 'R20' && (m.muc !== r.level || m.sl1 !== (typeof r.sl1 === 'number' ? r.sl1 : null) || m.sl2 !== (typeof r.sl2 === 'number' ? r.sl2 : null)) }).map(r => r.id)
  kiem('2025 từ thư mục khớp mốc (trừ R20)', khacMoc, [])
}

// ── 4. Tự tìm số ────────────────────────────────────────────────────────────────
{
  const { inputs, bang } = tuTimSoLieu(kq.client, 2025, { hoaDon: [] })
  const o = k => bang.find(d => d.khoa === k)
  kiem('lỗ còn được chuyển tự tìm từ PL 03-2 năm 2024', [o('loConDuocChuyen').trangThai, inputs.loConDuocChuyen], ['tu_tim', 300000000])
  kiem('hoàn thuế: không có [42] → 0', [o('hoanThue').trangThai, inputs.hoanThue], ['tu_tim', 0])
  kiem('chưa có hóa đơn XML → chi tiền mặt chờ nhập', [o('chiTienMat5tr').trangThai, 'chiTienMat5tr' in inputs], ['can_nhap', false])
  kiem('bắt buộc kiểm toán luôn chờ nhân viên', [o('batBuocKiemToan').trangThai, 'batBuocKiemToan' in inputs], ['can_nhap', false])
  kiem('đủ 9 ô', bang.length, 9)
  const truoc = Risk.evaluateYear(structuredClone(kq.client), 2025).results.find(r => r.id === 'R20')
  const sau = Risk.evaluateYear(ganSoLieu(kq.client, 2025, inputs), 2025).results.find(r => r.id === 'R20')
  kiem('R20: chưa có số → Thiếu dữ liệu; có số tự tìm (đủ lỗ) → Thấp', [truoc.level, sau.level], ['missing', 'thap'])
  const tay = Risk.evaluateYear(ganSoLieu(kq.client, 2025, inputs, { loConDuocChuyen: 100000000 }), 2025).results.find(r => r.id === 'R20')
  kiem('nhân viên sửa tạm số lỗ nhỏ hơn → Cao', tay.level, 'cao')
  const khongPl = tuTimSoLieu(dungLaiKhongPl(kq.client), 2025)
  kiem('chuyển lỗ mà không có PL 03-2 cả 2 năm → chờ nhập', khongPl.bang.find(d => d.khoa === 'loConDuocChuyen').trangThai, 'can_nhap')
}
function dungLaiKhongPl(c) { const x = structuredClone(c); for (const t of x.tndnList) t.pl032 = { co: false }; return x }

console.log(hong ? `\n✗ ${hong} lỗi / ${dat + hong} phép kiểm` : `\n✓ Đạt ${dat}/${dat} phép kiểm`)
process.exit(hong ? 1 : 0)
