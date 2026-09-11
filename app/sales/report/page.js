'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { buildSalesReport } from '@/lib/salesReport'
import { PeriodFilter, defaultPeriod, inPeriod, periodLabel, StatCard, PageHead, api, fmt, todayVN, isoVN } from '../_ui'

export default function SalesReportPage() {
  const router = useRouter()
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [period, setPeriod] = useState(defaultPeriod)

  useEffect(() => {
    const init = async () => {
      const { data: sd } = await createClient().auth.getSession()
      if (!sd.session) { router.push('/login'); return }
      const r = await api('/api/admin/sales/leads')
      if (r.status === 401) { router.push('/login'); return }
      if (r.status === 403) { router.push('/dashboard'); return }
      if (!r.ok) { setErr(r.data.error || 'Không tải được số liệu'); return }
      setRes(r.data)
    }
    init()
  }, [router])

  const rep = useMemo(() => {
    if (!res) return null
    const staffNames = new Map([...(res.staff || []), ...(res.otherStaff || [])].map(s => [s.id, s.full_name]))
    return buildSalesReport({
      leads: res.leads, channels: res.channels, staffNames,
      inKy: iso => inPeriod(iso, period), dateOf: isoVN, today: todayVN(),
    })
  }, [res, period])

  if (err) return <AppShell><div className="sales-ui p-8 text-sm text-red-600">{err}</div></AppShell>
  if (!rep) return <AppShell><div className="sales-ui flex items-center justify-center"><p className="text-gray-400 text-sm">Đang tải...</p></div></AppShell>

  const t = rep.total
  const pl = periodLabel(period)
  const maxFunnel = Math.max(1, t.leads)
  const funnel = [
    ['Khách tiếp nhận', t.leads, '#4A8FC4'],
    ['Đã báo giá', t.quoted, '#D9922E'],
    ['Đã gửi hợp đồng', t.sent, '#C9A027'],
    ['Chốt hợp đồng', t.signed, '#18704A'],
  ]
  const pctTxt = v => (v == null ? '—' : v + '%')

  return (
    <AppShell>
      <div className="sales-ui">
      <div className="px-4 md:px-8 py-5">
        <div className="mb-4">
          <PageHead title="Báo cáo kinh doanh" sub={<>Tính theo lứa khách <b>tiếp nhận trong {pl}</b> — lứa đó đã đi được tới đâu (lũy kế theo phễu)</>}>
            <PeriodFilter value={period} onChange={setPeriod} />
          </PageHead>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <StatCard label="Khách tiếp nhận" value={t.leads} foot={pl} tone="sky" />
          <StatCard label="Đã báo giá" value={t.quoted} foot={pctTxt(t.quoteRate) + ' số khách'} tone="amb" />
          <StatCard label="Chốt hợp đồng" value={t.signed} foot={'tỷ lệ chuyển đổi ' + pctTxt(t.convRate)} tone="grn" />
          <StatCard label="Không thành" value={t.lost} foot={t.leads ? Math.round(t.lost * 100 / t.leads) + '% số khách' : '—'} tone="red" />
          <StatCard label="Phí đã chốt" value={fmt(t.signedFee)} unit="đ/tháng" foot={t.signed ? 'bình quân ' + fmt(Math.round(t.signedFee / t.signed)) + ' đ/HĐ' : 'chưa có HĐ chốt'} tone="gold" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="s-panel">
            <div className="s-panel-h">Phễu chuyển đổi</div>
            <div className="p-4 space-y-3">
              {funnel.map(([lb, v, c], i) => (
                <div key={lb}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#15283C]">{lb}</span>
                    <span className="num text-[#15283C] font-semibold">{v}{i > 0 && t.leads ? <span className="text-xs text-[#5A6C7E] font-normal"> · {Math.round(v * 100 / t.leads)}%</span> : ''}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#E2EEF8] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: (v * 100 / maxFunnel) + '%', background: c }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#5A6C7E] pt-1">Tỷ lệ chốt trên số đã gửi HĐ: <b className="num">{pctTxt(t.closeRate)}</b></p>
            </div>
          </div>

          <div className="s-panel lg:col-span-2">
            <div className="s-panel-h">Hiệu quả từng kênh truyền thông</div>
            {!rep.channelRows.length ? <p className="text-sm text-gray-400 p-4">Không có khách nào được tiếp nhận trong kỳ này</p> : (
              <div className="overflow-x-auto">
                <table className="s-tbl">
                  <thead>
                    <tr>
                      <th className="l">Kênh</th>
                      <th>Khách</th>
                      <th>Báo giá</th>
                      <th>Gửi HĐ</th>
                      <th>Chốt</th>
                      <th>Chuyển đổi</th>
                      <th>Phí chốt/tháng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rep.channelRows.map(r => (
                      <tr key={r.id}>
                        <td className="l font-medium">{r.name}</td>
                        <td className="num">{r.leads}</td>
                        <td className="num">{r.quoted}</td>
                        <td className="num">{r.sent}</td>
                        <td className="num font-semibold text-emerald-700">{r.signed}</td>
                        <td className="num">{pctTxt(r.convRate)}</td>
                        <td className="num">{fmt(r.signedFee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="s-panel lg:col-span-2">
            <div className="s-panel-h">Theo nhân viên phụ trách
              <span className="block text-xs font-normal text-[#5A6C7E]">Cột “Đang chăm sóc” và “Quá hẹn” là việc đang tồn tới hôm nay, không theo kỳ.</span>
            </div>
            {!rep.staffRows.length ? <p className="text-sm text-gray-400 p-4">Chưa có số liệu</p> : (
              <div className="overflow-x-auto">
                <table className="s-tbl">
                  <thead>
                    <tr>
                      <th className="l">Nhân viên</th>
                      <th>Khách mới</th>
                      <th>Báo giá</th>
                      <th>Chốt</th>
                      <th>Phí chốt/tháng</th>
                      <th>Đang chăm sóc</th>
                      <th>Quá hẹn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rep.staffRows.map(r => (
                      <tr key={r.id}>
                        <td className={'l font-medium ' + (r.id === 'none' ? 'text-orange-700' : '')}>{r.name}</td>
                        <td className="num">{r.leads}</td>
                        <td className="num">{r.quoted}</td>
                        <td className="num font-semibold text-emerald-700">{r.signed}</td>
                        <td className="num">{fmt(r.signedFee)}</td>
                        <td className="num">{r.open}</td>
                        <td className={'num ' + (r.overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>{r.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="s-panel">
            <div className="s-panel-h">Lý do không thành</div>
            {!rep.lostReasons.length ? <p className="text-sm text-gray-400 p-4">Không có khách nào “Không thành” trong kỳ</p> : (
              <div className="p-4 space-y-2">
                {rep.lostReasons.map(r => (
                  <div key={r.reason} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-[#15283C]">{r.reason}</span>
                    <span className="num font-semibold">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  )
}
