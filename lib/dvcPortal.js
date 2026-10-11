// Đọc dữ liệu cổng Dịch vụ công thuế (dichvucong.gdt.gov.vn) — Phân hệ Tờ khai.
//
// File này CHỈ CÒN BỘ ĐỌC THUẦN, không gọi mạng. Phần tự gọi cổng đã xoá ngày 29/09/2026 cùng hai
// route /api/admin/tokhai/connect và /sync: cổng chặn IP nước ngoài nên máy chủ (Vercel ở
// Singapore) không bao giờ gọi được, để lại chỉ tổ có người nối lại rồi lãnh nút treo 15 giây.
//
// ⇒ BẤT BIẾN CỦA PHÂN HỆ: MÁY CHỦ KHÔNG BAO GIỜ GỌI CỔNG THUẾ. Mọi lượt gọi đi qua tiện ích Chrome
//   trên máy nhân viên (xem chrome-extension/). Máy chủ chỉ dựng sẵn yêu cầu và đọc phản hồi.
//   Kiểm nhanh: `grep -rn "dichvucong.gdt.gov.vn" app/api` chỉ được ra CHUỖI dựng URL, không được
//   ra chỗ nào `fetch(...)` thẳng.
//
// ─────────────────────────────────────────────────────────────────────────────
// LUỒNG CỔNG — ghi lại ở đây vì mã thực hiện đã xoá. Đã chạy thật 18/09 và 28/09/2026.
// Nơi dựng các yêu cầu này: app/api/admin/tokhai/{sync-ext,tai-file,connect-ext}/route.js
//
//   1. GET  /tthc/login                  → đọc token ở thẻ <meta name="csrf-token">
//                                          ⚠ KHÔNG phải giá trị cookie XSRF-TOKEN cùng tên
//   2. GET  /tthc/login/getCaptcha?<ts>  → ảnh PNG, người gõ (không OCR, không dịch vụ giải mã)
//   3. POST /tthc/loginLDAP              → tenDN, matKhau (base64), doiTuong=DN, captcha, _csrf
//                                          header X-XSRF-TOKEN = token ở bước 1
//                                          thành công khi phản hồi có "status":"200"|"201"
//                                          ⚠ cổng kiểm CAPTCHA TRƯỚC mật khẩu: lỗi có chữ
//                                            'captcha' thì cho gõ lại, KHÔNG tính là sai mật khẩu
//   4. GET  /tthc/tchs                   → ⚠ TOKEN ĐỔI sau khi đăng nhập, phải đọc lại ở đây,
//                                          không thì mọi lệnh sau bị 403
//   5. GET  /tthc/checkCaptcha?captcha=  → trả đúng chữ 'success' mới tra cứu được
//   6. GET  /tthc/ho-so/search?…         → size CHỈ nhận 20/30/50; gửi 100 là bảng RỖNG mà không
//                                          báo lỗi. Khoảng ngày tối đa 30. Mã captcha tra cứu
//                                          DÙNG LẠI được cho nhiều cửa sổ trong cùng phiên.
//   7. GET  /tthc/tchs/files/detail/<mã>?loai=   → KHÔNG tốn captcha
//   8. GET  /tthc/tchs/validateIdTkhai?idTKhai=  → phải gọi trước khi tải, thiếu là cổng báo
//                                          "Hồ sơ truyền lên không hợp lệ"
//   9. POST /tthc/tchs/downloadhoso      → JSON vào, JSON ra { content base64, fileName, fileType }
//                                          tờ khai trả về dạng .zip chứa XML, không phải XML trần
//  10. POST /tthc/tchs/downloadthongbao  → tương tự; loaiTBao KHÔNG chọn được định dạng, luôn XML
//  11. POST /tthc/logout                 → LUÔN gọi, kể cả khi lỗi. Bỏ qua là cổng giữ phiên treo,
//                                          lần sau công ty đó báo "đang dùng ở tab khác"
//
// Ràng buộc khác: mỗi tài khoản CHỈ MỘT phiên; chỉ tải được hồ sơ của lần tra cứu GẦN NHẤT trong
// phiên; gọi dày là HTTP 429.
//
// ─────────────────────────────────────────────────────────────────────────────
// TAB THỨ HAI: "Tra cứu hồ sơ đã nộp trên thuế điện tử" — HỒ SƠ TRƯỚC 01/07/2025
//
// Trang tra cứu /tthc/tchs có HAI tab, phạm vi khít nhau không chồng lấn:
//   · tab 1 "đã nộp trên DVC"          → hồ sơ nộp TỪ 01/07/2025  (luồng 1-11 ở trên)
//   · tab 2 "đã nộp trên thuế điện tử" → hồ sơ nộp TRƯỚC 01/07/2025
// Chính cổng ghi dòng chữ đỏ: "Chức năng chỉ hỗ trợ đối với tra cứu tờ khai nộp trước ngày
// 01/07/2025". Đây là lý do tra cả năm 2025 chỉ về được từ Q2 trở đi (Q1 nộp tháng 4/2025).
//
// ⇒ KHÔNG CẦN DỰNG CỔNG thuedientu.gdt.gov.vn THẬT. Cổng cũ chạy khung dse_* đời 2000, trang 4 MB,
//   phải bóc HTML — đã khảo sát 10/10/2026 và bỏ. Tab này nằm ngay trên cổng mới, DÙNG CHUNG đăng
//   nhập, captcha, tiện ích Chrome và phiên hiện có.
//
// Khác biệt so với tab 1 (đo thật 11/10/2026, anh lấy giúp bằng DevTools):
//   a. POST /tthc/tchs/thuedientu        (tab 1 là GET /tthc/ho-so/search)
//      body form-urlencoded: _csrf, page, size, maToKhai_tdt, maGiaoDichTthc_tdt,
//                            tuNgay_tdt, denNgay_tdt, scope_tdt2=SELF, mstUyQuyen_tdt2, captcha,
//                            btnSearch_tdt
//      header: hx-request=true, hx-target=bangKetQuaTraCuu_tdt, hx-trigger=form_search_tdt,
//              accept=text/html-partial, X-XSRF-TOKEN
//   b. NGÀY dạng dd/MM/yyyy ('01/04/2025') — GIỐNG tab 1, không phải chuyển đổi gì.
//      (Ghi chú đầu tiên ở đây nói tab 1 dùng ISO là SAI: sync-ext đã gửi ddmmyyyy từ đầu.)
//   c. maToKhai_tdt ĐỂ TRỐNG = tất cả sắc thuế. Ô này nhìn như bắt buộc ('---Vui lòng chọn---')
//      nhưng để trống vẫn ra kết quả → KHÔNG phải lặp theo từng sắc thuế.
//   d. Khoá chính là MÃ GIAO DỊCH (17 số, vd 11320250319013481), không phải mã hồ sơ.
//   e. Chi tiết: GET /tthc/tchs/files/detail/<mã giao dịch>?loai=ETAX  ← CÙNG địa chỉ bước 7,
//      chỉ khác loai=ETAX thay vì để trống.
//   f. TẢI FILE — đã bắt đủ cả hai link ngày 11/10/2026. Luồng GIỐNG HỆT tab 1, chỉ khác đuôi
//      địa chỉ; THÂN yêu cầu y nguyên nên dùng lại được mã đang chạy:
//         · xin phép : GET /tthc/tchs/validateIdTkhai?idTKhai=<mã giao dịch>
//                      ⚠ KHÔNG có đuôi -tdt, KHÔNG cần loaiTraCuu — chung địa chỉ với tab 1
//         · tờ khai  : POST /tthc/tchs/downloadhoso-tdt?loaiTraCuu=ETAX     body {"maHoSo":"<mã>"}
//         · thông báo: POST /tthc/tchs/downloadthongbao-tdt?loaiTraCuu=ETAX body {"idTbao":"<mã>",
//                                                                                "loaiTBao":""}
//      header cả hai: content-type application/json, x-requested-with=XMLHttpRequest,
//                     X-XSRF-TOKEN = token TRONG trang chi tiết (không phải token phiên)
//
//   ⇒ Tóm lại toàn bộ khác biệt của tab 2 gói trong: địa chỉ tra cứu, dạng ngày dd/MM/yyyy,
//     tên tham số *_tdt, và đuôi '-tdt?loaiTraCuu=ETAX' ở hai lệnh tải. Phần còn lại — đăng nhập,
//     captcha, xin phép, thân yêu cầu, đăng xuất — dùng chung không sửa gì.
// ─────────────────────────────────────────────────────────────────────────────

export const RANGE_MAX_DAYS = 30        // cổng chặn khoảng tra cứu dài hơn 30 ngày

const ngayVNsangISO = s => {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00'}:${m[5] || '00'}:00+07:00`
}
const bocChu = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

// Cổng CHỈ nhận cỡ trang 20 / 30 / 50 (xem ô chọn trên trang tra cứu). Gửi 100 thì nó trả bảng
// RỖNG mà không báo lỗi — đã mất một lượt thử vì chỗ này (22/09/2026).
const CO_TRANG = 50


// Bộ đọc THUẦN, không gọi mạng — dùng chung cho cả đường máy chủ tự gọi (local) lẫn đường đi qua
// tiện ích Chrome (production). Nhờ tách ra, sửa cách đọc bảng chỉ cần deploy app.
export function docBangKetQua(html, { tuNgay, denNgay, trang = 0 } = {}) {
  const ds = []
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const maHoSo = tr.match(/data-ma-ho-so="([^"]+)"/)?.[1]
    if (!maHoSo) continue
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => bocChu(c[1]))
    ds.push({
      maHoSo,
      maToKhaiCong: tr.match(/data-ma-tkhai="([^"]*)"/)?.[1] || null,   // khớp tax_filing_types.ma_tkhai_portal
      maTTHC: tr.match(/data-ma-tthc="([^"]*)"/)?.[1] || null,
      maTrangThaiCong: tr.match(/data-trang-thai="([^"]*)"/)?.[1] || null,
      tenToKhai: cells[4] || null,                        // '05/KK-TNCN - Tờ khai…'
      kyTinhThue: cells[5] || null,                       // 'Q2/2026'
      loaiToKhai: cells[6] || null,                       // 'Chính thức' | 'Bổ sung'
      lanBoSung: Number(cells[7] || 0) || 0,
      lanNop: Number(cells[8] || 1) || 1,
      coQuanThue: cells[9] || null,
      ngayNop: ngayVNsangISO(cells[10]),
      trangThaiCong: cells[11] || null,                   // 'Đã chấp nhận'
    })
  }
  // Con số nằm trong thẻ: 'Tổng số bản ghi: <span>0</span>' → phải cho phép thẻ chen vào giữa.
  const tong = html.match(/T[ổo]ng s[ốo] b[ảa]n ghi:\s*(?:<[^>]*>\s*)*(\d+)/)?.[1]
  console.log(`[DVC] tra cứu ${tuNgay || '?'}-${denNgay || '?'} trang ${trang}: cổng báo ${tong ?? '?'} bản ghi, đọc được ${ds.length} dòng, HTML ${html.length} ký tự`)
  return { ds, tongCongBao: tong ? +tong : null, conTrangSau: ds.length >= CO_TRANG }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trang chi tiết hồ sơ — KHÔNG tốn captcha (đã đo thật 18/09/2026).
//
// Lấy NGÀY TIẾP NHẬN và danh sách thông báo. Ngày trên thông báo "Tiếp nhận" chính là mốc xét
// đúng/trễ hạn — không phải ngày chấp nhận, cũng không phải ngày nộp.
// Đọc thẳng từ HTML, không cần tải file thông báo về.
// ─────────────────────────────────────────────────────────────────────────────
const gioVNsangISO = s => {
  if (!s) return null
  const m = String(s).match(/(?:(\d{2}):(\d{2})\s+)?(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[5]}-${m[4]}-${m[3]}T${m[1] || '00'}:${m[2] || '00'}:00+07:00`
}

function loaiThongBao(tieuDe) {
  const s = (tieuDe || '').toLowerCase()
  if (s.includes('tiếp nhận')) return 'tiep_nhan'
  if (s.includes('xác nhận nộp')) return 'xac_nhan_nop'
  return 'khac'
}

// Bộ đọc THUẦN, không gọi mạng — dùng chung cho cả đường local lẫn đường qua tiện ích Chrome.
export function docChiTiet(html) {
  // Các ô thông tin là <input readonly value="…"> đứng sau nhãn.
  const oThongTin = nhan => {
    const m = html.match(new RegExp(nhan + '[\\s\\S]{0,400}?value="([^"]*)"'))
    return m ? m[1].trim() : null
  }

  // Mỗi thông báo: tiêu đề 'V/v: …', rồi mốc giờ 'HH:mm dd/MM/yyyy', rồi nút tải mang data-id.
  const thongBao = []
  for (const [, tieuDe, gio] of html.matchAll(
    /V\/v:?\s*([^<]{5,160}?)\s*<\/div>\s*<div[^>]*>\s*(\d{2}:\d{2}\s+\d{2}\/\d{2}\/\d{4})/g)) {
    thongBao.push({ tieuDe: bocChu(tieuDe), thoiDiem: gioVNsangISO(gio), loai: loaiThongBao(tieuDe) })
  }
  // data-id của các nút tải đi theo đúng thứ tự thông báo ở trên.
  const ids = [...new Set([...html.matchAll(/data-id="(\d{10,})"/g)].map(m => m[1]))]
  thongBao.forEach((tb, i) => { tb.portalId = ids[i] || null })

  const tbTiepNhan = thongBao.find(t => t.loai === 'tiep_nhan')
  return {
    ngayTiepNhan: tbTiepNhan?.thoiDiem || gioVNsangISO(oThongTin('Ngày tiếp nhận')),
    trangThaiCong: oThongTin('Trạng thái'),
    noiNop: oThongTin('Nơi nộp'),
    thongBao,
  }
}


// Chuẩn hóa trạng thái cổng về trạng thái của app. LUÔN giữ chuỗi gốc bên cạnh — cổng đổi nhãn
// thì không mất dữ liệu.
export function chuanHoaTrangThai(chuCong) {
  const s = (chuCong || '').toLowerCase()
  if (s.includes('không chấp nhận') || s.includes('từ chối')) return 'rejected'
  if (s.includes('chấp nhận')) return 'accepted'
  if (s.includes('tiếp nhận') || s.includes('đang xử lý') || s.includes('chờ')) return 'received'
  return 'received'
}


// ── Bảng kết quả của TAB THỨ HAI (hồ sơ nộp trước 01/07/2025) ────────────────
//
// Cột khác tab 1 và ĐẢO THỨ TỰ hai cột: ở đây 'Lần nộp' đứng TRƯỚC 'Lần bổ sung', tab 1 thì ngược
// lại. Dùng nhầm chỉ số là ghi sai số lần bổ sung → đặt sai tên thư mục _BSLn.
//
// NEO THEO Ô MÃ GIAO DỊCH thay vì đếm cột từ đầu: HTML thật của bảng này chưa ai thấy (mới chỉ
// nhìn qua ảnh chụp màn hình), nên cổng có thêm/bớt một cột đầu là cách đếm cứng sẽ lệch hết.
// Mã giao dịch là chuỗi 15-20 chữ số, không lẫn với ô nào khác trong bảng.
export function docBangKetQuaEtax(html, { tuNgay, denNgay } = {}) {
  const ds = []
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => bocChu(c[1]))
    const i = cells.findIndex(c => /^\d{15,20}$/.test(c || ''))
    if (i < 0) continue
    ds.push({
      maHoSo: cells[i],                       // cổng gọi là 'Mã giao dịch'
      // Bảng này KHÔNG có mã tờ khai dạng số như tab 1, và tên cũng không kèm mã
      // ('Tờ khai khấu trừ thuế thu nhập cá nhân (TT80)'). Mã thật nằm ở TRANG CHI TIẾT
      // ('05/KK-TNCN - Tờ khai khấu trừ…'), nên để trống ở đây và lấy sau.
      maToKhaiCong: null,
      tenToKhai: cells[i + 1] || null,
      kyTinhThue: cells[i + 2] || null,       // 'Q1/2025'
      loaiToKhai: cells[i + 3] || null,       // 'Chính thức' | 'Bổ sung'
      lanNop: Number(cells[i + 4] || 1) || 1,
      lanBoSung: Number(cells[i + 5] || 0) || 0,
      ngayNop: ngayVNsangISO(cells[i + 6]),
      coQuanThue: cells[i + 7] || null,
      trangThaiCong: cells[i + 8] || null,
      nguon: 'etax',
    })
  }
  const tong = html.match(/T[ổo]ng s[ốo] b[ảa]n ghi:\s*(?:<[^>]*>\s*)*(\d+)/)?.[1]
  // In kèm đoạn đầu HTML khi KHÔNG đọc được dòng nào: lần chạy thật đầu tiên sẽ nói ngay cổng trả
  // về cái gì, khỏi phải nhờ người dùng đi bắt gói lại.
  console.log(`[ETAX] tra cứu ${tuNgay || '?'}-${denNgay || '?'}: cổng báo ${tong ?? '?'} bản ghi, `
    + `đọc được ${ds.length} dòng, HTML ${html.length} ký tự`
    + (ds.length ? '' : ` | đầu HTML: ${html.slice(0, 300).replace(/\s+/g, ' ')}`))
  return { ds, tongCongBao: tong ? +tong : null, conTrangSau: ds.length >= CO_TRANG }
}
