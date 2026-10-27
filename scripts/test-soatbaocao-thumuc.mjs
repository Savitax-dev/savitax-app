// Bộ kiểm lớp đọc thư mục của Soát xét báo cáo năm (lib/soatbaocao/docThuMuc.js).
//   node scripts/test-soatbaocao-thumuc.mjs
// Cây thư mục GIẢ trong bộ nhớ: tờ khai XML (mẫu giả lập), BCTC XML kiểu HTKK, thông báo / hóa đơn lẻ (phải bỏ qua),
// sổ nhật ký chung Excel, BCTC Excel không ghi năm (năm theo thư mục chứa nó).
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { quetCongTy } from '../lib/phanTich/thuMuc.js'
import { docHoSoSoat, tinhNamSoat, docBang } from '../lib/soatbaocao/docThuMuc.js'
import { caiDomParser } from './lib-dom-node.mjs'
caiDomParser()

let dat = 0, hong = 0
const kiem = (ten, thucTe, mongDoi) => { const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi); if (a === b) dat++; else { hong++; console.log(`  HỎNG ${ten}\n         ra ${a}\n         đáng lẽ ${b}`) } }

const MAU = path.resolve('scripts/du-lieu-mau-phantich/ruiro-mau')
const doc = f => fs.readFileSync(path.join(MAU, f))
const tep = (ten, buf) => ({ name: ten, kind: 'file', getFile: async () => ({ name: ten, size: buf.length, lastModified: 1761400000000, text: async () => buf.toString('utf8'), arrayBuffer: async () => buf }) })
const thu = (ten, ...cac) => ({ name: ten, kind: 'directory', async *entries() { for (const c of cac) yield [c.name, c] } })
const xlsx = (sheets) => { const wb = XLSX.utils.book_new(); for (const [n, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })) }

const bctcXml = nam => Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu><HSoKhaiThue><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>683</maTKhai><tenTKhai>Báo cáo tài chính</tenTKhai><KyKKhaiThue><kieuKy>Y</kieuKy><kyKKhai>${nam}</kyKKhai></KyKKhaiThue></TKhaiThue><NNT><mst>0109999982</mst><tenNNT>CONG TY MAU</tenNNT></NNT></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><CDKT_HoatDongLienTuc><SoCuoiNam><ct100>500</ct100><ct110>500</ct110><ct200>0</ct200><ct270>500</ct270><ct300>100</ct300><ct400>400</ct400><ct440>500</ct440></SoCuoiNam></CDKT_HoatDongLienTuc></CTieuTKhaiChinh><PLuc><PL_KQHDSXKD><NamNay><ct01>1000</ct01><ct10>1000</ct10><ct50>300</ct50><ct51>60</ct51><ct60>240</ct60></NamNay></PL_KQHDSXKD></PLuc></HSoKhaiThue></HSoThueDTu>`)
const thongBao = Buffer.from('<?xml version="1.0"?><TBaoThueDTu><TBaoThue><maTBao>844</maTBao><tenTBao>Thông báo chấp nhận</tenTBao></TBaoThue></TBaoThueDTu>')
const hoaDon = Buffer.from('<?xml version="1.0"?><HDon><DLHDon><TTChung><SHDon>1</SHDon></TTChung></DLHDon></HDon>')
const nkc = xlsx({ 'NKC': [
  ['CÔNG TY TNHH MẪU'], ['SỔ NHẬT KÝ CHUNG'], ['Năm 2025'], [],
  ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Diễn giải', 'Tài khoản', 'TK đối ứng', 'Phát sinh Nợ', 'Phát sinh Có'],
  ['05/03/2025', '05/03/2025', 'PC01', 'Mua văn phòng phẩm', '642', '1111', 1500000, 0],
  ['05/03/2025', '05/03/2025', 'PC01', 'Mua văn phòng phẩm', '1111', '642', 0, 1500000],
  ['10/04/2025', '10/04/2025', 'BC01', 'Khách trả tiền', '1121', '131', 8000000, 0],
  ['10/04/2025', '10/04/2025', 'BC01', 'Khách trả tiền', '131', '1121', 0, 8000000],
  ['20/05/2025', '20/05/2025', 'PC02', 'Chi tiếp khách', '642', '1111', 2000000, 0],
  ['20/05/2025', '20/05/2025', 'PC02', 'Chi tiếp khách', '1111', '642', 0, 2000000],
] })
const bctcExcelKhongNam = xlsx({ 'B01': [['BẢNG CÂN ĐỐI KẾ TOÁN'], ['Chỉ tiêu', 'Mã số', 'Số cuối năm', 'Số đầu năm'], ['Tiền', '110', 500, 400], ['Tổng tài sản ngắn hạn', '100', 500, 400], ['Tổng tài sản dài hạn', '200', 0, 0], ['Tổng cộng tài sản', '270', 500, 400], ['Nợ phải trả', '300', 100, 80], ['Vốn chủ sở hữu', '400', 400, 320], ['Tổng cộng nguồn vốn', '440', 500, 400]] })

const gtgt = (f, ten) => tep(ten || f, doc(f))
const cty = thu('0109999982 MAU', thu('2. HỒ SƠ KẾ TOÁN',
  thu('Năm 2024',
    thu('QUÝ 1.2024', gtgt('0109999982_01GTGT_M01-2024_L0.xml'), gtgt('0109999982_01GTGT_M02-2024_L0.xml')),
    thu('BCTC_2024', tep('BCTC 2024.xml', bctcXml(2024)), tep('Can doi ke toan.xlsx', bctcExcelKhongNam)),
    tep('TBCN.xml', thongBao)),
  thu('Năm 2025',
    // tờ khai 2024 để nhầm trong thư mục 2025 — phải về năm 2024 theo nội dung
    thu('BAOCAOTHUE_Q1_2025', gtgt('0109999982_01GTGT_M03-2024_L0.xml', 'TK lạc.xml'), gtgt('0109999982_01GTGT_M01-2025_L0.xml')),
    thu('2. HÓA ĐƠN MUA VÀO_BÁN RA', tep('hd1.xml', hoaDon)),
    thu('8. SỔ SÁCH KẾ TOÁN', thu('7. SỔ NHẬT KÝ CHUNG', tep('So nhat ky chung 2025.xlsx', nkc))),
    thu('1. HỢP ĐỒNG MUA VÀO_BÁN RA', tep('hop dong.xlsx', xlsx({ A: [['x']] })))),
))

{
  const b = docBang('a.xlsx', nkc)
  kiem('đọc bảng như bản gốc: ngày ra Date, bỏ dòng trống', [b[0].rows.length, b[0].rows[5][0] instanceof Date || typeof b[0].rows[5][0] === 'string'], [10, true])
}
const quet = await quetCongTy(cty, { tuNam: 2000 })
const hs = await docHoSoSoat({ quetTheoNam: quet.nam, homNay: '2026-10-26T03:00:00Z' })
const theo = k => hs.file.filter(f => f.kind === k).map(f => `${f.nam}:${f.ten}`).sort()
kiem('tờ khai về đúng năm theo NỘI DUNG (tờ khai 2024 lạc ở thư mục 2025 về 2024)', theo('tk'), ['2024:0109999982_01GTGT_M01-2024_L0.xml', '2024:0109999982_01GTGT_M02-2024_L0.xml', '2024:TK lạc.xml', '2025:0109999982_01GTGT_M01-2025_L0.xml'])
kiem('BCTC XML + BCTC Excel không ghi năm (theo thư mục) về 2024', theo('bctc'), ['2024:BCTC 2024.xml', '2024:Can doi ke toan.xlsx'])
kiem('sổ nhật ký chung Excel nhận đúng loại, về 2025', hs.file.filter(f => f.kind === 'nkc').map(f => [f.nam, f.n]), [[2025, 6]])
kiem('bỏ qua thông báo + hóa đơn lẻ, không đọc nhánh hợp đồng', [hs.file.some(f => /TBCN|hd1|hop dong/.test(f.ten)), hs.boQua >= 2], [false, true])
kiem('năm có dữ liệu', hs.cacNam, [2025, 2024])
{
  const C = tinhNamSoat(hs.X, 2024), S = hs.X.getS()
  kiem('2024: BCTC XML TT200 đọc đúng tổng tài sản + KQKD (sửa B15, B16), cân đối không báo lệch giả', [S.v.TONG_TS?.t, S.v.DThu?.t, C.C.filter(c => c.st === 'fail').map(c => c.id)], [500, 1000, []])
  const C25 = tinhNamSoat(hs.X, 2025), S25 = hs.X.getS()
  kiem('2025: sổ nhật ký đã vào hồ sơ năm 2025', [S25.meta.nam, (S25.bk.nkc || []).length], [2025, 6])
  void C25
}

console.log(hong ? `\n✗ ${hong} lỗi / ${dat + hong} phép kiểm` : `\n✓ Đạt ${dat}/${dat} phép kiểm`)
process.exit(hong ? 1 : 0)
