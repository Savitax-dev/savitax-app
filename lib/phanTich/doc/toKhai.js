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
// 864 = 05/KK-TNCN TT80/2021 (HTKK 2.9.x) — bản cổng mới đặt tên "Tờ khai thuế thu nhập cá nhân (TT80/2021)", không có
// chữ 05/KK-TNCN; mã mẫu nằm ở thẻ moTaBMau (TAM Q4/2025, 18/11/2026: tờ khai thật bị báo "không nhận ra").
// 2032 = 01/GTGT theo TT89/2026 (HTKK 5.8.x, XML 3.0.x — ca CHARGEPOINT T10/2026): [27] trừ [32b], [34] cộng [34a]; [34] vẫn là
// tổng doanh thu nên các phép so doanh thu dùng như cũ.
// 1240 / 1266 = 01/CNKD tờ khai hộ kinh doanh, cá nhân kinh doanh — TT18/2026 (Q1/2026) rồi TT50/2026 (từ Q2/2026). Cột của TT50
// lùi 2 so với TT18 (thêm "doanh thu không chịu thuế GTGT" + "doanh thu chịu thuế suất 0%") — đọc riêng ở docHkd (anh gửi ca
// DUY PHƯƠNG Q1–Q3/2026, 28/11/2026: trước đó 3 tờ khai HKD báo "không nhận ra loại tờ khai").
const THEO_MA = { '842': '01/GTGT', '2032': '01/GTGT', '864': '05/KK-TNCN', '892': '03/TNDN', '1240': '01/CNKD', '1266': '01/CNKD' }
const THEO_TEN = [
  [/01\/CNKD/i, '01/CNKD'], [/01\/GTGT/i, '01/GTGT'], [/05\/KK-TNCN/i, '05/KK-TNCN'], [/05\/QTT-TNCN/i, '05/QTT-TNCN'], [/03\/TNDN/i, '03/TNDN'],
]
export function loaiToKhai({ maTKhai, tenTKhai, moTaBMau }) {
  if (THEO_MA[maTKhai]) return THEO_MA[maTKhai]
  for (const [re, loai] of THEO_TEN) if (re.test(tenTKhai || '') || re.test(moTaBMau || '')) return loai
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

// ── 01/CNKD (hộ kinh doanh) ──────────────────────────────────────────────────
// Mã cột theo mẫu: TT18 (1240) [11] doanh thu GTGT · [12] thuế GTGT · [13] doanh thu TNCN · [14] doanh thu được trừ · [15] thuế TNCN;
// TT50 (1266) [11] tổng doanh thu · [12] không chịu thuế GTGT · [13] thuế suất 0% · [14] thuế GTGT · [15] doanh thu chịu thuế TNCN ·
// [16] được trừ · [17] thuế TNCN. Dòng tổng [16] (TT18) / [18] (TT50).
export const COT_HKD = {
  '1240': { mau: 'TT18', dt: '11', thueGtgt: '12', dtTncn: '13', dtTru: '14', thueTncn: '15', tong: '16', mien: '17', conPhaiNop: '18' },
  '1266': { mau: 'TT50', dt: '11', khongChiu: '12', ts0: '13', thueGtgt: '14', dtTncn: '15', dtTru: '16', thueTncn: '17', tong: '18', mien: '19', conPhaiNop: '20' },
}
const theDon = (k, t) => { const m = String(k || '').match(new RegExp(`<${t}(?:\\s[^>]*)?>([^<]*)</${t}>`)); return m ? giaiMaThucThe(m[1].trim()) : '' }
const cacKhoi = (k, t) => [...String(k || '').matchAll(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'g'))].map(m => m[1])

export function docHkd(than, maTKhai) {
  const C = COT_HKD[maTKhai]
  if (!C) return null
  const ct = motKhoi(than, 'CTieuTKhaiChinh')
  const hd = motKhoi(ct, 'Header'), kt = motKhoi(ct, 'KhaiThueGTGTTNCN')
  const so = (k, t) => soXml(theDon(k, t))
  // Một dòng chi tiết: cột có đuôi _soThue là ô thuế (ct12_soThue / ct14_soThue …)
  const dong = (r, nhomHd) => {
    const o = { nhomHd, nhom: theDon(r, 'ct10').replace(/[()]/g, ''), maNganh: theDon(r, 'ct09_ma'), tenNganh: theDon(r, 'ct09_ten') }
    for (const [k, c] of Object.entries(C)) if (/^\d+$/.test(c) && !['tong', 'mien', 'conPhaiNop'].includes(k)) o[k] = so(r, `ct${c}_soThue`) ?? so(r, `ct${c}`)
    return o
  }
  const diaDiem = []
  for (const [nhomHd, the] of [['co_dinh', 'KinhDoanhDiaDiemCoDinh'], ['tmdt', 'KinhDoanhTMDT']]) {
    for (const dd of cacKhoi(motKhoi(kt, the), 'DoanhThuThueGTGTTNCN')) {
      diaDiem.push({ nhomHd, ma: theDon(dd, 'ma_diaDiemKD'), ten: theDon(dd, 'ten_diaDiemKD'), truSo: theDon(dd, 'truSoChinh') === 'true',
        dong: cacKhoi(dd, 'CTietDoanhThu').map(r => dong(r, nhomHd)) })
    }
  }
  const tongK = motKhoi(kt, 'TongCongCT' + C.tong), mienK = motKhoi(kt, 'SoThueMienCT' + C.mien), conK = motKhoi(kt, 'SoThueConPhaiNopCT' + C.conPhaiNop)
  const tong = {}
  for (const k of ['dt', 'khongChiu', 'ts0', 'thueGtgt', 'dtTncn', 'dtTru', 'thueTncn']) if (C[k]) tong[k] = so(tongK, 'tongCT' + C[k])
  const mien = { thueGtgt: so(mienK, 'soThueDuocMienCT' + C.thueGtgt), thueTncn: so(mienK, 'soThueDuocMienCT' + C.thueTncn) }
  const con = { thueGtgt: so(conK, 'soThueGTGT_ct' + C.thueGtgt), thueTncn: so(conK, 'soThueTNCN_ct' + C.thueTncn) }
  const hoTro = motKhoi(ct, 'HoTroThongTinNopThue')
  const tongNop = soXml((String(hoTro).match(/<tongTienCT\d+>([^<]*)</) || [])[1])
  return {
    mau: C.mau, cot: C, diaDiem,
    pp: theDon(hd, 'nopThueTNCNThunhapTinhThue') === 'true' ? 'thu_nhap' : 'doanh_thu',
    tmdt: theDon(hd, 'hoatDongTMDT') === 'true',
    tong, mien, con, tongNop, truKyTiep: so(ct, 'soTienTruKyTiep'),
    // Không kê khai thuế TTĐB / tài nguyên / BVMT — có số khác 0 thì Soát kỳ nêu thông tin
    thueKhac: ['KKhaiThueTTDB', 'KKhaiTaiNguyen'].some(t => /<\w+>\s*-?[1-9]/.test(motKhoi(ct, t))),
  }
}

// Đọc 1 file tờ khai. Lỗi cấu trúc → throw (bộ gọi xếp file vào "Không đọc được").
export function docToKhai(xml) {
  const tk = docToKhaiXml(xml)
  const than = String(xml).replace(/<CKyDTu\b[\s\S]*?<\/CKyDTu>/, '')
  const ky = kyToKhai(tk.kieuKy, tk.kyKKhai)
  const phuLuc = {}
  const loai = loaiToKhai({ ...tk, moTaBMau: giaiMaThucThe(motKhoi(than, 'moTaBMau')) })
  // 01/CNKD: chỉ tiêu = các ô TỔNG CỘNG theo mã cột của mẫu (thẻ ctXXX của tờ khai HKD nằm rải ở từng địa điểm, lẫn mã
  // địa điểm / hạn nộp — gom phẳng như 01/GTGT là ra số vô nghĩa)
  const hkd = loai === '01/CNKD' ? docHkd(than, tk.maTKhai) : null
  const plKhoi = motKhoi(than, 'PLuc')
  for (const m of String(plKhoi).matchAll(/<(PL_[0-9A-Za-z_]+|PL[0-9A-Za-z_]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) phuLuc[m[1]] = chiTieuKhoi(m[2])
  return {
    loai,
    maTKhai: tk.maTKhai,
    ky,
    maKy: maKyToKhai(ky),
    chinhThuc: tk.loaiTKhai !== 'B',
    lanBoSung: tk.loaiTKhai === 'B' ? Number(tk.soLan || 0) : 0,
    ngayLap: tk.ngayLapTKhai || '',
    mst: tk.mst,
    tenNNT: tk.tenNNT,
    phanMem: tk.phanMem,
    chiTieu: hkd ? Object.fromEntries(Object.entries(hkd.tong).map(([k, x]) => [hkd.cot[k], x])) : chiTieuKhoi(motKhoi(than, 'CTieuTKhaiChinh')),
    ...(hkd ? { hkd } : {}),
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
