// BẢN 1.4 — Bảng kê hóa đơn từ hoadondientu.gdt.gov.vn bằng cách BẤM HỘ NÚT CỦA CHÍNH TRANG CỔNG.
//
// File này được chrome.scripting.executeScript({ files }) nạp vào tab cổng (thế giới riêng của tiện ích), gắn bộ hàm vào
// window.__svtHddt; background gọi từng hàm theo tên. Nạp lại mỗi lần gọi là an toàn (chỉ định nghĩa lại hàm).
//
// VÌ SAO BẤM HỘ, KHÔNG GỌI THẲNG CỔNG: đo thật 13/10/2026, cổng hóa đơn trả 403 "Hệ thống phát hiện hành vi không hợp lệ"
// cho MỌI yêu cầu không do mã của trang gửi. Muốn qua phải giả dấu nhận diện = lách lớp chống tự động → KHÔNG LÀM.
// Ở đây tiện ích chỉ điền ô + bấm nút của trang; mọi yêu cầu (kể cả đăng nhập) do mã của trang cổng gửi. Nhân viên TỰ GÕ mã
// xác nhận (tiện ích chỉ chép ảnh mã sang app cho dễ nhìn, không đọc mã). Đã thử thật 21/11/2026: cổng nhận, xuất đủ 99 hóa đơn.
//
// AN TOÀN:
//   - Thấy cổng báo "không hợp lệ / bị chặn / quá nhiều" → DỪNG HẲN (biChan), app không cho chạy tiếp.
//   - Sai MẬT KHẨU → DỪNG HẲN, không thử lại (thử lại là khoá tài khoản của khách). Sai mã xác nhận thì vô hại, lấy mã mới.
//   - Danh sách nút CẤM bấm (đăng xuất, xoá, huỷ…) — chỉ hàm dangXuat được bấm nút Đăng xuất, và chỉ khi app yêu cầu.
//     (21/11/2026 bộ dò nút xuất từng bấm nhầm "Đăng xuất" ở đầu trang vì chú thích cũng có chữ "xuất".)
//
// GIAO DIỆN CỔNG (Ant Design 3, dò thật 21/11/2026 ở /tra-cuu/tra-cuu-hoa-don): hai tab "bán ra / mua vào" nằm sẵn trong trang
// (tab ẩn có lớp ant-tabs-tabpane-inactive nhưng VẪN có kích thước); ô ngày chỉ đọc → bấm mở lịch, gõ vào .ant-calendar-input,
// Enter; nút xuất chỉ có biểu tượng, chú thích "Xuất hóa đơn" (rê chuột mới hiện), nằm trong khung tab đang mở.
// Hộp đăng nhập: CHƯA dò thật — bộ nhận đoán theo Ant Design (hộp có ô mật khẩu); hụt thì "Dò trang" gửi về để chỉnh.

(() => {
  const cho = ms => new Promise(r => setTimeout(r, ms))
  const gon = s => String(s || '').replace(/\s+/g, ' ').trim()
  const boDau = s => gon(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  const coKichThuoc = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  // Hiện thật: có kích thước VÀ không nằm trong tab đang ẩn
  const hien = el => !el.closest('.ant-tabs-tabpane-inactive') && coKichThuoc(el)
  const laCong = () => /hoadondientu\.gdt\.gov\.vn$/.test(location.hostname) || window.__svtHddtThu === true

  const CHAN = /khong hop le|bi chan|vuot qua so lan|tu choi truy cap|qua nhieu yeu cau|tam khoa/
  const CAM = /\b(dang xuat|logout|thoat|doi mat khau|xoa|huy)\b/

  const thongBao = () => [...document.querySelectorAll('.ant-message, .ant-notification, .ant-modal-body, .ant-alert, .ant-form-explain, .ant-form-item-explain')]
    .filter(hien).map(el => gon(el.innerText)).filter(t => t && t !== gon(document.title))
  const biChan = () => thongBao().find(t => CHAN.test(boDau(t)))

  const tenNut = (el, them = '') => boDau([el.innerText, el.getAttribute('title'), el.getAttribute('aria-label'), them].join(' '))
  const bam = (el, { chuThichDaDoc = '', choPhepCam = false } = {}) => {
    if (!choPhepCam && CAM.test(tenNut(el, chuThichDaDoc))) throw new Error('Chặn bấm nút cấm: ' + tenNut(el, chuThichDaDoc))
    el.scrollIntoView({ block: 'center' })
    for (const k of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new MouseEvent(k, { bubbles: true, cancelable: true, view: window }))
    if (typeof el.click === 'function') el.click()                 // ảnh SVG không có .click()
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  }
  const datGiaTri = (el, gt) => {
    const dat = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    el.focus()
    dat.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }))
    dat.call(el, gt); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const phim = (el, key, keyCode) => { for (const k of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(k, { key, code: key, keyCode, which: keyCode, bubbles: true })) }
  const choHetQuay = async (gioiHan = 30000) => {
    const bd = Date.now()
    await cho(500)
    while (Date.now() - bd < gioiHan) {
      if (![...document.querySelectorAll('.ant-spin-spinning, .ant-btn-loading')].some(hien)) return true
      await cho(300)
    }
    return false
  }
  const choDen = async (dk, gioiHan = 15000, buoc = 300) => {
    const bd = Date.now()
    while (Date.now() - bd < gioiHan) { const v = await dk(); if (v) return v; await cho(buoc) }
    return null
  }
  const timNut = (re, goc = document) => [...goc.querySelectorAll('button, [role=button], .ant-btn, a')].filter(hien)
    .find(el => re.test(boDau(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label'))) && !el.disabled)
  const timTab = re => [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien).find(el => re.test(boDau(el.innerText)))
  // Nút chỉ có biểu tượng → rê chuột cho hiện chú thích rồi đọc
  const chuThich = async el => {
    for (const k of ['pointerover', 'mouseover', 'mouseenter']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseenter', view: window }))
    await cho(350)
    const t = [...document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner')]
      .filter(coKichThuoc).map(x => gon(x.innerText)).join(' | ')
    for (const k of ['pointerout', 'mouseout', 'mouseleave']) el.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseleave', view: window }))
    await cho(150)
    return t
  }

  // ── Đăng nhập ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // Hộp đăng nhập = hộp thoại đang hiện có ô mật khẩu
  const hopDangNhap = () => [...document.querySelectorAll('.ant-modal-wrap, .ant-modal, [role=dialog], form')]
    .filter(coKichThuoc).find(m => m.querySelector('input[type=password]'))
  // Hộp "Nhập mã captcha" của màn tra cứu: hộp thoại đang hiện, tiêu đề / nhãn có chữ "mã captcha", có ô nhập, KHÔNG có ô mật khẩu
  const hopMaTraCuu = () => [...document.querySelectorAll('.ant-modal-wrap, .ant-modal')].filter(coKichThuoc)
    .find(m => !m.querySelector('input[type=password]') && m.querySelector('input:not([type=hidden])') && /ma captcha|ma xac nhan/.test(boDau(m.innerText)))
  // Nút / liên kết "Đăng nhập" ngoài hộp thoại (đầu trang)
  const nutMoDangNhap = () => [...document.querySelectorAll('a, button, [role=button], span, div, li')]
    .filter(coKichThuoc).filter(el => !el.closest('.ant-modal-wrap, .ant-modal'))
    .filter(el => /^dang nhap$/.test(boDau(el.innerText)) && el.children.length <= 2).at(-1)
  // Biểu tượng của nút (lớp anticon-…, data-icon của svg, aria-label) — nhận nút khi chú thích rê chuột không hiện
  // (tab cổng nằm khuất thì trình duyệt có thể không vẽ chú thích).
  const bieuTuong = el => boDau([...el.querySelectorAll('.anticon, i, svg, img, use')].map(i =>
    [i.getAttribute('aria-label'), i.getAttribute('data-icon'), i.getAttribute('type'), i.getAttribute('alt'), i.getAttribute('xlink:href'), i.getAttribute('href'),
      typeof i.className === 'string' ? i.className : i.getAttribute('class')].filter(Boolean).join(' ')).join(' '))
  // Nút Đăng xuất ở đầu trang (biểu tượng, chú thích "Đăng xuất") — có nút này là đang đăng nhập
  const timNutDangXuat = async () => {
    const coChu = [...document.querySelectorAll('a, button, [role=button], li, span')].filter(coKichThuoc)
      .find(el => /^dang xuat$/.test(boDau(el.innerText)))
    if (coChu) return coChu
    const ung = [...document.querySelectorAll('button, .ant-btn, [role=button], a')].filter(coKichThuoc)
      .filter(el => !gon(el.innerText) && !el.closest('.ant-tabs-tabpane'))      // nút trong khung tra cứu thì không phải
    const theoHinh = ung.find(el => /logout|poweroff|log-out|sign-out|signout|dang xuat/.test(bieuTuong(el) + ' ' + boDau(el.getAttribute('title') || el.getAttribute('aria-label'))))
    if (theoHinh) return theoHinh
    for (const el of ung) if (/dang xuat/.test(boDau(await chuThich(el)))) return el
    return null
  }
  // Chữ ở dải đầu trang (tên / MST tài khoản đang đăng nhập thường nằm ở đây)
  const chuDauTrang = () => [...document.querySelectorAll('header, .ant-layout-header, nav, [class*=header], [class*=Header]')]
    .filter(coKichThuoc).filter(el => el.getBoundingClientRect().top < 150).map(el => gon(el.innerText)).join(' ').slice(0, 500)
  // Đang đăng nhập? Dấu hiệu chắc nhất là cookie phiên "jwt" của cổng có giá trị (CHỈ ĐỌC để biết trạng thái — tiện ích không dùng
  // nó gọi gì). Không đọc được cookie thì đoán theo giao diện: không còn nút "Đăng nhập" + không có hộp đăng nhập.
  // ⚠ Cửa sổ hẹp thì cổng gập menu vào nút ☰ → nút "Đăng nhập" bị ẩn → đoán theo giao diện sẽ báo NHẦM là đã đăng nhập (21/11/2026).
  const coJwt = () => { const m = document.cookie.match(/(?:^|;\s*)jwt=([^;]*)/); return m ? m[1].length > 10 : null }
  const daDangNhap = () => {
    if (hopDangNhap()) return false
    const j = coJwt()
    return j != null ? j : !nutMoDangNhap()
  }

  // Chép ảnh mã xác nhận đang hiện trên trang (trang đã tải sẵn — tiện ích KHÔNG gọi cổng lấy mã)
  const anhMa = async hop => {
    const img = [...hop.querySelectorAll('img')].filter(coKichThuoc).find(i => !/logo/i.test(i.src + i.alt + i.className))
    if (img) {
      if (/^data:/.test(img.src)) return img.src
      try {
        if (!img.complete) await new Promise(r => { img.onload = r; setTimeout(r, 2000) })
        const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height
        c.getContext('2d').drawImage(img, 0, 0)
        return c.toDataURL('image/png')
      } catch { return img.src }
    }
    const svg = [...hop.querySelectorAll('svg')].filter(coKichThuoc).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
    if (svg && svg.getBoundingClientRect().width > 50) {
      const s = svg.cloneNode(true)
      if (!s.getAttribute('xmlns')) s.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML)
    }
    return null
  }
  const oDangNhap = hop => {
    const oChu = [...hop.querySelectorAll('input')].filter(coKichThuoc).filter(i => !['password', 'checkbox', 'radio', 'hidden', 'submit'].includes(i.type))
    const oMk = [...hop.querySelectorAll('input[type=password]')].filter(coKichThuoc)[0]
    // ô tên đăng nhập: có gợi ý / id chứa "ten dang nhap|username|mst"; còn lại là ô mã xác nhận
    const laMa = i => /captcha|ma xac nhan|ma kiem tra|cvalue|ma bao ve/.test(boDau(i.placeholder + ' ' + i.id + ' ' + i.name))
    const oMa = oChu.find(laMa) || oChu.filter(i => i !== oChu[0]).at(-1)
    const oTen = oChu.find(i => i !== oMa && /ten dang nhap|username|user|mst|ma so thue/.test(boDau(i.placeholder + ' ' + i.id + ' ' + i.name))) || oChu.find(i => i !== oMa)
    return { oTen, oMk, oMa }
  }

  const api = {
    // { mst }: có thì trả thêm dungTaiKhoan = MST này hiện ở dải đầu trang (đang đăng nhập đúng công ty → khỏi đăng xuất)
    async trangThai({ mst } = {}) {
      if (!laCong()) return { ok: false, loi: 'Không phải trang cổng hóa đơn' }
      const chan = biChan()
      const dau = chuDauTrang()
      const so = String(mst || '').replace(/[^\d-]/g, '')
      // Lỗi đang hiện trong hộp đăng nhập (nhân viên tự gõ mã + bấm Đăng nhập trên cổng → app đọc để biết sai mã hay sai mật khẩu)
      const hop = hopDangNhap()
      const loiHop = hop ? [...hop.querySelectorAll('.ant-form-explain, .ant-form-item-explain, .ant-alert, [class*=error]')].filter(coKichThuoc).map(x => gon(x.innerText)).filter(Boolean).join(' | ') : ''
      const tbMoi = thongBao().join(' | ')
      return { ok: true, daDangNhap: daDangNhap(), coHop: !!hop, loiHop: [loiHop, hop ? tbMoi : ''].filter(Boolean).join(' | '), duongDan: location.pathname, biChan: chan || null,
        chuDauTrang: dau, dungTaiKhoan: !!so && dau.replace(/[^\d-]/g, ' ').split(/\s+/).some(x => x === so || x.startsWith(so + '-')) }
    },

    // Mở hộp đăng nhập của trang, điền tên + mật khẩu, trả ảnh mã xác nhận
    async moDangNhap({ tenDangNhap, matKhau }) {
      if (!laCong()) return { ok: false, loi: 'Không phải trang cổng hóa đơn' }
      const chan = biChan(); if (chan) return { ok: false, biChan: true, loi: chan }
      if (daDangNhap()) return { ok: true, daDangNhap: true }
      let hop = hopDangNhap()
      if (!hop) {
        // Tab đang kẹt ở trang 403 / 404 của cổng → "Về trang chủ" trước
        const ve = timNut(/^ve trang chu$/)
        if (ve) { bam(ve); await cho(2500); if (daDangNhap()) return { ok: true, daDangNhap: true } }
        await api.dongThongBao()
        const nut = nutMoDangNhap()
        if (!nut) return { ok: false, loi: 'Không thấy nút "Đăng nhập" trên trang — bấm "Dò trang" gửi em' }
        bam(nut)
        hop = await choDen(hopDangNhap, 8000)
        if (!hop) return { ok: false, loi: 'Bấm "Đăng nhập" rồi mà không thấy hộp đăng nhập' }
      }
      await cho(400)
      const { oTen, oMk, oMa } = oDangNhap(hop)
      if (!oTen || !oMk || !oMa) return { ok: false, loi: `Hộp đăng nhập thiếu ô (tên: ${!!oTen}, mật khẩu: ${!!oMk}, mã: ${!!oMa}) — bấm "Dò trang" gửi em` }
      datGiaTri(oTen, tenDangNhap); await cho(120)
      datGiaTri(oMk, matKhau); await cho(120)
      datGiaTri(oMa, ''); await cho(300)
      let anh = null
      for (let i = 0; i < 10 && !anh; i++) { anh = await anhMa(hop); if (!anh) await cho(400) }   // ảnh mã có thể tải sau hộp thoại
      if (!anh) return { ok: false, loi: 'Không thấy ảnh mã xác nhận trong hộp đăng nhập' }
      return { ok: true, anhMa: anh }
    },

    // Vào màn "Tra cứu hóa đơn" BẰNG MENU CỦA TRANG. ⚠ Mở thẳng địa chỉ /tra-cuu/tra-cuu-hoa-don (tải lại trang) thì cổng hiện
    // "403 — Rất tiếc, bạn không có quyền truy cập trang này" (anh gặp 21/11/2026): trang chỉ cho vào màn tra cứu khi đi từ menu
    // sau đăng nhập. Gặp trang 403 / 404 thì bấm "Về trang chủ" của trang rồi đi menu.
    async vaoTraCuu() {
      const coTab = () => timTab(/mua vao/) || timTab(/ban ra/)
      if (coTab()) return { ok: true, buoc: ['đã ở màn tra cứu'] }
      const buoc = []
      const ve = timNut(/^ve trang chu$/)
      if (ve) { bam(ve); buoc.push('Về trang chủ'); await cho(2500) }
      const { dong } = await api.dongThongBao()
      if (dong) buoc.push(`đóng ${dong} thông báo`)
      // Lấy phần tử SÂU NHẤT khớp chữ (li bọc a: bấm vào li không kích hoạt liên kết a bên trong)
      const muc = re => {
        const ds = [...document.querySelectorAll('a, li, span, div[role=menuitem], .ant-menu-item, .ant-menu-submenu-title')]
          .filter(coKichThuoc).filter(el => el.children.length <= 3 && re.test(boDau(el.innerText)))
        return ds.find(el => !ds.some(o => o !== el && el.contains(o)))
      }
      const moMenuCha = async () => {
        const cha = muc(/^tra cuu$/)
        if (!cha) return false
        for (const k of ['pointerover', 'mouseover', 'mouseenter']) cha.dispatchEvent(new MouseEvent(k, { bubbles: k !== 'mouseenter', view: window }))
        await cho(500)
        if (!muc(/^tra cuu hoa don$/)) { bam(cha); await cho(700) }
        buoc.push('menu "Tra cứu"')
        return true
      }
      let con = muc(/^tra cuu hoa don$/)
      if (!con && !(await moMenuCha())) {
        // Cửa sổ hẹp: menu gập vào nút ☰
        const bars = [...document.querySelectorAll('button, .ant-btn, [role=button], a, span, i')].filter(coKichThuoc)
          .find(el => !gon(el.innerText) && /bars|menu-fold|menu-unfold|anticon-menu|hamburger|navbar-toggler/.test(bieuTuong(el) + ' ' + boDau(typeof el.className === 'string' ? el.className : '')))
        if (bars) { bam(bars); buoc.push('nút ☰'); await cho(800); await moMenuCha() }
      }
      con = con || muc(/^tra cuu hoa don$/)
      if (con) { bam(con); buoc.push('"Tra cứu hóa đơn"') }
      const tab = await choDen(coTab, 10000)
      if (tab) { await api.dongThongBao(); return { ok: true, buoc } }
      const thay = [...document.querySelectorAll('a, [role=tab], .ant-menu-item, .ant-menu-submenu-title, button, h1, h2, h3')].filter(coKichThuoc)
        .map(el => gon(el.innerText)).filter(t => t && t.length < 50).slice(0, 20).join(' | ')
      return { ok: false, buoc, loi: `Không vào được màn Tra cứu hóa đơn · trang: ${location.pathname} · đã bấm: ${buoc.join(' → ') || '(không thấy menu)'} · đang thấy: ${thay}` }
    },

    // Đóng các hộp THÔNG BÁO của cổng (vd "Hiện nay, có hiện tượng…" hiện ở trang chủ) — chỉ hộp không có ô nhập, bấm nút X của hộp
    async dongThongBao() {
      let dong = 0
      for (const m of [...document.querySelectorAll('.ant-modal-wrap')].filter(coKichThuoc)) {
        if (m.querySelector('input, textarea, select')) continue
        const x = m.querySelector('.ant-modal-close')
        if (x && coKichThuoc(x)) { bam(x); dong++; await cho(500) }
      }
      return { ok: true, dong }
    },

    // Bấm vào ảnh mã (hoặc nút làm mới cạnh ảnh) để trang tự lấy mã mới
    async layMaMoi() {
      const hop = hopDangNhap(); if (!hop) return { ok: false, loi: 'Hộp đăng nhập đã đóng' }
      const cu = await anhMa(hop)
      const nutMoi = [...hop.querySelectorAll('.anticon-reload, .anticon-sync, [class*=reload], [class*=refresh]')].filter(coKichThuoc)[0]
      const img = [...hop.querySelectorAll('img, svg')].filter(coKichThuoc).find(x => !/logo/i.test((x.src || '') + (x.getAttribute('class') || '')))
      const cl = nutMoi || img
      if (!cl) return { ok: false, loi: 'Không thấy chỗ làm mới mã' }
      bam(cl.closest('button, a') || cl)
      await cho(1200)
      const anh = await anhMa(hop)
      return { ok: !!anh, anhMa: anh, doi: anh !== cu }
    },

    // Điền mã nhân viên tự gõ, bấm nút Đăng nhập CỦA TRANG, đọc kết quả
    async guiMa({ ma }) {
      const hop = hopDangNhap(); if (!hop) return { ok: false, loi: 'Hộp đăng nhập đã đóng' }
      const { oMa } = oDangNhap(hop)
      if (!oMa) return { ok: false, loi: 'Không thấy ô mã xác nhận' }
      datGiaTri(oMa, ma); await cho(200)
      const nut = timNut(/^dang nhap$/, hop) || [...hop.querySelectorAll('button[type=submit], .ant-btn-primary')].filter(coKichThuoc)[0]
      if (!nut) return { ok: false, loi: 'Không thấy nút Đăng nhập trong hộp' }
      // Câu báo lỗi của lần gõ TRƯỚC có thể còn nằm trong hộp → chỉ tin câu lỗi khi nó KHÁC câu cũ, hoặc khi đã chờ đủ lâu
      // (cùng một câu "sai mã" lặp lại) và nút không còn quay.
      const loiTrongHop = () => [...(hopDangNhap()?.querySelectorAll('.ant-form-explain, .ant-form-item-explain, .ant-alert, [class*=error]') || [])]
        .filter(coKichThuoc).map(x => gon(x.innerText)).filter(Boolean).join(' | ')
      const docLoi = () => [...new Set([...thongBao(), loiTrongHop()].filter(Boolean))].join(' | ')
      const truoc = docLoi()
      const batDau = Date.now()
      bam(nut)
      await cho(800)
      const kq = await choDen(() => {
        const chan = biChan(); if (chan) return { biChan: chan }
        if (!hopDangNhap()) return { vao: true }
        if ([...hopDangNhap().querySelectorAll('.ant-btn-loading, .ant-spin-spinning')].some(coKichThuoc)) return null
        const loi = docLoi()
        if (!loi) return null
        return (loi !== truoc || Date.now() - batDau > 4000) ? { loi } : null
      }, 15000, 400)
      if (!kq) return { ok: false, loi: 'Quá 15 giây chưa thấy kết quả đăng nhập' }
      if (kq.biChan) return { ok: false, biChan: true, loi: kq.biChan }
      if (kq.vao) { await cho(1500); return { ok: true, daDangNhap: daDangNhap() } }
      const k = boDau(kq.loi)
      const saiMa = /captcha|ma xac nhan|ma kiem tra|ma bao ve/.test(k)
      const saiMk = !saiMa && /mat khau|ten dang nhap|tai khoan|khong dung|khong chinh xac/.test(k)
      let anh = null
      if (saiMa) { await cho(800); anh = await anhMa(hopDangNhap() || hop) }
      return { ok: false, saiMa, saiMatKhau: saiMk, loi: kq.loi, anhMa: anh }
    },

    // Đăng xuất bằng nút của trang — CHỈ khi app yêu cầu (đổi sang công ty khác / xong việc)
    async dangXuat() {
      if (!daDangNhap()) return { ok: true, daXuat: true }
      const nut = await timNutDangXuat()
      if (!nut) return { ok: false, loi: 'Không thấy nút Đăng xuất' }
      bam(nut, { choPhepCam: true })
      await cho(800)
      const hop = [...document.querySelectorAll('.ant-modal-wrap, .ant-modal-confirm, .ant-popover')].filter(coKichThuoc).at(-1)
      if (hop) {
        const dongY = [...hop.querySelectorAll('button')].filter(coKichThuoc).find(el => /dong y|xac nhan|^ok$|^co$|dang xuat/.test(boDau(el.innerText)))
        if (dongY) { bam(dongY, { choPhepCam: true }); await cho(800) }
      }
      const xong = await choDen(() => !daDangNhap() || nutMoDangNhap(), 10000)
      return { ok: !!xong }
    },

    // ── Hộp "Nhập mã captcha" khi TRA CỨU (cổng hỏi mã trước khi trả kết quả — thấy thật 21/11/2026 ở tab bán ra) ─────────
    // Không lách: chép ảnh mã sang app, NHÂN VIÊN gõ, tiện ích điền vào ô của hộp rồi bấm "Xác nhận" của trang.
    async nhapMaTraCuu({ ma }) {
      const hop = hopMaTraCuu()
      if (!hop) return { ok: true, daDong: true }
      const o = [...hop.querySelectorAll('input')].filter(coKichThuoc).filter(i => i.type !== 'hidden')[0]
      if (!o) return { ok: false, loi: 'Không thấy ô nhập mã trong hộp' }
      datGiaTri(o, ma); await cho(200)
      const nut = timNut(/^xac nhan$|^dong y$|^ok$/, hop)
      if (!nut) return { ok: false, loi: 'Không thấy nút Xác nhận trong hộp' }
      const anhCu = await anhMa(hop)
      bam(nut)
      const kq = await choDen(async () => {
        const chan = biChan(); if (chan) return { biChan: chan }
        const h = hopMaTraCuu()
        if (!h) return { ok: true }
        const loi = [...h.querySelectorAll('.ant-form-explain, .ant-form-item-explain, [class*=error]')].filter(coKichThuoc).map(x => gon(x.innerText)).filter(Boolean).join(' | ')
        const anh = await anhMa(h)
        if (loi || (anh && anh !== anhCu)) return { saiMa: true, loi: loi || 'Mã chưa đúng', anhMa: anh }
        return null
      }, 15000, 500)
      if (!kq) return { ok: false, loi: 'Quá 15 giây hộp mã chưa đóng' }
      if (kq.biChan) return { ok: false, biChan: true, loi: kq.biChan }
      return kq.ok ? { ok: true } : { ok: false, saiMa: true, loi: kq.loi, anhMa: kq.anhMa }
    },

    // ── Một lượt xuất: { loai: 'mua'|'ban', tuNgay, denNgay, tabCon: ''|'mtt', xuat, chiBam, tuBuoc } ────────────────
    //   Gặp hộp mã captcha khi tra / xuất → trả { canMa: true, anhMa, buocMa: 'tim'|'xuat' }; app hỏi nhân viên, gọi nhapMaTraCuu,
    //   rồi gọi lại chayLuot với tuBuoc = 'sau_tim' | 'sau_xuat' để đi tiếp từ đúng chỗ.
    async chayLuot(tuyChon) {
      const { loai = 'mua', tuNgay = '', denNgay = '', tabCon = '', xuat = true, chiBam = false, tuBuoc = '' } = tuyChon || {}
      const nhatKy = []
      const ghi = (buoc, ok, chiTiet = '') => nhatKy.push({ buoc, ok, chiTiet: String(chiTiet).slice(0, 400) })
      const dienNgay = async (el, gt) => {
        if (!el.readOnly) { datGiaTri(el, gt); await cho(150); phim(el, 'Enter', 13); el.blur(); await cho(250); return el.value }
        if (el.value === gt) return el.value                 // đã đúng sẵn — đừng mở lịch (mở/đóng thừa từng làm mất giá trị)
        bam(el)
        const oLich = await choDen(() => [...document.querySelectorAll('.ant-calendar-picker-container .ant-calendar-input, .ant-calendar-input')].filter(coKichThuoc).at(-1), 3000, 150)
        if (!oLich) return el.value + ' (không mở được lịch)'
        datGiaTri(oLich, gt); await cho(300)
        phim(oLich, 'Enter', 13)
        // Chờ ô ngày NHẬN giá trị rồi mới đóng lịch. Tab cổng chạy ngầm thì lịch đóng chậm; bản trước bấm Esc khi lịch chưa kịp
        // đóng → Esc huỷ luôn ngày vừa chọn → cổng báo "Bạn chưa nhập Đến ngày" (Tháng 07, 21/11/2026).
        const nhan = await choDen(() => el.value === gt, 2500, 150)
        if (nhan) {
          if (oLich.isConnected && coKichThuoc(oLich)) { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await cho(300) }
        } else if (oLich.isConnected && coKichThuoc(oLich)) { phim(oLich, 'Escape', 27); await cho(300) }
        return el.value
      }
      const soKetQua = () => {
        const vung = [...document.querySelectorAll('.ant-tabs-tabpane-active')].filter(hien).map(x => x.innerText).join(' ') || document.body.innerText
        const m = vung.match(/Có\s+([\d.]+)\s+kết quả/)
        return m ? Number(m[1].replace(/\./g, '')) : null
      }
      const canMa = async buocMa => {
        const h = hopMaTraCuu()
        ghi(buocMa === 'tim' ? 'Bấm Tìm kiếm' : 'Bấm xuất', true, 'Cổng hỏi mã captcha — chờ nhân viên gõ')
        return { ok: false, canMa: true, buocMa, anhMa: h ? await anhMa(h) : null, nhatKy }
      }
      // Kết quả sau Tìm kiếm → bấm xuất. Tách riêng để đi tiếp được sau khi nhân viên gõ mã captcha.
      const sauTim = async () => {
        const khung = [...document.querySelectorAll('.ant-tabs-tabpane-active')].filter(hien)
          .find(p => [...p.querySelectorAll('button')].some(b => /^tim kiem$/.test(boDau(b.innerText))))
        const xong = await choHetQuay()
        const chan1 = biChan()
        if (chan1) { ghi('Bấm Tìm kiếm', false, 'CỔNG CHẶN: ' + chan1); return { ok: false, biChan: true, nhatKy } }
        if (hopMaTraCuu()) return canMa('tim')
        const loiForm = [...document.querySelectorAll('.ant-form-explain, .ant-form-item-explain')].filter(hien).map(el => gon(el.innerText)).filter(Boolean)
        if (loiForm.length) { ghi('Bấm Tìm kiếm', false, 'Cổng báo: ' + loiForm.join(' | ')); return { ok: false, loiForm: loiForm.join(' | '), nhatKy } }
        const so = soKetQua()
        ghi('Kết quả tra cứu', xong, `${xong ? '' : 'Quá 30 giây vẫn đang tải · '}${so == null ? '(không đọc được số kết quả)' : 'Có ' + so + ' kết quả'}`)
        if (so === 0) return { ok: true, soKetQua: 0, khongCo: true, nhatKy }
        if (!xuat) return { ok: true, soKetQua: so, nhatKy }
        await cho(800)
        if (!khung) { ghi('Tìm nút xuất', false, 'Không xác định được khung tab đang mở — dừng để khỏi bấm nhầm'); return { ok: false, nhatKy } }
        // Mọi nút biểu tượng có chú thích "Xuất…" (trừ XML / In) — chọn nút ĐANG MỞ; chưa nút nào mở thì chờ
        const daDoc = [], ungVien = []
        for (const el of [...khung.querySelectorAll('button, .ant-btn')].filter(hien).filter(el => !gon(el.innerText))) {
          const t = await chuThich(el)
          const k = boDau(t)
          daDoc.push((t || '(không chú thích)') + (el.disabled ? ' [tắt]' : ''))
          if (/xuat|excel|tai ve/.test(k) && !CAM.test(k) && !/xml|^in\b|in hoa don/.test(k)) ungVien.push({ el, t })
        }
        if (!ungVien.length) { ghi('Tìm nút xuất', false, 'Các nút biểu tượng trong khung: ' + (daDoc.join(' ; ') || '(không có)')); return { ok: false, nhatKy } }
        let chon = ungVien.find(u => !u.el.disabled)
        if (!chon) {
          // Có hóa đơn đang được CHỌN trong bảng thì nút xuất danh sách có thể bị khoá → bỏ chọn (bấm lại ô chọn của chính hàng đó)
          const daChon = [...khung.querySelectorAll('tr.ant-table-row-selected, tbody input[type=checkbox]:checked')].filter(hien)
          for (const x of daChon) { const o = x.matches('input') ? x : x.querySelector('input[type=checkbox]'); if (o) { bam(o); await cho(400) } }
          await choDen(() => ungVien.find(u => !u.el.disabled), 15000, 500)
          chon = ungVien.find(u => !u.el.disabled)
          if (!chon) {
            const hang = [...khung.querySelectorAll('table tbody tr')].filter(hien).filter(tr => !/placeholder|measure/.test(tr.className) && gon(tr.innerText)).length
            const trong = !hang || /khong co du lieu|no data/.test(boDau(khung.innerText))
            if (trong) { ghi('Tìm nút xuất', true, 'Nút xuất khoá + bảng trống → không có hóa đơn'); return { ok: true, soKetQua: 0, khongCo: true, nhatKy } }
            ghi('Tìm nút xuất', false, `Nút xuất vẫn khoá sau 15 giây · ${so == null ? 'không đọc được số kết quả' : 'Có ' + so + ' kết quả'} · ${hang} hàng · ${daChon.length} hàng đang chọn (đã bỏ chọn) · đã đọc: ${daDoc.join(' ; ')}`)
            return { ok: false, nhatKy }
          }
        }
        ghi('Tìm nút xuất', true, chon.t)
        bam(chon.el, { chuThichDaDoc: chon.t })
        await cho(1500)
        return sauXuat(so)
      }
      const sauXuat = async so => {
        if (hopMaTraCuu()) return canMa('xuat')
        const hop = [...document.querySelectorAll('.ant-modal-wrap, .ant-popover, .ant-modal-confirm')].filter(x => coKichThuoc(x) && getComputedStyle(x).display !== 'none').at(-1)
        if (hop && !hop.querySelector('input')) {
          const dongY = [...hop.querySelectorAll('button')].filter(coKichThuoc).find(el => /dong y|xac nhan|xuat|tai|^ok$|^co$/.test(boDau(el.innerText)))
          ghi('Hộp thoại sau Xuất', !!dongY, gon(hop.innerText).slice(0, 250))
          if (dongY) { bam(dongY); await cho(1200) }
        }
        await choHetQuay(60000)
        if (hopMaTraCuu()) return canMa('xuat')
        const chan2 = biChan()
        if (chan2) { ghi('Bấm xuất', false, 'CỔNG CHẶN: ' + chan2); return { ok: false, biChan: true, nhatKy } }
        ghi('Bấm xuất', true, 'Đã bấm')
        return { ok: true, soKetQua: so ?? soKetQua(), nhatKy }
      }

      try {
        if (!laCong()) { ghi('Kiểm trang', false, 'Không phải trang hoadondientu.gdt.gov.vn'); return { ok: false, nhatKy } }
        const chan0 = biChan()
        if (chan0) { ghi('Kiểm trang', false, 'Cổng đang báo: ' + chan0); return { ok: false, biChan: true, nhatKy } }
        if (!daDangNhap()) { ghi('Kiểm trang', false, 'Chưa đăng nhập cổng'); return { ok: false, chuaDangNhap: true, nhatKy } }
        if (tuBuoc === 'sau_tim') return await sauTim()
        if (tuBuoc === 'sau_xuat') return await sauXuat(null)
        if (hopMaTraCuu()) return canMa('tim')
        const { dong } = await api.dongThongBao()
        ghi('Kiểm trang', true, location.pathname + (dong ? ` · đóng ${dong} hộp thông báo` : ''))

        const tenTab = loai === 'ban' ? 'bán ra' : 'mua vào'
        const reTab = loai === 'ban' ? /ban ra/ : /mua vao/
        let tab = await choDen(() => timTab(reTab), 3000)
        if (!tab) {
          const v = await api.vaoTraCuu()
          if (!v.ok) { ghi('Vào màn tra cứu', false, v.loi); return { ok: false, nhatKy } }
          ghi('Vào màn tra cứu', true, v.buoc.join(' → '))
          tab = await choDen(() => timTab(reTab), 5000)
          if (!tab) { ghi('Chọn tab ' + tenTab, false, 'Đã vào màn tra cứu nhưng không thấy tab'); return { ok: false, nhatKy } }
        }
        bam(tab); await cho(900); ghi('Chọn tab ' + tenTab, true, gon(tab.innerText))

        const t2 = timTab(tabCon === 'mtt' ? /may tinh tien/ : /^hoa don dien tu$/)
        if (t2) { bam(t2); await cho(700); ghi('Chọn loại hóa đơn', true, gon(t2.innerText)) }
        else if (tabCon === 'mtt') { ghi('Chọn loại hóa đơn', false, 'Không thấy tab máy tính tiền'); return { ok: false, nhatKy } }

        if (!chiBam) {
          let oNgay = [...document.querySelectorAll('input.ant-calendar-picker-input, .ant-calendar-picker input, .ant-picker input')].filter(hien)
          if (oNgay.length < 2) oNgay = [...document.querySelectorAll('input')].filter(hien).filter(el => /ngay|dd\/mm|thoi diem/.test(boDau(el.placeholder)))
          if (oNgay.length < 2) { ghi('Tìm ô ngày', false, 'Chỉ thấy ' + oNgay.length + ' ô'); return { ok: false, nhatKy } }
          // Cổng giới hạn khoảng ngày (≤ 1 tháng) và ô này phụ thuộc ô kia → điền lại tối đa 3 lần, đổi thứ tự:
          // lần 1 Từ → Đến; lần 2 Đến → Từ; lần 3 Từ → Đến (bán ra T7 21/11/2026: "Đến ngày" giữ nguyên 21/11).
          let a = oNgay[0].value, b = oNgay[1].value
          for (let lan = 0; lan < 3 && !(a === tuNgay && b === denNgay); lan++) {
            if (lan === 1) { b = await dienNgay(oNgay[1], denNgay); a = await dienNgay(oNgay[0], tuNgay) }
            else { a = await dienNgay(oNgay[0], tuNgay); b = await dienNgay(oNgay[1], denNgay) }
            a = oNgay[0].value; b = oNgay[1].value
          }
          const khop = a === tuNgay && b === denNgay
          ghi('Điền ngày', khop, `Từ ngày: "${a}" · Đến ngày: "${b}"`)
          if (!khop) return { ok: false, nhatKy }
        } else ghi('Điền ngày', true, 'Bỏ qua — nhân viên tự điền')

        const nutTim = timNut(/^tim kiem$/)
        if (!nutTim) { ghi('Bấm Tìm kiếm', false, 'Không thấy nút'); return { ok: false, nhatKy } }
        bam(nutTim)
        return await sauTim()
      } catch (e) {
        ghi('Lỗi', false, String(e?.message || e))
        return { ok: false, nhatKy }
      }
    },

    // Dò trang: nút (kể cả nút biểu tượng + chú thích), ô nhập, tab, hộp thoại, ảnh — để chỉnh bộ bấm theo giao diện thật
    async doTrang() {
      const lop = el => gon(typeof el.className === 'string' ? el.className : el.getAttribute('class')).slice(0, 80)
      const nut = []
      for (const el of [...document.querySelectorAll('button, [role=button], .ant-btn, a')].filter(hien)) {
        const chu = gon(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label')).slice(0, 80)
        if (/^(xem danh sach|thong tin lien quan)/.test(boDau(chu))) continue
        const muc = { the: el.tagName.toLowerCase(), chu, lop: lop(el), tat: !!el.disabled, trongHop: !!el.closest('.ant-modal-wrap, .ant-modal'), trongKhung: !!el.closest('.ant-tabs-tabpane') }
        if (!chu) { muc.bieuTuong = bieuTuong(el).slice(0, 120); if (el.tagName !== 'A') muc.chuThich = await chuThich(el) }
        nut.push(muc)
        if (nut.length >= 50) break
      }
      const o = [...document.querySelectorAll('input, select, textarea')].filter(hien)
        .map(el => ({ the: el.tagName.toLowerCase(), kieu: el.type || '', id: el.id || '', ten: el.name || '', goiY: gon(el.placeholder), giaTri: el.type === 'password' ? '' : gon(el.value).slice(0, 40), chiDoc: !!el.readOnly, lop: lop(el), trongHop: !!el.closest('.ant-modal-wrap, .ant-modal') }))
        .slice(0, 40)
      const hop = [...document.querySelectorAll('.ant-modal-wrap, .ant-modal, [role=dialog]')].filter(coKichThuoc).map(m => ({
        lop: lop(m), chu: gon(m.innerText).slice(0, 300),
        anh: [...m.querySelectorAll('img, svg, canvas')].filter(coKichThuoc).map(x => ({ the: x.tagName.toLowerCase(), lop: lop(x), src: String(x.getAttribute('src') || '').slice(0, 60), rong: Math.round(x.getBoundingClientRect().width) })),
      }))
      const tab = [...document.querySelectorAll('[role=tab], .ant-tabs-tab')].filter(hien)
        .map(el => ({ chu: gon(el.innerText), chon: el.getAttribute('aria-selected') === 'true' || /active/.test(lop(el)) })).slice(0, 20)
      const dauTrang = [...document.querySelectorAll('header a, header span, .ant-layout-header a, nav a')].filter(coKichThuoc).map(x => gon(x.innerText)).filter(Boolean).slice(0, 20)
      return { url: location.href, tieuDe: document.title, daDangNhap: daDangNhap(), dauTrang, chuDauTrang: chuDauTrang(), nut, o, hop, tab, thongBao: thongBao().slice(0, 10), tong: (document.body.innerText.match(/Có\s+[\d.]+\s+kết quả/g) || []).slice(0, 4) }
    },
  }

  window.__svtHddt = api
})()
