// Tên các chỉ tiêu trên tờ khai — dùng để in trang bìa PDF, Phân hệ Tờ khai GĐ 6.
//
// XML chỉ chứa MÃ chỉ tiêu (ct21, ct22…), không chứa tên. Muốn in ra tờ giấy người đọc hiểu được
// thì phải có bảng tên này.
//
// NGUYÊN TẮC: mã nào chưa chắc tên thì ĐỂ TRỐNG, in ra dạng '[29]' cho kế toán tự nhận ra. Đặt tên
// sai cho một chỉ tiêu thuế còn tệ hơn là không đặt tên — kế toán gửi khách bản in sai tên chỉ tiêu
// là mất uy tín, mà lỗi kiểu đó không có cách nào tự phát hiện.
//
// Bảng này kế toán MỞ RỘNG ĐƯỢC: thêm một dòng '<mã>': '<tên>' là xong, không phải sửa chỗ nào khác.

// ── 01/GTGT — Tờ khai thuế giá trị gia tăng (TT80/2021), mã tờ khai 842 ──────
// Đã đối chiếu với số thật: [34]=[26]+[27], [35]=[28], [36]=[35]-[25], [41]=[22]-[36] đều khớp.
const GTGT_01 = {
  '21': 'Không phát sinh hoạt động mua, bán trong kỳ',
  '22': 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang',
  '23': 'Giá trị của hàng hóa, dịch vụ mua vào',
  '24': 'Thuế GTGT của hàng hóa, dịch vụ mua vào',
  '23a': 'Giá trị hàng hóa, dịch vụ nhập khẩu',
  '24a': 'Thuế GTGT của hàng hóa, dịch vụ nhập khẩu',
  '25': 'Tổng số thuế GTGT được khấu trừ kỳ này',
  '26': 'Hàng hóa, dịch vụ bán ra không chịu thuế GTGT',
  '27': 'Hàng hóa, dịch vụ bán ra chịu thuế GTGT',
  '28': 'Thuế GTGT của hàng hóa, dịch vụ bán ra',
  '29': 'Hàng hóa, dịch vụ bán ra chịu thuế suất 0%',
  '30': 'Hàng hóa, dịch vụ bán ra chịu thuế suất 5%',
  '31': 'Thuế GTGT của hàng hóa, dịch vụ chịu thuế suất 5%',
  '32': 'Hàng hóa, dịch vụ bán ra chịu thuế suất 10%',
  '33': 'Thuế GTGT của hàng hóa, dịch vụ chịu thuế suất 10%',
  '32a': 'Hàng hóa, dịch vụ bán ra không tính thuế',
  '34': 'Tổng doanh thu hàng hóa, dịch vụ bán ra',
  '35': 'Tổng số thuế GTGT của hàng hóa, dịch vụ bán ra',
  '36': 'Thuế GTGT phát sinh trong kỳ',
  '37': 'Điều chỉnh giảm thuế GTGT còn được khấu trừ của các kỳ trước',
  '38': 'Điều chỉnh tăng thuế GTGT còn được khấu trừ của các kỳ trước',
  '39a': 'Tổng số thuế GTGT đã nộp của doanh thu kinh doanh xây dựng, lắp đặt, bán hàng, bất động sản ngoại tỉnh',
  '40a': 'Thuế GTGT phải nộp của hoạt động sản xuất kinh doanh trong kỳ',
  '40b': 'Thuế GTGT mua vào của dự án đầu tư được bù trừ với thuế GTGT phải nộp cùng kỳ',
  '40': 'Thuế GTGT còn phải nộp trong kỳ',
  '41': 'Thuế GTGT chưa khấu trừ hết kỳ này',
  '42': 'Thuế GTGT đề nghị hoàn',
  '43': 'Thuế GTGT còn được khấu trừ chuyển kỳ sau',
}

// ── 05/KK-TNCN — Khấu trừ thuế thu nhập cá nhân (TT80/2021), mã 864 ──────────
// [15]–[28] là phần I (tiền lương, tiền công). Các mã sau đó CHƯA GÁN TÊN — chờ kế toán soát.
const TNCN_05 = {
  '15': 'Tổng số người lao động',
  '16': 'Trong đó: Cá nhân cư trú có hợp đồng lao động',
  '17': 'Tổng số cá nhân đã khấu trừ thuế',
  '18': 'Trong đó: Cá nhân cư trú',
  '19': 'Trong đó: Cá nhân không cư trú',
  '20': 'Tổng thu nhập chịu thuế trả cho cá nhân',
  '21': 'Trong đó: Cá nhân cư trú',
  '22': 'Trong đó: Cá nhân không cư trú',
  '23': 'Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế',
  '24': 'Trong đó: Cá nhân cư trú',
  '25': 'Trong đó: Cá nhân không cư trú',
  '26': 'Tổng số thuế thu nhập cá nhân đã khấu trừ',
  '27': 'Trong đó: Cá nhân cư trú',
  '28': 'Trong đó: Cá nhân không cư trú',
}

// Khoá theo MÃ TỜ KHAI của cổng (maTKhai trong XML), vì đó là thứ luôn có sẵn và không đổi.
export const BANG_CHI_TIEU = {
  '842': { ten: '01/GTGT', chiTieu: GTGT_01 },
  '864': { ten: '05/KK-TNCN', chiTieu: TNCN_05 },
}

// Tên chỉ tiêu, hoặc '' nếu chưa có trong bảng. Bên gọi tự quyết định in gì khi rỗng.
export function tenChiTieu(maTKhai, ma) {
  return BANG_CHI_TIEU[String(maTKhai)]?.chiTieu?.[String(ma)] || ''
}

export function coBangChiTieu(maTKhai) {
  return Boolean(BANG_CHI_TIEU[String(maTKhai)])
}

// Chỉ tiêu là số tiền hay là số lượng người? Số người thì không in dấu phân cách nghìn kiểu tiền,
// và cũng không bị lọc đi khi bằng 0 vì '0 người lao động' là thông tin có nghĩa.
const LA_SO_NGUOI = { '864': ['15', '16', '17', '18', '19'] }

export function laSoNguoi(maTKhai, ma) {
  return (LA_SO_NGUOI[String(maTKhai)] || []).includes(String(ma))
}
