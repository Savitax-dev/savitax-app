// Báo cáo tờ khai theo PHÒNG và theo NHÂN VIÊN — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/tong-quan?ky=Q3.2026&roomId=…
//   - Không truyền roomId → tổng hợp theo PHÒNG (toàn công ty, trong phạm vi người gọi).
//   - Có roomId        → tổng hợp theo NHÂN VIÊN của phòng đó.
//
// Cùng bộ chỉ số cho cả hai mức, để trưởng phòng và giám đốc đọc một kiểu bảng duy nhất.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { cacKyTrongNam, kyQuyetToanNam, nhanKy } from '@/lib/taxDeadline'
import { mapPhongCuaCongTy } from '@/lib/clientRoom'

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

// Một "ô" trong báo cáo: gom nghĩa vụ + hồ sơ của một nhóm (phòng hoặc nhân viên).
function oTrong(id, ten) {
  return {
    id, ten,
    soCongTy: 0, daNoiTaiKhoan: 0,
    phaiNop: 0, chapNhan: 0, choKetQua: 0, chuaNop: 0, quaHan: 0, khongPhatSinh: 0, khongChapNhan: 0,
    coNgayTiepNhan: 0, dungHan: 0,
    dongBoGanNhat: null,
  }
}

function chotSo(o) {
  // % hoàn thành: đã có kết quả trên cổng (chấp nhận / đã tiếp nhận) hoặc được đánh không phát sinh.
  const xong = o.chapNhan + o.choKetQua + o.khongPhatSinh
  o.phanTramHoanThanh = o.phaiNop ? Math.round((xong / o.phaiNop) * 100) : null
  // % đúng hạn chỉ tính trên những tờ khai ĐÃ có ngày tiếp nhận — chưa nộp thì chưa kết luận được.
  o.phanTramDungHan = o.coNgayTiepNhan ? Math.round((o.dungHan / o.coNgayTiepNhan) * 100) : null
  return o
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const kyChon = searchParams.get('ky') || null
  const roomId = searchParams.get('roomId') || null
  // staffId → xuống cấp thứ ba: từng CÔNG TY của nhân viên đó.
  const staffId = searchParams.get('staffId') || null
  const nam = +(searchParams.get('nam') || new Date().getUTCFullYear())

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')

  const homNayISO = new Date().toISOString().slice(0, 10)

  try {
    const [dsClients, dsRooms, dsStaff, dsTaiKhoan, dsPhu, kySapToi] = await Promise.all([
      docHet(() => supabase.from('clients')
        .select('id, name, client_code, room_id, assigned_to, is_active, status')),
      docHet(() => supabase.from('rooms').select('id, name, type')),
      docHet(() => supabase.from('staff').select('id, full_name, room_id, is_active')),
      docHet(() => supabase.from('tax_accounts').select('client_id, status')),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('client_secondary_staff')
        .select('client_id').eq('staff_id', caller.staffId)),
      kyChon ? Promise.resolve(null) : supabase.from('tax_obligations')
        .select('period_code, due_date').gte('due_date', homNayISO)
        .order('due_date', { ascending: true }).limit(1),
    ])

    const phu = new Set(dsPhu.map(r => r.client_id))
    let clients = dsClients.filter(c => c.is_active !== false && c.status !== 'inactive')

    // Phòng của công ty suy từ NHÂN VIÊN PHỤ TRÁCH — clients.room_id gần như luôn trống.
    const phongCuaCty = await mapPhongCuaCongTy(supabase, clients)

    if (!laAdmin) {
      clients = clients.filter(c =>
        c.assigned_to === caller.staffId
        || phu.has(c.id)
        || (laTruongPhong && rooms.includes(phongCuaCty.get(c.id))))
    }
    // Phòng HCNS và Kinh doanh không làm tờ khai → loại khỏi báo cáo cho khỏi nhiễu,
    // giống cách KPI và công nợ đang loại.
    const phongBoQua = new Set(dsRooms.filter(r => ['hcns', 'kinhdoanh'].includes(r.type)).map(r => r.id))
    clients = clients.filter(c => !phongBoQua.has(phongCuaCty.get(c.id)))
    if (roomId) clients = clients.filter(c => phongCuaCty.get(c.id) === roomId)
    if (staffId) clients = clients.filter(c => c.assigned_to === staffId)

    const ky = kyChon || kySapToi?.data?.[0]?.period_code || null
    const trongPhamVi = new Set(clients.map(c => c.id))

    let nghiaVu = [], hoSo = [], job = []
    if (ky && trongPhamVi.size) {
      ;[nghiaVu, hoSo, job] = await Promise.all([
        docHet(() => supabase.from('tax_obligations')
          .select('client_id, period_code, state, due_date').eq('period_code', ky)),
        docHet(() => supabase.from('tax_filings')
          .select('client_id, period_code, state, received_at, on_time, obligation_id').eq('period_code', ky)),
        docHet(() => supabase.from('tax_sync_jobs')
          .select('client_id, finished_at, result').eq('result', 'success')),
      ])
      nghiaVu = nghiaVu.filter(o => trongPhamVi.has(o.client_id))
      hoSo = hoSo.filter(h => trongPhamVi.has(h.client_id))
      job = job.filter(j => trongPhamVi.has(j.client_id))
    }

    const daNoi = new Map(dsTaiKhoan.map(t => [t.client_id, t.status]))
    const dongBoTheoCty = new Map()
    for (const j of job) {
      if (!j.finished_at) continue
      const cu = dongBoTheoCty.get(j.client_id)
      if (!cu || j.finished_at > cu) dongBoTheoCty.set(j.client_id, j.finished_at)
    }

    // Nhóm theo phòng, hoặc theo nhân viên phụ trách nếu đang xem một phòng.
    const tenPhong = new Map(dsRooms.map(r => [r.id, r.name]))
    const tenNV = new Map(dsStaff.map(s => [s.id, s.full_name]))
    const tenCty = new Map(clients.map(c => [c.id, c.client_code ? `${c.name} (${c.client_code})` : c.name]))
    // Ba cấp: chưa chọn gì → theo PHÒNG; có roomId → theo NHÂN VIÊN; có staffId → theo CÔNG TY.
    const khoaCua = c => staffId ? c.id
      : roomId ? (c.assigned_to || 'chua-giao')
      : (phongCuaCty.get(c.id) || 'chua-co-phong')
    const tenCua = k => staffId ? (tenCty.get(k) || '(công ty)')
      : roomId ? (k === 'chua-giao' ? '(chưa giao nhân viên)' : tenNV.get(k) || '(nhân viên đã nghỉ)')
      : (k === 'chua-co-phong' ? '(chưa xếp phòng)' : tenPhong.get(k) || '(phòng đã xóa)')

    const nhom = new Map()
    const oCua = k => {
      if (!nhom.has(k)) nhom.set(k, oTrong(k, tenCua(k)))
      return nhom.get(k)
    }

    const nhomCuaCty = new Map()
    for (const c of clients) {
      const k = khoaCua(c)
      nhomCuaCty.set(c.id, k)
      const o = oCua(k)
      o.soCongTy++
      if (daNoi.get(c.id) === 'active') o.daNoiTaiKhoan++
      const db = dongBoTheoCty.get(c.id)
      if (db && (!o.dongBoGanNhat || db > o.dongBoGanNhat)) o.dongBoGanNhat = db
    }

    // Hồ sơ thật gắn với nghĩa vụ nào thì trạng thái lấy theo cổng.
    const hoSoTheoNghiaVu = new Map()
    for (const h of hoSo) if (h.obligation_id) hoSoTheoNghiaVu.set(h.obligation_id, h)

    for (const o of nghiaVu) {
      const k = nhomCuaCty.get(o.client_id)
      if (!k) continue
      const cell = oCua(k)
      const h = hoSoTheoNghiaVu.get(o.id) || null
      const tt = h ? h.state
        : (o.state === 'not_filed' && o.due_date && o.due_date < homNayISO) ? 'overdue'
        : o.state

      cell.phaiNop++
      if (tt === 'accepted') cell.chapNhan++
      else if (tt === 'received') cell.choKetQua++
      else if (tt === 'rejected') cell.khongChapNhan++
      else if (tt === 'overdue') cell.quaHan++
      else if (tt === 'no_activity') cell.khongPhatSinh++
      else cell.chuaNop++

      if (h?.received_at) {
        cell.coNgayTiepNhan++
        if (h.on_time) cell.dungHan++
      }
    }

    const ds = [...nhom.values()].map(chotSo)
      .sort((a, b) => (b.quaHan - a.quaHan) || a.ten.localeCompare(b.ten, 'vi'))

    // Dòng tổng của toàn bộ phạm vi đang xem.
    const tong = chotSo(ds.reduce((t, o) => {
      for (const k of ['soCongTy', 'daNoiTaiKhoan', 'phaiNop', 'chapNhan', 'choKetQua', 'chuaNop',
        'quaHan', 'khongPhatSinh', 'khongChapNhan', 'coNgayTiepNhan', 'dungHan']) t[k] += o[k]
      if (o.dongBoGanNhat && (!t.dongBoGanNhat || o.dongBoGanNhat > t.dongBoGanNhat)) t.dongBoGanNhat = o.dongBoGanNhat
      return t
    }, oTrong('tong', 'Tổng cộng')))

    const cacKy = [
      ...cacKyTrongNam('quarterly', nam).map(k => k.period_code),
      ...cacKyTrongNam('monthly', nam).map(k => k.period_code),
      kyQuyetToanNam(nam).period_code,
    ].map(code => ({ ma: code, nhan: nhanKy(code) }))

    return Response.json({
      ky, nam, cacKy,
      mucXem: staffId ? 'cong_ty' : roomId ? 'nhan_vien' : 'phong',
      tenPhong: roomId ? (tenPhong.get(roomId) || '') : null,
      ds, tong,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
