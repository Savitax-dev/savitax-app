// Bản rời — Danh sách công ty (dùng chung cho mọi phân hệ): thêm / sửa / xoá, tra MST, trỏ thư mục, nhập / xuất Excel.
import { useEffect, useState } from 'react'
import AppShell, { duongPhanHe } from './AppShell'
import { useKho, luuCongTy, xoaCongTy, kiemCongTy, chuanMst, datCaiDat, layKho } from '../kho'
import { traMst } from './traMst'
import { coHoTro, chonThuMucChinh, layThuMucChinh } from '@/lib/phanTich/khoMay'
import { soExcelMoi, themSheetMang, taiVeExcel } from '@/lib/excelDep'
import { diToi } from '../shim/dieuHuong'

// Bản rời không có phí dịch vụ (anh bỏ tab Tăng trưởng & phí + ô Phí / tháng 15/11/2026)
const TRONG = { maKH: '', ten: '', mst: '', dc: '', kyKhai: 'quy', laHkd: false, batDau: '' }
const MAU_TRA = { ok: 'bg-emerald-50 text-emerald-700', ngung: 'bg-red-50 text-red-700', khong_co: 'bg-red-50 text-red-700', trung: 'bg-amber-50 text-amber-800', loi: 'bg-amber-50 text-amber-800', '': 'bg-gray-50 text-gray-500' }

const COT = ['Mã KH', 'Tên công ty', 'MST', 'Kỳ khai (Quý / Tháng)', 'Hộ kinh doanh (x)', 'Địa chỉ','Bắt đầu hợp đồng (dd/mm/yyyy)']
const boDau = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase().trim()
const ngaySangIso = v => {
  if (v == null || v === '') return null
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10) }
  const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : null
}
const isoSangNgay = s => (s ? s.split('-').reverse().join('/') : '')

function HopCongTy({ cu, dong }) {
  const [f, setF] = useState(() => cu ? { ...TRONG, ...cu, batDau: cu.batDau || '' } : { ...TRONG })
  const [loi, setLoi] = useState([])
  const [tra, setTra] = useState({ loai: '', chu: 'Gõ MST rồi bấm 🔍 (hoặc Enter) — tìm trong danh sách trên máy trước, không có thì tra trên mạng.' })
  const [dangTra, setDangTra] = useState(false)
  const dat = (k, v) => setF(x => ({ ...x, [k]: v }))

  const bamTra = async () => {
    setDangTra(true); setTra({ loai: '', chu: 'Đang tra…' })
    const kq = await traMst(f.mst, cu?.id || null)
    if (kq.ten) setF(x => ({ ...x, ten: kq.ten, dc: kq.dc || x.dc }))
    setTra(kq); setDangTra(false)
  }
  const luu = async () => {
    const c = { ...f, id: cu?.id, maKH: f.maKH.trim().toUpperCase(), ten: f.ten.trim().toUpperCase(), mst: chuanMst(f.mst), dc: f.dc.trim(),
      batDau: f.batDau || null }
    const l = kiemCongTy(c, cu?.id || null)
    if (l.length) { setLoi(l); return }
    const moi = await luuCongTy(c)
    if (!cu) await datCaiDat({ ctyDangLam: moi.id })
    dong(moi)
  }
  const xoa = async () => {
    if (!confirm(`Xoá công ty ${cu.maKH} khỏi danh sách? Thư mục trên ổ chung không bị đụng tới.`)) return
    await xoaCongTy(cu.id)
    if (layKho().caiDat.ctyDangLam === cu.id) await datCaiDat({ ctyDangLam: '' })
    dong()
  }
  useEffect(() => {
    const phim = e => { if (e.key === 'Escape') dong() }
    window.addEventListener('keydown', phim); return () => window.removeEventListener('keydown', phim)
  }, [dong])

  const o = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#8B1A1A] focus:outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 px-4 py-14" onClick={e => e.target === e.currentTarget && dong()}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center bg-gradient-to-r from-[#8B1A1A] to-[#6B1212] px-4 py-3 font-bold text-white">
          {cu ? `Sửa công ty ${cu.maKH}` : '＋ Thêm công ty'}
          <button type="button" onClick={() => dong()} className="ml-auto text-xl leading-none" aria-label="Đóng">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          <label className="text-xs text-gray-500">Mã KH *<input className={o} value={f.maKH} onChange={e => dat('maKH', e.target.value)} placeholder="HONGDUC" autoFocus /></label>
          <div className="text-xs text-gray-500">MST *
            <div className="relative">
              <input className={o + ' pr-11'} value={f.mst} inputMode="numeric" placeholder="10 hoặc 13 số" aria-label="Mã số thuế"
                onChange={e => dat('mst', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bamTra() } }} />
              <button type="button" onClick={bamTra} disabled={dangTra} title="Tra MST: tìm tên, địa chỉ (Enter)"
                className="absolute right-1 top-1/2 flex h-7 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-[#8B1A1A] text-sm text-white hover:bg-[#6B1212] disabled:opacity-60">🔍</button>
            </div>
          </div>
          <p className={'col-span-2 rounded-lg px-3 py-1.5 text-xs ' + (MAU_TRA[tra.loai] || MAU_TRA[''])}>{tra.chu}</p>
          <label className="col-span-2 text-xs text-gray-500">Tên công ty *<input className={o} value={f.ten} onChange={e => dat('ten', e.target.value)} placeholder="CÔNG TY TNHH …" /></label>
          <label className="col-span-2 text-xs text-gray-500">Địa chỉ<input className={o} value={f.dc} onChange={e => dat('dc', e.target.value)} /></label>
          <label className="text-xs text-gray-500">Kỳ khai thuế
            <select className={o} value={f.kyKhai} onChange={e => dat('kyKhai', e.target.value)}><option value="quy">Quý</option><option value="thang">Tháng</option></select></label>
          <label className="text-xs text-gray-500">Bắt đầu hợp đồng<input type="date" className={o} value={f.batDau || ''} onChange={e => dat('batDau', e.target.value)} /></label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!f.laHkd} onChange={e => dat('laHkd', e.target.checked)} /> Hộ kinh doanh</label>
          {loi.length > 0 && <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{loi.map((x, i) => <p key={i}>{x}</p>)}</div>}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={luu} className="rounded-xl bg-[#8B1A1A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B1212]">Lưu</button>
          <button type="button" onClick={() => dong()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold">Huỷ</button>
          {cu && <button type="button" onClick={xoa} className="ml-auto rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-red-700">Xoá công ty</button>}
        </div>
      </div>
    </div>
  )
}

export default function DanhSachCongTy() {
  const { congTy } = useKho()
  const [hop, setHop] = useState(null)         // null | 'moi' | công ty đang sửa
  const [thuMuc, setThuMuc] = useState({})     // id → { trangThai, ten }
  const [bao, setBao] = useState('')
  const hoTro = coHoTro()

  const docThuMuc = async () => {
    const ra = {}
    for (const c of congTy) { try { ra[c.id] = await layThuMucChinh(c.id) } catch { ra[c.id] = { trangThai: 'chua_chon' } } }
    setThuMuc(ra)
  }
  const ids = congTy.map(c => c.id).join(',')
  useEffect(() => { if (hoTro) docThuMuc() }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const tro = async c => {
    try {
      const { tay, laNam } = await chonThuMucChinh(c.id)
      setBao(laNam ? `"${tay.name}" là thư mục NĂM — đã lưu làm năm riêng của ${c.maKH}. Nên trỏ thư mục GỐC của công ty.` : `Đã trỏ ${c.maKH} → "${tay.name}".`)
      docThuMuc()
    } catch (e) { if (e?.name !== 'AbortError') setBao('Không trỏ được: ' + (e?.message || e)) }
  }

  const taiMau = async () => {
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Danh sách công ty', [COT, ['HONGDUC', 'CÔNG TY TNHH MẪU HỒNG ĐỨC', '9999000011', 'Quý', '', 'Số 1 Đường Mẫu, TP. Mẫu', '01/01/2026']],
      { doRong: [12, 42, 14, 14, 12, 40, 16] })
    await taiVeExcel(wb, 'Mau-danh-sach-cong-ty.xlsx')
  }
  const xuat = async () => {
    const wb = await soExcelMoi()
    themSheetMang(wb, 'Danh sách công ty', [COT, ...congTy.map(c => [c.maKH, c.ten, c.mst, c.kyKhai === 'thang' ? 'Tháng' : 'Quý', c.laHkd ? 'x' : '', c.dc || '', isoSangNgay(c.batDau)])],
      { doRong: [12, 42, 14, 14, 12, 40, 16] })
    await taiVeExcel(wb, 'Danh-sach-cong-ty.xlsx')
  }
  const nhap = async file => {
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const hang = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })
      const iDau = hang.findIndex(h => h.some(o => boDau(o) === 'MST'))
      if (iDau < 0) throw new Error('Không thấy hàng tiêu đề có cột "MST". Dùng file mẫu.')
      const dau = hang[iDau].map(boDau)
      const cot = k => dau.findIndex(h => k.some(x => h.startsWith(x)))
      const C = { ma: cot(['MA KH']), ten: cot(['TEN']), mst: cot(['MST']), ky: cot(['KY KHAI']), hkd: cot(['HO KINH DOANH', 'HKD']), dc: cot(['DIA CHI']), bd: cot(['BAT DAU']) }
      let them = 0, sua = 0; const loi = []
      for (const [k, h] of hang.slice(iDau + 1).entries()) {
        const o = i => (i >= 0 ? h[i] : '')
        if (!String(o(C.mst)).trim() && !String(o(C.ten)).trim()) continue
        const mst = chuanMst(o(C.mst))
        const cu = layKho().congTy.find(c => chuanMst(c.mst).replace(/-/g, '') === mst.replace(/-/g, '') || c.maKH === String(o(C.ma)).trim().toUpperCase())
        const c = { ...(cu || {}), maKH: String(o(C.ma)).trim().toUpperCase(), ten: String(o(C.ten)).trim().toUpperCase(), mst,
          kyKhai: boDau(o(C.ky)).startsWith('THANG') ? 'thang' : 'quy', laHkd: !!String(o(C.hkd)).trim(),
          dc: String(o(C.dc)).trim(), batDau: ngaySangIso(o(C.bd)) }
        const l = kiemCongTy(c, cu?.id || null)
        if (l.length) { loi.push(`Dòng ${iDau + k + 2}: ${l.join(' ')}`); continue }
        await luuCongTy(c); cu ? sua++ : them++
      }
      setBao(`Nhập xong: thêm ${them}, cập nhật ${sua}${loi.length ? `, bỏ qua ${loi.length} dòng lỗi — ${loi.slice(0, 5).join(' · ')}${loi.length > 5 ? '…' : ''}` : ''}.`)
    } catch (e) { setBao('Không nhập được: ' + (e?.message || e)) }
  }

  const nut = 'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:border-[#8B1A1A] hover:text-[#8B1A1A] cursor-pointer'
  const nhanTm = t => ({ san_sang: ['Đã trỏ', 'bg-emerald-50 text-emerald-700'], can_xin_lai: ['Cần cho phép lại', 'bg-amber-50 text-amber-700'], bi_tu_choi: ['Bị từ chối', 'bg-red-50 text-red-700'] }[t] || ['Chưa trỏ', 'bg-gray-100 text-gray-500'])

  return (
    <AppShell>
      <div className="w-full p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-2xl">🏢</span><h1 className="text-xl font-bold text-gray-800">Danh sách công ty</h1>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={nut} onClick={taiMau}>⬇ File Excel mẫu</button>
            <label className={nut}>📥 Nhập từ Excel<input type="file" accept=".xlsx,.xls" hidden onChange={e => { nhap(e.target.files[0]); e.target.value = '' }} /></label>
            <button type="button" className={nut} onClick={xuat} disabled={!congTy.length}>📤 Xuất Excel</button>
            <button type="button" onClick={() => setHop('moi')} className="rounded-xl bg-[#8B1A1A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B1212]">＋ Thêm công ty</button>
          </div>
        </div>
        {bao && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{bao} <button type="button" className="ml-2 text-blue-500" onClick={() => setBao('')}>✕</button></p>}
        {!hoTro && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Trình duyệt này không trỏ được thư mục — dùng Chrome hoặc Edge trên máy tính.</p>}

        {!congTy.length ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Chưa có công ty nào. Bấm <b>＋ Thêm công ty</b> (gõ MST rồi 🔍 để app tự điền tên, địa chỉ) hoặc <b>Nhập từ Excel</b> theo file mẫu.
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#8B1A1A] text-left text-white">
                {['Mã KH', 'Tên công ty', 'MST', 'Kỳ khai', 'Loại', 'Thư mục Drive', ''].map((t, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{t}</th>)}
              </tr></thead>
              <tbody>
                {congTy.map((c, i) => {
                  const [nhan, mau] = nhanTm(thuMuc[c.id]?.trangThai)
                  return (
                    <tr key={c.id} className={(i % 2 ? 'bg-gray-50' : 'bg-white') + ' border-t border-gray-100 hover:bg-amber-50'}>
                      <td className="px-3 py-2 font-bold">{c.maKH}</td>
                      <td className="border-l border-gray-100 px-3 py-2">{c.ten}{c.dc && <p className="text-xs text-gray-400">{c.dc}</p>}</td>
                      <td className="border-l border-gray-100 px-3 py-2 tabular-nums">{c.mst}</td>
                      <td className="border-l border-gray-100 px-3 py-2">{c.kyKhai === 'thang' ? 'Tháng' : 'Quý'}</td>
                      <td className="border-l border-gray-100 px-3 py-2">{c.laHkd ? <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">HKD</span> : <span className="text-xs text-gray-500">Doanh nghiệp</span>}</td>
                      <td className="border-l border-gray-100 px-3 py-2">
                        <span className={'rounded px-1.5 py-0.5 text-xs font-semibold ' + mau}>{nhan}</span>
                        {thuMuc[c.id]?.ten && <span className="ml-1 text-xs text-gray-500">📁 {thuMuc[c.id].ten}</span>}
                        {hoTro && <button type="button" onClick={() => tro(c)} className="ml-2 text-xs font-semibold text-[#8B1A1A] hover:underline">{thuMuc[c.id]?.trangThai === 'san_sang' ? 'Trỏ lại' : 'Trỏ thư mục'}</button>}
                      </td>
                      <td className="border-l border-gray-100 px-3 py-2 whitespace-nowrap">
                        <button type="button" onClick={() => setHop(c)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold">Sửa</button>
                        <button type="button" onClick={() => { datCaiDat({ ctyDangLam: c.id }); diToi(duongPhanHe('soat', c.id)) }} className="ml-1 rounded-lg bg-[#8B1A1A] px-2 py-1 text-xs font-semibold text-white">Soát xét →</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {hop && <HopCongTy cu={hop === 'moi' ? null : hop} dong={moi => { setHop(null); if (moi) setBao(`Đã lưu ${moi.maKH}. Bước tiếp: bấm "Trỏ thư mục" để chọn thư mục gốc của công ty.`) }} />}
    </AppShell>
  )
}
