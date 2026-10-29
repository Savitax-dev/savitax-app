'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

// Nhật ký mail "bộ báo cáo thuế" — mỗi lá mail nhân viên gửi khách là một dòng, kèm kết quả đối
// chiếu của app.
//
// Dòng CHƯA KHỚP mới là lý do trang này tồn tại: đó là mail đã gửi thật mà app không tự tick được.
// Không có chỗ xem thì mỗi tháng lại phải lục hộp thư bằng tay, và không ai biết tính năng đang bỏ
// sót bao nhiêu. Nên mặc định trang mở ở bộ lọc "Chưa khớp".

const fmtGio = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
    + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export default function MailLogPage() {
  const router = useRouter()
  const now = new Date()
  const [san, setSan] = useState(false)
  const [nam, setNam] = useState(now.getFullYear())
  const [thang, setThang] = useState(now.getMonth() + 1)
  const [loc, setLoc] = useState('chua')
  const [ds, setDs] = useState([])
  const [tong, setTong] = useState(null)
  const [chuaCaiDat, setChuaCaiDat] = useState(false)
  const [dangTai, setDangTai] = useState(true)

  const kyOpts = []
  { let y = now.getFullYear(), m = now.getMonth() + 1
    for (let i = 0; i < 12; i++) { kyOpts.push({ y, m, nhan: 'T' + m + '/' + y }); m--; if (m === 0) { m = 12; y-- } } }

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      setSan(true)
    })()
  }, [router])

  useEffect(() => {
    if (!san) return
    setDangTai(true)
    fetch(`/api/admin/mail-log?nam=${nam}&thang=${thang}&loc=${loc}&_t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setDs(j.data || []); setTong(j.tong || null); setChuaCaiDat(!!j.chuaCaiDat) })
      .catch(() => { setDs([]); setTong(null) })
      .finally(() => setDangTai(false))
  }, [san, nam, thang, loc])

  const the = (nhan, so, mau, giaTri) => (
    <button onClick={() => setLoc(giaTri)}
      className={'px-3 py-2 rounded-xl border text-left transition-colors flex-1 min-w-[110px] '
        + (loc === giaTri ? mau.on : mau.off)}>
      <p className="text-xs opacity-80">{nhan}</p>
      <p className="text-xl font-bold leading-tight">{so ?? '—'}</p>
    </button>
  )

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nhật ký mail báo cáo</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Mail nhân viên gửi khách, và việc app có tự tick được hay không
            </p>
          </div>
          <select value={nam + '-' + thang} onChange={e => { const [y, m] = e.target.value.split('-'); setNam(Number(y)); setThang(Number(m)) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            {kyOpts.map(o => <option key={o.nhan} value={o.y + '-' + o.m}>{o.nhan}</option>)}
          </select>
        </div>

        {chuaCaiDat && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 my-3">
            Chưa cài phần đọc mail — cần chạy <b>sql/30_mail_bao_cao.sql</b> và bật script trên VPS
            (xem <b>vps/MAIL-SYNC.md</b>).
          </p>
        )}

        {/* Lọc theo kết quả. Mặc định mở ở "Chưa khớp" vì đó là việc cần người xử lý. */}
        <div className="flex gap-2 flex-wrap my-3">
          {the('Tất cả', tong?.tatCa, { on: 'bg-gray-800 text-white border-gray-800', off: 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50' }, 'all')}
          {the('Khớp được', tong?.khop, { on: 'bg-green-600 text-white border-green-600', off: 'bg-white text-green-700 border-green-200 hover:bg-green-50' }, 'khop')}
          {the('Chưa khớp', tong?.chua, { on: 'bg-orange-500 text-white border-orange-500', off: 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50' }, 'chua')}
        </div>

        {dangTai ? (
          <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>
        ) : ds.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            {loc === 'chua' ? 'Không có mail nào chưa khớp 🎉' : 'Chưa có mail nào trong kỳ này'}
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {ds.map((m, i) => (
              <div key={m.id} className={'px-3 py-2.5 border-b border-gray-50 last:border-0 ' + (i % 2 ? 'bg-gray-50/50' : '')}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 w-24 flex-shrink-0">{fmtGio(m.sentAt)}</span>
                  <span className="text-sm text-gray-800 flex-1 min-w-[200px] break-words">{m.subject}</span>
                  {/* Ba trạng thái, phân biệt bằng cả chữ lẫn màu:
                      - đã tick: chính lá mail này tạo ra dấu tick
                      - khớp:    khớp được nhưng việc đã tick từ trước, mail chỉ là bằng chứng thêm
                      - chưa khớp: cần người xử lý */}
                  <span className={'text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 border '
                    + (m.ticked ? 'bg-green-600 text-white border-green-600'
                      : m.matched ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-orange-50 text-orange-700 border-orange-200')}>
                    {m.ticked ? '✓ đã tick' : m.matched ? 'khớp' : 'chưa khớp'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1 pl-24 text-xs">
                  {/* Tên nhân viên thay cho email (anh yêu cầu 29/10/2026); rê chuột vẫn xem được email.
                      Mail khách gửi không thuộc nhân viên nào thì hiện email như cũ. */}
                  {m.fromName
                    ? <span className="text-gray-700 font-medium" title={m.fromEmail || ''}>{m.fromName}</span>
                    : m.fromEmail && <span className="text-gray-400">{m.fromEmail}</span>}
                  {m.clientName && (
                    <span className="text-gray-600">
                      → {m.clientName}{m.clientCode ? ' [' + m.clientCode + ']' : ''}{m.ky ? ' · ' + m.ky : ''}
                    </span>
                  )}
                  {!m.matched && m.reason && <span className="text-orange-600">⚠ {m.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          App <b>chỉ tick, không bao giờ bỏ tick</b>. Việc đã tick tay từ trước thì giữ nguyên giờ
          hoàn thành cũ, lá mail chỉ được lưu làm bằng chứng. Dòng <b>chưa khớp</b> là mail đã gửi
          mà app không nhận ra — phải tick tay, và nên sửa lại cách đặt tiêu đề cho lần sau.
        </p>
      </div>
    </AppShell>
  )
}
