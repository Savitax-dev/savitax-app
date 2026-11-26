// Ảnh "Thông báo cung cấp chứng từ" 1080×1350 cho trang /nhac-chung-tu — dựng bằng HTML rồi chụp bằng html2canvas.
// Chép theo bản Savitax đang gửi khách (ảnh Kiều Tiên 26/11/2026), viết gọn lại. Phông: biến --font-thong-bao (app/nhac-chung-tu/layout.js).
import { thangChecklist } from '@/lib/nhacChungTu'

export const RONG = 1080, CAO = 1350

const MUC = [
  ['Toàn bộ hóa đơn mua vào, bán ra', 'Đã cung cấp kết nối hóa đơn điện tử: chỉ cần xác nhận bảng kê mua vào / bán ra Savitax gửi.'],
  ['Sao kê tất cả tài khoản ngân hàng (file Excel)', 'Đã cung cấp thông tin đăng nhập ngân hàng: không cần gửi.'],
  ['Bảng lương nhân viên (nếu có), thông báo kết quả đóng BHXH', 'Đã cung cấp thông tin đăng nhập: không cần gửi.'],
  ['Giấy tờ khác (nếu có)', 'Hợp đồng, dự toán, nghiệm thu, quyết toán công trình, bảng định mức nguyên vật liệu sản xuất…'],
  ['Bộ hồ sơ khai hải quan (nếu có)', 'Tờ khai và chứng từ đi kèm.'],
  ['Giấy nộp tiền BHXH, giấy nộp tiền thuế', 'Nộp bằng tài khoản ngân hàng công ty: không cần gửi.'],
]

export default function AnhThongBao({ ky, kyKhai }) {
  const ck = thangChecklist(ky.nam, ky.thang)
  const han = `${'10'}/${String(ck.thang).padStart(2, '0')}/${ck.nam}`
  const kyBC = kyKhai === 'thang' ? `tháng ${ky.thang}/${ky.nam}` : `Quý ${Math.ceil(ky.thang / 3)}/${ky.nam}`
  const F = 'var(--font-thong-bao), "Be Vietnam Pro", Arial, sans-serif'
  return (
    <div style={{ width: RONG, height: CAO, position: 'relative', overflow: 'hidden', background: '#f7f1e7', color: '#2b1d1d', fontFamily: F }}>
      <div style={{ height: 330, background: 'linear-gradient(135deg,#a10d0d 0%,#7a0d0d 55%,#4d0909 100%)', position: 'relative', padding: '40px 56px', color: '#fff', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -120, top: -140, width: 460, height: 460, borderRadius: '50%', border: '60px solid rgba(227,189,102,.13)' }} />
        <div style={{ display: 'flex', alignItems: 'center', width: 470, height: 120, boxSizing: 'border-box', background: '#fff', borderRadius: 18, padding: '0 24px 0 16px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-savitax.png" alt="" width={92} height={92} style={{ width: 92, height: 92, marginRight: 16, display: 'block' }} />
          <div>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '.06em', color: '#d4a73f', lineHeight: 1 }}>SAVITAX</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: '#9e0b0b', marginTop: 6 }}>Nâng giá trị - Đón thành công</div>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 22, letterSpacing: '.32em', color: '#f3dfae', fontWeight: 600 }}>THÔNG BÁO</div>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }}>CUNG CẤP CHỨNG TỪ</div>
        </div>
        <div style={{ position: 'absolute', right: 56, top: 46, textAlign: 'right' }}>
          <span style={{ display: 'inline-block', background: '#e3bd66', color: '#4d0909', fontWeight: 800, fontSize: 28, padding: '10px 24px', borderRadius: 999 }}>Tháng {ky.thang}/{ky.nam}</span>
          <div style={{ marginTop: 10, fontSize: 21, color: '#f3dfae', fontWeight: 500 }}>Báo cáo thuế {kyBC}</div>
        </div>
      </div>
      <div style={{ margin: '-34px 40px 0', background: '#fff', borderRadius: 26, border: '1px solid #ead9c0', padding: '34px 40px 26px', position: 'relative' }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: '#8b1a1a' }}>Kính gửi Quý khách hàng,</div>
        <div style={{ marginTop: 10, fontSize: 23, lineHeight: 1.5, color: '#3d2b2b' }}>
          Chuẩn bị đến kỳ <b style={{ color: '#8b1a1a' }}>Báo cáo thuế {kyBC}</b>, Quý khách vui lòng tổng hợp các chứng từ <b style={{ color: '#8b1a1a' }}>tháng {ky.thang}/{ky.nam}</b> dưới đây gửi Savitax để làm căn cứ lập báo cáo:
        </div>
        <div style={{ marginTop: 18 }}>
          {MUC.map(([t, g], i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '15px 0', borderTop: i ? '1px dashed #ead9c0' : 0 }}>
              <div style={{ width: 46, height: 46, flex: '0 0 46px', borderRadius: '50%', background: '#8b1a1a', color: '#fff', fontWeight: 800, fontSize: 23, textAlign: 'center', lineHeight: '40px' }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>{t}</div>
                <div style={{ marginTop: 3, fontSize: 19, lineHeight: 1.4, color: '#7a6a63', fontStyle: 'italic' }}>{g}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ margin: '26px 40px 0', display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, borderRadius: 20, padding: '18px 24px', background: '#8b1a1a', color: '#fff' }}>
          <div style={{ fontSize: 19, opacity: 0.85, fontWeight: 500 }}>Hạn gửi chậm nhất</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>Ngày {han}</div>
        </div>
        <div style={{ flex: 1, borderRadius: 20, padding: '18px 24px', background: '#fff3d6', border: '2px solid #e3bd66', color: '#5a3a12' }}>
          <div style={{ fontSize: 19, opacity: 0.85, fontWeight: 500 }}>Không phát sinh chứng từ?</div>
          <div style={{ fontSize: 23, fontWeight: 800, marginTop: 2, lineHeight: 1.3 }}>Vui lòng phản hồi “Không phát sinh”</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 118, background: '#4d0909', color: '#f3dfae', textAlign: 'center', paddingTop: 20, fontSize: 21, lineHeight: 1.55 }}>
        Gửi chứng từ qua <b style={{ color: '#fff' }}>link Google Drive</b> Savitax đã chia sẻ · Góp ý: <b style={{ color: '#fff' }}>0989.666.253 – 0916.084.266</b><br />
        Cảm ơn Quý khách đã tin dùng dịch vụ của Savitax!
      </div>
    </div>
  )
}
