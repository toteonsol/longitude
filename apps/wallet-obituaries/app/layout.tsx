import type { Metadata, Viewport } from "next";
import { Courier_Prime, Libre_Baskerville, Playfair_Display, UnifrakturCook } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

/** Body copy: a Baskerville, the newspaper text face. */
const body = Libre_Baskerville({ subsets: ["latin"], variable: "--font-body", weight: ["400", "700"], style: ["normal", "italic"] });
/** Headlines and decks. */
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display", weight: ["400", "700", "900"], style: ["normal", "italic"] });
/** Addresses, hashes, the ears of the masthead: wire-service type. */
const mono = Courier_Prime({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "700"] });
/** The nameplate only. */
const masthead = UnifrakturCook({ subsets: ["latin"], variable: "--font-masthead", weight: "700" });

export const metadata: Metadata = {
  title: "Wallet Obituaries · LONGITUDE",
  description: "In memoriam: the wallets that sold it all. A daily front page of smart money exits, typeset from Nansen data.",
};

export const viewport: Viewport = { themeColor: "#e9dcc3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable} ${masthead.variable}`}>
      <body>{children}</body>
    </html>
  );
}
