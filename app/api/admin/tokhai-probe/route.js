// ROUTE TẠM — chỉ để đo GĐ 0 của Phân hệ Tờ khai, XÓA NGAY sau khi đo xong.
//
// Câu hỏi cần trả lời: cổng dichvucong.gdt.gov.vn có chặn IP Singapore của Vercel không?
// Máy anh (IP Việt Nam) đã chạy thông toàn bộ luồng; đây là ẩn số cuối cùng.
//
// Route này CHỈ mở trang đăng nhập công khai và tải ảnh captcha — KHÔNG gửi tên đăng nhập,
// KHÔNG gửi mật khẩu, KHÔNG đăng nhập, KHÔNG đụng vào tài khoản của khách.
// Chỉ quản trị viên gọi được.
import { requireAdmin } from '@/lib/serverAuth'
import dns from 'node:dns/promises'
import net from 'node:net'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// "fetch failed" không cho biết bị chặn ở đâu. Ba phép đo dưới đây tách được:
// tên miền phân giải được không → mở được cổng 443 không → bắt tay HTTPS được không.
async function doDns(host) {
  try {
    const t = Date.now()
    const r = await dns.lookup(host, { all: true })
    return { ok: true, ms: Date.now() - t, ip: r.map(x => x.address) }
  } catch (e) {
    return { ok: false, loi: e.code || e.message }
  }
}

function doTcp(host, port = 443, timeout = 8000) {
  return new Promise(resolve => {
    const t = Date.now()
    const s = net.connect({ host, port })
    const xong = kq => { s.destroy(); resolve({ ...kq, ms: Date.now() - t }) }
    s.setTimeout(timeout)
    s.once('connect', () => xong({ ok: true }))
    s.once('timeout', () => xong({ ok: false, loi: 'hết giờ chờ — gói tin bị nuốt, dấu hiệu của chặn theo vùng' }))
    s.once('error', e => xong({ ok: false, loi: e.code || e.message }))
  })
}

async function doHttp(url, headers = {}) {
  const t = Date.now()
  try {
    const res = await fetch(url, { headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    const body = await res.text()
    return { ok: true, http: res.status, ms: Date.now() - t, bytes: body.length, trichDan: body.slice(0, 150).replace(/\s+/g, ' ') }
  } catch (e) {
    return { ok: false, ms: Date.now() - t, loi: e.name + ': ' + e.message, nguyenNhan: e.cause?.code || e.cause?.message || null }
  }
}

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ketQua = {}
  const cookies = new Map()
  const keep = res => {
    for (const line of res.headers.getSetCookie?.() || []) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }

  // 0. IP đi ra của Vercel — để biết cổng đang nhìn thấy mình từ đâu.
  try {
    const t = Date.now()
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
    ketQua.ipRaMang = { ...(await r.json()), ms: Date.now() - t }
  } catch (e) {
    ketQua.ipRaMang = { loi: e.message }
  }

  // 1. Chặn ở tầng nào? Đo riêng tên miền / cổng 443 / HTTPS cho cả 2 cổng thuế,
  //    kèm 2 mốc đối chiếu: một trang Việt Nam khác và một trang quốc tế.
  ketQua.chanOTangNao = {
    dichvucong_dns: await doDns('dichvucong.gdt.gov.vn'),
    dichvucong_tcp443: await doTcp('dichvucong.gdt.gov.vn'),
    dichvucong_https: await doHttp(BASE + 'login', { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' }),
    thuedientu_tcp443: await doTcp('thuedientu.gdt.gov.vn'),
    // Mốc đối chiếu: nếu 2 dòng này chạy được thì mạng ra của Vercel bình thường,
    // vấn đề nằm đúng ở cổng thuế chứ không phải hạ tầng.
    mocDoiChieu_gdt: await doTcp('www.gdt.gov.vn'),
    mocDoiChieu_quocTe: await doTcp('example.com'),
  }

  // 2. Trang đăng nhập công khai — đây là phép thử chính.
  try {
    const t = Date.now()
    const res = await fetch(BASE + 'login', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    keep(res)
    const html = await res.text()
    ketQua.trangDangNhap = {
      http: res.status,
      ms: Date.now() - t,
      bytes: html.length,
      coPhien: cookies.has('JSESSIONID'),
      coToken: /name="csrf-token" content="/.test(html),
      // Cổng chặn thì thường trả trang chặn của F5/WAF thay vì trang đăng nhập thật.
      dungTrangDangNhap: /Dịch Vụ Công Thuế|captcha/i.test(html),
      trichDan: html.slice(0, 200).replace(/\s+/g, ' '),
    }
  } catch (e) {
    ketQua.trangDangNhap = { loi: e.name + ': ' + e.message, nguyenNhan: e.cause?.code || e.cause?.message || null }
  }

  // 3. Ảnh captcha — nếu bước 2 qua được thì bước này cho biết có đẩy ảnh về cho nhân viên gõ được không.
  try {
    const t = Date.now()
    const res = await fetch(`${BASE}login/getCaptcha?${Date.now()}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/*',
        Referer: BASE + 'login',
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const buf = Buffer.from(await res.arrayBuffer())
    ketQua.anhCaptcha = {
      http: res.status,
      ms: Date.now() - t,
      kieu: res.headers.get('content-type'),
      bytes: buf.length,
      laAnhThat: buf.subarray(1, 4).toString('binary') === 'PNG',
    }
  } catch (e) {
    ketQua.anhCaptcha = { loi: e.name + ': ' + e.message, nguyenNhan: e.cause?.code || e.cause?.message || null }
  }

  const dat = ketQua.trangDangNhap?.http === 200
    && ketQua.trangDangNhap?.coPhien
    && ketQua.anhCaptcha?.laAnhThat

  return Response.json({
    ketLuan: dat
      ? 'ĐẠT — Vercel vào được cổng DVC, không cần thuê VPS.'
      : 'CHƯA ĐẠT — xem chi tiết bên dưới, có thể cổng chặn IP nước ngoài.',
    vung: process.env.VERCEL_REGION || '(chạy máy nội bộ)',
    ...ketQua,
  })
}
