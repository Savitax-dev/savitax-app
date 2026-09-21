// Tổng hợp tờ khai cho màn hình "Lịch hạn nộp" — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/overview?nam=2026&ky=Q3.2026
//   - Trả danh sách công ty trong PHẠM VI của người gọi, kèm nghĩa vụ của kỳ đang chọn.
//   - Phạm vi: quản trị viên → tất cả; trưởng phòng → phòng mình; nhân viên → công ty mình
//     phụ trách (chính hoặc phụ). Giống lib/credentialScope.js nhưng lọc theo lô cho nhanh,
//     không hỏi từng công ty một.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { cacKyTrongNam, kyQuyetToanNam, nhanKy } from '@/lib/taxDeadline'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// PostgREST cắt ở 1000 dòng mà không báo lỗi — 293 công ty × 4 loại tờ khai đã vượt xa mốc đó,
// nên mọi truy vấn không giới hạn công ty đều phải phân trang.
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
  const nam = +(searchParams.get('nam') || new Date().getUTCFullYear())
  const kyChon = searchParams.get('ky') || null

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')

  try {
    // 1. Công ty trong phạm vi
    let clients = await docHet(() => supabase.from('clients')
      .select('id, name, client_code, tax_code, report_type, room_id, assigned_to, is_active, status'))
    clients = clients.filter(c => c.is_active !== false && c.status !== 'inactive')

    if (!laAdmin) {
      const phu = new Set((await docHet(() => supabase.from('client_secondary_staff')
        .select('client_id, staff_id').eq('staff_id', caller.staffId))).map(r => r.client_id))
      clients = clients.filter(c =>
        c.assigned_to === caller.staffId
        || phu.has(c.id)
        || (laTruongPhong && c.room_id && rooms.includes(c.room_id)))
    }

    if (!clients.length) {
      return Response.json({ nam, ky: kyChon, cacKy: [], loaiToKhai: [], congTy: [], oTong: null })
    }

    const idCty = clients.map(c => c.id)

    // 2. Danh mục tờ khai + nghĩa vụ của kỳ đang chọn
    const loaiToKhai = (await docHet(() => supabase.from('tax_filing_types')
      .select('id, code, name, tax_kind, period_kind, sort_order, is_active')))
      .filter(t => t.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    let nghiaVu = []
    for (let i = 0; i < idCty.length; i += 200) {
      const lo = idCty.slice(i, i + 200)
      nghiaVu = nghiaVu.concat(await docHet(() => {
        let q = supabase.from('tax_obligations')
          .select('id, client_id, filing_type_id, period_code, due_date, state')
          .in('client_id', lo)
        if (kyChon) q = q.eq('period_code', kyChon)
        else q = q.like('period_code', `%.${nam}`)
        return q
      }))
    }

    // 3. Công ty nào đã nối tài khoản cổng thuế
    let taiKhoan = []
    for (let i = 0; i < idCty.length; i += 200) {
      taiKhoan = taiKhoan.concat(await docHet(() => supabase.from('tax_accounts')
        .select('client_id, portal, status').in('client_id', idCty.slice(i, i + 200))))
    }
    const daNoi = new Map(taiKhoan.map(t => [t.client_id, t.status]))

    // 4. Gom theo công ty
    const theoCty = new Map(clients.map(c => [c.id, []]))
    for (const o of nghiaVu) theoCty.get(o.client_id)?.push(o)

    const homNay = new Date().toISOString().slice(0, 10)
    const congTy = clients.map(c => {
      const ds = theoCty.get(c.id) || []
      return {
        id: c.id,
        ten: c.name,
        maKH: c.client_code || null,
        mst: c.tax_code || null,
        kyKhai: c.report_type === 'monthly' ? 'Tháng' : 'Quý',
        roomId: c.room_id,
        assignedTo: c.assigned_to,
        trangThaiTaiKhoan: daNoi.get(c.id) || 'not_connected',
        nghiaVu: ds.map(o => ({
          id: o.id,
          loaiId: o.filing_type_id,
          ky: o.period_code,
          hanNop: o.due_date,
          // Quá hạn tính TẠI CHỖ để khỏi phụ thuộc một công việc chạy nền: qua HẾT ngày hạn mới
          // là quá hạn, giống quy ước của Checklist công việc.
          trangThai: (o.state === 'not_filed' && o.due_date < homNay) ? 'overdue' : o.state,
        })),
      }
    })

    // 5. Sáu ô tổng hợp
    const tatCa = congTy.flatMap(c => c.nghiaVu)
    const dem = tt => tatCa.filter(o => o.trangThai === tt).length
    const oTong = {
      phaiNop: tatCa.length,
      chapNhan: dem('accepted'),
      choKetQua: dem('received'),
      chuaNop: dem('not_filed'),
      quaHan: dem('overdue'),
      khongPhatSinh: dem('no_activity'),
      khongChapNhan: dem('rejected'),
      chuaNoiTaiKhoan: congTy.filter(c => c.trangThaiTaiKhoan === 'not_connected').length,
    }

    // 6. Các kỳ để đổ vào ô chọn — gộp kỳ tháng, kỳ quý và kỳ quyết toán năm
    const cacKy = [
      ...cacKyTrongNam('quarterly', nam).map(k => k.period_code),
      ...cacKyTrongNam('monthly', nam).map(k => k.period_code),
      kyQuyetToanNam(nam).period_code,
    ].map(code => ({ ma: code, nhan: nhanKy(code) }))

    return Response.json({ nam, ky: kyChon, cacKy, loaiToKhai, congTy, oTong })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
