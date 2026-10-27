// Đọc/ghi .xlsx tối giản (dùng JSZip) — trả [{name, rows}] cho BctcXl/Ledger.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.

const XlsxDoc = (function () {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function ref(r, c) { return colName(c) + (r + 1); }

  function Sheet(name, wb) {
    this.name = String(name).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31);
    this.wb = wb; this.cells = {}; this.merges = []; this.cols = []; this.rowH = {}; this.freeze = null; this.maxR = 0; this.maxC = 0;
    this.print = { landscape: true, fitWidth: true }; this.tabColor = null; this.showGrid = true;
  }
  /** set(r, c, value, style) — r, c bắt đầu từ 0. value: số | chuỗi | {f:'A1+B1', v:giá trị} | null */
  Sheet.prototype.set = function (r, c, v, style) {
    this.cells[r + ',' + c] = { v: v, s: style ? this.wb.style(style) : 0 };
    if (r > this.maxR) this.maxR = r; if (c > this.maxC) this.maxC = c;
    return this;
  };
  Sheet.prototype.style = function (r, c, style) { var k = r + ',' + c; if (!this.cells[k]) this.cells[k] = { v: null, s: 0 }; this.cells[k].s = this.wb.style(style); if (r > this.maxR) this.maxR = r; if (c > this.maxC) this.maxC = c; return this; };
  Sheet.prototype.merge = function (r1, c1, r2, c2, style) {
    this.merges.push(ref(r1, c1) + ':' + ref(r2, c2));
    if (style) for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) { var k = r + ',' + c; if (this.cells[k]) this.cells[k].s = this.wb.style(style); else this.style(r, c, style); }
    return this;
  };
  Sheet.prototype.width = function (c, w) { this.cols[c] = w; return this; };
  Sheet.prototype.height = function (r, h) { this.rowH[r] = h; return this; };
  Sheet.prototype.toXml = function (sst) {
    var rows = {}, self = this;
    Object.keys(this.cells).forEach(function (k) { var p = k.split(','); var r = +p[0]; (rows[r] = rows[r] || []).push(+p[1]); });
    Object.keys(this.rowH).forEach(function (r) { rows[r] = rows[r] || []; });
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    x += '<sheetPr>' + (this.tabColor ? '<tabColor rgb="' + this.tabColor + '"/>' : '') + (this.print.fitWidth ? '<pageSetUpPr fitToPage="1"/>' : '') + '</sheetPr>';
    x += '<dimension ref="A1:' + ref(this.maxR, this.maxC) + '"/>';
    x += '<sheetViews><sheetView workbookViewId="0"' + (this.showGrid ? '' : ' showGridLines="0"') + '>';
    if (this.freeze) {
      var fr = this.freeze.r || 0, fc = this.freeze.c || 0;
      var pane = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
      x += '<pane' + (fc ? ' xSplit="' + fc + '"' : '') + (fr ? ' ySplit="' + fr + '"' : '') + ' topLeftCell="' + ref(fr, fc) + '" activePane="' + pane + '" state="frozen"/><selection pane="' + pane + '" activeCell="' + ref(fr, fc) + '" sqref="' + ref(fr, fc) + '"/>';
    }
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (this.cols.length) {
      x += '<cols>';
      for (var c = 0; c < this.cols.length; c++) if (this.cols[c]) x += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + this.cols[c] + '" customWidth="1"/>';
      x += '</cols>';
    }
    x += '<sheetData>';
    Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      x += '<row r="' + (r + 1) + '"' + (self.rowH[r] ? ' ht="' + self.rowH[r] + '" customHeight="1"' : '') + '>';
      rows[r].sort(function (a, b) { return a - b; }).forEach(function (c) {
        var cell = self.cells[r + ',' + c], v = cell.v, s = cell.s ? ' s="' + cell.s + '"' : '', a = ref(r, c);
        if (v == null || v === '') { x += '<c r="' + a + '"' + s + '/>'; return; }
        if (typeof v === 'object' && v.date != null) {
          var dm = String(v.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dm) { x += '<c r="' + a + '"' + s + '/>'; return; }
          var serial = Math.round((Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) - Date.UTC(1899, 11, 30)) / 86400000);
          x += '<c r="' + a + '"' + s + '><v>' + serial + '</v></c>'; return;
        }
        if (typeof v === 'object' && v.f != null) {
          var cv = v.v;
          if (typeof cv === 'number' && isFinite(cv)) x += '<c r="' + a + '"' + s + '><f>' + esc(v.f) + '</f><v>' + cv + '</v></c>';
          else if (cv != null && cv !== '') x += '<c r="' + a + '"' + s + ' t="str"><f>' + esc(v.f) + '</f><v>' + esc(cv) + '</v></c>';
          else x += '<c r="' + a + '"' + s + '><f>' + esc(v.f) + '</f></c>';
          return;
        }
        if (typeof v === 'number') { x += isFinite(v) ? '<c r="' + a + '"' + s + '><v>' + v + '</v></c>' : '<c r="' + a + '"' + s + '/>'; return; }
        if (typeof v === 'boolean') { x += '<c r="' + a + '"' + s + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>'; return; }
        x += '<c r="' + a + '"' + s + ' t="s"><v>' + sst.idx(String(v)) + '</v></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (this.merges.length) x += '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    x += '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
    x += '<pageSetup paperSize="9" orientation="' + (this.print.landscape ? 'landscape' : 'portrait') + '"' + (this.print.fitWidth ? ' fitToWidth="1" fitToHeight="0"' : '') + '/>';
    x += '</worksheet>';
    return x;
  };

  function Workbook() {
    this.sheets = []; this._styles = {}; this.xfs = [null];
    this.fonts = ['<font><sz val="11"/><name val="Times New Roman"/><family val="1"/></font>']; this.fontIdx = {};
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']; this.fillIdx = {};
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>']; this.borderIdx = {};
    this.numFmts = []; this.numFmtIdx = {};
    this.creator = 'CHECK THUẾ GTGT';
  }
  Workbook.prototype.addSheet = function (name) { var s = new Sheet(name, this); this.sheets.push(s); return s; };
  Workbook.prototype._font = function (f) {
    f = f || {};
    var x = '<font>' + (f.bold ? '<b/>' : '') + (f.italic ? '<i/>' : '') + (f.underline ? '<u/>' : '') + '<sz val="' + (f.size || 11) + '"/>' + (f.color ? '<color rgb="' + f.color + '"/>' : '') + '<name val="' + esc(f.name || 'Times New Roman') + '"/><family val="1"/></font>';
    if (this.fontIdx[x] == null) { this.fontIdx[x] = this.fonts.length; this.fonts.push(x); }
    return this.fontIdx[x];
  };
  Workbook.prototype._fill = function (argb) {
    if (!argb) return 0;
    var x = '<fill><patternFill patternType="solid"><fgColor rgb="' + argb + '"/><bgColor indexed="64"/></patternFill></fill>';
    if (this.fillIdx[x] == null) { this.fillIdx[x] = this.fills.length; this.fills.push(x); }
    return this.fillIdx[x];
  };
  Workbook.prototype._border = function (b) {
    if (!b) return 0;
    var st = typeof b === 'string' ? { left: b, right: b, top: b, bottom: b } : b;
    function side(n) { return st[n] ? '<' + n + ' style="' + st[n] + '"><color rgb="FF000000"/></' + n + '>' : '<' + n + '/>'; }
    var x = '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>';
    if (this.borderIdx[x] == null) { this.borderIdx[x] = this.borders.length; this.borders.push(x); }
    return this.borderIdx[x];
  };
  Workbook.prototype._numFmt = function (f) {
    if (!f || f === 'General') return 0;
    var builtin = { '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '@': 49 };
    if (builtin[f] != null) return builtin[f];
    if (this.numFmtIdx[f] == null) { this.numFmtIdx[f] = 164 + this.numFmts.length; this.numFmts.push(f); }
    return this.numFmtIdx[f];
  };
  /** style({font:{name,size,bold,italic,color}, fill:'FF33CCCC', border:'thin', align:{h,v,wrap,indent}, numFmt}) → xf index */
  Workbook.prototype.style = function (st) {
    if (typeof st === 'number') return st;
    var key = JSON.stringify(st);
    if (this._styles[key] != null) return this._styles[key];
    var a = st.align || {};
    var xf = '<xf numFmtId="' + this._numFmt(st.numFmt) + '" fontId="' + this._font(st.font) + '" fillId="' + this._fill(st.fill) + '" borderId="' + this._border(st.border) + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
      '<alignment' + (a.h ? ' horizontal="' + a.h + '"' : '') + ' vertical="' + (a.v || 'center') + '"' + (a.wrap ? ' wrapText="1"' : '') + (a.indent ? ' indent="' + a.indent + '"' : '') + '/></xf>';
    var idx = this.xfs.length; this.xfs.push(xf); this._styles[key] = idx;
    return idx;
  };
  Workbook.prototype._stylesXml = function () {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (this.numFmts.length) x += '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join('') + '</numFmts>';
    x += '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>';
    x += '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>';
    x += '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>';
    x += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
    var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'].concat(this.xfs.slice(1));
    x += '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>';
    x += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    return x;
  };
  /** Tạo file → Promise<Uint8Array|Blob> (type: 'uint8array' | 'blob' | 'nodebuffer') */
  Workbook.prototype.generate = function (JSZip, type) {
    var zip = new JSZip(), sst = { list: [], map: {}, idx: function (s) { if (this.map[s] == null) { this.map[s] = this.list.length; this.list.push(s); } return this.map[s]; } };
    var self = this;
    var sheetXml = this.sheets.map(function (s) { return s.toXml(sst); });
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      this.sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>' + esc(this.creator) + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>');
    zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>' + esc(this.creator) + '</Application></Properties>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
      this.sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' + (function (sh) { var dn = sh.map(function (s, i) { return s.printTitleRows ? '<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">\'' + esc(s.name).replace(/'/g, "''") + '\'!$' + s.printTitleRows[0] + ':$' + s.printTitleRows[1] + '</definedName>' : ''; }).join(''); return dn ? '<definedNames>' + dn + '</definedNames>' : ''; })(this.sheets) + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      this.sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (this.sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId' + (this.sheets.length + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
    sheetXml.forEach(function (x, i) { zip.file('xl/worksheets/sheet' + (i + 1) + '.xml', x); });
    zip.file('xl/styles.xml', self._stylesXml());
    zip.file('xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sst.list.length + '" uniqueCount="' + sst.list.length + '">' + sst.list.map(function (s) { return '<si><t xml:space="preserve">' + esc(s) + '</t></si>'; }).join('') + '</sst>');
    return zip.generateAsync({ type: type || 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  /* -------- Đọc .xlsx (sheet đầu hoặc tất cả) → mảng dòng giá trị -------- */
  function unesc(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); }).replace(/&amp;/g, '&'); }
  function colIdx(letters) { var n = 0; for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64); return n - 1; }
  function read(JSZip, data) {
    return JSZip.loadAsync(data).then(function (zip) {
      var f = function (p) { var e = zip.file(p); return e ? e.async('string') : Promise.resolve(''); };
      return Promise.all([f('xl/workbook.xml'), f('xl/_rels/workbook.xml.rels'), f('xl/sharedStrings.xml')]).then(function (r) {
        var wbx = r[0], rels = r[1], ssx = r[2];
        var sst = [], m, re = /<si>([\s\S]*?)<\/si>/g;
        while ((m = re.exec(ssx))) { var t = '', r2 = /<t[^>]*>([\s\S]*?)<\/t>/g, mm; while ((mm = r2.exec(m[1]))) t += unesc(mm[1]); sst.push(t); }
        var relMap = {}; var rr = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g; while ((m = rr.exec(rels))) relMap[m[1]] = m[2];
        var rr2 = /<Relationship[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g; while ((m = rr2.exec(rels))) relMap[m[2]] = relMap[m[2]] || m[1];
        var sheets = [], sr = /<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g;
        while ((m = sr.exec(wbx))) sheets.push({ name: unesc(m[1]), path: 'xl/' + String(relMap[m[2]] || '').replace(/^\/?xl\//, '').replace(/^\//, '') });
        return Promise.all(sheets.map(function (s) { return f(s.path); })).then(function (xmls) {
          return sheets.map(function (s, i) {
            var rows = [], cr = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
            var x = xmls[i];
            while ((cm = cr.exec(x))) {
              var attrs = cm[1], body = cm[2] || '';
              var rm = attrs.match(/r="([A-Z]+)(\d+)"/); if (!rm) continue;
              var c = colIdx(rm[1]), rI = +rm[2] - 1;
              var t = (attrs.match(/t="(\w+)"/) || [])[1];
              var vm = body.match(/<v>([\s\S]*?)<\/v>/), val = null;
              if (t === 's') val = vm ? sst[+vm[1]] : '';
              else if (t === 'inlineStr') { var im = body.match(/<t[^>]*>([\s\S]*?)<\/t>/); val = im ? unesc(im[1]) : ''; }
              else if (t === 'str') val = vm ? unesc(vm[1]) : '';
              else if (t === 'b') val = vm ? vm[1] === '1' : null;
              else val = vm ? parseFloat(vm[1]) : null;
              (rows[rI] = rows[rI] || [])[c] = val;
            }
            for (var k = 0; k < rows.length; k++) rows[k] = rows[k] || [];
            return { name: s.name, rows: rows };
          });
        });
      });
    });
  }
  return { Workbook: Workbook, read: read, colName: colName, ref: ref };
})()

export default XlsxDoc
