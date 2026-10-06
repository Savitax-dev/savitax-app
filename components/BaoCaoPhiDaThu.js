'use client'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

// Tab "Phí đã thu" của trang Báo cáo KPI — tiền đã ghi nhận trong một khoảng ngày, chọn nhiều
// phòng + nhiều nhân viên, xuất Excel 1 sheet Tổng hợp + 1 sheet cho từng nhân viên.
// Số liệu và phạm vi xem đều do /api/admin/fee-collected quyết định; ở đây chỉ hiển thị.

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const vnHomNay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const dauThang = () => vnHomNay().slice(0, 8) + '01'
const ngayVN = (s) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''
const LOAI_CLS = { ketoan: 'bg-blue-50 text-blue-700', no_ton: 'bg-red-50 text-red-600', khach: 'bg-orange-50 text-orange-600' }

// Tên sheet Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ], và không được trùng nhau.
function tenSheet(ten, daDung) {
  let goc = String(ten || 'Nhân viên').replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 31) || 'Nhân viên'
  let t = goc, i = 2
  while (daDung.has(t.toLowerCase())) { const duoi = ' (' + i++ + ')'; t = goc.slice(0, 31 - duoi.length) + duoi }
  daDung.add(t.toLowerCase())
  return t
}

function ChonNhieu({ label, items, chon, setChon, rong }) {
  const tatCa = chon.length === 0
  const bat = (id) => setChon(chon.includes(id) ? chon.filter(x => x !== id) : [...chon, id])
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <button onClick={() => setChon([])} className={'text-xs ' + (tatCa ? 'text-gray-300' : 'text-blue-600 hover:underline')}>
          {tatCa ? 'Đang chọn tất cả' : 'Bỏ chọn (' + chon.length + ')'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
        {items.length === 0 && <span className="text-xs text-gray-400">{rong}</span>}
        {items.map(it => (
          <button key={it.id} onClick={() => bat(it.id)}
            className={'px-2.5 py-1 rounded-full text-xs border transition-colors ' +
              (chon.includes(it.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {it.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BaoCaoPhiDaThu() {
  const [options, setOptions] = useState(null)
  const [from, setFrom] = useState(dauThang())
  const [to, setTo] = useState(vnHomNay())
  const [rooms, setRooms] = useState([])
  const [staff, setStaff] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [mo, setMo] = useState({})

  useEffect(() => {
    fetch('/api/admin/fee-collected', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setOptions(j.options) })
      .catch(e => setErr(e.message))
  }, [])

  // Đã chọn phòng thì danh sách nhân viên chỉ còn người của các phòng đó.
  const staffHien = useMemo(() => (options?.staff || []).filter(s => rooms.length === 0 || rooms.includes(s.roomId)), [options, rooms])
  useEffect(() => { setStaff(cu => cu.filter(id => staffHien.some(s => s.id === id))) }, [staffHien])

  const xem = async () => {
    if (!from || !to || from > to) { setErr('Chọn lại khoảng ngày (từ ngày phải trước đến ngày).'); return }
    setLoading(true); setErr(null)
    try {
      const q = new URLSearchParams({ from, to })
      if (rooms.length) q.set('rooms', rooms.join(','))
      if (staff.length) q.set('staff', staff.join(','))
      const j = await fetch('/api/admin/fee-collected?' + q, { cache: 'no-store' }).then(r => r.json())
      if (j.error) { setErr(j.error); setData(null) } else { setData(j); setMo({}) }
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const xuatExcel = () => {
    if (!data?.lines?.length) return
    const wb = XLSX.utils.book_new()
    const ky = 'Từ ' + ngayVN(data.from) + ' đến ' + ngayVN(data.to)
    const tong = [
      ['BÁO CÁO PHÍ ĐÃ THU'], [ky + ' — tính theo ngày ghi vào app'], [],
      ['Phòng', 'Nhân viên', 'Số công ty', 'Số khoản thu', 'Phí kế toán (đ)', 'Thu nợ tồn (đ)', 'Thu khác (đ)', 'Tổng đã thu (đ)'],
      ...data.summary.map(g => [g.roomName, g.staffName, g.clientCount, g.count, g.ketoan, g.no_ton, g.khach, g.total]),
      ['TỔNG CỘNG', '', '', data.totals.count, data.totals.ketoan, data.totals.no_ton, data.totals.khach, data.totals.total],
    ]
    const ws = XLSX.utils.aoa_to_sheet(tong)
    ws['!cols'] = [16, 28, 11, 12, 16, 16, 16, 17].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp')

    const daDung = new Set(['tổng hợp'])
    for (const g of data.summary) {
      const ds = data.lines.filter(l => l.staffId === g.staffId)
      const rows = [
        [g.staffName + ' — Phòng ' + g.roomName], [ky], [],
        ['STT', 'Ngày ghi', 'Mã KH', 'Công ty', 'MST', 'Loại thu', 'Kỳ', 'Số tiền (đ)', 'Ghi chú', 'Người ghi'],
        ...ds.map((l, i) => [i + 1, ngayVN(l.date), l.clientCode, l.clientName + (l.ngung ? ' (đã ngưng DV)' : ''), l.taxCode, l.typeLabel, l.period, l.amount, l.note, l.recordedBy]),
        ['', '', '', 'TỔNG', '', '', '', g.total, '', ''],
        [], ['', '', '', 'Phí kế toán', '', '', '', g.ketoan], ['', '', '', 'Thu nợ tồn', '', '', '', g.no_ton], ['', '', '', 'Thu khác', '', '', '', g.khach],
      ]
      const w = XLSX.utils.aoa_to_sheet(rows)
      w['!cols'] = [5, 11, 12, 46, 13, 13, 9, 15, 40, 22].map(x => ({ wch: x }))
      XLSX.utils.book_append_sheet(wb, w, tenSheet(g.staffName, daDung))
    }
    XLSX.writeFile(wb, 'BaoCaoPhiDaThu_' + data.from + '_' + data.to + '.xlsx')
  }

  const theoPhong = useMemo(() => {
    const m = new Map()
    for (const g of data?.summary || []) {
      if (!m.has(g.roomId)) m.set(g.roomId, { roomId: g.roomId, roomName: g.roomName, items: [], total: 0 })
      const r = m.get(g.roomId); r.items.push(g); r.total += g.total
    }
    return [...m.values()]
  }, [data])

  const thang = (delta) => {
    const d = new Date(Date.now() + 7 * 3600 * 1000)
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + delta
    const dau = new Date(Date.UTC(y, m, 1)), cuoi = new Date(Date.UTC(y, m + 1, 0))
    setFrom(dau.toISOString().slice(0, 10))
    setTo(delta === 0 ? vnHomNay() : cuoi.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Từ ngày</p>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Đến ngày</p>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => thang(0)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Tháng này</button>
            <button onClick={() => thang(-1)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Tháng trước</button>
          </div>
        </div>
        {options && options.scope !== 'self' && (<>
          <ChonNhieu label="Phòng" items={options.rooms} chon={rooms} setChon={setRooms} rong="Không có phòng nào" />
          <ChonNhieu label="Nhân viên" items={staffHien} chon={staff} setChon={setStaff} rong="Không có nhân viên nào" />
        </>)}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={xem} disabled={loading || !options}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tải…' : 'Xem báo cáo'}
          </button>
          <button onClick={xuatExcel} disabled={!data?.lines?.length}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            ⬇ Xuất Excel
          </button>
          <span className="text-xs text-gray-400">Ngày thu tính theo ngày ghi vào app · chưa gồm phí HCNS</span>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      {data && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Tổng đã thu', data.totals.total, 'text-gray-900', data.totals.count + ' khoản thu'],
            ['Phí kế toán', data.totals.ketoan, 'text-blue-600', ''],
            ['Thu nợ tồn', data.totals.no_ton, 'text-red-500', ''],
            ['Thu khác', data.totals.khach, 'text-orange-500', ''],
          ].map(([l, v, c, s]) => (
            <div key={l} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{l}</p>
              <p className={'text-lg font-bold ' + c}>{fmt(v)}đ</p>
              {s && <p className="text-xs text-gray-400 mt-0.5">{s}</p>}
            </div>
          ))}
        </div>

        {data.lines.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            Không có khoản thu nào được ghi trong khoảng {ngayVN(data.from)} – {ngayVN(data.to)}.
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_110px_110px_110px_120px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400">
              <span>Nhân viên</span><span className="text-right">Khoản thu</span><span className="text-right">Phí kế toán</span>
              <span className="text-right">Nợ tồn</span><span className="text-right">Thu khác</span><span className="text-right">Tổng đã thu</span>
            </div>
            {theoPhong.map(r => (
              <div key={r.roomId}>
                <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Phòng {r.roomName}</p>
                  <p className="text-xs font-semibold text-gray-700">{fmt(r.total)}đ</p>
                </div>
                {r.items.map(g => (
                  <div key={g.staffId} className="border-b border-gray-50">
                    <button onClick={() => setMo(p => ({ ...p, [g.staffId]: !p[g.staffId] }))}
                      className="w-full grid grid-cols-[1fr_70px_110px_110px_110px_120px] gap-2 px-4 py-2.5 items-center text-left hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {g.staffName} <span className="text-xs font-normal text-blue-600">{mo[g.staffId] ? '▴' : '▾'} {g.clientCount} cty</span>
                      </span>
                      <span className="text-sm text-gray-600 text-right">{g.count}</span>
                      <span className="text-sm text-right text-blue-600">{fmt(g.ketoan)}</span>
                      <span className="text-sm text-right text-red-500">{fmt(g.no_ton)}</span>
                      <span className="text-sm text-right text-orange-500">{fmt(g.khach)}</span>
                      <span className="text-sm font-semibold text-right text-gray-900">{fmt(g.total)}đ</span>
                    </button>
                    {mo[g.staffId] && (
                      <div className="bg-gray-50/60 px-4 py-2">
                        {data.lines.filter(l => l.staffId === g.staffId).map(l => (
                          <div key={l.id} className="grid grid-cols-[78px_1fr_96px_70px_110px] gap-2 py-1.5 border-b border-gray-100 last:border-0 items-start text-xs">
                            <span className="text-gray-500">{ngayVN(l.date)}</span>
                            <span className="min-w-0">
                              <span className="text-gray-800 block truncate">{l.clientName}{l.ngung && <span className="ml-1 text-gray-400">(đã ngưng DV)</span>}</span>
                              {l.note && <span className="text-gray-400 block truncate">{l.note}</span>}
                            </span>
                            <span><span className={'px-1.5 py-0.5 rounded-full ' + LOAI_CLS[l.type]}>{l.typeLabel}</span></span>
                            <span className="text-gray-500">{l.period}</span>
                            <span className="text-right font-medium text-gray-800">{fmt(l.amount)}đ</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-[1fr_70px_110px_110px_110px_120px] gap-2 px-4 py-3 bg-gray-50 text-sm font-bold text-gray-900">
              <span>Tổng cộng</span><span className="text-right">{data.totals.count}</span>
              <span className="text-right">{fmt(data.totals.ketoan)}</span><span className="text-right">{fmt(data.totals.no_ton)}</span>
              <span className="text-right">{fmt(data.totals.khach)}</span><span className="text-right">{fmt(data.totals.total)}đ</span>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Lưu ý: mỗi công ty mỗi kỳ app chỉ giữ một dòng thu cho phí kế toán / nợ tồn. Khách trả nhiều lần cho cùng một kỳ thì cả khoản được tính vào ngày ghi lần sau cùng. Tiền thu của hồ sơ Dịch vụ khác thì đúng theo từng lần thu.
        </p>
      </>)}
    </div>
  )
}
