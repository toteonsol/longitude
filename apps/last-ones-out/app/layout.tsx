import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const display = Inter({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Last Ones Out · LONGITUDE",
  description: "A Nansen-powered app from the LONGITUDE store.",
};

export const viewport: Viewport = { themeColor: "#060a1a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
