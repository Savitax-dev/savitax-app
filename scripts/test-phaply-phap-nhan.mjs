// Bộ kiểm (offline, dữ liệu giả) — dữ liệu pháp nhân lưu DB (sql/57) → hồ sơ đầu vào mẫu Word (lib/phaply/phapNhan.js).
//   node scripts/test-phaply-phap-nhan.mjs
// 1. Khứ hồi: hồ sơ giả của bộ kiểm Word → tách thành dòng DB → hoSoDauVao → chuanBiDuLieu phải RA GIỐNG HỆT bản gốc
//    (mọi thẻ của mọi mẫu điền đúng như khi dựng mẫu).  2. "Còn thiếu gì" bắt đúng các ca thiếu.
import { DU_LIEU_GIA } from './phaply-du-lieu-gia.mjs'
import { hoSoDauVao, conThieu } from '../lib/phaply/phapNhan.js'
import { chuanBiDuLieu } from '../lib/phaply/word/duLieu.js'
import { docCsv } from '../lib/phaply/csv.js'

let pass = 0, fail = 0
const ok = (dk, ten) => { if (dk) pass++; else { fail++; console.log('✗', ten) } }

// Nguoi (khuôn duLieu) → dòng legal_people
const veDb = p => ({
  ho_ten: p.ho_ten, gioi_tinh: p.gioi_tinh, ngay_sinh: p.ngay_sinh, dan_toc: p.dan_toc, quoc_tich: p.quoc_tich,
  loai_giay_to: p.loai_giay_to, so_giay_to: p.so_giay_to, ngay_cap: p.ngay_cap, noi_cap: p.noi_cap,
  thuong_tru: { ...p.thuong_tru, ma_xa: '26734', ma_tinh: '79' },
  lien_lac: p.lien_lac === p.thuong_tru ? {} : { ...p.lien_lac }, dien_thoai: p.dien_thoai, email: p.email,
})

function tachDb(hs) {
  const c = hs.cty
  const entity = {
    entity_type: hs.loai_hinh, name: c.ten, name_en: c.ten_nn, name_short: c.ten_viet_tat, tax_code: c.ma_so,
    tru_so_so_nha: c.tru_so.so_nha, tru_so_xa: c.tru_so.xa, tru_so_tinh: c.tru_so.tinh, tru_so_ma_xa: '26734', tru_so_ma_tinh: '79',
    phone: c.dien_thoai, email: c.email, fax: c.fax, website: c.website, von_dieu_le: String(c.von_dieu_le),
    menh_gia: c.menh_gia ?? null, so_lao_dong: c.so_lao_dong, mo_hinh: c.mo_hinh, csh_la_to_chuc: !!c.csh_la_to_chuc,
    co_ndt_nuoc_ngoai: !!hs.co_ndt_nuoc_ngoai, dien_thue_san: !!hs.dien_thue_san,
    phong_dkkd: null, co_quan_thue: null, // lấy từ gợi ý danh mục
    thue: hs.thue, so_sach: hs.so_sach, khau_hao: hs.khau_hao || null, quy_uoc_phieu: hs.quy_uoc_phieu,
  }
  const vaiTro = []
  const them = (vai, p, x = {}, i = 0) => p && vaiTro.push({ vai_tro: vai, thu_tu: i, person_id: p.so_giay_to, chuc_danh: p.chuc_danh || null, nguoi: veDb(p), ...x })
  them('dai_dien', hs.dai_dien)
  if (hs.giam_doc && hs.giam_doc !== hs.dai_dien) them('giam_doc', hs.giam_doc)
  them('chu_so_huu', hs.chu_so_huu); them('ke_toan', hs.ke_toan); them('thu_ky', hs.thu_ky)
  // thứ tự lưu đảo ngược để chắc hoSoDauVao sắp lại theo thu_tu
  ;[...(hs.thanh_vien || [])].reverse().forEach((v, j, a) => them('thanh_vien', v, { von_gop: String(v.von_gop), thoi_han_gop: v.thoi_han_gop, chu_tich: !!v.chu_tich, chuc_danh: null }, a.length - 1 - j))
  ;[...(hs.co_dong || [])].reverse().forEach((v, j, a) => them('co_dong', v, { so_co_phan: v.so_co_phan, thoi_han_gop: v.thoi_han_gop, chu_tich: !!v.chu_tich, chuc_danh: null }, a.length - 1 - j))
  const nganh = c.nganh.map((n, i) => ({ ma: n.ma, ten: n.ten, chi_tiet: n.chi_tiet || null, chinh: !!n.chinh, thu_tu: i }))
  return { entity, vaiTro, nganh, uyQuyen: veDb(hs.uy_quyen), goiY: { phong_dkkd: hs.phong_dkkd, co_quan_thue: hs.co_quan_thue } }
}

// Bộ giả chép nguyên người AN (chức danh "Giám đốc") vào danh sách cổ đông công ty cổ phần dù AN không làm giám đốc ở đó;
// DB chỉ mang chức danh theo vai trò thật → chuẩn hoá bản gốc trước khi so
const chuanHoa = hs => {
  const gd = new Set([hs.dai_dien?.so_giay_to, hs.giam_doc?.so_giay_to])
  const bo = v => (gd.has(v.so_giay_to) ? v : { ...v, chuc_danh: '' })
  return { ...hs, thanh_vien: hs.thanh_vien?.map(bo), co_dong: hs.co_dong?.map(bo) }
}
for (const [lh, goc0] of Object.entries(DU_LIEU_GIA)) {
  const goc = chuanHoa(goc0)
  // bộ giả dùng thư ký = nhân viên pháp lý; DB lưu thư ký như một vai trò riêng → khứ hồi vẫn phải khớp
  const dv = hoSoDauVao(tachDb(goc))
  const a = chuanBiDuLieu(goc), b = chuanBiDuLieu(dv)
  const lech = Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
  ok(!lech.length, `${lh}: khứ hồi lệch ${lech.length} thẻ: ${lech.slice(0, 8).map(k => `${k}=${JSON.stringify(a[k])}→${JSON.stringify(b[k])}`).join(' | ')}`)
  ok(conThieu(dv).filter(t => t.chan).length === 0, `${lh}: hồ sơ giả đủ dữ liệu mà vẫn báo thiếu: ${conThieu(dv).filter(t => t.chan).map(t => t.muc).join('; ')}`)
}

// Gợi ý cơ quan bị ghi đè bằng tay → lấy bản tay
{
  const d = tachDb(DU_LIEU_GIA['1tv'])
  d.entity.phong_dkkd = 'Phòng X'
  ok(hoSoDauVao(d).phong_dkkd === 'Phòng X', 'Phòng ĐKKD nhập tay phải thắng gợi ý')
  ok(hoSoDauVao({ ...d, entity: { ...d.entity, phong_dkkd: null } }).phong_dkkd === DU_LIEU_GIA['1tv'].phong_dkkd, 'Phòng ĐKKD trống → lấy gợi ý')
}
// Giám đốc trống → lấy người đại diện; liên lạc trống → thường trú
{
  const d = tachDb(DU_LIEU_GIA['1tv'])
  const dv = hoSoDauVao(d)
  ok(dv.giam_doc?.ho_ten === dv.dai_dien?.ho_ten, 'giám đốc trống phải lấy người đại diện')
  ok(chuanBiDuLieu(dv).dd_dia_chi_lien_lac === chuanBiDuLieu(dv).dd_dia_chi_thuong_tru, 'liên lạc trống = thường trú')
}

// Còn thiếu gì
const muc = (hs, o) => conThieu(hs, o).map(t => t.muc).join(' | ')
{
  const rong = hoSoDauVao({ entity: { entity_type: '2tv' } })
  const m = muc(rong)
  for (const can of ['Tên công ty', 'Địa chỉ trụ sở', 'Vốn điều lệ', 'Chưa có ngành nghề', 'Người đại diện', 'ít nhất 2 thành viên', 'Chủ tịch Hội đồng thành viên', 'Người được ủy quyền'])
    ok(m.includes(can), 'hồ sơ trống 2TV phải báo: ' + can)
  ok(!muc(hoSoDauVao({ entity: { entity_type: '1tv' } }), { dot: 'so' }).includes('Phần mềm kế toán'), 'đợt nộp sở không nhắc phần mềm kế toán')
}
{
  const d = tachDb(DU_LIEU_GIA['2tv'])
  d.vaiTro.find(v => v.vai_tro === 'thanh_vien').von_gop = '1'
  ok(muc(hoSoDauVao(d)).includes('Tổng vốn góp'), '2TV lệch vốn góp phải báo')
  d.vaiTro.filter(v => v.vai_tro === 'thanh_vien').forEach(v => { v.chu_tich = true })
  ok(muc(hoSoDauVao(d)).includes('Chủ tịch HĐTV — chỉ được 1'), '2TV hai chủ tịch phải báo')
}
{
  const d = tachDb(DU_LIEU_GIA.cp)
  d.vaiTro = d.vaiTro.filter(v => v.vai_tro !== 'co_dong' || v.thu_tu < 2)
  const m = muc(hoSoDauVao(d))
  ok(m.includes('ít nhất 3 cổ đông'), 'CP 2 cổ đông phải báo')
  ok(m.includes('Tổng giá trị cổ phần'), 'CP lệch vốn phải báo')
}
{
  const d = tachDb(DU_LIEU_GIA['1tv'])
  d.nganh.forEach(n => { n.chinh = false })
  ok(muc(hoSoDauVao(d)).includes('Chưa chọn ngành chính'), 'không có ngành chính phải báo')
  d.vaiTro.find(v => v.vai_tro === 'dai_dien').nguoi.so_giay_to = ''
  ok(muc(hoSoDauVao(d)).includes('số giấy tờ'), 'thiếu số CCCD phải báo')
  ok(muc(hoSoDauVao({ ...d, uyQuyen: null }), { dot: 'thue' }).includes('ủy quyền') === false, 'đợt thuế không cần người được ủy quyền')
}

// Bộ đọc CSV: ngoặc kép, dấu phẩy, "" trong ô, BOM, CRLF
{
  const r = docCsv('﻿a,b,c\r\n1,"x, y","he said ""hi"""\r\n2,,\n')
  ok(r.length === 2 && r[0].b === 'x, y' && r[0].c === 'he said "hi"' && r[1].a === '2' && r[1].c === '', 'docCsv đọc sai: ' + JSON.stringify(r))
}

console.log(`${pass} đạt, ${fail} hỏng`)
process.exit(fail ? 1 : 0)
