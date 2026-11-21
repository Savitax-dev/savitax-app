// Bộ kiểm lib/phanTich/traNcc.js — tra cứu tình trạng người bán (Rủi ro thuế → Tra cứu NCC). Chạy offline, dữ liệu giả
// (trừ 2 MST công khai lấy từ ảnh anh gửi 19/11/2026: Savitax, GREEN FOOD).
//   node scripts/test-tra-ncc.mjs
import {
  chuanMstNcc, hoaDonMuaVaoTuSheet, boTrungHoaDon, gomNcc, mucTrangThai, traVietQR, yeuCauTra, docKetQuaTcnnt, chonDongTcnnt,
  conHan, ketQuaNcc, hangExcelNcc,
} from '../lib/phanTich/traNcc.js'

let hong = 0
const kiem = (ten, thucTe, mongDoi) => {
  const ok = JSON.stringify(thucTe) === JSON.stringify(mongDoi)
  if (!ok) hong++
  console.log(`  ${ok ? 'OK  ' : 'HỎNG'} ${ten}${ok ? '' : `\n       ra:  ${JSON.stringify(thucTe)}\n       cần: ${JSON.stringify(mongDoi)}`}`)
}

console.log('MST người bán:')
kiem('Excel mất số 0', chuanMstNcc('313906307'), '0313906307')
kiem('13 số liền → có gạch', chuanMstNcc('0313906307002'), '0313906307-002')
kiem('giữ chi nhánh', chuanMstNcc(' 0313906307-001 '), '0313906307-001')
kiem('số lạ → rỗng', chuanMstNcc('12345'), '')

console.log('\nMức theo chữ trạng thái (Phụ lục I TT 95/2016):')
for (const [chu, muc] of [
  ['NNT đang hoạt động', 'tot'], ['NNT đang hoạt động (được cấp thông báo MST)', 'tot'],
  ['NNT không hoạt động tại địa chỉ đã đăng ký', 'xau'], ['NNT ngừng hoạt động và đã hoàn thành thủ tục chấm dứt hiệu lực MST', 'xau'],
  ['NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục chấm dứt hiệu lực MST', 'xau'], ['NNT vi phạm đã chuyển cơ quan công an', 'xau'],
  ['NNT tạm ngừng KD có thời hạn', 'canh_bao'], ['NNT tạm ngừng hoạt động', 'canh_bao'], ['NNT đã chuyển cơ quan thuế quản lý', 'canh_bao'],
  ['', 'khong_ro'], ['Gì đó lạ', 'khong_ro'],
]) kiem(`"${chu}" → ${muc}`, mucTrangThai(chu), muc)

console.log('\nHóa đơn mua vào từ bảng kê:')
const sheets = [
  { sheet: 'Mua vào', chieu: 'mua_vao', mau: 'cong', hoaDon: [
    { kyHieu: '1C26TAA', so: '12', ngay: '2026-03-01', mstBan: '317550595', tenBan: 'CÔNG TY GIẢ A', tienChuaThue: 1000000, thue: 80000 },
    { kyHieu: '1C26TAA', so: '13', ngay: '2026-03-05', mstBan: '0317550595', tenBan: 'CÔNG TY GIẢ A', tienChuaThue: 2000000, thue: 160000 },
    { kyHieu: '1C26TBB', so: '7', ngay: '2026-02-10', mstBan: '9999000011', tenBan: 'CÔNG TY GIẢ B', tienChuaThue: 500000, thue: 40000 },
    { kyHieu: '1C26TCC', so: '9', ngay: '2026-02-11', mstBan: '', tenBan: 'NGƯỜI BÁN KHÔNG MST', tienChuaThue: 100000, thue: 0 },
  ] },
  { sheet: 'Bán ra', chieu: 'ban_ra', mau: 'cong', hoaDon: [{ so: '1', mstMua: '0313906307', tienChuaThue: 9 }] },
  { sheet: 'Mua vào (phần mềm)', chieu: 'mua_vao', mau: 'pm_x', hoaDon: [{ kyHieu: '1C26TBB', so: '7', ngay: '2026-02-10', mst: '9999000011', ten: 'CÔNG TY GIẢ B', tienChuaThue: 500000, thue: 40000 }] },
]
const hd = boTrungHoaDon(hoaDonMuaVaoTuSheet(sheets, { tenFile: 'bk.xlsx' }))
kiem('chỉ lấy sheet mua vào, bỏ trùng HĐ có ở 2 sheet', hd.map(h => h.so), ['12', '13', '7', '9'])
kiem('bảng kê phần mềm dùng cột MST đối tác', hoaDonMuaVaoTuSheet([sheets[2]])[0].mst, '9999000011')
const { ncc, thieuMst } = gomNcc(hd)
kiem('gom theo MST, sắp theo tiền', ncc.map(n => [n.mst, n.soHd, n.tien]), [['0317550595', 2, 3000000], ['9999000011', 1, 500000]])
kiem('khoảng ngày', [ncc[0].tuNgay, ncc[0].denNgay], ['2026-03-01', '2026-03-05'])
kiem('hóa đơn thiếu MST tách riêng', thieuMst.map(h => h.ten), ['NGƯỜI BÁN KHÔNG MST'])

console.log('\nMẫu nhập bảng kê HTKK (Bang_Ke_01_1_HT1.xls — tiêu đề 2 tầng, tầng dưới chỉ ghi "Số", mỗi mặt hàng một dòng):')
{
  const { docBangKe } = await import('../lib/phanTich/doc/bangKe.js')
  const r = (...o) => [null, ...o]
  const hang = [[], [], r(null, null, null, 'BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HÀNG HOÁ, DỊCH VỤ MUA VÀO'), r(),
    r('STT', 'Hóa đơn, chứng từ nộp thuế', null, null, null, 'Tên người bán', 'Mã số thuế người bán', 'Tên hàng hóa, dịch vụ', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Giá trị HHDV mua vào chưa có thế GTGT', 'Thuế suất (%)', 'Tiền thuế GTGT', 'Ghi chú'),
    r(null, 'Mẫu số', 'Ký hiệu', 'Số', 'Ngày, tháng, năm'), r(),
    r('(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)', '(15)'),
    r('Q1.2026', null, 'C26TAL', 272, '27/01/2026', 'CÔNG TY GIẢ VẬN CHUYỂN', '9999000022', 'Phí chứng từ', 'Bộ', 1, 911600, 911600, 10, 91160),
    r('Q1.2026', null, 'C26TAL', 272, '27/01/2026', 'CÔNG TY GIẢ VẬN CHUYỂN', '9999000022', 'Phí xếp dỡ', 'Cont', 1, 3418500, 3418500, 10, 341850),
    r('Q1.2026', null, 'C26TAQ', 25, '21/01/2026', 'CÔNG TY GIẢ KIỂM NGHIỆM', '9999000033', 'Phí kiểm nghiệm', 'Mẫu', 1, 850000, 850000, 10, 85000),
  ]
  const sh = docBangKe([{ ten: '01', hang }, { ten: 'HDSD', hang: [['STT', 'Tên trường', 'Kiểu dữ liệu']] }])
  kiem('nhận sheet "01", chiều mua vào, 3 dòng', sh.map(s => [s.sheet, s.chieu, s.hoaDon.length]), [['01', 'mua_vao', 3]])
  kiem('đọc đủ số, MST, tiền, thuế', (h => [h.so, h.mst, h.tienChuaThue, h.thue])(sh[0].hoaDon[1]), ['272', '9999000022', 3418500, 341850])
  const hdHtkk = boTrungHoaDon(hoaDonMuaVaoTuSheet(sh, { tenFile: 'Bang_Ke_01_1_HT1.xls' }))
  kiem('giữ đủ dòng mặt hàng của cùng hóa đơn', hdHtkk.length, 3)
  const g = gomNcc(hdHtkk).ncc
  kiem('HĐ 272 hai dòng = 1 hóa đơn, cộng đủ tiền', [g[0].mst, g[0].soHd, g[0].tien, g[0].thue], ['9999000022', 1, 4330100, 433010])
  // cùng hóa đơn có ở file thứ hai → bỏ cả 2 dòng của file sau
  const hai = boTrungHoaDon([...hoaDonMuaVaoTuSheet(sh, { tenFile: 'a.xls' }), ...hoaDonMuaVaoTuSheet(sh, { tenFile: 'b.xls' })])
  kiem('file thứ hai trùng hóa đơn → bỏ', hai.length, 3)
}

console.log('\nVietQR (gọi giả):')
const traLoi = (status, j) => ({ status, json: async () => j })
{
  const ok = traLoi(200, { code: '00', data: { name: 'CÔNG TY GIẢ A', address: 'X', status: 'NNT không hoạt động tại địa chỉ đã đăng ký' }, metadata: { updatedAt: '2026-11-07T00:42:57.000Z' } })
  const kq = await traVietQR('0317550595', { fetchFn: async url => { if (!url.endsWith('/0317550595')) throw new Error(url); return ok }, cho: async () => {} })
  kiem('đọc trạng thái + ngày dữ liệu', [kq.loai, kq.trangThai, kq.capNhat], ['ok', 'NNT không hoạt động tại địa chỉ đã đăng ký', '2026-11-07T00:42:57.000Z'])
  const kq51 = await traVietQR('0000000001', { fetchFn: async () => traLoi(200, { code: '51', desc: 'not found' }), cho: async () => {} })
  kiem('mã 51 → không có MST', kq51.loai, 'khong_co')
  // Đo thật 19/11/2026: ~20 lượt là bị khoá ~10 phút, 429 kèm Retry-After
  const kq429 = await traVietQR('0317550595', { fetchFn: async () => ({ status: 429, headers: new Map([['retry-after', '544']]), json: async () => ({}) }), cho: async () => {} })
  kiem('429 đọc được → bị chặn, kèm số giây chờ', [kq429.loai, kq429.choGiay], ['bi_chan', 544])
  // Trình duyệt: 429 không có header CORS → fetch ném lỗi như mất mạng
  let lan = 0
  const kqNem = await traVietQR('0317550595', { fetchFn: async () => { if (++lan === 1) throw new TypeError('Failed to fetch'); return ok }, cho: async () => {} })
  kiem('ném lỗi một lần → thử lại ngay ra kết quả', [lan, kqNem.loai], [2, 'ok'])
  const kqLoi = await traVietQR('0000000001', { fetchFn: async () => { throw new TypeError('Failed to fetch') }, cho: async () => {} })
  kiem('ném lỗi liên tục → bị chặn (trang tự chờ rồi tra tiếp), không ném', kqLoi.loai, 'bi_chan')
}

console.log('\ntracuunnt (trang giả, bố cục bảng lồng bảng như trang thật):')
kiem('thân POST đúng form của trang', yeuCauTra('0313906307', ' 64ra5 ').body, 'cm=cm&mst=0313906307&fullname=&address=&cmt=&captcha=64ra5')
const trangKq = `<html><body><table width="100%"><tr><td><div id="content">
<form name="myform"><input name="mst"></form>
<table class="ta_border"><tr><th>STT</th><th>MST</th><th>Tên người nộp thuế</th><th>Địa chỉ trụ sở/địa chỉ kinh doanh</th><th>Cơ quan thuế quản lý</th><th>Trạng thái MST</th></tr>
<tr><td>1</td><td><a href="javascript:submitform('0313906307-002')">0313906307-002</a></td><td>VĂN PHÒNG ĐẠI DIỆN ĐỒNG NAI_CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</td><td>tổ 6, ấp 3, Phường Nhơn Trạch, TP Đồng Nai</td><td>Thuế cơ sở 5 thành phố Đồng Nai</td><td>NNT đang hoạt động</td></tr>
<tr><td>2</td><td>0313906307-001</td><td>CHI NHÁNH 1</td><td>104 Chu Văn An</td><td>Thuế cơ sở 14 Thành phố Hồ Chí Minh</td><td>NNT ngừng hoạt động và đã hoàn thành thủ tục chấm dứt hiệu lực MST</td></tr>
<tr><td>3</td><td>0313906307</td><td>CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</td><td>16 Bình Lợi, Phường Bình Lợi Trung, TP Hồ Chí Minh</td><td>Thuế cơ sở 14 Thành phố Hồ Chí Minh</td><td>NNT đang hoạt động</td></tr>
</table></div></td></tr><tr><td>chân trang</td></tr></table></body></html>`
const k = docKetQuaTcnnt(trangKq)
kiem('đọc 3 dòng (công ty + 2 chi nhánh), bỏ hàng chân trang', [k.loai, k.dong?.length], ['ok', 3])
const d = chonDongTcnnt(k.dong, '0313906307')
kiem('chọn đúng dòng MST đang tra', [d.mst, d.cqt, d.trangThai], ['0313906307', 'Thuế cơ sở 14 Thành phố Hồ Chí Minh', 'NNT đang hoạt động'])
kiem('chọn chi nhánh khi tra MST chi nhánh', chonDongTcnnt(k.dong, '0313906307-001').trangThai, 'NNT ngừng hoạt động và đã hoàn thành thủ tục chấm dứt hiệu lực MST')
kiem('bảng tiêu đề nhưng không có dòng → không thấy', docKetQuaTcnnt('<table><tr><th>STT</th><th>MST</th><th>Tên</th><th>Trạng thái MST</th></tr></table>').loai, 'khong_thay')
kiem('trang báo sai mã xác nhận', docKetQuaTcnnt('<p style="color:red">Vui lòng nhập đúng mã xác nhận!</p><input name="captcha">').loai, 'sai_ma')
kiem('trang lạ', docKetQuaTcnnt('<p>Hệ thống bận</p>').loai, 'khong_doc_duoc')

console.log('\nGộp nguồn + hạn + Excel:')
const homNay = Date.parse('2026-11-19T00:00:00Z')
kiem('VietQR tra 10 ngày trước còn hạn 30 ngày', conHan({ luc: '2026-11-09T00:00:00Z' }, 30, homNay), true)
kiem('tra 31 ngày trước hết hạn', conHan({ luc: '2026-10-19T00:00:00Z' }, 30, homNay), false)
const vq = { loai: 'ok', trangThai: 'NNT đang hoạt động', luc: '2026-11-19T01:00:00Z', capNhat: '2026-11-07T00:00:00Z' }
const gdt = { loai: 'ok', trangThai: 'NNT không hoạt động tại địa chỉ đã đăng ký', cqt: 'Thuế cơ sở 14 Thành phố Hồ Chí Minh', luc: '2026-11-19T02:00:00Z' }
kiem('tra chính xác thắng VietQR', [ketQuaNcc(vq, gdt).muc, ketQuaNcc(vq, gdt).cqt], ['xau', 'Thuế cơ sở 14 Thành phố Hồ Chí Minh'])
kiem('chỉ VietQR: không có CQT, ghi ngày dữ liệu', [ketQuaNcc(vq, null).cqt, ketQuaNcc(vq, null).nguon], ['', 'VietQR 19/11/2026 (dữ liệu 07/11/2026)'])
const kqMap = new Map([['0317550595', ketQuaNcc(null, gdt)]])
const x = hangExcelNcc({ tenCty: 'MẪU', hoaDon: hd, ncc, ketQua: kqMap })
kiem('sheet hóa đơn: 3 dòng đầu + 4 hóa đơn', x.hd.length, 7)
kiem('hóa đơn của NCC xấu có trạng thái + CQT', x.hd[3].slice(8, 11), ['NNT không hoạt động tại địa chỉ đã đăng ký', 'Rủi ro', 'Thuế cơ sở 14 Thành phố Hồ Chí Minh'])
kiem('hóa đơn thiếu MST ghi rõ', x.hd[6][8], 'Thiếu MST người bán')
kiem('sheet người bán: 2 NCC', x.nb.length, 4)

console.log(hong ? `\n${hong} kiểm tra HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
