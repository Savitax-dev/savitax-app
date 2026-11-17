// Bản rời — trả lời các lời gọi /api/admin/phantich/* của mã app NGAY TRÊN MÁY, đúng khuôn JSON máy chủ thật trả về
// (app/api/admin/phantich/{cong-ty,phi,han-nop}/route.js). Nhờ vậy mã màn hình Soát xét / Rủi ro thuế của app dùng
// nguyên văn, không sửa dòng nào. Đổi khuôn route ở app thì phải sửa cả chỗ này.
import { layKho, ngayLeSet } from './kho'
import { loaiApDung, nghiaVuDinhKy, nghiaVuQuyetToan } from '@/lib/tokhaiLich'

// Danh mục loại tờ khai = bảng tax_filing_types của app chính (16/11/2026), bỏ 04/SS-HĐĐT (theo sự kiện, không có lịch).
const LOAI_TO_KHAI = [
  { id: '01/GTGT', code: '01/GTGT', name: 'Tờ khai thuế giá trị gia tăng (khấu trừ)', period_kind: 'quarter' },
  { id: '01/CNKD', code: '01/CNKD', name: 'Tờ khai thuế đối với hộ kinh doanh, cá nhân kinh doanh', period_kind: 'quarter' },
  { id: '05/KK-TNCN', code: '05/KK-TNCN', name: 'Tờ khai khấu trừ thuế thu nhập cá nhân', period_kind: 'quarter' },
  { id: '03/TNDN', code: '03/TNDN', name: 'Quyết toán thuế thu nhập doanh nghiệp', period_kind: 'settlement' },
  { id: '05/QTT-TNCN', code: '05/QTT-TNCN', name: 'Quyết toán thuế thu nhập cá nhân', period_kind: 'settlement' },
  { id: 'BCTC', code: 'BCTC', name: 'Báo cáo tài chính năm', period_kind: 'settlement' },
]

// Lịch hạn nộp của một công ty trong năm — cùng hàm sinh lịch của phân hệ Tờ khai (lib/tokhaiLich.js), đẩy qua ngày nghỉ ở
// Cài đặt. Bản rời không có hồ sơ đồng bộ từ cổng nên hoSo luôn rỗng, trangThai để trống (đã nộp hay chưa xem ở thư mục).
// Bản rời chỉ có MỘT kỳ khai cho công ty → 05/KK-TNCN đi theo kỳ khai đó; hộ kinh doanh chỉ có 01/CNKD (không biết hộ có
// từng nộp 01/GTGT / 05/KK hay không).
export function lichHanNop(c, nam) {
  const client = { id: c.id, report_type: c.kyKhai === 'thang' ? 'monthly' : 'quarterly', is_hkd: !!c.laHkd, contract_start: c.batDau || null }
  const ngayLe = ngayLeSet()
  const ra = []
  for (const loai of LOAI_TO_KHAI) {
    if (!loaiApDung(client, loai, false)) continue
    const ds = loai.period_kind === 'settlement' ? nghiaVuQuyetToan({ client, loai, nam, ngayLe }) : nghiaVuDinhKy({ client, loai, nam, ngayLe })
    for (const o of ds) ra.push({ ma: loai.code, ten: loai.name, ky: o.period_code, han: o.due_date, trangThai: null, theoLich: true, hoSo: [] })
  }
  return ra.sort((a, b) => String(a.ky).localeCompare(String(b.ky)) || String(a.ma).localeCompare(String(b.ma)))
}

const fetchGoc = window.fetch.bind(window)
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

// Khuôn của route cong-ty (bản rời không có phòng / nhân viên phụ trách)
export const sangKhuonCongTy = c => ({
  id: c.id, ten: c.ten, maKH: c.maKH || '', mst: c.mst || '', kyKhai: c.kyKhai === 'thang' ? 'thang' : 'quy',
  laHkd: !!c.laHkd, batDau: c.batDau || null, ngungTu: null, roomId: null, phong: '', nhanVien: '', nhanVienPhu: [], vaiTro: 'chinh',
})

function traLoi(url) {
  const u = new URL(url, 'http://may')
  const cty = id => layKho().congTy.find(c => String(c.id) === String(id))
  switch (u.pathname) {
    case '/api/admin/phantich/cong-ty':
      return json({ congTy: layKho().congTy.map(sangKhuonCongTy).sort((a, b) => (a.ten || '').localeCompare(b.ten || '', 'vi')) })
    // '/api/admin/phantich/phi' chỉ màn Tăng trưởng & phí dùng — bản rời đã bỏ màn đó (15/11/2026)
    case '/api/admin/phantich/han-nop': {
      const c = cty(u.searchParams.get('cty')), nam = Number(u.searchParams.get('nam'))
      if (!c || !(nam >= 2000 && nam <= 2100)) return json({ error: 'Thiếu công ty hoặc năm' }, 400)
      return json({ nghiaVu: lichHanNop(c, nam) })
    }
    default:
      return json({ error: 'Bản chạy trên máy không có máy chủ (' + u.pathname + ')' }, 404)
  }
}

window.fetch = async (vao, tuyChon) => {
  const url = typeof vao === 'string' ? vao : vao?.url || String(vao)
  if (url.startsWith('/api/')) return traLoi(url)
  return fetchGoc(vao, tuyChon)
}
