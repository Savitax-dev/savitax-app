// Số liệu phí cho khối "Căn cứ điều chỉnh phí" — màn Tăng trưởng & phí (kế hoạch mục 3b).
//
// GET /api/admin/phantich/phi?cty=<id>
//   CHỈ người có quyền `xem_phi_de_xuat` (sql/40, gán sẵn cho trưởng phòng; vai trò is_system luôn có) VÀ công ty
//   nằm trong phạm vi (phụ trách chính/phụ, trưởng phòng của phòng chứa công ty, quản trị). Quyền xét theo vai trò CÓ
//   HIỆU LỰC Ở PHÒNG CỦA CÔNG TY (kiêm nhiệm chỉ có quyền ở phòng kiêm nhiệm — lib/roleUnion.js rolesFor).
//   Chỉ ĐỌC: phí đang thu (monthly_fee, đã gồm VAT), kỳ thu phí, ngày bắt đầu hợp đồng, các mốc đổi phí (service_fees
//   loại fee_plan), báo giá gần nhất của phân hệ Kinh doanh cùng MST (số khảo sát lúc báo giá). Không ghi gì.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { phongCuaMotCongTy } from '@/lib/clientRoom'
import { roomsWithRole, rolesFor } from '@/lib/roleUnion'

const QUYEN = 'xem_phi_de_xuat'
const getAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function coQuyen(supabase, roles) {
  if (!roles.length) return false
  if (roles.includes('admin')) return true
  const { data: r } = await supabase.from('roles').select('is_system').in('id', roles)
  if ((r || []).some(x => x.is_system)) return true
  const { data: rp } = await supabase.from('role_permissions').select('permission_key').in('role_id', roles).eq('permission_key', QUYEN).limit(1)
  return !!rp?.length
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const caller = auth.caller
  const ctyId = new URL(request.url).searchParams.get('cty')
  if (!ctyId) return Response.json({ error: 'Thiếu công ty' }, { status: 400 })

  const supabase = getAdmin()
  try {
    const { data: c } = await supabase.from('clients')
      .select('id, tax_code, monthly_fee, fee_period, report_type, contract_start, assigned_to, room_id').eq('id', ctyId).maybeSingle()
    if (!c) return Response.json({ error: 'Không tìm thấy công ty' }, { status: 404 })

    // Phạm vi công ty
    const phong = await phongCuaMotCongTy(supabase, c)
    const laAdmin = (caller.roles?.length ? caller.roles : [caller.role]).includes('admin')
    let trongPhamVi = laAdmin || c.assigned_to === caller.staffId || (phong && roomsWithRole(caller, ['leader']).includes(phong))
    if (!trongPhamVi) {
      // limit(1): bảng có thể có dòng trùng (bootstrap cũ không có unique) — maybeSingle sẽ lỗi và chặn oan
      const { data: phu } = await supabase.from('client_secondary_staff').select('staff_id').eq('client_id', c.id).eq('staff_id', caller.staffId).limit(1)
      trongPhamVi = !!phu?.length
    }
    if (!trongPhamVi) return Response.json({ error: 'Công ty ngoài phạm vi' }, { status: 403 })

    // Quyền xem phí — theo vai trò có hiệu lực ở phòng của công ty
    // rolesFor luôn kèm vai trò CHÍNH → trưởng phòng A làm nhân viên phụ một công ty phòng B sẽ được tính là trưởng phòng ở B.
    // Bỏ 'leader' khi người gọi không làm trưởng đúng phòng của công ty (rà soát 27/10/2026).
    const laTruongPhongNay = !!phong && roomsWithRole(caller, ['leader']).includes(phong)
    const vaiTro = rolesFor(caller, phong).filter(r => r !== 'leader' || laTruongPhongNay)
    if (!laAdmin && !(await coQuyen(supabase, vaiTro))) return Response.json({ khongCoQuyen: true }, { status: 403 })

    const { data: plans } = await supabase.from('service_fees').select('year, month, amount').eq('client_id', c.id).eq('type', 'fee_plan').order('id')

    // Báo giá gần nhất cùng MST (phân hệ Kinh doanh) — bảng chưa có (bản clone) thì bỏ qua
    let baoGia = null
    try {
      const mst = String(c.tax_code || '').replace(/\D/g, '')
      if (mst) {
        // Lọc theo MST ngay trong truy vấn (bỏ số 0 đầu), rồi so khớp đúng ở dưới — trước lấy 200 báo giá mới nhất mới lọc nên sót báo giá cũ
        const { data: bq } = await supabase.from('sales_quotes')
          .select('quote_no, quote_date, tax_code, monthly_final, survey').eq('is_deleted', false).ilike('tax_code', '%' + mst.replace(/^0+/, '') + '%')
          .order('quote_date', { ascending: false }).order('id', { ascending: false }).limit(50)
        const q = (bq || []).find(x => String(x.tax_code || '').replace(/\D/g, '').replace(/^0+/, '') === mst.replace(/^0+/, ''))
        if (q) {
          const s = q.survey || {}
          baoGia = { soBaoGia: q.quote_no, ngay: q.quote_date, phiThang: q.monthly_final ?? null,
            khaoSat: { invIn: s.invIn ?? null, invOut: s.invOut ?? null, bankStmt: s.bankStmt ?? null, docs: s.docs ?? null, revenueYear: s.revenueYear ?? null,
              laborBh: s.laborBh ?? null, laborNoBh: s.laborNoBh ?? null, customs: !!s.customs } }
        }
      }
    } catch (_) { baoGia = null }

    return Response.json({
      monthlyFee: c.monthly_fee ?? null, feePeriod: c.fee_period || 'monthly', reportType: c.report_type || null,
      contractStart: c.contract_start || null, feePlans: (plans || []).map(p => ({ year: p.year, month: p.month, amount: p.amount })), baoGia,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
