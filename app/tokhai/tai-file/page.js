'use client'
// Tải file tờ khai + thông báo về thư mục từng công ty — Phân hệ Tờ khai, GĐ 6.
//
// TÁCH RIÊNG khỏi màn Đồng bộ theo lô vì hai việc có nhịp khác nhau: đồng bộ trạng thái chạy nhiều
// lần trong kỳ cho cả lô; tải file chạy ít, thường cho MỘT công ty nhiều kỳ, và nặng hơn nhiều lần.
//
// Nhân viên trỏ thẳng vào thư mục CỦA TỪNG CÔNG TY, ví dụ:
//   G:\Shared drives\12. SAVITAX - PHÒNG NGHIỆP VỤ GRAND\Huỳnh Thị Mỹ Lệ\3.THỊNH PHÁT
// Chọn một lần, trình duyệt nhớ luôn. App tự đi tiếp xuống '2. HỒ SƠ KẾ TOÁN\Năm <năm>\7. BỘ BÁO CÁO'.
//
// CỐ Ý KHÔNG DÒ THƯ MỤC TỰ ĐỘNG (anh chốt 28/09): một nhân viên không phụ trách nhiều công ty tới
// mức phải dò, mà dò thì vừa chậm vừa có ngày khớp nhầm công ty. Người chọn thì không bao giờ nhầm.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TabToKhai from '@/components/TabToKhai'
import NhacHanNop from '@/components/NhacHanNop'
import { OTong } from '@/components/tokhaiUI'
import { kiemTraTienIch } from '@/lib/portalBridge'
import { chayTaiFile } from '@/lib/tokhaiTaiFileClient'
import {
  coHoTro, chonThuMucCongTy, layThuMucCongTy, quenThuMucCongTy, soatThuMucCongTy,
} from '@/lib/tokhaiLuuDia'

const ngayChu = d => d.toISOString().slice(0, 10)

// Cổng tra theo NGÀY TIẾP NHẬN hồ sơ, không tra theo kỳ tính thuế. Tờ khai quý 1 nộp vào tháng 4,
// nên mốc nhanh phải tính theo ngày nộp — chọn sai khoảng là tra ra rỗng mà không hiểu vì sao.
function cacMocNhanh() {
  const nay = new Date()
  const n = nay.getFullYear()
  return [
    { nhan: '3 tháng gần đây', tu: new Date(nay.getTime() - 89 * 864e5), den: nay },
    { nhan: '6 tháng gần đây', tu: new Date(nay.getTime() - 179 * 864e5), den: nay },
    { nhan: `Từ đầu năm ${n}`, tu: new Date(Date.UTC(n, 0, 1)), den: nay },
    { nhan: `Cả năm ${n - 1}`, tu: new Date(Date.UTC(n - 1, 0, 1)), den: new Date(Date.UTC(n - 1, 11, 31)) },
  ]
}

export default function TrangTaiFile() {
  const router = useRouter()
  const [dsCty, setDsCty] = useState([])
  const [chon, setChon] = useState({})
  const [phong, setPhong] = useState('')
  const [nhanVien, setNhanVien] = useState('')
  const [tienIch, setTienIch] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [hoTro, setHoTro] = useState(true)

  // clientId → { tay, ten, trangThai, soat }
  const [thuMucCty, setThuMucCty] = useState({})

  const homNay = ngayChu(new Date())
  const [tuNgay, setTuNgay] = useState(ngayChu(new Date(Date.now() - 89 * 864e5)))
  const [denNgay, setDenNgay] = useState(homNay)
  const [taiLai, setTaiLai] = useState(false)

  const [dangChay, setDangChay] = useState(false)
  const [viTri, setViTri] = useState(0)
  const [ketQua, setKetQua] = useState({})
  const [tienDo, setTienDo] = useState('')
  const [dsFileMoi, setDsFileMoi] = useState([])
  const [captcha, setCaptcha] = useState(null)
  const [maGo, setMaGo] = useState('')
  const dungLai = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
    kiemTraTienIch().then(setTienIch)
    setHoTro(coHoTro())
  }, [router])

  useEffect(() => {
    fetch('/api/admin/tokhai/overview')
      .then(r => r.json())
      .then(j => {
        if (j.error) { setLoi(j.error); return }
        const ds = (j.congTy || []).filter(c => c.trangThaiTaiKhoan !== 'not_connected')
        setDsCty(ds)
        const cacPhong = [...new Set(ds.map(c => c.roomId).filter(Boolean))]
        if (cacPhong.length === 1) setPhong(cacPhong[0])
      })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [])

  const dsHien = dsCty.filter(c =>
    (!phong || c.roomId === phong) && (!nhanVien || c.assignedTo === nhanVien))
  const cacPhong = [...new Map(dsCty.filter(c => c.roomId).map(c => [c.roomId, c.phong])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  const cacNV = [...new Map(dsCty.filter(c => (!phong || c.roomId === phong) && c.assignedTo)
    .map(c => [c.assignedTo, c.nhanVien])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))

  const dsChon = dsHien.filter(c => chon[c.id])
  const thieuMaKH = dsChon.filter(c => !c.maKH)
  const soCuaSo = Math.max(1, Math.ceil((new Date(denNgay) - new Date(tuNgay)) / 864e5 / 30))
  const sanSangCuaCty = c => thuMucCty[c.id]?.trangThai === 'san_sang' && thuMucCty[c.id]?.soat?.ok
  const chuaCoThuMuc = dsChon.filter(c => !sanSangCuaCty(c))

  // Đọc lại thư mục đã nhớ của các công ty đang hiện — chỉ đọc IndexedDB dưới máy, không gọi mạng.
  const dsHienId = dsHien.map(c => c.id).join(',')
  useEffect(() => {
    if (!hoTro || !dsHienId) return
    let huy = false
    ;(async () => {
      const ra = {}
      for (const id of dsHienId.split(',')) {
        if (huy) return
        const kq = await layThuMucCongTy(id)
        if (kq.trangThai === 'chua_chon') continue
        ra[id] = { ...kq, soat: kq.trangThai === 'san_sang' ? await soatThuMucCongTy(kq.tay) : null }
      }
      if (!huy && Object.keys(ra).length) setThuMucCty(p => ({ ...ra, ...p }))
    })()
    return () => { huy = true }
  }, [dsHienId, hoTro])

  const capNhatThuMuc = useCallback(async (clientId, { xinQuyen = false } = {}) => {
    const kq = await layThuMucCongTy(clientId, { xinQuyen })
    const soat = kq.trangThai === 'san_sang' ? await soatThuMucCongTy(kq.tay) : null
    setThuMucCty(p => ({ ...p, [clientId]: { ...kq, soat } }))
    return { ...kq, soat }
  }, [])

  async function bamChonThuMuc(cty) {
    try {
      await chonThuMucCongTy(cty.id)
      const kq = await capNhatThuMuc(cty.id)
      // Trỏ nhầm thì quên luôn, đừng để nhân viên tưởng đã xong.
      if (!kq.soat?.ok) await quenThuMucCongTy(cty.id)
    } catch (e) {
      if (e?.name !== 'AbortError') setLoi(e.message)
    }
  }

  const hoiCaptcha = ({ anhCaptcha, nhan }) => new Promise(giaiQuyet => {
    setMaGo('')
    setCaptcha({ anh: anhCaptcha, nhan, giaiQuyet })
  })

  const traLoiCaptcha = (ma) => {
    captcha?.giaiQuyet(ma)
    setCaptcha(null)
    setMaGo('')
  }

  async function chay() {
    dungLai.current = false
    setDangChay(true); setKetQua({}); setViTri(0); setDsFileMoi([])

    for (let i = 0; i < dsChon.length; i++) {
      if (dungLai.current) break
      const c = dsChon[i]
      setViTri(i)
      setTienDo(`Đang mở phiên cho ${c.ten}…`)

      const kq = await chayTaiFile({
        clientId: c.id, tuNgay, denNgay, taiLai, tayCty: thuMucCty[c.id]?.tay,
        onCaptcha: hoiCaptcha,
        onTienDo: setTienDo,
        onFile: ({ ten }) => setDsFileMoi(p => [...ten.map(t => ({ ten: t, cty: c.ten })), ...p].slice(0, 200)),
      })
      setKetQua(p => ({ ...p, [c.id]: kq }))

      // Cổng chặn vì gọi dày thì DỪNG CẢ LÔ — chạy tiếp chỉ kéo dài thời gian bị chặn.
      if (kq.ket_qua === 'loi' && /429|quá dày/i.test(kq.moTa || '')) {
        setTienDo('⚠ Cổng thuế đang chặn vì gọi quá dày — đã DỪNG cả lô. Nghỉ 10–15 phút rồi chạy lại, và chia nhỏ khoảng ngày.')
        break
      }

      if (i < dsChon.length - 1 && !dungLai.current) {
        setTienDo('Nghỉ 8 giây trước công ty kế tiếp…')
        await new Promise(r => setTimeout(r, 8000))
      }
    }

    setDangChay(false); setTienDo(''); setCaptcha(null)
  }

  const tongFile = Object.values(ketQua).reduce((t, k) => t + (k.dsFile?.length || 0), 0)
  const tongLoiGhi = Object.values(ketQua).reduce((t, k) => t + (k.loiGhi?.length || 0), 0)
  const dem = tt => Object.values(ketQua).filter(k => k.ket_qua === tt).length

  // Ô "Thư mục" của một dòng công ty.
  function OThuMuc({ c }) {
    const tm = thuMucCty[c.id]
    const nut = (nhan, onClick, dam) => (
      <button disabled={dangChay} onClick={onClick}
        className={'px-2 py-1 rounded-lg text-[11px] ' + (dam
          ? 'bg-[#8B1A1A] text-white font-medium'
          : 'border border-gray-200 text-gray-600 hover:bg-gray-50')}>
        {nhan}
      </button>
    )

    if (!tm || tm.trangThai === 'chua_chon') {
      return (
        <div className="space-y-1">
          <p className="text-gray-400">chưa chọn</p>
          {nut('Chọn thư mục', () => bamChonThuMuc(c), true)}
        </div>
      )
    }
    if (tm.trangThai === 'can_xin_lai' || tm.trangThai === 'bi_tu_choi') {
      return (
        <div className="space-y-1">
          <p className="font-mono text-gray-700 break-all leading-tight">{tm.ten}</p>
          <p className="text-amber-700">cần cấp lại quyền ghi</p>
          {nut('Cấp lại quyền', () => capNhatThuMuc(c.id, { xinQuyen: true }), true)}
        </div>
      )
    }
    if (!tm.soat?.ok) {
      return (
        <div className="space-y-1">
          <p className="font-mono text-gray-700 break-all leading-tight">{tm.ten}</p>
          <p className="text-amber-700 leading-tight">{tm.soat?.loi}</p>
          {nut('Chọn lại', () => bamChonThuMuc(c))}
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <p className="text-green-700 font-mono break-all leading-tight">✓ {tm.ten}</p>
        <p className="text-[11px] text-gray-400">
          {tm.soat.cacNam?.length ? `có ${tm.soat.cacNam.map(n => 'Năm ' + n).join(', ')}` : 'chưa có thư mục năm nào'}
        </p>
        {nut('Đổi', () => bamChonThuMuc(c))}
      </div>
    )
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />

        <h1 className="text-xl font-bold text-gray-900 mb-1">Tải file về thư mục</h1>
        <p className="text-sm text-gray-500 mb-4">
          Tải tờ khai và thông báo từ cổng Dịch vụ công, xếp thẳng vào thư mục từng công ty trên ổ
          chung, kèm bản PDF app tự dựng.
        </p>

        {!tienIch?.co && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <b>Chưa có tiện ích Chrome</b> — cần tiện ích <b>Savitax — Cầu nối cổng thuế</b> để gọi cổng thuế.
          </div>
        )}
        {!hoTro && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            Trình duyệt này không ghi được vào thư mục. Dùng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính.
          </div>
        )}
        {loi && <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <span className="text-sm text-gray-500">Phòng</span>
            <select value={phong} disabled={dangChay}
              onChange={e => { setPhong(e.target.value); setNhanVien(''); setChon({}) }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">— Chọn phòng —</option>
              {cacPhong.map(([id, ten]) => <option key={id} value={id}>{ten}</option>)}
            </select>

            <span className="text-sm text-gray-500 ml-2">Nhân viên</span>
            <select value={nhanVien} disabled={dangChay || !phong}
              onChange={e => { setNhanVien(e.target.value); setChon({}) }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">— Cả phòng —</option>
              {cacNV.map(([id, ten]) => <option key={id} value={id}>{ten}</option>)}
            </select>

            {phong && (
              <button disabled={dangChay}
                onClick={() => setChon(Object.fromEntries(dsHien.map(c => [c.id, true])))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                Chọn hết {dsHien.length} công ty
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm text-gray-500">Ngày cổng tiếp nhận hồ sơ</span>
            {cacMocNhanh().map(m => (
              <button key={m.nhan} disabled={dangChay}
                onClick={() => { setTuNgay(ngayChu(m.tu)); setDenNgay(ngayChu(m.den)) }}
                className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                {m.nhan}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">Từ</span>
            <input type="date" value={tuNgay} max={denNgay} onChange={e => setTuNgay(e.target.value)}
              disabled={dangChay} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <span className="text-sm text-gray-500">đến</span>
            <input type="date" value={denNgay} min={tuNgay} max={homNay} onChange={e => setDenNgay(e.target.value)}
              disabled={dangChay} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />

            <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-2">
              <input type="checkbox" checked={taiLai} disabled={dangChay}
                onChange={e => setTaiLai(e.target.checked)} />
              Tải lại cả hồ sơ đã có file
            </label>

            <div className="flex-1" />
            {!dangChay ? (
              <button onClick={chay}
                disabled={!dsChon.length || !tienIch?.co || thieuMaKH.length > 0 || chuaCoThuMuc.length > 0}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40 shadow-sm">
                Bắt đầu tải file
              </button>
            ) : (
              <button onClick={() => { dungLai.current = true; setCaptcha(null); captcha?.giaiQuyet(null) }}
                className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium shadow-sm">
                Dừng sau công ty này
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Đã chọn <b>{dsChon.length}</b>/{dsHien.length} công ty · cổng chỉ cho tra mỗi lần 30 ngày nên
            khoảng này chia thành <b>{soCuaSo}</b> lượt tra · cần gõ khoảng <b>{dsChon.length * 2}</b> mã captcha.
            {soCuaSo > 6 && (
              <span className="text-amber-700"> {' '}Khoảng ngày dài thì chạy lâu — nên chia nhỏ để đỡ bị cổng chặn.</span>
            )}
          </p>

          {chuaCoThuMuc.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              <b>{chuaCoThuMuc.length}</b> công ty chưa có thư mục — bấm <b>Chọn thư mục</b> ở cột Thư mục
              rồi trỏ vào thư mục công ty trên ổ chung (ví dụ <span className="font-mono">3.THỊNH PHÁT</span>).
              Chọn một lần, lần sau app nhớ.
            </p>
          )}

          {thieuMaKH.length > 0 && (
            <p className="text-xs text-red-700 mt-1.5">
              {thieuMaKH.length} công ty chưa có <b>Mã khách hàng</b> nên không đặt được tên file:
              {' '}{thieuMaKH.slice(0, 5).map(c => c.ten).join(', ')}{thieuMaKH.length > 5 ? '…' : ''}.
            </p>
          )}

          {dangChay && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: (dsChon.length ? (viTri / dsChon.length) * 100 : 0) + '%' }} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">{viTri + 1}/{dsChon.length}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">{tienDo}</p>
            </div>
          )}
        </div>

        {captcha && (
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/60 p-4 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              {dsChon[viTri]?.ten} — mã captcha {captcha.nhan}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <img src={captcha.anh} alt="Mã captcha"
                className="bg-white rounded-lg border border-blue-200" style={{ height: 80 }} />
              <input value={maGo} autoFocus onChange={e => setMaGo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && maGo.trim() && traLoiCaptcha(maGo.trim())}
                placeholder="Gõ mã rồi Enter"
                className="px-3 py-2 border border-blue-300 rounded-xl text-base font-mono w-52" />
              <button onClick={() => maGo.trim() && traLoiCaptcha(maGo.trim())}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium">Xác nhận</button>
              <button onClick={() => traLoiCaptcha(null)}
                className="px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600">
                Bỏ qua công ty này
              </button>
              <span className="text-xs text-gray-500">Dễ nhầm: số 0 ↔ chữ o, số 1 ↔ chữ l</span>
            </div>
          </div>
        )}

        {Object.keys(ketQua).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <OTong mau="xanhLa" so={dem('xong')} nhan="Công ty xong" />
            <OTong mau="do" so={dem('loi')} nhan="Lỗi" />
            <OTong mau="xanhDuong" so={tongFile} nhan="File đã ghi" phu="gồm cả bản PDF" />
            <OTong mau="xam" so={tongLoiGhi} nhan="File ghi không được" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {dangTai && <p className="text-sm text-gray-400 py-10 text-center">Đang tải…</p>}
            {!dangTai && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 text-gray-500">
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox" disabled={dangChay}
                        checked={dsHien.length > 0 && dsChon.length === dsHien.length}
                        onChange={e => setChon(e.target.checked
                          ? Object.fromEntries(dsHien.map(c => [c.id, true])) : {})} />
                    </th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Công ty</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide w-64">Thư mục</th>
                    <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {dsHien.map(c => {
                    const kq = ketQua[c.id]
                    const dangLam = dangChay && dsChon[viTri]?.id === c.id
                    return (
                      <tr key={c.id} className={'border-b border-gray-100 odd:bg-white even:bg-slate-50/60 '
                        + (dangLam ? 'ring-2 ring-inset ring-blue-300' : '')}>
                        <td className="px-3 py-2.5 align-top">
                          <input type="checkbox" disabled={dangChay} checked={!!chon[c.id]}
                            onChange={e => setChon(p => ({ ...p, [c.id]: e.target.checked }))} />
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <p className="font-medium text-gray-900 leading-tight">{c.ten}</p>
                          <p className="text-xs text-gray-400">
                            {c.maKH || <span className="text-red-600">chưa có Mã KH</span>} · MST {c.mst || '—'}
                          </p>
                        </td>
                        <td className="px-2 py-2.5 align-top text-xs">
                          <OThuMuc c={c} />
                        </td>
                        <td className="px-2 py-2.5 align-top text-xs">
                          {dangLam && <span className="text-blue-700 font-medium">đang chạy…</span>}
                          {!dangLam && kq?.ket_qua === 'xong' && (
                            <span className="text-green-700">
                              ✓ {kq.dsFile?.length || 0} file
                              {kq.soBoQua ? ` · bỏ qua ${kq.soBoQua} hồ sơ đã có` : ''}
                            </span>
                          )}
                          {!dangLam && kq?.ket_qua === 'loi' && <span className="text-red-700">{kq.moTa}</span>}
                          {!dangLam && kq?.ket_qua === 'bo_qua' && <span className="text-gray-400">bỏ qua</span>}
                          {!dangLam && kq?.loiGhi?.length > 0 && (
                            <span className="block text-amber-700 mt-0.5">{kq.loiGhi[0]}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {!dangTai && !dsHien.length && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                {!phong
                  ? 'Chọn phòng ở trên để hiện danh sách công ty.'
                  : 'Không có công ty nào đã nối tài khoản trong phạm vi này.'}
              </p>
            )}
          </div>

          {/* File vừa ghi — để nhân viên thấy việc đang chạy thật, không phải treo */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                File vừa ghi {dsFileMoi.length > 0 && `(${dsFileMoi.length})`}
              </p>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {dsFileMoi.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-gray-400">Chưa ghi file nào.</p>
              )}
              {dsFileMoi.map((f, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-gray-50 odd:bg-white even:bg-slate-50/50">
                  <p className="text-xs font-mono text-gray-700 break-all leading-tight">{f.ten}</p>
                  <p className="text-[11px] text-gray-400 truncate">{f.cty}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
