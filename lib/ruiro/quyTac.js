// Bộ quy tắc 39 tiêu chí đang dùng = bản 3.2.0 (rules3.js, giữ nguyên để đối chiếu) + các chỗ Savitax sửa lỗi bên dưới.
// Mỗi chỗ sửa ghi rõ: biểu thức cũ, biểu thức mới, vì sao. Bộ kiểm: node scripts/test-ruiro-mau.mjs
// Sửa ở mã bộ diễn dịch (lib/ruiro/risk3.js, tìm "Savitax sửa"): (1) cơ chế canCo dưới đây; (2) mọi nguồn của SL1/SL2 đều
// chưa có (không BCTC / quyết toán / LCTT) → "Thiếu dữ liệu" thay vì nz() ra 0 (R21, R25, R29, R30, R32, R33, R36–R39).
import RULES3_GOC from './rules3.js'

export const SUA_LOI = [
  {
    id: 'R05', duong: ['sl2', 'expr'],
    cu: 'nz(cdtk.tk133.dn_dau) ?? bcdkt.thue_gtgt_kt.dau',
    moi: 'cdtk.tk133.dn_dau ?? bcdkt.thue_gtgt_kt.dau',
    lyDo: 'nz() biến "không có bảng cân đối tài khoản" thành 0 nên không bao giờ lấy sang BCĐKT — báo rủi ro cao oan cho công ty không nộp bảng cân đối tài khoản.',
  },
  {
    id: 'R06', duong: ['sl2', 'expr'],
    cu: 'nz(cdtk.tk133.dn_cuoi) ?? bcdkt.thue_gtgt_kt.cuoi',
    moi: 'cdtk.tk133.dn_cuoi ?? bcdkt.thue_gtgt_kt.cuoi',
    lyDo: 'Cùng lỗi với R05, ở số dư cuối năm.',
  },
  {
    id: 'R20', duong: ['dieuKien', 0, 'expr'],
    cu: 'SL1 > 0 && nz(lo_con_duoc_chuyen) < SL1',
    moi: 'SL1 > 0 && lo_con_duoc_chuyen < SL1',
    lyDo: 'Chưa có số lỗ còn được chuyển mà coi là 0 thì mọi công ty có chuyển lỗ đều bị báo "Cao". Chưa có số → "Thiếu dữ liệu" (xem canCo bên dưới).',
    canCo: [{ khi: 'SL1 > 0', bien: 'lo_con_duoc_chuyen', nhan: 'Số lỗ còn được chuyển của các năm trước (PL 03-2/TNDN)' }],
  },
]

function napSua(goc) {
  const r = JSON.parse(JSON.stringify(goc))
  for (const s of SUA_LOI) {
    const c = r.criteria.find(x => x.id === s.id)
    if (!c) throw new Error('Sửa lỗi: không thấy tiêu chí ' + s.id)
    let o = c
    for (const k of s.duong.slice(0, -1)) o = o[k]
    const k = s.duong[s.duong.length - 1]
    if (o[k] !== s.cu) throw new Error(`Sửa lỗi ${s.id}: biểu thức gốc đã khác (${o[k]}) — soát lại trước khi áp`)
    o[k] = s.moi
    if (s.canCo) c.canCo = s.canCo
  }
  r.meta = { ...r.meta, savitaxSua: SUA_LOI.map(s => s.id) }
  return r
}

const QUY_TAC = napSua(RULES3_GOC)
export default QUY_TAC
