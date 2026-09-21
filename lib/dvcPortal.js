// Gọi cổng Dịch vụ công thuế (dichvucong.gdt.gov.vn) — Phân hệ Tờ khai.
//
// Toàn bộ luồng dưới đây đã chạy THẬT trên tài khoản doanh nghiệp ngày 18/09/2026
// (xem scripts/test-dvc-tracuu.mjs). Cổng dùng được bằng HTTP thuần, không cần trình duyệt ảo.
//
// ⚠ CHỈ CHẠY ĐƯỢC KHI MÁY CHỦ CÓ IP VIỆT NAM.
//   - Chạy local trên máy nhân viên: ĐƯỢC.
//   - Chạy trên Vercel (Singapore): cổng nuốt gói tin, không kết nối được.
//   Vì vậy production sẽ đi qua tiện ích Chrome trên máy nhân viên (nhịp B). File này giữ nguyên
//   phần nghiệp vụ, khi đó chỉ thay chỗ gọi mạng.
//
// Captcha LUÔN do người gõ. Không OCR, không dịch vụ giải mã.

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export const RANGE_MAX_DAYS = 30        // cổng chặn khoảng tra cứu dài hơn 30 ngày
const PHIEN_SONG = 3 * 60 * 1000        // phiên chờ gõ captcha tối đa 3 phút

// ─────────────────────────────────────────────────────────────────────────────
// Kho phiên tạm: mã phiên → { cookies, csrf, clientId, taoLuc }
//
// Để trong bộ nhớ tiến trình, KHÔNG ghi vào DB: cookie phiên của cổng là thứ nhạy cảm, sống
// đúng vài phút, lưu xuống DB chỉ tăng chỗ rò rỉ. Cách này chạy tốt ở local (một tiến trình);
// lên production thì phiên nằm trong tiện ích Chrome chứ không nằm ở server.
// ─────────────────────────────────────────────────────────────────────────────
const phienTam = new Map()

function donPhienCu() {
  const nay = Date.now()
  for (const [ma, p] of phienTam) if (nay - p.taoLuc > PHIEN_SONG) phienTam.delete(ma)
}

export function layPhien(maPhien) {
  donPhienCu()
  return phienTam.get(maPhien) || null
}

export function xoaPhien(maPhien) {
  phienTam.delete(maPhien)
}

// ─────────────────────────────────────────────────────────────────────────────
// Gọi HTTP có mang cookie của phiên
// ─────────────────────────────────────────────────────────────────────────────
function nhoCookie(phien, res) {
  for (const dong of res.headers.getSetCookie?.() || []) {
    const [cap] = dong.split(';')
    const i = cap.indexOf('=')
    if (i > 0) phien.cookies.set(cap.slice(0, i).trim(), cap.slice(i + 1).trim())
  }
}

async function goi(phien, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(init.hanGio || 15000),
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'vi-VN,vi;q=0.9',
      Cookie: [...phien.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(init.headers || {}),
    },
  })
  nhoCookie(phien, res)
  return res
}

const docCsrf = html => html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  || html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]

// ─────────────────────────────────────────────────────────────────────────────
// Bước 1 — mở phiên, lấy ảnh captcha đăng nhập
// Trả về { maPhien, anhCaptcha } với anhCaptcha là chuỗi data URL để hiện thẳng lên màn hình.
// ─────────────────────────────────────────────────────────────────────────────
export async function moPhien(clientId) {
  donPhienCu()
  const phien = { cookies: new Map(), csrf: null, clientId, taoLuc: Date.now(), daDangNhap: false }

  const trang = await goi(phien, BASE + 'login')
  if (trang.status !== 200) throw new Error(`Không mở được trang đăng nhập (HTTP ${trang.status})`)
  const html = await trang.text()
  phien.csrf = docCsrf(html)
  if (!phien.csrf) throw new Error('Không đọc được mã bảo vệ của cổng — cổng có thể đã đổi giao diện')

  const anh = await layAnhCaptcha(phien)

  const maPhien = crypto.randomUUID()
  phienTam.set(maPhien, phien)
  return { maPhien, anhCaptcha: anh }
}

// Lấy ảnh captcha mới cho phiên đang có (dùng khi gõ sai, không phải mở lại phiên).
export async function layAnhCaptcha(phien) {
  const res = await goi(phien, `${BASE}login/getCaptcha?${Date.now()}`, {
    headers: { Referer: BASE + 'login', Accept: 'image/*' },
  })
  const buf = Buffer.from(await res.arrayBuffer())
  if (res.status !== 200 || !buf.length) throw new Error('Không tải được ảnh captcha')
  return 'data:image/png;base64,' + buf.toString('base64')
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước 2 — đăng nhập
//
// Cổng kiểm captcha TRƯỚC khi kiểm mật khẩu: sai captcha trả status 999 kèm chữ "captcha" →
// cho gõ lại thoải mái, KHÔNG tính là sai mật khẩu. Chỉ khi cổng báo sai tên/mật khẩu mới dừng
// hẳn, vì thử nhiều lần là khóa tài khoản của khách.
// ─────────────────────────────────────────────────────────────────────────────
export async function dangNhap(phien, { tenDN, matKhau, captcha }) {
  const res = await goi(phien, BASE + 'loginLDAP', {
    method: 'POST',
    body: new URLSearchParams({
      tenDN,
      matKhau: Buffer.from(matKhau, 'utf8').toString('base64'),   // cổng nhận mật khẩu dạng base64
      doiTuong: 'DN',
      captcha,
      _csrf: phien.csrf,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // Header này phải mang token IN TRONG TRANG, không phải giá trị cookie XSRF-TOKEN cùng tên.
      'X-XSRF-TOKEN': phien.csrf,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + 'login',
      Origin: ORIGIN,
    },
  })
  const raw = await res.text()

  if (/"status"\s*:\s*"?20[01]"?/.test(raw)) {
    phien.daDangNhap = true
    // Token ĐỔI sau khi đăng nhập — phải đọc lại từ trang tra cứu, nếu không các lệnh sau bị 403.
    const tchs = await goi(phien, BASE + 'tchs', { headers: { Referer: BASE + 'home' } })
    const htmlTchs = await tchs.text()
    phien.csrf = docCsrf(htmlTchs) || phien.csrf
    return { ket_qua: 'ok' }
  }

  let moTa = ''
  try { moTa = JSON.parse(raw).desc || '' } catch { moTa = raw.slice(0, 200) }

  if (/captcha/i.test(moTa) || /captcha/i.test(raw)) {
    return { ket_qua: 'sai_captcha', moTa: moTa || 'Mã captcha không đúng' }
  }
  return { ket_qua: 'sai_mat_khau', moTa: moTa || 'Cổng từ chối đăng nhập' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tra cứu hồ sơ trong một cửa sổ ngày (tối đa 30 ngày).
//
// Mã captcha tra cứu DÙNG LẠI ĐƯỢC cho nhiều cửa sổ trong cùng phiên (đã đo thật), nên đồng bộ
// 90 ngày chỉ tốn 1 mã tra cứu chứ không phải 3.
//
// Bảng kết quả đã có đủ mọi thứ để cập nhật trạng thái: mã hồ sơ, mã tờ khai của cổng, kỳ tính
// thuế, loại, ngày nộp, trạng thái. KHÔNG cần mở trang chi tiết — trang đó chỉ cần khi tải file.
// ─────────────────────────────────────────────────────────────────────────────
const ngayVNsangISO = s => {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00'}:${m[5] || '00'}:00+07:00`
}
const bocChu = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export async function kiemMaCaptcha(phien, ma) {
  const res = await goi(phien, `${BASE}checkCaptcha?captcha=${encodeURIComponent(ma)}&_=${Date.now()}`, {
    headers: { 'X-XSRF-TOKEN': phien.csrf, Referer: BASE + 'tchs' },
  })
  return (await res.text()).trim() === 'success'
}

const nghi = ms => new Promise(r => setTimeout(r, ms))

export async function traCuu(phien, { tuNgay, denNgay, captcha, lanThu = 0 }) {
  const q = new URLSearchParams({
    maNghiepVu: '', maTTHC: '', maToKhai: '', maHoSo: '',
    tuNgay, denNgay,
    scope_tdt1: 'SELF', mstUyQuyen_tdt1: '',
    captcha, _csrf: phien.csrf, page: '0', size: '100',
  })
  const res = await goi(phien, `${BASE}ho-so/search?${q}`, {
    headers: { 'HX-Request': 'true', 'X-XSRF-TOKEN': phien.csrf, Referer: BASE + 'tchs', Accept: 'text/html, */*' },
    hanGio: 25000,
  })
  // 429 = cổng chặn vì gọi quá dày. Gặp khi tra nhiều cửa sổ 30 ngày liền nhau. Chờ rồi thử lại
  // MỘT lần; vẫn bị thì báo rõ cho người dùng chứ không bắn tiếp — ép cổng là bị chặn lâu hơn.
  if (res.status === 429) {
    if (lanThu === 0) {
      await nghi(5000)
      return traCuu(phien, { tuNgay, denNgay, captcha, lanThu: 1 })
    }
    throw new Error('Cổng thuế đang chặn vì tra cứu quá dày (HTTP 429). Đợi vài phút rồi tra lại, và tra từng khoảng 30 ngày một.')
  }
  if (res.status !== 200) throw new Error(`Tra cứu thất bại (HTTP ${res.status})`)
  const html = await res.text()

  const ds = []
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const maHoSo = tr.match(/data-ma-ho-so="([^"]+)"/)?.[1]
    if (!maHoSo) continue
    const o = tr.match(/data-ma-tkhai="([^"]*)"/)
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => bocChu(c[1]))
    ds.push({
      maHoSo,
      maToKhaiCong: o?.[1] || null,                       // khớp tax_filing_types.ma_tkhai_portal
      maTTHC: tr.match(/data-ma-tthc="([^"]*)"/)?.[1] || null,
      maTrangThaiCong: tr.match(/data-trang-thai="([^"]*)"/)?.[1] || null,
      tenToKhai: cells[4] || null,                        // '05/KK-TNCN - Tờ khai…'
      kyTinhThue: cells[5] || null,                       // 'Q2/2026'
      loaiToKhai: cells[6] || null,                       // 'Chính thức' | 'Bổ sung'
      lanBoSung: Number(cells[7] || 0) || 0,
      lanNop: Number(cells[8] || 1) || 1,
      coQuanThue: cells[9] || null,
      ngayNop: ngayVNsangISO(cells[10]),
      trangThaiCong: cells[11] || null,                   // 'Đã chấp nhận'
    })
  }
  const tong = html.match(/T[ổo]ng s[ốo] b[ảa]n ghi:\s*(\d+)/)?.[1]
  return { ds, tongCongBao: tong ? +tong : null }
}

// Chuẩn hóa trạng thái cổng về trạng thái của app. LUÔN giữ chuỗi gốc bên cạnh — cổng đổi nhãn
// thì không mất dữ liệu.
export function chuanHoaTrangThai(chuCong) {
  const s = (chuCong || '').toLowerCase()
  if (s.includes('không chấp nhận') || s.includes('từ chối')) return 'rejected'
  if (s.includes('chấp nhận')) return 'accepted'
  if (s.includes('tiếp nhận') || s.includes('đang xử lý') || s.includes('chờ')) return 'received'
  return 'received'
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước cuối — đăng xuất. LUÔN gọi, kể cả khi lỗi, nếu không cổng giữ phiên treo và lần sau
// công ty đó bị báo "đang được sử dụng trên một tab khác".
// ─────────────────────────────────────────────────────────────────────────────
export async function dangXuat(phien) {
  if (!phien?.daDangNhap) return
  try {
    await goi(phien, BASE + 'logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': phien.csrf || '',
        Referer: BASE + 'tchs',
        Origin: ORIGIN,
      },
    })
  } catch {
    /* đăng xuất hỏng thì phiên tự hết hạn bên cổng, không chặn luồng chính */
  }
  phien.daDangNhap = false
}
