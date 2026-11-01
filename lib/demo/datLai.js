// BẢN DEMO — LÀM MỚI TOÀN BỘ DỮ LIỆU (chạy mỗi đêm qua /api/cron/demo-reset, hoặc tay bằng scripts/demo/lam-moi.mjs).
//
//   1. Chốt an toàn: chỉ chạy khi DEMO_MODE + database không phải production (lib/demo/canh.js), và hàm SQL
//      demo_xoa_sach() tự kiểm thêm bảng đánh dấu chỉ DB demo có.
//   2. Tài khoản demo: tạo nếu chưa có, ĐẶT LẠI mật khẩu (DEMO_PASSWORD); xoá mọi tài khoản khác khách tự tạo khi thử.
//   3. Xoá sạch → nạp bộ dữ liệu mẫu (lib/demo/sinhDuLieu.js).
//   4. Phần "suy ra" đi qua ĐÚNG hàm của app để số liệu khớp logic thật: chuyển nợ tồn (ensureRollovers), thu nợ tồn
//      (applyOldDebtPayment), lịch tờ khai (nghiaVuDinhKy / nghiaVuQuyetToan), chốt bảng lương (tinhBangLuong).
import { chacChanLaDbDemo, laTaiKhoanDemo } from './canh.js'
import { sinhBoDemo, TAI_KHOAN_DEMO, uid } from './sinhDuLieu.js'
import cauHinh from './cauHinh.js'
import { encrypt } from '../taxCrypto.js'
import { ensureRollovers, applyOldDebtPayment } from '../debtRollover.js'
import { nghiaVuDinhKy, nghiaVuQuyetToan, loaiApDung } from '../tokhaiLich.js'
import { tinhBangLuong } from '../luong/bangLuong.js'

const THU_TU = ['roles', 'permissions', 'role_permissions', 'rooms', 'staff', 'staff_extra_roles', 'task_definitions', 'clients',
  'client_secondary_staff', 'client_credentials', 'client_change_log', 'task_records', 'checklist_reviews', 'service_fees', 'kpi_violations',
  'hcns_service_templates', 'hcns_service_template_tasks', 'hcns_clients', 'hcns_service_fees', 'hcns_recurring_tasks', 'hcns_headcount',
  'hcns_case_services', 'hcns_case_service_tasks', 'hcns_case_payments', 'hcns_case_notes', 'other_services', 'other_service_payments',
  'luong_cap_bac', 'luong_nhan_vien', 'luong_ngan_hang', 'luong_cham_cong', 'luong_dieu_chinh', 'luong_dvk_khai', 'luong_ngay_le',
  'luong_hoa_hong_bac', 'sales_channels', 'sales_leads', 'sales_lead_activities', 'sales_quotes', 'bank_transactions', 'bank_action_logs',
  'tax_filing_types', 'tax_holidays', 'tax_accounts']

// Nạp theo lô 500 dòng; mạng chập chờn thì thử lại (lô là một giao dịch — lần trước đã vào mà mất phản hồi thì lần
// sau báo trùng khoá 23505, coi như đã nạp).
async function chen(admin, bang, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    for (let lan = 1; ; lan++) {
      const { error } = await admin.from(bang).insert(rows.slice(i, i + 500), { defaultToNull: false })
      if (!error || (lan > 1 && error.code === '23505')) break
      const mang = /fetch failed|timeout|ECONNRESET|network/i.test(error.message)
      if (!mang || lan >= 4) throw new Error('Nạp ' + bang + ': ' + error.message)
      await new Promise(r => setTimeout(r, 1500 * lan))
    }
  }
}

async function taiKhoanDemo(admin, matKhau) {
  // Đặt lại mật khẩu chỉ khi khách đã đổi — đặt lại vô cớ làm văng người đang xem demo ra trang đăng nhập
  const { createClient } = await import('@supabase/supabase-js')
  const vaoDuoc = async (email) => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await anon.auth.signInWithPassword({ email, password: matKhau })
    if (!error) await anon.auth.signOut({ scope: 'local' }).catch(() => {})
    return !error
  }
  const co = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('Đọc tài khoản: ' + error.message)
    co.push(...data.users)
    if (data.users.length < 200) break
  }
  const id = {}
  for (const tk of TAI_KHOAN_DEMO) {
    const u = co.find(x => String(x.email).toLowerCase() === tk.email)
    if (u) {
      if (!(await vaoDuoc(tk.email))) {
        const { error } = await admin.auth.admin.updateUserById(u.id, { password: matKhau, email_confirm: true, user_metadata: { full_name: tk.ten } })
        if (error) throw new Error('Đặt lại mật khẩu ' + tk.email + ': ' + error.message)
      }
      id[tk.email] = u.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: tk.email, password: matKhau, email_confirm: true, user_metadata: { full_name: tk.ten } })
      if (error) throw new Error('Tạo ' + tk.email + ': ' + error.message)
      id[tk.email] = data.user.id
    }
  }
  // Tài khoản khách tạo thêm khi thử (trang Nhân viên) — xoá để mai bắt đầu sạch
  let xoa = 0
  for (const u of co) if (!laTaiKhoanDemo(u.email)) { await admin.auth.admin.deleteUser(u.id); xoa++ }
  return { id, xoa }
}

// Lịch tờ khai năm nay (+ quyết toán năm trước) và hồ sơ đã nộp cho các kỳ đã tới hạn
function sinhToKhai({ bang, now }) {
  const homNay = new Date(now.getTime() + 7 * 3600e3).toISOString().slice(0, 10)
  const Y = Number(homNay.slice(0, 4))
  const ngayLe = new Set((bang.tax_holidays || []).map(h => String(h.day).slice(0, 10)))
  const loaiDs = (bang.tax_filing_types || []).filter(l => l.is_active !== false && l.period_kind !== 'per_event')
  const nv = [], hs = [], tb = []
  let soHs = 0
  for (const c of bang.clients.filter(c => c.status === 'active')) {
    for (const loai of loaiDs) {
      if (!loaiApDung(c, loai)) continue
      const ds = loai.period_kind === 'settlement' ? nghiaVuQuyetToan({ client: c, loai, nam: Y - 1, ngayLe }) : nghiaVuDinhKy({ client: c, loai, nam: Y, ngayLe })
      for (const o of ds) {
        const id = uid('ob', c.id, loai.id, o.period_code)
        const h = parseInt(id.slice(0, 6), 16) % 100
        const row = { id, ...o, state: 'not_filed' }
        // Kỳ sắp tới hạn (≤ 10 ngày): phần lớn công ty đã nộp sớm, vài hồ sơ còn chờ cơ quan thuế chấp nhận
        const sapHan = o.due_date >= homNay && (new Date(o.due_date) - new Date(homNay)) <= 10 * 86400e3
        if (sapHan && h < 70) {
          const nop = new Date(now.getTime() - (1 + (h % 6)) * 86400e3 - (h % 8) * 3600e3)
          const cho = h >= 55
          const hsId = uid('fl', id)
          hs.push({ id: hsId, obligation_id: id, client_id: c.id, portal: 'dvc', portal_code: 'DEMO-' + String(++soHs).padStart(6, '0'), tthc_code: null,
            filing_type_id: loai.id, period_code: o.period_code, form_kind: 'Chính thức', submit_no: 1, amend_no: 0, tax_office: 'Thuế cơ sở 1 TP Hồ Chí Minh',
            submitted_at: nop.toISOString(), received_at: nop.toISOString(), portal_status: cho ? 'Chờ cơ quan thuế chấp nhận' : 'Đã chấp nhận', state: cho ? 'received' : 'accepted', on_time: true, synced_at: now.toISOString() })
          tb.push({ id: uid('tb1', hsId), client_id: c.id, filing_id: hsId, portal_id: 'DEMO-TN-' + soHs, notice_kind: 'tiep_nhan', title: 'Thông báo về việc tiếp nhận hồ sơ khai thuế điện tử', ngay_tbao: nop.toISOString().slice(0, 10), issued_at: nop.toISOString() })
          nv.push({ ...row, state: cho ? 'received' : 'accepted', state_changed_at: nop.toISOString() })
          continue
        }
        if (o.due_date < homNay) {
          if (h < 6) { nv.push(row); continue }                                          // quá hạn chưa nộp
          if (h < 9 && loai.tax_kind === 'TNCN') { nv.push({ ...row, state: 'no_activity', state_changed_at: now.toISOString() }); continue }
          const tre = h >= 94
          const nop = new Date(new Date(o.due_date + 'T09:00:00+07:00').getTime() + (tre ? 2 + (h % 5) : -(1 + (h % 9))) * 86400e3)
          const hsId = uid('fl', id)
          hs.push({ id: hsId, obligation_id: id, client_id: c.id, portal: 'dvc', portal_code: 'DEMO-' + String(++soHs).padStart(6, '0'), tthc_code: null,
            filing_type_id: loai.id, period_code: o.period_code, form_kind: 'Chính thức', submit_no: 1, amend_no: 0, tax_office: 'Thuế cơ sở 1 TP Hồ Chí Minh',
            submitted_at: nop.toISOString(), received_at: nop.toISOString(), portal_status: 'Đã chấp nhận', state: 'accepted', on_time: !tre, synced_at: now.toISOString() })
          tb.push({ id: uid('tb1', hsId), client_id: c.id, filing_id: hsId, portal_id: 'DEMO-TN-' + soHs, notice_kind: 'tiep_nhan', title: 'Thông báo về việc tiếp nhận hồ sơ khai thuế điện tử', ngay_tbao: nop.toISOString().slice(0, 10), issued_at: nop.toISOString() })
          tb.push({ id: uid('tb2', hsId), client_id: c.id, filing_id: hsId, portal_id: 'DEMO-CN-' + soHs, notice_kind: 'khac', title: 'Thông báo về việc chấp nhận hồ sơ khai thuế điện tử', ngay_tbao: nop.toISOString().slice(0, 10), issued_at: new Date(nop.getTime() + 3600e3).toISOString() })
          nv.push({ ...row, state: 'accepted', state_changed_at: nop.toISOString() })
        } else nv.push(row)
      }
    }
  }
  return { nv, hs, tb }
}

export async function datLaiDemo({ admin, now = new Date(), matKhau = process.env.DEMO_PASSWORD, log = () => {} }) {
  chacChanLaDbDemo()
  if (!matKhau || matKhau.length < 8) throw new Error('Thiếu DEMO_PASSWORD (ít nhất 8 ký tự)')
  const t0 = Date.now()

  const tk = await taiKhoanDemo(admin, matKhau)
  log('Tài khoản demo: ' + TAI_KHOAN_DEMO.length + ' (xoá ' + tk.xoa + ' tài khoản thử)')

  const { error: ex } = await admin.rpc('demo_xoa_sach')
  if (ex) throw new Error('Xoá dữ liệu cũ: ' + ex.message)

  const { bang, sauNap } = sinhBoDemo({ now, cauHinh, authId: tk.id })
  for (const t of ['tax_accounts', 'client_credentials']) for (const r of bang[t] || [])
    if (String(r.password_enc).startsWith('__MA_HOA__:')) r.password_enc = encrypt(r.password_enc.slice(11))
  for (const t of THU_TU) if (bang[t]?.length) await chen(admin, t, bang[t])
  const thieu = Object.keys(bang).filter(t => !THU_TU.includes(t))
  if (thieu.length) throw new Error('Chưa xếp thứ tự nạp cho: ' + thieu.join(', '))
  log('Nạp dữ liệu mẫu: ' + Object.values(bang).reduce((s, v) => s + v.length, 0) + ' dòng')

  // Nợ tồn: đúng hàm app chạy khi mở trang công nợ
  const ids = bang.clients.map(c => c.id)
  await ensureRollovers(admin, ids, sauNap.Y, sauNap.M)
  // Khách trả bớt nợ tồn ở 3 tháng gần nhất — mỗi lần chỉ trả phần nợ ĐÃ CÓ trước tháng đó (kỳ chốt sổ ≤ tháng trả − 2)
  const { data: cs } = await admin.from('clients').select('id, other_debt').gt('other_debt', 0).order('id')
  const { data: rolls } = await admin.from('debt_rollovers').select('client_id, year, month, remaining_amount').order('id')
  const ym = (y, m) => y * 12 + m - 1
  for (const c of cs || []) {
    const info = sauNap.congTy.find(x => x.id === c.id)
    if (!info) continue
    let con = Number(c.other_debt) || 0
    for (const lui of [3, 2, 1]) {
      const t = ym(sauNap.Y, sauNap.M) - lui, ty = Math.floor(t / 12), tm = (t % 12) + 1
      if ((parseInt(uid('nt', c.id, t).slice(0, 4), 16) % 10) >= (info.kieu === 'tot' ? 8 : 6)) continue
      const chuaToi = (rolls || []).filter(r => r.client_id === c.id && ym(r.year, r.month) >= t - 1).reduce((s, r) => s + (Number(r.remaining_amount) || 0), 0)
      const tra = Math.floor(Math.max(0, con - chuaToi) * 0.6 / 10000) * 10000
      if (tra < 500000) continue
      con -= tra
      await admin.from('clients').update({ other_debt: con }).eq('id', c.id)
      await applyOldDebtPayment(admin, c.id, tra)
      await admin.from('service_fees').insert({ client_id: c.id, year: ty, month: tm, type: 'no_ton', amount: tra, note: 'Khách trả bớt nợ tồn', created_by: sauNap.nvId[info.nv], created_at: new Date(Date.UTC(ty, tm - 1, 12 + lui, 3)).toISOString() })
    }
  }
  log('Nợ tồn: xong')

  const tkhai = sinhToKhai({ bang, now })
  await chen(admin, 'tax_obligations', tkhai.nv)
  await chen(admin, 'tax_filings', tkhai.hs)
  await chen(admin, 'tax_notices', tkhai.tb)
  log('Tờ khai: ' + tkhai.nv.length + ' kỳ, ' + tkhai.hs.length + ' hồ sơ đã nộp')

  // Chốt bảng lương tháng trước nữa, đã gửi phiếu; tháng trước để khách tự bấm chốt thử
  const { y, m } = sauNap.thangChotLuong
  const kq = await tinhBangLuong(admin, y, m)
  const chotLuc = new Date(Date.UTC(y, m, 3, 3)).toISOString()
  await chen(admin, 'luong_bang_chot', [{ nam: y, thang: m, du_lieu: kq, chot_boi: sauNap.nvId.nb, chot_luc: chotLuc, da_mo: false, da_gui: true, gui_luc: chotLuc, gui_boi: sauNap.nvId.nb, da_chuyen_luong: true, chuyen_luong_luc: chotLuc, chuyen_luong_boi: sauNap.nvId.giamdoc }])
  const soHh = (kq.dong || []).flatMap(x => (x.hoaHongGt?.chiTiet || []).map(c => ({ nam: y, thang: m, staff_id: x.staff_id, client_id: c.client_id, nguon: c.nguon, ky: String(c.ky), so_tien: c.so_tien, ty_le: c.ty_le, hoa_hong: c.hoa_hong })))
  if (soHh.length) await chen(admin, 'luong_hoa_hong_so', soHh)
  const phieu = (kq.dong || []).filter(x => x.luongCoBan !== null).map((x, i) => ({ nam: y, thang: m, staff_id: x.staff_id, trang_thai: i % 5 === 3 ? 'cho_xac_nhan' : 'da_xac_nhan', thuc_linh: x.thucLinh, luc: chotLuc }))
  if (phieu.length) await chen(admin, 'luong_phieu_xac_nhan', phieu)
  log('Lương: chốt T' + m + '/' + y + ' (' + phieu.length + ' phiếu)')

  return { ok: true, giay: Math.round((Date.now() - t0) / 100) / 10 }
}
