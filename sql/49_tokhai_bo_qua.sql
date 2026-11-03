-- Phân hệ Tờ khai — nút "BỎ QUA" một ô tờ khai cho trường hợp đặc biệt (anh yêu cầu 03/11/2026; CHỈ quản trị bấm).
-- Ô bỏ qua: không tính "Quá hạn", không nằm trong danh sách nhắc hạn, hiện lý do + ai bỏ qua + lúc nào.
-- Hồ sơ thật từ cổng thuế về sau vẫn thắng (app hiện theo hồ sơ). Hủy bỏ qua = trả về "Chưa nộp".
-- Chạy lại nhiều lần vẫn an toàn. Bản clone có phân hệ Tờ khai cũng chạy được.

alter table tax_obligations add column if not exists skip_reason text;
alter table tax_obligations add column if not exists skipped_by  uuid references staff(id) on delete set null;
alter table tax_obligations add column if not exists skipped_at  timestamptz;

-- Mở rộng ràng buộc trạng thái: thêm 'skipped'. Ràng buộc cũ tạo kèm cột (sql/15) nên tên do Postgres tự đặt —
-- tìm và bỏ mọi ràng buộc CHECK đang nói về cột state rồi tạo lại.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'tax_obligations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%state%'
  loop
    execute 'alter table tax_obligations drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;
alter table tax_obligations add constraint tax_obligations_state_check
  check (state in ('not_filed','received','accepted','rejected','overdue','no_activity','skipped'));

select
  (select count(*) from information_schema.columns where table_name = 'tax_obligations' and column_name in ('skip_reason','skipped_by','skipped_at')) as so_cot_moi,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'tax_obligations_state_check') as rang_buoc;
