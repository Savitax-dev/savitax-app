// Thử nghiệm GĐ 0 — Phân hệ Tờ khai.
// Mục đích: xem cổng Dịch vụ công có làm được bằng HTTP thuần hay không (không Playwright),
// để biết có chạy được trên Vercel như hệ thống hiện tại không.
//
// Captcha DO NGƯỜI GÕ — script chỉ tải ảnh về rồi chờ nhập, không tự giải.
// Chỉ đăng nhập ĐÚNG MỘT LẦN, sai mật khẩu là dừng (tránh khóa tài khoản của khách).
// Luôn đăng xuất khi xong, kể cả khi lỗi.
//
// Cách chạy (mở PowerShell, đứng ở D:\savitax-app):
//   node scripts/test-dvc-login.mjs
// Script sẽ tự hỏi tên đăng nhập và mật khẩu.
//
// Không ghi mật khẩu vào file này và không commit mật khẩu lên git.

import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const rl = createInterface({ input: process.stdin, output: process.stdout })

// Hỏi trực tiếp để mật khẩu không nằm lại trong lịch sử lệnh của PowerShell.
const USER = process.env.DVC_USER || (await rl.question('Tên đăng nhập (dạng <MST>-QL): ')).trim()
const PASS = process.env.DVC_PASS || (await rl.question('Mật khẩu (gõ xong bấm Enter): ')).trim()
if (!USER || !PASS) {
  console.error('Chưa nhập đủ tên đăng nhập / mật khẩu.')
  process.exit(1)
}

// Mở ảnh captcha bằng phần mềm xem ảnh mặc định của máy.
function openFile(path) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', path], { detached: true, stdio: 'ignore' }).unref()
    else if (process.platform === 'darwin') spawn('open', [path], { detached: true, stdio: 'ignore' }).unref()
    else spawn('xdg-open', [path], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* mở không được thì thôi, bên dưới đã in sẵn đường dẫn */
  }
}

// ---- cookie jar tối giản: cổng dùng JSESSIONID + XSRF-TOKEN + cookie chống bot của F5 ----
const jar = new Map()
function keepCookies(res) {
  for (const line of res.headers.getSetCookie?.() || []) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'vi-VN,vi;q=0.9',
      Cookie: cookieHeader(),
      ...(init.headers || {}),
    },
  })
  keepCookies(res)
  return res
}

const step = (n, msg) => console.log(`\n[${n}] ${msg}`)
let loggedIn = false

try {
  // 1. Trang đăng nhập: lấy cookie phiên + CSRF token
  step(1, 'Mở trang đăng nhập…')
  const loginPage = await req(BASE + 'login')
  const html = await loginPage.text()
  const csrf = html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  console.log('    HTTP', loginPage.status,
    '| JSESSIONID:', jar.has('JSESSIONID') ? 'có' : 'KHÔNG',
    '| CSRF:', csrf ? 'có' : 'KHÔNG')
  if (loginPage.status !== 200 || !csrf) {
    throw new Error('Không lấy được trang đăng nhập — có thể cổng chặn IP hoặc đổi giao diện.')
  }

  // 2. Ảnh captcha đăng nhập (mã thứ nhất)
  step(2, 'Tải ảnh captcha đăng nhập…')
  const capRes = await req(`${BASE}login/getCaptcha?${Date.now()}`, {
    headers: { Referer: BASE + 'login', Accept: 'image/*' },
  })
  const capBuf = Buffer.from(await capRes.arrayBuffer())
  const capPath = join(tmpdir(), `dvc-captcha-${Date.now()}.png`)
  writeFileSync(capPath, capBuf)
  console.log('    HTTP', capRes.status, '|', capRes.headers.get('content-type'), '|', capBuf.length, 'bytes')
  console.log('    Ảnh đã lưu:', capPath)
  if (capRes.status !== 200 || !capBuf.length) throw new Error('Không tải được ảnh captcha.')

  openFile(capPath)
  console.log('    → Ảnh vừa được mở ra, anh đọc mã rồi gõ vào đây.')
  const code = (await rl.question('    Mã captcha: ')).trim()

  // 3. Đăng nhập — ĐÚNG MỘT LẦN
  step(3, 'Gửi đăng nhập (chỉ thử 1 lần)…')
  const body = new URLSearchParams({
    tenDN: USER,
    matKhau: Buffer.from(PASS, 'utf8').toString('base64'),
    doiTuong: 'DN',
    captcha: code,
    _csrf: csrf,   // gửi kèm cả dạng tham số cho chắc, Spring nhận 1 trong 2
  })
  const loginRes = await req(BASE + 'loginLDAP', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // Cổng đặt header này bằng token in trong trang (input _csrf), KHÔNG phải giá trị
      // cookie XSRF-TOKEN — xem $(document).ajaxSend trong /tthc/login.
      'X-XSRF-TOKEN': csrf,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + 'login',
      Origin: 'https://dichvucong.gdt.gov.vn',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
  })
  const raw = await loginRes.text()
  console.log('    HTTP', loginRes.status,
    '|', loginRes.headers.get('content-type') || '(không có content-type)',
    '|', raw.length, 'ký tự')
  console.log('    Phản hồi:', raw.slice(0, 400) || '(rỗng)')
  if (loginRes.status === 403) {
    console.log('    → 403 thường là token chống giả mạo sai, hoặc cổng chặn truy cập tự động.')
  }
  let ok = false
  try {
    const j = JSON.parse(raw)
    ok = j.status === '200' || j.status === '201' || j.status === 200 || j.status === 201
    if (!ok) console.log('    → Cổng từ chối:', j.desc || '(không có mô tả)')
  } catch {
    console.log('    → Phản hồi không phải JSON, xem chuỗi ở trên.')
  }
  if (!ok) {
    console.log('\n    DỪNG. Không thử lại để tránh khóa tài khoản của khách.')
    console.log('    Sai captcha thì chạy lại script; sai mật khẩu thì phải hỏi lại khách.')
    rl.close()
    process.exit(1)
  }
  loggedIn = true
  console.log('    → ĐĂNG NHẬP ĐƯỢC bằng HTTP thuần.')

  // 4. Trang tra cứu hồ sơ: xem form và captcha thứ hai
  step(4, 'Mở trang tra cứu hồ sơ /tthc/tchs…')
  const tchs = await req(BASE + 'tchs', { headers: { Referer: BASE + 'home' } })
  const tchsHtml = await tchs.text()
  const outPath = join(tmpdir(), 'dvc-tchs.html')
  writeFileSync(outPath, tchsHtml)
  const inputs = [...tchsHtml.matchAll(/<(?:input|select)[^>]*name="([^"]+)"/g)].map(m => m[1])
  console.log('    HTTP', tchs.status, '|', tchsHtml.length, 'bytes | đã lưu:', outPath)
  console.log('    Các ô trên form:', [...new Set(inputs)].join(', ') || '(không thấy)')
  console.log('    Có captcha ở form tra cứu:', /captcha/i.test(tchsHtml) ? 'CÓ' : 'không thấy')

  rl.close()
  console.log('\nKẾT LUẬN: cổng DVC dùng được bằng HTTP thuần, không cần trình duyệt ảo.')
  console.log('Còn phải kiểm: chạy từ Vercel (IP Singapore) có bị chặn không.')
} catch (err) {
  console.error('\nLỖI:', err.message)
  process.exitCode = 1
} finally {
  rl.close()   // không đóng thì cửa sổ lệnh treo, không trả lại dấu nhắc
  if (loggedIn) {
    try {
      const out = await req(BASE + 'logout', { headers: { Referer: BASE + 'home' } })
      console.log('\n[5] Đã đăng xuất. HTTP', out.status)
    } catch {
      console.log('\n[5] Gọi đăng xuất thất bại — anh vào cổng đăng xuất tay cho chắc.')
    }
  }
}
