// Bộ kiểm hàm thuần lib/baoCaoKh.js (báo cáo tình hình kinh doanh gửi khách). node scripts/test-bao-cao-kh.mjs
import assert from 'node:assert/strict'
import {
  phanTichKy, maKy, nhanKy, kyTruoc, khoangKy, kyMacDinh, kyTuTenViec, docSo, chuanHoa, tinh, dauKyTuKyTruoc,
  dongIn, dienLoiNhan, MAU_LOI_NHAN, tenFileAnh, denNgayMacDinh, nhanKetQua,
} from '../lib/baoCaoKh.js'

let n = 0
const ca = (ten, fn) => { fn(); n++; console.log('✓', ten) }

ca('mã kỳ', () => {
  assert.deepEqual(phanTichKy('T09.2026'), { kieu: 'T', so: 9, nam: 2026 })
  assert.deepEqual(phanTichKy('Q4.2026'), { kieu: 'Q', so: 4, nam: 2026 })
  assert.deepEqual(phanTichKy('NAM.2025'), { kieu: 'NAM', so: 0, nam: 2025 })
  assert.equal(phanTichKy('T13.2026'), null)
  assert.equal(maKy('T', 3, 2026), 'T03.2026')
  assert.equal(nhanKy('Q4.2026'), 'Quý 4/2026')
  assert.equal(kyTruoc('T01.2026'), 'T12.2025')
  assert.equal(kyTruoc('Q1.2027'), 'Q4.2026')
  assert.deepEqual(khoangKy('Q4.2026'), { tu: '2026-10-01', den: '2026-12-31' })
  assert.deepEqual(khoangKy('T02.2028'), { tu: '2028-02-01', den: '2028-02-29' })
})

ca('kỳ từ tên việc checklist', () => {
  assert.equal(kyMacDinh('quarterly', 11, 2026), 'Q4.2026')
  assert.equal(kyTuTenViec('Gửi BCT tạm tính tháng 11 (Kèm Bảng kê mua vào + Bán ra)', 11, 2026, 'monthly'), 'T11.2026')
  assert.equal(kyTuTenViec('Gửi báo cáo thuế quý 4 cho khách hàng (Kèm bảng kê mua vào+bán ra)', 1, 2027, 'quarterly'), 'Q4.2026')
  assert.equal(kyTuTenViec('Gửi Báo cáo thuế tạm tính Qúy 1 (Kèm bảng kê mua vào + bán ra)', 2, 2026, 'quarterly'), 'Q1.2026')
  assert.equal(kyTuTenViec('Gửi báo cáo thuế tháng 12 xác nhận với khách hàng', 1, 2027, 'monthly'), 'T12.2026')
})

ca('đọc số', () => {
  assert.equal(docSo('1.657.505.767'), 1657505767)
  assert.equal(docSo('(1,657,505,767)'), -1657505767)
  assert.equal(docSo(''), null)
  assert.equal(chuanHoa({ gtgt_mv: '-5', ln_tt: '-200', la: 9 }).gtgt_mv, 5)
  assert.equal(chuanHoa({ ln_tt: '-200' }).ln_tt, -200)
  assert.equal('la' in chuanHoa({ la: 9 }), false)
})

// Số thật ca Châu Á Q4/2026 (ảnh anh gửi 28/11/2026): khấu trừ 1.657.505.767
const chauA = chuanHoa({ hd_mv_hddt: 464, hd_br: 1589, doanh_so: 3317813212, gtgt_dk: 1892703262, gtgt_mv: 561335930, gtgt_br: 796533425, den_ngay: '2026-11-25' })
ca('tự tính khớp file Excel', () => {
  const v = tinh(chauA)
  assert.equal(v.hd_mv, 464)
  assert.equal(v.gtgt_kq, -1657505767)
  assert.equal(v.ld, null)
  assert.equal(nhanKetQua(v.gtgt_kq), 'Số thuế GTGT còn được khấu trừ')
  assert.equal(dauKyTuKyTruoc(chauA), 1657505767)
  assert.equal(dauKyTuKyTruoc(chuanHoa({ gtgt_br: 100, gtgt_mv: 10 })), 0)
})

ca('dòng in: bỏ dòng tùy chọn trống, dòng năm', () => {
  const d = dongIn('Q4.2026', chauA, {}, { gtgt: '2027-02-01' })
  assert.deepEqual(d.map(x => x.stt), ['1', '1.1', '2', '3', '4', '5', '6', '7'])
  // 1.2, 1.3 = 0 cũng ẩn (anh chốt 28/11); có số thì in
  const co0 = dongIn('Q4.2026', chuanHoa({ hd_mv_hddt: 464, hd_mv_hq: 0, hd_mv_tm: 0 }), {}, {})
  assert.deepEqual(co0.filter(x => x.stt.startsWith('1')).map(x => x.stt), ['1', '1.1'])
  const coHq = dongIn('Q4.2026', chuanHoa({ hd_mv_hddt: 464, hd_mv_hq: 3 }), {}, {})
  assert.deepEqual(coHq.filter(x => x.stt.startsWith('1')).map(x => x.stt), ['1', '1.1', '1.2'])
  assert.equal(coHq.find(x => x.stt === '1').so, 467)
  const kq = d.find(x => x.k === 'gtgt_kq')
  assert.equal(kq.so, 1657505767)
  assert.match(kq.gc, /không phải nộp/)
  const nop = dongIn('T10.2026', chuanHoa({ gtgt_br: 300, gtgt_mv: 100 }), {}, { gtgt: '2026-11-20' }).find(x => x.k === 'gtgt_kq')
  assert.equal(nop.gc, 'Nộp trước ngày 20/11/2026')
  const nam = dongIn('NAM.2025', chuanHoa({ tndn_tt: 1000, tndn_da_nop: 800 }), {}, { tndn: '2026-03-31' })
  assert.equal(nam.find(x => x.k === 'tndn_con_lai').so, 200)
  assert.equal(nam.find(x => x.k === 'tndn_con_lai').gc, 'Nộp trước ngày 31/03/2026')
})

ca('lời nhắn Zalo đúng văn mẫu, không dòng trống', () => {
  const t = dienLoiNhan(MAU_LOI_NHAN, { ky: 'Q4.2026', soLieu: chauA, han: {} })
  assert.match(t, /Báo cáo thuế tạm tính Quý 4\/2026 từ ngày 01\/10\/2026 đến ngày 25\/11\/2026/)
  assert.match(t, /Thuế GTGT mua vào là: 561\.335\.930đ/)
  assert.match(t, /Thuế GTGT bán ra là: 796\.533\.425đ/)
  assert.match(t, /được khấu trừ là: 1\.657\.505\.767đ/)
  assert.ok(!/\n\s*\n/.test(t))
  assert.ok(!t.includes('{'))
})

ca('tên file + ngày mặc định', () => {
  assert.equal(tenFileAnh('Q4.2026', 'Châu Á 01', new Date('2026-11-25T02:30:00Z')), 'BCKD_Q4.2026_CHAUA01_20261125-0930.png')
  assert.equal(denNgayMacDinh('Q4.2026', new Date('2026-11-25T02:00:00Z')), '2026-11-25')
  assert.equal(denNgayMacDinh('Q3.2026', new Date('2026-11-25T02:00:00Z')), '2026-09-30')
})

console.log(`\n${n} nhóm kiểm đều đạt`)
