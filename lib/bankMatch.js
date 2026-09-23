// Đối soát ngân hàng — đọc nội dung chuyển khoản, nhận ra công ty + kỳ phí, và đề xuất cách ghi
// vào công nợ. File THUẦN (không đụng DB): route app/api/admin/bank-transactions nạp dữ liệu rồi
// gọi vào đây, nên kiểm chứng được bằng script node trên dữ liệu thật (scripts/test-bank-match.mjs).
//
// Mẫu nội dung chuẩn (QR Savitax): <MÃ KH hoặc MST> + "TT PHI DICH VU" + <kỳ>, ví dụ
//   CONNECTIVETTPHIDICHVUT09SAVITAX     VNPC_TT_PHIDICHVU_T9.2026     0318214959TTPHIDICHVUT09
// Ngân hàng bỏ dấu / khoảng trắng / gạch dưới tuỳ nơi, nên mọi so khớp làm trên chuỗi đã chuẩn hoá
// (bỏ dấu, viết hoa, chỉ giữ chữ + số).
//
// NGUYÊN TẮC AN TOÀN — trang không tự ghi gì, người dùng bấm mới ghi, và:
//   - Chỉ "Sẵn sàng ghi" khi nhận ra bằng MÃ KH / MST, có kỳ, phí tra được đáng tin, và số tiền
//     KHỚP ĐÚNG phần còn phải thu (kế toán + HCNS) của kỳ đó.
//   - Nhận theo TÊN, thiếu kỳ, lệch tiền, kỳ đã chuyển nợ tồn, trả gộp... đều về "Cần xem".
//   - Kỳ đã chuyển nợ tồn thì KHÔNG ghi lại tháng gốc — tiền đi vào nợ tồn (AGENTS.md).
//   - Trả gộp nhiều kỳ CHỈ khi công ty không còn nợ tồn (lib/feeCap.js).

import { resolveFeeForMonthWithSource, isFeeDueMonth, isPastRolloverDeadline } from './feeDue.js'
import { resolveHcnsFeeForMonth } from './hcnsFee.js'

export const ST_READY = 'ready'      // khớp chắc chắn, bấm là ghi
export const ST_REVIEW = 'review'    // nhận ra công ty nhưng cần người xem
export const ST_UNKNOWN = 'unknown'  // không nhận ra công ty
export const ST_DONE = 'done'        // công nợ trong app đã có khoản này (nhân viên đã ghi tay)

// Cụm mốc đứng NGAY SAU mã KH. Dài trước, ngắn sau (tìm vị trí sớm nhất).
const ANCHORS = ['THANHTOANPHIDICHVU', 'TTPHIDICHVU', 'THANHTOANPHI', 'PHIDICHVU']

// Chữ pháp lý / chung chung bỏ đi khi so theo TÊN công ty.
const LEGAL = ['CONG TY', 'CTY', 'TNHH', 'CO PHAN', 'CP', 'MTV', 'MOT THANH VIEN', 'HAI THANH VIEN',
  'HO KINH DOANH', 'HKD', 'THUONG MAI', 'DICH VU', 'TMDV', 'TM', 'DV', 'XD', 'XAY DUNG', 'SAN XUAT',
  'DAU TU', 'TU VAN', 'VIET NAM', 'VN', 'VA']

// Tên công ty Savitax hay nằm ở cuối nội dung (ngân hàng tự gắn tên người nhận) — bỏ trước khi so tên.
const SELF_NAMES = ['CONG TY CO PHAN TU VAN THUE SAVITAX']

const stripMarks = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase()

export function norm(s) {
  return stripMarks(s).replace(/[^A-Z0-9]/g, '')
}

// Chuẩn hoá kèm bảng vị trí: map[i] = vị trí trong chuỗi GỐC của ký tự thứ i sau chuẩn hoá — để tô
// sáng đúng đoạn mã KH / kỳ trên nội dung gốc mà người dùng nhìn thấy.
function normWithMap(s) {
  const src = String(s || '')
  let n = ''
  const map = []
  for (let i = 0; i < src.length; i++) {
    const c = stripMarks(src[i]).replace(/[^A-Z0-9]/g, '')
    for (const ch of c) { n += ch; map.push(i) }
  }
  return { n, map }
}

const range = (map, start, len) => ({ start: map[start], end: map[start + len - 1] + 1 })

function coreName(name) {
  let s = stripMarks(name).replace(/[^A-Z0-9 ]/g, ' ')
  for (const w of LEGAL) s = s.replace(new RegExp('\\b' + w + '\\b', 'g'), ' ')
  return s.replace(/\s+/g, '')
}

// ── Chỉ mục mã KH / MST / tên ────────────────────────────────────────────────────────────────
// clients: [{id, name, client_code, tax_code}]
export function buildIndex(clients) {
  const byKey = new Map()
  const add = (key, c, via) => {
    if (!key || key.length < 3) return
    const list = byKey.get(key) || []
    if (!list.some(x => x.c.id === c.id)) list.push({ c, via })
    byKey.set(key, list)
  }
  for (const c of clients || []) {
    add(norm(c.client_code), c, 'code')
    const mst = norm(c.tax_code)
    if (/^\d{9,}/.test(mst)) {
      add(mst, c, 'mst')
      // MST lưu trong app có khi mất số 0 đầu (nạp từ Excel) — khách luôn gõ đủ.
      if (mst.length === 9) add('0' + mst, c, 'mst')
      else if (mst[0] === '0') add(mst.replace(/^0+/, ''), c, 'mst')
    }
  }
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length)
  const cores = (clients || []).map(c => ({ c, k: coreName(c.name) }))
    .filter(x => x.k.length >= 5).sort((a, b) => b.k.length - a.k.length)
  return { byKey, keys, cores }
}

// ── Kỳ phí ───────────────────────────────────────────────────────────────────────────────────
// Kỳ đứng ngay sau mốc: T9 / T09 / T9.2026 (chuẩn hoá thành T92026) / T12026 (=T1 năm 2026) / Q3
function periodAfterAnchor(rest) {
  let m = rest.match(/^Q([1-4])(20\d\d)?/)
  if (m) return { quarter: Number(m[1]), year: m[2] ? Number(m[2]) : null, len: m[0].length }
  if (!rest.startsWith('T')) return null
  const r = rest.slice(1)
  const okM = x => /^\d+$/.test(x) && Number(x) >= 1 && Number(x) <= 12
  const yAt = n => { const y = r.slice(n).match(/^20\d\d/); return y ? Number(y[0]) : null }
  const two = r.slice(0, 2), one = r.slice(0, 1)
  if (okM(two) && yAt(2)) return { month: Number(two), year: yAt(2), len: 7 }
  if (okM(one) && yAt(1)) return { month: Number(one), year: yAt(1), len: 6 }
  if (okM(two) && two.length === 2) return { month: Number(two), year: null, len: 3 }
  if (okM(one)) return { month: Number(one), year: null, len: 2 }
  return null
}

// Kỳ ở bất kỳ đâu (khách tự gõ): "T9-2026", "THANG 9", "T7.2026", "Q3-2026". Tìm trên chuỗi GỐC
// (còn khoảng trắng) để có ranh giới từ — tránh bắt nhầm mã giao dịch kiểu "6264IBT1FJV5".
function loosePeriod(raw) {
  const s = stripMarks(raw)
  let m = s.match(/(^|[^A-Z0-9])Q\s*([1-4])(?:\s*[.\-/]\s*(20\d\d))?(?![0-9])/)
  if (m) {
    const start = m.index + m[1].length
    return { quarter: Number(m[2]), year: m[3] ? Number(m[3]) : null, start, end: m.index + m[0].length }
  }
  m = s.match(/(^|[^A-Z0-9])(?:THANG|T)\s*0?(\d{1,2})(?:\s*[.\-/]\s*(20\d\d))?(?![0-9])/)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const start = m.index + m[1].length
    return { month: Number(m[2]), year: m[3] ? Number(m[3]) : null, start, end: m.index + m[0].length }
  }
  return null
}

// Năm của kỳ khi khách không ghi năm: lấy năm của ngày chuyển, trừ ca vắt năm (trả T12 vào tháng 1
// là T12 năm trước; trả trước T1 vào tháng 12 là T1 năm sau).
function inferYear(month, txYear, txMonth) {
  if (month - txMonth > 6) return txYear - 1
  if (txMonth - month > 6) return txYear + 1
  return txYear
}

// ── Đọc 1 nội dung chuyển khoản ─────────────────────────────────────────────────────────────
// Trả { client, via: 'code'|'mst'|'name'|null, ambiguous: [clients], period: {year, month} | null,
//       periodFromMemo: bool, hl: [{start, end, kind: 'code'|'period'}] }
export function parseMemo(memo, index, txDate) {
  const { n, map } = normWithMap(memo)
  const d = txDate ? new Date(txDate) : new Date()
  // Giờ VN — giao dịch 6h sáng VN ngày 1 vẫn là tháng mới dù UTC còn tháng trước.
  const vn = new Date(d.getTime() + 7 * 3600 * 1000)
  const txYear = vn.getUTCFullYear(), txMonth = vn.getUTCMonth() + 1

  const out = { client: null, via: null, ambiguous: [], period: null, periodFromMemo: false, hl: [] }

  let pos = -1, alen = 0
  for (const a of ANCHORS) {
    const p = n.indexOf(a)
    if (p > 0 && (pos < 0 || p < pos)) { pos = p; alen = a.length }
  }

  let raw = null // kỳ đọc được (chưa quy về năm)
  if (pos > 0) {
    const prefix = n.slice(0, pos)
    const key = index.keys.find(k => prefix.endsWith(k))
    if (key) {
      const list = index.byKey.get(key)
      if (list.length === 1) { out.client = list[0].c; out.via = list[0].via }
      else out.ambiguous = list.map(x => x.c)
      out.hl.push({ ...range(map, pos - key.length, key.length), kind: 'code' })
    }
    // Kỳ có thể đứng ngay sau mốc, hoặc sau chữ "SAVITAX" chen giữa.
    let restAt = pos + alen
    if (n.startsWith('SAVITAX', restAt)) restAt += 7
    const p = periodAfterAnchor(n.slice(restAt))
    if (p) {
      raw = p
      out.hl.push({ ...range(map, restAt, p.len), kind: 'period' })
    }
  }

  if (!out.client && !out.ambiguous.length) {
    let nm = stripMarks(memo)
    for (const s of SELF_NAMES) nm = nm.split(s).join(' ')
    const nn = norm(nm)
    const hit = index.cores.find(x => nn.includes(x.k))
    if (hit) {
      out.client = hit.c; out.via = 'name'
      const at = n.indexOf(hit.k)
      if (at >= 0) out.hl.push({ ...range(map, at, hit.k.length), kind: 'code' })
    }
  }

  if (!raw) {
    const lp = loosePeriod(memo)
    if (lp) { raw = lp; out.hl.push({ start: lp.start, end: lp.end, kind: 'period' }) }
  }

  if (raw) {
    const month = raw.month || raw.quarter * 3
    out.period = { year: raw.year || inferYear(month, txYear, txMonth), month }
    out.periodFromMemo = true
  } else {
    out.period = { year: txYear, month: txMonth }
  }
  // Tô sáng theo thứ tự xuất hiện, bỏ đoạn trùng nhau.
  out.hl.sort((a, b) => a.start - b.start)
  out.hl = out.hl.filter((h, i, arr) => i === 0 || h.start >= arr[i - 1].end)
  return out
}

// ── Tính đề xuất ghi ────────────────────────────────────────────────────────────────────────
const ymKey = (y, m) => y * 12 + m
const fromKey = (k) => { const y = Math.floor((k - 1) / 12); return { year: y, month: k - y * 12 } }
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
const EPS = 2

// ctx (nạp sẵn bởi route cho đúng 1 công ty):
//   client: {id, name, monthly_fee, fee_period, other_debt}
//   ktPlans, ktChg: fee_plan + change log (xem resolveFeeForMonthWithSource)
//   ktPaid: Map(ymKey -> số đã thu phí kế toán)
//   rolled: Set('ketoan:'+ymKey | 'hcns:'+ymKey) — kỳ đã có dòng debt_rollovers
//   hc: null | {id, hcns_fee, fee_period, created_at, plans, paid: Map(ymKey -> số đã thu)}
//   now: Date
function periodInfo(ctx, y, m) {
  const { client, hc } = ctx
  const k = ymKey(y, m)
  const kt = isFeeDueMonth(client.fee_period, m)
    ? resolveFeeForMonthWithSource(ctx.ktPlans, client.id, y, m, client.monthly_fee, ctx.ktChg)
    : { fee: 0, reliable: true }
  const ktPaid = ctx.ktPaid.get(k) || 0
  // Kỳ đã chuyển nợ tồn (hoặc đã quá hạn chuyển) -> không ghi lại tháng gốc.
  const ktRolled = ctx.rolled.has('ketoan:' + k) || (kt.fee > ktPaid + EPS && isPastRolloverDeadline(client.fee_period, y, m, ctx.now))

  let hFee = 0, hPaid = 0, hRolled = false
  if (hc && isFeeDueMonth(hc.fee_period, m)) {
    hFee = Number(resolveHcnsFeeForMonth(hc.plans, hc.id, y, m, hc.hcns_fee, hc.created_at)) || 0
    hPaid = hc.paid.get(k) || 0
    hRolled = ctx.rolled.has('hcns:' + k) || (hFee > hPaid + EPS && isPastRolloverDeadline(hc.fee_period, y, m, ctx.now))
  }
  return {
    year: y, month: m,
    ktFee: Number(kt.fee) || 0, ktReliable: kt.reliable !== false, ktPaid, ktRolled,
    ktDue: ktRolled ? 0 : Math.max(0, (Number(kt.fee) || 0) - ktPaid),
    hFee, hPaid, hRolled,
    hDue: hRolled ? 0 : Math.max(0, hFee - hPaid),
  }
}

const lineKt = (p, amount) => ({ kind: 'ketoan', year: p.year, month: p.month, amount })
const lineH = (p, amount) => ({ kind: 'hcns', year: p.year, month: p.month, amount })
const lineNoTon = (amount) => ({ kind: 'no_ton', amount })

// Kỳ kế tiếp theo nhịp thu phí của công ty (công ty quý bước 3 tháng).
function nextPeriods(ctx, y, m, count) {
  const step = ctx.client.fee_period === 'quarterly' ? 3 : 1
  const out = []
  for (let k = ymKey(y, m), guard = 0; out.length < count && guard < 36; k += step, guard++) {
    const p = fromKey(k)
    const info = periodInfo(ctx, p.year, p.month)
    if (info.ktRolled || info.hRolled) continue
    if (info.ktPaid > 0 || info.hPaid > 0) continue
    out.push(info)
  }
  return out
}

// Trả { status, reason, plan: [lines] | null, info }
export function proposePlan(amount, parsed, ctx) {
  const A = Number(amount) || 0
  const { client } = ctx
  const otherDebt = Number(client.other_debt) || 0
  let { year, month } = parsed.period
  // Công ty quý: khách ghi tháng lẻ trong quý -> quy về tháng cuối quý (kỳ thu).
  if (client.fee_period === 'quarterly' && month % 3) month = Math.ceil(month / 3) * 3
  const info = periodInfo(ctx, year, month)
  const byName = parsed.via === 'name'
  const soft = []
  if (byName) soft.push('nhận theo TÊN — xác nhận đúng công ty')
  if (!parsed.periodFromMemo) soft.push('nội dung không ghi kỳ, tạm hiểu là T' + month + '/' + year)
  const review = (reason, plan = null) => ({ status: ST_REVIEW, reason: [reason, ...soft].filter(Boolean).join(' · '), plan, info })
  const ready = (reason, plan) => soft.length ? review(reason, plan) : { status: ST_READY, reason, plan, info }

  const due = info.ktDue + info.hDue
  const fullFee = info.ktFee + info.hFee

  if (fullFee <= 0 && !info.ktRolled && !info.hRolled) {
    return review('Không tra được phí của công ty cho T' + month + '/' + year + ' — xử lý tay')
  }
  if (!info.ktReliable) {
    return review('Phí kế toán T' + month + '/' + year + ' chưa có lịch sử đáng tin — kiểm tra trước khi ghi')
  }

  // 1) Kỳ đã chuyển nợ tồn: tiền đi vào nợ tồn, không ghi lại tháng gốc.
  if ((info.ktRolled || info.hRolled) && due <= EPS) {
    if (otherDebt <= 0) return review('T' + month + '/' + year + ' đã quá hạn nhưng công ty không còn nợ tồn — xử lý tay')
    if (A > otherDebt + EPS) {
      return review('T' + month + '/' + year + ' đã chuyển nợ tồn; tiền về ' + fmt(A) + ' lớn hơn nợ tồn ' + fmt(otherDebt) + ' — xử lý tay')
    }
    return review('T' + month + '/' + year + ' đã chuyển nợ tồn — ghi ' + fmt(A) + ' vào nợ tồn', [lineNoTon(A)])
  }

  // 2) Kỳ đã thu đủ trong app.
  if (due <= EPS) {
    if (Math.abs(A - fullFee) <= EPS || Math.abs(A - info.ktFee) <= EPS || (info.hFee > 0 && Math.abs(A - info.hFee) <= EPS)) {
      return { status: ST_DONE, reason: 'Nhân viên đã ghi đủ T' + month + '/' + year + ' trong app', plan: null, info }
    }
    // Số tiền = k kỳ, kỳ đang ghi đã có -> đề xuất các kỳ kế tiếp còn trống.
    const k = fullFee > 0 ? Math.round(A / fullFee) : 0
    if (k >= 2 && Math.abs(A - k * fullFee) <= EPS && otherDebt <= 0) {
      const next = nextPeriods(ctx, year, month, k - 1)
      if (next.length === k - 1 && next.every(p => Math.abs(p.ktFee + p.hFee - fullFee) <= EPS)) {
        const plan = next.flatMap(p => [p.ktFee > 0 ? lineKt(p, p.ktFee) : null, p.hFee > 0 ? lineH(p, p.hFee) : null]).filter(Boolean)
        return review('= ' + k + ' kỳ phí: T' + month + ' đã ghi sẵn — đề xuất ghi thêm ' + next.map(p => 'T' + p.month).join(', '), plan)
      }
    }
    return review('T' + month + '/' + year + ' đã thu đủ trong app (' + fmt(info.ktPaid + info.hPaid) + '), tiền về thêm ' + fmt(A) + ' — xử lý tay')
  }

  const plan = []
  if (info.ktDue > 0) plan.push(lineKt(info, info.ktDue))
  if (info.hDue > 0) plan.push(lineH(info, info.hDue))
  const splitTxt = info.ktDue > 0 && info.hDue > 0 ? ' (kế toán + HCNS)' : info.hDue > 0 ? ' (HCNS)' : ''

  // 3) Khớp đúng phần còn phải thu.
  if (Math.abs(A - due) <= EPS) {
    const partNote = (info.ktPaid > 0 || info.hPaid > 0) ? ' — phần còn lại sau khi đã thu ' + fmt(info.ktPaid + info.hPaid) : ''
    return ready('Đúng phí T' + month + '/' + year + splitTxt + partNote, plan)
  }

  // 3b) Tiền về đúng TỔNG phí kỳ nhưng app đã ghi sẵn một phần (thường là nhân viên ghi phí kế
  // toán, quên HCNS) -> chỉ ghi phần còn thiếu, không ghi trùng phần đã có.
  if (due < fullFee - EPS && Math.abs(A - fullFee) <= EPS) {
    return review('Tiền về đúng tổng phí T' + month + ' (' + fmt(fullFee) + '); app đã ghi sẵn '
      + fmt(info.ktPaid + info.hPaid) + ' — chỉ ghi phần còn thiếu ' + fmt(due) + splitTxt, plan)
  }

  // 4) Thiếu: ghi một phần, kế toán trước.
  if (A < due) {
    const kt = Math.min(A, info.ktDue)
    const h = A - kt
    const part = [kt > 0 ? lineKt(info, kt) : null, h > 0 ? lineH(info, h) : null].filter(Boolean)
    return review('THIẾU: phải thu T' + month + ' ' + fmt(due) + ', tiền về ' + fmt(A) + ' — ghi một phần', part)
  }

  // 5) Dư.
  const excess = A - due
  if (otherDebt > 0) {
    if (excess > otherDebt + EPS) {
      return review('DƯ ' + fmt(excess) + ' sau phí T' + month + ', lớn hơn nợ tồn ' + fmt(otherDebt) + ' — xử lý tay')
    }
    return review('Ghi phí T' + month + ' ' + fmt(due) + ', phần dư ' + fmt(excess) + ' trừ vào nợ tồn', [...plan, lineNoTon(excess)])
  }
  // Không nợ tồn: trả gộp nhiều kỳ nếu đúng bội số.
  const k = fullFee > 0 ? Math.round(A / fullFee) : 0
  if (k >= 2 && Math.abs(A - k * fullFee) <= EPS && due === fullFee) {
    const periods = nextPeriods(ctx, year, month, k)
    if (periods.length === k && periods[0].month === month && periods.every(p => Math.abs(p.ktFee + p.hFee - fullFee) <= EPS)) {
      const lines = periods.flatMap(p => [p.ktFee > 0 ? lineKt(p, p.ktFee) : null, p.hFee > 0 ? lineH(p, p.hFee) : null]).filter(Boolean)
      return review('Trả gộp ' + k + ' kỳ: ' + periods.map(p => 'T' + p.month).join(' + '), lines)
    }
  }
  return review('DƯ ' + fmt(excess) + ' so với phí T' + month + ' (' + fmt(due) + ') — xử lý tay')
}

// Tổng hợp đề xuất để hiển thị "Tách tiền".
export function planTotals(plan) {
  const t = { ketoan: 0, hcns: 0, no_ton: 0 }
  for (const l of plan || []) t[l.kind] += Number(l.amount) || 0
  return t
}

// Chữ ký của đề xuất — trình duyệt gửi lại khi bấm Ghi; server tính lại, khác chữ ký là dữ liệu đã
// đổi (vd nhân viên vừa ghi tay) -> từ chối, bắt tải lại. Không bao giờ tin số trình duyệt gửi.
export function planSignature(clientId, plan) {
  return clientId + '|' + (plan || []).map(l => l.kind + ':' + (l.year || '') + '-' + (l.month || '') + ':' + Math.round(l.amount)).join(',')
}
