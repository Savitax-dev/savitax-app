// Luật sinh lịch hạn nộp (tax_obligations) cho MỘT công ty — dùng chung cho:
//   - scripts/seed-tax-obligations.mjs  (sinh cả năm cho mọi công ty, chạy tay đầu năm)
//   - app/api/admin/tokhai/ky-khai       (đổi kỳ khai một loại tờ khai của một công ty)
//
// VÌ SAO GOM VỀ MỘT CHỖ (anh chốt hướng A ngày 19/10/2026): trước đây luật nằm gọn trong script
// năm. Nếu nút "Lưu kỳ khai" tự viết luật riêng thì năm sau chạy script, nó lại sinh TNCN theo
// THÁNG cho công ty đã đổi sang QUÝ — đúng cái lỗi vừa sửa xong quay về. Hai đường phải đọc cùng
// một luật.
//
// KỲ KHAI của một (công ty, loại tờ khai) tại một thời điểm:
//   1. Có dòng ghi đè trong tax_client_filings có hiệu lực (effective_from <= thời điểm) thì theo
//      dòng MỚI NHẤT trong số đó.
//   2. Không có thì theo clients.report_type của công ty — như từ trước tới nay.
//
// Ca thật dẫn tới việc này: VINA HSIN GON và CHARGEPOINT kê GTGT theo THÁNG nhưng kê TNCN theo
// QUÝ (cổng ghi 'Q3/2026'). App sinh nghĩa vụ TNCN theo tháng cho họ, nên tờ khai quý đã được
// chấp nhận vẫn bị báo "Chưa nộp" — hạn 20/10/2026.
//
// Hàm THUẦN, không gọi cơ sở dữ liệu: dễ kiểm (scripts/test-tokhai-lich.mjs).
import { cacKyTrongNam, kyQuyetToanNam, hanNop } from './taxDeadline.js'

// 'month' | 'quarter' (cách bảng tax_client_filings ghi) <-> 'monthly' | 'quarterly' (cách
// clients.report_type và cacKyTrongNam ghi). Hai bảng đặt tên khác nhau từ trước.
const sangKieu = (pk) => (pk === 'month' ? 'monthly' : 'quarterly')

// Kỳ khai (monthly | quarterly) của công ty cho một loại tờ khai, tại ngày `ngayISO`.
// ghiDe: các dòng tax_client_filings của ĐÚNG công ty + loại tờ khai này.
export function kyKhaiTai(client, ghiDe, ngayISO) {
  const hieuLuc = (ghiDe || [])
    .filter(g => g.effective_from && g.effective_from <= ngayISO && (g.period_kind === 'month' || g.period_kind === 'quarter'))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  if (hieuLuc.length) return sangKieu(hieuLuc[0].period_kind)
  return client.report_type === 'monthly' ? 'monthly' : 'quarterly'
}

// Các nghĩa vụ ĐỊNH KỲ của một (công ty, loại tờ khai) trong năm `nam`.
//
// Một kỳ được sinh khi kỳ khai CÓ HIỆU LỰC TẠI NGÀY ĐẦU KỲ đúng bằng loại của kỳ đó: tháng 8 chỉ
// sinh nếu ngày 01/08 công ty đang khai tháng; quý 3 chỉ sinh nếu ngày 01/07 công ty đang khai
// quý. Vì thế ngày đổi kỳ khai PHẢI là ngày đầu quý (nút Lưu chỉ cho chọn quý) — đổi giữa quý thì
// sẽ có tháng không thuộc kỳ nào.
//
// tuNgay: chỉ lấy kỳ BẮT ĐẦU từ ngày này trở đi (dùng khi sinh lại sau khi đổi kỳ khai).
export function nghiaVuDinhKy({ client, loai, nam, ngayLe = new Set(), ghiDe = [], tuNgay = null }) {
  const ra = []
  for (const kieu of ['monthly', 'quarterly']) {
    for (const k of cacKyTrongNam(kieu, nam)) {
      if (kyKhaiTai(client, ghiDe, k.period_start) !== kieu) continue
      if (tuNgay && k.period_start < tuNgay) continue
      // Công ty ký hợp đồng giữa năm: không sinh cho kỳ TRƯỚC khi ký — Savitax chưa hề nhận làm.
      if (client.contract_start && k.period_end < client.contract_start) continue
      ra.push({
        client_id: client.id, filing_type_id: loai.id,
        period_code: k.period_code, period_start: k.period_start, period_end: k.period_end,
        due_date: hanNop(k.period_kind, k.period_end, ngayLe),
        state: 'not_filed',
      })
    }
  }
  return ra.sort((a, b) => (a.period_start < b.period_start ? -1 : 1))
}

// Nghĩa vụ QUYẾT TOÁN năm của một (công ty, loại tờ khai) — không đổi theo kỳ khai.
export function nghiaVuQuyetToan({ client, loai, nam, ngayLe = new Set() }) {
  const k = kyQuyetToanNam(nam)
  if (client.contract_start && k.period_end < client.contract_start) return []
  return [{
    client_id: client.id, filing_type_id: loai.id,
    period_code: k.period_code, period_start: k.period_start, period_end: k.period_end,
    due_date: hanNop(k.period_kind, k.period_end, ngayLe),
    state: 'not_filed',
  }]
}

// 'Q3.2026' -> '2026-07-01'. Ngày đổi kỳ khai luôn là đầu một quý.
export function ngayDauQuy(maQuy) {
  const m = String(maQuy || '').match(/^Q([1-4])\.(\d{4})$/)
  if (!m) return null
  return m[2] + '-' + String((+m[1]) * 3 - 2).padStart(2, '0') + '-01'
}

// Quý BAO TRÙM một kỳ tháng: 'T09.2026' -> 'Q3.2026'. Không phải kỳ tháng thì null.
//
// Dùng khi XEM theo tháng (Lịch hạn nộp, Hồ sơ đã nộp): công ty kê LẪN tháng và quý — vd HSIN kê
// GTGT theo tháng, TNCN theo quý — thì tờ khai TNCN quý 3 nộp cùng ngày với GTGT tháng 9 cũng phải
// hiện khi xem tháng 9. Không thì nó biến mất khỏi màn hình (anh thấy ngày 19/10/2026: cột TNCN
// tháng 9 hiện "—", trang Hồ sơ đã nộp chỉ còn 1 trên 2 tờ khai).
export function quyBaoTrum(maKy) {
  const m = String(maKy || '').match(/^T(\d{2})\.(\d{4})$/)
  if (!m) return null
  return 'Q' + Math.ceil(+m[1] / 3) + '.' + m[2]
}

// Kiểu của một mã kỳ trong app: 'T09.2026' -> 'monthly', 'Q3.2026' -> 'quarterly', còn lại
// (năm, phát sinh 'PS.…', chữ đọc không ra) -> null.
export function kieuCuaKy(maKy) {
  const s = String(maKy || '')
  if (/^T(0[1-9]|1[0-2])\.\d{4}$/.test(s)) return 'monthly'
  if (/^Q[1-4]\.\d{4}$/.test(s)) return 'quarterly'
  return null
}

// Mã quý chứa một kỳ tháng/quý: 'T08.2026' -> 'Q3.2026', 'Q3.2026' -> 'Q3.2026'.
export function quyCuaKy(maKy) {
  return kieuCuaKy(maKy) === 'quarterly' ? String(maKy) : quyBaoTrum(maKy)
}

// TỰ NHẬN KỲ KHAI THEO CỔNG — anh duyệt 19/10/2026 ("đẩy rồi làm tự động đi em").
//
// Cổng thuế là sự thật: công ty nộp TNCN kỳ 'Q3/2026' và cổng đã nhận thì công ty ĐANG khai TNCN
// theo quý, dù hồ sơ công ty trong app ghi "kê tháng". Hàm này so hồ sơ đã nộp với kỳ khai app
// đang giữ, trả về những lần cần đổi — để khỏi phải chờ trưởng phòng phát hiện rồi bấm tay.
//
// CHỈ TỰ ĐỔI khi chứng cứ rõ ràng:
//   - hồ sơ được cổng tiếp nhận / chấp nhận (bị trả về thì chưa chắc công ty khai kiểu đó);
//   - tờ chính thức, không phải bổ sung (bổ sung chỉ sửa kỳ cũ, không nói gì về kỳ khai);
//   - loại tờ khai định kỳ (loaiTheoId chỉ được chứa loại tháng/quý);
//   - trong CÙNG MỘT QUÝ, loại tờ khai đó không có cả tờ tháng lẫn tờ quý. Có cả hai thì có thể
//     nhân viên nộp nhầm -> đưa vào `xemTay`, không tự đổi.
//   - kỳ khai đang áp dụng ở quý đó KHÔNG do người đặt tay (approved_by có giá trị). Người đã cố ý
//     chọn thì app không cãi — báo `xemTay` để trưởng phòng xem lại.
//
// Đổi luôn tính TỪ ĐẦU QUÝ (luật sinh lịch bắt buộc vậy — xem nghiaVuDinhKy). Duyệt các quý từ cũ
// tới mới, và nhớ những lần vừa đổi, nên công ty khai quý rồi quay lại khai tháng cũng ra đúng hai
// lần đổi.
//
// tuNgay: bỏ qua các quý bắt đầu trước ngày này — chỉ xét phạm vi lịch hạn nộp đang có, khỏi đẻ
// lịch cho mấy năm cũ chỉ vì đồng bộ về hồ sơ năm 2024.
//
// Trả về { doi: [{ filingTypeId, code, periodKind: 'month'|'quarter', tuNgay, quy }], xemTay: [...] }
//
// HAI LỚP CHẶN DỮ LIỆU HỎNG — chạy khô ngày 19/10/2026 suýt đổi nhầm VƯU ĐỨC PHÁT, HOÀNG ĐỨC PHÁT,
// TRANG HẬU PHƯƠNG (đều khai THÁNG) sang quý: hồ sơ của họ đồng bộ 01/10, TRƯỚC khi sửa lỗi "quý 9",
// nên kỳ tháng nằm trong DB dưới dạng quý (T03 thành 'Q3.2026' nộp 20/04, T06 thành 'Q2.2026' nộp
// 20/07). Mã kỳ trong DB không còn chuỗi gốc để sửa ngược, phải đồng bộ lại mới đúng. Vì thế:
//   1. chỉ tin hồ sơ ĐỒNG BỘ SAU MOC_KY_DUNG (synced_at) — đồng bộ lại thì synced_at và mã kỳ đổi
//      cùng lúc, nên hồ sơ nào còn mốc cũ là hồ sơ còn mã kỳ cũ;
//   2. ngày nộp phải SAU ngày cuối kỳ — không ai nộp tờ quý 3 vào tháng 4. Lớp này bắt được T03 /
//      T04 đọc nhầm, nhưng KHÔNG bắt được T06 -> Q2 (nộp 20/07 trông y như tờ quý 2 thật), nên lớp
//      1 mới là lớp chính.
export const MOC_KY_DUNG = '2026-10-19T04:00:00Z'   // 11:00 giờ VN — sau khi bản sửa 69ceebc lên

// Ngày đầu tiên SAU kỳ: 'T09.2026' -> '2026-10-01', 'Q3.2026' -> '2026-10-01', 'Q4.2026' -> '2027-01-01'.
export function ngaySauKy(maKy) {
  const s = String(maKy || '')
  let m = s.match(/^T(\d{2})\.(\d{4})$/)
  let thang, nam
  if (m) { thang = +m[1] + 1; nam = +m[2] }
  else if ((m = s.match(/^Q([1-4])\.(\d{4})$/))) { thang = (+m[1]) * 3 + 1; nam = +m[2] }
  else return null
  if (thang > 12) { thang -= 12; nam++ }
  return nam + '-' + String(thang).padStart(2, '0') + '-01'
}

const TRANG_THAI_TINH = new Set(['accepted', 'received'])
export function timKyKhaiTheoCong({ client, loaiTheoId, ghiDe = [], hoSo = [], tuNgay = null, dongBoTu = MOC_KY_DUNG }) {
  const doi = [], xemTay = []
  for (const [id, loai] of loaiTheoId) {
    const theoQuy = new Map()   // 'Q3.2026' -> Set('monthly' | 'quarterly')
    for (const h of hoSo) {
      if (h.filing_type_id !== id || !TRANG_THAI_TINH.has(h.state)) continue
      if (/bổ sung/i.test(h.form_kind || '') || (h.amend_no || 0) > 0) continue
      const kieu = kieuCuaKy(h.period_code)
      if (!kieu) continue
      if (dongBoTu && !(h.synced_at && new Date(h.synced_at) >= new Date(dongBoTu))) continue
      if (!h.submitted_at || String(h.submitted_at).slice(0, 10) < ngaySauKy(h.period_code)) continue
      const quy = quyCuaKy(h.period_code)
      if (tuNgay && ngayDauQuy(quy) < tuNgay) continue
      if (!theoQuy.has(quy)) theoQuy.set(quy, new Set())
      theoQuy.get(quy).add(kieu)
    }

    const ghiDeLoai = ghiDe.filter(g => g.filing_type_id === id).map(g => ({ ...g }))
    const cacQuy = [...theoQuy.keys()].sort((a, b) => (ngayDauQuy(a) < ngayDauQuy(b) ? -1 : 1))
    for (const quy of cacQuy) {
      const kieu = theoQuy.get(quy)
      const dauQuy = ngayDauQuy(quy)
      if (kieu.size > 1) {
        xemTay.push({ filingTypeId: id, code: loai.code, quy, lyDo: 'cùng quý có cả tờ khai tháng lẫn tờ khai quý' })
        continue
      }
      const kieuCong = [...kieu][0]
      if (kyKhaiTai(client, ghiDeLoai, dauQuy) === kieuCong) continue

      const dangApDung = ghiDeLoai
        .filter(g => g.effective_from && g.effective_from <= dauQuy)
        .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0]
      if (dangApDung?.approved_by) {
        xemTay.push({ filingTypeId: id, code: loai.code, quy, lyDo: 'kỳ khai do người đặt tay khác với kỳ trên cổng' })
        continue
      }
      const periodKind = kieuCong === 'monthly' ? 'month' : 'quarter'
      doi.push({ filingTypeId: id, code: loai.code, periodKind, tuNgay: dauQuy, quy })
      // Ghi nhớ ngay để quý sau so với kỳ khai MỚI. Cùng ngày áp dụng thì thay dòng cũ (y như
      // upsert theo khoá (công ty, loại, ngày áp dụng) lúc ghi thật).
      const cung = ghiDeLoai.findIndex(g => g.effective_from === dauQuy)
      const moi = { filing_type_id: id, period_kind: periodKind, effective_from: dauQuy, approved_by: null }
      if (cung >= 0) ghiDeLoai[cung] = moi
      else ghiDeLoai.push(moi)
    }
  }
  return { doi, xemTay }
}

// Câu báo kết quả tự đổi kỳ khai, dùng ở màn hình đồng bộ: "05/KK-TNCN → Quý từ Q3/2026".
// Không đổi gì thì trả chuỗi rỗng.
export function moTaTuDoiKy(ds) {
  return (ds || []).map(d => d.code + ' → ' + (d.periodKind === 'month' ? 'Tháng' : 'Quý')
    + ' từ ' + String(d.quy || '').replace('.', '/')).join('; ')
}
