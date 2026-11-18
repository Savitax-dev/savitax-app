// Phân hệ Pháp lý — số liệu phiếu ĐỀ NGHỊ THANH TOÁN (ĐNTT, mẫu SVT.MB13) — hàm THUẦN, route ho-so/[id]/dntt chỉ vẽ HTML.
// Theo đúng bố cục file Excel phòng pháp lý đang dùng (anh gửi mẫu 01.04.2026_DNTT_TLN_TLM, 18/11/2026):
//   A  số tiền các đợt trước chưa thanh toán
//   B  số tiền đề nghị kỳ này — liệt kê TỪNG khoản: B1, B2… phí dịch vụ (CHƯA VAT) · "VAT 8%" · từng khoản thu hộ (không VAT)
//   (trừ phần khách đã trả của chính kỳ này, nếu có)
//   C = A + B   ·   D số tiền thanh toán kỳ này (để trống)   ·   E số tiền còn lại (để trống)
// Phí lưu GỒM VAT → mỗi khoản dịch vụ tách ÷1,08, dòng VAT = phần còn lại để cộng lại ĐÚNG số đã thoả thuận.
//
// Phạm vi:  { dot: <installment_id> }  một đợt  ·  { pham_vi: 'den_han' }  gộp các đợt đã đến hạn còn nợ
//           { pham_vi: 'toan_bo' } (mặc định) toàn bộ phí của hồ sơ trừ phần đã thu — dùng khi CHƯA lập lịch thu theo đợt
//           (trước 18/11/2026 hồ sơ chưa có đợt thì không xuất được ĐNTT — pháp lý báo "chưa có phần xuất ĐNTT").

const VAT = 1.08
const so = v => Number(v) || 0

// khoản dịch vụ gồm VAT → [{ ten, tien (chưa VAT) }] + vat (tổng các khoản − tổng chưa VAT)
function tachVat(ds) {
  const dong = ds.filter(x => so(x.tien) > 0).map(x => ({ ten: x.ten, tien: Math.round(so(x.tien) / VAT) }))
  const tong = ds.reduce((a, x) => a + Math.max(0, so(x.tien)), 0)
  return { dong, vat: tong - dong.reduce((a, x) => a + x.tien, 0), tong }
}

// fees: legal_case_fees [{ kind, name, amount }] · tien: tongHopHoSo(...)
export function soLieuDntt({ fees = [], tien, dot = null, phamVi = 'toan_bo', tenThuTuc = 'thủ tục' }) {
  const dots = tien.dots || []
  const phiDv = fees.filter(f => f.kind === 'dich_vu'), phiTh = fees.filter(f => f.kind === 'thu_ho')
  let A = 0, dvDs = [], thDs = [], daTra = 0, tenKy

  if (dot) {
    const k = dots.find(x => x.id === dot)
    if (!k) return null
    tenKy = k.name || `Đợt ${k.seq}`
    A = dots.filter(x => x.id !== dot && x.da_den_han && x.con > 0 && so(x.seq) < so(k.seq)).reduce((a, x) => a + x.con, 0)
    // đợt thu TOÀN BỘ phí (một đợt duy nhất / đợt gom đủ) → liệt kê từng khoản như bản phòng; đợt chia nhỏ → một dòng mỗi loại
    const caBo = so(k.amount_dich_vu) === tien.phi_dich_vu && so(k.amount_thu_ho) === tien.phi_thu_ho
    if (caBo) {
      dvDs = phiDv.map(f => ({ ten: f.name, tien: f.amount }))
      thDs = phiTh.map(f => ({ ten: f.name, tien: f.amount }))
    } else {
      dvDs = [{ ten: `Phí dịch vụ ${tenThuTuc} — ${tenKy}`, tien: k.amount_dich_vu }]
      thDs = [{ ten: `Thu hộ (lệ phí, chi phí nộp thay) — ${tenKy}`, tien: k.amount_thu_ho }]
    }
    daTra = so(k.da_thu)
  } else if (phamVi === 'den_han') {
    const ky = dots.filter(x => x.da_den_han && x.con > 0)
    tenKy = 'Các đợt đã đến hạn'
    dvDs = [{ ten: `Phí dịch vụ ${tenThuTuc} — ${ky.map(x => x.name || 'Đợt ' + x.seq).join(', ') || 'các đợt đến hạn'}`, tien: ky.reduce((a, x) => a + Math.max(0, x.con_dich_vu), 0) }]
    thDs = [{ ten: 'Thu hộ (lệ phí, chi phí nộp thay)', tien: ky.reduce((a, x) => a + Math.max(0, x.con_thu_ho), 0) }]
  } else {
    tenKy = 'Toàn bộ hồ sơ'
    dvDs = phiDv.map(f => ({ ten: f.name, tien: f.amount }))
    thDs = phiTh.map(f => ({ ten: f.name, tien: f.amount }))
    daTra = so(tien.da_thu)
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
