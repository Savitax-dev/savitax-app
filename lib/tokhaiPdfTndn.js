// PDF tờ khai QUYẾT TOÁN THUẾ TNDN — Mẫu 03/TNDN (TT80/2021, maTKhai 892, XML 2.9.x) ĐÚNG MẪU cổng thuế.
// Bản gốc để chép: cổng in ca TEN NOODLES năm 2025 bổ sung lần 1 (anh gửi 21/11/2026): tờ khai 3 trang + phụ lục 03-1A/TNDN
// 2 trang + 03-3A/TNDN 1 trang + 01/KHBS 2 trang + 01-1/KHBS 2 trang. Tờ khai cùng hệ đo với mẫu 01/GTGT bản mới (QUANG):
// chữ 9,95, hàng 18,67, ô Mẫu số + dòng TT80 giống hệt — nên dựng bằng bộ vẽ chung của lib/tokhaiPdfMau.js, ở đây chỉ khai
// báo mẫu (thông tin, các hàng + kiểu chữ từng hàng, ghi chú). Kiểu chữ chép theo bản in: hàng mục chữ cái đậm, "+ …" nghiêng,
// G.1 / G.2 đậm nghiêng; giá trị D2 in đậm như bản cổng.
//
// Hàm nhận bộ công cụ của tokhaiPdfMau (T/D/N, the, motKhoi, soMau) để khỏi import vòng.

export function taoMauTndn({ T, D, N, the, motKhoi, soMau }) {
  const K = (k, t) => ({ t, k })
  // một hàng: STT | chỉ tiêu | mã | số tiền. `kieu` áp cho chỉ tiêu + mã + số (ghi đè từng ô qua o.kieuMa / o.kieuGt / o.kieuStt)
  const h = (stt, chu, ma, gt, kieu = 'thuong', o = {}) => ({
    stt, kieuStt: o.kieuStt ?? 'thuong', canhChu: o.canhChu,
    chu: [K(kieu, chu)],
    o: [
      { c: 2, doan: ma ? [[K(o.kieuMa ?? kieu, ma)]] : [], canh: 'giua', ngat: true },
      { c: 3, doan: gt == null || gt === '' ? [] : [[K(o.kieuGt ?? kieu, gt)]], canh: o.canhGt || 'phai' },
    ],
  })
  const muc = (stt, chu, ma, gt) => h(stt, chu, ma, gt, 'dam', { kieuStt: 'dam' })
  const dam = (stt, chu, ma, gt) => h(stt, chu, ma, gt, 'dam')
  const ngh = (stt, chu, ma, gt, kieuStt = 'thuong') => h(stt, chu, ma, gt, 'nghieng', { kieuStt })
  const NN = 'dam_nghieng'

  return {
    ma: '03/TNDN',
    apDung: '(Áp dụng đối với phương pháp doanh thu - chi phí)',
    rongTieuDe: 420,                     // tên tờ khai 371pt không ngắt (bản cổng một dòng)
    caoDau: 18.64,                       // hàng tiêu đề bảng một dòng
    camDoan: 15.6,                       // đáy bảng → "Tôi cam đoan" (01/GTGT 22,2)
    cot: [20.25, 46.0, 450.9, 518.1, 574.5],
    dongKy: d => [
      [D('[01]'), T(` Kỳ tính thuế: ${d.kyChu} Từ ${d.tuNgay}  đến ${d.denNgay})`)],
      [D('[02]'), T(` Lần đầu: [${d.soLan ? ' ' : 'X'}] `), D('[03]'), T(` Bổ sung lần thứ: [${d.soLan ? d.soLan : ' '}]`)],
    ],
    thongTin: (d, c) => {
      const hd = motKhoi(c, 'Header')
      const tyLe = the(hd, 'ct05')
      return [
        { truoc: 12.5, o: [{ x: 21, doan: [D('[04]'), T(' Ngành nghề có tỷ lệ doanh thu cao nhất: ' + the(hd, 'ct04_ten'))] }] },
        { o: [{ x: 21, doan: [D('[05]'), T(' Tỷ lệ (%): ' + (tyLe ? String(tyLe).replace('.', ',') + ' %' : ''))] }] },
        { o: [{ x: 21, doan: [D('[06] Tên người nộp thuế'), T(': ' + d.ten)] }] },
        { o: [{ x: 21, doan: [D('[07]'), T(' Mã số thuế: ' + d.mst)] }] },
        { truoc: 11.91, o: [{ x: 21, doan: [D('[08] Tên đại lý thuế (nếu có):'), T(' ' + d.dly.ten)] }] },
        { o: [{ x: 21, doan: [D('[09]'), T(' Mã số thuế: ' + d.dly.mst)] }] },
        { o: [{ x: 21, x1: 331, doan: [D('[10]'), T('  Hợp đồng đại lý thuế: Số ' + d.dly.soHd)] }, { x: 333.4, doan: [T('Ngày: ' + d.dly.ngayHd)] }], sau: 1.95 },
      ]
    },
    dauBang: [{ c: 0, doan: [[D('STT')]] }, { c: 1, doan: [[D('Chỉ tiêu')]] }, { c: 2, doan: [[D('Mã chỉ tiêu')]] }, { c: 3, doan: [[D('Số tiền')]] }],
    hang: c => {
      const v = k => soMau(the(c, 'ct' + k))
      const mien = [...String(motKhoi(c, 'dsThMienThue')).matchAll(/<thMienThue\b[\s\S]*?<\/thMienThue>/g)].map(m => m[0])
      return [
        h('(1)', '(2)', '(3)', '(4)', 'nghieng', { kieuStt: 'nghieng', canhChu: 'giua', canhGt: 'giua' }),
        muc('A', 'Kết quả kinh doanh ghi nhận theo báo cáo tài chính', 'A'),
        h('1', 'Tổng lợi nhuận kế toán trước thuế thu nhập doanh nghiệp', 'A1', v('A1')),
        muc('B', 'Xác định thu nhập chịu thuế theo Luật thuế thu nhập doanh nghiệp', 'B'),
        dam('1', 'Điều chỉnh tăng tổng lợi nhuận trước thuế thu nhập doanh nghiệp (B1= B2+B3+B4+B5+B6+B7)', 'B1', v('B1')),
        h('1.1', 'Các khoản điều chỉnh tăng doanh thu', 'B2', v('B2')),
        h('1.2', 'Chi phí của phần doanh thu điều chỉnh giảm', 'B3', v('B3')),
        h('1.3', 'Các khoản chi không được trừ khi xác định thu nhập chịu thuế', 'B4', v('B4')),
        h('1.4', 'Thuế thu nhập đã nộp cho phần thu nhập nhận được ở nước ngoài', 'B5', v('B5')),
        h('1.5', 'Điều chỉnh tăng lợi nhuận do xác định giá thị trường đối với giao dịch liên kết', 'B6', v('B6')),
        h('1.6', 'Các khoản điều chỉnh làm tăng lợi nhuận trước thuế khác', 'B7', v('B7')),
        dam('2', 'Điều chỉnh giảm tổng lợi nhuận trước thuế thu nhập doanh nghiệp (B8=B9+B10+B11+B12)', 'B8', v('B8')),
        h('2.1', 'Giảm trừ các khoản doanh thu đã tính thuế năm trước', 'B9', v('B9')),
        h('2.2', 'Chi phí của phần doanh thu điều chỉnh tăng', 'B10', v('B10')),
        h('2.3', 'Chi phí lãi vay không được trừ kỳ trước được chuyển sang kỳ này của doanh nghiệp có giao dịch liên kết', 'B11', v('B11')),
        h('2.4', 'Các khoản điều chỉnh làm giảm lợi nhuận trước thuế khác', 'B12', v('B12')),
        dam('3', 'Tổng thu nhập chịu thuế (B13=A1+B1-B8)', 'B13', v('B13')),
        h('3.1', 'Thu nhập chịu thuế từ hoạt động sản xuất kinh doanh', 'B14', v('B14')),
        h('3.2', 'Thu nhập chịu thuế từ hoạt động chuyển nhượng BĐS', 'B15', v('B15')),
        muc('C', 'Thuế thu nhập doanh nghiệp (TNDN) phải nộp từ hoạt động sản xuất kinh doanh', ''),
        h('1', 'Thu nhập chịu thuế (C1 = B14)', 'C1', v('C1')),
        h('2', 'Thu nhập miễn thuế', 'C2', v('C2')),
        // danh sách thu nhập miễn thuế: bản cổng in số tiền (canh giữa) rồi dòng "Loại thu nhập miễn thuế"
        ...mien.map(m => h('', the(m, 'ten_loaiMien') || '', '', soMau(the(m, 'ctC2_soThuNhap')), 'thuong', { canhGt: 'giua' })),
        h('', 'Loại thu nhập miễn thuế', '', ''),
        h('3', 'Chuyển lỗ và bù trừ lãi, lỗ (C3=C3a+C3b)', 'C3', v('C3')),
        h('', 'Trong đó:', '', ''),
        ngh('3.1', '+ Lỗ từ hoạt động SXKD được chuyển trong kỳ', 'C3a', v('C3a')),
        ngh('3.2', '+ Lỗ từ chuyển nhượng BĐS được bù trừ với lãi của hoạt động SXKD', 'C3b', v('C3b')),
        h('4', 'Thu nhập tính thuế (TNTT) (C4=C1-C2-C3)', 'C4', v('C4')),
        h('5', 'Trích lập quỹ khoa học công nghệ (nếu có)', 'C5', v('C5')),
        h('6', 'TNTT sau khi đã trích lập quỹ khoa học công nghệ (C6=C4-C5=C7+C8)', 'C6', v('C6')),
        h('', 'Trong đó:', '', ''),
        ngh('6.1', the(c, 'ctC7_tenThueSuat') || '+ Thu nhập tính thuế áp dụng thuế suất 20%', 'C7', v('C7_thuNhap'), 'nghieng'),
        ngh('6.2', '+ Thu nhập tính thuế tính theo thuế suất không ưu đãi khác', 'C8', v('C8'), 'nghieng'),
        ngh('6.3', '+ Thuế suất không ưu đãi khác (%)', 'C8a', v('C8a'), 'nghieng'),
        h('7', 'Thuế TNDN từ hoạt động SXKD tính theo thuế suất không ưu đãi(C9 =(C7 x 20%) + (C8 x C8a))', 'C9', v('C9')),
        h('8', 'Thuế TNDN được ưu đãi theo Luật thuế TNDN(C10 = C11 + C12 + C13)', 'C10', v('C10')),
        h('', 'Trong đó:', '', ''),
        ngh('8.1', '+ Thuế TNDN chênh lệch do áp dụng mức thuế suất ưu đãi', 'C11', v('C11'), 'nghieng'),
        ngh('8.2', '+ Thuế TNDN được miễn trong kỳ', 'C12', v('C12'), 'nghieng'),
        ngh('8.3', '+ Thuế TNDN được giảm trong kỳ', 'C13', v('C13'), 'nghieng'),
        h('9', 'Thuế TNDN được miễn, giảm theo Hiệp định thuế', 'C14', v('C14')),
        h('10', 'Thuế TNDN được miễn, giảm theo từng thời kỳ', 'C15', v('C15')),
        h('11', 'Thuế thu nhập đã nộp ở nước ngoài được trừ trong kỳ tính thuế', 'C16', v('C16')),
        h('12', 'Thuế TNDN phải nộp của hoạt động sản xuất kinh doanh(C17=C9-C10-C14-C15-C16)', 'C17', v('C17')),
        muc('D', 'Thuế TNDN phải nộp từ hoạt động chuyển nhượng BĐS', 'D'),
        h('1', 'Thu nhập chịu thuế (D1 = B15)', 'D1', v('D1')),
        h('2', 'Lỗ từ hoạt động chuyển nhượng BĐS được chuyển trong kỳ', 'D2', v('D2'), 'thuong', { kieuGt: 'dam' }),
        h('3', 'Thu nhập tính thuế (D3=D1-D2)', 'D3', v('D3')),
        h('4', 'Trích lập quỹ khoa học công nghệ (nếu có)', 'D4', v('D4')),
        h('5', 'TNTT sau khi đã trích lập quỹ khoa học công nghệ (D5=D3-D4)', 'D5', v('D5')),
        h('6', 'Thuế TNDN phải nộp của hoạt động chuyển nhượng BĐS trong kỳ', 'D6', v('D6')),
        h('7', 'Thuế TNDN chênh lệch do áp dụng mức thuế suất ưu đãi đối với thu nhập từ thực hiện dự án đầu tư - kinh doanh nhà ở xã hội để bán, cho thuê, cho thuê mua', 'D7', v('D7')),
        h('8', 'Thuế TNDN của hoạt động chuyển nhượng BĐS còn phải nộp kỳ này (D8=D6-D7)', 'D8', v('D8')),
        muc('E', 'Số thuế TNDN phải nộp quyết toán trong kỳ (E=E1+E2+E5)', 'E', v('E')),
        h('1', 'Thuế TNDN của hoạt động sản xuất kinh doanh', 'E1', v('E1')),
        h('2', 'Thuế TNDN từ hoạt động chuyển nhượng bất động sản (E2=E3+E4)', 'E2', v('E2')),
        ngh('2.1', 'Thuế TNDN từ hoạt động chuyển nhượng bất động sản', 'E3', v('E3'), 'nghieng'),
        ngh('2.2', 'Thuế TNDN từ hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ', 'E4', v('E4'), 'nghieng'),
        h('3', 'Thuế TNDN phải nộp khác (nếu có)', 'E5', v('E5')),
        ngh('3.1', 'Trong đó thuế TNDN từ xử lý Quỹ phát triển khoa học công nghệ', 'E6', v('E6'), 'nghieng'),
        muc('G', 'Số thuế TNDN đã tạm nộp (G=G1+G2+G3+G4+G5)', 'G', v('G')),
        h('1', 'Thuế TNDN đã tạm nộp của hoạt động sản xuất kinh doanh', '', soMau(the(c, 'thueTNDN_tamnop_sxkd')), NN, { kieuStt: NN }),
        h('1.1', 'Thuế TNDN nộp thừa kỳ trước chuyển sang kỳ này', 'G1', v('G1')),
        h('1.2', 'Thuế TNDN đã tạm nộp trong năm', 'G2', v('G2')),
        h('2', 'Thuế TNDN đã tạm nộp của hoạt động chuyển nhượng BĐS', '', soMau(the(c, 'thueTNDN_tamnop_cnbds')), NN, { kieuStt: NN }),
        h('2.1', 'Thuế TNDN nộp thừa kỳ trước chuyển sang kỳ này của hoạt động chuyển nhượng BĐS', 'G3', v('G3')),
        h('2.2', 'Thuế TNDN đã tạm nộp trong năm của hoạt động chuyển nhượng BĐS', 'G4', v('G4')),
        h('2.3', 'Thuế TNDN đã tạm nộp các kỳ trước và trong năm quyết toán của hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ', 'G5', v('G5')),
        muc('H', 'Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp', 'H'),
        h('1', 'Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp trong năm của hoạt động sản xuất kinh doanh (H1=E1+E5-G2)', 'H1', v('H1')),
        h('2', 'Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp trong năm của hoạt động chuyển nhượng BĐS (H2=E3-G4)', 'H2', v('H2')),
        h('3', 'Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp của hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ (H3=E4-G5)', 'H3', v('H3')),
        muc('I', 'Số thuế TNDN còn phải nộp đến thời hạn nộp hồ sơ khai quyết toán thuế (I=E-G=I1+I2)', 'I', v('I')),
        h('1', 'Thuế TNDN còn phải nộp của hoạt động sản xuất kinh doanh', 'I1=E1+E5-G1-G2', v('I1')),
        h('2', 'Thuế TNDN còn phải nộp của hoạt động chuyển nhượng BĐS', 'I2=E2-G3-G4-G5', v('I2')),
      ]
    },
    // Ghi chú: một dòng trống rồi 10 đoạn (thụt đầu dòng, tự ngắt như trình duyệt cổng — mép phải 578,3 như 01/GTGT TT89)
    ghiChu: (C, xml) => {
      const nv = motKhoi(xml, 'NghiaVuThue')
      const tm = k => soMau(the(nv, 'tong' + k) || '0')
      const doan = [
        '1. TNDN: Thu nhập doanh nghiệp; BĐS: Bất động sản;',
        '2. Chỉ tiêu G1, G3: NNT kê khai số thuế TNDN nộp thừa kỳ trước chuyển sang bù trừ với số thuế TNDN phải nộp kỳ này',
        '3. Chỉ tiêu D11, G2, G4, G5: NNT kê khai số thuế TNDN đã tạm nộp vào NSNN tính đến thời hạn nộp hồ sơ khai quyết toán. Ví dụ: NNT có kỳ tính thuế từ 01/01/2021 đến 31/12/2021 thì số thuế TNDN đã tạm nộp trong năm là số thuế TNDN đã nộp cho kỳ tính thuế năm 2021 tính từ ngày 01/01/2021 đến hết ngày 31/3/2022.',
        '4. Trường hợp NNT là doanh nghiệp xổ số có hoạt động sản xuất kinh doanh khác hoạt động kinh doanh xổ số thì NNT kê khai số thuế TNDN phải nộp của hoạt động kinh doanh xổ số vào chỉ tiêu E1, số thuế TNDN phải nộp của hoạt động sản xuất kinh doanh khác vào chỉ tiêu E2, E3.',
        '5. Các chỉ tiêu E, G: NNT không kê khai số thuế TNDN phải nộp, đã tạm nộp của hoạt động được hưởng ưu đãi khác tỉnh đã kê khai riêng.',
        '6. Chỉ tiêu E4, G5, H3: NNT kê khai số thuế TNDN phải nộp, đã tạm nộp của hoạt động chuyển nhượng cơ sở hạ tầng, nhà được bàn giao kỳ này và có thu tiền ứng trước của khách hàng theo tiến độ (bao gồm số tiền đã thu của các kỳ trước và kỳ này).',
        `7. Hạch toán số tiền ${tm(1052)} vào tiểu mục 1052: Thuế thu nhập doanh nghiệp từ hoạt động sản xuất kinh doanh (gồm cả dịch vụ trong lĩnh vực dầu khí)`,
        `8. Hạch toán số tiền ${tm(1056)} vào tiểu mục 1056: Thuế thu nhập doanh nghiệp từ hoạt động thăm dò, phát triển mỏ và khai thác dầu, khí thiên nhiên (không kể thuế thu nhập doanh nghiệp thu theo hiệp định, hợp đồng thăm dò, khai thác dầu khí)`,
        `9. Hạch toán số tiền ${tm(1057)} vào tiểu mục 1057: Thuế thu nhập doanh nghiệp từ hoạt động xổ số kiến thiết`,
        `10. Hạch toán số tiền ${tm(1053)} vào tiểu mục 1053: Thuế thu nhập doanh nghiệp từ chuyển nhượng bất động sản`,
      ]
      return ['', ...doan.flatMap(s => C.ngat([N('  ' + s)], 578.3 - 21).map(dd => dd.map(x => x.t).join('')))]
    },
  }
}

// ── Phụ lục 03-1A/TNDN — Kết quả hoạt động sản xuất kinh doanh (ngành sản xuất, thương mại, dịch vụ) ─────────────────
// Đo từ bản cổng in TEN NOODLES 2025 (trang 4–5): tiêu đề canh 270,2; ô Mẫu số hẹp 521,4–574,3 chữ cỡ thường (dòng 11,82);
// bảng 20,3 · 50,4 · 434,3 · 499 · 574,8; số tiền luôn chữ thường, STT / chỉ tiêu / mã của hàng in đậm thì đậm. Khối chữ
// ký kiểu CŨ (TT80 bản đầu): tâm 392,2, "(Chữ ký, ghi rõ họ tên; chức vụ và đóng dấu (nếu có)/Ký điện tử)", sau tên là gạch
// chân + "Ghi chú: Số liệu chỉ tiêu [22]…" + vạch + dòng chữ ký số. Khối này không cắt trang (bản cổng dời sang trang 2).
export function vePhuLuc031A({ b, d, xml, soMau, the, motKhoi, T, D, N, VACH }) {
  const pl = motKhoi(xml, 'PLuc_03_1A_TNDN')
  if (!pl) return
  const v = k => soMau(the(pl, 'ct' + k))
  b.moTrang()
  const TAM = 270.2
  b.ve([D('PHỤ LỤC')], TAM, 30.0, 'giua')
  b.ve([D('KẾT QUẢ HOẠT ĐỘNG SẢN XUẤT KINH DOANH')], TAM, 43.08, 'giua')
  b.doan([D('Áp dụng đối với ngành sản xuất, thương mại, dịch vụ (trừ công ty an ninh, quốc phòng)')], TAM, 56.04, 350, { canh: 'giua', buoc: 11.88 })
  b.ve([N('(Kèm theo tờ khai quyết toán thuế thu nhập doanh nghiệp số 03/TNDN)')], TAM, 81.0, 'giua')
  b.ve([D('[01]'), T(' Kỳ tính thuế: ' + d.kyChu)], TAM, 128.88, 'giua')
  // Ô Mẫu số: chữ cỡ thường, ngắt cả sau dấu '-' ("Mẫu số: 03-" / "1A/TNDN", "80/2021/TT-" / "BTC ngày")
  const { C } = b
  const dongHop = [
    ...C.ngat([T('Mẫu số: '), D('03-1A/TNDN')], 49.9, 10, { sauGach: true }),
    ...C.ngat([T('('), N('Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính'), T(')')], 49.9, 10, { sauGach: true }),
  ].map(doan => ({ doan }))
  b.hopMauSo(521.4, 574.3, 20.88, dongHop, 11.82)
  b.ve([D('[02] Tên người nộp thuế:'), T(' ' + d.ten)], 20.9, 176.76)
  b.ve([D('[03]'), T(' Mã số thuế: ' + d.mst)], 20.9, 189.84)
  b.ve([N('Đơn vị tiền: Đồng Việt Nam')], 573.6, 204.12, 'phai')
  b.y = 208.8
  const cot = [20.25, 50.4, 434.25, 498.95, 574.8]
  const o = (c, t, k = 'thuong', canh) => ({ c, doan: t ? [[{ t, k }]] : '', canh })
  const h = (stt, chu, ma, gt, dam = false) => [o(0, stt, dam ? 'dam' : 'thuong', 'giua'), o(1, chu, dam ? 'dam' : 'thuong'), o(2, ma, dam ? 'dam' : 'thuong', 'giua'), o(3, gt, 'thuong', 'phai')]
  b.bang(cot, [
    [o(0, 'STT', 'dam', 'giua'), o(1, 'Chỉ tiêu', 'dam', 'giua'), o(2, 'Mã chỉ tiêu', 'dam', 'giua'), o(3, 'Số tiền', 'dam', 'giua')],
    [o(0, '(1)', 'nghieng', 'giua'), o(1, '(2)', 'nghieng', 'giua'), o(2, '(3)', 'nghieng', 'giua'), o(3, '(4)', 'nghieng', 'giua')],
    h('', 'Kết quả kinh doanh ghi nhận theo báo cáo tài chính:', '', '', true),
    h('1', 'Doanh thu bán hàng và cung cấp dịch vụ', '[04]', v('04'), true),
    h('', 'Trong đó: - Doanh thu bán hàng hoá, dịch vụ xuất khẩu', '[05]', v('05')),
    h('2', 'Các khoản giảm trừ doanh thu ([06]=[07]+[08]+[09])', '[06]', v('06'), true),
    h('a', 'Chiết khấu thương mại', '[07]', v('07')),
    h('b', 'Giảm giá hàng bán', '[08]', v('08')),
    h('c', 'Giá trị hàng bán bị trả lại', '[09]', v('09')),
    h('3', 'Doanh thu hoạt động tài chính', '[10]', v('10'), true),
    h('', 'Trong đó: Doanh thu từ lãi tiền gửi', '[11]', v('11')),
    h('4', 'Chi phí sản xuất, kinh doanh hàng hoá, dịch vụ ([12]=[13]+[14]+[15])', '[12]', v('12'), true),
    h('a', 'Giá vốn hàng bán', '[13]', v('13')),
    h('b', 'Chi phí bán hàng', '[14]', v('14')),
    h('c', 'Chi phí quản lý doanh nghiệp', '[15]', v('15')),
    h('5', 'Chi phí tài chính', '[16]', v('16'), true),
    h('', 'Trong đó: Chi phí lãi tiền vay', '[17]', v('17')),
    h('6', 'Lợi nhuận thuần từ hoạt động kinh doanh([18]=[04]-[06]+[10]-[12]-[16])', '[18]', v('18'), true),
    h('7', 'Thu nhập khác', '[19]', v('19'), true),
    h('8', 'Chi phí khác', '[20]', v('20'), true),
    h('9', 'Lợi nhuận khác ([21]=[19]-[20])', '[21]', v('21'), true),
    h('10', 'Tổng lợi nhuận kế toán trước thuế thu nhập doanh nghiệp ([22]=[18]+[21])', '[22]', v('22'), true),
  ])
  // Cam đoan + chữ ký (kiểu cũ) — một khối
  const CAO = 21.5 + 157.68 + (d.chuKy ? 17.76 + 2 * 11.8 + 4 : 4)
  if (b.y + CAO > 812) b.moTrang()
  const B = b.y + 21.5, TK = 392.2
  b.ve([T('Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về số liệu đã khai./...')], 25.8, B)   // bản cổng thụt 2 dấu cách
  b.ve([N(d.ngayKy)], TK, B + 26.76, 'giua')
  b.ve([D('NHÂN VIÊN ĐẠI LÝ THUẾ')], 24.0, B + 44.76)
  b.ve([D('NGƯỜI NỘP THUẾ hoặc')], TK, B + 50.4, 'giua')
  b.ve([T('Họ và tên: ' + d.dly.nhanVien)], 24.0, B + 56.64)
  b.ve([D('ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ')], TK, B + 62.28, 'giua')
  b.ve([N('(Chữ ký, ghi rõ họ tên; chức vụ và đóng dấu (nếu có)/Ký điện tử)')], TK, B + 74.04, 'giua')
  b.ve([T('Chứng chỉ hành nghề số: ' + d.dly.chungChi)], 24.0, B + 80.28)
  b.ve([T(d.nguoiKy)], TK, B + 121.92, 'giua')
  b.ve([T('_____________________')], 20.9, B + 136.92)
  b.ve([{ t: 'Ghi chú:', k: 'dam_nghieng', gach: true }, N(' Số liệu chỉ tiêu [22] được tổng hợp vào chỉ tiêu A1 của Tờ khai 03/TNDN')], 20.9, B + 148.68)
  b.ke(20.25, B + 157.68, 574.5, B + 157.68, VACH)
  if (d.chuKy) b.chuKyXanh(B + 157.68 + 17.76)
  b.ketThuc()
}

// ── Phụ lục 03-3A/TNDN — Thuế TNDN được ưu đãi ─────────────────────────────────────────────────────────────────────────
// Bảng 25 cột không vừa khổ A4 nên cổng thu nhỏ CẢ TRANG còn 0,449 (chữ 4,49pt). App làm y như vậy: dựng trên một trang
// ẢO khổ 1250,6 × 1850,5 ở cỡ chữ thường (cùng bộ ngắt dòng / chiều cao hàng như mọi bảng khác), rồi thu nhỏ trang ảo vào
// trang A4 thật (pdf-lib embedPage) ở gốc (AX, BY), xoá trang ảo. Tiêu đề bảng A (nhiều tầng gộp ô) là chữ CỐ ĐỊNH — vị trí
// chữ + đường kẻ trích tự động từ bản cổng in TEN NOODLES 2025, quy về toạ độ trang ảo: [x, y, chữ, kiểu] / [x0, y0, x1, y1].
const T3A = { S: 0.449, AX: 16.948, BY: 11.01, VW: 1250.6, VH: 1850.5 }
export function coTheDung033A(xml, motKhoi) {
  const pl = motKhoi(xml, 'PLuc_03_3A_TNDN')
  if ((String(pl).match(/<NoiDungPL03_3A\b/g) || []).length > 1) return 'phụ lục 03-3A có nhiều loại ưu đãi — chưa có bản gốc'
  return null
}
export async function vePhuLuc033A({ moiBieu, pdf, d, xml, soMau, the, motKhoi, T, D, N, VACH }) {
  const pl = motKhoi(xml, 'PLuc_03_3A_TNDN')
  if (!pl) return
  const nd = motKhoi(pl, 'NoiDungPL03_3A'), ud = motKhoi(nd, 'thueTNDN_uuDai'), pn = motKhoi(nd, 'thueTNDN_phaiNop')
  const that = moiBieu()
  that.moTrang()                                       // trang A4 thật (đánh số 1/1)
  const b = moiBieu({ kho: [T3A.VW, T3A.VH], day: 1800 })
  b.moTrang()                                          // trang ảo
  const { C } = b
  const K = { thuong: T, dam: D, nghieng: N }
  const so = v => /^-?\d+\.\d+$/.test(String(v || '').trim()) ? String(v).trim().replace('.', ',') : soMau(v)
  // Đầu trang
  const TAM = 517.6
  b.ve([D('Phụ lục')], TAM, 30.0, 'giua')
  b.ve([D('THUẾ THU NHẬP DOANH NGHIỆP ĐƯỢC ƯU ĐÃI')], TAM, 43.1, 'giua')
  b.ve([D('Đối với thu nhập từ dự án đầu tư mới, thu nhập của doanh nghiệp được hưởng ưu đãi thuế thu nhập doanh nghiệp')], TAM, 56.2, 'giua')
  b.ve([N('(Kê khai theo từng tỉnh nơi người nộp thuế có trụ sở chính, đơn vị phụ thuộc/địa điểm kinh doanh khác tỉnh có thu nhập được hưởng ưu đãi đồng thời nộp Phụ lục này kèm tờ khai quyết toán thuế thu nhập doanh nghiệp số 03/TNDN tại trụ sở chính)')], TAM, 69.3, 'giua')
  b.ve([D('[01]'), T(` Kỳ tính thuế: ${d.kyChu} Từ ${d.tuNgay}  đến ${d.denNgay})`)], 514.8, 123.0, 'giua')
  b.ve([D('[02]'), T(` Lần đầu: [${d.soLan ? ' ' : 'X'}] `), D('[03]'), T(` Bổ sung lần thứ: [${d.soLan ? d.soLan : ' '}]`)], 514.4, 177.5, 'giua')
  b.hopMauSo(1016.8, 1070.0, 20.9, [
    ...C.ngat([T('Mẫu số: '), D('03-3A/TNDN')], 50, 10, { sauGach: true }),
    ...C.ngat([T('('), N('Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính'), T(')')], 50, 10, { sauGach: true }),
  ].map(doan => ({ doan })), 11.84)
  b.ve([D('[04] Tên người nộp thuế:'), T(' ' + d.ten)], 21, 202.9)
  b.ve([D('[05]'), T(' Mã số thuế: ' + d.mst)], 21, 216.0)
  b.ve([D('[06] Tên đại lý thuế (nếu có):'), T(' ' + d.dly.ten)], 21, 229.4)
  b.ve([D('[07]'), T(' Mã số thuế: ' + d.dly.mst)], 21, 242.5)
  b.ve([D('[08]'), T('  Hợp đồng đại lý thuế: Số ' + d.dly.soHd)], 21, 255.6)
  b.ve([T('Ngày: ' + d.dly.ngayHd)], 305.1, 255.6)
  b.ve([D('[09] Địa phương nơi có đơn vị phụ thuộc/địa điểm kinh doanh có thu nhập được hưởng ưu đãi khác tỉnh nơi đóng trụ sở chính:')], 20.5, 281.0)
  b.ve([D('[09a] Xã phường:'), T(the(nd, 'ct09a_ten') ? ' ' + the(nd, 'ct09a_ten') : '')], 20.5, 294.3)
  b.ve([D('[09b] Quận/huyện:'), T(the(nd, 'ct09b_ten') ? ' ' + the(nd, 'ct09b_ten') : '')], 172.3, 294.3)
  b.ve([D('[09c] Tỉnh/Thành phố:'), T(the(nd, 'ct09c_ten') ? ' ' + the(nd, 'ct09c_ten') : '')], 334.5, 294.3)
  b.ve([D(`Dự án đầu tư - kinh doanh nhà ở xã hội: [${the(nd, 'duAn') === '1' ? 'X' : ''}]`)], 20.5, 307.4)
  b.ve([D('A. Xác định ưu đãi thuế thu nhập doanh nghiệp của người nộp thuế tại trụ sở chính, đơn vị phụ thuộc/địa điểm kinh doanh khác tỉnh')], 19.7, 319.7)
  b.ve([N('Đơn vị tiền: Đồng Việt Nam')], 1229.3, 333.6, 'phai')
  // Tiêu đề bảng A — cố định
  for (const [x0, y0, x1, y1] of KE_3A) b.ke(x0, y0, x1, y1)
  for (const [x, y, t, k] of CHU_3A) b.ve([K[k](t)], x, y)
  // Hàng dữ liệu (mỗi đơn vị một hàng) + tổng cộng
  const cot = [20.25, ...COT_3A, 1230.4]
  const o = (c, t, k = 'thuong', canh, n) => ({ c, n, doan: t ? [[{ t: String(t), k }]] : '', canh })
  const canh = i => (i === 3 || i === 8 || i === 9 ? 'giua' : i <= 8 ? 'trai' : 'phai')   // (3) MST, (8) lĩnh vực, (9) canh giữa
  const ten = (r, i) => ({ 2: 'ct2', 3: 'ct3', 4: 'ct4_ten', 5: 'ct5_ten', 6: 'ct6', 7: 'ct7', 8: 'ct8_ten' })[i] ? the(r, { 2: 'ct2', 3: 'ct3', 4: 'ct4_ten', 5: 'ct5_ten', 6: 'ct6', 7: 'ct7', 8: 'ct8_ten' }[i])
    : i >= 9 && i <= 12 ? String(the(r, 'ct' + i) ?? '').trim()   // (9)–(12) số năm / từ năm: in nguyên, không chấm nghìn
      : so(the(r, 'ct' + i))
  const dong = [...String(ud).matchAll(/<ChiTiet_Pluc\b[\s\S]*?<\/ChiTiet_Pluc>/g)].map(m => m[0])
  b.y = 477.4
  b.bang(cot, [
    ...dong.map((r, j) => [o(0, String(j + 1), 'thuong', 'giua'), ...Array.from({ length: 24 }, (_, k) => o(k + 1, ten(r, k + 2), 'thuong', canh(k + 2)))]),
    [o(0, 'Tổng cộng', 'dam', 'giua', 13), o(13, ''), o(14, ''), o(15, ''), o(16, so(the(ud, 'tong10')), 'dam', 'phai'), o(17, ''), o(18, so(the(ud, 'tong11')), 'dam', 'phai'),
      o(19, ''), o(20, so(the(ud, 'tong12')), 'dam', 'phai'), o(21, ''), o(22, so(the(ud, 'tong13')), 'dam', 'phai'), o(23, so(the(ud, 'tong14')), 'dam', 'phai'), o(24, so(the(ud, 'tong15')), 'dam', 'phai')],
  ])
  // Mục B
  b.ve([D('B. Xác định số thuế TNDN phải nộp của hoạt động được hưởng ưu đãi thuế TNDN của đơn vị phụ thuộc/địa điểm kinh doanh khác tỉnh')], 19.7, b.y + 21.6)
  b.ve([N('Đơn vị tiền: Đồng Việt Nam')], 1229.3, b.y + 35.3, 'phai')
  b.y += 40.1
  const hb = (stt, chu, ma, k) => [o(0, stt, 'thuong', 'giua'), o(1, chu), o(2, `[${ma}]`, 'dam', 'giua'), o(3, soMau(the(pn, 'ct' + ma)), 'thuong', 'phai')]
  b.bang([20.25, 87.1, 994.4, 1137.4, 1230.4], [
    [o(0, 'STT', 'dam', 'giua'), o(1, 'Tên chỉ tiêu', 'dam', 'giua'), o(2, 'Mã chỉ tiêu', 'dam', 'giua'), o(3, 'Số tiền', 'dam', 'giua')],
    hb('1', 'Thuế TNDN phải nộp của hoạt động được hưởng ưu đãi thuế TNDN ([16]=[11]-[15])', 16),
    hb('2', 'Thuế TNDN nộp thừa kỳ trước chuyển sang kỳ này', 17),
    hb('3', 'Thuế TNDN đã tạm nộp trong năm', 18),
    hb('4', 'Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp trong năm ([19]=[16]-[18])', 19),
    hb('5', 'Thuế TNDN còn phải nộp ([20]=[16]-[17]-[18])', 20),
  ])
  // Cam đoan + chữ ký (kiểu cũ, như 03-1A) + ghi chú
  const B = b.y + 22.2, TK = 552.6
  b.ve([T('Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về số liệu đã khai./...')], 25.4, B)   // thụt 2 dấu cách như bản cổng
  b.ve([N(d.ngayKy)], TK, B + 27.0, 'giua')
  b.ve([D('NHÂN VIÊN ĐẠI LÝ THUẾ')], 23.5, B + 45.2)
  b.ve([D('NGƯỜI NỘP THUẾ hoặc')], TK, B + 50.8, 'giua')
  b.ve([T('Họ và tên: ' + d.dly.nhanVien)], 23.5, B + 56.9)
  b.ve([D('ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ')], TK, B + 62.5, 'giua')
  b.ve([N('(Chữ ký, ghi rõ họ tên; chức vụ và đóng dấu (nếu có)/Ký điện tử)')], TK, B + 74.3, 'giua')
  b.ve([T('Chứng chỉ hành nghề số: ' + d.dly.chungChi)], 23.5, B + 80.7)
  b.ve([T(d.nguoiKy)], TK, B + 122.4, 'giua')
  b.ve([{ t: 'Ghi chú:', k: 'dam_nghieng', gach: true }], 20.5, B + 137.4)
  let y = B + 137.4
  for (const g of GHI_CHU_3A) for (const dd of C.ngat([N(g)], 1225.5 - 20.5, 10, { html: true })) { y += 11.86; b.ve(dd, 20.5, y) }
  const vach = y + 9.1
  b.ke(20.25, vach, 1230.4, vach, VACH)
  if (d.chuKy) b.chuKyXanh(vach + 17.9)
  // Thu nhỏ trang ảo vào trang thật rồi bỏ trang ảo
  const emb = await pdf.embedPage(b.trang)
  that.trang.drawPage(emb, { x: T3A.AX, y: that.trang.getHeight() - T3A.BY - T3A.VH * T3A.S, xScale: T3A.S, yScale: T3A.S })
  pdf.removePage(pdf.getPageCount() - 1)
  that.ketThuc()
}
// Ghi chú cổng in (không có mục 6 — chép đúng bản cổng)
const GHI_CHU_3A = [
  '1. NNT kê khai Phụ lục này theo từng tỉnh/thành phố nơi người nộp thuế có đơn vị phụ thuộc/địa điểm kinh doanh khác tỉnh có thu nhập được hưởng ưu đãi, đồng thời nộp Phụ lục này kèm tờ khai quyết toán thuế thu nhập doanh nghiệp số 03/TNDN khi kê khai tại trụ sở chính.',
  '2. TNDN: Thu nhập doanh nghiệp;',
  '3. Số liệu chỉ tiêu [12] tổng hợp vào chỉ tiêu C11 của tờ khai 03/TNDN;',
  '4. Số liệu chỉ tiêu [13] tổng hợp vào chỉ tiêu C12 của tờ khai 03/TNDN;',
  '5. Số liệu chỉ tiêu [14] tổng hợp vào chỉ tiêu C13 của tờ khai 03/TNDN.',
  '7. NNT không phải kê khai mục B nếu hoạt động được hưởng ưu đãi thuế TNDN của trụ sở chính.',
  '8. Chỉ tiêu [09a], [09b], [09c]: Khai thông tin của đơn vị phụ thuộc, địa điểm kinh doanh khác tỉnh có thu nhập được hưởng ưu đãi theo quy định tại điểm h khoản 1 Điều 11 Nghị định số 126/2020/NĐ-CP ngày 19/10/2020 của Chính phủ. Trường hợp có nhiều đơn vị phụ thuộc, địa điểm kinh doanh đóng trên nhiều địa bàn cấp huyện do Cục Thuế quản lý thì chọn 1 đơn vị đại diện để kê khai vào chỉ tiêu này. Trường hợp có nhiều đơn vị phụ thuộc, địa điểm kinh doanh do Chi cục Thuế khu vực quản lý thì chọn 1 đơn vị đại diện cho địa bàn cấp huyện do Chi cục Thuế khu vực quản lý để kê khai vào chỉ tiêu này.',
]
const COT_3A = [44.57, 119.94, 199.31, 261.32, 314.24, 342.3, 376.78, 410.98, 436.64, 462.3, 487.96, 516.02, 582.83, 647.78, 681.45, 727.69, 790.23, 826.31, 899.54, 969.56, 1019.54, 1057.49, 1116.82, 1149.96]
const KE_3A = [
  [44.57, 338.95, 44.57, 446.93],
  [20.78, 446.93, 44.57, 446.93],
  [119.94, 338.95, 119.94, 446.93],
  [45.11, 446.93, 119.94, 446.93],
  [199.31, 338.95, 199.31, 446.93],
  [120.74, 446.93, 199.31, 446.93],
  [261.32, 338.95, 261.32, 446.93],
  [200.12, 446.93, 261.32, 446.93],
  [314.24, 338.95, 314.24, 446.93],
  [261.85, 446.93, 314.24, 446.93],
  [410.98, 338.95, 410.98, 368.89],
  [315.04, 368.89, 410.98, 368.89],
  [516.02, 338.95, 516.02, 368.89],
  [411.79, 368.89, 516.02, 368.89],
  [727.69, 338.95, 727.69, 368.89],
  [516.55, 368.89, 727.69, 368.89],
  [1019.54, 338.95, 1019.54, 368.89],
  [728.49, 368.89, 1019.54, 368.89],
  [1149.96, 338.95, 1149.96, 368.89],
  [1020.07, 368.89, 1149.96, 368.89],
  [1150.49, 446.93, 1229.87, 446.93],
  [342.3, 369.42, 342.3, 446.93],
  [315.04, 446.93, 342.3, 446.93],
  [376.78, 369.42, 376.78, 446.93],
  [343.1, 446.93, 376.78, 446.93],
  [410.98, 369.42, 410.98, 446.93],
  [377.31, 446.93, 410.98, 446.93],
  [462.3, 369.42, 462.3, 399.35],
  [411.79, 399.35, 462.3, 399.35],
  [516.02, 369.42, 516.02, 399.35],
  [462.83, 399.35, 516.02, 399.35],
  [582.83, 369.42, 582.83, 446.93],
  [516.55, 446.93, 582.83, 446.93],
  [647.78, 369.42, 647.78, 446.93],
  [583.37, 446.93, 647.78, 446.93],
  [681.45, 369.42, 681.45, 446.93],
  [648.31, 446.93, 681.45, 446.93],
  [727.69, 369.42, 727.69, 446.93],
  [682.25, 446.93, 727.69, 446.93],
  [790.23, 369.42, 790.23, 446.93],
  [728.49, 446.93, 790.23, 446.93],
  [826.31, 369.42, 826.31, 446.93],
  [790.76, 446.93, 826.31, 446.93],
  [899.54, 369.42, 899.54, 446.93],
  [827.11, 446.93, 899.54, 446.93],
  [969.56, 369.42, 969.56, 446.93],
  [900.07, 446.93, 969.56, 446.93],
  [1019.54, 369.42, 1019.54, 446.93],
  [970.09, 446.93, 1019.54, 446.93],
  [1057.49, 369.42, 1057.49, 446.93],
  [1020.07, 446.93, 1057.49, 446.93],
  [1116.82, 369.42, 1116.82, 446.93],
  [1058.02, 446.93, 1116.82, 446.93],
  [1149.96, 369.42, 1149.96, 446.93],
  [1117.35, 446.93, 1149.96, 446.93],
  [436.64, 400.16, 436.64, 446.93],
  [411.79, 446.93, 436.64, 446.93],
  [462.3, 400.16, 462.3, 446.93],
  [437.44, 446.93, 462.3, 446.93],
  [487.96, 400.16, 487.96, 446.93],
  [462.83, 446.93, 487.96, 446.93],
  [516.02, 400.16, 516.02, 446.93],
  [488.49, 446.93, 516.02, 446.93],
  [44.57, 447.46, 44.57, 477.39],
  [20.78, 477.39, 44.57, 477.39],
  [119.94, 447.46, 119.94, 477.39],
  [45.11, 477.39, 119.94, 477.39],
  [199.31, 447.46, 199.31, 477.39],
  [120.74, 477.39, 199.31, 477.39],
  [261.32, 447.46, 261.32, 477.39],
  [200.12, 477.39, 261.32, 477.39],
  [314.24, 447.46, 314.24, 477.39],
  [261.85, 477.39, 314.24, 477.39],
  [342.3, 447.46, 342.3, 477.39],
  [315.04, 477.39, 342.3, 477.39],
  [376.78, 447.46, 376.78, 477.39],
  [343.1, 477.39, 376.78, 477.39],
  [410.98, 447.46, 410.98, 477.39],
  [377.31, 477.39, 410.98, 477.39],
  [436.64, 447.46, 436.64, 477.39],
  [411.79, 477.39, 436.64, 477.39],
  [462.3, 447.46, 462.3, 477.39],
  [437.44, 477.39, 462.3, 477.39],
  [487.96, 447.46, 487.96, 477.39],
  [462.83, 477.39, 487.96, 477.39],
  [516.02, 447.46, 516.02, 477.39],
  [488.49, 477.39, 516.02, 477.39],
  [582.83, 447.46, 582.83, 477.39],
  [516.55, 477.39, 582.83, 477.39],
  [647.78, 447.46, 647.78, 477.39],
  [583.37, 477.39, 647.78, 477.39],
  [681.45, 447.46, 681.45, 477.39],
  [648.31, 477.39, 681.45, 477.39],
  [727.69, 447.46, 727.69, 477.39],
  [682.25, 477.39, 727.69, 477.39],
  [790.23, 447.46, 790.23, 477.39],
  [728.49, 477.39, 790.23, 477.39],
  [826.31, 447.46, 826.31, 477.39],
  [790.76, 477.39, 826.31, 477.39],
  [899.54, 447.46, 899.54, 477.39],
  [827.11, 477.39, 899.54, 477.39],
  [969.56, 447.46, 969.56, 477.39],
  [900.07, 477.39, 969.56, 477.39],
  [1019.54, 447.46, 1019.54, 477.39],
  [970.09, 477.39, 1019.54, 477.39],
  [1057.49, 447.46, 1057.49, 477.39],
  [1020.07, 477.39, 1057.49, 477.39],
  [1116.82, 447.46, 1116.82, 477.39],
  [1058.02, 477.39, 1116.82, 477.39],
  [1149.96, 447.46, 1149.96, 477.39],
  [1117.35, 477.39, 1149.96, 477.39],
  [1150.49, 477.39, 1229.87, 477.39],
  [20.25, 338.15, 1230.41, 338.15],
]
const CHU_3A = [
  [321.99, 350.98, "Thông tin dự án đầu", 'thuong'],
  [419.54, 350.98, "Xác định thời gian ưu", 'thuong'],
  [521.36, 350.98, "Kết quả kinh doanh của hoạt động được hưởng ưu", 'thuong'],
  [1027.29, 350.98, "Xác định số thuế được miễn,", 'thuong'],
  [795.57, 356.59, "Xác định số thuế được ưu đãi thuế suất", 'thuong'],
  [358.33, 363.01, "tư", 'thuong'],
  [456.95, 363.01, "đãi", 'thuong'],
  [615.71, 363.01, "đãi", 'thuong'],
  [1074.59, 363.01, "giảm", 'thuong'],
  [203.32, 365.95, "Cơ quan thuế", 'thuong'],
  [124.75, 377.97, "Mã số thuế NNT,", 'thuong'],
  [202.79, 377.97, "quản lý NNT,", 'thuong'],
  [267.73, 377.97, "Điều kiện", 'thuong'],
  [422.74, 381.71, "Ưu đãi", 'thuong'],
  [467.11, 381.71, "Miễn giảm", 'thuong'],
  [979.18, 381.71, "Số thuế", 'thuong'],
  [52.86, 384.12, "Tên NNT, đơn", 'thuong'],
  [320.12, 387.33, "Tên", 'thuong'],
  [346.58, 387.33, "Mã dự", 'thuong'],
  [124.75, 389.73, "đơn vị phụ thuộc,", 'thuong'],
  [208.4, 389.73, "đơn vị phụ", 'thuong'],
  [277.89, 389.73, "được", 'thuong'],
  [1164.13, 389.73, "Tổng số thuế", 'thuong'],
  [384.53, 393.47, "Lĩnh", 'thuong'],
  [419, 393.47, "thuế suất", 'thuong'],
  [480.21, 393.47, "thuế", 'thuong'],
  [656.33, 393.47, "Thu", 'thuong'],
  [797.98, 393.47, "Thuế", 'thuong'],
  [837.27, 393.47, "Thuế TNDN", 'thuong'],
  [973.03, 393.47, "chênh lệch", 'thuong'],
  [1127.78, 393.47, "Số", 'thuong'],
  [23.46, 395.88, "STT", 'thuong'],
  [48.58, 395.88, "vị phụ thuộc, địa", 'thuong'],
  [322.79, 399.09, "dự", 'thuong'],
  [346.58, 399.09, "án đầu", 'thuong'],
  [688.67, 399.09, "Chuyển", 'thuong'],
  [904.08, 399.09, "Số thuế TNDN", 'thuong'],
  [1027.82, 399.09, "Tỷ lệ", 'thuong'],
  [124.75, 401.49, "mã địa điểm kinh", 'thuong'],
  [210.27, 401.49, "thuộc, địa", 'thuong'],
  [268.54, 401.49, "hưởng ưu", 'thuong'],
  [1166.53, 401.49, "được ưu đãi", 'thuong'],
  [386.4, 405.23, "vực", 'thuong'],
  [519.49, 405.23, "Doanh thu tính", 'thuong'],
  [591.39, 405.23, "Chi phí tính", 'thuong'],
  [654.99, 405.23, "nhập", 'thuong'],
  [734.9, 405.23, "TNTT được", 'thuong'],
  [793.7, 405.23, "suất ưu", 'thuong'],
  [835.39, 405.23, "phải nộp theo", 'thuong'],
  [983.46, 405.23, "do áp", 'thuong'],
  [1072.19, 405.23, "Số thuế", 'thuong'],
  [1124.57, 405.23, "thuế", 'thuong'],
  [48.58, 407.91, "điểm kinh doanh", 'thuong'],
  [323.32, 411.11, "án", 'thuong'],
  [355.13, 411.11, "tư", 'thuong'],
  [688.13, 411.11, "lỗ và bù", 'thuong'],
  [906.75, 411.11, "tính theo thuế", 'thuong'],
  [1028.36, 411.11, "giảm", 'thuong'],
  [147.2, 413.52, "doanh", 'thuong'],
  [210.27, 413.52, "điểm kinh", 'thuong'],
  [271.47, 413.52, "đãi thuế", 'thuong'],
  [385.33, 417.26, "hoạt", 'thuong'],
  [540.61, 417.26, "thuế", 'thuong'],
  [606.35, 417.26, "thuế", 'thuong'],
  [654.46, 417.26, "miễn", 'thuong'],
  [732.5, 417.26, "hưởng ưu đãi", 'thuong'],
  [801.72, 417.26, "đãi", 'thuong'],
  [836.2, 417.26, "thuế suất phổ", 'thuong'],
  [974.1, 417.26, "dụng thuế", 'thuong'],
  [1066.04, 417.26, "được miễn", 'thuong'],
  [1123.5, 417.26, "được", 'thuong'],
  [418.2, 420.47, "Số", 'thuong'],
  [443.86, 420.47, "Từ", 'thuong'],
  [469.52, 420.47, "Số", 'thuong'],
  [496.24, 420.47, "Từ", 'thuong'],
  [320.92, 422.87, "đầu", 'thuong'],
  [350.85, 422.87, "(nếu", 'thuong'],
  [686.26, 422.87, "trừ lãi, lỗ", 'thuong'],
  [912.37, 422.87, "suất ưu đãi", 'thuong'],
  [1029.69, 422.87, "thuế", 'thuong'],
  [217.76, 425.28, "doanh", 'thuong'],
  [383.99, 429.02, "động", 'thuong'],
  [655.53, 429.02, "thuế", 'thuong'],
  [800.65, 429.02, "(%)", 'thuong'],
  [851.7, 429.02, "thông", 'thuong'],
  [979.72, 429.02, "suất ưu", 'thuong'],
  [1123.5, 429.02, "giảm", 'thuong'],
  [415.26, 432.23, "năm", 'thuong'],
  [440.65, 432.23, "năm", 'thuong'],
  [466.31, 432.23, "năm", 'thuong'],
  [493.3, 432.23, "năm", 'thuong'],
  [323.86, 434.63, "tư", 'thuong'],
  [353.26, 434.63, "có)", 'thuong'],
  [988, 441.05, "đãi", 'thuong'],
  [1155.31, 459.76, "(25)=(21)+(23)+", 'nghieng'],
  [26.13, 465.37, "(1)", 'nghieng'],
  [76.11, 465.37, "(2)", 'nghieng'],
  [153.61, 465.37, "(3)", 'nghieng'],
  [224.17, 465.37, "(4)", 'nghieng'],
  [281.63, 465.37, "(5)", 'nghieng'],
  [321.99, 465.37, "(6)", 'nghieng'],
  [353.26, 465.37, "(7)", 'nghieng'],
  [387.73, 465.37, "(8)", 'nghieng'],
  [417.67, 465.37, "(9)", 'nghieng'],
  [440.65, 465.37, "(10)", 'nghieng'],
  [466.31, 465.37, "(11)", 'nghieng'],
  [493.3, 465.37, "(12)", 'nghieng'],
  [540.61, 465.37, "(13)", 'nghieng'],
  [606.89, 465.37, "(14)", 'nghieng'],
  [656.33, 465.37, "(15)", 'nghieng'],
  [696.15, 465.37, "(16)", 'nghieng'],
  [750.67, 465.37, "(17)", 'nghieng'],
  [799.85, 465.37, "(18)", 'nghieng'],
  [854.1, 465.37, "(19)", 'nghieng'],
  [926, 465.37, "(20)", 'nghieng'],
  [986.13, 465.37, "(21)", 'nghieng'],
  [1029.69, 465.37, "(22)", 'nghieng'],
  [1078.33, 465.37, "(23)", 'nghieng'],
  [1124.57, 465.37, "(24)", 'nghieng'],
  [1181.5, 471.51, "(24)", 'nghieng'],
]
