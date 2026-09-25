import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { Deck } from "@/components/Deck";
import { type RewindData, buildRewind } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("rewind");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<RewindData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildRewind(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <Deck data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
