-- Báo cáo tình hình kinh doanh gửi khách hàng (thay sheet "5. BC Tháng_Quý" của SVT.MB07).
--
-- Anh chốt 28/11/2026: nhân viên vẫn nhập số mỗi kỳ (ngày 25 / ngày 15–20) nhưng nhập TRÊN APP, app dựng ảnh
-- báo cáo + lời nhắn Zalo, và lưu ảnh vào tab Tài liệu của đúng công ty (xem lại được theo ngày). Nhân viên
-- vẫn TỰ TICK việc trên Checklist.
--
-- Mỗi (công ty, kỳ) MỘT dòng số liệu — lập lại thì cập nhật dòng cũ. Ảnh mỗi lần lưu là một file riêng trong
-- bucket client-files (tab Tài liệu), file_path giữ ảnh mới nhất.
--   ky: 'T11.2026' (tháng) · 'Q4.2026' (quý) · 'NAM.2025' (năm) — cùng kiểu mã kỳ của phân hệ Tờ khai.
--   so_lieu: { hd_mv_hddt, hd_mv_hq, hd_mv_tm, hd_br, doanh_so, gtgt_dk, gtgt_mv, gtgt_br, ld_tv_kt, ld_tv_kkt,
--              ld_bhxh, tncn, ln_tt, cp_khl, tndn_tt, tndn_da_nop, den_ngay } — số null = không nhập.
--   ghi_chu: { <khóa dòng>: 'ghi chú tay' }
--
-- RLS bật, KHÔNG tạo policy: chỉ API (service role) đọc/ghi, có kiểm phạm vi công ty (lib/credentialScope.js).
-- Chạy: dán vào SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

create table if not exists bao_cao_khach (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  ky text not null,
  so_lieu jsonb not null default '{}'::jsonb,
  ghi_chu jsonb not null default '{}'::jsonb,
  file_path text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now(),
  updated_by uuid references staff(id),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create unique index if not exists bao_cao_khach_ky_idx on bao_cao_khach (client_id, ky);

alter table bao_cao_khach enable row level security;
