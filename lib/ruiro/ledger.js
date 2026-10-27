// Đọc sổ chi tiết công nợ theo đối tượng và bảng kê hóa đơn đầu vào rủi ro.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.

const Ledger = (function () {
  'use strict';
  function fold(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function num(v) {
    if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim(), neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[()\s]/g, '').replace(/^-/, '');
    if (!/^[\d.,]+$/.test(s)) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); else s = s.replace(',', '.');
    var x = parseFloat(s); return isFinite(x) ? (neg ? -x : x) : null;
  }
  function excelDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) { var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return d.toISOString().slice(0, 10); }
    var m = String(v).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : String(v);
  }
  function headText(rows, n) { var o = []; for (var i = 0; i < Math.min(rows.length, n || 12); i++) o.push((rows[i] || []).filter(function (x) { return x != null && x !== ''; }).join(' ')); return fold(o.join(' | ')); }
  /** Tìm dòng tiêu đề có nhiều nhãn khớp nhất */
  function findHeader(rows, defs) {
    var best = null;
    for (var r = 0; r < Math.min(rows.length, 40); r++) {
      var row = rows[r] || [], map = {}, hit = 0;
      // gộp 2 dòng tiêu đề (dòng nhóm + dòng Nợ/Có)
      var next = rows[r + 1] || [], grp = '';
      for (var c = 0; c < Math.max(row.length, next.length); c++) {
        var t = fold(row[c]); if (t) grp = t;
        var t2 = fold(next[c]), lab = (t2 && /^(no|co)$/.test(t2) ? (t || grp) + ' ' + t2 : t);
        if (!lab) continue;
        Object.keys(defs).forEach(function (k) { if (map[k] == null && defs[k].test(lab)) { map[k] = c; hit++; } });
      }
      if (hit >= 2 && (!best || hit > best.hit)) best = { r: r, map: map, hit: hit, twoRow: next.some(function (x) { return /^(no|co)$/.test(fold(x)); }) };
    }
    return best;
  }
  var LEDGER = {
    ma: /^ma (khach hang|ncc|nha cung cap|doi tuong|nhan vien|kh)\b|^ma$/,
    ten: /^ten (khach hang|nha cung cap|ncc|doi tuong|nhan vien|ben vay|ben di vay)|^khach hang$|^nha cung cap$|^doi tuong$|^ho( va)? ten|^ten$/,
    tk: /^(tai khoan|tk|so hieu tk|tk cong no)$/,
    dnDau: /dau (ky|nam).*no$|^du no dau/, dcDau: /dau (ky|nam).*co$|^du co dau/,
    psNo: /phat sinh.*no$|^ps no|^phat sinh no/, psCo: /phat sinh.*co$|^ps co|^phat sinh co/,
    dnCuoi: /cuoi (ky|nam).*no$|^du no cuoi|^du no$/, dcCuoi: /cuoi (ky|nam).*co$|^du co cuoi|^du co$/,
    ngay: /^ngay (ky|phat sinh|hop dong|chung tu)|^ngay$/, ghiChu: /^ghi chu|^dien giai/
  };
  var INV = { so: /^so (hoa don|hd)|^so$/, ngay: /^ngay (lap|hoa don|hd)|^ngay$/, mst: /^(mst|ma so thue)/, ten: /^ten (nguoi ban|ncc|nha cung cap|don vi ban|doanh nghiep)|^nguoi ban|^ten$/, tien: /tien chua thue|^gia tri|chua co thue|^doanh so/, thue: /tien thue|^thue gtgt|^thue$/ };
  function detect(sheets) {
    for (var i = 0; i < sheets.length; i++) {
      var s = sheets[i], t = headText(s.rows, 14);
      var hi = findHeader(s.rows, INV), hl = findHeader(s.rows, LEDGER);
      if (hi && hi.map.so != null && hi.map.mst != null && (hi.map.tien != null || hi.map.thue != null)) return { kind: 'HDRR', sheet: s, hdr: hi, text: t };
      if (hl && hl.map.ten != null && (hl.map.dnCuoi != null || hl.map.dcCuoi != null || hl.map.psNo != null)) return { kind: 'SOCT', sheet: s, hdr: hl, text: t };
    }
    return null;
  }
  function guessAcc(text, fileName) {
    var s = text + ' ' + fold(fileName || '');
    var m = s.match(/\b(tk|tai khoan)[\s:.]*(\d{3,5})\b/) || s.match(/\b(131|331|141|128|1283|334|1388|138|3388|338)\b/);
    if (m) return m[2] || m[1];
    if (/phai thu khach hang|cong no phai thu/.test(s)) return '131';
    if (/phai tra (nguoi ban|nha cung cap)|cong no phai tra/.test(s)) return '331';
    if (/tam ung/.test(s)) return '141';
    if (/cho vay/.test(s)) return '128';
    return '';
  }
  function guessYear(text, fileName) { var m = (text + ' ' + fold(fileName || '')).match(/(?:nam|den ngay \d{1,2}\/\d{1,2}\/|31\/12\/|\b)(20\d{2})\b/g); if (!m) return 0; var ys = m.map(function (x) { return +x.slice(-4); }); return Math.max.apply(null, ys); }
  /** parse(sheets, fileName) → {kind:'SOCT'|'HDRR', acc, nam, rows[], tong{}} hoặc null */
  function parse(sheets, fileName) {
    var d = detect(sheets); if (!d) return null;
    var rows = d.sheet.rows, h = d.hdr, start = h.r + (h.twoRow ? 2 : 1), out = [];
    var get = function (row, k) { return h.map[k] != null ? row[h.map[k]] : null; };
    for (var r = start; r < rows.length; r++) {
      var row = rows[r] || [];
      if (d.kind === 'SOCT') {
        var ten = String(get(row, 'ten') || '').trim(); if (!ten || /^(tong( cong| so)?|cong( phat sinh)?|so du)\s*:?$|^tong cong\b/.test(fold(ten))) continue;
        var o = { ma: String(get(row, 'ma') || '').trim(), ten: ten, tk: String(get(row, 'tk') || '').trim(), ngay: excelDate(get(row, 'ngay')), ghiChu: String(get(row, 'ghiChu') || '').trim() };
        ['dnDau', 'dcDau', 'psNo', 'psCo', 'dnCuoi', 'dcCuoi'].forEach(function (k) { o[k] = num(get(row, k)) || 0; });
        if (!o.dnDau && !o.dcDau && !o.psNo && !o.psCo && !o.dnCuoi && !o.dcCuoi) continue;
        out.push(o);
      } else {
        var so = get(row, 'so'); if (so == null || so === '' || /^tong/.test(fold(so))) continue;
        out.push({ so: String(so).trim(), ngay: excelDate(get(row, 'ngay')), mst: String(get(row, 'mst') || '').replace(/\s/g, ''), ten: String(get(row, 'ten') || '').trim(), tien: num(get(row, 'tien')) || 0, thue: num(get(row, 'thue')) || 0 });
      }
    }
    var res = { kind: d.kind, sheet: d.sheet.name, rows: out, nam: guessYear(d.text, fileName) };
    if (d.kind === 'SOCT') { res.acc = guessAcc(d.text, fileName); res.tong = out.reduce(function (s, o) { ['dnCuoi', 'dcCuoi', 'psNo', 'psCo'].forEach(function (k) { s[k] = (s[k] || 0) + o[k]; }); return s; }, {}); }
    else res.tong = { tien: out.reduce(function (s, o) { return s + o.tien; }, 0), thue: out.reduce(function (s, o) { return s + o.thue; }, 0) };
    return res;
  }
  return { parse: parse, detect: detect, fold: fold };
})()

export default Ledger
