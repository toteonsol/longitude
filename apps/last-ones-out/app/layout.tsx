import type { Metadata, Viewport } from "next";
import { Big_Shoulders, JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const display = Big_Shoulders({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "800"], adjustFontFallback: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Last Ones Out · LONGITUDE",
  description: "Smart money left. Someone's still home. A night skyline of the tokens retail still holds while Nansen's smart money walks out.",
};

export const viewport: Viewport = { themeColor: "#060a1a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
