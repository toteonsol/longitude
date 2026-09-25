import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { ExitClock } from "@/components/ExitClock";
import { type ExitClockData, buildExitClock } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("exit-clock");

/** Prefilled text for the frame's share button: what the clock says at this snapshot. */
function shareText(d: ExitClockData): string {
  const hands = d.tokens.reduce((s, t) => s + t.holders.length, 0);
  const overdue = d.tokens.reduce((s, t) => s + t.overdueCount, 0);
  const symbols = d.tokens.map((t) => `$${t.symbol}`).join(", ");
  return `Exit Clock: ${hands} smart money hands on ${symbols}, ${overdue} already past their usual exit · LONGITUDE, built on @nansen_ai`;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<ExitClockData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildExitClock(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error} share={data && data.tokens.length ? { text: shareText(data) } : undefined}>
      {data ? <ExitClock data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
