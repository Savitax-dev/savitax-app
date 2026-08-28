// Trạng thái xử lý của một dịch vụ trong hồ sơ HCNS Thời điểm / Vãng lai.
// Thứ tự trong mảng CHÍNH LÀ thứ tự quy trình của phòng — dùng luôn để dựng dropdown và biểu đồ
// theo bước, đừng sắp xếp lại ở nơi khác.
export const HCNS_STATUSES = ['thu_thap', 'trinh_ky', 'nop_ho_so', 'tra_ket_qua', 'hoan_thanh']

export const HCNS_STATUS_LABEL = {
  thu_thap:    'Thu thập thông tin',
  trinh_ky:    'Trình ký',
  nop_ho_so:   'Nộp hồ sơ',
  tra_ket_qua: 'Trả kết quả',
  hoan_thanh:  'Hoàn thành',
}
