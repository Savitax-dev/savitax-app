// Bảng kê hóa đơn tải từ cổng hoadondientu.gdt.gov.vn — HÀM THUẦN (không đụng trình duyệt, chạy được bằng node để kiểm).
//
// File cổng xuất (nút "Xuất hóa đơn" ở Tra cứu hóa đơn, dò thật 21/11/2026): tên "DANH SÁCH HÓA ĐƠN.xlsx", một sheet;
// dòng 3 "DANH SÁCH HÓA ĐƠN", dòng 4 "Từ ngày dd/mm/yyyy đến ngày dd/mm/yyyy", tiêu đề cột ở dòng 6 (STT | Ký hiệu mẫu số |
// Ký hiệu hóa đơn | Số hóa đơn | Ngày lập | MST người bán/MST người xuất hàng | Tên người bán/… | MST người mua/MST người nhận
// hàng | …), mỗi hóa đơn một dòng, xuất ĐỦ danh sách (99 dòng khi cổng báo "Có 99 kết quả"), không chỉ trang đang hiện.
//
// Tên file lưu: "<MST> - Mua vào - Tổng quan - 2026-07-01_2026-09-30.xlsx" — đúng kiểu Soát xét đã nhận là bảng kê cổng
// (lib/phanTich/thuMuc.js GOI_Y_TEN: MUAVAOTONGQUAN / BANRATONGQUAN; nội dung file cổng không nói chiều mua / bán, chỉ tên nói).
// Thư mục: <cty>\2. HỒ SƠ KẾ TOÁN\Năm <năm>\2. HÓA ĐƠN MUA VÀO_BÁN RA\QUÝ n (khai tháng: THÁNG mm)\HĐ MUA VÀO | HĐ BÁN RA
// (cây ISO SVT.MB09, docs/quy-uoc-luu-ho-so.md).

const hai = n => String(n).padStart(2, '0')
const ngayVN = d => `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`
const ngayIso = s => { const [d, m, y] = String(s).split('/'); return `${y}-${m}-${d}` }
const docNgay = s => { const [d, m, y] = String(s).split('/').map(Number); return new Date(y, m - 1, d) }

export const THU_MUC_HOA_DON = '2. HÓA ĐƠN MUA VÀO_BÁN RA'
export const TEN_LOAI = { mua: 'Mua vào', ban: 'Bán ra' }
export const THU_MUC_LOAI = { mua: 'HĐ MUA VÀO', ban: 'HĐ BÁN RA' }

// Chuẩn hoá MST để so: bỏ mọi ký tự không phải số / gạch, bỏ khoảng trắng. Giữ số 0 đầu (MST thật có số 0 đầu).
export const chuanMst = s => String(s ?? '').replace(/[^\d-]/g, '').replace(/-+$/, '')
// MST trong file khớp công ty: bằng nhau, hoặc là chi nhánh của công ty (0312180502-001)
export const mstKhop = (trongFile, cty) => {
  const a = chuanMst(trongFile), b = chuanMst(cty)
  return !!a && !!b && (a === b || a.startsWith(b + '-') || b.startsWith(a + '-'))
}

// Các kỳ cần tải của một công ty cho lựa chọn `ky` = { nam, quy } hoặc { nam, thang }.
//   Công ty khai QUÝ: một kỳ trọn quý (chọn tháng → báo lỗi, phải chọn quý).
//   Công ty khai THÁNG: chọn quý → 3 tháng; chọn tháng → đúng tháng đó.
//   Kỳ chưa hết: "đến ngày" lấy hôm nay (homNay truyền vào để kiểm được). Kỳ chưa bắt đầu → bỏ.
export function kyCanTai({ kyKhai, ky, homNay = new Date() }) {
  const nam = Number(ky.nam)
  const thangCuaKy = ky.quy ? [1, 2, 3].map(i => (ky.quy - 1) * 3 + i) : [Number(ky.thang)]
  const homNay0 = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate())
  const khoang = (tuThang, denThang) => {
    const tu = new Date(nam, tuThang - 1, 1)
    let den = new Date(nam, denThang, 0)
    if (tu > homNay0) return null
    const chuaHet = den > homNay0
    if (chuaHet) den = homNay0
    return { tuNgay: ngayVN(tu), denNgay: ngayVN(den), chuaHet }
  }
  if (kyKhai === 'quy') {
    if (!ky.quy) return { loi: 'Công ty khai quý — chọn kỳ theo quý' }
    const k = khoang(thangCuaKy[0], thangCuaKy[2])
    return { ky: k ? [{ ...k, nhan: `Quý ${ky.quy}/${nam}`, thuMucKy: `QUÝ ${ky.quy}`, nam }] : [] }
  }
  return {
    ky: thangCuaKy.map(t => {
      const k = khoang(t, t)
      return k ? { ...k, nhan: `Tháng ${hai(t)}/${nam}`, thuMucKy: `THÁNG ${hai(t)}`, nam } : null
    }).filter(Boolean),
  }
}

export function tenFileBangKe({ mst, loai, tabCon, tuNgay, denNgay }) {
  const mtt = tabCon === 'mtt' ? ' - Máy tính tiền' : ''
  return `${chuanMst(mst)} - ${TEN_LOAI[loai]} - Tổng quan${mtt} - ${ngayIso(tuNgay)}_${ngayIso(denNgay)}.xlsx`
}

// Danh sách lượt xuất: mỗi kỳ × mỗi chiều (mua / bán) × mỗi loại hóa đơn (HĐĐT, máy tính tiền)
export function danhSachLuot({ mst, kyList, chieu = ['mua', 'ban'], mtt = true }) {
  const ra = []
  for (const k of kyList) {
    for (const loai of chieu) {
      for (const tabCon of mtt ? ['', 'mtt'] : ['']) {
        ra.push({
          ...k, loai, tabCon,
          nhanLuot: `${k.nhan} · ${TEN_LOAI[loai]}${tabCon === 'mtt' ? ' · Máy tính tiền' : ''}`,
          tenFile: tenFileBangKe({ mst, loai, tabCon, tuNgay: k.tuNgay, denNgay: k.denNgay }),
          duongDan: [THU_MUC_HOA_DON, k.thuMucKy, THU_MUC_LOAI[loai]],
        })
      }
    }
  }
  return ra
}

// Đọc file cổng. XLSX = thư viện SheetJS (truyền vào để chạy được cả trình duyệt lẫn node).
export function docBangKeCong(byte, XLSX) {
  const wb = XLSX.read(byte, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const hang = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  let tuNgay = null, denNgay = null, iTieuDe = -1, tieuDeFile = ''
  for (let i = 0; i < Math.min(hang.length, 20); i++) {
    const dong = hang[i].map(x => String(x ?? '').trim())
    const chu = dong.join(' ')
    const m = chu.match(/Từ ngày\s+(\d{2}\/\d{2}\/\d{4})\s+đến ngày\s+(\d{2}\/\d{2}\/\d{4})/i)
    if (m && !tuNgay) { tuNgay = m[1]; denNgay = m[2] }
    if (!tieuDeFile && /DANH SÁCH HÓA ĐƠN/i.test(chu)) tieuDeFile = 'DANH SÁCH HÓA ĐƠN'
    if (dong[0] && /^STT$/i.test(dong[0])) { iTieuDe = i; break }
  }
  if (iTieuDe < 0) return { loi: 'Không thấy hàng tiêu đề (STT) — không phải file bảng kê cổng' }
  const tieuDe = hang[iTieuDe].map(x => String(x ?? '').trim())
  const cot = re => tieuDe.findIndex(t => re.test(t))
  const cMstBan = cot(/^MST người bán/i), cMstMua = cot(/^MST người mua/i), cSo = cot(/^Số hóa đơn/i), cNgay = cot(/^Ngày lập/i)
  const dong = hang.slice(iTieuDe + 1).filter(r => /^\d+$/.test(String(r[0] ?? '').trim()))
  return {
    tieuDeFile, tuNgay, denNgay,
    soHoaDon: dong.length,
    coCot: { mstBan: cMstBan >= 0, mstMua: cMstMua >= 0, so: cSo >= 0, ngay: cNgay >= 0 },
    mstBan: cMstBan >= 0 ? dong.map(r => String(r[cMstBan] ?? '').trim()) : [],
    mstMua: cMstMua >= 0 ? dong.map(r => String(r[cMstMua] ?? '').trim()) : [],
    ngayLap: cNgay >= 0 ? dong.map(r => String(r[cNgay] ?? '').trim()) : [],
  }
}

// Kiểm file vừa tải trước khi lưu vào thư mục công ty. Lỗi (loi) → KHÔNG lưu; cảnh báo → vẫn lưu, báo nhân viên.
export function kiemBangKe({ doc, luot, mstCty, soKetQua }) {
  const loi = [], canhBao = []
  if (doc.loi) return { ok: false, loi: [doc.loi], canhBao }
  if (doc.tuNgay !== luot.tuNgay || doc.denNgay !== luot.denNgay) {
    loi.push(`Khoảng ngày trong file (${doc.tuNgay || '?'} → ${doc.denNgay || '?'}) khác khoảng cần tải (${luot.tuNgay} → ${luot.denNgay})`)
  }
  if (soKetQua != null && doc.soHoaDon !== soKetQua) loi.push(`File có ${doc.soHoaDon} hóa đơn, cổng báo ${soKetQua} kết quả`)
  // Ngày lập nằm ngoài khoảng → file không đúng kỳ
  const tu = docNgay(luot.tuNgay), den = docNgay(luot.denNgay)
  const ngoai = doc.ngayLap.filter(n => /^\d{2}\/\d{2}\/\d{4}$/.test(n) && (docNgay(n) < tu || docNgay(n) > den))
  if (ngoai.length) loi.push(`${ngoai.length} hóa đơn có ngày lập ngoài kỳ (vd ${ngoai[0]})`)
  // MST của công ty phải nằm đúng phía: mua vào → người mua; bán ra → người bán
  const ds = luot.loai === 'mua' ? doc.mstMua : doc.mstBan
  const phia = luot.loai === 'mua' ? 'người mua' : 'người bán'
  if (!(luot.loai === 'mua' ? doc.coCot.mstMua : doc.coCot.mstBan)) loi.push(`File không có cột MST ${phia}`)
  else if (doc.soHoaDon) {
    const coMst = ds.filter(Boolean)
    const lech = coMst.filter(m => !mstKhop(m, mstCty))
    if (lech.length) loi.push(`${lech.length}/${doc.soHoaDon} hóa đơn có MST ${phia} khác MST công ty (${chuanMst(mstCty)}), vd ${chuanMst(lech[0])} — có thể đang đăng nhập nhầm công ty`)
    else if (!coMst.length) canhBao.push(`Không hóa đơn nào ghi MST ${phia} — không đối chiếu được công ty`)
    else if (coMst.length < ds.length) canhBao.push(`${ds.length - coMst.length} hóa đơn bỏ trống MST ${phia}`)
  }
  return { ok: !loi.length, loi, canhBao }
}
