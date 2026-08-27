// Test luồng HCNS đầu-cuối trên dữ liệu THẬT bằng một công ty TẠM, rồi xoá sạch.
//
//   node scripts/test-hcns-flow.mjs
//
// An toàn: chỉ tạo/xoá đúng bản ghi do chính script này sinh ra (tên bắt đầu bằng ZZ_TEST_HCNS_),
// không đụng bất kỳ công ty thật nào. Khối finally luôn dọn dẹp kể cả khi test lỗi giữa chừng.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { syncHcnsForClient, getLinkedHcnsClient, getLinkedHcnsMap } from '../lib/hcnsSync.js'
import { resolveFeeForMonthWithSource } from '../lib/feeDue.js'
import { evaluateCap, CAP_OK, CAP_SPLIT, CAP_EXCESS } from '../lib/feeCap.js'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

const MARK = 'ZZ_TEST_HCNS_' + Date.now()
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [OK]    ' + m) }
const ng = (m) => { fail++; console.log('  [LỖI]   ' + m) }

let clientId = null

try {
  // ── 1. Tạo công ty kế toán tạm ───────────────────────────────────────────────
  const { data: anyStaff } = await s.from('staff').select('id').limit(1).single()
  const { data: c, error: cErr } = await s.from('clients').insert({
    name: MARK, tax_code: MARK, client_code: MARK,
    monthly_fee: 5000000, fee_period: 'monthly', report_type: 'monthly',
    assigned_to: anyStaff.id, status: 'active', is_active: true,
    address: 'Địa chỉ test', representative: 'NGƯỜI TEST',
  }).select().single()
  if (cErr) throw new Error('Không tạo được công ty tạm: ' + cErr.message)
  clientId = c.id
  console.log('Đã tạo công ty tạm: ' + MARK + '\n')

  console.log('1) Mặc định chưa bật HCNS')
  c.uses_hcns === false || c.uses_hcns === null ? ok('uses_hcns mặc định tắt') : ng('uses_hcns phải mặc định tắt, đang là ' + c.uses_hcns)
  const none = await getLinkedHcnsClient(s, clientId)
  none === null ? ok('chưa sinh công ty bên HCNS') : ng('không được sinh công ty HCNS khi chưa tick')

  console.log('\n2) Tick "Có sử dụng DV HCNS" + nhập phí 2.160.000')
  await s.from('clients').update({ uses_hcns: true }).eq('id', clientId)
  const r1 = await syncHcnsForClient(s, { clientId, usesHcns: true, hcnsFee: 2160000 })
  r1.ok ? ok('đồng bộ thành công') : ng('đồng bộ lỗi: ' + r1.reason)
  const hc = await getLinkedHcnsClient(s, clientId)
  hc ? ok('đã sinh công ty bên Phòng HCNS') : ng('KHÔNG sinh được công ty bên HCNS')
  hc?.category === 'thoi_ky' ? ok('đúng loại "thoi_ky"') : ng('sai loại: ' + hc?.category)
  Number(hc?.hcns_fee) === 2160000 ? ok('phí HCNS đúng ' + fmt(hc.hcns_fee) + 'đ') : ng('phí sai: ' + hc?.hcns_fee)
  hc?.client_code === MARK ? ok('mã khách hàng khớp công ty kế toán') : ng('mã KH không khớp')

  const map = await getLinkedHcnsMap(s, [clientId])
  Number(map.get(clientId)?.hcns_fee) === 2160000 ? ok('Danh sách công ty đọc được phí HCNS') : ng('map phí HCNS sai')

  console.log('\n3) Luật chặn thu vượt phí')
  const { data: plans } = await s.from('hcns_service_fees')
    .select('hcns_client_id,year,month,amount').eq('hcns_client_id', hc.id).eq('type', 'fee_plan')
  const planRows = (plans || []).map(p => ({ ...p, client_id: p.hcns_client_id }))
  const now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1
  const { fee, reliable } = resolveFeeForMonthWithSource(planRows, hc.id, Y, M, hc.hcns_fee, [])
  fee === 2160000 ? ok('tra ra đúng phí kỳ ' + fmt(fee) + 'đ') : ng('tra phí sai: ' + fee)
  reliable ? ok('nguồn phí đáng tin -> được phép chặn') : ng('nguồn phí phải đáng tin')

  const vOk = evaluateCap({ amount: 2160000, fee, reliable, year: Y, month: M })
  vOk.kind === CAP_OK ? ok('thu đúng phí -> cho lưu') : ng('thu đúng phí mà bị chặn')

  const vHalf = evaluateCap({ amount: 1000000, fee, reliable, year: Y, month: M })
  vHalf.kind === CAP_OK ? ok('thu thiếu -> cho lưu') : ng('thu thiếu mà bị chặn')

  const vSplit = evaluateCap({ amount: 2160000 * 3, fee, reliable, year: Y, month: M })
  vSplit.kind === CAP_SPLIT && vSplit.periods === 3
    ? ok('thu ×3 -> nhận diện trả gộp 3 kỳ, gợi ý ' + vSplit.suggestedPeriods.map(p => 'T' + p.month + '/' + p.year).join(', '))
    : ng('thu ×3 phải ra đề nghị rải đều 3 kỳ, đang ra: ' + vSplit.kind)

  const vExcess = evaluateCap({ amount: 3000000, fee, reliable, year: Y, month: M })
  vExcess.kind === CAP_EXCESS && vExcess.excess === 840000
    ? ok('thu vượt lẻ -> đề nghị tách ' + fmt(vExcess.excess) + 'đ sang Nợ tồn cũ')
    : ng('thu vượt lẻ xử lý sai: ' + vExcess.kind)

  const vUnrel = evaluateCap({ amount: 9999999, fee, reliable: false, year: Y, month: M })
  vUnrel.kind !== CAP_SPLIT && vUnrel.kind !== CAP_EXCESS
    ? ok('phí không đáng tin -> chỉ cảnh báo, KHÔNG chặn')
    : ng('phí không đáng tin mà vẫn chặn — sẽ chặn oan như ca Hoàng Tiến')

  console.log('\n4) Ghi công nợ HCNS')
  await s.from('hcns_service_fees').upsert({
    hcns_client_id: hc.id, year: Y, month: M, type: 'hcns', amount: 2160000, note: 'test',
  }, { onConflict: 'hcns_client_id,year,month,type' })
  const { data: paid } = await s.from('hcns_service_fees')
    .select('amount').eq('hcns_client_id', hc.id).eq('type', 'hcns').eq('year', Y).eq('month', M).maybeSingle()
  Number(paid?.amount) === 2160000 ? ok('ghi nhận thu 2.160.000đ thành công') : ng('ghi công nợ thất bại')

  console.log('\n5) Bỏ tick "Có sử dụng DV HCNS"')
  await s.from('clients').update({ uses_hcns: false }).eq('id', clientId)
  await syncHcnsForClient(s, { clientId, usesHcns: false })
  const { data: after } = await s.from('hcns_clients').select('is_active').eq('id', hc.id).single()
  after.is_active === false ? ok('công ty HCNS bị ẩn, KHÔNG xoá') : ng('phải ẩn chứ không xoá')
  const { count } = await s.from('hcns_service_fees')
    .select('id', { count: 'exact', head: true }).eq('hcns_client_id', hc.id).eq('type', 'hcns')
  count === 1 ? ok('lịch sử thu cũ được giữ nguyên') : ng('lịch sử thu bị mất')

  console.log('\n6) Tick lại')
  await syncHcnsForClient(s, { clientId, usesHcns: true, hcnsFee: 2160000 })
  const back = await getLinkedHcnsClient(s, clientId)
  back?.is_active === true ? ok('bật lại đúng bản ghi cũ, không tạo trùng') : ng('bật lại thất bại')
  const { count: dup } = await s.from('hcns_clients')
    .select('id', { count: 'exact', head: true }).eq('linked_client_id', clientId)
  dup === 1 ? ok('chỉ có đúng 1 bản ghi HCNS cho công ty này') : ng('bị tạo trùng: ' + dup + ' bản ghi')

} catch (e) {
  ng('Ngoại lệ: ' + e.message)
} finally {
  // ── Dọn sạch — luôn chạy kể cả khi test lỗi ────────────────────────────────
  if (clientId) {
    const { data: hcRows } = await s.from('hcns_clients').select('id').eq('linked_client_id', clientId)
    for (const h of (hcRows || [])) {
      await s.from('hcns_service_fees').delete().eq('hcns_client_id', h.id)
      await s.from('hcns_clients').delete().eq('id', h.id)
    }
    await s.from('service_fees').delete().eq('client_id', clientId)
    await s.from('debt_rollovers').delete().eq('client_id', clientId)
    await s.from('client_change_log').delete().eq('client_id', clientId)
    await s.from('clients').delete().eq('id', clientId)

    const { count: left } = await s.from('clients').select('id', { count: 'exact', head: true }).eq('id', clientId)
    console.log('\nDọn dẹp: ' + (left === 0 ? 'đã xoá sạch công ty tạm.' : 'CHÚ Ý — còn sót bản ghi tạm!'))
  }
  console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi.')
  process.exit(fail === 0 ? 0 : 1)
}
