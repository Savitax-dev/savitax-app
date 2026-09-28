// Kiểm phần ĐỌC XML tờ khai/thông báo và định dạng số tiền.
//   node scripts/test-tokhai-xml.mjs
//
// Dữ liệu trong đây là BỊA — mã số thuế, tên công ty, tên người đều không thật. Không đưa dữ liệu
// khách thật vào file kiểm, vì file kiểm nằm trong repo.
//
// Đây là chỗ sai âm thầm nhất của cả GĐ 6: đọc lệch một thẻ thì PDF vẫn in ra đẹp đẽ, vẫn đủ trang,
// chỉ có con số là sai — mà kế toán đã gửi khách rồi mới biết.

import { the, cacKhoi, giaiMaThucThe, tachNgay, ngayChu, gioNgayChu, ngaySo, docThongBaoXml, docToKhaiXml, nhanKyToKhai } from '../lib/tokhaiXml.js'
import { soTien, MAU_THONG_BAO } from '../lib/tokhaiPdf.js'
import { laFileNen, moFileNen } from '../lib/tokhaiTaiFileClient.js'
import { tenChiTieu, laSoNguoi } from '../lib/tokhaiChiTieu.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi)
  const dat = a === b
  console.log(`  ${dat ? 'OK   ' : 'HỎNG '}${ten}${dat ? '' : `\n         ra ${a}\n         đáng lẽ ${b}`}`)
  if (!dat) hong++
}

console.log('Đọc thẻ:')
kiem('thẻ thường', the('<a><b>xin chào</b></a>', 'b'), 'xin chào')
kiem('thẻ tự đóng → rỗng', the('<ct09 />', 'ct09'), '')
kiem('thẻ nil → rỗng', the('<diaChi xsi:nil="true"/>', 'diaChi'), '')
kiem('thẻ chỉ có khoảng trắng → rỗng', the('<dthoai>\n   </dthoai>', 'dthoai'), '')
kiem('thẻ không có → rỗng', the('<a><b>1</b></a>', 'zz'), '')
kiem('đọc ct2 KHÔNG trúng ct21', the('<ct21>999</ct21><ct2>7</ct2>', 'ct2'), '7')
kiem('đọc ct25 KHÔNG trúng ct25_1', the('<ct25_1>111</ct25_1><ct25>222</ct25>', 'ct25'), '222')
kiem('thẻ có thuộc tính', the('<CTiet id="1"><x>5</x></CTiet>', 'x'), '5')
kiem('thẻ lồng lấy được thẻ trong', the('<A><B><C>đáy</C></B></A>', 'C'), 'đáy')
kiem('nhiều khối cùng tên', cacKhoi('<P><q>1</q></P><P><q>2</q></P>', 'P').map(k => the(k, 'q')), ['1', '2'])

console.log('')
console.log('Giải mã thực thể:')
kiem('&amp; &lt; &gt;', giaiMaThucThe('A &amp; B &lt;x&gt;'), 'A & B <x>')
kiem('&#272; (Đ)', giaiMaThucThe('&#272;i'), 'Đi')
kiem('&#x110;', giaiMaThucThe('&#x110;i'), 'Đi')
kiem('thực thể lạ giữ nguyên', giaiMaThucThe('&abcxyz;'), '&abcxyz;')

console.log('')
console.log('Ngày tháng (cổng ghi 3 kiểu khác nhau):')
kiem('ISO ngày', tachNgay('2026-04-20'), { nam: '2026', thang: '04', ngay: '20', gio: '', phut: '', giay: '' })
kiem('ISO có giờ + múi giờ', tachNgay('2026-04-20T08:58:40.983+07:00'),
  { nam: '2026', thang: '04', ngay: '20', gio: '08', phut: '58', giay: '40' })
kiem('kiểu Việt dd/mm/yyyy', tachNgay('01/03/2026'), { nam: '2026', thang: '03', ngay: '01', gio: '', phut: '', giay: '' })
kiem('rỗng → null', tachNgay(''), null)
kiem('chuỗi lạ → null', tachNgay('hôm qua'), null)
kiem('ngayChu', ngayChu('2026-04-20'), 'ngày 20 tháng 04 năm 2026')
kiem('gioNgayChu có giờ', gioNgayChu('2026-04-20T08:58:40.983+07:00'), '08 giờ 58 phút ngày 20 tháng 04 năm 2026')
kiem('gioNgayChu không giờ → bỏ phần giờ', gioNgayChu('2026-04-20'), 'ngày 20 tháng 04 năm 2026')
kiem('ngaySo', ngaySo('2026-04-20T17:50:44'), '20/04/2026 17:50:44')
kiem('ngaySo không giờ', ngaySo('2026-04-20'), '20/04/2026')

console.log('')
console.log('Số tiền:')
kiem('232550000', soTien('232550000'), '232.550.000')
kiem('0', soTien('0'), '0')
kiem('100', soTien('100'), '100')
kiem('1000', soTien('1000'), '1.000')
kiem('âm', soTien('-5369039'), '-5.369.039')
kiem('có phần thập phân', soTien('1234.56'), '1.234,56')
kiem('rỗng', soTien(''), '')
kiem('không phải số → giữ nguyên', soTien('n/a'), 'n/a')

// ── Thông báo bịa: 2 hồ sơ để chắc là đọc được nhiều khối ────────────────────
const XML_TBAO = `<?xml version="1.0" encoding="UTF-8"?>
<TBaoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TBaoThue" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <TBaoThue Id="_NODE_TO_SIGN">
  <TTinChung>
   <CQT><maCQT>99999</maCQT><tenCQT>Thuế cơ sở thử nghiệm</tenCQT>
    <DVu><maDVu>088</maDVu><tenDVu>Dịch vụ công thử nghiệm</tenDVu><pbanDVu>1.0.0</pbanDVu></DVu>
   </CQT>
   <NNhanTBaoThue><maNNhan>0000000000</maNNhan><tenNNhan>CÔNG TY THỬ NGHIỆM A &amp; B</tenNNhan>
    <diaChiNNhan xsi:nil="true"/></NNhanTBaoThue>
   <TTinTBaoThue><maTBao>844</maTBao><tenTBao>V/v: Xác nhận nộp hồ sơ thuế điện tử TT19</tenTBao>
    <pbanTBao>2.4.9</pbanTBao><soTBao>111222333/2026/TB-TĐT</soTBao><ngayTBao>2026-04-20</ngayTBao></TTinTBaoThue>
  </TTinChung>
  <NDungTBao>
   <trangThai>Y</trangThai>
   <ngayNopThucTe>2026-04-20T08:58:40.983+07:00</ngayNopThucTe>
   <HoSoThue>
    <CTietHoSoThue id="1"><tokhai-phuluc>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG Mẫu số 01/GTGT</tokhai-phuluc>
     <loaiToKhai>Chính thức</loaiToKhai><kyTinhThue>Q1/2026</kyTinhThue><lanNop>1</lanNop></CTietHoSoThue>
    <CTietHoSoThue id="2"><tokhai-phuluc>PHỤ LỤC BẢNG KÊ</tokhai-phuluc>
     <loaiToKhai>Chính thức</loaiToKhai><kyTinhThue>Q1/2026</kyTinhThue><lanNop>1</lanNop></CTietHoSoThue>
   </HoSoThue>
   <maGiaoDichDTu>10820260019081192</maGiaoDichDTu>
   <ngayChapNhan>2026-04-20T08:58:40.983+07:00</ngayChapNhan>
   <ngayHoanThanh xsi:nil="true"/>
   <LyDo/>
   <duongDan>https://dichvucong.gdt.gov.vn</duongDan>
   <hotline>(08) 00000000</hotline>
  </NDungTBao>
 </TBaoThue>
 <CKyDTu><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><KeyInfo><X509Data>
   <X509SubjectName>CN=CỤC THUẾ,O=BỘ TÀI CHÍNH,L=Hà Nội,C=VN</X509SubjectName>
  </X509Data></KeyInfo>
  <Object><SignatureProperties><SignatureProperty><SigningTime>2026-04-20T17:50:44</SigningTime>
  </SignatureProperty></SignatureProperties></Object></Signature></CKyDTu>
</TBaoThueDTu>`

console.log('')
console.log('Thông báo:')
const tb = docThongBaoXml(XML_TBAO)
kiem('số thông báo', tb.soTBao, '111222333/2026/TB-TĐT')
kiem('mã thông báo', tb.maTBao, '844')
kiem('tên người nộp (có &amp;)', tb.tenNNhan, 'CÔNG TY THỬ NGHIỆM A & B')
kiem('cơ quan thuế', tb.tenCQT, 'Thuế cơ sở thử nghiệm')
kiem('trạng thái', tb.trangThai, 'Y')
kiem('mã giao dịch', tb.maGiaoDichDTu, '10820260019081192')
kiem('đọc được CẢ 2 hồ sơ', tb.hoSo.length, 2)
kiem('hồ sơ 2 đúng tên', tb.hoSo[1].tenToKhai, 'PHỤ LỤC BẢNG KÊ')
kiem('ngayHoanThanh nil → rỗng', tb.ngayHoanThanh, '')
kiem('chủ thể chữ ký số', tb.kySo.chuThe, 'CỤC THUẾ - BỘ TÀI CHÍNH')
kiem('thời điểm ký', ngaySo(tb.kySo.thoiGian), '20/04/2026 17:50:44')

let batLoi = false
try { docThongBaoXml('<HSoThueDTu/>') } catch { batLoi = true }
kiem('đưa tờ khai vào hàm thông báo thì BÁO LỖI', batLoi, true)

// ── Tờ khai bịa: chỉ tiêu có cả thẻ lồng trong nhóm con ─────────────────────
const XML_TKHAI = `<?xml version="1.0" encoding="utf-8"?>
<HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <HSoKhaiThue id="ID_1">
  <TTinChung>
   <TTinDVu><maDVu>HTKK</maDVu><tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu><pbanDVu>5.3.8</pbanDVu></TTinDVu>
   <TTinTKhaiThue>
    <TKhaiThue><maTKhai>842</maTKhai><tenTKhai>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)</tenTKhai>
     <moTaBMau>(Ban hành kèm theo Thông tư số 80/2021/TT-BTC)</moTaBMau>
     <pbanTKhaiXML>2.8.3</pbanTKhaiXML><loaiTKhai>C</loaiTKhai><soLan>0</soLan>
     <KyKKhaiThue><kieuKy>Q</kieuKy><kyKKhai>1/2026</kyKKhai>
      <kyKKhaiTuNgay>01/01/2026</kyKKhaiTuNgay><kyKKhaiDenNgay>31/03/2026</kyKKhaiDenNgay>
      <kyKKhaiTuThang /><kyKKhaiDenThang /></KyKKhaiThue>
     <maCQTNoiNop>99999</maCQTNoiNop><tenCQTNoiNop>Chi cục Thuế thử nghiệm</tenCQTNoiNop>
     <ngayLapTKhai>2026-04-01</ngayLapTKhai>
     <nguoiKy>Người Thử Nghiệm</nguoiKy><ngayKy>2026-04-01</ngayKy></TKhaiThue>
    <NNT><mst>0000000000</mst><tenNNT>CÔNG TY THỬ NGHIỆM</tenNNT>
     <dchiNNT>Số 1 Đường Thử, Phường Thử</dchiNNT><tenHuyenNNT>Quận Thử</tenHuyenNNT>
     <tenTinhNNT>Tỉnh Thử</tenTinhNNT><dthoaiNNT>\n</dthoaiNNT><faxNNT /><emailNNT>\n</emailNNT></NNT>
   </TTinTKhaiThue>
  </TTinChung>
  <CTieuTKhaiChinh>
   <ten_NganhNghe>Hoạt động thử nghiệm</ten_NganhNghe>
   <Header><ct09 /><ct10 /></Header>
   <ct21>0</ct21>
   <ct22>24959079</ct22>
   <GiaTriVaThueGTGTHHDVMuaVao><ct23>103680761</ct23><ct24>5369039</ct24></GiaTriVaThueGTGTHHDVMuaVao>
   <HangHoaDichVuNhapKhau><ct23a>0</ct23a><ct24a>0</ct24a></HangHoaDichVuNhapKhau>
   <ct25>5369039</ct25>
   <ct43>18700618</ct43>
  </CTieuTKhaiChinh>
 </HSoKhaiThue>
 <CKyDTu><Signature><nguoiKy>KHÔNG ĐƯỢC ĐỌC THẺ NÀY</nguoiKy></Signature></CKyDTu>
</HSoThueDTu>`

console.log('')
console.log('Tờ khai:')
const tk = docToKhaiXml(XML_TKHAI)
kiem('mã tờ khai', tk.maTKhai, '842')
kiem('kỳ', [tk.tenKieuKy, tk.kyKKhai].join(' '), 'Quý 1/2026')
kiem('loại tờ khai C → Chính thức', tk.tenLoaiTKhai, 'Chính thức')
kiem('mã số thuế', tk.mst, '0000000000')
kiem('người ký lấy ở TKhaiThue, KHÔNG lấy trong khối chữ ký', tk.nguoiKy, 'Người Thử Nghiệm')
kiem('phần mềm', tk.phanMem, 'HTKK 5.3.8')
kiem('ngành nghề', tk.tenNganhNghe, 'Hoạt động thử nghiệm')
kiem('điện thoại rỗng', tk.dthoaiNNT, '')
kiem('số chỉ tiêu (gồm cả thẻ trong nhóm con)', tk.chiTieu.length, 10)
kiem('thứ tự chỉ tiêu đúng như trong file', tk.chiTieu.map(c => c.ma),
  ['09', '10', '21', '22', '23', '24', '23a', '24a', '25', '43'])
kiem('chỉ tiêu lồng trong nhóm con đọc được', tk.chiTieu.find(c => c.ma === '23')?.gia, '103680761')
kiem('ct09 tự đóng → rỗng', tk.chiTieu.find(c => c.ma === '09')?.gia, '')
kiem('nhãn kỳ quý', nhanKyToKhai({ kieuKy: 'Q', kyKKhai: '1/2026' }), 'Q1/2026')
kiem('nhãn kỳ tháng', nhanKyToKhai({ kieuKy: 'M', kyKKhai: '09/2026' }), 'T09/2026')

console.log('')
console.log('Bảng tên chỉ tiêu:')
kiem('01/GTGT [43]', tenChiTieu('842', '43'), 'Thuế GTGT còn được khấu trừ chuyển kỳ sau')
kiem('01/GTGT [24a] (mã có chữ)', tenChiTieu('842', '24a'), 'Thuế GTGT của hàng hóa, dịch vụ nhập khẩu')
kiem('05/KK-TNCN [15]', tenChiTieu('864', '15'), 'Tổng số người lao động')
kiem('mã chưa gán tên → rỗng, KHÔNG bịa tên', tenChiTieu('864', '29'), '')
kiem('mẫu tờ khai chưa có bảng → rỗng', tenChiTieu('999', '21'), '')
kiem('[15] của TNCN là số người', laSoNguoi('864', '15'), true)
kiem('[26] của TNCN là số tiền', laSoNguoi('864', '26'), false)

// ── Thông báo TIẾP NHẬN khác hẳn thông báo CHẤP NHẬN ────────────────────────
//
// Bản đầu in thông báo TIẾP NHẬN bằng lời văn của thông báo CHẤP NHẬN — tờ giấy khẳng định cơ quan
// thuế "đã chấp nhận" trong khi mới chỉ tiếp nhận (anh phát hiện 28/09). XML tiếp nhận cũng KHÔNG
// có ngayChapNhan lẫn ngayNopThucTe, nên câu văn bị đứt và hiện ra dấu gạch trống.

const XML_TIEP_NHAN = `<?xml version="1.0" encoding="UTF-8"?>
<TBaoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TBaoThue" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <TBaoThue Id="_NODE_TO_SIGN">
  <TTinChung>
   <CQT><maCQT>99999</maCQT><tenCQT>Thuế cơ sở thử nghiệm</tenCQT></CQT>
   <NNhanTBaoThue><maNNhan>0000000000</maNNhan><tenNNhan>CÔNG TY THỬ NGHIỆM</tenNNhan></NNhanTBaoThue>
   <TTinTBaoThue><maTBao>843</maTBao><tenTBao>V/v: Tiếp nhận hồ sơ thuế điện tử TT19</tenTBao>
    <soTBao>1607163409958/2026</soTBao><ngayTBao>2026-07-16</ngayTBao></TTinTBaoThue>
  </TTinChung>
  <NDungTBao>
   <trangThai>Y</trangThai>
   <HoSoThue><CTietHoSoThue id="1">
    <tokhai-phuluc>01/GTGT-TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG Mẫu số 01/GTGT (TT80/2021)</tokhai-phuluc>
    <loaiToKhai>Chính thức</loaiToKhai><kyTinhThue>2/2026</kyTinhThue><lanNop>1</lanNop>
   </CTietHoSoThue></HoSoThue>
   <maGiaoDichDTu>10820260028131888</maGiaoDichDTu>
   <ngayChapNhan xsi:nil="true"/>
   <ngayHoanThanh xsi:nil="true"/>
  </NDungTBao>
 </TBaoThue>
</TBaoThueDTu>`

console.log('')
console.log('Thông báo TIẾP NHẬN (khác thông báo chấp nhận):')
const tn = docThongBaoXml(XML_TIEP_NHAN)
kiem('mã thông báo 843', tn.maTBao, '843')
kiem('KHÔNG có ngày chấp nhận', tn.ngayChapNhan, '')
kiem('KHÔNG có ngày nộp thực tế', tn.ngayNopThucTe, '')
kiem('vẫn có mã giao dịch', tn.maGiaoDichDTu, '10820260028131888')
kiem('843 dùng Mẫu 01-1, KHÔNG dùng lời văn chấp nhận',
  { mau: MAU_THONG_BAO['843'].mau, kieu: MAU_THONG_BAO['843'].kieu },
  { mau: '01-1/TB-TĐT', kieu: 'tiep_nhan' })
kiem('844 mới là mẫu chấp nhận',
  { mau: MAU_THONG_BAO['844'].mau, kieu: MAU_THONG_BAO['844'].kieu },
  { mau: '01-2/TB-TĐT', kieu: 'chap_nhan' })
kiem('mã lạ thì không có mẫu, in dạng bảng', MAU_THONG_BAO['999'] || null, null)

// ── Tờ khai cổng trả về dưới dạng .zip ──────────────────────────────────────
//
// Cổng trả TỜ KHAI trong file nén chỉ chứa đúng một XML, tên bên trong là tên máy vô nghĩa
// ('files_G12.18-260716-00198606_0.xml'). Bản đầu để nguyên .zip nên tờ khai không có PDF nào.

console.log('')
console.log('Mở file nén cổng trả về:')
const { default: PizZip } = await import('pizzip')
const zipThu = new PizZip()
zipThu.file('files_G12.18-260716-00198606_0.xml', XML_TKHAI)
const byteZip = zipThu.generate({ type: 'uint8array' })

kiem('nhận ra file nén qua 2 byte đầu (PK)', laFileNen(byteZip), true)
kiem('không nhầm XML là file nén', laFileNen(new TextEncoder().encode('<?xml')), false)

const phan = await moFileNen(byteZip, 'TK_GTGT_Q2.2026_THINHPHAT.zip')
kiem('mở ra đúng 1 file', phan.length, 1)
kiem('ĐỔI tên máy sang tên chuẩn Savitax, đuôi .xml', phan[0].ten, 'TK_GTGT_Q2.2026_THINHPHAT.xml')
kiem('đánh dấu là file chính để còn dựng PDF', phan[0].laChinh, true)
kiem('nội dung nguyên vẹn', new TextDecoder().decode(phan[0].du).includes('<HSoThueDTu'), true)

// Nhiều file: file chứa hồ sơ thuế mới là file chính, file kèm giữ tên gốc.
const zip2 = new PizZip()
zip2.file('kem_theo.txt', 'ghi chú')
zip2.file('files_G12_0.xml', XML_TKHAI)
const phan2 = await moFileNen(zip2.generate({ type: 'uint8array' }), 'TK_GTGT_Q2.2026_THINHPHAT.zip')
kiem('chọn đúng file chính theo NỘI DUNG, không theo thứ tự',
  phan2.find(p => p.laChinh).ten, 'TK_GTGT_Q2.2026_THINHPHAT.xml')
kiem('file kèm giữ tên gốc để khỏi lẫn',
  phan2.find(p => !p.laChinh).ten, 'TK_GTGT_Q2.2026_THINHPHAT_kem_theo.txt')

let loiNen = ''
try { await moFileNen(new PizZip().generate({ type: 'uint8array' }), 'a.zip') } catch (e) { loiNen = e.message }
kiem('file nén rỗng thì báo lỗi', loiNen, 'file nén rỗng')

console.log(hong === 0 ? '\nTẤT CẢ ĐỀU ĐẠT.' : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
