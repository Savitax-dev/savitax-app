// Đọc tờ khai 01/GTGT, 03/TNDN (XML), tính lại chỉ tiêu, kỳ tính thuế, bản cuối cùng.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.

const Engine = (function () {
  'use strict';

  /* ===================== Tiện ích chung ===================== */
  var TOL = 0.5; // dung sai so sánh (đồng)

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function n(v) { return isNum(v) ? v : (v == null || v === '' ? 0 : (isFinite(+v) ? +v : 0)); }
  function r0(v) { return Math.round(n(v)); }
  function r2(v) { return Math.round(n(v) * 100) / 100; }
  function nz(v) { return Math.abs(n(v)) >= TOL; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function pad2(x) { x = String(x); return x.length < 2 ? '0' + x : x; }
  function uid(p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  /** Số từ XML ("1234567", "1234567.89", "-12") */
  function parseXmlNumber(s) {
    if (s == null) return 0;
    s = String(s).trim();
    if (!s) return 0;
    var v = parseFloat(s.replace(/\s/g, '').replace(/,/g, ''));
    return isFinite(v) ? v : 0;
  }

  /** Số dạng hiển thị vi-VN/en: "1.234.567", "1,234,567", "(1.234)", "-1.234,5" */
  function parseViNumber(s) {
    if (s == null) return null;
    s = String(s).trim();
    if (!s) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[\s ]/g, '');
    if (/^\+/.test(s)) s = s.replace(/^\++/, '');
    if (/^[-−–]/.test(s)) { neg = !neg; s = s.replace(/^[-−–]+/, ''); }
    if (!/^[\d.,]+$/.test(s)) return null;
    var lastDot = s.lastIndexOf('.'), lastCom = s.lastIndexOf(',');
    var intPart = s, dec = '';
    if (lastDot >= 0 && lastCom >= 0) {
      var sep = lastDot > lastCom ? '.' : ',';
      var i = s.lastIndexOf(sep);
      intPart = s.slice(0, i); dec = s.slice(i + 1);
    } else if (lastDot >= 0 || lastCom >= 0) {
      var sp = lastDot >= 0 ? '.' : ',';
      var parts = s.split(sp);
      var grouped = parts.length > 1 && parts.slice(1).every(function (p) { return p.length === 3; }) && parts[0].length <= 3 && parts[0].length > 0;
      if (grouped) { intPart = parts.join(''); dec = ''; }
      else if (parts.length === 2) { intPart = parts[0]; dec = parts[1]; }
      else { intPart = parts.join(''); }
    }
    intPart = intPart.replace(/[.,]/g, '');
    var v = parseFloat(intPart + (dec ? '.' + dec : ''));
    if (!isFinite(v)) return null;
    return neg ? -v : v;
  }

  function fmtNum(v, digits) {
    if (v == null || v === '' || !isFinite(+v)) return '';
    v = +v;
    var d = digits || 0;
    var neg = v < 0; v = Math.abs(v);
    var s = v.toFixed(d);
    var ip = s.split('.')[0], dp = s.split('.')[1];
    ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var out = ip + (dp ? ',' + dp : '');
    if (neg && /[1-9]/.test(out)) out = '-' + out;
    return out;
  }

  /* ---------- Ngày ---------- */
  // ISO 'yyyy-mm-dd' nội bộ; hiển thị 'dd/mm/yyyy'
  function validYmd(y, mo, da) { y = +y; mo = +mo; da = +da; return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && da >= 1 && da <= new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
  /** Chuẩn hoá ngày về ISO; ngày không có thật (31/02, 15/13…) → '' */
  function toIso(d) {
    if (!d) return '';
    if (d instanceof Date) return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
    d = String(d).trim();
    var m;
    if ((m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return validYmd(m[1], m[2], m[3]) ? m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]) : '';
    if ((m = d.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) return validYmd(m[3], m[2], m[1]) ? m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]) : '';
    return '';
  }
  function fmtDate(iso) {
    iso = toIso(iso);
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function dateObj(iso) { iso = toIso(iso); if (!iso) return null; var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function addDays(iso, k) { var d = dateObj(iso); if (!d) return ''; d.setUTCDate(d.getUTCDate() + k); return toIso(d); }
  function addYears(iso, k) { var d = dateObj(iso); if (!d) return ''; var y = d.getUTCFullYear() + k, m = d.getUTCMonth(), day = d.getUTCDate(); var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return toIso(new Date(Date.UTC(y, m, Math.min(day, last)))); }
  function diffDays(a, b) { var da = dateObj(a), db = dateObj(b); if (!da || !db) return 0; return Math.round((db - da) / 86400000); }
  function lastDayOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m: 1..12
  function todayIso() { return toIso(new Date(Date.now() + 7 * 3600000)); }

  /* ---------- Kỳ tính thuế ---------- */
  // key: '2024-Q1' | '2024-M09'
  function periodKey(kieuKy, ky, nam) { return nam + '-' + (kieuKy === 'M' ? 'M' + pad2(ky) : 'Q' + ky); }
  function parsePeriodKey(key) {
    var m = String(key || '').match(/^(\d{4})-([QM])(\d{1,2})$/);
    if (!m) return null;
    return { nam: +m[1], kieuKy: m[2], ky: +m[3], key: key };
  }
  function periodLabel(key) {
    var p = parsePeriodKey(key); if (!p) return key || '';
    return p.kieuKy === 'M' ? 'T' + pad2(p.ky) + '/' + p.nam : 'Q' + p.ky + '/' + p.nam;
  }
  function periodShort(key) { // 'Q1.24' như sheet CT37-38
    var p = parsePeriodKey(key); if (!p) return key || '';
    return (p.kieuKy === 'M' ? 'T' + pad2(p.ky) : 'Q' + p.ky) + '.' + String(p.nam).slice(-2);
  }
  function periodDot(key) { // 'Q1.2024' như sheet VAT PHAI NOP
    var p = parsePeriodKey(key); if (!p) return key || '';
    return (p.kieuKy === 'M' ? 'T' + pad2(p.ky) : 'Q' + p.ky) + '.' + p.nam;
  }
  function periodRange(key) {
    var p = parsePeriodKey(key); if (!p) return null;
    var m1 = p.kieuKy === 'M' ? p.ky : (p.ky - 1) * 3 + 1;
    var m2 = p.kieuKy === 'M' ? p.ky : m1 + 2;
    return { from: p.nam + '-' + pad2(m1) + '-01', to: p.nam + '-' + pad2(m2) + '-' + pad2(lastDayOfMonth(p.nam, m2)) };
  }
  function prevPeriod(key) {
    var p = parsePeriodKey(key); if (!p) return null;
    var max = p.kieuKy === 'M' ? 12 : 4;
    return p.ky > 1 ? periodKey(p.kieuKy, p.ky - 1, p.nam) : periodKey(p.kieuKy, max, p.nam - 1);
  }
  function nextPeriod(key) {
    var p = parsePeriodKey(key); if (!p) return null;
    var max = p.kieuKy === 'M' ? 12 : 4;
    return p.ky < max ? periodKey(p.kieuKy, p.ky + 1, p.nam) : periodKey(p.kieuKy, 1, p.nam + 1);
  }
  function periodOfDate(iso, kieuKy) {
    iso = toIso(iso); if (!iso) return null;
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    return kieuKy === 'M' ? periodKey('M', m, y) : periodKey('Q', Math.floor((m - 1) / 3) + 1, y);
  }
  function comparePeriodKey(a, b) {
    var pa = parsePeriodKey(a), pb = parsePeriodKey(b);
    if (!pa || !pb) return String(a).localeCompare(String(b));
    var ra = periodRange(a).from, rb = periodRange(b).from;
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  }
  function periodsForYear(year, kieuKy, includePrev) {
    var out = [], max = kieuKy === 'M' ? 12 : 4;
    if (includePrev) out.push(periodKey(kieuKy, max, year - 1));
    for (var i = 1; i <= max; i++) out.push(periodKey(kieuKy, i, year));
    return out;
  }

  /* ===================== Chỉ tiêu 01/GTGT ===================== */
  var CT_DEFS = [
    { key: 'ct21', code: '21', input: true, name: 'Không phát sinh hoạt động mua, bán trong kỳ (đánh dấu "X")' },
    { key: 'ct22', code: '22', input: true, name: 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang' },
    { key: 'ct23', code: '23', input: true, name: 'Giá trị hàng hóa, dịch vụ mua vào trong kỳ' },
    { key: 'ct24', code: '24', input: true, name: 'Thuế GTGT của hàng hóa, dịch vụ mua vào trong kỳ' },
    { key: 'ct23a', code: '23a', input: true, name: 'Trong đó: Giá trị hàng hóa, dịch vụ nhập khẩu' },
    { key: 'ct24a', code: '24a', input: true, name: 'Trong đó: Thuế GTGT hàng hóa, dịch vụ nhập khẩu' },
    { key: 'ct25', code: '25', input: true, name: 'Thuế GTGT của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này' },
    { key: 'ct26', code: '26', input: true, name: 'Hàng hóa, dịch vụ bán ra không chịu thuế GTGT' },
    { key: 'ct27', code: '27', input: false, name: 'Hàng hóa, dịch vụ bán ra chịu thuế GTGT ([27]=[29]+[30]+[32]+[32a])' },
    { key: 'ct28', code: '28', input: false, name: 'Thuế GTGT của HHDV bán ra chịu thuế ([28]=[31]+[33])' },
    { key: 'ct29', code: '29', input: true, name: 'Hàng hóa, dịch vụ bán ra chịu thuế suất 0%' },
    { key: 'ct30', code: '30', input: true, name: 'Hàng hóa, dịch vụ bán ra chịu thuế suất 5% (doanh thu)' },
    { key: 'ct31', code: '31', input: true, name: 'Thuế GTGT hàng hóa, dịch vụ bán ra chịu thuế suất 5%' },
    { key: 'ct32', code: '32', input: true, name: 'Hàng hóa, dịch vụ bán ra chịu thuế suất 10% (doanh thu, gồm 8%)' },
    { key: 'ct33', code: '33', input: true, name: 'Thuế GTGT hàng hóa, dịch vụ bán ra chịu thuế suất 10% (gồm 8%)' },
    { key: 'ct32a', code: '32a', input: true, name: 'Hàng hóa, dịch vụ bán ra không phải kê khai, tính nộp thuế GTGT' },
    { key: 'ct32b', code: '32b', input: true, tt89: true, name: 'HHDV bán ra không tính vào giá tính thuế (mẫu TT 89/2026)' },
    { key: 'ct34a', code: '34a', input: true, tt89: true, name: 'Doanh thu ngoài phạm vi chịu thuế GTGT (mẫu TT 89/2026)' },
    { key: 'ct34', code: '34', input: false, name: 'Tổng doanh thu hàng hóa, dịch vụ bán ra ([34]=[26]+[27](+[34a]))' },
    { key: 'ct35', code: '35', input: false, name: 'Tổng thuế GTGT của hàng hóa, dịch vụ bán ra ([35]=[28])' },
    { key: 'ct36', code: '36', input: false, name: 'Thuế GTGT phát sinh trong kỳ ([36]=[35]-[25])' },
    { key: 'ct37', code: '37', input: true, name: 'Điều chỉnh giảm thuế GTGT còn được khấu trừ của các kỳ trước' },
    { key: 'ct38', code: '38', input: true, name: 'Điều chỉnh tăng thuế GTGT còn được khấu trừ của các kỳ trước' },
    { key: 'ct39a', code: '39a', input: true, name: 'Thuế GTGT nhận bàn giao được khấu trừ trong kỳ' },
    { key: 'ct40a', code: '40a', input: false, name: 'Thuế GTGT phải nộp của hoạt động SXKD trong kỳ ([40a]=[36]-[22]+[37]-[38]-[39a] ≥ 0)' },
    { key: 'ct40b', code: '40b', input: true, name: 'Thuế GTGT mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt động SXKD cùng kỳ' },
    { key: 'ct40', code: '40', input: false, name: 'Thuế GTGT còn phải nộp trong kỳ ([40]=[40a]-[40b])' },
    { key: 'ct41', code: '41', input: false, name: 'Thuế GTGT chưa khấu trừ hết kỳ này ([41]=[36]-[22]+[37]-[38]-[39a] < 0)' },
    { key: 'ct42', code: '42', input: true, name: 'Thuế GTGT đề nghị hoàn' },
    { key: 'ct43', code: '43', input: false, name: 'Thuế GTGT còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42])' }
  ];
  var CT_KEYS = CT_DEFS.map(function (d) { return d.key; });
  var CT_BY_KEY = {}; CT_DEFS.forEach(function (d) { CT_BY_KEY[d.key] = d; });
  var INPUT_KEYS = CT_DEFS.filter(function (d) { return d.input; }).map(function (d) { return d.key; });
  function ctKeyFromCode(code) { code = String(code).replace(/[\[\]\s]/g, '').toLowerCase(); return CT_BY_KEY['ct' + code] ? 'ct' + code : null; }

  function emptyCt() { var o = {}; CT_KEYS.forEach(function (k) { o[k] = 0; }); return o; }

  /** Tính lại các chỉ tiêu dẫn xuất từ chỉ tiêu nhập. Trả về object mới. */
  function recompute(ct) {
    var c = emptyCt();
    ct = ct || {};
    INPUT_KEYS.forEach(function (k) { c[k] = n(ct[k]); });
    c.ct27 = r2(c.ct29 + c.ct30 + c.ct32 + c.ct32a - c.ct32b); // TT89: −[32b] (TT80: [32b]=0)
    c.ct28 = r2(c.ct31 + c.ct33);
    c.ct34 = r2(c.ct26 + c.ct27 + c.ct34a); // TT89: +[34a]
    c.ct35 = r2(c.ct28);
    c.ct36 = r2(c.ct35 - c.ct25);
    var x = r2(c.ct36 - c.ct22 + c.ct37 - c.ct38 - c.ct39a);
    c.ct40a = x > 0 ? x : 0;
    c.ct41 = x < 0 ? -x : 0;
    c.ct40 = r2(c.ct40a - c.ct40b);
    c.ct43 = r2(c.ct41 - c.ct42);
    return c;
  }

  /* ===================== Bộ quy tắc (dữ liệu hoá) ===================== */
  /* Lược đồ theo spec/rules.json (agent chính sách). DEFAULT_RULES chỉ là bản dự phòng rút gọn khi không có rules.json. */
  var RATE_LIST = [
    { id: 'KCT', label: 'Không chịu thuế', pct: 0 },
    { id: '0', label: '0%', pct: 0 },
    { id: '5', label: '5%', pct: 5 },
    { id: '8', label: '8% (giảm thuế)', pct: 8, validFrom: '2022-02-01', validTo: '2026-12-31' },
    { id: '10', label: '10%', pct: 10 },
    { id: 'KKKTT', label: 'Không phải kê khai, tính nộp ([32a])', pct: 0 },
    { id: 'KTVGTT', label: 'Không tính vào giá tính thuế ([32b] – TT89)', pct: 0 },
    { id: 'NGOAIPV', label: 'Ngoài phạm vi ([34a] – TT89)', pct: 0 }
  ];
  var RATE_ALIAS = { KTT: 'KKKTT', '32a': 'KKKTT', '10%': '10', '8%': '8', '5%': '5', '0%': '0' };
  function byRateTbl(sign) {
    var s = sign;
    return {
      '10': [{ ct: 'ct32', sign: s, field: 'base' }, { ct: 'ct33', sign: s, field: 'tax' }],
      '8': [{ ct: 'ct32', sign: s, field: 'base' }, { ct: 'ct33', sign: s, field: 'tax' }],
      '5': [{ ct: 'ct30', sign: s, field: 'base' }, { ct: 'ct31', sign: s, field: 'tax' }],
      '0': [{ ct: 'ct29', sign: s, field: 'base' }], KCT: [{ ct: 'ct26', sign: s, field: 'base' }],
      KKKTT: [{ ct: 'ct32a', sign: s, field: 'base' }], KTVGTT: [{ ct: 'ct32b', sign: s, field: 'base' }], NGOAIPV: [{ ct: 'ct34a', sign: s, field: 'base' }]
    };
  }
  var DEFAULT_RULES = {
    meta: { name: 'Bộ quy tắc mặc định (dự phòng)', version: 'mac-dinh-2026.10', note: 'Chỉ dùng khi không có rules.json.', verifyLevels: { XM: 'đã xác minh', TC: 'nguồn thứ cấp', CXM: 'chưa chắc chắn' } },
    legalBasis: [
      { code: 'LQLT-108-2025', title: 'Luật Quản lý thuế số 108/2025/QH15', article: 'Đ12 k5 (khai bổ sung 05 năm)', effective: '2026-07-01', verify: 'TC' },
      { code: 'TT-89-2026', title: 'Thông tư 89/2026/TT-BTC', article: 'Mẫu 01/GTGT, 01/KHBS, 01-1/KHBS', effective: '2026-07-01', verify: 'TC' },
      { code: 'TT-91-2026', title: 'Thông tư 91/2026/TT-BTC', article: 'Hóa đơn điều chỉnh', effective: '2026-07-01', verify: 'TC' },
      { code: 'ND-252-2026', title: 'Nghị định 252/2026/NĐ-CP', article: 'Khai bổ sung, hạn nộp, chậm nộp', effective: '2026-07-01', verify: 'TC' },
      { code: 'ND-181-2025', title: 'Nghị định 181/2025/NĐ-CP (sửa bởi NĐ 144/2026)', article: 'Khấu trừ thuế GTGT', effective: '2025-07-01', verify: 'TC' },
      { code: 'NQ-204-2025', title: 'NQ 204/2025/QH15 & NĐ 174/2025/NĐ-CP', article: 'Giảm thuế suất 8% đến 31/12/2026', effective: '2025-07-01', verify: 'TC' },
      { code: 'ND-125-2020-310-2025', title: 'Nghị định 125/2020/NĐ-CP sửa bởi NĐ 310/2025/NĐ-CP', article: 'Xử phạt vi phạm hành chính thuế', effective: '2026-01-16', verify: 'TC' }
    ],
    formulas: { tolerance: 1, notes: { excel_bug: 'Sheet CHECK TK dùng [41]=MAX([22]+[25]-[35],0), bỏ sót 37/38/39a' } },
    errorTypes: [
      { id: 'OUT_MISSED', label: 'Bỏ sót hóa đơn bán ra', defaultTreatment: 'TKBS', ctMapping: { byRate: byRateTbl('+') }, legalRef: ['LQLT-108-2025 Đ12 k5'], verify: 'TC' },
      { id: 'OUT_OVER', label: 'Khai thừa doanh thu/thuế bán ra', defaultTreatment: 'TKBS', ctMapping: { byRate: byRateTbl('-') }, legalRef: ['LQLT-108-2025 Đ12 k5'], verify: 'TC' },
      { id: 'IN_MISSED', label: 'Bỏ sót hóa đơn mua vào', defaultTreatment: 'CURRENT_PERIOD', ctMapping: { current: [{ ct: 'ct38', sign: '+', field: 'tax' }], alternative_CXM: [{ ct: 'ct23', sign: '+', field: 'base' }, { ct: 'ct24', sign: '+', field: 'tax' }, { ct: 'ct25', sign: '+', field: 'tax' }] }, legalRef: ['ND-181-2025 Đ23 k6 b'], verify: 'TC' },
      { id: 'IN_OVER', label: 'Khai thừa / không đủ điều kiện khấu trừ đầu vào', defaultTreatment: 'SIMULATE', ctMapping: { tkbs: [{ ct: 'ct25', sign: '-', field: 'tax' }, { ct: 'ct24', sign: '-', field: 'tax' }, { ct: 'ct23', sign: '-', field: 'base' }], current: [{ ct: 'ct37', sign: '+', field: 'tax' }] }, legalRef: ['ND-181-2025 Đ23 k6 a,b'], verify: 'TC' },
      { id: 'NO_TAX_EFFECT', label: 'Sai chỉ tiêu không ảnh hưởng thuế', defaultTreatment: 'TKBS', ctMapping: { manual: true }, verify: 'CXM' },
      { id: 'OTHER', label: 'Khác', defaultTreatment: 'USER_CHOICE', ctMapping: { manual: true }, verify: '-' }
    ],
    caseRules: { epsilon: 0, evaluationOrder: ['TH7', 'TH5', 'TH6', 'TH1', 'TH2', 'TH3', 'TH4', 'TH_MIXED'], flags: [], ct3738Rule: { ct37: 'max(0, old43-new43)', ct38: 'max(0, new43-old43)' } },
    cases: [
      { id: 'TH1', name: 'Tăng số thuế GTGT phải nộp', condition: 'delta40>0 && delta43==0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS', 'Nộp thêm tiền thuế chênh lệch', 'Nộp tiền chậm nộp'], affectsCT37or38: 'none', lateInterest: 'delta40' },
      { id: 'TH2', name: 'Giảm số thuế GTGT phải nộp', condition: 'delta40<0 && delta43==0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS'], affectsCT37or38: 'none', lateInterest: '0' },
      { id: 'TH3', name: 'Tăng số thuế GTGT được khấu trừ', condition: 'delta43>0 && delta40==0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS', 'Ghi [38] kỳ hiện tại'], affectsCT37or38: 'CT38', lateInterest: '0' },
      { id: 'TH4', name: 'Giảm số thuế GTGT được khấu trừ', condition: 'delta43<0 && delta40==0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS', 'Ghi [37] kỳ hiện tại'], affectsCT37or38: 'CT37', lateInterest: '0' },
      { id: 'TH5', name: 'Giảm số thuế GTGT được khấu trừ đến mức phải nộp', condition: 'delta43<0 && delta40>0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS', 'Ghi [37] kỳ hiện tại = [43] cũ − [43] mới', 'Nộp thêm tiền thuế + tiền chậm nộp'], affectsCT37or38: 'CT37', lateInterest: 'delta40' },
      { id: 'TH6', name: 'Giảm số thuế GTGT phải nộp đến mức được khấu trừ', condition: 'delta40<0 && delta43>0', actions: ['Lập TKBS', 'Giải trình trên PL KHBS', 'Ghi [38] kỳ hiện tại = [43] mới − [43] cũ'], affectsCT37or38: 'CT38', lateInterest: '0' },
      { id: 'TH7', name: 'Điều chỉnh không ảnh hưởng thuế được khấu trừ hay phải nộp', condition: 'delta40==0 && delta43==0', actions: ['Lập TKBS (hoặc chỉ bản giải trình)'], affectsCT37or38: 'none', lateInterest: '0' },
      { id: 'TH_MIXED', name: 'Chênh lệch [40] và [43] cùng dấu (bất thường)', condition: '(delta40>0 && delta43>0) || (delta40<0 && delta43<0)', actions: ['Xử lý Δ40 như TH1/TH2 và Δ43 như TH3/TH4', 'Kiểm tra lại'], affectsCT37or38: 'by delta43', lateInterest: 'max(0,delta40)' }
    ],
    lateInterest: { ratePerDay: 0.0003, endRule: 'Ngày liền kề trước ngày nộp tiền vào NSNN', daysFormula: 'days = (payDate - dueDate) - 1', legalRef: 'LQLT-108-2025 Đ16 k2' },
    penalties: [],
    deadlines: { holidayShift: { rule: 'Trùng ngày nghỉ → ngày làm việc liền kề sau', userEditable: true }, supplementWindowYears: 5, nearExpiryWarnDays: 90, rate8pctUntil: '2026-12-31' },
    ct37ct38Templates: [],
    warnings: [],
    uncertainties: [],
    treatmentEnum: { TKBS: 'Lập tờ khai bổ sung kỳ gốc', CURRENT_PERIOD: 'Kê khai tại kỳ hiện tại, không TKBS', SIMULATE: 'Mô phỏng TKBS kỳ gốc rồi chọn', USER_CHOICE: 'Người dùng chọn' },
    khbs: {}
  };

  /* Ngày nghỉ lễ (gần đúng — người dùng sửa hạn nộp từng kỳ khi cần) */
  var HOLIDAYS = (function () {
    var s = {}, add = function (a, b) { var d = a; while (d <= b) { s[d] = 1; d = addDays(d, 1); } };
    ['2024', '2025', '2026', '2027', '2028'].forEach(function (y) { s[y + '-01-01'] = 1; s[y + '-04-30'] = 1; s[y + '-05-01'] = 1; s[y + '-09-02'] = 1; });
    add('2024-02-08', '2024-02-14'); s['2024-04-18'] = 1; s['2024-04-29'] = 1; s['2024-09-03'] = 1;
    add('2025-01-25', '2025-02-02'); s['2025-04-07'] = 1; s['2025-09-01'] = 1;
    add('2026-02-14', '2026-02-22'); s['2026-04-27'] = 1; s['2026-09-01'] = 1;
    add('2027-02-05', '2027-02-10'); s['2027-04-16'] = 1;
    return s;
  })();

  var RULES = null;

  function normTreatment(h) {
    h = String(h || '').toUpperCase();
    if (/SIMUL/.test(h)) return 'SIMULATE';
    if (/USER|CHOICE/.test(h)) return 'USER';
    if (/CURRENT|HIEN_TAI|PHAT_HIEN|DETECT/.test(h)) return 'CURRENT';
    if (/TKBS|BO_?SUNG|SUPP|AMEND/.test(h)) return 'TKBS';
    return h || 'TKBS';
  }
  /** Chuẩn hoá cấu hình quy tắc (rules.json của agent chính sách hoặc bản dự phòng) */
  function normalizeRules(raw) {
    raw = clone(raw || DEFAULT_RULES);
    var base = clone(DEFAULT_RULES), out = {};
    Object.keys(base).forEach(function (k) { out[k] = raw[k] != null ? raw[k] : base[k]; });
    Object.keys(raw).forEach(function (k) { if (out[k] == null) out[k] = raw[k]; });
    out.meta = Object.assign({}, base.meta, raw.meta || {});
    out.version = out.meta.version || raw.version || '';
    out.rates = raw.rates || RATE_LIST;
    // errorTypes
    var et = Array.isArray(out.errorTypes) ? out.errorTypes : Object.keys(out.errorTypes || {}).map(function (id) { var o = out.errorTypes[id]; o.id = o.id || id; return o; });
    out.errorTypes = et.map(function (t) {
      t = Object.assign({}, t);
      t.label = t.label || t.name || t.id;
      var m = t.ctMapping || {};
      if (Array.isArray(m)) m = { tkbs: m, current: m };
      t.ctMapping = m;
      t.treatment = normTreatment(t.defaultTreatment || t.defaultHandling || 'TKBS');
      t.defaultHandling = t.treatment === 'USER' ? 'TKBS' : t.treatment;
      t.needsRate = !!(m.byRate || m.byRate_signed);
      t.needsRateTo = Object.keys(m).some(function (k) { return /^\w+to\w+$/.test(k); });
      t.ratePairs = Object.keys(m).filter(function (k) { return /^\w+to\w+$/.test(k); });
      // Bổ sung cặp thuế suất đầu ra dựng tự động (OUT_RATE_CT) khi rules.json chưa liệt kê, ví dụ 0% → 8% (tour 0% sai — rules2 IC-ZERO-01)
      if (t.id === 'RATE_OUT_UNDER') ['0to8', '0to10', '0to5', 'KCTto8', 'KCTto10', '5to8'].forEach(function (k) { if (t.ratePairs.indexOf(k) < 0) t.ratePairs.push(k); });
      if (t.id === 'RATE_OUT_OVER') ['8to0', '10to0', '10to8', '8to5'].forEach(function (k) { if (t.ratePairs.indexOf(k) < 0) t.ratePairs.push(k); });
      t.needsDirection = !!(m.increase || m.decrease || m.decrease_current || m.decrease_tkbs);
      t.signed = !!m.byRate_signed || JSON.stringify(m).indexOf('±') >= 0;
      t.custom = !!m.manual;
      t.hasAlt = !!m.alternative_CXM;
      t.basis = Array.isArray(t.legalRef) ? t.legalRef.join('; ') : (t.legalRef || t.basis || '');
      t.hint = humanize(t.treatmentConditions || t.hint || '');
      t.notesText = humanize(t.notes || '');
      return t;
    });
    // cases
    var cs = Array.isArray(out.cases) ? out.cases : Object.keys(out.cases || {}).map(function (id) { var o = out.cases[id]; o.id = o.id || id; return o; });
    var order = (out.caseRules && out.caseRules.evaluationOrder) || base.caseRules.evaluationOrder;
    out.cases = cs.map(function (c) {
      c = Object.assign({}, c);
      c.name = humanize(c.name || c.title || c.id);
      c.when = c.condition || c.when || '';
      c.stepsRaw = c.actions || c.steps || [];
      c.steps = c.stepsRaw.map(humanize);
      c.whenText = humanize(c.condition || c.when || '');
      c.lateInterestText = humanize(c.lateInterest);
      var a = String(c.affectsCT37or38 || c.effect || 'none').toUpperCase();
      c.effect = /37/.test(a) ? 'CT37' : /38/.test(a) ? 'CT38' : /DELTA43/.test(a) ? 'BY43' : 'NONE';
      c.effectText = c.effect === 'CT37' ? 'Ảnh hưởng CT37 kỳ hiện tại' + (c.ct37 && c.ct37 !== '0' ? ' (= ' + humanize(c.ct37) + ')' : '') : c.effect === 'CT38' ? 'Ảnh hưởng CT38 kỳ hiện tại' + (c.ct38 && c.ct38 !== '0' ? ' (= ' + humanize(c.ct38) + ')' : '') : c.effect === 'BY43' ? 'CT37/CT38 theo Δ43' : 'Không ảnh hưởng CT37, CT38 kỳ hiện tại';
      c.payment = /delta40/.test(String(c.lateInterest || ''));
      return c;
    }).sort(function (a, b) { var ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    out.caseRules = Object.assign({}, base.caseRules, out.caseRules || {});
    // lateInterest
    var li = Object.assign({}, base.lateInterest, out.lateInterest || {});
    if (li.ratePerDay == null && li.rate != null) li.ratePerDay = li.rate > 0.01 ? li.rate / 100 : li.rate;
    li.dayBeforePayment = li.mode ? li.mode === 'dayBeforePayment' : /liền kề trước|liền trước|- *1|dayBefore/i.test(String(li.endRule || '') + ' ' + String(li.daysFormula || ''));
    li.daysFormula = humanize(li.daysFormula || '');
    li.basis = li.basis || [li.legalRef, li.daysFormula].filter(Boolean).join(' — ');
    out.lateInterest = li;
    var dl = Object.assign({}, base.deadlines, out.deadlines || {});
    dl.shiftHolidays = dl.shiftHolidays != null ? dl.shiftHolidays : !!dl.holidayShift;
    dl.limitYears = dl.supplementWindowYears || 5;
    dl.nearDays = dl.nearExpiryWarnDays || 90;
    dl.holidays = dl.holidays || [];
    out.deadlines = dl;
    out.supplement = { limitYears: dl.limitYears, basis: dl.supplementWindowLegalRef || 'LQLT-108-2025 Đ12 k5' };
    out.penalties = Array.isArray(out.penalties) ? out.penalties : [];
    out.penalty20 = out.penalties.filter(function (p) { return /20/.test(p.id || '') || p.rate === 0.2; })[0] || { rate: 0.2, legalRef: 'NĐ 125/2020 Đ16' };
    out.warningsById = {}; (out.warnings || []).forEach(function (w) { out.warningsById[w.id] = w; });
    out.templatesById = {}; (out.ct37ct38Templates || []).forEach(function (t) { out.templatesById[t.id] = t; });
    out.legalBasis = (out.legalBasis || []).map(function (l) { return Object.assign({ code: l.id || l.code, title: l.title, article: l.article || '', note: l.note || '', verify: l.verify || '' }, l); });
    out.uncertainties = out.uncertainties || [];
    out.tolerance = (out.formulas && out.formulas.tolerance) || 1;
    out.prev43Basis = raw.prev43Basis || 'original';
    return out;
  }
  /** Đọc ô chi tiết sai sót "26:-15000000; 32a:+15.000.000" → {items:[{ct,delta}], errors:[...]} */
  function parseCustomDeltas(text) {
    var items = [], errors = [];
    String(text || '').split(/[;\n]+/).forEach(function (seg) {
      seg = seg.trim(); if (!seg) return;
      var m = seg.match(/^\[?\s*(?:ct)?\s*(\d{2}[ab]?)\s*\]?\s*[:=]\s*(.+)$/i);
      if (!m) { errors.push('"' + seg + '" (cần dạng mã:số, ví dụ 32a:+15.000.000)'); return; }
      var k = ctKeyFromCode(m[1]);
      if (!k) { errors.push('mã chỉ tiêu [' + m[1] + '] không tồn tại'); return; }
      if (!CT_BY_KEY[k].input) { errors.push('[' + m[1] + '] là chỉ tiêu tính toán'); return; }
      var v = parseViNumber(m[2].replace(/\s+/g, '').replace(/đ|vnd/gi, ''));
      if (v == null) { errors.push('số "' + m[2].trim() + '" của [' + m[1] + '] không hợp lệ'); return; }
      items.push({ ct: k, delta: v });
    });
    return { items: items, errors: errors };
  }
  /** Đổi biến kỹ thuật trong rules sang tiếng Việt dễ đọc */
  function humanize(t) {
    return String(t == null ? '' : t)
      .replace(/days\s*=\s*\(payDate\s*-\s*dueDate\)\s*-\s*1/g, 'số ngày = (ngày nộp − hạn nộp) − 1').replace(/\bdelta40\s*×/g, 'chênh lệch [40] ×')
      .replace(/Δ\s?(4[0-3])/g, 'chênh lệch [$1]').replace(/max\(0,\s*-?delta40\)/g, 'phần [40] tăng thêm').replace(/max\(0,\s*-delta43\)/g, 'phần [43] giảm').replace(/max\(0,\s*delta43\)/g, 'phần [43] tăng')
      .replace(/old43\s*-\s*new43/g, '[43] cũ − [43] mới').replace(/new43\s*-\s*old43/g, '[43] mới − [43] cũ').replace(/old42\s*-\s*new41/g, '[42] cũ − [41] mới')
      .replace(/-delta43/g, 'mức giảm [43]').replace(/-delta40/g, 'mức giảm [40]').replace(/absDelta40/g, 'mức giảm [40]')
      .replace(/delta40/g, 'chênh lệch [40]').replace(/delta43/g, 'chênh lệch [43]').replace(/delta42/g, 'chênh lệch [42]')
      .replace(/\b(old|new)(4[0-3])\b/g, function (_, a, c) { return '[' + c + '] ' + (a === 'old' ? 'cũ' : 'mới'); })
      .replace(/\bct(\d{2}[ab]?)\b/g, '[$1]').replace(/CURRENT_PERIOD/g, 'kỳ hiện tại').replace(/REFUND_DOWN/g, 'giảm số được hoàn')
      .replace(/\(rủi ro W-PROP\)/g, '(có rủi ro chậm nộp kỳ trung gian)').replace(/W-PROP/g, 'rủi ro chậm nộp kỳ trung gian')
      .replace(/\s*\+=\s*/g, ' cộng thêm ').replace(/&&/g, ' và ').replace(/\|\|/g, ' hoặc ').replace(/==\s*0/g, '= 0');
  }
  function setRules(raw) { RULES = normalizeRules(raw); return RULES; }
  function getRules() { return RULES; }
  function errorTypeById(id) { for (var i = 0; i < RULES.errorTypes.length; i++) if (RULES.errorTypes[i].id === id) return RULES.errorTypes[i]; return null; }
  function normRate(id) { id = id == null ? '' : String(id).trim(); return RATE_ALIAS[id] || RATE_ALIAS[id.toUpperCase()] || id; }
  function rateById(id) { id = normRate(id); var rs = RULES.rates || RATE_LIST; for (var i = 0; i < rs.length; i++) if (String(rs[i].id) === id) return rs[i]; return null; }
  function ratePct(id) { var r = rateById(id); if (r) return n(r.pct); var v = parseFloat(id); return isFinite(v) ? v : 0; }

  /* ---------- Bộ tính biểu thức an toàn (cho điều kiện/ánh xạ trong rules) ---------- */
  function evalExpr(expr, vars) {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'boolean') return expr;
    var src = String(expr == null ? '' : expr), pos = 0;
    var toks = [], re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|>=|<=|[-+*\/()<>!,?:%])/y;
    while (pos < src.length) {
      re.lastIndex = pos; var m = re.exec(src);
      if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error('Biểu thức không hợp lệ: ' + src); }
      toks.push(m[1]); pos = re.lastIndex;
    }
    var i = 0;
    function peek() { return toks[i]; }
    function next() { return toks[i++]; }
    var FN = { abs: Math.abs, max: Math.max, min: Math.min, round: Math.round };
    function primary() {
      var t = next();
      if (t == null) throw new Error('Biểu thức thiếu toán hạng: ' + src);
      if (t === '(') { var v = ternary(); next(); return v; }
      if (t === '-') return -primary();
      if (t === '+') return +primary();
      if (t === '!') return !primary();
      if (/^\d/.test(t)) return parseFloat(t);
      if (t === 'true') return true; if (t === 'false') return false;
      if (FN[t] && peek() === '(') { next(); var args = []; if (peek() !== ')') { args.push(ternary()); while (peek() === ',') { next(); args.push(ternary()); } } next(); return FN[t].apply(null, args); }
      if (/^[A-Za-z_]/.test(t)) { var vv = vars[t]; return vv == null ? 0 : vv; }
      throw new Error('Biểu thức không hợp lệ: ' + src);
    }
    function mul() { var v = primary(); while (peek() === '*' || peek() === '/' || peek() === '%') { var o = next(), w = primary(); v = o === '*' ? v * w : o === '/' ? (w ? v / w : 0) : v % w; } return v; }
    function add() { var v = mul(); while (peek() === '+' || peek() === '-') { var o = next(), w = mul(); v = o === '+' ? v + w : v - w; } return v; }
    function cmp() { var v = add(); while (['<', '>', '<=', '>=', '==', '!='].indexOf(peek()) >= 0) { var o = next(), w = add(); v = o === '<' ? v < w : o === '>' ? v > w : o === '<=' ? v <= w : o === '>=' ? v >= w : o === '==' ? Math.abs(v - w) < 1e-9 : Math.abs(v - w) >= 1e-9; } return v; }
    function and() { var v = cmp(); while (peek() === '&&') { next(); var w = cmp(); v = v && w; } return v; }
    function or() { var v = and(); while (peek() === '||') { next(); var w = and(); v = v || w; } return v; }
    function ternary() { var c = or(); if (peek() === '?') { next(); var a = ternary(); next(); var b = ternary(); return c ? a : b; } return c; }
    return ternary();
  }
  /** Điền mẫu: hỗ trợ {{x}}, {x}, {x: gợi ý} — thiếu dữ liệu thì để "…" (hoặc gợi ý) */
  function tpl(s, vars) {
    return String(s || '').replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*(?::\s*([^}]*))?\}/g, function (_, a, b, hint) {
      var k = a || b, v = vars[k];
      if (v == null || v === '') return hint ? '[' + hint.trim() + ']' : '…';
      return v;
    });
  }
  /** Lấy thông điệp cảnh báo theo id trong rules.warnings */
  function ruleMsg(id, vars, fallback) {
    var w = RULES.warningsById[id];
    return { id: id, level: w ? w.level : 'warn', msg: tpl(w ? w.message : (fallback || id), vars || {}) };
  }

  RULES = normalizeRules(DEFAULT_RULES);

  /* ===================== Parser XML ===================== */
  function xmlDecode(s) {
    return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); }).replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }).replace(/&amp;/g, '&');
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** Lấy text của phần tử đầu tiên theo localName (mọi độ sâu, bỏ qua namespace prefix) */
  function xmlTag(xml, name) {
    var re = new RegExp('<(?:[\\w.-]+:)?' + escRe(name) + '(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?' + escRe(name) + '\\s*>)');
    var m = re.exec(xml);
    if (!m) return null;
    return m[1] == null ? '' : xmlDecode(m[1].trim());
  }
  function xmlBlock(xml, name) {
    var re = new RegExp('<(?:[\\w.-]+:)?' + escRe(name) + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?' + escRe(name) + '\\s*>');
    var m = re.exec(xml); return m ? m[1] : null;
  }
  function xmlBlocksMatching(xml, nameRe) {
    var out = [], re = /<(?:[\w.-]+:)?([\w.-]+)(?:\s[^>]*)?>/g, m;
    while ((m = re.exec(xml))) {
      if (nameRe.test(m[1])) {
        var endRe = new RegExp('</(?:[\\w.-]+:)?' + escRe(m[1]) + '\\s*>', 'g');
        endRe.lastIndex = re.lastIndex;
        var e = endRe.exec(xml);
        if (e) { out.push({ name: m[1], body: xml.slice(re.lastIndex, e.index) }); re.lastIndex = e.index + e[0].length; }
      }
    }
    return out;
  }
  function detectXmlKind(xml) {
    var ma = (xmlTag(xml, 'maTKhai') || '').trim();
    if (ma === '842') return 'GTGT';
    if (ma === '892') return 'TNDN';
    var ten = (xmlTag(xml, 'tenTKhai') || '').toUpperCase();
    if (/683|684|699|700|402|999/.test(ma) || /BÁO CÁO TÀI CHÍNH/.test(ten) || /<(?:[\w.-]+:)?PL_(KQHDSXKD|CDTK)\b/.test(xml)) return 'BCTC';
    if (/01\/GTGT|GIÁ TRỊ GIA TĂNG/.test(ten)) return 'GTGT';
    if (/03\/TNDN|THU NHẬP DOANH NGHIỆP/.test(ten)) return 'TNDN';
    // Savitax sửa (27/10/2026): tờ khai thuế TNCN (05/QTT mã 953, 05/KK…) cũng có thẻ ct40, ct43 → bị đoán là GTGT rồi đọc kỳ
    // GTGT không ra, báo lỗi "Cannot read properties of null" (DOEL 2025). Tờ khai TNCN không dùng cho rủi ro → bỏ qua.
    if (/THU NHẬP CÁ NHÂN|TNCN/.test(ten)) return 'unknown';
    if (xmlTag(xml, 'ct43') != null && xmlTag(xml, 'ct40') != null) return 'GTGT';
    if (xmlTag(xml, 'ctA1') != null) return 'TNDN';
    return 'unknown';
  }

  function parseKyKKhai(kieuKy, kyKKhai, tuNgay) {
    kieuKy = (kieuKy || '').toUpperCase();
    var m = String(kyKKhai || '').match(/(\d{1,2})\s*\/\s*(\d{4})/);
    var ky, nam;
    if (m) { ky = +m[1]; nam = +m[2]; }
    else if (tuNgay) { var iso = toIso(tuNgay); nam = +iso.slice(0, 4); var mo = +iso.slice(5, 7); ky = kieuKy === 'M' ? mo : Math.floor((mo - 1) / 3) + 1; }
    if (kieuKy !== 'M' && kieuKy !== 'Q') kieuKy = ky > 4 ? 'M' : 'Q';
    return { kieuKy: kieuKy, ky: ky, nam: nam };
  }

  function parseKHBS(xml) {
    var rows = [];
    xmlBlocksMatching(xml, /KHBS/i).forEach(function (b) {
      var items = xmlBlocksMatching(b.body, /^(ChiTiet|CTiet|Chitiet|ChiTieu|chiTieu|item|row|CTieu)\w*$/i);
      if (!items.length) items = [b];
      items.forEach(function (it) {
        var o = {}, re = /<(?:[\w.-]+:)?([\w.-]+)(?:\s[^>]*)?>([^<]*)<\//g, m;
        while ((m = re.exec(it.body))) o[m[1]] = xmlDecode(m[2].trim());
        if (Object.keys(o).length) rows.push(o);
      });
    });
    return rows;
  }

  function parseGTGTXml(xml, fileName) {
    if (!xml || typeof xml !== 'string') throw new Error('Nội dung XML rỗng');
    var kind = detectXmlKind(xml);
    if (kind !== 'GTGT') throw new Error('Không phải tờ khai 01/GTGT (maTKhai=' + (xmlTag(xml, 'maTKhai') || '?') + ')');
    var kk = parseKyKKhai(xmlTag(xml, 'kieuKy'), xmlTag(xml, 'kyKKhai'), xmlTag(xml, 'kyKKhaiTuNgay'));
    var loai = (xmlTag(xml, 'loaiTKhai') || 'C').trim().toUpperCase();
    var soLan = parseInt(xmlTag(xml, 'soLan') || '0', 10) || 0;
    var headerIssues = [];
    if ((loai === 'C' && soLan !== 0) || (loai === 'B' && soLan < 1)) { headerIssues.push('Header mâu thuẫn: loaiTKhai=' + loai + ' nhưng soLan=' + soLan + ' (C ↔ 0, B ↔ ≥1). App dùng soLan=' + soLan + '.'); loai = soLan > 0 ? 'B' : 'C'; }
    if (loai !== 'B' && loai !== 'C') { headerIssues.push('loaiTKhai không hợp lệ: ' + loai); loai = soLan > 0 ? 'B' : 'C'; }
    var main = xmlBlock(xml, 'CTieuTKhaiChinh') || xml;
    var ct = emptyCt();
    CT_KEYS.forEach(function (k) {
      var v = xmlTag(main, k);
      if (v == null) v = xmlTag(xml, k);
      if (k === 'ct21') ct[k] = (v && /^(1|x|true)$/i.test(v.trim())) ? 1 : 0;
      else ct[k] = parseXmlNumber(v);
    });
    var pk = periodKey(kk.kieuKy, kk.ky, kk.nam);
    var ngayLap = toIso(xmlTag(xml, 'ngayLapTKhai'));
    var ngayKy = toIso(xmlTag(xml, 'ngayKy'));
    var decl = {
      id: uid('tk'), kind: 'GTGT',
      maTKhai: xmlTag(xml, 'maTKhai'),
      mst: (xmlTag(xml, 'mst') || '').trim(), tenNNT: xmlTag(xml, 'tenNNT') || '', dchiNNT: xmlTag(xml, 'dchiNNT') || '',
      tenTinh: xmlTag(xml, 'tenTinhNNT') || '',
      maCQT: xmlTag(xml, 'maCQTNoiNop') || '', tenCQT: xmlTag(xml, 'tenCQTNoiNop') || '',
      kieuKy: kk.kieuKy, ky: kk.ky, nam: kk.nam, periodKey: pk,
      tuNgay: toIso(xmlTag(xml, 'kyKKhaiTuNgay')) || periodRange(pk).from, denNgay: toIso(xmlTag(xml, 'kyKKhaiDenNgay')) || periodRange(pk).to,
      loai: loai, soLan: soLan, ngayLap: ngayLap, ngayKy: ngayKy, ngayNop: ngayKy || ngayLap,
      nguoiKy: xmlTag(xml, 'nguoiKy') || '',
      pbanTKhaiXML: xmlTag(xml, 'pbanTKhaiXML') || '',
      source: { type: 'xml', fileName: fileName || '' },
      ct: ct, khbs: parseKHBS(xml), headerIssues: headerIssues, generated: false, rawXml: xml,
      formVersion: (xmlTag(main, 'ct32b') != null || xmlTag(main, 'ct34a') != null) ? 'TT89' : 'TT80'
    };
    return decl;
  }

  /* PL 03-1A (TT 80/2021) — mã chỉ tiêu [01]..[19]:
   *  [01] DT bán hàng, CCDV; [02] trong đó DT xuất khẩu; [03] Giảm trừ DT (=[04]+[05]+[06]+[07]); [04] CKTM; [05] Giảm giá; [06] Hàng bán bị trả lại;
   *  [07] Thuế TTĐB, XK, GTGT trực tiếp; [08] DT hoạt động tài chính; [09] Chi phí SXKD (=[10]+[11]+[12]); [10] Giá vốn; [11] Chi phí bán hàng; [12] Chi phí QLDN;
   *  [13] Chi phí tài chính; [14] trong đó lãi vay; [15] LN thuần (=[01]-[03]+[08]-[09]-[13]); [16] Thu nhập khác; [17] Chi phí khác; [18] LN khác; [19] Tổng LN trước thuế (=[15]+[18]).
   * Định dạng XML:
   *  (a) <PL_03_1A_TNDN><ct01>..<ct19>: ctNN = [NN] (bộ dữ liệu QA).
   *  (b) HTKK thật <PLuc_03_1A_TNDN><ct04>..<ct22>: KIỂM CHỨNG bằng số liệu thật (QT 2025 BS1):
   *      ct12 = ct13+ct14+ct15 → ct12=[09], ct13..ct15=[10]..[12]; ct18 = ct04 − ct06 + ct10 − ct12 − ct16 (72.051.376) → ct10 = [08] DT tài chính, ct16 = [13];
   *      ct22 = ct18 + ct21 = ctA1 → ct18=[15], ct19..ct21=[16]..[18], ct22=[19]; ct04=[01], ct05=[02], ct06=[03], ct07..ct09=[04]..[06], ct17=[14].
   *      ct11 chưa xác định được nghĩa (giá trị 0 trong mẫu thật) — giữ ở rawPl.ct11, không ánh xạ. [07] (thuế TTĐB…) không có thẻ riêng trong định dạng (b).
   */
  /* PL 03-1A/TNDN (mẫu TT80, HTKK): thẻ ctNN = chỉ tiêu [NN], đánh số [04]..[22] (rules2.json pl031aMapping.TT80,
     kiểm chứng số học trên XML thật: [12]=[13]+[14]+[15]; [18]=[04]−[06]+[10]−[12]−[16]; [21]=[19]−[20]; [22]=[18]+[21]=A1).
     Mẫu PL_03_1A_TNDN ct01..ct19 (bộ dữ liệu giả cũ) được quy đổi sang mã thật bằng PL031A_LEGACY_MAP. */
  var PL031A_LABELS = { ct04: 'DT bán hàng, cung cấp dịch vụ', ct05: 'Trong đó: DT xuất khẩu', ct06: 'Các khoản giảm trừ doanh thu ([07]+[08]+[09])', ct07: 'Chiết khấu thương mại', ct08: 'Giảm giá hàng bán', ct09: 'Hàng bán bị trả lại', ct10: 'Doanh thu hoạt động tài chính', ct11: 'Trong đó: lãi tiền gửi', ct12: 'Chi phí SXKD ([13]+[14]+[15])', ct13: 'Giá vốn hàng bán', ct14: 'Chi phí bán hàng', ct15: 'Chi phí quản lý doanh nghiệp', ct16: 'Chi phí tài chính', ct17: 'Trong đó: chi phí lãi vay', ct18: 'Lợi nhuận thuần từ HĐKD', ct19: 'Thu nhập khác', ct20: 'Chi phí khác', ct21: 'Lợi nhuận khác ([19]−[20])', ct22: 'Tổng lợi nhuận kế toán trước thuế (= A1)' };
  var PL031A_LEGACY_MAP = { ct01: 'ct04', ct02: 'ct05', ct03: 'ct06', ct04: 'ct07', ct05: 'ct08', ct06: 'ct09', ct08: 'ct10', ct09: 'ct12', ct10: 'ct13', ct11: 'ct14', ct12: 'ct15', ct13: 'ct16', ct14: 'ct17', ct15: 'ct18', ct16: 'ct19', ct17: 'ct20', ct18: 'ct21', ct19: 'ct22' };
  var PL031A_HTKK_MAP = {}; Object.keys(PL031A_LABELS).forEach(function (k) { PL031A_HTKK_MAP[k] = k; });
  function readCts(body) { var o = {}, re = /<(?:[\w.-]+:)?(ct[0-9A-Za-z_]+)>\s*(-?[\d.,]+)\s*<\//g, m; while ((m = re.exec(body || ''))) if (o[m[1]] == null) o[m[1]] = parseXmlNumber(m[2]); return o; }
  function parseTNDNXml(xml, fileName) {
    var kind = detectXmlKind(xml);
    if (kind !== 'TNDN') throw new Error('Không phải tờ khai quyết toán 03/TNDN');
    xml = xml.replace(/<(?:[\w.-]+:)?CKyDTu[\s\S]*?<\/(?:[\w.-]+:)?CKyDTu\s*>/g, '');
    var nam = parseInt(xmlTag(xml, 'kyKKhai') || '', 10);
    if (!nam) { var t = toIso(xmlTag(xml, 'kyKKhaiTuNgay')); nam = t ? +t.slice(0, 4) : 0; }
    var main = xmlBlock(xml, 'CTieuTKhaiChinh') || xml;
    var mainOnly = main.replace(/<(?:[\w.-]+:)?PLuc[\s\S]*$/, '');
    var soLan = parseInt(xmlTag(xml, 'soLan') || '0', 10) || 0;
    var o = {
      id: uid('qt'), kind: 'TNDN', nam: nam, mst: (xmlTag(xml, 'mst') || '').trim(), tenNNT: xmlTag(xml, 'tenNNT') || '',
      loai: (xmlTag(xml, 'loaiTKhai') || (soLan ? 'B' : 'C')).trim(), soLan: soLan,
      ngayLap: toIso(xmlTag(xml, 'ngayLapTKhai')),
      ctA1: parseXmlNumber(xmlTag(mainOnly, 'ctA1')),
      ctC1: parseXmlNumber(xmlTag(mainOnly, 'ctC1')), ctE: parseXmlNumber(xmlTag(mainOnly, 'ctE')),
      main: readCts(mainOnly), pl031a: null, plFormat: null, plChecks: [], khbs: null, source: { type: 'xml', fileName: fileName || '' }
    };
    var plA = xmlBlocksMatching(xml, /^PL_03_1A|^PL031A|KQKD/i), plB = xmlBlocksMatching(xml, /^PLuc_03_1A/i);
    if (plB.length) {
      var raw = readCts(plB[0].body), p = {};
      Object.keys(PL031A_LABELS).forEach(function (k) { if (raw[k] != null) p[k] = raw[k]; });
      o.pl031a = p; o.rawPl = raw; o.plFormat = 'PL 03-1A (HTKK, TT80: ct04–ct22)';
    } else if (plA.length) {
      var b = plA[0].body, p2 = {}, raw2 = {};
      for (var i = 1; i <= 22; i++) { var k = 'ct' + pad2(i); var v = xmlTag(b, k); if (v == null) v = xmlTag(b, 'ct' + i); if (v != null) raw2[k] = parseXmlNumber(v); }
      var legacy = raw2.ct22 == null && raw2.ct01 != null;
      Object.keys(raw2).forEach(function (k) { var t = legacy ? PL031A_LEGACY_MAP[k] : (PL031A_LABELS[k] ? k : null); if (t) p2[t] = raw2[k]; });
      o.pl031a = p2; o.rawPl = raw2; o.plFormat = legacy ? 'PL_03_1A_TNDN ct01–ct19 (mẫu cũ, quy đổi sang [04]–[22])' : 'PL_03_1A_TNDN ct04–ct22';
    }
    if (o.pl031a) {
      var q = o.pl031a, ck = function (label, a, bb) { if (a != null && bb != null && Math.abs(a - bb) >= 1) o.plChecks.push(label + ': ' + fmtNum(a) + ' ≠ ' + fmtNum(bb)); };
      if (q.ct07 != null || q.ct08 != null || q.ct09 != null) ck('[06] = [07]+[08]+[09]', q.ct06, n(q.ct07) + n(q.ct08) + n(q.ct09));
      if (q.ct13 != null && q.ct14 != null && q.ct15 != null) ck('[12] = [13]+[14]+[15]', q.ct12, n(q.ct13) + n(q.ct14) + n(q.ct15));
      if (q.ct18 != null) ck('[18] = [04]−[06]+[10]−[12]−[16]', q.ct18, n(q.ct04) - n(q.ct06) + n(q.ct10) - n(q.ct12) - n(q.ct16));
      if (q.ct21 != null && q.ct19 != null) ck('[21] = [19]−[20]', q.ct21, n(q.ct19) - n(q.ct20));
      if (q.ct22 != null) { ck('[22] = [18]+[21]', q.ct22, n(q.ct18) + n(q.ct21)); ck('[22] PL 03-1A = [A1] tờ khai', q.ct22, o.ctA1); }
    }
    var P = o.pl031a || {}, M = o.main || {};
    o.doanhThu = P.ct04 != null ? P.ct04 : null;     // [04] DT bán hàng, cung cấp dịch vụ (↔ KQKD ct01)
    o.giamTru = P.ct06 != null ? P.ct06 : null;      // [06] giảm trừ (↔ ct02)
    o.dtTaiChinh = P.ct10 != null ? P.ct10 : null;   // [10] DT tài chính (↔ ct21 / 515)
    o.giaVon = P.ct13 != null ? P.ct13 : null;       // [13] ↔ ct11 / 632
    o.cpBanHang = P.ct14 != null ? P.ct14 : null;    // [14] ↔ 641 / 6421
    o.cpQldn = P.ct15 != null ? P.ct15 : null;       // [15] ↔ 642 / 6422
    o.cpTaiChinh = P.ct16 != null ? P.ct16 : null;   // [16] ↔ ct22 / 635
    o.thuNhapKhac = P.ct19 != null ? P.ct19 : null;  // [19] ↔ ct31 / 711
    o.chiPhiKhac = P.ct20 != null ? P.ct20 : null;   // [20] ↔ ct32 / 811
    o.tongLN = P.ct22 != null ? P.ct22 : o.ctA1;     // [22] = A1 ↔ ct50
    o.ctE1 = M.ctE1 != null ? M.ctE1 : o.ctE; o.ctG = M.ctG != null ? M.ctG : null; o.ctG1 = M.ctG1 != null ? M.ctG1 : null; o.ctG2 = M.ctG2 != null ? M.ctG2 : null; o.ctI = M.ctI != null ? M.ctI : null;
    o.thueSuat = M.ctC7_thueSuat != null ? M.ctC7_thueSuat : null; o.ctB4 = M.ctB4 != null ? M.ctB4 : null;
    // Phụ lục KHBS của QT TNDN
    var k1 = xmlBlocksMatching(xml, /^PL01_KHBS$/i)[0], k2 = xmlBlocksMatching(xml, /^PL01_1_KHBS$/i)[0];
    if (k1 || k2) {
      var kh = { phaiNop: [], tongPhaiNop: null, chamNop: null, giaiTrinh: [] };
      if (k1) {
        var m1 = xmlBlock(k1.body, 'Muc_1') || '';
        xmlBlocksMatching(m1, /^ChiTiet$/).forEach(function (c) { var tm = xmlTag(c.body, 'ct2_ma'); if (tm) kh.phaiNop.push({ tieuMuc: tm, ten: xmlTag(c.body, 'ct2_ten') || '', soDieuChinh: parseXmlNumber(xmlTag(c.body, 'ct3')) }); });
        var tc = xmlTag(m1, 'tongCong_ct10'); kh.tongPhaiNop = tc != null ? parseXmlNumber(tc) : null;
        var m3 = xmlBlock(k1.body, 'Muc_3');
        if (m3) kh.chamNop = { denNgay: toIso(xmlTag(m3, 'ct3a_1')), soNgay: parseInt(xmlTag(m3, 'ct3a_2') || '0', 10) || 0, soTien: parseXmlNumber(xmlTag(m3, 'ct3b')) };
      }
      if (k2) xmlBlocksMatching(k2.body, /^ChiTiet$/).forEach(function (c) { var ma = xmlTag(c.body, 'ct3_ma'); if (!ma) return; kh.giaiTrinh.push({ ma: ma, ten: xmlTag(c.body, 'ct3_ten') || '', daKeKhai: parseXmlNumber(xmlTag(c.body, 'ct04')), dieuChinh: parseXmlNumber(xmlTag(c.body, 'ct05')), chenhLech: parseXmlNumber(xmlTag(c.body, 'ct06')) }); });
      o.khbs = kh;
    }
    return o;
  }
  /** Bản QT TNDN cuối cùng của năm (lần bổ sung lớn nhất, cùng lần → ngày lập muộn nhất) */
  function finalTndn(list, nam) {
    var vs = (list || []).filter(function (t) { return +t.nam === +nam; }).sort(function (a, b) { return (n(a.soLan) - n(b.soLan)) || String(a.ngayLap || '').localeCompare(String(b.ngayLap || '')); });
    return vs.length ? vs[vs.length - 1] : null;
  }

  /* ===================== Parser PDF text ===================== */
  var PDF_CODES = ['21', '22', '23', '23a', '24', '24a', '25', '26', '27', '28', '29', '30', '31', '32', '32a', '32b', '33', '34a', '34', '35', '36', '37', '38', '39a', '40a', '40b', '40', '41', '42', '43'];
  function parseGTGTPdfText(text) {
    text = String(text || '').replace(/ /g, ' ').replace(/[−–]/g, '-');
    var found = {}, rawMatches = [];
    var numRe = '(\\(\\s*[\\d][\\d.,\\s]*\\)|-?\\s?\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?(?![\\d])|-?\\s?\\d+(?:[.,]\\d{1,2})?(?![\\d.,]))';
    var re = new RegExp('\\[\\s*(\\d{2}[ab]?)\\s*\\]\\s*[:=]?\\s*' + numRe, 'gi');
    var m;
    while ((m = re.exec(text))) {
      var code = m[1].toLowerCase();
      if (PDF_CODES.indexOf(code) < 0) continue;
      var v = parseViNumber(m[2].replace(/\s/g, ''));
      if (v == null) continue;
      // tránh nhầm "[40a]=[36]-[22]" (đã loại do sau mã phải là số); nhầm năm/ngày: bỏ số 4 chữ số liền sau là "/"
      var after = text.slice(re.lastIndex, re.lastIndex + 1);
      if (after === '/' ) continue;
      rawMatches.push({ code: code, value: v, index: m.index });
      found[code] = v; // lấy lần xuất hiện cuối
      re.lastIndex = m.index + m[0].length;
    }
    var ct = emptyCt();
    Object.keys(found).forEach(function (code) { var k = 'ct' + code; if (CT_BY_KEY[k]) ct[k] = k === 'ct21' ? (found[code] ? 1 : 0) : found[code]; });
    var flat = text.replace(/\s+/g, ' ');
    // Kỳ
    var kieuKy = null, ky = null, nam = null, mm;
    var kt = flat.match(/Kỳ tính thuế\s*:?\s*(Tháng|Quý)\s*(\d{1,2})\s*(?:năm|\/|-|\.)\s*(\d{4})/i);
    if (kt) { kieuKy = /^q/i.test(kt[1]) ? 'Q' : 'M'; ky = +kt[2]; nam = +kt[3]; }
    else {
      var pre = function (m) { return /ngày\s*\d{1,2}\s*$/i.test(flat.slice(Math.max(0, m.index - 14), m.index)); };
      var reQ = /Quý\s*(\d)\s*(?:năm|\/|-|\.)\s*(\d{4})/gi, reM = /Tháng\s*(\d{1,2})\s*(?:năm|\/|-|\.)\s*(\d{4})/gi;
      while ((mm = reQ.exec(flat))) { if (!pre(mm)) { kieuKy = 'Q'; ky = +mm[1]; nam = +mm[2]; break; } }
      if (!kieuKy) while ((mm = reM.exec(flat))) { if (!pre(mm) && +mm[1] >= 1 && +mm[1] <= 12) { kieuKy = 'M'; ky = +mm[1]; nam = +mm[2]; break; } }
    }
    // MST: 10 hoặc 13 số, có thể cách nhau
    var mst = '';
    var mstM = flat.match(/Mã số thuế[^0-9]{0,20}((?:\d[\s|]*){10}(?:-?\s*(?:\d[\s|]*){3})?)/i);
    if (mstM) mst = mstM[1].replace(/[^\d-]/g, '');
    // Lần đầu / bổ sung
    var soLan = 0, loai = 'C';
    var bs = flat.match(/Bổ sung lần thứ\s*[:\]]?\s*(\d{1,2})/i);
    if (bs) { soLan = +bs[1]; loai = soLan > 0 ? 'B' : 'C'; }
    var ten = '';
    var tm = flat.match(/Tên người nộp thuế\s*[:\]]?\s*(.+?)(?=\s*\[\d{2}\]|\s*Mã số thuế|$)/i);
    if (tm) ten = tm[1].trim().replace(/^[:\s]+/, '');
    var ngay = '';
    // ngày ký: lần xuất hiện cuối (tránh "ngày 29 tháng 9 năm 2021" của Thông tư trong tiêu đề mẫu)
    var dre = /ngày\s*(\d{1,2})(?:\s*tháng\s*|\s*[\/.\-]\s*)(\d{1,2})(?:\s*năm\s*|\s*[\/.\-]\s*)(\d{4})/gi, dm, lastD = null;
    while ((dm = dre.exec(flat))) { var ctx = flat.slice(dm.index, dm.index + dm[0].length + 20); if (!/của\s*Bộ/i.test(ctx)) lastD = dm; }
    if (lastD) ngay = lastD[3] + '-' + pad2(lastD[2]) + '-' + pad2(lastD[1]);
    var nk = flat.match(/Ngày ký\s*[:]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i); if (nk) ngay = toIso(nk[1]);
    var codesFound = Object.keys(found);
    var missing = ['22', '23', '24', '25', '34', '35', '36', '40', '41', '43'].filter(function (c) { return codesFound.indexOf(c) < 0; });
    // kiểm tra nhất quán sau khi tính lại
    var rc = recompute(ct);
    var mismatch = ['ct27', 'ct28', 'ct34', 'ct35', 'ct36', 'ct40a', 'ct40', 'ct41', 'ct43'].filter(function (k) { return found[k.slice(2)] != null && Math.abs(rc[k] - ct[k]) >= 1; });
    var decl = null;
    if (kieuKy && ky && nam) {
      var pk = periodKey(kieuKy, ky, nam);
      decl = {
        id: uid('tk'), kind: 'GTGT', mst: mst, tenNNT: ten, dchiNNT: '', maCQT: '', tenCQT: '',
        kieuKy: kieuKy, ky: ky, nam: nam, periodKey: pk, tuNgay: periodRange(pk).from, denNgay: periodRange(pk).to,
        loai: loai, soLan: soLan, ngayLap: ngay, ngayKy: ngay, ngayNop: ngay, nguoiKy: '',
        source: { type: 'pdf', fileName: '' }, ct: ct, khbs: [], generated: false
      };
    }
    return {
      decl: decl, ct: ct, header: { kieuKy: kieuKy, ky: ky, nam: nam, mst: mst, tenNNT: ten, soLan: soLan, loai: loai, ngay: ngay },
      codesFound: codesFound, missing: missing, mismatch: mismatch, rawMatches: rawMatches,
      confidence: Math.max(0, Math.min(1, codesFound.length / 20)) * (decl ? 1 : 0.5) * (mismatch.length ? 0.7 : 1)
    };
  }

  /** Ghép text item của pdf.js (getTextContent().items của từng trang) thành dòng theo toạ độ y, sắp theo x */
  function pdfItemsToText(pages) {
    var out = [];
    (pages || []).forEach(function (items) {
      var its = (items || []).filter(function (it) { return it && it.str != null && it.transform; }).map(function (it) { return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || Math.abs(it.height) || 8 }; });
      its.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var lines = [];
      its.forEach(function (it) {
        var L = null;
        for (var i = lines.length - 1; i >= 0 && i >= lines.length - 4; i--) if (Math.abs(lines[i].y - it.y) <= Math.max(2, it.h * 0.35)) { L = lines[i]; break; }
        if (!L) { L = { y: it.y, items: [] }; lines.push(L); }
        L.items.push(it);
      });
      lines.forEach(function (L) {
        L.items.sort(function (a, b) { return a.x - b.x; });
        var txt = '', lastEnd = null;
        L.items.forEach(function (it) {
          if (!it.s) return;
          if (lastEnd != null && it.x - lastEnd > 1 && !/\s$/.test(txt)) txt += ' ';
          txt += it.s; lastEnd = it.x + it.w;
        });
        if (txt.trim()) out.push(txt.replace(/\s+/g, ' ').trim());
      });
      out.push('');
    });
    return out.join('\n');
  }

  /* ===================== Kiểm tra logic tờ khai ===================== */
  /** Kiểm tra MST (10 số + chữ số kiểm tra; 13 số dạng 10-3) */
  function mstValid(mst) {
    var d = String(mst || '').replace(/[\s-]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(d)) return false;
    var w = [31, 29, 23, 19, 17, 13, 7, 5, 3], sum = 0;
    for (var i = 0; i < 9; i++) sum += +d[i] * w[i];
    return (10 - sum % 11) === +d[9];
  }
  /**
   * validate(decl, prev?) → [{level:'error'|'warn'|'info', code, ct, msg, expected, actual, diff}]
   * Kiểm tra công thức theo số GHI TRÊN tờ khai (từng công thức dùng toán hạng trên chính tờ khai).
   * prev: tờ khai kỳ trước (so [22] với [43]) hoặc mảng các bản của kỳ trước (lần đầu..bản cuối).
   */
  function validate(decl, prev) {
    var out = [];
    if (!decl || !decl.ct) return out;
    var c = {}; CT_KEYS.forEach(function (k) { c[k] = n(decl.ct[k]); });
    function chk(code, key, expected, formula) {
      var d = r2(c[key] - expected);
      if (Math.abs(d) >= 1) out.push({ level: 'error', code: code, ct: key, formula: formula, msg: '[' + CT_BY_KEY[key].code + '] = ' + fmtNum(c[key]) + ' khác công thức ' + formula + ' = ' + fmtNum(expected) + ' (lệch ' + fmtNum(d) + ')', expected: expected, actual: c[key], diff: d });
    }
    var x = r2(c.ct36 - c.ct22 + c.ct37 - c.ct38 - c.ct39a);
    var tt89 = decl.formVersion === 'TT89' || nz(c.ct32b) || nz(c.ct34a);
    chk('L01', 'ct27', r2(c.ct29 + c.ct30 + c.ct32 + c.ct32a - c.ct32b), tt89 ? '[27]=[29]+[30]+[32]+[32a]-[32b]' : '[27]=[29]+[30]+[32]+[32a]');
    chk('L02', 'ct28', r2(c.ct31 + c.ct33), '[28]=[31]+[33]');
    chk('L03', 'ct34', r2(c.ct26 + c.ct27 + c.ct34a), tt89 ? '[34]=[26]+[27]+[34a]' : '[34]=[26]+[27]');
    if (c.ct37 < 0 || c.ct38 < 0) out.push({ level: 'error', code: 'L13', ct: c.ct37 < 0 ? 'ct37' : 'ct38', msg: '[37]/[38] phải ≥ 0.' });
    chk('L04', 'ct35', c.ct28, '[35]=[28]');
    chk('L05', 'ct36', r2(c.ct35 - c.ct25), '[36]=[35]-[25]');
    chk('L06', 'ct40a', Math.max(0, x), '[40a]=max(0,[36]-[22]+[37]-[38]-[39a])');
    chk('L07', 'ct41', Math.max(0, -x), '[41]=max(0,-([36]-[22]+[37]-[38]-[39a]))');
    chk('L08', 'ct40', r2(c.ct40a - c.ct40b), '[40]=[40a]-[40b]');
    chk('L09', 'ct43', r2(c.ct41 - c.ct42), '[43]=[41]-[42]');
    if (c.ct40a >= 1 && c.ct41 >= 1) out.push({ level: 'error', code: 'L10', ct: 'ct41', msg: '[40a] = ' + fmtNum(c.ct40a) + ' và [41] = ' + fmtNum(c.ct41) + ' cùng > 0 (không thể vừa phải nộp vừa còn khấu trừ).' });
    (decl.headerIssues || []).forEach(function (h) { out.push({ level: 'error', code: 'L11', ct: '', msg: h }); });
    if (decl.mst && !mstValid(decl.mst)) out.push({ level: 'error', code: 'L12b', ct: '', msg: 'MST ' + decl.mst + ' sai chữ số kiểm tra / định dạng.' });
    if (c.ct30 >= 1) { var p5 = c.ct31 / c.ct30 * 100; if (Math.abs(p5 - 5) > 0.05) out.push({ level: 'warn', code: 'S01', ct: 'ct31', msg: '[31] = ' + p5.toFixed(2).replace('.', ',') + '% của [30], khác 5%.' }); }
    else if (c.ct31 >= 1) out.push({ level: 'warn', code: 'S01', ct: 'ct31', msg: '[31] có thuế nhưng [30] doanh thu bằng 0.' });
    if (c.ct32 >= 1) { var p10 = c.ct33 / c.ct32 * 100; if (p10 < 7.95 || p10 > 10.05) out.push({ level: 'warn', code: 'S02', ct: 'ct33', msg: '[33] = ' + p10.toFixed(2).replace('.', ',') + '% của [32], ngoài khoảng 8%–10%.' }); }
    else if (c.ct33 >= 1) out.push({ level: 'warn', code: 'S02', ct: 'ct33', msg: '[33] có thuế nhưng [32] doanh thu bằng 0.' });
    if (c.ct25 - c.ct24 >= 1) out.push({ level: 'warn', code: 'S03', ct: 'ct25', msg: '[25] thuế được khấu trừ (' + fmtNum(c.ct25) + ') lớn hơn [24] thuế mua vào (' + fmtNum(c.ct24) + ').' });
    if (c.ct23a - c.ct23 >= 1 || c.ct24a - c.ct24 >= 1) out.push({ level: 'warn', code: 'S04', ct: 'ct23a', msg: 'Giá trị/thuế nhập khẩu [23a]/[24a] lớn hơn tổng [23]/[24].' });
    if (c.ct40b - c.ct40a >= 1) out.push({ level: 'warn', code: 'S04', ct: 'ct40b', msg: '[40b] lớn hơn [40a].' });
    if (c.ct42 - c.ct41 >= 1) out.push({ level: 'warn', code: 'S04', ct: 'ct42', msg: '[42] đề nghị hoàn lớn hơn [41].' });
    if (prev) chainCheck(decl, Array.isArray(prev) ? prev : [prev]).forEach(function (i) { out.push(i); });
    return out;
  }
  /** So [22] kỳ này với [43] kỳ trước: bản cuối & lần đầu. Lệch bằng ([43] lần đầu − [43] bản cuối) → đã giải thích bởi TKBS (CT37/38). */
  function chainCheck(decl, prevVersions) {
    var vs = sortDecls(prevVersions.filter(Boolean)); if (!vs.length) return [];
    var orig = vs[0], fin = vs[vs.length - 1];
    var c22 = n(decl.ct.ct22), f43 = n(fin.ct.ct43), o43 = n(orig.ct.ct43);
    var d = r2(c22 - f43), expl = r2(o43 - f43), rest = r2(d - expl);
    var basis = RULES.prev43Basis || 'original';
    if (Math.abs(d) < 1) return [];
    var pl = periodLabel(fin.periodKey);
    if (basis !== 'final' && Math.abs(rest) < 1 && fin !== orig) return [{ level: 'info', code: 'C03', ct: 'ct22', msg: '[22] ' + periodLabel(decl.periodKey) + ' = ' + fmtNum(c22) + ' ≠ [43] ' + pl + ' bản cuối (' + versionLabel(fin) + ') = ' + fmtNum(f43) + ', lệch ' + fmtNum(d) + ' — đã giải thích bởi TKBS kỳ trước (điều chỉnh qua CT37/38). [22] khớp [43] lần đầu = ' + fmtNum(o43) + '.', diff: d, explained: expl }];
    return [{ level: 'error', code: 'C01', ct: 'ct22', msg: '[22] ' + periodLabel(decl.periodKey) + ' = ' + fmtNum(c22) + ' ≠ [43] ' + pl + ' bản cuối (' + versionLabel(fin) + ') = ' + fmtNum(f43) + ', lệch ' + fmtNum(d) + (fin !== orig ? '; TKBS chỉ giải thích ' + fmtNum(expl) + ', còn lại ' + fmtNum(rest) : '') + ' — cần giải trình.', diff: d, explained: expl, rest: rest }];
  }

  /* ===================== Dự án & phiên bản tờ khai ===================== */
  function newProject() {
    var y = +todayIso().slice(0, 4);
    return {
      app: 'CheckThueGTGT', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      mst: '', tenNNT: '', dchiNNT: '', tenCQT: '', diaDiem: '', namKiemTra: y, kieuKy: 'Q',
      decls: [], tndn: null, tndnList: [],
      pm: {}, qt: {}, lyDo: {}, paid: {}, dueOverrides: {},
      errors: [],
      adjust: { currentPeriod: '', ngayLapTKBS: todayIso(), ngayNopDuKien: todayIso(), inspection: false, inspectionDate: '' },
      ct3738Manual: [], ct3738Overrides: {}, thuyetMinh: '', vatNotes: {}
    };
  }
  function migrateProject(p) {
    var base = newProject();
    p = p || {};
    Object.keys(base).forEach(function (k) { if (p[k] == null) p[k] = base[k]; });
    p.adjust = Object.assign({}, base.adjust, p.adjust || {});
    if (p.tndn && !(p.tndnList || []).length) p.tndnList = [p.tndn];
    (p.decls || []).forEach(function (d) { d.ct = recomputeKeep(d.ct); if (!d.periodKey) d.periodKey = periodKey(d.kieuKy, d.ky, d.nam); });
    return p;
  }
  function recomputeKeep(ct) { var o = emptyCt(); Object.keys(ct || {}).forEach(function (k) { o[k] = n(ct[k]); }); return o; }

  function versionLabel(d) { return d.soLan > 0 ? 'BS lần ' + d.soLan : 'Lần đầu'; }
  function declDate(d) { return d.ngayNop || d.ngayKy || d.ngayLap || ''; }
  function sortDecls(decls) {
    return decls.slice().sort(function (a, b) { var c = comparePeriodKey(a.periodKey, b.periodKey); if (c) return c; if (a.soLan !== b.soLan) return a.soLan - b.soLan; return (declDate(a) < declDate(b) ? -1 : 1); });
  }
  function versionsOf(decls, pk) { return sortDecls(decls.filter(function (d) { return d.periodKey === pk; })); }
  function finalOf(decls, pk) { var v = versionsOf(decls, pk); return v.length ? v[v.length - 1] : null; }
  function allDecls(project, applied) { return (project.decls || []).concat(applied && applied.supplementDecls ? applied.supplementDecls : []); }

  /** Bản kỳ trước dùng để so [22] theo rules.prev43Basis:
   *  'original' (mặc định): [43] tờ khai lần đầu kỳ trước — chênh lệch do TKBS kỳ trước điều chỉnh qua [37]/[38];
   *  'latestBefore': bản gần nhất có ngày ≤ ngày lập bản đang xét; 'final': bản cuối cùng. */
  function prevFinalFor(decls, decl) {
    var pk = prevPeriod(decl.periodKey);
    var vs = versionsOf(decls, pk).filter(function (d) { return !d.generated; });
    if (!vs.length) return null;
    var basis = RULES.prev43Basis || 'original';
    if (basis === 'final') return vs[vs.length - 1];
    if (basis === 'latestBefore') {
      var dt = declDate(decl);
      if (dt) { var before = vs.filter(function (v) { var x = declDate(v); return !x || x <= dt; }); if (before.length) return before[before.length - 1]; }
    }
    return vs[0];
  }

  /* ===================== Hạn nộp, tiền chậm nộp ===================== */
  function isHoliday(iso, rules) {
    var d = dateObj(iso), wd = d.getUTCDay();
    if (wd === 0 || wd === 6) return true;
    if (HOLIDAYS[iso]) return true;
    return (rules.deadlines.holidays || []).indexOf(iso) >= 0;
  }
  function ruleDueDate(pk) {
    var p = parsePeriodKey(pk); if (!p) return '';
    if (p.kieuKy === 'M') { var y = p.ky === 12 ? p.nam + 1 : p.nam, m = p.ky === 12 ? 1 : p.ky + 1; return y + '-' + pad2(m) + '-20'; }
    var y2 = p.ky === 4 ? p.nam + 1 : p.nam, m2 = p.ky === 4 ? 1 : p.ky * 3 + 1; return y2 + '-' + pad2(m2) + '-' + pad2(lastDayOfMonth(y2, m2));
  }
  /** Hạn nộp hồ sơ/nộp thuế của kỳ (đã dời theo ngày nghỉ nếu rules yêu cầu; người dùng có thể ghi đè) */
  function dueDate(pk, overrides, rules) {
    rules = rules || RULES;
    if (overrides && overrides[pk]) return toIso(overrides[pk]);
    var iso = ruleDueDate(pk), guard = 0;
    if (rules.deadlines.shiftHolidays) while (iso && isHoliday(iso, rules) && guard++ < 20) iso = addDays(iso, 1);
    return iso;
  }
  /** Tiền chậm nộp = số tiền × tỷ lệ × số ngày; số ngày theo rules (mặc định (ngày nộp − hạn nộp) − 1) */
  function lateInterestCalc(amount, due, payDate, rules) {
    rules = rules || RULES;
    var rate = n(rules.lateInterest.ratePerDay);
    var days = Math.max(0, diffDays(due, payDate) - (rules.lateInterest.dayBeforePayment ? 1 : 0));
    return { amount: r0(Math.max(0, amount) * rate * days), days: days, rate: rate, from: days > 0 ? addDays(due, 1) : '', to: days > 0 ? addDays(due, days) : '', payDate: payDate };
  }

  /* ===================== Áp dụng sai sót ===================== */
  function errorDirection(err) {
    if (err.direction === 'increase' || err.direction === 'decrease') return err.direction;
    return n(err.tax) < 0 || n(err.value) < 0 ? 'decrease' : 'increase';
  }
  /* Chỉ tiêu đầu ra theo thuế suất: [giá trị, thuế] */
  var OUT_RATE_CT = { KCT: ['ct26', null], '0': ['ct29', null], '5': ['ct30', 'ct31'], '8': ['ct32', 'ct33'], '10': ['ct32', 'ct33'], KKKTT: ['ct32a', null] };
  /** Ánh xạ dựng tự động cho sai thuế suất đầu ra khi rules.json chưa có cặp: chuyển giá tính thuế từ chỉ tiêu thuế suất cũ sang mới, thuế = giá × thuế suất */
  function genericRatePair(t, err) {
    if (!t || (t.id !== 'RATE_OUT_UNDER' && t.id !== 'RATE_OUT_OVER')) return null;
    var a = normRate(err.rate), b = normRate(err.rateTo), A = OUT_RATE_CT[a], B = OUT_RATE_CT[b];
    if (!A || !B || a === b) return null;
    var pa = ratePct(a), pb = ratePct(b), out = [];
    if (A[0] !== B[0]) { out.push({ ct: A[0], sign: '-', field: 'base' }); out.push({ ct: B[0], sign: '+', field: 'base' }); }
    if (A[1] && pa) out.push({ ct: A[1], sign: '-', field: 'base*' + (pa / 100) });
    if (B[1] && pb) out.push({ ct: B[1], sign: '+', field: 'base*' + (pb / 100) });
    return out;
  }
  /** Chọn danh sách bút toán chỉ tiêu theo cách xử lý */
  function mappingEntries(t, handling, err) {
    var m = t.ctMapping || {}, rate = normRate(err.rate), dir = errorDirection(err), pair = normRate(err.rate) + 'to' + normRate(err.rateTo);
    if (m.manual) return 'CUSTOM';
    var pick = function () { for (var i = 0; i < arguments.length; i++) if (arguments[i]) return arguments[i]; return null; };
    var gen = genericRatePair(t, err);
    if (gen && !m[pair]) { m = Object.assign({}, m); m[pair] = gen; }
    if (handling === 'TKBS') return pick(m.tkbs, m.TKBS, dir === 'decrease' && t.needsDirection ? m.decrease_tkbs : null, m.byRate && m.byRate[rate], m.byRate_signed && m.byRate_signed[rate], m[pair], t.needsDirection ? m[dir] : null, m.yearEnd_CXM, m.current) || [];
    return pick(err.useAlt ? m.alternative_CXM : null, m.current, m.CURRENT, dir === 'decrease' ? pick(m.decrease_current, m.decrease) : m.increase, m.byRate_signed && m.byRate_signed[rate], m.byRate && m.byRate[rate], m[pair], m.yearEnd_CXM) || [];
  }
  /** Tính delta chỉ tiêu cho 1 sai sót theo cách xử lý ('TKBS' | 'CURRENT') */
  function errorDeltas(err, handling, rules, ctx) {
    rules = rules || RULES;
    var t = errorTypeById(err.type), warnings = [], deltas = {};
    if (!t) return { deltas: deltas, warnings: ['Loại sai sót không xác định: ' + err.type] };
    var value = n(err.value), rp = ratePct(err.rate);
    // Phần giá trị được trừ khỏi giá tính thuế (vd. chi phí dịch vụ ở nước ngoài của tour — NĐ 181 Đ11 k3): chỉ phần còn lại chuyển sang thuế suất mới
    if (t && (t.id === 'RATE_OUT_UNDER' || t.id === 'RATE_OUT_OVER') && n(err.deduct)) value = r2(Math.sign(value || 1) * Math.max(0, Math.abs(value) - Math.abs(n(err.deduct))));
    var tax = err.tax == null || err.tax === '' ? r0(value * rp / 100) : n(err.tax);
    var entries = mappingEntries(t, handling, err);
    if (entries === 'CUSTOM') {
      (err.custom || []).forEach(function (c) {
        var k = ctKeyFromCode(String(c.ct).replace(/^ct/i, ''));
        if (k && CT_BY_KEY[k].input) deltas[k] = r2(n(deltas[k]) + n(c.delta));
        else if (k) warnings.push('Chỉ tiêu [' + CT_BY_KEY[k].code + '] là chỉ tiêu tính toán — không điều chỉnh trực tiếp.');
        else if (c.ct) warnings.push('Không nhận ra chỉ tiêu "' + c.ct + '".');
      });
      return { deltas: deltas, warnings: warnings, tax: tax };
    }
    if (!entries.length) warnings.push('"' + t.label + '": không có ánh xạ chỉ tiêu cho thuế suất "' + (err.rate || '?') + '"' + (t.needsRateTo ? ' → "' + (err.rateTo || '?') + '"' : '') + ' với cách xử lý ' + handling + '.');
    var signed = t.signed;
    var vars = { base: signed ? value : Math.abs(value), tax: signed ? tax : Math.abs(tax), value: value, ct43_before: ctx && ctx.ct43Before != null ? ctx.ct43Before : Math.abs(tax) };
    if (t.needsDirection) { vars.base = Math.abs(value); vars.tax = Math.abs(tax); }
    entries.forEach(function (e) {
      var key = String(e.ct || e.target || '').replace(/[\[\]]/g, ''); if (/^\d/.test(key)) key = 'ct' + key;
      if (!CT_BY_KEY[key]) { warnings.push('Chỉ tiêu không xác định trong rules: ' + key); return; }
      if (t.id === 'IN_OVER' && handling === 'TKBS' && (key === 'ct23' || key === 'ct24') && !err.removeInvoice) return; // chỉ không đủ ĐK khấu trừ: chỉ trừ [25]
      var amt = e.amount != null && e.field == null ? evalExpr(e.amount, vars) : evalExpr(e.field || 'base', vars);
      var sg = e.sign === '-' ? -1 : 1;
      amt = r2(sg * amt);
      if (!CT_BY_KEY[key].input) { warnings.push('Chỉ tiêu [' + CT_BY_KEY[key].code + '] là chỉ tiêu tính toán.'); return; }
      deltas[key] = r2(n(deltas[key]) + amt);
    });
    [err.rate, err.rateTo].forEach(function (rid) {
      if (normRate(rid) !== '8') return;
      var pr = periodRange(err.period || (ctx && ctx.period)); var until = rules.deadlines.rate8pctUntil || '2026-12-31';
      if (pr && pr.from > until) warnings.push(ruleMsg('W-8PCT', {}, 'Thuế suất 8% chỉ áp dụng đến ' + fmtDate(until) + '.').msg);
    });
    return { deltas: deltas, warnings: warnings, tax: tax };
  }

  function caseVars(oldCt, newCt) {
    var snap = function (x) { x = r2(x); return Math.abs(x) < 0.5 ? 0 : x; };
    var v = { old40: r2(oldCt.ct40), new40: r2(newCt.ct40), old43: r2(oldCt.ct43), new43: r2(newCt.ct43), old41: r2(oldCt.ct41), new41: r2(newCt.ct41), old42: r2(oldCt.ct42), new42: r2(newCt.ct42) };
    v.delta40 = snap(v.new40 - v.old40); v.delta43 = snap(v.new43 - v.old43); v.delta42 = snap(v.new42 - v.old42);
    v.d40 = v.delta40; v.d43 = v.delta43; v.absDelta40 = Math.abs(v.delta40);
    return v;
  }
  function classifyCase(oldCt, newCt, rules) {
    rules = rules || RULES;
    var v = caseVars(oldCt, newCt);
    for (var i = 0; i < rules.cases.length; i++) {
      var c = rules.cases[i];
      try { if (c.when && evalExpr(c.when, v)) return { id: c.id, def: c, vars: v }; } catch (e) { /* bỏ qua điều kiện lỗi */ }
    }
    return { id: 'TH_MIXED', def: { id: 'TH_MIXED', name: 'Không phân loại được', steps: [], effect: 'BY43' }, vars: v };
  }
  function caseInterestBase(cs) {
    var expr = String(cs.def.lateInterest == null ? '' : cs.def.lateInterest).trim();
    var m = expr.match(/^[\w\s+\-*().,]+/);
    try { return m ? Math.max(0, r2(evalExpr(m[0].trim(), cs.vars))) : 0; } catch (e) { return 0; }
  }
  /** Kỳ ghi [37]/[38] ("kỳ phát hiện" — rules.md mục 3 bước 3): kỳ SỚM NHẤT sau kỳ cuối cùng đã nộp tờ khai lần đầu
   *  (ngày nộp ≤ ngày lập TKBS) mà đã kết thúc ≤ ngày lập TKBS; nếu mọi kỳ đã kết thúc đều đã nộp → kỳ chứa ngày lập TKBS. */
  function autoCurrentPeriodInfo(decls, dateIso, kieuKy) {
    kieuKy = kieuKy || 'Q';
    var containing = periodOfDate(dateIso, kieuKy);
    var filed = (decls || []).filter(function (d) { var dt = declDate(d); return !d.generated && d.soLan === 0 && d.kieuKy === kieuKy && (!dt || dt <= dateIso); });
    if (!filed.length) return { pk: containing, reason: 'Chưa có tờ khai lần đầu nào nộp trước ngày lập TKBS → kỳ chứa ngày lập TKBS (' + periodLabel(containing) + ').' };
    var last = filed.map(function (d) { return d.periodKey; }).sort(comparePeriodKey).pop();
    var cand = nextPeriod(last);
    if (comparePeriodKey(cand, containing) < 0 && periodRange(cand).to <= dateIso) return { pk: cand, reason: 'Kỳ đã kết thúc sớm nhất chưa nộp tờ khai lần đầu (kỳ đã nộp gần nhất: ' + periodLabel(last) + ') → ' + periodLabel(cand) + '.' };
    if (comparePeriodKey(cand, containing) > 0) return { pk: cand, reason: 'Tờ khai lần đầu kỳ ' + periodLabel(last) + ' đã nộp → kỳ kế tiếp ' + periodLabel(cand) + '.' };
    return { pk: containing, reason: 'Mọi kỳ đã kết thúc đều đã nộp tờ khai lần đầu → kỳ chứa ngày lập TKBS (' + periodLabel(containing) + ').' };
  }
  function autoCurrentPeriod(decls, dateIso, kieuKy) { return autoCurrentPeriodInfo(decls, dateIso, kieuKy).pk; }
  function tkbsLabelOf(pk, soLan) { return periodDot(pk) + ' lần ' + soLan; }

  /**
   * applyErrors(project, errors?, options?) →
   * { supplementDecls, khbsRows, ct3738Rows, cases, lateInterest, warnings, byPeriod, current, totals, resolved }
   * options: { currentPeriod, ngayLapTKBS, ngayNopDuKien, inspection, inspectionDate, today }
   */
  function applyErrors(project, errors, options) {
    var rules = RULES;
    errors = errors || project.errors || [];
    var opt = Object.assign({}, project.adjust || {}, options || {});
    var today = opt.today || todayIso();
    var ngayLap = toIso(opt.ngayLapTKBS) || today;
    var payDate = toIso(opt.ngayNopDuKien) || ngayLap;
    var decls = project.decls || [];
    var kk = project.kieuKy || (decls[0] && decls[0].kieuKy) || 'Q';
    var autoInfo = autoCurrentPeriodInfo(decls, ngayLap, kk), autoPk = autoInfo.pk;
    var currentPk = opt.currentPeriod || autoPk;
    var res = { supplementDecls: [], khbsRows: [], ct3738Rows: [], cases: [], lateInterest: [], warnings: [], byPeriod: [], current: null, resolved: {}, options: { currentPeriod: currentPk, autoPeriod: autoPk, autoReason: autoInfo.reason, ngayLapTKBS: ngayLap, ngayNopDuKien: payDate } };
    function warn(level, msg, extra) { res.warnings.push(Object.assign({ level: level, msg: msg }, extra || {})); }
    if (opt.currentPeriod && finalOf(decls.filter(function (d) { return !d.generated && d.soLan === 0; }), currentPk) && declDate(finalOf(decls, currentPk)) <= ngayLap) {
      var wf = ruleMsg('W-CURRENT-FILED', {}, 'Tờ khai kỳ hiện tại đã nộp: [37]/[38] cần đưa vào kỳ kế tiếp chưa nộp.');
      warn(wf.level || 'warn', periodLabel(currentPk) + ': ' + wf.msg + ' Gợi ý: ' + periodLabel(autoPk) + '.', { code: wf.id, period: currentPk });
    }
    var groups = {}, currentItems = [];
    errors.forEach(function (err) {
      if (err.disabled) return;
      if (err.customError) { warn('error', 'Sai sót "' + (err.lyDo || err.type) + '": ô chi tiết chỉ tiêu không đọc được (' + err.customError + ') — chưa áp dụng.', { errorId: err.id }); return; }
      var t = errorTypeById(err.type);
      if (!t) { warn('error', 'Sai sót "' + (err.lyDo || err.id) + '": loại "' + err.type + '" không có trong bộ quy tắc.'); return; }
      var chosen = err.handling ? normTreatment(err.handling) : t.treatment;
      if (chosen === 'USER') chosen = 'TKBS';
      var reason = '';
      var base = err.period ? finalOf(decls, err.period) : null;
      var ctx = { period: err.period, ct43Before: base ? base.ct.ct43 : null };
      if (chosen === 'SIMULATE') {
        if (t.needsDirection && errorDirection(err) === 'increase') { chosen = 'CURRENT'; reason = 'Tăng khấu trừ → kê khai kỳ phát hiện (như bỏ sót đầu vào).'; }
        else if (!base) { chosen = 'CURRENT'; reason = 'Chưa nạp tờ khai kỳ gốc nên không mô phỏng được — tạm ghi kỳ hiện tại; hãy nạp tờ khai kỳ ' + periodLabel(err.period) + ' để kiểm tra.'; warn('warn', reason, { errorId: err.id }); }
        else {
          var sd = errorDeltas(err, 'TKBS', rules, ctx);
          var simIn = clone(base.ct); Object.keys(sd.deltas).forEach(function (k) { simIn[k] = r2(n(simIn[k]) + sd.deltas[k]); });
          var simNew = recompute(simIn), simOld = recompute(base.ct), v = caseVars(simOld, simNew);
          var refundDown = v.old42 > 0 && v.new41 < v.old42;
          chosen = v.delta40 > 0 || refundDown ? 'TKBS' : 'CURRENT';
          reason = 'Mô phỏng TKBS kỳ ' + periodLabel(err.period) + ': chênh lệch [40] = ' + fmtNum(v.delta40) + ', chênh lệch [43] = ' + fmtNum(v.delta43) + (refundDown ? ', giảm số được hoàn' : '') + ' → ' + (chosen === 'TKBS' ? 'lập TKBS kỳ gốc (tăng thuế phải nộp/giảm hoàn — NĐ 181/2025 Đ23 k6 a).' : 'không lập TKBS, ghi [37]/[38] kỳ hiện tại (chỉ thay đổi số còn khấu trừ — NĐ 181/2025 Đ23 k6 b).');
          if (chosen === 'TKBS' && t.id === 'IN_OVER' && v.delta43 < 0) { var ws = ruleMsg('W-IN-OVER-SPLIT', {}, ''); if (ws.msg) warn(ws.level, ws.msg, { errorId: err.id, period: err.period }); }
        }
      } else if (err.handling && normTreatment(err.handling) !== t.treatment && t.treatment !== 'USER' && t.treatment !== 'SIMULATE') {
        warn('warn', '"' + (err.lyDo || t.label) + '": cách xử lý ' + (chosen === 'TKBS' ? 'TKBS' : 'kỳ hiện tại') + ' khác mặc định của bộ quy tắc (' + (rules.treatmentEnum[t.defaultTreatment] || t.defaultTreatment) + '). ' + (t.hint || ''), { errorId: err.id });
      }
      res.resolved[err.id] = { handling: chosen, reason: reason, typeTreatment: t.treatment };
      if (['ADJ_SELLER_ERR', 'RATE_OUT_UNDER', 'RATE_OUT_OVER'].indexOf(t.id) >= 0) { var wa = ruleMsg('W-ADJ-ERR', {}, ''); if (wa.msg) warn(wa.level, wa.msg, { errorId: err.id }); }
      if (t.id === 'IN_MISSED') { var wi = ruleMsg('W-INMISSED-COND', {}, ''); if (wi.msg) warn(wi.level, wi.msg, { errorId: err.id }); }
      var dd = errorDeltas(err, chosen, rules, ctx);
      dd.warnings.forEach(function (w) { warn('warn', w, { errorId: err.id }); });
      if (chosen === 'CURRENT') { currentItems.push({ err: err, type: t, deltas: dd.deltas, tax: dd.tax, reason: reason }); return; }
      if (!err.period) { warn('error', 'Sai sót "' + (err.lyDo || t.label) + '" chưa chọn kỳ sai sót — chưa áp dụng.', { errorId: err.id }); return; }
      (groups[err.period] = groups[err.period] || []).push({ err: err, type: t, deltas: dd.deltas, tax: dd.tax });
    });

    Object.keys(groups).sort(comparePeriodKey).forEach(function (pk) {
      var items = groups[pk];
      var base = finalOf(decls, pk);
      if (!base) { warn('error', 'Chưa nạp tờ khai kỳ ' + periodLabel(pk) + ' — không thể lập TKBS. Hãy nạp tờ khai (lần đầu/bổ sung gần nhất) của kỳ này.', { period: pk }); return; }
      var due = dueDate(pk, project.dueOverrides, rules);
      var limit = addYears(due, rules.supplement.limitYears || 5);
      var vars0 = { kyGoc: periodLabel(pk), soNgay: diffDays(ngayLap, limit) };
      if (ngayLap > limit) { var w5 = ruleMsg('W-5Y', vars0, 'Quá 05 năm kể từ hạn nộp hồ sơ kỳ {kyGoc}: không được khai bổ sung.'); warn('error', w5.msg, { period: pk, code: 'W-5Y', blocked: true }); return; }
      if (diffDays(ngayLap, limit) <= (rules.deadlines.nearDays || 90)) { var wn = ruleMsg('W-5Y-NEAR', vars0, 'Còn {soNgay} ngày là hết thời hạn 05 năm khai bổ sung kỳ {kyGoc}.'); warn(wn.level, wn.msg, { period: pk, code: wn.id }); }
      if (due < '2026-07-01') { var wp = ruleMsg('W-PRE2607', vars0, ''); if (wp.msg) warn(wp.level, periodLabel(pk) + ': ' + wp.msg, { period: pk, code: wp.id }); }
      if (opt.inspection) { var wa = ruleMsg('W-AUDIT', vars0, 'Đã có QĐ thanh tra/kiểm tra kỳ {kyGoc}.'); warn('error', wa.msg + (opt.inspectionDate ? ' (QĐ ngày ' + fmtDate(opt.inspectionDate) + ')' : ''), { period: pk, code: wa.id }); }
      var newCtIn = clone(base.ct), total = {};
      items.forEach(function (it) { Object.keys(it.deltas).forEach(function (k) { newCtIn[k] = r2(n(newCtIn[k]) + it.deltas[k]); total[k] = r2(n(total[k]) + it.deltas[k]); }); });
      var newCt = recompute(newCtIn);
      var oldCt = recompute(base.ct);
      var recalled = 0;
      if (n(newCt.ct42) > n(newCt.ct41)) { recalled = r2(n(newCt.ct42) - n(newCt.ct41)); newCtIn.ct42 = newCt.ct41; newCt = recompute(newCtIn); }
      var soLan = Math.max.apply(null, versionsOf(decls, pk).map(function (d) { return d.soLan; })) + 1;
      var nd = clone(base);
      delete nd.rawXml;
      nd.id = 'gen-' + pk + '-' + soLan; nd.loai = 'B'; nd.soLan = soLan; nd.ct = newCt; nd.generated = true; nd.headerIssues = [];
      nd.ngayLap = ngayLap; nd.ngayKy = ngayLap; nd.ngayNop = ngayLap; nd.baseId = base.id; nd.baseXml = base.rawXml ? base.id : null;
      nd.source = { type: 'generated', fileName: '' };
      nd.errorIds = items.map(function (it) { return it.err.id; });
      var lyDo = items.map(function (it) { return it.err.lyDo || it.type.label; }).filter(Boolean).join('; ');
      nd.note = 'TKBS tự lập: ' + lyDo;
      var cs = classifyCase(oldCt, newCt, rules);
      var v = cs.vars;
      // KHBS (01-1/KHBS)
      var changes = [];
      CT_KEYS.forEach(function (k) {
        if (k === 'ct21') return;
        var o = n(oldCt[k]), nv = n(newCt[k]);
        if (Math.abs(nv - o) >= 0.5) changes.push({ ct: k, code: CT_BY_KEY[k].code, name: CT_BY_KEY[k].name, old: o, new: nv, diff: r2(nv - o), huong: k === 'ct40' ? (nv > o ? 'Tăng số thuế phải nộp' : 'Giảm số thuế phải nộp') : k === 'ct43' ? (nv > o ? 'Tăng số thuế được khấu trừ' : 'Giảm số thuế được khấu trừ') : k === 'ct42' ? (nv > o ? 'Tăng số đề nghị hoàn' : 'Giảm số đề nghị hoàn') : '' });
      });
      changes.forEach(function (c, i) { res.khbsRows.push({ periodKey: pk, tkbsId: nd.id, tkbsLabel: tkbsLabelOf(pk, soLan), stt: i + 1, ct: c.ct, code: c.code, name: c.name, daKeKhai: c.old, dieuChinh: c.new, chenhLech: c.diff, huong: c.huong, lyDo: lyDo }); });
      var caseRec = { periodKey: pk, tkbsId: nd.id, id: cs.id, name: cs.def.name, effect: cs.def.effect, effectText: cs.def.effectText, steps: cs.def.steps, vars: v, payment: !!cs.def.payment };
      res.cases.push(caseRec);
      if (soLan >= 2) { var wb = ruleMsg('W-TKBS-BASE', { n: soLan, 'n-1': soLan - 1 }, 'TKBS lần {n} so sánh với bản liền trước.'); warn('info', periodLabel(pk) + ': ' + wb.msg.replace('{n-1}', soLan - 1), { period: pk, code: wb.id }); }
      if (cs.id === 'TH7') { var w7 = ruleMsg('W-NOTAX-EXPL', {}, ''); if (w7.msg) warn(w7.level, periodLabel(pk) + ': ' + w7.msg, { period: pk, code: w7.id }); }
      if (cs.id === 'TH_MIXED') warn('warn', periodLabel(pk) + ': chênh lệch [40] và chênh lệch [43] cùng dấu (' + fmtNum(v.delta40) + ' / ' + fmtNum(v.delta43) + ') — kiểm tra lại.', { period: pk });
      // Hoàn thuế
      if (v.old42 > 0 && n(newCt.ct41) < v.old42) { var wr = ruleMsg('W-REFUND', { kyGoc: periodLabel(pk), soTien: fmtNum(r2(v.old42 - n(newCt.ct41))) }, 'Số hoàn kỳ {kyGoc} giảm {soTien} đồng.'); warn(wr.level, wr.msg, { period: pk, code: wr.id }); }
      if (v.delta42 > 0) { var wu = ruleMsg('W-REFUND-UP', {}, 'Chỉ được khai bổ sung tăng số đề nghị hoàn khi chưa nộp hồ sơ đề nghị hoàn.'); warn('warn', wu.msg, { period: pk, code: wu.id }); }
      // Tiền chậm nộp
      var li = null, principal = caseInterestBase(cs);
      if (principal >= 1) {
        var lc = lateInterestCalc(principal, due, payDate, rules);
        li = { periodKey: pk, tkbsId: nd.id, base: principal, due: due, ruleDue: ruleDueDate(pk), from: lc.from, to: lc.to, payDate: payDate, days: lc.days, rate: lc.rate, amount: lc.amount, basis: rules.lateInterest.basis };
        res.lateInterest.push(li);
        var paidRec = (project.paid || {})[pk];
        var paidAmt = paidRec && paidRec.amount != null && paidRec.amount !== '' ? n(paidRec.amount) : null;
        var extra = paidAmt != null ? Math.max(0, r2(newCt.ct40 - paidAmt)) : principal;
        warn('warn', periodLabel(pk) + ': thuế phải nộp tăng ' + fmtNum(principal) + ' đ' + (paidAmt != null ? ' (cần nộp thêm ' + fmtNum(extra) + ' đ sau khi trừ số đã nộp ' + fmtNum(paidAmt) + ' đ)' : '') + '; tiền chậm nộp ước tính ' + fmtNum(lc.amount) + ' đ = ' + fmtNum(principal) + ' × ' + String(lc.rate * 100).replace('.', ',') + '% × ' + lc.days + ' ngày (hạn ' + fmtDate(due) + ', nộp ' + fmtDate(payDate) + ').', { period: pk, code: 'LATE' });
        if (paidAmt != null && paidAmt > v.old40) { var wo = ruleMsg('W-OFFSET', {}, ''); if (wo.msg) warn(wo.level, wo.msg, { period: pk, code: wo.id }); }
        var pen = rules.penalty20 || {}; var prate = pen.rate != null ? pen.rate : 0.2;
        if (opt.inspection) { var w20 = ruleMsg('W-PENALTY20', {}, 'Rủi ro phạt 20% số thuế khai thiếu.'); warn('error', w20.msg + ' Ước tính ' + Math.round(prate * 100) + '% × ' + fmtNum(principal) + ' = ' + fmtNum(r0(principal * prate)) + ' đ.', { period: pk, code: w20.id }); li.penalty = r0(principal * prate); }
        else { var wnp = ruleMsg('W-NOPENALTY', {}, 'Không bị xử phạt nếu nộp đủ số thuế tăng thêm trước khi CQT công bố QĐ kiểm tra.'); warn('info', periodLabel(pk) + ': ' + wnp.msg + ' (Nếu có QĐ kiểm tra: phạt ' + Math.round(prate * 100) + '% = ' + fmtNum(r0(principal * prate)) + ' đ.)', { period: pk, code: wnp.id }); li.penalty = 0; li.penaltyIfAudit = r0(principal * prate); }
      }
      // CT37/38
      var d43 = v.delta43, row3738 = null;
      if (Math.abs(d43) >= 0.5) {
        var ct37 = d43 < 0 ? -d43 : 0, ct38 = d43 > 0 ? d43 : 0;
        var tVars = { ngayNopTKBS: fmtDate(ngayLap), lanBS: soLan, kyGoc: periodLabel(pk), lyDoSaiSot: lyDo, ct43Cu: fmtNum(oldCt.ct43), ct43Moi: fmtNum(newCt.ct43), ct37: fmtNum(ct37), ct38: fmtNum(ct38), kyHienTai: periodLabel(currentPk), delta40: fmtNum(v.delta40), absDelta40: fmtNum(Math.abs(v.delta40)), ngayNopThue: fmtDate(payDate), tienChamNop: li ? fmtNum(li.amount) : '0' };
        var tm = rules.templatesById[d43 < 0 ? 'ct37-TKBS' : 'ct38-TKBS'];
        var explain = tm ? tpl(tm.text, tVars) + (cs.id === 'TH5' && tm.optionalTH5 ? ' ' + tpl(tm.optionalTH5, tVars) : '') + (cs.id === 'TH6' && tm.optionalTH6 ? ' ' + tpl(tm.optionalTH6, tVars) : '') : 'Điều chỉnh ' + (d43 < 0 ? 'giảm' : 'tăng') + ' thuế GTGT còn được khấu trừ do lập TKBS ' + tkbsLabelOf(pk, soLan) + ' ([43] từ ' + tVars.ct43Cu + ' thành ' + tVars.ct43Moi + ').';
        row3738 = { key: 'gen:' + nd.id, auto: true, generated: true, periodKey: pk, tkbsId: nd.id, tkbsLabel: tkbsLabelOf(pk, soLan), ngayNop: ngayLap, kyKK: currentPk, ct43Old: oldCt.ct43, ct43New: newCt.ct43, ct37: r2(ct37), ct38: r2(ct38), lyDo: lyDo, ghiChu: cs.id + ' - ' + cs.def.name, explain: explain, caseId: cs.id };
        res.ct3738Rows.push(row3738);
        // W-PROP: kỳ trung gian đã dùng số khấu trừ bị giảm
        if (d43 < 0) {
          var nk = nextPeriod(pk), mid = null;
          while (nk && comparePeriodKey(nk, currentPk) < 0) { var f = finalOf(decls, nk); if (f && f.ct.ct40 >= 1) { mid = f; break; } nk = nextPeriod(nk); }
          if (mid) {
            var riskBase = Math.min(-d43, n(mid.ct.ct40)), rl = lateInterestCalc(riskBase, dueDate(mid.periodKey, project.dueOverrides, rules), payDate, rules);
            var msgP = 'TKBS làm giảm ' + fmtNum(-d43) + ' đ thuế còn được khấu trừ của kỳ ' + periodLabel(pk) + ', trong khi kỳ ' + periodLabel(mid.periodKey) + ' sau đó đã dùng số khấu trừ này để bù trừ thuế phải nộp. Quy định chỉ yêu cầu ghi [37] ở kỳ hiện tại, nhưng khi thanh tra, CQT có thể tính chậm nộp từ kỳ ' + periodLabel(mid.periodKey) + ': ' + (rl.amount ? 'ước tính ' + fmtNum(rl.amount) + ' đ (' + fmtNum(riskBase) + ' đ × ' + rl.days + ' ngày)' : 'hiện chưa phát sinh vì hạn nộp kỳ ' + periodLabel(mid.periodKey) + ' (' + fmtDate(dueDate(mid.periodKey, project.dueOverrides, rules)) + ') chưa qua ngày nộp dự kiến') + '. Số này chỉ để tham khảo, không cộng vào số phải nộp.';
            warn('warn', msgP, { period: pk, code: 'W-PROP', risk: rl.amount });
            caseRec.propRisk = rl.amount;
          }
        }
      }
      var khbsSum = { c07: v.delta40, c08: v.delta43, c09: v.delta42, c10: v.delta40, c11: li ? li.amount : 0, c12: v.delta43, c13: v.delta42, c14: recalled || (v.old42 > 0 && n(newCt.ct41) < v.old42 ? r2(v.old42 - n(newCt.ct41)) : 0) };
      res.supplementDecls.push(nd);
      res.byPeriod.push({ periodKey: pk, base: base, newDecl: nd, oldCt: oldCt, newCt: newCt, deltas: total, changes: changes, caseInfo: caseRec, lateInterest: li, ct3738: row3738, due: due, limit: limit, khbsSummary: khbsSum, errors: items.map(function (it) { return it.err.id; }) });
    });

    // Điều chỉnh vào kỳ hiện tại (không TKBS)
    if (currentItems.length) {
      var cd = {};
      currentItems.forEach(function (it) { Object.keys(it.deltas).forEach(function (k) { cd[k] = r2(n(cd[k]) + it.deltas[k]); }); });
      var cur = finalOf(decls, currentPk);
      var preview = null;
      if (cur) { var pin = clone(cur.ct); Object.keys(cd).forEach(function (k) { pin[k] = r2(n(pin[k]) + cd[k]); }); preview = recompute(pin); }
      var items = currentItems.map(function (it) {
        var tax = Math.abs(n(it.tax));
        var c37 = n(it.deltas.ct37), c38 = n(it.deltas.ct38);
        var tm = null;
        (rules.ct37ct38Templates || []).forEach(function (x) { if (!tm && (x.for || []).indexOf(it.type.id) >= 0 && (x.ct === 'ct37|ct38' || (c37 && x.ct === 'ct37') || (c38 && x.ct === 'ct38'))) tm = x; });
        var tVars = { kyGoc: periodLabel(it.err.period), kyHienTai: periodLabel(currentPk), tienThue: fmtNum(tax), soHD: it.err.soHD ? '01' : '', dsHoaDon: it.err.soHD || '', lyDo: it.err.lyDo || '', tangGiam: c37 ? 'giảm' : 'tăng', ctSo: c37 ? '37' : '38', soTien: fmtNum(tax), giaTri: fmtNum(Math.abs(n(it.err.value))) };
        var explain = tm ? tpl(tm.text, tVars) : (it.err.lyDo || it.type.label) + ' — kê khai vào kỳ ' + periodLabel(currentPk) + '.';
        return { errorId: it.err.id, type: it.type.id, label: it.type.label, lyDo: it.err.lyDo, period: it.err.period, deltas: it.deltas, basis: it.type.basis, reason: it.reason, explain: explain, ct37: c37, ct38: c38 };
      });
      items.forEach(function (it) {
        if (Math.abs(it.ct37) >= 0.5 || Math.abs(it.ct38) >= 0.5) res.ct3738Rows.push({ key: 'cur:' + it.errorId, auto: true, direct: true, periodKey: it.period || '', tkbsLabel: 'Không lập TKBS' + (it.period ? ' (' + periodDot(it.period) + ')' : ''), ngayNop: ngayLap, kyKK: currentPk, ct43Old: null, ct43New: null, ct37: r2(it.ct37), ct38: r2(it.ct38), lyDo: it.lyDo || it.label, ghiChu: it.label + ' — điều chỉnh tại kỳ hiện tại', explain: it.explain });
      });
      res.current = { periodKey: currentPk, deltas: cd, items: items, baseDecl: cur, previewCt: preview };
      if (!cur) warn('info', 'Có ' + currentItems.length + ' khoản điều chỉnh vào kỳ hiện tại ' + periodLabel(currentPk) + ' (không lập TKBS) — kê khai khi lập tờ khai kỳ này.', { period: currentPk });
    }
    var t37 = 0, t38 = 0; res.ct3738Rows.forEach(function (r) { t37 += n(r.ct37); t38 += n(r.ct38); });
    res.totals = { ct37: r2(t37), ct38: r2(t38), lateInterest: res.lateInterest.reduce(function (s, l) { return s + l.amount; }, 0) };
    return res;
  }

  /* ===================== Bảng CHECK TK ===================== */
  var CHECK_ROWS = [
    { key: 'ct22', stt: 'I', label: 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang', code: '22', bold: true, agg: 'first' },
    { key: 'ct23', stt: 'II', label: 'Giá trị hàng hóa, dịch vụ mua vào trong kỳ', code: '23', bold: true },
    { key: 'ct23a', stt: '', label: 'Trong đó: hàng hóa, dịch vụ nhập khẩu', code: '23a', sub: true },
    { key: 'ct24', stt: '1', label: 'Thuế GTGT của HH, DV mua vào trong kỳ', code: '24' },
    { key: 'ct24a', stt: '', label: 'Trong đó: thuế GTGT hàng hóa, dịch vụ nhập khẩu', code: '24a', sub: true },
    { key: 'ct25', stt: '2', label: 'Thuế GTGT của HH, DV mua vào được khấu trừ trong kỳ', code: '25' },
    { key: 'ct34', stt: 'III', label: 'Tổng doanh thu bán hàng và cung cấp dịch vụ', code: '34', bold: true },
    { key: 'ct26', stt: '1', label: 'Doanh thu không chịu thuế', code: '26' },
    { key: 'ct29', stt: '2', label: 'Doanh thu chịu thuế suất 0%', code: '29' },
    { key: 'ct30', stt: '3', label: 'Doanh thu chịu thuế suất 5%', code: '30' },
    { key: 'ct32', stt: '4', label: 'Doanh thu chịu thuế suất 10% (gồm 8%)', code: '32' },
    { key: 'ct32a', stt: '5', label: 'DT hàng hóa dịch vụ bán ra không tính thuế', code: '32a' },
    { key: 'ct32b', stt: '', label: 'Không tính vào giá tính thuế (mẫu TT 89/2026)', code: '32b', sub: true, optional: true },
    { key: 'ct34a', stt: '', label: 'Doanh thu ngoài phạm vi chịu thuế (mẫu TT 89/2026)', code: '34a', sub: true, optional: true },
    { key: 'ct35', stt: 'IV', label: 'Thuế GTGT của HH, DV bán ra TK GTGT', code: '35', bold: true },
    { key: 'ct36', stt: 'V', label: 'Thuế giá trị gia tăng phát sinh trong kỳ', code: '36', bold: true },
    { key: 'adj', stt: 'VI', label: 'Điều chỉnh tăng giảm số thuế GTGT của kỳ trước', code: '', bold: true, header: true },
    { key: 'ct37', stt: '1', label: 'Điều chỉnh giảm', code: '37' },
    { key: 'ct38', stt: '2', label: 'Điều chỉnh tăng', code: '38' },
    { key: 'ct39a', stt: '', label: 'Thuế giá trị gia tăng nhận bàn giao được khấu trừ trong kỳ', code: '39a' },
    { key: 'ct40a', stt: '', label: 'Thuế giá trị gia tăng phải nộp của hoạt động sản xuất kinh doanh trong kỳ', code: '40a' },
    { key: 'ct40b', stt: '', label: 'Thuế GTGT mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt động SXKD cùng kỳ', code: '40b' },
    { key: 'ct40', stt: 'VII', label: 'Thuế giá trị gia tăng còn phải nộp trong kỳ', code: '40', bold: true },
    { key: 'ct41', stt: 'VIII', label: 'Thuế giá trị gia tăng chưa khấu trừ hết kỳ này', code: '41', bold: true, agg: 'last' },
    { key: 'ct42', stt: '1', label: 'Thuế GTGT đề nghị hoàn', code: '42' },
    { key: 'ct43', stt: 'IX', label: 'Thuế GTGT còn được khấu trừ chuyển sang kỳ sau', code: '43', bold: true, agg: 'last' },
    { key: 'paid', stt: '', label: 'Số thuế GTGT đã nộp', code: '', manual: true, highlight: true },
    { key: 'paidDate', stt: '', label: 'Ngày nộp thuế', code: '', manual: true, date: true, highlight: true }
  ];

  function buildCheckTable(project, opts) {
    opts = opts || {};
    var applied = opts.applied !== undefined ? opts.applied : ((project.errors || []).length ? applyErrors(project) : null);
    var includeGen = opts.includeGenerated !== false;
    var decls = includeGen ? allDecls(project, applied) : (project.decls || []);
    var year = +project.namKiemTra, kk = project.kieuKy || 'Q';
    var pks = periodsForYear(year, kk, true);
    var columns = [], periods = [];
    pks.forEach(function (pk, pi) {
      var vs = versionsOf(decls, pk);
      var cols = vs.map(function (d) { return { id: d.id, periodKey: pk, declId: d.id, soLan: d.soLan, generated: !!d.generated, label: versionLabel(d) + ' ' + (fmtDate(declDate(d)) || '…/…/…'), decl: d, inYear: pi > 0 }; });
      if (!cols.length) cols.push({ id: 'empty-' + pk, periodKey: pk, declId: null, soLan: 0, empty: true, label: 'Lần đầu …/…/…', inYear: pi > 0 });
      cols[cols.length - 1].isFinal = !cols[cols.length - 1].empty;
      var agg = project.bkAgg && project.bkAgg[pk];
      if (agg && (agg.has.br || agg.has.mv) && opts.showBk !== false) {
        var cmpVer = null, sl = agg.soLan && (agg.soLan.br != null ? agg.soLan.br : agg.soLan.mv);
        if (sl != null) cmpVer = vs.filter(function (d) { return d.soLan === sl && !d.generated; })[0] || null;
        var fin = vs.length ? vs[vs.length - 1] : null;
        var orig = vs.filter(function (d) { return !d.generated; })[0] || null;
        cols.push({ id: 'bk-' + pk, periodKey: pk, bk: true, agg: agg, label: 'Bảng kê', origDecl: orig, cmpDecl: cmpVer || fin, cmpNote: cmpVer ? 'so với ' + versionLabel(cmpVer) + ' (theo cột "Tờ khai" của bảng kê)' : fin ? 'so với bản cuối (' + versionLabel(fin) + ')' : 'chưa có tờ khai', inYear: pi > 0 });
      }
      periods.push({ key: pk, label: periodLabel(pk), columns: cols, inYear: pi > 0 });
      columns = columns.concat(cols);
    });
    var yearPks = pks.slice(1);
    var finals = yearPks.map(function (pk) { return finalOf(decls, pk); });
    var withData = finals.filter(Boolean);
    var qtAuto = {};
    if (project.tndn && +project.tndn.nam === year && project.tndn.doanhThu != null) qtAuto.ct34 = project.tndn.doanhThu;
    var BK_KEYS = { ct27: 1, ct28: 1, ct31: 1, ct33: 1, ct23: 1, ct24: 1, ct25: 1, ct26: 1, ct29: 1, ct30: 1, ct32: 1, ct32a: 1, ct32b: 1, ct34a: 1, ct34: 1, ct35: 1, ct36: 1 };
    var bctcCol = project.bctcCol || {};
    var rows = CHECK_ROWS.map(function (rd) {
      var row = Object.assign({}, rd, { values: {}, total: null, pm: null, qt: null, clPm: null, clQt: null, lyDo: (project.lyDo || {})[rd.key] || '' });
      if (rd.header) {
        columns.forEach(function (c) { if (c.decl) row.values[c.id] = r2(n(c.decl.ct.ct38) - n(c.decl.ct.ct37)); });
        return row;
      }
      if (rd.key === 'paid' || rd.key === 'paidDate') {
        var tot = 0, has = false;
        periods.forEach(function (p) { var pr = (project.paid || {})[p.key]; var dcs = p.columns.filter(function (x) { return !x.bk; }), last = dcs[dcs.length - 1] || p.columns[0]; if (pr) { row.values[last.id] = rd.key === 'paid' ? (pr.amount === '' || pr.amount == null ? null : n(pr.amount)) : (pr.date || ''); if (rd.key === 'paid' && p.inYear && pr.amount !== '' && pr.amount != null) { tot += n(pr.amount); has = true; } } });
        if (rd.key === 'paid') { row.total = has ? r2(tot) : null; var pmP = (project.pm || {}).paid; row.pm = pmP == null || pmP === '' ? null : n(pmP); if (row.total != null && row.pm != null) row.clPm = r2(row.total - row.pm); }
        return row;
      }
      columns.forEach(function (c) { if (c.decl) row.values[c.id] = n(c.decl.ct[rd.key]); });
      if (withData.length) {
        if (rd.agg === 'first') row.total = n(withData[0].ct[rd.key]);
        else if (rd.agg === 'last') row.total = n(withData[withData.length - 1].ct[rd.key]);
        else row.total = r2(withData.reduce(function (s, d) { return s + n(d.ct[rd.key]); }, 0));
      }
      // Bảng kê theo kỳ
      row.bkDiff = {};
      if (BK_KEYS[rd.key]) {
        var bt = 0, bh = false;
        columns.forEach(function (c) {
          if (!c.bk) return;
          var bv = r2(n(c.agg[rd.key])); row.values[c.id] = bv;
          if (c.cmpDecl) row.bkDiff[c.periodKey] = r2(n(c.cmpDecl.ct[rd.key]) - bv);
          if (c.origDecl && c.cmpDecl && c.origDecl !== c.cmpDecl) { row.bkDiffOrig = row.bkDiffOrig || {}; row.bkDiffOrig[c.periodKey] = r2(n(c.origDecl.ct[rd.key]) - bv); }
          if (c.inYear) { bt += bv; bh = true; }
        });
        row.bkTotal = bh ? r2(bt) : null;
        if (row.total != null && row.bkTotal != null) row.clBk = r2(row.total - row.bkTotal);
      }
      if (bctcCol[rd.key]) { row.bctc = r2(bctcCol[rd.key].v); row.bctcNote = bctcCol[rd.key].note; if (row.total != null) row.clBctc = r2(row.total - row.bctc); }
      var pm = (project.pm || {})[rd.key]; row.pm = pm == null || pm === '' ? null : n(pm);
      var qt = (project.qt || {})[rd.key]; row.qt = qt == null || qt === '' ? (qtAuto[rd.key] != null ? qtAuto[rd.key] : null) : n(qt);
      row.qtAuto = (qt == null || qt === '') && qtAuto[rd.key] != null;
      if (row.total != null && row.pm != null) row.clPm = r2(row.total - row.pm);
      if (row.total != null && row.qt != null) row.clQt = r2(row.total - row.qt);
      return row;
    });
    // Kiểm tra logic từng tờ khai
    var checks = buildChecks(project, decls, pks, applied);
    rows = rows.filter(function (r) { return !r.optional || r.pm != null || Object.keys(r.values).some(function (k) { return nz(r.values[k]); }); });
    var notes = [];
    if (decls.length) {
      var xb = RULES.formulas && RULES.formulas.notes && RULES.formulas.notes.excel_bug;
      notes.push({ level: 'info', code: 'EXCEL-41', msg: 'Đối chiếu với file Excel CHECK gốc: ' + (xb || 'công thức [41] trong sheet CHECK TK bỏ sót [37], [38], [39a]') + '. App dùng công thức đầy đủ [41] = max(0, −([36] − [22] + [37] − [38] − [39a])); cột Tổng cộng lấy [41]/[43] của kỳ cuối năm, không dùng công thức N26 của Excel.' });
      var tt80new = decls.filter(function (d) { return !d.generated && d.formVersion !== 'TT89' && periodRange(d.periodKey).from >= '2026-07-01'; });
      if (tt80new.length) { var wf = ruleMsg('W-FORM', {}, 'Tờ khai theo mẫu TT 80/2021 – hợp lệ trong thời gian chuyển tiếp.'); notes.push({ level: 'info', code: wf.id, msg: wf.msg + ' (' + tt80new.map(function (d) { return periodLabel(d.periodKey) + ' ' + versionLabel(d).toLowerCase(); }).join(', ') + ')' }); }
    }
    var lastWith = withData.length ? withData[withData.length - 1].periodKey : null;
    return {
      header: { mst: project.mst, tenNNT: project.tenNNT, dchiNNT: project.dchiNNT, title: 'TẬP HỢP SỐ LIỆU TRÊN TỜ KHAI GTGT ' + (kk === 'M' ? 'THÁNG' : 'QUÝ') + ' - NĂM ' + year },
      year: year, kieuKy: kk, periods: periods, columns: columns, rows: rows, checks: checks, notes: notes, applied: applied,
      totalNote: withData.length ? ('Tổng cộng dùng bản cuối cùng mỗi kỳ năm ' + year + '; [22] lấy kỳ ' + periodLabel(withData[0].periodKey) + ', [41]/[43] lấy kỳ ' + periodLabel(lastWith) + (withData.length < yearPks.length ? ' (chưa đủ ' + yearPks.length + ' kỳ)' : '')) : 'Chưa có tờ khai trong năm ' + year
    };
  }

  /** Tập hợp cảnh báo: công thức từng bản; chuỗi [22] (bản cuối mỗi kỳ); TKBS không đổi số; MST; CT37/38 chưa giải trình */
  function buildChecks(project, decls, pks, applied) {
    var checks = [];
    function push(d, iss) { checks.push(Object.assign({ declId: d ? d.id : null, periodKey: d ? d.periodKey : iss.periodKey, version: d ? versionLabel(d) : '', generated: d ? !!d.generated : false, fileName: d && d.source ? d.source.fileName : '' }, iss)); }
    var pm = project.mst ? project.mst.replace(/\D/g, '') : '';
    sortDecls(decls).forEach(function (d) {
      if (pks && pks.indexOf(d.periodKey) < 0) return;
      validate(d).forEach(function (iss) { push(d, iss); });
      if (pm && d.mst && d.mst.replace(/\D/g, '') !== pm) push(d, { level: 'error', code: 'L12', ct: '', msg: 'MST ' + d.mst + ' khác MST hồ sơ ' + project.mst + '.' });
      var vs = versionsOf(decls, d.periodKey), idx = vs.indexOf(d);
      if (idx > 0) {
        var pv = vs[idx - 1], same = CT_KEYS.every(function (k) { return Math.abs(n(pv.ct[k]) - n(d.ct[k])) < 0.5; });
        if (same) push(d, { level: 'info', code: 'I01', ct: '', msg: 'TKBS ' + versionLabel(d) + ' không thay đổi chỉ tiêu số nào so với ' + versionLabel(pv) + '.' });
      }
      if (idx === vs.length - 1) {
        var prevVs = versionsOf(decls, prevPeriod(d.periodKey));
        if (prevVs.length) chainCheck(d, prevVs).forEach(function (iss) { push(d, iss); });
      }
    });
    var c3738 = buildCt3738(project, applied || null, decls);
    c3738.missing.forEach(function (m) {
      if (pks && pks.indexOf(m.periodKey) < 0) return;
      var f = finalOf(decls, m.periodKey);
      push(f, { level: 'warn', code: 'C02', ct: n(m.ct37) >= 1 ? 'ct37' : 'ct38', msg: m.msg });
    });
    var order = { error: 0, warn: 1, info: 2 };
    checks.sort(function (a, b) { return (order[a.level] - order[b.level]) || comparePeriodKey(a.periodKey || '', b.periodKey || ''); });
    return checks;
  }

  /** Gợi ý sai sót từ chênh lệch TK–PM. Số PM là số cả năm nên không xác định được kỳ → để trống kỳ (needsPeriod) cho người dùng chọn.
   *  Thuế suất suy từ tỷ lệ CL thuế / CL doanh thu. */
  function suggestErrorsFromDiff(project, table) {
    table = table || buildCheckTable(project, { includeGenerated: false, applied: null });
    var byKey = {}; table.rows.forEach(function (r) { byKey[r.key] = r; });
    function cl(k) { var r = byKey[k]; return r && r.clPm != null && Math.abs(r.clPm) >= 1 ? r.clPm : 0; }
    var out = [], today = todayIso();
    var revRows = [['ct32', null], ['ct30', '5'], ['ct29', '0'], ['ct26', 'KCT'], ['ct32a', 'KKKTT']].filter(function (x) { return cl(x[0]); });
    var d35 = cl('ct35') || cl('ct28');
    revRows.forEach(function (x) {
      var d = cl(x[0]), rate = x[1], tax = null;
      if (x[0] === 'ct32') {
        var ratio = d35 && revRows.length === 1 ? Math.abs(d35 / d) : null;
        rate = ratio != null && Math.abs(ratio - 0.08) < 0.004 ? '8' : '10';
        tax = ratio != null && ratio > 0.07 && ratio < 0.11 ? Math.abs(d35) : r0(Math.abs(d) * ratePct(rate) / 100);
      } else if (x[0] === 'ct30') tax = d35 && revRows.length === 1 ? Math.abs(d35) : r0(Math.abs(d) * 0.05);
      else tax = 0;
      out.push({ id: uid('ss'), period: '', needsPeriod: true, type: d < 0 ? 'OUT_MISSED' : 'OUT_OVER', rate: rate, value: Math.abs(d), tax: tax, handling: '', lyDo: 'Chênh lệch TK–PM [' + CT_BY_KEY[x[0]].code + '] ' + fmtNum(d) + (x[0] === 'ct32' ? ' (thuế suất suy từ CL thuế ' + fmtNum(d35) + ' → ' + rate + '%)' : '') + ' — chọn kỳ và hóa đơn cụ thể', ngayPhatHien: today, suggested: true });
    });
    var d25 = cl('ct25') || cl('ct24');
    if (d25) {
      var d23 = cl('ct23'), rr = d23 ? Math.abs(d25 / d23) : 0.1;
      var rate2 = Math.abs(rr - 0.08) < 0.004 ? '8' : Math.abs(rr - 0.05) < 0.004 ? '5' : '10';
      out.push({ id: uid('ss'), period: '', needsPeriod: true, type: d25 < 0 ? 'IN_MISSED' : 'IN_OVER', rate: rate2, value: Math.abs(d23 || r0(d25 * 100 / ratePct(rate2))), tax: Math.abs(d25), handling: '', lyDo: 'Chênh lệch TK–PM thuế đầu vào ' + fmtNum(d25) + ' — chọn kỳ và hóa đơn cụ thể', ngayPhatHien: today, suggested: true });
    }
    return out;
  }

  /* ===================== CT37-38 ===================== */
  function buildCt3738(project, applied, declsForCheck) {
    applied = applied !== undefined ? applied : applyErrors(project);
    var decls = project.decls || [];
    var chkDecls = declsForCheck || allDecls(project, applied);
    var ov = project.ct3738Overrides || {};
    var rows = [];
    // (a) TKBS đã nạp: so với bản trước
    var pks = {}; decls.forEach(function (d) { pks[d.periodKey] = 1; });
    Object.keys(pks).sort(comparePeriodKey).forEach(function (pk) {
      var vs = versionsOf(decls, pk);
      for (var i = 1; i < vs.length; i++) {
        var a = vs[i - 1], b = vs[i], d43 = r2(n(b.ct.ct43) - n(a.ct.ct43));
        if (Math.abs(d43) < 1) continue;
        var cs = classifyCase(recompute(a.ct), recompute(b.ct));
        rows.push({ key: 'tk:' + b.id, auto: true, loaded: true, periodKey: pk, tkbsId: b.id, tkbsLabel: periodDot(pk) + ' lần ' + b.soLan, ngayNop: declDate(b), kyKK: autoCurrentPeriod(decls, declDate(b) || todayIso(), b.kieuKy || project.kieuKy) || '', ct43Old: n(a.ct.ct43), ct43New: n(b.ct.ct43), ct37: d43 < 0 ? -d43 : 0, ct38: d43 > 0 ? d43 : 0, lyDo: '', ghiChu: cs.id + ' - ' + cs.def.name, caseId: cs.id });
      }
    });
    (applied ? applied.ct3738Rows : []).forEach(function (r) { rows.push(Object.assign({}, r)); });
    (project.ct3738Manual || []).forEach(function (r) {
      var o = Object.assign({ key: 'man:' + (r.id || uid('m')), manual: true }, r);
      var e = n(o.ct43Old), f = n(o.ct43New);
      if (o.ct37 == null || o.ct37 === '') o.ct37 = f - e > 0 ? 0 : e - f;
      if (o.ct38 == null || o.ct38 === '') o.ct38 = f - e > 0 ? f - e : 0;
      rows.push(o);
    });
    rows.forEach(function (r, i) {
      var o = ov[r.key]; if (o) Object.keys(o).forEach(function (k) { if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; });
      if (!r.manual && !r.direct) { var e = n(r.ct43Old), f = n(r.ct43New); r.ct37 = f - e > 0 ? 0 : r2(e - f); r.ct38 = f - e > 0 ? r2(f - e) : 0; }
      r.tt = i + 1;
      if (!r.direct) {
        var tm = RULES.templatesById[n(r.ct37) >= 0.5 ? 'ct37-TKBS' : 'ct38-TKBS'];
        var mm = String(r.tkbsLabel || '').match(/lần\s*(\d+)/);
        var tv = { ngayNopTKBS: fmtDate(r.ngayNop), lanBS: mm ? mm[1] : '', kyGoc: r.periodKey ? periodLabel(r.periodKey) : '', lyDoSaiSot: r.lyDo || (r.lyDoSaiSot) || '', ct43Cu: fmtNum(r.ct43Old), ct43Moi: fmtNum(r.ct43New), ct37: fmtNum(r.ct37), ct38: fmtNum(r.ct38), kyHienTai: periodLabel(r.kyKK) };
        if (tm && (n(r.ct37) >= 0.5 || n(r.ct38) >= 0.5)) {
          var base = tpl(tm.text, tv);
          if (r.generated && r.explain) { var extra = r.explain.slice(tpl(tm.text, Object.assign({}, tv, { kyHienTai: tv.kyHienTai })).length); base += extra && extra.charAt(0) === ' ' ? extra : ''; }
          r.explain = base;
        }
      }
    });
    // Kiểm tra ngược: tờ khai có [37]/[38] ≠ 0 nhưng chưa đủ giải trình
    var missing = [];
    var byKy = {};
    rows.forEach(function (r) { if (!r.kyKK) return; var b = byKy[r.kyKK] = byKy[r.kyKK] || { ct37: 0, ct38: 0 }; b.ct37 += n(r.ct37); b.ct38 += n(r.ct38); });
    var pks2 = {}; chkDecls.forEach(function (d) { pks2[d.periodKey] = 1; });
    Object.keys(pks2).sort(comparePeriodKey).forEach(function (pk) {
      var f = finalOf(chkDecls, pk); if (!f) return;
      var c37 = n(f.ct.ct37), c38 = n(f.ct.ct38), b = byKy[pk] || { ct37: 0, ct38: 0 };
      if ((c37 >= 1 || c38 >= 1) && (Math.abs(c37 - b.ct37) >= 1 || Math.abs(c38 - b.ct38) >= 1)) {
        missing.push({ periodKey: pk, version: versionLabel(f), ct37: c37, ct38: c38, explained37: r2(b.ct37), explained38: r2(b.ct38), msg: periodLabel(pk) + ' (' + versionLabel(f) + '): [37] = ' + fmtNum(c37) + ', [38] = ' + fmtNum(c38) + ' — đã giải trình [37] ' + fmtNum(b.ct37) + ', [38] ' + fmtNum(b.ct38) + '. Cần bổ sung giải trình chênh lệch ' + fmtNum(c37 - b.ct37) + ' / ' + fmtNum(c38 - b.ct38) + '.' });
      }
    });
    var t37 = 0, t38 = 0; rows.forEach(function (r) { t37 += n(r.ct37); t38 += n(r.ct38); });
    return { rows: rows, missing: missing, totals: { ct37: r2(t37), ct38: r2(t38) } };
  }

  var THUYET_MINH_TPL = 'BẢN THUYẾT MINH ĐIỀU CHỈNH THUẾ GTGT\n\nKính gửi: {{cqt}}\n\nTên người nộp thuế: {{tenNNT}}\nMã số thuế: {{mst}}\nĐịa chỉ: {{dchi}}\n\nCăn cứ Luật Quản lý thuế số 108/2025/QH15 (Điều 12 khoản 5), Nghị định 252/2026/NĐ-CP (Điều 12 khoản 6), Nghị định 181/2025/NĐ-CP (Điều 23 khoản 6, sửa đổi bởi Nghị định 144/2026/NĐ-CP) và Thông tư 89/2026/TT-BTC, Công ty xin giải trình các khoản điều chỉnh tại chỉ tiêu [37], [38] trên tờ khai 01/GTGT như sau:\n\n{{rows}}\n\nTổng điều chỉnh giảm [37]: {{tong37}} đồng; tổng điều chỉnh tăng [38]: {{tong38}} đồng.\n\nCông ty cam kết số liệu giải trình trên là đúng và chịu trách nhiệm trước pháp luật.\n\n{{diaDiem}}, ngày {{ngay}}\nNGƯỜI NỘP THUẾ hoặc ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ';
  function buildThuyetMinh(project, ct3738) {
    ct3738 = ct3738 || buildCt3738(project);
    var lines = ct3738.rows.map(function (r, i) {
      if (r.explain) return (i + 1) + '. ' + r.explain;
      var huong = n(r.ct37) >= 1 ? 'điều chỉnh giảm [37] ' + fmtNum(r.ct37) + ' đồng' : 'điều chỉnh tăng [38] ' + fmtNum(r.ct38) + ' đồng';
      return (i + 1) + '. Tờ khai bổ sung ' + (r.tkbsLabel || '') + (r.ngayNop ? ' (lập ngày ' + fmtDate(r.ngayNop) + ')' : '') + ': [43] từ ' + fmtNum(r.ct43Old) + ' đồng thành ' + fmtNum(r.ct43New) + ' đồng → ' + huong + ' tại tờ khai kỳ ' + periodLabel(r.kyKK) + '.' + (r.lyDo ? ' Lý do: ' + r.lyDo + '.' : '') + (r.ghiChu ? ' ' + r.ghiChu : '');
    });
    if (!lines.length) lines = ['(Chưa có khoản điều chỉnh [37]/[38] cần giải trình)'];
    return tpl(THUYET_MINH_TPL, {
      cqt: project.tenCQT || 'Cơ quan thuế quản lý', tenNNT: project.tenNNT || '', mst: project.mst || '', dchi: project.dchiNNT || '',
      rows: lines.join('\n'), tong37: fmtNum(ct3738.totals.ct37), tong38: fmtNum(ct3738.totals.ct38),
      diaDiem: project.diaDiem || '……', ngay: fmtDate(todayIso())
    });
  }

  /* ===================== VAT phải nộp sau điều chỉnh ===================== */
  /** Tiền chậm nộp ước tính của 1 kỳ: mỗi lần TKBS làm [40] tăng → phần tăng × tỷ lệ × số ngày (hạn nộp kỳ → ngày nộp TKBS / ngày nộp dự kiến) */
  function periodInterest(project, decls, pk, payDate) {
    var vs = versionsOf(decls, pk), due = dueDate(pk, project.dueOverrides), items = [], total = 0;
    for (var i = 1; i < vs.length; i++) {
      var inc = r2(n(vs[i].ct.ct40) - n(vs[i - 1].ct.ct40));
      if (inc < 1) continue;
      var pd = vs[i].generated ? payDate : (toIso(vs[i].ngayNopTien) || declDate(vs[i]) || payDate);
      var l = lateInterestCalc(inc, due, pd);
      items.push({ declId: vs[i].id, version: versionLabel(vs[i]), base: inc, due: due, payDate: pd, days: l.days, amount: l.amount });
      total += l.amount;
    }
    return { total: total, items: items, due: due };
  }
  function buildVatPayable(project, applied) {
    applied = applied !== undefined ? applied : applyErrors(project);
    var decls = allDecls(project, applied);
    var kk = project.kieuKy || 'Q', year = +project.namKiemTra;
    var pks = periodsForYear(year, kk, false);
    var cum = 0, rows = [], totInterest = 0;
    var payDate = toIso((project.adjust || {}).ngayNopDuKien) || todayIso();
    function rowFor(pk, i) {
      var f = finalOf(decls, pk);
      var pr = (project.paid || {})[pk] || {};
      var payable = f ? n(f.ct.ct40) : 0;
      var paid = pr.amount === '' || pr.amount == null ? 0 : n(pr.amount);
      var diff = r2(payable - paid);
      var pi = periodInterest(project, decls, pk, payDate);
      // Phần [40] gốc (tờ khai lần đầu) chưa nộp / nộp chậm, theo số đã nộp và ngày nộp người dùng nhập
      var orig = versionsOf(decls, pk).filter(function (d) { return !d.generated; })[0];
      var orig40 = orig ? Math.min(n(orig.ct.ct40), payable) : 0, oInt = 0, oParts = []; // phần gốc không vượt số phải nộp sau điều chỉnh
      if (orig40 >= 1) {
        var pd = toIso(pr.date), paidOrig = Math.min(paid, orig40);
        if (paidOrig >= 1 && pd && pd > pi.due) { var l1 = lateInterestCalc(paidOrig, pi.due, pd); if (l1.amount) { oInt += l1.amount; oParts.push(fmtNum(paidOrig) + ' nộp ' + fmtDate(pd) + ' × ' + l1.days + ' ngày'); } }
        var short = r2(orig40 - paid);
        if (short >= 1) { var l2 = lateInterestCalc(short, pi.due, payDate); if (l2.amount) { oInt += l2.amount; oParts.push(fmtNum(short) + ' chưa nộp × ' + l2.days + ' ngày (đến ' + fmtDate(payDate) + ')'); } }
      }
      var auto = !f ? 'Chưa có tờ khai' : payable < 1 ? 'Không phát sinh VAT phải nộp' : '';
      return { tt: i + 1, periodKey: pk, label: periodDot(pk), version: f ? versionLabel(f) + (f.generated ? ' – tự lập' : '') : '', declId: f ? f.id : null, generated: f ? !!f.generated : false,
        payable: payable, paid: paid, paidDate: pr.date || '', diff: diff, note: (project.vatNotes || {})[pk] != null ? project.vatNotes[pk] : auto, autoNote: auto, due: pi.due, interest: pi.total + oInt, interestTkbs: pi.total, interestOrig: oInt, interestOrigDetail: oParts.join('; '), orig40: orig40,
        interestItems: pi.items, interestDetail: pi.items.map(function (it) { return it.version + ': ' + fmtNum(it.base) + ' × ' + it.days + ' ngày'; }).join('; '),
        status: diff >= 1 ? 'Còn phải nộp ' + fmtNum(diff) : diff <= -1 ? 'Nộp thừa ' + fmtNum(-diff) : '' };
    }
    pks.forEach(function (pk, i) { var r = rowFor(pk, i); cum = r2(cum + r.payable - r.paid); r.cumulative = cum; totInterest += r.interest; rows.push(r); });
    var prevPk = periodsForYear(year, kk, true)[0];
    var outside = [];
    if (finalOf(decls, prevPk)) { var o = rowFor(prevPk, 0); outside.push(o); }
    var outInt = outside.reduce(function (s, r) { return s + r.interest; }, 0);
    return { rows: rows, outside: outside, totals: { payable: r2(rows.reduce(function (s, r) { return s + r.payable; }, 0)), paid: r2(rows.reduce(function (s, r) { return s + r.paid; }, 0)), diff: cum, interest: totInterest, interestOutside: outInt, interestAll: totInterest + outInt }, payDate: payDate };
  }

  /* ===================== XML TKBS bản nháp ===================== */
  var XML_GROUPS = [
    ['ct21'], ['ct22'], ['GiaTriVaThueGTGTHHDVMuaVao', 'ct23', 'ct24'], ['HangHoaDichVuNhapKhau', 'ct23a', 'ct24a'], ['ct25'], ['ct26'],
    ['HHDVBRaChiuThueGTGT', 'ct27', 'ct28'], ['ct29'], ['HHDVBRaChiuTSuat5', 'ct30', 'ct31'], ['HHDVBRaChiuTSuat10', 'ct32', 'ct33'], ['ct32a'],
    ['TongDThuVaThueGTGTHHDVBRa', 'ct34', 'ct35'], ['ct36'], ['ct37'], ['ct38'], ['ct39a'], ['ct40a'], ['ct40b'], ['ct40'], ['ct41'], ['ct42'], ['ct43']
  ];
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function numXml(v) { v = r2(v); return Number.isInteger(v) ? String(v) : String(v); }
  function khbsXml(decl, khbsRows, lyDo) {
    if (!khbsRows || !khbsRows.length) return '';
    var rowX = function (r) { return '          <ChiTietDieuChinh>\n            <maChiTieu>[' + r.code + ']</maChiTieu>\n            <soDaKeKhai>' + numXml(r.daKeKhai) + '</soDaKeKhai>\n            <soDieuChinh>' + numXml(r.dieuChinh) + '</soDieuChinh>\n            <chenhLech>' + numXml(r.chenhLech) + '</chenhLech>\n          </ChiTietDieuChinh>'; };
    var tang = khbsRows.filter(function (r) { return r.chenhLech > 0; }).map(rowX).join('\n'), giam = khbsRows.filter(function (r) { return r.chenhLech < 0; }).map(rowX).join('\n');
    return '    <PLuc>\n      <PL_01_KHBS>\n        <ChiTieuDieuChinhTang>\n' + tang + '\n        </ChiTieuDieuChinhTang>\n        <ChiTieuDieuChinhGiam>\n' + giam + '\n        </ChiTieuDieuChinhGiam>\n        <lyDoKhac>' + xmlEsc(lyDo || '') + '</lyDoKhac>\n        <ngayLapKHBS>' + toIso(decl.ngayLap) + '</ngayLapKHBS>\n      </PL_01_KHBS>\n    </PLuc>\n';
  }
  /** XML TKBS bản nháp: chỉ tiêu mới + phụ lục 01/KHBS của CHÍNH lần bổ sung này (bỏ PLuc của bản gốc) */
  function buildTkbsXml(decl, baseXml, khbsRows) {
    var c = decl.ct, xml;
    var lyDo = khbsRows && khbsRows.length ? khbsRows[0].lyDo : (decl.note || '').replace(/^TKBS tự lập: /, '');
    var note = '\n<\!-- BẢN NHÁP do CHECK THUẾ GTGT lập ngày ' + fmtDate(decl.ngayLap || todayIso()) + ': tờ khai bổ sung lần ' + decl.soLan + ' kỳ ' + periodLabel(decl.periodKey) + '.\n     ĐỐI CHIẾU VÀ LẬP LẠI TRÊN HTKK/eTax TRƯỚC KHI NỘP. Không nộp trực tiếp file này.\n     Phụ lục PL_01_KHBS bên dưới là bản giải trình của lần bổ sung này (cấu trúc thẻ là giả định của app). -->\n';
    var plNew = khbsXml(decl, khbsRows, lyDo);
    if (baseXml) {
      xml = baseXml.replace(/\s*<\!--[\s\S]*?-->\s*/g, '\n');
      xml = xml.replace(/[ \t]*<(?:[\w.-]+:)?PLuc\b[\s\S]*?<\/(?:[\w.-]+:)?PLuc\s*>\s*/g, '');
      var setTag = function (s2, name, val) {
        var re = new RegExp('(<(?:[\\w.-]+:)?' + name + ')(\\s[^>]*)?(?:/>|>[\\s\\S]*?</(?:[\\w.-]+:)?' + name + '\\s*>)');
        return re.test(s2) ? s2.replace(re, function (_, a, attrs) { var tagName = a.slice(1); return a + (attrs || '') + '>' + xmlEsc(val) + '</' + tagName + '>'; }) : s2;
      };
      xml = setTag(xml, 'loaiTKhai', 'B');
      xml = setTag(xml, 'soLan', String(decl.soLan));
      xml = setTag(xml, 'ngayLapTKhai', toIso(decl.ngayLap));
      xml = setTag(xml, 'ngayKy', toIso(decl.ngayLap));
      var main = xmlBlock(xml, 'CTieuTKhaiChinh');
      if (main != null) {
        var nm = main;
        CT_KEYS.forEach(function (k) { if (CT_BY_KEY[k].tt89 && xmlTag(nm, k) == null) return; nm = setTag(nm, k, k === 'ct21' ? (c.ct21 ? '1' : '0') : numXml(c[k])); });
        xml = xml.replace(main, function () { return nm; });
      }
      if (plNew) xml = xml.replace(/(\s*)(<\/(?:[\w.-]+:)?HSoKhaiThue\s*>)/, function (_, ws, close) { return '\n' + plNew + '  ' + close; });
      xml = xml.replace(/(<\?xml[^>]*\?>)/, '$1' + note);
      if (xml.indexOf('BẢN NHÁP') < 0) xml = note + xml;
      return xml;
    }
    var body = XML_GROUPS.map(function (g) {
      if (g.length === 1) return '      <' + g[0] + '>' + (g[0] === 'ct21' ? (c.ct21 ? 1 : 0) : numXml(c[g[0]])) + '</' + g[0] + '>';
      return '      <' + g[0] + '>\n' + g.slice(1).map(function (k) { return '        <' + k + '>' + numXml(c[k]) + '</' + k + '>'; }).join('\n') + '\n      </' + g[0] + '>';
    }).join('\n');
    var pr = periodRange(decl.periodKey);
    xml = '<?xml version="1.0" encoding="UTF-8"?>' + note +
      '<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">\n  <HSoKhaiThue id="ID_1">\n    <TTinChung>\n      <TTinDVu><maDVu>CHECKTHUE</maDVu><tenDVu>BAN NHAP - CHECK THUE GTGT</tenDVu><pbanDVu>1.0</pbanDVu><ttinNhaCCapDVu /></TTinDVu>\n      <TTinTKhaiThue>\n        <TKhaiThue>\n          <maTKhai>842</maTKhai>\n          <tenTKhai>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)</tenTKhai>\n          <pbanTKhaiXML>' + xmlEsc(decl.pbanTKhaiXML || '2.8.3') + '</pbanTKhaiXML>\n          <loaiTKhai>' + (decl.soLan > 0 ? 'B' : 'C') + '</loaiTKhai>\n          <soLan>' + decl.soLan + '</soLan>\n          <KyKKhaiThue>\n            <kieuKy>' + decl.kieuKy + '</kieuKy>\n            <kyKKhai>' + (decl.kieuKy === 'M' ? pad2(decl.ky) : decl.ky) + '/' + decl.nam + '</kyKKhai>\n            <kyKKhaiTuNgay>' + fmtDate(pr.from) + '</kyKKhaiTuNgay>\n            <kyKKhaiDenNgay>' + fmtDate(pr.to) + '</kyKKhaiDenNgay>\n          </KyKKhaiThue>\n          <maCQTNoiNop>' + xmlEsc(decl.maCQT) + '</maCQTNoiNop>\n          <tenCQTNoiNop>' + xmlEsc(decl.tenCQT) + '</tenCQTNoiNop>\n          <ngayLapTKhai>' + toIso(decl.ngayLap) + '</ngayLapTKhai>\n          <nguoiKy>' + xmlEsc(decl.nguoiKy) + '</nguoiKy>\n          <ngayKy>' + toIso(decl.ngayLap) + '</ngayKy>\n        </TKhaiThue>\n        <NNT>\n          <mst>' + xmlEsc(decl.mst) + '</mst>\n          <tenNNT>' + xmlEsc(decl.tenNNT) + '</tenNNT>\n          <dchiNNT>' + xmlEsc(decl.dchiNNT) + '</dchiNNT>\n        </NNT>\n      </TTinTKhaiThue>\n    </TTinChung>\n    <CTieuTKhaiChinh>\n' + body + '\n    </CTieuTKhaiChinh>\n' + plNew + '  </HSoKhaiThue>\n</HSoThueDTu>\n';
    return xml;
  }

  /** Tạo decl từ số liệu nhập tay */
  function makeManualDecl(info, ct) {
    var pk = periodKey(info.kieuKy || 'Q', +info.ky, +info.nam);
    var pr = periodRange(pk);
    return {
      id: uid('tk'), kind: 'GTGT', mst: info.mst || '', tenNNT: info.tenNNT || '', dchiNNT: info.dchiNNT || '', maCQT: '', tenCQT: info.tenCQT || '',
      kieuKy: info.kieuKy || 'Q', ky: +info.ky, nam: +info.nam, periodKey: pk, tuNgay: pr.from, denNgay: pr.to,
      loai: +info.soLan > 0 ? 'B' : 'C', soLan: +info.soLan || 0, ngayLap: toIso(info.ngayLap) || '', ngayKy: toIso(info.ngayLap) || '', ngayNop: toIso(info.ngayNop || info.ngayLap) || '', nguoiKy: '',
      source: { type: 'manual', fileName: '' }, ct: recompute(ct || {}), khbs: [], generated: false
    };
  }

  /** Thêm tờ khai vào dự án (thay thế nếu trùng kỳ + lần), trả về {project, replaced, warnings} */
  function addDecl(project, decl) {
    var warnings = [];
    if (project.mst && decl.mst && project.mst.replace(/\D/g, '') !== decl.mst.replace(/\D/g, '')) warnings.push('MST tờ khai ' + decl.mst + ' khác MST hồ sơ ' + project.mst);
    if (!project.mst && decl.mst) project.mst = decl.mst;
    if (!project.tenNNT && decl.tenNNT) project.tenNNT = decl.tenNNT;
    if (!project.dchiNNT && decl.dchiNNT) project.dchiNNT = decl.dchiNNT;
    if (!project.tenCQT && decl.tenCQT) project.tenCQT = decl.tenCQT;
    if (decl.kieuKy && project.decls.length === 0) project.kieuKy = decl.kieuKy;
    else if (decl.kieuKy && decl.kieuKy !== project.kieuKy) warnings.push('Tờ khai kỳ ' + periodLabel(decl.periodKey) + ' khác kiểu kỳ khai (' + (project.kieuKy === 'M' ? 'tháng' : 'quý') + ') của hồ sơ');
    var idx = -1;
    project.decls.forEach(function (d, i) { if (d.periodKey === decl.periodKey && d.soLan === decl.soLan) idx = i; });
    var replaced = idx >= 0;
    if (replaced) project.decls[idx] = decl; else project.decls.push(decl);
    project.decls = sortDecls(project.decls);
    return { project: project, replaced: replaced, warnings: warnings };
  }


  return {
    // tiện ích
    parseViNumber: parseViNumber, parseXmlNumber: parseXmlNumber, fmtNum: fmtNum, fmtDate: fmtDate, toIso: toIso, addDays: addDays, diffDays: diffDays, todayIso: todayIso, uid: uid, clone: clone, evalExpr: evalExpr, tpl: tpl,
    periodKey: periodKey, parsePeriodKey: parsePeriodKey, periodLabel: periodLabel, periodShort: periodShort, periodDot: periodDot, periodRange: periodRange, prevPeriod: prevPeriod, nextPeriod: nextPeriod, periodOfDate: periodOfDate, periodsForYear: periodsForYear, comparePeriodKey: comparePeriodKey,
    // chỉ tiêu
    CT_DEFS: CT_DEFS, CT_KEYS: CT_KEYS, INPUT_KEYS: INPUT_KEYS, CT_BY_KEY: CT_BY_KEY, CHECK_ROWS: CHECK_ROWS, ctKeyFromCode: ctKeyFromCode, emptyCt: emptyCt, recompute: recompute,
    // parser
    detectXmlKind: detectXmlKind, parseGTGTXml: parseGTGTXml, parseTNDNXml: parseTNDNXml, parseGTGTPdfText: parseGTGTPdfText, pdfItemsToText: pdfItemsToText, parseKHBS: parseKHBS,
    // kiểm tra & dự án
    validate: validate, newProject: newProject, migrateProject: migrateProject, addDecl: addDecl, makeManualDecl: makeManualDecl,
    versionLabel: versionLabel, declDate: declDate, sortDecls: sortDecls, versionsOf: versionsOf, finalOf: finalOf, allDecls: allDecls, prevFinalFor: prevFinalFor,
    // quy tắc
    DEFAULT_RULES: DEFAULT_RULES, setRules: setRules, getRules: getRules, normalizeRules: normalizeRules, errorTypeById: errorTypeById, rateById: rateById, ratePct: ratePct,
    errorDeltas: errorDeltas, humanize: humanize, parseCustomDeltas: parseCustomDeltas, autoCurrentPeriodInfo: autoCurrentPeriodInfo, classifyCase: classifyCase, caseVars: caseVars, dueDate: dueDate, ruleDueDate: ruleDueDate, lateInterestCalc: lateInterestCalc, autoCurrentPeriod: autoCurrentPeriod, normTreatment: normTreatment, normRate: normRate, ruleMsg: ruleMsg, mappingEntries: mappingEntries, errorDirection: errorDirection, HOLIDAYS: HOLIDAYS, RATE_LIST: RATE_LIST, periodInterest: periodInterest,
    // báo cáo
    applyErrors: applyErrors, buildCheckTable: buildCheckTable, suggestErrorsFromDiff: suggestErrorsFromDiff, buildCt3738: buildCt3738, buildChecks: buildChecks, chainCheck: chainCheck, mstValid: mstValid, buildThuyetMinh: buildThuyetMinh, buildVatPayable: buildVatPayable, buildTkbsXml: buildTkbsXml, finalTndn: finalTndn, genericRatePair: genericRatePair, PL031A_LABELS: PL031A_LABELS, PL031A_HTKK_MAP: PL031A_HTKK_MAP, PL031A_LEGACY_MAP: PL031A_LEGACY_MAP
  };
})()

export default Engine
