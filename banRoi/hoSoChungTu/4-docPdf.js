/* Đọc hóa đơn PDF có lớp chữ – kế thừa từ app Bộ hồ sơ hóa đơn */
  function parsePdfInvoice(pages) {
    const NUM = /^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?$/;
    const isNum = (s) => NUM.test(String(s).replace(/\s/g, ""));
    const low = (s) => s.toLowerCase();
    // 1) Gom chữ thành dòng
    const lines = [];
    pages.forEach((items, pi) => {
      const its = [];
      for (const i of items.filter((i) => i.s && i.s.trim())) {
        const s = i.s.replace(/\s+/g, " "), toks = s.trim().split(" ");
        // pdf.js đôi khi gộp nhiều ô số thành một mẩu chữ ("2 18,500,000"): tách ra theo tỷ lệ độ dài
        if (toks.length > 1 && toks.every((t) => /^-?[\d.,]+%?$/.test(t))) {
          const cw = i.w / Math.max(1, s.length); let off = s.indexOf(toks[0]);
          for (const t of toks) { const at = s.indexOf(t, off); its.push({ ...i, s: t, x: i.x + at * cw, w: t.length * cw }); off = at + t.length; }
        } else its.push({ ...i, s });
      }
      its.sort((a, b) => a.y - b.y || a.x - b.x);
      const pl = [];
      for (const it of its) {
        const tol = Math.max(2, (it.h || 8) * 0.45);
        let L = pl.find((l) => Math.abs(l.y - it.y) <= tol);
        if (!L) { L = { page: pi, y: it.y, h: it.h || 8, items: [] }; pl.push(L); }
        L.items.push(it);
      }
      for (const L of pl) {
        L.items.sort((a, b) => a.x - b.x);
        let t = "";
        L.items.forEach((it, k) => { const prev = L.items[k - 1]; t += (prev && it.x - (prev.x + prev.w) > 1 ? " " : prev && !/\s$/.test(t) && !/^\s/.test(it.s) && it.x - (prev.x + prev.w) > 0.3 ? " " : "") + it.s; });
        L.text = t.replace(/\s+/g, " ").trim();
      }
      pl.sort((a, b) => a.y - b.y);
      lines.push(...pl);
    });
    const allText = lines.map((l) => l.text).join("\n");
    // Kiểu số của hóa đơn: 1,250,000 (phẩy ngăn nghìn) hay 1.250.000 (chấm ngăn nghìn)
    const commaK = (allText.match(/\d,\d{3},\d{3}\b/g) || []).length > (allText.match(/\d\.\d{3}\.\d{3}\b/g) || []).length;
    const pnum = (v) => { let t = String(v ?? "").replace(/[\s%]/g, ""); if (!t) return NaN; t = commaK ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", "."); return Number(t); };
    if (allText.replace(/\s/g, "").length < 40) throw new Error("scan");

    // 2) Tách "nhãn: giá trị" trong một dòng (giá trị kéo đến nhãn kế tiếp)
    const OPT = "\\s*(?:\\([^)]*\\))?\\s*:";
    const LABS = [
      ["ban", "đơn vị bán hàng|tên đơn vị bán(?: hàng)?|tên người bán|người bán hàng|đơn vị bán"],
      ["muaHoTen", "họ tên người mua hàng|họ và tên người mua(?: hàng)?|người mua hàng|tên người mua"],
      ["muaDv", "tên đơn vị mua(?: hàng)?|đơn vị mua hàng|tên đơn vị|tên công ty|đơn vị"],
      ["mst", "mã số thuế|mst"], ["dc", "địa chỉ"], ["dt", "điện thoại|số điện thoại|đt|tel"], ["fax", "fax"], ["web", "website"], ["email", "email|e-mail"],
      ["stk", "số tài khoản|tài khoản|stk"], ["nh", "tại ngân hàng|ngân hàng"], ["httt", "hình thức thanh toán"], ["tiente", "đơn vị tiền tệ"], ["ghichu", "ghi chú"],
      ["cccd", "số cccd|cccd|căn cước công dân|số định danh|mã đơn vị quan hệ ngân sách|mã qhns|số hộ chiếu"],
    ];
    const LRE = new RegExp("(?:^|[\\s,;|])(" + LABS.map((l) => "(?:" + l[1] + ")").join("|") + ")" + OPT, "giu");
    function fields(text) {
      const out = {}, ms = [...text.matchAll(LRE)];
      ms.forEach((m, k) => {
        const lab = low(m[1]), key = LABS.find((l) => new RegExp("^(?:" + l[1] + ")$", "iu").test(lab))?.[0];
        const start = m.index + m[0].length, end = k + 1 < ms.length ? ms[k + 1].index : text.length;
        const v = text.slice(start, end).trim().replace(/^[:\s]+/, "");
        if (key && !(key in out)) out[key] = v;
      });
      return out;
    }

    // 3) Thông tin chung
    const inv = { ky_hieu: "", so: "", ngay: "" };
    let mau = "";
    for (const l of lines) {
      const t = l.text;
      if (!inv.ky_hieu) { const m = t.match(/ký hiệu[^:]*:\s*([0-9]?[A-Z]\d{2}[A-Z0-9]{1,6})/iu); if (m) inv.ky_hieu = m[1].toUpperCase(); }
      if (!mau) { const m = t.match(/mẫu số[^:]*:\s*(\d)\b/iu); if (m) mau = m[1]; }
      if (!inv.so) { const m = t.match(/(?:^|\s)(?<!mẫu\s)số(?: hóa đơn)?\s*(?:\((?:no|invoice no)[^)]*\))?\s*:\s*0*(\d{1,8})\b/iu); if (m && !/số tài khoản|số lượng|số tiền/iu.test(t.slice(0, m.index + 12))) inv.so = m[1]; }
      if (!inv.ngay) {
        const m = t.match(/ngày\s*(?:\([^)]*\))?\s*(\d{1,2})\s*tháng\s*(?:\([^)]*\))?\s*(\d{1,2})\s*năm\s*(?:\([^)]*\))?\s*(\d{4})/iu)
          || t.match(/ngày (?:lập|hóa đơn)[^:]*:\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/iu);
        if (m) inv.ngay = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
    }
    if (inv.ky_hieu && /^[A-Z]/.test(inv.ky_hieu) && mau) inv.ky_hieu = mau + inv.ky_hieu;

    // 4) Bảng hàng: tìm dòng tiêu đề
    // Tiêu đề bảng có thể xuống dòng trong ô: gom các dòng sát nhau thành một "dải tiêu đề"
    const HK = /stt|tên hàng|tên sản phẩm|hàng hóa, dịch vụ|diễn giải|số lượng|đơn giá|thành tiền|đơn vị tính|đvt/iu;
    const dataLike = (l) => l.items.some((it) => /^\d{1,3}(?:[.,]\d{3})+/.test(it.s.trim())) || (/^\d{1,3}$/.test(l.items[0]?.s.trim() || "") && l.items.length > 2 && /[A-Za-zÀ-ỹ]{3}/.test(l.text));
    function headerBand(i) {
      const L = lines[i]; if (!L || !HK.test(L.text) || dataLike(L)) return -1;
      let j = i, txt = L.text;
      while (j + 1 < lines.length && lines[j + 1].page === L.page && lines[j + 1].y <= L.y + L.h * 3.2 && !dataLike(lines[j + 1]) && (lines[j + 1].items.length >= 2 || HK.test(lines[j + 1].text))) { j++; txt += " " + lines[j].text; }
      const cells = headerCells(i, j).map((c) => c.t).join(" | ");
      return /tên hàng|tên sản phẩm|hàng hóa, dịch vụ|diễn giải/iu.test(cells) && /số lượng|(^|\| )sl\b/iu.test(cells) && /thành tiền/iu.test(cells) ? j : -1;
    }
    function headerCells(i, j) { // gộp các mẩu chữ chồng nhau theo chiều ngang thành ô tiêu đề
      const cells = [];
      for (const it of lines.slice(i, j + 1).flatMap((l) => l.items).sort((a, b) => a.y - b.y || a.x - b.x)) {
        const c = cells.find((c) => it.x < c.r - 1 && it.x + it.w > c.l + 1);
        if (c) { c.t += " " + it.s.trim(); c.l = Math.min(c.l, it.x); c.r = Math.max(c.r, it.x + it.w); }
        else cells.push({ t: it.s.trim(), l: it.x, r: it.x + it.w });
      }
      return cells.map((c) => ({ ...c, t: c.t.replace(/\s+/g, " "), cx: (c.l + c.r) / 2 })).sort((a, b) => a.l - b.l);
    }
    const isHeader = (l) => headerBand(lines.indexOf(l)) >= 0;
    const hIdx = lines.findIndex((l, i) => headerBand(i) >= 0);
    const seller = { mst: "", ten: "", dc: "", dt: "", stk: "", nh: "" }, buyer = { mst: "", ten: "", dc: "", dt: "", stk: "", nh: "" };
    // 5) Bên bán / bên mua (phần trước bảng hàng của trang đầu)
    let cur = null, muaHoTen = "";
    for (const l of lines.slice(0, hIdx < 0 ? lines.length : hIdx)) {
      if (l.page > 0) break;
      const f = fields(l.text);
      if ("ban" in f) { cur = seller; if (!seller.ten) seller.ten = f.ban; }
      if ("muaHoTen" in f) { cur = buyer; muaHoTen = muaHoTen || f.muaHoTen; }
      if ("muaDv" in f) { if (cur === seller && seller.ten && seller.mst) cur = buyer; if (cur === buyer || !cur) { cur = buyer; if (!buyer.ten) buyer.ten = f.muaDv; } }
      if (!cur) continue;
      if (f.mst && !cur.mst) cur.mst = f.mst.replace(/[^\d-]/g, "").replace(/-+$/, "");
      if (f.dc && !cur.dc) cur.dc = f.dc;
      if (f.dt && !cur.dt) cur.dt = f.dt.replace(/[^\d+ .()-]/g, "").trim();
      if (f.stk && !cur.stk) { const m = f.stk.match(/^([\d .-]{5,})(?:\s*(?:-|tại)\s*(.+))?$/iu); cur.stk = (m ? m[1] : f.stk).replace(/[^\d]/g, "") || ""; if (m && m[2] && !cur.nh) cur.nh = m[2].trim(); }
      if (f.nh && !cur.nh) cur.nh = f.nh;
    }
    if (!buyer.ten && muaHoTen) buyer.ten = muaHoTen;

    // 6) Đọc các dòng hàng
    const items = [];
    if (hIdx >= 0) {
      const H = lines[hIdx];
      const COLS = [["stt", /^(stt|tt|số tt|số thứ tự)\b/iu], ["ten", /tên hàng|tên sản phẩm|hàng hóa, dịch vụ|diễn giải/iu], ["dvt", /^(đơn vị tính|đvt|đơn vị)\b/iu],
        ["sl", /^(số lượng|sl)\b/iu], ["dg", /^đơn giá/iu], ["ttsau", /^(thành tiền (có|sau|đã có)|tổng cộng|cộng tiền thanh toán)/iu], ["tt", /^thành tiền/iu], ["ts", /^(thuế suất|ts\b|% thuế)/iu], ["tthue", /^tiền thuế/iu]];
      const col = {};
      const hEnd = headerBand(hIdx);
      for (const c of headerCells(hIdx, hEnd)) for (const [k, re] of COLS) if (!col[k] && re.test(c.t)) { col[k] = c; break; }
      const numCols = ["sl", "dg", "tt", "ts", "tthue", "ttsau"].filter((k) => col[k]);
      const nameEnd = col.dvt ? (((col.ten?.r ?? col.dvt.l - 40) + col.dvt.l) / 2) : numCols.length ? Math.min(...numCols.map((k) => col[k].l)) - 5 : Infinity;
      const sttEnd = col.ten ? Math.min(col.ten.l, (col.stt ? col.stt.r + 25 : col.ten.l)) : 40;
      const STOP = /cộng tiền hàng|tổng tiền hàng|cộng tiền|tổng cộng|tổng tiền|thuế suất|tiền thuế gtgt|số tiền viết bằng chữ|^cộng\b/iu;
      const FOOT = /trang \d|page \d|tra cứu|đơn vị cung cấp|mã của cơ quan thuế|mã số bí mật|mã tra cứu|ký bởi|signature valid|người mua hàng|người bán hàng/iu;
      const rows = []; // {page, y, cells}
      let inT = true, page = H.page;
      for (let i = hEnd + 1; i < lines.length; i++) {
        const L = lines[i];
        const hb = headerBand(i);
        if (hb >= 0) { inT = true; page = L.page; i = hb; continue; }
        if (!inT) continue;
        if (STOP.test(L.text)) { inT = false; continue; }
        if (FOOT.test(L.text)) continue;
        if (L.page !== page && !rows.some((r) => r.page === L.page)) {
          // sang trang mới khi chưa thấy tiêu đề: chỉ nhận dòng có số thứ tự
          if (!(L.items[0] && /^\d{1,3}$/.test(L.items[0].s.trim()) && L.items.some((it) => isNum(it.s) && it.x > nameEnd))) continue;
        }
        // dòng chú giải cột: a | b | c | (1) | (2) | (3) = (1) x (2)  hoặc  A B C 1 2 3=1x2
        if (L.items.length >= 3 && L.items.every((it) => /^\(?[0-9a-hA-H]{1,2}\)?(\s*=\s*\(?[0-9a-hA-H]{1,2}\)?\s*[x×*]\s*\(?[0-9a-hA-H]{1,2}\)?)?$/.test(it.s.trim())) && L.items.some((it) => /=|^\(?[a-hA-H]\)?$/.test(it.s.trim()))) continue;
        if (L.items.some((it) => /^\(?[a-hA-H]\)?$/.test(it.s.trim())) && L.items.every((it) => it.s.trim().length <= 16 && /^(\(?[a-hA-H0-9]{1,2}\)?|[()0-9a-hA-H\s=x×*+.-]+)$/.test(it.s.trim()))) continue;
        const c = { ten: [], dvt: "", stt: "" }, nums = {};
        for (const it of L.items) {
          const s = it.s.trim(), cx = it.x + it.w / 2;
          if (/^\d{1,3}$/.test(s) && cx < sttEnd && !c.stt && !c.ten.length) { c.stt = s; continue; }
          if (isNum(s.replace(/%$/, "")) && it.x > nameEnd - 2 && numCols.length) {
            const k = numCols.reduce((a, b) => Math.abs(col[a].cx - cx) <= Math.abs(col[b].cx - cx) ? a : b);
            if (!(k in nums)) nums[k] = s; continue;
          }
          if (/^(kct|kkknt|không chịu thuế)$/iu.test(s) && col.ts && Math.abs(col.ts.cx - cx) < 40) { nums.ts = s; continue; }
          if (it.x < nameEnd) c.ten.push(s); else if (!c.dvt) c.dvt = s; else c.dvt += " " + s;
        }
        const t = c.ten.join(" ").trim();
        if (!c.stt && !Object.keys(nums).length && (!t || /^(\([^)]*\)\s*)+$|^[a-e]$|^\(?\d\)?\s*=|^b$/iu.test(t))) continue; // dòng chú thích cột (a, b, (1)...)
        rows.push({ page: L.page, y: L.y, h: L.h, ...c, ten: t, nums, anchor: "tt" in nums || ("sl" in nums && "dg" in nums) });
      }
      const anchors = rows.filter((r) => r.anchor);
      for (const a of anchors) a.parts = [{ y: a.y, t: a.ten }];
      for (const r of rows.filter((x) => !x.anchor && (x.ten || x.stt))) {
        const cand = anchors.filter((a) => a.page === r.page);
        if (!cand.length) continue;
        const a = cand.reduce((p, q) => Math.abs(q.y - r.y) < Math.abs(p.y - r.y) ? q : p);
        if (Math.abs(a.y - r.y) <= r.h * 3.2) { a.parts.push({ y: r.y, t: r.ten }); if (!a.dvt && r.dvt) a.dvt = r.dvt; if (!a.stt && r.stt) a.stt = r.stt; }
      }
      for (const a of anchors) {
        const n = (k) => { const v = pnum(a.nums[k]); return isNaN(v) ? 0 : v; };
        const ten = a.parts.sort((p, q) => p.y - q.y).map((p) => p.t).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        const tsRaw = a.nums.ts || "";
        items.push({ ten, dvt: a.dvt, sl: n("sl"), don_gia: n("dg"), thanh_tien: n("tt") || Math.round(n("sl") * n("dg")), thue_suat: /^\d/.test(tsRaw) ? parseFloat(tsRaw.replace(",", ".")) : (tsRaw ? 0 : "") });
      }
    }

    // 7) Tổng tiền, thuế suất chung
    const firstNum = (s) => { const m = s.match(/-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/); return m ? pnum(m[0]) : NaN; };
    const after = (t, re) => { const m = t.match(re); return m ? firstNum(t.slice(m.index + m[0].length)) : NaN; };
    let tienHang = NaN, thue = NaN, tong = NaN, rate = "";
    for (const l of lines) {
      const t = l.text;
      if (isNaN(tienHang)) tienHang = after(t, /cộng tiền hàng(?: hóa, dịch vụ)?[^:]*:|tổng tiền hàng[^:]*:|tổng tiền chưa (?:có )?thuế[^:]*:|cộng tiền trước thuế[^:]*:/iu);
      if (isNaN(thue)) thue = after(t, /tiền thuế gtgt[^:]*:|tổng tiền thuế[^:]*:|tiền thuế[^:]*:/iu);
      if (isNaN(tong)) tong = after(t, /tổng (?:cộng )?tiền thanh toán[^:]*:|tổng cộng thanh toán[^:]*:|tổng thanh toán[^:]*:|tổng tiền (?:đã có thuế|sau thuế)[^:]*:/iu);
      if (!rate) { const m = t.match(/thuế suất(?: gtgt)?[^:]*:\s*(\d{1,2}(?:[.,]\d)?)\s*%|thuế gtgt\s*\((?:vat rate|tax rate)\)\s*:\s*(\d{1,2}(?:[.,]\d)?)\s*%/iu); if (m) rate = parseFloat((m[1] || m[2]).replace(",", ".")); }
    }
    if (rate !== "") for (const it of items) if (it.thue_suat === "") it.thue_suat = rate;
    const z = (v) => isNaN(v) ? 0 : v;
    const notes = [];
    if (!items.length) notes.push("Không nhận ra bảng hàng trong PDF, cần nhập tay các dòng hàng.");
    if (!seller.mst || !buyer.mst) notes.push("Thiếu MST bên " + (!seller.mst ? "bán" : "mua") + ", kiểm tra lại.");
    if (items.some((it) => /chiết khấu|khuyến mại/iu.test(it.ten))) notes.push("Có dòng chiết khấu/khuyến mại, xem lại thành tiền.");
    return { seller, buyer, invoice: inv, ngay_giao: "", items, totals: { tien_hang: z(tienHang), thue: z(thue), tong: z(tong) }, ghi_chu: notes.join(" ") };
  }
  async function pdfPages(file) {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
      const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      pages.push(tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: vp.height - i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 8 })));
    }
    return pages;
  }
