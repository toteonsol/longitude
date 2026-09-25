import type { Metadata, Viewport } from "next";
import { appUrl } from "@longitude/kit";
import { Barlow, Bebas_Neue, Courier_Prime } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Barlow({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const display = Bebas_Neue({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const mono = Courier_Prime({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl("odds-vs-flow")),
  openGraph: { images: ["/og"] },
  twitter: { card: "summary_large_image", images: ["/og"] },
  title: "Odds vs Flow · LONGITUDE",
  description: "The crowd bets. Smart money moves. Who's pulling harder? Polymarket odds against Nansen smart money flow, one tug of war per asset.",
};

export const viewport: Viewport = { themeColor: "#fbf6e3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
