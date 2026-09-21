// Số liệu Báo cáo Phòng Kinh doanh — hàm thuần, chạy trên trình duyệt từ dữ liệu /api/admin/sales/leads
// (mỗi khách đã kèm danh sách báo giá), và chạy được trong script kiểm thử.
//
// Cách đếm: THEO LỨA KHÁCH — lấy các khách được TIẾP NHẬN trong kỳ, rồi xem lứa đó đi được tới đâu
// (đã báo giá / đã gửi HĐ / đã chốt). Đếm lũy kế theo phễu: khách đã chốt cũng được tính là đã
// báo giá và đã gửi HĐ — nếu không, mỗi lần chốt được một khách thì số "đã gửi" lại tụt xuống.
//
// inKy(isoDate) → boolean: bộ lọc kỳ; dateOf(ts) → 'YYYY-MM-DD' theo giờ VN.

// Phễu 6 bước theo tình trạng khách 7 bước (chốt 2026-09-21; "Thất bại" đứng ngoài phễu).
export const FUNNEL = [
  { k: 'tu_van',       label: 'Tiếp nhận / chăm sóc' },
  { k: 'gui_khao_sat', label: 'Gửi khảo sát' },
  { k: 'bao_gia',      label: 'Gửi báo giá' },
  { k: 'chot_bao_gia', label: 'Chốt báo giá' },
  { k: 'gui_hd',       label: 'Gửi hợp đồng' },
  { k: 'chot',         label: 'Chốt hợp đồng' },
]
const STEP = Object.fromEntries(FUNNEL.map((f, i) => [f.k, i]))
// Tình trạng hiện tại để đếm (đủ 7 ô); 'moi' cũ tính là Đang chăm sóc.
export const STATE_KEYS = ['tu_van', 'gui_khao_sat', 'bao_gia', 'chot_bao_gia', 'gui_hd', 'chot', 'that_bai']
export const stateOf = st => (st === 'moi' || !st ? 'tu_van' : st)

// Khách đã đi tới bước nào của phễu: lấy CAO HƠN giữa tình trạng hiện tại và dấu vết báo giá (có báo
// giá = đã gửi báo giá, HĐ đã gửi/đã chốt). Khách "Thất bại" không còn tình trạng bước nên chỉ tính theo
// báo giá — vẫn biết họ rớt ở đoạn nào.
export function leadProgress(l) {
  const qs = l.quotes || []
  const signedQs = qs.filter(q => q.contract_status === 'signed')
  const fromQuotes = signedQs.length ? STEP.chot
    : qs.some(q => q.contract_status === 'sent') ? STEP.gui_hd
    : qs.length ? STEP.bao_gia : 0
  const st = stateOf(l.stage)
  const reached = Math.max(fromQuotes, st in STEP ? STEP[st] : 0)
  const signed = reached >= STEP.chot
  const sent = reached >= STEP.gui_hd
  return {
    reached,
    quoted: reached >= STEP.bao_gia,
    sent,
    signed,
    signedFee: signedQs.reduce((a, q) => a + (Number(q.monthly_final) || 0), 0),
    quotedFee: qs.length ? Number(qs[0].monthly_final) || 0 : 0, // báo giá mới nhất
  }
}

const pct = (a, b) => (b ? Math.round(a * 100 / b) : null)

function blank() { return { leads: 0, quoted: 0, sent: 0, signed: 0, lost: 0, signedFee: 0, steps: FUNNEL.map(() => 0), states: Object.fromEntries(STATE_KEYS.map(k => [k, 0])) } }
function add(acc, l, p) {
  acc.leads++
  if (p.quoted) acc.quoted++
  if (p.sent) acc.sent++
  if (p.signed) acc.signed++
  if (l.stage === 'that_bai') acc.lost++
  acc.signedFee += p.signedFee
  for (let i = 0; i <= p.reached; i++) acc.steps[i]++
  acc.states[stateOf(l.stage)] = (acc.states[stateOf(l.stage)] || 0) + 1
}
function finish(acc) { return { ...acc, convRate: pct(acc.signed, acc.leads), quoteRate: pct(acc.quoted, acc.leads), closeRate: pct(acc.signed, acc.sent) } }

export function buildSalesReport({ leads, channels, staffNames, inKy, dateOf, today }) {
  const cohort = leads.filter(l => inKy(dateOf(l.created_at)))
  const total = blank()
  const byCh = new Map(), byStaff = new Map(), lost = new Map()

  for (const l of cohort) {
    const p = leadProgress(l)
    add(total, l, p)
    const ck = l.channel_id || 'none'
    if (!byCh.has(ck)) byCh.set(ck, blank())
    add(byCh.get(ck), l, p)
    const sk = l.assigned_to || 'none'
    if (!byStaff.has(sk)) byStaff.set(sk, blank())
    add(byStaff.get(sk), l, p)
    if (l.stage === 'that_bai') {
      const r = String(l.lost_reason || 'Không ghi lý do').trim()
      const key = r.toLowerCase()
      const cur = lost.get(key) || { reason: r, count: 0 }
      cur.count++
      lost.set(key, cur)
    }
  }

  // Việc đang tồn của từng người — tính trên TOÀN BỘ khách đang mở, không theo kỳ.
  const open = new Set(['moi', 'tu_van', 'gui_khao_sat', 'bao_gia', 'chot_bao_gia', 'gui_hd'])
  const backlog = new Map()
  for (const l of leads) {
    if (!open.has(l.stage)) continue
    const sk = l.assigned_to || 'none'
    const b = backlog.get(sk) || { open: 0, overdue: 0 }
    b.open++
    if (l.next_follow_up && l.next_follow_up < today) b.overdue++
    backlog.set(sk, b)
  }

  const chName = new Map((channels || []).map(c => [c.id, c.name]))
  const channelRows = [...byCh.entries()]
    .map(([id, a]) => ({ id, name: id === 'none' ? 'Chưa rõ kênh' : (chName.get(id) || '—'), ...finish(a) }))
    .sort((a, b) => b.leads - a.leads || b.signedFee - a.signedFee)

  const staffIds = new Set([...byStaff.keys(), ...backlog.keys()])
  const staffRows = [...staffIds]
    .map(id => ({
      id, name: id === 'none' ? 'Chưa ai nhận' : (staffNames.get(id) || '—'),
      ...finish(byStaff.get(id) || blank()),
      open: backlog.get(id)?.open || 0, overdue: backlog.get(id)?.overdue || 0,
    }))
    .sort((a, b) => b.signedFee - a.signedFee || b.leads - a.leads)

  return {
    total: finish(total),
    channelRows,
    staffRows,
    lostReasons: [...lost.values()].sort((a, b) => b.count - a.count).slice(0, 8),
  }
}
