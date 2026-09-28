// Đọc file XML của cổng thuế — Phân hệ Tờ khai, GĐ 6.
//
// Cố ý KHÔNG dùng thư viện XML: hai loại file này do máy sinh ra, cấu trúc cố định, nên đọc bằng
// biểu thức chính quy là đủ và chạy được ở CẢ hai nơi — Node (script kiểm) lẫn trình duyệt (lúc
// nhân viên tải file). Trình duyệt có DOMParser nhưng Node thì không, thêm thư viện chỉ để đọc
// mấy chục thẻ là không đáng.
//
// Dùng chung cho cả bộ dựng PDF (lib/tokhaiPdf.js) và phần ghi dữ liệu về Supabase.

// ── Đọc thẻ ──────────────────────────────────────────────────────────────────

const GIAI_MA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

export function giaiMaThucThe(s) {
  return String(s || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (tron, ten) => {
    if (GIAI_MA[ten] !== undefined) return GIAI_MA[ten]
    if (ten[0] === '#') {
      const so = ten[1] === 'x' || ten[1] === 'X'
        ? parseInt(ten.slice(2), 16)
        : parseInt(ten.slice(1), 10)
      return Number.isFinite(so) ? String.fromCodePoint(so) : tron
    }
    return tron
  })
}

// Ghép regex cho một thẻ. Bắt cả dạng tự đóng `<ct09 />` (trả về rỗng) lẫn dạng có nội dung.
// Tên thẻ phải kết thúc đúng chỗ: đọc 'ct2' KHÔNG được trúng '<ct21>'.
const reThe = (ten, co) => new RegExp(
  `<${ten}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${ten}>)`, co ? 'g' : '')

// Nội dung thẻ đầu tiên, đã cắt khoảng trắng và giải mã thực thể. Không có thẻ → ''.
export function the(xml, ten) {
  const m = String(xml || '').match(reThe(ten))
  return m ? giaiMaThucThe((m[1] || '').trim()) : ''
}

// Nội dung TẤT CẢ các khối cùng tên, chưa giải mã — để đọc tiếp bên trong.
export function cacKhoi(xml, ten) {
  return [...String(xml || '').matchAll(reThe(ten, true))].map(m => m[1] || '')
}

export function motKhoi(xml, ten) {
  const m = String(xml || '').match(reThe(ten))
  return m ? (m[1] || '') : ''
}

// ── Ngày tháng ───────────────────────────────────────────────────────────────

// Cổng ghi ngày theo nhiều kiểu: '2026-04-20', '2026-04-20T08:58:40.983+07:00', '01/01/2026'.
// Trả về { nam, thang, ngay, gio, phut } dạng chuỗi đã đủ số 0, hoặc null.
export function tachNgay(s) {
  const t = String(s || '').trim()
  if (!t) return null

  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) return { nam: m[1], thang: m[2], ngay: m[3], gio: m[4] || '', phut: m[5] || '', giay: m[6] || '' }

  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) return { nam: m[3], thang: m[2], ngay: m[1], gio: m[4] || '', phut: m[5] || '', giay: m[6] || '' }

  return null
}

// '2026-04-20' → 'ngày 20 tháng 04 năm 2026'
export function ngayChu(s) {
  const n = tachNgay(s)
  return n ? `ngày ${n.ngay} tháng ${n.thang} năm ${n.nam}` : ''
}

// '2026-04-20T08:58:40' → '08 giờ 58 phút ngày 20 tháng 04 năm 2026'
export function gioNgayChu(s) {
  const n = tachNgay(s)
  if (!n) return ''
  const gio = n.gio ? `${n.gio} giờ ${n.phut} phút ` : ''
  return `${gio}ngày ${n.ngay} tháng ${n.thang} năm ${n.nam}`
}

// '2026-04-20T08:58:40' → '20/04/2026 08:58:40'
export function ngaySo(s) {
  const n = tachNgay(s)
  if (!n) return ''
  const gio = n.gio ? ` ${n.gio}:${n.phut}${n.giay ? ':' + n.giay : ''}` : ''
  return `${n.ngay}/${n.thang}/${n.nam}${gio}`
}

// ── Thông báo của cơ quan thuế (TBaoThueDTu) ─────────────────────────────────

// 'CN=CỤC THUẾ,O=BỘ TÀI CHÍNH,L=Hà Nội,C=VN' → 'CỤC THUẾ - BỘ TÀI CHÍNH'
function docChuTheKy(chuoi) {
  if (!chuoi) return ''
  const lay = k => chuoi.match(new RegExp(`(?:^|,)\\s*${k}=([^,]+)`))?.[1]?.trim() || ''
  const cn = lay('CN'), o = lay('O')
  return [cn, o].filter(Boolean).join(' - ')
}

export function docThongBaoXml(xml) {
  const s = String(xml || '')
  if (!/<TBaoThueDTu/.test(s)) throw new Error('Không phải file thông báo thuế (thiếu thẻ TBaoThueDTu)')

  // Tách phần chữ ký số ra trước: bên trong có <Object>, <Reference>… dễ trùng tên với thẻ khác.
  const kyXml = motKhoi(s, 'CKyDTu')
  const than = s.replace(/<CKyDTu\b[\s\S]*?<\/CKyDTu>/, '')

  const hoSo = cacKhoi(than, 'CTietHoSoThue').map(k => ({
    tenToKhai: the(k, 'tokhai-phuluc'),
    loaiToKhai: the(k, 'loaiToKhai'),
    kyTinhThue: the(k, 'kyTinhThue'),
    lanNop: the(k, 'lanNop'),
  }))

  return {
    maTBao: the(than, 'maTBao'),
    tenTBao: the(than, 'tenTBao'),
    soTBao: the(than, 'soTBao'),
    ngayTBao: the(than, 'ngayTBao'),
    pbanTBao: the(than, 'pbanTBao'),

    maCQT: the(than, 'maCQT'),
    tenCQT: the(than, 'tenCQT'),
    tenDVu: the(than, 'tenDVu'),

    maNNhan: the(than, 'maNNhan'),
    tenNNhan: the(than, 'tenNNhan'),
    diaChiNNhan: the(than, 'diaChiNNhan'),

    trangThai: the(than, 'trangThai'),
    ngayNopThucTe: the(than, 'ngayNopThucTe'),
    ngayChapNhan: the(than, 'ngayChapNhan'),
    ngayHoanThanh: the(than, 'ngayHoanThanh'),
    maGiaoDichDTu: the(than, 'maGiaoDichDTu'),
    lyDo: the(than, 'LyDo'),
    duongDan: the(than, 'duongDan'),
    hotline: the(than, 'hotline'),

    hoSo,
    kySo: {
      chuThe: docChuTheKy(the(kyXml, 'X509SubjectName')),
      thoiGian: the(kyXml, 'SigningTime'),
    },
  }
}

// ── Tờ khai (HSoThueDTu) ─────────────────────────────────────────────────────

const TEN_LOAI_TKHAI = { C: 'Chính thức', B: 'Bổ sung' }
const TEN_KIEU_KY = { M: 'Tháng', Q: 'Quý', Y: 'Năm', N: 'Năm', L: 'Lần phát sinh' }

export function docToKhaiXml(xml) {
  const s = String(xml || '')
  if (!/<HSoThueDTu/.test(s)) throw new Error('Không phải file tờ khai (thiếu thẻ HSoThueDTu)')

  const than = s.replace(/<CKyDTu\b[\s\S]*?<\/CKyDTu>/, '')
  const tk = motKhoi(than, 'TKhaiThue')
  const ky = motKhoi(tk, 'KyKKhaiThue')
  const nnt = motKhoi(than, 'NNT')
  const ctKhoi = motKhoi(than, 'CTieuTKhaiChinh')

  // Quét mọi thẻ ctNN trong khối chỉ tiêu, KỂ CẢ thẻ nằm trong nhóm con (ct23/ct24 nằm trong
  // GiaTriVaThueGTGTHHDVMuaVao). Giữ đúng thứ tự trong file để in ra khớp thứ tự trên mẫu giấy.
  const chiTieu = [...ctKhoi.matchAll(/<(ct[0-9][0-9a-zA-Z_]*)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/\1>)/g)]
    .map(m => ({ ma: m[1].slice(2), gia: giaiMaThucThe((m[2] || '').trim()) }))

  const loai = the(tk, 'loaiTKhai')
  const kieu = the(ky, 'kieuKy')
  const pbanDVu = the(than, 'pbanDVu')
  const maDVu = the(than, 'maDVu')

  return {
    maTKhai: the(tk, 'maTKhai'),
    tenTKhai: the(tk, 'tenTKhai'),
    moTaBMau: the(tk, 'moTaBMau'),
    pbanTKhaiXML: the(tk, 'pbanTKhaiXML'),

    loaiTKhai: loai,
    tenLoaiTKhai: TEN_LOAI_TKHAI[loai] || loai,
    soLan: the(tk, 'soLan'),

    kieuKy: kieu,
    tenKieuKy: TEN_KIEU_KY[kieu] || kieu,
    kyKKhai: the(ky, 'kyKKhai'),
    kyTuNgay: the(ky, 'kyKKhaiTuNgay'),
    kyDenNgay: the(ky, 'kyKKhaiDenNgay'),

    maCQTNoiNop: the(tk, 'maCQTNoiNop'),
    tenCQTNoiNop: the(tk, 'tenCQTNoiNop'),
    ngayLapTKhai: the(tk, 'ngayLapTKhai'),
    nguoiKy: the(tk, 'nguoiKy'),
    ngayKy: the(tk, 'ngayKy'),

    mst: the(nnt, 'mst'),
    tenNNT: the(nnt, 'tenNNT'),
    dchiNNT: the(nnt, 'dchiNNT'),
    tenHuyenNNT: the(nnt, 'tenHuyenNNT'),
    tenTinhNNT: the(nnt, 'tenTinhNNT'),
    dthoaiNNT: the(nnt, 'dthoaiNNT'),
    emailNNT: the(nnt, 'emailNNT'),

    phanMem: [maDVu, pbanDVu].filter(Boolean).join(' '),
    tenNganhNghe: the(ctKhoi, 'ten_NganhNghe'),
    chiTieu,
  }
}

// 'Q' + '1/2026' → 'Q1/2026' ; 'M' + '09/2026' → 'T09/2026'
export function nhanKyToKhai({ kieuKy, kyKKhai }) {
  const k = String(kyKKhai || '').trim()
  if (!k) return ''
  if (kieuKy === 'Q') return 'Q' + k
  if (kieuKy === 'M') return 'T' + k
  return k
}
