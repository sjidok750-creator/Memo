import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MemoProvider } from "@/components/MemoProvider";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: { default: "나만의 메모장", template: "%s · 나만의 메모장" },
  description: "유튜브 링크, 책 제목, 사진을 넣으면 핵심이 강조된 요약 메모가 됩니다.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#191816" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap" />
      </head>
      <body>
        <MemoProvider>
          <div className="shell">
            <Sidebar />
            <main className="main">{children}</main>
          </div>
        </MemoProvider>
      </body>
    </html>
  );
}
