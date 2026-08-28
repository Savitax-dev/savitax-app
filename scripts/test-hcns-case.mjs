// Test luồng hồ sơ Thời điểm / Vãng lai trên dữ liệu THẬT bằng bản ghi TẠM, rồi xoá sạch:
// tạo hồ sơ -> khai báo dịch vụ mẫu -> thêm dịch vụ vào hồ sơ -> tích checklist -> đổi trạng thái
// -> ghi công nợ nhiều lần -> kiểm chặn thu vượt -> dọn dẹp.
//
//   node scripts/test-hcns-case.mjs
//
// An toàn: chỉ tạo/xoá bản ghi do chính script sinh ra (tên bắt đầu bằng ZZ_TEST_CASE_).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)[1].trim()
const s = createClient(url, key)
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

const MARK = 'ZZ_TEST_CASE_' + Date.now()
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [OK]    ' + m) }
const ng = (m) => { fail++; console.log('  [LỖI]   ' + m) }

let caseId = null, tplId = null, svcId = null

try {
  const { data: anyStaff } = await s.from('staff').select('id, full_name').limit(1).single()

  console.log('0) Bảng công nợ hồ sơ đã cài chưa')
  {
    const { error } = await s.from('hcns_case_payments').select('id').limit(1)
    if (error) throw new Error('Chưa chạy sql/07_hcns_case_payments.sql — ' + error.message)
    ok('hcns_case_payments đã có')
  }

  console.log('\n1) Khai báo mẫu dịch vụ + công việc')
  {
    const { data: t } = await s.from('hcns_service_templates')
      .insert({ name: MARK + '_DV', is_recurring: false, is_active: true }).select().single()
    tplId = t.id
    const { error } = await s.from('hcns_service_template_tasks').insert([
      { template_id: tplId, name: MARK + '_viec1', sort_order: 1, is_active: true },
      { template_id: tplId, name: MARK + '_viec2', sort_order: 2, is_active: true },
    ])
    error ? ng('thêm công việc lỗi: ' + error.message) : ok('mẫu dịch vụ + 2 công việc')
  }

  console.log('\n2) Tạo hồ sơ Thời điểm')
  {
    const { data: c, error } = await s.from('hcns_clients').insert({
      category: 'thoi_diem', name: MARK, case_code: MARK,
      tax_code: '0000000000', address: 'Địa chỉ test', representative: 'NGƯỜI TEST',
      assigned_to: anyStaff.id, is_active: true,
    }).select().single()
    if (error) throw new Error('không tạo được hồ sơ: ' + error.message)
    caseId = c.id
    ok('hồ sơ "' + MARK + '" loại thoi_diem')
  }

  console.log('\n3) Thêm dịch vụ vào hồ sơ (chi phí 3.240.000đ)')
  {
    const { data: svc, error } = await s.from('hcns_case_services').insert({
      hcns_client_id: caseId, template_id: tplId, cost: 3240000,
      received_at: new Date().toISOString().slice(0, 10), status: 'thu_thap',
    }).select().single()
    if (error) throw new Error(error.message)
    svcId = svc.id
    const { data: tplTasks } = await s.from('hcns_service_template_tasks')
      .select('id').eq('template_id', tplId).eq('is_active', true)
    await s.from('hcns_case_service_tasks').insert(
      tplTasks.map(t => ({ case_service_id: svcId, template_task_id: t.id, done: false })))
    await s.from('hcns_case_service_status_log').insert({
      case_service_id: svcId, status: 'thu_thap', changed_by: anyStaff.id })
    const { count } = await s.from('hcns_case_service_tasks')
      .select('id', { count: 'exact', head: true }).eq('case_service_id', svcId)
    count === 2 ? ok('tự sinh đủ 2 công việc theo mẫu') : ng('sinh checklist sai: ' + count)
  }

  console.log('\n4) Tích 1 công việc + đổi trạng thái')
  {
    const { data: tasks } = await s.from('hcns_case_service_tasks').select('id').eq('case_service_id', svcId).limit(1)
    await s.from('hcns_case_service_tasks').update({
      done: true, done_by: anyStaff.id, done_at: new Date().toISOString() }).eq('id', tasks[0].id)
    const { count: done } = await s.from('hcns_case_service_tasks')
      .select('id', { count: 'exact', head: true }).eq('case_service_id', svcId).eq('done', true)
    done === 1 ? ok('tích 1/2 việc -> 50%') : ng('tích việc sai')

    await s.from('hcns_case_services').update({ status: 'nop_ho_so' }).eq('id', svcId)
    await s.from('hcns_case_service_status_log').insert({
      case_service_id: svcId, status: 'nop_ho_so', changed_by: anyStaff.id })
    const { count: logs } = await s.from('hcns_case_service_status_log')
      .select('id', { count: 'exact', head: true }).eq('case_service_id', svcId)
    logs === 2 ? ok('nhật ký trạng thái ghi đủ 2 dòng') : ng('nhật ký sai: ' + logs)
  }

  console.log('\n5) Ghi công nợ nhiều lần trong cùng tháng')
  {
    const add = (amount, serviceId, note) => s.from('hcns_case_payments').insert({
      hcns_client_id: caseId, case_service_id: serviceId, amount, note, created_by: anyStaff.id })

    const { error: e1 } = await add(1000000, svcId, 'Lần 1 - chuyển khoản')
    const { error: e2 } = await add(500000, svcId, 'Lần 2 - tiền mặt')
    const { error: e3 } = await add(240000, null, 'Thu chung cả hồ sơ')
    if (e1 || e2 || e3) ng('ghi công nợ lỗi: ' + (e1 || e2 || e3).message)
    else ok('ghi được 3 lần thu trong cùng tháng (bảng cũ chỉ cho 1 dòng/tháng)')

    const { data: pays } = await s.from('hcns_case_payments').select('amount, case_service_id').eq('hcns_client_id', caseId)
    const total = pays.reduce((a, p) => a + Number(p.amount), 0)
    total === 1740000 ? ok('tổng đã thu ' + fmt(total) + 'đ') : ng('tổng sai: ' + total)

    const perSvc = pays.filter(p => p.case_service_id === svcId).reduce((a, p) => a + Number(p.amount), 0)
    perSvc === 1500000 ? ok('thu theo dịch vụ ' + fmt(perSvc) + 'đ, tách được khỏi khoản thu chung') : ng('tách theo dịch vụ sai: ' + perSvc)

    const remain = 3240000 - total
    remain === 1500000 ? ok('còn phải thu ' + fmt(remain) + 'đ') : ng('còn lại sai: ' + remain)
  }

  console.log('\n6) Nhật ký thu ghi đủ ai thu / lúc nào')
  {
    const { data: pays } = await s.from('hcns_case_payments')
      .select('amount, note, created_by, created_at').eq('hcns_client_id', caseId).order('created_at')
    const full = pays.every(p => p.created_by && p.created_at && p.amount)
    full ? ok('cả 3 dòng đều có số tiền, người thu, thời điểm') : ng('nhật ký thiếu thông tin')
    pays.some(p => p.note?.includes('Lần 1')) ? ok('ghi chú từng lần thu được lưu') : ng('mất ghi chú')
  }

} catch (e) {
  ng('Ngoại lệ: ' + e.message)
} finally {
  if (caseId) {
    await s.from('hcns_case_payments').delete().eq('hcns_client_id', caseId)
    const { data: svcs } = await s.from('hcns_case_services').select('id').eq('hcns_client_id', caseId)
    for (const v of (svcs || [])) {
      await s.from('hcns_case_service_tasks').delete().eq('case_service_id', v.id)
      await s.from('hcns_case_service_status_log').delete().eq('case_service_id', v.id)
    }
    await s.from('hcns_case_services').delete().eq('hcns_client_id', caseId)
    await s.from('hcns_clients').delete().eq('id', caseId)
  }
  if (tplId) {
    await s.from('hcns_service_template_tasks').delete().eq('template_id', tplId)
    await s.from('hcns_service_templates').delete().eq('id', tplId)
  }
  const { count: leftC } = await s.from('hcns_clients').select('id', { count: 'exact', head: true }).like('name', 'ZZ_TEST_CASE_%')
  const { count: leftT } = await s.from('hcns_service_templates').select('id', { count: 'exact', head: true }).like('name', 'ZZ_TEST_CASE_%')
  console.log('\nDọn dẹp: ' + ((leftC || 0) + (leftT || 0) === 0 ? 'đã xoá sạch dữ liệu tạm.' : 'CHÚ Ý — còn sót bản ghi tạm!'))
  console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi.')
  process.exit(fail === 0 ? 0 : 1)
}
