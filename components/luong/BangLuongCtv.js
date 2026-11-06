'use client'
// Tab "Lương CTV" — phòng remote (Danxia, Dakshin, CTV Savitax), anh chốt 06/11/2026. TÁCH RIÊNG bảng lương nhân viên
// Savitax. Không chấm công: hoa hồng theo doanh thu phí kế toán phải thu (chưa VAT) → giữ lại 20% → thuế 10% → thực nhận.
// Luật tính: lib/luong/luongCtv.js · API: app/api/admin/luong/ctv · SQL: sql/51.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { goi, HopThongBao, searchKey } from './chung'
import { dongChuyenKhoan, xuatFileChuyenKhoan, khongDau } from '@/lib/luong/fileChuyenKhoan'
import { soExcelMoi, themSheetMang, taiVeExcel } from '@/lib/excelDep'

const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('vi-VN')
const pctTxt = v => Math.round((Number(v) || 0) * 100) + '%'
const TT_PHIEU = {
  cho_xac_nhan: ['Chờ xác nhận', 'bg-amber-100 text-amber-800'],
  da_xac_nhan: ['Đã xác nhận', 'bg-emerald-100 text-emerald-800'],
  bao_sai: ['Báo sai', 'bg-rose-100 text-rose-800'],
}
// Màu nền mỗi phòng — dễ phân biệt khi cuộn
const MAU_PHONG = ['bg-sky-50 text-sky-900', 'bg-violet-50 text-violet-900', 'bg-amber-50 text-amber-900', 'bg-emerald-50 text-emerald-900']

export default function BangLuongCtv({ quyen }) {
  const [ky, setKy] = useState(quyen.thangDuocKhai[0])
  const [d, setD] = useState(null)
  const [loi, setLoi] = useState(null)
  const [msg, setMsg] = useState(null)
  const [ban, setBan] = useState(false)
  const [phong, setPhong] = useState('')
  const [tim, setTim] = useState('')
  const [mo, setMo] = useState(null)   // staff_id đang mở danh sách công ty

  const tai = useCallback(async () => {
    setD(null); setLoi(null)
    const j = await goi('/api/admin/luong/ctv?viec=bang&nam=' + ky.nam + '&thang=' + ky.thang)
    if (j.error) setLoi(j.error); else setD(j)
  }, [ky])
  useEffect(() => { tai() }, [tai])

  const lam = async (body, xacNhan) => {
    if (xacNhan && !confirm(xacNhan)) return
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong/ctv', { nam: ky.nam, thang: ky.thang, ...body })
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    await tai()
  }
  const moChot = () => {
    const lyDo = prompt('Lý do mở chốt bảng lương CTV tháng ' + ky.thang + '/' + ky.nam + ' (phiếu đã gửi sẽ bị thu hồi):')
    if (lyDo === null) return
    lam({ viec: 'mo_chot', ly_do: lyDo })
  }
  const traGiuLai = x => {
    const v = prompt('Trả tiền giữ lại cho ' + x.ten + ' ở lương T' + ky.thang + '/' + ky.nam + '.\nĐang giữ (tới hết tháng trước): ' + fmt(x.giuTruoc) + 'đ.\n\nSố tiền trả (nhập 0 để bỏ):', String(x.traGiuLai || x.giuTruoc || 0))
    if (v === null) return
    const soTien = Number(String(v).replace(/\D/g, '')) || 0
    const ghiChu = soTien > 0 ? (prompt('Ghi chú (không bắt buộc):', x.ghiChuTra || '') ?? '') : ''
    lam({ viec: 'tra_giu_lai', staffId: x.staff_id, so_tien: soTien, ghi_chu: ghiChu })
  }

  const dsPhong = useMemo(() => (d?.phong || []).map(p => p.ten), [d])
  const k = searchKey(tim)
  const ds = (d?.dong || []).filter(x => (!phong || x.phong === phong) && (!k || searchKey(x.ten).includes(k)))
  const tong = f => ds.reduce((a, x) => a + (Number(x[f]) || 0), 0)
  const phieuCua = new Map((d?.phieu || []).map(p => [p.staff_id, p]))
  const daChot = d?.daChot
  const sua = quyen.manage && !daChot

  const xuatExcel = async () => {
    const wb = await soExcelMoi()
    const H = [['BẢNG LƯƠNG CTV — THÁNG ' + ky.thang + '/' + ky.nam],
      ['Hoa hồng theo doanh thu phí kế toán phải thu theo kỳ (chưa VAT) · SVT giữ lại 20% hoa hồng · Thuế TNCN 10% thu nhập · ' + (daChot ? 'ĐÃ CHỐT ' + new Date(daChot.luc).toLocaleString('vi-VN') : 'CHƯA CHỐT — số còn đổi')],
      [],
      ['Phòng', 'Nhân viên', 'Tỷ lệ', 'Số cty', 'Doanh thu (chưa VAT)', 'Hoa hồng', 'SVT giữ lại 20%', 'Trả giữ lại', 'Thu nhập', 'Thuế TNCN 10%', 'Thực nhận', 'Còn giữ sau tháng']]
    for (const x of ds) H.push([x.phong, x.ten, x.tyLeMoTa || 'chưa có tỷ lệ', x.soCty, x.doanhThu, x.hoaHong, x.giuLai, x.traGiuLai, x.thuNhap, x.thue, x.thucNhan, x.giuSau])
    H.push(['TỔNG', ds.length + ' người', '', ds.reduce((a, x) => a + x.soCty, 0), tong('doanhThu'), tong('hoaHong'), tong('giuLai'), tong('traGiuLai'), tong('thuNhap'), tong('thue'), tong('thucNhan'), tong('giuSau')])
    themSheetMang(wb, 'Luong CTV', H, { doRong: [14, 28, 30, 8, 18, 15, 15, 13, 15, 14, 15, 16] })
    const C = [['CHI TIẾT CÔNG TY — LƯƠNG CTV T' + ky.thang + '/' + ky.nam], [],
      ['Phòng', 'Nhân viên', 'Mã KH', 'Công ty', 'Loại', 'Phí kỳ (gồm VAT)', 'Doanh thu tháng (chưa VAT)', 'Tỷ lệ', 'Hoa hồng']]
    for (const x of ds) for (const c of x.congTy || []) C.push([x.phong, x.ten, c.ma || '', c.ten, (c.hkd ? 'Hộ kinh doanh' : 'Doanh nghiệp') + (c.quy ? ' · quý ÷3' : '') + (c.khongVat ? ' · không VAT' : ''), c.phiKy, c.doanhThu, pctTxt(c.tyLe), c.hoaHong])
    C.push(['TỔNG', '', '', '', '', null, tong('doanhThu'), '', tong('hoaHong')])
    themSheetMang(wb, 'Chi tiet cong ty', C, { doRong: [14, 26, 16, 44, 26, 16, 18, 8, 15] })
    await taiVeExcel(wb, 'LuongCTV_T' + ky.thang + '-' + ky.nam + '.xlsx')
  }
  const chuyenKhoan = async () => {
    setMsg(null)
    if (!daChot) { setMsg({ loai: 'loi', text: 'Chốt bảng lương CTV trước — file chuyển khoản lấy số của bản đã chốt.' }); return }
    const noiDung = prompt('Nội dung giao dịch (không dấu):', 'SVT thanh toan hoa hong thang ' + ky.thang + '.' + ky.nam)
    if (noiDung === null || !khongDau(noiDung)) return
    const j = await goi('/api/admin/luong?viec=luong_nv')
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    const kq = dongChuyenKhoan((d.dong || []).map(x => ({ staff_id: x.staff_id, ten: x.ten, thucLinh: x.thucNhan, luongCoBan: 0, phieu: phieuCua.get(x.staff_id) })),
      new Map((j.nganHang || []).map(x => [x.staff_id, x])), noiDung)
    if (!kq.ra.length && !kq.thieu.length) { setMsg({ loai: 'loi', text: 'Không có ai có thực nhận > 0.' }); return }
    if (!confirm('Xuất file chuyển khoản lương CTV T' + ky.thang + '/' + ky.nam + ':\n' + kq.ra.length + ' người · tổng ' + fmt(kq.tong) + 'đ'
      + (kq.thieu.length ? '\n' + kq.thieu.length + ' người chuyển tay — sheet riêng "Chuyen tay" (' + fmt(kq.tongThieu) + 'đ).' : '') + '\n\nXuất file?')) return
    await xuatFileChuyenKhoan(kq.ra, ky.nam, ky.thang, kq.thieu, 'ChuyenKhoanCTV')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={ky.nam + '-' + ky.thang} onChange={e => { const [n, t] = e.target.value.split('-').map(Number); setKy({ nam: n, thang: t }) }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
          {quyen.thangDuocKhai.map(t => <option key={t.nam + '-' + t.thang} value={t.nam + '-' + t.thang}>Lương CTV tháng {t.thang}/{t.nam}</option>)}
        </select>
        <select value={phong} onChange={e => setPhong(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
          <option value="">Tất cả phòng</option>
          {dsPhong.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={tim} onChange={e => setTim(e.target.value)} placeholder="🔍 Tìm người…" className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-56" />
        <span className="text-xs text-gray-500">Doanh thu = phí kế toán phải thu T{ky.thang} (chưa VAT) · không chấm công</span>
      </div>

      {loi && <HopThongBao msg={{ loai: 'loi', text: loi }} />}
      {!d && !loi && <p className="text-sm text-gray-400">Đang tính lương CTV…</p>}
      {d && (
        <>
          <div className={'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ' + (daChot ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
            {daChot
              ? <span className="text-emerald-800">🔒 <b>Đã chốt</b> lúc {new Date(daChot.luc).toLocaleString('vi-VN')}{daChot.boi ? ' bởi ' + daChot.boi : ''}
                  {daChot.daGui && <> · 📨 đã gửi phiếu: {(d.phieu || []).filter(p => p.trang_thai === 'da_xac_nhan').length} xác nhận · {(d.phieu || []).filter(p => p.trang_thai === 'cho_xac_nhan').length} chờ · <span className="text-rose-700">{(d.phieu || []).filter(p => p.trang_thai === 'bao_sai').length} báo sai</span></>}
                  {daChot.daChuyenLuong && <> · 💸 đã chuyển lương</>}</span>
              : <span className="text-amber-800">⏳ <b>Chưa chốt</b> — số còn đổi theo dữ liệu.{d.moChot ? ' (Đã mở chốt: ' + (d.moChot.lyDo || '') + ')' : ''}</span>}
            <span className="flex-1" />
            <button onClick={xuatExcel} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold">⬇ Xuất Excel</button>
            {quyen.manage && <button onClick={chuyenKhoan} className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-semibold">🏦 File chuyển khoản</button>}
            {quyen.manage && !daChot && <button disabled={ban} onClick={() => lam({ viec: 'chot' }, 'Chốt bảng lương CTV tháng ' + ky.thang + '/' + ky.nam + '? Số liệu được chụp lại, tiền giữ lại được ghi vào sổ.')} className="px-3 py-1.5 rounded-lg bg-[#8B1A1A] text-white text-xs font-semibold disabled:opacity-50">🔒 Chốt bảng lương CTV</button>}
            {quyen.manage && daChot && <button disabled={ban} onClick={() => lam({ viec: 'gui_phieu' }, (daChot.daGui ? 'Gửi lại' : 'Gửi') + ' phiếu lương CTV cho ' + (d.dong || []).length + ' người?')} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50">📨 {daChot.daGui ? 'Gửi lại phiếu' : 'Gửi phiếu xác nhận'}</button>}
            {quyen.manage && daChot && <button disabled={ban} onClick={() => lam({ viec: 'chuyen_luong', da: !daChot.daChuyenLuong }, daChot.daChuyenLuong ? 'Bỏ đánh dấu đã chuyển lương CTV?' : 'Xác nhận ĐÃ CHUYỂN lương CTV tháng ' + ky.thang + '/' + ky.nam + '?')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">💸 {daChot.daChuyenLuong ? 'Bỏ đánh dấu đã chuyển' : 'Đánh dấu đã chuyển lương'}</button>}
            {quyen.manage && daChot && <button disabled={ban} onClick={moChot} className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs disabled:opacity-50">Mở chốt</button>}
          </div>
          <HopThongBao msg={msg} />

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            {[['Doanh thu (chưa VAT)', tong('doanhThu'), 'bg-sky-50 border-sky-200 text-sky-900'], ['Hoa hồng', tong('hoaHong'), 'bg-violet-50 border-violet-200 text-violet-900'],
              ['SVT giữ lại 20%', tong('giuLai'), 'bg-amber-50 border-amber-200 text-amber-900'], ['Trả giữ lại', tong('traGiuLai'), 'bg-teal-50 border-teal-200 text-teal-900'],
              ['Thu nhập', tong('thuNhap'), 'bg-white border-gray-200 text-gray-900'], ['Thuế TNCN 10%', tong('thue'), 'bg-rose-50 border-rose-200 text-rose-900'],
              ['Thực nhận', tong('thucNhan'), 'bg-gray-900 border-gray-900 text-white']].map(([n, v, c]) => (
              <div key={n} className={'rounded-xl border px-3 py-2 ' + c}><div className="text-xs opacity-80">{n}</div><div className="text-lg font-bold">{fmt(v)}</div></div>
            ))}
          </div>

          {(d.daLoai || []).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Đã loại khỏi bảng:</span>
              {d.daLoai.map(x => (
                <span key={x.staff_id} className="px-2 py-0.5 rounded-full bg-white border border-gray-200">
                  {x.ten} · {x.phong} · DT {fmt(x.doanhThu)}
                  {sua && <button onClick={() => lam({ viec: 'loai', staffId: x.staff_id, loai: false })} className="ml-1 text-sky-700 underline">Đưa lại</button>}
                </span>
              ))}
            </div>
          )}
          <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-[#8B1A1A] uppercase">
                <tr>
                  {['Nhân viên', 'Doanh thu', 'Hoa hồng', 'Giữ lại 20%', 'Trả giữ lại', 'Thu nhập', 'Thuế 10%', 'Thực nhận', 'Còn giữ', 'Phiếu'].map((h, i) => (
                    <th key={h} className={'px-3 py-2 border-b border-r border-gray-200 font-semibold ' + (i ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.phong || []).filter(p => !phong || p.ten === phong).map((p, ip) => {
                  const nguoi = ds.filter(x => x.room_id === p.room_id)
                  if (!nguoi.length) return null
                  return (
                    <Fragment key={p.room_id}>
                      <tr className={MAU_PHONG[ip % MAU_PHONG.length]}>
                        <td colSpan={10} className="px-3 py-1.5 font-semibold border-b border-gray-200">🏢 {p.ten} · {nguoi.length} người · <span className="font-normal">{p.tyLe}</span></td>
                      </tr>
                      {nguoi.map((x, i) => {
                        const ph = phieuCua.get(x.staff_id)
                        return (
                          <Fragment key={x.staff_id}>
                            <tr className={(i % 2 ? 'bg-gray-50/60' : 'bg-white') + ' hover:bg-rose-50/40'}>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100">
                                <div className="font-medium text-gray-900">{x.ten}{!x.dangLam && <span className="ml-1 text-xs text-gray-400">(đã nghỉ)</span>}</div>
                                {x.chuaCoTyLe && <div className="text-xs text-rose-600">Phòng chưa có tỷ lệ hoa hồng</div>}
                                {sua && <button onClick={() => lam({ viec: 'loai', staffId: x.staff_id, loai: true }, 'Loại ' + x.ten + ' khỏi bảng lương CTV? (Đưa lại được ở dòng "Đã loại" cuối bảng)')} className="text-xs text-gray-400 hover:text-rose-600">✕ Loại khỏi bảng</button>}
                              </td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right">
                                <button onClick={() => setMo(mo === x.staff_id ? null : x.staff_id)} className="text-sky-800 hover:underline">{fmt(x.doanhThu)}</button>
                                <div className="text-xs text-gray-400">{x.soCty} cty {mo === x.staff_id ? '▲' : '▼'}</div>
                              </td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right text-violet-800 font-semibold">{fmt(x.hoaHong)}</td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right text-amber-700">−{fmt(x.giuLai)}</td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right">
                                <span className={x.traGiuLai ? 'text-teal-700 font-semibold' : 'text-gray-300'}>{x.traGiuLai ? '+' + fmt(x.traGiuLai) : '—'}</span>
                                {sua && x.giuTruoc > 0 && <div><button onClick={() => traGiuLai(x)} className="text-xs text-teal-700 underline">Trả</button></div>}
                                {x.ghiChuTra && <div className="text-xs text-gray-400 max-w-[140px] truncate" title={x.ghiChuTra}>{x.ghiChuTra}</div>}
                              </td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right">{fmt(x.thuNhap)}</td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right text-rose-600">−{fmt(x.thue)}</td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right font-bold text-gray-900">{fmt(x.thucNhan)}</td>
                              <td className="px-3 py-1.5 border-b border-r border-gray-100 text-right text-amber-800" title={'Đang giữ trước tháng này: ' + fmt(x.giuTruoc) + 'đ'}>{fmt(x.giuSau)}</td>
                              <td className="px-3 py-1.5 border-b border-gray-100 text-right">
                                {ph ? <span className={'px-2 py-0.5 rounded-full text-xs ' + (TT_PHIEU[ph.trang_thai]?.[1] || '')} title={ph.ghi_chu || ''}>{TT_PHIEU[ph.trang_thai]?.[0] || ph.trang_thai}</span> : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                            {mo === x.staff_id && (
                              <tr><td colSpan={10} className="px-6 py-2 bg-sky-50/50 border-b border-gray-200">
                                {/* Dãn hết bề ngang bảng (anh yêu cầu 06/11/2026) */}
                                <table className="text-xs w-full">
                                  <thead><tr className="text-gray-500"><th className="text-left py-1 w-[40%]">Công ty</th><th className="text-left px-3">Loại</th><th className="text-right px-3">Phí kỳ (gồm VAT)</th><th className="text-right px-3">Doanh thu tháng</th><th className="text-right px-3">Tỷ lệ</th><th className="text-right px-3">Hoa hồng</th></tr></thead>
                                  <tbody>{(x.congTy || []).map(c => (
                                    <tr key={c.id} className="border-t border-sky-100">
                                      <td className="py-1">{c.ma ? <b>{c.ma}</b> : null} {c.ten}</td>
                                      <td className="px-3">{c.hkd ? 'Hộ kinh doanh' : 'Doanh nghiệp'}{c.quy ? ' · quý ÷3' : ''}{c.khongVat ? ' · không VAT' : ''}</td>
                                      <td className="text-right px-3">{fmt(c.phiKy)}</td><td className="text-right px-3">{fmt(c.doanhThu)}</td>
                                      <td className="text-right px-3">{pctTxt(c.tyLe)}</td><td className="text-right px-3 font-semibold">{fmt(c.hoaHong)}</td>
                                    </tr>))}
                                  </tbody>
                                </table>
                              </td></tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  )
                })}
                {!ds.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">Không có ai trong bảng lương CTV tháng này.</td></tr>}
              </tbody>
              {ds.length > 0 && (
                <tfoot className="sticky bottom-0 bg-gray-100 font-bold text-sm">
                  <tr>
                    <td className="px-3 py-2 border-t border-r border-gray-300">TỔNG {ds.length} người</td>
                    {['doanhThu', 'hoaHong', 'giuLai', 'traGiuLai', 'thuNhap', 'thue', 'thucNhan', 'giuSau'].map(f => <td key={f} className="px-3 py-2 border-t border-r border-gray-300 text-right">{fmt(tong(f))}</td>)}
                    <td className="border-t border-gray-300" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
