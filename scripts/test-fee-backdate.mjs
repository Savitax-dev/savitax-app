// Kiểm luật "áp phí lùi về tháng cũ KHÔNG được ghi đè phí hiện tại" (lib/feeDue.js
// shouldUpdateLiveFee) — dùng ở app/api/admin/clients PATCH.
//
//   node scripts/test-fee-backdate.mjs
//
// Không đụng database: chỉ kiểm hàm thuần.
import { shouldUpdateLiveFee } from '../lib/feeDue.js'

let pass = 0, fail = 0
const t = (name, got, want) => {
  if (got === want) { pass++; console.log('  [OK]    ' + name) }
  else { fail++; console.log('  [LỖI]   ' + name + ' — mong ' + want + ', nhận ' + got) }
}

console.log('Áp phí "từ tháng X trở đi" — có cập nhật phí hiện tại không?\n')

t('Chưa có mốc phí nào -> có',
  shouldUpdateLiveFee([], 2026, 8), true)

t('Áp cho tháng SAU mốc mới nhất -> có',
  shouldUpdateLiveFee([{ year: 2026, month: 6 }, { year: 2026, month: 7 }], 2026, 9), true)

t('Áp đúng vào mốc mới nhất -> có',
  shouldUpdateLiveFee([{ year: 2026, month: 6 }, { year: 2026, month: 7 }], 2026, 7), true)

// Ca thật HOÀNG TIẾN SÀI GÒN: đã có mốc T6 và T7/2026, giờ sửa lại giai đoạn đầu năm.
t('Áp lùi về T1/2026 khi đã có mốc T6+T7 -> KHÔNG (giữ phí hiện tại 16.200.000)',
  shouldUpdateLiveFee([{ year: 2026, month: 6 }, { year: 2026, month: 7 }], 2026, 1), false)

t('Áp lùi về T6 khi mốc mới nhất là T7 -> KHÔNG',
  shouldUpdateLiveFee([{ year: 2026, month: 6 }, { year: 2026, month: 7 }], 2026, 6), false)

t('Áp lùi qua năm trước khi đã có mốc năm nay -> KHÔNG',
  shouldUpdateLiveFee([{ year: 2026, month: 3 }], 2025, 12), false)

t('Mốc nằm ở năm trước, áp cho năm nay -> có',
  shouldUpdateLiveFee([{ year: 2025, month: 12 }], 2026, 1), true)

console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi.')
process.exit(fail === 0 ? 0 : 1)
