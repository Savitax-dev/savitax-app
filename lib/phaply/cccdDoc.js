// Phân hệ Pháp lý — đọc ảnh CCCD bằng Claude (CHỈ chạy ở máy chủ). Anh chốt 31/10/2026: dùng Claude, khoá ANTHROPIC_API_KEY
// riêng của app (khoá bản thử đã lộ — KHÔNG dùng lại). Không ghi ảnh / kết quả đọc vào log máy chủ.
import Anthropic from '@anthropic-ai/sdk'
import { KHUON_DOC, LOI_NHAC } from './cccd.js'

export const coKhoaDoc = () => !!process.env.ANTHROPIC_API_KEY

// anh: [{ mat: 'truoc'|'sau', mime, base64 }] → kết quả theo KHUON_DOC. Ném Error có message tiếng Việt khi không đọc được.
export async function docAnhCccd(anh) {
  const client = new Anthropic()
  const content = []
  for (const a of anh) {
    content.push({ type: 'text', text: a.mat === 'truoc' ? 'Ảnh MẶT TRƯỚC:' : 'Ảnh MẶT SAU:' })
    content.push({ type: 'image', source: { type: 'base64', media_type: a.mime, data: a.base64 } })
  }
  content.push({ type: 'text', text: LOI_NHAC })
  let res
  try {
    res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // bị bộ lọc an toàn từ chối thì máy chủ Anthropic tự chạy lại trên model dự phòng
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: KHUON_DOC } },
      messages: [{ role: 'user', content }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Khoá đọc CCCD (ANTHROPIC_API_KEY) không hợp lệ — báo quản trị')
    if (e instanceof Anthropic.RateLimitError) throw new Error('Dịch vụ đọc CCCD đang quá tải — thử lại sau 1 phút')
    if (e instanceof Anthropic.BadRequestError) throw new Error('Ảnh không đọc được (sai định dạng hoặc quá lớn)')
    if (e instanceof Anthropic.APIError) throw new Error(`Dịch vụ đọc CCCD lỗi ${e.status ?? ''} — thử lại`)
    throw new Error('Không kết nối được dịch vụ đọc CCCD — thử lại')
  }
  if (res.stop_reason === 'refusal') throw new Error('Dịch vụ đọc từ chối ảnh này — nhập tay')
  if (res.stop_reason === 'max_tokens') throw new Error('Đọc CCCD bị ngắt giữa chừng — thử lại')
  const text = res.content.find(b => b.type === 'text')?.text
  try { return JSON.parse(text) } catch { throw new Error('Kết quả đọc CCCD không đúng khuôn — thử lại') }
}
