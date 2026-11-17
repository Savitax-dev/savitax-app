// Phân hệ Pháp lý — trình ký / nộp & theo dõi / kết quả (sql/58). Hàm THUẦN — kiểm offline scripts/test-phaply-nop.mjs.

export const CO_QUAN = [{ k: 'so', label: 'Phòng ĐKKD' }, { k: 'thue', label: 'Cơ quan thuế' }, { k: 'khac', label: 'Cơ quan khác' }]
export const KET_QUA = [
  { k: 'cho', label: 'Đang chờ kết quả', mau: '#1D4ED8' },
  { k: 'bo_sung', label: 'Yêu cầu sửa đổi, bổ sung', mau: '#B91C1C' },
  { k: 'dat', label: 'Đạt — đã có kết quả', mau: '#15803D' },
  { k: 'tu_choi', label: 'Từ chối', mau: '#334155' },
]
export const coQuanLabel = k => CO_QUAN.find(c => c.k === k)?.label || k
export const ketQuaLabel = k => KET_QUA.find(c => c.k === k)?.label || k

// Trạng thái "đang chờ ai" của hồ sơ suy từ lần nộp MỚI NHẤT (theo ngày nộp, rồi giờ tạo):
//   chờ kết quả → Chờ Sở / Chờ Thuế · yêu cầu bổ sung → Cần bổ sung · đạt / từ chối / cơ quan khác → không tự đặt (null)
// Trả undefined khi chưa có lần nộp nào (không đụng trạng thái nhân viên tự chọn).
export function choTheoNop(ds) {
  if (!ds?.length) return undefined
  const moi = [...ds].sort((a, b) => String(b.ngay_nop).localeCompare(String(a.ngay_nop)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  if (moi.ket_qua === 'bo_sung') return 'bo_sung'
  if (moi.ket_qua === 'cho') return moi.co_quan === 'so' ? 'so' : moi.co_quan === 'thue' ? 'thue' : null
  return null
}

// Số ngày lịch từ hôm nay (YYYY-MM-DD giờ VN) tới hạn: dương = còn, 0 = hôm nay, âm = quá hạn
export function soNgayToiHan(hanISO, homNayISO) {
  if (!hanISO || !homNayISO) return null
  const d = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((d(String(hanISO)) - d(String(homNayISO))) / 86400000)
}

// Hạn cần theo dõi của một lần nộp: đang chờ → ngày hẹn trả; yêu cầu bổ sung → hạn nộp bổ sung
export const hanTheoDoi = s => (s.ket_qua === 'cho' ? s.ngay_hen_tra : s.ket_qua === 'bo_sung' ? s.han_bo_sung : null) || null

// Lần nộp kế tiếp cho cùng cơ quan
export const lanKeTiep = (ds, coQuan) => 1 + Math.max(0, ...(ds || []).filter(s => s.co_quan === coQuan).map(s => Number(s.lan) || 0))

// Mã số doanh nghiệp: 10 số, hoặc 10 số + "-" + 3 số (chi nhánh / đơn vị phụ thuộc)
export const maSoHopLe = s => /^\d{10}(-\d{3})?$/.test(String(s || '').trim())
