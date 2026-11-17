// Bản rời — cây thư mục mẫu SVT.MB09: xem trước (bấm mở / gập) + tải về dạng ZIP chỉ gồm thư mục rỗng + file "ĐỌC TRƯỚC".
// Danh sách thư mục ở banRoi/cayMau.json (chép từ cây ISO trên ổ G:, CHỈ tên thư mục — cây gốc có chứng từ hải quan thật của
// khách nên không chép file nào). ZIP dựng ngay trên máy lúc bấm, bằng JSZip đã nhúng trong file.
import CAY from '../cayMau.json'

const NAM = '2. HỒ SƠ KẾ TOÁN/NĂM TÀI CHÍNH'
// Thư mục app lấy số liệu / thư mục phải đổi tên
const NHAN = {
  [NAM]: ['Đổi thành Năm 2026', 'bg-amber-100 text-amber-800'],
  [NAM + '/2. HÓA ĐƠN MUA VÀO_BÁN RA']: ['app đọc', 'bg-emerald-50 text-emerald-700'],
  [NAM + '/5. BẢO HIỂM XÃ HỘI/1. C12']: ['app đọc', 'bg-emerald-50 text-emerald-700'],
  [NAM + '/6. LƯƠNG/1. BẢNG LƯƠNG_BẢNG CHẤM CÔNG']: ['app đọc', 'bg-emerald-50 text-emerald-700'],
  [NAM + '/7. BỘ BÁO CÁO']: ['app đọc', 'bg-emerald-50 text-emerald-700'],
  [NAM + '/8. SỔ SÁCH KẾ TOÁN/3. BẢNG CÂN ĐỐI TÀI KHOẢN MẪU 2 BÊN (BẬC 3)']: ['app đọc', 'bg-emerald-50 text-emerald-700'],
}

const DOC_TRUOC = [
  'CÂY THƯ MỤC MẪU — SVT.MB09 (Savitax)',
  '',
  `1. Giải nén, đổi tên thư mục gốc "${CAY.goc}" thành "<Mã KH> - <Tên công ty>".`,
  '2. Trong "2. HỒ SƠ KẾ TOÁN": đổi "NĂM TÀI CHÍNH" thành "Năm 2026" (mỗi năm một thư mục: sao chép rồi đổi tên).',
  '3. Không đổi tên, không thêm thư mục cấp 1 khác. Loại hồ sơ không phát sinh thì thêm " (kps)" vào cuối tên thư mục đó.',
  '4. Công ty khai thuế theo tháng: đổi "QUÝ 1…QUÝ 4" ở mục 2 thành "THÁNG 01…THÁNG 12", "BCT-Q1…Q4" ở mục 7 thành "BCT-T01…T12".',
  '5. Giữ file gốc XML / Excel tải từ cổng thuế, cổng hóa đơn, phần mềm kế toán; PDF chỉ là bản xem kèm theo.',
  '',
  'Quy tắc đặt tên file từng mục: app Savitax Hồ Sơ → Soát xét báo cáo → tab "Quy ước lưu hồ sơ".',
].join('\r\n')

export async function taiCayThuMuc() {
  const mod = await import('jszip')
  const JSZip = mod.default || mod
  const zip = new JSZip()
  const goc = zip.folder(CAY.goc)
  for (const t of CAY.thuMuc) goc.folder(t)
  goc.file('ĐỌC TRƯỚC.txt', '﻿' + DOC_TRUOC)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', platform: 'DOS' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'SVT.MB09 - CAY THU MUC MAU.zip'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return CAY.thuMuc.length
}

function dungCay() {
  const goc = { con: {} }
  for (const p of CAY.thuMuc) { let n = goc; for (const t of p.split('/')) n = n.con[t] = n.con[t] || { con: {} } }
  return goc
}

function Nut({ ten, nut, duong, cap }) {
  const coCon = Object.keys(nut.con).length > 0
  const nh = NHAN[duong]
  const dong = (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-0.5 hover:bg-amber-50" style={{ paddingLeft: cap * 14 + 4 }}>
      <span className="w-3 text-[10px] text-gray-400">{coCon ? '▸' : ''}</span>📁 {ten}
      {nh && <span className={'ml-1 rounded px-1.5 text-[10px] font-bold ' + nh[1]}>{nh[0]}</span>}
    </span>
  )
  if (!coCon) return <div className="text-[12.5px]">{dong}</div>
  return (
    <details open={NAM.startsWith(duong)} className="text-[12.5px] [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer">{dong}</summary>
      {Object.entries(nut.con).map(([t, c]) => <Nut key={t} ten={t} nut={c} duong={duong + '/' + t} cap={cap + 1} />)}
    </details>
  )
}

export function XemCayThuMuc() {
  const goc = dungCay()
  return (
    <div className="max-h-[560px] overflow-auto pr-1">
      <div className="text-[12.5px] font-bold text-gray-800">📂 {CAY.goc}</div>
      {Object.entries(goc.con).map(([t, c]) => <Nut key={t} ten={t} nut={c} duong={t} cap={1} />)}
    </div>
  )
}

export const SO_THU_MUC = CAY.thuMuc.length
