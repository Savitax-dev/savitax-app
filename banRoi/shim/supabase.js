// Bản rời — thay lib/supabase. Không có đăng nhập: máy ai người nấy dùng, coi như luôn có phiên.
// Không có lệnh đọc / ghi dữ liệu nào: chỗ nào trong mã app gọi máy chủ thì đi qua apiMay.js.
const PHIEN = { user: { id: 'ban-roi', email: '' }, access_token: '' }

export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: PHIEN }, error: null }),
      getUser: async () => ({ data: { user: PHIEN.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  }
}
