-- Cho phép MỘT tháng có hai dòng nợ tồn: một của phí kế toán, một của phí HCNS.
--
-- LỖI ĐÃ XẢY RA (anh phát hiện 14/10/2026, công ty BẢO VỆ HẬU CẦN THĂNG LONG): phí HCNS tháng 9
-- không vào được nợ tồn, tab "Nợ tồn cũ" chỉ hiện phí kế toán.
--
-- Nguyên nhân: bảng này từ ngày đầu có `unique (client_id, year, month)`. sql/11 thêm cột `source`
-- để tách nợ kế toán với nợ HCNS, nhưng CHỈ thêm một index thường — ràng buộc cũ vẫn còn nguyên.
-- Nên tháng nào công ty nợ CẢ HAI khoản thì dòng kế toán ghi trước, dòng HCNS bị từ chối. Lỗi đó
-- rơi vào một câu console.error trong lib/hcnsRollover.js nên không ai thấy, im lặng từ tháng 9.
--
-- Đo được lúc phát hiện: 188 dòng nợ tồn thì 183 là kế toán, chỉ 5 là HCNS, và KHÔNG tháng nào có
-- cả hai nguồn — con số bất khả nếu việc ghi không bị chặn. Mất 22.680.000đ của 10 công ty.
--
-- An toàn: 188 dòng đang có không dòng nào trùng nhau theo đủ 4 cột, và cột source là not null
-- (sql/11) nên không có dòng nào để rỗng. Chạy lại nhiều lần vẫn an toàn.
--
-- ⚠ CHẠY FILE NÀY SAU KHI ĐẨY MÃ MỚI. Ba chỗ truy vấn nợ kế toán trước đây không lọc theo nguồn
-- vì chưa bao giờ có hai dòng cùng tháng (app/api/admin/room, debt-overview, save-debt). Chạy SQL
-- trước khi mã mới lên thì khoảng thời gian ở giữa sẽ hiện sai số nợ.

alter table debt_rollovers drop constraint if exists debt_rollovers_client_id_year_month_key;

-- Hai dòng cùng (công ty, tháng) được, miễn khác nguồn. Vẫn chặn ghi trùng trong CÙNG một nguồn —
-- đó mới là thứ ràng buộc cũ thật sự cần bảo vệ (ensureRollovers chạy mỗi lần mở trang phòng).
create unique index if not exists debt_rollovers_ky_nguon_idx
  on debt_rollovers (client_id, year, month, source);

-- Kiểm tra sau khi chạy — phải thấy cả 'ketoan' lẫn 'hcns', và từ nay số dòng hcns sẽ tăng:
-- select source, count(*) from debt_rollovers group by source;
