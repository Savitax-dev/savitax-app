// Chốt chặn Chrome treo khi hỏi quyền thư mục (lib/tokhaiLuuDia.js): hạn 15 giây, tự gỡ khi Chrome trả lời muộn, nút Thử lại báo các màn đọc lại. Chạy ~15 giây.
import { hoiQuyenThuMuc, quyenThuMucTreo, boCoTreo, ngheHetTreo } from '../lib/tokhaiLuuDia.js'

let traLoi
const tayCham = { name: 'CHAM', queryPermission: () => new Promise(ok => { traLoi = ok }) }
const tayNhanh = { name: 'NHANH', queryPermission: async () => 'granted' }
let soLanNghe = 0
const bo = ngheHetTreo(() => { soLanNghe++ })
const kiem = (ten, a, b) => console.log((a === b ? 'OK  ' : 'SAI ') + ten, a === b ? '' : `(ra ${a}, mong ${b})`)

kiem('Chrome nhanh → granted', await hoiQuyenThuMuc(tayNhanh, { mode: 'read' }), 'granted')
const t0 = Date.now()
const kq = await hoiQuyenThuMuc(tayCham, { mode: 'read' })
const giay = Math.round((Date.now() - t0) / 1000)
kiem('Chrome không trả lời → treo', kq, 'treo')
kiem('chờ đúng ~15 giây', giay >= 14 && giay <= 16, true)
kiem('cờ treo bật', quyenThuMucTreo(), true)
const t1 = Date.now()
kiem('lần hỏi sau → treo ngay', await hoiQuyenThuMuc(tayNhanh, { mode: 'read' }), 'treo')
kiem('không chờ thêm', Date.now() - t1 < 100, true)
traLoi('granted'); await new Promise(r => setTimeout(r, 10))
kiem('Chrome trả lời muộn → cờ tự gỡ', quyenThuMucTreo(), false)
kiem('màn đang mở được báo 1 lần', soLanNghe, 1)
kiem('hỏi lại chạy bình thường', await hoiQuyenThuMuc(tayNhanh, { mode: 'read' }), 'granted')
boCoTreo()
kiem('bấm Thử lại → báo màn đọc lại', soLanNghe, 2)
bo(); boCoTreo()
kiem('màn đã đóng thì không bị gọi', soLanNghe, 2)
