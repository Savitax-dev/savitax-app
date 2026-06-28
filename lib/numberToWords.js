// Đọc số tiền VND ra chữ tiếng Việt — dùng cho hợp đồng "(Bằng chữ: ... đồng)".
// VD: 3000000 -> "Ba triệu đồng".

const ONES = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readThree(num, full) {
  // num: 0..999; full: có phải nhóm đầy đủ phía trước không (để xử lý "không trăm")
  const tram = Math.floor(num / 100)
  const chuc = Math.floor((num % 100) / 10)
  const donvi = num % 10
  let s = ''
  if (tram > 0 || full) {
    s += ONES[tram] + ' trăm'
    if (chuc === 0 && donvi > 0) s += ' lẻ'
  }
  if (chuc > 0) {
    if (chuc === 1) s += ' mười'
    else s += ' ' + ONES[chuc] + ' mươi'
  }
  if (donvi > 0) {
    if (chuc === 0) s += ' ' + ONES[donvi]
    else if (donvi === 1 && chuc > 1) s += ' mốt'
    else if (donvi === 5 && chuc > 0) s += ' lăm'
    else s += ' ' + ONES[donvi]
  }
  return s.trim()
}

export function numberToVietnameseWords(n) {
  let num = Math.round(Number(n) || 0)
  if (num === 0) return 'Không'

  const units = ['', ' nghìn', ' triệu', ' tỷ']
  // Tách thành các nhóm 3 chữ số từ phải sang
  const groups = []
  while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000) }

  let parts = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    // full = true nếu không phải nhóm cao nhất (cần đọc đủ "không trăm")
    const isHighest = i === groups.length - 1
    parts.push(readThree(groups[i], !isHighest) + units[i])
  }
  let result = parts.join(' ').trim().replace(/\s+/g, ' ')
  // Viết hoa chữ cái đầu
  return result.charAt(0).toUpperCase() + result.slice(1)
}

// "(Bằng chữ: ... đồng)"
export function amountInWords(n) {
  return numberToVietnameseWords(n) + ' đồng'
}
