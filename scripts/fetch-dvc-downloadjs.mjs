// Tải file JS công khai của cổng DVC để đọc đúng cách gọi lệnh tải tờ khai / thông báo.
// KHÔNG đăng nhập, KHÔNG captcha — chỉ là một file tĩnh như file css.
//
//   node scripts/fetch-dvc-downloadjs.mjs

import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_JS = 'https://dichvucong.gdt.gov.vn/tthc/js/common/downloadCommon-202134345b1bc28856ce85f65e65d4ff.js'

const res = await fetch(URL_JS, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: 'https://dichvucong.gdt.gov.vn/tthc/tchs',
  },
})
const text = await res.text()
const out = join(tmpdir(), 'dvc-downloadCommon.js')
writeFileSync(out, text)

console.log('HTTP', res.status, '|', res.headers.get('content-type'), '|', text.length, 'ký tự')
console.log('Đã lưu:', out)
console.log('\n--- hai hàm cần đọc ---')
for (const ten of ['downloadHoSoCommon', 'downloadThongBaoCommon']) {
  const i = text.indexOf('function ' + ten)
  console.log(`\n### ${ten}`)
  console.log(i < 0 ? '(không tìm thấy)' : text.slice(i, i + 900))
}
