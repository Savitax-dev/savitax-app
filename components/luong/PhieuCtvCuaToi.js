'use client'
// "Phiếu lương của tôi" cho người phòng remote / CTV (sql/51, anh chốt 06/11/2026). Mỗi người CHỈ thấy phiếu mình
// (máy chủ lọc theo người đăng nhập). Xác nhận / Báo sai kèm ghi chú — như phiếu nhân viên Savitax.
import { useCallback, useEffect, useState } from 'react'
import { goi, HopThongBao } from './chung'

const fmt = n => Number(n || 0).toLocaleString('vi-VN')
const pctTxt = v => Math.round((Number(v) || 0) * 100) + '%'

function Dong({ nhan, phu, giaTri, mau = 'text-gray-900', dam }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100">
      <div><div className={dam ? 'font-semibold text-gray-900' : 'text-gray-700'}>{nhan}</div>{phu && <div className="text-xs text-gray-400">{phu}</div>}</div>
      <div className={'font-semibold whitespace-nowrap ' + mau}>{giaTri}</div>
    </div>
  )
}

export default function PhieuCtvCuaToi() {
  const [ds, setDs] = useState(null)
  const [msg, setMsg] = useState(null)
  const tai = useCallback(async () => {
    const j = await goi('/api/admin/luong/ctv?viec=cua_toi')
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); setDs([]) } else setDs(j.data || [])
  }, [])
  useEffect(() => { tai() }, [tai])

  const tl = async (p, viec) => {
    let ghiChu = ''
    if (viec === 'bao_sai') { ghiChu = prompt('Ghi rõ chỗ sai trên phiếu lương T' + p.thang + '/' + p.nam + ':') || ''; if (!ghiChu.trim()) return }
    const j = await goi('/api/admin/luong/ctv', { viec, nam: p.nam, thang: p.thang, ghi_chu: ghiChu })
    setMsg(j.error ? { loai: 'loi', text: j.error } : { loai: 'ok', text: viec === 'xac_nhan' ? 'Đã xác nhận phiếu lương.' : 'Đã gửi báo sai — kế toán nội bộ sẽ kiểm lại.' })
    tai()
  }

  if (ds === null) return <p className="text-sm text-gray-400">Đang tải phiếu lương…</p>
  return (
    <div className="space-y-3 max-w-2xl">
      <HopThongBao msg={msg} />
      {!ds.length && <p className="text-sm text-gray-500">Chưa có phiếu lương nào được gửi.</p>}
      {ds.map(p => {
        const x = p.dong
        return (
          <div key={p.nam + '-' + p.thang} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-[#8B1A1A] to-rose-600 text-white flex items-center justify-between">
              <div><div className="text-xs opacity-80">Phiếu lương CTV</div><div className="text-lg font-bold">Tháng {p.thang}/{p.nam}</div></div>
              <div className="text-right"><div className="text-xs opacity-80">{x.ten} · {x.phong}</div><div className="text-xl font-bold">{fmt(x.thucNhan)}đ</div></div>
            </div>
            <div className="px-4 py-2 text-sm">
              <Dong nhan="Doanh thu phí kế toán (chưa VAT)" phu={x.soCty + ' công ty · ' + (x.tyLeMoTa || '')} giaTri={fmt(x.doanhThu)} />
              <Dong nhan="Hoa hồng" giaTri={fmt(x.hoaHong)} mau="text-violet-700" dam />
              <Dong nhan="SVT giữ lại 20% hoa hồng" phu={'Còn giữ sau tháng này: ' + fmt(x.giuSau) + 'đ'} giaTri={'−' + fmt(x.giuLai)} mau="text-amber-700" />
              {x.traGiuLai > 0 && <Dong nhan="Trả tiền giữ lại" phu={x.ghiChuTra || null} giaTri={'+' + fmt(x.traGiuLai)} mau="text-teal-700" />}
              <Dong nhan="Tổng thu nhập" giaTri={fmt(x.thuNhap)} dam />
              <Dong nhan="Thuế TNCN 10%" giaTri={'−' + fmt(x.thue)} mau="text-rose-600" />
              <Dong nhan="Thực nhận" giaTri={fmt(x.thucNhan) + 'đ'} dam />
              <details className="mt-2">
                <summary className="text-xs text-sky-700 cursor-pointer">Xem từng công ty</summary>
                <table className="w-full text-xs mt-1">
                  <tbody>{(x.congTy || []).map(c => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="py-1">{c.ma ? <b>{c.ma}</b> : null} {c.ten}{c.hkd ? ' (HKD)' : ''}</td>
                      <td className="text-right">{fmt(c.doanhThu)}</td><td className="text-right w-12">{pctTxt(c.tyLe)}</td><td className="text-right font-semibold">{fmt(c.hoaHong)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </details>
            </div>
            <div className="px-4 py-3 bg-gray-50 flex items-center gap-2 text-sm">
              {p.trangThai === 'da_xac_nhan' && <span className="text-emerald-700 font-semibold">✓ Đã xác nhận</span>}
              {p.trangThai === 'bao_sai' && <span className="text-rose-700">⚠ Đã báo sai: {p.ghiChu}</span>}
              <span className="flex-1" />
              {p.trangThai !== 'da_xac_nhan' && <button onClick={() => tl(p, 'xac_nhan')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Xác nhận</button>}
              <button onClick={() => tl(p, 'bao_sai')} className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs">Báo sai</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
