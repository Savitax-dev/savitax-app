// Chia khoảng ngày thành các "cửa sổ" tra cứu — Phân hệ Tờ khai.
//
// Cổng chỉ cho tra mỗi lần tối đa 30 ngày, nên khoảng dài phải cắt nhỏ. Và cổng có HAI TAB tra
// cứu, chia nhau theo mốc 01/07/2025:
//
//   · nộp TỪ   01/07/2025 → tab "Tra cứu hồ sơ đã nộp trên DVC"
//   · nộp TRƯỚC 01/07/2025 → tab "Tra cứu hồ sơ đã nộp trên thuế điện tử"
//
// Mốc này do chính cổng ghi bằng chữ đỏ trên tab thứ hai. Nó giải thích vì sao tra cả năm 2025
// chỉ về được từ quý 2 trở đi: tờ khai quý 1 nộp tháng 4/2025, nằm bên tab kia.
//
// ⚠ CẮT Ở MỐC TRƯỚC, RỒI MỚI CẮT 30 NGÀY — không được làm ngược. Cửa sổ vắt ngang mốc thì hỏi tab
// nào cũng mất một nửa kết quả, mà mất LẶNG LẼ: cổng trả bảng rỗng cho phần ngoài phạm vi chứ
// không báo lỗi gì, nhìn y hệt "công ty không nộp gì tháng đó".
//
// Tách khỏi route để hai màn hình (Đồng bộ, Tải file) dùng CHUNG một cách chia — trước đây mỗi
// route chép một bản, sửa một bên là lệch nhau mà không ai biết.
import { RANGE_MAX_DAYS } from './dvcPortal.js'

export const MOC_DVC = new Date('2025-07-01T00:00:00Z')

// Cổng nhận ngày dạng dd/MM/yyyy ở CẢ HAI tab.
export const ddmmyyyy = d =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

export const tuISO = s => new Date(`${s}T00:00:00Z`)

// Cắt một khoảng thành các cửa sổ 30 ngày, đi LÙI từ ngày cuối (hồ sơ mới cần trước).
function cuaSoLui(tu0, den0, nguon) {
  const cs = []
  let den = den0
  while (den >= tu0 && cs.length < 24) {
    const lui = new Date(den.getTime() - (RANGE_MAX_DAYS - 1) * 864e5)
    const tu = lui > tu0 ? lui : tu0
    cs.push({ tuNgay: ddmmyyyy(tu), denNgay: ddmmyyyy(den), nguon })
    den = new Date(tu.getTime() - 864e5)
  }
  return cs
}

// Trả về [{ tuNgay, denNgay, nguon }] — `nguon` là 'dvc' hoặc 'etax', tức tab phải hỏi.
//
// Nhân viên KHÔNG phải chọn tab: cứ nhập khoảng ngày như cũ, app tự hỏi đúng chỗ; chọn khoảng
// vắt ngang mốc thì hỏi cả hai rồi gộp kết quả.
export function chiaCuaSo({ tuNgay, denNgay }) {
  const den0 = denNgay ? tuISO(denNgay) : new Date()
  const tu0 = tuNgay ? tuISO(tuNgay) : new Date(den0.getTime() - 29 * 864e5)
  const cs = []
  // Phần mới trước (hay dùng nhất), phần cũ sau.
  if (den0 >= MOC_DVC) cs.push(...cuaSoLui(tu0 > MOC_DVC ? tu0 : MOC_DVC, den0, 'dvc'))
  const truocMoc = new Date(MOC_DVC.getTime() - 864e5)
  if (tu0 <= truocMoc) cs.push(...cuaSoLui(tu0, den0 < truocMoc ? den0 : truocMoc, 'etax'))
  return cs
}
