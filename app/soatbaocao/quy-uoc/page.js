// Soát xét báo cáo — tab "Quy ước lưu hồ sơ" (anh yêu cầu 01/11/2026): nhân viên tự xem và làm theo.
// Nội dung đọc thẳng từ docs/quy-uoc-luu-ho-so.md mỗi lần mở trang — sửa tài liệu là trang tự đổi theo ở lần đẩy sau,
// không phải chép tay hai nơi. CẦN ĐĂNG NHẬP (kiểm ở máy chủ — tài liệu lấy mã khách thật làm ví dụ, không để lộ
// ra ngoài; chặn ở trình duyệt thì nội dung vẫn nằm sẵn trong HTML). Không đọc thư mục khách.
import fs from 'fs'
import path from 'path'
import AppShell from '@/components/AppShell'
import { TabSoat } from '@/components/phanTich/phanTichUI'
import MarkdownDon, { tachKhoi, slug } from '@/components/MarkdownDon'
import { redirect } from 'next/navigation'
import { requireLogin } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quy ước lưu hồ sơ — App Savitax' }

export default async function TrangQuyUoc() {
  if (!(await requireLogin()).ok) redirect('/login')
  const md = fs.readFileSync(path.join(process.cwd(), 'docs', 'quy-uoc-luu-ho-so.md'), 'utf8')
  const khoi = tachKhoi(md)
  const tieuDe = khoi.find(k => k.loai === 'tieuDe' && k.cap === 1)?.chu || 'Quy ước lưu hồ sơ'
  const mucLuc = khoi.filter(k => k.loai === 'tieuDe' && (k.cap === 2 || k.cap === 3))
  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔎</span>
          <h1 className="text-xl font-bold text-gray-800">Soát xét báo cáo</h1>
        </div>
        <TabSoat />
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
          <nav className="hidden lg:block sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mục lục</p>
            {mucLuc.map((k, i) => (
              <a key={i} href={'#' + slug(k.chu)}
                className={'block rounded-lg px-2 py-1 text-sm hover:bg-red-50 hover:text-[#8B1A1A] ' + (k.cap === 2 ? 'mt-2 font-semibold text-gray-800' : 'pl-4 text-gray-600')}>
                {k.chu.replace(/`/g, '')}
              </a>
            ))}
          </nav>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 md:p-8 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
              <span className="text-3xl">📘</span>
              <h2 className="text-2xl font-bold text-[#8B1A1A] flex-1 min-w-[260px]">{tieuDe}</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Áp dụng cho mọi nhân viên</span>
            </div>
            <MarkdownDon md={md} boTieuDeChinh />
          </article>
        </div>
      </div>
    </AppShell>
  )
}
