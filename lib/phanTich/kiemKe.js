// Kiểm kê hồ sơ một năm của một công ty — màn "Hồ sơ dữ liệu" (Phân hệ Soát xét báo cáo).
//
// Hàm THUẦN: nhận kết quả quét thư mục (thuMuc.js quetNam) + danh sách tờ khai đã đọc nội dung, trả các dòng
// bảng, ô tổng và lưới "Đủ kỳ chưa". Không đọc file, không gọi mạng → kiểm được bằng node
// (scripts/test-phantich-kiemke.mjs).
//
// Quy tắc:
// - Kỳ cần có = kỳ khai theo hồ sơ công ty (tháng/quý, cố định cả năm), chỉ tính kỳ ĐÃ KẾT THÚC, trong thời
//   gian hợp đồng (từ contract_start, trước service_end).
// - Kỳ đã kết thúc nhưng CHƯA TỚI HẠN NỘP mà chưa có hồ sơ → "chờ" (không báo thiếu): tháng hạn ngày 20 tháng
//   sau, quý hạn ngày cuối tháng đầu quý sau.
// - Có tờ khai 01/GTGT đọc được nội dung thì tin nội dung (kỳ trong file), không tin tên thư mục.
// - Thư mục đuôi (kps) = không phát sinh: không báo thiếu.
// - Chỉ hiện "có / thiếu", không chấm điểm.

import { LOAI_CAP1 } from './thuMuc.js'

const TEN_CHUAN = {
  hop_dong: 'Hợp đồng mua vào – bán ra', hoa_don: 'Hóa đơn mua vào – bán ra', hop_dong_khac: 'Hợp đồng khác',
  hai_quan: 'Tờ khai hải quan', bhxh: 'Bảo hiểm xã hội', luong: 'Lương', bo_bao_cao: 'Bộ báo cáo',
  so_sach: 'Sổ sách kế toán', so_phu: 'Sổ phụ ngân hàng', giay_nop_tien: 'Giấy nộp tiền',
  cong_van: 'Các thông báo – công văn', hinh_anh: 'Hình ảnh',
}
// Thư mục chỉ ghi nhận có/không — không dùng để soát số ở giai đoạn này.
const CHI_GHI_NHAN = new Set(['hop_dong', 'hop_dong_khac', 'giay_nop_tien', 'hinh_anh'])
// Thiếu hẳn thư mục này là thiếu thật (đỏ); thư mục khác thiếu thì có thể công ty không có nghiệp vụ đó.
const BAT_BUOC = new Set(['hoa_don', 'bo_bao_cao'])
const KHONG_DOC_DUOC = new Set(['rar', 'zip', '7z'])

export const TRANG_THAI = {
  da_co: { nhan: 'Đã có', mau: 'xanhLa' },
  thieu_ky: { nhan: 'Thiếu kỳ', mau: 'do' },
  chua_co: { nhan: 'Chưa có thư mục', mau: 'do' },
  khong_co: { nhan: 'Không có thư mục', mau: 'xam' },
  trong: { nhan: 'Thư mục trống', mau: 'hoPhach' },
  can_xem: { nhan: 'Cần xem', mau: 'hoPhach' },
  kps: { nhan: 'Không phát sinh', mau: 'xam' },
  ghi_nhan: { nhan: 'Chỉ ghi nhận', mau: 'xam' },
  la: { nhan: 'Thư mục lạ', mau: 'tim' },
}

// ── Kỳ ───────────────────────────────────────────────────────────────────────

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const ngayCuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()   // m: 1..12

// Kỳ trong năm theo kỳ khai: [{ ma:'T01'|'Q1', loai, so, tu, den, han }]
export function cacKy(nam, kyKhai) {
  const ra = []
  if (kyKhai === 'thang') {
    for (let m = 1; m <= 12; m++) {
      const [yh, mh] = m === 12 ? [nam + 1, 1] : [nam, m + 1]
      ra.push({ ma: 'T' + String(m).padStart(2, '0'), loai: 'T', so: m, tu: iso(nam, m, 1), den: iso(nam, m, ngayCuoiThang(nam, m)), han: iso(yh, mh, 20) })
    }
  } else {
    for (let q = 1; q <= 4; q++) {
      const mDau = 3 * q - 2, mCuoi = 3 * q
      const [yh, mh] = q === 4 ? [nam + 1, 1] : [nam, mCuoi + 1]
      ra.push({ ma: 'Q' + q, loai: 'Q', so: q, tu: iso(nam, mDau, 1), den: iso(nam, mCuoi, ngayCuoiThang(nam, mCuoi)), han: iso(yh, mh, ngayCuoiThang(yh, mh)) })
    }
  }
  return ra
}
const cacQuy = nam => cacKy(nam, 'quy')

// Trạng thái thời gian của một kỳ: 'chua_toi' (chưa kết thúc) | 'ngoai_hd' | 'chua_han' | 'phai_co'
export function moc(k, { homNay, batDau, ngungTu }) {
  if (batDau && k.den < String(batDau).slice(0, 7) + '-01') return 'ngoai_hd'
  if (ngungTu && k.tu >= String(ngungTu).slice(0, 10)) return 'ngoai_hd'
  if (k.den >= homNay) return 'chua_toi'
  if (k.han >= homNay) return 'chua_han'
  return 'phai_co'
}
// Ô lưới: có → 'co'; không có: theo mốc thời gian → 'thieu' | 'cho' | 'chua_toi' | 'ngoai_hd'
function o(k, co, mocKy, them = {}) {
  if (co === 'kps') return { ma: k.ma, tt: mocKy === 'ngoai_hd' ? 'ngoai_hd' : 'kps', ...them }
  if (co) return { ma: k.ma, tt: 'co', ...them }
  const tt = mocKy === 'phai_co' ? 'thieu' : mocKy === 'chua_han' ? 'cho' : mocKy
  return { ma: k.ma, tt, ...them }
}

// ── Gom file ─────────────────────────────────────────────────────────────────

const tatCaTep = vung => Object.values(vung || {}).filter(Array.isArray).flat().filter(t => t && t.ten)
const demDuoi = ds => [...new Set(ds.map(t => t.duoi).filter(Boolean))].sort()
export const fileCanXem = t => KHONG_DOC_DUOC.has(t.duoi) || t.co == null

// Nhóm file của một vùng theo thư mục con ngay dưới thư mục loại (vd "8. SỔ SÁCH\1. PHIẾU THU_PHIẾU CHI").
function theoThuMucCon(tenLoai, ds) {
  const nhom = new Map()
  for (const t of ds) {
    const i = t.duongDan.lastIndexOf(tenLoai)
    const con = i >= 0 && t.duongDan[i + 1] ? t.duongDan[i + 1] : ''
    if (!nhom.has(con)) nhom.set(con, [])
    nhom.get(con).push(t)
  }
  return nhom
}

function dongTep(ds, them) {
  const canXem = ds.filter(fileCanXem)
  return {
    soFile: ds.length, dinhDang: demDuoi(ds), canXem: canXem.length, tep: ds,
    trangThai: ds.length === 0 ? 'trong' : canXem.length ? 'can_xem' : 'da_co',
    ...them,
  }
}

const dsKy = ds => {
  if (!ds.length) return ''
  const so = ds.map(k => k.so).sort((a, b) => a - b)
  const tien = ds[0].loai === 'Q' ? 'Q' : 'T'
  // gộp dải liên tiếp: T1–T9, Q1–Q3
  const dai = []
  for (const s of so) {
    const cuoi = dai[dai.length - 1]
    if (cuoi && s === cuoi[1] + 1) cuoi[1] = s; else dai.push([s, s])
  }
  return dai.map(([a, b]) => (a === b ? tien + a : `${tien}${a}–${tien}${b}`)).join(', ')
}

// ── Kiểm kê một năm ──────────────────────────────────────────────────────────

// quet: kết quả quetNam. toKhai: [{ loai, ky:{loai,so,nam}, maKy, lanBoSung, tep }] đã đọc nội dung (có thể rỗng).
// opt: { kyKhai:'thang'|'quy', laHkd, homNay:'YYYY-MM-DD', batDau, ngungTu, loiDoc: số file XML đọc lỗi }
export function kiemKeNam(quet, toKhai = [], opt = {}) {
  const nam = quet.nam
  const kyKhai = opt.kyKhai === 'thang' ? 'thang' : 'quy'
  const homNay = opt.homNay || new Date().toISOString().slice(0, 10)
  const mocOpt = { homNay, batDau: opt.batDau, ngungTu: opt.ngungTu }
  const canhBao = [...(quet.canhBao || [])]
  const dong = []

  // 1. Theo thư mục cấp 1, đúng thứ tự cây chuẩn
  const coThuMuc = new Map()
  for (const tm of quet.thuMuc || []) if (tm.ma && !coThuMuc.has(tm.ma)) coThuMuc.set(tm.ma, tm)
  const boBaoCao = quet.boBaoCao
  const ky = boBaoCao?.ky || []

  for (const loai of LOAI_CAP1) {
    const tm = coThuMuc.get(loai.ma)
    const goc = { ma: loai.ma, so: loai.so, ten: tm?.ten || `${loai.so}. ${TEN_CHUAN[loai.ma]}`, coThuMuc: !!tm }
    if (!tm) { dong.push({ ...goc, trangThai: BAT_BUOC.has(loai.ma) ? 'chua_co' : 'khong_co', soFile: 0, dinhDang: [], tep: [], canXem: 0, moTa: '' }); continue }
    if (tm.kps) { dong.push({ ...goc, trangThai: 'kps', soFile: 0, dinhDang: [], tep: [], canXem: 0, moTa: 'Đuôi (KPS): không phát sinh' }); continue }
    if (CHI_GHI_NHAN.has(loai.ma)) { dong.push({ ...goc, trangThai: 'ghi_nhan', soFile: null, dinhDang: [], tep: [], canXem: 0, moTa: 'Không cần cho soát xét — chỉ ghi nhận có thư mục' }); continue }

    if (loai.ma === 'bo_bao_cao') {
      const tepKy = ky.flatMap(k => tatCaTep(k.vung))
      const coKy = ky.filter(k => k.ky && !k.ky.boSung)
      const bs = ky.filter(k => k.ky?.boSung)
      const thue = dongTep(tepKy, {
        ...goc, ten: `${tm.ten} \\ Báo cáo thuế theo kỳ`, cha: tm.ten, tenCon: 'Báo cáo thuế theo kỳ', ma: 'bo_bao_cao_thue',
        moTa: [coKy.length ? `${coKy.length} thư mục kỳ (${dsKy(coKy.map(k => k.ky))})` : 'Chưa có thư mục kỳ',
          bs.length ? `${bs.length} bổ sung` : '', ky.some(k => k.phatSinh) ? `${ky.filter(k => k.phatSinh).length} tờ khai phát sinh` : ''].filter(Boolean).join(' · '),
      })
      dong.push(thue)
      dong.push(dongTep(boBaoCao?.bctc || [], { ...goc, ten: `${tm.ten} \\ Báo cáo tài chính năm`, cha: tm.ten, tenCon: 'Báo cáo tài chính năm', ma: 'bo_bao_cao_bctc', moTa: '' }))
      if ((boBaoCao?.khac || []).length) dong.push(dongTep(boBaoCao.khac, { ...goc, ten: `${tm.ten} \\ Báo cáo khác`, cha: tm.ten, tenCon: 'Báo cáo khác', ma: 'bo_bao_cao_khac', moTa: '' }))
      if ((boBaoCao?.khongRo || []).length) {
        dong.push(dongTep(boBaoCao.khongRo, { ...goc, ten: `${tm.ten} \\ (file để lẻ, chưa vào thư mục kỳ)`, cha: tm.ten, tenCon: '(file để lẻ, chưa vào thư mục kỳ)', ma: 'bo_bao_cao_le', moTa: 'Nên xếp vào đúng thư mục kỳ', trangThai: 'can_xem' }))
      }
      // BCTC năm chỉ cần sau khi hết năm
      const bctc = dong.find(d => d.ma === 'bo_bao_cao_bctc')
      if (bctc.soFile === 0) { bctc.trangThai = `${nam}-12-31` < homNay ? 'trong' : 'ghi_nhan'; bctc.moTa = bctc.trangThai === 'ghi_nhan' ? 'Chưa hết năm tài chính' : 'Chưa có BCTC năm' }
      continue
    }

    if (loai.ma === 'hoa_don') {
      // Dạng cây như bộ báo cáo (anh yêu cầu 26/10/2026): dòng cha tóm tắt cả năm, mỗi thư mục con ngay dưới
      // "2. HÓA ĐƠN" (T01+02+03, THÁNG 04…, kể cả file để lẻ) là một dòng con.
      const tepHd = quet.hoaDon?.tep || []
      const thangCo = [...new Set(tepHd.filter(t => t.chieu === 'mua_vao' && t.duoi === 'xml').flatMap(t => t.thang || []))].map(so => ({ loai: 'T', so }))
      const khongRoThang = tepHd.filter(t => !t.thang).length
      const khongRoChieu = tepHd.filter(t => t.thang && !t.chieu && ['xml', 'pdf', 'html', 'htm'].includes(t.duoi)).length
      const moTaNhom = [thangCo.length ? `XML mua vào ${dsKy(thangCo)}` : tepHd.length ? 'Chưa có file XML mua vào' : 'Chưa có hóa đơn',
        khongRoThang ? `${khongRoThang} file không rõ tháng` : '', khongRoChieu ? `${khongRoChieu} file không rõ mua vào / bán ra` : ''].filter(Boolean).join(' · ')
      const nhom = theoThuMucCon(tm.ten, tepHd)
      if (!nhom.size) { dong.push(dongTep([], { ...goc, moTa: moTaNhom })); continue }
      // Thư mục con xếp theo tháng nhỏ nhất bên trong; file để lẻ xuống cuối
      const cacCon = [...nhom.entries()].sort(([a, x], [b, y]) => (a === '') - (b === '')
        || Math.min(...x.flatMap(t => t.thang || [99])) - Math.min(...y.flatMap(t => t.thang || [99])) || a.localeCompare(b, 'vi'))
      cacCon.forEach(([con, ds], j) => {
        const thang = [...new Set(ds.flatMap(t => t.thang || []))].map(so => ({ loai: 'T', so }))
        const xmlMua = ds.filter(t => t.chieu === 'mua_vao' && t.duoi === 'xml').length
        const banRa = ds.filter(t => t.chieu === 'ban_ra').length
        const bangKe = ds.filter(t => ['xlsx', 'xls', 'xlsm'].includes(t.duoi)).length
        dong.push(dongTep(ds, {
          ...goc, ten: con ? `${tm.ten} \\ ${con}` : tm.ten, cha: tm.ten, tenCon: con || '(file để thẳng trong thư mục)',
          moTaNhom: j === 0 ? moTaNhom : undefined,
          moTa: [thang.length ? dsKy(thang) : '', xmlMua ? `${xmlMua} XML mua vào` : '', banRa ? `${banRa} file bán ra` : '', bangKe ? `${bangKe} bảng kê Excel` : '']
            .filter(Boolean).join(' · ') || (con ? '' : 'Nên xếp vào thư mục tháng'),
        }))
      })
      continue
    }

    // Vùng còn lại: tách theo thư mục con để thấy từng loại sổ
    const ds = quet.vung?.[loai.ma] || []
    const nhom = theoThuMucCon(tm.ten, ds)
    if (nhom.size <= 1) { dong.push(dongTep(ds, { ...goc, moTa: '' })); continue }
    for (const [con, dsCon] of nhom) dong.push(dongTep(dsCon, { ...goc, ten: con ? `${tm.ten} \\ ${con}` : tm.ten, cha: tm.ten, tenCon: con || '(file để thẳng trong thư mục)', moTa: '' }))
  }

  for (const tm of quet.thuMuc || []) {
    if (!tm.ma) dong.push({ ma: null, so: 99, ten: tm.ten, coThuMuc: true, trangThai: 'la', soFile: null, dinhDang: [], tep: [], canXem: 0, moTa: 'App chưa nhận ra thư mục này — không đọc' })
  }

  // 2. Lưới "Đủ kỳ chưa"
  const cacKyNam = cacKy(nam, kyKhai)
  const mocKy = new Map(cacKyNam.map(k => [k.ma, moc(k, mocOpt)]))
  const kyThuMuc = new Map()           // 'T09' → thư mục kỳ chính thức (không bổ sung)
  for (const k of ky) if (k.ky && !k.ky.boSung && (k.ky.nam == null || k.ky.nam === nam)) kyThuMuc.set(k.ky.ma, k)
  const gtgt = toKhai.filter(t => t.loai === '01/GTGT' && t.ky?.nam === nam)
  const maGtgt = new Map()
  for (const t of gtgt) {
    const ma = t.ky.loai === 'Q' ? 'Q' + t.ky.so : 'T' + String(t.ky.so).padStart(2, '0')
    if (!maGtgt.has(ma) || t.lanBoSung > maGtgt.get(ma).lanBoSung) maGtgt.set(ma, t)
  }
  const coVung = (k, ...cacVung) => !!k && cacVung.some(v => (k.vung?.[v] || []).length)

  const luoi = []
  luoi.push({
    nhan: opt.laHkd ? 'Tờ khai (hộ kinh doanh)' : 'Tờ khai 01/GTGT', nhom: 'bao_cao',
    o: cacKyNam.map(k => {
      const tk = maGtgt.get(k.ma)
      if (tk) return o(k, true, mocKy.get(k.ma), { ghiChu: [tk.lanBoSung ? `bổ sung lần ${tk.lanBoSung}` : 'đọc từ nội dung tờ khai', tk.nguon === 'pdf' ? 'bản PDF (không có XML)' : ''].filter(Boolean).join(' · ') })
      const tmKy = kyThuMuc.get(k.ma)
      const coFile = coVung(tmKy, 'to_khai', 'to_khai_pdf', 'goc')
      return o(k, coFile, mocKy.get(k.ma), coFile ? { ghiChu: 'có file trong thư mục kỳ, chưa đọc được nội dung' } : {})
    }),
  })
  luoi.push({ nhan: 'Thông báo chấp nhận', nhom: 'bao_cao', o: cacKyNam.map(k => o(k, coVung(kyThuMuc.get(k.ma), 'thong_bao'), mocKy.get(k.ma))) })

  // ── Hóa đơn + bảng kê (quy trình anh chốt 26/10/2026) ──
  //   Bán ra: KHÔNG tải file hóa đơn (xuất thẳng từ phần mềm) → chỉ cần BẢNG KÊ CHI TIẾT tải từ cổng HĐĐT.
  //   Mua vào: cần bảng kê chi tiết từ cổng + file hóa đơn XML.
  //   Sau khi làm báo cáo kỳ: bảng kê xuất từ PHẦN MỀM kế toán (mua vào + bán ra).
  // Tháng nào tờ khai ghi 0 ([23] mua vào / [34] doanh thu) thì không đòi bảng kê / hóa đơn chiều đó.
  const thangCuaKy = k => (k.loai === 'T' ? [k.so] : [3 * k.so - 2, 3 * k.so - 1, 3 * k.so])
  const ctKhong = (k, ct) => { const tk = maGtgt.get(k.ma); return !!tk && tk.chiTieu?.[ct] === 0 }
  // Một ô theo THÁNG: có đủ tháng → co; có một phần → mot_phan (đã quá hạn) / cho; không có → thiếu / chờ…
  const oTheoThang = (k, coThang, kpsThang, ct, kpsCaNam) => {
    const m = mocKy.get(k.ma)
    if (kpsCaNam) return o(k, 'kps', m)
    const cacT = thangCuaKy(k)
    if (ctKhong(k, ct) && !cacT.some(t => coThang.has(t))) return o(k, 'kps', m, { ghiChu: `tờ khai ghi [${ct}] = 0` })
    const thieu = cacT.filter(t => !coThang.has(t) && !kpsThang.has(t))
    const coMot = cacT.some(t => coThang.has(t))
    if (!thieu.length) return o(k, coMot ? true : 'kps', m)
    const ghiChu = `thiếu ${thieu.map(t => 'T' + t).join(', ')}`
    if (coMot && m === 'phai_co') return { ma: k.ma, tt: 'mot_phan', ghiChu }
    if (coMot && m === 'chua_han') return { ma: k.ma, tt: 'cho', ghiChu }
    return o(k, false, m, m === 'phai_co' ? { ghiChu } : {})
  }
  const thangTrongNam = ds => new Set((ds || []).filter(t => t.startsWith(nam + '-')).map(t => Number(t.slice(5, 7))))
  const bangKe = opt.bangKe || []
  const hdTt = coThuMuc.get('hoa_don')
  const kpsHd = quet.hoaDon?.kps || []
  const kpsThangCua = chieu => new Set(kpsHd.filter(x => !x.chieu || x.chieu === chieu).flatMap(x => x.thang || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))

  // Bảng kê CỔNG = chỉ file Excel ở 2. HÓA ĐƠN MUA VÀO_BÁN RA (bảng kê chi tiết tải từ hoadondientu theo kỳ)
  for (const [chieu, nhan, ct] of [['mua_vao', 'Bảng kê cổng HĐĐT — mua vào', '23'], ['ban_ra', 'Bảng kê cổng HĐĐT — bán ra', '34']]) {
    const co = new Set(bangKe.filter(b => b.mau === 'cong' && b.chieu === chieu).flatMap(b => [...thangTrongNam(b.thang)]))
    luoi.push({ nhan, nhom: 'hoa_don', o: cacKyNam.map(k => oTheoThang(k, co, kpsThangCua(chieu), ct, hdTt?.kps)) })
  }
  // Bảng kê KÈM TỜ KHAI = mọi bảng kê ở 7. BỘ BÁO CÁO: xuất từ phần mềm, hoặc "BẢNG KÊ MV-BR" bố cục cổng (docHoSo
  // vaiTroBangKe đổi thành 'pm_kem_tk'). Hai dòng "Bảng kê cổng HĐĐT" ở trên chỉ còn file ở 2. HÓA ĐƠN (anh chốt 30/10/2026).
  // Kỳ = thư mục kỳ chứa file (bảng kê kỳ này có lẫn hóa đơn tháng trước kê khai muộn — 127HOME);
  // file không nằm trong thư mục kỳ thì lấy tháng có nhiều hóa đơn nhất.
  const kyCuaThang = t => (kyKhai === 'thang' ? 'T' + String(t).padStart(2, '0') : 'Q' + Math.ceil(t / 3))
  const kyPm = { mua_vao: new Set(), ban_ra: new Set() }
  for (const b of bangKe.filter(b => b.mau && b.mau.startsWith('pm_') && b.chieu)) {
    let ma = b.kyThuMuc && (b.kyThuMuc.nam == null || b.kyThuMuc.nam === nam) ? b.kyThuMuc.ma : null
    if (!ma) {
      // soTheoThang: { '2026-04': số hóa đơn } — tháng nhiều hóa đơn nhất quyết định kỳ
      const tNhieu = Object.entries(b.soTheoThang || {}).filter(([t]) => t.startsWith(nam + '-')).sort((a, c) => c[1] - a[1])[0]?.[0]
      if (tNhieu) ma = kyCuaThang(Number(tNhieu.slice(5, 7)))
    }
    // Thư mục kỳ đặt theo quý mà công ty khai tháng (hoặc ngược lại): quy về các kỳ của lưới
    if (ma && ma.startsWith('Q') && kyKhai === 'thang') { const q = +ma.slice(1); for (const t of [3 * q - 2, 3 * q - 1, 3 * q]) kyPm[b.chieu].add(kyCuaThang(t)) }
    else if (ma && ma.startsWith('T') && kyKhai !== 'thang') kyPm[b.chieu].add(kyCuaThang(+ma.slice(1)))
    else if (ma) kyPm[b.chieu].add(ma)
  }
  luoi.push({
    nhan: 'Bảng kê kèm tờ khai (7. BỘ BÁO CÁO)', nhom: 'bao_cao',
    o: cacKyNam.map(k => {
      const m = mocKy.get(k.ma)
      const mua = kyPm.mua_vao.has(k.ma) || ctKhong(k, '23'), ban = kyPm.ban_ra.has(k.ma) || ctKhong(k, '34')
      if (mua && ban) return o(k, true, m)
      if ((mua || ban) && m === 'phai_co') return { ma: k.ma, tt: 'mot_phan', ghiChu: `thiếu ${mua ? 'bán ra' : 'mua vào'}` }
      if ((mua || ban) && m === 'chua_han') return { ma: k.ma, tt: 'cho', ghiChu: `thiếu ${mua ? 'bán ra' : 'mua vào'}` }
      return o(k, false, m)
    }),
  })

  // File hóa đơn XML mua vào, theo tháng (thuMuc.js phanLoaiTepHoaDon). File bán ra không đòi.
  const tepHd = quet.hoaDon?.tep || []
  const xmlMua = new Set(tepHd.filter(t => t.chieu === 'mua_vao' && t.duoi === 'xml').flatMap(t => t.thang || []))
  luoi.push({ nhan: 'HĐ mua vào (file XML)', nhom: 'hoa_don', o: cacKyNam.map(k => oTheoThang(k, xmlMua, kpsThangCua('mua_vao'), '23', hdTt?.kps)) })
  const tncn = toKhai.filter(t => t.loai === '05/KK-TNCN' && t.ky?.nam === nam)
  if (tncn.length) {
    const ma = new Set(tncn.map(t => (t.ky.loai === 'Q' ? 'Q' + t.ky.so : 'T' + String(t.ky.so).padStart(2, '0'))))
    const kyTncn = tncn.some(t => t.ky.loai === 'T') ? cacKy(nam, 'thang') : cacQuy(nam)
    luoi.push({ nhan: '05/KK-TNCN', nhom: 'bao_cao', o: kyTncn.map(k => o(k, ma.has(k.ma), moc(k, mocOpt))) })
  }

  // 3. Kỳ khai theo thư mục so với hồ sơ công ty — chỉ báo, không kết luận (kỳ cố định cả năm; lệch thường do
  //    tick nhầm loại báo cáo, màn Soát kỳ xem kỹ)
  const loaiTm = new Set(ky.filter(k => k.ky).map(k => k.ky.loai))
  const loaiTk = new Set(gtgt.map(t => t.ky.loai))
  const kyThat = loaiTk.size === 1 ? [...loaiTk][0] : loaiTm.size === 1 ? [...loaiTm][0] : null
  const kyHoSo = kyKhai === 'thang' ? 'T' : 'Q'
  if (kyThat && kyThat !== kyHoSo) {
    canhBao.push(`Hồ sơ công ty ghi khai ${kyKhai === 'thang' ? 'THÁNG' : 'QUÝ'} nhưng ${loaiTk.size ? 'tờ khai' : 'thư mục kỳ'} năm ${nam} là theo ${kyThat === 'T' ? 'THÁNG' : 'QUÝ'} — có thể tick nhầm loại báo cáo. Lưới bên phải đang xếp theo hồ sơ công ty.`)
  }
  if (opt.loiDoc) canhBao.push(`${opt.loiDoc} file XML trong bộ báo cáo không đọc được — xem cột "Cần xem"`)

  // 4. Ô tổng
  const thieuO = luoi.flatMap(l => l.o.filter(x => x.tt === 'thieu' || x.tt === 'mot_phan').map(x => `${l.nhan} ${x.ma}${x.tt === 'mot_phan' ? ' (' + x.ghiChu + ')' : ''}`))
  for (const d of dong) {
    if (!['da_co', 'can_xem', 'trong'].includes(d.trangThai)) continue   // "Chưa có thư mục" giữ nguyên
    const thieuNhom = nhom => luoi.filter(l => l.nhom === nhom).some(l => l.o.some(x => x.tt === 'thieu' || x.tt === 'mot_phan'))
    if (d.ma === 'bo_bao_cao_thue' && thieuNhom('bao_cao')) d.trangThai = 'thieu_ky'
    // Hóa đơn là nhóm cây: thiếu kỳ gắn cho CẢ NHÓM (gomCay đọc cờ nhomThieu), không đè lên từng thư mục tháng
    if (d.ma === 'hoa_don' && d.cha && thieuNhom('hoa_don')) d.nhomThieu = true
    else if (d.ma === 'hoa_don' && thieuNhom('hoa_don')) d.trangThai = 'thieu_ky'
  }
  const capMot = gomCay(dong).map(n => (n.loai === 'nhom' ? n.trangThai : n.d.trangThai))
  const oTong = {
    thuMuc: (quet.thuMuc || []).length,
    // Đếm theo THƯ MỤC CẤP 1 (dòng đơn hoặc nhóm cây) — khớp với những gì người xem thấy khi thu gọn
    daCo: capMot.filter(t => t === 'da_co').length,
    thieuKy: capMot.filter(t => t === 'thieu_ky' || t === 'chua_co').length,
    thieuO,
    kps: capMot.filter(t => t === 'kps').length,
    canXem: dong.reduce((s, d) => s + (d.canXem || 0), 0) + (opt.loiDoc || 0),
  }
  const tkTom = [...new Set(toKhai.filter(t => t.ky?.nam === nam).map(t => t.loai).filter(Boolean))].map(l => {
    const ds = toKhai.filter(t => t.loai === l && t.ky?.nam === nam && t.ky.loai !== 'N')
    const nam1 = toKhai.some(t => t.loai === l && t.ky?.nam === nam && t.ky.loai === 'N')
    return `${l} ${ds.length ? dsKy([...new Map(ds.map(t => [t.maKy, t.ky])).values()]) : ''}${nam1 ? 'năm' : ''}`.trim()
  })

  return { nam, kyKhai, dong, luoi, oTong, canhBao, toKhaiTom: tkTom }
}

// ── Gom dòng theo thư mục cha cho bảng dạng cây ──────────────────────────────

// Trạng thái của dòng cha = trạng thái "nặng" nhất trong các dòng con.
const MUC_NANG = ['thieu_ky', 'chua_co', 'can_xem', 'trong', 'la', 'da_co', 'kps', 'ghi_nhan', 'khong_co']

// dong (kiemKeNam) → [{ loai:'don', i, d } | { loai:'nhom', ten, con:[{ i, d }], trangThai, soFile, dinhDang, canXem, coThuMuc }]
// Một thư mục chỉ có MỘT thư mục con thì vẫn để dạng nhóm cho người dùng thấy đúng cây.
export function gomCay(dong) {
  const ra = []
  dong.forEach((d, i) => {
    if (!d.cha) { ra.push({ loai: 'don', i, d }); return }
    const cuoi = ra[ra.length - 1]
    if (cuoi?.loai === 'nhom' && cuoi.ten === d.cha) cuoi.con.push({ i, d })
    else ra.push({ loai: 'nhom', ten: d.cha, con: [{ i, d }] })
  })
  for (const n of ra) {
    if (n.loai !== 'nhom') continue
    const cd = n.con.map(c => c.d)
    n.trangThai = cd.some(d => d.nhomThieu) ? 'thieu_ky' : (MUC_NANG.find(t => cd.some(d => d.trangThai === t)) || cd[0].trangThai)
    n.moTa = cd.find(d => d.moTaNhom)?.moTaNhom || ''
    n.soFile = cd.every(d => d.soFile == null) ? null : cd.reduce((s, d) => s + (d.soFile || 0), 0)
    n.dinhDang = [...new Set(cd.flatMap(d => d.dinhDang || []))].sort()
    n.canXem = cd.reduce((s, d) => s + (d.canXem || 0), 0)
    n.coThuMuc = cd.some(d => d.coThuMuc)
  }
  return ra
}
