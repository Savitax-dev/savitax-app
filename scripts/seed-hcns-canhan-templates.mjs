// Đổi tên + nạp checklist cho 2 dịch vụ cá nhân: Hồ sơ thuê tài sản và Hồ sơ quyết toán thuế TNCN.
//
//   node scripts/seed-hcns-canhan-templates.mjs --dry     -- xem trước, KHÔNG ghi
//   node scripts/seed-hcns-canhan-templates.mjs --apply   -- ghi thật
//
// Nguồn: "Copy of QUY TRÌNH HỒ SƠ.xlsx" (sheet TTS và QTT), Giám đốc gửi 2026-09-16.
//
// Chạy lại nhiều lần an toàn: khớp theo TÊN đã chuẩn hoá, việc đã có thì bỏ qua, chỉ thêm việc
// còn thiếu. KHÔNG xoá việc nào — dòng đã tích ở hồ sơ tham chiếu tới đây.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const apply = process.argv.includes('--apply')
if (!apply && !process.argv.includes('--dry')) {
  console.log('Dùng: node scripts/seed-hcns-canhan-templates.mjs --dry | --apply')
  process.exit(1)
}

const env = readFileSync('.env.local', 'utf8')
const s = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim())

// Tên hiện tại trong app -> tên mới + ghi chú thời hạn + các bước.
// Thời gian/ghi chú của từng bước gắn luôn vào tên việc: bảng công việc không có cột ghi chú, mà
// "chờ 28 ngày" hay "chờ khách xác nhận" là thứ người làm hồ sơ cần thấy ngay khi tích.
const SERVICES = [
  {
    oldName: 'THUETS',
    newName: 'Hồ sơ thuê tài sản',
    note: 'Tổng thời gian dự kiến: 5 ngày',
    tasks: [
      'Tiếp nhận hồ sơ từ khách hàng, ĐNTT, cập nhật thông tin vào file · 1 ngày',
      'Kiểm tra CCCD, MST, giấy tờ tài sản, hợp đồng thuê và chứng từ thanh toán',
      'Xác định doanh thu cho thuê và phân bổ doanh thu theo từng năm',
      'Xác định nghĩa vụ thuế GTGT, TNCN phát sinh · 1 ngày',
      'Lập tờ khai thuế mẫu 01/TTS và phụ lục nếu có nhiều hợp đồng/tài sản',
      'Gửi khách hàng kiểm tra, xác nhận thông tin · chờ khách xác nhận',
      'Nộp tờ khai thuế · sau khi khách xác nhận',
      'Chờ kết quả chấp nhận tờ khai · 3 ngày',
      'Thông báo số tiền thuế phải nộp và hướng dẫn nộp thuế · 1 ngày, ngay sau khi có kết quả',
      'Kiểm tra chứng từ nộp tiền và hoàn thiện hồ sơ lưu trữ · sau khi khách nộp thuế',
    ],
  },
  {
    oldName: 'QTTTNCN',
    newName: 'Hồ sơ quyết toán thuế TNCN',
    note: 'Tổng thời gian dự kiến: 30 ngày · thời gian cơ quan thuế xử lý hoặc hoàn thuế phụ thuộc cơ quan thuế',
    tasks: [
      'Tiếp nhận hồ sơ từ khách hàng, ĐNTT, cập nhật thông tin vào file · 1 ngày',
      'Kiểm tra MST, CCCD, chứng từ khấu trừ, nguồn thu nhập, người phụ thuộc',
      'Tổng hợp số liệu và xác định số thuế phải nộp thêm/được hoàn',
      'Lập tờ khai quyết toán thuế TNCN · 1 ngày',
      'Gửi khách kiểm tra và xác nhận thông tin · phụ thuộc khách',
      'Nộp tờ khai và hồ sơ trên hệ thống Thuế điện tử · ngay sau xác nhận',
      'Kiểm tra tình trạng tiếp nhận hồ sơ · 28 ngày',
      'Làm thủ tục xử lý khoản nộp thừa/hoàn thuế (nếu có) · nếu phát sinh',
      'Lưu hồ sơ và thông báo khách hoàn tất',
    ],
  },
]

const norm = (v) => String(v || '')
  .replace(/^\s*\d+\s*[.)]\s*/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .trim().toLowerCase()

console.log((apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi gì)') + '\n')

const { data: all, error } = await s.from('hcns_service_templates')
  .select('id, name, group_name, note, is_active').eq('is_active', true)
if (error) { console.log('LỖI đọc dịch vụ: ' + error.message); process.exit(1) }

for (const svc of SERVICES) {
  // Khớp theo tên CŨ hoặc tên MỚI để chạy lại lần hai vẫn tìm được.
  const tpl = (all || []).find(t => norm(t.name) === norm(svc.oldName) || norm(t.name) === norm(svc.newName))
  if (!tpl) { console.log('⛔ Không tìm thấy dịch vụ "' + svc.oldName + '" — bỏ qua.\n'); continue }

  const { data: cur } = await s.from('hcns_service_template_tasks')
    .select('id, name, sort_order').eq('template_id', tpl.id).eq('is_active', true)
  const have = new Set((cur || []).map(x => norm(x.name)))
  const missing = svc.tasks.filter(t => !have.has(norm(t)))

  console.log('DỊCH VỤ: "' + tpl.name + '"' + (tpl.name === svc.newName ? '' : '  ->  "' + svc.newName + '"'))
  console.log('  ghi chú: ' + (tpl.note ? '"' + tpl.note + '"  ->  ' : '') + '"' + svc.note + '"')
  console.log('  nhóm hiện tại: ' + (tpl.group_name || '(chưa phân nhóm)'))
  console.log('  công việc: đang có ' + (cur || []).length + ', thêm mới ' + missing.length)
  svc.tasks.forEach((t, i) => console.log('    ' + String(i + 1).padStart(2) + '. ' + t + (have.has(norm(t)) ? '   (đã có)' : '')))

  if (apply) {
    const { error: e1 } = await s.from('hcns_service_templates')
      .update({ name: svc.newName, note: svc.note }).eq('id', tpl.id)
    if (e1) { console.log('  LỖI đổi tên: ' + e1.message); continue }
    if (missing.length) {
      const base = (cur || []).length
      const { error: e2 } = await s.from('hcns_service_template_tasks').insert(
        missing.map((t, i) => ({
          template_id: tpl.id, name: t, sort_order: base + i + 1, is_active: true,
        })))
      if (e2) { console.log('  LỖI thêm công việc: ' + e2.message); continue }
    }
    console.log('  ✓ đã cập nhật')
  }
  console.log('')
}

if (!apply) { console.log('Xem thấy đúng thì chạy lại với --apply.'); process.exit(0) }

const { data: after } = await s.from('hcns_service_templates')
  .select('id, name, note').eq('is_active', true)
  .in('name', SERVICES.map(x => x.newName))
for (const t of after || []) {
  const { count } = await s.from('hcns_service_template_tasks')
    .select('id', { count: 'exact', head: true }).eq('template_id', t.id).eq('is_active', true)
  console.log('Hiện có: "' + t.name + '" — ' + count + ' công việc · ' + t.note)
}
