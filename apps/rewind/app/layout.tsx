import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk, VT323 } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });
const display = VT323({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Rewind · LONGITUDE",
  description: "Go back. Make the call. Press play. Scrub to a real past date, pick what smart money was right about, and watch the 30 days roll.",
};

export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
