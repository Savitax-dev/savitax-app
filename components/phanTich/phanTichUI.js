'use client'
// Phần tử giao diện dùng chung cho Phân hệ Soát xét báo cáo + Rủi ro thuế (mockup docs/mockup-phan-tich).
//
// Bám ngôn ngữ của Tờ khai (components/tokhaiUI.js — cùng bảng màu MAU, màu luôn đi kèm chữ), thêm:
// ô tổng "sinh động" (dải màu trên đầu, số đậm), và kiểu bảng chung: các dòng tách rời thành dải, xen kẽ 2
// tông nền, KHÔNG vạch màu đầu dòng (anh duyệt mockup 26/10/2026), đầu bảng nền đỏ đô.
//
// ⚠ CHỮ ĐẬM TỐI ĐA font-bold (700). App dùng Arial; trên Windows độ đậm 800/900 (font-extrabold / font-black) bị đổi
// sang ARIAL BLACK — kiểu chữ khác hẳn, bè ra, dấu tiếng Việt méo (anh chỉ 27/10/2026; đo: 700 → 420px, 800 → 470px).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MAU } from '@/components/tokhaiUI'

export { MAU }
const HEX = { xanhDuong: '#2563EB', xanhLa: '#059669', hoPhach: '#D97706', xam: '#64748B', do: '#DC2626', tim: '#7C3AED' }

// Thanh chuyển màn hình của Soát xét báo cáo. Màn nào chưa làm thì chưa hiện — không để nút chết.
const MUC_SOAT = [
  { href: '/soatbaocao', nhan: 'Công ty của tôi', mo: 'Công ty mình phụ trách và thư mục đã trỏ' },
  { href: '/soatbaocao/ho-so', nhan: 'Hồ sơ dữ liệu', mo: 'App thấy gì trong thư mục công ty' },
  { href: '/soatbaocao/soat-ky', nhan: 'Soát kỳ', mo: 'Soát từng tháng / quý: tờ khai ↔ bảng kê ↔ hóa đơn' },
  { href: '/soatbaocao/tang-truong', nhan: 'Tăng trưởng & phí', mo: '6 chỉ tiêu theo quý, căn cứ điều chỉnh phí' },
  { href: '/soatbaocao/nam', nhan: 'Soát xét năm', mo: 'BCTC ↔ CĐPS ↔ sổ sách ↔ tờ khai ↔ quyết toán cả năm, chỉ số tài chính' },
]
export function TabSoat({ giuCty }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
      {MUC_SOAT.map(m => {
        const dangMo = pathname === m.href
        const href = giuCty && m.href !== '/soatbaocao' ? `${m.href}?cty=${giuCty}` : m.href
        return (
          <Link key={m.href} href={href} title={m.mo}
            className={'px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ' + (dangMo
              ? 'border-[#8B1A1A] text-[#8B1A1A] font-semibold bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-[#8B1A1A] hover:bg-red-50/30')}>
            {m.nhan}
          </Link>
        )
      })}
    </div>
  )
}

// Thanh chuyển màn của Rủi ro thuế. Các màn sau "Công ty của tôi" là CÙNG một trang (/ruirothue/phan-tich?xem=…)
// nên chuyển tab không đọc lại thư mục.
const MUC_RUI_RO = [
  { xem: '', nhan: 'Công ty của tôi', mo: 'Công ty mình phụ trách và thư mục đã trỏ' },
  { xem: 'ho-so', nhan: 'Hồ sơ đã đọc', mo: 'Tờ khai, quyết toán, BCTC app tìm thấy trong thư mục + số tự tìm' },
  { xem: 'bang', nhan: 'Bảng 39 tiêu chí', mo: 'Số liệu, chênh lệch, tỷ lệ của từng tiêu chí' },
  { xem: 'chi-tiet', nhan: 'Chi tiết tiêu chí', mo: 'Nguồn số, nguyên nhân thường gặp, hồ sơ nên chuẩn bị, căn cứ' },
  { xem: 'nhieu-nam', nhan: 'Nhiều năm', mo: 'Số liệu và chênh lệch qua các năm' },
]
export function TabRuiRo({ giuCty, xem = '' }) {
  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
      {MUC_RUI_RO.map(m => {
        const dangMo = xem === m.xem
        const href = !m.xem ? '/ruirothue' : `/ruirothue/phan-tich?${giuCty ? `cty=${giuCty}&` : ''}xem=${m.xem}`
        return (
          <Link key={m.xem || 'ds'} href={href} title={m.mo}
            className={'px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ' + (dangMo
              ? 'border-[#8B1A1A] text-[#8B1A1A] font-semibold bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-[#8B1A1A] hover:bg-red-50/30')}>
            {m.nhan}
          </Link>
        )
      })}
    </div>
  )
}

export function OTongSinhDong({ so, nhan, mau = 'xam', phu }) {
  const h = HEX[mau] || HEX.xam
  return (
    <div className="relative rounded-2xl bg-white shadow-sm overflow-hidden border" style={{ borderColor: h + '33' }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg,${h},${h}66)` }} />
      <div className="px-4 pt-2.5 pb-3 min-h-[86px]" style={{ background: `linear-gradient(180deg,${h}14,#fff 80%)` }}>
        <div className="absolute -right-4 -bottom-5 w-16 h-16 rounded-full" style={{ background: h + '12' }} />
        <p className="text-3xl font-bold leading-none tabular-nums" style={{ color: h }}>{so}</p>
        <p className="text-xs mt-1.5 font-semibold text-gray-700">{nhan}</p>
        {phu && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={typeof phu === 'string' ? phu : ''}>{phu}</p>}
      </div>
    </div>
  )
}

export function ChipMau({ nhan, mau = 'xam', title }) {
  const m = MAU[mau] || MAU.xam
  return (
    <span title={title || ''} className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${m.nen} ${m.chu} ${m.vien}`}>
      <span className={'w-1.5 h-1.5 rounded-full ' + m.dam} />{nhan}
    </span>
  )
}

// Nhãn định dạng file: XML tin cậy nhất → Excel → PDF → HTML → còn lại
const DUOI = { xml: ['XML', 'xanhLa'], xlsx: ['Excel', 'xanhLa'], xls: ['Excel', 'xanhLa'], xlsm: ['Excel', 'xanhLa'], csv: ['CSV', 'xanhLa'],
  pdf: ['PDF', 'xanhDuong'], html: ['HTML', 'tim'], htm: ['HTML', 'tim'], rar: ['.rar', 'hoPhach'], zip: ['.zip', 'hoPhach'], '7z': ['.7z', 'hoPhach'],
  jpg: ['Ảnh', 'hoPhach'], jpeg: ['Ảnh', 'hoPhach'], png: ['Ảnh', 'hoPhach'], doc: ['Word', 'xam'], docx: ['Word', 'xam'] }
export function NhanDuoi({ dinhDang = [] }) {
  const ds = [...new Map(dinhDang.map(d => [DUOI[d]?.[0] || d.toUpperCase(), DUOI[d]?.[1] || 'xam'])).entries()]
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ds.map(([n, mau]) => {
        const m = MAU[mau]
        return <span key={n} className={`inline-block rounded px-1 py-px text-[10px] font-semibold border ${m.nen} ${m.chu} ${m.vien}`}>{n}</span>
      })}
    </span>
  )
}

// Kiểu bảng chung — bọc bảng trong <div className="pt-bang">.
export function KieuBang() {
  return (
    <style>{`
      /* Dòng LIỀN NHAU, chỉ khác tông nền xen kẽ + kẻ dọc giữa các cột (anh chốt 26/10/2026 — bỏ kiểu dòng tách dải) */
      .pt-bang { border: 1px solid #DCE2EB; border-radius: 12px; background: #fff; }
      .pt-bang table { border-collapse: separate; border-spacing: 0; width: 100%; }
      .pt-bang thead th { background: #8B1A1A; color: #fff; padding: 10px 12px; font-weight: 600; font-size: 12px; position: sticky; top: 0; z-index: 1; border-right: 1px solid rgba(255,255,255,.22); }
      /* Canh trái mặc định NHƯNG để class text-right / text-center của từng cột thắng — trước đây quy tắc này đè mất
         text-right nên tiêu đề cột số nằm lệch với số bên dưới (anh chỉ 26/10/2026) */
      .pt-bang thead th:not(.text-right):not(.text-center) { text-align: left; }
      .pt-bang thead th:first-child { border-top-left-radius: 11px; } .pt-bang thead th:last-child { border-top-right-radius: 11px; border-right: 0; }
      .pt-bang tbody td { background: #fff; padding: 9px 12px; border-bottom: 1px solid #E3E8F0; border-right: 1px solid #E3E8F0; vertical-align: middle; }
      .pt-bang tbody td:last-child { border-right: 0; }
      .pt-bang tbody tr:last-child td { border-bottom: 0; }
      .pt-bang tbody tr:last-child td:first-child { border-bottom-left-radius: 11px; } .pt-bang tbody tr:last-child td:last-child { border-bottom-right-radius: 11px; }
      .pt-bang tbody tr:nth-child(even) td { background: #F2F6FC; }
      .pt-bang tbody tr:hover td { background: #FFF7E8; }
      /* Xen kẽ theo nhóm (bảng dạng cây): dòng con cùng tông với dòng cha — đè lên nth-child ở trên */
      .pt-bang tbody tr.pt-n0 td { background: #fff; }
      .pt-bang tbody tr.pt-n1 td { background: #F2F6FC; }
      .pt-bang tbody tr.pt-mo td { background: #FFFBF2 !important; }
      .pt-bang tbody tr.pt-con td { background: #FAFAFA !important; padding-top: 6px; padding-bottom: 6px; }
      .pt-khung-tieu-de { background: linear-gradient(90deg,#FBEDED,#FFFFFF 65%); box-shadow: inset 4px 0 0 #8B1A1A; }
    `}</style>
  )
}

export const coChu = n => n == null ? '—' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'
export const ngaySua = t => (t ? new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
