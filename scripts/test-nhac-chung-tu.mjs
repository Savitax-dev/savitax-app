// Bộ kiểm hàm thuần Nhắc gửi chứng từ (lib/nhacChungTu.js) — không mạng, không DB.  node scripts/test-nhac-chung-tu.mjs
import { thangChecklist, kyMacDinh, dienLoiNhan, MAU_LOI_NHAN } from '../lib/nhacChungTu.js'

let hong = 0
const kiem = (ten, thuc, mong) => {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong)
  if (!ok) hong++
  console.log((ok ? '✓ ' : '✗ ') + ten + (ok ? '' : `\n   ra:   ${JSON.stringify(thuc)}\n   mong: ${JSON.stringify(mong)}`))
}

kiem('chứng từ T10/2026 → checklist T11/2026', thangChecklist(2026, 10), { nam: 2026, thang: 11 })
kiem('chứng từ T12/2026 → checklist T1/2027', thangChecklist(2026, 12), { nam: 2027, thang: 1 })
kiem('kỳ mặc định 26/11 → chứng từ T11', kyMacDinh(new Date('2026-11-26T03:00:00Z')), { nam: 2026, thang: 11 })
kiem('kỳ mặc định 03/11 → chứng từ T10', kyMacDinh(new Date('2026-11-03T03:00:00Z')), { nam: 2026, thang: 10 })
kiem('kỳ mặc định 05/01/2027 → chứng từ T12/2026', kyMacDinh(new Date('2027-01-05T03:00:00Z')), { nam: 2026, thang: 12 })
kiem('19/11 23h giờ VN (16h UTC) vẫn là trước ngày 20', kyMacDinh(new Date('2026-11-19T16:30:00Z')), { nam: 2026, thang: 10 })

kiem('lời nhắn khai quý = đúng tin Kiều Tiên gửi 26/11',
  dienLoiNhan(MAU_LOI_NHAN.quy, { kyNam: 2026, kyThang: 10, kyKhai: 'quy' }),
  'SAVITAX gửi Quý Khách hàng. Em nhờ bên mình tổng hợp tất cả chứng từ của Tháng 10/2026 gửi trước ngày 10/11/2026 để em nhập liệu dần để Báo cáo thuế Quý 4/2026 ạ.\nEm cảm ơn ạ.')
kiem('lời nhắn khai tháng, chứng từ T12 → hạn 10/01 năm sau',
  dienLoiNhan(MAU_LOI_NHAN.thang, { kyNam: 2026, kyThang: 12, kyKhai: 'thang' }),
  'SAVITAX gửi Quý Khách hàng. Em nhờ bên mình tổng hợp tất cả chứng từ của Tháng 12/2026 gửi trước ngày 10/01/2027 để em làm Báo cáo thuế tháng 12/2026 ạ.\nEm cảm ơn ạ.')
kiem('{tenCty} {maKH}', dienLoiNhan('Kính gửi {tenCty} ({maKH})', { kyNam: 2026, kyThang: 1, kyKhai: 'quy', tenCty: 'CTY A', maKH: 'AAA' }), 'Kính gửi CTY A (AAA)')

kiem('lời nhắn: dòng trống bị gộp (Zalo giãn mỗi lần xuống dòng)', dienLoiNhan(['A', '', '', 'B  ', 'C'].join('\n'), { kyNam: 2026, kyThang: 1, kyKhai: 'quy' }), ['A', 'B', 'C'].join('\n'))

console.log(hong ? `\n${hong} ca HỎNG` : '\nTất cả đạt.')
process.exit(hong ? 1 : 0)
