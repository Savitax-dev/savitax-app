// Luật "không cho ghi nhận thu quá phí của kỳ" — dùng chung cho công nợ kế toán
// (app/api/admin/save-debt) và công nợ HCNS (app/api/admin/hcns/save-debt).
//
// Bối cảnh (đo trên dữ liệu thật 2026-08-27, 373 khoản thu phí kế toán đã ghi nhận):
// chỉ 6 khoản vượt phí kỳ, và chúng thuộc 3 nhóm KHÁC HẲN nhau — nên không thể xử lý bằng
// một luật chặn cứng duy nhất:
//
//   1. Vượt đúng BỘI SỐ CHẴN của phí kỳ  -> khách trả gộp nhiều kỳ (LE NÂU ×6 kèm ủy nhiệm chi,
//      NĂM SAO ×3, FUTURE SKY ×2). Phải RẢI ĐỀU ra từng kỳ, tuyệt đối không dồn 1 dòng.
//   2. Vượt LẺ, không chia hết        -> khách trả dư. Ghi đúng phí kỳ, phần dư sang "Nợ tồn cũ".
//   3. Không tra được phí đáng tin     -> chỉ cảnh báo, vẫn cho lưu (xem resolveFeeForMonthWithSource).
//
// VÌ SAO KHÔNG ĐƯỢC DỒN 1 DÒNG: lib/debtRollover.js tra số đã thu theo khoá chính xác
// client_year_month. Khoản gộp lưu vào 1 tháng chỉ điền đúng ô tháng đó; các tháng còn lại vẫn
// là 0 nên (a) %-KPI của chúng = 0% dù tiền đã về, (b) qua hạn 10 ngày `ensureRollovers` tự ghi
// chúng thành "Nợ tồn cũ" -> SINH NỢ ẢO cho khoản tiền đã thu. Đây đúng lớp bug đã từng xảy ra
// thật trên production (13 công ty bị ghi sai other_debt).

// Sai số cho phép khi xét "có phải bội số chẵn không" — tiền VND làm tròn tới đồng, nhưng phí
// tách VAT (chia 1.08) có thể lệch vài đồng, nên không so bằng ===.
const EPS = 2

export const CAP_OK = 'ok'                 // Hợp lệ, cứ lưu
export const CAP_UNVERIFIABLE = 'unverifiable' // Không tra được phí đáng tin -> cảnh báo, vẫn lưu
export const CAP_SPLIT = 'split'           // Vượt đúng bội số chẵn -> đề nghị rải đều ra N kỳ
export const CAP_EXCESS = 'excess'         // Vượt lẻ -> đề nghị tách phần dư sang Nợ tồn cũ

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// paidPeriods: Set các khoá `year*12+month` mà công ty ĐÃ có ghi nhận thu, dùng để gợi ý đúng
// những kỳ còn trống khi rải đều. Truyền Set rỗng nếu chưa cần gợi ý.
export function evaluateCap({ amount, fee, reliable, year, month, paidPeriods = new Set(), label = 'phí' }) {
  const amt = Number(amount) || 0
  const f = Number(fee) || 0

  if (f <= 0) return { kind: CAP_OK }
  if (amt <= f + EPS) return { kind: CAP_OK }

  const periodLabel = 'tháng ' + month + '/' + year

  // Lớp 1 — phí của kỳ này không đáng tin thì KHÔNG chặn, chỉ cảnh báo.
  if (!reliable) {
    return {
      kind: CAP_UNVERIFIABLE,
      message: 'Số tiền lớn hơn mức ' + label + ' tra được cho ' + periodLabel + ' (' + fmt(f) + 'đ), '
        + 'nhưng công ty này chưa có lịch sử phí cho kỳ đó nên không xác minh được — vẫn lưu, '
        + 'anh/chị kiểm tra lại giúp.',
    }
  }

  const ratio = amt / f
  const rounded = Math.round(ratio)
  const isCleanMultiple = rounded >= 2 && Math.abs(amt - rounded * f) <= EPS

  if (isCleanMultiple) {
    return {
      kind: CAP_SPLIT,
      periods: rounded,
      perPeriod: f,
      suggestedPeriods: suggestPeriods(year, month, rounded, paidPeriods),
      message: 'Số tiền này đúng bằng ' + rounded + ' lần ' + label + ' ' + periodLabel
        + ' (' + fmt(f) + 'đ). Nếu khách trả gộp ' + rounded + ' kỳ, hãy ghi thành ' + rounded
        + ' kỳ riêng — ghi dồn vào một tháng sẽ khiến các tháng còn lại bị tính là chưa thu và '
        + 'tự động chuyển thành nợ tồn.',
    }
  }

  return {
    kind: CAP_EXCESS,
    excess: amt - f,
    feeForPeriod: f,
    message: 'Số tiền vượt quá ' + label + ' ' + periodLabel + ' (' + fmt(f) + 'đ). '
      + 'Ghi ' + fmt(f) + 'đ ở mục này, phần dư ' + fmt(amt - f) + 'đ chuyển sang mục "Nợ tồn cũ".',
  }
}

// Gợi ý N kỳ để rải đều: ưu tiên các kỳ CHƯA có ghi nhận thu, tính LÙI từ kỳ đang nhập trở về
// trước (khách thường trả bù các tháng còn nợ). Nếu lùi không đủ thì lấy tiếp tới trước.
export function suggestPeriods(year, month, count, paidPeriods = new Set()) {
  const here = year * 12 + month
  const out = [{ year, month }]
  const toKey = (k) => { const y = Math.floor((k - 1) / 12); return { year: y, month: k - y * 12 } }

  for (let step = 1; out.length < count && step <= 36; step++) {
    const k = here - step
    if (k > 0 && !paidPeriods.has(k)) out.push(toKey(k))
  }
  for (let step = 1; out.length < count && step <= 36; step++) {
    const k = here + step
    if (!paidPeriods.has(k)) out.push(toKey(k))
  }
  return out.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month)).slice(0, count)
}
