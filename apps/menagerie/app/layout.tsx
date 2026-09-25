import type { Metadata, Viewport } from "next";
import { appUrl } from "@longitude/kit";
import { Caveat, Courier_Prime, Crimson_Pro } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

/** A naturalist's hand for headings, a humanist serif for the notes, a typewriter for addresses and figures. */
const body = Crimson_Pro({ subsets: ["latin"], variable: "--font-body", style: ["normal", "italic"] });
const display = Caveat({ subsets: ["latin"], variable: "--font-display" });
const mono = Courier_Prime({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "700"] });

/** A blank NEXT_PUBLIC_APP_URL_TEMPLATE in the environment yields an empty string; the build must not die on it. */
const metadataBase = (() => {
  try {
    return new URL(appUrl("menagerie"));
  } catch {
    return undefined;
  }
})();

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  openGraph: { images: ["/og"] },
  twitter: { card: "summary_large_image", images: ["/og"] },
  title: "MENAGERIE · LONGITUDE",
  description: "A field guide to the species of smart money. Nansen's smart money wallets sorted into species by how they behave.",
};

export const viewport: Viewport = { themeColor: "#efe6cf", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
