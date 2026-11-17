// Cron hằng ngày (vercel.json, 3h sáng VN) — XOÁ ẢNH CCCD của hồ sơ pháp lý đã đóng quá 24 tháng (anh chốt 31/10/2026).
// Xoá ở CẢ HAI nơi: kho phaply-cccd (Supabase) và thư mục "2. THU THẬP THÔNG TIN/CCCD" trên Drive phòng pháp lý (bỏ thùng rác —
// Shared drive tự xoá hẳn sau 30 ngày). GIỮ số liệu đã nhập (số CCCD, ngày cấp…). Ghi nhật ký từng hồ sơ.
// Gọi tay để thử: GET kèm header Authorization: Bearer $CRON_SECRET  (?xem=1 chỉ liệt kê, không xoá).
import { createClient } from '@supabase/supabase-js'
import { hoSoToiHanXoa } from '@/lib/phaply/hanLuu'
import { docHet } from '@/lib/phaply/quyen'
import { findChild, trashFile } from '@/lib/googleDrive'
import { THU_MUC, THU_MUC_CCCD } from '@/lib/phaply/drive'

export const maxDuration = 60
const FOLDER = 'application/vnd.google-apps.folder'

export async function GET(request) {
  if (request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const chiXem = new URL(request.url).searchParams.get('xem') === '1'
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { error: chuaCai } = await admin.from('legal_people').select('id').limit(1)
  if (chuaCai) return Response.json({ ok: true, bo_qua: 'chưa có phân hệ Pháp lý' })

  const cases = await docHet((a, b) => admin.from('legal_cases').select('id, code, entity_id, stage, closed_at, is_deleted, drive_folder_id').order('id').range(a, b))
  const toiHan = new Set(hoSoToiHanXoa(cases))
  const ketQua = []
  for (const hs of cases.filter(c => toiHan.has(c.id) && c.entity_id)) {
    const { data: vt } = await admin.from('legal_entity_people').select('person_id').eq('entity_id', hs.entity_id)
    const ids = [...new Set((vt || []).map(v => v.person_id))]
    if (!ids.length) continue
    const { data: nguoi } = await admin.from('legal_people').select('id, cccd_front_path, cccd_back_path').in('id', ids)
    const paths = (nguoi || []).flatMap(p => [p.cccd_front_path, p.cccd_back_path]).filter(Boolean)
    // thư mục CCCD trên Drive (nếu hồ sơ đã lưu Drive)
    let driveCccd = null
    if (hs.drive_folder_id && process.env.GOOGLE_SA_EMAIL) {
      try {
        const tt = await findChild(hs.drive_folder_id, THU_MUC.thu_thap, FOLDER)
        driveCccd = tt ? await findChild(tt.id, THU_MUC_CCCD, FOLDER) : null
      } catch { driveCccd = null }
    }
    if (!paths.length && !driveCccd) continue
    ketQua.push({ ho_so: hs.code, so_anh: paths.length, drive: !!driveCccd })
    if (chiXem) continue
    if (paths.length) {
      const { error } = await admin.storage.from('phaply-cccd').remove(paths)
      if (error) { ketQua[ketQua.length - 1].loi = error.message; continue }
      await admin.from('legal_people').update({ cccd_front_path: null, cccd_back_path: null, updated_at: new Date().toISOString() })
        .in('id', (nguoi || []).filter(p => p.cccd_front_path || p.cccd_back_path).map(p => p.id))
    }
    if (driveCccd) { try { await trashFile(driveCccd.id) } catch (e) { ketQua[ketQua.length - 1].loi_drive = e.message } }
    await admin.from('legal_case_stage_log').insert({ case_id: hs.id, kind: 'edit', note: `Tự xoá ảnh CCCD hết hạn lưu 24 tháng (${paths.length} ảnh${driveCccd ? ' + thư mục CCCD trên Drive' : ''})` })
  }
  return Response.json({ ok: true, chi_xem: chiXem, so_ho_so: ketQua.length, ket_qua: ketQua })
}
