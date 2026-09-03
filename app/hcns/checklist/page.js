'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can } from '@/lib/permissions'
import AppShell from '@/components/AppShell'

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30'

// Bỏ dấu để gõ không dấu vẫn tìm ra.
const noAccent = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

const TABS = [
  { key: 'recurring', label: 'DV HCNS Thời Kỳ' },
  { key: 'BHXH',      label: 'BHXH' },
  { key: 'HCNS',      label: 'HCNS' },
]

export default function HcnsChecklistPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
  const [tab, setTab] = useState('recurring')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [newTpl, setNewTpl] = useState('')
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState({})
  const [err, setErr] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      // Lấy ĐỦ vai trò (chính + kiêm nhiệm) — người vừa làm kế toán vừa là trưởng phòng HCNS chỉ
      // có quyền HCNS ở vai trò kiêm nhiệm, đọc mỗi staff.role sẽ bị đá về trang chủ.
      const [{ data: me }, myPerm] = await Promise.all([
        supabase.from('staff').select('role').eq('id', sd.session.user.id).single(),
        fetch('/api/admin/me').then(r => r.json()).catch(() => ({})),
      ])
      const perm = await loadPermissionData()
      const roles = myPerm?.roles?.length ? myPerm.roles : [me?.role].filter(Boolean)
      if (!can(roles, 'view_hcns', perm)) { router.push('/dashboard'); return }
      setAllowed(true)
      setCanEdit(can(roles, 'manage_hcns_template', perm))
      await load()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const load = async () => {
    const res = await fetch('/api/admin/hcns/templates')
    const json = await res.json()
    setTemplates(json.data || [])
  }

  const call = async (method, body, qs) => {
    setErr('')
    const res = await fetch('/api/admin/hcns/templates' + (qs || ''), {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json()
    if (j.error) { setErr(j.error); return false }
    await load()
    return true
  }

  // Nút luôn bấm được và báo lỗi ngay tại chỗ — nút mờ dễ bị hiểu là chức năng hỏng.
  const addTemplate = async () => {
    if (!newTpl.trim()) { setErr('Nhập tên dịch vụ trước khi thêm.'); return }
    if (tab === 'recurring') { setErr('Chỉ được có một mẫu định kỳ. Thêm dịch vụ mới ở tag BHXH hoặc HCNS.'); return }
    setAdding(true)
    // Dịch vụ mới tự vào đúng nhóm của tag đang mở — khỏi phải gán tay sau đó.
    if (await call('POST', { name: newTpl.trim(), is_recurring: false, group_name: tab })) setNewTpl('')
    setAdding(false)
  }

  const addTask = async (templateId) => {
    const name = (newTask[templateId] || '').trim()
    if (!name) { setErr('Nhập tên công việc trước khi thêm.'); return }
    if (await call('POST', { templateId, taskName: name })) setNewTask(p => ({ ...p, [templateId]: '' }))
  }

  const renameTask = async (taskId, current) => {
    const name = window.prompt('Sửa tên công việc:', current)
    if (name === null || !name.trim() || name === current) return
    await call('PATCH', { taskId, name: name.trim() })
  }

  const removeTask = async (taskId, name, usage) => {
    const warn = usage > 0
      ? ['', 'Mẫu này đang được ' + usage + ' nơi sử dụng — công việc sẽ biến mất khỏi các checklist',
         'chưa tích, nhưng phần đã tích vẫn giữ nguyên lịch sử.'].join('\n')
      : ''
    if (!window.confirm('Xoá công việc "' + name + '" khỏi mẫu?' + warn)) return
    await call('DELETE', null, '?taskId=' + taskId)
  }

  const removeTemplate = async (t) => {
    const msg = ['Ẩn dịch vụ "' + t.name + '"?', '',
      'Các hồ sơ đã dùng dịch vụ này vẫn giữ nguyên, chỉ không chọn được khi thêm dịch vụ mới.'].join('\n')
    if (!window.confirm(msg)) return
    await call('DELETE', null, '?templateId=' + t.id)
  }

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-slate-500 text-sm">Đang tải...</p></div></AppShell>
  if (!allowed) return null

  const inTab = (t) => t.is_recurring
    ? tab === 'recurring'
    // Dịch vụ chưa gán nhóm gom về tag HCNS để không biến mất khỏi cả 3 tag.
    : (t.group_name || 'HCNS') === tab
  const q = noAccent(search)
  const list = templates.filter(inTab).filter(t =>
    !q || noAccent(t.name).includes(q) || (t.tasks || []).some(x => noAccent(x.name).includes(q)))

  const countOf = (k) => templates.filter(t => t.is_recurring
    ? k === 'recurring' : (t.group_name || 'HCNS') === k).length

  const totalTasks = list.reduce((a, t) => a + (t.tasks?.length || 0), 0)

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900">Checklist HCNS</h1>
          <p className="text-sm text-slate-500 mt-0.5">Khai báo dịch vụ và công việc kèm theo</p>
        </div>

        {/* Tag dạng viên nén có nền — kiểu chữ trơn trước đây nhìn không ra là bấm được. */}
        <div className="flex gap-2 flex-wrap mb-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setOpen(null) }}
              className={'px-4 py-2 text-sm rounded-lg border transition-colors ' +
                (tab === t.key
                  ? 'bg-[#8B1A1A] text-white border-[#8B1A1A] font-semibold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 hover:text-slate-900')}>
              {t.label}
              <span className={'ml-1.5 text-xs ' + (tab === t.key ? 'text-white/75' : 'text-slate-400')}>
                {countOf(t.key)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm dịch vụ hoặc công việc..." className={inputCls + ' flex-1 min-w-[200px] max-w-sm'} />
          {canEdit && tab !== 'recurring' && (
            <>
              <input value={newTpl} onChange={e => { setNewTpl(e.target.value); if (err) setErr('') }}
                onKeyDown={e => e.key === 'Enter' && addTemplate()}
                placeholder={'Tên dịch vụ mới cho nhóm ' + tab} className={inputCls + ' flex-1 min-w-[200px] max-w-sm'} />
              <button onClick={addTemplate} disabled={adding}
                className="px-4 py-2 bg-[#8B1A1A] text-white rounded-lg text-sm font-medium whitespace-nowrap hover:bg-[#6B1212] disabled:opacity-60">
                {adding ? 'Đang thêm...' : '+ Thêm dịch vụ'}
              </button>
            </>
          )}
        </div>

        {!canEdit && (
          <p className="text-xs text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mb-3">
            Bạn đang xem ở chế độ chỉ đọc — cần quyền “Quản lý Checklist HCNS” để sửa.
          </p>
        )}
        {err && <p className="text-xs text-red-800 bg-red-100 border border-red-300 rounded-lg px-3 py-2 mb-3">{err}</p>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Dòng tiêu đề cột — không có nó thì 2 con số bên phải chẳng ai đoán ra là gì. */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="flex-1">Dịch vụ ({list.length})</span>
            <span className="w-24 text-center">Công việc ({totalTasks})</span>
            <span className="w-20 text-center">Đang dùng</span>
            <span className="w-4" />
          </div>

          {!list.length && (
            <p className="text-sm text-slate-500 px-4 py-10 text-center">
              {search ? 'Không tìm thấy dịch vụ nào khớp.' : 'Nhóm này chưa có dịch vụ nào.'}
            </p>
          )}

          {list.map((t, ri) => {
            const isOpen = open === t.id
            const tasks = t.tasks || []
            return (
              <div key={t.id} className="border-b border-slate-200 last:border-0">
                {/* Dòng gọn — bấm để mở. 24 dịch vụ mà bung hết công việc thì trang dài vô tận.
                    Kẻ sọc chẵn/lẻ để mắt lần đúng hàng khi trang trải hết bề ngang. */}
                <button onClick={() => setOpen(isOpen ? null : t.id)}
                  className={'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ' +
                    (isOpen ? 'bg-[#8B1A1A]/[0.06]' : (ri % 2 ? 'bg-slate-50' : 'bg-white') + ' hover:bg-[#8B1A1A]/[0.04]')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      {t.name}
                      {t.is_recurring && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300">Định kỳ hàng tháng</span>}
                      {!t.is_recurring && !t.group_name && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">Chưa phân nhóm</span>}
                    </p>
                    {t.note && <p className="text-[13px] text-slate-500 mt-0.5 truncate">⏱ {t.note}</p>}
                  </div>
                  <span className={'w-24 text-center text-xs font-semibold px-2 py-1 rounded-md border flex-shrink-0 ' +
                    (tasks.length
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-400')}>
                    {tasks.length ? tasks.length + ' việc' : 'chưa có việc'}
                  </span>
                  <span className={'w-20 text-center text-xs font-semibold px-2 py-1 rounded-md border flex-shrink-0 ' +
                    (t.usageCount > 0
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300')}>
                    {t.usageCount + (t.is_recurring ? ' cty' : ' hồ sơ')}
                  </span>
                  <span className="w-4 text-center text-slate-500 text-xs flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 py-3 bg-slate-100 border-t border-slate-200">
                    <div className="max-w-3xl">
                      {t.note && (
                        <p className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-2 leading-relaxed">
                          ⏱ {t.note}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mb-2">
                        {t.is_recurring
                          ? 'Tự áp cho mọi công ty đã tick “Có sử dụng DV HCNS”. Sửa ở đây là mọi công ty cập nhật theo ngay.'
                          : 'Chọn được khi thêm dịch vụ vào hồ sơ Thời điểm / Vãng lai.'}
                      </p>

                      {!tasks.length ? (
                        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-2">
                          Chưa có công việc nào — dịch vụ này gắn vào hồ sơ sẽ ra checklist rỗng.
                        </p>
                      ) : (
                        <ol className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mb-2">
                          {tasks.map((task, i) => (
                            <li key={task.id} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-800 group hover:bg-slate-50">
                              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="flex-1">{task.name}</span>
                              {canEdit && (
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-3 flex-shrink-0">
                                  <button onClick={() => renameTask(task.id, task.name)} className="text-xs font-medium text-slate-600 hover:text-slate-900">Sửa</button>
                                  <button onClick={() => removeTask(task.id, task.name, t.usageCount)} className="text-xs font-medium text-red-700 hover:text-red-900">Xoá</button>
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}

                      {canEdit && (
                        <div className="flex gap-2 flex-wrap items-center">
                          <input value={newTask[t.id] || ''}
                            onChange={e => { setNewTask(p => ({ ...p, [t.id]: e.target.value })); if (err) setErr('') }}
                            onKeyDown={e => e.key === 'Enter' && addTask(t.id)}
                            placeholder="Nhập tên công việc rồi bấm Thêm"
                            className={inputCls + ' flex-1 min-w-[180px] bg-white'} />
                          <button onClick={() => addTask(t.id)}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-slate-900">
                            Thêm
                          </button>
                          {!t.is_recurring && (
                            <>
                              <select value={t.group_name || ''}
                                onChange={e => call('PATCH', { templateId: t.id, group_name: e.target.value })}
                                className="px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700">
                                <option value="">Chưa phân nhóm</option>
                                <option value="BHXH">Nhóm BHXH</option>
                                <option value="HCNS">Nhóm HCNS</option>
                              </select>
                              <button onClick={() => removeTemplate(t)}
                                className="px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-300 rounded-lg">
                                Ẩn dịch vụ
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
