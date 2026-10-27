// Đọc tờ khai thuế XML (01/GTGT, 05/KK-TNCN, 03/TNDN…) cho phân hệ Soát xét báo cáo + Rủi ro thuế.
//
// Dựa trên bộ đọc sẵn có của phân hệ Tờ khai (lib/tokhaiXml.js docToKhaiXml) — không viết bộ đọc thứ hai.
// Thêm: nhận loại tờ khai, chuẩn hoá kỳ, đổi chỉ tiêu ra số, và chọn "bản nộp sau cùng" của mỗi kỳ.
//
// ⚠ Chỉ tiêu KHÔNG có trong file → null, KHÔNG phải 0. Bản offline cũ coi thiếu [24] là 0 rồi lấy cả thuế đầu ra
// thay vào, báo lệch giả 1,4 tỷ (lỗi B14, kế hoạch mục 9.2). Ô có thẻ mà để trống cũng là null.
// ⚠ Tin NỘI DUNG, không tin tên file: bộ mẫu có file tên "…bs_lan_1.xml" mà bên trong là tờ khai chính thức.

import { docToKhaiXml, motKhoi, giaiMaThucThe } from '../../tokhaiXml.js'

// Mã tờ khai trên cổng (maTKhai) → loại. Không có trong bảng thì đoán theo tên tờ khai.
const THEO_MA = { '842': '01/GTGT', '892': '03/TNDN' }
const THEO_TEN = [
  [/01\/GTGT/i, '01/GTGT'], [/05\/KK-TNCN/i, '05/KK-TNCN'], [/05\/QTT-TNCN/i, '05/QTT-TNCN'], [/03\/TNDN/i, '03/TNDN'],
]
export function loaiToKhai({ maTKhai, tenTKhai }) {
  if (THEO_MA[maTKhai]) return THEO_MA[maTKhai]
  for (const [re, loai] of THEO_TEN) if (re.test(tenTKhai || '')) return loai
  return null
}

// Số trong XML: '1234567', '1234567.89', '-12', '' → number | null
export function soXml(s) {
  const t = String(s ?? '').trim()
  if (!t) return null
  const v = Number(t.replace(/,/g, ''))
  return Number.isFinite(v) ? v : null
}

// kieuKy 'M' + '06/2025' → { loai: 'T', so: 6, nam: 2025 } ; 'Q' + '3/2023' → Q3/2023 ; 'Y' + '2025' → năm
export function kyToKhai(kieuKy, kyKKhai) {
  const k = String(kyKKhai || '').trim()
  let m
  if (kieuKy === 'M' && (m = k.match(/^(\d{1,2})\/(\d{4})$/))) return { loai: 'T', so: Number(m[1]), nam: Number(m[2]) }
  if (kieuKy === 'Q' && (m = k.match(/^([1-4])\/(\d{4})$/))) return { loai: 'Q', so: Number(m[1]), nam: Number(m[2]) }
  if ((kieuKy === 'Y' || kieuKy === 'N') && (m = k.match(/^(\d{4})$/))) return { loai: 'N', so: 0, nam: Number(m[1]) }
  return null
}
export const maKyToKhai = k => !k ? '' : k.loai === 'N' ? `NAM.${k.nam}` : `${k.loai === 'Q' ? 'Q' + k.so : 'T' + String(k.so).padStart(2, '0')}.${k.nam}`

// Mọi thẻ ctXXX trong một khối → { 'XXX': số|null }. Khác docToKhaiXml: nhận cả mã có chữ (ctA1, ctB12 của 03/TNDN).
function chiTieuKhoi(khoi) {
  const ra = {}
  for (const m of String(khoi || '').matchAll(/<ct([0-9A-Za-z_]+)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/ct\1>)/g)) {
    const giaTri = giaiMaThucThe((m[2] || '').trim())
    if (/<\w/.test(giaTri)) continue          // thẻ nhóm chứa thẻ con: con đã được quét riêng
    ra[m[1]] = soXml(giaTri)
  }
  return ra
}

// Đọc 1 file tờ khai. Lỗi cấu trúc → throw (bộ gọi xếp file vào "Không đọc được").
export function docToKhai(xml) {
  const tk = docToKhaiXml(xml)
  const than = String(xml).replace(/<CKyDTu\b[\s\S]*?<\/CKyDTu>/, '')
  const ky = kyToKhai(tk.kieuKy, tk.kyKKhai)
  const phuLuc = {}
  const plKhoi = motKhoi(than, 'PLuc')
  for (const m of String(plKhoi).matchAll(/<(PL_[0-9A-Za-z_]+|PL[0-9A-Za-z_]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) phuLuc[m[1]] = chiTieuKhoi(m[2])
  return {
    loai: loaiToKhai(tk),
    maTKhai: tk.maTKhai,
    ky,
    maKy: maKyToKhai(ky),
    chinhThuc: tk.loaiTKhai !== 'B',
    lanBoSung: tk.loaiTKhai === 'B' ? Number(tk.soLan || 0) : 0,
    ngayLap: tk.ngayLapTKhai || '',
    mst: tk.mst,
    tenNNT: tk.tenNNT,
    phanMem: tk.phanMem,
    chiTieu: chiTieuKhoi(motKhoi(than, 'CTieuTKhaiChinh')),
    phuLuc,
  }
}

// Nhiều bản của cùng (loại, kỳ) → bản nộp sau cùng: bổ sung lần cao nhất > chính thức; trùng lần thì ngày lập sau.
export function banSauCung(dsToKhai) {
  const theoKhoa = new Map()
  for (const t of dsToKhai) {
    if (!t || !t.loai || !t.ky) continue
    const khoa = t.loai + '|' + t.maKy
    const cu = theoKhoa.get(khoa)
    if (!cu || hon(t, cu)) theoKhoa.set(khoa, t)
  }
  return [...theoKhoa.values()]
}
function hon(a, b) {
  if (a.lanBoSung !== b.lanBoSung) return a.lanBoSung > b.lanBoSung
  return String(a.ngayLap) > String(b.ngayLap)
}
