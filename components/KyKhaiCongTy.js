'use client'
// Bảng chỉnh KỲ KHAI riêng của một công ty cho từng loại tờ khai định kỳ — anh chốt hướng A ngày
// 19/10/2026. Mở từ ô "Kỳ khai" trong Lịch hạn nộp.
//
// Ca thật: VINA HSIN GON, CHARGEPOINT kê GTGT theo THÁNG nhưng TNCN theo QUÝ, app lại sinh TNCN theo
// tháng nên tờ khai quý đã được chấp nhận vẫn bị báo "Chưa nộp".
//
// BẮT BUỘC XEM TRƯỚC: lưu là XOÁ nghĩa vụ cũ trong cơ sở dữ liệu. Nên bấm "Xem trước" -> app chạy
// khô, hiện rõ sẽ xoá kỳ nào, sinh kỳ nào, gắn lại hồ sơ nào -> người dùng đồng ý mới cho lưu thật.
// Đổi gì ở ô chọn sau khi đã xem trước thì phần xem trước bị huỷ, phải xem lại.
import { useEffect, useState } from 'react'

const NHAN = { month: 'Tháng', quarter: 'Quý' }

// Các quý chọn được làm mốc áp dụng: từ quý 1 năm trước tới quý 1 năm sau.
function cacQuy() {
  const nam = new Date().getFullYear(), ra = []
  for (let y = nam - 1; y <= nam; y++) for (let q = 1; q <= 4; q++) ra.push(`Q${q}.${y}`)
  ra.push(`Q1.${nam + 1}`)
  return ra
}
// Mặc định: quý ĐANG ĐƯỢC KHAI (quý trước quý hiện tại) — tháng 10 thì là Q3, đúng ca HSIN.
function quyMacDinh() {
  const d = new Date(), q = Math.floor(d.getMonth() / 3) + 1
  return q === 1 ? `Q4.${d.getFullYear() - 1}` : `Q${q - 1}.${d.getFullYear()}`
}

export default function KyKhaiCongTy({ congTy, onDong, onDaLuu }) {
  const [ds, setDs] = useState(null)
  const [duocDoi, setDuocDoi] = useState(false)
  const [loi, setLoi] = useState('')
  const [chon, setChon] = useState({})            // filingTypeId -> 'month' | 'quarter'
  const [tuKy, setTuKy] = useState(quyMacDinh())
  const [xemTruoc, setXemTruoc] = useState(null)  // [{ code, kq }]
  const [dangLam, setDangLam] = useState(false)
  const [xong, setXong] = useState(null)

  useEffect(() => {
    fetch('/api/admin/tokhai/ky-khai?clientId=' + congTy.id, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (j.error) { setLoi(j.error); return }
        setDs(j.data || [])
        setDuocDoi(!!j.duocDoi)
        setChon(Object.fromEntries((j.data || []).map(t => [t.filingTypeId, t.dangKhai])))
      })
      .catch(e => setLoi(e.message))
  }, [congTy.id])

  // Chỉ những loại ĐÃ ĐỔI so với hiện tại mới gửi đi.
  const thayDoi = (ds || []).filter(t => chon[t.filingTypeId] && chon[t.filingTypeId] !== t.dangKhai)

  const goi = async (thu) => {
    setDangLam(true); setLoi('')
    const ra = []
    for (const t of thayDoi) {
      const res = await fetch('/api/admin/tokhai/ky-khai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: congTy.id, filingTypeId: t.filingTypeId, periodKind: chon[t.filingTypeId], tuKy, thu }),
      })
      const j = await res.json()
      if (j.error) { setLoi(t.code + ': ' + j.error); setDangLam(false); return }
      ra.push({ code: t.code, kq: j })
    }
    setDangLam(false)
    if (thu) setXemTruoc(ra)
    else { setXong(ra); onDaLuu && onDaLuu() }
  }

  const doiChon = (id, gt) => { setChon(c => ({ ...c, [id]: gt })); setXemTruoc(null) }
  const doiKy = (k) => { setTuKy(k); setXemTruoc(null) }

  const moTa = (kq) => (
    <ul className="text-xs text-gray-600 space-y-0.5 mt-1">
      <li>Xoá lịch cũ: <b>{kq.daXoa?.length ? kq.daXoa.join(', ') : 'không có'}</b></li>
      <li>Sinh lịch mới: <b>{kq.daThem?.length ? kq.daThem.join(', ') : 'không có'}</b></li>
      {kq.ganLaiHoSo?.length > 0 && (
        <li className="text-green-700">Gắn lại hồ sơ đã nộp: <b>{Array.isArray(kq.ganLaiHoSo) ? kq.ganLaiHoSo.join(', ') : kq.ganLaiHoSo}</b> → chuyển thành đã nộp</li>
      )}
      {kq.giuLai?.length > 0 && (
        <li className="text-amber-700">
          Giữ nguyên vì đã có dữ liệu: <b>{kq.giuLai.map(g => g.ky).join(', ')}</b> — xem lại bằng tay
        </li>
      )}
    </ul>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onDong}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">Kỳ khai riêng</p>
          <p className="text-xs text-gray-500 mt-0.5">{congTy.ten}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loi && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loi}</p>}
          {!ds && !loi && <p className="text-sm text-gray-400">Đang tải…</p>}

          {ds && ds.map(t => (
            <div key={t.filingTypeId} className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-800 w-28 flex-shrink-0">{t.code}</span>
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                {['month', 'quarter'].map(gt => (
                  <button key={gt} type="button" disabled={!duocDoi || dangLam}
                    onClick={() => doiChon(t.filingTypeId, gt)}
                    className={'px-3 py-1 text-xs font-medium transition-colors '
                      + (chon[t.filingTypeId] === gt ? 'bg-red-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')
                      + (!duocDoi ? ' cursor-default' : '')}>
                    {NHAN[gt]}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-400">
                {t.tuDong ? 'app tự đổi theo cổng' : t.dangKhai === t.macDinh ? 'theo công ty' : 'đã đổi riêng'}
              </span>
            </div>
          ))}

          {ds && duocDoi && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500">Áp dụng từ</span>
              <select value={tuKy} onChange={e => doiKy(e.target.value)} disabled={dangLam}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white">
                {cacQuy().map(k => <option key={k} value={k}>{k.replace('.', '/')}</option>)}
              </select>
              <span className="text-[11px] text-gray-400">luôn bắt đầu từ đầu một quý</span>
            </div>
          )}

          {ds && !duocDoi && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Chỉ trưởng phòng của phòng này (hoặc quản trị) mới đổi được kỳ khai.
            </p>
          )}

          {xemTruoc && !xong && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-bold text-amber-900">Xem trước — chưa lưu gì</p>
              {xemTruoc.map(x => (
                <div key={x.code} className="mt-2">
                  <p className="text-xs font-semibold text-gray-800">{x.code} → {NHAN[chon[(ds || []).find(t => t.code === x.code)?.filingTypeId]]} từ {tuKy.replace('.', '/')}</p>
                  {moTa(x.kq)}
                </div>
              ))}
            </div>
          )}

          {xong && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
              <p className="text-xs font-bold text-green-800">Đã lưu và sinh lại lịch hạn nộp</p>
              {xong.map(x => (
                <div key={x.code} className="mt-2">
                  <p className="text-xs font-semibold text-gray-800">{x.code}</p>
                  {moTa(x.kq)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onDong} className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
            {xong ? 'Đóng' : 'Huỷ'}
          </button>
          {duocDoi && !xong && (
            xemTruoc
              ? <button disabled={dangLam} onClick={() => goi(false)}
                  className="px-4 py-1.5 text-sm font-medium bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50">
                  {dangLam ? 'Đang lưu…' : 'Xác nhận lưu'}
                </button>
              : <button disabled={dangLam || !thayDoi.length} onClick={() => goi(true)}
                  className="px-4 py-1.5 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-40"
                  title={!thayDoi.length ? 'Chưa đổi gì' : ''}>
                  {dangLam ? 'Đang tính…' : 'Xem trước'}
                </button>
          )}
        </div>
      </div>
    </div>
  )
}
