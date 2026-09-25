import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "LONGITUDE: ten meridians, ten ways to read smart money";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const APPS = ["Rookie Scout", "Two-Faced", "Exit Clock", "Odds vs Flow", "Last Ones Out", "Dynasties", "MENAGERIE", "Rewind", "Wallet Obituaries", "As The Chain Turns"];
const COLORS = ["#d4af37", "#b3122e", "#b08d57", "#1c4f8c", "#ffc45c", "#c9a227", "#6f8f4d", "#ff3ea5", "#8b0000", "#2a6fdb"];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #07090f 0%, #10141f 100%)", color: "#eef1f7", fontFamily: "sans-serif", padding: 64, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, opacity: 0.75 }}>A STORE OF TEN APPS · POWERED BY NANSEN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>LONGITUDE</div>
            <div style={{ fontSize: 30, opacity: 0.85, lineHeight: 1.3 }}>Ten meridians. Ten ways to read smart money.</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {APPS.map((a, i) => (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(238,241,247,0.18)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: COLORS[i] }} />
                {a}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 420 }}>
          <div style={{ width: 380, height: 380, borderRadius: 190, border: "1px solid rgba(238,241,247,0.4)", background: "radial-gradient(circle at 38% 34%, rgba(125,211,252,0.25), rgba(16,20,31,0.6) 55%, #07090f 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {COLORS.map((c, i) => (
              <div key={c} style={{ position: "absolute", width: 380 - i * 34, height: 380, borderRadius: 190, border: `2px solid ${c}`, opacity: 0.55 }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
