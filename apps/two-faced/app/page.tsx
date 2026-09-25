import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { TwoFaced } from "@/components/TwoFaced";
import { type TwoFacedData, buildTwoFaced } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("two-faced");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<TwoFacedData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildTwoFaced(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <TwoFaced data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
