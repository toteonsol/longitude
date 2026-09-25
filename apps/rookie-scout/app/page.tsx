import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { DraftBoard } from "@/components/DraftBoard";
import { type RookieScoutData, buildRookieScout } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("rookie-scout");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<RookieScoutData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildRookieScout(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <DraftBoard data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
