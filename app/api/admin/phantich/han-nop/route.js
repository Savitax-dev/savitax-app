// Hạn nộp + trạng thái nộp tờ khai của MỘT công ty trong một năm — cho màn Soát kỳ (Phân hệ Soát xét báo cáo).
//
// GET /api/admin/phantich/han-nop?cty=<client id>&nam=2026
//   CHỈ ĐỌC dữ liệu phân hệ Tờ khai đã có: tax_obligations (lịch hạn nộp app tự sinh, trạng thái) + tax_filings (hồ sơ
//   thật lấy từ cổng qua tiện ích Chrome). Không gọi cổng thuế (bất biến của phân hệ Tờ khai), không ghi gì.
//
// Phạm vi: đúng như danh sách công ty của phân hệ (api/admin/phantich/cong-ty) — quản trị mọi công ty, trưởng phòng
// công ty phòng mình, nhân viên công ty mình phụ trách chính/phụ. Quy tắc này trùng khít lib/credentialScope.js nên
// dùng lại hàm đó (đã kiểm kỹ, gồm cả phòng kiêm nhiệm).
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Một công ty một năm chỉ vài chục dòng, nhưng vẫn lật trang theo id cho chắc (PostgREST cắt im lặng ở 1000 dòng)
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

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const cty = searchParams.get('cty') || ''
  const nam = Number(searchParams.get('nam'))
  if (!cty || !(nam >= 2000 && nam <= 2100)) return Response.json({ error: 'Thiếu công ty hoặc năm' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, cty))) return Response.json({ error: 'Công ty ngoài phạm vi của anh/chị' }, { status: 403 })

  try {
    const [loai, nghiaVu, hoSo] = await Promise.all([
      docHet(() => supabase.from('tax_filing_types').select('id, code, name')),
      docHet(() => supabase.from('tax_obligations')
        .select('id, filing_type_id, period_code, period_start, period_end, due_date, state, state_changed_at')
        .eq('client_id', cty).like('period_code', `%.${nam}`)),
      docHet(() => supabase.from('tax_filings')
        .select('id, obligation_id, filing_type_id, period_code, form_kind, amend_no, submitted_at, received_at, state, on_time, portal_status')
        .eq('client_id', cty).like('period_code', `%.${nam}`)),
    ])
    const tenLoai = new Map(loai.map(l => [l.id, { ma: l.code, ten: l.name }]))
    const hs = h => ({ loaiHs: h.form_kind, lanBoSung: h.amend_no || 0, nop: h.submitted_at, tiepNhan: h.received_at, trangThai: h.state, dungHan: h.on_time, nhanCong: h.portal_status })
    // Gộp theo (kỳ, loại tờ khai): nghĩa vụ trong lịch + MỌI hồ sơ cùng kỳ cùng loại, kể cả hồ sơ chưa gắn nghĩa vụ.
    // Thực tế (DOEL 27/10/2026): lịch chỉ sinh từ Q3/2026 nhưng hồ sơ Q1, Q2 vẫn đồng bộ về — bỏ hồ sơ lẻ là báo
    // "chưa nộp" oan.
    const gop = new Map()
    const lay = (ky, idLoai) => {
      const k = `${ky}|${idLoai}`
      if (!gop.has(k)) gop.set(k, { ...(tenLoai.get(idLoai) || { ma: '?', ten: '' }), ky, han: null, trangThai: null, theoLich: false, hoSo: [] })
      return gop.get(k)
    }
    for (const n of nghiaVu) Object.assign(lay(n.period_code, n.filing_type_id), { han: n.due_date, trangThai: n.state, doiLuc: n.state_changed_at, theoLich: true })
    for (const h of hoSo) if (h.filing_type_id) lay(h.period_code, h.filing_type_id).hoSo.push(h)
    const ds = [...gop.values()].map(x => ({ ...x, hoSo: x.hoSo.sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).map(hs) }))
    return Response.json({ nghiaVu: ds.sort((a, b) => String(a.ky).localeCompare(String(b.ky)) || String(a.ma).localeCompare(String(b.ma))) })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
