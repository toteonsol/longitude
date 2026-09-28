import { readSnapshot } from "@longitude/kit/server";
import { shortAddress } from "@longitude/nansen";

/** A wallet to try in the lens, picked from another app's current data so it changes with each daily refresh. */
export interface WalletSuggestion {
  address: string;
  /** Only set when the lens should start on a chain other than Ethereum. */
  chain?: "base" | "solana";
  /** Short hook, e.g. "The month's top trader". */
  title: string;
  /** Where it comes from, e.g. "Dynasties · House Greyaward". */
  source: string;
}

// Just the fields read here; each app's lib/data.ts has the full shape.
type Dynasties = { chain?: string; houses?: { name?: string; patriarch?: { address?: string; label?: string } }[] };
type RookieScout = { prospects?: { address?: string; chain?: string; similarity?: number }[] };
type TwoFaced = { wallets?: { address?: string; label?: string }[] };
type Soap = { cast?: { address?: string; chain?: string; character?: { name?: string; archetype?: string } }[] };

/** Used only if no snapshot can be read: the top Dynasties house on 2026-09-26, which fills every lens card. */
const FALLBACK: WalletSuggestion[] = [
  { address: "0x46a83dc1a264bff133db887023d2884167094837", title: "A top smart money trader", source: "Dynasties · Token Millionaire" },
];

const lensChain = (chain?: string): WalletSuggestion["chain"] => (chain === "base" || chain === "solana" ? chain : undefined);

/** Up to four wallets from Dynasties, Rookie Scout, Two-Faced and As The Chain Turns. Reads snapshots only: no Nansen calls. */
export async function walletSuggestions(): Promise<WalletSuggestion[]> {
  const [dynasties, rookie, twoFaced, soap] = await Promise.all([
    readSnapshot<Dynasties>("dynasties").catch(() => undefined),
    readSnapshot<RookieScout>("rookie-scout").catch(() => undefined),
    readSnapshot<TwoFaced>("two-faced").catch(() => undefined),
    readSnapshot<Soap>("as-the-chain-turns").catch(() => undefined),
  ]);
  const out: WalletSuggestion[] = [];

  const house = dynasties?.data.houses?.[0];
  if (house?.patriarch?.address) {
    out.push({
      address: house.patriarch.address,
      chain: lensChain(dynasties?.data.chain),
      title: "The month's top trader",
      source: `Dynasties · House ${house.name ?? "of the month"}`,
    });
  }

  const prospect = [...(rookie?.data.prospects ?? [])].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))[0];
  if (prospect?.address) {
    out.push({
      address: prospect.address,
      chain: lensChain(prospect.chain),
      title: "Smart money in the making",
      source: `Rookie Scout · ${prospect.similarity ?? "?"}/100 similarity`,
    });
  }

  const face = twoFaced?.data.wallets?.[0];
  if (face?.address) {
    const label = (face.label ?? "").replace(/\*+$/, "").trim();
    out.push({ address: face.address, title: "A leveraged perps trader", source: `Two-Faced · ${label || shortAddress(face.address)}` });
  }

  const cast = soap?.data.cast ?? [];
  const villain = cast.find((c) => /villain/i.test(c.character?.archetype ?? "")) ?? cast[0];
  if (villain?.address) {
    out.push({
      address: villain.address,
      chain: lensChain(villain.chain),
      title: /villain/i.test(villain.character?.archetype ?? "") ? "Tonight's villain" : "Tonight's lead",
      source: `As The Chain Turns · ${villain.character?.name ?? "the cast"}`,
    });
  }

  const seen = new Set<string>();
  const unique = out.filter((s) => {
    const key = s.address.startsWith("0x") ? s.address.toLowerCase() : s.address;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : FALLBACK;
}
