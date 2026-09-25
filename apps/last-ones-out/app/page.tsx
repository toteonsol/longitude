import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { type LastOnesOutData, buildLastOnesOut } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("last-ones-out");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<LastOnesOutData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildLastOnesOut(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <pre>{JSON.stringify(data, null, 2).slice(0, 2000)}</pre> : <Missing app={app} />}
    </AppFrame>
  );
}
