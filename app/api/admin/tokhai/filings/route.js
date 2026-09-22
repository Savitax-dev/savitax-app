// Danh sách hồ sơ tờ khai đã lấy về từ cổng — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/filings?clientId=…&ky=…&loai=…
//   Không truyền clientId thì lấy toàn bộ công ty trong phạm vi của người gọi.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function docHet(query) {
  let ra = [], tu = 0
  for (;;) {
    const { data, error } = await query().range(tu, tu + 999)
    if (error) throw new Error(error.message)
    ra = ra.concat(data)
    if (data.length < 1000) return ra
    tu += 1000
  }
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId') || null
  const ky = searchParams.get('ky') || null

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')

  try {
    const [dsClients, dsLoai, dsPhu] = await Promise.all([
      docHet(() => supabase.from('clients').select('id, name, client_code, tax_code, room_id, assigned_to')),
      docHet(() => supabase.from('tax_filing_types').select('id, code, name, tax_kind')),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('client_secondary_staff')
        .select('client_id').eq('staff_id', caller.staffId)),
    ])

    // Phạm vi giống lib/credentialScope.js: nhân viên chỉ thấy công ty mình phụ trách.
    const phu = new Set(dsPhu.map(r => r.client_id))
    const trongPhamVi = new Set(dsClients.filter(c => laAdmin
      || c.assigned_to === caller.staffId
      || phu.has(c.id)
      || (laTruongPhong && c.room_id && rooms.includes(c.room_id))).map(c => c.id))

    if (clientId && !trongPhamVi.has(clientId)) {
      return Response.json({ error: 'Không có quyền xem hồ sơ của công ty này' }, { status: 403 })
    }

    let hoSo = await docHet(() => {
      let q = supabase.from('tax_filings')
        .select('id, client_id, portal_code, filing_type_id, period_code, form_kind, submit_no, amend_no, submitted_at, received_at, portal_status, state, on_time, obligation_id, tax_office, synced_at')
        .order('submitted_at', { ascending: false })
      if (clientId) q = q.eq('client_id', clientId)
      if (ky) q = q.eq('period_code', ky)
      return q
    })
    hoSo = hoSo.filter(h => trongPhamVi.has(h.client_id))

    const tenCty = new Map(dsClients.map(c => [c.id, c]))
    const tenLoai = new Map(dsLoai.map(t => [t.id, t]))

    return Response.json({
      hoSo: hoSo.map(h => {
        const c = tenCty.get(h.client_id)
        const l = tenLoai.get(h.filing_type_id)
        return {
          id: h.id,
          maHoSo: h.portal_code,
          congTy: c?.name || '—',
          maKH: c?.client_code || null,
          mst: c?.tax_code || null,
          loai: l?.code || null,
          tenLoai: l?.name || null,
          ky: h.period_code,
          hinhThuc: h.form_kind,
          lanNop: h.submit_no,
          boSung: h.amend_no,
          ngayNop: h.submitted_at,
          ngayTiepNhan: h.received_at,
          trangThaiCong: h.portal_status,
          trangThai: h.state,
          dungHan: h.on_time,
          daGanNghiaVu: !!h.obligation_id,
          coQuanThue: h.tax_office,
          dongBoLuc: h.synced_at,
        }
      }),
      cacKy: [...new Set(hoSo.map(h => h.period_code))].sort().reverse(),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
