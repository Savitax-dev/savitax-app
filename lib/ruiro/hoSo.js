// Hồ sơ khách nhiều năm trong bộ nhớ: {mst, regime, decls, tndnList, bctcList, tmList, years:{[y]:{inputs, overrides, notes}}}.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0; đã bỏ phần lưu IndexedDB/thư mục — Savitax chỉ đọc, không lưu.
const HoSo = (function () {
  'use strict';
  function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function nowIso() { return new Date().toISOString(); }
  function normMst(m) { return String(m || '').replace(/[^\d-]/g, ''); }
  function newClient(mst) { return { app: 'PhanTichRuiRoThue', version: 3, id: uid('kh'), mst: normMst(mst), tenNNT: '', dchi: '', nganh: '', regime: '', decls: [], tndnList: [], bctcList: [], tmList: [], files: [], years: {}, bench: {}, audit: [], createdAt: nowIso(), updatedAt: nowIso() }; }
  function yearData(c, y) { c.years = c.years || {}; var d = c.years[y] = c.years[y] || {}; d.inputs = d.inputs || {}; d.overrides = d.overrides || {}; d.notes = d.notes || {}; d.letter = d.letter || {}; return d; }
  function migrate(c) {
    if (!c || typeof c !== 'object') throw new Error('File hồ sơ không hợp lệ');
    if (c.app && c.app !== 'PhanTichRuiRoThue' && !c.decls) throw new Error('Không phải hồ sơ của app Phân tích rủi ro thuế');
    // hồ sơ từ app Check thuế GTGT (v2) — lấy tờ khai, QT, BCTC
    var o = Object.assign(newClient(c.mst), c);
    o.app = 'PhanTichRuiRoThue'; o.version = 3;
    ['decls', 'tndnList', 'bctcList', 'tmList', 'subLedgers', 'riskInvoices', 'files', 'audit'].forEach(function (k) { if (!Array.isArray(o[k])) o[k] = []; });
    if (!o.years || typeof o.years !== 'object') o.years = {};
    Object.keys(o.years).forEach(function (y) { yearData(o, y); });
    if (!o.bench) o.bench = {};
    if (c.invoices) delete o.invoices; if (c.bangkeFiles) delete o.bangkeFiles;
    return o;
  }
  function yearsOf(c) {
    var s = {};
    (c.decls || []).forEach(function (d) { if (d.nam) s[d.nam] = 1; });
    (c.tndnList || []).forEach(function (t) { if (t.nam) s[t.nam] = 1; });
    (c.bctcList || []).forEach(function (b) { if (b.nam) s[b.nam] = 1; });
    (c.tmList || []).forEach(function (b) { if (b.nam) s[b.nam] = 1; });
    Object.keys(c.years || {}).forEach(function (y) { var d = c.years[y]; if (d && (Object.keys(d.overrides || {}).length || d.pinned)) s[y] = 1; });
    return Object.keys(s).map(Number).filter(function (y) { return y > 1990 && y < 2200; }).sort();
  }
  function log(c, action, detail, user, year) { c.audit = c.audit || []; c.audit.push({ ts: nowIso(), action: action, detail: detail || '', user: user || '', year: year || null }); if (c.audit.length > 3000) c.audit = c.audit.slice(-3000); }
  function sameDecl(a, b) { return a.periodKey === b.periodKey && (+a.soLan || 0) === (+b.soLan || 0) && (a.loai || 'C') === (b.loai || 'C'); }
  /** Chữ ký nội dung tờ khai (khử trùng theo nội dung, không theo tên file) */
  function declSig(d) { var ct = d.ct || {}; return [d.mst, d.periodKey, d.loai, +d.soLan || 0, d.ngayLap || '', Object.keys(ct).sort().map(function (k) { return k + '=' + ct[k]; }).join(',')].join('|'); }
  /** Thêm tờ khai: trùng nội dung → bỏ qua ('dup'); cùng kỳ/lần khác nội dung → giữ bản ngày lập sau ('keptNewer'|'keptOld'); trả về {status, other} */
  function addDecl(c, d) {
    d.sig = declSig(d);
    var i = -1; c.decls.forEach(function (x, k) { if (sameDecl(x, d)) i = k; });
    if (i < 0) { c.decls.push(d); return { status: 'new' }; }
    var old = c.decls[i]; old.sig = old.sig || declSig(old);
    if (old.sig === d.sig) return { status: 'dup', other: old };
    var newer = String(d.ngayLap || '') + String(d.ngayKy || '') >= String(old.ngayLap || '') + String(old.ngayKy || '');
    if (newer) { d.replacedFile = (old.source || {}).fileName; c.decls[i] = d; return { status: 'keptNewer', other: old }; }
    old.ignoredFile = (d.source || {}).fileName; return { status: 'keptOld', other: old };
  }
  function addTndn(c, t) { var i = -1; c.tndnList.forEach(function (x, k) { if (+x.nam === +t.nam && (+x.soLan || 0) === (+t.soLan || 0)) i = k; }); if (i >= 0) c.tndnList[i] = t; else c.tndnList.push(t); return i >= 0; }
  function addBctc(c, b) {
    var key = function (x) { return [x.nam, x.form, (x.source || {}).fileName || '', x.ngayLap || ''].join('|'); };
    var i = -1; c.bctcList.forEach(function (x, k) { if (key(x) === key(b)) i = k; }); if (i >= 0) c.bctcList[i] = b; else c.bctcList.push(b); return i >= 0;
  }
  function addTm(c, t) { var i = -1; c.tmList.forEach(function (x, k) { if (+x.nam === +t.nam && ((x.source || {}).fileName || '') === ((t.source || {}).fileName || '')) i = k; }); if (i >= 0) c.tmList[i] = t; else c.tmList.push(t); return i >= 0; }
  /** Sổ chi tiết theo đối tượng: thay bản cùng TK + năm */
  function addLedger(c, d) { if (!Array.isArray(c.subLedgers)) c.subLedgers = []; d.id = d.id || uid('soct'); var i = -1; c.subLedgers.forEach(function (x, k) { if (String(x.acc) === String(d.acc) && +x.nam === +d.nam) i = k; }); if (i >= 0) c.subLedgers[i] = d; else c.subLedgers.push(d); return i >= 0; }
  /** Bảng kê HĐ rủi ro: thay bản cùng tên file + năm */
  function addRiskInvoices(c, d) { if (!Array.isArray(c.riskInvoices)) c.riskInvoices = []; d.id = d.id || uid('hdrr'); var i = -1; c.riskInvoices.forEach(function (x, k) { if (x.fileName === d.fileName && +x.nam === +d.nam) i = k; }); if (i >= 0) c.riskInvoices[i] = d; else c.riskInvoices.push(d); return i >= 0; }
  function removeDoc(c, kind, id) {
    var k = { GTGT: 'decls', TNDN: 'tndnList', BCTC: 'bctcList', TMBCTC: 'tmList', SOCT: 'subLedgers', HDRR: 'riskInvoices' }[kind];
    if (k && !Array.isArray(c[k])) c[k] = [];
    if (!k) return false; var before = c[k].length; c[k] = c[k].filter(function (x) { return x.id !== id; }); return c[k].length !== before;
  }
  function mergeClient(t, src) {
    var st = { decls: 0, tndn: 0, bctc: 0, tm: 0 };
    (src.decls || []).forEach(function (d) { var r = addDecl(t, d); if (r.status === 'new') st.decls++; });
    (src.tndnList || []).forEach(function (d) { if (!addTndn(t, d)) st.tndn++; });
    (src.bctcList || []).forEach(function (d) { if (!addBctc(t, d)) st.bctc++; });
    (src.tmList || []).forEach(function (d) { if (!addTm(t, d)) st.tm++; });
    (src.subLedgers || []).forEach(function (d) { addLedger(t, d); });
    (src.riskInvoices || []).forEach(function (d) { addRiskInvoices(t, d); });
    if (src.bcrr && !t.bcrr) t.bcrr = src.bcrr;
    Object.keys(src.years || {}).forEach(function (y) {
      var a = yearData(t, y), b = src.years[y];
      ['inputs', 'overrides', 'notes'].forEach(function (k) { Object.keys(b[k] || {}).forEach(function (kk) { if (a[k][kk] == null) a[k][kk] = b[k][kk]; }); });
      if (!a.letter.body && b.letter && b.letter.body) a.letter = b.letter;
    });
    t.audit = (t.audit || []).concat(src.audit || []).sort(function (a, b) { return String(a.ts).localeCompare(String(b.ts)); });
    return st;
  }
  function fileName(c) { return (normMst(c.mst) || 'chua-co-mst') + '.rrthue.json'; }
  function serialize(c) { return JSON.stringify(c, function (k, v) { return k === '_rev' || k === 'rawXml' ? undefined : v; }); }
  function clientMeta(c, extra) { return Object.assign({ id: c.id, mst: c.mst, tenNNT: c.tenNNT, updatedAt: c.updatedAt, years: yearsOf(c), nDocs: (c.decls || []).length + (c.tndnList || []).length + (c.bctcList || []).length }, extra || {}); }

  /* ---------- IndexedDB ---------- */
  return { declSig: declSig, newClient: newClient, migrate: migrate, yearData: yearData, yearsOf: yearsOf, log: log, addDecl: addDecl, addTndn: addTndn, addBctc: addBctc, addTm: addTm, addLedger: addLedger, addRiskInvoices: addRiskInvoices, removeDoc: removeDoc, mergeClient: mergeClient, fileName: fileName, serialize: serialize, clientMeta: clientMeta, normMst: normMst, uid: uid };
})()

export default HoSo
