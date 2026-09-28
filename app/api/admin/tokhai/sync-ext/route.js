// Đồng bộ tờ khai QUA TIỆN ÍCH CHROME — Phân hệ Tờ khai, nhịp B.
//
// Khác route /sync (máy chủ tự gọi cổng, chỉ chạy được ở local có IP Việt Nam): ở đây máy chủ
// KHÔNG gọi cổng lần nào. Nó chỉ dựng sẵn từng yêu cầu HTTP, trang web nhờ tiện ích gọi hộ bằng
// đường mạng của máy nhân viên, rồi đưa phản hồi nguyên văn về đây để đọc.
//
//   POST { clientId, tuNgay, denNgay }        → bắt đầu, trả yêu cầu đầu tiên
//   POST { maPhien, phanHoi }                 → nạp phản hồi, trả yêu cầu kế tiếp
//   POST { maPhien, captcha }                 → nạp mã người vừa gõ
//
// Máy chủ trả về một trong bốn thứ:
//   { viec: 'goi',        yeuCau, nghi }      → nhờ tiện ích gọi tiếp
//   { viec: 'go_captcha', anhCaptcha, nhan }  → dừng lại chờ người gõ
//   { viec: 'xong',       ...tổng kết }
//   { viec: 'loi',        moTa }
//
// Cookie phiên do trình duyệt giữ. Máy chủ chỉ giữ mã bảo vệ (csrf) và tiến độ.
import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { canAccessCredentials } from '@/lib/credentialScope'
import { decrypt } from '@/lib/taxCrypto'
import { docBangKetQua, docChiTiet, RANGE_MAX_DAYS } from '@/lib/dvcPortal'
import { ghiHoSoVaThongBao } from '@/lib/tokhaiGhi'

export const maxDuration = 60

const BASE = 'https://dichvucong.gdt.gov.vn/tthc/'
const ORIGIN = 'https://dichvucong.gdt.gov.vn'
const PHIEN_SONG = 10 * 60 * 1000     // cả lượt tối đa 10 phút, kể cả thời gian người gõ captcha

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Kho phiên trong bộ nhớ tiến trình. Chỉ có csrf + tiến độ, KHÔNG có cookie, KHÔNG có mật khẩu.
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

// ── Các yêu cầu gửi cho tiện ích ─────────────────────────────────────────────
const yeuCauTrangDangNhap = () => ({ url: BASE + 'login', method: 'GET' })

const yeuCauAnhCaptcha = () => ({
  url: `${BASE}login/getCaptcha?${Date.now()}`, method: 'GET',
  headers: { Referer: BASE + 'login', Accept: 'image/*' },
})

const yeuCauDangNhap = (csrf, tenDN, matKhau, captcha) => ({
  url: BASE + 'loginLDAP', method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    // Token IN TRONG TRANG, không phải giá trị cookie XSRF-TOKEN cùng tên.
    'X-XSRF-TOKEN': csrf,
    'X-Requested-With': 'XMLHttpRequest',
    Referer: BASE + 'login', Origin: ORIGIN,
  },
  body: new URLSearchParams({
    tenDN,
    matKhau: Buffer.from(matKhau, 'utf8').toString('base64'),   // cổng nhận mật khẩu dạng base64
    doiTuong: 'DN', captcha, _csrf: csrf,
  }).toString(),
})

const yeuCauTrangTraCuu = () => ({ url: BASE + 'tchs', method: 'GET', headers: { Referer: BASE + 'home' } })

const yeuCauKiemCaptcha = (csrf, ma) => ({
  url: `${BASE}checkCaptcha?captcha=${encodeURIComponent(ma)}&_=${Date.now()}`, method: 'GET',
  headers: { 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs' },
})

const yeuCauTraCuu = (csrf, { tuNgay, denNgay }, captcha, trang) => ({
  url: `${BASE}ho-so/search?` + new URLSearchParams({
    maNghiepVu: '', maTTHC: '', maToKhai: '', maHoSo: '',
    tuNgay, denNgay, scope_tdt1: 'SELF', mstUyQuyen_tdt1: '',
    // Cổng CHỈ nhận cỡ trang 20/30/50; gửi số khác là trả bảng rỗng mà không báo lỗi.
    captcha, _csrf: csrf, page: String(trang), size: '50',
  }).toString(),
  method: 'GET',
  headers: { 'HX-Request': 'true', 'X-XSRF-TOKEN': csrf, Referer: BASE + 'tchs', Accept: 'text/html, */*' },
})

const yeuCauChiTiet = maHoSo => ({
  url: `${BASE}tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=`, method: 'GET',
  headers: { Referer: BASE + 'tchs' },
})

const yeuCauDangXuat = csrf => ({
  url: BASE + 'logout', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf || '', Referer: BASE + 'tchs', Origin: ORIGIN },
})

// Mọi lượt gọi cổng đều cách nhau ít nhất chừng này, không chỉ giữa các cửa sổ tra cứu — chính
// chuỗi lệnh đăng nhập/chi tiết dồn dập cũng là gọi dày. Có thêm chút ngẫu nhiên để nhịp không
// đều tăm tắp như máy.
// Ưu tiên ỔN ĐỊNH, không phải nhanh: bị cổng chặn giữa giờ làm còn tốn thời gian hơn nhiều so
// với việc đồng bộ lâu thêm vài phút. Nhịp nền 2–3 giây, có chút ngẫu nhiên cho khỏi đều như máy.
const NHIP_NEN = () => 2000 + Math.floor(Math.random() * 1000)

// Sau khi đã bị 429 một lần trong lượt này thì CHẬM HẲN LẠI tới cuối lượt — cổng đã khó chịu
// thì đừng tiếp tục gõ cửa với nhịp cũ.
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
    // ── Bắt đầu một lượt ────────────────────────────────────────────────────
    if (!body.maPhien) {
      const { clientId, tuNgay = null, denNgay = null } = body
      if (!clientId) return Response.json({ error: 'Thiếu clientId' }, { status: 400 })
      if (!(await canAccessCredentials(supabase, auth.caller, clientId))) {
        return Response.json({ error: 'Không có quyền đồng bộ công ty này' }, { status: 403 })
      }

      const { data: tk } = await supabase.from('tax_accounts')
        .select('id, username').eq('client_id', clientId).eq('portal', 'dvc').maybeSingle()
      if (!tk) return Response.json({ error: 'Công ty này chưa có tài khoản cổng Dịch vụ công' }, { status: 400 })

      // Cổng khóa mỗi tài khoản vào 1 phiên → chặn 2 lượt cùng công ty chạy song song.
      const { data: dangChay } = await supabase.from('tax_sync_jobs')
        .select('id, started_at').eq('client_id', clientId).is('finished_at', null).maybeSingle()
      if (dangChay) {
        // Không còn phiên nào sống trong bộ nhớ cho công ty này → lượt đó đã chết (người dùng
        // đóng tab, bấm hủy, hoặc máy chủ khởi động lại). Đóng ngay, không bắt chờ hết 10 phút.
        const conSong = [...phienTam.values()].some(x => x.clientId === clientId)
        const treo = !conSong || Date.now() - new Date(dangChay.started_at).getTime() > 10 * 60 * 1000
        if (treo) {
          await supabase.from('tax_sync_jobs').update({
            finished_at: new Date().toISOString(), result: 'captcha_timeout',
            error_detail: 'Lượt cũ đã chết (đóng tab / bấm hủy / hết giờ), tự đóng',
          }).eq('id', dangChay.id)
        } else {
          return Response.json({ error: 'Công ty này đang có một lượt đồng bộ khác chạy dở' }, { status: 409 })
        }
      }

      const { data: job } = await supabase.from('tax_sync_jobs').insert({
        client_id: clientId, portal: 'dvc', trigger_kind: 'manual',
        captcha_entered_by: auth.caller.staffId, captcha_count: 0,
      }).select('id').single()

      const maPhien = crypto.randomUUID()
      phienTam.set(maPhien, {
        clientId, staffId: auth.caller.staffId, jobId: job?.id || null,
        csrf: null, buoc: 'trang_dang_nhap', chamNhat: Date.now(),
        cuaSo: chiaCuaSo({ tuNgay, denNgay }), viCuaSo: 0, trang: 0,
        maCaptchaTraCuu: null, dong: [], chiTiet: new Map(), viChiTiet: 0, soMaDaGo: 0,
      })

      const p = phienTam.get(maPhien)
      return traYeuCau(p, {
        maPhien, viec: 'goi', buoc: p.buoc, yeuCau: yeuCauTrangDangNhap(),
        khoangNgay: `${p.cuaSo[p.cuaSo.length - 1].tuNgay} – ${p.cuaSo[0].denNgay}`,
        soCuaSo: p.cuaSo.length,
      })
    }

    // Người dùng bấm Dừng / Bỏ qua → đóng lượt ngay, đừng để dòng "đang chạy" treo lại.
    if (body.huy) {
      const pHuy = phienTam.get(body.maPhien)
      if (pHuy) return await ketThuc(supabase, pHuy, body.maPhien, 'skipped', 'Người dùng dừng giữa chừng')
      return Response.json({ viec: 'loi', moTa: 'Phiên đã đóng' })
    }

    const p = phienTam.get(body.maPhien)
    if (!p) return Response.json({ error: 'Phiên đã hết hạn, bấm Đồng bộ lại' }, { status: 410 })
    p.chamNhat = Date.now()
    if (!(await canAccessCredentials(supabase, auth.caller, p.clientId))) {
      return Response.json({ error: 'Không có quyền đồng bộ công ty này' }, { status: 403 })
    }

    // ── Người vừa gõ captcha ────────────────────────────────────────────────
    if (body.captcha) {
      const ma = String(body.captcha).trim()
      if (!ma) return Response.json({ error: 'Chưa nhập mã' }, { status: 400 })
      p.soMaDaGo++
      await supabase.from('tax_sync_jobs').update({ captcha_count: p.soMaDaGo }).eq('id', p.jobId)

      if (p.buoc === 'cho_captcha_dn') {
        const { data: tk } = await supabase.from('tax_accounts')
          .select('username, password_enc').eq('client_id', p.clientId).eq('portal', 'dvc').maybeSingle()
        if (!tk) return Response.json({ error: 'Không tìm thấy tài khoản cổng thuế' }, { status: 400 })
        p.buoc = 'dang_nhap'
        return traYeuCau(p, {
          viec: 'goi', buoc: p.buoc,
          yeuCau: yeuCauDangNhap(p.csrf, tk.username, decrypt(tk.password_enc), ma),
        })
      }
      if (p.buoc === 'cho_captcha_tc') {
        p.maCaptchaTraCuu = ma
        p.buoc = 'kiem_captcha'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauKiemCaptcha(p.csrf, ma) })
      }
      return Response.json({ error: 'Chưa tới lúc nhập mã' }, { status: 400 })
    }

    // ── Nạp phản hồi từ tiện ích ────────────────────────────────────────────
    const ph = body.phanHoi
    if (!ph) return Response.json({ error: 'Thiếu phản hồi' }, { status: 400 })
    if (!ph.ok) return await ketThuc(supabase, p, body.maPhien, 'portal_error', ph.loi || 'Tiện ích gọi cổng thất bại')

    // ── Cổng kêu "quá dày" (429): LÙI LẠI rồi gửi lại ĐÚNG yêu cầu vừa rồi ──
    //
    // Giới hạn thật của cổng mình KHÔNG biết, và cũng không đi dò bằng cách tăng dần tốc độ —
    // làm vậy trên cổng Nhà nước bằng tài khoản thật của khách là dại. Thay vào đó: gặp 429 thì
    // chờ lâu dần (20s → 60s → 120s), tối đa 3 lần; vẫn bị thì dừng hẳn lượt này.
    if (ph.status === 429 && p.yeuCauCuoi) {
      p.so429 = (p.so429 || 0) + 1
      if (p.so429 > 3) {
        return await ketThuc(supabase, p, body.maPhien, 'portal_error',
          'Cổng chặn vì gọi quá dày (429) sau 3 lần chờ. Nghỉ 10–15 phút rồi đồng bộ lại, và chia nhỏ khoảng ngày.')
      }
      const cho = [20000, 60000, 120000][p.so429 - 1]
      return traYeuCau(p, {
        viec: 'goi', buoc: p.buoc, yeuCau: p.yeuCauCuoi, nghi: cho,
        tienDo: `Cổng báo quá dày — chờ ${Math.round(cho / 1000)} giây rồi thử lại (lần ${p.so429}/3)`,
      })
    }

    const noiDung = ph.noiDung || ''

    switch (p.buoc) {
      case 'trang_dang_nhap': {
        p.csrf = docCsrf(noiDung)
        if (!p.csrf) return await ketThuc(supabase, p, body.maPhien, 'portal_error', 'Không đọc được mã bảo vệ — cổng có thể đã đổi giao diện')
        p.buoc = 'anh_captcha_dn'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauAnhCaptcha() })
      }

      case 'anh_captcha_dn': {
        p.buoc = 'cho_captcha_dn'
        return Response.json({
          viec: 'go_captcha', buoc: p.buoc, nhan: 'đăng nhập',
          anhCaptcha: 'data:image/png;base64,' + noiDung,
        })
      }

      case 'dang_nhap': {
        if (/"status"\s*:\s*"?20[01]"?/.test(noiDung)) {
          await supabase.from('tax_accounts')
            .update({ status: 'active', last_success_at: new Date().toISOString(), last_error_code: null })
            .eq('client_id', p.clientId).eq('portal', 'dvc')
          p.buoc = 'trang_tra_cuu'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauTrangTraCuu() })
        }
        let moTa = ''
        try { moTa = JSON.parse(noiDung).desc || '' } catch { moTa = noiDung.slice(0, 200) }
        // Sai captcha: cổng CHƯA kiểm mật khẩu → cho gõ lại, không đụng trạng thái tài khoản.
        if (/captcha/i.test(moTa) || /captcha/i.test(noiDung)) {
          p.buoc = 'anh_captcha_dn'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauAnhCaptcha(), moTa: 'Mã captcha chưa đúng, lấy ảnh mới' })
        }
        // Sai mật khẩu: DỪNG, không thử lại — thử nhiều lần là khóa tài khoản của khách.
        await supabase.from('tax_accounts')
          .update({ status: 'wrong_password', last_error_code: moTa.slice(0, 200) })
          .eq('client_id', p.clientId).eq('portal', 'dvc')
        return await ketThuc(supabase, p, body.maPhien, 'wrong_password', 'Sai mật khẩu: ' + moTa)
      }

      case 'trang_tra_cuu': {
        // Token ĐỔI sau khi đăng nhập — phải đọc lại, nếu không mọi lệnh sau bị 403.
        p.csrf = docCsrf(noiDung) || p.csrf
        p.buoc = 'anh_captcha_tc'
        return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauAnhCaptcha() })
      }

      case 'anh_captcha_tc': {
        p.buoc = 'cho_captcha_tc'
        return Response.json({
          viec: 'go_captcha', buoc: p.buoc, nhan: 'tra cứu',
          anhCaptcha: 'data:image/png;base64,' + noiDung,
        })
      }

      case 'kiem_captcha': {
        if (noiDung.trim() !== 'success') {
          p.buoc = 'anh_captcha_tc'
          return traYeuCau(p, { viec: 'goi', buoc: p.buoc, yeuCau: yeuCauAnhCaptcha(), moTa: 'Mã captcha chưa đúng, lấy ảnh mới' })
        }
        p.viCuaSo = 0; p.trang = 0
        p.buoc = 'tra_cuu'
        return traYeuCau(p, {
          viec: 'goi', buoc: p.buoc,
          yeuCau: yeuCauTraCuu(p.csrf, p.cuaSo[0], p.maCaptchaTraCuu, 0),
          tienDo: `Tra cửa sổ 1/${p.cuaSo.length}`,
        })
      }

      case 'tra_cuu': {
        if (ph.status === 429) {
          return await ketThuc(supabase, p, body.maPhien, 'portal_error',
            'Cổng chặn vì tra cứu quá dày (429). Đợi vài phút rồi tra lại, mỗi lần một khoảng 30 ngày.')
        }
        const { ds, conTrangSau } = docBangKetQua(noiDung, { ...p.cuaSo[p.viCuaSo], trang: p.trang })
        p.dong.push(...ds)

        if (conTrangSau && p.trang < 9) {
          p.trang++
          return traYeuCau(p, {
            viec: 'goi', buoc: 'tra_cuu', nghi: 3000,
            yeuCau: yeuCauTraCuu(p.csrf, p.cuaSo[p.viCuaSo], p.maCaptchaTraCuu, p.trang),
            tienDo: `Tra cửa sổ ${p.viCuaSo + 1}/${p.cuaSo.length}, trang ${p.trang + 1}`,
          })
        }
        p.viCuaSo++; p.trang = 0
        if (p.viCuaSo < p.cuaSo.length) {
          // Giãn nhịp giữa các cửa sổ — bắn liền tay là cổng trả 429.
          return traYeuCau(p, {
            viec: 'goi', buoc: 'tra_cuu', nghi: 5000,
            yeuCau: yeuCauTraCuu(p.csrf, p.cuaSo[p.viCuaSo], p.maCaptchaTraCuu, 0),
            tienDo: `Tra cửa sổ ${p.viCuaSo + 1}/${p.cuaSo.length}`,
          })
        }
        // Trước khi mở trang chi tiết, hỏi DB xem hồ sơ nào đã có ngày tiếp nhận rồi.
        const { data: daCo } = await supabase.from('tax_filings')
          .select('portal_code, received_at').eq('client_id', p.clientId).not('received_at', 'is', null)
        p.daCoChiTiet = new Set((daCo || []).map(f => f.portal_code))
        return buocChiTietKeTiep(p)
      }

      case 'chi_tiet': {
        const ma = p.dong[p.viChiTiet]?.maHoSo
        if (ma && ph.status === 200) p.chiTiet.set(ma, docChiTiet(noiDung))
        p.viChiTiet++
        return buocChiTietKeTiep(p)
      }

      case 'dang_xuat':
        return await ketThuc(supabase, p, body.maPhien, 'success', null)

      default:
        return Response.json({ error: 'Bước không hợp lệ: ' + p.buoc }, { status: 400 })
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

// Mở trang chi tiết từng hồ sơ để lấy ngày tiếp nhận + thông báo. Không tốn captcha, nhưng phải
// giãn nhịp. Hết hồ sơ thì ghi dữ liệu rồi đăng xuất.
function buocChiTietKeTiep(p) {
  const GIOI_HAN = 25       // đủ cho một lượt; còn nữa thì lượt sau lấy tiếp

  // BỎ QUA hồ sơ đã có ngày tiếp nhận từ lần đồng bộ trước: trang chi tiết chỉ dùng để lấy ngày
  // tiếp nhận và danh sách thông báo, lấy rồi thì mở lại chẳng thêm gì. Cách giảm nguy cơ bị cổng
  // chặn tốt nhất là GỌI ÍT ĐI, chứ không phải gọi chậm hơn.
  while (p.viChiTiet < p.dong.length && p.daCoChiTiet?.has(p.dong[p.viChiTiet].maHoSo)) {
    p.boQuaChiTiet = (p.boQuaChiTiet || 0) + 1
    p.viChiTiet++
  }

  if (p.viChiTiet < p.dong.length && p.viChiTiet < GIOI_HAN) {
    p.buoc = 'chi_tiet'
    return traYeuCau(p, {
      viec: 'goi', buoc: p.buoc, nghi: 2500,
      yeuCau: yeuCauChiTiet(p.dong[p.viChiTiet].maHoSo),
      tienDo: `Đọc chi tiết ${p.viChiTiet + 1}/${Math.min(p.dong.length, GIOI_HAN)}`,
    })
  }
  // Tên bước phải khớp với nhánh trong switch ở trên, nếu không lượt cuối sẽ rơi vào default.
  p.buoc = 'dang_xuat'
  return traYeuCau(p, {
    viec: 'goi', buoc: p.buoc, yeuCau: yeuCauDangXuat(p.csrf),
    tienDo: 'Đang ghi dữ liệu và đăng xuất',
  })
}

async function ketThuc(supabase, p, maPhien, ketQua, loi) {
  const admin = supabase
  let tongKet = { themMoi: 0, capNhat: 0, khopNghiaVu: 0, khongKhop: 0, soThongBao: 0 }

  if (ketQua === 'success' && p.dong.length) {
    tongKet = await ghiHoSoVaThongBao(admin, p.clientId, p.dong, p.chiTiet)
  }

  if (p.jobId) {
    await admin.from('tax_sync_jobs').update({
      finished_at: new Date().toISOString(),
      result: ketQua,
      error_detail: loi ? String(loi).slice(0, 500) : null,
      new_filings: tongKet.themMoi,
      changed_filings: tongKet.capNhat,
    }).eq('id', p.jobId)
  }
  await admin.from('tax_access_logs').insert({
    staff_id: p.staffId, client_id: p.clientId, action: 'sync',
    detail: { qua: 'tien_ich_chrome', ket_qua: ketQua, so_ma_captcha: p.soMaDaGo, ...tongKet },
  })

  phienTam.delete(maPhien)

  if (ketQua !== 'success') return Response.json({ viec: 'loi', moTa: loi })
  return Response.json({
    viec: 'xong',
    khoangNgay: `${p.cuaSo[p.cuaSo.length - 1].tuNgay} – ${p.cuaSo[0].denNgay}`,
    soMaCaptcha: p.soMaDaGo,
    soHoSo: p.dong.length,
    ...tongKet,
    hoSo: p.dong.slice(0, 50).map(r => ({
      maHoSo: r.maHoSo, tenToKhai: r.tenToKhai, ky: r.kyTinhThue,
      loai: r.loaiToKhai, ngayNop: r.ngayNop, trangThai: r.trangThaiCong,
    })),
  })
}
