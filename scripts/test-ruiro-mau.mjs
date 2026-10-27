// Bộ kiểm bộ máy Rủi ro thuế (lib/ruiro) trên bộ hồ sơ mẫu giả lập (MST 0109999982).
//   node scripts/test-ruiro-mau.mjs
// So từng tiêu chí (mức, SL1, SL2, chênh lệch) với mốc bản offline 3.2.0, TRỪ đúng các chỗ Savitax đã sửa lỗi
// (caLoi trong file mốc) — các chỗ đó phải ra kết quả "mongDoi".
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Risk from '../lib/ruiro/risk.js'
import { napHoSo } from '../lib/ruiro/napHoSo.js'
import HoSo from '../lib/ruiro/hoSo.js'
const HoSoNam = (c, y) => HoSo.yearData(c, y)

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), 'du-lieu-mau-phantich')
const moc = JSON.parse(fs.readFileSync(path.join(D, 'moc-ruiro-3.2.0.json'), 'utf8'))
const thuMuc = path.join(D, 'ruiro-mau')
const files = fs.readdirSync(thuMuc).sort().map(f => [f, fs.readFileSync(path.join(thuMuc, f))])

let dat = 0, hong = 0
function kiem(dk, ten, chiTiet) { if (dk) dat++; else { hong++; console.log('  ✗', ten, chiTiet === undefined ? '' : chiTiet) } }
const gon = r => ({ muc: r.level, sl1: typeof r.sl1 === 'number' ? r.sl1 : null, sl2: typeof r.sl2 === 'number' ? r.sl2 : null, cl: typeof r.cl === 'number' ? r.cl : null })

const { client, items, loi } = await napHoSo(files, '0109999982')
const dem = items.reduce((m, i) => (m[i.kind] = (m[i.kind] || 0) + 1, m), {})
console.log('Nạp:', dem, loi.length ? 'lỗi: ' + JSON.stringify(loi) : '')
kiem(loi.length === 0, 'mọi file mẫu đều đọc được', loi)
kiem(dem.GTGT === 35 && dem.TNDN === 4 && dem.BCTC === 3, 'đếm đúng 35 GTGT · 4 TNDN · 3 BCTC', dem)

const C = () => JSON.parse(JSON.stringify(client))

// 1) Khớp mốc từng tiêu chí, trừ ca R20 năm 2025 (bản offline coi "chưa nhập lỗ" = 0 → mức cao).
const BO_QUA = { '2025|R20': true }
for (const y of [2023, 2024, 2025]) {
  const ev = Risk.evaluateYear(C(), y)
  kiem(ev.results.length === moc.nam[y].tieuChi.length, `${y}: đủ ${moc.nam[y].tieuChi.length} tiêu chí`, ev.results.length)
  let khop = 0
  for (const m of moc.nam[y].tieuChi) {
    const r = ev.results.find(x => x.id === m.id)
    if (!r) { kiem(false, `${y} ${m.id} thiếu`); continue }
    if (BO_QUA[y + '|' + m.id]) continue
    const g = gon(r)
    const ok = g.muc === m.muc && g.sl1 === m.sl1 && g.sl2 === m.sl2 && g.cl === m.cl
    if (ok) khop++
    kiem(ok, `${y} ${m.id} khớp mốc`, JSON.stringify(g) + ' ≠ ' + JSON.stringify(m))
  }
  console.log(`${y}: ${khop} tiêu chí khớp mốc`)
}

// 2) Ca lỗi đã sửa.
{
  const ca = moc.caLoi.find(c => c.ma === 'R05-thieu-cdtk')
  const c = C(); c.bctcList.filter(b => b.nam == 2023).forEach(b => { b.cdtk = null; delete b.parts.cdtk })
  const r = Risk.evaluateYear(c, 2023).results.find(x => x.id === 'R05')
  const g = gon(r)
  kiem(g.sl2 === ca.mongDoi.sl2 && g.cl === ca.mongDoi.cl, 'R05 thiếu bảng cân đối tài khoản: SL2 lấy BCĐKT đầu năm', JSON.stringify(g))
  kiem(g.muc === 'khong', 'R05 thiếu bảng cân đối tài khoản: không còn báo rủi ro oan', g.muc)
}
{
  const r = Risk.evaluateYear(C(), 2025).results.find(x => x.id === 'R20')
  kiem(r.level === 'missing', 'R20 chưa có số lỗ còn được chuyển → "thiếu dữ liệu", không coi là 0', JSON.stringify(gon(r)))
  kiem((r.missingDocs || []).some(s => /lỗ còn được chuyển/.test(s)), 'R20 thiếu dữ liệu nói rõ cần số lỗ còn được chuyển', r.missingDocs)
  // Có số lỗ thì chấm như bản gốc: đủ lỗ → Thấp (chỉ nhắc chuẩn bị hồ sơ), thiếu lỗ → Cao.
  const voiLo = lo => { const c = C(); HoSoNam(c, 2025).inputs.loConDuocChuyen = lo; return Risk.evaluateYear(c, 2025).results.find(x => x.id === 'R20') }
  const du = voiLo(r.sl1), thieu = voiLo(r.sl1 - 1000000)
  kiem(du.level === 'thap', 'R20 nhập đủ số lỗ → Thấp', du.level)
  kiem(thieu.level === 'cao', 'R20 số lỗ nhỏ hơn số chuyển → Cao', thieu.level)
}
{
  // R06 cùng lỗi với R05 (số dư cuối năm): bỏ bảng cân đối tài khoản vẫn phải lấy được BCĐKT.
  const goc = Risk.evaluateYear(C(), 2023).results.find(x => x.id === 'R06')
  const c = C(); c.bctcList.filter(b => b.nam == 2023).forEach(b => { b.cdtk = null; delete b.parts.cdtk })
  const r = Risk.evaluateYear(c, 2023).results.find(x => x.id === 'R06')
  kiem(typeof r.sl2 === 'number' && r.sl2 === goc.sl2 && r.level === goc.level, 'R06 thiếu bảng cân đối tài khoản: SL2 lấy BCĐKT cuối năm', JSON.stringify([gon(r), gon(goc)]))
}
{
  // Chỉ có tờ khai GTGT (giữa năm, chưa BCTC / quyết toán): tiêu chí dùng nz(BCTC…) không được ra 0 giả mà phải "thiếu dữ liệu"
  const c = C(); c.tndnList = c.tndnList.filter(t => +t.nam !== 2025); c.bctcList = c.bctcList.filter(b => +b.nam !== 2025); c.tmList = (c.tmList || []).filter(t => +t.nam !== 2025)
  const ev = Risk.evaluateYear(c, 2025)
  const muc = id => ev.results.find(r => r.id === id).level
  const gia = ['R21', 'R25', 'R29', 'R30', 'R32', 'R33', 'R36', 'R37', 'R38', 'R39'].filter(id => muc(id) !== 'missing')
  kiem(gia.length === 0, 'chưa có BCTC / quyết toán: tiêu chí nz(…) là "thiếu dữ liệu", không ra 0', gia)
  kiem(muc('R04') !== 'missing', 'chưa có BCTC: R04 (chỉ cần tờ khai GTGT) vẫn tính', muc('R04'))
}
{ // Dữ liệu thật DOEL 2025 (27/10/2026): bảng cân đối tài khoản MISA "mẫu quản trị" có cột "Số tài khoản"; 05/QTT-TNCN có ct40, ct43
  const { default: BctcXl } = await import('../lib/ruiro/bctcXl.js')
  const { default: Engine } = await import('../lib/ruiro/engine.js')
  const sheet = { name: 'BẢNG CÂN ĐỐI TÀI KHOẢN (MẪU QU', rows: [['CÔNG TY A'], ['Mã số thuế: 0300000001'], [], ['BẢNG CÂN ĐỐI TÀI KHOẢN (MẪU QUẢN TRỊ)'], ['Năm 2025'], [],
    ['Số tài khoản', 'Tên tài khoản', 'Đầu kỳ', '', 'Phát sinh', '', 'Cuối kỳ', ''], ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'],
    ['111', 'Tiền mặt', 5000000, 0, 20000000, 18000000, 7000000, 0], ['133', 'Thuế GTGT được khấu trừ', 1000000, 0, 8000000, 7000000, 2000000, 0],
    ['331', 'Phải trả cho người bán', 0, 3000000, 15000000, 16000000, 0, 4000000]] }
  let o = null, loi = ''
  try { o = BctcXl.parse([sheet], 'Bang_can_doi_tai_khoan_mau_quan_tri.xlsx', 'xlsx') } catch (e) { loi = e.message }
  kiem(o && o.cdtk['133'] && o.cdtk['133'].ckNo === 2000000 && o.cdtk['331'].ckCo === 4000000, 'bảng cân đối tài khoản cột "Số tài khoản" (MISA mẫu quản trị) đọc được', loi || JSON.stringify(o && o.cdtk['133']))
  // Rà soát 27/10: sheet sao kê ("Số tài khoản: …", "Phát sinh nợ/có") đứng trước không được che bảng thật (cả khi bảng thật bỏ tiêu đề)
  const saoKe = { name: 'Sao ke', rows: [['SAO KÊ TÀI KHOẢN'], ['Số tài khoản:', '0123456789'], ['Tên tài khoản:', 'CÔNG TY A'], ['Ngày', 'Diễn giải', 'Phát sinh nợ', 'Phát sinh có', 'Số dư'],
    ...Array.from({ length: 20 }, (_, i) => [100 + i, 'Giao dịch ' + i, 1000, 0, 5000])] }
  const khongTieuDe = { ...sheet, name: 'Sheet2', rows: sheet.rows.filter((_, i) => i !== 3) }
  o = null; loi = ''
  try { o = BctcXl.parse([saoKe, khongTieuDe], 'BCTC 2025.xlsx', 'xlsx') } catch (e) { loi = e.message }
  kiem(BctcXl.classify(saoKe) !== 'cdtk' && o && o.cdtk['133']?.ckNo === 2000000 && !o.cdtk['100'], 'sao kê có "Số tài khoản" không bị nhận là bảng cân đối tài khoản, bảng thật vẫn đọc', loi || JSON.stringify([BctcXl.classify(saoKe), o && Object.keys(o.cdtk).slice(0, 4)]))
  const qtt = '<HSoThueDTu><HSoKhaiThue><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>953</maTKhai><tenTKhai>TỜ KHAI QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN (Mẫu số 05/QTT-TNCN)</tenTKhai></TKhaiThue></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><ct40>1</ct40><ct43>2</ct43></CTieuTKhaiChinh></HSoKhaiThue></HSoThueDTu>'
  const { phanLoaiTep } = await import('../lib/ruiro/napHoSo.js')
  let r = null; loi = ''
  try { r = await phanLoaiTep('QTT_TNCN_2025.xml', new TextEncoder().encode(qtt)) } catch (e) { loi = e.message }
  kiem(Engine.detectXmlKind(qtt) !== 'GTGT' && r && r.kind === null, '05/QTT-TNCN (có ct40, ct43) không bị nhận là tờ khai GTGT, bỏ qua không lỗi', loi || JSON.stringify([Engine.detectXmlKind(qtt), r]))
}
// Tên đơn vị cũ: kiểm chung cho cả repo bằng scripts/test-phantich-thuong-hieu.mjs (từ khóa để ngoài repo).

console.log(hong ? `\n✗ ${hong} lỗi / ${dat + hong} phép kiểm` : `\n✓ Đạt ${dat}/${dat} phép kiểm`)
process.exit(hong ? 1 : 0)
