import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const font = Public_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "AIvida - Clinical Portal",
  description: "AIvida Clinical Portal & Telehealth Practice Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
