import type { Metadata, Viewport } from "next";
import { DM_Sans, Great_Vibes, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const display = Great_Vibes({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "As The Chain Turns · LONGITUDE",
  description: "The last 24 hours of smart money trading, told as a daytime soap. Real wallets, real trades, dramatic zooms.",
};

export const viewport: Viewport = { themeColor: "#ffd6e0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
