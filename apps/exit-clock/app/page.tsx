import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { ExitClock } from "@/components/ExitClock";
import { type ExitClockData, buildExitClock } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("exit-clock");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<ExitClockData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildExitClock(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <ExitClock data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
