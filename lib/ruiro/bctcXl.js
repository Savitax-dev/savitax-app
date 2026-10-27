// Nhận diện & đọc BCTC dạng bảng tính (BCĐKT, KQKD, LCTT, bảng cân đối tài khoản, thuyết minh).
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.

const BctcXl = (function () {
  'use strict';
  function fold(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function cellRef(r, c) { return colName(c) + (r + 1); }
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim(); if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[()\s]/g, '').replace(/^-/, '');
    if (!/^[\d.,]+$/.test(s)) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var x = parseFloat(s); return isFinite(x) ? (neg ? -x : x) : null;
  }
  function rowText(row) { return (row || []).filter(function (v) { return v != null && v !== ''; }).map(String).join(' | '); }
  function headText(rows, n) { var out = []; for (var i = 0; i < Math.min(rows.length, n || 40); i++) out.push(rowText(rows[i])); return fold(out.join(' \n ')); }

  // Savitax sửa (27/10/2026): dòng tiêu đề bảng cân đối tài khoản kiểu MISA mẫu quản trị — một ô ĐÚNG "Số tài khoản" và một ô
  // bắt đầu "Tên tài khoản" trên cùng một dòng (sao kê ngân hàng ghi hai nhãn này ở hai dòng khác nhau, kèm dấu ":").
  function coDongTieuDeCdtk(rows) {
    for (var r = 0; r < Math.min((rows || []).length, 45); r++) {
      var o = (rows[r] || []).map(function (v) { return fold(v); });
      if (o.indexOf('so tai khoan') >= 0 && o.some(function (x) { return /^ten tai khoan/.test(x); })) return true;
    }
    return false;
  }
  /** Phân loại sheet */
  function classify(sheet) {
    var nm = fold(sheet.name), t = headText(sheet.rows, 45);
    if (nm === 'header') return 'header';
    if (/khbs|giai trinh khai bo sung/.test(nm) || /^giai trinh khai bo sung/.test(t)) return 'khbs';
    if (/thuyet minh bao cao tai chinh/.test(t)) return 'tm';
    if (/can doi tai khoan|can doi so phat sinh/.test(t) || (/so hieu tai khoan/.test(t) && /phat sinh/.test(t)) || coDongTieuDeCdtk(sheet.rows)) return 'cdtk';
    if (/luu chuyen tien te/.test(t)) return /gian tiep/.test(t) ? 'lctt_gt' : 'lctt_tt';
    if (/ket qua hoat dong kinh doanh/.test(t)) return 'kqkd';
    if (/tinh hinh tai chinh|can doi ke toan/.test(t)) return 'bcdkt';
    if (/^bcdkt|^bcthtc/.test(nm)) return 'bcdkt';
    if (/^kqkd|^bckq/.test(nm)) return 'kqkd';
    if (/^lctt/.test(nm)) return 'lctt_tt';
    if (/^cdtk|^bcdtk|^cdps/.test(nm)) return 'cdtk';
    return null;
  }
  function findHeader(rows, pred, maxRow) {
    for (var r = 0; r < Math.min(rows.length, maxRow || 80); r++) {
      var row = rows[r] || [];
      for (var c = 0; c < row.length; c++) if (pred(fold(row[c]), r, c)) return { r: r, c: c };
    }
    return null;
  }
  function normCode(v, width) {
    if (v == null || v === '') return null;
    var s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim();
    if (!/^\d{1,3}[a-z]?$/i.test(s)) return null;
    var m = s.match(/^(\d+)([a-z]?)$/i);
    var d = m[1]; while (d.length < width) d = '0' + d;
    return d + (m[2] || '').toLowerCase();
  }
  /** Dòng đánh số cột "(1) | 1 | 2 | 3 | 4 | 5" dưới tiêu đề */
  function isOrdinalRow(row) {
    var seq = [];
    (row || []).forEach(function (v) { var t = String(v == null ? '' : v).trim(); var m = t.match(/^\(?(\d{1,2})\)?$/); if (m) seq.push(+m[1]); });
    var run = 1; for (var i = 1; i < seq.length; i++) { run = seq[i] === seq[i - 1] + 1 ? run + 1 : 1; if (run >= 4) return true; }
    return false;
  }
  /** Bảng theo cột "Mã số": trả về {cur:{ma:v}, prev:{ma:v}, labels, trace} */
  function codeTable(sheet, kind) {
    var rows = sheet.rows, width = kind === 'bcdkt' ? 3 : 2;
    var h = findHeader(rows, function (t) { return t === 'ma so' || t === 'ma so chi tieu' || t === 'ma'; });
    if (!h) return null;
    var hr = rows[h.r], curC = null, prevC = null, lblC = null;
    var scanRows = [h.r, h.r + 1];
    scanRows.forEach(function (ri) {
      (rows[ri] || []).forEach(function (v, c) {
        var t = fold(v); if (!t || /du lieu|cot du lieu/.test(t)) return;
        if (curC == null && /^(so )?cuoi (nam|ky)|^nam nay|^ky nay|^so cuoi/.test(t)) curC = c;
        else if (prevC == null && /^(so )?dau (nam|ky)|^nam truoc|^ky truoc|^so dau/.test(t)) prevC = c;
        if (lblC == null && /^chi tieu|^tai san|^noi dung/.test(t)) lblC = c;
      });
    });
    if (curC == null) { // không có tiêu đề cột giá trị: lấy 2 cột số đầu tiên bên phải cột Mã số
      for (var r0 = h.r + 1; r0 < Math.min(rows.length, h.r + 30) && curC == null; r0++) {
        var cs = []; (rows[r0] || []).forEach(function (v, c) { if (c > h.c && typeof v === 'number') cs.push(c); });
        if (cs.length) { curC = cs[0]; prevC = cs.length > 1 ? cs[1] : null; }
      }
    }
    var out = { cur: {}, prev: {}, labels: {}, trace: {}, codeCol: h.c, curCol: curC, prevCol: prevC };
    for (var r = h.r + 1; r < rows.length; r++) {
      var row = rows[r] || [], code = normCode(row[h.c], width);
      if (!code) continue;
      if (isOrdinalRow(row)) continue;
      if (out.cur[code] != null) continue;
      var a = curC != null ? num(row[curC]) : null, b = prevC != null ? num(row[prevC]) : null;
      out.cur[code] = a == null ? 0 : a; out.prev[code] = b == null ? 0 : b;
      var lbl = ''; if (lblC != null) lbl = row[lblC]; if (!lbl) for (var c2 = 0; c2 < h.c; c2++) if (typeof row[c2] === 'string' && row[c2].trim().length > 3) { lbl = row[c2]; break; }
      out.labels[code] = String(lbl || '').replace(/\s+/g, ' ').trim();
      out.trace[code] = { sheet: sheet.name, cell: curC != null ? cellRef(r, curC) : null, cellPrev: prevC != null ? cellRef(r, prevC) : null, row: r + 1 };
    }
    void hr;
    return out;
  }
  /** Bảng cân đối tài khoản */
  function cdtkTable(sheet) {
    var rows = sheet.rows;
    // Savitax sửa (27/10/2026): thêm "Số tài khoản" — tên cột của MISA ở mẫu quản trị (DOEL 2025). Thiếu nó thì bảng cân đối
    // tài khoản bị bỏ, 6 tiêu chí (R02 R03 R07 R08 R09 R12) ra "Thiếu dữ liệu" dù file có trong thư mục.
    var h = findHeader(rows, function (t) { return /^so hieu( tai khoan| tk)?$|^so tai khoan$|^ma tai khoan$|^tai khoan$|^so tk$/.test(t); });
    if (!h) return null;
    var grp = {}, cur = null, hr = rows[h.r] || [], nr = rows[h.r + 1] || [];
    var maxC = Math.max(hr.length, nr.length);
    var cols = {};
    for (var c = 0; c < maxC; c++) {
      var t = fold(hr[c]);
      if (t) {
        if (/dau (ky|nam)/.test(t) && !grp.dk) cur = 'dk';
        else if (/phat sinh/.test(t) && !grp.ps) cur = 'ps';
        else if (/cuoi (ky|nam)/.test(t) && !grp.ck) cur = 'ck';
        else cur = null;
        if (cur) grp[cur] = true;
      }
      var sub = fold(nr[c]);
      if (cur && (sub === 'no' || sub === 'co')) { var key = cur + (sub === 'no' ? 'No' : 'Co'); if (cols[key] == null) cols[key] = c; }
    }
    var lblC = null; hr.forEach(function (v, c) { if (lblC == null && /^ten tai khoan/.test(fold(v))) lblC = c; });
    var out = { acc: {}, labels: {}, trace: {}, cols: cols };
    for (var r = h.r + 1; r < rows.length; r++) {
      var row = rows[r] || [], code = row[h.c];
      code = code == null ? '' : (typeof code === 'number' ? String(Math.round(code)) : String(code).trim());
      if (!/^\d{3,7}$/.test(code)) continue;
      if (out.acc[code]) continue;
      var o = {};
      Object.keys(cols).forEach(function (k) { var v = num(row[cols[k]]); o[k] = v == null ? 0 : v; });
      out.acc[code] = o; out.labels[code] = String((lblC != null ? row[lblC] : '') || '').trim();
      out.trace[code] = { sheet: sheet.name, row: r + 1, cells: Object.keys(cols).reduce(function (m, k) { m[k] = cellRef(r, cols[k]); return m; }, {}) };
    }
    return out;
  }
  function headerSheet(sheet) {
    var o = {}, rows = sheet.rows;
    rows.forEach(function (row) {
      row = row || [];
      for (var c = 0; c < row.length; c++) {
        var t = fold(row[c]), nx = row[c + 1];
        if (t === 'ma so thue' && !o.mst) { var d = ''; for (var k = c + 1; k < Math.min(row.length, c + 16); k++) { var s = String(row[k] == null ? '' : row[k]).trim(); if (/^[\d-]$/.test(s)) d += s; else if (s && d) break; } o.mst = d; }
        if (t === 'nguoi nop thue' && !o.tenNNT && nx) o.tenNNT = String(nx).trim();
        if (/^(matkhai|tentkhai|kykkhai|loaitkhai|solan|kieuky)$/.test(t) && nx != null) o[t] = String(nx).trim();
      }
    });
    return o;
  }
  function tmTable(sheet) {
    var rows = sheet.rows, out = [];
    var h = findHeader(rows, function (t) { return /^ten chi tieu|^chi tieu|^khoan muc/.test(t); }, 15);
    var cols = []; if (h) (rows[h.r] || []).forEach(function (v, c) { if (c !== h.c && v != null && v !== '') cols.push({ c: c, label: String(v).trim() }); });
    for (var r = h ? h.r + 1 : 3; r < rows.length; r++) {
      var row = rows[r] || [], lbl = row[h ? h.c : 0];
      if (lbl == null || lbl === '' || typeof lbl !== 'string') continue;
      var vals = cols.map(function (cc) { var v = row[cc.c]; return v == null ? null : v; });
      if (/^so dong =/.test(fold(lbl))) continue;
      out.push({ label: lbl.replace(/\s+/g, ' ').trim(), values: vals, row: r + 1 });
    }
    return { sheet: sheet.name, cols: cols.map(function (c) { return c.label; }), rows: out };
  }
  function findYear(texts) {
    var y = null;
    texts.some(function (t) {
      var m = t.match(/tai ngay \d{1,2} thang \d{1,2} nam (\d{4})/) || t.match(/den ngay \d{1,2}\/\d{1,2}\/(\d{4})/) || t.match(/\bnam (20\d{2}|19\d{2})\b/) || t.match(/ky ke toan nam:? tu ngay \d{2}\/\d{2}\/\d{4} den ngay \d{2}\/\d{2}\/(\d{4})/);
      if (m) { y = +m[1]; return true; } return false;
    });
    return y;
  }
  function findLabelValue(rows, re) {
    for (var r = 0; r < Math.min(rows.length, 40); r++) {
      var row = rows[r] || [];
      for (var c = 0; c < row.length; c++) if (re.test(fold(row[c]))) { for (var k = c + 1; k < row.length; k++) if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim(); }
    }
    return '';
  }
  function detectForm(text, hdr) {
    var ma = hdr && hdr.matkhai;
    if (ma === '683') return 'TT133-B01a'; if (ma === '684') return 'TT133-B01b'; if (ma === '699' || ma === '700' || ma === '402') return 'TT200-B01DN';
    if (/99\/2025\/tt-btc/.test(text)) return 'TT99-B01DN';
    if (/b01a ?- ?dnn/.test(text)) return 'TT133-B01a';
    if (/b01b ?- ?dnn/.test(text)) return 'TT133-B01b';
    if (/(b0[23]|f01) ?- ?dnn/.test(text)) return /b01b|khong dap ung gia dinh hoat dong lien tuc/.test(text) ? 'TT133-B01b' : 'TT133-B01a';
    if (/b01 ?- ?dnn/.test(text)) return 'TT133-B01b';
    if (/200\/2014\/tt-btc/.test(text)) return 'TT200-B01DN';
    if (/b0[123] ?- ?dn\b/.test(text)) return 'B01-DN'; // mẫu DN không ghi thông tư: TT99 nếu năm ≥ 2026, ngược lại TT200 (cũ)
    if (/133\/2016/.test(text)) return /tinh hinh tai chinh/.test(text) ? 'TT133-B01a' : 'TT133-B01b';
    return 'BCTC';
  }
  function looksLikeBctc(sheets) { return sheets.some(function (s) { var k = classify(s); return k && k !== 'header' && k !== 'khbs'; }); }

  /**
   * parse(sheets, fileName, srcType) → BCTC object (giống Bctc.parseBctcXml) hoặc {kind:'TMBCTC'} nếu chỉ có thuyết minh.
   */
  function parse(sheets, fileName, srcType) {
    var kinds = {}, hdr = null, texts = [], warnings = [];
    sheets.forEach(function (s) { var k = classify(s); s._kind = k; if (k) (kinds[k] = kinds[k] || []).push(s); if (k === 'header') hdr = headerSheet(s); if (k && k !== 'header') texts.push(headText(s.rows, 45)); });
    var o = { kind: 'BCTC', form: '', nam: 0, mst: '', tenNNT: '', ngayLap: '', source: { type: srcType || 'xlsx', fileName: fileName || '' }, kqkd: { namNay: {}, namTruoc: {} }, cdtk: {}, bcdkt: { cuoiNam: {}, dauNam: {} }, lctt: null, tm: [], trace: {}, labels: { bcdkt: {}, kqkd: {}, lctt: {}, cdtk: {} }, sheets: {}, warnings: warnings };
    var allText = texts.join('\n');
    o.form = detectForm(allText, hdr);
    o.nam = (hdr && +hdr.kykkhai) || findYear(texts) || 0;
    var firstRows = (kinds.bcdkt || kinds.kqkd || kinds.lctt_tt || kinds.cdtk || kinds.tm || sheets)[0];
    o.mst = String((hdr && hdr.mst) || findLabelValue(firstRows ? firstRows.rows : [], /^ma so thue:?$/) || '').replace(/[^\d-]/g, '');
    o.tenNNT = (hdr && hdr.tenNNT) || findLabelValue(firstRows ? firstRows.rows : [], /^nguoi nop thue:?$|^ten (doanh nghiep|don vi|nnt):?$/);
    if (hdr) { o.loaiTKhai = hdr.loaitkhai || 'C'; o.soLan = +(hdr.solan || 0) || 0; o.maTKhai = hdr.matkhai || ''; }
    // ngày lập
    sheets.some(function (s) { var v = findLabelValue(s.rows.slice(Math.max(0, s.rows.length - 20)), /^ngay (lap|ky):?$/); if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { o.ngayLap = v.slice(6) + '-' + v.slice(3, 5) + '-' + v.slice(0, 2); return true; } return false; });
    if (kinds.bcdkt) {
      var b = codeTable(kinds.bcdkt[0], 'bcdkt');
      if (b) { o.bcdkt.cuoiNam = b.cur; o.bcdkt.dauNam = b.prev; o.labels.bcdkt = b.labels; Object.keys(b.trace).forEach(function (k) { o.trace['bs.' + k] = { sheet: b.trace[k].sheet, cell: b.trace[k].cell }; o.trace['bs0.' + k] = { sheet: b.trace[k].sheet, cell: b.trace[k].cellPrev }; }); o.sheets.bcdkt = kinds.bcdkt[0].name; }
      else warnings.push('Không tìm thấy cột "Mã số" trên sheet ' + kinds.bcdkt[0].name);
      var yk = findLabelValue(kinds.bcdkt[0].rows, /^y kien kiem toan:?$/); if (yk) o.auditOpinion = yk;
    }
    if (kinds.kqkd) {
      var k = codeTable(kinds.kqkd[0], 'kqkd');
      if (k) { o.kqkd.namNay = k.cur; o.kqkd.namTruoc = k.prev; o.labels.kqkd = k.labels; Object.keys(k.trace).forEach(function (c) { o.trace['kq.' + c] = { sheet: k.trace[c].sheet, cell: k.trace[c].cell }; o.trace['kq0.' + c] = { sheet: k.trace[c].sheet, cell: k.trace[c].cellPrev }; }); o.sheets.kqkd = kinds.kqkd[0].name; }
    }
    // LCTT: ưu tiên phương pháp có số liệu
    var cands = [];
    (kinds.lctt_tt || []).forEach(function (s) { cands.push({ s: s, m: 'TT' }); });
    (kinds.lctt_gt || []).forEach(function (s) { cands.push({ s: s, m: 'GT' }); });
    var best = null;
    cands.forEach(function (cd) {
      var t = codeTable(cd.s, 'lctt'); if (!t) return;
      var nz = Object.keys(t.cur).filter(function (x) { return Math.abs(t.cur[x]) > 0 || Math.abs(t.prev[x]) > 0; }).length;
      if (!best || nz > best.nz) best = { t: t, m: cd.m, nz: nz, name: cd.s.name };
    });
    if (best) {
      o.lctt = { tag: 'XLS', method: best.m, namNay: best.t.cur, namTruoc: best.t.prev };
      o.labels.lctt = best.t.labels; o.sheets.lctt = best.name;
      Object.keys(best.t.trace).forEach(function (c) { o.trace['cf.' + c] = { sheet: best.t.trace[c].sheet, cell: best.t.trace[c].cell }; o.trace['cf0.' + c] = { sheet: best.t.trace[c].sheet, cell: best.t.trace[c].cellPrev }; });
      if (!best.nz) warnings.push('Báo cáo lưu chuyển tiền tệ toàn số 0');
    }
    if (kinds.cdtk) {
      // Savitax sửa: thử lần lượt các sheet, lấy sheet đầu tiên có cột Nợ/Có (trước chỉ lấy sheet đầu — sheet nhận nhầm che bảng thật)
      var dsCd = kinds.cdtk.map(function (s) { return { s: s, cd: cdtkTable(s) }; }).filter(function (x) { return x.cd; });
      var chonCd = dsCd.filter(function (x) { return Object.keys(x.cd.cols).length; })[0] || dsCd[0];
      var cd = chonCd ? chonCd.cd : null;
      if (cd) { o.cdtk = cd.acc; o.labels.cdtk = cd.labels; o.sheets.cdtk = chonCd.s.name; Object.keys(cd.trace).forEach(function (a) { var tr = cd.trace[a]; Object.keys(tr.cells).forEach(function (f) { o.trace['tk.' + a + '.' + f] = { sheet: tr.sheet, cell: tr.cells[f] }; }); }); if (!Object.keys(cd.cols).length) warnings.push('Không nhận diện được cột Nợ/Có của Bảng cân đối tài khoản'); }
    }
    (kinds.tm || []).forEach(function (s) { o.tm.push(tmTable(s)); });
    var hasMain = Object.keys(o.bcdkt.cuoiNam).length || Object.keys(o.kqkd.namNay).length || o.lctt || Object.keys(o.cdtk).length;
    if (!hasMain && o.tm.length) {
      o.kind = 'TMBCTC';
      if (!o.nam) o.nam = findYear(o.tm.map(function (t) { return fold(t.rows.slice(0, 12).map(function (r) { return r.label + ' ' + r.values.join(' '); }).join(' ')); })) || 0;
    }
    if (!hasMain && !o.tm.length) { var e = new Error('Không nhận diện được BCTC trong bảng tính (cần sheet có cột "Mã số" hoặc "Số hiệu tài khoản")'); e.code = 'notbctc'; throw e; }
    o.parts = { bcdkt: !!Object.keys(o.bcdkt.cuoiNam).length, kqkd: !!Object.keys(o.kqkd.namNay).length, lctt: !!o.lctt, cdtk: !!Object.keys(o.cdtk).length, tm: o.tm.length };
    return o;
  }
  return { parse: parse, classify: classify, looksLikeBctc: looksLikeBctc, fold: fold, num: num, cellRef: cellRef };
})()

export default BctcXl
