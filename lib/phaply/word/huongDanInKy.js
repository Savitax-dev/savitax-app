// Phân hệ Pháp lý — tờ "Hướng dẫn in + ký" của một bộ hồ sơ, sinh từ danh mục mẫu (thay file Word phòng soạn tay).
// Trả văn bản nguồn theo cú pháp khung.js → dongGoi() ra .docx.
import { mauCuaBo, LUU_Y_IN_KY, LOAI_HINH } from './danhMuc.js'

const TIEU_DE = { so: 'Hồ sơ Thành lập mới', thue: 'Hồ sơ pháp lý ban đầu' }

export function nguonHuongDanInKy(dot, loaiHinh, { tenCty = '' } = {}) {
  const ds = mauCuaBo(dot, loaiHinh)
  const dong = [
    '@co 13',
    `# HƯỚNG DẪN IN + KÝ ${TIEU_DE[dot].toUpperCase()}`,
    `#c Loại hình: ${LOAI_HINH[loaiHinh]}${tenCty ? ' — ' + tenCty : ''}`,
    '~',
    '::bang vien 8^ 52< 40<',
    'STT | Tên file | Người ký',
    '---',
    ...ds.map((m, i) => `${i + 1} | ${m.ten} | ${m.nguoiKy[loaiHinh]}`),
    '::',
    '~',
    '#lb Lưu ý:',
    ...(LUU_Y_IN_KY[dot]?.[loaiHinh] || []).map(l => `#l - ${l}`),
  ]
  return dong.join('\n')
}
