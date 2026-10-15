// Đọc tiêu đề mail "bộ báo cáo thuế" nhân viên gửi khách, để app tự tick việc "Gửi mail bộ báo
// cáo thuế ..." trong Checklist công việc.
//
// Anh chốt 14/10/2026: "check tự động từ mail của nhân viên gửi qua cho KH để xác nhận đúng là đã
// gửi mail hay chưa, app sẽ tick tự động nếu đúng cú pháp."
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// BA LUẬT BẤT BIẾN — hỏng một cái là hỏng cả tính năng
//
// 1. CHỈ TICK, KHÔNG BAO GIỜ BỎ TICK. Mail không về KHÔNG có nghĩa là chưa gửi (nhân viên quên
//    CC, đổi tiêu đề, gửi từ hộp khác). Bỏ tick theo tín hiệu thiếu là xoá mất dấu "hoàn thành
//    đúng hạn" gốc mà KPI chấm theo đó.
// 2. MƠ HỒ THÌ KHÔNG TICK. Khớp tên công ty không chắc chắn, hoặc không tìm ra đúng một việc
//    tương ứng, thì trả về lý do để đẩy vào danh sách "mail chưa khớp" cho người xem — thà bỏ
//    sót còn hơn tick nhầm công ty, vì tick nhầm là báo xong cho việc chưa làm mà không ai thấy.
// 3. KHÔNG ĐOÁN NĂM BỪA. Thiếu năm trong tiêu đề thì suy từ NGÀY GỬI mail, và chỉ chấp nhận kỳ
//    nằm trong quá khứ gần — "Quý 3" gửi tháng 10/2026 là Q3/2026, không phải Q3/2027.
// ────────────────────────────────────────────────────────────────────────────────────────────
//
// TIÊU ĐỀ THẬT (ảnh anh gửi 14/10/2026) — ba kiểu phân cách khác nhau, nên bộ đọc phải LỎNG:
//   CÔNG TY TNHH ĐẦU TƯ QQ PROPERTY - BÁO CÁO THUẾ Q3.2026
//   STUDIO BY DREW_BÁO CÁO THUẾ QUÝ 3/2026
//   CÔNG TY TNHH NHÔM KÍNH ĐỨC THƯỜNG_BÁO CÁO THUẾ ...
//
// Neo vào cụm "BÁO CÁO": trái là tên công ty, phải là kỳ. Không đếm ký tự, không bắt một khuôn
// cứng — y như cách lib/bankMatch.js đọc nội dung chuyển khoản, vốn còn lộn xộn hơn tiêu đề.

import { coreName, norm } from './bankMatch.js'

// Bỏ dấu nhưng GIỮ khoảng trắng và dấu câu — khác norm() của bankMatch (xoá sạch mọi thứ không
// phải chữ/số), vì đọc kỳ cần đến dấu chấm và gạch chéo: "Q3.2026", "QUÝ 3/2026".
export function boDau(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase()
}

const THANG_TOI_DA = 24   // kỳ cũ hơn 24 tháng so với ngày gửi thì coi là đọc sai, không nhận

// Tiêu đề có phải thư trả lời / chuyển tiếp không — không tính là lượt gửi bộ hồ sơ.
export function laTraLoi(tieuDe) {
  return /^\s*(RE|FW|FWD|TRA LOI|CHUYEN TIEP)\s*:/i.test(boDau(tieuDe))
}

// Tách kỳ từ phần ĐỨNG SAU cụm "BÁO CÁO".
// Trả { loai: 'thang'|'quy'|'nam', so, nam } — `nam` có thể null khi tiêu đề không ghi năm.
export function docKy(phanSau) {
  // ĐỔI "_" THÀNH KHOẢNG TRẮNG TRƯỚC. Trong biểu thức chính quy, "_" được coi là ký tự CHỮ, nên
  // `\b` giữa "_" và "Q" không khớp — tiêu đề thật "BÁO CÁO THUẾ _QUÝ 3.2026_KIMOANH" bị đọc
  // thành "không có kỳ" và mất trắng. Dùng dấu gạch dưới làm phân cách là chuyện rất thường.
  const t = boDau(phanSau).replace(/_/g, ' ')

  // Quý: "Q3.2026" | "QUY 3/2026" | "QUY 3" | "QUY III" không hỗ trợ (chưa gặp thật)
  let m = t.match(/\bQ(?:UY)?\s*([1-4])\s*[./\-\s]?\s*(20\d{2})?/)
  if (m) return { loai: 'quy', so: Number(m[1]), nam: m[2] ? Number(m[2]) : null }

  // Tháng: "THANG 9/2026" | "T9.2026" | "THANG 9"
  // THỨ TỰ NHÁNH QUAN TRỌNG: 1[0-2] phải đứng TRƯỚC 0?[1-9]. Để ngược lại thì "THÁNG 12" khớp
  // đúng chữ số "1" rồi dừng — tháng 12 bị đọc thành tháng 1, lệch nguyên một năm khi tick
  // (tháng 12 tick vào T1 năm sau, tháng 1 tick vào T2 cùng năm).
  m = t.match(/\bTH?(?:ANG)?\s*(1[0-2]|0?[1-9])\s*[./\-\s]?\s*(20\d{2})?/)
  if (m) return { loai: 'thang', so: Number(m[1]), nam: m[2] ? Number(m[2]) : null }

  // Dạng trần "09/2026" — phải có năm, nếu không thì "3/2026" với "3" là gì cũng không rõ.
  m = t.match(/\b(1[0-2]|0?[1-9])\s*[./\-]\s*(20\d{2})\b/)
  if (m) return { loai: 'thang', so: Number(m[1]), nam: Number(m[2]) }

  // Báo cáo tài chính năm: "NAM 2025" | "BCTC 2025"
  m = t.match(/\b(?:NAM|BCTC)\s*(20\d{2})\b/)
  if (m) return { loai: 'nam', so: null, nam: Number(m[1]) }

  return null
}

// Dọn phần ĐỨNG SAU cụm "BÁO CÁO" để lấy ra tên/mã công ty: bỏ kỳ, bỏ mấy chữ cố định, bỏ dấu
// phân cách thừa. "BÁO CÁO THUẾ _QUÝ 3.2026_KIMOANH" -> "KIMOANH".
function donPhanSau(phanSau) {
  // KHÔNG dùng `\b` quanh chữ có dấu: "Ế" không phải ký tự chữ trong biểu thức chính quy, nên
  // `\bTHUẾ\b` KHÔNG BAO GIỜ khớp. Lỗi này im lặng — chuỗi trả về vẫn trông hợp lý, chỉ là còn
  // nguyên chữ "THUẾ QUÝ 3.2026" nên khớp tên công ty trượt.
  return String(phanSau || '').replace(/_/g, ' ')
    .replace(/\bQ(?:U[YÝ])?\s*[1-4]\s*[./\-\s]?\s*(?:20\d{2})?/i, ' ')
    .replace(/\bTH?(?:[ÁA]NG)?\s*(?:1[0-2]|0?[1-9])\s*[./\-\s]?\s*(?:20\d{2})?/i, ' ')
    .replace(/(?:N[ĂA]M|BCTC)\s*20\d{2}/i, ' ')
    .replace(/THU[ẾE]/i, ' ')
    .replace(/T[ÀA]I\s*CH[ÍI]NH/i, ' ')
    .replace(/[\s\-_:|–—]+/g, ' ')
    .trim()
}

// Tách tiêu đề thành { tenTruoc, tenSau, ky }. Trả null ở trường nào không đọc được.
//
// PHẢI LẤY CẢ HAI PHÍA, vì nhân viên dùng hai quy ước ngược nhau — đo thật trên hộp thư ngày
// 15/10/2026, 6 lá mail của 2 người:
//   HKD NGÔ THỊ THANH THẢO_BÁO CÁO THUẾ QUÝ 3/2026    <- tên đứng TRƯỚC
//   BÁO CÁO THUẾ QUÝ 3.2026_HKD TRANTHIHOAKY          <- tên đứng SAU
// Chỉ đọc một phía là mất trắng một nửa số mail, mà lỗi đó im lặng: người gửi rồi vẫn bị báo chưa.
export function docTieuDe(tieuDe, ngayGui = new Date()) {
  const goc = String(tieuDe || '')
  if (!goc.trim()) return { tenTruoc: null, tenSau: null, ky: null, lyDo: 'tiêu đề rỗng' }
  if (laTraLoi(goc)) return { tenTruoc: null, tenSau: null, ky: null, lyDo: 'thư trả lời/chuyển tiếp, không tính' }

  const t = boDau(goc)
  const i = t.indexOf('BAO CAO')
  if (i < 0) return { tenTruoc: null, tenSau: null, ky: null, lyDo: 'tiêu đề không có cụm "BÁO CÁO"' }

  // Giữ CHUỖI GỐC (còn dấu) để hiện lại cho người đọc khi không khớp được.
  const tenTruoc = goc.slice(0, i).replace(/[\s\-_:|–—]+$/, '').trim()
  const tenSau = donPhanSau(goc.slice(i + 'BAO CAO'.length))
  const ky = chuanHoaNam(docKy(goc.slice(i)), ngayGui)

  if (!tenTruoc && !tenSau) return { tenTruoc: null, tenSau: null, ky, lyDo: 'không có tên công ty quanh cụm "BÁO CÁO"' }
  if (!ky) return { tenTruoc, tenSau, ky: null, lyDo: 'không đọc được kỳ trong tiêu đề' }
  return { tenTruoc, tenSau, ky, lyDo: null }
}

// Thiếu năm thì suy từ ngày gửi, và chỉ nhận kỳ Ở QUÁ KHỨ. "Quý 3" gửi tháng 10/2026 là Q3/2026;
// nếu suy ra tương lai thì lùi một năm. Không có bước này thì mail tháng 12 gửi đầu tháng 1 sẽ bị
// gán nhầm sang năm mới.
export function chuanHoaNam(ky, ngayGui = new Date()) {
  if (!ky) return null
  if (ky.nam) return ky
  const namGui = ngayGui.getFullYear()
  const thangGui = ngayGui.getMonth() + 1
  const thangCuaKy = ky.loai === 'quy' ? ky.so * 3 : ky.loai === 'thang' ? ky.so : 12
  // Kỳ phải kết thúc TRƯỚC hoặc TRONG tháng gửi; nếu không thì nó thuộc năm trước.
  const nam = thangCuaKy <= thangGui ? namGui : namGui - 1
  return { ...ky, nam }
}

// Kỳ báo cáo → (năm, tháng) mà việc "Gửi mail" nằm trong checklist.
// Tháng 9 gửi trong tháng 10; tháng 12 gửi tháng 1 NĂM SAU; Quý 4 gửi tháng 1 năm sau.
// Sai chỗ này thì tick vào ô trống của năm cũ, không ai nhìn thấy.
export function kyGuiMail(ky) {
  if (!ky || !ky.nam) return null
  if (ky.loai === 'thang') {
    return ky.so === 12 ? { year: ky.nam + 1, month: 1 } : { year: ky.nam, month: ky.so + 1 }
  }
  if (ky.loai === 'quy') {
    return ky.so === 4 ? { year: ky.nam + 1, month: 1 } : { year: ky.nam, month: ky.so * 3 + 1 }
  }
  // Báo cáo tài chính năm: gửi trong tháng 3 năm sau (danh mục có việc ở cả M3 và M4).
  if (ky.loai === 'nam') return { year: ky.nam + 1, month: 3 }
  return null
}

// Nhãn kỳ như cách danh mục công việc đặt tên, để dò trong task_definitions.name.
function nhanKy(ky) {
  if (ky.loai === 'thang') return new RegExp('TH[AÁ]NG\\s*' + ky.so + '(?!\\d)', 'i')
  if (ky.loai === 'quy') return new RegExp('QU[YÝ]\\s*' + ky.so + '(?!\\d)', 'i')
  return /T[AÀ]I\s*CH[IÍ]NH\s*N[AĂ]M/i
}

// Tìm ĐÚNG MỘT việc "Gửi mail" tương ứng với kỳ này, trong danh mục của công ty.
//
// Dò theo DANH MỤC THẬT chứ không ánh xạ cứng trong mã: tên việc do anh đặt và có thể đổi, ánh xạ
// cứng sẽ lặng lẽ trật khi ai đó sửa một chữ. Không tìm thấy, hoặc tìm thấy nhiều hơn một, thì
// TRẢ NULL kèm lý do — tuyệt đối không chọn bừa cái đầu tiên.
export function timViecGuiMail(taskDefs, ky, reportType = 'monthly') {
  const dich = kyGuiMail(ky)
  if (!dich) return { task: null, lyDo: 'không suy được tháng phải tick' }

  const ungVien = (taskDefs || []).filter(t =>
    t.is_active !== false &&
    Number(t.month) === dich.month &&
    (t.report_type || 'monthly') === reportType &&
    /mail/i.test(t.name || ''))

  if (ungVien.length === 0) return { task: null, dich, lyDo: 'danh mục chưa có việc gửi mail cho kỳ này' }

  const re = nhanKy(ky)
  let khop = ungVien.filter(t => re.test(boDau(t.name)) || re.test(t.name || ''))

  // Ca riêng của danh mục thật: việc tháng 7 tên là "Gửi mail bộ báo cáo thuế Quý" KHÔNG CÓ SỐ.
  // Chỉ chấp nhận nó khi tháng đích đúng là tháng 7 (tức Quý 2) — không thì một việc không số sẽ
  // nhận bừa mọi quý.
  if (khop.length === 0 && ky.loai === 'quy' && dich.month === 7) {
    khop = ungVien.filter(t => /QU[YÝ]\s*(\(|$|[^0-9])/i.test(boDau(t.name)))
  }

  if (khop.length === 1) return { task: khop[0], dich, lyDo: null }
  if (khop.length === 0) return { task: null, dich, lyDo: 'không có việc nào khớp nhãn kỳ' }
  return { task: null, dich, lyDo: 'có ' + khop.length + ' việc cùng khớp, không dám chọn' }
}

// Khớp tên công ty lấy từ tiêu đề với danh sách công ty.
// `dsCty` = mảng công ty thô [{ id, name, report_type, ... }].
//
// CỐ Ý KHÔNG dùng `cores` của buildIndex (lib/bankMatch.js): hàm đó LOẠI BỎ công ty có tên rút gọn
// dưới 5 ký tự, mà đó đúng là nhóm cần đường dự phòng bên dưới — "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ
// TAM" rút gọn còn "TAM" nên biến mất khỏi cores, tra kiểu gì cũng không thấy.
//
// Chỉ nhận khi ra ĐÚNG MỘT công ty. Hai công ty cùng tên rút gọn (hay gặp: cùng tên khác chi
// nhánh) thì trả null — tick nhầm công ty là lỗi nặng nhất của tính năng này.
// NGƯỜI GỌI TRUYỀN VÀO DANH SÁCH CÔNG TY ĐANG HOẠT ĐỘNG. Công ty đã ngưng thì không còn
// checklist để tick, mà để lẫn vào đây lại gây mơ hồ với công ty cùng tên — đo trên dữ liệu thật
// 15/10/2026: lọc theo trạng thái nâng tỉ lệ khớp từ 323/329 lên 298/300 (99%), 0 khớp nhầm.
export function khopCongTy(tenTuTieuDe, dsCty) {
  const cores = (dsCty || []).map(c => ({ c, k: coreName(c.name) }))
  const k = coreName(tenTuTieuDe || '')

  // Tên riêng quá ngắn sau khi bỏ từ pháp lý — ca thật: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TAM" rút
  // gọn còn đúng "TAM". Không nới lỏng, mà ĐỔI SANG đòi trùng khít TOÀN BỘ tên: chặt hơn hẳn, nên
  // vẫn an toàn, mà công ty tên ngắn không bị loại vĩnh viễn khỏi tính năng này.
  if (k.length < 5) {
    const n = norm(tenTuTieuDe || '')
    if (n.length < 8) return { client: null, lyDo: 'tên công ty quá ngắn để khớp chắc chắn' }
    const khit = cores.filter(x => norm(x.c.name) === n)
    if (khit.length === 1) return { client: khit[0].c, lyDo: null }
    return { client: null, lyDo: khit.length > 1
      ? 'tên riêng quá ngắn và có ' + khit.length + ' công ty trùng khít'
      : 'tên riêng quá ngắn, không có công ty nào trùng khít toàn bộ tên' }
  }

  const trung = cores.filter(x => x.k === k)
  if (trung.length === 1) return { client: trung[0].c, lyDo: null }
  if (trung.length > 1) {
    // Nhiều công ty cùng tên rút gọn — hầu hết là CHI NHÁNH trùng tên công ty mẹ, vì bộ rút gọn
    // xoá luôn chữ "CHI NHÁNH". Phân biệt bằng tên ĐẦY ĐỦ: trùng khít thì nhận, vẫn mơ hồ thì
    // thôi. 6/329 công ty rơi vào đây, không xử thì nhóm chi nhánh mất hẳn tính năng này.
    const n = norm(tenTuTieuDe || '')
    const khit = trung.filter(x => norm(x.c.name) === n)
    if (khit.length === 1) return { client: khit[0].c, lyDo: null }
    return { client: null, lyDo: 'có ' + trung.length + ' công ty cùng tên rút gọn' }
  }

  // Không trùng khít: cho phép tên trong tiêu đề CHỨA tên công ty hoặc ngược lại, nhưng vẫn phải
  // ra duy nhất. Dài hơn 8 ký tự mới xét, tránh mấy mẩu chung chung khớp lung tung.
  const chua = cores.filter(x => x.k.length >= 8 && (k.includes(x.k) || x.k.includes(k)))
  if (chua.length === 1) return { client: chua[0].c, lyDo: null }
  if (chua.length > 1) return { client: null, lyDo: 'khớp mơ hồ với ' + chua.length + ' công ty' }
  return { client: null, lyDo: 'không tìm thấy công ty khớp tên' }
}

// Khớp theo MÃ KHÁCH HÀNG xuất hiện trong tiêu đề.
//
// Có thật trên hộp thư 15/10/2026: "BÁO CÁO THUẾ QUÝ 3.2026_HKD TRANTHIHOAKY" — TRANTHIHOAKY là
// client_code. Và đây là đường DUY NHẤT phân biệt được hai HỘ KINH DOANH ĐỨC DESIGN: hai hộ khác
// MST nhưng TRÙNG KHÍT tên thương mại, khớp theo tên thì vĩnh viễn mơ hồ, khớp theo mã thì sạch sẽ.
//
// Chỉ nhận mã từ 4 ký tự trở lên: 36/284 mã đang dùng ngắn hơn thế (GBU, TAM, TKH...) và những
// mẩu 2-3 ký tự rất dễ trùng với chữ thường trong tiêu đề. Bỏ sót còn hơn tick nhầm.
export function khopMaKH(chuoi, dsCty) {
  const tokens = boDau(chuoi || '').split(/[^A-Z0-9]+/).filter(x => x.length >= 4)
  if (!tokens.length) return { client: null, lyDo: null }

  const theoMa = new Map()
  for (const c of dsCty || []) {
    const ma = norm(c.client_code)
    if (ma.length >= 4) theoMa.set(ma, c)
  }
  const trung = [...new Set(tokens.map(t => theoMa.get(t)).filter(Boolean))]
  if (trung.length === 1) return { client: trung[0], lyDo: null }
  if (trung.length > 1) return { client: null, lyDo: 'tiêu đề chứa ' + trung.length + ' mã khách hàng khác nhau' }
  return { client: null, lyDo: null }
}

// Thử lần lượt: tên đứng TRƯỚC, tên đứng SAU, rồi mã khách hàng ở cả hai phía.
// Tên trước tiên vì đó là dạng rõ nghĩa nhất; mã để sau cùng vì nó cứu được đúng những ca mà tên
// không phân biệt nổi.
export function khopCty(d, dsCty) {
  for (const ten of [d.tenTruoc, d.tenSau]) {
    if (!ten) continue
    const r = khopCongTy(ten, dsCty)
    if (r.client) return r
  }
  const m = khopMaKH([d.tenTruoc, d.tenSau].filter(Boolean).join(' '), dsCty)
  if (m.client) return m
  if (m.lyDo) return m
  // Trả lý do của phía có nội dung, để người đọc biết app đã nhìn vào đâu.
  return khopCongTy(d.tenTruoc || d.tenSau || '', dsCty)
}

// Gộp cả ba bước cho một lá mail. Trả về đủ lý do để dựng danh sách "mail chưa khớp".
export function docMail({ tieuDe, ngayGui, dsCty, taskDefs }) {
  const d = docTieuDe(tieuDe, ngayGui ? new Date(ngayGui) : new Date())
  if (!d.ky || (!d.tenTruoc && !d.tenSau)) return { ok: false, ...d, client: null, task: null }

  const { client, lyDo: lyDoCty } = khopCty(d, dsCty)
  if (!client) return { ok: false, ...d, client: null, task: null, lyDo: lyDoCty }

  // Kỳ quá cũ so với ngày gửi -> gần như chắc chắn đọc sai, đừng ghi vào checklist năm ngoái.
  const dich = kyGuiMail(d.ky)
  const ng = ngayGui ? new Date(ngayGui) : new Date()
  const cach = (ng.getFullYear() * 12 + ng.getMonth() + 1) - (dich.year * 12 + dich.month)
  if (cach > THANG_TOI_DA || cach < -1) {
    return { ok: false, ...d, client, task: null, lyDo: 'kỳ lệch quá xa ngày gửi (' + cach + ' tháng)' }
  }

  const { task, lyDo: lyDoViec } = timViecGuiMail(taskDefs, d.ky, client.report_type || 'monthly')
  if (!task) return { ok: false, ...d, client, task: null, lyDo: lyDoViec }

  return { ok: true, ...d, client, task, dich, lyDo: null }
}
