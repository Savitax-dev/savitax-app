// Nộp hồ sơ báo giá vào Drive: mỗi báo giá một thư mục DD-MM-YY_Tên công ty trong "1. BÁO GIÁ",
// bên trong có phiếu khảo sát gốc + file báo giá Word (tài liệu bàn giao mục 9).
// Lỗi Drive KHÔNG làm hỏng việc lưu báo giá — trả về chuỗi cảnh báo để giao diện hiện cho nhân viên.
import { driveConfigured, ensureFolder, uploadFile, DOCX_MIME } from './googleDrive.js'
import { folderName, quoteFileName, surveyFileName, buildQuoteDocx } from './salesDocx.js'
import { canExportPrice } from './salesPricing.js'

// Nộp khi LƯU: phiếu khảo sát (nếu vừa tải lên) + file báo giá Word (nếu mức phí được phép gửi khách).
// Chạy tuần tự để lần nộp đầu tạo thư mục, lần sau dùng lại — chạy song song sẽ sinh 2 thư mục trùng tên.
// Trả { filed: ['phiếu khảo sát', 'báo giá'], folderUrl, warning }.
export async function fileOnSave(admin, quote, surveyBytes) {
  const out = { filed: [], folderUrl: quote.drive_folder_url || null, warning: null }
  if (!driveConfigured()) {
    out.warning = 'Chưa cấu hình Google Drive — file chưa được nộp vào thư mục chung.'
    return out
  }
  let q = quote
  if (surveyBytes) {
    const r = await fileQuoteToDrive(admin, q, 'survey', surveyBytes)
    if (!r.ok) { out.warning = r.warning; return out }
    out.filed.push('phiếu khảo sát'); out.folderUrl = r.folderUrl
    q = { ...q, drive_folder_id: r.folderId, drive_folder_url: r.folderUrl }
  }
  if (canExportPrice(q.price_status)) {
    const bytes = buildQuoteDocx({
      quoteNo: q.quote_no, quoteDate: q.quote_date, survey: q.survey, fees: q.fees, monthlyFinal: Number(q.monthly_final) || 0,
    })
    const r = await fileQuoteToDrive(admin, q, 'quote', bytes)
    if (!r.ok) { out.warning = r.warning; return out }
    out.filed.push('báo giá'); out.folderUrl = r.folderUrl
  }
  return out
}

// kind: 'survey' | 'quote'. Trả { ok, folderId, folderUrl, fileUrl } hoặc { ok:false, warning }.
export async function fileQuoteToDrive(admin, quote, kind, bytes) {
  if (!driveConfigured()) return { ok: false, warning: 'Chưa cấu hình Google Drive — file chưa được nộp vào thư mục chung.' }
  try {
    const company = quote.company_name || quote.survey?.company
    let folderId = quote.drive_folder_id, folderUrl = quote.drive_folder_url
    if (!folderId) {
      const f = await ensureFolder(folderName(quote.quote_date, company))
      folderId = f.id; folderUrl = f.webViewLink || ('https://drive.google.com/drive/folders/' + f.id)
    }
    const name = kind === 'survey' ? surveyFileName(quote.quote_date, company) : quoteFileName(quote.quote_date, company)
    const file = await uploadFile(folderId, name, DOCX_MIME, bytes)
    const patch = { drive_folder_id: folderId, drive_folder_url: folderUrl }
    if (kind === 'survey') patch.drive_survey_file_id = file.id
    else patch.drive_quote_file_id = file.id
    await admin.from('sales_quotes').update(patch).eq('id', quote.id)
    return { ok: true, folderId, folderUrl, fileUrl: file.webViewLink || null }
  } catch (e) {
    return { ok: false, warning: 'Chưa nộp được lên Drive: ' + (e.message || 'lỗi không xác định') }
  }
}
