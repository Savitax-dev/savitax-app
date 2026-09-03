-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Phân biệt nguồn của dòng "nợ tồn": phí kế toán hay phí HCNS
--
-- ⚠ CHẠY FILE NÀY TRƯỚC KHI DEPLOY code mới. Code mới lọc debt_rollovers theo cột `source`;
-- thiếu cột thì truy vấn lỗi và trang Công nợ phòng không tải được.
--
-- Chạy lại nhiều lần vẫn an toàn. Không xoá gì, không sửa dòng nào đang có.
--
-- Vì sao cần: phí HCNS thu thiếu cũng phải chuyển thành nợ tồn như phí kế toán, nhưng hai khoản
-- này của CÙNG một công ty trong CÙNG một tháng là hai dòng riêng. Không có cột phân biệt thì:
--   1. ensureRollovers thấy đã có dòng tháng đó nên bỏ qua, một trong hai khoản mất hút;
--   2. recomputeRolloversFrom (chạy khi sửa phí kế toán lùi) tính lại dòng HCNS theo phí KẾ TOÁN
--      — sai số tiền của khách.
--
-- Mọi dòng đang có mặc định là 'ketoan' → hành vi hiện tại không đổi một đồng nào.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table debt_rollovers add column if not exists source text not null default 'ketoan';

-- ensureRollovers tra "tháng này đã ghi nợ tồn chưa" theo đúng 4 cột này.
create index if not exists idx_debt_rollovers_source
  on debt_rollovers (client_id, year, month, source);

-- Kiểm tra sau khi chạy — phải trả về 1 dòng, mọi dòng cũ đều là 'ketoan'
-- select source, count(*) from debt_rollovers group by source;
