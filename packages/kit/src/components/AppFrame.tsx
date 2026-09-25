import type { ReactNode } from "react";
import type { AppMeta } from "../apps";
import type { DataSource } from "../load";
import { ProRefresh } from "../pro/client";
import { Passport, PresenceBadge, ShareButton, SocialBoot } from "../social/client";
import { storeUrl } from "../urls";
import { DataBadge } from "./DataBadge";
import { Explainer } from "./Explainer";
import { RefreshLive } from "./RefreshLive";

interface Props {
  app: AppMeta;
  source: DataSource;
  error?: string;
  /** Hide the refresh button for apps without a live path. */
  noLive?: boolean;
  /** Extra header content (e.g. a token picker). */
  controls?: ReactNode;
  /** Prefilled share text; defaults to the app's tagline. */
  share?: { text: string; url?: string };
  children: ReactNode;
}

/**
 * Shared chrome: wordmark back to the store, app name, explainer, data badge, refresh-live,
 * presence, share, passport. Everything inside is the app's own world.
 */
export function AppFrame({ app, source, error, noLive, controls, share, children }: Props) {
  const shareText = share?.text ?? `${app.name}: ${app.tagline} · LONGITUDE, built on @nansen_ai`;
  return (
    <div className="lg-frame" data-app={app.id}>
      <SocialBoot app={app} />
      <header className="lg-frame__header">
        <div className="lg-frame__left">
          <a className="lg-wordmark" href={storeUrl()} title="Back to LONGITUDE">
            <span className="lg-wordmark__globe" aria-hidden="true" />
            LONGITUDE
          </a>
          <span className="lg-frame__sep" aria-hidden="true">
            /
          </span>
          <h1 className="lg-frame__title">{app.name}</h1>
          <PresenceBadge />
        </div>
        <div className="lg-frame__right">
          {controls}
          <DataBadge source={source} error={error} />
          <RefreshLive source={source} disabled={noLive} />
          {noLive ? null : <ProRefresh appName={app.name} />}
          <ShareButton text={shareText} url={share?.url} />
        </div>
      </header>
      <Explainer app={app} />
      <main className="lg-frame__main">{children}</main>
      <footer className="lg-frame__footer">
        <Passport />
        <span className="lg-frame__footline">
          <span>Powered by Nansen</span>
          <span className="lg-frame__sep" aria-hidden="true">
            ·
          </span>
          <a href={storeUrl()}>Back to the globe</a>
        </span>
      </footer>
    </div>
  );
}
