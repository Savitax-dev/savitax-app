// ROUTE TẠM — chỉ để đo GĐ 0 của Phân hệ Tờ khai, XÓA NGAY sau khi đo xong.
//
// Câu hỏi cần trả lời: cổng dichvucong.gdt.gov.vn có chặn IP Singapore của Vercel không?
// Máy anh (IP Việt Nam) đã chạy thông toàn bộ luồng; đây là ẩn số cuối cùng.
//
// Route này CHỈ mở trang đăng nhập công khai và tải ảnh captcha — KHÔNG gửi tên đăng nhập,
// KHÔNG gửi mật khẩu, KHÔNG đăng nhập, KHÔNG đụng vào tài khoản của khách.
// Chỉ quản trị viên gọi được.
import { requireAdmin } from '@/lib/serverAuth'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

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

  // 1. Trang đăng nhập công khai — đây là phép thử chính.
  try {
    const t = Date.now()
    const res = await fetch(BASE + 'login', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' },
      redirect: 'manual',
      cache: 'no-store',
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
    ketQua.trangDangNhap = { loi: e.message }
  }

  // 2. Ảnh captcha — nếu bước 1 qua được thì bước này cho biết có đẩy ảnh về cho nhân viên gõ được không.
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
    ketQua.anhCaptcha = { loi: e.message }
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
