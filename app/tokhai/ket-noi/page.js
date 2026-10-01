'use client'
// Kết nối tài khoản cổng thuế — Phân hệ Tờ khai, nhịp A.
//
// Trang riêng, KHÔNG đụng vào các màn hình đang chạy, để hỏng gì cũng không ảnh hưởng nghiệp vụ
// kế toán hằng ngày.
//
// ⚠ Hai nút "Kiểm tra kết nối" và "Đồng bộ tờ khai" đi QUA TIỆN ÍCH CHROME trên máy nhân viên,
//   không qua máy chủ: cổng Dịch vụ công chặn IP nước ngoài, mà Vercel đặt ở Singapore. Máy chưa
//   cài tiện ích thì màn hình hiện dải vàng và hai nút đó không chạy — xem
//   chrome-extension/CAI-DAT.md. (Ghi chú cũ ở đây nói "chỉ chạy trên localhost"; sai từ
//   29/09/2026, lúc bỏ hẳn đường máy chủ tự gọi cổng.)
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import NhacHanNop from '@/components/NhacHanNop'
import TabToKhai from '@/components/TabToKhai'
import { kiemTraTienIch, goiCong, donPhienCu } from '@/lib/portalBridge'
import { kiemTraKetNoi } from '@/lib/tokhaiKetNoiClient'

export default function TrangKetNoi() {
  const router = useRouter()
  const [dsCty, setDsCty]   = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi]       = useState('')
  const [timKiem, setTimKiem] = useState('')
  const [mo, setMo]         = useState(null)   // công ty đang mở ô nhập
  const [tienIch, setTienIch] = useState(null) // { co, phienBan, loi }

  // Cổng thuế chặn máy chủ nước ngoài → production phải đi qua tiện ích Chrome trên máy nhân
  // viên. Hiện trạng thái ngay đầu trang để biết máy này đã sẵn sàng chưa.
  useEffect(() => { kiemTraTienIch().then(setTienIch) }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login') })
  }, [router])

  const taiDs = () => {
    setDangTai(true)
    fetch('/api/admin/tokhai/overview')
      .then(r => r.json())
      .then(j => { if (j.error) setLoi(j.error); else setDsCty(j.congTy || []) })
      .catch(e => setLoi(e.message))
      .finally(() => setDangTai(false))
  }
  useEffect(taiDs, [])

  const loc = dsCty.filter(c => {
    const t = timKiem.trim().toLowerCase()
    if (!t) return true
    return (c.ten || '').toLowerCase().includes(t)
      || (c.maKH || '').toLowerCase().includes(t)
      || (c.mst || '').includes(t)
  })

  const daNoi = dsCty.filter(c => c.trangThaiTaiKhoan === 'active').length

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-lg font-bold text-gray-800">Kết nối cổng thuế</h1>
          <span className="text-sm text-gray-500">{daNoi}/{dsCty.length} công ty đã kết nối</span>
          <input value={timKiem} onChange={e => setTimKiem(e.target.value)}
            placeholder="Tìm tên công ty, mã KH, MST…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[220px]" />
        </div>

        {tienIch?.co ? (
          <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
            ✓ Đã cài <b>tiện ích Savitax — Cầu nối cổng thuế</b> (bản {tienIch.phienBan}). Máy này
            gọi được cổng thuế kể cả khi mở app.savitax.vn.
          </div>
        ) : (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <b>Chưa có tiện ích Chrome</b>{tienIch?.loi ? ` (${tienIch.loi})` : ''}. Hai nút
            <b> Kiểm tra kết nối</b> và <b>Đồng bộ tờ khai</b> cần tiện ích
            <b> Savitax — Cầu nối cổng thuế</b> mới chạy được. Cổng Dịch vụ công chặn máy chủ nước
            ngoài, nên mọi lượt gọi cổng đều phải đi qua tiện ích trên máy nhân viên.
          </div>
        )}

        {loi && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {dangTai && <p className="text-sm text-gray-400 py-8 text-center">Đang tải…</p>}

        <div className="space-y-2">
          {!dangTai && loc.slice(0, 60).map(c => (
            <DongCongTy key={c.id} cty={c} dangMo={mo === c.id} coTienIch={!!tienIch?.co}
              onMo={() => setMo(mo === c.id ? null : c.id)} onXong={taiDs} />
          ))}
          {!dangTai && loc.length > 60 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Còn {loc.length - 60} công ty nữa — gõ vào ô tìm kiếm để thu hẹp.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function DongCongTy({ cty, dangMo, onMo, onXong, coTienIch }) {
  const [tenDN, setTenDN]     = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [dangLuu, setDangLuu] = useState(false)
  const [thongBao, setThongBao] = useState(null)   // { loai: 'ok'|'loi'|'cho', chu }
  const [captcha, setCaptcha] = useState({ maPhien: null, anh: null, ma: '' })
  const [daCo, setDaCo]       = useState(null)
  // Đồng bộ đi qua 2 mã captcha: 'dang_nhap' rồi 'tra_cuu'. null = không đang đồng bộ.
  const [buocDongBo, setBuocDongBo] = useState(null)
  const [ketQua, setKetQua]   = useState(null)
  // Cổng chỉ cho tra tối đa 30 ngày mỗi lượt, và tra nhiều cửa sổ liền tay thì bị chặn (429).
  // Nên để người dùng tự chọn đúng khoảng cần, mặc định 30 ngày gần nhất.
  const homNay = new Date().toISOString().slice(0, 10)
  const truoc30 = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const [tuNgay, setTuNgay]   = useState(truoc30)
  const [denNgay, setDenNgay] = useState(homNay)

  const soNgayChon = Math.round((new Date(denNgay) - new Date(tuNgay)) / 864e5) + 1
  const soCuaSo = soNgayChon > 0 ? Math.ceil(soNgayChon / 30) : 0
  const khoangHopLe = soNgayChon > 0 && soCuaSo <= 12

  useEffect(() => {
    if (!dangMo) return
    fetch('/api/admin/tokhai/account?clientId=' + cty.id)
      .then(r => r.json())
      .then(j => {
        const dvc = (j.taiKhoan || []).find(t => t.portal === 'dvc')
        setDaCo(dvc || null)
        // Gợi ý sẵn tên đăng nhập theo MST — 100% tài khoản doanh nghiệp có dạng <MST>-QL.
        setTenDN(dvc?.username || (cty.mst ? cty.mst + '-QL' : ''))
      })
      .catch(() => {})
  }, [dangMo, cty.id, cty.mst])

  async function luu() {
    setDangLuu(true); setThongBao(null)
    try {
      const r = await fetch('/api/admin/tokhai/account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: cty.id, portal: 'dvc', username: tenDN, matKhau: matKhau || undefined }),
      })
      const j = await r.json()
      if (j.error) setThongBao({ loai: 'loi', chu: j.error })
      else { setThongBao({ loai: 'ok', chu: 'Đã lưu tài khoản' }); setMatKhau(''); onXong() }
    } catch (e) { setThongBao({ loai: 'loi', chu: e.message }) }
    setDangLuu(false)
  }

  // Kiểm tra kết nối ĐI QUA TIỆN ÍCH. Bản cũ để máy chủ tự gọi cổng nên chỉ chạy được ở máy tại
  // Việt Nam — trên app thật (Vercel, IP Singapore) cổng nuốt gói tin, nhân viên bấm là chờ 15
  // giây rồi nhận lỗi. Nay đi cùng đường với Đồng bộ và Tải file.
  async function batDauKiem() {
    if (!coTienIch) {
      setThongBao({ loai: 'loi', chu: 'Cần tiện ích Chrome "Savitax — Cầu nối cổng thuế" mới kiểm tra được.' })
      return
    }
    setThongBao({ loai: 'cho', chu: 'Đang mở phiên qua tiện ích Chrome…' })
    setCaptcha({ maPhien: null, anh: null, ma: '' })

    const kq = await kiemTraKetNoi({
      clientId: cty.id,
      onTienDo: chu => setThongBao({ loai: 'cho', chu }),
      // Trả về Promise; ô nhập mã bên dưới gọi giaiQuyet khi người dùng bấm Xác nhận.
      onCaptcha: ({ anhCaptcha }) => new Promise(giaiQuyet => {
        setCaptcha({ maPhien: 'ext', anh: anhCaptcha, ma: '', giaiQuyet })
        setThongBao({ loai: 'cho', chu: 'Nhìn ảnh, gõ mã rồi bấm Xác nhận.' })
      }),
    })

    setCaptcha({ maPhien: null, anh: null, ma: '' })
    if (kq.ket_qua === 'ok') { setThongBao({ loai: 'ok', chu: '✓ ' + kq.moTa }); onXong() }
    else if (kq.ket_qua === 'sai_mat_khau') {
      setThongBao({ loai: 'loi', chu: 'Sai mật khẩu: ' + (kq.moTa || '') + ' — đã dừng, KHÔNG thử lại để tránh khóa tài khoản của khách.' })
      onXong()
    } else if (kq.ket_qua === 'bo_qua') setThongBao(null)
    else setThongBao({ loai: 'loi', chu: kq.moTa || 'Không kiểm tra được' })
  }

  // Người bấm Xác nhận ở ô mã: nếu đang chờ mã cho lượt KIỂM TRA thì trả mã vào Promise kia.
  function guiCaptcha() {
    if (!captcha.ma.trim() || !captcha.giaiQuyet) return
    const ma = captcha.ma.trim()
    const giaiQuyet = captcha.giaiQuyet
    setCaptcha(c => ({ ...c, ma: '', giaiQuyet: null }))
    setThongBao({ loai: 'cho', chu: 'Đang đăng nhập cổng…' })
    giaiQuyet(ma)
  }

  // ── Đường QUA TIỆN ÍCH: máy chủ dựng yêu cầu, tiện ích gọi hộ bằng mạng máy nhân viên ──
  //
  // Vòng lặp: máy chủ bảo "gọi giúp yêu cầu này" → tiện ích gọi → gửi phản hồi nguyên văn về
  // → máy chủ đọc, bảo bước kế tiếp. Trang web KHÔNG tự đọc hiểu gì, chỉ chuyển thư.
  async function chayQuaTienIch(khoiDau) {
    let buoc = khoiDau
    for (let vong = 0; vong < 400; vong++) {      // chặn vòng lặp vô tận nếu máy chủ trả sai
      if (buoc.viec === 'go_captcha') {
        setBuocDongBo('ext:' + buoc.buoc)
        setCaptcha({ maPhien: khoiDau.maPhien, anh: buoc.anhCaptcha, ma: '' })
        setThongBao({ loai: 'cho', chu: `Gõ mã captcha ${buoc.nhan} rồi Enter.` })
        return          // dừng chờ người gõ; guiMaDongBo sẽ gọi tiếp
      }
      if (buoc.viec === 'xong') {
        setBuocDongBo(null); setCaptcha({ maPhien: null, anh: null, ma: '' })
        setKetQua(buoc)
        setThongBao({ loai: 'ok', chu: `✓ Xong ${buoc.khoangNgay}: ${buoc.themMoi} hồ sơ mới, ${buoc.capNhat} cập nhật, ${buoc.soThongBao} thông báo, ${buoc.khopNghiaVu} khớp lịch hạn nộp. Tốn ${buoc.soMaCaptcha} mã captcha.` })
        onXong()
        return
      }
      if (buoc.viec === 'loi' || buoc.error) {
        setBuocDongBo(null); setCaptcha({ maPhien: null, anh: null, ma: '' })
        setThongBao({ loai: 'loi', chu: buoc.moTa || buoc.error })
        onXong()
        return
      }

      // viec === 'goi'
      if (buoc.tienDo) setThongBao({ loai: 'cho', chu: buoc.tienDo + '…' })
      if (buoc.nghi) await new Promise(r => setTimeout(r, buoc.nghi))

      const phanHoi = await goiCong(buoc.yeuCau)
      buoc = await fetch('/api/admin/tokhai/sync-ext', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maPhien: khoiDau.maPhien, phanHoi }),
      }).then(r => r.json())
    }
    setThongBao({ loai: 'loi', chu: 'Chạy quá nhiều vòng, đã dừng để an toàn.' })
  }

  async function batDauDongBo() {
    setKetQua(null)

    if (coTienIch) {
      setThongBao({ loai: 'cho', chu: 'Đang mở phiên qua tiện ích Chrome…' })
      // Xóa cookie cổng trước: cổng khóa mỗi tài khoản vào một phiên, dính phiên cũ của công ty
      // khác là bị đá ra giữa chừng.
      await donPhienCu()
      const kd = await fetch('/api/admin/tokhai/sync-ext', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: cty.id, tuNgay, denNgay }),
      }).then(r => r.json())
      if (kd.error) { setThongBao({ loai: 'loi', chu: kd.error }); return }
      setCaptcha({ maPhien: kd.maPhien, anh: null, ma: '' })
      await chayQuaTienIch(kd)
      return
    }

    setThongBao({ loai: 'loi', chu: 'Cần tiện ích Chrome "Savitax — Cầu nối cổng thuế" mới đồng bộ được.' })
  }

  // Đồng bộ CHỈ còn đường qua tiện ích — đường máy chủ tự gọi cổng đã bỏ vì không chạy được trên
  // app thật (Vercel bị cổng chặn theo vùng).
  async function guiMaDongBo() {
    if (!captcha.ma.trim()) return
    setThongBao({ loai: 'cho', chu: 'Đang gửi mã…' })
    const tiep = await fetch('/api/admin/tokhai/sync-ext', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maPhien: captcha.maPhien, captcha: captcha.ma }),
    }).then(r => r.json())
    if (tiep.error) { setThongBao({ loai: 'loi', chu: tiep.error }); setBuocDongBo(null); return }
    await chayQuaTienIch({ ...tiep, maPhien: captcha.maPhien })
  }

  const mauTrangThai = cty.trangThaiTaiKhoan === 'active' ? 'text-green-700 bg-green-50 border-green-200'
    : cty.trangThaiTaiKhoan === 'wrong_password' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-slate-600 bg-slate-50 border-slate-200'
  const chuTrangThai = cty.trangThaiTaiKhoan === 'active' ? 'Đã kết nối'
    : cty.trangThaiTaiKhoan === 'wrong_password' ? 'Sai mật khẩu' : 'Chưa kết nối'

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button onClick={onMo} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50/60">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 text-sm leading-tight">{cty.ten}</p>
          <p className="text-xs text-gray-400">{cty.maKH || '— chưa có mã KH —'} · MST {cty.mst || '—'}</p>
        </div>
        <span className={'text-xs rounded-md border px-2 py-0.5 ' + mauTrangThai}>{chuTrangThai}</span>
        <span className="text-gray-300 text-xs">{dangMo ? '▲' : '▼'}</span>
      </button>

      {dangMo && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              {/* Hộ kinh doanh đăng nhập cổng với tư cách "Cá nhân": tên đăng nhập là MST hoặc CCCD,
                  KHÔNG có đuôi '-QL' như doanh nghiệp. Gõ kèm '-QL' là cổng báo sai tài khoản dù
                  mật khẩu đúng — mà vài lần sai là khoá tài khoản của khách. */}
              <label className="text-xs text-gray-500 mb-0.5 block">
                Tên đăng nhập cổng Dịch vụ công
                {cty.laHKD && <span className="text-purple-700"> · hộ kinh doanh, đăng nhập dạng Cá nhân (MST hoặc CCCD, không có “-QL”)</span>}
              </label>
              <input value={tenDN} onChange={e => setTenDN(e.target.value)}
                placeholder={cty.laHKD ? '079202030307' : '0312180502-QL'}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono" />
              {cty.laHKD && /-ql\s*$/i.test(tenDN) && (
                <p className="text-[11px] text-red-600 mt-0.5">
                  Hộ kinh doanh không có đuôi “-QL” — bỏ đi rồi lưu lại, nếu không cổng sẽ báo sai tài khoản.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">
                Mật khẩu {daCo && <span className="text-gray-400">(để trống = giữ nguyên)</span>}
              </label>
              <input type="password" value={matKhau} onChange={e => setMatKhau(e.target.value)}
                placeholder={daCo ? '••••••' : 'Mật khẩu cổng thuế'}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={luu} disabled={dangLuu || !tenDN}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs disabled:opacity-40">
              {dangLuu ? 'Đang lưu…' : 'Lưu tài khoản'}
            </button>
            <button onClick={batDauKiem} disabled={!daCo}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs disabled:opacity-40"
              title={daCo ? '' : 'Lưu tài khoản trước đã'}>
              Kiểm tra kết nối
            </button>
            <span className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-500">Từ</span>
            <input type="date" value={tuNgay} max={denNgay} onChange={e => setTuNgay(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
            <span className="text-xs text-gray-500">đến</span>
            <input type="date" value={denNgay} min={tuNgay} max={homNay} onChange={e => setDenNgay(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
            <button onClick={batDauDongBo} disabled={!daCo || !!buocDongBo || !khoangHopLe}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs disabled:opacity-40"
              title={daCo ? 'Vẫn chỉ tốn 2 mã captcha' : 'Lưu tài khoản trước đã'}>
              Đồng bộ tờ khai
            </button>
            <span className="text-[11px] text-gray-400">
              {soNgayChon > 0
                ? `${soNgayChon} ngày · ${soCuaSo} lượt tra${soCuaSo > 1 ? ' (giãn 2,5 giây mỗi lượt)' : ''}`
                : 'Khoảng ngày chưa hợp lệ'}
              {soCuaSo > 12 && ' — quá dài, cổng sẽ chặn'}
            </span>
            {daCo?.last_success_at && (
              <span className="text-xs text-gray-400">
                Kết nối gần nhất: {new Date(daCo.last_success_at).toLocaleString('vi-VN')}
              </span>
            )}
          </div>

          {captcha.anh && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 flex flex-wrap items-center gap-3">
              {/* Ảnh gốc ~120x40 quá bé, số 0 và chữ o gần như giống hệt — phải phóng to. */}
              <img src={captcha.anh} alt="Mã captcha" className="bg-white rounded border border-blue-200"
                style={{ height: 88, imageRendering: 'auto' }} />
              <div className="flex-1 min-w-[180px]">
                <input value={captcha.ma} autoFocus
                  onChange={e => setCaptcha(p => ({ ...p, ma: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (buocDongBo ? guiMaDongBo() : guiCaptcha())}
                  placeholder="Gõ mã trong ảnh rồi Enter"
                  className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm font-mono" />
                <p className="text-[11px] text-gray-500 mt-1">Dễ nhầm: số 0 ↔ chữ o, số 1 ↔ chữ l</p>
                {buocDongBo === 'tra_cuu' && (
                  <p className="text-[11px] text-blue-700 mt-0.5">Khoảng sẽ tra: <b>{tuNgay.split('-').reverse().join('/')} – {denNgay.split('-').reverse().join('/')}</b></p>
                )}
              </div>
              <button onClick={buocDongBo ? guiMaDongBo : guiCaptcha}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs">
                Xác nhận
              </button>
              {/* Bỏ giữa chừng phải báo máy chủ đóng phiên, nếu không nó treo tới lúc hết giờ. */}
              {captcha.giaiQuyet && (
                <button
                  onClick={() => { const g = captcha.giaiQuyet; setCaptcha({ maPhien: null, anh: null, ma: '' }); g(null) }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600">
                  Bỏ
                </button>
              )}
            </div>
          )}

          {ketQua?.hoSo?.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-2 py-1.5">Mã hồ sơ</th>
                    <th className="text-left px-2 py-1.5">Tờ khai</th>
                    <th className="text-left px-2 py-1.5">Kỳ</th>
                    <th className="text-left px-2 py-1.5">Ngày nộp</th>
                    <th className="text-left px-2 py-1.5">Trạng thái trên cổng</th>
                  </tr>
                </thead>
                <tbody>
                  {ketQua.hoSo.map(h => (
                    <tr key={h.maHoSo} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-mono text-[11px]">{h.maHoSo}</td>
                      <td className="px-2 py-1.5">{(h.tenToKhai || '').split(' - ')[0]}</td>
                      <td className="px-2 py-1.5">{h.ky}</td>
                      <td className="px-2 py-1.5">{h.ngayNop ? h.ngayNop.slice(8, 10) + '/' + h.ngayNop.slice(5, 7) + '/' + h.ngayNop.slice(0, 4) : '—'}</td>
                      <td className="px-2 py-1.5">{h.trangThai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ketQua && ketQua.khongKhop > 0 && (
            <p className="text-[11px] text-amber-700">
              {ketQua.khongKhop} hồ sơ không khớp được với lịch hạn nộp (loại tờ khai chưa có trong
              danh mục, hoặc kỳ nằm ngoài các kỳ đã sinh) — vẫn lưu đầy đủ, chỉ là chưa gắn vào ô nào.
            </p>
          )}

          {thongBao && (
            <p className={'text-xs px-2 py-1.5 rounded-lg ' + (
              thongBao.loai === 'ok'  ? 'bg-green-50 text-green-700'
              : thongBao.loai === 'loi' ? 'bg-red-50 text-red-700'
              : 'bg-gray-50 text-gray-600')}>{thongBao.chu}</p>
          )}
        </div>
      )}
    </div>
  )
}
