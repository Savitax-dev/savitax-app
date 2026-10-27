// Chạy Soát xét báo cáo năm trên MỘT thư mục công ty thật — CHỈ ĐỌC (fs.readdir / readFile).
//   node scripts/soat-soatbaocao-thu-muc-that.mjs "<thư mục công ty>" <năm>
// In loại tài liệu nhận ra theo năm + số vấn đề theo nhóm / mức — KHÔNG in số tiền của khách. Chỉ chạy trên thư mục anh cho đọc.
import fs from 'node:fs'
import path from 'node:path'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import { docHoSoSoat, tinhNamSoat } from '../lib/soatbaocao/docThuMuc.js'
import { caiDomParser } from './lib-dom-node.mjs'
caiDomParser()

const [goc, namS] = process.argv.slice(2)
const nam = Number(namS)
if (!goc || !fs.existsSync(goc) || !nam) { console.log('Cách chạy: node scripts/soat-soatbaocao-thu-muc-that.mjs "<thư mục công ty>" <năm>'); process.exit(1) }
const tayFile = p => ({ name: path.basename(p), kind: 'file', getFile: async () => { const st = fs.statSync(p); return { name: path.basename(p), size: st.size, lastModified: st.mtimeMs, text: async () => fs.readFileSync(p, 'utf8'), arrayBuffer: async () => fs.readFileSync(p) } } })
const tayThuMuc = p => ({ name: path.basename(p), kind: 'directory', async *entries() { for (const d of fs.readdirSync(p, { withFileTypes: true })) { if (d.name === 'desktop.ini') continue; const c = path.join(p, d.name); yield [d.name, d.isDirectory() ? tayThuMuc(c) : tayFile(c)] } } })

const t0 = Date.now()
const quet = await quetCongTy(tayThuMuc(goc), { tuNam: nam - 1 })
const hs = await docHoSoSoat({ quetTheoNam: quet.nam })
console.log(`Năm thư mục: ${Object.keys(quet.nam).join(', ')} · năm có dữ liệu: ${hs.cacNam.join(', ')} · ${Math.round((Date.now() - t0) / 1000)} giây`)
const dem = {}
for (const f of hs.file) { const k = `${f.nam} ${f.kind}`; dem[k] = (dem[k] || 0) + 1 }
console.log('Nhận ra:', Object.entries(dem).sort().map(([k, v]) => `${k}×${v}`).join(' · '))
console.log(`Bỏ qua ${hs.boQua} file / bảng không nhận ra hoặc hóa đơn lẻ · lỗi ${hs.loi.length}`)
for (const l of hs.loi) console.log('  ✗', l.tep.ten, '—', l.loi)
if (!hs.cacNam.includes(nam)) { console.log(`Không có dữ liệu năm ${nam}`); process.exit(0) }
const C = tinhNamSoat(hs.X, nam)
const S = hs.X.getS()
console.log(`\nNăm ${nam} · chế độ ${S.meta.cheDo} · BCTC ${Object.keys(S.v).length} chỉ tiêu · CĐPS ${S.tb.length} TK · tờ khai GTGT ${S.tk.length} · tờ khai khác ${S.dk.length} · sổ: ${Object.entries(S.bk || {}).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => k + ' ' + v.length).join(', ') || '—'}`)
const nhom = {}
for (const r of C.Rk) { const k = `${r.cat}/${r.sev}`; nhom[k] = (nhom[k] || 0) + 1 }
console.log('Vấn đề:', C.Rk.length, '·', Object.entries(nhom).sort().map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('Cân đối:', C.C.map(c => `${c.id}:${c.st}`).join(' '), '· đối chiếu', C.RC.length, '(fail', C.RC.filter(r => r.st === 'fail').length + ')')
