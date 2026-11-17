// Dựng bản HTML chạy riêng trên máy "Savitax Hồ Sơ" (Soát xét báo cáo + Rủi ro thuế + Hồ sơ chứng từ) thành MỘT file:
//   node scripts/dung-ban-roi.mjs            → dist-ban-roi/Savitax-HoSo.html
//   node scripts/dung-ban-roi.mjs --kich-co  → in thêm các thư viện nặng nhất
// Gói nguyên mã màn hình của app (không sửa app) + banRoi/ (khung, kho trên máy, bản thay Next.js / máy chủ). Thư viện,
// worker pdf.js, logo, CSS đều nhúng sẵn — file chạy không cần mạng. Kế hoạch: docs/ban-html-roi-ke-hoach.md.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { VA_CHU, apVaChu } from '../banRoi/vaChu.mjs'

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RA = path.join(GOC, 'dist-ban-roi')
const NGAY = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const PHIEN_BAN = '1.0'   // hiện trên màn hình; ngày dựng chỉ ghi trong chú thích ẩn của file HTML

// Những chỗ mã app dựa vào Next.js / máy chủ → bản chạy trên máy
const THAY = {
  'next/navigation': 'banRoi/shim/dieuHuong.js',
  'next/link': 'banRoi/shim/link.jsx',
  '@/lib/supabase': 'banRoi/shim/supabase.js',
  '@/components/AppShell': 'banRoi/khung/AppShell.jsx',
  '@/components/ThanhTab': 'banRoi/shim/ThanhTab.jsx',      // bỏ tab Tăng trưởng & phí
  '@/components/phanTich/HanNopKy': 'banRoi/shim/HanNopKy.jsx', // hạn nộp tự tính, không có trạng thái nộp từ cổng
}

const banRoi = {
  name: 'ban-roi',
  setup(b) {
    // import x from '…?text' → nội dung file dạng chữ (worker pdf.js, tài liệu .md)
    b.onResolve({ filter: /\?text$/ }, async a => {
      const r = await b.resolve(a.path.replace(/\?text$/, ''), { resolveDir: a.resolveDir, kind: a.kind })
      if (r.errors.length) return { errors: r.errors }
      return { path: r.path, namespace: 'chu' }
    })
    b.onLoad({ filter: /.*/, namespace: 'chu' }, a => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'text' }))
    b.onResolve({ filter: /^(next\/navigation|next\/link|@\/lib\/supabase|@\/components\/AppShell|@\/components\/ThanhTab|@\/components\/phanTich\/HanNopKy)$/ }, a => ({ path: path.join(GOC, THAY[a.path]) }))
    // Bí danh "@/…" của app (jsconfig) = thư mục gốc repo
    b.onResolve({ filter: /^@\// }, a => b.resolve('./' + a.path.slice(2), { resolveDir: GOC, kind: a.kind }))
    // Thay chữ chỉ-đúng-trong-app ở vài file dùng chung (banRoi/vaChu.mjs) — không sửa file gốc
    const canVa = new Set(VA_CHU.map(([t]) => path.join(GOC, t)))
    b.onLoad({ filter: /\.js$/ }, a => {
      if (!canVa.has(a.path)) return undefined
      return { contents: apVaChu(path.relative(GOC, a.path).replace(/\\/g, '/'), fs.readFileSync(a.path, 'utf8')), loader: 'jsx', resolveDir: path.dirname(a.path) }
    })
  },
}

// Worker pdf.js gốc là ES module. Trang mở từ ổ đĩa (file://) thì Chrome chặn worker DẠNG MODULE dựng từ Blob → pdf.js chờ
// worker trả lời mãi, màn Soát xét đứng ở file PDF đầu tiên (anh gặp 15/11/2026, 355 DECOR "Đang đọc tờ khai 6/8"). Dựng sẵn
// worker sang dạng thường (classic, IIFE) — dạng này chạy được cả trên file://.
const workerPdf = (await esbuild.build({
  entryPoints: [path.join(GOC, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')],
  bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: ['chrome105', 'edge105'],
  logLevel: 'error', logOverride: { 'empty-import-meta': 'silent' },
})).outputFiles[0].text
const workerPlugin = {
  name: 'worker-pdf',
  setup(b) {
    b.onResolve({ filter: /^ban-roi:worker-pdf$/ }, () => ({ path: 'worker-pdf', namespace: 'worker-pdf' }))
    b.onLoad({ filter: /.*/, namespace: 'worker-pdf' }, () => ({ contents: workerPdf, loader: 'text' }))
  },
}

const kichCo = process.argv.includes('--kich-co')
const js = await esbuild.build({
  entryPoints: [path.join(GOC, 'banRoi/vao.jsx')],
  bundle: true, write: false, minify: true, metafile: kichCo,
  format: 'iife', platform: 'browser', target: ['chrome105', 'edge105'],
  jsx: 'automatic', loader: { '.js': 'jsx', '.png': 'dataurl' },
  charset: 'utf8',   // giữ chữ tiếng Việt nguyên dạng (file trang khai <meta charset="utf-8">), nhẹ hơn \uXXXX, dễ soát
  define: { 'process.env.NODE_ENV': '"production"', __PHIEN_BAN__: JSON.stringify(PHIEN_BAN) },
  logLevel: 'warning', logOverride: { 'empty-import-meta': 'silent', 'unsupported-dynamic-import': 'silent' },
  plugins: [workerPlugin, banRoi],
})
if (kichCo) {
  const theoGoi = {}
  for (const [f, v] of Object.entries(js.metafile.outputs[Object.keys(js.metafile.outputs)[0]].inputs)) {
    const g = (f.match(/node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/) || [, '(mã app + bản rời)'])[1]
    theoGoi[g] = (theoGoi[g] || 0) + v.bytesInOutput
  }
  console.log(Object.entries(theoGoi).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g, n]) => `  ${(n / 1024).toFixed(0).padStart(6)} KB  ${g}`).join('\n'))
}

const nguonCss = path.join(GOC, 'banRoi/kieu.css')
const css = (await postcss([tailwind({ base: GOC, optimize: { minify: true } })]).process(fs.readFileSync(nguonCss, 'utf8'), { from: nguonCss })).css

// CSS của phân hệ Hồ sơ chứng từ (JS thuần, banRoi/hoSoChungTu) viết cho một trang riêng: :root, body, *, h1… → bọc hết dưới
// .hsct để không đụng phần còn lại; bỏ giao diện tối (bản rời luôn sáng). #printArea / #pdfInner nằm NGOÀI khung (con của
// <body> / bản sao của html2pdf) nhưng tự mang class hsct, nên bộ chọn bắt đầu bằng chúng (và "body > …" của lệnh in) giữ nguyên.
const bocCssHsct = {
  postcssPlugin: 'boc-hsct',
  Once(goc) {
    goc.walkAtRules('media', at => { if (/prefers-color-scheme/.test(at.params)) at.remove() })
    goc.walkRules(r => {
      if (r.parent?.type === 'atrule' && /keyframes/i.test(r.parent.name)) return
      if (r.selector.includes('data-theme')) { r.remove(); return }
      const ds = r.selectors.flatMap(c => {
        c = c.trim()
        if (c === 'body::before') return []
        if (/^(#printArea|#pdfInner|\.hsct|body\s*>)/.test(c)) return [c]
        if (/^(:root|html|body)$/.test(c)) return ['.hsct']
        return ['.hsct ' + c]
      })
      if (ds.length) r.selectors = [...new Set(ds)]; else r.remove()
    })
  },
}
// Mã JS thuần của Hồ sơ chứng từ chạy bằng new Function lúc mở trang — esbuild chỉ gói nó dạng CHỮ nên không bắt lỗi cú pháp.
// Thử dịch ở đây (17/11/2026: một dấu " lọt vào chuỗi làm phân hệ không mở được mà bản dựng vẫn báo OK).
for (const f of fs.readdirSync(path.join(GOC, 'banRoi/hoSoChungTu')).filter(f => f.endsWith('.js'))) {
  try { new Function(fs.readFileSync(path.join(GOC, 'banRoi/hoSoChungTu', f), 'utf8')) } catch (e) {
    console.error(`DỪNG: banRoi/hoSoChungTu/${f} lỗi cú pháp — ${e.message}`); process.exit(1)
  }
}
const nguonHsct = path.join(GOC, 'banRoi/hoSoChungTu/kieu.css')
const cssHsct = (await postcss([bocCssHsct]).process(fs.readFileSync(nguonHsct, 'utf8'), { from: nguonHsct })).css
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n')

const maJs = js.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1')
const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Savitax Hồ Sơ</title>
<!-- Bản quyền © Savitax — Soát xét báo cáo · Rủi ro thuế · Hồ sơ chứng từ. Phiên bản ${PHIEN_BAN}, dựng ${NGAY}. Chạy thẳng trên Chrome / Edge, không cần mạng. -->
<style>${css}</style>
<style>${cssHsct}</style>
</head>
<body>
<div id="goc"><p style="font-family:Arial;padding:24px;color:#666">Đang mở Savitax Hồ Sơ…</p></div>
<noscript>Cần bật JavaScript.</noscript>
<script>${maJs}</script>
</body>
</html>
`
// Không được còn tên đơn vị nguồn cũ trong file giao ra ngoài (từ khoá CỐ Ý để ngoài repo, như test-phantich-thuong-hieu).
// Khớp theo TỪ (có ranh giới chữ): từ khoá ngắn nằm lọt trong chữ khác của thư viện ("smartTagPr", base64) không tính.
const tepTuKhoa = process.env.THUONG_HIEU_TU_KHOA || path.join(os.homedir(), '.savitax-keys', 'tu-khoa-thuong-hieu-cu.txt')
if (fs.existsSync(tepTuKhoa)) {
  const thoat = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tuKhoa = fs.readFileSync(tepTuKhoa, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  const con = tuKhoa.filter(k => new RegExp('(?<![\\p{L}\\p{N}])' + thoat(k) + '(?![\\p{L}\\p{N}])', 'iu').test(html))
  if (con.length) { console.error(`DỪNG: file dựng còn ${con.length} tên đơn vị nguồn cũ — tìm bằng scripts/test-phantich-thuong-hieu.mjs`); process.exit(1) }
} else console.warn('⚠ Không có file từ khoá thương hiệu (~/.savitax-keys) — bỏ qua bước kiểm tên đơn vị nguồn cũ')

fs.mkdirSync(RA, { recursive: true })
const tep = path.join(RA, 'Savitax-HoSo.html')
fs.writeFileSync(tep, html)
console.log(`OK ${path.relative(GOC, tep)} — ${(html.length / 1024 / 1024).toFixed(2)} MB (JS ${(maJs.length / 1024).toFixed(0)} KB, CSS ${((css.length + cssHsct.length) / 1024).toFixed(0)} KB) · phiên bản ${PHIEN_BAN}`)
