import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { FrontPage } from "@/components/FrontPage";
import { type WalletObituariesData, buildWalletObituaries } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("wallet-obituaries");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<WalletObituariesData>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => buildWalletObituaries(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <FrontPage data={data} /> : <Missing app={app} />}
    </AppFrame>
  );
}
