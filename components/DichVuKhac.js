'use client'
import { useCallback, useEffect, useState } from 'react'

// Hồ sơ "Dịch vụ khác" của một công ty — thay cho ô "số đã thu" một dòng mỗi tháng trước đây.
// Mỗi dịch vụ phát sinh là một hồ sơ: phải thu bao nhiêu, thu mấy lần, còn lại tự chuyển kỳ sau,
// thu đủ thì đóng. Xem app/api/admin/other-services + sql/24_dich_vu_khac.sql.

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
}

export default function DichVuKhac({ client, year, month, canCloseEarly = false, onChanged }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [moForm, setMoForm] = useState(false)
  const [ten, setTen] = useState('')
  const [tien, setTien] = useState('')
  const [open, setOpen] = useState({})
  const [thu, setThu] = useState({})      // id hồ sơ -> { so, ghiChu }

  const load = useCallback(async () => {
    try {
      const j = await fetch('/api/admin/other-services?clientId=' + client.id, { cache: 'no-store' }).then(r => r.json())
      setList(j.data || [])
      if (j.missing) setErr('Chưa tạo bảng dịch vụ khác — nhờ quản trị chạy file sql/24_dich_vu_khac.sql')
    } catch (e) { setList([]); setErr(e.message) }
  }, [client.id])

  useEffect(() => { load() }, [load])

  const goi = async (body, hoiLai) => {
    if (hoiLai && !confirm(hoiLai)) return false
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/other-services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok || j.error) { setErr(j.error || 'Không lưu được'); setBusy(false); return false }
    } catch (e) { setErr(e.message); setBusy(false); return false }
    setBusy(false)
    await load()
    onChanged && onChanged()
    return true
  }

  // Ba số trên đầu nói về HỒ SƠ ĐANG MỞ, cùng một gốc: phải thu − đã thu = còn lại. Trộn cả hồ sơ
  // đã đóng vào "đã thu" thì ra cảnh "đã thu > phải thu", nhìn tưởng sai số.
  const dangMo = (list || []).filter(s => s.status !== 'done')
  const daDong = (list || []).filter(s => s.status === 'done')
  const tongPhaiThu = dangMo.reduce((a, s) => a + s.amount, 0)
  const tongDaThu = dangMo.reduce((a, s) => a + s.paid, 0)
  const tongConLai = dangMo.reduce((a, s) => a + s.remain, 0)
  const tongDaXong = daDong.reduce((a, s) => a + s.paid, 0)

  if (list === null) return <div className="p-3 text-xs text-gray-400">Đang tải hồ sơ dịch vụ khác...</div>

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="text-gray-500">Đang mở <b className="text-gray-700">{dangMo.length}</b> hồ sơ:</span>
          <span className="text-gray-500">phải thu <b className="text-gray-700">{fmt(tongPhaiThu)}đ</b></span>
          <span className="text-gray-500">đã thu <b className="text-green-600">{fmt(tongDaThu)}đ</b></span>
          <span className="text-gray-500">còn lại <b className={tongConLai > 0 ? 'text-orange-500' : 'text-green-600'}>{fmt(tongConLai)}đ</b></span>
          {daDong.length > 0 && (
            <span className="text-gray-400">· đã xong {daDong.length} hồ sơ ({fmt(tongDaXong)}đ)</span>
          )}
        </div>
        <button onClick={() => { setMoForm(v => !v); setErr('') }}
          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex-shrink-0">
          {moForm ? 'Đóng form' : '+ Mở dịch vụ khác'}
        </button>
      </div>

      {err && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2 py-1.5">{err}</p>}

      {moForm && (
        <div className="border border-blue-200 rounded-lg p-2.5 space-y-2 bg-blue-50/40">
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 mb-0.5 block">Nội dung dịch vụ</label>
              <input value={ten} onChange={e => setTen(e.target.value)} placeholder="Soát xét sổ sách năm 2022"
                className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="w-40">
              <label className="text-xs text-gray-500 mb-0.5 block">Số tiền phải thu (đ)</label>
              <input type="text" inputMode="numeric"
                value={tien ? Number(tien).toLocaleString('vi-VN') : ''}
                onChange={e => setTien(e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <button disabled={busy || !ten.trim() || !tien}
              onClick={async () => {
                if (await goi({ action: 'open', clientId: client.id, name: ten.trim(), amount: Number(tien), year, month })) {
                  setTen(''); setTien(''); setMoForm(false)
                }
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              Mở hồ sơ
            </button>
          </div>
          <p className="text-xs text-gray-400">Kỳ phát sinh: T{month}/{year} · số tiền nhập ĐÃ gồm VAT, giống phí dịch vụ</p>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Chưa có hồ sơ dịch vụ khác nào</p>
      ) : list.map(s => {
        const duTien = s.remain === 0
        const nhan = s.status === 'done'
          ? ['Đã hoàn thành', 'bg-green-100 text-green-700']
          : duTien ? ['Đã thu đủ · chờ đóng', 'bg-amber-100 text-amber-700']
          : ['Đang thu', 'bg-red-100 text-red-600']
        const mo = !!open[s.id]
        const t = thu[s.id] || { so: '', ghiChu: '' }
        return (
          <div key={s.id} className={'border border-gray-100 rounded-lg ' + (s.status === 'done' ? 'bg-gray-50/60' : 'bg-white')}>
            <button onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))}
              className="w-full px-2.5 py-2 text-left flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Kỳ T{s.month}/{s.year} · phải thu {fmt(s.amount)}đ · đã thu <span className="text-green-600">{fmt(s.paid)}đ</span>
                  {s.status !== 'done' && s.remain > 0 && <> · còn <span className="text-orange-500">{fmt(s.remain)}đ</span></>}
                </p>
              </div>
              <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 ' + nhan[1]}>{nhan[0]}</span>
            </button>

            {mo && (
              <div className="px-2.5 pb-2.5 border-t border-dashed border-gray-100 pt-2 space-y-2">
                {s.payments.length > 0 ? (
                  <div className="space-y-1">
                    {s.payments.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-gray-50 rounded">
                        <span className="text-gray-400 w-20 flex-shrink-0">{fmtDate(p.created_at)}</span>
                        <span className="font-bold text-green-600 w-24 flex-shrink-0">{fmt(p.amount)}đ</span>
                        <span className="text-gray-400 truncate flex-1 italic">{p.note || ''} · {p.by}</span>
                        <button onClick={() => goi({ action: 'delPay', id: p.id }, 'Xoá khoản thu ' + fmt(p.amount) + 'đ?')}
                          className="text-red-400 hover:underline flex-shrink-0">Xoá</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">Chưa ghi khoản thu nào</p>}

                {s.status !== 'done' && (
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="w-36">
                      <label className="text-xs text-gray-500 mb-0.5 block">Thu thêm (đ)</label>
                      <input type="text" inputMode="numeric"
                        value={t.so ? Number(t.so).toLocaleString('vi-VN') : ''}
                        onChange={e => setThu(x => ({ ...x, [s.id]: { ...t, so: e.target.value.replace(/\D/g, '') } }))}
                        placeholder={'Còn ' + fmt(s.remain)}
                        className="w-full px-2.5 py-1.5 border border-green-300 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                    </div>
                    <input value={t.ghiChu}
                      onChange={e => setThu(x => ({ ...x, [s.id]: { ...t, ghiChu: e.target.value } }))}
                      placeholder="Ghi chú: ngày chuyển khoản, kênh thu..."
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                    <button disabled={busy || !t.so}
                      onClick={async () => {
                        if (await goi({ action: 'pay', id: s.id, amount: Number(t.so), note: t.ghiChu || null, year, month })) {
                          setThu(x => ({ ...x, [s.id]: { so: '', ghiChu: '' } }))
                        }
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      Ghi thu
                    </button>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap items-center">
                  {s.status !== 'done' && duTien && (
                    <button disabled={busy} onClick={() => goi({ action: 'close', id: s.id })}
                      className="text-xs px-3 py-1 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 font-medium">
                      ✓ Hoàn thành hồ sơ
                    </button>
                  )}
                  {s.status !== 'done' && !duTien && canCloseEarly && (
                    <button disabled={busy} onClick={() => {
                      const ly = prompt('Hồ sơ còn thiếu ' + fmt(s.remain) + 'đ. Nhập lý do đóng (giảm giá, khách bỏ, ghi nhầm...):')
                      if (ly && ly.trim()) goi({ action: 'close', id: s.id, reason: ly.trim() })
                    }}
                      className="text-xs px-3 py-1 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50">
                      Đóng dù còn thiếu
                    </button>
                  )}
                  {s.status !== 'done' && !duTien && !canCloseEarly && (
                    <span className="text-xs text-gray-400">Còn thiếu tiền — chỉ Trưởng phòng/Quản trị đóng sớm được</span>
                  )}
                  {s.status === 'done' && (
                    <>
                      <span className="text-xs text-gray-400">
                        Đóng {fmtDate(s.closed_at)} · {s.closed_by_name}
                        {s.close_reason ? ' · lý do: ' + s.close_reason : ''}
                      </span>
                      {canCloseEarly && (
                        <button disabled={busy} onClick={() => goi({ action: 'reopen', id: s.id }, 'Mở lại hồ sơ này?')}
                          className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Mở lại</button>
                      )}
                    </>
                  )}
                  {s.payments.length === 0 && s.status !== 'done' && (
                    <button disabled={busy} onClick={() => goi({ action: 'delete', id: s.id }, 'Xoá hồ sơ "' + s.name + '"?')}
                      className="text-xs px-2.5 py-1 text-red-400 hover:underline ml-auto">Xoá hồ sơ</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
