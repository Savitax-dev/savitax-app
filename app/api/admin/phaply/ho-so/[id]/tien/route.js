// Phân hệ Pháp lý — tiền của một hồ sơ: lưu phí + lịch thu theo đợt (PUT), ghi một lần thu (POST), xoá mềm khoản thu (DELETE).
// Quy tắc: kế hoạch mục 8 + lib/phaply/tien.js. Người không có view_phaply_fee không đụng được gì ở đây.
import { requirePhapLy, suaDuoc, loi } from '@/lib/phaply/quyen'
import { COT_HO_SO, docHoSoDayDu } from '@/lib/phaply/hoSoMayChu'
import { BUOC_DONG, homNayVN } from '@/lib/phaply/hoSo'
import { tachKhoanThu, apLichMau } from '@/lib/phaply/tien'

const so = v => Math.max(0, Math.round(Number(v) || 0))

async function moHoSo(auth, id) {
  if (!auth.q.tien) return { loi: loi(403, 'Không có quyền xem / ghi tiền hồ sơ pháp lý') }
  const { data: hs } = await auth.admin.from('legal_cases').select(COT_HO_SO).eq('id', id).maybeSingle()
  if (!hs || !suaDuoc(auth, hs)) return { loi: loi(403, 'Bạn chỉ cập nhật được hồ sơ mình phụ trách') }
  return { hs }
}

// PUT { fees: [{kind, name, amount}], dots: [{id?, seq, name, amount_dich_vu, amount_thu_ho, due_stage?, due_date?, note?}] }
//   hoặc { ap_lich_mau: planId } — dựng lại lịch thu từ mẫu theo phí đang có
export async function PUT(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { id } = await params
  const m = await moHoSo(auth, id); if (m.loi) return m.loi
  const { admin, q } = auth
  if (m.hs.stage >= BUOC_DONG) return loi(409, 'Hồ sơ đã đóng')
  const b = await request.json().catch(() => ({}))
  const cu = await docHoSoDayDu(admin, id)
  const coThu = cu.payments.some(p => !p.deleted_at)
  // Sửa giá sau khi đã thu tiền: chỉ trưởng phòng (close_phaply_case) — kế hoạch mục 9
  if (coThu && !q.dong && Array.isArray(b.fees)) return loi(403, 'Hồ sơ đã có khoản thu — chỉ trưởng phòng sửa được phí')

  let fees = cu.fees
  if (Array.isArray(b.fees)) {
    fees = b.fees.filter(f => ['dich_vu', 'thu_ho'].includes(f.kind) && String(f.name || '').trim())
      .map((f, i) => ({ case_id: id, kind: f.kind, name: String(f.name).trim().slice(0, 200), amount: so(f.amount), sort: i }))
    await admin.from('legal_case_fees').delete().eq('case_id', id)
    if (fees.length) { const { error } = await admin.from('legal_case_fees').insert(fees); if (error) return loi(500, error.message) }
  }

  let dots = b.dots
  if (b.ap_lich_mau) {
    const { data: lm } = await admin.from('legal_payment_plans').select('items').eq('id', b.ap_lich_mau).maybeSingle()
    if (!lm) return loi(404, 'Không thấy lịch thu mẫu')
    const dv = fees.filter(f => f.kind === 'dich_vu').reduce((a, f) => a + so(f.amount), 0)
    const th = fees.filter(f => f.kind === 'thu_ho').reduce((a, f) => a + so(f.amount), 0)
    // Giữ id các đợt cũ theo thứ tự để khoản thu đã ghi vẫn gắn đúng đợt
    dots = apLichMau(lm.items, dv, th).map((d, i) => ({ ...d, id: cu.installments[i]?.id }))
  }
  if (Array.isArray(dots)) {
    const giu = new Set(dots.filter(d => d.id).map(d => d.id))
    const bo = cu.installments.filter(d => !giu.has(d.id))
    const dangDung = bo.filter(d => cu.payments.some(p => !p.deleted_at && p.installment_id === d.id))
    if (dangDung.length) return loi(409, `Đợt "${dangDung[0].name}" đã có khoản thu — không bỏ được (sửa số tiền thay vì xoá)`)
    if (bo.length) await admin.from('legal_case_installments').delete().in('id', bo.map(d => d.id))
    for (const [i, d] of dots.entries()) {
      const row = {
        case_id: id, seq: i + 1, name: String(d.name || `Đợt ${i + 1}`).trim().slice(0, 120),
        amount_dich_vu: so(d.amount_dich_vu), amount_thu_ho: so(d.amount_thu_ho),
        due_stage: Number(d.due_stage) >= 1 && Number(d.due_stage) <= BUOC_DONG ? Number(d.due_stage) : null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(d.due_date || '') ? d.due_date : null,
        note: String(d.note || '').trim() || null,
      }
      const kq = d.id && cu.installments.some(x => x.id === d.id)
        ? await admin.from('legal_case_installments').update(row).eq('id', d.id)
        : await admin.from('legal_case_installments').insert(row)
      if (kq.error) return loi(500, kq.error.message)
    }
  }
  return Response.json({ ok: true })
}

// POST — ghi MỘT lần khách trả. { installment_id?, so_tien, amount_dich_vu?, amount_thu_ho?, paid_at, method?, note? }
// Không tách tay thì trừ THU HỘ còn thiếu của đợt trước, phần còn lại là phí dịch vụ.
export async function POST(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { id } = await params
  const m = await moHoSo(auth, id); if (m.loi) return m.loi
  const { admin, caller } = auth
  const b = await request.json().catch(() => ({}))
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(b.paid_at || '') ? b.paid_at : null
  if (!ngay) return loi(400, 'Nhập ngày khách trả (ngày tiền về thật)')
  if (ngay > homNayVN()) return loi(400, 'Ngày trả không được sau hôm nay')
  const cu = await docHoSoDayDu(admin, id)
  const dot = b.installment_id ? cu.tien.dots.find(d => d.id === b.installment_id) : null
  if (b.installment_id && !dot) return loi(404, 'Không thấy đợt thu')

  let tach
  if (b.amount_dich_vu != null && b.amount_thu_ho != null && b.amount_dich_vu !== '' && b.amount_thu_ho !== '') {
    tach = { amount_dich_vu: so(b.amount_dich_vu), amount_thu_ho: so(b.amount_thu_ho) }
  } else {
    const conThuHo = dot ? dot.con_thu_ho : cu.tien.phi_thu_ho - cu.tien.da_thu_thu_ho
    tach = tachKhoanThu(b.so_tien, conThuHo)
  }
  if (tach.amount_dich_vu + tach.amount_thu_ho <= 0) return loi(400, 'Nhập số tiền')
  const { error } = await admin.from('legal_case_payments').insert({
    case_id: id, installment_id: dot?.id || null, ...tach, paid_at: ngay,
    staff_id: m.hs.assigned_to || caller.staffId,          // doanh số tính người phụ trách LÚC THU
    method: ['chuyen_khoan', 'tien_mat', 'khac'].includes(b.method) ? b.method : null,
    note: String(b.note || '').trim() || null, created_by: caller.staffId,
  })
  return error ? loi(500, error.message) : Response.json({ ok: true, ...tach })
}

// DELETE { payment_id, reason } — xoá mềm, chỉ close_phaply_case
export async function DELETE(request, { params }) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  if (!auth.q.dong) return loi(403, 'Chỉ trưởng phòng xoá được khoản thu')
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (!String(b.reason || '').trim()) return loi(400, 'Ghi lý do xoá khoản thu')
  const { data, error } = await auth.admin.from('legal_case_payments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.caller.staffId, delete_reason: String(b.reason).trim() })
    .eq('id', b.payment_id).eq('case_id', id).is('deleted_at', null).select('id')
  if (error) return loi(500, error.message)
  if (!data?.length) return loi(404, 'Không thấy khoản thu (hoặc đã xoá)')
  return Response.json({ ok: true })
}
