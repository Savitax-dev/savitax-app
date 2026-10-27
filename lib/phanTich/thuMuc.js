// Nhận diện cây thư mục công ty trên Drive — Phân hệ Soát xét báo cáo + Rủi ro thuế, GĐ 1.
//
// CHỈ ĐỌC. File này không có lệnh ghi, đổi tên hay xoá nào; mọi thao tác với thư mục chỉ là liệt kê
// (`entries()`) và đọc thông tin file (`getFile()` → cỡ, ngày sửa). Nội dung file do lib/phanTich/doc đọc sau.
//
// Cây chuẩn Savitax (khảo sát 11 công ty / 8 phòng ngày 26/10/2026, xem docs/phan-he-phan-tich-ke-hoach.md
// mục 9.3):
//   <Công ty>\2. HỒ SƠ KẾ TOÁN\<năm>\
//      1. HỢP ĐỒNG MUA VÀO_BÁN RA      6. LƯƠNG                 11. CÁC THÔNG BÁO_CÔNG VĂN
//      2. HÓA ĐƠN MUA VÀO_BÁN RA        7. BỘ BÁO CÁO
//      3. HỢP ĐỒNG KHÁC                 8. SỔ SÁCH KẾ TOÁN
//      4. TỜ KHAI HẢI QUAN              9. SỔ PHỤ NGÂN HÀNG
//      5. BẢO HIỂM XÃ HỘI               10. GIẤY NỘP TIỀN
//
// Tên thật KHÔNG đồng nhất, nên mọi chỗ so tên đều theo TỪ KHÓA đã chuẩn hoá, không so nguyên tên:
//   - thư mục năm: "2025" (phổ biến nhất), "NĂM 2025", "2. NĂM 2025", "1. Năm 2025"
//   - không phát sinh: "(kps)", "(KPS)", "( KPS )", "(ko phát sinh)"
//   - thư mục kỳ: "BAOCAOTHUE -Q1", "BAOCAOTHUE_Q1.2025_<mã KH>", "BAOCAOTHUE QUY 1_2025_…",
//     "BÁO CÁO THUẾ_QUÝ 1.2025", "1. BAOCAOTHUE_…_QUY1_…", "BCT Q1-…", "BAOCAOTHUE_T09_2026_<mã KH>_BSL1"
//
// Phạm vi năm (anh chốt 26/10/2026): mặc định chỉ quét năm 2026 trở đi; năm cũ do nhân viên trỏ thư mục riêng.

import { chuanHoaTen, boSoThuTu } from '../tokhaiThuMuc.js'

export const NAM_BAT_DAU = 2026

// Chuẩn hoá giữ khoảng trắng giữa các từ (để tách kỳ, năm trong tên thư mục kỳ).
// 'BÁO CÁO THUẾ_QUÝ 1.2025' → 'BAO CAO THUE QUY 1 2025'
export function chuanCoCach(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[_.\-–—,;:/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Không phát sinh ──────────────────────────────────────────────────────────

// "(kps)", "( KPS )", "(ko phát sinh)", "(không phát sinh)" → true. Không cần ngoặc đứng cuối tên.
export function laKhongPhatSinh(ten) {
  return /\((KPS|KOPHATSINH|KHONGPHATSINH|KPHATSINH)\)/.test(chuanHoaTen(ten))
}

// Bỏ phần "(kps)" để so từ khóa phần tên chính.
function boKps(ten) {
  return String(ten || '').replace(/\(\s*(k\s*p\s*s|ko\s*ph[áa]t\s*sinh|kh[ôo]ng\s*ph[áa]t\s*sinh)\s*\)/gi, '').trim()
}

// ── Thư mục năm ──────────────────────────────────────────────────────────────

// '2025', 'NĂM 2025', '2. NĂM 2025', '1. Năm 2025', '2025 ' → 2025. Không phải thư mục năm → null.
// Chỉ nhận năm 2000–2099 và tên CHỈ gồm (số thứ tự) + (chữ "Năm") + năm — '7. BỘ BÁO CÁO 2025' không phải.
export function namCuaThuMuc(ten) {
  const s = chuanHoaTen(ten)                       // bỏ dấu, khoảng trắng, chấm, gạch: '2. NĂM 2025' → '2NAM2025'
  const m = s.match(/^(?:\d{1,2})?(?:NAM)?(20\d\d)$/)
  // '12025' có thể là '1. 2025' (số thứ tự 1) — chấp nhận; '2025' thuần cũng khớp ở nhánh không số thứ tự.
  if (m) return Number(m[1])
  // Năm kèm đuôi chú thích: '2026 - Test BCT', 'Năm 2025 (bản cũ)' (anh thử 26/10/2026). Đuôi không được bắt đầu
  // bằng số, để '2025-2026' vẫn KHÔNG phải thư mục năm.
  const m2 = chuanCoCach(ten).match(/^(?:\d{1,2} )?(?:NAM ?)?(20\d\d) (\D.*)$/)
  return m2 ? Number(m2[1]) : null
}

// Thư mục đang đứng có phải thư mục NĂM xét theo NỘI DUNG không: bên trong có "7. BỘ BÁO CÁO" hoặc "2. HÓA ĐƠN…".
// Dùng khi tên không nói lên năm (nhân viên đặt tên tự do) — cây con mới là thứ quyết định.
export function laThuMucNamTheoCon(tenCon) {
  return tenCon.some(t => ['bo_bao_cao', 'hoa_don'].includes(loaiThuMucNam(t).ma))
}

// ── Tầng nhân viên đã trỏ vào ────────────────────────────────────────────────

// Trình duyệt chỉ cho biết TÊN thư mục được chọn, không có đường dẫn, nên phải đoán tầng từ tên + con.
//   'nam'     → đang đứng trong thư mục năm (dùng cho "Thêm dữ liệu năm cũ")
//   'ho_so'   → đang đứng trong "2. HỒ SƠ KẾ TOÁN"
//   'cong_ty' → thư mục công ty (mặc định)
export function tangTheoTen(ten) {
  if (namCuaThuMuc(ten) != null) return 'nam'
  // Tờ khai cho trỏ thẳng "7. BỘ BÁO CÁO" — Soát xét / Rủi ro thuế cần cả hóa đơn, sổ sách nên phải trỏ thư mục CÔNG TY
  if (chuanHoaTen(boSoThuTu(ten)) === chuanHoaTen('BỘ BÁO CÁO')) return 'bo_bao_cao'
  if (chuanHoaTen(boSoThuTu(ten)) === chuanHoaTen('HỒ SƠ KẾ TOÁN')) return 'ho_so'
  return 'cong_ty'
}

// ── Thư mục cấp 1 trong năm ──────────────────────────────────────────────────

// Thứ tự kiểm quan trọng: "HỢP ĐỒNG MUA VÀO_BÁN RA" và "HÓA ĐƠN MUA VÀO_BÁN RA" đều có "MUA VÀO".
export const LOAI_CAP1 = [
  { ma: 'hop_dong', so: 1, co: ['HOPDONGMUAVAO', 'HOPDONGMUABAN'] },
  { ma: 'hoa_don', so: 2, co: ['HOADON'] },
  { ma: 'hop_dong_khac', so: 3, co: ['HOPDONGKHAC'] },
  { ma: 'hai_quan', so: 4, co: ['HAIQUAN'] },
  { ma: 'bhxh', so: 5, co: ['BAOHIEM', 'BHXH'] },
  { ma: 'luong', so: 6, co: ['LUONG'] },
  { ma: 'bo_bao_cao', so: 7, co: ['BOBAOCAO'] },
  { ma: 'so_sach', so: 8, co: ['SOSACH'] },
  { ma: 'so_phu', so: 9, co: ['SOPHU', 'SAOKE'] },
  { ma: 'giay_nop_tien', so: 10, co: ['GIAYNOPTIEN'] },
  { ma: 'cong_van', so: 11, co: ['THONGBAO', 'CONGVAN'] },
  { ma: 'hinh_anh', so: 12, co: ['HINHANH'] },
]

// '6. LƯƠNG (KPS)' → { ma: 'luong', kps: true } ; tên lạ → { ma: null }
export function loaiThuMucNam(ten) {
  const chinh = chuanHoaTen(boSoThuTu(boKps(ten)))
  const kps = laKhongPhatSinh(ten)
  for (const l of LOAI_CAP1) {
    if (l.co.some(k => chinh.includes(k))) return { ma: l.ma, kps }
  }
  return { ma: null, kps }
}

// ── Trong "7. BỘ BÁO CÁO" ────────────────────────────────────────────────────

// 'BỘ BÁO CÁO THUẾ QUÝ_THÁNG', '1. BỘ BÁO CÁO THUẾ QUÝ' → 'bao_cao_thue'
// 'BỘ BÁO CÁO TÀI CHÍNH NĂM', 'BỘ BCTC NĂM 2025 - …', 'BAOCAOTAICHINH_…' → 'bctc'
// 'BÁO CÁO KHÁC', '3. BÁO CÁO KHÁC' → 'khac'
export function loaiThuMucBoBaoCao(ten) {
  const s = chuanHoaTen(boSoThuTu(ten))
  if (s.includes('TAICHINH') || s.includes('BCTC')) return 'bctc'
  if (s.includes('BAOCAOKHAC')) return 'khac'
  if (s.includes('THUE')) return 'bao_cao_thue'
  return null
}

// ── Thư mục kỳ ───────────────────────────────────────────────────────────────

// Tên thư mục kỳ → { loai: 'Q'|'T', so, nam|null, boSung } ; không nhận ra → null.
//   'BAOCAOTHUE -Q1'                     → Q1, năm null (lấy theo thư mục năm cha)
//   'BAOCAOTHUE_Q1.2025_ANBINH'          → Q1/2025
//   'BAOCAOTHUE QUY 1_2025_SONG HUONG'   → Q1/2025
//   'BÁO CÁO THUẾ_QUÝ 1.2025'            → Q1/2025
//   '1. BAOCAOTHUE_HOANG ANH_QUY1_HA'    → Q1
//   'BCT Q3-HKD NGỌC CHÂU'               → Q3
//   'BAOCAOTHUE_T09_2026_MAUSAVITAX_BSL1'→ T9/2026, bổ sung lần 1
export function kyCuaThuMuc(ten) {
  const s = chuanCoCach(boSoThuTu(ten))
  // Phải là thư mục báo cáo thuế: có "BAOCAOTHUE" / "BAO CAO THUE" / từ "BCT" đứng riêng.
  const dauMoc = s.search(/BAO ?CAO ?THUE|(?:^| )BCT(?= |$|[QT]\d)/)
  if (dauMoc < 0) return null
  const sau = s.slice(dauMoc)
  let loai = null, so = null
  let m = sau.match(/(?:^| |[A-Z])(?:QUY ?|Q)([1-4])(?!\d)/)
  // "Q" dính chữ cái phía trước (vd "THUEQ1") vẫn nhận, nhưng loại "QUY" bị cắt thành "QU" + "Y1": regex trên đã ưu tiên "QUY ?".
  if (m) { loai = 'Q'; so = Number(m[1]) }
  else {
    m = sau.match(/(?:^| )(?:THANG ?|T)(0?[1-9]|1[0-2])(?!\d)/)
    if (m) { loai = 'T'; so = Number(m[1]) }
  }
  if (!loai) return null
  const mn = sau.match(/(?:^|\D)(20\d\d)(?!\d)/)
  const mb = sau.match(/BSL ?(\d+)/)
  return { loai, so, nam: mn ? Number(mn[1]) : null, boSung: mb ? Number(mb[1]) : 0 }
}

// Mã kỳ thống nhất trong app: 'Q3', 'T09'.
export const maKy = k => (k.loai === 'Q' ? 'Q' + k.so : 'T' + String(k.so).padStart(2, '0'))

// ── Trong thư mục kỳ ─────────────────────────────────────────────────────────

// 'TỜ KHAI THUẾ', 'TỜ KHAI', '2. TO KHAI', 'BAO CAO THUE_XML' → 'to_khai'
// 'BẢNG KÊ', 'BẢNG KÊ HĐ MV-BR', 'BẢNG KÊ MUA VÀO BÁN RA' → 'bang_ke'
// 'TB CHẤP NHẬN', 'THÔNG BÁO CHẤP NHẬN', 'TBCN', '3. TBCN' → 'thong_bao'
export function loaiThuMucKy(ten) {
  const s = chuanHoaTen(boSoThuTu(ten))
  if (s.includes('BANGKE') || s.startsWith('BKE')) return 'bang_ke'
  if (s.includes('TOKHAI') || /XML$/.test(s)) return 'to_khai'
  if (s.includes('CHAPNHAN') || s === 'TBCN' || s.includes('THONGBAO') || s.includes('TIEPNHAN')) return 'thong_bao'
  if (/PDF$/.test(s)) return 'to_khai_pdf'
  return null
}

// ── Trong "2. HÓA ĐƠN …\QUÝ n" ───────────────────────────────────────────────

// 'QUÝ 3', 'QUY 3', 'Q3' → 3
export function quyCuaThuMuc(ten) {
  const m = chuanCoCach(boSoThuTu(boKps(ten))).match(/^(?:QUY ?|Q)([1-4])$/)
  return m ? Number(m[1]) : null
}

// 'HĐ MUA VÀO' → 'mua_vao' ; 'HĐ BÁN RA ( KPS )' → 'ban_ra' ; 'XML 1-7-2025_30-9-2025' → 'xml' ; 'HTML …' → 'html'
export function loaiThuMucHoaDon(ten) {
  const s = chuanHoaTen(boKps(ten))
  if (s.includes('MUAVAO')) return 'mua_vao'
  if (s.includes('BANRA')) return 'ban_ra'
  if (s.startsWith('XML')) return 'xml'
  if (s.startsWith('HTML')) return 'html'
  return null
}

// ── Gợi ý loại file theo TÊN (chỉ là gợi ý — loại thật do bộ đọc xem nội dung) ───────────

const GOI_Y_TEN = [
  { re: /HDTQMUAVAO|MUAVAOTONGQUAN/, loai: 'bang_ke_cong', chieu: 'mua_vao' },
  { re: /HDTQBANRA|BANRATONGQUAN/, loai: 'bang_ke_cong', chieu: 'ban_ra' },
  { re: /MUAVAOMAUQUANTRI|BANGKEMUAVAOMAUQUANTRI/, loai: 'bang_ke_pm', chieu: 'mua_vao' },
  { re: /BANRAMAUQUANTRI|BANGKEBANRAMAUQUANTRI/, loai: 'bang_ke_pm', chieu: 'ban_ra' },
  { re: /BANGKEHOADONCHU/, loai: 'bang_ke_pm', chieu: null },
  { re: /TOKHAITHUEGTGTKHAUTRU/, loai: 'bang_ke_pm', chieu: null },
  { re: /^TKGTGT/, loai: 'to_khai', chieu: null },
  { re: /^TBTN|^TBCN/, loai: 'thong_bao', chieu: null },
]
export function goiYTheoTen(tenFile) {
  const s = chuanHoaTen(tenFile).replace(/\(\d+\)/g, '')
  for (const g of GOI_Y_TEN) if (g.re.test(s)) return { loai: g.loai, chieu: g.chieu }
  return null
}

export const duoiFile = ten => (String(ten || '').match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase()

// ── Quét cây (bất đồng bộ, chỉ liệt kê) ──────────────────────────────────────
//
// `tay` là FileSystemDirectoryHandle của trình duyệt, hoặc đối tượng giả cùng giao diện trong bộ kiểm:
//   tay.name, tay.kind === 'directory', tay.entries() → async [ten, tayCon], tayFile.getFile() → {size, lastModified}

const GIOI_HAN_FILE_MOT_VUNG = 3000   // một vùng (vd sổ sách cả năm) quá số file này thì dừng, ghi cảnh báo

// canhBao: có thì thư mục con KHÔNG MỞ ĐƯỢC (bị đổi tên / di chuyển / xóa trên Drive giữa chừng, lối tắt hỏng, chưa đồng bộ)
// chỉ ghi cảnh báo rồi đi tiếp — trước đây một chỗ hỏng làm dừng cả lượt quét (THỊNH PHÁT, 27/10/2026). Không truyền thì ném lỗi
// (dùng cho thư mục GỐC nhân viên đã trỏ — để báo rõ "trỏ lại").
export const loiMoThuMuc = (tay, e) => `Không mở được thư mục "${tay?.name || '?'}" (${e?.name === 'NotFoundError' ? 'đã bị đổi tên, di chuyển hoặc xóa trên Drive' : e?.message || 'lỗi không rõ'}) — bỏ qua, đọc phần còn lại`

// Bản dạng vòng lặp cho các bộ quét rộng (Rủi ro thuế, Soát xét năm): laGoc → ném lỗi; thư mục con hỏng → ghi cảnh báo, coi như rỗng.
export async function* conAnToan(tay, laGoc, canhBao) {
  try { for await (const x of tay.entries()) yield x }
  catch (e) { if (laGoc) throw e; canhBao.push(loiMoThuMuc(tay, e)) }
}

async function con(tay, canhBao) {
  const thuMuc = [], tep = []
  try {
    for await (const [ten, t] of tay.entries()) {
      if (t.kind === 'directory') thuMuc.push([ten, t])
      else if (!ten.startsWith('~$') && !ten.startsWith('.')) tep.push([ten, t])   // bỏ file khoá tạm của Office, file ẩn
    }
  } catch (e) {
    if (!canhBao) throw e
    canhBao.push(loiMoThuMuc(tay, e))
  }
  thuMuc.sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  tep.sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  return { thuMuc, tep }
}

async function thongTinTep(ten, t, duongDan) {
  let co = null, sua = null
  try { const f = await t.getFile(); co = f.size; sua = f.lastModified } catch { /* file Drive chưa tải về máy vẫn liệt kê được */ }
  return { ten, duongDan, duoi: duoiFile(ten), co, sua, goiY: goiYTheoTen(ten), tay: t }
}

// Lấy mọi file trong một nhánh (đệ quy), giữ đường dẫn tương đối. Có giới hạn để không treo trên thư mục khổng lồ.
async function tepDeQuy(tay, duongDan, ketQua, canhBao) {
  const { thuMuc, tep } = await con(tay, canhBao)
  for (const [ten, t] of tep) {
    if (ketQua.length >= GIOI_HAN_FILE_MOT_VUNG) { canhBao.push(`Quá ${GIOI_HAN_FILE_MOT_VUNG} file trong ${duongDan.join('\\')} — chỉ đọc phần đầu`); return }
    ketQua.push(await thongTinTep(ten, t, duongDan))
  }
  for (const [ten, t] of thuMuc) await tepDeQuy(t, [...duongDan, ten], ketQua, canhBao)
}

// Thư mục tờ khai PHÁT SINH (không theo kỳ) phân hệ Tờ khai tạo: 'BAOCAOTHUE_PS0929_2026_DOEL' (PS + tháng ngày nộp)
export const laThuMucPhatSinh = ten => /BAO ?CAO ?THUE PS ?\d{4}(?!\d)/.test(chuanCoCach(boSoThuTu(ten)))

// Bên trong một thư mục kỳ: TỜ KHAI THUẾ / THÔNG BÁO CHẤP NHẬN / BẢNG KÊ (+ file để thẳng → 'goc')
async function quetThuMucKy(t, dd, canhBao) {
  const vung = {}
  const { thuMuc: vungDs, tep: tepKy } = await con(t, canhBao)
  if (tepKy.length) vung.goc = await Promise.all(tepKy.map(([ten, x]) => thongTinTep(ten, x, dd)))
  for (const [ten4, t4] of vungDs) {
    const ma = loaiThuMucKy(ten4) || 'khac'
    const ds = vung[ma] || (vung[ma] = [])
    await tepDeQuy(t4, [...dd, ten4], ds, canhBao)
  }
  return vung
}

// Quét "7. BỘ BÁO CÁO": nhận các thư mục kỳ. Hai kiểu cây đều có thật:
//   • nhân viên tự xếp: 7. BỘ BÁO CÁO\BỘ BÁO CÁO THUẾ QUÝ_THÁNG\BAOCAOTHUE_Q3…\
//   • phân hệ Tờ khai tải về: 7. BỘ BÁO CÁO\BAOCAOTHUE_Q2_2026_<mã KH>[_BSLn]\ — thư mục kỳ nằm THẲNG trong bộ báo cáo
//     (trước 27/10/2026 bị nhầm là thư mục nhóm → "Chưa có thư mục kỳ" dù đủ file).
async function quetBoBaoCao(tay, duongDan, namCha, canhBao) {
  const ra = { ky: [], bctc: [], khac: [], khongRo: [] }
  const themKy = async (ten, t, dd) => {
    if (laThuMucPhatSinh(ten)) { ra.ky.push({ ten, ky: null, vung: await quetThuMucKy(t, dd, canhBao), phatSinh: true }); return true }
    const ky = kyCuaThuMuc(ten)
    if (ky) { ra.ky.push({ ten, ky: { ...ky, nam: ky.nam ?? namCha, ma: maKy(ky) }, vung: await quetThuMucKy(t, dd, canhBao) }); return true }
    return false
  }
  const { thuMuc, tep } = await con(tay, canhBao)
  for (const [ten, t] of tep) ra.khongRo.push(await thongTinTep(ten, t, duongDan))
  for (const [ten2, t2] of thuMuc) {
    const dd2 = [...duongDan, ten2]
    const { thuMuc: con2 } = await con(t2, canhBao)
    const laNhom = con2.some(([n]) => laThuMucPhatSinh(n) || kyCuaThuMuc(n))
    if (!laNhom && await themKy(ten2, t2, dd2)) continue
    const loai = loaiThuMucBoBaoCao(ten2)
    if (loai === 'bctc') { await tepDeQuy(t2, dd2, ra.bctc, canhBao); continue }
    if (loai === 'khac') { await tepDeQuy(t2, dd2, ra.khac, canhBao); continue }
    // Báo cáo thuế (hoặc tên lạ): bên trong là các thư mục kỳ
    const { thuMuc: kyDs, tep: tepLe } = await con(t2, canhBao)
    for (const [ten, t] of tepLe) ra.khongRo.push(await thongTinTep(ten, t, dd2))
    for (const [ten3, t3] of kyDs) {
      const dd3 = [...dd2, ten3]
      if (await themKy(ten3, t3, dd3)) continue
      // Nhân viên để thẳng "BẢNG KÊ", "TỜ KHAI THUẾ" không qua thư mục kỳ → kỳ lấy từ nội dung file sau
      const vung = loaiThuMucKy(ten3)
      const tepVung = []; await tepDeQuy(t3, dd3, tepVung, canhBao)
      ra.ky.push({ ten: ten3, ky: null, vung: { [vung || 'khac']: tepVung }, khongRoKy: true })
    }
  }
  return ra
}

// ── Hóa đơn: nhận tháng + chiều cho TỪNG FILE, không bắt một cây cố định ─────────
//
// Thư mục hóa đơn thật đặt rất tự do (khảo sát 127HOME, 26/10/2026):
//   QUÝ 3\HĐ MUA VÀO\…                                  (kiểu cây chuẩn)
//   T01+02+03\XML 1-1-2026_31-3-2026\Mua vao\…          (gộp tháng, định dạng ở trên, chiều ở dưới)
//   THÁNG 06+07\HTML 1-1-2026_31-7-2026\Mua vao\…       (khoảng ngày RỘNG HƠN tên thư mục tháng)
//   THÁNG 08\0300000002\Mua vào\XML 2026-08-01_2026-08-31\…
// Nên mỗi file tự xét: chiều = cấp thư mục (hoặc tên file) có "MUA VÀO"/"BÁN RA"; tháng = thư mục tháng/quý
// (ưu tiên, vì đó là cách nhân viên xếp), không có mới lấy khoảng ngày trong tên thư mục / tên file.

// 'THÁNG 04' → [4] ; 'T01+02+03' → [1,2,3] ; 'THÁNG 06+07' → [6,7] ; 'T9' → [9] ; tên khác → null
export function thangCuaTen(ten) {
  const s = chuanCoCach(boSoThuTu(boKps(ten))).replace(/\s*\+\s*/g, '+')
  const m = s.match(/^(?:THANG|T) ?(\d{1,2}(?:\+(?:THANG ?|T)?\d{1,2})*)$/)
  if (!m) return null
  const ds = m[1].split('+').map(x => Number(x.replace(/\D/g, '')))
  return ds.every(x => x >= 1 && x <= 12) ? ds : null
}

// Khoảng ngày trong tên: '1-4-2026_30-4-2026', '2026-08-01_2026-08-31', '1-7-2025_30-9-2025' → { nam, thang: [..] }
export function thangTuKhoangNgay(ten) {
  const s = String(ten || '')
  let m = s.match(/(\d{1,2})-(\d{1,2})-(20\d\d)\s*_\s*(\d{1,2})-(\d{1,2})-(20\d\d)/)
  let tu, den
  if (m) { tu = [+m[3], +m[2]]; den = [+m[6], +m[5]] }
  else if ((m = s.match(/(20\d\d)-(\d{1,2})-(\d{1,2})\s*_\s*(20\d\d)-(\d{1,2})-(\d{1,2})/))) { tu = [+m[1], +m[2]]; den = [+m[4], +m[5]] }
  else return null
  if (tu[0] !== den[0] || tu[1] > den[1] || tu[1] < 1 || den[1] > 12) return null
  const thang = []
  for (let t = tu[1]; t <= den[1]; t++) thang.push(t)
  return { nam: tu[0], thang }
}

const chieuCuaTen = ten => {
  const s = chuanHoaTen(ten)
  if (s.includes('MUAVAO')) return 'mua_vao'
  if (s.includes('BANRA')) return 'ban_ra'
  return null
}

// Một file hóa đơn: cacCap = các thư mục từ dưới "2. HÓA ĐƠN" xuống tới file (không gồm tên file).
// → { chieu: 'mua_vao'|'ban_ra'|null, thang: [..]|null, nguonThang: 'thu_muc'|'khoang_ngay'|null }
export function phanLoaiTepHoaDon(cacCap, tenFile, nam) {
  let chieu = null
  for (const c of cacCap) chieu = chieuCuaTen(c) || chieu
  chieu = chieu || goiYTheoTen(tenFile)?.chieu || chieuCuaTen(tenFile)
  for (const c of cacCap) {
    const t = thangCuaTen(c)
    if (t) return { chieu, thang: t, nguonThang: 'thu_muc' }
    const q = quyCuaThuMuc(c)
    if (q) return { chieu, thang: [3 * q - 2, 3 * q - 1, 3 * q], nguonThang: 'thu_muc' }
  }
  for (const c of [...cacCap, tenFile]) {
    const k = thangTuKhoangNgay(c)
    if (k && (nam == null || k.nam === nam)) return { chieu, thang: k.thang, nguonThang: 'khoang_ngay' }
  }
  return { chieu, thang: null, nguonThang: null }
}

const GIOI_HAN_FILE_HOA_DON = 20000

// Quét "2. HÓA ĐƠN …" → { tep: [ thongTinTep + chieu, thang ], kps: [{ chieu, thang }] }
// Thư mục "(kps)" ở bất kỳ cấp nào: ghi nhận chiều + tháng của nó là "không phát sinh".
async function quetHoaDon(tay, duongDan, canhBao, nam) {
  const ra = { tep: [], kps: [] }
  const goc = duongDan.length
  async function duyet(t, dd) {
    const { thuMuc, tep } = await con(t, canhBao)
    for (const [ten, tf] of tep) {
      if (ra.tep.length >= GIOI_HAN_FILE_HOA_DON) { canhBao.push(`Quá ${GIOI_HAN_FILE_HOA_DON} file hóa đơn — chỉ đọc phần đầu`); return }
      const tt = await thongTinTep(ten, tf, dd)
      ra.tep.push({ ...tt, ...phanLoaiTepHoaDon(dd.slice(goc), ten, nam) })
    }
    for (const [ten, tc] of thuMuc) {
      const ddCon = [...dd, ten]
      if (laKhongPhatSinh(ten)) ra.kps.push(phanLoaiTepHoaDon(ddCon.slice(goc), '', nam))
      await duyet(tc, ddCon)
    }
  }
  await duyet(tay, duongDan)
  return ra
}

// Quét một thư mục năm → kiểm kê theo vùng.
export async function quetNam(tayNam, duongDan = [tayNam.name]) {
  const nam = namCuaThuMuc(tayNam.name)
  const canhBao = []
  // tay: giữ tay cầm thư mục năm để phân hệ khác (Rủi ro thuế) tự quét rộng khi cây không theo mẫu chuẩn
  const ra = { nam, ten: tayNam.name, tay: tayNam, duongDan, thuMuc: [], boBaoCao: null, hoaDon: null, vung: {}, canhBao }
  const { thuMuc, tep } = await con(tayNam, canhBao)
  if (tep.length) ra.vung.goc = await Promise.all(tep.map(([ten, t]) => thongTinTep(ten, t, duongDan)))
  for (const [ten, t] of thuMuc) {
    const { ma, kps } = loaiThuMucNam(ten)
    const dd = [...duongDan, ten]
    ra.thuMuc.push({ ten, ma, kps })
    if (kps) continue                                      // không phát sinh: không quét, không báo thiếu
    if (ma === 'bo_bao_cao') ra.boBaoCao = await quetBoBaoCao(t, dd, nam, canhBao)
    else if (ma === 'hoa_don') ra.hoaDon = await quetHoaDon(t, dd, canhBao, nam)
    else if (ma && !['hop_dong', 'hop_dong_khac', 'giay_nop_tien', 'hinh_anh'].includes(ma)) {
      const ds = []; await tepDeQuy(t, dd, ds, canhBao); ra.vung[ma] = ds
    }
    // hợp đồng, giấy nộp tiền, hình ảnh: chỉ ghi nhận có thư mục, không đọc số
  }
  return ra
}

// Quét từ thư mục nhân viên đã trỏ. tuNam: chỉ lấy năm >= tuNam (mặc định 2026). Trỏ thẳng vào một thư mục
// năm (dùng cho năm cũ) thì quét đúng năm đó, bỏ qua tuNam.
export async function quetCongTy(goc, { tuNam = NAM_BAT_DAU } = {}) {
  const tang = tangTheoTen(goc.name)
  const ra = { tang, ten: goc.name, nam: {}, namBoQua: [], canhBao: [] }
  if (tang === 'bo_bao_cao') return ra   // không quét — màn hình nhắc trỏ lại thư mục công ty
  const conGoc = await con(goc)   // ném lỗi nếu chính thư mục đã trỏ không mở được
  if (tang === 'nam') {
    const n = await quetNam(goc)
    ra.nam[n.nam] = n
    return ra
  }
  let hoSo = goc
  if (tang === 'cong_ty') {
    const { thuMuc } = conGoc
    // Tên không giống năm nhưng bên trong là cây của MỘT năm (có "7. BỘ BÁO CÁO"…) → coi là thư mục năm.
    // Năm lấy từ số 20xx trong tên, không có thì từ tên các thư mục kỳ bên trong (BAOCAOTHUE_Q3_2026_…).
    if (laThuMucNamTheoCon(thuMuc.map(([ten]) => ten))) {
      ra.tang = 'nam'
      const n = await quetNam(goc)
      const trongTen = String(goc.name).match(/20\d\d/)
      const tuKy = (n.boBaoCao?.ky || []).map(k => k.ky?.nam).filter(Boolean)
      n.nam = trongTen ? Number(trongTen[0]) : tuKy.length ? Math.max(...tuKy) : null
      if (n.nam == null) { ra.canhBao.push(`Thư mục "${goc.name}" là cây của một năm nhưng không rõ năm nào — đặt tên thư mục là năm (vd "2026")`); return ra }
      for (const k of n.boBaoCao?.ky || []) if (k.ky && k.ky.nam == null) k.ky.nam = n.nam
      ra.canhBao.push(`Đã trỏ thẳng vào thư mục năm "${goc.name}" — app hiểu là năm ${n.nam}`)
      ra.nam[n.nam] = n
      return ra
    }
    const tim = thuMuc.find(([ten]) => chuanHoaTen(boSoThuTu(ten)) === chuanHoaTen('HỒ SƠ KẾ TOÁN'))
    if (tim) hoSo = tim[1]
    else ra.canhBao.push('Không thấy thư mục "2. HỒ SƠ KẾ TOÁN" — tìm thư mục năm ngay trong thư mục đã chọn')
  }
  const { thuMuc } = await con(hoSo, ra.canhBao)
  for (const [ten, t] of thuMuc) {
    const n = namCuaThuMuc(ten)
    if (n == null) continue
    if (n < tuNam) { ra.namBoQua.push(n); continue }
    const kq = await quetNam(t, [goc.name, hoSo === goc ? null : hoSo.name, ten].filter(Boolean))
    if (ra.nam[n]) ra.canhBao.push(`Có 2 thư mục cùng năm ${n}: "${ra.nam[n].ten}" và "${ten}" — đang dùng thư mục đầu`)
    else ra.nam[n] = kq
  }
  return ra
}

// Gộp các năm của một thư mục năm nhân viên TRỎ RIÊNG (kq = quetCongTy của thư mục đó) vào kết quả quét chung.
// Trùng năm với thư mục chính → thư mục trỏ riêng THẮNG: nhân viên đã chọn cố ý cho đúng năm đó (ca DOEL 27/10/2026: thư mục
// chính chỉ có tờ khai tải về, thư mục năm thật trên Drive đủ hóa đơn nhưng bị bỏ qua). Hai thư mục trỏ riêng trùng năm → giữ cái đầu.
export function gopNamTroRieng(gop, kq, ten) {
  for (const [n, v] of Object.entries(kq.nam)) {
    if (gop.nam[n]?.tuNamCu) { gop.canhBao.push(`Năm ${n} có ở hai thư mục trỏ riêng — đang dùng "${gop.nam[n].tuNamCu}"`); continue }
    if (gop.nam[n]) gop.canhBao.push(`Năm ${n} có ở cả thư mục chính và thư mục năm "${ten}" — đang dùng thư mục năm "${ten}" (trỏ riêng)`)
    gop.nam[n] = { ...v, tuNamCu: ten }
  }
  return gop
}
