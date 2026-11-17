// Phân hệ Pháp lý — dữ liệu pháp nhân lưu trong DB (sql/57) → "hồ sơ đầu vào" của mẫu Word (lib/phaply/word/duLieu.js),
// và bước kiểm "Còn thiếu gì". Hàm THUẦN (không đọc DB) để kiểm offline: scripts/test-phaply-phap-nhan.mjs.
// Đổi cột sql/57 thì sửa ở đây; đổi trường mẫu Word thì sửa duLieu.js — hai file nói chuyện qua đúng khuôn đầu vào.

export const VAI_TRO = {
  dai_dien: 'Người đại diện theo pháp luật', giam_doc: 'Giám đốc / Tổng giám đốc', chu_so_huu: 'Chủ sở hữu',
  thanh_vien: 'Thành viên góp vốn', co_dong: 'Cổ đông sáng lập', ke_toan: 'Kế toán trưởng / phụ trách kế toán',
  thu_ky: 'Thư ký cuộc họp',
}
// Vai trò dùng được theo loại hình (giao diện chỉ hiện các vai trò này)
export const VAI_TRO_THEO_LOAI = {
  '1tv': ['dai_dien', 'giam_doc', 'chu_so_huu', 'ke_toan'],
  '2tv': ['dai_dien', 'giam_doc', 'thanh_vien', 'ke_toan', 'thu_ky'],
  cp: ['dai_dien', 'giam_doc', 'co_dong', 'ke_toan', 'thu_ky'],
}
export const CHUC_DANH = ['Giám đốc', 'Tổng giám đốc', 'Chủ tịch công ty', 'Chủ tịch Hội đồng thành viên', 'Chủ tịch Hội đồng quản trị']
export const THOI_HAN_GOP = 'Trong thời hạn 90 ngày kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp'

const coChu = v => v != null && String(v).trim() !== ''
const rongObj = o => !o || !Object.values(o).some(coChu)

// Địa chỉ lưu DB { so_nha, ma_xa, xa, ma_tinh, tinh, quoc_gia } → DiaChi của duLieu.js
export const diaChi = d => (rongObj(d) ? undefined : { so_nha: d.so_nha || '', xa: d.xa || '', tinh: d.tinh || '', quoc_gia: d.quoc_gia || '' })

// Một dòng legal_people (+ chức danh của vai trò) → Nguoi của duLieu.js
export function nguoiTuDb(p, them = {}) {
  if (!p) return undefined
  const tt = diaChi(p.thuong_tru)
  return {
    ho_ten: p.ho_ten || '', gioi_tinh: p.gioi_tinh || '', ngay_sinh: p.ngay_sinh || '', dan_toc: p.dan_toc || '',
    quoc_tich: p.quoc_tich || '', loai_giay_to: p.loai_giay_to || '', so_giay_to: p.so_giay_to || '',
    ngay_cap: p.ngay_cap || '', noi_cap: p.noi_cap || '',
    // liên lạc để trống = giống thường trú (duLieu.js tự lấy thường trú)
    thuong_tru: tt, lien_lac: diaChi(p.lien_lac),
    dien_thoai: p.dien_thoai || '', email: p.email || '', ...them,
  }
}

const theoThuTu = (a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0)

// entity: dòng legal_entities · vaiTro: [{ ...legal_entity_people, nguoi: legal_people }] · nganh: legal_entity_industries
// uyQuyen: legal_people của nhân viên pháp lý phụ trách · goiY: { phong_dkkd, co_quan_thue } suy từ địa chỉ trụ sở
export function hoSoDauVao({ entity: e = {}, vaiTro = [], nganh = [], uyQuyen = null, goiY = {} }) {
  const theoVai = k => vaiTro.filter(v => v.vai_tro === k && v.nguoi).sort(theoThuTu)
  const mot = k => { const v = theoVai(k)[0]; return v ? nguoiTuDb(v.nguoi, { chuc_danh: v.chuc_danh || '' }) : undefined }
  const daiDien = mot('dai_dien')
  // thành viên / cổ đông kiêm đại diện, giám đốc thì mang theo chức danh đó (ô chức danh trong bảng danh sách)
  const chucDanhCua = new Map(vaiTro.filter(v => ['dai_dien', 'giam_doc'].includes(v.vai_tro) && v.chuc_danh).map(v => [v.person_id, v.chuc_danh]))
  const cd = v => v.chuc_danh || chucDanhCua.get(v.person_id) || ''
  return {
    loai_hinh: e.entity_type,
    cty: {
      ten: e.name || '', ten_nn: e.name_en || '', ten_viet_tat: e.name_short || '', ma_so: e.tax_code || '',
      tru_so: diaChi({ so_nha: e.tru_so_so_nha, xa: e.tru_so_xa, tinh: e.tru_so_tinh }),
      dien_thoai: e.phone || '', fax: e.fax || '', email: e.email || '', website: e.website || '',
      von_dieu_le: e.von_dieu_le == null ? null : Number(e.von_dieu_le),
      menh_gia: e.menh_gia == null ? null : Number(e.menh_gia),
      so_lao_dong: e.so_lao_dong ?? '', mo_hinh: e.mo_hinh || '', csh_la_to_chuc: !!e.csh_la_to_chuc,
      nganh: [...nganh].sort(theoThuTu).map(n => ({ ma: n.ma, ten: n.ten, chi_tiet: n.chi_tiet || '', chinh: !!n.chinh })),
    },
    phong_dkkd: e.phong_dkkd || goiY.phong_dkkd || '',
    co_quan_thue: e.co_quan_thue || goiY.co_quan_thue || '',
    dien_thue_san: !!e.dien_thue_san, co_ndt_nuoc_ngoai: !!e.co_ndt_nuoc_ngoai,
    dai_dien: daiDien, giam_doc: mot('giam_doc') || daiDien, chu_so_huu: mot('chu_so_huu'),
    ke_toan: mot('ke_toan'), thu_ky: mot('thu_ky'),
    uy_quyen: nguoiTuDb(uyQuyen),
    thanh_vien: theoVai('thanh_vien').map(v => ({ ...nguoiTuDb(v.nguoi, { chuc_danh: cd(v) }), von_gop: Number(v.von_gop) || 0,
      loai_tai_san: v.loai_tai_san || '', thoi_han_gop: v.thoi_han_gop || '', chu_tich: !!v.chu_tich })),
    co_dong: theoVai('co_dong').map(v => ({ ...nguoiTuDb(v.nguoi, { chuc_danh: cd(v) }), so_co_phan: Number(v.so_co_phan) || 0,
      loai_co_phan: v.loai_co_phan || '', loai_tai_san: v.loai_tai_san || '', thoi_han_gop: v.thoi_han_gop || '', chu_tich: !!v.chu_tich })),
    thue: e.thue || {}, so_sach: e.so_sach || {}, khau_hao: e.khau_hao || '',
    quy_uoc_phieu: e.quy_uoc_phieu == null ? undefined : Number(e.quy_uoc_phieu),
  }
}

// ─── Còn thiếu gì ────────────────────────────────────────────────────────────────────────────────────────
// Trả [{ nhom, muc, chan }] — chan = true: thiếu thì mẫu in ra chỗ chấm ở chỗ quan trọng (vẫn xuất được, nhân viên tự
// quyết viết tay); false = nhắc nhẹ. dot: 'so' (nộp Phòng ĐKKD) | 'thue' (hồ sơ pháp lý ban đầu) | undefined = cả hai.
const TRUONG_NGUOI = [['ho_ten', 'họ tên'], ['gioi_tinh', 'giới tính'], ['ngay_sinh', 'ngày sinh'], ['so_giay_to', 'số giấy tờ'],
  ['ngay_cap', 'ngày cấp'], ['noi_cap', 'nơi cấp']]

function thieuNguoi(p, ten) {
  if (!p) return [`chưa có ${ten}`]
  const ra = TRUONG_NGUOI.filter(([k]) => !coChu(p[k])).map(([, n]) => n)
  const tt = p.thuong_tru || {}
  if (!coChu(tt.so_nha) || !coChu(tt.xa) || !coChu(tt.tinh)) ra.push('địa chỉ thường trú')
  return ra.length ? [`${ten}${p.ho_ten ? ' (' + p.ho_ten + ')' : ''}: thiếu ${ra.join(', ')}`] : []
}

export function conThieu(hs, { dot } = {}) {
  const ra = []
  const them = (nhom, muc, chan = true) => ra.push({ nhom, muc, chan })
  const c = hs.cty || {}, lh = hs.loai_hinh
  const vdl = Number(c.von_dieu_le) || 0
  const so = !dot || dot === 'so', thue = !dot || dot === 'thue'

  // Doanh nghiệp
  if (!coChu(c.ten)) them('Doanh nghiệp', 'Tên công ty')
  const ts = c.tru_so || {}
  if (!coChu(ts.so_nha) || !coChu(ts.xa) || !coChu(ts.tinh)) them('Doanh nghiệp', 'Địa chỉ trụ sở (số nhà + phường/xã + tỉnh)')
  if (!coChu(c.dien_thoai)) them('Doanh nghiệp', 'Điện thoại công ty')
  if (!vdl) them('Doanh nghiệp', 'Vốn điều lệ')
  if (lh === 'cp' && !Number(c.menh_gia)) them('Doanh nghiệp', 'Mệnh giá cổ phần (thường 10.000 đ)', false)
  if (so && !coChu(c.so_lao_dong)) them('Doanh nghiệp', 'Số lao động dự kiến', false)
  if (so && !coChu(hs.phong_dkkd)) them('Doanh nghiệp', 'Phòng Đăng ký kinh doanh (chọn tỉnh của trụ sở)')
  if (thue && !coChu(c.ma_so)) them('Doanh nghiệp', 'Mã số doanh nghiệp (có sau khi được cấp GCN ĐKDN)', !!hs.dien_thue_san)
  if (thue && hs.dien_thue_san && !coChu(hs.co_quan_thue)) them('Doanh nghiệp', 'Cơ quan thuế quản lý (chọn phường/xã của trụ sở)')

  // Ngành nghề
  const ng = c.nganh || []
  if (!ng.length) them('Ngành nghề', 'Chưa có ngành nghề nào')
  else {
    const chinh = ng.filter(n => n.chinh).length
    if (chinh !== 1) them('Ngành nghề', chinh ? `Đang đánh dấu ${chinh} ngành chính — chỉ được 1` : 'Chưa chọn ngành chính')
    const trung = ng.map(n => n.ma).filter((m, i, a) => a.indexOf(m) !== i)
    if (trung.length) them('Ngành nghề', 'Trùng mã ngành ' + [...new Set(trung)].join(', '), false)
  }

  // Người
  for (const m of thieuNguoi(hs.dai_dien, 'Người đại diện theo pháp luật')) them('Người', m)
  if (lh === '1tv') for (const m of thieuNguoi(hs.chu_so_huu, 'Chủ sở hữu')) them('Người', m)
  if (so && !hs.ke_toan) them('Người', 'Chưa có kế toán trưởng / phụ trách kế toán (Mẫu 2/3/4 để trống)', false)
  if (lh === '2tv') {
    const tv = hs.thanh_vien || []
    if (tv.length < 2) them('Người', `Công ty TNHH 2TV cần ít nhất 2 thành viên (đang có ${tv.length})`)
    tv.forEach((v, i) => thieuNguoi(v, `Thành viên ${i + 1}`).forEach(m => them('Người', m)))
    const tong = tv.reduce((s, v) => s + (Number(v.von_gop) || 0), 0)
    if (vdl && tong !== vdl) them('Vốn', `Tổng vốn góp ${tong.toLocaleString('de-DE')} ≠ vốn điều lệ ${vdl.toLocaleString('de-DE')}`)
    const ct = tv.filter(v => v.chu_tich).length
    if (ct !== 1) them('Người', ct ? `Đang có ${ct} Chủ tịch HĐTV — chỉ được 1` : 'Chưa chọn Chủ tịch Hội đồng thành viên')
    if (thue && !hs.thu_ky) them('Người', 'Chưa có thư ký cuộc họp (biên bản họp HĐTV để trống)', false)
  }
  if (lh === 'cp') {
    const cd = hs.co_dong || []
    if (cd.length < 3) them('Người', `Công ty cổ phần cần ít nhất 3 cổ đông sáng lập (đang có ${cd.length})`)
    cd.forEach((v, i) => thieuNguoi(v, `Cổ đông ${i + 1}`).forEach(m => them('Người', m)))
    const menh = Number(c.menh_gia) || 10000
    const tong = cd.reduce((s, v) => s + (Number(v.so_co_phan) || 0), 0) * menh
    if (vdl && tong !== vdl) them('Vốn', `Tổng giá trị cổ phần ${tong.toLocaleString('de-DE')} ≠ vốn điều lệ ${vdl.toLocaleString('de-DE')}`)
    const ct = cd.filter(v => v.chu_tich).length
    if (ct !== 1) them('Người', ct ? `Đang có ${ct} Chủ tịch HĐQT — chỉ được 1` : 'Chưa chọn Chủ tịch Hội đồng quản trị')
    if (thue && !hs.thu_ky) them('Người', 'Chưa có thư ký cuộc họp (biên bản họp HĐQT để trống)', false)
  }
  if (so) for (const m of thieuNguoi(hs.uy_quyen, 'Người được ủy quyền (nhân viên pháp lý phụ trách)')) them('Người', m)

  // Hồ sơ pháp lý ban đầu
  if (thue) {
    const ss = hs.so_sach || {}
    if (!coChu(ss.phan_mem)) them('Sổ sách kế toán', 'Phần mềm kế toán', false)
    if (!coChu(ss.nien_do_dau_tu)) them('Sổ sách kế toán', 'Niên độ kế toán đầu tiên (từ ngày)', false)
  }
  return ra
}
