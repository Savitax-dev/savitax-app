'use client'
// Bản gửi khách hàng — màn Tăng trưởng & phí (kế hoạch mục 3b): trang khổ A4, logo và màu Savitax, 6 đồ thị + bảng quý,
// nhận xét CHỈ NÊU SỐ, mục "Đề xuất điều chỉnh phí dịch vụ" (chỉ khi người xem có quyền xem phí; bật mặc định, tắt được).
// KHÔNG hiện cho khách: phí theo biểu phí ở mốc, cảnh báo nội bộ của engine, tên nhân viên phụ trách.
// In / lưu PDF bằng hộp in của trình duyệt — không tạo file trên máy chủ, không ghi vào Drive.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CHI_TIEU, nhanXetKhach, deXuatPhiKhach, soSanh } from '@/lib/phanTich/tangTruong'

const MAU = { doanhThu: '#8B1A1A', laoDong: '#7C3AED', hdVao: '#2563EB', hdRa: '#059669', haiQuan: '#D97706', saoKe: '#0891B2', chungTu: '#B8860B' }
const SO_QUY_IN = 8   // khổ A4 đứng in vừa 8 quý gần nhất
const soCT = (k, v) => (v == null ? '—' : k === 'doanhThu' ? (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
const tien = n => (n == null ? '—' : Math.round(n).toLocaleString('vi-VN'))

// canCu: các đoạn căn cứ đề xuất (đã qua ô sửa ở khối phí) — có thì in đúng nội dung này thay câu mặc định
export default function BanGuiKhach({ cty, quy, iMoc, phiNay, phiDangThu, phiDeXuat, canCu, coPhi, onDong }) {
  const [coDeXuat, setCoDeXuat] = useState(!!coPhi)
  const iCuoi = quy.length - 1
  const cuoi = quy[iCuoi]
  const tu = Math.max(0, quy.length - SO_QUY_IN)
  const dsQ = quy.slice(tu)
  const nx = nhanXetKhach(quy, iCuoi)
  const dxGoc = coPhi && coDeXuat ? deXuatPhiKhach(quy, iCuoi, iMoc, phiNay, phiDangThu, phiDeXuat) : null
  const dx = dxGoc && canCu ? { ...dxGoc, doan: canCu } : dxGoc
  const homNay = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-300/90 overflow-auto ban-gui-khach">
      <style>{`
        .ban-a4 { width: 210mm; min-height: 297mm; padding: 14mm 14mm 12mm; background: #fff; margin: 0 auto 24px; box-shadow: 0 6px 30px rgba(0,0,0,.18);
          -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11.5px; color: #1f2937; }
        .ban-a4 table { border-collapse: collapse; width: 100%; }
        .ban-a4 th, .ban-a4 td { border: 1px solid #DCE2EB; padding: 5px 7px; }
        .ban-a4 thead th { background: #8B1A1A; color: #fff; font-weight: 600; }
        .ban-a4 tbody tr:nth-child(even) td { background: #F2F6FC; }
        /* In: bản này gắn thẳng vào <body> (portal) nên bỏ HẲN phần trang còn lại (display:none) — trước đây chỉ ẩn
           (visibility) nên phần trang ẩn vẫn chiếm chỗ, in ra thêm trang trắng (in thử 27/10/2026: 3 trang, trang 3 trắng).
           Lề đặt ở @page để trang 2 (nếu tràn) cũng có lề; khối không cắt đôi giữa hai trang. */
        @media print {
          @page { size: A4; margin: 10mm 12mm; }
          /* Thu nhỏ nhẹ để đầu trang + đồ thị + bảng quý + nhận xét vừa MỘT trang A4; mục đề xuất phí dài thì sang trang 2 */
          .ban-gui-khach .ban-a4 { zoom: .92; }
          body > *:not(.ban-gui-khach) { display: none !important; }
          .ban-gui-khach { position: static !important; overflow: visible !important; background: #fff !important; }
          .khong-in { display: none !important; }
          .ban-a4 { box-shadow: none; margin: 0; padding: 0; width: auto; min-height: 0; }
          .ban-khoi { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Thanh điều khiển — không in */}
      <div className="khong-in sticky top-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 bg-white/95 border-b border-slate-200 shadow-sm mb-6">
        <p className="font-bold text-gray-800">Bản gửi khách hàng · {cty.ten}</p>
        {coPhi && (
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={coDeXuat} onChange={e => setCoDeXuat(e.target.checked)} /> Có mục đề xuất điều chỉnh phí
          </label>
        )}
        <span className="text-xs text-gray-500">In → chọn “Lưu dưới dạng PDF” để gửi khách. Bản này không có phí ở mốc, cảnh báo nội bộ hay tên nhân viên.</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => window.print()} className="px-4 py-1.5 rounded-xl text-sm text-white font-semibold bg-[#8B1A1A] hover:bg-[#6B1212]">🖨 In / lưu PDF</button>
          <button type="button" onClick={onDong} className="px-4 py-1.5 rounded-xl text-sm border border-gray-300 bg-white text-gray-700">Đóng</button>
        </div>
      </div>

      <div className="ban-a4">
        {/* Tiêu đề */}
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '3px solid #8B1A1A' }}>
          {/* Logo đầy đủ (biểu tượng + chữ SAVITAX + "Nâng giá trị – Đón thành công") — anh chọn 27/10/2026, dùng chung với
              hợp đồng dịch vụ. Logo đã có khẩu hiệu nên không viết lại khẩu hiệu bên cạnh. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-savitax-hddv.png" alt="Savitax — Nâng giá trị, Đón thành công" style={{ height: 64 }} />
          {/* Thông tin công ty ghi y như phiếu đề nghị thanh toán (app/api/admin/dntt) — đổi địa chỉ / số máy thì sửa cả hai */}
          <div className="flex-1 leading-[1.5]">
            <p className="font-bold text-[13.5px] text-[#8B1A1A] tracking-wide">CÔNG TY CỔ PHẦN TƯ VẤN THUẾ SAVITAX</p>
            <p className="text-[10.5px] text-gray-600">ĐẠI LÝ THUẾ – THÀNH LẬP DOANH NGHIỆP</p>
            <p className="text-[10.5px] text-gray-600">16 Bình Lợi, Phường Bình Lợi Trung, Tp. HCM</p>
            <p className="text-[10.5px] text-gray-600">☎ 0989 666 253 – 0916 084 266 &nbsp;|&nbsp; www.savitax.vn</p>
          </div>
          <p className="text-[11px] text-gray-500">Ngày {homNay}</p>
        </div>
        <p className="text-center font-bold text-[16px] text-[#8B1A1A] mt-5 leading-snug">BÁO CÁO TÌNH HÌNH HOẠT ĐỘNG<br />VÀ KHỐI LƯỢNG CÔNG VIỆC KẾ TOÁN</p>
        <p className="text-center text-[12px] mt-2"><b>Kính gửi:</b> {cty.ten}{cty.mst ? ` · MST ${cty.mst}` : ''}</p>
        <p className="text-center text-[11px] text-gray-600">Giai đoạn {dsQ[0].ma.replace('Q', 'quý ').replace('/', '/20')} – {cuoi.ma.replace('Q', 'quý ').replace('/', '/20')}</p>

        {/* 6 đồ thị */}
        <div className="grid grid-cols-3 gap-2.5 mt-5 ban-khoi">
          {CHI_TIEU.map(c => {
            const vs = dsQ.map(q => q.chiTieu[c.k]?.v ?? null)
            const max = Math.max(1, ...vs.filter(v => v != null))
            const ss = soSanh(quy, iCuoi, c.k)
            const p = ss.cungKy ?? ss.qTruoc
            return (
              <div key={c.k} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${MAU[c.k]}55` }}>
                <p className="px-2.5 py-1 text-white text-[11px] font-bold" style={{ background: MAU[c.k] }}>{c.nhan}</p>
                <div className="px-2.5 pt-1.5 pb-2">
                  <p><span className="text-[18px] font-bold" style={{ color: MAU[c.k] }}>{soCT(c.k, cuoi.chiTieu[c.k]?.v)}</span> <span className="text-[10px] text-gray-500">{cuoi.chiTieu[c.k]?.v == null ? 'chưa có số liệu' : `${c.k === 'doanhThu' ? 'tỷ đồng' : c.donVi} · ${cuoi.ma}`}</span></p>
                  <p className="text-[10px] text-gray-500 h-[13px]">{p == null ? '' : `${p >= 0 ? '▲ +' : '▼ '}${(p * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so ${ss.cungKy != null ? 'cùng kỳ' : 'quý trước'}`}</p>
                  <div className="flex items-end gap-[3px] h-[42px] mt-1">
                    {vs.map((v, i) => <div key={i} className="flex-1 rounded-t-sm" style={{ height: v == null ? 2 : Math.max(2, (v / max) * 42), background: v == null ? '#E5E7EB' : i === vs.length - 1 ? MAU[c.k] : MAU[c.k] + '66' }} />)}
                  </div>
                  <div className="flex justify-between text-[8.5px] text-gray-400 mt-0.5"><span>{dsQ[0].ma}</span><span>{cuoi.ma}</span></div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bảng quý */}
        <div className="ban-khoi">
        <p className="font-bold text-[12.5px] text-[#8B1A1A] mt-5 mb-1.5">1. Số liệu theo quý</p>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Chỉ tiêu</th>{dsQ.map(q => <th key={q.ma} style={{ textAlign: 'right' }}>{q.ma}</th>)}</tr></thead>
          <tbody>
            {[...CHI_TIEU, { k: 'chungTu', nhan: 'Chứng từ kế toán/tháng' }].map(c => (
              <tr key={c.k}>
                <td style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: MAU[c.k], marginRight: 6 }} />{c.k === 'doanhThu' ? 'Doanh thu (tỷ đồng)' : c.nhan}</td>
                {/* Chứng từ/tháng của quý thiếu nguồn là số thấp giả → in "—" cho khách */}
                {dsQ.map((q, i) => <td key={q.ma} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: i === dsQ.length - 1 ? 700 : 400 }}>{c.k === 'chungTu' && q.chiTieu.chungTu.thieu ? '—' : soCT(c.k, q.chiTieu[c.k]?.v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9.5px] text-gray-500 mt-1">Chứng từ kế toán/tháng = (hóa đơn đầu vào + hóa đơn đầu ra + giao dịch sao kê ngân hàng) ÷ 3. “—”: chưa có số liệu trong hồ sơ.</p>
        </div>

        {/* Nhận xét — chỉ nêu số */}
        <div className="ban-khoi">
          <p className="font-bold text-[12.5px] text-[#8B1A1A] mt-4 mb-1">2. Tình hình quý {cuoi.so}/{cuoi.nam}</p>
          <ul className="space-y-0.5 text-[11.5px]">{nx.map((c, i) => <li key={i}>• {c}</li>)}</ul>
        </div>

        {/* Đề xuất phí */}
        {dx && (
          <div className="ban-khoi">
            <p className="font-bold text-[12.5px] text-[#8B1A1A] mt-4 mb-1">3. Đề xuất điều chỉnh phí dịch vụ</p>
            <div className="space-y-1 text-[11.5px] text-justify">{dx.doan.map((c, i) => <p key={i}>{c}</p>)}</div>
            {/* Rộng hết khung, thẳng mép với bảng số liệu phía trên (anh chỉ 27/10/2026) */}
            <table className="mt-2" style={{ width: '100%' }}>
              <colgroup><col /><col style={{ width: '32%' }} /></colgroup>
              <tbody>
                {dx.phiDangThu != null && <tr><td>Phí dịch vụ kế toán hiện tại</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{tien(dx.phiDangThu)} đ/tháng</td></tr>}
                <tr><td><b>Phí dịch vụ kế toán đề xuất</b></td><td style={{ textAlign: 'right', fontWeight: 700, color: '#8B1A1A' }}>{tien(dx.phiDeXuat)} đ/tháng</td></tr>
                {dx.chenh != null && <tr><td>Chênh lệch</td><td style={{ textAlign: 'right' }}>{dx.chenh >= 0 ? '+' : '−'}{tien(Math.abs(dx.chenh))} đ/tháng</td></tr>}
              </tbody>
            </table>
            <p className="text-[10.5px] italic text-gray-600 mt-1">{dx.ghiChu}</p>
          </div>
        )}

        <div className="mt-6 pt-2 text-[9.5px] text-gray-500 flex justify-between" style={{ borderTop: '1px solid #E5E7EB' }}>
          <span>Số liệu tổng hợp từ hồ sơ kế toán của Quý Công ty do Savitax thực hiện và lưu trữ.</span>
          <span style={{ color: '#B8860B' }}>SAVITAX</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
