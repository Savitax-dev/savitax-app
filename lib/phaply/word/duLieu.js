// Phân hệ Pháp lý — đổi một hồ sơ (dạng có cấu trúc) thành bộ trường phẳng để điền vào mẫu Word.
// ĐÂY LÀ TỪ ĐIỂN TRƯỜNG DUY NHẤT: mẫu Word chỉ được dùng các thẻ mà chuanBiDuLieu() trả ra
// (scripts/test-phaply-word.mjs kiểm từng thẻ của từng mẫu). Cần trường mới → thêm ở đây trước.
//
// ─── HỒ SƠ ĐẦU VÀO ──────────────────────────────────────────────────────────────────────────────────────────
// { loai_hinh: '1tv'|'2tv'|'cp',
//   cty: { ten, ten_nn, ten_viet_tat, ma_so, tru_so: DiaChi, dien_thoai, fax, email, website,
//          von_dieu_le (số), menh_gia (CP, số), so_lao_dong, mo_hinh ('chu_tich'|'hdtv', chỉ 1TV),
//          nganh: [{ ten, chi_tiet, ma, chinh }] },
//   phong_dkkd (cột ten_ghi_ho_so của phong-dkkd.csv, VD "Phòng Đăng ký kinh doanh Thành phố Hồ Chí Minh"), co_quan_thue,
//   dien_thue_san (in sẵn MST + cơ quan thuế ở hồ sơ pháp lý ban đầu), co_ndt_nuoc_ngoai, cty.csh_la_to_chuc
//   dai_dien, giam_doc, chu_so_huu, ke_toan, uy_quyen, thu_ky: Nguoi
//   thanh_vien: [Nguoi & { von_gop, loai_tai_san, thoi_han_gop, chu_tich }]       (2TV)
//   co_dong:    [Nguoi & { so_co_phan, loai_co_phan, thoi_han_gop, chu_tich }]   (CP)
//   thue: { hach_toan, bctc_hop_nhat, nam_tc_tu, nam_tc_den, bot, pp_gtgt, bhxh, ngay_bat_dau },
//   so_sach: { hinh_thuc, pp_xuat_kho, pp_hang_ton, tt_tai_khoan, loai_hoa_don, nien_do_dau_tu, nien_do_dau_den,
//              ky ('thang'|'quy'|'nam'), phan_mem, ma_khoa },
//   khau_hao, quy_uoc_phieu,
//   ban_giao: { ngay ('YYYY-MM-DD'), nguoi_nhan, muc: [{ ten, so_luong, ghi_chu }], ghi_chu },   (Biên bản bàn giao)
//   ben_giao: { ten, dia_chi, mst, dien_thoai } (pháp nhân Savitax — lib/phaply/congTy.js) }
// Nguoi  = { ho_ten, gioi_tinh, ngay_sinh, dan_toc, quoc_tich, loai_giay_to, so_giay_to, ngay_cap, noi_cap,
//            thuong_tru: DiaChi, lien_lac: DiaChi, dien_thoai, email, chuc_danh }
// DiaChi = { so_nha, xa, tinh, quoc_gia }
//
// ─── TRƯỜNG RA (thẻ dùng trong mẫu) ─────────────────────────────────────────────────────────────────────────
// Người — tiền tố: dd_ (người đại diện theo pháp luật) · gd_ (giám đốc) · csh_ (chủ sở hữu 1TV) · ct_ (chủ tịch
//   HĐTV/HĐQT) · kt_ (kế toán trưởng/phụ trách KT) · uq_ (người được ủy quyền — nhân viên pháp lý) · tk_ (thư ký họp)
//   hậu tố: danh_xung (Ông/Bà) ho_ten gioi_tinh ngay_sinh dan_toc quoc_tich qt_bang dt_bang (trống khi giấy tờ là căn cước)
//           loai_giay_to giay_to_ngan (CCCD…) giay_to_so ("Thẻ Căn cước số"…) so_giay_to ngay_cap noi_cap
//           dia_chi_thuong_tru tt_so_nha tt_xa tt_tinh tt_quoc_gia  dia_chi_lien_lac ll_so_nha ll_xa ll_tinh ll_quoc_gia
//           dien_thoai email chuc_danh
// Người là TỔ CHỨC (sql/61, mọi tiền tố + phần tử danh sách): la_to_chuc, ma_so_dn, ngay_cap_dn, noi_cap_dn, dai_dien_ten (IN HOA),
//   dai_dien_chuc_danh — ho_ten = tên tổ chức (IN HOA), dia_chi_thuong_tru = địa chỉ trụ sở. la_ca_nhan = !la_to_chuc.
// Điều lệ bổ sung (25/11/2026): ds_dai_dien[] (người đại diện theo pháp luật: stt, …người, chuc_danh, la_chu_tich, la_gd, quyen_han),
//   so_dai_dien ('01'), so_dai_dien_chu, nhieu_dai_dien / mot_dai_dien; dai_dien_uq[] (người đại diện theo ủy quyền của tổ chức:
//   stt, …người, von_uy_quyen, von_uy_quyen_chu, ty_le_uq (trên phần vốn của tổ chức), ty_le_uq_vdl, thoi_diem_dai_dien, cua_ten),
//   so_nguoi_uq; thoi_han_hoat_dong, so_lan_hop_hdtv, dia_chi_cn_vpdd; thanh_vien[] / co_dong[] thêm nguoi_uq (tên người đại diện
//   theo ủy quyền nếu thành viên là tổ chức).
// Danh sách: thanh_vien[], co_dong[], huong_loi[], nganh[] — mỗi phần tử có các hậu tố trên KHÔNG tiền tố, thêm:
//   stt, von_gop, von_gop_chu, ty_le, so_phieu, loai_tai_san, thoi_han_gop, vai_tro (Thành viên / Chủ tịch HĐTV…),
//   so_co_phan, gia_tri_co_phan, loai_co_phan, chu_tich (đúng/sai)
//   huong_loi: tl_von_tt tl_von_gt tl_von_tong tl_cp_tt tl_cp_gt tl_cp_tong (chuỗi "36%" hoặc rỗng)
//   nganh: stt ten (có xuống dòng "Chi tiết: …") ma chinh ("X" hoặc rỗng)
// Xem cuối hàm chuanBiDuLieu để biết đủ tên.
import { numberToVietnameseWords } from '../../numberToWords.js'

const TIEN = n => (n == null || n === '' ? '' : Math.round(Number(n)).toLocaleString('de-DE')) // 1.000.000
// Tỷ lệ % làm tròn 3 chữ số thập phân, dấu phẩy thập phân (66,667%) — phòng pháp lý chốt 18/11/2026 (trước: 2 số, dấu chấm)
const tyLe = (a, b) => (b ? 100 * a / b : 0)
export const inTyLe = x => String(+(+x).toFixed(3)).replace('.', ',') + '%'
const PT = (a, b) => (b ? inTyLe(tyLe(a, b)) : '')
const chu = n => (n ? numberToVietnameseWords(n) + ' đồng' : '')
const hoa = s => (s || '').toLocaleUpperCase('vi-VN')
const soChu = n => (n ? numberToVietnameseWords(n).toLocaleLowerCase('vi-VN') : '') // 7 → "bảy"

export const NOI_CAP_CCCD = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội'
const laCanCuoc = loai => !loai || /căn cước|định danh/i.test(loai)

export function noiDiaChi(d) {
  if (!d) return ''
  return [d.so_nha, d.xa, d.tinh, d.quoc_gia || (d.so_nha || d.xa || d.tinh ? 'Việt Nam' : '')].filter(Boolean).join(', ')
}

function giayToSo(loai) {
  const l = String(loai || '').trim()
  if (!l || /^căn cước$/i.test(l)) return 'Thẻ Căn cước số'
  if (/^căn cước công dân$/i.test(l)) return 'Thẻ Căn cước công dân số'
  return l.charAt(0).toUpperCase() + l.slice(1) + ' số'
}

function nguoi(p = {}, tienTo = '') {
  const t = k => tienTo + k
  const tt = p.thuong_tru || {}, ll = p.lien_lac || p.thuong_tru || {}
  return {
    [t('danh_xung')]: p.gioi_tinh === 'Nữ' ? 'Bà' : p.gioi_tinh === 'Nam' ? 'Ông' : '',
    [t('ho_ten')]: hoa(p.ho_ten),
    [t('gioi_tinh')]: p.gioi_tinh || '',
    [t('ngay_sinh')]: p.ngay_sinh || '',
    [t('dan_toc')]: p.dan_toc || '',
    [t('quoc_tich')]: p.quoc_tich || '',
    [t('loai_giay_to')]: p.loai_giay_to || '',
    // tên ngắn của loại giấy tờ, in trong ô bảng Mẫu 6/7/10 ("CCCD số: …")
    [t('giay_to_ngan')]: ({ 'Căn cước công dân': 'CCCD', 'Chứng minh nhân dân': 'CMND' })[p.loai_giay_to] || p.loai_giay_to || '',
    [t('so_giay_to')]: p.so_giay_to || '',
    // nhãn số giấy tờ trong lời văn (Quyết định / Biên bản bổ nhiệm): "Thẻ Căn cước", "Thẻ Căn cước công dân", "Hộ chiếu",
    // "Chứng minh nhân dân" — theo đúng giấy tờ của người (trước 18/11/2026 in cố định "Thẻ Căn cước công dân")
    [t('giay_to_so')]: giayToSo(p.loai_giay_to),
    [t('ngay_cap')]: p.ngay_cap || '',
    [t('noi_cap')]: p.noi_cap || '',
    [t('dia_chi_thuong_tru')]: noiDiaChi(p.thuong_tru),
    [t('tt_so_nha')]: tt.so_nha || '', [t('tt_xa')]: tt.xa || '', [t('tt_tinh')]: tt.tinh || '',
    [t('tt_quoc_gia')]: tt.quoc_gia || (tt.tinh ? 'Việt Nam' : ''),
    [t('dia_chi_lien_lac')]: noiDiaChi(ll),
    // địa chỉ liên lạc bỏ ", Việt Nam" (ô bảng thành viên Điều lệ 2TV); địa chỉ nước ngoài vẫn giữ tên nước
    [t('dia_chi_lien_lac_ngan')]: [ll.so_nha, ll.xa, ll.tinh, ll.quoc_gia && ll.quoc_gia !== 'Việt Nam' ? ll.quoc_gia : ''].filter(Boolean).join(', '),
    [t('ll_so_nha')]: ll.so_nha || '', [t('ll_xa')]: ll.xa || '', [t('ll_tinh')]: ll.tinh || '',
    [t('ll_quoc_gia')]: ll.quoc_gia || (ll.tinh ? 'Việt Nam' : ''),
    [t('dien_thoai')]: p.dien_thoai || '',
    [t('email')]: p.email || '',
    [t('chuc_danh')]: p.chuc_danh || '',
    [t('chuc_danh_hoa')]: hoa(p.chuc_danh),
    // Quốc tịch / Dân tộc ở bảng Mẫu 6, 7, 10: pháp lý chốt 17/11/2026 — giấy tờ là căn cước thì ĐỂ TRỐNG, hộ chiếu /
    // giấy tờ khác thì điền
    // người là TỔ CHỨC (sql/61)
    [t('la_to_chuc')]: !!p.la_to_chuc, [t('la_ca_nhan')]: !p.la_to_chuc,
    [t('ma_so_dn')]: p.ma_so_dn || '', [t('ngay_cap_dn')]: p.ngay_cap_dn || '', [t('noi_cap_dn')]: p.noi_cap_dn || '',
    [t('dai_dien_ten')]: hoa(p.dai_dien_ten), [t('dai_dien_chuc_danh')]: p.dai_dien_chuc_danh || '',
    [t('qt_bang')]: laCanCuoc(p.loai_giay_to) ? '' : p.quoc_tich || '',
    [t('dt_bang')]: laCanCuoc(p.loai_giay_to) ? '' : p.dan_toc || '',
  }
}

function banGiao(bg = {}, sv = {}) {
  const [y, m, d] = String(bg.ngay || '').split('-')
  return {
    bg_ngay_d: d || '……', bg_thang: m || '……', bg_nam: y || '………',
    bg_nguoi_nhan: bg.nguoi_nhan || '', bg_nguoi_nhan_hoa: hoa(bg.nguoi_nhan),
    bg_muc: (bg.muc || []).map((x, i) => ({ stt: i + 1, ten: x.ten || '', so_luong: x.so_luong || '', ghi_chu: x.ghi_chu || '' })),
    bg_ghi_chu: bg.ghi_chu || '', bg_co_ghi_chu: !!bg.ghi_chu,
    sv_ten: hoa(sv.ten), sv_dia_chi: sv.dia_chi || '', sv_mst: sv.mst || '', sv_dien_thoai: sv.dien_thoai || '',
  }
}

const CHU_TICH = { '2tv': 'Chủ tịch Hội đồng thành viên', cp: 'Chủ tịch Hội đồng quản trị' }

// Điều lệ bổ sung: nhiều người đại diện theo pháp luật + người đại diện theo ủy quyền của chủ sở hữu / thành viên là tổ chức
function dieuLeBoSung(hs, vdl, menhGia) {
  const dsDd = (hs.ds_dai_dien?.length ? hs.ds_dai_dien : hs.dai_dien ? [hs.dai_dien] : []).map((p, i) => ({
    ...nguoi(p), stt: i + 1, chuc_danh: p.chuc_danh || '', quyen_han: p.quyen_han || '',
    la_chu_tich: /chủ tịch/i.test(p.chuc_danh || ''), la_gd: /giám đốc/i.test(p.chuc_danh || '') && !/chủ tịch/i.test(p.chuc_danh || ''),
    co_quyen_han: !!String(p.quyen_han || '').trim(),
  }))
  // phần vốn của tổ chức mà người đại diện theo ủy quyền đứng tên: 1TV = cả vốn điều lệ; 2TV / CP = phần của thành viên / cổ đông đó
  const vonCua = id => {
    const tv = hs.thanh_vien?.find(v => v.person_id === id)
    if (tv) return Number(tv.von_gop) || 0
    const cd = hs.co_dong?.find(v => v.person_id === id)
    if (cd) return (Number(cd.so_co_phan) || 0) * menhGia
    return vdl
  }
  const dsUq = (hs.dai_dien_uy_quyen || []).map((u, i) => {
    const goc = vonCua(u.cua_person_id) || vdl
    return {
      ...nguoi(u), stt: i + 1, cua_ten: hoa(u.cua_ten || hs.chu_so_huu?.ho_ten),
      von_uy_quyen: TIEN(u.von_uy_quyen), von_uy_quyen_chu: chu(u.von_uy_quyen),
      ty_le_uq: PT(u.von_uy_quyen || 0, goc), ty_le_uq_vdl: PT(u.von_uy_quyen || 0, vdl),
      thoi_diem_dai_dien: u.thoi_diem_dai_dien || 'Kể từ ngày được cấp Giấy chứng nhận đăng ký doanh nghiệp',
    }
  })
  const cty = hs.cty || {}
  return {
    ds_dai_dien: dsDd, so_dai_dien: String(dsDd.length || 1).padStart(2, '0'), so_dai_dien_chu: soChu(dsDd.length || 1),
    nhieu_dai_dien: dsDd.length > 1, mot_dai_dien: dsDd.length <= 1,
    dai_dien_uq: dsUq, so_nguoi_uq: String(dsUq.length).padStart(2, '0'), so_nguoi_uq_chu: soChu(dsUq.length),
    co_nguoi_uq: dsUq.length > 0, nhieu_nguoi_uq: dsUq.length > 1,
    thoi_han_hoat_dong: cty.thoi_han_hoat_dong || '50 năm',
    so_lan_hop_hdtv: cty.so_lan_hop_hdtv || '01',
    dia_chi_cn_vpdd: cty.dia_chi_cn_vpdd || '', co_cn_vpdd: !!String(cty.dia_chi_cn_vpdd || '').trim(),
    csh_to_chuc: !!cty.csh_la_to_chuc,
    // thành viên 2TV / cổ đông là TỔ CHỨC đầu tiên (Văn bản cử người đại diện phần vốn góp) — tiền tố tc_
    ...(() => {
      const ds = [...(hs.thanh_vien || []).map(v => ({ ...v, _von: Number(v.von_gop) || 0 })), ...(hs.co_dong || []).map(v => ({ ...v, _von: (Number(v.so_co_phan) || 0) * menhGia }))]
      const tc = ds.find(v => v.la_to_chuc)
      return { co_tc_gop_von: !!tc, ...nguoi(tc || {}, 'tc_'), tc_von: TIEN(tc?._von), tc_von_chu: chu(tc?._von), tc_ty_le: tc ? PT(tc._von, vdl) : '',
        tc_uq: tc ? dsUq.filter((u, i) => (hs.dai_dien_uy_quyen || [])[i]?.cua_person_id === tc.person_id) : [] }
    })(),
  }
}

export function chuanBiDuLieu(hs) {
  const lh = hs.loai_hinh
  const cty = hs.cty || {}
  const vdl = Number(cty.von_dieu_le) || 0
  const quyUoc = Number(hs.quy_uoc_phieu) || 10000
  const menhGia = Number(cty.menh_gia) || 10000

  const uqCua = id => (hs.dai_dien_uy_quyen || []).filter(u => id && u.cua_person_id === id).map(u => hoa(u.ho_ten)).join(', ')
  const thanhVien = (hs.thanh_vien || []).map((v, i) => ({
    nguoi_uq: uqCua(v.person_id),
    ...nguoi(v), stt: i + 1, chu_tich: !!v.chu_tich,
    vai_tro: v.chu_tich ? CHU_TICH['2tv'] : 'Thành viên',
    von_gop: TIEN(v.von_gop), von_gop_chu: chu(v.von_gop), ty_le: PT(v.von_gop, vdl), ty_le_so: tyLe(v.von_gop || 0, vdl),
    so_phieu: TIEN(Math.round((v.von_gop || 0) / quyUoc)),
    loai_tai_san: v.loai_tai_san || 'Đồng Việt Nam', thoi_han_gop: v.thoi_han_gop || '',
  }))
  const tongCp = Math.round(vdl / menhGia)
  const coDong = (hs.co_dong || []).map((v, i) => {
    const gt = (v.so_co_phan || 0) * menhGia
    return {
      ...nguoi(v), stt: i + 1, chu_tich: !!v.chu_tich, nguoi_uq: uqCua(v.person_id),
      vai_tro: v.chu_tich ? CHU_TICH.cp : 'Cổ đông sáng lập',
      so_co_phan: TIEN(v.so_co_phan), gia_tri_co_phan: TIEN(gt), von_gop: TIEN(gt), von_gop_chu: chu(gt),
      ty_le: PT(v.so_co_phan || 0, tongCp), ty_le_so: tyLe(v.so_co_phan || 0, tongCp), so_phieu: TIEN(Math.round(gt / quyUoc)),
      loai_co_phan: v.loai_co_phan || 'Cổ phần phổ thông', loai_tai_san: v.loai_tai_san || 'Đồng Việt Nam',
      thoi_han_gop: v.thoi_han_gop || '',
    }
  })

  // Chủ sở hữu hưởng lợi (Mẫu 10): cá nhân sở hữu trực tiếp từ 25% vốn điều lệ / cổ phần có quyền biểu quyết
  let huongLoi = []
  if (lh === '1tv' && hs.chu_so_huu) huongLoi = [{ ...nguoi(hs.chu_so_huu), tl_von_tt: '100%', tl_von_gt: '', tl_von_tong: '100%', tl_cp_tt: '', tl_cp_gt: '', tl_cp_tong: '' }]
  else if (lh === '2tv') huongLoi = thanhVien.filter(v => v.ty_le_so >= 25).map(v => ({ ...v, tl_von_tt: v.ty_le, tl_von_gt: '', tl_von_tong: v.ty_le, tl_cp_tt: '', tl_cp_gt: '', tl_cp_tong: '' }))
  else if (lh === 'cp') huongLoi = coDong.filter(v => v.ty_le_so >= 25).map(v => ({ ...v, tl_von_tt: '', tl_von_gt: '', tl_von_tong: '', tl_cp_tt: v.ty_le, tl_cp_gt: '', tl_cp_tong: v.ty_le }))
  huongLoi = huongLoi.map((v, i) => ({ ...v, stt: i + 1 }))

  const chuTich = (lh === '2tv' ? hs.thanh_vien : lh === 'cp' ? hs.co_dong : null)?.find(v => v.chu_tich)
  const thue = hs.thue || {}, so = hs.so_sach || {}
  const tongPhieu = lh === '2tv' ? Math.round(vdl / quyUoc) : lh === 'cp' ? Math.round(vdl / quyUoc) : 0

  return {
    loai_hinh: lh, la_1tv: lh === '1tv', la_2tv: lh === '2tv', la_cp: lh === 'cp',
    loai_hinh_ten: { '1tv': 'Công ty trách nhiệm hữu hạn một thành viên', '2tv': 'Công ty trách nhiệm hữu hạn hai thành viên trở lên', cp: 'Công ty cổ phần' }[lh] || '',

    // công ty
    ten_cty: hoa(cty.ten), ten_cty_nn: hoa(cty.ten_nn), ten_cty_viet_tat: hoa(cty.ten_viet_tat), ma_dn: cty.ma_so || '',
    tru_so_so_nha: cty.tru_so?.so_nha || '', tru_so_xa: cty.tru_so?.xa || '', tru_so_tinh: cty.tru_so?.tinh || '',
    tru_so_quoc_gia: cty.tru_so?.quoc_gia || 'Việt Nam', dia_chi_tru_so: noiDiaChi(cty.tru_so),
    cty_dien_thoai: cty.dien_thoai || '', cty_fax: cty.fax || '', cty_email: cty.email || '', cty_website: cty.website || '',
    von_dieu_le: TIEN(vdl), von_dieu_le_chu: chu(vdl), so_lao_dong: cty.so_lao_dong ?? '',
    // Mẫu 2 — ô "Mô hình tổ chức công ty": pháp lý chốt 17/11/2026 CHỈ đánh dấu khi chủ sở hữu là tổ chức
    mo_hinh_chu_tich: !!cty.csh_la_to_chuc && cty.mo_hinh === 'chu_tich', mo_hinh_hdtv: !!cty.csh_la_to_chuc && cty.mo_hinh === 'hdtv',
    // Mẫu 4 — câu "Xin gửi kèm cam kết của nhà đầu tư nước ngoài…" chỉ in khi có nhà đầu tư nước ngoài (chốt 17/11/2026)
    co_ndt_nn: !!hs.co_ndt_nuoc_ngoai,
    // Giấy giới thiệu / Khấu hao / Sổ sách / Ủy quyền thuế: mặc định ĐỂ TRỐNG "Kính gửi" + MST cho viết tay (chốt 17/11/2026);
    // khách yêu cầu điền đủ sau khi có GPKD thì hồ sơ bật dien_thue_san
    dien_thue_san: !!hs.dien_thue_san,
    nganh: (cty.nganh || []).map((n, i) => ({ stt: i + 1, ten: n.chi_tiet ? `${n.ten}\nChi tiết: ${n.chi_tiet}` : n.ten, ma: n.ma, chinh: n.chinh ? 'X' : '' })),
    phong_dkkd: hs.phong_dkkd || '', co_quan_thue: hs.co_quan_thue || '',

    // vốn: nguồn vốn + tài sản góp (Savitax hầu như chỉ có vốn tư nhân, góp bằng Đồng Việt Nam)
    nv_tu_nhan: TIEN(vdl), nv_tu_nhan_tl: vdl ? '100%' : '', nv_tong: TIEN(vdl), nv_tong_tl: vdl ? '100%' : '',
    ts_dong_vn: TIEN(vdl), ts_dong_vn_tl: vdl ? '100%' : '', ts_tong: TIEN(vdl), ts_tong_tl: vdl ? '100%' : '',

    // cổ phần (CP)
    menh_gia: TIEN(menhGia), tong_co_phan: TIEN(tongCp), cp_pho_thong: TIEN(tongCp), cp_pho_thong_gt: TIEN(vdl),
    // Mẫu 4 mục 7 — tỉ lệ so với vốn điều lệ (Savitax chỉ có cổ phần phổ thông → 100%)
    cp_pho_thong_tl: vdl ? '100%' : '', cp_tong_tl: vdl ? '100%' : '',
    // Điều lệ CP: mệnh giá bằng chữ, số cổ đông / số bản điều lệ (01 bản ĐKKD + 01 bản lưu + mỗi cổ đông 01 bản),
    // chỗ ký trang cuối xếp từng cặp 2 cổ đông một hàng (co_dong_ky: [{ho_ten_1, ho_ten_2}])
    menh_gia_chu: chu(menhGia),
    so_co_dong: String(coDong.length).padStart(2, '0'), so_co_dong_chu: soChu(coDong.length),
    dl_so_ban_cp: String(coDong.length + 2).padStart(2, '0'), dl_so_ban_cp_chu: soChu(coDong.length + 2),
    co_dong_ky: Array.from({ length: Math.ceil(coDong.length / 2) }, (_, i) => ({ ho_ten_1: coDong[2 * i].ho_ten, ho_ten_2: coDong[2 * i + 1]?.ho_ten || '' })),
    // chức danh người điều hành dùng trong lời văn điều lệ: "Tổng giám đốc" nếu hồ sơ ghi vậy, còn lại "Giám đốc"
    // Điều lệ 2TV: số bản (01 bản ĐKKD + 01 bản lưu + mỗi thành viên 01 bản); chỗ ký trang cuối: từng cặp 2 thành viên
    // một hàng (thanh_vien_ky: [{ho_ten_1, ho_ten_2}]), thành viên lẻ cuối cùng đứng giữa (thanh_vien_ky_le: [{ho_ten_le}])
    dl_so_ban_2tv: String(thanhVien.length + 2).padStart(2, '0'),
    thanh_vien_ky: Array.from({ length: Math.floor(thanhVien.length / 2) }, (_, i) => ({ ho_ten_1: thanhVien[2 * i].ho_ten, ho_ten_2: thanhVien[2 * i + 1].ho_ten })),
    thanh_vien_ky_le: thanhVien.length % 2 ? [{ ho_ten_le: thanhVien[thanhVien.length - 1].ho_ten }] : [],
    chuc_danh_gd: /tổng giám đốc/i.test((hs.giam_doc || hs.dai_dien || {}).chuc_danh || '') ? 'Tổng giám đốc' : 'Giám đốc',

    // người
    ...nguoi(hs.dai_dien, 'dd_'),
    ...nguoi(hs.giam_doc || hs.dai_dien, 'gd_'),
    ...nguoi(hs.chu_so_huu, 'csh_'),
    ...nguoi(chuTich || hs.chu_tich, 'ct_'),
    ...nguoi(hs.ke_toan, 'kt_'),
    ...nguoi(hs.uy_quyen, 'uq_'),
    ...nguoi(hs.thu_ky, 'tk_'),
    thanh_vien: thanhVien, co_dong: coDong, huong_loi: huongLoi,

    // Điều lệ bổ sung (25/11/2026)
    ...dieuLeBoSung(hs, vdl, menhGia),

    // họp (biên bản HĐTV/HĐQT)
    quy_uoc_phieu: TIEN(quyUoc), tong_phieu: TIEN(tongPhieu),

    // đăng ký thuế trên Mẫu 2/3/4 (ô đánh dấu)
    ngay_bat_dau_hd: thue.ngay_bat_dau || '',
    hach_toan_doc_lap: (thue.hach_toan || 'doc_lap') === 'doc_lap', hach_toan_phu_thuoc: thue.hach_toan === 'phu_thuoc',
    bctc_hop_nhat: !!thue.bctc_hop_nhat,
    nam_tc_tu: thue.nam_tc_tu || '01/01', nam_tc_den: thue.nam_tc_den || '31/12',
    bot_co: !!thue.bot, bot_khong: !thue.bot,
    gtgt_khau_tru: (thue.pp_gtgt || 'khau_tru') === 'khau_tru', gtgt_truc_tiep_gtgt: thue.pp_gtgt === 'truc_tiep_gtgt',
    gtgt_truc_tiep_doanh_so: thue.pp_gtgt === 'truc_tiep_doanh_so', gtgt_khong_nop: thue.pp_gtgt === 'khong_nop',
    bhxh_hang_thang: (thue.bhxh || 'hang_thang') === 'hang_thang', bhxh_3_thang: thue.bhxh === '3_thang', bhxh_6_thang: thue.bhxh === '6_thang',

    // sổ sách kế toán + khấu hao (hồ sơ pháp lý ban đầu)
    so_hinh_thuc: so.hinh_thuc || 'Nhật ký chung', so_pp_xuat_kho: so.pp_xuat_kho || 'Bình quân gia quyền',
    so_pp_hang_ton: so.pp_hang_ton || 'Thường xuyên',
    so_tt_tai_khoan: so.tt_tai_khoan || 'Theo Thông tư số 99/2025/TT-BTC ban hành ngày 27 tháng 10 năm 2025 của Bộ Tài chính',
    so_loai_hoa_don: so.loai_hoa_don || 'Hóa đơn giá trị gia tăng',
    so_nien_do_dau_tu: so.nien_do_dau_tu || '', so_nien_do_dau_den: so.nien_do_dau_den || '',
    ky_thang: so.ky === 'thang', ky_quy: so.ky === 'quy', ky_nam: (so.ky || 'nam') === 'nam',
    so_phan_mem: so.phan_mem || '', so_ma_khoa: so.ma_khoa || 'Chương trình mở',
    pp_khau_hao: hs.khau_hao || 'Đường thẳng',

    // biên bản bàn giao (BBBG) — bên giao = Savitax (người giao = uq_: nhân viên phụ trách), bên nhận = doanh nghiệp
    ...banGiao(hs.ban_giao, hs.ben_giao),
  }
}
