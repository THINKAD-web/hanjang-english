import type { Metadata, Viewport } from "next";
import { BRAND, BRAND_DESCRIPTION } from "@/lib/brand";
import { AudienceSkin } from "@/components/audience-skin";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.appName, template: "%s" },
  description: BRAND_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffbeb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" data-audience="kid" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AudienceSkin />
        {children}
      </body>
    </html>
  );
}
