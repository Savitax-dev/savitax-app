// Nhắc hạn nộp tờ khai — Phân hệ Tờ khai.
//
// GET /api/admin/tokhai/nhac-han
//   Trả các mốc hạn ĐÁNG NHẮC trong phạm vi của người gọi, để hiện dải chữ chạy ở đầu trang.
//
// Theo đặc tả: nhắc 5 ngày trước hạn, đúng ngày hạn, và 1–2 ngày sau hạn. Ở đây nới thành
// 10 ngày trước cho kế toán có thời gian xoay; quá hạn nhắc thêm 2 ngày rồi thôi (từ 26/10/2026 —
// trước đó nhắc mãi tới khi nộp, dải đầu trang đỏ cả tuần). Danh sách quá hạn đầy đủ ở tab Lịch hạn nộp.
import { createClient } from '@supabase/supabase-js'
import { roomsWithRole } from '@/lib/roleUnion'
import { callerHasPermission } from '@/lib/serverAuth'
import { mapPhongTuDanhSachNV } from '@/lib/clientRoom'
import { nhanKy } from '@/lib/taxDeadline'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function docHet(query) {
  let ra = [], tu = 0
  for (;;) {
    // .order('id') để lật trang ổn định (thêm sau order sẵn có thì làm khoá phụ) — không sắp thì trang
    // sau lặp / bỏ sót dòng; tax_obligations đã quá 1.000 dòng (đo 17/10/2026).
    const { data, error } = await query().order('id').range(tu, tu + 999)
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
// Quá hạn chỉ nhắc thêm 2 ngày sau hạn rồi tự tắt (anh yêu cầu 26/10/2026: dải đầu trang cứ đỏ mãi kỳ
// đã qua — vd 01/GTGT T9 hạn 20/10 tới 26/10 vẫn còn). Đúng đặc tả gốc "1–2 ngày sau hạn". Công ty chưa nộp
// vẫn hiện "Quá hạn" ở tab Lịch hạn nộp — chỉ dải nhắc thôi không lặp lại nữa.
const NGAY_NHAC_SAU = 2

export async function GET() {
  // TỪ 15/10/2026 DẢI NHẮC NẰM Ở ĐẦU MỌI TRANG của app (như bảng tin MISA), không chỉ trong Phân hệ
  // Tờ khai. Nên route này được gọi bởi CẢ người không làm tờ khai — phòng HCNS, kinh doanh.
  //
  // Kiểm quyền TRƯỚC khi chạy truy vấn: phần dưới đọc toàn bộ công ty, nhân viên và nghĩa vụ
  // thuế, không có lý do gì chạy nó cho người không xem được Tờ khai.
  //
  // Không có quyền thì trả 200 kèm danh sách RỖNG, không trả 403: dải này tự gọi ở mọi trang, trả
  // lỗi thì bảng điều khiển trình duyệt của mọi người ngoài phòng kế toán đỏ lòm suốt ngày.
  const auth = await callerHasPermission('view_tax_filings')
  if (!auth.ok) {
    if (auth.status === 401) return Response.json({ error: auth.error }, { status: 401 })
    return Response.json({ nhac: [] })
  }

  const supabase = getAdmin()
  const caller = auth.caller
  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laTruongPhong = roles.includes('leader')
  // Trưởng phòng thấy cả phòng — nhưng chỉ phòng mình LÀM TRƯỞNG (kiêm nhiệm: đúng phòng kiêm nhiệm).
  const phongLamTruong = roomsWithRole(caller, ['leader'])

  const homNay = new Date().toISOString().slice(0, 10)
  const denNgay = new Date(Date.now() + NGAY_NHAC_TRUOC * 864e5).toISOString().slice(0, 10)
  const tuNgay = new Date(Date.now() - NGAY_NHAC_SAU * 864e5).toISOString().slice(0, 10)

  try {
    // Dải chữ nhắc hạn nằm ở MỌI trang của phân hệ, nên route này chạy theo mỗi lần mở trang.
    // Năm thứ dưới đây không phụ thuộc nhau → gọi hết trong MỘT vòng chờ.
    // Riêng bảng nghĩa vụ: lọc theo trạng thái và hạn nộp, không dính phạm vi người xem, nên lấy
    // luôn rồi mới lọc phạm vi bằng JS.
    const [dsClients, dsLoai, dsPhu, dsStaff, dsNghiaVu] = await Promise.all([
      docHet(() => supabase.from('clients').select('id, room_id, assigned_to, is_active, status')),
      docHet(() => supabase.from('tax_filing_types').select('id, code')),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('client_secondary_staff')
        .select('client_id').eq('staff_id', caller.staffId)),
      laAdmin ? Promise.resolve([]) : docHet(() => supabase.from('staff').select('id, room_id')),
      docHet(() => supabase.from('tax_obligations')
        .select('client_id, filing_type_id, period_code, due_date, state')
        .in('state', ['not_filed', 'rejected', 'overdue'])
        .gte('due_date', tuNgay).lte('due_date', denNgay)),
    ])

    const phu = new Set(dsPhu.map(r => r.client_id))
    const dangPhucVu = dsClients.filter(c => c.is_active !== false && c.status !== 'inactive')
    // Phòng của công ty suy từ nhân viên phụ trách — clients.room_id gần như luôn trống.
    const phongCuaCty = laAdmin ? new Map() : mapPhongTuDanhSachNV(dangPhucVu, dsStaff)

    const trongPhamVi = new Set(dangPhucVu
      .filter(c => laAdmin
        || c.assigned_to === caller.staffId
        || phu.has(c.id)
        || phongLamTruong.includes(phongCuaCty.get(c.id)))
      .map(c => c.id))

    let nghiaVu = dsNghiaVu.filter(o => trongPhamVi.has(o.client_id))

    // Chỉ giữ đúng các mốc đã chốt, và các kỳ vừa quá hạn trong NGAY_NHAC_SAU ngày.
    const soNgayConLai = han => Math.round((new Date(han) - new Date(homNay)) / 864e5)
    nghiaVu = nghiaVu.filter(o => {
      const c = soNgayConLai(o.due_date)
      return (c < 0 && c >= -NGAY_NHAC_SAU) || CAC_MOC.includes(c)
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
