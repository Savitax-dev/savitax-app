'use client'
// Phân hệ Tiền lương — BƯỚC 1 — nhân viên tự khai ngày công, bấm xác nhận là khoá.
import { useCallback, useEffect, useState } from 'react'
import { goi, MAU, TRANG_THAI, trangThaiCua, HopThongBao } from './chung'

// ── Chấm công của tôi ────────────────────────────────────────────────────────
export default function CuaToi({ thangDuocKhai }) {
  const [ky, setKy] = useState(thangDuocKhai[0])
  const [d, setD] = useState(null)
  const [f, setF] = useState({ ngay_di_lam: '', nghi_phep: '0', nghi_khong_luong: '0', ghi_chu: '' })
  const [msg, setMsg] = useState(null)
  const [ban, setBan] = useState(false)
  // Ngày đi làm TỰ TÍNH = chuẩn − phép − không lương, cho tới khi người dùng tự gõ vào ô đó (vd vào làm
  // giữa tháng). Nhờ vậy khai phép / nghỉ không lương không làm tổng vượt ngày công chuẩn.
  const [tuGoDiLam, setTuGoDiLam] = useState(false)

  const tai = useCallback(async () => {
    setD(null); setMsg(null); setTuGoDiLam(false)
    const j = await goi('/api/admin/luong?viec=cua_toi&nam=' + ky.nam + '&thang=' + ky.thang)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setD(j)
    const c = j.data
    setF(c ? { ngay_di_lam: String(c.ngay_di_lam), nghi_phep: String(c.nghi_phep), nghi_khong_luong: String(c.nghi_khong_luong), ghi_chu: c.ghi_chu || '' }
      : { ngay_di_lam: String(j.ngayCong.chuan), nghi_phep: '0', nghi_khong_luong: '0', ghi_chu: '' })
  }, [ky])
  useEffect(() => { tai() }, [tai])

  const so = k => { const v = Number(String(f[k]).replace(',', '.')); return isFinite(v) ? v : 0 }
  const lam = so('ngay_di_lam'), phep = so('nghi_phep'), kl = so('nghi_khong_luong')
  const tong = lam + phep + kl
  const chuan = d?.ngayCong.chuan || 0
  const khoa = d?.data?.trang_thai === 'da_xac_nhan'
  const tt = TRANG_THAI[d ? trangThaiCua(d.data) : 'chua']
  const phan = v => chuan ? Math.min(100, (v / chuan) * 100) + '%' : '0%'

  const doiO = (k, giaTri) => {
    setMsg(null)
    if (k === 'ngay_di_lam') { setTuGoDiLam(true); setF(v => ({ ...v, ngay_di_lam: giaTri })); return }
    setF(v => {
      const moi = { ...v, [k]: giaTri }
      if (tuGoDiLam || !chuan) return moi
      const n = x => { const t = Number(String(x).replace(',', '.')); return isFinite(t) ? t : 0 }
      return { ...moi, ngay_di_lam: String(Math.max(0, chuan - n(moi.nghi_phep) - n(moi.nghi_khong_luong))) }
    })
  }

  const luu = async (xacNhan) => {
    if (tong > chuan) { setMsg({ loai: 'loi', text: 'Tổng ba ô (' + tong + ') đang vượt ngày công chuẩn (' + chuan + '). Giảm ngày đi làm cho khớp.' }); return }
    if (xacNhan && !confirm('Xác nhận bảng công tháng ' + ky.thang + '/' + ky.nam + '? Sau khi xác nhận sẽ khoá, sai sót phải nhờ trưởng phòng cập nhật.')) return
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong', {
      viec: 'luu_cong', nam: ky.nam, thang: ky.thang, xacNhan,
      ngay_di_lam: lam, nghi_phep: phep, nghi_khong_luong: kl, ghi_chu: f.ghi_chu,
    })
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    await tai()
    setMsg({ loai: 'ok', text: xacNhan ? 'Đã xác nhận và khoá bảng công.' : 'Đã lưu nháp.' + (j.canhBao ? ' ' + j.canhBao : '') })
  }

  const O = ({ k, nhan, mau, goiY }) => (
    <label className={'rounded-2xl border p-4 block ' + MAU[mau].the}>
      <span className={'text-sm font-medium ' + MAU[mau].chu}>{nhan}</span>
      <input type="number" min="0" max="31" step="0.5" value={f[k]} disabled={khoa || !d?.duocKhai}
        onChange={e => doiO(k, e.target.value)}
        className={'block w-full mt-2 rounded-xl border border-white/80 bg-white px-3 py-2 text-3xl font-bold shadow-sm disabled:bg-white/60 ' + MAU[mau].dam} />
      <span className="text-xs text-gray-500 mt-1 block">{goiY}</span>
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {thangDuocKhai.map(t => {
            const chon = ky.nam === t.nam && ky.thang === t.thang
            return (
              <button key={t.nam + '-' + t.thang} onClick={() => setKy(t)}
                className={'text-sm px-4 py-2 rounded-xl border font-medium ' + (chon ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-[#8B1A1A]')}>
                Tháng {t.thang}/{t.nam}
              </button>
            )
          })}
        </div>
        {d && <span className={'text-sm rounded-full border px-3 py-1 font-medium ' + tt.lop}>
          <span className={'inline-block w-2 h-2 rounded-full mr-1.5 align-middle ' + tt.cham} />
          {tt.nhan}{khoa && d.data.xac_nhan_luc ? ' · ' + new Date(d.data.xac_nhan_luc).toLocaleDateString('vi-VN') : ''}
        </span>}
      </div>

      {!d && !msg && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Đang tải…</div>}
      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={'rounded-2xl border p-4 ' + MAU.chuan.the}>
              <span className={'text-sm font-medium ' + MAU.chuan.chu}>Ngày công chuẩn</span>
              <div className={'text-4xl font-bold mt-2 ' + MAU.chuan.dam}>{chuan}</div>
              <span className="text-xs text-gray-500 mt-1 block">{d.ngayCong.soNgay} ngày − {d.ngayCong.chuNhat} chủ nhật{d.ngayCong.le ? ' − ' + d.ngayCong.le + ' ngày lễ' : ''}</span>
            </div>
            {O({ k: 'ngay_di_lam', nhan: 'Ngày đi làm', mau: 'lam', goiY: tuGoDiLam ? 'Đang gõ tay — tính cả thứ Bảy làm online' : 'Tự tính = chuẩn − phép − không lương' })}
            {O({ k: 'nghi_phep', nhan: 'Nghỉ phép (có lương)', mau: 'phep', goiY: 'Vẫn được tính lương' })}
            {O({ k: 'nghi_khong_luong', nhan: 'Nghỉ không lương', mau: 'kl', goiY: 'Không tính lương' })}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-gray-600">Tổng khai <b className={tong > chuan ? 'text-rose-600' : 'text-gray-900'}>{tong.toLocaleString('vi-VN')}</b> / {chuan} ngày</span>
              <span className="text-sm text-gray-600">Ngày tính lương <b className="text-emerald-700 text-lg">{(lam + phep).toLocaleString('vi-VN')}</b></span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
              <div className={MAU.lam.thanh} style={{ width: phan(lam) }} />
              <div className={MAU.phep.thanh} style={{ width: phan(phep) }} />
              <div className={MAU.kl.thanh} style={{ width: phan(kl) }} />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1 align-middle" />Đi làm {lam}</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1 align-middle" />Nghỉ phép {phep}</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400 mr-1 align-middle" />Không lương {kl}</span>
              {chuan - tong > 0 && <span className="text-amber-700 font-medium">Còn thiếu {chuan - tong} ngày — ghi chú lý do trước khi xác nhận</span>}
              {tong > chuan && <span className="text-rose-600 font-medium">Vượt ngày công chuẩn {tong - chuan} ngày — giảm ngày đi làm cho khớp</span>}
            </div>
            {d.ngayLe.length > 0 && <div className="flex flex-wrap gap-2">{d.ngayLe.map(x => (
              <span key={x.ngay} className="text-xs rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5">🎉 {x.ngay.slice(8, 10)}/{x.ngay.slice(5, 7)} · {x.ten}</span>
            ))}</div>}
            <input value={f.ghi_chu} onChange={e => setF(v => ({ ...v, ghi_chu: e.target.value }))} disabled={khoa || !d.duocKhai} maxLength={300}
              placeholder="Ghi chú (vd: vào làm từ ngày 15, nghỉ ốm ngày 08)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50" />
            {!khoa && d.duocKhai && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => luu(false)} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">💾 Lưu nháp</button>
                <button onClick={() => luu(true)} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm hover:bg-[#741515] disabled:opacity-50">✓ Xác nhận ngày công</button>
              </div>
            )}
            {khoa && <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">🔒 Bảng công đã khoá. Sai sót về ngày làm việc hoặc ngày nghỉ, liên hệ trưởng phòng để kiểm tra và cập nhật.</p>}
          </div>
        </>
      )}
      <HopThongBao msg={msg} />
    </div>
  )
}
