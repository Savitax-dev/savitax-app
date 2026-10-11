import { createClient } from '@supabase/supabase-js'
import { requireLogin } from '@/lib/serverAuth'
import { isSharedRoom } from '@/lib/specialRooms'
import { tinhDongTienPhong, gopDongTien } from '@/lib/dongTienPhong'
import { loadHcnsFees } from '@/lib/hcnsPhiCongTy'

// BÁO CÁO PHÍ ĐÃ THU (trang Báo cáo KPI) — tiền đã ghi nhận trong một khoảng ngày, theo phòng /
// nhân viên phụ trách.
//
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&rooms=id,id][&staff=id,id]
//
// Quy ước đã chốt với người dùng:
//   · "Ngày thu" = NGÀY GHI VÀO APP (created_at), theo giờ Việt Nam. Người dùng đã từ chối thêm
//     ô "Ngày khách trả" (05/10/2026).
//   · Gồm phí kế toán + thu nợ tồn + thu khác (cả tiền thu của hồ sơ Dịch vụ khác). Phí HCNS làm
//     sau ở trang Báo cáo HCNS.
//   · Tiền tính cho NHÂN VIÊN CHÍNH của công ty (clients.assigned_to), không phải người bấm ghi.
//   · (06/10/2026) Thêm DÒNG TIỀN theo nguyên tắc 5 khối của các trang công nợ: tồn đầu kỳ, phải thu
//     kế toán / HCNS / thu khác, đã thu, còn phải thu chuyển kỳ sau. Số dư chỉ tính được theo THÁNG,
//     nên lấy các tháng mà khoảng ngày CHẠM TỚI (01/08–06/10 -> T8, T9, T10). Vì vậy có HAI cột đã
//     thu, cố ý để riêng: "đã thu của kỳ" (theo kỳ của khoản phí — cộng trừ khớp với tồn đầu và
//     chuyển kỳ sau) và "đã ghi trong khoảng ngày" (tiền thực ghi vào app trong khoảng đó).
//
// ⚠ HẠN CHẾ CỦA DỮ LIỆU GỐC — phải nói rõ trên màn hình, đừng giấu: bảng `service_fees` mỗi
// (công ty, kỳ, loại) chỉ có MỘT dòng giữ số luỹ kế, và mỗi lần ghi lại thì `created_at` bị đặt
// thành lúc ghi (xem save-debt / save-old-debt / bankPost). Tức là không có sổ từng lần thu: khách
// trả 2 lần cho cùng một kỳ thì cả khoản nằm ở ngày ghi lần SAU CÙNG. Riêng hồ sơ Dịch vụ khác
// (`other_service_payments`) có dòng cho từng lần thu nên đúng từng ngày.
//
// Phạm vi xem (chặn ở máy chủ, không tin tham số): quản trị xem hết; trưởng phòng / quản lý xem
// nhân viên phòng mình (trưởng phòng thêm phòng "đặc thù"); nhân viên chỉ xem của chính mình.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
const num = (v) => Math.round(Number(v) || 0)
const LA_NGAY = /^\d{4}-\d{2}-\d{2}$/
const vnNgay = (iso) => new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const LOAI = { ketoan: 'Phí kế toán', no_ton: 'Thu nợ tồn', khach: 'Thu khác' }

async function hetTrang(q) {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
  }
  return all
}
const chia = (arr, n = 150) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

export async function GET(request) {
  const auth = await requireLogin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const caller = auth.caller
  const supabase = getAdmin()
  const sp = new URL(request.url).searchParams

  const roles = caller.roles?.length ? caller.roles : [caller.role].filter(Boolean)
  const laAdmin = roles.includes('admin')
  const laQuanLy = roles.includes('leader') || roles.includes('manager')
  const phongCuaToi = caller.roomIds?.length ? caller.roomIds : [caller.roomId].filter(Boolean)

  const [{ data: rooms }, { data: staffAll }] = await Promise.all([
    supabase.from('rooms').select('id, name, type').order('name'),
    supabase.from('staff').select('id, full_name, room_id, role').order('full_name'),
  ])
  // Phòng Kinh doanh / HCNS không thu phí kế toán -> không đưa vào bộ lọc.
  const phongNghiepVu = (rooms || []).filter(r => r.type !== 'kinhdoanh' && r.type !== 'hcns')
  const duocXemPhong = (id) => laAdmin || (laQuanLy && (phongCuaToi.includes(id) || (roles.includes('leader') && isSharedRoom(id))))
  const staffDuocXem = (staffAll || []).filter(s => laAdmin || s.id === caller.staffId || (s.room_id && duocXemPhong(s.room_id)))
  const idDuocXem = new Set(staffDuocXem.map(s => s.id))
  const tenPhong = new Map((rooms || []).map(r => [r.id, r.name]))

  const options = {
    rooms: phongNghiepVu.filter(r => duocXemPhong(r.id) || staffDuocXem.some(s => s.room_id === r.id)).map(r => ({ id: r.id, name: r.name })),
    staff: staffDuocXem.filter(s => !s.room_id || phongNghiepVu.some(r => r.id === s.room_id))
      .map(s => ({ id: s.id, name: s.full_name, roomId: s.room_id, roomName: tenPhong.get(s.room_id) || '—' })),
    scope: laAdmin ? 'all' : laQuanLy ? 'room' : 'self',
  }

  const from = sp.get('from'), to = sp.get('to')
  if (!from || !to) return Response.json({ options })
  if (!LA_NGAY.test(from) || !LA_NGAY.test(to) || from > to) {
    return Response.json({ error: 'Khoảng ngày không hợp lệ' }, { status: 400 })
  }
  const tu = new Date(from + 'T00:00:00+07:00').toISOString()
  const den = new Date(to + 'T23:59:59.999+07:00').toISOString()

  const chonPhong = new Set((sp.get('rooms') || '').split(',').filter(Boolean))
  const chonNv = new Set((sp.get('staff') || '').split(',').filter(Boolean))

  let fees = [], dvk = []
  try {
    fees = await hetTrang(() => supabase.from('service_fees')
      .select('id, client_id, year, month, type, amount, note, created_by, created_at')
      .in('type', ['ketoan', 'no_ton', 'khach']).gte('created_at', tu).lte('created_at', den).order('created_at'))
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }) }
  try {
    dvk = await hetTrang(() => supabase.from('other_service_payments')
      .select('id, service_id, client_id, year, month, amount, note, created_by, created_at')
      .gte('created_at', tu).lte('created_at', den).order('created_at'))
  } catch (_) { dvk = [] }   // chưa có bảng Dịch vụ khác (bản clone)

  const clientIds = [...new Set([...fees, ...dvk].map(x => x.client_id))]
  const clients = new Map()
  for (const lo of chia(clientIds)) {
    const { data } = await supabase.from('clients').select('id, name, client_code, tax_code, assigned_to, status').in('id', lo)
    for (const c of data || []) clients.set(c.id, c)
  }
  const tenHoSo = new Map()
  const svcIds = [...new Set(dvk.map(x => x.service_id))]
  for (const lo of chia(svcIds)) {
    const { data } = await supabase.from('other_services').select('id, name').in('id', lo)
    for (const s of data || []) tenHoSo.set(s.id, s.name)
  }
  const nv = new Map((staffAll || []).map(s => [s.id, s]))

  const lines = []
  const them = (x, loai, ghiChu) => {
    const amount = num(x.amount)
    if (amount <= 0) return
    const c = clients.get(x.client_id)
    if (!c) return
    const staffId = c.assigned_to || null
    // Công ty chưa có nhân viên phụ trách: chỉ quản trị thấy, gom vào "Chưa phân công".
    if (staffId ? !idDuocXem.has(staffId) : !laAdmin) return
    const s = staffId ? nv.get(staffId) : null
    const roomId = s?.room_id || null
    if (chonNv.size && !chonNv.has(staffId || 'none')) return
    if (chonPhong.size && !chonPhong.has(roomId || 'none')) return
    lines.push({
      id: loai + '-' + x.id, date: vnNgay(x.created_at), at: x.created_at,
      clientId: c.id, clientName: c.name, clientCode: c.client_code || '', taxCode: c.tax_code || '',
      ngung: (c.status || 'active') !== 'active',
      type: loai, typeLabel: LOAI[loai], period: 'T' + x.month + '/' + x.year,
      amount, note: ghiChu || '',
      staffId: staffId || 'none', staffName: s?.full_name || 'Chưa phân công',
      roomId: roomId || 'none', roomName: roomId ? (tenPhong.get(roomId) || '—') : '—',
      recordedBy: nv.get(x.created_by)?.full_name || '',
    })
  }
  for (const f of fees) them(f, f.type, f.note)
  for (const p of dvk) them(p, 'khach', [tenHoSo.get(p.service_id), p.note].filter(Boolean).join(' — '))
  lines.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0)

  const byStaff = new Map()
  for (const l of lines) {
    if (!byStaff.has(l.staffId)) {
      byStaff.set(l.staffId, { staffId: l.staffId, staffName: l.staffName, roomId: l.roomId, roomName: l.roomName, ketoan: 0, no_ton: 0, khach: 0, total: 0, count: 0, clients: new Set() })
    }
    const g = byStaff.get(l.staffId)
    g[l.type] += l.amount; g.total += l.amount; g.count++; g.clients.add(l.clientId)
  }
  const summary = [...byStaff.values()]
    .map(g => ({ ...g, clientCount: g.clients.size, clients: undefined }))
    .sort((a, b) => a.roomName.localeCompare(b.roomName, 'vi') || b.total - a.total)
  const totals = summary.reduce((a, g) => ({
    ketoan: a.ketoan + g.ketoan, no_ton: a.no_ton + g.no_ton, khach: a.khach + g.khach, total: a.total + g.total, count: a.count + g.count,
  }), { ketoan: 0, no_ton: 0, khach: 0, total: 0, count: 0 })

  // ================= DÒNG TIỀN theo các tháng mà khoảng ngày chạm tới =================
  let dongTien = null, flowByStaff = {}, companies = [], kyDongTien = null, dongTienNote = null
  const yF = Number(from.slice(0, 4)), yT = Number(to.slice(0, 4))
  if (yF !== yT) {
    dongTienNote = 'Khoảng ngày vắt qua hai năm — phần dòng tiền (tồn đầu / chuyển kỳ sau) chỉ tính trong một năm, hãy chọn khoảng ngày trong cùng năm.'
  } else {
    try {
      const vnNow = new Date(Date.now() + 7 * 3600 * 1000)
      const mocNay = vnNow.getUTCFullYear() * 12 + vnNow.getUTCMonth() + 1
      const dsThang = []
      for (let m = Number(from.slice(5, 7)); m <= Number(to.slice(5, 7)); m++) if (yF * 12 + m <= mocNay) dsThang.push(m)
      if (dsThang.length) {
        const thangCuoi = dsThang[dsThang.length - 1]
        const COLS = 'id, name, tax_code, assigned_to, monthly_fee, other_debt, report_type, fee_period, status, client_code, contract_start, created_at'
        const motPhong = async (room) => {
          if (chonPhong.size && !chonPhong.has(room.id)) return null
          const nvPhong = (staffAll || []).filter(x => x.room_id === room.id).map(x => x.id)
          if (!nvPhong.length) return null
          const { data: tatCa } = await supabase.from('clients').select(COLS).in('assigned_to', nvPhong)
          if (!tatCa?.length) return null
          // Chỉ công ty của nhân viên ĐƯỢC XEM và ĐANG CHỌN — nhưng mốc chạy số dư vẫn lấy theo cả
          // phòng (như trang Phòng), không thì cùng một công ty mà ra số khác trang công nợ.
          const cl = tatCa.filter(c => idDuocXem.has(c.assigned_to) && (!chonNv.size || chonNv.has(c.assigned_to)))
          if (!cl.length) return null
          let lichSuTu = null
          const idPhong = tatCa.map(c => c.id)
          for (const lo of chia(idPhong)) {
            const { data: r } = await supabase.from('debt_rollovers').select('year, month')
              .in('client_id', lo).or('source.is.null,source.eq.ketoan').order('year').order('month').limit(1)
            if (r?.[0]) lichSuTu = Math.min(lichSuTu ?? Infinity, r[0].year * 12 + r[0].month)
          }
          const active = cl.filter(c => (c.status || 'active') === 'active').map(c => c.id)
          const [plans, logs, hcns] = await Promise.all([
            Promise.all(chia(active).map(x => supabase.from('service_fees').select('client_id, year, month, amount').in('client_id', x).eq('type', 'fee_plan')))
              .then(r => r.flatMap(v => v.data || [])),
            Promise.all(chia(active).map(x => supabase.from('client_change_log').select('client_id, old_value, changed_at').in('client_id', x).eq('entity', 'monthly_fee').eq('action', 'update')))
              .then(r => r.flatMap(v => v.data || [])),
            loadHcnsFees(supabase, active, yF, thangCuoi),
          ])
          return tinhDongTienPhong(supabase, {
            clients: cl, year: yF, month: thangCuoi, months: dsThang, feePlanRows: plans, changeLogRows: logs,
            hcnsByClient: hcns.byClient || {},
            hcnsLichSu: { links: hcns.links || [], plans: hcns.plans || [], paid: hcns.paid || [] },
            lichSuTu,
          })
        }
        const phongTinh = phongNghiepVu.filter(r => laAdmin || duocXemPhong(r.id) || staffDuocXem.some(x => x.room_id === r.id))
        const g = gopDongTien(await Promise.all(phongTinh.map(motPhong)))
        kyDongTien = { year: yF, tuThang: dsThang[0], denThang: thangCuoi }
        dongTien = { ...g, tuThang: dsThang[0], denThang: thangCuoi, thieuThang: false }
        companies = g.chiTiet
        const tg = (x) => x.ketoan + x.hcns + x.dvk
        for (const c of g.chiTiet) {
          const k = c.staffId || 'none'
          const f = flowByStaff[k] || (flowByStaff[k] = { ton: 0, phiKt: 0, phiHcns: 0, phiKhac: 0, thuKy: 0, xoa: 0, chuyen: 0, soCty: 0 })
          f.ton += tg(c.ton); f.phiKt += c.phi.ketoan; f.phiHcns += c.phi.hcns; f.phiKhac += c.phi.dvk
          f.thuKy += tg(c.thu); f.xoa += c.xoa; f.chuyen += tg(c.chuyen); f.soCty++
        }
        // Nhân viên có dòng tiền nhưng KHÔNG có khoản ghi nào trong khoảng ngày vẫn phải có mặt ở bảng.
        for (const k of Object.keys(flowByStaff)) {
          if (summary.some(x => x.staffId === k)) continue
          const st = nv.get(k)
          summary.push({
            staffId: k, staffName: st?.full_name || 'Chưa phân công', roomId: st?.room_id || 'none',
            roomName: st?.room_id ? (tenPhong.get(st.room_id) || '—') : '—',
            ketoan: 0, no_ton: 0, khach: 0, total: 0, count: 0, clientCount: 0,
          })
        }
        summary.sort((a, b) => a.roomName.localeCompare(b.roomName, 'vi') || b.total - a.total)
      }
    } catch (e) {
      console.error('fee-collected dongTien:', e?.message || e)
      dongTienNote = 'Chưa tính được phần dòng tiền: ' + (e?.message || e)
    }
  }

  return Response.json({ options, from, to, lines, summary, totals, dongTien, flowByStaff, companies, kyDongTien, dongTienNote })
}
