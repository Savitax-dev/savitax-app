/* ===== CORE – thuần, không phụ thuộc giao diện (kiểm thử được bằng node) ===== */
const CORE = (() => {
  /* ---------- Số, tiền, ngày ---------- */
  const D = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  function read3(n, full) {
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10, p = [];
    if (full || h > 0) p.push(D[h] + " trăm");
    if (t === 0) { if (u > 0 && (full || h > 0)) p.push("linh"); }
    else if (t === 1) p.push("mười");
    else p.push(D[t] + " mươi");
    if (u > 0) {
      if (u === 1 && t > 1) p.push("mốt");
      else if (u === 5 && t > 0) p.push("lăm");
      else if (u === 4 && t > 1) p.push("tư");
      else p.push(D[u]);
    }
    return p.join(" ");
  }
  function bangChu(x) {
    const neg = Number(x) < 0;
    let n = Math.round(Math.abs(Number(x) || 0));
    if (n === 0) return "Không đồng.";
    const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    const groups = [];
    while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
    const parts = [];
    for (let i = groups.length - 1; i >= 0; i--) { if (groups[i] === 0) continue; parts.push(read3(groups[i], i < groups.length - 1) + units[i]); }
    const w = (neg ? "âm " : "") + parts.join(" ");
    return w.charAt(0).toUpperCase() + w.slice(1) + " đồng chẵn.";
  }
  let HOLIDAYS = new Set(["2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-04-27", "2026-04-30", "2026-05-01", "2026-09-01", "2026-09-02",
    "2027-01-01", "2027-02-05", "2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11", "2027-04-16", "2027-04-30", "2027-05-03", "2027-09-02", "2027-09-03"]);
  const setHolidays = (arr) => { HOLIDAYS = new Set(arr); };
  const getHolidays = () => [...HOLIDAYS].sort();
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parseISO = (s) => { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); if (!y || !m || !d) return null; return new Date(y, m - 1, d); };
  const isWorkday = (s) => { const d = parseISO(s); if (!d) return true; const wd = d.getDay(); return wd !== 0 && wd !== 6 && !HOLIDAYS.has(iso(d)); };
  function workdayShift(s, n) { // n>0: lùi về trước n ngày làm việc; n<0: tiến tới
    const d = parseISO(s); if (!d) return "";
    let k = 0; const step = n >= 0 ? -1 : 1, m = Math.abs(n);
    while (k < m) { d.setDate(d.getDate() + step); if (isWorkday(iso(d))) k++; }
    return iso(d);
  }
  const dd = (s) => { const d = parseISO(s); return d ? String(d.getDate()).padStart(2, "0") : "…"; };
  const mm = (s) => { const d = parseISO(s); return d ? String(d.getMonth() + 1).padStart(2, "0") : "…"; };
  const yy = (s) => { const d = parseISO(s); return d ? String(d.getFullYear()) : "……"; };
  const dtext = (s) => `ngày ${dd(s)} tháng ${mm(s)} năm ${yy(s)}`;
  const dshort = (s) => parseISO(s) ? `${dd(s)}/${mm(s)}/${yy(s)}` : "…/…/……";
  const money = (x) => (x === "" || x == null || isNaN(x)) ? "" : Math.round(Number(x)).toLocaleString("vi-VN");
  const qty = (x) => (x === "" || x == null || isNaN(x)) ? "" : Number(x).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
  const num = (v) => {
    if (typeof v === "number") return v;
    if (v == null) return NaN;
    let s = String(v).trim().replace(/\s/g, "");
    if (!s) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d+(,\d+)$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    return Number(s);
  };
  const rate = (v) => { const s = String(v ?? "").trim(); if (/kct|kkknt|không/i.test(s)) return 0; const x = num(s.replace("%", "")); if (isNaN(x)) return 0; return x >= 1 ? x / 100 : x; };
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function mstCheck(mst) {
    const s = String(mst || "").replace(/\s/g, "");
    if (!s) return "trống";
    if (/^\d{10}$/.test(s) || /^\d{10}-\d{3}$/.test(s) || /^\d{12}$/.test(s)) return "";
    return "sai định dạng";
  }

  /* ---------- Đọc hóa đơn XML chuẩn TCT ---------- */
  function parseXML(str) {
    const doc = new DOMParser().parseFromString(str, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("xml");
    const tag1 = (n, t) => n ? n.getElementsByTagName(t)[0] : null;
    const txt = (n, t) => { const x = tag1(n, t); return x ? x.textContent.trim() : ""; };
    const nb = tag1(doc, "NBan"), nm = tag1(doc, "NMua"), tc = tag1(doc, "TTChung"), tt = tag1(doc, "TToan");
    if (!nb || !tc) throw new Error("notinvoice");
    const party = (n) => n ? { mst: txt(n, "MST"), ten: txt(n, "Ten") || txt(n, "HVTNMHang"), dc: txt(n, "DChi"), dt: txt(n, "SDThoai"), email: txt(n, "DCTDTu"), stk: txt(n, "STKNHang"), nh: txt(n, "TNHang"), nguoiMua: txt(n, "HVTNMHang") } : {};
    const items = [...doc.getElementsByTagName("HHDVu")].map((h) => {
      const ts = txt(h, "TSuat");
      return { tchat: txt(h, "TChat") || "1", ten: txt(h, "THHDVu"), dvt: txt(h, "DVTinh"), sl: num(txt(h, "SLuong")), dg: num(txt(h, "DGia")), tt: num(txt(h, "ThTien")), ts: ts };
    }).filter((it) => it.ten);
    const lq = tag1(doc, "TTHDLQuan");
    let loai = "goc", lienQuan = null;
    if (lq) {
      const tcLq = txt(lq, "TCHDon"); // 1: thay thế, 2: điều chỉnh
      loai = tcLq === "1" ? "thay_the" : "dieu_chinh";
      lienQuan = { kh: (txt(lq, "KHMSHDCLQuan") || "") + (txt(lq, "KHHDCLQuan") || ""), so: txt(lq, "SHDCLQuan"), ngay: txt(lq, "NLHDCLQuan").slice(0, 10), loai: tcLq };
    }
    const thd = txt(tc, "THDon");
    if (/điều chỉnh/i.test(thd) && loai === "goc") loai = "dieu_chinh";
    return {
      ban: party(nb), mua: party(nm),
      inv: { mau: txt(tc, "KHMSHDon"), kh: (txt(tc, "KHMSHDon") || "") + (txt(tc, "KHHDon") || ""), so: txt(tc, "SHDon"), ngay: txt(tc, "NLap").slice(0, 10), loaiHD: thd, httt: txt(tc, "HTTToan"), loai, lienQuan },
      items, hdTotals: { tienHang: num(txt(tt, "TgTCThue")), thue: num(txt(tt, "TgTThue")), tong: num(txt(tt, "TgTTTBSo")), ck: num(txt(tt, "TTCKTMai")) },
      nguon: "xml",
    };
  }

  /* ---------- Phân loại lĩnh vực ---------- */
  const LV = {
    hang_hoa: "Hàng hóa", dich_vu: "Dịch vụ", xay_dung: "Xây dựng", san_xuat: "Sản xuất – gia công", van_tai: "Vận tải", thue_ts: "Thuê tài sản",
    tscd: "Tài sản cố định", ccdc: "Công cụ dụng cụ", khuyen_mai: "Khuyến mại", ck_thuong_mai: "Chiết khấu thương mại", dieu_chinh: "Điều chỉnh / thay thế HĐ",
    tra_lai: "Hàng trả lại", cong_tac: "Công tác phí", dien_nuoc: "Điện – nước – viễn thông", xang_dau: "Xăng dầu", nhap_khau: "Nhập khẩu", xuat_khau: "Xuất khẩu",
    quang_cao: "Quảng cáo", dao_tao: "Đào tạo", phan_mem: "Phần mềm – CNTT",
  };
  const KW = {
    dich_vu: ["dich vu", "phi ", "phi dich", "cuoc ", "tu van", "sua chua", "bao duong", "bao tri", "lap dat", "ve sinh", "bao ve", "kiem dinh", "thu nghiem", "hoa hong", "moi gioi", "thiet ke", "giam sat", "kiem toan", "ke toan", "dai ly thue", "phap ly", "cong chung", "hosting", "ten mien", "gia han", "thue bao"],
    xay_dung: ["thi cong", "xay dung", "xay lap", "cong trinh", "hang muc", "nha xuong", "san be tong", "do be tong", "ep coc", "dao dat", "lap dung", "trat ", "op lat", "chong tham", "hoan thien", "khoi luong", "san nen", "nghiem thu ky thuat"],
    san_xuat: ["gia cong", "may do", "in an", "in offset", "dap khuon", "son tinh dien", "phay", "tien cnc", "han ", "ep nhua", "nhuom", "che tao", "san xuat theo"],
    van_tai: ["van chuyen", "cuoc van", "van tai", "giao nhan", "chuyen phat", "logistics", "boc xep", "cuoc xe", "thue xe cho hang", "cont ", "container"],
    thue_ts: ["thue van phong", "thue nha", "thue kho", "thue mat bang", "tien thue", "thue xe", "thue may", "thue thiet bi", "thue cua hang", "cho thue"],
    cong_tac: ["phong nghi", "tien phong", "khach san", "ve may bay", "hanh ly", "taxi", "grab", "an uong", "suat an", "nha hang", "ve tau", "ve xe", "luu tru"],
    dien_nuoc: ["tien dien", "dien nang", "dien sinh hoat", "tien nuoc", "nuoc sach", "internet", "cuoc vien thong", "cuoc dien thoai", "truyen hinh", "cap quang", "di dong"],
    xang_dau: ["xang", "dau diesel", "dau do", "ron 95", "e5", "dau nhot", "do 0,05", "do0,05"],
    quang_cao: ["quang cao", "facebook ads", "google ads", "marketing", "truyen thong", "pr ", "bang ron", "bien quang cao", "seo", "livestream", "kol"],
    dao_tao: ["dao tao", "khoa hoc", "hoc phi", "lop hoc", "boi duong", "huan luyen", "tap huan", "giang day"],
    phan_mem: ["phan mem", "license", "ban quyen", "ung dung", "app ", "lap trinh", "website", "cloud", "saas", "chu ky so", "token", "hoa don dien tu"],
    tscd: ["o to", "xe tai", "may xuc", "may phat dien", "day chuyen", "he thong", "may cnc", "xe nang", "may ep"],
    ccdc: ["laptop", "may tinh", "may in", "dieu hoa", "ban ghe", "tu tai lieu", "tu sat", "ke hang", "gia ke", "dien thoai", "may chieu", "camera", "man hinh", "may photo", "quat"],
  };
  const SELLER_KW = {
    cong_tac: ["khach san", "hotel", "hang khong", "vietjet", "bamboo", "vietnam airlines", "taxi", "grab", "be group", "xanh sm", "resort", "nha hang"],
    xang_dau: ["xang dau", "petrolimex", "petro", "pvoil", "dau khi"],
    dien_nuoc: ["dien luc", "evn", "cap nuoc", "nuoc sach", "kinh doanh nuoc", "viettel", "vnpt", "fpt telecom", "mobifone", "vinaphone"],
    van_tai: ["van tai", "logistics", "giao hang", "chuyen phat", "viettel post", "ghn", "ghtk", "j&t"],
    xay_dung: ["xay dung", "xay lap", "kien truc", "co dien"],
  };
  const SVC_UNITS = ["gio", "thang", "lan", "goi", "chuyen", "ky", "dot", "cong", "nam", "khoa", "ngay", "dem", "luot", "nguoi", "suat", "ve", "hd"];
  const GOODS_UNITS = ["kg", "cai", "chiec", "thung", "bao", "lit", "hop", "cuon", "tam", "bo", "pc", "pcs", "lon", "can", "chai", "goi", "doi", "met", "m", "tan", "vien", "hop", "cay", "kien", "cuon", "lo", "lo", "tui"];

  function classify(J, ctx = {}) {
    const reasons = [], score = {}, why = {};
    const add = (k, v, w) => { score[k] = (score[k] || 0) + v; if (w) (why[k] = why[k] || []).push(w); };
    const banM = String(J.ban?.mst || "").trim(), muaM = String(J.mua?.mst || "").trim(), me = String(ctx.clientMst || "").trim();
    let chieu = "", chieuConf = 0;
    if (me && me === banM) { chieu = "ban"; chieuConf = 1; reasons.push("MST bên bán trùng doanh nghiệp đang làm → hóa đơn BÁN RA."); }
    else if (me && me === muaM) { chieu = "mua"; chieuConf = 1; reasons.push("MST bên mua trùng doanh nghiệp đang làm → hóa đơn MUA VÀO."); }
    else { chieu = ctx.defaultChieu || "ban"; chieuConf = 0.3; reasons.push(me ? "MST hai bên không trùng doanh nghiệp đang chọn – hãy chọn chiều hóa đơn." : "Chưa chọn doanh nghiệp đang làm – tạm hiểu là hóa đơn bán ra."); }

    const items = (J.items || []);
    const real = items.filter((i) => i.tchat === "1" || !i.tchat);
    if (J.inv?.loai === "dieu_chinh" || J.inv?.loai === "thay_the") return { chieu, chieuConf, linhVuc: "dieu_chinh", conf: 0.95, reasons: [...reasons, "Hóa đơn có thông tin hóa đơn liên quan (" + (J.inv.loai === "thay_the" ? "thay thế" : "điều chỉnh") + ")."], alt: [] };
    if (items.length && items.every((i) => i.tchat === "2")) return { chieu, chieuConf, linhVuc: "khuyen_mai", conf: 0.9, reasons: [...reasons, "Toàn bộ dòng hàng có tính chất 2 = khuyến mại."], alt: ["hang_hoa"] };
    if (items.length && items.filter((i) => i.tchat === "3").length && !real.length) return { chieu, chieuConf, linhVuc: "ck_thuong_mai", conf: 0.9, reasons: [...reasons, "Dòng hàng có tính chất 3 = chiết khấu thương mại."], alt: [] };
    if (real.length && real.every((i) => Number(i.tt) < 0 || Number(i.sl) < 0)) add("tra_lai", 3, "Số lượng/thành tiền âm → có thể hàng trả lại hoặc điều chỉnh giảm.");

    const sellerF = fold(J.ban?.ten);
    for (const [k, list] of Object.entries(SELLER_KW)) for (const w of list) if ((" " + sellerF.replace(/[^a-z0-9&]+/g, " ") + " ").includes(" " + w + " ")) { if (chieu === "mua") add(k, 2.5, `Tên người bán có "${w}" → ${LV[k]}.`); break; }

    let goodsU = 0, svcU = 0;
    for (const it of real) {
      const t = " " + fold(it.ten).replace(/[^a-z0-9]+/g, " ") + " ";
      for (const [k, list] of Object.entries(KW)) {
        const hit = list.find((w) => t.includes(" " + w.replace(/[^a-z0-9]+/g, " ").trim() + " "));
        if (hit) add(k, 1.6 / Math.max(1, real.length / 3), `"${it.ten.slice(0, 40)}" có từ khóa "${hit.trim()}" → ${LV[k]}.`);
      }
      const u = fold(it.dvt).replace(/[^a-z0-9]/g, "");
      if (SVC_UNITS.includes(u)) svcU++; else if (GOODS_UNITS.includes(u) || /^(m2|m3|md)$/.test(u)) goodsU++;
      if (/^(m2|m3|md)$/.test(u) && /(xay|thi cong|trat|op|lat|son|chong tham|be tong|dao|dap)/.test(t)) add("xay_dung", 1, null);
    }
    if (goodsU) add("hang_hoa", 1.2 * goodsU / Math.max(1, real.length) + 0.4, `${goodsU}/${real.length} dòng có đơn vị tính kiểu hàng hóa (kg, thùng, cái, lít…).`);
    if (svcU) add("dich_vu", 1.2 * svcU / Math.max(1, real.length), `${svcU}/${real.length} dòng có đơn vị tính kiểu dịch vụ (tháng, lần, gói, chuyến…).`);

    if (chieu === "mua") {
      const big = real.filter((i) => Number(i.dg) >= 30000000);
      if (big.length && (score.tscd || score.ccdc)) { add("tscd", 2, "Đơn giá từ 30 triệu đồng trở lên + tên giống máy móc, thiết bị → có thể là TSCĐ."); score.ccdc = (score.ccdc || 0) * 0.3; }
      else if (score.tscd && !big.length) { score.ccdc = (score.ccdc || 0) + score.tscd * 0.6; score.tscd *= 0.3; }
    } else { delete score.tscd; delete score.ccdc; delete score.cong_tac; delete score.dien_nuoc; delete score.xang_dau; }
    if (ctx.loaiHinh === "thuong_mai" && score.ccdc && chieu === "mua") { add("hang_hoa", score.ccdc, "Doanh nghiệp thương mại: thiết bị mua vào thường là hàng hóa để bán."); }
    if (ctx.loaiHinh === "xay_dung" && score.xay_dung) add("xay_dung", 0.5, null);
    if (score.xay_dung && score.dich_vu) score.dich_vu *= 0.5;
    if (!Object.keys(score).length) add("hang_hoa", 0.4, "Không nhận ra từ khóa đặc thù → tạm hiểu là mua bán hàng hóa.");
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const [top, s1] = ranked[0], s2 = ranked[1]?.[1] || 0;
    const conf = Math.max(0.2, Math.min(0.97, (s1 - s2) / (s1 + 0.5) + (s1 > 2 ? 0.25 : 0)));
    const uniq = [...new Set([...reasons, ...(why[top] || [])])].slice(0, 6);
    return { chieu, chieuConf, linhVuc: top, conf, reasons: uniq, alt: ranked.slice(1, 4).map((r) => r[0]) };
  }

  /* ---------- Tính toán số liệu ---------- */
  function compute(S) {
    const items = (S.items || []).filter((it) => String(it.ten || "").trim());
    const rows = items.map((it, i) => {
      const sl = num(it.sl), dg = num(it.dg), ttHD = num(it.tt);
      const tt = !isNaN(ttHD) ? Math.round(ttHD) : Math.round((sl || 0) * (dg || 0));
      const r = rate(it.ts === "" || it.ts == null ? S.opt.vat : it.ts);
      const v = it.tchat === "3" && tt > 0 ? -tt : tt; // dòng chiết khấu thương mại luôn giảm trừ
      return { stt: i + 1, ten: String(it.ten).trim(), dvt: it.dvt || "", sl, dg, tt: v, r, thue: Math.round(v * r), km: it.tchat === "2", ck: it.tchat === "3", tsRaw: it.ts };
    });
    const tienHang = rows.filter((r) => !r.km).reduce((a, r) => a + r.tt, 0);
    const thueTinh = rows.filter((r) => !r.km).reduce((a, r) => a + r.thue, 0);
    const thueHD = num(S.hdTotals?.thue);
    const thue = !isNaN(thueHD) ? Math.round(thueHD) : thueTinh;
    const tong = tienHang + thue;
    const rates = [...new Set(rows.filter((r) => !r.km).map((r) => r.r))];
    const suat = rates.length === 1 ? (/kct/i.test(rows[0]?.tsRaw || "") ? "KCT" : +(rates[0] * 100).toFixed(1) + "%") : "";
    const nhanThue = suat ? (suat === "KCT" ? "Thuế GTGT (không chịu thuế)" : `Thuế GTGT ${suat}`) : "Thuế GTGT";
    const doiChieu = [];
    const cmp = (lb, a, b) => { const x = num(a); if (!isNaN(x)) doiChieu.push({ lb, hd: x, tinh: b, ok: Math.abs(x - b) <= 1 }); };
    cmp("Cộng tiền hàng", S.hdTotals?.tienHang, tienHang);
    cmp("Tiền thuế GTGT", S.hdTotals?.thue, thueTinh);
    cmp("Tổng thanh toán", S.hdTotals?.tong, tong);
    return { rows, tienHang, thue, thueTinh, tong, suat, nhanThue, doiChieu };
  }

  /* ---------- Ngày & số chứng từ ---------- */
  const CONTRACTS = ["HDNT", "HDMB", "HDDV", "HDVC", "HDTHUE", "HDXD", "HDGC"];
  const LUI = { HDNT: 10, HDMB: 7, HDDV: 7, HDVC: 7, HDTHUE: 10, HDXD: 20, HDGC: 10, QD_KM: 10, BG: 5, DDH: 3 };
  const SUFFIX = { HDNT: "HĐNT", HDMB: "HĐMB", HDDV: "HĐDV", HDVC: "HĐVC", HDTHUE: "HĐTTS", HDXD: "HĐXD", HDGC: "HĐGC", BG: "BG", DDH: "ĐĐH", QD_KM: "QĐ-KM",
    BBGN: "BBGN", BBNT_HH: "BBNT", BBNT_DV: "BBNT", BBNT_KL: "BBNTKL", BGTKL: "BGTKL", BBBG_CT: "BBBG", BBBG_TS: "BBBG-TS", DNTT: "ĐNTT", BBDCCN: "BBĐCCN", BBTL: "BBTL", BBDC_HD: "BBĐC", BBTRL: "BBTRL", BBXN_CK: "BBXN" };
  function plan(S, templateIds, luiCfg = {}) {
    const goc = S.gn?.ngay || S.inv?.ngay || "";
    const soHD = String(S.inv?.so || "").replace(/^0+(?=\d)/, "");
    const ng = {}, so = {};
    for (const id of templateIds) {
      const lui = S.opt?.lui?.[id] ?? luiCfg[id] ?? LUI[id] ?? 0;
      ng[id] = S.opt?.ngayTay?.[id] || (goc ? workdayShift(goc, Number(lui) || 0) : "");
      const d = ng[id], ddmm = dd(d) + mm(d), suf = SUFFIX[id] || id.replace(/_/g, "-");
      if (id === "PXK") so[id] = soHD ? "XK" + soHD.padStart(6, "0") : "XK" + ddmm + yy(d).slice(2);
      else if (id === "PNK") so[id] = soHD ? "NK" + soHD.padStart(6, "0") : "NK" + ddmm + yy(d).slice(2);
      else if (CONTRACTS.includes(id) || ["BG", "DDH", "QD_KM"].includes(id)) so[id] = `${ddmm}/${yy(d)}/${suf}`;
      else so[id] = `${soHD || ddmm}/${yy(d)}/${suf}`;
      if (S.opt?.soTay?.[id]) so[id] = S.opt.soTay[id];
    }
    const hc = S.opt?.hopDongCo;
    let main = templateIds.find((id) => CONTRACTS.includes(id));
    if (hc && hc.so) { const k = main || "HDNT"; so[k] = hc.so; ng[k] = hc.ngay || ng[k]; if (!main) main = k; }
    const hop_dong = main ? { id: main, so: so[main], ngay: ng[main] } : (hc ? { id: "", so: hc.so, ngay: hc.ngay } : null);
    return { goc, ng, so, hop_dong };
  }

  /* ---------- Ngữ cảnh điền biến ---------- */
  const DOTS = "……………………";
  function context(S, K, P, tplNames = {}) {
    const p = (o) => ({ ten: o?.ten, mst: o?.mst, dc: o?.dc, dd: o?.dd, cv: o?.cv, stk: o?.stk, nh: o?.nh, dt: o?.dt, email: o?.email });
    const c = {
      ban: p(S.ban), mua: p(S.mua),
      hd: { mau: S.inv?.mau || (S.inv?.kh || "").slice(0, 1), kh: S.inv?.kh, so: S.inv?.so, ngay: S.inv?.ngay ? dshort(S.inv.ngay) : "", ngay_chu: S.inv?.ngay ? dtext(S.inv.ngay) : "" },
      tien: { hang: money(K.tienHang), thue: money(K.thue), tong: money(K.tong), chu: bangChu(K.tong) },
      thue: { nhan: K.nhanThue, suat: K.suat },
      gn: { ...(S.gn || {}), ngay: P.goc ? dshort(P.goc) : "", ngay_chu: P.goc ? dtext(P.goc) : "", dia_diem: S.gn?.dia_diem || S.mua?.dc },
      ct: { ...(S.ct || {}), tu_ngay: S.ct?.tu_ngay ? dshort(S.ct.tu_ngay) : "", den_ngay: S.ct?.den_ngay ? dshort(S.ct.den_ngay) : "" },
      dc: { ...(S.dc || {}) },
      tt: { han: S.opt?.hanTT || 15, hinh_thuc: S.opt?.hinhThuc || "Chuyển khoản" },
      dia_danh: S.opt?.diaDanh, vv: S.opt?.vv || (S.linhVuc === "dich_vu" ? "Cung cấp dịch vụ" : "Mua bán hàng hóa"),
      noi_dung: S.opt?.noiDung || (K.rows[0] ? K.rows[0].ten + (K.rows.length > 1 ? " và các hàng hóa, dịch vụ khác" : "") : ""),
      hieu_luc: S.opt?.hieuLuc ? dtext(S.opt.hieuLuc) : "", bao_hanh: S.opt?.baoHanh, thoi_gian: S.opt?.thoiGian, ghi_chu: S.opt?.ghiChu,
      so: { ...P.so }, ngay: Object.fromEntries(Object.entries(P.ng).map(([k, v]) => [k, v ? dshort(v) : ""])),
      hop_dong: P.hop_dong ? { so: P.hop_dong.so, ngay: P.hop_dong.ngay ? dshort(P.hop_dong.ngay) : "", ten: tplNames[P.hop_dong.id] || "Hợp đồng" } : { so: "", ngay: "", ten: "Hợp đồng" },
    };
    return c;
  }
  const getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);

  /* ---------- Bảng hàng (HTML cùng tập con với mẫu) ---------- */
  function tblRow(cells, hdr) { return "<tr>" + cells.map((c) => `<td${c.cs ? ` colspan="${c.cs}"` : ""}${c.rs ? ` rowspan="${c.rs}"` : ""} style="${c.w ? `width:${c.w}%;` : ""}text-align:${c.al || (hdr ? "center" : "left")}">${hdr || c.b ? "<b>" + esc(c.t) + "</b>" : esc(c.t)}</td>`).join("") + "</tr>"; }
  function tables(K) {
    const R = K.rows.filter((r) => !r.km || true);
    const BANG_HANG = `<table class="grid">` + tblRow([{ t: "STT", w: 6 }, { t: "Tên hàng hóa, dịch vụ", w: 40 }, { t: "ĐVT", w: 9 }, { t: "Số lượng", w: 10 }, { t: "Đơn giá", w: 15 }, { t: "Thành tiền", w: 20 }], true)
      + R.map((r) => tblRow([{ t: r.stt, al: "center" }, { t: r.ten + (r.km ? " (hàng khuyến mại)" : r.ck ? " (chiết khấu thương mại)" : "") }, { t: r.dvt, al: "center" }, { t: qty(r.sl), al: "right" }, { t: money(r.dg), al: "right" }, { t: r.km ? "0" : money(r.tt), al: "right" }])).join("")
      + tblRow([{ t: "Cộng tiền hàng", cs: 5, b: true }, { t: money(K.tienHang), al: "right", b: true }])
      + tblRow([{ t: K.nhanThue, cs: 5, b: true }, { t: money(K.thue), al: "right", b: true }])
      + tblRow([{ t: "Tổng cộng tiền thanh toán", cs: 5, b: true }, { t: money(K.tong), al: "right", b: true }]) + `</table>`;
    const BANG_GIA = `<table class="grid">` + tblRow([{ t: "STT", w: 7 }, { t: "Tên hàng hóa, dịch vụ", w: 48 }, { t: "ĐVT", w: 10 }, { t: "Đơn giá (chưa thuế)", w: 18 }, { t: "Ghi chú", w: 17 }], true)
      + R.map((r) => tblRow([{ t: r.stt, al: "center" }, { t: r.ten }, { t: r.dvt, al: "center" }, { t: money(r.dg), al: "right" }, { t: "" }])).join("") + `</table>`;
    const sumSL = R.reduce((a, r) => a + (r.sl || 0), 0);
    const BANG_KHO = `<table class="grid">`
      + `<tr><td rowspan="2" style="width:6%;text-align:center"><b>STT</b></td><td rowspan="2" style="width:32%;text-align:center"><b>Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hóa</b></td><td rowspan="2" style="width:8%;text-align:center"><b>Mã số</b></td><td rowspan="2" style="width:8%;text-align:center"><b>ĐVT</b></td><td colspan="2" style="text-align:center"><b>Số lượng</b></td><td rowspan="2" style="width:13%;text-align:center"><b>Đơn giá</b></td><td rowspan="2" style="width:15%;text-align:center"><b>Thành tiền</b></td></tr>`
      + `<tr><td style="width:9%;text-align:center"><b>Theo chứng từ</b></td><td style="width:9%;text-align:center"><b>Thực tế</b></td></tr>`
      + tblRow(["A", "B", "C", "D", "1", "2", "3", "4"].map((t) => ({ t, al: "center" })))
      + R.filter((r) => !r.ck).map((r) => tblRow([{ t: r.stt, al: "center" }, { t: r.ten }, { t: "" }, { t: r.dvt, al: "center" }, { t: qty(r.sl), al: "right" }, { t: qty(r.sl), al: "right" }, { t: money(r.dg), al: "right" }, { t: money(Math.abs(r.tt)), al: "right" }])).join("")
      + tblRow([{ t: "Cộng", cs: 4, b: true, al: "center" }, { t: qty(sumSL), al: "right", b: true }, { t: qty(sumSL), al: "right", b: true }, { t: "" }, { t: money(K.tienHang), al: "right", b: true }]) + `</table>`;
    const BANG_GIAONHAN = `<table class="grid">` + tblRow([{ t: "STT", w: 7 }, { t: "Tên hàng hóa", w: 48 }, { t: "ĐVT", w: 10 }, { t: "Số lượng", w: 13 }, { t: "Tình trạng / Ghi chú", w: 22 }], true)
      + R.filter((r) => !r.ck).map((r) => tblRow([{ t: r.stt, al: "center" }, { t: r.ten }, { t: r.dvt, al: "center" }, { t: qty(r.sl), al: "right" }, { t: "Mới 100%, đúng quy cách" }])).join("")
      + tblRow([{ t: "Cộng", cs: 3, b: true, al: "center" }, { t: qty(sumSL), al: "right", b: true }, { t: "" }]) + `</table>`;
    return { BANG_HANG, BANG_GIA, BANG_KHO, BANG_GIAONHAN };
  }
  function render(html, ctx, T, docMeta) {
    let h = String(html || "");
    h = h.replace(/<p[^>]*>\s*\{\{\s*(BANG_HANG|BANG_GIA|BANG_KHO|BANG_GIAONHAN)\s*\}\}\s*<\/p>/g, (m, k) => T[k]);
    h = h.replace(/\{\{\s*(BANG_HANG|BANG_GIA|BANG_KHO|BANG_GIAONHAN)\s*\}\}/g, (m, k) => T[k]);
    const local = { ...ctx, doc: docMeta };
    h = h.replace(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g, (m, path) => {
      const v = getPath(local, path);
      return v === undefined || v === null || v === "" ? `<span class="blank">${DOTS}</span>` : esc(v);
    });
    return h;
  }

  /* ---------- Kiểm tra tuân thủ ---------- */
  function checks(S, K, P) {
    const W = []; // {lv: 'err'|'warn'|'info', t}
    const lv = S.linhVuc;
    if (!S.inv?.so) W.push({ lv: "info", t: "Chưa có số hóa đơn – bộ hồ sơ đang lập trước khi xuất hóa đơn. Khi xuất hóa đơn, ngày hóa đơn phải đúng ngày giao hàng / hoàn thành dịch vụ." });
    if (!P.goc) W.push({ lv: "err", t: "Chưa có ngày hóa đơn hoặc ngày giao hàng – không tính được ngày chứng từ." });
    for (const side of ["ban", "mua"]) {
      const e = mstCheck(S[side]?.mst);
      if (e && !(side === "mua" && !S.mua?.mst && S.mua?.ten)) W.push({ lv: "warn", t: `MST bên ${side === "ban" ? "bán" : "mua"} ${e}.` });
      if (!S[side]?.ten) W.push({ lv: "err", t: `Thiếu tên bên ${side === "ban" ? "bán" : "mua"}.` });
      if (!S[side]?.dd) W.push({ lv: "info", t: `Chưa có người đại diện bên ${side === "ban" ? "bán" : "mua"} – chỗ ký tên sẽ để trống (bổ sung trong Danh bạ để lần sau tự điền).` });
    }
    const httt = fold(S.inv?.httt);
    if (K.tong >= 5000000) {
      if (/^tm$|tien mat/.test(httt)) W.push({ lv: "err", t: `Hóa đơn ${money(K.tong)} đ ghi hình thức thanh toán tiền mặt. Từ 01/7/2025, hàng hóa, dịch vụ mua vào từ 5 triệu đồng phải thanh toán không dùng tiền mặt mới được khấu trừ thuế GTGT (Luật Thuế GTGT số 48/2024/QH15) và tính chi phí được trừ.` });
      else W.push({ lv: "info", t: `Tổng thanh toán ${money(K.tong)} đ ≥ 5 triệu: lưu kèm chứng từ thanh toán không dùng tiền mặt (UNC, sao kê ngân hàng).` });
    }
    if (S.gn?.ngay && S.inv?.ngay && S.gn.ngay !== S.inv.ngay && ["hang_hoa", "tscd", "ccdc", "xang_dau", "nhap_khau"].includes(lv)) W.push({ lv: "warn", t: "Ngày giao hàng khác ngày hóa đơn. Với hàng hóa, thời điểm lập hóa đơn là thời điểm chuyển giao quyền sở hữu hoặc quyền sử dụng (Điều 9 NĐ 123/2020, sửa đổi bởi NĐ 70/2025)." });
    if (lv === "dich_vu" || lv === "van_tai" || lv === "quang_cao" || lv === "dao_tao" || lv === "phan_mem") W.push({ lv: "info", t: "Dịch vụ: hóa đơn lập khi hoàn thành cung cấp dịch vụ (ngày ký biên bản nghiệm thu) hoặc khi thu tiền trước. Đối chiếu ngày biên bản nghiệm thu với ngày hóa đơn." });
    if (lv === "xay_dung") W.push({ lv: "info", t: "Xây dựng: lập hóa đơn theo từng lần nghiệm thu, bàn giao khối lượng. Ngày biên bản nghiệm thu khối lượng nên trùng ngày hóa đơn." });
    if (lv === "tscd") W.push({ lv: "info", t: "TSCĐ: nguyên giá từ 30 triệu đồng, thời gian sử dụng trên 1 năm (TT 45/2013). Lưu biên bản bàn giao, phiếu bảo hành, quyết định tăng tài sản, thẻ TSCĐ." });
    if (lv === "ccdc" && K.rows.some((r) => r.dg >= 30000000)) W.push({ lv: "warn", t: "Có dòng đơn giá từ 30 triệu đồng nhưng đang xếp là công cụ dụng cụ – xem xét ghi nhận TSCĐ." });
    if (lv === "khuyen_mai") W.push({ lv: "info", t: "Hàng khuyến mại: cần chương trình khuyến mại (thông báo Sở Công Thương nếu thuộc diện theo NĐ 128/2024) để giá tính thuế bằng 0." });
    if (P.goc) {
      const order = ["HDNT", "HDMB", "HDDV", "HDXD", "HDVC", "HDTHUE", "HDGC", "BG", "DDH"].filter((k) => P.ng[k]);
      for (let i = 1; i < order.length; i++) if (["BG", "DDH"].includes(order[i]) && P.ng[order[i]] < P.ng[order[i - 1]] && !S.opt?.hopDongCo) W.push({ lv: "warn", t: "Thứ tự ngày chưa hợp lý: hợp đồng ≤ báo giá ≤ đơn đặt hàng ≤ giao hàng." });
      if (S.inv?.ngay && !isWorkday(S.inv.ngay)) W.push({ lv: "info", t: `Ngày hóa đơn ${dshort(S.inv.ngay)} rơi vào ngày nghỉ – kiểm tra lại thực tế giao hàng.` });
    }
    if (S.opt?.hieuLuc && S.inv?.ngay && S.opt.hieuLuc < S.inv.ngay) W.push({ lv: "err", t: "Hợp đồng đã hết hiệu lực trước ngày hóa đơn – cần gia hạn hoặc ký hợp đồng mới." });
    for (const d of K.doiChieu) if (!d.ok) W.push({ lv: "warn", t: `${d.lb}: hóa đơn ghi ${money(d.hd)}, bảng kê tính ${money(d.tinh)} (lệch ${money(d.hd - d.tinh)}).` });
    if (!K.rows.length) W.push({ lv: "err", t: "Chưa có dòng hàng hóa, dịch vụ nào." });
    const seen = new Set();
    return W.filter((w) => !seen.has(w.t) && seen.add(w.t));
  }

  /* ---------- HTML → DOCX (WordprocessingML) ---------- */
  const PAGE_W = 9071; // twips: A4 21cm – lề trái 3cm – phải 2cm
  function styleOf(el) {
    const s = {}; const st = el.getAttribute && el.getAttribute("style") || "";
    st.split(";").forEach((kv) => { const [k, v] = kv.split(":").map((x) => x && x.trim()); if (k && v) s[k.toLowerCase()] = v; });
    return s;
  }
  const pt = (v) => { const m = String(v || "").match(/([\d.]+)\s*pt/); return m ? parseFloat(m[1]) : null; };
  const JC = { left: "left", center: "center", right: "right", justify: "both" };
  function runsX(node, fmt, out, imgs) {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.replace(/[\r\n\t]+/g, " ");
        if (!t) continue;
        const pr = (fmt.b ? "<w:b/><w:bCs/>" : "") + (fmt.i ? "<w:i/><w:iCs/>" : "") + (fmt.u ? '<w:u w:val="single"/>' : "") + (fmt.sz ? `<w:sz w:val="${Math.round(fmt.sz * 2)}"/><w:szCs w:val="${Math.round(fmt.sz * 2)}"/>` : "") + (fmt.color ? `<w:color w:val="${fmt.color}"/>` : "");
        out.push(`<w:r>${pr ? "<w:rPr>" + pr + "</w:rPr>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
      } else if (n.nodeType === 1) {
        const tg = n.tagName.toLowerCase();
        if (tg === "br") { out.push("<w:r><w:br/></w:r>"); continue; }
        if (tg === "img" && imgs) {
          const src = n.getAttribute("src") || ""; const m = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
          if (m) {
            const id = imgs.length + 1, wpx = Number(n.getAttribute("width")) || 120, hpx = Number(n.getAttribute("height")) || 60;
            imgs.push({ id, ext: m[1] === "png" ? "png" : "jpeg", b64: m[2] });
            const cx = Math.round(wpx * 9525), cy = Math.round(hpx * 9525);
            out.push(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="img${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`);
          }
          continue;
        }
        const f = { ...fmt };
        if (tg === "b" || tg === "strong") f.b = true;
        if (tg === "i" || tg === "em") f.i = true;
        if (tg === "u") f.u = true;
        const s = styleOf(n);
        if (pt(s["font-size"])) f.sz = pt(s["font-size"]);
        if (/bold|[6-9]00/.test(s["font-weight"] || "")) f.b = true;
        if (/italic/.test(s["font-style"] || "")) f.i = true;
        if (n.classList && n.classList.contains("blank")) f.color = null;
        runsX(n, f, out, imgs);
      }
    }
    return out;
  }
  function parX(el, extra = {}, imgs) {
    const s = styleOf(el), al = s["text-align"] || extra.al;
    const sb = pt(s["margin-top"]) ?? extra.sb ?? 0, sa = pt(s["margin-bottom"]) ?? extra.sa ?? 2, ind = pt(s["text-indent"]);
    const fmt = { sz: pt(s["font-size"]) || extra.sz || null };
    const runs = runsX(el, fmt, [], imgs).join("");
    return `<w:p><w:pPr>${extra.keep ? "<w:keepNext/>" : ""}<w:spacing w:before="${Math.round(sb * 20)}" w:after="${Math.round(sa * 20)}" w:line="${extra.line || 276}" w:lineRule="auto"/>${ind ? `<w:ind w:firstLine="${Math.round(ind * 20)}"/>` : ""}${al && JC[al] ? `<w:jc w:val="${JC[al]}"/>` : ""}</w:pPr>${runs}</w:p>`;
  }
  function tblX(tbl, imgs) {
    const grid = tbl.classList.contains("grid");
    const rows = [...tbl.rows];
    // ma trận chiếm chỗ để xử lý rowspan / colspan
    const occ = []; let ncol = 0;
    const layout = rows.map((tr, ri) => {
      occ[ri] = occ[ri] || [];
      const cells = []; let c = 0;
      for (const td of tr.cells) {
        while (occ[ri][c]) { cells.push({ cont: true, col: c, span: occ[ri][c].span }); c += occ[ri][c].span; }
        const cs = Number(td.getAttribute("colspan")) || 1, rs = Number(td.getAttribute("rowspan")) || 1;
        cells.push({ td, col: c, span: cs, rs });
        for (let r = 1; r < rs; r++) { occ[ri + r] = occ[ri + r] || []; occ[ri + r][c] = { span: cs }; }
        c += cs;
      }
      while (occ[ri][c]) { cells.push({ cont: true, col: c, span: occ[ri][c].span }); c += occ[ri][c].span; }
      ncol = Math.max(ncol, c);
      return cells;
    });
    // độ rộng cột: lấy từ ô không gộp có width %
    const wpct = new Array(ncol).fill(null);
    layout.forEach((cells) => cells.forEach((x) => { if (x.td && x.span === 1) { const w = parseFloat(styleOf(x.td).width); if (w && wpct[x.col] == null) wpct[x.col] = w; } }));
    const known = wpct.filter((w) => w != null).reduce((a, b) => a + b, 0), unk = wpct.filter((w) => w == null).length;
    const rest = Math.max(0, 100 - known);
    const pc = wpct.map((w) => w != null ? w : (unk ? rest / unk : 0));
    const tot = pc.reduce((a, b) => a + b, 0) || 100;
    const tw = pc.map((p) => Math.round(PAGE_W * p / tot));
    const bd = ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => grid ? `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>` : `<w:${s} w:val="nil"/>`).join("");
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${bd}</w:tblBorders><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${tw.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
    layout.forEach((cells) => {
      x += "<w:tr><w:trPr><w:cantSplit/></w:trPr>";
      for (const c of cells) {
        const w = tw.slice(c.col, c.col + c.span).reduce((a, b) => a + b, 0);
        const span = c.span > 1 ? `<w:gridSpan w:val="${c.span}"/>` : "";
        if (c.cont) { x += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span}<w:vMerge/></w:tcPr><w:p/></w:tc>`; continue; }
        const s = styleOf(c.td), va = s["vertical-align"] === "top" ? "top" : "center";
        const kids = [...c.td.children].filter((k) => k.tagName === "P");
        const al = s["text-align"];
        const body = kids.length ? kids.map((k) => parX(k, { al, sa: 0, line: 252 }, imgs)).join("") : parX(c.td, { al, sa: 0, line: 252 }, imgs);
        x += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span}${c.rs > 1 ? '<w:vMerge w:val="restart"/>' : ""}<w:vAlign w:val="${va}"/></w:tcPr>${body}</w:tc>`;
      }
      x += "</w:tr>";
    });
    return x + "</w:tbl>";
  }
  function bodyX(html, imgs) {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
    const root = doc.getElementById("r"); const out = [];
    for (const el of root.children) {
      const tg = el.tagName.toLowerCase();
      if (tg === "table") { out.push(tblX(el, imgs)); out.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>'); }
      else if (tg === "div" && el.classList.contains("pb")) out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      else out.push(parX(el, {}, imgs));
    }
    return out.join("");
  }
  const SECT = (o = {}) => `<w:sectPr>${o.footer ? '<w:footerReference w:type="default" r:id="rIdFt"/>' : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  function docxParts(htmlList, opt = {}) {
    const imgs = [];
    const parts = htmlList.map((h) => bodyX(h, imgs));
    const sect = SECT(opt);
    const body = parts.join(`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sect}</w:pPr></w:p>`);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${opt.footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
    const drels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${opt.footer ? '<Relationship Id="rIdFt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ""}${imgs.map((i) => `<Relationship Id="rIdImg${i.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img${i.id}.${i.ext}"/>`).join("")}</Relationships>`;
    const now = new Date().toISOString().slice(0, 19) + "Z";
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(opt.title || "Bộ hồ sơ chứng từ")}</dc:title><dc:creator>Savitax Hồ Sơ – Hồ sơ chứng từ</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
    const files = [["[Content_Types].xml", ct], ["_rels/.rels", rels], ["word/_rels/document.xml.rels", drels], ["word/styles.xml", styles], ["word/document.xml", document], ["docProps/core.xml", core]];
    if (opt.footer) files.push(["word/footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">${esc(opt.footer)}</w:t></w:r></w:p></w:ftr>`]);
    const bins = imgs.map((i) => [`word/media/img${i.id}.${i.ext}`, i.b64]);
    return { files, bins };
  }

  /* ---------- HTML → bảng tính (mảng ô có định dạng) ---------- */
  // trả về { rows: [[{v, s}]], merges: [{s:{r,c}, e:{r,c}}], cols: N }
  function sheetModel(html, N = 8) {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
    const root = doc.getElementById("r");
    const rows = [], merges = [];
    const fmtOf = (el) => { const s = styleOf(el); return { al: s["text-align"], sz: pt(s["font-size"]) }; };
    const textOf = (el) => { const c = el.cloneNode(true); c.querySelectorAll("br").forEach((b) => b.replaceWith("\n")); return c.textContent.replace(/[ \t]+/g, " ").replace(/\n /g, "\n").trim(); };
    const isB = (el) => !!el.querySelector("b,strong") && textOf(el.querySelector("b,strong")).length >= textOf(el).length * 0.6;
    const isI = (el) => !!el.querySelector("i,em") && textOf(el.querySelector("i,em")).length >= textOf(el).length * 0.6;
    for (const el of root.children) {
      const tg = el.tagName.toLowerCase();
      if (tg === "p") {
        const f = fmtOf(el), t = textOf(el);
        const r = rows.length; rows.push([{ v: t, b: isB(el), i: isI(el), al: f.al, sz: f.sz, wrap: true }]);
        merges.push({ s: { r, c: 0 }, e: { r, c: N - 1 } });
      } else if (tg === "table") {
        const grid = el.classList.contains("grid");
        const trs = [...el.rows]; const occ = [];
        let ncol = 0; trs.forEach((tr) => { let c = 0; for (const td of tr.cells) c += Number(td.getAttribute("colspan")) || 1; ncol = Math.max(ncol, c); });
        // ánh xạ cột bảng → cột sheet (cột tên rộng nhất nhận phần dư)
        const base = Math.max(1, Math.floor(N / ncol)); const span = new Array(ncol).fill(base);
        let rem = N - base * ncol; let k = 1 % ncol; while (rem > 0) { span[k] += 1; rem--; k = (k + 1) % ncol; }
        if (ncol > N) span.fill(1);
        const start = span.map((_, i) => span.slice(0, i).reduce((a, b) => a + b, 0));
        trs.forEach((tr, ri) => {
          const r = rows.length; const row = []; occ[ri] = occ[ri] || [];
          let c = 0;
          for (const td of tr.cells) {
            while (occ[ri][c]) c += occ[ri][c];
            const cs = Number(td.getAttribute("colspan")) || 1, rs = Number(td.getAttribute("rowspan")) || 1;
            const sc = start[Math.min(c, ncol - 1)], ec = (start[Math.min(c + cs - 1, ncol - 1)] + span[Math.min(c + cs - 1, ncol - 1)] - 1);
            const f = fmtOf(td); const t = textOf(td);
            const nv = /^-?\d{1,3}(\.\d{3})+$|^-?\d+$/.test(t) && t.length < 16 && !/^0\d/.test(t) ? num(t) : null;
            row[sc] = { v: nv != null && f.al === "right" ? nv : t, b: isB(td), i: isI(td), al: f.al || "left", border: grid, wrap: true, numFmt: nv != null && f.al === "right" };
            for (let cc = sc + 1; cc <= ec; cc++) row[cc] = { v: "", border: grid };
            if (ec > sc || rs > 1) merges.push({ s: { r, c: sc }, e: { r: r + rs - 1, c: ec } });
            for (let q = 1; q < rs; q++) { occ[ri + q] = occ[ri + q] || []; occ[ri + q][c] = cs; }
            c += cs;
          }
          rows.push(row);
        });
        rows.push([]);
      } else if (tg === "div") rows.push([]);
    }
    return { rows, merges, cols: N };
  }

  return { bangChu, workdayShift, isWorkday, setHolidays, getHolidays, dshort, dtext, money, qty, num, fold, esc, mstCheck, parseXML, classify, LV, compute, plan, context, tables, render, checks, docxParts, sheetModel, CONTRACTS, LUI, SUFFIX, iso, parseISO };
})();
if (typeof module !== "undefined") module.exports = CORE;
