// Kiểm tra tài khoản cổng thuế QUA TIỆN ÍCH CHROME — Phân hệ Tờ khai.
//
// VÌ SAO CÓ ROUTE NÀY: bản cũ (/api/admin/tokhai/connect) để MÁY CHỦ tự gọi cổng, nên chỉ chạy
// được khi mở app ở máy tại Việt Nam. Trên Vercel (IP Singapore) cổng nuốt gói tin, nhân viên bấm
// nút là chờ 15 giây rồi nhận thông báo lỗi — một nút không bao giờ dùng được trên app thật.
//
// Nay đi cùng đường với Đồng bộ theo lô và Tải file: máy chủ dựng sẵn từng yêu cầu HTTP, tiện ích
// Chrome trên máy nhân viên gọi hộ rồi mang phản hồi về. Máy chủ không tự gọi cổng lần nào.
//
// Luồng:  POST { clientId }            → { maPhien, viec:'goi', yeuCau }
//         POST { maPhien, phanHoi }    → bước kế tiếp
//         POST { maPhien, captcha }    → người vừa gõ mã
//         POST { maPhien, huy:true }   → bỏ giữa chừng
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'

export const maxDuration = 60

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const PHIEN_SONG = 5 * 60 * 1000

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const phienTam = new Map()
function donPhienCu() {
  const nay = Date.now()
  for (const [ma, p] of phienTam) if (nay - p.chamNhat > PHIEN_SONG) phienTam.delete(ma)
}

const docCsrf = html => html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  || html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]

// Dùng lại đúng các yêu cầu đã chạy thật ở /sync-ext — sai một tiêu đề là cổng trả 403.
const yc = {
  trangDangNhap: () => ({ url: BASE + 'login', method: 'GET' }),
  anhCaptcha: () => ({
    url: `${BASE}login/getCaptcha?${Date.now()}`, method: 'GET',
    headers: { Referer: BASE + 'login', Accept: 'image/*' },
  }),
    // doiTuong: 'DN' = doanh nghiệp, 'CN' = cá nhân / hộ kinh doanh. Trang đăng nhập của cổng
    // hỏi "Đối tượng đăng nhập" rồi gửi đúng tham số này (processChonDT → submitLDAP); chọn sai là
    // cổng báo sai tài khoản dù mật khẩu đúng. Hộ kinh doanh còn KHÔNG có đuôi '-QL' ở tên đăng
    // nhập — xem clients.is_hkd.
  dangNhap: (csrf, tenDN, matKhau, captcha, doiTuong = 'DN') => ({
    url: BASE + 'loginLDAP', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // Token IN TRONG TRANG, không phải giá trị cookie XSRF-TOKEN cùng tên.
      'X-XSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + 'login', Origin: ORIGIN,
    },
    body: new URLSearchParams({
      tenDN,
      matKhau: Buffer.from(matKhau, 'utf8').toString('base64'),   // cổng nhận mật khẩu dạng base64
      doiTuong, captcha, _csrf: csrf,
    }).toString(),
  }),
  dangXuat: csrf => ({
    url: BASE + 'logout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf || '', Referer: BASE + 'tchs', Origin: ORIGIN },
  }),
}

async function ketThuc(supabase, p, maPhien, ketQua, moTa) {
  await supabase.from('tax_access_logs').insert({
    staff_id: p.staffId, client_id: p.clientId, action: 'test_connection',
    detail: { ket_qua: ketQua, mo_ta: moTa || null, qua: 'tien_ich_chrome' },
  })
  phienTam.delete(maPhien)
  return Response.json({ viec: 'xong', ket_qua: ketQua, moTa })
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const supabase = getAdmin()
  donPhienCu()

  try {
    // ── Mở phiên ───────────────────────────────────────────────────────────
    if (!body.maPhien) {
      const { clientId } = body
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền thao tác công ty này' }, { status: 403 })
      }
      const [{ data: tk }, { data: cty }] = await Promise.all([
        supabase.from('tax_accounts')
          .select('id, username').eq('client_id', clientId).eq('portal', 'dvc').maybeSingle(),
        supabase.from('clients').select('is_hkd').eq('id', clientId).maybeSingle(),
      ])
      if (!tk) return Response.json({ error: 'Công ty này chưa có tài khoản cổng Dịch vụ công' }, { status: 400 })

      const maPhien = crypto.randomUUID()
      phienTam.set(maPhien, {
        clientId, staffId: auth.caller.staffId, taiKhoanId: tk.id,
        doiTuong: cty?.is_hkd ? 'CN' : 'DN',
        csrf: null, buoc: 'trang_dang_nhap', chamNhat: Date.now(),
      })
      return Response.json({
        maPhien, viec: 'goi', buoc: 'trang_dang_nhap',
        yeuCau: yc.trangDangNhap(), tenDangNhap: tk.username,
      })
    }

    const p = phienTam.get(body.maPhien)
    if (!p) return Response.json({ error: 'Phiên đã hết hạn, bấm Kiểm tra lại' }, { status: 410 })
    p.chamNhat = Date.now()
    if (!(await canAccessCredentials(supabase, auth.caller, p.clientId))) {
      return Response.json({ error: 'Không có quyền thao tác công ty này' }, { status: 403 })
    }

    if (body.huy) {
      phienTam.delete(body.maPhien)
      return Response.json({ viec: 'xong', ket_qua: 'bo_qua' })
    }

    // ── Người vừa gõ captcha ───────────────────────────────────────────────
    if (body.captcha) {
      if (p.buoc !== 'cho_captcha') return Response.json({ error: 'Chưa tới lúc nhập mã' }, { status: 400 })
      const { data: tk } = await supabase.from('tax_accounts')
        .select('username, password_enc').eq('client_id', p.clientId).eq('portal', 'dvc').maybeSingle()
      let matKhau
      try {
        matKhau = decrypt(tk.password_enc)
      } catch {
        phienTam.delete(body.maPhien)
        return Response.json({ error: 'Không giải mã được mật khẩu — kiểm tra biến TAX_ENC_KEY' }, { status: 500 })
      }
      p.buoc = 'dang_nhap'
      return Response.json({
        viec: 'goi', buoc: p.buoc,
        yeuCau: yc.dangNhap(p.csrf, tk.username, matKhau, String(body.captcha).trim(), p.doiTuong),
      })
    }

    const ph = body.phanHoi
    if (!ph) return Response.json({ error: 'Thiếu phản hồi' }, { status: 400 })
    if (!ph.ok) return ketThuc(supabase, p, body.maPhien, 'loi', ph.loi || 'Tiện ích gọi cổng thất bại')

    const noiDung = ph.noiDung || ''

    switch (p.buoc) {
      case 'trang_dang_nhap':
        p.csrf = docCsrf(noiDung)
        if (!p.csrf) return ketThuc(supabase, p, body.maPhien, 'loi', 'Không đọc được mã bảo vệ của cổng')
        p.buoc = 'anh_captcha'
        return Response.json({ viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha() })

      case 'anh_captcha':
        p.buoc = 'cho_captcha'
        return Response.json({
          viec: 'go_captcha', buoc: p.buoc, nhan: 'đăng nhập',
          anhCaptcha: 'data:image/png;base64,' + noiDung,
        })

      case 'dang_nhap': {
        if (/"status"\s*:\s*"?20[01]"?/.test(noiDung)) {
          await supabase.from('tax_accounts').update({
            status: 'active', last_success_at: new Date().toISOString(), last_error_code: null,
          }).eq('id', p.taiKhoanId)
          // Đăng xuất NGAY, không giữ phiên — cổng khóa mỗi tài khoản vào một phiên duy nhất.
          p.buoc = 'dang_xuat'
          return Response.json({ viec: 'goi', buoc: p.buoc, yeuCau: yc.dangXuat(p.csrf) })
        }

        let moTa = ''
        try { moTa = JSON.parse(noiDung).desc || '' } catch { moTa = noiDung.slice(0, 200) }

        // Sai captcha thì KHÔNG đụng trạng thái tài khoản — cổng chưa kiểm tới mật khẩu.
        if (/captcha/i.test(moTa) || /captcha/i.test(noiDung)) {
          p.buoc = 'anh_captcha'
          return Response.json({
            viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha(), moTa: 'Mã captcha chưa đúng',
          })
        }

        // Sai mật khẩu: DỪNG, không thử lại — thử nhiều lần là khóa tài khoản của khách.
        await supabase.from('tax_accounts')
          .update({ status: 'wrong_password', last_error_code: moTa.slice(0, 200) || null })
          .eq('id', p.taiKhoanId)
        return ketThuc(supabase, p, body.maPhien, 'sai_mat_khau', moTa)
      }

      case 'dang_xuat':
        return ketThuc(supabase, p, body.maPhien, 'ok', 'Kết nối được cổng Dịch vụ công')

      default:
        return Response.json({ error: 'Bước không hợp lệ: ' + p.buoc }, { status: 400 })
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
