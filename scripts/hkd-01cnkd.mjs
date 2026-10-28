// Nạp MỘT LẦN tờ khai 01/CNKD cho hộ kinh doanh (anh chốt 28/10/2026). Mặc định CHỈ XEM TRƯỚC.
//   node --env-file=.env.local scripts/hkd-01cnkd.mjs          # xem trước, không ghi gì
//   node --env-file=.env.local scripts/hkd-01cnkd.mjs --ghi    # ghi thật
//
// Làm 3 việc, đúng thứ tự:
//   1. Thêm loại 01/CNKD vào danh mục (như sql/41_tokhai_01cnkd.sql) nếu chưa có.
//   2. Hồ sơ đã đồng bộ có mã thủ tục 1.011022 mà chưa có loại → gán loại 01/CNKD.
//   3. Mỗi hộ kinh doanh đang phục vụ × mỗi loại tờ khai áp cho hộ (lib/tokhaiLich.js loaiApDung):
//      sinh lịch năm nay bằng ĐÚNG sinhLaiLich mà nút "Lưu kỳ khai" dùng — kỳ chưa tới hạn, kỳ đã qua
//      chỉ khi có hồ sơ; gắn hồ sơ vào kỳ; tính lại trạng thái. Chạy lại không sinh trùng.
//   4. Tự đổi kỳ khai theo cổng cho các hộ (vd LETHANHNHAN khai 01/GTGT theo THÁNG) — đúng luật đồng bộ dùng.
import { createClient } from '@supabase/supabase-js'
import { sinhLaiLich, tuDoiKyKhaiTheoCong } from '../lib/tokhaiKyKhai.js'
import { loaiApDung, MA_CNKD, TTHC_CNKD } from '../lib/tokhaiLich.js'

const GHI = process.argv.includes('--ghi')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function docHet(q) { let r = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().order('id').range(f, f + 999); if (error) throw new Error(error.message); r = r.concat(data); if (data.length < 1000) return r } }
const NAM = new Date().getFullYear()
const TU_NGAY = NAM + '-01-01'
console.log(GHI ? '=== GHI THẬT ===' : '=== XEM TRƯỚC (thêm --ghi để ghi) ===')

// 1. Danh mục
let { data: cnkd } = await s.from('tax_filing_types').select('id, code, period_kind, is_active').eq('code', MA_CNKD).maybeSingle()
if (!cnkd) {
  console.log('1. Chưa có loại 01/CNKD →', GHI ? 'thêm' : 'sẽ thêm')
  if (GHI) {
    const { data, error } = await s.from('tax_filing_types').insert({
      code: MA_CNKD, name: 'Tờ khai thuế đối với hộ kinh doanh, cá nhân kinh doanh', tax_kind: 'CNKD',
      period_kind: 'quarter', ma_tkhai_portal: null, sort_order: 15,
    }).select('id, code, period_kind, is_active').single()
    if (error) throw new Error('Không thêm được loại 01/CNKD: ' + error.message)
    cnkd = data
  }
} else console.log('1. Đã có loại 01/CNKD')

// 2. Gán loại cho hồ sơ đã đồng bộ
const chuaLoai = await docHet(() => s.from('tax_filings').select('id, client_id, period_code').eq('tthc_code', TTHC_CNKD).is('filing_type_id', null))
console.log(`2. Hồ sơ mã thủ tục ${TTHC_CNKD} chưa có loại: ${chuaLoai.length} →`, GHI ? 'gán 01/CNKD' : 'sẽ gán 01/CNKD')
if (GHI && chuaLoai.length) {
  for (let i = 0; i < chuaLoai.length; i += 200) {
    const { error } = await s.from('tax_filings').update({ filing_type_id: cnkd.id }).in('id', chuaLoai.slice(i, i + 200).map(h => h.id))
    if (error) throw new Error('Không gán được loại cho hồ sơ: ' + error.message)
  }
}

// 3. Sinh lịch cho từng hộ
const loaiTK = (await docHet(() => s.from('tax_filing_types').select('id, code, period_kind, is_active')))
  .filter(t => t.is_active !== false && ['month', 'quarter'].includes(t.period_kind))
if (!GHI && !cnkd) loaiTK.push({ id: '__moi__', code: MA_CNKD, period_kind: 'quarter', is_active: true })
const hkd = (await docHet(() => s.from('clients').select('id, name, client_code, report_type, contract_start, is_hkd, is_active, status').eq('is_hkd', true)))
  .filter(c => c.is_active !== false && c.status !== 'inactive')
const hoSo = await docHet(() => s.from('tax_filings').select('id, client_id, filing_type_id, tthc_code, period_code').in('client_id', hkd.map(c => c.id)))
const daNop = (c, t) => hoSo.some(h => h.client_id === c.id && (h.filing_type_id === t.id || (t.code === MA_CNKD && h.tthc_code === TTHC_CNKD)))

console.log(`3. Hộ kinh doanh đang phục vụ: ${hkd.length}`)
const tong = { them: 0, gan: 0, xoa: 0 }, theoLoai = {}
for (const c of hkd.sort((a, b) => String(a.client_code).localeCompare(String(b.client_code)))) {
  const dong = []
  for (const t of loaiTK) {
    if (!loaiApDung(c, t, daNop(c, t))) continue
    let kq
    if (t.id === '__moi__') {
      // Loại chưa có trong DB (xem trước lần đầu): tính tay bằng luật chung.
      const { nghiaVuDinhKy } = await import('../lib/tokhaiLich.js')
      const homNay = new Date().toISOString().slice(0, 10)
      const kyHoSo = new Set(hoSo.filter(h => h.client_id === c.id && h.tthc_code === TTHC_CNKD).map(h => h.period_code))
      const ds = nghiaVuDinhKy({ client: c, loai: t, nam: NAM, tuNgay: TU_NGAY }).filter(o => o.due_date > homNay || kyHoSo.has(o.period_code))
      kq = { daThem: ds.map(o => o.period_code), ganLaiHoSo: ds.map(o => o.period_code).filter(k => kyHoSo.has(k)), daXoa: [] }
    } else {
      kq = await sinhLaiLich(s, { client: c, loai: t, tuNgay: TU_NGAY, thu: !GHI })
    }
    if (!kq.daThem.length && !kq.ganLaiHoSo.length && !kq.daXoa.length) continue
    tong.them += kq.daThem.length; tong.gan += kq.ganLaiHoSo.length; tong.xoa += kq.daXoa.length
    theoLoai[t.code] = (theoLoai[t.code] || 0) + kq.daThem.length
    dong.push(`${t.code}: +${kq.daThem.join(',') || '—'}${kq.ganLaiHoSo.length ? ' | gắn hồ sơ ' + kq.ganLaiHoSo.join(',') : ''}${kq.daXoa.length ? ' | XOÁ ' + kq.daXoa.join(',') : ''}`)
  }
  if (dong.length) console.log(`  ${(c.client_code || c.name).padEnd(22)} (${c.report_type === 'monthly' ? 'tháng' : 'quý'}) ${dong.join('  ·  ')}`)
}
console.log(`\nTổng: thêm ${tong.them} kỳ (${JSON.stringify(theoLoai)}), gắn ${tong.gan} hồ sơ, xoá ${tong.xoa} kỳ trắng`)
if (!GHI) console.log('(chưa ghi gì)')

// 4. Tự đổi kỳ khai theo cổng (chỉ chạy được khi đã ghi lịch ở bước 3 — xem trước thì chưa có lịch để so).
if (GHI) {
  console.log('\n4. Tự đổi kỳ khai theo cổng:')
  let co = 0
  for (const c of hkd) {
    const kq = await tuDoiKyKhaiTheoCong(s, c.id)
    for (const d of kq.doi) { co++; console.log(`  ${c.client_code}: ${d.code} → ${d.periodKind === 'month' ? 'Tháng' : 'Quý'} từ ${d.quy} | thêm ${d.ketQua?.daThem?.join(',') || '—'} | xoá ${d.ketQua?.daXoa?.join(',') || '—'} | gắn ${d.ketQua?.ganLaiHoSo?.join(',') || '—'}`) }
    for (const x of kq.xemTay) console.log(`  ${c.client_code}: CẦN XEM TAY ${x.code} ${x.quy} — ${x.lyDo}`)
  }
  if (!co) console.log('  không có hộ nào cần đổi')
}
