import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { EpisodePlayer } from "@/components/EpisodePlayer";
import { type AsTheChainTurnsData, buildAsTheChainTurns } from "@/lib/data";
import { episodeShareText } from "@/lib/format";

export const dynamic = "force-dynamic";

const app = getApp("as-the-chain-turns");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<AsTheChainTurnsData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildAsTheChainTurns(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error} share={data ? { text: episodeShareText(data.episode) } : undefined}>
      {data ? <EpisodePlayer data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
