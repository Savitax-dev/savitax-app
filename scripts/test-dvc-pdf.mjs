// Dò xem cổng Dịch vụ công có phát PDF không — Phân hệ Tờ khai, GĐ 6.
//
// Câu hỏi cần trả lời:
//   1. Lệnh tải thông báo có tham số `loaiTBao` — gửi giá trị nào thì ra PDF?
//   2. Nút "Xem tài liệu" trên trang chi tiết (data-tai-lieu-dkem) trả về gì?
//
// Nếu cổng vốn đã phát PDF thì KHÔNG cần viết bộ dựng PDF — dùng bản gốc của cổng bao giờ cũng
// hơn bản mình tự vẽ lại.
//
// Chạy:  node scripts/test-dvc-pdf.mjs --tu 05/07/2026 --den 03/08/2026
// Captcha do người gõ. Đăng nhập chỉ thử 1 lần. Luôn đăng xuất.

import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const TU = arg('tu', '05/07/2026')
const DEN = arg('den', '03/08/2026')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const USER = process.env.DVC_USER || (await rl.question('Tên đăng nhập (dạng <MST>-QL): ')).trim()
const PASS = process.env.DVC_PASS || (await rl.question('Mật khẩu: ')).trim()

const jar = new Map()
function nhoCookie(res) {
  for (const d of res.headers.getSetCookie?.() || []) {
    const [c] = d.split(';'); const i = c.indexOf('=')
    if (i > 0) jar.set(c.slice(0, i).trim(), c.slice(i + 1).trim())
  }
}
async function goi(url, init = {}) {
  const res = await fetch(url, {
    ...init, redirect: 'manual',
    headers: {
      'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9',
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(init.headers || {}),
    },
  })
  nhoCookie(res)
  return res
}
function moFile(p) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', p], { detached: true, stdio: 'ignore' }).unref()
  } catch { /* in đường dẫn ở dưới rồi */ }
}
const docCsrf = h => h.match(/name="csrf-token" content="([^"]+)"/)?.[1] || h.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]

// Nhìn vài byte đầu là biết thật sự là file gì, không tin mỗi content-type.
function nhanDang(buf) {
  const d = buf.subarray(0, 5).toString('binary')
  if (d.startsWith('%PDF')) return 'PDF'
  if (d.startsWith('PK')) return 'ZIP'
  if (buf.subarray(0, 200).toString('utf8').includes('<?xml')) return 'XML'
  if (d.startsWith('{') || d.startsWith('[')) return 'JSON'
  return 'khác'
}

let daDangNhap = false
try {
  console.log('\n[1] Đăng nhập…')
  const tr = await goi(BASE + 'login')
  let csrf = docCsrf(await tr.text())

  const anh = await goi(`${BASE}login/getCaptcha?${Date.now()}`, { headers: { Referer: BASE + 'login', Accept: 'image/*' } })
  const ab = Buffer.from(await anh.arrayBuffer())
  const ap = join(tmpdir(), `capt-${Date.now()}.png`); writeFileSync(ap, ab); moFile(ap)
  console.log('    ảnh captcha:', ap)
  const ma1 = (await rl.question('    Mã captcha đăng nhập: ')).trim()

  const dn = await goi(BASE + 'loginLDAP', {
    method: 'POST',
    body: new URLSearchParams({ tenDN: USER, matKhau: Buffer.from(PASS, 'utf8').toString('base64'), doiTuong: 'DN', captcha: ma1, _csrf: csrf }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-XSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest', Referer: BASE + 'login', Origin: ORIGIN,
    },
  })
  const raw = await dn.text()
  if (!/"status"\s*:\s*"?20[01]"?/.test(raw)) { console.log('    KHÔNG đăng nhập được:', raw.slice(0, 200)); process.exit(1) }
  daDangNhap = true
  console.log('    OK')

  const tchs = await goi(BASE + 'tchs', { headers: { Referer: BASE + 'home' } })
  csrf = docCsrf(await tchs.text()) || csrf

  console.log('\n[2] Tra cứu…')
  const anh2 = await goi(`${BASE}login/getCaptcha?${Date.now()}`, { headers: { Referer: BASE + 'tchs', Accept: 'image/*' } })
  const ab2 = Buffer.from(await anh2.arrayBuffer())
  const ap2 = join(tmpdir(), `capt2-${Date.now()}.png`); writeFileSync(ap2, ab2); moFile(ap2)
  const ma2 = (await rl.question('    Mã captcha tra cứu: ')).trim()

  const kiem = await goi(`${BASE}checkCaptcha?captcha=${encodeURIComponent(ma2)}&_=${Date.now()}`,
    { headers: { 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs' } })
  if ((await kiem.text()).trim() !== 'success') { console.log('    mã sai, chạy lại script'); process.exit(1) }

  const q = new URLSearchParams({
    maNghiepVu: '', maTTHC: '', maToKhai: '', maHoSo: '', tuNgay: TU, denNgay: DEN,
    scope_tdt1: 'SELF', mstUyQuyen_tdt1: '', captcha: ma2, _csrf: csrf, page: '0', size: '50',
  })
  const tc = await goi(`${BASE}ho-so/search?${q}`, {
    headers: { 'HX-Request': 'true', 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs', Accept: 'text/html, */*' },
  })
  const htmlTc = await tc.text()
  const maHoSo = [...new Set([...htmlTc.matchAll(/data-ma-ho-so="([^"]+)"/g)].map(m => m[1]))]
  console.log('    hồ sơ tìm được:', maHoSo.length ? maHoSo.join(', ') : '(không có)')
  if (!maHoSo.length) { console.log('    Chọn khoảng ngày có hồ sơ rồi chạy lại.'); process.exit(1) }

  const ma = maHoSo[0]
  console.log(`\n[3] Mở chi tiết ${ma}…`)
  const ct = await goi(`${BASE}tchs/files/detail/${encodeURIComponent(ma)}?loai=`, { headers: { Referer: BASE + 'tchs' } })
  const htmlCt = await ct.text()
  const token = htmlCt.match(/id="csrfToken"\s+value="([^"]+)"/)?.[1] || csrf
  const idTbao = [...new Set([...htmlCt.matchAll(/data-id="(\d{10,})"/g)].map(m => m[1]))]
  console.log('    thông báo:', idTbao.join(', ') || '(không có)')

  // ── Câu hỏi 1: loaiTBao nào cho ra PDF? ──────────────────────────────────
  console.log('\n[4] Thử các giá trị loaiTBao để tìm PDF:')
  for (const loai of ['', 'PDF', 'pdf', 'P', '1', '2', 'XML']) {
    if (!idTbao.length) break
    const res = await goi(BASE + 'tchs/downloadthongbao', {
      method: 'POST', body: JSON.stringify({ idTbao: idTbao[0], loaiTBao: loai }),
      headers: {
        'Content-Type': 'application/json', 'X-XSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN,
        Referer: `${BASE}tchs/files/detail/${ma}?loai=`,
      },
    })
    const text = await res.text()
    let mo = ''
    try {
      const j = JSON.parse(text)
      if (j.content) {
        const buf = Buffer.from(j.content, 'base64')
        mo = `${nhanDang(buf)} · ${buf.length} bytes · tên cổng đặt: ${j.fileName} · fileType: ${j.fileType}`
        if (nhanDang(buf) === 'PDF') {
          const p = join(tmpdir(), `TB_loaiTBao_${loai || 'rong'}.pdf`)
          writeFileSync(p, buf); mo += `\n         → ĐÃ LƯU: ${p}`
        }
      } else mo = 'không có nội dung: ' + text.slice(0, 120)
    } catch { mo = `HTTP ${res.status} · ${text.slice(0, 120)}` }
    console.log(`    loaiTBao="${loai}": ${mo}`)
    await new Promise(r => setTimeout(r, 2500))
  }

  // ── Câu hỏi 2: "Xem tài liệu" trả về gì? ─────────────────────────────────
  console.log('\n[5] Thử endpoint "Xem tài liệu" của trang chi tiết:')
  for (const [ten, duongDan, than] of [
    ['data-tai-lieu-dkem', BASE + 'tchs/data-tai-lieu-dkem', { maHoSo: ma }],
    ['download-tai-lieu-dkem', BASE + 'tchs/download-tai-lieu-dkem', { maHoSo: ma }],
  ]) {
    const res = await goi(duongDan, {
      method: 'POST', body: JSON.stringify(than),
      headers: {
        'Content-Type': 'application/json', 'X-XSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN,
        Referer: `${BASE}tchs/files/detail/${ma}?loai=`,
      },
    })
    const text = await res.text()
    const p = join(tmpdir(), `taileu-${ten}.txt`); writeFileSync(p, text)
    console.log(`    ${ten}: HTTP ${res.status} · ${text.length} ký tự · ${text.slice(0, 160).replace(/\s+/g, ' ')}`)
    console.log(`         đã lưu: ${p}`)
    await new Promise(r => setTimeout(r, 2500))
  }

  console.log('\nXONG. Nếu có dòng nào ra PDF thì cổng vốn đã phát PDF — khỏi tự dựng.')
} catch (e) {
  console.error('\nLỖI:', e.message)
  process.exitCode = 1
} finally {
  rl.close()
  if (daDangNhap) {
    try { await goi(BASE + 'logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Referer: BASE + 'tchs', Origin: ORIGIN } }) } catch {}
    console.log('[6] Đã đăng xuất.')
  }
}
