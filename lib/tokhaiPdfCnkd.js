// PDF TỜ KHAI THUẾ ĐỐI VỚI HỘ KINH DOANH, CÁ NHÂN KINH DOANH — Mẫu 01/CNKD ĐÚNG MẪU cổng thuế, khổ NGANG.
// Hai mẫu, chọn theo maTKhai: 1240 = TT18/2026 (Q1/2026), 1266 = TT50/2026 (từ Q2/2026) — cột bảng A lùi 2 (thêm "doanh thu
// không chịu thuế GTGT", "doanh thu chịu thuế suất 0%"). Kèm phụ lục 01/BK-STK (thông báo số tài khoản) khi XML có.
//
// Bản gốc để đo (anh gửi 28/11/2026, ca HKD PHẠM DUY PHƯƠNG, file thật để NGOÀI repo):
//   - Q1/2026 (1240): PDF cổng in (PD4ML) có chữ thật — mọi tọa độ, cỡ chữ, bước dòng dưới đây đo từ bản này. Trang ngang
//     842 × 595, chữ cỡ 10,17 (= 10 × 1,017, như phụ lục KHBS ngang ở lib/tokhaiKhbs.js).
//   - Q2, Q3/2026 (1266): bản in lại qua "Microsoft Print to PDF" (chữ thành nét vẽ, không trích được chữ) — chỉ dùng để
//     lấy NỘI DUNG mẫu TT50 (tiêu đề cột, câu "Áp dụng…", ghi chú [16] mức trừ 01 tỷ) và đo mép cột. Bố cục dọc dùng hệ đo
//     của bản Q1. Có bản cổng in (PD4ML) của mẫu 1266 thì đo lại cho chắc.
// Bảng của cổng là bảng HTML tự co cột → dùng dongCot (lib/tokhaiKhbs.js): đã so cả 4 bảng A (hai mẫu), B, C, D với bản
// cổng, lệch ≤ 1,1pt. Cổng cắt đôi một hàng qua 2 trang; app chuyển nguyên hàng sang trang sau (như các mẫu khác).
//
// Khác nhau giữa hai bản gốc mà app chép theo: mẫu 1240 luôn in đủ 6 nhóm ngành (a)–(f) cho mỗi địa điểm (thiếu thì 0) và
// in "khung trống" cho mục III / B / C ("Địa điểm kinh doanh: - ; , ," + dòng 0); mẫu 1266 chỉ in dòng có trong XML.
import { StandardFonts } from 'pdf-lib'
import { dongCot } from './tokhaiKhbs.js'

const W = 841.89, H = 595.28
const K = 1.017
const CO = 10 * K, CO_NHO = 7.5 * K
const DONG = 12.075                   // bước dòng chữ trong ô bảng / đoạn ghi chú
const caoHang = n => 6.99 + Math.max(1, n) * DONG   // 1 dòng 19,07 · 2 dòng 31,14 · 3 dòng 43,22 (đo)
const LECH = 9.53                     // đỉnh khối chữ trong ô → chân chữ dòng đầu
const DEM = 3.5
const NET = 0.62
const X0 = 20.32, X1 = 821.68, TREN = 20, DAY = 565
const TAM_KY = 561.4                  // cột phải khối chữ ký (canh giữa)

const T = t => ({ t, k: 'thuong' }), D = t => ({ t, k: 'dam' }), N = t => ({ t, k: 'nghieng' })
const theDon = (k, t) => { const m = String(k || '').match(new RegExp(`<${t}(?:\\s[^>]*)?>([^<]*)</${t}>`)); return m ? m[1].trim() : '' }
const cacKhoi = (k, t) => [...String(k || '').matchAll(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'g'))].map(m => m[1])
const ngayVN = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '').trim() }
const ten2 = (ma, ten) => (ma || ten ? `${ma || ''} - ${ten || ''}` : '')

const NGANH = [['a', 'Phân phối, cung cấp hàng hóa'], ['b', 'Dịch vụ, xây dựng không bao thầu nguyên vật liệu'], ['c', 'Hoạt động cho thuê tài sản trừ bất động sản'],
  ['d', 'Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu nguyên vật liệu'],
  ['e', 'Hoạt động cung cấp sản phẩm và dịch vụ nội dung thông tin số về giải trí, trò chơi điện tử, phim số, ảnh số, nhạc số, quảng cáo số'],
  ['f', 'Hoạt động kinh doanh khác']]

// Khác nhau theo mẫu. so: số ô số của bảng A; thue: vị trí ô thuế GTGT / TNCN trong các ô số; ma: mã dòng IV/V/VI; d: mã cột mục D
const MAU = {
  1240: {
    tt: '(Kèm theo Thông tư số 18/2026/TT-BTC ngày 05/3/2026 của Bộ trưởng Bộ Tài chính)',
    apDung: '(Áp dụng cho hộ kinh doanh, cá nhân kinh doanh có doanh thu năm trên 500 triệu đồng)',
    so: 5, thue: [1, 4], ma: [16, 17, 18], b: [20, 21, 22], d: 35, du6: true, khungTrong: true, mucTru: '500 triệu đồng', ctTru: 14,
    dau2: ['Doanh thu', 'Số thuế phải nộp', 'Doanh thu', 'Doanh thu được trừ để xác định doanh thu tính thuế', 'Số thuế phải nộp'], gtgt: 2,
  },
  1266: {
    tt: '(Kèm theo Thông tư số 50/2026/TT-BTC ngày 13/5/2026 của Bộ trưởng Bộ Tài chính)',
    apDung: '(Áp dụng cho hộ kinh doanh, cá nhân kinh doanh có doanh thu năm trên ngưỡng doanh thu không chịu thuế GTGT, không phải nộp thuế TNCN)',
    so: 7, thue: [3, 6], ma: [18, 19, 20], b: [22, 23, 24], d: 37, du6: false, khungTrong: false, mucTru: '01 tỷ đồng', ctTru: 16,
    dau2: ['Tổng doanh thu', 'Trong đó: doanh thu không chịu thuế GTGT', 'Trong đó: doanh thu chịu thuế suất 0%', 'Số thuế phải nộp',
      'Tổng doanh thu chịu thuế', 'Doanh thu được trừ để xác định doanh thu tính thuế', 'Số thuế phải nộp'], gtgt: 4,
  },
}
export const MA_CNKD = Object.keys(MAU)

const CO_PHU_LUC = ['PLuc_01_BK_STK']
// Dựng được không (khối nào chưa có bản gốc thì chỉ lưu XML)
export function coTheDungCnkd(xml, motKhoi) {
  const ma = theDon(motKhoi(xml, 'TKhaiThue'), 'maTKhai')
  if (!MAU[ma]) return { duoc: false, lyDo: `chưa có mẫu PDF cho tờ khai mã ${ma}` }
  const ct = motKhoi(xml, 'CTieuTKhaiChinh')
  // Mục B, C chỉ có dòng tổng trong bản gốc — có dòng chi tiết (kê khai TTĐB / tài nguyên thật) thì chưa có mẫu
  const chiTong = k => !String(k).replace(/<(TongCong\w*|soThue\w*|tongCong\w*|ThueTaiNguyen|ThueBVMT|PhiBVMT|tongCT\d+)\b[^>]*>|<\/[^>]+>|-?\d+(?:\.\d+)?|\s+/g, '').length
  if (!chiTong(motKhoi(ct, 'KKhaiThueTTDB')) || !chiTong(motKhoi(ct, 'KKhaiTaiNguyen'))) return { duoc: false, lyDo: '01/CNKD có kê khai thuế TTĐB / tài nguyên / BVMT — chưa có bản gốc để dựng' }
  const kt = motKhoi(ct, 'KhaiThueGTGTTNCN')
  const khoiLa = [...String(kt).matchAll(/<(\w+)[\s>]/g)].map(m => m[1]).filter(t => /^KinhDoanh/.test(t) && !['KinhDoanhDiaDiemCoDinh', 'KinhDoanhTMDT'].includes(t))
  if (khoiLa.length) return { duoc: false, lyDo: `01/CNKD có ${khoiLa[0]} (hoạt động cấp hóa đơn theo lần phát sinh) — chưa có bản gốc để dựng` }
  const pl = motKhoi(xml, 'PLuc')
  const thua = [...new Set([...String(pl).matchAll(/<(PL\w*)[\s>]/g)].map(m => m[1]))].filter(t => !CO_PHU_LUC.includes(t))
  if (thua.length) return { duoc: false, lyDo: `01/CNKD có phụ lục ${thua[0]} — chưa có bản gốc để dựng` }
  return { duoc: true, mau: '01/CNKD' + (/<PLuc_01_BK_STK\b/.test(pl) ? ' + 01/BK-STK' : '') }
}

// Vẽ tờ khai (+ phụ lục 01/BK-STK). C: bộ chữ (taoChu của lib/tokhaiPdfMau.js), d: docChung, mau: màu kẻ.
export async function veCnkd({ pdf, C, d, xml, soMau, motKhoi, the, mau: M }) {
  const tk = motKhoi(xml, 'TKhaiThue'), ma = the(tk, 'maTKhai'), R = MAU[ma]
  const ky = motKhoi(tk, 'KyKKhaiThue'), kieu = the(ky, 'kieuKy'), [kA, kNam] = the(ky, 'kyKKhai').split('/')
  const ct = motKhoi(xml, 'CTieuTKhaiChinh'), hd = motKhoi(ct, 'Header'), kt = motKhoi(ct, 'KhaiThueGTGTTNCN')
  const courier = await pdf.embedFont(StandardFonts.Courier)
  const so = v => (String(v ?? '').trim() === '' ? '' : soMau(v))

  let ds = [], trang = null, y = TREN
  const moTrang = () => { trang = pdf.addPage([W, H]); ds.push(trang); y = TREN }
  const ke = (a, b, c, e, mauNet = M.VIEN_TRONG, day = NET) => trang.drawLine({ start: { x: a, y: H - b }, end: { x: c, y: H - e }, thickness: day, color: mauNet })
  // Một dòng chữ ngoài bảng tại chân chữ `chan`; hết trang thì sang trang (chân chữ dòng đầu 27,64)
  const dongChu = (doan, x, chan, { canh = 'trai', co = CO } = {}) => {
    if (chan + 3 > DAY) { moTrang(); chan = TREN + 7.64 }
    if (canh === 'giua') C.veGiua(trang, doan, x, chan, co); else if (canh === 'phai') C.vePhai(trang, doan, x, chan, co); else C.ve(trang, doan, x, chan, co)
    return chan
  }

  // Bảng: hangs = [[{ c, n?, chu: [[đoạn]], canh, rs? }]] (rs = số hàng gộp, chỉ dùng ở tiêu đề). Cột tự co như bảng HTML của cổng.
  // dau = số hàng tiêu đề — cả khối tiêu đề không vừa trang thì sang trang nguyên khối; hàng thường không vừa thì sang trang nguyên hàng.
  const veBang = (soCot, hangs, { dau = 0 } = {}) => {
    const xc = dongCot(C, soCot, hangs, { X0, X1 })
    // +0,6: cổng giữ 'Doanh thu' một dòng trong ô 52,75 (chữ 46,05) — cùng độ nới với bản KHBS dọc
    const dong = c => (c.chu || []).flatMap(dd => C.ngat(dd, xc[c.c + (c.n || 1)] - xc[c.c] - 2 * DEM + 0.6, CO))
    const cao = hangs.map(h => caoHang(Math.max(1, ...h.filter(c => !c.rs).map(c => dong(c).length))))
    // ô gộp hàng: cao hơn tổng các hàng nó phủ thì hàng cuối nhận phần dư
    hangs.forEach((h, i) => h.filter(c => c.rs).forEach(c => {
      const tong = cao.slice(i, i + c.rs).reduce((a, b) => a + b, 0), can = caoHang(dong(c).length)
      if (can > tong) cao[i + c.rs - 1] += can - tong
    }))
    let dauTrang = y
    const vienNgoai = yc => { ke(X0, dauTrang, X1, dauTrang, M.VIEN_NGOAI); ke(X0, dauTrang, X0, yc, M.VIEN_NGOAI); ke(X1, dauTrang, X1, yc, M.VIEN_NGOAI); ke(X0, yc, X1, yc, M.VIEN_NGOAI) }
    const caoDau = cao.slice(0, dau).reduce((a, b) => a + b, 0)
    if (dau && y + caoDau > DAY) { moTrang(); dauTrang = y }
    hangs.forEach((h, i) => {
      if (i >= dau && y + cao[i] > DAY) { vienNgoai(y); moTrang(); dauTrang = y }
      for (const c of h) {
        const xa = xc[c.c], xb = xc[c.c + (c.n || 1)], ch = c.rs ? cao.slice(i, i + c.rs).reduce((a, b) => a + b, 0) : cao[i]
        ke(xa, y, xb, y); ke(xa, y + ch, xb, y + ch); ke(xa, y, xa, y + ch); ke(xb, y, xb, y + ch)
        const ln = dong(c), y0 = y + (ch - ln.length * DONG) / 2
        ln.forEach((dd, j) => {
          const yy = y0 + LECH + j * DONG
          if (c.canh === 'giua') C.veGiua(trang, dd, (xa + xb) / 2, yy, CO)
          else if (c.canh === 'phai') C.vePhai(trang, dd, xb - DEM, yy, CO)
          else C.ve(trang, dd, xa + DEM, yy, CO)
        })
      }
      y += cao[i]
    })
    vienNgoai(y)
  }
  const o = (c, chu, canh = 'trai', ext = {}) => ({ c, chu: chu == null || chu === '' ? [] : Array.isArray(chu) ? [chu] : [[T(String(chu))]], canh, ...ext })
  const od = (c, s, canh = 'giua', ext = {}) => o(c, [D(s)], canh, ext)
  // Tiêu đề mục ("B. KÊ KHAI…") + "Đơn vị tiền" — cách đáy bảng trước 22,56; đơn vị 17,16; đỉnh bảng 7,94
  const tieuDeMuc = (chu, cach = 22.56) => {
    // tiêu đề + "Đơn vị tiền" không tách trang
    if (y + cach + 17.16 + 3 > DAY) { moTrang(); y = TREN + 7.64 - cach }
    let b = dongChu([D(chu)], 45.42, y + cach)
    b = dongChu([N('Đơn vị tiền: Đồng Việt Nam')], 822.22, b + 17.16, { canh: 'phai' })
    y = b + 7.94
  }
  // Ô "Mẫu số" (khung chữ nhỏ ngắt dòng hẹp): trả đáy khung
  const hopMauSo = (x0, x1, maSo, rong) => {
    const tam = (x0 + x1) / 2
    let b = 32.07
    C.ngat([T('Mẫu số: '), D(maSo)], rong, CO, { html: true }).forEach((dd, j) => { if (j) b += DONG; C.veGiua(trang, dd, tam, b, CO) })
    b += 9.53
    C.ngat([N(R.tt)], rong, CO_NHO, { html: true }).forEach((dd, j) => { if (j) b += 8.896; C.veGiua(trang, dd, tam, b, CO_NHO) })
    trang.drawRectangle({ x: x0, y: H - (b + 3.5), width: x1 - x0, height: b + 3.5 - 20.95, borderColor: M.VIEN_HOP, borderWidth: NET })
    return b + 3.5
  }
  // Cam đoan + khối chữ ký (đo từ chân dòng "Tôi cam đoan" B); trả chân dòng tên người ký
  const camDoan = (cach) => {
    if (y + cach + 112.5 > DAY) moTrang()
    const B = y + cach
    C.ve(trang, [T('Tôi cam đoan những nội dung kê khai trên là đúng và chịu trách nhiệm trước pháp luật về những nội dung đã khai./.')], 45.42, B, CO)
    C.ve(trang, [D('NHÂN VIÊN ĐẠI LÝ THUẾ')], 23.18, B + 27.32, CO)
    C.veGiua(trang, [N(d.ngayKy)], TAM_KY, B + 27.32, CO)
    C.veGiua(trang, [D('NGƯỜI NỘP THUẾ hoặc')], TAM_KY, B + 45.75, CO)
    C.ve(trang, [T('Họ và tên:' + (d.dly.nhanVien ? ' ' + d.dly.nhanVien : ''))], 23.18, B + 51.47, CO)
    C.veGiua(trang, [D('ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ')], TAM_KY, B + 57.83, CO)
    C.ve(trang, [T('Chứng chỉ hành nghề số:' + (d.dly.chungChi ? ' ' + d.dly.chungChi : ''))], 23.18, B + 63.55, CO)
    C.veGiua(trang, [N('(Ký, ghi rõ họ tên/ Ký điện tử)')], TAM_KY, B + 69.9, CO)
    if (d.nguoiKy) C.veGiua(trang, [T(d.nguoiKy)], TAM_KY, B + 112.48, CO)
    y = B + 112.48
  }

  // ── Trang 1: đầu tờ khai ──
  moTrang()
  hopMauSo(214.15, 260.54, '01/CNKD', 43.6)   // ngắt: giữ 'trưởng Bộ Tài' (43,37), không giữ '05/3/2026 của' (43,85)
  C.veGiua(trang, [D('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')], W / 2, 138.84, CO)
  C.veGiua(trang, [D('Độc lập-Tự do-Hạnh phúc')], W / 2, 150.91, CO)
  ke(377.79, 160.0, 464.17, 160.0, M.DEN || M.VIEN_NGOAI, 0.8)
  C.veGiua(trang, [D('TỜ KHAI THUẾ ĐỐI VỚI HỘ KINH DOANH, CÁ NHÂN KINH DOANH')], W / 2, 183.96, CO)
  C.veGiua(trang, [N(R.apDung)], W / 2, 196.03, CO)
  const tick = [['nopThueTNCNDoanhThu', 'Hộ kinh doanh, cá nhân kinh doanh thuộc đối tượng nộp thuế TNCN trên doanh thu tính thuế'],
    ['nopThueTNCNThunhapTinhThue', 'Hộ kinh doanh, cá nhân kinh doanh thuộc đối tượng nộp thuế TNCN trên thu nhập tính thuế'],
    ['hoatDongTMDT', 'Hộ kinh doanh, cá nhân kinh doanh chỉ có hoạt động kinh doanh trên nền tảng thương mại điện tử, nền tảng số khác không có chức năng đặt hàng trực tuyến và chức năng thanh toán'],
    ['hoatDongKhac', 'Hộ kinh doanh, cá nhân kinh doanh khai các loại thuế khác (thuế TTĐB, thuế tài nguyên, thuế/phí bảo vệ môi trường)'],
    ['hoatDongLPS', 'Trường hợp đề nghị cấp hóa đơn điện tử có mã của cơ quan thuế theo lần phát sinh']]
  tick.forEach(([the1, chu], i) => {
    const b = 215.73 + 17.795 * i
    // ô đánh dấu cổng in bằng phông chữ đều (Courier): "[X]" / "[ ]"
    trang.drawText(theDon(hd, the1) === 'true' ? '[X]' : '[ ]', { x: 20, y: H - b, size: CO, font: courier })
    C.ve(trang, [T(chu)], 40.97, b + 1.27, CO)
  })
  const thang = kieu === 'M' ? String(kA).padStart(2, '0') : '', quy = kieu === 'Q' ? String(Number(kA)) : ''
  const cach = (...s) => s.filter(Boolean).join(' ')
  C.ve(trang, [T(cach('[01a] Tháng', thang, 'năm', kieu === 'M' ? kNam : ''))], 261.49, 306.61, CO)
  C.ve(trang, [D('[01]'), T(' Kỳ tính thuế:')], 46.06, 318.68, CO)
  C.ve(trang, [T(cach('[01b] Quý', quy, 'năm', kieu === 'Q' ? kNam : ''))], 261.49, 318.68, CO)
  C.ve(trang, [T(cach('[01c] Lần phát sinh', kieu === 'D' ? ngayVN(the(ky, 'kyKKhaiTuNgay')) : ''))], 261.49, 330.76, CO)
  C.ve(trang, [D('[02]'), T(' Lần đầu:')], 46.06, 344.10, CO)
  C.ve(trang, [D('[03]'), T(' Bổ sung lần thứ:' + (d.soLan ? ' ' + d.soLan : ''))], 261.49, 344.10, CO)
  const uq = motKhoi(hd, 'ToChucNopThueThay')
  const uqT = s => theDon(uq, (String(uq).match(new RegExp(`<(ct\\d+_${s})\\b`)) || [])[1] || 'x_')
  const ngayUq = uqT('2_ngay').match(/^(\d{4})-(\d{2})-(\d{2})/)
  const thongTin = [
    [D('[04] Người nộp thuế:'), T(' ' + d.ten)], [D('[05]'), T(' Mã số thuế: ' + d.mst)],
    [D('[06] Tổ chức/cá nhân khai, nộp thuế thay theo ủy quyền (nếu có):'), T(uqT('ten') ? ' ' + uqT('ten') : '')],
    [D('[06.1]'), T(' Mã số thuế:' + (uqT('1_ma') ? ' ' + uqT('1_ma') : ''))],
    [D('[06.2]'), T(' Văn bản ủy quyền (nếu có): ' + cach('Số', uqT('2_so'), 'ngày', ngayUq?.[3], 'tháng', ngayUq?.[2], 'năm', ngayUq?.[1]))],
    [D('[07] Tên đại lý thuế (nếu có):'), T(d.dly.ten ? ' ' + d.dly.ten : '')], [D('[07.1]'), T(' Mã số thuế:' + (d.dly.mst ? ' ' + d.dly.mst : ''))],
  ]
  let b = 366.35
  for (const doan of thongTin) { C.ngat(doan, 775, CO).forEach((dd, j) => { if (j) b += DONG; C.ve(trang, dd, 46.06, b, CO) }); b += 13.345 }
  y = b - 13.345
  tieuDeMuc('A. KÊ KHAI THÔNG TIN KINH DOANH, DOANH THU', 21.61)

  // ── A. Bảng doanh thu ──
  const nSo = R.so, nCot = 3 + nSo
  const dauA = [
    [od(0, 'STT', 'giua', { rs: 2 }), od(1, 'Nhóm ngành nghề', 'giua', { rs: 2 }), od(2, 'Mã Chỉ tiêu', 'giua', { rs: 2 }),
      od(3, 'Thuế GTGT', 'giua', { n: R.gtgt }), od(3 + R.gtgt, 'Thuế TNCN', 'giua', { n: nSo - R.gtgt })],
    R.dau2.map((s, i) => od(3 + i, s)),
    Array.from({ length: nCot }, (_, i) => od(i, `[${String(8 + i).padStart(2, '0')}]`)),
  ]
  const hangA = []
  const giaTri = r => Array.from({ length: nSo }, (_, i) => { const c = 11 + i; return so(theDon(r, `ct${c}_soThue`) || theDon(r, `ct${c}`)) })
  const dongNhom = (sttDd, rows) => {
    let ds2 = rows.map(r => ({ nhom: theDon(r, 'ct10').replace(/[()]/g, ''), ten: theDon(r, 'ct09_ten'), so: giaTri(r) }))
    if (R.du6) ds2 = NGANH.map(([nh, ten]) => ds2.find(x => x.nhom === nh) || { nhom: nh, ten, so: Array(nSo).fill('0') })
    else ds2.sort((a, b2) => a.nhom.localeCompare(b2.nhom))
    ds2.forEach((x, k) => hangA.push([o(0, `${sttDd}.${k + 1}`, 'giua'), o(1, x.ten), o(2, `(${x.nhom})`, 'giua'), ...x.so.map((s, j) => o(3 + j, s, 'phai'))]))
  }
  const muc = (stt, chu) => hangA.push([od(0, stt), od(1, chu, 'trai', { n: nCot - 1 })])
  const diaDiem = khoi => cacKhoi(khoi, 'DoanhThuThueGTGTTNCN').forEach((dd, i) => {
    const dc = motKhoi(dd, 'diaChi_diaDiemKD')
    const stt = theDon(dd, 'stt') || String(i + 1)
    const nhan = theDon(dd, 'truSoChinh') === 'true' ? 'Trụ sở kinh doanh' : 'Địa điểm kinh doanh'
    hangA.push([o(0, stt, 'giua'), o(1, `${nhan}: ${theDon(dd, 'ma_diaDiemKD')} - ${theDon(dd, 'ten_diaDiemKD')}; ${[theDon(dc, 'diaChi'), theDon(dc, 'ten_xaPhuong'), theDon(dc, 'ten_tinh')].join(', ')}`, 'trai', { n: nCot - 1 })])
    const rows = cacKhoi(dd, 'CTietDoanhThu')
    if (rows.length || R.du6) dongNhom(stt, rows)   // 1240: luôn đủ 6 nhóm (bản cổng in cả địa điểm TMĐT không có dòng nào)
  })
  muc('I', 'Hoạt động sản xuất, kinh doanh hàng hóa, cung cấp dịch vụ có địa điểm kinh doanh cố định')
  diaDiem(motKhoi(kt, 'KinhDoanhDiaDiemCoDinh'))
  muc('II', 'Hoạt động kinh doanh trên nền tảng thương mại điện tử, nền tảng số khác không có chức năng đặt hàng trực tuyến và chức năng thanh toán')
  diaDiem(motKhoi(kt, 'KinhDoanhTMDT'))
  muc('III', 'Hoạt động đã cấp hóa đơn điện tử có mã của cơ quan thuế theo từng lần phát sinh')
  if (R.khungTrong) {
    hangA.push([o(0, '1', 'giua'), o(1, 'Địa điểm kinh doanh: - ; , ,', 'trai', { n: nCot - 1 })])
    hangA.push([o(0, '1.1', 'giua'), o(1, ''), o(2, ''), ...Array.from({ length: nSo }, (_, j) => o(3 + j, '0', 'phai'))])
  }
  const tongK = motKhoi(kt, 'TongCongCT' + R.ma[0]), mienK = motKhoi(kt, 'SoThueMienCT' + R.ma[1]), conK = motKhoi(kt, 'SoThueConPhaiNopCT' + R.ma[2])
  const cTh = R.thue.map(i => 11 + i)   // mã cột thuế GTGT / TNCN
  const tong = Array.from({ length: nSo }, (_, i) => so(theDon(tongK, 'tongCT' + (11 + i))))
  const mien = [so(theDon(mienK, 'soThueDuocMienCT' + cTh[0])), so(theDon(mienK, 'soThueDuocMienCT' + cTh[1]))]
  // Còn phải nộp: XML có thì lấy, khối rỗng (gặp ở bản 1240) thì tổng − miễn
  const conV = (ten, i) => { const v = theDon(conK, ten); return v !== '' ? so(v) : so(Number(theDon(tongK, 'tongCT' + cTh[i]) || 0) - Number(theDon(mienK, 'soThueDuocMienCT' + cTh[i]) || 0)) }
  const con = [conV('soThueGTGT_ct' + cTh[0], 0), conV('soThueTNCN_ct' + cTh[1], 1)]
  const dongThue = (stt, chu, m, gt) => [od(0, stt), od(1, chu, 'trai'), od(2, `[${m}]`), ...Array.from({ length: nSo }, (_, j) => {
    const k = R.thue.indexOf(j)
    return o(3 + j, gt ? gt[j] : k >= 0 ? (stt === 'V' ? mien : con)[k] : '', 'phai')
  })]
  hangA.push(dongThue('IV', 'Tổng cộng', R.ma[0], tong), dongThue('V', 'Số thuế được miễn', R.ma[1]), dongThue('VI', 'Số thuế còn phải nộp', R.ma[2]))
  veBang(nCot, [...dauA, ...hangA], { dau: 3 })

  // ── B. Thuế tiêu thụ đặc biệt ──
  const ttdb = motKhoi(ct, 'KKhaiThueTTDB'), tongB = motKhoi(ttdb, 'TongCongCT' + R.b[0])
  tieuDeMuc('B. KÊ KHAI THUẾ TIÊU THỤ ĐẶC BIỆT')
  const hangB = [
    ['STT', 'Hàng hóa, dịch vụ chịu thuế TTĐB', 'Mã chỉ tiêu', 'Đơn vị tính', 'Doanh thu tính thuế TTĐB', 'Thuế suất', 'Số thuế phải nộp'].map((s, i) => od(i, s)),
    ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)=(5)*(6)'].map((s, i) => od(i, s)),
  ]
  if (R.khungTrong) hangB.push([o(0, 'I', 'giua'), o(1, 'Địa điểm kinh doanh: - ; , ,', 'trai', { n: 6 })], [o(0, '1', 'giua'), o(1, ''), o(2, ''), o(3, ''), o(4, '0', 'phai'), o(5, '0', 'phai'), o(6, '0', 'phai')])
  const soCua = (k, t) => so(theDon(k, t))
  hangB.push(
    [o(0, ''), od(1, 'Tổng cộng', 'trai'), od(2, `[${R.b[0]}]`), o(3, ''), o(4, soCua(tongB, 'tongCT5'), 'phai'), o(5, ''), o(6, soCua(tongB, 'tongCT7'), 'phai')],
    [o(0, ''), od(1, 'Số thuế được miễn', 'trai'), od(2, `[${R.b[1]}]`), o(3, ''), o(4, ''), o(5, ''), o(6, soCua(ttdb, 'soThueMienCT' + R.b[1]), 'phai')],
    [o(0, ''), od(1, 'Số thuế còn phải nộp', 'trai'), od(2, `[${R.b[2]}]`), o(3, ''), o(4, ''), o(5, ''), o(6, soCua(ttdb, 'soThueConPhaiNopCT' + R.b[2]), 'phai')])
  veBang(7, hangB)   // cổng để hàng tiêu đề ở trang trước, hàng (1)…(7) sang trang sau — không giữ khối

  // ── C. Thuế tài nguyên, BVMT, phí BVMT ──
  const tn = motKhoi(ct, 'KKhaiTaiNguyen')
  tieuDeMuc('C. KÊ KHAI THUẾ TÀI NGUYÊN, BẢO VỆ MÔI TRƯỜNG, PHÍ BẢO VỆ MÔI TRƯỜNG')
  const hangC = [
    ['STT', 'Tài nguyên, hàng hóa, sản phẩm', 'Trụ sở kinh doanh/Mã địa điểm kinh doanh', 'Tên địa điểm kinh doanh', 'Mã chỉ tiêu', 'Đơn vị tính', 'Sản lượng/Số lượng',
      'Giá tính thuế tài nguyên/mức thuế hoặc phí BVMT', 'Thuế suất/Hệ số K tính phí BVMT', 'Số thuế/phí phải nộp'].map((s, i) => od(i, s)),
    Array.from({ length: 10 }, (_, i) => od(i, `(${i + 1})`)),
  ]
  for (const [stt, chu, the1] of [['I', 'Khai thuế tài nguyên', 'ThueTaiNguyen'], ['II', 'Khai thuế bảo vệ môi trường', 'ThueBVMT'], ['III', 'Khai phí bảo vệ môi trường đối với khai thác khoáng sản', 'PhiBVMT']]) {
    const k = motKhoi(tn, the1), v = t => so((String(k).match(new RegExp(`<${t}CT\\d+>([^<]*)<`)) || [])[1])
    hangC.push([od(0, stt), od(1, chu, 'trai', { n: 9 })])
    if (R.khungTrong) hangC.push([o(0, '1', 'giua'), ...[1, 2, 3, 4, 5].map(c => o(c, '')), o(6, '0', 'phai'), o(7, '0', 'phai'), o(8, '0', 'phai'), o(9, '0', 'phai')])
    for (const [nhan, t] of [['Tổng cộng', 'tongCong'], ['Số thuế được miễn', 'soThueMien'], ['Số thuế còn phải nộp', 'soThueConPhaiNop']]) hangC.push([o(0, ''), od(1, nhan, 'trai', { n: 8 }), o(9, v(t), 'phai')])
  }
  veBang(10, hangC)

  // ── D. Hỗ trợ tự động thông tin nộp thuế ──
  const ht = motKhoi(ct, 'HoTroThongTinNopThue'), m0 = R.d
  tieuDeMuc('D. HỖ TRỢ TỰ ĐỘNG THÔNG TIN NỘP THUẾ')
  const c_ = i => `ct${m0 + i}`
  const hangD = [
    ['STT', 'Mã địa điểm kinh doanh', 'Nội dung các khoản nộp NSNN', 'Số tiền', 'Chương', 'Tiểu mục', 'Địa bàn hành chính', 'Cơ quan thu', 'Cơ quan thuế', 'Hạn nộp thuế'].map((s, i) => od(i, s)),
    Array.from({ length: 10 }, (_, i) => od(i, `[${m0 + i}]`)),
    ...cacKhoi(ht, 'ChiTietThongTinNopTHue').map((r, i) => [
      o(0, String(i + 1), 'giua'), o(1, theDon(r, c_(1) + '_ma'), 'giua'), o(2, theDon(r, c_(2))), o(3, so(theDon(r, c_(3))), 'phai'),
      o(4, theDon(r, c_(4) + '_ma'), 'giua'), o(5, theDon(r, c_(5) + '_ma'), 'giua'), o(6, ten2(theDon(r, c_(6) + '_maDBHC'), theDon(r, c_(6) + '_tenDBHC')), 'giua'),
      o(7, ten2(theDon(r, c_(7) + '_maCQThu'), theDon(r, c_(7) + '_tenCQThu'))), o(8, ten2(theDon(r, c_(8) + '_maCQThue'), theDon(r, c_(8) + '_tenCQThue'))),
      o(9, ngayVN(theDon(r, c_(9))), 'giua')]),
    [od(0, 'Tổng cộng', 'trai', { n: 3 }), o(3, so((String(ht).match(/<tongTienCT\d+>([^<]*)</) || [])[1]), 'phai'), ...[4, 5, 6, 7, 8, 9].map(c => o(c, ''))],
  ]
  veBang(10, hangD)

  // ── Còn được trừ + cam đoan + chữ ký ──
  const truTiep = theDon(ct, 'soTienTruKyTiep')
  if (y + 14.94 + 17.16 + 112.5 > DAY) moTrang()
  const bTru = y + 14.94
  C.ve(trang, [{ t: `Bạn còn được tiếp tục trừ ${so(truTiep || 0)} đồng vào doanh thu tính thuế TNCN của kỳ tiếp theo`, k: 'dam_nghieng', gach: true }], 45.42, bTru, CO)
  y = bTru
  camDoan(17.16)

  // ── Ghi chú (chảy sang trang) ──
  let g = dongChu([{ t: 'Ghi chú:', k: 'dam_nghieng', gach: true }], 20, y + 15.25)
  const ghiChu = [
    'TNCN: Thu nhập cá nhân', 'GTGT: Giá trị gia tăng', 'TTĐB: Tiêu thụ đặc biệt', 'BVMT: Bảo vệ môi trường',
    '- Chỉ tiêu [01a]: dành cho hộ kinh doanh, cá nhân kinh doanh có doanh thu năm trên 50 tỷ đồng.',
    '- Chỉ tiêu [01b]: dành cho hộ kinh doanh, cá nhân kinh doanh có doanh thu năm trên 500 triệu đồng đến 50 tỷ đồng.',
    '- Chỉ tiêu [01c]: dành cho hộ kinh doanh, cá nhân kinh doanh thực hiện khai và nộp thuế trước khi được cơ quan thuế cấp hóa đơn điện tử có mã của cơ quan thuế theo từng lần phát sinh.',
    '- Số thuế được miễn: là số tiền thuế phát sinh phải nộp được miễn theo mức quy định của Chính phủ.',
    '- Trường hợp hộ kinh doanh, cá nhân kinh doanh nộp thuế thu nhập cá nhân theo phương pháp thuế suất nhân (x) với doanh thu tính thuế thì hộ kinh doanh, cá nhân kinh doanh kê khai doanh thu và số thuế giá trị gia tăng, thuế thu nhập cá nhân phải nộp theo từng địa điểm kinh doanh.',
    '- Trường hợp hộ kinh doanh, cá nhân kinh doanh nộp thuế thu nhập cá nhân theo phương pháp thu nhập tính thuế nhân (x) với thuế suất thì hộ kinh doanh, cá nhân kinh doanh kê khai doanh thu từng địa điểm kinh doanh và thực hiện nộp thuế giá trị gia tăng theo từng địa điểm kinh doanh, tạm nộp thuế thu nhập cá nhân tại trụ sở chính.',
    `- Chỉ tiêu [${R.ctTru}]: Đối với cá nhân kinh doanh nộp thuế thu nhập cá nhân trên doanh thu tính thuế có nhiều ngành, nghề kinh doanh áp dụng thuế suất thuế thu nhập cá nhân khác nhau, có nhiều địa điểm kinh doanh thì được lựa chọn một (01) ngành, nghề hoặc một (01) địa điểm kinh doanh để áp dụng mức trừ ${R.mucTru} trước khi tính thuế thu nhập cá nhân theo phương án có lợi nhất. Trường hợp ngành, nghề, địa điểm kinh doanh được lựa chọn chưa trừ đủ ${R.mucTru}, cá nhân được tiếp tục lựa chọn thêm ngành, nghề, địa điểm kinh doanh khác để tiếp tục được trừ cho đến khi đủ ${R.mucTru}.`,
    '- Chỉ tiêu [3.1], [3.2]…tại khoản III, mục C: bao gồm khoáng sản và đất đá bóc, đất đá thải (nếu có).',
    '- Hệ số K tính phí bảo vệ môi trường đối với khai thác khoáng sản thực hiện theo quy định tại Nghị định số 27/2023/NĐ-CP và các văn bản sửa đổi bổ sung (nếu có).',
  ]
  for (const p of ghiChu) for (const dd of C.ngat([T(p)], 802, CO)) g = dongChu(dd, 20, g + DONG)
  if (g + 9.85 <= DAY) ke(20.95, g + 9.85, 27.31, g + 9.85, M.VACH)
  C.soTrang(ds)

  // ── Phụ lục 01/BK-STK: thông báo số tài khoản (trang riêng, đánh số riêng) ──
  const stk = motKhoi(motKhoi(xml, 'PLuc'), 'PLuc_01_BK_STK')
  if (stk) {
    ds = []
    moTrang()
    hopMauSo(193.81, 235.12, '01/BK-STK', 40)   // ngắt: giữ '18/2026/TT-' (38,1), không giữ 'trưởng Bộ Tài' (43,37)
    C.veGiua(trang, [D('THÔNG BÁO SỐ TÀI KHOẢN/SỐ HIỆU VÍ ĐIỆN TỬ')], W / 2, 150.91, CO)
    C.ve(trang, [D('[01] Người nộp thuế:'), T(' ' + d.ten)], 45.42, 168.07, CO)
    C.ve(trang, [D('[02]')], 45.42, 185.23, CO)
    C.ve(trang, [T('Mã số thuế: ' + d.mst)], 67.66, 185.23, CO)   // cổng để ô [02] rộng hơn chữ
    C.ve(trang, [T('Thông báo về số tài khoản ngân hàng/số hiệu ví điện tử liên quan đến sản xuất, kinh doanh của hộ kinh doanh, cá nhân kinh doanh như sau:')], 45.42, 202.39, CO)
    y = 214.15
    veBang(7, [
      ['STT', 'Tên địa điểm kinh doanh', 'Mã địa điểm kinh doanh', 'Số tài khoản ngân hàng/Số hiệu ví điện tử', 'Tên chủ tài khoản',
        'Mở tại tổ chức cung ứng dịch vụ thanh toán/Tổ chức cung ứng dịch vụ trung gian thanh toán', 'Trạng thái tài khoản (đóng/khai lần đầu/thay đổi thông tin)'].map((s, i) => od(i, s)),
      Array.from({ length: 7 }, (_, i) => od(i, `[${String(3 + i).padStart(2, '0')}]`)),
      ...cacKhoi(stk, 'CTietSTK').map((r, i) => [o(0, String(i + 1), 'giua'), o(1, theDon(r, 'ct04_ten')), o(2, theDon(r, 'ct05_ma'), 'giua'), o(3, theDon(r, 'ct06'), 'giua'),
        o(4, theDon(r, 'ct07')), o(5, theDon(r, 'ct08_ten')), o(6, theDon(r, 'ct09_ten'))]),
    ], { dau: 2 })
    camDoan(14.93)
    C.soTrang(ds)
  }
}
