// Tự tìm các số bản offline bắt nhân viên NHẬP TAY ở mục "Thông tin bổ sung" của từng năm.
// Không lưu gì: kết quả là `inputs` gắn vào hồ sơ trong bộ nhớ + bảng giải thích nguồn để hiện cạnh kết quả.
//
// Trạng thái từng ô:
//   'tu_tim'   — tìm được từ hồ sơ, đủ tin để dùng
//   'tam'      — có số tạm (vd đề nghị hoàn thay cho quyết định hoàn), cần nhân viên xác nhận
//   'tu_dong'  — bộ máy tự suy từ BCTC / tờ khai, không cần ô nhập
//   'can_nhap' — hồ sơ không có, nhân viên phải tự xác nhận (để trống thì tiêu chí liên quan báo "Thiếu dữ liệu"
//                hoặc coi như "không")
import Risk from './risk.js'
import { tinhLoConDuocChuyen } from './chuyenLo.js'
import { tienMatTren5tr } from './hoaDonXml.js'

const tien = v => Number(v || 0).toLocaleString('vi-VN')

function quyetToanCuoi(client, nam) {
  const ds = (client.tndnList || []).filter(t => +t.nam === +nam)
  return ds.sort((a, b) => (+b.soLan || 0) - (+a.soLan || 0))[0] || null
}

// client: hồ sơ (napHoSo/dungHoSo) · nam: năm soát · hoaDon: [docHoaDonXml] (cả mua vào lẫn bán ra — lọc theo MST
// người mua = công ty) hoặc null nếu chưa đọc
// Trả { inputs, bang: [{ khoa, ten, tieuChi, trangThai, giaTri, hienThi, nguon, ghiChu: [] }] }
export function tuTimSoLieu(client, nam, { hoaDon = null } = {}) {
  const f = Risk.buildFacts(JSON.parse(JSON.stringify(client)), nam)
  const qt = quyetToanCuoi(client, nam), qtTruoc = quyetToanCuoi(client, nam - 1)
  const inputs = {}, bang = []
  const them = (dong, giaTri) => { bang.push({ ghiChu: [], ...dong }); if (giaTri !== undefined && giaTri !== null) inputs[dong.khoa] = giaTri }

  // R20 — số lỗ còn được chuyển
  {
    const c3 = qt ? Number(qt.main?.ctC3 ?? 0) : null
    const d = { khoa: 'loConDuocChuyen', ten: 'Số lỗ còn được chuyển', tieuChi: 'R20' }
    if (!qt) them({ ...d, trangThai: 'can_nhap', nguon: null, hienThi: '—', ghiChu: [`Chưa có quyết toán TNDN năm ${nam}`] })
    else if (!(c3 > 0)) them({ ...d, trangThai: 'tu_dong', nguon: `Quyết toán ${nam} không chuyển lỗ (C3 = 0)`, hienThi: 'Không cần' })
    else {
      const r = tinhLoConDuocChuyen({ nam, pl: qt.pl032, plTruoc: qtTruoc?.pl032, c3 })
      if (r.giaTri == null) them({ ...d, trangThai: 'can_nhap', hienThi: '—', nguon: null, ghiChu: [`Quyết toán ${nam} chuyển lỗ ${tien(c3)} nhưng không có PL 03-2/TNDN của năm ${nam} lẫn năm ${nam - 1}`, ...r.ghiChu] })
      else them({ ...d, trangThai: 'tu_tim', giaTri: r.giaTri, hienThi: tien(r.giaTri), nguon: r.nguon, ghiChu: r.ghiChu }, r.giaTri)
    }
  }

  // R09 — thuế GTGT được hoàn trong năm
  {
    const d = { khoa: 'hoanThue', ten: 'Thuế GTGT được hoàn trong năm', tieuChi: 'R09' }
    if (!f.has.gtgt) them({ ...d, trangThai: 'can_nhap', hienThi: '—', nguon: null, ghiChu: [`Chưa có tờ khai 01/GTGT năm ${nam}`] })
    else {
      const de = Number(f.gtgtSum?.ct42 || 0)
      if (!de) them({ ...d, trangThai: 'tu_tim', giaTri: 0, hienThi: '0', nguon: `Tờ khai 01/GTGT năm ${nam} không có đề nghị hoàn [42]` }, 0)
      else them({ ...d, trangThai: 'tam', giaTri: de, hienThi: tien(de), nguon: `Σ đề nghị hoàn [42] trên tờ khai 01/GTGT năm ${nam}`, ghiChu: ['Số được hoàn thật theo quyết định hoàn có thể khác số đề nghị — đối chiếu quyết định hoàn / sổ 1388'] }, de)
    }
  }

  // R17 — chi từ 5 triệu thanh toán tiền mặt
  {
    const d = { khoa: 'chiTienMat5tr', ten: 'Hóa đơn mua vào ≥ 5 triệu trả tiền mặt', tieuChi: 'R17' }
    if (!hoaDon || !hoaDon.length) them({ ...d, trangThai: 'can_nhap', hienThi: '—', nguon: null, ghiChu: [`Chưa đọc được hóa đơn XML mua vào năm ${nam} trong thư mục`] })
    else {
      const r = tienMatTren5tr(hoaDon, { nam, mstCty: client.mst })
      const ghiChu = []
      if (r.khongRo.so) ghiChu.push(`${r.khongRo.so} hóa đơn ≥ 5 triệu (${tien(r.khongRo.tien)}) ghi thanh toán lẫn "TM/CK" — đối chiếu sổ quỹ, sổ phụ ngân hàng`)
      them({ ...d, trangThai: 'tu_tim', giaTri: r.tienMat.tien, hienThi: tien(r.tienMat.tien) + (r.tienMat.so ? ` (${r.tienMat.so} hóa đơn)` : ''), nguon: `Hình thức thanh toán trên ${r.soHoaDon} hóa đơn XML mua vào năm ${nam}`, ghiChu }, r.tienMat.tien)
    }
  }

  // R17, R19, EI13 — giao dịch liên kết
  {
    const d = { khoa: 'coGdlk', ten: 'Có giao dịch liên kết', tieuChi: 'R17 · R19' }
    if (qt?.coGdlk) them({ ...d, trangThai: 'tu_tim', giaTri: 'co', hienThi: 'Có', nguon: `Quyết toán TNDN ${nam} có phụ lục giao dịch liên kết (Mẫu 01 NĐ 132)` }, 'co')
    else them({ ...d, trangThai: 'can_nhap', hienThi: 'Không / chưa xác định', nguon: qt ? `Quyết toán TNDN ${nam} không có phụ lục giao dịch liên kết` : null, ghiChu: ['Để trống = coi như không có giao dịch liên kết'] })
  }

  // R39 — thuộc diện bắt buộc kiểm toán
  them({ khoa: 'batBuocKiemToan', ten: 'Thuộc diện bắt buộc kiểm toán', tieuChi: 'R39', trangThai: 'can_nhap', hienThi: 'Không', nguon: null, ghiChu: ['Hồ sơ không cho biết (DN FDI, tổ chức tín dụng, DN nhà nước…) — để trống = không bắt buộc'] })

  // Bộ máy tự suy, chỉ hiện để biết số đang dùng
  them({ khoa: 'auditOpinion', ten: 'Ý kiến kiểm toán', tieuChi: 'R39', trangThai: 'tu_dong', hienThi: f.bctc?.auditOpinion || (f.has.bctc ? 'Không kiểm toán' : '—'), nguon: f.has.bctc ? `BCTC năm ${nam}` : `Chưa có BCTC năm ${nam}` })
  them({ khoa: 'thueSuatTndn', ten: 'Thuế suất TNDN', tieuChi: 'R19 · R20', trangThai: 'tu_dong', hienThi: qt?.main?.ctC7_thueSuat != null ? qt.main.ctC7_thueSuat + '%' : '20% (mặc định)', nguon: qt ? `Quyết toán TNDN ${nam} (C7)` : 'Mặc định khi chưa có quyết toán' })
  them({ khoa: 'tienChamNop', ten: 'Tiền chậm nộp trong năm', tieuChi: 'R17', trangThai: 'tu_dong', hienThi: tien(f.chamNopNam || 0), nguon: 'Bộ máy tự tính từ ngày nộp các tờ khai' })
  // Nguồn ghi đúng thực tế: chưa đọc được bảng cân đối tài khoản thì nói rõ (trước đây luôn ghi "từ bảng cân đối tài khoản")
  const coCdtk = !!f.has['bctc.cdtk']
  them({ khoa: 'coNgoaiTe', ten: 'Có hoạt động ngoại tệ', tieuChi: 'R22', trangThai: 'tu_dong', hienThi: coCdtk ? 'Tự nhận biết' : 'Chưa xác định', nguon: coCdtk ? 'Từ TK 1112, 1122, 413 trên bảng cân đối tài khoản' : `Chưa có bảng cân đối tài khoản năm ${nam} — chưa nhận biết được` })

  return { inputs, bang }
}

// Gắn inputs tự tìm vào hồ sơ (bản sao) — ô nhân viên sửa tạm trên màn hình (suaTay) đè lên số tự tìm.
export function ganSoLieu(client, nam, inputs, suaTay = {}) {
  const c = JSON.parse(JSON.stringify(client))
  c.years = c.years || {}
  const y = c.years[nam] = c.years[nam] || {}
  y.inputs = { ...(y.inputs || {}), ...inputs, ...suaTay }
  return c
}
