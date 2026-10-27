// Bộ kiểm bộ máy Soát xét báo cáo năm (lib/soatbaocao) trên 8 bộ dữ liệu mẫu giả lập × 4 năm (2023–2026).
//   node scripts/test-soatbaocao-mau.mjs [--chi-tiet]
// 1) TẮT mọi chỗ sửa lỗi → phải khớp TỪNG SỐ với mốc bản offline Check BCTC V3 (moc-soatbctc-v3.json): chứng minh chuyển đúng.
// 2) BẬT từng chỗ sửa lỗi B1–B14 → ca tái hiện phải ra kết quả đúng (xem lib/soatbaocao/suaLoi.js).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { taoBoMay } from '../lib/soatbaocao/boMay.js'

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), 'du-lieu-mau-phantich')
const moc = JSON.parse(fs.readFileSync(path.join(D, 'moc-soatbctc-v3.json'), 'utf8'))
const CHI_TIET = process.argv.includes('--chi-tiet')
const HOM_NAY = '2026-10-26T03:00:00Z'

let dat = 0, hong = 0
function kiem(dk, ten, chiTiet) { if (dk) dat++; else { hong++; console.log('  ✗', ten, chiTiet === undefined ? '' : chiTiet) } }

// Số ngẫu nhiên cố định — cùng dãy với lúc ghi mốc
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// ── Ảnh chụp kết quả — cùng cách lúc ghi mốc ────────────────────────────────────
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
function slug(t) {
  return norm(String(t ?? '').replace(/\d+(?:[.,]\d+)+/g, ' ')).split(' ').filter(w => {
    if (!/^\d+$/.test(w)) return true
    if (/^20[1-3]\d$/.test(w)) return false
    return w.length === 3 || w.length === 4 || w.length === 5
  }).slice(0, 9).join('_').toUpperCase()
}
const r0 = x => (x == null || !isFinite(x) ? null : Math.round(x))
const r4 = x => (x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4)
function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys)
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])]))
  return o
}
const issueRow = x => { const items = Array.isArray(x.items) ? x.items : []; return { ma: x.code || null, k: slug(x.t), muc: x.sev, nhom: x.cat, tien: r0(x.amt), n: items.length, tong: items.length ? r0(items.reduce((t, i) => t + Math.abs(+i.amt || 0), 0)) : null } }
function snapshot(X, C) {
  const S = X.getS()
  return sortKeys({
    loai: S.meta.loai, nam: S.meta.nam, cheDo: S.meta.cheDo,
    canDoi: C.C.map(c => ({ id: c.id, st: c.st, trai: r0(c.L), phai: r0(c.R), lech: r0(c.diff) })),
    doiChieu: C.RC.map(r => ({ ma: r.code || null, k: slug(r.n), st: r.st, a: r0(r.a), b: r0(r.b), lech: r0(r.d) })),
    vanDe: C.Rk.map(issueRow),
    chiSo: Object.fromEntries(C.Rt.map(r => [r.id, { t: r4(r.t), p: r4(r.p), lv: r.rt ? r.rt.lv : null }])),
    dacThu: C.K.map(k => ({ k: slug(k.n), x: r4(k.x), lv: k.ev ? k.ev.lv : null })),
    tinCay: { s: C.Q.s, gr: C.Q.gr },
    sucKhoe: C.H ? { s: C.H.s, gr: C.H.gr, nhom: C.H.gs.map(r4) } : null,
    zScore: C.Z ? r4(C.Z.z) : null,
    dupontRoe: C.D ? r4(C.D.roe) : null,
    demMuc: ['NT', 'TY', 'NHO'].reduce((o, s) => (o[s] = C.Rk.filter(r => r.sev === s).length, o), {}),
  })
}
// Nạp bộ mẫu L (cả 4 năm) vào hồ sơ — như nút "Nạp ví dụ" của bản offline
function napMau(X, L) {
  const ds = X.demoYears(L)
  const yrs = {}
  ds.forEach(d => { yrs[d.meta.nam] = { v: d.v, tb: d.tb, tk: d.tk, dk: d.dk, bk: d.bk, cheDo: d.meta.cheDo, ky: 'nam', quy: 4, skBal: d.skBal, skMap: {}, ck: {}, notes: { kl: '', ai: '' }, files: [] } })
  const act = ds.find(d => d.meta.nam === 2025) || ds.at(-1)
  X.setS(X.normCase({ ...X.blank(), meta: { ...act.meta, ngay: '2026-10-26' }, years: yrs }))
  X.invalidate()
  return ds
}
const tinhNam = (X, y) => { X.setYear(y); X.syncYear(); X.invalidate(); return X.compute() }

// ── 1) Khớp mốc khi tắt mọi chỗ sửa lỗi ─────────────────────────────────────────
{
  const X = taoBoMay({ homNay: HOM_NAY, ngauNhien: lcg(20261026), suaLoi: false })
  let khop = 0, tong = 0
  for (const L of Object.keys(X.MODELS)) {
    const ds = napMau(X, L)
    for (const y of X.DEMO_YEARS) {
      const C = tinhNam(X, y)
      const a = JSON.stringify(snapshot(X, C)), b = JSON.stringify(sortKeys(moc.ketQua[`${L}/${y}`]))
      tong++
      if (a === b) khop++
      else {
        kiem(false, `${L}/${y} khớp mốc`)
        if (CHI_TIET) { const A = JSON.parse(a), B = JSON.parse(b); for (const k of Object.keys(B)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) console.log('     lệch ở', k) }
      }
      const cai = [...new Set(ds.find(d => d.meta.nam === y).injected.map(i => i.code))].sort()
      kiem(JSON.stringify(cai) === JSON.stringify(moc.loiCaiSan[L][y]), `${L}/${y} bộ mẫu cài đúng lỗi như lúc ghi mốc`)
    }
  }
  console.log(`Tắt sửa lỗi: ${khop}/${tong} bộ × năm khớp mốc từng số`)
  if (khop === tong) dat++
}

// ── 2) Từng chỗ sửa lỗi B1–B14: tắt → ra đúng kết quả SAI cũ; bật → ra kết quả đúng ────────────────────
// Bộ mẫu SẠCH (không cài lỗi) — như ca tái hiện GĐ 0
function napSach(X, L) {
  let prev = null
  const ds = X.DEMO_YEARS.map(y => { const d = X.demoCase(L, { year: y, prev, errors: false }); prev = d.next; d.meta.skBal = d.skBal; return d })
  const yrs = {}
  ds.forEach(d => { yrs[d.meta.nam] = { v: d.v, tb: d.tb, tk: d.tk, dk: d.dk, bk: d.bk, cheDo: d.meta.cheDo, ky: 'nam', quy: 4, skBal: d.skBal, skMap: {}, ck: {}, notes: { kl: '', ai: '' }, files: [] } })
  const act = ds.find(d => d.meta.nam === 2025)
  // Ngày khóa sổ của TỪNG năm (bản offline chỉ có một ngày cho cả hồ sơ — lỗi B3)
  X.setS(X.normCase({ ...X.blank(), meta: { ...act.meta, khoaSoNam: Object.fromEntries(ds.map(d => [d.meta.nam, d.meta.khoaSo])) }, years: yrs })); X.invalidate()
}
// Chạy một ca hai lần (tắt / bật đúng một chỗ sửa), trả [kết quả khi tắt, khi bật]
function ca(ma, L, y, { sach = true, bienDoi } = {}, doc) {
  return [false, true].map(bat => {
    const X = taoBoMay({ homNay: HOM_NAY, ngauNhien: lcg(20261026), suaLoi: bat ? true : { [ma]: false } })
    sach ? napSach(X, L) : napMau(X, L)
    let C = tinhNam(X, y)
    if (bienDoi) { const r = bienDoi(X, X.getS(), C); if (r !== false) { X.invalidate(); C = X.compute() } }
    return doc(C, X)
  })
}
const vd = (C, f) => C.Rk.filter(f).map(r => `${r.code || '-'}|${r.sev}`)
const tb = n => Math.round(n)

{ // B1 ROE/ROA thiếu BCĐKT → "thiếu số liệu", không phải 0%
  const [cu, moi] = ca('B1', 'tm', 2025, { bienDoi: (X, S) => { for (const k of Object.keys(S.v)) if (X.FK[k] && X.FK[k].g === 'cd') delete S.v[k] } },
    C => ['CS05', 'CS06'].map(id => C.Rt.find(r => r.id === id).t))
  kiem(JSON.stringify(cu) === '[0,0]' && JSON.stringify(moi) === '[null,null]', 'B1: ROE/ROA thiếu BCĐKT', JSON.stringify([cu, moi]))
}
{ // B2 thuế TNCN mỗi kỳ nhỏ → đọc đúng [26]/[32] của 05/KK
  const [cu, moi] = ca('B2', 'dl', 2023, {}, C => vd(C, r => /^TNCN_(TK|QT)/.test(r.code || '')).length)
  kiem(cu === 3 && moi === 0, 'B2: 05/KK đọc nhầm thu nhập làm thuế', JSON.stringify([cu, moi]))
}
{ // B2 (27/10/2026): 05/KK mẫu TT80/2021 — mã chỉ tiêu lùi 5 so với TT156: [21] thu nhập chịu thuế, [29] thuế, [32] chỉ là thuế
  // trên phí bảo hiểm. DOEL, 127HOME khai TT80 → bản sửa cũ (cứng [26]/[32]) đọc ra 0, báo lệch 100% với bảng lương.
  // TT156 [21]–[28] → TT80 [16]–[23]; TT80 chèn [24] (phí bảo hiểm), [25] (miễn theo hiệp định) nên [29]–[34] → [26]–[31]; [32] = 0
  const sangTT80 = ct => { const o = {}; for (const [k, v] of Object.entries(ct)) { const n = +k; if (n >= 21 && n <= 28) o[n - 5] = v; else if (n >= 29 && n <= 34) o[n - 3] = v; else o[k] = v } o[24] = 0; o[25] = 0; o[32] = 0; return o }
  const dongTncn = C => C.RC.filter(r => /^TNCN_TK/.test(r.code || '')).map(r => `${r.code}|${Math.round(r.a)}|${r.st}`).sort()
  const [, moc156] = ca('B2', 'dl', 2023, {}, dongTncn)
  const [cu80, moi80] = ca('B2', 'dl', 2023, { bienDoi: (X, S) => { for (const x of S.dk || []) if (x.type === 'kk05') x.ct = sangTT80(x.ct) } }, dongTncn)
  kiem(moc156.length > 0 && JSON.stringify(moi80) === JSON.stringify(moc156) && JSON.stringify(cu80) !== JSON.stringify(moc156),
    'B2: 05/KK mẫu TT80 đọc [21]/[29] — ra đúng như mẫu TT156', JSON.stringify({ moc156, cu80, moi80 }))
}
{ // B3 khóa sổ theo năm: 2026 không báo 649 chứng từ giả; 2024 bắt chứng từ ghi lùi ngày
  const [cu26, moi26] = ca('B3', 'tm', 2026, {}, C => vd(C, r => r.code === 'SAU_KHOA_SO').length)
  const lui = (X, S) => { S.bk.nkc.push({ d: '2024-12-30', dc: '2025-02-15', so: 'PC-LUI', dg: 'Chi phí tiếp khách ghi lùi ngày', tk: '642', du: '1111', n: 9e6, c: 0, dt: '', src: 'nkc', hd: '' }, { d: '2024-12-30', dc: '2025-02-15', so: 'PC-LUI', dg: 'Chi phí tiếp khách ghi lùi ngày', tk: '1111', du: '642', n: 0, c: 9e6, dt: '', src: 'nkc', hd: '' }) }
  const [cu24, moi24] = ca('B3', 'tm', 2024, { bienDoi: lui }, C => vd(C, r => r.code === 'SAU_KHOA_SO').length)
  kiem(cu26 === 1 && moi26 === 0 && cu24 === 0 && moi24 === 1, 'B3: ngày khóa sổ theo từng năm', JSON.stringify([cu26, moi26, cu24, moi24]))
}
{ // B4 lệch đúng 1 tài khoản giữa dư đầu 2025 và dư cuối 2024 phải báo
  const [cu, moi] = ca('B4', 'tm', 2025, { bienDoi: (X, S) => { const r = S.tb.find(z => z.tk === '1121'); r.dnd += 5e6; r.dnc += 5e6 } },
    C => { const r = C.RC.find(x => x.code === 'LK_CDPS'); return [r.st, r.a] })
  kiem(cu[0] === 'ok' && moi[0] === 'fail' && moi[1] === 5e6, 'B4: liên kết CĐPS lệch 1 tài khoản', JSON.stringify([cu, moi]))
}
{ // B5 kỳ quý: giá vốn/doanh thu tháng bất thường vẫn được kiểm
  const [cu, moi] = ca('B5', 'xd', 2025, { bienDoi: (X, S) => { S.meta.ky = 'q'; S.meta.quy = 4 } }, C => vd(C, r => r.code === 'GV_DT_LECH').length)
  kiem(cu === 0 && moi === 1, 'B5: GV/DT tháng khi kỳ là quý', JSON.stringify([cu, moi]))
}
{ // B6 BCTC nhập nghìn đồng → không sinh vấn đề mới
  let goc
  const [cu, moi] = ca('B6', 'tm', 2025, { bienDoi: (X, S, C) => {
    goc = new Set(C.Rk.filter(r => r.cat !== 'cs').map(r => (r.code || '-') + '|' + r.t))
    S.meta.donVi = 'nghìn đồng'
    for (const [k, o] of Object.entries(S.v)) { if (!X.FK[k] || X.FK[k].u !== 'money' || o.auto) continue; if (o.t != null) o.t = Math.round(o.t / 1000); if (o.p != null) o.p = Math.round(o.p / 1000) }
  } }, C => C.Rk.filter(r => r.cat !== 'cs' && !goc.has((r.code || '-') + '|' + r.t)).length)
  kiem(cu > 30 && moi === 0, 'B6: BCTC theo nghìn đồng', JSON.stringify([cu, moi]))
}
{ // B7 miễn thuế TNDN 2026 (DT năm trước ≤ 1 tỷ) → không báo "không ghi chi phí thuế"
  const [cu, moi] = ca('B7', 'dv', 2026, { bienDoi: (X, S) => { S.v.DT_BH.p = 950e6; S.v.DThu.p = 950e6; S.v.THUE.t = 0; S.v.LNST.t = S.v.LNTT.t; S.dk = S.dk.filter(d => d.type !== 'tndn03') } },
    C => C.Rk.filter(r => /không ghi nhận chi phí thuế TNDN/.test(r.t)).length)
  kiem(cu === 1 && moi === 0, 'B7: miễn thuế TNDN 2026', JSON.stringify([cu, moi]))
}
{ // B8 "phát sinh" không phải tiền phạt
  const L = (tk, du, n, c) => ({ d: '2025-11-20', dc: '2025-11-20', so: 'PK1120', dg: 'Chi phí khác phát sinh khi thanh lý máy cũ', tk, du, n, c, dt: '', src: 'nkc', hd: '' })
  const [cu, moi] = ca('B8', 'tm', 2025, { bienDoi: (X, S) => { S.bk.nkc.push(L('811', '1121', 45e6, 0), L('1121', '811', 0, 45e6)) } }, C => vd(C, r => r.code === 'TNDN_CHUA_LOAI').length)
  kiem(cu === 1 && moi === 0, 'B8: "phát sinh" ≠ tiền phạt', JSON.stringify([cu, moi]))
}
{ // B9 "biểu mẫu" ≠ "biếu", "giả định" ≠ "gia đình"; quà biếu thật vẫn bắt
  const L = (so, dg, tk, du, n, c) => ({ d: '2025-05-12', dc: '2025-05-12', so, dg, tk, du, n, c, dt: '', src: 'nkc', hd: '' })
  const them = (X, S) => { S.bk.nkc.push(L('PC0512', 'In biểu mẫu, sổ sách kế toán', '642', '1111', 3e6, 0), L('PC0512', 'In biểu mẫu, sổ sách kế toán', '1111', '642', 0, 3e6),
    L('PK0513', 'Trích trước chi phí bảo hành theo giả định 2% doanh thu', '641', '352', 4e6, 0), L('PK0513', 'Trích trước chi phí bảo hành theo giả định 2% doanh thu', '352', '641', 0, 4e6),
    L('PC0514', 'Mua quà biếu đối tác dịp Tết', '642', '1111', 5e6, 0), L('PC0514', 'Mua quà biếu đối tác dịp Tết', '1111', '642', 0, 5e6)) }
  const [cu, moi] = ca('B9', 'tm', 2025, { bienDoi: them }, C => C.Rk.filter(r => /Diễn giải nhạy cảm/.test(r.t)).flatMap(r => (r.items || []).map(i => i.so)).filter(s => /^P[CK]051/.test(s)).sort())
  kiem(JSON.stringify(cu) === '["PC0512","PC0514","PK0513"]' && JSON.stringify(moi) === '["PC0514"]', 'B9: từ khóa bỏ dấu trùng nghĩa', JSON.stringify([cu, moi]))
}
{ // B10 tài khoản ngân hàng không giao dịch vẫn cộng số dư sao kê
  const [cu, moi] = ca('B10', 'nh', 2024, {}, C => vd(C, r => r.code === 'SK_CDPS').length)
  kiem(cu === 1 && moi === 0, 'B10: số dư tài khoản không giao dịch', JSON.stringify([cu, moi]))
}
{ // B11 hóa đơn đã chi qua ngân hàng (chứng từ có Có 112) không bị báo "chưa thanh toán"
  const [cu, moi] = ca('B11', 'tm', 2025, {}, C => { const r = C.Rk.find(x => x.code === 'HD_CHUA_TT_NH'); return r ? (r.items || []).length : 0 })
  kiem(cu === 12 && moi === 0, 'B11: hóa đơn đã chi qua ngân hàng', JSON.stringify([cu, moi]))
}
{ // B12 lương + thưởng cùng tháng: giảm trừ một lần
  const [cu, moi] = ca('B12', 'tm', 2025, { bienDoi: (X, S) => {
    const base = S.bk.luong.find(r => r.ma === 'NV010' && r.ym === '2025-12')
    const self = X.pol('pit_self', '2025-12-15'), dep = X.pol('pit_dep', '2025-12-15')
    const tnttAll = Math.max(0, base.tn + 20e6 - base.mien - base.bh - self - dep * base.npt)
    S.bk.luong.push({ ...base, tn: 20e6, mien: 0, tnct: 20e6, bh: 0, thue: X.pitTax(tnttAll, '2025-12-15') - base.thue })
  } }, C => { const w = C.Rk.find(r => r.code === 'TNCN_TINH_LAI'); const p = C.TN.people.find(x => x.ma === 'NV010'); return [w ? (w.items || []).filter(i => i.so === 'NV010').length : 0, tb(p.self)] })
  kiem(cu[0] === 1 && cu[1] === 143e6 && moi[0] === 0 && moi[1] === 132e6, 'B12: lương + thưởng cùng tháng', JSON.stringify([cu, moi]))
}
{ // B13 MỌI hóa đơn từ ngưỡng đều chưa thấy thanh toán → vẫn phải báo
  const [cu, moi] = ca('B13', 'tm', 2025, { bienDoi: (X, S) => { S.bk.sk = S.bk.sk.filter(r => !(r.c > 0)) } }, C => vd(C, r => r.code === 'HD_CHUA_TT_NH').length)
  kiem(cu === 0 && moi === 1, 'B13: tất cả hóa đơn chưa thanh toán', JSON.stringify([cu, moi]))
}
{ // B14 tờ khai thiếu [24]: không coi là 0, không lấy [28] (đầu ra) thay
  const [cu, moi] = ca('B14', 'tm', 2025, { bienDoi: (X, S) => { S.tk.filter(t => /^T1[0-2]\//.test(t.ky)).forEach(t => { delete t.ct['24'] }); delete S.v.CT24_SUM } },
    C => [vd(C, r => /Thuế GTGT đầu vào trên sổ lệch tờ khai|Thuế đầu vào: bảng kê/.test(r.t)).length, C.RC.some(r => /Thuế đầu vào: bảng kê HĐ/.test(r.n))])
  kiem(cu[0] === 2 && moi[0] === 0 && moi[1] === false, 'B14: tờ khai thiếu [24]', JSON.stringify([cu, moi]))
}

{ // B15 + B16: BCTC XML của HTKK (cấu trúc thật: CDKT_HoatDongLienTuc/SoCuoiNam, PLuc/PL_KQHDSXKD/NamNay)
  const { caiDomParser } = await import('./lib-dom-node.mjs'); caiDomParser()
  const xml = (cd, kd) => `<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu><HSoKhaiThue><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>683</maTKhai><tenTKhai>Báo cáo tài chính</tenTKhai><KyKKhaiThue><kieuKy>Y</kieuKy><kyKKhai>2024</kyKKhai></KyKKhaiThue></TKhaiThue><NNT><mst>0109999982</mst><tenNNT>CONG TY MAU</tenNNT></NNT></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><CDKT_HoatDongLienTuc><SoCuoiNam>${Object.entries(cd).map(([k, v]) => `<ct${k}>${v}</ct${k}>`).join('')}</SoCuoiNam></CDKT_HoatDongLienTuc></CTieuTKhaiChinh><PLuc><PL_KQHDSXKD><NamNay>${Object.entries(kd).map(([k, v]) => `<ct${k}>${v}</ct${k}>`).join('')}</NamNay></PL_KQHDSXKD></PLuc></HSoKhaiThue></HSoThueDTu>`
  const doc = (suaLoi, x) => { const X = taoBoMay({ homNay: HOM_NAY, suaLoi }); X.setS(X.normCase({ ...X.blank(), meta: { ...X.blank().meta, nam: 2024, vd: false } })); X.nhapFile({ ten: 'bctc.xml', duoi: 'xml', xml: x }); X.xongNhap(); return X.getS().v }
  // TT200: mã 200 = TS dài hạn (0), 270 = TỔNG tài sản
  const tt200 = xml({ 100: 500, 110: 500, 200: 0, 270: 500, 300: 100, 400: 400, 440: 500 }, { '01': 1000, 10: 1000, 11: 600, 20: 400, 50: 300, 60: 240 })
  const cu = doc({ B15: false, B16: false }, tt200), moi = doc(true, tt200)
  kiem(cu.TONG_TS?.t === 0 && moi.TONG_TS?.t === 500 && moi.TSDH?.t === 0, 'B15: BCTC XML TT200 — mã 200 là TS dài hạn, không phải tổng TS', JSON.stringify([cu.TONG_TS, moi.TONG_TS, moi.TSDH]))
  // TT133 (B01a): mã 200 = TỔNG tài sản, có 500
  const tt133 = xml({ 110: 300, 200: 300, 300: 50, 400: 250, 500: 300 }, { '01': 800, 10: 800 })
  kiem(doc(true, tt133).TONG_TS?.t === 300, 'B15: BCTC XML TT133 — mã 200 là tổng tài sản', JSON.stringify(doc(true, tt133).TONG_TS))
  kiem(cu.DThu == null && moi.DThu?.t === 1000 && moi.LNST?.t === 240, 'B16: KQKD trong PL_KQHDSXKD được đọc', JSON.stringify([cu.DThu, moi.DThu, moi.LNST]))
}

{ // B18: sheet không tiêu đề — bảng quyết toán TNCN trong file lương (STT, tên, MST, tiền) KHÔNG phải bảng cân đối phát sinh
  // (DOEL 2026: sheet QTTTNCN thành CĐPS 408 "tài khoản"); CĐPS thật không tiêu đề vẫn nhận ra nhờ tên tài khoản.
  const luong = Array.from({ length: 20 }, (_, i) => [i + 1, 'Nhân viên ' + (i + 1), String(8000000000 + i * 7919), 12000000 + i * 1000, 11000000, 0, 15500000, 0, 0, 1100000])
  const cdps = [['111', 'Tiền mặt', 5e6, 0, 2e7, 1.8e7, 7e6, 0], ['112', 'Tiền gửi ngân hàng', 9e7, 0, 3e8, 2.9e8, 1e8, 0], ['131', 'Phải thu của khách hàng', 4e7, 0, 1e8, 9e7, 5e7, 0],
    ['133', 'Thuế GTGT được khấu trừ', 1e6, 0, 8e6, 7e6, 2e6, 0], ['156', 'Hàng hóa', 6e7, 0, 2e8, 1.9e8, 7e7, 0], ['331', 'Phải trả cho người bán', 0, 3e7, 1.5e8, 1.6e8, 0, 4e7],
    ['333', 'Thuế và các khoản phải nộp', 0, 2e6, 5e6, 6e6, 0, 3e6], ['334', 'Phải trả người lao động', 0, 0, 6e7, 6e7, 0, 0], ['411', 'Vốn đầu tư của chủ sở hữu', 0, 1e9, 0, 0, 0, 1e9],
    ['511', 'Doanh thu bán hàng', 0, 0, 5e8, 5e8, 0, 0], ['632', 'Giá vốn hàng bán', 0, 0, 3e8, 3e8, 0, 0]]
  const kieu = (suaLoi, rows) => taoBoMay({ homNay: HOM_NAY, suaLoi }).detectKind({ rows })
  kiem(kieu({ B18: false }, luong) === 'cdps' && kieu(true, luong) !== 'cdps' && kieu(true, cdps) === 'cdps',
    'B18: bảng lương không tiêu đề không bị nhận là CĐPS; CĐPS không tiêu đề vẫn nhận', JSON.stringify([kieu({ B18: false }, luong), kieu(true, luong), kieu(true, cdps)]))
  // Rà soát 27/10: CĐPS tiếng Anh (khách FDI) không tiêu đề vẫn nhận
  const tenAnh = { '111': 'Cash on hand', '112': 'Cash in bank', '131': 'Accounts receivable', '331': 'Accounts payable', '632': 'Cost of goods sold' }
  const cdpsAnh = cdps.map(r => [r[0], tenAnh[r[0]] || 'Other account ' + r[0], ...r.slice(2)])
  kiem(kieu(true, cdpsAnh) === 'cdps', 'B18: CĐPS tiếng Anh không tiêu đề vẫn nhận', kieu(true, cdpsAnh))
}
{ // B17: bảng cân đối tài khoản dạng HTKK — cột tiền giãn cách bởi ô gộp, có cột "Thuyết minh"
  const sp = (n, o) => { const r = Array(36).fill(''); r[0] = n[0]; r[1] = n[1]; [14, 18, 22, 26, 30, 35].forEach((k, i) => { if (o[i] != null) r[k] = o[i] }); return r }
  const hdr = Array(36).fill(''); hdr[0] = 'Số hiệu tài khoản'; hdr[1] = 'Tên tài khoản'; hdr[12] = 'Thuyết minh'; hdr[14] = 'Số dư đầu kỳ'; hdr[22] = 'Số phát sinh trong kỳ'; hdr[30] = 'Số dư cuối kỳ'
  const hdr2 = Array(36).fill(''); [14, 18, 22, 26, 30, 35].forEach((k, i) => { hdr2[k] = i % 2 ? 'Có' : 'Nợ' })
  const bang = [{ name: 'BCĐTK', rows: [['BẢNG CÂN ĐỐI TÀI KHOẢN'], ['Năm 2025'], hdr, hdr2, sp(['131', 'Phải thu của khách hàng'], [4100, 1500, 63672, 51172, 17600, 2500]), sp(['511', 'Doanh thu'], [0, 0, 59100, 59100, 0, 0]), sp(['111', 'Tiền mặt'], [150, null, 700, 600, 250, null])] }]
  const doc = suaLoi => { const X = taoBoMay({ homNay: HOM_NAY, suaLoi }); X.setS(X.normCase({ ...X.blank(), meta: { ...X.blank().meta, nam: 2025, vd: false } })); X.nhapFile({ ten: 'cdtk.xlsx', duoi: 'xlsx', bang: bang.map(t => ({ ...t, kind: 'cdps' })) }); X.xongNhap(); const r = X.getS().tb.find(x => x.tk === '131'); return r ? [r.dnd, r.dcd, r.psn, r.psc, r.dnc, r.dcc] : null }
  const cu = doc({ B17: false }), moi = doc(true)
  kiem(JSON.stringify(moi) === '[4100,1500,63672,51172,17600,2500]' && JSON.stringify(cu) !== JSON.stringify(moi), 'B17: bảng cân đối tài khoản dạng HTKK đọc đúng 6 cột', JSON.stringify([cu, moi]))
}

// ── 3) Bật mọi chỗ sửa: lỗi CÀI SẴN trong bộ mẫu vẫn phải bắt được như bản gốc (sửa lỗi không được che lỗi thật) ──
{
  const batDuoc = suaLoi => {
    const X = taoBoMay({ homNay: HOM_NAY, ngauNhien: lcg(20261026), suaLoi })
    const ra = {}
    for (const L of Object.keys(X.MODELS)) {
      const ds = napMau(X, L)
      for (const y of X.DEMO_YEARS) {
        const C = tinhNam(X, y)
        const ma = new Set([...C.Rk.map(r => r.code), ...C.RC.filter(r => r.st === 'fail').map(r => r.code)].filter(Boolean))
        for (const c of new Set(ds.find(d => d.meta.nam === y).injected.map(i => i.code))) { ra[c] = ra[c] || { cai: 0, bat: 0 }; ra[c].cai++; if (ma.has(c)) ra[c].bat++ }
      }
    }
    return ra
  }
  const goc = batDuoc(false), moi = batDuoc(true)
  const ma = Object.keys(goc).sort()
  const tong = o => ma.reduce((s, c) => s + o[c].bat, 0)
  console.log(`Lỗi cài sẵn bắt được: bản gốc ${tong(goc)}/${ma.reduce((s, c) => s + goc[c].cai, 0)} lần (${ma.length} mã) · bật sửa ${tong(moi)}`)
  const mat = ma.filter(c => moi[c].bat < goc[c].bat)
  kiem(mat.length === 0, 'bật sửa lỗi không làm mất lỗi cài sẵn nào bản gốc đã bắt', mat.map(c => `${c}: ${goc[c].bat}→${moi[c].bat}`).join(', '))
}

console.log(hong ? `\n✗ ${hong} lỗi / ${dat + hong} phép kiểm` : `\n✓ Đạt ${dat}/${dat} phép kiểm`)
process.exit(hong ? 1 : 0)
