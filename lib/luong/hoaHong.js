// Phân hệ Tiền lương — HOA HỒNG GIỚI THIỆU KHÁCH (sql/39, anh chốt 22–23/10/2026). BƯỚC 2 của phân hệ.
//
// Kỳ lương tháng N, mỗi người giới thiệu X:
//   1. Công ty của X: clients.gioi_thieu_boi = X và gioi_thieu_tu ≤ tháng N.
//   2. BẬC: đếm công ty của X ĐANG dùng dịch vụ trong tháng N → % theo luong_hoa_hong_bac (mốc lớn nhất ≤ số đếm).
//      Không còn công ty nào đang dùng (đều đã ngưng) mà vẫn thu được nợ cũ → lấy bậc THẤP NHẤT.
//   3. TIỀN: phần khách trả THÊM kể từ lần chốt trước = tiền đã thu hiện tại − phần đã ghi trong sổ
//      luong_hoa_hong_so ở các kỳ lương KHÁC, theo từng (công ty, nguồn, kỳ): phí kế toán, phí HCNS, dịch vụ
//      khác (hồ sơ + thu lẻ), thu nợ tồn. Chỉ tính kỳ ≥ tháng bắt đầu hưởng. Xoá nợ không phải tiền thu.
//   4. HOA HỒNG từng dòng = tiền thêm ÷ 1,08 (tách VAT) × % (làm tròn đồng); tổng = cộng các dòng.
// Ghi sổ lúc CHỐT bảng lương; mở chốt xoá ghi nhận tháng đó (app/api/admin/luong/chot).

const pad = n => String(n).padStart(2, '0')
export const VAT = 1.08

// Bậc: [{ tu_so_cty, ty_le }]. soCty = số công ty đang dùng dịch vụ.
export function tyLeTheoBac(bac, soCty) {
  const ds = [...(bac || [])].map(b => ({ tu: Number(b.tu_so_cty), tl: Number(b.ty_le) })).filter(b => b.tu >= 1 && b.tl > 0).sort((a, b) => a.tu - b.tu)
  if (!ds.length) return 0
  let tl = 0
  for (const b of ds) if (soCty >= b.tu) tl = b.tl
  return soCty === 0 ? ds[0].tl : tl
}

// congTy: [{ id, ten, ma, gioiThieuBoi, gioiThieuTu ('YYYY-MM-DD'), dangDung (tháng N) }]
// thu:    [{ client_id, nguon, ky, kyThang ('YYYY-MM'), so_tien }] — số đã thu LUỸ KẾ hiện tại của từng khoá
// daTinh: Map 'client|nguon|ky' → tổng so_tien đã ghi sổ ở các kỳ lương KHÁC tháng N
export function tinhHoaHong({ congTy, thu, daTinh, bac, nam, thang }) {
  const moc = nam + '-' + pad(thang)
  const theoCty = new Map(congTy.filter(c => c.gioiThieuBoi && c.gioiThieuTu && String(c.gioiThieuTu).slice(0, 7) <= moc).map(c => [c.id, c]))
  const kq = new Map()
  const lay = id => {
    if (!kq.has(id)) kq.set(id, { soCty: 0, soCtyTong: 0, tyLe: 0, tienThem: 0, chuaVat: 0, hoaHong: 0, chiTiet: [] })
    return kq.get(id)
  }
  for (const c of theoCty.values()) { const x = lay(c.gioiThieuBoi); x.soCtyTong++; if (c.dangDung) x.soCty++ }
  for (const [id, x] of kq) x.tyLe = tyLeTheoBac(bac, x.soCty)
  for (const t of thu) {
    const c = theoCty.get(t.client_id)
    if (!c || String(t.kyThang) < String(c.gioiThieuTu).slice(0, 7)) continue
    const them = Math.round((Number(t.so_tien) || 0) - (daTinh.get(t.client_id + '|' + t.nguon + '|' + t.ky) || 0))
    if (!them) continue
    const x = lay(c.gioiThieuBoi)
    const hh = Math.round(them / VAT * x.tyLe / 100)
    x.tienThem += them; x.chuaVat += Math.round(them / VAT); x.hoaHong += hh
    x.chiTiet.push({ client_id: c.id, ten: c.ten, ma: c.ma, nguon: t.nguon, ky: t.ky, kyThang: t.kyThang, so_tien: them, ty_le: x.tyLe, hoa_hong: hh })
  }
  return kq
}

// ── Đọc dữ liệu (máy chủ) ────────────────────────────────────────────────────────
async function docHet(q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// Hoa hồng cho kỳ lương (nam, thang). Chưa chạy sql/39 → Map rỗng (bảng lương vẫn chạy như cũ).
export async function hoaHongThang(supabase, nam, thang, { countsForMonth } = {}) {
  let clients
  try {
    clients = await docHet(() => supabase.from('clients')
      .select('id, name, client_code, status, service_end, contract_start, created_at, gioi_thieu_boi, gioi_thieu_tu').not('gioi_thieu_boi', 'is', null))
  } catch { return new Map() }
  if (!clients.length) return new Map()
  const { data: bac, error: eb } = await supabase.from('luong_hoa_hong_bac').select('tu_so_cty, ty_le')
  if (eb) return new Map()
  const ids = clients.map(c => c.id)
  const thu = [], so = []
  for (let i = 0; i < ids.length; i += 200) {
    const lo = ids.slice(i, i + 200)
    const sf = await docHet(() => supabase.from('service_fees').select('id, client_id, year, month, type, amount').in('client_id', lo).in('type', ['ketoan', 'khach', 'no_ton']))
    for (const f of sf) thu.push({ client_id: f.client_id, nguon: f.type, ky: f.year + '-' + pad(f.month), kyThang: f.year + '-' + pad(f.month), so_tien: Number(f.amount) || 0 })
    const op = await docHet(() => supabase.from('other_service_payments').select('id, client_id, year, month, amount').in('client_id', lo))
    for (const p of op) thu.push({ client_id: p.client_id, nguon: 'dvk', ky: p.id, kyThang: p.year + '-' + pad(p.month), so_tien: Number(p.amount) || 0 })
    const hc = await docHet(() => supabase.from('hcns_clients').select('id, linked_client_id').in('linked_client_id', lo))
    if (hc.length) {
      const map = new Map(hc.map(h => [h.id, h.linked_client_id]))
      const hf = await docHet(() => supabase.from('hcns_service_fees').select('id, hcns_client_id, year, month, amount').in('hcns_client_id', hc.map(h => h.id)).eq('type', 'hcns'))
      for (const f of hf) thu.push({ client_id: map.get(f.hcns_client_id), nguon: 'hcns', ky: f.year + '-' + pad(f.month), kyThang: f.year + '-' + pad(f.month), so_tien: Number(f.amount) || 0 })
    }
    so.push(...await docHet(() => supabase.from('luong_hoa_hong_so').select('id, nam, thang, client_id, nguon, ky, so_tien').in('client_id', lo)))
  }
  // Gộp các dòng cùng khoá (phòng khi một khoá có nhiều dòng) — luỹ kế = tổng.
  const gop = new Map()
  for (const t of thu) { const k = t.client_id + '|' + t.nguon + '|' + t.ky; const g = gop.get(k); if (g) g.so_tien += t.so_tien; else gop.set(k, { ...t }) }
  const daTinh = new Map()
  for (const r of so) {
    if (r.nam === nam && r.thang === thang) continue
    const k = r.client_id + '|' + r.nguon + '|' + r.ky
    daTinh.set(k, (daTinh.get(k) || 0) + (Number(r.so_tien) || 0))
  }
  const moc = new Date(Date.UTC(nam, thang - 1, 1)).toISOString().slice(0, 10)
  const congTy = clients.map(c => ({
    id: c.id, ten: c.name, ma: c.client_code, gioiThieuBoi: c.gioi_thieu_boi, gioiThieuTu: c.gioi_thieu_tu,
    dangDung: (c.service_end ? String(c.service_end).slice(0, 10) > moc : c.status === 'active') && (countsForMonth ? countsForMonth(c, nam, thang) : true),
  }))
  return tinhHoaHong({ congTy, thu: [...gop.values()], daTinh, bac: bac || [], nam, thang })
}

export const TEN_NGUON = { ketoan: 'Phí kế toán', hcns: 'Phí HCNS', khach: 'Thu khác', dvk: 'Dịch vụ khác', no_ton: 'Thu nợ tồn' }
