import { appUrl, storeUrl } from "@longitude/kit";
import { shortAddress } from "@longitude/nansen";
import type { Metadata } from "next";
import { WalletLens } from "@/components/WalletLens";
import { walletSuggestions } from "@/lib/suggestions";
import { readWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ address: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const short = shortAddress(decodeURIComponent(address), 4);
  const og = `/og?title=${encodeURIComponent(`${short} across ten meridians`)}&subtitle=${encodeURIComponent("One wallet read through Nansen's smart money, perps, holdings, kin and exits")}`;
  const title = `${short} · LONGITUDE wallet lens`;
  return { metadataBase: new URL(storeUrl()), title, openGraph: { title, images: [og] }, twitter: { card: "summary_large_image", title, images: [og] } };
}

export default async function WalletPage({ params, searchParams }: Props) {
  const { address } = await params;
  const q = await searchParams;
  const [lens, suggestions] = await Promise.all([
    readWallet(decodeURIComponent(address), typeof q.chain === "string" ? q.chain : undefined),
    walletSuggestions().catch(() => []),
  ]);
  const current = decodeURIComponent(address).toLowerCase();
  return (
    <WalletLens
      lens={lens}
      scoutUrl={`${appUrl("rookie-scout")}/scout/${encodeURIComponent(decodeURIComponent(address))}`}
      suggestions={suggestions.filter((s) => s.address.toLowerCase() !== current)}
    />
  );
}
