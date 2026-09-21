// Thử nghiệm GĐ 0 (phần 2) — Phân hệ Tờ khai.
// Chạy trọn một lượt như app sẽ làm: đăng nhập → tra cứu 30 ngày → mở chi tiết 1 hồ sơ → đăng xuất.
//
// Mục đích đo 3 thứ:
//   1. Tra cứu bằng HTTP thuần có ra danh sách hồ sơ không.
//   2. Trang CHI TIẾT hồ sơ có tốn thêm captcha không  ← quyết định số mã phải gõ mỗi lượt.
//   3. Mỗi lượt thực sự tốn mấy mã captcha.
//
// Captcha DO NGƯỜI GÕ. Đăng nhập chỉ thử MỘT LẦN. Luôn đăng xuất khi xong.
//
// Cách chạy (PowerShell, đứng ở D:\savitax-app):
//   node scripts/test-dvc-tracuu.mjs
// Muốn tra khoảng ngày khác thì thêm: --tu 01/08/2026 --den 30/08/2026

import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const RANGE_MAX_DAYS = 30   // cổng chặn khoảng dài hơn 30 ngày

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const today = new Date()
const monthAgo = new Date(today.getTime() - (RANGE_MAX_DAYS - 1) * 864e5)

const TU_NGAY = arg('tu', ddmmyyyy(monthAgo))
const DEN_NGAY = arg('den', ddmmyyyy(today))

const rl = createInterface({ input: process.stdin, output: process.stdout })
const USER = process.env.DVC_USER || (await rl.question('Tên đăng nhập (dạng <MST>-QL): ')).trim()
const PASS = process.env.DVC_PASS || (await rl.question('Mật khẩu (gõ xong bấm Enter): ')).trim()
if (!USER || !PASS) { console.error('Chưa nhập đủ thông tin.'); process.exit(1) }

const jar = new Map()
function keepCookies(res) {
  for (const line of res.headers.getSetCookie?.() || []) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'vi-VN,vi;q=0.9',
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(init.headers || {}),
    },
  })
  keepCookies(res)
  return res
}
function openFile(path) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', path], { detached: true, stdio: 'ignore' }).unref()
    else if (process.platform === 'darwin') spawn('open', [path], { detached: true, stdio: 'ignore' }).unref()
    else spawn('xdg-open', [path], { detached: true, stdio: 'ignore' }).unref()
  } catch { /* in đường dẫn ở dưới rồi */ }
}
const getCsrf = html => html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  || html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]

// Gõ 1 mã captcha: tải ảnh, mở ra, chờ người nhập.
let captchaCount = 0
async function askCaptcha(label, referer) {
  const res = await req(`${BASE}login/getCaptcha?${Date.now()}`, { headers: { Referer: referer, Accept: 'image/*' } })
  const buf = Buffer.from(await res.arrayBuffer())
  if (res.status !== 200 || !buf.length) throw new Error('Không tải được ảnh captcha (' + res.status + ')')
  const stamp = Date.now()
  const p = join(tmpdir(), `dvc-captcha-${stamp}.png`)
  writeFileSync(p, buf)
  // Ảnh gốc bé (~120x40) nên số 0 và chữ o rất dễ nhầm. Phóng to 4 lần bằng một trang
  // HTML nhỏ — trong app thật cũng nên hiện ảnh phóng to như vậy cho nhân viên đỡ gõ sai.
  const h = join(tmpdir(), `dvc-captcha-${stamp}.html`)
  writeFileSync(h, `<!doctype html><meta charset="utf-8"><title>Mã captcha</title>
<body style="background:#111;color:#eee;font:16px system-ui;text-align:center;padding:24px">
<p>Mã captcha (${label}) — đã phóng to 4 lần</p>
<img src="${p.replace(/\\/g, '/')}" style="zoom:2.5;background:#fff">
<p style="color:#f90">Dễ nhầm: số 0 ↔ chữ o, số 1 ↔ chữ l</p></body>`)
  openFile(h)
  captchaCount++
  console.log(`    Ảnh captcha #${captchaCount} (${label}) đã mở (phóng to):`, h)
  return (await rl.question(`    Mã captcha #${captchaCount}: `)).trim()
}

// Bóc chữ trong bảng HTML kết quả, không cần thư viện ngoài.
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

const step = (n, m) => console.log(`\n[${n}] ${m}`)
let loggedIn = false
let csrf = null

try {
  // 1. Đăng nhập (mã captcha thứ nhất)
  step(1, 'Mở trang đăng nhập…')
  const loginPage = await req(BASE + 'login')
  const loginHtml = await loginPage.text()
  csrf = getCsrf(loginHtml)
  console.log('    HTTP', loginPage.status, '| phiên:', jar.has('JSESSIONID') ? 'có' : 'KHÔNG')
  if (loginPage.status !== 200 || !csrf) throw new Error('Không mở được trang đăng nhập.')

  // Gõ sai captcha KHÁC với sai mật khẩu: cổng chưa kiểm mật khẩu nên tài khoản chưa bị
  // đếm lần sai. Cho gõ lại tối đa 3 lần; chỉ dừng hẳn khi cổng kêu sai tên/mật khẩu.
  step(2, 'Đăng nhập…')
  let okLogin = false
  for (let lan = 1; lan <= 3 && !okLogin; lan++) {
    const capLogin = await askCaptcha('đăng nhập', BASE + 'login')
    const loginRes = await req(BASE + 'loginLDAP', {
      method: 'POST',
      body: new URLSearchParams({
        tenDN: USER,
        matKhau: Buffer.from(PASS, 'utf8').toString('base64'),
        doiTuong: 'DN',
        captcha: capLogin,
        _csrf: csrf,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-XSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
        Referer: BASE + 'login',
        Origin: ORIGIN,
      },
    })
    const loginRaw = await loginRes.text()
    console.log('    HTTP', loginRes.status, '| phản hồi:', loginRaw.slice(0, 200))
    okLogin = /"status"\s*:\s*"?20[01]"?/.test(loginRaw)
    if (okLogin) break

    const saiCaptcha = /captcha/i.test(loginRaw)
    if (saiCaptcha) {
      console.log(`    → Sai mã captcha (lần ${lan}/3). Tài khoản CHƯA bị tính lần đăng nhập sai, lấy ảnh mới…`)
      console.log('    → Mẹo: kiểu chữ của cổng dễ nhầm số 0 với chữ o, số 1 với chữ l.')
      continue
    }
    console.log('\n    DỪNG — cổng báo lỗi không phải captcha (có thể sai tên đăng nhập / mật khẩu).')
    console.log('    Không thử lại để tránh khóa tài khoản của khách.')
    process.exit(1)
  }
  if (!okLogin) {
    console.log('\n    Sai captcha 3 lần, dừng. Anh chạy lại script.')
    process.exit(1)
  }
  loggedIn = true
  console.log('    → Đăng nhập được.')

  // 2. Trang tra cứu: lấy token mới của phiên đã đăng nhập
  step(3, 'Mở trang tra cứu /tthc/tchs…')
  const tchs = await req(BASE + 'tchs', { headers: { Referer: BASE + 'home' } })
  const tchsHtml = await tchs.text()
  csrf = getCsrf(tchsHtml) || csrf
  console.log('    HTTP', tchs.status, '|', tchsHtml.length, 'bytes | token phiên:', csrf ? 'có' : 'KHÔNG')

  // 3. Tra cứu (mã captcha thứ hai)
  step(4, `Tra cứu hồ sơ từ ${TU_NGAY} đến ${DEN_NGAY} (tối đa ${RANGE_MAX_DAYS} ngày)…`)
  let capSearch = ''
  for (let lan = 1; lan <= 3; lan++) {
    capSearch = await askCaptcha('tra cứu', BASE + 'tchs')
    const check = await req(`${BASE}checkCaptcha?captcha=${encodeURIComponent(capSearch)}&_=${Date.now()}`, {
      headers: { 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs' },
    })
    const checkTxt = (await check.text()).trim()
    console.log('    Kiểm mã captcha:', checkTxt)
    if (checkTxt === 'success') break
    if (lan === 3) throw new Error('Sai mã captcha tra cứu 3 lần.')
    console.log(`    → Sai mã (lần ${lan}/3), lấy ảnh mới. Phiên đăng nhập vẫn giữ nguyên.`)
  }

  // Một lần tra = 1 cửa sổ ngày. Trả về danh sách mã hồ sơ đọc được.
  async function traCuu(tu, den, code, tag) {
    const q = new URLSearchParams({
      maNghiepVu: '', maTTHC: '', maToKhai: '', maHoSo: '',
      tuNgay: tu, denNgay: den,
      scope_tdt1: 'SELF', mstUyQuyen_tdt1: '',
      captcha: code, _csrf: csrf, page: '0', size: '50',
    })
    const res = await req(`${BASE}ho-so/search?${q}`, {
      headers: { 'HX-Request': 'true', 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs', Accept: 'text/html, */*' },
    })
    const html = await res.text()
    const p = join(tmpdir(), `dvc-ketqua-${tag}.html`)
    writeFileSync(p, html)
    const tong = html.match(/T[ổo]ng s[ốo] b[ảa]n ghi:\s*(\d+)/)?.[1] ?? '?'
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => strip(c[1])))
      .filter(cells => cells.length > 2)
    const maList = [...new Set([...html.matchAll(/data-ma-ho-so="([^"]+)"/g)].map(m => m[1]))]
    console.log(`    HTTP ${res.status} | ${html.length} bytes | tổng số bản ghi cổng báo: ${tong} | đã lưu: ${p}`)
    rows.slice(0, 5).forEach((c, i) => console.log(`      ${i + 1}.`, c.slice(0, 7).join(' | ')))
    return { maList, tong, ok: res.status === 200 }
  }

  const kq1 = await traCuu(TU_NGAY, DEN_NGAY, capSearch, 'cuaso1')
  const maHoSoList = kq1.maList
  console.log('    Mã hồ sơ lấy được:', maHoSoList.length ? maHoSoList.slice(0, 5).join(', ') : '(không có)')

  // Thứ tự quan trọng: PHẢI mở chi tiết + tải file NGAY sau lần tra cứu ra hồ sơ.
  // Tra cứu lần sau ghi đè danh sách hồ sơ được phép tải trong phiên, làm cổng
  // trả 400 ở validateIdTkhai. Vì vậy phép đo "dùng lại mã captcha" để xuống cuối.

  // 4. Mở chi tiết — KHÔNG gõ thêm captcha. Đây là phép thử quan trọng nhất.
  if (maHoSoList.length) {
    const ma = maHoSoList[0]
    step(5, `Mở chi tiết hồ sơ ${ma} — KHÔNG gõ thêm captcha…`)
    const det = await req(`${BASE}tchs/files/detail/${encodeURIComponent(ma)}?loai=`, { headers: { Referer: BASE + 'tchs' } })
    const detHtml = await det.text()
    const detPath = join(tmpdir(), `dvc-chitiet-${ma}.html`)
    writeFileSync(detPath, detHtml)
    const needCaptcha = /name="captcha"/i.test(detHtml)
    const hasDownload = /(T[ảa]i xu[ốo]ng|download|Xem th[ôo]ng b[áa]o)/i.test(detHtml)
    console.log('    HTTP', det.status, '|', detHtml.length, 'bytes | đã lưu:', detPath)
    console.log('    Trang chi tiết đòi captcha:', needCaptcha ? 'CÓ' : 'KHÔNG')
    console.log('    Thấy nút tải / xem thông báo:', hasDownload ? 'CÓ' : 'không')

    // Trang chi tiết có token riêng (input#csrfToken) — dùng cho các lệnh tải.
    const tokenTai = detHtml.match(/id="csrfToken"\s+value="([^"]+)"/)?.[1] || csrf
    const idThongBao = [...new Set([...detHtml.matchAll(/data-id="(\d{10,})"/g)].map(m => m[1]))]
    const tieuDeTB = [...detHtml.matchAll(/V\/v:?\s*([^<]{5,80})</g)].map(m => strip(m[1]))
    console.log('    Thông báo đính kèm:', idThongBao.length, idThongBao.join(', ') || '(không có)')
    tieuDeTB.slice(0, 4).forEach(t => console.log('      ·', t))

    // 5. Tải file — KHÔNG tốn captcha. Đây là thứ cuối cùng cần chứng minh.
    step('5b', 'Thử tải tờ khai XML và thông báo (không gõ captcha)…')
    // Cổng KHÔNG trả thẳng file: nhận JSON, trả JSON {content: base64, fileName, fileType}.
    async function thuTai(ten, url, payload) {
      const res = await req(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': tokenTai,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${BASE}tchs/files/detail/${ma}?loai=`,
          Origin: ORIGIN,
          Accept: 'application/json, text/javascript, */*; q=0.01',
        },
      })
      const raw = await res.text()
      let j = null
      try { j = JSON.parse(raw) } catch { /* không phải JSON */ }

      if (!j?.content) {
        console.log(`    ${ten}: HTTP ${res.status} → chưa ra file:`, strip(raw.slice(0, 200)))
        return false
      }
      const buf = Buffer.from(j.content, 'base64')
      const ten_file = (j.fileName || `${ten}-${ma}`).replace(/[\\/:*?"<>|]/g, '_')
      const out = join(tmpdir(), ten_file)
      writeFileSync(out, buf)
      console.log(`    ${ten}: HTTP ${res.status} | ${j.fileType || '?'} | ${buf.length} bytes → ĐÃ TẢI: ${out}`)
      // Xem thử vài chữ đầu để biết đúng là XML tờ khai hay PDF thông báo
      const dau = buf.subarray(0, 4).toString('binary')
      console.log('      Dạng file:', dau.startsWith('%PDF') ? 'PDF' : dau.startsWith('PK') ? 'ZIP' : buf.subarray(0, 200).toString('utf8').includes('<?xml') ? 'XML' : '(khác)')
      return true
    }

    // Tờ khai phải "xin phép" trước: cổng ghi nhận mã vào phiên, không gọi bước này thì
    // downloadhoso trả {"error":"Hồ sơ truyền lên không hợp lệ"}. Thông báo thì không cần.
    const vld = await req(`${BASE}tchs/validateIdTkhai?idTKhai=${encodeURIComponent(ma)}`, {
      headers: { 'X-XSRF-TOKEN': tokenTai, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}tchs/files/detail/${ma}?loai=` },
    })
    const vldTxt = (await vld.text()).trim()
    console.log('    Xin phép tải tờ khai (validateIdTkhai):', vldTxt === '200' ? 'ĐƯỢC' : `bị từ chối (${vldTxt.slice(0, 80)})`)

    await thuTai('tokhai', BASE + 'tchs/downloadhoso', { maHoSo: ma })
    for (const idTb of idThongBao.slice(0, 2)) {
      await thuTai(`thongbao-${idTb}`, BASE + 'tchs/downloadthongbao', { idTbao: idTb, loaiTBao: '' })
    }
  } else {
    step(5, 'Không có hồ sơ nào trong khoảng ngày này nên chưa thử được trang chi tiết.')
    console.log('    Anh chạy lại với khoảng ngày có nộp tờ khai, ví dụ:')
    console.log('      node scripts/test-dvc-tracuu.mjs --tu 01/07/2026 --den 30/07/2026')
  }

  // PHÉP ĐO CUỐI (để sau cùng vì nó ghi đè kết quả tra cứu trong phiên):
  // cửa sổ 30 ngày thứ hai có dùng lại được mã captcha cũ không?
  const toDate = s => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d) }
  const d2Den = new Date(toDate(TU_NGAY).getTime() - 864e5)
  const d2Tu = new Date(d2Den.getTime() - (RANGE_MAX_DAYS - 1) * 864e5)
  step('5c', `Cửa sổ 30 ngày liền trước (${ddmmyyyy(d2Tu)} → ${ddmmyyyy(d2Den)}) DÙNG LẠI mã captcha cũ…`)
  const kq2 = await traCuu(ddmmyyyy(d2Tu), ddmmyyyy(d2Den), capSearch, 'cuaso2')
  console.log('    → Dùng lại mã captcha cho cửa sổ thứ 2:', kq2.ok ? 'ĐƯỢC' : 'KHÔNG ĐƯỢC')

  console.log(`\nTỔNG KẾT: một lượt của một công ty tốn ${captchaCount} mã captcha.`)
} catch (err) {
  console.error('\nLỖI:', err.message)
  process.exitCode = 1
} finally {
  rl.close()
  if (loggedIn) {
    try {
      // Đăng xuất là POST kèm token của phiên (gọi GET sẽ trả 500).
      const out = await req(BASE + 'logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf || '', Referer: BASE + 'tchs', Origin: ORIGIN },
      })
      console.log('\n[6] Đăng xuất. HTTP', out.status, out.status === 200 || out.status === 302 ? '(xong)' : '(anh vào cổng đăng xuất tay cho chắc)')
    } catch {
      console.log('\n[6] Gọi đăng xuất thất bại — anh vào cổng đăng xuất tay cho chắc.')
    }
  }
}
