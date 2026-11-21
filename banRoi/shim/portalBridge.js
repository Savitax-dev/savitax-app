// Bản rời — thay lib/portalBridge.js (cầu nối tiện ích Chrome). File mở bằng file:// không nói chuyện được với tiện ích
// (externally_connectable chỉ nhận trang http/https), nên mọi chức năng cần tiện ích (Tra chính xác ở Tra cứu NCC) tự ẩn.
// Bản gốc còn đọc process.env lúc nạp — trong file HTML không có `process`, để nguyên sẽ làm hỏng cả trang.
const KHONG = { ok: false, loi: 'Bản chạy riêng trên máy không dùng tiện ích Chrome' }
export async function kiemTraTienIch() { return { co: false, loi: KHONG.loi } }
export async function donPhienCu() { return KHONG }
export async function moPhien() { return KHONG }
export async function dongPhien() { return KHONG }
export async function goiCong() { return KHONG }
