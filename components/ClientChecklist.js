'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { isPastEditDeadline } from '@/lib/feeDue'

const fmt    = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : ''
const pctClr = (v) => v >= 90 ? 'text-green-600' : v >= 70 ? 'text-yellow-500' : 'text-red-500'
const barClr = (v) => v >= 90 ? 'bg-green-500'   : v >= 70 ? 'bg-yellow-400'   : 'bg-red-400'

const STATUS_STYLE = {
  done_ontime: { bg: 'bg-green-500',  border: 'border-green-500',  text: 'text-green-700',  label: 'Đúng hạn' },
  done_late1:  { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-700', label: 'Trễ 1-2 ngày' },
  done_late3:  { bg: 'bg-red-400',    border: 'border-red-400',    text: 'text-red-600',    label: 'Trễ ≥3 ngày' },
  overdue:     { bg: 'bg-red-200',    border: 'border-red-300',    text: 'text-red-500',    label: 'Quá hạn' },
  pending:     { bg: 'bg-gray-200',   border: 'border-gray-300',   text: 'text-gray-400',   label: 'Chưa làm' },
}

const CRED_CATS = [
  { key: 'hoadon',       label: 'Hóa đơn điện tử' },
  { key: 'thue',         label: 'Thuế điện tử' },
  { key: 'pmxhd',        label: 'Pmxhđ' },
  { key: 'cks_pass',     label: 'Mật khẩu CKS' },
  { key: 'cks_expire',   label: 'Hạn chữ ký số' },
  { key: 'tknh',         label: 'TK ngân hàng' },
  { key: 'bhxh',         label: 'BHXH' },
  { key: 'ketoan',       label: 'Phần mềm kế toán' },
  { key: 'dien',         label: 'TK điện lực' },
  { key: 'email_report', label: 'Email báo cáo' },
  { key: 'vneid',        label: 'VNeID' },
  { key: 'email_kh',     label: 'Email khách' },
  { key: 'khac',         label: 'Thông tin khác' },
]

export default function ClientChecklist({ client, clientMonth, onMonthChange, onDebtSaved, defaultPanel = 'work', isAdmin = false, isTrueAdmin = false }) {
  const now = new Date()
  const [tasks,        setTasks]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [toggling,     setToggling]     = useState(null)
  const [panel,        setPanel]        = useState(defaultPanel)
  const [extraRows,    setExtraRows]    = useState([])
  const [b1Label,      setB1Label]      = useState('')
  const [b1Amount,     setB1Amount]     = useState('')
  const [debtType,     setDebtType]     = useState('ketoan')
  const [debtAmount,   setDebtAmount]   = useState('')
  const [debtNote,     setDebtNote]     = useState('')
  const [savingDebt,   setSavingDebt]   = useState(false)
  const [debtHistory,  setDebtHistory]  = useState(null)
  const [oldDebtAmount, setOldDebtAmount] = useState('')
  const [oldDebtNote,   setOldDebtNote]   = useState('')
  const [savingOldDebt, setSavingOldDebt] = useState(false)
  const [creds,        setCreds]        = useState([])
  const [credsLoading, setCredsLoading] = useState(false)
  const [editCred,     setEditCred]     = useState(null)
  const [savingCred,   setSavingCred]   = useState(false)
  const [showPass,     setShowPass]     = useState({})
  const [files,        setFiles]        = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [fileError,    setFileError]    = useState('')
  const [history,      setHistory]      = useState([])
  const [showHistory,  setShowHistory]  = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const monthOpts = []
  let y = now.getFullYear(), m = now.getMonth() + 1
  for (let i = 0; i < 12; i++) {
    monthOpts.push({ y, m, label: 'T' + m + '/' + y })
    m--; if (m === 0) { m = 12; y-- }
  }
  const selOpt = monthOpts.find(o => o.m === clientMonth) || monthOpts[0]
  const selYear = selOpt.y

  useEffect(() => { loadTasks() }, [clientMonth, client.id])

  useEffect(() => {
    if (defaultPanel === 'debt') {
      setDebtType('ketoan')
      loadDebtHistory()
    }
    if (defaultPanel === 'info') loadCreds()
    if (defaultPanel === 'files') loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  // Tự điền sẵn số tiền ĐÃ ghi nhận cho đúng tháng/loại đang xem (lấy từ lịch sử thu) — giúp
  // nhân viên thấy ngay số hiện tại để sửa lại khi phát hiện cập nhật nhầm công ty, thay vì
  // phải tự nhớ/đoán số cũ. Nếu tháng này chưa có ghi nhận gì, gợi ý mặc định = phí tháng (ketoan).
  useEffect(() => {
    if (panel !== 'debt' || debtType === 'no_ton' || !debtHistory) return
    const amt = recordedAmount(debtType)
    if (amt > 0) setDebtAmount(String(amt))
    else if (debtType === 'ketoan') setDebtAmount(String(client.monthly_fee || ''))
    else setDebtAmount('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtHistory, debtType, clientMonth, selYear, panel])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        '/api/admin/room/client-tasks?clientId=' + client.id +
        '&month=' + clientMonth + '&year=' + selYear +
        '&reportType=' + (client.report_type || 'monthly')
      )
      const json = await res.json()
      setTasks(json.tasks || [])
    } catch (_) {}
    setLoading(false)
  }

  const loadDebtHistory = async () => {
    try {
      const res = await fetch('/api/admin/debt-history?clientId=' + client.id)
      const json = await res.json()
      setDebtHistory(json.data || [])
    } catch (_) {
      setDebtHistory([])
    }
  }

  const loadCreds = async () => {
    setCredsLoading(true)
    try {
      const res = await fetch('/api/admin/credentials?clientId=' + client.id)
      const json = await res.json()
      setCreds(json.creds || [])
    } catch (_) {}
    setCredsLoading(false)
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/client-history?clientId=' + client.id)
      const json = await res.json()
      setHistory(json.log || [])
    } catch (_) {}
    setHistoryLoading(false)
  }

  const loadFiles = async () => {
    setFilesLoading(true)
    try {
      const res = await fetch('/api/admin/client-files?clientId=' + client.id)
      const json = await res.json()
      setFiles(json.files || [])
    } catch (_) {}
    setFilesLoading(false)
  }

  const uploadFile = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true); setFileError('')
    try {
      for (const file of fileList) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('clientId', client.id)
        const res = await fetch('/api/admin/client-files', { method: 'POST', body: fd })
        const json = await res.json()
        if (json.error) { setFileError(json.error); break }
      }
      await loadFiles()
    } catch (_) {
      setFileError('Tải file thất bại, vui lòng thử lại')
    }
    setUploading(false)
  }

  const deleteFile = async (path) => {
    if (!window.confirm('Xóa file này?')) return
    await fetch('/api/admin/client-files?path=' + encodeURIComponent(path), { method: 'DELETE' })
    await loadFiles()
  }

  const openPanel = (p) => {
    if (panel === p) { setPanel(null); return }
    setPanel(p)
    if (p === 'debt') {
      setDebtType('ketoan')
      setDebtNote('')
      loadDebtHistory()
    }
    if (p === 'dntt') {
      setExtraRows([])
      const periodLabel = client.fee_period === 'quarterly'
        ? 'Q' + Math.ceil(clientMonth / 3) + '/' + selYear
        : 'T' + clientMonth + '/' + selYear
      setB1Label('Phí dịch vụ kế toán ' + periodLabel + ' (chưa VAT)')
      // client.monthly_fee đã bao gồm VAT (nhập ở "Thêm công ty") — tách VAT ngay khi mở panel để
      // B1 hiển thị/tính toán đúng số "chưa VAT" xuyên suốt (khớp label + khớp file ĐNTT in ra)
      setB1Amount(client.monthly_fee ? String(Math.round(Number(client.monthly_fee) / 1.08)) : '')
    }
    if (p === 'info') { setEditCred(null); setShowHistory(false); loadCreds() }
    if (p === 'files') { setFileError(''); loadFiles() }
  }

  const saveCred = async () => {
    if (!editCred?.category) return
    setSavingCred(true)
    try {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      const userId = sd.session?.user?.id || null
      await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editCred, clientId: client.id, updatedBy: userId }),
      })
      setEditCred(null)
      await loadCreds()
    } catch (_) {}
    setSavingCred(false)
  }

  const deleteCred = async (id) => {
    if (!window.confirm('Xóa thông tin này?')) return
    const supabase = createClient()
    const { data: sd } = await supabase.auth.getSession()
    const userId = sd.session?.user?.id || ''
    await fetch('/api/admin/credentials?id=' + id + '&updatedBy=' + userId, { method: 'DELETE' })
    await loadCreds()
  }

  // Số tiền đã ghi nhận cho đúng tháng/loại đang xem (dùng để phát hiện sửa giảm + cảnh báo)
  const recordedAmount = (type) => {
    if (!debtHistory) return 0
    const rec = debtHistory.find(h => h.year === selYear && h.month === clientMonth && (h.type || 'ketoan') === type)
    return rec ? Number(rec.amount) || 0 : 0
  }

  const saveDebt = async () => {
    if (!debtAmount) return
    if (debtType === 'ketoan' && !isAdmin && isPastEditDeadline(selYear, clientMonth)) {
      alert('Đã quá hạn cập nhật công nợ của Tháng ' + clientMonth + ', vui lòng cập nhật công nợ Tồn')
      return
    }
    const paid = Number(String(debtAmount).replace(/\D/g, ''))
    const prevAmt = recordedAmount(debtType)
    // Sửa GIẢM số tiền đã ghi nhận (vd nhập nhầm công ty) — cảnh báo rõ trước khi lưu
    if (paid < prevAmt) {
      const fee = Number(client.monthly_fee) || 0
      const remainAfter = debtType === 'ketoan' ? Math.max(0, fee - paid) : 0
      const statusMsg = debtType === 'ketoan'
        ? '\nTrạng thái công ty sẽ chuyển từ "Đã thu đủ" về "Còn phải thu" (còn thiếu ' + fmt(remainAfter) + 'đ).'
        : ''
      const ok = window.confirm(
        'Bạn đang SỬA GIẢM số tiền đã thu từ ' + fmt(prevAmt) + 'đ xuống ' + fmt(paid) + 'đ cho ' + client.name + ' — tháng ' + clientMonth + '/' + selYear + '.' +
        statusMsg + '\n\nXác nhận sửa lại?'
      )
      if (!ok) return
    }
    setSavingDebt(true)
    try {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      const userId = sd.session ? sd.session.user.id : null

      const res = await fetch('/api/admin/save-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:  client.id,
          year:      selYear,
          month:     clientMonth,
          type:      debtType,
          amount:    paid,
          note:      debtNote || null,
          createdBy: userId,
        }),
      })
      const json = await res.json()
      if (json.error) {
        alert('Lưu thất bại: ' + json.error)
        setSavingDebt(false)
        return
      }
      setDebtAmount(''); setDebtNote('')
      await loadDebtHistory()
      if (onDebtSaved) onDebtSaved()
    } catch (e) {
      alert('Lưu thất bại, vui lòng thử lại')
    }
    setSavingDebt(false)
  }

  const saveOldDebt = async () => {
    if (!oldDebtAmount) return
    setSavingOldDebt(true)
    try {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      const userId = sd.session ? sd.session.user.id : null
      const paid = Number(String(oldDebtAmount).replace(/\D/g, ''))

      const res = await fetch('/api/admin/save-old-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, amount: paid, note: oldDebtNote || null, createdBy: userId }),
      })
      const json = await res.json()
      if (json.error) {
        alert('Lưu thất bại: ' + json.error)
        setSavingOldDebt(false)
        return
      }
      setOldDebtAmount(''); setOldDebtNote('')
      await loadDebtHistory()
      if (onDebtSaved) onDebtSaved()
    } catch (e) {
      alert('Lưu thất bại, vui lòng thử lại')
    }
    setSavingOldDebt(false)
  }

  const toggleTask = async (task) => {
    const isDone = task.status.startsWith('done')
    // Không ai được bỏ check khi đã check rồi (tránh mất dấu hoàn thành đúng hạn gốc) —
    // Quản trị sửa trạng thái sai qua nút "Sửa đúng hạn" riêng, không qua checkbox.
    if (isDone) return

    setToggling(task.id)
    const supabase = createClient()
    const { data: sd } = await supabase.auth.getSession()
    const userId = sd.session ? sd.session.user.id : null

    const res = await fetch('/api/admin/task-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId:  client.id,
        taskDefId: task.id,
        year:      selYear,
        month:     clientMonth,
        isDone,
        userId,
        recordId:  task.rec ? task.rec.id : null,
      }),
    })
    const json = await res.json()
    if (json.error) console.error('Toggle error:', json.error)
    setToggling(null)
    await loadTasks()
  }

  // Quản trị sửa 1 task "Hoàn thành trễ hạn" → "Hoàn thành đúng hạn" (chỉnh done_at về đúng ngày hạn)
  const overrideToOnTime = async (task) => {
    if (!task.rec) return
    setToggling(task.id)
    try {
      const res = await fetch('/api/admin/task-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: task.rec.id, year: selYear, month: clientMonth, deadlineDay: task.deadline_day }),
      })
      const json = await res.json()
      if (json.error) alert('Sửa thất bại: ' + json.error)
      await loadTasks()
    } catch (_) {
      alert('Sửa thất bại, vui lòng thử lại')
    }
    setToggling(null)
  }

  const doneTasks  = tasks.filter(t => t.status === 'done_ontime').length
  const totalTasks = tasks.length
  const pct = totalTasks === 0 ? 0 : Math.round(doneTasks / totalTasks * 100)
  const days = Array.from(new Set(tasks.map(t => t.deadline_day))).sort((a,b)=>a-b)

  const extraTotal = extraRows.reduce((s, r) => s + (Number(r.amount)||0), 0)
  // b1Amount đã được tách VAT sẵn khi mở panel (xem openPanel) — đây là số "chưa VAT" thật
  const b1AmountNum = Number(b1Amount) || 0
  const subTotal   = b1AmountNum + extraTotal
  const prevBal    = Number(client.other_debt) || 0
  // "Tồn" (A) đã là số gồm VAT sẵn — lấy thẳng, không nhân 1.08 nữa
  const prevBalVat = prevBal
  const vatAmt     = Math.round(subTotal * 0.08)
  const totalB     = subTotal + vatAmt
  const totalC     = prevBalVat + totalB
  const monthPad   = String(clientMonth).padStart(2,'0')
  const periodCode = client.fee_period === 'quarterly' ? 'Q' + Math.ceil(clientMonth / 3) : 'T' + monthPad
  const clientCode = client.client_code || client.tax_code || ''
  const qrContent  = clientCode + '_ThanhToanPhiDichvu_' + periodCode + '_Savitax'

  const credsByCat = {}
  for (const c of creds) {
    if (!credsByCat[c.category]) credsByCat[c.category] = []
    credsByCat[c.category].push(c)
  }

  const btn = (p, icon, label, active, inactive) =>
    <button key={p} onClick={() => openPanel(p)}
      className={'text-xs px-2.5 py-1.5 border rounded-lg font-medium flex-shrink-0 transition-colors ' +
        (panel === p ? active : inactive)}>
      {icon} {label}
    </button>

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      {/* ── Header: Fee + buttons + month + progress ── */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 bg-white border-b border-gray-100 flex-wrap">
        <div className="bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg leading-none flex-shrink-0">
          {fmt(client.monthly_fee)}đ
        </div>
        {client.other_debt > 0 && (
          <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1.5 rounded-lg leading-none flex-shrink-0">
            Tồn: {fmt(client.other_debt)}đ
          </div>
        )}
        {btn('info', '🔐', 'Thông tin',
          'bg-purple-600 text-white border-purple-600',
          'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100')}
        {btn('work', '✅', 'Công việc',
          'bg-blue-600 text-white border-blue-600',
          'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100')}
        {btn('dntt', '📄', 'ĐNTT',
          'bg-indigo-600 text-white border-indigo-600',
          'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100')}
        {btn('debt', '💰', 'Công nợ',
          'bg-green-600 text-white border-green-600',
          'bg-green-50 text-green-700 border-green-200 hover:bg-green-100')}
        {btn('files', '📁', 'Tài liệu',
          'bg-amber-600 text-white border-amber-600',
          'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100')}
        <div className="flex-1" />
        <select value={clientMonth} onChange={e => onMonthChange(Number(e.target.value))}
          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium flex-shrink-0">
          {monthOpts.map(mo => <option key={mo.label} value={mo.m}>{mo.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={'h-full rounded-full transition-all ' + barClr(pct)} style={{ width: pct + '%' }} />
          </div>
          <span className={'text-xs font-bold ' + pctClr(pct)}>{pct}%</span>
          <span className="text-xs text-gray-400">{doneTasks}/{totalTasks}</span>
        </div>
      </div>

      {/* ── Panel: Thông tin ── */}
      {panel === 'info' && (
        <div className="mx-3 my-2 bg-white border border-purple-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
            <p className="text-xs font-bold text-purple-800">🔐 Thông tin đăng nhập — {client.name}</p>
            <button onClick={() => setEditCred({ category: '', label: '', username: '', password: '', extra: '', note: '' })}
              className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors">
              + Thêm
            </button>
          </div>
          {editCred !== null && (
            <div className="p-3 border-b border-purple-100 bg-purple-50 space-y-2">
              <p className="text-xs font-semibold text-purple-800">{editCred.id ? '✎ Sửa thông tin' : '+ Thêm thông tin'}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Loại thông tin *</label>
                  <select value={editCred.category}
                    onChange={e => setEditCred(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white">
                    <option value="">-- Chọn loại --</option>
                    {CRED_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Nhãn (VD: Vietcombank)</label>
                  <input value={editCred.label || ''} onChange={e => setEditCred(p => ({ ...p, label: e.target.value }))}
                    placeholder="Để trống nếu không cần"
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Tên đăng nhập / Email</label>
                  <input value={editCred.username || ''} onChange={e => setEditCred(p => ({ ...p, username: e.target.value }))}
                    placeholder="username / email / MST..."
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Mật khẩu / PIN</label>
                  <input value={editCred.password || ''} onChange={e => setEditCred(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mật khẩu..."
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-0.5 block">Thông tin thêm (hạn, số TK, OTP...)</label>
                  <input value={editCred.extra || ''} onChange={e => setEditCred(p => ({ ...p, extra: e.target.value }))}
                    placeholder="VD: Hạn 31/12/2025, Số TK: 1234567..."
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-0.5 block">Ghi chú</label>
                  <input value={editCred.note || ''} onChange={e => setEditCred(p => ({ ...p, note: e.target.value }))}
                    placeholder="Ghi chú thêm..."
                    className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditCred(null)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button onClick={saveCred} disabled={savingCred || !editCred.category}
                  className="text-xs px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors">
                  {savingCred ? '...' : '✓ Lưu'}
                </button>
              </div>
            </div>
          )}
          {credsLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : creds.length === 0 && editCred === null ? (
            <p className="text-xs text-gray-400 text-center py-5">Chưa có thông tin đăng nhập nào<br/><span className="text-purple-400">Nhấn &quot;+ Thêm&quot; để bắt đầu</span></p>
          ) : (
            <div className="divide-y divide-gray-50">
              {CRED_CATS.filter(cat => credsByCat[cat.key]?.length > 0).map(cat => (
                <div key={cat.key} className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-purple-700 mb-1.5">{cat.label}</p>
                  <div className="space-y-1.5">
                    {credsByCat[cat.key].map(cr => (
                      <div key={cr.id} className="bg-gray-50 rounded-lg px-2.5 py-2 flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          {cr.label && <p className="text-xs font-semibold text-purple-700">{cr.label}</p>}
                          {cr.username && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400 w-9 flex-shrink-0">User:</span>
                              <span className="text-xs font-mono text-gray-800 select-all break-all">{cr.username}</span>
                            </div>
                          )}
                          {cr.password && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400 w-9 flex-shrink-0">Pass:</span>
                              <span className="text-xs font-mono text-gray-800 select-all">
                                {showPass[cr.id] ? cr.password : '••••••'}
                              </span>
                              <button onClick={() => setShowPass(p => ({ ...p, [cr.id]: !p[cr.id] }))}
                                className="text-gray-400 hover:text-purple-600 ml-0.5 leading-none text-xs">
                                {showPass[cr.id] ? '🙈' : '👁'}
                              </button>
                            </div>
                          )}
                          {cr.extra && <p className="text-xs text-blue-600 mt-0.5 break-all">{cr.extra}</p>}
                          {cr.note && <p className="text-xs text-gray-400 italic mt-0.5">{cr.note}</p>}
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button onClick={() => setEditCred({ ...cr })}
                            className="text-xs px-1.5 py-1 text-purple-600 hover:bg-purple-50 rounded transition-colors">✎</button>
                          <button onClick={() => deleteCred(cr.id)}
                            className="text-xs px-1.5 py-1 text-red-400 hover:bg-red-50 rounded transition-colors">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lịch sử thay đổi */}
          <div className="border-t border-gray-100">
            <button onClick={() => { setShowHistory(p => !p); if (!showHistory) loadHistory() }}
              className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-500 hover:bg-gray-50 transition-colors">
              <span>🕘 Lịch sử thay đổi</span>
              <span className={'transition-transform ' + (showHistory ? 'rotate-180' : '')}>▾</span>
            </button>
            {showHistory && (
              historyLoading ? (
                <div className="flex justify-center py-3">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Chưa có thay đổi nào được ghi nhận</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {history.map(h => (
                    <div key={h.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-700 truncate">
                          {h.entity_label || h.entity} — {h.field}
                        </span>
                        <span className="text-gray-400 flex-shrink-0">
                          {new Date(h.changed_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-0.5">
                        {h.action === 'create' ? (
                          <span className="text-green-600">+ Tạo mới: {h.new_value}</span>
                        ) : h.action === 'delete' ? (
                          <span className="text-red-500">− Đã xóa: {h.old_value}</span>
                        ) : (
                          <>
                            <span className="text-gray-400 line-through">{h.old_value || '(trống)'}</span>
                            {' → '}
                            <span className="text-gray-700 font-medium">{h.new_value || '(trống)'}</span>
                          </>
                        )}
                      </p>
                      {h.staff?.full_name && (
                        <p className="text-gray-400 mt-0.5">bởi {h.staff.full_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Panel: ĐNTT ── */}
      {panel === 'dntt' && (
        <div className="mx-3 my-2 bg-white border border-indigo-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-800">📄 Phiếu Đề Nghị Thanh Toán — T{clientMonth}/{selYear}</p>
            <button onClick={() => {
              const url = '/api/admin/dntt?clientId=' + client.id +
                '&month=' + clientMonth + '&year=' + selYear +
                '&b1Label=' + encodeURIComponent(b1Label) +
                '&b1Amount=' + encodeURIComponent(b1AmountNum) +
                (extraRows.filter(r=>r.desc||r.amount).length > 0
                  ? '&extra=' + encodeURIComponent(JSON.stringify(extraRows.filter(r=>r.desc||r.amount)))
                  : '')
              window.open(url, '_blank')
            }}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              🖨️ Mở PDF
            </button>
          </div>
          <div className="p-3 text-xs">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-[480px]">
              <thead>
                <tr className="bg-indigo-700 text-white">
                  <th className="border border-indigo-600 px-2 py-1 w-10">Mã</th>
                  <th className="border border-indigo-600 px-2 py-1 text-left">Diễn giải</th>
                  <th className="border border-indigo-600 px-2 py-1 w-28 text-right">Số tiền (đ)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-amber-50">
                  <td className="border border-gray-200 px-2 py-1 text-center font-bold">A</td>
                  <td className="border border-gray-200 px-2 py-1 font-semibold">Số tiền kỳ trước chuyển sang (đã gồm VAT 8%)</td>
                  <td className="border border-gray-200 px-2 py-1 text-right">{prevBal > 0 ? fmt(prevBalVat) : '–'}</td>
                </tr>
                <tr className="bg-green-50">
                  <td className="border border-gray-200 px-2 py-1 text-center font-bold">B</td>
                  <td className="border border-gray-200 px-2 py-1 font-semibold">Phí phát sinh kỳ này</td>
                  <td className="border border-gray-200 px-2 py-1 text-right font-bold">{fmt(totalB)}</td>
                </tr>
                <tr className="bg-indigo-50/50">
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-500">B1</td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    <input value={b1Label} onChange={e => setB1Label(e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    <input type="text" inputMode="numeric"
                      value={b1Amount ? Number(b1Amount).toLocaleString('vi-VN') : ''}
                      onChange={e => setB1Amount(e.target.value.replace(/\D/g,''))}
                      className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </td>
                </tr>
                {extraRows.map((r, i) => (
                  <tr key={i} className="bg-indigo-50">
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-500">B{i+2}</td>
                    <td className="border border-gray-200 px-1 py-0.5">
                      <input value={r.desc} onChange={e => { const nr=[...extraRows]; nr[i]={...nr[i],desc:e.target.value}; setExtraRows(nr) }}
                        placeholder="Diễn giải khoản thu..."
                        className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="border border-gray-200 px-1 py-0.5">
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="numeric"
                          value={r.amount ? Number(r.amount).toLocaleString('vi-VN') : ''}
                          onChange={e => { const nr=[...extraRows]; nr[i]={...nr[i],amount:e.target.value.replace(/\D/g,'')}; setExtraRows(nr) }}
                          placeholder="0"
                          className="w-full px-1.5 py-0.5 border border-indigo-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                        <button onClick={() => setExtraRows(extraRows.filter((_,j)=>j!==i))}
                          className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-400">VAT</td>
                  <td className="border border-gray-200 px-2 py-1 text-gray-500 italic">Thuế VAT 8%</td>
                  <td className="border border-gray-200 px-2 py-1 text-right text-gray-500">{fmt(vatAmt)}</td>
                </tr>
                <tr className="bg-red-50">
                  <td className="border border-gray-200 px-2 py-1 text-center font-bold">C=A+B</td>
                  <td className="border border-gray-200 px-2 py-1 font-bold">Tổng đề nghị thanh toán</td>
                  <td className="border border-gray-200 px-2 py-1 text-right font-bold text-red-600">{fmt(totalC)}</td>
                </tr>
              </tbody>
            </table>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button onClick={() => setExtraRows([...extraRows, {desc:'', amount:''}])}
                disabled={extraRows.length >= 6}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors font-medium">
                + Thêm dòng B{extraRows.length+2}
              </button>
              <div className="flex-1 text-xs text-gray-400 text-right">QR: <span className="font-mono text-indigo-600">{qrContent}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel: Công nợ ── */}
      {panel === 'debt' && (
        <div className="mx-3 my-2 bg-white border border-green-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-green-50 border-b border-green-100">
            <p className="text-xs font-bold text-green-800">💰 Công nợ — T{clientMonth}/{selYear}</p>
          </div>
          <div className="flex border-b border-gray-100">
            {[
              { key: 'ketoan', label: '📋 Dịch vụ kế toán', hint: fmt(client.monthly_fee) + 'đ' + (client.fee_period === 'quarterly' ? '/Quý' : '/Tháng') },
              { key: 'khach',  label: '🗂 Dịch vụ khác',    hint: 'Phát sinh khác' },
              { key: 'no_ton', label: '📦 Nợ tồn cũ',       hint: fmt(client.other_debt) + 'đ còn nợ' },
            ].map(t => (
              <button key={t.key} onClick={() => { setDebtType(t.key); setDebtNote('') }}
                className={'flex-1 py-2 text-xs font-semibold transition-colors border-b-2 ' +
                  (debtType === t.key
                    ? 'text-green-700 border-green-500 bg-green-50'
                    : 'text-gray-400 border-transparent hover:text-gray-600')}>
                {t.label}
                <span className="block text-xs font-normal text-gray-400 mt-0.5">{t.hint}</span>
              </button>
            ))}
          </div>
          {debtType === 'no_ton' ? (
            <div className="p-3 space-y-2">
              <div className={'flex justify-between items-center px-3 py-2 rounded-lg text-xs ' +
                (Number(client.other_debt) > 0 ? 'bg-orange-50' : 'bg-green-50')}>
                <span className="text-gray-500">Nợ tồn cũ hiện tại (tách biệt phí tháng này):</span>
                <span className={'font-bold ' + (Number(client.other_debt) > 0 ? 'text-orange-600' : 'text-green-600')}>
                  {fmt(client.other_debt)}đ
                </span>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-0.5 block">Số tiền thu hồi nợ tồn cũ (đ)</label>
                  <input type="text" inputMode="numeric" autoFocus
                    value={oldDebtAmount ? Number(oldDebtAmount.replace(/\D/g,'')||0).toLocaleString('vi-VN') : ''}
                    onChange={e => setOldDebtAmount(e.target.value.replace(/\D/g,''))}
                    placeholder="Nhập số tiền đã thu..."
                    className="w-full px-2.5 py-1.5 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  {oldDebtAmount && Number(oldDebtAmount) > Number(client.other_debt) && (
                    <p className="text-xs text-orange-500 mt-0.5">⚠ Vượt số nợ tồn còn lại — chỉ ghi nhận tối đa {fmt(client.other_debt)}đ</p>
                  )}
                </div>
                <button onClick={saveOldDebt} disabled={savingOldDebt || !oldDebtAmount}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  {savingOldDebt ? '...' : '✓ Lưu'}
                </button>
              </div>
              <input type="text" value={oldDebtNote} onChange={e => setOldDebtNote(e.target.value)}
                placeholder="Ghi chú: ngày chuyển khoản, số HĐ, kênh..."
                className="w-full px-2.5 py-1.5 border border-green-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
              {debtHistory && (() => {
                const filtered = debtHistory.filter(h => h.type === 'no_ton')
                return filtered.length > 0 ? (
                  <div className="mt-1 border-t border-gray-100 pt-2">
                    <p className="text-xs text-gray-400 font-semibold mb-1.5">Lịch sử thu nợ tồn:</p>
                    <div className="space-y-1">
                      {filtered.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 bg-gray-50 rounded-lg">
                          <span className="text-gray-500 font-medium w-14 flex-shrink-0">T{h.month}/{h.year}</span>
                          <span className="text-gray-400 w-20 flex-shrink-0">📅 {fmtDate(h.created_at)}</span>
                          <span className="font-bold text-green-600">{fmt(h.amount)}đ</span>
                          {h.note && <span className="text-gray-400 truncate flex-1 italic">{h.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-xs text-gray-400 text-center py-2">Chưa có lịch sử thu nợ tồn</p>
              })()}
            </div>
          ) : (
          <div className="p-3 space-y-2">
            {(() => {
              const fee     = Number(client.monthly_fee) || 0
              const already = debtType === 'ketoan'
                ? (Number(client.collected) || 0)
                : (Number(client.collectedKhach) || 0)
              const remain  = debtType === 'ketoan' ? Math.max(0, fee - already) : 0
              if (debtType === 'ketoan' && fee === 0) return null
              return (
                <div className={'flex items-center gap-3 px-3 py-2 rounded-lg text-xs ' +
                  (already === 0 ? 'bg-gray-50' : remain === 0 ? 'bg-green-50' : 'bg-orange-50')}>
                  {debtType === 'ketoan' ? (
                    <>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">
                            {client.fee_period === 'quarterly'
                              ? 'Phí quý ' + Math.ceil(clientMonth / 3) + '/' + selYear + ':'
                              : 'Phí tháng ' + clientMonth + '/' + selYear + ':'}
                          </span>
                          <span className="font-semibold text-gray-700">{fmt(fee)}đ</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Đã thu:</span>
                          <span className={'font-semibold ' + (already > 0 ? 'text-green-600' : 'text-gray-400')}>{fmt(already)}đ</span>
                        </div>
                        <div className="h-px bg-gray-200 my-0.5" />
                        <div className="flex justify-between">
                          <span className={'font-bold ' + (remain === 0 ? 'text-green-700' : 'text-orange-600')}>
                            {remain === 0 ? '✓ Đã thu đủ' : '⚠ Còn phải thu:'}
                          </span>
                          <span className={'font-bold ' + (remain === 0 ? 'text-green-600' : 'text-orange-600')}>
                            {remain === 0 ? '0đ' : fmt(remain) + 'đ'}
                          </span>
                        </div>
                      </div>
                      {fee > 0 && (
                        <div className="flex-shrink-0 w-10 h-10 relative">
                          <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none"
                              stroke={remain === 0 ? '#16a34a' : already > 0 ? '#f97316' : '#d1d5db'}
                              strokeWidth="3"
                              strokeDasharray={`${Math.min(100, Math.round(already/fee*100))} 100`}
                              strokeLinecap="round" />
                          </svg>
                          <span className={'absolute inset-0 flex items-center justify-center text-xs font-bold ' +
                            (remain === 0 ? 'text-green-600' : already > 0 ? 'text-orange-500' : 'text-gray-400')}>
                            {Math.min(100, Math.round(already/fee*100))}%
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between flex-1">
                      <span className="text-gray-500">Đã thu dịch vụ khác T{clientMonth}/{selYear}:</span>
                      <span className={'font-semibold ' + (already > 0 ? 'text-blue-600' : 'text-gray-400')}>{fmt(already)}đ</span>
                    </div>
                  )}
                </div>
              )
            })()}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-0.5 block">
                  {recordedAmount(debtType) > 0
                    ? (debtType === 'ketoan' ? '✏️ Sửa số tiền đã thu — dịch vụ kế toán (đ)' : '✏️ Sửa số tiền đã thu — dịch vụ khác (đ)')
                    : (debtType === 'ketoan' ? 'Cập nhật số tiền đã thu — dịch vụ kế toán (đ)' : 'Cập nhật số tiền đã thu — dịch vụ khác (đ)')}
                </label>
                <input type="text" inputMode="numeric" autoFocus
                  value={debtAmount ? Number(debtAmount.replace(/\D/g,'')||0).toLocaleString('vi-VN') : ''}
                  onChange={e => setDebtAmount(e.target.value.replace(/\D/g,''))}
                  placeholder={debtType === 'ketoan' ? 'Phí tháng: ' + fmt(client.monthly_fee) + 'đ' : 'Nhập số tiền...'}
                  className="w-full px-2.5 py-1.5 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                {debtAmount && (() => {
                  const val = Number(debtAmount.replace(/\D/g,''))
                  const prevAmt = recordedAmount(debtType)
                  if (prevAmt > 0 && val < prevAmt) {
                    return <p className="text-xs text-red-500 mt-0.5">↩️ Đang sửa GIẢM từ {fmt(prevAmt)}đ — kiểm tra kỹ trước khi lưu</p>
                  }
                  if (debtType === 'ketoan') {
                    const fee = Number(client.monthly_fee) || 0
                    const remain = Math.max(0, fee - val)
                    if (val === 0) return null
                    if (remain > 0) return <p className="text-xs text-orange-500 mt-0.5">⚠ Sau khi lưu còn phải thu: {fmt(remain)}đ</p>
                    return <p className="text-xs text-green-600 mt-0.5">✓ Thu đủ phí dịch vụ kế toán tháng này</p>
                  }
                  return null
                })()}
              </div>
              <button onClick={saveDebt} disabled={savingDebt || !debtAmount}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex-shrink-0">
                {savingDebt ? '...' : '✓ Lưu'}
              </button>
            </div>
            <input type="text" value={debtNote} onChange={e => setDebtNote(e.target.value)}
              placeholder="Ghi chú: ngày chuyển khoản, số HĐ, kênh..."
              className="w-full px-2.5 py-1.5 border border-green-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
            {debtHistory && (() => {
              const filtered = debtHistory.filter(h => (h.type || 'ketoan') === debtType)
              return filtered.length > 0 ? (
                <div className="mt-1 border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-400 font-semibold mb-1.5">Lịch sử thu:</p>
                  <div className="space-y-1">
                    {filtered.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-500 font-medium w-14 flex-shrink-0">T{h.month}/{h.year}</span>
                        <span className="text-gray-400 w-20 flex-shrink-0">📅 {fmtDate(h.created_at)}</span>
                        <span className={'font-bold ' + (debtType === 'ketoan' && h.amount >= h.feeAtThatTime ? 'text-green-600' : 'text-blue-600')}>
                          {fmt(h.amount)}đ
                        </span>
                        {debtType === 'ketoan' && h.amount < h.feeAtThatTime && (
                          <span className="text-orange-400 text-xs">⚠ thiếu {fmt(h.feeAtThatTime - h.amount)}đ</span>
                        )}
                        {h.note && <span className="text-gray-400 truncate flex-1 italic">{h.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-xs text-gray-400 text-center py-2">Chưa có lịch sử thu</p>
            })()}
          </div>
          )}
        </div>
      )}

      {/* ── Panel: Tài liệu ── */}
      {panel === 'files' && (
        <div className="mx-3 my-2 bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <p className="text-xs font-bold text-amber-800">📁 Tài liệu lưu trữ — {client.name}</p>
            <label className="text-xs px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors cursor-pointer">
              {uploading ? 'Đang tải lên...' : '+ Tải file lên'}
              <input type="file" multiple className="hidden" disabled={uploading}
                onChange={e => { uploadFile(e.target.files); e.target.value = '' }} />
            </label>
          </div>

          {fileError && (
            <div className="px-3 py-2 bg-red-50 text-red-600 text-xs border-b border-red-100">{fileError}</div>
          )}

          {filesLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-5">
              Chưa có tài liệu nào được lưu<br/>
              <span className="text-amber-500">Nhấn &quot;+ Tải file lên&quot; để lưu hợp đồng, giấy phép, hồ sơ... của công ty này</span>
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {files.map(f => (
                <div key={f.path} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="text-lg flex-shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {(f.size / 1024).toFixed(0)} KB
                      {f.createdAt && ' · ' + new Date(f.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex-shrink-0">
                      Mở
                    </a>
                  )}
                  <button onClick={() => deleteFile(f.path)}
                    className="text-xs px-2.5 py-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Panel: Công việc ── */}
      {panel === 'work' && (loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-gray-400 px-4 py-4 text-center">Chưa có công việc cho tháng này</p>
      ) : (
        <div className="px-3 py-2 space-y-2">
          {days.map(day => {
            const dayTasks  = tasks.filter(t => t.deadline_day === day)
            const dayDone   = dayTasks.filter(t => t.status.startsWith('done')).length
            const dayOntime = dayTasks.filter(t => t.status === 'done_ontime').length
            const allDone   = dayOntime === dayTasks.length && dayTasks.length > 0
            return (
              <div key={day} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className={'flex items-center justify-between px-3 py-1.5 border-b ' +
                  (allDone ? 'bg-green-50 border-green-100' : dayDone > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100')}>
                  <div className="flex items-center gap-2">
                    <span className={'text-xs font-bold ' + (allDone ? 'text-green-700' : 'text-gray-600')}>
                      Ngày {day}/{clientMonth}
                    </span>
                    {allDone && <span className="text-xs text-green-600">✓ Hoàn thành đúng hạn</span>}
                    {!allDone && dayDone > 0 && dayDone === dayTasks.length && (
                      <span className="text-xs text-orange-500">⚠ Hoàn thành trễ hạn</span>
                    )}
                  </div>
                  <span className={'text-xs font-semibold ' + pctClr(dayTasks.length > 0 ? Math.round(dayOntime/dayTasks.length*100) : 100)}>
                    {dayOntime}/{dayTasks.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {dayTasks.map(t => {
                    const st = STATUS_STYLE[t.status] || STATUS_STYLE.pending
                    const isDone = t.status.startsWith('done')
                    const isBusy = toggling === t.id
                    return (
                      <div key={t.id}
                        className={'w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50 flex-wrap ' +
                          (isDone ? 'bg-white' : '')}>
                        <button onClick={() => toggleTask(t)} disabled={isBusy || isDone}
                          className="flex items-start gap-2.5 flex-1 min-w-[140px] text-left disabled:cursor-default">
                          {isBusy ? (
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className={'w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all mt-0.5 ' +
                              (isDone
                                ? st.bg + ' border-transparent'
                                : t.status === 'overdue' ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white')}>
                              {isDone && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                          <span className={'flex-1 text-xs break-words ' +
                            (isDone ? 'line-through text-gray-400' : t.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-700')}>
                            {t.name}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                          <span className={'text-xs flex-shrink-0 ' + st.text}>
                            {isDone && t.rec && t.rec.done_at
                              ? new Date(t.rec.done_at).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'})
                              : st.label}
                          </span>
                          {isTrueAdmin && (t.status === 'done_late1' || t.status === 'done_late3') && (
                            <button type="button" disabled={isBusy} title="Sửa thành đúng hạn"
                              onClick={() => overrideToOnTime(t)}
                              className="text-xs flex-shrink-0 text-blue-500 hover:text-blue-700 underline disabled:opacity-50">
                              Sửa đúng hạn
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
