// Sinh lại lịch hạn nộp của MỘT (công ty, loại tờ khai) sau khi đổi kỳ khai — anh chốt hướng A
// ngày 19/10/2026. Gọi từ app/api/admin/tokhai/ky-khai (ghi thật) và từ script chạy thử.
//
// TÁCH RA KHỎI ROUTE để chạy KHÔ được trên dữ liệu thật trước khi bấm thật: hàm này XOÁ nghĩa vụ
// trong cơ sở dữ liệu, mà xoá nhầm một nghĩa vụ đã có kết quả là mất dấu vết đã nộp, không lấy lại
// được. `thu: true` -> tính hết, trả về đúng những gì SẼ làm, nhưng không ghi gì.
import { nghiaVuDinhKy } from './tokhaiLich.js'

// ghiDeGia: danh sách kỳ khai ghi đè dùng THAY cho bảng tax_client_filings — chỉ để chạy thử "giả
// sử đổi thì sẽ ra sao" mà chưa ghi lần đổi nào. Không truyền thì đọc bảng như bình thường.
export async function sinhLaiLich(supabase, { client, loai, tuNgay, thu = false, ghiDeGia = null }) {
  const [{ data: ghiDeDb }, { data: ngayLeRows }, { data: dangCo }, { data: hoSo }] = await Promise.all([
    supabase.from('tax_client_filings').select('period_kind, effective_from').eq('client_id', client.id).eq('filing_type_id', loai.id),
    supabase.from('tax_holidays').select('day'),
    supabase.from('tax_obligations').select('id, period_code, period_start, due_date, state')
      .eq('client_id', client.id).eq('filing_type_id', loai.id).gte('period_start', tuNgay),
    supabase.from('tax_filings').select('id, obligation_id, period_code, state, received_at')
      .eq('client_id', client.id).eq('filing_type_id', loai.id),
  ])
  const ngayLe = new Set((ngayLeRows || []).map(h => h.day))
  const ghiDe = ghiDeGia || ghiDeDb || []

  // Lịch ĐÚNG từ kỳ áp dụng trở đi, theo đúng luật dùng chung với script năm. Sinh tới năm xa
  // nhất hiện đang có nghĩa vụ (script năm có thể đã sinh trước năm sau).
  const namDau = +tuNgay.slice(0, 4)
  const namCuoi = Math.max(new Date().getFullYear(), ...(dangCo || []).map(o => +String(o.period_start).slice(0, 4)))
  let mongMuon = []
  for (let nam = namDau; nam <= namCuoi; nam++) {
    mongMuon = mongMuon.concat(nghiaVuDinhKy({ client, loai, nam, ngayLe, ghiDe, tuNgay }))
  }
  const maMongMuon = new Set(mongMuon.map(o => o.period_code))
  const maDangCo = new Set((dangCo || []).map(o => o.period_code))
  const daGanHoSo = new Set((hoSo || []).map(h => h.obligation_id).filter(Boolean))
  const maHoSo = new Set((hoSo || []).map(h => h.period_code))

  // XOÁ nghĩa vụ không còn đúng — CHỈ cái còn TRẮNG TINH: chưa nộp, chưa gắn hồ sơ, chưa ai đánh
  // dấu "Không phát sinh". Cái nào đã có dữ liệu thì GIỮ NGUYÊN và báo lại cho người bấm biết.
  const xoa = [], giuLai = []
  for (const o of dangCo || []) {
    if (maMongMuon.has(o.period_code)) continue
    if (o.state === 'not_filed' && !daGanHoSo.has(o.id)) xoa.push(o)
    else giuLai.push(o)
  }

  // SINH kỳ mới. Kỳ ĐÃ QUA HẠN chỉ sinh khi có sẵn hồ sơ để gắn vào — giống script năm: sinh kỳ quá
  // hạn trống trơn là báo "Quá hạn" đỏ oan cho việc có thể đã làm xong từ trước.
  const homNay = new Date().toISOString().slice(0, 10)
  const them = mongMuon.filter(o => !maDangCo.has(o.period_code))
    .filter(o => o.due_date > homNay || maHoSo.has(o.period_code))

  // Hồ sơ sẽ được GẮN LẠI vào nghĩa vụ mới — bước làm tờ khai quý đã nộp chuyển thành "Đã nộp".
  const maThem = new Set(them.map(o => o.period_code))
  const seGan = (hoSo || []).filter(h => !h.obligation_id && maThem.has(h.period_code))

  const ketQua = {
    daXoa: xoa.map(o => o.period_code),
    daThem: them.map(o => o.period_code),
    ganLaiHoSo: seGan.map(h => h.period_code),
    giuLai: giuLai.map(o => ({ ky: o.period_code, trangThai: o.state })),
  }
  if (thu) return { ...ketQua, thu: true }

  if (xoa.length) {
    const { error } = await supabase.from('tax_obligations').delete().in('id', xoa.map(o => o.id))
    if (error) throw new Error('Không xoá được lịch cũ: ' + error.message)
  }
  let moi = []
  if (them.length) {
    const { data, error } = await supabase.from('tax_obligations').insert(them).select('id, period_code, due_date')
    if (error) throw new Error('Không sinh được lịch mới: ' + error.message)
    moi = data || []
  }
  // Cập nhật trạng thái nghĩa vụ y như lúc đồng bộ (lib/tokhaiGhi.js), và tính đúng hạn theo NGÀY
  // TIẾP NHẬN nếu có.
  const nvTheoMa = new Map(moi.map(o => [o.period_code, o]))
  for (const h of seGan) {
    const nv = nvTheoMa.get(h.period_code)
    if (!nv) continue
    const capNhat = { obligation_id: nv.id }
    if (h.received_at && nv.due_date) capNhat.on_time = String(h.received_at).slice(0, 10) <= nv.due_date
    await supabase.from('tax_filings').update(capNhat).eq('id', h.id)
    await supabase.from('tax_obligations')
      .update({ state: h.state, state_changed_at: new Date().toISOString() }).eq('id', nv.id)
  }
  return ketQua
}
