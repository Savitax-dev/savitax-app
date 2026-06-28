import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET() {
  const supabase = getAdmin()
  const [{ data: clients, error }, { data: staffList }] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase.from('staff').select('id, full_name, room_id, rooms(name)'),
  ])
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const staffMap = {}
  for (const s of (staffList || [])) staffMap[s.id] = s
  const data = (clients || []).map(c => ({
    ...c,
    monthly_fee: Number(c.monthly_fee) || 0,
    other_debt: Number(c.other_debt) || 0,
    client_code:    c.client_code    || null,
    representative: c.representative || null,
    status: c.status || 'active',
    report_type: c.report_type || 'monthly',
    fee_period: c.fee_period || 'monthly',
    staff: staffMap[c.assigned_to] || null,
  }))
  return Response.json({ data })
}

export async function POST(request) {
  const body = await request.json()
  const { name, tax_code, report_type, monthly_fee, assigned_to, address, tax_status, fee_period, fee_start, other_debt, client_code, representative, status, contract_start } = body
  if (!name || !tax_code || !assigned_to) {
    return Response.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
  }
  const supabase = getAdmin()

  // Trạng thái: 'pending' (Trình ký) hoặc 'active' (Đang sử dụng) — mặc định active
  const newStatus = status === 'pending' ? 'pending' : (status || 'active')

  // Base fields that always exist
  const insertData = {
    name,
    tax_code,
    report_type: report_type || 'monthly',
    monthly_fee: Number(monthly_fee) || 0,
    assigned_to,
    is_active: newStatus === 'active',
    status: newStatus,
  }
  // Optional columns — only include if they have a value to avoid
  // "column not found in schema cache" errors on fresh deployments
  if (address) insertData.address = address
  if (tax_status) insertData.tax_status = tax_status
  if (fee_period) insertData.fee_period = fee_period
  if (other_debt) insertData.other_debt = Number(other_debt)
  if (client_code)    insertData.client_code    = client_code
  if (representative) insertData.representative = representative
  if (contract_start) insertData.contract_start = contract_start

  let { data, error } = await supabase.from('clients').insert(insertData).select().single()

  // Handle duplicate MST — update existing record instead
  if (error && (error.code === '23505' || (error.message && error.message.includes('unique')))) {
    const { data: existing } = await supabase
      .from('clients').select('id').eq('tax_code', tax_code).single()
    if (existing) {
      const updatePayload = { ...insertData }
      delete updatePayload.tax_code // don't re-set the unique key
      const res = await supabase.from('clients').update(updatePayload).eq('id', existing.id).select().single()
      data = res.data
      error = res.error
    }
  }

  // Retry with progressively fewer columns if schema is missing optional fields
  if (error && error.message && error.message.includes('schema cache')) {
    // Strip new optional columns first, then older ones
    const cols2 = ['contract_start', 'representative', 'client_code', 'other_debt', 'address', 'tax_status', 'fee_period', 'monthly_fee', 'report_type', 'status', 'is_active']
    let attempt = { ...insertData }
    for (const col of cols2) {
      if (!error || !error.message.includes('schema cache')) break
      delete attempt[col]
      const res = await supabase.from('clients').insert(attempt).select().single()
      data = res.data
      error = res.error
    }
  }

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Record initial fee to service_fees if monthly_fee is provided.
  // Công ty "Trình ký" (pending) CHƯA tính phí/tỉ lệ → không ghi service_fees ban đầu.
  if (data && newStatus !== 'pending' && monthly_fee && Number(monthly_fee) > 0) {
    let effectY, effectM
    const startSrc = contract_start || fee_start
    if (startSrc) {
      const parts = String(startSrc).split('-')
      effectY = Number(parts[0])
      effectM = Number(parts[1])
    } else {
      const now = new Date()
      effectY = now.getFullYear()
      effectM = now.getMonth() + 1
    }
    await supabase.from('service_fees').upsert({
      client_id: data.id,
      year: effectY,
      month: effectM,
      amount: Number(monthly_fee),
      note: fee_start ? ('Áp dụng từ T' + effectM + '/' + effectY) : 'Phí ban đầu',
    }, { onConflict: 'client_id,year,month' })
  }

  return Response.json({ data })
}

export async function PATCH(request) {
  const body = await request.json()
  const { id, assigned_to, address, tax_status, fee_period, status, monthly_fee, fee_history, other_debt, client_code, name, tax_code, representative, contract_start, updatedBy } = body
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  const supabase = getAdmin()

  // Lấy giá trị cũ để ghi lịch sử thay đổi phí dịch vụ
  let prevFee = null
  if (monthly_fee !== undefined) {
    const { data: before } = await supabase.from('clients').select('monthly_fee').eq('id', id).single()
    prevFee = before ? Number(before.monthly_fee) || 0 : null
  }

  const updateData = {}
  if (assigned_to !== undefined) updateData.assigned_to = assigned_to
  if (address !== undefined) updateData.address = address
  if (tax_status !== undefined) updateData.tax_status = tax_status
  if (fee_period !== undefined) updateData.fee_period = fee_period
  if (status !== undefined) { updateData.status = status; updateData.is_active = status === 'active' }
  if (contract_start !== undefined) updateData.contract_start = contract_start || null
  if (monthly_fee !== undefined) updateData.monthly_fee = Number(monthly_fee)
  if (other_debt   !== undefined) updateData.other_debt   = Number(other_debt)
  if (client_code    !== undefined) updateData.client_code    = client_code
  if (representative !== undefined) updateData.representative = representative
  if (name         !== undefined) updateData.name         = name
  if (tax_code     !== undefined) updateData.tax_code     = tax_code

  const { error } = await supabase.from('clients').update(updateData).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Ghi lịch sử khi phí dịch vụ kế toán hàng tháng thay đổi
  if (monthly_fee !== undefined && prevFee !== null && prevFee !== Number(monthly_fee)) {
    await supabase.from('client_change_log').insert({
      client_id: id,
      entity: 'monthly_fee',
      entity_label: 'Phí dịch vụ kế toán hàng tháng',
      field: 'monthly_fee',
      old_value: String(prevFee),
      new_value: String(Number(monthly_fee)),
      action: 'update',
      changed_by: updatedBy || null,
    })
  }

  // If fee changed, also log to service_fees history (type 'fee_plan' — mức phí áp dụng,
  // tách riêng khỏi 'ketoan'/'khach' là số tiền đã thu thực tế)
  if (fee_history) {
    const { year, month, amount, note } = fee_history
    await supabase.from('service_fees').upsert({
      client_id: id,
      year: Number(year),
      month: Number(month),
      type: 'fee_plan',
      amount: Number(amount),
      note: note || null,
    }, { onConflict: 'client_id,year,month,type' })
  }

  // Khi chuyển sang "Đang sử dụng" kèm ngày bắt đầu hợp đồng: ghi mốc phí ban đầu
  // tại tháng đó (nếu chưa có) để bắt đầu tính từ tháng áp dụng.
  if (status === 'active' && contract_start) {
    const parts = String(contract_start).split('-')
    const effectY = Number(parts[0]), effectM = Number(parts[1])
    if (effectY && effectM) {
      const { data: cli } = await supabase.from('clients').select('monthly_fee').eq('id', id).single()
      const fee = cli ? Number(cli.monthly_fee) || 0 : 0
      if (fee > 0) {
        const { data: existed } = await supabase.from('service_fees')
          .select('id').eq('client_id', id).eq('year', effectY).eq('month', effectM).eq('type', 'fee_plan').maybeSingle()
        if (!existed) {
          await supabase.from('service_fees').upsert({
            client_id: id, year: effectY, month: effectM, type: 'fee_plan',
            amount: fee, note: 'Áp dụng từ T' + effectM + '/' + effectY,
          }, { onConflict: 'client_id,year,month,type' })
        }
      }
    }
  }

  return Response.json({ success: true })
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  const supabase = getAdmin()
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
