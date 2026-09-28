'use client'
// Đồng bộ theo lô — Phân hệ Tờ khai.
//
// Nhân viên gõ captcha liên tục cho nhiều công ty trong một lượt ngồi, thay vì mở từng công ty
// bấm từng nút. Mỗi công ty tốn 2 mã; app tự chuyển sang công ty kế tiếp ngay sau khi xong.
//
// CHẠY TUẦN TỰ, không song song: cổng khoá mỗi tài khoản vào một phiên, và bắn nhiều lượt cùng
// lúc là dính 429 (đã gặp thật 21/09/2026).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TabToKhai from '@/components/TabToKhai'
import NhacHanNop from '@/components/NhacHanNop'
import { OTong, Chip } from '@/components/tokhaiUI'
import { kiemTraTienIch } from '@/lib/portalBridge'
import { chayDongBo } from '@/lib/tokhaiSyncClient'

export default function TrangDongBoLo() {
  const router = useRouter()
  const [dsCty, setDsCty] = useState([])
  const [chon, setChon] = useState({})           // id công ty → true
  // Phạm vi: CHỌN PHÒNG rồi CHỌN NHÂN VIÊN. Không đổ cả 294 công ty ra một danh sách —
  // công ty nào thuộc phòng và nhân viên nấy, nhân viên chỉ đồng bộ công ty mình phụ trách.
  const [phong, setPhong] = useState('')
  const [nhanVien, setNhanVien] = useState('')
  const [tienIch, setTienIch] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')

  const homNay = new Date().toISOString().slice(0, 10)
  const truoc30 = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const [tuNgay, setTuNgay] = useState(truoc30)
  const [denNgay, setDenNgay] = useState(homNay)

  // Trạng thái lượt chạy
  const [dangChay, setDangChay] = useState(false)
  const [viTri, setViTri] = useState(0)
  const [ketQua, setKetQua] = useState({})       // id → { ket_qua, moTa, themMoi, capNhat }
  const [tienDo, setTienDo] = useState('')
  const [captcha, setCaptcha] = useState(null)   // { anh, nhan, giaiQuyet }
  const [maGo, setMaGo] = useState('')
  const dungLai = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
    kiemTraTienIch().then(setTienIch)
  }, [router])

  useEffect(() => {
    fetch('/api/admin/tokhai/overview')
      .then(r => r.json())
      .then(j => {
        if (j.error) { setLoi(j.error); return }
        // Chỉ công ty ĐÃ NỐI tài khoản mới đồng bộ được.
        const ds = (j.congTy || []).filter(c => c.trangThaiTaiKhoan !== 'not_connected')
        setDsCty(ds)
        // Chỉ một phòng trong tầm nhìn (nhân viên, hoặc trưởng phòng một phòng) thì chọn sẵn.
        const cacPhong = [...new Set(ds.map(c => c.roomId).filter(Boolean))]
        if (cacPhong.length === 1) setPhong(cacPhong[0])
      })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }, [])

  // Danh sách hiện ra = đúng phạm vi đã chọn. Chưa chọn phòng thì chưa hiện công ty nào.
  const dsHien = dsCty.filter(c =>
    (!phong || c.roomId === phong) && (!nhanVien || c.assignedTo === nhanVien))
  const cacPhong = [...new Map(dsCty.filter(c => c.roomId).map(c => [c.roomId, c.phong])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  const cacNV = [...new Map(dsCty.filter(c => (!phong || c.roomId === phong) && c.assignedTo)
    .map(c => [c.assignedTo, c.nhanVien])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))

  const dsChon = dsHien.filter(c => chon[c.id])

  // Chờ người gõ captcha: trả về Promise, màn hình cung cấp mã qua nút Xác nhận.
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
    setDangChay(true); setKetQua({}); setViTri(0)

    for (let i = 0; i < dsChon.length; i++) {
      if (dungLai.current) break
      const c = dsChon[i]
      setViTri(i)
      setTienDo(`Đang mở phiên cho ${c.ten}…`)

      const kq = await chayDongBo({
        clientId: c.id, tuNgay, denNgay,
        onCaptcha: hoiCaptcha,
        onTienDo: setTienDo,
      })
      setKetQua(p => ({ ...p, [c.id]: kq }))

      // Cổng đã chặn vì gọi dày thì DỪNG CẢ LÔ. Chạy tiếp công ty sau chỉ làm cổng khó chịu
      // thêm và có thể kéo dài thời gian bị chặn — thà dừng, nghỉ, rồi chạy lại.
      if (kq.ket_qua === 'loi' && /429|quá dày/i.test(kq.moTa || '')) {
        setTienDo('⚠ Cổng thuế đang chặn vì gọi quá dày — đã DỪNG cả lô. Nghỉ 10–15 phút rồi chạy lại, và chia nhỏ khoảng ngày.')
        break
      }

      // Nghỉ giữa hai công ty: đăng xuất công ty trước còn chưa kịp có hiệu lực bên cổng, và
      // bắn liên tục dễ bị chặn.
      if (i < dsChon.length - 1 && !dungLai.current) {
        setTienDo('Nghỉ 8 giây trước công ty kế tiếp…')
        await new Promise(r => setTimeout(r, 8000))
      }
    }

    setDangChay(false); setTienDo(''); setCaptcha(null)
  }

  const dem = tt => Object.values(ketQua).filter(k => k.ket_qua === tt).length
  const tongMoi = Object.values(ketQua).reduce((t, k) => t + (k.themMoi || 0), 0)
  const tongSua = Object.values(ketQua).reduce((t, k) => t + (k.capNhat || 0), 0)

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />

        <h1 className="text-xl font-bold text-gray-900 mb-3">Đồng bộ theo lô</h1>

        {!tienIch?.co && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <b>Chưa có tiện ích Chrome</b> — đồng bộ theo lô chỉ chạy khi máy đã cài tiện ích
            <b> Savitax — Cầu nối cổng thuế</b>.
          </div>
        )}
        {loi && <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}

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

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">Từ</span>
            <input type="date" value={tuNgay} max={denNgay} onChange={e => setTuNgay(e.target.value)}
              disabled={dangChay} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <span className="text-sm text-gray-500">đến</span>
            <input type="date" value={denNgay} min={tuNgay} max={homNay} onChange={e => setDenNgay(e.target.value)}
              disabled={dangChay} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />

            <span className="text-sm text-gray-600 ml-2">
              Đã chọn <b>{dsChon.length}</b>/{dsHien.length} công ty ·
              cần gõ khoảng <b>{dsChon.length * 2}</b> mã captcha
            </span>

            <div className="flex-1" />
            {!dangChay ? (
              <button onClick={chay} disabled={!dsChon.length || !tienIch?.co}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40 shadow-sm">
                Bắt đầu đồng bộ
              </button>
            ) : (
              <button onClick={() => { dungLai.current = true; setCaptcha(null); captcha?.giaiQuyet(null) }}
                className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium shadow-sm">
                Dừng sau công ty này
              </button>
            )}
          </div>

          {dangChay && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: (dsChon.length ? (viTri / dsChon.length) * 100 : 0) + '%' }} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {viTri + 1}/{dsChon.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">{tienDo}</p>
            </div>
          )}
        </div>

        {/* Khung gõ captcha — nằm cố định giữa màn hình để nhân viên gõ liên tục không phải đưa mắt đi tìm */}
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
            <OTong mau="xanhLa"  so={dem('xong')} nhan="Xong" />
            <OTong mau="do"      so={dem('loi')} nhan="Lỗi" />
            <OTong mau="xam"     so={dem('bo_qua')} nhan="Bỏ qua" />
            <OTong mau="xanhDuong" so={tongMoi + tongSua} nhan="Hồ sơ lấy về" phu={`${tongMoi} mới · ${tongSua} cập nhật`} />
          </div>
        )}

        {dangTai && <p className="text-sm text-gray-400 py-10 text-center">Đang tải…</p>}

        {!dangTai && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
                  <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Tài khoản</th>
                  <th className="text-left px-2 py-2.5 font-semibold uppercase text-[11px] tracking-wide">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {dsHien.map((c, i) => {
                  const kq = ketQua[c.id]
                  const dangLam = dangChay && dsChon[viTri]?.id === c.id
                  return (
                    <tr key={c.id} className={'border-b border-gray-100 odd:bg-white even:bg-slate-50/60 '
                      + (dangLam ? 'ring-2 ring-inset ring-blue-300' : '')}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" disabled={dangChay} checked={!!chon[c.id]}
                          onChange={e => setChon(p => ({ ...p, [c.id]: e.target.checked }))} />
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="font-medium text-gray-900 leading-tight">{c.ten}</p>
                        <p className="text-xs text-gray-400">{c.maKH || '—'} · MST {c.mst || '—'}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        {c.trangThaiTaiKhoan === 'active'
                          ? <span className="text-xs text-green-700">Đã nối</span>
                          : <span className="text-xs text-red-700">Sai mật khẩu</span>}
                      </td>
                      <td className="px-2 py-2.5 text-xs">
                        {dangLam && <span className="text-blue-700 font-medium">đang chạy…</span>}
                        {!dangLam && kq?.ket_qua === 'xong' && (
                          <span className="text-green-700">
                            ✓ {kq.themMoi} mới · {kq.capNhat} cập nhật · {kq.soThongBao || 0} thông báo
                          </span>
                        )}
                        {!dangLam && kq?.ket_qua === 'loi' && <span className="text-red-700">{kq.moTa}</span>}
                        {!dangLam && kq?.ket_qua === 'bo_qua' && <span className="text-gray-400">bỏ qua</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!dsHien.length && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                {!phong
                  ? 'Chọn phòng ở trên để hiện danh sách công ty.'
                  : 'Không có công ty nào đã nối tài khoản trong phạm vi này.'}
                <span className="block text-xs text-gray-400 mt-1">
                  Nhập tài khoản cổng thuế ở tab <b>Kết nối cổng</b>.
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
