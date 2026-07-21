import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'

const BUCKET = 'client-files'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Supabase Storage chỉ chấp nhận key thuần ASCII an toàn — kể cả khi percent-encode,
// SDK tự decode lại trước khi validate nên tên có dấu/tiếng Việt/khoảng trắng vẫn bị
// từ chối ("Invalid key"). Dùng base64url (chỉ gồm A-Z a-z 0-9 - _) để luôn an toàn,
// vẫn khôi phục được tên gốc khi hiển thị.
function toBase64Url(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  try { return Buffer.from(b64 + pad, 'base64').toString('utf8') } catch (_) { return str }
}

// Tên file lưu dạng: {clientId}/{timestamp}.{tenGocBase64Url}
function decodeOriginalName(storedName) {
  const idx = storedName.indexOf('.')
  if (idx === -1) return storedName
  return fromBase64Url(storedName.slice(idx + 1))
}

// GET /api/admin/client-files?clientId=xxx — list files with signed download URLs
export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = getAdmin()
  const { data: files, error } = await supabase.storage.from(BUCKET).list(clientId, {
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const items = []
  for (const f of (files || [])) {
    if (!f.name) continue
    const path = clientId + '/' + f.name
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
    items.push({
      path,
      name: decodeOriginalName(f.name),
      size: f.metadata?.size || 0,
      createdAt: f.created_at,
      url: signed?.signedUrl || null,
    })
  }
  return Response.json({ files: items })
}

// POST /api/admin/client-files — upload (multipart/form-data: file, clientId)
export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const form = await request.formData()
  const file = form.get('file')
  const clientId = form.get('clientId')
  if (!file || !clientId) return Response.json({ error: 'Thiếu file hoặc clientId' }, { status: 400 })

  const supabase = getAdmin()
  const safeName = Date.now() + '.' + toBase64Url(file.name)
  const path = clientId + '/' + safeName

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true, path })
}

// DELETE /api/admin/client-files?path=xxx
export async function DELETE(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return Response.json({ error: 'Missing path' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
