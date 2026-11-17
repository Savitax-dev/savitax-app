// Phân hệ Pháp lý — báo cáo: doanh số theo tháng THU (phần dịch vụ), dòng tiền công nợ (tồn đầu + phát sinh − đã thu
// = chuyển kỳ sau, tách dịch vụ / thu hộ), số hồ sơ mới / đóng. Cả phòng (trưởng phòng) hoặc của riêng mình.
// Bất biến (anh tự cộng): cộng trừ khớp; chuyển kỳ sau T(n) = tồn đầu T(n+1); tổng nhân viên = tổng phòng.
// GĐ 6: + bảng theo hồ sơ (bước, phí, đã thu, còn nợ, số ngày, trễ), hồ sơ treo (chờ / trễ / quá hạn bổ sung), đếm hồ sơ theo nhân viên
// (lib/phaply/baoCao.js). Kiểm bất biến trên dữ liệu thật: scripts/test-phaply-bao-cao.mjs --that.
import { requirePhapLy, locPhamVi, docHet, loi } from '@/lib/phaply/quyen'
import { docTienNhieuHoSo, nhanVienPhapLy } from '@/lib/phaply/hoSoMayChu'
import { homNayVN } from '@/lib/phaply/hoSo'
import { tongHopHoSo, suKienTien, dongTien, cacThangTu, doanhSoTheoThang, truocVat, thang } from '@/lib/phaply/tien'
import { trongKy, dongHoSo, dongTreo, xepTreo, demHoSoNv } from '@/lib/phaply/baoCao'

export async function GET(request) {
  const auth = await requirePhapLy()
  if (!auth.ok) return loi(auth.status, auth.error)
  const { admin, q } = auth
  if (!q.tien) return loi(403, 'Không có quyền xem số tiền pháp lý')
  const sp = new URL(request.url).searchParams
  const hn = homNayVN()
  const toi = /^\d{4}-\d{2}$/.test(sp.get('toi') || '') ? sp.get('toi') : hn.slice(0, 7)
  const tu = /^\d{4}-\d{2}$/.test(sp.get('tu') || '') ? sp.get('tu') : toi
  if (tu > toi) return loi(400, 'Tháng bắt đầu sau tháng kết thúc')
  const thangs = cacThangTu(tu, toi)
  if (thangs.length > 36) return loi(400, 'Tối đa 36 tháng')

  let cases
  try {
    cases = await docHet((a, b) => locPhamVi(admin.from('legal_cases')
      .select('id, code, title, procedure_code, entity_type, stage, wait_state, assigned_to, received_at, due_at, closed_at, is_deleted').eq('is_deleted', false), auth)
      .order('id').range(a, b))
  } catch (e) { return /legal_cases/.test(e.message) ? Response.json({ chua_cai: true }) : loi(500, e.message) }

  const tienMap = await docTienNhieuHoSo(admin, cases.map(c => c.id))
  const evTheoNv = new Map(), evPhong = [], tatCaThu = [], tongHop = new Map()
  for (const c of cases) {
    const t = tienMap.get(c.id)
    const th = tongHopHoSo({ hoSo: c, fees: t.fees, dots: t.dots, payments: t.payments, nhatKy: t.nhatKy, homNayISO: hn })
    tongHop.set(c.id, th)
    const ev = suKienTien(th.dots, t.payments)
    // Công nợ thuộc người ĐANG phụ trách hồ sơ (chưa giao → '_')
    const k = c.assigned_to || '_'
    if (!evTheoNv.has(k)) evTheoNv.set(k, [])
    evTheoNv.get(k).push(...ev); evPhong.push(...ev)
    tatCaThu.push(...t.payments)
  }
  const dsTheoThang = doanhSoTheoThang(tatCaThu)
  const nv = await nhanVienPhapLy(admin)
  const tenNv = new Map(nv.map(n => [n.id, n.ten]))
  // Phạm vi nhân viên: chỉ mình (dữ liệu đã lọc theo hồ sơ của mình + chưa giao)
  const ids = new Set([...evTheoNv.keys(), ...Object.values(dsTheoThang).flatMap(o => Object.keys(o.theo_nv)), ...cases.map(c => c.assigned_to || '_')])
  // hồ sơ treo: ngày bắt đầu trạng thái chờ hiện tại + lần nộp mới nhất (hạn bổ sung)
  const mo = cases.filter(c => Number(c.stage) < 10).map(c => c.id)
  const [nkCho, nop] = await Promise.all([
    mo.length ? docHet((a, b) => admin.from('legal_case_stage_log').select('case_id, to_value, created_at').in('case_id', mo).eq('kind', 'wait').order('created_at').order('id').range(a, b)) : [],
    mo.length ? docHet((a, b) => admin.from('legal_case_submissions').select('case_id, ngay_nop, created_at, ket_qua, han_bo_sung, noi_dung_bo_sung').in('case_id', mo).order('ngay_nop').order('created_at').order('id').range(a, b)).catch(() => []) : [],
  ])
  const choTu = new Map(), nopMoi = new Map()
  for (const l of nkCho) choTu.set(l.case_id, l.created_at ? homNayVN(new Date(l.created_at)) : null)   // lần đổi trạng thái chờ CUỐI
  for (const s of nop) nopMoi.set(s.case_id, s)
  const ten = id => tenNv.get(id) || '(Nhân viên khác)'
  const hoSo = cases.filter(c => trongKy(c, tu, toi)).map(c => dongHoSo(c, tongHop.get(c.id), { tenNv: ten, homNay: hn }))
    .sort((a, b) => String(b.nhan).localeCompare(String(a.nhan)) || a.ma.localeCompare(b.ma))
  const treo = xepTreo(cases.map(c => dongTreo(c, { choTu: choTu.get(c.id), boSung: nopMoi.get(c.id), tenNv: ten, homNay: hn })).filter(Boolean))
  const dem = demHoSoNv(cases, thangs)
  const nhanVien = [...ids].map(id => ({
    id, ten: id === '_' ? '(Chưa giao)' : tenNv.get(id) || '(Nhân viên khác)',
    dong_tien: dongTien(evTheoNv.get(id) || [], thangs),
    doanh_so: thangs.map(m => dsTheoThang[m]?.theo_nv?.[id] || 0),
    ho_so: dem.get(id) || thangs.map(() => ({ moi: 0, xong: 0, dang: 0 })),
  })).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))

  return Response.json({
    tu, toi, thangs,
    phong: {
      dong_tien: dongTien(evPhong, thangs),
      doanh_so: thangs.map(m => ({ thang: m, gom_vat: dsTheoThang[m]?.gom_vat || 0, truoc_vat: truocVat(dsTheoThang[m]?.gom_vat || 0) })),
      ho_so_moi: thangs.map(m => cases.filter(c => thang(c.received_at) === m).length),
      ho_so_dong: thangs.map(m => cases.filter(c => c.closed_at && homNayVN(new Date(c.closed_at)).slice(0, 7) === m).length),
    },
    nhan_vien: nhanVien,
    ho_so: hoSo, treo,
    ca_phong: q.ca_phong,
  })
}
