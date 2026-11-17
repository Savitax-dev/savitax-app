// Bản rời — Tổng quan: các bước bắt đầu + lối vào từng phân hệ + điều kiện chạy của trình duyệt.
import { useEffect, useState } from 'react'
import AppShell, { duongPhanHe } from './AppShell'
import { useKho } from '../kho'
import { coHoTro } from '@/lib/phanTich/khoMay'
import { layDongPdf } from '@/lib/phanTich/doc/pdfChu'

// Một trang PDF tí hon có chữ "Savitax OK" — đọc thử bằng đúng bộ đọc PDF của Soát xét (pdf.js + worker nhúng trong file).
// Thiếu bảng xref cố ý: pdf.js tự dựng lại, khỏi phải tính vị trí byte.
const PDF_THU = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 50]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
  '4 0 obj<</Length 41>>stream\nBT /F1 12 Tf 10 20 Td (Savitax OK) Tj ET\nendstream endobj\n' +
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'

function useDocThuPdf() {
  const [kq, setKq] = useState(null)   // null = đang thử · true · chuỗi lỗi
  useEffect(() => {
    let huy = false
    const hen = setTimeout(() => !huy && setKq('quá 15 giây không đọc xong'), 15000)
    layDongPdf(new TextEncoder().encode(PDF_THU).buffer)
      .then(r => { if (!huy) setKq(JSON.stringify(r).includes('Savitax OK') ? true : 'đọc ra nhưng không thấy chữ') })
      .catch(e => { if (!huy) setKq(e?.message || String(e)) })
      .finally(() => clearTimeout(hen))
    return () => { huy = true; clearTimeout(hen) }
  }, [])
  return kq
}

function Buoc({ so, xong, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ' + (xong ? 'bg-emerald-600 text-white' : 'bg-[#8B1A1A] text-white')}>{xong ? '✓' : so}</span>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  )
}

export default function TongQuan() {
  const { congTy, caiDat, khoLoi } = useKho()
  const pdf = useDocThuPdf()
  const dieuKien = [
    ['Mở từ ổ đĩa (file://)', location.protocol === 'file:'],
    ['Trỏ thư mục (Chrome / Edge trên máy tính)', coHoTro()],
    ['Lưu dữ liệu trên máy (IndexedDB)', !khoLoi],
    [pdf === null ? 'Đọc được file PDF — đang thử…' : 'Đọc được file PDF' + (pdf === true ? '' : ` (${pdf})`), pdf === null ? null : pdf === true],
  ]
  const PH = [
    ['soat', '🔎', 'Soát xét báo cáo', 'Đọc thư mục công ty (chỉ đọc): hồ sơ có / thiếu, soát từng kỳ tờ khai ↔ bảng kê ↔ hóa đơn, soát xét năm.'],
    ['ruiro', '⚖️', 'Rủi ro thuế', '39 tiêu chí theo tờ khai, quyết toán, BCTC — số liệu, chênh lệch, tỷ lệ, hồ sơ nên chuẩn bị. Dùng chung thư mục với Soát xét.'],
  ]
  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="text-2xl">🏠</span><h1 className="text-xl font-bold text-gray-800">Tổng quan</h1></div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 font-bold text-gray-800">Bắt đầu</h2>
              <Buoc so={1} xong={congTy.length > 0}>Thêm công ty ở <a className="font-semibold text-[#8B1A1A] underline" href="#/cong-ty">Danh sách công ty</a> — gõ MST rồi 🔍 để tự điền tên, địa chỉ; hoặc nhập cả danh sách từ Excel.</Buoc>
              <Buoc so={2}>Bấm <b>Trỏ thư mục</b> cho từng công ty — chọn thư mục GỐC của công ty trên ổ chung (thư mục có <code>2. HỒ SƠ KẾ TOÁN</code>). App chỉ đọc, không ghi gì.</Buoc>
              <Buoc so={3}>Mở <b>Soát xét báo cáo</b> hoặc <b>Rủi ro thuế</b>. Lần mở app sau, Chrome có thể hỏi lại quyền đọc thư mục một lần — bấm Cho phép.</Buoc>
              <Buoc so={4} xong={!!caiDat.saoLuuLuc}>Thỉnh thoảng vào <a className="font-semibold text-[#8B1A1A] underline" href="#/cai-dat">Cài đặt</a> → Sao lưu (JSON) để chuyển máy hoặc phòng xoá dữ liệu trình duyệt.{caiDat.saoLuuLuc && <span className="text-gray-400"> Lần gần nhất: {new Date(caiDat.saoLuuLuc).toLocaleString('vi-VN')}.</span>}</Buoc>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {PH.map(([ma, ic, ten, mo]) => (
                <div key={ma} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h2 className="font-bold text-gray-800">{ic} {ten}</h2>
                  <p className="my-2 text-sm text-gray-500">{mo}</p>
                  <a href={'#' + duongPhanHe(ma, caiDat.ctyDangLam)} className="inline-block rounded-xl bg-[#8B1A1A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#6B1212]">Mở {ten} →</a>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-bold text-gray-800">Máy này chạy được không</h2>
              {dieuKien.map(([t, ok]) => <p key={t} className="text-sm">{ok === null ? '⏳' : ok ? '✅' : '❌'} {t}</p>)}
              {!coHoTro() && <p className="mt-2 text-xs text-red-700">Không trỏ được thư mục → mở file bằng Chrome hoặc Edge trên máy tính.</p>}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
              <h2 className="mb-1 font-bold text-gray-800">Dữ liệu nằm ở đâu</h2>
              Danh sách công ty, cài đặt, quyền đọc thư mục và bộ nhớ đệm đọc file nằm trong <b>trình duyệt của máy này</b>. Không gửi đi đâu
              (trừ khi bấm 🔍 tra MST: chỉ gửi mã số thuế để tra tên). Xoá dữ liệu duyệt web là mất — nhớ sao lưu.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
