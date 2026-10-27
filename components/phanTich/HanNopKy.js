'use client'
// Hạn nộp + trạng thái nộp tờ khai của kỳ đang soát — lấy từ phân hệ Tờ khai (route /api/admin/phantich/han-nop, chỉ đọc).
// Lịch hạn nộp của Tờ khai đã tính lùi/đẩy theo ngày nghỉ, nên ưu tiên hơn hạn app tự tính ở Soát kỳ.
import { useEffect, useState } from 'react'
import { ChipMau } from './phanTichUI'
import { maKyPhu, hanTheoLich, trangThaiNop, ngayVN } from '@/lib/phanTich/hanNop'

export { hanTheoLich }

const nho = new Map()   // `${cty}|${nam}` → dữ liệu, giữ trong tab; tải lại trang (F5) thì lấy mới

export function useHanNop(ctyId, nam, lanDoc = 0) {
  const [ra, setRa] = useState({ dangTai: false, loi: '', nghiaVu: [] })
  useEffect(() => {
    if (!ctyId || !nam) { setRa({ dangTai: false, loi: '', nghiaVu: [] }); return }
    const k = `${ctyId}|${nam}`
    if (nho.has(k) && !lanDoc) { setRa({ dangTai: false, loi: '', nghiaVu: nho.get(k) }); return }
    let huy = false
    setRa({ dangTai: true, loi: '', nghiaVu: [] })   // không giữ hạn nộp của công ty trước trong lúc tải
    fetch(`/api/admin/phantich/han-nop?cty=${encodeURIComponent(ctyId)}&nam=${nam}`)
      .then(r => r.json())
      .then(j => {
        if (huy) return
        if (j.error) { setRa({ dangTai: false, loi: j.error, nghiaVu: [] }); return }
        nho.set(k, j.nghiaVu || [])
        setRa({ dangTai: false, loi: '', nghiaVu: j.nghiaVu || [] })
      })
      .catch(e => { if (!huy) setRa({ dangTai: false, loi: e.message, nghiaVu: [] }) })
    return () => { huy = true }
  }, [ctyId, nam, lanDoc])
  return ra
}

export default function HanNopKy({ data, k, nam }) {
  if (!k || !nam) return null
  if (data.dangTai) return <p className="text-xs text-gray-500 mb-4">Đang lấy hạn nộp và trạng thái nộp từ phân hệ Tờ khai…</p>
  if (data.loi) return <p className="text-xs text-gray-500 mb-4">Không lấy được trạng thái nộp từ phân hệ Tờ khai: {data.loi}</p>
  const phu = new Set(maKyPhu(k, nam))
  const ds = data.nghiaVu.filter(x => phu.has(x.ky))
  if (!ds.length) return <p className="text-xs text-gray-500 mb-4">Phân hệ Tờ khai chưa có lịch hạn nộp hay hồ sơ nộp nào của kỳ này (chưa đồng bộ từ cổng).</p>
  return (
    <div className="mb-4">
      <p className="text-[11px] text-gray-500 mb-1.5">Hạn nộp và trạng thái nộp — theo phân hệ Tờ khai (hồ sơ đồng bộ từ cổng thuế)</p>
      <div className="flex flex-wrap gap-2">
        {ds.map(x => {
          const tt = trangThaiNop(x)
          return (
            <div key={x.ky + x.ma} className="rounded-xl border border-gray-200 bg-white px-3 py-2 min-w-[230px] shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-gray-800">{x.ma} <span className="font-normal text-gray-500">· {x.ky.replace('.', '/')}</span></span>
                <span className="text-[11px] text-gray-500">Hạn {x.han ? ngayVN(x.han) : '— (ngoài lịch)'}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <ChipMau nhan={tt.nhan} mau={tt.mau} />
                {tt.phu && <span className="text-[11px] text-gray-500">{tt.phu}</span>}
              </div>
              {x.hoSo.length > 1 && (
                <p className="mt-1 text-[11px] text-gray-500">{x.hoSo.length} lần nộp: {x.hoSo.map(h => `${h.lanBoSung ? 'BS' + h.lanBoSung : 'CT'} ${ngayVN(h.tiepNhan || h.nop)}`).join(' · ')}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
