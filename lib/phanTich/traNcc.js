// Tra cứu tình trạng người bán (NCC) từ danh sách hóa đơn mua vào — Rủi ro thuế, tab "🔎 Tra cứu NCC" (anh duyệt 19/11/2026).
//
// HAI NGUỒN (anh chốt 19/11/2026):
//   1. Tra HÀNG LOẠT: VietQR (api.vietqr.io/v2/business/<MST>) — dữ liệu tổng hợp từ trang Cục Thuế, trễ ~1–2 tuần, KHÔNG có
//      CQT quản lý. Không mã xác nhận, cho trình duyệt gọi thẳng (CORS *) nên chạy cả app lẫn bản rời. Giới hạn 2 lượt / khoảng
//      → tra lần lượt, gặp 429 thì chờ rồi thử lại.
//   2. Tra CHÍNH XÁC từng MST: tracuunnt.gdt.gov.vn (trang gốc Cục Thuế) — có CQT quản lý + trạng thái ngay lúc tra. MỖI lượt
//      phải gõ mã xác nhận: nhân viên tự gõ, app KHÔNG tự đọc mã. Gọi qua tiện ích Chrome (từ bản 1.3) vì máy chủ không gọi
//      cổng thuế và trình duyệt không gọi thẳng được (khác tên miền) → chỉ chạy trong app, bản rời không có.
// Đã loại: masothue.com (Cloudflare chặn mọi lượt gọi không qua trình duyệt — tra tự động là vượt lớp chặn, không làm), địa chỉ
// hoadondientu…:30000/category/public/dsdkts (file Excel cũ của anh dùng) — cổng 30000 đã đóng, VPS cũng bị từ chối 19/11/2026.
//
// Kết quả tra NHỚ TRÊN MÁY (IndexedDB qua khoMay.layDem/ghiDem), KHÔNG lưu lên Supabase — giữ luật "Soát xét / Rủi ro thuế không
// lưu gì lên máy chủ" (anh chốt 25/10/2026). VietQR còn hạn 30 ngày, tra chính xác 60 ngày.

import { mstO } from './doc/bangKe.js'
import { giaiMaThucThe } from '../tokhaiXml.js'

// ── MST ──────────────────────────────────────────────────────────────────────

// '313906307' (Excel mất số 0) → '0313906307'; '0313906307001' → '0313906307-001'; giữ '-001'. Không phải MST → ''.
export function chuanMstNcc(v) {
  let s = mstO(v).replace(/[^\d-]/g, '')
  if (/^\d{13}$/.test(s)) s = s.slice(0, 10) + '-' + s.slice(10)
  if (/^\d{9}$/.test(s)) s = '0' + s
  if (/^\d{9}-\d{3}$/.test(s)) s = '0' + s
  if (/^\d{12}$/.test(s)) s = '0' + s.slice(0, 9) + '-' + s.slice(9)   // 13 số mất số 0 đầu
  return /^\d{10}(-\d{3})?$/.test(s) ? s : ''
}

// ── Hóa đơn mua vào từ bảng kê (lib/phanTich/doc/bangKe.js docBangKe) ─────────

// sheets: kết quả docBangKe của MỘT file. Lấy sheet mua vào; người bán = cột "MST người bán" (bảng kê cổng) hoặc cột MST đối
// tác (bảng kê phần mềm, sheet mua vào). Sheet không rõ chiều thì bỏ — không đoán.
export function hoaDonMuaVaoTuSheet(sheets, { tenFile = '' } = {}) {
  const ra = []
  for (const sh of sheets || []) {
    if (sh.chieu !== 'mua_vao' || sh.mau === 'tk_pm') continue
    for (const h of sh.hoaDon || []) {
      const mstGoc = h.mstBan || h.mst || ''
      ra.push({
        kyHieu: h.kyHieu || '', so: h.so || '', ngay: h.ngay || '', mstGoc, mst: chuanMstNcc(mstGoc), ten: h.tenBan || h.ten || '',
        tienChuaThue: h.tienChuaThue, thue: h.thue, tongTt: h.tongTt, trangThaiHd: h.trangThai || '',
        nguon: tenFile ? `${tenFile} · ${sh.sheet}` : sh.sheet,
      })
    }
  }
  return ra
}

const khoaHd = h => [h.mst || h.mstGoc, h.kyHieu, h.so, h.ngay].join('|')

// Cùng một hóa đơn có thể nằm ở nhiều file (bảng kê tháng + bảng kê quý) → hóa đơn đã gặp ở nguồn (file · sheet) khác thì bỏ.
// TRONG cùng một nguồn thì giữ hết: bảng kê HTKK / phần mềm ghi MỖI MẶT HÀNG một dòng (HĐ 272 ba dòng phí), bỏ là hụt tiền.
export function boTrungHoaDon(ds) {
  const nguonCua = new Map(), ra = []
  for (const h of ds) {
    const k = khoaHd(h)
    const da = nguonCua.get(k)
    if (h.so && da !== undefined && da !== h.nguon) continue
    if (da === undefined) nguonCua.set(k, h.nguon)
    ra.push(h)
  }
  return ra
}

// → [{ mst, ten, soHd, tien, thue, tuNgay, denNgay }] sắp theo tiền giảm dần; hóa đơn thiếu MST gom vào `thieuMst`.
export function gomNcc(hoaDon) {
  const m = new Map(), thieuMst = []
  for (const h of hoaDon) {
    if (!h.mst) { thieuMst.push(h); continue }
    let n = m.get(h.mst)
    if (!n) m.set(h.mst, n = { mst: h.mst, ten: h.ten, soHd: 0, tien: 0, thue: 0, tuNgay: '', denNgay: '', _hd: new Set() })
    if (!n.ten && h.ten) n.ten = h.ten
    const k = khoaHd(h)
    if (!n._hd.has(k)) { n._hd.add(k); n.soHd++ }          // đếm HÓA ĐƠN, không đếm dòng mặt hàng
    n.tien += h.tienChuaThue || 0
    n.thue += h.thue || 0
    if (h.ngay && (!n.tuNgay || h.ngay < n.tuNgay)) n.tuNgay = h.ngay
    if (h.ngay && h.ngay > n.denNgay) n.denNgay = h.ngay
  }
  const ncc = [...m.values()].map(({ _hd, ...n }) => n)
  return { ncc: ncc.sort((a, b) => b.tien - a.tien || a.mst.localeCompare(b.mst)), thieuMst }
}

// ── Trạng thái MST → mức ─────────────────────────────────────────────────────

// Chữ trạng thái (VietQR / tracuunnt dùng đúng chữ Phụ lục I TT 95/2016) → 'tot' | 'canh_bao' | 'xau' | 'khong_ro'.
//   xấu: 01 chấm dứt hiệu lực, 03 ngừng hoạt động chưa chấm dứt, 06 không hoạt động tại địa chỉ, 00-01/04-01 chuyển công an
//   cảnh báo: 05 tạm ngừng kinh doanh, 02 đã chuyển cơ quan thuế quản lý
export function mucTrangThai(chu) {
  const s = String(chu || '').normalize('NFC').toLowerCase()
  if (!s.trim()) return 'khong_ro'
  if (/công an|không hoạt động tại địa chỉ|chấm dứt|bỏ trốn/.test(s)) return 'xau'
  if (/tạm ngừng|tạm dừng|chuyển cơ quan thuế|chuyển cqt/.test(s)) return 'canh_bao'     // trước "ngừng hoạt động": "tạm ngừng hoạt động"
  if (/ngừng hoạt động|giải thể|phá sản|thu hồi|đóng mã/.test(s)) return 'xau'
  if (/đang hoạt động/.test(s)) return 'tot'
  return 'khong_ro'
}
export const NHAN_MUC = { tot: 'Đang hoạt động', canh_bao: 'Cần xem', xau: 'Rủi ro', khong_ro: 'Chưa rõ' }

// ── Nguồn 1: VietQR ──────────────────────────────────────────────────────────

export const HAN_VIETQR_NGAY = 30
export const HAN_CQT_NGAY = 60
const ngu = ms => new Promise(r => setTimeout(r, ms))

// GIỚI HẠN (đo thật 19/11/2026, VietQR không công bố): tra liền ~20 MST thì địa chỉ mạng bị khoá ~10 phút — 429 kèm
// Retry-After ~540 giây. Phản hồi 429 KHÔNG có header CORS → trình duyệt không đọc được, fetch NÉM LỖI như mất mạng. Nên lỗi
// mạng giữa chừng coi là "bị chặn" ('bi_chan'): trang tự tạm dừng rồi tra tiếp, không ghi lỗi vào từng dòng.
export const NHIP_VIETQR_MS = 3500
export const CHO_KHI_CHAN_MS = 10 * 60 * 1000

// → { loai: 'ok'|'khong_co'|'bi_chan'|'loi', ten, dc, trangThai, capNhat (ISO ngày dữ liệu nguồn), luc (ISO lúc tra), choGiay?, chu? }
// fetchFn để bộ kiểm truyền bản giả.
export async function traVietQR(mst, { fetchFn = globalThis.fetch, cho = ngu, huy } = {}) {
  for (let lan = 0; lan < 2; lan++) {
    if (huy?.()) return { loai: 'loi', chu: 'Đã dừng' }
    let r
    try {
      const hen = new AbortController()
      const t = setTimeout(() => hen.abort(), 12000)
      try { r = await fetchFn('https://api.vietqr.io/v2/business/' + encodeURIComponent(mst), { signal: hen.signal }) } finally { clearTimeout(t) }
    } catch (e) {
      if (lan === 0) { await cho(3000); continue }
      return { loai: 'bi_chan', chu: 'VietQR tạm khoá lượt tra (hoặc máy mất mạng)' }
    }
    if (r.status === 429) {
      const giay = Number(r.headers?.get?.('retry-after')) || 0
      return { loai: 'bi_chan', choGiay: giay, chu: 'VietQR tạm khoá lượt tra' }
    }
    let j
    try { j = await r.json() } catch { return { loai: 'loi', chu: 'VietQR trả về dữ liệu lạ (HTTP ' + r.status + ')' } }
    const luc = new Date().toISOString()
    if (j.code === '00' && j.data) {
      return { loai: 'ok', ten: String(j.data.name || ''), dc: j.data.address || '', trangThai: j.data.status || '', capNhat: j.metadata?.updatedAt || '', luc }
    }
    if (j.code === '51') return { loai: 'khong_co', trangThai: 'Không tìm thấy MST trên dữ liệu Cục Thuế', luc }
    return { loai: 'loi', chu: 'VietQR: ' + (j.desc || 'lỗi không rõ') }
  }
  return { loai: 'bi_chan', chu: 'VietQR tạm khoá lượt tra' }
}

// ── Nguồn 2: tracuunnt.gdt.gov.vn (qua tiện ích, nhân viên gõ mã) ───────────

export const TCNNT = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'
export const TCNNT_CAPTCHA = 'https://tracuunnt.gdt.gov.vn/tcnnt/captcha.png'

// Yêu cầu gửi tiện ích (lib/portalBridge.js goiCong). Form của trang: cm=cm, mst, fullname, address, cmt, captcha — POST lại
// chính trang; mã xác nhận gắn với cookie phiên (JSESSIONID) do trình duyệt giữ.
export const yeuCauMoTrang = () => ({ url: TCNNT, method: 'GET' })
export const yeuCauCaptcha = () => ({ url: TCNNT_CAPTCHA + '?uid=' + Date.now(), method: 'GET' })
export function yeuCauTra(mst, maXacNhan) {
  const p = new URLSearchParams({ cm: 'cm', mst: String(mst).slice(0, 14), fullname: '', address: '', cmt: '', captcha: String(maXacNhan || '').trim() })
  return { url: TCNNT, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() }
}

const boThe = s => giaiMaThucThe(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const khongDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

// Trang kết quả → { loai: 'ok', dong: [{ mst, ten, dc, cqt, trangThai }] } | { loai: 'sai_ma' } | { loai: 'khong_thay' } |
// { loai: 'khong_doc_duoc' }. Bảng nhận theo hàng TIÊU ĐỀ (MST, Tên…, Cơ quan thuế…, Trạng thái…), không theo vị trí cố định.
export function docKetQuaTcnnt(html) {
  const s = String(html || '')
  // Trang cổng dàn bố cục bằng bảng lồng bảng → không cắt theo <table>…</table> (regex không đếm được lồng nhau). Tách theo
  // từng thẻ <tr>: hàng của bảng kết quả là hàng TRONG CÙNG nên mảnh cắt tới </tr> đầu tiên luôn sạch.
  const hang = s.split(/<tr\b/i).slice(1).map(p => [...p.split(/<\/tr>/i)[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(o => boThe(o[1])))
  const iDau = hang.findIndex(h => h.some(o => /trang thai/.test(khongDau(o))) && h.some(o => /^mst$|ma so thue/.test(khongDau(o))))
  if (iDau >= 0) {
    const dau = hang[iDau].map(khongDau)
    const cot = k => dau.findIndex(o => k.test(o))
    const c = { mst: cot(/^mst$|ma so thue/), ten: cot(/ten/), dc: cot(/dia chi/), cqt: cot(/co quan thue/), tt: cot(/trang thai/) }
    const dong = []
    for (const h of hang.slice(iDau + 1)) {
      if (h.length < dau.length - 1 || !h[c.mst]) { if (dong.length) break; continue }   // hết bảng
      dong.push({ mst: chuanMstNcc(h[c.mst]) || h[c.mst], ten: h[c.ten] || '', dc: c.dc >= 0 ? h[c.dc] || '' : '', cqt: c.cqt >= 0 ? h[c.cqt] || '' : '', trangThai: h[c.tt] || '' })
    }
    return dong.length ? { loai: 'ok', dong } : { loai: 'khong_thay' }
  }
  const t = khongDau(boThe(s))
  // Chưa có trang báo lỗi thật để đo (19/11/2026) → nhận rộng. Báo "không thấy" xét TRƯỚC vì trang đó vẫn kèm ô mã + nút
  // "Nhập lại"; trang trả lại form không có bảng kết quả coi như sai mã (màn hình nói rõ "sai mã hoặc cổng không trả kết quả").
  if (/khong tim thay|khong co du lieu|khong ton tai/.test(t)) return { loai: 'khong_thay' }
  if (/ma xac nhan|captcha/.test(t) && /(khong dung|sai|nhap lai|nhap dung|khong hop le|chua nhap|khong chinh xac)/.test(t)) return { loai: 'sai_ma' }
  return { loai: 'khong_doc_duoc' }
}

// Bảng tra theo MST 10 số ra cả chi nhánh → lấy đúng dòng của MST đang tra (không có thì dòng đầu).
export function chonDongTcnnt(dong, mst) {
  return dong.find(d => d.mst === mst) || dong.find(d => d.mst?.slice(0, 10) === mst.slice(0, 10) && !d.mst.includes('-')) || dong[0] || null
}

// ── Bộ nhớ trên máy ──────────────────────────────────────────────────────────

export const khoaVietQR = mst => 'ncc1|vietqr|' + mst
export const khoaCqt = mst => 'ncc1|gdt|' + mst
export function conHan(kq, ngay, homNay = Date.now()) {
  return !!kq?.luc && (homNay - Date.parse(kq.luc)) < ngay * 86400000
}

// ── Excel ────────────────────────────────────────────────────────────────────

const ngayVn = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
// Một dòng kết quả gộp hai nguồn: tra chính xác (Cục Thuế) thắng VietQR khi còn hạn.
export function ketQuaNcc(vietqr, gdt) {
  if (gdt?.loai === 'ok') return { trangThai: gdt.trangThai, cqt: gdt.cqt || '', nguon: `Cục Thuế (tracuunnt) ${ngayVn(gdt.luc)}`, muc: mucTrangThai(gdt.trangThai) }
  if (vietqr?.loai === 'ok' || vietqr?.loai === 'khong_co') {
    return { trangThai: vietqr.trangThai, cqt: '', nguon: `VietQR ${ngayVn(vietqr.luc)}${vietqr.capNhat ? ` (dữ liệu ${ngayVn(vietqr.capNhat)})` : ''}`, muc: vietqr.loai === 'khong_co' ? 'xau' : mucTrangThai(vietqr.trangThai) }
  }
  return { trangThai: '', cqt: '', nguon: vietqr?.loai === 'loi' ? 'Lỗi: ' + vietqr.chu : 'Chưa tra', muc: 'khong_ro' }
}

// Hai sheet: "Hóa đơn mua vào" (mỗi hóa đơn một dòng + 3 cột tra cứu) và "Người bán" (gom theo MST). Mảng hàng cho excelDep.
export function hangExcelNcc({ tenCty = '', hoaDon, ncc, ketQua }) {
  const kq = mst => ketQua.get(mst) || ketQuaNcc(null, null)
  const hd = [
    [`DANH SÁCH HÓA ĐƠN MUA VÀO — TÌNH TRẠNG NGƯỜI BÁN${tenCty ? ' — ' + tenCty : ''}`],
    ['Trạng thái MST theo VietQR (tổng hợp từ Cục Thuế, trễ 1–2 tuần) hoặc tra trực tiếp tracuunnt.gdt.gov.vn — xem cột Nguồn.'],
    ['STT', 'Ký hiệu', 'Số HĐ', 'Ngày HĐ', 'MST người bán', 'Tên người bán', 'Tiền chưa thuế', 'Thuế GTGT', 'Trạng thái MST', 'Mức', 'CQT quản lý', 'Nguồn / ngày tra'],
    ...hoaDon.map((h, i) => {
      const k = h.mst ? kq(h.mst) : { trangThai: h.mstGoc ? 'MST sai dạng' : 'Thiếu MST người bán', cqt: '', nguon: '', muc: 'khong_ro' }
      return [i + 1, h.kyHieu, h.so, ngayVn(h.ngay), h.mst || h.mstGoc, h.ten, h.tienChuaThue ?? null, h.thue ?? null, k.trangThai, NHAN_MUC[k.muc], k.cqt, k.nguon]
    }),
  ]
  const nb = [
    [`NGƯỜI BÁN — ${ncc.length} MST${tenCty ? ' — ' + tenCty : ''}`],
    ['STT', 'MST', 'Tên người bán', 'Số HĐ', 'Tiền chưa thuế', 'Thuế GTGT', 'Từ ngày', 'Đến ngày', 'Trạng thái MST', 'Mức', 'CQT quản lý', 'Nguồn / ngày tra'],
    ...ncc.map((n, i) => { const k = kq(n.mst); return [i + 1, n.mst, n.ten, n.soHd, n.tien, n.thue, ngayVn(n.tuNgay), ngayVn(n.denNgay), k.trangThai, NHAN_MUC[k.muc], k.cqt, k.nguon] }),
  ]
  return { hd, nb }
}
