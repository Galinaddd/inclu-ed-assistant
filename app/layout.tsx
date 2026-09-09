import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AuthRedirectProvider from "./components/AuthRedirectProvider";
import Header from "./components/Header"; // 🌟 Імпортуємо шапку сюди

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className={`${jakarta.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-[#FAF9F6]">
        <AuthRedirectProvider>
          {/* 🌟 ВСТАВЛЯЄМО ШАПКУ В ЛЕЙАУТ: тепер вона головна на всьому сайті */}
          <Header />
          {children}
        </AuthRedirectProvider>
      </body>
    </html>
  );
}
