import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MemoProvider } from "@/components/MemoProvider";
import { Sidebar } from "@/components/Sidebar";
import { asset } from "@/lib/demo";

export const metadata: Metadata = {
  title: { default: "Gist", template: "%s · Gist" },
  description: "유튜브 링크, 책 제목, 사진을 넣으면 핵심이 강조된 요약 메모가 됩니다. The gist of what you watch and read.",
  manifest: asset("/manifest.webmanifest"),
  appleWebApp: { capable: true, title: "Gist", statusBarStyle: "default" },
  icons: { apple: asset("/icons/apple-touch-icon.png") },
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
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
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
