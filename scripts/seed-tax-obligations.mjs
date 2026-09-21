// Sinh lịch hạn nộp (tax_obligations) cho các công ty đang phục vụ.
//
// Mặc định CHỈ XEM TRƯỚC. Ghi thật thì thêm --apply.
//   node --env-file=.env.local scripts/seed-tax-obligations.mjs --nam 2026
//   node --env-file=.env.local scripts/seed-tax-obligations.mjs --nam 2026 --apply
//
// Kỳ khai lấy theo clients.report_type (quarterly / monthly) — không cần khai báo riêng cho
// từng công ty. Công ty nào có quy ước khác thì ghi đè ở bảng tax_client_filings (làm sau).
//
// Chạy lại nhiều lần vẫn an toàn: đã có (client, loại tờ khai, kỳ) thì bỏ qua, KHÔNG đụng tới
// trạng thái của dòng đã có — tránh xóa mất kết quả đồng bộ hoặc dấu "Không phát sinh".
import { createClient } from '@supabase/supabase-js'
import { cacKyTrongNam, kyQuyetToanNam, hanNop, nhanKy } from '../lib/taxDeadline.js'

const APPLY = process.argv.includes('--apply')
const iNam = process.argv.indexOf('--nam')
const NAM = iNam > 0 && process.argv[iNam + 1] ? +process.argv[iNam + 1] : new Date().getUTCFullYear()

// Mặc định CHỈ sinh các kỳ CHƯA TỚI HẠN. Sinh cả kỳ đã qua thì app hiện "Quá hạn" đỏ rực cho
// gần như mọi công ty, trong khi kế toán đã nộp đủ — app chỉ biết điều đó sau khi đồng bộ với
// cổng (GĐ 3). Báo động giả hàng loạt còn tệ hơn là chưa có dữ liệu.
// Cần dựng lại lịch sử (sau khi đồng bộ được) thì thêm --ca-qua-khu.
const CA_QUA_KHU = process.argv.includes('--ca-qua-khu')
const HOM_NAY = new Date().toISOString().slice(0, 10)

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// PostgREST trả tối đa 1000 dòng mỗi lần — phải phân trang, nếu không là âm thầm cụt dữ liệu.
async function docHet(bang, cot, loc = q => q) {
  let ra = [], tu = 0
  for (;;) {
    const { data, error } = await loc(s.from(bang).select(cot)).range(tu, tu + 999)
    if (error) throw new Error(`${bang}: ${error.message}`)
    ra = ra.concat(data)
    if (data.length < 1000) return ra
    tu += 1000
  }
}

const loaiTK = await docHet('tax_filing_types', 'id, code, name, tax_kind, period_kind, is_active')
const dangDung = loaiTK.filter(t => t.is_active)
if (!dangDung.length) {
  console.error('Chưa có danh mục tờ khai — chạy sql/16_tokhai_seed.sql trước.')
  process.exit(1)
}

const ngayLe = new Set((await docHet('tax_holidays', 'day')).map(h => h.day))
console.log(`Ngày lễ đang có: ${ngayLe.size} ngày`)

const clients = await docHet('clients', 'id, name, client_code, report_type, is_active, status, contract_start')
const dangPhucVu = clients.filter(c => c.is_active !== false && c.status !== 'inactive')
console.log(`Công ty đang phục vụ: ${dangPhucVu.length}`)

// Tờ khai định kỳ (GTGT, TNCN khấu trừ) đi theo kỳ khai của công ty; quyết toán năm đi theo năm.
const dinhKy = dangDung.filter(t => ['month', 'quarter'].includes(t.period_kind))
const quyetToan = dangDung.filter(t => t.period_kind === 'settlement')
console.log(`Tờ khai định kỳ: ${dinhKy.map(t => t.code).join(', ')}`)
console.log(`Quyết toán năm : ${quyetToan.map(t => t.code).join(', ')}`)

const daCo = new Set(
  (await docHet('tax_obligations', 'client_id, filing_type_id, period_code'))
    .map(o => `${o.client_id}|${o.filing_type_id}|${o.period_code}`)
)

const canThem = []
for (const c of dangPhucVu) {
  const kieu = c.report_type === 'monthly' ? 'monthly' : 'quarterly'
  const ky = cacKyTrongNam(kieu, NAM)

  for (const t of dinhKy) {
    for (const k of ky) {
      // Công ty ký hợp đồng giữa năm thì không sinh nghĩa vụ cho các kỳ TRƯỚC khi ký — nếu không
      // app sẽ báo quá hạn hàng loạt cho những kỳ Savitax chưa hề nhận làm.
      if (c.contract_start && k.period_end < c.contract_start) continue
      const khoa = `${c.id}|${t.id}|${k.period_code}`
      if (daCo.has(khoa)) continue
      const han = hanNop(k.period_kind, k.period_end, ngayLe)
      if (!CA_QUA_KHU && han <= HOM_NAY) continue
      canThem.push({
        client_id: c.id, filing_type_id: t.id,
        period_code: k.period_code, period_start: k.period_start, period_end: k.period_end,
        due_date: han,
        state: 'not_filed',
      })
    }
  }

  const kyNam = kyQuyetToanNam(NAM)
  for (const t of quyetToan) {
    if (c.contract_start && kyNam.period_end < c.contract_start) continue
    const khoa = `${c.id}|${t.id}|${kyNam.period_code}`
    if (daCo.has(khoa)) continue
    const han = hanNop(kyNam.period_kind, kyNam.period_end, ngayLe)
    if (!CA_QUA_KHU && han <= HOM_NAY) continue
    canThem.push({
      client_id: c.id, filing_type_id: t.id,
      period_code: kyNam.period_code, period_start: kyNam.period_start, period_end: kyNam.period_end,
      due_date: han,
      state: 'not_filed',
    })
  }
}

console.log('')
console.log(CA_QUA_KHU
  ? 'Chế độ: sinh CẢ những kỳ đã qua hạn'
  : `Chế độ: chỉ sinh kỳ có hạn SAU ngày ${HOM_NAY}`)
console.log(`Nghĩa vụ đã có sẵn : ${daCo.size}`)
console.log(`Nghĩa vụ sẽ thêm   : ${canThem.length}`)

// Xem thử lịch hạn nộp của một công ty để mắt người soát lại cho chắc.
const mau = dangPhucVu.find(c => c.report_type !== 'monthly') || dangPhucVu[0]
if (mau) {
  console.log(`\nVí dụ — ${mau.client_code || mau.name} (khai ${mau.report_type === 'monthly' ? 'tháng' : 'quý'}):`)
  const ten = new Map(dangDung.map(t => [t.id, t.code]))
  for (const o of canThem.filter(o => o.client_id === mau.id)) {
    console.log(`  ${ten.get(o.filing_type_id).padEnd(12)} ${nhanKy(o.period_code).padEnd(14)} hạn ${o.due_date}`)
  }
}

if (!canThem.length) { console.log('\nKhông có gì để thêm.'); process.exit(0) }

if (!APPLY) {
  console.log('\n(chỉ xem trước — chưa ghi gì)')
  console.log(`Ghi thật:  node --env-file=.env.local scripts/seed-tax-obligations.mjs --nam ${NAM} --apply`)
  process.exit(0)
}

console.log('\nĐang ghi…')
let ghi = 0
for (let i = 0; i < canThem.length; i += 500) {
  const lo = canThem.slice(i, i + 500)
  const { error } = await s.from('tax_obligations').insert(lo)
  if (error) { console.error('  Lỗi:', error.message); process.exit(1) }
  ghi += lo.length
  console.log(`  đã ghi ${ghi}/${canThem.length}`)
}
console.log(`\nXong: thêm ${ghi} nghĩa vụ cho năm ${NAM}.`)
