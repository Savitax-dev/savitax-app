// Phụ lục TỜ KHAI BỔ SUNG khổ ngang — Mẫu 01/KHBS + 01-1/KHBS (TT80/2021) — kèm tờ khai bổ sung (loaiTKhai B).
// Anh gửi bản cổng in 16/11/2026 (UMAMI DINING, 01/GTGT Q1/2026 BSL1: tờ khai 2 trang + 01/KHBS 2 trang + 01-1/KHBS 2
// trang, mỗi phần đánh số riêng). Tọa độ đo trực tiếp từ bản đó — trang ngang A4 842 × 595, cổng in chữ ở cỡ 10,17
// (bằng 10pt × 1,017) nên mọi số đo dưới đây giữ nguyên tỉ lệ bản in, không quy về 100%.
//
// Bảng của cổng (PD4ML) là bảng HTML tự co cột: cột rộng theo tỉ lệ nội dung dài nhất của nó — dongCot() làm lại
// đúng cách đó (đã so: 01/KHBS bảng 1 ra STT 60 · Tên tiểu mục 176 · số tiền 565, khớp bản cổng từng pt).
import { the, motKhoi } from './tokhaiXml.js'

const WL = 841.89, HL = 595.28
const K = 1.017
const CO = 10 * K, CO_NHO = 7.5 * K, CO_SO_TRANG = 12
const DONG = 12.03                   // bước dòng chữ trong ô bảng
const caoHang = n => 7.1 + Math.max(1, n) * DONG   // 1 dòng 19,13 · 2 dòng 31,16 · 3 dòng 43,19 (đo)
const LECH = 9.55                    // từ đỉnh khối chữ trong ô tới chân chữ dòng đầu
const DONG_VB = 12.06                // dòng văn bản ngoài bảng
const TREN = 20.2                    // đỉnh vùng nội dung
const DEM = 3.5                      // lề chữ trong ô
const NET = 0.62

// KHỔ IN. Ngang = TT80 (mặc định, đo bản UMAMI). Dọc = 01/GTGT theo TT89 (maTKhai 2032) — bản cổng in BS T10/2026 ÁNH DƯƠNG
// (25/11/2026): CÙNG bảng HTML của cổng nhưng trang A4 dọc, cổng thu nhỏ cả trang còn S = 0,977 (chữ 9,94). App dựng trên trang
// ẢO rộng 595,28/S theo đúng số đo bản ngang rồi `embedPage` thu vào A4 (như 03-3A ở lib/tokhaiPdfTndn.js). Số đo bản dọc = số đo
// trên bản cổng (A4) ÷ S. Bản cổng anh gửi là bản in lại qua "Microsoft Print To PDF" lên giấy Letter (thu 0,939) → đã quy về A4;
// sai số quy đổi ~0,7pt.
const KHO = {
  ngang: {
    S: 1, W: WL, H: HL, X0: 20.3, X1: 821.6, DAY: 565.3, TAM: 328.7,
    hop: { x0: 638.6, x1: 820.9, y0: 21.2, y1: 54.2 },
    hopChu: ['( Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày', '29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính )'],
  },
  doc: {
    S: 0.977, W: 595.28 / 0.977, H: 841.89 / 0.977, X0: 21.41, X1: 587.71, DAY: 841.89 / 0.977 - 29.98, TAM: 239.1,
    hop: { x0: 458.7, x1: 587.2, y0: 21.2, y1: 63.1 },
    hopChu: ['( Ban hành kèm theo Thông tư số', '80/2021/TT-BTC ngày 29 tháng 9 năm', '2021 của Bộ trưởng Bộ Tài chính )'],
  },
}

const T = t => ({ t, k: 'thuong' }), D = t => ({ t, k: 'dam' }), N = t => ({ t, k: 'nghieng' })
const ten2 = (ma, ten) => `${ma || ''} - ${ten || ''}`.replace(/\s+/g, ' ').trim()
// Khác nhau theo tờ khai gốc (đo từ bản cổng in): 01/GTGT (842 — UMAMI Q1/2026) là mặc định; 03/TNDN (892 — TEN NOODLES năm
// 2025 BSL1, 21/11/2026): ô "Ngày:" của [09] ở 372,68; tên người ký B+118,92 và vạch B+131,3 (GTGT B+98 / B+107,1); bảng
// 01-1/KHBS in cột (4) số đã kê khai + (5) số điều chỉnh dạng SỐ THÔ không chấm ("460936403"), chỉ cột (6)(7) có chấm.
// 01/GTGT TT89 (2032): khổ DỌC; [07]–[09] ghi "tổ chức, cá nhân cung cấp dịch vụ làm thủ tục về thuế"; phần B của 01/KHBS là
// BẢNG (danh sách DsThuHoiHoan), không còn các dòng chữ; khối chữ ký đo riêng từng phần (cột phải hẹp → chữ tự xuống dòng).
const RIENG = {
  892: { ngay: 372.68, ten: 118.92, vach: 131.3, soTho: true },
  2032: { kho: 'doc', tt89: true, ngay: 390.5, soTho: false },
}
const MAC_DINH = { ngay: 230.95, ten: 98, vach: 107.1, soTho: false }

// Khối "Tôi cam đoan…" + chữ ký: số đo tính từ chân dòng "Tôi cam đoan" (B). trai/phai: [chữ, độ lệch B, kiểu]
// Bản ngang dùng chung cho 01/KHBS và 01-1/KHBS (cột phải canh giữa 638,9). Bản dọc TT89 mỗi phần một kiểu.
const KY = {
  ngang: {
    truoc: { kh: 12.66, gt: 12.3 }, xCam: { kh: 0.34, gt: 0.34 },
    camDoan: { kh: 'những số liệu', gt: 'những số liệu' },
    kh: { tam: 638.9, xTrai: 3.46, phai: [['ngay', 27.36], ['NGƯỜI NỘP THUẾ hoặc', 45.84, 'dam'], ['ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ', 57.84, 'dam'], ['Ký, ghi rõ họ tên, chức vụ và đóng dấu (nếu có)', 69.96, 'nghieng']], trai: [['NHÂN VIÊN ĐẠI LÝ THUẾ', 27.36, 'dam'], ['hoTen', 45.84], ['chungChi', 69.96]] },
  },
  doc: {
    truoc: { kh: 13.36, gt: 13.5 }, xCam: { kh: 0.27, gt: 5.23 },
    camDoan: { kh: 'những số liệu', gt: 'số liệu' },
    kh: { tam: 483.1, xTrai: 3.40, ten: 110.1, vach: 119.2,
      phai: [['ngay', 27.35], ['NGƯỜI NỘP THUẾ hoặc', 45.80, 'dam'], ['ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP', 57.97, 'dam'], ['THUẾ', 70.02, 'dam'], ['Ký, ghi rõ họ tên, chức vụ và đóng dấu (nếu có)', 82.06, 'nghieng']],
      trai: [['NHÂN VIÊN ĐẠI LÝ THUẾ', 27.35, 'dam'], ['hoTen', 51.57], ['chungChi', 75.77]] },
    gt: { tam: 401.2, xTrai: 3.40, ten: 103.85, vach: 112.95,
      phai: [['ngay', 27.35], ['NGƯỜI NỘP THUẾ hoặc', 51.57, 'dam'], ['ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ', 63.62, 'dam'], ['(Chữ ký, ghi rõ họ tên; chức vụ và đóng dấu (nếu có)/Ký điện tử)', 75.65, 'nghieng']],
      trai: [['NHÂN VIÊN ĐẠI LÝ THUẾ', 45.80, 'dam'], ['hoTen', 57.86], ['chungChi', 82.06]] },
  },
}
KY.ngang.gt = KY.ngang.kh
const ngayVN = s => (/^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10).split('-').reverse().join('/') : String(s ?? '').trim())
const soHoacChu = (v, soMau) => /^-?\d+([.,]\d+)?$/.test(String(v ?? '').trim()) ? soMau(v) : String(v ?? '').trim()

// Rộng cột kiểu bảng HTML tự co: max = nội dung một dòng dài nhất, min = từ dài nhất (+ lề). Đủ chỗ → chia phần dư theo
// tỉ lệ max; thiếu chỗ → min + phần chênh (max − min) theo tỉ lệ. Ô gộp nhiều cột không tham gia đo.
function dongCot(C, soCot, hangs, { X0, X1 }) {
  const rongBang = X1 - X0
  const mx = Array(soCot).fill(2 * DEM + 1), mn = Array(soCot).fill(2 * DEM + 1)
  // "Từ dài nhất": cổng cho ngắt cả SAU dấu gạch ngang ("{[41]=([36]-" là một mảnh) — đo bằng bản 01-1/KHBS UMAMI
  const doCell = o => {
    let a = 2 * DEM, b = 2 * DEM
    for (const dd of o.chu || []) {
      a = Math.max(a, C.rong(dd, CO) + 2 * DEM)
      for (const d of dd) for (const tu of String(d.t).split(/\s+|(?<=-)/)) b = Math.max(b, C.rong([{ ...d, t: tu }], CO) + 2 * DEM)
    }
    return [a, b]
  }
  const gop = []
  for (const h of hangs) for (const o of h) {
    const [a, b] = doCell(o)
    if ((o.n || 1) > 1) { gop.push({ o, a, b }); continue }
    mx[o.c] = Math.max(mx[o.c], a); mn[o.c] = Math.max(mn[o.c], b)
  }
  // Ô gộp nhiều cột: nội dung của nó lớn hơn tổng các cột bên dưới thì nới các cột đó theo tỉ lệ
  for (const { o, a, b } of gop) {
    const cs = Array.from({ length: o.n }, (_, i) => o.c + i)
    const sa = cs.reduce((t, c) => t + mx[c], 0), sb = cs.reduce((t, c) => t + mn[c], 0)
    if (a > sa) cs.forEach(c => { mx[c] *= a / sa })
    if (b > sb) cs.forEach(c => { mn[c] *= b / sb })
    cs.forEach(c => { mx[c] = Math.max(mx[c], mn[c]) })
  }
  const sMax = mx.reduce((a, b) => a + b, 0), sMin = mn.reduce((a, b) => a + b, 0)
  const rong = sMax <= rongBang ? mx.map(v => v * rongBang / sMax)
    : mn.map((v, i) => v + (mx[i] - v) * Math.max(0, rongBang - sMin) / Math.max(1, sMax - sMin))
  const x = [X0]
  for (const r of rong) x.push(x[x.length - 1] + r)
  x[x.length - 1] = X1
  return x
}

export function phuLucKhbs(xml) {
  const pl = motKhoi(xml, 'PLuc')
  return { kh: motKhoi(pl, 'PL01_KHBS'), gt: motKhoi(pl, 'PL01_1_KHBS') }
}

// Vẽ các trang phụ lục KHBS có trong XML. C: bộ chữ (taoChu), mau: { VIEN_NGOAI, VIEN_TRONG, VIEN_HOP, VACH, hex },
// veChuKy(trang, yDongDau): dòng xanh "Ký điện tử bởi". Mỗi phần (01/KHBS, 01-1/KHBS) đánh số trang riêng.
export async function veKhbs({ pdf, C, d, xml, soMau, mau, veChuKy }) {
  const { kh, gt } = phuLucKhbs(xml)
  if (kh) await vePhan({ pdf, C, d, soMau, mau, veChuKy, x: kh, loai: 'kh' })
  if (gt) await vePhan({ pdf, C, d, soMau, mau, veChuKy, x: gt, loai: 'gt' })
}

async function vePhan({ pdf, C, d, soMau, mau, veChuKy, x, loai }) {
  const hd = motKhoi(x, 'Header')
  const R = RIENG[the(hd, 'maTKhai')] || MAC_DINH
  const L = KHO[R.kho || 'ngang']
  const { X0, X1, DAY } = L
  const DU_NGAT = L.S === 1 ? 0 : 0.6
  // Bản dọc ngắt dòng trong ô như trình duyệt (được ngắt sau dấu '-': "(-" / "))" ở bảng phân bổ — bản cổng ÁNH DƯƠNG)
  const NGAT_HTML = L.S === 1 ? undefined : { html: true }
  const ky = (KY[R.kho || 'ngang'])
  const ds = []
  let trang = null, y = TREN
  const moTrang = () => { trang = pdf.addPage([L.W, L.H]); ds.push(trang); y = TREN }
  const ke = (a, b, c, e, mauNet) => trang.drawLine({ start: { x: a, y: L.H - b }, end: { x: c, y: L.H - e }, thickness: NET, color: mauNet })
  // Một dòng văn bản: `truoc` = khoảng thêm phía trên (đo); hết chỗ thì sang trang
  const dong = (doan, { x0 = X0 + 0.34, truoc = 0, phai = false, xPhai = X1 + 0.68, rongToiDa = X1 - x0 } = {}) => {
    for (const dd of C.ngat(doan, rongToiDa, CO)) {
      let base = y + truoc + 9.16
      if (base + 2.9 > DAY) { moTrang(); base = TREN + 7.64 }   // dòng đầu trang mới: chân chữ ở 27,84 (đo trang 4)
      if (phai) C.vePhai(trang, dd, xPhai, base, CO); else C.ve(trang, dd, x0, base, CO)
      y = base + 2.9; truoc = 0
    }
  }
  moTrang()

  // 1. Đầu trang: quốc hiệu canh giữa (ngang 328,7) + ô "Mẫu số" bên phải (chữ nhỏ 2 dòng ngang / 3 dòng dọc, cách 8,88)
  const TAM = L.TAM
  C.veGiua(trang, [D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], TAM, 30.36, CO)
  C.veGiua(trang, [D('Độc lập-Tự do-Hạnh phúc')], TAM, 41.88, CO)
  C.veGiua(trang, [T('-------------------------')], TAM, 54.6, CO)
  C.veGiua(trang, [D(loai === 'kh' ? 'TỜ KHAI BỔ SUNG' : 'BẢN GIẢI TRÌNH KHAI BỔ SUNG')], TAM, 66.6, CO)
  if (loai === 'gt') C.veGiua(trang, [N('(Kèm theo Tờ khai bổ sung mẫu số 01/KHBS)')], TAM, 78.72, CO)
  const hop = L.hop, tamHop = (hop.x0 + hop.x1) / 2
  C.veGiua(trang, [T('Mẫu số: '), D(loai === 'kh' ? '01/KHBS' : '01-1/KHBS')], tamHop, 32.28, CO)
  L.hopChu.forEach((s, i) => C.veGiua(trang, [N(s)], tamHop, 41.88 + i * 8.88, CO_NHO))
  trang.drawRectangle({ x: hop.x0, y: L.H - hop.y1, width: hop.x1 - hop.x0, height: hop.y1 - hop.y0, borderColor: mau.VIEN_HOP, borderWidth: NET })

  // 2. Thông tin [01]…: dòng cách 13,32
  y = (loai === 'kh' ? 93.96 : 105.36) - 9.16 - (13.32 - DONG_VB)
  const tt = [
    [D('[01]'), T(' Mẫu tờ khai: ' + (the(hd, 'tenTKhai') || d.moTaBMau))],
    [D('[02]'), T(' Mã giao dịch điện tử: ' + the(hd, 'maGiaoDich'))],
    [D('[03]'), T(' Kỳ tính thuế: ' + d.kyChu)],
    [D('[04]'), T(' Bổ sung lần thứ: ' + (the(hd, 'soLan') || d.soLan))],
    [D('[05]'), T(' Tên người nộp thuế: ' + (the(hd, 'tenNNT') || d.ten))],
    [D('[06]'), T(' Mã số thuế: ' + (the(hd, 'mst') || d.mst))],
  ]
  if (loai === 'kh') tt.push(
    [D('[07]'), T((R.tt89 ? ' Tên tổ chức, cá nhân cung cấp dịch vụ làm thủ tục về thuế (nếu có): ' : ' Tên đại lý thuế (nếu có): ') + the(hd, 'tenDLyThue'))],
    [D('[08]'), T(' Mã số thuế: ' + the(hd, 'mstDLyThue'))])
  for (const doan of tt) dong(doan, { truoc: 13.32 - DONG_VB })
  if (loai === 'kh') {
    // [09] hai ô: "Hợp đồng đại lý thuế: Số …" | "Ngày: …" (ngang 230,95; TT89 "Hợp đồng dịch vụ làm thủ tục về thuế: Số:")
    y += 13.32 - DONG_VB
    const base = y + 9.16
    C.ve(trang, [D('[09]'), T((R.tt89 ? ' Hợp đồng dịch vụ làm thủ tục về thuế: Số: ' : ' Hợp đồng đại lý thuế: Số ') + the(hd, 'soHDongDLyThue'))], X0 + 0.34, base, CO)
    C.ve(trang, [T('Ngày: ' + the(hd, 'ngayKyHDDLyThue'))], R.ngay, base, CO)
    y = base + 2.9
  }

  // Bảng: hang = [{ c, n, chu: [đoạn…] (mỗi đoạn một dòng gốc, tự ngắt), canh }]; sang trang không lặp tiêu đề.
  // xCot: mép cột cố định (đo từ bản cổng) thay cho tự co cột
  const veBang = (soCot, hangs, { truoc = 0, xCot = null } = {}) => {
    const xc = xCot || dongCot(C, soCot, hangs, L)
    y += truoc
    let dau = y
    const vienNgoai = yc => { ke(X0, dau, X1, dau, mau.VIEN_NGOAI); ke(X0, dau, X0, yc, mau.VIEN_NGOAI); ke(X1, dau, X1, yc, mau.VIEN_NGOAI); ke(X0, yc, X1, yc, mau.VIEN_NGOAI) }
    // ô gộp hàng (rowspan) của hàng tiêu đề 2 tầng: { c, n, h: số hàng }
    for (let i = 0; i < hangs.length; i++) {
      const h = hangs[i]
      const o = h.map(c => ({ ...c, xa: xc[c.c], xb: xc[c.c + (c.n || 1)] }))
      o.forEach(c => { c.dong = (c.chu || []).flatMap(dd => C.ngat(dd, c.xb - c.xa - 2 * DEM + DU_NGAT, CO, NGAT_HTML)) })
      // h.rong: hàng không có chữ nào (dòng chi tiết rỗng của 01-1/KHBS TT89) — cổng chỉ còn lề ô, cao 7,1
      const cao = h.cao ?? (h.rong ? 7.1 : caoHang(Math.max(1, ...o.filter(c => !c.h).map(c => c.dong.length))))
      if (y + cao > DAY && y > dau) { vienNgoai(y); moTrang(); dau = y }
      for (const c of o) {
        const ch = c.h ? c.h : cao
        ke(c.xa, y, c.xb, y, mau.VIEN_TRONG); ke(c.xa, y + ch, c.xb, y + ch, mau.VIEN_TRONG)
        ke(c.xa, y, c.xa, y + ch, mau.VIEN_TRONG); ke(c.xb, y, c.xb, y + ch, mau.VIEN_TRONG)
        const y0 = y + (ch - c.dong.length * DONG) / 2
        c.dong.forEach((dd, j) => {
          const yy = y0 + LECH + j * DONG
          if (c.canh === 'giua') C.veGiua(trang, dd, (c.xa + c.xb) / 2, yy, CO)
          else if (c.canh === 'phai') C.vePhai(trang, dd, c.xb - DEM, yy, CO)
          else C.ve(trang, dd, c.xa + DEM, yy, CO)
        })
      }
      y += cao
    }
    vienNgoai(y)
  }
  const o = (c, chu, canh, extra = {}) => ({ c, chu: chu == null || chu === '' ? [] : Array.isArray(chu) ? (Array.isArray(chu[0]) ? chu : [chu]) : [[T(chu)]], canh, ...extra })
  const dau = ds2 => ds2.map((s, i) => o(i, [D(s)], 'giua'))
  const thuTu = ds2 => ds2.map((s, i) => o(i, s, 'giua'))
  // TT89: 01-1/KHBS chỉ in "Đơn vị tiền:" (không kèm tên tiền)
  const donVi = (truoc = 0, chu = 'Đơn vị tiền: Đồng Việt Nam') => dong([N(chu)], { truoc, phai: true, xPhai: truoc ? X1 - 1.24 : X1 + 0.68 })
  const dsChiTiet = k => [...String(k || '').matchAll(/<ChiTiet\b[\s\S]*?<\/ChiTiet>/g)].map(m => m[0])
  // Bảng 3 cột "STT · Tên tiểu mục · số tiền" (A.I.1, A.II, A.III)
  const bangTieuMuc = (khoi, cotTien, maTong, tieuDe3, truoc = 0) => {
    const rows = dsChiTiet(khoi)
    veBang(3, [
      dau(['STT', 'Tên Tiểu mục', tieuDe3]),
      thuTu(['(1)', '(2)', '(3)']),
      ...rows.map((r, i) => [o(0, String(i + 1), 'giua'), o(1, ten2(the(r, 'ct2_ma'), the(r, 'ct2_ten'))), o(2, soMau(the(r, cotTien) || 0), 'phai')]),
      [o(0, ''), o(1, [D('Tổng cộng: ' + maTong)], 'giua'), o(2, [D(soMau(tongCua(khoi)))], 'phai')],
    ], { truoc })
  }
  const tongCua = khoi => (String(khoi).match(/<tongCong_ct\d+>([^<]*)</) || [])[1] || '0'

  if (loai === 'kh') {
    const A = motKhoi(x, 'Muc_A'), AI = motKhoi(A, 'Muc_I')
    dong([D('A. Xác định tăng/giảm số thuế phải nộp và tiền chậm nộp, tăng/giảm số thuế được khấu trừ, tăng/giảm số thuế đề nghị hoàn:')], { x0: X0 + 1.66, truoc: 2.46 })
    dong([D('I. Xác định tăng/giảm số thuế phải nộp và tiền chậm nộp:')], { x0: X0 + 1.66, truoc: 3.9 })
    dong([T('1. Số thuế phải nộp trên tờ khai điều chỉnh tăng/giảm:')], { x0: X0 + 1.66, truoc: 3.8 })
    donVi(3.9)
    bangTieuMuc(motKhoi(AI, 'Muc_1'), 'ct3', '[10]', 'Tăng/giảm số thuế phải nộp (tăng ghi (+), giảm ghi (-))', 1.76)

    // 2. Phụ lục phân bổ: tiêu đề hai tầng (Địa bàn = Xã/phường/đặc khu + Tỉnh)
    const M2 = motKhoi(AI, 'Muc_2')
    dong([T('2. Số thuế phải nộp trên Phụ lục phân bổ điều chỉnh tăng/giảm:')], { x0: X0 - 0.26, truoc: 0.75 })
    donVi()
    const bks = [...String(M2).matchAll(/<BKePLuc\b[\s\S]*?<\/BKePLuc>/g)].map(m => m[0])
    const hangPb = []
    bks.forEach((bk, i) => {
      hangPb.push([o(0, String(i + 1), 'giua'), o(1, ten2(the(bk, 'ma_PLuc'), the(bk, 'ten_PLuc')).replace(/^-$/, '')), o(2, ''), o(3, ''), o(4, ''), o(5, ''), o(6, '')])
      for (const r of dsChiTiet(motKhoi(bk, 'CTietPLuc'))) hangPb.push([o(0, ''), o(1, ten2(the(r, 'ct2_ma'), the(r, 'ct2_ten'))), o(2, the(r, 'ct3_ma')), o(3, the(r, 'ten_Xa')), o(4, the(r, 'ct05_ten')), o(5, the(r, 'ct06_ten')), o(6, soMau(the(r, 'ct7') || 0), 'phai')])
    })
    const tieuDe = [
      o(0, [D('STT')], 'giua', { h: 50.2 }),
      o(1, [[D('Tên (đơn vị phụ thuộc, địa điểm kinh doanh/tên mặt hàng/tỉnh nơi không có đơn vị phụ thuộc/địa điểm kinh doanh/đơn vị tiêu thụ/cơ sở khai thác)')]], 'giua', { h: 50.2 }),
      o(2, [[D('Mã số thuế/mã số địa điểm kinh doanh (nếu có)')]], 'giua', { h: 50.2 }),
      o(3, [[D(R.tt89 ? 'Địa bàn hoạt động sản suất, kinh doanh' : 'Địa bàn hoạt động sản xuất, kinh doanh')]], 'giua', { n: 2 }),   // TT89: cổng in "sản suất"
      o(5, [[D('Cơ quan thuế quản lý địa bàn nhận phân bổ')]], 'giua', { h: 50.2 }),
      o(6, [[D('Số tiền thuế phải nộp điều chỉnh tăng/ giảm (tăng ghi (+), giảm ghi (-))')]], 'giua', { h: 50.2 }),
    ]
    tieuDe.cao = 31.2
    const tieuDe2 = [o(3, [D('Xã/phường/đặc khu')], 'giua'), o(4, [D('Tỉnh')], 'giua')]
    tieuDe2.cao = 19.0
    const hangM2 = [tieuDe, tieuDe2, thuTu(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)']), ...hangPb,
      [o(0, [D('Tổng cộng: [11]')], 'giua', { n: 6 }), o(6, [D(soMau(the(M2, 'tongCong_ct11') || 0))], 'phai')]]
    let xM2 = null
    if (L.S !== 1) {
      // Bản dọc (ÁNH DƯƠNG T10/2026): ô gộp 2 hàng tới 5 dòng chữ → tổng cao = max(ô gộp, hàng 1 + hàng 2); hàng 2 nhận phần dư
      xM2 = dongCot(C, 7, hangM2, L)
      const soDong = c => (c.chu || []).flatMap(dd => C.ngat(dd, xM2[c.c + (c.n || 1)] - xM2[c.c] - 2 * DEM + DU_NGAT, CO, NGAT_HTML)).length
      const h1 = caoHang(Math.max(...tieuDe.filter(c => !c.h).map(soDong)))
      const tong = Math.max(caoHang(Math.max(...tieuDe.filter(c => c.h).map(soDong))), h1 + caoHang(Math.max(...tieuDe2.map(soDong))))
      tieuDe.cao = h1; tieuDe2.cao = tong - h1
      tieuDe.forEach(c => { if (c.h) c.h = tong })
    }
    veBang(7, hangM2, { xCot: xM2 })

    const M3 = motKhoi(AI, 'Muc_3')
    const ngayCN = the(M3, 'ct3a_1')
    dong([T('3. Xác định số tiền chậm nộp điều chỉnh tăng/giảm (tăng ghi (+), giảm ghi (-)):')], { x0: X0 - 0.26, truoc: 12.9 })
    dong([T('a) Số ngày chậm nộp tính đến ngày' + (ngayCN ? ' ' + ngayCN : '') + ' : ' + soMau(the(M3, 'ct3a_2') || 0))], { x0: X0 - 0.26 })
    dong([T('b) Số tiền chậm nộp tăng/giảm: ' + soMau(the(M3, 'ct3b') || 0))], { x0: X0 - 0.26 })

    dong([D('II. Số thuế được khấu trừ điều chỉnh tăng/giảm:')], { x0: X0 - 0.26 })
    donVi()
    bangTieuMuc(motKhoi(A, 'Muc_II'), 'ct3', '[12]', 'Tăng/giảm số thuế khấu trừ (tăng ghi (+), giảm ghi (-))')
    dong([D('III. Số thuế đề nghị hoàn điều chỉnh tăng/giảm:')], { x0: X0 - 0.26, truoc: 0.75 })
    donVi()
    bangTieuMuc(motKhoi(A, 'Muc_III'), 'ct3', '[13]', 'Tăng/giảm số thuế đề nghị hoàn (tăng ghi (+), giảm ghi (-))')

    const B = motKhoi(x, 'Muc_B'), BI = motKhoi(B, 'Muc_I'), BII = motKhoi(B, 'Muc_II')
    const cach = (...ds2) => ds2.filter(Boolean).join(' ')
    dong([D('B. Số thuế thu hồi hoàn và tiền chậm nộp (nếu có):')], { x0: X0 - 0.26, truoc: 0.75 })
    if (R.tt89) {
      // TT89: BẢNG 8 cột, tiêu đề 2 tầng (Số thuế thu hồi hoàn = 6 cột · Tiền chậm nộp = 2 cột), mỗi dòng một CTietDsThuHoiHoan.
      // Mép cột đo từ bản cổng (A4 ÷ 0,977). Cột "Số ngày nhận được tiền hoàn" cổng in canh TRÁI.
      const dsTh = [...String(motKhoi(B, 'DsThuHoiHoan')).matchAll(/<CTietDsThuHoiHoan\b[\s\S]*?<\/CTietDsThuHoiHoan>/g)].map(m => m[0])
      const t1 = [o(0, [[D('Số thuế thu hồi hoàn')]], 'giua', { n: 6 }), o(6, [[D('Tiền chậm nộp')]], 'giua', { n: 2 })]
      const t2 = ['Số tiền', 'Quyết định hoàn số', 'Quyết định hoàn ngày', 'Cơ quan thuế ban hành quyết định', 'Lệnh hoàn số', 'Lệnh hoàn ngày',
        'Số ngày nhận được tiền hoàn thuế'].map((s2, i) => o(i, [[D(s2)]], 'giua'))
      t2.push(o(7, [[D('Số tiền chậm nộp')], [T('(=số tiền đã được hoàn phải nộp trả NSNN x thời gian tính tiền chậm nộp [14] x mức chậm nộp)')]], 'giua'))
      veBang(8, [t1, t2, ...(dsTh.length ? dsTh : ['']).map(r => [
        o(0, soMau(the(r, 'ct_1') || 0), 'phai'), o(1, the(r, 'ct_2_so')), o(2, ngayVN(the(r, 'ct_2_ngay'))), o(3, the(r, 'ct_2_CQT_ten')),
        o(4, the(r, 'ct_3_so')), o(5, ngayVN(the(r, 'ct_3_ngay'))), o(6, soMau(the(r, 'ct_4') || 0)), o(7, soMau(the(r, 'ct_5') || 0), 'phai'),
      ])], { xCot: [X0, 49.28, 104.62, 165.05, 244.45, 287.76, 335.38, 412.29, X1] })
      camDoan()
    } else {
    dong([D('I. Số thuế thu hồi hoàn:')], { x0: X0 - 0.26 })
    dong([T('1. Số tiền thu hồi hoàn: ' + soMau(the(BI, 'ct_1') || 0) + ': Đồng Việt Nam.')], { x0: X0 - 0.26 })
    dong([T('2. Quyết định hoàn thuế: ' + cach('Số', the(BI, 'ct_2_so'), 'ngày', the(BI, 'ct_2_ngay'), 'cơ quan thuế ban hành quyết định', the(BI, 'ct_2_CQT_ten')))], { x0: X0 - 0.26 })
    dong([T('3. Lệnh hoàn thuế: ' + cach('Số', the(BI, 'ct_3_so'), 'ngày', the(BI, 'ct_3_ngay')))], { x0: X0 - 0.26 })
    dong([D('II. Tiền chậm nộp:')], { x0: X0 - 0.26 })
    dong([T('1. Số ngày nhận được tiền hoàn thuế: ' + soMau(the(BII, 'ct_1') || 0))], { x0: X0 - 0.26 })
    dong([T('2. Số tiền chậm nộp (= số tiền đã được hoàn phải nộp trả NSNN x số ngày nhận được tiền hoàn thuế x mức chậm nộp): ' + soMau(the(BII, 'ct_2') || 0))], { x0: X0 - 0.26 })
    camDoan()
    }
  } else {
    dong([D('A. Thông tin khai bổ sung:')], { x0: X0 + 1.66, truoc: 2.58 })
    donVi(3.78, R.tt89 ? 'Đơn vị tiền:' : undefined)
    const A = motKhoi(x, 'Muc_A'), tong = motKhoi(A, 'TongCong')
    const hang = []
    ;[...String(A).matchAll(/<BKeHSo\b[\s\S]*?<\/BKeHSo>/g)].forEach(([bk], i) => {
      hang.push([o(0, String(i + 1), 'giua'), o(1, the(bk, 'ten_HSo')), ...[2, 3, 4, 5, 6, 7].map(c => o(c, ''))])
      for (const r of dsChiTiet(motKhoi(bk, 'CTietHSo'))) {
        const rong = ['ct2_ten', 'ct3_ma', 'ct3_ten', 'ct04', 'ct05', 'ct06', 'ct7', 'ct8'].every(t => !String(the(r, t) ?? '').trim())
        if (rong && R.tt89) { const h0 = [0, 1, 2, 3, 4, 5, 6, 7].map(c => o(c, '')); h0.rong = true; hang.push(h0); continue }
        hang.push([
        o(0, ''), o(1, the(r, 'ct2_ten')), o(2, ten2(the(r, 'ct3_ma'), the(r, 'ct3_ten'))),
        o(3, R.soTho ? String(the(r, 'ct04') ?? '').trim() : soHoacChu(the(r, 'ct04'), soMau), 'phai'),
        o(4, R.soTho ? String(the(r, 'ct05') ?? '').trim() : soHoacChu(the(r, 'ct05'), soMau), 'phai'),
        o(5, soHoacChu(the(r, 'ct06'), soMau), 'phai'), o(6, String(the(r, 'ct7') ?? '').trim() === '' ? '' : soHoacChu(the(r, 'ct7'), soMau), 'phai'), o(7, the(r, 'ct8')),
      ])
      }
    })
    const tongDong = (chu, ma, v) => [o(0, ''), o(1, [D(chu)], 'trai', { n: 4 }), o(5, [D(ma)], 'giua'), o(6, [D(soMau(v || 0))], 'phai'), o(7, '\\', 'giua')]
    veBang(8, [
      dau(['STT', 'Tên chỉ tiêu điều chỉnh/ Tên hàng hóa, dịch vụ', 'Mã số chỉ tiêu', 'Số đã kê khai', 'Số điều chỉnh', 'Chênh lệch/thay đổi giữa số điều chỉnh với số đã kê khai', 'Điều chỉnh tăng/giảm nghĩa vụ thuế', 'Lý do']),
      thuTu(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)=(5)-(4)', '(7)', '(8)']),
      ...hang,
      tongDong('Tổng cộng (tăng +, giảm -) phải nộp:', '[07]', the(tong, 'tongCong_7')),
      tongDong('Tổng cộng (tăng +, giảm -) khấu trừ:', '[08]', the(tong, 'tongCong_8')),
      tongDong('Tổng cộng (tăng +, giảm -) đề nghị hoàn:', '[09]', the(tong, 'tongCong_9')),
    ], { truoc: 1.94 })
    dong([D('B. Tài liệu kèm theo (nếu có):')], { x0: X0 - 0.26, truoc: 0.67 })
    const tl = [...String(motKhoi(x, 'Muc_B')).matchAll(/<CTietTaiLieu\b[\s\S]*?<\/CTietTaiLieu>/g)].map(m => m[0])
    veBang(2, [dau(['STT', 'Tên chỉ tiêu điều chỉnh/ Tên hàng hóa, dịch vụ']),
      ...(tl.length ? tl : ['']).map((t, i) => [o(0, String(i + 1), 'giua'), o(1, ten2(the(t, 'ma_TLieu'), the(t, 'ten_TLieu')).replace(/^-$/, ''))])])
    camDoan()
  }

  // Cam đoan + chữ ký (đo từ dòng "Tôi cam đoan" B) — vị trí từng dòng ở bảng KY (ngang: cột phải canh giữa 638,9; vạch B+107,1;
  // dòng xanh B+vạch+18,2). Bản dọc TT89 mỗi phần một kiểu (cột phải hẹp → "ĐẠI DIỆN…" xuống dòng ở 01/KHBS).
  function camDoan() {
    const k = ky[loai]
    const vach = k.vach ?? R.vach, tenY = k.ten ?? R.ten
    const truoc = ky.truoc[loai]
    const cao = truoc + 9.16 + vach + 18.2 + 2 * DONG + 4
    if (y + cao > DAY) moTrang()
    const B = y + truoc + 9.16
    C.ve(trang, [T('Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về ' + ky.camDoan[loai] + ' đã khai./...')], X0 + ky.xCam[loai], B, CO)
    const chu = (s2, kieu) => [{ t: s2, k: kieu || 'thuong' }]
    for (const [s2, dy, kieu] of k.trai) {
      const t = s2 === 'hoTen' ? 'Họ và tên: ' + d.dly.nhanVien : s2 === 'chungChi' ? 'Chứng chỉ hành nghề số: ' + d.dly.chungChi : s2
      C.ve(trang, chu(t, kieu), X0 + k.xTrai, B + dy, CO)
    }
    for (const [s2, dy, kieu] of k.phai) C.veGiua(trang, s2 === 'ngay' ? [N(d.ngayKy)] : chu(s2, kieu), k.tam, B + dy, CO)
    if (d.nguoiKy) C.veGiua(trang, [T(d.nguoiKy)], k.tam, B + tenY, CO)
    const yVach = B + vach
    ke(X0, yVach, X1, yVach, mau.VACH)
    if (d.chuKy) veChuKy(trang, yVach + 18.2, CO)
    y = yVach + 18.2 + DONG
  }
  if (L.S === 1) { C.soTrang(ds); return }
  // Bản dọc: mỗi trang ảo → một trang A4 (thu S), xoá trang ảo; số trang vẽ trên trang A4 (cỡ 12 như mọi phần khác)
  const viTri = pdf.getPageCount() - ds.length
  const a4 = []
  for (const tr of ds) {
    const emb = await pdf.embedPage(tr)
    const moi = pdf.addPage([595.28, 841.89])
    moi.drawPage(emb, { x: 0, y: 841.89 - L.H * L.S, xScale: L.S, yScale: L.S })
    a4.push(moi)
  }
  for (let i = 0; i < ds.length; i++) pdf.removePage(viTri)
  C.soTrang(a4)
}
