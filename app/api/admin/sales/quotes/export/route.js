import { requireSales, canEditQuote } from '@/lib/salesScope'
import { canExportPrice } from '@/lib/salesPricing'
import { buildQuoteDocx, quoteFileName } from '@/lib/salesDocx'
import { fileQuoteToDrive } from '@/lib/salesFiling'

// POST { id } — dựng file báo giá Word SVT.MB03 từ bản ghi ĐÃ LƯU (số liệu + phí chụp lúc lập, không
// tính lại theo biểu phí hiện hành), nộp vào thư mục Drive của báo giá, trả file về cho trình duyệt tải.
// Khoá khi mức phí đang chờ duyệt / bị từ chối (chốt 2026-09-11: không gửi khách giá chưa duyệt).
export async function POST(request) {
  const auth = await requireSales()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const b = await request.json().catch(() => ({}))
  const { data: q } = await admin.from('sales_quotes').select('*').eq('id', b.id).eq('is_deleted', false).maybeSingle()
  if (!q) return Response.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })
  const { data: lead } = q.lead_id ? await admin.from('sales_leads').select('id, assigned_to').eq('id', q.lead_id).maybeSingle() : { data: null }
  if (!canEditQuote(auth, q, lead) && !auth.perms.approve) {
    return Response.json({ error: 'Báo giá do người khác lập — nhờ người lập xuất file' }, { status: 403 })
  }
  if (!canExportPrice(q.price_status)) {
    return Response.json({
      error: q.price_status === 'rejected'
        ? 'Giám đốc đã từ chối mức phí đề xuất — sửa lại báo giá rồi gửi duyệt lại'
        : 'Mức phí đang chờ Giám đốc duyệt — chưa xuất file gửi khách được',
    }, { status: 400 })
  }

  const bytes = buildQuoteDocx({
    quoteNo: q.quote_no, quoteDate: q.quote_date, survey: q.survey, fees: q.fees, monthlyFinal: Number(q.monthly_final) || 0,
  })
  const drive = await fileQuoteToDrive(admin, q, 'quote', bytes)
  return Response.json({
    fileName: quoteFileName(q.quote_date, q.company_name),
    base64: Buffer.from(bytes).toString('base64'),
    drive,
  })
}
