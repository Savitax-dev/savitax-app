// Phân hệ Pháp lý — dựng một bộ hồ sơ Word (đợt 'so' | 'thue') từ dữ liệu pháp nhân trong DB. Dùng chung cho nút tải về
// (route ho-so/[id]/word) và nút lưu Drive (route ho-so/[id]/drive) — hai nơi ra file GIỐNG HỆT nhau.
// Đọc mẫu dựng sẵn templates/phaply/word/*.docx → route nào gọi hàm này phải có trong outputFileTracingIncludes (next.config.mjs).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dauVaoCuaHoSo } from './phapNhanMayChu.js'
import { chuanBiDuLieu } from './word/duLieu.js'
import { dienMau } from './word/xuat.js'
import { mauCuaBo } from './word/danhMuc.js'
import { bienThe, loaiHinhMau, coBo, tenBo } from './boHoSo.js'
import { nguonHuongDanInKy } from './word/huongDanInKy.js'
import { dongGoi } from './word/khung.js'
import { BEN_GIAO } from './banGiao.js'

export const LOAI_CO_MAU = ['1tv', '2tv', 'cp', 'hkd', 'chi_nhanh', 'vpdd', 'ddkd']
export const TEN_BO = { so: 'Hồ sơ thành lập', thue: 'Hồ sơ pháp lý ban đầu', ban_giao: 'Biên bản bàn giao' }   // chỉ bộ TLM gốc — thủ tục khác: tenBo()
export const tenFile = s => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()

// → { files: [{ ten, buf }], huongDan: { ten, buf }, dauVao, d (dữ liệu pháp nhân) }
export async function dungBoWord(admin, hs, dot, { ma } = {}) {
  const bt = bienThe(hs.procedure_code, hs.entity_type)
  const { dauVao, ...d } = await dauVaoCuaHoSo(admin, hs)
  // đơn vị phụ thuộc: hồ sơ gắn công ty mẹ → chọn mẫu theo loại hình công ty mẹ, lọc thêm theo loại đơn vị
  const lh = loaiHinhMau(hs.entity_type, d.entity?.entity_type)
  if (lh && lh !== dauVao.loai_hinh) dauVao.loai_hinh = lh
  dauVao.thu_tuc = hs.procedure_code; dauVao.bien_the = bt; dauVao.don_vi_loai = hs.entity_type
  dauVao.thong_tin = hs.thong_tin || {}
  dauVao.tam_ngung_tu = hs.tam_ngung_tu; dauVao.tam_ngung_den = hs.tam_ngung_den; dauVao.hoat_dong_lai_tu = hs.hoat_dong_lai_tu
  dauVao.noi_dung_thay_doi = hs.noi_dung_thay_doi || []
  const bo = lh && coBo(bt, dot) ? mauCuaBo(dot, lh, bt, hs.entity_type) : []
  // bàn giao lưu trên hồ sơ (sql/59), bên giao = pháp nhân Savitax
  dauVao.ban_giao = { ngay: hs.ban_giao_ngay, nguoi_nhan: hs.ban_giao_nguoi_nhan, ghi_chu: hs.ban_giao_ghi_chu, muc: hs.ban_giao_muc || [] }
  dauVao.ben_giao = BEN_GIAO
  const duLieu = chuanBiDuLieu(dauVao)
  const thuMuc = join(process.cwd(), 'templates', 'phaply', 'word')
  // dieuKien: tờ chỉ có khi đúng trường hợp (VD văn bản cử người đại diện khi chủ sở hữu là tổ chức); thayBang: đổi sang mẫu thay thế
  // số thứ tự đánh theo CẢ BỘ (tải lẻ một tờ vẫn mang đúng số của nó trong bộ)
  const files = bo.filter(m => !m.dieuKien || m.dieuKien(duLieu)).map((m, i) => ({ m, so: i + 1 })).filter(({ m }) => !ma || m.ma === ma)
    .map(({ m, so }) => ({
      ma: m.ma,
      ten: tenFile(`${String(so).padStart(2, '0')}. ${m.ten}.docx`),
      buf: dienMau(readFileSync(join(thuMuc, (m.thayBang?.(duLieu) || m.ma) + '.docx')), duLieu),
    }))
  const huongDan = dot !== 'ban_giao' && lh ? { ma: 'HUONG_DAN', ten: '00. Hướng dẫn in ký.docx', buf: dongGoi(nguonHuongDanInKy(dot, lh, { tenCty: dauVao.cty.ten, duLieu, bt, donVi: hs.entity_type })) } : null
  return { files, huongDan, dauVao, d, duLieu, bt, lh, tenBo: tenBo(bt, dot) }
}
