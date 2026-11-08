'use client'
// Tab "Theo dõi hợp đồng" của trang Báo giá (đề xuất Phòng Kinh doanh 04/11/2026, "Sửa 3").
// Hợp đồng ĐÃ CHỐT hiện ở đây: cần thu bao nhiêu, khách đã trả bao nhiêu, tháng nào, còn lại bao nhiêu.
//
// Số CẦN THU không nhập tay — app tính từ bảng khoản phí của báo giá (trackContract), nên hợp đồng
// có phí tháng tự sinh kỳ mới mỗi tháng và không bao giờ lệch với báo giá đã gửi khách.
// Người lập nhập SỐ TIỀN VỀ TÀI KHOẢN (đã gồm VAT), app tự chia ra số chưa VAT để tính doanh số.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackContract, netFromGross, grossFromNet, VAT_DEFAULT } from '@/lib/salesContract'
import { monthVN } from '@/lib/salesItems'
import { api, fmt, fmtMoney, Modal, Field, NumInput, MonthInput, StatCard, inputCls, btnPrimary, btnGhost } from './_ui'

const mmyyyy = m => (m && m.length === 7 ? m.slice(5) + '/' + m.slice(0, 4) : '—')
const VATS = [0, 5, 8, 10]

export default function TheoDoiHopDong({ toast }) {
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upto, setUpto] = useState(monthVN())
  const [qText, setQText] = useState('')
  const [form, setForm] = useState(null)   // { quote, month, payment? }

  const load = useCallback(async () => {
    const r = await api('/api/admin/sales/payments')
    if (!r.ok) { toast(r.data.error || 'Không tải được danh sách hợp đồng', true); setLoading(false); return }
    setRes(r.data); setLoading(false)
  }, [toast])
  useEffect(() => { const chay = async () => { await load() }; chay() }, [load])

  const rows = useMemo(() => {
    if (!res) return []
    const needle = qText.trim().toLowerCase()
    return (res.contracts || [])
      .filter(c => !needle || [c.quote_no, c.company_name, c.author_name].join(' ').toLowerCase().includes(needle))
      .map(c => ({ ...c, track: trackContract({ items: c.items, payments: c.payments, upto }) }))
  }, [res, qText, upto])

  const tong = useMemo(() => rows.reduce((a, c) => ({
    canThu: a.canThu + c.track.canThu, daThu: a.daThu + c.track.daThu, conLai: a.conLai + c.track.conLai,
  }), { canThu: 0, daThu: 0, conLai: 0 }), [rows])
  // Doanh số tháng đang xem = tiền VỀ trong tháng đó (không phải kỳ phí của tháng đó).
  const doanhSo = useMemo(() => (res?.contracts || []).reduce((a, c) =>
    a + (c.payments || []).filter(p => p.paid_month === upto).reduce((s, p) => s + (Number(p.net) || 0), 0), 0), [res, upto])

  const xoa = async (p, ten) => {
    if (!window.confirm('Xoá lần thu ' + fmtMoney(p.gross) + ' của ' + ten + '? Doanh số tháng ' + mmyyyy(p.paid_month) + ' sẽ giảm theo.')) return
    const r = await api('/api/admin/sales/payments?id=' + p.id, { method: 'DELETE' })
    if (!r.ok) { toast(r.data.error || 'Chưa xoá được', true); return }
    toast('Đã xoá lần thu'); load()
  }

  if (loading) return <div className="s-panel py-12 text-center text-sm text-gray-400">Đang tải hợp đồng…</div>
  if (!res) return null
  if (!res.ready) {
    return (
      <div className="s-panel py-10 px-6 text-center">
        <p className="text-sm text-gray-700 font-medium">Chưa cài bảng theo dõi hợp đồng</p>
        <p className="text-xs text-gray-500 mt-1">Chạy file <b>sql/54_sales_contract_payments.sql</b> trên Supabase rồi tải lại trang.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <input value={qText} onChange={e => setQText(e.target.value)} placeholder="Tìm số hợp đồng, tên công ty, người lập…"
          className="s-input !w-auto flex-1 min-w-[260px]" />
        <span className="text-xs text-gray-500">Tính kỳ thu tới tháng</span>
        <MonthInput value={upto} onChange={setUpto} className="s-input !py-1.5" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Hợp đồng theo dõi" value={rows.length} foot={'tính tới ' + mmyyyy(upto)} tone="sky" />
        <StatCard label="Cần thu" value={fmt(tong.canThu)} unit="đ" foot="chưa gồm VAT" tone="blue" />
        <StatCard label="Đã thu" value={fmt(tong.daThu)} unit="đ" foot={tong.canThu ? Math.round(tong.daThu * 100 / tong.canThu) + '% số cần thu' : '—'} tone="grn" />
        <StatCard label={'Doanh số tháng ' + mmyyyy(upto)} value={fmt(doanhSo)} unit="đ" foot={tong.conLai > 0 ? 'còn thiếu ' + fmt(tong.conLai) + ' đ' : 'đã thu đủ'} tone="gold" />
      </div>

      <div className="s-panel">
        {!rows.length ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">Chưa có hợp đồng nào để theo dõi</p>
            <p className="text-xs text-gray-400 mt-1">Hợp đồng tự vào đây khi tình trạng khách chuyển sang <b>Chốt hợp đồng</b> và báo giá đã tách dòng phí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="s-tbl">
              <thead>
                <tr>
                  <th>STT</th>
                  <th className="l">Hợp đồng – Khách hàng</th>
                  <th>Kỳ phí</th>
                  <th>Cần thu</th>
                  <th>Đã thu</th>
                  <th>Còn lại</th>
                  <th className="l">Các lần tiền về</th>
                  <th></th>
                </tr>
              </thead>
              {rows.map((c, i) => (
                <tbody key={c.id} className="border-t-2 border-[#D5E2ED]">
                  <tr className="bg-[#F3F8FC]">
                    <td className="font-semibold num">{i + 1}</td>
                    <td className="l min-w-[240px]">
                      <p className="font-semibold text-gray-900">{c.company_name || '—'}</p>
                      <p className="text-xs text-gray-500">BG <span className="num">{c.quote_no}</span>{c.author_name ? ' · ' + c.author_name : ''}</p>
                    </td>
                    <td className="text-xs text-gray-500">Tổng</td>
                    <td className="num font-semibold">{fmtMoney(c.track.canThu)}</td>
                    <td className="num font-semibold text-emerald-700">{fmtMoney(c.track.daThu)}</td>
                    <td className={'num font-semibold ' + (c.track.conLai > 0 ? 'text-red-700' : 'text-gray-400')}>{fmtMoney(c.track.conLai)}</td>
                    <td className="l text-xs text-gray-500">{c.payments.length ? c.payments.length + ' lần thu' : 'chưa thu lần nào'}</td>
                    <td></td>
                  </tr>
                  {!c.track.kys.length && (
                    <tr>
                      <td></td>
                      <td colSpan={6} className="l text-xs text-amber-800 bg-amber-50">
                        Báo giá này chưa tách dòng phí nên chưa biết cần thu bao nhiêu — mở báo giá <b className="num">{c.quote_no}</b>,
                        dựng <b>Bước 5 · Bảng khoản phí</b> rồi quay lại đây.
                      </td>
                      <td></td>
                    </tr>
                  )}
                  {c.track.kys.map(k => (
                    <tr key={k.month}>
                      <td></td>
                      <td></td>
                      <td className="num whitespace-nowrap">{mmyyyy(k.month)}</td>
                      <td className="num">{fmtMoney(k.due)}</td>
                      <td className="num text-emerald-700">{k.paid ? fmtMoney(k.paid) : <span className="text-gray-300">—</span>}</td>
                      <td className={'num ' + (k.left > 0 ? 'text-red-700' : 'text-gray-400')}>{fmtMoney(k.left)}</td>
                      <td className="l min-w-[260px]">
                        {!k.payments.length ? <span className="text-xs text-gray-400">—</span> : (
                          <div className="flex flex-col gap-1">
                            {k.payments.map(p => (
                              <div key={p.id} className="flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 num">{fmtMoney(p.gross)}</span>
                                <span className="text-gray-500">về {mmyyyy(p.paid_month)}</span>
                                <span className="text-gray-400">VAT {fmt(p.vat_rate)}% → <b className="num">{fmtMoney(p.net)}</b></span>
                                {c.canEdit && (
                                  <>
                                    <button onClick={() => setForm({ quote: c, month: k.month, payment: p })} className="text-[#2A6CA8] hover:underline">Sửa</button>
                                    <button onClick={() => xoa(p, c.company_name)} className="text-red-600 hover:underline">Xoá</button>
                                  </>
                                )}
                                {p.note && <span className="text-gray-400 italic">{p.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {c.canEdit && (
                          <button onClick={() => setForm({ quote: c, month: k.month, left: k.left })}
                            className="text-xs px-2.5 py-1 rounded-lg border border-[#2A6CA8] text-[#2A6CA8] hover:bg-[#EAF2F9]">＋ Thêm lần thu</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      {form && (
        <FormLanThu form={form} staff={res.staff || []} perms={res.perms} toast={toast}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); load() }} />
      )}
    </>
  )
}

// Hộp ghi một lần tiền về. Nhập số tiền VỀ TÀI KHOẢN (đã gồm VAT) — số chưa VAT hiện ngay bên dưới
// để người lập đối chiếu trước khi lưu.
function FormLanThu({ form, staff, perms, toast, onClose, onSaved }) {
  const p = form.payment
  const [d, setD] = useState({
    due_month: p?.due_month || form.month,
    paid_month: p?.paid_month || monthVN(),
    gross: p ? Number(p.gross) || 0 : 0,
    vat_rate: p ? Number(p.vat_rate) : VAT_DEFAULT,
    staff_id: p?.staff_id || form.quote.author_id || '',
    note: p?.note || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setD(o => ({ ...o, [k]: v }))
  const net = netFromGross(d.gross, d.vat_rate)
  const goiY = form.left > 0 ? grossFromNet(form.left, d.vat_rate) : 0

  const luu = async () => {
    if (!d.gross) { toast('Chưa nhập số tiền về tài khoản', true); return }
    setSaving(true)
    const body = { ...d, quote_id: form.quote.id, ...(p ? { id: p.id } : {}) }
    const r = await api('/api/admin/sales/payments', { method: p ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!r.ok) { toast(r.data.error || 'Chưa lưu được lần thu', true); return }
    toast(p ? 'Đã sửa lần thu' : 'Đã ghi ' + fmtMoney(d.gross) + ' cho ' + (form.quote.company_name || 'khách'))
    onSaved()
  }

  return (
    <Modal title={(p ? 'Sửa lần thu — ' : 'Thêm lần thu — ') + (form.quote.company_name || '')} onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Hủy</button>
        <button onClick={luu} disabled={saving} className={btnPrimary}>{saving ? 'Đang lưu…' : 'Lưu lần thu'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kỳ phí" hint="khoản này trả cho tháng nào">
          <MonthInput value={d.due_month} onChange={v => set('due_month', v)} />
        </Field>
        <Field label="Tháng tiền về" hint="tính doanh số tháng này">
          <MonthInput value={d.paid_month} onChange={v => set('paid_month', v)} />
        </Field>
      </div>
      <Field label="Số tiền về tài khoản (đã gồm VAT)" className="mt-3">
        <NumInput value={d.gross} onChange={v => set('gross', v)} />
      </Field>
      {goiY > 0 && (
        <button onClick={() => set('gross', goiY)} className="mt-1 text-xs text-[#2A6CA8] hover:underline">
          Khách trả nốt phần còn thiếu: {fmtMoney(goiY)} (còn {fmtMoney(form.left)} chưa VAT)
        </button>
      )}
      <Field label="Thuế suất GTGT" hint="app chia ra số chưa VAT để tính doanh số" className="mt-3">
        <select value={d.vat_rate} onChange={e => set('vat_rate', Number(e.target.value))} className={inputCls}>
          {VATS.map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </Field>
      <div className="mt-3 rounded-xl px-4 py-3 bg-[#F3F8FC] border border-[#D5E2ED] flex items-center justify-between">
        <span className="text-sm text-gray-600">Đã thu (chưa VAT) — số tính doanh số</span>
        <span className="num text-lg font-semibold" style={{ color: '#2A6CA8' }}>{fmtMoney(net)}</span>
      </div>
      {perms.all && staff.length > 0 && (
        <Field label="Người hưởng doanh số" hint="mặc định là người lập báo giá" className="mt-3">
          <select value={d.staff_id || ''} onChange={e => set('staff_id', e.target.value)} className={inputCls}>
            <option value="">— chọn nhân viên —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Ghi chú" hint="không bắt buộc" className="mt-3">
        <input value={d.note} onChange={e => set('note', e.target.value)} className={inputCls}
          placeholder="VD: chuyển khoản VCB ngày 05/11, khách xin trả nốt cuối tháng…" />
      </Field>
    </Modal>
  )
}
