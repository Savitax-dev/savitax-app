'use client'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import KhoiDongTien from '@/components/KhoiDongTien'

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
  const [openCard, setOpenCard] = useState(null)

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
      if (j.error) { setErr(j.error); setData(null) } else { setData(j); setMo({}); setOpenCard(null) }
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  // Dòng tiền của 1 nhân viên (máy chủ tính theo các tháng mà khoảng ngày chạm tới).
  const F0 = { ton: 0, phiKt: 0, phiHcns: 0, phiKhac: 0, thuKy: 0, xoa: 0, chuyen: 0, soCty: 0 }
  const flow = (id) => data?.flowByStaff?.[id] || F0
  const kyTxt = data?.kyDongTien
    ? (data.kyDongTien.tuThang === data.kyDongTien.denThang ? 'T' + data.kyDongTien.tuThang : 'T' + data.kyDongTien.tuThang + '–T' + data.kyDongTien.denThang) + '/' + data.kyDongTien.year
    : ''

  const xuatExcel = () => {
    if (!data?.summary?.length) return
    const wb = XLSX.utils.book_new()
    const ky = 'Từ ' + ngayVN(data.from) + ' đến ' + ngayVN(data.to)
    const ghiChuKy = kyTxt
      ? 'Tồn đầu kỳ / phải thu / đã thu của kỳ / chuyển kỳ sau tính theo kỳ ' + kyTxt + ' (các tháng mà khoảng ngày chạm tới). "Đã ghi trong khoảng ngày" là tiền thực ghi vào app trong khoảng ngày.'
      : (data.dongTienNote || '')
    const T = { ton: 0, phiKt: 0, phiHcns: 0, phiKhac: 0, thuKy: 0, chuyen: 0, soCty: 0 }
    for (const g of data.summary) { const f = flow(g.staffId); for (const k of Object.keys(T)) T[k] += f[k] }
    const tong = [
      ['BÁO CÁO DÒNG TIỀN PHÍ DỊCH VỤ'], [ky + ' — theo ngày ghi vào app'], [ghiChuKy], [],
      ['Phòng', 'Nhân viên', 'Số công ty', 'Số khoản thu', 'Tồn đầu kỳ trước chuyển sang (đ)', 'Phải thu kế toán (đ)', 'Phí HCNS (đ)', 'Thu khác (đ)',
        'Đã thu của kỳ (đ)', 'Đã ghi trong khoảng ngày (đ)', 'Còn phải thu chuyển kỳ sau (đ)'],
      ...data.summary.map(g => { const f = flow(g.staffId); return [g.roomName, g.staffName, f.soCty || g.clientCount, g.count, f.ton, f.phiKt, f.phiHcns, f.phiKhac, f.thuKy, g.total, f.chuyen] }),
      ['TỔNG CỘNG', '', T.soCty, data.totals.count, T.ton, T.phiKt, T.phiHcns, T.phiKhac, T.thuKy, data.totals.total, T.chuyen],
    ]
    const ws = XLSX.utils.aoa_to_sheet(tong)
    ws['!cols'] = [14, 26, 10, 11, 20, 18, 14, 14, 17, 20, 22].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp')

    const daDung = new Set(['tổng hợp'])
    const tg = (x) => (x?.ketoan || 0) + (x?.hcns || 0) + (x?.dvk || 0)
    for (const g of data.summary) {
      const f = flow(g.staffId)
      const cty = (data.companies || []).filter(c => (c.staffId || 'none') === g.staffId).sort((a, b) => tg(b.chuyen) - tg(a.chuyen))
      const ds = data.lines.filter(l => l.staffId === g.staffId)
      const rows = [
        [g.staffName + ' — Phòng ' + g.roomName], [ky + (kyTxt ? ' · dòng tiền kỳ ' + kyTxt : '')], [],
        ['A. DÒNG TIỀN TỪNG CÔNG TY' + (kyTxt ? ' (kỳ ' + kyTxt + ')' : '')],
        ['STT', 'Mã KH', 'Công ty', 'MST', 'Tồn đầu kỳ trước chuyển sang (đ)', 'Phí kế toán (đ)', 'Phí HCNS (đ)', 'Phí khác (đ)', 'Đã thu của kỳ (đ)', 'Còn phải thu chuyển kỳ sau (đ)'],
        ...cty.map((c, i) => [i + 1, c.clientCode, c.name + (c.ngung ? ' (đã ngưng DV)' : ''), c.taxCode, tg(c.ton), c.phi.ketoan, c.phi.hcns, c.phi.dvk, tg(c.thu), tg(c.chuyen)]),
        ['', '', 'TỔNG', '', f.ton, f.phiKt, f.phiHcns, f.phiKhac, f.thuKy, f.chuyen],
        [],
        ['B. CÁC KHOẢN ĐÃ GHI TRONG KHOẢNG NGÀY (' + ngayVN(data.from) + ' – ' + ngayVN(data.to) + ')'],
        ['STT', 'Mã KH', 'Công ty', 'MST', 'Loại thu', 'Ngày ghi', 'Kỳ', 'Số tiền (đ)', 'Ghi chú', 'Người ghi'],
        ...ds.map((l, i) => [i + 1, l.clientCode, l.clientName + (l.ngung ? ' (đã ngưng DV)' : ''), l.taxCode, l.typeLabel, ngayVN(l.date), l.period, l.amount, l.note, l.recordedBy]),
        ['', '', 'TỔNG', '', '', '', '', g.total, '', ''],
        [], ['', '', 'Phí kế toán', '', '', '', '', g.ketoan], ['', '', 'Thu nợ tồn', '', '', '', '', g.no_ton], ['', '', 'Thu khác', '', '', '', '', g.khach],
      ]
      const w = XLSX.utils.aoa_to_sheet(rows)
      w['!cols'] = [5, 12, 46, 13, 22, 15, 13, 13, 17, 24].map(x => ({ wch: x }))
      XLSX.utils.book_append_sheet(wb, w, tenSheet(g.staffName, daDung))
    }
    XLSX.writeFile(wb, 'BaoCaoDongTien_' + data.from + '_' + data.to + '.xlsx')
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
          <button onClick={xuatExcel} disabled={!data?.summary?.length}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            ⬇ Xuất Excel
          </button>
          <span className="text-xs text-gray-400">Khoản thu lọc theo ngày ghi vào app · dòng tiền tính theo các tháng mà khoảng ngày chạm tới</span>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      {data && (<>
        {/* 5 khối dòng tiền — cùng component với các trang công nợ. */}
        {data.dongTien ? (
          <div className="space-y-3">
            <KhoiDongTien dongTien={data.dongTien} hcnsOn open={openCard} setOpen={setOpenCard}
              staffNameOf={(id) => (options?.staff || []).find(x => x.id === id)?.name || '—'} kyLabel={kyTxt} />
          </div>
        ) : data.dongTienNote && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{data.dongTienNote}</p>
        )}

        {/* Tiền thực ghi vào app trong khoảng ngày — khác "đã thu của kỳ" ở 5 thẻ trên, nên để riêng. */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">Đã ghi trong khoảng {ngayVN(data.from)} – {ngayVN(data.to)}:</span>
          <span className="font-bold text-gray-900">{fmt(data.totals.total)}đ <span className="font-normal text-xs text-gray-400">({data.totals.count} khoản)</span></span>
          <span className="text-blue-600">Phí kế toán {fmt(data.totals.ketoan)}đ</span>
          <span className="text-red-500">Nợ tồn {fmt(data.totals.no_ton)}đ</span>
          <span className="text-orange-500">Thu khác {fmt(data.totals.khach)}đ</span>
        </div>

        {data.summary.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            Không có dữ liệu trong khoảng {ngayVN(data.from)} – {ngayVN(data.to)}.
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <div className="min-w-[980px]">
            <div className="grid grid-cols-[1fr_110px_110px_100px_100px_110px_120px_120px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400">
              <span>Nhân viên</span><span className="text-right">Tồn đầu kỳ</span><span className="text-right">Phải thu kế toán</span>
              <span className="text-right">Phí HCNS</span><span className="text-right">Thu khác</span><span className="text-right">Đã thu của kỳ</span>
              <span className="text-right">Đã ghi trong khoảng ngày</span><span className="text-right">Chuyển kỳ sau</span>
            </div>
            {theoPhong.map(r => (
              <div key={r.roomId}>
                <div className="px-4 py-2 bg-gray-100/70 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Phòng {r.roomName}</p>
                  <p className="text-xs font-semibold text-gray-700">đã ghi {fmt(r.total)}đ</p>
                </div>
                {r.items.map(g => { const f = flow(g.staffId); return (
                  <div key={g.staffId} className="border-b border-gray-50">
                    <button onClick={() => setMo(p => ({ ...p, [g.staffId]: !p[g.staffId] }))}
                      className="w-full grid grid-cols-[1fr_110px_110px_100px_100px_110px_120px_120px] gap-2 px-4 py-2.5 items-center text-left hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {g.staffName} <span className="text-xs font-normal text-blue-600">{mo[g.staffId] ? '▴' : '▾'} {g.count} khoản</span>
                      </span>
                      <span className="text-sm text-right text-orange-500">{fmt(f.ton)}</span>
                      <span className="text-sm text-right text-gray-800">{fmt(f.phiKt)}</span>
                      <span className="text-sm text-right text-violet-600">{fmt(f.phiHcns)}</span>
                      <span className="text-sm text-right text-teal-600">{fmt(f.phiKhac)}</span>
                      <span className="text-sm text-right text-green-600">{fmt(f.thuKy)}</span>
                      <span className="text-sm font-semibold text-right text-gray-900">{fmt(g.total)}</span>
                      <span className="text-sm font-semibold text-right text-red-500">{fmt(f.chuyen)}</span>
                    </button>
                    {mo[g.staffId] && (
                      <div className="bg-gray-50/60 px-4 py-2">
                        {data.lines.filter(l => l.staffId === g.staffId).length === 0 && (
                          <p className="text-xs text-gray-400 py-1">Không có khoản nào được ghi trong khoảng ngày này.</p>
                        )}
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
                ) })}
              </div>
            ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Cách đọc: tồn đầu kỳ + phải thu − <b>đã thu của kỳ</b> = chuyển kỳ sau (tính theo kỳ {kyTxt || '—'}, giống các trang công nợ). <b>Đã ghi trong khoảng ngày</b> là tiền thực ghi vào app trong khoảng ngày nên có thể khác: phí T9 ghi ngày 05/10 thuộc kỳ T9 nhưng nằm ở ngày ghi tháng 10. Mỗi công ty mỗi kỳ app chỉ giữ một dòng thu phí kế toán / nợ tồn, trả nhiều lần cùng kỳ thì cả khoản tính vào ngày ghi sau cùng.
        </p>
      </>)}
    </div>
  )
}
