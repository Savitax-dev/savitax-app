// Bộ vẽ BIỂU MẪU dùng chung cho các phụ lục / báo cáo in từ cổng thuế (bộ dựng PD4ML): phụ lục 03-1A/TNDN, Báo cáo tài
// chính (Cân đối kế toán, Kết quả kinh doanh, Lưu chuyển tiền tệ). Cùng hệ đo với lib/tokhaiPdfMau.js mẫu bản mới: chữ 10pt
// (bản cổng in 9,95), hàng bảng 1 dòng 18,64 · n dòng 6,85 + n × 11,8, chữ trong ô cách mép 3,3–3,5, bảng HTML ngắt dòng như
// trình duyệt (C.ngat html). Mỗi phần (một biểu) mở trang mới và đánh số trang riêng như bản cổng.
//
// Dùng: const b = taoBieu({ pdf, C, mau, veChuKy })  →  b.moTrang(); b.chu(...); b.bang(...); …; b.ketThuc()

const W = 595.28, H = 841.89
const TREN = 20.25, DAY = 812          // vùng nội dung (bản cổng cắt hàng / sang trang ở 812)
const CO = 10, DONG_BANG = 11.8, LECH_CHU = 8.78, HANG_1 = 18.64, NET = 0.62
const CHUA = 5.7                       // chừa khi ngắt chữ trong ô (như mẫu bản mới)

// kho: khổ trang (mặc định A4 đứng); day: đáy vùng nội dung — trang ẢO khổ rộng của phụ lục 03-3A dùng khổ khác rồi thu nhỏ
export function taoBieu({ pdf, C, mau, veChuKy, kho = [W, H], day = DAY }) {
  const HT = kho[1]
  const ds = []
  let trang = null
  const api = {
    C,
    y: TREN,
    get trang() { return trang },
    moTrang() { trang = pdf.addPage(kho); ds.push(trang); api.y = TREN; return trang },
    ke(x0, y0, x1, y1, mauNet = mau.VIEN_TRONG) { trang.drawLine({ start: { x: x0, y: HT - y0 }, end: { x: x1, y: HT - y1 }, thickness: NET, color: mauNet }) },
    // chữ một dòng tại (x, chân chữ y) — canh 'trai' | 'giua' (x = tâm) | 'phai' (x = mép phải)
    ve(doan, x, y, canh = 'trai', co = CO) {
      if (canh === 'giua') C.veGiua(trang, doan, x, y, co)
      else if (canh === 'phai') C.vePhai(trang, doan, x, y, co)
      else C.ve(trang, doan, x, y, co)
    },
    // đoạn văn nhiều dòng: ngắt ở `rong`, dòng cách `buoc`; trả chân chữ dòng cuối
    doan(doan, x, y, rong, { canh = 'trai', buoc = DONG_BANG, co = CO, html = true } = {}) {
      const dong = C.ngat(doan, rong, co, { html })
      dong.forEach((dd, j) => api.ve(dd, x, y + j * buoc, canh, co))
      return y + (dong.length - 1) * buoc
    },
    caoHang: n => (n <= 1 ? HANG_1 : 6.85 + n * DONG_BANG),
    // Bảng: cot = mép các cột; hangs = [[{ c, n?, doan: [[đoạn…]] | chuỗi, k?, canh? }]] (mỗi hàng một mảng ô).
    // Hàng cao theo ô nhiều dòng nhất; hết trang (đáy 812) thì kẻ viền ngoài, sang trang, vẽ tiếp — không lặp tiêu đề.
    bang(cot, hangs, { vienNgoai = mau.VIEN_NGOAI, dem = 3.3 } = {}) {
      let dau = api.y
      const ngoai = yC => { const a = cot[0], b = cot[cot.length - 1]; api.ke(a, dau, b, dau, vienNgoai); api.ke(a, dau, a, yC, vienNgoai); api.ke(b, dau, b, yC, vienNgoai); api.ke(a, yC, b, yC, vienNgoai) }
      for (const h of hangs) {
        const o = h.map(c => {
          const xa = cot[c.c], xb = cot[c.c + (c.n || 1)]
          const doan = c.doan == null || c.doan === '' ? [] : typeof c.doan === 'string' ? [[{ t: c.doan, k: c.k || 'thuong' }]] : c.doan
          return { ...c, xa, xb, dong: doan.flatMap(dd => C.ngat(dd, xb - xa - CHUA, CO, { html: true })) }
        })
        const cao = api.caoHang(Math.max(1, ...o.map(c => c.dong.length)))
        if (api.y + cao > day) { ngoai(api.y); api.moTrang(); dau = api.y }
        for (const c of o) {
          api.ke(c.xa, api.y, c.xb, api.y); api.ke(c.xa, api.y + cao, c.xb, api.y + cao); api.ke(c.xa, api.y, c.xa, api.y + cao); api.ke(c.xb, api.y, c.xb, api.y + cao)
          const y0 = api.y + (cao - c.dong.length * DONG_BANG) / 2
          c.dong.forEach((dd, j) => {
            const yy = y0 + LECH_CHU + j * DONG_BANG
            if (c.canh === 'giua') C.veGiua(trang, dd, (c.xa + c.xb) / 2, yy)
            else if (c.canh === 'phai') C.vePhai(trang, dd, c.xb - dem, yy)
            else C.ve(trang, dd, c.xa + dem, yy)
          })
        }
        api.y += cao
      }
      ngoai(api.y)
    },
    // Ô "Mẫu số" bên phải: các dòng đã dựng sẵn [{ doan, co }], khung từ yTren tới chân dòng cuối + 3
    hopMauSo(x0, x1, yTren, dong, buoc) {
      let y = yTren + 10.9
      dong.forEach((dd, j) => { if (j) y += buoc; C.veGiua(trang, dd.doan, (x0 + x1) / 2, y, dd.co || CO) })
      trang.drawRectangle({ x: x0, y: HT - (y + 4), width: x1 - x0, height: y + 4 - yTren, borderColor: mau.VIEN_HOP, borderWidth: NET })
      return y
    },
    chuKyXanh(yDong1) { if (veChuKy) return veChuKy(trang, yDong1) },
    ketThuc() { C.soTrang(ds) },
  }
  return api
}

export const BIEU = { W, H, TREN, DAY, CO, DONG_BANG, HANG_1 }
