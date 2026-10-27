// Chạy phần đọc thư mục + tự tìm số của Rủi ro thuế trên MỘT thư mục công ty thật — CHỈ ĐỌC (fs.readdir / readFile).
//   node scripts/soat-ruiro-thu-muc-that.mjs "<thư mục công ty>" <năm> [MST] [--hoadon]
// In tóm tắt (số file, loại, trạng thái từng tiêu chí, nguồn số tự tìm) — KHÔNG in số tiền của khách.
// Chỉ chạy trên thư mục anh đã cho phép đọc.
import fs from 'node:fs'
import path from 'node:path'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import Risk from '../lib/ruiro/risk.js'
import { docHoSoRuiRo } from '../lib/ruiro/docThuMuc.js'
import { tuTimSoLieu, ganSoLieu } from '../lib/ruiro/tuTim.js'

const [goc, namS, mstArg] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const docHoaDon = process.argv.includes('--hoadon')
const nam = Number(namS)
if (!goc || !fs.existsSync(goc) || !nam) { console.log('Cách chạy: node scripts/soat-ruiro-thu-muc-that.mjs "<thư mục công ty>" <năm> [MST] [--hoadon]'); process.exit(1) }

const tayFile = p => ({
  name: path.basename(p), kind: 'file',
  getFile: async () => { const st = fs.statSync(p); return { name: path.basename(p), size: st.size, lastModified: st.mtimeMs, text: async () => fs.readFileSync(p, 'utf8'), arrayBuffer: async () => fs.readFileSync(p) } },
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

const t0 = Date.now()
const quet = await quetCongTy(tayThuMuc(goc), { tuNam: nam - 1 })
console.log('Năm quét được:', Object.keys(quet.nam).join(', ') || '(không có)')
for (const c of quet.canhBao) console.log('  ⚠', c)
const kq = await docHoSoRuiRo({ nam, quetTheoNam: quet.nam, mst: mstArg || '', docHoaDon })
const dem = kq.items.reduce((m, i) => (m[i.kind + ' ' + i.year] = (m[i.kind + ' ' + i.year] || 0) + 1, m), {})
console.log(`Đọc ${kq.items.length} tờ khai/BCTC dùng được:`, dem, `· bỏ qua ${kq.boQua} file không dùng · ngoài năm ${kq.ngoaiNam} · ${Math.round((Date.now() - t0) / 1000)} giây`)
for (const l of kq.loi) console.log('  ✗', l.tep.ten, '—', l.loi)
if (kq.nen.length) console.log(`  ${kq.nen.length} file nén chưa giải nén: ${kq.nen.join(', ')}`)
for (const c of kq.canhBao) console.log('  ⚠', c)
if (kq.thieuNamTruoc) console.log(`  (không có thư mục năm ${nam - 1})`)
if (kq.hoaDon) console.log(`Hóa đơn XML đọc được (mua vào lọc theo MST người mua): ${kq.hoaDon.length}`)
const mst = mstArg || kq.client.decls[0]?.mst || ''
kq.client.mst = mst

const { inputs, bang } = tuTimSoLieu(kq.client, nam, { hoaDon: kq.hoaDon })
console.log('\nTự tìm số (ô bản cũ nhập tay):')
for (const d of bang) console.log(`  ${d.trangThai.padEnd(9)} ${d.ten} [${d.tieuChi}] ← ${d.nguon || '—'}${d.ghiChu.length ? '\n              ' + d.ghiChu.map(s => s.replace(/[\d.]{5,}/g, '…')).join('\n              ') : ''}`)

const ev = Risk.evaluateYear(ganSoLieu(kq.client, nam, inputs), nam)
const theoMuc = ev.results.reduce((m, r) => ((m[r.level] = m[r.level] || []).push(r.id), m), {})
console.log(`\nKết quả ${ev.results.length} tiêu chí năm ${nam}:`)
for (const [muc, ds] of Object.entries(theoMuc)) console.log(`  ${muc.padEnd(8)} ${ds.length}: ${ds.join(' ')}`)
const thieu = ev.results.filter(r => r.level === 'missing')
const lyDo = thieu.reduce((m, r) => { for (const d of r.missingDocs || ['?']) (m[d] = m[d] || []).push(r.id); return m }, {})
if (thieu.length) { console.log('  Thiếu dữ liệu vì:'); for (const [d, ids] of Object.entries(lyDo)) console.log(`    ${d}: ${ids.join(' ')}`) }
