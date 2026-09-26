import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한장영어",
  description: "하루 8분, 영어 한 장",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffbeb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
