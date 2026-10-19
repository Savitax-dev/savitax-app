// Ghi hồ sơ + thông báo lấy từ cổng thuế vào cơ sở dữ liệu — Phân hệ Tờ khai.
//
// Dùng chung cho HAI đường lấy dữ liệu:
//   - Local: máy chủ tự gọi cổng (chỉ chạy khi máy có IP Việt Nam).
//   - Production: tiện ích Chrome gọi hộ, máy chủ chỉ đọc phản hồi.
// Nhờ tách ra đây, đổi cách ghi dữ liệu chỉ sửa một chỗ, hai đường không lệch nhau.
import { chuanHoaKyBang } from './taxDeadline'
import { chuanHoaTrangThai, doanLoaiToKhaiTuTen } from './dvcPortal'

// ds          : các dòng đọc từ bảng tra cứu (docBangKetQua)
// chiTietTheo : Map mã hồ sơ → kết quả docChiTiet (ngày tiếp nhận + thông báo). Có thể rỗng.
export async function ghiHoSoVaThongBao(supabase, clientId, ds, chiTietTheo = new Map()) {
  if (!ds.length) {
    return { themMoi: 0, capNhat: 0, khopNghiaVu: 0, khongKhop: 0, soThongBao: 0, doiTrangThaiNghiaVu: 0 }
  }

  const [{ data: loaiTK }, { data: nghiaVu }, { data: daCo }] = await Promise.all([
    supabase.from('tax_filing_types').select('id, code, ma_tkhai_portal, period_kind'),
    supabase.from('tax_obligations')
      .select('id, filing_type_id, period_code, state, due_date').eq('client_id', clientId),
    supabase.from('tax_filings').select('id, portal_code, state').eq('client_id', clientId),
  ])

  const theoMaCong = new Map((loaiTK || []).filter(t => t.ma_tkhai_portal).map(t => [t.ma_tkhai_portal, t]))
  const theoMaCode = new Map((loaiTK || []).map(t => [t.code, t]))
  const dangCo = new Map((daCo || []).map(f => [f.portal_code, f]))

  let themMoi = 0, capNhat = 0, khopNghiaVu = 0, khongKhop = 0, soThongBao = 0
  const capNhatNghiaVu = []

  for (const r of ds) {
    // Khớp loại tờ khai: ưu tiên mã cổng (chắc chắn), không có thì lấy mã in trong tên.
    let loai = r.maToKhaiCong ? theoMaCong.get(r.maToKhaiCong) : null
    if (!loai && r.tenToKhai) {
      // Cắt ở ' - ' CÓ KHOẢNG TRẮNG hai bên: mã tờ khai có thể tự chứa gạch ngang
      // ('04/SS-HĐĐT'), cắt ở gạch ngang trần là mất đuôi mã nên không khớp được danh mục.
      loai = theoMaCode.get(r.tenToKhai.split(' - ')[0].trim()) || null
    }
    // Hồ sơ tab cũ (nộp trước 01/07/2025): bảng kết quả không có mã, tên cũng không kèm mã —
    // đoán từ tên. Chỉ dùng khi hai cách chắc chắn ở trên đã thất bại, nên không ảnh hưởng gì
    // tới hồ sơ tab DVC.
    if (!loai && r.tenToKhai) {
      const ma = doanLoaiToKhaiTuTen(r.tenToKhai)
      if (ma) loai = theoMaCode.get(ma) || null
    }

    // Chưa khớp được loại tờ khai thì đoán kỳ theo THÁNG, không phải quý.
    //
    // Bảng tra cứu của cổng ghi có quy luật: quý có tiền tố ('Q4/2024'), năm để trần ('2024'),
    // còn THÁNG để trần dạng MM/YYYY ('03/2025'). Hai dạng đầu đã có nhánh riêng xử lý, nên
    // chuỗi rơi xuống tới đây gần như chắc chắn là tháng. Mặc định 'quarter' biến '03/2025'
    // thành Q3.2025 — sai kỳ, kéo theo sai tên thư mục lúc tải file (BAOCAOTHUE_Q3_2025 thay vì
    // BAOCAOTHUE_T03_2025) và không khớp được nghĩa vụ. Gặp thật 11/10/2026 ở PAPER ART VIỆT.
    // chuanHoaKyBang chứ KHÔNG phải chuanHoaKy: chuỗi này lấy từ BẢNG TRA CỨU, nơi tháng để trần
    // '09/2026' — xem chú thích ở lib/taxDeadline.js về lỗi "quý 9" ngày 19/10/2026.
    let ky = chuanHoaKyBang(r.kyTinhThue, loai?.period_kind)
    // Tờ khai theo lần phát sinh (thông báo hóa đơn lập sai…) không có kỳ tính thuế trên cổng —
    // lấy ngày nộp làm mốc để mỗi lần phát sinh là một dòng riêng, không đè lên nhau.
    //
    // CHỈ KHI CỔNG ĐỂ TRỐNG. Cổng có ghi chữ mà ta đọc không ra thì KHÔNG đổi thành 'PS.' — để
    // nguyên chữ gốc (xem period_code bên dưới). Trước đây đọc hỏng là bị ghi đè thành PS., chuỗi
    // gốc mất sạch, nên lỗi "quý 9" phải nhờ anh chụp màn hình cổng mới tìm ra được.
    if (!ky && !String(r.kyTinhThue || '').trim() && r.ngayNop) ky = 'PS.' + r.ngayNop.slice(0, 10)

    const trangThai = chuanHoaTrangThai(r.trangThaiCong)

    // Gắn vào nghĩa vụ bằng bộ đôi (loại tờ khai, kỳ) — MST đã cố định theo công ty.
    const nv = (loai && ky)
      ? (nghiaVu || []).find(o => o.filing_type_id === loai.id && o.period_code === ky)
      : null
    if (nv) khopNghiaVu++
    else khongKhop++

    const chiTiet = chiTietTheo.get(r.maHoSo) || null

    const dong = {
      client_id: clientId,
      obligation_id: nv?.id || null,
      portal: 'dvc',
      portal_code: r.maHoSo,
      tthc_code: r.maTTHC,
      filing_type_id: loai?.id || null,
      period_code: ky || r.kyTinhThue || '(không đọc được)',
      form_kind: r.loaiToKhai || 'Chính thức',
      submit_no: r.lanNop || 1,
      amend_no: r.lanBoSung || 0,
      tax_office: r.coQuanThue,
      submitted_at: r.ngayNop,
      portal_status: r.trangThaiCong,
      state: trangThai,
      synced_at: new Date().toISOString(),
    }

    if (chiTiet?.ngayTiepNhan) {
      dong.received_at = chiTiet.ngayTiepNhan
      // Đúng hạn xét theo NGÀY TIẾP NHẬN so với hạn nộp — không phải ngày chấp nhận, cũng không
      // phải ngày nộp. Chưa gắn được nghĩa vụ thì chưa kết luận được.
      if (nv?.due_date) dong.on_time = chiTiet.ngayTiepNhan.slice(0, 10) <= nv.due_date
    }

    let filingId = dangCo.get(r.maHoSo)?.id || null
    if (filingId) {
      await supabase.from('tax_filings').update(dong).eq('id', filingId)
      capNhat++
    } else {
      const { data: moi } = await supabase.from('tax_filings').insert(dong).select('id').single()
      filingId = moi?.id || null
      themMoi++
    }

    // Thông báo thuế đi kèm. Khóa (client_id, portal_id) nên chạy lại không tạo trùng.
    for (const tb of chiTiet?.thongBao || []) {
      if (!tb.portalId) continue
      soThongBao++
      await supabase.from('tax_notices').upsert({
        client_id: clientId,
        filing_id: filingId,
        portal_id: tb.portalId,
        notice_kind: tb.loai,
        title: tb.tieuDe,
        ngay_tbao: tb.thoiDiem ? tb.thoiDiem.slice(0, 10) : null,
        issued_at: tb.thoiDiem,
      }, { onConflict: 'client_id,portal_id' })
    }

    // Nghĩa vụ chuyển theo trạng thái hồ sơ. KHÔNG đụng vào nghĩa vụ đã đánh "Không phát sinh".
    if (nv && nv.state !== trangThai && nv.state !== 'no_activity') {
      capNhatNghiaVu.push({ id: nv.id, state: trangThai })
    }
  }

  for (const n of capNhatNghiaVu) {
    await supabase.from('tax_obligations')
      .update({ state: n.state, state_changed_at: new Date().toISOString() }).eq('id', n.id)
  }

  return {
    themMoi, capNhat, khopNghiaVu, khongKhop, soThongBao,
    doiTrangThaiNghiaVu: capNhatNghiaVu.length,
  }
}
