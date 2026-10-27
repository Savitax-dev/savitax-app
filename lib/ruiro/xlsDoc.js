// Đọc Excel 97-2003 (.xls, BIFF8) — trả [{name, rows}] giống XlsxDoc.read.
// Chuyển từ bộ máy Rủi ro thuế 3.2.0 — giữ nguyên logic; sửa lỗi thì ghi chú "Savitax sửa" ngay tại chỗ.

const XlsDoc = (function () {
  'use strict';
  var SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  function toU8(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && data.buffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    throw new Error('Dữ liệu .xls không hợp lệ');
  }
  function isXls(data) { var u = toU8(data); if (u.length < 512) return false; for (var i = 0; i < 8; i++) if (u[i] !== SIG[i]) return false; return true; }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }
  function i32(b, o) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24); }
  function f64(b, o) { var dv = new DataView(b.buffer, b.byteOffset + o, 8); return dv.getFloat64(0, true); }

  /* ---------- CFB ---------- */
  function readCfb(u) {
    if (!isXls(u)) throw new Error('Không phải file Excel 97-2003 (.xls)');
    var secShift = u16(u, 30), miniShift = u16(u, 32), secSize = 1 << secShift, miniSize = 1 << miniShift;
    var nFat = u32(u, 44), dirStart = u32(u, 48), miniCutoff = u32(u, 56), miniFatStart = u32(u, 60), nMiniFat = u32(u, 64), difatStart = u32(u, 68), nDifat = u32(u, 72);
    var ENDOFCHAIN = 0xFFFFFFFE, FREESECT = 0xFFFFFFFF;
    function secOff(s) { return (s + 1) * secSize; }
    var fatSecs = [];
    for (var i = 0; i < 109 && fatSecs.length < nFat; i++) { var s = u32(u, 76 + i * 4); if (s !== FREESECT) fatSecs.push(s); }
    var ds = difatStart, guard = 0;
    while (fatSecs.length < nFat && ds !== ENDOFCHAIN && ds !== FREESECT && guard++ < 100000) {
      var off = secOff(ds), per = secSize / 4 - 1;
      for (var j = 0; j < per && fatSecs.length < nFat; j++) { var v = u32(u, off + j * 4); if (v !== FREESECT) fatSecs.push(v); }
      ds = u32(u, off + per * 4);
    }
    var perSec = secSize / 4, fat = new Uint32Array(fatSecs.length * perSec);
    fatSecs.forEach(function (fs, k) { var off = secOff(fs); for (var j = 0; j < perSec; j++) fat[k * perSec + j] = off + j * 4 + 4 <= u.length ? u32(u, off + j * 4) : FREESECT; });
    function chain(start, table) { var out = [], s = start, g = 0; while (s !== ENDOFCHAIN && s !== FREESECT && s < table.length && g++ < 5000000) { out.push(s); s = table[s]; } return out; }
    function readChain(start, size) {
      var secs = chain(start, fat), buf = new Uint8Array(secs.length * secSize), p = 0;
      secs.forEach(function (s) { var off = secOff(s); buf.set(u.subarray(off, Math.min(off + secSize, u.length)), p); p += secSize; });
      return size != null ? buf.subarray(0, Math.min(size, buf.length)) : buf;
    }
    var dir = readChain(dirStart), entries = [];
    for (var o = 0; o + 128 <= dir.length; o += 128) {
      var nl = u16(dir, o + 64), name = '';
      for (var c = 0; c < Math.max(0, nl / 2 - 1); c++) name += String.fromCharCode(u16(dir, o + c * 2));
      entries.push({ name: name, type: dir[o + 66], start: u32(dir, o + 116), size: u32(dir, o + 120) });
    }
    var rootE = entries[0], miniStream = null, miniFat = null;
    function getMini() {
      if (miniStream) return;
      miniStream = readChain(rootE.start, rootE.size);
      var mf = readChain(miniFatStart), n = Math.min(mf.length / 4, nMiniFat * perSec);
      miniFat = new Uint32Array(n); for (var k = 0; k < n; k++) miniFat[k] = u32(mf, k * 4);
    }
    function stream(name) {
      var e = entries.filter(function (x) { return x.type === 2 && x.name.toLowerCase() === name.toLowerCase(); })[0];
      if (!e) return null;
      if (e.size < miniCutoff) {
        getMini();
        var secs = chain(e.start, miniFat), buf = new Uint8Array(secs.length * miniSize), p = 0;
        secs.forEach(function (s) { buf.set(miniStream.subarray(s * miniSize, s * miniSize + miniSize), p); p += miniSize; });
        return buf.subarray(0, e.size);
      }
      return readChain(e.start, e.size);
    }
    return { entries: entries, stream: stream };
  }

  /* ---------- Chuỗi BIFF8 (XLUnicodeRichExtendedString) qua nhiều CONTINUE ---------- */
  function Reader(chunks) { this.chunks = chunks; this.ci = 0; this.p = 0; }
  Reader.prototype.cur = function () { return this.chunks[this.ci]; };
  Reader.prototype.left = function () { return this.cur() ? this.cur().length - this.p : 0; };
  Reader.prototype.next = function () { this.ci++; this.p = 0; };
  Reader.prototype.ensure = function () { while (this.cur() && this.left() <= 0) this.next(); };
  Reader.prototype.byte = function () { this.ensure(); var b = this.cur()[this.p]; this.p++; return b; };
  Reader.prototype.u16 = function () { return this.byte() | (this.byte() << 8); };
  Reader.prototype.u32 = function () { return this.u16() + this.u16() * 65536; };
  Reader.prototype.skip = function (n) { while (n > 0 && this.cur()) { var l = this.left(); if (l <= 0) { this.next(); continue; } var k = Math.min(l, n); this.p += k; n -= k; } };
  Reader.prototype.str = function () {
    var cch = this.u16(), flags = this.byte(), hi = flags & 1, rich = flags & 8, ext = flags & 4, runs = 0, extLen = 0;
    if (rich) runs = this.u16(); if (ext) extLen = this.u32();
    var out = '', got = 0;
    while (got < cch) {
      if (this.left() <= 0) { this.next(); if (!this.cur()) break; hi = this.cur()[0] & 1; this.p = 1; }
      var c = this.cur(), avail = hi ? Math.floor(this.left() / 2) : this.left(), take = Math.min(avail, cch - got);
      if (take <= 0) { this.next(); if (!this.cur()) break; hi = this.cur()[0] & 1; this.p = 1; continue; }
      if (hi) { for (var i = 0; i < take; i++) out += String.fromCharCode(c[this.p + i * 2] | (c[this.p + i * 2 + 1] << 8)); this.p += take * 2; }
      else { for (var j = 0; j < take; j++) out += String.fromCharCode(c[this.p + j]); this.p += take; }
      got += take;
    }
    this.skip(runs * 4 + extLen);
    return out;
  };
  function shortStr(b, o, lenBytes) { // XLUnicodeString (LABEL / BOUNDSHEET / STRING)
    var cch = lenBytes === 1 ? b[o] : u16(b, o), p = o + lenBytes, hi = b[p] & 1, s = ''; p++;
    for (var i = 0; i < cch; i++) { if (hi) { s += String.fromCharCode(u16(b, p)); p += 2; } else { s += String.fromCharCode(b[p]); p++; } }
    return s;
  }
  function rk(v) {
    var x100 = v & 1, isInt = v & 2, val;
    if (isInt) val = v >> 2;
    else { var buf = new ArrayBuffer(8), dv = new DataView(buf); dv.setUint32(4, (v & 0xFFFFFFFC) >>> 0, true); dv.setUint32(0, 0, true); val = dv.getFloat64(0, true); }
    return x100 ? val / 100 : val;
  }

  /* ---------- Workbook BIFF8 ---------- */
  function readWorkbook(wb) {
    var recs = [], o = 0;
    while (o + 4 <= wb.length) { var t = u16(wb, o), l = u16(wb, o + 2); recs.push({ t: t, o: o + 4, l: l, d: wb.subarray(o + 4, o + 4 + l) }); o += 4 + l; }
    var sheets = [], sst = [], i, biff = 8;
    // Globals
    for (i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.t === 0x0809 && i === 0) { var ver = u16(r.d, 0); if (ver !== 0x0600) biff = ver === 0x0500 ? 5 : 0; }
      if (r.t === 0x002F) { var er = new Error('File .xls được bảo vệ/mã hoá bằng mật khẩu — mở bằng Excel, bỏ mật khẩu rồi lưu lại (hoặc lưu thành .xlsx).'); er.code = 'encrypted'; throw er; }
      if (r.t === 0x0085) sheets.push({ pos: u32(r.d, 0), vis: r.d[4], type: r.d[5], name: biff === 8 ? shortStr(r.d, 6, 1) : String.fromCharCode.apply(null, r.d.subarray(7, 7 + r.d[6])) });
      if (r.t === 0x00FC) {
        var chunks = [r.d.subarray(8)], k = i + 1;
        while (k < recs.length && recs[k].t === 0x003C) { chunks.push(recs[k].d); k++; }
        var total = u32(r.d, 4), rd = new Reader(chunks);
        for (var s = 0; s < total; s++) { rd.ensure(); if (!rd.cur()) break; sst.push(rd.str()); }
      }
      if (r.t === 0x000A) break;
    }
    if (biff !== 8) { var e5 = new Error('Định dạng Excel quá cũ (BIFF' + (biff || '?') + ') — hãy lưu lại thành .xlsx'); e5.code = 'oldbiff'; throw e5; }
    var byOff = {}; recs.forEach(function (r, idx) { byOff[r.o - 4] = idx; });
    return sheets.filter(function (sh) { return sh.type === 0; }).map(function (sh) {
      var rows = [], idx = byOff[sh.pos];
      function put(r, c, v) { (rows[r] = rows[r] || [])[c] = v; }
      if (idx == null) return { name: sh.name, rows: rows, hidden: !!sh.vis };
      var pendingStr = null;
      for (var j = idx + 1; j < recs.length; j++) {
        var x = recs[j], d = x.d;
        if (x.t === 0x000A) break;
        switch (x.t) {
          case 0x00FD: put(u16(d, 0), u16(d, 2), sst[u32(d, 6)] != null ? sst[u32(d, 6)] : ''); break; // LABELSST
          case 0x0204: case 0x00D6: put(u16(d, 0), u16(d, 2), shortStr(d, 6, 2)); break; // LABEL / RSTRING
          case 0x0203: put(u16(d, 0), u16(d, 2), f64(d, 6)); break; // NUMBER
          case 0x027E: put(u16(d, 0), u16(d, 2), rk(i32(d, 6))); break; // RK
          case 0x00BD: { var rr = u16(d, 0), c1 = u16(d, 2), n = (d.length - 6) / 6; for (var q = 0; q < n; q++) put(rr, c1 + q, rk(i32(d, 4 + q * 6 + 2))); break; } // MULRK
          case 0x0205: { var bv = d[6], isErr = d[7]; put(u16(d, 0), u16(d, 2), isErr ? null : !!bv); break; } // BOOLERR
          case 0x0006: { // FORMULA
            var fr = u16(d, 0), fc = u16(d, 2);
            if (d[12] === 0xFF && d[13] === 0xFF) {
              var ty = d[6];
              if (ty === 0) pendingStr = { r: fr, c: fc };
              else if (ty === 1) put(fr, fc, !!d[8]);
              else if (ty === 3) put(fr, fc, '');
              else put(fr, fc, null);
            } else put(fr, fc, f64(d, 6));
            break;
          }
          case 0x0207: if (pendingStr) { put(pendingStr.r, pendingStr.c, shortStr(d, 0, 2)); pendingStr = null; } break; // STRING
          default: break;
        }
      }
      for (var k2 = 0; k2 < rows.length; k2++) rows[k2] = rows[k2] || [];
      return { name: sh.name, rows: rows, hidden: !!sh.vis };
    });
  }
  function read(data) {
    var u = toU8(data), cfb = readCfb(u);
    var wb = cfb.stream('Workbook') || cfb.stream('Book');
    if (!wb) throw new Error('File .xls không có luồng Workbook (có thể không phải bảng tính Excel)');
    return readWorkbook(wb);
  }
  return { read: read, isXls: isXls, readCfb: readCfb };
})()

export default XlsDoc
