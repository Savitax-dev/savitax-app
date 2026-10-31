// Dựng PDF tờ khai ĐÚNG MẪU cổng thuế từ file XML — Phân hệ Tờ khai (anh yêu cầu 31/10/2026).
//
// Bản gốc để chép: PDF cổng Dịch vụ công tự in từ XML (bộ dựng PD4ML, 2 trang, chữ thật — không phải ảnh)
// anh gửi 31/10/2026 cho 01/GTGT và 05/KK-TNCN (TT80/2021). Mọi tọa độ, cỡ chữ, màu kẻ dưới đây ĐO TỪ
// BẢN GỐC đó (đơn vị pt, tính từ MÉP TRÊN trang); đổi gì phải đối chiếu lại bằng
// scripts/test-tokhai-pdf-mau.mjs (có chế độ so với PDF gốc).
//
// CHỈ dựng các mẫu đã có bản gốc (MAU theo maTKhai). Mẫu khác, hoặc 01/GTGT có PHỤ LỤC (vd phụ lục giảm
// thuế NQ 142/204) → KHÔNG dựng (chưa có bản gốc phụ lục để chép), chỉ giữ XML. Thêm mẫu: xin anh bản PDF
// cổng in của mẫu đó, đo lại như hai mẫu dưới.
//
// Chạy được ở cả Node (script kiểm) và trình duyệt. Phông Tinos (cùng bề rộng chữ Times New Roman như
// bản gốc) do BÊN GỌI nạp: { thuong, dam, nghieng } (lib/tokhaiPhong.js).

import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setTextRenderingMode, TextRenderingMode, setLineWidth, setStrokingColor } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { the, motKhoi, tachNgay } from './tokhaiXml.js'
import { catPhong } from './catPhong.js'

// ── Thước đo của bản gốc ─────────────────────────────────────────────────────
const W = 595.28, H = 841.89
const TREN = 20.25          // mép trên vùng nội dung (bảng sang trang bắt đầu ở đây)
const DAY = 822             // hàng bảng / khối chữ ký không vượt quá đây (tính từ mép trên)
const CO = 10, CO_NHO = 7.5, CO_SO_TRANG = 12
const HANG_1 = 18.64        // hàng bảng một dòng chữ
const DONG_BANG = 11.8      // bước giữa hai dòng chữ trong một ô bảng
const LECH_CHU = 8.78       // từ đỉnh khối chữ (dòng 11,8) tới đường chân chữ dòng đầu (cỡ 10)
const DONG_TT = 13.05       // bước giữa hai dòng thông tin [04]…[15]
const DONG_GOI = 11.8       // dòng ngắt trong cùng một mục thông tin
const DEM = 3.3             // lề chữ trong ô bảng
const NET = 0.62
const hex = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const DEN = hex('#000000'), VIEN_NGOAI = hex('#808080'), VIEN_TRONG = hex('#cccccc'), VIEN_HOP = hex('#ece9d8'), VACH = hex('#aca899')

// ── Chữ: đoạn có kiểu (thường / đậm / nghiêng / đậm nghiêng), ngắt dòng, vẽ ─────
const T = t => ({ t, k: 'thuong' }), D = t => ({ t, k: 'dam' }), N = t => ({ t, k: 'nghieng' })
const NFC = s => String(s ?? '').normalize('NFC')

function taoChu(F, ghi) {
  const font = k => (k === 'dam' ? F.dam : k === 'thuong' ? F.thuong : F.nghieng)
  const rongDoan = (d, co) => font(d.k).widthOfTextAtSize(NFC(d.t), co)
  const rong = (doan, co = CO) => doan.reduce((s, d) => s + rongDoan(d, co), 0)

  // Ngắt các đoạn thành dòng vừa `toiDa`. Ngắt ở khoảng trắng; `sauGach` cho ngắt cả sau dấu '-'
  // (ô "Mẫu số: 05/KK-" / "TNCN" của bản gốc).
  // `dauDong`: bề rộng riêng cho dòng đầu (đoạn văn thụt đầu dòng)
  function ngat(doan, toiDa, co = CO, { sauGach = false, dauDong } = {}) {
    const re = sauGach ? /[^\s-]*-|\S+\s*|\s+/g : /\S+\s*|\s+/g
    const manh = doan.flatMap(d => (NFC(d.t).match(re) || []).map(t => ({ t, k: d.k, gach: d.gach, mau: d.mau })))
    const dong = [[]]
    let x = 0
    for (const m of manh) {
      const w = rongDoan(m, co), wKhongCach = rongDoan({ ...m, t: m.t.trimEnd() }, co)
      const han = dong.length === 1 && dauDong != null ? dauDong : toiDa
      if (x > 0 && x + wKhongCach > han + 0.01) { dong.push([]); x = 0; if (!m.t.trim()) continue }
      dong[dong.length - 1].push(m); x += w
    }
    // bỏ khoảng trắng cuối dòng (không tính vào canh giữa / canh phải)
    return dong.map(ds => {
      const r = ds.map(d => ({ ...d }))
      while (r.length && !r[r.length - 1].t.trim()) r.pop()
      if (r.length) r[r.length - 1].t = r[r.length - 1].t.trimEnd()
      return r
    })
  }

  function ve(trang, doan, x, yTren, co = CO) {
    let cx = x
    for (const d of doan) {
      const t = NFC(d.t)
      if (!t) continue
      if (ghi) for (const ch of t) ghi[d.k === 'dam_nghieng' ? 'nghieng' : d.k].add(ch)
      const y = H - yTren
      // Đậm nghiêng ("Ghi chú:") — Tinos không kèm kiểu này: chữ nghiêng tô thêm nét viền 0,3pt
      // (chế độ tô + viền), chữ vẫn chỉ một lần trong PDF nên chép ra không bị nhân đôi
      if (d.k === 'dam_nghieng') trang.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.FillAndOutline), setLineWidth(0.3), setStrokingColor(DEN))
      trang.drawText(t, { x: cx, y, size: co, font: font(d.k), color: d.mau || DEN })
      if (d.k === 'dam_nghieng') trang.pushOperators(popGraphicsState())
      const w = rongDoan(d, co)
      if (d.gach) trang.drawLine({ start: { x: cx, y: y - 1.3 }, end: { x: cx + w, y: y - 1.3 }, thickness: 0.6, color: DEN })
      cx += w
    }
  }
  const veGiua = (trang, doan, tam, yTren, co = CO) => ve(trang, doan, tam - rong(doan, co) / 2, yTren, co)
  const vePhai = (trang, doan, phai, yTren, co = CO) => ve(trang, doan, phai - rong(doan, co), yTren, co)
  return { rong, ngat, ve, veGiua, vePhai }
}

// ── Số liệu ──────────────────────────────────────────────────────────────────
// 1257040 → '1.257.040'; số âm trong ngoặc như bản gốc: −1257040 → '(1.257.040)'
export function soMau(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const m = s.match(/^(-?)(\d+)(?:[.,](\d+))?$/)
  if (!m) return s
  const nguyen = m[2].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (m[3] && /[1-9]/.test(m[3]) ? ',' + m[3] : '')
  return m[1] && /[1-9]/.test(m[2] + (m[3] || '')) ? `(${nguyen})` : nguyen
}

// Thẻ đầu tiên có giá trị trong danh sách tên (thẻ đại lý thuế đặt tên khác nhau giữa các bản HTKK)
const theNao = (xml, ...ten) => ten.map(t => the(xml, t)).find(Boolean) || ''

function docChung(xml) {
  const tk = motKhoi(xml, 'TKhaiThue'), nnt = motKhoi(xml, 'NNT'), ky = motKhoi(tk, 'KyKKhaiThue')
  const kieu = the(ky, 'kieuKy'), kyK = the(ky, 'kyKKhai')
  const [a, nam] = kyK.split('/')
  const kyChu = kieu === 'Q' ? `Quý ${Number(a)} năm ${nam}` : kieu === 'M' ? `Tháng ${String(a).padStart(2, '0')} năm ${nam}` : kieu === 'Y' ? `Năm ${a}` : kyK
  const soLan = Number(the(tk, 'soLan') || 0)
  const ngay = tachNgay(the(tk, 'ngayKy') || the(tk, 'ngayLapTKhai'))
  const dly = motKhoi(xml, 'DLyThue')
  return {
    maTKhai: the(tk, 'maTKhai'), tenTKhai: the(tk, 'tenTKhai'), moTaBMau: the(tk, 'moTaBMau'),
    kyChu, soLan, nguoiKy: the(tk, 'nguoiKy'),
    ngayKy: ngay ? `Ngày ${ngay.ngay} tháng ${ngay.thang} năm ${ngay.nam}` : '',
    mst: the(nnt, 'mst'), ten: the(nnt, 'tenNNT'), diaChi: the(nnt, 'dchiNNT'),
    huyen: the(nnt, 'tenHuyenNNT'), tinh: the(nnt, 'tenTinhNNT'),
    dienThoai: the(nnt, 'dthoaiNNT'), fax: the(nnt, 'faxNNT'), email: the(nnt, 'emailNNT'),
    dly: {
      ten: theNao(dly, 'tenDLyThue', 'tenDLy'), mst: theNao(dly, 'mstDLyThue', 'mstDLy'),
      soHd: theNao(dly, 'soHDongDLyThue', 'soHopDong', 'soHDong', 'soHD'),
      ngayHd: (n => (n ? `${n.ngay}/${n.thang}/${n.nam}` : ''))(tachNgay(theNao(dly, 'ngayKyHDDLyThue', 'ngayKyHopDong', 'ngayKyHDong', 'ngayHD'))),
      nhanVien: theNao(xml, 'tenNVienDLyThue', 'tenNhanVienDLy', 'tenNVDLy'),
      chungChi: theNao(xml, 'cchiHNghe', 'chungChiHanhNghe', 'soCChiHNghe'),
    },
  }
}

// ── Mẫu 01/GTGT (maTKhai 842, TT80/2021) ─────────────────────────────────────
const GTGT = {
  ma: '01/GTGT',
  hop: { x0: 441.25, x1: 529.25 },          // ô "Mẫu số" bên phải
  trai: 440,                                // vùng tiêu đề bên trái: 20 → trai (canh giữa)
  cot: [20.25, 45.75, 337.5, 390.38, 486.75, 518, 574.5],
  vach: 544,                                // vạch ngang cuối trang chữ ký
  dongKy: (d, c) => [
    [D('[01a]'), T(' Tên hoạt động sản xuất kinh doanh: ' + (the(c, 'ten_NganhNghe') || ''))],
    [D('[01b]'), T(' Kỳ tính thuế: ' + d.kyChu)],
    [D('[02]'), T(` Lần đầu: [${d.soLan ? ' ' : 'X'}] `), D('[03]'), T(` Bổ sung lần thứ: [${d.soLan ? d.soLan : ' '}]`)],
  ],
  thongTin: (d, c) => {
    const h = motKhoi(c, 'Header')
    return [
      { o: [{ x: 21, doan: [D('[04] Tên người nộp thuế: '), T(d.ten)] }] },
      { o: [{ x: 21, doan: [D('[05]'), T(' Mã số thuế: ' + d.mst)] }] },
      { o: [{ x: 21, doan: [D('[06] Tên đại lý thuế (nếu có): '), T(d.dly.ten)] }] },
      { o: [{ x: 21, doan: [D('[07]'), T(' Mã số thuế: ' + d.dly.mst)] }] },
      { o: [{ x: 21, x1: 42, doan: [D('[08]')] }, { x: 42, x1: 372, doan: [T('Hợp đồng đại lý thuế: Số ' + d.dly.soHd)] }, { x: 374, doan: [T('Ngày: ' + d.dly.ngayHd)] }] },
      { o: [{ x: 21, doan: [D('[09]'), T(' Tên đơn vị phụ thuộc/địa điểm kinh doanh của hoạt động sản xuất kinh doanh khác tỉnh nơi đóng trụ sở chính: ' + the(h, 'ct09'))] }] },
      { o: [{ x: 21, doan: [D('[10]'), T(' Mã số thuế đơn vị phụ thuộc/Mã số địa điểm kinh doanh: ' + the(h, 'ct10'))] }] },
      { o: [{ x: 21, doan: [D('[11]'), T(' Địa chỉ nơi có hoạt động sản xuất kinh doanh khác tỉnh nơi đóng trụ sở chính:')] }], sau: 0.95 },
      { o: [{ x: 33, x1: 200, doan: [D('[11a]'), T(' Phường/xã: ' + the(h, 'ct11a_phuongXa_ten'))] },
        { x: 202, x1: 372, doan: [D('[11b]'), T(' Quận/Huyện: ' + the(h, 'ct11b_quanHuyen_ten'))] },
        { x: 374, doan: [D('[11c]'), T(' Tỉnh/Thành phố: ' + the(h, 'ct11c_tinhTP_ten'))] }], sau: 0.95 },
    ]
  },
  dauBang: [{ c: 0, doan: [[D('STT')]] }, { c: 1, doan: [[D('Chỉ tiêu')]] },
    { c: 2, n: 2, doan: [[D('Giá trị hàng hóa, dịch vụ')], [D('(chưa có thuế giá trị gia tăng)')]] },
    { c: 4, n: 2, doan: [[D('Thuế giá trị gia')], [D('tăng')]] }],
  hang: c => {
    const v = ma => soMau(the(c, 'ct' + ma))
    const ma = m => ({ ma: `[${m}]` })
    // hàng đủ 4 ô số; hàng chỉ cột giá trị (ô thuế trống gộp); hàng chỉ cột thuế (chữ trải 3 cột)
    const du = (stt, chu, m1, m2, o = {}) => ({ stt, chu, o: [{ c: 2, ...ma(m1) }, { c: 3, so: v(m1) }, { c: 4, ...ma(m2) }, { c: 5, so: v(m2) }], ...o })
    const motGT = (stt, chu, m1, o = {}) => ({ stt, chu, o: [{ c: 2, ...ma(m1) }, { c: 3, so: v(m1) }, { c: 4, n: 2 }], ...o })
    const motThue = (stt, chu, m2, o = {}) => ({ stt, chu, n: 3, o: [{ c: 4, ...ma(m2) }, { c: 5, so: v(m2) }], ...o })
    const nhom = (stt, chu) => ({ stt, chu, n: 5, damStt: true, o: [] })
    const dam = s => [D(s)]
    return [
      { stt: 'A', damStt: true, chu: [D('Không phát sinh hoạt động mua, bán trong kỳ'), T(' (đánh dấu "X")')], o: [{ c: 2, ...ma(21) }, { c: 3, n: 3, giua: the(c, 'ct21') === '1' ? '[X]' : '[]' }] },
      motThue('B', dam('Thuế giá trị gia tăng còn được khấu trừ kỳ trước chuyển sang'), 22, { damStt: true }),
      nhom('C', dam('Kê khai thuế giá trị gia tăng phải nộp ngân sách nhà nước')),
      nhom('I', dam('Hàng hoá, dịch vụ mua vào trong kỳ')),
      du('1', [T('Giá trị và thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào')], 23, 24),
      du('', [T('Trong đó: hàng hóa, dịch vụ nhập khẩu')], '23a', '24a'),
      motThue('2', [T('Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này')], 25),
      nhom('II', dam('Hàng hoá, dịch vụ bán ra trong kỳ')),
      motGT('1', [T('Hàng hóa, dịch vụ bán ra không chịu thuế giá trị gia tăng')], 26),
      du('2', [[T('Hàng hóa, dịch vụ bán ra chịu thuế giá trị gia tăng')], [T('([27]=[29]+[30]+[32]+[32a]; [28]=[31]+[33])')]], 27, 28),
      motGT('a', [T('Hàng hoá, dịch vụ bán ra chịu thuế suất 0%')], 29),
      du('b', [T('Hàng hoá, dịch vụ bán ra chịu thuế suất 5%')], 30, 31),
      du('c', [T('Hàng hoá, dịch vụ bán ra chịu thuế suất 10%')], 32, 33),
      motGT('d', [T('Hàng hoá, dịch vụ bán ra không tính thuế')], '32a'),
      du('3', [[T('Tổng doanh thu và thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra')], [T('([34]=[26]+[27]; [35]=[28])')]], 34, 35),
      motThue('III', dam('Thuế giá trị gia tăng phát sinh trong kỳ ([36]=[35]-[25])'), 36, { damStt: true }),
      nhom('IV', dam('Điều chỉnh tăng, giảm thuế giá trị gia tăng còn được khấu trừ của các kỳ trước')),
      motThue('1', [T('Điều chỉnh giảm')], 37),
      motThue('2', [T('Điều chỉnh tăng')], 38),
      motThue('V', dam('Thuế giá trị gia tăng nhận bàn giao được khấu trừ trong kỳ'), '39a', { damStt: true }),
      nhom('VI', dam('Xác định nghĩa vụ thuế giá trị gia tăng phải nộp trong kỳ:')),
      motThue('1', [dam('Thuế giá trị gia tăng phải nộp của hoạt động sản xuất kinh doanh trong kỳ'), dam('{[40a]=([36]-[22]+[37]-[38]-[39a]) ≥ 0}')], '40a'),
      motThue('2', [dam('Thuế giá trị gia tăng mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt'), dam('động sản xuất kinh doanh cùng kỳ tính thuế ([40b]≤[40a])')], '40b'),
      motThue('3', dam('Thuế giá trị gia tăng còn phải nộp trong kỳ ([40]=[40a]-[40b])'), 40),
      motThue('4', [dam('Thuế giá trị gia tăng chưa khấu trừ hết kỳ này'), dam('{[41]=([36]-[22]+[37]-[38]-[39a]) ≤ 0}')], 41),
      motThue('4.1', dam('Thuế giá trị gia tăng đề nghị hoàn ([42] ≤ [41])'), 42, { damStt: true }),
      motThue('4.2', dam('Thuế giá trị gia tăng còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42])'), 43, { damStt: true }),
    ]
  },
  ghiChu: null,
}

// ── Mẫu 05/KK-TNCN (maTKhai 864, TT80/2021) ──────────────────────────────────
const KK05 = {
  ma: '05/KK-TNCN',
  hop: { x0: 370.4, x1: 442.5 },
  trai: 370,
  cot: [20.25, 45.75, 437.75, 474.38, 516, 574.5],
  vach: 574.5,
  dongKy: d => [
    [D('[01]'), T(' Kỳ tính thuế: ' + d.kyChu)],
    [D('[02]'), T(` Lần đầu: [${d.soLan ? ' ' : 'X'}] `), D('[03]'), T(` Bổ sung lần thứ: [${d.soLan ? d.soLan : ' '}]`)],
  ],
  thongTin: (d, c) => [
    { o: [{ x: 21, doan: [D('[04] Tên người nộp thuế: '), T(d.ten)] }] },
    { o: [{ x: 21, doan: [D('[05]'), T(' Mã số thuế: ' + d.mst)] }] },
    { o: [{ x: 21, x1: 441, doan: [D('[06]'), T('  Địa chỉ: ' + d.diaChi)] }] },
    { o: [{ x: 21, x1: 441, doan: [D('[07]'), T(' Quận/Huyện: ' + d.huyen)] }, { x: 444, doan: [D('[08]'), T(' Tỉnh/Thành phố: ' + d.tinh)] }] },
    { o: [{ x: 21, x1: 441, doan: [D('[09]'), T('  Điện thoại: ' + d.dienThoai)] }, { x: 444, x1: 498, doan: [D('[10]'), T(' Fax: ' + d.fax)] }, { x: 500, doan: [D('[11]'), T(' E-mail: ' + d.email)] }] },
    { o: [{ x: 21, doan: [D('[12] Tên đại lý thuế (nếu có): '), T(d.dly.ten)] }] },
    { o: [{ x: 21, doan: [D('[13]'), T(' Mã số thuế: ' + d.dly.mst)] }] },
    { o: [{ x: 21, x1: 498, doan: [D('[14]'), T('  Hợp đồng đại lý thuế: Số ' + d.dly.soHd)] }, { x: 500, doan: [T('Ngày: ' + d.dly.ngayHd)] }] },
    { o: [{ x: 21, doan: [D('[15]'), T(`  Phân bổ thuế do có đơn vị hạch toán phụ thuộc tại địa bàn cấp tỉnh khác nơi có trụ sở chính: [${the(c, 'ct15') === '1' ? 'X' : ' '}]`)] }], sau: 0.95 },
  ],
  dauBang: [{ c: 0, doan: [[D('STT')]] }, { c: 1, doan: [[D('Chỉ tiêu')]] }, { c: 2, doan: [[D('Mã chỉ')], [D('tiêu')]] },
    { c: 3, doan: [[D('Đơn vị')], [D('tính')]] }, { c: 4, doan: [[D('Số người/Số')], [D('tiền')]] }],
  hang: c => {
    const h = (stt, chu, m, dv, o = {}) => ({ stt, chu, o: [{ c: 2, ma: `[${m}]` }, { c: 3, giua: dv, thuong: true }, { c: 4, so: soMau(the(c, 'ct' + m)) }], ...o })
    const dam = s => [D(s)], thuong = s => [T(s)]
    return [
      h('1', dam('Tổng số người lao động:'), 16, 'Người', { damStt: true, gopStt: 2 }),
      h('', thuong('Trong đó: Cá nhân cư trú có hợp đồng lao động'), 17, 'Người'),
      h('2', dam('Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]'), 18, 'Người', { damStt: true }),
      h('2.1', thuong('Cá nhân cư trú'), 19, 'Người'),
      h('2.2', thuong('Cá nhân không cư trú'), 20, 'Người'),
      h('3', dam('Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21]=[22]+[23]'), 21, 'VNĐ', { damStt: true }),
      h('3.1', thuong('Cá nhân cư trú'), 22, 'VNĐ'),
      h('3.2', thuong('Cá nhân không cư trú'), 23, 'VNĐ'),
      h('3.3', [thuong('Trong đó: Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc'),
        thuong('khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động')], 24, 'VNĐ'),
      h('4', dam('Trong đó tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí'), 25, 'VNĐ', { damStt: true }),
      h('5', dam('Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [26]=[27]+[28]'), 26, 'VNĐ', { damStt: true }),
      h('5.1', thuong('Cá nhân cư trú'), 27, 'VNĐ'),
      h('5.2', thuong('Cá nhân không cư trú'), 28, 'VNĐ'),
      // Bản gốc: số "6" đậm nhưng dòng chữ KHÔNG đậm — giữ y nguyên
      h('6', thuong('Tổng số thuế thu nhập cá nhân đã khấu trừ [29]=[30]+[31]'), 29, 'VNĐ', { damStt: true }),
      h('6.1', thuong('Cá nhân cư trú'), 30, 'VNĐ'),
      h('6.2', thuong('Cá nhân không cư trú'), 31, 'VNĐ'),
      h('6.3', [thuong('Trong đó: Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo'),
        thuong('hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người'), thuong('lao động')], 32, 'VNĐ'),
    ]
  },
  ghiChu: [
    '- Tờ khai này chỉ áp dụng đối với tổ chức, cá nhân phát sinh trả thu nhập từ tiền lương, tiền công cho cá nhân trong tháng/quý, không',
    'phân biệt có phát sinh khấu trừ thuế hay không phát sinh khấu trừ thuế.',
    '- Kỳ khai thuế theo tháng áp dụng đối với tổ chức, cá nhân trả thu nhập có tổng doanh thu bán hàng hóa và cung cấp dịch vụ của năm',
    'trước liền kề trên 50 tỷ đồng hoặc trường hợp tổ chức, cá nhân trả thu nhập lựa chọn khai thuế theo tháng.',
    '- Kỳ khai thuế theo quý áp dụng đối với tổ chức, cá nhân trả thu nhập có tổng doanh thu bán hàng hóa và cung cấp dịch vụ của năm trước',
    'liền kề từ 50 tỷ đồng trở xuống, bao gồm cả tổ chức, cá nhân trả thu nhập không phát sinh doanh thu bán hàng hóa và cung cấp dịch vụ.',
  ],
}

export const MAU = { 842: GTGT, 864: KK05 }

// Có phụ lục thật không (khối PLuc có thẻ con mang dữ liệu)
const coPhuLuc = xml => /<[A-Za-z]/.test(motKhoi(xml, 'PLuc'))

// Dựng được không, và vì sao không — để màn tải file báo rõ.
export function coTheDungPdf(xml) {
  if (!/<HSoThueDTu/.test(String(xml || ''))) return { duoc: false, lyDo: 'không phải tờ khai' }
  const ma = the(motKhoi(xml, 'TKhaiThue'), 'maTKhai')
  const mau = MAU[ma]
  if (!mau) return { duoc: false, lyDo: `chưa có mẫu PDF cho tờ khai mã ${ma || '?'}` }
  if (coPhuLuc(xml)) return { duoc: false, lyDo: `${mau.ma} có phụ lục — chưa có bản gốc phụ lục để dựng` }
  return { duoc: true, mau: mau.ma }
}

// ── Dựng ─────────────────────────────────────────────────────────────────────
export async function dungPdfToKhaiMau(xml, phong) {
  const kt = coTheDungPdf(xml)
  if (!kt.duoc) throw new Error('Không dựng PDF: ' + kt.lyDo)
  return await dungGon(phong, (ph, ghi) => veToKhai(xml, ph, ghi))
}

async function veToKhai(xml, phong, ghi) {
  const d = docChung(xml)
  const mau = MAU[d.maTKhai]
  const ct = motKhoi(xml, 'CTieuTKhaiChinh')

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const F = {
    thuong: await pdf.embedFont(phong.thuong, { subset: false }),
    dam: await pdf.embedFont(phong.dam, { subset: false }),
    nghieng: await pdf.embedFont(phong.nghieng, { subset: false }),
  }
  // ⚠ subset:false — phông đưa vào đây đã được dungGon cắt gọn (lib/catPhong.js); cắt bằng pdf-lib là hỏng chữ
  pdf.setTitle(`${d.tenTKhai} - ${d.kyChu} - ${d.ten}`)
  pdf.setProducer('App Savitax')
  const C = taoChu(F, ghi)
  const trangs = []
  let trang = null
  const moTrang = () => { trang = pdf.addPage([W, H]); trangs.push(trang); return TREN }
  const ke = (x0, y0, x1, y1, mauNet) => trang.drawLine({ start: { x: x0, y: H - y0 }, end: { x: x1, y: H - y1 }, thickness: NET, color: mauNet })
  let y = moTrang()

  // 1. Đầu trang: khối tiêu đề canh giữa vùng trái + ô "Mẫu số" bên phải
  const tamTrai = (20 + mau.trai) / 2
  const dongDau = [[D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], [D('Độc lập-Tự do-Hạnh phúc')], [T('-------------------------')],
    [D(d.tenTKhai.toLocaleUpperCase('vi'))], [N(mau === GTGT
      ? '(Áp dụng đối với người nộp thuế tính thuế theo phương pháp khấu trừ có hoạt động sản xuất kinh doanh)'
      : '(Áp dụng cho tổ chức, cá nhân trả các khoản thu nhập từ tiền lương, tiền công)')],
    ...mau.dongKy(d, ct)]
  const buoc = [12, 12, 13, 13]
  let yb = 30
  dongDau.forEach((doan, i) => {
    if (i) yb += buoc[i - 1] ?? 13
    // dòng "(Áp dụng …)" của 01/GTGT dài sát mép vùng trái (419pt) — chừa 6pt cho khỏi ngắt oan
    const dong = C.ngat(doan, mau.trai - 20 + 6)
    dong.forEach((dd, j) => { if (j) yb += DONG_GOI; C.veGiua(trang, dd, tamTrai, yb) })
  })
  // Ô mẫu số
  // bề rộng ngắt dòng trong ô: bản gốc 01/GTGT ngắt "29 tháng 9 năm 2021 của" / "Bộ trưởng…" (≤ 86,7pt)
  // nhưng giữ "tư số 80/2021/TT-BTC ngày" (84,3pt) trên một dòng
  const { x0, x1 } = mau.hop, tamHop = (x0 + x1) / 2, rongHop = x1 - x0 - 3
  let yh = 32
  C.ngat([T('Mẫu số: '), D(mau.ma)], rongHop, CO, { sauGach: true }).forEach((dd, j) => { if (j) yh += 12; C.veGiua(trang, dd, tamHop, yh) })
  yh += 9
  C.ngat([N(d.moTaBMau || '(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)')], rongHop, CO_NHO)
    .forEach((dd, j) => { if (j) yh += 8.85; C.veGiua(trang, dd, tamHop, yh, CO_NHO) })
  trang.drawRectangle({ x: x0, y: H - (yh + 3), width: x1 - x0, height: yh + 3 - 20.75, borderColor: VIEN_HOP, borderWidth: NET })

  // 2. Thông tin người nộp thuế [04]…: mỗi mục một hàng, ô dài tự ngắt dòng
  for (const r of mau.thongTin(d, ct)) {
    yb += DONG_TT
    const cacO = r.o.map(o => ({ ...o, dong: C.ngat(o.doan, (o.x1 ?? 575) - o.x) }))
    const soDong = Math.max(...cacO.map(o => o.dong.length))
    for (const o of cacO) {
      const lech = (soDong - o.dong.length) * DONG_GOI / 2
      o.dong.forEach((dd, j) => C.ve(trang, dd, o.x, yb + lech + j * DONG_GOI))
    }
    yb += (soDong - 1) * DONG_GOI + (r.sau || 0)
  }
  yb += 14 - 0.95
  C.vePhai(trang, [N('Đơn vị tiền: ' + (mau === GTGT ? 'đồng Việt Nam' : 'Đồng Việt Nam'))], 574.5, yb)
  y = yb + 4.5

  // 3. Bảng chỉ tiêu
  const cot = mau.cot
  const xCot = (c, n = 1) => [cot[c], cot[c + n]]
  // Cao hàng theo số dòng chữ, đo từ bản gốc: 1 dòng 18,64 · 2 dòng 30,45 · 3 dòng 41,0
  const caoHang = soDong => [HANG_1, HANG_1, 30.45, 41.0][soDong] ?? 41.0 + (soDong - 3) * DONG_BANG
  let dauDoan = y   // đỉnh đoạn bảng trên trang hiện tại (để kẻ viền ngoài)
  const dongVienNgoai = yCuoi => {
    ke(cot[0], dauDoan, cot[cot.length - 1], dauDoan, VIEN_NGOAI)
    ke(cot[0], dauDoan, cot[0], yCuoi, VIEN_NGOAI)
    ke(cot[cot.length - 1], dauDoan, cot[cot.length - 1], yCuoi, VIEN_NGOAI)
    ke(cot[0], yCuoi, cot[cot.length - 1], yCuoi, VIEN_NGOAI)
  }
  // Vẽ chữ một ô: các dòng (mảng đoạn) canh giữa theo chiều dọc
  // `ha`: hàng 3 dòng trở lên — bản gốc đặt chữ CẢ HÀNG thấp hơn giữa ô 2pt (05/KK mục 6.3)
  const veO = (dong, xa, xb, yTren, cao, canh, ha = 0) => {
    const y0 = yTren + (cao - dong.length * DONG_BANG) / 2 + ha
    dong.forEach((dd, j) => {
      const yy = y0 + LECH_CHU + j * DONG_BANG
      if (canh === 'giua') C.veGiua(trang, dd, (xa + xb) / 2, yy)
      else if (canh === 'phai') C.vePhai(trang, dd, xb - DEM, yy)
      else C.ve(trang, dd, xa + DEM, yy)
    })
  }
  const khungO = (xa, xb, yTren, cao) => { ke(xa, yTren, xb, yTren, VIEN_TRONG); ke(xa, yTren + cao, xb, yTren + cao, VIEN_TRONG); ke(xa, yTren, xa, yTren + cao, VIEN_TRONG); ke(xb, yTren, xb, yTren + cao, VIEN_TRONG) }

  // Hàng tiêu đề bảng (cao 30,5 — hai dòng chữ)
  const caoDau = 30.5
  for (const o of mau.dauBang) { const [xa, xb] = xCot(o.c, o.n || 1); khungO(xa, xb, y, caoDau); veO(o.doan, xa, xb, y, caoDau, 'giua') }
  y += caoDau

  const dsHang = mau.hang(ct)
  const chuHang = r => (Array.isArray(r.chu[0]) ? r.chu : [r.chu])   // một dòng = mảng đoạn
  for (let i = 0; i < dsHang.length; i++) {
    const r = dsHang[i]
    const xChu = xCot(1, r.n || 1)
    // dòng chữ của bản gốc sát mép phải ô (05/KK mục 3.3 rộng 387pt trong ô 392pt) → chỉ chừa 2pt
    const dongChu = chuHang(r).flatMap(dd => C.ngat(dd, xChu[1] - xChu[0] - 2))
    const cao = caoHang(dongChu.length), ha = dongChu.length >= 3 ? 2 : 0
    // hàng gộp ô STT với hàng sau (05/KK mục 1) — hai hàng phải cùng trang
    let caoNhom = cao
    if (r.gopStt) for (let k = 1; k < r.gopStt; k++) caoNhom += caoHang(chuHang(dsHang[i + k]).length)
    if (y + caoNhom > DAY) { dongVienNgoai(y); y = moTrang(); dauDoan = y }
    // STT
    if (r.gopStt) { khungO(cot[0], cot[1], y, caoNhom); veO([[r.damStt ? D(r.stt) : T(r.stt)]], cot[0], cot[1], y, caoNhom, 'giua') }
    else if (!dsHang[i - 1]?.gopStt) { khungO(cot[0], cot[1], y, cao); if (r.stt) veO([[r.damStt ? D(r.stt) : T(r.stt)]], cot[0], cot[1], y, cao, 'giua', ha) }
    // Chỉ tiêu
    khungO(xChu[0], xChu[1], y, cao); veO(dongChu, xChu[0], xChu[1], y, cao, 'trai', ha)
    // Ô mã / số
    for (const o of r.o) {
      const [xa, xb] = xCot(o.c, o.n || 1)
      khungO(xa, xb, y, cao)
      if (o.ma) veO([[D(o.ma)]], xa, xb, y, cao, 'giua', ha)
      else if (o.so != null) veO([[T(o.so)]], xa, xb, y, cao, 'phai', ha)
      else if (o.giua != null) veO([[T(o.giua)]], xa, xb, y, cao, 'giua', ha)
    }
    y += cao
  }
  dongVienNgoai(y)

  // 4. Cam đoan + chữ ký (+ ghi chú) — một khối, không cắt ngang trang
  const caoKhoi = 22 + (mau.ghiChu ? 137 + 11 + (mau.ghiChu.length - 1) * 12 + 6 : 134)
  if (y + caoKhoi > DAY) y = moTrang()
  const B = y + 22.5
  const TAM = 393
  C.ve(trang, [T('Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về số liệu đã khai./...')], 26, B)
  C.veGiua(trang, [N(d.ngayKy)], TAM, B + 26.5)
  C.ve(trang, [D('NHÂN VIÊN ĐẠI LÝ THUẾ')], 24, B + 45)
  C.veGiua(trang, [D('NGƯỜI NỘP THUẾ hoặc')], TAM, B + 50)
  C.ve(trang, [T('Họ và tên: ' + d.dly.nhanVien)], 24, B + 56)
  C.veGiua(trang, [D('ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ')], TAM, B + 62)
  C.veGiua(trang, [N('(Chữ ký, ghi rõ họ tên; chức vụ và đóng dấu (nếu có)/Ký điện tử)')], TAM, B + 74)
  C.ve(trang, [T('Chứng chỉ hành nghề số: ' + d.dly.chungChi)], 24, B + 80)
  C.veGiua(trang, [T(d.nguoiKy)], TAM - 2, B + 122)
  let yVach = B + 134
  if (mau.ghiChu) {
    C.ve(trang, [{ t: 'Ghi chú: ', k: 'dam_nghieng', gach: true }], 21, B + 137)
    mau.ghiChu.forEach((s, j) => C.ve(trang, [N(s)], 21, B + 148 + j * 12))
    yVach = B + 148 + (mau.ghiChu.length - 1) * 12 + 6
  }
  ke(20.25, yVach, mau.vach, yVach, VACH)

  // 5. Số trang "1/2" giữa chân trang
  trangs.forEach((tr, i) => {
    const s = `${i + 1}/${trangs.length}`
    if (ghi) for (const ch of s) ghi.thuong.add(ch)
    tr.drawText(s, { x: W / 2 - F.thuong.widthOfTextAtSize(s, CO_SO_TRANG) / 2, y: 18, size: CO_SO_TRANG, font: F.thuong, color: DEN })
  })
  return await pdf.save()
}

// Dựng hai lượt: lượt nháp với phông đầy đủ để ghi nhận chữ nào được dùng, rồi cắt phông chỉ còn các chữ đó
// (lib/catPhong.js — giữ nguyên số hiệu nét chữ nên bề rộng, bố cục y hệt) và dựng bản thật. PDF ~0,9 MB → ~100 KB.
async function dungGon(phong, ve) {
  const ghi = { thuong: new Set(), dam: new Set(), nghieng: new Set() }
  await ve(phong, ghi)
  const gon = {}
  for (const k of Object.keys(ghi)) {
    const fk = fontkit.create(phong[k])
    const cap = new Map()
    for (const ch of ghi[k]) {
      const cp = ch.codePointAt(0)
      const g = fk.glyphForCodePoint(cp)
      if (g && g.id) cap.set(cp, g.id)
    }
    gon[k] = catPhong(phong[k], cap)
  }
  return await ve(gon, null)
}

// ── Thông báo CHẤP NHẬN hồ sơ khai thuế điện tử — Mẫu 01-2/TB-TĐT (TT19/2021), maTBao 844 ─────────────
// Chép theo trang thông báo cổng hiển thị (anh in ra PDF 31/10/2026, ca QUANG Q3/2026 — GTGT + TNCN).
// Thông báo TIẾP NHẬN (843) không tải nữa nên không dựng. Trạng thái khác 'Y' (không chấp nhận) chưa có bản
// gốc → không dựng.
const XANH_KY = hex('#007f00')

const cnChuThe = s => String(s || '').match(/(?:^|,)\s*CN=([^,]+)/)?.[1]?.trim() || ''
const gioNgay = s => { const n = tachNgay(s); return n ? `${n.gio} giờ ${n.phut} phút ngày ${n.ngay} tháng ${n.thang} năm ${n.nam}` : '' }
const ngayChuTB = s => { const n = tachNgay(s); return n ? `ngày ${n.ngay} tháng ${n.thang} năm ${n.nam}` : '' }

function docTB(xml) {
  const s = String(xml || '')
  const ky = motKhoi(s, 'CKyDTu'), than = s.replace(/<CKyDTu\b[\s\S]*?<\/CKyDTu>/, '')
  return {
    maTBao: the(than, 'maTBao'), soTBao: the(than, 'soTBao'), ngayTBao: the(than, 'ngayTBao'),
    tenCQT: the(than, 'tenCQT'), tenNNhan: the(than, 'tenNNhan'), trangThai: the(than, 'trangThai'),
    ngayNopThucTe: the(than, 'ngayNopThucTe'), ngayChapNhan: the(than, 'ngayChapNhan'), ngayHoanThanh: the(than, 'ngayHoanThanh'),
    maGiaoDich: the(than, 'maGiaoDichDTu'), duongDan: the(than, 'duongDan') || 'https://dichvucong.gdt.gov.vn',
    hoSo: [...than.matchAll(/<CTietHoSoThue\b[\s\S]*?<\/CTietHoSoThue>/g)].map(([k]) => ({
      ten: the(k, 'tokhai-phuluc'), loai: the(k, 'loaiToKhai'), ky: the(k, 'kyTinhThue'), lan: the(k, 'lanNop'),
    })),
    nguoiKy: cnChuThe(the(ky, 'X509SubjectName')), gioKy: the(ky, 'SigningTime'),
  }
}

export function coTheDungPdfThongBao(xml) {
  if (!/<TBaoThueDTu/.test(String(xml || ''))) return { duoc: false, lyDo: 'không phải thông báo' }
  const tb = docTB(xml)
  if (tb.maTBao !== '844') return { duoc: false, lyDo: `chưa có mẫu PDF cho thông báo mã ${tb.maTBao || '?'}` }
  if (tb.trangThai !== 'Y') return { duoc: false, lyDo: 'thông báo KHÔNG chấp nhận — chưa có bản gốc để dựng' }
  return { duoc: true, mau: '01-2/TB-TĐT' }
}

export async function dungPdfThongBaoMau(xml, phong) {
  const kt = coTheDungPdfThongBao(xml)
  if (!kt.duoc) throw new Error('Không dựng PDF: ' + kt.lyDo)
  return await dungGon(phong, (ph, ghi) => veThongBao(xml, ph, ghi))
}

// Tờ khai hay thông báo đều đi qua đây (màn tải file gọi một hàm)
export function coTheDungPdfMau(xml) {
  return /<TBaoThueDTu/.test(String(xml || '')) ? coTheDungPdfThongBao(xml) : coTheDungPdf(xml)
}
export async function dungPdfMau(xml, phong) {
  return /<TBaoThueDTu/.test(String(xml || '')) ? dungPdfThongBaoMau(xml, phong) : dungPdfToKhaiMau(xml, phong)
}

async function veThongBao(xml, phong, ghi) {
  const tb = docTB(xml)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  // ⚠ subset:false — phông đã được dungGon cắt gọn (lib/catPhong.js)
  const F = {
    thuong: await pdf.embedFont(phong.thuong, { subset: false }),
    dam: await pdf.embedFont(phong.dam, { subset: false }),
    nghieng: await pdf.embedFont(phong.nghieng, { subset: false }),
  }
  pdf.setTitle(`Thông báo chấp nhận ${tb.soTBao} - ${tb.tenNNhan}`)
  pdf.setProducer('App Savitax')
  const C = taoChu(F, ghi)
  const trang = pdf.addPage([W, H])

  // Ô mẫu số (góc phải trên)
  const hop = { x0: 409.5, x1: 574.5, y0: 20, y1: 53 }, tamHop = (hop.x0 + hop.x1) / 2
  C.veGiua(trang, [T('Mẫu số: '), D('01-2/TB-TĐT')], tamHop, 30.9)
  C.veGiua(trang, [N('(Ban hành kèm theo Thông tư số 19/2021/TT-BTC')], tamHop, 40.9, CO_NHO)
  C.veGiua(trang, [N('ngày 18/3/2021 của Bộ trưởng Bộ Tài chính )')], tamHop, 48.9, CO_NHO)
  trang.drawRectangle({ x: hop.x0, y: H - hop.y1, width: hop.x1 - hop.x0, height: hop.y1 - hop.y0, borderColor: VIEN_HOP, borderWidth: 0.75 })

  // Quốc hiệu hai cột
  const n = tachNgay(tb.ngayTBao)
  const TRAI = 104.6, PHAI = 380.6
  C.veGiua(trang, [T('BỘ TÀI CHÍNH')], TRAI, 61.9)
  C.veGiua(trang, [D('CỤC THUẾ')], TRAI, 73.9)
  C.veGiua(trang, [T('_______________')], TRAI, 85.9)
  C.veGiua(trang, [T(`Số: ${tb.soTBao}/TB-TĐT`)], TRAI, 97.9)
  C.veGiua(trang, [D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], PHAI, 61.9)
  C.veGiua(trang, [D('Độc lập - Tự do - Hạnh phúc')], PHAI, 73.9)
  C.veGiua(trang, [T('_______________')], PHAI, 85.9)
  C.veGiua(trang, [N(n ? `Hà Nội, ngày ${n.ngay} tháng ${n.thang} năm ${n.nam}` : 'Hà Nội')], PHAI, 97.9)

  C.veGiua(trang, [D('THÔNG BÁO')], W / 2, 144.9)
  C.veGiua(trang, [D('V/v: Chấp nhận việc nộp hồ sơ khai thuế điện tử')], W / 2, 156.9)
  C.veGiua(trang, [T('_______________')], W / 2, 168.9)

  // Thân thông báo: đoạn thụt đầu dòng (chữ bắt đầu ở 45pt), dòng cách 11,78; một dòng trống giữa các nhóm đoạn
  const TRAI_VB = 20, PHAI_VB = 577, THUT = 45, DONG = 11.78   // bản in giữ "…năm 2026. Ngày" trên một dòng (tới 571pt)
  let y = 191.9 - DONG
  const doan = (chu, { trong = false } = {}) => {
    if (trong) y += DONG
    C.ngat([T(chu)], PHAI_VB - TRAI_VB, CO, { dauDong: PHAI_VB - THUT }).forEach((dd, j) => { y += DONG; C.ve(trang, dd, j ? TRAI_VB : THUT, y) })
  }
  doan('Căn cứ quy định tại Luật Quản lý thuế ngày 13/6/2019;')
  doan('Căn cứ quy định tại Thông tư số 19/2021/TT-BTC ngày 18/3/2021 của Bộ trưởng Bộ Tài chính hướng dẫn giao dịch điện tử trong lĩnh vực thuế.')
  doan(`Căn cứ hồ sơ khai thuế/BCTC/BCAC của ${tb.tenNNhan} gửi tới cơ quan thuế ${tb.tenCQT} đã được cổng thông tin điện tử của CỤC THUẾ thông báo tiếp nhận vào lúc ${gioNgay(tb.ngayChapNhan || tb.ngayNopThucTe)} mã giao dịch điện tử ${tb.maGiaoDich}. Cơ quan thuế thông báo về việc chấp nhận hồ sơ khai thuế/BCTC/BCAC của ${tb.tenNNhan} gửi tới cơ quan thuế ${tb.tenCQT} , cụ thể như sau:`, { trong: true })
  for (const hs of tb.hoSo) {
    doan(`- Tên tờ khai/Phụ lục: ${hs.ten}`)
    doan(`- Loại tờ khai: ${hs.loai}`)
    doan(`- Kỳ tính thuế: ${hs.ky}`)
    doan(`- Lần nộp hoặc lần bổ sung: ${hs.lan}`)
  }
  doan(`Hồ sơ khai thuế (HSKT) của người nộp thuế được cơ quan thuế chấp nhận vào lúc ${gioNgay(tb.ngayHoanThanh)}. Ngày hoàn thành việc nộp HSKT điện tử của NNT là ${ngayChuTB(tb.ngayNopThucTe || tb.ngayChapNhan)}.`)
  doan(`Trường hợp hồ sơ cần giải trình, bổ sung thông tin, tài liệu, cơ quan thuế sẽ có thông báo gửi người nộp thuế. Cơ quan thuế sẽ thực hiện trả kết quả giải quyết hồ sơ cho người nộp thuế qua ${tb.duongDan}`, { trong: true })
  doan('Trường hợp cần biết thêm thông tin chi tiết, NNT vui lòng liên hệ với Cơ quan thuế quản lý trực tiếp để được hỗ trợ.', { trong: true })
  doan('Cơ quan thuế thông báo để NNT biết và thực hiện./.')

  // Vạch + dấu ký điện tử (chữ xanh; cổng dùng phông không chân, app dùng Tinos)
  const yVach = y + 10.3
  trang.drawLine({ start: { x: 20.6, y: H - yVach }, end: { x: 186, y: H - yVach }, thickness: 0.75, color: VACH })
  const yKy = yVach + 17
  // biểu tượng: hai tờ giấy + dấu tích xanh
  const giay = (x, yTop) => {
    trang.drawRectangle({ x, y: H - yTop - 15, width: 12, height: 15, color: hex('#f4f4f4'), borderColor: hex('#9a9a9a'), borderWidth: 0.6 })
    for (let k = 0; k < 4; k++) trang.drawLine({ start: { x: x + 2.5, y: H - yTop - 4 - k * 2.6 }, end: { x: x + 9.5, y: H - yTop - 4 - k * 2.6 }, thickness: 0.5, color: hex('#b0b0b0') })
  }
  giay(23.5, yKy - 8); giay(27, yKy - 5)
  trang.drawSvgPath('M 0 6 L 4.5 10.5 L 13 1', { x: 30, y: H - (yKy + 2), borderColor: hex('#2e9e2e'), borderWidth: 3 })
  C.ve(trang, [{ t: 'Ký điện tử bởi: ', k: 'thuong', mau: XANH_KY }, { t: tb.nguoiKy || 'CỤC THUẾ', k: 'nghieng', mau: XANH_KY }], 47, yKy + 1.2)
  const g = tachNgay(tb.gioKy)
  C.ve(trang, [{ t: `Ngày ký: ${g ? `${g.ngay}/${g.thang}/${g.nam} ${g.gio}:${g.phut}:${g.giay || '00'}` : ''}.`, k: 'thuong', mau: XANH_KY }], 47, yKy + 13)

  if (ghi) for (const ch of '1/1') ghi.thuong.add(ch)
  trang.drawText('1/1', { x: W / 2 - F.thuong.widthOfTextAtSize('1/1', CO_SO_TRANG) / 2, y: 18, size: CO_SO_TRANG, font: F.thuong, color: DEN })
  return await pdf.save()
}
