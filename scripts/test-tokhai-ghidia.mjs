// Kiểm phần GHI FILE XUỐNG ĐĨA bằng thư mục giả — Phân hệ Tờ khai, GĐ 6.
//   node scripts/test-tokhai-ghidia.mjs
//
// File System Access API chỉ có trên trình duyệt, nên đây dựng một bộ "thư mục giả" y hệt cách API
// thật hoạt động (entries / getDirectoryHandle / getFileHandle / createWritable) rồi chạy đúng mã
// thật lên đó.
//
// Kiểm cái gì: ĐÚNG hai thứ có thể làm mất dữ liệu thật của khách —
//   1. Ghi đè lên file cũ (file cũ có thể là bản kế toán đã đối chiếu với khách rồi).
//   2. Đẻ thêm thư mục trùng ý nghĩa ('TB CHẤP NHẬN' bên cạnh 'THÔNG BÁO CHẤP NHẬN') làm kế toán
//      tìm không ra file.

import { ghiVaoDia, base64ThanhByte, byteThanhChu } from '../lib/tokhaiLuuDia.js'
import { duongDanToKhai, duongDanThongBao } from '../lib/tokhaiThuMuc.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// ── Thư mục giả ──────────────────────────────────────────────────────────────

function fileGia(ten) {
  const f = { kind: 'file', name: ten, duLieu: null }
  f.createWritable = async () => ({
    write: async d => { f.duLieu = d },
    close: async () => {},
  })
  return f
}

function thuMucGia(ten = 'goc') {
  const con = new Map()
  return {
    kind: 'directory',
    name: ten,
    con,
    async *entries() { for (const [k, v] of con) yield [k, v] },
    async getDirectoryHandle(t, { create } = {}) {
      if (!con.has(t)) {
        if (!create) { const e = new Error('NotFoundError'); e.name = 'NotFoundError'; throw e }
        con.set(t, thuMucGia(t))
      }
      return con.get(t)
    },
    async getFileHandle(t, { create } = {}) {
      if (!con.has(t)) {
        if (!create) { const e = new Error('NotFoundError'); e.name = 'NotFoundError'; throw e }
        con.set(t, fileGia(t))
      }
      return con.get(t)
    },
  }
}

// Liệt kê cây thư mục thành danh sách đường dẫn cho dễ so.
function liet(tay, truoc = '') {
  const ra = []
  for (const [ten, con] of tay.con) {
    const dd = truoc ? `${truoc}/${ten}` : ten
    if (con.kind === 'directory') ra.push(dd + '/', ...liet(con, dd))
    else ra.push(dd)
  }
  return ra.sort()
}

const chu = s => new TextEncoder().encode(s)
const docFile = (goc, dd) => {
  const phan = dd.split('/')
  let t = goc
  for (const p of phan.slice(0, -1)) t = t.con.get(p)
  const f = t?.con.get(phan[phan.length - 1])
  return f ? byteThanhChu(f.duLieu) : null
}

// ── Chuyển base64 ────────────────────────────────────────────────────────────

console.log('Chuyển base64 → byte (file XML có dấu tiếng Việt, đi qua chuỗi là hỏng mã):')
const goc = 'CÔNG TY TNHH BVTV THỊNH PHÁT — Kỳ Q1/2026'
const b64 = Buffer.from(goc, 'utf8').toString('base64')
kiem('giữ nguyên dấu sau khi qua base64', byteThanhChu(base64ThanhByte(b64)), goc)
kiem('base64 rỗng → 0 byte', base64ThanhByte('').length, 0)

// ── Ghi lần đầu ──────────────────────────────────────────────────────────────

console.log('')
console.log('Ghi lần đầu (thư mục trống):')
let G = thuMucGia()
const ddTK = duongDanToKhai({ periodCode: 'Q1.2026', maKH: 'THINHPHAT' })
const ddTB = duongDanThongBao({ periodCode: 'Q1.2026', maKH: 'THINHPHAT' })

let ten = await ghiVaoDia({ goc: G, duongDan: ddTK, tenFile: 'TK_GTGT_Q1.2026_THINHPHAT.xml', duLieu: chu('to khai') })
kiem('tên file ghi ra', ten, 'TK_GTGT_Q1.2026_THINHPHAT.xml')
await ghiVaoDia({ goc: G, duongDan: ddTK, tenFile: 'TK_GTGT_Q1.2026_THINHPHAT.pdf', duLieu: chu('%PDF to khai') })
await ghiVaoDia({ goc: G, duongDan: ddTB, tenFile: 'TBCN_GTGT_Q1.2026_THINHPHAT.xml', duLieu: chu('thong bao') })

kiem('cây thư mục dựng ra đúng quy ước', liet(G), [
  'BAOCAOTHUE_Q1_2026_THINHPHAT/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/BẢNG KÊ/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/THÔNG BÁO CHẤP NHẬN/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/THÔNG BÁO CHẤP NHẬN/TBCN_GTGT_Q1.2026_THINHPHAT.xml',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/TỜ KHAI THUẾ/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/TỜ KHAI THUẾ/TK_GTGT_Q1.2026_THINHPHAT.pdf',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/TỜ KHAI THUẾ/TK_GTGT_Q1.2026_THINHPHAT.xml',
].sort())

// ── Không ghi đè ─────────────────────────────────────────────────────────────

console.log('')
console.log('Ghi lại cùng tên (file cũ có thể là bản kế toán đã đối chiếu với khách):')
ten = await ghiVaoDia({ goc: G, duongDan: ddTK, tenFile: 'TK_GTGT_Q1.2026_THINHPHAT.xml', duLieu: chu('to khai LAN 2') })
kiem('đổi tên thành _v2', ten, 'TK_GTGT_Q1.2026_THINHPHAT_v2.xml')
kiem('file cũ GIỮ NGUYÊN nội dung',
  docFile(G, 'BAOCAOTHUE_Q1_2026_THINHPHAT/TỜ KHAI THUẾ/TK_GTGT_Q1.2026_THINHPHAT.xml'), 'to khai')
kiem('bản mới nằm ở _v2',
  docFile(G, 'BAOCAOTHUE_Q1_2026_THINHPHAT/TỜ KHAI THUẾ/TK_GTGT_Q1.2026_THINHPHAT_v2.xml'), 'to khai LAN 2')

ten = await ghiVaoDia({ goc: G, duongDan: ddTK, tenFile: 'TK_GTGT_Q1.2026_THINHPHAT.xml', duLieu: chu('lan 3') })
kiem('lần thứ ba thành _v3', ten, 'TK_GTGT_Q1.2026_THINHPHAT_v3.xml')

// ── Dùng lại thư mục kế toán đã đặt tên khác ─────────────────────────────────

console.log('')
console.log('Thư mục kế toán đã đặt sẵn tên khác nhưng cùng nghĩa:')
G = thuMucGia()
const cha = await G.getDirectoryHandle('BAOCAOTHUE_Q1_2026_THINHPHAT', { create: true })
await cha.getDirectoryHandle('TB CHẤP NHẬN', { create: true })
await cha.getDirectoryHandle('BẢNG KÊ MUA VÀO BÁN RA', { create: true })

await ghiVaoDia({ goc: G, duongDan: ddTB, tenFile: 'TBCN_GTGT_Q1.2026_THINHPHAT.xml', duLieu: chu('tb') })
kiem('dùng lại "TB CHẤP NHẬN", KHÔNG đẻ thêm "THÔNG BÁO CHẤP NHẬN"', liet(G), [
  'BAOCAOTHUE_Q1_2026_THINHPHAT/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/BẢNG KÊ MUA VÀO BÁN RA/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/TB CHẤP NHẬN/',
  'BAOCAOTHUE_Q1_2026_THINHPHAT/TB CHẤP NHẬN/TBCN_GTGT_Q1.2026_THINHPHAT.xml',
].sort())

// ── Quyết toán năm đi vào cây riêng ──────────────────────────────────────────

console.log('')
console.log('Quyết toán năm đi vào cây riêng:')
G = thuMucGia()
await ghiVaoDia({
  goc: G, duongDan: duongDanToKhai({ periodCode: 'NAM.2026', maKH: 'THINHPHAT', maToKhai: '03/TNDN' }),
  tenFile: 'TK_TNDN_NAM.2026_THINHPHAT.xml', duLieu: chu('qttndn'),
})
kiem('đường dẫn quyết toán TNDN', liet(G).filter(x => x.endsWith('.xml')),
  ['BỘ BÁO CÁO TÀI CHÍNH NĂM/TỜ KHAI/03TNDN QUYẾT TOÁN THUẾ TNDN/TK_TNDN_NAM.2026_THINHPHAT.xml'])

// ── Thiếu thư mục gốc thì phải báo lỗi, không im lặng ────────────────────────

console.log('')
console.log('Trường hợp hỏng:')
let batLoi = ''
try { await ghiVaoDia({ goc: null, duongDan: ddTK, tenFile: 'a.xml', duLieu: chu('x') }) }
catch (e) { batLoi = e.message }
kiem('chưa chọn thư mục thì BÁO LỖI', batLoi, 'Chưa chọn thư mục lưu')

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
