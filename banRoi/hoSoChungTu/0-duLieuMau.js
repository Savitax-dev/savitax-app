/* Dữ liệu mẫu của phân hệ Hồ sơ chứng từ — TOÀN BỘ LÀ GIẢ (Savitax bản rời, 17/11/2026).
   Bản V2.0.0 gốc dùng một hóa đơn thật (tên, MST, địa chỉ, số điện thoại, tài khoản ngân hàng của doanh nghiệp thật) làm mẫu —
   đã thay hết. MST dạng 9999xxxxxx không thuộc doanh nghiệp nào. Hàng hóa đặt tên chung, không nhãn hiệu.
   Dùng ở: nút "Dùng hóa đơn mẫu", dữ liệu ví dụ lần đầu mở (6-giaoDien.js → seed). */
const MAU_BEN_BAN = { mst: "9999000011", ten: "CÔNG TY TNHH THƯƠNG MẠI MẪU AN PHÚ", dc: "Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu", dd: "Nguyễn Văn Mẫu", cv: "Giám đốc", stk: "0001000000001", nh: "Ngân hàng Mẫu - CN Mẫu", dt: "0900000001", email: "" };
const MAU_BEN_MUA = { mst: "9999100002", ten: "CÔNG TY TNHH THIẾT BỊ MẪU NAM VIỆT", dc: "Số 2 Đường Thử, Phường Thử, Thành phố Mẫu", dd: "Trần Thị Thử", cv: "Giám đốc", stk: "", nh: "", dt: "", email: "" };

const SAMPLE_XML = (() => {
  const hang = [
    ["Bột trét tường nội thất 40kg", "Bao", 10, 300000],
    ["Sơn lót chống kiềm ngoại thất 18L", "Thùng", 8, 2150000],
    ["Sơn phủ nội thất cao cấp 18L", "Thùng", 10, 2400000],
    ["Sơn phủ ngoại thất bóng 5L", "Lon", 12, 1250000],
    ["Chất chống thấm pha xi măng 20kg", "Thùng", 6, 1800000],
    ["Chất tạo màu pha sơn 1L", "Lít", 15, 420000],
  ]
  let tien = 0
  const dong = hang.map(([ten, dvt, sl, dg], i) => { const tt = sl * dg; tien += tt; return `<HHDVu><TChat>1</TChat><STT>${i + 1}</STT><THHDVu>${ten}</THHDVu><DVTinh>${dvt}</DVTinh><SLuong>${sl}</SLuong><DGia>${dg}</DGia><ThTien>${tt}</ThTien><TSuat>8%</TSuat></HHDVu>` }).join("")
  const thue = Math.round(tien * 0.08)
  return `<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon Id="data"><TTChung><PBan>2.0.1</PBan><THDon>Hóa đơn giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon><KHHDon>C26TMA</KHHDon><SHDon>37</SHDon><NLap>2026-09-16</NLap><DVTTe>VND</DVTTe><HTTToan>TM/CK</HTTToan></TTChung>` +
    `<NDHDon><NBan><Ten>${MAU_BEN_BAN.ten}</Ten><MST>${MAU_BEN_BAN.mst}</MST><DChi>${MAU_BEN_BAN.dc}</DChi><SDThoai>${MAU_BEN_BAN.dt}</SDThoai></NBan>` +
    `<NMua><Ten>${MAU_BEN_MUA.ten}</Ten><MST>${MAU_BEN_MUA.mst}</MST><DChi>${MAU_BEN_MUA.dc}</DChi></NMua>` +
    `<DSHHDVu>${dong}</DSHHDVu><TToan><THTTLTSuat><LTSuat><TSuat>8%</TSuat><ThTien>${tien}</ThTien><TThue>${thue}</TThue></LTSuat></THTTLTSuat>` +
    `<TgTCThue>${tien}</TgTCThue><TgTThue>${thue}</TgTThue><TgTTTBSo>${tien + thue}</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`
})();
