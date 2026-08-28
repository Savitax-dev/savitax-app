import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { resolveFeeForMonthWithSource } from '@/lib/feeDue'
import { evaluateCap, CAP_OK, CAP_UNVERIFIABLE } from '@/lib/feeCap'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// POST /api/admin/hcns/save-debt
// Body: { clientId (id bảng clients) HOẶC hcnsClientId, year, month, amount, note, createdBy,
//         periods?: [{year,month,amount}], force?: boolean }
//
// - Không truyền `periods`: ghi 1 kỳ. Nếu vượt phí kỳ -> trả 409 kèm hướng xử lý (rải đều hoặc
//   tách phần dư sang nợ tồn) để giao diện hỏi lại người dùng, KHÔNG tự ý lưu.
// - Truyền `periods`: ghi nhiều kỳ cùng lúc (khách trả gộp) — mỗi kỳ 1 dòng, đúng phí kỳ đó.
//   Đây là cách DUY NHẤT được phép để ghi khoản trả gộp, xem lib/feeCap.js.
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { clientId, hcnsClientId, year, month, amount, note, createdBy, periods, force } = body
    const supabase = getAdmin()

    // Resolve về đúng bản ghi HCNS, dù giao diện gọi bằng id công ty kế toán hay id HCNS.
    let hcnsId = hcnsClientId || null
    if (!hcnsId && clientId) {
      const { data } = await supabase.from('hcns_clients').select('id')
        .eq('linked_client_id', clientId).eq('is_active', true).maybeSingle()
      hcnsId = data?.id || null
    }
    if (!hcnsId) return Response.json({ error: 'Công ty này chưa bật dịch vụ HCNS' }, { status: 400 })

    const { data: hc } = await supabase.from('hcns_clients').select('*').eq('id', hcnsId).single()
    if (!hc) return Response.json({ error: 'Không tìm thấy công ty HCNS' }, { status: 404 })

    // Phân quyền theo phạm vi: người phụ trách HCNS, HOẶC kế toán đang phụ trách công ty gốc,
    // HOẶC có quyền quản lý HCNS. Nếu chỉ dựa vào manage_hcns thì kế toán sẽ bị chặn ngay ở
    // nghiệp vụ họ làm hàng ngày — xem plan mục 3.
    const allowed = await canWriteHcnsDebt(supabase, auth.caller, hc)
    if (!allowed) return Response.json({ error: 'Không đủ quyền cập nhật công nợ HCNS của công ty này' }, { status: 403 })

    const { data: feePlans } = await supabase.from('hcns_service_fees')
      .select('hcns_client_id, year, month, amount').eq('hcns_client_id', hcnsId).eq('type', 'fee_plan')
    // resolveFeeForMonthWithSource so khớp theo field `client_id` -> map lại cho khớp.
    const planRows = (feePlans || []).map(r => ({ ...r, client_id: r.hcns_client_id }))

    const feeAt = (y, m) => resolveFeeForMonthWithSource(planRows, hcnsId, y, m, hc.hcns_fee, [])

    // ── Ghi nhiều kỳ (khách trả gộp) ────────────────────────────────────────────
    if (Array.isArray(periods) && periods.length) {
      const rows = periods.map(p => ({
        hcns_client_id: hcnsId,
        year: Number(p.year), month: Number(p.month),
        type: 'hcns',
        amount: p.amount !== undefined ? Number(p.amount) : feeAt(Number(p.year), Number(p.month)).fee,
        note: note || ('Trả gộp ' + periods.length + ' kỳ'),
        created_by: createdBy || null,
        created_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('hcns_service_fees')
        .upsert(rows, { onConflict: 'hcns_client_id,year,month,type' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, savedPeriods: rows.length })
    }

    // ── Ghi 1 kỳ ────────────────────────────────────────────────────────────────
    if (!year || !month || amount === undefined) {
      return Response.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
    }
    const numYear = Number(year), numMonth = Number(month), numAmount = Number(amount)
    const { fee, reliable } = feeAt(numYear, numMonth)

    const { data: paidRows } = await supabase.from('hcns_service_fees')
      .select('year, month').eq('hcns_client_id', hcnsId).eq('type', 'hcns')
    const paidPeriods = new Set((paidRows || []).map(r => r.year * 12 + r.month))

    const verdict = evaluateCap({
      amount: numAmount, fee, reliable, year: numYear, month: numMonth,
      paidPeriods, label: 'phí HCNS',
    })

    // Vượt phí và người dùng chưa xác nhận -> trả 409 để giao diện hỏi lại.
    if (verdict.kind !== CAP_OK && verdict.kind !== CAP_UNVERIFIABLE && !force) {
      return Response.json({ error: verdict.message, cap: verdict }, { status: 409 })
    }

    const { error } = await supabase.from('hcns_service_fees').upsert({
      hcns_client_id: hcnsId,
      year: numYear, month: numMonth, type: 'hcns',
      amount: numAmount,
      note: note || null,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'hcns_client_id,year,month,type' })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({
      ok: true,
      warning: verdict.kind === CAP_UNVERIFIABLE ? verdict.message : undefined,
    })
  } catch (e) {
    console.error('hcns/save-debt exception:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}

async function canWriteHcnsDebt(supabase, caller, hcnsClient) {
  if (!caller?.staffId) return false
  if (caller.role === 'admin') return true
  if (hcnsClient.assigned_to && hcnsClient.assigned_to === caller.staffId) return true

  // Kế toán đang phụ trách chính công ty gốc.
  if (hcnsClient.linked_client_id) {
    const { data: c } = await supabase.from('clients')
      .select('assigned_to, room_id').eq('id', hcnsClient.linked_client_id).maybeSingle()
    if (c?.assigned_to === caller.staffId) return true
    if (c?.room_id && caller.roomId && c.room_id === caller.roomId && caller.role === 'leader') return true
  }

  const { data: roleRow } = await supabase.from('roles').select('is_system').eq('id', caller.role).maybeSingle()
  if (roleRow?.is_system) return true
  const { data: rp } = await supabase.from('role_permissions').select('permission_key')
    .eq('role_id', caller.role).eq('permission_key', 'manage_hcns').maybeSingle()
  return !!rp
}
