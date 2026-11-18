// Phân hệ Pháp lý — phiếu đề nghị thanh toán (ĐNTT, mẫu SVT.MB13) của hồ sơ, theo bố cục file Excel phòng pháp lý đang dùng.
// Số liệu: lib/phaply/dntt.js (hàm thuần). Khác phiếu kế toán (/api/admin/dntt): chỉ PHÍ DỊCH VỤ chịu VAT 8% — số lưu gồm VAT nên
// tách ngược (÷1,08); THU HỘ (lệ phí nhà nước, khắc dấu, chữ ký số…) KHÔNG chịu VAT.
//   GET ?dots=<id>,<id>[&no_truoc=1]  các đợt được tick · ?khoan=<fee_id>,…  các khoản phí được tick (hồ sơ chưa chia đợt)
//       (trống) toàn bộ phí hồ sơ trừ phần đã thu · kiểu cũ ?dot=<id> / ?pham_vi=den_han vẫn chạy
import { requirePhapLy, xemDuoc } from '@/lib/phaply/quyen'
import { docHoSoDayDu, tenNhanVien, ghiNhatKy } from '@/lib/phaply/hoSoMayChu'
import { thuTucLabel } from '@/lib/phaply/hoSo'
import { soLieuDntt, ngayVN } from '@/lib/phaply/dntt'

const fmt = n => Number(n || 0).toLocaleString('vi-VN')
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const khongDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/[^A-Za-z0-9]/g, '')
const hoa = s => String(s || '').toLocaleUpperCase('vi-VN')

export async function GET(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return new Response(auth.error, { status: auth.status })
  if (!auth.q.tien) return new Response('Không có quyền xem tiền hồ sơ pháp lý', { status: 403 })
  const { id } = await params
  const d = await docHoSoDayDu(auth.admin, id)
  if (!d || !xemDuoc(auth, d.ho_so)) return new Response('Không tìm thấy hồ sơ', { status: 404 })
  const u = new URL(request.url).searchParams
  const hs = d.ho_so
  const tenThuTuc = thuTucLabel(hs.procedure_code)
  const ds = k => (u.get(k) || '').split(',').map(x => x.trim()).filter(Boolean)
  // ?dot=<id> (kiểu cũ, một đợt + cộng nợ đợt trước) · ?pham_vi=den_han · ?dots=a,b[&no_truoc=1] · ?khoan=feeId,… · (trống) toàn bộ
  let dots = ds('dots'), kemNoTruoc = u.get('no_truoc') === '1'
  if (u.get('dot')) { dots = [u.get('dot')]; kemNoTruoc = true }
  if (u.get('pham_vi') === 'den_han') dots = d.tien.dots.filter(x => x.da_den_han && x.con > 0).map(x => x.id)
  const s = soLieuDntt({ fees: d.fees, tien: d.tien, dots, khoan: ds('khoan'), kemNoTruoc, tenThuTuc: tenThuTuc.toLowerCase() })
  if (!s) return new Response('Không thấy đợt thu', { status: 404 })
  if (!s.tongB && !s.A) return new Response('Hồ sơ chưa có khoản phí nào — nhập các khoản phí ở tab Công nợ rồi bấm "Lưu phí" trước', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  const nv = await tenNhanVien(auth.admin)
  const nguoiDeNghi = nv.get(hs.assigned_to)?.full_name || nv.get(auth.caller.staffId)?.full_name || ''
  const now = Date.now()
  const homNay = ngayVN(now), han = ngayVN(now, 2)       // bản phòng: hạn thanh toán sau 2 ngày
  const [, mm, yyyy] = homNay.split('/')
  const tenKhach = d.phap_nhan?.name || ''
  const noiDung = `${khongDau(hs.code)}_ThanhToan_Phidichvu_${mm}_${yyyy}`
  const qrUrl = 'https://img.vietqr.io/image/ACB-3878556868-qr_only.png?amount=' + Math.max(0, s.C) + '&addInfo=' + encodeURIComponent(noiDung) +
    '&accountName=' + encodeURIComponent('CONG TY CP TU VAN THUE SAVITAX')
  await ghiNhatKy(auth.admin, id, 'edit', null, null, auth.caller.staffId, `Xuất ĐNTT (${s.tenKy}): ${fmt(s.C)} đ`)

  const dongB = s.dong.map(x => `<tr${x.loai === 'vat' ? ' class="sub"' : ''}><td class="ca">${x.ma}</td><td>${esc(x.ten)}${x.loai === 'thu_ho' ? ' <span class="sub">(thu hộ, không chịu VAT)</span>' : ''}</td><td class="ra">${fmt(x.tien)}</td><td></td></tr>`).join('')
  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>ĐNTT - ${esc(hs.code)} - ${esc(tenKhach || hs.contact_name)} - ${esc(s.tenKy)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#111;background:#fff}
  .page{width:190mm;margin:0 auto;padding:12mm 12mm 8mm}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .cname{font-weight:bold;font-size:13pt;color:#003087}
  .csub{font-size:10pt;color:#444;line-height:1.5}
  .docno{font-size:10pt;color:#444;text-align:right}
  hr{border:none;border-top:2px solid #003087;margin:6px 0}
  .to{margin:8px 0 2px;line-height:1.6}
  .title{text-align:center;margin:10px 0 4px}
  .title h1{font-size:14pt;font-weight:bold;text-transform:uppercase}
  .period{font-size:12pt;color:#003087;font-weight:bold}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11.5pt}
  th,td{border:1px solid #555;padding:4px 6px;vertical-align:middle}
  th{background:#003087;color:#fff;text-align:center;font-weight:bold}
  .lbl{font-weight:bold}.ra{text-align:right;white-space:nowrap}.ca{text-align:center}
  .rowA{background:#fff8e1}.rowB{background:#f1f8e9}.rowC{background:#fce4ec;font-weight:bold}
  .sub{font-style:italic;color:#555}
  .foot{display:flex;justify-content:space-between;margin-top:10px;align-items:flex-start}
  .ky{text-align:center;width:45%}
  .btn{cursor:pointer;border:none;padding:6px 16px;border-radius:5px;font-size:11pt;font-weight:bold;background:#003087;color:#fff}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:8mm}.noprint{display:none!important}}
</style></head><body><div class="page">
  <div class="noprint" style="text-align:right;margin-bottom:8px"><button class="btn" onclick="window.print()">🖨️ In / Lưu PDF</button></div>
  <div class="hdr"><div>
      <div class="cname">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</div>
      <div class="csub">16 Bình Lợi, Phường Bình Lợi Trung, Tp. HCM</div>
      <div class="csub">Website: www.savitax.vn &nbsp;·&nbsp; Di động: 0989 666 253 – 0916 084 266</div>
    </div><div class="docno"><div><b>SVT.MB13</b></div><div>Mã hồ sơ: ${esc(hs.code)}</div></div></div>
  <hr/>
  <div class="to">
    <div><b>Kính gửi:</b> <b>${esc(hs.contact_name || tenKhach)}</b>${hs.contact_phone ? ' &nbsp;·&nbsp; ĐT: ' + esc(hs.contact_phone) : ''}</div>
    ${tenKhach && tenKhach !== hs.contact_name ? `<div><b>Doanh nghiệp:</b> ${esc(tenKhach)}${d.phap_nhan?.tax_code ? ' &nbsp;·&nbsp; MST: ' + esc(d.phap_nhan.tax_code) : ''}</div>` : ''}
  </div>
  <div class="title"><h1>Phiếu đề nghị thanh toán phí dịch vụ</h1><div class="period">${esc(tenThuTuc)} — ${esc(s.tenKy)} — ${mm}/${yyyy}</div></div>
  <table>
    <colgroup><col style="width:8%"><col style="width:52%"><col style="width:17%"><col style="width:11%"><col style="width:12%"></colgroup>
    <thead><tr><th>Mã số</th><th>Diễn giải</th><th>Số tiền</th><th>Ngày ghi nhận</th><th>Ghi chú</th></tr></thead>
    <tbody>
      <tr class="rowA"><td class="ca lbl">A</td><td class="lbl">Số tiền còn lại kỳ trước chuyển sang</td><td class="ra">${s.A ? fmt(s.A) : '–'}</td><td></td><td></td></tr>
      <tr class="rowB"><td class="ca lbl">B</td><td class="lbl">Số tiền phát sinh kỳ này</td><td class="ra"><b>${fmt(s.tongB)}</b></td><td></td>
        <td rowspan="${s.dong.length + 1}" class="sub" style="font-size:9.5pt">Phí đã bao gồm VAT. Trường hợp có thay đổi sẽ phụ thu thêm phí (nếu có)</td></tr>
      ${dongB}
      ${s.daTra ? `<tr><td class="ca">–</td><td>Trừ: số tiền quý khách đã thanh toán</td><td class="ra">-${fmt(s.daTra)}</td><td></td><td></td></tr>` : ''}
      <tr class="rowC"><td class="ca">C</td><td>Tổng số tiền đề nghị thanh toán kỳ này C = A + B${s.daTra ? ' − đã thanh toán' : ''}</td><td class="ra" style="color:#c62828">${fmt(s.C)}</td><td class="ca">${homNay}</td><td></td></tr>
      <tr><td class="ca">D</td><td>Số tiền thanh toán kỳ này</td><td></td><td class="ca">…/…/${yyyy}</td><td></td></tr>
      <tr><td class="ca">E</td><td>Số tiền còn lại chưa thanh toán</td><td></td><td class="ca">…/…/${yyyy}</td><td></td></tr>
    </tbody>
  </table>
  <p style="margin:6px 0">Đề nghị quý khách hàng thanh toán số tiền trên trước ngày <b>${han}</b>.</p>
  <div style="display:flex;gap:14px;align-items:center;margin:6px 0">
    <img src="${qrUrl}" alt="QR" style="width:110px;height:110px" onerror="this.style.display='none'"/>
    <div style="line-height:1.8">
      <div>Số tài khoản: <b>3878556868</b> — Ngân hàng ACB – PGD Bạch Đằng</div>
      <div>Tên tài khoản: <b>CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</b></div>
      <div>Nội dung: <b style="color:#003087">${esc(noiDung)}</b></div></div>
  </div>
  <div class="foot">
    <div class="ky"><b>Người đề nghị</b><div style="height:70px"></div><b>${esc(hoa(nguoiDeNghi))}</b></div>
    <div class="ky"><b>Xác nhận</b> <i>ngày …/…/${yyyy}</i><div style="height:70px"></div><b>${esc(hoa(hs.contact_name))}</b></div>
  </div>
</div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
