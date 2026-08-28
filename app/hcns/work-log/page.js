'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { loadPermissionData, can } from '@/lib/permissions'
import AppShell from '@/components/AppShell'

const TYPES = [
  { key: '',       label: 'Tất cả' },
  { key: 'task',   label: '✅ Hoàn thành việc' },
  { key: 'status', label: '🔄 Đổi trạng thái' },
  { key: 'debt',   label: '💰 Thu tiền' },
  { key: 'fee',    label: '✏️ Cập nhật phí' },
]
const TYPE_STYLE = {
  task:   'bg-emerald-50 text-emerald-700',
  status: 'bg-blue-50 text-blue-700',
  debt:   'bg-amber-50 text-amber-800',
  fee:    'bg-violet-50 text-violet-700',
}

export default function HcnsWorkLogPage() {
  const router = useRouter()
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [fStaff, setFStaff] = useState('')
  const [fType, setFType] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  const monthOpts = []
  { let y = now.getFullYear(), m = now.getMonth() + 1
    for (let i = 0; i < 18; i++) { monthOpts.push({ y, m, label: 'T' + m + '/' + y }); m--; if (m === 0) { m = 12; y-- } } }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      const [{ data: me }, myPerm] = await Promise.all([
        supabase.from('staff').select('role').eq('id', sd.session.user.id).single(),
        fetch('/api/admin/me').then(r => r.json()).catch(() => ({})),
      ])
      const perm = await loadPermissionData()
      const roles = myPerm?.roles?.length ? myPerm.roles : [me?.role].filter(Boolean)
      if (!can(roles, 'view_hcns', perm)) { router.push('/dashboard'); return }
      setAllowed(true)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!allowed) return
    const load = async () => {
      const qs = '?year=' + selYear + '&month=' + selMonth +
        (fStaff ? '&staffId=' + fStaff : '') + (fType ? '&type=' + fType : '')
      const r = await fetch('/api/admin/hcns/work-log' + qs).then(x => x.json()).catch(() => null)
      setRes(r && !r.error ? r : null)
    }
    load()
  }, [allowed, selYear, selMonth, fStaff, fType])

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-64"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>
  if (!allowed) return null

  const c = res?.counts || { task: 0, status: 0, debt: 0, fee: 0 }

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nhật ký làm việc HCNS</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Hoạt động của phòng HCNS — dùng làm bằng chứng đối chiếu
              {res?.scope === 'own' && <span className="ml-1 text-amber-600">· chỉ hiện hoạt động của bạn</span>}
            </p>
          </div>
          <select value={selYear + '-' + selMonth}
            onChange={e => { const [y, m] = e.target.value.split('-'); setSelYear(Number(y)); setSelMonth(Number(m)) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            {monthOpts.map(o => <option key={o.label} value={o.y + '-' + o.m}>{o.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[['✅ Hoàn thành việc', c.task], ['🔄 Đổi trạng thái', c.status],
            ['💰 Thu tiền', c.debt], ['✏️ Cập nhật phí', c.fee]].map(([l, v]) => (
            <div key={l} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-500">{l}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{v}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <select value={fStaff} onChange={e => setFStaff(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px]">
            <option value="">Tất cả nhân viên</option>
            {(res?.staff || []).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {TYPES.map(t => (
              <button key={t.key} onClick={() => setFType(t.key)}
                className={'px-3 py-1.5 rounded-lg text-sm border ' +
                  (fType === t.key ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]' : 'bg-white text-gray-600 border-gray-200')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {!res?.data?.length && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">Chưa có hoạt động nào trong tháng này</p>
              <p className="text-xs text-gray-400 mt-1">Thử chọn tháng khác hoặc bỏ bớt bộ lọc</p>
            </div>
          )}
          {(res?.data || []).map((r, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ' + (TYPE_STYLE[r.type] || 'bg-gray-100')}>
                {TYPES.find(t => t.key === r.type)?.label || r.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{r.client}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.detail}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-700">{r.staffName || '—'}</p>
                <p className="text-xs text-gray-400">{new Date(r.at).toLocaleString('vi-VN')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
