// Phân hệ Pháp lý — nạp danh mục (địa danh, Phòng ĐKKD, cơ quan thuế + địa bàn, ngành kinh tế) từ data/phaply/danh-muc
// vào các bảng legal_places / legal_registries / legal_tax_offices / legal_place_tax / legal_vsic (sql/57).
//   node --env-file=.env.local scripts/phaply-nap-danh-muc.mjs           xem trước (đếm dòng, kiểm liên kết)
//   node --env-file=.env.local scripts/phaply-nap-danh-muc.mjs --ghi     ghi (upsert theo khoá — chạy lại an toàn)
//   thêm --vsic để nạp cả danh mục ngành kinh tế
// ⚠ Hiện CHỈ cho database demo (anh chưa duyệt đưa Pháp lý lên production). Danh mục là dữ liệu công khai, anh đã duyệt nguồn.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { docCsv } from '../lib/phaply/csv.js'

const REF_THAT = 'ykorxlkgsmzskdybebzg'
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
if (!url || url.includes(REF_THAT)) throw new Error('Đang trỏ production — phân hệ Pháp lý chưa được duyệt lên production, từ chối')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { error: khongDemo } = await admin.from('demo_la_ban_demo').select('id').limit(1)
if (khongDemo) throw new Error('Không thấy bảng demo_la_ban_demo — không phải database demo, từ chối')

const GHI = process.argv.includes('--ghi')
const D = 'data/phaply/danh-muc/'
const doc = f => docCsv(fs.readFileSync(D + f, 'utf8'))
const rong = v => (v === '' ? null : v)

const tinh = doc('dia-danh/tinh.csv'), xa = doc('dia-danh/xa.csv'), phong = doc('dia-danh/phong-dkkd.csv')
const cqt = doc('co-quan-thue/co-quan-thue.csv'), diaBan = doc('co-quan-thue/dia-ban.csv')

const places = [
  ...tinh.map(r => ({ ma: r.ma_tinh, cap: 'tinh', ten: r.ten_tinh, loai: rong(r.loai), ma_tinh: r.ma_tinh, ghi_chu: rong(r.ghi_chu) })),
  ...xa.map(r => ({ ma: r.ma_xa, cap: 'xa', ten: r.ten_xa, loai: rong(r.loai), ma_tinh: r.ma_tinh, ghi_chu: rong(r.ghi_chu) })),
]
const registries = phong.map(r => ({ ma_tinh: r.ma_tinh, ten_ghi_ho_so: r.ten_ghi_ho_so, dia_chi: rong(r.dia_chi), dien_thoai: rong(r.so_dien_thoai), email: rong(r.email) }))
const offices = cqt.map(r => ({ khoa: r.khoa, ten: r.ten_cqt, cap: r.cap, ma_tinh: rong(r.ma_tinh), khoa_cap_tren: rong(r.khoa_cap_tren), ma_cqt: rong(r.ma_cqt), noi_dat_tru_so: rong(r.noi_dat_tru_so) }))
const placeTax = diaBan.map(r => ({ ma_xa: r.ma_xa, khoa_cqt: r.khoa_cqt }))
let vsic = []
// Ngành kinh tế (QĐ 36/2025/QĐ-TTg) chỉ nạp khi thêm --vsic: chờ anh duyệt nguồn data/phaply/danh-muc/nganh/NGUON.md
if (process.argv.includes('--vsic') && fs.existsSync(D + 'nganh/vsic.csv')) {
  vsic = doc('nganh/vsic.csv').map(r => ({ ma: r.ma, cap: Number(r.cap), ten: r.ten, ma_cha: rong(r.ma_cha) }))
}

// Kiểm liên kết trước khi ghi
const maXa = new Set(xa.map(r => r.ma_xa)), khoaCqt = new Set(cqt.map(r => r.khoa)), maTinh = new Set(tinh.map(r => r.ma_tinh))
const loi = []
if (tinh.length !== 34) loi.push(`tinh.csv có ${tinh.length} tỉnh (phải 34)`)
if (new Set(places.map(p => p.ma)).size !== places.length) loi.push('mã địa danh trùng')
for (const r of xa) if (!maTinh.has(r.ma_tinh)) loi.push('xã ' + r.ma_xa + ' trỏ tỉnh lạ ' + r.ma_tinh)
for (const r of placeTax) { if (!maXa.has(r.ma_xa)) loi.push('địa bàn: xã lạ ' + r.ma_xa); if (!khoaCqt.has(r.khoa_cqt)) loi.push('địa bàn: cơ quan thuế lạ ' + r.khoa_cqt) }
if (placeTax.length !== xa.length) loi.push(`địa bàn thuế ${placeTax.length} xã ≠ ${xa.length} xã`)
for (const r of registries) if (!maTinh.has(r.ma_tinh)) loi.push('Phòng ĐKKD tỉnh lạ ' + r.ma_tinh)
if (registries.length !== 34) loi.push(`Phòng ĐKKD ${registries.length} (phải 34)`)
console.log(`địa danh ${places.length} (34 tỉnh + ${xa.length} xã) · Phòng ĐKKD ${registries.length} · cơ quan thuế ${offices.length} · địa bàn ${placeTax.length} · ngành ${vsic.length || '(bỏ qua — thêm --vsic)'}`)
if (loi.length) { console.log('✗', loi.slice(0, 20).join('\n✗ ')); process.exit(1) }
if (!GHI) { console.log('· xem trước — thêm --ghi để ghi'); process.exit(0) }

async function upsert(bang, rows, khoa) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(bang).upsert(rows.slice(i, i + 500), { onConflict: khoa })
    if (error) throw new Error(bang + ': ' + error.message)
  }
  console.log('✓', bang, rows.length)
}
await upsert('legal_places', places, 'ma')
await upsert('legal_registries', registries, 'ma_tinh')
await upsert('legal_tax_offices', offices, 'khoa')
await upsert('legal_place_tax', placeTax, 'ma_xa')
if (vsic.length) await upsert('legal_vsic', vsic, 'ma')
