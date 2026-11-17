// Đóng gói bộ giao khách của bản rời "Savitax Hồ Sơ" (GĐ 5):
//   node scripts/dong-goi-ban-roi.mjs        → dist-ban-roi/Savitax-HoSo-v<bản>/  +  dist-ban-roi/Savitax-HoSo-v<bản>.zip
//     Savitax-HoSo-v<bản>.html     — dựng lại bằng scripts/dung-ban-roi.mjs
//     Mau-danh-sach-cong-ty.xlsx   — cùng nguồn với nút "File Excel mẫu" (banRoi/mauCongTy.js)
//     HUONG-DAN.pdf                — in từ banRoi/huongDan/HUONG-DAN.html, ảnh chụp tự động
// Đồng thời là bài THỬ MÁY SẠCH: mở file bằng Chrome / Edge hồ sơ trắng, CHẶN MẠNG, qua file:// — trang nào không lên, khung tự
// kiểm máy có ❌, hoặc console có lỗi thì DỪNG, không đóng gói. Ảnh chụp dùng công ty GIẢ (MST 9999…), không đụng dữ liệu thật.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { soExcelMoi, themSheetMang } from '../lib/excelDep.js'
import { COT, DO_RONG, HANG_MAU } from '../banRoi/mauCongTy.js'

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RA = path.join(GOC, 'dist-ban-roi')
const PHIEN_BAN = fs.readFileSync(path.join(GOC, 'scripts/dung-ban-roi.mjs'), 'utf8').match(/const PHIEN_BAN = '([^']+)'/)[1]
const NGAY = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const TEN = `Savitax-HoSo-v${PHIEN_BAN}`
const THU_MUC = path.join(RA, TEN)
const ngu = ms => new Promise(r => setTimeout(r, ms))
const dung = msg => { console.error('DỪNG: ' + msg); process.exit(1) }

// 1. Dựng file HTML
const d = spawnSync(process.execPath, [path.join(GOC, 'scripts/dung-ban-roi.mjs')], { stdio: 'inherit' })
if (d.status !== 0) dung('dựng bản rời lỗi')
const TEP_HTML = path.join(RA, 'Savitax-HoSo.html')

// 2. Trình duyệt hồ sơ trắng, chặn mạng (máy chủ DNS trả "không có" cho mọi tên miền)
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p)) || dung('không thấy Chrome / Edge')
const HO_SO = fs.mkdtempSync(path.join(os.tmpdir(), 'savitax-hoso-trang-'))
const CONG = 9300 + Math.floor(Math.random() * 600)
const cr = spawn(CHROME, ['--headless=new', `--user-data-dir=${HO_SO}`, `--remote-debugging-port=${CONG}`,
  '--host-resolver-rules=MAP * ~NOTFOUND', '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const donDep = () => { try { cr.kill() } catch {} ; ngu(500).then(() => fs.rmSync(HO_SO, { recursive: true, force: true })) }
process.on('exit', () => { try { cr.kill() } catch {} })

let dsTab
for (let i = 0; i < 60; i++) {
  try { dsTab = await (await fetch(`http://127.0.0.1:${CONG}/json/list`)).json(); if (dsTab.some(t => t.type === 'page')) break } catch {}
  await ngu(250)
}
if (!dsTab) dung('không kết nối được trình duyệt')
const ws = new WebSocket(dsTab.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise((ok, hong) => { ws.addEventListener('open', ok); ws.addEventListener('error', hong) })
let soId = 0
const choTraLoi = new Map()
const loi = []
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data)
  if (m.id && choTraLoi.has(m.id)) { choTraLoi.get(m.id)(m); choTraLoi.delete(m.id) }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') loi.push(m.params.args.map(a => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown') loi.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
})
const goi = (method, params = {}) => new Promise((ok, hong) => {
  const i = ++soId
  choTraLoi.set(i, m => m.error ? hong(new Error(method + ': ' + m.error.message)) : ok(m.result))
  ws.send(JSON.stringify({ id: i, method, params }))
})
const tinh = async expr => {
  const r = await goi('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
const coChu = chu => tinh(`document.body.innerText.includes(${JSON.stringify(chu)})`)
async function choChu(chu, giay = 30) {
  for (let i = 0; i < giay * 4; i++) { if (await coChu(chu)) return; await ngu(250) }
  dung(`không thấy "${chu}" sau ${giay} giây (${await tinh('location.hash')})`)
}
const khung = (rong, cao) => goi('Emulation.setDeviceMetricsOverride', { width: rong, height: cao, deviceScaleFactor: 1, mobile: false })
await goi('Runtime.enable'); await goi('Page.enable')
await khung(1440, 900)

const URL_APP = pathToFileURL(TEP_HTML).href
async function moTrang(hash, chu, doi = 800) {
  await tinh(`location.hash = ${JSON.stringify(hash)}`)
  await choChu(chu); await ngu(doi)
}
const ANH = {}
async function chup(ten, cao = 900) {
  await khung(1440, cao)
  await ngu(300)
  ANH[ten] = 'data:image/png;base64,' + (await goi('Page.captureScreenshot', { format: 'png' })).data
  await khung(1440, 900)
}

// 3. Thử máy sạch
console.log(`Thử máy sạch: ${path.basename(CHROME)} hồ sơ trắng, chặn mạng, ${URL_APP}`)
await goi('Page.navigate', { url: URL_APP + '#/' })
await choChu('Máy này chạy được không')
for (let i = 0; i < 60 && await coChu('đang thử'); i++) await ngu(250)   // chờ bài đọc thử PDF
const tuKiem = await tinh(`[...document.querySelectorAll('p')].filter(p => /^(✅|❌|⏳)/.test(p.innerText)).map(p => p.innerText)`)
console.log(tuKiem.map(s => '  ' + s).join('\n'))
if (tuKiem.length !== 4 || tuKiem.some(s => !s.startsWith('✅'))) dung('khung "Máy này chạy được không" chưa đủ 4 dấu ✅')
const TRANG = [
  ['#/cong-ty', 'Thêm công ty'], ['#/soatbaocao', 'Công ty của tôi'], ['#/soatbaocao/huong-dan', 'SVT.MB09'],
  ['#/soatbaocao/quy-uoc', 'BỘ BÁO CÁO'], ['#/ruirothue', 'Bảng 39 tiêu chí'], ['#/ruirothue/huong-dan', 'Hướng dẫn'],
  ['#/ho-so-chung-tu', 'Lập hồ sơ'], ['#/cai-dat', 'Sao lưu'],
]
for (const [h, chu] of TRANG) { await moTrang(h, chu, 300); console.log('  ✅ ' + h) }

// 4. Ảnh cho hướng dẫn — nạp 3 công ty GIẢ thẳng vào kho của bản rời rồi tải lại trang
const CTY_GIA = [
  { id: 'gia1', maKH: 'HONGDUC', ten: 'CÔNG TY TNHH MẪU HỒNG ĐỨC', mst: '9999000011', kyKhai: 'quy', laHkd: false, dc: 'Số 1 Đường Mẫu, TP. Mẫu', batDau: '2026-01-01' },
  { id: 'gia2', maKH: 'NAMVIET', ten: 'CÔNG TY CỔ PHẦN MẪU NAM VIỆT', mst: '9999000022', kyKhai: 'thang', laHkd: false, dc: 'Số 2 Đường Mẫu, TP. Mẫu', batDau: '2025-07-01' },
  { id: 'gia3', maKH: 'HKDAN', ten: 'HỘ KINH DOANH MẪU AN', mst: '9999000033', kyKhai: 'quy', laHkd: true, dc: 'Số 3 Đường Mẫu, TP. Mẫu', batDau: '2026-04-01' },
]
await tinh(`new Promise((ok, hong) => {
  const yc = indexedDB.open('savitax-hoso-ban-roi', 1)
  yc.onsuccess = () => {
    const t = yc.result.transaction('kv', 'readwrite'), kv = t.objectStore('kv')
    kv.put(${JSON.stringify(CTY_GIA)}, 'congTy')
    const r = kv.get('caiDat')
    r.onsuccess = () => kv.put({ ...(r.result || {}), ctyDangLam: 'gia1' }, 'caiDat')
    t.oncomplete = () => { yc.result.close(); ok(true) }
    t.onerror = () => hong(t.error)
  }
  yc.onerror = () => hong(yc.error)
})`)
await goi('Page.reload')
await ngu(500)
await moTrang('#/', 'Máy này chạy được không', 2500); await chup('tongquan', 820)
await moTrang('#/cong-ty', 'MẪU NAM VIỆT', 800); await chup('congty', 640)
await moTrang('#/soatbaocao/huong-dan', 'SVT.MB09', 800); await chup('soat', 900)
await moTrang('#/ho-so-chung-tu', 'Lập hồ sơ', 2500); await chup('chungtu', 820)
await moTrang('#/cai-dat', 'Sao lưu', 800); await chup('caidat', 820)
if (loi.length) dung('console có lỗi:\n' + loi.join('\n'))

// 5. Hướng dẫn PDF — in bằng chính trình duyệt đó
fs.rmSync(THU_MUC, { recursive: true, force: true })
fs.mkdirSync(THU_MUC, { recursive: true })
let hd = fs.readFileSync(path.join(GOC, 'banRoi/huongDan/HUONG-DAN.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replaceAll('{{PHIEN_BAN}}', PHIEN_BAN).replaceAll('{{NGAY}}', NGAY)
  .replace(/\{\{ANH:(\w+)\}\}/g, (_, t) => ANH[t] || dung(`hướng dẫn cần ảnh "${t}" mà script không chụp`))
if (/\{\{/.test(hd)) dung('HUONG-DAN.html còn chỗ {{…}} chưa thay')
const tepHd = path.join(HO_SO, 'huong-dan.html')
fs.writeFileSync(tepHd, hd)
await goi('Page.navigate', { url: pathToFileURL(tepHd).href })
await ngu(1500)
const pdf = await goi('Page.printToPDF', {
  printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#9ca3af;padding:0 15mm;display:flex;justify-content:space-between;font-family:Arial">
    <span>Savitax Hồ Sơ v${PHIEN_BAN} — Hướng dẫn sử dụng · Bản quyền © Savitax</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
})
fs.writeFileSync(path.join(THU_MUC, 'HUONG-DAN.pdf'), Buffer.from(pdf.data, 'base64'))
ws.close(); donDep()

// 6. File HTML + Excel mẫu
fs.copyFileSync(TEP_HTML, path.join(THU_MUC, TEN + '.html'))
const wb = await soExcelMoi()
wb.creator = 'Savitax'
themSheetMang(wb, 'Danh sách công ty', [COT, ...HANG_MAU], { doRong: DO_RONG })
fs.writeFileSync(path.join(THU_MUC, 'Mau-danh-sach-cong-ty.xlsx'), Buffer.from(await wb.xlsx.writeBuffer()))

// 7. ZIP
const zip = new JSZip()
for (const f of fs.readdirSync(THU_MUC)) zip.file(`${TEN}/${f}`, fs.readFileSync(path.join(THU_MUC, f)), { date: new Date() })
const tepZip = path.join(RA, TEN + '.zip')
fs.writeFileSync(tepZip, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }))

const kb = p => (fs.statSync(p).size / 1024).toFixed(0).padStart(6) + ' KB'
console.log(`\nOK ${path.relative(GOC, THU_MUC)}\\`)
for (const f of fs.readdirSync(THU_MUC)) console.log(`  ${kb(path.join(THU_MUC, f))}  ${f}`)
console.log(`OK ${path.relative(GOC, tepZip)} — ${kb(tepZip).trim()}`)
