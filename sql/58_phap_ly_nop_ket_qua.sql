-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — GIAI ĐOẠN 4: trình ký → nộp & theo dõi → kết quả (GCN) → tệp scan lưu Drive (Savitax, 17/11/2026)
-- Đi sau sql/57. Chạy lại an toàn. ⚠ Đang thử trên DATABASE DEMO — CHƯA chạy production. Bản clone không chạy.
-- RLS bật, KHÔNG policy (như sql/56, 57): chỉ máy chủ đọc ghi qua app/api/admin/phaply/**.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Trình ký: từng tờ của bộ hồ sơ (mã mẫu trong lib/phaply/word/danhMuc.js) đã ký chưa
create table if not exists legal_case_signing (
  case_id    uuid not null references legal_cases(id) on delete cascade,
  dot        text not null check (dot in ('so','thue')),
  ma         text not null,                    -- mã mẫu Word: UQ_SO, DL_1TV, MAU2…
  signed_at  timestamptz not null default now(),
  signed_by  uuid references staff(id) on delete set null,
  primary key (case_id, dot, ma)
);

-- 2. Nộp hồ sơ: mỗi LẦN nộp một dòng (nộp lại sau khi bổ sung = dòng mới, lan tăng dần)
create table if not exists legal_case_submissions (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references legal_cases(id) on delete cascade,
  co_quan         text not null default 'so' check (co_quan in ('so','thue','khac')),
  lan             int  not null default 1,
  ngay_nop        date not null,
  hinh_thuc       text not null default 'online' check (hinh_thuc in ('online','giay')),
  ma_bien_nhan    text,                        -- mã hồ sơ trên Cổng ĐKDN / số giấy biên nhận
  ngay_hen_tra    date,
  ket_qua         text not null default 'cho' check (ket_qua in ('cho','bo_sung','dat','tu_choi')),
  ngay_ket_qua    date,
  noi_dung_bo_sung text,                       -- nội dung thông báo sửa đổi, bổ sung / lý do từ chối
  han_bo_sung     date,
  ghi_chu         text,
  created_by      uuid references staff(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists legal_case_submissions_case_idx on legal_case_submissions (case_id, ngay_nop);

-- 3. Tệp scan đã tải lên Drive (bản ký, biên nhận, GCN, BBBG…) — tệp nằm trên Drive phòng pháp lý, ở đây chỉ giữ chỉ mục
create table if not exists legal_case_files (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references legal_cases(id) on delete cascade,
  thu_muc       text not null,                 -- khoá THU_MUC (lib/phaply/drive.js): trinh_ky, nop, ket_qua, ban_giao…
  ten           text not null,
  mime          text,
  kich_thuoc    int,
  drive_file_id text not null,
  drive_url     text,
  uploaded_by   uuid references staff(id) on delete set null,
  created_at    timestamptz default now()
);
create index if not exists legal_case_files_case_idx on legal_case_files (case_id, created_at);

-- 4. Kết quả: Giấy chứng nhận đăng ký doanh nghiệp (mã số = legal_entities.tax_code)
alter table legal_entities add column if not exists ngay_cap_gcn text;   -- dd/mm/yyyy, ngày đăng ký lần đầu
alter table legal_entities add column if not exists noi_cap_gcn  text;   -- Phòng ĐKKD cấp

alter table legal_case_signing     enable row level security;
alter table legal_case_submissions enable row level security;
alter table legal_case_files       enable row level security;
grant all privileges on table legal_case_signing, legal_case_submissions, legal_case_files to service_role;
