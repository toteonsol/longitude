import type { Metadata, Viewport } from "next";
import { appUrl } from "@longitude/kit";
import { Bodoni_Moda, DM_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display", style: ["normal", "italic"] });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl("two-faced")),
  openGraph: { images: ["/og"] },
  twitter: { card: "summary_large_image", images: ["/og"] },
  title: "Two-Faced · LONGITUDE",
  description: "Every wallet wears two masks. Drag the slider to morph a smart money wallet's spot face into its perp face.",
};

export const viewport: Viewport = { themeColor: "#14141a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
