'use client'
// Phân hệ Tiền lương — BƯỚC 1 — nhân viên tự khai ngày công, bấm xác nhận là khoá.
import { useCallback, useEffect, useState } from 'react'
import { goi, MAU, TRANG_THAI, trangThaiCua, HopThongBao } from './chung'

// ── Chấm công của tôi ────────────────────────────────────────────────────────
export default function CuaToi({ thangDuocKhai }) {
  const [ky, setKy] = useState(thangDuocKhai[0])
  const [d, setD] = useState(null)
  const [f, setF] = useState({ ngay_di_lam: '', nghi_phep: '0', nghi_khong_luong: '0', so_lan_vi_pham: '0', ghi_chu: '' })
  const [msg, setMsg] = useState(null)
  const [ban, setBan] = useState(false)
  // Ngày đi làm TỰ TÍNH = chuẩn − phép − không lương, cho tới khi người dùng tự gõ vào ô đó (vd vào làm
  // giữa tháng). Nhờ vậy khai phép / nghỉ không lương không làm tổng vượt ngày công chuẩn.
  const [tuGoDiLam, setTuGoDiLam] = useState(false)
  const [baoSai, setBaoSai] = useState(null)   // ghi chú báo sai đang soạn (bảng công lấy từ máy chấm công)

  const tai = useCallback(async () => {
    setD(null); setMsg(null); setTuGoDiLam(false); setBaoSai(null)
    const j = await goi('/api/admin/luong?viec=cua_toi&nam=' + ky.nam + '&thang=' + ky.thang)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setD(j)
    const c = j.data
    setF(c ? { ngay_di_lam: String(c.ngay_di_lam), nghi_phep: String(c.nghi_phep), nghi_khong_luong: String(c.nghi_khong_luong), so_lan_vi_pham: String(c.so_lan_vi_pham ?? 0), ghi_chu: c.ghi_chu || '' }
      : { ngay_di_lam: String(j.ngayCong.chuan), nghi_phep: '0', nghi_khong_luong: '0', so_lan_vi_pham: '0', ghi_chu: '' })
  }, [ky])
  useEffect(() => { tai() }, [tai])

  const so = k => { const v = Number(String(f[k]).replace(',', '.')); return isFinite(v) ? v : 0 }
  const lam = so('ngay_di_lam'), phep = so('nghi_phep'), kl = so('nghi_khong_luong')
  // Tác phong (sql/34): mỗi lần vi phạm trừ 20%, nhân viên tự khai; % tác phong phòng = trung bình cả phòng.
  const viPham = Math.max(0, Math.round(so('so_lan_vi_pham')))
  const tacPhong = Math.max(0, 100 - 20 * viPham)
  const tong = Math.round((lam + phep + kl) * 100) / 100   // số máy có lẻ (15,38) — tránh 20,999999
  const chuan = d?.ngayCong.chuan || 0
  // Số lấy từ MÁY CHẤM CÔNG (sql/38): khoá ô, nhân viên chỉ Xác nhận đúng hoặc Báo sai.
  const tuMay = d?.data?.nguon === 'may_cham_cong'
  const may = d?.data?.may || null
  const daBaoSai = d?.data?.trang_thai === 'bao_sai'
  const khoa = d?.data?.trang_thai === 'da_xac_nhan' || tuMay || !!d?.khongTinhLuong || !!d?.khongChamCong
  const ttGoc = TRANG_THAI[d ? trangThaiCua(d.data) : 'chua']
  const tt = daBaoSai ? { ...ttGoc, nhan: 'Đã báo sai', lop: 'bg-rose-100 text-rose-800 border-rose-200', cham: 'bg-rose-500' }
    : tuMay && d?.data?.trang_thai === 'nhap' ? { ...ttGoc, nhan: 'Chờ bạn xác nhận', lop: 'bg-cyan-100 text-cyan-800 border-cyan-200', cham: 'bg-cyan-500' } : ttGoc
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

  const guiBaoSai = async () => {
    if (String(baoSai || '').trim().length < 5) { setMsg({ loai: 'loi', text: 'Ghi rõ chỗ sai (vd: thứ Bảy 18/10 em nghỉ, ngày 08 em đi công tác).' }); return }
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong', { viec: 'bao_sai_cong', nam: ky.nam, thang: ky.thang, ghi_chu: baoSai })
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    await tai()
    setMsg({ loai: 'ok', text: 'Đã gửi báo sai — trưởng phòng / kế toán nội bộ sẽ kiểm tra và sửa.' })
  }

  const luu = async (xacNhan) => {
    if (tong > chuan) { setMsg({ loai: 'loi', text: 'Tổng ba ô (' + tong + ') đang vượt ngày công chuẩn (' + chuan + '). Giảm ngày đi làm cho khớp.' }); return }
    if (xacNhan && !confirm('Xác nhận bảng công tháng ' + ky.thang + '/' + ky.nam + '? Sau khi xác nhận sẽ khoá, sai sót phải nhờ trưởng phòng cập nhật.')) return
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong', {
      viec: 'luu_cong', nam: ky.nam, thang: ky.thang, xacNhan,
      ngay_di_lam: lam, nghi_phep: phep, nghi_khong_luong: kl, so_lan_vi_pham: viPham, ghi_chu: f.ghi_chu,
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
      {d?.khongChamCong && <div className="rounded-2xl border border-sky-200 bg-sky-50 text-sky-900 px-4 py-3 text-sm">Tài khoản <b>Quản trị</b> không cần chấm công.</div>}
      {d?.khongTinhLuong && <div className="rounded-2xl border border-sky-200 bg-sky-50 text-sky-900 px-4 py-3 text-sm">Phòng của bạn là phòng <b>remote</b> — không chấm công và không tính lương trên app.</div>}
      {d && tuMay && (
        <div className={'rounded-2xl border px-4 py-3 text-sm ' + (daBaoSai ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-cyan-200 bg-cyan-50 text-cyan-900')}>
          <div className="font-semibold">🕘 Số công lấy từ máy chấm công{may?.file ? ' · ' + may.file : ''}</div>
          {may?.mau === 'xuly' && <div className="mt-1 leading-relaxed">
            Tổng công hưởng lương <b>{Number(may.tong).toLocaleString('vi-VN')}</b> (HC {Number(may.hc).toLocaleString('vi-VN')}{may.onl ? <> + online {may.onl}</> : null})
            {' − '}nghỉ phép <b>{may.phep}</b>{may.dot_xuat ? <> (gồm {may.dot_xuat} đột xuất BGĐ duyệt)</> : null} = đi làm <b>{Number(d.data.ngay_di_lam).toLocaleString('vi-VN')}</b>
            {' · '}Không lương <b>{Number(may.khong_luong).toLocaleString('vi-VN')}</b>{may.thai_san ? <> + thai sản <b>{may.thai_san}</b></> : null}
            {' · '}Đi muộn, về sớm <b>{may.muon_som_lan || 0}</b> lần + không chấm công <b>{may.khong_cham_lan || 0}</b> lần → vi phạm tác phong
          </div>}
          {may && may.mau !== 'xuly' && <div className="mt-1 leading-relaxed">
            Đi làm = HC <b>{Number(may.hc).toLocaleString('vi-VN')}</b>{may.cong_tac ? <> + công tác <b>{may.cong_tac}</b></> : null} + <b>{may.thu_bay}</b> thứ Bảy (làm online, máy không chấm)
            {' · '}Nghỉ phép <b>{may.phep}</b>{may.dot_xuat ? <> + đột xuất BGĐ duyệt <b>{may.dot_xuat}</b></> : null}
            {' · '}Không lương <b>{Number(may.khong_luong).toLocaleString('vi-VN')}</b>{may.thai_san ? <> + thai sản <b>{may.thai_san}</b></> : null}
            {' · '}Đi muộn <b>{may.muon_lan || 0}</b> lần{may.muon_phut ? ' (' + may.muon_phut + ' phút)' : ''}, về sớm <b>{may.som_lan || 0}</b> lần{may.som_phut ? ' (' + may.som_phut + ' phút)' : ''} → vi phạm tác phong
          </div>}
          {daBaoSai && <div className="mt-1">⚠ Bạn đã báo sai: “{d.data.bao_sai}”. Trưởng phòng / kế toán nội bộ sẽ sửa.</div>}
          {!daBaoSai && d.data.trang_thai !== 'da_xac_nhan' && <div className="mt-1 text-xs opacity-80">Kiểm lại rồi bấm Xác nhận đúng. {may?.mau === 'xuly' ? 'Số nào chưa đúng (ngày công, phép, vi phạm…)' : 'Nghỉ thứ Bảy, công tác chưa ghi nhận…'} thì bấm Báo sai và ghi rõ.</div>}
        </div>
      )}
      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className={'rounded-2xl border p-4 ' + MAU.chuan.the}>
              <span className={'text-sm font-medium ' + MAU.chuan.chu}>Ngày công chuẩn</span>
              <div className={'text-4xl font-bold mt-2 ' + MAU.chuan.dam}>{chuan}</div>
              <span className="text-xs text-gray-500 mt-1 block">{d.ngayCong.soNgay} ngày − {d.ngayCong.chuNhat} chủ nhật{d.ngayCong.le ? ' − ' + d.ngayCong.le + ' ngày lễ' : ''}</span>
            </div>
            {O({ k: 'ngay_di_lam', nhan: 'Ngày đi làm', mau: 'lam', goiY: tuGoDiLam ? 'Đang gõ tay — tính cả thứ Bảy làm online' : 'Tự tính = chuẩn − phép − không lương' })}
            {O({ k: 'nghi_phep', nhan: 'Nghỉ phép (có lương)', mau: 'phep', goiY: 'Vẫn được tính lương' })}
            {O({ k: 'nghi_khong_luong', nhan: 'Nghỉ không lương', mau: 'kl', goiY: 'Không tính lương' })}
            <label className="rounded-2xl border p-4 block bg-violet-50 border-violet-200">
              <span className="text-sm font-medium text-violet-700">Số lần vi phạm tác phong</span>
              <input type="number" min="0" max="50" step="1" value={f.so_lan_vi_pham} disabled={khoa || !d?.duocKhai}
                onChange={e => { setMsg(null); setF(v => ({ ...v, so_lan_vi_pham: e.target.value })) }}
                className="block w-full mt-2 rounded-xl border border-white/80 bg-white px-3 py-2 text-3xl font-bold shadow-sm disabled:bg-white/60 text-violet-900" />
              <span className="text-xs text-gray-500 mt-1 block">Tác phong của bạn: <b className={tacPhong > 90 ? 'text-emerald-700' : tacPhong >= 80 ? 'text-amber-700' : 'text-rose-600'}>{tacPhong}%</b> (mỗi lần −20%)</span>
            </label>
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
              {chuan - tong > 0 && <span className="text-amber-700 font-medium">Còn thiếu {Math.round((chuan - tong) * 100) / 100} ngày — ghi chú lý do trước khi xác nhận</span>}
              {tong > chuan && <span className="text-rose-600 font-medium">Vượt ngày công chuẩn {tong - chuan} ngày — giảm ngày đi làm cho khớp</span>}
            </div>
            {d.ngayLe.length > 0 && <div className="flex flex-wrap gap-2">{d.ngayLe.map(x => (
              <span key={x.ngay} className="text-xs rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5">🎉 {x.ngay.slice(8, 10)}/{x.ngay.slice(5, 7)} · {x.ten}</span>
            ))}</div>}
            <input value={f.ghi_chu} onChange={e => setF(v => ({ ...v, ghi_chu: e.target.value }))} disabled={khoa || !d.duocKhai} maxLength={300}
              placeholder="Ghi chú (vd: vào làm từ ngày 15, nghỉ ốm ngày 08)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50" />
            {tuMay && d.data.trang_thai !== 'da_xac_nhan' && baoSai === null && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => luu(true)} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50">✓ Xác nhận đúng</button>
                <button onClick={() => setBaoSai('')} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl border border-rose-300 bg-white text-rose-700 disabled:opacity-50">⚠ Báo sai</button>
              </div>
            )}
            {tuMay && baoSai !== null && (
              <div className="space-y-2">
                <textarea value={baoSai} onChange={e => setBaoSai(e.target.value)} rows={3} maxLength={500}
                  placeholder="Ghi rõ chỗ sai (vd: thứ Bảy 18/10 em nghỉ; ngày 08 đi công tác máy chưa ghi)…"
                  className="w-full border border-rose-300 rounded-xl px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={guiBaoSai} disabled={ban} className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50">Gửi báo sai</button>
                  <button onClick={() => setBaoSai(null)} className="text-sm text-gray-500">Hủy</button>
                </div>
              </div>
            )}
            {!khoa && d.duocKhai && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => luu(false)} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">💾 Lưu nháp</button>
                <button onClick={() => luu(true)} disabled={ban} className="text-sm px-5 py-2.5 rounded-xl bg-[#8B1A1A] text-white font-semibold shadow-sm hover:bg-[#741515] disabled:opacity-50">✓ Xác nhận ngày công</button>
              </div>
            )}
            {d.data?.trang_thai === 'da_xac_nhan' && <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">🔒 Bảng công đã khoá. Sai sót về ngày làm việc hoặc ngày nghỉ, liên hệ trưởng phòng để kiểm tra và cập nhật.</p>}
          </div>
        </>
      )}
      <HopThongBao msg={msg} />
    </div>
  )
}
