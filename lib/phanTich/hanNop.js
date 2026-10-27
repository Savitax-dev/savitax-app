// Hạn nộp + trạng thái nộp của kỳ đang soát (màn Soát kỳ) — hàm thuần, dữ liệu từ /api/admin/phantich/han-nop
// (phân hệ Tờ khai: lịch hạn nộp + hồ sơ đồng bộ từ cổng). Kiểm: scripts/test-phantich-soatky.mjs.

// Mã kỳ phân hệ Tờ khai phủ kỳ đang soát: quý → chính quý + 3 tháng trong quý; tháng → chính tháng + quý chứa nó
// (công ty khai GTGT tháng mà TNCN quý). Không lấy tờ khai năm / phát sinh.
export function maKyPhu(k, nam) {
  const T = t => `T${String(t).padStart(2, '0')}.${nam}`
  return k.loai === 'Q' ? [`Q${k.so}.${nam}`, T(3 * k.so - 2), T(3 * k.so - 1), T(3 * k.so)] : [T(k.so), `Q${Math.ceil(k.so / 3)}.${nam}`]
}
export const maKyCua = (k, nam) => (k.loai === 'Q' ? `Q${k.so}.${nam}` : `T${String(k.so).padStart(2, '0')}.${nam}`)

// Hạn nộp 01/GTGT của đúng kỳ theo lịch Tờ khai (null nếu lịch chưa có kỳ này) — lịch đã đẩy theo ngày nghỉ
export function hanTheoLich(nghiaVu, k, nam) {
  return (nghiaVu || []).find(x => x.ma === '01/GTGT' && x.ky === maKyCua(k, nam) && x.han)?.han || null
}

export const ngayVN = s => (s ? new Date(String(s).length <= 10 ? s + 'T00:00:00+07:00' : s).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const homNayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

// Trạng thái một tờ khai trong kỳ: ưu tiên hồ sơ thật lấy từ cổng (lần nộp cuối), không có mới theo trạng thái của lịch
export function trangThaiNop(x, homNay = homNayVN()) {
  const h = (x.hoSo || []).at(-1)
  if (h) {
    const lan = h.lanBoSung ? `bổ sung lần ${h.lanBoSung}` : 'chính thức'
    if (h.trangThai === 'rejected') return { nhan: `Bị từ chối · ${lan}`, mau: 'do' }
    const dung = h.dungHan === true ? ' · đúng hạn' : h.dungHan === false ? ' · TRỄ HẠN' : ''
    return { nhan: `Đã nộp ${ngayVN(h.tiepNhan || h.nop)}${dung}`, mau: h.dungHan === false ? 'do' : 'xanhLa', phu: `${lan}${h.trangThai === 'accepted' ? ' · đã chấp nhận' : h.trangThai === 'received' ? ' · đã tiếp nhận' : ''}` }
  }
  if (x.trangThai === 'no_activity') return { nhan: 'Không phát sinh', mau: 'xam' }
  if (x.trangThai === 'overdue' || (x.han && x.han < homNay)) return { nhan: 'Quá hạn — chưa thấy hồ sơ nộp', mau: 'do' }
  return { nhan: 'Chưa nộp', mau: 'hoPhach' }
}
