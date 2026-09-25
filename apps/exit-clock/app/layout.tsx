import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Archivo({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });
const display = Archivo_Black({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Exit Clock · LONGITUDE",
  description: "Every holder is a hand. Every hand is counting down. Smart money holders of the week's hottest tokens, timed to their usual exit.",
};

export const viewport: Viewport = { themeColor: "#3b3b38", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
