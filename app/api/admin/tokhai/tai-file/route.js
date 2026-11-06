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
import { ghiHoSoVaThongBao } from '@/lib/tokhaiGhi'
import { decrypt } from '@/lib/taxCrypto'
import { docBangKetQua, docBangKetQuaEtax, docChiTiet, doanLoaiToKhaiTuTen } from '@/lib/dvcPortal'
import { chiaCuaSo } from '@/lib/tokhaiCuaSo'
import { chuanHoaKyBang } from '@/lib/taxDeadline'
import {
  duongDanToKhai, duongDanThongBao, tenFileToKhai, tenFileThongBao, macSacThue, tachKy,
  soLanBoSung, duongDanGnt, tenFileGnt,
} from '@/lib/tokhaiThuMuc'
import { ycGnt, docDiaChiSso, docForm, laTrangTraCuuGnt, docBangGnt, xmlTuPhanHoi, tenTheoNoiDung, laGntLoi } from '@/lib/gntCong'

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

const docCsrf = html => html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  || html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1]


// ── Yêu cầu gửi cho tiện ích ─────────────────────────────────────────────────
const yc = {
  trangDangNhap: () => ({ url: BASE + 'login', method: 'GET' }),
  anhCaptcha: () => ({ url: `${BASE}login/getCaptcha?${Date.now()}`, method: 'GET',
    headers: { Referer: BASE + 'login', Accept: 'image/*' } }),
    // doiTuong: 'DN' = doanh nghiệp, 'CN' = cá nhân / hộ kinh doanh. Trang đăng nhập của cổng
    // hỏi "Đối tượng đăng nhập" rồi gửi đúng tham số này (processChonDT → submitLDAP); chọn sai là
    // cổng báo sai tài khoản dù mật khẩu đúng. Hộ kinh doanh còn KHÔNG có đuôi '-QL' ở tên đăng
    // nhập — xem clients.is_hkd.
  dangNhap: (csrf, tenDN, matKhau, captcha, doiTuong = 'DN') => ({
    url: BASE + 'loginLDAP', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-XSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + 'login', Origin: ORIGIN,
    },
    body: new URLSearchParams({
      tenDN, matKhau: Buffer.from(matKhau, 'utf8').toString('base64'),
      doiTuong, captcha, _csrf: csrf,
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
  // Tra cứu TAB CŨ — hồ sơ nộp trước 01/07/2025. POST form, tham số đuôi _tdt, phạm vi
  // scope_tdt2. maToKhai_tdt để trống = mọi sắc thuế. Ba header hx-* bắt buộc, thiếu thì cổng
  // trả cả trang thay vì mảnh bảng và bộ đọc ra 0 dòng.
  traCuuEtax: (csrf, cs, captcha) => ({
    url: BASE + 'tchs/thuedientu', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded', 'X-XSRF-TOKEN': csrf,
      'HX-Request': 'true', 'HX-Target': 'bangKetQuaTraCuu_tdt', 'HX-Trigger': 'form_search_tdt',
      'HX-Current-URL': BASE + 'tchs',
      Referer: BASE + 'tchs', Origin: ORIGIN, Accept: 'text/html-partial',
    },
    body: new URLSearchParams({
      _csrf: csrf, page: '', size: '', maToKhai_tdt: '', maGiaoDichTthc_tdt: '',
      tuNgay_tdt: cs.tuNgay, denNgay_tdt: cs.denNgay,
      scope_tdt2: 'SELF', mstUyQuyen_tdt2: '', captcha, btnSearch_tdt: '',
    }).toString(),
  }),
  // Trang chi tiết: `loai` LUÔN ĐỂ TRỐNG, kể cả hồ sơ tab cũ.
//
  // ⚠ Nghe phản trực giác nên ghi rõ kẻo người sau "sửa lại cho đúng": trình duyệt khi bấm Xem chi
  // tiết thì đi vào /files/detail/<mã>?loai=ETAX, nên 11/10/2026 em theo y vậy — và cổng trả 500
  // "Đã có lỗi hệ thống xảy ra!" cho TẤT CẢ 8 hồ sơ. Để trống thì chính những hồ sơ cũ đó đọc được
  // bình thường (đo thật cùng công ty, cùng phiên, chỉ khác tham số này).
  // Đoán: nhánh ETAX của cổng cần thêm trạng thái mà lượt gọi thuần không có. Dù lý do gì thì bằng
  // chứng rõ: ĐỂ TRỐNG LÀ CHẠY.
  chiTiet: maHoSo => ({
    url: `${BASE}tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=`, method: 'GET',
    headers: { Referer: BASE + 'tchs' } }),
  // Xin phép trước khi tải tờ khai — thiếu bước này cổng trả "Hồ sơ truyền lên không hợp lệ".
  xinPhep: maHoSo => ({ url: `${BASE}tchs/validateIdTkhai?idTKhai=${encodeURIComponent(maHoSo)}`, method: 'GET',
    headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: BASE + 'tchs' } }),
  // Hồ sơ cũ chỉ khác cái đuôi địa chỉ; thân yêu cầu y nguyên (đã bắt gói thật 11/10/2026).
  taiToKhai: (token, maHoSo, nguon) => ({
    url: BASE + (nguon === 'etax' ? 'tchs/downloadhoso-tdt?loaiTraCuu=ETAX' : 'tchs/downloadhoso'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN },
    body: JSON.stringify({ maHoSo }),
  }),
  taiThongBao: (token, idTbao, nguon) => ({
    url: BASE + (nguon === 'etax' ? 'tchs/downloadthongbao-tdt?loaiTraCuu=ETAX' : 'tchs/downloadthongbao'),
    method: 'POST',
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
      // toKhai (mặc định có) / gnt: chọn tải tờ khai + thông báo, giấy nộp tiền, hoặc cả hai (04/11/2026)
      const { clientId, tuNgay = null, denNgay = null, taiLai = false, toKhai = true, gnt = false } = body
      if (!toKhai && !gnt) return Response.json({ error: 'Chọn ít nhất một loại: tờ khai hoặc giấy nộp tiền' }, { status: 400 })
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền tải file của công ty này' }, { status: 403 })
      }

      const [{ data: cty }, { data: tk }, { data: loaiTK }] = await Promise.all([
        supabase.from('clients').select('id, name, client_code, is_hkd').eq('id', clientId).single(),
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
        doiTuong: cty.is_hkd ? 'CN' : 'DN',
        csrf: null, buoc: 'trang_dang_nhap', chamNhat: Date.now(),
        cuaSo: chiaCuaSo({ tuNgay, denNgay }), viCuaSo: 0,
        loaiTK: loaiTK || [],
        daTai: taiLai ? new Set() : new Set((daTai || []).map(f => f.portal_code)),
        hangDoi: [], viHangDoi: 0, buocFile: null, viThongBao: 0,
        chiTietHienTai: null, tokenTai: null,
        soFile: 0, soBoQua: 0, loi: [],
        toKhai: toKhai !== false,
        // Giấy nộp tiền: tra theo "Ngày lập GNT" trong CÙNG khoảng ngày nhân viên chọn
        gnt: gnt ? { bat: true, xong: false, form: null, hangDoi: [], vi: 0, trang: 1, soTrang: 1, soFile: 0, buocNhay: 0 } : { bat: false },
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

    // ── Trình duyệt báo đã ghi được file xuống đĩa ─────────────────────────
    //
    // Máy chủ không ghi file, nên chỉ trình duyệt mới biết hồ sơ nào đã nằm trên đĩa thật. Ghi lại
    // vào tax_filings.file_path để lần chạy sau BỎ QUA hồ sơ đó.
    //
    // ⚠ Đoạn đọc cột này (khi mở phiên) có từ đầu, nhưng KHÔNG CHỖ NÀO GHI vào — nên chức năng
    // "bỏ qua hồ sơ đã tải" chưa bao giờ chạy: lần nào cũng tải lại từ đầu, đẻ ra file _v2, _v3 và
    // gõ cửa cổng thêm mấy chục lượt vô ích. Phát hiện 29/09/2026 khi soi thư mục sau lượt chạy thật.
    if (body.daGhi?.maHoSo) {
      await supabase.from('tax_filings')
        .update({ file_path: String(body.daGhi.duongDan || '').slice(0, 500) })
        .eq('client_id', p.clientId).eq('portal_code', body.daGhi.maHoSo)
      p.daTai.add(body.daGhi.maHoSo)
    }

    // ── Người vừa gõ captcha ───────────────────────────────────────────────
    if (body.captcha) {
      const ma = String(body.captcha).trim()
      if (p.buoc === 'cho_captcha_dn') {
        const { data: tk } = await supabase.from('tax_accounts')
          .select('username, password_enc').eq('client_id', p.clientId).eq('portal', 'dvc').maybeSingle()
        p.buoc = 'dang_nhap'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.dangNhap(p.csrf, tk.username, decrypt(tk.password_enc), ma, p.doiTuong) })
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
        // Chỉ tải giấy nộp tiền: khỏi tra hồ sơ (đỡ một mã captcha), sang thẳng cổng eTax
        if (!p.toKhai) return batDauGnt(p, null)
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
        // ⚠ ĐỪNG quay về cửa sổ 0. Bước này còn chạy GIỮA CHỪNG vì cửa sổ tab cũ nào cũng đòi mã
        // mới (xem cuaSoKeTiep) — reset là tải lại từ đầu, không bao giờ đi hết khoảng ngày.
        if (!p.daTraCuu) { p.daTraCuu = true; p.viCuaSo = 0 }
        return traCuuCuaSo(p, p.viCuaSo)

      case 'tra_cuu': {
        const cs = p.cuaSo[p.viCuaSo]
        const { ds } = cs.nguon === 'etax'
          ? docBangKetQuaEtax(noiDung, cs)
          : docBangKetQua(noiDung, { ...cs, trang: 0 })
        // Hồ sơ nhớ mình đến từ tab nào: các bước sau (chi tiết, tải) cần biết để gọi đúng địa chỉ.
        for (const r of ds) r.nguon = cs.nguon

        // GHI HỒ SƠ VÀO CƠ SỞ DỮ LIỆU NGAY, dùng chung hàm với màn hình Đồng bộ.
        //
        // ⚠ Trước 11/10/2026 màn hình này KHÔNG ghi gì: nó chỉ cập nhật `file_path` vào dòng hồ sơ
        // CÓ SẴN. Công ty chưa đồng bộ lần nào thì không có dòng nào để cập nhật — lệnh chạy, khớp
        // 0 dòng, KHÔNG báo lỗi. Hậu quả thấy ở ca GSC AUTO (anh phát hiện): 12 file nằm trên đĩa
        // mà app coi như chưa có hồ sơ nào, nên (a) Hồ sơ đã nộp / Lịch hạn nộp / Báo cáo đều
        // trống, (b) lần tải sau không biết đã tải rồi nên tải lại hết, đẻ ra _v2, _v3.
        //
        // Dữ liệu đã nằm sẵn trong tay (chính nó đặt được tên file TK_GTGT_Q2.2025_GSC.xml) nên
        // vứt đi là tự làm hỏng dữ liệu của mình.
        try {
          await ghiHoSoVaThongBao(supabase, p.clientId, ds)
        } catch (e) {
          // Ghi hỏng thì VẪN CHO TẢI TIẾP — file về đĩa quan trọng hơn, nhân viên đang ngồi gõ mã.
          p.loi.push('Không ghi được hồ sơ vào cơ sở dữ liệu: ' + e.message)
        }

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
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yc.taiToKhai(p.tokenTai, hoSoHienTai(p).maHoSo, hoSoHienTai(p).nguon),
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

      // ── Giấy nộp tiền: SSO sang eTax → trang tra cứu → tra → tải từng giấy (lib/gntCong.js) ──
      // Ghé eTax trước để trình duyệt có cookie eTax như máy nhân viên đã từng vào cổng. Đo 04/11/2026:
      // trình duyệt thật mở địa chỉ SSO ra NGAY trang tra cứu (200); tiện ích chưa có cookie eTax thì bị 302
      // rồi rơi vào trang "chưa được phân quyền". Lượt này chỉ để lấy cookie, nội dung trả về bỏ qua.
      case 'gnt_lam_nong': {
        p.buoc = 'gnt_sso'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: ycGnt.sso(p.csrf), tienDo: 'Giấy nộp tiền: mở cổng eTax' })
      }

      case 'gnt_sso': {
        const url = docDiaChiSso(noiDung)
        if (!url) {
          p.loi.push('Giấy nộp tiền: cổng không cấp lối vào eTax (' + noiDung.trim().slice(0, 80) + ')')
          return ketThucGnt(p, null)
        }
        p.buoc = 'gnt_mo'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: ycGnt.mo(url), tienDo: 'Giấy nộp tiền: vào trang tra cứu' })
      }

      case 'gnt_mo': {
        if (laTrangTraCuuGnt(noiDung)) { p.gnt.form = docForm(noiDung); return traCuuGnt(p, 1) }
        // Cổng trả 302 nhiều lượt (đo 04/11/2026, GIẢI PHÁP VIỆT). Tiện ích 1.2 đi theo nhờ cờ theoChuyenHuong.
        // Bản cũ bỏ qua cờ, gọi redirect:'manual' nên chỉ thấy status 0 → báo cập nhật tiện ích.
        // (Mở thẳng /etaxnnt/Request hay /etaxnnt/ cũng chỉ ra 302, đã thử.)
        if (ph.status === 0 || (ph.status >= 300 && ph.status < 400)) {
          console.error('[GNT] SSO chuyển hướng mà tiện ích không đi theo (status', ph.status + ')')
          p.loi.push('Giấy nộp tiền: cần cập nhật tiện ích Chrome "Savitax — Cầu nối cổng thuế" lên bản 1.2')
          return ketThucGnt(p, null)
        }
        // Trang trung gian (tự gửi biểu mẫu / tự chuyển trang) — đi theo tối đa 5 bước
        const tiep = p.gnt.buocNhay < 5 ? timChuyenTiep(noiDung) : null
        if (tiep) { p.gnt.buocNhay++; return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: tiep, tienDo: 'Giấy nộp tiền: vào trang tra cứu' }) }
        // Đo 04/11/2026 (GIẢI PHÁP VIỆT): eTax vào được nhưng trả "Lỗi truy cập — Bạn chưa được phân quyền sử dụng chức năng này!"
        if (/chưa được phân quyền/i.test(noiDung)) {
          console.error('[GNT] eTax báo chưa được phân quyền chức năng tra cứu GNT — trang cuối:', String(ph.urlCuoi || '').replace(/code=[^&]+/, 'code=…'))
          p.loi.push('Giấy nộp tiền: cổng eTax báo tài khoản "chưa được phân quyền sử dụng chức năng này" (tra cứu giấy nộp tiền)')
          return ketThucGnt(p, null)
        }
        console.error('[GNT] không nhận ra trang sau SSO — status', ph.status, '| tiêu đề:', noiDung.match(/<title>([^<]*)/i)?.[1]?.trim(),
          '| biểu mẫu:', [...noiDung.matchAll(/<form\b[^>]*>/gi)].map(m => m[0]).join(' '),
          '| goProc/nextEvent:', [...new Set([...noiDung.matchAll(/(?:goProc|nextEvent)\([^)]*\)/g)].map(m => m[0]))].slice(0, 30).join(' '),
          '| đầu trang:', noiDung.replace(/\s+/g, ' ').slice(0, 2500))
        p.loi.push('Giấy nộp tiền: không vào được trang tra cứu của cổng eTax')
        return ketThucGnt(p, null)
      }

      case 'gnt_tra_cuu': {
        const f = docForm(noiDung)
        if (!f || !laTrangTraCuuGnt(noiDung)) {
          console.error('[GNT] trang tra cứu lạ — đầu trang:', noiDung.replace(/\s+/g, ' ').slice(0, 2500))
          p.loi.push('Giấy nộp tiền: cổng trả trang tra cứu không đọc được')
          return ketThucGnt(p, null)
        }
        p.gnt.form = f      // dse_pageId / dse_processorId đổi theo từng trang — luôn dùng bản mới nhất
        const kq = docBangGnt(noiDung)
        // Bỏ giấy ngân hàng báo lỗi / không thành công (anh chốt 06/11/2026) — xem laGntLoi
        const giayLoi = kq.ds.filter(d => laGntLoi(d.trangThai))
        p.gnt.soLoi = (p.gnt.soLoi || 0) + giayLoi.length
        kq.ds = kq.ds.filter(d => !laGntLoi(d.trangThai))
        p.gnt.hangDoi = kq.ds; p.gnt.vi = 0; p.gnt.trang = kq.trang; p.gnt.soTrang = kq.soTrang
        return taiGntKeTiep(p, null)
      }

      case 'gnt_tai': {
        const dong = p.gnt.hangDoi[p.gnt.vi]
        p.gnt.vi++
        const xml = xmlTuPhanHoi(ph)
        if (!xml) {
          p.loi.push(`Giấy nộp tiền ${dong?.soGnt || dong?.id}: cổng không trả file XML`)
          return taiGntKeTiep(p, null)
        }
        try {
          const { periodCode, sacThue } = tenTheoNoiDung(xml)
          const ghi = {
            duongDan: duongDanGnt({ periodCode, maKH: p.maKH }),
            tenFile: tenFileGnt({ sacThue, periodCode, maKH: p.maKH }),
            nam: tachKy(periodCode)?.nam || null,
            laGnt: true,
          }
          p.soFile++; p.gnt.soFile++
          return taiGntKeTiep(p, ghi)
        } catch (e) {
          p.loi.push(`Giấy nộp tiền ${dong?.soGnt || dong?.id}: ${e.message}`)
          return taiGntKeTiep(p, null)
        }
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
    // Chọn đúng tab theo cửa sổ. Gọi nhầm tab thì cổng trả bảng RỖNG chứ không báo lỗi — nhìn y
    // hệt "công ty không nộp gì", nên đừng bao giờ gọi thẳng một trong hai hàm.
    yeuCau: p.cuaSo[viTri].nguon === 'etax'
      ? yc.traCuuEtax(p.csrf, p.cuaSo[viTri], p.maCaptcha)
      : yc.traCuu(p.csrf, p.cuaSo[viTri], p.maCaptcha, 0),
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
  if (p.viCuaSo + 1 < p.cuaSo.length) {
    // TAB CŨ KHÔNG CHO DÙNG LẠI MÃ CAPTCHA (đo thật 11/10/2026) — mỗi cửa sổ một mã mới. Tab DVC
    // thì dùng lại được cả phiên, giữ nguyên như cũ để khỏi bắt gõ thêm vô ích.
    if (p.cuaSo[p.viCuaSo + 1].nguon === 'etax') {
      p.viCuaSo += 1
      p.buoc = 'anh_captcha_tc'
      return traYeuCau(p, {
        viec: 'goi', buoc: p.buoc, nghi: 5000, ghiFile, yeuCau: yc.anhCaptcha(),
        tienDo: `Cửa sổ ${p.viCuaSo + 1}/${p.cuaSo.length} (hồ sơ cũ) — cần mã mới`,
      })
    }
    return traCuuCuaSo(p, p.viCuaSo + 1, ghiFile)
  }
  // Hết tờ khai: còn giấy nộp tiền thì làm tiếp trong CÙNG phiên đăng nhập, rồi mới đăng xuất
  if (p.gnt?.bat && !p.gnt.xong) return batDauGnt(p, ghiFile)
  p.buoc = 'dang_xuat'
  return traYeuCau(p, { viec: 'goi', buoc: p.buoc, ghiFile, yeuCau: yc.dangXuat(p.csrf), tienDo: 'Đang đăng xuất' })
}

// ── Giấy nộp tiền ────────────────────────────────────────────────────────────
// Khoảng "Ngày lập GNT" = đúng khoảng ngày nhân viên chọn (cửa sổ cuối là phần CŨ nhất)
const khoangGnt = p => ({ tu: p.cuaSo[p.cuaSo.length - 1].tuNgay, den: p.cuaSo[0].denNgay })

function batDauGnt(p, ghiFile) {
  p.buoc = 'gnt_lam_nong'
  return traYeuCau(p, { viec: 'goi', buoc: p.buoc, ghiFile, yeuCau: ycGnt.lamNong(), tienDo: 'Giấy nộp tiền: mở cổng eTax' })
}

function traCuuGnt(p, trang) {
  const k = khoangGnt(p)
  p.buoc = 'gnt_tra_cuu'
  return traYeuCau(p, {
    viec: 'goi', buoc: p.buoc,
    yeuCau: ycGnt.guiForm(p.gnt.form, { dse_nextEventName: 'query', pn: String(trang), ctuId: '', ngay_lap_tu_ngay: k.tu, ngay_lap_den_ngay: k.den }),
    tienDo: `Giấy nộp tiền: tra cứu ${k.tu} – ${k.den}` + (trang > 1 ? ` (trang ${trang})` : ''),
  })
}

// Còn giấy trong trang này thì tải, hết thì sang trang kết quả kế, hết trang thì xong phần GNT.
// ghiFile đi kèm: lệnh ghi của giấy VỪA tải (nội dung nằm ở phản hồi lượt trước — xem tokhaiTaiFileClient)
function taiGntKeTiep(p, ghiFile) {
  const g = p.gnt
  if (g.vi < g.hangDoi.length) {
    p.buoc = 'gnt_tai'
    return traYeuCau(p, {
      viec: 'goi', buoc: p.buoc, ghiFile,
      yeuCau: ycGnt.guiForm(g.form, { dse_nextEventName: 'download', ctuId: g.hangDoi[g.vi].id }),
      tienDo: `Tải giấy nộp tiền ${g.vi + 1}/${g.hangDoi.length}` + (g.soTrang > 1 ? ` (trang ${g.trang}/${g.soTrang})` : ''),
    })
  }
  if (g.trang < g.soTrang) {
    // Lệnh ghi của giấy cuối trang phải đi kèm lượt kế tiếp, kẻo rơi mất
    const r = traCuuGnt(p, g.trang + 1)
    return ghiFile ? kemGhi(r, ghiFile) : r
  }
  return ketThucGnt(p, ghiFile)
}

function ketThucGnt(p, ghiFile) {
  p.gnt.xong = true
  p.buoc = 'dang_xuat'
  return traYeuCau(p, { viec: 'goi', buoc: p.buoc, ghiFile, yeuCau: yc.dangXuat(p.csrf), tienDo: 'Đang đăng xuất' })
}

// Gắn ghiFile vào một phản hồi đã dựng (Response.json) — dùng khi chuyển trang kết quả GNT
async function kemGhi(res, ghiFile) {
  const j = await res.json()
  return Response.json({ ...j, ghiFile })
}

// Trang trung gian sau SSO: biểu mẫu tự gửi (onload submit) hoặc lệnh chuyển trang bằng mã / meta refresh.
function timChuyenTiep(html) {
  const s = String(html || '')
  const tuyetDoi = u => new URL(u.replace(/&amp;/g, '&'), 'https://thuedientu.gdt.gov.vn/etaxnnt/').toString()
  // Trang chủ eTax sau đăng nhập SSO (đo 04/11/2026): mã trang kiểm plugin ký số. Có plugin thì gọi
  // goProc('corporateHomeProc','startTTHC') để vào ĐÚNG chức năng DVC đã xin (module). Không có thì sang
  // corpPluginProc. Tra cứu GNT không cần ký số, nên đi thẳng nhánh "đã có plugin". Địa chỉ lấy từ chính
  // dòng mẫu cổng để sẵn trong trang (giữ đúng dse_sessionId / dse_pageId của phiên).
  if (/goProc\(\s*'corporateHomeProc'\s*,\s*'startTTHC'\s*\)/.test(s)) {
    const mau = s.match(/['"](https:\/\/thuedientu\.gdt\.gov\.vn)?(\/etaxnnt\/Request\?[^'"]*dse_operationName=corporateHomeProc[^'"]*dse_nextEventName=startTTHC[^'"]*)['"]/)?.[2]
    const phien = s.match(/dse_sessionId=([\w-]+)/)?.[1]
    const den = mau || (phien && `/etaxnnt/Request?&dse_sessionId=${phien}&dse_applicationId=-1&dse_pageId=4&dse_operationName=corporateHomeProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=startTTHC`)
    if (den) return { url: tuyetDoi(den), method: 'GET', theoChuyenHuong: true, headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } }
  }
  const moForm = s.match(/<form\b[^>]*>/i)
  if (moForm && /\.submit\(\)/.test(s)) {
    const ten = moForm[0].match(/\b(?:id|name)\s*=\s*["']?([\w-]+)/i)?.[1]
    const f = ten ? docForm(s, ten) : null
    const action = moForm[0].match(/\baction\s*=\s*["']([^"']+)/i)?.[1] || '/etaxnnt/Request'
    if (f) {
      // Mã trang đổi ô trước khi gửi (đo 04–06/11/2026, sau corporateHomeProc/startTTHC):
      //   mainForm.dse_operationName.value = "corpQueryTaxProc"; mainForm.submit();
      // Biểu mẫu gốc ghi retailIndexProc, gửi nguyên là eTax báo "chưa được phân quyền". Chỉ áp cho ô có sẵn
      // trong biểu mẫu, bỏ dòng đã chú thích (//).
      for (const dong of s.split(/\r?\n/)) {
        const ma = dong.replace(/^\s*\/\/.*$/, '')
        for (const [, ten, gt] of ma.matchAll(/\.(\w+)\.value\s*=\s*["']([^"']*)["']/g)) {
          if (ten in f.truong) f.truong[ten] = gt
        }
      }
      return {
        url: tuyetDoi(action), theoChuyenHuong: true, method: (moForm[0].match(/\bmethod\s*=\s*["']?(\w+)/i)?.[1] || 'POST').toUpperCase(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://thuedientu.gdt.gov.vn/etaxnnt/', Origin: 'https://thuedientu.gdt.gov.vn' },
        body: new URLSearchParams([...Object.entries(f.truong).filter(([k]) => k !== '__multi'), ...f.truong.__multi]).toString(),
      }
    }
  }
  const den = s.match(/location\.(?:href\s*=|replace\(|assign\()\s*["']([^"']+)["']/i)?.[1]
    || s.match(/http-equiv\s*=\s*["']refresh["'][^>]*url=([^"'>]+)/i)?.[1]
  return den ? { url: tuyetDoi(den), method: 'GET', theoChuyenHuong: true, headers: { Referer: 'https://thuedientu.gdt.gov.vn/etaxnnt/' } } : null
}

// Còn thông báo thì tải tiếp, hết thì sang hồ sơ sau.
// Thông báo TIẾP NHẬN không tải về (anh chốt 31/10/2026: Savitax không lưu, chỉ lưu thông báo CHẤP NHẬN). Ngày tiếp nhận
// để xét đúng/trễ hạn vẫn lấy từ trang chi tiết của cổng (docChiTiet), không cần file. Bớt được một lượt gọi cổng mỗi hồ sơ.
const canTaiThongBao = tb => tb.portalId && tb.loai !== 'tiep_nhan'

function tiepThongBao(p, ghiFile) {
  const ds = p.chiTietHienTai?.thongBao || []
  if (p.viThongBao < ds.length) {
    const tb = ds[p.viThongBao]
    p.viThongBao++
    if (!canTaiThongBao(tb)) return tiepThongBao(p, ghiFile)
    const tai = ds.filter(canTaiThongBao)
    p.buoc = 'tai_thong_bao'
    return traYeuCau(p, {
      viec: 'goi', buoc: p.buoc, yeuCau: yc.taiThongBao(p.tokenTai, tb.portalId, hoSoHienTai(p)?.nguon),
      ghiFile, tienDo: `Tải thông báo ${tai.indexOf(tb) + 1}/${tai.length}`,
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
    // Mặc định 'month' chứ KHÔNG phải 'quarter': cổng ghi quý có tiền tố ('Q4/2024'), năm để
    // trần ('2024'), tháng cũng để trần ('03/2025'). Chuỗi trần rơi xuống nhánh đoán gần như
    // chắc chắn là tháng. Phải khớp y hệt lib/tokhaiGhi.js, nếu không TÊN FILE và KỲ TRONG APP
    // lệch nhau — file nằm một thư mục, app ghi một kỳ khác.
    const ky = chuanHoaKyBang(hs.kyTinhThue, loai?.period_kind) || 'PS.' + (hs.ngayNop || '').slice(0, 10)
    const boSung = soLanBoSung(hs)
    p.soFile++
    return {
      duongDan: duongDanToKhai({ periodCode: ky, maKH: p.maKH, boSung }),
      tenFile: tenFileToKhai({ sacThue: macSacThue(loai), periodCode: ky, maKH: p.maKH, duoi: duoiTheoKieu(j.fileType), boSung }),
      // Năm để trình duyệt biết đi vào thư mục 'Năm <nam>' nào — lấy theo KỲ TÍNH THUẾ, không phải
      // năm hiện tại: tờ khai quý 4/2025 nộp tháng 1/2026 vẫn nằm ở 'Năm 2025'.
      nam: tachKy(ky)?.nam || null,
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
    const ky = chuanHoaKyBang(hs.kyTinhThue, loai?.period_kind) || 'PS.' + (hs.ngayNop || '').slice(0, 10)
    const boSung = soLanBoSung(hs)
    p.soFile++
    return {
      duongDan: duongDanThongBao({ periodCode: ky, maKH: p.maKH, boSung }),
      tenFile: tenFileThongBao({ loaiThongBao: tb.loai, sacThue: macSacThue(loai), periodCode: ky, maKH: p.maKH, duoi: duoiTheoKieu(j.fileType), boSung }),
      nam: tachKy(ky)?.nam || null,
      maHoSo: hs.maHoSo,
      laThongBao: true,
    }
  } catch (e) {
    p.loi.push(`${hs.maHoSo}: ${e.message}`)
    return null
  }
}

const duoiTheoKieu = kieu => /zip/i.test(kieu || '') ? 'zip' : /pdf/i.test(kieu || '') ? 'pdf' : 'xml'

// Tìm loại tờ khai để đặt TÊN FILE. Ba cách, từ chắc chắn tới suy đoán.
//
// ⚠ Cách thứ ba (đoán từ tên) là BẮT BUỘC cho hồ sơ tab cũ: bảng tab đó không có mã tờ khai và
// tên cũng không kèm mã. Thiếu nó thì mọi hồ sơ cũ đặt tên TK_KHAC_… — gặp thật 11/10/2026:
// ba hồ sơ khác nhau (báo cáo tài chính, quyết toán TNDN, quyết toán TNCN) cùng kỳ NAM.2024 ra
// ba file TRÙNG TÊN, chỉ phân biệt bằng _v2, _v3. Kế toán mở thư mục ra không biết file nào là
// tờ gì.
function timLoai(p, hs) {
  return p.loaiTK.find(t => t.ma_tkhai_portal && t.ma_tkhai_portal === hs.maToKhaiCong)
    || p.loaiTK.find(t => hs.tenToKhai && t.code === hs.tenToKhai.split(' - ')[0].trim())
    || p.loaiTK.find(t => t.code === doanLoaiToKhaiTuTen(hs.tenToKhai))
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
    tenCty: p.tenCty, maKH: p.maKH, soGnt: p.gnt?.bat ? p.gnt.soFile : null, soGntLoi: p.gnt?.soLoi || 0,
  })
}
