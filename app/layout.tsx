import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empatify Social Checker",
  description: "Track Empatify social media performance across YouTube, TikTok, Facebook, and Instagram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
