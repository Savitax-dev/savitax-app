// Kiểm công ty CHỈ dùng Dịch vụ khác (clients.dvk_only, sql/29) không làm hỏng %-KPI công việc.
//
//   node scripts/test-dvk-only.mjs
//
// VÌ SAO PHẢI CÓ BỘ KIỂM RIÊNG: cả hai đường tính %-công việc đều có nhánh
//
//     tasks.length === 0 ? 100
//
// (app/api/admin/room/route.js, app/api/admin/kpi-overview/route.js). Công ty Dịch vụ khác không
// có checklist, nên nếu chỉ cho nó ra 0 việc là nhân viên được 100% MIỄN PHÍ cho mỗi công ty dạng
// này — càng nhiều công ty DVK thì %-công việc càng đẹp.
//
// Sai kiểu này không ai phát hiện được bằng mắt: nhìn vào chỉ thấy "nhân viên này làm tốt". Chỉ
// tới kỳ xét lương mới lòi ra, mà lúc đó không truy ngược lại được tháng nào đúng tháng nào sai.
//
// Bộ kiểm dựng lại ĐÚNG công thức của hai route đó trên dữ liệu giả, không đụng Supabase.

let dat = 0, hong = 0
const kiem = (ten, dieuKien, them) => {
  if (dieuKien) { dat++; console.log('  ✓ ' + ten) }
  else { hong++; console.log('  ✗ ' + ten + (them ? '  → ' + them : '')) }
}
const mean = (a) => a.length === 0 ? 0 : Math.round(a.reduce((x, v) => x + v, 0) / a.length)

// Công thức SAU KHI SỬA — chép y hệt app/api/admin/room/route.js.
// Sửa công thức ở route thì phải sửa cả ở đây, nếu không bộ kiểm canh một thứ đã chết.
//
// `dvkOnly` là TẬP HỢP id, không phải cờ đọc trên từng dòng công ty: cột `dvk_only` được đọc bằng
// một truy vấn riêng có nuốt lỗi (lib/dvkOnly.js), vì nhét cột đó vào danh sách cột chung sẽ làm
// PostgREST hỏng NGUYÊN truy vấn khi chưa chạy sql/29 — mọi công ty biến mất sạch, đã xảy ra thật
// trên máy anh ngày 14/10/2026.
function phanTramCongViec(dsCty) {
  const dvkOnly = new Set(dsCty.filter(c => c.dvk_only === true).map(c => c.id))
  const ctyChamViec = dsCty.filter(c => !dvkOnly.has(c.id))
  const pctCua = (c) => c.tasks.length === 0 ? 100
    : Math.round(c.tasks.filter(t => t.xong).length / c.tasks.length * 100)
  const taskPcts = ctyChamViec.map(pctCua)
  return ctyChamViec.length === 0 ? 0 : mean(taskPcts)
}
let _id = 0
const danhId = (ds) => ds.map(c => ({ ...c, id: 'c' + (++_id) }))

const viec = (soViec, soXong) =>
  Array.from({ length: soViec }, (_, i) => ({ xong: i < soXong }))

const ketoanTot  = { dvk_only: false, tasks: viec(10, 10) }  // 100%
const ketoanKem  = { dvk_only: false, tasks: viec(10, 4) }   // 40%
const dvk        = { dvk_only: true,  tasks: [] }

console.log('\n[1] Công ty Dịch vụ khác KHÔNG được kéo %-công việc lên:')
const khongDvk = phanTramCongViec(danhId([ketoanKem]))
const coDvk    = phanTramCongViec(danhId([ketoanKem, dvk]))
kiem('một công ty kế toán 40% → 40%', khongDvk === 40, 'ra ' + khongDvk)
kiem('thêm 1 công ty DVK vào → VẪN 40%, không nhảy lên 70%', coDvk === 40, 'ra ' + coDvk)
const nhieuDvk = phanTramCongViec(danhId([ketoanKem, dvk, dvk, dvk, dvk]))
kiem('thêm 4 công ty DVK → vẫn đúng 40%', nhieuDvk === 40, 'ra ' + nhieuDvk)
// Đây là con số sẽ ra nếu ai đó bỏ bộ lọc đi — ghi rõ để lần sau nhìn là biết hỏng ở đâu.
kiem('(nếu bỏ lọc thì 2 công ty sẽ ra 70% — con số sai cần nhớ mặt)',
  Math.round((40 + 100) / 2) === 70)

console.log('')
console.log('[2] Nhân viên CHỈ có công ty Dịch vụ khác → 0%, không phải 100%:')
const chiDvk = phanTramCongViec(danhId([dvk, dvk]))
kiem('hai công ty DVK → 0%', chiDvk === 0, 'ra ' + chiDvk)
kiem('không công ty nào → 0%', phanTramCongViec(danhId([])) === 0)

console.log('')
console.log('[3] Công ty kế toán bình thường không bị ảnh hưởng:')
kiem('một công ty 100% → 100%', phanTramCongViec(danhId([ketoanTot])) === 100)
kiem('100% và 40% → 70%', phanTramCongViec(danhId([ketoanTot, ketoanKem])) === 70)
// Công ty kế toán THẬT SỰ không có việc nào tháng này (vd tháng không có task mẫu) vẫn giữ
// nguyên hành vi cũ là 100% — không được "tiện tay" sửa luôn, đó là chuyện khác.
kiem('công ty kế toán 0 việc vẫn giữ nguyên 100% như trước',
  phanTramCongViec(danhId([{ dvk_only: false, tasks: [] }])) === 100)

console.log('')
console.log('[4] Cờ chưa có / để rỗng thì coi như công ty kế toán bình thường:')
// Dữ liệu cũ (294 công ty) không có cột này; đọc ra undefined phải chạy y như trước.
kiem('dvk_only undefined → vẫn tính vào %', phanTramCongViec(danhId([{ tasks: viec(10, 4) }])) === 40)
kiem('dvk_only null → vẫn tính vào %',
  phanTramCongViec(danhId([{ dvk_only: null, tasks: viec(10, 4) }])) === 40)
kiem('dvk_only = false → vẫn tính vào %',
  phanTramCongViec(danhId([{ dvk_only: false, tasks: viec(10, 4) }])) === 40)
// Chỉ đúng chữ true mới loại — tránh ca chuỗi 'false' hay số 0 lọt lưới thành loại nhầm.
kiem("chuỗi 'true' KHÔNG được coi là bật (phải đúng kiểu boolean)",
  phanTramCongViec(danhId([{ dvk_only: 'true', tasks: viec(10, 4) }])) === 40)

console.log(hong === 0 ? `\nTẤT CẢ ${dat} MỤC ĐỀU ĐẠT.` : `\nCÓ ${hong} MỤC HỎNG.`)
process.exit(hong === 0 ? 0 : 1)
