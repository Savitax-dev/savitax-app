// BẢN DEMO (demo.savitax.vn) — công tắc + CHỐT AN TOÀN dùng chung.
//
// Bản demo chạy cùng code với app thật nhưng database Supabase RIÊNG, toàn dữ liệu giả, mỗi đêm tự làm mới.
// Mọi việc ghi đè / xoá hàng loạt của bản demo PHẢI đi qua `chacChanLaDbDemo()`: chỉ cho chạy khi bật DEMO_MODE
// VÀ địa chỉ database KHÔNG phải project thật. Thiếu một trong hai là dừng — không bao giờ được xoá nhầm production.

export const REF_THAT = 'ykorxlkgsmzskdybebzg'   // project Supabase của app.savitax.vn

// Công tắc bản demo: dải băng, tắt tính năng nối ra ngoài, khoá đổi mật khẩu tài khoản demo.
export const LA_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

// Tài khoản demo anh gửi khách (mật khẩu chung ở biến môi trường DEMO_PASSWORD, mỗi đêm đặt lại).
export const MIEN_DEMO = 'demo.savitax.vn'
export const laTaiKhoanDemo = (email) => String(email || '').toLowerCase().endsWith('@' + MIEN_DEMO)

export function chacChanLaDbDemo({ canDbUrl = false } = {}) {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  const db = String(process.env.DEMO_DB_URL || '')
  if (!LA_DEMO && process.env.DEMO_SCRIPT !== '1') throw new Error('Không phải bản demo (thiếu NEXT_PUBLIC_DEMO_MODE=1) — từ chối')
  if (!url || url.includes(REF_THAT)) throw new Error('NEXT_PUBLIC_SUPABASE_URL trỏ vào project THẬT — từ chối')
  if (canDbUrl) {
    if (!db) throw new Error('Thiếu DEMO_DB_URL')
    if (db.includes(REF_THAT)) throw new Error('DEMO_DB_URL trỏ vào database THẬT — từ chối')
    // DB và REST phải cùng một project demo
    const ref = url.replace(/^https?:\/\//, '').split('.')[0]
    if (!db.includes(ref)) throw new Error('DEMO_DB_URL và NEXT_PUBLIC_SUPABASE_URL không cùng một project — từ chối')
  }
  return true
}

// Máy chủ: staff này có phải tài khoản demo dùng chung không (chỉ có nghĩa khi đang chạy bản demo).
export async function laTaiKhoanDemoId(supabase, staffId) {
  if (!LA_DEMO) return false
  const { data } = await supabase.from('staff').select('email').eq('id', staffId).maybeSingle()
  return laTaiKhoanDemo(data?.email)
}
