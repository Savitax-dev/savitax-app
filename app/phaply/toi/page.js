'use client'
// Phân hệ Pháp lý — Thông tin cá nhân pháp lý của người đăng nhập: in vào phần "người được ủy quyền" của Giấy ủy quyền nộp
// Phòng ĐKKD ở mọi hồ sơ người này phụ trách. Mỗi người chỉ thấy / sửa thông tin của mình (máy chủ lọc theo phiên).
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { PageHead, btnPrimary, btnGhost, useToast, api, ThanhPhapLy } from '../_ui'
import { NguoiForm, NOI_CAP_CCCD } from '../_nguoi'

export default function ThongTinCaNhan() {
  const router = useRouter()
  const [goc, setGoc] = useState(null)
  const [p, setP] = useState(null)
  const [dang, setDang] = useState(false)
  const [toastNode, toast] = useToast()
  const load = useCallback(async () => {
    const r = await api('/api/admin/phaply/toi')
    if (r.status === 401) return router.push('/login')
    if (r.status === 403) return router.push('/dashboard')
    if (!r.ok) return toast(r.data.error || 'Không tải được', true)
    const v = r.data.nguoi || { ...r.data.goi_y, loai_giay_to: 'Căn cước công dân', quoc_tich: 'Việt Nam', dan_toc: 'Kinh', noi_cap: NOI_CAP_CCCD }
    setGoc(r.data.nguoi ? v : null); setP(v)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (async () => { const { data } = await createClient().auth.getSession(); if (!data.session) return router.push('/login'); load() })() }, [load, router])
  const doi = p && JSON.stringify(p) !== JSON.stringify(goc)
  const luu = async () => {
    setDang(true)
    const r = await api('/api/admin/phaply/toi', { method: 'PUT', body: p })
    setDang(false)
    if (!r.ok) return toast(r.data.error || 'Không lưu được', true)
    toast('Đã lưu thông tin cá nhân'); load()
  }
  return (
    <AppShell>
      <div className="pl-ui">
        <div className="px-4 md:px-8 py-5 space-y-4">
          <PageHead title="Thông tin cá nhân pháp lý" sub="In vào phần người được ủy quyền (Giấy ủy quyền nộp Phòng ĐKKD) ở các hồ sơ bạn phụ trách" />
          <ThanhPhapLy dang="/phaply/toi" />
          {!p ? <div className="text-sm text-gray-400">Đang tải…</div> : (
            <div className="p-panel">
              <div className="p-panel-h">Thông tin của tôi{!goc && <span className="ml-2 text-xs font-normal text-amber-800">chưa lưu lần nào</span>}</div>
              <div className="p-4"><NguoiForm value={p} onChange={setP} /></div>
              <div className="px-4 pb-4 flex justify-end gap-2">
                {doi && goc && <button className={btnGhost} onClick={() => setP(goc)}>Bỏ thay đổi</button>}
                <button className={btnPrimary} disabled={!doi || dang || !p.ho_ten?.trim()} onClick={luu}>Lưu</button>
              </div>
            </div>
          )}
        </div>
        {toastNode}
      </div>
    </AppShell>
  )
}
