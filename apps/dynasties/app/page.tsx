import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { Realm } from "@/components/Realm";
import { type DynastiesData, buildDynasties } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("dynasties");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<DynastiesData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildDynasties(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <Realm data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
