import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { resolveFeeForMonthWithSource } from '@/lib/feeDue'
import { evaluateCap, CAP_OK, CAP_UNVERIFIABLE } from '@/lib/feeCap'
import { canWriteAccountingDebt } from '@/lib/debtScope'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// POST /api/admin/save-debt
// Body: { clientId, year, month, type, amount, note, createdBy }
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const { clientId, year, month, type, amount, note, createdBy, periods, force } = await request.json()

    if (!clientId || !type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()

    // ── Phân quyền theo phạm vi ──────────────────────────────────────────────────
    // Công nợ kế toán (kế toán / khác / nợ tồn cũ) chỉ người làm kế toán của công ty đó mới được
    // ghi. Nhân viên phòng HCNS chỉ thao tác ở mục "Dịch vụ HCNS" (route hcns/save-debt riêng) —
    // nếu để lọt, họ có thể ghi nhầm vào công nợ kế toán khi mở hồ sơ từ trang Phòng HCNS.
    const canWrite = await canWriteAccountingDebt(supabase, auth.caller, clientId)
    if (!canWrite) {
      return Response.json({ error: 'Không đủ quyền cập nhật công nợ dịch vụ kế toán của công ty này' }, { status: 403 })
    }

    // ── Ghi NHIỀU kỳ cùng lúc (khách trả gộp) ────────────────────────────────────
    // Đây là cách DUY NHẤT đúng để ghi khoản trả gộp: mỗi kỳ 1 dòng, đúng phí kỳ đó. Nếu dồn hết
    // vào 1 tháng thì các tháng còn lại vẫn bị coi là chưa thu -> %-KPI sai và ensureRollovers
    // tự ghi chúng thành "nợ tồn" -> sinh nợ ảo cho tiền đã thu. Xem lib/feeCap.js.
    if (Array.isArray(periods) && periods.length) {
      const rows = periods.map(p => ({
        client_id: clientId,
        year: Number(p.year), month: Number(p.month),
        type,
        amount: Number(p.amount) || 0,
        note: note || ('Trả gộp ' + periods.length + ' kỳ'),
        created_by: createdBy || null,
        created_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('service_fees')
        .upsert(rows, { onConflict: 'client_id,year,month,type' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, savedPeriods: rows.length })
    }

    if (!year || !month || amount === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const numYear = Number(year), numMonth = Number(month), numAmount = Number(amount)

    // ── Chặn thu vượt phí kỳ (chỉ áp cho phí kế toán — "Dịch vụ khác" không có mức cố định) ──
    if (type === 'ketoan' && !force) {
      const [{ data: cli }, { data: plans }, { data: chg }, { data: paidRows }] = await Promise.all([
        supabase.from('clients').select('monthly_fee').eq('id', clientId).maybeSingle(),
        supabase.from('service_fees').select('client_id, year, month, amount').eq('client_id', clientId).eq('type', 'fee_plan'),
        supabase.from('client_change_log').select('client_id, old_value, changed_at')
          .eq('client_id', clientId).eq('entity', 'monthly_fee').eq('action', 'update'),
        supabase.from('service_fees').select('year, month').eq('client_id', clientId).eq('type', 'ketoan'),
      ])
      const { fee, reliable } = resolveFeeForMonthWithSource(
        plans || [], clientId, numYear, numMonth, cli?.monthly_fee, chg || [])
      const verdict = evaluateCap({
        amount: numAmount, fee, reliable, year: numYear, month: numMonth,
        paidPeriods: new Set((paidRows || []).map(r => r.year * 12 + r.month)),
        label: 'phí dịch vụ kế toán',
      })
      // Vượt thật -> trả 409 để giao diện hỏi lại, KHÔNG tự ý lưu.
      if (verdict.kind !== CAP_OK && verdict.kind !== CAP_UNVERIFIABLE) {
        return Response.json({ error: verdict.message, cap: verdict }, { status: 409 })
      }
    }

    // Nếu là thu phí kế toán cho 1 tháng đã từng bị chuyển thành "nợ tồn" (rollover),
    // phần mới thu thêm (delta) được tự động trừ vào nợ tồn để tránh tính trùng.
    let prevAmount = 0
    if (type === 'ketoan') {
      const { data: prevRow } = await supabase.from('service_fees')
        .select('amount').eq('client_id', clientId).eq('year', numYear).eq('month', numMonth).eq('type', 'ketoan').maybeSingle()
      prevAmount = Number(prevRow?.amount) || 0
    }

    const { error } = await supabase.from('service_fees').upsert({
      client_id:  clientId,
      year:       numYear,
      month:      numMonth,
      type:       type,
      amount:     numAmount,
      note:       note || null,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'client_id,year,month,type' })

    if (error) {
      console.error('save-debt error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (type === 'ketoan') {
      const delta = numAmount - prevAmount
      if (delta > 0) {
        const { data: rollover } = await supabase.from('debt_rollovers')
          .select('id, remaining_amount').eq('client_id', clientId).eq('year', numYear).eq('month', numMonth).maybeSingle()
        if (rollover && Number(rollover.remaining_amount) > 0) {
          const reduce = Math.min(delta, Number(rollover.remaining_amount))
          const { data: clientRow } = await supabase.from('clients').select('other_debt').eq('id', clientId).single()
          const currentOtherDebt = Number(clientRow?.other_debt) || 0
          await Promise.all([
            supabase.from('debt_rollovers').update({ remaining_amount: Number(rollover.remaining_amount) - reduce }).eq('id', rollover.id),
            supabase.from('clients').update({ other_debt: Math.max(0, currentOtherDebt - reduce) }).eq('id', clientId),
          ])
        }
      }
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error('save-debt exception:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}

