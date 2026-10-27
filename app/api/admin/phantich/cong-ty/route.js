// Danh sách công ty cho Phân hệ Soát xét báo cáo + Rủi ro thuế.
//
// GET /api/admin/phantich/cong-ty
//   Trả công ty trong PHẠM VI người gọi — y như Tờ khai (app/api/admin/tokhai/overview):
//   quản trị → tất cả; trưởng phòng → phòng mình LÀM TRƯỞNG; nhân viên → công ty mình phụ trách chính/phụ.
//   Phòng của công ty suy từ nhân viên phụ trách (lib/clientRoom.js), KHÔNG đọc clients.room_id.
//
// Chỉ trả thông tin nhận diện + kỳ khai. Máy chủ không nhận, không đọc file nào của khách: số liệu nằm
// trên Drive và được đọc ngay trên máy nhân viên (kế hoạch mục 2). Phí KHÔNG trả ở đây.
import { createClient } from '@supabase/supabase-js'
import { docDvkOnly } from '@/lib/dvkOnly'
import { roomsWithRole } from '@/lib/roleUnion'
import { requireLogin } from '@/lib/serverAuth'
import { mapPhongTuDanhSachNV } from '@/lib/clientRoom'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// PostgREST cắt im lặng ở 1000 dòng; lật trang phải .order('id') không thì lặp / sót dòng.
async function docHet(query) {
  let ra = [], tu = 0
  for (;;) {
    const { data, error } = await query().order('id').range(tu, tu + 999)
    if (error) throw new Error(error.message)
    ra = ra.concat(data)
    if (data.length < 1000) return ra
    tu += 1000
  }
}

// Tháng ngưng dịch vụ (sql/25) đọc riêng và nuốt lỗi: thiếu cột không được làm hỏng cả danh sách.
async function docNgung(supabase) {
  try {
    const { data, error } = await supabase.from('clients').select('id, service_end').not('service_end', 'is', null)
    if (error) return new Map()
    return new Map((data || []).map(c => [c.id, c.service_end]))
  } catch (_) { return new Map() }
}

export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const phongLamTruong = roomsWithRole(caller, ['leader'])

  try {
    const [dsClients, dsRooms, dsStaff, dsPhu, dvkOnly, ngung] = await Promise.all([
      docHet(() => supabase.from('clients')
        .select('id, name, client_code, tax_code, report_type, assigned_to, room_id, is_active, status, is_hkd, contract_start')),
      docHet(() => supabase.from('rooms').select('id, name')),
      docHet(() => supabase.from('staff').select('id, full_name, room_id')),
      docHet(() => supabase.from('client_secondary_staff').select('id, client_id, staff_id')),
      docDvkOnly(supabase),
      docNgung(supabase),
    ])

    // Công ty chỉ dùng Dịch vụ khác không làm báo cáo → bỏ, như Tờ khai và Checklist.
    let clients = dsClients.filter(c => c.is_active !== false && c.status !== 'inactive' && !dvkOnly.has(c.id))
    const phongCuaCty = mapPhongTuDanhSachNV(clients, dsStaff)
    const phuCuaToi = new Set(dsPhu.filter(r => r.staff_id === caller.staffId).map(r => r.client_id))

    const vaiTro = c => c.assigned_to === caller.staffId ? 'chinh'
      : phuCuaToi.has(c.id) ? 'phu'
      : phongLamTruong.includes(phongCuaCty.get(c.id)) ? 'phong'
      : laAdmin ? 'quan_tri' : null
    clients = clients.filter(c => vaiTro(c))

    const tenPhong = new Map(dsRooms.map(r => [r.id, r.name]))
    const tenNV = new Map(dsStaff.map(s => [s.id, s.full_name]))
    const nvPhu = new Map()
    for (const r of dsPhu) {
      if (!nvPhu.has(r.client_id)) nvPhu.set(r.client_id, [])
      nvPhu.get(r.client_id).push(tenNV.get(r.staff_id) || '')
    }

    const congTy = clients.map(c => ({
      id: c.id,
      ten: c.name,
      maKH: c.client_code || '',
      mst: c.tax_code || '',
      // Kỳ khai theo hồ sơ công ty. Kỳ khai cố định cả năm tài chính; thư mục / tờ khai nói khác thì
      // màn Soát kỳ báo "có thể tick nhầm loại báo cáo" (kế hoạch mục 3c), không tự đổi gì.
      kyKhai: c.report_type === 'monthly' ? 'thang' : 'quy',
      laHkd: !!c.is_hkd,
      batDau: c.contract_start || null,
      ngungTu: ngung.get(c.id) || null,
      roomId: phongCuaCty.get(c.id) || null,
      phong: tenPhong.get(phongCuaCty.get(c.id)) || '',
      nhanVien: tenNV.get(c.assigned_to) || '',
      nhanVienPhu: (nvPhu.get(c.id) || []).filter(Boolean),
      vaiTro: vaiTro(c),
    })).sort((a, b) => (a.phong || 'zzz').localeCompare(b.phong || 'zzz', 'vi')
      || (a.nhanVien || '').localeCompare(b.nhanVien || '', 'vi')
      || (a.ten || '').localeCompare(b.ten || '', 'vi'))

    return Response.json({ congTy })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
