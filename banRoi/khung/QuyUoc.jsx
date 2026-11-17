// Bản rời — tab "Quy ước lưu hồ sơ" của Soát xét: cùng nội dung docs/quy-uoc-luu-ho-so.md và cùng bộ hiển thị MarkdownDon
// của app (trang app đọc file ở máy chủ; bản rời nhúng sẵn nội dung lúc dựng).
import AppShell from './AppShell'
import MarkdownDon from '@/components/MarkdownDon'
import { TabSoat } from '@/components/phanTich/phanTichUI'
import md from '../../docs/quy-uoc-luu-ho-so.md?text'

export default function QuyUoc() {
  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <div className="mb-3 flex items-center gap-3"><span className="text-2xl">🔎</span><h1 className="text-xl font-bold text-gray-800">Soát xét báo cáo</h1></div>
        <TabSoat />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><MarkdownDon md={md} /></div>
      </div>
    </AppShell>
  )
}
