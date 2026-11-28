// Báo cáo tình hình kinh doanh gửi khách (tab "📊 Báo cáo KH" trên thẻ công ty) — sql/64, lib/baoCaoKh.js.
//
// GET  ?clientId=&ky=Q4.2026  → { bao, truoc, han: { gtgt, tndn }, ds }
//        bao   : số liệu đã lưu của kỳ (null nếu chưa lập)
//        truoc : số liệu kỳ trước (để gợi ý thuế GTGT đầu kỳ)
//        han   : hạn nộp lấy từ lịch Tờ khai (tax_obligations), không có thì tự tính theo luật + ngày nghỉ
//        ds    : các kỳ công ty đã lập
// POST multipart: clientId, ky, soLieu (JSON), ghiChu (JSON), anh (PNG, tùy chọn) → lưu số liệu; có ảnh thì
//        tải vào bucket client-files (tab Tài liệu của công ty).
//
// Phạm vi như thông tin đăng nhập / Soát xét: nhân viên phụ trách chính/phụ, trưởng phòng của phòng đó, quản trị.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { hanNop, kyQuyetToanNam } from '@/lib/taxDeadline'
import { kyHopLe, phanTichKy, kyTruoc, khoangKy, chuanHoa, tenFileAnh } from '@/lib/baoCaoKh'

const BUCKET = 'client-files'
const getAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const toBase64Url = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const loiBang = e => /bao_cao_khach/.test(e?.message || '') && /(does not exist|schema cache)/i.test(e?.message || '')
const CHUA_SQL = 'Chưa có bảng bao_cao_khach — cần chạy sql/64_bao_cao_khach.sql trên Supabase'

async function hanNopCuaKy(supabase, clientId, ky) {
  const p = phanTichKy(ky)
  const han = { gtgt: null, tndn: null }
  const { data: le } = await supabase.from('tax_holidays').select('day')
  const ngayLe = new Set((le || []).map(x => String(x.day).slice(0, 10)))
  const { data: loai } = await supabase.from('tax_filing_types').select('id, code')
  const idCua = ma => (loai || []).filter(l => ma.includes(l.code)).map(l => l.id)
  const tim = async (maKy, maLoai) => {
    const ids = idCua(maLoai)
    if (!ids.length) return null
    const { data } = await supabase.from('tax_obligations').select('due_date')
      .eq('client_id', clientId).eq('period_code', maKy).in('filing_type_id', ids).order('due_date').limit(1)
    return data?.[0]?.due_date ? String(data[0].due_date).slice(0, 10) : null
  }
  if (p.kieu === 'NAM') {
    han.tndn = (await tim(ky, ['03/TNDN'])) || hanNop('settlement', kyQuyetToanNam(p.nam).period_end, ngayLe)
  } else {
    han.gtgt = (await tim(ky, ['01/GTGT', '01/CNKD'])) || hanNop(p.kieu === 'T' ? 'month' : 'quarter', khoangKy(ky).den, ngayLe)
  }
  return han
}

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId') || ''
  const ky = searchParams.get('ky') || ''
  if (!clientId || !kyHopLe(ky)) return Response.json({ error: 'Thiếu công ty hoặc kỳ không hợp lệ' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId)))
    return Response.json({ error: 'Công ty ngoài phạm vi của anh/chị' }, { status: 403 })

  const [baoR, truocR, dsR] = await Promise.all([
    supabase.from('bao_cao_khach').select('ky, so_lieu, ghi_chu, file_path, updated_at').eq('client_id', clientId).eq('ky', ky).maybeSingle(),
    supabase.from('bao_cao_khach').select('so_lieu').eq('client_id', clientId).eq('ky', kyTruoc(ky)).maybeSingle(),
    supabase.from('bao_cao_khach').select('ky, updated_at').eq('client_id', clientId).order('updated_at', { ascending: false }).order('id').limit(60),
  ])
  for (const r of [baoR, truocR, dsR]) {
    if (r.error) return Response.json({ error: loiBang(r.error) ? CHUA_SQL : r.error.message }, { status: 500 })
  }
  let han = { gtgt: null, tndn: null }
  try { han = await hanNopCuaKy(supabase, clientId, ky) } catch (_) { /* thiếu bảng Tờ khai thì để trống */ }
  return Response.json({ bao: baoR.data || null, truoc: truocR.data?.so_lieu || null, han, ds: dsR.data || [] })
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const form = await request.formData()
  const clientId = String(form.get('clientId') || '')
  const ky = String(form.get('ky') || '')
  if (!clientId || !kyHopLe(ky)) return Response.json({ error: 'Thiếu công ty hoặc kỳ không hợp lệ' }, { status: 400 })

  const supabase = getAdmin()
  if (!(await canAccessCredentials(supabase, auth.caller, clientId)))
    return Response.json({ error: 'Công ty ngoài phạm vi của anh/chị' }, { status: 403 })

  let soLieu, ghiChu = {}
  try {
    soLieu = chuanHoa(JSON.parse(String(form.get('soLieu') || '{}')))
    const g = JSON.parse(String(form.get('ghiChu') || '{}'))
    for (const [k, v] of Object.entries(g || {})) if (typeof v === 'string' && v.trim()) ghiChu[k] = v.trim().slice(0, 300)
  } catch (_) { return Response.json({ error: 'Số liệu gửi lên không đọc được' }, { status: 400 }) }

  const { data: cty } = await supabase.from('clients').select('client_code, tax_code').eq('id', clientId).maybeSingle()
  if (!cty) return Response.json({ error: 'Không thấy công ty' }, { status: 404 })

  // Ảnh (tùy chọn) → Tài liệu của công ty. Tải ảnh TRƯỚC, lỗi thì không ghi gì.
  let filePath = null
  const anh = form.get('anh')
  if (anh && typeof anh === 'object' && anh.size) {
    if (anh.size > 8 * 1024 * 1024) return Response.json({ error: 'Ảnh quá lớn (> 8 MB)' }, { status: 400 })
    const ten = tenFileAnh(ky, cty.client_code || cty.tax_code)
    filePath = clientId + '/' + Date.now() + '.' + toBase64Url(ten)
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, Buffer.from(await anh.arrayBuffer()), { contentType: 'image/png', upsert: false })
    if (error) return Response.json({ error: 'Không lưu được ảnh: ' + error.message }, { status: 500 })
  }

  const luc = new Date().toISOString()
  const { data: cu, error: e1 } = await supabase.from('bao_cao_khach').select('id').eq('client_id', clientId).eq('ky', ky).maybeSingle()
  if (e1) return Response.json({ error: loiBang(e1) ? CHUA_SQL : e1.message }, { status: 500 })
  const dong = { so_lieu: soLieu, ghi_chu: ghiChu, updated_by: auth.caller.staffId || null, updated_at: luc, ...(filePath ? { file_path: filePath } : {}) }
  const { error: e2 } = cu
    ? await supabase.from('bao_cao_khach').update(dong).eq('id', cu.id)
    : await supabase.from('bao_cao_khach').insert({ client_id: clientId, ky, created_by: auth.caller.staffId || null, ...dong })
  if (e2) {
    if (filePath) await supabase.storage.from(BUCKET).remove([filePath])
    return Response.json({ error: loiBang(e2) ? CHUA_SQL : e2.message }, { status: 500 })
  }
  return Response.json({ ok: true, filePath, updatedAt: luc })
}
