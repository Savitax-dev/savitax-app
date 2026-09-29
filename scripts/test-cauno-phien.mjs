// Kiểm PHIÊN ẢO và NHỊP GỌI của tiện ích Chrome.
//   node scripts/test-cauno-phien.mjs
//
// Vì sao phải kiểm: tiện ích giả lập nhiều phiên cổng thuế trên cùng một trình duyệt bằng cách
// tráo cookie trước mỗi lượt gọi. Sai ở đây thì cookie hai công ty trộn vào nhau, và hậu quả là
// app tải hồ sơ công ty này ghi vào thư mục công ty kia — MÀ KHÔNG BÁO LỖI GÌ. Không có cách nào
// phát hiện bằng mắt, nên phải chặn bằng bộ kiểm.
//
// Ở đây dựng một bản giả của chrome.cookies và chrome.storage.session rồi chạy đúng mã thật.

import {
  docCookieCong, xoaCookieCong, datCookieCong, khoPhien, taoHangDoi, NHIP_SAN,
} from '../chrome-extension/phien.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

// ── Bản giả của chrome.cookies ──────────────────────────────────────────────

function cookiesGia() {
  let ds = []
  return {
    get _ds() { return ds },
    async getAll({ domain }) {
      return ds.filter(c => c.domain === domain || c.domain === '.' + domain)
    },
    async remove({ name }) {
      const truoc = ds.length
      ds = ds.filter(c => c.name !== name)
      if (ds.length === truoc) throw new Error('không có cookie tên ' + name)
    },
    async set(c) {
      if (!c.url) throw new Error('thiếu url')
      ds = ds.filter(x => x.name !== c.name)
      ds.push({
        name: c.name, value: c.value, path: c.path,
        secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        // Giống Chrome: không truyền domain thì thành cookie gắn đúng một máy chủ.
        domain: c.domain || new URL(c.url).hostname,
        hostOnly: !c.domain,
        ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
      })
    },
    _nap(list) { ds = list.map(c => ({ ...c })) },
  }
}

function storageGia() {
  const kho = new Map()
  return {
    async get(k) { return kho.has(k) ? { [k]: kho.get(k) } : {} },
    async set(o) { for (const [k, v] of Object.entries(o)) kho.set(k, v) },
    async remove(k) { kho.delete(k) },
    get _so() { return kho.size },
  }
}

const COOKIE_A = [{
  name: 'JSESSIONID', value: 'AAA111', domain: 'dichvucong.gdt.gov.vn', path: '/',
  secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true,
}]
const COOKIE_B = [{
  name: 'JSESSIONID', value: 'BBB222', domain: 'dichvucong.gdt.gov.vn', path: '/',
  secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true,
}]

// ── Đọc / xoá / nạp ─────────────────────────────────────────────────────────

console.log('Đọc, xoá, nạp cookie cổng:')
let ck = cookiesGia()
ck._nap(COOKIE_A)
kiem('đọc ra đúng cookie', (await docCookieCong(ck)).map(c => c.value), ['AAA111'])
kiem('xoá sạch', await xoaCookieCong(ck), 1)
kiem('sau khi xoá thì rỗng', (await docCookieCong(ck)).length, 0)
kiem('nạp lại được', await datCookieCong(ck, COOKIE_A), 1)
kiem('giá trị đúng sau khi nạp', (await docCookieCong(ck)).map(c => c.value), ['AAA111'])

// Cookie gắn đúng một máy chủ (hostOnly) mà nạp kèm domain là sai phạm vi — nới rộng ra cả tên
// miền con, cổng có thể trả nhầm phiên.
ck = cookiesGia()
await datCookieCong(ck, COOKIE_A)
kiem('giữ nguyên hostOnly, KHÔNG nới thành cookie tên miền con',
  ck._ds.map(c => ({ hostOnly: c.hostOnly, domain: c.domain })),
  [{ hostOnly: true, domain: 'dichvucong.gdt.gov.vn' }])

ck = cookiesGia()
await datCookieCong(ck, [{ ...COOKIE_A[0], hostOnly: false, domain: '.gdt.gov.vn' }])
kiem('cookie vốn là của cả tên miền thì giữ nguyên như vậy',
  ck._ds.map(c => ({ hostOnly: c.hostOnly, domain: c.domain })),
  [{ hostOnly: false, domain: '.gdt.gov.vn' }])

kiem('nạp danh sách rỗng không nổ', await datCookieCong(ck, null), 0)

// ── Hai phiên KHÔNG được trộn vào nhau ──────────────────────────────────────

console.log('')
console.log('Hai công ty chạy song song — cookie không được trộn:')
ck = cookiesGia()
const kho = khoPhien(storageGia())

// Giả lập đúng cách background.js làm: dọn → nạp phiên → gọi → cất lại.
async function motLuot(phien, doiCookieThanh) {
  await xoaCookieCong(ck)
  await datCookieCong(ck, await kho.doc(phien))
  if (doiCookieThanh) ck._nap(doiCookieThanh)      // cổng trả Set-Cookie
  await kho.ghi(phien, await docCookieCong(ck))
}

await kho.ghi('A', [])
await kho.ghi('B', [])

await motLuot('A', COOKIE_A)    // công ty A đăng nhập
await motLuot('B', COOKIE_B)    // công ty B đăng nhập (xen giữa)
kiem('phiên A giữ nguyên cookie của A', (await kho.doc('A')).map(c => c.value), ['AAA111'])
kiem('phiên B giữ nguyên cookie của B', (await kho.doc('B')).map(c => c.value), ['BBB222'])

await motLuot('A')              // A tải file tiếp
kiem('quay lại A thì cookie trên trình duyệt là của A', ck._ds.map(c => c.value), ['AAA111'])
await motLuot('B')
kiem('quay lại B thì cookie trên trình duyệt là của B', ck._ds.map(c => c.value), ['BBB222'])
kiem('A vẫn không bị B ghi đè', (await kho.doc('A')).map(c => c.value), ['AAA111'])

await kho.xoa('B')
kiem('đóng phiên B thì không còn gì', await kho.doc('B'), null)
kiem('đóng B không đụng tới A', (await kho.doc('A')).map(c => c.value), ['AAA111'])

// ── Hàng đợi: mỗi lúc một lượt ──────────────────────────────────────────────

console.log('')
console.log('Hàng đợi — mỗi lúc đúng một lượt gọi:')
let dongThoi = 0, dinhCao = 0
const xepHang = taoHangDoi({ nhipSan: 0, nghi: async () => {}, bayGio: () => 0 })
const viecCham = async (nhan, ra) => {
  dongThoi++; dinhCao = Math.max(dinhCao, dongThoi)
  await new Promise(r => setTimeout(r, 5))
  ra.push(nhan)
  dongThoi--
  return nhan
}
const thuTu = []
await Promise.all([
  xepHang(() => viecCham('a', thuTu)),
  xepHang(() => viecCham('b', thuTu)),
  xepHang(() => viecCham('c', thuTu)),
])
kiem('không bao giờ có 2 lượt chồng nhau', dinhCao, 1)
kiem('chạy đúng thứ tự xếp hàng', thuTu, ['a', 'b', 'c'])

// Một lượt lỗi thì hàng đợi vẫn phải chạy tiếp, không được đứng luôn.
const sau = []
const p1 = xepHang(async () => { throw new Error('hỏng') }).catch(() => sau.push('lỗi'))
const p2 = xepHang(async () => { sau.push('vẫn chạy') })
await Promise.all([p1, p2])
kiem('một lượt lỗi KHÔNG làm chết hàng đợi', sau, ['lỗi', 'vẫn chạy'])

// ── Nhịp gọi ────────────────────────────────────────────────────────────────

console.log('')
console.log('Giữ nhịp gọi cổng:')
let dongHo = 0
const daNghi = []
const xepHang2 = taoHangDoi({
  nhipSan: 2200,
  nghi: async ms => { daNghi.push(ms); dongHo += ms },
  bayGio: () => dongHo,
})
await xepHang2(async () => { dongHo += 100 })
await xepHang2(async () => { dongHo += 100 })
await xepHang2(async () => { dongHo += 100 })
kiem('lượt đầu không phải chờ, các lượt sau giãn đủ nhịp sàn', daNghi, [2100, 2100])

// Chạy nhiều công ty cùng lúc mà mỗi công ty tự giãn nhịp riêng thì cổng nhận gấp đôi số lượt.
// Nhịp sàn ở tiện ích là chốt chặn cuối: web app xin nhanh hơn cũng không được.
dongHo = 0
const daNghi2 = []
const xepHang3 = taoHangDoi({
  nhipSan: 2200,
  nghi: async ms => { daNghi2.push(ms); dongHo += ms },
  bayGio: () => dongHo,
})
await xepHang3(async () => {}, 0)
await xepHang3(async () => {}, 500)       // app xin 0,5 giây — phải bị ép về 2,2 giây
kiem('app xin nhanh hơn nhịp sàn thì BỊ ÉP về nhịp sàn', daNghi2, [2200])

dongHo = 0
const daNghi3 = []
const xepHang4 = taoHangDoi({
  nhipSan: 2200,
  nghi: async ms => { daNghi3.push(ms); dongHo += ms },
  bayGio: () => dongHo,
})
await xepHang4(async () => {}, 0)
await xepHang4(async () => {}, 9000)      // app xin giãn 9 giây (ví dụ sau khi dính 429)
kiem('app xin CHẬM hơn thì nghe theo', daNghi3, [9000])

kiem('nhịp sàn mặc định', NHIP_SAN, 2200)

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
