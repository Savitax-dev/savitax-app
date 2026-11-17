/* ===== XLSX tự viết: ghi file .xlsx có định dạng & đọc danh bạ (không cần thư viện ngoài) ===== */
const XL = (() => {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const colName = (c) => { let s = ""; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const ref = (r, c) => colName(c) + (r + 1);
  // sheets: [{ name, rows: [[cell]], merges: [{s:{r,c},e:{r,c}}], cols: [wch], heights: [pt|undefined] }]
  // cell: { v, b, i, sz, al, va, wrap, border, num, fill, color }
  function build(sheets, title) {
    const fonts = ['<font><sz val="12"/><name val="Times New Roman"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const fk = new Map(), flk = new Map(), bk = new Map(), xk = new Map();
    const idx = (map, arr, key, xml) => { if (!map.has(key)) { map.set(key, arr.length); arr.push(xml); } return map.get(key); };
    function style(c) {
      const sz = c.sz || 12;
      const f = idx(fk, fonts, [c.b, c.i, sz, c.color].join("|"), `<font>${c.b ? "<b/>" : ""}${c.i ? "<i/>" : ""}<sz val="${sz}"/>${c.color ? `<color rgb="FF${c.color}"/>` : ""}<name val="Times New Roman"/></font>`);
      const fl = c.fill ? idx(flk, fills, c.fill, `<fill><patternFill patternType="solid"><fgColor rgb="FF${c.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      const bd = c.border ? idx(bk, borders, c.border, c.border === "hair" ? '<border><left/><right/><top/><bottom style="hair"><color rgb="FFBBBBBB"/></bottom><diagonal/></border>' : '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>') : 0;
      const al = { left: "left", center: "center", right: "right", justify: "justify" }[c.al] || "general";
      const nf = c.num ? 3 : 0;
      const key = [f, fl, bd, al, c.va || "center", c.wrap !== false, nf].join("|");
      return idx(xk, xfs, key, `<xf numFmtId="${nf}" fontId="${f}" fillId="${fl}" borderId="${bd}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"${nf ? ' applyNumberFormat="1"' : ""}${fl ? ' applyFill="1"' : ""}><alignment horizontal="${al}" vertical="${c.va || "center"}"${c.wrap !== false ? ' wrapText="1"' : ""}/></xf>`);
    }
    const sst = [], sstMap = new Map();
    const si = (s) => { if (!sstMap.has(s)) { sstMap.set(s, sst.length); sst.push(s); } return sstMap.get(s); };
    const sheetXml = sheets.map((sh) => {
      const ncol = Math.max(1, ...sh.rows.map((r) => r.length), sh.cols?.length || 0);
      let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(Math.max(0, sh.rows.length - 1), ncol - 1)}"/><sheetViews><sheetView workbookViewId="0"${sh.freeze ? "" : ""}/></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>`;
      if (sh.cols?.length) x += "<cols>" + sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>";
      x += "<sheetData>";
      sh.rows.forEach((row, r) => {
        const h = sh.heights?.[r];
        x += `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ""}>`;
        row.forEach((c, ci) => {
          if (!c) return; const s = style(c);
          if (typeof c.v === "number" && isFinite(c.v)) x += `<c r="${ref(r, ci)}" s="${s}"><v>${c.v}</v></c>`;
          else if (c.v === "" || c.v == null) x += `<c r="${ref(r, ci)}" s="${s}"/>`;
          else x += `<c r="${ref(r, ci)}" s="${s}" t="s"><v>${si(String(c.v))}</v></c>`;
        });
        x += "</row>";
      });
      x += "</sheetData>";
      if (sh.merges?.length) x += `<mergeCells count="${sh.merges.length}">` + sh.merges.map((m) => `<mergeCell ref="${ref(m.s.r, m.s.c)}:${ref(m.e.r, m.e.c)}"/>`).join("") + "</mergeCells>";
      x += `<pageMargins left="0.7" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
      return x;
    });
    const names = []; const used = new Set();
    for (const sh of sheets) { let n = String(sh.name || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Sheet", k = 2; while (used.has(n.toLowerCase())) { n = n.slice(0, 27) + " (" + k++ + ")"; } used.add(n.toLowerCase()); names.push(n); }
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
      ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title || "")}</dc:title><dc:creator>Savitax Hồ Sơ – Hồ sơ chứng từ</dc:creator></cp:coreProperties>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`],
      ...sheetXml.map((x, i) => [`xl/worksheets/sheet${i + 1}.xml`, x]),
    ];
    files.push(["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
    files.push(["xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`]);
    return { files, names };
  }
  // Excel 2003 XML (mở được bằng Excel với đuôi .xls)
  function xml2003(sheets, names) {
    const cell = (c, ci) => { if (!c) return ""; const t = typeof c.v === "number" ? "Number" : "String"; return `<Cell ss:Index="${ci + 1}" ss:StyleID="${c.b ? "b" : "n"}${c.border ? "x" : ""}"><Data ss:Type="${t}">${esc(c.v)}</Data></Cell>`; };
    return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>${["n", "b", "nx", "bx"].map((id) => `<Style ss:ID="${id}"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Times New Roman" ss:Size="12"${id.startsWith("b") ? ' ss:Bold="1"' : ""}/>${id.endsWith("x") ? '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>' : ""}</Style>`).join("")}</Styles>${sheets.map((sh, i) => `<Worksheet ss:Name="${esc(names[i])}"><Table>${(sh.cols || []).map((w) => `<Column ss:Width="${Math.round(w * 6.5)}"/>`).join("")}${sh.rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("")}</Table></Worksheet>`).join("")}</Workbook>`;
  }
  // Đọc .xlsx → [[[chuỗi]]] (mỗi sheet một mảng dòng)
  async function read(buf) {
    const z = await JSZip.loadAsync(buf);
    const P = (s) => new DOMParser().parseFromString(s, "application/xml");
    const ss = z.file("xl/sharedStrings.xml") ? [...P(await z.file("xl/sharedStrings.xml").async("string")).getElementsByTagName("si")].map((n) => [...n.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
    const out = [];
    const files = Object.keys(z.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    for (const f of files) {
      const d = P(await z.file(f).async("string")); const rows = [];
      for (const r of d.getElementsByTagName("row")) {
        const row = [];
        for (const c of r.getElementsByTagName("c")) {
          const rf = c.getAttribute("r") || ""; const col = rf.replace(/\d+/g, "").split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const t = c.getAttribute("t"); const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
          row[col < 0 ? row.length : col] = t === "s" ? ss[+v] ?? "" : t === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent).join("") : v;
        }
        rows[(+r.getAttribute("r") || rows.length + 1) - 1] = [...row].map((x) => x ?? "");
      }
      out.push(rows.map((r) => r || []));
    }
    return out;
  }
  function csv(text) { const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ","; return [text.replace(/\r/g, "").split("\n").map((l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; })]; }
  return { build, xml2003, read, csv };
})();
