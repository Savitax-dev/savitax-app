// Khung dùng chung cho mockup phân hệ Phòng Pháp lý (/phaply). Bám giao diện app đang chạy:
// Sidebar (components/Sidebar.js), bảng dòng liền xen màu + kẻ dọc, tab chia đều trong một khung,
// chữ đậm tối đa font-bold (Arial). TOÀN BỘ dữ liệu trong mockup là GIẢ LẬP — không phải khách thật.

const DO = '#8B1A1A', VANG = '#C9A84C'

const HEX = {
  do: '#B42318', xanh: '#1D4ED8', la: '#047857', cam: '#B45309', tim: '#6D28D9',
  xam: '#475569', ngoc: '#0E7490', hong: '#BE185D', doDo: DO,
}
const MAU = {
  do: 'text-red-700 bg-red-50 border-red-200', xanh: 'text-blue-700 bg-blue-50 border-blue-200',
  la: 'text-emerald-700 bg-emerald-50 border-emerald-200', cam: 'text-amber-800 bg-amber-50 border-amber-200',
  tim: 'text-violet-700 bg-violet-50 border-violet-200', xam: 'text-slate-600 bg-slate-50 border-slate-200',
  ngoc: 'text-cyan-800 bg-cyan-50 border-cyan-200', hong: 'text-pink-700 bg-pink-50 border-pink-200',
}
const CHAM = { do: 'bg-red-500', xanh: 'bg-blue-500', la: 'bg-emerald-500', cam: 'bg-amber-500', tim: 'bg-violet-500', xam: 'bg-slate-400', ngoc: 'bg-cyan-500', hong: 'bg-pink-500' }

const tien = v => v == null ? '<span class="text-gray-300">—</span>' : Math.round(v).toLocaleString('vi-VN')

function chip(nhan, mau = 'xam', title = '') {
  return `<span title="${title}" class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${MAU[mau]}"><span class="w-1.5 h-1.5 rounded-full ${CHAM[mau]}"></span>${nhan}</span>`
}
const nut = (nhan, kieu = 'phu', them = '') => kieu === 'chinh'
  ? `<button class="px-3 py-1.5 rounded-lg text-sm font-semibold text-white shadow-sm ${them}" style="background:${DO}">${nhan}</button>`
  : `<button class="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 ${them}">${nhan}</button>`

// ── Vòng đời hồ sơ: 10 bước (khớp cây thư mục 1 → 8 nhân viên đang dùng) ──
const BUOC = [
  ['tiep_nhan', 'Tiếp nhận'], ['thu_thap', 'Thu thập'], ['bao_gia', 'Báo giá · ĐNTT'], ['soan', 'Soạn hồ sơ'],
  ['trinh_ky', 'Trình ký'], ['nop', 'Nộp Sở'], ['ket_qua', 'Kết quả'], ['thue', 'Hồ sơ thuế'],
  ['ban_giao', 'Bàn giao'], ['dong', 'Đóng · Lưu trữ'],
]
const tenBuoc = k => (BUOC.find(b => b[0] === k) || [k, k])[1]
const CHO = { khach: ['Chờ khách', 'cam'], so: ['Chờ Sở', 'xanh'], thue: ['Chờ Thuế', 'ngoc'], bo_sung: ['Cần bổ sung', 'do'] }

const NV = {
  tam: { ten: 'Võ Thanh Tâm', vt: 'Trưởng phòng Pháp lý', tat: 'T' },
  an: { ten: 'Đỗ Hoài An', vt: 'Chuyên viên pháp lý', tat: 'A' },
  linh: { ten: 'Phan Mỹ Linh', vt: 'Chuyên viên pháp lý', tat: 'L' },
  duy: { ten: 'Bùi Khánh Duy', vt: 'Chuyên viên pháp lý', tat: 'D' },
}
const avatar = (k, lon = false) => `<span class="inline-flex items-center justify-center rounded-full text-white font-bold ${lon ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[11px]'}" style="background:linear-gradient(135deg,${DO},${VANG})">${NV[k].tat}</span>`
const nguoi = k => `<span class="inline-flex items-center gap-1.5 whitespace-nowrap">${avatar(k)}<span class="text-sm text-gray-800">${NV[k].ten}</span></span>`

// Thủ tục + loại hình
const THU_TUC = {
  tlm: ['Thành lập mới', 'xanh'], td_dc: ['Thay đổi địa chỉ', 'tim'], td_von: ['Tăng vốn', 'tim'], td_dd: ['Đổi người đại diện', 'tim'],
  tam_ngung: ['Tạm ngưng', 'cam'], hd_lai: ['Hoạt động lại', 'ngoc'], giai_the: ['Giải thể', 'do'], cap_lai: ['Cấp lại GPKD', 'xam'],
}
const LOAI = { '1tv': 'TNHH 1TV', '2tv': 'TNHH 2TV', cp: 'Cổ phần', hkd: 'Hộ KD', cn: 'Chi nhánh' }

// Hồ sơ mẫu (giả lập). phi = phí dịch vụ, thuHo = thu hộ, daThu = đã thu (gồm cả 2).
const HO_SO = [
  { ma: 'PL-2610-07', kh: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÚ LỘC', tt: 'tlm', loai: '1tv', buoc: 'soan', cho: null, nv: 'an', nhan: '24/10', han: '05/11', con: 5, phi: 3700000, thuHo: 2150000, daThu: 4000000 },
  { ma: 'PL-2610-06', kh: 'CÔNG TY CỔ PHẦN ĐẦU TƯ XÂY DỰNG MINH KHANG', tt: 'tlm', loai: 'cp', buoc: 'nop', cho: 'so', nv: 'linh', nhan: '20/10', han: '03/11', con: 3, phi: 6500000, thuHo: 2350000, daThu: 5600000 },
  { ma: 'PL-2610-05', kh: 'CÔNG TY TNHH KỸ THUẬT BẢO TÍN', tt: 'td_dc', loai: '2tv', buoc: 'nop', cho: 'bo_sung', nv: 'an', nhan: '17/10', han: '31/10', con: -1, phi: 2500000, thuHo: 100000, daThu: 1300000 },
  { ma: 'PL-2610-04', kh: 'HỘ KINH DOANH TIỆM BÁNH HẠNH NGUYÊN', tt: 'tlm', loai: 'hkd', buoc: 'ket_qua', cho: null, nv: 'duy', nhan: '15/10', han: '25/10', con: -6, phi: 1500000, thuHo: 100000, daThu: 1600000 },
  { ma: 'PL-2610-03', kh: 'CÔNG TY TNHH GIẢI PHÁP SỐ NAM VIỆT', tt: 'td_von', loai: '1tv', buoc: 'trinh_ky', cho: 'khach', nv: 'linh', nhan: '14/10', han: '04/11', con: 4, phi: 2000000, thuHo: 100000, daThu: 1000000 },
  { ma: 'PL-2610-02', kh: 'CÔNG TY TNHH VẬN TẢI ĐÔNG HẢI', tt: 'tam_ngung', loai: '2tv', buoc: 'ban_giao', cho: null, nv: 'duy', nhan: '09/10', han: '20/10', con: -11, phi: 1800000, thuHo: 0, daThu: 1800000 },
  { ma: 'PL-2610-01', kh: 'CÔNG TY TNHH NỘI THẤT GỖ VIỆT', tt: 'giai_the', loai: '1tv', buoc: 'thue', cho: 'thue', nv: 'an', nhan: '02/10', han: '30/11', con: 30, phi: 8000000, thuHo: 0, daThu: 4000000 },
  { ma: 'PL-2609-12', kh: 'CÔNG TY TNHH THỰC PHẨM SẠCH LÂM VIÊN', tt: 'tlm', loai: '2tv', buoc: 'thu_thap', cho: 'khach', nv: 'linh', nhan: '29/10', han: '10/11', con: 10, phi: 4500000, thuHo: 2250000, daThu: 0 },
  { ma: 'PL-2609-11', kh: 'CÔNG TY TNHH DƯỢC PHẨM THIÊN AN', tt: 'td_dd', loai: '2tv', buoc: 'bao_gia', cho: 'khach', nv: 'duy', nhan: '30/10', han: '08/11', con: 8, phi: 2500000, thuHo: 100000, daThu: 0 },
  { ma: 'PL-2609-10', kh: 'CÔNG TY CỔ PHẦN GIÁO DỤC TRÍ VIỆT', tt: 'hd_lai', loai: 'cp', buoc: 'tiep_nhan', cho: null, nv: 'an', nhan: '31/10', han: '07/11', con: 7, phi: 1800000, thuHo: 0, daThu: 0 },
  { ma: 'PL-2609-09', kh: 'CÔNG TY TNHH CƠ KHÍ PHÚ THỊNH', tt: 'tlm', loai: 'cn', buoc: 'dong', cho: null, nv: 'tam', nhan: '18/09', han: '30/09', con: 0, phi: 2500000, thuHo: 150000, daThu: 2650000 },
]

const CSS_CHUNG = `
  body { font-family: Arial, Helvetica, sans-serif; }
  .bang { border-collapse: separate; border-spacing: 0; width: 100%; }
  .bang thead th { background: ${DO}; color: #fff; font-weight: 600; font-size: 11.5px; padding: 9px 10px; text-align: left; border-right: 1px solid rgba(255,255,255,.2); position: sticky; top: 0; z-index: 1; white-space: nowrap; }
  .bang thead th:last-child { border-right: 0; }
  .bang tbody td { background: #fff; padding: 8px 10px; border-bottom: 1px solid #E3E8F0; border-right: 1px solid #E3E8F0; font-size: 13px; vertical-align: middle; }
  .bang tbody tr:nth-child(even) td { background: #F2F6FC; }
  .bang tbody td:last-child { border-right: 0; }
  .bang tbody tr.nhom td { background: #FDF3E3 !important; font-weight: 700; color: #7A4B00; font-size: 12px; }
  .bang tbody tr.tong td { background: #FBEDED !important; font-weight: 700; }
  .bang .so { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .khung { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .khung-dau { padding: 10px 16px; border-bottom: 1px solid #EEF0F3; display: flex; align-items: center; gap: 8px; }
  .khung-dau h2 { font-size: 14px; font-weight: 700; color: #1F2937; border-left: 4px solid ${DO}; padding-left: 8px; }
  .nhan { font-size: 11.5px; color: #6B7280; margin-bottom: 4px; display: block; }
  .o { width: 100%; border: 1px solid #D1D5DB; border-radius: 8px; padding: 6px 9px; font-size: 13px; background: #fff; color: #111827; }
  .o.tu-dien { background: #F0FDF4; border-color: #86EFAC; }
  .o.can-xem { background: #FFFBEB; border-color: #FCD34D; }
  .o.thieu { background: #FEF2F2; border-color: #FCA5A5; }
  .o.khoa { background: #F9FAFB; color: #6B7280; }
`

function menu(dangMo) {
  const muc = (icon, nhan, khoa) => `<div class="flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium ${khoa && khoa === dangMo ? 'text-white shadow-sm' : 'text-gray-600'}" ${khoa && khoa === dangMo ? `style="background:${DO}"` : ''}><span class="text-base">${icon}</span>${nhan}</div>`
  const khu = t => `<div class="flex items-center gap-2 px-3 pb-1.5 pt-3"><div class="h-px flex-1" style="background:linear-gradient(to right,${VANG}70,transparent)"></div><p class="text-[11px] font-semibold uppercase tracking-wider" style="color:${VANG}">${t}</p><div class="h-px flex-1" style="background:linear-gradient(to left,${VANG}70,transparent)"></div></div>`
  return `<aside class="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
    <div class="bg-gradient-to-r from-[#8B1A1A] to-[#6B1212] px-4 py-3 flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-md p-0.5"><img src="../../public/logo-savitax.png" class="object-contain w-full h-full"></div>
      <div><p class="text-sm font-bold text-white tracking-wide">SAVITAX</p><p class="text-xs text-red-200">Hệ thống nội bộ</p></div></div>
    <div class="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5">
      ${avatar('tam', true)}
      <div><p class="text-xs font-semibold text-gray-800">Chào buổi sáng, <span style="color:${DO}">Võ Thanh Tâm</span> 👋</p><p class="text-xs text-gray-500">Trưởng phòng Pháp lý · Phòng HCNS</p></div></div>
    <nav class="px-3 py-2 space-y-0.5 flex-1">
      ${muc('🏠', 'Trang chủ')}${muc('🗓️', 'Chấm công & Lương')}
      ${khu('Kế toán')}
      <div class="px-3 py-1 text-xs text-gray-400">(ẩn với nhân viên chỉ thuộc phòng HCNS)</div>
      ${khu('HCNS - BHXH')}
      ${muc('💼', 'Phòng HCNS')}${muc('📝', 'Checklist HCNS')}${muc('📔', 'Nhật ký làm việc HCNS')}
      ${khu('Pháp lý')}
      ${muc('🏛️', 'Tổng quan pháp lý', 'tongquan')}${muc('📂', 'Hồ sơ pháp lý', 'hoso')}
      ${muc('📊', 'Báo cáo pháp lý', 'baocao')}${muc('🧩', 'Mẫu & danh mục', 'mau')}
    </nav>
    <div class="h-0.5" style="background:linear-gradient(to right,${DO},${VANG},${DO})"></div>
    <div class="px-6 py-3 text-sm text-gray-500">🚪 Đăng xuất</div></aside>`
}

// Tab: khối tách rời, chia đều bề ngang, chung một khung trắng (anh chốt ở phân hệ Lương).
function tabDeu(ds, dangMo) {
  return `<div class="khung p-1.5 flex gap-1.5 mb-4">${ds.map(([ic, t, so]) => `<div class="flex-1 text-center px-2 py-2 rounded-lg text-[13px] font-semibold border ${t === dangMo ? 'text-white border-transparent shadow-sm' : 'text-gray-600 border-gray-200 bg-gray-50'}" ${t === dangMo ? `style="background:${DO}"` : ''}>${ic} ${t}${so != null ? ` <span class="ml-1 rounded-full px-1.5 text-[11px] ${t === dangMo ? 'bg-white/25' : 'bg-white border border-gray-200'}">${so}</span>` : ''}</div>`).join('')}</div>`
}

function oTong(gt, nhan, mau = 'xam', phu = '') {
  const h = HEX[mau] || HEX.xam
  return `<div class="khung overflow-hidden" style="border-color:${h}40">
    <div class="h-1" style="background:${h}"></div>
    <div class="px-4 pt-2.5 pb-3">
      <p class="text-[12px] font-semibold text-gray-600">${nhan}</p>
      <p class="text-[26px] font-bold leading-tight tabular-nums mt-0.5" style="color:${h}">${gt}</p>
      ${phu ? `<p class="text-[11.5px] text-gray-500 mt-0.5">${phu}</p>` : ''}</div></div>`
}

// Thanh 10 bước của một hồ sơ
function thanhBuoc(dangO) {
  const i0 = BUOC.findIndex(b => b[0] === dangO)
  return `<div class="flex items-stretch gap-1">${BUOC.map(([k, t], i) => {
    const xong = i < i0, dang = i === i0
    const bg = dang ? DO : xong ? '#E8F5EE' : '#F3F4F6'
    const c = dang ? '#fff' : xong ? '#047857' : '#6B7280'
    return `<div class="flex-1 rounded-md px-1.5 py-1.5 text-center text-[11.5px] font-semibold leading-tight" style="background:${bg};color:${c}">
      <div class="text-[10px] opacity-80">${xong ? '✓' : i + 1}</div>${t}</div>`
  }).join('')}</div>`
}

function dauHoSo(h, extra = '') {
  const [tt, mt] = THU_TUC[h.tt]
  return `<div class="khung px-5 py-3.5 mb-4">
    <div class="flex items-start gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">${h.ma}</span>
          ${chip(tt, mt)}${chip(LOAI[h.loai], 'xam')}${h.cho ? chip(CHO[h.cho][0], CHO[h.cho][1]) : ''}
        </div>
        <p class="text-lg font-bold text-gray-900 mt-1">${h.kh}</p>
        <p class="text-[12.5px] text-gray-500 mt-0.5">Nhận ${h.nhan}/2026 · Hạn nội bộ <b class="${h.con < 0 ? 'text-red-700' : 'text-gray-700'}">${h.han}/2026</b>${h.con < 0 ? ` (trễ ${-h.con} ngày)` : ` (còn ${h.con} ngày)`} · Phụ trách ${nguoi(h.nv)}</p>
      </div>
      <div class="ml-auto flex gap-2 flex-shrink-0">${extra || `${nut('🧾 ĐNTT')}${nut('📦 Xuất bộ hồ sơ')}${nut('Chuyển bước ▸', 'chinh')}`}</div>
    </div>
    <div class="mt-3">${thanhBuoc(h.buoc)}</div></div>`
}

const TAB_HO_SO = [['📋', 'Thông tin'], ['👥', 'Người & CCCD'], ['🏷️', 'Ngành nghề'], ['📄', 'Soạn & Xuất'], ['✍️', 'Trình ký & Nộp'], ['💰', 'Công nợ'], ['📦', 'Bàn giao & Đóng'], ['🕓', 'Lịch sử']]

// ── Chế độ in PDF (?in=1): thêm dải mô tả trên đầu mỗi màn, giữ màu nền, khổ trang = đúng kích thước màn ──
const MO_TA = {
  '01': ['Tổng quan pháp lý', 'Màn trưởng phòng mở mỗi sáng.', ['6 ô số: đang xử lý, chờ khách, chờ cơ quan, trễ hạn, doanh số đã thu, còn phải thu', '"Việc cần xử lý hôm nay" sắp theo mức độ, có nút phân công', 'Bảng theo chuyên viên — doanh số = phí dịch vụ ĐÃ THU trong tháng']],
  '02': ['Danh sách hồ sơ', 'Mỗi dòng một vụ việc của một doanh nghiệp.', ['Tab chia đều: đang xử lý / chờ / trễ hạn / đã đóng', 'Lọc theo thủ tục, loại hình, bước, chuyên viên, tháng', 'Hạn đỏ = trễ, cam = còn ≤ 3 ngày; thanh đã thu / phải thu']],
  '03': ['Bảng theo bước', '10 bước gộp thành 5 cột giai đoạn để đọc được trên một màn.', ['Thẻ ghi rõ bước cụ thể, người phụ trách, hạn, tiền', 'Kéo thẻ để chuyển bước — app ghi nhật ký', 'Viền đỏ = trễ hạn nội bộ']],
  '04': ['Tiếp nhận hồ sơ mới', 'Bước 1/10 — tạo hồ sơ.', ['Chọn thủ tục → loại hình → khách → phụ trách → phí & lịch thu', 'App dò trùng khách, cảnh báo tên công ty gần giống', 'Cột phải: bộ giấy tờ sẽ phải soạn + thứ khách cần chuẩn bị (sao chép gửi Zalo)']],
  '05': ['Hồ sơ · Thông tin', 'Nhập MỘT lần — mọi giấy tờ lấy từ đây.', ['Ô xanh = app tự điền/tự tính, vàng = cần xem lại, đỏ = bắt buộc còn trống', 'Địa chỉ chọn phường/xã theo đơn vị hành chính mới; cơ quan thuế gợi ý theo phường', '"Đủ dữ liệu để xuất?" liệt kê chính xác còn thiếu gì']],
  '06': ['Hồ sơ · Người & CCCD', 'Up 2 mặt CCCD → tự điền → kiểm chéo.', ['Lưu ảnh trước rồi mới đọc — đọc lỗi không mất ảnh', 'Kiểm chéo: số CCCD ↔ nơi khai sinh, giới tính, năm sinh, dòng MRZ mặt sau', 'Vai trò & vốn góp: tổng 100%, khớp vốn điều lệ; ảnh xoá 24 tháng sau khi đóng hồ sơ']],
  '07': ['Hồ sơ · Ngành nghề', 'Chọn mã ngành từ danh mục, không gõ tay.', ['Ô tìm theo mã hoặc từ khoá, bung danh sách ▾', 'Đúng 1 ngành chính; kéo đổi thứ tự in; ghi chú "Chi tiết"', 'Bộ ngành mẫu theo lĩnh vực; dán danh sách mã khách gửi']],
  '08': ['Hồ sơ · Soạn & Xuất', 'Bộ giấy tờ lấy từ ma trận thủ tục × loại hình.', ['Mỗi giấy tờ có Word (sửa được) + PDF (in, gửi khách)', 'Phiên bản; tải lên bản sửa tay — bản sinh vẫn giữ', 'Tải .zip cả bộ; gộp bộ trình ký thành 1 PDF; lưu vào Drive']],
  '09': ['Hồ sơ · Trình ký & Nộp', 'In – ký – scan – nộp, có thể nhiều vòng.', ['Ai ký, ký mấy bản, ký ở đâu (lấy từ "Hướng dẫn in ký")', 'Gói nộp trực tuyến: ghép, đặt tên, kiểm dung lượng bản scan', 'Dòng thời gian các lần nộp, thông báo sửa đổi bổ sung, kết quả']],
  '10': ['Hồ sơ · Công nợ', 'Phí dịch vụ (doanh số) tách khỏi thu hộ (không doanh số).', ['Lịch thu theo đợt — đến hạn theo bước hoặc theo ngày', 'Sổ thu ghi nối tiếp, ngày khách trả thật; doanh số theo tháng thu', 'Khách trả thiếu: trừ thu hộ trước, phần còn lại mới vào doanh số']],
  '11': ['Hồ sơ · Bàn giao & Đóng', 'Kết thúc vòng đời hồ sơ.', ['Biên bản bàn giao Word/PDF + bản scan ký nhận', 'Điều kiện đóng hồ sơ; còn nợ thì chỉ trưởng phòng đóng + lý do', 'Cây lưu trữ Drive 1 → 8; lịch xoá ảnh CCCD']],
  '12': ['Báo cáo · Doanh số & công nợ', 'Tháng / quý / năm, cả phòng hoặc từng người.', ['Tồn đầu kỳ + đến hạn − đã thu = chuyển kỳ sau, tách dịch vụ / thu hộ', 'Chuyển kỳ sau tháng trước = tồn đầu tháng sau (bất biến)', 'Doanh số theo chuyên viên và theo thủ tục; xuất Excel']],
  '13': ['Báo cáo · Theo hồ sơ', 'Một dòng một hồ sơ trong kỳ.', ['Thời gian xử lý, đúng / trễ hạn', 'Tiền tách: phí DV, thu hộ, đã thu từng loại, còn nợ', 'Cột mã + doanh nghiệp cố định khi cuộn ngang']],
  '14': ['Mẫu & danh mục · Ma trận & mẫu Word', 'Chỉ Trưởng phòng Pháp lý.', ['Ma trận thủ tục × loại hình → giấy tờ (● bắt buộc, ○ tuỳ chọn)', 'Mẫu Word có phiên bản, ngày hiệu lực, người duyệt bản in', 'Mẫu chỉ dùng được khi đã duyệt; văn bản mới = thêm phiên bản']],
  '15': ['Mẫu & danh mục · Danh mục', 'Mọi danh sách chọn trong hồ sơ.', ['Mã ngành dạng cây (6.470 dòng từ file của phòng)', 'Phường/xã → cơ quan thuế quản lý (chờ anh duyệt nguồn)', 'Mỗi danh mục ghi nguồn + trạng thái']],
  '16': ['Bản in sinh ra từ hồ sơ', 'Hai bản in tự động.', ['ĐNTT theo đợt — mẫu SVT.MB13 hiện có, tách phí dịch vụ (VAT) và thu hộ', 'Trang bìa bộ trình ký: tờ nào, mấy trang, ai ký, ký ở đâu, lưu ý khi ký']],
}

function cheDoIn(rong) {
  if (!new URLSearchParams(location.search).has('in')) return
  const so = (location.pathname.split('/').pop() || '').slice(0, 2)
  const mt = MO_TA[so]
  const st = document.createElement('style')
  st.textContent = `html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;background:#fff}`
  document.head.appendChild(st)
  if (mt) {
    const dai = document.createElement('div')
    dai.style.cssText = `width:${rong}px;font-family:Arial,Helvetica,sans-serif`
    dai.innerHTML = `<div style="display:flex;align-items:stretch;border-bottom:4px solid ${VANG}">
      <div style="background:${DO};color:#fff;padding:18px 26px;display:flex;flex-direction:column;justify-content:center;min-width:150px">
        <div style="font-size:12px;opacity:.8;letter-spacing:.08em">MÀN</div><div style="font-size:40px;font-weight:700;line-height:1">${so}</div></div>
      <div style="padding:14px 26px;flex:1;background:#FFFBF2">
        <div style="font-size:24px;font-weight:700;color:#1F2937">${mt[0]}</div>
        <div style="font-size:14px;color:#4B5563;margin-top:2px">${mt[1]}</div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:#1F2937;line-height:1.55">${mt[2].map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div style="padding:14px 22px;background:#FFFBF2;font-size:11px;color:#9CA3AF;text-align:right;white-space:nowrap">Phân hệ Phòng Pháp lý<br>Mockup · dữ liệu giả lập<br>01/11/2026</div></div>`
    document.body.insertBefore(dai, document.body.firstChild)
  }
  // Tailwind CDN dựng class sau khi trang chạy — đợi rồi mới đo chiều cao để đặt khổ giấy đúng bằng màn
  setTimeout(() => {
    const cao = Math.ceil(document.documentElement.scrollHeight) + 2
    const p = document.createElement('style'); p.textContent = `@page{size:${rong}px ${cao}px;margin:0}`
    document.head.appendChild(p)
  }, 2500)
}

function trang({ dangMo, tieuDe, icon, phu = '', hanhDong = '', noiDung }) {
  const st = document.createElement('style'); st.textContent = CSS_CHUNG; document.head.appendChild(st)
  document.body.className = 'm-0 bg-gray-100'
  document.body.innerHTML = `<div class="flex bg-[#F5F6F8] text-gray-800" style="width:1440px;min-height:980px">
    ${menu(dangMo)}
    <main class="flex-1 min-w-0 px-6 py-5">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="text-2xl">${icon}</span>
        <div><h1 class="text-xl font-bold text-gray-900 leading-tight">${tieuDe}</h1>${phu ? `<p class="text-[12.5px] text-gray-500">${phu}</p>` : ''}</div>
        <div class="ml-auto flex items-center gap-2">${hanhDong}
          <span class="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200">MOCKUP · dữ liệu giả lập</span></div></div>
      ${noiDung}
    </main></div>`
  cheDoIn(1440)
}
