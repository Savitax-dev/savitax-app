// Nạp file (XML tờ khai/BCTC, Excel BCTC/sổ chi tiết) thành hồ sơ khách cho bộ máy Rủi ro thuế.
// Giữ đúng thứ tự và cách phân loại của bộ máy gốc: GTGT → TNDN → BCTC → thuyết minh → sổ chi tiết → hóa đơn rủi ro;
// tờ khai GTGT trùng chữ ký (cùng kỳ, lần, ngày lập, số liệu) chỉ lấy một.
import JSZip from 'jszip'
import Engine from './engine.js'
import Risk from './risk.js'
import Bctc from './bctc.js'
import BctcXl from './bctcXl.js'
import XlsxDoc from './xlsxDoc.js'
import XlsDoc from './xlsDoc.js'
import Ledger from './ledger.js'
import HoSo from './hoSo.js'
import { docPl032, coGiaoDichLienKet } from './chuyenLo.js'

const THU_TU = { GTGT: 0, TNDN: 1, BCTC: 2, TMBCTC: 3, SOCT: 4, HDRR: 5 }

// buf: ArrayBuffer | Uint8Array. Trả { kind, doc, year }; XML không dùng cho rủi ro → { kind: null, boQua };
// Excel không nhận ra là BCTC → ném lỗi (e.code === 'notbctc').
export async function phanLoaiTep(name, buf) {
  const ext = ((String(name).match(/\.(\w+)$/) || [])[1] || '').toLowerCase()
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (ext === 'xml') {
    const x = new TextDecoder('utf-8').decode(u8), k = Engine.detectXmlKind(x)
    if (k === 'GTGT') { const d = Engine.parseGTGTXml(x, name); delete d.rawXml; Object.assign(d, Risk.gtgtExtras(x)); return { kind: 'GTGT', doc: d, year: d.nam } }
    // Savitax thêm: PL 03-2 (lỗ được chuyển) + dấu giao dịch liên kết — bộ máy gốc không đọc, ô này phải nhập tay.
    if (k === 'TNDN') { const t = Engine.parseTNDNXml(x, name); delete t.rawXml; t.pl032 = docPl032(x); t.coGdlk = coGiaoDichLienKet(x); return { kind: 'TNDN', doc: t, year: t.nam } }
    if (k === 'BCTC' || Bctc.isBctcXml(x)) { const b = Bctc.parseBctcXml(x, name); return { kind: 'BCTC', doc: b, year: b.nam } }
    // XML không dùng cho rủi ro (05/KK, thông báo, hóa đơn…) → bỏ qua, không phải lỗi
    return { kind: null, boQua: /<HSoThueDTu/.test(x) ? 'tờ khai khác' : 'không phải tờ khai' }
  }
  if (ext !== 'xlsx' && ext !== 'xls') throw new Error('Chưa đọc được loại file: ' + name)
  const sheets = XlsDoc.isXls(u8) ? XlsDoc.read(u8) : await XlsxDoc.read(JSZip, u8)
  const lg = Ledger.parse(sheets, name)
  if (lg && lg.rows.length) return { kind: lg.kind, doc: { kind: lg.kind, acc: lg.acc, nam: lg.nam, rows: lg.rows, tong: lg.tong, sheet: lg.sheet, fileName: name }, year: lg.nam }
  const o = BctcXl.parse(sheets, name, ext === 'xls' ? 'xls' : 'xlsx')
  return { kind: o.kind, doc: o, year: o.nam }
}

// items: [{ name, kind, doc, year }] (kết quả phanLoaiTep kèm tên file). Trả hồ sơ khách.
export function dungHoSo(items, mst) {
  const client = HoSo.newClient(mst)
  const ds = items.slice().sort((a, b) => (THU_TU[a.kind] - THU_TU[b.kind]) ||
    String(a.doc.periodKey || a.year || '').localeCompare(String(b.doc.periodKey || b.year || '')) || a.name.localeCompare(b.name))
  const daCo = {}
  for (const it of ds) {
    const y = +it.year, d = it.doc
    if (it.kind === 'GTGT') { const sg = HoSo.declSig(d); if (daCo[sg]) continue; daCo[sg] = 1; if (+d.nam !== y) d.nam = y; HoSo.addDecl(client, d) }
    else if (it.kind === 'TNDN') { d.nam = y; HoSo.addTndn(client, d) }
    else if (it.kind === 'BCTC') { d.nam = y; d.id = d.id || HoSo.uid('bctc'); HoSo.addBctc(client, d) }
    else if (it.kind === 'TMBCTC') { d.nam = y; d.id = d.id || HoSo.uid('tm'); HoSo.addTm(client, d) }
    else if (it.kind === 'SOCT') { d.nam = y; HoSo.addLedger(client, d) }
    else if (it.kind === 'HDRR') { d.nam = y; HoSo.addRiskInvoices(client, d) }
  }
  client.decls = Engine.sortDecls(client.decls)
  return client
}

// Tiện: files = [[tên, buf]] → { client, items, loi: [{name, loi}] }.
export async function napHoSo(files, mst) {
  const items = [], loi = []
  for (const [name, buf] of files) {
    try { const r = await phanLoaiTep(name, buf); if (r.kind) items.push({ name, ...r }) } catch (e) { loi.push({ name, loi: e.message }) }
  }
  return { client: dungHoSo(items, mst), items, loi }
}
