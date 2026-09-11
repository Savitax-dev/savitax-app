// Số liệu Báo cáo Phòng Kinh doanh — hàm thuần, chạy trên trình duyệt từ dữ liệu /api/admin/sales/leads
// (mỗi khách đã kèm danh sách báo giá), và chạy được trong script kiểm thử.
//
// Cách đếm: THEO LỨA KHÁCH — lấy các khách được TIẾP NHẬN trong kỳ, rồi xem lứa đó đi được tới đâu
// (đã báo giá / đã gửi HĐ / đã chốt). Đếm lũy kế theo phễu: khách đã chốt cũng được tính là đã
// báo giá và đã gửi HĐ — nếu không, mỗi lần chốt được một khách thì số "đã gửi" lại tụt xuống.
//
// inKy(isoDate) → boolean: bộ lọc kỳ; dateOf(ts) → 'YYYY-MM-DD' theo giờ VN.

export function leadProgress(l) {
  const qs = l.quotes || []
  const signedQs = qs.filter(q => q.contract_status === 'signed')
  const signed = signedQs.length > 0
  const sent = signed || qs.some(q => q.contract_status === 'sent')
  return {
    quoted: qs.length > 0,
    sent,
    signed,
    signedFee: signedQs.reduce((a, q) => a + (Number(q.monthly_final) || 0), 0),
    quotedFee: qs.length ? Number(qs[0].monthly_final) || 0 : 0, // báo giá mới nhất
  }
}

const pct = (a, b) => (b ? Math.round(a * 100 / b) : null)

function blank() { return { leads: 0, quoted: 0, sent: 0, signed: 0, lost: 0, signedFee: 0 } }
function add(acc, l, p) {
  acc.leads++
  if (p.quoted) acc.quoted++
  if (p.sent) acc.sent++
  if (p.signed) acc.signed++
  if (l.stage === 'that_bai') acc.lost++
  acc.signedFee += p.signedFee
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
  const open = new Set(['moi', 'tu_van', 'bao_gia', 'gui_hd'])
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
