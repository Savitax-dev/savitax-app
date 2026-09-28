// Nhắc hạn nộp tờ khai — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/nhac-han
//   Trả các mốc hạn ĐÁNG NHẮC trong phạm vi của người gọi, để hiện dải chữ chạy ở đầu trang.
//
// Theo đặc tả: nhắc 5 ngày trước hạn, đúng ngày hạn, và 1–2 ngày sau hạn. Ở đây nới thành
// 10 ngày trước cho kế toán có thời gian xoay, và giữ nguyên các kỳ ĐÃ QUÁ HẠN mà chưa nộp —
// quá hạn là thứ càng phải nhắc, không được im lặng.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { mapPhongCuaCongTy } from '@/lib/clientRoom'
import { nhanKy } from '@/lib/taxDeadline'

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

// Các mốc nhắc, anh chốt 28/09/2026: còn 10, 5, 3, 2, 1 ngày và đúng ngày hạn.
// CỐ Ý không nhắc mỗi ngày — nhắc dày quá thì người ta quen mắt rồi bỏ qua luôn.
// Mốc 3, 2, 1 và quá hạn hiện chữ ĐỎ ĐẬM.
const CAC_MOC = [10, 5, 3, 2, 1, 0]
const NGAY_NHAC_TRUOC = 10

export async function GET() {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')

  const homNay = new Date().toISOString().slice(0, 10)
  const denNgay = new Date(Date.now() + NGAY_NHAC_TRUOC * 864e5).toISOString().slice(0, 10)

  try {
    const [dsClients, dsLoai, dsPhu] = await Promise.all([
      docHet(() => supabase.from('clients').select('id, room_id, assigned_to, is_active, status')),
      docHet(() => supabase.from('tax_filing_types').select('id, code')),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('client_secondary_staff')
        .select('client_id').eq('staff_id', caller.staffId)),
    ])

    const phu = new Set(dsPhu.map(r => r.client_id))
    const dangPhucVu = dsClients.filter(c => c.is_active !== false && c.status !== 'inactive')
    // Phòng của công ty suy từ nhân viên phụ trách — clients.room_id gần như luôn trống.
    const phongCuaCty = laAdmin ? new Map() : await mapPhongCuaCongTy(supabase, dangPhucVu)

    const trongPhamVi = new Set(dangPhucVu
      .filter(c => laAdmin
        || c.assigned_to === caller.staffId
        || phu.has(c.id)
        || (laTruongPhong && rooms.includes(phongCuaCty.get(c.id))))
      .map(c => c.id))

    // Chỉ lấy nghĩa vụ CHƯA XONG. Đã chấp nhận / đã tiếp nhận / không phát sinh thì thôi nhắc.
    const chuaXong = () => supabase.from('tax_obligations')
      .select('client_id, filing_type_id, period_code, due_date, state')
      .in('state', ['not_filed', 'rejected', 'overdue'])

    let nghiaVu = (await docHet(() => chuaXong().lte('due_date', denNgay)))
      .filter(o => trongPhamVi.has(o.client_id))

    // Chỉ giữ đúng các mốc đã chốt, và các kỳ ĐÃ QUÁ HẠN (quá hạn thì ngày nào cũng phải nhắc).
    const soNgayConLai = han => Math.round((new Date(han) - new Date(homNay)) / 864e5)
    nghiaVu = nghiaVu.filter(o => {
      const c = soNgayConLai(o.due_date)
      return c < 0 || CAC_MOC.includes(c)
    })

    const tenLoai = new Map(dsLoai.map(t => [t.id, t.code]))

    // Gom theo (loại tờ khai, kỳ, hạn) — nhân viên cần biết "còn bao nhiêu công ty", không cần
    // đọc từng dòng một.
    const gom = new Map()
    for (const o of nghiaVu) {
      const khoa = `${o.filing_type_id}|${o.period_code}|${o.due_date}`
      if (!gom.has(khoa)) {
        gom.set(khoa, {
          loai: tenLoai.get(o.filing_type_id) || 'Tờ khai',
          ky: nhanKy(o.period_code),
          hanNop: o.due_date,
          soCongTy: 0,
        })
      }
      gom.get(khoa).soCongTy++
    }

    const ds = [...gom.values()]
      .map(g => {
        const conLai = Math.round((new Date(g.hanNop) - new Date(homNay)) / 864e5)
        return {
          ...g,
          conLai,
          // 3, 2, 1 ngày và đúng ngày hạn → 'gap' (chữ đỏ đậm). Quá hạn cũng đỏ đậm.
          muc: conLai < 0 ? 'qua_han' : conLai <= 3 ? 'gap' : 'sap_toi',
          chu: conLai < 0
            ? `QUÁ HẠN ${Math.abs(conLai)} ngày: ${g.loai} ${g.ky} (hạn ${vn(g.hanNop)}) — còn ${g.soCongTy} công ty chưa nộp`
            : conLai === 0
              ? `HÔM NAY là hạn nộp ${g.loai} ${g.ky} — còn ${g.soCongTy} công ty chưa nộp`
              : `Còn ${conLai} ngày tới hạn ${g.loai} ${g.ky} (${vn(g.hanNop)}) — ${g.soCongTy} công ty chưa nộp`,
        }
      })
      .sort((a, b) => a.hanNop.localeCompare(b.hanNop))

    return Response.json({ nhac: ds, tinhDenNgay: homNay })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

const vn = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
