// Dựng PDF GIẤY NỘP TIỀN VÀO NGÂN SÁCH NHÀ NƯỚC — Mẫu số 02, Ký hiệu C1-02/NS — từ file XML cổng thuế trả về
// (Phân hệ Tờ khai, anh yêu cầu 04/11/2026). Cổng chỉ cho tải XML (`chungtu.xml`), không có PDF.
//
// Bản gốc để chép: PDF cổng tự in (bộ dựng PD4ML) của GNT TÂN NGUYÊN PHÚC TNCN Q3/2026 anh gửi 04/11/2026.
// Mọi tọa độ dưới đây ĐO TỪ BẢN GỐC (pt, tính từ MÉP TRÊN trang). Bảng của PD4ML vẽ theo điểm ảnh rồi nhân
// 0,6222 (555/892) — các đường kẻ dưới đây quy đổi bằng hệ số đó (hàm X/Y). Đổi gì phải đối chiếu lại bằng
// `node scripts/test-gnt.mjs <gnt.xml> <bản PDF cổng.pdf>` (so từng cụm chữ với bản gốc).
//
// Phông: phần thân kiểu Times (Tinos), bảng + dòng ký kiểu Arial (Arimo) — bên gọi nạp như PDF tờ khai
// (lib/tokhaiPhong.js). Tiêu đề bảng in Arial ĐẬM: app chưa kèm Arimo đậm nên vẽ Arimo thường tô viền
// ('khongChanDam', xem lib/tokhaiPdfMau.js).
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { taoChu, nhungPhong, dungGon, soMau } from './tokhaiPdfMau.js'
import { docGnt, laGnt, soThanhChu } from './gntXml.js'

const W = 595.28, H = 841.89
const hex = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const DEN = rgb(0, 0, 0), XANH_KY = hex('#007f00'), XAM_VACH = hex('#aca899')
const T = t => ({ t, k: 'thuong' }), D = t => ({ t, k: 'dam' }), N = t => ({ t, k: 'nghieng' })
const A = t => ({ t, k: 'khongChan' }), AD = t => ({ t, k: 'khongChanDam' })

// Điểm ảnh PD4ML -> pt (tính từ mép trái / mép trên)
const S = 0.6222
const X = px => 20 + S * px
// Ranh giới 9 cột bảng "Phần dành cho NNT…" (điểm ảnh gốc 0.5, 40.5, 261.5, 341.5, 505.5, 585.5, 665.5, 740.5, 815.5, 891.5)
const COT = [0.5, 40.5, 261.5, 341.5, 505.5, 585.5, 665.5, 740.5, 815.5, 891.5].map(X)
const NET = S   // nét kẻ 1 điểm ảnh

export function coTheDungPdfGnt(xml) {
  if (!laGnt(xml)) return { duoc: false, lyDo: 'không phải giấy nộp tiền' }
  const d = docGnt(xml)
  if (!d.dong.length) return { duoc: false, lyDo: 'giấy nộp tiền không có dòng nộp nào' }
  return { duoc: true, mau: 'C1-02/NS' }
}

export async function dungPdfGnt(xml, phong) {
  const kt = coTheDungPdfGnt(xml)
  if (!kt.duoc) throw new Error('Không dựng PDF: ' + kt.lyDo)
  return await dungGon(phong, (ph, ghi) => veGnt(xml, ph, ghi))
}

async function veGnt(xml, phong, ghi) {
  const d = docGnt(xml)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const F = await nhungPhong(pdf, phong)
  pdf.setTitle(`Giấy nộp tiền ${d.soGnt} - ${d.ten}`)
  pdf.setProducer('App Savitax')
  const C = taoChu(F, ghi)
  const tr = pdf.addPage([W, H])
  const ke = (x0, y0, x1, y1, mau = DEN) => tr.drawLine({ start: { x: x0, y: H - y0 }, end: { x: x1, y: H - y1 }, thickness: NET, color: mau })

  // ── Đầu trang ──
  C.veGiua(tr, [T('Không ghi vào khu vực')], 80.6, 59.2)
  C.veGiua(tr, [T('này')], 80.6, 71.0)
  C.veGiua(tr, [D('GIẤY NỘP TIỀN VÀO NGÂN SÁCH NHÀ NƯỚC')], 279.85, 45.5)
  // GNT tải từ cổng eTax luôn là chuyển khoản (trích tài khoản ngân hàng) — bản cổng in "Chuyển khoản [X]"
  C.veGiua(tr, [T('Tiền mặt [ ] Chuyển khoản [X]')], 279.8, 59.2)
  const nt = String(d.nguyenTe || 'VND').toUpperCase()
  C.ve(tr, [T('Loại tiền:')], 189.2, 72.9)
  C.ve(tr, [T(`VND [${nt === 'VND' ? 'X' : ' '}]`)], 250.0, 72.9)
  C.ve(tr, [T(`USD [${nt === 'USD' ? 'X' : ' '}]`)], 300.3, 72.9)
  C.ve(tr, [T(nt !== 'VND' && nt !== 'USD' ? `Khác: ${nt}` : 'Khác:....')], 341.8, 72.9)
  C.veGiua(tr, [N('(Đánh dấu X vào ô tương ứng)')], 279.95, 86.6)

  const PHAI = 496.6
  C.veGiua(tr, [D('Mẫu số 02')], PHAI, 30.0)
  C.veGiua(tr, [D('Ký hiệu: C1-02/NS')], PHAI, 41.8)
  C.veGiua(tr, [T(`Mã hiệu: ${d.maHieu || '............'}`)], PHAI, 53.6)
  C.veGiua(tr, [T('Số:  ' + d.soCtu)], PHAI, 65.4)
  C.veGiua(tr, [T('Số tham chiếu:')], PHAI, 89.1)
  C.veGiua(tr, [T(d.maThamChieu)], PHAI, 100.9)

  // ── Thông tin người nộp / ngân hàng / kho bạc ── cột trái 20,6 → 381,5; cột phải từ 382,1
  // Giới hạn trái 384,5 (không phải 381,5): bản gốc in "Tại cơ quan quản lý thu: … Hồ Chí Minh" tới 381,0 —
  // sát mép 0,5pt (chữ chạm luôn "Mã CQ thu"); Tinos đo bằng pdf-lib (không tính kerning) rộng hơn phông PD4ML
  // vài phần mười pt, để 381,5 là dòng đó bị ngắt và cả nửa dưới tụt 11,8pt (đo thật 04/11/2026).
  const TRAI = 20.6, CPHAI = 382.1, RONG_TRAI = 384.5 - TRAI, RONG_PHAI = 574.7 - CPHAI
  const DONG = 13.07, DONG_GOI = 11.8
  // Trạng thái tài khoản thu: 7111 = nộp NSNN; 3511 = tạm thu; 8993 = thu hồi hoàn GTGT (chưa có bản gốc
  // cho hai loại sau — đoán theo hệ thống tài khoản kho bạc, gặp thật thì đối chiếu lại)
  const tk = String(d.tkThu || '')
  const o = v => (v ? '[X]' : '[ ]')
  const hang = [
    { trai: ['Người nộp thuế:', d.ten], phai: ['Mã số thuế:', d.mst] },
    { trai: ['Địa chỉ:', d.diaChi] },
    { trai: ['Quận/Huyện:', d.huyen], phai: ['Tỉnh, TP:', d.tinh] },
    { trai: ['Người nộp thay:', d.tenThay], phai: ['Mã số thuế:', d.mstThay] },
    { trai: ['Địa chỉ:', d.diaChiThay] },
    { trai: ['Quận/Huyện:', d.huyenThay], phai: ['Tỉnh, TP:', d.tinhThay] },
    { trai: ['Đề nghị NH (KBNN):', d.nganHang], phai: ['trích TK số:', d.soTk] },
    { trai: ['hoặc thu tiền mặt để nộp NSNN theo:'] },
    { o: [[20.6, `Nộp vào cho NSNN ${o(tk === '7111')}`], [190.7, `TK tạm thu ${o(tk === '3511')}`], [323.9, `TK thu hồi hoàn thuế GTGT ${o(tk === '8993')}`]], co: 9.3, buoc: 12.4 },
    { trai: ['Vào tài Khoản của KBNN:', d.khoBac], phai: ['Tỉnh, TP:', d.tinhKhoBac] },
    { trai: ['Mở tại NHTM ủy nhiệm thu:', d.nganHangUnt] },
    { trai: ['Nộp theo văn bản của cơ quan có thẩm quyền:'] },
    { o: [[20.6, 'Kiểm toán nhà nước [ ]'], [183.0, 'Thanh tra tài chính [ ]']] },
    { o: [[20.6, 'Thanh tra Chính phủ'], [113.2, '[ ]'], [189.5, 'Cơ quan có thẩm quyền khác [ ]']] },
    { trai: ['Tại cơ quan quản lý thu:', d.coQuanThu], phai: ['Mã CQ thu:', d.maCoQuanThu] },
  ]
  const nhanGiaTri = ([nhan, gt]) => [T(nhan + (gt ? ' ' + gt : ''))]
  let y = 137.6, lanDau = true
  for (const h of hang) {
    if (!lanDau) y += h.buoc || DONG
    lanDau = false
    if (h.o) { for (const [x, chu] of h.o) C.ve(tr, [T(chu)], x, y, h.co || 10); continue }
    const dongTrai = C.ngat(nhanGiaTri(h.trai), RONG_TRAI)
    dongTrai.forEach((dd, i) => C.ve(tr, dd, TRAI, y + i * DONG_GOI))
    // Cột phải canh giữa theo chiều cao ô trái (ô trái 2 dòng thì "Mã số thuế" nằm giữa hai dòng)
    if (h.phai) C.ngat(nhanGiaTri(h.phai), RONG_PHAI).forEach((dd, i) => C.ve(tr, dd, CPHAI, y + (dongTrai.length - 1) * DONG_GOI / 2 + i * DONG_GOI))
    y += (dongTrai.length - 1) * DONG_GOI
  }

  // ── Bảng "Phần dành cho NNT ghi khi nộp tiền vào NSNN" ── (cỡ 8,7, Arial)
  const CO_B = 8.7, DONG_B = 10.6
  const T0 = y + 15.23                     // mép trên bảng (gốc: 331,7 → 346,97)
  const doc = (x, y0, y1) => ke(x, y0, x, y1)
  const ngang = (x0, x1, yy) => ke(x0, yy, x1, yy)
  // hàng 1: hai khối tiêu đề lớn
  const y1 = T0 + 21.78
  C.veGiua(tr, [AD('Phần dành cho NNT ghi khi nộp tiền vào NSNN')], (COT[0] + COT[6]) / 2, T0 + 13.33, CO_B)
  C.veGiua(tr, [AD('Phần dành cho NH ủy nhiệm')], (COT[6] + COT[9]) / 2, T0 + 8.43, CO_B)
  C.veGiua(tr, [AD('thu/ NH phối hợp thu/KBNN ghi')], (COT[6] + COT[9]) / 2, T0 + 18.93, CO_B)
  doc(COT[6], T0, y1)
  ngang(COT[0], COT[9], y1)
  // hàng 2: tên cột (ngắt dòng y như bản gốc)
  const y2 = T0 + 64.71, giua2 = T0 + 45.88
  const TEN_COT = [['STT'], ['Số tờ khai/ Số quyết định/ Số', 'thông báo/ Mã định danh hồ sơ', '(ID)'],
    ['Kỳ thuế/', 'Ngày quyết', 'định/ Ngày', 'thông báo'], ['Nội dung các khoản nộp', 'NSNN'], ['Số nguyên', 'tệ'],
    ['Số tiền', 'VND'], ['Mã', 'chương'], ['Mã NDKT', '(TM)'], ['Mã ĐBHC']]
  TEN_COT.forEach((ds, c) => ds.forEach((chu, i) =>
    C.veGiua(tr, [AD(chu)], (COT[c] + COT[c + 1]) / 2, giua2 + (i - (ds.length - 1) / 2) * DONG_B, CO_B)))
  for (let c = 1; c < 9; c++) doc(COT[c], y1, y2)
  ngang(COT[0], COT[9], y2)
  // các dòng nộp
  let top = y2
  d.dong.forEach((r, i) => {
    const noiDung = C.ngat([A(`${r.noiDung} ;${r.ghiChu ? ' ' + r.ghiChu : ''}`)], COT[4] - COT[3] - 1.6, CO_B)
    const soTK = C.ngat([A(r.soToKhai)], COT[2] - COT[1] - 0.8, CO_B)
    const kyT = C.ngat([A(r.kyThue)], COT[3] - COT[2] - 0.8, CO_B)
    const n = Math.max(1, noiDung.length, soTK.length, kyT.length)
    const h = Math.max(13.69, n * 10.575)
    const giua = top + h / 2 + 2.5
    const nhieu = (ds, x) => ds.forEach((dd, j) => C.ve(tr, dd, x, giua + (j - (ds.length - 1) / 2) * DONG_B, CO_B))
    C.veGiua(tr, [A(String(i + 1))], (COT[0] + COT[1]) / 2, giua, CO_B)
    nhieu(soTK, COT[1] + 0.3)
    nhieu(kyT, COT[2] + 0.3)
    nhieu(noiDung, COT[3] + 0.3)
    if (String(d.nguyenTe).toUpperCase() !== 'VND') C.vePhai(tr, [A(soMau(r.soTien))], COT[5] - 0.2, giua, CO_B)
    else C.vePhai(tr, [A(soMau(r.soTien))], COT[6] - 0.2, giua, CO_B)
    C.veGiua(tr, [A(r.maChuong)], (COT[6] + COT[7]) / 2, giua, CO_B)
    C.veGiua(tr, [A(r.maNdkt)], (COT[7] + COT[8]) / 2, giua, CO_B)
    C.veGiua(tr, [A(r.maDbhc)], (COT[8] + COT[9]) / 2, giua, CO_B)
    const day = top + 0.62 + h
    for (let c = 1; c < 9; c++) doc(COT[c], top, day)
    ngang(COT[0], COT[9], day)
    top = day
  })
  // dòng Tổng tiền
  const dayTong = top + 0.62 + 13.69
  C.vePhai(tr, [AD('Tổng tiền')], COT[4] - 0.4, top + 9.62, CO_B)
  C.vePhai(tr, [A(soMau(d.tongTien))], (String(d.nguyenTe).toUpperCase() !== 'VND' ? COT[5] : COT[6]) - 0.2, top + 9.62, CO_B)
  for (let c = 4; c < 9; c++) doc(COT[c], top, dayTong)
  const dayBang = dayTong + 0.62
  // khung ngoài
  doc(COT[0], T0, dayBang); doc(COT[9], T0, dayBang)
  ngang(COT[0], COT[9], T0); ngang(COT[0], COT[9], dayBang)

  // ── Tổng số tiền bằng chữ ──
  const yChu = dayBang + 20.21
  C.ve(tr, [N('Tổng số tiền ghi bằng chữ:')], 20.0, yChu, 9.3)
  C.ngat([N(soThanhChu(d.tongTien))], 574.7 - 127.8, 9.3).forEach((dd, i) => C.ve(tr, dd, 127.8, yChu + i * 11.2, 9.3))

  // ── Bảng "PHẦN KBNN GHI" ──
  const K = dayBang + 34.21
  const k1 = K + 14.3, k2 = K + 25.5, k3 = K + 39.8, kDay = K + 54.77
  const xG = X(120.5), xP = X(596.5)
  C.ve(tr, [AD('PHẦN KBNN GHI')], 22.5, K + 9.6, CO_B)
  C.ve(tr, [A('Mã CQ thu:')], 95.3, K + 22.7, CO_B)
  C.ve(tr, [A('Nợ TK:')], 391.5, K + 22.7, CO_B)
  C.ve(tr, [A('Có TK:')], 391.5, K + 35.2, CO_B)
  C.ve(tr, [A('Mã nguồn NSNN:')], 95.3, K + 50.1, CO_B)
  ngang(COT[0], COT[9], K); ngang(COT[0], COT[9], kDay)
  doc(COT[0], K, kDay); doc(COT[9], K, kDay)
  doc(xG, K, kDay); doc(xP, K, k3)
  ngang(COT[0], COT[9], k1); ngang(xG, COT[9], k2); ngang(xG, COT[9], k3)

  // ── Chữ ký điện tử (vạch xám + 3 dòng xanh) ──
  const yVach = kDay + 19.2
  ke(X(1.5), yVach, COT[9], yVach, XAM_VACH)
  d.ky.forEach((k, i) => {
    const yKy = yVach + 17.8 + i * 26.75          // đường chân chữ dòng "Ký điện tử bởi"
    veDauKy(tr, yKy - 1.2)
    C.ve(tr, [{ t: 'Ký điện tử bởi: ', k: 'khongChan', mau: XANH_KY }, { t: k.ten, k: 'khongChanNghieng', mau: XANH_KY }], 46.8, yKy)
    C.ve(tr, [{ t: `Ngày ký: ${k.luc}.`, k: 'khongChan', mau: XANH_KY }], 46.8, yKy + 11.8)
  })

  C.soTrang([tr])
  return await pdf.save()
}

// Dấu ký điện tử: hai tờ giấy + dấu tích xanh — cùng hình với PDF thông báo chấp nhận (lib/tokhaiPdfMau.js)
function veDauKy(tr, yKy) {
  const giay = (x, yTop) => {
    tr.drawRectangle({ x, y: H - yTop - 15, width: 12, height: 15, color: hex('#f4f4f4'), borderColor: hex('#9a9a9a'), borderWidth: 0.6 })
    for (let k = 0; k < 4; k++) tr.drawLine({ start: { x: x + 2.5, y: H - yTop - 4 - k * 2.6 }, end: { x: x + 9.5, y: H - yTop - 4 - k * 2.6 }, thickness: 0.5, color: hex('#b0b0b0') })
  }
  giay(23.5, yKy - 8); giay(27, yKy - 5)
  tr.drawSvgPath('M 0 6 L 4.5 10.5 L 13 1', { x: 30, y: H - (yKy + 2), borderColor: hex('#2e9e2e'), borderWidth: 3 })
}
