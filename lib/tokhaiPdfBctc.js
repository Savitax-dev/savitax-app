// PDF BÁO CÁO TÀI CHÍNH năm (TT200/2014, maTKhai 402 — gói MISA / HTKK) ĐÚNG MẪU cổng thuế: B01-DN Bảng cân đối kế toán (doanh
// nghiệp hoạt động liên tục), B02-DN Kết quả hoạt động kinh doanh, B03-DN Lưu chuyển tiền tệ (phương pháp trực tiếp).
// Bản gốc để chép: cổng in ca TEN NOODLES năm 2025 (anh gửi 21/11/2026) — 4 + 2 + 2 trang, mỗi báo cáo đánh số riêng.
// Tên chỉ tiêu + kiểu chữ từng ô (đậm / thường — KHÔNG theo quy luật: "VI.07" đậm mà "VI.09" thường) TRÍCH TỰ ĐỘNG từ chính
// bản cổng in (gom chữ theo đường kẻ hàng, đoán kiểu chữ theo bề rộng phông), chép thành bảng cố định dưới đây; số liệu +
// thuyết minh lấy từ XML. Bố cục vẽ bằng bộ biểu chung lib/tokhaiPdfBieu.js.

const HANG_CDKT = [   // 116 hàng: [mã, chỉ tiêu, kiểu chữ chỉ tiêu|mã|thuyết minh|số (t thường · d đậm · n nghiêng)]
  ['100', 'A - TÀI SẢN NGẮN HẠN (100 = 110+ 120 + 130 + 140 + 150)', 'dddd'],
  ['110', 'I. Tiền và các khoản tương đương tiền (110 = 111 + 112)', 'dddd'],
  ['111', '1. Tiền', 'tttt'],
  ['112', '2. Các khoản tương đương tiền', 'tttt'],
  ['120', 'II. Đầu tư tài chính ngắn hạn (120 = 121 + 122 + 123)', 'dddd'],
  ['121', '1. Chứng khoán kinh doanh', 'tttt'],
  ['122', '2. Dự phòng giảm giá chứng khoán kinh doanh (*) (2)', 'tttt'],
  ['123', '3. Đầu tư nắm giữ đến ngày đáo hạn', 'tttt'],
  ['130', 'III. Các khoản phải thu ngắn hạn (130 = 131 + 132 +…+ 137 + 139)', 'dddd'],
  ['131', '1. Phải thu ngắn hạn của khách hàng', 'tttt'],
  ['132', '2. Trả trước cho người bán ngắn hạn', 'tttt'],
  ['133', '3. Phải thu nội bộ ngắn hạn', 'tttt'],
  ['134', '4. Phải thu theo tiến độ kế hoạch hợp đồng xây dựng', 'tttt'],
  ['135', '5. Phải thu về cho vay ngắn hạn', 'tttt'],
  ['136', '6. Phải thu ngắn hạn khác', 'tttt'],
  ['137', '7. Dự phòng phải thu ngắn hạn khó đòi (*)', 'tttt'],
  ['139', '8. Tài sản thiếu chờ xử lý', 'tttt'],
  ['140', 'IV. Hàng tồn kho (140 = 141 + 149)', 'dddd'],
  ['141', '1. Hàng tồn kho', 'tttt'],
  ['149', '2. Dự phòng giảm giá hàng tồn kho (*)', 'tttt'],
  ['150', 'V. Tài sản ngắn hạn khác (150= 151 + 152 + …+ 155)', 'dddd'],
  ['151', '1. Chi phí trả trước ngắn hạn', 'tttt'],
  ['152', '2. Thuế GTGT được khấu trừ', 'tttt'],
  ['153', '3. Thuế và các khoản khác phải thu Nhà nước', 'tttt'],
  ['154', '4. Giao dịch mua bán lại trái phiếu Chính phủ', 'tttt'],
  ['155', '5. Tài sản ngắn hạn khác', 'tttt'],
  ['200', 'B - TÀI SẢN DÀI HẠN (200= 210 + 220 + 230 + 240 + 250 + 260)', 'dddd'],
  ['210', 'I- Các khoản phải thu dài hạn (210 = 211 + 212 +….+ 216 + 219)', 'dddd'],
  ['211', '1. Phải thu dài hạn của khách hàng', 'tttt'],
  ['212', '2. Trả trước cho người bán dài hạn', 'tttt'],
  ['213', '3. Vốn kinh doanh ở đơn vị trực thuộc', 'tttt'],
  ['214', '4. Phải thu nội bộ dài hạn', 'tttt'],
  ['215', '5. Phải thu về cho vay dài hạn', 'tttt'],
  ['216', '6. Phải thu dài hạn khác', 'tttt'],
  ['219', '7. Dự phòng phải thu dài hạn khó đòi (*)', 'tttt'],
  ['220', 'II. Tài sản cố định ( 220 = 221 + 224 + 227)', 'dddd'],
  ['221', '1. Tài sản cố định hữu hình (221 = 222 + 223)', 'ddtd'],
  ['222', '- Nguyên giá', 'tttt'],
  ['223', '- Giá trị hao mòn luỹ kế (*)', 'tttt'],
  ['224', '2. Tài sản cố định thuê tài chính (224 = 225 + 226)', 'ddtt'],
  ['225', '- Nguyên giá', 'tttt'],
  ['226', '- Giá trị hao mòn luỹ kế (*)', 'tttt'],
  ['227', '3. Tài sản cố định vô hình (227 = 228 + 229)', 'ddtt'],
  ['228', '- Nguyên giá', 'tttt'],
  ['229', '- Giá trị hao mòn luỹ kế (*)', 'tttt'],
  ['230', 'III. Bất động sản đầu tư (230 = 231 + 232)', 'dddd'],
  ['231', '- Nguyên giá', 'tttt'],
  ['232', '- Giá trị hao mòn lũy kế (*)', 'tttt'],
  ['240', 'IV. Tài sản dang dở dài hạn (240 = 241 + 242)', 'dddd'],
  ['241', '1. Chi phí sản xuất, kinh doanh dở dang dài hạn', 'tttt'],
  ['242', '2. Chi phí xây dựng cơ bản dở dang', 'tttt'],
  ['250', 'V. Đầu tư tài chính dài hạn (250 = 251 + …+ 255)', 'dddd'],
  ['251', '1. Đầu tư vào công ty con', 'tttt'],
  ['252', '2. Đầu tư vào công ty liên kết, liên doanh', 'tttt'],
  ['253', '3. Đầu tư khác vào đơn vị khác', 'tttt'],
  ['254', '4. Dự phòng đầu tư tài chính dài hạn (*)', 'tttt'],
  ['255', '5. Đầu tư nắm giữ đến ngày đáo hạn', 'tttt'],
  ['260', 'V. Tài sản dài hạn khác (260 = 261 + 262 + 263 + 268)', 'dddd'],
  ['261', '1. Chi phí trả trước dài hạn', 'tttt'],
  ['262', '2. Tài sản thuế thu nhập hoãn lại', 'tttt'],
  ['263', '3. Thiết bị, vật tư, phụ tùng thay thế dài hạn', 'tttt'],
  ['268', '4. Tài sản dài hạn khác', 'tttt'],
  ['270', 'TỔNG CỘNG TÀI SẢN (270 = 100 + 200)', 'dddd'],
  ['300', 'C - NỢ PHẢI TRẢ (300= 310 + 330)', 'dddd'],
  ['310', 'I. Nợ ngắn hạn (310 = 311 + 312 +…+ 323 + 324)', 'dddd'],
  ['311', '1. Phải trả người bán ngắn hạn', 'tttt'],
  ['312', '2. Người mua trả tiền trước ngắn hạn', 'tttt'],
  ['313', '3. Thuế và các khoản phải nộp Nhà nước', 'tttt'],
  ['314', '4. Phải trả người lao động', 'tttt'],
  ['315', '5. Chi phí phải trả ngắn hạn', 'tttt'],
  ['316', '6. Phải trả nội bộ ngắn hạn', 'tttt'],
  ['317', '7. Phải trả theo tiến độ kế hoạch hợp đồng xây dựng', 'tttt'],
  ['318', '8. Doanh thu chưa thực hiện ngắn hạn', 'tttt'],
  ['319', '9. Phải trả ngắn hạn khác', 'tttt'],
  ['320', '10. Vay và nợ thuê tài chính ngắn hạn', 'tttt'],
  ['321', '11. Dự phòng phải trả ngắn hạn', 'tttt'],
  ['322', '12. Quỹ khen thưởng, phúc lợi', 'tttt'],
  ['323', '13. Quỹ bình ổn giá', 'tttt'],
  ['324', '14. Giao dịch mua bán lại trái phiếu Chính phủ', 'tttt'],
  ['330', 'II. Nợ dài hạn (330 = 331 + 332 +…+ 342 + 343)', 'dddd'],
  ['331', '1. Phải trả người bán dài hạn', 'tttt'],
  ['332', '2. Người mua trả tiền trước dài hạn', 'tttt'],
  ['333', '3. Chi phí phải trả dài hạn', 'tttt'],
  ['334', '4. Phải trả nội bộ về vốn kinh doanh', 'tttt'],
  ['335', '5. Phải trả nội bộ dài hạn', 'tttt'],
  ['336', '6. Doanh thu chưa thực hiện dài hạn', 'tttt'],
  ['337', '7. Phải trả dài hạn khác', 'tttt'],
  ['338', '8. Vay và nợ thuê tài chính dài hạn', 'tttt'],
  ['339', '9. Trái phiếu chuyển đổi', 'tttt'],
  ['340', '10. Cổ phiếu ưu đãi', 'tttt'],
  ['341', '11. Thuế thu nhập hoãn lại phải trả', 'tttt'],
  ['342', '12. Dự phòng phải trả dài hạn', 'tttt'],
  ['343', '13. Quỹ phát triển khoa học và công nghệ', 'tttt'],
  ['400', 'D - VỐN CHỦ SỞ HỮU (400 = 410 + 430)', 'dddd'],
  ['410', 'I. Vốn chủ sở hữu (410 = 411 + 412 +…+ 421 + 422)', 'dddd'],
  ['411', '1. Vốn góp của chủ sở hữu (411 = 411a + 411b)', 'dttt'],
  ['411a', '- Cổ phiếu phổ thông có quyền biểu quyết', 'tttt'],
  ['411b', '- Cổ phiếu ưu đãi', 'tttt'],
  ['412', '2. Thặng dư vốn cổ phần', 'tttt'],
  ['413', '3. Quyền chọn chuyển đổi trái phiếu', 'tttt'],
  ['414', '4. Vốn khác của chủ sở hữu', 'tttt'],
  ['415', '5. Cổ phiếu quỹ (*)', 'tttt'],
  ['416', '6. Chênh lệch đánh giá lại tài sản', 'tttt'],
  ['417', '7. Chênh lệch tỷ giá hối đoái', 'tttt'],
  ['418', '8. Quỹ đầu tư phát triển', 'tttt'],
  ['419', '9. Quỹ hỗ trợ sắp xếp doanh nghiệp', 'tttt'],
  ['420', '10. Quỹ khác thuộc vốn chủ sở hữu', 'tttt'],
  ['421', '11. Lợi nhuận sau thuế chưa phân phối (421 =421a + 421b)', 'tttt'],
  ['421a', '- LNST chưa phân phối lũy kế đến cuối kỳ trước', 'tttt'],
  ['421b', '- LNST chưa phân phối kỳ này', 'tttt'],
  ['422', '12. Nguồn vốn đầu tư XDCB', 'tttt'],
  ['430', 'II. Nguồn kinh phí và quỹ khác (430 = 431 + 432)', 'ddtd'],
  ['431', '1. Nguồn kinh phí', 'tttt'],
  ['432', '2. Nguồn kinh phí đã hình thành TSCĐ', 'tttt'],
  ['440', 'TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)', 'dddd'],
]
const HANG_KQ = [   // 21 hàng: [mã, chỉ tiêu, kiểu chữ chỉ tiêu|mã|thuyết minh|số (t thường · d đậm · n nghiêng)]
  ['01', '1. Doanh thu bán hàng và cung cấp dịch vụ', 'tttt'],
  ['02', '2. Các khoản giảm trừ doanh thu', 'tttt'],
  ['10', '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)', 'dddd'],
  ['11', '4. Giá vốn hàng bán', 'tttt'],
  ['20', '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)', 'dddd'],
  ['21', '6. Doanh thu hoạt động tài chính', 'tttt'],
  ['22', '7. Chi phí tài chính', 'tttt'],
  ['23', '- Trong đó: Chi phí lãi vay', 'tttt'],
  ['25', '8. Chi phí bán hàng', 'tttt'],
  ['26', '9. Chi phí quản lý doanh nghiệp', 'tttt'],
  ['30', '10 Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + (21 - 22) - (25 + 26)}', 'dddd'],
  ['31', '11. Thu nhập khác', 'tttt'],
  ['32', '12. Chi phí khác', 'tttt'],
  ['40', '13. Lợi nhuận khác (40 = 31 - 32)', 'dddd'],
  ['50', '14. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)', 'dddd'],
  ['51', '15. Chi phí thuế TNDN hiện hành', 'tttt'],
  ['52', '16. Chi phí thuế TNDN hoãn lại', 'tttt'],
  ['60', '17. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)', 'dddd'],
  ['70', '18. Lãi cơ bản trên cổ phiếu', 'tttt'],
  ['71', '19. Lãi suy giảm trên cổ phiếu', 'tttt'],
]
const HANG_LCTT = [   // 31 hàng: [mã, chỉ tiêu, kiểu chữ chỉ tiêu|mã|thuyết minh|số (t thường · d đậm · n nghiêng)]
  ['', 'I. Lưu chuyển tiền từ hoạt động kinh doanh', 'dddd'],
  ['01', '1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác', 'tttt'],
  ['02', '2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ', 'tttt'],
  ['03', '3. Tiền chi trả cho người lao động', 'tttt'],
  ['04', '4. Tiền lãi vay đã trả', 'tttt'],
  ['05', '5. Thuế thu nhập doanh nghiệp đã nộp', 'tttt'],
  ['06', '6. Tiền thu khác từ hoạt động kinh doanh', 'tttt'],
  ['07', '7. Tiền chi khác cho hoạt động kinh doanh', 'tttt'],
  ['20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh', 'dddd'],
  ['', 'II. Lưu chuyển tiền từ hoạt động đầu tư', 'dddd'],
  ['21', '1.Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác', 'tttt'],
  ['22', '2.Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác', 'tttt'],
  ['23', '3.Tiền chi cho vay, mua các công cụ nợ của đơn vị khác', 'tttt'],
  ['24', '4.Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác', 'tttt'],
  ['25', '5.Tiền chi đầu tư góp vốn vào đơn vị khác', 'tttt'],
  ['26', '6.Tiền thu hồi đầu tư góp vốn vào đơn vị khác', 'tttt'],
  ['27', '7.Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia', 'tttt'],
  ['30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư', 'dddd'],
  ['', 'III. Lưu chuyển tiền từ hoạt động tài chính', 'dddd'],
  ['31', '1.Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu', 'tttt'],
  ['32', '2.Tiền chi trả vốn góp cho các chủ sở hữu, mua lại cổ phiếu của doanh nghiệp đã phát hành', 'tttt'],
  ['33', '3.Tiền thu từ đi vay', 'tttt'],
  ['34', '4.Tiền trả nợ gốc vay', 'tttt'],
  ['35', '5.Tiền trả nợ gốc thuê tài chính', 'tttt'],
  ['36', '6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu', 'tttt'],
  ['40', 'Lưu chuyển tiền thuần từ hoạt động tài chính', 'dddd'],
  ['50', 'Lưu chuyển tiền thuần trong kỳ (50 = 20+30+40)', 'dddd'],
  ['60', 'Tiền và tương đương tiền đầu kỳ', 'dddd'],
  ['61', 'Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ', 'tttt'],
  ['70', 'Tiền và tương đương tiền cuối kỳ (70 = 50+60+61)', 'dddd'],
]

const KIEU = { t: 'thuong', d: 'dam', n: 'nghieng' }
const tachNgay = s => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? { ngay: m[3], thang: m[2], nam: m[1] } : null }

// Dựng được không: chỉ bảng cân đối của doanh nghiệp HOẠT ĐỘNG LIÊN TỤC + phụ lục KQHĐKD / LCTT trực tiếp
export function coTheDungBctc(xml, motKhoi) {
  if (!/<CDKT_HoatDongLienTuc\b/.test(xml)) return { duoc: false, lyDo: 'BCTC: chỉ có mẫu bảng cân đối của doanh nghiệp hoạt động liên tục' }
  const pl = String(motKhoi(xml, 'PLuc') || '').replace(/<PL_KQHDSXKD\b[\s\S]*?<\/PL_KQHDSXKD>/, '').replace(/<PL_LCTTTT\b[\s\S]*?<\/PL_LCTTTT>/, '')
  const thua = [...new Set([...pl.matchAll(/<([A-Za-z][\w.]*)[\s>/]/g)].map(m => m[1]))]
  if (thua.length) return { duoc: false, lyDo: `BCTC: phụ lục ${thua[0]} chưa có bản gốc để dựng` }
  return { duoc: true, mau: ['B01-DN', /<PL_KQHDSXKD\b/.test(xml) && 'B02-DN', /<PL_LCTTTT\b/.test(xml) && 'B03-DN'].filter(Boolean).join(' + ') }
}

export function veBctc({ moiBieu, d, xml, soMau, the, motKhoi, T, D, N, VACH }) {
  const cd = motKhoi(xml, 'CDKT_HoatDongLienTuc')
  const kq = motKhoi(xml, 'PL_KQHDSXKD'), lc = motKhoi(xml, 'PL_LCTTTT')
  const ccHanhNghe = the(cd, 'soChungChiHanhNghe'), dvKeToan = the(cd, 'donViCCapDVuKToan')
  const GC = { t: 'Ghi chú:', k: 'dam_nghieng', gach: true }
  const NGUOI_LAP = [T(' Đối với người lập biểu là các đơn vị dịch vụ kế toán phải ghi rõ Số chứng chỉ hành nghề, tên và địa chỉ Đơn vị cung cấp dịch vụ kế toán. Người lập biểu là cá nhân ghi rõ Số chứng chỉ hành nghề.')]

  // Bảng chỉ tiêu: tiêu đề + hàng số cột + các hàng (mã, chỉ tiêu, kiểu chữ); số cuối/đầu năm hoặc năm nay/năm trước
  const bangChiTieu = (b, cot, dau, hangs, khoi, cotSo) => {
    const tm = motKhoi(khoi, 'ThuyetMinh'), s1 = motKhoi(khoi, cotSo[0]), s2 = motKhoi(khoi, cotSo[1])
    const o = (c, t, k, canh) => ({ c, doan: t ? [[{ t, k }]] : '', canh })
    b.bang(cot, [
      dau.map((t, i) => o(i, t, 'dam', 'giua')),
      dau.map((_, i) => o(i, String(i + 1), 'dam', 'giua')),
      ...hangs.map(([ma, ten, k]) => {
        const [kc, km, kt, ks] = [...k].map(x => KIEU[x])
        const so = khoiSo => (ma ? soMau(the(khoiSo, 'ct' + ma)) : '')
        return [o(0, ten, kc), o(1, ma, km, 'giua'), o(2, ma ? the(tm, 'ct' + ma) : '', kt), o(3, so(s1), ks, 'phai'), o(4, so(s2), ks, 'phai')]
      }),
    ])
  }

  // Khối chữ ký 3 người (đo từ dòng "Lập, ngày" D): bảng cao 30,6 trên D; hết chỗ thì sang trang — phần "dòng trống" 17,5
  // dưới bảng nằm lại trang trước, chỗ tràn (nếu có) dồn xuống trang mới (B03: D = 36,1 thay vì 33,1)
  const kyBa = (b, phanKy, ghiChu) => {
    const nk = tachNgay(the(phanKy, 'ngayLap'))
    const dongGhi = ghiChu.flatMap(p => (p ? b.C.ngat(p, 578.3 - 21, 10, { html: true }) : [null]))
    const cao = 133.08 + (dongGhi.length - 1) * 11.82 + 9 + (d.chuKy ? 17.76 + 2 * 11.8 + 4 : 4)
    const cuoiBang = b.y + 6.48            // bảng HTML của cổng có lề đáy 6,48 sau hàng cuối (đường kẻ 790,56 → 797,04)
    let D0 = cuoiBang + 30.6
    if (D0 + cao > 812) { const tran = Math.max(0, cuoiBang + 17.5 - 812); b.moTrang(); D0 = 33.12 + tran }
    if (nk) b.ve([N(`Lập, ngày ${nk.ngay} tháng ${nk.thang} năm ${nk.nam}`)], 482.4, D0, 'giua')
    b.ve([D('Người lập biểu')], 113.35, D0 + 5.52, 'giua'); b.ve([D('Kế toán trưởng')], 297.6, D0 + 5.52, 'giua')
    b.ve([D('Giám đốc')], 482.6, D0 + 11.76, 'giua')
    b.ve([T('(Ký, họ tên)')], 112.9, D0 + 17.4, 'giua'); b.ve([T('(Ký, họ tên)')], 297.6, D0 + 17.4, 'giua')
    b.ve([N('(Ký, họ tên, đóng dấu)')], 482.6, D0 + 23.64, 'giua')
    b.ve([T(the(phanKy, 'nguoiLapBieu'))], 113.05, D0 + 52.8, 'giua'); b.ve([T(the(phanKy, 'keToanTruong'))], 297.74, D0 + 52.8, 'giua')
    b.ve([T(the(phanKy, 'giamDoc'))], 482.44, D0 + 59.04, 'giua')
    b.ve([D('Số chứng chỉ hành nghề:'), T(ccHanhNghe ? ' ' + ccHanhNghe : '')], 20.9, D0 + 74.04)
    b.ve([D('Đơn vị cung cấp dịch vụ kế toán:'), T(dvKeToan ? ' ' + dvKeToan : '')], 20.9, D0 + 97.68)
    let y = D0 + 133.08
    dongGhi.forEach((dd, j) => { if (j) y += 11.82; if (dd) b.ve(dd, 20.9, y) })
    const vach = y + 9
    b.ke(20.25, vach, 574.5, vach, VACH)
    if (d.chuKy) b.chuKyXanh(vach + 17.76)
  }

  // Ô "Mẫu số" kiểu phụ lục (hẹp, chữ cỡ thường): "Mẫu số: B02" / "– DN" / "(Ban hành" / "theo Thông" …
  const hopPhuLuc = (b, x0, x1, ma, ngay) => b.hopMauSo(x0, x1, 20.88, [
    ...b.C.ngat([T('Mẫu số: '), D(ma)], x1 - x0 - 3, 10),
    ...b.C.ngat([T('('), N(`Ban hành theo Thông tư số 200/2014/TT-BTC ${ngay} 22/12/2014 của Bộ Tài chính`), T(')')], x1 - x0 - 3, 10, { sauGach: true }),
  ].map(doan => ({ doan })), 11.82)

  // ── B01-DN: Bảng cân đối kế toán ──
  {
    const b = moiBieu()
    b.moTrang()
    const TAM = 242.3
    b.ve([D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], TAM, 30.0, 'giua')
    b.ve([D('Độc lập-Tự do-Hạnh phúc')], TAM, 41.76, 'giua')
    b.ve([T('-------------------------')], TAM, 53.64, 'giua')
    b.ve([D('BẢNG CÂN ĐỐI KẾ TOÁN (NĂM)')], TAM, 66.72, 'giua')
    b.ve([N('(Áp dụng cho doanh nghiệp đáp ứng giả định hoạt động liên tục)')], TAM, 81.6, 'giua')
    const den = String(d.denNgay || '').split('/')
    if (den.length === 3) b.ve([T(`Tại ngày ${den[0]} tháng ${den[1]} năm ${den[2]}`)], TAM, 94.68, 'giua')
    b.hopMauSo(465.2, 557.95, 20.04, [
      { doan: [T('Mẫu số: '), D('B 01 – DN')] },
      ...b.C.ngat([N('(Ban hành theo Thông tư số 200/2014/TT-BTC Ngày 22/12/2014 của Bộ Tài chính)')], 90, 7.5).map(doan => ({ doan, co: 7.5 })),
    ], 8.7)
    b.ve([D('[01] Tên người nộp thuế:'), T(' ' + d.ten)], 21, 120.12)
    b.ve([D('[02] Mã số thuế:'), T(' ' + d.mst)], 21, 133.2)
    // Lưới thông tin 3 cột không kẻ (địa chỉ / quận huyện / tỉnh …): ô ít dòng canh giữa theo chiều cao hàng
    const luoi = (yDau, cells) => {
      const ds = cells.map(c => ({ ...c, dong: b.C.ngat(c.doan, c.rong, 10) }))
      const n = Math.max(...ds.map(c => c.dong.length))
      for (const c of ds) c.dong.forEach((dd, j) => b.ve(dd, c.x, yDau + (n - c.dong.length) * 11.88 / 2 + j * 11.88 - (n - c.dong.length ? 0.3 : 0)))
      return yDau + (n - 1) * 11.88
    }
    let y = luoi(146.28, [
      { x: 21, rong: 222, doan: [D('[03] Địa chỉ:'), T(' ' + (d.diaChi || '').replace(/\s+/g, ' ').trim())] },
      { x: 245.64, rong: 64, doan: [D('[04] Quận/Huyện:'), T(d.huyen ? ' ' + d.huyen : '')] },
      { x: 315.96, rong: 140, doan: [D('[05] Tỉnh/Thành phố:'), T(d.tinh ? ' ' + d.tinh : '')] },
    ])
    y = luoi(y + 13.08, [
      { x: 21, rong: 222, doan: [D('[06] Điện thoại:'), T(d.dienThoai ? ' ' + d.dienThoai : '')] },
      { x: 245.64, rong: 64, doan: [D('[07] Fax:'), T(d.fax ? ' ' + d.fax : '')] },
      { x: 315.96, rong: 140, doan: [D('[08] E-mail:'), T(d.email ? ' ' + d.email : '')] },
    ])
    b.ve([D('BCTC đã được kiểm toán:'), T(`  [${the(cd, 'bctcDaKiemToan') === '1' ? 'X' : ''}]`)], 21, y + 13.08)
    b.ve([D('Ý kiến kiểm toán:'), T(the(cd, 'tenYKienKToan') ? ' ' + the(cd, 'tenYKienKToan') : '')], 21, y + 26.16)
    b.ve([T('Đơn vị tính: Đồng Việt Nam')], 573.3, y + 41.04, 'phai')
    b.y = y + 57.6
    bangChiTieu(b, [20.25, 339.1, 374.5, 441.7, 512.0, 574.8], ['TÀI SẢN', 'Mã số', 'Thuyết minh', 'Số cuối năm', 'Số đầu năm'], HANG_CDKT, cd, ['SoCuoiNam', 'SoDauNam'])
    kyBa(b, cd, [[GC],
      [T('(1)   Những chỉ tiêu không có số liệu được miễn trình bày nhưng không được đánh lại “Mã số” chỉ tiêu.')],
      [T('(2)   Số liệu trong các chỉ tiêu có dấu (*) được ghi bằng số âm dưới hình thức ghi trong ngoặc đơn (...).')],
      [T('(3)   Đối với doanh nghiệp có kỳ kế toán năm là năm dương lịch (X) thì “Số cuối năm“ có thể ghi là “31.12.X“; “Số đầu năm“ có thể ghi là “01.01.X“.')],
      [T('(4) Đối với người lập biểu là các đơn vị dịch vụ kế toán phải ghi rõ Số chứng chỉ hành nghề, tên và địa chỉ Đơn vị cung cấp dịch vụ kế toán. Người lập biểu là cá nhân ghi rõ Số chứng chỉ hành nghề.')]])
    b.ketThuc()
  }

  // ── B02-DN / B03-DN: khuôn phụ lục ──
  const phuLuc = (khoi, { tam, tieuDe, phu, yKy, hop, ma, ngay, cot, hangs, ghiChu }) => {
    if (!khoi) return
    const b = moiBieu()
    b.moTrang()
    b.ve([D('PHỤ LỤC')], tam, 30.0, 'giua')
    b.ve([D(tieuDe)], tam, 43.08, 'giua')
    if (phu) b.ve([N(phu)], tam, 57.36, 'giua')
    b.ve([D('[01]'), T(' Kỳ tính thuế: ' + d.kyChu)], tam, yKy, 'giua')
    hopPhuLuc(b, hop[0], hop[1], ma, ngay)
    b.ve([D('[02] Tên người nộp thuế:'), T(' ' + d.ten)], 20.9, 153.12)
    b.ve([D('[03]'), T(' Mã số thuế: ' + d.mst)], 20.9, 166.2)
    b.y = 169.56
    bangChiTieu(b, cot, ['Chỉ tiêu', 'Mã số', 'Thuyết minh', 'Năm nay', 'Năm trước'], hangs, khoi, ['NamNay', 'NamTruoc'])
    kyBa(b, motKhoi(khoi, 'PhanKy'), ghiChu)
    b.ketThuc()
  }
  phuLuc(kq, { tam: 201.8, tieuDe: 'BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH', yKy: 99.0, hop: [385.08, 443.04], ma: 'B 02 – DN', ngay: 'Ngày',
    cot: [20.25, 358.3, 391.3, 454.2, 519.5, 574.3], hangs: HANG_KQ,
    ghiChu: [[T('(*) Chỉ áp dụng tại công ty cổ phần')], null, [GC, ...NGUOI_LAP]] })
  phuLuc(lc, { tam: 191.6, tieuDe: 'BÁO CÁO LƯU CHUYỂN TIỀN TỆ', phu: '(Theo phương pháp trực tiếp) (*)', yKy: 105.24, hop: [364.56, 422.4], ma: 'B 03 – DN', ngay: 'ngày',
    cot: [20.25, 362.75, 393.85, 453.0, 523.9, 574.8], hangs: HANG_LCTT,
    ghiChu: [[GC, ...NGUOI_LAP]] })
}
