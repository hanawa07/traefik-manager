import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/shared/components/QueryProvider";

export const metadata: Metadata = {
  title: "Traefik Manager",
  description: "Traefik + Authentik 통합 관리",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: { url: "/apple-touch-icon.png" },
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Traefik Manager",
    description: "Traefik + Authentik 통합 관리",
    images: [{ url: "/logo.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
