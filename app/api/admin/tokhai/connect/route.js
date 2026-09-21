// Kiểm tra kết nối tài khoản cổng thuế — Phân hệ Tờ khai, nhịp A.
//
// POST { clientId }                          → mở phiên, trả ảnh captcha để nhân viên gõ
// POST { maPhien, captcha }                  → đăng nhập bằng mã vừa gõ, rồi đăng xuất ngay
// POST { maPhien, doiAnh: true }             → lấy ảnh captcha mới (gõ nhầm, không phải mở lại phiên)
//
// ⚠ CHỈ CHẠY ĐƯỢC KHI MÁY CHỦ CÓ IP VIỆT NAM (local trên máy nhân viên). Trên Vercel cổng chặn
//   theo vùng — production sẽ đi qua tiện ích Chrome ở nhịp B.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'
import { moPhien, layPhien, xoaPhien, layAnhCaptcha, dangNhap, dangXuat } from '@/lib/dvcPortal'

export const maxDuration = 60

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const supabase = getAdmin()

  try {
    // ── Lấy ảnh captcha mới cho phiên đang mở ────────────────────────────────
    if (body.maPhien && body.doiAnh) {
      const phien = layPhien(body.maPhien)
      if (!phien) return Response.json({ error: 'Phiên đã hết hạn, bấm Kiểm tra lại' }, { status: 410 })
      return Response.json({ maPhien: body.maPhien, anhCaptcha: await layAnhCaptcha(phien) })
    }

    // ── Bước 1: mở phiên ─────────────────────────────────────────────────────
    if (!body.maPhien) {
      const clientId = body.clientId
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền thao tác công ty này' }, { status: 403 })
      }

      const { data: tk } = await supabase.from('tax_accounts')
        .select('id, username, password_enc, status')
        .eq('client_id', clientId).eq('portal', 'dvc').maybeSingle()
      if (!tk) return Response.json({ error: 'Công ty này chưa có tài khoản cổng Dịch vụ công' }, { status: 400 })

      const kq = await moPhien(clientId)
      return Response.json({ ...kq, tenDangNhap: tk.username })
    }

    // ── Bước 2: gõ xong captcha → đăng nhập ──────────────────────────────────
    const phien = layPhien(body.maPhien)
    if (!phien) return Response.json({ error: 'Phiên đã hết hạn (quá 3 phút), bấm Kiểm tra lại' }, { status: 410 })
    if (!body.captcha) return Response.json({ error: 'Chưa nhập mã captcha' }, { status: 400 })

    if (!(await canAccessCredentials(supabase, auth.caller, phien.clientId))) {
      return Response.json({ error: 'Không có quyền thao tác công ty này' }, { status: 403 })
    }

    const { data: tk } = await supabase.from('tax_accounts')
      .select('id, username, password_enc')
      .eq('client_id', phien.clientId).eq('portal', 'dvc').maybeSingle()
    if (!tk) return Response.json({ error: 'Không tìm thấy tài khoản cổng thuế' }, { status: 400 })

    let matKhau
    try {
      matKhau = decrypt(tk.password_enc)
    } catch {
      return Response.json({ error: 'Không giải mã được mật khẩu — kiểm tra biến TAX_ENC_KEY' }, { status: 500 })
    }

    const kq = await dangNhap(phien, { tenDN: tk.username, matKhau, captcha: body.captcha.trim() })

    // Sai captcha: KHÔNG đụng tới trạng thái tài khoản (cổng chưa kiểm mật khẩu), chỉ đưa ảnh mới.
    if (kq.ket_qua === 'sai_captcha') {
      return Response.json({
        ket_qua: 'sai_captcha', moTa: kq.moTa, maPhien: body.maPhien,
        anhCaptcha: await layAnhCaptcha(phien),
      })
    }

    const nay = new Date().toISOString()
    if (kq.ket_qua === 'ok') {
      await supabase.from('tax_accounts')
        .update({ status: 'active', last_success_at: nay, last_error_code: null }).eq('id', tk.id)
      await supabase.from('tax_access_logs').insert({
        staff_id: auth.caller.staffId, client_id: phien.clientId, action: 'test_connection',
        detail: { ket_qua: 'thanh_cong' },
      })
      // Đăng xuất NGAY, không giữ phiên — cổng khóa mỗi tài khoản vào một phiên duy nhất.
      await dangXuat(phien)
      xoaPhien(body.maPhien)
      return Response.json({ ket_qua: 'ok', moTa: 'Kết nối được cổng Dịch vụ công' })
    }

    // Sai mật khẩu: DỪNG, không thử lại — thử nhiều lần là khóa tài khoản của khách.
    await supabase.from('tax_accounts')
      .update({ status: 'wrong_password', last_error_code: kq.moTa?.slice(0, 200) || null }).eq('id', tk.id)
    await supabase.from('tax_access_logs').insert({
      staff_id: auth.caller.staffId, client_id: phien.clientId, action: 'test_connection',
      detail: { ket_qua: 'sai_mat_khau', mo_ta: kq.moTa },
    })
    xoaPhien(body.maPhien)
    return Response.json({ ket_qua: 'sai_mat_khau', moTa: kq.moTa })
  } catch (e) {
    // Lỗi mạng hay gặp nhất: chạy trên Vercel (IP Singapore) nên cổng nuốt gói tin.
    const loiMang = /fetch failed|timeout|aborted|ETIMEDOUT|ECONNRESET/i.test(e.message || '')
    return Response.json({
      error: loiMang
        ? 'Không kết nối được cổng thuế. Cổng chặn IP nước ngoài — chức năng này chỉ chạy khi mở app ở máy tại Việt Nam (localhost).'
        : e.message,
    }, { status: 400 })
  }
}
