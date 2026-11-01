// Khuôn trang TÀI LIỆU nội bộ trong app (máy chủ): đọc một file docs/*.md mỗi lần mở trang → mục lục bên trái + nội dung
// bên phải. Dùng cho tab "Quy ước lưu hồ sơ" (Soát xét báo cáo) và "Hướng dẫn dùng" (Tờ khai). Sửa tài liệu là trang đổi
// theo ở lần đẩy sau, không chép tay hai nơi.
//
// CẦN ĐĂNG NHẬP — kiểm ở máy chủ: tài liệu có mã khách thật / ảnh chụp màn hình thật, chặn ở trình duyệt thì nội dung vẫn
// nằm sẵn trong HTML. Ảnh đi qua /api/admin/tai-lieu/anh (cũng bắt đăng nhập), KHÔNG chép ra public/.
// Trang dùng khuôn này nhớ khai file .md trong outputFileTracingIncludes (next.config.mjs) — Vercel mới đóng gói kèm.
import fs from 'fs'
import path from 'path'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import MarkdownDon, { tachKhoi, slug } from '@/components/MarkdownDon'
import { requireLogin } from '@/lib/serverAuth'

export default async function TrangTaiLieu({ file, dau, bieuTuong = '📘', nhan = 'Áp dụng cho mọi nhân viên' }) {
  if (!(await requireLogin()).ok) redirect('/login')
  const md = fs.readFileSync(path.join(process.cwd(), 'docs', file), 'utf8')
  const khoi = tachKhoi(md)
  const tieuDe = khoi.find(k => k.loai === 'tieuDe' && k.cap === 1)?.chu || file
  const mucLuc = khoi.filter(k => k.loai === 'tieuDe' && (k.cap === 2 || k.cap === 3))
  return (
    <AppShell>
      <div className="p-4 md:p-6 w-full">
        {dau}
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
          <article className="rounded-2xl border border-gray-200 bg-white p-5 md:p-8 shadow-sm min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
              <span className="text-3xl">{bieuTuong}</span>
              <h2 className="text-2xl font-bold text-[#8B1A1A] flex-1 min-w-[260px]">{tieuDe}</h2>
              {nhan && <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">{nhan}</span>}
            </div>
            <MarkdownDon md={md} boTieuDeChinh anhGoc="/api/admin/tai-lieu/anh/" />
          </article>
        </div>
      </div>
    </AppShell>
  )
}
