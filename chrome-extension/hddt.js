// BẢN 1.4 (THỬ, 21/11/2026) — Bảng kê hóa đơn từ hoadondientu.gdt.gov.vn bằng cách BẤM HỘ NÚT CỦA CHÍNH TRANG CỔNG.
//
// Vì sao không gọi thẳng cổng như Tờ khai: đo thật 13/10/2026, cổng hóa đơn trả 403 "Hệ thống phát hiện hành vi không hợp lệ"
// cho MỌI yêu cầu không do mã của trang gửi (tiện ích tự đăng nhập, hay đọc chen trong tab đã đăng nhập). Muốn qua phải giả
// dấu nhận diện = lách lớp chống tự động của cơ quan thuế → KHÔNG LÀM.
//
// Ở đây: nhân viên TỰ đăng nhập + tự gõ mã xác nhận trong tab cổng. Tiện ích chỉ điền ô ngày, bấm tab / "Tìm kiếm" / "Xuất
// excel" — mọi yêu cầu do mã của trang cổng gửi. Tiện ích không đọc cookie, không đọc token, không gửi yêu cầu nào tới cổng.
// Thấy cổng báo "không hợp lệ" / "bị chặn" là DỪNG HẲN, không thử lại.
//
// Hai hàm dưới đây được chrome.scripting.executeScript chép nguyên vào tab cổng → phải TỰ ĐỦ (không dùng biến bên ngoài).

// Dò trang: liệt kê nút, ô nhập, tab, thông báo đang hiện — để chỉnh bộ bấm cho đúng giao diện cổng.
export function doTrang() {
  const hien = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const gon = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const lop = el => gon(typeof el.className === 'string' ? el.className : el.getAttribute('class')).slice(0, 80)
  const nut = [...document.querySelectorAll('button, [role=button], a.ant-btn, .ant-btn')].filter(hien)
    .map(el => ({ chu: gon(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label')), lop: lop(el), tat: !!el.disabled }))
    .filter(n => n.chu).slice(0, 80)
  const o = [...document.querySelectorAll('input, select, textarea')].filter(hien)
    .map(el => ({ the: el.tagName.toLowerCase(), kieu: el.type || '', id: el.id || '', ten: el.name || '', goiY: gon(el.placeholder), giaTri: el.type === 'password' ? '' : gon(el.value), chiDoc: !!el.readOnly, lop: lop(el) }))
    .slice(0, 60)
  const tab = [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien)
    .map(el => ({ chu: gon(el.innerText), chon: el.getAttribute('aria-selected') === 'true' || /active/.test(lop(el)) })).slice(0, 30)
  const thongBao = [...document.querySelectorAll('.ant-message, .ant-notification, .ant-modal-body, .ant-alert, [role=alert], .ant-form-item-explain')]
    .filter(hien).map(el => gon(el.innerText)).filter(Boolean).slice(0, 20)
  const bang = [...document.querySelectorAll('table')].filter(hien).map(t => ({
    cot: [...t.querySelectorAll('thead th')].map(th => gon(th.innerText)).filter(Boolean).slice(0, 30),
    soHang: t.querySelectorAll('tbody tr').length,
  })).slice(0, 5)
  const tong = [...document.querySelectorAll('.ant-pagination-total-text, .ant-pagination')].filter(hien).map(el => gon(el.innerText)).slice(0, 3)
  return { url: location.href, tieuDe: document.title, nut, o, tab, thongBao, bang, tong }
}

// Chạy một lượt: { loai: 'mua' | 'ban', tuNgay: 'dd/mm/yyyy', denNgay, tabCon: '' | 'mtt', xuat: bool, chiBam: bool }
//   chiBam = true: KHÔNG điền ngày (nhân viên đã tự điền), chỉ bấm Tìm kiếm + Xuất excel — đường dự phòng nếu ô ngày của cổng
//   không nhận chữ điền hộ; vẫn trả lời được câu hỏi chính của bản thử: cổng có nhận lượt xuất do nút của trang gửi không.
export async function chayLuot(tuyChon) {
  const { loai = 'mua', tuNgay = '', denNgay = '', tabCon = '', xuat = true, chiBam = false } = tuyChon || {}
  const nhatKy = []
  const ghi = (buoc, ok, chiTiet = '') => nhatKy.push({ buoc, ok, chiTiet: String(chiTiet).slice(0, 300) })
  const cho = ms => new Promise(r => setTimeout(r, ms))
  const hien = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const gon = s => String(s || '').replace(/\s+/g, ' ').trim()
  const boDau = s => gon(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  const CHAN = /khong hop le|bi chan|vuot qua so lan|tu choi truy cap|qua nhieu yeu cau/
  const thongBao = () => [...document.querySelectorAll('.ant-message, .ant-notification, .ant-modal-body, .ant-alert, [role=alert]')]
    .filter(hien).map(el => gon(el.innerText)).filter(Boolean)
  const biChan = () => thongBao().find(t => CHAN.test(boDau(t)))
  const bam = el => {
    el.scrollIntoView({ block: 'center' })
    for (const k of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new MouseEvent(k, { bubbles: true, cancelable: true, view: window }))
    el.click()
  }
  const timNut = re => [...document.querySelectorAll('button, [role=button], .ant-btn, a')].filter(hien)
    .find(el => re.test(boDau(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label'))) && !el.disabled)
  const timTab = re => [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien).find(el => re.test(boDau(el.innerText)))
  const choHetQuay = async (gioiHan = 30000) => {
    const bd = Date.now()
    await cho(400)
    while (Date.now() - bd < gioiHan) {
      if (![...document.querySelectorAll('.ant-spin-spinning, .ant-btn-loading, [aria-busy=true]')].some(hien)) return true
      await cho(300)
    }
    return false
  }
  // Ô ngày kiểu Ant Design: đặt giá trị bằng setter gốc → sự kiện input → Enter → rời ô. Kiểm lại giá trị sau khi điền.
  const dienNgay = async (el, gt) => {
    el.focus(); bam(el); await cho(150)
    const dat = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    dat.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }))
    dat.call(el, gt); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    await cho(150)
    for (const k of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(k, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    await cho(150)
    el.blur(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await cho(250)
    return el.value
  }

  try {
    if (!/hoadondientu\.gdt\.gov\.vn$/.test(location.hostname)) { ghi('Kiểm trang', false, 'Không phải trang hoadondientu.gdt.gov.vn'); return { ok: false, nhatKy } }
    const chan0 = biChan()
    if (chan0) { ghi('Kiểm trang', false, 'Cổng đang báo: ' + chan0); return { ok: false, biChan: true, nhatKy } }
    ghi('Kiểm trang', true, location.pathname)

    // 1. Tab mua vào / bán ra
    const reTab = loai === 'ban' ? /ban ra/ : /mua vao/
    const tab = timTab(reTab)
    if (tab) { bam(tab); await cho(800); ghi('Chọn tab ' + (loai === 'ban' ? 'bán ra' : 'mua vào'), true, gon(tab.innerText)) }
    else ghi('Chọn tab ' + (loai === 'ban' ? 'bán ra' : 'mua vào'), false, 'Không thấy tab — có thể trang đang mở sẵn đúng mục, chạy tiếp')

    // 1b. Tab con: hóa đơn có mã từ máy tính tiền
    if (tabCon === 'mtt') {
      const t2 = timTab(/may tinh tien/)
      if (t2) { bam(t2); await cho(800); ghi('Chọn tab máy tính tiền', true, gon(t2.innerText)) }
      else { ghi('Chọn tab máy tính tiền', false, 'Không thấy tab'); return { ok: false, nhatKy } }
    }

    // 2. Ô ngày (lấy 2 ô ngày đầu tiên đang hiện trong khung tìm kiếm)
    if (!chiBam) {
      // Ưu tiên ô nằm trong khung chọn ngày của Ant Design; không có thì ô có gợi ý chữ "ngày" / dd/mm
      let oNgay = [...document.querySelectorAll('.ant-picker input, .ant-calendar-picker input, input[class*=picker], input[class*=date]')].filter(hien)
      if (oNgay.length < 2) oNgay = [...document.querySelectorAll('input')].filter(hien).filter(el => /ngay|dd\/mm/.test(boDau(el.placeholder)))
      if (oNgay.length < 2) { ghi('Tìm ô ngày', false, 'Chỉ thấy ' + oNgay.length + ' ô — bấm "Dò trang" gửi em kết quả'); return { ok: false, nhatKy } }
      const a = await dienNgay(oNgay[0], tuNgay)
      const b = await dienNgay(oNgay[1], denNgay)
      const khop = a === tuNgay && b === denNgay
      ghi('Điền ngày', khop, `ô 1: "${a}" · ô 2: "${b}"`)
      if (!khop) return { ok: false, nhatKy }
    } else ghi('Điền ngày', true, 'Bỏ qua — nhân viên tự điền')

    // 3. Tìm kiếm
    const nutTim = timNut(/^tim kiem$|^tra cuu$|tim kiem/)
    if (!nutTim) { ghi('Bấm Tìm kiếm', false, 'Không thấy nút'); return { ok: false, nhatKy } }
    bam(nutTim)
    const xong = await choHetQuay()
    const chan1 = biChan()
    if (chan1) { ghi('Bấm Tìm kiếm', false, 'CỔNG CHẶN: ' + chan1); return { ok: false, biChan: true, nhatKy } }
    const loiForm = [...document.querySelectorAll('.ant-form-item-explain-error, .ant-form-explain')].filter(hien).map(el => gon(el.innerText)).filter(Boolean)
    if (loiForm.length) { ghi('Bấm Tìm kiếm', false, 'Form báo: ' + loiForm.join(' | ')); return { ok: false, nhatKy } }
    const tong = [...document.querySelectorAll('.ant-pagination-total-text')].filter(hien).map(el => gon(el.innerText))[0] || ''
    const soHang = [...document.querySelectorAll('table tbody tr')].filter(hien).filter(tr => !/ant-table-placeholder|measure/.test(tr.className)).length
    ghi('Bấm Tìm kiếm', xong, `${xong ? '' : 'Quá 30 giây vẫn đang tải · '}${tong || soHang + ' hàng trên trang'} · thông báo: ${thongBao().join(' | ') || '(không)'}`)

    // 4. Xuất excel
    if (xuat) {
      await cho(1200)
      const nutXuat = timNut(/xuat excel|xuat file|xuat du lieu|^xuat$|tai excel|excel/)
      if (!nutXuat) { ghi('Bấm Xuất excel', false, 'Không thấy nút'); return { ok: false, nhatKy } }
      bam(nutXuat)
      await cho(1500)
      // Cổng có thể hỏi lại bằng hộp thoại → bấm nút đồng ý của hộp thoại (vẫn là nút của trang)
      const hop = [...document.querySelectorAll('.ant-modal, .ant-popover, .ant-popconfirm')].filter(hien).at(-1)
      if (hop) {
        const dongY = [...hop.querySelectorAll('button')].filter(hien).find(el => /dong y|xac nhan|xuat|tai|^ok$|co$/.test(boDau(el.innerText)))
        ghi('Hộp thoại sau Xuất', !!dongY, gon(hop.innerText).slice(0, 200))
        if (dongY) { bam(dongY); await cho(1200) }
      }
      await choHetQuay(60000)
      const chan2 = biChan()
      if (chan2) { ghi('Bấm Xuất excel', false, 'CỔNG CHẶN: ' + chan2); return { ok: false, biChan: true, nhatKy } }
      ghi('Bấm Xuất excel', true, 'Đã bấm · thông báo: ' + (thongBao().join(' | ') || '(không)'))
    }
    return { ok: true, nhatKy }
  } catch (e) {
    ghi('Lỗi', false, String(e?.message || e))
    return { ok: false, nhatKy }
  }
}
