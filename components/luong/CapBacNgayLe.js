'use client'
// Phân hệ Tiền lương — BƯỚC 1 — bảng cấp bậc và ngày nghỉ lễ (manage_payroll).
import { useCallback, useEffect, useState } from 'react'
import { ngayCongChuan } from '@/lib/luong/ngayCong'
import { pad, soNhap, thuVN, goi, HopThongBao } from './chung'
import HoSoLuongExcel from './HoSoLuongExcel'
import HoaHongBac from './HoaHongBac'

// ── Cấp bậc & ngày lễ ────────────────────────────────────────────────────────
export default function ThietLap() {
  const [ds, setDs] = useState(null)
  const [msg, setMsg] = useState(null)
  const nam = new Date(Date.now() + 7 * 3600e3).getUTCFullYear()
  const [namLe, setNamLe] = useState(nam)
  const [le, setLe] = useState([])
  const [moi, setMoi] = useState({ ngay: '', den: '', ten: '' })

  const taiCap = useCallback(async () => {
    const j = await goi('/api/admin/luong?viec=cap_bac')
    if (j.error) setMsg({ loai: 'loi', text: j.error }); else setDs(j.data.map(r => ({ ...r })))
  }, [])
  const taiLe = useCallback(async () => {
    const j = await goi('/api/admin/luong?viec=ngay_le&nam=' + namLe)
    if (!j.error) setLe(j.data)
  }, [namLe])
  useEffect(() => { taiCap() }, [taiCap])
  useEffect(() => { taiLe() }, [taiLe])

  const luuCap = async () => {
    const j = await goi('/api/admin/luong', { viec: 'luu_cap_bac', ds })
    setMsg(j.error ? { loai: 'loi', text: j.error } : { loai: 'ok', text: 'Đã lưu bảng cấp bậc. Lương người đã gán không tự đổi theo — sửa ở trang Quản lý nhân viên nếu cần.' })
    if (!j.error) taiCap()
  }
  const doiO = (i, kk, v) => setDs(a => a.map((r, j) => j === i ? { ...r, [kk]: v } : r))
  // Thêm cấp mới (anh yêu cầu 02/11/2026): dòng chưa có mã, máy chủ tự sinh mã khi Lưu. Gợi ý tên "Cấp <số kế>".
  const themCap = () => setDs(a => {
    const so = Math.max(0, ...(a || []).filter(r => r.nhom !== 'truong_phong').map(r => Number(String(r.ten).match(/(\d+)\s*$/)?.[1]) || 0)) + 1
    const cuoi = [...(a || [])].reverse().find(r => r.nhom !== 'truong_phong' && r.ma)
    const moiCap = { khoa: 'moi-' + Date.now(), ma: null, ten: 'Cấp ' + so, nhom: 'nhan_vien', mo_ta: '',
      luong_co_ban: null, doanh_thu_toi_thieu: cuoi?.doanh_thu_toi_thieu ?? null, luong_bhxh: null }
    const viTri = (a || []).findIndex(r => r.nhom === 'truong_phong')
    return viTri < 0 ? [...(a || []), moiCap] : [...a.slice(0, viTri), moiCap, ...a.slice(viTri)]
  })
  const xoaCap = async (i) => {
    const r = ds[i]
    if (!r.ma) { setDs(a => a.filter((_, j) => j !== i)); return }
    if (!confirm('Xoá ' + r.ten + ' khỏi bảng cấp bậc?')) return
    const j = await goi('/api/admin/luong', { viec: 'xoa_cap_bac', ma: r.ma })
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setMsg({ loai: 'ok', text: 'Đã xoá ' + r.ten + '.' })
    setDs(a => a.filter(x => x.ma !== r.ma))
  }
  const coDongMoi = (ds || []).some(r => !r.ma)
  const themLe = async () => {
    const j = await goi('/api/admin/luong', { viec: 'them_ngay_le', ...moi })
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setMoi({ ngay: '', den: '', ten: '' }); taiLe()
  }
  const xoaLe = async (dot) => {
    if (!confirm('Bỏ ' + (dot.ngays.length > 1 ? 'cả đợt nghỉ ' + dot.ngays.length + ' ngày "' + dot.ten + '"' : 'ngày lễ ' + dot.ngays[0]) + '?')) return
    const j = await goi('/api/admin/luong', { viec: 'xoa_ngay_le', ngays: dot.ngays })
    if (j.error) setMsg({ loai: 'loi', text: j.error }); else taiLe()
  }
  // Gộp các ngày LIỀN NHAU cùng tên thành một đợt nghỉ để hiện gọn (vd Tết 9 ngày → một dòng).
  const dotLe = []
  for (const x of le) {
    const cuoi = dotLe[dotLe.length - 1]
    const ke = cuoi && new Date(new Date(cuoi.ngays[cuoi.ngays.length - 1] + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
    if (cuoi && cuoi.ten === x.ten && ke === x.ngay) cuoi.ngays.push(x.ngay)
    else dotLe.push({ ten: x.ten, ngays: [x.ngay] })
  }
  const dd = n => n.slice(8, 10) + '/' + n.slice(5, 7)

  const leNgay = le.map(x => x.ngay)

  return (
    <div className="space-y-4">
      <HoSoLuongExcel />
      <HoaHongBac />
      <HopThongBao msg={msg} />
      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4 items-start">
        <div className="2xl:col-span-3 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
            <span className="font-semibold text-blue-900">🏅 Bảng cấp bậc</span>
            <div className="flex items-center gap-2">
              <button onClick={themCap} disabled={!ds} className="text-sm px-4 py-2 rounded-xl border border-blue-200 bg-white text-blue-800 font-semibold hover:bg-blue-50 disabled:opacity-50">+ Thêm cấp bậc</button>
              <button onClick={luuCap} disabled={!ds} className={'text-sm px-4 py-2 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm disabled:opacity-50 ' + (coDongMoi ? 'ring-2 ring-amber-300' : '')}>Lưu bảng cấp bậc</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-2.5 font-semibold">Cấp</th><th className="px-4 py-2.5 font-semibold">Mô tả</th>
                <th className="px-4 py-2.5 font-semibold text-right text-emerald-700">Lương cơ bản</th><th className="px-4 py-2.5 font-semibold text-right text-blue-700">Doanh thu tối thiểu</th>
                <th className="px-4 py-2.5 font-semibold text-right text-violet-700">Lương đóng BHXH</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr></thead>
              <tbody>
                {(ds || []).map((r, i) => (
                  <tr key={r.ma || r.khoa} className={'border-t border-gray-100 ' + (!r.ma ? 'bg-amber-50/70' : r.nhom === 'truong_phong' ? 'bg-violet-50/40' : '')}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.ma
                        ? <span className={'text-xs font-bold rounded-lg px-2.5 py-1 ' + (r.nhom === 'truong_phong' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800')}>{r.ten}</span>
                        : <div className="flex flex-col gap-1">
                            <input value={r.ten} onChange={e => doiO(i, 'ten', e.target.value)} maxLength={30} placeholder="Tên cấp"
                              className="w-28 border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-900" />
                            <select value={r.nhom} onChange={e => { const n = e.target.value; setDs(a => a.map((x, j) => j !== i ? x : { ...x, nhom: n,
                              // Trưởng phòng không xét doanh thu tối thiểu — bỏ số gợi ý của cấp nhân viên
                              doanh_thu_toi_thieu: n === 'truong_phong' ? null : x.doanh_thu_toi_thieu ?? [...a].reverse().find(y => y.ma && y.nhom !== 'truong_phong')?.doanh_thu_toi_thieu ?? null })) }} className="w-28 border border-gray-200 rounded-lg px-1 py-0.5 text-[11px] bg-white">
                              <option value="nhan_vien">Nhân viên</option>
                              <option value="truong_phong">Trưởng phòng</option>
                            </select>
                          </div>}
                    </td>
                    <td className="px-4 py-2"><input value={r.mo_ta || ''} onChange={e => doiO(i, 'mo_ta', e.target.value)} className="w-full min-w-[160px] border border-gray-200 rounded-lg px-2 py-1 text-xs" /></td>
                    {['luong_co_ban', 'doanh_thu_toi_thieu', 'luong_bhxh'].map(kk => (
                      <td key={kk} className="px-4 py-2 text-right">
                        <input value={r[kk] === null || r[kk] === undefined ? '' : Number(r[kk]).toLocaleString('vi-VN')} onChange={e => doiO(i, kk, soNhap(e.target.value))}
                          placeholder="—" className="w-36 border border-gray-200 rounded-lg px-2 py-1 text-right font-medium" />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => xoaCap(i)} title={r.ma ? 'Xoá cấp (chỉ khi chưa gán cho nhân viên nào)' : 'Bỏ dòng chưa lưu'}
                        className="text-gray-300 hover:text-rose-600 text-sm">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coDongMoi && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-t border-amber-100">Có cấp mới chưa lưu — nhập lương cơ bản rồi bấm <b>Lưu bảng cấp bậc</b>. Tên cấp phải khác các cấp đã có (file hồ sơ lương nhận cấp theo tên).</p>}
          <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">Để trống "Doanh thu tối thiểu" = không xét thưởng vượt doanh số (trưởng phòng). Để trống "Lương đóng BHXH" = cấp này chưa đóng BHXH. Cấp nhân viên: ghi mô tả dạng "Trên 6 tháng – dưới 1 năm" để báo cáo thâm niên tự xét lên cấp. Chỉ xoá được cấp chưa gán cho ai.</p>
        </div>

        <div className="2xl:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-white">
            <span className="font-semibold text-violet-900">🎉 Ngày nghỉ lễ</span>
            <select value={namLe} onChange={e => setNamLe(Number(e.target.value))} className="border border-gray-200 bg-white rounded-lg px-2 py-1 text-sm">
              {[nam - 1, nam, nam + 1].map(y => <option key={y} value={y}>Năm {y}</option>)}
            </select>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {dotLe.map(dot => {
                const dau = dot.ngays[0], cuoi = dot.ngays[dot.ngays.length - 1]
                const ngayThuong = dot.ngays.filter(n => thuVN(n) !== 'CN').length
                return (
                  <span key={dau} className="text-xs rounded-full border border-violet-200 bg-violet-50 text-violet-800 px-3 py-1">
                    {dot.ngays.length > 1
                      ? <><b>{dd(dau)} – {dd(cuoi)}</b> · {dot.ten} <span className="text-violet-500">({dot.ngays.length} ngày, trừ {ngayThuong} công)</span></>
                      : <><b>{dd(dau)}</b> ({thuVN(dau)}) · {dot.ten}</>}
                    <button onClick={() => xoaLe(dot)} className="ml-1.5 text-rose-400 hover:text-rose-600">✕</button>
                  </span>
                )
              })}
              {!le.length && <span className="text-xs text-gray-400">Chưa khai ngày lễ nào cho năm {namLe}.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-gray-500">Từ ngày
                <input type="date" value={moi.ngay} onChange={e => setMoi(v => ({ ...v, ngay: e.target.value, den: v.den && v.den < e.target.value ? e.target.value : v.den }))} className="block border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">Đến ngày <span className="text-gray-400">(nghỉ 1 ngày thì bỏ trống)</span>
                <input type="date" value={moi.den} min={moi.ngay || undefined} onChange={e => setMoi(v => ({ ...v, den: e.target.value }))} className="block border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <input value={moi.ten} onChange={e => setMoi(v => ({ ...v, ten: e.target.value }))} placeholder="Tên ngày lễ (vd: Tết Nguyên đán)" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[180px]" />
              <button onClick={themLe} className="text-sm px-4 py-1.5 rounded-lg bg-violet-600 text-white font-medium">+ Thêm</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => { const c = ngayCongChuan(namLe, m, leNgay); return (
                <div key={m} className={'rounded-xl px-3 py-2 border ' + (c.le ? 'bg-violet-50 border-violet-200' : 'bg-blue-50/60 border-blue-100')}>
                  <div className="text-xs text-gray-500">Tháng {pad(m)}</div>
                  <div className="text-lg font-bold text-blue-900">{c.chuan} <span className="text-xs font-normal text-gray-500">công</span></div>
                  {c.le > 0 && <div className="text-xs text-violet-700">−{c.le} ngày lễ</div>}
                </div>
              ) })}
            </div>
            <p className="text-xs text-gray-500">Ngày lễ rơi vào chủ nhật không trừ thêm. Ngày nghỉ bù thì khai như một ngày lễ.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
