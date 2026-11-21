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
const TREN = 20.2, DAY = 565.3       // vùng nội dung
const X0 = 20.3, X1 = 821.6          // mép trái / phải bảng
const DEM = 3.5                      // lề chữ trong ô
const NET = 0.62

const T = t => ({ t, k: 'thuong' }), D = t => ({ t, k: 'dam' }), N = t => ({ t, k: 'nghieng' })
const ten2 = (ma, ten) => `${ma || ''} - ${ten || ''}`.replace(/\s+/g, ' ').trim()
// Khác nhau theo tờ khai gốc (đo từ bản cổng in): 01/GTGT (842 — UMAMI Q1/2026) là mặc định; 03/TNDN (892 — TEN NOODLES năm
// 2025 BSL1, 21/11/2026): ô "Ngày:" của [09] ở 372,68; tên người ký B+118,92 và vạch B+131,3 (GTGT B+98 / B+107,1); bảng
// 01-1/KHBS in cột (4) số đã kê khai + (5) số điều chỉnh dạng SỐ THÔ không chấm ("460936403"), chỉ cột (6)(7) có chấm.
const RIENG = {
  892: { ngay: 372.68, ten: 118.92, vach: 131.3, soTho: true },
}
const MAC_DINH = { ngay: 230.95, ten: 98, vach: 107.1, soTho: false }
const soHoacChu = (v, soMau) => /^-?\d+([.,]\d+)?$/.test(String(v ?? '').trim()) ? soMau(v) : String(v ?? '').trim()

// Rộng cột kiểu bảng HTML tự co: max = nội dung một dòng dài nhất, min = từ dài nhất (+ lề). Đủ chỗ → chia phần dư theo
// tỉ lệ max; thiếu chỗ → min + phần chênh (max − min) theo tỉ lệ. Ô gộp nhiều cột không tham gia đo.
function dongCot(C, soCot, hangs, rongBang) {
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
export function veKhbs({ pdf, C, d, xml, soMau, mau, veChuKy }) {
  const { kh, gt } = phuLucKhbs(xml)
  if (kh) vePhan({ pdf, C, d, soMau, mau, veChuKy, x: kh, loai: 'kh' })
  if (gt) vePhan({ pdf, C, d, soMau, mau, veChuKy, x: gt, loai: 'gt' })
}

function vePhan({ pdf, C, d, soMau, mau, veChuKy, x, loai }) {
  const ds = []
  let trang = null, y = TREN
  const moTrang = () => { trang = pdf.addPage([WL, HL]); ds.push(trang); y = TREN }
  const ke = (a, b, c, e, mauNet) => trang.drawLine({ start: { x: a, y: HL - b }, end: { x: c, y: HL - e }, thickness: NET, color: mauNet })
  // Một dòng văn bản: `truoc` = khoảng thêm phía trên (đo); hết chỗ thì sang trang
  const dong = (doan, { x0 = 20.64, truoc = 0, phai = false, xPhai = 822.28, rongToiDa = X1 - x0 } = {}) => {
    for (const dd of C.ngat(doan, rongToiDa, CO)) {
      let base = y + truoc + 9.16
      if (base + 2.9 > DAY) { moTrang(); base = TREN + 7.64 }   // dòng đầu trang mới: chân chữ ở 27,84 (đo trang 4)
      if (phai) C.vePhai(trang, dd, xPhai, base, CO); else C.ve(trang, dd, x0, base, CO)
      y = base + 2.9; truoc = 0
    }
  }
  const hd = motKhoi(x, 'Header')
  const R = RIENG[the(hd, 'maTKhai')] || MAC_DINH
  moTrang()

  // 1. Đầu trang: quốc hiệu canh giữa 328,7 + ô "Mẫu số" bên phải
  const TAM = 328.7
  C.veGiua(trang, [D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], TAM, 30.36, CO)
  C.veGiua(trang, [D('Độc lập-Tự do-Hạnh phúc')], TAM, 41.88, CO)
  C.veGiua(trang, [T('-------------------------')], TAM, 54.6, CO)
  C.veGiua(trang, [D(loai === 'kh' ? 'TỜ KHAI BỔ SUNG' : 'BẢN GIẢI TRÌNH KHAI BỔ SUNG')], TAM, 66.6, CO)
  if (loai === 'gt') C.veGiua(trang, [N('(Kèm theo Tờ khai bổ sung mẫu số 01/KHBS)')], TAM, 78.72, CO)
  const hop = { x0: 638.6, x1: 820.9, y0: 21.2, y1: 54.2 }, tamHop = (hop.x0 + hop.x1) / 2
  C.veGiua(trang, [T('Mẫu số: '), D(loai === 'kh' ? '01/KHBS' : '01-1/KHBS')], tamHop, 32.28, CO)
  C.veGiua(trang, [N('( Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày')], tamHop, 41.88, CO_NHO)
  C.veGiua(trang, [N('29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính )')], tamHop, 50.76, CO_NHO)
  trang.drawRectangle({ x: hop.x0, y: HL - hop.y1, width: hop.x1 - hop.x0, height: hop.y1 - hop.y0, borderColor: mau.VIEN_HOP, borderWidth: NET })

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
  if (loai === 'kh') tt.push([D('[07]'), T(' Tên đại lý thuế (nếu có): ' + the(hd, 'tenDLyThue'))], [D('[08]'), T(' Mã số thuế: ' + the(hd, 'mstDLyThue'))])
  for (const doan of tt) dong(doan, { truoc: 13.32 - DONG_VB })
  if (loai === 'kh') {
    // [09] hai ô: "Hợp đồng đại lý thuế: Số …" | "Ngày: …" ở 230,95
    y += 13.32 - DONG_VB
    const base = y + 9.16
    C.ve(trang, [D('[09]'), T(' Hợp đồng đại lý thuế: Số ' + the(hd, 'soHDongDLyThue'))], 20.64, base, CO)
    C.ve(trang, [T('Ngày: ' + the(hd, 'ngayKyHDDLyThue'))], R.ngay, base, CO)
    y = base + 2.9
  }

  // Bảng: hang = [{ c, n, chu: [đoạn…] (mỗi đoạn một dòng gốc, tự ngắt), canh }]; sang trang không lặp tiêu đề
  const veBang = (soCot, hangs, { truoc = 0 } = {}) => {
    const xc = dongCot(C, soCot, hangs, X1 - X0)
    y += truoc
    let dau = y
    const vienNgoai = yc => { ke(X0, dau, X1, dau, mau.VIEN_NGOAI); ke(X0, dau, X0, yc, mau.VIEN_NGOAI); ke(X1, dau, X1, yc, mau.VIEN_NGOAI); ke(X0, yc, X1, yc, mau.VIEN_NGOAI) }
    // ô gộp hàng (rowspan) của hàng tiêu đề 2 tầng: { c, n, h: số hàng }
    for (let i = 0; i < hangs.length; i++) {
      const h = hangs[i]
      const o = h.map(c => ({ ...c, xa: xc[c.c], xb: xc[c.c + (c.n || 1)] }))
      o.forEach(c => { c.dong = (c.chu || []).flatMap(dd => C.ngat(dd, c.xb - c.xa - 2 * DEM, CO)) })
      const cao = h.cao ?? caoHang(Math.max(1, ...o.filter(c => !c.h).map(c => c.dong.length)))
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
  const donVi = (truoc = 0) => dong([N('Đơn vị tiền: Đồng Việt Nam')], { truoc, phai: true, xPhai: truoc ? 820.36 : 822.28 })
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
    dong([D('A. Xác định tăng/giảm số thuế phải nộp và tiền chậm nộp, tăng/giảm số thuế được khấu trừ, tăng/giảm số thuế đề nghị hoàn:')], { x0: 21.96, truoc: 2.46 })
    dong([D('I. Xác định tăng/giảm số thuế phải nộp và tiền chậm nộp:')], { x0: 21.96, truoc: 3.9 })
    dong([T('1. Số thuế phải nộp trên tờ khai điều chỉnh tăng/giảm:')], { x0: 21.96, truoc: 3.8 })
    donVi(3.9)
    bangTieuMuc(motKhoi(AI, 'Muc_1'), 'ct3', '[10]', 'Tăng/giảm số thuế phải nộp (tăng ghi (+), giảm ghi (-))', 1.76)

    // 2. Phụ lục phân bổ: tiêu đề hai tầng (Địa bàn = Xã/phường/đặc khu + Tỉnh)
    const M2 = motKhoi(AI, 'Muc_2')
    dong([T('2. Số thuế phải nộp trên Phụ lục phân bổ điều chỉnh tăng/giảm:')], { x0: 20.04, truoc: 0.75 })
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
      o(3, [[D('Địa bàn hoạt động sản xuất, kinh doanh')]], 'giua', { n: 2 }),
      o(5, [[D('Cơ quan thuế quản lý địa bàn nhận phân bổ')]], 'giua', { h: 50.2 }),
      o(6, [[D('Số tiền thuế phải nộp điều chỉnh tăng/ giảm (tăng ghi (+), giảm ghi (-))')]], 'giua', { h: 50.2 }),
    ]
    tieuDe.cao = 31.2
    const tieuDe2 = [o(3, [D('Xã/phường/đặc khu')], 'giua'), o(4, [D('Tỉnh')], 'giua')]
    tieuDe2.cao = 19.0
    veBang(7, [tieuDe, tieuDe2, thuTu(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)']), ...hangPb,
      [o(0, [D('Tổng cộng: [11]')], 'giua', { n: 6 }), o(6, [D(soMau(the(M2, 'tongCong_ct11') || 0))], 'phai')]])

    const M3 = motKhoi(AI, 'Muc_3')
    const ngayCN = the(M3, 'ct3a_1')
    dong([T('3. Xác định số tiền chậm nộp điều chỉnh tăng/giảm (tăng ghi (+), giảm ghi (-)):')], { x0: 20.04, truoc: 12.9 })
    dong([T('a) Số ngày chậm nộp tính đến ngày' + (ngayCN ? ' ' + ngayCN : '') + ' : ' + soMau(the(M3, 'ct3a_2') || 0))], { x0: 20.04 })
    dong([T('b) Số tiền chậm nộp tăng/giảm: ' + soMau(the(M3, 'ct3b') || 0))], { x0: 20.04 })

    dong([D('II. Số thuế được khấu trừ điều chỉnh tăng/giảm:')], { x0: 20.04 })
    donVi()
    bangTieuMuc(motKhoi(A, 'Muc_II'), 'ct3', '[12]', 'Tăng/giảm số thuế khấu trừ (tăng ghi (+), giảm ghi (-))')
    dong([D('III. Số thuế đề nghị hoàn điều chỉnh tăng/giảm:')], { x0: 20.04, truoc: 0.75 })
    donVi()
    bangTieuMuc(motKhoi(A, 'Muc_III'), 'ct3', '[13]', 'Tăng/giảm số thuế đề nghị hoàn (tăng ghi (+), giảm ghi (-))')

    const B = motKhoi(x, 'Muc_B'), BI = motKhoi(B, 'Muc_I'), BII = motKhoi(B, 'Muc_II')
    const cach = (...ds2) => ds2.filter(Boolean).join(' ')
    dong([D('B. Số thuế thu hồi hoàn và tiền chậm nộp (nếu có):')], { x0: 20.04, truoc: 0.75 })
    dong([D('I. Số thuế thu hồi hoàn:')], { x0: 20.04 })
    dong([T('1. Số tiền thu hồi hoàn: ' + soMau(the(BI, 'ct_1') || 0) + ': Đồng Việt Nam.')], { x0: 20.04 })
    dong([T('2. Quyết định hoàn thuế: ' + cach('Số', the(BI, 'ct_2_so'), 'ngày', the(BI, 'ct_2_ngay'), 'cơ quan thuế ban hành quyết định', the(BI, 'ct_2_CQT_ten')))], { x0: 20.04 })
    dong([T('3. Lệnh hoàn thuế: ' + cach('Số', the(BI, 'ct_3_so'), 'ngày', the(BI, 'ct_3_ngay')))], { x0: 20.04 })
    dong([D('II. Tiền chậm nộp:')], { x0: 20.04 })
    dong([T('1. Số ngày nhận được tiền hoàn thuế: ' + soMau(the(BII, 'ct_1') || 0))], { x0: 20.04 })
    dong([T('2. Số tiền chậm nộp (= số tiền đã được hoàn phải nộp trả NSNN x số ngày nhận được tiền hoàn thuế x mức chậm nộp): ' + soMau(the(BII, 'ct_2') || 0))], { x0: 20.04 })
    camDoan(12.66)
  } else {
    dong([D('A. Thông tin khai bổ sung:')], { x0: 21.96, truoc: 2.58 })
    donVi(3.78)
    const A = motKhoi(x, 'Muc_A'), tong = motKhoi(A, 'TongCong')
    const hang = []
    ;[...String(A).matchAll(/<BKeHSo\b[\s\S]*?<\/BKeHSo>/g)].forEach(([bk], i) => {
      hang.push([o(0, String(i + 1), 'giua'), o(1, the(bk, 'ten_HSo')), ...[2, 3, 4, 5, 6, 7].map(c => o(c, ''))])
      for (const r of dsChiTiet(motKhoi(bk, 'CTietHSo'))) hang.push([
        o(0, ''), o(1, the(r, 'ct2_ten')), o(2, ten2(the(r, 'ct3_ma'), the(r, 'ct3_ten'))),
        o(3, R.soTho ? String(the(r, 'ct04') ?? '').trim() : soHoacChu(the(r, 'ct04'), soMau), 'phai'),
        o(4, R.soTho ? String(the(r, 'ct05') ?? '').trim() : soHoacChu(the(r, 'ct05'), soMau), 'phai'),
        o(5, soHoacChu(the(r, 'ct06'), soMau), 'phai'), o(6, soHoacChu(the(r, 'ct7') || 0, soMau), 'phai'), o(7, the(r, 'ct8')),
      ])
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
    dong([D('B. Tài liệu kèm theo (nếu có):')], { x0: 20.04, truoc: 0.67 })
    const tl = [...String(motKhoi(x, 'Muc_B')).matchAll(/<CTietTaiLieu\b[\s\S]*?<\/CTietTaiLieu>/g)].map(m => m[0])
    veBang(2, [dau(['STT', 'Tên chỉ tiêu điều chỉnh/ Tên hàng hóa, dịch vụ']),
      ...(tl.length ? tl : ['']).map((t, i) => [o(0, String(i + 1), 'giua'), o(1, ten2(the(t, 'ma_TLieu'), the(t, 'ten_TLieu')).replace(/^-$/, ''))])])
    camDoan(12.3)
  }

  // Cam đoan + chữ ký (đo từ dòng "Tôi cam đoan" B): cột phải canh giữa 638,9; vạch B+107,1; dòng xanh B+125,3
  function camDoan(truoc) {
    const cao = truoc + 9.16 + R.vach + 18.2 + 2 * DONG + 4
    if (y + cao > DAY) moTrang()
    const B = y + truoc + 9.16
    const TAMK = 638.9
    C.ve(trang, [T('Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu đã khai./...')], 20.64, B, CO)
    C.ve(trang, [D('NHÂN VIÊN ĐẠI LÝ THUẾ')], 23.76, B + 27.36, CO)
    C.veGiua(trang, [N(d.ngayKy)], TAMK, B + 27.36, CO)
    C.ve(trang, [T('Họ và tên: ' + d.dly.nhanVien)], 23.76, B + 45.84, CO)
    C.veGiua(trang, [D('NGƯỜI NỘP THUẾ hoặc')], TAMK, B + 45.84, CO)
    C.veGiua(trang, [D('ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ')], TAMK, B + 57.84, CO)
    C.ve(trang, [T('Chứng chỉ hành nghề số: ' + d.dly.chungChi)], 23.76, B + 69.96, CO)
    C.veGiua(trang, [N('Ký, ghi rõ họ tên, chức vụ và đóng dấu (nếu có)')], TAMK, B + 69.96, CO)
    if (d.nguoiKy) C.veGiua(trang, [T(d.nguoiKy)], TAMK, B + R.ten, CO)
    const yVach = B + R.vach
    ke(X0, yVach, X1, yVach, mau.VACH)
    if (d.chuKy) veChuKy(trang, yVach + 18.2, CO)
    y = yVach + 18.2 + DONG
  }
  C.soTrang(ds)
}
