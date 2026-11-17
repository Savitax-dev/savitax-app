// Đọc CSV danh mục Pháp lý (data/phaply/danh-muc/**): bỏ BOM, ô có ngoặc kép chứa dấu phẩy / xuống dòng, "" = một ".
// Trả mảng đối tượng theo hàng tiêu đề. Chỉ dùng cho file danh mục do mình dựng — không phải bộ đọc CSV đa năng.
export function docCsv(text) {
  const s = String(text).replace(/^﻿/, '')
  const hang = []
  let o = '', dong = [], trongNhay = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (trongNhay) {
      if (c === '"' && s[i + 1] === '"') { o += '"'; i++ }
      else if (c === '"') trongNhay = false
      else o += c
    } else if (c === '"') trongNhay = true
    else if (c === ',') { dong.push(o); o = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      dong.push(o); o = ''
      if (dong.length > 1 || dong[0] !== '') hang.push(dong)
      dong = []
    } else o += c
  }
  if (o !== '' || dong.length) { dong.push(o); hang.push(dong) }
  const [dau, ...con] = hang
  return con.map(r => Object.fromEntries(dau.map((k, j) => [k.trim(), (r[j] ?? '').trim()])))
}
