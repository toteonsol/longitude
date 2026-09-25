import { ImageResponse } from "next/og";
import { APP_BY_ID, type AppId } from "./apps";
import { worldArt } from "./og-art";

export const OG_SIZE = { width: 1200, height: 630 };

export interface ShareCardInput {
  app: AppId;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
  footer?: string;
}

/** Renders the share image for an app. Used by `app/og/route.tsx` in every app. */
export function shareCard(input: ShareCardInput): ImageResponse {
  const app = APP_BY_ID[input.app];
  const p = app.palette;
  const accent = p.accent.toLowerCase() === p.ink.toLowerCase() ? p.accent2 : p.accent;
  const stats = (input.stats ?? []).slice(0, 4);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: `linear-gradient(135deg, ${p.bg} 0%, ${p.surface} 100%)`,
          color: p.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, letterSpacing: 6, opacity: 0.8 }}>
          <span>LONGITUDE / {app.name.toUpperCase()}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: accent, boxShadow: `0 0 24px ${accent}` }} />
            POWERED BY NANSEN
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 720 }}>
            <div style={{ fontSize: input.title.length > 40 ? 52 : 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{input.title}</div>
            {input.subtitle ? <div style={{ fontSize: 28, opacity: 0.85, lineHeight: 1.3 }}>{input.subtitle}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 300, height: 300, borderRadius: 150, background: `radial-gradient(circle at 50% 50%, ${accent}33 0%, transparent 70%)` }}>
            {worldArt(app.id, accent, p.ink, 260)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 40 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 40, fontWeight: 700, color: accent }}>{s.value}</span>
                <span style={{ fontSize: 18, letterSpacing: 3, opacity: 0.7 }}>{s.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 20, opacity: 0.7, maxWidth: 520, textAlign: "right" }}>{input.footer ?? (input.subtitle === app.tagline ? app.world : app.tagline)}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/**
 * `export const { GET } = createOgRoute("rewind")` in `app/og/route.tsx`. Query params:
 * title, subtitle, footer, and up to four `s=Label:Value` pairs.
 */
export function createOgRoute(app: AppId) {
  async function GET(req: Request): Promise<Response> {
    const q = new URL(req.url).searchParams;
    const meta = APP_BY_ID[app];
    const stats = q
      .getAll("s")
      .map((s) => {
        const i = s.indexOf(":");
        return i > 0 ? { label: s.slice(0, i).slice(0, 24), value: s.slice(i + 1).slice(0, 16) } : null;
      })
      .filter((s): s is { label: string; value: string } => s !== null);
    return shareCard({
      app,
      title: (q.get("title") ?? meta.name).slice(0, 90),
      subtitle: (q.get("subtitle") ?? meta.tagline).slice(0, 160),
      footer: q.get("footer")?.slice(0, 80),
      stats,
    });
  }
  return { GET };
}
