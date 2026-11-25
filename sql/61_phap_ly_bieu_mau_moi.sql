-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- PHÂN HỆ PHÁP LÝ — dữ liệu cho bộ biểu mẫu mới (phòng pháp lý gửi 25/11/2026: Điều lệ bổ sung, TLM hộ kinh doanh / đơn vị phụ
-- thuộc, tạm ngừng, giải thể, hoạt động lại, thay đổi). Đi sau sql/60. Chạy lại an toàn. ⚠ Đang thử trên DATABASE DEMO — CHƯA
-- chạy production. Bản clone không chạy. (Số 61 của nhánh pháp lý — main đã có sql/56 của Phòng KD; đánh lại số khi gộp.)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. NGƯỜI LÀ TỔ CHỨC (chủ sở hữu 1TV / thành viên 2TV / cổ đông là tổ chức). Dùng chung bảng legal_people: la_to_chuc = true thì
--    ho_ten = tên tổ chức, thuong_tru = địa chỉ trụ sở chính; các cột cá nhân (giới tính, ngày sinh, CCCD) bỏ trống.
alter table legal_people add column if not exists la_to_chuc          boolean not null default false;
alter table legal_people add column if not exists ma_so_dn            text;   -- mã số doanh nghiệp / số quyết định thành lập
alter table legal_people add column if not exists ngay_cap_dn         text;   -- dd/mm/yyyy
alter table legal_people add column if not exists noi_cap_dn          text;
alter table legal_people add column if not exists dai_dien_ten        text;   -- người đại diện theo pháp luật CỦA tổ chức (ký văn bản cử người đại diện)
alter table legal_people add column if not exists dai_dien_chuc_danh  text;

-- 2. VAI TRÒ MỚI
--    dai_dien_uy_quyen : người đại diện theo ủy quyền của một tổ chức (cua_person_id = tổ chức đó), kèm vốn được ủy quyền
--    nguoi_dung_dau    : người đứng đầu chi nhánh / văn phòng đại diện / địa điểm kinh doanh
--    thanh_vien_ho     : thành viên hộ gia đình đăng ký hộ kinh doanh
alter table legal_entity_people drop constraint if exists legal_entity_people_vai_tro_check;
alter table legal_entity_people add constraint legal_entity_people_vai_tro_check check (vai_tro in
  ('dai_dien','giam_doc','chu_so_huu','thanh_vien','co_dong','ke_toan','thu_ky','dai_dien_uy_quyen','nguoi_dung_dau','thanh_vien_ho'));
alter table legal_entity_people add column if not exists cua_person_id      uuid references legal_people(id) on delete cascade;
alter table legal_entity_people add column if not exists von_uy_quyen       numeric;   -- vốn / số cổ phần được ủy quyền đại diện (đồng)
alter table legal_entity_people add column if not exists thoi_diem_dai_dien text;      -- "Kể từ ngày được cấp GCN ĐKDN" …

-- 3. THÔNG TIN RIÊNG CỦA TỪNG THỦ TỤC (đơn vị phụ thuộc, hộ kinh doanh, tạm ngừng, giải thể…) — khuôn ô do lib/phaply/thongTin.js
--    quy định theo thủ tục; một cột jsonb thay vì hàng chục cột lẻ.
alter table legal_cases add column if not exists thong_tin jsonb not null default '{}'::jsonb;

-- 4. Trình ký theo bộ: giải thể có 3 bộ (so1 · thue · so2) — nới ràng buộc bộ của bảng đã ký (sql/58)
alter table legal_case_signing drop constraint if exists legal_case_signing_dot_check;
alter table legal_case_signing add constraint legal_case_signing_dot_check check (dot in ('so','thue','so1','so2'));

-- 5. ĐIỀU LỆ BỔ SUNG (mẫu phòng gửi 25/11/2026: chủ sở hữu là tổ chức, nhiều người đại diện theo pháp luật)
alter table legal_entity_people add column if not exists quyen_han text;              -- người đại diện thứ 2 trở đi: quyền & nghĩa vụ (chữ tự do)
alter table legal_entities add column if not exists thoi_han_hoat_dong text;          -- "50 năm" | "vô thời hạn" — Điều 1 Điều lệ
alter table legal_entities add column if not exists so_lan_hop_hdtv    text;          -- 2TV: Hội đồng thành viên họp "01" lần / năm
alter table legal_entities add column if not exists dia_chi_cn_vpdd    text;          -- Điều 3: địa chỉ chi nhánh, văn phòng đại diện (nếu có)
