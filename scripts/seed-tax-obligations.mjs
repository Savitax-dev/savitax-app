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
import { nhanKy } from '../lib/taxDeadline.js'
// Luật sinh lịch dùng CHUNG với nút "Lưu kỳ khai" trong app (19/10/2026). Đừng viết lại luật ở
// đây — viết riêng là năm sau chạy script, nó lại sinh TNCN theo tháng cho công ty đã đổi sang quý.
import { nghiaVuDinhKy, nghiaVuQuyetToan } from '../lib/tokhaiLich.js'

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

const clients = await docHet('clients', 'id, name, client_code, report_type, is_active, status, contract_start, is_hkd')
const conPhucVu = clients.filter(c => c.is_active !== false && c.status !== 'inactive')

// HỘ KINH DOANH KHÔNG nộp danh mục tờ khai của doanh nghiệp (01/GTGT, 05/KK-TNCN, 03/TNDN,
// 05/QTT-TNCN, BCTC) — họ nộp 01/CNKD theo TT40/2021. Sinh cho họ là đẻ ra việc không có thật, tới
// hạn là màn hình báo "Quá hạn" đỏ cho cả nhóm. Bỏ qua tới khi có danh mục tờ khai riêng.
// Dọn nhóm đã lỡ sinh: scripts/soat-hkd.mjs
const hkd = conPhucVu.filter(c => c.is_hkd)
const dangPhucVu = conPhucVu.filter(c => !c.is_hkd)
console.log(`Công ty đang phục vụ: ${conPhucVu.length}`)
console.log(`  bỏ qua hộ kinh doanh: ${hkd.length} (chưa có danh mục tờ khai riêng)`)
console.log(`  sẽ sinh lịch cho     : ${dangPhucVu.length}`)

// Tờ khai định kỳ (GTGT, TNCN khấu trừ) đi theo kỳ khai của công ty; quyết toán năm đi theo năm.
const dinhKy = dangDung.filter(t => ['month', 'quarter'].includes(t.period_kind))
const quyetToan = dangDung.filter(t => t.period_kind === 'settlement')
console.log(`Tờ khai định kỳ: ${dinhKy.map(t => t.code).join(', ')}`)
console.log(`Quyết toán năm : ${quyetToan.map(t => t.code).join(', ')}`)

const daCo = new Set(
  (await docHet('tax_obligations', 'client_id, filing_type_id, period_code'))
    .map(o => `${o.client_id}|${o.filing_type_id}|${o.period_code}`)
)

// Kỳ khai ghi đè từng công ty (tax_client_filings) — vd kê GTGT theo tháng nhưng TNCN theo quý.
const ghiDeTatCa = await docHet('tax_client_filings', 'client_id, filing_type_id, period_kind, effective_from')
console.log(`Kỳ khai ghi đè   : ${ghiDeTatCa.length} dòng`)

const canThem = []
for (const c of dangPhucVu) {
  // Tờ khai định kỳ: kỳ khai lấy theo ghi đè nếu có, không có thì theo report_type. Hợp đồng ký
  // giữa năm thì không sinh cho các kỳ TRƯỚC khi ký — đều đã nằm trong lib/tokhaiLich.js.
  for (const t of dinhKy) {
    const ghiDe = ghiDeTatCa.filter(g => g.client_id === c.id && g.filing_type_id === t.id)
    for (const o of nghiaVuDinhKy({ client: c, loai: t, nam: NAM, ngayLe, ghiDe })) {
      if (daCo.has(`${c.id}|${t.id}|${o.period_code}`)) continue
      if (!CA_QUA_KHU && o.due_date <= HOM_NAY) continue
      canThem.push(o)
    }
  }

  for (const t of quyetToan) {
    for (const o of nghiaVuQuyetToan({ client: c, loai: t, nam: NAM, ngayLe })) {
      if (daCo.has(`${c.id}|${t.id}|${o.period_code}`)) continue
      if (!CA_QUA_KHU && o.due_date <= HOM_NAY) continue
      canThem.push(o)
    }
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
