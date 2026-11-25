// Phân hệ Pháp lý — tờ "Hướng dẫn in + ký" của một bộ hồ sơ, sinh từ danh mục mẫu (thay file Word phòng soạn tay).
// Trả văn bản nguồn theo cú pháp khung.js → dongGoi() ra .docx. Có duLieu (chuanBiDuLieu) thì ghi luôn họ tên người ký.
// Màn hình "Còn thiếu & xuất Word" dùng dongHuongDan() để hiện cùng nội dung (18/11/2026 — phòng pháp lý cần thấy hướng dẫn in ký).
import { mauCuaBo, luuYInKy, LOAI_HINH } from './danhMuc.js'
import { tenBo } from '../boHoSo.js'

const TIEU_DE = { so: 'Hồ sơ Thành lập mới', thue: 'Hồ sơ pháp lý ban đầu' }

export function tenNguoiKy(kyBoi = [], d = {}) {
  const ds = []
  for (const k of kyBoi) {
    if (k === 'dd' && d.dd_ho_ten) ds.push(d.dd_ho_ten)
    else if (k === 'csh' && d.csh_ho_ten) ds.push(d.csh_la_to_chuc ? d.csh_dai_dien_ten || d.csh_ho_ten : d.csh_ho_ten)   // tổ chức → người đại diện của tổ chức ký
    else if (k === 'uqtc') ds.push(...(d.dai_dien_uq || []).map(v => v.ho_ten).filter(Boolean))
    else if (k === 'tctv' && d.tc_ho_ten) ds.push(d.tc_dai_dien_ten || d.tc_ho_ten)
    else if (k === 'uqtv') ds.push(...(d.tc_uq || []).map(v => v.ho_ten).filter(Boolean))
    else if (k === 'ct' && d.ct_ho_ten) ds.push(d.ct_ho_ten)
    else if (k === 'uq' && d.uq_ho_ten) ds.push(d.uq_ho_ten)
    else if (k === 'nhan' && d.bg_nguoi_nhan_hoa) ds.push(d.bg_nguoi_nhan_hoa)
    else if (k === 'tv') ds.push(...(d.thanh_vien || []).map(v => v.ho_ten).filter(Boolean))
    else if (k === 'cd') ds.push(...(d.co_dong || []).map(v => v.ho_ten).filter(Boolean))
  }
  return [...new Set(ds)]
}

// [{ stt, ten, nguoiKy, hoTen: [..] }] + luuY
export function dongHuongDan(dot, loaiHinh, duLieu, bt = 'tlm', donVi = null) {
  const ds = mauCuaBo(dot, loaiHinh, bt, donVi).map((m, i) => ({ stt: i + 1, ma: m.ma, ten: m.ten, nguoiKy: m.nguoiKy[loaiHinh], hoTen: duLieu ? tenNguoiKy(m.kyBoi, duLieu) : [] }))
  return { ds, luuY: luuYInKy(bt, dot, loaiHinh) }
}

export function nguonHuongDanInKy(dot, loaiHinh, { tenCty = '', duLieu = null, bt = 'tlm', donVi = null } = {}) {
  const { ds, luuY } = dongHuongDan(dot, loaiHinh, duLieu, bt, donVi)
  const coTen = ds.some(x => x.hoTen.length)
  const dong = [
    '@co 12',
    `# HƯỚNG DẪN IN + KÝ ${(bt === 'tlm' ? TIEU_DE[dot] : tenBo(bt, dot)).toUpperCase()}`,
    `#c Loại hình: ${LOAI_HINH[loaiHinh] || loaiHinh}${tenCty ? ' — ' + tenCty : ''}`,
    '~',
    coTen ? '::bang vien 7^ 38< 30< 25<' : '::bang vien 8^ 52< 40<',
    coTen ? 'STT | Tên file | Người ký | Họ tên' : 'STT | Tên file | Người ký',
    '---',
    ...ds.map(x => coTen ? `${x.stt} | ${x.ten} | ${x.nguoiKy} | ${x.hoTen.join(' // ') || '…………'}` : `${x.stt} | ${x.ten} | ${x.nguoiKy}`),
    '::',
    '~',
    '#lb Lưu ý:',
    ...luuY.map(l => `#l - ${l}`),
  ]
  return dong.join('\n')
}
