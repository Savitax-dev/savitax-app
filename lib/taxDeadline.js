// Kỳ khai và hạn nộp tờ khai thuế — Phân hệ Tờ khai.
//
// KHÔNG dùng lại lib/deadline.js: hàm đó tính hạn cho CÔNG VIỆC nội bộ và chỉ đẩy khi rơi vào
// Chủ nhật. Hạn nộp thuế phải đẩy qua cả thứ Bảy lẫn ngày lễ, vì cơ quan thuế không nhận.
//
// Căn cứ: Luật Quản lý thuế và Nghị định hướng dẫn (xem docs/phan-he-to-khai-ke-hoach.md).
//   Tháng          → ngày 20 của tháng sau
//   Quý            → ngày cuối cùng của tháng đầu quý sau
//   Năm            → ngày cuối cùng của tháng 1 năm sau
//   Quyết toán năm → ngày cuối cùng của tháng thứ 3 kể từ khi kết thúc năm tài chính
//   Theo lần phát sinh → 10 ngày kể từ ngày phát sinh
//
// Mọi ngày ở đây là NGÀY TRẦN (không giờ), biểu diễn bằng chuỗi 'YYYY-MM-DD' và tính bằng UTC.
// Lý do: Vercel chạy giờ UTC còn Việt Nam +7 — dùng new Date() giờ địa phương thì 6h sáng ngày 20
// ở Việt Nam vẫn đang là ngày 19 trên máy chủ, lệch đúng một ngày ở chỗ nhạy cảm nhất.

const HAI_CHU_SO = n => String(n).padStart(2, '0')

export const toISO = d => `${d.getUTCFullYear()}-${HAI_CHU_SO(d.getUTCMonth() + 1)}-${HAI_CHU_SO(d.getUTCDate())}`
export const fromISO = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)))
const ngay = (y, m, d) => new Date(Date.UTC(y, m - 1, d))
const ngayCuoiThang = (y, m) => new Date(Date.UTC(y, m, 0))   // m tính từ 1; ngày 0 của tháng sau

// ─────────────────────────────────────────────────────────────────────────────
// Đẩy hạn rơi vào thứ Bảy / Chủ nhật / ngày lễ sang ngày làm việc kế tiếp.
// ngayLe: Set các chuỗi 'YYYY-MM-DD' đọc từ bảng tax_holidays.
// ─────────────────────────────────────────────────────────────────────────────
export function dayQuaNgayLamViec(date, ngayLe = new Set()) {
  const d = new Date(date.getTime())
  // Tết có thể nghỉ liền 5-7 ngày nên phải lặp, không chỉ dịch 1-2 hôm. Chặn 30 vòng cho chắc,
  // tránh treo nếu ai đó lỡ nạp cả năm vào bảng ngày lễ.
  for (let i = 0; i < 30; i++) {
    const thu = d.getUTCDay()               // 0 = Chủ nhật, 6 = thứ Bảy
    if (thu !== 0 && thu !== 6 && !ngayLe.has(toISO(d))) return d
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d
}

// ─────────────────────────────────────────────────────────────────────────────
// Hạn nộp GỐC (chưa đẩy) theo loại kỳ.
//   periodKind: 'month' | 'quarter' | 'year' | 'settlement' | 'per_event'
//   periodEnd : ngày cuối kỳ ('YYYY-MM-DD')
// ─────────────────────────────────────────────────────────────────────────────
export function hanNopGoc(periodKind, periodEnd) {
  const end = typeof periodEnd === 'string' ? fromISO(periodEnd) : periodEnd
  const y = end.getUTCFullYear()
  const m = end.getUTCMonth() + 1

  switch (periodKind) {
    case 'month':
      // Ngày 20 tháng sau. Tháng 12 → 20/01 năm sau.
      return m === 12 ? ngay(y + 1, 1, 20) : ngay(y, m + 1, 20)

    case 'quarter': {
      // Ngày cuối tháng đầu quý sau: Q1 → 30/04, Q2 → 31/07, Q3 → 31/10, Q4 → 31/01 năm sau.
      const thangDauQuySau = m + 1
      return thangDauQuySau > 12
        ? ngayCuoiThang(y + 1, thangDauQuySau - 12)
        : ngayCuoiThang(y, thangDauQuySau)
    }

    case 'year':
      // Ngày cuối tháng 1 năm sau.
      return ngayCuoiThang(y + 1, 1)

    case 'settlement':
      // Ngày cuối tháng thứ 3 kể từ khi kết thúc năm tài chính. Năm dương lịch → 31/03 năm sau.
      return ngayCuoiThang(y + (m + 3 > 12 ? 1 : 0), ((m + 3 - 1) % 12) + 1)

    case 'per_event': {
      // 10 ngày kể từ ngày phát sinh.
      const d = new Date(end.getTime())
      d.setUTCDate(d.getUTCDate() + 10)
      return d
    }

    default:
      throw new Error('Loại kỳ không hợp lệ: ' + periodKind)
  }
}

// Hạn nộp THỰC TẾ = hạn gốc đã đẩy qua ngày nghỉ.
export function hanNop(periodKind, periodEnd, ngayLe = new Set()) {
  return toISO(dayQuaNgayLamViec(hanNopGoc(periodKind, periodEnd), ngayLe))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sinh danh sách kỳ trong một năm.
//   reportType: 'monthly' | 'quarterly'  (lấy từ clients.report_type)
// Trả về [{ period_code, period_start, period_end, period_kind }]
// ─────────────────────────────────────────────────────────────────────────────
export function cacKyTrongNam(reportType, year) {
  const ds = []
  if (reportType === 'monthly') {
    for (let m = 1; m <= 12; m++) {
      ds.push({
        period_code: `T${HAI_CHU_SO(m)}.${year}`,
        period_start: toISO(ngay(year, m, 1)),
        period_end: toISO(ngayCuoiThang(year, m)),
        period_kind: 'month',
      })
    }
  } else {
    for (let q = 1; q <= 4; q++) {
      ds.push({
        period_code: `Q${q}.${year}`,
        period_start: toISO(ngay(year, q * 3 - 2, 1)),
        period_end: toISO(ngayCuoiThang(year, q * 3)),
        period_kind: 'quarter',
      })
    }
  }
  return ds
}

// Kỳ quyết toán năm / BCTC.
export function kyQuyetToanNam(year) {
  return {
    period_code: `NAM.${year}`,
    period_start: toISO(ngay(year, 1, 1)),
    period_end: toISO(ngayCuoiThang(year, 12)),
    period_kind: 'settlement',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chuẩn hóa <kyKKhai> trong XML của cổng về period_code của app.
// Cổng ghi: '2/2026' (quý 2), '09/2026' (tháng 9), '2026' (năm).
// Chuỗi '2/2026' vừa có thể là quý 2 vừa có thể là tháng 2 — phải dựa vào loại kỳ của tờ khai
// để phân biệt, nên hàm bắt buộc nhận periodKind chứ không tự đoán.
// ─────────────────────────────────────────────────────────────────────────────
export function chuanHoaKy(kyKKhai, periodKind) {
  if (!kyKKhai) return null
  const s = String(kyKKhai).trim()

  const chiNam = s.match(/^(\d{4})$/)
  if (chiNam) return `NAM.${chiNam[1]}`

  const m = s.match(/^(\d{1,2})\s*\/\s*(\d{4})$/)
  if (!m) return null
  const so = +m[1]
  const nam = m[2]

  if (periodKind === 'quarter') return so >= 1 && so <= 4 ? `Q${so}.${nam}` : null
  if (periodKind === 'month') return so >= 1 && so <= 12 ? `T${HAI_CHU_SO(so)}.${nam}` : null
  if (periodKind === 'settlement' || periodKind === 'year') return `NAM.${nam}`
  return null
}

// Nhãn tiếng Việt để hiện lên màn hình.
export function nhanKy(periodCode) {
  if (!periodCode) return ''
  if (periodCode.startsWith('NAM.')) return `Năm ${periodCode.slice(4)}`
  if (periodCode.startsWith('Q')) return `Quý ${periodCode[1]}/${periodCode.slice(3)}`
  if (periodCode.startsWith('T')) return `Tháng ${periodCode.slice(1, 3)}/${periodCode.slice(4)}`
  return periodCode
}
