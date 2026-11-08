'use client'
// Báo cáo doanh số và thưởng cuối tháng (đề xuất Phòng Kinh doanh 04/11/2026, "Sửa 4").
//
// Doanh số = tiền THỰC THU trong tháng (tháng tiền về), CHƯA gồm VAT, chỉ khoản về Savitax.
// Thưởng = (doanh số − mốc) × tỷ lệ; chưa đạt mốc thì không có thưởng.
// Số luôn do SERVER tính lại từ các lần thu; bấm "Làm báo cáo tháng" là chụp lại số đó để sếp duyệt.
import { useCallback, useEffect, useState } from 'react'
import { MUC_NV, mucOf, trangThaiOf } from '@/lib/salesBonus'
import { monthVN } from '@/lib/salesItems'
import { api, fmt, fmtMoney, dmyTime, Modal, Field, NumInput, MonthInput, StatCard, inputCls, btnPrimary, btnGhost } from './_ui'

const mmyyyy = m => (m && m.length === 7 ? m.slice(5) + '/' + m.slice(0, 4) : '—')

export default function DoanhSoThuong({ toast }) {
  const [period, setPeriod] = useState(monthVN())
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [caiDat, setCaiDat] = useState(false)
  const [capNv, setCapNv] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api('/api/admin/sales/bonus?period=' + period)
    if (!r.ok) { toast(r.data.error || 'Không tải được báo cáo thưởng', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [period, toast])
  useEffect(() => { const chay = async () => { await load() }; chay() }, [load])

  const lamBaoCao = async () => {
    setBusy(true)
    const r = await api('/api/admin/sales/bonus', { method: 'POST', body: { period } })
    setBusy(false)
    if (!r.ok) { toast(r.data.error || 'Chưa làm được báo cáo', true); return }
    toast('Đã trình ' + r.data.count + ' dòng báo cáo tháng ' + mmyyyy(period) + ' lên quản trị')
    load()
  }
  const duyet = async (action, staffId) => {
    const ten = action === 'duyet' ? 'Duyệt' : 'Trả lại'
    if (!window.confirm(ten + ' báo cáo thưởng tháng ' + mmyyyy(period) + (staffId ? ' của nhân viên này' : ' cho CẢ PHÒNG') + '?')) return
    setBusy(true)
    const r = await api('/api/admin/sales/bonus', { method: 'PATCH', body: { action, period, staff_id: staffId || null } })
    setBusy(false)
    if (!r.ok) { toast(r.data.error || 'Chưa đổi được trạng thái', true); return }
    toast(ten + ' xong'); load()
  }

  const xuatExcel = async () => {
    const { soExcelMoi, themSheetMang, taiVeExcel } = await import('@/lib/excelDep')
    const s = res.settings || {}
    const hang = [
      ['BÁO CÁO DOANH SỐ VÀ THƯỞNG — PHÒNG KINH DOANH'],
      ['Tháng ' + mmyyyy(period) + ' · doanh số là tiền thực thu CHƯA gồm thuế GTGT · thưởng = ' + fmt(s.ty_le) +
        '% phần vượt mốc · mốc thử việc ' + fmt(s.nguong_thu_viec) + ' đ, chính thức ' + fmt(s.nguong_chinh_thuc) + ' đ'],
      [],
      ['STT', 'Nhân viên', 'Cấp', 'Doanh số (chưa VAT)', 'Mốc doanh số', 'Phần vượt mốc', 'Tỷ lệ', 'Tiền thưởng', 'Trạng thái', 'Người duyệt'],
      ...res.rows.map((r, i) => [
        i + 1, r.staff_name, r.level_label, r.doanh_so, r.nguong, r.vuot, Number(r.ty_le), r.thuong,
        r.trang_thai ? trangThaiOf(r.trang_thai).label : 'Chưa trình', r.nguoi_duyet_ten || '',
      ]),
      ['', 'TỔNG CỘNG', '', res.tongDoanhSo, '', '', '', res.tongThuong, '', ''],
    ]
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Thuong ' + period, hang, {
      doRong: [5, 26, 11, 18, 16, 16, 7, 16, 13, 20], cotTien: [3, 4, 5, 7], cotPhanTramSo: [6],
    })
    await taiVeExcel(wb, 'DoanhSo-Thuong-' + period + '.xlsx')
    toast('Đã tải file Excel báo cáo thưởng tháng ' + mmyyyy(period))
  }

  if (loading) return <div className="s-panel py-12 text-center text-sm text-gray-400">Đang tính doanh số…</div>
  if (!res) return null
  if (!res.ready) {
    return (
      <div className="s-panel py-10 px-6 text-center">
        <p className="text-sm text-gray-700 font-medium">Chưa cài bảng thưởng</p>
        <p className="text-xs text-gray-500 mt-1">Chạy file <b>sql/55_sales_bonus.sql</b> trên Supabase rồi tải lại trang.</p>
      </div>
    )
  }

  const s = res.settings
  const daTrinh = res.rows.filter(r => r.trang_thai).length
  const choDuyet = res.rows.filter(r => r.trang_thai === 'cho_duyet').length
  const coLech = res.rows.some(r => r.lech)

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-sm text-gray-600">Tháng báo cáo</span>
        <MonthInput value={period} onChange={setPeriod} className="s-input !py-1.5" />
        <span className="text-xs text-gray-500">{res.soLanThu} lần tiền về trong tháng</span>
        <div className="ml-auto flex gap-2 flex-wrap">
          {(res.perms.all || res.perms.approve) && (
            <button onClick={lamBaoCao} disabled={busy} className={btnPrimary}>Làm báo cáo tháng</button>
          )}
          {res.perms.approve && choDuyet > 0 && (
            <button onClick={() => duyet('duyet')} disabled={busy} className={btnGhost}>Duyệt cả phòng ({choDuyet})</button>
          )}
          <button onClick={xuatExcel} className={btnGhost}>Xuất Excel</button>
          {res.perms.approve && <button onClick={() => setCaiDat(true)} className={btnGhost}>Cài đặt thưởng</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Doanh số cả phòng" value={fmt(res.tongDoanhSo)} unit="đ" foot={'tháng ' + mmyyyy(period) + ' · chưa VAT'} tone="blue" />
        <StatCard label="Số người đạt mốc" value={res.soNguoiDat} foot={'trên ' + res.rows.length + ' nhân viên'} tone="grn" />
        <StatCard label="Tổng tiền thưởng" value={fmt(res.tongThuong)} unit="đ" foot={fmt(s.ty_le) + '% phần vượt mốc'} tone="gold" />
        <StatCard label="Đã trình duyệt" value={daTrinh} foot={choDuyet ? choDuyet + ' dòng chờ quản trị duyệt' : (daTrinh ? 'quản trị đã xử lý hết' : 'chưa trình')} tone={choDuyet ? 'amb' : 'sky'} />
      </div>

      {coLech && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 text-sm text-amber-900">
          Có dòng <b>đã trình duyệt nhưng số đã đổi</b> (ghi thêm hoặc sửa lần thu sau khi trình). Bấm
          <b> Làm báo cáo tháng</b> để chụp lại số mới rồi trình duyệt lại.
        </div>
      )}

      <div className="s-panel">
        <div className="overflow-x-auto">
          <table className="s-tbl">
            <thead>
              <tr>
                <th>STT</th>
                <th className="l">Nhân viên</th>
                <th>Cấp</th>
                <th>Doanh số (chưa VAT)</th>
                <th>Mốc doanh số</th>
                <th>Phần vượt mốc</th>
                <th>Tiền thưởng</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!res.rows.length && (
                <tr><td colSpan={9} className="py-10 text-center text-sm text-gray-500">Chưa có nhân viên nào trong Phòng Kinh doanh</td></tr>
              )}
              {res.rows.map((r, i) => {
                const tt = r.trang_thai ? trangThaiOf(r.trang_thai) : null
                return (
                  <tr key={r.staff_id}>
                    <td className="num">{i + 1}</td>
                    <td className="l min-w-[200px]">
                      <p className="font-medium text-gray-900">{r.staff_name}</p>
                      {r.lech && <p className="text-[11px] text-amber-700">đã trình {fmtMoney(r.doanh_so_da_trinh)} — số nay đã đổi</p>}
                      {r.ghi_chu && <p className="text-[11px] text-gray-500 italic">{r.ghi_chu}</p>}
                    </td>
                    <td>
                      {res.perms.approve ? (
                        <button onClick={() => setCapNv(r)} className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 hover:border-gray-400">{r.level_label}</button>
                      ) : <span className="text-xs text-gray-600">{r.level_label}</span>}
                    </td>
                    <td className="num font-semibold">{fmtMoney(r.doanh_so)}</td>
                    <td className="num text-gray-500">{fmtMoney(r.nguong)}</td>
                    <td className={'num ' + (r.vuot > 0 ? 'text-emerald-700' : 'text-gray-300')}>{r.vuot > 0 ? fmtMoney(r.vuot) : '—'}</td>
                    <td className={'num font-semibold ' + (r.thuong > 0 ? 'text-[#C9A027]' : 'text-gray-300')}>{r.thuong > 0 ? fmtMoney(r.thuong) : '0 đ'}</td>
                    <td>
                      {!tt ? <span className="text-xs text-gray-400">Chưa trình</span> : (
                        <span className={'text-xs px-2.5 py-0.5 rounded-full border ' + tt.cls}>{tt.label}</span>
                      )}
                      {r.luc_duyet && <p className="text-[11px] text-gray-400 mt-0.5">{r.nguoi_duyet_ten || ''} · {dmyTime(r.luc_duyet)}</p>}
                    </td>
                    <td className="whitespace-nowrap">
                      {res.perms.approve && r.trang_thai === 'cho_duyet' && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => duyet('duyet', r.staff_id)} disabled={busy} className="text-xs px-2.5 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Duyệt</button>
                          <button onClick={() => duyet('tra_lai', r.staff_id)} disabled={busy} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50">Trả lại</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="s-total">
          <span>TỔNG CỘNG — doanh số {fmtMoney(res.tongDoanhSo)}</span>
          <span className="num">{fmtMoney(res.tongThuong)}</span>
        </div>
      </div>

      {caiDat && <CaiDatThuong settings={s} toast={toast} onClose={() => setCaiDat(false)} onSaved={() => { setCaiDat(false); load() }} />}
      {capNv && <CapNhanVien row={capNv} toast={toast} onClose={() => setCapNv(null)} onSaved={() => { setCapNv(null); load() }} />}
    </>
  )
}

// Mốc + tỷ lệ thưởng — sếp tự sửa khi cơ chế đổi, không phải sửa mã nguồn.
function CaiDatThuong({ settings, toast, onClose, onSaved }) {
  const [d, setD] = useState({
    nguong_thu_viec: Number(settings.nguong_thu_viec) || 0,
    nguong_chinh_thuc: Number(settings.nguong_chinh_thuc) || 0,
    ty_le: Number(settings.ty_le) || 0,
    vat_rate: Number(settings.vat_rate) || 0,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setD(o => ({ ...o, [k]: v }))
  const luu = async () => {
    setSaving(true)
    const r = await api('/api/admin/sales/bonus', { method: 'PATCH', body: { action: 'settings', ...d } })
    setSaving(false)
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được cài đặt', true); return }
    toast('Đã lưu cài đặt thưởng'); onSaved()
  }
  return (
    <Modal title="Cài đặt thưởng — Phòng Kinh doanh" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Hủy</button>
        <button onClick={luu} disabled={saving} className={btnPrimary}>{saving ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
      </>}>
      <p className="text-xs text-gray-500 mb-3">
        Đổi ở đây là mọi tháng CHƯA trình duyệt tính lại theo mốc mới; dòng đã trình giữ nguyên số cũ cho tới khi làm lại báo cáo.
      </p>
      <Field label="Mốc doanh số — thử việc (đ/tháng)"><NumInput value={d.nguong_thu_viec} onChange={v => set('nguong_thu_viec', v)} /></Field>
      <Field label="Mốc doanh số — chính thức (đ/tháng)" className="mt-3"><NumInput value={d.nguong_chinh_thuc} onChange={v => set('nguong_chinh_thuc', v)} /></Field>
      <Field label="Tỷ lệ thưởng trên phần vượt mốc (%)" className="mt-3"><NumInput value={d.ty_le} onChange={v => set('ty_le', v)} /></Field>
      <Field label="Thuế suất GTGT gợi ý khi ghi lần thu (%)" className="mt-3"><NumInput value={d.vat_rate} onChange={v => set('vat_rate', v)} /></Field>
    </Modal>
  )
}

// Cấp của một nhân viên (thử việc / chính thức) + mốc riêng nếu sếp muốn đặt tay.
function CapNhanVien({ row, toast, onClose, onSaved }) {
  const [level, setLevel] = useState(row.level || 'chinh_thuc')
  const [nguong, setNguong] = useState(0)
  const [rieng, setRieng] = useState(false)
  const [saving, setSaving] = useState(false)
  const luu = async () => {
    setSaving(true)
    const r = await api('/api/admin/sales/bonus', { method: 'PATCH', body: { action: 'level', staff_id: row.staff_id, level, nguong: rieng ? nguong : null } })
    setSaving(false)
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được', true); return }
    toast('Đã đặt cấp cho ' + row.staff_name); onSaved()
  }
  return (
    <Modal title={'Cấp nhân viên — ' + row.staff_name} onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Hủy</button>
        <button onClick={luu} disabled={saving} className={btnPrimary}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
      </>}>
      <Field label="Cấp">
        <select value={level} onChange={e => setLevel(e.target.value)} className={inputCls}>
          {MUC_NV.map(m => <option key={m.k} value={m.k}>{m.label}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
        <input type="checkbox" checked={rieng} onChange={e => setRieng(e.target.checked)} className="accent-[#2A6CA8] w-4 h-4" />
        Đặt mốc riêng cho người này (không dùng mốc theo cấp)
      </label>
      {rieng && <div className="mt-2"><NumInput value={nguong} onChange={setNguong} /></div>}
      {!rieng && <p className="text-xs text-gray-500 mt-2">Đang dùng mốc chung của cấp {mucOf(level).label}.</p>}
    </Modal>
  )
}
