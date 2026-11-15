// Nợ tồn (dòng A) trên Phiếu đề nghị thanh toán của kỳ tháng M — anh chốt 15/11/2026.
//
// Từ 05/11/2026 phần chưa thu của tháng M chuyển nợ tồn ngay ngày 01 tháng M+1 (lib/debtRollover.js). Lập ĐNTT cho CHÍNH
// tháng M (vd T10, lập trước ngày 10/11) thì phí T10 đã ở dòng B — nếu dòng A lấy nguyên clients.other_debt sẽ tính T10
// HAI LẦN (ca Hoàng Đức Phát: phí 7.000.000 + tồn 7.000.000 gồm chính T10). Nên dòng A của phiếu tháng M = nợ tồn TRỪ phần
// đã chuyển của kỳ M trở về sau. Lập phiếu tháng M+1 thì phần của T(M) là nợ tồn thật → vẫn tính.
//
// rows: dòng chốt nợ tồn của công ty [{ year, month, remaining_amount | remaining }] (mọi nguồn — kế toán + HCNS đều dồn
// vào other_debt). Hàm THUẦN, dùng chung cho phiếu PDF (app/api/admin/dntt) và khung ĐNTT trong thẻ công ty.
export function noTonChoDntt(otherDebt, rows, year, month) {
  const ky = Number(year) * 12 + Number(month)
  const tru = (rows || [])
    .filter(r => Number(r.year) * 12 + Number(r.month) >= ky)
    .reduce((a, r) => a + (Number(r.remaining_amount ?? r.remaining) || 0), 0)
  return Math.max(0, (Number(otherDebt) || 0) - tru)
}

// VAT 8% của phần B trên phiếu (anh báo 15/11/2026: phí 7.000.000 gồm VAT in ra 6.999.999). Số chưa VAT trên phiếu là phí
// gồm VAT ÷ 1,08 đã LÀM TRÒN từng dòng (7.000.000 → 6.481.481), nhân lại 8% ra 518.518 → hụt 1 đồng. Gồm VAT tính lại chỉ
// lệch số tròn nghìn không quá ~0,54 đồng mỗi dòng thì đó là sai số làm tròn → kéo về số tròn nghìn. Số nhập tay bình thường
// (vd 1.000.000 chưa VAT → 1.080.000) không đổi. Phiếu PDF (app/api/admin/dntt) chép nguyên hàm này vào đoạn script tự tính.
export function vatPhieu(subTotal, soDong = 1, tyLe = 0.08) {
  if (!tyLe || !subTotal) return 0
  const tho = subTotal * (1 + tyLe)
  const tron = Math.round(tho / 1000) * 1000
  if (Math.abs(tron - tho) <= 0.55 * Math.max(1, soDong)) return tron - subTotal
  return Math.round(subTotal * tyLe)
}
