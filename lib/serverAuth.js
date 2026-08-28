// Xác thực + kiểm tra quyền ở SERVER cho các API route /api/admin/** — trước đây các route này
// chỉ dựa vào việc trang React phía client tự ẩn/redirect nếu thiếu quyền, còn bản thân route
// (dùng SUPABASE_SERVICE_ROLE_KEY, bỏ qua RLS hoàn toàn) thì ai gọi thẳng cũng được, không cần
// đăng nhập. Dùng 2 hàm dưới đây ở ĐẦU mỗi hàm GET/POST/PATCH/DELETE nhạy cảm.
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSharedRoom } from './specialRooms'
import { unionRoles, unionRooms } from './roleUnion.js'

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Đọc session từ cookie (Supabase browser client lưu session vào cookie qua @supabase/ssr, tự
// gửi kèm mọi fetch same-origin) — dùng getUser() (verify với Supabase Auth server) thay vì
// getSession() (chỉ đọc JWT local, có thể giả mạo cookie mà không bị phát hiện).
//
// QUAN TRỌNG: setAll PHẢI thật sự ghi cookie mới (không phải no-op) — access token Supabase hết
// hạn sau ~1h, lúc đó getUser() tự refresh và cần ghi lại access+refresh token mới vào cookie.
// Nếu setAll bỏ qua, lần refresh đầu vẫn qua được (tính trong bộ nhớ), nhưng refresh token cũ
// trong cookie đã bị Supabase thu hồi (rotation) mà cookie không được cập nhật — mọi request sau
// đó from server sẽ luôn báo "Chưa đăng nhập" dù người dùng vẫn đang đăng nhập bình thường trên
// trình duyệt (client tự refresh + ghi cookie được, chỉ server-side bị lệch). Route Handler (khác
// Server Component) được phép gọi cookieStore.set().
export async function getCallerRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch (_) {
            // Một số ngữ cảnh (vd Server Component) không cho set cookie — bỏ qua, không throw
            // làm hỏng cả request; getUser() vẫn trả kết quả đúng cho request hiện tại.
          }
        },
      },
    }
  )
  const { data: { user }, error: getUserError } = await supabase.auth.getUser()
  if (!user) {
    const cookieNames = cookieStore.getAll().map(c => c.name)
    console.error('[serverAuth] getUser thất bại — cookies thấy được:', cookieNames, 'error:', getUserError?.message)
    return { debug: `cookies=[${cookieNames.join(',')}] err=${getUserError?.message || 'none'}` }
  }

  const admin = getServiceClient()
  const { data: staffRow } = await admin.from('staff').select('id, role, room_id, is_active').eq('id', user.id).single()
  if (!staffRow || staffRow.is_active === false) return { debug: `user=${user.id} staffRow=${JSON.stringify(staffRow)}` }

  // KIÊM NHIỆM: một nhân viên có thể thuộc nhiều phòng với nhiều vai trò (VD vừa là nhân viên kế
  // toán phòng Himalaya, vừa là trưởng phòng HCNS). staff.role/room_id vẫn là phòng và vai trò
  // CHÍNH; bảng staff_extra_roles chỉ CỘNG THÊM, không bao giờ bớt.
  //
  // Bảng chưa cài (bản clone chưa chạy sql/08_staff_extra_roles.sql) thì bỏ qua trong im lặng —
  // mọi thứ chạy y hệt như khi chưa có kiêm nhiệm.
  let extra = []
  try {
    const { data } = await admin.from('staff_extra_roles').select('room_id, role').eq('staff_id', staffRow.id)
    extra = data || []
  } catch (_) { extra = [] }

  const roles = unionRoles(staffRow.role, extra)
  const roomIds = unionRooms(staffRow.room_id, extra)

  return {
    staffId: staffRow.id,
    role: staffRow.role,      // vai trò CHÍNH — giữ nguyên cho code cũ đang so sánh trực tiếp
    roomId: staffRow.room_id, // phòng CHÍNH
    roles,                    // gồm cả vai trò kiêm nhiệm
    roomIds,                  // gồm cả phòng kiêm nhiệm
  }
}

// Kiểm tra người gọi có permKey không — trả { ok, status, error, caller }. Dùng thẳng ở đầu route:
//   const auth = await callerHasPermission('manage_staff')
//   if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
export async function callerHasPermission(permKey) {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']', caller: null }

  // Xét TẤT CẢ vai trò của người gọi (chính + kiêm nhiệm) — chỉ cần một vai trò có quyền là đủ.
  const roles = caller.roles?.length ? caller.roles : [caller.role]
  if (roles.includes('admin')) return { ok: true, caller }

  const admin = getServiceClient()
  const { data: roleRows } = await admin.from('roles').select('id, is_system').in('id', roles)
  if ((roleRows || []).some(r => r.is_system)) return { ok: true, caller }

  const { data: rp } = await admin.from('role_permissions').select('permission_key')
    .in('role_id', roles).eq('permission_key', permKey).limit(1)
  if (rp?.length) return { ok: true, caller }

  return { ok: false, status: 403, error: 'Không đủ quyền thực hiện thao tác này', caller }
}

// Chỉ cần đăng nhập hợp lệ (bất kỳ role nào) — dùng cho route mà mọi nhân viên đều được phép gọi
// (vd ghi nhận công nợ của công ty mình phụ trách), không cần permission cụ thể.
export async function requireLogin() {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']', caller: null }
  return { ok: true, caller }
}

// Bắt buộc đã đăng nhập VÀ (là admin HOẶC đúng phòng nghiệp vụ của mình) — dùng cho các route
// đọc/ghi dữ liệu theo 1 phòng cụ thể (roomId), tránh trưởng phòng/nhân viên xem được phòng khác.
// Ngoại lệ: phòng "đặc thù" (xem lib/specialRooms.js) — MỌI trưởng phòng đều vào được, không cần
// gán trưởng phòng riêng cho phòng đó. Nhân viên thường vẫn chỉ vào được đúng phòng mình.
export async function requireRoomAccess(roomId) {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']', caller: null }
  if (caller.role === 'admin') return { ok: true, caller }
  // Tính cả phòng kiêm nhiệm — người kiêm trưởng phòng HCNS phải vào được phòng HCNS.
  const rooms = caller.roomIds?.length ? caller.roomIds : [caller.roomId]
  if (rooms.includes(roomId)) return { ok: true, caller }
  const roles = caller.roles?.length ? caller.roles : [caller.role]
  if (roles.includes('leader') && isSharedRoom(roomId)) return { ok: true, caller }
  return { ok: false, status: 403, error: 'Không có quyền xem phòng này', caller }
}

// Bắt buộc role thật là 'admin' — dùng cho vài thao tác đặc biệt KHÔNG áp dụng permission thường
// (vd sửa lại trạng thái task đã ghi nhận trễ hạn thành đúng hạn) mà kể cả leader/manager có
// is_system hay permission gì cũng không được phép, khác với callerHasPermission ở trên.
export async function requireAdmin() {
  const caller = await getCallerRole()
  if (!caller.staffId) return { ok: false, status: 401, error: 'Chưa đăng nhập [' + caller.debug + ']', caller: null }
  if (caller.role !== 'admin') return { ok: false, status: 403, error: 'Chỉ quản trị viên được thực hiện thao tác này', caller }
  return { ok: true, caller }
}
