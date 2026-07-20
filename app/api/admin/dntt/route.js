import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

// GET /api/admin/dntt?clientId=xxx&month=6&year=2026
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const month    = Number(searchParams.get('month') || new Date().getMonth() + 1)
  const year     = Number(searchParams.get('year')  || new Date().getFullYear())
  // Extra rows passed from UI panel: [{desc, amount}]
  let extraRows = []
  try { extraRows = JSON.parse(searchParams.get('extra') || '[]') } catch (_) {}
  const b1LabelParam  = searchParams.get('b1Label')
  const b1AmountParam = searchParams.get('b1Amount')

  if (!clientId) return new Response('Missing clientId', { status: 400 })

  const supabase = getAdmin()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, tax_code, monthly_fee, assigned_to, address, tax_status, client_code, representative, other_debt')
    .eq('id', clientId).single()

  if (!client) return new Response('Client not found', { status: 404 })

  const { data: staff } = await supabase
    .from('staff').select('full_name').eq('id', client.assigned_to).single()

  // b1AmountParam (panel ĐNTT gửi lên) đã được tách VAT sẵn — dùng thẳng. Chỉ khi KHÔNG có param
  // (fallback lấy trực tiếp client.monthly_fee — số đã bao gồm VAT nhập ở "Thêm công ty") mới cần
  // tách VAT ra lấy B1 (chưa VAT).
  const baseFee = b1AmountParam !== null && b1AmountParam !== ''
    ? Number(b1AmountParam) || 0
    : Math.round((Number(client.monthly_fee) || 0) / 1.08)
  const b1Label    = b1LabelParam || ('Phí dịch vụ kế toán ' + 'Tháng ' + month + '/' + year + ' (chưa VAT)')
  const extraTotal = extraRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const subTotal   = baseFee + extraTotal        // tổng trước VAT (B1 đã tách VAT + B2...B7 vốn đã chưa VAT)
  const prevBal    = Number(client.other_debt) || 0
  // "Tồn" (A) đã là số gồm VAT sẵn (cộng dồn từ phí dịch vụ chưa thu, vốn đã gồm VAT) — lấy thẳng, không nhân 1.08 nữa
  const prevBalVat = prevBal
  const vatAmt     = Math.round(subTotal * 0.08)
  const totalB     = subTotal + vatAmt
  const totalC     = prevBalVat + totalB

  // QR VietQR
  const monthPad  = String(month).padStart(2, '0')
  const clientCode = client.client_code || client.tax_code || ''
  const qrContent  = clientCode + '_ThanhToanPhiDichvu_T' + monthPad + '_Savitax'
  const bankId     = 'ACB'
  const accountNo  = '3878556868'
  const qrUrl = 'https://img.vietqr.io/image/' + bankId + '-' + accountNo +
    '-qr_only.png?amount=' + totalC +
    '&addInfo=' + encodeURIComponent(qrContent) +
    '&accountName=' + encodeURIComponent('CONG TY CP TU VAN THUE SAVITAX')

  const dayStr    = new Date().toLocaleDateString('vi-VN')
  const monthLabel = 'Tháng ' + month + '/' + year
  const repLine   = client.representative
    ? client.representative + ' - Giám đốc'
    : 'Giám đốc'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>ĐNTT - ${client.client_code ? client.client_code + ' - ' : ''}${client.name} - ${monthLabel}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111;background:#fff}
  .page{width:190mm;margin:0 auto;padding:12mm 12mm 8mm}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .cname{font-weight:bold;font-size:12pt;color:#003087}
  .csub{font-size:8.5pt;color:#555;line-height:1.5}
  .docno{font-size:8.5pt;color:#555;text-align:right}
  hr{border:none;border-top:2px solid #003087;margin:6px 0}
  .title{text-align:center;margin:8px 0 4px}
  .title h1{font-size:13pt;font-weight:bold;text-transform:uppercase}
  .period{font-size:11pt;color:#003087;font-weight:bold}
  .to{margin:8px 0 4px;font-size:10.5pt}
  .mst{font-size:9pt;color:#666;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt}
  th,td{border:1px solid #555;padding:4px 6px;vertical-align:middle}
  th{background:#003087;color:#fff;text-align:center;font-weight:bold;font-size:9pt}
  .lbl{background:#e8f0fe;font-weight:bold}
  .ra{text-align:right}
  .ca{text-align:center}
  .rowA{background:#fff8e1}
  .rowB{background:#f1f8e9}
  .rowC{background:#fce4ec;font-weight:bold}
  .note{font-style:italic;font-size:8.5pt;color:#555;margin:3px 0}
  .deadline{font-size:10pt;margin:6px 0}
  .foot{display:flex;gap:16px;margin-top:12px;align-items:flex-start}
  .qrbox{text-align:center;flex-shrink:0}
  .qrbox img{width:110px;height:110px;display:block;margin:0 auto}
  .qrlbl{font-size:8pt;color:#333;margin-top:4px;line-height:1.5}
  .bankinfo{font-size:8.5pt;margin-top:4px;line-height:1.6;text-align:center}
  .signbox{text-align:center;min-width:100px}
  .signtitle{font-size:8.5pt;font-weight:bold}
  .signspace{height:36px}
  .signname{font-weight:bold;font-size:9.5pt}
  .savfoot{background:#003087;color:#fff;padding:6px 10px;border-radius:5px;font-size:8.5pt;line-height:1.7;margin-top:8px}
  .hidden{display:none}
  .btn{cursor:pointer;border:none;padding:6px 16px;border-radius:5px;font-size:10pt;font-weight:bold}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{padding:8mm}
    .noprint{display:none!important}
  }
</style>
</head>
<body>
<div class="page">
  <div class="noprint" style="text-align:right;margin-bottom:8px;display:flex;gap:8px;justify-content:flex-end;align-items:center">
    <button class="btn" style="background:#003087;color:#fff" onclick="window.print()">🖨️ In / Lưu PDF</button>
  </div>

  <div class="hdr">
    <div>
      <div class="cname">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</div>
      <div class="csub">ĐẠI LÝ THUẾ – THÀNH LẬP DOANH NGHIỆP</div>
      <div class="csub">16 Bình Lợi, Phường Bình Lợi Trung, Tp. HCM</div>
      <div class="csub">☎ 0989 666 253 – 0916 084 266 &nbsp;|&nbsp; www.savitax.vn</div>
    </div>
    <div class="docno">
      <div><b>SVT.MB13</b></div>
      <div>Ngày: ${dayStr}</div>
    </div>
  </div>
  <hr/>

  <div class="title">
    <h1>PHIẾU ĐỀ NGHỊ THANH TOÁN PHÍ DỊCH VỤ</h1>
    <div class="period">${monthLabel}</div>
  </div>

  <div class="to">
    <b>Kính gửi:</b> ${repLine}: <b>${client.name}</b>
  </div>
  <div class="mst">MST: ${client.tax_code || ''}${client.address ? ' &nbsp;|&nbsp; Địa chỉ: ' + client.address : ''}</div>

  <table>
    <colgroup>
      <col style="width:7%"><col style="width:48%"><col style="width:19%"><col style="width:13%"><col style="width:13%">
    </colgroup>
    <thead>
      <tr><th>Mã Số</th><th>Diễn Giải</th><th>Số Tiền</th><th>Ngày Ghi Nhận</th><th>Ghi Chú</th></tr>
    </thead>
    <tbody>
      <tr class="rowA">
        <td class="ca lbl">A</td>
        <td class="lbl">Số tiền còn lại kỳ trước chuyển sang (đã gồm VAT 8%)</td>
        <td class="ra">${prevBal > 0 ? fmt(prevBalVat) + ' đ' : '–'}</td>
        <td></td><td></td>
      </tr>
      <tr class="rowB">
        <td class="ca lbl">B</td>
        <td class="lbl">Số tiền phát sinh kỳ này</td>
        <td class="ra"><b id="totalB">${fmt(totalB)} đ</b></td>
        <td></td><td></td>
      </tr>
      <tr>
        <td class="ca">B1</td>
        <td>${b1Label}</td>
        <td class="ra" id="b1amt">${fmt(baseFee)} đ</td>
        <td class="ca">${dayStr}</td><td></td>
      </tr>
      ${extraRows.map((r, i) => `
      <tr>
        <td class="ca">B${i+2}</td>
        <td>${r.desc || ''}</td>
        <td class="ra">${r.amount ? fmt(Number(r.amount)) + ' đ' : ''}</td>
        <td class="ca">${dayStr}</td><td></td>
      </tr>`).join('')}
      <!-- Hidden editable rows for adding more in HTML view -->
      ${[2,3,4,5,6,7].filter(n => n > extraRows.length + 1).map(n => `
      <tr id="xrow${n}" style="display:none">
        <td class="ca">B${n}</td>
        <td contenteditable="true" style="color:#1565c0"></td>
        <td contenteditable="true" class="ra" style="color:#1565c0"></td>
        <td contenteditable="true"></td>
        <td class="ca noprint"><button onclick="this.closest('tr').style.display='none';recalc()" style="color:#c00;border:none;background:none;cursor:pointer">✕</button></td>
      </tr>`).join('')}
      <tr>
        <td class="ca" style="color:#666;font-size:8.5pt">VAT 8%</td>
        <td style="font-style:italic;color:#666;font-size:8.5pt">Thuế VAT 8% (trên tổng phí chưa VAT)</td>
        <td class="ra" style="color:#666" id="vatAmt">${fmt(vatAmt)} đ</td>
        <td></td><td></td>
      </tr>
      <tr class="rowC">
        <td class="ca"><b>C=A+B</b></td>
        <td><b>Tổng số tiền đề nghị thanh toán kỳ này</b></td>
        <td class="ra" style="color:#c62828;font-size:11pt"><b id="totalC">${fmt(totalC)} đ</b></td>
        <td></td><td></td>
      </tr>
      <tr>
        <td></td>
        <td>Số tiền thanh toán kỳ này</td>
        <td class="ra">___________</td>
        <td></td><td></td>
      </tr>
      <tr>
        <td></td>
        <td>Số tiền còn lại chưa thanh toán</td>
        <td class="ra">___________</td>
        <td></td><td></td>
      </tr>
    </tbody>
  </table>

  <div class="noprint" style="margin:4px 0">
    <button onclick="addRow()" id="btnAdd" style="background:#1565c0;color:#fff;border:none;border-radius:5px;padding:4px 12px;cursor:pointer;font-size:8.5pt;font-weight:bold">
      + Thêm dòng
    </button>
    <span id="addLabel" style="font-size:8pt;color:#1565c0;margin-left:6px"></span>
  </div>
  <p class="note">(Phí chưa bao gồm VAT 8%. Trường hợp có thay đổi sẽ phụ thu thêm phí nếu có)</p>
  <p class="deadline">
    Đề nghị quý khách thanh toán <b style="color:#c62828" id="dlAmt">${fmt(totalC)} đồng</b> trước ngày <b>20/${month}/${year}</b>
  </p>

  <div class="foot" style="align-items:center">
    <!-- QR only -->
    <div class="qrbox">
      <img src="${qrUrl}" alt="QR" style="width:120px;height:120px;display:block" onerror="this.style.display='none'"/>
      <div class="bankinfo">
        <b>ACB – 3878556868</b><br/>
        SAVITAX<br/>
        <span style="color:#003087;font-size:7.5pt;word-break:break-all">${qrContent}</span>
      </div>
    </div>

    <!-- Người đề nghị — centered in remaining space -->
    <div style="flex:1;display:flex;align-items:center;justify-content:center">
      <div style="text-align:center">
        <div style="font-size:9pt;font-weight:bold;margin-bottom:4px">Người đề nghị</div>
        <div style="height:44px;border-bottom:1px solid #ccc;width:140px;margin:0 auto"></div>
        <div style="font-weight:bold;font-size:10pt;margin-top:6px">${staff ? staff.full_name : ''}</div>
      </div>
    </div>
  </div>
</div>

<script>
var shown = 0
var startIdx = ${extraRows.length + 2} // B rows already filled
var allRows = [2,3,4,5,6,7].filter(function(n){ return n >= startIdx })
var rows = allRows.map(function(n){ return 'xrow'+n })
var baseFeeVal = ${baseFee}
var prevBalVal = ${prevBalVat}

function addRow() {
  if (shown < rows.length) {
    var rowId = rows[shown]
    document.getElementById(rowId).style.display = ''
    shown++
    var lbl = document.getElementById('addLabel')
    if (lbl) lbl.innerText = 'Đã thêm dòng B' + (shown + 1)
    if (shown >= rows.length) {
      var btn = document.getElementById('btnAdd')
      if (btn) btn.style.display = 'none'
    }
    recalc()
  }
}

function parseAmt(str) {
  if (!str) return 0
  return parseInt(str.replace(/[^0-9]/g,'')) || 0
}

function recalc() {
  // Sum of extra rows (B2-B7)
  var extra = 0
  for (var i = 0; i < rows.length; i++) {
    var row = document.getElementById(rows[i])
    if (row && row.style.display !== 'none') {
      var cells = row.querySelectorAll('td[contenteditable]')
      // 2nd contenteditable = amount column
      if (cells[1]) extra += parseAmt(cells[1].innerText)
    }
  }
  // VAT chỉ tính trên B (B1 + B2...B7) — A (nợ tồn) đã hiển thị gồm VAT riêng (A×1.08) ở trên
  var subTotal = baseFeeVal + extra
  var vatAmt   = Math.round(subTotal * 0.08)
  var totalB   = subTotal + vatAmt
  var totalC   = prevBalVal + totalB
  var f = function(n){ return n.toLocaleString('vi-VN') }

  var vatEl = document.getElementById('vatAmt')
  var bEl   = document.getElementById('totalB')
  var cEl   = document.getElementById('totalC')
  var dlEl  = document.getElementById('dlAmt')
  if (vatEl) vatEl.innerText = f(vatAmt) + ' đ'
  if (bEl)   bEl.innerText   = f(totalB) + ' đ'
  if (cEl)   cEl.innerText   = f(totalC) + ' đ'
  if (dlEl)  dlEl.innerText  = f(totalC) + ' đồng'
}

document.addEventListener('input', function(e) {
  if (e.target.hasAttribute('contenteditable')) recalc()
})
</script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
