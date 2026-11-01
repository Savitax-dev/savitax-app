// Ảnh minh hoạ trong tài liệu nội bộ (docs/img) cho các trang tài liệu (components/TrangTaiLieu.js).
// BẮT ĐĂNG NHẬP: ảnh chụp màn hình app có tên công ty khách thật — không để ở public/.
// Chỉ nhận tên file đơn giản (chữ thường, số, gạch ngang, .png/.jpg) để không đọc được file nào ngoài docs/img.
import fs from 'fs'
import path from 'path'
import { requireLogin } from '@/lib/serverAuth'

const LOAI = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

export async function GET(request, { params }) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { ten } = await params
  const m = String(ten || '').match(/^[a-z0-9-]+\.(png|jpe?g)$/)
  if (!m) return Response.json({ error: 'Tên file không hợp lệ' }, { status: 400 })
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'docs', 'img', ten))
    return new Response(buf, { headers: { 'Content-Type': LOAI[m[1]], 'Cache-Control': 'private, max-age=3600' } })
  } catch {
    return Response.json({ error: 'Không có ảnh' }, { status: 404 })
  }
}
