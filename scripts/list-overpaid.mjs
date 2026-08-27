// LIỆT KÊ các công ty có khoản thu phí kế toán VƯỢT mức phí của kỳ đó, kèm bằng chứng để rà
// xem là "khách trả gộp nhiều kỳ" (hợp lệ) hay "ghi nhầm công ty / gõ nhầm số" (cần sửa).
//
//   node scripts/list-overpaid.mjs
//
// Xuất ra snapshots/thu-vuot-phi-<ngày>.csv (mở bằng Excel được, có BOM cho tiếng Việt).
// Chỉ ĐỌC dữ liệu, không ghi gì lên Supabase.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolveFeeForMonth } from '../lib/feeDue.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const mk = (y, m) => y * 12 + m
const label = (y, m) => 'T' + m + '/' + y

async function fetchAll(table, columns, filter) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = s.from(table).select(columns).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(table + ': ' + error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const [paid, feePlans, clients, changeLog] = await Promise.all([
  fetchAll('service_fees', 'client_id,year,month,amount,type,note,created_at', q => q.eq('type', 'ketoan')),
  fetchAll('service_fees', 'client_id,year,month,amount,type', q => q.eq('type', 'fee_plan')),
  fetchAll('clients', 'id,name,client_code,tax_code,monthly_fee,fee_period,assigned_to,room_id'),
  fetchAll('client_change_log', 'id,client_id,old_value,changed_at,entity,action',
    q => q.eq('entity', 'monthly_fee').eq('action', 'update')),
])
const staff = await fetchAll('staff', 'id,full_name,room_id')
const rooms = await fetchAll('rooms', 'id,name')

const clientById = new Map(clients.map(c => [c.id, c]))
const staffById = new Map(staff.map(x => [x.id, x]))
const roomById = new Map(rooms.map(r => [r.id, r]))

// Gom các khoản đã thu theo từng công ty để tra tháng liền kề.
const paidByClient = new Map()
for (const r of paid) {
  if (!paidByClient.has(r.client_id)) paidByClient.set(r.client_id, [])
  paidByClient.get(r.client_id).push(r)
}

const rows = []
for (const r of paid) {
  const c = clientById.get(r.client_id)
  if (!c) continue
  const fee = resolveFeeForMonth(feePlans, r.client_id, r.year, r.month, c.monthly_fee, changeLog)
  const amount = Number(r.amount) || 0
  if (!fee || amount <= fee) continue

  const ratio = amount / fee
  const isCleanMultiple = Math.abs(ratio - Math.round(ratio)) < 0.001 && Math.round(ratio) >= 2
  const extraPeriods = Math.round(ratio) - 1

  // Bằng chứng "trả gộp": nếu đúng bội số N, thử xem (N-1) tháng LIỀN TRƯỚC có bị bỏ trống không.
  const mine = paidByClient.get(r.client_id) || []
  const paidKeys = new Set(mine.map(x => mk(x.year, x.month)))
  const here = mk(r.year, r.month)
  const prevGap = []
  if (isCleanMultiple) {
    for (let i = 1; i <= extraPeriods; i++) {
      const k = here - i
      const y = Math.floor((k - 1) / 12), m = k - y * 12
      if (!paidKeys.has(k)) prevGap.push(label(y, m))
    }
  }
  const coversGap = isCleanMultiple && prevGap.length === extraPeriods

  // Số tiền này có trùng mức phí của công ty KHÁC không -> dấu hiệu ghi nhầm công ty.
  const sameAsOtherFee = clients.filter(o => o.id !== c.id && Number(o.monthly_fee) === amount)
    .slice(0, 3).map(o => (o.client_code || o.name))

  let verdict, why
  if (coversGap) {
    verdict = 'Nhiều khả năng TRẢ GỘP'
    why = 'Đúng ×' + Math.round(ratio) + ' phí tháng, và ' + extraPeriods +
      ' tháng liền trước (' + prevGap.join(', ') + ') không có khoản thu nào'
  } else if (isCleanMultiple) {
    verdict = 'Cần rà — bội số chẵn nhưng tháng trước ĐÃ thu'
    why = 'Đúng ×' + Math.round(ratio) + ' phí tháng, nhưng các tháng liền trước đã có khoản thu rồi'
  } else if (sameAsOtherFee.length) {
    verdict = 'NGHI GHI NHẦM CÔNG TY'
    why = 'Số tiền trùng đúng mức phí tháng của công ty khác: ' + sameAsOtherFee.join(', ')
  } else {
    verdict = 'Cần rà — vượt lẻ'
    why = 'Vượt ' + fmt(amount - fee) + 'đ, không phải bội số chẵn của phí tháng'
  }

  const st = staffById.get(c.assigned_to)
  rows.push({
    ky: label(r.year, r.month),
    ma: c.client_code || '',
    ten: c.name,
    mst: c.tax_code || '',
    daThu: amount,
    phiKy: fee,
    vuot: amount - fee,
    boiSo: ratio.toFixed(2).replace(/\.00$/, ''),
    loaiPhi: c.fee_period === 'quarterly' ? 'Quý' : 'Tháng',
    nhanVien: st ? st.full_name : '',
    phong: roomById.get(c.room_id)?.name || '',
    ghiChu: r.note || '',
    ngayGhi: r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '',
    nhanDinh: verdict,
    canCu: why,
  })
}

rows.sort((a, b) => b.vuot - a.vuot)

console.log('Có ' + rows.length + ' khoản thu vượt phí kỳ, trên tổng ' + paid.length + ' khoản đã ghi nhận.\n')
for (const r of rows) {
  console.log('── ' + r.ky + '  ' + (r.ma || '(chưa có mã)') + '  ' + r.ten)
  console.log('   Đã thu ' + fmt(r.daThu) + 'đ  /  phí kỳ ' + fmt(r.phiKy) + 'đ   (×' + r.boiSo + ', vượt ' + fmt(r.vuot) + 'đ)')
  console.log('   Nhân viên: ' + (r.nhanVien || '—') + (r.phong ? ' · Phòng ' + r.phong : '') + ' · Ghi ngày ' + r.ngayGhi)
  console.log('   → ' + r.nhanDinh)
  console.log('     ' + r.canCu)
  if (r.ghiChu) console.log('     Ghi chú đã nhập: ' + r.ghiChu)
  console.log('')
}

const HEAD = ['Kỳ','Mã KH','Tên công ty','MST','Đã thu','Phí kỳ','Vượt','Bội số','Loại phí',
  'Nhân viên','Phòng','Ghi chú đã nhập','Ngày ghi','Nhận định','Căn cứ']
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
const csv = '﻿' + [HEAD.map(esc).join(',')].concat(
  rows.map(r => [r.ky, r.ma, r.ten, r.mst, r.daThu, r.phiKy, r.vuot, r.boiSo, r.loaiPhi,
    r.nhanVien, r.phong, r.ghiChu, r.ngayGhi, r.nhanDinh, r.canCu].map(esc).join(','))
).join('\r\n')

if (!existsSync('snapshots')) mkdirSync('snapshots')
const out = 'snapshots/thu-vuot-phi-' + new Date().toISOString().slice(0, 10) + '.csv'
writeFileSync(out, csv, 'utf8')
console.log('Đã xuất file để rà soát: ' + out)
console.log('(mở bằng Excel — đã có BOM nên tiếng Việt không bị lỗi font)')
