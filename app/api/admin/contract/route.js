import { createClient } from '@supabase/supabase-js'
import { amountInWords } from '@/lib/numberToWords'
import { contractEndDate, contractNumber, viFullDate, viShortDate } from '@/lib/contractDates'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// GET /api/admin/contract?clientId=xxx&format=pdf|word
// Dựng HỢP ĐỒNG DỊCH VỤ theo mẫu SVT.MB05, điền dữ liệu công ty.
// format=pdf -> HTML có nút In (lưu PDF); format=word -> .doc mở/sửa trong Word.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const format   = searchParams.get('format') === 'word' ? 'word' : 'pdf'
  if (!clientId) return new Response('Missing clientId', { status: 400 })

  const supabase = getAdmin()
  const { data: c } = await supabase.from('clients')
    .select('id, name, tax_code, address, representative, client_code, monthly_fee, contract_start')
    .eq('id', clientId).single()
  if (!c) return new Response('Client not found', { status: 404 })

  const startRaw = c.contract_start || new Date()
  const soHD     = contractNumber(startRaw, c.client_code || c.tax_code || '')
  const ngayLap  = viFullDate(startRaw)
  const tuNgay   = viShortDate(startRaw)
  const denNgay  = viShortDate(contractEndDate(startRaw))
  const fee      = Number(c.monthly_fee) || 0
  const feeWords = amountInWords(fee)

  // Phụ lục 01 — biểu phí cố định (giữ nguyên theo mẫu)
  const feeTable1 = [
    ['1', 'Không phát sinh', '1.000.000', '1.000.000', '1.000.000'],
    ['2', 'Dưới 10 chứng từ', '3.000.000', '3.000.000', '4.000.000'],
    ['3', 'Từ 11 → 20 chứng từ', '4.500.000', '4.500.000', '6.000.000'],
    ['4', 'Từ 21 → 30 chứng từ', '6.000.000', '6.000.000', '8.000.000'],
    ['5', 'Trên 31 chứng từ', 'Thoả thuận', '', ''],
  ]
  const feeTable2 = [
    ['1', 'Dưới 10 LĐ BHXH / Dưới 100 LĐ thời vụ', '1.500.000', '1.500.000', '2.000.000'],
    ['2', 'Từ 10 đến dưới 20 LĐ BHXH / 100–200 LĐ thời vụ', '3.000.000', '3.000.000', '3.500.000'],
    ['3', 'Từ 20 đến dưới 30 LĐ BHXH / 200–300 LĐ thời vụ', '4.500.000', '4.500.000', '5.000.000'],
    ['4', 'Từ 30 đến dưới 40 LĐ BHXH / 300–400 LĐ thời vụ', '6.000.000', '6.000.000', '8.000.000'],
    ['5', 'Từ 40 đến dưới 50 LĐ BHXH / 400–500 LĐ thời vụ', '8.000.000', '8.000.000', '10.000.000'],
    ['6', 'Trên 51 LĐ BHXH / Trên 500 LĐ thời vụ', 'Thỏa thuận', '', ''],
  ]
  const rows = (arr) => arr.map(r =>
    '<tr><td class="c">' + r[0] + '</td><td>' + r[1] + '</td><td class="r">' + r[2] + '</td><td class="r">' + r[3] + '</td><td class="r">' + r[4] + '</td></tr>'
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>Hợp đồng dịch vụ - ${esc(c.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',serif;font-size:13pt;color:#000;line-height:1.5;background:#fff}
  .page{width:210mm;min-height:297mm;margin:0 auto;padding:18mm 20mm}
  h1{text-align:center;font-size:16pt;font-weight:bold;margin-bottom:4px}
  .sub{text-align:center;font-size:12pt;margin-bottom:14px;color:#c00;font-weight:bold}
  .center{text-align:center}
  p{margin:5px 0;text-align:justify}
  .b{font-weight:bold}
  .red{color:#c00}
  h2{font-size:13pt;font-weight:bold;margin:12px 0 4px}
  ul{margin:4px 0 4px 22px}
  li{margin:3px 0;text-align:justify}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11pt}
  th,td{border:1px solid #000;padding:4px 6px;vertical-align:top}
  th{background:#eee;text-align:center;font-weight:bold}
  td.c{text-align:center}
  td.r{text-align:right}
  .sign{display:flex;justify-content:space-around;margin-top:24px;text-align:center}
  .sign div{width:45%}
  .sign .role{font-weight:bold}
  .sign .gap{height:60px}
  .sign .nm{font-weight:bold}
  .noprint{margin-bottom:12px;text-align:right}
  .btn{cursor:pointer;border:none;padding:8px 18px;border-radius:6px;font-size:12pt;font-weight:bold;background:#003087;color:#fff}
  @media print{.noprint{display:none!important} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} .page{padding:14mm}}
</style></head>
<body>
<div class="page">
  <div class="noprint"><button class="btn" onclick="window.print()">🖨️ In / Lưu PDF</button></div>

  <h1>HỢP ĐỒNG DỊCH VỤ</h1>
  <p class="center b red">Số: ${esc(soHD)}</p>
  <p>Căn cứ Luật dân sự số: 91/2015/QH13 có hiệu lực thi hành từ ngày 01/01/2017.</p>
  <p>Căn cứ Luật Quản lý thuế số 106/2016/QH13 có hiệu lực thi hành từ ngày 01/07/2016.</p>
  <p>Căn cứ Luật Quản lý thuế số 38/2019/QH14 có hiệu lực thi hành từ 01/07/2020.</p>
  <p>Căn cứ khả năng và nhu cầu của các bên.</p>
  <p>Hợp đồng dịch vụ Tư vấn thuế (gọi là "Hợp đồng") này được lập <span class="b">${esc(ngayLap)}</span> tại trụ sở của Công ty CP Tư Vấn Thuế SAVITAX và thực hiện bởi các Bên tham gia dưới đây:</p>

  <p class="b">Bên A: (Bên sử dụng dịch vụ):</p>
  <p class="b" style="text-transform:uppercase">${esc(c.name)}</p>
  <p>Địa chỉ: ${esc(c.address)}</p>
  <p>Mã số thuế: ${esc(c.tax_code)}</p>
  <p>Đại diện là Ông/Bà: <span class="b">${esc(c.representative)}</span> &nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</p>
  <p>Điện thoại: ............................................</p>

  <p class="b">Bên B: (Bên cung cấp dịch vụ):</p>
  <p class="b">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</p>
  <p>Địa chỉ: 16 Bình Lợi, Phường Bình Lợi Trung, Tp Hồ Chí Minh, Việt Nam</p>
  <p>Mã số thuế: 0313 906 307</p>
  <p>Tài khoản Ngân hàng: Ngân Hàng Thương Mại Á Châu – CN Nguyễn Trãi</p>
  <p>Số tài khoản: 3878556868</p>
  <p>Đại diện là Bà: <span class="b">Đinh Thị Huyền</span> &nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</p>
  <p>Điện thoại: 0989.666.253</p>

  <p>Bên A và bên B có thể được gọi là "các Bên". Sau khi thoả thuận các Bên nhất trí ký Hợp đồng này gồm các điều khoản sau:</p>

  <h2>Điều 1: Dịch vụ</h2>
  <p>Bên B đồng ý cung cấp cho Bên A "Dịch vụ thực hiện tư vấn thuế chuyên nghiệp từ <span class="b">${esc(tuNgay)}</span> đến <span class="b">${esc(denNgay)}</span>" theo phạm vi công việc được quy định cụ thể như sau:</p>
  <ul>
    <li>Thực hiện dịch vụ tư vấn thuế theo quy định của Luật quản lý thuế và niên giám thuế.</li>
    <li>Thực hiện các dịch vụ tư vấn kê khai thuế, quyết toán thuế cho bên A đúng thời gian quy định.</li>
    <li>Bên A ủy quyền cho bên B làm việc và giải trình với cơ quan thuế trên cơ sở đã trình bày trước với bên A.</li>
    <li>Trình bày, tư vấn về thuế trong quá trình thực hiện dịch vụ.</li>
    <li>Thực hiện các báo cáo đối với cơ quan thống kê.</li>
    <li>Bàn giao sổ file mềm kế toán theo quy định của Bộ tài chính.</li>
  </ul>

  <h2>Điều 2: Thời hạn hợp đồng</h2>
  <p>Hợp đồng có hiệu lực từ <span class="b">${esc(tuNgay)}</span> đến hết <span class="b">${esc(denNgay)}</span>. Trong trường hợp hết hạn Hợp đồng mà các Bên không có thỏa thuận nào khác thì Hợp đồng đương nhiên gia hạn thêm một kỳ hạn tiếp theo, hai bên sẽ ký phụ lục gia hạn thời gian của hợp đồng. Trong trường hợp một Bên muốn chấm dứt hợp đồng trước hạn thì phải báo trước cho Bên kia bằng văn bản thời gian tối thiểu là 02 tháng và phải hoàn thành các nghĩa vụ và trách nhiệm được quy định tại Hợp đồng này.</p>

  <h2>Điều 3: Giao nhận chứng từ và báo cáo</h2>
  <p class="b">3.1. Chứng từ Bên A giao cho Bên B.</p>
  <ul>
    <li>Hàng tháng chậm nhất vào ngày 05 bên A cung cấp hồ sơ, chứng từ cho bên B.</li>
    <li>Dựa trên phần dữ liệu bên A cung cấp bên B sẽ xử lý và tiến hành làm các công việc được quy định tại Điều 1.</li>
  </ul>
  <p class="b">3.2. Báo cáo Bên B giao cho Bên A.</p>
  <ul>
    <li>Báo thuế hàng tháng, chậm nhất là ngày 20 tháng kế tiếp trừ trường hợp bên A bàn giao hồ sơ trễ so với quy định tại điểm 3.1 của điều này.</li>
    <li>Báo cáo thuế hàng quý, chậm nhất là ngày 30 của tháng kế tiếp trừ trường hợp bên A bàn giao hồ sơ trễ so với quy định tại điểm 3.1 của điều này.</li>
    <li>Thời gian nộp các báo cáo thuế, báo cáo khác cho cơ quan quản lý nhà nước/cơ quan thuế không được muộn hơn thời hạn cuối cùng phải nộp theo quy định của pháp luật.</li>
  </ul>

  <h2>Điều 4: Phí dịch vụ và phương thức thanh toán</h2>
  <p class="b">4.1. Phí dịch vụ:</p>
  <ul>
    <li>Phí dịch vụ bắt đầu tính từ <span class="b">${esc(tuNgay)}</span> là <span class="b red">${fmt(fee)}đ/tháng</span> (dưới 30 chứng từ) (Bằng chữ: <span class="b">${esc(feeWords)}/tháng</span>). Khi có phát sinh chứng từ tăng thêm đột biến thì phí theo phụ lục 01 đính kèm, sau khi hai bên đã thống nhất thông báo tăng phí.</li>
    <li>Phí dịch vụ hành chính văn phòng nếu có nhu cầu sử dụng sẽ tính phí theo phụ lục 01 đính kèm.</li>
    <li>Phí dịch vụ giải trình thanh kiểm tra quyết toán thuế tối thiểu 1 tháng phí dịch vụ/năm.</li>
    <li>Trong quá trình thực hiện, hai bên đều có quyền đề nghị thay đổi (giảm/tăng) phí dịch vụ tuỳ thuộc vào mức độ hoạt động của bên A, lạm phát kinh tế xã hội…; Bên B sẽ thông báo bằng văn bản với bên A trước một tháng nếu có sự thay đổi và ngược lại.</li>
    <li>Phí trên chưa bao gồm thuế VAT.</li>
  </ul>
  <p class="b">4.2. Phương thức thanh toán:</p>
  <p>Bên A thanh toán cho Bên B bằng đồng Việt Nam bằng hình thức chuyển khoản đầu mỗi tháng, trước ngày 05 của tháng tiếp theo hoặc khi nhận được đề nghị thanh toán của bên B.</p>

  <h2>Điều 5: Trách nhiệm của mỗi Bên</h2>
  <p class="b">5.1. Trách nhiệm của Bên A</p>
  <ul>
    <li>Đảm bảo cung cấp kịp thời, đầy đủ cho Bên B các thông tin cần thiết, liên quan đến việc thực hiện dịch vụ theo yêu cầu của Bên B.</li>
    <li>Cử nhân viên của Bên A phối hợp với Bên B và tạo điều kiện thuận lợi để Bên B có thể xem xét và thu thập các thông tin cần thiết cho việc thực hiện dịch vụ.</li>
    <li>Chịu hoàn toàn trách nhiệm về tính pháp lý của chứng từ mà Bên A cung cấp liên quan đến việc thực hiện dịch vụ.</li>
    <li>Chịu phạt 02 tháng phí dịch vụ kê khai thuế nếu vi phạm về thời gian báo trước, thanh lý hợp đồng trước hạn, vi phạm về thời hạn thanh toán.</li>
    <li>Bên A ủy quyền cho bên B làm việc và giải trình với cơ quan thuế trên cơ sở đã trình bày trước với bên A.</li>
  </ul>
  <p class="b">5.2. Trách nhiệm của Bên B</p>
  <ul>
    <li>Bên B đảm bảo cung cấp dịch vụ theo đúng phạm vi công việc quy định tại Điều 1.</li>
    <li>Thực hiện công việc theo như kế hoạch và theo đúng các nguyên tắc độc lập, khách quan và bảo mật.</li>
    <li>Cử nhân viên và chuyên viên có năng lực, kinh nghiệm thực hiện công việc.</li>
    <li>Đảm bảo cơ sở vật chất được bố trí để thực hiện những dịch vụ.</li>
    <li>Thay mặt Bên A được toàn quyền làm việc và giải trình với cơ quan thuế trên cơ sở đã trình bày trước với bên A.</li>
    <li>Bên B chịu trách nhiệm đối với các khoản phạt vi phạm hành chính, chậm trễ thực hiện được xác định lỗi do Bên B tối đa không quá 3 tháng phí dịch vụ.</li>
  </ul>

  <h2>Điều 6: Cam kết các bên</h2>
  <p>Các Bên tham gia Hợp đồng cam kết thực hiện tất cả các điều khoản của Hợp đồng. Trong quá trình thực hiện Hợp đồng mỗi Bên phải thông báo cho Bên kia kịp thời những vướng mắc cản trở việc thực hiện thành công Hợp đồng này để Bên kia cùng thảo luận và tìm biện pháp giải quyết. Thông tin trao đổi sẽ được thực hiện trên văn bản, fax và Email gửi đến địa chỉ đã nêu ở trên của mỗi Bên.</p>

  <h2>Điều 7: Bảo mật thông tin</h2>
  <p>Dựa trên những điều khoản trên Hợp đồng và thời hạn chấm dứt hay kết thúc Hợp đồng bởi bất kỳ lý do gì. Bên B và nhân viên bên B:</p>
  <ul>
    <li>Không được tiết lộ cho bất cứ Bên thứ 3 kể cả cơ quan có thẩm quyền bất kỳ thông tin nào của bên A, không giới hạn những thông tin bảo mật, nguyên vật liệu, tài liệu liên quan đến hoạt động kinh doanh, tài chính hay bất kỳ chế độ phúc lợi nào của bên A hoặc các Công ty con hay Công ty liên quan đến bên A nếu không được sự đồng ý của bên A.</li>
    <li>Không sử dụng những thông tin bí mật cho mục đích khác ngoài những nghĩa vụ được thể hiện trong Hợp đồng này.</li>
    <li>Trong trường hợp Bên B phải cung cấp thông tin mật theo quyết định, yêu cầu của cơ quan chức năng Việt Nam, Bên B phải thông báo cho Bên A trong thời gian sớm nhất, nhưng không thể chậm hơn 5 ngày làm việc kể từ ngày nhận được yêu cầu của cơ quan chức năng Việt Nam.</li>
  </ul>

  <h2>Điều 8: Mâu thuẫn lợi ích</h2>
  <p>Bên B bảo đảm không thực hiện bất kỳ hành vi nào gây nguy hại hoặc mâu thuẫn với những lợi ích của Bên A.</p>

  <h2>Điều 9: Điều khoản chung</h2>
  <p>9.1. Hợp đồng sẽ có hiệu lực kể từ ngày ký, Điều 7 và Điều 8 sẽ duy trì hiệu lực của hợp đồng sau khi Hợp đồng bị chấm dứt.</p>
  <p>9.2. Hợp đồng sẽ được thanh lý sau khi các Bên thực hiện đầy đủ những lời cam kết được ghi rõ trong hợp đồng.</p>
  <p>9.3. Nếu không có giải pháp sau khi thương lượng, các tranh chấp phát sinh liên quan đến Hợp đồng này sẽ giải quyết tại Trung tâm trọng tài Việt Nam tại Tp.HCM theo quy tắc tố tụng trọng tài Trung tâm này. Phán quyết của trọng tài là chung thẩm và có hiệu lực thi hành đối với tất cả các Bên. Bên thua kiện sẽ phải trả chi phí cho trọng tài.</p>
  <p>9.4. Hợp đồng này được lập thành 02 bản tiếng Việt có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>

  <div class="sign">
    <div><p class="role">ĐẠI DIỆN BÊN A</p><div class="gap"></div><p class="nm">${esc(c.representative)}</p></div>
    <div><p class="role">ĐẠI DIỆN BÊN B</p><div class="gap"></div><p class="nm">ĐINH THỊ HUYỀN</p></div>
  </div>

  <h1 style="margin-top:32px">PHỤ LỤC SỐ 01</h1>
  <p>Biểu phí dịch vụ thực hiện các thủ tục thuế, tư vấn thuế và thủ tục về hành chính nhân sự cụ thể như sau:</p>
  <p class="b">DỊCH VỤ TƯ VẤN THUẾ TRỌN GÓI:</p>
  <table>
    <thead><tr><th>Stt</th><th>Số lượng chứng từ phát sinh</th><th>DV không tính giá thành, tư vấn</th><th>Ngành thương mại</th><th>DV có giá thành, SX, Xây dựng</th></tr></thead>
    <tbody>${rows(feeTable1)}</tbody>
  </table>
  <p>Biểu phí ngành dịch vụ, sản xuất và xây dựng còn phụ thuộc vào đặc thù sản xuất, dịch vụ và tính chất công trình. Công ty có yếu tố nước ngoài phí dịch vụ cộng thêm 30% theo biểu phí. Phí chưa bao gồm VAT.</p>

  <p class="b">DỊCH VỤ HÀNH CHÍNH NHÂN SỰ:</p>
  <table>
    <thead><tr><th>Stt</th><th>Số lượng lao động phát sinh</th><th>LĐ tham gia BHXH</th><th>LĐ không tham gia BHXH</th><th>LĐ tham gia &amp; không tham gia BHXH</th></tr></thead>
    <tbody>${rows(feeTable2)}</tbody>
  </table>
  <p>Đăng ký lao động, hồ sơ BHXH, BHYT, BHTN, Công đoàn lần đầu với số lượng dưới 10 người: 3.000.000đ (chưa bao gồm VAT) và 1.000.000đ/lần phát sinh tăng/giảm hàng tháng.</p>
  <p class="b">Lưu ý:</p>
  <ul>
    <li>Các quận Thủ Đức, quận 2, quận 7, quận 9 phụ thu tiền xăng 200.000đ/tháng. Các Huyện Nhà Bè, Bình Chánh, Hóc Môn, Củ Chi phụ thu tiền xăng 500.000đ/tháng.</li>
    <li>Biểu phí còn phụ thuộc vào tình hình đặc thù của từng doanh nghiệp.</li>
    <li>Giá trên chưa bao gồm thuế giá trị gia tăng và các loại thuế DN phải nộp cho cơ quan thuế.</li>
  </ul>

  <div class="sign">
    <div><p class="role">ĐẠI DIỆN BÊN A</p><div class="gap"></div><p class="nm">${esc(c.representative)}</p></div>
    <div><p class="role">ĐẠI DIỆN BÊN B</p><div class="gap"></div><p class="nm">ĐINH THỊ HUYỀN</p></div>
  </div>
</div>
</body></html>`

  if (format === 'word') {
    const fileName = 'HopDong_' + (c.client_code || c.tax_code || 'KH') + '.doc'
    return new Response(html, {
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(fileName),
      },
    })
  }
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
