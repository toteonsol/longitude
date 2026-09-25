import type { Metadata } from "next";
import { AppFrame, appUrl, getApp } from "@longitude/kit";
import { readSnapshot } from "@longitude/kit/server";
import { shortAddress } from "@longitude/nansen";
import { ScoutReport } from "@/components/ScoutReport";
import type { RookieScoutData } from "@/lib/data";
import { DEFAULT_MEDIANS, scoutWallet } from "@/lib/scout";

export const dynamic = "force-dynamic";

const app = getApp("rookie-scout");

/** Share image with the score: the lookup is cached for five minutes, so this costs no extra credits. */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ address: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { address } = await params;
  const q = await searchParams;
  const chain = typeof q.chain === "string" ? q.chain : undefined;
  const snap = await readSnapshot<RookieScoutData>("rookie-scout");
  const result = await scoutWallet(decodeURIComponent(address).trim(), chain, snap?.data.cohort.medians ?? DEFAULT_MEDIANS);
  const short = shortAddress(decodeURIComponent(address).trim(), 4);
  const og = new URL("/og", appUrl("rookie-scout"));
  og.searchParams.set("title", `Scouted ${short}`);
  if ("error" in result) og.searchParams.set("subtitle", "No tape on this wallet yet");
  else {
    og.searchParams.set("subtitle", `${result.similarity}/100 similarity to smart money · ${result.verdict}`);
    og.searchParams.append("s", `Grade:${result.grade}`);
    og.searchParams.append("s", `Win rate:${result.stats.winRate.toFixed(0)}%`);
    og.searchParams.append("s", `Exits:${result.stats.trades}`);
  }
  const title = `Scouting report: ${short} · Rookie Scout`;
  return { title, openGraph: { title, images: [og.pathname + og.search] }, twitter: { card: "summary_large_image", title, images: [og.pathname + og.search] } };
}

export default async function ScoutPage({ params, searchParams }: { params: Promise<{ address: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { address } = await params;
  const q = await searchParams;
  const chain = typeof q.chain === "string" ? q.chain : undefined;
  const snap = await readSnapshot<RookieScoutData>("rookie-scout");
  const medians = snap?.data.cohort.medians ?? DEFAULT_MEDIANS;
  const result = await scoutWallet(decodeURIComponent(address).trim(), chain, medians);
  const ok = !("error" in result);
  const share = ok
    ? { text: `I scouted ${shortAddress(result.address)} on Rookie Scout: ${result.similarity}/100 similarity to smart money, grade ${result.grade}. Built on @nansen_ai`, url: undefined }
    : undefined;
  return (
    <AppFrame app={app} source={ok ? { kind: "live", fetchedAt: result.fetchedAt, credits: result.credits } : { kind: "missing" }} noLive share={share}>
      <ScoutReport result={result} medians={medians} cohortSize={snap?.data.cohort.size ?? 0} />
    </AppFrame>
  );
}
