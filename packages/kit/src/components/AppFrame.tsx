import type { ReactNode } from "react";
import type { AppMeta } from "../apps";
import type { DataSource } from "../load";
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
  children: ReactNode;
}

/**
 * Shared chrome: wordmark back to the store, app name, explainer, data badge, refresh-live.
 * Everything inside is the app's own world. Style via the --lg-* variables in styles.css.
 */
export function AppFrame({ app, source, error, noLive, controls, children }: Props) {
  return (
    <div className="lg-frame" data-app={app.id}>
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
        </div>
        <div className="lg-frame__right">
          {controls}
          <DataBadge source={source} error={error} />
          <RefreshLive source={source} disabled={noLive} />
        </div>
      </header>
      <Explainer app={app} />
      <main className="lg-frame__main">{children}</main>
      <footer className="lg-frame__footer">
        <span>Powered by Nansen</span>
        <span className="lg-frame__sep" aria-hidden="true">
          ·
        </span>
        <a href={storeUrl()}>Back to the globe</a>
      </footer>
    </div>
  );
}
