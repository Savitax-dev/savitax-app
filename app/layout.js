import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "App Savitax",
  description: "Hệ thống nội bộ Savitax",
  // Chặn Chrome/Edge tự dịch trang. Trang khai lang="en" trong khi nội dung là tiếng Việt ->
  // trình duyệt tưởng là tiếng Anh và tự "dịch sang tiếng Việt", làm TÊN CÔNG TY hiện sai hẳn
  // (ca thật 23/09/2026: "CÔNG TY TNHH MỘT THÀNH VIÊN TEN NOODLES" hiện thành "CÔNG TY ĐỊNH CƯ
  // MỘT THÀNH VIÊN MÌ", nhãn "Địa chỉ Thuế" thành "Thuế chỉ"). Dữ liệu trong database vẫn đúng,
  // chỉ chữ trên màn hình bị thay — rất dễ tưởng là dữ liệu hỏng.
  other: { google: "notranslate" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      translate="no"
      className={`notranslate ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
