'use client'
// Dải nhắc hạn nộp tờ khai — đầu các trang của Phân hệ Tờ khai.
//
// Mốc nhắc (anh chốt 28/09/2026): còn 10, 5, 3, 2, 1 ngày và đúng ngày hạn. Ngoài các mốc đó thì
// KHÔNG hiện gì — nhắc mỗi ngày thì người ta quen mắt rồi bỏ qua luôn. Kỳ đã quá hạn thì ngày
// nào cũng nhắc.
//
// Mức 3, 2, 1 ngày và quá hạn: chữ ĐỎ ĐẬM. Màu luôn đi kèm chữ, không bao giờ chỉ dùng màu.
//
// CHẠY KIỂU BẢNG TIN MISA (anh chốt 15/10/2026): chữ đi vào từ mép phải, chạy hết ra mép trái rồi
// mới vào lại — xem .chay-vao trong app/globals.css. Nhãn "⏰ Hạn nộp:" đứng yên bên trái để lúc
// nào nhìn vào cũng biết dải này là gì, kể cả khi chữ đang chạy giữa chừng.
import { useEffect, useRef, useState } from 'react'

// Tốc độ chạy, tính bằng điểm ảnh mỗi giây. Đặt theo QUÃNG ĐƯỜNG chứ không đặt cứng số giây: đặt
// cứng thì chữ dài chạy vèo không kịp đọc, chữ ngắn lại bò lê thê, và màn hình rộng chạy nhanh
// hơn màn hình hẹp. 55px/giây là tầm bảng tin MISA — đọc thoải mái một lượt.
const TOC_DO = 55

// BỘ NHỚ ĐỆM DÙNG CHUNG CẢ PHIÊN. Từ 15/10/2026 dải này nằm ở khung chung (components/AppShell.js),
// mà khung đó dựng lại ở MỌI lần chuyển trang. Không giữ kết quả thì mỗi cú bấm menu lại gọi một
// API đọc toàn bộ công ty + nghĩa vụ thuế — đúng kiểu đã làm menu trái chậm 1,66 giây trước đây.
// Hạn nộp tính theo NGÀY, giữ 5 phút là thừa đủ.
const SONG = 5 * 60 * 1000
let _nho = { luc: 0, ds: null, dangTai: null }

// GỌI KHI ĐĂNG XUẤT (components/Sidebar.js). Bộ đệm này sống suốt phiên trình duyệt, nên không xoá
// thì người sau đăng nhập trên CÙNG MÁY sẽ thấy số công ty chưa nộp của người trước trong tối đa 5
// phút — mà mỗi người chỉ được thấy công ty trong phạm vi của mình.
export function xoaBoNhoNhacHan() {
  _nho = { luc: 0, ds: null, dangTai: null }
}

function layNhac() {
  if (_nho.ds && Date.now() - _nho.luc < SONG) return Promise.resolve(_nho.ds)
  // Hai trang cùng gọi một lúc (vd bấm menu liên tục) thì dùng chung một lượt, không gọi trùng.
  if (_nho.dangTai) return _nho.dangTai
  _nho.dangTai = fetch('/api/admin/tokhai/nhac-han')
    .then(r => r.json())
    .then(j => {
      const ds = j.error ? [] : (j.nhac || [])
      _nho = { luc: Date.now(), ds, dangTai: null }
      return ds
    })
    .catch(() => { _nho.dangTai = null; return [] })
  return _nho.dangTai
}

const MUC = {
  qua_han: { nen: 'bg-red-50 border-red-200',       chu: 'text-red-700 font-bold',    cham: 'bg-red-600' },
  gap:     { nen: 'bg-red-50 border-red-200',       chu: 'text-red-700 font-bold',    cham: 'bg-red-600' },
  sap_toi: { nen: 'bg-blue-50 border-blue-200',     chu: 'text-blue-800',             cham: 'bg-blue-500' },
}

export default function NhacHanNop() {
  // Có sẵn trong bộ nhớ đệm thì vẽ NGAY ở lần dựng đầu — không thì mỗi lần chuyển trang dải chữ
  // biến mất rồi hiện lại, chớp một nhịp rất khó chịu.
  const [ds, setDs] = useState(() => (_nho.ds && Date.now() - _nho.luc < SONG ? _nho.ds : null))
  const chuRef = useRef(null)
  const [giay, setGiay] = useState(30)

  useEffect(() => {
    // CHẠY TRÊN MÁY (localhost) THÌ TẮT (anh dặn 26/10/2026): API nhắc hạn đọc toàn bộ công ty + nghĩa vụ thuế,
    // gọi từ máy ở VN tới Supabase Singapore rất chậm và làm app local nặng. Bản thật (app.savitax.vn) giữ nguyên.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return
    let conSong = true
    layNhac().then(d => { if (conSong) setDs(d) })
    return () => { conSong = false }
  }, [])

  // Đo quãng đường thật sau khi vẽ: bề rộng dải chữ ĐÃ GỒM phần đệm trái bằng cả khung, nên đúng
  // bằng quãng đường từ lúc chữ thò ra ở mép phải tới lúc khuất hẳn ở mép trái. Đo lại khi đổi cỡ
  // cửa sổ — không thì xoay ngang điện thoại xong chữ chạy sai tốc độ.
  useEffect(() => {
    const el = chuRef.current
    if (!el) return
    const tinh = () => setGiay(Math.max(12, Math.round(el.offsetWidth / TOC_DO)))
    tinh()
    window.addEventListener('resize', tinh)
    return () => window.removeEventListener('resize', tinh)
  }, [ds])

  if (!ds || !ds.length) return null

  // Mức gấp nhất quyết định nền cả dải — để cái quá hạn không chìm giữa đống tin bình thường.
  const mucNang = ds.some(n => n.muc === 'qua_han') ? 'qua_han'
    : ds.some(n => n.muc === 'gap') ? 'gap' : 'sap_toi'
  const nen = MUC[mucNang].nen

  // Tên tờ khai và kỳ in ĐẬM để mắt bắt ngay "cái gì, kỳ nào" giữa dòng chữ dài.
  const ngayVN = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
  const noiDung = n => {
    const ten = <b className="font-bold">{n.loai} {n.ky}</b>
    if (n.conLai < 0) {
      return <>QUÁ HẠN {Math.abs(n.conLai)} ngày: {ten} (hạn {ngayVN(n.hanNop)}) — còn <b>{n.soCongTy}</b> công ty chưa nộp</>
    }
    if (n.conLai === 0) {
      return <>HÔM NAY là hạn nộp {ten} — còn <b>{n.soCongTy}</b> công ty chưa nộp</>
    }
    return <>Còn <b>{n.conLai}</b> ngày tới hạn {ten} ({ngayVN(n.hanNop)}) — <b>{n.soCongTy}</b> công ty chưa nộp</>
  }

  // Dải PHẲNG trải ngang đầu trang như bảng tin MISA — không bo góc, không lề, chỉ một đường viền
  // dưới. Bo góc kiểu hộp như trước hợp với dải nằm giữa nội dung một trang, còn nằm trên đầu
  // toàn app thì phải trông như một phần của khung, không phải một ô lạc vào.
  return (
    <div className={'border-b px-4 py-1.5 overflow-hidden ' + nen}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold whitespace-nowrap flex-shrink-0">⏰ Hạn nộp:</span>
        <div className="overflow-hidden flex-1 min-w-0">
          <div ref={chuRef} className="chay-vao text-xs" style={{ '--giay': giay + 's' }}>
            {ds.map((n, i) => {
              const k = MUC[n.muc] || MUC.sap_toi
              // KHÔNG dùng inline-flex ở đây. Trong khung flex, mỗi mảnh chữ và mỗi thẻ <b> thành
              // một phần tử riêng, và trình duyệt BỎ khoảng trắng ở mép từng phần tử — nên chữ
              // dính liền thành "Còn5ngày tới hạn01/GTGT" (anh chụp được ngày 15/10/2026) dù mã
              // nguồn có đủ dấu cách. Để chữ chảy bình thường, chấm tròn dùng inline-block.
              return (
                <span key={i} className={'mr-16 ' + k.chu}>
                  <span className={'inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ' + k.cham} />
                  {noiDung(n)}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
