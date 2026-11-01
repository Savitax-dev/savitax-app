'use client'
// Thanh tab của Chấm công & Lương (/luong) — dùng ở trang chính (tab đổi tại chỗ) và trang /luong/huong-dan (tab là
// liên kết quay về /luong?tab=…). Tab "📖 Hướng dẫn dùng" luôn có, mở trang tài liệu docs/huong-dan-cham-cong-luong.md.
// Kiểu: các khối tách rời chia đều một khung, chữ không xuống dòng (anh duyệt 23/10/2026).
import Link from 'next/link'

export function dsTabLuong(quyen) {
  return [
    quyen?.cham_cong && ['cua_toi', 'Chấm công của tôi', '🗓️'],
    (quyen?.congToanCty || quyen?.phongTruong?.length > 0) && ['phong', quyen.congToanCty ? 'Chấm công toàn công ty' : 'Chấm công phòng', '👥'],
    quyen?.cham_cong && ['dvk', 'Thưởng dịch vụ khác', '🧾'],
    quyen?.cham_cong && ['phieu', 'Phiếu lương của tôi', '📄'],
    quyen?.view && ['bang_luong', 'Bảng lương', '💰'],
    quyen?.manage && ['thiet_lap', 'Cấp bậc & ngày lễ', '⚙️'],
  ].filter(Boolean)
}

const LOP = dangMo => 'flex-1 min-w-[170px] flex items-center justify-center gap-2 px-3 py-2 text-sm whitespace-nowrap rounded-xl border transition-all ' + (dangMo
  ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white font-semibold shadow-md'
  : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-[#8B1A1A]/30 hover:bg-rose-50 hover:text-[#8B1A1A]')

// onChon có → nút đổi tab tại chỗ; không có → liên kết về /luong?tab=…
export default function ThanhTabLuong({ quyen, tab, onChon }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3 w-full p-1.5 rounded-2xl bg-white border border-gray-200 shadow-sm">
      {dsTabLuong(quyen).map(([k, l, ic]) => {
        const noiDung = <><span className="text-lg leading-none">{ic}</span><span className="truncate">{l}</span></>
        return onChon
          ? <button key={k} onClick={() => onChon(k)} className={LOP(tab === k)}>{noiDung}</button>
          : <Link key={k} href={'/luong?tab=' + k} className={LOP(tab === k)}>{noiDung}</Link>
      })}
      <Link href="/luong/huong-dan" className={LOP(tab === 'huong_dan')} title="Lịch hằng tháng, cách khai công, thưởng dịch vụ khác, phiếu lương, phần trưởng phòng">
        <span className="text-lg leading-none">📖</span><span className="truncate">Hướng dẫn dùng</span>
      </Link>
    </div>
  )
}
