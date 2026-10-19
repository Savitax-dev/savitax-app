// Dọn dữ liệu Tiền lương của MỘT tài khoản thử (lương, chấm công, nhật ký sửa công, khai thưởng DVK).
// Mặc định chỉ XEM sẽ xoá gì; thêm --apply mới xoá.
//   node --env-file=.env.local scripts/don-luong-tai-khoan-test.mjs <email>
//   node --env-file=.env.local scripts/don-luong-tai-khoan-test.mjs <email> --apply
// Không đụng bảng cấp bậc, ngày lễ, hay dữ liệu của nhân viên khác.
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
const apply = process.argv.includes('--apply')
if (!email || !email.includes('@')) { console.log('Thiếu email tài khoản thử'); process.exit(1) }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: st } = await sb.from('staff').select('id, full_name, email').eq('email', email)
if (!st || st.length !== 1) { console.log('Phải khớp đúng 1 nhân viên, đang khớp', st?.length || 0); process.exit(1) }
const nv = st[0]
console.log('Tài khoản:', nv.full_name, '<' + nv.email + '>')

const [luong, cong, logTheoNv, logDoNvSua] = await Promise.all([
  sb.from('luong_nhan_vien').select('id, ap_dung_tu, cap_bac, luong_co_ban').eq('staff_id', nv.id),
  sb.from('luong_cham_cong').select('id, nam, thang, trang_thai').eq('staff_id', nv.id),
  sb.from('luong_cham_cong_log').select('id, hanh_dong').eq('staff_id', nv.id),
  sb.from('luong_cham_cong_log').select('id, hanh_dong, staff_id').eq('boi', nv.id).neq('staff_id', nv.id),
])
const dvk = await sb.from('luong_dvk_khai').select('id, ten_dv, trang_thai').eq('staff_id', nv.id)
console.log('  lương:', luong.data.length, JSON.stringify(luong.data.map(x => x.ap_dung_tu + ' ' + x.cap_bac + ' ' + x.luong_co_ban)))
console.log('  chấm công:', cong.data.length, JSON.stringify(cong.data.map(x => x.thang + '/' + x.nam + ' ' + x.trang_thai)))
console.log('  nhật ký công của tài khoản này:', logTheoNv.data.length)
console.log('  khai thưởng DVK:', dvk.error ? '(chưa có bảng sql/32)' : dvk.data.length + ' ' + JSON.stringify(dvk.data.map(x => x.ten_dv + ' · ' + x.trang_thai)))
if (logDoNvSua.data.length) console.log('  ⚠ tài khoản này từng sửa công của', logDoNvSua.data.length, 'người khác — KHÔNG xoá các dòng đó')

if (!apply) { console.log('\nChỉ xem. Thêm --apply để xoá.'); process.exit(0) }
const xoa = async (bang, cot) => {
  const { error, count } = await sb.from(bang).delete({ count: 'exact' }).eq(cot, nv.id)
  console.log('  xoá', bang, error ? 'LỖI ' + error.message : count + ' dòng')
}
await xoa('luong_cham_cong_log', 'staff_id')
await xoa('luong_cham_cong', 'staff_id')
await xoa('luong_nhan_vien', 'staff_id')
if (!dvk.error) await xoa('luong_dvk_khai', 'staff_id')
