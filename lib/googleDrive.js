// Nộp file lên Google Drive (Shared drive Phòng Phát triển Khách hàng) bằng TÀI KHOẢN DỊCH VỤ
// (service account) — gọi thẳng REST API v3, không kéo thư viện googleapis (rất nặng) vào bundle.
//
// Cấu hình (Vercel env + .env.local), thiếu 1 trong 3 thì driveConfigured() = false và module báo
// giá vẫn chạy bình thường, chỉ bước "Nộp Drive" báo chưa cấu hình:
//   GOOGLE_SA_EMAIL        email tài khoản dịch vụ (…@….iam.gserviceaccount.com)
//   GOOGLE_SA_PRIVATE_KEY  private_key trong file JSON khoá (giữ nguyên các \n)
//   SALES_DRIVE_FOLDER_ID  id thư mục "1. BÁO GIÁ" trong Shared drive (đoạn cuối URL thư mục)
// Tài khoản dịch vụ phải được thêm làm thành viên Shared drive với quyền "Người quản lý nội dung".
import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/drive'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
// Shared drive: thiếu 2 cờ này thì Drive trả 404 như thể thư mục không tồn tại.
const ALL = 'supportsAllDrives=true&includeItemsFromAllDrives=true'

export function driveConfigured() {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.SALES_DRIVE_FOLDER_ID)
}

let _token = null // { value, exp }

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (_token && _token.exp - 60 > now) return _token.value
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: process.env.GOOGLE_SA_EMAIL, scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  // Vercel/.env lưu khoá thành 1 dòng với "\n" dạng chữ — đổi lại thành xuống dòng thật.
  const key = String(process.env.GOOGLE_SA_PRIVATE_KEY).replace(/\\n/g, '\n')
  const signer = createSign('RSA-SHA256')
  signer.update(header + '.' + claim)
  const jwt = header + '.' + claim + '.' + b64url(signer.sign(key))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error('Không đăng nhập được Google Drive: ' + (j.error_description || j.error || r.status))
  _token = { value: j.access_token, exp: now + (Number(j.expires_in) || 3600) }
  return _token.value
}

async function api(path, init = {}) {
  const token = await accessToken()
  const r = await fetch(path, { ...init, headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('Google Drive báo lỗi: ' + (j.error?.message || r.status))
  return j
}

// Chuỗi trong câu truy vấn Drive phải thoát \ và ' — tên công ty có dấu nháy (VD "D'ART") sẽ làm
// hỏng truy vấn nếu không thoát.
const qstr = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

async function findChild(parentId, name, mimeType) {
  const q = 'name = ' + qstr(name) + ' and ' + qstr(parentId) + ' in parents and trashed = false' +
    (mimeType ? ' and mimeType = ' + qstr(mimeType) : '')
  const j = await api(API + '/files?' + ALL + '&fields=files(id,name,webViewLink)&pageSize=10&q=' + encodeURIComponent(q))
  return (j.files || [])[0] || null
}

// Tìm hoặc tạo thư mục con — gọi lại nhiều lần không sinh thư mục trùng tên.
export async function ensureFolder(name, parentId = process.env.SALES_DRIVE_FOLDER_ID) {
  const found = await findChild(parentId, name, FOLDER_MIME)
  if (found) return found
  return api(API + '/files?' + ALL + '&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
}

// Tải file lên thư mục; file cùng tên đã có thì GHI ĐÈ nội dung (giữ nguyên id + link đã gửi đi),
// không sinh "…(1).docx".
export async function uploadFile(folderId, name, mimeType, bytes) {
  const existing = await findChild(folderId, name)
  if (existing) {
    return api(UPLOAD + '/files/' + existing.id + '?uploadType=media&' + ALL + '&fields=id,name,webViewLink', {
      method: 'PATCH', headers: { 'Content-Type': mimeType }, body: Buffer.from(bytes),
    })
  }
  const boundary = 'svt' + Date.now().toString(36)
  const meta = JSON.stringify({ name, parents: [folderId] })
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n'),
    Buffer.from('--' + boundary + '\r\nContent-Type: ' + mimeType + '\r\n\r\n'),
    Buffer.from(bytes),
    Buffer.from('\r\n--' + boundary + '--'),
  ])
  return api(UPLOAD + '/files?uploadType=multipart&' + ALL + '&fields=id,name,webViewLink', {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body,
  })
}

// Chuyển file/thư mục vào thùng rác (Shared drive tự xoá hẳn sau 30 ngày). Không xoá cứng: quyền
// "Người quản lý nội dung" của tài khoản dịch vụ chỉ được bỏ vào thùng rác, và lỡ tay còn khôi phục được.
export async function trashFile(fileId) {
  return api(API + '/files/' + fileId + '?' + ALL + '&fields=id,trashed', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  })
}

export const DOCX_MIME ='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
