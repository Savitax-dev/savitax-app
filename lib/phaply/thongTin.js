// Phân hệ Pháp lý — Ô THÔNG TIN RIÊNG theo thủ tục (bộ biểu mẫu mới 25/11/2026), lưu ở legal_cases.thong_tin (jsonb, sql/61).
// Một chỗ khai báo: giao diện tự dựng form (tab "Thông tin thủ tục"), máy chủ lọc khi lưu (locThongTin), mẫu Word nhận thẻ {tt_<khoá>}
// qua the() — KHÔNG phải thêm cột DB / sửa duLieu.js cho từng ô mới.
//
// Kiểu ô: chu (một dòng) · dai (nhiều dòng) · ngay (dd/mm/yyyy) · so (số tiền / số lượng) · chon (một trong các lựa chọn) ·
//         co (có / không) · dia_chi ({ so_nha, ma_xa, xa, ma_tinh, tinh }) · nganh (danh sách ngành { ma, ten, chi_tiet, chinh })
// Thẻ mẫu Word sinh ra cho ô khoá k:
//   chu/dai/ngay → {tt_k} · so → {tt_k} (1.000.000) + {tt_k_chu} (bằng chữ) · co → {#tt_k}…{/tt_k}
//   chon → {tt_k} (nhãn) + cờ {#tt_k_<giá trị>}…{/…} · dia_chi → {tt_k} (ghép) + {tt_k_so_nha} {tt_k_xa} {tt_k_tinh}
//   nganh → danh sách {#tt_k}{stt} {ten} {ma} {chinh}{/tt_k}
// Ô nào để trống → thẻ trống → mẫu in chỗ chấm (dienMau) để viết tay.
import { numberToVietnameseWords } from '../numberToWords.js'
import { THONG_TIN_THU_TUC } from './word/mauThuTuc/index.js'

const DON_VI = [['chi_nhanh', 'Chi nhánh'], ['vpdd', 'Văn phòng đại diện'], ['ddkd', 'Địa điểm kinh doanh']]

// khoá → khuôn ô; nhóm theo biến thể thủ tục (lib/phaply/boHoSo.js bienThe)
export const THONG_TIN = {
  tlm_hkd: [
    { k: 'chu_the', nhan: 'Chủ thể thành lập hộ kinh doanh', kieu: 'chon', chon: [['ca_nhan', 'Cá nhân'], ['ho_gia_dinh', 'Các thành viên hộ gia đình']], md: 'ca_nhan' },
    { k: 'pp_thue', nhan: 'Phương pháp tính thuế GTGT', kieu: 'chon', chon: [['ke_khai', 'Phương pháp kê khai'], ['khoan', 'Phương pháp khoán']], md: 'khoan' },
    { k: 'khong_tai_tru_so', nhan: 'Không kinh doanh tại trụ sở (không có địa điểm kinh doanh cố định)', kieu: 'co' },
    { k: 'ngay_bat_dau', nhan: 'Ngày bắt đầu hoạt động (để trống = từ ngày được cấp GCN)', kieu: 'ngay' },
    { k: 'co_quan_dk', nhan: 'Cơ quan đăng ký kinh doanh cấp xã (Kính gửi)', kieu: 'chu', goiY: 'Ủy ban nhân dân phường …' },
  ],
  tlm_dvpt: [
    { k: 'ten', nhan: 'Tên đơn vị (chữ in hoa)', kieu: 'chu', bat_buoc: true },
    { k: 'ten_nn', nhan: 'Tên tiếng nước ngoài (nếu có)', kieu: 'chu' },
    { k: 'ten_viet_tat', nhan: 'Tên viết tắt (nếu có)', kieu: 'chu' },
    { k: 'dia_chi', nhan: 'Địa chỉ đơn vị', kieu: 'dia_chi', bat_buoc: true },
    { k: 'dien_thoai', nhan: 'Điện thoại', kieu: 'chu' },
    { k: 'email', nhan: 'Thư điện tử (nếu có)', kieu: 'chu' },
    { k: 'nganh', nhan: 'Ngành nghề / nội dung hoạt động của đơn vị', kieu: 'nganh' },
    // Mẫu 17 mục 3 + Quyết định / Biên bản họp: VPĐD không kê bảng ngành mà ghi NỘI DUNG HOẠT ĐỘNG (chữ). Cố ý KHÔNG đặt chi: ['vpdd']:
    // mẫu Word dùng chung 3 loại đơn vị đọc {tt_noi_dung_hd} trong khối {#la_vpdd}, mà theThongTin bỏ hẳn thẻ của ô bị lọc → bộ kiểm báo thiếu
    { k: 'noi_dung_hd', nhan: 'Nội dung hoạt động (chỉ văn phòng đại diện)', kieu: 'dai' },
    { k: 'hach_toan', nhan: 'Hình thức hạch toán', kieu: 'chon', chon: [['doc_lap', 'Hạch toán độc lập'], ['phu_thuoc', 'Hạch toán phụ thuộc']], md: 'phu_thuoc' },
    // Mẫu 17 mục 6.8 — đơn vị chọn riêng (bản chi nhánh phòng nộp chọn khác công ty mẹ); để trống = 4 ô trống, đánh dấu tay
    { k: 'pp_gtgt', nhan: 'Phương pháp tính thuế GTGT', kieu: 'chon', chon: [['khau_tru', 'Khấu trừ'], ['truc_tiep_gtgt', 'Trực tiếp trên GTGT'], ['truc_tiep_doanh_so', 'Trực tiếp trên doanh số'], ['khong_nop', 'Không phải nộp thuế GTGT']] },
    { k: 'ngay_bat_dau', nhan: 'Ngày bắt đầu hoạt động', kieu: 'ngay' },
    { k: 'so_lao_dong', nhan: 'Tổng số lao động (dự kiến)', kieu: 'so' },
    { k: 'truc_thuoc_cn', nhan: 'Địa điểm kinh doanh trực thuộc chi nhánh (ghi tên + mã chi nhánh, nếu có)', kieu: 'chu', chi: ['ddkd'] },
  ],
}

// Ô áp dụng cho một hồ sơ (bỏ ô chỉ dành cho loại đơn vị khác)
// ô của các nhóm thủ tục khác (tạm ngừng, giải thể, thay đổi…) khai ở lib/phaply/word/mauThuTuc/<nhóm>.js
Object.assign(THONG_TIN, THONG_TIN_THU_TUC)

export const oCua = (bt, donVi) => (THONG_TIN[bt] || []).filter(o => !o.chi || o.chi.includes(donVi))

const coChu = v => v != null && String(v).trim() !== ''
const TIEN = n => (n == null || n === '' ? '' : Math.round(Number(n)).toLocaleString('de-DE'))
const noiDc = d => (d ? [d.so_nha, d.xa, d.tinh].filter(coChu).join(', ') : '')

// Máy chủ: chỉ giữ khoá đã khai, đúng kiểu
export function locThongTin(bt, donVi, f = {}) {
  const ra = {}
  for (const o of oCua(bt, donVi)) {
    if (!(o.k in f)) continue
    const v = f[o.k]
    if (o.kieu === 'co') ra[o.k] = !!v
    else if (o.kieu === 'so') { const n = Number(String(v ?? '').replace(/[.\s]/g, '')); ra[o.k] = coChu(v) && Number.isFinite(n) ? n : null }
    else if (o.kieu === 'chon') ra[o.k] = o.chon.some(c => c[0] === v) ? v : null
    else if (o.kieu === 'dia_chi') ra[o.k] = v && typeof v === 'object' ? Object.fromEntries(['so_nha', 'ma_xa', 'xa', 'ma_tinh', 'tinh'].filter(x => coChu(v[x])).map(x => [x, String(v[x]).trim()])) : {}
    else if (o.kieu === 'nganh') ra[o.k] = Array.isArray(v) ? v.filter(n => coChu(n?.ma) || coChu(n?.ten)).slice(0, 300).map(n => ({ ma: String(n.ma || '').trim(), ten: String(n.ten || '').trim(), chi_tiet: String(n.chi_tiet || '').trim(), chinh: !!n.chinh })) : []
    else ra[o.k] = coChu(v) ? String(v).trim().slice(0, 4000) : null
  }
  return ra
}

// Mẫu Word: thông tin thủ tục → thẻ {tt_…} (giá trị mặc định md áp khi chưa nhập)
export function theThongTin(bt, donVi, tt = {}) {
  const ra = {}
  for (const o of oCua(bt, donVi)) {
    const v = tt[o.k] ?? o.md
    const t = 'tt_' + o.k
    if (o.kieu === 'co') ra[t] = !!v
    else if (o.kieu === 'so') { ra[t] = TIEN(v); ra[t + '_chu'] = v ? numberToVietnameseWords(v) : '' }
    else if (o.kieu === 'chon') { ra[t] = o.chon.find(c => c[0] === v)?.[1] || ''; for (const [g] of o.chon) ra[`${t}_${g}`] = v === g }
    else if (o.kieu === 'dia_chi') { ra[t] = noiDc(v); ra[t + '_so_nha'] = v?.so_nha || ''; ra[t + '_xa'] = v?.xa || ''; ra[t + '_tinh'] = v?.tinh || '' }
    else if (o.kieu === 'nganh') ra[t] = (v || []).map((n, i) => ({ stt: i + 1, ten: n.chi_tiet ? `${n.ten}\nChi tiết: ${n.chi_tiet}` : n.ten, ma: n.ma, chinh: n.chinh ? 'X' : '' }))
    else ra[t] = v || ''
  }
  // loại đơn vị phụ thuộc (theo loại hình của hồ sơ)
  if (bt.endsWith('_dvpt')) {
    ra.dv_loai = DON_VI.find(d => d[0] === donVi)?.[1] || ''
    ra.dv_loai_hoa = ra.dv_loai.toLocaleUpperCase('vi-VN')
    for (const [g] of DON_VI) ra['la_' + g] = donVi === g
  }
  return ra
}

// Còn thiếu: ô bắt buộc chưa nhập
export const thieuThongTin = (bt, donVi, tt = {}) => oCua(bt, donVi).filter(o => o.bat_buoc && (o.kieu === 'dia_chi' ? !coChu(tt[o.k]?.so_nha) || !coChu(tt[o.k]?.xa) : !coChu(tt[o.k])))
  .map(o => o.nhan)
