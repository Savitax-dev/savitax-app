// Tính danh sách các tháng (số) thuộc 1 kỳ lọc công nợ: tháng / quý / năm.
// period: 'month' | 'quarter' | 'year'
export function getPeriodMonths(period, { month, quarter } = {}) {
  if (period === 'quarter') {
    const q = Number(quarter) || 1
    const start = (q - 1) * 3 + 1
    return [start, start + 1, start + 2]
  }
  if (period === 'year') return [1,2,3,4,5,6,7,8,9,10,11,12]
  return [Number(month) || (new Date().getMonth() + 1)]
}

export function getPeriodLabel(period, year, { month, quarter } = {}) {
  if (period === 'quarter') return 'Quý ' + (Number(quarter) || 1) + '/' + year
  if (period === 'year') return 'Năm ' + year
  return 'T' + (Number(month) || (new Date().getMonth() + 1)) + '/' + year
}
