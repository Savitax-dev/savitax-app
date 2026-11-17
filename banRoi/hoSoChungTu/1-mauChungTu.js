/* Thư viện mẫu chứng từ – Savitax Hồ Sơ (bản rời). Nguồn: app Hồ sơ chứng từ V2.0.0, đổi thương hiệu 17/11/2026 */
window.MAU_CHUNG_TU = [

  /* ======================= 1. HỢP ĐỒNG NGUYÊN TẮC ======================= */
  { id: "HDNT", ten: "Hợp đồng nguyên tắc mua bán hàng hóa", nhom: "Hàng hóa",
    moTa: "Dùng khi hai bên mua bán hàng hóa thường xuyên, nhiều lần; từng lần giao dịch thực hiện qua báo giá, đơn đặt hàng và biên bản nghiệm thu.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG NGUYÊN TẮC</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005 và các văn bản sửa đổi, bổ sung, hướng dẫn thi hành;</i></p>
<p style="text-align: justify"><i>- Căn cứ vào nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>I/ BÊN A (BÊN MUA): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>II/ BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Sau khi thống nhất thỏa thuận, các bên đồng ý ký kết Hợp đồng này với các điều khoản và điều kiện sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. NỘI DUNG VÀ CÁCH THỨC THỰC HIỆN</b></p>
<p style="text-align: justify">1. Bên B đồng ý bán và Bên A đồng ý mua các loại hàng hóa ({{noi_dung}}) mà Bên A có nhu cầu và Bên B có khả năng cung cấp. Chủng loại, số lượng, đơn giá, thời gian và địa điểm giao hàng của từng lần mua bán được thể hiện tại Đơn đặt hàng được hai bên xác nhận; mỗi Đơn đặt hàng là bộ phận không tách rời của Hợp đồng này.</p>
<p style="text-align: justify">2. Khi có nhu cầu, Bên B gửi báo giá; Bên A gửi Đơn đặt hàng bằng văn bản có chữ ký, đóng dấu (nếu có) của người đại diện hoặc người được ủy quyền hợp lệ của Bên A, hoặc gửi bằng email theo địa chỉ đã thông báo trước cho Bên B.</p>
<p style="text-align: justify">3. Giao nhận hàng hóa: Hàng hóa có thể giao một lần hoặc nhiều lần theo Đơn đặt hàng. Mỗi lần giao nhận, đại diện hai bên ký Biên bản nghiệm thu giá trị hàng hóa ghi rõ chủng loại, số lượng, giá trị hàng hóa và số hóa đơn. Người nhận hàng của Bên A phải là người đại diện hoặc người được Bên A ủy quyền bằng văn bản.</p>
<p style="text-align: justify">4. Kiểm tra hàng hóa: Trong vòng 02 ngày kể từ khi nhận hàng, Bên A kiểm tra và ký biên bản nghiệm thu nếu hàng hóa phù hợp với Đơn đặt hàng. Quá thời hạn trên mà Bên A không ký biên bản và không có khiếu nại bằng văn bản về hàng hóa thì hàng hóa được coi là đã được Bên A chấp nhận.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. CHẤT LƯỢNG, QUYỀN SỞ HỮU VÀ RỦI RO</b></p>
<p style="text-align: justify">1. Hàng hóa phải mới 100%, đúng chủng loại, quy cách theo Đơn đặt hàng, có nguồn gốc xuất xứ hợp pháp và kèm chứng từ chất lượng của nhà sản xuất (nếu có).</p>
<p style="text-align: justify">2. Quyền sở hữu và rủi ro đối với hàng hóa chuyển từ Bên B sang Bên A kể từ thời điểm hai bên ký biên bản giao nhận, nghiệm thu hàng hóa.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. GIÁ CẢ, HÓA ĐƠN VÀ THANH TOÁN</b></p>
<p style="text-align: justify">1. Giá hàng hóa theo báo giá của Bên B được Bên A chấp nhận tại Đơn đặt hàng. Đơn giá chưa bao gồm thuế giá trị gia tăng; thuế giá trị gia tăng tính theo thuế suất hiện hành.</p>
<p style="text-align: justify">2. Bên B lập hóa đơn giá trị gia tăng điện tử tại thời điểm chuyển giao quyền sở hữu hàng hóa cho Bên A theo quy định của Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP.</p>
<p style="text-align: justify">3. Hình thức thanh toán: {{tt.hinh_thuc}} vào tài khoản ngân hàng của Bên B nêu tại phần đầu Hợp đồng này. Hai bên không thanh toán bằng tiền mặt đối với các hóa đơn có giá trị từ 05 triệu đồng trở lên (đã bao gồm thuế giá trị gia tăng).</p>
<p style="text-align: justify">4. Thời hạn thanh toán: Bên A thanh toán cho Bên B trong vòng {{tt.han}} ngày kể từ ngày ký biên bản nghiệm thu và nhận hóa đơn hợp lệ. Quá hạn, Bên A phải trả tiền lãi trên số tiền chậm trả theo lãi suất nợ quá hạn trung bình trên thị trường tại thời điểm thanh toán tương ứng với thời gian chậm trả.</p>
<p style="text-align: justify">5. Bên B có quyền tạm ngừng giao hàng khi Bên A chậm thanh toán quá 30 ngày cho đến khi Bên A thanh toán đủ số tiền đến hạn.</p>
<p style="text-align: justify">6. Hồ sơ thanh toán: Hóa đơn giá trị gia tăng; Đơn đặt hàng; Biên bản nghiệm thu giá trị hàng hóa; Giấy đề nghị thanh toán (nếu có).</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</b></p>
<p style="text-align: justify">1. Giao hàng đúng chủng loại, số lượng, chất lượng, thời gian và địa điểm theo Đơn đặt hàng; lập và giao hóa đơn đúng quy định.</p>
<p style="text-align: justify">2. Bảo hành hàng hóa trong thời hạn {{bao_hanh}} tháng kể từ ngày nghiệm thu đối với lỗi thuộc phạm vi bảo hành của nhà sản xuất hoặc do lỗi của Bên B.</p>
<p style="text-align: justify">3. Được nhận thanh toán đầy đủ, đúng hạn; được đơn phương chấm dứt Hợp đồng theo Điều 8.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</b></p>
<p style="text-align: justify">1. Thông báo cho Bên B chủng loại, số lượng, thời gian và địa điểm giao hàng của từng Đơn đặt hàng; cử người có thẩm quyền nhận và nghiệm thu hàng hóa.</p>
<p style="text-align: justify">2. Thanh toán đầy đủ, đúng hạn theo Điều 3. Sau khi ký nghiệm thu, Bên A chịu rủi ro đối với hàng hóa, trừ trường hợp thuộc trách nhiệm bảo hành của Bên B.</p>
<p style="text-align: justify">3. Khiếu nại về hàng hóa bằng văn bản hoặc email trong thời hạn kiểm tra hàng hóa; trong thời gian chờ giải quyết, giữ nguyên hiện trạng hàng hóa.</p>
<p style="text-align: justify">4. Được đơn phương chấm dứt Hợp đồng theo Điều 8.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. PHẠT VI PHẠM VÀ BỒI THƯỜNG THIỆT HẠI</b></p>
<p style="text-align: justify">1. Bên vi phạm nghĩa vụ hợp đồng phải chịu phạt vi phạm bằng 8% giá trị phần nghĩa vụ hợp đồng bị vi phạm, trừ các trường hợp được miễn trách nhiệm theo quy định của pháp luật.</p>
<p style="text-align: justify">2. Ngoài tiền phạt vi phạm, bên vi phạm phải bồi thường các thiệt hại thực tế, trực tiếp phát sinh do hành vi vi phạm gây ra.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. SỰ KIỆN BẤT KHẢ KHÁNG</b></p>
<p style="text-align: justify">1. Sự kiện bất khả kháng là sự kiện xảy ra một cách khách quan, không thể lường trước được và không thể khắc phục được mặc dù đã áp dụng mọi biện pháp cần thiết và khả năng cho phép.</p>
<p style="text-align: justify">2. Bên gặp sự kiện bất khả kháng phải thông báo ngay bằng văn bản cho bên kia về sự kiện và hậu quả có thể xảy ra, và được miễn trách nhiệm đối với nghĩa vụ không thực hiện được do sự kiện đó. Nếu sự kiện kéo dài quá 60 ngày, mỗi bên có quyền chấm dứt Hợp đồng mà không phải bồi thường.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 8. CHẤM DỨT HỢP ĐỒNG</b></p>
<p style="text-align: justify">1. Hợp đồng chấm dứt khi: hết thời hạn mà không gia hạn; hai bên thỏa thuận chấm dứt; một bên giải thể, phá sản hoặc chấm dứt hoạt động theo quyết định của cơ quan nhà nước có thẩm quyền.</p>
<p style="text-align: justify">2. Một bên có quyền đơn phương chấm dứt Hợp đồng khi bên kia vi phạm nghiêm trọng nghĩa vụ mà không khắc phục trong vòng 03 ngày kể từ ngày nhận được yêu cầu bằng văn bản. Bên chấm dứt phải thông báo ngay cho bên kia.</p>
<p style="text-align: justify">3. Khi chấm dứt Hợp đồng, hai bên đối chiếu, thanh toán công nợ và các nghĩa vụ đã phát sinh, lập biên bản thanh lý.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 9. GIẢI QUYẾT TRANH CHẤP</b></p>
<p style="text-align: justify">Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng, hòa giải. Trường hợp không giải quyết được, một trong các bên có quyền khởi kiện tại Tòa án nhân dân có thẩm quyền. Án phí, lệ phí do các bên chịu theo quyết định của Tòa án.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 10. ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Mọi sửa đổi, bổ sung Hợp đồng chỉ có giá trị khi được lập thành văn bản và ký bởi đại diện có thẩm quyền của các bên. Báo giá, Đơn đặt hàng, Biên bản nghiệm thu là bộ phận không tách rời của Hợp đồng.</p>
<p style="text-align: justify">2. Không bên nào được chuyển giao quyền và nghĩa vụ theo Hợp đồng cho bên thứ ba khi chưa có sự đồng ý bằng văn bản của bên kia. Những nội dung chưa quy định tại Hợp đồng được thực hiện theo pháp luật Việt Nam.</p>
<p style="text-align: justify">3. Hợp đồng có hiệu lực kể từ ngày ký đến hết {{hieu_luc}}, được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 2. HỢP ĐỒNG MUA BÁN TỪNG LẦN ======================= */
  { id: "HDMB", ten: "Hợp đồng mua bán hàng hóa (theo từng lần)", nhom: "Hàng hóa",
    moTa: "Dùng cho một giao dịch mua bán hàng hóa cụ thể, đã xác định rõ hàng hóa, số lượng, giá trị ngay khi ký.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG MUA BÁN HÀNG HÓA</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</i></p>
<p style="text-align: justify"><i>- Căn cứ nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng mua bán hàng hóa với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. HÀNG HÓA, SỐ LƯỢNG, GIÁ TRỊ</b></p>
<p style="text-align: justify">Bên B bán cho Bên A hàng hóa ({{noi_dung}}) với chủng loại, số lượng, đơn giá như sau:</p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">Tổng giá trị Hợp đồng: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}).<br><i>Bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify">Đơn giá trên đã bao gồm chi phí đóng gói, vận chuyển, bốc xếp đến địa điểm giao hàng, trừ khi hai bên có thỏa thuận khác bằng văn bản.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. CHẤT LƯỢNG VÀ BẢO HÀNH</b></p>
<p style="text-align: justify">1. Hàng hóa mới 100%, đúng chủng loại, quy cách, có nguồn gốc xuất xứ hợp pháp, kèm chứng từ chất lượng của nhà sản xuất (nếu có).</p>
<p style="text-align: justify">2. Thời hạn bảo hành: {{bao_hanh}} tháng kể từ ngày nghiệm thu. Trong thời hạn bảo hành, Bên B sửa chữa hoặc thay thế miễn phí đối với hàng hóa bị lỗi do nhà sản xuất hoặc do Bên B trong vòng 05 ngày làm việc kể từ ngày nhận được thông báo của Bên A.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. GIAO NHẬN HÀNG HÓA</b></p>
<p style="text-align: justify">1. Thời gian giao hàng: {{thoi_gian}}. Địa điểm giao hàng: {{gn.dia_diem}}.</p>
<p style="text-align: justify">2. Khi giao hàng, hai bên kiểm tra số lượng, chủng loại, tình trạng bên ngoài và ký Biên bản giao nhận / Biên bản nghiệm thu giá trị hàng hóa. Quyền sở hữu và rủi ro đối với hàng hóa chuyển sang Bên A kể từ thời điểm ký biên bản này.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. HÓA ĐƠN VÀ THANH TOÁN</b></p>
<p style="text-align: justify">1. Bên B lập hóa đơn giá trị gia tăng điện tử tại thời điểm chuyển giao quyền sở hữu hàng hóa theo Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP.</p>
<p style="text-align: justify">2. Hình thức thanh toán: {{tt.hinh_thuc}} vào tài khoản của Bên B nêu tại Hợp đồng này. Không thanh toán bằng tiền mặt đối với hóa đơn có giá trị từ 05 triệu đồng trở lên (đã bao gồm thuế GTGT).</p>
<p style="text-align: justify">3. Thời hạn thanh toán: trong vòng {{tt.han}} ngày kể từ ngày hai bên ký biên bản nghiệm thu và Bên A nhận được hóa đơn hợp lệ. Chậm thanh toán, Bên A trả lãi trên số tiền chậm trả theo lãi suất nợ quá hạn trung bình trên thị trường tại thời điểm thanh toán.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN</b></p>
<p style="text-align: justify">1. Bên B: giao hàng đúng số lượng, chất lượng, thời hạn; cung cấp hóa đơn, chứng từ kèm theo; thực hiện bảo hành; được nhận thanh toán đầy đủ, đúng hạn.</p>
<p style="text-align: justify">2. Bên A: chuẩn bị mặt bằng, cử người có thẩm quyền nhận hàng; kiểm tra và ký nghiệm thu; thanh toán đầy đủ, đúng hạn; được từ chối nhận hàng không đúng thỏa thuận.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. PHẠT VI PHẠM, BỒI THƯỜNG VÀ BẤT KHẢ KHÁNG</b></p>
<p style="text-align: justify">1. Bên vi phạm nghĩa vụ hợp đồng chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm và bồi thường thiệt hại thực tế, trực tiếp phát sinh, trừ trường hợp được miễn trách nhiệm theo quy định của pháp luật.</p>
<p style="text-align: justify">2. Bên gặp sự kiện bất khả kháng phải thông báo ngay bằng văn bản cho bên kia và được miễn trách nhiệm đối với nghĩa vụ không thực hiện được do sự kiện đó gây ra.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. GIẢI QUYẾT TRANH CHẤP VÀ ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Tranh chấp được giải quyết bằng thương lượng, hòa giải; không thành thì một bên có quyền khởi kiện tại Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">2. Mọi sửa đổi, bổ sung phải lập thành văn bản có chữ ký của đại diện hai bên. Sau khi hai bên hoàn thành nghĩa vụ, Hợp đồng được coi là đã thanh lý nếu không có vướng mắc.</p>
<p style="text-align: justify">3. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 3. BẢNG BÁO GIÁ ======================= */
  { id: "BG", ten: "Bảng báo giá", nhom: "Hàng hóa",
    moTa: "Dùng khi bên bán gửi giá chào hàng cho bên mua trước khi bên mua đặt hàng hoặc ký hợp đồng.",
    html: `<p style="font-size: 14pt"><b>{{ban.ten}}</b></p>
<p>Địa chỉ: {{ban.dc}}<br>Mã số thuế: {{ban.mst}} – Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>BẢNG BÁO GIÁ</b></p>
<p style="text-align: center"><i>Số: {{doc.so}}</i></p>
<p style="margin-top: 6pt"><b>Kính gửi: {{mua.ten}}</b><br>Địa chỉ: {{mua.dc}}<br>Mã số thuế: {{mua.mst}}</p>
<p style="text-align: justify">{{ban.ten}} trân trọng cảm ơn Quý khách hàng đã quan tâm đến sản phẩm của chúng tôi. Chúng tôi xin gửi tới Quý khách bảng báo giá {{noi_dung}} như sau:</p>
<p>{{BANG_GIA}}</p>
<p style="margin-top: 6pt"><b>Ghi chú:</b></p>
<p style="text-align: justify">- Đơn giá trên chưa bao gồm {{thue.nhan}}.</p>
<p style="text-align: justify">- Hàng hóa mới 100%, có nguồn gốc xuất xứ rõ ràng; bảo hành {{bao_hanh}} tháng (nếu có).</p>
<p style="text-align: justify">- Địa điểm và thời gian giao hàng: theo thỏa thuận tại Đơn đặt hàng.</p>
<p style="text-align: justify">- Hình thức thanh toán: {{tt.hinh_thuc}}, trong vòng {{tt.han}} ngày kể từ ngày giao hàng và nhận hóa đơn.</p>
<p style="text-align: justify">- Báo giá có hiệu lực trong vòng 30 ngày kể từ ngày lập.</p>
<p style="text-align: justify; margin-bottom: 6pt"><i>Rất mong được hợp tác cùng Quý khách. Trân trọng kính chào!</i></p>
<table class="plain"><tr><td style="width:45%; text-align:center; vertical-align:top"></td><td style="width:55%; text-align:center; vertical-align:top"><i>{{dia_danh}}, {{doc.ngay_chu}}</i><br><b>ĐẠI DIỆN BÊN BÁO GIÁ</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 4. ĐƠN ĐẶT HÀNG ======================= */
  { id: "DDH", ten: "Đơn đặt hàng", nhom: "Hàng hóa",
    moTa: "Dùng khi bên mua đặt từng lô hàng cụ thể theo hợp đồng nguyên tắc và báo giá đã nhận.",
    html: `<p style="font-size: 14pt"><b>{{mua.ten}}</b></p>
<p>Địa chỉ: {{mua.dc}}<br>Mã số thuế: {{mua.mst}} – Điện thoại: {{mua.dt}}</p>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>ĐƠN ĐẶT HÀNG</b></p>
<p style="text-align: center"><i>Số: {{doc.so}}</i></p>
<p style="text-align: right"><i>{{dia_danh}}, {{doc.ngay_chu}}</i></p>
<p><b>Kính gửi: {{ban.ten}}</b><br>Địa chỉ: {{ban.dc}}<br>Mã số thuế: {{ban.mst}}</p>
<p style="text-align: justify">Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} và Bảng báo giá số {{so.BG}} ngày {{ngay.BG}}, {{mua.ten}} đặt mua các mặt hàng dưới đây:</p>
<p>{{BANG_HANG}}</p>
<p><i>Số tiền viết bằng chữ: {{tien.chu}}</i></p>
<p style="margin-top: 6pt"><b>Ghi chú:</b></p>
<p style="text-align: justify">* Địa điểm giao hàng: {{gn.dia_diem}}</p>
<p style="text-align: justify">* Thời gian giao hàng: chậm nhất ngày {{gn.ngay}}</p>
<p style="text-align: justify">* Người nhận hàng: {{gn.nguoi_nhan}} – Điện thoại: {{gn.sdt_nhan}}</p>
<p style="text-align: justify">* Hình thức thanh toán: {{tt.hinh_thuc}}, trong vòng {{tt.han}} ngày kể từ ngày nhận hàng và hóa đơn hợp lệ.</p>
<p style="text-align: justify; margin-bottom: 6pt"><i>Đề nghị Quý Công ty xác nhận đơn hàng và giao hàng đúng thời hạn. Xin chân thành cảm ơn!</i></p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>XÁC NHẬN CỦA BÊN BÁN</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN ĐẶT HÀNG</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td></tr></table>` },

  /* ======================= 5. BIÊN BẢN GIAO NHẬN ======================= */
  { id: "BBGN", ten: "Biên bản giao nhận hàng hóa", nhom: "Hàng hóa",
    moTa: "Dùng tại thời điểm giao hàng để xác nhận số lượng, tình trạng hàng hóa, người giao, người nhận và phương tiện vận chuyển.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt; margin-bottom: 6pt"><b>BIÊN BẢN GIAO NHẬN HÀNG HÓA</b></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ Đơn đặt hàng số {{so.DDH}} ngày {{ngay.DDH}}.</i></p>
<p style="text-align: justify">Hôm nay, {{gn.ngay_chu}}, tại {{gn.dia_diem}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN GIAO (BÊN B): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Người giao hàng: {{gn.nguoi_giao}} – Chức vụ: {{gn.cv_giao}}<br>Số CCCD: {{gn.cccd_giao}} – Điện thoại: {{gn.sdt_giao}}</p>
<p style="text-align: justify"><b>BÊN NHẬN (BÊN A): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Người nhận hàng: {{gn.nguoi_nhan}} – Chức vụ: {{gn.cv_nhan}}<br>Số CCCD: {{gn.cccd_nhan}} – Điện thoại: {{gn.sdt_nhan}} – Email: {{gn.email}}</p>
<p style="text-align: justify">Phương tiện vận chuyển: {{gn.phuong_tien}} – Biển số: {{gn.bien_so}}</p>
<p style="text-align: justify">Hai bên tiến hành giao nhận hàng hóa theo hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}} với chi tiết như sau:</p>
<p>{{BANG_GIAONHAN}}</p>
<p style="margin-top: 6pt"><b>Ý kiến của hai bên:</b></p>
<p style="text-align: justify">- Bên B đã giao đủ số lượng hàng hóa nêu trên; hàng hóa nguyên đai, nguyên kiện, bao bì không bị rách vỡ, móp méo.</p>
<p style="text-align: justify">- Bên A đã kiểm tra và nhận đủ hàng hóa; mọi khiếu nại về chất lượng được thực hiện theo thời hạn quy định trong Hợp đồng.</p>
<p style="text-align: justify">- Ghi chú khác: {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>BÊN NHẬN HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br><br><b>{{gn.nguoi_nhan}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>BÊN GIAO HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br><br><b>{{gn.nguoi_giao}}</b></td></tr></table>` },

  /* ======================= 6. BIÊN BẢN NGHIỆM THU HÀNG HÓA ======================= */
  { id: "BBNT_HH", ten: "Biên bản nghiệm thu giá trị hàng hóa", nhom: "Hàng hóa",
    moTa: "Dùng sau mỗi lần giao hàng để hai bên xác nhận số lượng, chất lượng, giá trị hàng hóa và số hóa đơn làm căn cứ thanh toán.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt; margin-bottom: 6pt"><b>BIÊN BẢN NGHIỆM THU GIÁ TRỊ HÀNG HÓA</b></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ Đơn đặt hàng số {{so.DDH}} ngày {{ngay.DDH}}.</i></p>
<p style="text-align: justify">Hôm nay, {{gn.ngay_chu}}, tại {{gn.dia_diem}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA): {{mua.ten}}</b><br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}} – Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Người trực tiếp nhận hàng: {{gn.nguoi_nhan}} – Chức vụ: {{gn.cv_nhan}} – CCCD: {{gn.cccd_nhan}} – ĐT: {{gn.sdt_nhan}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}} – Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Người trực tiếp giao hàng: {{gn.nguoi_giao}} – Chức vụ: {{gn.cv_giao}} – CCCD: {{gn.cccd_giao}} – ĐT: {{gn.sdt_giao}}<br>Phương tiện vận chuyển: {{gn.phuong_tien}} – Biển số: {{gn.bien_so}}</p>
<p style="text-align: justify">Hai bên cùng tiến hành nghiệm thu số lượng, chất lượng và giá trị hàng hóa Bên B đã giao cho Bên A như sau:</p>
<p>{{BANG_HANG}}</p>
<p><i>Số tiền viết bằng chữ: {{tien.chu}}</i></p>
<p style="margin-top: 6pt"><b>Kết luận:</b></p>
<p style="text-align: justify">- Hàng hóa Bên B giao đúng chủng loại, số lượng, chất lượng theo Đơn đặt hàng; Bên A đồng ý nghiệm thu với tổng giá trị {{tien.tong}} đồng (đã bao gồm {{thue.nhan}}), kèm hóa đơn GTGT ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}.</p>
<p style="text-align: justify">- Bên A có trách nhiệm thanh toán cho Bên B theo đúng thỏa thuận trong Hợp đồng.</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 7. PHIẾU XUẤT KHO ======================= */
  { id: "PXK", ten: "Phiếu xuất kho (mẫu 02-VT)", nhom: "Kho",
    moTa: "Dùng khi doanh nghiệp (bên bán) xuất hàng hóa, vật tư ra khỏi kho để bán hoặc sử dụng, làm căn cứ ghi thẻ kho và hạch toán giá vốn.",
    html: `<table class="plain"><tr><td style="width:55%; vertical-align:top"><b>Đơn vị: {{ban.ten}}</b><br>Địa chỉ: {{ban.dc}}</td><td style="width:45%; text-align:center; vertical-align:top"><b>Mẫu số 02 - VT</b><br><i><span style="font-size:10pt">(Theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 hoặc Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính)</span></i></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>PHIẾU XUẤT KHO</b></p>
<p style="text-align: center"><i>{{doc.ngay_chu}}</i></p>
<table class="plain"><tr><td style="width:60%; text-align:center; vertical-align:top">Số: {{doc.so}}</td><td style="width:40%; vertical-align:top">Nợ: …………<br>Có: …………</td></tr></table>
<p style="text-align: justify">- Họ và tên người nhận hàng: {{gn.nguoi_nhan}} – Đơn vị: {{mua.ten}}</p>
<p style="text-align: justify">- Địa chỉ (bộ phận): {{mua.dc}}</p>
<p style="text-align: justify">- Lý do xuất kho: Xuất bán hàng theo Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}}, hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}</p>
<p style="text-align: justify; margin-bottom: 6pt">- Xuất tại kho (ngăn lô): ………………… Địa điểm: ………………………………</p>
<p>{{BANG_KHO}}</p>
<p style="text-align: justify">- Tổng số tiền (viết bằng chữ): {{tien.chu}}</p>
<p style="text-align: justify">- Số chứng từ gốc kèm theo: ……………………</p>
<p style="text-align: right; margin-bottom: 6pt"><i>{{doc.ngay_chu}}</i></p>
<table class="plain"><tr><td style="width:20%; text-align:center; vertical-align:top"><b>Người lập phiếu</b><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Người nhận hàng</b><br><i>(Ký, họ tên)</i><br><br><br><br><br>{{gn.nguoi_nhan}}</td><td style="width:20%; text-align:center; vertical-align:top"><b>Thủ kho</b><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Kế toán trưởng</b><br><i>(Hoặc bộ phận có nhu cầu nhập)</i><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Giám đốc</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 8. PHIẾU NHẬP KHO ======================= */
  { id: "PNK", ten: "Phiếu nhập kho (mẫu 01-VT)", nhom: "Kho",
    moTa: "Dùng khi doanh nghiệp (bên mua) nhập kho hàng hóa, vật tư mua về theo hóa đơn, làm căn cứ ghi thẻ kho và hạch toán hàng tồn kho.",
    html: `<table class="plain"><tr><td style="width:55%; vertical-align:top"><b>Đơn vị: {{mua.ten}}</b><br>Địa chỉ: {{mua.dc}}</td><td style="width:45%; text-align:center; vertical-align:top"><b>Mẫu số 01 - VT</b><br><i><span style="font-size:10pt">(Theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 hoặc Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính)</span></i></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>PHIẾU NHẬP KHO</b></p>
<p style="text-align: center"><i>{{doc.ngay_chu}}</i></p>
<table class="plain"><tr><td style="width:60%; text-align:center; vertical-align:top">Số: {{doc.so}}</td><td style="width:40%; vertical-align:top">Nợ: …………<br>Có: …………</td></tr></table>
<p style="text-align: justify">- Họ và tên người giao: {{gn.nguoi_giao}} – Đơn vị: {{ban.ten}}</p>
<p style="text-align: justify">- Theo hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}} của {{ban.ten}}; Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}}</p>
<p style="text-align: justify; margin-bottom: 6pt">- Nhập tại kho: ………………… Địa điểm: {{gn.dia_diem}}</p>
<p>{{BANG_KHO}}</p>
<p style="text-align: justify">- Tổng số tiền (viết bằng chữ): {{tien.chu}}</p>
<p style="text-align: justify">- Số chứng từ gốc kèm theo: ……………………</p>
<p style="text-align: right; margin-bottom: 6pt"><i>{{doc.ngay_chu}}</i></p>
<table class="plain"><tr><td style="width:20%; text-align:center; vertical-align:top"><b>Người lập phiếu</b><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Người giao hàng</b><br><i>(Ký, họ tên)</i><br><br><br><br><br>{{gn.nguoi_giao}}</td><td style="width:20%; text-align:center; vertical-align:top"><b>Thủ kho</b><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Kế toán trưởng</b><br><i>(Hoặc bộ phận có nhu cầu nhập)</i><br><i>(Ký, họ tên)</i></td><td style="width:20%; text-align:center; vertical-align:top"><b>Giám đốc</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><b>{{mua.dd}}</b></td></tr></table>` },

  /* ======================= 9. HỢP ĐỒNG DỊCH VỤ ======================= */
  { id: "HDDV", ten: "Hợp đồng cung cấp dịch vụ", nhom: "Dịch vụ",
    moTa: "Dùng khi doanh nghiệp thuê hoặc cung cấp dịch vụ (tư vấn, sửa chữa, bảo trì, quảng cáo, đào tạo, phần mềm…) có phạm vi và giá trị xác định.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG CUNG CẤP DỊCH VỤ</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</i></p>
<p style="text-align: justify"><i>- Căn cứ nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (BÊN SỬ DỤNG DỊCH VỤ): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN CUNG CẤP DỊCH VỤ): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng cung cấp dịch vụ với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. NỘI DUNG DỊCH VỤ</b></p>
<p style="text-align: justify">1. Bên B cung cấp cho Bên A dịch vụ: {{noi_dung}}. Phạm vi công việc, yêu cầu chất lượng và sản phẩm bàn giao theo bảng dưới đây và các phụ lục (nếu có).</p>
<p style="text-align: justify">2. Thời gian thực hiện: {{thoi_gian}}.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG</b></p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">Tổng giá trị Hợp đồng: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}).<br><i>Bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify">Giá trị trên đã bao gồm toàn bộ chi phí để Bên B hoàn thành dịch vụ, trừ các chi phí phát sinh ngoài phạm vi được hai bên thống nhất bằng văn bản.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. NGHIỆM THU, HÓA ĐƠN VÀ THANH TOÁN</b></p>
<p style="text-align: justify">1. Khi hoàn thành dịch vụ (hoặc từng giai đoạn), hai bên lập Biên bản nghiệm thu hoàn thành dịch vụ. Trong vòng 03 ngày làm việc kể từ ngày nhận thông báo hoàn thành, nếu Bên A không có ý kiến bằng văn bản thì dịch vụ được coi là đã được nghiệm thu.</p>
<p style="text-align: justify">2. Bên B lập hóa đơn điện tử tại thời điểm hoàn thành việc cung cấp dịch vụ (hoặc thời điểm thu tiền nếu thu tiền trước) theo Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP.</p>
<p style="text-align: justify">3. Bên A thanh toán bằng {{tt.hinh_thuc}} vào tài khoản của Bên B trong vòng {{tt.han}} ngày kể từ ngày ký nghiệm thu và nhận hóa đơn hợp lệ. Không thanh toán bằng tiền mặt đối với hóa đơn có giá trị từ 05 triệu đồng trở lên.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</b></p>
<p style="text-align: justify">1. Cung cấp kịp thời thông tin, tài liệu, điều kiện làm việc cần thiết để Bên B thực hiện dịch vụ.</p>
<p style="text-align: justify">2. Nghiệm thu và thanh toán đầy đủ, đúng hạn; được yêu cầu Bên B khắc phục dịch vụ không đạt yêu cầu.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</b></p>
<p style="text-align: justify">1. Thực hiện dịch vụ đúng phạm vi, chất lượng, thời hạn; sử dụng nhân sự có năng lực phù hợp; khắc phục miễn phí các sai sót do lỗi của Bên B.</p>
<p style="text-align: justify">2. Giữ bí mật thông tin, tài liệu của Bên A trong và sau khi kết thúc Hợp đồng; không sử dụng cho mục đích khác khi chưa có sự đồng ý bằng văn bản của Bên A.</p>
<p style="text-align: justify">3. Được nhận thanh toán đầy đủ, đúng hạn; được yêu cầu Bên A cung cấp thông tin, tài liệu cần thiết.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. PHẠT VI PHẠM, BẤT KHẢ KHÁNG VÀ CHẤM DỨT HỢP ĐỒNG</b></p>
<p style="text-align: justify">1. Bên vi phạm chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm và bồi thường thiệt hại thực tế, trực tiếp phát sinh. Chậm thanh toán phải trả lãi theo lãi suất nợ quá hạn trung bình trên thị trường.</p>
<p style="text-align: justify">2. Bên gặp sự kiện bất khả kháng phải thông báo ngay bằng văn bản và được miễn trách nhiệm đối với nghĩa vụ bị ảnh hưởng.</p>
<p style="text-align: justify">3. Mỗi bên được đơn phương chấm dứt Hợp đồng khi bên kia vi phạm nghiêm trọng và không khắc phục trong 05 ngày kể từ ngày nhận yêu cầu bằng văn bản; hai bên thanh toán phần dịch vụ đã thực hiện.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">2. Mọi sửa đổi, bổ sung phải lập thành văn bản có chữ ký của đại diện hai bên. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 10. BIÊN BẢN NGHIỆM THU DỊCH VỤ ======================= */
  { id: "BBNT_DV", ten: "Biên bản nghiệm thu hoàn thành dịch vụ", nhom: "Dịch vụ",
    moTa: "Dùng khi bên cung cấp hoàn thành dịch vụ (toàn bộ hoặc từng giai đoạn) để hai bên xác nhận kết quả và giá trị làm căn cứ xuất hóa đơn, thanh toán.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt; margin-bottom: 6pt"><b>BIÊN BẢN NGHIỆM THU HOÀN THÀNH DỊCH VỤ</b></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ kết quả thực hiện dịch vụ thực tế của Bên B.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{gn.dia_diem}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN SỬ DỤNG DỊCH VỤ): {{mua.ten}}</b><br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}} – Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Người tiếp nhận kết quả: {{gn.nguoi_nhan}} – Chức vụ: {{gn.cv_nhan}} – CCCD: {{gn.cccd_nhan}} – ĐT: {{gn.sdt_nhan}} – Email: {{gn.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN CUNG CẤP DỊCH VỤ): {{ban.ten}}</b><br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}} – Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Người bàn giao kết quả: {{gn.nguoi_giao}} – Chức vụ: {{gn.cv_giao}} – CCCD: {{gn.cccd_giao}} – ĐT: {{gn.sdt_giao}}</p>
<p style="text-align: justify">Hai bên cùng tiến hành nghiệm thu dịch vụ {{noi_dung}} do Bên B thực hiện trong thời gian {{thoi_gian}}, hoàn thành ngày {{gn.ngay}}, với nội dung như sau:</p>
<p style="text-align: justify"><b>1. Khối lượng và giá trị dịch vụ hoàn thành:</b></p>
<p>{{BANG_HANG}}</p>
<p><i>Số tiền viết bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify"><b>2. Đánh giá chất lượng:</b> Bên B đã thực hiện đầy đủ phạm vi công việc, đạt yêu cầu chất lượng và thời hạn theo Hợp đồng. Hồ sơ, sản phẩm, tài liệu kèm theo đã được bàn giao đầy đủ cho Bên A.</p>
<p style="text-align: justify"><b>3. Kết luận:</b> Bên A đồng ý nghiệm thu dịch vụ với tổng giá trị {{tien.tong}} đồng (đã bao gồm {{thue.nhan}}). Bên B xuất hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}; Bên A thanh toán cho Bên B theo điều khoản thanh toán của Hợp đồng.</p>
<p style="text-align: justify">Ý kiến khác: {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 11. HỢP ĐỒNG VẬN CHUYỂN ======================= */
  { id: "HDVC", ten: "Hợp đồng vận chuyển hàng hóa", nhom: "Dịch vụ",
    moTa: "Dùng khi doanh nghiệp thuê hoặc cung cấp dịch vụ vận chuyển hàng hóa bằng ô tô hoặc phương tiện khác.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG VẬN CHUYỂN HÀNG HÓA</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 (Mục hợp đồng vận chuyển tài sản);</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</i></p>
<p style="text-align: justify"><i>- Căn cứ nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (BÊN THUÊ VẬN CHUYỂN): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN VẬN CHUYỂN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng vận chuyển hàng hóa với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. NỘI DUNG VẬN CHUYỂN</b></p>
<p style="text-align: justify">1. Bên B nhận vận chuyển cho Bên A: {{noi_dung}}.</p>
<p style="text-align: justify">2. Địa điểm nhận hàng: …………………………; địa điểm giao hàng: {{gn.dia_diem}}.</p>
<p style="text-align: justify">3. Phương tiện vận chuyển: {{gn.phuong_tien}} – Biển số: {{gn.bien_so}} (hoặc phương tiện khác tương đương được Bên A chấp thuận). Thời gian thực hiện: {{thoi_gian}}.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. CƯỚC PHÍ VẬN CHUYỂN</b></p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">Tổng cước phí: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}). <i>Bằng chữ: {{tien.chu}}</i><br>Cước phí đã bao gồm nhiên liệu, phí cầu đường, lương lái xe; chi phí bốc xếp hai đầu do ……… chịu.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. GIAO NHẬN HÀNG HÓA</b></p>
<p style="text-align: justify">1. Khi nhận và trả hàng, hai bên kiểm đếm số lượng, tình trạng bao bì bên ngoài và ký biên bản giao nhận / phiếu giao hàng có xác nhận của người nhận hàng.</p>
<p style="text-align: justify">2. Bên A cung cấp đầy đủ chứng từ đi kèm hàng hóa (hóa đơn, phiếu xuất kho kiêm vận chuyển nội bộ…) và đóng gói hàng hóa đúng quy cách.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. HÓA ĐƠN VÀ THANH TOÁN</b></p>
<p style="text-align: justify">Bên B lập hóa đơn điện tử khi hoàn thành dịch vụ vận chuyển (hoặc theo chuyến/theo tháng theo bảng kê đối chiếu). Bên A thanh toán bằng {{tt.hinh_thuc}} trong vòng {{tt.han}} ngày kể từ ngày nhận hóa đơn hợp lệ và bảng kê có xác nhận. Không thanh toán bằng tiền mặt đối với hóa đơn từ 05 triệu đồng trở lên.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. TRÁCH NHIỆM CỦA BÊN B</b></p>
<p style="text-align: justify">1. Bảo đảm phương tiện đủ điều kiện kỹ thuật, có giấy tờ hợp lệ; người điều khiển có giấy phép lái xe phù hợp; Bên B đáp ứng điều kiện kinh doanh vận tải theo quy định.</p>
<p style="text-align: justify">2. Vận chuyển đúng tuyến, đúng thời hạn; bảo quản hàng hóa trong quá trình vận chuyển. Bên B bồi thường thiệt hại nếu để hàng hóa mất mát, hư hỏng kể từ khi nhận hàng đến khi giao hàng, trừ trường hợp do lỗi của Bên A, do tính chất tự nhiên của hàng hóa hoặc do sự kiện bất khả kháng.</p>
<p style="text-align: justify">3. Chịu trách nhiệm về các vi phạm pháp luật giao thông, tải trọng trong quá trình vận chuyển.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. TRÁCH NHIỆM CỦA BÊN A</b></p>
<p style="text-align: justify">1. Giao hàng đúng thời gian, địa điểm; khai báo đúng tên, số lượng, tính chất hàng hóa; không giao hàng cấm, hàng nguy hiểm khi chưa thỏa thuận.</p>
<p style="text-align: justify">2. Thanh toán cước phí đầy đủ, đúng hạn; chịu chi phí phát sinh do chờ đợi quá thời gian thỏa thuận vì lỗi của Bên A.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. PHẠT VI PHẠM VÀ ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Bên vi phạm chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm và bồi thường thiệt hại thực tế phát sinh. Bên gặp sự kiện bất khả kháng được miễn trách nhiệm nếu thông báo kịp thời cho bên kia.</p>
<p style="text-align: justify">2. Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">3. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 12. HỢP ĐỒNG THUÊ TÀI SẢN ======================= */
  { id: "HDTHUE", ten: "Hợp đồng thuê tài sản (văn phòng, kho, xe…)", nhom: "Dịch vụ",
    moTa: "Dùng khi doanh nghiệp thuê hoặc cho thuê văn phòng, kho bãi, nhà xưởng, xe ô tô, máy móc thiết bị.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG THUÊ TÀI SẢN</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 (Mục hợp đồng thuê tài sản);</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</i></p>
<p style="text-align: justify"><i>- Căn cứ nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (BÊN THUÊ): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN CHO THUÊ): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng thuê tài sản với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. TÀI SẢN THUÊ VÀ MỤC ĐÍCH SỬ DỤNG</b></p>
<p style="text-align: justify">1. Bên B cho Bên A thuê tài sản: {{noi_dung}}. Địa điểm tài sản (đối với nhà, kho, mặt bằng): {{gn.dia_diem}}. Biển số (đối với xe): {{gn.bien_so}}; số khung, số máy, đặc điểm nhận dạng khác: ……………………</p>
<p style="text-align: justify">2. Bên B cam kết là chủ sở hữu hoặc có quyền cho thuê hợp pháp đối với tài sản; tài sản không có tranh chấp, không bị kê biên.</p>
<p style="text-align: justify">3. Mục đích thuê: phục vụ hoạt động sản xuất kinh doanh của Bên A.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. THỜI HẠN THUÊ</b></p>
<p style="text-align: justify">Thời hạn thuê: {{thoi_gian}}. Hết thời hạn, nếu Bên A có nhu cầu tiếp tục thuê thì thông báo cho Bên B trước ít nhất 30 ngày để ký phụ lục gia hạn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. GIÁ THUÊ, ĐẶT CỌC VÀ THANH TOÁN</b></p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">1. Tổng tiền thuê theo bảng trên: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}, nếu có). <i>Bằng chữ: {{tien.chu}}</i>. Giá thuê chưa bao gồm chi phí điện, nước, internet, nhiên liệu và chi phí vận hành khác do Bên A sử dụng thực tế.</p>
<p style="text-align: justify">2. Tiền đặt cọc: …………… đồng, Bên B hoàn trả khi kết thúc Hợp đồng sau khi trừ các khoản Bên A còn nợ (nếu có).</p>
<p style="text-align: justify">3. Kỳ thanh toán: …………… (tháng/quý), thanh toán trong vòng {{tt.han}} ngày đầu mỗi kỳ bằng {{tt.hinh_thuc}} vào tài khoản của Bên B. Bên B xuất hóa đơn cho Bên A theo từng kỳ thanh toán; trường hợp Bên B là cá nhân cho thuê tài sản thì thực hiện khai, nộp thuế theo quy định.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</b></p>
<p style="text-align: justify">1. Sử dụng tài sản đúng mục đích, giữ gìn, bảo quản; không cho thuê lại khi chưa có sự đồng ý bằng văn bản của Bên B.</p>
<p style="text-align: justify">2. Thanh toán tiền thuê đúng hạn; chịu chi phí sửa chữa hư hỏng nhỏ do lỗi sử dụng; trả lại tài sản đúng tình trạng ban đầu (trừ hao mòn tự nhiên) khi hết hạn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</b></p>
<p style="text-align: justify">1. Bàn giao tài sản đúng thời hạn, đúng tình trạng thỏa thuận, kèm giấy tờ liên quan (nếu có); lập biên bản bàn giao.</p>
<p style="text-align: justify">2. Bảo đảm quyền sử dụng ổn định của Bên A; sửa chữa hư hỏng lớn không do lỗi của Bên A; được nhận tiền thuê đúng hạn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. CHẤM DỨT HỢP ĐỒNG VÀ PHẠT VI PHẠM</b></p>
<p style="text-align: justify">1. Bên muốn chấm dứt Hợp đồng trước thời hạn phải báo trước ít nhất 30 ngày. Bên đơn phương chấm dứt trái thỏa thuận phải bồi thường cho bên kia một khoản tương đương …… tháng tiền thuê; Bên A chấm dứt trái thỏa thuận thì mất tiền đặt cọc.</p>
<p style="text-align: justify">2. Bên vi phạm các nghĩa vụ khác chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm và bồi thường thiệt hại thực tế phát sinh.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">2. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 13. HỢP ĐỒNG THI CÔNG XÂY DỰNG ======================= */
  { id: "HDXD", ten: "Hợp đồng thi công xây dựng", nhom: "Xây dựng",
    moTa: "Dùng khi chủ đầu tư giao cho nhà thầu thi công xây dựng, cải tạo, sửa chữa công trình hoặc hạng mục công trình.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG THI CÔNG XÂY DỰNG</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>Công trình: {{ct.ten}} – Hạng mục: {{ct.hang_muc}}</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Xây dựng và các văn bản sửa đổi, bổ sung, hướng dẫn thi hành hiện hành;</i></p>
<p style="text-align: justify"><i>- Căn cứ các quy định hiện hành của Chính phủ về hợp đồng xây dựng, quản lý chất lượng, thi công xây dựng và bảo trì công trình;</i></p>
<p style="text-align: justify"><i>- Căn cứ hồ sơ thiết kế, dự toán được duyệt và nhu cầu của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (CHỦ ĐẦU TƯ / BÊN GIAO THẦU): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (NHÀ THẦU THI CÔNG): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng thi công xây dựng với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. NỘI DUNG VÀ KHỐI LƯỢNG CÔNG VIỆC</b></p>
<p style="text-align: justify">Bên A giao, Bên B nhận thi công công trình {{ct.ten}}, hạng mục {{ct.hang_muc}}, tại {{ct.dia_diem}}, theo đúng hồ sơ thiết kế, bảng khối lượng, chỉ dẫn kỹ thuật được duyệt và các tiêu chuẩn, quy chuẩn kỹ thuật hiện hành.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. GIÁ TRỊ VÀ LOẠI HỢP ĐỒNG</b></p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">1. Giá trị Hợp đồng: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}). <i>Bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify">2. Loại hợp đồng: ………… (trọn gói / theo đơn giá cố định / theo đơn giá điều chỉnh). Khối lượng phát sinh ngoài phạm vi Hợp đồng chỉ được thanh toán khi có văn bản chấp thuận của Bên A và phụ lục hợp đồng.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. TẠM ỨNG, THANH TOÁN VÀ HÓA ĐƠN</b></p>
<p style="text-align: justify">1. Tạm ứng: Bên A tạm ứng ……% giá trị Hợp đồng trong vòng …… ngày kể từ ngày Hợp đồng có hiệu lực (kèm bảo lãnh tạm ứng nếu hai bên thỏa thuận). Tiền tạm ứng được thu hồi dần qua các lần thanh toán.</p>
<p style="text-align: justify">2. Thanh toán theo giai đoạn/khối lượng hoàn thành được nghiệm thu. Hồ sơ thanh toán gồm: Biên bản nghiệm thu khối lượng hoàn thành; Bảng xác định giá trị khối lượng hoàn thành đề nghị thanh toán; Giấy đề nghị thanh toán; hóa đơn GTGT hợp lệ. Bên A thanh toán trong vòng {{tt.han}} ngày kể từ ngày nhận đủ hồ sơ hợp lệ.</p>
<p style="text-align: justify">3. Bên B lập hóa đơn tại thời điểm nghiệm thu, bàn giao khối lượng hoàn thành theo Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP. Hình thức thanh toán: {{tt.hinh_thuc}} vào tài khoản của Bên B; không thanh toán bằng tiền mặt đối với hóa đơn từ 05 triệu đồng trở lên.</p>
<p style="text-align: justify">4. Bên A giữ lại ……% giá trị quyết toán làm tiền bảo hành (hoặc Bên B nộp bảo lãnh bảo hành tương đương); hoàn trả khi hết thời hạn bảo hành.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. TIẾN ĐỘ THI CÔNG</b></p>
<p style="text-align: justify">Thời gian thi công: từ ngày {{ct.tu_ngay}} đến ngày {{ct.den_ngay}} ({{thoi_gian}}). Tiến độ chi tiết theo bảng tiến độ được Bên A chấp thuận. Thời hạn được gia hạn tương ứng nếu chậm trễ do lỗi của Bên A, do thay đổi thiết kế hoặc do sự kiện bất khả kháng.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. CHẤT LƯỢNG, NGHIỆM THU, BÀN GIAO VÀ BẢO HÀNH</b></p>
<p style="text-align: justify">1. Bên B thi công đúng thiết kế, tiêu chuẩn, quy chuẩn; vật liệu, thiết bị có nguồn gốc, chứng chỉ chất lượng; lập nhật ký thi công và hồ sơ quản lý chất lượng.</p>
<p style="text-align: justify">2. Nghiệm thu công việc, giai đoạn và hoàn thành công trình theo quy định về quản lý chất lượng công trình xây dựng; bàn giao công trình kèm hồ sơ hoàn công.</p>
<p style="text-align: justify">3. Thời hạn bảo hành: {{bao_hanh}} tháng kể từ ngày ký biên bản nghiệm thu hoàn thành công trình đưa vào sử dụng (không thấp hơn thời hạn tối thiểu theo quy định). Bên B khắc phục hư hỏng trong vòng 07 ngày kể từ ngày nhận thông báo.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</b></p>
<p style="text-align: justify">Bàn giao mặt bằng, hồ sơ thiết kế đúng hạn; cử cán bộ giám sát; tổ chức nghiệm thu kịp thời; tạm ứng, thanh toán đúng hạn; được tạm dừng thi công khi Bên B vi phạm nghiêm trọng về chất lượng, an toàn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</b></p>
<p style="text-align: justify">Thi công đúng thiết kế, tiến độ, chất lượng; bố trí chỉ huy trưởng, nhân lực, thiết bị phù hợp; bảo đảm an toàn lao động, phòng chống cháy nổ, vệ sinh môi trường và mua bảo hiểm theo quy định; chịu trách nhiệm về thiệt hại do mình gây ra cho bên thứ ba; được thanh toán đầy đủ, đúng hạn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 8. PHẠT VI PHẠM, BẤT KHẢ KHÁNG VÀ CHẤM DỨT HỢP ĐỒNG</b></p>
<p style="text-align: justify">1. Bên B chậm tiến độ do lỗi của mình bị phạt ……% giá trị phần công việc chậm cho mỗi ngày chậm; các vi phạm khác bị phạt 8% giá trị phần hợp đồng bị vi phạm. Tổng mức phạt không vượt quá 12% giá trị phần hợp đồng bị vi phạm. Bên vi phạm còn phải bồi thường thiệt hại thực tế phát sinh.</p>
<p style="text-align: justify">2. Bên gặp sự kiện bất khả kháng phải thông báo ngay bằng văn bản và được miễn trách nhiệm đối với nghĩa vụ bị ảnh hưởng.</p>
<p style="text-align: justify">3. Mỗi bên được tạm dừng hoặc chấm dứt Hợp đồng khi bên kia vi phạm nghiêm trọng mà không khắc phục trong thời hạn yêu cầu; hai bên xác định giá trị khối lượng đã thực hiện để thanh toán, lập biên bản thanh lý.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 9. GIẢI QUYẾT TRANH CHẤP VÀ ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Tranh chấp được giải quyết bằng thương lượng, hòa giải; không thành thì đưa ra Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">2. Hồ sơ thiết kế, dự toán, bảng khối lượng, các biên bản nghiệm thu và phụ lục là bộ phận không tách rời của Hợp đồng. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 04 bản có giá trị như nhau, mỗi bên giữ 02 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 14. BIÊN BẢN NGHIỆM THU KHỐI LƯỢNG ======================= */
  { id: "BBNT_KL", ten: "Biên bản nghiệm thu khối lượng hoàn thành", nhom: "Xây dựng",
    moTa: "Dùng khi nghiệm thu khối lượng công việc xây dựng hoàn thành theo giai đoạn hoặc đợt thanh toán.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN NGHIỆM THU KHỐI LƯỢNG HOÀN THÀNH</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>Công trình: {{ct.ten}} – Hạng mục: {{ct.hang_muc}}<br>Địa điểm: {{ct.dia_diem}}</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng thi công xây dựng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ hồ sơ thiết kế, bản vẽ thi công, chỉ dẫn kỹ thuật được duyệt; nhật ký thi công và kết quả kiểm tra thực tế tại hiện trường.</i></p>
<p style="text-align: justify"><b>1. Thành phần trực tiếp nghiệm thu:</b></p>
<p style="text-align: justify">- Đại diện Bên A (Chủ đầu tư): {{mua.ten}}<br>Ông/Bà: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Ông/Bà: ………………… – Chức vụ: Cán bộ giám sát</p>
<p style="text-align: justify">- Đại diện Bên B (Nhà thầu thi công): {{ban.ten}}<br>Ông/Bà: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Ông/Bà: ………………… – Chức vụ: Chỉ huy trưởng công trình</p>
<p style="text-align: justify">- Đại diện đơn vị tư vấn giám sát (nếu có): ……………………………</p>
<p style="text-align: justify"><b>2. Thời gian nghiệm thu:</b> {{doc.ngay_chu}}, tại công trình. Khối lượng thực hiện từ ngày {{ct.tu_ngay}} đến ngày {{ct.den_ngay}}.</p>
<p style="text-align: justify"><b>3. Khối lượng hoàn thành được nghiệm thu:</b></p>
<p>{{BANG_HANG}}</p>
<p><i>Giá trị bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify"><b>4. Đánh giá:</b> Khối lượng thi công phù hợp với thiết kế, bản vẽ thi công và chỉ dẫn kỹ thuật; chất lượng đạt yêu cầu của tiêu chuẩn, quy chuẩn áp dụng; hồ sơ quản lý chất lượng đầy đủ.</p>
<p style="text-align: justify"><b>5. Kết luận:</b> Chấp nhận nghiệm thu khối lượng nêu trên với giá trị {{tien.tong}} đồng (đã bao gồm {{thue.nhan}}), làm căn cứ để Bên B lập hồ sơ đề nghị thanh toán. Yêu cầu khác: {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 04 bản có giá trị như nhau, mỗi bên giữ 02 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 15. BẢNG XÁC ĐỊNH GIÁ TRỊ KHỐI LƯỢNG ======================= */
  { id: "BGTKL", ten: "Bảng xác định giá trị khối lượng hoàn thành đề nghị thanh toán", nhom: "Xây dựng",
    moTa: "Dùng kèm biên bản nghiệm thu khối lượng để xác định giá trị được thanh toán kỳ này sau khi trừ tạm ứng và tiền giữ lại.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BẢNG XÁC ĐỊNH GIÁ TRỊ KHỐI LƯỢNG HOÀN THÀNH<br>ĐỀ NGHỊ THANH TOÁN</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>Giai đoạn thanh toán: từ ngày {{ct.tu_ngay}} đến ngày {{ct.den_ngay}}</i></p>
<p style="text-align: justify">1. Tên công trình: {{ct.ten}}<br>2. Hạng mục: {{ct.hang_muc}} – Địa điểm: {{ct.dia_diem}}<br>3. Chủ đầu tư (Bên A): {{mua.ten}} – MST: {{mua.mst}}<br>4. Nhà thầu (Bên B): {{ban.ten}} – MST: {{ban.mst}}<br>5. Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}}<br>6. Căn cứ Biên bản nghiệm thu khối lượng hoàn thành số {{so.BBNT_KL}} ngày {{ngay.BBNT_KL}}</p>
<p style="text-align: justify"><b>I. Giá trị khối lượng hoàn thành kỳ này:</b></p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify"><b>II. Tổng hợp giá trị đề nghị thanh toán:</b></p>
<table class="grid"><tr><td style="width:8%; text-align:center"><b>STT</b></td><td style="width:62%; text-align:center"><b>Nội dung</b></td><td style="width:30%; text-align:center"><b>Giá trị (đồng)</b></td></tr>
<tr><td style="text-align:center">1</td><td>Giá trị Hợp đồng</td><td>…………</td></tr>
<tr><td style="text-align:center">2</td><td>Giá trị tạm ứng còn lại chưa thu hồi đến cuối kỳ trước</td><td>…………</td></tr>
<tr><td style="text-align:center">3</td><td>Lũy kế giá trị khối lượng hoàn thành đến cuối kỳ trước</td><td>…………</td></tr>
<tr><td style="text-align:center">4</td><td>Giá trị khối lượng hoàn thành kỳ này (đã bao gồm {{thue.nhan}})</td><td><b>{{tien.tong}}</b></td></tr>
<tr><td style="text-align:center">5</td><td>Thu hồi tạm ứng kỳ này</td><td>…………</td></tr>
<tr><td style="text-align:center">6</td><td>Giá trị giữ lại (bảo hành / bảo đảm theo hợp đồng)</td><td>…………</td></tr>
<tr><td style="text-align:center">7</td><td><b>Giá trị đề nghị thanh toán kỳ này (7 = 4 − 5 − 6)</b></td><td>…………</td></tr>
<tr><td style="text-align:center">8</td><td>Lũy kế giá trị thanh toán đến hết kỳ này</td><td>…………</td></tr></table>
<p style="text-align: justify; margin-top: 6pt"><i>Giá trị khối lượng hoàn thành kỳ này bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: right; margin-bottom: 6pt"><i>{{dia_danh}}, {{doc.ngay_chu}}</i></p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 16. NGHIỆM THU BÀN GIAO CÔNG TRÌNH ======================= */
  { id: "BBBG_CT", ten: "Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng", nhom: "Xây dựng",
    moTa: "Dùng khi công trình hoặc hạng mục đã thi công xong toàn bộ, nghiệm thu hoàn thành và bàn giao cho chủ đầu tư đưa vào sử dụng.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{mua.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN NGHIỆM THU HOÀN THÀNH<br>BÀN GIAO CÔNG TRÌNH ĐƯA VÀO SỬ DỤNG</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>Công trình: {{ct.ten}} – Hạng mục: {{ct.hang_muc}}<br>Địa điểm: {{ct.dia_diem}}</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng thi công xây dựng số {{hop_dong.so}} ngày {{hop_dong.ngay}};</i></p>
<p style="text-align: justify"><i>- Căn cứ hồ sơ thiết kế được duyệt, các biên bản nghiệm thu công việc, giai đoạn và hồ sơ hoàn công công trình.</i></p>
<p style="text-align: justify"><b>1. Thành phần:</b></p>
<p style="text-align: justify">- Bên A (Chủ đầu tư): {{mua.ten}} – Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify">- Bên B (Nhà thầu thi công): {{ban.ten}} – Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify">- Đơn vị tư vấn giám sát / thiết kế (nếu có): ……………………………</p>
<p style="text-align: justify"><b>2. Thời gian:</b> Thi công từ ngày {{ct.tu_ngay}} đến ngày {{ct.den_ngay}}; nghiệm thu, bàn giao {{doc.ngay_chu}}.</p>
<p style="text-align: justify"><b>3. Đánh giá công trình:</b> Công trình được thi công đúng hồ sơ thiết kế, đạt yêu cầu chất lượng theo tiêu chuẩn, quy chuẩn áp dụng; các hệ thống kỹ thuật vận hành thử đạt yêu cầu; đảm bảo an toàn chịu lực, an toàn phòng cháy chữa cháy và vệ sinh môi trường (nếu thuộc diện phải nghiệm thu).</p>
<p style="text-align: justify"><b>4. Giá trị khối lượng hoàn thành theo Hợp đồng:</b> {{tien.tong}} đồng (đã bao gồm {{thue.nhan}}). <i>Bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify"><b>5. Hồ sơ bàn giao:</b> Bản vẽ hoàn công; nhật ký thi công; các biên bản nghiệm thu; chứng chỉ vật liệu, thiết bị; hướng dẫn vận hành, bảo trì; các tài liệu khác: {{ghi_chu}}</p>
<p style="text-align: justify"><b>6. Kết luận:</b> Chấp nhận nghiệm thu hoàn thành công trình/hạng mục để đưa vào sử dụng kể từ {{doc.ngay_chu}}. Bên B thực hiện bảo hành trong thời hạn {{bao_hanh}} tháng kể từ ngày ký biên bản này. Hai bên tiến hành quyết toán, thanh lý Hợp đồng theo quy định.</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 04 bản có giá trị như nhau, mỗi bên giữ 02 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 17. HỢP ĐỒNG GIA CÔNG ======================= */
  { id: "HDGC", ten: "Hợp đồng gia công", nhom: "Sản xuất",
    moTa: "Dùng khi doanh nghiệp đặt hoặc nhận gia công sản phẩm theo mẫu, định mức, có thể kèm nguyên vật liệu do bên đặt gia công cung cấp.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 16pt; margin-top: 12pt"><b>HỢP ĐỒNG GIA CÔNG</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: {{vv}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 (Mục hợp đồng gia công);</i></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005 (Mục gia công trong thương mại);</i></p>
<p style="text-align: justify"><i>- Căn cứ nhu cầu và khả năng của hai bên.</i></p>
<p style="text-align: justify; margin-top: 6pt">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm có:</p>
<p style="text-align: justify"><b>BÊN A (BÊN ĐẶT GIA CÔNG): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}}<br>Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Tài khoản số: {{mua.stk}} – Tại Ngân hàng: {{mua.nh}}<br>Điện thoại: {{mua.dt}} – Email: {{mua.email}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN NHẬN GIA CÔNG): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}}<br>Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Tài khoản số: {{ban.stk}} – Tại Ngân hàng: {{ban.nh}}<br>Điện thoại: {{ban.dt}} – Email: {{ban.email}}</p>
<p style="text-align: justify">Hai bên thống nhất ký kết Hợp đồng gia công với các điều khoản sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. SẢN PHẨM GIA CÔNG VÀ ĐƠN GIÁ</b></p>
<p style="text-align: justify">Bên A đặt và Bên B nhận gia công: {{noi_dung}}, theo mẫu, quy cách, tiêu chuẩn kỹ thuật do Bên A cung cấp và được hai bên ký xác nhận.</p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">Tổng giá trị tiền công gia công: <b>{{tien.tong}} đồng</b> (đã bao gồm {{thue.nhan}}). <i>Bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. NGUYÊN VẬT LIỆU VÀ ĐỊNH MỨC</b></p>
<p style="text-align: justify">1. Bên A giao nguyên vật liệu chính cho Bên B theo định mức tiêu hao và tỷ lệ hao hụt được hai bên thống nhất tại phụ lục; việc giao nhận lập biên bản giao nhận / phiếu xuất kho kiêm vận chuyển nội bộ. Nguyên vật liệu giao gia công vẫn thuộc quyền sở hữu của Bên A.</p>
<p style="text-align: justify">2. Bên B bảo quản nguyên vật liệu, sử dụng đúng mục đích; kết thúc hợp đồng phải quyết toán nguyên vật liệu, hoàn trả nguyên vật liệu thừa, phế liệu cho Bên A hoặc xử lý theo thỏa thuận; bồi thường phần hao hụt vượt định mức.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. THỜI GIAN, GIAO NHẬN VÀ NGHIỆM THU SẢN PHẨM</b></p>
<p style="text-align: justify">Thời gian thực hiện: {{thoi_gian}}. Địa điểm giao sản phẩm: {{gn.dia_diem}}. Mỗi lần giao sản phẩm, hai bên kiểm tra số lượng, chất lượng theo mẫu và ký biên bản nghiệm thu. Sản phẩm không đạt, Bên B phải sửa chữa hoặc làm lại bằng chi phí của mình.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. HÓA ĐƠN VÀ THANH TOÁN</b></p>
<p style="text-align: justify">Bên B lập hóa đơn GTGT đối với tiền công gia công khi bàn giao sản phẩm. Bên A thanh toán bằng {{tt.hinh_thuc}} vào tài khoản của Bên B trong vòng {{tt.han}} ngày kể từ ngày nghiệm thu, nhận hóa đơn hợp lệ và bảng quyết toán nguyên vật liệu. Không thanh toán bằng tiền mặt đối với hóa đơn từ 05 triệu đồng trở lên.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN</b></p>
<p style="text-align: justify">1. Bên A: giao nguyên vật liệu, mẫu, tài liệu kỹ thuật đúng hạn; kiểm tra, giám sát quá trình gia công; nhận sản phẩm và thanh toán đúng hạn; chịu trách nhiệm về quyền sở hữu trí tuệ đối với mẫu mã, nhãn hiệu do mình cung cấp.</p>
<p style="text-align: justify">2. Bên B: gia công đúng mẫu, quy cách, chất lượng, tiến độ; giữ bí mật mẫu mã, công nghệ; không sử dụng nguyên vật liệu, mẫu mã của Bên A cho mục đích khác; được nhận tiền công đầy đủ, đúng hạn.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 6. PHẠT VI PHẠM VÀ BẤT KHẢ KHÁNG</b></p>
<p style="text-align: justify">Bên vi phạm chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm và bồi thường thiệt hại thực tế phát sinh. Bên gặp sự kiện bất khả kháng phải thông báo ngay bằng văn bản và được miễn trách nhiệm đối với nghĩa vụ bị ảnh hưởng.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 7. ĐIỀU KHOẢN CHUNG</b></p>
<p style="text-align: justify">1. Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án nhân dân có thẩm quyền.</p>
<p style="text-align: justify">2. Phụ lục định mức, mẫu sản phẩm, biên bản giao nhận nguyên vật liệu và nghiệm thu là bộ phận không tách rời của Hợp đồng. Hợp đồng có hiệu lực kể từ ngày ký đến hết {{hieu_luc}}, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 18. BIÊN BẢN BÀN GIAO TSCĐ / CCDC ======================= */
  { id: "BBBG_TS", ten: "Biên bản bàn giao tài sản cố định / công cụ dụng cụ đưa vào sử dụng", nhom: "Tài sản",
    moTa: "Dùng khi nhận bàn giao tài sản cố định hoặc công cụ dụng cụ mua về để đưa vào sử dụng, làm căn cứ ghi tăng tài sản và tính khấu hao/phân bổ.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{mua.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN BÀN GIAO TÀI SẢN<br>ĐƯA VÀO SỬ DỤNG</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(Tài sản cố định / Công cụ dụng cụ)</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}} của {{ban.ten}}.</i></p>
<p style="text-align: justify">Hôm nay, {{gn.ngay_chu}}, tại {{gn.dia_diem}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN GIAO (BÊN B): {{ban.ten}}</b><br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}<br>Người trực tiếp bàn giao: {{gn.nguoi_giao}} – Chức vụ: {{gn.cv_giao}} – ĐT: {{gn.sdt_giao}}</p>
<p style="text-align: justify"><b>BÊN NHẬN (BÊN A): {{mua.ten}}</b><br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}<br>Người trực tiếp nhận / bộ phận sử dụng: {{gn.nguoi_nhan}} – Chức vụ: {{gn.cv_nhan}} – ĐT: {{gn.sdt_nhan}}</p>
<p style="text-align: justify">Hai bên tiến hành bàn giao, lắp đặt, chạy thử tài sản như sau:</p>
<p>{{BANG_GIAONHAN}}</p>
<p style="text-align: justify"><b>1. Nguyên giá (giá mua chưa thuế GTGT được khấu trừ, gồm chi phí vận chuyển, lắp đặt, chạy thử):</b> {{tien.hang}} đồng.</p>
<p style="text-align: justify"><b>2. Tình trạng tài sản:</b> Mới 100%, đầy đủ phụ kiện; đã lắp đặt, chạy thử hoạt động bình thường, đạt yêu cầu kỹ thuật.</p>
<p style="text-align: justify"><b>3. Tài liệu kèm theo:</b> Phiếu bảo hành ({{bao_hanh}} tháng), catalogue, hướng dẫn sử dụng, chứng nhận xuất xứ/chất lượng (nếu có), giấy đăng ký/đăng kiểm (đối với phương tiện).</p>
<p style="text-align: justify"><b>4. Đưa vào sử dụng:</b> Tài sản được đưa vào sử dụng tại bộ phận ………………… kể từ ngày {{gn.ngay}}. Bộ phận sử dụng chịu trách nhiệm quản lý, bảo quản; kế toán ghi tăng tài sản, trích khấu hao (TSCĐ) hoặc phân bổ chi phí (CCDC) từ ngày đưa vào sử dụng theo quy định.</p>
<p style="text-align: justify">Ghi chú: {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:33%; text-align:center; vertical-align:top"><b>BÊN NHẬN</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:34%; text-align:center; vertical-align:top"><b>NGƯỜI SỬ DỤNG / KẾ TOÁN</b><br><i>(Ký, họ tên)</i><br><br><br><br><br><b>{{gn.nguoi_nhan}}</b></td><td style="width:33%; text-align:center; vertical-align:top"><b>BÊN GIAO</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 19. GIẤY ĐỀ NGHỊ THANH TOÁN ======================= */
  { id: "DNTT", ten: "Giấy đề nghị thanh toán", nhom: "Thanh toán",
    moTa: "Dùng khi bên bán/bên cung cấp (Bên B) đề nghị bên mua (Bên A) thanh toán tiền theo hợp đồng, biên bản nghiệm thu và hóa đơn đã xuất.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}<br><i><span style="font-size:11pt">V/v: Đề nghị thanh toán</span></i></td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: right"><i>{{dia_danh}}, {{doc.ngay_chu}}</i></p>
<p style="text-align: center; font-size: 16pt; margin-top: 6pt; margin-bottom: 6pt"><b>GIẤY ĐỀ NGHỊ THANH TOÁN</b></p>
<p style="text-align: center"><b>Kính gửi: {{mua.ten}}</b></p>
<p style="text-align: justify">Địa chỉ: {{mua.dc}} – Mã số thuế: {{mua.mst}}</p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ biên bản nghiệm thu / giao nhận và hóa đơn GTGT ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}.</i></p>
<p style="text-align: justify">{{ban.ten}} (Bên B) đã hoàn thành việc cung cấp {{noi_dung}} cho Quý Công ty theo Hợp đồng nêu trên. Bên B kính đề nghị Quý Công ty thanh toán như sau:</p>
<table class="grid"><tr><td style="width:8%; text-align:center"><b>STT</b></td><td style="width:62%; text-align:center"><b>Nội dung</b></td><td style="width:30%; text-align:center"><b>Số tiền (đồng)</b></td></tr>
<tr><td style="text-align:center">1</td><td>Giá trị theo hóa đơn số {{hd.so}} ngày {{hd.ngay}} (đã bao gồm {{thue.nhan}})</td><td><b>{{tien.tong}}</b></td></tr>
<tr><td style="text-align:center">2</td><td>Số tiền đã tạm ứng / đã thanh toán</td><td>…………</td></tr>
<tr><td style="text-align:center">3</td><td><b>Số tiền đề nghị thanh toán lần này</b></td><td><b>{{tien.tong}}</b></td></tr></table>
<p style="text-align: justify; margin-top: 6pt">Số tiền bằng chữ: <i>{{tien.chu}}</i></p>
<p style="text-align: justify"><b>Thông tin nhận thanh toán:</b><br>Hình thức thanh toán: {{tt.hinh_thuc}}<br>Đơn vị thụ hưởng: {{ban.ten}}<br>Số tài khoản: <b>{{ban.stk}}</b> – Tại Ngân hàng: {{ban.nh}}<br>Thời hạn thanh toán: trong vòng {{tt.han}} ngày kể từ ngày nhận được hồ sơ hợp lệ.</p>
<p style="text-align: justify">Hồ sơ kèm theo: Hóa đơn GTGT; Biên bản nghiệm thu / giao nhận; Bảng kê chi tiết (nếu có). {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Rất mong nhận được sự hợp tác của Quý Công ty. Trân trọng cảm ơn!</p>
<table class="plain"><tr><td style="width:33%; text-align:center; vertical-align:top"><b>NGƯỜI ĐỀ NGHỊ</b><br><i>(Ký, họ tên)</i></td><td style="width:33%; text-align:center; vertical-align:top"><b>KẾ TOÁN</b><br><i>(Ký, họ tên)</i></td><td style="width:34%; text-align:center; vertical-align:top"><b>GIÁM ĐỐC BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 20. BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ ======================= */
  { id: "BBDCCN", ten: "Biên bản đối chiếu công nợ", nhom: "Thanh toán",
    moTa: "Dùng định kỳ (cuối tháng, quý, năm) hoặc khi kết thúc hợp đồng để hai bên xác nhận số dư công nợ phải thu, phải trả.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt; margin-bottom: 6pt"><b>BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ</b></p>
<p style="text-align: center"><i>(Tính đến ngày {{doc.ngay}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ sổ sách kế toán và các chứng từ giao nhận, hóa đơn, chứng từ thanh toán của hai bên.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify">Hai bên cùng đối chiếu công nợ phát sinh theo Hợp đồng nêu trên, kết quả như sau:</p>
<table class="grid"><tr><td style="width:8%; text-align:center"><b>STT</b></td><td style="width:52%; text-align:center"><b>Nội dung</b></td><td style="width:22%; text-align:center"><b>Số tiền (đồng)</b></td><td style="width:18%; text-align:center"><b>Ghi chú</b></td></tr>
<tr><td style="text-align:center">1</td><td>Số dư đầu kỳ Bên A còn phải thanh toán cho Bên B</td><td>…………</td><td></td></tr>
<tr><td style="text-align:center">2</td><td>Phát sinh tăng trong kỳ theo hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}</td><td>{{tien.tong}}</td><td></td></tr>
<tr><td style="text-align:center">3</td><td>Số tiền Bên A đã thanh toán trong kỳ</td><td>…………</td><td></td></tr>
<tr><td style="text-align:center">4</td><td><b>Số tiền Bên A còn phải thanh toán cho Bên B (4 = 1 + 2 − 3)</b></td><td><b>{{tien.tong}}</b></td><td></td></tr></table>
<p style="text-align: justify; margin-top: 6pt">Bằng chữ: <i>{{tien.chu}}</i></p>
<p style="text-align: justify"><b>Kết luận:</b> Tính đến ngày {{doc.ngay}}, {{mua.ten}} còn phải thanh toán cho {{ban.ten}} số tiền nêu tại dòng 4. Bên A thanh toán bằng {{tt.hinh_thuc}} vào tài khoản số {{ban.stk}} tại Ngân hàng {{ban.nh}}. {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản và là căn cứ để hai bên ghi sổ, thanh toán.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 21. BIÊN BẢN THANH LÝ HỢP ĐỒNG ======================= */
  { id: "BBTL", ten: "Biên bản thanh lý hợp đồng", nhom: "Chung",
    moTa: "Dùng khi hai bên đã hoàn thành (hoặc thỏa thuận chấm dứt) hợp đồng để xác nhận giá trị thực hiện, công nợ còn lại và chấm dứt nghĩa vụ.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN THANH LÝ HỢP ĐỒNG</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</i></p>
<p style="text-align: justify"><i>- Căn cứ {{hop_dong.ten}} số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ các biên bản giao nhận, nghiệm thu, hóa đơn và chứng từ thanh toán đã thực hiện.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A: {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify"><b>BÊN B: {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify">Hai bên thống nhất thanh lý Hợp đồng với các nội dung sau:</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 1. XÁC NHẬN THỰC HIỆN HỢP ĐỒNG</b></p>
<p style="text-align: justify">Bên B đã hoàn thành việc cung cấp {{noi_dung}} cho Bên A đúng số lượng, chất lượng theo Hợp đồng; Bên A đã nghiệm thu và nhận đầy đủ hóa đơn, chứng từ.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 2. GIÁ TRỊ VÀ CÔNG NỢ</b></p>
<table class="grid"><tr><td style="width:8%; text-align:center"><b>STT</b></td><td style="width:62%; text-align:center"><b>Nội dung</b></td><td style="width:30%; text-align:center"><b>Số tiền (đồng)</b></td></tr>
<tr><td style="text-align:center">1</td><td>Giá trị Hợp đồng thực hiện (đã bao gồm thuế GTGT)</td><td><b>{{tien.tong}}</b></td></tr>
<tr><td style="text-align:center">2</td><td>Bên A đã thanh toán</td><td>…………</td></tr>
<tr><td style="text-align:center">3</td><td>Giá trị giữ lại bảo hành (nếu có)</td><td>…………</td></tr>
<tr><td style="text-align:center">4</td><td><b>Bên A còn phải thanh toán (4 = 1 − 2 − 3)</b></td><td>…………</td></tr></table>
<p style="text-align: justify; margin-top: 6pt">Giá trị Hợp đồng thực hiện bằng chữ: <i>{{tien.chu}}</i>. Số tiền còn lại (nếu có) Bên A thanh toán bằng {{tt.hinh_thuc}} vào tài khoản số {{ban.stk}} tại Ngân hàng {{ban.nh}} trong vòng {{tt.han}} ngày kể từ ngày ký biên bản này.</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 3. CÁC NGHĨA VỤ CÒN LẠI</b></p>
<p style="text-align: justify">Bên B tiếp tục thực hiện nghĩa vụ bảo hành (nếu có) trong thời hạn {{bao_hanh}} tháng theo Hợp đồng. Ngoài ra, hai bên không còn nghĩa vụ nào khác. {{ghi_chu}}</p>
<p style="text-align: justify; margin-top: 6pt"><b>ĐIỀU 4. HIỆU LỰC</b></p>
<p style="text-align: justify">Kể từ khi Bên A thanh toán hết số tiền còn lại nêu tại Điều 2, Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} được thanh lý và chấm dứt hiệu lực (trừ nghĩa vụ bảo hành). Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 22. BIÊN BẢN ĐIỀU CHỈNH HÓA ĐƠN ======================= */
  { id: "BBDC_HD", ten: "Biên bản điều chỉnh hóa đơn", nhom: "Điều chỉnh",
    moTa: "Dùng khi hóa đơn điện tử đã lập và gửi cho người mua có sai sót, hai bên thỏa thuận lập hóa đơn điều chỉnh hoặc thay thế theo Điều 19 Nghị định 123/2020/NĐ-CP (sửa đổi bởi Nghị định 70/2025/NĐ-CP).",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN THỎA THUẬN ĐIỀU CHỈNH HÓA ĐƠN</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(V/v: Điều chỉnh hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Nghị định số 123/2020/NĐ-CP ngày 19/10/2020 của Chính phủ quy định về hóa đơn, chứng từ, được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP ngày 20/3/2025 và các văn bản hướng dẫn thi hành;</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}}.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify">Hai bên thống nhất xác nhận: Bên B đã lập và gửi cho Bên A hóa đơn điện tử Mẫu số {{hd.mau}}, ký hiệu {{hd.kh}}, số {{hd.so}}, {{hd.ngay_chu}}, nội dung {{noi_dung}}. Hóa đơn trên có sai sót như sau:</p>
<p style="text-align: justify"><b>1. Lý do điều chỉnh:</b> {{dc.ly_do}}</p>
<p style="text-align: justify"><b>2. Nội dung sai sót và điều chỉnh:</b></p>
<table class="grid"><tr><td style="width:50%; text-align:center"><b>Nội dung đã ghi trên hóa đơn (sai)</b></td><td style="width:50%; text-align:center"><b>Nội dung điều chỉnh lại (đúng)</b></td></tr>
<tr><td>{{dc.noi_dung_sai}}</td><td>{{dc.noi_dung_dung}}</td></tr></table>
<p style="text-align: justify; margin-top: 6pt"><b>3. Phương án xử lý:</b></p>
<p style="text-align: justify">- Bên B lập hóa đơn điện tử điều chỉnh (tăng/giảm) hoặc hóa đơn điện tử thay thế cho hóa đơn nêu trên theo Điều 19 Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP. Hóa đơn mới ghi rõ dòng chữ "Điều chỉnh (hoặc Thay thế) cho hóa đơn Mẫu số {{hd.mau}} ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}".</p>
<p style="text-align: justify">- Trường hợp chỉ sai tên, địa chỉ của Bên A nhưng không sai mã số thuế và các nội dung khác, Bên B thông báo cho Bên A về sai sót, không phải lập lại hóa đơn và thực hiện thông báo với cơ quan thuế theo quy định (nếu thuộc trường hợp phải thông báo).</p>
<p style="text-align: justify">- Hai bên kê khai, điều chỉnh doanh thu, chi phí, thuế GTGT đầu ra, đầu vào theo hóa đơn điều chỉnh/thay thế tại kỳ lập hóa đơn điều chỉnh/thay thế theo quy định của pháp luật về thuế.</p>
<p style="text-align: justify">Hai bên cam kết nội dung điều chỉnh trên là đúng thực tế giao dịch và chịu trách nhiệm trước pháp luật. Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản và lưu kèm hóa đơn gốc.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 23. BIÊN BẢN TRẢ LẠI HÀNG ======================= */
  { id: "BBTRL", ten: "Biên bản trả lại hàng", nhom: "Điều chỉnh",
    moTa: "Dùng khi bên mua trả lại một phần hoặc toàn bộ hàng hóa đã mua (sai quy cách, kém chất lượng…), làm căn cứ lập hóa đơn điều chỉnh và nhập lại kho.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{mua.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt; margin-bottom: 6pt"><b>BIÊN BẢN TRẢ LẠI HÀNG HÓA</b></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ hóa đơn GTGT Mẫu số {{hd.mau}} ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}} do {{ban.ten}} lập.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA – BÊN TRẢ HÀNG): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN – BÊN NHẬN LẠI HÀNG): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify"><b>1. Lý do trả lại hàng:</b> {{dc.ly_do}}</p>
<p style="text-align: justify"><b>2. Hàng hóa trả lại</b> (thuộc hóa đơn số {{hd.so}} ngày {{hd.ngay}}):</p>
<p>{{BANG_HANG}}</p>
<p><i>Giá trị hàng trả lại bằng chữ: {{tien.chu}}</i></p>
<p style="text-align: justify"><b>3. Thỏa thuận xử lý:</b></p>
<p style="text-align: justify">- Bên A giao trả, Bên B nhận lại đủ số hàng hóa nêu trên tại ………………… vào ngày …………; Bên B lập phiếu nhập kho hàng bán bị trả lại.</p>
<p style="text-align: justify">- Bên B lập hóa đơn điều chỉnh giảm đối với hàng hóa bị trả lại theo quy định tại Nghị định số 123/2020/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 70/2025/NĐ-CP (hoặc Bên A lập hóa đơn trả lại hàng nếu hai bên có thỏa thuận và pháp luật cho phép), ghi rõ điều chỉnh cho hóa đơn ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}.</p>
<p style="text-align: justify">- Số tiền hàng trả lại {{tien.tong}} đồng (đã bao gồm {{thue.nhan}}) được Bên B trừ vào công nợ phải thu của Bên A hoặc hoàn trả cho Bên A bằng {{tt.hinh_thuc}}. {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 24. QUYẾT ĐỊNH KHUYẾN MẠI ======================= */
  { id: "QD_KM", ten: "Quyết định ban hành chương trình khuyến mại", nhom: "Bán hàng",
    moTa: "Dùng khi doanh nghiệp tổ chức chương trình khuyến mại (tặng hàng, giảm giá, tặng kèm…) để làm căn cứ xuất hóa đơn hàng khuyến mại và hạch toán chi phí.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}/QĐ</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: right"><i>{{dia_danh}}, {{doc.ngay_chu}}</i></p>
<p style="text-align: center; font-size: 16pt; margin-top: 6pt"><b>QUYẾT ĐỊNH</b></p>
<p style="text-align: center"><b>Về việc ban hành chương trình khuyến mại {{vv}}</b></p>
<p style="text-align: center; margin-top: 6pt; margin-bottom: 6pt"><b>GIÁM ĐỐC {{ban.ten}}</b></p>
<p style="text-align: justify"><i>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</i></p>
<p style="text-align: justify"><i>- Căn cứ Nghị định số 81/2018/NĐ-CP ngày 22/5/2018 của Chính phủ quy định chi tiết Luật Thương mại về hoạt động xúc tiến thương mại và các văn bản sửa đổi, bổ sung;</i></p>
<p style="text-align: justify"><i>- Căn cứ Điều lệ tổ chức và hoạt động của {{ban.ten}};</i></p>
<p style="text-align: justify"><i>- Căn cứ kế hoạch kinh doanh và đề xuất của bộ phận kinh doanh.</i></p>
<p style="text-align: center; margin-top: 6pt; margin-bottom: 6pt"><b>QUYẾT ĐỊNH:</b></p>
<p style="text-align: justify"><b>Điều 1.</b> Ban hành chương trình khuyến mại với các nội dung sau:</p>
<p style="text-align: justify">1. Tên chương trình: {{vv}}.<br>2. Hàng hóa, dịch vụ được khuyến mại: {{noi_dung}}.<br>3. Thời gian khuyến mại: {{thoi_gian}}.<br>4. Địa bàn, kênh thực hiện: ……………………………<br>5. Hình thức khuyến mại: ………… (tặng hàng không thu tiền / giảm giá / bán hàng kèm tặng hàng…).<br>6. Khách hàng được hưởng: ……………………………<br>7. Hàng hóa, dịch vụ dùng để khuyến mại và cơ cấu giá trị:</p>
<p>{{BANG_HANG}}</p>
<p style="text-align: justify">8. Tổng giá trị hàng hóa, dịch vụ dùng để khuyến mại dự kiến: {{tien.tong}} đồng ({{tien.chu}}). Giá trị hàng hóa, dịch vụ dùng để khuyến mại cho một đơn vị hàng hóa được khuyến mại và mức giảm giá tuân thủ hạn mức tối đa theo Nghị định số 81/2018/NĐ-CP.</p>
<p style="text-align: justify"><b>Điều 2.</b> Bộ phận kinh doanh thực hiện thủ tục thông báo / đăng ký chương trình khuyến mại với Sở Công Thương nơi tổ chức khuyến mại theo quy định trước khi thực hiện; lập danh sách khách hàng nhận hàng khuyến mại. Bộ phận kế toán lập hóa đơn cho hàng hóa, dịch vụ khuyến mại theo quy định về hóa đơn (ghi tên, số lượng và ghi rõ là hàng khuyến mại), kê khai thuế và hạch toán chi phí khuyến mại theo quy định.</p>
<p style="text-align: justify"><b>Điều 3.</b> Quyết định có hiệu lực kể từ ngày ký. Các bộ phận Kinh doanh, Kế toán, Kho và các cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này.</p>
<table class="plain"><tr><td style="width:45%; vertical-align:top"><b><i>Nơi nhận:</i></b><br><span style="font-size:11pt">- Như Điều 3;<br>- Sở Công Thương (để thông báo);<br>- Lưu: VT, KT.</span></td><td style="width:55%; text-align:center; vertical-align:top"><b>GIÁM ĐỐC</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` },

  /* ======================= 25. XÁC NHẬN DOANH SỐ & CHIẾT KHẤU ======================= */
  { id: "BBXN_CK", ten: "Biên bản xác nhận doanh số & chiết khấu thương mại", nhom: "Bán hàng",
    moTa: "Dùng khi kết thúc kỳ tính chiết khấu để hai bên xác nhận doanh số đạt được và số tiền chiết khấu thương mại, làm căn cứ lập hóa đơn điều chỉnh giảm.",
    html: `<table class="plain"><tr><td style="width:40%; text-align:center; vertical-align:top"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%; text-align:center; vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table>
<p style="text-align: center; font-size: 15pt; margin-top: 12pt"><b>BIÊN BẢN XÁC NHẬN DOANH SỐ<br>VÀ CHIẾT KHẤU THƯƠNG MẠI</b></p>
<p style="text-align: center; margin-bottom: 6pt"><i>(Kỳ tính chiết khấu: {{thoi_gian}})</i></p>
<p style="text-align: justify"><i>- Căn cứ Hợp đồng số {{hop_dong.so}} ngày {{hop_dong.ngay}} giữa {{mua.ten}} và {{ban.ten}} và chính sách chiết khấu thương mại của {{ban.ten}} có hiệu lực trước thời điểm phát sinh giao dịch;</i></p>
<p style="text-align: justify"><i>- Căn cứ các hóa đơn bán hàng và số liệu đối chiếu của hai bên trong kỳ.</i></p>
<p style="text-align: justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p>
<p style="text-align: justify"><b>BÊN A (BÊN MUA): {{mua.ten}}</b><br>Mã số thuế: {{mua.mst}} – Địa chỉ: {{mua.dc}}<br>Đại diện: {{mua.dd}} – Chức vụ: {{mua.cv}}</p>
<p style="text-align: justify"><b>BÊN B (BÊN BÁN): {{ban.ten}}</b><br>Mã số thuế: {{ban.mst}} – Địa chỉ: {{ban.dc}}<br>Đại diện: {{ban.dd}} – Chức vụ: {{ban.cv}}</p>
<p style="text-align: justify">Hai bên cùng xác nhận doanh số và chiết khấu thương mại Bên A được hưởng như sau:</p>
<table class="grid"><tr><td style="width:8%; text-align:center"><b>STT</b></td><td style="width:62%; text-align:center"><b>Nội dung</b></td><td style="width:30%; text-align:center"><b>Giá trị</b></td></tr>
<tr><td style="text-align:center">1</td><td>Tổng doanh số mua hàng chưa thuế GTGT trong kỳ ({{noi_dung}})</td><td>…………</td></tr>
<tr><td style="text-align:center">2</td><td>Mức doanh số / sản lượng điều kiện được hưởng chiết khấu</td><td>…………</td></tr>
<tr><td style="text-align:center">3</td><td>Tỷ lệ chiết khấu được hưởng</td><td>…………%</td></tr>
<tr><td style="text-align:center">4</td><td>Số tiền chiết khấu chưa thuế GTGT</td><td>{{tien.hang}}</td></tr>
<tr><td style="text-align:center">5</td><td>{{thue.nhan}}</td><td>{{tien.thue}}</td></tr>
<tr><td style="text-align:center">6</td><td><b>Tổng số tiền chiết khấu</b></td><td><b>{{tien.tong}}</b></td></tr></table>
<p style="text-align: justify; margin-top: 6pt">Bằng chữ: <i>{{tien.chu}}</i></p>
<p style="text-align: justify"><b>Phương thức xử lý:</b></p>
<p style="text-align: justify">- Bên B lập hóa đơn điều chỉnh giảm cho các hóa đơn đã lập trong kỳ (hoặc ghi giảm trực tiếp trên hóa đơn của lần mua tiếp theo) theo quy định về hóa đơn; hóa đơn thể hiện khoản chiết khấu: ký hiệu {{hd.kh}} số {{hd.so}} ngày {{hd.ngay}}.</p>
<p style="text-align: justify">- Số tiền chiết khấu được bù trừ vào công nợ Bên A phải trả cho Bên B hoặc Bên B thanh toán cho Bên A bằng {{tt.hinh_thuc}}. {{ghi_chu}}</p>
<p style="text-align: justify; margin-bottom: 6pt">Kèm theo biên bản: Bảng kê chi tiết hóa đơn tính doanh số trong kỳ. Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table class="plain"><tr><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{mua.dd}}</b></td><td style="width:50%; text-align:center; vertical-align:top"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>{{ban.dd}}</b></td></tr></table>` }
];
