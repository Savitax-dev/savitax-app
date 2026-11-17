// Phân hệ Pháp lý — CCCD: khuôn kết quả đọc ảnh, chuẩn hoá về dòng legal_people, KIỂM CHÉO bắt lỗi đọc sai.
// Hàm THUẦN (không gọi mạng, không đọc DB) → kiểm offline: scripts/test-phaply-cccd.mjs. Gọi Claude ở lib/phaply/cccdDoc.js.
// Nguyên tắc (kế hoạch mục 6): đọc lệch thì CẢNH BÁO + tô nổi ô, KHÔNG tự sửa — nhân viên đối chiếu ảnh rồi quyết.

export const NOI_CAP_CCCD = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội'
export const NOI_CAP_CAN_CUOC = 'Bộ Công an'

// Khuôn JSON bắt Claude trả (structured outputs) — mọi trường là chuỗi, "" khi không thấy trên ảnh
const CHU = { type: 'string' }
export const KHUON_DOC = {
  type: 'object',
  additionalProperties: false,
  required: ['loai_the', 'so', 'ho_ten', 'ngay_sinh', 'gioi_tinh', 'quoc_tich', 'que_quan', 'noi_thuong_tru',
    'ngay_cap', 'noi_cap', 'ngay_het_han', 'mrz', 'khong_chac', 'ghi_chu'],
  properties: {
    loai_the: { type: 'string', enum: ['cccd_chip', 'cccd_ma_vach', 'can_cuoc_2024', 'cmnd', 'ho_chieu', 'khac'] },
    so: CHU, ho_ten: CHU, ngay_sinh: CHU, gioi_tinh: CHU, quoc_tich: CHU, que_quan: CHU,
    noi_thuong_tru: CHU, ngay_cap: CHU, noi_cap: CHU, ngay_het_han: CHU,
    mrz: { type: 'array', items: CHU },
    khong_chac: { type: 'array', items: CHU },
    ghi_chu: CHU,
  },
}

export const LOI_NHAC = `Đây là ảnh giấy tờ tùy thân Việt Nam (căn cước công dân / thẻ căn cước) của khách hàng một công ty dịch vụ pháp lý, dùng để điền hồ sơ đăng ký doanh nghiệp. Hãy chép lại thông tin IN TRÊN THẺ.
Quy tắc:
- Chép đúng như in trên thẻ, giữ dấu tiếng Việt. Không suy đoán, không bổ sung thông tin không thấy trên ảnh; trường nào không thấy hoặc không đọc được thì để "".
- Ngày viết dạng dd/mm/yyyy. "Không thời hạn" thì ghi đúng chữ "Không thời hạn".
- so: số định danh 12 chữ số (CMND cũ 9 chữ số), chỉ chữ số.
- gioi_tinh: "Nam" hoặc "Nữ".
- noi_thuong_tru: nơi thường trú in ở mặt trước (thẻ CCCD) hoặc "Nơi cư trú" in ở mặt sau (thẻ căn cước mẫu 2024), chép nguyên văn cả dòng, nối các dòng bằng dấu phẩy.
- noi_cap: cơ quan cấp in trên thẻ (thường ở mặt sau, cạnh chữ ký). ngay_cap: ngày cấp in trên thẻ.
- mrz: các dòng mã máy đọc ở mặt sau (bắt đầu bằng IDVNM), chép từng dòng đủ ký tự kể cả dấu "<"; không có thì [].
- loai_the: cccd_chip (căn cước công dân gắn chip, cấp 2021–06/2024), cccd_ma_vach (căn cước công dân mã vạch), can_cuoc_2024 (thẻ "CĂN CƯỚC" cấp từ 07/2024), cmnd, ho_chieu, khac.
- khong_chac: tên các trường (theo đúng tên khoá ở trên) mà chữ trên ảnh mờ, bị che, lóa sáng hoặc bạn không chắc chắn.
- ghi_chu: nhận xét ngắn nếu ảnh có vấn đề (mờ, thiếu mặt, không phải giấy tờ tùy thân…), không thì "".`

// ─── Chuẩn hoá ──────────────────────────────────────────────────────────────────────────────────────────
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
export { boDau }

export function chuanNgay(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  if (/không\s*thời\s*hạn/i.test(t)) return 'Không thời hạn'
  const m = t.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})$/)
  if (!m) return t
  return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
}

// "NGUYỄN VĂN AN" → "Nguyễn Văn An" (mẫu Word tự in hoa lại khi cần)
export const chuHoaDau = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
  .replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi-VN'))

const BO_TIEN_TO_TINH = /^(thanh pho|tinh|tp\.?)\s+/
const BO_TIEN_TO_XA = /^(phuong|xa|dac khu|thi tran|p\.|x\.)\s+/
const tenGon = (s, re) => boDau(s).replace(/\s+/g, ' ').replace(re, '').trim()

// Tách địa chỉ in trên thẻ thành { so_nha, ma_xa, xa, ma_tinh, tinh, quoc_gia } theo danh mục 34 tỉnh / xã mới.
// places: { tinh: [{ma, ten}], xa: [{ma, ten, ma_tinh}] }. Địa chỉ ĐỊA GIỚI CŨ (quận/huyện, tỉnh trước sáp nhập) không khớp →
// trả nguyên văn trong so_nha, không mã → giao diện bắt chọn lại tỉnh + phường/xã mới.
export function tachDiaChi(text, places = { tinh: [], xa: [] }) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return { diaChi: {}, khop: false }
  const phan = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (phan.length >= 2) {
    const tinh = places.tinh.find(t => tenGon(t.ten, BO_TIEN_TO_TINH) === tenGon(phan[phan.length - 1], BO_TIEN_TO_TINH))
    if (tinh) {
      const tenXa = tenGon(phan[phan.length - 2], BO_TIEN_TO_XA)
      // tên xã trùng nhau giữa các loại (Phường X / Xã X cùng tỉnh hiếm) → so cả có tiền tố trước, rồi mới bỏ tiền tố
      const dsXa = places.xa.filter(x => x.ma_tinh === tinh.ma)
      const xa = dsXa.find(x => boDau(x.ten) === boDau(phan[phan.length - 2]))
        || (dsXa.filter(x => tenGon(x.ten, BO_TIEN_TO_XA) === tenXa).length === 1 ? dsXa.find(x => tenGon(x.ten, BO_TIEN_TO_XA) === tenXa) : null)
      if (xa) {
        return { khop: true, diaChi: { so_nha: phan.slice(0, -2).join(', '), ma_xa: xa.ma, xa: xa.ten, ma_tinh: tinh.ma, tinh: tinh.ten, quoc_gia: 'Việt Nam' } }
      }
    }
  }
  return { khop: false, diaChi: { so_nha: raw, quoc_gia: 'Việt Nam' } }
}

// Kết quả đọc → các trường của legal_people (chỉ trường có giá trị — giao diện ghép đè lên form)
export function veNguoi(doc, places) {
  const loai = { cccd_chip: 'Căn cước công dân', cccd_ma_vach: 'Căn cước công dân', can_cuoc_2024: 'Căn cước', cmnd: 'Chứng minh nhân dân', ho_chieu: 'Hộ chiếu' }[doc.loai_the] || ''
  const noiCap = String(doc.noi_cap || '').trim().replace(/\s+/g, ' ')
  const gt = /^n[uữ]/i.test(boDau(doc.gioi_tinh)) ? 'Nữ' : /^nam/i.test(boDau(doc.gioi_tinh)) ? 'Nam' : ''
  const dc = tachDiaChi(doc.noi_thuong_tru, places)
  const ra = {
    ho_ten: chuHoaDau(doc.ho_ten), gioi_tinh: gt, ngay_sinh: chuanNgay(doc.ngay_sinh),
    quoc_tich: /^viet nam$/i.test(boDau(doc.quoc_tich)) ? 'Việt Nam' : String(doc.quoc_tich || '').trim(),
    loai_giay_to: loai, so_giay_to: String(doc.so || '').replace(/\D/g, ''),
    ngay_cap: chuanNgay(doc.ngay_cap), ngay_het_han: chuanNgay(doc.ngay_het_han),
    // nơi cấp in tắt / thiếu chữ trên thẻ: lấy tên đầy đủ theo loại thẻ
    noi_cap: /canh sat quan ly hanh chinh/.test(boDau(noiCap)) ? NOI_CAP_CCCD
      : /^bo cong an$/.test(boDau(noiCap)) ? NOI_CAP_CAN_CUOC
        : noiCap || (doc.loai_the === 'can_cuoc_2024' ? NOI_CAP_CAN_CUOC : doc.loai_the?.startsWith('cccd') ? NOI_CAP_CCCD : ''),
    thuong_tru: dc.diaChi,
  }
  return { nguoi: Object.fromEntries(Object.entries(ra).filter(([, v]) => (typeof v === 'object' ? Object.keys(v).length : v))), diaChiKhop: dc.khop }
}

// ─── Kiểm chéo ──────────────────────────────────────────────────────────────────────────────────────────
// Chữ số kiểm tra ICAO 9303 (trọng số 7, 3, 1; chữ số = giá trị, A–Z = 10–35, "<" = 0)
export function soKiemMrz(chuoi) {
  let tong = 0
  for (const [i, c] of [...chuoi].entries()) {
    const v = /\d/.test(c) ? +c : /[A-Z]/.test(c) ? c.charCodeAt(0) - 55 : 0
    tong += v * [7, 3, 1][i % 3]
  }
  return tong % 10
}

// Dòng MRZ thẻ VN: (1) IDVNM + 9 số cuối + kiểm + 12 số định danh   (2) yymmdd sinh + kiểm + M/F + yymmdd hết hạn + kiểm + VNM
export function docMrz(dong = []) {
  const ds = dong.map(d => String(d).replace(/\s/g, '').toUpperCase())
  const d1 = ds.map(d => d.match(/IDVNM(\d{9})(\d)(\d{12})/)).find(Boolean)
  const d2 = ds.map(d => d.match(/(\d{6})(\d)([MF<])(\d{6}|<{6})(\d|<)VNM/)).find(Boolean)
  if (!d1 && !d2) return null
  return {
    so: d1?.[3] || '', so9: d1?.[1] || '', so9Dung: d1 ? soKiemMrz(d1[1]) === +d1[2] : null,
    sinh: d2?.[1] || '', sinhDung: d2 ? soKiemMrz(d2[1]) === +d2[2] : null,
    gioi: d2 ? ({ M: 'Nam', F: 'Nữ' })[d2[3]] || '' : '',
    hetHan: d2 && /^\d{6}$/.test(d2[4]) ? d2[4] : '', hetHanDung: d2 && /^\d{6}$/.test(d2[4]) ? soKiemMrz(d2[4]) === +d2[5] : null,
  }
}

const yymmdd = ngay => { const m = String(ngay || '').match(/^(\d{2})\/(\d{2})\/\d{2}(\d{2})$/); return m ? m[3] + m[2] + m[1] : '' }

// Trả [{ truong, muc }] — truong = khoá legal_people để tô nổi ô; muc = câu cảnh báo
export function kiemCheo(nguoi, doc = {}) {
  const ra = []
  const bao = (truong, muc) => ra.push({ truong, muc })
  const so = nguoi.so_giay_to || ''
  const laCanCuoc = /căn cước/i.test(nguoi.loai_giay_to || '')
  if (laCanCuoc && so) {
    if (!/^\d{12}$/.test(so)) bao('so_giay_to', `Số căn cước phải đủ 12 chữ số (đọc được ${so.length})`)
    else {
      const ma = +so.slice(0, 3)
      if (ma < 1 || ma > 96) bao('so_giay_to', `3 số đầu ${so.slice(0, 3)} không phải mã tỉnh nơi đăng ký khai sinh (001–096)`)
      const c4 = +so[3]
      const theKy = [1900, 1900, 2000, 2000, 2100, 2100, 2200, 2200, 1800, 1800][c4]
      const gioiTheoSo = c4 % 2 === 0 ? 'Nam' : 'Nữ'
      if (nguoi.gioi_tinh && nguoi.gioi_tinh !== gioiTheoSo) bao('gioi_tinh', `Chữ số thứ 4 của số CCCD (${c4}) ứng với giới tính ${gioiTheoSo}, thẻ đọc ra ${nguoi.gioi_tinh}`)
      const nam = String(nguoi.ngay_sinh || '').match(/(\d{4})$/)?.[1]
      if (nam && +nam !== theKy + +so.slice(4, 6)) bao('ngay_sinh', `Số CCCD ứng với năm sinh ${theKy + +so.slice(4, 6)}, thẻ đọc ra ${nam}`)
    }
  }
  const mrz = docMrz(doc.mrz || [])
  if (mrz) {
    if (mrz.so9Dung === false || mrz.sinhDung === false || mrz.hetHanDung === false) bao('mrz', 'Dòng mã máy đọc (MRZ) ở mặt sau đọc sai chữ số kiểm tra — đối chiếu bằng mắt')
    if (mrz.so && so && mrz.so !== so) bao('so_giay_to', `Số ở mặt trước (${so}) khác số trong mã MRZ mặt sau (${mrz.so})`)
    if (mrz.sinh && nguoi.ngay_sinh && mrz.sinhDung && yymmdd(nguoi.ngay_sinh) !== mrz.sinh) bao('ngay_sinh', `Ngày sinh khác ngày sinh trong mã MRZ (${mrz.sinh.slice(4)}/${mrz.sinh.slice(2, 4)}/..${mrz.sinh.slice(0, 2)})`)
    if (mrz.gioi && nguoi.gioi_tinh && mrz.gioi !== nguoi.gioi_tinh) bao('gioi_tinh', `Giới tính khác mã MRZ (${mrz.gioi})`)
    if (mrz.hetHan && mrz.hetHanDung && nguoi.ngay_het_han && /\d/.test(nguoi.ngay_het_han) && yymmdd(nguoi.ngay_het_han) !== mrz.hetHan) bao('ngay_het_han', 'Ngày hết hạn khác mã MRZ')
  }
  // giấy tờ đã hết hạn
  const hh = String(nguoi.ngay_het_han || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (hh && new Date(`${hh[3]}-${hh[2]}-${hh[1]}T23:59:59+07:00`) < new Date()) bao('ngay_het_han', `Giấy tờ đã HẾT HẠN từ ${nguoi.ngay_het_han}`)
  for (const k of doc.khong_chac || []) {
    const truong = { so: 'so_giay_to', noi_thuong_tru: 'thuong_tru' }[k] || k
    if (!ra.some(r => r.truong === truong)) bao(truong, `Claude không chắc chữ ở ô "${k}" — đối chiếu ảnh`)
  }
  return ra
}
