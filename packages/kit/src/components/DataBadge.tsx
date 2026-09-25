import type { DataSource } from "../load";

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "snapshot · 3h ago · 42 credits" or "live · 12 credits". Server-renderable. */
export function DataBadge({ source, error }: { source: DataSource; error?: string }) {
  if (source.kind === "missing") {
    return (
      <span className="lg-badge lg-badge--missing" title={error}>
        not seeded yet
      </span>
    );
  }
  if (source.kind === "live") {
    return (
      <span className="lg-badge lg-badge--live">
        live · {source.credits} credit{source.credits === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className={`lg-badge${source.sample ? " lg-badge--sample" : ""}`} title={error ? `live fetch failed: ${error}` : source.note}>
      {source.sample ? "sample data" : "snapshot"} · {ago(source.generatedAt)}
      {source.sample ? "" : ` · ${source.credits} credits`}
      {error ? " · live failed" : ""}
    </span>
  );
}
