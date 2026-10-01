'use client'
// Đồng bộ theo lô — Phân hệ Tờ khai.
//
// Nhân viên gõ captcha liên tục cho nhiều công ty trong một lượt ngồi, thay vì mở từng công ty
// bấm từng nút. Mỗi công ty tốn 2 mã.
//
// CHẠY NHIỀU CÔNG TY CÙNG LÚC (anh chốt 01/10/2026, giống hệt màn hình Tải file). Trước đây chạy
// TUẦN TỰ: gõ xong mã công ty này phải ngồi chờ nó chạy hết mới tới công ty sau, cộng thêm 8 giây
// nghỉ giữa hai công ty. Nay tiện ích giữ nhiều phiên cổng tách nhau (phiên ảo, bản 1.1) nên
// trong lúc công ty A đang tra, app đã xin mã cho công ty B — nhân viên gõ liên tục rồi rảnh hẳn.
//
// ⚠ SONG SONG KHÔNG PHẢI ĐỂ NHANH HƠN. Tiện ích có một hàng đợi chung giữ nhịp, nên bao nhiêu
// công ty thì cổng vẫn nhận đúng một lượt gọi mỗi ~2,2 giây. Mở nhiều chỉ để NGƯỜI khỏi phải chờ.
// Lần dính 429 ngày 21/09/2026 là do bắn thẳng nhiều lượt khi chưa có hàng đợi này.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TabToKhai from '@/components/TabToKhai'
import NhacHanNop from '@/components/NhacHanNop'
import { OTong, Chip } from '@/components/tokhaiUI'
import { kiemTraTienIch } from '@/lib/portalBridge'
import { chayDongBo } from '@/lib/tokhaiSyncClient'

// Mở càng nhiều thì nhân viên gõ được càng xa, nhưng mỗi công ty đang mở là một phiên sống bên
// cổng, để lâu quá có thể hết phiên. 2 là mức an toàn: gõ xong công ty này là có ngay công ty sau.
const SO_CUNG_LUC_MAC_DINH = 2
const CAC_MUC_CUNG_LUC = [1, 2, 3, 4]

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
  const [soXong, setSoXong] = useState(0)
  const [ketQua, setKetQua] = useState({})       // id → { ket_qua, moTa, themMoi, capNhat }
  const [tienDoCty, setTienDoCty] = useState({}) // id → chữ tiến độ của riêng công ty đó
  const [dangLamIds, setDangLamIds] = useState([])
  const [hangCaptcha, setHangCaptcha] = useState([])  // [{ khoa, cty, anh, nhan, giaiQuyet }]
  const [maGo, setMaGo] = useState('')
  const [soCungLuc, setSoCungLuc] = useState(SO_CUNG_LUC_MAC_DINH)
  const [canhBaoLo, setCanhBaoLo] = useState('')
  const dungLai = useRef(false)      // không nhận công ty mới, công ty đang dở vẫn chạy nốt
  const dungCaLo = useRef(false)     // cổng chặn → dừng hẳn

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

  // Tiện ích bản cũ (chưa có phiên ảo) thì BẮT BUỘC chạy một công ty một lúc — tráo cookie không
  // được thì hai công ty sẽ đá nhau ra khỏi cổng giữa chừng.
  const coPhienAo = !!tienIch?.coPhienAo
  const soCungLucThat = coPhienAo ? soCungLuc : 1

  // ── Hàng chờ gõ mã ────────────────────────────────────────────────────────
  //
  // Nhiều công ty chạy song song nên có lúc hai công ty cùng cần mã. Xếp hàng rồi hiện từng cái
  // một theo đúng thứ tự tới, để nhân viên gõ liên tục chứ không phải nhìn hai ô cùng lúc.
  const themCaptcha = (cty, { anhCaptcha, nhan }) => new Promise(giaiQuyet => {
    setHangCaptcha(h => [...h, {
      khoa: `${cty.id}-${h.length}-${Date.now()}`, cty, anh: anhCaptcha, nhan, giaiQuyet,
    }])
  })

  const traLoiCaptcha = (ma) => {
    setHangCaptcha(h => {
      const [dau, ...con] = h
      if (dau) dau.giaiQuyet(ma)
      return con
    })
    setMaGo('')
  }

  // Bỏ hết mã đang chờ (khi bấm Dừng) — không bỏ thì các công ty kia treo mãi.
  const boHetCaptcha = () => {
    setHangCaptcha(h => { for (const x of h) x.giaiQuyet(null); return [] })
    setMaGo('')
  }

  // ── Chạy ──────────────────────────────────────────────────────────────────

  async function chay() {
    dungLai.current = false
    dungCaLo.current = false
    setDangChay(true)
    setKetQua({}); setTienDoCty({}); setHangCaptcha([])
    setSoXong(0); setCanhBaoLo('')

    const hangCho = [...dsChon]
    const dangLam = new Set()
    const capNhatDangLam = () => setDangLamIds([...dangLam])

    const chayMot = async (c) => {
      dangLam.add(c.id); capNhatDangLam()
      try {
        const kq = await chayDongBo({
          clientId: c.id, tuNgay, denNgay,
          onCaptcha: th => themCaptcha(c, th),
          onTienDo: chu => setTienDoCty(p => ({ ...p, [c.id]: chu })),
        })
        setKetQua(p => ({ ...p, [c.id]: kq }))

        // Cổng chặn vì gọi dày thì DỪNG CẢ LÔ — chạy tiếp chỉ kéo dài thời gian bị chặn.
        if (kq.ket_qua === 'loi' && /429|quá dày/i.test(kq.moTa || '')) {
          dungCaLo.current = true
          setCanhBaoLo('⚠ Cổng thuế đang chặn vì gọi quá dày — đã DỪNG nhận công ty mới. '
            + 'Nghỉ 10–15 phút rồi chạy lại, và chia nhỏ khoảng ngày.')
          boHetCaptcha()
        }
      } catch (e) {
        setKetQua(p => ({ ...p, [c.id]: { ket_qua: 'loi', moTa: e.message } }))
      } finally {
        dangLam.delete(c.id); capNhatDangLam()
        setTienDoCty(p => ({ ...p, [c.id]: '' }))
        setSoXong(n => n + 1)
      }
    }

    const dangCho = new Set()
    for (;;) {
      while (hangCho.length && dangCho.size < soCungLucThat && !dungLai.current && !dungCaLo.current) {
        const c = hangCho.shift()
        let p
        p = chayMot(c).finally(() => dangCho.delete(p))
        dangCho.add(p)
      }
      if (!dangCho.size) break
      await Promise.race([...dangCho])
    }

    setDangChay(false); setHangCaptcha([]); setDangLamIds([])
  }

  function bamDung() {
    dungLai.current = true
    boHetCaptcha()
  }

  // Mã đang hiện = cái đầu hàng. Đổi `key` của ảnh theo `khoa` để React thay ảnh mới chứ không
  // dùng lại ảnh cũ khi sang công ty kế tiếp.
  const captchaDau = hangCaptcha[0] || null

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

            <span className="text-sm text-gray-500 ml-2">Mở cùng lúc</span>
            <select value={soCungLuc} disabled={dangChay || !coPhienAo}
              onChange={e => setSoCungLuc(+e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {CAC_MUC_CUNG_LUC.map(n => <option key={n} value={n}>{n} công ty</option>)}
            </select>

            <div className="flex-1" />
            {!dangChay ? (
              <button onClick={chay} disabled={!dsChon.length || !tienIch?.co}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40 shadow-sm">
                Bắt đầu đồng bộ
              </button>
            ) : (
              <button onClick={bamDung}
                className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium shadow-sm">
                Dừng nhận công ty mới
              </button>
            )}
          </div>

          {dangChay && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: (dsChon.length ? (soXong / dsChon.length) * 100 : 0) + '%' }} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {soXong}/{dsChon.length}
                </span>
              </div>
              {dangLamIds.map(id => {
                const c = dsChon.find(x => x.id === id)
                if (!c) return null
                return (
                  <p key={id} className="text-xs text-gray-500 mt-1.5">
                    <b className="text-gray-700">{c.ten}</b> — {tienDoCty[id] || 'đang chạy…'}
                  </p>
                )
              })}
            </div>
          )}

          {canhBaoLo && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {canhBaoLo}
            </div>
          )}

          {!coPhienAo && tienIch?.co && (
            <p className="mt-2 text-xs text-amber-700">
              Tiện ích Chrome trên máy này là bản cũ (chưa có phiên ảo) nên chỉ chạy được MỘT công ty
              một lúc. Cập nhật lên bản 1.1 để gõ mã liên tục.
            </p>
          )}
        </div>

        {/* Khung gõ captcha — nằm cố định giữa màn hình để nhân viên gõ liên tục không phải đưa
            mắt đi tìm. Nhiều công ty chạy song song nên hiện TỪNG mã một theo thứ tự tới. */}
        {captchaDau && (
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/60 p-4 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              {captchaDau.cty.ten} — mã captcha {captchaDau.nhan}
              {hangCaptcha.length > 1 && (
                <span className="ml-2 font-normal text-blue-700">
                  (còn {hangCaptcha.length - 1} mã đang chờ)
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <img src={captchaDau.anh} alt="Mã captcha" key={captchaDau.khoa}
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
                  const dangLam = dangLamIds.includes(c.id)
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
