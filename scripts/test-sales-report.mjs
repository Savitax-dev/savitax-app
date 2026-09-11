// Kiểm cách đếm Báo cáo Phòng Kinh doanh (lib/salesReport.js) bằng dữ liệu giả — không đụng database.
//
//   node scripts/test-sales-report.mjs
import { buildSalesReport, leadProgress } from '../lib/salesReport.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + ' — mong ' + w + ', nhận ' + g) }
}

const Q = (contract_status, monthly_final) => ({ contract_status, monthly_final })
const leads = [
  { id: 1, created_at: '2026-09-02', channel_id: 'fb', assigned_to: 'an', stage: 'chot', quotes: [Q('signed', 5000000), Q('draft', 6000000)] },
  { id: 2, created_at: '2026-09-03', channel_id: 'fb', assigned_to: 'an', stage: 'gui_hd', quotes: [Q('sent', 3000000)], next_follow_up: '2026-09-01' },
  { id: 3, created_at: '2026-09-05', channel_id: 'zalo', assigned_to: 'binh', stage: 'that_bai', lost_reason: 'Giá cao ', quotes: [Q('draft', 2000000)] },
  { id: 4, created_at: '2026-09-06', channel_id: 'zalo', assigned_to: null, stage: 'moi', quotes: [] },
  { id: 5, created_at: '2026-09-07', channel_id: null, assigned_to: 'binh', stage: 'that_bai', lost_reason: 'giá cao', quotes: [] },
  { id: 6, created_at: '2026-08-20', channel_id: 'fb', assigned_to: 'binh', stage: 'tu_van', quotes: [], next_follow_up: '2026-09-12' },
]
const rep = buildSalesReport({
  leads,
  channels: [{ id: 'fb', name: 'Facebook' }, { id: 'zalo', name: 'Zalo' }],
  staffNames: new Map([['an', 'An'], ['binh', 'Bình']]),
  inKy: iso => iso.slice(0, 7) === '2026-09',
  dateOf: x => x,
  today: '2026-09-11',
})

t('khách chốt tính lũy kế là đã báo giá + đã gửi', leadProgress(leads[0]), { quoted: true, sent: true, signed: true, signedFee: 5000000, quotedFee: 5000000 })
t('lứa T9: 5 khách (khách T8 không tính)', rep.total.leads, 5)
t('đã báo giá 3 · đã gửi 2 · chốt 1', [rep.total.quoted, rep.total.sent, rep.total.signed], [3, 2, 1])
t('phí chốt chỉ cộng báo giá đã chốt', rep.total.signedFee, 5000000)
t('tỷ lệ chuyển đổi 1/5 = 20%, chốt/gửi = 50%', [rep.total.convRate, rep.total.closeRate], [20, 50])
t('kênh: Facebook 2 khách đứng đầu, có dòng "Chưa rõ kênh"',
  rep.channelRows.map(r => [r.name, r.leads]), [['Facebook', 2], ['Zalo', 2], ['Chưa rõ kênh', 1]])
t('lý do không thành gộp không phân biệt hoa/thường, khoảng trắng', rep.lostReasons, [{ reason: 'Giá cao', count: 2 }])
const an = rep.staffRows.find(r => r.id === 'an'), binh = rep.staffRows.find(r => r.id === 'binh')
t('An: 2 khách mới, chốt 1, đang chăm sóc 1, quá hẹn 1', [an.leads, an.signed, an.open, an.overdue], [2, 1, 1, 1])
t('Bình: việc tồn tính cả khách T8 (không theo kỳ), chưa quá hẹn', [binh.leads, binh.open, binh.overdue], [2, 1, 0])
t('có dòng "Chưa ai nhận"', rep.staffRows.some(r => r.id === 'none' && r.name === 'Chưa ai nhận'), true)

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi')
process.exit(fail ? 1 : 0)
