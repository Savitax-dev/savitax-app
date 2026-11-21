// BẢN 1.4 (THỬ, 21/11/2026) — Bảng kê hóa đơn từ hoadondientu.gdt.gov.vn bằng cách BẤM HỘ NÚT CỦA CHÍNH TRANG CỔNG.
//
// Vì sao không gọi thẳng cổng như Tờ khai: đo thật 13/10/2026, cổng hóa đơn trả 403 "Hệ thống phát hiện hành vi không hợp lệ"
// cho MỌI yêu cầu không do mã của trang gửi (tiện ích tự đăng nhập, hay đọc chen trong tab đã đăng nhập). Muốn qua phải giả
// dấu nhận diện = lách lớp chống tự động của cơ quan thuế → KHÔNG LÀM.
//
// Ở đây: nhân viên TỰ đăng nhập + tự gõ mã xác nhận trong tab cổng. Tiện ích chỉ điền ô ngày, bấm tab / "Tìm kiếm" / nút xuất
// — mọi yêu cầu do mã của trang cổng gửi. Tiện ích không đọc cookie, không đọc token, không gửi yêu cầu nào tới cổng.
// Thấy cổng báo "không hợp lệ" / "bị chặn" là DỪNG HẲN, không thử lại.
//
// Giao diện cổng (dò thật 21/11/2026, trang /tra-cuu/tra-cuu-hoa-don): Ant Design bản 3. Hai tab "Tra cứu hóa đơn điện tử bán ra
// / mua vào" đều nằm sẵn trong trang (tab ẩn có lớp ant-tabs-tabpane-inactive nhưng vẫn có kích thước → phải loại theo lớp, không
// theo kích thước). Ô ngày là ant-calendar-picker-input CHỈ ĐỌC: bấm vào mở lịch, gõ ngày vào ô .ant-calendar-input của lịch rồi
// Enter. Nút xuất CHỈ CÓ BIỂU TƯỢNG (cạnh nút In, bên phải ô số dòng/trang) — nhận ra bằng chữ chú thích hiện khi rê chuột.
//
// Hai hàm dưới đây được chrome.scripting.executeScript chép nguyên vào tab cổng → phải TỰ ĐỦ (không dùng biến bên ngoài).

// Dò trang: liệt kê nút (kể cả nút chỉ có biểu tượng + chú thích khi rê chuột), ô nhập, tab, thông báo — để chỉnh bộ bấm.
export async function doTrang() {
  const cho = ms => new Promise(r => setTimeout(r, ms))
  const hien = el => { if (el.closest('.ant-tabs-tabpane-inactive')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const gon = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const lop = el => gon(typeof el.className === 'string' ? el.className : el.getAttribute('class')).slice(0, 80)
  const bieuTuong = el => gon([...el.querySelectorAll('.anticon, i, svg, img')].map(i =>
    [i.getAttribute('aria-label'), i.getAttribute('data-icon'), i.getAttribute('type'), i.getAttribute('alt'), lop(i)].filter(Boolean).join(' ')).join(' | '))
  const chuThich = async el => {
    for (const k of ['pointerover', 'mouseover', 'mouseenter']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseenter', view: window }))
    await cho(350)
    const t = [...document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner, .ant-popover:not(.ant-popover-hidden) .ant-popover-inner')]
      .filter(x => x.getBoundingClientRect().width > 0).map(x => gon(x.innerText)).join(' | ')
    for (const k of ['pointerout', 'mouseout', 'mouseleave']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseleave', view: window }))
    await cho(150)
    return t
  }
  const nut = []
  for (const el of [...document.querySelectorAll('button, [role=button], .ant-btn')].filter(hien)) {
    const chu = gon(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label'))
    if (/^(xem danh sach|thong tin lien quan)/i.test(chu.normalize('NFD').replace(/[̀-ͯ]/g, ''))) continue   // nút trong từng hàng bảng
    const muc = { chu, lop: lop(el), tat: !!el.disabled }
    if (!chu) { muc.bieuTuong = bieuTuong(el); muc.chuThich = await chuThich(el) }
    nut.push(muc)
    if (nut.length >= 40) break
  }
  const o = [...document.querySelectorAll('input, select, textarea')].filter(hien)
    .map(el => ({ the: el.tagName.toLowerCase(), kieu: el.type || '', id: el.id || '', goiY: gon(el.placeholder), giaTri: el.type === 'password' ? '' : gon(el.value), chiDoc: !!el.readOnly, lop: lop(el) }))
    .slice(0, 40)
  const tab = [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien)
    .map(el => ({ chu: gon(el.innerText), chon: el.getAttribute('aria-selected') === 'true' || /active/.test(lop(el)) })).slice(0, 20)
  const thongBao = [...document.querySelectorAll('.ant-message, .ant-notification, .ant-modal-body, .ant-alert, .ant-form-item-explain')]
    .filter(hien).map(el => gon(el.innerText)).filter(Boolean).slice(0, 20)
  const bang = [...document.querySelectorAll('table')].filter(hien).map(t => ({
    cot: [...t.querySelectorAll('thead th')].map(th => gon(th.innerText)).filter(Boolean).slice(0, 30),
    soHang: t.querySelectorAll('tbody tr').length,
  })).slice(0, 5)
  const tong = (document.body.innerText.match(/Có\s+[\d.]+\s+kết quả/g) || []).slice(0, 4)
  return { url: location.href, tieuDe: document.title, nut, o, tab, thongBao, bang, tong }
}

// Chạy một lượt: { loai: 'mua' | 'ban', tuNgay: 'dd/mm/yyyy', denNgay, tabCon: '' | 'mtt', xuat: bool, chiBam: bool }
//   chiBam = true: KHÔNG điền ngày (nhân viên đã tự điền), chỉ bấm Tìm kiếm + nút xuất.
export async function chayLuot(tuyChon) {
  const { loai = 'mua', tuNgay = '', denNgay = '', tabCon = '', xuat = true, chiBam = false } = tuyChon || {}
  const nhatKy = []
  const ghi = (buoc, ok, chiTiet = '') => nhatKy.push({ buoc, ok, chiTiet: String(chiTiet).slice(0, 400) })
  const cho = ms => new Promise(r => setTimeout(r, ms))
  // Hiện thật: có kích thước VÀ không nằm trong tab đang ẩn (tab ẩn của Ant Design 3 vẫn có kích thước)
  const hien = el => { if (el.closest('.ant-tabs-tabpane-inactive')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const gon = s => String(s || '').replace(/\s+/g, ' ').trim()
  const boDau = s => gon(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  const CHAN = /khong hop le|bi chan|vuot qua so lan|tu choi truy cap|qua nhieu yeu cau/
  const thongBao = () => [...document.querySelectorAll('.ant-message, .ant-notification, .ant-modal-body, .ant-alert')]
    .filter(hien).map(el => gon(el.innerText)).filter(t => t && t !== gon(document.title))
  const biChan = () => thongBao().find(t => CHAN.test(boDau(t)))
  // KHÔNG BAO GIỜ bấm các nút này (21/11/2026: bộ dò nút xuất đã bấm nhầm "Đăng xuất" ở đầu trang — chú thích cũng có chữ "xuất")
  const CAM = /\b(dang xuat|logout|thoat|doi mat khau|xoa|huy)\b/
  const bam = (el, chuThichDaDoc = '') => {
    const ten = boDau([el.innerText, el.getAttribute('title'), el.getAttribute('aria-label'), chuThichDaDoc].join(' '))
    if (CAM.test(ten)) throw new Error('Chặn bấm nút cấm: ' + ten)
    el.scrollIntoView({ block: 'center' })
    for (const k of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new MouseEvent(k, { bubbles: true, cancelable: true, view: window }))
    el.click()
  }
  const timNut = re => [...document.querySelectorAll('button, [role=button], .ant-btn')].filter(hien)
    .find(el => re.test(boDau(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label'))) && !el.disabled)
  const timTab = re => [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien).find(el => re.test(boDau(el.innerText)))
  const choHetQuay = async (gioiHan = 30000) => {
    const bd = Date.now()
    await cho(500)
    while (Date.now() - bd < gioiHan) {
      if (![...document.querySelectorAll('.ant-spin-spinning, .ant-btn-loading')].some(hien)) return true
      await cho(300)
    }
    return false
  }
  const datGiaTri = (el, gt) => {
    const dat = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    dat.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }))
    dat.call(el, gt); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const phim = (el, key, keyCode) => { for (const k of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(k, { key, code: key, keyCode, which: keyCode, bubbles: true })) }
  // Ô ngày Ant Design 3 (chỉ đọc): bấm mở lịch → gõ vào ô nhập CỦA LỊCH → Enter. Ô không chỉ đọc thì điền thẳng.
  const dienNgay = async (el, gt) => {
    if (!el.readOnly) { el.focus(); datGiaTri(el, gt); await cho(150); phim(el, 'Enter', 13); el.blur(); await cho(250); return el.value }
    bam(el); await cho(450)
    const oLich = [...document.querySelectorAll('.ant-calendar-picker-container .ant-calendar-input, .ant-calendar-input')]
      .filter(x => x.getBoundingClientRect().width > 0).at(-1)
    if (!oLich) return el.value + ' (không mở được lịch)'
    oLich.focus(); datGiaTri(oLich, gt); await cho(300)
    phim(oLich, 'Enter', 13); await cho(450)
    // lịch còn mở (ngày không hợp lệ) → đóng bằng Esc
    if (oLich.isConnected && oLich.getBoundingClientRect().width > 0) { phim(oLich, 'Escape', 27); await cho(300) }
    return el.value
  }
  // Nút chỉ có biểu tượng → rê chuột cho hiện chú thích rồi đọc
  const chuThich = async el => {
    for (const k of ['pointerover', 'mouseover', 'mouseenter']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseenter', view: window }))
    await cho(350)
    const t = [...document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner')]
      .filter(x => x.getBoundingClientRect().width > 0).map(x => gon(x.innerText)).join(' | ')
    for (const k of ['pointerout', 'mouseout', 'mouseleave']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseleave', view: window }))
    await cho(150)
    return t
  }
  const soKetQua = () => {
    const vung = [...document.querySelectorAll('.ant-tabs-tabpane-active')].filter(hien).map(x => x.innerText).join(' ') || document.body.innerText
    return (vung.match(/Có\s+([\d.]+)\s+kết quả/) || [])[0] || ''
  }

  try {
    if (!/hoadondientu\.gdt\.gov\.vn$/.test(location.hostname)) { ghi('Kiểm trang', false, 'Không phải trang hoadondientu.gdt.gov.vn'); return { ok: false, nhatKy } }
    const chan0 = biChan()
    if (chan0) { ghi('Kiểm trang', false, 'Cổng đang báo: ' + chan0); return { ok: false, biChan: true, nhatKy } }
    ghi('Kiểm trang', true, location.pathname)

    // 1. Tab mua vào / bán ra
    const tenTab = loai === 'ban' ? 'bán ra' : 'mua vào'
    const tab = timTab(loai === 'ban' ? /ban ra/ : /mua vao/)
    if (tab) { bam(tab); await cho(900); ghi('Chọn tab ' + tenTab, true, gon(tab.innerText)) }
    else { ghi('Chọn tab ' + tenTab, false, 'Không thấy tab'); return { ok: false, nhatKy } }

    // 1b. Tab con: hóa đơn điện tử / có mã từ máy tính tiền (nằm dưới bảng, trong tab đang mở)
    const t2 = timTab(tabCon === 'mtt' ? /may tinh tien/ : /^hoa don dien tu$/)
    if (t2) { bam(t2); await cho(700); ghi('Chọn loại hóa đơn', true, gon(t2.innerText)) }
    else if (tabCon === 'mtt') { ghi('Chọn loại hóa đơn', false, 'Không thấy tab máy tính tiền'); return { ok: false, nhatKy } }

    // 2. Ô ngày (2 ô "Chọn thời điểm" của tab đang mở)
    if (!chiBam) {
      let oNgay = [...document.querySelectorAll('input.ant-calendar-picker-input, .ant-calendar-picker input, .ant-picker input')].filter(hien)
      if (oNgay.length < 2) oNgay = [...document.querySelectorAll('input')].filter(hien).filter(el => /ngay|dd\/mm|thoi diem/.test(boDau(el.placeholder)))
      if (oNgay.length < 2) { ghi('Tìm ô ngày', false, 'Chỉ thấy ' + oNgay.length + ' ô — bấm "Dò trang" gửi em kết quả'); return { ok: false, nhatKy } }
      // Điền "đến ngày" trước nếu từ ngày mới lớn hơn đến ngày cũ thì cổng có thể báo lỗi khoảng ngày → điền từ ngày sau cùng lần nữa
      const a1 = await dienNgay(oNgay[0], tuNgay)
      const b = await dienNgay(oNgay[1], denNgay)
      const a = a1 === tuNgay ? a1 : await dienNgay(oNgay[0], tuNgay)
      const khop = a === tuNgay && b === denNgay
      ghi('Điền ngày', khop, `Từ ngày: "${a}" · Đến ngày: "${b}"`)
      if (!khop) return { ok: false, nhatKy }
    } else ghi('Điền ngày', true, 'Bỏ qua — nhân viên tự điền')

    // 3. Tìm kiếm
    const nutTim = timNut(/^tim kiem$/)
    if (!nutTim) { ghi('Bấm Tìm kiếm', false, 'Không thấy nút'); return { ok: false, nhatKy } }
    bam(nutTim)
    const xong = await choHetQuay()
    const chan1 = biChan()
    if (chan1) { ghi('Bấm Tìm kiếm', false, 'CỔNG CHẶN: ' + chan1); return { ok: false, biChan: true, nhatKy } }
    const loiForm = [...document.querySelectorAll('.ant-form-explain, .ant-form-item-explain')].filter(hien).map(el => gon(el.innerText)).filter(Boolean)
    if (loiForm.length) { ghi('Bấm Tìm kiếm', false, 'Form báo: ' + loiForm.join(' | ')); return { ok: false, nhatKy } }
    const kq = soKetQua()
    ghi('Bấm Tìm kiếm', xong, `${xong ? '' : 'Quá 30 giây vẫn đang tải · '}${kq || '(không đọc được số kết quả)'}${thongBao().length ? ' · thông báo: ' + thongBao().join(' | ') : ''}`)
    if (/^Có\s+0\s/.test(kq)) { ghi('Bấm xuất', true, 'Không có hóa đơn — không xuất'); return { ok: true, khongCo: true, nhatKy } }

    // 4. Nút xuất (chỉ có biểu tượng): CHỈ dò trong tab tra cứu đang mở (khung chứa nút Tìm kiếm vừa bấm) — không bao giờ dò
    //    thanh đầu trang (ở đó có nút Đăng xuất). Đọc chú thích từng nút, nhận đúng chữ của nút xuất danh sách.
    if (xuat) {
      await cho(800)
      const khung = nutTim.closest('.ant-tabs-tabpane-active')
      if (!khung) { ghi('Tìm nút xuất', false, 'Không xác định được khung tab đang mở — dừng để khỏi bấm nhầm'); return { ok: false, nhatKy } }
      const ung = [...khung.querySelectorAll('button, .ant-btn')].filter(hien).filter(el => !gon(el.innerText))
      const daDoc = []
      let nutXuat = null, tenXuat = ''
      for (const el of ung) {
        const t = await chuThich(el)
        const k = boDau(t)
        daDoc.push((t || '(không chú thích)') + (el.disabled ? ' [tắt]' : ''))
        if (!el.disabled && /xuat|excel|tai ve/.test(k) && !CAM.test(k) && !/xml|^in\b|in hoa don/.test(k)) { nutXuat = el; tenXuat = t; break }
      }
      if (!nutXuat) { ghi('Tìm nút xuất', false, 'Các nút biểu tượng trong khung: ' + (daDoc.join(' ; ') || '(không có)')); return { ok: false, nhatKy } }
      ghi('Tìm nút xuất', true, tenXuat + '  (đã đọc: ' + daDoc.join(' ; ') + ')')
      bam(nutXuat, tenXuat)
      await cho(1500)
      // Cổng có thể hỏi lại bằng hộp thoại → bấm nút đồng ý của hộp thoại (vẫn là nút của trang)
      const hop = [...document.querySelectorAll('.ant-modal-wrap, .ant-popover, .ant-modal-confirm')].filter(x => x.getBoundingClientRect().width > 0 && getComputedStyle(x).display !== 'none').at(-1)
      if (hop) {
        const dongY = [...hop.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0).find(el => /dong y|xac nhan|xuat|tai|^ok$|^co$/.test(boDau(el.innerText)))
        ghi('Hộp thoại sau Xuất', !!dongY, gon(hop.innerText).slice(0, 250))
        if (dongY) { bam(dongY); await cho(1200) }
      }
      await choHetQuay(60000)
      const chan2 = biChan()
      if (chan2) { ghi('Bấm xuất', false, 'CỔNG CHẶN: ' + chan2); return { ok: false, biChan: true, nhatKy } }
      ghi('Bấm xuất', true, 'Đã bấm' + (thongBao().length ? ' · thông báo: ' + thongBao().join(' | ') : ''))
    }
    return { ok: true, nhatKy }
  } catch (e) {
    ghi('Lỗi', false, String(e?.message || e))
    return { ok: false, nhatKy }
  }
}
