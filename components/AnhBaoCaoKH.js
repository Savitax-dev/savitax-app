// Ảnh "Báo cáo tình hình hoạt động kinh doanh" gửi khách — chép bố cục sheet "5. BC Tháng_Quý" (SVT.MB07) nhân viên
// đang chụp gửi Zalo, viết gọn lại. Rộng 1080px, cao theo số dòng. Chụp bằng html2canvas (components/BaoCaoKhachHang.js).
// Lưu ý html2canvas: không dùng inline-flex, boxShadow; chữ trong ô căn bằng padding/lineHeight.
import { dongIn, nhanKy, vietSo } from '@/lib/baoCaoKh'

export const RONG = 1080
const F = '"Times New Roman", Times, serif'
// Màu thương hiệu Savitax (giống ảnh thông báo chứng từ, menu app): đỏ đô + vàng ánh kim + nền kem
const DO = '#8B1A1A', DO_DAM = '#4d0909', VANG = '#e3bd66', VANG_NHAT = '#f3dfae', KEM = '#F7F1E7', VIEN = '#E2CFA8'

// Ô "Thời gian: Quý 4/2026" dạng ảnh SVG (html2canvas bỏ qua thẻ <svg> nằm tuyệt đối nhưng vẽ được <img>)
function oThoiGian(nhan) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="36" viewBox="0 0 260 36">`
    + `<rect width="260" height="36" rx="18" fill="${VANG}"/>`
    + `<text x="130" y="19" text-anchor="middle" dominant-baseline="central" font-family="Times New Roman, Times, serif" font-size="22" font-weight="700" fill="${DO_DAM}">Thời gian: ${nhan}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export default function AnhBaoCaoKH({ client, ky, soLieu, ghiChu, han }) {
  const dong = dongIn(ky, soLieu, ghiChu, han)
  const o = { border: `1px solid ${VIEN}`, padding: '9px 12px', fontSize: 21, lineHeight: '28px', verticalAlign: 'top' }
  return (
    <div style={{ width: RONG, background: '#fff', color: '#111', fontFamily: F, border: `2px solid ${DO}` }}>
      <div style={{ background: 'linear-gradient(135deg,#a10d0d 0%,#7a0d0d 55%,#4d0909 100%)', color: '#fff', padding: '18px 24px 0', position: 'relative', height: 160, boxSizing: 'border-box', borderBottom: `4px solid ${VANG}` }}>
        <div style={{ position: 'absolute', left: 22, top: 18, width: 104, height: 96, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-savitax.png" alt="" width={84} height={84} style={{ width: 84, height: 84, display: 'block' }} />
        </div>
        <div style={{ marginLeft: 140, marginRight: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '.02em', lineHeight: '38px' }}>BÁO CÁO TÌNH HÌNH HOẠT ĐỘNG KINH DOANH</div>
          <div style={{ fontSize: 25, fontWeight: 700, lineHeight: '33px', marginTop: 4, textTransform: 'uppercase', color: VANG_NHAT }}>{client?.name || ''}</div>
        </div>
        {/* Ô "Thời gian": html2canvas tính lệch dòng chữ Times (ô bị đẩy xuống, chữ lệch dưới) → đặt vị trí cố định
            và vẽ bằng SVG — chữ SVG canh giữa tuyệt đối, ảnh chụp ra giống hệt màn hình. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={'Thời gian: ' + nhanKy(ky)} width={260} height={36} src={oThoiGian(nhanKy(ky))}
          style={{ position: 'absolute', right: 24, bottom: 12, width: 260, height: 36, display: 'block' }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: 92 }} /><col style={{ width: 440 }} /><col style={{ width: 240 }} /><col /></colgroup>
        <thead>
          <tr style={{ background: '#F3E3BF' }}>
            {['Số TT', 'Nội dung báo cáo', 'Số tiền / số chứng từ', 'Ghi chú'].map(t => (
              <th key={t} style={{ ...o, fontWeight: 700, textAlign: 'center', color: DO }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.k} style={{ background: d.k === 'gtgt_kq' ? '#FBEFD9' : i % 2 ? '#FCF8F0' : '#fff' }}>
              <td style={{ ...o, textAlign: 'center', fontWeight: d.phu ? 400 : 700 }}>{d.stt}</td>
              <td style={{ ...o, paddingLeft: d.phu ? 30 : 12, fontWeight: d.k === 'gtgt_kq' ? 700 : 400, fontStyle: d.phu ? 'italic' : 'normal' }}>{d.ten}</td>
              <td style={{ ...o, textAlign: 'right', fontWeight: d.k === 'gtgt_kq' || d.k === 'tndn_con_lai' ? 700 : 400,
                color: d.k === 'gtgt_kq' ? DO : '#111' }}>{d.so === null || d.so === undefined ? '' : vietSo(d.so)}</td>
              <td style={{ ...o, fontSize: 19, color: '#333' }}>{d.gc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ background: KEM, borderTop: `3px solid ${VANG}`, padding: '16px 24px', textAlign: 'center', fontStyle: 'italic', fontWeight: 700, color: DO, fontSize: 21, lineHeight: '30px' }}>
        <div>Savitax xin gửi đến Quý khách hàng báo cáo tình hình kinh doanh của doanh nghiệp.</div>
        <div>Cảm ơn Quý khách hàng đã sử dụng dịch vụ của Savitax!</div>
        <div>Thông tin đóng góp của Quý khách hàng qua số điện thoại: 0989.666.253 – 0916.084.266</div>
      </div>
    </div>
  )
}
