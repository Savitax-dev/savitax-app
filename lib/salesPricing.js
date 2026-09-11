// Engine tính phí báo giá Phòng Kinh doanh — chép NGUYÊN từ bản chạy thử đã được Giám đốc chốt
// (app.baogia/02. APP DANG CHAY/app-src.html, hàm computeFees) và tài liệu bàn giao mục 4.
// Hàm thuần, không đụng DB/DOM → dùng chung cho trình duyệt (tính trực tiếp khi gõ), server (tính
// lại lúc lưu để nhân viên không sửa được số) và script kiểm thử.
//
// Thứ tự tính BẮT BUỘC: phí gốc theo chứng từ (vượt bậc → theo doanh thu) → ×1,2 nếu kê khai
// tháng → + phụ thu đi lại → + HCNS nếu có chọn. BCTC năm = 1 tháng phí gốc, KHÔNG vào tổng tháng.

export const SECTORS = {
  tm: { name: 'Thương mại',
        label: 'Thương mại, bán buôn bán lẻ, xuất nhập khẩu',
        tiers: [[0, 1000000, 1000000], [10, 2000000, 2500000], [20, 2500000, 3000000], [30, 3000000, 3500000],
                [40, 3500000, 4000000], [50, 4000000, 4500000], [60, 4500000, 5000000], [70, 5000000, 5500000]] },
  sx: { name: 'Sản xuất – xây dựng',
        label: 'Thi công xây dựng, nội thất, sản xuất, gia công, lắp đặt',
        tiers: [[0, 1000000, 1000000], [10, 2500000, 3000000], [20, 3000000, 3500000], [30, 3500000, 4000000],
                [40, 4000000, 4500000], [50, 4500000, 5000000], [60, 5000000, 5500000]] },
  dv: { name: 'Dịch vụ – ăn uống',
        label: 'Nhà hàng, café, karaoke, quảng cáo, tổ chức sự kiện, tư vấn, dịch vụ khác',
        tiers: [[0, 1000000, 1000000], [10, 2500000, 3000000], [20, 3000000, 3500000], [30, 3500000, 4000000],
                [40, 4000000, 4500000], [50, 4500000, 5000000], [60, 5000000, 5500000], [70, 5500000, 6000000]] },
}

export const REVENUE_TIERS = [
  [0, 4000000, 'Chưa phát sinh doanh thu'],
  [5e9, 7000000, 'Đến 5 tỷ đồng/năm'],
  [10e9, 10000000, 'Trên 5 đến 10 tỷ đồng/năm'],
  [15e9, 12000000, 'Trên 10 đến 15 tỷ đồng/năm'],
  [20e9, 15000000, 'Trên 15 đến 20 tỷ đồng/năm'],
  [25e9, 17000000, 'Trên 20 đến 25 tỷ đồng/năm'],
  [30e9, 20000000, 'Trên 25 đến 30 tỷ đồng/năm'],
]

export const HCNS_PER_HEAD = 200000
export const MISA_YEAR = 2700000
export const PER_INVOICE_OVER = 50000

export const AREA_SURCHARGE = [
  { k: 'none', label: 'Khu vực trung tâm (không phụ thu)', fee: 0 },
  { k: 'a', label: 'Thủ Đức, Quận 2, Quận 7, Quận 9 (cũ)', fee: 200000 },
  { k: 'b', label: 'Nhà Bè, Bình Chánh, Hóc Môn, Củ Chi', fee: 500000 },
]

export const EXTRA_SERVICES = [
  { k: 'nhathau_dk', label: 'Đăng ký mã số thuế nhà thầu', fee: 1500000, unit: 'mã số thuế' },
  { k: 'nhathau_kk', label: 'Kê khai thuế nhà thầu hàng tháng (dưới 5 nhà thầu)', fee: 1000000, unit: 'tháng' },
  { k: 'hoso_bandau', label: 'Hồ sơ pháp lý ban đầu tại Chi cục Thuế', fee: 1500000, unit: 'lần' },
  { k: 'chuyen_quan', label: 'Hồ sơ chuyển quận tại Chi cục Thuế', fee: 2500000, unit: 'lần' },
  { k: 'giaithe_cn', label: 'Hồ sơ giải thể chi nhánh / văn phòng đại diện', fee: 3000000, unit: 'lần' },
  { k: 'giaithe_dn', label: 'Hồ sơ giải thể doanh nghiệp', fee: 4000000, unit: 'lần' },
  { k: 'qt_tncn', label: 'Hồ sơ quyết toán thuế thu nhập cá nhân', fee: 3500000, unit: 'lần' },
  { k: 'bhxh_chedo', label: 'Hồ sơ hưởng chế độ bảo hiểm xã hội', fee: 3500000, unit: 'lần' },
  { k: 'dao_tao', label: 'Đào tạo, hỗ trợ Ban Giám đốc đọc báo cáo tài chính', fee: 5000000, unit: 'buổi' },
  { k: 'bhxh_landau', label: 'Đăng ký BHXH, BHYT, BHTN, công đoàn lần đầu (dưới 5 lao động)', fee: 3000000, unit: 'lần' },
]

export const vnd = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN')
export const money = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('vi-VN') + ' đ'

// Phiếu khảo sát rỗng — mọi trường engine và file Word đọc tới.
export function emptySurvey() {
  return {
    company: '', mst: '', address: '', contact: '', phone: '', email: '',
    sector: 'tm', customs: false, customsCount: '', taxMix: '', software: '', einvoice: '', settled: '',
    revenueYear: 0, invIn: 0, invOut: 0, bankStmt: 0, docs: 0, docsRange: '',
    laborBh: 0, laborNoBh: 0, internalAcc: 0,
    monthlyFiling: false, area: 'none', wantHcns: false, hcnsHeads: 0, wantReview: false,
    extras: [], notes: '',
  }
}

// docs là trường DẪN XUẤT — luôn = HĐ mua vào + HĐ bán ra + sao kê, không cho nhập tay.
export function syncDocs(s) {
  s.docs = Number(s.invIn || 0) + Number(s.invOut || 0) + Number(s.bankStmt || 0)
  return s.docs
}

// Chuẩn hoá phiếu khảo sát nhận từ trình duyệt trước khi tính/lưu: ép kiểu số, bỏ trường lạ,
// tính lại docs. Báo giá cũ chỉ có tổng chứng từ thì dồn vào ô HĐ mua vào để không mất số liệu.
export function normalizeSurvey(input) {
  const base = emptySurvey()
  const s = { ...base }
  const src = input || {}
  for (const k of Object.keys(base)) {
    if (src[k] === undefined || src[k] === null) continue
    const t = typeof base[k]
    if (t === 'number') s[k] = Math.max(0, Math.round(Number(src[k]) || 0))
    else if (t === 'boolean') s[k] = !!src[k]
    else if (Array.isArray(base[k])) s[k] = Array.isArray(src[k]) ? src[k].filter(x => EXTRA_SERVICES.some(e => e.k === x)) : []
    else s[k] = String(src[k])
  }
  if (!SECTORS[s.sector]) s.sector = 'tm'
  if (!AREA_SURCHARGE.some(a => a.k === s.area)) s.area = 'none'
  if (Number(src.docs) > 0 && !s.invIn && !s.invOut && !s.bankStmt) s.invIn = Math.round(Number(src.docs))
  syncDocs(s)
  return s
}

function tierFor(sector, docs, customs) {
  const T = (SECTORS[sector] || SECTORS.tm).tiers
  for (let i = 0; i < T.length; i++) {
    const cap = T[i][0]
    if (i === 0 && docs <= 0) return { fee: T[0][customs ? 2 : 1], from: 0, to: 0, over: false }
    if (cap > 0 && docs <= cap) return { fee: T[i][customs ? 2 : 1], from: (T[i - 1][0] || 0) + 1, to: cap, over: false }
  }
  return { over: true, lastCap: T[T.length - 1][0], lastFee: T[T.length - 1][customs ? 2 : 1] }
}

function revenueTier(rev) {
  if (!rev || rev <= 0) return REVENUE_TIERS[0]
  for (const t of REVENUE_TIERS) { if (t[0] > 0 && rev <= t[0]) return t }
  return null // trên 30 tỷ → thoả thuận
}

export function computeFees(s) {
  const out = { lines: [], optional: [], basis: [], monthly: 0, warnings: [] }
  const docs = Number(s.docs || 0)
  const customs = !!s.customs
  const rev = Number(s.revenueYear || 0)
  const sec = SECTORS[s.sector] || SECTORS.tm

  let base = 0, basisText = ''
  const t = tierFor(s.sector, docs, customs)
  if (!t.over) {
    base = t.fee
    basisText = 'Nhóm ngành ' + sec.name.toLowerCase() + ', ' +
      (t.to === 0 ? 'chưa phát sinh chứng từ' : 'bậc ' + (t.from === 1 ? 'dưới ' : 'từ ' + t.from + ' đến ') + t.to + ' chứng từ/tháng') +
      (customs ? ', có tờ khai hải quan' : ', không có tờ khai hải quan') + '.'
  } else {
    const rt = revenueTier(rev)
    if (rt) {
      base = rt[1]
      basisText = 'Khối lượng ' + vnd(docs) + ' chứng từ/tháng vượt bậc cao nhất của biểu phí theo chứng từ (' +
        t.lastCap + '), nên áp dụng biểu phí trọn gói theo doanh thu — ' + rt[2].toLowerCase() + '.'
      // Chỉ in câu so sánh khi cách "cộng 50.000đ/hoá đơn vượt" ra số CAO hơn — để khách thấy
      // Savitax đã chọn mức có lợi cho họ. Thấp hơn thì không in, tránh tự phản bác giá của mình.
      const perInv = t.lastFee + Math.max(0, docs - t.lastCap) * PER_INVOICE_OVER
      if (perInv > base) {
        out.basis.push('Nếu tính theo cách cộng thêm 50.000 đ mỗi hóa đơn vượt bậc, mức phí sẽ là ' + money(perInv) +
          '/tháng — Savitax chủ động áp dụng biểu phí theo doanh thu để mức phí hợp lý nhất cho Quý Công ty.')
      }
      // Ca thật 2026-09-11: 3.300 chứng từ/tháng mà doanh thu bỏ trống → rơi vào bậc "chưa phát sinh
      // doanh thu" 4.000.000đ, thấp hơn hẳn mức đúng. Chỉ nhắc kiểm tra, KHÔNG đổi cách tính.
      if (rev <= 0) {
        out.warnings.push('Chứng từ vượt bậc cao nhất (' + vnd(docs) + '/tháng) nhưng chưa nhập doanh thu — phí đang tính theo bậc ' +
          '“chưa phát sinh doanh thu”. Kiểm tra lại doanh thu năm của khách trước khi gửi báo giá.')
      }
    } else {
      base = t.lastFee + Math.max(0, docs - t.lastCap) * PER_INVOICE_OVER
      basisText = 'Khối lượng ' + vnd(docs) + ' chứng từ/tháng vượt bậc cao nhất; tính bậc ' + t.lastCap +
        ' cộng thêm 50.000 đ mỗi hóa đơn vượt.'
      out.warnings.push('Doanh thu trên 30 tỷ đồng/năm — biểu phí theo doanh thu ghi “thỏa thuận”, cần Giám đốc duyệt mức phí.')
    }
  }

  if (s.monthlyFiling && base > 0) {
    out.basis.push('Doanh nghiệp kê khai theo tháng nên phí cộng thêm 20% so với kê khai theo quý.')
    base = Math.round(base * 1.2)
  }
  out.lines.push({ label: 'Dịch vụ kế toán – thuế trọn gói', note: basisText, unit: 'tháng', fee: base, key: 'base' })

  const area = AREA_SURCHARGE.find(a => a.k === s.area) || AREA_SURCHARGE[0]
  if (area.fee > 0) out.lines.push({ label: 'Phụ thu chi phí đi lại', note: area.label, unit: 'tháng', fee: area.fee, key: 'area' })

  const heads = Number(s.hcnsHeads || 0)
  if (s.wantHcns && heads > 0) {
    out.lines.push({ label: 'Dịch vụ hành chính nhân sự – tiền lương – BHXH',
      note: heads + ' lao động × ' + money(HCNS_PER_HEAD) + '/người/tháng', unit: 'tháng', fee: heads * HCNS_PER_HEAD, key: 'hcns' })
  } else if (heads > 0) {
    out.optional.push({ label: 'Dịch vụ hành chính nhân sự – tiền lương – BHXH (' + heads + ' lao động)',
      unit: 'tháng', fee: heads * HCNS_PER_HEAD })
  }

  out.monthly = out.lines.reduce((a, l) => a + (l.fee || 0), 0)

  out.lines.push({ label: 'Lập Báo cáo tài chính và quyết toán thuế năm', note: 'Bằng 01 tháng phí dịch vụ kế toán',
    unit: 'năm', fee: base, key: 'bctc', yearly: true })

  if (s.wantReview) out.optional.push({ label: 'Hoàn thiện, rà soát sổ sách kế toán các kỳ trước',
    unit: 'tháng', fee: Math.round(base * 0.8), note: 'Bằng 80% phí dịch vụ kế toán trọn gói' })

  ;(s.extras || []).forEach(k => {
    const x = EXTRA_SERVICES.find(e => e.k === k)
    if (x) out.optional.push({ label: x.label, unit: x.unit, fee: x.fee })
  })

  // Lỗi thật đã xảy ra: một báo giá bị tính 1.000.000đ/tháng thay vì ~3.500.000đ chỉ vì bỏ trống
  // ô số chứng từ. Hai cảnh báo này để không lặp lại.
  if (docs <= 0 && rev <= 0) {
    out.warnings.push('Chưa có số chứng từ và doanh thu nên phí đang tính theo bậc “chưa phát sinh”. ' +
      'Hỏi khách số hóa đơn vào – ra mỗi tháng rồi nhập vào trước khi gửi báo giá.')
  } else if (docs <= 0) {
    out.warnings.push('Chưa có số chứng từ/tháng — đây là căn cứ chính để tính phí. Bổ sung giúp mức phí chính xác.')
  }
  out.basis.unshift(basisText)
  return out
}

// Kết quả cuối cùng của 1 báo giá từ phiếu khảo sát + đề xuất giá. Server gọi hàm này lúc lưu —
// không bao giờ tin con số trình duyệt gửi lên.
export function priceQuote(surveyInput, override) {
  const survey = normalizeSurvey(surveyInput)
  const fees = computeFees(survey)
  const standardMonthly = fees.monthly
  const ovOn = !!(override && override.on)
  const ovAmount = ovOn ? Math.max(0, Math.round(Number(override.amount) || 0)) : null
  return {
    survey,
    fees,
    standardMonthly,
    monthlyFinal: ovOn ? ovAmount : standardMonthly,
    overrideOn: ovOn,
    overrideAmount: ovAmount,
  }
}

// ── Nhãn hiển thị dùng chung ──────────────────────────────────────────────────
export const CONTRACT_STATES = [['draft', 'Chưa gửi'], ['sent', 'Đã gửi HĐ'], ['signed', 'Chốt HĐ']]
export const PRICE_STATES = {
  ok:       { label: 'Đúng biểu phí',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:  { label: 'Chờ Giám đốc duyệt',  cls: 'bg-red-50 text-red-700 border-red-200' },
  approved: { label: 'Giám đốc đã duyệt',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: 'Giám đốc từ chối',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}
// Báo giá được xuất Word gửi khách khi: đúng biểu phí, hoặc Giám đốc đã duyệt mức đề xuất.
export const canExportPrice = status => status === 'ok' || status === 'approved'
