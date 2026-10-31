'use client'
// Phân hệ Tiền lương — BƯỚC 1 — nhập file "Bảng chấm công chi tiết" của phần mềm chấm công (anh chốt 23/10/2026).
// Trình duyệt đọc file (lib/luong/mayChamCong.js) → máy chủ ghép mã / tên, quy đổi, XEM TRƯỚC → bấm Ghi.
// Số ghi vào bảng công ở trạng thái nháp, nguồn "máy chấm công": từng nhân viên Xác nhận đúng hoặc Báo sai.
import { useState } from 'react'
import { goi } from './chung'
import { docFileMayChamCong, KHOA_SO } from '@/lib/luong/mayChamCong'

const NHAN = {
  moi: ['Mới', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  cap_nhat: ['Thay số nháp', 'bg-amber-100 text-amber-800 border-amber-200'],
  da_xac_nhan: ['Đã xác nhận — ghi đè?', 'bg-rose-100 text-rose-800 border-rose-200'],
  loi: ['Lỗi — không ghi', 'bg-red-100 text-red-800 border-red-300'],
  khong_thay: ['Không có trên app', 'bg-gray-100 text-gray-600 border-gray-200'],
  remote: ['Phòng remote — bỏ qua', 'bg-sky-50 text-sky-700 border-sky-200'],
  tu_khai: ['Tự khai — bỏ qua', 'bg-sky-50 text-sky-700 border-sky-200'],
  quan_tri: ['Quản trị — không chấm công', 'bg-sky-50 text-sky-700 border-sky-200'],
}
const fmt = n => n == null ? '—' : Number(n).toLocaleString('vi-VN')

export default function NhapChamCong({ ky, onDong, onXong }) {
  const [file, setFile] = useState(null)        // { ten, doc }
  const [xem, setXem] = useState(null)          // kết quả xem trước từ máy chủ
  const [msg, setMsg] = useState(null)
  const [ban, setBan] = useState(false)
  const [luuMa, setLuuMa] = useState(true)
  const [ghiDe, setGhiDe] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const [loc, setLoc] = useState('')

  const gui = (doc, ten, ghi) => goi('/api/admin/luong', {
    viec: 'nhap_may', nam: ky.nam, thang: ky.thang, tuNgay: doc.tuNgay, denNgay: doc.denNgay, tenFile: ten, ghi,
    luuMa, ghiDeXacNhan: ghiDe, ly_do: lyDo, mau: doc.mau,
    dong: doc.dong.map(x => Object.fromEntries(['hang', 'ma', 'ten', ...KHOA_SO].map(k => [k, x[k]]))),
  })

  const chonFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setMsg(null); setXem(null); setFile(null); setBan(true)
    try {
      const mod = await import('exceljs')
      const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await f.arrayBuffer())
      const doc = docFileMayChamCong(wb)
      if (doc.loi) { setMsg({ loai: 'loi', text: doc.loi }); return }
      if (!doc.dong.length) { setMsg({ loai: 'loi', text: 'Không đọc được dòng nhân viên nào trong file.' }); return }
      const j = await gui(doc, f.name, false)
      if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
      setFile({ ten: f.name, doc }); setXem(j)
    } catch (err) {
      setMsg({ loai: 'loi', text: 'Không đọc được file: ' + (err.message || err) + '. Mở file bằng Excel, lưu lại dạng .xlsx rồi thử lại.' })
    } finally { setBan(false) }
  }

  const ds = xem?.dong || []
  const dem = {}
  for (const r of ds) dem[r.tt] = (dem[r.tt] || 0) + 1
  const soGhi = (dem.moi || 0) + (dem.cap_nhat || 0) + (ghiDe ? dem.da_xac_nhan || 0 : 0)
  const soLuuMa = luuMa ? ds.filter(r => r.cach === 'ten' && !r.maApp && r.staff_id).length : 0

  const ghi = async () => {
    if (!soGhi) return
    if (ghiDe && lyDo.trim().length < 5) { setMsg({ loai: 'loi', text: 'Ghi lý do ghi đè bảng công đã xác nhận.' }); return }
    if (!confirm('Ghi số công tháng ' + ky.thang + '/' + ky.nam + ' cho ' + soGhi + ' nhân viên? Mỗi người sẽ thấy số ở tab "Chấm công của tôi" để Xác nhận hoặc Báo sai.')) return
    setBan(true); setMsg(null)
    const j = await gui(file.doc, file.ten, true)
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    alert('Đã ghi ' + j.soGhi + ' bảng công' + (j.soLuuMa ? ', lưu mã cho ' + j.soLuuMa + ' nhân viên' : '') + '.' +
      (j.loiGhi?.length ? '\n\nCó lỗi:\n' + j.loiGhi.join('\n') : ''))
    onXong()
  }

  const hien = ds.filter(r => !loc || r.tt === loc)
  return (
    // Hộp VỪA KHÍT màn hình (anh báo 23/10: bảng dài đẩy nút Ghi xuống khuất): tiêu đề + chọn file ở trên,
    // bảng chiếm phần giữa với MỘT thanh cuộn (tiêu đề cột dính), tuỳ chọn + nút Ghi luôn ở đáy.
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onDong}>
      <div className="w-full max-w-6xl max-h-[calc(100vh-2rem)] flex flex-col bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-t-2xl">
          <div>
            <div className="text-lg font-bold">📥 Nhập file máy chấm công — tháng {ky.thang}/{ky.nam}</div>
            <div className="text-xs opacity-85" title="Đọc sheet &quot;Bảng chấm công chi tiết_XuLy&quot; (HCNS đã xử lý), không lấy sheet ẩn. Quy đổi: Đi làm = Tổng công hưởng lương − Nghỉ phép · Nghỉ phép = cột Nghỉ phép (đã gồm phép đột xuất BGĐ duyệt) · Không lương = không lương + thai sản · Vi phạm = Tổng vi phạm (đi muộn, về sớm + không chấm công) · nghỉ lễ bỏ qua; tiền gây quỹ không đưa vào app. File thô (không có cột Tổng): Đi làm = HC + công tác + số thứ Bảy. Ghép theo mã, chưa có mã thì theo họ tên.">File "Bảng chấm công chi tiết" xuất từ phần mềm chấm công, xuất SAU ngày cuối tháng · <span className="underline decoration-dotted cursor-help">cách quy đổi ⓘ</span></div>
          </div>
          <button onClick={onDong} className="text-2xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        <div className="shrink-0 px-6 pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className={'text-sm px-4 py-2 rounded-xl font-semibold shadow-sm cursor-pointer ' + (ban ? 'bg-gray-200 text-gray-500' : 'bg-cyan-700 text-white hover:bg-cyan-800')}>
              {ban ? 'Đang đọc…' : file ? '↺ Chọn file khác' : 'Chọn file .xlsx'}
              <input type="file" accept=".xlsx" className="hidden" onChange={chonFile} disabled={ban} />
            </label>
            {file && <span className="text-sm text-gray-600">{file.ten}{file.doc.sheet ? <> · sheet <b>{file.doc.sheet}</b>{file.doc.mau === 'tho' ? ' (file thô — cộng thêm ' + (xem?.thuBay ?? '') + ' thứ Bảy)' : ''}</> : null} · kỳ trong file {file.doc.tuNgay?.split('-').reverse().join('/')} → {file.doc.denNgay?.split('-').reverse().join('/')}</span>}
          </div>

          {msg && <div className={'rounded-xl border px-4 py-2.5 text-sm ' + (msg.loai === 'loi' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{msg.text}</div>}

          {xem && <>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setLoc('')} className={'text-xs rounded-full border px-3 py-1 ' + (!loc ? 'bg-gray-900 text-white border-gray-900' : 'bg-white')}>Tất cả {ds.length}</button>
              {Object.entries(NHAN).filter(([k]) => dem[k]).map(([k, [nhan, lop]]) => (
                <button key={k} onClick={() => setLoc(loc === k ? '' : k)} className={'text-xs rounded-full border px-3 py-1 font-medium ' + lop + (loc === k ? ' ring-2 ring-offset-1 ring-gray-700' : '')}>{nhan}: {dem[k]}</button>
              ))}
            </div>
          </>}
        </div>

        {xem && <>
            <div className="flex-1 min-h-0 mx-6 my-3 rounded-xl border border-gray-200 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10"><tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5">Mã · tên trong file</th><th className="px-3 py-2.5">Nhân viên trên app</th>
                  <th className="px-3 py-2.5 text-right text-emerald-700">Đi làm</th><th className="px-3 py-2.5 text-right text-amber-700">Phép</th>
                  <th className="px-3 py-2.5 text-right text-rose-700">Không lương</th><th className="px-3 py-2.5 text-right text-violet-700">Vi phạm</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                </tr></thead>
                <tbody>
                  {hien.map((r, i) => {
                    const [nhan, lop] = NHAN[r.tt] || ['?', '']
                    const doi = (k) => r.cu && Number(r.cu[k]) !== Number(r.moi?.[k])
                    const o = (k, mau) => (
                      <td className={'px-3 py-2 text-right whitespace-nowrap ' + mau}>
                        {r.moi ? <>{doi(k) && <span className="text-gray-400 line-through mr-1">{fmt(r.cu[k])}</span>}<b>{fmt(r.moi[k])}</b></> : '—'}
                      </td>
                    )
                    return (
                      <tr key={i} className={'border-t border-gray-100 ' + (i % 2 ? 'bg-gray-50/50' : '')}>
                        <td className="px-3 py-2"><span className="font-mono text-xs text-gray-500">{r.ma}</span> {r.ten}</td>
                        <td className="px-3 py-2">{r.tenApp ? <>{r.tenApp}
                          {r.cach === 'ten' && <span className="ml-1 text-[11px] rounded bg-amber-50 text-amber-700 px-1" title="Ghép theo họ tên — chưa có mã trên app">theo tên{r.maApp ? ' · mã app ' + r.maApp : ''}</span>}</> : <span className="text-gray-400">—</span>}</td>
                        {o('ngay_di_lam', 'text-emerald-800')}{o('nghi_phep', 'text-amber-800')}{o('nghi_khong_luong', 'text-rose-800')}{o('so_lan_vi_pham', 'text-violet-800')}
                        <td className="px-3 py-2">
                          <span className={'text-xs rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ' + lop}>{nhan}</span>
                          {r.loi && <div className="text-xs text-red-700 mt-0.5 max-w-[320px]">{r.loi}</div>}
                          {r.canhBao && <div className="text-xs text-amber-700 mt-0.5 max-w-[320px]">{r.canhBao}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          <div className="shrink-0 px-6 pb-4 space-y-3">
            {xem.khongCoTrongFile?.length > 0 && (
              <div className="text-xs rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 max-h-20 overflow-y-auto">
                <b>{xem.khongCoTrongFile.length} nhân viên chấm công bằng máy nhưng KHÔNG có trong file</b> (giữ nguyên bảng công hiện có): {xem.khongCoTrongFile.join(', ')}.
                Ai là nhân viên online / ban giám đốc thì bỏ tick "Chấm công bằng máy" ở trang Quản lý nhân viên.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {ds.some(r => r.cach === 'ten' && !r.maApp && r.staff_id) && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={luuMa} onChange={e => setLuuMa(e.target.checked)} />
                  Lưu mã trong file cho {ds.filter(r => r.cach === 'ten' && !r.maApp && r.staff_id).length} người ghép theo tên (lần sau ghép theo mã)</label>
              )}
              {dem.da_xac_nhan > 0 && <>
                <label className="flex items-center gap-2 text-rose-700"><input type="checkbox" checked={ghiDe} onChange={e => setGhiDe(e.target.checked)} />
                  Ghi đè {dem.da_xac_nhan} bảng công đã xác nhận (quay về chờ nhân viên xác nhận)</label>
                {ghiDe && <input value={lyDo} onChange={e => setLyDo(e.target.value)} placeholder="Lý do ghi đè (bắt buộc)" className="border border-rose-300 rounded-lg px-2 py-1 text-sm w-72" />}
              </>}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Sẽ ghi <b className="text-gray-900">{soGhi}</b> bảng công{soLuuMa ? ' · lưu ' + soLuuMa + ' mã nhân viên' : ''}. Dòng lỗi / không có trên app không ghi.</span>
              <div className="flex gap-2">
                <button onClick={onDong} className="text-sm px-4 py-2 rounded-xl border border-gray-300 bg-white">Đóng</button>
                <button onClick={ghi} disabled={ban || !soGhi} className="text-sm px-5 py-2 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm disabled:opacity-40">✓ Ghi {soGhi} bảng công</button>
              </div>
            </div>
          </div>
        </>}
        {!xem && <div className="h-4" />}
      </div>
    </div>
  )
}
