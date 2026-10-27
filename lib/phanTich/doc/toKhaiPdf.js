// Đọc tờ khai thuế từ PDF CÓ CHỮ (bản in cổng thuế / HTKK) — Phân hệ Soát xét báo cáo + Rủi ro thuế.
//
// Hàm thuần: nhận các DÒNG chữ đã gom theo trang (pdfChu.js layDongPdf) → cùng dạng kết quả với docToKhai (XML),
// thêm `nguon: 'pdf'`. XML luôn đáng tin hơn: có cả hai thì bộ gọi giữ XML, PDF chỉ dùng khi thiếu XML.
//
// Mẫu dựng theo file thật (127HOME, 26/10/2026):
//   Mẫu số: 01/GTGT … TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (MẪU SỐ 01/GTGT)
//   [01b] Kỳ tính thuế: Quý 3 năm 2026            ([01] ở 05/KK-TNCN; "Tháng 09 năm 2026"; "Năm 2025")
//   [02] Lần đầu: [X] [03] Bổ sung lần thứ: [ ]   / [02] Lần đầu: [ ] [03] Bổ sung lần thứ: [2]
//   [05] Mã số thuế: 0300000002
//   1 Giá trị và thuế GTGT của HHDV mua vào [23] 1.234.567 [24] 123.456
//   III Thuế GTGT phát sinh trong kỳ ([36]=[35]-[25]) [36] (1.234)      ← số trong ngoặc là số âm
//   Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21]=[22]+[23] [21] VNĐ 1.234.567   ← 05/KK-TNCN có đơn vị
// Dòng công thức "[27]=[29]+[30]" không phải giá trị: sau mã chỉ tiêu là "=" chứ không phải số.
import { soO } from './bangKe.js'

const LOAI = [
  [/01\/GTGT/, '01/GTGT'], [/05\/KK-?\s*TNCN/, '05/KK-TNCN'], [/05\/QTT-?\s*TNCN/, '05/QTT-TNCN'], [/03\/TNDN/, '03/TNDN'],
]

// Có phải thông báo của cơ quan thuế (tiếp nhận / chấp nhận) chứ không phải tờ khai?
export const laThongBaoPdf = chu => /TB-TĐT|THÔNG BÁO\s+V\/v|Chấp nhận việc nộp hồ sơ|tiếp nhận hồ sơ khai thuế/i.test(chu)

// "Quý 3 năm 2026" | "Tháng 09 năm 2026" | "Năm 2025" | "Q3/2026" → { loai, so, nam }
export function kyTuChu(s) {
  let m = String(s).match(/Qu[ýy]\s*([1-4])\s*n[ăa]m\s*(20\d\d)/i)
  if (m) return { loai: 'Q', so: +m[1], nam: +m[2] }
  m = String(s).match(/Th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(20\d\d)/i)
  if (m && +m[1] >= 1 && +m[1] <= 12) return { loai: 'T', so: +m[1], nam: +m[2] }
  m = String(s).match(/N[ăa]m\s*(20\d\d)/i)
  if (m) return { loai: 'N', so: 0, nam: +m[1] }
  return null
}
const maKy = k => (!k ? '' : k.loai === 'N' ? `NAM.${k.nam}` : `${k.loai === 'Q' ? 'Q' + k.so : 'T' + String(k.so).padStart(2, '0')}.${k.nam}`)

// Chỉ tiêu trên một dòng: "[23] 1.234 [24] 56" → { '23': 1234, '24': 56 }. Bỏ "[18]=[19]+[20]", "[02] Lần đầu: [X]".
// Mã có phần lẻ: PDF ghi "[25.1]", XML ghi ct25_1 → đổi về dạng XML. Ô đánh dấu "[21] []" / "[21] [X]" → 0 / 1
// (XML ghi 0/1 cho các ô này — đối chiếu file thật 127HOME).
const MA = '(\\d{1,3}[a-z]?(?:\\.\\d+)?)'
const maXml = ma => ma.replace('.', '_')
export function chiTieuTrenDong(dong) {
  const ra = {}
  for (const m of String(dong).matchAll(new RegExp(`\\[${MA}\\]\\s+(?:(?:Người|VNĐ|Đồng|đồng|%)\\s+)?(\\(?-?\\d[\\d.,]*\\)?)(?=\\s|$)`, 'g'))) {
    const v = soO(m[2])
    if (v != null && !(maXml(m[1]) in ra)) ra[maXml(m[1])] = v
  }
  for (const m of String(dong).matchAll(new RegExp(`\\[${MA}\\]\\s+\\[\\s*(X?)\\s*\\]`, 'gi'))) {
    if (!(maXml(m[1]) in ra)) ra[maXml(m[1])] = m[2] ? 1 : 0
  }
  return ra
}
// Dòng đầu tờ khai có MỘT ô đánh dấu ở cuối: "[15] Phân bổ thuế do có đơn vị …: [ ]"
const oDanhDauDauTk = dong => {
  const m = String(dong).match(/^\s*\[(\d{2})\][^[]*:\s*\[\s*(X?)\s*\]\s*$/i)
  return m ? { [m[1]]: m[2] ? 1 : 0 } : {}
}

// trang: [[dòng…], …] (đã sắp từ trên xuống, trái sang phải). Chỉ cần các trang tờ khai, không cần phụ lục.
export function docToKhaiPdfChu(trang) {
  const dong = []
  for (const t of trang) {
    for (const d of t) dong.push(d)
    if (t.some(d => /Tôi cam đoan/i.test(d))) break       // hết phần tờ khai, phía sau là bảng kê / phụ lục
  }
  const chu = dong.join('\n')
  if (!chu.trim()) return { ok: false, scan: true, loi: 'PDF không có lớp chữ (ảnh scan)' }
  if (laThongBaoPdf(chu)) return { ok: false, khongPhai: true }
  const phang = chu.replace(/\s+/g, ' ')
  const loai = LOAI.find(([re]) => re.test(phang))?.[1] || null
  const dongKy = dong.find(d => /Kỳ tính thuế/i.test(d)) || ''
  const ky = kyTuChu(dongKy.replace(/.*Kỳ tính thuế\s*:?/i, ''))
  if (!loai || !ky) return { ok: false, loi: !loai ? 'Không nhận ra mẫu tờ khai trong PDF' : 'Không thấy dòng "Kỳ tính thuế"' }
  const dongLan = dong.find(d => /Lần đầu/i.test(d)) || ''
  const bs = dongLan.match(/Bổ sung lần thứ\s*:?\s*\[\s*(\d+)\s*\]/i)
  const lanBoSung = bs ? Number(bs[1]) : 0
  const mst = (dong.map(d => d.match(/\[0?5\]\s*Mã số thuế\s*:?\s*([\d-]{10,14})/i)).find(Boolean) || [])[1] || ''
  const ten = (dong.map(d => d.match(/\[0?4\]\s*Tên người nộp thuế\s*:?\s*(.+)$/i)).find(Boolean) || [])[1] || ''
  const ngay = phang.match(/Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(20\d\d)/i)
  const chiTieu = {}
  for (const d of dong) {
    // Bỏ phần đầu tờ khai ([01]…[15]: kỳ, tên, MST, địa chỉ, điện thoại) — không phải chỉ tiêu số liệu
    const them = (/^\s*\[(0\d|1[0-5])[a-z]?\]/.test(d) && !/\[(1[6-9]|[2-9]\d)\]/.test(d)) ? oDanhDauDauTk(d) : chiTieuTrenDong(d)
    for (const [k, v] of Object.entries(them)) if (!(k in chiTieu)) chiTieu[k] = v
  }
  return {
    ok: true,
    tk: {
      loai, maTKhai: null, ky, maKy: maKy(ky),
      chinhThuc: lanBoSung === 0, lanBoSung,
      ngayLap: ngay ? `${ngay[3]}-${ngay[2].padStart(2, '0')}-${ngay[1].padStart(2, '0')}` : '',
      mst: mst.replace(/\D/g, ''), tenNNT: ten.trim(), phanMem: null,
      chiTieu, phuLuc: {}, nguon: 'pdf',
    },
  }
}
