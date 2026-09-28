// Kiểm cách suy PHÒNG của công ty — và chặn đúng lỗi đã từng xảy ra.
//   node scripts/test-client-room.mjs
//
// BỐI CẢNH: cột `clients.room_id` gần như luôn trống (đo 28/09/2026: 0/294 công ty có giá trị).
// Phòng thật suy từ nhân viên phụ trách. Lần trước dùng thẳng `clients.room_id` đã gây hậu quả kép:
// báo cáo dồn hết vào '(chưa xếp phòng)', và TRƯỞNG PHÒNG KHÔNG THẤY công ty nào của phòng mình.
//
// Nay tách thêm bản THUẦN `mapPhongTuDanhSachNV` để route dùng lại danh sách nhân viên đã tải,
// khỏi hỏi máy chủ lần hai. Cái bẫy mới: route quên chọn `room_id` trong câu lấy staff thì hàm
// trả về toàn null, KHÔNG BÁO LỖI GÌ — trưởng phòng lại trắng màn hình. Phần [2] chặn đúng chỗ đó.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mapPhongTuDanhSachNV } from '../lib/clientRoom.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// ── [1] Suy phòng ────────────────────────────────────────────────────────────

console.log('[1] Suy phòng từ nhân viên phụ trách:')

const NV = [
  { id: 'nv-le', room_id: 'phong-grand', full_name: 'Huỳnh Thị Mỹ Lệ' },
  { id: 'nv-nam', room_id: 'phong-2', full_name: 'Nguyễn Văn Nam' },
  { id: 'nv-treo', room_id: null, full_name: 'Chưa xếp phòng' },
]

const lay = (clients, nv = NV) => Object.fromEntries(mapPhongTuDanhSachNV(clients, nv))

kiem('công ty trống room_id → lấy phòng của nhân viên phụ trách',
  lay([{ id: 'c1', room_id: null, assigned_to: 'nv-le' }]),
  { c1: 'phong-grand' })

kiem('ba công ty của hai nhân viên khác phòng',
  lay([
    { id: 'c1', room_id: null, assigned_to: 'nv-le' },
    { id: 'c2', room_id: null, assigned_to: 'nv-nam' },
    { id: 'c3', room_id: null, assigned_to: 'nv-le' },
  ]),
  { c1: 'phong-grand', c2: 'phong-2', c3: 'phong-grand' })

kiem('công ty CÓ room_id thì ưu tiên giá trị của chính nó',
  lay([{ id: 'c1', room_id: 'phong-rieng', assigned_to: 'nv-le' }]),
  { c1: 'phong-rieng' })

kiem('chưa giao nhân viên → null',
  lay([{ id: 'c1', room_id: null, assigned_to: null }]),
  { c1: null })

kiem('nhân viên chưa xếp phòng → null',
  lay([{ id: 'c1', room_id: null, assigned_to: 'nv-treo' }]),
  { c1: null })

kiem('nhân viên phụ trách không còn trong danh sách → null, không nổ',
  lay([{ id: 'c1', room_id: null, assigned_to: 'nv-da-nghi' }]),
  { c1: null })

kiem('danh sách nhân viên rỗng → tất cả null', lay([{ id: 'c1', assigned_to: 'nv-le' }], []), { c1: null })
kiem('không có công ty nào → rỗng', lay([]), {})
kiem('tham số null → rỗng, không nổ', Object.fromEntries(mapPhongTuDanhSachNV(null, null)), {})

// ⚠ Đây là cái bẫy: nhân viên tải về mà THIẾU cột room_id thì mọi công ty thành null.
kiem('THIẾU cột room_id → toàn null (đây chính là lỗi phần [2] đi canh)',
  lay([{ id: 'c1', room_id: null, assigned_to: 'nv-le' }], [{ id: 'nv-le', full_name: 'Huỳnh Thị Mỹ Lệ' }]),
  { c1: null })

// ── [2] Canh mã nguồn: route nào dùng bản thuần thì phải chọn room_id ────────

console.log('')
console.log('[2] Route dùng mapPhongTuDanhSachNV có chọn room_id của staff không:')

function quetFile(goc) {
  const ra = []
  const di = d => {
    for (const ten of readdirSync(d)) {
      const p = join(d, ten)
      if (statSync(p).isDirectory()) { if (ten !== 'node_modules' && ten !== '.next') di(p) }
      else if (/\.(js|mjs)$/.test(ten)) ra.push(p)
    }
  }
  di(goc)
  return ra
}

const dung = quetFile('app').filter(p => readFileSync(p, 'utf8').includes('mapPhongTuDanhSachNV'))
console.log(`  (có ${dung.length} route dùng hàm này)`)
if (!dung.length) { console.log('  HỎNG  không route nào dùng — có phải vừa đổi tên hàm?'); hong++ }

for (const p of dung) {
  const ma = readFileSync(p, 'utf8')
  // Mọi câu lấy bảng staff trong file đều phải kèm room_id.
  const cauStaff = [...ma.matchAll(/from\(['"]staff['"]\)\s*\.\s*select\(\s*['"]([^'"]*)['"]/g)].map(m => m[1])
  const ten = p.replace(/\\/g, '/')
  if (!cauStaff.length) {
    console.log(`  HỎNG  ${ten} — dùng mapPhongTuDanhSachNV nhưng không thấy câu lấy bảng staff`)
    hong++
    continue
  }
  const thieu = cauStaff.filter(c => !/\broom_id\b/.test(c))
  if (thieu.length) {
    console.log(`  HỎNG  ${ten} — câu lấy staff THIẾU room_id: select('${thieu[0]}')`)
    console.log('         → trưởng phòng sẽ không thấy công ty nào, mà app không báo lỗi gì.')
    hong++
  } else {
    console.log(`  OK    ${ten}`)
  }
}

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
