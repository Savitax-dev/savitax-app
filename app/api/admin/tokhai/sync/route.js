// Đồng bộ tờ khai của MỘT công ty từ cổng Dịch vụ công — Phân hệ Tờ khai, nhịp A.
//
// Mỗi bước là một lời gọi riêng vì giữa các bước phải chờ người gõ captcha:
//   POST { clientId, soNgay? }        → mở phiên, trả ảnh captcha ĐĂNG NHẬP
//   POST { maPhien, captcha }         → đăng nhập xong, trả ảnh captcha TRA CỨU
//   POST { maPhien, captchaTraCuu }   → tra cứu, ghi vào DB, đăng xuất, trả kết quả
//   POST { maPhien, doiAnh:'login'|'search' } → lấy ảnh mới khi gõ nhầm
//
// Một lượt tốn ĐÚNG 2 mã captcha dù tra bao nhiêu cửa sổ 30 ngày, vì mã tra cứu dùng lại được
// trong cùng phiên (đã đo thật 18/09/2026).
//
// ⚠ Chỉ chạy khi máy chủ có IP Việt Nam (localhost). Vercel bị cổng chặn theo vùng.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'
import { chuanHoaKy } from '@/lib/taxDeadline'
import {
  moPhien, layPhien, xoaPhien, layAnhCaptcha, dangNhap, dangXuat,
  kiemMaCaptcha, traCuu, chuanHoaTrangThai, RANGE_MAX_DAYS,
} from '@/lib/dvcPortal'

export const maxDuration = 60

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const tuISO = s => new Date(`${s}T00:00:00Z`)

// Chia khoảng ngày thành các cửa sổ <= 30 ngày (cổng từ chối khoảng dài hơn).
// tuNgay/denNgay dạng 'YYYY-MM-DD'; không truyền thì lấy N ngày gần nhất.
function chiaCuaSo({ tuNgay, denNgay, soNgay }) {
  const den0 = denNgay ? tuISO(denNgay) : new Date()
  const tu0 = tuNgay ? tuISO(tuNgay) : new Date(den0.getTime() - ((soNgay || 30) - 1) * 864e5)

  const cs = []
  let den = den0
  while (den >= tu0 && cs.length < 24) {          // chặn 24 cửa sổ ~ 2 năm, tránh vòng lặp dài
    const lui = new Date(den.getTime() - (RANGE_MAX_DAYS - 1) * 864e5)
    const tu = lui > tu0 ? lui : tu0
    cs.push({ tuNgay: ddmmyyyy(tu), denNgay: ddmmyyyy(den) })
    den = new Date(tu.getTime() - 864e5)
  }
  return cs
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const supabase = getAdmin()

  try {
    // ── Lấy ảnh captcha mới khi gõ nhầm ─────────────────────────────────────
    if (body.maPhien && body.doiAnh) {
      const phien = layPhien(body.maPhien)
      if (!phien) return Response.json({ error: 'Phiên đã hết hạn, bấm Đồng bộ lại' }, { status: 410 })
      return Response.json({ maPhien: body.maPhien, anhCaptcha: await layAnhCaptcha(phien) })
    }

    // ── Bước 1: mở phiên ────────────────────────────────────────────────────
    if (!body.maPhien) {
      const { clientId, soNgay = 30, tuNgay = null, denNgay = null } = body
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền đồng bộ công ty này' }, { status: 403 })
      }

      const { data: tk } = await supabase.from('tax_accounts')
        .select('id, username').eq('client_id', clientId).eq('portal', 'dvc').maybeSingle()
      if (!tk) return Response.json({ error: 'Công ty này chưa có tài khoản cổng Dịch vụ công' }, { status: 400 })

      // Cổng khóa mỗi tài khoản vào 1 phiên → không cho 2 lượt chạy song song trên cùng công ty.
      const { data: dangChay } = await supabase.from('tax_sync_jobs')
        .select('id, started_at').eq('client_id', clientId).is('finished_at', null).maybeSingle()
      if (dangChay) {
        const treo = Date.now() - new Date(dangChay.started_at).getTime() > 5 * 60 * 1000
        if (treo) {
          await supabase.from('tax_sync_jobs').update({
            finished_at: new Date().toISOString(), result: 'captcha_timeout',
            error_detail: 'Bỏ dở quá 5 phút, tự đóng',
          }).eq('id', dangChay.id)
        } else {
          return Response.json({ error: 'Công ty này đang có một lượt đồng bộ khác chạy dở' }, { status: 409 })
        }
      }

      const { maPhien, anhCaptcha } = await moPhien(clientId)
      const phien = layPhien(maPhien)
      phien.khoang = { tuNgay, denNgay, soNgay: Math.min(Math.max(+soNgay || 30, 1), 730) }

      const { data: job } = await supabase.from('tax_sync_jobs').insert({
        client_id: clientId, portal: 'dvc', trigger_kind: 'manual',
        captcha_entered_by: auth.caller.staffId, captcha_count: 1,
      }).select('id').single()
      phien.jobId = job?.id || null

      return Response.json({ buoc: 'dang_nhap', maPhien, anhCaptcha, tenDangNhap: tk.username })
    }

    const phien = layPhien(body.maPhien)
    if (!phien) return Response.json({ error: 'Phiên đã hết hạn (quá 3 phút), bấm Đồng bộ lại' }, { status: 410 })
    if (!(await canAccessCredentials(supabase, auth.caller, phien.clientId))) {
      return Response.json({ error: 'Không có quyền đồng bộ công ty này' }, { status: 403 })
    }

    // ── Bước 2: đăng nhập, rồi xin mã captcha thứ hai cho tra cứu ───────────
    if (body.captcha && !phien.daDangNhap) {
      const { data: tk } = await supabase.from('tax_accounts')
        .select('id, username, password_enc').eq('client_id', phien.clientId).eq('portal', 'dvc').maybeSingle()
      if (!tk) return Response.json({ error: 'Không tìm thấy tài khoản cổng thuế' }, { status: 400 })

      const kq = await dangNhap(phien, {
        tenDN: tk.username, matKhau: decrypt(tk.password_enc), captcha: body.captcha.trim(),
      })

      if (kq.ket_qua === 'sai_captcha') {
        return Response.json({
          buoc: 'dang_nhap', ket_qua: 'sai_captcha', maPhien: body.maPhien,
          anhCaptcha: await layAnhCaptcha(phien),
        })
      }
      if (kq.ket_qua !== 'ok') {
        await supabase.from('tax_accounts')
          .update({ status: 'wrong_password', last_error_code: kq.moTa?.slice(0, 200) || null }).eq('id', tk.id)
        await ketThucJob(supabase, phien, 'wrong_password', kq.moTa)
        xoaPhien(body.maPhien)
        return Response.json({ ket_qua: 'sai_mat_khau', moTa: kq.moTa })
      }

      await supabase.from('tax_accounts')
        .update({ status: 'active', last_success_at: new Date().toISOString(), last_error_code: null })
        .eq('id', tk.id)

      return Response.json({
        buoc: 'tra_cuu', maPhien: body.maPhien, anhCaptcha: await layAnhCaptcha(phien),
        soCuaSo: chiaCuaSo(phien.khoang).length,
      })
    }

    // ── Bước 3: tra cứu + ghi dữ liệu + đăng xuất ───────────────────────────
    if (body.captchaTraCuu) {
      const ma = body.captchaTraCuu.trim()
      if (!(await kiemMaCaptcha(phien, ma))) {
        return Response.json({
          buoc: 'tra_cuu', ket_qua: 'sai_captcha', maPhien: body.maPhien,
          anhCaptcha: await layAnhCaptcha(phien),
        })
      }

      const cuaSo = chiaCuaSo(phien.khoang)
      const tatCa = []
      for (let i = 0; i < cuaSo.length; i++) {
        // Giãn nhịp giữa các cửa sổ: bắn liền tay là cổng trả 429 (đã gặp thật 21/09/2026).
        if (i > 0) await new Promise(r => setTimeout(r, 2500))
        const { ds } = await traCuu(phien, { ...cuaSo[i], captcha: ma })
        tatCa.push(...ds)
      }
      await supabase.from('tax_sync_jobs').update({ captcha_count: 2 }).eq('id', phien.jobId)

      const kq = await ghiHoSo(supabase, phien.clientId, tatCa)

      await dangXuat(phien)
      await ketThucJob(supabase, phien, 'success', null, kq)
      xoaPhien(body.maPhien)

      return Response.json({
        ket_qua: 'ok',
        soCuaSo: cuaSo.length,
        khoangNgay: `${cuaSo[cuaSo.length - 1].tuNgay} – ${cuaSo[0].denNgay}`,
        ...kq,
        hoSo: tatCa.map(r => ({
          maHoSo: r.maHoSo, tenToKhai: r.tenToKhai, ky: r.kyTinhThue,
          loai: r.loaiToKhai, ngayNop: r.ngayNop, trangThai: r.trangThaiCong,
        })),
      })
    }

    return Response.json({ error: 'Yêu cầu không hợp lệ' }, { status: 400 })
  } catch (e) {
    const loiMang = /fetch failed|timeout|aborted|ETIMEDOUT|ECONNRESET/i.test(e.message || '')
    return Response.json({
      error: loiMang
        ? 'Không kết nối được cổng thuế. Cổng chặn IP nước ngoài — chức năng này chỉ chạy khi mở app ở máy tại Việt Nam (localhost).'
        : e.message,
    }, { status: 400 })
  }
}

async function ketThucJob(supabase, phien, result, loi, kq) {
  if (!phien.jobId) return
  await supabase.from('tax_sync_jobs').update({
    finished_at: new Date().toISOString(),
    result,
    error_detail: loi ? String(loi).slice(0, 500) : null,
    new_filings: kq?.themMoi || 0,
    changed_filings: kq?.capNhat || 0,
  }).eq('id', phien.jobId)
}

// Ghi hồ sơ lấy được vào tax_filings và gắn vào nghĩa vụ tương ứng.
async function ghiHoSo(supabase, clientId, ds) {
  if (!ds.length) return { themMoi: 0, capNhat: 0, khopNghiaVu: 0, khongKhop: 0 }

  const [{ data: loaiTK }, { data: nghiaVu }, { data: daCo }] = await Promise.all([
    supabase.from('tax_filing_types').select('id, code, ma_tkhai_portal'),
    supabase.from('tax_obligations').select('id, filing_type_id, period_code, state').eq('client_id', clientId),
    supabase.from('tax_filings').select('id, portal_code, state').eq('client_id', clientId),
  ])

  const theoMaCong = new Map((loaiTK || []).filter(t => t.ma_tkhai_portal).map(t => [t.ma_tkhai_portal, t]))
  const theoMaCode = new Map((loaiTK || []).map(t => [t.code, t]))
  const dangCo = new Map((daCo || []).map(f => [f.portal_code, f]))

  let themMoi = 0, capNhat = 0, khopNghiaVu = 0, khongKhop = 0
  const capNhatNghiaVu = []

  for (const r of ds) {
    // Khớp loại tờ khai: ưu tiên mã cổng (chắc chắn), không có thì lấy mã in trong tên.
    let loai = r.maToKhaiCong ? theoMaCong.get(r.maToKhaiCong) : null
    if (!loai && r.tenToKhai) {
      const code = r.tenToKhai.split('-')[0].trim()
      loai = theoMaCode.get(code) || null
    }
    const ky = chuanHoaKy(r.kyTinhThue, loai?.period_kind || 'quarter')
    const trangThai = chuanHoaTrangThai(r.trangThaiCong)

    // Gắn vào nghĩa vụ bằng bộ đôi (loại tờ khai, kỳ) — MST đã cố định theo công ty.
    const nv = (loai && ky)
      ? (nghiaVu || []).find(o => o.filing_type_id === loai.id && o.period_code === ky)
      : null
    if (nv) khopNghiaVu++
    else khongKhop++

    const dong = {
      client_id: clientId,
      obligation_id: nv?.id || null,
      portal: 'dvc',
      portal_code: r.maHoSo,
      tthc_code: r.maTTHC,
      filing_type_id: loai?.id || null,
      period_code: ky || r.kyTinhThue || '(không đọc được)',
      form_kind: r.loaiToKhai || 'Chính thức',
      submit_no: r.lanNop || 1,
      amend_no: r.lanBoSung || 0,
      tax_office: r.coQuanThue,
      submitted_at: r.ngayNop,
      portal_status: r.trangThaiCong,
      state: trangThai,
      synced_at: new Date().toISOString(),
    }

    if (dangCo.has(r.maHoSo)) {
      await supabase.from('tax_filings').update(dong).eq('id', dangCo.get(r.maHoSo).id)
      capNhat++
    } else {
      await supabase.from('tax_filings').insert(dong)
      themMoi++
    }

    // Nghĩa vụ chuyển theo trạng thái hồ sơ. KHÔNG đụng vào nghĩa vụ đã đánh "Không phát sinh".
    if (nv && nv.state !== trangThai && nv.state !== 'no_activity') {
      capNhatNghiaVu.push({ id: nv.id, state: trangThai })
    }
  }

  for (const n of capNhatNghiaVu) {
    await supabase.from('tax_obligations')
      .update({ state: n.state, state_changed_at: new Date().toISOString() }).eq('id', n.id)
  }

  return { themMoi, capNhat, khopNghiaVu, khongKhop, doiTrangThaiNghiaVu: capNhatNghiaVu.length }
}
