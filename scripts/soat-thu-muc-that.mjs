// Chạy bộ quét + kiểm kê của màn "Hồ sơ dữ liệu" trên MỘT thư mục thật trên máy — CHỈ ĐỌC (fs.readdir / readFile).
// Dùng để soát bộ đọc với cây thư mục thật, không cần mở trình duyệt.
//   node scripts/soat-thu-muc-that.mjs "<thư mục công ty hoặc thư mục năm>" [quy|thang] [YYYY-MM-DD]
// In ra tóm tắt, KHÔNG in số liệu tờ khai. Chỉ chạy trên thư mục anh đã cho phép đọc.
import fs from 'node:fs'
import path from 'node:path'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import { docToKhaiCuaNam, docBangKeCuaNam } from '../lib/phanTich/docHoSo.js'
import { docExcel } from '../lib/phanTich/doc/excel.js'
import { kiemKeNam, gomCay } from '../lib/phanTich/kiemKe.js'
import { layDongPdf } from '../lib/phanTich/doc/pdfChu.js'
import { docToKhaiPdfChu } from '../lib/phanTich/doc/toKhaiPdf.js'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const docPdf = async buf => docToKhaiPdfChu(await layDongPdf(buf, { pdfjs }))

const goc = process.argv[2]
const kyKhai = process.argv[3] === 'thang' ? 'thang' : 'quy'
const homNay = process.argv[4] || new Date().toISOString().slice(0, 10)
const mstCty = process.argv[5] || ''
if (!goc || !fs.existsSync(goc)) { console.log('Thiếu hoặc sai đường dẫn thư mục'); process.exit(1) }

// Tay cầm giả bám giao diện FileSystemDirectoryHandle — chỉ đọc
const tayFile = p => ({
  name: path.basename(p), kind: 'file',
  getFile: async () => { const st = fs.statSync(p); return { size: st.size, lastModified: st.mtimeMs, text: async () => fs.readFileSync(p, 'utf8'), arrayBuffer: async () => fs.readFileSync(p) } },
})
const tayThuMuc = p => ({
  name: path.basename(p), kind: 'directory',
  async *entries() {
    for (const d of fs.readdirSync(p, { withFileTypes: true })) {
      if (d.name === 'desktop.ini') continue
      const con = path.join(p, d.name)
      yield [d.name, d.isDirectory() ? tayThuMuc(con) : tayFile(con)]
    }
  },
})

const kq = await quetCongTy(tayThuMuc(goc))
console.log('Tầng:', kq.tang, '· năm:', Object.keys(kq.nam).join(', ') || '(không có)', '· bỏ qua:', kq.namBoQua.join(', ') || '—')
for (const c of kq.canhBao) console.log('  ⚠', c)
for (const [nam, qn] of Object.entries(kq.nam)) {
  const doc = await docToKhaiCuaNam(qn, { docPdf })
  console.log(`\n== Năm ${nam}: ${doc.toKhai.length} tờ khai đọc được, ${doc.loi.length} lỗi`)
  for (const t of doc.toKhai) console.log(`   ${t.loai} ${t.maKy} ${t.chinhThuc ? 'chính thức' : 'BS lần ' + t.lanBoSung} [${t.nguon}] ← ${t.tep.ten}`)
  if (doc.scan.length) console.log(`   ${doc.scan.length} PDF ảnh scan: ${doc.scan.map(t => t.ten).join(', ')}`)
  for (const l of doc.loi) console.log(`   LỖI ${l.tep.ten}: ${l.loi}`)
  const bk = await docBangKeCuaNam(qn, { docExcelBuf: async b => docExcel(b), mstCty: mstCty || doc.toKhai[0]?.mst || '' })
  for (const b of bk.bangKe) console.log(`   bảng kê ${b.mau} ${b.chieu} ${b.soHd} HĐ ${b.thang.join(',')} kỳ thư mục ${b.kyThuMuc?.ma || '—'} ← ${b.tep.ten} [${b.sheet}]`)
  for (const l of bk.loi) console.log(`   LỖI bảng kê ${l.tep.ten}: ${l.loi}`)
  const kk = kiemKeNam(qn, doc.toKhai, { kyKhai, homNay, loiDoc: doc.loi.length + bk.loi.length, bangKe: bk.bangKe })
  for (const c of kk.canhBao) console.log('  ⚠', c)
  console.log('  Ô tổng:', JSON.stringify({ ...kk.oTong, thieuO: kk.oTong.thieuO.length }))
  for (const n of gomCay(kk.dong)) {
    const in1 = (d, thut) => console.log(`  ${thut}${(d.tenCon || d.ten).padEnd(44 - thut.length)} ${d.trangThai.padEnd(9)} ${String(d.soFile ?? '—').padStart(5)}  ${d.moTa || ''}`)
    if (n.loai === 'don') in1(n.d, '')
    else { console.log(`  ${n.ten.padEnd(44)} ${n.trangThai.padEnd(9)} ${String(n.soFile ?? '—').padStart(5)}`); n.con.forEach(c => in1(c.d, '   └ ')) }
  }
  for (const l of kk.luoi) console.log(`  ${l.nhan.padEnd(24)} ${l.o.map(x => `${x.ma}:${x.tt}`).join('  ')}`)
}
