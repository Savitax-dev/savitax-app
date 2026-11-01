// Soát xét báo cáo — tab "Quy ước lưu hồ sơ" (anh yêu cầu 01/11/2026): nhân viên tự xem và làm theo.
// Nội dung = docs/quy-uoc-luu-ho-so.md, hiển thị qua khuôn components/TrangTaiLieu.js (bắt đăng nhập ở máy chủ).
import TrangTaiLieu from '@/components/TrangTaiLieu'
import { TabSoat } from '@/components/phanTich/phanTichUI'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quy ước lưu hồ sơ — App Savitax' }

export default function TrangQuyUoc() {
  return (
    <TrangTaiLieu file="quy-uoc-luu-ho-so.md" bieuTuong="📘" dau={<>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🔎</span>
        <h1 className="text-xl font-bold text-gray-800">Soát xét báo cáo</h1>
      </div>
      <TabSoat />
    </>} />
  )
}
