'use client'
// Tải bảng kê hóa đơn từ hoadondientu.gdt.gov.vn về thư mục từng công ty (dựng 21/11/2026, chạy thử trên demo).
//
// Tiện ích Savitax 1.4 BẤM HỘ NÚT CỦA CHÍNH TRANG CỔNG (cổng chặn mọi yêu cầu không do trang gửi — đo 13/10/2026, không lách):
// mở cửa sổ cổng → điền tài khoản vào hộp đăng nhập của trang → nhân viên TỰ GÕ mã xác nhận ngay trên app → tiện ích bấm nút
// Đăng nhập của trang → mỗi kỳ × mua vào / bán ra × HĐĐT / máy tính tiền: chọn tab, điền ngày, Tìm kiếm, Xuất hóa đơn → file về
// Tải về\Savitax-HDDT → app kiểm (khoảng ngày, số hóa đơn = "Có N kết quả", MST đúng công ty) → lưu vào
// <cty>\2. HỒ SƠ KẾ TOÁN\Năm <năm>\2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n | THÁNG mm\HĐ MUA VÀO | HĐ BÁN RA → Soát xét tự đọc được.
// Cổng báo chặn → dừng hẳn. Sai mật khẩu → dừng công ty đó, không thử lại (thử lại là khoá tài khoản của khách).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { layThuMucCongTy, chonThuMucCongTy, coHoTro } from '@/lib/tokhaiLuuDia'
import { kyCanTai, danhSachLuot, docBangKeCong, kiemBangKe, chuanMst } from '@/lib/hddtBangKe'
import { chonThuMucTaiVe, layThuMucTaiVe, docFileTai, luuVaoCongTy, daCoFile, THU_MUC_TAI } from '@/lib/hddtLuu'
import * as TI from '@/lib/hddtTienIch'

const NGHI_GIUA_LUOT = 2500
const cho = ms => new Promise(r => setTimeout(r, ms))
const khoaKhongCo = (mst, l) => `hddt0:${chuanMst(mst)}|${l.loai}|${l.tabCon}|${l.tuNgay}|${l.denNgay}`
const docLS = k => { try { return localStorage.getItem(k) } catch { return null } }
const ghiLS = (k, v) => { try { localStorage.setItem(k, v) } catch { /* bỏ qua */ } }
const khoaThuMuc = cty => (cty.ngoai ? 'hddt-ngoai:' + chuanMst(cty.mst) : cty.id)

function kyMacDinh() {
  const d = new Date()
  let q = Math.floor(d.getMonth() / 3)       // quý trước (0 = quý 4 năm trước)
  return q === 0 ? { nam: d.getFullYear() - 1, ky: 'q4' } : { nam: d.getFullYear(), ky: 'q' + q }
}

const MAU_TT = {
  cho: 'bg-gray-100 text-gray-500', dang: 'bg-blue-100 text-blue-700', da_luu: 'bg-green-100 text-green-700',
  khong_co: 'bg-slate-100 text-slate-500', loi: 'bg-red-100 text-red-700', bo: 'bg-amber-100 text-amber-700',
}
const CHU_TT = { cho: 'Chờ', dang: 'Đang chạy', da_luu: 'Đã lưu', khong_co: 'Không có HĐ', loi: 'Lỗi', bo: 'Bỏ qua' }

export default function TaiBangKeHoaDonPage() {
  const router = useRouter()
  const [sanSang, setSanSang] = useState(false)
  const [tienIch, setTienIch] = useState(null)
  const [taiVe, setTaiVe] = useState({ trangThai: '...' })
  const [dsCty, setDsCty] = useState([])
  const [loiCty, setLoiCty] = useState('')
  const [timKiem, setTimKiem] = useState('')
  const [thuMuc, setThuMuc] = useState({})
  const mac = kyMacDinh()
  const [nam, setNam] = useState(mac.nam)
  const [kyChon, setKyChon] = useState(mac.ky)
  const [chieu, setChieu] = useState({ mua: true, ban: true, mtt: true })
  const [dangXuatKhiXong, setDangXuatKhiXong] = useState(true)
  const [tinhTrang, setTinhTrang] = useState({})      // id → { daCo, tong, thieu } (bảng "còn thiếu")
  const [dangKiem, setDangKiem] = useState(false)
  const [ngoai, setNgoai] = useState({ mst: '', kyKhai: 'quy' })
  const [phien, setPhien] = useState(null)
  const phienRef = useRef(null)
  const dungRef = useRef(false)
  const [biChan, setBiChan] = useState('')
  const saiMkRef = useRef(new Set())

  const capNhat = patch => { phienRef.current = { ...phienRef.current, ...(typeof patch === 'function' ? patch(phienRef.current) : patch) }; setPhien(phienRef.current) }
  const capNhatLuot = (i, patch) => capNhat(p => ({ luot: p.luot.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
  const kyObj = kyChon.startsWith('q') ? { nam, quy: Number(kyChon.slice(1)) } : { nam, thang: Number(kyChon.slice(1)) }

  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getSession()
      if (!data.session) { router.push('/login'); return }
      setSanSang(true)
      setTienIch(await TI.kiemTienIch())
      setTaiVe(coHoTro() ? await layThuMucTaiVe() : { trangThai: 'khong_ho_tro' })
      const r = await fetch('/api/admin/phantich/cong-ty').then(x => x.json()).catch(e => ({ error: String(e) }))
      if (r.error) { setLoiCty(r.error); return }
      setDsCty(r.congTy || [])
      const tm = {}
      for (const c of r.congTy || []) { const k = await layThuMucCongTy(c.id); tm[c.id] = { trangThai: k.trangThai, ten: k.ten } }
      setThuMuc(tm)
    })()
  }, [router])

  const dsLoc = useMemo(() => {
    const q = timKiem.trim().toLowerCase()
    return dsCty.filter(c => !q || [c.ten, c.maKH, c.mst, c.nhanVien].join(' ').toLowerCase().includes(q))
  }, [dsCty, timKiem])

  const tienIchDu = tienIch?.ok && Number(tienIch.hddt) >= 2
  const dangChay = phien && !['xong', 'loi', 'dung'].includes(phien.buoc)

  // ── Thư mục ────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function chonTaiVe() {
    try { await chonThuMucTaiVe(); setTaiVe(await layThuMucTaiVe()) } catch (e) { if (e?.name !== 'AbortError') alert(e.message) }
  }
  async function capQuyenTaiVe() { setTaiVe(await layThuMucTaiVe({ xinQuyen: true })) }
  async function chonThuMuc(cty) {
    try {
      await chonThuMucCongTy(khoaThuMuc(cty))
      const k = await layThuMucCongTy(khoaThuMuc(cty))
      setThuMuc(m => ({ ...m, [cty.id]: { trangThai: k.trangThai, ten: k.ten } }))
    } catch (e) { if (e?.name !== 'AbortError') alert(e.message) }
  }
  async function capQuyen(cty) {
    const k = await layThuMucCongTy(khoaThuMuc(cty), { xinQuyen: true })
    setThuMuc(m => ({ ...m, [cty.id]: { trangThai: k.trangThai, ten: k.ten } }))
  }

  // ── Bảng "còn thiếu": đọc thư mục từng công ty (chỉ đọc) ────────────────────────────────────────────────────────────────
  async function kiemDaCo() {
    setDangKiem(true)
    const ra = {}
    for (const c of dsLoc) {
      if (thuMuc[c.id]?.trangThai !== 'san_sang') continue
      const k = kyCanTai({ kyKhai: c.kyKhai, ky: kyObj })
      if (k.loi) { ra[c.id] = { loi: k.loi }; continue }
      const { tay } = await layThuMucCongTy(c.id)
      const ds = danhSachLuot({ mst: c.mst, kyList: k.ky, chieu: ['mua', 'ban'].filter(x => chieu[x]), mtt: false })
      let daCo = 0
      for (const l of ds) if (docLS(khoaKhongCo(c.mst, l)) || await daCoFile({ tayCty: tay, nam: l.nam, duongDan: l.duongDan, tenFile: l.tenFile })) daCo++
      ra[c.id] = { daCo, tong: ds.length }
    }
    setTinhTrang(ra)
    setDangKiem(false)
  }

  // ── Một công ty ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function batDau(cty) {
    if (dangChay || biChan) return
    if (saiMkRef.current.has(khoaThuMuc(cty))) { alert('Công ty này vừa báo SAI MẬT KHẨU trên cổng. Kiểm lại mật khẩu ở hồ sơ công ty rồi tải lại trang mới chạy tiếp (thử lại là có thể khoá tài khoản của khách).'); return }
    if (!chuanMst(cty.mst)) { alert('Công ty chưa có MST.'); return }
    const k = kyCanTai({ kyKhai: cty.kyKhai, ky: kyObj })
    if (k.loi) { alert(k.loi); return }
    if (!k.ky.length) { alert('Kỳ đã chọn chưa bắt đầu.'); return }
    if (!chieu.mua && !chieu.ban) { alert('Chọn ít nhất mua vào hoặc bán ra.'); return }
    // Quyền thư mục: xin trong chính cú bấm này (trình duyệt chỉ cho xin trong cú bấm)
    let tv = await layThuMucTaiVe({ xinQuyen: true })
    setTaiVe(tv)
    if (tv.trangThai !== 'san_sang') { alert('Chưa có quyền vào thư mục Tải về — bấm "Chọn" ở ô Thư mục Tải về.'); return }
    const tc = await layThuMucCongTy(khoaThuMuc(cty), { xinQuyen: true })
    setThuMuc(m => ({ ...m, [cty.id]: { trangThai: tc.trangThai, ten: tc.ten } }))
    if (tc.trangThai !== 'san_sang') { alert('Chưa chọn / chưa cấp quyền thư mục của công ty này — bấm "Chọn thư mục" ở dòng công ty.'); return }

    dungRef.current = false
    const luot = danhSachLuot({ mst: cty.mst, kyList: k.ky, chieu: ['mua', 'ban'].filter(x => chieu[x]), mtt: chieu.mtt })
      .map(l => ({ ...l, trangThai: 'cho', ghiChu: '' }))
    phienRef.current = { cty, buoc: 'tai_khoan', luot, anhMa: null, ma: '', loi: '', tayCty: tc.tay, tayTaiVe: tv.tay, taiKhoan: null, nhatKy: [] }
    setPhien(phienRef.current)

    if (cty.ngoai) { capNhat({ buoc: 'nhap_tk', taiKhoan: { tenDangNhap: chuanMst(cty.mst), matKhau: '' } }); return }
    const tk = await fetch('/api/admin/hoadon/tai-khoan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: cty.id }) })
      .then(x => x.json()).catch(e => ({ error: String(e) }))
    if (tk.error) { capNhat({ buoc: 'loi', loi: tk.error }); return }
    if (!tk.coTaiKhoan) { capNhat({ buoc: 'nhap_tk', taiKhoan: { tenDangNhap: chuanMst(cty.mst), matKhau: '' }, loi: 'Hồ sơ công ty chưa lưu tài khoản "Hóa đơn điện tử" — nhập tay (không lưu lại).' }); return }
    capNhat({ taiKhoan: { tenDangNhap: tk.tenDangNhap, matKhau: tk.matKhau, tuHoSo: true } })
    await dangNhap()
  }

  async function dangNhap() {
    const p = phienRef.current
    if (!p.taiKhoan?.tenDangNhap || !p.taiKhoan?.matKhau) { capNhat({ buoc: 'nhap_tk', loi: 'Nhập tên đăng nhập + mật khẩu' }); return }
    capNhat({ buoc: 'mo_cong', loi: '' })
    const mo = await TI.moCong()
    if (!mo.ok) { capNhat({ buoc: 'loi', loi: 'Không mở được cổng: ' + mo.loi }); return }
    const tt = await TI.goi('trangThai', { mst: p.cty.mst })
    if (tt.biChan) return dungHan(tt.biChan)
    if (tt.ok && tt.daDangNhap) {
      // Đang đăng nhập đúng MST công ty này (hiện ở dải đầu trang) → chạy luôn. File tải về vẫn được kiểm MST lần nữa.
      if (tt.dungTaiKhoan) { capNhat({ buoc: 'chay', loi: 'Cổng đang đăng nhập sẵn đúng MST này — chạy luôn.', taiKhoan: { ...p.taiKhoan, matKhau: '' } }); await chayHet(); return }
      // Tài khoản khác / không rõ → đăng xuất bằng nút của trang cho chắc đúng tài khoản
      capNhat({ buoc: 'dang_xuat_cu' })
      const x = await TI.goi('dangXuat')
      if (!x.ok) {
        capNhat({ buoc: 'loi', loi: `Cổng đang đăng nhập sẵn (đầu trang: "${(tt.chuDauTrang || '').slice(0, 120)}") và tiện ích không tìm được nút Đăng xuất. Anh/chị bấm Đăng xuất trên cửa sổ cổng rồi bấm ▶ Tải lại — hoặc vào /thu-hoadon bấm "Dò trang" gửi kỹ thuật để chỉnh.` })
        await TI.xemCong()
        return
      }
      await cho(1500)
    }
    // Hộp đăng nhập của cổng đã điền sẵn tài khoản; tab cổng để ở trước — nhân viên gõ mã + bấm Đăng nhập NGAY TRÊN CỔNG
    // (anh chốt 21/11/2026), app tự theo dõi rồi chạy tiếp. Vẫn gõ được mã trên app (ảnh mã chép sang).
    const r = await TI.goi('moDangNhap', { tenDangNhap: p.taiKhoan.tenDangNhap, matKhau: p.taiKhoan.matKhau })
    if (r.biChan) return dungHan(r.loi)
    if (!r.ok) { capNhat({ buoc: 'loi', loi: r.loi }); return }
    if (r.daDangNhap) { capNhat({ buoc: 'chay', taiKhoan: { ...p.taiKhoan, matKhau: '' } }); await chayHet(); return }
    capNhat({ buoc: 'cho_ma', anhMa: r.anhMa, ma: '' })
    theoDoiDangNhap()
  }

  // Đang chờ nhân viên gõ mã trên cổng: hỏi tình trạng mỗi 2 giây (không giật tab cổng lên trước)
  async function theoDoiDangNhap() {
    const bd = Date.now()
    let loiCu = ''
    while (phienRef.current?.buoc === 'cho_ma' && Date.now() - bd < 10 * 60 * 1000) {
      await cho(2000)
      if (phienRef.current?.buoc !== 'cho_ma') return
      const tt = await TI.goi('trangThai', { mst: phienRef.current.cty.mst }, { khongLenTruoc: true })
      if (phienRef.current?.buoc !== 'cho_ma') return
      if (tt.biChan) return dungHan(tt.biChan)
      if (tt.ok && tt.daDangNhap && !tt.coHop) {
        capNhat({ buoc: 'chay', anhMa: null, loi: '', taiKhoan: { ...phienRef.current.taiKhoan, matKhau: '' } })
        await chayHet()
        return
      }
      const loi = tt.loiHop || ''
      if (loi && loi !== loiCu) {
        loiCu = loi
        const k = loi.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()
        const saiMa = /captcha|ma xac nhan|ma kiem tra|ma bao ve/.test(k)
        if (!saiMa && /mat khau|ten dang nhap|tai khoan|khong dung|khong chinh xac/.test(k)) {
          saiMkRef.current.add(khoaThuMuc(phienRef.current.cty))
          capNhat({ buoc: 'loi', loi: `Cổng báo: "${loi}". DỪNG — không thử lại (sai mật khẩu nhiều lần là khoá tài khoản của khách). Kiểm lại mật khẩu "Hóa đơn điện tử" ở hồ sơ công ty.` })
          return
        }
        capNhat({ loi: saiMa ? 'Cổng báo sai mã xác nhận — gõ lại mã mới trên cổng' : 'Cổng báo: ' + loi })
      }
    }
    if (phienRef.current?.buoc === 'cho_ma') capNhat({ buoc: 'loi', loi: 'Quá 10 phút chưa đăng nhập — bấm ▶ Tải để bắt đầu lại.' })
  }

  async function guiMa(e) {
    e?.preventDefault()
    const p = phienRef.current
    if (!p.ma.trim()) return
    capNhat({ buoc: 'gui_ma', loi: '' })
    const r = await TI.goi('guiMa', { ma: p.ma.trim() }, { veApp: true })
    if (r.biChan) return dungHan(r.loi)
    if (r.ok) { capNhat({ buoc: 'chay', anhMa: null, taiKhoan: { ...p.taiKhoan, matKhau: '' } }); await chayHet(); return }
    if (r.saiMatKhau) {
      saiMkRef.current.add(khoaThuMuc(p.cty))
      capNhat({ buoc: 'loi', loi: `Cổng báo: "${r.loi}". DỪNG — không thử lại (sai mật khẩu nhiều lần là khoá tài khoản của khách). Kiểm lại mật khẩu "Hóa đơn điện tử" ở hồ sơ công ty.` })
      return
    }
    let anh = r.anhMa
    if (!anh) { const m = await TI.goi('layMaMoi', {}, { veApp: true }); anh = m.anhMa }
    capNhat({ buoc: 'cho_ma', ma: '', anhMa: anh || p.anhMa, loi: r.saiMa ? 'Sai mã xác nhận — gõ lại mã mới' : (r.loi || 'Đăng nhập chưa được') })
    theoDoiDangNhap()
  }

  async function maKhac() {
    const m = await TI.goi('layMaMoi', {}, { veApp: true })
    if (m.anhMa) capNhat({ anhMa: m.anhMa, ma: '' })
    else capNhat({ loi: m.loi || 'Không lấy được mã mới' })
  }

  function dungHan(loi) {
    dungRef.current = true
    setBiChan(loi || 'Cổng báo chặn')
    capNhat({ buoc: 'dung', loi: 'CỔNG BÁO CHẶN: ' + (loi || '') + ' — đã dừng toàn bộ, không chạy tiếp.' })
  }

  async function chayHet() {
    let i = 0, loiLien = 0
    while (i < phienRef.current.luot.length) {
      if (dungRef.current || loiLien >= 2) {
        const lyDo = dungRef.current ? 'Đã dừng' : 'Dừng vì 2 lượt liền lỗi — xem lỗi ở trên'
        capNhat(p => ({ luot: p.luot.map(l => (l.trangThai === 'cho' ? { ...l, trangThai: 'bo', ghiChu: lyDo } : l)) }))
        break
      }
      const kq = await motLuot(i)
      loiLien = kq === 'loi' ? loiLien + 1 : 0
      if (kq === 'chan') return
      if (kq === 'het_phien') { capNhat({ buoc: 'loi', loi: 'Cổng đã đăng xuất giữa chừng (hết phiên) — bấm Tải lại để đăng nhập và chạy tiếp các kỳ còn thiếu.' }); return }
      i++
      if (i < phienRef.current.luot.length) await cho(NGHI_GIUA_LUOT)
    }
    if (dangXuatKhiXong && !dungRef.current) { capNhat({ buoc: 'dang_xuat' }); await TI.goi('dangXuat', {}, { veApp: true }) }    const p = phienRef.current
    capNhat({ buoc: dungRef.current ? 'dung' : 'xong' })
    const daLuu = p.luot.filter(l => ['da_luu', 'khong_co'].includes(l.trangThai)).length
    setTinhTrang(t => ({ ...t, [p.cty.id]: { daCo: daLuu, tong: p.luot.length, vuaChay: true } }))
  }

  async function motLuot(i) {
    const p = phienRef.current
    const l = p.luot[i]
    capNhatLuot(i, { trangThai: 'dang', ghiChu: 'Đang tra cứu…' })
    // Vào màn tra cứu bằng MENU của trang — mở thẳng địa chỉ thì cổng báo 403 "không có quyền truy cập trang này"
    const v = await TI.goi('vaoTraCuu')
    if (!v.ok) { capNhatLuot(i, { trangThai: 'loi', ghiChu: v.loi || 'Không vào được màn Tra cứu hóa đơn' }); return 'loi' }
    const ma = 'L' + Date.now().toString(36) + i
    const tu = Date.now()
    const r = await TI.goi('chayLuot', { loai: l.loai, tabCon: l.tabCon, tuNgay: l.tuNgay, denNgay: l.denNgay, xuat: true, maLuot: ma })
    const buocHong = (r.nhatKy || []).filter(x => !x.ok).map(x => `${x.buoc}: ${x.chiTiet}`).join(' · ')
    if (r.biChan) { dungHan(buocHong || r.loi); capNhatLuot(i, { trangThai: 'loi', ghiChu: buocHong }); return 'chan' }
    if (r.chuaDangNhap) { capNhatLuot(i, { trangThai: 'loi', ghiChu: 'Cổng chưa đăng nhập' }); return 'het_phien' }
    if (!r.ok) {
      // Cổng không cho tra cả quý một lần → tách từng tháng, vẫn lưu vào thư mục QUÝ
      if (r.loiForm && l.thuMucKy.startsWith('QUÝ') && !l.daTach) {
        const [d0, m0, y0] = l.tuNgay.split('/').map(Number), [d1, m1] = l.denNgay.split('/').map(Number)
        const con = []
        for (let m = m0; m <= m1; m++) {
          const cuoi = new Date(y0, m, 0).getDate()
          const tuN = `${String(m === m0 ? d0 : 1).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y0}`
          const denN = `${String(m === m1 ? d1 : cuoi).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y0}`
          const [x] = danhSachLuot({ mst: p.cty.mst, kyList: [{ ...l, tuNgay: tuN, denNgay: denN, nhan: `Tháng ${String(m).padStart(2, '0')}/${y0}` }], chieu: [l.loai], mtt: false })
          con.push({ ...x, tabCon: l.tabCon, nhanLuot: x.nhanLuot + (l.tabCon === 'mtt' ? ' · Máy tính tiền' : ''), tenFile: l.tabCon === 'mtt' ? x.tenFile.replace(' - Tổng quan - ', ' - Tổng quan - Máy tính tiền - ') : x.tenFile, daTach: true, trangThai: 'cho', ghiChu: '' })
        }
        capNhat(pp => ({ luot: [...pp.luot.slice(0, i), { ...l, trangThai: 'bo', ghiChu: `Cổng không cho tra cả quý (${r.loiForm}) → tách từng tháng` }, ...con, ...pp.luot.slice(i + 1)] }))
        return 'tach'
      }
      capNhatLuot(i, { trangThai: 'loi', ghiChu: buocHong || r.loi || 'Không rõ lỗi' })
      return 'loi'
    }
    if (r.khongCo) { ghiLS(khoaKhongCo(p.cty.mst, l), '1'); capNhatLuot(i, { trangThai: 'khong_co', ghiChu: 'Cổng báo 0 kết quả — không có file' }); return 'ok' }

    capNhatLuot(i, { ghiChu: `Có ${r.soKetQua} kết quả · chờ file tải về…` })
    let f = null
    for (let n = 0; n < 40; n++) {
      await cho(1500)
      const t = await TI.fileTai({ ma, tu: tu - 5000 })
      f = (t.file || [])[0]
      if (f && f.trangThai !== 'in_progress') break
    }
    if (!f) { capNhatLuot(i, { trangThai: 'loi', ghiChu: 'Đã bấm Xuất nhưng 60 giây chưa thấy file tải về (Chrome đang hỏi chỗ lưu? tắt "Hỏi vị trí lưu" trong cài đặt tải xuống)' }); return 'loi' }
    if (f.trangThai !== 'complete') { capNhatLuot(i, { trangThai: 'loi', ghiChu: `Tải file hỏng: ${f.loi || f.trangThai}` }); return 'loi' }
    try {
      const { byte, xoa } = await docFileTai(p.tayTaiVe, f.ten, f.duongDan)
      const doc = docBangKeCong(byte, XLSX)
      const k = kiemBangKe({ doc, luot: l, mstCty: p.cty.mst, soKetQua: r.soKetQua })
      if (!k.ok) { capNhatLuot(i, { trangThai: 'loi', ghiChu: `KHÔNG LƯU: ${k.loi.join(' · ')} — file để lại ở Tải về\\${THU_MUC_TAI}\\${f.ten}` }); return 'loi' }
      const luu = await luuVaoCongTy({ tayCty: p.tayCty, nam: l.nam, duongDan: l.duongDan, tenFile: l.tenFile, byte })
      await xoa()
      capNhatLuot(i, { trangThai: 'da_luu', ghiChu: `${doc.soHoaDon} hóa đơn → ${luu.duongDan}${luu.ghiDe ? ' (thay bản tải trước)' : ''}${k.canhBao.length ? ' · ⚠ ' + k.canhBao.join(' · ') : ''}` })
      return 'ok'
    } catch (e) {
      capNhatLuot(i, { trangThai: 'loi', ghiChu: String(e?.message || e) })
      return 'loi'
    }
  }

  function dungLai() { dungRef.current = true; capNhat({ loi: 'Đang dừng sau lượt hiện tại…' }) }

  if (!sanSang) return <AppShell><div className="p-8 text-sm text-gray-400">Đang tải...</div></AppShell>

  const ctyNgoai = { id: 'ngoai', ngoai: true, ten: 'Công ty ngoài danh sách', mst: ngoai.mst, kyKhai: ngoai.kyKhai, maKH: '' }
  const namChon = [0, 1, 2].map(i => new Date().getFullYear() - i)

  return (
    <AppShell>
      <div className="px-4 md:px-6 py-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📥 Tải bảng kê hóa đơn</h1>
            <p className="text-sm text-gray-500">Từ hoadondientu.gdt.gov.vn — tiện ích bấm hộ nút của trang cổng, anh/chị chỉ gõ mã xác nhận. File lưu thẳng vào thư mục công ty, Soát xét tự đọc.</p>
          </div>
          {biChan && <div className="px-3 py-2 rounded bg-red-600 text-white text-sm font-semibold">⛔ Cổng báo chặn — đã dừng mọi lượt: {biChan}</div>}
        </div>

        {/* Thiết lập */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-white p-3 text-sm">
            <div className="text-xs font-semibold text-gray-500 mb-1">TIỆN ÍCH SAVITAX</div>
            {tienIch == null ? '…' : tienIchDu ? <span className="text-green-700">✔ Bản {tienIch.phienBan}</span>
              : <span className="text-red-600">✘ {tienIch.ok ? `Bản ${tienIch.phienBan} — cần bản 1.4 (Tải lại tiện ích)` : tienIch.loi}</span>}
            <div className="mt-2 flex gap-2">
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={async () => setTienIch(await TI.kiemTienIch())}>↻ Kiểm lại</button>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" disabled={!tienIchDu} onClick={async () => { const r = await TI.xemCong(); if (!r.ok) { const m = await TI.moCong(); if (!m.ok) alert(m.loi) } }}>🪟 Xem cửa sổ cổng</button>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-3 text-sm">
            <div className="text-xs font-semibold text-gray-500 mb-1">THƯ MỤC TẢI VỀ (Downloads của Chrome)</div>
            {taiVe.trangThai === 'san_sang' ? <span className="text-green-700">✔ {taiVe.ten}</span>
              : taiVe.trangThai === 'can_xin_lai' ? <span className="text-amber-700">{taiVe.ten} — cần cấp lại quyền</span>
                : taiVe.trangThai === 'khong_ho_tro' ? <span className="text-red-600">Trình duyệt không hỗ trợ — dùng Chrome / Edge</span>
                  : <span className="text-amber-700">Chưa chọn</span>}
            <div className="mt-2 flex gap-2">
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={chonTaiVe}>{taiVe.trangThai === 'chua_chon' ? 'Chọn' : 'Đổi'}</button>
              {taiVe.trangThai === 'can_xin_lai' && <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={capQuyenTaiVe}>Cấp quyền</button>}
            </div>
            <div className="text-xs text-gray-400 mt-1">Chọn đúng thư mục Chrome lưu file tải xuống. File tạm nằm ở “{THU_MUC_TAI}” bên trong, lưu xong app tự xoá.</div>
          </div>
          <div className="rounded-lg border bg-white p-3 text-sm space-y-2">
            <div className="text-xs font-semibold text-gray-500">KỲ CẦN TẢI</div>
            <div className="flex gap-2">
              <select value={nam} onChange={e => setNam(Number(e.target.value))} className="border rounded px-2 py-1">{namChon.map(n => <option key={n}>{n}</option>)}</select>
              <select value={kyChon} onChange={e => setKyChon(e.target.value)} className="border rounded px-2 py-1">
                <optgroup label="Theo quý">{[1, 2, 3, 4].map(q => <option key={q} value={'q' + q}>Quý {q}</option>)}</optgroup>
                <optgroup label="Theo tháng (công ty khai tháng)">{Array.from({ length: 12 }, (_, i) => <option key={i} value={'t' + (i + 1)}>Tháng {i + 1}</option>)}</optgroup>
              </select>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[['mua', 'Mua vào'], ['ban', 'Bán ra'], ['mtt', 'Cả HĐ máy tính tiền']].map(([k, t]) => (
                <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={chieu[k]} onChange={e => setChieu(c => ({ ...c, [k]: e.target.checked }))} />{t}</label>
              ))}
              <label className="flex items-center gap-1"><input type="checkbox" checked={dangXuatKhiXong} onChange={e => setDangXuatKhiXong(e.target.checked)} />Đăng xuất cổng khi xong</label>
            </div>
            <div className="text-xs text-gray-400">Công ty khai quý: một file trọn quý. Khai tháng: mỗi tháng một file (chọn quý = 3 tháng).</div>
          </div>
        </div>

        {/* Đang chạy */}
        {phien && (
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-gray-900">{phien.cty.ten} <span className="text-gray-500 font-normal">· MST {chuanMst(phien.cty.mst)} · {phien.cty.kyKhai === 'thang' ? 'khai tháng' : 'khai quý'}</span></div>
              <div className="flex gap-2">
                {dangChay && phien.buoc === 'chay' && <button className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={dungLai}>⏸ Dừng sau lượt này</button>}
                {!dangChay && <button className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={() => setPhien(null)}>Đóng</button>}
              </div>
            </div>
            {phien.loi && <div className={`text-sm ${['loi', 'dung'].includes(phien.buoc) ? 'text-red-700 font-medium' : 'text-amber-700'}`}>{phien.loi}</div>}
            {['mo_cong', 'dang_xuat_cu', 'gui_ma', 'dang_xuat', 'tai_khoan'].includes(phien.buoc) && (
              <div className="text-sm text-blue-700">⏳ {({ mo_cong: 'Đang mở cổng, điền tài khoản…', dang_xuat_cu: 'Cổng đang đăng nhập tài khoản khác — đăng xuất trước…', gui_ma: 'Đang đăng nhập…', dang_xuat: 'Đăng xuất cổng…', tai_khoan: 'Lấy tài khoản…' })[phien.buoc]}</div>
            )}
            {phien.buoc === 'nhap_tk' && (
              <form className="flex flex-wrap items-end gap-2 text-sm" onSubmit={e => { e.preventDefault(); dangNhap() }}>
                <label className="flex flex-col">Tên đăng nhập<input className="border rounded px-2 py-1" value={phien.taiKhoan?.tenDangNhap || ''} onChange={e => capNhat({ taiKhoan: { ...phien.taiKhoan, tenDangNhap: e.target.value } })} /></label>
                <label className="flex flex-col">Mật khẩu<input type="password" autoComplete="off" className="border rounded px-2 py-1" value={phien.taiKhoan?.matKhau || ''} onChange={e => capNhat({ taiKhoan: { ...phien.taiKhoan, matKhau: e.target.value } })} /></label>
                <button className="px-3 py-1.5 rounded bg-blue-600 text-white">Mở cổng & lấy mã</button>
                <span className="text-xs text-gray-500">Chỉ dùng cho lượt này, không lưu.</span>
              </form>
            )}
            {phien.buoc === 'cho_ma' && (
              <form className="flex flex-wrap items-center gap-3" onSubmit={guiMa}>
                {phien.anhMa && <img src={phien.anhMa} alt="Mã xác nhận" className="h-14 bg-white border rounded px-2" />}
                <input autoFocus className="border rounded px-3 py-2 text-lg tracking-widest w-40" placeholder="Gõ mã" value={phien.ma} onChange={e => capNhat({ ma: e.target.value })} />
                <button className="px-4 py-2 rounded bg-blue-600 text-white font-medium">Đăng nhập</button>
                <button type="button" className="px-3 py-2 rounded border bg-white" onClick={maKhac}>↻ Mã khác</button>
                <span className="text-xs text-gray-500">Mã chép từ hộp đăng nhập của cổng.{phien.taiKhoan?.tuHoSo ? ' Tài khoản lấy từ hồ sơ công ty.' : ''}</span>
              </form>
            )}
            {phien.buoc === 'cho_ma' && (
              <div className="text-sm text-blue-800 bg-blue-100 rounded px-3 py-2">
                👉 Tab cổng đã mở hộp đăng nhập, điền sẵn tài khoản. Anh/chị <b>gõ mã xác nhận và bấm Đăng nhập ngay trên cổng</b> — app tự nhận ra và chạy tiếp
                (hoặc gõ mã ở ô trên). <button type="button" className="underline" onClick={() => TI.xemCong()}>Mở tab cổng</button>
              </div>
            )}
            {phien.luot?.length > 0 && (
              <div className="overflow-auto max-h-96 border rounded bg-white">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-slate-700 text-white"><tr>
                    <th className="px-2 py-1.5 text-left border-r border-slate-500 w-8">#</th>
                    <th className="px-2 py-1.5 text-left border-r border-slate-500">Lượt</th>
                    <th className="px-2 py-1.5 text-left border-r border-slate-500 w-28">Trạng thái</th>
                    <th className="px-2 py-1.5 text-left">Chi tiết</th>
                  </tr></thead>
                  <tbody>{phien.luot.map((l, i) => (
                    <tr key={i} className={i % 2 ? 'bg-slate-50' : ''}>
                      <td className="px-2 py-1 border-r text-gray-400">{i + 1}</td>
                      <td className="px-2 py-1 border-r whitespace-nowrap">{l.nhanLuot} <span className="text-gray-400 text-xs">{l.tuNgay}–{l.denNgay}</span></td>
                      <td className="px-2 py-1 border-r"><span className={`px-2 py-0.5 rounded text-xs font-medium ${MAU_TT[l.trangThai]}`}>{CHU_TT[l.trangThai]}</span></td>
                      <td className="px-2 py-1 text-gray-600 break-all">{l.ghiChu}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {phien.buoc === 'xong' && <div className="text-sm text-green-700 font-medium">✔ Xong {phien.luot.filter(l => l.trangThai === 'da_luu').length} file đã lưu, {phien.luot.filter(l => l.trangThai === 'khong_co').length} lượt không có hóa đơn, {phien.luot.filter(l => l.trangThai === 'loi').length} lỗi.</div>}
          </div>
        )}

        {/* Danh sách công ty */}
        <div className="rounded-lg border bg-white">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <input className="border rounded px-3 py-1.5 text-sm w-72" placeholder="Tìm tên, mã KH, MST, nhân viên…" value={timKiem} onChange={e => setTimKiem(e.target.value)} />
            <button className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-40" disabled={dangKiem} onClick={kiemDaCo}>{dangKiem ? 'Đang đọc thư mục…' : '🔍 Kiểm tra đã có bảng kê kỳ này'}</button>
            <span className="text-xs text-gray-400">{dsLoc.length} công ty · chỉ đọc thư mục đã cấp quyền</span>
          </div>
          {loiCty && <div className="p-3 text-sm text-red-600">{loiCty}</div>}
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-700 text-white"><tr>
                {['Công ty', 'MST', 'Kỳ khai', 'Nhân viên', 'Thư mục công ty', 'Bảng kê kỳ này', ''].map(t => <th key={t} className="px-2 py-2 text-left border-r border-slate-500 font-medium">{t}</th>)}
              </tr></thead>
              <tbody>
                <tr className="bg-amber-50">
                  <td className="px-2 py-1.5 border-r font-medium text-amber-800">＋ Công ty ngoài danh sách</td>
                  <td className="px-2 py-1.5 border-r"><input className="border rounded px-2 py-1 w-32" placeholder="MST" value={ngoai.mst} onChange={e => setNgoai(n => ({ ...n, mst: e.target.value }))} /></td>
                  <td className="px-2 py-1.5 border-r"><select className="border rounded px-1 py-1" value={ngoai.kyKhai} onChange={e => setNgoai(n => ({ ...n, kyKhai: e.target.value }))}><option value="quy">Quý</option><option value="thang">Tháng</option></select></td>
                  <td className="px-2 py-1.5 border-r text-xs text-gray-500">Nhập tay tài khoản, không lưu</td>
                  <td className="px-2 py-1.5 border-r"><button className="px-2 py-1 rounded border bg-white text-xs" disabled={!chuanMst(ngoai.mst)} onClick={() => chonThuMuc(ctyNgoai)}>{thuMuc.ngoai?.trangThai === 'san_sang' ? '✔ ' + thuMuc.ngoai.ten : 'Chọn thư mục'}</button></td>
                  <td className="px-2 py-1.5 border-r" />
                  <td className="px-2 py-1.5"><button className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-40" disabled={!tienIchDu || dangChay || !!biChan || !chuanMst(ngoai.mst)} onClick={() => batDau(ctyNgoai)}>▶ Tải</button></td>
                </tr>
                {dsLoc.map((c, i) => {
                  const tm = thuMuc[c.id] || {}
                  const tt = tinhTrang[c.id]
                  return (
                    <tr key={c.id} className={(i % 2 ? 'bg-slate-50' : '') + (phien?.cty?.id === c.id ? ' ring-2 ring-blue-300' : '')}>
                      <td className="px-2 py-1.5 border-r"><div className="font-medium text-gray-900">{c.ten}</div><div className="text-xs text-gray-400">{c.maKH}{c.laHkd ? ' · HKD' : ''}</div></td>
                      <td className="px-2 py-1.5 border-r font-mono text-xs">{c.mst || <span className="text-red-500">chưa có</span>}</td>
                      <td className="px-2 py-1.5 border-r">{c.kyKhai === 'thang' ? 'Tháng' : 'Quý'}</td>
                      <td className="px-2 py-1.5 border-r text-xs">{c.nhanVien}</td>
                      <td className="px-2 py-1.5 border-r text-xs">
                        {tm.trangThai === 'san_sang' ? <span className="text-green-700">✔ {tm.ten}</span>
                          : tm.trangThai === 'can_xin_lai' ? <button className="px-2 py-0.5 rounded border border-amber-400 text-amber-700" onClick={() => capQuyen(c)}>Cấp quyền: {tm.ten}</button>
                            : <button className="px-2 py-0.5 rounded border" onClick={() => chonThuMuc(c)}>Chọn thư mục</button>}
                        {tm.trangThai === 'san_sang' && <button className="ml-1 text-gray-400 hover:text-gray-700" title="Đổi thư mục" onClick={() => chonThuMuc(c)}>✎</button>}
                      </td>
                      <td className="px-2 py-1.5 border-r text-xs">
                        {tt?.loi ? <span className="text-gray-400">{tt.loi}</span>
                          : tt ? <span className={tt.daCo >= tt.tong ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>{tt.daCo >= tt.tong ? '✔ Đủ' : `Thiếu ${tt.tong - tt.daCo}/${tt.tong}`}</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5"><button className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-40" disabled={!tienIchDu || dangChay || !!biChan} onClick={() => batDau(c)}>▶ Tải</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
