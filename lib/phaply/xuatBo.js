// Phân hệ Pháp lý — dựng một bộ hồ sơ Word (đợt 'so' | 'thue') từ dữ liệu pháp nhân trong DB. Dùng chung cho nút tải về
// (route ho-so/[id]/word) và nút lưu Drive (route ho-so/[id]/drive) — hai nơi ra file GIỐNG HỆT nhau.
// Đọc mẫu dựng sẵn templates/phaply/word/*.docx → route nào gọi hàm này phải có trong outputFileTracingIncludes (next.config.mjs).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dauVaoCuaHoSo } from './phapNhanMayChu.js'
import { chuanBiDuLieu } from './word/duLieu.js'
import { dienMau } from './word/xuat.js'
import { mauCuaBo } from './word/danhMuc.js'
import { nguonHuongDanInKy } from './word/huongDanInKy.js'
import { dongGoi } from './word/khung.js'

export const LOAI_CO_MAU = ['1tv', '2tv', 'cp']
export const TEN_BO = { so: 'Hồ sơ thành lập', thue: 'Hồ sơ pháp lý ban đầu' }
export const tenFile = s => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()

// → { files: [{ ten, buf }], huongDan: { ten, buf }, dauVao, d (dữ liệu pháp nhân) }
export async function dungBoWord(admin, hs, dot, { ma } = {}) {
  const bo = mauCuaBo(dot, hs.entity_type).filter(m => !ma || m.ma === ma)
  const { dauVao, ...d } = await dauVaoCuaHoSo(admin, hs)
  const duLieu = chuanBiDuLieu(dauVao)
  const thuMuc = join(process.cwd(), 'templates', 'phaply', 'word')
  const files = bo.map(m => ({
    ma: m.ma,
    ten: tenFile(`${String(m.thuTu).padStart(2, '0')}. ${m.ten}.docx`),
    buf: dienMau(readFileSync(join(thuMuc, m.ma + '.docx')), duLieu),
  }))
  const huongDan = { ten: '00. Huong dan in ky.docx', buf: dongGoi(nguonHuongDanInKy(dot, hs.entity_type, { tenCty: dauVao.cty.ten })) }
  return { files, huongDan, dauVao, d }
}
