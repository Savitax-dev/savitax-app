// Động cơ phân tích rủi ro thuế 39 tiêu chí — hàm vào Risk.evaluateYear(client, year).
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.
import Engine from './engine.js'
import Risk3 from './risk3.js'
import R39 from './r39.js'
import RULES3 from './quyTac.js'
import RULES3_DEFAULT from './rules3Default.js'
const Risk = (function () {
  'use strict';
  var E = Engine;
  var DEFAULT = RULES3_DEFAULT;
  var RULES = null;

  function n(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function r0(v) { return Math.round(n(v)); }
  function fmt(v) { if (v == null || v === '' || !isFinite(+v)) return '…'; return E.fmtNum(Math.round(+v)); }
  function fmtPct(v, d) { if (v == null || !isFinite(v)) return '…'; return (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toFixed(d == null ? 1 : d).replace('.', ',') + '%'; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  /* ================= Biểu thức ================= */
  var TOKRE = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*|&&|\|\||==|!=|>=|<=|[-+*\/()<>!,?:%])/y;
  var TOKCACHE = {};
  function tokenize(src) {
    if (TOKCACHE[src]) return TOKCACHE[src];
    var toks = [], pos = 0;
    while (pos < src.length) {
      TOKRE.lastIndex = pos; var m = TOKRE.exec(src);
      if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error('Biểu thức không hợp lệ gần "' + src.slice(pos, pos + 12) + '": ' + src); }
      toks.push(m[1]); pos = TOKRE.lastIndex;
    }
    TOKCACHE[src] = toks; return toks;
  }
  /** evaluate(expr, lookup) — lookup(name) → number|boolean|null (null = không có dữ liệu). Trả về {value, missing[], refs[]} */
  function evaluate(expr, lookup) {
    var missing = [], refs = [];
    if (expr == null || expr === '') return { value: null, missing: missing, refs: refs };
    if (typeof expr === 'number' || typeof expr === 'boolean') return { value: expr, missing: missing, refs: refs };
    var toks = tokenize(String(expr)), i = 0;
    function peek() { return toks[i]; }
    function next() { return toks[i++]; }
    function expect(t) { if (toks[i] !== t) throw new Error('Thiếu "' + t + '" trong: ' + expr); i++; }
    function val(x) { return x == null ? 0 : (x === true ? 1 : x === false ? 0 : x); }
    var FN = {
      abs: function (a) { return Math.abs(val(a)); }, round: function (a, d) { var p = Math.pow(10, val(d)); return Math.round(val(a) * p) / p; },
      max: function () { return Math.max.apply(null, [].map.call(arguments, val)); }, min: function () { return Math.min.apply(null, [].map.call(arguments, val)); },
      sum: function () { return [].reduce.call(arguments, function (s, a) { return s + val(a); }, 0); },
      nz: function (a, b) { return a == null ? val(b) : a; },
      pct: function (a, b) { return a == null || b == null || !val(b) ? null : val(a) / val(b) * 100; },
      div: function (a, b) { return a == null || b == null || !val(b) ? null : val(a) / val(b); },
      'if': function (c, a, b) { return c ? a : b; }
    };
    function primary() {
      var t = next();
      if (t == null) throw new Error('Biểu thức thiếu toán hạng: ' + expr);
      if (t === '(') { var v = ternary(); expect(')'); return v; }
      if (t === '-') { var u = primary(); return u == null ? null : -val(u); }
      if (t === '+') return primary();
      if (t === '!') return !primary();
      if (/^\d/.test(t)) return parseFloat(t);
      if (t === 'true') return true; if (t === 'false') return false; if (t === 'null') return null;
      if (t === 'has' && peek() === '(') { next(); var nm = next(); expect(')'); var hv = lookup(nm); refs.push({ name: nm, value: hv }); return hv != null; }
      if (FN[t] && peek() === '(') {
        next(); var args = [];
        if (peek() !== ')') { args.push(ternary()); while (peek() === ',') { next(); args.push(ternary()); } }
        expect(')'); return FN[t].apply(null, args);
      }
      if (/^[A-Za-z_]/.test(t)) { var x = lookup(t); refs.push({ name: t, value: x }); if (x == null) missing.push(t); return x; }
      throw new Error('Biểu thức không hợp lệ: ' + expr);
    }
    function mul() { var v = primary(); while (peek() === '*' || peek() === '/' || peek() === '%') { var o = next(), w = primary(); v = o === '*' ? val(v) * val(w) : o === '/' ? (val(w) ? val(v) / val(w) : 0) : val(v) % val(w); } return v; }
    function add() { var v = mul(); while (peek() === '+' || peek() === '-') { var o = next(), w = mul(); v = o === '+' ? val(v) + val(w) : val(v) - val(w); } return v; }
    function cmp() { var v = add(); while (['<', '>', '<=', '>=', '==', '!='].indexOf(peek()) >= 0) { var o = next(), w = add(), a = val(v), b = val(w); v = o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : o === '>=' ? a >= b : o === '==' ? Math.abs(a - b) < 1e-9 : Math.abs(a - b) >= 1e-9; } return v; }
    function and() { var v = cmp(); while (peek() === '&&') { next(); var w = cmp(); v = v && w; } return v; }
    function or() { var v = and(); while (peek() === '||') { next(); var w = and(); v = v || w; } return v; }
    function ternary() { var c = or(); if (peek() === '?') { next(); var a = ternary(); expect(':'); var b = ternary(); return c ? a : b; } return c; }
    var out = ternary();
    if (i < toks.length) throw new Error('Thừa ký tự "' + toks[i] + '" trong: ' + expr);
    return { value: out, missing: missing, refs: refs };
  }

  /* ================= Quy tắc ================= */
  /** Chuẩn hóa rules3.json (chấp nhận nhiều cách đặt tên trường) */
  function isR3(raw) { return !!(raw && Array.isArray(raw.criteria) && raw.criteria.length && raw.criteria[0].ten && (raw.config || raw.criteria[0].loai)); }
  function normalizeRules(raw) {
    var base = clone(DEFAULT || {});
    if (!raw) return finalize(base);
    if (isR3(raw) && API.r3) return finalize(API.r3.normalize(raw, base));
    var r = clone(raw);
    var out = { meta: r.meta || {}, levels: r.levels || base.levels, scoring: r.scoring || base.scoring, defaults: Object.assign({}, base.defaults, r.defaults || r.thresholds || {}), regimes: r.regimes || base.regimes };
    // mapping: {key:{TT200,TT133a,...}} hoặc [{key, ...}]
    var mp = r.mapping || r.fieldMapping || r.mappings || null;
    if (Array.isArray(mp)) { var o = {}; mp.forEach(function (x) { if (x && (x.key || x.id)) o[x.key || x.id] = x; }); mp = o; }
    out.mapping = Object.assign({}, base.mapping, mp ? normMapping(mp) : {});
    var crit = r.criteria || r.tieuChi || r.rules || base.criteria;
    out.criteria = crit.map(normCriterion);
    // bổ sung từ mặc định những trường thiếu (id trùng)
    var defById = {}; (base.criteria || []).forEach(function (c) { defById[c.id] = c; });
    out.criteria = out.criteria.map(function (c) { var d = defById[c.id]; if (!d || c._complete) return c; ['sl1', 'sl2', 'cl', 'value', 'levels', 'flags', 'text', 'requires', 'docs', 'giaiTrinh', 'causes', 'xuLy', 'basis', 'impact', 'base', 'type'].forEach(function (k) { if (c[k] == null || (Array.isArray(c[k]) && !c[k].length && d[k] && d[k].length)) c[k] = clone(d[k]); }); return c; });
    out.indicators = (r.extraIndicators || r.indicators || base.indicators || []).map(normIndicator);
    out.conversion = r.conversion || r.tt200ToTt99 || r.chuyenDoi || r.conversionTT200toTT99 || base.conversion || {};
    if (Array.isArray(out.conversion)) { var cv = { bs: {}, kq: {}, cf: {}, tk: {} }; out.conversion.forEach(function (x) { var part = x.part || x.bang || (x.tk ? 'tk' : 'bs'); (cv[part] = cv[part] || {})[String(x.from || x.tt200 || x.TT200)] = String(x.to || x.tt99 || x.TT99); }); out.conversion = cv; }
    else if (out.conversion && !out.conversion.bs && !out.conversion.tk && (out.conversion.TT200 || out.conversion.map)) { var mm2 = out.conversion.map || out.conversion.TT200; out.conversion = { bs: mm2.bs || mm2.bcdkt || {}, kq: mm2.kq || mm2.kqkd || {}, cf: mm2.cf || mm2.lctt || {}, tk: mm2.tk || mm2.taiKhoan || {} }; }
    out.codes = r.codes || r.maSo || r.codeLists || {};
    out.raw = raw;
    return finalize(out);
  }
  function normMapping(mp) {
    var o = {};
    Object.keys(mp).forEach(function (k) {
      var x = mp[k]; if (typeof x === 'string') { o[k] = { TT200: x, TT133a: x, TT133b: x }; return; }
      var y = Object.assign({}, x);
      // các tên khác cho chế độ
      ['TT133', 'TT133_B01a', 'TT133-B01a', 'B01a'].forEach(function (a) { if (y[a] != null && y.TT133a == null) y.TT133a = y[a]; });
      ['TT133_B01b', 'TT133-B01b', 'B01b'].forEach(function (a) { if (y[a] != null && y.TT133b == null) y.TT133b = y[a]; });
      if (y.TT133 != null && y.TT133b == null) y.TT133b = y.TT133;
      ['TT99', 'TT99_2025', 'TT99-B01DN', 'moi', 'new'].forEach(function (a) { if (y[a] != null && y.TT99 == null) y.TT99 = y[a]; });
      Object.keys(y).forEach(function (rg) { if (Array.isArray(y[rg])) y[rg] = y[rg].length ? y[rg].map(function (c) { return /^\d+$/.test(String(c)) ? 'bs.' + c : c; }).join('+') : null; else if (typeof y[rg] === 'number' || /^\d{2,3}$/.test(String(y[rg] || ''))) y[rg] = 'bs.' + y[rg]; });
      o[k] = y;
    });
    return o;
  }
  function pickExpr(x) { if (x == null) return null; if (typeof x === 'string' || typeof x === 'number') return { label: '', expr: String(x) }; return { label: x.label || x.ten || x.name || '', expr: x.expr != null ? x.expr : (x.formula || x.bieuThuc || x.cong_thuc || null), note: x.note || '' }; }
  function normCriterion(c) {
    var o = Object.assign({}, c);
    o.id = c.id || c.ma || c.code; o.name = c.name || c.ten || c.title || '';
    o.sl1 = pickExpr(c.sl1 || c.SL1 || c.soLieu1); o.sl2 = pickExpr(c.sl2 || c.SL2 || c.soLieu2);
    o.cl = pickExpr(c.cl || c.chenhLech || c.diff);
    o.value = pickExpr(c.value || c.soLieuDanhGia || c.danhGia);
    o.extra = pickExpr(c.extra);
    if (!o.type) o.type = o.sl1 && o.sl2 ? 'compare' : (o.value ? 'value' : 'manual');
    if (o.type === 'compare' && !o.cl) o.cl = { label: 'SL1 − SL2', expr: 'sl1 - sl2' };
    if (o.type === 'value' && !o.value && o.sl1) { o.value = o.sl1; }
    o.levels = (c.levels || c.mucDo || []).map(function (l) { return { level: normLevel(l.level || l.muc || l.id), when: l.when || l['if'] || l.dieuKien || l.condition }; });
    if (!o.levels.length && c.threshold != null) o.levels = [{ level: normLevel(c.severity || 'tb'), when: 'abs(' + (o.type === 'compare' ? 'cl' : 'v') + ') > ' + c.threshold }];
    var fl = c.flags || c.ruiRo || c.risk || {};
    o.flags = { gtgt: fl.gtgt != null ? fl.gtgt : fl.GTGT, tndn: fl.tndn != null ? fl.tndn : fl.TNDN, khac: fl.khac != null ? fl.khac : fl.other };
    o.text = c.text || c.dienGiai || {}; if (typeof o.text === 'string') o.text = { risk: o.text, ok: '' };
    o.docs = c.docs || c.hoSo || c.hoSoCanChuanBi || [];
    o.giaiTrinh = c.giaiTrinh || c.mauGiaiTrinh || c.explanationTemplate || '';
    o.basis = c.basis || c.canCu || c.legal || [];
    o.causes = c.causes || c.nguyenNhan || [];
    o.xuLy = c.xuLy || c.xuLyCQT || c.action || '';
    o.ghiChu = c.ghiChu || c.note || c.condition || '';
    o.requires = c.requires || [];
    o.verify = c.verify || c.nhan || '';
    o.impact = c.impact || c.anhHuong || {};
    o.autoExplain = c.autoExplain || [];
    o.group = c.group || c.nhom || '';
    { o.docs = R39.MERGE(o.id, o.docs, 'hoSoBS'); o.causes = R39.MERGE(o.id, o.causes, 'nguyenNhanBS'); o.pts = R39.ANALYSIS[o.id] || null; o.guide = R39.GUIDE[o.id] || null; }
    return o;
  }
  function normLevel(l) { var s = String(l || '').toLowerCase(); if (/^(cao|high|do|red)/.test(s)) return 'cao'; if (/^(tb|trung|medium|vang|amber)/.test(s)) return 'tb'; if (/^(thap|thấp|low)/.test(s)) return 'thap'; return s || 'tb'; }
  function normIndicator(x) { return Object.assign({}, x, { id: x.id || x.ma, name: x.name || x.ten, expr: x.expr || x.formula || x.bieuThuc, unit: x.unit || x.donVi || '', warn: x.warn || x.canhBao || null }); }
  function finalize(r) {
    r.levelById = {}; (r.levels || []).forEach(function (l) { r.levelById[normLevel(l.id)] = l; });
    r.criteriaById = {}; r.criteria.forEach(function (c) { r.criteriaById[c.id] = c; });
    return r;
  }
  function setRules(raw) { RULES = normalizeRules(raw); return RULES; }
  function getRules() { if (!RULES) RULES = normalizeRules(RULES3); return RULES; }

  /* ================= Chế độ kế toán ================= */
  /** Nhận diện chế độ kế toán — thứ tự ưu tiên TT99 → TT133 → TT200 (cũ). form: mã mẫu do parser nhận diện; year: năm tài chính */
  function regimeOf(form, year) {
    var f = String(form || '');
    if (/TT99/.test(f)) return 'TT99';
    if (/133-B01b/.test(f)) return 'TT133b';
    if (/133/.test(f)) return 'TT133a';
    if (/200/.test(f)) return 'TT200';
    if (/B01-?DN|^BCTC$/.test(f) && year) return +year >= 2026 ? 'TT99' : 'TT200';
    return null;
  }
  function defaultRegime(year) { return +year >= 2026 ? 'TT99' : 'TT133a'; }
  var REGIME_ORDER = ['TT99', 'TT133a', 'TT133b', 'TT200'];
  var REGIME_LABEL = { TT99: 'TT99 (DN) — TT 99/2025/TT-BTC, từ năm tài chính 2026', TT133a: 'TT133 (DNNVV) — TT 133/2016/TT-BTC, mẫu B01a-DNN', TT133b: 'TT133 (DNNVV) — TT 133/2016/TT-BTC, mẫu B01b-DNN', TT200: 'TT200 (cũ – đến hết 2025) — TT 200/2014/TT-BTC' };
  var REGIME_SHORT = { TT99: 'TT99 (DN)', TT133a: 'TT133 (DNNVV) — B01a', TT133b: 'TT133 (DNNVV) — B01b', TT200: 'TT200 (cũ – đến hết 2025)' };
  /** Chuyển mã số giữa TT200 ↔ TT99 theo rules.conversion (bs/kq/cf/tk). dir: 'fwd' TT200→TT99, 'rev' TT99→TT200 */
  function convertCode(rules, part, code, dir) {
    var cv = (rules.conversion || {})[part] || {};
    if (dir === 'fwd') { var x = cv[code]; return x == null ? code : (Array.isArray(x) ? x[0] : x); }
    var hit = Object.keys(cv).filter(function (k) { var v = cv[k]; return Array.isArray(v) ? v.indexOf(code) >= 0 : v === code; })[0];
    return hit || code;
  }

  /** Biểu thức "đầu kỳ / năm trước" tương ứng: m.→m0., bs.→bs0., kq.→kq0., cf.→cf0., TK dư cuối → dư đầu */
  function startExpr(ex) { return String(ex).replace(/\b(bs|kq|cf|m)\.(?=\w)/g, '$10.').replace(/\.ckNo\b/g, '.dkNo').replace(/\.ckCo\b/g, '.dkCo'); }
  /** Thông tin bổ sung từ XML 01/GTGT: thuế được giảm (PL NQ 142/174/204) và tiền chậm nộp trên 01/KHBS (Mục 3) */
  function gtgtExtras(xml) {
    var o = {}, m;
    if ((m = /<(?:\w+:)?tongCongThueGTGTDuocGiam>\s*(-?[\d.]+)\s*</.exec(xml))) o.giamThue = +m[1];
    var mu = /<(?:\w+:)?Muc_3>([\s\S]*?)<\/(?:\w+:)?Muc_3>/.exec(xml);
    if (mu) { var t = function (n) { var x = new RegExp('<(?:\\w+:)?' + n + '>\\s*([^<]*)<').exec(mu[1]); return x ? x[1].trim() : ''; }; var amt = +t('ct3b') || 0; if (amt) o.chamNop = { soTien: Math.abs(amt), soNgay: +t('ct3a_2') || 0, denNgay: t('ct3a_1') }; }
    return o;
  }
  /* ================= Hồ sơ năm → dữ liệu chuẩn ================= */
  function kieuKyOf(decls, year) { var m = 0, q = 0; decls.forEach(function (d) { if (+d.nam === +year) { if (d.kieuKy === 'M') m++; else q++; } }); return m >= q && m ? 'M' : q ? 'Q' : 'M'; }
  function finalBctcMerged(list, year) {
    var vs = (list || []).filter(function (b) { return +b.nam === +year && b.kind !== 'TMBCTC'; }).sort(function (a, b) { return String(a.loadedAt || a.ngayLap || '').localeCompare(String(b.loadedAt || b.ngayLap || '')) || (+a.soLan || 0) - (+b.soLan || 0); });
    if (!vs.length) return null;
    var out = { form: '', parts: {}, files: {}, bcdkt: { cuoiNam: {}, dauNam: {} }, kqkd: { namNay: {}, namTruoc: {} }, lctt: null, cdtk: {}, trace: {}, labels: { bcdkt: {}, kqkd: {}, lctt: {}, cdtk: {} }, auditOpinion: '' };
    vs.forEach(function (b) {
      var has = { bcdkt: Object.keys((b.bcdkt || {}).cuoiNam || {}).length > 0, kqkd: Object.keys((b.kqkd || {}).namNay || {}).length > 0, lctt: !!b.lctt, cdtk: Object.keys(b.cdtk || {}).length > 0 };
      if (b.form && b.form !== 'BCTC') out.form = b.form;
      if (b.auditOpinion) out.auditOpinion = b.auditOpinion;
      var fn = (b.source && b.source.fileName) || b.fileName || '';
      var tr = b.trace || {};
      function copyTrace(prefixes) { Object.keys(tr).forEach(function (k) { if (prefixes.some(function (p) { return k.indexOf(p) === 0; })) out.trace[k] = Object.assign({ file: fn }, tr[k]); }); }
      if (has.bcdkt) { out.bcdkt = b.bcdkt; out.parts.bcdkt = true; out.files.bcdkt = fn; out.labels.bcdkt = (b.labels || {}).bcdkt || {}; copyTrace(['bs.', 'bs0.']); }
      if (has.kqkd) { out.kqkd = b.kqkd; out.parts.kqkd = true; out.files.kqkd = fn; out.labels.kqkd = (b.labels || {}).kqkd || {}; copyTrace(['kq.', 'kq0.']); }
      if (has.lctt) { out.lctt = b.lctt; out.parts.lctt = true; out.files.lctt = fn; out.labels.lctt = (b.labels || {}).lctt || {}; copyTrace(['cf.', 'cf0.']); }
      if (has.cdtk) { out.cdtk = b.cdtk; out.parts.cdtk = true; out.files.cdtk = fn; out.labels.cdtk = (b.labels || {}).cdtk || {}; copyTrace(['tk.']); }
      out.srcType = (b.source && b.source.type) || 'xml';
    });
    out.lcttMethod = out.lctt ? (out.lctt.method || (/GT/.test(out.lctt.tag || '') ? 'GT' : (/TT/.test(out.lctt.tag || '') ? 'TT' : 'TT'))) : null;
    return out;
  }
  var TNDN_LBL = { A1: 'Tổng lợi nhuận kế toán trước thuế', B1: 'Điều chỉnh tăng tổng LN trước thuế', B2: 'Các khoản điều chỉnh tăng doanh thu', B3: 'Chi phí của phần DT điều chỉnh giảm', B4: 'Thuế TNDN đã nộp cho phần TN nhận được ở nước ngoài / chi không được trừ', B5: 'Chi phí lãi tiền vay vượt mức / không được trừ', B6: 'Điều chỉnh tăng LN do giao dịch liên kết', B7: 'Các khoản điều chỉnh làm tăng LN trước thuế khác', B8: 'Điều chỉnh giảm tổng LN trước thuế', B9: 'Giảm trừ các khoản doanh thu đã tính thuế năm trước', B10: 'Chi phí của phần DT điều chỉnh tăng', B11: 'Các khoản điều chỉnh làm giảm LN trước thuế khác', B12: 'Tổng thu nhập chịu thuế', B13: 'TNCT từ hoạt động SXKD', B14: 'TNCT từ hoạt động SXKD (trừ BĐS)', B15: 'TNCT từ chuyển nhượng BĐS', C1: 'Thu nhập chịu thuế', C2: 'Thu nhập miễn thuế', C3: 'Chuyển lỗ và bù trừ lãi, lỗ', C4: 'Thu nhập tính thuế', C5: 'Trích lập quỹ KH&CN', C6: 'TNTT sau trích quỹ KH&CN', C9: 'Thuế TNDN phát sinh', C12: 'Thuế TNDN được miễn, giảm', C16: 'Thuế TNDN của hoạt động SXKD', C17: 'Thuế TNDN phải nộp', E: 'Tổng số thuế TNDN phải nộp', G: 'Thuế TNDN đã tạm nộp', I: 'Chênh lệch số phải nộp và đã tạm nộp' };
  var PL_LBL = { '04': 'Doanh thu bán hàng và cung cấp dịch vụ', '05': 'Trong đó DT xuất khẩu', '06': 'Các khoản giảm trừ doanh thu', '07': 'Chiết khấu thương mại', '08': 'Giảm giá hàng bán', '09': 'Hàng bán bị trả lại', '10': 'Doanh thu hoạt động tài chính', '11': 'Chi phí SXKD', '12': 'Chi phí SXKD hàng hóa, dịch vụ', '13': 'Giá vốn hàng bán', '14': 'Chi phí bán hàng', '15': 'Chi phí quản lý doanh nghiệp', '16': 'Chi phí tài chính', '17': 'Trong đó chi phí lãi tiền vay', '18': 'Lợi nhuận thuần từ HĐKD', '19': 'Thu nhập khác', '20': 'Chi phí khác', '21': 'Lợi nhuận khác', '22': 'Tổng lợi nhuận kế toán trước thuế' };

  /**
   * buildFacts(client, year) → {year, regime, has, v{field:value}, src{field:{kind,text,file,sheet,cell}}, periods[], warnings[], bctc, tndn, inputs, overrides}
   * client: {decls[], tndnList[], bctcList[], tmList[], regime?, years{y:{inputs{}, overrides{}}}}
   */
  function buildFacts(client, year) {
    year = +year;
    var yd = (client.years || {})[year] || {}, inputs = yd.inputs || {}, overrides = yd.overrides || {};
    var f = { year: year, v: {}, src: {}, has: {}, periods: [], warnings: [], inputs: inputs, overrides: overrides, tk: {}, labels: {} };
    var decls = (client.decls || []).filter(function (d) { return +d.nam === year; });
    // ----- GTGT -----
    var kk = kieuKyOf(client.decls || [], year), pks = E.periodsForYear(year, kk, false), finals = [];
    pks.forEach(function (pk) {
      var vs = E.versionsOf(decls, pk), fin = E.finalOf(decls, pk);
      f.periods.push({ pk: pk, label: E.periodLabel(pk), final: fin, versions: vs });
      if (fin) finals.push(fin);
    });
    f.kieuKy = kk;
    if (finals.length) {
      f.has.gtgt = true;
      var keys = {}; finals.forEach(function (d) { Object.keys(d.ct || {}).forEach(function (k) { keys[k] = 1; }); });
      Object.keys(keys).forEach(function (k) {
        var s = 0; finals.forEach(function (d) { s += n(+d.ct[k]); });
        f.v['gtgt.' + k] = Math.round(s * 100) / 100;
      });
      var first = finals[0], last = finals[finals.length - 1];
      f.gtgtSum = {}; Object.keys(keys).forEach(function (k) { var s2 = 0; finals.forEach(function (d) { s2 += n(+d.ct[k]); }); f.gtgtSum[k] = Math.round(s2 * 100) / 100; });
      f.gtgtFirst = first.ct; f.gtgtLast = last.ct;
      f.gtgtSum.giam_thue = finals.reduce(function (s2, d) { return s2 + n(d.giamThue); }, 0);
      f.chamNopNam = decls.filter(function (d) { return d.chamNop && d.chamNop.soTien; }).reduce(function (s2, d) { return s2 + d.chamNop.soTien; }, 0);
      if (f.tndn && f.tndn.khbs && f.tndn.khbs.chamNop && f.tndn.khbs.chamNop.soTien > 0) f.chamNopNam += f.tndn.khbs.chamNop.soTien;
      ['ct22'].forEach(function (k) { f.v['gtgt.' + k] = n(+first.ct[k]); });
      ['ct41', 'ct43'].forEach(function (k) { f.v['gtgt.' + k] = n(+last.ct[k]); });
      var lbl = finals.map(function (d) { return E.periodShort ? E.periodShort(d.periodKey) : E.periodLabel(d.periodKey); });
      Object.keys(keys).forEach(function (k) {
        var code = '[' + k.replace(/^ct/, '') + ']';
        var txt = k === 'ct22' ? code + ' kỳ đầu năm có tờ khai — ' + E.periodLabel(first.periodKey) + ' (' + E.versionLabel(first) + ')' : (k === 'ct41' || k === 'ct43') ? code + ' kỳ cuối năm có tờ khai — ' + E.periodLabel(last.periodKey) + ' (' + E.versionLabel(last) + ')' : 'Tổng ' + code + ' của ' + finals.length + ' kỳ (bản cuối mỗi kỳ)';
        f.src['gtgt.' + k] = { kind: 'GTGT', text: txt, files: finals.map(function (d) { return (d.source && d.source.fileName) || ''; }) };
      });
      var missingP = f.periods.filter(function (p) { return !p.final; }).map(function (p) { return p.label; });
      if (missingP.length) f.warnings.push({ code: 'GTGT-MISS', msg: 'Thiếu tờ khai 01/GTGT ' + missingP.length + ' kỳ: ' + missingP.join(', ') + ' — tổng năm chỉ gồm các kỳ đã nạp.' });
      var mstSet = {}; finals.forEach(function (d) { if (d.mst) mstSet[d.mst] = 1; });
      if (client.mst && Object.keys(mstSet).some(function (m) { return m.replace(/\D/g, '').slice(0, 10) !== String(client.mst).replace(/\D/g, '').slice(0, 10); })) f.warnings.push({ code: 'MST', msg: 'Có tờ khai GTGT khác MST của hồ sơ.' });
    }
    // ----- TNDN -----
    var q = E.finalTndn(client.tndnList || [], year);
    if (q) {
      f.has.tndn = true; f.tndn = q;
      var fn = (q.source && q.source.fileName) || q.fileName || '', ver = q.soLan ? 'bổ sung lần ' + q.soLan : 'lần đầu';
      Object.keys(q.main || {}).forEach(function (k) {
        var key = k.replace(/^ct/, ''); f.v['tndn.' + key] = n(+q.main[k]);
        f.src['tndn.' + key] = { kind: 'TNDN', text: '03/TNDN ' + year + ' (' + ver + ') — chỉ tiêu [' + key + ']' + (TNDN_LBL[key] ? ' ' + TNDN_LBL[key] : ''), file: fn };
      });
      Object.keys(q.pl031a || {}).forEach(function (k) {
        var key = k.replace(/^ct/, ''); f.v['tndn.pl' + key] = n(+q.pl031a[k]);
        f.src['tndn.pl' + key] = { kind: 'TNDN', text: 'PL 03-1A/TNDN ' + year + ' (' + ver + ') — chỉ tiêu [' + key + ']' + (PL_LBL[key] ? ' ' + PL_LBL[key] : ''), file: fn };
      });
      if (q.thueSuat != null) f.v['tndn.thueSuat'] = n(+q.thueSuat);
    }
    // ----- BCTC -----
    var b = finalBctcMerged(client.bctcList || [], year);
    var detected = b ? regimeOf(b.form, year) : null;
    var regime = yd.regime || client.regime || detected || defaultRegime(year);
    if (client.regime && detected && client.regime !== detected && !yd.regime) regime = detected; // file BCTC của năm quyết định
    f.regimeDetected = detected; f.regimeSource = yd.regime ? 'Chọn tay cho năm ' + year : detected ? 'Tự nhận diện từ BCTC' : client.regime ? 'Theo hồ sơ khách hàng' : 'Mặc định theo năm tài chính';
    if (regime === 'TT200' && year >= 2026) f.warnings = f.warnings || [];
    f.regime = regime; f.regimeLabel = REGIME_LABEL[regime] || regime; f.form = b ? b.form : '';
    if (regime === 'TT200' && year >= 2026) f.warnings.push({ code: 'TT200-2026', msg: 'Năm ' + year + ' đang áp dụng TT200 (cũ – đến hết 2025). Từ năm tài chính 2026 chế độ kế toán doanh nghiệp theo TT 99/2025/TT-BTC — kiểm tra lại mẫu BCTC.' });
    if (b) {
      f.bctc = b; f.has.bctc = true;
      var put = function (prefix, obj, kind, part, cap) {
        Object.keys(obj || {}).forEach(function (code) {
          var key = prefix + code; f.v[key] = n(+obj[code]);
          var tr = b.trace[key] || {}, lb = (b.labels[part] || {})[code];
          f.src[key] = { kind: 'BCTC', text: cap + ' mã số ' + code + (lb ? ' — ' + lb : ''), file: tr.file || b.files[part] || '', sheet: tr.sheet, cell: tr.cell };
        });
      };
      if (b.parts.bcdkt) { f.has['bctc.bcdkt'] = true; put('bs.', b.bcdkt.cuoiNam, 'BCTC', 'bcdkt', 'BCĐKT (cuối năm)'); put('bs0.', b.bcdkt.dauNam, 'BCTC', 'bcdkt', 'BCĐKT (đầu năm)'); }
      if (b.parts.kqkd) { f.has['bctc.kqkd'] = true; put('kq.', b.kqkd.namNay, 'BCTC', 'kqkd', 'KQKD (năm nay)'); put('kq0.', b.kqkd.namTruoc, 'BCTC', 'kqkd', 'KQKD (năm trước)'); }
      if (b.parts.lctt) { f.has['bctc.lctt'] = true; if (b.lcttMethod !== 'GT') f.has['bctc.lcttTT'] = true; put('cf.', b.lctt.namNay, 'BCTC', 'lctt', 'LCTT ' + (b.lcttMethod === 'GT' ? 'gián tiếp' : 'trực tiếp') + ' (năm nay)'); put('cf0.', b.lctt.namTruoc, 'BCTC', 'lctt', 'LCTT (năm trước)'); }
      if (b.parts.cdtk) {
        f.has['bctc.cdtk'] = true; f.tk = b.cdtk;
        var FL = { dkNo: 'Dư Nợ đầu kỳ', dkCo: 'Dư Có đầu kỳ', psNo: 'Phát sinh Nợ', psCo: 'Phát sinh Có', ckNo: 'Dư Nợ cuối kỳ', ckCo: 'Dư Có cuối kỳ' };
        Object.keys(b.cdtk).forEach(function (a) { Object.keys(b.cdtk[a]).forEach(function (fl) { var key = 'tk.' + a + '.' + fl, tr = b.trace[key] || {}, lb = (b.labels.cdtk || {})[a]; f.v[key] = n(+b.cdtk[a][fl]); f.src[key] = { kind: 'BCTC', text: 'BCĐTK TK ' + a + (lb ? ' ' + lb : '') + ' — ' + (FL[fl] || fl), file: tr.file || b.files.cdtk || '', sheet: tr.sheet, cell: tr.cell }; }); });
      }
      if (b.lcttMethod === 'GT') f.warnings.push({ code: 'LCTT-GT', msg: 'LCTT lập theo phương pháp gián tiếp — R10, R11 không áp dụng (cần LCTT trực tiếp).' });
    }
    // Nhập tay toàn bộ nguồn (khi không có file): override có tiền tố → coi như có nguồn
    Object.keys(overrides).forEach(function (k) {
      var o = overrides[k]; if (!o || o.value == null || o.value === '') return;
      if (/^bs0?\./.test(k)) f.has['bctc.bcdkt'] = f.has['bctc.bcdkt'] || 'manual';
      if (/^kq0?\./.test(k)) f.has['bctc.kqkd'] = f.has['bctc.kqkd'] || 'manual';
      if (/^cf0?\./.test(k)) { f.has['bctc.lctt'] = f.has['bctc.lctt'] || 'manual'; if (!b || !b.parts.lctt) f.has['bctc.lcttTT'] = f.has['bctc.lcttTT'] || 'manual'; }
      if (/^tk\./.test(k)) f.has['bctc.cdtk'] = f.has['bctc.cdtk'] || 'manual';
      if (/^gtgt\./.test(k)) f.has.gtgt = f.has.gtgt || 'manual';
      if (/^tndn\./.test(k)) f.has.tndn = f.has.tndn || 'manual';
    });
    if (f.has['bctc.bcdkt'] || f.has['bctc.kqkd'] || f.has['bctc.lctt'] || f.has['bctc.cdtk']) f.has.bctc = f.has.bctc || 'manual';
    // TM
    f.tm = (client.tmList || []).filter(function (t) { return +t.nam === year; }).slice(-1)[0] || null;
    // Ý kiến kiểm toán
    var ak = inputs.auditOpinion || '', at = b && b.auditOpinion;
    if (!ak && at) { var ft = String(at).toLowerCase(); ak = /ngoại trừ|ngoai tru|từng phần|tung phan/.test(ft) ? 'ngoai_tru' : /từ chối|tu choi/.test(ft) ? 'tu_choi' : /trái ngược|trai nguoc|không chấp nhận|khong chap nhan/.test(ft) ? 'trai_nguoc' : /chấp nhận|chap nhan/.test(ft) ? 'chap_nhan' : ''; }
    f.audit = ak;
    return f;
  }
  var AUDIT = { '': { code: 0, text: 'BCTC không kiểm toán / chưa nhập ý kiến kiểm toán' }, khong: { code: 0, text: 'BCTC không thuộc diện kiểm toán' }, chap_nhan: { code: 1, text: 'Chấp nhận toàn phần' }, ngoai_tru: { code: 2, text: 'Chấp nhận từng phần (ngoại trừ)' }, tu_choi: { code: 3, text: 'Từ chối đưa ra ý kiến' }, trai_nguoc: { code: 4, text: 'Không chấp nhận (trái ngược)' } };

  /** Dữ liệu năm trước suy từ cột "năm trước/đầu năm" của BCTC năm nay (khi chưa nạp hồ sơ năm trước) */
  function priorFromColumns(f) {
    var p = { year: f.year - 1, v: {}, src: {}, has: {}, periods: [], warnings: [], inputs: {}, overrides: {}, tk: {}, regime: f.regime, regimeLabel: f.regimeLabel, derived: true };
    Object.keys(f.v).forEach(function (k) { var m = k.match(/^(bs|kq|cf)0\.(\w+)$/); if (m) { p.v[m[1] + '.' + m[2]] = f.v[k]; p.src[m[1] + '.' + m[2]] = { kind: 'BCTC năm ' + f.year, text: 'Cột năm trước/đầu năm trên BCTC ' + f.year }; } });
    ['bcdkt', 'kqkd', 'lctt'].forEach(function (x) { if (f.has['bctc.' + x]) p.has['bctc.' + x] = 'derived'; });
    if (p.has['bctc.bcdkt'] || p.has['bctc.kqkd']) p.has.bctc = 'derived';
    return p;
  }
  /** Bộ tra cứu trường chuẩn cho một năm (có năm trước) */
  function makeLookup(f, prevF, rules, extraVars) {
    var mapping = rules.mapping || {}, regime = f.regime, cacheM = {};
        function raw(ff, name) {
      if (!ff) return null;
      var ov = ff.overrides && ff.overrides[name];
      if (ov && ov.value != null && ov.value !== '' && isFinite(+ov.value)) return +ov.value;
      if (name.indexOf('in.') === 0) { var iv = ff.inputs[name.slice(3)]; return iv == null || iv === '' ? null : (isFinite(+iv) ? +iv : (iv === true ? 1 : iv)); }
      if (Object.prototype.hasOwnProperty.call(ff.v, name)) return ff.v[name];
      var m = name.match(/^tk\.(\d+)\.(\w+)$/);
      if (m && ff.has['bctc.cdtk']) {
        // tài khoản cha không có dòng → cộng các tài khoản con cấp liền dưới
        var acc = m[1], fl = m[2], pool = {};
        Object.keys(ff.tk || {}).forEach(function (a) { pool[a] = 1; });
        Object.keys(ff.overrides || {}).forEach(function (k) { var mm = k.match(/^tk\.(\d+)\./); if (mm) pool[mm[1]] = 1; });
        var kids = Object.keys(pool).filter(function (a) { return a.length > acc.length && a.indexOf(acc) === 0; });
        if (kids.length) { var minL = Math.min.apply(null, kids.map(function (a) { return a.length; })); return kids.filter(function (a) { return a.length === minL; }).reduce(function (s, a) { return s + n(raw(ff, 'tk.' + a + '.' + fl)); }, 0); }
        // tài khoản con không có → dùng tài khoản cha nếu cha không có con nào khác (vd 33311 ← 3331)
        var par = acc.slice(0, -1); while (par.length >= 3) { if (ff.tk[par]) { var sib = Object.keys(ff.tk).filter(function (a) { return a.length > par.length && a.indexOf(par) === 0; }); if (!sib.length) return n(+ff.tk[par][fl]); break; } par = par.slice(0, -1); }
        return 0;
      }
      if (/^(bs0?|kq0?|cf0?)\.\w+$/.test(name)) { var part = /^bs/.test(name) ? 'bctc.bcdkt' : /^kq/.test(name) ? 'bctc.kqkd' : 'bctc.lctt'; return ff.has[part] ? 0 : null; }
      if (/^gtgt\./.test(name)) return ff.has.gtgt ? 0 : null;
      if (/^tndn\./.test(name)) return ff.has.tndn ? 0 : null;
      return null;
    }
    function mapped(ff, key, start) {
      var ck = (ff === f ? 'c' : 'p') + (start ? '0' : '') + key;
      if (ck in cacheM) return cacheM[ck];
      var mp = mapping[key]; if (!mp) return (cacheM[ck] = undefined);
      var rg = ff.regime || regime, ex = mp[rg];
      if (ex === undefined) { var fb = ((rules.regimes || []).filter(function (r) { return r.id === rg; })[0] || {}).fallback || (rg === 'TT99' ? 'TT200' : null); if (fb) ex = mp[fb]; }
      if (ex === undefined) ex = mp.TT99 !== undefined ? mp.TT99 : mp.TT200;
      if (ex == null) return (cacheM[ck] = null);
      if (start) ex = startExpr(ex);
      var r = evaluate(ex, function (nm) { return raw(ff, nm); });
      return (cacheM[ck] = r.value);
    }
    function lookup(name) {
      if (extraVars && Object.prototype.hasOwnProperty.call(extraVars, name)) return extraVars[name];
      var m;
      if ((m = name.match(/^(m0?)\.(\w+)$/))) { var v = mapped(f, m[2], m[1] === 'm0'); return v === undefined ? null : v; }
      if ((m = name.match(/^prev\.(.+)$/))) {
        var nm = m[1];
        if (prevF) {
          var mm = nm.match(/^(m0?)\.(\w+)$/);
          if (mm) { var pv = mapped(prevF, mm[2], mm[1] === 'm0'); if (pv != null) return pv; }
          else {
            var pn = nm, cm = nm.match(/^(bs0?|kq0?|cf0?)\.(\w+)$/), tm = nm.match(/^tk\.(\d+)\.(\w+)$/);
            // qua mốc 2026: mã số năm nay (TT99) → mã số năm trước (TT200 cũ)
            if (f.regime === 'TT99' && prevF.regime === 'TT200') { if (cm) pn = cm[1] + '.' + convertCode(rules, cm[1].replace('0', ''), cm[2], 'rev'); else if (tm) pn = 'tk.' + convertCode(rules, 'tk', tm[1], 'rev') + '.' + tm[2]; }
            var x = raw(prevF, pn); if (x != null) return x;
          }
        }
        // không có hồ sơ năm trước: dùng cột năm trước/đầu năm của BCTC năm nay
        var alt = nm.replace(/^bs\./, 'bs0.').replace(/^kq\./, 'kq0.').replace(/^cf\./, 'cf0.').replace(/^m\./, 'm0.');
        if (alt !== nm) return lookup(alt);
        return null;
      }
      if (name === 'rate.tndn') { var ts = raw(f, 'in.thueSuatTndn') || raw(f, 'tndn.C7_thueSuat') || raw(f, 'tndn.thueSuat'); return ts ? (ts > 1 ? ts / 100 : ts) : (rules.defaults.rateTndn || 0.2); }
      if (name === 'rate.gtgt') { var a = raw(f, 'gtgt.ct35'), b2 = raw(f, 'gtgt.ct34'); var rt = a && b2 ? a / (raw(f, 'gtgt.ct27') || b2) : null; return rt && rt > 0 && rt < 0.2 ? rt : (rules.defaults.rateGtgt || 0.1); }
      if (name === 'tol') return rules.defaults.tol != null ? rules.defaults.tol : 1000;
      return raw(f, name);
    }
    return lookup;
  }
  /** Mô tả nguồn của một trường (truy vết) */
  function sourceOf(f, name, rules) {
    rules = rules || getRules();
    if (rules.dialect === 'r3' && API.r3 && !(f.overrides && f.overrides[name] && f.overrides[name].value != null && f.overrides[name].value !== '')) return API.r3.srcOf(f, name, rules);
    return sourceOfApp(f, name, rules);
  }
  function sourceOfApp(f, name, rules) {
    var ov = f.overrides && f.overrides[name];
    if (ov && ov.value != null && ov.value !== '') return { kind: 'Sửa tay', text: 'Nhập/sửa tay' + (ov.note ? ': ' + ov.note : '') + (ov.at ? ' (' + E.fmtDate(String(ov.at).slice(0, 10)) + ')' : ''), manual: true, original: f.v[name] };
    if (f.src[name]) return f.src[name];
    var m;
    if ((m = name.match(/^(m0?)\.(\w+)$/))) { var mp = (rules.mapping || {})[m[2]] || {}; var ex = mp[f.regime] !== undefined ? mp[f.regime] : (f.regime === 'TT99' && mp.TT200 !== undefined ? mp.TT200 : mp.TT99); var fbNote = mp[f.regime] === undefined && f.regime === 'TT99' ? ' [CXM: chưa có mapping TT99, tạm dùng mã TT200 (cũ – đến hết 2025)]' : ''; return { kind: 'Mapping', fallback: !!fbNote, text: (mp.label || m[2]) + (m[1] === 'm0' ? ' (đầu năm)' : '') + ' = ' + (ex == null ? 'không có trên mẫu ' + (REGIME_LABEL[f.regime] || f.regime) : String(ex).replace(/\b(bs|kq|cf)\./g, m[1] === 'm0' ? '$10.' : '$1.')) + ' — ' + (REGIME_LABEL[f.regime] || f.regime) + fbNote, expr: ex }; }
    if (/^in\./.test(name)) return { kind: 'Nhập tay', text: 'Thông tin bổ sung nhập tay' };
    if (/^tk\./.test(name)) return { kind: 'BCTC', text: 'BCĐTK — tổng hợp từ tài khoản chi tiết / không có số dư' };
    if (/^prev\./.test(name)) return { kind: 'Năm trước', text: 'Số liệu năm trước (hồ sơ năm trước hoặc cột năm trước/đầu năm của BCTC năm nay)' };
    if (/^rate\./.test(name)) return { kind: 'Tham số', text: name === 'rate.tndn' ? 'Thuế suất TNDN (theo 03/TNDN hoặc 20%)' : 'Thuế suất GTGT bình quân ([35]/[34], mặc định 10%)' };
    return { kind: '', text: '' };
  }

  /* ================= Đánh giá tiêu chí ================= */
  function fillText(tpl, vars, lookup) {
    return String(tpl || '').replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, function (all, k) {
      if (/(^|\.)nam\d?$/.test(k) && Object.prototype.hasOwnProperty.call(vars, k)) return vars[k] == null ? '…' : String(vars[k]);
      if (Object.prototype.hasOwnProperty.call(vars, k)) { var v = vars[k]; return v == null || v === '' ? '…' : (typeof v === 'number' ? fmt(v) : String(v)); }
      if (/\./.test(k) && lookup) { var x = lookup(k); return x == null ? '…' : (typeof x === 'number' ? fmt(x) : String(x)); }
      return all;
    });
  }
  function truthy(expr, lookup) { if (expr === true || expr === false) return expr; if (expr == null || expr === '') return false; return !!evaluate(expr, lookup).value; }

  /** Số năm lỗ liên tiếp đến năm `year`. kind 'tt' = LN trước thuế (ms50 / A1); 'kd' = LN thuần HĐKD (theo mapping chế độ) */
  function lossYearsOf(client, year, f, prevF, kind) {
    var cnt = 0, y = year, cur = f, rules = getRules();
    var semKD = kind === 'kd' && rules.sem && rules.sem.kqkd && rules.sem.kqkd.ln_thuan_kd;
    if (kind === 'kd' && !semKD) return null;
    var get = function (ff) {
      if (!ff) return null;
      if (kind === 'kd') { if (!ff.has['bctc.kqkd']) return null; var rg = { TT133a: 'TT133_B01a', TT133b: 'TT133_B01b' }[ff.regime] || ff.regime; var cd = semKD.byRegime[rg] || (rg === 'TT99' ? semKD.byRegime.TT200 : null); if (!cd || !cd.expr) return null; try { return evaluate(cd.expr, makeLookup(ff, null, rules)).value; } catch (e) { return null; } }
      var ov = ff.overrides['kq.50']; if (ov && ov.value != null && ov.value !== '') return +ov.value; return ff.has['bctc.kqkd'] ? ff.v['kq.50'] : (ff.has.tndn ? ff.v['tndn.A1'] : null);
    };
    var v = get(cur);
    if (v == null) return null;
    while (v != null && v < 0 && cnt < 20) {
      cnt++; y--;
      var pf = y === year - 1 && prevF ? prevF : (client ? buildFacts(client, y) : null);
      var pv = pf && (pf.has.bctc || pf.has.tndn) ? get(pf) : null;
      if (pv == null && y === year - 1 && f.has['bctc.kqkd'] && kind !== 'kd') pv = f.v['kq0.50'] != null ? f.v['kq0.50'] : null;
      if (pv == null && y === year - 1 && f.has['bctc.kqkd'] && kind === 'kd') { var rg0 = { TT133a: 'TT133_B01a', TT133b: 'TT133_B01b' }[f.regime] || f.regime, cd0 = semKD.byRegime[rg0] || (rg0 === 'TT99' ? semKD.byRegime.TT200 : null); if (cd0 && cd0.expr) { try { pv = evaluate(cd0.expr.replace(/\bkq\./g, 'kq0.'), makeLookup(f, null, rules)).value; } catch (e) { pv = null; } } }
      v = pv;
    }
    return cnt;
  }

  /**
   * evaluateYear(client, year, opts) → {year, facts, results[], score, indicators[], counts}
   */
  function evaluateYear(client, year, opts) {
    opts = opts || {};
    var rules = opts.rules || getRules();
    var f = opts.facts || buildFacts(client, year);
    var prevF = opts.prevFacts !== undefined ? opts.prevFacts : (hasAny(client, year - 1) ? buildFacts(client, year - 1) : null);
    var yd = (client.years || {})[year] || {}, notes = yd.notes || {};
    var ac = AUDIT[f.audit || ''] || AUDIT[''];
    var base = makeLookup(f, prevF, rules);
    var fx = function (k) { return base(k); };
    var ngoaiTeAuto = ['1112', '1122'].some(function (a) { var x = (f.tk || {})[a]; return x && (n(x.psNo) || n(x.psCo) || n(x.ckNo)); }) || !!((f.tk || {})['413'] && (n(f.tk['413'].psNo) || n(f.tk['413'].psCo)));
    var inNT = f.inputs.coNgoaiTe;
    var coNgoaiTe = inNT === true || inNT === 'co' || inNT === 1 ? true : (inNT === false || inNT === 'khong' ? false : ngoaiTeAuto);
    var lossYears = lossYearsOf(client, year, f, prevF);
    var lossYearsKD = lossYearsOf(client, year, f, prevF, 'kd');
    var specials = { coNgoaiTe: coNgoaiTe, coNgoaiTeText: coNgoaiTe ? 'Có giao dịch ngoại tệ; đã có điều chỉnh [B7]/[B11].' : 'Không phát hiện giao dịch ngoại tệ (TK 1112, 1122, 413) — không áp dụng.', auditCode: ac.code, auditText: ac.text, lossYears: lossYears, lossYearsKD: lossYearsKD, year: year };
    var results, sc, inds;
    if (rules.dialect === 'r3' && API.r3) {
      results = rules.criteria.map(function (c) { return API.r3.evalCrit3(c, f, prevF, rules, specials, notes[c.id] || {}, client.bench || {}); });
      sc = API.r3.score3(results, rules);
      inds = API.r3.indicators3(rules, f, prevF, specials, client.bench || {});
    } else {
      results = rules.criteria.map(function (c) { return evalCriterion(c, f, prevF, rules, specials, notes[c.id] || {}); });
      sc = score(results, rules);
      inds = indicators(rules, f, prevF, specials, client.bench || {});
    }
    return { year: year, facts: f, prevFacts: prevF, results: results, score: sc, indicators: inds, specials: specials, rulesVersion: (rules.meta || {}).version || '' };
    void fx;
  }
  function hasAny(client, y) {
    return (client.decls || []).some(function (d) { return +d.nam === +y; }) || (client.tndnList || []).some(function (t) { return +t.nam === +y; }) || (client.bctcList || []).some(function (b) { return +b.nam === +y; }) || !!((client.years || {})[y] && Object.keys(((client.years || {})[y] || {}).overrides || {}).length);
  }
  function reqOk(req, f) {
    // "a|b" = một trong hai
    return String(req).split('|').some(function (r) { return !!f.has[r.trim()]; });
  }
  var REQ_LABEL = { gtgt: 'Tờ khai 01/GTGT', tndn: 'Tờ khai quyết toán 03/TNDN', bctc: 'BCTC', 'bctc.kqkd': 'Báo cáo KQKD', 'bctc.bcdkt': 'Bảng cân đối kế toán / Báo cáo tình hình tài chính', 'bctc.cdtk': 'Bảng cân đối tài khoản (BCĐTK)', 'bctc.lctt': 'Báo cáo lưu chuyển tiền tệ', 'bctc.lcttTT': 'Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)' };
  function evalCriterion(c, f, prevF, rules, specials, note) {
    var res = { id: c.id, name: c.name, group: c.group, type: c.type, verify: c.verify, xuLy: c.xuLy, ghiChu: c.ghiChu, causes: c.causes || [], docs: c.docs || [], basis: c.basis || [], pts: c.pts || null, guide: c.guide || null, refs: [], missing: [], explained: [], flags: { gtgt: false, tndn: false, khac: false }, impact: { gtgt: 0, tndn: 0, total: 0 }, note: note };
    var miss = (c.requires || []).filter(function (r) { return !reqOk(r, f); });
    if (miss.length) {
      var onlyTT = miss.length === 1 && miss[0] === 'bctc.lcttTT' && f.has['bctc.lctt'];
      res.status = onlyTT ? 'na' : 'missing'; res.level = onlyTT ? 'na' : 'missing';
      res.missingDocs = miss.map(function (r) { return String(r).split('|').map(function (x) { return REQ_LABEL[x.trim()] || x; }).join(' hoặc '); });
      res.text = onlyTT ? 'Không áp dụng: LCTT lập theo phương pháp gián tiếp (tiêu chí cần LCTT trực tiếp).' : 'Thiếu dữ liệu: ' + res.missingDocs.join('; ') + '.';
      fillLabels(res, c, f, rules); return res;
    }
    var vars = Object.assign({}, specials, { tol: rules.defaults.tol != null ? rules.defaults.tol : 1000 });
    var lk = makeLookup(f, prevF, rules, vars);
    res.potential = { gtgt: (c.flags || {}).gtgt != null && (c.flags || {}).gtgt !== false, tndn: (c.flags || {}).tndn != null && (c.flags || {}).tndn !== false, khac: (c.flags || {}).khac != null && (c.flags || {}).khac !== false };
    // chỉ tiêu không có trên mẫu của chế độ kế toán → Không áp dụng
    var mainExpr = c.type === 'compare' ? '' : String((c.value && c.value.expr) || (c.sl1 && c.sl1.expr) || '');
    var mk = mainExpr.match(/\bm\.(\w+)/g) || [];
    var naMap = mk.length && mk.every(function (k) { var mp = (rules.mapping || {})[k.slice(2)]; if (!mp) return false; var ex = mp[f.regime]; if (ex === undefined && f.regime === 'TT99') ex = mp.TT200; return ex === null; });
    var naApp = c.applies && !truthy(c.applies, lk);
    if (naMap || naApp) {
      res.status = 'na'; res.level = 'na';
      res.text = naMap ? 'Không áp dụng: mẫu BCTC theo ' + (REGIME_SHORT[f.regime] || f.regime) + ' không có chỉ tiêu này.' : fillText(c.naText || 'Không áp dụng (điều kiện đánh giá không thỏa).', vars, lk);
      fillLabels(res, c, f, rules); return res;
    }
    var refsAll = [];
    function ev(expr) { if (expr == null) return null; try { var r = evaluate(expr, lk); refsAll = refsAll.concat(r.refs); return r.value; } catch (e) { res.error = (res.error ? res.error + '; ' : '') + e.message; return null; } }
    if (c.type === 'compare') {
      vars.sl1 = num(ev(c.sl1 && c.sl1.expr)); vars.sl2 = num(ev(c.sl2 && c.sl2.expr));
      vars.cl = num(ev(c.cl ? c.cl.expr : 'sl1 - sl2'));
      var ex = 0;
      (c.autoExplain || []).forEach(function (a) { var v = num(ev(a.expr)); if (v && Math.abs(v) >= 1) { res.explained.push({ label: a.label, amount: v }); ex += v; } });
      (note.explain || []).forEach(function (a) { var v = num(a.amount); if (v) { res.explained.push({ label: a.label || 'Giải trình của DN', amount: v, manual: true }); ex += v; } });
      vars.explained = ex; vars.clr = vars.cl - ex;
      vars.base = c.base ? num(ev(c.base)) : vars.sl1;
      vars.pct = vars.base ? vars.cl / Math.abs(vars.base) * 100 : null; vars.pctr = vars.base ? vars.clr / Math.abs(vars.base) * 100 : null;
      vars.v = vars.cl;
      if (c.extra) vars.x = num(ev(c.extra.expr));
    } else {
      var vex = (c.value && c.value.expr) || (c.sl1 && c.sl1.expr);
      vars.v = num(ev(vex));
      if (c.extra) vars.x = num(ev(c.extra.expr));
      // số liệu tham chiếu SL1/SL2 cho tiêu chí một chỉ tiêu: SL1 = số đánh giá (hoặc khai báo), SL2 = khai báo hoặc đầu năm/năm trước
      var r1 = c.sl1 ? num(ev(c.sl1.expr)) : vars.v, s2ex = c.sl2 ? c.sl2.expr : (vex && startExpr(vex) !== vex ? startExpr(vex) : null);
      res.refSl1 = r1; res.refSl2 = s2ex ? num(ev(s2ex)) : null; res.refCl = res.refSl2 == null ? null : r1 - res.refSl2;
      res.refSl2Label = c.sl2 ? c.sl2.label : (s2ex ? 'Đầu năm / năm trước (tham chiếu)' : '');
      vars.base = c.base ? num(ev(c.base)) : null;
      vars.vpct = vars.base ? vars.v / Math.abs(vars.base) * 100 : null;
      vars.cl = vars.v; vars.clr = vars.v; vars.explained = 0;
    }
    // mức độ
    var lvl = 'khong';
    for (var i = 0; i < (c.levels || []).length; i++) { var L = c.levels[i]; if (L.when && truthy(L.when, lk)) { lvl = L.level; break; } }
    if (c.type === 'manual' && c.id === 'R39' && !specials.auditCode) lvl = 'na';
    res.level = lvl; res.status = lvl === 'na' ? 'na' : lvl === 'khong' ? 'ok' : 'risk';
    // cờ rủi ro trực tiếp
    ['gtgt', 'tndn', 'khac'].forEach(function (k) { var e = (c.flags || {})[k]; res.flags[k] = res.status === 'risk' && truthy(e, lk); });
    if (res.status === 'risk' && !res.flags.gtgt && !res.flags.tndn && !res.flags.khac) { if ((c.flags || {}).khac !== false) res.flags.khac = true; }
    // số thuế ảnh hưởng ước tính
    if (res.status === 'risk') {
      ['gtgt', 'tndn'].forEach(function (k) { var e = (c.impact || {})[k]; if (e != null && e !== '') { var v = num(ev(e)); res.impact[k] = v > 0 ? Math.round(v) : 0; } });
      res.impact.total = res.impact.gtgt + res.impact.tndn;
    }
    // văn bản
    vars.cmp = vars.cl > 0.5 ? (c.type === 'compare' && /sl2 - sl1/.test((c.cl || {}).expr || '') ? 'lớn hơn' : 'lớn hơn') : vars.cl < -0.5 ? 'nhỏ hơn' : 'bằng';
    if (c.type === 'compare' && /sl2\s*-\s*sl1/.test((c.cl || {}).expr || '')) vars.cmp = vars.cl > 0.5 ? 'lớn hơn' : vars.cl < -0.5 ? 'nhỏ hơn' : 'bằng';
    var fv = Object.assign({}, vars, { pct: vars.pct == null ? '…' : fmtPct(vars.pct), pctr: vars.pctr == null ? '…' : fmtPct(vars.pctr), vpct: vars.vpct == null ? '…' : fmtPct(vars.vpct), cmp: vars.cmp });
    fv.explainList = res.explained.length ? res.explained.map(function (x) { return x.label + ': ' + fmt(x.amount); }).join('; ') : 'không có khoản lý giải tự động';
    fv.explained = fmt(vars.explained);
    var tt = c.text || {};
    res.text = fillText(res.status === 'risk' ? (tt.risk || '') : res.status === 'na' ? (tt.na || tt.ok || 'Không áp dụng.') : (tt.ok || 'Không phát hiện dấu hiệu rủi ro.'), fv, lk);
    res.giaiTrinhTpl = fillText(c.giaiTrinh || '', fv, lk);
    res.sl1 = c.type === 'compare' ? vars.sl1 : (res.refSl1 != null ? res.refSl1 : null); res.sl2 = c.type === 'compare' ? vars.sl2 : res.refSl2;
    res.cl = vars.cl; res.clr = vars.clr; res.v = vars.v; res.x = vars.x; res.base = vars.base; res.pct = c.type === 'compare' ? vars.pct : vars.vpct; res.pctr = vars.pctr;
    // truy vết các trường dùng
    var seen = {};
    refsAll.forEach(function (r) { if (seen[r.name] || vars.hasOwnProperty(r.name)) return; seen[r.name] = 1; res.refs.push({ name: r.name, value: r.value, src: sourceOf(f, r.name, rules) }); });
    fillLabels(res, c, f, rules);
    return res;
  }
  function num(v) { return v == null ? 0 : (v === true ? 1 : v === false ? 0 : (isFinite(+v) ? +v : 0)); }
  var PART_NAME = { bs: 'BCĐKT', bs0: 'BCĐKT (đầu năm)', kq: 'KQKD', kq0: 'KQKD (năm trước)', cf: 'LCTT', cf0: 'LCTT (năm trước)' };
  /** Nhãn mã số theo chế độ của hồ sơ cho biểu thức dùng m.xxx — vd "Mã số 134 — BCĐKT (TT133 (DNNVV) — B01a)" */
  function regimeCodeLabel(expr, f, rules) {
    if (!expr || !f) return '';
    var keys = String(expr).match(/\bm0?\.\w+/g); if (!keys) return '';
    var out = [], seen = {};
    keys.forEach(function (k) {
      var key = k.replace(/^m0?\./, ''); if (seen[key]) return; seen[key] = 1;
      var mp = (rules.mapping || {})[key]; if (!mp) return;
      var ex = mp[f.regime], fb = false; if (ex === undefined && f.regime === 'TT99') { ex = mp.TT200; fb = true; }
      if (ex == null) { out.push((mp.label || key) + ': không có chỉ tiêu trên mẫu ' + (REGIME_SHORT[f.regime] || f.regime)); return; }
      var parts = {}; String(ex).replace(/\b(bs0?|kq0?|cf0?)\.(\w+)/g, function (_, p, cd) { (parts[p] = parts[p] || []).push(cd); return _; });
      var txt = Object.keys(parts).map(function (p) { return 'mã số ' + parts[p].join(' + ') + ' ' + (PART_NAME[p] || p); }).join('; ');
      out.push((mp.label || key) + ': ' + (txt || ex) + (fb ? ' [CXM: tạm theo TT200 (cũ – đến hết 2025)]' : ''));
    });
    return out.length ? out.join(' · ') + ' — ' + (REGIME_SHORT[f.regime] || f.regime) : '';
  }
  function fillLabels(res, c, f, rules) {
    if (f && rules) { res.codeLabel = regimeCodeLabel((c.value && c.value.expr) || '', f, rules); res.sl1Code = regimeCodeLabel(c.sl1 && c.sl1.expr, f, rules); res.sl2Code = regimeCodeLabel(c.sl2 && c.sl2.expr, f, rules); res.regime = f.regime; }
    res.sl1Label = c.sl1 ? c.sl1.label : ''; res.sl2Label = c.sl2 ? c.sl2.label : ''; res.clLabel = c.cl ? c.cl.label : (c.type === 'compare' ? 'SL1 − SL2' : '');
    res.valueLabel = c.value ? c.value.label : ''; res.extraLabel = c.extra ? c.extra.label : '';
    res.exprs = { sl1: c.sl1 && c.sl1.expr, sl2: c.sl2 && c.sl2.expr, cl: c.cl && c.cl.expr, value: c.value && c.value.expr, extra: c.extra && c.extra.expr, levels: c.levels, flags: c.flags, impact: c.impact };
  }
  function score(results, rules) {
    rules = rules || getRules();
    var w = {}; (rules.levels || []).forEach(function (l) { w[normLevel(l.id)] = l.weight != null ? l.weight : 0; });
    var maxW = Math.max.apply(null, Object.keys(w).map(function (k) { return w[k]; }).concat([1]));
    var c = { cao: 0, tb: 0, thap: 0, khong: 0, na: 0, missing: 0 }, sum = 0, evaluated = 0, imp = { gtgt: 0, tndn: 0, total: 0 };
    results.forEach(function (r) {
      c[r.level] = (c[r.level] || 0) + 1;
      if (r.status === 'risk' || r.status === 'ok') { evaluated++; sum += w[r.level] || 0; }
      imp.gtgt += r.impact.gtgt; imp.tndn += r.impact.tndn; imp.total += r.impact.total;
    });
    var minEval = (rules.scoring || {}).minEvaluated != null ? rules.scoring.minEvaluated : 8;
    var s = evaluated >= minEval ? Math.round(sum / (maxW * evaluated) * 100) : null;
    var band = null; ((rules.scoring || {}).bands || []).some(function (b) { if (s != null && s >= b.min) { band = b.label; return true; } return false; });
    return { score: s, band: band || (s == null ? 'Chưa đủ dữ liệu (cần ≥ ' + minEval + ' tiêu chí)' : null), counts: c, red: c.cao, amber: c.tb + c.thap, green: c.khong, evaluated: evaluated, total: results.length, impact: imp };
  }
  function indicators(rules, f, prevF, specials, bench) {
    var lk = makeLookup(f, prevF, rules, Object.assign({}, specials));
    return (rules.indicators || []).map(function (ind) {
      var r = { id: ind.id, name: ind.name, unit: ind.unit, group: ind.group || '', note: ind.note || '', expr: ind.expr };
      try { var e = evaluate(ind.expr, lk); r.value = e.value == null || e.value === true || e.value === false ? (typeof e.value === 'boolean' ? +e.value : null) : e.value; r.refs = e.refs.map(function (x) { return { name: x.name, value: x.value }; }); } catch (er) { r.value = null; r.error = er.message; }
      var lk2 = makeLookup(f, prevF, rules, Object.assign({}, specials, { v: r.value }));
      r.warn = r.value != null && ind.warn ? truthy(ind.warn, lk2) : false;
      var b = bench[ind.id]; if (b && (b.min != null && b.min !== '' || b.max != null && b.max !== '')) { r.bench = b; r.outOfBench = r.value != null && ((b.min !== '' && b.min != null && r.value < +b.min) || (b.max !== '' && b.max != null && r.value > +b.max)); }
      return r;
    });
  }
  /** So sánh nhiều năm: {years[], rows:[{id,name, byYear{y:{level,cl,v}}}], indicators:[{id,name,unit,byYear{y:value}, delta}]} */
  function compareYears(client, years, opts) {
    var ev = {}; years.forEach(function (y) { ev[y] = evaluateYear(client, y, opts); });
    var rules = (opts && opts.rules) || getRules();
    return {
      years: years, evals: ev,
      rows: rules.criteria.map(function (c) { var o = { id: c.id, name: c.name, byYear: {} }; years.forEach(function (y) { var r = ev[y].results.filter(function (x) { return x.id === c.id; })[0]; o.byYear[y] = r; }); return o; }),
      indicators: (rules.indicators || []).map(function (ind) { var o = { id: ind.id, name: ind.name, unit: ind.unit, byYear: {} }; years.forEach(function (y) { var r = ev[y].indicators.filter(function (x) { return x.id === ind.id; })[0]; o.byYear[y] = r ? r.value : null; }); return o; })
    };
  }
  /** Danh mục trường cho màn Số liệu tổng hợp (theo chế độ) */
  var BS_CODES = {
    TT133a: ['110', '120', '121', '122', '123', '124', '130', '131', '132', '133', '134', '135', '136', '140', '141', '142', '150', '151', '152', '160', '161', '162', '170', '180', '181', '182', '200', '300', '311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '400', '411', '412', '413', '414', '415', '416', '417', '500'],
    TT200: ['100', '110', '111', '112', '120', '121', '122', '123', '130', '131', '132', '133', '134', '135', '136', '137', '139', '140', '141', '149', '150', '151', '152', '153', '154', '155', '200', '210', '211', '216', '219', '220', '221', '222', '223', '227', '230', '240', '241', '242', '250', '254', '260', '261', '262', '270', '300', '310', '311', '312', '313', '314', '315', '318', '319', '320', '321', '322', '330', '331', '332', '333', '336', '338', '341', '342', '343', '400', '410', '411', '412', '418', '421', '440'],
    TT133b: ['110', '120', '121', '122', '130', '131', '132', '133', '135', '140', '141', '142', '200', '240', '300', '400', '410', '411', '412', '413', '414', '416', '417', '420', '422', '424', '426', '427', '500', '600']
  };
  var KQ_CODES = { TT133a: ['01', '02', '10', '11', '20', '21', '22', '23', '24', '30', '31', '32', '40', '50', '51', '60'], TT200: ['01', '02', '10', '11', '20', '21', '22', '23', '25', '26', '30', '31', '32', '40', '50', '51', '52', '60'] };
  var CF_CODES = { TT133a: ['01', '02', '03', '04', '05', '06', '07', '20', '21', '22', '23', '24', '25', '30', '31', '32', '33', '34', '35', '40', '50', '60', '61', '70'], TT200: ['01', '02', '03', '04', '05', '06', '07', '20', '21', '22', '23', '24', '25', '26', '27', '30', '31', '32', '33', '34', '35', '36', '40', '50', '60', '61', '70'] };
  var TK_KEY = ['111', '112', '131', '133', '1331', '1332', '138', '141', '152', '154', '155', '156', '211', '214', '241', '242', '331', '333', '3331', '33311', '3334', '334', '335', '338', '3387', '341', '411', '413', '421', '511', '515', '521', '632', '635', '641', '642', '711', '811', '821', '911'];
  function codesFor(kind, regime, rules) { var rc = rules && rules.codes && rules.codes[regime] && rules.codes[regime][kind]; if (rc && rc.length) return rc.map(function (x) { return typeof x === 'object' ? String(x.code || x.ma) : String(x); }); var tbl = kind === 'bs' ? BS_CODES : kind === 'kq' ? KQ_CODES : CF_CODES; return tbl[regime] || tbl[regime === 'TT99' ? 'TT200' : 'TT133a'] || tbl.TT133a; }
  var GTGT_FIELDS = ['ct21', 'ct22', 'ct23', 'ct24', 'ct25', 'ct26', 'ct27', 'ct28', 'ct29', 'ct30', 'ct31', 'ct32', 'ct33', 'ct32a', 'ct34', 'ct35', 'ct36', 'ct37', 'ct38', 'ct39a', 'ct40a', 'ct40b', 'ct40', 'ct41', 'ct42', 'ct43'];
  var TNDN_FIELDS = ['A1', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'C1', 'C2', 'C3', 'C3a', 'C3b', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'D', 'E', 'G', 'H', 'I'];
  var PL_FIELDS = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
  /** Kiểm tra cú pháp toàn bộ biểu thức trong rules (dùng khi nạp rules3.json) */
  function lint(rules) {
    rules = rules || getRules(); var errs = [];
    if (rules.dialect === 'r3' && API.r3) return API.r3.lint3(rules);
    var chk = function (where, ex) { if (ex == null || ex === '' || typeof ex === 'boolean' || typeof ex === 'number') return; try { evaluate(ex, function () { return 0; }); } catch (e) { errs.push(where + ': ' + e.message); } };
    rules.criteria.forEach(function (c) { ['sl1', 'sl2', 'cl', 'value', 'extra'].forEach(function (k) { if (c[k]) chk(c.id + '.' + k, c[k].expr); }); (c.levels || []).forEach(function (l, i) { chk(c.id + '.levels[' + i + ']', l.when); }); ['gtgt', 'tndn', 'khac'].forEach(function (k) { chk(c.id + '.flags.' + k, (c.flags || {})[k]); chk(c.id + '.impact.' + k, (c.impact || {})[k]); }); (c.autoExplain || []).forEach(function (a, i) { chk(c.id + '.autoExplain[' + i + ']', a.expr); }); });
    Object.keys(rules.mapping || {}).forEach(function (k) { Object.keys(rules.mapping[k]).forEach(function (rg) { if (rg !== 'label' && typeof rules.mapping[k][rg] === 'string') chk('mapping.' + k + '.' + rg, rules.mapping[k][rg]); }); });
    (rules.indicators || []).forEach(function (i) { chk(i.id, i.expr); chk(i.id + '.warn', i.warn); });
    return errs;
  }
  var API = {
    gtgtExtras: gtgtExtras, priorFromColumns: priorFromColumns, defaultRegime: defaultRegime, regimeCodeLabel: regimeCodeLabel, REGIME_ORDER: REGIME_ORDER, REGIME_SHORT: REGIME_SHORT, convertCode: convertCode,
    evaluate: evaluate, normalizeRules: normalizeRules, setRules: setRules, getRules: getRules, regimeOf: regimeOf, REGIME_LABEL: REGIME_LABEL,
    buildFacts: buildFacts, makeLookup: makeLookup, sourceOf: sourceOf, evaluateYear: evaluateYear, evalCriterion: evalCriterion, score: score, indicators: indicators, compareYears: compareYears,
    finalBctcMerged: finalBctcMerged, hasAny: hasAny, codesFor: codesFor, TK_KEY: TK_KEY, GTGT_FIELDS: GTGT_FIELDS, TNDN_FIELDS: TNDN_FIELDS, PL_FIELDS: PL_FIELDS, TNDN_LBL: TNDN_LBL, PL_LBL: PL_LBL, AUDIT: AUDIT, REQ_LABEL: REQ_LABEL,
    fmt: fmt, fmtPct: fmtPct, fillText: fillText, lint: lint, kieuKyOf: kieuKyOf
  };
  API._E = E; API._sourceOfApp = sourceOfApp; API.isR3 = isR3;
  try { Risk3.install(API); } catch (e) { if (typeof console !== 'undefined') console.warn('risk3:', e.message); }
  return API;
})()

export default Risk
