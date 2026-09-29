/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // reactCompiler: true, // Disabled — causes Turbopack SyntaxError with Next.js 16

  // Chạy `next build` trong lúc `next dev` đang chạy thì HAI BÊN CÙNG GHI VÀO .next và làm hỏng
  // bảng định tuyến của dev: toàn bộ /api/admin/tokhai/* trả 404 kèm trang HTML, trình duyệt đem
  // HTML đi JSON.parse nên màn hình báo `Unexpected token '<'`. Dính ngày 29/09/2026, phải xoá
  // sạch .next mới chạy lại được.
  //
  // Nay build để kiểm thì cho ra thư mục khác:
  //   NEXT_DIST_DIR=node_modules/.cache/next-build npx next build
  // Đặt trong node_modules cho khỏi phải sửa .gitignore. Không đặt biến thì vẫn là .next như cũ,
  // nên Vercel không ảnh hưởng gì.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Đảm bảo file template Word (đọc bằng readFileSync ngoài public/) được đóng gói
  // vào serverless function khi deploy Vercel — file-tracing tự động không nhận diện
  // được path động join(process.cwd(), 'templates', ...).
  outputFileTracingIncludes: {
    '/api/admin/contract': ['./templates/**'],
  },
};

export default nextConfig;
