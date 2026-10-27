// Đọc bộ BCTC XML (TT133/TT200) và lập bảng đối chiếu doanh thu/thuế.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.
import Engine from './engine.js'
const Bctc = (function () {
  'use strict';
  var E = Engine;
  function n(v) { return typeof v === 'number' && isFinite(v) ? v : (v == null || v === '' ? 0 : (isFinite(+v) ? +v : 0)); }
  function r2(v) { return Math.round(n(v) * 100) / 100; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function block(xml, name) { var re = new RegExp('<(?:[\\w.-]+:)?' + escRe(name) + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?' + escRe(name) + '\\s*>'); var m = re.exec(xml); return m ? m[1] : null; }
  function tag(xml, name) { var re = new RegExp('<(?:[\\w.-]+:)?' + escRe(name) + '(?:\\s[^>]*)?(?:/>|>([^<]*)</(?:[\\w.-]+:)?' + escRe(name) + '\\s*>)'); var m = re.exec(xml || ''); return m ? (m[1] || '').trim() : null; }
  function firstBlock(xml, re) { var m = new RegExp('<(?:[\\w.-]+:)?(' + re + ')(?:\\s[^>]*)?>', 'i').exec(xml); return m ? { name: m[1], body: block(xml, m[1]) } : null; }
  /** Đọc mọi <ctXXX>số</ctXXX> trực tiếp trong khối → {XXX: number} */
  function cts(body) {
    var o = {}, re = /<(?:[\w.-]+:)?ct([0-9A-Za-z_]+)>\s*(-?[\d.,]+)\s*<\//g, m;
    while ((m = re.exec(body || ''))) o[m[1]] = parseFloat(m[2].replace(/,/g, ''));
    return o;
  }

  var MA_TKHAI = { '683': { form: 'TT133-B01a', label: 'BCTC TT133 mẫu B01a' }, '684': { form: 'TT133-B01b', label: 'BCTC TT133 mẫu B01b' }, '699': { form: 'TT200-B01DN', label: 'BCTC TT200 (cũ – đến hết 2025) (B01-DN)' }, '700': { form: 'TT200-B01DN', label: 'BCTC TT200 (cũ – đến hết 2025)' }, '402': { form: 'TT200', label: 'BCTC TT200 (cũ – đến hết 2025)' } };
  function isBctcXml(xml) {
    var ma = (tag(xml, 'maTKhai') || '').trim(), ten = (tag(xml, 'tenTKhai') || '').toLowerCase();
    if (MA_TKHAI[ma]) return true;
    if (/báo cáo tài chính|bao cao tai chinh/.test(ten)) return true;
    return /<(?:[\w.-]+:)?PL_(KQHDSXKD|CDTK)/.test(xml);
  }

  /**
   * parseBctcXml(xml, fileName) → { kind:'BCTC', form, nam, mst, tenNNT, kqkd:{namNay:{ct01..}, namTruoc}, cdtk:{acc:{dkNo,dkCo,psNo,psCo,ckNo,ckCo}}, bcdkt:{cuoiNam, dauNam}, lctt, ... }
   */
  function parseBctcXml(xml, fileName) {
    if (!xml) throw new Error('File BCTC rỗng');
    xml = xml.replace(/<(?:[\w.-]+:)?CKyDTu[\s\S]*?<\/(?:[\w.-]+:)?CKyDTu\s*>/g, '');
    var ma = (tag(xml, 'maTKhai') || '').trim();
    var tenTk = tag(xml, 'tenTKhai') || '';
    var info = /99\/2025/.test(tenTk) ? { form: 'TT99-B01DN', label: tenTk } : MA_TKHAI[ma] || { form: /200/.test(tag(xml, 'tenTKhai') || '') ? 'TT200' : /133/.test(tag(xml, 'tenTKhai') || '') ? 'TT133' : 'BCTC', label: tag(xml, 'tenTKhai') || 'BCTC' };
    var nam = parseInt(tag(xml, 'kyKKhai') || '', 10);
    if (!nam) { var den = E.toIso(tag(xml, 'kyKKhaiDenNgay') || ''); nam = den ? +den.slice(0, 4) : 0; }
    var o = { id: E.uid('bctc'), kind: 'BCTC', form: info.form, formLabel: info.label, maTKhai: ma, nam: nam, mst: (tag(xml, 'mst') || '').trim(), tenNNT: tag(xml, 'tenNNT') || '', ngayLap: E.toIso(tag(xml, 'ngayLapTKhai') || ''), kyTu: E.toIso(tag(xml, 'kyKKhaiTuNgay') || ''), kyDen: E.toIso(tag(xml, 'kyKKhaiDenNgay') || ''), source: { type: 'xml', fileName: fileName || '' } };
    // KQKD
    var kq = firstBlock(xml, 'PL_KQHDSXKD|PL_KQKD|KQHDSXKD|PL_B02[\\w-]*|KetQuaHoatDongKinhDoanh');
    o.kqkd = { namNay: {}, namTruoc: {} };
    if (kq) {
      var nn = block(kq.body, 'NamNay') || block(kq.body, 'KyNay') || block(kq.body, 'SoNamNay');
      var nt = block(kq.body, 'NamTruoc') || block(kq.body, 'KyTruoc') || block(kq.body, 'SoNamTruoc');
      o.kqkd.namNay = cts(nn != null ? nn : kq.body); o.kqkd.namTruoc = cts(nt);
      o.kqkdTag = kq.name;
    }
    // Bảng cân đối tài khoản
    var cd = firstBlock(xml, 'PL_CDTK|PL_CDSPS|CDTK|BangCanDoiTaiKhoan|PL_F01[\\w-]*');
    o.cdtk = {};
    if (cd) {
      var parts = { dk: block(cd.body, 'SoDuDauKy') || block(cd.body, 'DauKy'), ps: block(cd.body, 'SoPhatSinhTrongKy') || block(cd.body, 'PhatSinh') || block(cd.body, 'SoPhatSinh'), ck: block(cd.body, 'SoDuCuoiKy') || block(cd.body, 'CuoiKy') };
      Object.keys(parts).forEach(function (p) {
        if (!parts[p]) return;
        var no = cts(block(parts[p], 'No')), co = cts(block(parts[p], 'Co'));
        Object.keys(no).forEach(function (acc) { (o.cdtk[acc] = o.cdtk[acc] || {})[p + 'No'] = no[acc]; });
        Object.keys(co).forEach(function (acc) { (o.cdtk[acc] = o.cdtk[acc] || {})[p + 'Co'] = co[acc]; });
      });
      o.cdtkTag = cd.name;
    }
    // BCĐKT
    var main = block(xml, 'CTieuTKhaiChinh') || '';
    var mainNoPl = main.replace(/<(?:[\w.-]+:)?PLuc[\s\S]*$/, '');
    o.bcdkt = { cuoiNam: cts(block(mainNoPl, 'SoCuoiNam') || block(mainNoPl, 'SoCuoiKy')), dauNam: cts(block(mainNoPl, 'SoDauNam') || block(mainNoPl, 'SoDauKy')) };
    var lc = firstBlock(xml, 'PL_LCTTTT|PL_LCTTGT|PL_LCTT[\\w]*');
    o.lctt = lc ? { tag: lc.name, namNay: cts(block(lc.body, 'NamNay')), namTruoc: cts(block(lc.body, 'NamTruoc')) } : null;
    var yk = (tag(xml, 'tenYKienKToan') || '').trim(), myk = (tag(xml, 'maYKienKToan') || '').trim(), dkt = (tag(xml, 'bctcDaKiemToan') || '').trim();
    if (!yk && myk) yk = { '01': 'Chấp nhận toàn phần', '02': 'Ngoại trừ', '03': 'Từ chối', '04': 'Trái ngược' }[myk] || '';
    if (yk) o.auditOpinion = yk; if (dkt) o.daKiemToan = dkt === '1';
    o.summary = bctcSummary(o);
    return o;
  }
  function acc(o, a) { return (o.cdtk || {})[a] || null; }
  function sumAcc(o, list, field) { var s = 0, found = false; list.forEach(function (a) { var x = acc(o, a); if (x && x[field] != null) { s += n(x[field]); found = true; } }); return found ? r2(s) : null; }
  /** Số liệu chính dùng đối chiếu thuế GTGT */
  function bctcSummary(o) {
    var k = o.kqkd.namNay || {};
    var a = function (x, f) { var v = acc(o, x); return v && v[f] != null ? n(v[f]) : null; };
    var s = {
      dtBanHang: k['01'] != null ? n(k['01']) : null, giamTru: k['02'] != null ? n(k['02']) : null, dtThuan: k['10'] != null ? n(k['10']) : null,
      dtTaiChinh: k['21'] != null ? n(k['21']) : null, thuNhapKhac: k['31'] != null ? n(k['31']) : null, lnTruocThue: k['50'] != null ? n(k['50']) : null,
      tk511Co: a('511', 'psCo'), tk511No: a('511', 'psNo'), tk515Co: a('515', 'psCo'), tk711Co: a('711', 'psCo'), tk521No: a('521', 'psNo'),
      tk1331No: a('1331', 'psNo') != null ? a('1331', 'psNo') : a('133', 'psNo'), tk1331Co: a('1331', 'psCo') != null ? a('1331', 'psCo') : a('133', 'psCo'),
      tk1331DauNo: a('1331', 'dkNo') != null ? a('1331', 'dkNo') : a('133', 'dkNo'), tk1331CuoiNo: a('1331', 'ckNo') != null ? a('1331', 'ckNo') : a('133', 'ckNo'),
      tk33311Co: a('33311', 'psCo') != null ? a('33311', 'psCo') : a('3331', 'psCo'), tk33311No: a('33311', 'psNo') != null ? a('33311', 'psNo') : a('3331', 'psNo'),
      tk33311DauCo: a('33311', 'dkCo') != null ? a('33311', 'dkCo') : a('3331', 'dkCo'), tk33311CuoiCo: a('33311', 'ckCo') != null ? a('33311', 'ckCo') : a('3331', 'ckCo'),
      tk33311CuoiNo: a('33311', 'ckNo') != null ? a('33311', 'ckNo') : a('3331', 'ckNo')
    };
    // TT200: giảm trừ có thể ở 521 (TT133 không có 521 — ghi Nợ 511)
    return s;
  }

  /* ---------- Đối chiếu 3 chiều (rules2.json reconciliations R-xxx, diffCauses C-xxx) ---------- */
  function val(v) { return v == null || !isFinite(v) ? null : r2(v); }
  function diff(a, b) { return a == null || b == null ? null : r2(a - b); }
  function A(bc, a, f) { var x = bc && bc.cdtk ? bc.cdtk[a] : null; return x && x[f] != null ? n(x[f]) : null; }
  function causeOf(rules, id) { return ((rules && rules.diffCauses) || []).filter(function (c) { return c.id === id; })[0] || { id: id, label: id, verify: 'TC' }; }
  /**
   * buildRecon(ctx) — ctx: {year, decls (tất cả), kieuKy, bkAgg (theo kỳ), invoices, bctc, bctcPrev, tndn, tndnPrev, explain:[{label, amount, cause, note}], rules (rules2), fold, isThuHo}
   * → { revenue:{rows, diffs, bridge, auto, manual, explained, baseDiff, adjusted, unexplained, status}, tax:{rows}, balances, qtBctc, checks:[{id,...,status}], notes, derived }
   */
  function buildRecon(ctx) {
    var y = +ctx.year, kk = ctx.kieuKy || 'Q', decls = ctx.decls || [], rules = ctx.rules || null;
    var pks = E.periodsForYear(y, kk, false);
    var finals = pks.map(function (pk) { return E.finalOf(decls, pk); });
    var withTk = finals.filter(Boolean);
    var bk = ctx.bkAgg || {}, bkP = pks.map(function (pk) { return bk[pk]; }).filter(Boolean);
    var BC = ctx.bctc || null, S = BC ? BC.summary : {}, K = BC ? (BC.kqkd.namNay || {}) : {}, KP = BC ? (BC.kqkd.namTruoc || {}) : {};
    var Q = ctx.tndn || null, is133 = BC ? /133/.test(BC.form) : true;
    var fold = ctx.fold || function (s) { return String(s || '').toLowerCase(); };
    var isThuHo = ctx.isThuHo || function (x) { return /thu hộ|chi hộ|\bNCT\b/i.test(String(x.matHang || '')); };
    // Tờ khai suy ra từ bảng kê cho kỳ chưa có tờ khai (giả định [37]=[38]=0, [22] = [43] kỳ trước; kỳ đầu năm = 1331 dư Nợ đầu năm)
    var derived = {}, c22 = S.tk1331DauNo != null ? n(S.tk1331DauNo) : 0;
    pks.forEach(function (pk, i) {
      var d = finals[i];
      if (d) { c22 = n(d.ct.ct43); return; }
      var a = bk[pk]; if (!a) { c22 = 0; return; }
      var v = { ct22: c22, ct23: a.ct23, ct24: a.ct24, ct25: a.ct25, ct26: a.ct26, ct29: a.ct29, ct30: a.ct30, ct31: a.ct31, ct32: a.ct32, ct33: a.ct33, ct32a: a.ct32a, ct34: a.ct34, ct35: a.ct35, ct36: a.ct36 };
      var x40a = v.ct36 - c22; v.ct40 = x40a > 0 ? r2(x40a) : 0; v.ct43 = x40a < 0 ? r2(-x40a) : 0; v.ct41 = v.ct43;
      derived[pk] = v; c22 = v.ct43;
    });
    var nDerived = Object.keys(derived).length;
    function tkv(pk, i, k) { var d = finals[i]; return d ? n(d.ct[k]) : derived[pk] ? n(derived[pk][k]) : null; }
    function sumTk(k, allowDerived) { var any = false, s = 0; pks.forEach(function (pk, i) { var v = finals[i] ? n(finals[i].ct[k]) : allowDerived && derived[pk] ? n(derived[pk][k]) : null; if (v != null) { any = true; s += v; } }); return any ? r2(s) : null; }
    function sumBk(k, side) { var list = bkP.filter(function (a) { return a.has[side]; }); return list.length ? r2(list.reduce(function (s, a) { return s + n(a[k]); }, 0)) : null; }
    var inv = (ctx.invoices || []).filter(function (x) { return x.year === y && !x.cancelled && !x.excluded && !(x.noKy && !ctx.includeNoKy); });
    var br = inv.filter(function (x) { return x.side === 'br'; });
    var tkDT = sumTk('ct34'), bkDT = sumBk('ct34', 'br'), bcDT = S.dtBanHang != null ? S.dtBanHang : S.tk511Co, qtDT = Q && Q.doanhThu != null ? n(Q.doanhThu) : null;
    var tkDTx = sumTk('ct34', true);
    var kct = r2(br.filter(function (x) { return x.rate === 'KCT'; }).reduce(function (s, x) { return s + x.giaTri; }, 0));
    // ===== R-DT-01: cầu nối doanh thu bảng kê/tờ khai → 511 =====
    var used = {};
    function pick(pred) { var s = 0, c = 0; br.forEach(function (x) { if (!used[x.id] && pred(x)) { used[x.id] = 1; s += x.giaTri; c++; } }); return { amount: r2(s), n: c }; }
    var thuHo = pick(isThuHo);
    var prior = pick(function (x) { return /keo ve|dt nam truoc|doanh thu nam truoc|ghi nhan vat/.test(fold(x.matHang)); });
    var k32a = pick(function (x) { return x.rate === 'KKKTT'; });
    var d3387 = BC && (A(BC, '3387', 'ckCo') != null || A(BC, '3387', 'dkCo') != null) ? r2(n(A(BC, '3387', 'ckCo')) - n(A(BC, '3387', 'dkCo'))) : null;
    var giamTru = S.giamTru ? n(S.giamTru) : (S.tk521No ? n(S.tk521No) : 0);
    var base = bkDT != null ? bkDT : tkDT, baseLabel = bkDT != null ? 'Bảng kê bán ra' : 'Tờ khai [34]';
    var bridge = [];
    function br1(cause, label, amount, src, extra) { if (amount == null || Math.abs(amount) < 1) return; var c = causeOf(rules, cause); bridge.push(Object.assign({ id: 'auto-' + cause, cause: cause, label: label || c.label, amount: r2(amount), src: src, auto: true, verify: c.verify, template: c.explanationTemplate || '', treatment: c.treatment || '' }, extra || {})); }
    br1('C-THUHO', 'Thu hộ / chi hộ trên hóa đơn (không phải doanh thu 511)', thuHo.amount, thuHo.n + ' dòng bảng kê có "thu hộ/chi hộ"');
    br1('C-TIMING-PRIOR', 'HĐ năm ' + y + ' có doanh thu đã ghi nhận năm ' + (y - 1), prior.amount, prior.n + ' dòng diễn giải "kéo về/ghi nhận VAT… năm trước"');
    br1('C-KKKNT', 'Doanh thu không phải kê khai, tính nộp thuế [32a]', k32a.amount, k32a.n + ' dòng');
    br1('C-TIMING-ADV', 'HĐ đã xuất, dịch vụ chưa hoàn thành (TK 3387 tăng trong năm)', d3387, 'TK 3387: dư Có cuối ' + E.fmtNum(A(BC, '3387', 'ckCo')) + ' − dư Có đầu ' + E.fmtNum(A(BC, '3387', 'dkCo')));
    br1('C-RETURN', 'Giảm trừ doanh thu (521 / ghi Nợ 511) — bảng kê đã trừ HĐ điều chỉnh', giamTru ? -giamTru : 0, 'KQKD [02]');
    var manual = (ctx.explain || []).map(function (x, i) { var c = x.cause ? causeOf(rules, x.cause) : null; return { id: 'm' + i, i: i, manual: true, cause: x.cause || '', label: x.label || (c ? c.label : ''), amount: x.amount == null ? null : n(x.amount), note: x.note || '', verify: c ? c.verify : '' }; });
    var explained = r2(bridge.concat(manual).reduce(function (s, x) { return s + n(x.amount); }, 0));
    var adjusted = base == null ? null : r2(base - explained);
    var baseDiff = diff(base, val(bcDT));
    var unexplained = baseDiff == null ? null : r2(baseDiff - explained);
    var tolRev = bcDT != null ? Math.max(1000, Math.abs(n(bcDT)) * 0.0001) : 1000;
    var revStatus = unexplained == null ? null : Math.abs(unexplained) <= tolRev ? 'OK' : 'WARN';
    var revRows = [
      { key: 'tk', label: 'Tờ khai GTGT — tổng [34] các kỳ (bản cuối)', value: tkDT, src: withTk.length ? withTk.length + '/' + pks.length + ' kỳ có tờ khai' : 'Chưa có tờ khai' },
      { key: 'bk', label: 'Bảng kê bán ra — tổng doanh số chưa thuế', value: bkDT, src: bkP.length ? br.length + ' dòng HĐ' : 'Chưa nạp bảng kê bán ra' },
      { key: 'bctc', label: 'BCTC — Doanh thu bán hàng & CCDV (KQKD [01])', value: val(bcDT), src: BC ? BC.formLabel + ' lập ' + E.fmtDate(BC.ngayLap) : 'Chưa nạp BCTC', extra: S.tk511Co != null ? 'TK 511 PS Có: ' + E.fmtNum(S.tk511Co) : '' },
      { key: 'bctcThuan', label: 'BCTC — Doanh thu thuần (KQKD [10])', value: val(S.dtThuan), src: S.giamTru ? 'giảm trừ ' + E.fmtNum(S.giamTru) : '' },
      { key: 'qt', label: 'QT TNDN — PL 03-1A [04] doanh thu bán hàng', value: val(qtDT), src: Q ? 'QT TNDN ' + Q.nam + (Q.soLan ? ' bổ sung lần ' + Q.soLan : ' lần đầu') + ' (bản cuối)' : 'Chưa nạp QT TNDN' },
      { key: 'other', label: 'Doanh thu tài chính (515) + thu nhập khác (711) — không thuộc [34]', value: S.dtTaiChinh != null || S.thuNhapKhac != null ? r2(n(S.dtTaiChinh) + n(S.thuNhapKhac)) : null, src: 'KQKD [21] + [31]' }
    ];
    var diffs = [
      { key: 'tk_bk', label: 'Tờ khai − Bảng kê', value: diff(tkDT, bkDT) },
      { key: 'tk_bctc', label: 'Tờ khai − BCTC', value: diff(tkDT, val(bcDT)) },
      { key: 'bk_bctc', label: 'Bảng kê − BCTC', value: diff(bkDT, val(bcDT)) },
      { key: 'bk_bctc_kct', label: 'Bảng kê (bỏ nhóm KCT) − BCTC', value: bkDT != null && bcDT != null ? r2(bkDT - kct - n(bcDT)) : null },
      { key: 'bctc_qt', label: 'BCTC − QT TNDN', value: diff(val(bcDT), val(qtDT)) }
    ];
    // ===== Thuế =====
    var fin40 = function (k, allow) { return sumTk(k, allow); };
    var thue = { rows: [
      { key: 'out', id: 'R-VAT-OUT', label: 'Thuế GTGT đầu ra [35] ↔ 33311 PS Có', tk: sumTk('ct35'), bk: sumBk('ct35', 'br'), bctc: val(S.tk33311Co), bctcLabel: 'TK 33311 PS Có' },
      { key: 'in24', label: 'Thuế GTGT đầu vào [24]', tk: sumTk('ct24'), bk: sumBk('ct24', 'mv'), bctc: val(S.tk1331No), bctcLabel: 'TK 1331 PS Nợ' },
      { key: 'in25', id: 'R-VAT-IN', label: 'Thuế được khấu trừ [25] ↔ 1331 PS Nợ', tk: sumTk('ct25'), bk: sumBk('ct25', 'mv'), bctc: val(S.tk1331No), bctcLabel: 'TK 1331 PS Nợ' },
      { key: 'pay', label: 'Thuế GTGT phải nộp [40] (cộng các kỳ)', tk: fin40('ct40'), bk: nDerived ? fin40('ct40', true) : null, bctc: null, bctcLabel: nDerived ? 'Cột bảng kê: [40] suy ra từ bảng kê' : '' }
    ] };
    thue.rows.forEach(function (r) { r.tk_bk = diff(r.tk, r.bk); r.tk_bctc = diff(r.tk, r.bctc); r.bk_bctc = diff(r.bk, r.bctc); });
    // ===== Số dư =====
    var lastPk = pks[pks.length - 1], li = pks.length - 1, q4 = finals[li];
    var ct43End = tkv(lastPk, li, 'ct43'), ct40End = tkv(lastPk, li, 'ct40'), endSrc = q4 ? E.versionLabel(q4) : derived[lastPk] ? 'suy ra từ bảng kê' : '';
    var nextQ1 = E.versionsOf(decls, E.nextPeriod(lastPk)).filter(function (d) { return !d.generated; })[0];
    var q1orig = E.versionsOf(decls, pks[0]).filter(function (d) { return !d.generated; })[0];
    var c33ck = S.tk33311CuoiCo != null ? r2(n(S.tk33311CuoiCo) - n(S.tk33311CuoiNo)) : null;
    var bal = [
      { key: '1331_ck', id: 'R-1331-END', label: 'Dư Nợ TK 1331 cuối năm ↔ [43] ' + E.periodLabel(lastPk) + (endSrc ? ' (' + endSrc + ')' : ''), bctc: val(S.tk1331CuoiNo), tk: ct43End },
      { key: '1331_next', id: 'MY-01', label: '[43] ' + E.periodLabel(lastPk) + ' ↔ [22] ' + E.periodLabel(E.nextPeriod(lastPk)) + ' (lần đầu)', bctc: ct43End, tk: nextQ1 ? n(nextQ1.ct.ct22) : null, bctcLabel: '[43] cuối năm' },
      { key: '1331_n1', id: 'R-1331-NEXT', label: 'Dư Nợ TK 1331 cuối năm ↔ [22] ' + E.periodLabel(E.nextPeriod(lastPk)) + ' (lần đầu)', bctc: val(S.tk1331CuoiNo), tk: nextQ1 ? n(nextQ1.ct.ct22) : null },
      { key: '1331_dk', id: 'R-1331-BEGIN', label: 'Dư Nợ TK 1331 đầu năm ↔ [22] ' + E.periodLabel(pks[0]) + ' (lần đầu)', bctc: val(S.tk1331DauNo), tk: q1orig ? n(q1orig.ct.ct22) : derived[pks[0]] ? derived[pks[0]].ct22 : null },
      { key: '33311_ck', id: 'R-3331-END', label: 'Dư Có TK 33311 cuối năm ↔ [40] ' + E.periodLabel(lastPk) + (endSrc ? ' (' + endSrc + ')' : ''), bctc: c33ck, tk: ct40End, note: 'Dư Có 33311 cuối năm = [40] kỳ cuối năm (+ [40] các kỳ trước chưa nộp)' }
    ];
    bal.forEach(function (r) { r.diff = diff(r.bctc, r.tk); });
    // R-3331-ROLL
    var roll = null;
    if (S.tk33311Co != null && S.tk33311No != null) {
      var dk = n(S.tk33311DauCo), ckv = n(S.tk33311CuoiCo), rollDiff = r2(dk + n(S.tk33311Co) - n(S.tk33311No) - ckv);
      var nop = S.tk1331Co != null ? r2(n(S.tk33311No) - n(S.tk1331Co)) : null;
      // Σ[40] phải nộp trong năm = [40] kỳ cuối năm trước (≈ dư Có đầu năm) + [40] các kỳ trong năm trừ kỳ cuối
      var due = r2(dk + pks.slice(0, -1).reduce(function (s, pk, i) { var v = tkv(pk, i, 'ct40'); return s + n(v); }, 0));
      roll = { dk: dk, psCo: n(S.tk33311Co), psNo: n(S.tk33311No), ck: ckv, diff: rollDiff, nopNSNN: nop, phaiNopTrongNam: due, thieu: nop != null ? r2(due - nop) : null };
    }
    // ===== QT TNDN ↔ BCTC (R-QT-01..03) =====
    var qtb = [], notes = [];
    if (Q && BC) {
      var ps = function (a) { return A(BC, a, 'psNo'); };
      var L = [
        ['dt', 'Doanh thu bán hàng, CCDV', 'doanhThu', '[04]', K['01'], 'KQKD [01]'],
        ['gt', 'Các khoản giảm trừ doanh thu', 'giamTru', '[06]', K['02'], 'KQKD [02]'],
        ['dttc', 'Doanh thu hoạt động tài chính', 'dtTaiChinh', '[10]', K['21'], 'KQKD [21] / 515'],
        ['gv', 'Giá vốn hàng bán', 'giaVon', '[13]', K['11'], 'KQKD [11] / 632'],
        ['cpbh', 'Chi phí bán hàng', 'cpBanHang', '[14]', is133 ? ps('6421') : K['25'], is133 ? 'TK 6421 PS Nợ (TT133)' : 'KQKD [25]'],
        ['qldn', 'Chi phí quản lý doanh nghiệp', 'cpQldn', '[15]', is133 ? ps('6422') : K['26'], is133 ? 'TK 6422 PS Nợ (TT133)' : 'KQKD [26]'],
        ['cptc', 'Chi phí tài chính', 'cpTaiChinh', '[16]', K['22'], 'KQKD [22] / 635'],
        ['tnk', 'Thu nhập khác', 'thuNhapKhac', '[19]', K['31'], 'KQKD [31] / 711'],
        ['cpk', 'Chi phí khác', 'chiPhiKhac', '[20]', K['32'], 'KQKD [32] / 811'],
        ['ln', 'Tổng lợi nhuận kế toán trước thuế', 'ctA1', '[A1] = PL [22]', K['50'], 'KQKD [50]'],
        ['thue', 'Thuế TNDN hiện hành', 'ctE1', '[E1]', K['51'], 'KQKD [51] / 821']
      ];
      qtb = L.map(function (l) { return { key: l[0], label: l[1], qt: val(Q[l[2]]), qtLabel: (l[0] === 'ln' || l[0] === 'thue' ? 'Tờ khai ' : 'PL 03-1A ') + l[3], bctc: l[4] != null ? n(l[4]) : null, bctcLabel: l[5] }; }).filter(function (r) { return r.qt != null || r.bctc != null; });
      qtb.forEach(function (r) { r.diff = diff(r.qt, r.bctc); });
      var off = qtb.filter(function (r) { return r.diff != null && Math.abs(r.diff) >= 1; });
      if (off.length) {
        var later = Q.soLan > 0 && Q.ngayLap && BC.ngayLap && Q.ngayLap > BC.ngayLap;
        var dtRow = qtb.filter(function (r) { return r.key === 'dt'; })[0], lnRow = qtb.filter(function (r) { return r.key === 'ln'; })[0];
        var sumCk = off.filter(function (r) { return ['dt', 'gt', 'dttc', 'gv', 'cpbh', 'qldn', 'cptc', 'tnk', 'cpk'].indexOf(r.key) >= 0; }).reduce(function (s, r) { return s + (['gv', 'cpbh', 'qldn', 'cptc', 'cpk', 'gt'].indexOf(r.key) >= 0 ? -r.diff : r.diff); }, 0);
        notes.push({ level: later ? 'error' : 'warn', code: later ? 'R-QT-02' : 'R-QT-01', verify: later ? 'CXM' : 'TC', msg: 'QT TNDN ' + Q.nam + (Q.soLan ? ' (bổ sung lần ' + Q.soLan + ', lập ' + E.fmtDate(Q.ngayLap) + ')' : '') + ' khác BCTC (lập ' + E.fmtDate(BC.ngayLap) + '): ' + off.map(function (r) { return r.label + ' ' + E.fmtNum(r.diff); }).join('; ') + '.' + (lnRow && lnRow.diff && Math.abs(r2(sumCk) - lnRow.diff) < 1 ? ' Kiểm tra cộng: các chênh lệch chỉ tiêu cộng lại đúng bằng chênh lệch LNTT ' + E.fmtNum(lnRow.diff) + '.' : '') + (later ? ' BCTC có thể chưa được lập lại sau khi QT TNDN khai bổ sung — cần BCTC điều chỉnh (lập lại BCTC năm, nộp lại cùng hồ sơ QT bổ sung) hoặc thuyết minh/điều chỉnh hồi tố trên BCTC năm sau.' : ' Cần thuyết minh chênh lệch giữa BCTC và quyết toán.') + (dtRow && dtRow.diff ? ' Chênh lệch doanh thu ' + E.fmtNum(dtRow.diff) + ' cần đối chiếu với tờ khai GTGT [34]' + (tkDTx != null ? ' (' + E.fmtNum(tkDTx) + (tkDT == null ? ', suy ra từ bảng kê' : '') + ')' : '') + ' và bảng kê bán ra' + (bkDT != null ? ' (' + E.fmtNum(bkDT) + ')' : '') + ' — nếu là HĐ đã kê khai GTGT bị hủy/điều chỉnh thì rà kỳ GTGT tương ứng.' : '') });
      }
    }
    if (Q && Q.plChecks && Q.plChecks.length) notes.push({ level: 'warn', code: 'QT_PL', msg: 'PL 03-1A không khớp công thức: ' + Q.plChecks.join('; ') });
    // ===== Danh sách phép đối chiếu theo rules2 =====
    var checks = [];
    function ck(id, a, aL, b, bL, tol, msgOk, msgBad, lvBad, extra) {
      var R = ((rules && rules.reconciliations) || []).filter(function (x) { return x.id === id; })[0] || {};
      var d = diff(a, b), st = d == null ? 'NA' : Math.abs(d) <= (tol || 0.5) ? 'OK' : (lvBad || 'WARN');
      checks.push(Object.assign({ id: id, group: R.group || '', name: R.name || id, a: val(a), aLabel: aL, b: val(b), bLabel: bL, diff: d, status: st, msg: st === 'OK' ? (msgOk || '') : (msgBad || R.onDiff || ''), verify: R.verify || 'TC', causes: R.standardCauses || [] }, extra || {}));
    }
    if (BC) {
      ck('R-DT-01', adjusted, baseLabel + ' sau điều chỉnh', val(bcDT), 'TK 511 / KQKD [01]', tolRev, 'Chênh lệch đã được giải thích.', unexplained != null ? 'Còn ' + E.fmtNum(Math.abs(unexplained)) + ' chưa giải thích (' + (unexplained < 0 ? '511 lớn hơn' : 'bảng kê lớn hơn') + ') — nhập dòng điều chỉnh có lý do.' : '', 'WARN', { bridge: true });
      ck('R-DT-02', K['01'] != null ? n(K['01']) : null, 'KQKD [01]', S.tk511Co, 'TK 511 PS Có', 0.5, '', 'Dữ liệu BCTC không nhất quán.', 'ERROR');
      ck('R-VAT-OUT', sumTk('ct35', true), 'Σ[35]' + (tkDT == null && nDerived ? ' (suy ra từ bảng kê)' : ''), S.tk33311Co, 'TK 33311 PS Có', pks.length);
      ck('R-VAT-IN', sumTk('ct25', true), 'Σ[25]' + (tkDT == null && nDerived ? ' (suy ra từ bảng kê)' : ''), S.tk1331No, 'TK 1331 PS Nợ', pks.length);
      ck('R-1331-END', S.tk1331CuoiNo, 'Dư Nợ 1331 cuối năm', ct43End, '[43] ' + E.periodLabel(lastPk) + (endSrc ? ' (' + endSrc + ')' : ''), 0.5);
      if (nextQ1) ck('R-1331-NEXT', S.tk1331CuoiNo, 'Dư Nợ 1331 cuối năm ' + y, n(nextQ1.ct.ct22), '[22] ' + E.periodLabel(E.nextPeriod(lastPk)) + ' (lần đầu)', 0.5, '', 'Số dư 1331 cuối năm trên BCTC khác số chuyển sang kỳ đầu năm sau — giải trình (TKBS sau khóa sổ đưa vào [37]/[38] kỳ phát hiện).', 'WARN', { name: '1331 dư Nợ cuối năm ' + y + ' ↔ [22] kỳ đầu năm ' + (y + 1) + ' (MY-02)' });
      if (q1orig || derived[pks[0]]) ck('R-1331-BEGIN', S.tk1331DauNo, 'Dư Nợ 1331 đầu năm', bal[2].tk, '[22] ' + E.periodLabel(pks[0]), 0.5);
      ck('R-3331-END', c33ck, 'Dư Có 33311 cuối năm', ct40End, '[40] ' + E.periodLabel(lastPk) + (endSrc ? ' (' + endSrc + ')' : ''), 1, '', roll && roll.thieu != null && Math.abs(roll.thieu) >= 1 ? 'Cuộn 33311: dư đầu ' + E.fmtNum(roll.dk) + ' + PS Có ' + E.fmtNum(roll.psCo) + ' − PS Nợ ' + E.fmtNum(roll.psNo) + ' = ' + E.fmtNum(roll.ck) + '. Số nộp NSNN suy ra = PS Nợ − khấu trừ (1331 PS Có) = ' + E.fmtNum(roll.nopNSNN) + '; Σ[40] phải nộp trong năm (dư đầu + [40] các kỳ trừ kỳ cuối) = ' + E.fmtNum(roll.phaiNopTrongNam) + ' → có thể nộp thiếu ' + E.fmtNum(roll.thieu) + ' (hoặc [40] tờ khai lần đầu khác bản bổ sung). Đối chiếu sổ thuế trên eTax.' : 'Kiểm số đã nộp (giấy nộp tiền), tờ khai lần đầu vs bổ sung.');
      if (roll) ck('R-3331-ROLL', roll.dk + roll.psCo - roll.psNo, 'Dư đầu + PS Có − PS Nợ', roll.ck, 'Dư Có cuối', 0.5, 'Nộp NSNN suy ra ' + E.fmtNum(roll.nopNSNN) + '.', 'Sổ 33311 không cuộn đúng.', 'ERROR');
      if (S.dtTaiChinh != null || S.thuNhapKhac != null) checks.push({ id: 'R-OTHER-INC', group: 'BCTC↔TK', name: 'DT tài chính (515) / thu nhập khác (711) có HĐ phải nằm trong [34]', a: val(n(S.dtTaiChinh) + n(S.thuNhapKhac)), aLabel: '515 + 711', b: null, bLabel: '', diff: null, status: 'INFO', msg: 'Thanh lý TSCĐ có HĐ → [32]; lãi tiền gửi, phạt/bồi thường → không thuộc [34] (C-FIN, C-OTHER-INC).', verify: 'TC' });
    }
    if (Q && BC) {
      var qr = function (k) { return qtb.filter(function (r) { return r.key === k; })[0]; };
      ['dt', 'dttc', 'gv', 'cpbh', 'qldn', 'cptc', 'tnk', 'cpk'].forEach(function (k) { var r = qr(k); if (r) ck('R-QT-01', r.qt, r.qtLabel, r.bctc, r.bctcLabel, 0.5, '', 'QT TNDN lập từ BCTC phải khớp tuyệt đối — giải trình chênh lệch' + (Q.soLan > 0 && Q.ngayLap > BC.ngayLap ? ' (QT bổ sung lập sau BCTC → xem R-QT-02).' : '.'), 'ERROR', { name: 'PL 03-1A ↔ KQKD: ' + r.label, sub: k }); });
      var rl = qr('ln'); if (rl) ck(Q.soLan > 0 && Q.ngayLap > BC.ngayLap ? 'R-QT-02' : 'R-QT-01', rl.qt, rl.qtLabel, rl.bctc, rl.bctcLabel, 0.5, '', Q.soLan > 0 && Q.ngayLap > BC.ngayLap ? 'BCTC lập ' + E.fmtDate(BC.ngayLap) + ', QT bổ sung lần ' + Q.soLan + ' lập ' + E.fmtDate(Q.ngayLap) + ' → BCTC chưa điều chỉnh theo QT bổ sung.' : '', 'ERROR', { name: '03/TNDN [A1] = PL [22] ↔ KQKD [50]', sub: 'ln' });
      var rt = qr('thue'); if (rt) ck('R-QT-03', rt.qt, rt.qtLabel, rt.bctc, rt.bctcLabel, 0.5, '', 'Thuế TNDN hiện hành trên BCTC (821/KQKD [51]) chưa khớp quyết toán.', 'ERROR');
    }
    if (Q) {
      // R-QT-04: tạm nộp [G] ↔ khoản nộp trong năm thuộc kỳ tính thuế đó (3334)
      var dk3334 = A(BC, '3334', 'dkCo'), no3334 = A(BC, '3334', 'psNo');
      if (Q.ctG != null && dk3334 != null && no3334 != null) {
        var tamNop = r2(Math.max(0, no3334 - dk3334)), iDung = Q.ctE != null ? r2(n(Q.ctE) - tamNop) : null;
        var risk = n(Q.ctG) - tamNop >= 1 && dk3334 > 0;
        checks.push({ id: 'R-QT-04', group: 'QT↔Sổ thuế', name: 'Số tạm nộp [G] ↔ khoản nộp trong năm thuộc kỳ tính thuế ' + y, a: val(Q.ctG), aLabel: '03/TNDN [G]', b: tamNop, bLabel: 'TK 3334 PS Nợ − dư Có đầu năm (thuế QT ' + (y - 1) + ')', diff: diff(Q.ctG, tamNop), status: risk ? 'WARN' : 'OK', verify: 'TC', msg: risk ? 'Rủi ro tính trùng: khoản nộp ' + E.fmtNum(no3334) + ' trong năm có thể là tiền nộp QT ' + (y - 1) + ' (TK 3334 dư Có đầu năm ' + E.fmtNum(dk3334) + '), không phải tạm nộp ' + y + '. Nếu vậy tạm nộp thực ≈ ' + E.fmtNum(tamNop) + ' và [I] đúng ≈ ' + E.fmtNum(iDung) + (iDung > 0 ? ' còn phải nộp' : '') + ' thay vì ' + E.fmtNum(Q.ctI) + '. Tra cứu nghĩa vụ thuế trên eTax; lưu ý tạm nộp 4 quý ≥ 80% số quyết toán.' : '' });
      }
      // R-QT-05: DT 03-1A [04] ↔ DT GTGT có thực hiện (bảng kê sau điều chỉnh)
      if (adjusted != null) ck('R-QT-05', qtDT, 'PL 03-1A [04]', adjusted, baseLabel + ' sau điều chỉnh (trừ thu hộ, DT năm trước, 3387…)', tolRev, '', 'DT TNDN khác DT GTGT có thực hiện — giải thích bằng nguyên nhân chuẩn (C-THUHO, C-TIMING-*, C-RETURN, C-AGENCY, C-QTBS).', 'WARN');
      // R-TNDN-RATE
      var dtPrev = KP['01'] != null ? n(KP['01']) : (ctx.bctcPrev && ctx.bctcPrev.kqkd.namNay['01'] != null ? n(ctx.bctcPrev.kqkd.namNay['01']) : null);
      // Khung 15%/17% theo DT năm trước (Luật TNDN 67/2025) chỉ áp từ kỳ tính thuế 2025; kỳ ≤ 2024: thuế suất phổ thông 20% (hoặc ưu đãi)
      if (Q.thueSuat != null && (y <= 2024 || dtPrev != null)) {
        var rateExp = y <= 2024 ? 20 : dtPrev <= 3e9 ? 15 : dtPrev <= 50e9 ? 17 : 20, okR = +Q.thueSuat === rateExp, pref = +Q.thueSuat < rateExp;
        checks.push({ id: 'R-TNDN-RATE', group: 'QT', name: 'Thuế suất TNDN ' + (y <= 2024 ? 'kỳ tính thuế ' + y + ' (phổ thông 20%)' : 'theo DT năm trước (Luật TNDN 67/2025, từ kỳ 2025)'), a: +Q.thueSuat, aLabel: 'Thuế suất trên QT (%)', b: rateExp, bLabel: y <= 2024 ? 'Thuế suất phổ thông trước 2025' : 'Theo DT ' + (y - 1) + ' = ' + E.fmtNum(dtPrev), diff: +Q.thueSuat - rateExp, status: okR ? 'OK' : pref ? 'INFO' : 'ERROR', verify: 'TC', msg: okR ? '' : pref ? 'Thuế suất thấp hơn mức phổ thông — kiểm tra điều kiện ưu đãi thuế TNDN.' : 'Kiểm C7/C8 (thuế suất cao hơn mức áp dụng).' });
      }
    }
    if (d3387 != null && A(BC, '3387', 'ckCo') > 0) checks.push({ id: 'R-TNDN-TIMING', group: 'QT↔BK', name: 'HĐ dịch vụ lập trước khi hoàn thành (3387 dư cuối) và DT tính thuế TNDN', a: A(BC, '3387', 'ckCo'), aLabel: 'TK 3387 dư Có cuối năm', b: null, bLabel: '', diff: null, status: 'WARN', verify: 'CXM', msg: E.fmtNum(A(BC, '3387', 'ckCo')) + ' đã xuất HĐ nhưng chưa ghi doanh thu kế toán. Nếu quy tắc "HĐ lập trước khi hoàn thành dịch vụ thì DT tính thuế theo ngày lập HĐ" còn áp dụng dưới NĐ 320/2025 thì DT tính thuế TNDN bị thiếu — cần đối chiếu.' });
    var nBad = checks.filter(function (c) { return c.status === 'ERROR' || c.status === 'WARN'; }).length;
    return {
      year: y, qtBctc: qtb, notes: notes, checks: checks, nBad: nBad, roll: roll, derived: derived, nDerived: nDerived,
      revenue: { rows: revRows, diffs: diffs, bridge: bridge, auto: bridge, manual: manual, explained: explained, base: base, adjusted: adjusted, baseDiff: baseDiff, baseLabel: baseLabel + ' − BCTC', baseName: baseLabel, unexplained: unexplained, status: revStatus, tol: tolRev, kct: kct, thuHo: thuHo.amount, bctc: val(bcDT) },
      tax: thue, balances: bal, hasBctc: !!BC, hasBk: bkP.length > 0, hasTk: withTk.length > 0
    };
  }

  /** Giá trị cột "Số trên BCTC" của bảng CHECK TK (theo năm) */
  function checkColumn(bctc) {
    if (!bctc) return {};
    var S = bctc.summary, o = {};
    if (S.tk1331DauNo != null) o.ct22 = { v: S.tk1331DauNo, note: 'Số dư Nợ TK 1331 đầu năm' };
    if (S.tk1331No != null) { o.ct24 = { v: S.tk1331No, note: 'TK 1331 phát sinh Nợ' }; o.ct25 = { v: S.tk1331No, note: 'TK 1331 phát sinh Nợ' }; }
    if (S.dtBanHang != null || S.tk511Co != null) o.ct34 = { v: S.dtBanHang != null ? S.dtBanHang : S.tk511Co, note: 'KQKD [01] / TK 511 PS Có' };
    if (S.tk33311Co != null) o.ct35 = { v: S.tk33311Co, note: 'TK 33311 phát sinh Có' };
    if (S.tk33311Co != null && S.tk1331No != null) o.ct36 = { v: r2(S.tk33311Co - S.tk1331No), note: '33311 PS Có − 1331 PS Nợ' };
    if (S.tk1331CuoiNo != null) { o.ct43 = { v: S.tk1331CuoiNo, note: 'Số dư Nợ TK 1331 cuối năm' }; o.ct41 = o.ct43; }
    return o;
  }

  return { isBctcXml: isBctcXml, parseBctcXml: parseBctcXml, bctcSummary: bctcSummary, buildRecon: buildRecon, checkColumn: checkColumn, cts: cts };
})()

export default Bctc
