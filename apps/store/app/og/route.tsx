import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

const COLORS = ["#d4af37", "#b3122e", "#b08d57", "#1c4f8c", "#ffc45c", "#c9a227", "#6f8f4d", "#ff3ea5", "#8b0000", "#2a6fdb"];

/** Share image for store pages (wallet lens): the globe motif plus a title. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const title = (q.get("title") ?? "LONGITUDE").slice(0, 80);
  const subtitle = (q.get("subtitle") ?? "Ten meridians. Ten ways to read smart money.").slice(0, 160);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #07090f 0%, #10141f 100%)", color: "#eef1f7", fontFamily: "sans-serif", padding: 64, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700, height: "100%" }}>
          <div style={{ fontSize: 22, letterSpacing: 8, opacity: 0.75 }}>LONGITUDE · WALLET LENS · POWERED BY NANSEN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: title.length > 30 ? 56 : 72, fontWeight: 700, letterSpacing: -1, lineHeight: 1.05 }}>{title}</div>
            <div style={{ fontSize: 28, opacity: 0.85, lineHeight: 1.3 }}>{subtitle}</div>
          </div>
          <div style={{ fontSize: 20, opacity: 0.6 }}>longitude-sigma.vercel.app</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 380, height: 380, borderRadius: 190, border: "1px solid rgba(238,241,247,0.4)", background: "radial-gradient(circle at 38% 34%, rgba(125,211,252,0.25), rgba(16,20,31,0.6) 55%, #07090f 100%)", position: "relative" }}>
          {COLORS.map((c, i) => (
            <div key={c} style={{ position: "absolute", width: 380 - i * 34, height: 380, borderRadius: 190, border: `2px solid ${c}`, opacity: 0.55 }} />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
