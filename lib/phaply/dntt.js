// Phân hệ Pháp lý — số liệu phiếu ĐỀ NGHỊ THANH TOÁN (ĐNTT, mẫu SVT.MB13) — hàm THUẦN, route ho-so/[id]/dntt chỉ vẽ HTML.
// Theo đúng bố cục file Excel phòng pháp lý đang dùng (anh gửi mẫu 01.04.2026_DNTT_TLN_TLM, 18/11/2026):
//   A  số tiền các đợt trước chưa thanh toán (chỉ khi nhân viên tick "kèm nợ đợt trước")
//   B  số tiền đề nghị kỳ này — liệt kê TỪNG khoản: B1, B2… phí dịch vụ (CHƯA VAT) · "VAT 8%" · từng khoản thu hộ (không VAT)
//   (trừ phần khách đã trả của chính các khoản được chọn)
//   C = A + B   ·   D số tiền thanh toán kỳ này (để trống)   ·   E số tiền còn lại (để trống)
// Phí lưu GỒM VAT → mỗi khoản dịch vụ tách ÷1,08, dòng VAT = phần còn lại để cộng lại ĐÚNG số đã thoả thuận.
//
// Chọn khoản (18/11/2026 — pháp lý: "cho chọn những khoản thanh toán đơn lẻ, mặc định chọn hết"):
//   dots: [installment_id…]  hồ sơ có lịch thu theo đợt → chọn 1 hay nhiều đợt
//   khoan: [fee_id…]          hồ sơ CHƯA chia đợt → chọn từng khoản phí (bỏ trống = tất cả)
//   kemNoTruoc: cộng dòng A = các đợt ĐÃ đến hạn còn nợ, đứng TRƯỚC đợt được chọn mà không được chọn

const VAT = 1.08
const so = v => Number(v) || 0

function tachVat(ds) {
  const dong = ds.filter(x => so(x.tien) > 0).map(x => ({ ten: x.ten, tien: Math.round(so(x.tien) / VAT) }))
  const tong = ds.reduce((a, x) => a + Math.max(0, so(x.tien)), 0)
  return { dong, vat: tong - dong.reduce((a, x) => a + x.tien, 0), tong }
}

// fees: legal_case_fees [{ id, kind, name, amount }] · tien: tongHopHoSo(...)
export function soLieuDntt({ fees = [], tien, dots = null, khoan = null, kemNoTruoc = false, tenThuTuc = 'thủ tục' }) {
  const dsDot = tien.dots || []
  let A = 0, dvDs = [], thDs = [], daTra = 0, tenKy

  if (dots?.length) {
    const sel = dsDot.filter(x => dots.includes(x.id))
    if (!sel.length) return null
    const tenDot = x => x.name || `Đợt ${x.seq}`
    tenKy = sel.length === dsDot.length ? 'Toàn bộ hồ sơ' : sel.map(tenDot).join(', ')
    if (kemNoTruoc) {
      const dau = Math.min(...sel.map(x => so(x.seq)))
      A = dsDot.filter(x => !dots.includes(x.id) && x.da_den_han && x.con > 0 && so(x.seq) < dau).reduce((a, x) => a + x.con, 0)
    }
    // các đợt chọn gom ĐỦ phí cả hồ sơ → liệt kê từng khoản như bản phòng; chọn một phần → mỗi đợt một dòng dịch vụ + thu hộ
    const caBo = sel.reduce((a, x) => a + so(x.amount_dich_vu), 0) === tien.phi_dich_vu && sel.reduce((a, x) => a + so(x.amount_thu_ho), 0) === tien.phi_thu_ho
    if (caBo) {
      dvDs = fees.filter(f => f.kind === 'dich_vu').map(f => ({ ten: f.name, tien: f.amount }))
      thDs = fees.filter(f => f.kind === 'thu_ho').map(f => ({ ten: f.name, tien: f.amount }))
    } else {
      dvDs = sel.map(x => ({ ten: `Phí dịch vụ ${tenThuTuc} — ${tenDot(x)}`, tien: x.amount_dich_vu }))
      thDs = sel.map(x => ({ ten: `Thu hộ (lệ phí, chi phí nộp thay) — ${tenDot(x)}`, tien: x.amount_thu_ho }))
    }
    daTra = sel.reduce((a, x) => a + so(x.da_thu), 0)
  } else {
    const chon = khoan?.length ? fees.filter(f => khoan.includes(f.id)) : fees
    if (khoan?.length && !chon.length) return null
    const du = chon.length === fees.length
    tenKy = du ? 'Toàn bộ hồ sơ' : chon.map(f => f.name).join(', ')
    dvDs = chon.filter(f => f.kind === 'dich_vu').map(f => ({ ten: f.name, tien: f.amount }))
    thDs = chon.filter(f => f.kind === 'thu_ho').map(f => ({ ten: f.name, tien: f.amount }))
    // tiền khách đã trả không gắn với khoản phí nào → chỉ trừ khi chọn đủ mọi khoản
    daTra = du ? so(tien.da_thu) : 0
  }

  const dv = tachVat(dvDs)
  const th = thDs.filter(x => so(x.tien) > 0).map(x => ({ ten: x.ten, tien: so(x.tien) }))
  const dong = [
    ...dv.dong.map(x => ({ ten: x.ten, tien: x.tien, loai: 'dich_vu' })),
    ...(dv.vat ? [{ ten: 'VAT 8%', tien: dv.vat, loai: 'vat' }] : []),
    ...th.map(x => ({ ten: x.ten, tien: x.tien, loai: 'thu_ho' })),
  ].map((x, i) => ({ ...x, ma: 'B' + (i + 1) }))
  const tongB = dv.tong + th.reduce((a, x) => a + x.tien, 0)
  const B = tongB - daTra
  return { tenKy, A, dong, tongB, daTra, B, C: A + B }
}

// Ngày dd/mm/yyyy giờ VN + n ngày
export function ngayVN(ms, them = 0) {
  return new Date(ms + them * 86400000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
}
