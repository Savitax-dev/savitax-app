// Dữ liệu GIẢ cho bộ kiểm mẫu Word nhóm TẠM NGỪNG + HOẠT ĐỘNG LẠI — (G = DU_LIEU_GIA đã có, h = người / hàm giả dùng chung) → { tên bộ: hồ sơ }
// tn_* = tạm ngừng (đủ ngày + lý do), hdl_* = tiếp tục kinh doanh trước thời hạn. Vài bộ cố ý để trống ô (lý do, ngày, cơ quan đăng ký)
// để thấy mẫu in chỗ chấm. Mọi tên / số đều GIẢ.
const TN = { thu_tuc: 'tam_ngung', tam_ngung_tu: '2026-12-01', tam_ngung_den: '2027-11-30' }
const HDL = { thu_tuc: 'hoat_dong_lai', tam_ngung_tu: '2026-12-01', tam_ngung_den: '2027-11-30', hoat_dong_lai_tu: '2027-04-01' }
const MA_HKD = '0399000002' // mã số hộ kinh doanh GIẢ

export default (G) => {
  const hkd = (bt, them, tt) => ({ ...G.hkd, ...them, bien_the: bt, cty: { ...G.hkd.cty, ma_so: MA_HKD }, thong_tin: tt })
  return {
    // ─── tạm ngừng — công ty ───
    tn_1tv: { ...G['1tv'], ...TN, bien_the: 'tam_ngung', thong_tin: { ly_do: 'Tình hình hoạt động kinh doanh không hiệu quả' } },
    tn_1tv_tc: { ...G['1tv_tc'], ...TN, bien_the: 'tam_ngung', thong_tin: {} },                       // lý do = mặc định của ô
    tn_2tv: { ...G['2tv'], ...TN, bien_the: 'tam_ngung', thong_tin: { ly_do: 'Công ty sắp xếp lại hoạt động kinh doanh' } },
    tn_cp: { ...G.cp, thu_tuc: 'tam_ngung', bien_the: 'tam_ngung', thong_tin: { ly_do: 'Tình hình hoạt động kinh doanh không hiệu quả' } }, // chưa nhập ngày → chỗ chấm
    // ─── hoạt động lại — công ty ───
    hdl_1tv: { ...G['1tv'], ...HDL, bien_the: 'hoat_dong_lai', thong_tin: { ly_do: 'Công ty đã ổn định nguồn hàng, tiếp tục kinh doanh' } },
    hdl_1tv_tc: { ...G['1tv_tc'], ...HDL, bien_the: 'hoat_dong_lai', thong_tin: {} },
    hdl_2tv: { ...G['2tv'], ...HDL, bien_the: 'hoat_dong_lai', thong_tin: {} },
    hdl_cp: { ...G.cp, ...HDL, bien_the: 'hoat_dong_lai', thong_tin: { ly_do: 'Theo nhu cầu kinh doanh của công ty' } },
    // ─── hộ kinh doanh ───
    tn_hkd: hkd('tam_ngung_hkd', TN, { co_quan_dk: 'Ủy ban nhân dân phường Xuân Hòa' }),
    hdl_hkd: hkd('hoat_dong_lai_hkd', HDL, { ly_do: 'Hộ kinh doanh có nhu cầu kinh doanh trở lại' }),       // không nhập cơ quan → theo hồ sơ
  }
}
