// BẢN DEMO — sinh BỘ HỒ SƠ MẪU cho Soát xét báo cáo + Rủi ro thuế → public/demo/ho-so-mau.zip
//   node scripts/demo/sinh-ho-so-mau.mjs [--thu-muc <nơi giải nén để xem>]
//
// Một công ty GIẢ của bản demo: CÁT TƯỜNG VIỆT (MST lấy từ lib/demo/sinhDuLieu.js, khai tháng).
//   • 2025: 12 tờ khai 01/GTGT tháng + 03/TNDN + BCTC — lấy từ bộ mẫu giả lập scripts/du-lieu-mau-phantich/ruiro-mau
//     (công ty mẫu 0109999982), chỉ đổi MST / tên / địa chỉ sang công ty demo.
//   • 2026: T01–T09 — tờ khai XML tự khớp công thức, bảng kê cổng HĐĐT (mục 2), bảng kê kèm tờ khai (mục 7),
//     hóa đơn XML mua vào. Cài sẵn vài chỗ sai để app bắt được (ghi ở HƯỚNG DẪN.txt trong file nén).
// Không có dữ liệu thật nào: đối tác MST "88…", tên ghép từ từ điển.
import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { sinhBoDemo } from '../../lib/demo/sinhDuLieu.js'
import cauHinh from '../../lib/demo/cauHinh.js'

const MAU = 'scripts/du-lieu-mau-phantich/ruiro-mau'
const MST_MAU = '0109999982', TEN_MAU = 'CÔNG TY TNHH MẪU RỦI RO'
const { bang } = sinhBoDemo({ now: new Date(), cauHinh })
const CTY = bang.clients.find(c => c.client_code === 'CATTUONGVIET')
if (!CTY || CTY.report_type !== 'monthly') throw new Error('Không thấy công ty CATTUONGVIET khai tháng trong bộ demo')
const MST = CTY.tax_code, TEN = CTY.name, MA = CTY.client_code, DCHI = CTY.address
const GOC = TEN + '/2. HỒ SƠ KẾ TOÁN/'
const zip = new JSZip()
const pad = n => String(n).padStart(2, '0')
const them = (p, noiDung) => zip.file(GOC + p, noiDung)

// ── Đối tác giả ──
const KHACH = [['8830110021', 'CÔNG TY TNHH THƯƠNG MẠI PHÚC HƯNG'], ['8830110039', 'CÔNG TY CỔ PHẦN XÂY LẮP ĐÔNG NAM'], ['8830110047', 'CÔNG TY TNHH NỘI THẤT MINH KHÔI'],
  ['8830110055', 'CÔNG TY TNHH KỸ THUẬT AN BÌNH'], ['8830110063', 'CÔNG TY CỔ PHẦN PHÂN PHỐI SAO VIỆT']]
const NCC = [['8830220014', 'CÔNG TY TNHH VẬT TƯ THÀNH ĐẠT'], ['8830220022', 'CÔNG TY CỔ PHẦN THÉP HÒA AN'], ['8830220030', 'CÔNG TY TNHH VẬN TẢI NAM PHONG'],
  ['8830220048', 'CÔNG TY TNHH THIẾT BỊ ĐIỆN QUANG TÍN']]

// ── 2025: chép bộ mẫu, đổi danh tính ──
const doiTen = s => s.split(MST_MAU).join(MST).split(TEN_MAU).join(TEN)
  .replace(/<dchiNNT>[^<]*<\/dchiNNT>/, '<dchiNNT>' + DCHI + '</dchiNNT>').replace(/<tenTinhNNT>[^<]*</, '<tenTinhNNT>TP Hồ Chí Minh<')
for (const f of fs.readdirSync(MAU)) {
  const m = f.match(/^0109999982_01GTGT_M(\d\d)-2025_L(\d)\.xml$/)
  const q = f.match(/^0109999982_03TNDN_2025_L(\d)\.xml$/)
  const raw = fs.readFileSync(path.join(MAU, f))
  if (m) {
    const bs = +m[2] ? '_BSL' + m[2] : ''
    them(`2025/7. BỘ BÁO CÁO/BỘ BÁO CÁO THUẾ QUÝ_THÁNG/BAOCAOTHUE_T${m[1]}_2025_${MA}${bs}/TỜ KHAI THUẾ/TK_GTGT_T${m[1]}.2025_${MA}${bs}.xml`, doiTen(raw.toString('utf8')))
  } else if (q) them(`2025/7. BỘ BÁO CÁO/BCTC NĂM 2025/TK_TNDN_NAM.2025_${MA}${+q[1] ? '_BSL' + q[1] : ''}.xml`, doiTen(raw.toString('utf8')))
  else if (f === '0109999982_BCTC_TT133_B01a_2025.xlsx') {
    const wb = XLSX.read(raw, { type: 'buffer' })
    for (const ten of wb.SheetNames) for (const [o, cell] of Object.entries(wb.Sheets[ten])) if (!o.startsWith('!') && typeof cell.v === 'string') { cell.v = doiTen(cell.v); if (cell.w) cell.w = doiTen(cell.w); delete cell.h; delete cell.r }
    them(`2025/7. BỘ BÁO CÁO/BCTC NĂM 2025/BCTC_2025_${MA}.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  }
}

// ── 2026: hóa đơn từng tháng ──
let r = 20261
const ngauNhien = () => { r = (r * 16807) % 2147483647; return r / 2147483647 }
const tien = (a, b) => Math.round((a + ngauNhien() * (b - a)) / 1e6) * 1e6
const hd = { ban: [], mua: [] }
let soBan = 0
const soMua = {}
for (let t = 1; t <= 9; t++) {
  const soNgay = new Date(2026, t, 0).getDate()
  const nB = 5, nM = t === 5 ? 6 : 4
  for (let i = 0; i < nB; i++) {
    const k = KHACH[(t + i) % KHACH.length]; const v = tien(500e6, 1400e6)
    hd.ban.push({ thang: t, kyHieu: 'C26TCT', so: ++soBan, ngay: `2026-${pad(t)}-${pad(Math.min(soNgay, 3 + i * 5))}`, doiTac: k, tien: v, thue: v / 10, kps: false })
  }
  for (let i = 0; i < nM; i++) {
    const n = NCC[(t + i) % NCC.length]; const v = t === 5 ? tien(900e6, 1500e6) : tien(600e6, 1200e6)
    soMua[n[0]] = (soMua[n[0]] || 100) + 7
    hd.mua.push({ thang: t, kyHieu: 'C26T' + 'ABCD'[NCC.indexOf(n)] + 'A', so: soMua[n[0]], ngay: `2026-${pad(t)}-${pad(Math.min(soNgay, 2 + i * 6))}`, doiTac: n, tien: v, thue: v / 10, httt: 'Chuyển khoản' })
  }
}
// Chỗ sai cài sẵn
const muaT4 = hd.mua.find(h => h.thang === 4); muaT4.tien = 60e6; muaT4.thue = 6e6; muaT4.httt = 'Tiền mặt'            // T04: mua 66 triệu trả tiền mặt (≥ 5 triệu)
const sotT3 = { ...hd.mua.find(h => h.thang === 3), so: 999, ngay: '2026-03-28', tien: 85e6, thue: 8.5e6, sot: true }; hd.mua.push(sotT3)   // T03: có trên cổng, quên kê khai
const banT6 = { thang: 6, kyHieu: 'C26TCT', so: ++soBan, ngay: '2026-06-30', doiTac: KHACH[2], tien: 120e6, thue: 12e6, sot: true }; hd.ban.push(banT6)  // T06: xuất mà không kê khai
const boSungT8 = { thang: 8, kyHieu: 'C26TCT', so: ++soBan, ngay: '2026-08-29', doiTac: KHACH[4], tien: 210e6, thue: 21e6, boSung: true }; hd.ban.push(boSungT8)  // T08: khai bổ sung

// ── Bảng kê dạng cổng HĐĐT (đúng 19 cột) ──
const TIEU_DE = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng',
  'MST người mua/MST người nhận hàng', 'Tên người mua/Tên người nhận hàng', 'Địa chỉ người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Tổng tiền chiết khấu thương mại',
  'Tổng tiền phí', 'Tổng tiền thanh toán', 'Đơn vị tiền tệ', 'Tỷ giá', 'Trạng thái hóa đơn', 'Kết quả kiểm tra hóa đơn']
const ngayVN = s => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4)
function bangKeCong(ds, chieu, t) {
  const hang = [['DANH SÁCH HÓA ĐƠN'], [`Từ ngày 01/${pad(t)}/2026 đến ngày ${new Date(2026, t, 0).getDate()}/${pad(t)}/2026`], [], [], [], TIEU_DE]
  ds.forEach((h, i) => {
    const ban = chieu === 'ban' ? [MST, TEN] : h.doiTac, mua = chieu === 'ban' ? h.doiTac : [MST, TEN]
    hang.push([i + 1, 1, h.kyHieu, h.so, ngayVN(h.ngay), ban[0], ban[1], mua[0], mua[1], 'TP Hồ Chí Minh', h.tien, h.thue, 0, 0, h.tien + h.thue, 'VND', 1, 'Hóa đơn mới', 'Đã cấp mã hóa đơn'])
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hang), 'sheet 1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
// Bảng kê kèm tờ khai (MV-BR cùng bố cục cổng, 2 sheet)
function bangKeKemTk(ban, mua, t) {
  const wb = XLSX.utils.book_new()
  for (const [ten, ds, chieu] of [['BR', ban, 'ban'], ['MV', mua, 'mua']]) {
    const hang = [['DANH SÁCH HÓA ĐƠN'], [`Kỳ T${pad(t)}/2026 — xuất từ phần mềm kế toán`], [], [], [], TIEU_DE]
    ds.forEach((h, i) => {
      const b = chieu === 'ban' ? [MST, TEN] : h.doiTac, m = chieu === 'ban' ? h.doiTac : [MST, TEN]
      hang.push([i + 1, 1, h.kyHieu, h.so, ngayVN(h.ngay), b[0], b[1], m[0], m[1], 'TP Hồ Chí Minh', h.tien, h.thue, 0, 0, h.tien + h.thue, 'VND', 1, 'Hóa đơn mới', 'Đã cấp mã hóa đơn'])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hang), ten)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
// Hóa đơn điện tử XML (TT78) — mua vào
const xmlHoaDon = h => `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon Id="DLHDon"><TTChung><PBan>2.0.1</PBan><THDon>Hóa đơn giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon><KHHDon>${h.kyHieu}</KHHDon><SHDon>${h.so}</SHDon><NLap>${h.ngay}</NLap><DVTTe>VND</DVTTe><TGia>1</TGia><HTTToan>${h.httt || 'Chuyển khoản'}</HTTToan><MSTTCGP>${h.doiTac[0]}</MSTTCGP></TTChung>
<NDHDon><NBan><Ten>${h.doiTac[1]}</Ten><MST>${h.doiTac[0]}</MST><DChi>TP Hồ Chí Minh</DChi></NBan><NMua><Ten>${TEN}</Ten><MST>${MST}</MST><DChi>${DCHI}</DChi></NMua>
<DSHHDVu><HHDVu><TChat>1</TChat><STT>1</STT><THHDVu>Vật tư, hàng hóa</THHDVu><DVTinh>Lô</DVTinh><SLuong>1</SLuong><DGia>${h.tien}</DGia><ThTien>${h.tien}</ThTien><TSuat>10%</TSuat></HHDVu></DSHHDVu>
<TToan><THTTLTSuat><LTSuat><TSuat>10%</TSuat><ThTien>${h.tien}</ThTien><TThue>${h.thue}</TThue></LTSuat></THTTLTSuat><TgTCThue>${h.tien}</TgTCThue><TgTThue>${h.thue}</TgTThue><TgTTTBSo>${h.tien + h.thue}</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>
`

// ── Tờ khai 01/GTGT (cấu trúc HTKK, tự khớp công thức) ──
function chiTieu({ c22, ban, mua }) {
  const c = { 21: 0, 22: c22, 23: mua.reduce((s, h) => s + h.tien, 0), 24: mua.reduce((s, h) => s + h.thue, 0), '23a': 0, '24a': 0, 26: 0, 29: 0, 30: 0, 31: 0,
    32: ban.reduce((s, h) => s + h.tien, 0), 33: ban.reduce((s, h) => s + h.thue, 0), '32a': 0, 37: 0, 38: 0, '39a': 0, '40b': 0, 42: 0 }
  c[25] = c[24]; c[27] = c[29] + c[30] + c[32] + c['32a']; c[28] = c[31] + c[33]; c[34] = c[26] + c[27]; c[35] = c[28]; c[36] = c[35] - c[25]
  const X = c[36] - c[22] + c[37] - c[38] - c['39a']
  c['40a'] = X > 0 ? X : 0; c[41] = X < 0 ? -X : 0; c[40] = c['40a'] - c['40b']; c[43] = c[41] - c[42]
  return c
}
function xmlToKhai(t, c, lan = 0) {
  const ngay = `2026-${pad(t === 12 ? 12 : t + 1)}-${lan ? 25 : 15}`
  const ct = k => `<ct${k}>${Math.round(c[k])}</ct${k}>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID_1">
    <TTinChung>
      <TTinDVu><maDVu>HTKK</maDVu><tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu><pbanDVu>5.6.6</pbanDVu></TTinDVu>
      <TTinTKhaiThue>
        <TKhaiThue>
          <maTKhai>842</maTKhai><tenTKhai>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)</tenTKhai><pbanTKhaiXML>2.8.3</pbanTKhaiXML>
          <loaiTKhai>${lan ? 'B' : 'C'}</loaiTKhai><soLan>${lan}</soLan>
          <KyKKhaiThue><kieuKy>M</kieuKy><kyKKhai>${pad(t)}/2026</kyKKhai><kyKKhaiTuNgay>01/${pad(t)}/2026</kyKKhaiTuNgay><kyKKhaiDenNgay>${new Date(2026, t, 0).getDate()}/${pad(t)}/2026</kyKKhaiDenNgay></KyKKhaiThue>
          <maCQTNoiNop>79100</maCQTNoiNop><tenCQTNoiNop>Thuế cơ sở 1 TP Hồ Chí Minh</tenCQTNoiNop>
          <ngayLapTKhai>${ngay}</ngayLapTKhai><nguoiKy>NGUYỄN VĂN MẪU</nguoiKy><ngayKy>${ngay}</ngayKy>
        </TKhaiThue>
        <NNT><mst>${MST}</mst><tenNNT>${TEN}</tenNNT><dchiNNT>${DCHI}</dchiNNT><tenTinhNNT>TP Hồ Chí Minh</tenTinhNNT></NNT>
      </TTinTKhaiThue>
    </TTinChung>
    <CTieuTKhaiChinh>
      ${ct(21)}${ct(22)}<GiaTriVaThueGTGTHHDVMuaVao>${ct(23)}${ct(24)}</GiaTriVaThueGTGTHHDVMuaVao><HangHoaDichVuNhapKhau>${ct('23a')}${ct('24a')}</HangHoaDichVuNhapKhau>
      ${ct(25)}${ct(26)}<HHDVBRaChiuThueGTGT>${ct(27)}${ct(28)}</HHDVBRaChiuThueGTGT>${ct(29)}<HHDVBRaChiuTSuat5>${ct(30)}${ct(31)}</HHDVBRaChiuTSuat5>
      <HHDVBRaChiuTSuat10>${ct(32)}${ct(33)}</HHDVBRaChiuTSuat10>${ct('32a')}<TongDThuVaThueGTGTHHDVBRa>${ct(34)}${ct(35)}</TongDThuVaThueGTGTHHDVBRa>
      ${ct(36)}${ct(37)}${ct(38)}${ct('39a')}${ct('40a')}${ct('40b')}${ct(40)}${ct(41)}${ct(42)}${ct(43)}
    </CTieuTKhaiChinh>
  </HSoKhaiThue>
</HSoThueDTu>
`
}

// Thông báo chấp nhận hồ sơ khai thuế (bản rút gọn, đủ để kiểm kê nhận ra)
const xmlThongBao = t => `<?xml version="1.0" encoding="UTF-8"?>
<TBao><TTinChung><maTBao>844</maTBao><tenTBao>Thông báo về việc chấp nhận hồ sơ khai thuế điện tử</tenTBao><ngayTBao>2026-${pad(t + 1)}-16</ngayTBao></TTinChung>
<NNT><mst>${MST}</mst><tenNNT>${TEN}</tenNNT></NNT><NDung>Cơ quan thuế chấp nhận Tờ khai thuế GTGT (01/GTGT) kỳ tháng ${pad(t)}/2026.</NDung></TBao>
`

// [22] tháng 1/2026 = [43] tháng 12/2025 của bộ mẫu
const t12 = fs.readFileSync(path.join(MAU, '0109999982_01GTGT_M12-2025_L0.xml'), 'utf8')
let c43 = Number((t12.match(/<ct43>([^<]*)</) || [])[1] || 0)
const tomTat = []
for (let t = 1; t <= 9; t++) {
  const banCong = hd.ban.filter(h => h.thang === t), muaCong = hd.mua.filter(h => h.thang === t)
  const banKhai = banCong.filter(h => !h.sot && !h.boSung), muaKhai = muaCong.filter(h => !h.sot)
  const kyTm = `THÁNG ${pad(t)}`
  them(`2026/2. HÓA ĐƠN MUA VÀO_BÁN RA/${kyTm}/Bán ra/BANG KE BAN RA T${pad(t)}.2026.xlsx`, bangKeCong(banCong, 'ban', t))
  them(`2026/2. HÓA ĐƠN MUA VÀO_BÁN RA/${kyTm}/Mua vào/BANG KE MUA VAO T${pad(t)}.2026.xlsx`, bangKeCong(muaCong, 'mua', t))
  for (const h of muaCong) them(`2026/2. HÓA ĐƠN MUA VÀO_BÁN RA/${kyTm}/Mua vào/HD_${h.doiTac[0]}_${h.kyHieu}_${h.so}.xml`, xmlHoaDon(h))
  const thuMucKy = `2026/7. BỘ BÁO CÁO/BỘ BÁO CÁO THUẾ QUÝ_THÁNG/BAOCAOTHUE_T${pad(t)}_2026_${MA}`
  const c = chiTieu({ c22: c43, ban: banKhai, mua: muaKhai })
  them(`${thuMucKy}/TỜ KHAI THUẾ/TK_GTGT_T${pad(t)}.2026_${MA}.xml`, xmlToKhai(t, c))
  them(`${thuMucKy}/THÔNG BÁO CHẤP NHẬN/TBCN_GTGT_T${pad(t)}.2026_${MA}.xml`, xmlThongBao(t))
  if (t === 8) {
    const cBs = chiTieu({ c22: c43, ban: banCong.filter(h => !h.sot), mua: muaKhai })
    them(`${thuMucKy}_BSL1/TỜ KHAI THUẾ/TK_GTGT_T08.2026_${MA}_BSL1.xml`, xmlToKhai(t, cBs, 1))
    them(`${thuMucKy}/BẢNG KÊ/BANG KE MV-BR T08.2026.xlsx`, bangKeKemTk(banCong.filter(h => !h.sot), muaKhai, t))
    c43 = cBs[43]
  } else {
    them(`${thuMucKy}/BẢNG KÊ/BANG KE MV-BR T${pad(t)}.2026.xlsx`, bangKeKemTk(banKhai, muaKhai, t))
    c43 = c[43]
  }
  tomTat.push(`T${pad(t)}: bán ${banCong.length} HĐ, mua ${muaCong.length} HĐ, [34] ${c[34].toLocaleString('vi-VN')}, [40] ${c[40].toLocaleString('vi-VN')}, [43] ${c[43].toLocaleString('vi-VN')}`)
}
for (const kps of ['1. HỢP ĐỒNG MUA VÀO_BÁN RA (kps)', '4. TỜ KHAI HẢI QUAN (kps)', '5. BẢO HIỂM XÃ HỘI (kps)', '6. LƯƠNG (kps)']) zip.folder(GOC + '2026/' + kps)

zip.file(TEN + '/HƯỚNG DẪN.txt', `BỘ HỒ SƠ MẪU — BẢN DEMO APP SAVITAX (dữ liệu giả hoàn toàn)

Công ty mẫu: ${TEN} — MST ${MST} — khai thuế GTGT theo THÁNG.

Cách xem (trình duyệt Chrome hoặc Edge trên máy tính):
  1. Giải nén file này ra một thư mục bất kỳ (vd Desktop).
  2. Đăng nhập demo.savitax.vn → menu "Soát xét báo cáo" (hoặc "Rủi ro thuế").
  3. Chọn công ty "${TEN}" → bấm "Trỏ thư mục" → chọn thư mục "${TEN}" vừa giải nén → cho phép xem.
  4. Năm 2026 tự đọc. Muốn xem năm 2025 (Rủi ro thuế, Soát xét năm): bấm "＋ Năm cũ" → chọn thư mục "2. HỒ SƠ KẾ TOÁN\\2025".
App CHỈ ĐỌC — không sửa, không gửi file nào lên máy chủ.

Chỗ sai cài sẵn để app phát hiện:
  • T03/2026: hóa đơn mua vào số 999 có trên bảng kê cổng HĐĐT nhưng chưa kê khai.
  • T04/2026: hóa đơn mua vào 66.000.000đ thanh toán TIỀN MẶT (từ 5 triệu phải chuyển khoản mới được khấu trừ).
  • T06/2026: hóa đơn bán ra cuối tháng đã xuất nhưng không có trên tờ khai / bảng kê kèm tờ khai.
  • T08/2026: tờ khai bổ sung lần 1 (thêm 1 hóa đơn bán ra khai sót) — app lấy bản bổ sung.

${tomTat.join('\n')}
`)

const ra = 'public/demo/ho-so-mau.zip'
fs.mkdirSync(path.dirname(ra), { recursive: true })
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.writeFileSync(ra, buf)
console.log('Đã ghi', ra, Math.round(buf.length / 1024) + ' KB —', Object.keys(zip.files).length, 'mục')
console.log(tomTat.join('\n'))

const i = process.argv.indexOf('--thu-muc')
if (i > 0) {
  const dich = process.argv[i + 1]
  for (const [ten, f] of Object.entries(zip.files)) {
    const p = path.join(dich, ten)
    if (f.dir) { fs.mkdirSync(p, { recursive: true }); continue }
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, await f.async('nodebuffer'))
  }
  console.log('Đã giải nén thử vào', dich)
}
