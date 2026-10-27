// Bộ diễn dịch quy tắc 39 tiêu chí (trường chuẩn, mức độ, điều kiện, chỉ số EI).
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.
import R39 from './r39.js'
const Risk3 = (function () {
  'use strict';
  var R = null, E = null;
  var RG2R3 = { TT99: 'TT99', TT133a: 'TT133_B01a', TT133b: 'TT133_B01b', TT200: 'TT200' };
  var LVL = { 'cao': 'cao', 'trung bình': 'tb', 'trung binh': 'tb', 'thấp': 'thap', 'thap': 'thap', 'không': 'khong', 'khong': 'khong', 'n/a': 'na', 'không áp dụng': 'na', 'thiếu dữ liệu': 'missing', 'thông tin': 'info', 'thong tin': 'info' };
  var ORD = { khong: 0, thap: 1, tb: 2, cao: 3 }, BYORD = ['khong', 'thap', 'tb', 'cao'];
  function lv(s) { return LVL[String(s || '').toLowerCase().trim()] || 'tb'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  /* ================= Biểu thức (phương ngữ rules3) ================= */
  var TOK = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[A-Za-z_À-ỹ][A-Za-z0-9_À-ỹ]*(?:\.[A-Za-z0-9_]+)*|\?\?|&&|\|\||==|!=|>=|<=|[-+*\/()<>!,?:%\[\]])/y;
  var CACHE = {};
  function tokenize(src) {
    if (CACHE[src]) return CACHE[src];
    var t = [], p = 0;
    while (p < src.length) { TOK.lastIndex = p; var m = TOK.exec(src); if (!m) { if (/^\s*$/.test(src.slice(p))) break; throw new Error('Biểu thức không hợp lệ gần "' + src.slice(p, p + 14) + '"'); } t.push(m[1]); p = TOK.lastIndex; }
    return (CACHE[src] = t);
  }
  function ev3(expr, lookup) {
    var refs = [];
    if (expr == null || expr === '') return { value: null, refs: refs };
    if (typeof expr !== 'string') return { value: expr, refs: refs };
    var toks = tokenize(expr), i = 0;
    function peek() { return toks[i]; } function next() { return toks[i++]; }
    function expect(x) { if (toks[i] !== x) throw new Error('Thiếu "' + x + '" trong: ' + expr); i++; }
    function N(v) { return v === true ? 1 : v === false ? 0 : v; }
    var FN = {
      abs: function (a) { return a == null ? null : Math.abs(N(a)); }, round: function (a, d) { if (a == null) return null; var p = Math.pow(10, d || 0); return Math.round(N(a) * p) / p; },
      max: function () { var a = [].filter.call(arguments, function (x) { return x != null; }).map(N); return a.length ? Math.max.apply(null, a) : null; },
      min: function () { var a = [].filter.call(arguments, function (x) { return x != null; }).map(N); return a.length ? Math.min.apply(null, a) : null; },
      nz: function (a) { return a == null || a === '' ? 0 : a; }, pos: function (a) { return a == null ? null : Math.max(N(a), 0); },
      ratio: function (a, b) { return a == null || b == null || !N(b) ? null : N(a) / N(b); }, pct: function (a, b) { return a == null || b == null || !N(b) ? null : N(a) / N(b) * 100; },
      sum: function () { return [].reduce.call(arguments, function (s, x) { return s + (x == null ? 0 : N(x)); }, 0); }, 'if': function (c, a, b) { return c ? a : b; },
      has: null
    };
    function primary() {
      var t = next();
      if (t == null) throw new Error('Biểu thức thiếu toán hạng: ' + expr);
      if (t === '(') { var v = cond(); expect(')'); return v; }
      if (t === '[') { var arr = []; if (peek() !== ']') { arr.push(cond()); while (peek() === ',') { next(); arr.push(cond()); } } expect(']'); return arr; }
      if (t === '-') { var u = primary(); return u == null ? null : -N(u); }
      if (t === '+') return primary();
      if (t === '!') { var w = primary(); return !w; }
      if (/^\d/.test(t)) return parseFloat(t);
      if (/^['"]/.test(t)) return t.slice(1, -1).replace(/\\(.)/g, '$1');
      if (t === 'true') return true; if (t === 'false') return false; if (t === 'null') return null;
      if (t === 'has' && peek() === '(') { next(); var nm = next(); expect(')'); var hv = lookup(nm); refs.push({ name: nm, value: hv }); return hv != null; }
      if (FN[t] && peek() === '(') { next(); var args = []; if (peek() !== ')') { args.push(cond()); while (peek() === ',') { next(); args.push(cond()); } } expect(')'); return FN[t].apply(null, args); }
      if (/^[A-Za-z_À-ỹ]/.test(t)) { var x = lookup(t); refs.push({ name: t, value: x }); return x === undefined ? null : x; }
      throw new Error('Biểu thức không hợp lệ: ' + expr);
    }
    function mul() { var v = primary(); while (peek() === '*' || peek() === '/' || peek() === '%') { var o = next(), w = primary(); if (v == null || w == null) { v = null; continue; } v = o === '*' ? N(v) * N(w) : o === '/' ? (N(w) ? N(v) / N(w) : null) : N(v) % N(w); } return v; }
    function add() { var v = mul(); while (peek() === '+' || peek() === '-') { var o = next(), w = mul(); if (v == null || w == null) { v = null; continue; } v = o === '+' ? N(v) + N(w) : N(v) - N(w); } return v; }
    function cmp() {
      var v = add();
      while (['<', '>', '<=', '>=', '==', '!=', 'in'].indexOf(peek()) >= 0) {
        var o = next(), w = add();
        if (o === 'in') { v = Array.isArray(w) && v != null && w.some(function (x) { return x == v; }); continue; }
        if (o === '==' || o === '!=') { var eq = (v == null && w == null) || (v != null && w != null && (typeof v === 'string' || typeof w === 'string' ? String(v) === String(w) : Math.abs(N(v) - N(w)) < 1e-9)); v = o === '==' ? eq : !eq; continue; }
        if (v == null || w == null) { v = false; continue; }
        var a = N(v), b = N(w); v = o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b;
      }
      return v;
    }
    function and() { var v = cmp(); while (peek() === '&&') { next(); var w = cmp(); v = !!v && !!w; } return v; }
    function or() { var v = and(); while (peek() === '||') { next(); var w = and(); v = !!v || !!w; } return v; }
    function coal() { var v = or(); while (peek() === '??') { next(); var w = or(); v = v == null ? w : v; } return v; }
    function cond() { var c = coal(); if (peek() === '?') { next(); var a = cond(); expect(':'); var b = cond(); return c ? a : b; } return c; }
    var out = cond();
    if (i < toks.length) throw new Error('Thừa "' + toks[i] + '" trong: ' + expr);
    return { value: out, refs: refs };
  }
  function parses(expr) { try { ev3(expr, function () { return 0; }); return true; } catch (e) { return false; } }

  /* ================= Chuẩn hóa rules3 ================= */
  /** "131" | "25+26" | "124 (gộp …)" | "CXM: …" | "Không có dòng riêng: lấy TK 6421 trên F01" → {expr:'bs.131', note, cxm} */
  function parseCode(s, prefix, isKq) {
    if (s == null) return null;
    s = String(s).trim(); if (!s) return null;
    var note = '', cxm = /CXM/.test(s);
    var tk = s.match(/TK\s*(\d{3,6})/);
    var m = s.match(/^(\d{1,3}[a-z]?(?:\s*[+\-]\s*\d{1,3}[a-z]?)*)/i);
    if (m) {
      note = s.slice(m[1].length).trim().replace(/^[(,;:\s]+|[)\s]+$/g, '');
      var ex = m[1].replace(/\s+/g, '').replace(/(\d{1,3}[a-z]?)/gi, function (cd) { var c = cd.toLowerCase(); var w = prefix === 'bs' ? 3 : 2; while (c.replace(/[a-z]$/, '').length < w) c = '0' + c; return prefix + '.' + c; });
      return { expr: ex, note: note, cxm: cxm, raw: s };
    }
    if (tk) { var credit = /^[3457]/.test(tk[1]); return { expr: 'tk.' + tk[1] + (isKq ? (/^[57]/.test(tk[1]) ? '.psCo' : '.psNo') : (credit ? '.ckCo' : '.ckNo')), note: s, cxm: cxm, raw: s, fromTk: true }; }
    return { expr: null, note: s, cxm: true, raw: s, na: !cxm };
  }
  /* ================= Điều chỉnh nghiệp vụ của app (áp lên rules3, hiển thị ở "Tiêu chí & căn cứ") =================
   * Quyết định sau kiểm thử độc lập 18/10/2026: tránh cảnh báo giả ở năm "sạch"; số học đúng cho kiểm tra phụ. */
  var KHAU_TRU = '(gtgt.ct25_nam + nz(gtgt.ct22_dau_nam) - nz(gtgt.ct43_cuoi_nam) - nz(gtgt.ct42_nam))';
  var NOP_SO = '(nz(cdtk.tk33311.ps_no) - ' + KHAU_TRU + ')';
  var NOP_TK = '(nz(cdtk.tk33311.dc_dau) - nz(cdtk.tk33311.dn_dau) + gtgt.ct40_nam - gtgt.ct40_cuoi_nam)';
  var APP_PATCHES = [
    { id: 'R02-c', text: 'Số nộp NSNN suy ra từ sổ = PS Nợ 33311 − phần thuế đầu vào đã bù trừ trong năm (Σ[25] + [22] kỳ đầu năm − [43] kỳ cuối năm − Σ[42] đề nghị hoàn). Không cảnh báo khi phép tính ra âm (sổ không hạch toán bù trừ qua 33311).',
      apply: function (c) { (c.kiemTraPhu || []).forEach(function (d) { if (d.id !== 'R02-c') return; d.expr = NOP_SO + ' >= 0 && abs(' + NOP_SO + ' - ' + NOP_TK + ') > cfg.tol_thue_cuon'; d.dienGiai = 'Số nộp NSNN suy ra từ sổ (PS Nợ 33311 − thuế đầu vào đã bù trừ {khauTru} = {nopSo}) khác số phải nộp đến hạn trong năm (dư đầu + Σ[40] − [40] kỳ cuối = {nopTK}) {cl} đồng. Cần đối chiếu sổ thuế trên eTax.'; }); } },
    { id: 'R23-c', text: 'Không cảnh báo chỉ vì "có phải thu khách hàng". Mức Thấp khi số ngày thu tiền bình quân > 90 ngày (dư lâu), hoặc phải thu tăng ≥ 25% so với đầu năm và nhanh hơn mức tăng doanh thu ≥ 10 điểm %; R23-a/R23-b giữ nguyên. Có số dư nhưng không thỏa điều kiện nào → Không.',
      apply: function (c) { c.appKhongMacDinhThap = true; (c.dieuKien || []).forEach(function (d) { if (d.id !== 'R23-c') return; d.expr = 'SL1 > cfg.nguong_bo_qua && (365 * ratio(SL1, kqkd.dt_thuan.nam * (1 + cfg.thue_suat_gtgt_bq)) > 90 || (ratio(SL1 - bcdkt.phai_thu_kh_nh.dau, bcdkt.phai_thu_kh_nh.dau) >= 0.25 && ratio(SL1 - bcdkt.phai_thu_kh_nh.dau, bcdkt.phai_thu_kh_nh.dau) - (ratio(kqkd.dt_thuan.nam - kqkd.dt_thuan.truoc, kqkd.dt_thuan.truoc) ?? 0) >= 0.1))'; d.dienGiai = 'Phải thu KH {SL1} ({dso} ngày DT; đầu năm {dauNam}, tăng {tangPct}; DT tăng {tangDT}) — dư lâu hoặc tăng nhanh hơn doanh thu. Chuẩn bị biên bản đối chiếu công nợ, tuổi nợ.'; }); } },
    { id: 'R28-b', text: 'Tỷ lệ BHXH, BHYT, BHTN / lương < 15% hạ thành mức "Thông tin": hiển thị kèm diễn giải, không tính điểm, không gắn cờ — vì lương đóng bảo hiểm có thể khác lương thực trả (phụ cấp, thu nhập không đóng BH).',
      apply: function (c) { (c.dieuKien || []).forEach(function (d) { if (d.id !== 'R28-b') return; d.muc = 'Thông tin'; d.dienGiai = 'Tỷ lệ BHXH, BHYT, BHTN / lương = {tyLeBH}. Lương đóng bảo hiểm có thể khác lương thực trả (phụ cấp, khoản không đóng BH) nên đây chỉ là thông tin để đối chiếu danh sách đóng BHXH với bảng lương — không tính điểm.'; }); } },
    { id: 'R17-a', text: 'Diễn giải chỉ nêu khoản thực có phát sinh (bỏ vế bằng 0).', apply: function (c) { (c.dieuKien || []).forEach(function (d) { if (d.id === 'R17-a') d.dienGiai = 'B4 = 0 nhưng trong năm có {coKhoan}. Tiền phạt vi phạm hành chính và tiền chậm nộp không được trừ, phải đưa vào B4.'; }); } },
    { id: 'R09', text: 'SL2 lấy số hoàn nhập tay (quyết định hoàn); chưa nhập thì dùng Σ[42] thuế GTGT đề nghị hoàn trên tờ khai.',
      apply: function (c) { c.appInfo = [{ id: 'R09-i', expr: '(hoan.gtgt_nam ?? -1) < 0 && nz(gtgt.ct42_nam) > 0', dienGiai: 'Chưa nhập số thuế được hoàn theo quyết định hoàn — đang dùng Σ[42] đề nghị hoàn {ct42}. Nhập số theo quyết định ở Bước 2 → Thông tin bổ sung nếu khác.' }]; if (c.sl2) { c.sl2.expr = 'hoan.gtgt_nam ?? nz(gtgt.ct42_nam)'; c.sl2.label = 'Thuế GTGT được hoàn trong kỳ (nhập tay; chưa nhập → Σ[42] đề nghị hoàn)'; } } }
  ];
  function applyPatches(raw) {
    var out = clone(raw); out.criteria = (out.criteria || []).map(function (c) { APP_PATCHES.forEach(function (p) { if (p.id.split('-')[0] === c.id) p.apply(c); }); return c; });
    return out;
  }
  function normalize(raw, base) {
    raw = applyPatches(raw);
    var regimeLabel = {};
    (raw.regimes || []).forEach(function (r) { regimeLabel[r.id] = r.ten || r.id; });
    var sem = { bcdkt: {}, kqkd: {}, lctt: {}, lctt_gt: {}, tk: {} };
    var addSem = function (part, list, prefix, isKq) {
      (list || []).forEach(function (x) {
        var key = String(x.field || '').split('|')[0].trim().replace(/^(bcdkt|kqkd|lctt)\./, '').replace(/\.(cuoi|dau|nam|truoc)$/, '');
        if (!key) return;
        var o = { key: key, label: x.ten || key, nhan: x.nhan || '', byRegime: {} };
        Object.keys(x.maSo || {}).forEach(function (rg) { o.byRegime[rg] = parseCode(x.maSo[rg], prefix, isKq); });
        sem[part][key] = o;
      });
    };
    var mp = raw.mapping || {};
    addSem('bcdkt', mp.bcdkt, 'bs');
    addSem('kqkd', (mp.kqkd || {}).chiTieu, 'kq', true);
    addSem('lctt', (mp.lctt || {}).trucTiep, 'cf');
    addSem('lctt_gt', (mp.lctt || {}).gianTiep, 'cf');
    // ánh xạ khóa mapping mặc định của app (m.xxx) → trường chuẩn rules3 (để màn chỉ số, nhãn mã số dùng chung)
    var ALIAS = { phaiThuKH: 'bcdkt:phai_thu_kh_nh', traTruocNguoiBan: 'bcdkt:tra_truoc_nb_nh', phaiThuKhac: 'bcdkt:phai_thu_khac_nh', hangTonKho: 'bcdkt:htk', thueGtgtKhauTru: 'bcdkt:thue_gtgt_kt', tongTaiSan: 'bcdkt:tong_ts', tien: 'bcdkt:tien', phaiTraNguoiBan: 'bcdkt:phai_tra_nb_nh', nguoiMuaTraTruocNH: 'bcdkt:nguoi_mua_tt_nh', phaiTraNLD: 'bcdkt:phai_tra_nld', quyKHCN: 'bcdkt:quy_khcn', vonChuSoHuu: 'bcdkt:vcsh', taiSanDoDang: 'bcdkt:ts_dd_dh', dtBanHang: 'kqkd:dt_ban_hang', giamTruDT: 'kqkd:giam_tru_dt', dtThuan: 'kqkd:dt_thuan', giaVon: 'kqkd:gia_von', lnGop: 'kqkd:ln_gop', dtTaiChinh: 'kqkd:dt_tai_chinh', cpLaiVay: 'kqkd:cp_lai_vay', cpTaiChinh: 'kqkd:cp_tai_chinh', cpBanHangQL: 'kqkd:cp_qlkd', thuNhapKhac: 'kqkd:tn_khac', chiPhiKhac: 'kqkd:cp_khac', lnTruocThue: 'kqkd:ln_truoc_thue', cfThuBanHang: 'lctt:thu_ban_hang', cfChiNCC: 'lctt:chi_ncc', cfChiNLD: 'lctt:chi_nld', cfThuKhac: 'lctt:thu_khac_kd', cfChiKhac: 'lctt:chi_khac_kd', cfMuaTSCD: 'lctt:chi_mua_tscd', cfChoVay: 'lctt:chi_cho_vay', cfThuLai: 'lctt:thu_lai_co_tuc' };
    var mapping = clone((base && base.mapping) || {});
    Object.keys(ALIAS).forEach(function (k) {
      var p = ALIAS[k].split(':'), s = sem[p[0]][p[1]]; if (!s) return;
      var o = { label: s.label };
      Object.keys(RG2R3).forEach(function (rg) { var c = s.byRegime[RG2R3[rg]]; if (c === undefined) return; o[rg] = c && c.expr ? c.expr : null; });
      mapping[k] = Object.assign({}, mapping[k] || {}, o);
    });
    // bảng mã số theo chế độ cho màn Số liệu tổng hợp
    var codes = {};
    Object.keys(RG2R3).forEach(function (rg) {
      var r3 = RG2R3[rg], lists = { bs: [], kq: [], cf: [] }, labels = { bs: {}, kq: {}, cf: {} };
      [['bcdkt', 'bs'], ['kqkd', 'kq'], ['lctt', 'cf']].forEach(function (pp) {
        Object.keys(sem[pp[0]]).forEach(function (k) { var c = sem[pp[0]][k].byRegime[r3]; if (!c || !c.expr) return; (c.expr.match(/\b(?:bs|kq|cf)\.(\w+)/g) || []).forEach(function (x) { var cd = x.split('.')[1]; if (lists[pp[1]].indexOf(cd) < 0) { lists[pp[1]].push(cd); labels[pp[1]][cd] = sem[pp[0]][k].label; } }); });
      });
      codes[rg] = lists; codes[rg].labels = labels;
    });
    var legal = {}; (raw.legalBasis || []).forEach(function (l) { legal[l.id] = l; });
    var cfg = (raw.config || {}).cfg || {}, profiles = (raw.config || {}).profiles || {}, sev = (raw.config || {}).severityModel || {};
    var weights = { R01: 1.5, R02: 1.5, R03: 1.5, R07: 1.5, R10: 1.5 };
    if (sev.trongSo && typeof sev.trongSo === 'object') weights = sev.trongSo;
    var crit = (raw.criteria || []).map(function (c) {
      var levels = (c.dieuKien || []).map(function (d) { return { level: lv(d.muc), when: d.expr, id: d.id, text: d.dienGiai || '' }; });
      var prof = c.nguong || profiles[c.profile] || null;
      if (!levels.length && prof) levels = [{ level: 'cao', when: '(r ≥ ' + prof.cao_rel + ' và |CL| ≥ ' + E.fmtNum(prof.tb_abs) + ') hoặc (|CL| ≥ ' + E.fmtNum(prof.cao_abs) + ' và r ≥ ' + prof.tb_rel + ')' }, { level: 'tb', when: 'r ≥ ' + prof.tb_rel + ' hoặc |CL| ≥ ' + E.fmtNum(prof.cao_abs) }, { level: 'thap', when: '|CL| > max(' + E.fmtNum(prof.tol_abs) + '; ' + prof.tol_rel + ' × base)' }];
      var xl = c.xuLyCQT || {};
      return {
        id: c.id, name: c.ten, group: c.nhom || '', type: c.loai === 'doi_chieu' ? 'compare' : (c.id === 'R39' ? 'manual' : 'value'), moTa: c.moTa || '',
        sl1: c.sl1 ? { label: c.sl1.label, expr: c.sl1.expr, nguon: c.sl1.nguon } : null, sl2: c.sl2 ? { label: c.sl2.label, expr: c.sl2.expr, nguon: c.sl2.nguon } : null,
        cl: c.loai === 'doi_chieu' ? { label: 'SL1 − SL2', expr: 'SL1 - SL2' } : null, value: c.loai !== 'doi_chieu' && c.sl1 ? { label: c.sl1.label, expr: c.sl1.expr } : null,
        levels: levels, profile: prof, profileId: c.profile || null,
        docs: R39.MERGE(c.id, c.hoSo, 'hoSoBS'), causes: R39.MERGE(c.id, c.nguyenNhan, 'nguyenNhanBS'), pts: R39.ANALYSIS[c.id] || null, guide: R39.GUIDE[c.id] || null, giaiTrinh: (c.mauGiaiTrinh || []).join('\n'),
        xuLy: [].concat(xl.ruiRo || [], xl.xuLy || []).join(' '), ruiRoCQT: xl.ruiRo || [], xuLyCQT: xl.xuLy || [],
        basis: (c.canCu || []).map(function (id) { var l = legal[id]; return l ? l.vb + (l.dieu ? ' — ' + l.dieu : '') : id; }), basisIds: c.canCu || [],
        verify: c.nhan || '', ghiChu: c.ghiChuMau || '', weight: weights[c.id] || 1, r3: c
      };
    });
    var inds = (raw.extraIndicators || []).map(function (x) { return { id: x.id, name: x.ten, expr: x.congThuc, unit: '', group: '', note: x.doc || '', nguong: x.nguong || '', soSanh: x.soSanh || '', verify: x.nhan || '', r3: x }; });
    var rawMax = crit.reduce(function (s2, c) { return s2 + 10 * (c.weight || 1); }, 0) || 1;
    var nb = function (x) { return Math.round(x / rawMax * 1000) / 10; };
    var bands = [{ min: nb(60), raw: 60, label: 'Rủi ro cao' }, { min: nb(25), raw: 25, label: 'Rủi ro trung bình' }, { min: 0, raw: 0, label: 'Rủi ro thấp' }];
    return {
      dialect: 'r3', raw: raw, meta: { version: (raw.meta || {}).phienBan || '3', title: (raw.meta || {}).ten || '', luuY: (raw.meta || {}).luuY || [] },
      levels: [{ id: 'cao', label: 'Cao', weight: (sev.diem || {})['Cao'] || 10 }, { id: 'tb', label: 'Trung bình', weight: (sev.diem || {})['Trung bình'] || 5 }, { id: 'thap', label: 'Thấp', weight: (sev.diem || {})['Thấp'] || 1 }, { id: 'khong', label: 'Không', weight: 0 }],
      scoring: { mode: 'points', bands: bands, note: sev.diemTong || '', minEvaluated: 8, rawMax: rawMax },
      defaults: Object.assign({}, (base || {}).defaults, { tol: 1000, levelConvention: (sev.buoc || []).join(' · ') }),
      regimes: (raw.regimes || []).map(function (r) { var id = Object.keys(RG2R3).filter(function (k) { return RG2R3[k] === r.id; })[0] || r.id; return { id: id, label: r.ten, r3: r }; }),
      mapping: mapping, sem: sem, codes: codes, cfg: cfg, profiles: profiles, sev: sev, legal: legal, legalList: raw.legalBasis || [],
      conversion: raw.mapping && raw.mapping.chuyenDoiTT200_TT99 ? convTable(raw.mapping.chuyenDoiTT200_TT99) : {},
      appPatches: APP_PATCHES.map(function (p) { return { id: p.id, text: p.text }; }),
      criteria: crit, indicators: inds, templateNotes: raw.templateNotes || [], uncertain: raw.uncertain || [], taiKhoanTT99: raw.taiKhoanThayDoiTT99 || null
    };
  }
  /** Bảng chuyển đổi TT200 → TT99: chỉ lấy dòng mã đơn "136 …" → "135" */
  function convTable(cv) {
    var out = { bs: {}, kq: {}, cf: {}, tk: {} };
    [['B01', 'bs'], ['B02', 'kq'], ['B03', 'cf']].forEach(function (p) {
      (cv[p[0]] || []).forEach(function (row) {
        var a = String(row.TT200 || '').match(/^(\d{2,3})\b(?!\s*-)/), b = String(row.TT99 || '').match(/^(\d{2,3})\b(?!\s*-)/);
        if (a && b && !/hoặc/.test(row.TT99)) out[p[1]][a[1]] = b[1];
      });
    });
    return out;
  }

  /* ================= Trường chuẩn (semantic) ================= */
  var CD = { dn_dau: 'dkNo', dc_dau: 'dkCo', ps_no: 'psNo', ps_co: 'psCo', dn_cuoi: 'ckNo', dc_cuoi: 'ckCo' };
  var AUDIT_TXT = { '': 'Không kiểm toán', khong: 'Không kiểm toán', chap_nhan: 'Chấp nhận toàn phần', ngoai_tru: 'Ngoại trừ', tu_choi: 'Từ chối', trai_nguoc: 'Trái ngược' };
  function yn(v) { return v === true || v === 'co' || v === 1 || v === '1' ? true : v === false || v === 'khong' || v === 0 || v === '0' ? false : null; }
  function makeSem(f, prevF, rules, extra, base) {
    var r3 = RG2R3[f.regime] || f.regime, cache = {}, naHits = [];
    var lk = base || R.makeLookup(f, prevF, R.getRules === undefined ? rules : rules);
    function semField(ff, part, key, when, lookupBase) {
      var s = rules.sem[part] && rules.sem[part][key];
      if (!s) return undefined;
      var rg = RG2R3[ff.regime] || ff.regime, c = s.byRegime[rg];
      if (c === undefined && rg === 'TT99') c = s.byRegime.TT200;
      if (c == null || !c.expr) { naHits.push(part + '.' + key); return null; }
      var ex = c.expr;
      if (when === 'start') ex = ex.replace(/\b(bs|kq|cf)\./g, '$10.').replace(/\.ckNo\b/g, '.dkNo').replace(/\.ckCo\b/g, '.dkCo');
      if (c.fromTk && when === 'start' && part !== 'bcdkt') return null;
      var srcPart = part === 'bcdkt' ? 'bctc.bcdkt' : part === 'kqkd' ? (c.fromTk ? 'bctc.cdtk' : 'bctc.kqkd') : 'bctc.lctt';
      if (!ff.has[srcPart]) return null;
      if (part === 'lctt' && ff.bctc && ff.bctc.lcttMethod === 'GT') return null;
      if (part === 'lctt_gt' && !(ff.bctc && ff.bctc.lcttMethod === 'GT')) return null;
      return R.evaluate(ex, lookupBase).value;
    }
    function cdtk(ff, lookupBase, acc, fld) {
      if (!ff.has['bctc.cdtk']) return null;
      var pool = {}; Object.keys(ff.tk || {}).forEach(function (a) { pool[a] = 1; }); Object.keys(ff.overrides || {}).forEach(function (k) { var m = k.match(/^tk\.(\d+)\./); if (m) pool[m[1]] = 1; });
      var exists = Object.keys(pool).some(function (a) { return a === acc || a.indexOf(acc) === 0 || acc.indexOf(a) === 0 && a.length >= 3; });
      if (!exists) return null;
      if (fld === 'du_cuoi') return (lookupBase('tk.' + acc + '.ckNo') || 0) - (lookupBase('tk.' + acc + '.ckCo') || 0);
      if (!CD[fld]) return null;
      return lookupBase('tk.' + acc + '.' + CD[fld]);
    }
    var prevBase = prevF ? R.makeLookup(prevF, null, rules) : null;
    function look(name) {
      if (extra && Object.prototype.hasOwnProperty.call(extra, name)) return extra[name];
      if (name in cache) return cache[name];
      var v = resolve(name);
      cache[name] = v; return v;
    }
    function gtgt(ff, nm) {
      if (nm === 'giam_thue_nam') return ff.has.gtgt && ff.gtgtSum ? ff.gtgtSum.giam_thue || 0 : null;
      var m = nm.match(/^ct(\w+?)_(nam|dau_nam|cuoi_nam)$/); if (!m) return undefined;
      if (!ff.has.gtgt) return null;
      var ov = ff.overrides['gtgt.' + nm]; if (ov && ov.value != null && ov.value !== '') return +ov.value;
      var k = 'ct' + m[1];
      if (m[2] === 'nam') { if (ff.gtgtSum && k in ff.gtgtSum) return /^ct(22|41|43)$/.test(k) && ff.overrides['gtgt.' + k] ? +ff.overrides['gtgt.' + k].value : ff.gtgtSum[k]; return lk === null ? null : (ff.v['gtgt.' + k] != null ? ff.v['gtgt.' + k] : 0); }
      var d = m[2] === 'dau_nam' ? ff.gtgtFirst : ff.gtgtLast;
      if (!d) { var ovk = ff.overrides['gtgt.' + k]; return ovk && ovk.value != null ? +ovk.value : (ff.v['gtgt.' + k] != null ? ff.v['gtgt.' + k] : null); }
      return isNum(+d[k]) ? +d[k] : 0;
    }
    function tndnF(ff, key) {
      if (!ff || !ff.has.tndn) return null;
      if (key === 'thue_suat') { var ts = ff.v['tndn.C7_thueSuat'] != null ? ff.v['tndn.C7_thueSuat'] : ff.v['tndn.thueSuat']; return ts == null || ts === 0 ? null : ts; }
      var ov = ff.overrides['tndn.' + key]; if (ov && ov.value != null && ov.value !== '') return +ov.value;
      return ff.v['tndn.' + key] != null ? ff.v['tndn.' + key] : 0;
    }
    function resolve(name) {
      var ov = f.overrides && f.overrides[name]; if (ov && ov.value != null && ov.value !== '') return isFinite(+ov.value) ? +ov.value : ov.value;
      var m;
      if ((m = name.match(/^cfg\.(\w+)$/))) {
        var cu = (f.inputs.cfg || {})[m[1]]; if (cu != null && cu !== '') return isFinite(+cu) ? +cu : cu;
        var cv = rules.cfg[m[1]]; if (cv == null) return null;
        if (typeof cv === 'string' && /[.(]/.test(cv) && parses(cv)) return ev3(cv, look).value;
        return cv;
      }
      if ((m = name.match(/^gtgt\.(\w+)$/))) { var g = gtgt(f, m[1]); return g === undefined ? null : g; }
      if ((m = name.match(/^tndn\.(\w+)$/))) return tndnF(f, m[1]);
      if ((m = name.match(/^tndn_truoc\.(\w+)$/))) return prevF ? tndnF(prevF, m[1]) : null;
      if ((m = name.match(/^pl031a\.ct(\d{2})$/))) { if (!f.has.tndn) return null; var o2 = f.overrides['tndn.pl' + m[1]]; return o2 && o2.value != null && o2.value !== '' ? +o2.value : (f.v['tndn.pl' + m[1]] != null ? f.v['tndn.pl' + m[1]] : 0); }
      if ((m = name.match(/^bcdkt\.(\w+)\.(cuoi|dau)$/))) { var b = semField(f, 'bcdkt', m[1], m[2] === 'dau' ? 'start' : 'end', lk); return b === undefined ? null : b; }
      if ((m = name.match(/^kqkd\.(\w+)\.(nam|truoc)$/))) { var q = semField(f, 'kqkd', m[1], m[2] === 'truoc' ? 'start' : 'end', lk); return q === undefined ? null : q; }
      if ((m = name.match(/^lctt\.(\w+?)_gt\.(nam|truoc)$/))) { var g2 = semField(f, 'lctt_gt', m[1] + '_gt', m[2] === 'truoc' ? 'start' : 'end', lk); if (g2 === undefined) g2 = semField(f, 'lctt_gt', m[1], m[2] === 'truoc' ? 'start' : 'end', lk); return g2 === undefined ? null : g2; }
      if ((m = name.match(/^lctt\.(\w+)\.(nam|truoc)$/))) { var c2 = semField(f, 'lctt', m[1], m[2] === 'truoc' ? 'start' : 'end', lk); return c2 === undefined ? null : c2; }
      if ((m = name.match(/^cdtk\.tk(\d+)\.(\w+)$/))) return cdtk(f, lk, m[1], m[2]);
      if ((m = name.match(/^raw\.\w+\.bcdkt\.ms(\w+?)_(cuoi|dau)$/))) return lk((m[2] === 'dau' ? 'bs0.' : 'bs.') + ('000' + m[1]).slice(-3));
      if (name === 'meta.che_do') return r3;
      if (name === 'meta.nam') return f.year;
      if (name === 'meta.y_kien_kiem_toan') return AUDIT_TXT[f.audit || ''] || 'Không kiểm toán';
      if (name === 'meta.da_kiem_toan') return !!(f.audit && f.audit !== 'khong');
      if (name === 'flag.co_gdlk') return yn(f.inputs.coGdlk) === true;
      if (name === 'flag.bat_buoc_kiem_toan') return yn(f.inputs.batBuocKiemToan) === true;
      if (name === 'flag.co_ngoai_te') {
        var u = yn(f.inputs.coNgoaiTe); if (u != null) return u;
        var def = null; rules.criteria.some(function (c) { var fd = c.r3 && c.r3.flagDef; if (fd && fd['flag.co_ngoai_te']) { def = fd['flag.co_ngoai_te']; return true; } return false; });
        return def ? !!ev3(def, look).value : false;
      }
      if (name === 'hoan.gtgt_nam') return num(f.inputs.hoanThue);
      if (name === 'tien_cham_nop.nam') { var tc = num(f.inputs.tienChamNop); return tc != null ? tc : (f.chamNopNam || 0); }
      if (name === 'chi_tien_mat_tren_5tr') return num(f.inputs.chiTienMat5tr);
      if (name === 'lo_con_duoc_chuyen') return num(f.inputs.loConDuocChuyen);
      if (name === 'von_dieu_le_dang_ky') return num(f.inputs.vonDieuLe);
      if ((m = name.match(/^chuan_nganh\.(\w+)$/))) { var bb = (extra && extra.__bench) || {}; return bb[m[1]] && bb[m[1]].value != null ? +bb[m[1]].value : null; }
      if ((m = name.match(/^ind\.(EI\d+)$/))) { var iv = indValue(m[1], f, prevF, rules, look); return iv; }
      // tên trường của app (bs., kq., tk., gtgt.ctNN…)
      var v = lk(name); return v === undefined ? null : v;
    }
    look.naHits = naHits; look.r3 = r3;
    return look;
  }
  function num(v) { if (v == null || v === '') return null; var x = +v; return isFinite(x) ? x : null; }

  /* ================= Chỉ số EI ================= */
  var EI = {
    EI01: [{ e: 'ratio(kqkd.ln_gop.nam, kqkd.dt_thuan.nam)', u: '%' }],
    EI02: [{ e: 'ratio(kqkd.ln_thuan_kd.nam, kqkd.dt_thuan.nam)', u: '%', w: 'v < 0', c: 'v < 0 && nz(lossYearsKD) >= 2' }],
    EI03: [{ e: 'ratio(kqkd.ln_truoc_thue.nam, kqkd.dt_thuan.nam)', u: '%', w: 'v < 0.01' }],
    EI04: [{ e: 'ratio(tndn.E1, kqkd.dt_thuan.nam)', u: '%', w: 'chuan_nganh.EI04 != null && v < 0.5 * chuan_nganh.EI04' }],
    EI05: [{ e: 'ratio(tndn.E1, tndn.A1)', u: '%', w: 'tndn.thue_suat != null && tndn.A1 > 0 && abs(v - tndn.thue_suat/100) > 0.02 && nz(tndn.B1) + nz(tndn.B8) + nz(tndn.C2) + nz(tndn.C3) + nz(tndn.C10) == 0' }],
    EI06: [{ e: 'ratio(gtgt.ct40_nam, gtgt.ct34_nam)', u: '%', l: 'VAT phải nộp / DT' }, { e: 'ratio(gtgt.ct35_nam - gtgt.ct25_nam, gtgt.ct34_nam)', u: '%', l: 'Tỷ lệ giá trị gia tăng', w: 'v < 0' }],
    EI07: [{ e: 'ratio(bcdkt.htk.cuoi, kqkd.dt_thuan.nam)', u: '%', l: 'HTK / DT thuần' }, { e: 'ratio(kqkd.gia_von.nam, (bcdkt.htk.dau + bcdkt.htk.cuoi) / 2)', u: 'vòng', l: 'Vòng quay HTK' }, { e: '365 / ratio(kqkd.gia_von.nam, (bcdkt.htk.dau + bcdkt.htk.cuoi) / 2)', u: 'ngày', l: 'Số ngày tồn kho' }, { e: 'ratio(bcdkt.htk.cuoi - bcdkt.htk.dau, abs(bcdkt.htk.dau))', u: '%', l: 'Biến động HTK', w: '(v > 0.5 && ratio(kqkd.dt_thuan.nam - kqkd.dt_thuan.truoc, abs(kqkd.dt_thuan.truoc)) < 0.1) || v < -0.4' }],
    EI08: [{ e: 'max(nz(lossYears), nz(lossYearsKD))', u: 'năm', w: 'v >= 2', lossNote: true }],
    EI09: [{ e: 'ratio((kqkd.cp_lai_vay.nam ?? 0) != 0 ? kqkd.cp_lai_vay.nam : abs(nz(lctt.lai_vay_da_tra.nam)), kqkd.ln_thuan_kd.nam + ((kqkd.cp_lai_vay.nam ?? 0) != 0 ? kqkd.cp_lai_vay.nam : abs(nz(lctt.lai_vay_da_tra.nam))) - nz(kqkd.dt_tai_chinh.nam) + nz(cdtk.tk214.ps_co))', u: '%', w: 'flag.co_gdlk && v > 0.3' }],
    EI10: [{ e: 'ratio(kqkd.dt_thuan.nam - kqkd.dt_thuan.truoc, abs(kqkd.dt_thuan.truoc))', u: '%', l: 'Δ DT thuần' }, { e: 'ratio(tndn.E1 - tndn_truoc.E1, abs(tndn_truoc.E1))', u: '%', l: 'Δ thuế TNDN', w: 'v <= -0.2 && ratio(kqkd.dt_thuan.nam - kqkd.dt_thuan.truoc, abs(kqkd.dt_thuan.truoc)) >= 0.1' }],
    EI11: [{ e: 'ratio(cdtk.tk111.dn_cuoi, bcdkt.tong_ts.cuoi)', u: '%', l: 'Tiền mặt / tổng TS', w: '(v >= 0.05 || cdtk.tk111.dn_cuoi >= 1000000000) && (nz(bcdkt.vay_nh.cuoi) + nz(bcdkt.vay_dh.cuoi)) > 0' }, { e: 'cdtk.tk111.dn_cuoi', u: 'đ', l: 'Tồn quỹ cuối năm' }],
    EI12: [{ e: 'ratio(nz(bcdkt.vay_nh.cuoi) + nz(bcdkt.vay_dh.cuoi), bcdkt.vcsh.cuoi)', u: 'lần', l: 'Vay / VCSH', w: 'v > 3' }, { e: 'ratio(bcdkt.no_phai_tra.cuoi, bcdkt.tong_ts.cuoi)', u: '%', l: 'Nợ phải trả / tổng TS' }],
    EI13: [{ e: 'flag.co_gdlk ? 1 : 0', u: 'có/không' }],
    EI14: [{ e: 'ratio(kqkd.giam_tru_dt.nam, kqkd.dt_ban_hang.nam)', u: '%', w: 'v >= 0.05' }],
    EI15: [{ e: 'ratio(kqkd.cp_qlkd.nam, kqkd.dt_thuan.nam)', u: '%', w: 'ratio(kqkd.cp_qlkd.truoc, kqkd.dt_thuan.truoc) > 0 && v > 1.3 * ratio(kqkd.cp_qlkd.truoc, kqkd.dt_thuan.truoc)' }],
    EI16: [{ e: 'ratio(kqkd.tn_khac.nam, kqkd.ln_truoc_thue.nam)', u: '%', w: 'v >= 0.5' }],
    EI17: [{ e: '365 * ratio(bcdkt.phai_thu_kh_nh.cuoi, kqkd.dt_thuan.nam * (1 + cfg.thue_suat_gtgt_bq))', u: 'ngày', w: 'v > 120' }],
    EI18: [{ e: 'ratio(cdtk.tk111.ps_co, cdtk.tk111.ps_co + cdtk.tk112.ps_co)', u: '%', w: 'v >= 0.1' }],
    EI19: [{ e: 'ratio(tndn.E1 - tndn.G2, tndn.E1)', u: '%', w: 'v > 0.2' }],
    EI20: [{ e: '(bcdkt.lnst_cpp.cuoi - bcdkt.lnst_cpp.dau) - kqkd.lnst.nam', u: 'đ', w: 'abs(v) > 1000000' }],
    EI21: [{ e: 'ratio(nz(cdtk.tk3383.ps_co) + nz(cdtk.tk3384.ps_co) + nz(cdtk.tk3386.ps_co), cdtk.tk334.ps_co)', u: '%', w: 'v < 0.15' }],
    EI22: [{ e: 'pl031a.ct22 - kqkd.ln_truoc_thue.nam', u: 'đ', l: 'A1 − LN trước thuế BCTC', w: 'abs(v) > 1000' }, { e: 'pl031a.ct04 - kqkd.dt_ban_hang.nam', u: 'đ', l: '[04] − DT ms01', w: 'abs(v) > 1000' }],
    EI23: [{ e: NOP_SO + ' >= 0 ? ' + NOP_SO + ' - ' + NOP_TK + ' : null', u: 'đ', w: 'abs(v) > 100000' }],
    EI24: []
  };
  function indDefs(ind) {
    if (EI[ind.id]) return EI[ind.id];
    var parts = String(ind.expr || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    return parts.filter(parses).map(function (e) { return { e: e, u: /\//.test(e) ? '%' : 'đ' }; });
  }
  var indBusy = {};
  function indValue(id, f, prevF, rules, look) {
    var ind = (rules.indicators || []).filter(function (x) { return x.id === id; })[0]; if (!ind) return null;
    var defs = indDefs(ind); if (!defs.length) return null;
    var k = id + f.year; if (indBusy[k]) return null; indBusy[k] = 1;
    try { return ev3(defs[0].e, look).value; } catch (e) { return null; } finally { delete indBusy[k]; }
  }

  /* ================= Placeholder diễn giải ================= */
  var PH = {
    R02: { dn33311: 'nz(cdtk.tk33311.dn_cuoi)', khauTru: KHAU_TRU, nopSo: NOP_SO, nopTK: NOP_TK, cl: NOP_SO + ' - ' + NOP_TK, du: 'nz(cdtk.tk33311.dc_cuoi) - nz(cdtk.tk33311.dn_cuoi)' },
    R04: { ct26: 'gtgt.ct26_nam', tyLe26: '%ratio(gtgt.ct26_nam, gtgt.ct34_nam)', uoc: 'gtgt.ct24_nam * ratio(gtgt.ct26_nam, gtgt.ct34_nam)' },
    R07: { CLdc: 'SL1 - SL2_dc' },
    R09: { ct42: 'gtgt.ct42_nam' },
    R12: { ps_co632: 'cdtk.tk632.ps_co', gv: 'kqkd.gia_von.nam', cl: 'cdtk.tk632.ps_co - kqkd.gia_von.nam' },
    R13: { tyLe: '%ratio(SL1, pl031a.ct04)', nguong: '%cfg.ty_le_giam_tru_cao', tyLeTruoc: '%ratio(kqkd.giam_tru_dt.truoc, kqkd.dt_ban_hang.truoc)', cl04: 'pl031a.ct04 - kqkd.dt_ban_hang.nam', cl06: 'pl031a.ct06 - kqkd.giam_tru_dt.nam', ct09: 'pl031a.ct09', ct07: 'pl031a.ct07' },
    R14: { tyLeLN: '%ratio(SL1, abs(tndn.A1))', lnThuan: 'kqkd.ln_thuan_kd.nam', thuKhac: 'lctt.thu_khac_kd.nam' },
    R15: { tyLe: '%ratio(SL1, pl031a.ct04)' }, R16: { B2truoc: 'tndn_truoc.B2' },
    R17: { cp811: 'cdtk.tk811.ps_no', chamNop: 'tien_cham_nop.nam', x: 'chi_tien_mat_tren_5tr', coKhoan: function (look) { var a = [], c811 = num(look('cdtk.tk811.ps_no')), cn = num(look('tien_cham_nop.nam')); if (c811 && c811 > 0) a.push('chi phí khác (811) ' + fmtVal(c811)); if (cn && cn > 0) a.push('tiền chậm nộp ' + fmtVal(cn)); return a.join(' và ') || 'chi phí cần xem xét'; } },
    R19: { tyLeLN: '%ratio(SL1, abs(tndn.A1))', B11: 'tndn.B11' }, R20: { x: 'lo_con_duoc_chuyen' },
    R22: { ct05: 'pl031a.ct05', nt: 'nz(cdtk.tk1112.dn_cuoi) + nz(cdtk.tk1122.dn_cuoi)' },
    R23: { dauNam: 'bcdkt.phai_thu_kh_nh.dau', tangPct: '%ratio(SL1 - bcdkt.phai_thu_kh_nh.dau, bcdkt.phai_thu_kh_nh.dau)', tangDT: '%ratio(kqkd.dt_thuan.nam - kqkd.dt_thuan.truoc, kqkd.dt_thuan.truoc)', dso: '#365 * ratio(SL1, kqkd.dt_thuan.nam * (1 + cfg.thue_suat_gtgt_bq))' },
    R24: { tyLeTS: '%ratio(SL1, bcdkt.tong_ts.cuoi)', tyLeVCSH: '%ratio(SL1, bcdkt.vcsh.cuoi)', tangPct: '%ratio(SL1 - bcdkt.phai_thu_khac_nh.dau, abs(bcdkt.phai_thu_khac_nh.dau))' },
    R27: { dau: 'bcdkt.nguoi_mua_tt_nh.dau + nz(bcdkt.nguoi_mua_tt_dh.dau)', boi: '#ratio(SL1, bcdkt.nguoi_mua_tt_nh.dau + nz(bcdkt.nguoi_mua_tt_dh.dau))', tyLeDT: '%ratio(SL1, kqkd.dt_thuan.nam)' },
    R28: { tyLe: '%ratio(SL1, cdtk.tk334.ps_co)', tyLeBH: '%ratio(nz(cdtk.tk3383.ps_co) + nz(cdtk.tk3384.ps_co) + nz(cdtk.tk3386.ps_co), cdtk.tk334.ps_co)' },
    R32: { tang: 'SL1 - SL1_dau' }, R33: { C5: 'tndn.C5', ps356: 'cdtk.tk356.ps_co' },
    R34: { tnk: 'abs(kqkd.tn_khac.nam) + abs(kqkd.dt_tai_chinh.nam)', tangPct: '%ratio(SL1 - lctt.thu_khac_kd.truoc, abs(lctt.thu_khac_kd.truoc))' },
    R35: { tyLeDT: '%ratio(SL1, kqkd.dt_thuan.nam)', tyLeCP: '%ratio(SL1, kqkd.cp_qlkd.nam)', tangPct: '%ratio(SL1 - abs(lctt.chi_khac_kd.truoc), abs(lctt.chi_khac_kd.truoc))', truoc: 'abs(lctt.chi_khac_kd.truoc)' },
    R36: { dttc: 'nz(lctt.thu_lai_co_tuc.nam) + nz(kqkd.dt_tai_chinh.nam)', vay: 'bcdkt.vay_nh.cuoi + nz(bcdkt.vay_dh.cuoi)' }, R37: { dttc: 'kqkd.dt_tai_chinh.nam' },
    R38: { tangNG: '(bcdkt.tscd_hh_nguyen_gia.cuoi - bcdkt.tscd_hh_nguyen_gia.dau) + (bcdkt.ts_dd_dh.cuoi - bcdkt.ts_dd_dh.dau)' }, R39: { yk: 'meta.y_kien_kiem_toan' }
  };
  function fmtPct(v) { return v == null || !isFinite(v) ? '…' : (Math.round(v * 1000) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'; }
  function fmtVal(v) { if (v == null || v === '') return '…'; if (typeof v === 'boolean') return v ? 'có' : 'không'; if (typeof v === 'string') return v; return E.fmtNum(Math.round(v)); }
  function fillR3(tpl, id, vars, look) {
    return String(tpl || '').replace(/\{([^{}]+)\}/g, function (all, k) {
      k = k.trim();
      if (/(^|\.)nam\d?$/.test(k)) { var yv = Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : (function () { try { return look(k); } catch (e) { return null; } })(); return yv == null ? '…' : String(yv); }
      if (Object.prototype.hasOwnProperty.call(vars, k)) { var v = vars[k]; return k === 'r' ? fmtPct(v) : fmtVal(v); }
      var ph = (PH[id] || {})[k];
      if (typeof ph === 'function') { try { return ph(look, vars); } catch (e) { return '…'; } }
      if (ph) { var fmtT = ph[0] === '%' ? 'pct' : ph[0] === '#' ? 'n1' : 'n'; var ex = ph.replace(/^[%#]/, ''); var x = null; try { x = ev3(ex, look).value; } catch (e) { x = null; } return fmtT === 'pct' ? fmtPct(x) : fmtT === 'n1' ? (x == null ? '…' : (Math.round(x * 10) / 10).toLocaleString('vi-VN')) : fmtVal(x); }
      if (/\./.test(k)) { try { return fmtVal(look(k)); } catch (e) { return '…'; } }
      return '…';
    });
  }

  /* ================= Đánh giá tiêu chí ================= */
  function startExpr3(ex) { return String(ex || '').replace(/\.cuoi\b/g, '.dau').replace(/(kqkd|lctt)\.(\w+)\.nam\b/g, '$1.$2.truoc').replace(/\.dn_cuoi\b/g, '.dn_dau').replace(/\.dc_cuoi\b/g, '.dc_dau'); }
  var SRC_OF = { gtgt: 'gtgt', tndn: 'tndn', tndn_truoc: null, pl031a: 'tndn', bcdkt: 'bctc.bcdkt', kqkd: 'bctc.kqkd', lctt: 'bctc.lctt', cdtk: 'bctc.cdtk' };
  function tax(list) { var o = { gtgt: false, tndn: false, khac: false }; (list || []).forEach(function (t) { var s = String(t).toLowerCase(); if (s === 'gtgt') o.gtgt = true; else if (s === 'tndn') o.tndn = true; else o.khac = true; }); return o; }
  function cmp0(r3) { return r3.loai === 'doi_chieu'; }
  function evalCrit3(c, f, prevF, rules, specials, note, bench) {
    var r3 = c.r3, res = { id: c.id, name: c.name, group: c.group, type: c.type, verify: c.verify, xuLy: c.xuLy, ghiChu: c.ghiChu, causes: c.causes, docs: c.docs, basis: c.basis, moTa: c.moTa, pts: c.pts || null, guide: c.guide || null, refs: [], explained: [], flags: { gtgt: false, tndn: false, khac: false }, impact: { gtgt: 0, tndn: 0, total: 0 }, note: note, findings: [], weight: c.weight };
    var vars = { __bench: bench, lossYears: specials.lossYears, lossYearsKD: specials.lossYearsKD, nam: f.year, nam0: f.year - 1, nam1: f.year + 1 };
    var look = makeSem(f, prevF, rules, vars);
    var refs = [];
    var ev = function (ex) { if (ex == null || ex === '') return null; try { var r = ev3(ex, look); refs = refs.concat(r.refs); return r.value; } catch (e) { res.error = (res.error ? res.error + '; ' : '') + e.message; return null; } };
    var t = function (ex) { var v = ev(ex); return !!v; };
    // potential flags
    var pot = []; Object.keys(r3.co || {}).forEach(function (k) { pot = pot.concat(r3.co[k]); }); (r3.dieuKien || []).concat(r3.kiemTraPhu || []).forEach(function (d) { pot = pot.concat(d.co || []); });
    res.potential = tax(pot);
    labels(res, c, f, rules);
    // áp dụng theo chế độ
    if (Array.isArray(r3.apDung) && r3.apDung.indexOf(look.r3) < 0 && r3.apDung.indexOf(f.regime) < 0) { res.status = 'na'; res.level = 'na'; res.text = 'Không áp dụng cho chế độ ' + (R.REGIME_SHORT[f.regime] || f.regime) + ' (mẫu BCTC không có chỉ tiêu này).'; return res; }
    var byRg = function (x) { return x && x.exprTheoCheDo && (x.exprTheoCheDo[look.r3] || x.exprTheoCheDo[f.regime]) || null; };
    var sl1Expr = byRg(r3.sl1) || (c.sl1 && c.sl1.expr), sl2Expr = byRg(r3.sl2) || (c.sl2 && c.sl2.expr);
    if (res.exprs) { res.exprs.sl1 = sl1Expr; res.exprs.sl2 = sl2Expr; if (!cmp0(r3)) res.exprs.value = sl1Expr; }
    var SL1 = ev(sl1Expr), SL2 = c.sl2 ? ev(sl2Expr) : null;
    // Savitax sửa: SL1/SL2 viết dạng nz(nguồn) nên khi CHƯA CÓ hẳn nguồn (không BCTC / quyết toán / LCTT…) vẫn ra 0 và tiêu
    // chí hiện như "không phát sinh". Mọi nguồn số liệu mà SL1, SL2 dùng tới đều chưa có → "Thiếu dữ liệu" (27/10/2026,
    // soát giữa năm chỉ có tờ khai GTGT: R21, R25, R29, R30, R32, R33, R36–R38 ra 0 giả). Có ít nhất một nguồn thì giữ như cũ.
    // meta.y_kien_kiem_toan lấy từ BCTC (trừ khi nhân viên tự chọn). "Không áp dụng" theo chế độ chỉ có nghĩa khi ĐÃ có BCTC.
    var nguonSl = {}; refs.forEach(function (x) { var t = x.name.split('.')[0]; var p = t === 'meta' ? (f.inputs.auditOpinion ? null : 'bctc') : SRC_OF[t]; if (p) nguonSl[p] = 1; });
    var dsNguon = Object.keys(nguonSl);
    if (dsNguon.length && !dsNguon.some(function (s) { return f.has[s]; }) && !(look.naHits.length && f.has.bctc)) {
      res.status = 'missing'; res.level = 'missing';
      res.missingDocs = dsNguon.map(function (x) { return R.REQ_LABEL[x] || x; });
      res.text = 'Thiếu dữ liệu: ' + res.missingDocs.join('; ') + '.';
      res.refs = uniqRefs(refs, f, rules); return res;
    }
    var cmp = r3.loai === 'doi_chieu';
    // thiếu dữ liệu / không áp dụng
    var needs = {}; refs.forEach(function (x) { var p = x.name.split('.')[0]; if (SRC_OF[p]) needs[SRC_OF[p]] = 1; });
    var missingSrc = Object.keys(needs).filter(function (s) { return !f.has[s]; });
    if (SL1 == null || (cmp && SL2 == null)) {
      if (look.naHits.length && !missingSrc.length) { res.status = 'na'; res.level = 'na'; res.text = 'Không áp dụng: mẫu BCTC theo ' + (R.REGIME_SHORT[f.regime] || f.regime) + ' không có chỉ tiêu (' + look.naHits.join(', ') + ').'; return res; }
      res.status = 'missing'; res.level = 'missing';
      var lacking = missingSrc.length ? missingSrc : Object.keys(needs);
      if (needs['bctc.lctt'] && f.has['bctc.lctt'] && f.bctc && f.bctc.lcttMethod === 'GT') { res.status = 'na'; res.level = 'na'; res.text = 'Không áp dụng: LCTT lập theo phương pháp gián tiếp.'; return res; }
      res.missingDocs = lacking.map(function (x) { return R.REQ_LABEL[x] || x; });
      res.text = 'Thiếu dữ liệu: ' + (res.missingDocs.join('; ') || 'không xác định được số liệu') + '.';
      res.refs = uniqRefs(refs, f, rules); return res;
    }
    var CL = cmp && isNum(SL1) && isNum(SL2) ? SL1 - SL2 : null;
    vars.SL1 = SL1; vars.SL2 = SL2; vars.CL = CL; vars.absCL = CL == null ? null : Math.abs(CL);
    if (r3.sl2DieuChinh) vars.SL2_dc = ev(r3.sl2DieuChinh.expr);
    if (isNum(SL1) && c.sl1 && c.sl1.expr) { try { vars.SL1_dau = ev3(startExpr3(c.sl1.expr), look).value; } catch (e) { vars.SL1_dau = null; } }
    [r3.sl1 && r3.sl1.phu, r3.phu].forEach(function (ph) { if (!ph || typeof ph !== 'object') return; Object.keys(ph).forEach(function (k) { var ex = ph[k]; if (typeof ex === 'string' && parses(ex)) { try { vars[k] = ev3(ex, look).value; } catch (e) { /* */ } } }); });
    if (r3.sl1Phu && r3.sl1Phu.expr) vars.SL1_phu = ev(r3.sl1Phu.expr);
    // Savitax sửa: số liệu bắt buộc phải có khi điều kiện "khi" đúng (vd R20 có chuyển lỗ thì phải có số lỗ còn được chuyển).
    // Chưa có thì là "Thiếu dữ liệu", KHÔNG coi là 0 rồi chấm mức (xem lib/ruiro/quyTac.js).
    var thieuCo = (r3.canCo || []).filter(function (k) { return t(k.khi) && look(k.bien) == null; });
    if (thieuCo.length) {
      res.status = 'missing'; res.level = 'missing'; res.sl1 = SL1; res.sl2 = SL2; res.cl = CL;
      res.missingDocs = thieuCo.map(function (k) { return k.nhan || k.bien; });
      res.text = 'Thiếu dữ liệu: ' + res.missingDocs.join('; ') + '.';
      res.refs = uniqRefs(refs, f, rules); return res;
    }
    var prof = c.profile, base = Math.max(Math.abs(isNum(SL1) ? SL1 : 0), Math.abs(isNum(SL2) ? SL2 : 0));
    vars.base = base; vars.r = CL != null && base ? Math.abs(CL) / base : null;
    var level = 'khong', satisfied = [], textParts = [], flagList = [], impactKeys = [];
    if (r3.dieuKien && r3.dieuKien.length) {
      res.infos = [];
      r3.dieuKien.forEach(function (d) { if (!t(d.expr)) return; if (lv(d.muc) === 'info') { res.infos.push({ id: d.id, text: fillR3(d.dienGiai || '', c.id, vars, look) }); return; } satisfied.push(d); });
      satisfied.forEach(function (d) { var L = lv(d.muc); if (L === 'na') { level = level === 'khong' ? 'na_c' : level; return; } if (ORD[L] > ORD[level === 'na_c' ? 'khong' : level]) level = L; });
      if (level === 'na_c') level = 'khong';
      if (!satisfied.length && !cmp && !r3.appKhongMacDinhThap && isNum(SL1) && Math.abs(SL1) > (num(look('cfg.nguong_bo_qua')) || 1000000)) { level = 'thap'; textParts.push('Có số liệu ' + fmtVal(SL1) + ' — chuẩn bị giải trình bản chất.'); }
      satisfied.sort(function (a, b) { return (ORD[lv(b.muc)] || 0) - (ORD[lv(a.muc)] || 0); }).forEach(function (d) {
        if (d.dienGiai) textParts.push(fillR3(d.dienGiai, c.id, vars, look));
        if (lv(d.muc) !== 'khong' && lv(d.muc) !== 'na') { flagList = flagList.concat(d.co || []); impactKeys.push({ key: d.id, co: d.co || [] }); }
        res.findings.push({ id: d.id, level: lv(d.muc), text: d.dienGiai ? fillR3(d.dienGiai, c.id, vars, look) : '' });
      });
      if (cmp && level !== 'khong' && r3.co) { var sk = CL < 0 ? 'CL<0' : 'CL>0'; if (r3.dienGiai && r3.dienGiai[sk]) textParts.unshift(fillR3(r3.dienGiai[sk], c.id, vars, look)); }
    } else if (cmp && prof) {
      var aCL = Math.abs(CL), r = base ? aCL / base : 0;
      if (aCL <= Math.max(prof.tol_abs || 0, (prof.tol_rel || 0) * base)) level = 'khong';
      else if ((r >= prof.cao_rel && aCL >= prof.tb_abs) || (aCL >= prof.cao_abs && r >= prof.tb_rel)) level = 'cao';
      else if (r >= prof.tb_rel || aCL >= prof.cao_abs) level = 'tb';
      else level = 'thap';
      var key = level === 'khong' ? '0' : CL < 0 ? 'CL<0' : 'CL>0';
      if (level !== 'khong') { flagList = flagList.concat((r3.co || {})[key] || []); impactKeys.push({ key: key, co: (r3.co || {})[key] || [] }); }
      if (r3.dienGiai) textParts.push(fillR3(r3.dienGiai[key] || r3.dienGiai['0'] || '', c.id, vars, look));
    }
    // hạ / nâng mức
    if (r3.haMuc && r3.haMuc.expr && ORD[level] > 0 && t(r3.haMuc.expr)) { var from = level; level = level === 'thap' ? 'thap' : BYORD[ORD[level] - 1]; if (from !== level) { textParts.push('Hạ mức (' + RRLV(from) + ' → ' + RRLV(level) + '): ' + (r3.haMuc.lyDo || '')); res.downgraded = r3.haMuc.lyDo || true; } }
    if (r3.tangMuc && r3.tangMuc.expr && ORD[level] > 0 && ORD[level] < 3 && t(r3.tangMuc.expr)) { var fr = level; level = BYORD[ORD[level] + 1]; textParts.push('Nâng mức (' + RRLV(fr) + ' → ' + RRLV(level) + '): ' + (r3.tangMuc.lyDo || '')); res.upgraded = r3.tangMuc.lyDo || true; }
    // kiểm tra phụ
    (r3.kiemTraPhu || []).forEach(function (d) { if (!t(d.expr)) return; var L = lv(d.muc); if (ORD[L] > ORD[level]) level = L; flagList = flagList.concat(d.co || []); textParts.push(fillR3(d.dienGiai || '', c.id, vars, look)); res.findings.push({ id: d.id, level: L, text: fillR3(d.dienGiai || '', c.id, vars, look), phu: true }); });
    // giải trình DN: khoản đã giải trình được → hạ mức nếu phần còn lại trong dung sai
    var ex = 0; (note.explain || []).forEach(function (a) { var v = num(a.amount); if (v) { res.explained.push({ label: a.label || 'Giải trình của DN', amount: v, manual: true }); ex += v; } });
    if (cmp && ex && prof && CL != null) { var rem = CL - ex; vars.clr = rem; if (Math.abs(rem) <= Math.max(prof.tol_abs || 0, (prof.tol_rel || 0) * base)) { textParts.push('Sau giải trình, chênh lệch còn lại ' + fmtVal(rem) + ' — trong dung sai.'); level = 'khong'; } }
    res.level = level; res.status = level === 'khong' ? 'ok' : 'risk';
    if (res.status === 'risk') {
      res.flags = tax(flagList);
      impactKeys.forEach(function (ik) {
        var e2 = (r3.thueAnhHuong || {})[ik.key]; if (!e2) return;
        var v = num(ev(e2)); if (!v || v <= 0) return; v = Math.round(v);
        var tt = tax(ik.co); if (tt.gtgt) res.impact.gtgt += v; else if (tt.tndn) res.impact.tndn += v;
      });
      res.impact.total = res.impact.gtgt + res.impact.tndn;
    }
    vars.thue = res.impact.total || null;
    // làm lại diễn giải có {thue}
    if (/\{thue\}/.test(JSON.stringify(r3.dienGiai || {}) + JSON.stringify(r3.dieuKien || []))) {
      textParts = textParts.map(function (s) { return s; });
      if (r3.dienGiai && !r3.dieuKien) { var key2 = level === 'khong' ? '0' : CL < 0 ? 'CL<0' : 'CL>0'; textParts[0] = fillR3(r3.dienGiai[key2] || r3.dienGiai['0'] || '', c.id, vars, look); }
      else res.findings.forEach(function (fd, i) { var d = (r3.dieuKien || []).filter(function (x) { return x.id === fd.id; })[0]; if (d && /\{thue\}/.test(d.dienGiai || '')) { var nt = fillR3(d.dienGiai, c.id, vars, look); var j = textParts.indexOf(fd.text); if (j >= 0) textParts[j] = nt; fd.text = nt; } void i; });
    }
    if (!textParts.length) textParts.push(res.status === 'ok' ? (cmp ? 'Khớp trong dung sai.' : (isNum(SL1) && SL1 !== 0 ? 'Số liệu ' + fmtVal(SL1) + ' — không thỏa điều kiện cảnh báo.' : 'Không phát sinh.')) : '');
    (r3.appInfo || []).forEach(function (d) { if (t(d.expr)) { res.infos = res.infos || []; res.infos.push({ id: d.id, text: fillR3(d.dienGiai, c.id, vars, look) }); } });
    (res.infos || []).forEach(function (x) { textParts.push('Thông tin (' + x.id + '): ' + x.text); });
    res.text = textParts.filter(Boolean).join(' ');
    res.giaiTrinhTpl = fillR3(c.giaiTrinh, c.id, Object.assign({}, vars, { CL: CL }), look);
    res.sl1 = SL1; res.sl2 = SL2; res.cl = CL; res.clr = vars.clr != null ? vars.clr : CL; res.v = cmp ? CL : SL1; res.base = base; res.pct = vars.r != null ? vars.r * 100 * (CL < 0 ? -1 : 1) : null;
    if (!cmp) { res.refSl1 = isNum(SL1) ? SL1 : null; res.refSl2 = isNum(SL2) ? SL2 : (isNum(vars.SL1_dau) ? vars.SL1_dau : null); res.refCl = res.refSl1 != null && res.refSl2 != null ? res.refSl1 - res.refSl2 : null; res.refSl2Label = c.sl2 ? c.sl2.label : (isNum(vars.SL1_dau) ? 'Đầu năm / năm trước (tham chiếu)' : ''); if (!isNum(SL2)) res.sl2 = res.refSl2; }
    if (r3.sl2DieuChinh) { res.x = vars.SL2_dc; res.extraLabel = r3.sl2DieuChinh.label; }
    res.alt = (ALT[c.id] || []).map(function (x) { var v = null; try { v = ev3(x.expr, look).value; } catch (e) { v = null; } return { label: x.label, value: v }; }).filter(function (x) { return x.value != null; });
    res.refs = uniqRefs(refs, f, rules);
    return res;
  }
  /** Số liệu tham khảo hiển thị kèm (phương án khác, số hiệu theo mẫu CQT cũ) */
  var ALT = {
    R01: [{ label: 'Chênh lệch nếu dùng DT gộp mã số 01 (tham số cơ sở DT của R01 = "gộp"): Σ[34] − (ms01 + B2 − B9)', expr: 'gtgt.ct34_nam - (kqkd.dt_ban_hang.nam + tndn.B2 - tndn.B9)' }, { label: 'Theo chiều công thức ô E12 mẫu CQT (SL2 − SL1)', expr: 'SL2 - SL1' }],
    R07: [{ label: 'SL2 điều chỉnh (loại giảm trừ DT ghi qua 131)', expr: 'SL2_dc' }, { label: 'Chênh lệch sau điều chỉnh SL1 − SL2_dc', expr: 'SL1 - SL2_dc' }],
    R09: [{ label: 'PS Có 133 − Σ[25] (ghi giảm 133 không qua khấu trừ)', expr: 'cdtk.tk133.ps_co - gtgt.ct25_nam' }],
    R13: [{ label: 'KQKD mã số 02 (đối chiếu; mẫu CQT ghi "[03]" = PL 03-1A [06])', expr: 'kqkd.giam_tru_dt.nam' }],
    R14: [{ label: 'KQKD mã số 31 (mẫu 2018–2020 ghi "[16]" = [19])', expr: 'kqkd.tn_khac.nam' }],
    R19: [{ label: 'B11 (mẫu CQT ghi B11; theo TT80 dùng B12)', expr: 'tndn.B11' }],
    R21: [{ label: 'C12 (mẫu CQT ghi C12; rules3 dùng C10 + C14 + C15)', expr: 'tndn.C12' }],
    R22: [{ label: 'B11 (mẫu CQT ghi B11)', expr: 'tndn.B11' }]
  };
  function RRLV(l) { return { cao: 'Cao', tb: 'Trung bình', thap: 'Thấp', khong: 'Không' }[l] || l; }
  function uniqRefs(refs, f, rules) {
    var seen = {}, out = [];
    refs.forEach(function (r) { if (seen[r.name] || /^(SL1|SL2|CL|SL2_dc|SL1_dau|base|r|nam|nam0|nam1|lossYears)$/.test(r.name)) return; seen[r.name] = 1; out.push({ name: r.name, value: r.value, src: srcOf(f, r.name, rules) }); });
    return out;
  }
  function srcOf(f, name, rules) {
    var m, rg = RG2R3[f.regime] || f.regime;
    var semDesc = function (part, key, when, prefix) {
      var s = rules.sem[part] && rules.sem[part][key]; if (!s) return null;
      var c = s.byRegime[rg]; if (c === undefined && rg === 'TT99') c = s.byRegime.TT200;
      if (!c || !c.expr) return { kind: 'Không áp dụng', text: s.label + ' — mẫu ' + (R.REGIME_SHORT[f.regime] || f.regime) + ' không có chỉ tiêu' + (c && c.note ? ' (' + c.note + ')' : '') };
      var codes = c.expr.match(/\b(?:bs|kq|cf|tk)\.\w+/g) || [];
      var first = codes[0] ? (when === 'start' ? codes[0].replace(/^(bs|kq|cf)\./, '$10.') : codes[0]) : null;
      var under = first ? (f.src[first] || {}) : {};
      return { kind: 'BCTC', text: s.label + ' — ' + (c.fromTk ? c.raw : 'mã số ' + c.expr.replace(/\b(bs|kq|cf)\./g, '')) + ' (' + prefix + ', ' + (R.REGIME_SHORT[f.regime] || f.regime) + ')' + (c.note ? ' · ' + c.note : '') + (c.cxm ? ' [CXM]' : ''), file: under.file, sheet: under.sheet, cell: under.cell };
    };
    if ((m = name.match(/^bcdkt\.(\w+)\.(cuoi|dau)$/))) return semDesc('bcdkt', m[1], m[2] === 'dau' ? 'start' : 'end', m[2] === 'dau' ? 'đầu năm' : 'cuối năm') || {};
    if ((m = name.match(/^kqkd\.(\w+)\.(nam|truoc)$/))) return semDesc('kqkd', m[1], m[2] === 'truoc' ? 'start' : 'end', m[2] === 'truoc' ? 'năm trước' : 'năm nay') || {};
    if ((m = name.match(/^lctt\.(\w+)\.(nam|truoc)$/))) return semDesc(/_gt$/.test(m[1]) ? 'lctt_gt' : 'lctt', m[1], m[2] === 'truoc' ? 'start' : 'end', m[2] === 'truoc' ? 'năm trước' : 'năm nay') || {};
    if ((m = name.match(/^cdtk\.tk(\d+)\.(\w+)$/))) { var key = 'tk.' + m[1] + '.' + (CD[m[2]] || 'ckNo'); var s2 = f.src[key] || {}; return { kind: 'BCTC', text: 'BCĐTK TK ' + m[1] + ' — ' + ({ dn_dau: 'dư Nợ đầu kỳ', dc_dau: 'dư Có đầu kỳ', ps_no: 'phát sinh Nợ', ps_co: 'phát sinh Có', dn_cuoi: 'dư Nợ cuối kỳ', dc_cuoi: 'dư Có cuối kỳ', du_cuoi: 'dư cuối (Nợ − Có)' }[m[2]] || m[2]), file: s2.file, sheet: s2.sheet, cell: s2.cell }; }
    if ((m = name.match(/^gtgt\.ct(\w+?)_(nam|dau_nam|cuoi_nam)$/))) { var s3 = f.src['gtgt.ct' + m[1]] || {}; return { kind: 'GTGT', text: '[' + m[1] + '] ' + (m[2] === 'nam' ? 'tổng các kỳ trong năm (bản cuối mỗi kỳ)' : m[2] === 'dau_nam' ? 'kỳ đầu năm' : 'kỳ cuối năm'), files: s3.files }; }
    if ((m = name.match(/^pl031a\.ct(\d+)$/))) return f.src['tndn.pl' + m[1]] || { kind: 'TNDN', text: 'PL 03-1A [' + m[1] + ']' };
    if ((m = name.match(/^tndn\.(\w+)$/))) return f.src['tndn.' + m[1]] || { kind: 'TNDN', text: '03/TNDN [' + m[1] + ']' };
    if (/^tndn_truoc\./.test(name)) return { kind: 'Năm trước', text: '03/TNDN năm ' + (f.year - 1) };
    if (/^cfg\./.test(name)) return { kind: 'Tham số', text: 'Cấu hình bộ quy tắc: ' + name.slice(4) };
    if (/^(flag|meta)\./.test(name)) return { kind: 'Thông tin', text: 'Thông tin bổ sung / nhận diện: ' + name };
    if (/^(hoan|tien_cham_nop|chi_tien_mat|lo_con|von_dieu)/.test(name)) return { kind: 'Nhập tay', text: 'Thông tin bổ sung nhập tay (bước 2 → Thông tin bổ sung)' };
    if (/^ind\./.test(name)) return { kind: 'Chỉ số', text: 'Chỉ số ' + name.slice(4) };
    return R._sourceOfApp(f, name, rules);
  }
  function labels(res, c, f, rules) {
    var rg = RG2R3[f.regime] || f.regime;
    var nguon = function (x) { if (!x || !x.nguon) return ''; var s = x.nguon[rg] || x.nguon[f.regime] || x.nguon.chung || ''; return s ? s + ' — ' + (R.REGIME_SHORT[f.regime] || f.regime) : ''; };
    res.sl1Label = c.sl1 ? c.sl1.label : ''; res.sl2Label = c.sl2 ? c.sl2.label : ''; res.clLabel = c.cl ? c.cl.label : '';
    res.valueLabel = c.value ? c.value.label : ''; res.extraLabel = ''; res.sl1Code = nguon(c.sl1); res.sl2Code = nguon(c.sl2); res.codeLabel = c.type !== 'compare' ? nguon(c.sl1) : ''; res.regime = f.regime;
    res.exprs = { sl1: c.sl1 && c.sl1.expr, sl2: c.sl2 && c.sl2.expr, cl: c.cl && c.cl.expr, value: c.value && c.value.expr, levels: c.levels };
  }
  function score3(results, rules) {
    var w = { cao: 10, tb: 5, thap: 1 }; (rules.levels || []).forEach(function (l) { if (w[l.id] != null) w[l.id] = l.weight; });
    var c = { cao: 0, tb: 0, thap: 0, khong: 0, na: 0, missing: 0 }, sum = 0, evaluated = 0, imp = { gtgt: 0, tndn: 0, total: 0 };
    results.forEach(function (r) { c[r.level] = (c[r.level] || 0) + 1; if (r.status === 'risk' || r.status === 'ok') { evaluated++; sum += (w[r.level] || 0) * (r.weight || 1); } imp.gtgt += r.impact.gtgt; imp.tndn += r.impact.tndn; imp.total += r.impact.total; });
    var minE = (rules.scoring || {}).minEvaluated || 8;
    var rawMax = (rules.scoring || {}).rawMax || 100;
    var s = evaluated >= minE ? Math.round(sum / rawMax * 1000) / 10 : null, band = null;
    ((rules.scoring || {}).bands || []).some(function (b) { if (s != null && s >= b.min) { band = b.label; return true; } return false; });
    return { score: s, raw: evaluated >= minE ? Math.round(sum * 10) / 10 : null, rawMax: rawMax, band: band || (s == null ? 'Chưa đủ dữ liệu (cần ≥ ' + minE + ' tiêu chí)' : null), mode: 'points', max: 100, counts: c, red: c.cao, amber: c.tb + c.thap, green: c.khong, evaluated: evaluated, total: results.length, impact: imp };
  }
  /** EI24: đối chiếu thuyết minh BCTC (đã nạp) với BCĐKT/KQKD — trả về danh sách {label, tm, bc, cl} */
  var TM_CHECKS = [
    { l: 'Tiền và tương đương tiền', sec: /^1\.\s*Tiền và tương đương tiền/i, f: 'bcdkt.tien.cuoi' },
    { l: 'Phải thu của khách hàng', row: /^a\)\s*Phải thu (của )?khách hàng/i, f: 'bcdkt.phai_thu_kh_nh.cuoi + nz(bcdkt.phai_thu_kh_dh.cuoi)' },
    { l: 'Trả trước cho người bán', row: /^b\)\s*Trả trước cho người bán/i, f: 'bcdkt.tra_truoc_nb_nh.cuoi' },
    { l: 'Hàng tồn kho', sec: /^4\.\s*Hàng tồn kho/i, stop: /^Trong đó/i, f: 'bcdkt.htk.cuoi' },
    { l: 'Phải trả người bán', row: /^a\)\s*Phải trả người bán/i, f: 'bcdkt.phai_tra_nb_nh.cuoi' },
    { l: 'Người mua trả tiền trước', row: /^b\)\s*Người mua trả tiền trước/i, f: 'bcdkt.nguoi_mua_tt_nh.cuoi + nz(bcdkt.nguoi_mua_tt_dh.cuoi)' },
    { l: 'Vay ngắn hạn', row: /^a\)\s*Vay ngắn hạn/i, f: 'bcdkt.vay_nh.cuoi' },
    { l: 'Các khoản giảm trừ doanh thu', sec: /^2\.\s*Các khoản giảm trừ doanh thu/i, f: 'kqkd.giam_tru_dt.nam' },
    { l: 'Giá vốn hàng bán', sec: /^3\.\s*Giá vốn hàng bán/i, f: 'kqkd.gia_von.nam' },
    { l: 'Doanh thu hoạt động tài chính', sec: /^4\.\s*Doanh thu hoạt động tài chính/i, f: 'kqkd.dt_tai_chinh.nam' },
    { l: 'Chi phí tài chính', sec: /^5\.\s*Chi phí tài chính/i, f: 'kqkd.cp_tai_chinh.nam' },
    { l: 'Thu nhập khác', sec: /^7\.\s*Thu nhập khác/i, f: 'kqkd.tn_khac.nam' },
    { l: 'Chi phí khác', sec: /^8\.\s*Chi phí khác/i, f: 'kqkd.cp_khac.nam' }
  ];
  function tmCompare(f, look) {
    var sheets = f.tm && (f.tm.tm || f.tm.tables) || null; if (!sheets || !sheets.length) return null;
    var rows = []; sheets.forEach(function (sh) { (sh.rows || []).forEach(function (r) { rows.push(r); }); });
    var n = function (v) { return typeof v === 'number' && isFinite(v) ? v : 0; };
    var out = [];
    TM_CHECKS.forEach(function (ck) {
      var tm = null;
      if (ck.row) { var r = rows.filter(function (x) { return ck.row.test(String(x.label || '').trim()); })[0]; if (r) tm = n((r.values || [])[0]); }
      else { var i = -1; rows.some(function (x, k) { if (ck.sec.test(String(x.label || '').trim())) { i = k; return true; } return false; });
        if (i >= 0) { tm = 0; var any = false; for (var k = i + 1; k < rows.length; k++) { var lb = String(rows[k].label || '').trim(); if (/^(\d+\.|[IVX]+\.)/.test(lb) || (ck.stop && ck.stop.test(lb))) break; if (!/^[-+]/.test(lb)) continue; var v = n((rows[k].values || [])[0]); if (/ghi giảm|hoàn nhập/i.test(lb)) v = -Math.abs(v); tm += v; any = any || v !== 0; } if (!any && !n((rows[i].values || [])[0])) tm = 0; } }
      if (tm == null) return;
      var bc = null; try { bc = ev3(ck.f, look).value; } catch (e) { bc = null; }
      if (bc == null) return;
      out.push({ label: ck.l, tm: tm, bc: bc, cl: tm - bc });
    });
    return out;
  }
  function indicators3(rules, f, prevF, specials, bench) {
    var look = makeSem(f, prevF, rules, { lossYears: specials.lossYears, lossYearsKD: specials.lossYearsKD, __bench: bench });
    return (rules.indicators || []).map(function (ind) {
      var defs = indDefs(ind), parts = [];
      defs.forEach(function (d) {
        var v = null; try { v = ev3(d.e, look).value; } catch (e) { v = null; }
        if (typeof v === 'boolean') v = v ? 1 : 0;
        var dv = v == null ? null : d.u === '%' ? v * 100 : v;
        var warn = false; if (d.w && v != null) { try { warn = !!ev3(d.w, makeSem(f, prevF, rules, { v: v, lossYears: specials.lossYears, lossYearsKD: specials.lossYearsKD, __bench: bench })).value; } catch (e) { warn = false; } }
        var lvl = warn ? 'tb' : null;
        if (d.c && v != null) { try { if (ev3(d.c, makeSem(f, prevF, rules, { v: v, lossYears: specials.lossYears, lossYearsKD: specials.lossYearsKD, __bench: bench })).value) lvl = 'cao'; } catch (e) { /* */ } }
        if (d.lossNote && v != null) { if (v >= 3) lvl = 'cao'; var lt = specials.lossYears || 0, lk = specials.lossYearsKD || 0; d.lbl = v ? (lk >= lt ? 'Lỗ thuần HĐKD ' + lk + ' năm liên tiếp' + (lt ? '; lỗ trước thuế ' + lt + ' năm' : '') : 'Lỗ trước thuế ' + lt + ' năm liên tiếp' + (lk ? '; lỗ thuần HĐKD ' + lk + ' năm' : '')) : 'Không lỗ'; }
        parts.push({ label: d.lossNote ? d.lbl : (d.l || ''), unit: d.u, value: dv, raw: v, warn: warn, level: lvl, expr: d.e });
      });
      if (ind.id === 'EI24') {
        var cmpL = tmCompare(f, look);
        if (cmpL) { var bad = cmpL.filter(function (x) { return Math.abs(x.cl) >= 1000; }); parts = [{ label: 'Số khoản lệch / đã đối chiếu', unit: 'khoản', value: bad.length, raw: bad.length, warn: bad.length > 0, level: bad.length ? 'thap' : null, expr: 'thuyết minh ↔ BCTC' }].concat(bad.map(function (x) { return { label: x.label + ': TM ' + E.fmtNum(Math.round(x.tm)) + ' ≠ BCTC ' + E.fmtNum(Math.round(x.bc)) + ' (lệch ' + E.fmtNum(Math.round(x.cl)) + ')', unit: 'đ', value: x.cl, raw: x.cl, warn: true }; })); parts[0].checked = cmpL.length; parts[0].label = 'Số khoản lệch (đã đối chiếu ' + cmpL.length + ' khoản)'; }
      }
      var p0 = parts[0] || {};
      var r = { id: ind.id, name: ind.name, unit: p0.unit || '', value: p0.value != null ? p0.value : null, warn: parts.some(function (p) { return p.warn; }), level: parts.some(function (p) { return p.level === 'cao'; }) ? 'cao' : (parts[0] && parts[0].level === 'thap') ? 'thap' : parts.some(function (p) { return p.warn; }) ? 'tb' : null, parts: parts, note: ind.note, nguong: ind.nguong, group: ind.verify ? '[' + ind.verify + ']' : '', expr: p0.expr || ind.expr, manual: !parts.length };
      var b = bench[ind.id]; if (b && (b.min != null && b.min !== '' || b.max != null && b.max !== '')) { r.bench = b; r.outOfBench = r.value != null && ((b.min !== '' && b.min != null && r.value < +b.min) || (b.max !== '' && b.max != null && r.value > +b.max)); }
      return r;
    });
  }
  function lint3(rules) {
    var errs = [];
    var chk = function (where, ex) { if (typeof ex !== 'string' || !ex) return; try { ev3(ex, function () { return 0; }); } catch (e) { errs.push(where + ': ' + e.message); } };
    rules.criteria.forEach(function (c) {
      var r3 = c.r3; chk(c.id + '.sl1', r3.sl1 && r3.sl1.expr); chk(c.id + '.sl2', r3.sl2 && r3.sl2.expr);
      (r3.dieuKien || []).concat(r3.kiemTraPhu || []).forEach(function (d) { chk(c.id + '.' + d.id, d.expr); });
      ['haMuc', 'tangMuc', 'sl2DieuChinh', 'sl1Phu'].forEach(function (k) { if (r3[k]) chk(c.id + '.' + k, r3[k].expr); });
      Object.keys(r3.thueAnhHuong || {}).forEach(function (k) { chk(c.id + '.thueAnhHuong.' + k, r3.thueAnhHuong[k]); });
    });
    Object.keys(EI).forEach(function (k) { EI[k].forEach(function (d) { chk(k, d.e); chk(k + '.warn', d.w); }); });
    return errs;
  }
  /* ================= Công thức bằng lời (tiếng Việt) ================= */
  var CDW = { dn_dau: 'dư Nợ đầu năm', dc_dau: 'dư Có đầu năm', ps_no: 'PS Nợ', ps_co: 'PS Có', dn_cuoi: 'dư Nợ cuối năm', dc_cuoi: 'dư Có cuối năm', du_cuoi: 'số dư cuối năm (Nợ − Có)', ps_no_doi_ung_133: 'PS Nợ đối ứng Có 133' };
  var VARW = { SL1: 'SL1', SL2: 'SL2', CL: 'CL', SL2_dc: 'SL2 điều chỉnh', SL1_dau: 'SL1 đầu năm', v: 'giá trị chỉ số', lossYears: 'số năm lỗ trước thuế liên tiếp', lossYearsKD: 'số năm lỗ thuần HĐKD liên tiếp', 'hoan.gtgt_nam': 'thuế GTGT được hoàn (nhập tay)', 'tien_cham_nop.nam': 'tiền chậm nộp trong năm', chi_tien_mat_tren_5tr: 'chi tiền mặt ≥ 5 triệu (nhập tay)', lo_con_duoc_chuyen: 'lỗ còn được chuyển (nhập tay)', von_dieu_le_dang_ky: 'vốn điều lệ đăng ký', 'meta.che_do': 'chế độ kế toán', 'meta.nam': 'năm', 'meta.y_kien_kiem_toan': 'ý kiến kiểm toán', 'meta.da_kiem_toan': 'đã kiểm toán', 'flag.co_gdlk': 'có giao dịch liên kết', 'flag.bat_buoc_kiem_toan': 'thuộc diện kiểm toán bắt buộc', 'flag.co_ngoai_te': 'có giao dịch ngoại tệ' };
  function wordOf(name, rules) {
    var m, sem = (rules && rules.sem) || {};
    if (VARW[name]) return VARW[name];
    if ((m = name.match(/^gtgt\.ct(\w+?)_(nam|dau_nam|cuoi_nam)$/))) return (m[2] === 'nam' ? 'Σ[' + m[1] + '] tờ khai GTGT cả năm' : '[' + m[1] + '] tờ khai GTGT kỳ ' + (m[2] === 'dau_nam' ? 'đầu năm' : 'cuối năm'));
    if (name === 'gtgt.giam_thue_nam') return 'thuế GTGT được giảm cả năm';
    if ((m = name.match(/^cdtk\.tk(\d+)\.(\w+)$/))) return (CDW[m[2]] || m[2]) + ' TK ' + m[1];
    if ((m = name.match(/^(bcdkt|kqkd|lctt)\.(\w+)\.(cuoi|dau|nam|truoc)$/))) { var se = sem[m[1]] && sem[m[1]][m[2]] || sem.lctt_gt && sem.lctt_gt[m[2]]; return (se ? se.label : m[2].replace(/_/g, ' ')) + ' (' + { cuoi: 'cuối năm', dau: 'đầu năm', nam: 'năm nay', truoc: 'năm trước' }[m[3]] + ')'; }
    if ((m = name.match(/^tndn\.(\w+)$/))) return m[1] === 'thue_suat' ? 'thuế suất TNDN' : '[' + m[1] + '] 03/TNDN';
    if ((m = name.match(/^tndn_truoc\.(\w+)$/))) return '[' + m[1] + '] 03/TNDN năm trước';
    if ((m = name.match(/^pl031a\.ct(\d+)$/))) return '[' + m[1] + '] PL 03-1A';
    if ((m = name.match(/^cfg\.(\w+)$/))) { var cv = rules && rules.cfg ? rules.cfg[m[1]] : null; var nm = { ty_le_tang_manh: 'tỷ lệ tăng mạnh', nguong_bo_qua: 'ngưỡng bỏ qua', thue_suat_gtgt_bq: 'thuế suất GTGT bình quân', thue_suat_tndn: 'thuế suất TNDN', tol_thue_cuon: 'dung sai', ty_le_giam_tru_cao: 'tỷ lệ giảm trừ cao', ty_le_so_du_lon_dt: 'tỷ lệ số dư lớn/DT', ty_le_so_du_lon_ts: 'tỷ lệ số dư lớn/TS', nguong_tien_mat_lon: 'ngưỡng tiền mặt lớn', nguong_tien_mat_thanh_toan: 'ngưỡng thanh toán tiền mặt', r01_co_so_dt: 'cơ sở DT của R01' }[m[1]] || m[1].replace(/_/g, ' '); return nm + (typeof cv === 'number' ? ' (' + (cv < 1 ? (Math.round(cv * 1000) / 10).toLocaleString('vi-VN') + '%' : E.fmtNum(cv)) + ')' : ''); }
    if ((m = name.match(/^chuan_nganh\.(\w+)$/))) return 'chuẩn ngành ' + m[1];
    if ((m = name.match(/^ind\.(\w+)$/))) return 'chỉ số ' + m[1];
    if ((m = name.match(/^(bs0?|kq0?|cf0?)\.(\w+)$/))) return 'mã số ' + m[2] + ' ' + ({ bs: 'BCĐKT cuối năm', bs0: 'BCĐKT đầu năm', kq: 'KQKD năm nay', kq0: 'KQKD năm trước', cf: 'LCTT năm nay', cf0: 'LCTT năm trước' }[m[1]]);
    if ((m = name.match(/^tk\.(\d+)\.(\w+)$/))) return ({ psNo: 'PS Nợ', psCo: 'PS Có', ckNo: 'dư Nợ cuối', ckCo: 'dư Có cuối', dkNo: 'dư Nợ đầu', dkCo: 'dư Có đầu' }[m[2]] || m[2]) + ' TK ' + m[1];
    return name;
  }
  function speak(expr, rules) {
    if (expr == null || expr === '') return '';
    var src = String(expr), store = [];
    var put = function (t) { store.push(t); return '⟦' + (store.length - 1) + '⟧'; };
    src = src.replace(/'[^']*'|"[^"]*"/g, function (q) { return put('“' + q.slice(1, -1) + '”'); });
    src = src.replace(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*(?=\s*\()/g, function (fn) { return '‹' + fn + '›'; });
    src = src.replace(/(^|[^\w‹.])([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)/g, function (all, pre, id) { if (id === 'true' || id === 'false' || id === 'in') return pre + id; return pre + put(wordOf(id, rules)); });
    src = src.replace(/\b\d+(?:\.\d+)?\b/g, function (n) { var x = +n; return put(x >= 1000 ? E.fmtNum(x) : String(n).replace('.', ',')); });
    var wr = function (x) { var t = unwrapS(x); return /\s[-+*\/×÷−]\s|\s(và|hoặc)\s/.test(t.replace(/\([^()]*\)/g, '')) ? '(' + x + ')' : x; };
    var unwrapS = function (t) { for (var k = 0; k < 40 && /\u27e6\d+\u27e7/.test(t); k++) t = t.replace(/\u27e6(\d+)\u27e7/g, function (all, i) { return store[+i]; }); return t; };
    var FNW = { nz: function (a) { return a[0]; }, abs: function (a) { return '|' + a[0] + '|'; }, ratio: function (a) { return wr(a[0]) + ' ÷ ' + wr(a[1]); }, pct: function (a) { return wr(a[0]) + ' ÷ ' + wr(a[1]) + ' × 100%'; }, pos: function (a) { return 'phần dương của (' + a[0] + ')'; }, max: function (a) { return 'lớn nhất(' + a.join('; ') + ')'; }, min: function (a) { return 'nhỏ nhất(' + a.join('; ') + ')'; }, round: function (a) { return 'làm tròn(' + a[0] + ')'; }, sum: function (a) { return a.join(' + '); } };
    for (var guard = 0; guard < 60; guard++) {
      var before = src;
      src = src.replace(/‹(\w+)›\s*\(([^()]*)\)/g, function (all, fn, args) { var a = args.split(',').map(function (x) { return x.trim(); }); return put((FNW[fn] || function (z) { return fn + '(' + z.join('; ') + ')'; })(a)); });
      src = src.replace(/(^|[^›])\(([^()]*)\)/g, function (all, pre, inner) { return pre + put('(' + inner.trim() + ')'); });
      if (src === before) break;
    }
    var unwrap = function (t) { for (var k = 0; k < 40 && /⟦\d+⟧/.test(t); k++) t = t.replace(/⟦(\d+)⟧/g, function (all, i) { return store[+i]; }); return t; };
    var out = unwrap(src);
    out = out.replace(/\(([^()]*?) \? /g, '(nếu $1 ? ');
    out = out.replace(/&&/g, ' và ').replace(/\|\|/g, ' hoặc ').replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/!=/g, '≠').replace(/==/g, '=').replace(/\?\?/g, ' — nếu không có: ').replace(/\s\*\s|\*/g, ' × ').replace(/\s\/\s/g, ' ÷ ').replace(/\s+\?\s+/g, ' thì ').replace(/\s+:\s+/g, ' ngược lại ').replace(/\s+-\s+/g, ' − ').replace(/\s{2,}/g, ' ').replace(/\(\(([^()]*)\)\)/g, '($1)');
    return out.trim();
  }
  function install(api) {
    R = api; E = api._E;
    api.r3 = { speak: speak, normalize: normalize, ev3: ev3, evalCrit3: evalCrit3, score3: score3, indicators3: indicators3, lint3: lint3, makeSem: makeSem, srcOf: srcOf, RG2R3: RG2R3, PH: PH, EI: EI, parseCode: parseCode };
    return api;
  }
  return { install: install };
})()

export default Risk3
