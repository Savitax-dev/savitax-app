'use client'
// Phân hệ Tiền lương — BƯỚC 1 — trưởng phòng xem + sửa (bắt buộc lý do) công phòng mình; view_payroll xem cả công ty.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { searchKey, goi, TRANG_THAI, trangThaiCua, HopThongBao } from './chung'
import NhapChamCong from './NhapChamCong'

// ── Chấm công phòng / toàn công ty ───────────────────────────────────────────
export default function CongPhong({ quyen }) {
  // Mặc định THÁNG NÀY — nhân viên khai công của tháng đang chạy; tháng trước chọn ở ô tháng.
  const [ky, setKy] = useState(quyen.thangDuocKhai[0])
  const [d, setD] = useState(null)
  const [loiTai, setLoiTai] = useState(null)
  const [sua, setSua] = useState(null)     // { dong, f }
  const [msg, setMsg] = useState(null)
  const [phong, setPhong] = useState('')
  const [loc, setLoc] = useState('')       // '' | xn | nhap | chua
  const [tim, setTim] = useState('')
  const [moNhap, setMoNhap] = useState(false)   // hộp nhập file máy chấm công (sql/38)

  const tai = useCallback(async () => {
    setD(null); setLoiTai(null)
    const j = await goi('/api/admin/luong?viec=phong&nam=' + ky.nam + '&thang=' + ky.thang)
    if (j.error) setLoiTai(j.error); else setD(j)
  }, [ky])
  useEffect(() => { tai() }, [tai])

  const dsPhong = useMemo(() => [...new Set((d?.data || []).map(x => x.phong).filter(Boolean))].sort(), [d])
  const theoPhong = (d?.data || []).filter(x => !phong || x.phong === phong)
  const dem = { xn: 0, nhap: 0, chua: 0 }
  for (const x of theoPhong) dem[trangThaiCua(x.cong)]++
  const k = searchKey(tim)
  // Xếp theo phòng, trưởng phòng đứng đầu mỗi phòng (giống tab Bảng lương).
  const ds = theoPhong.filter(x => (!loc || trangThaiCua(x.cong) === loc) && (!k || searchKey(x.full_name).includes(k)))
    .sort((a, b) => (a.phong ? 0 : 1) - (b.phong ? 0 : 1) || String(a.phong).localeCompare(String(b.phong), 'vi')
      || (b.truongPhong ? 1 : 0) - (a.truongPhong ? 1 : 0) || String(a.full_name).localeCompare(String(b.full_name), 'vi'))

  const luuSua = async () => {
    const f = sua.f
    const j = await goi('/api/admin/luong', { viec: 'sua_cong', id: sua.dong.cong.id, ...f, ngay_di_lam: Number(f.ngay_di_lam), nghi_phep: Number(f.nghi_phep), nghi_khong_luong: Number(f.nghi_khong_luong), so_lan_vi_pham: Number(f.so_lan_vi_pham) || 0 })
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setMsg({ loai: 'ok', text: 'Đã cập nhật bảng công của ' + sua.dong.full_name + '.' }); setSua(null); tai()
  }

  const thangChon = []
  for (let i = 0; i < 6; i++) {
    let y = quyen.thangDuocKhai[0].nam, m = quyen.thangDuocKhai[0].thang - i
    while (m < 1) { m += 12; y-- }
    thangChon.push({ nam: y, thang: m })
  }

  const The = ({ khoa, nhan, so, mau, phu }) => (
    <button onClick={() => khoa !== undefined && setLoc(loc === khoa ? '' : khoa)}
      className={'text-left rounded-2xl border p-4 transition-shadow ' + mau + (khoa !== undefined && loc === khoa ? ' ring-2 ring-offset-1 ring-[#8B1A1A]' : '') + (khoa !== undefined ? ' hover:shadow-md' : ' cursor-default')}>
      <div className="text-sm font-medium opacity-80">{nhan}</div>
      <div className="text-3xl font-bold mt-1">{so}</div>
      {phu && <div className="text-xs opacity-70 mt-0.5">{phu}</div>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={ky.nam + '-' + ky.thang} onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setKy({ nam: y, thang: m }) }}
          className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-medium shadow-sm">
          {thangChon.map(t => <option key={t.nam + '-' + t.thang} value={t.nam + '-' + t.thang}>Tháng {t.thang}/{t.nam}</option>)}
        </select>
        {dsPhong.length > 1 && (
          <select value={phong} onChange={e => setPhong(e.target.value)} className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm shadow-sm">
            <option value="">Tất cả phòng</option>
            {dsPhong.map(p => <option key={p} value={p}>Phòng {p}</option>)}
          </select>
        )}
        <input value={tim} onChange={e => setTim(e.target.value)} placeholder="🔍 Tìm nhân viên…"
          className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm shadow-sm w-60" />
        {d?.nhapDuoc && (
          <button onClick={() => setMoNhap(true)} className="ml-auto text-sm px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold shadow-sm hover:bg-cyan-800">📥 Nhập Excel chấm công</button>
        )}
      </div>
      {moNhap && <NhapChamCong ky={ky} onDong={() => setMoNhap(false)} onXong={() => { setMoNhap(false); tai() }} />}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {The({ nhan: 'Ngày công chuẩn', so: d ? d.ngayCong.chuan : '…', mau: 'bg-blue-50 border-blue-200 text-blue-900', phu: 'Tháng ' + ky.thang + '/' + ky.nam })}
        {The({ khoa: 'xn', nhan: '✓ Đã xác nhận', so: d ? dem.xn : '…', mau: 'bg-emerald-50 border-emerald-200 text-emerald-900', phu: 'Bấm để lọc' })}
        {The({ khoa: 'nhap', nhan: '✎ Đang nháp', so: d ? dem.nhap : '…', mau: 'bg-amber-50 border-amber-200 text-amber-900', phu: 'Bấm để lọc' })}
        {The({ khoa: 'chua', nhan: '⚠ Chưa khai', so: d ? dem.chua : '…', mau: 'bg-rose-50 border-rose-200 text-rose-900', phu: 'Bấm để lọc' })}
      </div>

      {loiTai && <HopThongBao msg={{ loai: 'loi', text: loiTai }} />}
      <HopThongBao msg={msg} />

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gradient-to-r from-gray-50 to-rose-50/40 border-b border-gray-200">
              <th className="px-4 py-3 font-semibold">Nhân viên</th><th className="px-4 py-3 font-semibold">Phòng</th>
              <th className="px-4 py-3 font-semibold text-right text-emerald-700">Đi làm</th><th className="px-4 py-3 font-semibold text-right text-amber-700">Phép</th>
              <th className="px-4 py-3 font-semibold text-right text-rose-700">Không lương</th><th className="px-4 py-3 font-semibold text-right text-violet-700">Vi phạm</th><th className="px-4 py-3 font-semibold text-right text-blue-700">Tính lương</th>
              <th className="px-4 py-3 font-semibold">Ghi chú</th><th className="px-4 py-3 font-semibold">Trạng thái</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {!d && !loiTai && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Đang tải…</td></tr>}
              {ds.map((x, i) => {
                const c = x.cong
                const tt = TRANG_THAI[trangThaiCua(c)]
                const dangSua = sua?.dong.staff_id === x.staff_id
                return (
                  <Fragment key={x.staff_id}>
                  {(i === 0 || ds[i - 1].phong !== x.phong) && (
                    <tr className="bg-rose-50/70 border-t-2 border-rose-200">
                      <td colSpan={10} className="px-4 py-2 text-sm font-bold text-[#8B1A1A]">
                        🏢 {x.phong ? 'Phòng ' + x.phong : 'Chưa xếp phòng'} <span className="font-normal text-gray-500">· {ds.filter(y => y.phong === x.phong).length} người</span>
                      </td>
                    </tr>
                  )}
                  <tr className={'border-t border-gray-100 align-middle ' + (dangSua ? 'bg-blue-50' : i % 2 ? 'bg-gray-50/50' : 'bg-white') + ' hover:bg-rose-50/40'}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-100 to-amber-100 text-[#8B1A1A] text-xs font-bold flex items-center justify-center flex-shrink-0">{(x.full_name || '?').split(' ').pop().charAt(0)}</span>
                        <span className="font-medium text-gray-900">{x.full_name}{x.truongPhong && <span className="ml-1.5 text-[10px] font-bold rounded px-1.5 py-0.5 bg-violet-100 text-violet-800 align-middle">TP</span>}
                          <span className="block text-[11px] font-normal text-gray-400">{x.maNv || 'chưa có mã'}{!x.chamCongMay && <span className="ml-1.5 rounded bg-sky-50 text-sky-700 px-1">tự khai</span>}</span></span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{x.phong ? <span className="text-xs rounded-md bg-slate-100 text-slate-700 px-2 py-0.5">{x.phong}</span> : <span className="text-gray-300">—</span>}</td>
                    {dangSua ? ['ngay_di_lam', 'nghi_phep', 'nghi_khong_luong', 'so_lan_vi_pham'].map(kk => (
                      <td key={kk} className="px-2 py-1.5 text-right"><input type="number" step={c?.nguon === 'may_cham_cong' ? '0.01' : '0.5'} min="0" value={sua.f[kk]}
                        onChange={e => setSua(s => ({ ...s, f: { ...s.f, [kk]: e.target.value } }))} className="w-16 border border-blue-300 rounded-lg px-1.5 py-1 text-right bg-white" /></td>
                    )) : <>
                      <td className="px-4 py-2.5 text-right text-emerald-800">{c ? c.ngay_di_lam : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-amber-800">{c ? c.nghi_phep : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-rose-800">{c ? c.nghi_khong_luong : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-violet-800">{c ? (Number(c.so_lan_vi_pham) ? <span title={'Tác phong ' + Math.max(0, 100 - 20 * Number(c.so_lan_vi_pham)) + '%'}>{c.so_lan_vi_pham} lần</span> : '0') : '—'}
                        {c?.may && (c.may.muon_lan || c.may.som_lan) ? <div className="text-[11px] text-gray-500 whitespace-nowrap">muộn {c.may.muon_lan || 0} ({c.may.muon_phut || 0}′) · sớm {c.may.som_lan || 0} ({c.may.som_phut || 0}′)</div> : null}</td>
                    </>}
                    <td className="px-4 py-2.5 text-right"><b className="text-blue-800">{c ? Math.round((Number(c.ngay_di_lam) + Number(c.nghi_phep)) * 100) / 100 : '—'}</b></td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[260px]">
                      {dangSua
                        ? <input value={sua.f.ly_do} onChange={e => setSua(s => ({ ...s, f: { ...s.f, ly_do: e.target.value } }))} placeholder="Lý do sửa (bắt buộc)" className="w-full border border-blue-300 rounded-lg px-2 py-1 bg-white" />
                        : <>{c?.ghi_chu || ''}{c?.trang_thai === 'bao_sai' && <div className="text-rose-700 font-medium">⚠ NV báo sai: {c.bao_sai}</div>}</>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {c?.trang_thai === 'bao_sai' ? <span className="text-xs rounded-full border px-2.5 py-0.5 font-medium bg-rose-100 text-rose-800 border-rose-200">Báo sai</span>
                        : c?.nguon === 'may_cham_cong' && c.trang_thai === 'nhap' ? <span className="text-xs rounded-full border px-2.5 py-0.5 font-medium bg-cyan-100 text-cyan-800 border-cyan-200">Chờ NV xác nhận</span>
                        : <span className={'text-xs rounded-full border px-2.5 py-0.5 font-medium ' + tt.lop}>{tt.nhan}</span>}
                      {c?.nguon === 'may_cham_cong' && <span className="ml-1 text-[10px] text-cyan-700" title="Số lấy từ máy chấm công">🕘 máy</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right">
                      {dangSua ? <>
                        <button onClick={luuSua} className="text-xs px-3 py-1 rounded-lg bg-[#8B1A1A] text-white mr-1">Lưu</button>
                        <button onClick={() => setSua(null)} className="text-xs text-gray-500">Hủy</button>
                      </> : (c && x.duocSua && (
                        <button onClick={() => { setMsg(null); setSua({ dong: x, f: { ngay_di_lam: c.ngay_di_lam, nghi_phep: c.nghi_phep, nghi_khong_luong: c.nghi_khong_luong, so_lan_vi_pham: c.so_lan_vi_pham ?? 0, ly_do: '' } }) }}
                          className="text-xs px-3 py-1 rounded-lg border border-[#8B1A1A]/30 text-[#8B1A1A] hover:bg-rose-50">✎ Sửa</button>
                      ))}
                    </td>
                  </tr>
                  </Fragment>
                )
              })}
              {d && !ds.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Không có nhân viên nào khớp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">Trưởng phòng sửa được bảng công của nhân viên phòng mình; mỗi lần sửa phải ghi lý do và được lưu lại.</p>
      </div>
    </div>
  )
}
