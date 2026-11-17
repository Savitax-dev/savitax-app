// Phân hệ Pháp lý — điền mã cơ quan thuế trên tờ khai (maCQTNoiNop) vào danh mục cơ quan thuế.
// Mã này không có nguồn công khai (chỉ nằm trong bộ cài HTKK) → đọc từ tờ khai XML khách đã nộp (anh cho phép
// 01/11/2026). Đầu vào là file tổng hợp CHỈ gồm cặp (mã, tên cơ quan, số file, năm mới nhất) — không có dữ liệu khách.
//
// ⚠ MỘT Thuế cơ sở CÓ THỂ CÓ NHIỀU MÃ: mã đi theo quận/huyện CŨ (chi cục cũ) chứ không theo đơn vị mới. VD Thuế cơ sở 5
// Đồng Nai = 71315 (Long Thành cũ) + 71317 (Nhơn Trạch cũ). Nên cột ma_cqt ghi mọi mã, cách nhau "; ", mã nhiều tờ khai
// nhất đứng đầu; file báo cáo kèm tên chi cục cũ của từng mã để nhân viên chọn đúng mã theo nơi đặt trụ sở cũ.
//   node scripts/phaply-ma-cqt-tu-to-khai.mjs <ket-qua.json> [<ket-qua-khac.json>…]
//     → cột ma_cqt trong data/phaply/danh-muc/co-quan-thue/co-quan-thue.csv
//     → data/phaply/danh-muc/co-quan-thue/ma-cqt-tu-to-khai.csv
import { readFileSync, writeFileSync } from 'node:fs'

const GOC = 'data/phaply/danh-muc/co-quan-thue'
const vao = process.argv.slice(2).map(p => JSON.parse(readFileSync(p, 'utf8')))

function docCsv(p) {
  const dong = readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
  const tach = l => { const o = []; let s = '', q = false
    for (let i = 0; i < l.length; i++) { const c = l[i]
      if (q) { if (c === '"' && l[i + 1] === '"') { s += '"'; i++ } else if (c === '"') q = false; else s += c }
      else if (c === '"') q = true; else if (c === ',') { o.push(s); s = '' } else s += c }
    o.push(s); return o }
  const cot = tach(dong[0])
  return { cot, ds: dong.slice(1).map(l => Object.fromEntries(tach(l).map((v, i) => [cot[i], v]))) }
}
const oCsv = v => /[",;\r\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '')
const ghiCsv = (p, cot, ds) => writeFileSync(p, '﻿' + [cot.join(','), ...ds.map(r => cot.map(c => oCsv(r[c])).join(','))].join('\r\n') + '\r\n')

// So tên bỏ chữ "tỉnh"/"thành phố" (Đồng Nai lên thành phố 2026 nên tờ khai ghi cả hai), bỏ hoa/thường, Hoà ~ Hòa
const chuan = s => s.normalize('NFC').toLowerCase()
  .replace(/\btp\.?\s*hcm\b/g, 'hồ chí minh').replace(/\btp\.\s*/g, ' ').replace(/\b(tỉnh|thành phố)\s+/g, ' ')
  .replace(/oà/g, 'òa').replace(/oá/g, 'óa').replace(/uỷ/g, 'ủy').replace(/[’'`]/g, "'")
  .replace(/\s+/g, ' ').trim()

const { cot, ds: cqt } = docCsv(`${GOC}/co-quan-thue.csv`)
const theoTen = new Map(cqt.map(r => [chuan(r.ten_cqt), r]))

// Gộp mọi file vào: mã → { tên mới khớp danh mục (+ số file), tên cũ }
const theoMa = new Map()
let soDoc = 0
for (const v of vao) { soDoc += v.soDoc || 0
  for (const o of v.ds) {
    const m = theoMa.get(o.ma) || { ma: o.ma, moi: new Map(), cu: new Map() }
    const r = theoTen.get(chuan(o.ten))
    if (r) { const x = m.moi.get(r.khoa) || { r, soFile: 0, nam: '' }; x.soFile += o.soFile; if (o.namMoi > x.nam) x.nam = o.namMoi; m.moi.set(r.khoa, x) }
    else m.cu.set(o.ten, (m.cu.get(o.ten) || 0) + o.soFile)
    theoMa.set(o.ma, m)
  }
}

const bao = [], maCua = new Map()
for (const m of theoMa.values()) {
  const tenCu = [...m.cu].sort((a, b) => b[1] - a[1]).map(([t]) => t).join(' | ')
  const moi = [...m.moi.values()].sort((a, b) => b.soFile - a.soFile)
  if (!moi.length) { bao.push({ ma: m.ma, khoa: '', ten_moi: '', so_file: [...m.cu.values()].reduce((a, b) => a + b, 0), ten_cu: tenCu, xu_ly: 'Chỉ thấy tên cũ (trước 07/2025) — chưa biết thuộc Thuế cơ sở nào' }); continue }
  // Một mã chỉ thuộc MỘT cơ quan mới; nếu tờ khai ghi 2 tên mới cho cùng mã thì lấy tên nhiều file hơn và báo
  const [chon, ...khac] = moi
  bao.push({ ma: m.ma, khoa: chon.r.khoa, ten_moi: chon.r.ten_cqt, so_file: chon.soFile, nam_moi_nhat: chon.nam, ten_cu: tenCu,
    xu_ly: khac.length ? `Đã ghi — tờ khai còn ghi tên mới khác: ${khac.map(x => `${x.r.ten_cqt} (${x.soFile})`).join(', ')}` : 'Đã ghi vào danh mục' })
  if (!maCua.has(chon.r.khoa)) maCua.set(chon.r.khoa, [])
  maCua.get(chon.r.khoa).push({ ma: m.ma, soFile: chon.soFile })
}

for (const r of cqt) {
  const ds = maCua.get(r.khoa)
  r.ma_cqt = ds ? ds.sort((a, b) => b.soFile - a.soFile).map(x => x.ma).join('; ') : ''
}
const theoKhoa = new Map(cqt.map(r => [r.khoa, r]))
for (const r of cqt) r.ma_cqt_cap_tren = theoKhoa.get(r.khoa_cap_tren)?.ma_cqt || ''

ghiCsv(`${GOC}/co-quan-thue.csv`, cot, cqt)
bao.sort((a, b) => (a.khoa || 'zz').localeCompare(b.khoa || 'zz') || a.ma.localeCompare(b.ma))
ghiCsv(`${GOC}/ma-cqt-tu-to-khai.csv`, ['ma', 'khoa', 'ten_moi', 'so_file', 'nam_moi_nhat', 'ten_cu', 'xu_ly'], bao)
const dem = f => cqt.filter(f).length
console.log(`tờ khai đọc: ${soDoc} | mã khác nhau: ${theoMa.size} | ghép được: ${bao.filter(b => b.khoa).length} | chỉ tên cũ: ${bao.filter(b => !b.khoa).length}`)
console.log(`Thuế tỉnh ${dem(r => r.cap === 'tinh' && r.ma_cqt)}/${dem(r => r.cap === 'tinh')} · Thuế cơ sở ${dem(r => r.cap === 'co_so' && r.ma_cqt)}/${dem(r => r.cap === 'co_so')} (nhiều mã: ${dem(r => r.ma_cqt.includes(';'))}) · chi cục ${dem(r => r.cap === 'chi_cuc' && r.ma_cqt)}/${dem(r => r.cap === 'chi_cuc')}`)
for (const b of bao) if (b.xu_ly.startsWith('Đã ghi — ')) console.log('⚠', b.ma, b.xu_ly)
