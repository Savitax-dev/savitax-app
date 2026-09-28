// Kiểm phần ĐẾM SỐ LIỆU của Báo cáo tờ khai.
//   node scripts/test-tokhai-thongke.mjs
//
// Vì sao phải có bộ kiểm riêng: đây là phần sai âm thầm nhất của cả phân hệ. Bảng vẫn hiện ra đầy
// đủ, cột vẫn thẳng, chỉ có CON SỐ là sai — mà trưởng phòng dựa vào đúng mấy con số đó để đôn đốc
// nhân viên. Ngày 28/09/2026 soát ra hai lỗi cùng loại trong một lần, cả hai đều lọt qua mắt thường:
//   [A] câu lấy nghĩa vụ quên cột `id` → phép ghép hồ sơ ↔ nghĩa vụ LUÔN TRƯỢT
//   [B] chỉ đếm theo nghĩa vụ → kỳ chưa sinh nghĩa vụ thì báo cáo trắng trơn dù đã nộp thật

import { dungCacO, congO, trangThaiCuaO } from '../lib/tokhaiThongKe.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

const HOM_NAY = '2026-09-28'
const oTrong = () => ({
  phaiNop: 0, chapNhan: 0, choKetQua: 0, chuaNop: 0, quaHan: 0, khongPhatSinh: 0,
  khongChapNhan: 0, ngoaiLich: 0, coNgayTiepNhan: 0, dungHan: 0,
})
const dem = ds => ds.reduce((t, o) => congO(t, o), oTrong())
const gon = d => Object.fromEntries(Object.entries(d).filter(([, v]) => v))

console.log('Trạng thái của một ô:')
kiem('có hồ sơ thật → LẤY THEO CỔNG, không lấy trạng thái app tự suy',
  trangThaiCuaO({ state: 'not_filed', due_date: '2026-07-31' }, { state: 'accepted' }, HOM_NAY), 'accepted')
kiem('chưa nộp mà quá hạn → overdue',
  trangThaiCuaO({ state: 'not_filed', due_date: '2026-07-31' }, null, HOM_NAY), 'overdue')
kiem('chưa nộp nhưng chưa tới hạn → giữ not_filed',
  trangThaiCuaO({ state: 'not_filed', due_date: '2026-10-31' }, null, HOM_NAY), 'not_filed')
kiem('đánh không phát sinh thì giữ nguyên',
  trangThaiCuaO({ state: 'no_activity', due_date: '2026-07-31' }, null, HOM_NAY), 'no_activity')

// ── [A] Ghép hồ sơ với nghĩa vụ ─────────────────────────────────────────────

console.log('')
console.log('[A] Ghép hồ sơ thật vào nghĩa vụ (lỗi cũ: quên cột id nên luôn trượt):')

const NV1 = { id: 'nv-1', client_id: 'c1', filing_type_id: 'gtgt', state: 'not_filed', due_date: '2026-07-31' }
const HS1 = { client_id: 'c1', filing_type_id: 'gtgt', state: 'accepted', obligation_id: 'nv-1',
  received_at: '2026-07-16', on_time: true }

let o = dungCacO({ nghiaVu: [NV1], hoSo: [HS1], homNayISO: HOM_NAY })
kiem('một nghĩa vụ + hồ sơ của nó = MỘT ô, không phải hai', o.length, 1)
kiem('ô đó mang trạng thái của cổng', o[0].trangThai, 'accepted')
kiem('không bị tính là ngoài lịch', o[0].ngoaiLich, false)
kiem('đếm ra đúng', gon(dem(o)),
  { phaiNop: 1, chapNhan: 1, coNgayTiepNhan: 1, dungHan: 1 })

// Đây chính là hậu quả của lỗi cũ: thiếu id thì hồ sơ không ghép được.
const o2 = dungCacO({
  nghiaVu: [{ ...NV1, id: undefined }],
  hoSo: [HS1], homNayISO: HOM_NAY,
})
kiem('THIẾU id thì hồ sơ không ghép được → đây là lỗi cũ, nay route đã lấy id',
  gon(dem(o2)).chapNhan || 0, 0)

// ── [B] Hồ sơ thật mà kỳ chưa sinh nghĩa vụ ─────────────────────────────────

console.log('')
console.log('[B] Kỳ chưa sinh nghĩa vụ nhưng đã nộp thật (ca Quý 2/2026):')

const HS_LE = [
  { client_id: 'c1', filing_type_id: 'gtgt', state: 'accepted', obligation_id: null, received_at: '2026-07-16', on_time: true },
  { client_id: 'c1', filing_type_id: 'tncn', state: 'accepted', obligation_id: null, received_at: '2026-07-16', on_time: true },
]
o = dungCacO({ nghiaVu: [], hoSo: HS_LE, homNayISO: HOM_NAY })
kiem('KHÔNG có nghĩa vụ nào vẫn đếm được 2 tờ đã nộp', o.length, 2)
kiem('đánh dấu là ngoài lịch hạn nộp', o.map(x => x.ngoaiLich), [true, true])
kiem('đếm ra đúng', gon(dem(o)),
  { phaiNop: 2, chapNhan: 2, ngoaiLich: 2, coNgayTiepNhan: 2, dungHan: 2 })

// ── Không được đếm đôi ──────────────────────────────────────────────────────

console.log('')
console.log('Không đếm đôi:')
o = dungCacO({
  nghiaVu: [NV1],
  // Hồ sơ cùng công ty, cùng LOẠI tờ khai, nhưng chưa gắn được nghĩa vụ.
  hoSo: [{ client_id: 'c1', filing_type_id: 'gtgt', state: 'accepted', obligation_id: null, received_at: '2026-07-16', on_time: true }],
  homNayISO: HOM_NAY,
})
kiem('đã có ô cùng loại rồi thì KHÔNG thêm ô nữa', o.length, 1)
kiem('phải nộp vẫn là 1, không thành 2', dem(o).phaiNop, 1)

o = dungCacO({
  nghiaVu: [NV1],
  hoSo: [{ client_id: 'c1', filing_type_id: 'tncn', state: 'received', obligation_id: null, received_at: null, on_time: null }],
  homNayISO: HOM_NAY,
})
kiem('khác LOẠI tờ khai thì mới thêm ô', o.length, 2)
kiem('đếm ra đúng', gon(dem(o)), { phaiNop: 2, choKetQua: 1, quaHan: 1, ngoaiLich: 1 })

// ── Trộn nhiều trạng thái ───────────────────────────────────────────────────

console.log('')
console.log('Trộn nhiều trạng thái:')
o = dungCacO({
  nghiaVu: [
    { id: 'a', client_id: 'c1', filing_type_id: 't1', state: 'not_filed', due_date: '2026-07-31' },  // quá hạn
    { id: 'b', client_id: 'c1', filing_type_id: 't2', state: 'not_filed', due_date: '2026-10-31' },  // chưa tới hạn
    { id: 'c', client_id: 'c2', filing_type_id: 't1', state: 'no_activity', due_date: '2026-07-31' },
    { id: 'd', client_id: 'c2', filing_type_id: 't2', state: 'not_filed', due_date: '2026-07-31' },
  ],
  hoSo: [
    { client_id: 'c2', filing_type_id: 't2', state: 'rejected', obligation_id: 'd', received_at: '2026-08-05', on_time: false },
    { client_id: 'c3', filing_type_id: 't1', state: 'accepted', obligation_id: null, received_at: '2026-07-10', on_time: true },
  ],
  homNayISO: HOM_NAY,
})
kiem('4 nghĩa vụ + 1 hồ sơ lẻ = 5 ô', o.length, 5)
kiem('đếm ra đúng', gon(dem(o)),
  { phaiNop: 5, chapNhan: 1, chuaNop: 1, quaHan: 1, khongPhatSinh: 1, khongChapNhan: 1,
    ngoaiLich: 1, coNgayTiepNhan: 2, dungHan: 1 })

console.log('')
console.log('Rỗng:')
kiem('không có gì → không có ô nào', dungCacO({ homNayISO: HOM_NAY }).length, 0)
kiem('đếm rỗng ra toàn 0', gon(dem([])), {})

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
