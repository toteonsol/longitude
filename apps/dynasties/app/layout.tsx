import type { Metadata, Viewport } from "next";
import { appUrl } from "@longitude/kit";
import { Cinzel, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const display = Cinzel({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700"] });
const body = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"], style: ["normal", "italic"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl("dynasties")),
  openGraph: { images: ["/og"] },
  twitter: { card: "summary_large_image", images: ["/og"] },
  title: "Dynasties · LONGITUDE",
  description: "Every wallet has a bloodline. The great houses of smart money, their founders and their kin, drawn as a roll of arms.",
};

export const viewport: Viewport = { themeColor: "#0d1b3d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
