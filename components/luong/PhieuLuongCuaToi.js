'use client'
// Phân hệ Tiền lương — BƯỚC 4: phiếu lương của tôi. Mỗi nhân viên CHỈ thấy phiếu của chính mình (máy chủ
// lọc theo người đăng nhập — app/api/admin/luong/phieu). Bấm Xác nhận để chốt, hoặc Báo sai kèm ghi chú
// để kế toán nội bộ sửa và gửi lại.
import { useCallback, useEffect, useState } from 'react'
import { goi, HopThongBao } from './chung'

const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('vi-VN')
const TT = {
  cho_xac_nhan: ['Chờ bạn xác nhận', 'bg-amber-100 text-amber-800 border-amber-200'],
  da_xac_nhan: ['Đã xác nhận', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  bao_sai: ['Đã báo sai — chờ kế toán sửa', 'bg-rose-100 text-rose-800 border-rose-200'],
}

function Dong({ nhan, giaTri, phu, mau = 'text-gray-900', dam = false, am = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div><div className={'text-sm ' + (dam ? 'font-semibold text-gray-900' : 'text-gray-700')}>{nhan}</div>{phu && <div className="text-xs text-gray-500">{phu}</div>}</div>
      <div className={'text-sm whitespace-nowrap ' + (dam ? 'font-bold ' : 'font-semibold ') + mau}>{am && giaTri ? '−' : ''}{fmt(giaTri)}</div>
    </div>
  )
}

export default function PhieuLuongCuaToi() {
  const [ds, setDs] = useState(null)
  const [chon, setChon] = useState(0)
  const [msg, setMsg] = useState(null)
  const [baoSai, setBaoSai] = useState(null)   // chuỗi ghi chú đang soạn
  const [ban, setBan] = useState(false)

  const tai = useCallback(async () => {
    const j = await goi('/api/admin/luong/phieu?viec=cua_toi')
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); setDs([]); return }
    setDs(j.data || [])
  }, [])
  useEffect(() => { tai() }, [tai])

  const p = ds?.[chon]
  const gui = async (viec) => {
    if (viec === 'xac_nhan' && !confirm('Xác nhận phiếu lương tháng ' + p.thang + '/' + p.nam + ' là đúng?')) return
    setBan(true); setMsg(null)
    const j = await goi('/api/admin/luong/phieu', { viec, nam: p.nam, thang: p.thang, ghi_chu: baoSai || '' })
    setBan(false)
    if (j.error) { setMsg({ loai: 'loi', text: j.error }); return }
    setBaoSai(null)
    setMsg({ loai: 'ok', text: viec === 'xac_nhan' ? 'Đã xác nhận phiếu lương.' : 'Đã gửi báo sai — kế toán nội bộ sẽ kiểm tra và gửi lại phiếu.' })
    tai()
  }

  if (!ds) return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Đang tải…</div>
  if (!ds.length) return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <div className="text-3xl mb-2">📄</div>
      <div className="text-gray-700 font-medium">Chưa có phiếu lương nào được gửi cho bạn.</div>
      <div className="text-sm text-gray-500 mt-1">Kế toán nội bộ chốt bảng lương xong sẽ gửi phiếu vào đây để bạn xác nhận.</div>
      <HopThongBao msg={msg} />
    </div>
  )

  const x = p.dong
  const tt = TT[p.trangThai] || TT.cho_xac_nhan
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ds.map((q, i) => (
          <button key={q.nam + '-' + q.thang} onClick={() => { setChon(i); setBaoSai(null); setMsg(null) }}
            className={'text-sm px-4 py-2 rounded-xl border font-medium ' + (i === chon ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-[#8B1A1A]')}>
            Lương tháng {q.thang}/{q.nam}{q.trangThai === 'cho_xac_nhan' ? ' •' : ''}
          </button>
        ))}
        <span className={'ml-auto text-sm rounded-full border px-3 py-1 font-medium ' + tt[1]}>{tt[0]}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#8B1A1A] to-rose-600 text-white">
            <div className="text-xs opacity-80">PHIẾU LƯƠNG THÁNG {p.thang}/{p.nam}</div>
            <div className="text-lg font-bold">{x.ten}</div>
            <div className="text-xs opacity-80">{x.phong ? 'Phòng ' + x.phong : ''}{x.capBac ? ' · ' + x.capBac : ''}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 px-5 py-3">
            <div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mt-2 mb-1">Lương theo công</div>
              <Dong nhan="Lương cơ bản" giaTri={x.luongCoBan} />
              <Dong nhan="Ngày tính lương" giaTri={null} phu={(x.ngayTinhLuong ?? 0).toLocaleString('vi-VN') + ' / ' + x.ngayCongChuan + ' ngày công chuẩn'} />
              <Dong nhan="Lương theo công" giaTri={x.luongTheoCong} mau="text-blue-800" />
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mt-3 mb-1">Thưởng</div>
              {x.kpiApDung && <Dong nhan="KPI công việc" phu={'Tháng ' + p.ky.viec.thang + ': ' + (x.pctViec ?? '—') + '%'} giaTri={x.thuongViec} mau="text-emerald-700" />}
              {x.kpiApDung && <Dong nhan="KPI công nợ" phu={'Tháng ' + p.ky.no.thang + ': ' + (x.pctNo ?? '—') + '%'} giaTri={x.thuongNo} mau="text-emerald-700" />}
              <Dong nhan={x.laTruongPhong ? 'Doanh số (20% công ty tự làm)' : 'Vượt doanh số'} phu={'Doanh thu ' + fmt(x.doanhThu) + (x.laTruongPhong ? '' : ' / tối thiểu ' + fmt(x.toiThieu))} giaTri={x.thuongDoanhSo} mau="text-violet-700" />
              <Dong nhan="Dịch vụ khác" phu={(x.dvkDong || []).length ? (x.dvkDong.length + ' khoản đã duyệt') : null} giaTri={x.thuongDvk} mau="text-orange-700" />
              {x.kpiApDung && <Dong nhan="KPI phòng" phu={'Điểm phòng ' + (x.diemKpiPhong ?? '—') + '% · tác phong của bạn ' + (x.pctTacPhong ?? 100) + '%'} giaTri={x.thuongPhong} mau="text-fuchsia-700" />}
            </div>
            <div>
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mt-2 mb-1">Khoản khác</div>
              <Dong nhan="Phụ cấp" giaTri={x.phuCap} />
              <Dong nhan="Điều chỉnh" phu={x.lyDoDieuChinh || null} giaTri={x.dieuChinh} mau={x.dieuChinh < 0 ? 'text-rose-600' : 'text-gray-900'} />
              <Dong nhan="Tổng thu nhập" giaTri={x.thuNhap} dam />
              <div className="text-xs font-bold text-rose-700 uppercase tracking-wide mt-3 mb-1">Khoản trừ</div>
              {x.thamGiaBhxh ? <>
                <Dong nhan="BHXH, BHYT, BHTN (10,5%)" phu={'Lương đóng BHXH ' + fmt(x.luongBhxh)} giaTri={x.khauTru?.bhxh} mau="text-rose-700" am />
                <Dong nhan="Kinh phí công đoàn (0,5%)" giaTri={x.khauTru?.kpcd} mau="text-rose-700" am />
                <Dong nhan="Phí Đoàn Thanh niên" giaTri={x.khauTru?.doanPhi} mau="text-rose-700" am />
              </> : <div className="text-xs text-gray-500 py-2">Không tham gia BHXH — không có khoản trừ.</div>}
            </div>
          </div>
          <div className="mx-5 mb-5 rounded-xl bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
            <span className="text-sm opacity-80">THỰC LĨNH</span>
            <span className="text-3xl font-bold">{fmt(x.thucLinh)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
          <div className="font-semibold text-gray-900">Xác nhận phiếu lương</div>
          {p.trangThai === 'da_xac_nhan' && <p className="text-sm text-emerald-700">✓ Bạn đã xác nhận phiếu này{p.luc ? ' lúc ' + new Date(p.luc).toLocaleString('vi-VN') : ''}.</p>}
          {p.trangThai === 'bao_sai' && <p className="text-sm text-rose-700">⚠ Bạn đã báo sai: “{p.ghiChu}”. Kế toán nội bộ sẽ sửa và gửi lại phiếu.</p>}
          {p.trangThai !== 'da_xac_nhan' && baoSai === null && (
            <div className="flex flex-col gap-2">
              <button onClick={() => gui('xac_nhan')} disabled={ban} className="text-sm px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm disabled:opacity-50">✓ Xác nhận đúng</button>
              <button onClick={() => setBaoSai('')} disabled={ban} className="text-sm px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 bg-white">⚠ Báo sai</button>
            </div>
          )}
          {baoSai !== null && (
            <div className="space-y-2">
              <textarea value={baoSai} onChange={e => setBaoSai(e.target.value)} rows={4} maxLength={500}
                placeholder="Ghi rõ chỗ sai (vd: thiếu 1 ngày công, chưa có thưởng dịch vụ khác hồ sơ X)…"
                className="w-full border border-rose-300 rounded-xl px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => gui('bao_sai')} disabled={ban} className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50">Gửi báo sai</button>
                <button onClick={() => setBaoSai(null)} className="text-sm text-gray-500">Hủy</button>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">Thắc mắc về số liệu, bấm “Báo sai” và ghi rõ — kế toán nội bộ sửa rồi gửi lại phiếu. Phiếu đã xác nhận sẽ phải xác nhận lại nếu số thực lĩnh thay đổi.</p>
          <HopThongBao msg={msg} />
        </div>
      </div>
    </div>
  )
}
