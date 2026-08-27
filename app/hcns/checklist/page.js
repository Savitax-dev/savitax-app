'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can } from '@/lib/permissions'
import AppShell from '@/components/AppShell'

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/30'

export default function HcnsChecklistPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
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
      const { data: me } = await supabase.from('staff').select('role').eq('id', sd.session.user.id).single()
      const perm = await loadPermissionData()
      if (!can(me?.role, 'view_hcns', perm)) { router.push('/dashboard'); return }
      setAllowed(true)
      setCanEdit(can(me?.role, 'manage_hcns_template', perm))
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
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json()
    if (j.error) { setErr(j.error); return false }
    await load()
    return true
  }

  const addTemplate = async () => {
    if (!newTpl.trim()) return
    setAdding(true)
    if (await call('POST', { name: newTpl.trim(), is_recurring: false })) setNewTpl('')
    setAdding(false)
  }

  const addTask = async (templateId) => {
    const name = (newTask[templateId] || '').trim()
    if (!name) return
    if (await call('POST', { templateId, taskName: name })) {
      setNewTask(p => ({ ...p, [templateId]: '' }))
    }
  }

  const renameTask = async (taskId, current) => {
    const name = window.prompt('Sửa tên công việc:', current)
    if (name === null || !name.trim() || name === current) return
    await call('PATCH', { taskId, name: name.trim() })
  }

  const removeTask = async (taskId, name, usage) => {
    const warn = usage > 0
      ? '\n\nMẫu này đang được ' + usage + ' nơi sử dụng — công việc sẽ biến mất khỏi các checklist chưa tích, nhưng phần đã tích vẫn giữ nguyên lịch sử.'
      : ''
    if (!window.confirm('Xoá công việc "' + name + '" khỏi mẫu?' + warn)) return
    await call('DELETE', null, '?taskId=' + taskId)
  }

  const removeTemplate = async (t) => {
    if (!window.confirm('Ẩn dịch vụ "' + t.name + '"?\n\nCác hồ sơ đã dùng dịch vụ này vẫn giữ nguyên, chỉ không chọn được khi thêm dịch vụ mới.')) return
    await call('DELETE', null, '?templateId=' + t.id)
  }

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  if (!allowed) return null

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5 max-w-4xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Checklist HCNS</h1>
            <p className="text-sm text-gray-500 mt-0.5">Khai báo dịch vụ và công việc kèm theo</p>
          </div>
        </div>

        {!canEdit && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Bạn đang xem ở chế độ chỉ đọc — cần quyền “Quản lý Checklist HCNS” để sửa.
          </p>
        )}
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{err}</p>}

        {canEdit && (
          <div className="flex gap-2 mb-4">
            <input value={newTpl} onChange={e => setNewTpl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTemplate()}
              placeholder="Tên dịch vụ mới, VD: Giấy phép lao động" className={inputCls} />
            <button onClick={addTemplate} disabled={adding || !newTpl.trim()}
              className="px-4 py-2 bg-[#8B1A1A] text-white rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-40">
              + Thêm dịch vụ
            </button>
          </div>
        )}

        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id}
              className={'bg-white rounded-2xl p-4 border ' + (t.is_recurring ? 'border-sky-300' : 'border-gray-100')}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={'text-sm font-bold flex-1 ' + (t.is_recurring ? 'text-sky-800' : 'text-gray-900')}>{t.name}</h2>
                <span className={'text-xs px-2 py-0.5 rounded-full ' +
                  (t.is_recurring ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-600')}>
                  {t.is_recurring ? 'Định kỳ hàng tháng' : 'Theo hồ sơ'}
                </span>
                {canEdit && !t.is_recurring && (
                  <button onClick={() => removeTemplate(t)} className="text-xs text-red-400 hover:text-red-600">Ẩn</button>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-0.5">
                {t.is_recurring
                  ? 'Tự áp cho mọi công ty đã tick “Có sử dụng DV HCNS” · đang áp ' + t.usageCount + ' công ty'
                  : 'Chọn được khi thêm dịch vụ vào hồ sơ Thời điểm / Vãng lai · đang dùng ở ' + t.usageCount + ' dịch vụ'}
              </p>

              <div className="mt-2 space-y-1">
                {t.tasks.length === 0 && <p className="text-xs text-gray-400">Chưa có công việc nào.</p>}
                {t.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-sm text-gray-700 group">
                    <span className="text-gray-300">☐</span>
                    <span className="flex-1">{task.name}</span>
                    {canEdit && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button onClick={() => renameTask(task.id, task.name)} className="text-xs text-gray-400 hover:text-gray-700">Sửa</button>
                        <button onClick={() => removeTask(task.id, task.name, t.usageCount)} className="text-xs text-red-300 hover:text-red-600">Xoá</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="flex gap-2 mt-3">
                  <input value={newTask[t.id] || ''} onChange={e => setNewTask(p => ({ ...p, [t.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTask(t.id)}
                    placeholder="Thêm công việc..." className={inputCls + ' text-xs py-1.5'} />
                  <button onClick={() => addTask(t.id)} disabled={!(newTask[t.id] || '').trim()}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 whitespace-nowrap disabled:opacity-40">
                    Thêm
                  </button>
                </div>
              )}

              {t.is_recurring && t.usageCount > 0 && (
                <p className="text-xs text-sky-700 mt-2">
                  Sửa ở đây là {t.usageCount} công ty cập nhật theo ngay, không phải chỉnh từng công ty.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
