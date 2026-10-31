// Kiểm bộ dựng PDF tờ khai đúng mẫu cổng (lib/tokhaiPdfMau.js) — 01/GTGT và 05/KK-TNCN.
//   node scripts/test-tokhai-pdf-mau.mjs                       # dữ liệu GIẢ, chạy offline
//   node scripts/test-tokhai-pdf-mau.mjs <tờ khai.xml> <bản PDF cổng in.pdf> [ra.pdf]
//        → so từng cụm chữ (vị trí x/y) với bản gốc cổng; cần pdfjs-dist. File thật để NGOÀI repo.
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { dungPdfToKhaiMau, coTheDungPdf, soMau } from '../lib/tokhaiPdfMau.js'

const PHONG = Object.fromEntries(['thuong:Regular', 'dam:Bold', 'nghieng:Italic'].map(s => {
  const [k, t] = s.split(':')
  return [k, new Uint8Array(fs.readFileSync(path.join('public', 'fonts', `Tinos-${t}.ttf`)))]
}))
let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi), dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// ── Chế độ so với bản gốc ─────────────────────────────────────────────────────
if (process.argv[2]) {
  const [fXml, fGoc, fRa] = process.argv.slice(2)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const xml = fs.readFileSync(fXml, 'utf8')
  console.log('Dựng được:', JSON.stringify(coTheDungPdf(xml)))
  const ra = await dungPdfToKhaiMau(xml, PHONG)
  if (fRa) fs.writeFileSync(fRa, ra)
  const chu = async buf => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
    const ds = []
    for (let p = 1; p <= doc.numPages; p++) {
      const it = (await (await doc.getPage(p)).getTextContent()).items.filter(i => i.str.trim())
        .map(i => ({ p, x: i.transform[4], y: i.transform[5], s: i.str.normalize('NFC'), w: i.width })).sort((a, b) => b.y - a.y || a.x - b.x)
      for (const i of it) {
        const l = ds[ds.length - 1]
        if (l && l.p === p && Math.abs(l.y - i.y) < 1.5 && i.x - (l.x + l.w) < 4) { l.s += (i.x - (l.x + l.w) > 1 ? ' ' : '') + i.s; l.w = i.x + i.w - l.x } else ds.push({ ...i })
      }
    }
    return { ds, so: doc.numPages }
  }
  const A = await chu(fs.readFileSync(fGoc)), B = await chu(ra)
  const k = s => s.replace(/\s+/g, '')
  let lech = 0, thieu = 0
  for (const a of A.ds) {
    const b = B.ds.find(b => b.p === a.p && k(b.s) === k(a.s) && !b.dung)
    if (!b) { thieu++; console.log(`  THIẾU tr${a.p} (${a.x.toFixed(1)},${a.y.toFixed(1)}) ${a.s}`); continue }
    b.dung = true
    if (Math.abs(b.x - a.x) > 1.5 || Math.abs(b.y - a.y) > 1.5) { lech++; console.log(`  LỆCH  tr${a.p} dx=${(b.x - a.x).toFixed(1)} dy=${(b.y - a.y).toFixed(1)} ${a.s.slice(0, 70)}`) }
  }
  console.log(`Số trang: gốc ${A.so} · app ${B.so}. ${A.ds.length} cụm chữ gốc: lệch >1,5pt ${lech}, không thấy ${thieu}`)
  console.log('(“không thấy” do bản gốc lưu chữ tách dấu, hoặc hai cụm cùng hàng dính nhau khi trích — xem tọa độ)')
  process.exit(0)
}

// ── Dữ liệu giả ───────────────────────────────────────────────────────────────
const xmlGia = ({ ma = '842', ten = 'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)', kieu = 'Q', ky = '3/2026', soLan = 0, tenNNT = 'CÔNG TY TNHH THỬ NGHIỆM', ct = '', pluc = '<PLuc />' } = {}) => `<?xml version="1.0" encoding="utf-8"?>
<HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue id="ID_1"><TTinChung><TTinTKhaiThue><TKhaiThue>
<maTKhai>${ma}</maTKhai><tenTKhai>${ten}</tenTKhai>
<moTaBMau>(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)</moTaBMau>
<soLan>${soLan}</soLan><KyKKhaiThue><kieuKy>${kieu}</kieuKy><kyKKhai>${ky}</kyKKhai></KyKKhaiThue>
<ngayLapTKhai>2026-10-20</ngayLapTKhai><nguoiKy>Nguyễn Văn Thử</nguoiKy><ngayKy>2026-10-20</ngayKy></TKhaiThue>
<NNT><mst>0300000001</mst><tenNNT>${tenNNT}</tenNNT><dchiNNT>Số 1 Đường Thử, Phường Bến Nghé, Quận 1, Hồ Chí Minh</dchiNNT>
<tenHuyenNNT>Quận 1</tenHuyenNNT><tenTinhNNT>Hồ Chí Minh</tenTinhNNT><dthoaiNNT></dthoaiNNT><faxNNT /><emailNNT></emailNNT></NNT>
</TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><ten_NganhNghe>Hoạt động sản xuất kinh doanh thông thường</ten_NganhNghe>${ct}</CTieuTKhaiChinh>${pluc}</HSoKhaiThue></HSoThueDTu>`
const soTrang = async b => (await PDFDocument.load(b)).getPageCount()

console.log('Số liệu:')
kiem('nghìn chấm, âm trong ngoặc, 0 giữ 0, rỗng giữ rỗng', [soMau('15713000'), soMau('-1257040'), soMau('0'), soMau(''), soMau('-0')], ['15.713.000', '(1.257.040)', '0', '', '0'])

console.log('\nMẫu nào dựng:')
kiem('01/GTGT (842) không phụ lục → dựng', coTheDungPdf(xmlGia()).duoc, true)
kiem('05/KK-TNCN (864) → dựng', coTheDungPdf(xmlGia({ ma: '864' })).duoc, true)
kiem('01/GTGT CÓ phụ lục giảm thuế → KHÔNG dựng (chưa có bản gốc phụ lục)', coTheDungPdf(xmlGia({ pluc: '<PLuc><PL_NQ142_GTGT><x>1</x></PL_NQ142_GTGT></PLuc>' })).duoc, false)
kiem('mẫu chưa có bản gốc (03/TNDN 892) → KHÔNG dựng', coTheDungPdf(xmlGia({ ma: '892' })).duoc, false)
kiem('thông báo → KHÔNG dựng ở đây', coTheDungPdf('<TBaoThueDTu></TBaoThueDTu>').duoc, false)

console.log('\nPhông:')
for (const k of ['thuong', 'dam', 'nghieng']) {
  const f = fontkit.create(Buffer.from(PHONG[k]))
  const can = [...new Set([...'≥≤ỘÒÃỆỦỸẪỢĐđ“”'])]
  kiem(`Tinos ${k} có đủ ký tự đặc biệt của mẫu (≥ ≤, chữ có dấu)`, can.filter(c => !f.hasGlyphForCodePoint(c.codePointAt(0))), [])
}

console.log('\nDựng PDF:')
const ctGtgt = '<ct21>0</ct21><ct22>0</ct22><ct23>15713000</ct23><ct24>1257040</ct24><ct25>1257040</ct25><ct36>-1257040</ct36><ct41>1257040</ct41><ct43>1257040</ct43>'
const b1 = await dungPdfToKhaiMau(xmlGia({ ct: ctGtgt }), PHONG)
kiem('01/GTGT quý: 2 trang như bản gốc (bảng sang trang sau [41])', await soTrang(b1), 2)
const b2 = await dungPdfToKhaiMau(xmlGia({ kieu: 'M', ky: '09/2026', soLan: 2, tenNNT: 'CÔNG TY TRÁCH NHIỆM HỮU HẠN MỘT THÀNH VIÊN THƯƠNG MẠI DỊCH VỤ XUẤT NHẬP KHẨU KỸ THUẬT CÔNG NGHỆ RẤT DÀI', ct: ctGtgt }), PHONG)
kiem('01/GTGT tháng, bổ sung lần 2, tên công ty dài 2 dòng → vẫn dựng được', (await soTrang(b2)) >= 2, true)
const b3 = await dungPdfToKhaiMau(xmlGia({ ma: '864', ten: 'TK khấu trừ thuế thu nhập cá nhân Mẫu 05/KK-TNCN (TT80/2021)', ct: '<ct15>0</ct15><ct16>3</ct16><ct21>45000000</ct21><ct29>1200000</ct29>' }), PHONG)
kiem('05/KK-TNCN: 2 trang như bản gốc (khối chữ ký + ghi chú sang trang 2)', await soTrang(b3), 2)
kiem('nhúng NGUYÊN phông (bản cắt gọn của pdf-lib làm hỏng nét chữ tiếng Việt) → file > 500 KB', b1.length > 500e3, true)

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
