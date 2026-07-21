import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

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
    const { clientId, year, month, type, amount, note, createdBy } = await request.json()

    if (!clientId || !year || !month || !type || amount === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()
    const numYear = Number(year), numMonth = Number(month), numAmount = Number(amount)

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
