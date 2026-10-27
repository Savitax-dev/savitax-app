// Nối bộ máy Rủi ro thuế với thư mục công ty trên Drive (dùng chung kết quả quét lib/phanTich/thuMuc.js quetNam).
// CHỈ ĐỌC (tay.getFile). Mỗi năm soát cần dữ liệu năm đó + năm trước (số đầu năm, [22] ↔ [43], lỗ chuyển…), thêm
// năm sau vì quyết toán / BCTC nộp tháng 3 năm sau có khi để ở thư mục năm sau.
//
// QUÉT RỘNG, không bám cây chuẩn: rủi ro thuế chủ yếu soát năm cũ (≤ 2025), mà thư mục năm cũ xếp tự do
// (thực tế: "QUÝ 4.2024\", "BCTC_2024\", tờ khai để thẳng trong thư mục năm…). Nên đi hết cây thư mục năm và
// nhận loại theo NỘI DUNG file (mã tờ khai trong XML), năm theo nội dung, không theo tên thư mục:
//   • mọi .xml — tờ khai 01/GTGT, 03/TNDN, BCTC XML; XML khác (05/KK, thông báo…) tự bỏ qua;
//   • Excel chỉ khi đường dẫn / tên có dấu BCTC hoặc bảng cân đối tài khoản (sổ chi tiết cả năm rất nặng, không đọc);
//   • bỏ hẳn các nhánh không có tờ khai: hợp đồng, hình ảnh, sổ phụ, giấy nộp tiền, lương, bảo hiểm, hải quan;
//   • nhánh hóa đơn chỉ đi khi docHoaDon (tìm chi tiền mặt ≥ 5 triệu) — một năm có thể vài nghìn file.
import { phanLoaiTep, dungHoSo } from './napHoSo.js'
import { docHoaDonXml } from './hoaDonXml.js'
import { loaiThuMucNam, duoiFile, conAnToan } from '../phanTich/thuMuc.js'

const PHIEN_BAN = 'ruiro1'        // đổi khi cách đọc đổi → bộ nhớ đệm cũ tự bỏ
const LA_EXCEL = new Set(['xlsx', 'xls'])
const GIOI_HAN = 6000             // một năm quá số file này thì dừng, ghi cảnh báo
const NHANH_BO = new Set(['hop_dong', 'hop_dong_khac', 'hinh_anh', 'so_phu', 'giay_nop_tien', 'luong', 'bhxh', 'hai_quan'])
const khongDau = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const laTenCanDoiTaiKhoan = ten => /CANDOITAIKHOAN|CANDOIPHATSINH|CDTK|CDPS|BCDTK|BANGCANDOISOPHATSINH/.test(khongDau(ten))
const laTenBctc = ten => /BCTC|BAOCAOTAICHINH|TAICHINHNAM/.test(khongDau(ten)) || laTenCanDoiTaiKhoan(ten)
const laNhanhHoaDon = ten => loaiThuMucNam(ten).ma === 'hoa_don' || /^(HD|HOADON)?(MUAVAO|BANRA)/.test(khongDau(ten).replace(/^\d+/, ''))

// Đi cây thư mục năm →{ tep: [{ ten, duongDan, duoi, co, sua, tay, vai: 'xml'|'excel'|'hoadon' }],
//   nen: [đường dẫn file nén CHƯA giải nén], canhBao }
export async function tepRuiRoCuaNam(quetNam, { docHoaDon = false } = {}) {
  const ra = { tep: [], nen: [], canhBao: [] }
  if (!quetNam?.tay) return ra
  async function di(tay, duongDan, trongHoaDon, trongBctc) {
    const thuMuc = [], nen = []
    for await (const [ten, t] of conAnToan(tay, tay === quetNam.tay, ra.canhBao)) {
      if (t.kind === 'directory') { thuMuc.push([ten, t]); continue }
      if (ten.startsWith('~$') || ten.startsWith('.')) continue
      const duoi = duoiFile(ten)
      if (duoi === 'rar' || duoi === 'zip' || duoi === '7z') { nen.push(ten); continue }
      let vai = null
      if (duoi === 'xml') vai = trongHoaDon ? 'hoadon' : 'xml'
      else if (LA_EXCEL.has(duoi) && !trongHoaDon && (trongBctc || laTenBctc(ten))) vai = 'excel'
      if (!vai) continue
      if (ra.tep.length >= GIOI_HAN) { ra.canhBao.push(`Quá ${GIOI_HAN} file trong thư mục năm ${quetNam.nam} — chỉ đọc phần đầu`); return false }
      let co = null, sua = null
      try { const f = await t.getFile(); co = f.size; sua = f.lastModified } catch { /* file Drive chưa tải về máy */ }
      ra.tep.push({ ten, duongDan, duoi, co, sua, tay: t, vai })
    }
    // File nén đã giải nén ra thư mục cùng tên bên cạnh (BCTC_2024.rar ↔ BCTC_2024\) thì không nhắc
    const tenThuMuc = new Set(thuMuc.map(([ten]) => khongDau(ten)))
    for (const ten of nen) if (!tenThuMuc.has(khongDau(ten.replace(/\.[^.]+$/, '')))) ra.nen.push([...duongDan, ten].join('\\'))
    thuMuc.sort((a, b) => a[0].localeCompare(b[0], 'vi'))
    for (const [ten, t] of thuMuc) {
      if (NHANH_BO.has(loaiThuMucNam(ten).ma)) continue
      const hd = trongHoaDon || laNhanhHoaDon(ten)
      if (hd && !docHoaDon) continue
      if (await di(t, [...duongDan, ten], hd, trongBctc || laTenBctc(ten)) === false) return false
    }
  }
  await di(quetNam.tay, quetNam.duongDan || [quetNam.ten], false, false)
  return ra
}

async function docCoDem(tep, loai, dem, doc) {
  const khoa = dem?.khoa(tep, PHIEN_BAN + '-' + loai)
  if (khoa) { const c = await dem.lay(khoa); if (c !== undefined) return c }
  let kq
  try { kq = await doc(await tep.tay.getFile()) } catch (e) { kq = { loi: e?.message || String(e), ma: e?.code || null } }
  if (khoa && !(kq.loi && kq.ma !== 'notbctc')) await dem.ghi(khoa, kq)   // lỗi đọc thì lần sau thử lại
  return kq
}

const docTepRuiRo = async f => {
  const r = await phanLoaiTep(f.name, new Uint8Array(await f.arrayBuffer()))
  return r.kind ? { kind: r.kind, doc: r.doc, year: r.year } : { boQua: r.boQua }
}

// quetTheoNam: { [nam]: quetNam } (năm soát, năm trước, năm sau nếu có).
//   tatCaNam: đọc MỌI năm có thư mục và giữ mọi tờ khai (màn hình đọc một lần rồi chuyển năm / xem nhiều năm);
//             không thì chỉ đọc năm N−1, N, N+1 và giữ tờ khai của N−1, N.
//   docHoaDon: đọc thêm hóa đơn XML trong thư mục năm `nam` (tìm chi tiền mặt ≥ 5 triệu).
// Trả { client, items: [{ten, duongDan, kind, year}], ngoaiNam, boQua, nen: [file nén chưa giải nén], loi: [{tep, loi}],
//       thieuNamTruoc, hoaDon: [docHoaDonXml] | null, canhBao, cacNamCoDuLieu }
export async function docHoSoRuiRo({ nam, quetTheoNam, mst, dem, tienDo, docHoaDon = false, tatCaNam = false }) {
  const cacNam = tatCaNam ? Object.keys(quetTheoNam).map(Number).sort() : [nam - 1, nam, nam + 1].filter(n => quetTheoNam[n])
  const ds = [], canhBao = []
  const nen = []
  for (const n of cacNam) {
    // hóa đơn chỉ cần của chính năm soát
    const r = await tepRuiRoCuaNam(quetTheoNam[n], { docHoaDon: docHoaDon && n === nam })
    ds.push(...r.tep); nen.push(...r.nen); canhBao.push(...r.canhBao)
  }
  let xong = 0
  const items = [], loi = [], hoaDon = []
  let boQua = 0
  for (const tep of ds) {
    if (tep.vai === 'hoadon') {
      const kq = await docCoDem(tep, 'hoadon', dem, async f => docHoaDonXml(await f.text()))
      if (kq.ok) hoaDon.push(kq)
    } else {
      const kq = await docCoDem(tep, 'tep', dem, docTepRuiRo)
      if (kq.kind) items.push({ name: tep.ten, kind: kq.kind, doc: structuredClone(kq.doc), year: kq.year, tep })
      else if (kq.boQua || kq.ma === 'notbctc') boQua++
      else if (kq.loi) loi.push({ tep, loi: kq.loi })
    }
    tienDo?.(++xong, ds.length)
  }
  // Năm lấy theo NỘI DUNG file — quyết toán năm trước hay nằm ở thư mục năm sau. Trùng file (cùng tờ khai ở 2 chỗ)
  // thì dungHoSo tự bỏ bản trùng theo chữ ký tờ khai.
  const dung = tatCaNam ? items : items.filter(i => +i.year === nam || +i.year === nam - 1)
  return {
    client: dungHoSo(dung, mst),
    items: dung.map(i => ({ ten: i.name, duongDan: i.tep.duongDan, kind: i.kind, year: i.year })),
    ngoaiNam: items.length - dung.length, boQua, nen, loi, canhBao,
    thieuNamTruoc: !quetTheoNam[nam - 1],
    hoaDon: docHoaDon ? hoaDon : null,
    cacNamCoDuLieu: [...new Set(dung.map(i => +i.year).filter(Boolean))].sort((a, b) => b - a),
  }
}
