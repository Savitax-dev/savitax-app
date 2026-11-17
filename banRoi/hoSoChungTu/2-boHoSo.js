/* Bộ hồ sơ chứng từ theo nghiệp vụ – Savitax Hồ Sơ (bản rời)
   Dữ liệu thuần. Tài khoản ghi theo TT 133/2016/TT-BTC; DN áp dụng TT 200/2014/TT-BTC (từ 01/01/2026 là TT 99/2025/TT-BTC) dùng tài khoản tương ứng (641/642, 521…).
   Căn cứ chính: NĐ 123/2020/NĐ-CP sửa đổi bởi NĐ 70/2025/NĐ-CP (hóa đơn); Luật Thuế GTGT 2024 (chứng từ thanh toán không dùng tiền mặt từ 5 triệu đồng, áp dụng từ 01/7/2025); NĐ 128/2024/NĐ-CP (khuyến mại). */
window.BO_HO_SO = [

 /* =========================== BÁN HÀNG (HÓA ĐƠN ĐẦU RA) =========================== */
 { id: "BAN_HH", ten: "Bán hàng hóa trong nước", nhom: "Bán hàng", chieu: "ban", linhVuc: ["hang_hoa"],
   moTa: "Bán hàng hóa cho tổ chức, cá nhân trong nước theo hợp đồng nguyên tắc + đơn đặt hàng từng lần hoặc hợp đồng mua bán từng lần.",
   dinhKhoan: "GHI NHẬN DOANH THU\nNợ 131/111/112: Tổng giá thanh toán\n   Có 511: Giá chưa thuế GTGT\n   Có 33311: Thuế GTGT đầu ra\nGHI NHẬN GIÁ VỐN\nNợ 632\n   Có 156 (thương mại) / 155 (sản xuất)\nCHI PHÍ BÁN HÀNG (vận chuyển, bốc xếp, đóng gói…)\nNợ 6421 (TT200: 641), Nợ 1331\n   Có 111/112/331",
   luuY: "Hóa đơn phải lập tại thời điểm chuyển giao quyền sở hữu/quyền sử dụng hàng hóa (ngày trên biên bản giao nhận/phiếu xuất kho), không phụ thuộc đã thu tiền hay chưa. Hợp đồng nên ghi rõ hình thức thanh toán chuyển khoản và tài khoản ngân hàng hai bên để người mua đủ điều kiện khấu trừ với hóa đơn từ 5 triệu đồng.",
   items: [
     { ten: "Hợp đồng nguyên tắc mua bán hàng hóa", mau: "HDNT", bb: true, nguon: "Hai bên", ghiChu: "Ghi rõ chính sách thanh toán, thời điểm giao hàng, điều kiện chiết khấu (nếu có). Giao dịch đơn lẻ có thể dùng hợp đồng mua bán từng lần (HDMB)." },
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "Căn cứ đơn giá trên đơn đặt hàng và hóa đơn." },
     { ten: "Đơn đặt hàng theo từng lần", mau: "DDH", bb: true, nguon: "Bên mua", ghiChu: "Bắt buộc khi dùng hợp đồng nguyên tắc." },
     { ten: "Phiếu xuất kho (02-VT)", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "Ngày xuất kho khớp ngày giao hàng và ngày hóa đơn." },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "Có ký nhận của người nhận hàng bên mua (họ tên, chức vụ). Có thể thay bằng biên bản nghiệm thu giá trị hàng hóa." },
     { ten: "Biên bản nghiệm thu giá trị hàng hóa", mau: "BBNT_HH", bb: false, nguon: "Hai bên", ghiChu: "Dùng khi hợp đồng yêu cầu nghiệm thu chất lượng/số lượng." },
     { ten: "Chứng từ vận chuyển, bốc xếp, đóng gói khâu bán hàng", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "Hóa đơn cước vận chuyển, phiếu xuất kho kiêm vận chuyển nội bộ, vận đơn (nếu có)." },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Kiểm tra tên, MST, địa chỉ người mua; thuế suất; ngày lập đúng thời điểm giao hàng." },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "Gửi kèm hóa đơn khi đến hạn thanh toán." },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "Đối chiếu đúng tài khoản người mua; tránh nhận tiền qua tài khoản cá nhân." },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "Định kỳ quý/năm hoặc khi thanh toán chậm, bù trừ công nợ." },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "Khi hợp đồng nguyên tắc hết hiệu lực hoặc hoàn thành hợp đồng từng lần." }
   ] },

 { id: "BAN_DV", ten: "Cung cấp dịch vụ", nhom: "Bán hàng", chieu: "ban", linhVuc: ["dich_vu"],
   moTa: "Cung cấp dịch vụ (tư vấn, kế toán, sửa chữa, vệ sinh, bảo trì, môi giới…) cho khách hàng trong nước.",
   dinhKhoan: "GHI NHẬN DOANH THU\nNợ 131/111/112\n   Có 511 (5113)\n   Có 33311\nTHU TIỀN TRƯỚC NHIỀU KỲ\nNợ 111/112 – Có 3387, Có 33311\nNợ 3387 – Có 511 (phân bổ từng kỳ)\nGIÁ VỐN DỊCH VỤ\nNợ 632 – Có 154",
   luuY: "Thời điểm lập hóa đơn là thời điểm hoàn thành việc cung cấp dịch vụ (ngày biên bản nghiệm thu); nếu thu tiền trước hoặc trong khi cung cấp thì lập hóa đơn tại thời điểm thu tiền (trừ tiền đặt cọc, tạm ứng bảo đảm thực hiện hợp đồng). Cần lưu sản phẩm/báo cáo dịch vụ để chứng minh dịch vụ có thật.",
   items: [
     { ten: "Bảng báo giá dịch vụ", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hợp đồng cung cấp dịch vụ", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "Ghi rõ phạm vi công việc, thời gian hoàn thành, giá trị, phương thức và tài khoản thanh toán." },
     { ten: "Sản phẩm / báo cáo kết quả dịch vụ", mau: null, bb: false, nguon: "Bên bán", ghiChu: "Báo cáo tư vấn, phiếu công tác, nhật ký bảo trì, hình ảnh… chứng minh dịch vụ đã thực hiện." },
     { ten: "Biên bản nghiệm thu hoàn thành dịch vụ", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "Ngày nghiệm thu là căn cứ ngày lập hóa đơn." },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_XD", ten: "Thi công xây dựng, lắp đặt (nhà thầu)", nhom: "Bán hàng", chieu: "ban", linhVuc: ["xay_dung"],
   moTa: "Doanh nghiệp là nhà thầu thi công xây dựng, lắp đặt; ghi nhận doanh thu theo từng đợt nghiệm thu khối lượng hoàn thành.",
   dinhKhoan: "TẬP HỢP CHI PHÍ\nNợ 154 – Có 152/334/331/214…\nDOANH THU THEO ĐỢT NGHIỆM THU\nNợ 131 – Có 511, Có 33311\nGIÁ VỐN\nNợ 632 – Có 154\nTẠM ỨNG CỦA CHỦ ĐẦU TƯ\nNợ 112 – Có 131 (chi tiết ứng trước)",
   luuY: "Hóa đơn lập tại thời điểm nghiệm thu, bàn giao công trình/hạng mục/khối lượng hoàn thành, không phụ thuộc đã thu tiền. Công trình ở tỉnh khác nơi đóng trụ sở phải khai, nộp thuế GTGT vãng lai tại địa phương có công trình. Giá vốn phải khớp dự toán và khối lượng nghiệm thu, tránh lãi gộp bất thường.",
   items: [
     { ten: "Hồ sơ dự thầu / quyết định chỉ định thầu (nếu có)", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hợp đồng thi công xây dựng", mau: "HDXD", bb: true, nguon: "Hai bên", ghiChu: "Kèm phụ lục khối lượng, đơn giá, tiến độ, điều khoản tạm ứng – bảo lãnh – bảo hành." },
     { ten: "Dự toán / bảng khối lượng dự toán", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Căn cứ kiểm soát giá vốn công trình." },
     { ten: "Bản vẽ thiết kế, giấy phép xây dựng (nếu có)", mau: null, bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Bảo lãnh tạm ứng / bảo lãnh thực hiện hợp đồng", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "Theo quy định của hợp đồng." },
     { ten: "Nhật ký thi công", mau: null, bb: true, nguon: "Hai bên", ghiChu: "Có xác nhận của giám sát chủ đầu tư." },
     { ten: "Hồ sơ quản lý chất lượng (biên bản nghiệm thu vật liệu, công việc, thí nghiệm…)", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản nghiệm thu khối lượng hoàn thành (từng đợt)", mau: "BBNT_KL", bb: true, nguon: "Hai bên", ghiChu: "Ngày nghiệm thu là căn cứ lập hóa đơn đợt." },
     { ten: "Bảng xác định giá trị khối lượng hoàn thành đề nghị thanh toán", mau: "BGTKL", bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Bản vẽ hoàn công / sơ họa hoàn công", mau: null, bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng", mau: "BBBG_CT", bb: true, nguon: "Hai bên", ghiChu: "Khi hoàn thành toàn bộ công trình/hạng mục." },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Ghi rõ tên công trình, hạng mục, đợt nghiệm thu." },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Hồ sơ quyết toán công trình", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảo lãnh bảo hành / cam kết bảo hành", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Tờ khai và chứng từ nộp thuế GTGT vãng lai (công trình ngoại tỉnh)", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" }
   ] },

 { id: "BAN_SX", ten: "Bán thành phẩm sản xuất / nhận gia công", nhom: "Bán hàng", chieu: "ban", linhVuc: ["san_xuat"],
   moTa: "Doanh nghiệp sản xuất bán thành phẩm theo đơn hàng, hoặc nhận gia công cho khách hàng (khách giao nguyên vật liệu).",
   dinhKhoan: "BÁN THÀNH PHẨM\nNợ 131/112 – Có 511 (5112), Có 33311\nNợ 632 – Có 155\nNHẬN GIA CÔNG (doanh thu tiền công)\nNợ 131 – Có 511, Có 33311\nNợ 632 – Có 154\nNVL khách giao: theo dõi ngoài bảng / sổ chi tiết hàng nhận gia công",
   luuY: "Phải có định mức tiêu hao nguyên vật liệu và bảng tính giá thành để giải trình giá vốn. Với gia công, hóa đơn chỉ ghi tiền công gia công; cần quyết toán nguyên vật liệu nhận – dùng – trả lại với bên giao gia công.",
   items: [
     { ten: "Hợp đồng nguyên tắc / hợp đồng gia công", mau: "HDGC", bb: true, nguon: "Hai bên", ghiChu: "Bán thành phẩm thông thường có thể dùng HDNT hoặc HDMB." },
     { ten: "Đơn đặt hàng", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Phiếu nhập kho nguyên vật liệu khách giao gia công", mau: "PNK", bb: false, nguon: "Nội bộ", ghiChu: "Chỉ áp dụng khi nhận gia công." },
     { ten: "Định mức tiêu hao nguyên vật liệu, bảng tính giá thành", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu xuất kho thành phẩm (02-VT)", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản nghiệm thu giá trị hàng hóa", mau: "BBNT_HH", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Bảng quyết toán nguyên vật liệu gia công", mau: null, bb: false, nguon: "Hai bên", ghiChu: "Áp dụng khi nhận gia công." },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_VT", ten: "Cung cấp dịch vụ vận tải", nhom: "Bán hàng", chieu: "ban", linhVuc: ["van_tai"],
   moTa: "Doanh nghiệp vận tải cung cấp dịch vụ vận chuyển hàng hóa/hành khách theo hợp đồng.",
   dinhKhoan: "Nợ 131/112 – Có 511, Có 33311\nGIÁ VỐN (nhiên liệu, lương lái xe, khấu hao, cầu đường)\nNợ 154 – Có 152/334/214/331\nNợ 632 – Có 154",
   luuY: "Lập hóa đơn khi hoàn thành chuyến/kỳ vận chuyển theo bảng kê chuyến có xác nhận của khách hàng. Xe phải đứng tên doanh nghiệp hoặc có hợp đồng thuê/hợp tác kinh doanh; nhiên liệu tiêu hao phải khớp định mức và nhật trình.",
   items: [
     { ten: "Hợp đồng vận chuyển hàng hóa", mau: "HDVC", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng báo giá cước", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Lệnh vận chuyển / phiếu điều xe", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng (có ký nhận tại điểm trả hàng)", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng kê chuyến / sản lượng vận chuyển có xác nhận khách hàng", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản nghiệm thu hoàn thành dịch vụ", mau: "BBNT_DV", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_THUE_TS", ten: "Cho thuê tài sản (văn phòng, kho, xe, máy móc)", nhom: "Bán hàng", chieu: "ban", linhVuc: ["thue_ts"],
   moTa: "Doanh nghiệp cho thuê văn phòng, nhà xưởng, kho bãi, phương tiện, máy móc thiết bị.",
   dinhKhoan: "DOANH THU TỪNG KỲ\nNợ 131/112 – Có 511 (5113), Có 33311\nTHU TRƯỚC NHIỀU KỲ\nNợ 112 – Có 3387, Có 33311\nNợ 3387 – Có 511 (phân bổ)\nKHẤU HAO TÀI SẢN CHO THUÊ\nNợ 632 – Có 214",
   luuY: "Hóa đơn lập theo kỳ thanh toán ghi trong hợp đồng; thu tiền trước nhiều kỳ thì lập hóa đơn khi thu tiền. Tiền đặt cọc thuê không lập hóa đơn nhưng phải hạch toán 344 và có điều khoản rõ trong hợp đồng.",
   items: [
     { ten: "Hợp đồng thuê tài sản", mau: "HDTHUE", bb: true, nguon: "Hai bên", ghiChu: "Ghi rõ kỳ thanh toán, tiền cọc, trách nhiệm điện nước." },
     { ten: "Giấy tờ chứng minh quyền sở hữu/quyền sử dụng tài sản cho thuê", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Sổ đỏ, đăng ký xe, hóa đơn mua tài sản." },
     { ten: "Biên bản bàn giao tài sản cho thuê", mau: "BBBG_TS", bb: true, nguon: "Hai bên", ghiChu: "Ghi tình trạng tài sản khi bàn giao và khi nhận lại." },
     { ten: "Hóa đơn GTGT điện tử (theo kỳ thanh toán)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "Kèm biên bản nhận lại tài sản, quyết toán tiền cọc." }
   ] },

 { id: "BAN_KM", ten: "Hàng khuyến mại", nhom: "Bán hàng", chieu: "ban", linhVuc: ["khuyen_mai"],
   moTa: "Hàng hóa, dịch vụ tặng miễn phí hoặc bán giá 0 đồng trong chương trình khuyến mại theo Luật Thương mại và NĐ 128/2024/NĐ-CP.",
   dinhKhoan: "KHUYẾN MẠI ĐỦ ĐIỀU KIỆN (giá tính thuế = 0)\nNợ 6421 (TT200: 641)\n   Có 156/155/154: Giá vốn\nKHUYẾN MẠI KHÔNG ĐỦ ĐIỀU KIỆN\nHạch toán và tính thuế như bán hàng thông thường",
   luuY: "Chỉ được tính giá tính thuế GTGT bằng 0 khi chương trình được xây dựng và thực hiện đúng quy định thương mại (quyết định, thông báo Sở Công Thương khi thuộc diện phải thông báo, hạn mức giá trị khuyến mại). Hóa đơn ghi tên, số lượng hàng hóa và ghi rõ là hàng khuyến mại; thiếu hồ sơ sẽ bị ấn định thuế GTGT như bán hàng.",
   items: [
     { ten: "Quyết định ban hành chương trình khuyến mại", mau: "QD_KM", bb: true, nguon: "Nội bộ", ghiChu: "Nêu thời gian, hàng hóa khuyến mại, hình thức, đối tượng, tổng giá trị." },
     { ten: "Chính sách khuyến mại của công ty", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Thông báo / văn bản xác nhận chương trình khuyến mại của Sở Công Thương", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "Bắt buộc với chương trình thuộc diện phải thông báo theo NĐ 128/2024 (gửi trước khi thực hiện)." },
     { ten: "Tài liệu truyền thông, quảng cáo chương trình", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "Chứng minh mục đích xúc tiến bán hàng." },
     { ten: "Phiếu xuất kho hàng khuyến mại (ghi rõ lý do xuất)", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách khách hàng nhận hàng khuyến mại (có ký nhận)", mau: null, bb: true, nguon: "Bên mua", ghiChu: "" },
     { ten: "Hóa đơn GTGT hàng khuyến mại (giá tính thuế 0 đồng)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Có thể ghi trên cùng hóa đơn bán hàng." },
     { ten: "Báo cáo kết quả thực hiện khuyến mại (nếu thuộc diện phải báo cáo)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "BAN_CKTM", ten: "Chiết khấu thương mại cho khách hàng", nhom: "Bán hàng", chieu: "ban", linhVuc: ["ck_thuong_mai"],
   moTa: "Giảm giá niêm yết cho khách hàng mua số lượng lớn, đạt doanh số theo chính sách đã ban hành.",
   dinhKhoan: "Nợ 511 (TT200: 5211): Giảm doanh thu\nNợ 33311: Giảm thuế GTGT đầu ra\n   Có 131/111/112",
   luuY: "Chính sách chiết khấu phải ban hành và có hiệu lực trước khi phát sinh giao dịch, điều kiện hưởng rõ ràng. Chiết khấu ngay trên từng lần mua thì ghi trên hóa đơn; chiết khấu theo doanh số cuối kỳ thì lập hóa đơn điều chỉnh giảm kèm bảng kê các hóa đơn được chiết khấu. Không cần thông báo với cơ quan quản lý.",
   items: [
     { ten: "Chính sách / quyết định chiết khấu thương mại", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "Nêu điều kiện số lượng, doanh số, thời gian." },
     { ten: "Hợp đồng nguyên tắc có điều khoản chiết khấu", mau: "HDNT", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng tính chiết khấu thương mại cuối kỳ", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "Tổng hợp doanh số, mức được hưởng." },
     { ten: "Biên bản xác nhận doanh số & chiết khấu thương mại", mau: "BBXN_CK", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn điều chỉnh giảm (chiết khấu cuối kỳ) hoặc hóa đơn có dòng chiết khấu", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ thanh toán / bù trừ công nợ", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "DC_HD", ten: "Điều chỉnh / thay thế hóa đơn", nhom: "Điều chỉnh", chieu: "ca2", linhVuc: ["dieu_chinh"],
   moTa: "Hóa đơn đã gửi người mua có sai sót (giá, số lượng, thuế suất, MST…) phải lập hóa đơn điều chỉnh hoặc thay thế theo NĐ 123/2020 sửa đổi bởi NĐ 70/2025.",
   dinhKhoan: "BÊN BÁN – điều chỉnh giảm\nNợ 511, Nợ 33311 – Có 131\nBÊN BÁN – điều chỉnh tăng: ghi ngược lại\nBÊN MUA – điều chỉnh giảm\nNợ 331 – Có 156/152/chi phí, Có 1331\nBÊN MUA – điều chỉnh tăng: ghi ngược lại",
   luuY: "Người mua là doanh nghiệp/tổ chức: hai bên phải có văn bản thỏa thuận ghi rõ sai sót trước khi lập hóa đơn điều chỉnh/thay thế. Hóa đơn điều chỉnh phải ghi “Điều chỉnh cho hóa đơn mẫu số… ký hiệu… số… ngày…”; khai bổ sung vào kỳ phát sinh hóa đơn điều chỉnh. Sai tên, địa chỉ nhưng đúng MST chỉ cần thông báo, không phải lập lại hóa đơn.",
   items: [
     { ten: "Hóa đơn gốc bị sai sót", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hợp đồng / phụ lục hợp đồng liên quan nội dung điều chỉnh", mau: null, bb: false, nguon: "Hai bên", ghiChu: "Điều chỉnh giá, khối lượng phải có phụ lục hợp đồng." },
     { ten: "Biên bản điều chỉnh hóa đơn (thỏa thuận hai bên)", mau: "BBDC_HD", bb: true, nguon: "Hai bên", ghiChu: "Lập trước hóa đơn điều chỉnh/thay thế." },
     { ten: "Hóa đơn điều chỉnh / hóa đơn thay thế", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Phiếu nhập / xuất kho điều chỉnh, biên bản giao nhận (nếu điều chỉnh số lượng)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ sau điều chỉnh", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ thanh toán / hoàn tiền chênh lệch", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "BAN_GGHB", ten: "Giảm giá hàng bán (hàng lỗi, sai quy cách)", nhom: "Bán hàng", chieu: "ban", linhVuc: ["dieu_chinh"],
   moTa: "Giảm giá cho người mua do hàng kém phẩm chất, sai quy cách, giao chậm so với hợp đồng.",
   dinhKhoan: "Nợ 511 (TT200: 5213): Giảm doanh thu\nNợ 33311\n   Có 131/111/112",
   luuY: "Phải có biên bản xác nhận lỗi và thỏa thuận giảm giá trước khi lập hóa đơn điều chỉnh giảm (ghi rõ “giảm giá hàng bán”). Không cần thông báo với cơ quan quản lý.",
   items: [
     { ten: "Hợp đồng mua bán hàng hóa", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "Thể hiện quyền, nghĩa vụ về chất lượng hàng hóa." },
     { ten: "Biên bản kiểm nghiệm hàng hóa (nếu có)", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản điều chỉnh hóa đơn / xác nhận giảm giá", mau: "BBDC_HD", bb: true, nguon: "Hai bên", ghiChu: "Nêu lý do, số lượng, giá trị giảm, cách xử lý." },
     { ten: "Hóa đơn điều chỉnh giảm giá hàng bán", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ thanh toán / bù trừ công nợ", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "BAN_TRL", ten: "Hàng bán bị trả lại", nhom: "Bán hàng", chieu: "ban", linhVuc: ["tra_lai"],
   moTa: "Người mua trả lại một phần hoặc toàn bộ hàng đã mua do không đúng cam kết.",
   dinhKhoan: "GIẢM DOANH THU\nNợ 511 (TT200: 5212)\nNợ 33311\n   Có 131/111/112\nNHẬP LẠI KHO\nNợ 156/155\n   Có 632",
   luuY: "Người bán lập hóa đơn điều chỉnh giảm cho hóa đơn đã lập; nếu hai bên thỏa thuận người mua lập hóa đơn trả lại hàng thì người mua lập. Phiếu nhập kho hàng trả lại phải khớp số lượng trên biên bản trả lại hàng.",
   items: [
     { ten: "Hợp đồng và hóa đơn bán hàng gốc", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản trả lại hàng", mau: "BBTRL", bb: true, nguon: "Hai bên", ghiChu: "Nêu lý do, số lượng, giá trị, hóa đơn gốc." },
     { ten: "Phiếu nhập kho hàng bán bị trả lại (01-VT)", mau: "PNK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn điều chỉnh giảm (bên bán) hoặc hóa đơn trả lại hàng (bên mua)", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ hoàn tiền (nếu đã thu)", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "BAN_XK", ten: "Xuất khẩu hàng hóa", nhom: "Bán hàng", chieu: "ban", linhVuc: ["xuat_khau"],
   moTa: "Bán hàng hóa ra nước ngoài hoặc vào khu phi thuế quan, áp dụng thuế suất GTGT 0%.",
   dinhKhoan: "GHI NHẬN DOANH THU\nNợ 131/112 – Có 511\nGIÁ VỐN\nNợ 632 – Có 156/155/154\nTHUẾ XUẤT KHẨU PHẢI NỘP (nếu có)\nNợ 511 – Có 3333\nNỘP THUẾ XK\nNợ 3333 – Có 112\nCHI PHÍ BÁN HÀNG\nNợ 6421 (TT200: 641), Nợ 1331 – Có 111/112/331",
   luuY: "Để áp dụng thuế suất 0% và khấu trừ/hoàn thuế đầu vào cần đủ: hợp đồng, chứng từ thanh toán qua ngân hàng và tờ khai hải quan. Hóa đơn xuất khẩu lập chậm nhất không quá ngày làm việc tiếp theo kể từ ngày hàng hóa được thông quan; doanh thu quy đổi theo tỷ giá mua của ngân hàng nơi nhận tiền.",
   items: [
     { ten: "Hợp đồng ngoại thương (Sales contract)", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "Có thể là hợp đồng nguyên tắc + đơn hàng (PO) từng lần." },
     { ten: "Đơn đặt hàng / Purchase Order", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Commercial Invoice + Packing list", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Phiếu xuất kho / phiếu xuất kho kiêm vận chuyển nội bộ", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Tờ khai hải quan xuất khẩu (đã thông quan)", mau: null, bb: true, nguon: "Hải quan", ghiChu: "" },
     { ten: "Vận đơn (Bill of Lading / AWB), xác nhận hàng qua khu vực giám sát", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "C/O, chứng thư kiểm định, giấy chứng nhận khác (nếu có)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Chứng từ chi phí khâu xuất khẩu (vận chuyển, bốc xếp, kho bãi, phí hải quan)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử (thuế suất 0%)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ nộp thuế xuất khẩu (nếu có)", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Chứng từ thanh toán qua ngân hàng (điện MT103 / giấy báo có ngoại tệ)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "Thanh toán bù trừ phải có thỏa thuận trong hợp đồng." },
     { ten: "Biên bản đối chiếu công nợ / hồ sơ đối trừ công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_QC", ten: "Cung cấp dịch vụ quảng cáo, truyền thông", nhom: "Bán hàng", chieu: "ban", linhVuc: ["quang_cao"],
   moTa: "Doanh nghiệp cung cấp dịch vụ quảng cáo, chạy quảng cáo trực tuyến, sản xuất nội dung, tổ chức sự kiện truyền thông.",
   dinhKhoan: "Nợ 131/112 – Có 511, Có 33311\nCHI PHÍ MUA QUẢNG CÁO ĐỂ BÁN LẠI\nNợ 154 – Có 331/112\nNợ 632 – Có 154",
   luuY: "Phải có báo cáo kết quả chạy quảng cáo (số hiển thị, ảnh chụp, đường dẫn) làm bằng chứng nghiệm thu. Nếu mua lại quảng cáo của nền tảng nước ngoài để bán lại, kiểm tra chứng từ và nghĩa vụ thuế nhà thầu để giá vốn được trừ.",
   items: [
     { ten: "Bảng báo giá / kế hoạch truyền thông", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hợp đồng cung cấp dịch vụ quảng cáo", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Nội dung/maket quảng cáo được khách hàng duyệt", mau: null, bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Báo cáo kết quả quảng cáo, hình ảnh nghiệm thu", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản nghiệm thu hoàn thành dịch vụ", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_DT", ten: "Cung cấp dịch vụ đào tạo, khóa học", nhom: "Bán hàng", chieu: "ban", linhVuc: ["dao_tao"],
   moTa: "Tổ chức khóa đào tạo, khóa học kỹ năng, đào tạo nghề, đào tạo nội bộ cho doanh nghiệp hoặc học viên cá nhân.",
   dinhKhoan: "THU HỌC PHÍ TRƯỚC\nNợ 111/112 – Có 3387 (hoặc 131 ứng trước)\nGHI NHẬN DOANH THU THEO TIẾN ĐỘ KHÓA HỌC\nNợ 3387/131 – Có 511, Có 33311 (nếu chịu thuế)\nCHI PHÍ GIẢNG VIÊN, TÀI LIỆU\nNợ 154 – Có 334/3335/331\nNợ 632 – Có 154",
   luuY: "Học phí thu trước khi giảng dạy thì lập hóa đơn tại thời điểm thu tiền. Dạy học, dạy nghề theo quy định pháp luật thuộc đối tượng không chịu thuế GTGT; khóa học không đủ điều kiện thì chịu thuế GTGT. Thù lao giảng viên thuê ngoài từ 2 triệu đồng/lần phải khấu trừ thuế TNCN 10%.",
   items: [
     { ten: "Giấy phép / quyết định cho phép hoạt động đào tạo (nếu thuộc diện phải có)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "Căn cứ áp dụng không chịu thuế GTGT." },
     { ten: "Hợp đồng đào tạo / phiếu đăng ký học", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "Học viên cá nhân: phiếu đăng ký + điều khoản khóa học." },
     { ten: "Chương trình, lịch học, giáo trình", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Danh sách học viên, bảng điểm danh", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hợp đồng và chứng từ chi thù lao giảng viên", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "Kèm chứng từ khấu trừ thuế TNCN." },
     { ten: "Biên bản nghiệm thu hoàn thành khóa đào tạo", mau: "BBNT_DV", bb: false, nguon: "Hai bên", ghiChu: "Áp dụng khi khách hàng là doanh nghiệp." },
     { ten: "Chứng chỉ / giấy chứng nhận hoàn thành cấp cho học viên", mau: null, bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hóa đơn điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Ghi rõ tên khóa học, thời gian; dòng thuế suất “KCT” nếu không chịu thuế." },
     { ten: "Chứng từ thu học phí (giấy báo có / phiếu thu)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "BAN_PM", ten: "Cung cấp phần mềm, dịch vụ phần mềm", nhom: "Bán hàng", chieu: "ban", linhVuc: ["phan_mem"],
   moTa: "Bán bản quyền phần mềm, cung cấp dịch vụ phần mềm (thiết kế, cài đặt, bảo trì, SaaS).",
   dinhKhoan: "Nợ 131/112 – Có 511 (không có thuế GTGT nếu là phần mềm/dịch vụ phần mềm)\nTHU TRƯỚC PHÍ THUÊ BAO NHIỀU KỲ\nNợ 112 – Có 3387\nNợ 3387 – Có 511\nGIÁ VỐN\nNợ 632 – Có 154",
   luuY: "Sản phẩm phần mềm và dịch vụ phần mềm thuộc đối tượng không chịu thuế GTGT; nếu bán kèm thiết bị phần cứng, dịch vụ đào tạo… thì phải tách riêng giá trị và áp thuế suất tương ứng. Hợp đồng phải mô tả rõ phần mềm/dịch vụ phần mềm để được áp dụng.",
   items: [
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Hợp đồng cung cấp phần mềm / dịch vụ phần mềm", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "Tách riêng phần cứng, phần mềm, dịch vụ khác." },
     { ten: "Đơn đặt hàng / phiếu yêu cầu", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Tài liệu đặc tả, giấy chứng nhận bản quyền / license key", mau: null, bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản nghiệm thu, bàn giao phần mềm", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn điện tử (không chịu thuế GTGT)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán (giấy báo có / sao kê ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 /* =========================== MUA VÀO (HÓA ĐƠN ĐẦU VÀO) =========================== */
 { id: "MUA_HH", ten: "Mua hàng hóa, nguyên vật liệu trong nước", nhom: "Mua hàng", chieu: "mua", linhVuc: ["hang_hoa"],
   moTa: "Mua hàng hóa để bán, nguyên vật liệu để sản xuất từ nhà cung cấp trong nước.",
   dinhKhoan: "GHI NHẬN GIÁ TRỊ HÀNG MUA\nNợ 156/152/153/154…: Giá chưa thuế\nNợ 1331: Thuế GTGT được khấu trừ\n   Có 331/111/112: Tổng thanh toán\nCHI PHÍ MUA (vận chuyển, bốc xếp…)\nNợ 156 (1562)/152, Nợ 1331 – Có 111/112/331",
   luuY: "Hóa đơn từ 5 triệu đồng trở lên phải có chứng từ thanh toán không dùng tiền mặt mới được khấu trừ thuế GTGT và tính vào chi phí được trừ (từ 01/7/2025); mua trả chậm phải có hợp đồng ghi hình thức chuyển khoản. Ngày phiếu nhập kho, biên bản giao nhận phải khớp ngày hóa đơn; kiểm tra tình trạng hoạt động MST nhà cung cấp trước khi thanh toán.",
   items: [
     { ten: "Hợp đồng nguyên tắc mua bán hàng hóa", mau: "HDNT", bb: true, nguon: "Hai bên", ghiChu: "Giao dịch đơn lẻ có thể dùng hợp đồng mua bán từng lần (HDMB)." },
     { ten: "Bảng báo giá của nhà cung cấp", mau: "BG", bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Đơn đặt hàng theo từng lần", mau: "DDH", bb: true, nguon: "Bên mua", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "Hoặc biên bản nghiệm thu giá trị hàng hóa." },
     { ten: "Biên bản nghiệm thu giá trị hàng hóa", mau: "BBNT_HH", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Phiếu nhập kho (01-VT)", mau: "PNK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Tra cứu hóa đơn trên hệ thống của cơ quan thuế; thông tin người mua đúng theo đăng ký thuế." },
     { ten: "Chứng từ chi phí khâu mua (vận chuyển, bốc xếp, kho bãi)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "Bộ phận mua hàng lập, kế toán trưởng/giám đốc duyệt." },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "Bắt buộc với hóa đơn từ 5 triệu đồng trở lên." },
     { ten: "Biên bản đối chiếu công nợ phải trả", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "Kèm hồ sơ bù trừ công nợ nếu có." },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_DV", ten: "Mua dịch vụ (tư vấn, kế toán, kiểm toán, sửa chữa…)", nhom: "Chi phí", chieu: "mua", linhVuc: ["dich_vu"],
   moTa: "Chi phí dịch vụ thuê ngoài: tư vấn, kế toán, kiểm toán, thẩm định giá, kiểm định, bảo trì, vệ sinh, bảo vệ…",
   dinhKhoan: "Nợ 6422/6421/154/627 (TT200: 642/641/627)\nNợ 1331\n   Có 331/111/112\nDỊCH VỤ TRẢ TRƯỚC NHIỀU KỲ\nNợ 242, Nợ 1331 – Có 331/112\nNợ 6422 – Có 242 (phân bổ)",
   luuY: "Chi phí phải gắn với hoạt động sản xuất kinh doanh và có bằng chứng dịch vụ đã thực hiện (báo cáo, biên bản nghiệm thu). Dịch vụ từ 5 triệu đồng phải thanh toán chuyển khoản; phân quyền phê duyệt chi phí theo quy chế tài chính.",
   items: [
     { ten: "Phiếu yêu cầu / tờ trình phê duyệt chủ trương", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hợp đồng cung cấp dịch vụ", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Sản phẩm dịch vụ (báo cáo tư vấn, báo cáo kiểm toán, chứng thư thẩm định, giấy chứng nhận kiểm định…)", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "Hồ sơ khác theo yêu cầu của hợp đồng." },
     { ten: "Biên bản nghiệm thu hoàn thành dịch vụ", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Công văn đề nghị thanh toán của nhà cung cấp", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_XD", ten: "Thuê thi công xây dựng, sửa chữa lớn (chủ đầu tư)", nhom: "Mua hàng", chieu: "mua", linhVuc: ["xay_dung"],
   moTa: "Doanh nghiệp là chủ đầu tư thuê nhà thầu xây dựng, cải tạo, sửa chữa lớn nhà xưởng, văn phòng; chi phí xây dựng cơ bản dở dang.",
   dinhKhoan: "TẠM ỨNG CHO NHÀ THẦU\nNợ 331 – Có 112\nGIÁ TRỊ KHỐI LƯỢNG NGHIỆM THU\nNợ 241 (2412), Nợ 1332\n   Có 331\nHOÀN THÀNH BÀN GIAO\nNợ 211 – Có 241\n(Sửa chữa nhỏ: Nợ 242/6422 – Có 241/331)",
   luuY: "Hóa đơn của nhà thầu lập theo từng đợt nghiệm thu, sau khi chủ đầu tư xác nhận giá trị; không ghi nhận tăng tài sản khi chưa có biên bản bàn giao. Thanh toán qua ngân hàng; giữ lại tiền bảo hành theo hợp đồng.",
   items: [
     { ten: "Tờ trình / quyết định phê duyệt dự án, dự toán", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng thi công xây dựng", mau: "HDXD", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Dự toán, bản vẽ, giấy phép xây dựng", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hồ sơ năng lực nhà thầu, bảo lãnh tạm ứng / thực hiện hợp đồng", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "Theo quy định của hợp đồng." },
     { ten: "Nhật ký thi công, hồ sơ quản lý chất lượng", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản nghiệm thu khối lượng hoàn thành (từng đợt)", mau: "BBNT_KL", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng xác định giá trị khối lượng hoàn thành đề nghị thanh toán", mau: "BGTKL", bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử của nhà thầu", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nhà cung cấp", ghiChu: "Kèm công văn đề nghị thanh toán đợt." },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Bản vẽ hoàn công", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng", mau: "BBBG_CT", bb: true, nguon: "Hai bên", ghiChu: "Căn cứ ghi tăng TSCĐ." },
     { ten: "Hồ sơ quyết toán công trình", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảo lãnh bảo hành / cam kết bảo hành", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_SX", ten: "Thuê gia công, sản xuất bên ngoài", nhom: "Mua hàng", chieu: "mua", linhVuc: ["san_xuat"],
   moTa: "Doanh nghiệp đưa nguyên vật liệu đi thuê đơn vị khác gia công, chế biến thành sản phẩm.",
   dinhKhoan: "XUẤT NVL ĐI GIA CÔNG\nNợ 154 – Có 152\nCHI PHÍ GIA CÔNG\nNợ 154, Nợ 1331 – Có 331\nNHẬP KHO THÀNH PHẨM\nNợ 155/156 – Có 154",
   luuY: "Phải theo dõi nguyên vật liệu xuất đi – thành phẩm nhận về – phế liệu thu hồi và quyết toán với bên gia công; chênh lệch hao hụt vượt định mức không được tính vào chi phí được trừ.",
   items: [
     { ten: "Hợp đồng gia công", mau: "HDGC", bb: true, nguon: "Hai bên", ghiChu: "Ghi rõ định mức tiêu hao, tỷ lệ hao hụt cho phép." },
     { ten: "Đơn đặt hàng gia công", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Phiếu xuất kho nguyên vật liệu đi gia công (kiêm vận chuyển nội bộ)", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản giao nhận nguyên vật liệu / thành phẩm", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản nghiệm thu giá trị hàng hóa gia công", mau: "BBNT_HH", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Phiếu nhập kho thành phẩm (01-VT)", mau: "PNK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng quyết toán nguyên vật liệu gia công", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT tiền công gia công", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_VT", ten: "Thuê dịch vụ vận chuyển", nhom: "Chi phí", chieu: "mua", linhVuc: ["van_tai"],
   moTa: "Thuê đơn vị vận tải chở hàng mua về, giao hàng bán cho khách, chuyển phát nhanh.",
   dinhKhoan: "VẬN CHUYỂN HÀNG MUA\nNợ 156 (1562)/152, Nợ 1331 – Có 331/111/112\nVẬN CHUYỂN HÀNG BÁN\nNợ 6421 (TT200: 641), Nợ 1331 – Có 331/111/112",
   luuY: "Phải có bảng kê chuyến hoặc biên bản giao nhận khớp với hóa đơn bán/mua hàng tương ứng để chứng minh chi phí vận chuyển có thật. Hóa đơn từ 5 triệu đồng thanh toán chuyển khoản.",
   items: [
     { ten: "Hợp đồng vận chuyển hàng hóa", mau: "HDVC", bb: true, nguon: "Hai bên", ghiChu: "Vận chuyển lẻ có thể thay bằng báo giá + xác nhận đặt xe." },
     { ten: "Bảng báo giá cước", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng / phiếu giao hàng có ký nhận", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng kê chuyến / bảng kê chi tiết vận đơn", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_THUE_TS", ten: "Thuê tài sản của doanh nghiệp (văn phòng, kho, xe, máy)", nhom: "Chi phí", chieu: "mua", linhVuc: ["thue_ts"],
   moTa: "Thuê văn phòng, kho bãi, nhà xưởng, xe ô tô, máy móc của tổ chức có xuất hóa đơn.",
   dinhKhoan: "THUÊ TRẢ THEO KỲ\nNợ 6422/6421/627/154, Nợ 1331 – Có 331/112\nTRẢ TRƯỚC NHIỀU KỲ\nNợ 242, Nợ 1331 – Có 112\nNợ 6422 – Có 242 (phân bổ)\nĐẶT CỌC\nNợ 244 – Có 112",
   luuY: "Tiền thuê trả trước nhiều năm được phân bổ dần vào chi phí theo số năm trả tiền. Điện, nước của địa điểm thuê mà hóa đơn mang tên chủ nhà chỉ được tính chi phí khi hợp đồng thuê ghi rõ bên thuê chịu và có chứng từ thanh toán.",
   items: [
     { ten: "Hợp đồng thuê tài sản", mau: "HDTHUE", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản bàn giao tài sản thuê", mau: "BBBG_TS", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Công văn / thông báo đề nghị thanh toán của bên cho thuê", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Bảng phân bổ chi phí trả trước (nếu trả nhiều kỳ)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng / trả lại tài sản", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_TSCD", ten: "Mua tài sản cố định", nhom: "Tài sản", chieu: "mua", linhVuc: ["tscd"],
   moTa: "Mua tài sản có nguyên giá từ 30 triệu đồng, thời gian sử dụng trên 1 năm (máy móc, thiết bị, phương tiện, máy tính…).",
   dinhKhoan: "GHI TĂNG TSCĐ\nNợ 211 (TSCĐ vô hình: 213)\nNợ 1332\n   Có 331/112\nLỆ PHÍ TRƯỚC BẠ, CHI PHÍ LẮP ĐẶT\nNợ 211 – Có 3339/111/112\nKHẤU HAO HÀNG THÁNG\nNợ 6422/6421/627/154 – Có 214",
   luuY: "Nguyên giá từ 30 triệu đồng và thời gian sử dụng trên 1 năm mới ghi nhận TSCĐ; thời gian khấu hao theo khung của Bộ Tài chính. Ô tô chở người dưới 9 chỗ: phần khấu hao tương ứng nguyên giá vượt 1,6 tỷ đồng không được trừ. Hóa đơn từ 5 triệu đồng phải thanh toán chuyển khoản mới được khấu trừ thuế GTGT.",
   items: [
     { ten: "Phiếu yêu cầu / tờ trình mua sắm được phê duyệt", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng báo giá (nên có từ 2–3 nhà cung cấp)", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hợp đồng mua bán", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Phiếu bảo hành, catalogue, CO/CQ", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản bàn giao TSCĐ đưa vào sử dụng", mau: "BBBG_TS", bb: true, nguon: "Nội bộ", ghiChu: "Bàn giao cho bộ phận sử dụng." },
     { ten: "Quyết định ghi tăng TSCĐ, thẻ TSCĐ, bảng đăng ký trích khấu hao", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đăng ký, tờ khai và chứng từ nộp lệ phí trước bạ (phương tiện, nhà đất)", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản thanh lý hợp đồng", mau: "BBTL", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_CCDC", ten: "Mua công cụ dụng cụ", nhom: "Tài sản", chieu: "mua", linhVuc: ["ccdc"],
   moTa: "Mua công cụ dụng cụ, thiết bị văn phòng giá trị dưới 30 triệu đồng (bàn ghế, điện thoại, máy in…).",
   dinhKhoan: "NHẬP KHO\nNợ 153, Nợ 1331 – Có 331/111/112\nXUẤT DÙNG PHÂN BỔ NHIỀU KỲ\nNợ 242 – Có 153\nNợ 6422/6421/627 – Có 242 (phân bổ tối đa 3 năm)\nGIÁ TRỊ NHỎ – TÍNH THẲNG CHI PHÍ\nNợ 6422, Nợ 1331 – Có 111/112",
   luuY: "Công cụ dụng cụ có thời gian sử dụng trên 1 năm phải phân bổ, không đưa hết vào chi phí một lần. Lập bảng theo dõi CCDC theo bộ phận sử dụng để giải trình khi quyết toán.",
   items: [
     { ten: "Phiếu yêu cầu mua sắm", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Đơn đặt hàng / hợp đồng mua bán (nếu có)", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Phiếu nhập kho (nếu nhập kho)", mau: "PNK", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản bàn giao CCDC cho bộ phận sử dụng", mau: "BBBG_TS", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng phân bổ công cụ dụng cụ", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "Bắt buộc với hóa đơn từ 5 triệu đồng." }
   ] },

 { id: "MUA_CKTM", ten: "Nhận chiết khấu thương mại từ nhà cung cấp", nhom: "Mua hàng", chieu: "mua", linhVuc: ["ck_thuong_mai"],
   moTa: "Doanh nghiệp được nhà cung cấp chiết khấu do mua số lượng lớn, đạt doanh số.",
   dinhKhoan: "HÀNG CÒN TỒN KHO\nNợ 331/111/112 – Có 156/152, Có 1331\nHÀNG ĐÃ BÁN\nNợ 331/111/112 – Có 632, Có 1331",
   luuY: "Phải điều chỉnh giảm thuế GTGT đầu vào tương ứng theo hóa đơn điều chỉnh của nhà cung cấp. Khoản hỗ trợ bằng tiền không gắn với số lượng hàng mua thì không phải chiết khấu thương mại, cần xem lại bản chất để hạch toán.",
   items: [
     { ten: "Chính sách chiết khấu của nhà cung cấp / hợp đồng có điều khoản chiết khấu", mau: "HDNT", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản xác nhận doanh số & chiết khấu thương mại", mau: "BBXN_CK", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn điều chỉnh giảm / hóa đơn có dòng chiết khấu", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ nhận tiền / bù trừ công nợ", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_TRL", ten: "Trả lại hàng mua cho nhà cung cấp", nhom: "Mua hàng", chieu: "mua", linhVuc: ["tra_lai"],
   moTa: "Doanh nghiệp trả lại hàng đã mua do sai quy cách, kém chất lượng.",
   dinhKhoan: "Nợ 331/111/112\n   Có 156/152/153\n   Có 1331",
   luuY: "Phải có hóa đơn điều chỉnh giảm của người bán (hoặc hóa đơn trả lại hàng do doanh nghiệp lập nếu hai bên thỏa thuận) để giảm thuế GTGT đầu vào; không tự ghi giảm khi chưa có hóa đơn.",
   items: [
     { ten: "Hóa đơn mua hàng gốc", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản trả lại hàng", mau: "BBTRL", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Phiếu xuất kho hàng trả lại", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng trả lại", mau: "BBGN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn điều chỉnh giảm (người bán) / hóa đơn trả lại hàng (doanh nghiệp lập)", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ nhận lại tiền (nếu đã thanh toán)", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_CONG_TAC", ten: "Chi phí công tác (khách sạn, vé máy bay, taxi, ăn uống)", nhom: "Chi phí", chieu: "mua", linhVuc: ["cong_tac"],
   moTa: "Hóa đơn khách sạn, vé máy bay, tàu xe, taxi, ăn uống phát sinh khi nhân viên đi công tác hoặc tiếp khách.",
   dinhKhoan: "Nợ 6422/6421 (TT200: 642/641)\nNợ 1331\n   Có 141 (tạm ứng) / 111 / 112 / 331",
   luuY: "Hóa đơn phải ghi tên, MST công ty; hóa đơn từ 5 triệu đồng phải thanh toán không dùng tiền mặt (thanh toán bằng thẻ của nhân viên thường được chấp nhận khi quy chế tài chính cho phép và công ty hoàn trả lại cho nhân viên qua ngân hàng). Vé máy bay cần kèm thẻ lên máy bay; chi phí phải nằm trong định mức quy chế công tác phí.",
   items: [
     { ten: "Quyết định cử đi công tác / kế hoạch công tác", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đi đường", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn khách sạn, ăn uống, taxi kèm bảng kê chi tiết", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Vé máy bay điện tử + thẻ lên máy bay (boarding pass)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Báo cáo kết quả công tác", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán / thanh toán tạm ứng", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán (UNC, sao kê thẻ, phiếu chi)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Quy chế tài chính – quy định công tác phí", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "Lưu một bản chung trong hồ sơ pháp lý." }
   ] },

 { id: "MUA_DIEN_NUOC", ten: "Điện, nước, internet, viễn thông", nhom: "Chi phí", chieu: "mua", linhVuc: ["dien_nuoc"],
   moTa: "Chi phí điện, nước, internet, điện thoại, kênh truyền hàng tháng.",
   dinhKhoan: "Nợ 6422/6421/627 (TT200: 642/641/627)\nNợ 1331\n   Có 331/111/112",
   luuY: "Hóa đơn phải mang tên công ty; nếu mang tên chủ nhà (địa điểm thuê) phải có hợp đồng thuê ghi rõ bên thuê thanh toán điện nước và chứng từ thanh toán. Điện thoại di động cá nhân của nhân viên chỉ tính chi phí khi có quy chế khoán và ghi trong hợp đồng lao động.",
   items: [
     { ten: "Hợp đồng dịch vụ điện / nước / viễn thông", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "Lưu một bản trong hồ sơ pháp lý." },
     { ten: "Thông báo tiền điện / bảng xác nhận chỉ số công tơ / bảng kê cước", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / trích nợ tự động / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Hợp đồng thuê địa điểm (nếu hóa đơn mang tên chủ nhà)", mau: "HDTHUE", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản ghi nhận sự cố, hóa đơn điều chỉnh (nếu có)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" }
   ] },

 { id: "MUA_XANG_DAU", ten: "Xăng dầu, chi phí xe ô tô", nhom: "Chi phí", chieu: "mua", linhVuc: ["xang_dau"],
   moTa: "Nhiên liệu, vé cầu đường, gửi xe, bảo dưỡng phương tiện phục vụ sản xuất kinh doanh.",
   dinhKhoan: "Nợ 6422/6421/627/154 (TT200: 642/641/627/154)\nNợ 1331\n   Có 111/112/331",
   luuY: "Xe phải đứng tên doanh nghiệp hoặc có hợp đồng thuê xe; nhiên liệu phải khớp định mức tiêu hao và nhật trình xe. Cửa hàng xăng dầu phải lập hóa đơn điện tử theo từng lần bán; nhiều hóa đơn nhỏ cùng ngày có tổng từ 5 triệu đồng vẫn nên thanh toán bằng thẻ/chuyển khoản.",
   items: [
     { ten: "Giấy đăng ký xe / hợp đồng thuê xe", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quy định định mức tiêu hao nhiên liệu", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Lệnh điều xe / nhật trình xe", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn xăng dầu theo từng lần bán", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Bảng kê xăng xe, vé cầu đường", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu yêu cầu, báo giá, biên bản nghiệm thu sửa chữa (nếu sửa chữa, bảo dưỡng)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán (thẻ, UNC, phiếu chi)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_NK", ten: "Nhập khẩu hàng hóa", nhom: "Mua hàng", chieu: "mua", linhVuc: ["nhap_khau"],
   moTa: "Mua hàng hóa, máy móc, nguyên vật liệu từ nước ngoài.",
   dinhKhoan: "GHI NHẬN GIÁ TRỊ HÀNG MUA\nNợ 156/152/153/211\n   Có 331/112: Phải trả người bán\n   Có 3333: Thuế nhập khẩu\nTHUẾ GTGT HÀNG NHẬP KHẨU\nNợ 1331 – Có 33312\nNỘP THUẾ\nNợ 33312, Nợ 3333 – Có 112\nCHI PHÍ LOGISTICS\nNợ 156 (1562), Nợ 1331 – Có 331",
   luuY: "Thuế GTGT hàng nhập khẩu được khấu trừ căn cứ chứng từ nộp thuế GTGT khâu nhập khẩu. Thanh toán cho người bán nước ngoài phải qua ngân hàng; giá trị hàng nhập quy đổi theo tỷ giá trên tờ khai hải quan, chênh lệch khi thanh toán hạch toán 515/635.",
   items: [
     { ten: "Hợp đồng ngoại thương", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "Hoặc hợp đồng nguyên tắc + đơn hàng từng lần." },
     { ten: "Đơn đặt hàng / Purchase Order", mau: "DDH", bb: false, nguon: "Bên mua", ghiChu: "" },
     { ten: "Commercial Invoice (hóa đơn thương mại)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Packing list (phiếu đóng gói)", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Vận đơn (Bill of Lading / AWB)", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Tờ khai hải quan nhập khẩu (đã thông quan)", mau: null, bb: true, nguon: "Hải quan", ghiChu: "Bản in hoặc số tờ khai tra cứu được trên hệ thống hải quan." },
     { ten: "C/O, giấy kiểm định, chứng nhận chất lượng (nếu có)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Chứng từ nộp thuế nhập khẩu và thuế GTGT hàng nhập khẩu", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Điện chuyển tiền quốc tế (MT103)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "Kèm hồ sơ đối trừ công nợ nếu có." },
     { ten: "Hóa đơn, chứng từ chi phí logistics (vận chuyển, lưu kho, phí cảng, đại lý hải quan)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng", mau: "BBGN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Phiếu nhập kho (01-VT)", mau: "PNK", bb: true, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "MUA_QC", ten: "Chi phí quảng cáo, marketing", nhom: "Chi phí", chieu: "mua", linhVuc: ["quang_cao"],
   moTa: "Thuê dịch vụ quảng cáo, chạy quảng cáo Google/Facebook, in ấn tài liệu, tổ chức sự kiện quảng bá.",
   dinhKhoan: "Nợ 6421 (TT200: 641)\nNợ 1331\n   Có 331/111/112\nQUẢNG CÁO NỀN TẢNG NƯỚC NGOÀI CHƯA ĐĂNG KÝ THUẾ TẠI VN\nNợ 6421 – Có 3338 (thuế nhà thầu khấu trừ), Có 112",
   luuY: "Lưu báo cáo kết quả chạy quảng cáo và hình ảnh làm bằng chứng. Mua quảng cáo của nhà cung cấp nước ngoài: nếu nhà cung cấp đã đăng ký thuế qua Cổng thông tin điện tử dành cho nhà cung cấp nước ngoài thì lưu chứng từ thanh toán và hóa đơn/biên lai; nếu chưa đăng ký thì doanh nghiệp phải khai, nộp thuế nhà thầu thay.",
   items: [
     { ten: "Kế hoạch / tờ trình ngân sách marketing", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hợp đồng dịch vụ quảng cáo", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "Quảng cáo trực tuyến tự chạy: điều khoản dịch vụ của nền tảng." },
     { ten: "Báo cáo kết quả quảng cáo, hình ảnh, ấn phẩm", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản nghiệm thu hoàn thành dịch vụ", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử / hóa đơn, biên lai của nền tảng nước ngoài", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê thẻ công ty", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Tờ khai và chứng từ nộp thuế nhà thầu nước ngoài (nếu phải khai thay)", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" }
   ] },

 { id: "MUA_DT", ten: "Chi phí đào tạo nhân viên", nhom: "Chi phí", chieu: "mua", linhVuc: ["dao_tao"],
   moTa: "Cử nhân viên tham gia khóa đào tạo chuyên môn, kỹ năng, huấn luyện an toàn lao động.",
   dinhKhoan: "Nợ 6422/6421/627 (TT200: 642/641/627)\nNợ 1331 (nếu có thuế)\n   Có 331/111/112",
   luuY: "Chi đào tạo được trừ khi người học là người lao động của doanh nghiệp và có hồ sơ chứng minh (danh sách, chứng chỉ). Hợp đồng đào tạo nên có điều khoản cam kết làm việc / bồi hoàn chi phí khi nghỉ việc.",
   items: [
     { ten: "Tờ trình / quyết định cử nhân viên đi đào tạo", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng đào tạo / phiếu đăng ký khóa học", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Danh sách học viên, chương trình đào tạo", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản nghiệm thu hoàn thành khóa đào tạo", mau: "BBNT_DV", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng chỉ / giấy chứng nhận hoàn thành", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "Huấn luyện ATVSLĐ: chứng chỉ huấn luyện." },
     { ten: "Hóa đơn điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_PM", ten: "Mua phần mềm, bản quyền, dịch vụ phần mềm", nhom: "Tài sản", chieu: "mua", linhVuc: ["phan_mem"],
   moTa: "Mua phần mềm kế toán, ERP, bản quyền Office, thuê bao phần mềm (SaaS), dịch vụ thiết kế website.",
   dinhKhoan: "PHẦN MỀM ĐỦ ĐIỀU KIỆN TSCĐ VÔ HÌNH (≥ 30 triệu)\nNợ 213 – Có 331/112\nNợ 6422 – Có 214 (khấu hao)\nTHUÊ BAO / GIÁ TRỊ NHỎ NHIỀU KỲ\nNợ 242 – Có 331/112\nNợ 6422 – Có 242 (phân bổ)",
   luuY: "Phần mềm thường không chịu thuế GTGT nên hóa đơn không có thuế khấu trừ. Mua bản quyền từ nhà cung cấp nước ngoài phải xem xét nghĩa vụ thuế nhà thầu (bản quyền) nếu nhà cung cấp chưa đăng ký thuế tại Việt Nam.",
   items: [
     { ten: "Phiếu yêu cầu / tờ trình", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng báo giá", mau: "BG", bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hợp đồng cung cấp phần mềm / dịch vụ phần mềm", mau: "HDDV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản nghiệm thu, bàn giao phần mềm / license key", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Quyết định ghi tăng TSCĐ vô hình / bảng phân bổ chi phí trả trước", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Tờ khai và chứng từ nộp thuế nhà thầu (nhà cung cấp nước ngoài)", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" }
   ] },

 { id: "MUA_NTNN", ten: "Mua hàng hóa, dịch vụ của nhà thầu nước ngoài", nhom: "Mua hàng", chieu: "mua", linhVuc: ["dich_vu", "phan_mem", "quang_cao"],
   moTa: "Doanh nghiệp trả tiền cho tổ chức nước ngoài cung cấp dịch vụ, bản quyền, hàng hóa kèm dịch vụ tại Việt Nam.",
   dinhKhoan: "GHI NHẬN CHI PHÍ\nNợ 6422/154/242/213 – Có 331\nTHUẾ NHÀ THẦU KHẤU TRỪ\nNợ 331 – Có 33388 (TNDN), Có 33311 hoặc Có 3338 (GTGT)\nNỘP THUẾ: Nợ 3338/33311 – Có 112\nGTGT nhà thầu nộp thay được khấu trừ: Nợ 1331 – Có 33311",
   luuY: "Bên Việt Nam phải khai, nộp thuế nhà thầu thay cho nhà thầu nước ngoài theo từng lần thanh toán; chứng từ nộp thuế GTGT nhà thầu là căn cứ khấu trừ thuế GTGT đầu vào. Thanh toán phải qua ngân hàng.",
   items: [
     { ten: "Hợp đồng mua bán hàng hóa, dịch vụ với nhà thầu nước ngoài", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Invoice", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản bàn giao, nghiệm thu", mau: "BBNT_DV", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hồ sơ đăng ký, khai thuế nhà thầu (mẫu 01/NTNN)", mau: null, bb: true, nguon: "Cơ quan thuế", ghiChu: "" },
     { ten: "Chứng từ nộp thuế nhà thầu", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Điện chuyển tiền quốc tế (MT103)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_TRA_GOP", ten: "Mua hàng trả chậm, trả góp", nhom: "Mua hàng", chieu: "mua", linhVuc: ["hang_hoa", "tscd"],
   moTa: "Mua hàng hóa, tài sản thanh toán nhiều kỳ, có lãi trả chậm.",
   dinhKhoan: "Nợ 156/211 (giá mua trả tiền ngay)\nNợ 1331\nNợ 242 (lãi trả chậm)\n   Có 331\nPHÂN BỔ LÃI\nNợ 635 – Có 242",
   luuY: "Hóa đơn từ 5 triệu đồng chưa thanh toán tại thời điểm khấu trừ phải có hợp đồng ghi hình thức thanh toán chuyển khoản; đến hạn mà thanh toán bằng tiền mặt thì phải điều chỉnh giảm thuế đã khấu trừ.",
   items: [
     { ten: "Hợp đồng có điều khoản trả chậm / trả góp", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bảng tính lãi trả góp", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng hóa", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thanh toán từng kỳ", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "MUA_BH_TS", ten: "Bảo hiểm tài sản, bảo hiểm xe", nhom: "Chi phí", chieu: "mua", linhVuc: ["dich_vu"],
   moTa: "Phí bảo hiểm rủi ro tài sản, cháy nổ, bảo hiểm vật chất xe, trách nhiệm dân sự.",
   dinhKhoan: "Nợ 242 (phí nhiều kỳ) / 6422, Nợ 1331\n   Có 331/112\nNợ 6422/627 – Có 242 (phân bổ)",
   luuY: "Phí bảo hiểm cho kỳ trên 12 tháng phải phân bổ. Tài sản được bảo hiểm phải thuộc sở hữu hoặc quyền sử dụng của doanh nghiệp.",
   items: [
     { ten: "Tờ trình", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng bảo hiểm", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Thông báo phí", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy chứng nhận bảo hiểm", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Hóa đơn GTGT điện tử", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / sao kê ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "MUA_HANH_CHINH", ten: "Chi phí hành chính (văn phòng phẩm, chuyển phát, công chứng…)", nhom: "Chi phí", chieu: "mua", linhVuc: ["hang_hoa", "ccdc", "dich_vu"],
   moTa: "Văn phòng phẩm, chuyển phát nhanh, công chứng, vệ sinh văn phòng, chi phí lễ tết.",
   dinhKhoan: "Nợ 6422 (TT200: 642)\nNợ 1331\n   Có 111/112/331",
   luuY: "Gộp hóa đơn văn phòng phẩm theo tháng; hóa đơn từ 5 triệu đồng thanh toán chuyển khoản. Lưu phiếu yêu cầu và phiếu bàn giao cho phòng ban để chứng minh sử dụng.",
   items: [
     { ten: "Phiếu yêu cầu mua văn phòng phẩm / phiếu yêu cầu dịch vụ", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn GTGT + bảng kê chi tiết đính kèm", mau: null, bb: true, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Biên bản / phiếu bàn giao văn phòng phẩm cho phòng ban", mau: "BBGN", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán (UNC, phiếu chi)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 /* =========================== NGHIỆP VỤ KHÔNG GẮN HÓA ĐƠN =========================== */
 { id: "PHAP_LY", ten: "Hồ sơ pháp lý doanh nghiệp", nhom: "Pháp lý", chieu: "khac", linhVuc: [],
   moTa: "Hồ sơ pháp lý nền tảng của doanh nghiệp – lưu một lần, cập nhật khi có thay đổi.",
   dinhKhoan: "GÓP VỐN\nNợ 111/112 – Có 4111",
   luuY: "Vốn điều lệ phải góp đủ trong 90 ngày kể từ ngày cấp đăng ký doanh nghiệp; lãi vay tương ứng phần vốn còn thiếu không được tính vào chi phí được trừ. Quy chế tài chính, quy chế lương là căn cứ quan trọng để chi phí được trừ khi quyết toán.",
   items: [
     { ten: "Giấy chứng nhận đăng ký doanh nghiệp (tất cả các lần thay đổi, ghi chú điểm thay đổi)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách chi nhánh, địa điểm kinh doanh, VP đại diện (hạch toán độc lập/phụ thuộc)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hồ sơ người đại diện pháp luật, danh sách và hồ sơ cổ đông/thành viên góp vốn", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách, chứng từ góp vốn của từng thành viên", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Điều lệ công ty", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy phép đặc thù ngành nghề kinh doanh có điều kiện", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quy chế tài chính (phân quyền phê duyệt, định mức chi phí)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quy chế tiền lương, thưởng", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng dịch vụ điện, nước, viễn thông", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Thông tin tài khoản truy cập (hóa đơn điện tử, thuế điện tử, chữ ký số, ngân hàng, phần mềm kế toán)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "Lưu bảo mật, phân quyền người được truy cập." },
     { ten: "Các quy trình kế toán (thanh toán, mua hàng, bán hàng…)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Thông báo đăng ký phương pháp tính thuế, chế độ kế toán, phương pháp khấu hao", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" }
   ] },

 { id: "LUONG", ten: "Lương – BHXH – thuế TNCN", nhom: "Nhân sự", chieu: "khac", linhVuc: [],
   moTa: "Tính và chi trả lương, đóng bảo hiểm, khấu trừ thuế TNCN của người lao động có hợp đồng lao động.",
   dinhKhoan: "TÍNH LƯƠNG\nNợ 154/622/627/6421/6422 – Có 334\nBẢO HIỂM DN CHỊU (21,5%) + KPCĐ (2%)\nNợ 154/6421/6422 – Có 3383, 3384, 3386, 3382\nBẢO HIỂM NLĐ CHỊU (10,5%)\nNợ 334 – Có 3383, 3384, 3386\nTHUẾ TNCN KHẤU TRỪ\nNợ 334 – Có 3335\nTRẢ LƯƠNG\nNợ 334 – Có 112/111",
   luuY: "Chi lương được trừ khi có hợp đồng lao động, quy chế lương, bảng chấm công, bảng lương có ký nhận và đã chi trả thực tế trước thời hạn nộp hồ sơ quyết toán thuế TNDN. Quỹ lương đóng BHXH phải khớp với bảng lương thực tế; chênh lệch lớn dễ bị cơ quan BHXH truy thu.",
   items: [
     { ten: "Hồ sơ lao động (CCCD, sơ yếu lý lịch, giấy khám sức khỏe…)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng lao động (dài hạn, ngắn hạn, khoán), phụ lục", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Thỏa ước lao động tập thể (nếu có)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quy chế / quyết định lương, thưởng, phụ cấp; thang bảng lương", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hồ sơ đăng ký người phụ thuộc", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng chấm công", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng tính lương & thanh toán lương (có ký nhận)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán lương", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Ủy nhiệm chi / phiếu chi trả lương", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Hồ sơ BHXH, thông báo kết quả đóng BHXH (C12)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Tờ khai thuế TNCN (05/KK-TNCN) và chứng từ nộp thuế", mau: null, bb: true, nguon: "Cơ quan thuế", ghiChu: "" },
     { ten: "Bản cam kết thu nhập (mẫu 02/CK-TNCN) (nếu có)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy ủy quyền quyết toán thuế TNCN; tờ khai quyết toán 05/QTT-TNCN", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "NHAN_CONG_TN", ten: "Nhân công thuê ngoài (không đóng BHXH)", nhom: "Nhân sự", chieu: "khac", linhVuc: [],
   moTa: "Thuê cá nhân làm công việc thời vụ, khoán việc, cộng tác viên không ký hợp đồng lao động.",
   dinhKhoan: "Nợ 154/622/6421/6422 – Có 334/3388\nKHẤU TRỪ TNCN 10%\nNợ 334/3388 – Có 3335\nTHANH TOÁN\nNợ 334/3388 – Có 112/111",
   luuY: "Thu nhập từ 2 triệu đồng/lần trở lên phải khấu trừ 10% thuế TNCN, trừ trường hợp cá nhân có cam kết 02/CK-TNCN hợp lệ. Hợp đồng dịch vụ kéo dài từ đủ 01 tháng có thể phát sinh nghĩa vụ BHXH bắt buộc nếu bản chất là quan hệ lao động; khi Luật Thuế TNCN mới có hiệu lực cần rà soát lại ngưỡng khấu trừ.",
   items: [
     { ten: "Tờ trình / phê duyệt thuê nhân công", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng dịch vụ / hợp đồng khoán việc", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "CCCD của nhân công", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng chấm công / biên bản nghiệm thu công việc", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng kê thanh toán tiền công thuê ngoài (có ký nhận)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán (UNC, phiếu chi)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Chứng từ khấu trừ thuế TNCN (nếu có)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bản cam kết thu nhập (mẫu 02/CK-TNCN)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "LAI_VAY_NH", ten: "Chi phí lãi vay ngân hàng", nhom: "Tài chính", chieu: "khac", linhVuc: [],
   moTa: "Vay ngắn hạn, dài hạn ngân hàng; trả lãi hàng tháng và gốc theo kế hoạch.",
   dinhKhoan: "NHẬN TIỀN VAY\nNợ 112 – Có 341\nLÃI VAY\nNợ 635 (vay cho đầu tư XDCB: 241) – Có 112/335\nTRẢ GỐC\nNợ 341 – Có 112",
   luuY: "Doanh nghiệp có giao dịch liên kết bị khống chế chi phí lãi vay được trừ không vượt 30% EBITDA. Lãi vay tương ứng phần vốn điều lệ chưa góp đủ không được trừ; lãi vay phục vụ đầu tư tài sản trong giai đoạn xây dựng phải vốn hóa.",
   items: [
     { ten: "Hợp đồng tín dụng / hợp đồng vay", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Khế ước nhận nợ / hồ sơ giải ngân", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Thông báo phí, gốc và lãi vay của ngân hàng", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Thông báo thay đổi lãi suất (nếu có)", mau: null, bb: false, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Bảng tính lãi vay, phí của kế toán", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng tính khống chế lãi vay theo EBITDA (nếu có giao dịch liên kết)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ trả lãi, trả gốc (sao kê, giấy báo nợ)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Báo cáo tình hình trả nợ gốc vay", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "LAI_VAY_CN", ten: "Chi phí lãi vay của cá nhân, tổ chức khác", nhom: "Tài chính", chieu: "khac", linhVuc: [],
   moTa: "Vay tiền của cá nhân (thành viên, người lao động) hoặc tổ chức không phải tổ chức tín dụng.",
   dinhKhoan: "NHẬN TIỀN VAY\nNợ 112 – Có 341\nLÃI VAY PHẢI TRẢ\nNợ 635 – Có 335/3388\nKHẤU TRỪ TNCN 5% (đầu tư vốn)\nNợ 335/3388 – Có 3335\nTRẢ LÃI, GỐC\nNợ 3388, Nợ 341 – Có 112",
   luuY: "Phần lãi suất vượt 1,5 lần lãi suất cơ bản do Ngân hàng Nhà nước công bố tại thời điểm vay không được tính vào chi phí được trừ. Trả lãi cho cá nhân phải khấu trừ 5% thuế TNCN từ đầu tư vốn; nhận và trả tiền vay nên qua ngân hàng.",
   items: [
     { ten: "Hợp đồng vay (ghi rõ lãi suất, thời hạn)", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ nhận tiền vay (qua ngân hàng)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Bảng tính lãi vay", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán lãi, gốc (UNC, phiếu chi)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Tờ khai thuế TNCN mẫu 06/TNCN + chứng từ nộp thuế", mau: null, bb: true, nguon: "Cơ quan thuế", ghiChu: "Áp dụng khi bên cho vay là cá nhân." },
     { ten: "Biên bản đối chiếu công nợ vay", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" }
   ] },

 { id: "CO_TUC", ten: "Chia cổ tức – lợi nhuận cho chủ sở hữu", nhom: "Tài chính", chieu: "khac", linhVuc: [],
   moTa: "Chi trả cổ tức cho cổ đông, chia lợi nhuận cho thành viên góp vốn/chủ sở hữu.",
   dinhKhoan: "QUYẾT ĐỊNH CHIA\nNợ 4212 – Có 3388\nCHI TRẢ VÀ KHẤU TRỪ TNCN 5%\nNợ 3388 – Có 112, Có 3335\nNỘP THUẾ\nNợ 3335 – Có 112",
   luuY: "Chỉ được chia lợi nhuận khi đã hoàn thành nghĩa vụ thuế, bù đủ lỗ lũy kế và vẫn bảo đảm thanh toán đủ nợ đến hạn. Cổ tức, lợi nhuận trả cho cá nhân phải khấu trừ 5% thuế TNCN; cổ tức không phải chi phí được trừ.",
   items: [
     { ten: "Biên bản họp và nghị quyết ĐHĐCĐ / Hội đồng thành viên / quyết định chủ sở hữu", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản họp và quyết định HĐQT", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "Công ty cổ phần." },
     { ten: "Thông báo chi trả cổ tức", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách cổ đông / giấy đăng ký nhận cổ tức", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ chi trả cổ tức (UNC)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Tờ khai thuế TNCN (06/TNCN) + chứng từ nộp thuế", mau: null, bb: true, nguon: "Cơ quan thuế", ghiChu: "Khi cổ đông, thành viên là cá nhân." }
   ] },

 { id: "CONG_TAC_NB", ten: "Công tác phí (hồ sơ nội bộ)", nhom: "Nhân sự", chieu: "khac", linhVuc: [],
   moTa: "Phụ cấp công tác, khoán lưu trú, đi lại chi cho nhân viên theo quy chế (không có hóa đơn hoặc kèm hóa đơn).",
   dinhKhoan: "TẠM ỨNG\nNợ 141 – Có 111/112\nQUYẾT TOÁN CÔNG TÁC PHÍ\nNợ 6422/6421 – Có 141\nCHI BỔ SUNG / THU HỒI\nNợ 6422 – Có 111 / Nợ 111 – Có 141",
   luuY: "Phụ cấp công tác, khoán lưu trú không cần hóa đơn nếu có trong quy chế tài chính và có quyết định cử đi công tác; phần vượt mức quy chế không được trừ và có thể phải tính thuế TNCN. Tạm ứng phải quyết toán đúng hạn, không để tồn 141 kéo dài.",
   items: [
     { ten: "Quy chế tài chính thể hiện mức công tác phí", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quyết định cử đi công tác", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị tạm ứng", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đi đường (có xác nhận nơi đến)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Báo cáo kết quả công tác", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng thanh toán công tác phí / giấy thanh toán tạm ứng", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu chi / UNC", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "THUE_TS_CN", ten: "Thuê tài sản của cá nhân", nhom: "Chi phí", chieu: "khac", linhVuc: [],
   moTa: "Thuê nhà, văn phòng, xe ô tô của cá nhân không có hóa đơn.",
   dinhKhoan: "TIỀN THUÊ PHẢI TRẢ\nNợ 6422/6421/627 (trả trước nhiều kỳ: 242) – Có 3388\nKHAI THAY THUẾ (GTGT + TNCN)\nNợ 3388 – Có 3335, Có 33311 (hoặc 3339)\nTHANH TOÁN\nNợ 3388 – Có 112",
   luuY: "Hợp đồng thỏa thuận doanh nghiệp khai, nộp thuế thay thì doanh nghiệp lập tờ khai 01/TTS và nộp thuế trước khi thanh toán; chứng từ nộp thuế cùng hợp đồng là căn cứ tính chi phí. Doanh thu cho thuê dưới ngưỡng chịu thuế theo quy định hiện hành thì cá nhân không phải nộp nhưng vẫn phải khai.",
   items: [
     { ten: "Hợp đồng thuê tài sản (có điều khoản về khai, nộp thuế thay)", mau: "HDTHUE", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Giấy tờ chứng minh quyền sở hữu tài sản (sổ đỏ, đăng ký xe) và CCCD chủ sở hữu", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản bàn giao tài sản thuê", mau: "BBBG_TS", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Tờ khai thuế cho thuê tài sản (01/TTS) + phụ lục", mau: null, bb: true, nguon: "Cơ quan thuế", ghiChu: "" },
     { ten: "Chứng từ nộp thuế thay", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ thanh toán tiền thuê (UNC)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" }
   ] },

 { id: "HUY_HANG", ten: "Hủy hàng hóa – hàng hỏng, hết hạn", nhom: "Kho", chieu: "khac", linhVuc: [],
   moTa: "Tiêu hủy hàng hóa, thành phẩm, nguyên vật liệu hư hỏng, hết hạn, kém phẩm chất, lỗi thời.",
   dinhKhoan: "GHI GIẢM HÀNG TỒN KHO TIÊU HỦY\nNợ 811 (hoặc 632 nếu hao hụt trong định mức)\nNợ 2294 (phần đã trích dự phòng)\n   Có 152/155/156\nCHI PHÍ TIÊU HỦY\nNợ 811/6422, Nợ 1331 – Có 111/112/331",
   luuY: "Giá trị hàng hủy chỉ được tính vào chi phí được trừ khi hồ sơ đầy đủ: biên bản kiểm kê, đánh giá, quyết định hủy, hội đồng tiêu hủy, biên bản tiêu hủy kèm hình ảnh/video. Hàng đặc thù phải thuê đơn vị xử lý chất thải có chức năng.",
   items: [
     { ten: "Bảng kiểm kê hàng tồn kho", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Báo cáo đánh giá chất lượng hàng tồn (còn dùng, lỗi thời, hư hỏng)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng tính chi tiết theo từng mã hàng hủy", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản họp / quyết định hủy hàng do giám đốc ký", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quyết định thành lập hội đồng tiêu hủy", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu xuất kho hàng hủy", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản tiêu hủy kèm hình ảnh, video", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng, hóa đơn dịch vụ xử lý chất thải / vận chuyển hàng hủy", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" }
   ] },

 { id: "THANH_LY_TS", ten: "Thanh lý, nhượng bán tài sản cố định", nhom: "Tài sản", chieu: "khac", linhVuc: [],
   moTa: "Thanh lý, nhượng bán TSCĐ hư hỏng, không còn nhu cầu sử dụng.",
   dinhKhoan: "GHI GIẢM TSCĐ\nNợ 214: Hao mòn lũy kế\nNợ 811: Giá trị còn lại\n   Có 211: Nguyên giá\nTHU TỪ THANH LÝ\nNợ 131/112 – Có 711, Có 33311\nCHI PHÍ THANH LÝ\nNợ 811, Nợ 1331 – Có 111/112/331",
   luuY: "Bán tài sản thanh lý phải lập hóa đơn như bán hàng hóa. Nên có biên bản đánh giá lại hoặc chứng thư thẩm định giá để chứng minh giá bán phù hợp, đặc biệt khi bán cho bên liên kết.",
   items: [
     { ten: "Biên bản họp / quyết định thành lập hội đồng thanh lý", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản kiểm kê, đánh giá lại tài sản (chứng thư thẩm định giá nếu có)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Quyết định thanh lý tài sản", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hợp đồng bán tài sản thanh lý", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản bàn giao tài sản cho bên mua", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn GTGT bán tài sản", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Chứng từ thu tiền", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Chứng từ chi phí liên quan đến thanh lý", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" },
     { ten: "Quyết định ghi giảm TSCĐ, thẻ TSCĐ", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "DP_HTK", ten: "Dự phòng giảm giá hàng tồn kho", nhom: "Dự phòng", chieu: "khac", linhVuc: [],
   moTa: "Trích lập dự phòng khi giá trị thuần có thể thực hiện được của hàng tồn kho thấp hơn giá gốc.",
   dinhKhoan: "TRÍCH LẬP\nNợ 632 – Có 2294\nHOÀN NHẬP\nNợ 2294 – Có 632\nXỬ LÝ HÀNG HƯ HỎNG\nNợ 2294: Phần đã trích lập\nNợ 632: Phần chưa trích lập\n   Có 152/155/156",
   luuY: "Chỉ trích lập tại thời điểm lập báo cáo tài chính năm, chi tiết từng mặt hàng và phải có bằng chứng giá thị trường thấp hơn giá gốc hoặc hàng lỗi thời, hư hỏng. Thiếu hồ sơ chứng minh sẽ bị loại khỏi chi phí được trừ.",
   items: [
     { ten: "Bảng kiểm kê hàng tồn kho cuối năm", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Báo cáo đánh giá chất lượng hàng tồn", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hồ sơ chứng minh giá thị trường / hàng lỗi thời, hư hỏng", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "Báo giá, hóa đơn bán sau ngày kết thúc năm…" },
     { ten: "Bảng tính dự phòng chi tiết theo từng mã hàng", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản / quyết định trích lập dự phòng do giám đốc ký", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu kế toán ghi nhận trích lập / hoàn nhập", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "DP_PTKD", ten: "Dự phòng phải thu khó đòi", nhom: "Dự phòng", chieu: "khac", linhVuc: [],
   moTa: "Trích lập dự phòng cho khoản phải thu quá hạn, khách hàng mất khả năng thanh toán.",
   dinhKhoan: "TRÍCH LẬP\nNợ 6422 (TT200: 642) – Có 2293\nHOÀN NHẬP\nNợ 2293 – Có 6422\nXÓA NỢ KHI ĐỦ CĂN CỨ\nNợ 2293, Nợ 6422 – Có 131/138\nTHU ĐƯỢC NỢ ĐÃ XÓA\nNợ 111/112 – Có 711",
   luuY: "Mức trích theo thời gian quá hạn: 6 tháng – dưới 1 năm 30%, 1 – dưới 2 năm 50%, 2 – dưới 3 năm 70%, từ 3 năm 100%. Phải có hợp đồng, đối chiếu công nợ và bằng chứng đã đòi nợ; nợ đã xóa vẫn phải theo dõi tối thiểu 10 năm.",
   items: [
     { ten: "Hợp đồng, hóa đơn, biên bản giao nhận hàng", mau: null, bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ (hoặc xác nhận một chiều nếu khách mất liên hệ)", mau: "BBDCCN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Bằng chứng đòi nợ (công văn, email, biên bản làm việc, đơn khởi kiện)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Bảng phân loại nợ phải thu theo thời gian quá hạn", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Biên bản / quyết định trích lập dự phòng do giám đốc ký", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu kế toán ghi nhận dự phòng (cuối năm tài chính)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "BIEU_TANG", ten: "Hàng biếu tặng (ngoài chương trình khuyến mại)", nhom: "Bán hàng", chieu: "khac", linhVuc: [],
   moTa: "Xuất hàng hóa, sản phẩm biếu tặng khách hàng, đối tác, nhân viên không thuộc chương trình khuyến mại.",
   dinhKhoan: "Nợ 6421/6422/811 (hoặc 3532 nếu chi từ quỹ phúc lợi)\n   Có 156/155/154: Giá vốn\n   Có 33311: Thuế GTGT tính trên giá bán tương đương",
   luuY: "Hàng biếu tặng phải lập hóa đơn GTGT, tính thuế như bán hàng thông thường (giá tính thuế là giá bán của hàng cùng loại tại thời điểm biếu tặng). Chi phí chỉ được trừ khi gắn với hoạt động kinh doanh và có danh sách người nhận.",
   items: [
     { ten: "Quyết định / kế hoạch biếu tặng (đối tượng, số lượng, mục đích)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu xuất kho hàng biếu tặng", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách, biên bản bàn giao hàng biếu tặng (có ký nhận)", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Tài liệu liên quan (thư mời, công văn cảm ơn…)", mau: null, bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Hóa đơn GTGT hàng biếu tặng", mau: null, bb: true, nguon: "Bên bán", ghiChu: "Ghi đầy đủ đơn giá, thuế suất, tiền thuế như bán hàng." }
   ] },

 { id: "HANG_MAU", ten: "Hàng mẫu, hàng dùng thử", nhom: "Bán hàng", chieu: "khac", linhVuc: [],
   moTa: "Xuất hàng mẫu miễn phí cho khách hàng dùng thử nhằm quảng cáo, giới thiệu sản phẩm.",
   dinhKhoan: "Nợ 6421 (TT200: 641)\n   Có 156/155/154: Giá vốn",
   luuY: "Hàng mẫu, hàng dùng thử phải có kế hoạch và danh sách ký nhận; lập hóa đơn ghi rõ là hàng mẫu (giá tính thuế 0 khi thực hiện đúng quy định). Hàng chỉ để trưng bày tại doanh nghiệp không xuất cho khách thì không phải lập hóa đơn.",
   items: [
     { ten: "Kế hoạch / quyết định xuất hàng mẫu (mục tiêu, đối tượng, số lượng)", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Phiếu xuất kho hàng mẫu", mau: "PXK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Danh sách khách hàng nhận mẫu (ký nhận) / biên bản xác nhận nhận hàng dùng thử", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn hàng mẫu", mau: null, bb: false, nguon: "Bên bán", ghiChu: "" }
   ] },

 { id: "CK_THANH_TOAN", ten: "Chiết khấu thanh toán", nhom: "Tài chính", chieu: "khac", linhVuc: [],
   moTa: "Khoản giảm trừ cho người mua khi thanh toán trước hạn theo hợp đồng.",
   dinhKhoan: "BÊN BÁN\nNợ 635 – Có 111/112/131: Số tiền chiết khấu\nBÊN MUA\nNợ 111/112/331 – Có 515: Số tiền chiết khấu",
   luuY: "Chiết khấu thanh toán không phải giảm giá hàng hóa nên không lập hóa đơn, không điều chỉnh thuế GTGT; chỉ hạch toán chi phí/doanh thu tài chính. Phải có điều khoản trong hợp đồng hoặc thỏa thuận bằng văn bản.",
   items: [
     { ten: "Hợp đồng / phụ lục có điều khoản chiết khấu thanh toán", mau: "HDMB", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Biên bản thỏa thuận chiết khấu thanh toán", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Chứng từ thanh toán (UNC, sao kê, phiếu thu)", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Biên bản đối chiếu công nợ", mau: "BBDCCN", bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Phiếu kế toán hạch toán chiết khấu thanh toán", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" }
   ] },

 { id: "NHAN_BIEU_TANG", ten: "Nhận biếu tặng, tài trợ", nhom: "Tài sản", chieu: "khac", linhVuc: [],
   moTa: "Doanh nghiệp nhận hàng hóa, tài sản biếu tặng, tài trợ từ tổ chức, cá nhân khác.",
   dinhKhoan: "Nợ 156/152/211\nNợ 1331 (nếu có hóa đơn GTGT)\n   Có 711\nCHI PHÍ TIẾP NHẬN\nNợ 156/211 – Có 111/112",
   luuY: "Giá trị nhận biếu tặng là thu nhập khác chịu thuế TNDN. Tài sản nhận biếu tặng ghi nhận theo giá trị hợp lý (theo hóa đơn bên tặng hoặc đánh giá của hội đồng).",
   items: [
     { ten: "Hợp đồng / thư tài trợ, biếu tặng (nếu có)", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" },
     { ten: "Quyết định biếu tặng của bên tặng", mau: null, bb: false, nguon: "Bên bán", ghiChu: "" },
     { ten: "Biên bản giao nhận hàng / tài sản biếu tặng", mau: "BBGN", bb: true, nguon: "Hai bên", ghiChu: "" },
     { ten: "Hóa đơn của bên tặng", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" },
     { ten: "Phiếu nhập kho / biên bản bàn giao tài sản đưa vào sử dụng", mau: "PNK", bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Chứng từ chi phí tiếp nhận (vận chuyển, lắp đặt)", mau: null, bb: false, nguon: "Nhà cung cấp", ghiChu: "" }
   ] },

 { id: "NOP_THUE", ten: "Nộp thuế, phí, lệ phí", nhom: "Thuế", chieu: "khac", linhVuc: [],
   moTa: "Nộp thuế GTGT, TNDN, TNCN, thuế nhà thầu, lệ phí môn bài và các khoản phải nộp nhà nước.",
   dinhKhoan: "Nợ 33311/3334/3335/3338/3339 – Có 112\nTIỀN CHẬM NỘP, PHẠT\nNợ 811 – Có 3339",
   luuY: "Tiền chậm nộp, phạt vi phạm hành chính về thuế không được tính vào chi phí được trừ. Kiểm tra đúng mã chương, tiểu mục và kỳ thuế trên giấy nộp tiền để tránh treo nghĩa vụ.",
   items: [
     { ten: "Tờ khai thuế / bảng tính thuế", mau: null, bb: true, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy đề nghị thanh toán", mau: "DNTT", bb: false, nguon: "Nội bộ", ghiChu: "" },
     { ten: "Giấy nộp tiền vào NSNN / chứng từ nộp thuế điện tử", mau: null, bb: true, nguon: "Ngân hàng", ghiChu: "" },
     { ten: "Thông báo của cơ quan thuế (nếu có)", mau: null, bb: false, nguon: "Cơ quan thuế", ghiChu: "" }
   ] }
];

window.LOAI_HINH_DN = [
 { id: "thuong_mai", ten: "Thương mại", moTa: "Mua bán hàng hóa, phân phối, bán buôn, bán lẻ.",
   boGoiY: ["BAN_HH", "MUA_HH", "BAN_KM", "BAN_CKTM", "BAN_GGHB", "BAN_TRL", "MUA_TRL", "MUA_CKTM", "DC_HD", "MUA_VT", "MUA_THUE_TS", "MUA_XANG_DAU", "MUA_DIEN_NUOC", "HUY_HANG", "DP_HTK", "DP_PTKD", "BIEU_TANG", "HANG_MAU", "CK_THANH_TOAN", "LUONG", "PHAP_LY"],
   mauUuTien: { "hang_hoa": ["HDNT", "BG", "DDH", "PXK", "BBNT_HH"], "khuyen_mai": ["QD_KM", "PXK"], "ck_thuong_mai": ["BBXN_CK", "BBDCCN"], "tra_lai": ["BBTRL", "PNK"] } },

 { id: "dich_vu", ten: "Dịch vụ", moTa: "Tư vấn, kế toán, vệ sinh, bảo trì, sửa chữa, môi giới, cho thuê.",
   boGoiY: ["BAN_DV", "MUA_DV", "BAN_THUE_TS", "MUA_THUE_TS", "MUA_CONG_TAC", "MUA_DIEN_NUOC", "MUA_CCDC", "MUA_TSCD", "MUA_HANH_CHINH", "DC_HD", "NHAN_CONG_TN", "DP_PTKD", "LUONG", "PHAP_LY"],
   mauUuTien: { "dich_vu": ["BG", "HDDV", "BBNT_DV", "DNTT", "BBTL"], "thue_ts": ["HDTHUE", "BBBG_TS", "DNTT"] } },

 { id: "xay_dung", ten: "Xây dựng – lắp đặt", moTa: "Thi công xây dựng, lắp đặt, hoàn thiện công trình.",
   boGoiY: ["BAN_XD", "MUA_XD", "MUA_HH", "MUA_THUE_TS", "MUA_VT", "MUA_XANG_DAU", "MUA_TSCD", "MUA_CCDC", "NHAN_CONG_TN", "THUE_TS_CN", "DC_HD", "LAI_VAY_NH", "DP_PTKD", "LUONG", "PHAP_LY"],
   mauUuTien: { "xay_dung": ["HDXD", "BBNT_KL", "BGTKL", "BBBG_CT", "DNTT", "BBTL"], "hang_hoa": ["DDH", "BBGN", "PNK"] } },

 { id: "san_xuat", ten: "Sản xuất – gia công", moTa: "Sản xuất, chế biến, gia công sản phẩm.",
   boGoiY: ["BAN_SX", "MUA_SX", "MUA_HH", "BAN_HH", "MUA_NK", "MUA_TSCD", "MUA_CCDC", "MUA_VT", "MUA_DIEN_NUOC", "MUA_XANG_DAU", "HUY_HANG", "DP_HTK", "NHAN_CONG_TN", "LAI_VAY_NH", "LUONG", "PHAP_LY"],
   mauUuTien: { "san_xuat": ["HDGC", "DDH", "PXK", "BBGN", "BBNT_HH"], "hang_hoa": ["HDNT", "DDH", "PNK", "PXK"] } },

 { id: "van_tai", ten: "Vận tải – logistics", moTa: "Vận tải hàng hóa, hành khách, kho bãi, giao nhận.",
   boGoiY: ["BAN_VT", "MUA_VT", "MUA_XANG_DAU", "MUA_TSCD", "MUA_TRA_GOP", "MUA_BH_TS", "MUA_THUE_TS", "THUE_TS_CN", "LAI_VAY_NH", "THANH_LY_TS", "LUONG", "PHAP_LY"],
   mauUuTien: { "van_tai": ["HDVC", "BG", "BBGN", "BBNT_DV", "DNTT", "BBDCCN"] } },

 { id: "nha_hang_khach_san", ten: "Nhà hàng – khách sạn", moTa: "Kinh doanh ăn uống, lưu trú.",
   boGoiY: ["BAN_DV", "MUA_HH", "MUA_CCDC", "MUA_TSCD", "MUA_DIEN_NUOC", "MUA_THUE_TS", "THUE_TS_CN", "HUY_HANG", "BAN_KM", "MUA_QC", "NHAN_CONG_TN", "LUONG", "PHAP_LY"],
   mauUuTien: { "dich_vu": ["HDDV", "BBNT_DV", "DNTT"], "hang_hoa": ["DDH", "BBGN", "PNK"] } },

 { id: "du_lich_lu_hanh", ten: "Du lịch lữ hành", moTa: "Tổ chức tour, đại lý vé, dịch vụ du lịch.",
   boGoiY: ["BAN_DV", "MUA_DV", "MUA_CONG_TAC", "MUA_VT", "MUA_QC", "DC_HD", "NHAN_CONG_TN", "DP_PTKD", "LUONG", "PHAP_LY"],
   mauUuTien: { "dich_vu": ["BG", "HDDV", "BBNT_DV", "DNTT", "BBTL"], "van_tai": ["HDVC", "BBNT_DV"] } },

 { id: "xuat_nhap_khau", ten: "Xuất nhập khẩu", moTa: "Xuất khẩu, nhập khẩu hàng hóa, máy móc, nguyên vật liệu.",
   boGoiY: ["BAN_XK", "MUA_NK", "BAN_HH", "MUA_HH", "MUA_VT", "MUA_NTNN", "BAN_TRL", "DC_HD", "DP_HTK", "DP_PTKD", "LAI_VAY_NH", "LUONG", "PHAP_LY"],
   mauUuTien: { "xuat_khau": ["HDMB", "DDH", "PXK", "BBDCCN"], "nhap_khau": ["HDMB", "DDH", "PNK"], "hang_hoa": ["HDNT", "BG", "DDH", "PXK", "BBNT_HH"] } },

 { id: "cong_nghe_phan_mem", ten: "Công nghệ – phần mềm", moTa: "Phát triển, kinh doanh phần mềm, dịch vụ CNTT, SaaS.",
   boGoiY: ["BAN_PM", "MUA_PM", "BAN_DV", "MUA_DV", "MUA_NTNN", "MUA_QC", "MUA_TSCD", "MUA_CCDC", "MUA_THUE_TS", "NHAN_CONG_TN", "LUONG", "PHAP_LY"],
   mauUuTien: { "phan_mem": ["BG", "HDDV", "BBNT_DV", "DNTT", "BBTL"], "dich_vu": ["HDDV", "BBNT_DV"] } },

 { id: "giao_duc_dao_tao", ten: "Giáo dục – đào tạo", moTa: "Trung tâm đào tạo, ngoại ngữ, kỹ năng, đào tạo nghề.",
   boGoiY: ["BAN_DT", "MUA_DT", "MUA_QC", "MUA_THUE_TS", "THUE_TS_CN", "MUA_DIEN_NUOC", "MUA_CCDC", "MUA_TSCD", "MUA_PM", "NHAN_CONG_TN", "LUONG", "PHAP_LY"],
   mauUuTien: { "dao_tao": ["HDDV", "BBNT_DV", "DNTT", "BBTL"], "quang_cao": ["HDDV", "BBNT_DV"] } }
];
