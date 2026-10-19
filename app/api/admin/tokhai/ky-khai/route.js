import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'
import { phongCuaMotCongTy } from '@/lib/clientRoom'
import { roomsWithRole } from '@/lib/roleUnion'
import { kyKhaiTai, ngayDauQuy } from '@/lib/tokhaiLich'
import { sinhLaiLich } from '@/lib/tokhaiKyKhai'

// Kỳ khai RIÊNG của một công ty cho từng loại tờ khai định kỳ — anh chốt hướng A ngày 19/10/2026.
//
// GET  ?clientId=   -> mỗi loại tờ khai định kỳ: đang khai tháng hay quý, và các lần đã đổi.
// POST { clientId, filingTypeId, periodKind: 'month'|'quarter', tuKy: 'Q3.2026' }
//      -> ghi tax_client_filings, rồi SINH LẠI lịch hạn nộp của đúng (công ty, loại tờ khai) đó.
//
// Ca thật: VINA HSIN GON, CHARGEPOINT kê GTGT theo THÁNG nhưng TNCN theo QUÝ. App sinh TNCN theo
// tháng cho họ nên tờ khai quý đã được chấp nhận vẫn bị báo "Chưa nộp" — hạn 20/10/2026.
//
// QUYỀN: manage_tax_catalog ("Cấu hình danh mục tờ khai, KỲ KHAI, ngày lễ" — có sẵn). Ngoài quản
// trị, người có quyền chỉ đổi được công ty TRONG PHÒNG MÌNH LÀM TRƯỞNG — "tp nào quản lý phòng đó,
// không đụng lẫn nhau". Đổi kỳ khai là đổi hạn nộp của cả năm, không phải việc của một nhân viên.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Loại tờ khai ĐỊNH KỲ — chỉ chúng mới có chuyện tháng/quý. Quyết toán năm không đổi được.
const laDinhKy = (t) => t.period_kind === 'month' || t.period_kind === 'quarter'

async function duocDoi(supabase, caller, client) {
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  if (roles.includes('admin')) return true
  const phong = await phongCuaMotCongTy(supabase, client)
  return !!phong && roomsWithRole(caller, ['leader']).includes(phong)
}

export async function GET(request) {
  const auth = await callerHasPermission('view_tax_filings')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })

  const supabase = getAdmin()
  const [{ data: client }, { data: loaiTK }, { data: ghiDe }] = await Promise.all([
    supabase.from('clients').select('id, name, report_type, assigned_to, room_id').eq('id', clientId).maybeSingle(),
    supabase.from('tax_filing_types').select('id, code, name, period_kind, is_active, sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('tax_client_filings').select('filing_type_id, period_kind, effective_from, approved_by, created_at').eq('client_id', clientId),
  ])
  if (!client) return Response.json({ error: 'Không tìm thấy công ty' }, { status: 404 })

  const homNay = new Date().toISOString().slice(0, 10)
  const ds = (loaiTK || []).filter(laDinhKy).map(t => {
    const cuaLoai = (ghiDe || []).filter(g => g.filing_type_id === t.id)
      .sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))
    return {
      filingTypeId: t.id, code: t.code, name: t.name,
      // Kỳ khai ĐANG áp dụng hôm nay — tính bằng đúng luật sinh lịch, không tự suy riêng ở đây.
      dangKhai: kyKhaiTai(client, cuaLoai, homNay) === 'monthly' ? 'month' : 'quarter',
      macDinh: client.report_type === 'monthly' ? 'month' : 'quarter',
      lichSu: cuaLoai.map(g => ({ periodKind: g.period_kind, tuNgay: g.effective_from, tuDong: !g.approved_by })),
      // Dòng ĐANG áp dụng do app tự đổi theo hồ sơ trên cổng (approved_by trống), không phải người bấm.
      tuDong: (() => {
        const apDung = cuaLoai.filter(g => g.effective_from <= homNay).pop()
        return !!apDung && !apDung.approved_by
      })(),
    }
  })

  const auth2 = await duocDoi(supabase, auth.caller, client)
  // Quyền đổi: phải có manage_tax_catalog VÀ đúng phạm vi. Trả về để giao diện khỏi hiện nút vô ích.
  const coQuyen = auth2 && (await callerHasPermission('manage_tax_catalog')).ok
  return Response.json({ data: ds, duocDoi: coQuyen })
}

export async function POST(request) {
  const auth = await callerHasPermission('manage_tax_catalog')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { clientId, filingTypeId, periodKind, tuKy, thu } = await request.json()
  if (!clientId || !filingTypeId) return Response.json({ error: 'Thiếu công ty hoặc loại tờ khai' }, { status: 400 })
  if (periodKind !== 'month' && periodKind !== 'quarter') {
    return Response.json({ error: 'Kỳ khai chỉ được là tháng hoặc quý' }, { status: 400 })
  }
  // Ngày đổi PHẢI là đầu quý: đổi giữa quý thì có tháng không thuộc kỳ nào (xem lib/tokhaiLich.js).
  const tuNgay = ngayDauQuy(tuKy)
  if (!tuNgay) return Response.json({ error: 'Kỳ áp dụng phải là một quý, ví dụ Q3.2026' }, { status: 400 })

  const supabase = getAdmin()
  const [{ data: client }, { data: loai }] = await Promise.all([
    supabase.from('clients').select('id, name, report_type, contract_start, assigned_to, room_id, status').eq('id', clientId).maybeSingle(),
    supabase.from('tax_filing_types').select('id, code, period_kind').eq('id', filingTypeId).maybeSingle(),
  ])
  if (!client) return Response.json({ error: 'Không tìm thấy công ty' }, { status: 404 })
  if (!loai || !laDinhKy(loai)) return Response.json({ error: 'Chỉ đổi được kỳ khai của tờ khai định kỳ' }, { status: 400 })
  if (!(await duocDoi(supabase, auth.caller, client))) {
    return Response.json({ error: 'Chỉ trưởng phòng của phòng này (hoặc quản trị) mới đổi được kỳ khai' }, { status: 403 })
  }

  // XEM TRƯỚC (thu: true): KHÔNG ghi lần đổi, KHÔNG đụng lịch — chỉ tính xem nếu đổi thì sẽ xoá gì,
  // sinh gì, gắn lại hồ sơ nào. Giao diện bắt người dùng xem bước này rồi mới cho bấm lưu thật, vì
  // lưu là XOÁ nghĩa vụ trong cơ sở dữ liệu.
  if (thu) {
    const { data: cu } = await supabase.from('tax_client_filings').select('period_kind, effective_from')
      .eq('client_id', clientId).eq('filing_type_id', filingTypeId)
    const gia = [...(cu || []).filter(g => g.effective_from !== tuNgay), { period_kind: periodKind, effective_from: tuNgay }]
    try {
      const kq = await sinhLaiLich(supabase, { client, loai, tuNgay, thu: true, ghiDeGia: gia })
      return Response.json({ ok: true, ...kq })
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 })
    }
  }

  // 1. Ghi lần đổi. Cùng (công ty, loại, ngày áp dụng) thì ghi đè — bấm lại để sửa cho đúng.
  const { error: e1 } = await supabase.from('tax_client_filings').upsert({
    client_id: clientId, filing_type_id: filingTypeId, period_kind: periodKind,
    effective_from: tuNgay, approved_by: auth.caller.staffId,
  }, { onConflict: 'client_id,filing_type_id,effective_from' })
  if (e1) return Response.json({ error: 'Không lưu được kỳ khai: ' + e1.message }, { status: 500 })

  // 2-5. Sinh lại lịch của đúng (công ty, loại tờ khai) — logic ở lib/tokhaiKyKhai.js để chạy
  //      KHÔ được trên dữ liệu thật trước khi bấm thật (hàm này xoá nghĩa vụ).
  try {
    const kq = await sinhLaiLich(supabase, { client, loai, tuNgay })
    return Response.json({ ok: true, ...kq })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
