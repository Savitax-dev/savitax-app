import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// POST /api/admin/save-old-debt
// Body: { clientId, amount, note, createdBy }
// Ghi nhận thu hồi "nợ tồn cũ" (clients.other_debt) — tách biệt với phí tháng hiện tại.
// Số tiền thu không được vượt quá nợ tồn còn lại; nợ tồn được trừ ngay (tự "clear").
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const { clientId, amount, note, createdBy } = await request.json()

    if (!clientId || amount === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()
    const requested = Number(amount)
    if (!requested || requested <= 0) {
      return Response.json({ error: 'Số tiền không hợp lệ' }, { status: 400 })
    }

    const { data: clientRow, error: clientErr } = await supabase.from('clients').select('other_debt').eq('id', clientId).single()
    if (clientErr || !clientRow) {
      return Response.json({ error: clientErr?.message || 'Không tìm thấy công ty' }, { status: 404 })
    }

    const otherDebt = Number(clientRow.other_debt) || 0
    const paid = Math.min(requested, otherDebt)
    if (paid <= 0) {
      return Response.json({ error: 'Công ty không còn nợ tồn để thu' }, { status: 400 })
    }

    const now = new Date()
    const { error: updateErr } = await supabase.from('clients').update({ other_debt: otherDebt - paid }).eq('id', clientId)
    if (updateErr) {
      console.error('save-old-debt update error:', updateErr)
      return Response.json({ error: updateErr.message }, { status: 500 })
    }

    const year = now.getFullYear(), month = now.getMonth() + 1
    const { data: existingRow } = await supabase.from('service_fees')
      .select('amount').eq('client_id', clientId).eq('year', year).eq('month', month).eq('type', 'no_ton').maybeSingle()
    const newTotal = (Number(existingRow?.amount) || 0) + paid

    const { error: insertErr } = await supabase.from('service_fees').upsert({
      client_id:  clientId,
      year,
      month,
      type:       'no_ton',
      amount:     newTotal,
      note:       note || null,
      created_by: createdBy || null,
      created_at: now.toISOString(),
    }, { onConflict: 'client_id,year,month,type' })
    if (insertErr) {
      console.error('save-old-debt insert error:', insertErr)
      return Response.json({ error: insertErr.message }, { status: 500 })
    }

    return Response.json({ ok: true, paid, remainingOtherDebt: otherDebt - paid })
  } catch (e) {
    console.error('save-old-debt exception:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
