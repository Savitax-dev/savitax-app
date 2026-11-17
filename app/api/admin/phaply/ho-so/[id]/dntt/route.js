// Phân hệ Pháp lý — phiếu đề nghị thanh toán (ĐNTT, mẫu SVT.MB13) cho MỘT đợt thu của hồ sơ.
// Khác phiếu kế toán (/api/admin/dntt): chỉ PHÍ DỊCH VỤ chịu VAT 8% — số lưu gồm VAT nên tách ngược (÷1,08, VAT = phần
// còn lại để cộng lại đúng số đã thoả thuận); THU HỘ (lệ phí nhà nước, khắc dấu, chữ ký số…) KHÔNG chịu VAT, in riêng.
//   GET ?dot=<installment_id>   (bỏ trống = gộp mọi đợt ĐÃ đến hạn còn nợ)
import { requirePhapLy, xemDuoc } from '@/lib/phaply/quyen'
import { docHoSoDayDu, tenNhanVien } from '@/lib/phaply/hoSoMayChu'
import { thuTucLabel } from '@/lib/phaply/hoSo'

const fmt = n => Number(n || 0).toLocaleString('vi-VN')
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return new Response(auth.error, { status: auth.status })
  if (!auth.q.tien) return new Response('Không có quyền xem tiền hồ sơ pháp lý', { status: 403 })
  const { id } = await params
  const d = await docHoSoDayDu(auth.admin, id)
  if (!d || !xemDuoc(auth, d.ho_so)) return new Response('Không tìm thấy hồ sơ', { status: 404 })
  const dotId = new URL(request.url).searchParams.get('dot')
  const hs = d.ho_so, dots = d.tien.dots

  const ky = dotId ? dots.filter(x => x.id === dotId) : dots.filter(x => x.da_den_han && x.con > 0)
  if (dotId && !ky.length) return new Response('Không thấy đợt thu', { status: 404 })
  const truoc = dotId ? dots.filter(x => x.id !== dotId && x.da_den_han && x.con > 0 && Number(x.seq) < Number(ky[0].seq)) : []
  const conDv = ky.reduce((a, x) => a + Math.max(0, x.con_dich_vu), 0)
  const conTh = ky.reduce((a, x) => a + Math.max(0, x.con_thu_ho), 0)
  const A = truoc.reduce((a, x) => a + Math.max(0, x.con), 0)
  const dvChuaVat = Math.round(conDv / 1.08)
  const vat = conDv - dvChuaVat                          // cộng lại đúng số gồm VAT đã thoả thuận
  const B = conDv + conTh, C = A + B
  const tenThuHo = d.fees.filter(f => f.kind === 'thu_ho').map(f => f.name).join(', ') || 'Lệ phí, chi phí nộp thay khách'

  const nv = await tenNhanVien(auth.admin)
  const nguoiDeNghi = nv.get(hs.assigned_to)?.full_name || nv.get(auth.caller.staffId)?.full_name || ''
  const tenKy = dotId ? ky[0].name : 'Các đợt đã đến hạn'
  const qrContent = `${hs.code}_ThanhToan_${dotId ? 'Dot' + ky[0].seq : 'DenHan'}`.replace(/\s+/g, '')
  const qrUrl = 'https://img.vietqr.io/image/ACB-3878556868-qr_only.png?amount=' + C + '&addInfo=' + encodeURIComponent(qrContent) +
    '&accountName=' + encodeURIComponent('CONG TY CP TU VAN THUE SAVITAX')
  const now = new Date()
  const dayStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const han = new Date(now.getTime() + 5 * 86400000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const tenKhach = d.phap_nhan?.name || ''
  const kinhGui = [hs.contact_name, tenKhach].filter(Boolean).join(' — ')

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>ĐNTT - ${esc(hs.code)} - ${esc(tenKhach || hs.contact_name)} - ${esc(tenKy)}</title>
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
  .lbl{background:#e8f0fe;font-weight:bold}.ra{text-align:right}.ca{text-align:center}
  .rowA{background:#fff8e1}.rowB{background:#f1f8e9}.rowC{background:#fce4ec;font-weight:bold}
  .sub{font-style:italic;color:#666;font-size:8.5pt}
  .foot{display:flex;justify-content:space-between;margin-top:12px;align-items:center}
  .qrbox{text-align:center;margin-left:68px}.bankinfo{font-size:8.5pt;margin-top:4px;line-height:1.6;text-align:center}
  .btn{cursor:pointer;border:none;padding:6px 16px;border-radius:5px;font-size:10pt;font-weight:bold;background:#003087;color:#fff}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:8mm}.noprint{display:none!important}}
</style></head><body><div class="page">
  <div class="noprint" style="text-align:right;margin-bottom:8px"><button class="btn" onclick="window.print()">🖨️ In / Lưu PDF</button></div>
  <div class="hdr"><div>
      <div class="cname">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</div>
      <div class="csub">ĐẠI LÝ THUẾ – THÀNH LẬP DOANH NGHIỆP</div>
      <div class="csub">16 Bình Lợi, Phường Bình Lợi Trung, Tp. HCM</div>
      <div class="csub">☎ 0989 666 253 – 0916 084 266 &nbsp;|&nbsp; www.savitax.vn</div>
    </div><div class="docno"><div><b>SVT.MB13</b></div><div>Ngày: ${dayStr}</div></div></div>
  <hr/>
  <div class="title"><h1>PHIẾU ĐỀ NGHỊ THANH TOÁN PHÍ DỊCH VỤ</h1><div class="period">${esc(thuTucLabel(hs.procedure_code))} — ${esc(tenKy)}</div></div>
  <div class="to"><b>Kính gửi:</b> <b>${esc(kinhGui)}</b></div>
  <div class="mst">Mã hồ sơ: ${esc(hs.code)}${d.phap_nhan?.tax_code ? ' &nbsp;|&nbsp; MST: ' + esc(d.phap_nhan.tax_code) : ''}${hs.contact_phone ? ' &nbsp;|&nbsp; ĐT: ' + esc(hs.contact_phone) : ''}</div>
  <table>
    <colgroup><col style="width:9%"><col style="width:58%"><col style="width:20%"><col style="width:13%"></colgroup>
    <thead><tr><th>Mã Số</th><th>Diễn Giải</th><th>Số Tiền</th><th>Ghi Chú</th></tr></thead>
    <tbody>
      <tr class="rowA"><td class="ca lbl">A</td><td class="lbl">Số tiền các đợt trước chưa thanh toán</td><td class="ra">${A > 0 ? fmt(A) + ' đ' : '–'}</td><td></td></tr>
      <tr class="rowB"><td class="ca lbl">B</td><td class="lbl">Số tiền đề nghị thanh toán đợt này</td><td class="ra"><b>${fmt(B)} đ</b></td><td></td></tr>
      ${conDv > 0 ? `<tr><td class="ca">B1</td><td>Phí dịch vụ ${esc(thuTucLabel(hs.procedure_code).toLowerCase())} (chưa VAT)</td><td class="ra">${fmt(dvChuaVat)} đ</td><td></td></tr>
      <tr><td class="ca sub">VAT 8%</td><td class="sub">Thuế VAT 8% trên phí dịch vụ</td><td class="ra sub">${fmt(vat)} đ</td><td></td></tr>` : ''}
      ${conTh > 0 ? `<tr><td class="ca">B${conDv > 0 ? 2 : 1}</td><td>Thu hộ: ${esc(tenThuHo)} <span class="sub">(không chịu VAT)</span></td><td class="ra">${fmt(conTh)} đ</td><td></td></tr>` : ''}
      <tr class="rowC"><td class="ca"><b>C=A+B</b></td><td><b>Tổng số tiền đề nghị thanh toán</b></td><td class="ra" style="color:#c62828;font-size:11pt"><b>${fmt(C)} đ</b></td><td></td></tr>
      <tr><td></td><td>Số tiền thanh toán</td><td class="ra">___________</td><td></td></tr>
      <tr><td></td><td>Số tiền còn lại chưa thanh toán</td><td class="ra">___________</td><td></td></tr>
    </tbody>
  </table>
  <p style="font-size:10pt;margin:6px 0">Đề nghị quý khách thanh toán <b style="color:#c62828">${fmt(C)} đồng</b> trước ngày <b>${han}</b></p>
  <div class="foot">
    <div class="qrbox"><img src="${qrUrl}" alt="QR" style="width:120px;height:120px;display:block" onerror="this.style.display='none'"/>
      <div class="bankinfo"><b>ACB – 3878556868</b><br/>SAVITAX<br/><span style="color:#003087;font-size:7.5pt;word-break:break-all">${esc(qrContent)}</span></div></div>
    <div style="text-align:center;margin-right:68px"><div style="font-size:9pt;font-weight:bold;margin-bottom:4px">Người đề nghị</div>
      <div style="height:44px;border-bottom:1px solid #ccc;width:140px;margin:0 auto"></div>
      <div style="font-weight:bold;font-size:10pt;margin-top:6px">${esc(nguoiDeNghi)}</div></div>
  </div>
</div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
