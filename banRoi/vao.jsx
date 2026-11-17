// Bản rời "Savitax Hồ Sơ" — tệp khởi động. scripts/dung-ban-roi.mjs gói tệp này + mã màn hình của app thành MỘT file HTML
// chạy thẳng trên máy (Chrome / Edge), không máy chủ, không đăng nhập. Kế hoạch: docs/ban-html-roi-ke-hoach.md.
//
// Mã màn hình Soát xét / Rủi ro thuế lấy NGUYÊN VĂN từ app (app/soatbaocao, app/ruirothue, components/phanTich, lib/…).
// Lúc gói, những chỗ app dựa vào Next.js / máy chủ được thay bằng bản chạy trên máy:
//   next/navigation, next/link   → banRoi/shim (đường dẫn trang nằm sau dấu #)
//   @/lib/supabase               → banRoi/shim/supabase.js (không đăng nhập)
//   @/components/AppShell        → banRoi/khung/AppShell.jsx (menu bản rời)
//   @/components/ThanhTab        → banRoi/shim/ThanhTab.jsx (bỏ tab Tăng trưởng & phí)
//   fetch('/api/admin/phantich/…') → banRoi/apiMay.js (trả lời từ dữ liệu trên máy, đúng khuôn route)
import './apiMay'
import { createRoot } from 'react-dom/client'
import * as pdfjs from 'pdfjs-dist'
import workerPdf from 'ban-roi:worker-pdf'   // worker pdf.js dạng classic, scripts/dung-ban-roi.mjs dựng sẵn
import { napKho } from './kho'
import { usePathname } from './shim/dieuHuong'

import TongQuan from './khung/TongQuan'
import DanhSachCongTy from './khung/DanhSachCongTy'
import CaiDat from './khung/CaiDat'
import QuyUoc from './khung/QuyUoc'
import { HuongDanSoat, HuongDanRuiRo } from './khung/HuongDan'
import SoatCongTy from '@/app/soatbaocao/page'
import SoatHoSo from '@/app/soatbaocao/ho-so/page'
import SoatKy from '@/app/soatbaocao/soat-ky/page'
import SoatNam from '@/app/soatbaocao/nam/page'
import RuiRoCongTy from '@/app/ruirothue/page'
import RuiRoPhanTich from '@/app/ruirothue/phan-tich/page'
import HoSoChungTu from './khung/HoSoChungTu'   // phân hệ JS thuần (banRoi/hoSoChungTu), khung chỉ gắn vào
import AppShell from './khung/AppShell'

// pdf.js cần một "worker" ở file riêng — bản rời chỉ có một file, nên nhúng mã worker và dựng từ Blob. Gắn sẵn ở đây thì
// lib/phanTich/doc/pdfChu.js thấy đã có workerPort, không đi nạp file worker riêng nữa.
// Worker DẠNG THƯỜNG (không { type: 'module' }): Chrome chặn worker module từ Blob khi trang mở bằng file:// → pdf.js treo.
try {
  const url = URL.createObjectURL(new Blob([workerPdf], { type: 'text/javascript' }))
  pdfjs.GlobalWorkerOptions.workerPort = new Worker(url)
} catch (e) { console.warn('Không dựng được worker pdf.js:', e) }

const TUYEN = {
  '/': TongQuan,
  '/cong-ty': DanhSachCongTy,
  '/cai-dat': CaiDat,
  '/soatbaocao': SoatCongTy,
  '/soatbaocao/ho-so': SoatHoSo,
  '/soatbaocao/soat-ky': SoatKy,
  // '/soatbaocao/tang-truong' — Tăng trưởng & phí: bản rời không có (anh bỏ 15/11/2026, xem shim/ThanhTab.jsx)
  '/soatbaocao/nam': SoatNam,
  '/soatbaocao/quy-uoc': QuyUoc,
  '/soatbaocao/huong-dan': HuongDanSoat,
  '/ruirothue/huong-dan': HuongDanRuiRo,
  '/ruirothue': RuiRoCongTy,
  '/ruirothue/phan-tich': RuiRoPhanTich,
  '/ho-so-chung-tu': HoSoChungTu,
}

function KhongCo() {
  return <AppShell><div className="p-6 text-gray-500">Trang này không có trong bản chạy trên máy. <a className="text-[#8B1A1A] underline" href="#/">Về Tổng quan</a></div></AppShell>
}

function Goc() {
  const p = usePathname()
  const Trang = TUYEN[p] || KhongCo
  return <Trang key={p} />
}

// Xin Chrome đánh dấu dữ liệu của trang là "lưu lâu dài" — không thì khi ổ đĩa đầy, Chrome được phép tự xoá danh sách công
// ty, cài đặt, quyền đọc thư mục. Không được cũng không sao (vẫn chạy, chỉ là kém bền hơn) → nhắc sao lưu ở Tổng quan.
try { navigator.storage?.persist?.().catch(() => {}) } catch {}

napKho().then(() => createRoot(document.getElementById('goc')).render(<Goc />))
