// Phân hệ Pháp lý — thư mục Drive của MỘT hồ sơ (chỉ chạy ở máy chủ). Dùng chung cho nút "Lưu lên Drive" và tải tệp scan.
import { ensureFolder } from '../googleDrive.js'
import { thuMucGoc, THU_MUC } from './drive.js'
import { tenFile } from './xuatBo.js'

// → { folderId, con: { tiep_nhan: id, …, ban_giao: id } }. Đã lưu id thì dùng lại (đổi tên công ty không sinh thư mục mới);
// tạo đủ 8 thư mục con TUẦN TỰ (song song sinh thư mục trùng tên).
export async function thuMucHoSo(admin, hs) {
  let folderId = hs.drive_folder_id
  if (!folderId) {
    const { data: ent } = hs.entity_id ? await admin.from('legal_entities').select('name').eq('id', hs.entity_id).maybeSingle() : { data: null }
    folderId = (await ensureFolder(tenFile(`${hs.code} - ${ent?.name || hs.contact_name || hs.title || ''}`), thuMucGoc(hs.procedure_code))).id
    await admin.from('legal_cases').update({ drive_folder_id: folderId }).eq('id', hs.id)
  }
  const con = {}
  for (const [k, ten] of Object.entries(THU_MUC)) con[k] = (await ensureFolder(ten, folderId)).id
  return { folderId, con }
}
