'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Tab "Thưởng dịch vụ khác" — phân hệ Tiền lương bước 2 (sql/32).
//   Nhân viên: chọn hồ sơ Dịch vụ khác ĐÃ CÓ THU → nhập số tiền thực nhận + tỉ lệ % → app tính thưởng.
//   Trưởng phòng: duyệt / trả lại dòng khai của nhân viên phòng mình. Chỉ dòng đã duyệt mới vào bảng lương.
// App đối chiếu tổng mọi người khai cho một hồ sơ với số đã thu trên app — vượt thì CẢNH BÁO, không chặn.

const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('vi-VN')
const soNhap = s => { const v = String(s ?? '').replace(/[^\d]/g, ''); return v === '' ? '' : Number(v) }
const searchKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const TT = {
  cho_duyet: ['Chờ duyệt', 'bg-amber-100 text-amber-800 border-amber-200'],
  da_duyet: ['Đã duyệt', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  tra_lai: ['Trả lại', 'bg-rose-100 text-rose-800 border-rose-200'],
}

async function goi(url, body) {
  try {
    const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
    const j = await res.json().catch(() => ({ error: 'Máy chủ trả phản hồi không đọc được' }))
    if (!res.ok && !j.error) j.error = 'Lỗi máy chủ (' + res.status + ')'
    return j
  } catch (e) { return { error: 'Không kết nối được máy chủ: ' + (e.message || e) } }
}

export default function ThuongDvk({ quyen }) {
  const kyMacDinh = quyen.thangDuocKhai[0]
  const [ky, setKy] = useState(kyMacDinh)
  const [d, setD] = useState(null)
  const [duyet, setDuyet] = useState(null)
  const [msg, setMsg] = useState(null)
  const [f, setF] = useState({ service_id: '', so_tien: '', ty_le: '', ghi_chu: '', ngoai_app: false, ten_ngoai: '' })
  const [tim, setTim] = useState('')
  const [moDs, setMoDs] = useState(false)   // ô chọn hồ sơ dạng thả xuống
  const hopChon = useRef(null)
  useEffect(() => {
    const dong = e => { if (hopChon.current && !hopChon.current.contains(e.target)) setMoDs(false) }
    document.addEventListener('mousedown', dong)
    return () => document.removeEventListener('mousedown', dong)
  }, [])
  const coDuyet = quyen.admin || quyen.view || (quyen.phongTruong || []).length > 0

  const tai = useCallback(async () => {
    setD(null)
    const [a, b] = await Promise.all([
      goi('/api/admin/luong/thuong?viec=dvk_cua_toi&nam=' + ky.nam + '&thang=' + ky.thang),
      coDuyet ? goi('/api/admin/luong/thuong?viec=dvk_duyet&nam=' + ky.nam + '&thang=' + ky.thang) : Promise.resolve(null),
    ])
    if (a.error) { setMsg({ loai: 'loi', text: a.error }); return }
    setD(a); setDuyet(b && !b.error ? b.data : null)
  }, [ky, coDuyet])
  useEffect(() => { tai() }, [tai])

  const hoSo = useMemo(() => {
    const k = searchKey(tim)
    return (d?.hoSo || []).filter(h => !k || searchKey(h.ten + ' ' + h.cty + ' ' + h.ma).includes(k))
  }, [d, tim])
  const chon = (d?.hoSo || []).find(h => h.id === f.service_id)
  const thuong = f.so_tien && f.ty_le ? Math.round(Number(f.so_tien) * Number(f.ty_le) / 100) : 0
  const vuot = chon && f.so_tien ? chon.daKhai + Number(f.so_tien) > chon.daThu : false

  const them = async () => {
    setMsg(null)
    if (!f.ngoai_app && !f.service_id) { setMsg({ loai: 'loi', text: 'Chọn hồ sơ dịch vụ khác — hoặc tick "Dịch vụ chưa có trên app".' }); return }
    if (f.ngoai_app && f.ten_ngoai.trim().length < 3) { setMsg({ loai: 'loi', text: 'Ghi tên dịch vụ (và công ty) chưa có trên app.' }); return }
    if (f.ngoai_app && f.ghi_chu.trim().length < 5) { setMsg({ loai: 'loi', text: 'Dịch vụ chưa có trên app thì bắt buộc ghi chú.' }); return }
    const j = await goi('/api/admin/luong/thuong', { viec: 'dvk_them', nam: ky.nam, thang: ky.thang, ...f })
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setF({ service_id: '', so_tien: '', ty_le: '', ghi_chu: '', ngoai_app: false, ten_ngoai: '' })
    setMsg({ loai: j.canhBao?.length ? 'canh_bao' : 'ok', text: 'Đã gửi khai, chờ trưởng phòng duyệt.' + (j.canhBao?.length ? ' ⚠ ' + j.canhBao.join(' ') : '') })
    tai()
  }
  const xoa = async (id) => {
    if (!confirm('Xoá dòng khai này?')) return
    const j = await goi('/api/admin/luong/thuong', { viec: 'dvk_xoa', id })
    if (j.error) setMsg({ loai: 'loi', text: j.error }); else tai()
  }
  const xuLy = async (x, dongY) => {
    let lyDo = ''
    if (!dongY) { lyDo = prompt('Lý do trả lại dòng khai của ' + x.ten_nv + ':') || ''; if (!lyDo.trim()) return }
    const j = await goi('/api/admin/luong/thuong', { viec: 'dvk_duyet', id: x.id, dong_y: dongY, ly_do: lyDo })
    if (j.error) setMsg({ loai: 'loi', text: j.error }); else tai()
  }

  const kyChon = [quyen.thangDuocKhai[0], quyen.thangDuocKhai[1]]
  const tongCuaToi = (d?.data || []).filter(x => x.trang_thai !== 'tra_lai').reduce((a, x) => a + Number(x.tien_thuong), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 mr-1">Kỳ lương</span>
        {kyChon.map(t => {
          const c = ky.nam === t.nam && ky.thang === t.thang
          return <button key={t.nam + '-' + t.thang} onClick={() => setKy(t)}
            className={'text-sm px-4 py-2 rounded-xl border font-medium ' + (c ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-[#8B1A1A]')}>Tháng {t.thang}/{t.nam}</button>
        })}
      </div>

      {msg && <div className={'rounded-xl border px-4 py-2.5 text-sm ' + (msg.loai === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : msg.loai === 'canh_bao' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800')}>{msg.text}</div>}

      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4 items-start">
        {/* KHÔNG overflow-hidden ở khung này: danh sách thả xuống của ô chọn hồ sơ bị cắt mất phần dưới. */}
        <div className="2xl:col-span-2 rounded-2xl border border-orange-200 bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white font-semibold text-orange-900 rounded-t-2xl">➕ Khai thưởng dịch vụ khác</div>
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={f.ngoai_app} onChange={e => { setF(v => ({ ...v, ngoai_app: e.target.checked, service_id: '' })); setMoDs(false) }} />
              Dịch vụ <b>chưa có trên app</b> <span className="text-xs text-gray-400">(bắt buộc ghi chú)</span>
            </label>
            {f.ngoai_app && (
              <input value={f.ten_ngoai} onChange={e => setF(v => ({ ...v, ten_ngoai: e.target.value }))} maxLength={200}
                placeholder="Tên dịch vụ · tên công ty (vd: Quyết toán thuế TNCN 2025 · Cty ABC)"
                className="w-full border border-amber-300 bg-amber-50/40 rounded-xl px-3 py-2 text-sm" />
            )}
            {!f.ngoai_app && <div ref={hopChon} className="relative">
              <div className={'flex items-center border rounded-xl bg-white ' + (moDs ? 'border-[#8B1A1A] ring-2 ring-rose-100' : 'border-gray-200')}>
                <span className="pl-3 text-gray-400">🔍</span>
                <input value={moDs ? tim : (chon ? chon.cty + ' · ' + chon.ten : tim)}
                  onChange={e => { setTim(e.target.value); setMoDs(true) }} onFocus={() => { setTim(''); setMoDs(true) }}
                  placeholder="Chọn hồ sơ dịch vụ khác — gõ tên dịch vụ, công ty, mã KH…"
                  className="flex-1 min-w-0 px-2 py-2 text-sm bg-transparent outline-none" />
                {chon && !moDs && <button onClick={() => { setF(v => ({ ...v, service_id: '' })); setTim('') }} className="px-1 text-gray-400 hover:text-rose-600" title="Bỏ chọn">✕</button>}
                <button type="button" onClick={() => setMoDs(v => !v)} className="px-3 py-2 text-gray-500 hover:text-[#8B1A1A] border-l border-gray-100" aria-label="Mở danh sách hồ sơ">
                  <span className={'inline-block transition-transform ' + (moDs ? 'rotate-180' : '')}>▾</span>
                </button>
              </div>
              {moDs && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                  {!hoSo.length && <div className="px-3 py-4 text-sm text-gray-400 text-center">{d?.hoSo?.length ? 'Không có hồ sơ khớp từ tìm.' : 'Chưa có hồ sơ Dịch vụ khác nào đã thu tiền thuộc công ty / phòng của anh/chị.'}</div>}
                  {hoSo.map(h => (
                    <button key={h.id} type="button" onClick={() => { setF(v => ({ ...v, service_id: h.id })); setMoDs(false); setTim('') }}
                      className={'w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-orange-50 ' + (h.id === f.service_id ? 'bg-orange-50' : '')}>
                      <div className="text-sm font-medium text-gray-900 truncate">{h.cty}</div>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-gray-600 truncate">{h.ten} · kỳ {h.ky}</span>
                        <span className="whitespace-nowrap text-emerald-700">đã thu {fmt(h.daThu)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>}
            {chon && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-orange-50 px-2 py-1.5"><div className="text-gray-500">Phải thu</div><b className="text-orange-900">{fmt(chon.phaiThu)}</b></div>
                <div className="rounded-lg bg-emerald-50 px-2 py-1.5"><div className="text-gray-500">Đã thu trên app</div><b className="text-emerald-800">{fmt(chon.daThu)}</b></div>
                <div className="rounded-lg bg-blue-50 px-2 py-1.5"><div className="text-gray-500">Mọi người đã khai</div><b className="text-blue-800">{fmt(chon.daKhai)}</b></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">Số tiền thực nhận
                <input value={f.so_tien === '' ? '' : Number(f.so_tien).toLocaleString('vi-VN')} onChange={e => setF(v => ({ ...v, so_tien: soNhap(e.target.value) }))}
                  className="block w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-right font-semibold text-gray-900" placeholder="0" />
              </label>
              <label className="text-xs text-gray-500">Tỉ lệ được hưởng (%)
                <input type="number" min="0" max="100" step="0.5" value={f.ty_le} onChange={e => setF(v => ({ ...v, ty_le: e.target.value }))}
                  className="block w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-right font-semibold text-gray-900" placeholder="20" />
              </label>
            </div>
            {vuot && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">⚠ Tổng mọi người khai sẽ vượt số đã thu trên app — vẫn gửi được, trưởng phòng sẽ thấy cảnh báo.</p>}
            <input value={f.ghi_chu} onChange={e => setF(v => ({ ...v, ghi_chu: e.target.value }))} maxLength={300}
              placeholder={f.ngoai_app ? 'Ghi chú BẮT BUỘC: vì sao chưa có trên app, khách trả ngày nào, làm cùng ai…' : 'Ghi chú (vd: làm cùng chị X, phần của em 50%)'}
              className={'w-full border rounded-xl px-3 py-2 text-sm ' + (f.ngoai_app && f.ghi_chu.trim().length < 5 ? 'border-amber-400 bg-amber-50/40' : 'border-gray-200')} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Thưởng: <b className="text-orange-700 text-lg">{fmt(thuong)}</b></span>
              <button onClick={them} className="text-sm px-5 py-2.5 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm">Gửi khai</button>
            </div>
          </div>
        </div>

        <div className="2xl:col-span-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
            <span className="font-semibold text-amber-900">📋 Dòng khai của tôi · kỳ {ky.thang}/{ky.nam}</span>
            <span className="text-sm text-gray-600">Tổng (chưa tính dòng trả lại) <b className="text-orange-700">{fmt(tongCuaToi)}</b></span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {!d && <tr><td className="px-4 py-6 text-center text-gray-400">Đang tải…</td></tr>}
              {d && !d.data.length && <tr><td className="px-4 py-6 text-center text-gray-400">Chưa khai dòng nào cho kỳ này.</td></tr>}
              {(d?.data || []).map(x => (
                <tr key={x.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5"><div className="text-gray-900">{x.ten_dv}</div><div className="text-xs text-gray-500">{fmt(x.so_tien)} × {Number(x.ty_le).toLocaleString('vi-VN')}%{x.ghi_chu ? ' · ' + x.ghi_chu : ''}{x.ly_do_tra ? ' · Lý do trả: ' + x.ly_do_tra : ''}</div></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-orange-700 whitespace-nowrap">{fmt(x.tien_thuong)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><span className={'text-xs rounded-full border px-2.5 py-0.5 ' + TT[x.trang_thai][1]}>{TT[x.trang_thai][0]}</span></td>
                  <td className="px-4 py-2.5 text-right">{x.trang_thai !== 'da_duyet' && <button onClick={() => xoa(x.id)} className="text-xs text-rose-500 hover:underline">Xoá</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {coDuyet && duyet && (
        <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white flex items-center justify-between">
            <span className="font-semibold text-emerald-900">✅ Duyệt thưởng dịch vụ khác · kỳ {ky.thang}/{ky.nam}</span>
            <span className="text-sm text-gray-600">Chờ duyệt <b className="text-amber-700">{duyet.filter(x => x.trang_thai === 'cho_duyet').length}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-2.5 font-semibold">Nhân viên</th><th className="px-4 py-2.5 font-semibold">Hồ sơ</th>
                <th className="px-4 py-2.5 font-semibold text-right">Thực nhận × %</th><th className="px-4 py-2.5 font-semibold text-right text-orange-700">Thưởng</th>
                <th className="px-4 py-2.5 font-semibold text-right">Đối chiếu đã thu</th><th className="px-4 py-2.5 font-semibold">Trạng thái</th><th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {!duyet.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Chưa có dòng khai nào trong phạm vi duyệt của anh/chị.</td></tr>}
                {duyet.map(x => {
                  const vuotHs = x.daThuHoSo !== null && x.daKhaiHoSo > x.daThuHoSo
                  return (
                    <tr key={x.id} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-2.5"><div className="font-medium text-gray-900">{x.ten_nv}</div><div className="text-xs text-gray-500">{x.phong}</div></td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[320px]">{x.ten_dv}{x.ghi_chu && <div className="text-xs text-gray-500">{x.ghi_chu}</div>}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmt(x.so_tien)} × {Number(x.ty_le).toLocaleString('vi-VN')}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-orange-700 whitespace-nowrap">{fmt(x.tien_thuong)}</td>
                      <td className={'px-4 py-2.5 text-right text-xs whitespace-nowrap ' + (vuotHs ? 'text-rose-600 font-semibold' : 'text-gray-500')}>
                        {x.service_id
                          ? <>khai {fmt(x.daKhaiHoSo)} / thu {fmt(x.daThuHoSo)}{vuotHs && <div>⚠ khai vượt số đã thu</div>}</>
                          : <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5">Ngoài app · kiểm theo ghi chú</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className={'text-xs rounded-full border px-2.5 py-0.5 ' + TT[x.trang_thai][1]}>{TT[x.trang_thai][0]}</span>{x.ly_do_tra && <div className="text-xs text-gray-500 mt-0.5">{x.ly_do_tra}</div>}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {x.duocDuyet && x.trang_thai !== 'da_duyet' && <button onClick={() => xuLy(x, true)} className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white mr-1">Duyệt</button>}
                        {x.duocDuyet && x.trang_thai !== 'tra_lai' && <button onClick={() => xuLy(x, false)} className="text-xs px-3 py-1 rounded-lg border border-rose-300 text-rose-600">Trả lại</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
