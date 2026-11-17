// Phân hệ Pháp lý — checklist + lịch thu MẶC ĐỊNH, nạp một lần khi phòng chưa có mẫu (nút "Nạp mẫu mặc định" ở /phaply/mau).
// Em soạn theo 10 bước của kế hoạch + hướng dẫn in ký của phòng; số ngày hạn là số TẠM — trưởng phòng sửa lại cho đúng.

const TLM = {
  sla_days: 10,
  items: [
    [1, 'Tiếp nhận yêu cầu, xác định loại hình + thủ tục'],
    [1, 'Tra trùng tên doanh nghiệp dự kiến trên Cổng thông tin quốc gia về ĐKDN'],
    [2, 'Nhận CCCD 2 mặt của chủ sở hữu / thành viên / cổ đông / người đại diện'],
    [2, 'Chốt ngành nghề (ngành chính), vốn điều lệ, địa chỉ trụ sở, chức danh người đại diện'],
    [3, 'Gửi báo giá / ĐNTT đợt 1 cho khách'],
    [3, 'Xác nhận khách đã chuyển khoản đợt 1'],
    [4, 'Soạn bộ hồ sơ đăng ký doanh nghiệp'],
    [4, 'Soát lại toàn bộ thông tin trước khi in'],
    [5, 'In bộ hồ sơ + tờ hướng dẫn in ký, gửi khách'],
    [5, 'Nhận lại hồ sơ khách đã ký đủ, scan lưu'],
    [6, 'Nộp hồ sơ trên Cổng thông tin quốc gia về ĐKDN'],
    [6, 'Theo dõi, xử lý thông báo sửa đổi bổ sung (nếu có)'],
    [7, 'Nhận Giấy chứng nhận ĐKDN, cập nhật mã số doanh nghiệp'],
    [7, 'Khắc dấu (nếu khách đăng ký dịch vụ)'],
    [8, 'Soạn + trình ký hồ sơ pháp lý ban đầu (ủy quyền thuế, 08-MST, khấu hao, sổ sách)'],
    [8, 'Nộp hồ sơ thuế ban đầu, chữ ký số / hóa đơn điện tử (nếu có)'],
    [9, 'Lập biên bản bàn giao'],
    [9, 'Bàn giao GCN ĐKDN, con dấu, hồ sơ cho khách'],
    [10, 'Kiểm tra đã thu đủ tiền'],
    [10, 'Lưu bộ hồ sơ scan lên Drive'],
  ],
}

const CHUNG = {
  sla_days: 7,
  items: [
    [1, 'Tiếp nhận yêu cầu, xác định thủ tục'],
    [2, 'Nhận đủ giấy tờ của khách (CCCD, GCN ĐKDN, con dấu…)'],
    [3, 'Gửi báo giá / ĐNTT, xác nhận khách đã chuyển khoản'],
    [4, 'Soạn bộ hồ sơ'],
    [5, 'Khách ký đủ, scan lưu'],
    [6, 'Nộp hồ sơ, theo dõi thông báo sửa đổi bổ sung'],
    [7, 'Nhận kết quả'],
    [9, 'Bàn giao kết quả cho khách'],
    [10, 'Kiểm tra đã thu đủ tiền, lưu hồ sơ scan lên Drive'],
  ],
}

export const CHECKLIST_MAC_DINH = {
  tlm: TLM, thay_doi: CHUNG, tam_ngung: CHUNG, hoat_dong_lai: CHUNG, cap_lai_gpkd: CHUNG,
  khoi_phuc_mst: CHUNG, giai_the: { ...CHUNG, sla_days: 15 }, rut_ho_so: { ...CHUNG, sla_days: 3 }, khac: CHUNG,
}

// Thu hộ (lệ phí Sở, dấu…) Savitax phải chi ra lúc nộp → mặc định thu đủ ngay đợt đầu
export const LICH_THU_MAC_DINH = [
  { name: 'Thu 100% khi nhận hồ sơ', items: [{ ten: 'Thu đủ', pt_dich_vu: 100, pt_thu_ho: 100, due_stage: 1 }] },
  { name: '50% khi nhận — 50% khi có kết quả', items: [
    { ten: 'Đợt 1 — khi nhận hồ sơ', pt_dich_vu: 50, pt_thu_ho: 100, due_stage: 1 },
    { ten: 'Đợt 2 — khi có kết quả', pt_dich_vu: 50, pt_thu_ho: 0, due_stage: 7 },
  ] },
  { name: 'Thu hộ khi nhận — phí dịch vụ khi có kết quả', items: [
    { ten: 'Đợt 1 — thu hộ', pt_dich_vu: 0, pt_thu_ho: 100, due_stage: 1 },
    { ten: 'Đợt 2 — phí dịch vụ', pt_dich_vu: 100, pt_thu_ho: 0, due_stage: 7 },
  ] },
]

// Nạp vào DB: chỉ thủ tục CHƯA có mẫu, chỉ khi CHƯA có lịch thu nào — không đè mẫu phòng đã sửa
export async function napMauMacDinh(admin) {
  const { data: daCo } = await admin.from('legal_task_templates').select('procedure_code')
  const coRoi = new Set((daCo || []).map(t => t.procedure_code))
  let soThuTuc = 0
  for (const [k, m] of Object.entries(CHECKLIST_MAC_DINH)) {
    if (coRoi.has(k)) continue
    const { data: tpl, error } = await admin.from('legal_task_templates').insert({ procedure_code: k, sla_days: m.sla_days, note: 'Mẫu mặc định — trưởng phòng sửa lại' }).select('id').single()
    if (error) throw new Error(error.message)
    const dem = {}
    await admin.from('legal_task_template_items').insert(m.items.map(([stage, title]) => ({ template_id: tpl.id, stage, title, sort: (dem[stage] = (dem[stage] || 0) + 1) })))
    soThuTuc++
  }
  const { count } = await admin.from('legal_payment_plans').select('id', { count: 'exact', head: false }).eq('is_active', true)
  let soLich = 0
  if (!count) {
    await admin.from('legal_payment_plans').insert(LICH_THU_MAC_DINH.map((p, i) => ({ ...p, sort: i })))
    soLich = LICH_THU_MAC_DINH.length
  }
  return { soThuTuc, soLich }
}
