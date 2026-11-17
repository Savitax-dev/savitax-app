// Bản rời — Cài đặt: thương hiệu đơn vị dùng app (logo, tên…), ngày nghỉ lễ, sao lưu / khôi phục, bản quyền.
import { useState } from 'react'
import AppShell, { PHIEN_BAN } from './AppShell'
import { useKho, datCaiDat, taoSaoLuu, khoiPhuc, NGAY_LE_MAC_DINH } from '../kho'
import LOGO_SAVITAX from '../../public/logo-savitax.png'

const o = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#8B1A1A] focus:outline-none'
const the = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'
const nut = 'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:border-[#8B1A1A] hover:text-[#8B1A1A] cursor-pointer'

export default function CaiDat() {
  const { caiDat, congTy } = useKho()
  const [th, setTh] = useState({ tenDonVi: caiDat.tenDonVi, mstDonVi: caiDat.mstDonVi, dcDonVi: caiDat.dcDonVi })
  const [ngayLe, setNgayLe] = useState(String(caiDat.ngayLe || '').trim() || NGAY_LE_MAC_DINH)
  const [bao, setBao] = useState('')

  const doiLogo = f => {
    if (!f) return
    if (f.size > 500 * 1024) { setBao('Logo nên dưới 500 KB.'); return }
    const r = new FileReader(); r.onload = () => { datCaiDat({ logo: r.result }); setBao('Đã đổi logo.') }; r.readAsDataURL(f)
  }
  const saoLuu = async () => {
    const blob = new Blob([JSON.stringify(await taoSaoLuu(), null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Savitax-HoSo-sao-luu-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    await datCaiDat({ saoLuuLuc: new Date().toISOString() })
    setBao('Đã tải file sao lưu về thư mục Downloads.')
  }
  const khoiPhucFile = async f => {
    if (!f) return
    try {
      const j = JSON.parse(await f.text())
      const hsct = j.hoSoChungTu ? ` và ${j.hoSoChungTu.records?.length ?? 0} hồ sơ chứng từ` : ''
      if (!confirm(`Khôi phục ${j.congTy?.length ?? 0} công ty${hsct} từ "${f.name}"? Dữ liệu hiện tại trên máy này sẽ bị thay.`)) return
      await khoiPhuc(j); setBao('Đã khôi phục. Thư mục đã trỏ không đi theo file sao lưu — máy mới phải trỏ lại.')
    } catch (e) { setBao('Không khôi phục được: ' + (e?.message || e)) }
  }

  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <div className="mb-3 flex items-center gap-3"><span className="text-2xl">⚙️</span><h1 className="text-xl font-bold text-gray-800">Cài đặt</h1></div>
        {bao && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{bao}</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className={the}>
              <h2 className="font-bold text-gray-800">Thương hiệu đơn vị dùng app</h2>
              <p className="mb-3 text-xs text-gray-500">Hiện ở góc trên menu. Để trống là Savitax.</p>
              <div className="mb-3 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white p-1">
                  <img src={caiDat.logo || LOGO_SAVITAX} alt="Logo" className="max-h-full max-w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={nut}>🖼️ Chọn logo (PNG / JPG)<input type="file" accept="image/*" hidden onChange={e => { doiLogo(e.target.files[0]); e.target.value = '' }} /></label>
                  {caiDat.logo && <button type="button" className={nut} onClick={() => datCaiDat({ logo: '' })}>Dùng lại logo Savitax</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-gray-500">Tên đơn vị<input className={o} value={th.tenDonVi} placeholder="SAVITAX" onChange={e => setTh({ ...th, tenDonVi: e.target.value })} /></label>
                <label className="text-xs text-gray-500">MST<input className={o} value={th.mstDonVi} onChange={e => setTh({ ...th, mstDonVi: e.target.value })} /></label>
                <label className="text-xs text-gray-500">Địa chỉ<input className={o} value={th.dcDonVi} onChange={e => setTh({ ...th, dcDonVi: e.target.value })} /></label>
              </div>
              <button type="button" className="mt-3 rounded-xl bg-[#8B1A1A] px-4 py-2 text-sm font-semibold text-white" onClick={() => { datCaiDat(th); setBao('Đã lưu thương hiệu.') }}>Lưu thương hiệu</button>
            </div>
            <div className={the}>
              <h2 className="font-bold text-gray-800">Ngày nghỉ lễ</h2>
              <p className="mb-2 text-xs text-gray-500">Mỗi dòng một ngày dạng <code>2026-09-02</code>, chữ sau ngày là ghi chú. Hạn nộp tờ khai rơi vào thứ Bảy, Chủ nhật
                hoặc ngày nghỉ ở đây thì đẩy sang ngày làm việc kế tiếp. Danh sách có sẵn các ngày lễ cố định — <b>nhớ thêm Tết Nguyên đán, Giỗ Tổ, ngày nghỉ bù</b> của từng năm.</p>
              <textarea className={o + ' font-mono'} rows={8} value={ngayLe} onChange={e => setNgayLe(e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={nut} onClick={() => { datCaiDat({ ngayLe }); setBao('Đã lưu ngày nghỉ lễ. Màn Soát kỳ tính lại hạn nộp khi bấm ↻ Tải lại thư mục hoặc mở lại app.') }}>Lưu ngày nghỉ</button>
                <button type="button" className={nut} onClick={() => setNgayLe(NGAY_LE_MAC_DINH)}>Về danh sách mặc định</button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className={the}>
              <h2 className="font-bold text-gray-800">Dữ liệu trên máy này</h2>
              <p className="mb-3 text-sm text-gray-600">{congTy.length} công ty. Sao lưu ra file JSON để chuyển sang máy khác hoặc phòng khi xoá dữ liệu trình duyệt.
                {caiDat.saoLuuLuc && <> Lần sao lưu gần nhất: <b>{new Date(caiDat.saoLuuLuc).toLocaleString('vi-VN')}</b>.</>}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saoLuu} className="rounded-xl bg-[#8B1A1A] px-4 py-2 text-sm font-semibold text-white">💾 Sao lưu (JSON)</button>
                <label className={nut}>Khôi phục từ file<input type="file" accept=".json" hidden onChange={e => { khoiPhucFile(e.target.files[0]); e.target.value = '' }} /></label>
              </div>
              <p className="mt-2 text-xs text-gray-400">Thư mục đã trỏ không đi theo file sao lưu (trình duyệt không cho) — sang máy mới phải trỏ lại.</p>
            </div>
            <div className={the}>
              <h2 className="font-bold text-gray-800">Bản quyền</h2>
              <p className="mt-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">🔒 <b>Bản quyền © Savitax</b> — Soát xét báo cáo · Rủi ro thuế · Hồ sơ chứng từ, phiên bản {PHIEN_BAN}. Đơn vị dùng app đổi được logo, tên, địa chỉ của mình; dòng bản quyền không đổi.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
