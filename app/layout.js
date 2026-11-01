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

// Ảnh xem trước khi gửi link (Zalo, Messenger, Facebook…): logo ngang 1200×630 nền trắng (anh gửi 31/10/2026).
// Không khai thì Zalo lấy biểu tượng vuông app/icon.png rồi cắt ngang → logo bị phóng to, mất chữ.
const OG_ANH = { url: "/og-savitax.png", width: 1200, height: 630, alt: "Savitax — Nâng giá trị - Đón thành công" };

// Bản demo (demo.savitax.vn, NEXT_PUBLIC_DEMO_MODE=1): đổi tên trang + ảnh xem trước, hiện nhãn "Bản demo" góc màn hình.
const LA_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const TEN = LA_DEMO ? "App Savitax — Bản demo" : "App Savitax";
const MO_TA = LA_DEMO ? "Bản trải nghiệm hệ thống quản lý dịch vụ kế toán – thuế Savitax (dữ liệu mẫu)" : "Hệ thống nội bộ Savitax";

export const metadata = {
  metadataBase: new URL(LA_DEMO ? "https://demo.savitax.vn" : "https://app.savitax.vn"),
  title: TEN,
  description: MO_TA,
  openGraph: {
    type: "website", url: "/", siteName: TEN, locale: "vi_VN",
    title: TEN, description: MO_TA, images: [OG_ANH],
  },
  twitter: { card: "summary_large_image", title: TEN, description: MO_TA, images: [OG_ANH.url] },
  // Chặn Chrome/Edge tự dịch trang. Trang khai lang="en" trong khi nội dung là tiếng Việt ->
  // trình duyệt tưởng là tiếng Anh và tự "dịch sang tiếng Việt", làm TÊN CÔNG TY hiện sai hẳn
  // (ca thật 23/09/2026: "CÔNG TY TNHH MỘT THÀNH VIÊN TEN NOODLES" hiện thành "CÔNG TY ĐỊNH CƯ
  // MỘT THÀNH VIÊN MÌ", nhãn "Địa chỉ Thuế" thành "Thuế chỉ"). Dữ liệu trong database vẫn đúng,
  // chỉ chữ trên màn hình bị thay — rất dễ tưởng là dữ liệu hỏng.
  other: { google: "notranslate" },
};

// Thẻ <meta name="color-scheme" content="only light">: app không theo chế độ tối của máy / Chrome (xem globals.css).
export const viewport = { colorScheme: "only light" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      translate="no"
      className={`notranslate ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {LA_DEMO && (
          <div className="fixed bottom-3 right-3 z-[9999] pointer-events-none select-none rounded-full bg-amber-500/95 text-white text-xs font-semibold px-3 py-1.5 shadow-lg" title="Dữ liệu mẫu, tự làm mới mỗi đêm">
            BẢN DEMO · dữ liệu mẫu · tự làm mới lúc 2h sáng
          </div>
        )}
      </body>
    </html>
  );
}
