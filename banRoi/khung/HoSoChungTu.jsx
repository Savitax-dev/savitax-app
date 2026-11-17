// Bản rời — khung của phân hệ Hồ sơ chứng từ. Mã phân hệ (banRoi/hoSoChungTu/0…6-*.js) là JS thuần chép từ app Hồ sơ chứng từ
// V2.0.0, tự dựng giao diện bằng innerHTML + gắn sự kiện theo id — KHÔNG viết lại thành React (giữ nguyên logic đã chạy được).
// Khung này:
//   1. dựng MỘT lần khối DOM của phân hệ (trang.html, bọc trong div.hsct — CSS phân hệ đã được bọc dưới .hsct lúc dựng);
//   2. gắn khối đó vào trang mỗi khi mở #/ho-so-chung-tu, tháo ra (vẫn giữ trong bộ nhớ) khi chuyển trang → quay lại vẫn
//      đúng chỗ đang làm, không chạy lại mã;
//   3. nối phân hệ với bản rời qua window.__hsct (NOI): kho IndexedDB, logo / tên đơn vị, ngày nghỉ lễ, danh sách công ty.
// Danh sách công ty của bản rời = "khách hàng đang làm" của phân hệ; "Công ty đang làm" ở menu trái chọn khách hàng ở đây.
import { useEffect, useRef } from 'react'
import JSZip from 'jszip'
import * as pdfjs from 'pdfjs-dist'
import html2pdf from 'html2pdf.js'
import AppShell from './AppShell'
import { useKho, layKho, datCaiDat, ngayLeSet, chuanMst, timTheoMst, docHoSoChungTu, luuHoSoChungTu, theHeHoSoChungTu } from '../kho'
import LOGO_SAVITAX from '../../public/logo-savitax.png'
import TRANG from '../hoSoChungTu/trang.html?text'
import M0 from '../hoSoChungTu/0-duLieuMau.js?text'
import M1 from '../hoSoChungTu/1-mauChungTu.js?text'
import M2 from '../hoSoChungTu/2-boHoSo.js?text'
import M3 from '../hoSoChungTu/3-xlsx.js?text'
import M4 from '../hoSoChungTu/4-docPdf.js?text'
import M5 from '../hoSoChungTu/5-core.js?text'
import M6 from '../hoSoChungTu/6-giaoDien.js?text'

// Logo in trên phiếu kiểm tra hồ sơ: vừa khung 150 × 60 px, giữ tỷ lệ. Đo lại khi đơn vị đổi logo ở Cài đặt.
const coLogo = { src: '', rong: 60, cao: 60 }
function doLogo(src) {
  if (coLogo.src === src) return
  coLogo.src = src
  const im = new Image()
  im.onload = () => {
    if (coLogo.src !== src || !im.naturalWidth) return
    const k = Math.min(150 / im.naturalWidth, 60 / im.naturalHeight)
    coLogo.rong = Math.round(im.naturalWidth * k); coLogo.cao = Math.round(im.naturalHeight * k)
  }
  im.src = src
}

// Phiên chạy của phân hệ: khối DOM + cầu nối. Sống suốt phiên làm việc (giữ qua các lần chuyển trang).
let phien = null
let dangDung = null

function huyPhien() {
  if (!phien) return
  phien.NOI.daHuy = true           // lượt lưu còn hẹn giờ của bản cũ không được ghi đè dữ liệu mới khôi phục
  phien.khung.remove(); phien.vungIn.remove()
  phien = null
}

async function dungPhien() {
  const duLieu = await docHoSoChungTu()
  const khung = document.createElement('div')
  khung.className = 'hsct'; khung.id = 'hsctGoc'
  khung.innerHTML = TRANG
  // Vùng in phải là con trực tiếp của <body>: lệnh in của phân hệ giấu mọi thứ khác ("body > *:not(#printArea)")
  const vungIn = document.createElement('div')
  vungIn.id = 'printArea'; vungIn.className = 'hsct'
  document.body.appendChild(vungIn)

  const NOI = {
    daHuy: false,
    duLieu,
    luu: d => (NOI.daHuy ? Promise.resolve() : luuHoSoChungTu(d)),
    donVi: () => {
      const c = layKho().caiDat
      const logo = c.logo || LOGO_SAVITAX
      doLogo(logo)
      return { ten: c.tenDonVi || 'SAVITAX', dc: c.dcDonVi || '', logo, rong: coLogo.rong, cao: coLogo.cao }
    },
    ngayLe: () => [...ngayLeSet()],
    // Phân hệ chọn khách hàng (nút "Chọn làm DN đang làm" ở Danh bạ) → menu trái đi theo nếu công ty có trong danh sách
    khiDoiKhach: mst => {
      const c = timTheoMst(mst)
      if (c && c.id !== layKho().caiDat.ctyDangLam) datCaiDat({ ctyDangLam: c.id })
    },
    daSan: () => dongBo(NOI),
  }
  doLogo(layKho().caiDat.logo || LOGO_SAVITAX)
  window.__hsct = NOI
  // Mã phân hệ gọi thẳng các tên toàn cục này (bản gốc nạp thư viện bằng thẻ <script>)
  window.JSZip = JSZip
  window.pdfjsLib = pdfjs            // worker pdf.js đã gắn sẵn ở banRoi/vao.jsx
  window.html2pdf = html2pdf
  return { khung, vungIn, NOI, theHe: theHeHoSoChungTu(), daChay: false }
}

// Mã phân hệ là các script thường (không phải module): ghép lại và chạy chung một phạm vi như khi nằm cạnh nhau trong file gốc.
// Phải chạy SAU khi khối DOM đã gắn vào trang (mã tìm phần tử bằng document.getElementById).
function chayMa() {
  // eslint-disable-next-line no-new-func
  new Function([M0, M1, M2, M3, M4, M5, M6].join('\n;\n'))()
}

// Đưa danh sách công ty + công ty đang làm + ngày nghỉ của bản rời sang phân hệ
function dongBo(NOI) {
  if (!NOI?.api || NOI.daHuy) return
  const { congTy, caiDat } = layKho()
  NOI.api.dongBoKhach(congTy.map(c => ({ mst: chuanMst(c.mst), ten: c.ten, dc: c.dc || '' })))
  const dangLam = congTy.find(c => c.id === caiDat.ctyDangLam)
  NOI.api.chonKhach(dangLam ? chuanMst(dangLam.mst) : '')
  NOI.api.datNgayLe([...ngayLeSet()])
}

export default function HoSoChungTu() {
  const cho = useRef(null)
  const { congTy, caiDat } = useKho()

  useEffect(() => {
    let huy = false
    ;(async () => {
      try {
        if (phien && phien.theHe !== theHeHoSoChungTu()) huyPhien()   // vừa khôi phục sao lưu → dựng lại từ dữ liệu mới
        if (!phien) { dangDung = dangDung || dungPhien(); phien = await dangDung; dangDung = null }
        if (huy || !cho.current) return
        cho.current.appendChild(phien.khung)
        if (!phien.daChay) { phien.daChay = true; chayMa() } else dongBo(phien.NOI)
      } catch (e) {
        console.error(e)
        if (cho.current) cho.current.textContent = 'Không mở được phân hệ Hồ sơ chứng từ: ' + (e?.message || e)
      }
    })()
    return () => { huy = true; phien?.khung.remove() }
  }, [])

  // Đổi công ty / công ty đang làm / ngày nghỉ ở chỗ khác của bản rời khi đang mở phân hệ
  useEffect(() => { if (phien?.daChay) dongBo(phien.NOI) }, [congTy, caiDat.ctyDangLam, caiDat.ngayLe])

  return (
    <AppShell>
      <div ref={cho} className="min-h-screen" />
    </AppShell>
  )
}
