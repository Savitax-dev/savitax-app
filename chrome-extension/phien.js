// Phiên ảo + giữ nhịp gọi cổng — tiện ích "Savitax — Cầu nối cổng thuế".
//
// VẤN ĐỀ: cổng thuế khoá mỗi tài khoản vào MỘT phiên, mà trình duyệt chỉ giữ MỘT bộ cookie cho
// một tên miền. Vì vậy bản đầu phải xoá sạch cookie trước mỗi công ty, và hệ quả là nhân viên
// phải ngồi chờ công ty này tải xong mới gõ được mã cho công ty sau.
//
// CÁCH LÀM: tiện ích tự giữ nhiều "phiên ảo". Trước mỗi lượt gọi, nó xoá cookie cổng rồi nạp đúng
// bộ cookie của phiên đang cần; gọi xong thì đọc cookie ra cất lại vào phiên đó. Nhờ vậy nhiều
// công ty cùng sống song song, dù trình duyệt vẫn chỉ có một bộ cookie tại mỗi thời điểm.
//
// ⚠ ĐIỀU KIỆN SỐNG CÒN: mọi lượt gọi phải đi qua MỘT HÀNG ĐỢI, mỗi lúc chỉ một lượt. Hai lượt
// chồng nhau là cookie của hai công ty trộn vào nhau — lúc đó app sẽ tải hồ sơ công ty này ghi vào
// thư mục công ty kia mà không báo lỗi gì. Đó là lý do taoHangDoi() bên dưới tồn tại.
//
// ⚠ NHỊP GỌI: hàng đợi cũng giữ luôn khoảng cách tối thiểu giữa hai lượt gọi. Chạy nhiều công ty
// cùng lúc mà mỗi công ty tự giãn nhịp riêng thì cổng vẫn nhận gấp đôi số lượt — đúng thứ anh
// dặn phải tránh. Giữ nhịp ở đây là chặn tại cửa cuối, không phụ thuộc web app tự giác.

export const MIEN_CONG = ['dichvucong.gdt.gov.vn', 'thuedientu.gdt.gov.vn']

// Nhịp tối thiểu giữa hai lượt gọi cổng, tính từ lúc BẮT ĐẦU lượt trước. Web app xin chậm hơn thì
// được, xin nhanh hơn thì bị ép về mức này.
export const NHIP_SAN = 2200

const urlCuaCookie = c => (c.secure ? 'https://' : 'http://') + String(c.domain || '').replace(/^\./, '') + (c.path || '/')

// ── Đọc / xoá / nạp cookie của cổng ─────────────────────────────────────────

export async function docCookieCong(cookies, mien = MIEN_CONG) {
  const ra = []
  for (const domain of mien) {
    for (const c of await cookies.getAll({ domain })) {
      ra.push({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        hostOnly: c.hostOnly, expirationDate: c.expirationDate,
        storeId: c.storeId,
      })
    }
  }
  return ra
}

export async function xoaCookieCong(cookies, mien = MIEN_CONG) {
  let daXoa = 0
  for (const domain of mien) {
    for (const c of await cookies.getAll({ domain })) {
      try { await cookies.remove({ url: urlCuaCookie(c), name: c.name }); daXoa++ } catch { /* bỏ qua */ }
    }
  }
  return daXoa
}

export async function datCookieCong(cookies, ds) {
  let daDat = 0
  for (const c of ds || []) {
    const dat = {
      url: urlCuaCookie(c),
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
    }
    // Cookie gắn với ĐÚNG một máy chủ (hostOnly) thì KHÔNG được truyền domain — truyền vào là
    // Chrome biến nó thành cookie cho cả tên miền con, sai phạm vi so với bản gốc.
    if (!c.hostOnly && c.domain) dat.domain = c.domain
    if (c.expirationDate) dat.expirationDate = c.expirationDate
    if (c.storeId) dat.storeId = c.storeId
    try { await cookies.set(dat); daDat++ } catch { /* cookie hỏng thì bỏ, đừng làm chết cả lượt */ }
  }
  return daDat
}

// ── Kho phiên ───────────────────────────────────────────────────────────────
//
// Cất ở chrome.storage.session: chỉ nằm trong bộ nhớ, KHÔNG ghi ra đĩa, và tự mất khi đóng trình
// duyệt. Cookie phiên cổng thuế là thứ đăng nhập được vào tài khoản khách hàng nên tuyệt đối không
// để rơi xuống đĩa. Dùng chrome.storage thay vì biến toàn cục vì service worker của tiện ích bị
// Chrome tắt bất cứ lúc nào, biến toàn cục mất là đứt cả lượt tải đang chạy.

const khoa = id => 'phien:' + id

export function khoPhien(storage) {
  return {
    async doc(id) {
      const o = await storage.get(khoa(id))
      return o?.[khoa(id)] || null
    },
    async ghi(id, ds) {
      await storage.set({ [khoa(id)]: ds })
    },
    async xoa(id) {
      await storage.remove(khoa(id))
    },
  }
}

// ── Hàng đợi: mỗi lúc một lượt, và giữ nhịp ─────────────────────────────────

export function taoHangDoi({
  nhipSan = NHIP_SAN,
  nghi = ms => new Promise(r => setTimeout(r, ms)),
  bayGio = () => Date.now(),
} = {}) {
  let batDauLuotTruoc = 0
  // Cờ riêng, KHÔNG dò bằng `batDauLuotTruoc > 0`: mốc thời gian 0 là giá trị hợp lệ, dò kiểu đó
  // thì lượt thứ hai bị tưởng là lượt đầu và được chạy ngay, mất nhịp giãn.
  let daChayLuotNao = false
  let chuoi = Promise.resolve()

  return function xepHang(viec, nhipXin = 0) {
    // Web app xin giãn lâu hơn thì nghe theo; xin nhanh hơn nhịp sàn thì ép về nhịp sàn.
    const nhip = Math.max(nhipSan, Number(nhipXin) || 0)
    const ketQua = chuoi.then(async () => {
      const cho = daChayLuotNao ? Math.max(0, batDauLuotTruoc + nhip - bayGio()) : 0
      if (cho > 0) await nghi(cho)
      daChayLuotNao = true
      batDauLuotTruoc = bayGio()
      return viec()
    })
    // Lượt sau chờ lượt này xong, kể cả khi lượt này lỗi — lỗi một lượt không được phá hàng đợi.
    chuoi = ketQua.then(() => {}, () => {})
    return ketQua
  }
}
