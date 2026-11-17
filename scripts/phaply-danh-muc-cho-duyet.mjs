// Phân hệ Pháp lý — gom danh mục địa danh + cơ quan thuế + mẫu trống thành MỘT file Excel để anh duyệt
// trước khi nạp vào app (anh chốt 31/10/2026: danh mục phải được duyệt rồi mới nạp). Chỉ đọc file CSV
// trong data/phaply/danh-muc, không gọi Supabase.
//   node scripts/phaply-danh-muc-cho-duyet.mjs   → data/phaply/danh-muc/Danh-muc-phap-ly-cho-duyet.xlsx
import { readFileSync } from 'node:fs'
import { soExcelMoi, themSheetMang } from '../lib/excelDep.js'

const GOC = 'data/phaply/danh-muc'
const RA = `${GOC}/Danh-muc-phap-ly-cho-duyet.xlsx`

// CSV có ô bọc "…" (địa chỉ chứa dấu phẩy)
function docCsv(p) {
  const dong = readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
  const tach = l => { const o = []; let s = '', q = false
    for (let i = 0; i < l.length; i++) { const c = l[i]
      if (q) { if (c === '"' && l[i + 1] === '"') { s += '"'; i++ } else if (c === '"') q = false; else s += c }
      else if (c === '"') q = true; else if (c === ',') { o.push(s); s = '' } else s += c }
    o.push(s); return o }
  const cot = tach(dong[0])
  return dong.slice(1).map(l => Object.fromEntries(tach(l).map((v, i) => [cot[i], v])))
}

const tinh = docCsv(`${GOC}/dia-danh/tinh.csv`)
const xa = docCsv(`${GOC}/dia-danh/xa.csv`)
const dkkd = docCsv(`${GOC}/dia-danh/phong-dkkd.csv`)
const cqt = docCsv(`${GOC}/co-quan-thue/co-quan-thue.csv`)
const diaBan = docCsv(`${GOC}/co-quan-thue/dia-ban.csv`)

const cqtTheoKhoa = new Map(cqt.map(r => [r.khoa, r]))
const banTheoXa = new Map(diaBan.map(r => [r.ma_xa, r]))
const dkkdTheoTinh = new Map(dkkd.map(r => [r.ma_tinh, r]))
const thueTinh = new Map(cqt.filter(r => r.cap === 'tinh').map(r => [r.ma_tinh, r]))
const LOAI = { phuong: 'Phường', xa: 'Xã', dac_khu: 'Đặc khu', tinh: 'Tỉnh', thanh_pho: 'Thành phố' }
const CAP = { cuc: 'Cục Thuế', chi_cuc: 'Chi cục', tinh: 'Thuế tỉnh/TP', co_so: 'Thuế cơ sở' }

// ---- đối chiếu 2 nguồn (danh mục hành chính ↔ địa bàn thuế)
const lech = []
for (const r of diaBan) {
  const x = xa.find(v => v.ma_xa === r.ma_xa)
  if (!x) { lech.push(['Mã xã không có trong danh mục hành chính', r.ten_tinh, r.ma_xa, r.ten_xa, '', r.ten_cqt, 'Cần soi bản gốc QĐ 19/2025 để biết mã đúng']); continue }
  if (x.ten_xa.normalize() === r.ten_xa.normalize()) continue
  const lenPhuong = /^Phường/.test(x.ten_xa) && /^Xã/.test(r.ten_xa)
  lech.push([lenPhuong ? 'Xã đã lên phường (nguồn thuế ra trước)' : 'Khác chính tả (dấu nháy / chữ hoa)', x.ten_tinh, r.ma_xa, x.ten_xa, r.ten_xa, r.ten_cqt,
    lenPhuong ? 'Lấy tên danh mục hành chính — đã cập nhật' : 'Lấy tên danh mục hành chính; ô tìm kiếm coi hai cách viết là một'])
}
const coBan = new Set(diaBan.map(r => r.ma_xa))
for (const x of xa) if (!coBan.has(x.ma_xa)) lech.push(['Xã chưa gán cơ quan thuế', x.ten_tinh, x.ma_xa, x.ten_xa, '', '', 'Cùng xã với dòng mã lệch ở trên (nếu cùng tên) — chốt mã rồi gán'])

const wb = await soExcelMoi()

// ---- 1. Tóm tắt
const dem = (ds, f) => ds.filter(f).length
themSheetMang(wb, 'Tóm tắt', [
  ['DANH MỤC PHÂN HỆ PHÁP LÝ — BẢN CHỜ ANH DUYỆT'],
  [`Dựng ngày 01/11/2026 trên máy local, CHƯA nạp vào app. Danh mục tính đến 01/11/2026. Nguồn chi tiết: ${GOC}/dia-danh/NGUON.md và ${GOC}/co-quan-thue/NGUON.md`],
  [],
  ['A. Số lượng'],
  ['Danh mục', 'Số dòng', 'Nguồn chính', 'Độ tin cậy', 'Ghi chú'],
  ['Tỉnh / thành phố', tinh.length, 'QĐ 19/2025/QĐ-TTg (bản ký số, chinhphu.vn)', 'Cao', `${dem(tinh, r => r.loai === 'thanh_pho')} thành phố, ${dem(tinh, r => r.loai === 'tinh')} tỉnh — đã áp NQ 30/2026/QH16 (Đồng Nai thành thành phố)`],
  ['Phường / xã / đặc khu', xa.length, 'Phụ lục I CV 1027/CTK-CSCL (Cục Thống kê) + đối chiếu QĐ 19', 'Cao', `${dem(xa, r => r.loai === 'phuong')} phường, ${dem(xa, r => r.loai === 'xa')} xã, ${dem(xa, r => r.loai === 'dac_khu')} đặc khu — đã áp NQ 237 & NQ 388/UBTVQH16 (22 xã lên phường)`],
  ['Thuế tỉnh / thành phố', dem(cqt, r => r.cap === 'tinh'), 'QĐ 1378/QĐ-CT ngày 30/6/2025 (gdt.gov.vn)', 'Cao', 'Kèm Cục Thuế + 2 chi cục (Doanh nghiệp lớn, Thương mại điện tử)'],
  ['Thuế cơ sở', dem(cqt, r => r.cap === 'co_so'), 'QĐ 1378/QĐ-CT + QĐ 1011/QĐ-CT (15/7/2026, đổi nơi đặt trụ sở 2 đơn vị)', 'Cao', 'Nơi đặt trụ sở mới có tên phường/xã, chưa có số nhà'],
  ['Phường/xã → Thuế cơ sở quản lý', diaBan.length, 'CV 4334/CT-CĐS (bản chép Manabox — NGUỒN PHỤ), đã soi các nhóm lệch trên bản quét QĐ 1378', 'Khá', 'Mỗi xã đúng 1 Thuế cơ sở; Hà Nội 126/126 khớp phụ lục thuvienphapluat'],
  ['Phòng Đăng ký kinh doanh', dkkd.length, 'Cổng dangkykinhdoanh.gov.vn', 'Cao (tên) / Thấp (địa chỉ)', 'Địa chỉ trên cổng còn ghi quận/huyện cũ — không in thẳng lên hồ sơ'],
  ['Mã cơ quan thuế trên tờ khai (maCQTNoiNop)', dem(cqt, r => r.ma_cqt), 'Đọc từ tờ khai XML khách đã nộp (ổ chung G:), chỉ lấy cặp mã + tên cơ quan', 'Cao (chỗ có)',
    `Thuế tỉnh ${dem(cqt, r => r.cap === 'tinh' && r.ma_cqt)}/${dem(cqt, r => r.cap === 'tinh')}, Thuế cơ sở ${dem(cqt, r => r.cap === 'co_so' && r.ma_cqt)}/${dem(cqt, r => r.cap === 'co_so')} — nơi chưa có khách thì chưa có mã. Chi tiết: co-quan-thue/ma-cqt-tu-to-khai.csv`],
  [],
  ['B. Cần anh chốt'],
  ['STT', 'Việc', 'Phương án em đề xuất', 'Lý do', 'Anh chốt'],
  [1, 'Tên Phòng ĐKKD ghi trên hồ sơ', 'Dùng tên riêng từng tỉnh (cột "Tên ghi trên hồ sơ" ở sheet Tỉnh thành)', 'Mỗi tỉnh đặt tên phòng khác nhau (Hà Nội: "Phòng ĐKKD và tài chính doanh nghiệp", Lào Cai: "Phòng Doanh nghiệp"…). Ghi mẫu chung dễ sai tên cơ quan nhận', 'ĐÃ CHỐT 01/11: tên riêng từng tỉnh'],
  [2, 'Mã cơ quan thuế trên tờ khai', 'Đọc thẻ mã cơ quan thuế trong tờ khai XML đã có ở phân hệ Tờ khai (chỉ đọc, chỉ lấy mã + tên cơ quan, không lấy dữ liệu khách)', 'Không có nguồn công khai; HTKK là bộ cài, em không tự tải. Cách khác: anh/chị mở HTKK ở máy văn phòng xuất danh mục', 'ĐÃ CHO PHÉP 01/11 — đã đọc, xem cột "Mã trên tờ khai"'],
  [3, 'Xã Ia Mơ (Gia Lai) có 2 mã khác nhau', 'Em soi bản quét QĐ 19 trang Gia Lai rồi báo lại', 'Danh mục hành chính ghi 23737, danh mục địa bàn thuế ghi 23938', 'ĐÃ SOI: QĐ 19 trang 90 ghi 23938 → dùng 23938'],
  [4, '12 phường mới của Bắc Ninh (NQ 388, hiệu lực 20/9/2026)', 'Giữ mã cũ tới khi Cục Thống kê có công văn', 'Đổi loại xã → phường không đổi mã (QĐ 19 Điều 2)', ''],
  [5, 'Gia Lai dự kiến lập 5 phường mới', 'Chưa áp — chờ nghị quyết UBTVQH; danh mục sửa được ở màn quản trị', 'Mới có HĐND tỉnh tán thành chủ trương (21/10/2026)', ''],
  [6, '6 mẫu Excel trống (giải thể, chấm dứt VPĐD, cấp lại GPKD, khôi phục MST)', 'Chuyên viên pháp lý xem lại các ô em để trống / trỏ lại (sheet Mẫu trống)', 'Mẫu tách từ hồ sơ khách thật; vài sheet chép từ hồ sơ khách khác', ''],
], { doRong: [8, 34, 52, 52, 26] })

// ---- 2. Tỉnh thành
const soTheo = (ma, loai) => xa.filter(r => r.ma_tinh === ma && r.loai === loai).length
themSheetMang(wb, 'Tỉnh thành', [
  ['TỈNH / THÀNH PHỐ — PHÒNG ĐĂNG KÝ KINH DOANH — THUẾ TỈNH'],
  ['Địa chỉ phòng ĐKKD lấy nguyên văn trên cổng dangkykinhdoanh.gov.vn — nhiều nơi còn ghi quận/huyện cũ.'],
  ['Mã tỉnh', 'Tên tỉnh / thành phố', 'Loại', 'Số phường', 'Số xã', 'Số đặc khu', 'Thuế tỉnh', 'Tên phòng ĐKKD ghi trên hồ sơ', 'Địa chỉ phòng ĐKKD (theo cổng)', 'Điện thoại', 'Email', 'Ghi chú'],
  ...tinh.map(t => { const d = dkkdTheoTinh.get(t.ma_tinh) || {}; return [t.ma_tinh, t.ten_tinh, LOAI[t.loai] || t.loai,
    soTheo(t.ma_tinh, 'phuong'), soTheo(t.ma_tinh, 'xa'), soTheo(t.ma_tinh, 'dac_khu'), thueTinh.get(t.ma_tinh)?.ten_cqt || '',
    d.ten_ghi_ho_so || '', d.dia_chi || '', d.so_dien_thoai || '', d.email || '', t.ghi_chu || ''] }),
  ['TỔNG', '', '', dem(xa, r => r.loai === 'phuong'), dem(xa, r => r.loai === 'xa'), dem(xa, r => r.loai === 'dac_khu')],
], { doRong: [8, 26, 10, 9, 8, 9, 30, 50, 60, 16, 30, 30] })

// ---- 3. Phường xã
themSheetMang(wb, 'Phường xã', [
  ['PHƯỜNG / XÃ / ĐẶC KHU → THUẾ CƠ SỞ QUẢN LÝ'],
  ['Nhân viên chọn tỉnh → phường/xã ở trụ sở, app tự gợi ý Thuế cơ sở theo cột F. "Mã cơ quan thu" là mã trên giấy nộp tiền, KHÔNG phải mã trên tờ khai.'],
  ['Mã xã', 'Tên phường / xã', 'Loại', 'Tỉnh / thành phố', 'Mã tỉnh', 'Thuế cơ sở quản lý', 'Nơi đặt trụ sở Thuế cơ sở', 'Mã cơ quan thu NSNN', 'Ghi chú'],
  ...xa.map(x => { const b = banTheoXa.get(x.ma_xa); const c = b ? cqtTheoKhoa.get(b.khoa_cqt) : null
    const gc = [x.ghi_chu, b && b.ten_xa.normalize() !== x.ten_xa.normalize() ? `Nguồn thuế ghi "${b.ten_xa}"` : '', b ? '' : 'CHƯA GÁN cơ quan thuế'].filter(Boolean).join('; ')
    return [x.ma_xa, x.ten_xa, LOAI[x.loai] || x.loai, x.ten_tinh, x.ma_tinh, b?.ten_cqt || '', c?.noi_dat_tru_so || '', b?.ma_co_quan_thu_nsnn || '', gc] }),
], { doRong: [9, 30, 9, 26, 8, 36, 30, 14, 44] })

// ---- 4. Cơ quan thuế
themSheetMang(wb, 'Cơ quan thuế', [
  ['CƠ QUAN THUẾ (từ 01/7/2025: Cục Thuế → 34 Thuế tỉnh/TP → 350 Thuế cơ sở)'],
  ['Cột "Mã trên tờ khai" đọc từ tờ khai XML khách đã nộp; ô trống = chưa có khách nào nộp ở cơ quan đó (bổ sung dần khi có tờ khai mới). "Khoá nội bộ" do em đặt để nối dữ liệu, không phải mã của ngành thuế.'],
  ['Khoá nội bộ', 'Tên cơ quan thuế', 'Cấp', 'Tỉnh / thành phố', 'Cấp trên', 'Nơi đặt trụ sở', 'Số xã quản lý', 'Mã cơ quan thu NSNN', 'Mã trên tờ khai', 'Ghi chú'],
  ...cqt.map(c => [c.khoa, c.ten_cqt, CAP[c.cap] || c.cap, c.ten_tinh, cqtTheoKhoa.get(c.khoa_cap_tren)?.ten_cqt || '', c.noi_dat_tru_so, c.so_xa ? +c.so_xa : '', c.ma_co_quan_thu_nsnn, c.ma_cqt, c.ghi_chu]),
], { doRong: [12, 40, 13, 26, 34, 30, 10, 14, 12, 50] })

// ---- 5. Lệch giữa 2 nguồn
themSheetMang(wb, 'Lệch 2 nguồn', [
  ['ĐỐI CHIẾU: DANH MỤC HÀNH CHÍNH ↔ ĐỊA BÀN THUẾ (ghép theo mã xã)'],
  [`Khớp mã ${diaBan.length - lech.filter(l => /^Mã xã/.test(l[0])).length}/${diaBan.length} xã. Các dòng dưới là chỗ hai nguồn ghi khác nhau.`],
  ['Loại', 'Tỉnh', 'Mã xã', 'Tên theo danh mục hành chính', 'Tên theo nguồn thuế', 'Thuế cơ sở', 'Xử lý'],
  ...lech,
], { doRong: [36, 22, 9, 30, 30, 34, 56] })

// ---- 6. Mẫu trống
themSheetMang(wb, 'Mẫu trống', [
  ['MẪU EXCEL TRỐNG TÁCH TỪ HỒ SƠ THẬT — templates/phaply/excel-mau/'],
  ['Đã xoá toàn bộ dữ liệu khách + người được ủy quyền; giữ công thức. Đã mở thử bằng Excel thật: không báo Repair, 0 ô lỗi, công thức trỏ lại lấy đúng ô (điền dữ liệu giả để kiểm).'],
  ['File', 'Thủ tục', 'Loại hình', 'Số sheet', 'Công thức', 'Đã trỏ lại về sheet ThôngTin', 'Để trống', 'Cần pháp lý xem'],
  ['GT_1TV.xlsx', 'Giải thể', 'TNHH 1TV', 31, 267, 12, 0, 'Bản đủ nhất (04/2026): có cam kết chưa mở TKNH, chi trả lao động, không hoàn thuế…'],
  ['GT_2TV.xlsx', 'Giải thể', 'TNHH 2TV', 27, 244, 7, 10, 'Biên bản họp: thành viên 5–6 trỏ sang file khác → để trống (bảng thành viên chỉ có 4 dòng)'],
  ['GT_VPDD_2TV.xlsx', 'Chấm dứt văn phòng đại diện', 'TNHH 2TV', 15, 127, 11, 0, 'QĐ HĐTV Điều 7 ("Ông/bà … là Chủ tịch HĐTV") em trỏ về Người đại diện PL — sheet ThôngTin không có ô Chủ tịch'],
  ['GT_VPDD_CP.xlsx', 'Chấm dứt văn phòng đại diện', 'Cổ phần', 13, 107, 0, 109, 'Sheet BBH chép từ biên bản ĐỔI TÊN / ĐỔI NGƯỜI ĐẠI DIỆN của khách khác, 109 công thức hỏng → để trống, cần soạn lại BBH chấm dứt VPĐD'],
  ['CAPLAI_GPKD_1TV.xlsx', 'Cấp lại Giấy chứng nhận ĐKDN', 'TNHH 1TV', 3, 25, 1, 0, '"Kính gửi: Phòng ĐKKD …" trỏ về ô "Liên hệ sở kế hoạch"'],
  ['KP_MST_1TV.xlsx', 'Khôi phục mã số thuế', 'TNHH 1TV', 5, 30, 2, 0, '—'],
], { doRong: [22, 28, 12, 9, 10, 14, 10, 80] })

await wb.xlsx.writeFile(RA)
console.log('→', RA, '| lệch 2 nguồn:', lech.length)
