-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ TỜ KHAI — danh mục tờ khai + ngày lễ
--
-- Chạy SAU sql/15_tokhai_module.sql. Chạy lại nhiều lần vẫn an toàn.
-- Sửa được trên app sau này (Quản trị viên), file này chỉ nạp bộ khởi đầu.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Danh mục tờ khai
--
--    ma_tkhai_portal = <maTKhai> trong XML cổng trả về, dùng để khớp tự động khi đồng bộ.
--    864 lấy từ XML thật đã tải về ngày 18/09/2026 (05/KK-TNCN).
--    842 lấy từ data-ma-tkhai trên bảng kết quả tra cứu (01/GTGT) — ⚠ CẦN XÁC NHẬN LẠI khi đồng
--    bộ công ty đầu tiên; sai thì chỉ là không tự khớp được loại tờ khai, sửa trên app là xong.
--    Các mã còn lại để trống, điền dần khi gặp hồ sơ thật.
--
--    period_kind ở đây là MẶC ĐỊNH của loại tờ khai. Với GTGT và TNCN thì kỳ khai đi theo
--    từng công ty (clients.report_type: 260 cty khai quý, 33 cty khai tháng) nên để 'quarter'
--    cho khớp đa số; app luôn lấy theo công ty chứ không lấy dòng này.
-- ─────────────────────────────────────────────────────────────────────────────
insert into tax_filing_types (code, name, tax_kind, period_kind, ma_tkhai_portal, sort_order) values
  ('01/GTGT',     'Tờ khai thuế giá trị gia tăng (khấu trừ)',            'GTGT', 'quarter',    '842', 10),
  ('05/KK-TNCN',  'Tờ khai khấu trừ thuế thu nhập cá nhân',              'TNCN', 'quarter',    '864', 20),
  ('03/TNDN',     'Quyết toán thuế thu nhập doanh nghiệp',               'TNDN', 'settlement', null,  30),
  ('05/QTT-TNCN', 'Quyết toán thuế thu nhập cá nhân',                    'TNCN', 'settlement', null,  40),
  ('BCTC',        'Báo cáo tài chính năm',                               'BCTC', 'settlement', null,  50),
  ('04/SS-HĐĐT',  'Thông báo hóa đơn điện tử đã lập sai',                'HDDT', 'per_event',  null,  60)
on conflict (code) do nothing;

-- ⚠ LỆ PHÍ MÔN BÀI (01/MBAI) CỐ Ý KHÔNG CÓ trong danh mục: đã bỏ từ 01/01/2026 theo Nghị quyết
--   198/2025/QH15. Nếu cần tra cứu hồ sơ môn bài của các năm TRƯỚC 2026 thì thêm tay trên app,
--   nhưng đừng sinh nghĩa vụ cho kỳ 2026 trở đi.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ngày lễ — dùng để đẩy hạn nộp sang ngày làm việc kế tiếp
--
--    CHỈ nạp sẵn các ngày lễ CỐ ĐỊNH theo dương lịch. Tết Nguyên đán và Giỗ tổ Hùng Vương theo
--    âm lịch, lịch nghỉ cụ thể mỗi năm do Chính phủ công bố (thường có cả ngày nghỉ bù) —
--    ⚠ PHẢI THÊM TAY mỗi năm khi có thông báo, đừng đoán.
--
--    Thiếu ngày lễ thì hậu quả là app báo hạn SỚM HƠN thực tế: nhắc sớm vài ngày, không gây
--    mất hạn. Ngược lại nạp thừa mới nguy hiểm (báo hạn muộn hơn thực tế).
-- ─────────────────────────────────────────────────────────────────────────────
insert into tax_holidays (day, note) values
  ('2026-01-01', 'Tết Dương lịch'),
  ('2026-04-30', 'Ngày Giải phóng miền Nam'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh'),
  ('2027-01-01', 'Tết Dương lịch'),
  ('2027-04-30', 'Ngày Giải phóng miền Nam'),
  ('2027-05-01', 'Quốc tế Lao động'),
  ('2027-09-02', 'Quốc khánh')
on conflict (day) do nothing;
