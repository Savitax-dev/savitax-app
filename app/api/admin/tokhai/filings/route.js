// Hồ sơ tờ khai đã lấy về từ cổng — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/filings?ky=&roomId=&staffId=&trangThai=&tim=&trang=0
//
// GOM THEO CÔNG TY, không trả danh sách phẳng: một công ty một kỳ đã 3–5 hồ sơ, nhân với 294
// công ty là hơn một nghìn dòng — vừa nặng đường truyền vừa không ai đọc nổi. Mỗi công ty trả về
// một dòng tóm tắt kèm danh sách hồ sơ bên trong, và phân trang theo CÔNG TY.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { mapPhongCuaCongTy } from '@/lib/clientRoom'

const CTY_MOI_TRANG = 40

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
  const ky = searchParams.get('ky') || null
  const roomId = searchParams.get('roomId') || null
  const staffId = searchParams.get('staffId') || null
  const trangThai = searchParams.get('trangThai') || null
  const tim = (searchParams.get('tim') || '').trim().toLowerCase()
  const trang = Math.max(0, +(searchParams.get('trang') || 0))

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')

  try {
    const [dsClients, dsLoai, dsRooms, dsStaff, dsPhu] = await Promise.all([
      docHet(() => supabase.from('clients').select('id, name, client_code, tax_code, assigned_to, room_id, is_active, status')),
      docHet(() => supabase.from('tax_filing_types').select('id, code, name')),
      docHet(() => supabase.from('rooms').select('id, name')),
      docHet(() => supabase.from('staff').select('id, full_name')),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('client_secondary_staff')
        .select('client_id').eq('staff_id', caller.staffId)),
    ])

    const phu = new Set(dsPhu.map(r => r.client_id))
    const dangPhucVu = dsClients.filter(c => c.is_active !== false && c.status !== 'inactive')
    // Phòng suy từ nhân viên phụ trách — clients.room_id gần như luôn trống, xem lib/clientRoom.js.
    const phongCuaCty = await mapPhongCuaCongTy(supabase, dangPhucVu)

    let clients = dangPhucVu.filter(c => laAdmin
      || c.assigned_to === caller.staffId
      || phu.has(c.id)
      || (laTruongPhong && rooms.includes(phongCuaCty.get(c.id))))

    if (roomId) clients = clients.filter(c => phongCuaCty.get(c.id) === roomId)
    if (staffId) clients = clients.filter(c => c.assigned_to === staffId)
    if (tim) {
      clients = clients.filter(c =>
        (c.name || '').toLowerCase().includes(tim)
        || (c.client_code || '').toLowerCase().includes(tim)
        || (c.tax_code || '').includes(tim))
    }

    const trongPhamVi = new Set(clients.map(c => c.id))

    let hoSo = await docHet(() => {
      let q = supabase.from('tax_filings')
        .select('id, client_id, portal_code, filing_type_id, period_code, form_kind, amend_no, submitted_at, received_at, portal_status, state, on_time, obligation_id')
        .order('submitted_at', { ascending: false })
      if (ky) q = q.eq('period_code', ky)
      return q
    })
    hoSo = hoSo.filter(h => trongPhamVi.has(h.client_id))
    if (trangThai) hoSo = hoSo.filter(h => h.state === trangThai)

    // Tìm theo mã hồ sơ: cho gõ thẳng mã trên cổng để dò một hồ sơ cụ thể.
    if (tim && !hoSo.length) {
      const theoMa = (await docHet(() => supabase.from('tax_filings')
        .select('id, client_id, portal_code, filing_type_id, period_code, form_kind, amend_no, submitted_at, received_at, portal_status, state, on_time, obligation_id')
        .ilike('portal_code', `%${tim}%`))).filter(h => trongPhamVi.has(h.client_id))
      hoSo = theoMa
    }

    const tenLoai = new Map(dsLoai.map(t => [t.id, t]))
    const tenPhong = new Map(dsRooms.map(r => [r.id, r.name]))
    const tenNV = new Map(dsStaff.map(s => [s.id, s.full_name]))

    // Gom theo công ty
    const theoCty = new Map()
    for (const h of hoSo) {
      if (!theoCty.has(h.client_id)) theoCty.set(h.client_id, [])
      theoCty.get(h.client_id).push(h)
    }

    const dsCty = clients
      .filter(c => theoCty.has(c.id))
      .map(c => {
        const ds = theoCty.get(c.id)
        const dem = tt => ds.filter(h => h.state === tt).length
        const coNgay = ds.filter(h => h.received_at)
        return {
          id: c.id,
          ten: c.name,
          maKH: c.client_code || null,
          mst: c.tax_code || null,
          phong: tenPhong.get(phongCuaCty.get(c.id)) || '—',
          nhanVien: tenNV.get(c.assigned_to) || '—',
          soHoSo: ds.length,
          chapNhan: dem('accepted'),
          tiepNhan: dem('received'),
          khongChapNhan: dem('rejected'),
          treHan: coNgay.filter(h => h.on_time === false).length,
          nopGanNhat: ds.map(h => h.submitted_at).filter(Boolean).sort().pop() || null,
          hoSo: ds.map(h => ({
            id: h.id,
            maHoSo: h.portal_code,
            loai: tenLoai.get(h.filing_type_id)?.code || null,
            tenLoai: tenLoai.get(h.filing_type_id)?.name || null,
            ky: h.period_code,
            hinhThuc: h.form_kind,
            boSung: h.amend_no,
            ngayNop: h.submitted_at,
            ngayTiepNhan: h.received_at,
            trangThai: h.state,
            trangThaiCong: h.portal_status,
            dungHan: h.on_time,
            daGanNghiaVu: !!h.obligation_id,
          })),
        }
      })
      .sort((a, b) => (b.khongChapNhan + b.treHan) - (a.khongChapNhan + a.treHan)
        || (b.nopGanNhat || '').localeCompare(a.nopGanNhat || ''))

    const tongSoCty = dsCty.length
    const trangCty = dsCty.slice(trang * CTY_MOI_TRANG, (trang + 1) * CTY_MOI_TRANG)

    return Response.json({
      congTy: trangCty,
      tongSoCty,
      tongSoHoSo: hoSo.length,
      trang,
      soTrang: Math.max(1, Math.ceil(tongSoCty / CTY_MOI_TRANG)),
      cacKy: [...new Set(hoSo.map(h => h.period_code))].sort().reverse(),
      phong: dsRooms.filter(r => [...new Set([...phongCuaCty.values()])].includes(r.id))
        .map(r => ({ id: r.id, ten: r.name })),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
