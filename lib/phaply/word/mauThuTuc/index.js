// Gộp mẫu Word theo nhóm thủ tục (mỗi nhóm một file — nhiều người soạn song song không đụng nhau)
import tamNgung from './tamNgung.js'
import giaiThe from './giaiThe.js'
import giaiTheDvptHkd from './giaiTheDvptHkd.js'
import thayDoi from './thayDoi.js'

const NHOM = [tamNgung, giaiThe, giaiTheDvptHkd, thayDoi]
export const MAU_THU_TUC = NHOM.flatMap(n => n.mau || [])
export const THONG_TIN_THU_TUC = Object.assign({}, ...NHOM.map(n => n.thongTin || {}))
export const LUU_Y_THU_TUC_NHOM = Object.assign({}, ...NHOM.map(n => n.luuY || {}))
