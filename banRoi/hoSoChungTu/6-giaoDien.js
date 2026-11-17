/* ===== APP – giao diện ===== */
(() => {
  const C = CORE;
  const $ = (id) => document.getElementById(id);
  const esc = C.esc;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const LOCAL = true; // Savitax bản rời: luôn chạy thẳng trên máy
  // Cầu nối với khung bản rời (banRoi/khung/HoSoChungTu.jsx): kho IndexedDB, đơn vị dùng app, khung chứa giao diện
  const NOI = window.__hsct;
  const GOC = () => $("hsctGoc") || document.body;   // hộp thoại / màn chờ gắn vào khung để ăn CSS đã bọc (.hsct)

  /* ---------- Lưu trữ: IndexedDB của bản rời (trước đây localStorage, giới hạn ~5 MB) ---------- */
  let DB = { companies: [], records: [], templates: null, sets: null, loaiHinh: null, settings: { clientMst: "", lui: {}, holidays: null, theme: "" }, memo: {}, seeded: false };
  function load() { if (NOI.duLieu) DB = { ...DB, ...NOI.duLieu }; }
  let saveT = 0;
  function persist(now) {
    clearTimeout(saveT);
    const go = () => NOI.luu(DB).catch(() => toast("Không lưu được vào trình duyệt (bộ nhớ đầy hoặc bị chặn). Hãy sao lưu ra file JSON trong Cài đặt.", true));
    now ? go() : (saveT = setTimeout(go, 300));
  }
  const TPL = () => DB.templates || MAU_CHUNG_TU;
  const SETS = () => DB.sets || BO_HO_SO;
  const LH = () => DB.loaiHinh || LOAI_HINH_DN;
  const tplById = (id) => TPL().find((t) => t.id === id);
  const setById = (id) => SETS().find((s) => s.id === id);
  const ownTemplates = () => { if (!DB.templates) DB.templates = clone(MAU_CHUNG_TU); return DB.templates; };
  const ownSets = () => { if (!DB.sets) DB.sets = clone(BO_HO_SO); return DB.sets; };
  const ownLH = () => { if (!DB.loaiHinh) DB.loaiHinh = clone(LOAI_HINH_DN); return DB.loaiHinh; };
  const company = (mst) => DB.companies.find((c) => c.mst === String(mst || "").trim());
  const clients = () => DB.companies.filter((c) => c.khach);
  const curClient = () => company(DB.settings.clientMst);

  /* ---------- Thông báo, hộp thoại, tải file ---------- */
  function toast(t, err) { const d = document.createElement("div"); d.textContent = t; if (err) d.className = "err"; $("toast").appendChild(d); setTimeout(() => d.remove(), err ? 7000 : 3800); }
  function ask(title, text, okLabel = "Đồng ý", danger) {
    return new Promise((res) => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><div class="small">${esc(text)}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-a="0">Hủy</button><button class="btn ${danger ? "dang" : "pri"}" data-a="1">${esc(okLabel)}</button></div></div>`;
      m.onclick = (e) => { const a = e.target.dataset?.a; if (a != null || e.target === m) { m.remove(); res(a === "1"); } };
      GOC().appendChild(m); m.querySelector('[data-a="1"]').focus();
    });
  }
  function busy(t) { const b = document.createElement("div"); b.className = "busy"; b.innerHTML = `<div>${esc(t)}</div>`; GOC().appendChild(b); return () => b.remove(); }
  const dlCap = !LOCAL && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
  async function saveFile(name, data) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    if (!LOCAL) {
      const d = await dlCap;
      if (d) {
        try { await d.save({ filename: name, data: blob }); toast("Đã lưu " + name); return; }
        catch (e) { if (e?.code === "declined") { toast("Đã hủy lưu file."); return; } if (e?.code === "rejected_extension" || e?.code === "extension_not_enabled") { toast("Định dạng này không tải được ở đây. Hãy dùng Word, Excel .xlsx hoặc PDF.", true); return; } if (e?.code === "rate_limited") { toast("Đang có một hộp thoại lưu file mở, thử lại sau giây lát.", true); return; } }
      }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast("Đã tạo " + name);
  }
  const safeName = (s) => C.fold(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60);
  document.querySelectorAll("[data-only-local]").forEach((b) => { b.hidden = !LOCAL; });

  /* ---------- Trạng thái hồ sơ đang lập ---------- */
  const blankParty = () => ({ mst: "", ten: "", dc: "", dd: "", cv: "", stk: "", nh: "", dt: "", email: "" });
  function fresh() {
    const c = curClient();
    return { id: uid(), created: new Date().toISOString(), clientMst: DB.settings.clientMst || "", example: false, nguon: "tay",
      chieu: "ban", linhVuc: "hang_hoa", setId: "", ai: null,
      ban: c ? pick(c) : blankParty(), mua: blankParty(),
      inv: { mau: "1", kh: "", so: "", ngay: "", httt: "", loai: "goc", lienQuan: null }, items: [{ ten: "", dvt: "", sl: "", dg: "", tt: "", ts: "", tchat: "1" }], hdTotals: {},
      gn: {}, ct: {}, dc: {}, opt: { hanTT: 15, hinhThuc: "Chuyển khoản", diaDanh: "", lui: {}, ngayTay: {}, soTay: {}, vat: "" }, check: {}, printSel: {} };
  }
  const pick = (c) => ({ mst: c.mst || "", ten: c.ten || "", dc: c.dc || "", dd: c.dd || "", cv: c.cv || "", stk: c.stk || "", nh: c.nh || "", dt: c.dt || "", email: c.email || "" });
  let S = null, queue = [], qIdx = -1, curDoc = "all";

  /* ---------- Bộ hồ sơ & phân loại ---------- */
  function findSet(chieu, lv) {
    const L = SETS();
    return L.find((s) => s.chieu === chieu && (s.linhVuc || []).includes(lv)) || L.find((s) => s.chieu === "ca2" && (s.linhVuc || []).includes(lv)) || L.find((s) => s.chieu === chieu && (s.linhVuc || []).includes("hang_hoa")) || L[0];
  }
  function applySet(id) {
    S.setId = id; const set = setById(id); S.check = {}; S.printSel = {};
    if (!set) return;
    const lh = LH().find((l) => l.id === (company(S.clientMst)?.loaiHinh || curClient()?.loaiHinh));
    const pri = lh?.mauUuTien?.[S.linhVuc];
    set.items.forEach((it, i) => {
      if (it.mau && tplById(it.mau)) { S.check[i] = "app"; S.printSel[i] = pri ? pri.includes(it.mau) : !!it.bb; }
      else if (/hóa đơn/i.test(it.ten) && !/điều chỉnh|hoàn trả/i.test(it.ten) && S.inv.so) S.check[i] = "co";
      else S.check[i] = "thieu";
      if (S.opt.hopDongCo && C.CONTRACTS.includes(it.mau)) { S.printSel[i] = false; S.check[i] = "co"; }
    });
  }
  function setTemplateIds(sel = true) {
    const set = setById(S.setId); if (!set) return [];
    const ids = []; set.items.forEach((it, i) => { if (it.mau && tplById(it.mau) && (!sel || S.printSel[i]) && !ids.includes(it.mau)) ids.push(it.mau); });
    return ids;
  }
  function stats(R) {
    const set = setById(R.setId); if (!set) return { pct: 0, miss: [], bb: 0, done: 0, app: 0 };
    let bb = 0, done = 0, app = 0; const miss = [];
    set.items.forEach((it, i) => { const st = R.check?.[i] || "thieu"; if (st === "na") return; if (it.bb) { bb++; if (st === "co" || st === "app") done++; else miss.push(it.ten); } if (st === "app") app++; });
    return { pct: bb ? Math.round(100 * done / bb) : 100, miss, bb, done, app };
  }

  /* ---------- Đọc file hóa đơn ---------- */
  function fromPdf(J) {
    const map = (p) => ({ ...blankParty(), mst: String(p.mst || "").replace(/\s/g, ""), ten: p.ten || "", dc: p.dc || "", dt: p.dt || "", stk: p.stk || "", nh: p.nh || "" });
    const kh = J.invoice?.ky_hieu || "";
    return { ban: map(J.seller || {}), mua: map(J.buyer || {}), inv: { mau: kh.slice(0, 1), kh, so: String(J.invoice?.so || "").replace(/^0+(?=\d)/, ""), ngay: J.invoice?.ngay || "", httt: "", loai: "goc" },
      items: (J.items || []).map((it) => ({ ten: it.ten, dvt: it.dvt, sl: it.sl, dg: it.don_gia, tt: it.thanh_tien, ts: it.thue_suat === "" ? "" : String(it.thue_suat) + "%", tchat: /chiết khấu/i.test(it.ten) ? "3" : "1" })),
      hdTotals: { tienHang: J.totals?.tien_hang || NaN, thue: J.totals?.thue ?? NaN, tong: J.totals?.tong || NaN }, nguon: "pdf", note: J.ghi_chu };
  }
  async function readFile(f) {
    const n = f.name.toLowerCase();
    if (n.endsWith(".xml")) return [{ name: f.name, J: C.parseXML(await f.text()) }];
    if (n.endsWith(".pdf")) {
      if (!window.pdfjsLib) throw new Error("Chưa tải được bộ đọc PDF (cần mạng lần đầu).");
      return [{ name: f.name, J: fromPdf(parsePdfInvoice(await pdfPages(f))) }];
    }
    if (n.endsWith(".zip")) {
      const z = await JSZip.loadAsync(await f.arrayBuffer()); const out = [];
      for (const e of Object.values(z.files)) if (!e.dir && /\.xml$/i.test(e.name)) { try { out.push({ name: e.name.split("/").pop(), J: C.parseXML(await e.async("string")) }); } catch (er) { /* bỏ qua xml không phải hóa đơn */ } }
      if (!out.length) throw new Error("File ZIP không có hóa đơn XML.");
      return out;
    }
    throw new Error("Chỉ nhận file .xml, .pdf hoặc .zip.");
  }
  async function handleFiles(files) {
    const done = busy("Đang đọc hóa đơn…"); const got = [], errs = [];
    for (const f of files) {
      try { got.push(...await readFile(f)); }
      catch (e) { errs.push(f.name + ": " + (e.message === "notinvoice" ? "không phải hóa đơn điện tử chuẩn TCT" : e.message === "scan" ? "PDF là ảnh scan, không có lớp chữ – hãy dùng file XML" : e.message === "xml" ? "XML lỗi" : e.message)); }
    }
    done();
    if (!got.length) { msg(errs.join(" · ") || "Không đọc được file.", "err"); return; }
    queue = got.map((g) => ({ name: g.name, rec: buildRecord(g.J) }));
    qIdx = 0; S = queue[0].rec; curDoc = "all";
    msg(`Đã đọc ${got.length} hóa đơn${errs.length ? `, lỗi ${errs.length}: ` + errs.join(" · ") : "."} Kiểm tra lại từng hóa đơn rồi bấm “Lưu vào sổ”.`, errs.length ? "warn" : "ok");
    renderAll();
  }
  function msg(t, k) { const el = $("readMsg"); el.hidden = !t; el.textContent = t || ""; el.className = "msg" + (k ? " " + k : ""); }

  function buildRecord(J) {
    const R = fresh(); R.nguon = J.nguon || "xml";
    for (const side of ["ban", "mua"]) {
      const p = J[side] || {}; const d = company(p.mst) || {};
      R[side] = { ...blankParty(), ...Object.fromEntries(Object.entries(d).filter(([k]) => k in blankParty())), ...Object.fromEntries(Object.entries(p).filter(([k, v]) => v && k in blankParty())) };
      if (!R[side].dd && d.dd) R[side].dd = d.dd;
      if (side === "mua" && !R.mua.ten && p.nguoiMua) R.mua.ten = p.nguoiMua;
    }
    R.inv = { ...R.inv, ...J.inv };
    R.items = (J.items || []).map((it) => ({ ten: it.ten || "", dvt: it.dvt || "", sl: isNaN(it.sl) ? "" : it.sl, dg: isNaN(it.dg) ? "" : it.dg, tt: isNaN(it.tt) ? "" : it.tt, ts: it.ts || "", tchat: it.tchat || "1" }));
    if (!R.items.length) R.items = [{ ten: "", dvt: "", sl: "", dg: "", tt: "", ts: "", tchat: "1" }];
    R.hdTotals = J.hdTotals || {};
    const cl = curClient();
    R.ai = C.classify(J, { clientMst: DB.settings.clientMst, loaiHinh: cl?.loaiHinh });
    R.chieu = R.ai.chieu; R.linhVuc = R.ai.linhVuc;
    if (J.inv?.lienQuan) R.dc.noi_dung_sai = `Hóa đơn ký hiệu ${J.inv.lienQuan.kh} số ${J.inv.lienQuan.so} ngày ${C.dshort(J.inv.lienQuan.ngay)}`;
    const doiTac = R.chieu === "ban" ? R.mua.mst : R.ban.mst;
    const m = DB.memo[doiTac]; // ghi nhớ thông tin giao nhận theo đối tác
    if (m) { R.gn = { ...m.gn, ngay: "" }; Object.assign(R.opt, Object.fromEntries(Object.entries(m.opt || {}).filter(([, v]) => v))); }
    if (!R.opt.diaDanh) R.opt.diaDanh = guessPlace(R.chieu === "ban" ? R.ban.dc : R.mua.dc);
    if (!R.opt.hieuLuc && R.inv.ngay) R.opt.hieuLuc = (Number(R.inv.ngay.slice(0, 4)) + 1) + "-12-31";
    const items = R.items.filter((i) => i.ten);
    if (!R.opt.noiDung && items.length) R.opt.noiDung = summarize(items);
    const dup = DB.records.find((x) => x.ban.mst === R.ban.mst && String(x.inv.so) === String(R.inv.so) && (x.inv.kh || "") === (R.inv.kh || "") && R.inv.so);
    if (dup) { R.dupOf = dup.id; }
    S = R; applySet(findSet(R.chieu, R.linhVuc).id); detectContract(R);
    autoSaveParties(R);
    return R;
  }
  function guessPlace(dc) {
    const m = String(dc || "").match(/(?:Thành phố|TP\.?|Tỉnh)\s+([^,]+?)(?:,|\s*Việt Nam|$)/i);
    return m ? m[1].trim() : "";
  }
  function summarize(items) {
    const f = items.map((i) => C.fold(i.ten));
    const groups = [["son", "Sơn"], ["bot", "bột bả"], ["xi mang", "xi măng"], ["thep", "thép"], ["go", "gỗ"], ["giay", "giấy"], ["may", "máy móc thiết bị"], ["dich vu", "dịch vụ"]];
    const hit = groups.filter(([k]) => f.some((t) => t.startsWith(k) || t.includes(" " + k + " "))).map((g) => g[1]);
    if (hit.length) return (hit.join(", ") + " các loại").replace(/^./, (c) => c.toUpperCase());
    return items[0].ten + (items.length > 1 ? " và các hàng hóa khác" : "");
  }
  function detectContract(R) {
    R.contractHint = null;
    const prev = DB.records.filter((x) => x.id !== R.id && x.id !== R.dupOf && x.ban.mst && x.ban.mst === R.ban.mst && x.mua.mst === R.mua.mst && x.contract?.so && (!x.opt?.hieuLuc || !R.inv.ngay || x.opt.hieuLuc >= R.inv.ngay))
      .sort((a, b) => String(a.contract.ngay).localeCompare(String(b.contract.ngay)));
    if (prev.length) R.contractHint = { so: prev[0].contract.so, ngay: prev[0].contract.ngay, id: prev[0].contract.id, hd: prev[0].inv.so, hieuLuc: prev[0].opt?.hieuLuc };
  }
  function autoSaveParties(R) {
    let added = 0;
    for (const side of ["ban", "mua"]) {
      const p = R[side]; if (!p.mst || C.mstCheck(p.mst)) continue;
      const c = company(p.mst);
      if (!c) { DB.companies.push({ ...p, khach: false }); added++; }
      else for (const k of Object.keys(blankParty())) if (p[k] && !c[k]) c[k] = p[k];
    }
    if (added) persist();
  }

  /* ---------- Vẽ giao diện Lập hồ sơ ---------- */
  function renderAll() { renderQueue(); renderAI(); renderInv(); renderItems(); renderExtra(); refresh(); }
  function renderQueue() {
    $("queue").innerHTML = queue.length > 1 ? queue.map((q, i) => { const st = stats(q.rec); return `<button data-q="${i}" aria-current="${i === qIdx}"><span class="d${q.saved ? " ok" : ""}"></span>HĐ ${esc(q.rec.inv.so || "?")} · ${esc(C.LV[q.rec.linhVuc] || "")}</button>`; }).join("") : "";
    $("recLabel").textContent = S ? (DB.records.some((r) => r.id === S.id) ? "Đang sửa hồ sơ đã lưu" : S.example ? "Hồ sơ ví dụ" : "Hồ sơ mới – chưa lưu") : "";
  }
  $("queue").onclick = (e) => { const b = e.target.closest("[data-q]"); if (!b) return; qIdx = +b.dataset.q; S = queue[qIdx].rec; curDoc = "all"; renderAll(); };

  function renderAI() {
    const a = S.ai;
    const box = $("aiBox");
    if (!a) { box.innerHTML = `<div class="ai"><div class="small muted">Nhập tay: chọn chiều hóa đơn và lĩnh vực bên dưới, app sẽ chạy ra bộ hồ sơ tương ứng.</div></div>`; }
    else {
      const unsure = a.conf < 0.6 || a.chieuConf < 0.6;
      box.innerHTML = `<div class="ai${unsure ? " unsure" : ""}">
        ${unsure ? `<div class="q">Hóa đơn chưa thể hiện rõ nghiệp vụ – hãy chọn lại ${a.chieuConf < 0.6 ? "chiều hóa đơn và " : ""}lĩnh vực bên dưới</div>` : ""}
        <div class="row" style="justify-content:space-between"><span><b>${a.chieu === "ban" ? "Bán ra" : "Mua vào"} · ${esc(C.LV[a.linhVuc])}</b></span><span class="small muted">Độ tin cậy <span class="conf"><i style="width:${Math.round(a.conf * 100)}%"></i></span> ${Math.round(a.conf * 100)}%</span></div>
        <ul>${a.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`;
    }
    document.querySelectorAll("#chieuSeg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === S.chieu));
    const lvs = Object.keys(C.LV).filter((k) => S.chieu === "ban" ? !["tscd", "ccdc", "cong_tac", "dien_nuoc", "xang_dau", "nhap_khau"].includes(k) : !["xuat_khau", "khuyen_mai"].includes(k));
    $("lvChips").innerHTML = lvs.map((k) => `<button class="chip${a && a.alt?.includes(k) ? " sug" : ""}" data-lv="${k}" aria-pressed="${S.linhVuc === k}">${esc(C.LV[k])}</button>`).join("");
    const opts = SETS().filter((s) => s.chieu === S.chieu || s.chieu === "ca2");
    const others = SETS().filter((s) => !opts.includes(s));
    $("setSel").innerHTML = `<optgroup label="${S.chieu === "ban" ? "Bán ra" : "Mua vào"}">${opts.map((s) => `<option value="${s.id}">${esc(s.ten)}</option>`).join("")}</optgroup><optgroup label="Bộ khác">${others.map((s) => `<option value="${s.id}">${esc(s.ten)}</option>`).join("")}</optgroup>`;
    $("setSel").value = S.setId;
    renderContractBanner();
    $("dCt").open = S.linhVuc === "xay_dung"; $("dDc").open = S.linhVuc === "dieu_chinh" || S.linhVuc === "tra_lai";
  }
  function renderContractBanner() {
    const h = S.contractHint, used = S.opt.hopDongCo;
    const dupR = S.dupOf && DB.records.find((r) => r.id === S.dupOf);
    $("hdBanner").innerHTML = (dupR ? `<div class="banner" style="background:var(--err-soft);color:var(--err);margin-bottom:6px"><span>Hóa đơn này đã có trong sổ (lưu ${C.dshort((dupR.updated || dupR.created || "").slice(0, 10))}). Lưu lại sẽ ghi đè hồ sơ cũ.</span><button class="btn sm" id="dupOpen">Mở hồ sơ cũ</button></div>` : "") + (used ? `<div class="banner"><span>Dùng lại hợp đồng số ${esc(used.so)} ngày ${C.dshort(used.ngay)} – không in lại hợp đồng.</span><button class="btn sm" id="hcOff">Lập hợp đồng mới</button></div>`
      : h ? `<div class="banner" style="background:var(--hl-soft);color:var(--hl-ink)"><span>Đã có hợp đồng số ${esc(h.so)} ngày ${C.dshort(h.ngay)} với đối tác này (hồ sơ HĐ ${esc(h.hd || "")}).</span><button class="btn sm pri" id="hcOn">Dùng lại</button></div>` : "");
    if ($("dupOpen")) $("dupOpen").onclick = () => openRecord(dupR.id);
    const on = $("hcOn"), off = $("hcOff");
    if (on) on.onclick = () => { S.opt.hopDongCo = { so: h.so, ngay: h.ngay }; if (h.hieuLuc) S.opt.hieuLuc = h.hieuLuc; applySet(S.setId); renderAI(); refresh(); };
    if (off) off.onclick = () => { delete S.opt.hopDongCo; applySet(S.setId); renderAI(); refresh(); };
  }
  $("chieuSeg").onclick = (e) => { const c = e.target.dataset?.c; if (!c) return; S.chieu = c; applySet(findSet(S.chieu, S.linhVuc).id); renderAI(); refresh(); };
  $("lvChips").onclick = (e) => { const k = e.target.dataset?.lv; if (!k) return; S.linhVuc = k; applySet(findSet(S.chieu, k).id); curDoc = "all"; renderAI(); refresh(); };
  $("setSel").onchange = (e) => { applySet(e.target.value); curDoc = "all"; refresh(); };

  const PF = [["mst", "Mã số thuế", "numeric"], ["ten", "Tên đơn vị", ""], ["dc", "Địa chỉ", ""], ["dd", "Người đại diện", ""], ["cv", "Chức vụ", ""], ["dt", "Điện thoại", "tel"], ["email", "Email", "email"], ["stk", "Số tài khoản", "numeric"], ["nh", "Ngân hàng", ""]];
  function renderParty(side) {
    const p = S[side], me = DB.settings.clientMst && p.mst === DB.settings.clientMst;
    const el = $(side === "ban" ? "pBan" : "pMua");
    el.innerHTML = `<h4><span><b>${side === "ban" ? "Bên bán" : "Bên mua"}</b>${me ? " · doanh nghiệp đang làm" : ""}</span><span class="row"><button class="btn sm ghost" data-swap="1" title="Đổi bên bán ↔ bên mua">⇅</button><button class="btn sm ghost" data-dir="${side}">Lưu danh bạ</button></span></h4>
      <div class="grid2">${PF.map(([k, lb, im]) => `<label class="f${["dd"].includes(k) && !p[k] ? " need" : ""}" style="${k === "ten" || k === "dc" ? "grid-column:1/-1" : ""}"><span>${lb}</span><input data-p="${side}.${k}" value="${esc(p[k] || "")}" ${im ? `inputmode="${im}"` : ""} ${k === "mst" ? `list="mstList"` : ""}></label>`).join("")}</div>`;
  }
  function renderInv() {
    $("invKh").value = S.inv.kh || ""; $("invSo").value = S.inv.so || ""; $("invNgay").value = S.inv.ngay || "";
    $("srcTag").textContent = { xml: "Đọc từ XML", pdf: "Đọc từ PDF – kiểm tra lại", tay: "Nhập tay", mau: "Hóa đơn mẫu" }[S.nguon] || "";
    renderParty("ban"); renderParty("mua");
    let dl = $("mstList"); if (!dl) { dl = document.createElement("datalist"); dl.id = "mstList"; document.body.appendChild(dl); }
    dl.innerHTML = DB.companies.map((c) => `<option value="${esc(c.mst)}">${esc(c.ten)}</option>`).join("");
  }
  ["pBan", "pMua"].forEach((id) => {
    $(id).addEventListener("input", (e) => {
      const k = e.target.dataset.p; if (!k) return; const [side, f] = k.split(".");
      S[side][f] = e.target.value;
      if (f === "mst") { const c = company(e.target.value); if (c) { S[side] = { ...S[side], ...Object.fromEntries(Object.entries(pick(c)).filter(([, v]) => v)) }; renderParty(side); detectContract(S); renderContractBanner(); } }
      refresh(true);
    });
    $(id).addEventListener("click", (e) => {
      const sv = e.target.closest("[data-dir]"); if (sv) { const p = S[sv.dataset.dir]; if (!p.mst) { toast("Cần MST để lưu danh bạ.", true); return; } const c = company(p.mst); if (c) Object.assign(c, p); else DB.companies.push({ ...p, khach: false }); persist(); renderInv(); toast("Đã lưu " + (p.ten || p.mst) + " vào danh bạ."); }
      if (e.target.closest("[data-swap]")) { [S.ban, S.mua] = [S.mua, S.ban]; S.chieu = S.chieu === "ban" ? "mua" : "ban"; applySet(findSet(S.chieu, S.linhVuc).id); renderAll(); }
    });
  });
  $("invKh").oninput = (e) => { S.inv.kh = e.target.value.trim(); S.inv.mau = S.inv.kh.slice(0, 1); refresh(true); };
  $("invSo").oninput = (e) => { S.inv.so = e.target.value.trim(); applyInvoiceCheck(); refresh(true); };
  $("invNgay").oninput = (e) => { S.inv.ngay = e.target.value; refresh(true); };
  function applyInvoiceCheck() { const set = setById(S.setId); if (!set) return; set.items.forEach((it, i) => { if (!it.mau && /hóa đơn/i.test(it.ten) && !/điều chỉnh|hoàn trả/i.test(it.ten)) S.check[i] = S.inv.so ? "co" : "thieu"; }); }

  function renderItems() {
    $("itemsBody").innerHTML = S.items.map((it, i) => `<tr>
      <td><input data-i="${i}" data-k="ten" value="${esc(it.ten)}" aria-label="Tên hàng">${it.tchat === "2" ? '<span class="pill info">KM</span>' : it.tchat === "3" ? '<span class="pill warn">CK</span>' : ""}</td>
      <td style="width:70px"><input data-i="${i}" data-k="dvt" value="${esc(it.dvt)}" aria-label="ĐVT"></td>
      <td style="width:62px"><input class="num" style="text-align:right" data-i="${i}" data-k="sl" value="${esc(it.sl)}" inputmode="decimal" aria-label="Số lượng"></td>
      <td style="width:96px"><input class="num" style="text-align:right" data-i="${i}" data-k="dg" value="${esc(it.dg === "" ? "" : C.money(it.dg))}" inputmode="decimal" aria-label="Đơn giá"></td>
      <td style="width:106px"><input class="num" style="text-align:right" data-i="${i}" data-k="tt" value="${esc(it.tt === "" ? "" : C.money(it.tt))}" inputmode="decimal" placeholder="= SL × ĐG" aria-label="Thành tiền"></td>
      <td style="width:50px"><input style="text-align:right" data-i="${i}" data-k="ts" value="${esc(it.ts)}" aria-label="Thuế suất" placeholder="8%"></td>
      <td style="width:28px"><button class="btn sm ghost" data-del="${i}" aria-label="Xóa dòng">×</button></td></tr>`).join("");
  }
  $("itemsBody").addEventListener("change", (e) => { const t = e.target; if (t.dataset.i == null) return; const it = S.items[+t.dataset.i]; const k = t.dataset.k; it[k] = ["sl", "dg", "tt"].includes(k) ? (t.value.trim() === "" ? "" : C.num(t.value)) : t.value; if (k === "sl" || k === "dg") { it.tt = ""; } renderItems(); refresh(true); });
  $("itemsBody").addEventListener("click", (e) => { const d = e.target.closest("[data-del]"); if (!d) return; S.items.splice(+d.dataset.del, 1); if (!S.items.length) S.items.push({ ten: "", tchat: "1" }); renderItems(); refresh(true); });
  $("addRow").onclick = () => { S.items.push({ ten: "", dvt: "", sl: "", dg: "", tt: "", ts: S.items[0]?.ts || "", tchat: "1" }); renderItems(); };
  $("pasteRows").onclick = () => { $("pasteBox").hidden = false; $("pasteAct").hidden = false; $("pasteBox").focus(); };
  $("pasteCancel").onclick = () => { $("pasteBox").hidden = true; $("pasteAct").hidden = true; };
  $("pasteGo").onclick = () => {
    const rows = [];
    for (const line of $("pasteBox").value.replace(/\r/g, "").split("\n")) {
      let c = line.split("\t").map((x) => x.trim()); if (c.length < 3) continue; if (/^\d+$/.test(c[0])) c = c.slice(1);
      const sl = C.num(c[2]); if (!c[0] || isNaN(sl)) continue;
      rows.push({ ten: c[0], dvt: c[1] || "", sl, dg: isNaN(C.num(c[3])) ? "" : C.num(c[3]), tt: isNaN(C.num(c[4])) ? "" : C.num(c[4]), ts: c[5] || "", tchat: "1" });
    }
    if (!rows.length) { toast("Không nhận ra dòng hàng. Copy từ Excel các cột: Tên, ĐVT, Số lượng, Đơn giá.", true); return; }
    S.items = S.items.filter((i) => i.ten).concat(rows); $("pasteBox").value = ""; $("pasteCancel").onclick();
    if (!S.ai) { S.ai = C.classify({ ban: S.ban, mua: S.mua, items: S.items, inv: S.inv }, { clientMst: DB.settings.clientMst, loaiHinh: curClient()?.loaiHinh }); S.linhVuc = S.ai.linhVuc; applySet(findSet(S.chieu, S.linhVuc).id); renderAI(); }
    renderItems(); refresh(true); toast(`Đã nhận ${rows.length} dòng hàng.`);
  };

  const EXTRA = [["gn", ["ngay", "dia_diem", "nguoi_giao", "cv_giao", "sdt_giao", "cccd_giao", "nguoi_nhan", "cv_nhan", "sdt_nhan", "cccd_nhan", "email", "phuong_tien", "bien_so"]], ["ct", ["ten", "hang_muc", "dia_diem", "tu_ngay", "den_ngay"]], ["dc", ["ly_do", "noi_dung_sai", "noi_dung_dung"]]];
  const OPTF = ["vv", "noiDung", "diaDanh", "hieuLuc", "hanTT", "hinhThuc", "baoHanh", "thoiGian", "ghiChu"];
  function renderExtra() {
    for (const [g, fs] of EXTRA) for (const f of fs) $(`${g}_${f}`).value = S[g]?.[f] || "";
    for (const f of OPTF) $("o_" + f).value = S.opt[f] ?? "";
  }
  for (const [g, fs] of EXTRA) for (const f of fs) $(`${g}_${f}`).addEventListener("input", (e) => { S[g] = S[g] || {}; S[g][f] = e.target.value; refresh(true); });
  for (const f of OPTF) $("o_" + f).addEventListener("input", (e) => { S.opt[f] = e.target.value; refresh(true); });

  /* ---------- Tính & vẽ phần phải ---------- */
  let rT = 0;
  function refresh(debounce) { if (debounce) { clearTimeout(rT); rT = setTimeout(() => refresh(false), 220); return; } if (!S) return; drawRight(); }
  function build(R) {
    const K = C.compute(R);
    const ids = (() => { const prev = S; S = R; const x = setTemplateIds(false); S = prev; return x; })();
    const P = C.plan(R, ids, DB.settings.lui);
    const names = Object.fromEntries(TPL().map((t) => [t.id, t.ten]));
    const ctx = C.context(R, K, P, names);
    const T = C.tables(K);
    return { K, P, ctx, T, ids };
  }
  function docsFor(R, onlySel = true) {
    const B = build(R); const set = setById(R.setId); const out = [];
    if (!set) return { B, docs: out };
    set.items.forEach((it, i) => {
      if (!it.mau || (onlySel && !R.printSel?.[i])) return;
      const t = tplById(it.mau); if (!t || out.some((d) => d.id === it.mau)) return;
      const meta = { so: B.P.so[it.mau], ngay: C.dshort(B.P.ng[it.mau]), ngay_chu: C.dtext(B.P.ng[it.mau]) };
      out.push({ id: it.mau, ten: t.ten, html: C.render(t.html, B.ctx, B.T, meta) });
    });
    return { B, docs: out };
  }
  function drawRight() {
    const { B, docs } = docsFor(S);
    const set = setById(S.setId);
    const st = stats(S);
    $("ring").style.setProperty("--p", st.pct); $("ring").style.setProperty("--ringc", st.pct >= 100 ? "var(--ok)" : st.pct >= 60 ? "var(--brand)" : "var(--hl)");
    $("ringTxt").textContent = st.pct + "%";
    $("setName").textContent = set ? set.ten : "Chưa chọn bộ hồ sơ";
    $("setGroup").textContent = set ? `${set.nhom} · ${S.chieu === "ban" ? "Bán ra" : "Mua vào"} · ${C.LV[S.linhVuc] || ""}` : "";
    $("ckStat").textContent = set ? `${st.done}/${st.bb} chứng từ bắt buộc · app lập sẵn ${st.app} chứng từ` : "";
    $("ckList").innerHTML = set ? set.items.map((it, i) => {
      const s = S.check[i] || "thieu"; const t = it.mau ? tplById(it.mau) : null;
      return `<div class="ck${s === "thieu" && it.bb ? " miss" : ""}">
        <input type="checkbox" data-pr="${i}" ${t ? "" : "disabled"} ${S.printSel[i] ? "checked" : ""} aria-label="In chứng từ này" title="${t ? "Đưa vào bộ in" : "App không lập chứng từ này"}">
        <div class="t"><b>${esc(it.ten)}</b>${it.bb ? '<span class="bb" title="Bắt buộc">*</span>' : ""}<div class="sub">${esc(it.nguon || "")}${t ? ` · <a href="#" data-see="${it.mau}">mẫu: ${esc(t.ten)}</a>` : ""}${it.ghiChu ? " · " + esc(it.ghiChu) : ""}</div></div>
        <div class="st" role="group" aria-label="Trạng thái">${[["co", "Có"], ...(t ? [["app", "App lập"]] : []), ["thieu", "Thiếu"], ["na", "K.áp dụng"]].map(([k, lb]) => `<button class="${k}" data-ck="${i}" data-s="${k}" aria-pressed="${s === k}">${lb}</button>`).join("")}</div></div>`;
    }).join("") : `<div class="ck"><span></span><span class="muted">Chọn bộ hồ sơ ở Bước 2.</span><span></span></div>`;
    $("dkBox").textContent = set?.dinhKhoan || "—"; $("luuY").textContent = set?.luuY || "";
    // tài liệu
    if (curDoc !== "all" && !docs.some((d) => d.id === curDoc)) curDoc = "all";
    $("docTabs").innerHTML = (docs.length > 1 ? `<button data-doc="all" aria-selected="${curDoc === "all"}">Tất cả (${docs.length})</button>` : "") + docs.map((d) => `<button data-doc="${d.id}" aria-selected="${curDoc === d.id || (docs.length === 1)}">${esc(d.ten)}</button>`).join("");
    const show = curDoc === "all" ? docs : docs.filter((d) => d.id === curDoc);
    $("paper").innerHTML = show.length ? show.map((d) => `<div class="a4">${d.html}</div>`).join("") : `<div class="a4"><p style="text-align:center;margin-top:40pt" class="blank">Chưa có chứng từ nào được chọn để in. Tích ô bên trái các chứng từ trong checklist.</p></div>`;
    $("fileHint").textContent = fileHint(S);
    // tổng tiền
    const K = B.K;
    $("sumBox").innerHTML = `<span>Cộng tiền hàng</span><b>${C.money(K.tienHang)}</b><span>${esc(K.nhanThue)}</span><b>${C.money(K.thue)}</b><span>Tổng thanh toán</span><b class="tot">${C.money(K.tong)}</b><span class="small muted" style="grid-column:1/-1">${esc(C.bangChu(K.tong))}</span>`
      + K.doiChieu.map((d) => `<span class="small">${esc(d.lb)} theo HĐ</span><b class="small">${C.money(d.hd)} ${d.ok ? '<span class="pill ok">khớp</span>' : '<span class="pill err">lệch</span>'}</b>`).join("");
    // ngày & số
    $("datesBody").innerHTML = B.ids.map((id) => `<tr><td>${esc(tplById(id)?.ten || id)}</td><td class="c" style="width:90px"><input class="inp num" style="width:64px;text-align:center" data-lui="${id}" value="${S.opt.lui?.[id] ?? DB.settings.lui?.[id] ?? C.LUI[id] ?? 0}" inputmode="numeric"></td><td style="width:150px"><input class="inp" type="date" data-ng="${id}" value="${B.P.ng[id] || ""}"></td><td><input class="inp" data-so="${id}" value="${esc(B.P.so[id] || "")}"></td></tr>`).join("");
    // cảnh báo
    const W = C.checks(S, K, B.P);
    if (st.miss.length) W.push({ lv: "warn", t: "Còn thiếu chứng từ bắt buộc: " + st.miss.join("; ") + "." });
    $("warns").innerHTML = W.length ? W.map((w) => `<div class="w ${w.lv}"><span class="dot"></span><span>${esc(w.t)}</span></div>`).join("") : `<div class="w info"><span class="dot"></span><span>Không phát hiện vấn đề.</span></div>`;
    $("wCount").textContent = `${W.filter((w) => w.lv === "err").length} lỗi · ${W.filter((w) => w.lv === "warn").length} cảnh báo`;
    if (queue[qIdx]) renderQueue();
  }
  function fileHint(R) {
    const kh = company(R.clientMst || DB.settings.clientMst);
    const y = (R.inv.ngay || "").slice(0, 4) || "Năm", m = (R.inv.ngay || "").slice(5, 7) || "Tháng";
    return `Gợi ý lưu Dropbox: ${kh ? safeName(kh.ten).slice(0, 24).toUpperCase() + "_" + kh.mst : "[Mã KH]"}\\HO SO CHUNG TU\\${y}\\T${m}\\${R.chieu === "ban" ? "BAN RA" : "MUA VAO"}\\HD${R.inv.so || "___"}_${safeName((R.chieu === "ban" ? R.mua.ten : R.ban.ten) || "doi_tac").slice(0, 30)}`;
  }
  $("ckList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ck]"); if (b) { S.check[b.dataset.ck] = b.dataset.s; drawRight(); return; }
    const s = e.target.closest("[data-see]"); if (s) { e.preventDefault(); const i = [...$("ckList").querySelectorAll("[data-see]")].indexOf(s); curDoc = s.dataset.see; const idx = setById(S.setId).items.findIndex((x) => x.mau === s.dataset.see); if (idx >= 0) S.printSel[idx] = true; drawRight(); $("paper").scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  $("ckList").addEventListener("change", (e) => { const c = e.target.closest("[data-pr]"); if (!c) return; S.printSel[c.dataset.pr] = c.checked; drawRight(); });
  $("docTabs").onclick = (e) => { const b = e.target.closest("[data-doc]"); if (!b) return; curDoc = b.dataset.doc; drawRight(); };
  $("datesBody").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.lui) { S.opt.lui[t.dataset.lui] = C.num(t.value) || 0; delete S.opt.ngayTay[t.dataset.lui]; }
    if (t.dataset.ng) S.opt.ngayTay[t.dataset.ng] = t.value;
    if (t.dataset.so) S.opt.soTay[t.dataset.so] = t.value;
    drawRight();
  });

  /* ---------- Lưu hồ sơ ---------- */
  function snapshotContract(R) { const B = build(R); const h = B.P.hop_dong; R.contract = h && h.so ? { id: h.id, so: h.so, ngay: h.ngay } : null; }
  $("saveRec").onclick = () => {
    if (!S.inv.so && !S.items.some((i) => i.ten)) { toast("Hồ sơ chưa có hóa đơn hoặc dòng hàng.", true); return; }
    if (S.dupOf && DB.records.some((r) => r.id === S.dupOf)) { const old = S.dupOf; S.id = old; delete S.dupOf; }
    snapshotContract(S); S.updated = new Date().toISOString(); S.clientMst = S.clientMst || DB.settings.clientMst;
    const i = DB.records.findIndex((r) => r.id === S.id); if (i >= 0) DB.records[i] = clone(S); else DB.records.unshift(clone(S));
    const doiTac = S.chieu === "ban" ? S.mua.mst : S.ban.mst;
    if (doiTac) DB.memo[doiTac] = { gn: { ...S.gn, ngay: "" }, opt: { diaDanh: S.opt.diaDanh, hanTT: S.opt.hanTT, hinhThuc: S.opt.hinhThuc, baoHanh: S.opt.baoHanh, vv: S.opt.vv } };
    autoSaveParties(S); persist(true);
    if (queue[qIdx]) queue[qIdx].saved = true;
    toast(`Đã lưu hồ sơ HĐ ${S.inv.so || "(chưa có số)"} vào sổ.`);
    const next = queue.findIndex((q) => !q.saved);
    if (next >= 0 && queue.length > 1) { qIdx = next; S = queue[next].rec; curDoc = "all"; renderAll(); toast(`Chuyển sang hóa đơn ${S.inv.so || ""} (${queue.filter((q) => !q.saved).length} còn lại).`); }
    else renderQueue();
    updateBadge();
  };

  /* ---------- Xuất file ---------- */
  // Logo + tên của ĐƠN VỊ DÙNG APP (Cài đặt của bản rời, mặc định Savitax) — khung đã tính sẵn cỡ theo tỷ lệ thật của logo
  const LOGO_IMG = () => { const d = NOI.donVi(); return d.logo ? `<img src="${d.logo}" width="${d.rong}" height="${d.cao}">` : ""; };
  async function makeDocx(htmlList, title, footer) {
    const { files, bins } = C.docxParts(htmlList, { title, footer });
    const z = new JSZip(); files.forEach(([n, c]) => z.file(n, c)); bins.forEach(([n, b]) => z.file(n, b, { base64: true }));
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
  }
  async function xlFile(sheets, title, ext = "xlsx") {
    const { files, names } = XL.build(sheets, title);
    if (ext === "xls") return new Blob([XL.xml2003(sheets, names)], { type: "application/vnd.ms-excel" });
    const z = new JSZip(); files.forEach(([n, c]) => z.file(n, c));
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
  }
  function docSheet(d) {
    const M = C.sheetModel(d.html, 8);
    const rows = M.rows.map((row) => row.map((c) => c && ({ v: c.v, b: c.b, i: c.i, sz: c.sz ? Math.min(16, c.sz) : 12, al: c.al === "justify" ? "left" : c.al, border: c.border ? "thin" : "", num: c.numFmt })));
    const heights = M.rows.map((row) => { const t = row[0]?.v; return typeof t === "string" && row.length === 1 && t.length > 90 ? Math.min(220, 16.5 * Math.ceil(t.length / 90)) : undefined; });
    return { name: d.ten, rows, merges: M.merges, cols: [7, 34, 10, 11, 14, 16, 14, 16], heights };
  }
  const xlsxBook = (docs, ext = "xlsx") => xlFile(docs.map(docSheet), "Bộ hồ sơ chứng từ", ext);
  async function makePdf(htmlList) {
    if (!window.html2pdf) throw new Error("Chưa tải được thư viện PDF (cần mạng).");
    const st = $("pdfStage"); st.innerHTML = `<div id="pdfInner" class="hsct">${htmlList.map((h, i) => `<div class="a4"${i ? ' style="page-break-before:always"' : ""}>${h}</div>`).join("")}</div>`;
    st.querySelectorAll(".blank").forEach((b) => { b.style.color = "#000"; });
    try {
      return await html2pdf().set({ margin: 0, image: { type: "jpeg", quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "avoid-all"], avoid: ["tr", "p"] } }).from($("pdfInner")).outputPdf("blob");
    } finally { st.innerHTML = ""; }
  }
  function checklistHTML(list) {
    return list.map((R, n) => {
      const set = setById(R.setId); const st = stats(R); const K = C.compute(R);
      const rows = (set?.items || []).map((it, i) => { const s = R.check?.[i] || "thieu"; return `<tr><td style="text-align:center">${i + 1}</td><td>${esc(it.ten)}${it.bb ? " <b>*</b>" : ""}</td><td style="text-align:center">${esc(it.nguon || "")}</td><td style="text-align:center"><b>${{ co: "Đã có", app: "App đã lập – chờ ký", thieu: "CÒN THIẾU", na: "Không áp dụng" }[s]}</b></td><td></td></tr>`; }).join("");
      return `<table class="plain"><tr><td style="width:30%">${LOGO_IMG()}</td><td style="width:70%;text-align:right"><b>${esc(NOI.donVi().ten)}</b>${NOI.donVi().dc ? `<br><i>${esc(NOI.donVi().dc)}</i>` : ""}</td></tr></table>
      <p style="text-align:center;font-size:15pt;margin-top:8pt"><b>PHIẾU KIỂM TRA HỒ SƠ CHỨNG TỪ KẾ TOÁN</b></p>
      <p style="text-align:center"><i>Bộ hồ sơ: ${esc(set?.ten || "")} – ${R.chieu === "ban" ? "Hóa đơn bán ra" : "Hóa đơn mua vào"}</i></p>
      <p style="margin-top:6pt">Doanh nghiệp: <b>${esc(company(R.clientMst)?.ten || (R.chieu === "ban" ? R.ban.ten : R.mua.ten) || "")}</b></p>
      <p>Hóa đơn: ký hiệu ${esc(R.inv.kh || "")} số <b>${esc(R.inv.so || "")}</b> ngày ${C.dshort(R.inv.ngay)} · Tổng thanh toán: <b>${C.money(K.tong)} đ</b></p>
      <p>Bên bán: ${esc(R.ban.ten || "")} – MST ${esc(R.ban.mst || "")}</p><p>Bên mua: ${esc(R.mua.ten || "")} – MST ${esc(R.mua.mst || "")}</p>
      <p style="margin-bottom:4pt">Mức độ đầy đủ chứng từ bắt buộc: <b>${st.done}/${st.bb} (${st.pct}%)</b></p>
      <table class="grid"><tr><td style="width:6%;text-align:center"><b>STT</b></td><td style="width:48%;text-align:center"><b>Chứng từ</b></td><td style="width:14%;text-align:center"><b>Nguồn</b></td><td style="width:18%;text-align:center"><b>Tình trạng</b></td><td style="width:14%;text-align:center"><b>Ghi chú</b></td></tr>${rows}</table>
      <p><i>(*) Chứng từ bắt buộc.</i></p>
      ${st.miss.length ? `<p style="margin-top:4pt"><b>Đề nghị bổ sung:</b> ${esc(st.miss.join("; "))}.</p>` : `<p style="margin-top:4pt"><b>Kết luận:</b> Hồ sơ đủ chứng từ bắt buộc.</p>`}
      <p style="text-align:right;margin-top:8pt"><i>Ngày ${C.dshort(new Date().toISOString().slice(0, 10))}</i></p>
      <table class="plain"><tr><td style="width:50%;text-align:center"><b>NGƯỜI KIỂM TRA</b><br><i>(Ký, họ tên)</i></td><td style="width:50%;text-align:center"><b>KẾ TOÁN TRƯỞNG / TRƯỞNG NHÓM</b><br><i>(Ký, họ tên)</i></td></tr></table>`;
    });
  }
  function baseName(R) { return `HD${R.inv.so || "chua_so"}_${safeName((R.chieu === "ban" ? R.mua.ten : R.ban.ten) || "doi_tac").slice(0, 28)}`; }
  async function exportOne(kind) {
    const { docs } = docsFor(S);
    if (kind !== "ck" && !docs.length) { toast("Chưa chọn chứng từ nào để xuất.", true); return; }
    const done = busy(kind === "pdf" ? "Đang tạo PDF…" : "Đang tạo file…");
    try {
      const nm = baseName(S);
      if (kind === "docx") await saveFile(nm + ".docx", await makeDocx(docs.map((d) => d.html), "Bộ hồ sơ " + nm));
      if (kind === "xlsx" || kind === "xls") await saveFile(nm + "." + kind, await xlsxBook(docs, kind));
      if (kind === "pdf") await saveFile(nm + ".pdf", await makePdf(docs.map((d) => d.html)));
      if (kind === "ck") await saveFile("Phieu_kiem_tra_" + nm + ".docx", await makeDocx(checklistHTML([S]), "Phiếu kiểm tra hồ sơ", "Lập bằng Savitax Hồ Sơ – Hồ sơ chứng từ"));
      if (kind === "print") { $("printArea").innerHTML = docs.map((d) => `<div class="a4">${d.html}</div>`).join(""); window.print(); }
    } catch (e) { toast("Không tạo được file: " + e.message, true); }
    finally { done(); }
  }
  document.querySelectorAll("[data-exp]").forEach((b) => { b.onclick = () => exportOne(b.dataset.exp); });

  /* ---------- Sổ hồ sơ ---------- */
  let soSel = new Set();
  function recRows() {
    const f = C.fold($("soFind").value), m = $("soMonth").value, ch = $("soChieu").value, stf = $("soSt").value, cl = DB.settings.clientMst;
    return DB.records.filter((r) => (!cl || r.clientMst === cl || r.ban.mst === cl || r.mua.mst === cl)
      && (!m || (r.inv.ngay || "").slice(0, 7) === m) && (!ch || r.chieu === ch)
      && (!f || C.fold([r.inv.so, r.ban.ten, r.mua.ten, r.ban.mst, r.mua.mst, setById(r.setId)?.ten].join(" ")).includes(f))
      && (!stf || (stf === "du" ? stats(r).pct >= 100 : stats(r).pct < 100)));
  }
  function renderSo() {
    const months = [...new Set(DB.records.map((r) => (r.inv.ngay || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    const mv = $("soMonth").value; $("soMonth").innerHTML = `<option value="">Mọi tháng</option>` + months.map((m) => `<option value="${m}">Tháng ${m.slice(5)}/${m.slice(0, 4)}</option>`).join(""); $("soMonth").value = mv;
    const rows = recRows();
    $("soCount").textContent = `${rows.length} hồ sơ`;
    $("soBody").innerHTML = rows.length ? rows.map((r) => { const st = stats(r), K = C.compute(r); return `<tr class="${soSel.has(r.id) ? "sel" : ""}"><td><input type="checkbox" data-sid="${r.id}" ${soSel.has(r.id) ? "checked" : ""} aria-label="Chọn"></td>
      <td class="num">${C.dshort(r.inv.ngay)}</td><td class="num"><b>${esc(r.inv.so || "—")}</b>${r.example ? ' <span class="pill info">ví dụ</span>' : ""}</td><td><span class="pill ${r.chieu === "ban" ? "ok" : "info"}">${r.chieu === "ban" ? "Bán ra" : "Mua vào"}</span></td>
      <td>${esc((r.chieu === "ban" ? r.mua.ten : r.ban.ten) || "")}<div class="small muted">${esc(r.chieu === "ban" ? r.mua.mst : r.ban.mst)}</div></td><td>${esc(setById(r.setId)?.ten || "")}</td><td class="r num">${C.money(K.tong)}</td>
      <td style="min-width:150px"><div class="row" style="flex-wrap:nowrap"><div class="prog${st.pct < 100 ? " lo" : ""}" style="flex:1"><i style="width:${st.pct}%"></i></div><span class="small num">${st.done}/${st.bb}</span></div>${st.miss.length ? `<div class="small" style="color:var(--hl-ink)">Thiếu: ${esc(st.miss.slice(0, 2).join("; "))}${st.miss.length > 2 ? "…" : ""}</div>` : ""}</td>
      <td><button class="btn sm" data-open="${r.id}">Mở</button></td></tr>`; }).join("") : `<tr><td colspan="9" class="muted" style="padding:24px;text-align:center">Chưa có hồ sơ nào. Vào “Lập hồ sơ từ hóa đơn” để tải hóa đơn đầu tiên.</td></tr>`;
    $("soSelN").textContent = soSel.size; $("soAll").checked = rows.length && rows.every((r) => soSel.has(r.id));
  }
  ["soFind", "soMonth", "soChieu", "soSt"].forEach((id) => $(id).addEventListener("input", renderSo));
  $("soBody").addEventListener("change", (e) => { const c = e.target.closest("[data-sid]"); if (!c) return; c.checked ? soSel.add(c.dataset.sid) : soSel.delete(c.dataset.sid); renderSo(); });
  $("soAll").onchange = (e) => { recRows().forEach((r) => e.target.checked ? soSel.add(r.id) : soSel.delete(r.id)); renderSo(); };
  $("soBody").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (!b) return; openRecord(b.dataset.open); });
  function openRecord(id) { const r = DB.records.find((x) => x.id === id); if (!r) return; S = clone(r); queue = []; qIdx = -1; curDoc = "all"; detectContract(S); go("lap"); renderAll(); }
  const selRecs = () => DB.records.filter((r) => soSel.has(r.id));
  document.querySelectorAll("[data-bexp]").forEach((b) => b.onclick = async () => {
    const L = selRecs(); if (!L.length) { toast("Chọn ít nhất một hồ sơ trong sổ.", true); return; }
    const k = b.dataset.bexp; const done = busy(`Đang xuất ${L.length} hồ sơ…`);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (k === "docx") await saveFile(`Bo_ho_so_${L.length}_hoa_don_${stamp}.docx`, await makeDocx(L.flatMap((R) => docsFor(R).docs.map((d) => d.html)), "Bộ hồ sơ chứng từ"));
      if (k === "pdf") await saveFile(`Bo_ho_so_${L.length}_hoa_don_${stamp}.pdf`, await makePdf(L.flatMap((R) => docsFor(R).docs.map((d) => d.html))));
      if (k === "xlsx") await saveFile(`Bo_ho_so_${L.length}_hoa_don_${stamp}.xlsx`, await xlsxBook(L.flatMap((R) => docsFor(R).docs.map((d) => ({ ...d, ten: "HD" + (R.inv.so || "") + " " + d.ten })))));
      if (k === "ck") await saveFile(`Phieu_kiem_tra_${L.length}_ho_so_${stamp}.docx`, await makeDocx(checklistHTML(L), "Phiếu kiểm tra hồ sơ", "Lập bằng Savitax Hồ Sơ – Hồ sơ chứng từ"));
      if (k === "zip") { const z = new JSZip(); const seen = {}; for (const R of L) { const d = docsFor(R).docs; let bn = baseName(R); seen[bn] = (seen[bn] || 0) + 1; if (seen[bn] > 1) bn += "_" + seen[bn]; if (d.length) z.file(bn + ".docx", await makeDocx(d.map((x) => x.html), baseName(R))); z.file("Phieu_kiem_tra/" + bn + ".docx", await makeDocx(checklistHTML([R]), "Phiếu kiểm tra")); } await saveFile(`Ho_so_tung_hoa_don_${stamp}.zip`, await z.generateAsync({ type: "blob", compression: "DEFLATE" })); }
    } catch (e) { toast("Không xuất được: " + e.message, true); } finally { done(); }
  });
  $("soDel").onclick = async () => { const L = selRecs(); if (!L.length) return; if (!await ask("Xóa hồ sơ", `Xóa ${L.length} hồ sơ khỏi sổ? Không khôi phục được (trừ khi có file sao lưu).`, "Xóa", true)) return; DB.records = DB.records.filter((r) => !soSel.has(r.id)); soSel.clear(); persist(true); renderSo(); updateBadge(); toast("Đã xóa."); };
  function sheetFromAOA(aoa, widths, name) {
    return { name, cols: widths, rows: aoa.map((r, ri) => r.map((v) => ri === 0 ? { v, b: true, color: "FFFFFF", fill: "0A64B9", al: "center" } : { v: v ?? "", va: "top", border: "hair", num: typeof v === "number" })) };
  }
  $("soXlsx").onclick = async () => {
    const rows = recRows(); const aoa = [["Ngày HĐ", "Ký hiệu", "Số HĐ", "Chiều", "Bên bán", "MST bán", "Bên mua", "MST mua", "Lĩnh vực", "Bộ hồ sơ", "Tiền hàng", "Thuế GTGT", "Tổng thanh toán", "Đủ (%)", "Chứng từ còn thiếu"]];
    rows.forEach((r) => { const K = C.compute(r), st = stats(r); aoa.push([C.dshort(r.inv.ngay), r.inv.kh, r.inv.so, r.chieu === "ban" ? "Bán ra" : "Mua vào", r.ban.ten, r.ban.mst, r.mua.ten, r.mua.mst, C.LV[r.linhVuc], setById(r.setId)?.ten || "", K.tienHang, K.thue, K.tong, st.pct, st.miss.join("; ")]); });
    await saveFile(`So_ho_so_${new Date().toISOString().slice(0, 10)}.xlsx`, await xlFile([sheetFromAOA(aoa, [11, 10, 8, 9, 34, 13, 34, 13, 16, 30, 14, 12, 15, 8, 50], "Sổ hồ sơ")], "Sổ hồ sơ"));
  };
  $("soMiss").onclick = async () => {
    const aoa = [["Ngày HĐ", "Số HĐ", "Đối tác", "Bộ hồ sơ", "Chứng từ còn thiếu", "Nguồn", "Người phụ trách", "Hạn bổ sung"]];
    recRows().forEach((r) => { const set = setById(r.setId); (set?.items || []).forEach((it, i) => { if (it.bb && (r.check?.[i] || "thieu") === "thieu") aoa.push([C.dshort(r.inv.ngay), r.inv.so, r.chieu === "ban" ? r.mua.ten : r.ban.ten, set.ten, it.ten, it.nguon || "", "", ""]); }); });
    if (aoa.length === 1) { toast("Không có chứng từ bắt buộc nào còn thiếu."); return; }
    await saveFile(`Chung_tu_can_bo_sung_${new Date().toISOString().slice(0, 10)}.xlsx`, await xlFile([sheetFromAOA(aoa, [11, 8, 34, 30, 44, 14, 18, 12], "Cần bổ sung")], "Chứng từ cần bổ sung"));
  };

  /* ---------- Tổng quan ---------- */
  function renderDash() {
    const cl = curClient(); const cm = DB.settings.clientMst;
    const R = DB.records.filter((r) => !cm || r.clientMst === cm || r.ban.mst === cm || r.mua.mst === cm);
    $("dashTitle").textContent = cl ? cl.ten : "Tổng quan hồ sơ – tất cả doanh nghiệp";
    $("dashSub").textContent = cl ? `MST ${cl.mst} · ${LH().find((l) => l.id === cl.loaiHinh)?.ten || "Chưa chọn loại hình"}` : "Chọn “Công ty đang làm” ở menu trái để xem riêng và để app tự nhận diện hóa đơn bán ra / mua vào.";
    const S2 = R.map((r) => ({ r, st: stats(r), K: C.compute(r) }));
    const du = S2.filter((x) => x.st.pct >= 100).length, thieu = S2.length - du;
    const ban = S2.filter((x) => x.r.chieu === "ban").reduce((a, x) => a + x.K.tong, 0), mua = S2.filter((x) => x.r.chieu === "mua").reduce((a, x) => a + x.K.tong, 0);
    $("kpis").innerHTML = `<div class="kpi"><span class="l">Hồ sơ trong sổ</span><span class="v">${S2.length}</span><span class="s">${S2.filter((x) => x.r.chieu === "ban").length} bán ra · ${S2.filter((x) => x.r.chieu === "mua").length} mua vào</span></div>
      <div class="kpi"><span class="l">Đủ chứng từ bắt buộc</span><span class="v" style="color:var(--ok)">${du}</span><span class="s">${S2.length ? Math.round(100 * du / S2.length) : 0}% số hồ sơ</span></div>
      <div class="kpi${thieu ? " hl" : ""}"><span class="l">Cần bổ sung</span><span class="v">${thieu}</span><span class="s">${S2.reduce((a, x) => a + x.st.miss.length, 0)} chứng từ còn thiếu</span></div>
      <div class="kpi"><span class="l">Giá trị hóa đơn</span><span class="v num" style="font-size:20px">${C.money(ban)}</span><span class="s">bán ra · mua vào ${C.money(mua)} đ</span></div>`;
    const miss = S2.filter((x) => x.st.miss.length).sort((a, b) => a.st.pct - b.st.pct).slice(0, 8);
    $("missCount").textContent = thieu ? `${thieu} hồ sơ` : "";
    $("missList").innerHTML = miss.length ? miss.map((x) => `<div class="miss-item"><div><b>HĐ ${esc(x.r.inv.so || "—")}</b> · ${esc((x.r.chieu === "ban" ? x.r.mua.ten : x.r.ban.ten) || "")} <span class="small muted">${C.dshort(x.r.inv.ngay)}</span><div class="tags">${x.st.miss.map((m) => `<span class="pill warn">${esc(m)}</span>`).join("")}</div></div><button class="btn sm" data-open2="${x.r.id}">Mở</button></div>`).join("") : `<p class="muted">Không có hồ sơ thiếu chứng từ bắt buộc.</p>`;
    const by = {}; S2.forEach((x) => { const n = setById(x.r.setId)?.ten || "Khác"; by[n] = (by[n] || 0) + 1; });
    const mx = Math.max(1, ...Object.values(by));
    $("bars").innerHTML = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => `<div class="bar"><span>${esc(n)}</span><span class="tr"><i style="width:${100 * v / mx}%"></i></span><b class="num">${v}</b></div>`).join("") || `<p class="muted">Chưa có dữ liệu.</p>`;
    const bm = {}; S2.forEach((x) => { const m = (x.r.inv.ngay || "").slice(0, 7); if (m) bm[m] = (bm[m] || 0) + x.K.tong; });
    const mm = Math.max(1, ...Object.values(bm));
    $("barsM").innerHTML = Object.entries(bm).sort().slice(-6).map(([m, v]) => `<div class="bar"><span>Tháng ${m.slice(5)}/${m.slice(0, 4)}</span><span class="tr"><i style="width:${100 * v / mm}%"></i></span><b class="num small">${C.money(v)}</b></div>`).join("") || `<p class="muted">Chưa có dữ liệu.</p>`;
  }
  $("missList").addEventListener("click", (e) => { const b = e.target.closest("[data-open2]"); if (b) openRecord(b.dataset.open2); });
  function updateBadge() { const n = DB.records.filter((r) => stats(r).pct < 100).length; $("missBadge").hidden = !n; $("missBadge").textContent = n; }

  /* ---------- Bộ hồ sơ (sửa checklist) ---------- */
  let boCur = null;
  function renderBoList() {
    const f = C.fold($("boFind").value), ch = $("boChieu").value; const L = SETS().filter((s) => (!ch || s.chieu === ch) && (!f || C.fold(s.ten + " " + s.nhom).includes(f)));
    const groups = [...new Set(L.map((s) => s.nhom))];
    $("boList").innerHTML = groups.map((g) => `<div class="g">${esc(g)}</div>` + L.filter((s) => s.nhom === g).map((s) => `<button data-bo="${s.id}" aria-current="${s.id === boCur}"><b>${esc(s.ten)}</b><span>${{ ban: "Bán ra", mua: "Mua vào", ca2: "Cả hai chiều", khac: "Không gắn hóa đơn" }[s.chieu] || ""} · ${s.items.length} chứng từ</span></button>`).join("")).join("");
  }
  function renderBoEdit() {
    const s = setById(boCur); const el = $("boEdit");
    if (!s) { el.innerHTML = `<p class="muted">Chọn một bộ hồ sơ bên trái để xem và sửa.</p>`; return; }
    const tplOpts = (v) => `<option value="">— không có mẫu in —</option>` + TPL().map((t) => `<option value="${t.id}" ${t.id === v ? "selected" : ""}>${esc(t.ten)}</option>`).join("");
    const NG = ["Bên bán", "Bên mua", "Hai bên", "Nội bộ", "Ngân hàng", "Hải quan", "Cơ quan thuế", "Nhà cung cấp"];
    el.innerHTML = `<div class="grid2"><label class="f" style="grid-column:1/-1"><span>Tên bộ hồ sơ</span><input id="be_ten" value="${esc(s.ten)}"></label>
      <label class="f"><span>Nhóm</span><input id="be_nhom" value="${esc(s.nhom)}" list="nhomList"></label>
      <label class="f"><span>Chiều hóa đơn</span><select id="be_chieu">${[["ban", "Bán ra"], ["mua", "Mua vào"], ["ca2", "Cả hai"], ["khac", "Không gắn hóa đơn"]].map(([k, l]) => `<option value="${k}" ${s.chieu === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <datalist id="nhomList">${[...new Set(SETS().map((x) => x.nhom))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="f"><span>Áp dụng cho lĩnh vực (app tự chọn bộ này khi nhận diện hóa đơn)</span><div class="chips" id="be_lv">${Object.entries(C.LV).map(([k, l]) => `<button class="chip" data-lv="${k}" aria-pressed="${(s.linhVuc || []).includes(k)}">${esc(l)}</button>`).join("")}</div></div>
      <label class="f"><span>Mô tả</span><input id="be_moTa" value="${esc(s.moTa || "")}"></label>
      <div class="step" style="margin:6px 0 0"><span class="k">Chứng từ trong bộ · kéo ⋮⋮ để sắp xếp</span><button class="btn sm" id="be_add">+ Chứng từ</button></div>
      <div class="items-ed" id="be_items">${s.items.map((it, i) => `<div class="it-row" draggable="true" data-i="${i}"><span class="h" title="Kéo để sắp xếp">⋮⋮</span><input data-k="ten" value="${esc(it.ten)}" aria-label="Tên chứng từ"><select data-k="mau" aria-label="Mẫu in">${tplOpts(it.mau)}</select><select data-k="nguon" aria-label="Nguồn">${NG.map((n) => `<option ${n === it.nguon ? "selected" : ""}>${n}</option>`).join("")}</select><label><input type="checkbox" data-k="bb" ${it.bb ? "checked" : ""}> BB</label><span class="row" style="flex-wrap:nowrap"><button class="btn sm ghost" data-mv="-1" aria-label="Lên">↑</button><button class="btn sm ghost" data-mv="1" aria-label="Xuống">↓</button><button class="btn sm ghost dang" data-rm aria-label="Xóa">×</button></span></div>`).join("")}</div>
      <label class="f"><span>Định khoản gợi ý</span><textarea id="be_dk" rows="4">${esc(s.dinhKhoan || "")}</textarea></label>
      <label class="f"><span>Lưu ý rủi ro</span><textarea id="be_ly" rows="2">${esc(s.luuY || "")}</textarea></label>
      <div class="row"><button class="btn pri" id="be_save">Lưu bộ hồ sơ</button><button class="btn" id="be_dup">Nhân bản</button><button class="btn dang" id="be_del">Xóa bộ</button><span style="flex:1"></span><button class="btn ghost" id="be_reset">Khôi phục toàn bộ về gốc</button></div>`;
    const lst = $("be_items"); let drag = null;
    lst.addEventListener("dragstart", (e) => { drag = e.target.closest(".it-row"); drag?.classList.add("drag"); });
    lst.addEventListener("dragend", () => { drag?.classList.remove("drag"); lst.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); drag = null; });
    lst.addEventListener("dragover", (e) => { e.preventDefault(); const o = e.target.closest(".it-row"); lst.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); if (o && o !== drag) o.classList.add("over"); });
    lst.addEventListener("drop", (e) => { e.preventDefault(); const o = e.target.closest(".it-row"); if (!o || !drag || o === drag) return; const items = readItems(); const a = +drag.dataset.i, b = +o.dataset.i; const [x] = items.splice(a, 1); items.splice(b, 0, x); boDraft(items); });
    lst.addEventListener("click", (e) => { const r = e.target.closest(".it-row"); if (!r) return; const items = readItems(); const i = +r.dataset.i;
      if (e.target.closest("[data-rm]")) { items.splice(i, 1); boDraft(items); }
      const mv = e.target.closest("[data-mv]"); if (mv) { const j = i + +mv.dataset.mv; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; boDraft(items); } });
    $("be_add").onclick = () => { const items = readItems(); items.push({ ten: "Chứng từ mới", mau: null, bb: false, nguon: "Hai bên", ghiChu: "" }); boDraft(items); };
    $("be_lv").onclick = (e) => { const b = e.target.closest("[data-lv]"); if (b) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); };
    $("be_save").onclick = () => { const own = ownSets(); const t = own.find((x) => x.id === boCur); Object.assign(t, collectSet()); persist(true); renderBoList(); toast("Đã lưu bộ hồ sơ " + t.ten + "."); if (S && S.setId === t.id) { applySet(t.id); refresh(); } };
    $("be_dup").onclick = () => { const own = ownSets(); const t = { ...clone(own.find((x) => x.id === boCur)), ...collectSet() }; t.id = "BO_" + uid(); t.ten += " (bản sao)"; own.push(t); boCur = t.id; persist(true); renderBoList(); renderBoEdit(); };
    $("be_del").onclick = async () => { if (!await ask("Xóa bộ hồ sơ", `Xóa bộ “${s.ten}”? Các hồ sơ đã lưu dùng bộ này sẽ không còn checklist.`, "Xóa", true)) return; DB.sets = ownSets().filter((x) => x.id !== boCur); boCur = null; persist(true); renderBoList(); renderBoEdit(); };
    $("be_reset").onclick = async () => { if (!await ask("Khôi phục bộ hồ sơ gốc", "Mọi bộ hồ sơ bạn đã sửa, thêm sẽ trở về bản gốc của app.", "Khôi phục", true)) return; DB.sets = null; DB.loaiHinh = null; persist(true); renderBoList(); renderBoEdit(); };
  }
  function readItems() { return [...$("be_items").querySelectorAll(".it-row")].map((r) => ({ ten: r.querySelector('[data-k="ten"]').value, mau: r.querySelector('[data-k="mau"]').value || null, nguon: r.querySelector('[data-k="nguon"]').value, bb: r.querySelector('[data-k="bb"]').checked, ghiChu: setById(boCur)?.items[+r.dataset.i]?.ghiChu || "" })); }
  function collectSet() { return { ten: $("be_ten").value.trim() || "Bộ hồ sơ", nhom: $("be_nhom").value.trim() || "Khác", chieu: $("be_chieu").value, moTa: $("be_moTa").value, linhVuc: [...$("be_lv").querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.lv), items: readItems(), dinhKhoan: $("be_dk").value, luuY: $("be_ly").value }; }
  function boDraft(items) { const own = ownSets(); const t = own.find((x) => x.id === boCur); Object.assign(t, collectSet(), { items }); persist(); renderBoEdit(); }
  $("boList").onclick = (e) => { const b = e.target.closest("[data-bo]"); if (!b) return; boCur = b.dataset.bo; renderBoList(); renderBoEdit(); };
  $("boFind").oninput = renderBoList; $("boChieu").onchange = renderBoList;
  $("boNew").onclick = () => { const own = ownSets(); const t = { id: "BO_" + uid(), ten: "Bộ hồ sơ mới", nhom: "Tự tạo", chieu: "ban", linhVuc: [], moTa: "", dinhKhoan: "", luuY: "", items: [{ ten: "Hóa đơn GTGT", mau: null, bb: true, nguon: "Bên bán", ghiChu: "" }] }; own.push(t); boCur = t.id; persist(true); renderBoList(); renderBoEdit(); };
  $("boExport").onclick = () => saveFile("Bo_ho_so_Savitax.json", JSON.stringify({ sets: SETS(), loaiHinh: LH() }, null, 1));
  $("boImportF").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); const sets = j.sets || j; if (!Array.isArray(sets)) throw 0; const own = ownSets(); let n = 0; for (const s of sets) { if (!s.id || !s.items) continue; const i = own.findIndex((x) => x.id === s.id); i >= 0 ? (own[i] = s) : own.push(s); n++; } if (j.loaiHinh) DB.loaiHinh = j.loaiHinh; persist(true); renderBoList(); toast(`Đã nhập ${n} bộ hồ sơ.`); } catch (er) { toast("File JSON không đúng định dạng bộ hồ sơ.", true); } e.target.value = ""; };
  $("boTab").onclick = (e) => { const t = e.target.dataset?.t; if (!t) return; $("boTab").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t)); $("boSets").hidden = t !== "sets"; $("boLh").hidden = t !== "lh"; if (t === "lh") renderLH(); };
  function renderLH() {
    $("boLh").innerHTML = `<div class="small muted">Gắn bộ hồ sơ gợi ý cho từng loại hình doanh nghiệp. Khi chọn khách hàng có loại hình này, app ưu tiên các bộ được gắn.</div>` + LH().map((l, li) => `<div class="party"><h4><b>${esc(l.ten)}</b><span class="small muted" style="text-transform:none;letter-spacing:0">${esc(l.moTa || "")}</span></h4><div class="chips">${SETS().filter((s) => s.chieu !== "khac" || true).map((s) => `<button class="chip" data-lh="${li}" data-set="${s.id}" aria-pressed="${(l.boGoiY || []).includes(s.id)}">${esc(s.ten)}</button>`).join("")}</div></div>`).join("");
  }
  $("boLh").onclick = (e) => { const b = e.target.closest("[data-lh]"); if (!b) return; const L = ownLH()[+b.dataset.lh]; L.boGoiY = L.boGoiY || []; const i = L.boGoiY.indexOf(b.dataset.set); i >= 0 ? L.boGoiY.splice(i, 1) : L.boGoiY.push(b.dataset.set); persist(); b.setAttribute("aria-pressed", i < 0); };

  /* ---------- Mẫu chứng từ (trình soạn) ---------- */
  let mauCur = null, srcMode = false;
  const VARS = [["Bên bán", ["ban.ten", "ban.mst", "ban.dc", "ban.dd", "ban.cv", "ban.stk", "ban.nh", "ban.dt", "ban.email"]], ["Bên mua", ["mua.ten", "mua.mst", "mua.dc", "mua.dd", "mua.cv", "mua.stk", "mua.nh", "mua.dt", "mua.email"]],
    ["Hóa đơn", ["hd.kh", "hd.so", "hd.ngay", "hd.ngay_chu", "hd.mau"]], ["Chứng từ này", ["doc.so", "doc.ngay", "doc.ngay_chu"]], ["Hợp đồng chính", ["hop_dong.so", "hop_dong.ngay", "hop_dong.ten"]],
    ["Tiền", ["tien.hang", "tien.thue", "tien.tong", "tien.chu", "thue.nhan", "thue.suat"]], ["Giao nhận", ["gn.nguoi_giao", "gn.cv_giao", "gn.sdt_giao", "gn.cccd_giao", "gn.nguoi_nhan", "gn.cv_nhan", "gn.sdt_nhan", "gn.cccd_nhan", "gn.email", "gn.dia_diem", "gn.phuong_tien", "gn.bien_so", "gn.ngay", "gn.ngay_chu"]],
    ["Công trình", ["ct.ten", "ct.hang_muc", "ct.dia_diem", "ct.tu_ngay", "ct.den_ngay"]], ["Điều chỉnh", ["dc.ly_do", "dc.noi_dung_sai", "dc.noi_dung_dung"]],
    ["Khác", ["dia_danh", "vv", "noi_dung", "hieu_luc", "tt.han", "tt.hinh_thuc", "bao_hanh", "thoi_gian", "ghi_chu"]], ["Bảng", ["BANG_HANG", "BANG_GIA", "BANG_KHO", "BANG_GIAONHAN"]]];
  const VLABEL = { "ban.ten": "Tên bên bán", "ban.mst": "MST bên bán", "ban.dc": "Địa chỉ bên bán", "ban.dd": "Đại diện bên bán", "ban.cv": "Chức vụ", "ban.stk": "Số TK", "ban.nh": "Ngân hàng", "ban.dt": "Điện thoại", "ban.email": "Email",
    "hd.kh": "Ký hiệu HĐ", "hd.so": "Số HĐ", "hd.ngay": "Ngày HĐ", "hd.ngay_chu": "Ngày HĐ bằng chữ", "hd.mau": "Mẫu số", "doc.so": "Số chứng từ", "doc.ngay": "Ngày chứng từ", "doc.ngay_chu": "Ngày chứng từ bằng chữ", "tien.hang": "Cộng tiền hàng", "tien.thue": "Tiền thuế", "tien.tong": "Tổng thanh toán", "tien.chu": "Số tiền bằng chữ", "thue.nhan": "Nhãn thuế", "thue.suat": "Thuế suất",
    dia_danh: "Địa danh", vv: "V/v hợp đồng", noi_dung: "Tóm tắt hàng hóa", hieu_luc: "Hiệu lực HĐ", "tt.han": "Hạn thanh toán (ngày)", "tt.hinh_thuc": "Hình thức TT", bao_hanh: "Bảo hành (tháng)", thoi_gian: "Thời gian thực hiện", ghi_chu: "Ghi chú",
    "hop_dong.so": "Số hợp đồng", "hop_dong.ngay": "Ngày hợp đồng", "hop_dong.ten": "Tên hợp đồng", "gn.nguoi_giao": "Người giao", "gn.cv_giao": "Chức vụ người giao", "gn.sdt_giao": "SĐT người giao", "gn.cccd_giao": "CCCD người giao", "gn.nguoi_nhan": "Người nhận", "gn.cv_nhan": "Chức vụ người nhận", "gn.sdt_nhan": "SĐT người nhận", "gn.cccd_nhan": "CCCD người nhận", "gn.email": "Email liên hệ", "gn.dia_diem": "Địa điểm giao", "gn.phuong_tien": "Phương tiện", "gn.bien_so": "Biển số xe", "gn.ngay": "Ngày giao", "gn.ngay_chu": "Ngày giao bằng chữ",
    "ct.ten": "Tên công trình", "ct.hang_muc": "Hạng mục", "ct.dia_diem": "Địa điểm công trình", "ct.tu_ngay": "Khởi công", "ct.den_ngay": "Hoàn thành", "dc.ly_do": "Lý do điều chỉnh", "dc.noi_dung_sai": "Nội dung sai", "dc.noi_dung_dung": "Nội dung đúng",
    BANG_HANG: "Bảng hàng (có giá + tổng)", BANG_GIA: "Bảng báo giá", BANG_KHO: "Bảng phiếu kho", BANG_GIAONHAN: "Bảng giao nhận" };
  const vlabel = (v) => VLABEL[v] || (v.startsWith("mua.") && VLABEL["ban." + v.slice(4)] ? VLABEL["ban." + v.slice(4)].replace("bán", "mua") : v);
  function toEditable(html) { return String(html).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, v) => `<span class="ph" contenteditable="false" data-v="${v}">${esc(vlabel(v))}</span>`); }
  function fromEditable(root) {
    const c = root.cloneNode(true);
    c.querySelectorAll(".ph").forEach((s) => s.replaceWith(document.createTextNode(`{{${s.dataset.v}}}`)));
    return normalizeHTML(c.innerHTML);
  }
  function normalizeHTML(html) {
    const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html"); const r = d.getElementById("r");
    r.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((x) => x.remove());
    r.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => { const p = d.createElement("p"); p.setAttribute("style", `text-align:${h.style.textAlign || "center"};font-size:${h.tagName === "H1" ? 16 : 14}pt`); p.innerHTML = `<b>${h.innerHTML}</b>`; h.replaceWith(p); });
    r.querySelectorAll("li").forEach((li) => { const p = d.createElement("p"); p.innerHTML = "- " + li.innerHTML; li.replaceWith(p); });
    r.querySelectorAll("ul,ol").forEach((x) => x.replaceWith(...x.childNodes));
    [...r.children].forEach((el) => { if (el.tagName === "DIV" && !el.classList.contains("pb")) { const p = d.createElement("p"); p.setAttribute("style", el.getAttribute("style") || ""); p.innerHTML = el.innerHTML; el.replaceWith(p); } });
    r.querySelectorAll("*").forEach((el) => { for (const a of [...el.attributes]) if (!["style", "class", "colspan", "rowspan"].includes(a.name) || (a.name === "class" && !/^(grid|plain|pb)$/.test(a.value))) el.removeAttribute(a.name); });
    for (const n of [...r.childNodes]) if (n.nodeType === 3 && n.textContent.trim()) { const p = d.createElement("p"); p.textContent = n.textContent; n.replaceWith(p); } else if (n.nodeType === 3) n.remove();
    r.querySelectorAll("table:not(.grid):not(.plain)").forEach((t) => t.classList.add("grid"));
    return r.innerHTML;
  }
  function renderMauList() {
    const f = C.fold($("mauFind").value); const L = TPL().filter((t) => !f || C.fold(t.ten + " " + t.nhom + " " + t.id).includes(f));
    const groups = [...new Set(L.map((t) => t.nhom))];
    $("mauList").innerHTML = groups.map((g) => `<div class="g">${esc(g)}</div>` + L.filter((t) => t.nhom === g).map((t) => `<button data-mau="${t.id}" aria-current="${t.id === mauCur}"><b>${esc(t.ten)}</b><span>${esc(t.id)} · dùng trong ${SETS().filter((s) => s.items.some((i) => i.mau === t.id)).length} bộ</span></button>`).join("")).join("");
  }
  function renderMauEdit() {
    const t = tplById(mauCur); const el = $("mauEdit");
    if (!t) { el.innerHTML = `<p class="muted">Chọn một mẫu bên trái để xem và sửa, hoặc thêm mẫu mới.</p>`; return; }
    el.innerHTML = `<div class="grid3"><label class="f" style="grid-column:span 2"><span>Tên chứng từ</span><input id="me_ten" value="${esc(t.ten)}"></label><label class="f"><span>Nhóm</span><input id="me_nhom" value="${esc(t.nhom)}"></label></div>
      <label class="f"><span>Dùng khi nào</span><input id="me_moTa" value="${esc(t.moTa || "")}"></label>
      <div><div class="tb" id="me_tb">
        <button data-cmd="bold" title="Đậm"><b>B</b></button><button data-cmd="italic" title="Nghiêng"><i>I</i></button><button data-cmd="underline" title="Gạch chân"><u>U</u></button><span class="sp"></span>
        <button data-cmd="justifyLeft" title="Căn trái">⟸</button><button data-cmd="justifyCenter" title="Căn giữa">≡</button><button data-cmd="justifyRight" title="Căn phải">⟹</button><button data-cmd="justifyFull" title="Căn đều">☰</button><span class="sp"></span>
        <select id="me_size" title="Cỡ chữ"><option value="">Cỡ chữ</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option></select>
        <select id="me_var" title="Chèn biến"><option value="">+ Chèn biến tự điền…</option>${VARS.map(([g, vs]) => `<optgroup label="${g}">${vs.map((v) => `<option value="${v}">${esc(vlabel(v))}</option>`).join("")}</optgroup>`).join("")}</select>
        <button data-ins="table" title="Chèn bảng 2 cột có viền">▦ Bảng</button><button data-ins="sign" title="Chèn khối chữ ký hai bên">✍ Chữ ký</button><button data-ins="pb" title="Ngắt trang">⤓ Ngắt trang</button><span class="sp"></span>
        <button id="me_src" title="Sửa mã HTML">${srcMode ? "Xem trang" : "&lt;/&gt; Mã"}</button>
      </div>
      ${srcMode ? `<textarea class="htmlsrc" id="me_html">${esc(t.html)}</textarea>` : `<div class="editor"><div class="a4" id="me_html" contenteditable="true" spellcheck="false">${toEditable(t.html)}</div></div>`}</div>
      <div class="row"><button class="btn pri" id="me_save">Lưu mẫu</button><button class="btn" id="me_test">Xem thử với hồ sơ đang lập</button><button class="btn" id="me_dup">Nhân bản</button><button class="btn" id="me_word">Tải mẫu (Word)</button><button class="btn dang" id="me_del">Xóa</button><span style="flex:1"></span><button class="btn ghost" id="me_reset">Khôi phục mẫu gốc</button></div>
      <div id="me_prev"></div>`;
    const ed = $("me_html");
    let savedRange = null;
    if (!srcMode) { ed.addEventListener("keyup", () => { savedRange = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : null; }); ed.addEventListener("mouseup", () => { savedRange = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : null; }); }
    const restore = () => { ed.focus(); if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
    $("me_tb").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    $("me_tb").onclick = (e) => {
      const b = e.target.closest("button"); if (!b || b.id === "me_src") return; if (srcMode) { toast("Chuyển về chế độ Xem trang để dùng thanh công cụ.", true); return; }
      restore();
      if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
      if (b.dataset.ins === "table") document.execCommand("insertHTML", false, `<table class="grid"><tr><td style="width:50%">&nbsp;</td><td style="width:50%">&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p><br></p>`);
      if (b.dataset.ins === "sign") document.execCommand("insertHTML", false, `<table class="plain"><tr><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN A</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>${toEditable("{{mua.dd}}")}</b></td><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN B</b><br><i>(Ký, họ tên, đóng dấu)</i><br><br><br><br><br><b>${toEditable("{{ban.dd}}")}</b></td></tr></table><p><br></p>`);
      if (b.dataset.ins === "pb") document.execCommand("insertHTML", false, `<div class="pb"></div><p><br></p>`);
    };
    $("me_size").onchange = (e) => { if (srcMode || !e.target.value) return; restore(); const sz = e.target.value; document.execCommand("fontSize", false, "7"); ed.querySelectorAll('font[size="7"]').forEach((f) => { const s = document.createElement("span"); s.style.fontSize = sz + "pt"; s.innerHTML = f.innerHTML; f.replaceWith(s); }); e.target.value = ""; };
    $("me_var").onchange = (e) => { const v = e.target.value; if (!v) return; if (srcMode) { const ta = ed; const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + `{{${v}}}` + ta.value.slice(ta.selectionEnd); } else { restore(); document.execCommand("insertHTML", false, v.startsWith("BANG_") ? `</p><p>${toEditable(`{{${v}}}`)}</p><p>` : toEditable(`{{${v}}}`) + "&nbsp;"); } e.target.value = ""; };
    $("me_src").onclick = () => { stash(); srcMode = !srcMode; renderMauEdit(); };
    $("me_save").onclick = () => { stash(); const own = ownTemplates(); const x = own.find((y) => y.id === mauCur); Object.assign(x, { ten: $("me_ten").value.trim() || x.ten, nhom: $("me_nhom").value.trim() || "Tự tạo", moTa: $("me_moTa").value }); persist(true); renderMauList(); toast("Đã lưu mẫu " + x.ten + "."); if (S) refresh(); };
    $("me_test").onclick = () => { stash(); if (!S) { toast("Chưa có hồ sơ đang lập để xem thử.", true); return; } const B = build(S); const x = tplById(mauCur); const meta = { so: B.P.so[mauCur] || "", ngay: C.dshort(B.P.ng[mauCur] || B.P.goc), ngay_chu: C.dtext(B.P.ng[mauCur] || B.P.goc) }; $("me_prev").innerHTML = `<div class="step" style="margin-top:8px"><span class="k">Xem thử với HĐ ${esc(S.inv.so || "")}</span></div><div class="paperwrap"><div class="a4">${C.render(x.html, B.ctx, B.T, meta)}</div></div>`; };
    $("me_dup").onclick = () => { stash(); const own = ownTemplates(); const x = clone(own.find((y) => y.id === mauCur)); x.id = "M_" + uid().toUpperCase(); x.ten += " (bản sao)"; own.push(x); mauCur = x.id; persist(true); renderMauList(); renderMauEdit(); };
    $("me_word").onclick = async () => { stash(); const x = tplById(mauCur); await saveFile("Mau_" + safeName(x.ten) + ".docx", await makeDocx([x.html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, "«$1»")], x.ten)); };
    $("me_del").onclick = async () => { const used = SETS().filter((s) => s.items.some((i) => i.mau === mauCur)); if (!await ask("Xóa mẫu", used.length ? `Mẫu đang được dùng trong ${used.length} bộ hồ sơ (${used.map((u) => u.ten).slice(0, 3).join(", ")}…). Các bộ đó sẽ không in được chứng từ này nữa.` : "Xóa mẫu này?", "Xóa", true)) return; DB.templates = ownTemplates().filter((y) => y.id !== mauCur); mauCur = null; persist(true); renderMauList(); renderMauEdit(); };
    $("me_reset").onclick = async () => { const orig = MAU_CHUNG_TU.find((y) => y.id === mauCur); if (!orig) { toast("Mẫu tự tạo không có bản gốc.", true); return; } if (!await ask("Khôi phục mẫu gốc", "Nội dung mẫu này sẽ trở về bản gốc của app.", "Khôi phục")) return; const own = ownTemplates(); const i = own.findIndex((y) => y.id === mauCur); own[i] = clone(orig); persist(true); renderMauEdit(); };
  }
  function stash() { const ed = $("me_html"); if (!ed) return; const own = ownTemplates(); const x = own.find((y) => y.id === mauCur); if (!x) return; x.html = srcMode ? normalizeHTML(ed.value) : fromEditable(ed); persist(); }
  $("mauList").onclick = (e) => { const b = e.target.closest("[data-mau]"); if (!b) return; if ($("me_html")) stash(); mauCur = b.dataset.mau; renderMauList(); renderMauEdit(); };
  $("mauFind").oninput = renderMauList;
  $("mauNew").onclick = () => { const own = ownTemplates(); const t = { id: "M_" + uid().toUpperCase(), ten: "Mẫu chứng từ mới", nhom: "Tự tạo", moTa: "", html: `<table class="plain"><tr><td style="width:40%;text-align:center"><b>{{ban.ten}}</b><br>Số: {{doc.so}}</td><td style="width:60%;text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td></tr></table><p style="text-align:center;font-size:15pt;margin-top:12pt"><b>TÊN CHỨNG TỪ</b></p><p style="text-align:justify">Hôm nay, {{doc.ngay_chu}}, tại {{dia_danh}}, chúng tôi gồm:</p><p><b>BÊN A: {{mua.ten}}</b></p><p><b>BÊN B: {{ban.ten}}</b></p><p>{{BANG_HANG}}</p><p><i>Số tiền bằng chữ: {{tien.chu}}</i></p>` }; own.push(t); mauCur = t.id; persist(true); renderMauList(); renderMauEdit(); };
  $("mauDocx").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      let html;
      if (/\.docx$/i.test(f.name)) html = await docxToHTML(await f.arrayBuffer());
      else if (/\.html?$/i.test(f.name)) html = normalizeHTML(new DOMParser().parseFromString(await f.text(), "text/html").body.innerHTML);
      else html = (await f.text()).split(/\r?\n/).map((l) => `<p>${esc(l)}</p>`).join("");
      const own = ownTemplates(); const t = { id: "M_" + uid().toUpperCase(), ten: f.name.replace(/\.[^.]+$/, ""), nhom: "Tự tạo", moTa: "Nhập từ " + f.name, html };
      own.push(t); mauCur = t.id; persist(true); renderMauList(); renderMauEdit();
      toast("Đã nhập mẫu. Bôi đen chỗ cần tự điền rồi chọn “Chèn biến” để thay bằng biến.");
    } catch (er) { toast("Không đọc được file mẫu: " + er.message, true); }
    e.target.value = "";
  };
  async function docxToHTML(buf) {
    const z = await JSZip.loadAsync(buf); const xml = await z.file("word/document.xml").async("string");
    const d = new DOMParser().parseFromString(xml, "application/xml"); const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const kids = (n, name) => [...n.childNodes].filter((c) => c.localName === name);
    const val = (n, name) => { const x = n && n.getElementsByTagNameNS(W, name)[0]; return x ? (x.getAttributeNS(W, "val") ?? x.getAttribute("w:val") ?? "on") : null; };
    const para = (p) => {
      const pPr = kids(p, "pPr")[0]; const jc = val(pPr, "jc"); const al = { center: "center", right: "right", both: "justify", end: "right" }[jc] || "";
      let h = "";
      for (const r of p.getElementsByTagNameNS(W, "r")) {
        const rPr = kids(r, "rPr")[0]; let t = "";
        for (const c of r.childNodes) { if (c.localName === "t") t += esc(c.textContent); if (c.localName === "br") t += "<br>"; if (c.localName === "tab") t += "&nbsp;&nbsp;&nbsp;&nbsp;"; }
        if (!t) continue;
        const b = rPr && rPr.getElementsByTagNameNS(W, "b")[0] && val(rPr, "b") !== "0", i = rPr && rPr.getElementsByTagNameNS(W, "i")[0] && val(rPr, "i") !== "0", u = rPr && val(rPr, "u") && val(rPr, "u") !== "none";
        const sz = rPr && val(rPr, "sz"); if (sz && Number(sz) / 2 !== 13 && Number(sz) / 2 > 13.5) t = `<span style="font-size:${Number(sz) / 2}pt">${t}</span>`;
        if (u) t = `<u>${t}</u>`; if (i) t = `<i>${t}</i>`; if (b) t = `<b>${t}</b>`; h += t;
      }
      return `<p${al ? ` style="text-align:${al}"` : ""}>${h || "<br>"}</p>`;
    };
    const tbl = (t) => {
      const rows = kids(t, "tr"); const grid = !!t.getElementsByTagNameNS(W, "tblBorders")[0] && !/nil|none/.test(t.getElementsByTagNameNS(W, "tblBorders")[0].innerHTML || "");
      const out = rows.map((tr) => kids(tr, "tc")); const html = [];
      out.forEach((cells, ri) => { let row = "<tr>"; cells.forEach((tc, ci) => { const pr = kids(tc, "tcPr")[0]; const vm = pr && pr.getElementsByTagNameNS(W, "vMerge")[0]; if (vm && (vm.getAttributeNS(W, "val") || vm.getAttribute("w:val")) !== "restart") return; const span = Number(val(pr, "gridSpan")) || 1; let rs = 1; if (vm) { for (let k = ri + 1; k < out.length; k++) { const c2 = out[k][ci]; const v2 = c2 && kids(c2, "tcPr")[0]?.getElementsByTagNameNS(W, "vMerge")[0]; if (v2 && (v2.getAttributeNS(W, "val") || v2.getAttribute("w:val")) !== "restart") rs++; else break; } } row += `<td${span > 1 ? ` colspan="${span}"` : ""}${rs > 1 ? ` rowspan="${rs}"` : ""}>${kids(tc, "p").map(para).join("")}</td>`; }); html.push(row + "</tr>"); });
      return `<table class="${grid ? "grid" : "plain"}">${html.join("")}</table>`;
    };
    const body = d.getElementsByTagNameNS(W, "body")[0];
    return normalizeHTML([...body.childNodes].map((n) => n.localName === "p" ? para(n) : n.localName === "tbl" ? tbl(n) : "").join(""));
  }
  $("mauExport").onclick = () => saveFile("Mau_chung_tu_Savitax.json", JSON.stringify(TPL(), null, 1));
  $("mauImportF").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); const L = Array.isArray(j) ? j : j.templates; if (!Array.isArray(L)) throw 0; const own = ownTemplates(); let n = 0; for (const t of L) { if (!t.id || !t.html) continue; t.html = normalizeHTML(t.html); const i = own.findIndex((x) => x.id === t.id); i >= 0 ? (own[i] = t) : own.push(t); n++; } persist(true); renderMauList(); toast(`Đã nhập ${n} mẫu.`); } catch (er) { toast("File JSON không đúng định dạng mẫu chứng từ.", true); } e.target.value = ""; };

  /* ---------- Danh bạ ---------- */
  let dbCur = null;
  function renderDbList() {
    const f = C.fold($("dbFind").value); const L = DB.companies.filter((c) => !f || C.fold(c.mst + " " + c.ten + " " + (c.dd || "")).includes(f));
    $("dbBody").innerHTML = L.length ? L.map((c) => `<tr class="${c.mst === dbCur ? "sel" : ""}" data-mst="${esc(c.mst)}" style="cursor:pointer"><td class="num">${esc(c.mst)}</td><td>${esc(c.ten)}</td><td>${esc(c.dd || "")}</td><td>${c.khach ? '<span class="pill ok">Khách hàng</span>' : '<span class="pill info">Đối tác</span>'}${c.example ? ' <span class="pill warn">ví dụ</span>' : ""}</td></tr>`).join("") : `<tr><td colspan="4" class="muted" style="padding:20px;text-align:center">Chưa có doanh nghiệp. App tự thêm khi đọc hóa đơn, hoặc nhập từ Excel.</td></tr>`;
  }
  function renderDbForm() {
    const c = company(dbCur) || { ...blankParty(), khach: false, loaiHinh: "", cheDo: "TT133" };
    $("dbForm").innerHTML = `<h3>${dbCur ? "Sửa doanh nghiệp" : "Thêm doanh nghiệp"}</h3>
      ${PF.map(([k, lb, im]) => `<label class="f"><span>${lb}</span><input id="dbf_${k}" value="${esc(c[k] || "")}" ${im ? `inputmode="${im}"` : ""}></label>`).join("")}
      <label class="row"><input type="checkbox" id="dbf_khach" ${c.khach ? "checked" : ""}> <span>Khách hàng đang làm kế toán (công ty ở Danh sách công ty tự là khách hàng)</span></label>
      <div class="grid2"><label class="f"><span>Loại hình doanh nghiệp</span><select id="dbf_lh"><option value="">—</option>${LH().map((l) => `<option value="${l.id}" ${c.loaiHinh === l.id ? "selected" : ""}>${esc(l.ten)}</option>`).join("")}</select></label>
      <label class="f"><span>Chế độ kế toán</span><select id="dbf_cd">${["TT133", "TT200 / TT99", "Hộ kinh doanh"].map((x) => `<option ${c.cheDo === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
      <div class="row"><button class="btn pri" id="dbf_save">Lưu</button>${dbCur ? `<button class="btn" id="dbf_use">Chọn làm DN đang làm</button><button class="btn dang" id="dbf_del">Xóa</button>` : ""}</div>`;
    $("dbf_save").onclick = () => {
      const o = Object.fromEntries(PF.map(([k]) => [k, $("dbf_" + k).value.trim()])); o.khach = $("dbf_khach").checked; o.loaiHinh = $("dbf_lh").value; o.cheDo = $("dbf_cd").value;
      if (!o.mst || !o.ten) { toast("Cần MST và tên đơn vị.", true); return; }
      const ex = company(dbCur) || company(o.mst); if (ex) Object.assign(ex, o, { example: false }); else DB.companies.push(o);
      dbCur = o.mst; persist(true); renderDbList(); renderDbForm(); renderClients(); toast("Đã lưu " + o.ten + ".");
    };
    if ($("dbf_use")) $("dbf_use").onclick = () => { const x = company(dbCur); x.khach = true; DB.settings.clientMst = x.mst; persist(true); renderClients(); NOI.khiDoiKhach?.(x.mst); toast("Đang làm: " + x.ten); };
    if ($("dbf_del")) $("dbf_del").onclick = async () => { if (!await ask("Xóa doanh nghiệp", "Xóa khỏi danh bạ? Hồ sơ đã lưu không bị ảnh hưởng.", "Xóa", true)) return; DB.companies = DB.companies.filter((x) => x.mst !== dbCur); dbCur = null; persist(true); renderDbList(); renderDbForm(); renderClients(); };
  }
  $("dbBody").onclick = (e) => { const r = e.target.closest("[data-mst]"); if (!r) return; dbCur = r.dataset.mst; renderDbList(); renderDbForm(); };
  $("dbFind").oninput = renderDbList; $("dbNew").onclick = () => { dbCur = null; renderDbForm(); renderDbList(); $("dbf_mst").focus(); };
  $("dbImportF").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (/\.xls$/i.test(f.name)) throw new Error("File .xls đời cũ: mở bằng Excel rồi lưu lại dạng .xlsx.");
      const books = /\.csv$/i.test(f.name) ? XL.csv(await f.text()) : await XL.read(await f.arrayBuffer()); let n = 0, u = 0;
      for (const rows0 of books) {
        const rows = rows0.map((r) => (r || []).map((x) => String(x ?? "")));
        const hi = rows.findIndex((r) => r.some((x) => /mã số thuế|mst/i.test(x)) && r.some((x) => /tên/i.test(x))); if (hi < 0) continue;
        const H = rows[hi].map((x) => C.fold(x));
        const col = (re) => H.findIndex((h) => re.test(h));
        const ix = { mst: col(/ma so thue|^mst/), ten: col(/ten don vi|ten cong ty|^ten/), dc: col(/dia chi/), dd: col(/dai dien|giam doc/), cv: col(/chuc vu/), stk: col(/so tai khoan|stk/), nh: col(/ngan hang/), dt: col(/dien thoai|sdt/), email: col(/email/) };
        for (const r of rows.slice(hi + 1)) {
          const o = {}; for (const [k, i] of Object.entries(ix)) o[k] = i >= 0 ? String(r[i] || "").trim() : "";
          o.mst = o.mst.replace(/\s/g, ""); if (!o.mst || !o.ten) continue;
          const ex = company(o.mst); if (ex) { Object.entries(o).forEach(([k, v]) => { if (v) ex[k] = v; }); u++; } else { DB.companies.push({ ...o, khach: false }); n++; }
        }
      }
      persist(true); renderDbList(); renderClients(); toast(`Đã thêm ${n}, cập nhật ${u} doanh nghiệp.`);
    } catch (er) { toast("Không đọc được file Excel: " + er.message, true); }
    e.target.value = "";
  };
  $("dbExport").onclick = async () => { const aoa = [["Mã số thuế", "Tên đơn vị", "Địa chỉ", "Người đại diện", "Chức vụ", "Số tài khoản", "Ngân hàng", "Điện thoại", "Email", "Khách hàng", "Loại hình"]]; DB.companies.forEach((c) => aoa.push([c.mst, c.ten, c.dc, c.dd, c.cv, c.stk, c.nh, c.dt, c.email, c.khach ? "x" : "", LH().find((l) => l.id === c.loaiHinh)?.ten || ""])); await saveFile("Danh_ba_doanh_nghiep.xlsx", await xlFile([sheetFromAOA(aoa, [13, 40, 45, 20, 14, 16, 26, 13, 24, 10, 16], "DANH_BA")], "Danh bạ")); };

  /* ---------- Khách hàng đang làm ---------- */
  function renderClients() {
    const L = clients();
    $("clientSel").innerHTML = `<option value="">— Tất cả / chưa chọn —</option>` + L.map((c) => `<option value="${esc(c.mst)}">${esc(c.ten)}</option>`).join("") + `<option value="__add">+ Thêm doanh nghiệp…</option>`;
    $("clientSel").value = DB.settings.clientMst || "";
  }
  $("clientSel").onchange = (e) => {
    if (e.target.value === "__add") { go("db"); dbCur = null; renderDbForm(); $("dbf_khach").checked = true; e.target.value = DB.settings.clientMst || ""; return; }
    DB.settings.clientMst = e.target.value; persist(); renderCurrent();
    if (S && S.ai && !DB.records.some((r) => r.id === S.id)) { S.clientMst = e.target.value; S.ai = C.classify(S, { clientMst: e.target.value, loaiHinh: curClient()?.loaiHinh }); S.chieu = S.ai.chieu; applySet(findSet(S.chieu, S.linhVuc).id); }
  };

  /* ---------- Cài đặt ---------- */
  function renderSettings() {
    const ids = TPL().map((t) => t.id).filter((id) => (C.LUI[id] ?? 0) > 0 || DB.settings.lui[id] != null || C.CONTRACTS.includes(id));
    $("luiBody").innerHTML = ids.map((id) => `<tr><td>${esc(tplById(id)?.ten || id)}</td><td class="c"><input class="inp num" style="width:70px;text-align:center" data-dl="${id}" value="${DB.settings.lui[id] ?? C.LUI[id] ?? 0}" inputmode="numeric"></td></tr>`).join("");
    let bytes = 0; try { bytes = JSON.stringify(DB).length * 2; } catch (e) { /* bỏ qua */ }
    $("usage").innerHTML = `${DB.records.length} hồ sơ · ${DB.companies.length} doanh nghiệp · ${TPL().length} mẫu · ${SETS().length} bộ hồ sơ<br>Dung lượng khoảng ${(bytes / 1048576).toFixed(2)} MB (lưu trong trình duyệt của máy này).`;
  }
  $("luiBody").addEventListener("change", (e) => { const id = e.target.dataset.dl; if (!id) return; DB.settings.lui[id] = C.num(e.target.value) || 0; persist(); toast("Đã lưu số ngày lùi mặc định."); });
  // Ngày nghỉ lễ: dùng chung với cả bản rời — sửa ở Cài đặt của khung (NOI.ngayLe), không còn ô riêng ở đây.
  $("bkSave").onclick = () => saveFile(`Sao_luu_Ho_so_chung_tu_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(DB));
  $("bkLoad").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.records || !j.companies) throw 0; if (!await ask("Khôi phục dữ liệu", `File có ${j.records.length} hồ sơ, ${j.companies.length} doanh nghiệp. Dữ liệu hiện tại trên máy này sẽ bị thay thế.`, "Khôi phục", true)) return; DB = { ...DB, ...j }; if (DB.settings.holidays) C.setHolidays(DB.settings.holidays); persist(true); boot(); toast("Đã khôi phục dữ liệu."); } catch (er) { toast("File sao lưu không hợp lệ.", true); } e.target.value = ""; };
  $("clearEx").onclick = async () => { if (!await ask("Xóa dữ liệu ví dụ", "Xóa hồ sơ và doanh nghiệp ví dụ (hóa đơn số 37 và các công ty mẫu)?", "Xóa", true)) return; DB.records = DB.records.filter((r) => !r.example); DB.companies = DB.companies.filter((c) => !c.example); if (company(DB.settings.clientMst) == null) DB.settings.clientMst = ""; persist(true); boot(); toast("Đã xóa dữ liệu ví dụ."); };
  $("clearAll").onclick = async () => { if (!await ask("Xóa toàn bộ dữ liệu", "Xóa mọi hồ sơ, danh bạ, mẫu và bộ hồ sơ đã sửa trên máy này. Nên sao lưu trước.", "Xóa hết", true)) return; DB = { companies: [], records: [], templates: null, sets: null, loaiHinh: null, settings: { clientMst: "", lui: {}, holidays: null, theme: DB.settings.theme }, memo: {}, seeded: true }; persist(true); S = null; boot(); toast("Đã xóa toàn bộ dữ liệu."); };
  // Bản rời luôn giao diện sáng như app Savitax — bỏ nút đổi sáng / tối.

  /* ---------- Điều hướng ---------- */
  let view = "dash";
  function go(v) { view = v; document.querySelectorAll(".nav button").forEach((b) => b.setAttribute("aria-selected", b.dataset.v === v)); document.querySelectorAll(".view").forEach((s) => { s.hidden = s.id !== "v-" + v; }); renderCurrent(); window.scrollTo({ top: 0 }); }
  function renderCurrent() {
    if (view === "dash") renderDash();
    if (view === "lap") { if (!S) startSample(false); else renderAll(); }
    if (view === "so") renderSo();
    if (view === "bo") { if (!boCur) boCur = SETS()[0]?.id; renderBoList(); renderBoEdit(); }
    if (view === "mau") { if (!mauCur) mauCur = TPL()[0]?.id; renderMauList(); renderMauEdit(); }
    if (view === "db") { renderDbList(); renderDbForm(); }
    if (view === "cai") renderSettings();
  }
  document.querySelector(".nav").onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) go(b.dataset.v); };
  document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => go(b.dataset.go));

  /* ---------- Tải file vào ---------- */
  const drop = $("drop");
  $("fileIn").onchange = (e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ""; };
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  $("useSample").onclick = () => startSample(true);
  $("newBlank").onclick = () => { S = fresh(); S.ai = null; queue = []; qIdx = -1; applySet(findSet(S.chieu, S.linhVuc).id); msg("Nhập tay: điền bên bán, bên mua, dòng hàng; chọn lĩnh vực ở Bước 2.", ""); renderAll(); };
  function startSample(announce) {
    const J = C.parseXML(SAMPLE_XML); J.nguon = "mau";
    queue = []; qIdx = -1; S = buildRecord(J); S.example = true; curDoc = "all";
    if (announce) msg("Đã nạp hóa đơn mẫu số 37 (sơn, bột bả). Thử đổi lĩnh vực, sửa người giao nhận, rồi xuất Word/PDF/Excel.", "ok");
    renderAll();
  }

  /* ---------- Dữ liệu ví dụ lần đầu ---------- */
  function seed() {
    if (DB.seeded) return;
    // Toàn bộ là dữ liệu GIẢ (0-duLieuMau.js). Hai bên chỉ vào Danh bạ làm đối tác ví dụ — "công ty đang làm" do khung
    // bản rời chọn (Danh sách công ty), không đặt ở đây.
    const ex = [
      { ...MAU_BEN_BAN, khach: false, loaiHinh: "thuong_mai", cheDo: "TT133", example: true },
      { ...MAU_BEN_MUA, khach: false, example: true },
    ];
    for (const c of ex) if (!company(c.mst)) DB.companies.push(c);
    const J = C.parseXML(SAMPLE_XML); J.nguon = "mau";
    const R = buildRecord(J); R.example = true; R.clientMst = MAU_BEN_BAN.mst; R.gn = { nguoi_giao: "Lê Văn Giao", cv_giao: "Nhân viên giao hàng", sdt_giao: "0900000002", nguoi_nhan: "", phuong_tien: "Xe tải", bien_so: "99C-000.01" };
    snapshotContract(R); DB.records.push(R);
    DB.seeded = true; persist(true); S = null;
  }

  function boot() {
    C.setHolidays(NOI.ngayLe());
    seed(); renderClients(); updateBadge(); go(view);
    if (NOI.api && NOI.daSan) NOI.daSan();   // khung đồng bộ lại danh sách công ty + công ty đang làm (cả sau khi khôi phục)
  }

  /* ---------- Cầu nối cho khung bản rời ---------- */
  // Danh sách công ty của khung = "khách hàng đang làm" ở đây (khach: true). Công ty bị xoá khỏi khung thì chỉ thôi là khách,
  // vẫn ở Danh bạ (hồ sơ cũ còn tham chiếu). Thông tin khung có (tên, địa chỉ) thắng; thông tin riêng ở Danh bạ (đại diện,
  // tài khoản…) giữ nguyên.
  NOI.api = {
    dongBoKhach(ds) {
      const co = new Set(ds.map((k) => k.mst));
      for (const c of DB.companies) if (c.tuKhung && !co.has(c.mst)) c.khach = false;
      for (const k of ds) {
        const x = company(k.mst);
        if (x) Object.assign(x, { khach: true, tuKhung: true, example: false, ten: k.ten || x.ten, dc: k.dc || x.dc });
        else DB.companies.push({ ...blankParty(), mst: k.mst, ten: k.ten, dc: k.dc || "", khach: true, tuKhung: true });
      }
      persist(); renderClients(); if (view === "db") renderDbList();
    },
    chonKhach(mst) {
      const sel = $("clientSel"), v = clients().some((c) => c.mst === mst) ? mst : "";
      if (v === (DB.settings.clientMst || "") && sel.value === v) return;
      sel.value = v; sel.onchange({ target: sel });
    },
    datNgayLe(ds) { C.setHolidays(ds); if (view === "lap" && S) renderAll(); },
  };
  load(); boot();
})();
