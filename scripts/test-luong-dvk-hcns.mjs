// Kiểm thưởng DVK phần HCNS Thời điểm (lib/luong/dvkHcns.js, sql/48 — anh yêu cầu 03/11/2026).
//   node scripts/test-luong-dvk-hcns.mjs                                — chỉ quy tắc, dữ liệu giả
//   node --env-file=.env.local scripts/test-luong-dvk-hcns.mjs --that  — thêm: đọc dữ liệu HCNS thật (chỉ đọc)
import { chonDichVuHcns, hoSoHcnsChonDuoc } from '../lib/luong/dvkHcns.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong)
  if (a === b) console.log('  OK   ' + ten)
  else { hong++; console.log('  HỎNG ' + ten + '\n         ra ' + a + '\n         đáng lẽ ' + b) }
}

const hoSo = [
  { id: 'hs1', name: 'Cty A', case_code: 'A01', category: 'thoi_diem', assigned_to: 'nv-a' },
  { id: 'hs2', name: 'Cty B', case_code: 'B01', category: 'thoi_diem', assigned_to: 'nv-b' },
  { id: 'hs3', name: 'Cty C (thời kỳ)', category: 'thoi_ky', assigned_to: 'nv-a' },
]
const dichVu = [
  // hs1: 2 dịch vụ, thu chung 1.500.000 → dịch vụ nhận trước (dv1) trừ trước
  { id: 'dv1', hcns_client_id: 'hs1', template_id: 't1', cost: 1000000, status: 'hoan_thanh', received_at: '2026-10-01', completed_at: '2026-10-20T03:00:00Z' },
  { id: 'dv2', hcns_client_id: 'hs1', template_id: 't2', cost: 2000000, status: 'hoan_thanh', received_at: '2026-10-05' },
  { id: 'dv3', hcns_client_id: 'hs1', template_id: 't1', cost: 800000, status: 'nop_ho_so', received_at: '2026-10-06' },   // chưa xong
  { id: 'dv4', hcns_client_id: 'hs2', template_id: 't1', cost: 500000, status: 'hoan_thanh', received_at: '2026-10-02' },  // xong, chưa thu
  { id: 'dv5', hcns_client_id: 'hs3', template_id: 't1', cost: 500000, status: 'hoan_thanh', received_at: '2026-10-02' },  // thời kỳ → bỏ
]
const thu = [
  { hcns_client_id: 'hs1', case_service_id: null, amount: 1500000 },
  { hcns_client_id: 'hs1', case_service_id: 'dv3', amount: 300000 },
  { hcns_client_id: 'hs3', case_service_id: 'dv5', amount: 500000 },
]
const mau = [{ id: 't1', name: 'Đăng ký BHXH' }, { id: 't2', name: 'Báo tăng lao động' }]
const khai = [{ hcns_case_service_id: 'dv1', so_tien: 400000, trang_thai: 'da_duyet' }, { hcns_case_service_id: 'dv1', so_tien: 999, trang_thai: 'tra_lai' }]

console.log('Quản trị thấy:')
const qt = chonDichVuHcns({ hoSo, dichVu, thu, mau, khai, laQuanTri: true })
const v1 = qt.find(x => x.hcns_case_service_id === 'dv1'), v2 = qt.find(x => x.hcns_case_service_id === 'dv2')
kiem('chỉ dịch vụ Hoàn thành + đã thu (dv1, dv2)', qt.map(x => x.hcns_case_service_id).sort(), ['dv1', 'dv2'])
kiem('dv1 thu chung trừ trước: đã thu 1.000.000', v1.daThu, 1000000)
kiem('dv2 phần thu chung còn lại 500.000 (thu một phần vẫn khai được)', v2.daThu, 500000)
kiem('mã chọn có tiền tố hcns:', v1.id, 'hcns:dv1')
kiem('đã khai bỏ dòng trả lại', v1.daKhai, 400000)
kiem('tên + công ty + ngày xong', [v1.ten, v1.cty, v1.ma, v1.ky], ['Đăng ký BHXH', 'Cty A', 'A01', 'xong 20/10/2026'])
kiem('xếp theo công ty rồi tên dịch vụ', qt.map(x => x.ten), ['Báo tăng lao động', 'Đăng ký BHXH'])
kiem('dịch vụ chưa xong (dv3) dù đã thu → không có', qt.some(x => x.hcns_case_service_id === 'dv3'), false)
kiem('xong mà chưa thu (dv4) → không có', qt.some(x => x.hcns_case_service_id === 'dv4'), false)
kiem('hồ sơ Thời kỳ (dv5) → không có', qt.some(x => x.hcns_case_service_id === 'dv5'), false)

console.log('\nPhạm vi nhân viên:')
kiem('nv-a (phụ trách hs1) thấy dv1, dv2', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-a' }).length, 2)
kiem('nv-b (phụ trách hs2, chưa thu) thấy 0', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-b' }).length, 0)
kiem('người phòng HCNS thấy cả hồ sơ người khác', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-x', laPhongHcns: true }).length, 2)
kiem('người ngoài HCNS, không phụ trách → 0', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-x' }).length, 0)

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('\nDữ liệu HCNS thật (quản trị xem):')
  const ds = await hoSoHcnsChonDuoc(sb, { staffId: null, roomIds: [] }, { admin: true })
  console.log('  ' + ds.length + ' dịch vụ đủ điều kiện khai')
  for (const x of ds.slice(0, 8)) console.log('   · ' + x.cty + ' · ' + x.ten + ' · ' + x.ky + ' · phí ' + x.phaiThu.toLocaleString('vi-VN') + ' · đã thu ' + x.daThu.toLocaleString('vi-VN'))
  kiem('mọi dòng đã thu > 0 và không vượt phí', ds.every(x => x.daThu > 0 && x.daThu <= x.phaiThu), true)
  const lan2 = await hoSoHcnsChonDuoc(sb, { staffId: null, roomIds: [] }, { admin: true })
  kiem('đọc 2 lần ra giống hệt (lật trang có sắp)', JSON.stringify(lan2), JSON.stringify(ds))
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
