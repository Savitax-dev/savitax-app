'use client'
// Tải file tờ khai + thông báo về thư mục từng công ty — Phân hệ Tờ khai, GĐ 6.
//
// Nhân viên trỏ thẳng vào thư mục CỦA TỪNG CÔNG TY, chọn một lần, trình duyệt nhớ luôn. App tự đi
// tiếp xuống '2. HỒ SƠ KẾ TOÁN\Năm <năm>\7. BỘ BÁO CÁO'.
//
// CHẠY NHIỀU CÔNG TY CÙNG LÚC (anh chốt 29/09). Trước đây phải chờ công ty này tải xong mới gõ
// được mã cho công ty sau, nên nhân viên ngồi canh suốt cả tiếng. Nay tiện ích giữ nhiều phiên cổng
// tách nhau, nhờ vậy trong lúc công ty A tải file thì app đã xin mã cho công ty B — nhân viên gõ
// liên tục rồi rảnh hẳn, máy tự tải nền.
//
// ⚠ CHẠY SONG SONG KHÔNG PHẢI ĐỂ NHANH HƠN. Tiện ích có một hàng đợi chung giữ nhịp gọi cổng, nên
// bao nhiêu công ty thì cổng vẫn nhận đúng một lượt gọi mỗi ~2,2 giây. Mở nhiều chỉ để NGƯỜI khỏi
// phải chờ, còn máy vẫn chậm rãi như cũ — đúng thứ tự ưu tiên anh dặn: ổn định trước, nhanh sau.
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

// Mở càng nhiều thì nhân viên gõ được càng xa, nhưng mỗi công ty đang mở là một phiên sống bên
// cổng, để lâu quá có thể hết phiên. 2 là mức an toàn: gõ xong công ty này là có ngay công ty sau.
const SO_CUNG_LUC_MAC_DINH = 2
const CAC_MUC_CUNG_LUC = [1, 2, 3, 4]

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

  const [thuMucCty, setThuMucCty] = useState({})   // clientId → { tay, ten, trangThai, soat }

  const homNay = ngayChu(new Date())
  const [tuNgay, setTuNgay] = useState(ngayChu(new Date(Date.now() - 89 * 864e5)))
  const [denNgay, setDenNgay] = useState(homNay)
  const [taiLai, setTaiLai] = useState(false)
  const [soCungLuc, setSoCungLuc] = useState(SO_CUNG_LUC_MAC_DINH)

  const [dangChay, setDangChay] = useState(false)
  const [dangLamIds, setDangLamIds] = useState([])
  const [soXong, setSoXong] = useState(0)
  const [tongViec, setTongViec] = useState(0)
  const [ketQua, setKetQua] = useState({})
  const [tienDoCty, setTienDoCty] = useState({})
  const [dsFileMoi, setDsFileMoi] = useState([])
  const [hangCaptcha, setHangCaptcha] = useState([])
  const [maGo, setMaGo] = useState('')
  const [canhBaoLo, setCanhBaoLo] = useState('')
  const dungLai = useRef(false)
  const dungCaLo = useRef(false)

  // Tiện ích cũ (trước 1.1) không có phiên ảo → buộc chạy một công ty một lúc như trước.
  const coPhienAo = !!tienIch?.coPhienAo
  const soCungLucThat = coPhienAo ? soCungLuc : 1

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
  const sanSangCuaCty = c => thuMucCty[c.id]?.trangThai === 'san_sang'
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

  // Cột Thư mục chỉ hiện được TÊN thư mục, không hiện đường dẫn đầy đủ (trình duyệt không cho
  // biết). Hai công ty cùng trỏ vào một chỗ thì nhìn y hệt nhau — nên phải tự dò và nói ra.
  const [trungThuMuc, setTrungThuMuc] = useState([])
  useEffect(() => {
    const ds = dsHien.filter(c => chon[c.id] && thuMucCty[c.id]?.tay)
    if (ds.length < 2 || ds.length > 40) { setTrungThuMuc([]); return }
    let huy = false
    ;(async () => {
      const trung = []
      for (let i = 0; i < ds.length; i++) {
        for (let j = i + 1; j < ds.length; j++) {
          try {
            if (await thuMucCty[ds[i].id].tay.isSameEntry(thuMucCty[ds[j].id].tay)) {
              trung.push(`${ds[i].ten} và ${ds[j].ten}`)
            }
          } catch { /* trình duyệt không so được thì thôi */ }
        }
      }
      if (!huy) setTrungThuMuc(trung)
    })()
    return () => { huy = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsHienId, chon, thuMucCty])

  const capNhatThuMuc = useCallback(async (clientId, { xinQuyen = false } = {}) => {
    const kq = await layThuMucCongTy(clientId, { xinQuyen })
    const soat = kq.trangThai === 'san_sang' ? await soatThuMucCongTy(kq.tay) : null
    setThuMucCty(p => ({ ...p, [clientId]: { ...kq, soat } }))
    return { ...kq, soat }
  }, [])

  async function bamChonThuMuc(cty) {
    try {
      await chonThuMucCongTy(cty.id)
      await capNhatThuMuc(cty.id)
    } catch (e) {
      if (e?.name !== 'AbortError') setLoi(e.message)
    }
  }

  async function bamBoThuMuc(cty) {
    await quenThuMucCongTy(cty.id)
    setThuMucCty(p => ({ ...p, [cty.id]: { tay: null, trangThai: 'chua_chon' } }))
  }

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
    setKetQua({}); setDsFileMoi([]); setTienDoCty({}); setHangCaptcha([])
    setSoXong(0); setTongViec(dsChon.length); setCanhBaoLo('')

    const hangCho = [...dsChon]
    const dangLam = new Set()
    const capNhatDangLam = () => setDangLamIds([...dangLam])

    const chayMot = async (c) => {
      dangLam.add(c.id); capNhatDangLam()
      try {
        const kq = await chayTaiFile({
          clientId: c.id, tuNgay, denNgay, taiLai, tayCty: thuMucCty[c.id]?.tay,
          onCaptcha: th => themCaptcha(c, th),
          onTienDo: chu => setTienDoCty(p => ({ ...p, [c.id]: chu })),
          onFile: ({ ten }) => setDsFileMoi(p => [...ten.map(t => ({ ten: t, cty: c.ten })), ...p].slice(0, 200)),
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

  const tongFile = Object.values(ketQua).reduce((t, k) => t + (k.dsFile?.length || 0), 0)
  const tongLoiGhi = Object.values(ketQua).reduce((t, k) => t + (k.loiGhi?.length || 0), 0)
  const dem = tt => Object.values(ketQua).filter(k => k.ket_qua === tt).length
  const captchaDau = hangCaptcha[0] || null

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
          <p className="text-red-700 leading-tight">{tm.soat?.loi}</p>
          {nut('Chọn lại', () => bamChonThuMuc(c))}
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <p className="text-green-700 font-mono break-all leading-tight">✓ {tm.ten}</p>
        {/* Hiện thẳng chỗ file sẽ rơi vào — nhìn là biết đúng hay sai, khỏi phải tin lời app. */}
        <p className="text-[11px] text-gray-500 font-mono break-all leading-tight">
          → {tm.soat.duongDanMau?.join(' \\ ')}
        </p>
        {tm.soat.canhBao
          ? <p className="text-[11px] text-amber-700 leading-tight">{tm.soat.canhBao}</p>
          : (
            <p className="text-[11px] text-gray-400">
              {tm.soat.cacNam?.length
                ? `có ${tm.soat.cacNam.map(n => 'Năm ' + n).join(', ')}`
                : 'chưa có thư mục năm nào'}
            </p>
          )}
        <div className="flex gap-1">
          {nut('Đổi', () => bamChonThuMuc(c))}
          {nut('Bỏ', () => bamBoThuMuc(c))}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <TabToKhai />
        <NhacHanNop />

        <h1 className="text-xl font-bold text-gray-900 mb-1">Tải file về thư mục</h1>
        <p className="text-sm text-gray-500 mb-1">
          Tải tờ khai và thông báo từ cổng Dịch vụ công, xếp thẳng vào thư mục từng công ty trên ổ
          chung.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Đang lưu <b>file XML gốc</b> của cơ quan thuế. Phần app tự dựng PDF <b>tạm tắt</b> để soát
          lại cho đúng mẫu — kế toán vẫn in tay từ HTKK như trước.
        </p>

        {!tienIch?.co && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <b>Chưa có tiện ích Chrome</b> — cần tiện ích <b>Savitax — Cầu nối cổng thuế</b> để gọi cổng thuế.
          </div>
        )}
        {tienIch?.co && !coPhienAo && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Tiện ích đang là bản <b>{tienIch.phienBan}</b> — bản này chỉ chạy được <b>một công ty một
            lúc</b>, nên vẫn phải chờ từng công ty tải xong mới gõ mã tiếp. Cập nhật lên <b>1.1</b> để
            gõ mã cho công ty kế tiếp ngay trong lúc công ty này đang tải.
          </div>
        )}
        {!hoTro && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            Trình duyệt này không ghi được vào thư mục. Dùng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính.
          </div>
        )}
        {loi && <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loi}</div>}
        {canhBaoLo && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{canhBaoLo}</div>
        )}

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

            <span className="text-sm text-gray-500 ml-2">Mở cùng lúc</span>
            <select value={soCungLuc} disabled={dangChay || !coPhienAo}
              onChange={e => setSoCungLuc(+e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {CAC_MUC_CUNG_LUC.map(n => <option key={n} value={n}>{n} công ty</option>)}
            </select>

            <div className="flex-1" />
            {!dangChay ? (
              <button onClick={chay}
                disabled={!dsChon.length || !tienIch?.co || thieuMaKH.length > 0 || chuaCoThuMuc.length > 0}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40 shadow-sm">
                Bắt đầu tải file
              </button>
            ) : (
              <button onClick={bamDung}
                className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium shadow-sm">
                Dừng nhận công ty mới
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
          {coPhienAo && (
            <p className="text-xs text-gray-400 mt-1">
              Mở <b>{soCungLuc}</b> công ty cùng lúc: trong khi công ty này tải file, app đã xin mã cho
              công ty kế tiếp nên anh/chị gõ liên tục rồi rảnh hẳn. <b>Không nhanh hơn</b> — tiện ích
              vẫn giữ đúng một lượt gọi cổng mỗi ~2,2 giây dù mở bao nhiêu công ty.
            </p>
          )}

          {chuaCoThuMuc.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              <b>{chuaCoThuMuc.length}</b> công ty chưa có thư mục — bấm <b>Chọn thư mục</b> ở cột Thư mục
              rồi trỏ vào thư mục công ty trên ổ chung (ví dụ <span className="font-mono">3.THỊNH PHÁT</span>).
              Chọn một lần, lần sau app nhớ.
            </p>
          )}

          {trungThuMuc.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              <b>Trỏ trùng thư mục:</b> {trungThuMuc.join('; ')} đang dùng chung một thư mục. File
              vẫn vào đúng thư mục con theo Mã khách hàng nên không lẫn nội dung, nhưng anh/chị soát
              lại xem có chọn nhầm không — cột Thư mục chỉ hiện được tên, không hiện đường dẫn đầy đủ.
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
                      style={{ width: (tongViec ? (soXong / tongViec) * 100 : 0) + '%' }} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  xong {soXong}/{tongViec} · đang chạy {dangLamIds.length}
                </span>
              </div>
            </div>
          )}
        </div>

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
              <img key={captchaDau.khoa} src={captchaDau.anh} alt="Mã captcha"
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
            <OTong mau="xanhDuong" so={tongFile} nhan="File đã ghi" />
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
                    const dangLam = dangLamIds.includes(c.id)
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
                          {dangLam && (
                            <>
                              <span className="text-blue-700 font-medium">đang chạy…</span>
                              {tienDoCty[c.id] && (
                                <span className="block text-gray-500 mt-0.5 leading-tight">{tienDoCty[c.id]}</span>
                              )}
                            </>
                          )}
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
