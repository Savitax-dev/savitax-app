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

async function doHttp(url, headers = {}, timeout = 6000) {
  const t = Date.now()
  try {
    const res = await fetch(url, { headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeout) })
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
  // 0. IP đi ra của Vercel — để biết cổng đang nhìn thấy mình từ đâu.
  try {
    const t = Date.now()
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    ketQua.ipRaMang = { ...(await r.json()), ms: Date.now() - t }
  } catch (e) {
    ketQua.ipRaMang = { loi: e.message }
  }

  // 1. Chặn ở tầng nào? Đo tên miền / cổng 443 / HTTPS cho cả 2 cổng thuế, kèm 2 mốc đối chiếu.
  //    CHẠY SONG SONG và chờ tối đa 5 giây mỗi phép — chạy nối tiếp sẽ vượt hạn 30 giây của Vercel.
  const [dnsDvc, tcpDvc, httpsDvc, tcpTdt, tcpGdt, tcpQte] = await Promise.all([
    doDns('dichvucong.gdt.gov.vn'),
    doTcp('dichvucong.gdt.gov.vn', 443, 5000),
    doHttp(BASE + 'login', { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' }, 6000),
    doTcp('thuedientu.gdt.gov.vn', 443, 5000),
    doTcp('www.gdt.gov.vn', 443, 5000),
    doTcp('example.com', 443, 5000),
  ])
  ketQua.chanOTangNao = {
    dichvucong_dns: dnsDvc,
    dichvucong_tcp443: tcpDvc,
    dichvucong_https: httpsDvc,
    thuedientu_tcp443: tcpTdt,
    mocDoiChieu_gdt: tcpGdt,
    mocDoiChieu_quocTe: tcpQte,
  }

  // 2. Ảnh captcha — chỉ thử khi bước trên vào được cổng, khỏi phí thời gian chờ.
  ketQua.trangDangNhap = httpsDvc
  if (httpsDvc.ok) {
    ketQua.anhCaptcha = await doHttp(`${BASE}login/getCaptcha?${Date.now()}`,
      { 'User-Agent': UA, Accept: 'image/*', Referer: BASE + 'login' }, 6000)
  } else {
    ketQua.anhCaptcha = { boQua: 'không vào được cổng nên chưa thử tải ảnh' }
  }

  const dat = httpsDvc.ok && httpsDvc.http === 200

  return Response.json({
    ketLuan: dat
      ? 'ĐẠT — Vercel vào được cổng DVC, không cần thuê VPS.'
      : 'CHƯA ĐẠT — xem chi tiết bên dưới, có thể cổng chặn IP nước ngoài.',
    vung: process.env.VERCEL_REGION || '(chạy máy nội bộ)',
    ...ketQua,
  })
}
