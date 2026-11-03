// Kiểm thưởng DVK phần HCNS Thời điểm (lib/luong/dvkHcns.js, sql/48 — anh chốt 03/11/2026: kỳ lương tháng N = tiền khách
// trả TRONG THÁNG N, đủ hoặc một phần, không cần đã hoàn thành).
//   node scripts/test-luong-dvk-hcns.mjs                                — chỉ quy tắc, dữ liệu giả
//   node --env-file=.env.local scripts/test-luong-dvk-hcns.mjs --that  — thêm: dữ liệu HCNS thật kỳ 10/2026 (chỉ đọc)
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
  { id: 'hs4', name: 'Cty D', case_code: 'D01', category: 'thoi_diem', assigned_to: 'nv-a' },
]
const dichVu = [
  // hs1: 2 dịch vụ; trả 9/2026 1.200.000 (thu chung) + 10/2026 1.000.000 (thu chung) → dv1 nhận trước trừ trước
  { id: 'dv1', hcns_client_id: 'hs1', template_id: 't1', cost: 1000000, status: 'hoan_thanh', received_at: '2026-09-01' },
  { id: 'dv2', hcns_client_id: 'hs1', template_id: 't2', cost: 2000000, status: 'thu_thap', received_at: '2026-09-05' },
  { id: 'dv4', hcns_client_id: 'hs2', template_id: 't1', cost: 500000, status: 'hoan_thanh', received_at: '2026-10-02' },  // chưa thu
  { id: 'dv5', hcns_client_id: 'hs3', template_id: 't1', cost: 500000, status: 'hoan_thanh', received_at: '2026-10-02' },  // thời kỳ → bỏ
  { id: 'dv6', hcns_client_id: 'hs4', template_id: 't1', cost: 900000, status: 'hoan_thanh', received_at: '2026-09-02' },  // trả hết tháng 9
]
const thu = [
  { hcns_client_id: 'hs1', case_service_id: null, amount: 1200000, paid_at: '2026-09-20' },
  { hcns_client_id: 'hs1', case_service_id: null, amount: 1000000, paid_at: '2026-10-07' },
  { hcns_client_id: 'hs3', case_service_id: 'dv5', amount: 500000, paid_at: '2026-10-03' },
  { hcns_client_id: 'hs4', case_service_id: null, amount: 900000, paid_at: '2026-09-19' },
  // khoản cũ chưa có paid_at: lấy ngày ghi giờ VN (30/09 18:00 UTC = 01/10 giờ VN)
  { hcns_client_id: 'hs2', case_service_id: 'dv4', amount: 0, created_at: '2026-09-30T18:00:00Z' },
]
const mau = [{ id: 't1', name: 'Đăng ký BHXH' }, { id: 't2', name: 'Báo tăng lao động' }]
const khai = [
  { hcns_case_service_id: 'dv2', so_tien: 300000, trang_thai: 'cho_duyet', nam: 2026, thang: 10 },
  { hcns_case_service_id: 'dv2', so_tien: 999, trang_thai: 'tra_lai', nam: 2026, thang: 10 },
  { hcns_case_service_id: 'dv2', so_tien: 777, trang_thai: 'da_duyet', nam: 2026, thang: 9 },   // kỳ khác
]

console.log('Kỳ 10/2026 (quản trị):')
const t10 = chonDichVuHcns({ hoSo, dichVu, thu, mau, khai, laQuanTri: true, nam: 2026, thang: 10 })
kiem('chỉ phần trả trong tháng 10: dv2 (hs1)', t10.map(x => x.hcns_case_service_id), ['dv2'])
kiem('dv2: tháng 9 đã trừ 200.000 → tháng 10 nhận đủ 1.000.000 (đang làm vẫn khai được)', t10[0].daThu, 1000000)
kiem('nhãn ngày trả + trạng thái', t10[0].ky, 'thu 07/10 · đang làm')
kiem('đã khai chỉ đếm cùng kỳ, bỏ dòng trả lại', t10[0].daKhai, 300000)
kiem('hồ sơ trả hết tháng 9 (hs4) không có ở kỳ 10', t10.some(x => x.hcns_case_service_id === 'dv6'), false)
kiem('hồ sơ Thời kỳ (dv5) không có', t10.some(x => x.hcns_case_service_id === 'dv5'), false)

console.log('\nKỳ 9/2026:')
const t9 = chonDichVuHcns({ hoSo, dichVu, thu, mau, laQuanTri: true, nam: 2026, thang: 9 })
kiem('kỳ 9: dv1 1.000.000 + dv2 200.000 + dv6 900.000', t9.map(x => [x.hcns_case_service_id, x.daThu]).sort(), [['dv1', 1000000], ['dv2', 200000], ['dv6', 900000]])
kiem('tổng kỳ 9 + kỳ 10 của hs1 = tổng đã thu 2.200.000', t9.filter(x => ['dv1', 'dv2'].includes(x.hcns_case_service_id)).reduce((a, x) => a + x.daThu, 0) + t10[0].daThu, 2200000)

console.log('\nPhạm vi nhân viên (kỳ 10):')
kiem('nv-a (phụ trách hs1) thấy dv2', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-a', nam: 2026, thang: 10 }).length, 1)
kiem('nv-b thấy 0', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-b', nam: 2026, thang: 10 }).length, 0)
kiem('người phòng HCNS thấy hồ sơ người khác', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-x', laPhongHcns: true, nam: 2026, thang: 10 }).length, 1)
kiem('người ngoài HCNS, không phụ trách → 0', chonDichVuHcns({ hoSo, dichVu, thu, mau, staffId: 'nv-x', nam: 2026, thang: 10 }).length, 0)

if (process.argv.includes('--that')) {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  for (const thang of [9, 10]) {
    const ds = await hoSoHcnsChonDuoc(sb, { staffId: null, roomIds: [] }, { admin: true }, { nam: 2026, thang })
    console.log('\nDữ liệu HCNS thật kỳ ' + thang + '/2026: ' + ds.length + ' dịch vụ, tổng thu ' + ds.reduce((a, x) => a + x.daThu, 0).toLocaleString('vi-VN'))
    for (const x of ds) console.log('   · ' + x.cty.slice(0, 48).padEnd(48) + ' · ' + x.ten.slice(0, 28).padEnd(28) + ' · ' + x.ky.padEnd(22) + ' · thu ' + x.daThu.toLocaleString('vi-VN') + ' / phí ' + x.phaiThu.toLocaleString('vi-VN'))
    kiem('kỳ ' + thang + ': mọi dòng thu > 0 và không vượt phí', ds.every(x => x.daThu > 0 && x.daThu <= x.phaiThu), true)
    const lan2 = await hoSoHcnsChonDuoc(sb, { staffId: null, roomIds: [] }, { admin: true }, { nam: 2026, thang })
    kiem('kỳ ' + thang + ': đọc 2 lần ra giống hệt', JSON.stringify(lan2), JSON.stringify(ds))
  }
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : '\nCÓ ' + hong + ' MỤC HỎNG.')
process.exit(hong === 0 ? 0 : 1)
