// Sinh lại lịch hạn nộp của MỘT (công ty, loại tờ khai) sau khi đổi kỳ khai — anh chốt hướng A
// ngày 19/10/2026. Gọi từ app/api/admin/tokhai/ky-khai (ghi thật) và từ script chạy thử.
//
// TÁCH RA KHỎI ROUTE để chạy KHÔ được trên dữ liệu thật trước khi bấm thật: hàm này XOÁ nghĩa vụ
// trong cơ sở dữ liệu, mà xoá nhầm một nghĩa vụ đã có kết quả là mất dấu vết đã nộp, không lấy lại
// được. `thu: true` -> tính hết, trả về đúng những gì SẼ làm, nhưng không ghi gì.
import { nghiaVuDinhKy, timKyKhaiTheoCong } from './tokhaiLich.js'

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

// TỰ ĐỔI KỲ KHAI THEO CỔNG cho MỘT công ty — gọi ngay sau mỗi lần đồng bộ (lib/tokhaiGhi.js) và từ
// script quét một lần scripts/tu-doi-ky-khai.mjs. Luật nằm ở timKyKhaiTheoCong (hàm thuần, có bộ
// kiểm); ở đây chỉ đọc dữ liệu, ghi lần đổi (approved_by = null nghĩa là APP TỰ ĐỔI, không phải
// người bấm) rồi sinh lại lịch bằng đúng sinhLaiLich mà nút tay dùng.
//
// thu: true -> chỉ tính, không ghi gì (script quét chạy khô trước khi anh duyệt).
export async function tuDoiKyKhaiTheoCong(supabase, clientId, { thu = false } = {}) {
  const [{ data: client }, { data: loaiTK }, { data: ghiDe }, { data: hoSo }, { data: nvDau }] = await Promise.all([
    supabase.from('clients').select('id, name, report_type, contract_start').eq('id', clientId).maybeSingle(),
    supabase.from('tax_filing_types').select('id, code, period_kind, is_active'),
    supabase.from('tax_client_filings').select('filing_type_id, period_kind, effective_from, approved_by').eq('client_id', clientId),
    supabase.from('tax_filings').select('filing_type_id, period_code, state, form_kind, amend_no, submitted_at, synced_at')
      .eq('client_id', clientId).not('filing_type_id', 'is', null),
    // Kỳ sớm nhất đang có trong lịch hạn nộp — chỉ xét từ đó trở đi (xem timKyKhaiTheoCong).
    supabase.from('tax_obligations').select('period_start').eq('client_id', clientId)
      .order('period_start', { ascending: true }).limit(1),
  ])
  if (!client || !nvDau?.length) return { doi: [], xemTay: [] }

  const loaiTheoId = new Map((loaiTK || [])
    .filter(t => t.is_active !== false && (t.period_kind === 'month' || t.period_kind === 'quarter'))
    .map(t => [t.id, t]))
  const { doi, xemTay } = timKyKhaiTheoCong({
    client, loaiTheoId, ghiDe: ghiDe || [], hoSo: hoSo || [], tuNgay: nvDau[0].period_start,
  })
  if (!doi.length) return { doi: [], xemTay }

  // Gom theo loại tờ khai: một loại có thể đổi hai lần (quý rồi lại tháng) — ghi hết các lần đổi
  // rồi sinh lại lịch MỘT lần từ lần đổi sớm nhất.
  const theoLoai = new Map()
  for (const d of doi) {
    if (!theoLoai.has(d.filingTypeId)) theoLoai.set(d.filingTypeId, [])
    theoLoai.get(d.filingTypeId).push(d)
  }
  const ra = []
  for (const [id, cacLan] of theoLoai) {
    const loai = loaiTheoId.get(id)
    const tuNgay = cacLan[0].tuNgay
    const moi = cacLan.map(d => ({
      client_id: clientId, filing_type_id: id, period_kind: d.periodKind, effective_from: d.tuNgay, approved_by: null,
    }))
    let kq
    if (thu) {
      const ngayMoi = new Set(moi.map(m => m.effective_from))
      const gia = [...(ghiDe || []).filter(g => g.filing_type_id === id && !ngayMoi.has(g.effective_from)), ...moi]
      kq = await sinhLaiLich(supabase, { client, loai, tuNgay, thu: true, ghiDeGia: gia })
    } else {
      const { error } = await supabase.from('tax_client_filings')
        .upsert(moi, { onConflict: 'client_id,filing_type_id,effective_from' })
      if (error) throw new Error('Không lưu được kỳ khai tự đổi: ' + error.message)
      kq = await sinhLaiLich(supabase, { client, loai, tuNgay })
    }
    for (const d of cacLan) ra.push({ ...d, ketQua: kq })
  }
  return { doi: ra, xemTay }
}
