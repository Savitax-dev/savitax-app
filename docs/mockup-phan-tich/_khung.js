// Khung dùng chung cho mockup 2 phân hệ Phân tích (Soát xét báo cáo, Rủi ro thuế).
// Bám đúng giao diện app đang chạy: Sidebar (components/Sidebar.js), tab gạch chân đỏ đô
// (components/TabToKhai.js), ô tổng + chip (components/tokhaiUI.js). Dữ liệu trong mockup là GIẢ LẬP.

const DO = '#8B1A1A', VANG = '#C9A84C'

const MAU = {
  xanhDuong: 'text-blue-700 bg-blue-50 border-blue-200',
  xanhLa: 'text-green-700 bg-green-50 border-green-200',
  hoPhach: 'text-amber-700 bg-amber-50 border-amber-200',
  xam: 'text-slate-600 bg-slate-50 border-slate-200',
  do: 'text-red-700 bg-red-50 border-red-200',
  tim: 'text-purple-700 bg-purple-50 border-purple-200',
}
const CHAM = { xanhDuong: 'bg-blue-500', xanhLa: 'bg-green-500', hoPhach: 'bg-amber-500', xam: 'bg-slate-400', do: 'bg-red-500', tim: 'bg-purple-500' }

const so = v => v == null ? '<span class="text-gray-300">—</span>'
  : (v < 0 ? '(' + Math.round(-v).toLocaleString('vi-VN') + ')' : Math.round(v).toLocaleString('vi-VN'))
const pt = (v, d = 2) => v == null ? '<span class="text-gray-300">—</span>'
  : (v * 100).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'

function chip(nhan, mau = 'xam', title = '') {
  return `<span title="${title}" class="inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${MAU[mau]}"><span class="w-1.5 h-1.5 rounded-full ${CHAM[mau]}"></span>${nhan}</span>`
}
// Nhãn nguồn số liệu: XML tin cậy nhất → PDF có chữ → HTML → ảnh scan
const NGUON = { xml: ['XML', 'xanhLa'], pdf: ['PDF', 'xanhDuong'], html: ['HTML', 'tim'], scan: ['Ảnh scan', 'hoPhach'], excel: ['Excel', 'xanhLa'] }
const nguon = k => { const [n, m] = NGUON[k]; return `<span class="inline-block rounded px-1 py-px text-[10px] font-semibold border ${MAU[m]}">${n}</span>` }

// Mã màu đậm theo ý nghĩa — dùng cho ô tổng sinh động (đồng bộ màn Tăng trưởng & phí).
const HEX = { xanhDuong: '#2563EB', xanhLa: '#059669', hoPhach: '#D97706', xam: '#64748B', do: '#DC2626', tim: '#7C3AED' }

function oTong(so_, nhan, mau = 'xam', phu = '') {
  const h = HEX[mau] || HEX.xam
  return `<div class="relative rounded-2xl bg-white shadow-sm overflow-hidden border" style="border-color:${h}33">
    <div class="h-1.5" style="background:linear-gradient(90deg,${h},${h}66)"></div>
    <div class="px-4 pt-2.5 pb-3" style="background:linear-gradient(180deg,${h}14,#fff 80%)">
      <div class="absolute -right-4 -bottom-5 w-16 h-16 rounded-full" style="background:${h}12"></div>
      <p class="text-3xl font-extrabold leading-none tabular-nums" style="color:${h}">${so_}</p>
      <p class="text-xs mt-1.5 font-semibold text-gray-700">${nhan}</p>
      ${phu ? `<p class="text-[11px] text-gray-500 mt-0.5">${phu}</p>` : ''}</div></div>`
}

// Kiểu bảng chung: dòng tách rời thành từng dải, xen kẽ 2 tông nền (không vạch màu đầu dòng),
// đầu bảng nền đỏ đô. Áp cho MỌI bảng trong vùng nội dung để các màn đồng bộ.
const CSS_CHUNG = `
  main table { border-collapse: separate; border-spacing: 0; border: 1px solid #DCE2EB; border-radius: 12px; }
  main table thead th { background: #8B1A1A; color: #fff; padding-top: 10px; padding-bottom: 10px; font-weight: 600; border-right: 1px solid rgba(255,255,255,.22); }
  main table thead th:first-child { border-top-left-radius: 11px; } main table thead th:last-child { border-top-right-radius: 11px; border-right: 0; }
  main table thead tr { background: transparent !important; }
  main table tbody td { background: #fff; padding-top: 9px; padding-bottom: 9px; border-bottom: 1px solid #E3E8F0; border-right: 1px solid #E3E8F0; }
  main table tbody tr:nth-child(even) td { background: #F2F6FC; }
  main table tbody td:last-child { border-right: 0; }
  main table tbody tr:last-child td { border-bottom: 0; }
  main table tbody tr.nhom td { background: #FDF3E3 !important; }
  main h2.text-sm { border-left: 4px solid #8B1A1A; padding-left: 8px; }
  main div.bg-white.rounded-2xl > div.border-b:first-child { background: linear-gradient(90deg,#FBEDED,#FFFFFF 65%); box-shadow: inset 4px 0 0 #8B1A1A; }`

// Thanh tỷ lệ TRUNG TÍNH (xám-xanh): chưa chốt ngưỡng nên không dùng đỏ/vàng/xanh để đánh giá.
function thanhTyLe(v, max = 0.06) {
  if (v == null) return '<span class="text-gray-300">—</span>'
  const w = Math.min(100, Math.abs(v) / max * 100)
  return `<div class="flex items-center gap-2 justify-end"><span class="text-xs font-semibold tabular-nums text-slate-700 w-14 text-right">${pt(Math.abs(v))}</span>
    <div class="h-2 bg-slate-100 rounded-full overflow-hidden w-24"><div class="h-full rounded-full" style="width:${w}%;background:linear-gradient(90deg,#94A3B8,#475569)"></div></div></div>`
}

function menu(dangMo) {
  const muc = (icon, nhan, khoa) => `<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${khoa === dangMo ? 'text-white shadow-sm' : 'text-gray-600'}" ${khoa === dangMo ? `style="background:${DO}"` : ''}><span class="text-lg">${icon}</span>${nhan}</div>`
  const khu = t => `<div class="flex items-center gap-2 px-3 pb-2 pt-3"><div class="h-px flex-1" style="background:linear-gradient(to right,${VANG}60,transparent)"></div><p class="text-xs font-semibold uppercase tracking-wider" style="color:${VANG}">${t}</p><div class="h-px flex-1" style="background:linear-gradient(to left,${VANG}60,transparent)"></div></div>`
  return `<aside class="w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
    <div class="bg-gradient-to-r from-[#8B1A1A] to-[#6B1212] px-4 py-3 flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-md p-0.5"><img src="../../public/logo-savitax.png" class="object-contain w-full h-full"></div>
      <div><p class="text-sm font-bold text-white tracking-wide">SAVITAX</p><p class="text-xs text-red-200">Hệ thống nội bộ</p></div></div>
    <div class="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:linear-gradient(135deg,${DO},${VANG})">H</div>
      <div><p class="text-xs font-semibold text-gray-800">Chào buổi sáng, <span style="color:${DO}">Trần Thu Hà</span> 👋</p><p class="text-xs text-gray-400">Nhân viên · Phòng Grand</p></div></div>
    <nav class="px-3 py-3 space-y-0.5">
      ${muc('🏠', 'Trang chủ')}${muc('🏢', 'Danh sách công ty')}${muc('🗓️', 'Chấm công & Lương')}
      ${khu('Kế toán')}
      ${muc('📋', 'Checklist công việc')}${muc('💰', 'Quản lý công nợ')}${muc('🧾', 'Tờ khai & Hạn nộp')}
      ${muc('🔎', 'Soát xét báo cáo', 'soat')}${muc('⚖️', 'Rủi ro thuế', 'ruiro')}
      ${muc('📔', 'Nhật ký làm việc')}
    </nav></aside>`
}

function tab(ds, dangMo) {
  return `<div class="flex flex-wrap gap-1 mb-4 border-b border-gray-200">${ds.map(t => `<div class="px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px ${t === dangMo ? 'border-[#8B1A1A] text-[#8B1A1A] font-semibold bg-red-50/50' : 'border-transparent text-gray-500'}">${t}</div>`).join('')}</div>`
}

// Thanh công ty + năm + thư mục (chỉ đọc) — giống nhau ở mọi màn hình trong 1 công ty.
// Công ty mẫu mặc định (giả lập). Màn nào cần công ty khác thì truyền `cty` vào trang().
const CTY_MAU = { ten: 'CÔNG TY TNHH MẪU SAVITAX', ma: 'MAUSAVITAX', mst: '0300000001', cheDo: 'TT133 (B01a)', thuMuc: '5.MẪU SAVITAX' }
function thanhCongTy(nam = 2025, cty = CTY_MAU) {
  return `<div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
    <div class="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-1.5 min-w-[300px]">
      <span class="text-base">🏢</span><div class="leading-tight"><p class="text-sm font-semibold text-gray-800">${cty.ten}</p><p class="text-[11px] text-gray-400">${cty.ma} · MST ${cty.mst} · ${cty.cheDo}</p></div><span class="ml-auto text-gray-400">▾</span></div>
    <div class="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700">Năm ${nam} ▾</div>
    <div class="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 text-xs text-green-800 font-mono" title="G:\\Shared drives\\12. SAVITAX - PHÒNG NGHIỆP VỤ GRAND\\<Nhân viên>\\${cty.thuMuc}">
      📁 …\\${cty.thuMuc}\\Năm ${nam}
      <span class="font-sans font-semibold rounded bg-white border border-green-200 px-1.5 py-px">🔒 Chỉ đọc</span></div>
    <div class="ml-auto flex gap-2">
      <button class="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700">↻ Đọc lại</button>
      <button class="px-3 py-1.5 rounded-xl text-sm text-white" style="background:${DO}">⬇ Tải Excel</button></div></div>`
}

function banChuaChamDiem() {
  return `<div class="mb-4 rounded-2xl border border-blue-200 px-4 py-2.5 text-xs text-slate-700 flex items-center gap-2" style="background:linear-gradient(90deg,#EAF1FF,#F7F9FF)">
    <span class="text-base">ℹ️</span><span><b>Chưa chấm điểm, chưa xếp loại.</b> Savitax chưa chốt ngưỡng, nên app chỉ hiện số liệu, chênh lệch và tỷ lệ. Số liệu đọc trực tiếp từ thư mục công ty, app không sửa và không ghi file nào.</span></div>`
}

function trang({ dangMo, tieuDe, icon, tabs, tabMo, noiDung, coThanh = true, nam = 2025, cty = CTY_MAU }) {
  document.body.className = 'm-0'
  const st = document.createElement('style'); st.textContent = CSS_CHUNG; document.head.appendChild(st)
  document.body.innerHTML = `<div class="flex bg-gray-50 text-gray-800" style="width:1440px;min-height:1000px;font-family:Arial,Helvetica,sans-serif">
    ${menu(dangMo)}
    <main class="flex-1 min-w-0 px-6 py-5">
      <div class="flex items-center gap-2 mb-3"><span class="text-2xl">${icon}</span><h1 class="text-xl font-bold text-gray-800">${tieuDe}</h1>
        <span class="ml-auto text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200">MOCKUP · dữ liệu giả lập</span></div>
      ${tab(tabs, tabMo)}
      ${coThanh ? thanhCongTy(nam, cty) : ''}
      ${noiDung}
    </main></div>`
}
const bang = (dau, than, lop = '') => `<div class="rounded-2xl border border-gray-100 shadow-sm px-2 pb-1 pt-1.5 ${lop}" style="background:#F7F8FB"><table class="w-full text-sm">
  <thead><tr class="text-[11px] uppercase tracking-wide">${dau}</tr></thead><tbody>${than}</tbody></table></div>`

const TABS_RUIRO = ['Công ty của tôi', 'Hồ sơ dữ liệu', 'Bảng 39 tiêu chí', 'Chi tiết tiêu chí', 'Nhiều năm']
const TABS_SOAT = ['Công ty của tôi', 'Hồ sơ dữ liệu', 'Soát kỳ', 'Tổng quan', 'Kiểm tra', 'Bảng kê hóa đơn', 'Chỉ số tài chính', 'Tăng trưởng & phí', 'Nhiều năm']
