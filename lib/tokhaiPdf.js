// Dựng PDF cho tờ khai và thông báo thuế — Phân hệ Tờ khai, GĐ 6.
//
// VÌ SAO PHẢI TỰ DỰNG: đã dò thật trên cổng Dịch vụ công (scripts/test-dvc-pdf.mjs) — cả 7 giá trị
// `loaiTBao` đều trả về đúng một file XML, hai endpoint 'Xem tài liệu' không cho gì. Cổng KHÔNG
// phát PDF qua đường mình đi được. Bản thông báo PDF mà kế toán đang có là do cổng dựng bằng
// PD4ML phía trong, còn bản tờ khai PDF là kế toán tự in tay từ HTKK (Microsoft Print To PDF,
// 2 trang toàn ảnh, không có một ký tự chữ nào).
//
// NÊN:
//   · Thông báo → dựng lại ĐÚNG Mẫu số 01-2/TB-TĐT (Thông tư 19/2021/TT-BTC). Gửi khách được ngay.
//   · Tờ khai   → dựng TRANG BÌA kèm bảng chỉ tiêu, KHÔNG vẽ lại mẫu tờ khai chính thức. Bản chính
//     thức vẫn là bản kế toán in từ HTKK; vẽ lại mẫu giấy thì mỗi lần Bộ Tài chính đổi mẫu là phải
//     vẽ lại từ đầu, không đáng.
//
// Mọi bản in đều có dòng ghi rõ nguồn gốc ở chân trang: đây là bản in lại từ XML, giá trị pháp lý
// thuộc về file XML có chữ ký số.
//
// Chạy được ở cả Node (script kiểm) và trình duyệt (lúc nhân viên tải file). Phông chữ do BÊN GỌI
// nạp và truyền vào, thư viện này không đọc đĩa.

import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { docThongBaoXml, docToKhaiXml, ngayChu, gioNgayChu, ngaySo } from './tokhaiXml.js'
import { tenChiTieu, coBangChiTieu, laSoNguoi } from './tokhaiChiTieu.js'

const A4 = { rong: 595.276, cao: 841.89 }
const LE = { trai: 56.7, phai: 56.7, tren: 42.5, duoi: 42.5 }  // 2cm / 1.5cm
const RONG = A4.rong - LE.trai - LE.phai

const DEN = rgb(0, 0, 0)
const XAM = rgb(0.42, 0.42, 0.45)
const XAM_NHAT = rgb(0.88, 0.88, 0.9)
const XANH = rgb(0.06, 0.28, 0.52)

const NGUON_GOC = 'Bản in do App Savitax dựng lại từ file XML có chữ ký số của cơ quan thuế. '
  + 'Giá trị pháp lý thuộc về file XML gốc kèm theo.'

// Giữ ĐÚNG như bản thông báo cổng thuế tự in ra, kể cả khi tên cơ quan đã đổi trên giấy tờ khác:
// bản in này để kế toán gửi khách làm bằng chứng đã nộp, nên phải giống bản của cơ quan thuế. Cổng
// đổi mẫu thì sửa hai dòng này.
const TEN_CO_QUAN = 'TỔNG CỤC THUẾ'
const TEN_CO_QUAN_TRONG_CAU = 'Tổng cục Thuế'
const DIA_DANH = 'Hà Nội'

// 232550000 → '232.550.000'
export function soTien(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const m = s.match(/^(-?)(\d+)(?:[.,](\d+))?$/)
  if (!m) return s
  const nguyen = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return m[1] + nguyen + (m[3] ? ',' + m[3] : '')
}

// ── Bút vẽ: quản lý con trỏ dọc, tự sang trang ───────────────────────────────

function taoBut(pdf, F) {
  const cacTrang = []
  let trang = null
  let y = 0

  function sangTrang() {
    trang = pdf.addPage([A4.rong, A4.cao])
    cacTrang.push(trang)
    y = A4.cao - LE.tren
  }

  // Còn đủ chỗ cho `can` điểm nữa không (chừa 30pt cuối trang cho dòng nguồn gốc + số trang).
  function damBaoCho(can) {
    if (!trang || y - can < LE.duoi + 30) sangTrang()
  }

  const rongChu = (chu, font, co) => font.widthOfTextAtSize(String(chu ?? ''), co)

  // Cắt chuỗi thành các dòng vừa bề rộng. Cắt theo khoảng trắng; từ nào dài quá một dòng thì cắt
  // cứng giữa từ (địa chỉ, mã giao dịch dài không có khoảng trắng).
  function catDong(chu, font, co, rong) {
    const tu = String(chu ?? '').split(/\s+/).filter(Boolean)
    if (!tu.length) return ['']
    const ds = []
    let d = ''
    for (const t of tu) {
      const thu = d ? d + ' ' + t : t
      if (rongChu(thu, font, co) <= rong) { d = thu; continue }
      if (d) { ds.push(d); d = '' }
      if (rongChu(t, font, co) <= rong) { d = t; continue }
      let cat = ''
      for (const kt of t) {
        if (rongChu(cat + kt, font, co) > rong) { ds.push(cat); cat = kt }
        else cat += kt
      }
      d = cat
    }
    if (d) ds.push(d)
    return ds
  }

  // Vẽ một dòng đã cắt sẵn. canDeu = dàn đều hai bên (kiểu văn bản hành chính).
  function veMotDong(chu, { x, rong, font, co, mau, canGiua, canPhai, canDeu }) {
    const w = rongChu(chu, font, co)
    if (canDeu) {
      const tu = chu.split(' ').filter(Boolean)
      if (tu.length > 1) {
        const thua = rong - w
        const khe = thua / (tu.length - 1)
        let cx = x
        for (const t of tu) {
          trang.drawText(t, { x: cx, y, size: co, font, color: mau })
          cx += rongChu(t, font, co) + rongChu(' ', font, co) + khe
        }
        return
      }
    }
    const cx = canGiua ? x + (rong - w) / 2 : canPhai ? x + rong - w : x
    trang.drawText(chu, { x: cx, y, size: co, font, color: mau })
  }

  const but = {
    get y() { return y },
    set y(v) { y = v },
    get trang() { return trang },
    cacTrang,
    sangTrang,
    rongChu,
    catDong,

    cach(pt) { damBaoCho(pt); y -= pt },

    // Một đoạn văn: tự cắt dòng, tự sang trang giữa đoạn.
    doan(chu, opt = {}) {
      const {
        font = F.thuong, co = 12, mau = DEN, thut = 0, canGiua, canPhai, canDeu,
        x = LE.trai, rong = RONG, caoDong = co * 1.45, cachTruoc = 0, cachSau = 0,
      } = opt
      if (cachTruoc) but.cach(cachTruoc)
      const ds = catDong(chu, font, co, rong - thut)
      ds.forEach((d, i) => {
        damBaoCho(caoDong)
        y -= co
        const cuoi = i === ds.length - 1
        veMotDong(d, {
          x: x + (i === 0 ? thut : 0),
          rong: rong - (i === 0 ? thut : 0),
          font, co, mau, canGiua, canPhai,
          canDeu: canDeu && !cuoi,
        })
        y -= caoDong - co
      })
      if (cachSau) but.cach(cachSau)
      return ds.length
    },

    // Dòng đơn, không cắt — dùng cho nhãn, tiêu đề ngắn.
    dong(chu, opt = {}) {
      const { font = F.thuong, co = 12, mau = DEN, canGiua, canPhai, x = LE.trai, rong = RONG, caoDong = co * 1.45 } = opt
      damBaoCho(caoDong)
      y -= co
      veMotDong(String(chu ?? ''), { x, rong, font, co, mau, canGiua, canPhai })
      y -= caoDong - co
    },

    ke({ x = LE.trai, rong = RONG, day = 0.6, mau = XAM_NHAT, cachTruoc = 0, cachSau = 0 } = {}) {
      if (cachTruoc) but.cach(cachTruoc)
      damBaoCho(day + 1)
      trang.drawLine({ start: { x, y }, end: { x: x + rong, y }, thickness: day, color: mau })
      if (cachSau) but.cach(cachSau)
    },

    // Hàng 'Nhãn: giá trị' — giá trị dài thì tự xuống dòng thẳng cột.
    hangNhan(nhan, gia, { rongNhan = 132, co = 11, caoDong = co * 1.42 } = {}) {
      const giaChu = String(gia ?? '').trim() || '—'
      const ds = catDong(giaChu, F.thuong, co, RONG - rongNhan)
      damBaoCho(caoDong * ds.length)
      const yDau = y
      ds.forEach((d, i) => {
        y -= co
        if (i === 0) trang.drawText(nhan, { x: LE.trai, y: yDau - co, size: co, font: F.thuong, color: XAM })
        trang.drawText(d, { x: LE.trai + rongNhan, y, size: co, font: F.dam, color: DEN })
        y -= caoDong - co
      })
    },
  }

  sangTrang()
  return but
}

// Chân trang: dòng nguồn gốc + số trang. Gọi SAU khi vẽ hết, vì lúc đó mới biết tổng số trang.
function veChanTrang(but, F) {
  const tong = but.cacTrang.length
  but.cacTrang.forEach((tr, i) => {
    tr.drawText(NGUON_GOC, {
      x: LE.trai, y: LE.duoi + 11, size: 7.5, font: F.nghieng, color: XAM,
      maxWidth: RONG - 40,
    })
    const so = `${i + 1}/${tong}`
    tr.drawText(so, {
      x: A4.rong - LE.phai - F.thuong.widthOfTextAtSize(so, 8.5),
      y: LE.duoi, size: 8.5, font: F.thuong, color: XAM,
    })
  })
}

async function napFont(pdf, fonts) {
  pdf.registerFontkit(fontkit)
  const nap = b => pdf.embedFont(b, { subset: true })
  return {
    thuong: await nap(fonts.thuong),
    dam: await nap(fonts.dam || fonts.thuong),
    nghieng: await nap(fonts.nghieng || fonts.thuong),
  }
}

// ── Thông báo của cơ quan thuế ───────────────────────────────────────────────

// Mẫu biểu theo Thông tư 19/2021/TT-BTC.
//
// ⚠ CHỈ mẫu 01-2 (CHẤP NHẬN) mới in nguyên lời văn pháp lý, vì lời văn đó bóc ra từ chính bản PDF
// cơ quan thuế phát. Mẫu 01-1 (TIẾP NHẬN) chưa có bản gốc để đối chiếu → in dạng BẢNG, không bịa
// câu chữ pháp lý.
//
// Bản đầu in thông báo TIẾP NHẬN bằng lời văn của thông báo CHẤP NHẬN — sai nặng, vì tờ giấy đó
// khẳng định cơ quan thuế "đã chấp nhận" trong khi mới chỉ tiếp nhận. XML tiếp nhận lại không có
// ngayChapNhan/ngayNopThucTe nên câu còn bị đứt và hiện ra dấu gạch trống (anh phát hiện 28/09).
export const MAU_THONG_BAO = {
  '844': { mau: '01-2/TB-TĐT', tieuDe: 'V/v: Chấp nhận việc nộp hồ sơ khai thuế điện tử', kieu: 'chap_nhan' },
  '843': { mau: '01-1/TB-TĐT', tieuDe: 'V/v: Tiếp nhận hồ sơ khai thuế điện tử', kieu: 'tiep_nhan' },
}

function veTieuDeThongBao(but, F, tb, mau) {
  // Khối trái: BỘ TÀI CHÍNH / TỔNG CỤC THUẾ / gạch / Số.
  // Khối phải: Mẫu số + trích yếu / QUỐC HIỆU / địa danh ngày.
  const tr = but.trang
  const yDau = but.y
  const cotTrai = { x: LE.trai, rong: 210 }
  const cotPhai = { x: LE.trai + 238, rong: RONG - 238 }

  const giua = (chu, font, co, cot, yy, mauChu = DEN) => {
    const w = font.widthOfTextAtSize(chu, co)
    tr.drawText(chu, { x: cot.x + (cot.rong - w) / 2, y: yy, size: co, font, color: mauChu })
  }
  const phai = (chu, font, co, yy, mauChu = DEN) => {
    const w = font.widthOfTextAtSize(chu, co)
    tr.drawText(chu, { x: A4.rong - LE.phai - w, y: yy, size: co, font, color: mauChu })
  }

  // Cột phải trước: mẫu số nằm cao nhất.
  let yp = yDau - 9
  if (mau?.mau) { phai(`Mẫu số: ${mau.mau}`, F.dam, 10, yp); yp -= 13 }
  for (const d of ['(Ban hành kèm theo Thông tư số 19/2021/TT-BTC',
    'ngày 18/3/2021 của Bộ trưởng Bộ Tài chính)']) {
    phai(d, F.nghieng, 8, yp); yp -= 10
  }

  // Cột trái.
  let yt = yDau - 11
  giua('BỘ TÀI CHÍNH', F.thuong, 11, cotTrai, yt); yt -= 14
  giua(TEN_CO_QUAN, F.dam, 11.5, cotTrai, yt); yt -= 6
  tr.drawLine({
    start: { x: cotTrai.x + 62, y: yt }, end: { x: cotTrai.x + cotTrai.rong - 62, y: yt },
    thickness: 0.8, color: DEN,
  })
  yt -= 16
  const soChu = `Số: ${tb.soTBao || '—'}`
  for (const d of but.catDong(soChu, F.thuong, 10.5, cotTrai.rong)) {
    giua(d, F.thuong, 10.5, cotTrai, yt); yt -= 13
  }

  // Quốc hiệu bên phải.
  yp -= 8
  giua('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', F.dam, 10.5, cotPhai, yp); yp -= 14
  giua('Độc lập - Tự do - Hạnh phúc', F.dam, 11.5, cotPhai, yp); yp -= 6
  tr.drawLine({
    start: { x: cotPhai.x + 52, y: yp }, end: { x: cotPhai.x + cotPhai.rong - 52, y: yp },
    thickness: 0.8, color: DEN,
  })
  yp -= 20
  const dd = ngayChu(tb.ngayTBao)
  if (dd) { giua(`${DIA_DANH}, ${dd}`, F.nghieng, 11, cotPhai, yp); yp -= 14 }

  but.y = Math.min(yt, yp) - 14

  // Tiêu đề giữa trang.
  but.dong('THÔNG BÁO', { font: F.dam, co: 15, canGiua: true, caoDong: 20 })
  const td = mau?.tieuDe || tb.tenTBao || ''
  if (td) but.doan(td, { font: F.dam, co: 11.5, canGiua: true, caoDong: 15 })
  but.cach(6)
  const tr2 = but.trang
  tr2.drawLine({
    start: { x: A4.rong / 2 - 40, y: but.y }, end: { x: A4.rong / 2 + 40, y: but.y },
    thickness: 0.8, color: DEN,
  })
  but.cach(16)
}

function veKySo(but, F, kySo) {
  if (!kySo?.chuThe && !kySo?.thoiGian) return
  but.cach(18)
  const x = LE.trai + RONG * 0.5
  const rong = RONG * 0.5
  if (kySo.chuThe) {
    but.doan(`Ký điện tử bởi: ${kySo.chuThe}`, {
      x, rong, font: F.nghieng, co: 10, mau: XANH, caoDong: 13,
    })
  }
  if (kySo.thoiGian) {
    but.doan(`Ngày ký: ${ngaySo(kySo.thoiGian)}`, {
      x, rong, font: F.nghieng, co: 10, mau: XANH, caoDong: 13,
    })
  }
}

function veThanChapNhan(but, F, tb) {
  const cn = tb.trangThai === 'Y'
  const nhanCQT = tb.tenCQT || '—'
  const nhanNNT = tb.tenNNhan || '—'
  const D = { thut: 24, co: 12, canDeu: true, caoDong: 17 }

  but.doan('Căn cứ quy định tại Luật Quản lý thuế ngày 13/6/2019;', D)
  but.doan('Căn cứ quy định tại Thông tư số 19/2021/TT-BTC ngày 18/3/2021 của Bộ trưởng Bộ Tài chính '
    + 'hướng dẫn giao dịch điện tử trong lĩnh vực thuế.', D)
  but.cach(6)

  const tiepNhan = gioNgayChu(tb.ngayNopThucTe)
  but.doan(`Căn cứ hồ sơ khai thuế/BCTC/BCAC của ${nhanNNT} gửi tới cơ quan thuế ${nhanCQT} `
    + `đã được cổng thông tin điện tử của ${TEN_CO_QUAN_TRONG_CAU} thông báo tiếp nhận`
    + (tiepNhan ? ` vào lúc ${tiepNhan}` : '')
    + `, mã giao dịch điện tử ${tb.maGiaoDichDTu || '—'}. `
    + `Cơ quan thuế thông báo về việc ${cn ? 'chấp nhận' : 'xử lý'} hồ sơ khai thuế/BCTC/BCAC của `
    + `${nhanNNT} gửi tới cơ quan thuế ${nhanCQT}, cụ thể như sau:`, D)
  but.cach(8)

  for (const hs of tb.hoSo) {
    but.doan(`- Tên tờ khai/Phụ lục: ${hs.tenToKhai || '—'}`, { thut: 24, co: 12, caoDong: 16 })
    but.doan(`- Loại tờ khai: ${hs.loaiToKhai || '—'}`, { thut: 24, co: 12, caoDong: 16 })
    but.doan(`- Kỳ tính thuế: ${hs.kyTinhThue || '—'}`, { thut: 24, co: 12, caoDong: 16 })
    but.doan(`- Lần nộp hoặc lần bổ sung: ${hs.lanNop || '—'}`, { thut: 24, co: 12, caoDong: 16 })
    but.cach(4)
  }
  but.cach(4)

  // Thiếu mốc thời gian thì BỎ HẲN vế đó, không in dấu gạch trống giữa câu văn hành chính.
  const cnLuc = gioNgayChu(tb.ngayChapNhan)
  const hoanThanh = ngayChu(tb.ngayHoanThanh || tb.ngayChapNhan || tb.ngayNopThucTe)
  const veChapNhan = cnLuc
    ? `Hồ sơ khai thuế (HSKT) của người nộp thuế được cơ quan thuế ${cn ? 'chấp nhận' : 'xử lý'} vào lúc ${cnLuc}.`
    : `Hồ sơ khai thuế (HSKT) của người nộp thuế đã được cơ quan thuế ${cn ? 'chấp nhận' : 'xử lý'}.`
  const veHoanThanh = hoanThanh
    ? ` Ngày hoàn thành việc nộp HSKT điện tử của người nộp thuế là ${hoanThanh}.`
    : ''
  but.doan(veChapNhan + veHoanThanh, D)

  if (tb.lyDo) {
    but.cach(4)
    but.doan(`Lý do: ${tb.lyDo}`, D)
  }
  but.cach(6)

  const dd = tb.duongDan || 'https://dichvucong.gdt.gov.vn'
  but.doan('Trường hợp hồ sơ cần giải trình, bổ sung thông tin, tài liệu, cơ quan thuế sẽ có thông báo '
    + `gửi người nộp thuế. Cơ quan thuế sẽ thực hiện trả kết quả giải quyết hồ sơ cho người nộp thuế qua ${dd}`, D)
  but.cach(6)
  const hl = tb.hotline ? ` Tổng đài hỗ trợ: ${tb.hotline}.` : ''
  but.doan('Trường hợp cần biết thêm thông tin chi tiết, người nộp thuế vui lòng liên hệ với cơ quan thuế '
    + `quản lý trực tiếp để được hỗ trợ.${hl}`, D)
  but.cach(6)
  but.doan('Cơ quan thuế thông báo để người nộp thuế biết và thực hiện./.', D)
}

// Thông báo TIẾP NHẬN và mọi mẫu chưa có bản gốc để đối chiếu: in dạng BẢNG, KHÔNG bịa lời văn
// pháp lý. Thà tờ giấy khô khan mà đúng, còn hơn trau chuốt mà nói sai việc cơ quan thuế đã làm.
function veThanChung(but, F, tb, mau) {
  const moDau = mau?.kieu === 'tiep_nhan'
    ? `Cổng thông tin điện tử của ${TEN_CO_QUAN_TRONG_CAU} đã TIẾP NHẬN hồ sơ khai thuế điện tử `
      + 'của người nộp thuế. Kết quả chấp nhận hay không chấp nhận sẽ có ở thông báo tiếp theo của '
      + 'cơ quan thuế. Chi tiết hồ sơ đã tiếp nhận:'
    : 'Nội dung thông báo (in nguyên theo dữ liệu trong file XML của cơ quan thuế):'

  but.doan(moDau, { font: F.nghieng, co: 10.5, mau: XAM, caoDong: 15, canDeu: true })
  but.cach(8)
  const H = [
    ['Mã thông báo', tb.maTBao],
    ['Tên thông báo', tb.tenTBao],
    ['Số thông báo', tb.soTBao],
    ['Ngày thông báo', ngaySo(tb.ngayTBao)],
    ['Cơ quan thuế', [tb.maCQT, tb.tenCQT].filter(Boolean).join(' - ')],
    ['Người nộp thuế', [tb.maNNhan, tb.tenNNhan].filter(Boolean).join(' - ')],
    // 'Y' trên thông báo TIẾP NHẬN nghĩa là đã tiếp nhận được, KHÔNG phải đã chấp nhận hồ sơ —
    // ghi nhầm là tờ giấy nói quá việc cơ quan thuế đã làm.
    ['Trạng thái', tb.trangThai === 'Y'
      ? (mau?.kieu === 'tiep_nhan' ? 'Y (đã tiếp nhận)' : 'Y (chấp nhận)')
      : tb.trangThai === 'N' ? 'N (không chấp nhận)' : tb.trangThai],
    ['Ngày nộp thực tế', ngaySo(tb.ngayNopThucTe)],
    ['Ngày chấp nhận', ngaySo(tb.ngayChapNhan)],
    ['Mã giao dịch', tb.maGiaoDichDTu],
    ['Lý do', tb.lyDo],
  ]
  for (const [n, g] of H) if (g) but.hangNhan(n, g, { rongNhan: 140 })
  tb.hoSo.forEach((hs, i) => {
    but.cach(8)
    but.dong(`Hồ sơ ${i + 1}`, { font: F.dam, co: 11 })
    but.hangNhan('Tờ khai/Phụ lục', hs.tenToKhai, { rongNhan: 140 })
    but.hangNhan('Loại tờ khai', hs.loaiToKhai, { rongNhan: 140 })
    but.hangNhan('Kỳ tính thuế', hs.kyTinhThue, { rongNhan: 140 })
    but.hangNhan('Lần nộp', hs.lanNop, { rongNhan: 140 })
  })
}

export async function dungPdfThongBao(xmlHoacDuLieu, fonts) {
  const tb = typeof xmlHoacDuLieu === 'string' ? docThongBaoXml(xmlHoacDuLieu) : xmlHoacDuLieu
  const pdf = await PDFDocument.create()
  const F = await napFont(pdf, fonts)
  const but = taoBut(pdf, F)
  const mau = MAU_THONG_BAO[String(tb.maTBao)]

  pdf.setTitle(`${tb.tenTBao || 'Thông báo thuế'} - ${tb.soTBao || ''}`.trim())
  pdf.setSubject(`Người nộp thuế ${tb.maNNhan || ''} - ${tb.tenNNhan || ''}`)
  pdf.setProducer('App Savitax - Phan he To khai')
  pdf.setCreator('App Savitax')

  veTieuDeThongBao(but, F, tb, mau)
  // Chỉ mẫu CHẤP NHẬN mới in lời văn pháp lý — xem ghi chú ở MAU_THONG_BAO.
  if (mau?.kieu === 'chap_nhan') veThanChapNhan(but, F, tb)
  else veThanChung(but, F, tb, mau)
  veKySo(but, F, tb.kySo)
  veChanTrang(but, F)

  return pdf.save()
}

// ── Trang bìa tờ khai ────────────────────────────────────────────────────────

function veBangChiTieu(but, F, tk) {
  const COT_MA = 44
  const COT_TIEN = 106
  const xMa = LE.trai
  const xTen = LE.trai + COT_MA
  const xTien = LE.trai + RONG - COT_TIEN
  const rongTen = RONG - COT_MA - COT_TIEN - 8

  but.cach(16)
  but.dong('CHỈ TIÊU TRÊN TỜ KHAI', { font: F.dam, co: 11.5, mau: XANH })
  but.cach(5)

  // Ẩn chỉ tiêu bằng 0 cho đỡ rối, nhưng ĐẾM lại và ghi rõ đã ẩn bao nhiêu — để kế toán không
  // tưởng là thiếu dữ liệu.
  const laKhong = c => !c.gia || /^0+([.,]0+)?$/.test(c.gia)
  const hien = tk.chiTieu.filter(c => !laKhong(c) || laSoNguoi(tk.maTKhai, c.ma))
  const an = tk.chiTieu.length - hien.length

  if (!hien.length) {
    but.ke({ cachSau: 8 })
    but.doan(`Toàn bộ ${tk.chiTieu.length} chỉ tiêu trên tờ khai đều bằng 0 — kỳ này không phát sinh.`,
      { font: F.nghieng, co: 11, mau: XAM, caoDong: 15 })
    return
  }

  // Dòng tiêu đề bảng.
  but.ke({ day: 0.9, mau: XAM, cachSau: 4 })
  const tr = but.trang
  but.y -= 10
  tr.drawText('Mã', { x: xMa, y: but.y, size: 9.5, font: F.dam, color: XAM })
  tr.drawText('Chỉ tiêu', { x: xTen, y: but.y, size: 9.5, font: F.dam, color: XAM })
  const tt = 'Số tiền'
  tr.drawText(tt, {
    x: xTien + COT_TIEN - F.dam.widthOfTextAtSize(tt, 9.5), y: but.y, size: 9.5, font: F.dam, color: XAM,
  })
  but.y -= 5
  but.ke({ day: 0.9, mau: XAM, cachSau: 2 })

  const co = 10
  let soc = false
  for (const c of hien) {
    const ten = tenChiTieu(tk.maTKhai, c.ma)
    const ds = but.catDong(ten || '(chưa gán tên chỉ tiêu — nhờ kế toán soát lại)', F.thuong, co, rongTen)
    const cao = ds.length * (co * 1.35) + 7

    // Sang trang giữa bảng thì vẽ lại vạch đầu bảng cho dễ đọc.
    if (but.y - cao < LE.duoi + 30) {
      but.sangTrang()
      but.dong('CHỈ TIÊU TRÊN TỜ KHAI (tiếp)', { font: F.dam, co: 11.5, mau: XANH })
      but.cach(5)
      but.ke({ day: 0.9, mau: XAM, cachSau: 4 })
    }

    const yTren = but.y
    // Sọc nhạt xen kẽ giữa các dòng, cùng kiểu với bảng trên màn hình.
    if (soc) {
      but.trang.drawRectangle({
        x: LE.trai - 4, y: yTren - cao + 3, width: RONG + 8, height: cao,
        color: rgb(0.965, 0.968, 0.98),
      })
    }
    soc = !soc

    but.y -= co + 3
    const yChu = but.y
    but.trang.drawText(`[${c.ma}]`, { x: xMa, y: yChu, size: 9.5, font: F.thuong, color: XAM })
    ds.forEach((d, i) => {
      but.trang.drawText(d, {
        x: xTen, y: yChu - i * (co * 1.35), size: co,
        font: F.thuong, color: ten ? DEN : XAM,
      })
    })
    const gia = laSoNguoi(tk.maTKhai, c.ma) ? String(c.gia) : soTien(c.gia)
    but.trang.drawText(gia, {
      x: xTien + COT_TIEN - F.dam.widthOfTextAtSize(gia, co), y: yChu, size: co, font: F.dam, color: DEN,
    })
    but.y = yTren - cao
  }
  but.ke({ day: 0.9, mau: XAM, cachTruoc: 2 })

  if (an > 0) {
    but.cach(8)
    but.doan(`Đã ẩn ${an} chỉ tiêu có giá trị bằng 0.`,
      { font: F.nghieng, co: 9, mau: XAM, caoDong: 12 })
  }
  if (!coBangChiTieu(tk.maTKhai)) {
    but.cach(6)
    but.doan(`Chưa có bảng tên chỉ tiêu cho mẫu tờ khai này (mã ${tk.maTKhai}) — `
      + 'bảng tên nằm ở lib/tokhaiChiTieu.js, bổ sung thêm được.',
      { font: F.nghieng, co: 9, mau: XAM, caoDong: 12 })
  }
}

export async function dungPdfToKhai(xmlHoacDuLieu, fonts) {
  const tk = typeof xmlHoacDuLieu === 'string' ? docToKhaiXml(xmlHoacDuLieu) : xmlHoacDuLieu
  const pdf = await PDFDocument.create()
  const F = await napFont(pdf, fonts)
  const but = taoBut(pdf, F)

  pdf.setTitle(`${tk.tenTKhai || 'Tờ khai thuế'} - ${tk.mst || ''} - ${tk.kyKKhai || ''}`.trim())
  pdf.setSubject(`${tk.tenNNT || ''} - ${tk.mst || ''}`)
  pdf.setProducer('App Savitax - Phan he To khai')
  pdf.setCreator('App Savitax')

  // Đầu trang: nói rõ đây là TRANG BÌA, không phải tờ khai chính thức.
  but.dong('BẢN TRÍCH TỜ KHAI ĐÃ NỘP', { font: F.dam, co: 9.5, mau: XAM, canGiua: true, caoDong: 13 })
  but.cach(4)
  but.doan(tk.tenTKhai || '—', { font: F.dam, co: 14, canGiua: true, caoDong: 19 })
  if (tk.moTaBMau) {
    but.cach(2)
    but.doan(tk.moTaBMau, { font: F.nghieng, co: 9, mau: XAM, canGiua: true, caoDong: 12 })
  }
  but.cach(10)
  but.ke({ day: 1, mau: XANH })
  but.cach(14)

  const ky = [
    tk.tenKieuKy && tk.kyKKhai ? `${tk.tenKieuKy} ${tk.kyKKhai}` : tk.kyKKhai,
    tk.kyTuNgay && tk.kyDenNgay ? `(${tk.kyTuNgay} – ${tk.kyDenNgay})` : '',
  ].filter(Boolean).join(' ')
  const loai = tk.loaiTKhai === 'B'
    ? `Bổ sung lần ${tk.soLan || '—'}`
    : tk.tenLoaiTKhai || '—'

  but.hangNhan('Người nộp thuế', tk.tenNNT)
  but.hangNhan('Mã số thuế', tk.mst)
  but.hangNhan('Địa chỉ', tk.dchiNNT)
  but.hangNhan('Cơ quan thuế nơi nộp', [tk.maCQTNoiNop, tk.tenCQTNoiNop].filter(Boolean).join(' - '))
  but.cach(8)
  but.hangNhan('Kỳ tính thuế', ky)
  but.hangNhan('Loại tờ khai', loai)
  if (tk.tenNganhNghe) but.hangNhan('Ngành nghề', tk.tenNganhNghe)
  but.cach(8)
  but.hangNhan('Ngày lập tờ khai', ngaySo(tk.ngayLapTKhai))
  but.hangNhan('Người ký', tk.nguoiKy)
  but.hangNhan('Ngày ký', ngaySo(tk.ngayKy))
  but.hangNhan('Lập bằng', [tk.phanMem, tk.pbanTKhaiXML ? `(XML ${tk.pbanTKhaiXML})` : ''].filter(Boolean).join(' '))

  veBangChiTieu(but, F, tk)

  but.cach(20)
  but.ke({ cachSau: 8 })
  but.doan('Trang này do App Savitax lập từ file XML tờ khai, dùng để tra cứu và đối chiếu nhanh. '
    + 'Bản tờ khai chính thức theo mẫu của Bộ Tài chính là bản in từ phần mềm HTKK.',
    { font: F.nghieng, co: 9, mau: XAM, caoDong: 12 })

  veChanTrang(but, F)
  return pdf.save()
}
