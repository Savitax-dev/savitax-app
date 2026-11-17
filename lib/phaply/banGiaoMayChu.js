// Phân hệ Pháp lý — đọc dữ liệu để xét điều kiện đóng hồ sơ (chỉ máy chủ). Luật ở lib/phaply/banGiao.js (dieuKienDong).
import { docHoSoDayDu } from './hoSoMayChu.js'
import { coDrive } from './drive.js'
import { dieuKienDong } from './banGiao.js'

export async function docDieuKienDong(admin, hs) {
  const [day, nop, tep] = await Promise.all([
    docHoSoDayDu(admin, hs.id),
    admin.from('legal_case_submissions').select('id').eq('case_id', hs.id).eq('ket_qua', 'dat').limit(1),
    admin.from('legal_case_files').select('id').eq('case_id', hs.id).eq('thu_muc', 'ban_giao').limit(1),
  ])
  return dieuKienDong({
    conPhaiThu: day?.tien?.con_phai_thu || 0, coKetQua: !!nop.data?.length, banGiaoNgay: hs.ban_giao_ngay,
    coDrive: coDrive(hs.procedure_code), coScanBanGiao: !!tep.data?.length,
  })
}
