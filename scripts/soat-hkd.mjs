// Soát hộ kinh doanh và dọn lịch hạn nộp sai của họ — Phân hệ Tờ khai.
//
// MẶC ĐỊNH CHỈ XEM, KHÔNG GHI GÌ:
//   node --env-file=.env.local scripts/soat-hkd.mjs
// Ghi thật (đánh dấu is_hkd + xoá nghĩa vụ sai):
//   node --env-file=.env.local scripts/soat-hkd.mjs --apply
//
// VẤN ĐỀ: lịch hạn nộp sinh cho mọi công ty bằng danh mục tờ khai của DOANH NGHIỆP. Hộ kinh doanh
// không nộp 01/GTGT, 05/KK-TNCN, 03/TNDN, 05/QTT-TNCN, BCTC — họ nộp 01/CNKD (TT40/2021). Nên mấy
// nghĩa vụ đó là việc KHÔNG CÓ THẬT, tới hạn là màn hình báo "Quá hạn" đỏ cho cả nhóm.
//
// ⚠ CHỈ XOÁ NGHĨA VỤ CÒN TRẮNG. Dòng nào đã gắn hồ sơ thật, đã có thông báo, hay đã được đánh dấu
//   (không phát sinh / đã nộp…) thì GIỮ LẠI và báo ra — đó là dấu vết người thật đã đụng vào, xoá
//   là mất, mà mất kiểu này không ai phát hiện được.
//
// Chạy sql/22_tokhai_hkd.sql trước để có cột clients.is_hkd.

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const APPLY = process.argv.includes('--apply')
// Xuất danh sách ra Excel để người soát tick tay:  --xuat "D:\\duong-dan.xlsx"
const iXuat = process.argv.indexOf('--xuat')
const FILE_XUAT = iXuat > 0 && process.argv[iXuat + 1] ? process.argv[iXuat + 1] : null
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// PostgREST cắt ở 1000 dòng mà không báo — mọi truy vấn không giới hạn đều phải phân trang.
async function docHet(bang, cot) {
  let ra = [], tu = 0
  for (;;) {
    const { data, error } = await s.from(bang).select(cot).range(tu, tu + 999)
    if (error) throw new Error(`${bang}: ${error.message}`)
    ra = ra.concat(data)
    if (data.length < 1000) return ra
    tu += 1000
  }
}

// Tên do người gõ nên chỉ dùng để GỢI Ý. Sau lần chạy đầu thì cột is_hkd mới là nguồn đúng.
const theoTen = c => /H[ỘO]\s*KINH\s*DOANH|^HKD[\s_.-]|C[ÁA] NH[ÂA]N KINH DOANH/i.test(c.name || '')

// Chạy được cả khi CHƯA chạy sql/22 — để soát trước, quyết sau. Thiếu cột thì chỉ nhận theo tên.
let coCotHKD = true
let clients
try {
  clients = await docHet('clients', 'id, name, tax_code, client_code, assigned_to, is_hkd, is_active, status')
} catch (e) {
  if (!/is_hkd/.test(e.message)) throw e
  coCotHKD = false
  clients = await docHet('clients', 'id, name, tax_code, client_code, assigned_to, is_active, status')
  console.log('⚠ Chưa có cột clients.is_hkd (chưa chạy sql/22_tokhai_hkd.sql).')
  console.log('  Lần này chỉ nhận hộ kinh doanh QUA TÊN, và không đánh dấu được.')
  console.log('')
}
const dangPhucVu = clients.filter(c => c.is_active !== false && c.status !== 'inactive')

const daDanhDau = dangPhucVu.filter(c => c.is_hkd)
const theoTenChuaDanh = dangPhucVu.filter(c => !c.is_hkd && theoTen(c))
const laHKD = new Set([...daDanhDau, ...theoTenChuaDanh].map(c => c.id))

console.log(`Công ty đang phục vụ: ${dangPhucVu.length}`)
console.log(`  đã đánh dấu is_hkd : ${daDanhDau.length}`)
console.log(`  nhận ra qua TÊN, chưa đánh dấu: ${theoTenChuaDanh.length}`)

if (theoTenChuaDanh.length) {
  console.log('')
  console.log('Sẽ đánh dấu là hộ kinh doanh:')
  for (const c of theoTenChuaDanh) {
    console.log(`  ${(c.client_code || '—').padEnd(16)} ${(c.tax_code || '—').padEnd(14)} ${c.name}`)
  }
}

// Mã số thuế 12 chữ số là mã cá nhân — hộ kinh doanh gần như luôn dùng loại này. Công ty nào có
// MST 12 số mà tên không ghi "hộ kinh doanh" thì đáng ngờ, nhưng KHÔNG tự đánh dấu: có doanh
// nghiệp thật cũng dùng MST 12 số (chi nhánh, đơn vị phụ thuộc).
const ngoLo = dangPhucVu.filter(c =>
  !laHKD.has(c.id) && (c.tax_code || '').replace(/\D/g, '').length === 12)
if (ngoLo.length) {
  console.log('')
  console.log(`⚠ ${ngoLo.length} công ty có MST 12 chữ số (dạng mã cá nhân) mà tên không ghi "hộ kinh doanh".`)
  console.log('  KHÔNG tự đánh dấu — anh soát bằng mắt, đúng thì tick HKD trong hồ sơ công ty:')
  for (const c of ngoLo) {
    // Tên có chữ HKD ở giữa thì gần như chắc chắn là hộ kinh doanh, chỉ là viết tắt nên lọt lưới.
    const manh = /\bHKD\b/i.test(c.name || '') ? '   ← tên có chữ HKD, gần như chắc' : ''
    console.log(`  ${(c.client_code || '—').padEnd(16)} ${(c.tax_code || '—').padEnd(14)} ${c.name}${manh}`)
  }
}

// ── Nghĩa vụ sai của nhóm hộ kinh doanh ─────────────────────────────────────

const loai = await docHet('tax_filing_types', 'id, code, name')
const tenLoai = new Map(loai.map(t => [t.id, t.code]))

const nghiaVu = await docHet('tax_obligations', 'id, client_id, filing_type_id, period_code, state, due_date')
const hoSo = await docHet('tax_filings', 'obligation_id, client_id')
const coHoSo = new Set(hoSo.map(f => f.obligation_id).filter(Boolean))

const cuaHKD = nghiaVu.filter(o => laHKD.has(o.client_id))
// Chỉ xoá dòng còn TRẮNG: chưa nộp, chưa gắn hồ sơ nào.
const xoaDuoc = cuaHKD.filter(o => o.state === 'not_filed' && !coHoSo.has(o.id))
const giuLai = cuaHKD.filter(o => !(o.state === 'not_filed' && !coHoSo.has(o.id)))

console.log('')
console.log(`Nghĩa vụ đang gắn cho hộ kinh doanh: ${cuaHKD.length}`)
const theoTk = {}
for (const o of cuaHKD) {
  const k = tenLoai.get(o.filing_type_id) || '(không rõ)'
  theoTk[k] = (theoTk[k] || 0) + 1
}
for (const [k, v] of Object.entries(theoTk).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(14)} ${v}`)
}
console.log(`  → xoá được (còn trắng)  : ${xoaDuoc.length}`)
console.log(`  → GIỮ LẠI (đã có dấu vết): ${giuLai.length}`)
if (giuLai.length) {
  console.log('    Mấy dòng này người thật đã đụng vào, không xoá. Soát tay:')
  for (const o of giuLai.slice(0, 20)) {
    const c = dangPhucVu.find(x => x.id === o.client_id)
    console.log(`      ${(c?.client_code || '—').padEnd(14)} ${(tenLoai.get(o.filing_type_id) || '?').padEnd(12)} ${o.period_code}  ${o.state}${coHoSo.has(o.id) ? ' · có hồ sơ' : ''}`)
  }
}

console.log('')
console.log('Hộ kinh doanh nộp 01/CNKD (TT40/2021) — danh mục tờ khai riêng chưa có, nên sau khi dọn')
console.log('nhóm này sẽ KHÔNG có lịch hạn nộp nào. Thà trống còn hơn báo động giả.')

// ── Xuất ra Excel để người soát tick tay ────────────────────────────────────
if (FILE_XUAT) {
  const nv = await docHet('staff', 'id, full_name')
  const tenNV = new Map(nv.map(x => [x.id, x.full_name]))
  const demNV = {}
  for (const o of cuaHKD) demNV[o.client_id] = (demNV[o.client_id] || 0) + 1

  const dong = (c, ghiChu) => ({
    'Mã KH': c.client_code || '',
    'Mã số thuế': c.tax_code || '',
    'Tên công ty': c.name || '',
    'Nhân viên phụ trách': tenNV.get(c.assigned_to) || '',
    'Số nghĩa vụ đang gắn sai': demNV[c.id] || 0,
    'Là hộ kinh doanh?': ghiChu,
  })

  const wb = XLSX.utils.book_new()
  const s1 = XLSX.utils.json_to_sheet([...daDanhDau, ...theoTenChuaDanh].map(c => dong(c, 'ĐÚNG')))
  s1['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 52 }, { wch: 22 }, { wch: 24 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, s1, 'Ho kinh doanh')

  const s2 = XLSX.utils.json_to_sheet(ngoLo.map(c =>
    dong(c, /\bHKD\b/i.test(c.name || '') ? 'tên có chữ HKD — gần như chắc' : '')))
  s2['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 52 }, { wch: 22 }, { wch: 24 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(wb, s2, 'Dang ngo - can soat')

  XLSX.writeFile(wb, FILE_XUAT)
  console.log('')
  console.log(`Đã xuất: ${FILE_XUAT}`)
  console.log(`  Trang 1 "Ho kinh doanh"        — ${daDanhDau.length + theoTenChuaDanh.length} công ty`)
  console.log(`  Trang 2 "Dang ngo - can soat"  — ${ngoLo.length} công ty, cột cuối để anh điền`)
}

if (!APPLY) {
  console.log('')
  console.log('(chỉ xem trước — CHƯA GHI GÌ)')
  if (!coCotHKD) console.log('Chạy sql/22_tokhai_hkd.sql trước, rồi mới ghi được.')
  console.log('Ghi thật:  node --env-file=.env.local scripts/soat-hkd.mjs --apply')
  process.exit(0)
}

if (!coCotHKD) {
  console.error('DỪNG: chưa có cột clients.is_hkd. Chạy sql/22_tokhai_hkd.sql rồi chạy lại.')
  process.exit(1)
}

console.log('')
console.log('Đang ghi…')

if (theoTenChuaDanh.length) {
  for (let i = 0; i < theoTenChuaDanh.length; i += 100) {
    const lo = theoTenChuaDanh.slice(i, i + 100).map(c => c.id)
    const { error } = await s.from('clients').update({ is_hkd: true }).in('id', lo)
    if (error) { console.error('  Lỗi đánh dấu:', error.message); process.exit(1) }
  }
  console.log(`  đã đánh dấu is_hkd cho ${theoTenChuaDanh.length} công ty`)
}

if (xoaDuoc.length) {
  let xong = 0
  for (let i = 0; i < xoaDuoc.length; i += 200) {
    const lo = xoaDuoc.slice(i, i + 200).map(o => o.id)
    const { error } = await s.from('tax_obligations').delete().in('id', lo)
    if (error) { console.error('  Lỗi xoá:', error.message); process.exit(1) }
    xong += lo.length
    console.log(`  đã xoá ${xong}/${xoaDuoc.length} nghĩa vụ`)
  }
}

console.log('')
console.log(`Xong: ${theoTenChuaDanh.length} công ty được đánh dấu, ${xoaDuoc.length} nghĩa vụ sai đã xoá,`)
console.log(`      ${giuLai.length} dòng giữ lại để soát tay.`)
