// Tải file tờ khai + thông báo từ cổng về máy nhân viên — Phân hệ Tờ khai, GĐ 6.
//
// TÁCH RIÊNG khỏi route đồng bộ (/sync-ext) vì hai việc có nhịp khác hẳn nhau:
//   - Đồng bộ trạng thái: chạy nhiều lần trong kỳ, cho cả lô, nhẹ.
//   - Tải file: chạy ít, thường cho MỘT công ty nhiều kỳ, nặng gấp 2–3 lần số lượt gọi cổng.
// Tách ra thì sửa cái này không làm hỏng cái kia.
//
// ⚠ RÀNG BUỘC CỐT TỬ CỦA CỔNG: chỉ cho tải hồ sơ thuộc LẦN TRA CỨU GẦN NHẤT trong phiên.
//   Vì vậy phải làm TỪNG CỬA SỔ MỘT: tra cửa sổ → tải hết file của cửa sổ đó → mới sang cửa sổ
//   kế tiếp. Gom mã hồ sơ của nhiều cửa sổ rồi mới tải là bị từ chối (đã đo thật 18/09/2026).
//
// Máy chủ KHÔNG giữ file: nội dung đi thẳng từ cổng qua tiện ích về trình duyệt, máy chủ chỉ ra
// lệnh "ghi file này vào thư mục kia". Nhờ vậy file lớn không phải qua Vercel hai lần.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'
import { docBangKetQua, docChiTiet, RANGE_MAX_DAYS } from '@/lib/dvcPortal'
import { chuanHoaKy } from '@/lib/taxDeadline'
import {
  duongDanToKhai, duongDanThongBao, tenFileToKhai, tenFileThongBao, macSacThue,
} from '@/lib/tokhaiThuMuc'

export const maxDuration = 60

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const PHIEN_SONG = 15 * 60 * 1000       // tải file lâu hơn đồng bộ, cho rộng thời gian

// Ưu tiên ỔN ĐỊNH: tải file là phần gõ cửa cổng dày nhất, nên nhịp nền còn chậm hơn đồng bộ.
const NHIP_NEN = () => 2500 + Math.floor(Math.random() * 1200)

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const phienTam = new Map()
function donPhienCu() {
  const nay = Date.now()
  for (const [ma, p] of phienTam) if (nay - p.chamNhat > PHIEN_SONG) phienTam.delete(ma)
}

const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const tuISO = s => new Date(`${s}T00:00:00Z`)
const docCsrf = html => html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  || html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]

function chiaCuaSo({ tuNgay, denNgay }) {
  const den0 = denNgay ? tuISO(denNgay) : new Date()
  const tu0 = tuNgay ? tuISO(tuNgay) : new Date(den0.getTime() - 29 * 864e5)
  const cs = []
  let den = den0
  while (den >= tu0 && cs.length < 24) {
    const lui = new Date(den.getTime() - (RANGE_MAX_DAYS - 1) * 864e5)
    const tu = lui > tu0 ? lui : tu0
    cs.push({ tuNgay: ddmmyyyy(tu), denNgay: ddmmyyyy(den) })
    den = new Date(tu.getTime() - 864e5)
  }
  return cs
}

// ── Yêu cầu gửi cho tiện ích ─────────────────────────────────────────────────
const yc = {
  trangDangNhap: () => ({ url: BASE + 'login', method: 'GET' }),
  anhCaptcha: () => ({ url: `${BASE}login/getCaptcha?${Date.now()}`, method: 'GET',
    headers: { Referer: BASE + 'login', Accept: 'image/*' } }),
  dangNhap: (csrf, tenDN, matKhau, captcha) => ({
    url: BASE + 'loginLDAP', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-XSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + 'login', Origin: ORIGIN,
    },
    body: new URLSearchParams({
      tenDN, matKhau: Buffer.from(matKhau, 'utf8').toString('base64'),
      doiTuong: 'DN', captcha, _csrf: csrf,
    }).toString(),
  }),
  trangTraCuu: () => ({ url: BASE + 'tchs', method: 'GET', headers: { Referer: BASE + 'home' } }),
  kiemCaptcha: (csrf, ma) => ({
    url: `${BASE}checkCaptcha?captcha=${encodeURIComponent(ma)}&_=${Date.now()}`, method: 'GET',
    headers: { 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs' },
  }),
  traCuu: (csrf, cs, captcha, trang) => ({
    url: `${BASE}ho-so/search?` + new URLSearchParams({
      maNghiepVu: '', maTTHC: '', maToKhai: '', maHoSo: '',
      tuNgay: cs.tuNgay, denNgay: cs.denNgay, scope_tdt1: 'SELF', mstUyQuyen_tdt1: '',
      captcha, _csrf: csrf, page: String(trang), size: '50',   // cổng chỉ nhận 20/30/50
    }).toString(),
    method: 'GET',
    headers: { 'HX-Request': 'true', 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs', Accept: 'text/html, */*' },
  }),
  chiTiet: maHoSo => ({ url: `${BASE}tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=`, method: 'GET',
    headers: { Referer: BASE + 'tchs' } }),
  // Xin phép trước khi tải tờ khai — thiếu bước này cổng trả "Hồ sơ truyền lên không hợp lệ".
  xinPhep: maHoSo => ({ url: `${BASE}tchs/validateIdTkhai?idTKhai=${encodeURIComponent(maHoSo)}`, method: 'GET',
    headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: BASE + 'tchs' } }),
  taiToKhai: (token, maHoSo) => ({
    url: BASE + 'tchs/downloadhoso', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN },
    body: JSON.stringify({ maHoSo }),
  }),
  taiThongBao: (token, idTbao) => ({
    url: BASE + 'tchs/downloadthongbao', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN },
    body: JSON.stringify({ idTbao, loaiTBao: '' }),
  }),
  dangXuat: csrf => ({ url: BASE + 'logout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf || '', Referer: BASE + 'tchs', Origin: ORIGIN } }),
}

function traYeuCau(p, data) {
  if (data.yeuCau) p.yeuCauCuoi = data.yeuCau
  const heSo = p.so429 ? 2.5 : 1
  return Response.json({ ...data, nghi: Math.round(Math.max(data.nghi || 0, NHIP_NEN()) * heSo) })
}

export async function POST(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const supabase = getAdmin()
  donPhienCu()

  try {
    // ── Bắt đầu ────────────────────────────────────────────────────────────
    if (!body.maPhien) {
      const { clientId, tuNgay = null, denNgay = null, taiLai = false } = body
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền tải file của công ty này' }, { status: 403 })
      }

      const [{ data: cty }, { data: tk }, { data: loaiTK }] = await Promise.all([
        supabase.from('clients').select('id, name, client_code').eq('id', clientId).single(),
        supabase.from('tax_accounts').select('username').eq('client_id', clientId).eq('portal', 'dvc').maybeSingle(),
        supabase.from('tax_filing_types').select('id, code, tax_kind, ma_tkhai_portal, period_kind'),
      ])
      if (!tk) return Response.json({ error: 'Công ty này chưa có tài khoản cổng Dịch vụ công' }, { status: 400 })
      // Mã khách hàng là bắt buộc: thiếu thì không đặt được tên file theo quy ước Savitax.
      if (!cty?.client_code) {
        return Response.json({ error: `${cty?.name || 'Công ty'} chưa có Mã khách hàng — bổ sung trong hồ sơ công ty rồi mới tải được file` }, { status: 400 })
      }

      // Hồ sơ đã tải file rồi thì bỏ qua, trừ khi người dùng cố ý tải lại.
      const { data: daTai } = await supabase.from('tax_filings')
        .select('portal_code, file_path').eq('client_id', clientId).not('file_path', 'is', null)

      const maPhien = crypto.randomUUID()
      phienTam.set(maPhien, {
        clientId, staffId: auth.caller.staffId, maKH: cty.client_code, tenCty: cty.name,
        csrf: null, buoc: 'trang_dang_nhap', chamNhat: Date.now(),
        cuaSo: chiaCuaSo({ tuNgay, denNgay }), viCuaSo: 0,
        loaiTK: loaiTK || [],
        daTai: taiLai ? new Set() : new Set((daTai || []).map(f => f.portal_code)),
        hangDoi: [], viHangDoi: 0, buocFile: null, viThongBao: 0,
        chiTietHienTai: null, tokenTai: null,
        soFile: 0, soBoQua: 0, loi: [],
      })
      const p = phienTam.get(maPhien)
      return traYeuCau(p, {
        maPhien, viec: 'goi', buoc: p.buoc, yeuCau: yc.trangDangNhap(),
        khoangNgay: `${p.cuaSo[p.cuaSo.length - 1].tuNgay} – ${p.cuaSo[0].denNgay}`,
        soCuaSo: p.cuaSo.length, tenCty: cty.name, maKH: cty.client_code,
      })
    }

    if (body.huy) {
      const pHuy = phienTam.get(body.maPhien)
      if (pHuy) return ketThuc(supabase, pHuy, body.maPhien, 'Người dùng dừng giữa chừng')
      return Response.json({ viec: 'loi', moTa: 'Phiên đã đóng' })
    }

    const p = phienTam.get(body.maPhien)
    if (!p) return Response.json({ error: 'Phiên đã hết hạn, bấm Tải lại' }, { status: 410 })
    p.chamNhat = Date.now()
    if (!(await canAccessCredentials(supabase, auth.caller, p.clientId))) {
      return Response.json({ error: 'Không có quyền tải file của công ty này' }, { status: 403 })
    }

    // ── Người vừa gõ captcha ───────────────────────────────────────────────
    if (body.captcha) {
      const ma = String(body.captcha).trim()
      if (p.buoc === 'cho_captcha_dn') {
        const { data: tk } = await supabase.from('tax_accounts')
          .select('username, password_enc').eq('client_id', p.clientId).eq('portal', 'dvc').maybeSingle()
        p.buoc = 'dang_nhap'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.dangNhap(p.csrf, tk.username, decrypt(tk.password_enc), ma) })
      }
      if (p.buoc === 'cho_captcha_tc') {
        p.maCaptcha = ma
        p.buoc = 'kiem_captcha'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.kiemCaptcha(p.csrf, ma) })
      }
      return Response.json({ error: 'Chưa tới lúc nhập mã' }, { status: 400 })
    }

    const ph = body.phanHoi
    if (!ph) return Response.json({ error: 'Thiếu phản hồi' }, { status: 400 })
    if (!ph.ok) return ketThuc(supabase, p, body.maPhien, ph.loi || 'Tiện ích gọi cổng thất bại')

    // 429: lùi lại rồi gửi lại đúng yêu cầu vừa rồi.
    if (ph.status === 429 && p.yeuCauCuoi) {
      p.so429 = (p.so429 || 0) + 1
      if (p.so429 > 3) return ketThuc(supabase, p, body.maPhien, 'Cổng chặn vì gọi quá dày (429). Nghỉ 10–15 phút rồi tải lại.')
      const cho = [20000, 60000, 120000][p.so429 - 1]
      return Response.json({ viec: 'goi', buoc: p.buoc, yeuCau: p.yeuCauCuoi, nghi: cho,
        tienDo: `Cổng báo quá dày — chờ ${cho / 1000} giây rồi thử lại (lần ${p.so429}/3)` })
    }

    const noiDung = ph.noiDung || ''

    switch (p.buoc) {
      case 'trang_dang_nhap':
        p.csrf = docCsrf(noiDung)
        if (!p.csrf) return ketThuc(supabase, p, body.maPhien, 'Không đọc được mã bảo vệ của cổng')
        p.buoc = 'anh_captcha_dn'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha() })

      case 'anh_captcha_dn':
        p.buoc = 'cho_captcha_dn'
        return Response.json({ viec: 'go_captcha', buoc: p.buoc, nhan: 'đăng nhập',
          anhCaptcha: 'data:image/png;base64,' + noiDung })

      case 'dang_nhap': {
        if (/"status"\s*:\s*"?20[01]"?/.test(noiDung)) {
          p.buoc = 'trang_tra_cuu'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.trangTraCuu() })
        }
        let moTa = ''
        try { moTa = JSON.parse(noiDung).desc || '' } catch { moTa = noiDung.slice(0, 200) }
        if (/captcha/i.test(moTa) || /captcha/i.test(noiDung)) {
          p.buoc = 'anh_captcha_dn'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha(), moTa: 'Mã captcha chưa đúng' })
        }
        return ketThuc(supabase, p, body.maPhien, 'Sai mật khẩu: ' + moTa)
      }

      case 'trang_tra_cuu':
        p.csrf = docCsrf(noiDung) || p.csrf    // token ĐỔI sau khi đăng nhập
        p.buoc = 'anh_captcha_tc'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha() })

      case 'anh_captcha_tc':
        p.buoc = 'cho_captcha_tc'
        return Response.json({ viec: 'go_captcha', buoc: p.buoc, nhan: 'tra cứu',
          anhCaptcha: 'data:image/png;base64,' + noiDung })

      case 'kiem_captcha':
        if (noiDung.trim() !== 'success') {
          p.buoc = 'anh_captcha_tc'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.anhCaptcha(), moTa: 'Mã captcha chưa đúng' })
        }
        return traCuuCuaSo(p, 0)

      case 'tra_cuu': {
        const { ds } = docBangKetQua(noiDung, { ...p.cuaSo[p.viCuaSo], trang: 0 })
        // Chỉ xếp hàng những hồ sơ CHƯA có file — tải lại thứ đã có chỉ tổ gõ cửa cổng thêm.
        p.hangDoi = ds.filter(r => !p.daTai.has(r.maHoSo))
        p.soBoQua += ds.length - p.hangDoi.length
        p.viHangDoi = 0
        return hoSoKeTiep(p, null)
      }

      // ── Với mỗi hồ sơ: chi tiết → xin phép → tải tờ khai → tải từng thông báo ──
      case 'chi_tiet': {
        p.chiTietHienTai = docChiTiet(noiDung)
        // Token để tải nằm TRONG trang chi tiết, không phải token của phiên.
        p.tokenTai = noiDung.match(/id="csrfToken"\s+value="([^"]+)"/)?.[1] || p.csrf
        p.viThongBao = 0
        p.buoc = 'xin_phep'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.xinPhep(hoSoHienTai(p).maHoSo),
          tienDo: `Xin phép tải ${hoSoHienTai(p).maHoSo}` })
      }

      case 'xin_phep': {
        if (noiDung.trim() !== '200') {
          p.loi.push(`${hoSoHienTai(p).maHoSo}: cổng từ chối cho tải (${noiDung.trim().slice(0, 40)})`)
          p.viHangDoi++
          return hoSoKeTiep(p, null)
        }
        p.buoc = 'tai_to_khai'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.taiToKhai(p.tokenTai, hoSoHienTai(p).maHoSo),
          tienDo: `Tải tờ khai ${hoSoHienTai(p).maHoSo}` })
      }

      case 'tai_to_khai': {
        const hs = hoSoHienTai(p)
        const ghi = duongDanFileToKhai(p, hs, noiDung)
        p.buoc = 'tai_thong_bao'
        return tiepThongBao(p, ghi)
      }

      case 'tai_thong_bao': {
        const hs = hoSoHienTai(p)
        const tb = p.chiTietHienTai?.thongBao?.[p.viThongBao - 1]
        const ghi = tb ? duongDanFileThongBao(p, hs, tb, noiDung) : null
        return tiepThongBao(p, ghi)
      }

      case 'dang_xuat':
        return ketThuc(supabase, p, body.maPhien, null)

      default:
        return Response.json({ error: 'Bước không hợp lệ: ' + p.buoc }, { status: 400 })
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

const hoSoHienTai = p => p.hangDoi[p.viHangDoi] || null

function traCuuCuaSo(p, viTri, ghiFile) {
  p.viCuaSo = viTri
  p.buoc = 'tra_cuu'
  return traYeuCau(p, {
    viec: 'goi', buoc: p.buoc, nghi: 5000, ghiFile,
    yeuCau: yc.traCuu(p.csrf, p.cuaSo[viTri], p.maCaptcha, 0),
    tienDo: `Tra cửa sổ ${viTri + 1}/${p.cuaSo.length} (${p.cuaSo[viTri].tuNgay} – ${p.cuaSo[viTri].denNgay})`,
  })
}

// Hết hồ sơ trong cửa sổ này thì sang cửa sổ kế; hết cửa sổ thì đăng xuất.
// ghiFile đi kèm để lệnh ghi của lượt tải VỪA RỒI không bị rơi mất khi chuyển bước — trình duyệt
// ghi file trước rồi mới gọi yêu cầu kế tiếp.
function hoSoKeTiep(p, ghiFile) {
  if (p.viHangDoi < p.hangDoi.length) {
    p.buoc = 'chi_tiet'
    return traYeuCau(p, {
      viec: 'goi', buoc: p.buoc, ghiFile, yeuCau: yc.chiTiet(hoSoHienTai(p).maHoSo),
      tienDo: `Cửa sổ ${p.viCuaSo + 1}/${p.cuaSo.length} — hồ sơ ${p.viHangDoi + 1}/${p.hangDoi.length}`,
    })
  }
  if (p.viCuaSo + 1 < p.cuaSo.length) return traCuuCuaSo(p, p.viCuaSo + 1, ghiFile)
  p.buoc = 'dang_xuat'
  return traYeuCau(p, { viec: 'goi', buoc: p.buoc, ghiFile, yeuCau: yc.dangXuat(p.csrf), tienDo: 'Đang đăng xuất' })
}

// Còn thông báo thì tải tiếp, hết thì sang hồ sơ sau.
function tiepThongBao(p, ghiFile) {
  const ds = p.chiTietHienTai?.thongBao || []
  if (p.viThongBao < ds.length) {
    const tb = ds[p.viThongBao]
    p.viThongBao++
    if (!tb.portalId) return tiepThongBao(p, ghiFile)
    p.buoc = 'tai_thong_bao'
    return traYeuCau(p, {
      viec: 'goi', buoc: p.buoc, yeuCau: yc.taiThongBao(p.tokenTai, tb.portalId),
      ghiFile, tienDo: `Tải thông báo ${p.viThongBao}/${ds.length}`,
    })
  }
  p.viHangDoi++
  return hoSoKeTiep(p, ghiFile)
}

// Máy chủ chỉ tính TÊN và ĐƯỜNG DẪN; nội dung file do trình duyệt giữ (nó vừa nhận từ cổng).
function duongDanFileToKhai(p, hs, noiDungJson) {
  try {
    const j = JSON.parse(noiDungJson)
    if (!j?.content) { p.loi.push(`${hs.maHoSo}: cổng không trả nội dung tờ khai`); return null }
    const loai = timLoai(p, hs)
    const ky = chuanHoaKy(hs.kyTinhThue, loai?.period_kind || 'quarter') || 'PS.' + (hs.ngayNop || '').slice(0, 10)
    p.soFile++
    return {
      duongDan: duongDanToKhai({ periodCode: ky, maKH: p.maKH, maToKhai: loai?.code }),
      tenFile: tenFileToKhai({ sacThue: macSacThue(loai), periodCode: ky, maKH: p.maKH, duoi: duoiTheoKieu(j.fileType) }),
      maHoSo: hs.maHoSo,
    }
  } catch (e) {
    p.loi.push(`${hs.maHoSo}: ${e.message}`)
    return null
  }
}

function duongDanFileThongBao(p, hs, tb, noiDungJson) {
  try {
    const j = JSON.parse(noiDungJson)
    if (!j?.content) return null
    const loai = timLoai(p, hs)
    const ky = chuanHoaKy(hs.kyTinhThue, loai?.period_kind || 'quarter') || 'PS.' + (hs.ngayNop || '').slice(0, 10)
    p.soFile++
    return {
      duongDan: duongDanThongBao({ periodCode: ky, maKH: p.maKH, maToKhai: loai?.code }),
      tenFile: tenFileThongBao({ loaiThongBao: tb.loai, sacThue: macSacThue(loai), periodCode: ky, maKH: p.maKH, duoi: duoiTheoKieu(j.fileType) }),
      maHoSo: hs.maHoSo,
      laThongBao: true,
    }
  } catch (e) {
    p.loi.push(`${hs.maHoSo}: ${e.message}`)
    return null
  }
}

const duoiTheoKieu = kieu => /zip/i.test(kieu || '') ? 'zip' : /pdf/i.test(kieu || '') ? 'pdf' : 'xml'

function timLoai(p, hs) {
  return p.loaiTK.find(t => t.ma_tkhai_portal && t.ma_tkhai_portal === hs.maToKhaiCong)
    || p.loaiTK.find(t => hs.tenToKhai && t.code === hs.tenToKhai.split(' - ')[0].trim())
    || null
}

async function ketThuc(supabase, p, maPhien, loi) {
  await supabase.from('tax_access_logs').insert({
    staff_id: p.staffId, client_id: p.clientId, action: 'download',
    detail: { so_file: p.soFile, bo_qua: p.soBoQua, loi: p.loi.slice(0, 5), ket_qua: loi ? 'loi' : 'xong' },
  })
  phienTam.delete(maPhien)
  if (loi) return Response.json({ viec: 'loi', moTa: loi, soFile: p.soFile })
  return Response.json({
    viec: 'xong', soFile: p.soFile, soBoQua: p.soBoQua, loi: p.loi.slice(0, 5),
    tenCty: p.tenCty, maKH: p.maKH,
  })
}
