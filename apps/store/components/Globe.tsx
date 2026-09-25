"use client";
import { type AppMeta, appUrl } from "@longitude/kit";
import { AnimatePresence, NumberTicker, motion, useAnimationFrame, useReducedMotion } from "@longitude/motion";
import { type CSSProperties, useMemo, useRef, useState } from "react";

const R = 300;
const VIEW = 720;
const TILT = (22 * Math.PI) / 180;
/** degrees per millisecond: one revolution every 75 seconds */
const SPEED = 360 / 75_000;

interface P {
  x: number;
  y: number;
  z: number;
}

function project(latDeg: number, lonDeg: number, rotDeg: number): P {
  const phi = (latDeg * Math.PI) / 180;
  const lam = ((lonDeg + rotDeg) * Math.PI) / 180;
  const x = Math.cos(phi) * Math.sin(lam);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lam);
  const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
  return { x: R * x, y: -R * y2, z: z2 };
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/** Visible portion of a sampled curve as an SVG path (points behind the globe break the pen). */
function arc(points: P[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (p.z >= -0.01) {
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
      pen = true;
    } else pen = false;
  }
  return d;
}

const LATS = range(-90, 90, 3);
const LONS = range(-180, 180, 3);
const meridianPath = (lon: number, rot: number) => arc(LATS.map((lat) => project(lat, lon, rot)));
const parallelPath = (lat: number, rot: number) => arc(LONS.map((lon) => project(lat, lon, rot)));

const DEFAULT_WORLD = { bg: "#07090f", surface: "#10141f", accent: "#7dd3fc", accent2: "#fbbf24", ink: "#eef1f7" };

export interface GlobeProps {
  apps: readonly AppMeta[];
  credits: { seeded: number; live: number; calls: number; remaining?: number };
  status: Record<string, "seeded" | "sample">;
}

export function Globe({ apps, credits, status }: GlobeProps) {
  const [rot, setRot] = useState(12);
  const [hot, setHot] = useState<AppMeta | null>(null);
  const reduce = useReducedMotion();
  const hotRef = useRef<AppMeta | null>(null);
  hotRef.current = hot;

  useAnimationFrame((_, delta) => {
    if (reduce || hotRef.current) return;
    setRot((r) => (r + delta * SPEED) % 360);
  });

  const graticule = useMemo(
    () => ({
      parallels: [-60, -30, 0, 30, 60].map((lat) => parallelPath(lat, rot)),
      meridians: range(18, 342, 36).map((lon) => meridianPath(lon, rot)),
    }),
    [rot],
  );

  const lines = useMemo(
    () =>
      apps.map((app) => {
        const eq = project(0, app.lon, rot);
        return { app, d: meridianPath(app.lon, rot), eq };
      }),
    [apps, rot],
  );

  const world = hot?.palette ?? DEFAULT_WORLD;
  const style = {
    "--world-bg": world.bg,
    "--world-surface": world.surface,
    "--world-accent": world.accent,
    "--world-accent2": world.accent2,
    "--world-ink": world.ink,
  } as CSSProperties;

  const total = credits.seeded + credits.live;

  return (
    <motion.div className="store" style={style} animate={{ backgroundColor: world.bg, color: world.ink }} transition={{ duration: 0.7 }}>
      <div className="store__globe" onPointerLeave={() => setHot(null)}>
        <svg viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`} role="img" aria-label="A rotating globe. Each glowing meridian is an app.">
          <defs>
            <radialGradient id="sphere" cx="38%" cy="34%" r="70%">
              <stop offset="0%" stopColor={world.accent} stopOpacity="0.22" />
              <stop offset="55%" stopColor={world.surface} stopOpacity="0.55" />
              <stop offset="100%" stopColor={world.bg} stopOpacity="0.95" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="28" />
            </filter>
          </defs>

          <circle r={R} fill={world.accent} opacity="0.16" filter="url(#halo)" />
          <circle r={R} fill="url(#sphere)" stroke={world.ink} strokeOpacity="0.35" strokeWidth="1" />

          <g className="graticule">
            {graticule.parallels.map((d, i) => (
              <path key={`p${i}`} d={d} />
            ))}
            {graticule.meridians.map((d, i) => (
              <path key={`m${i}`} d={d} />
            ))}
          </g>

          {lines.map(({ app, d, eq }) => {
            const isHot = hot?.id === app.id;
            const dim = hot !== null && !isHot;
            const tint = app.palette.accent.toLowerCase() === app.palette.ink.toLowerCase() ? app.palette.accent2 : app.palette.accent;
            const stroke = isHot ? tint : tint;
            const labelVisible = eq.z > 0.12;
            return (
              <a key={app.id} href={appUrl(app.id)} aria-label={`${app.name}: ${app.tagline}`}>
                <path className={`meridian${isHot ? " meridian--hot" : ""}${dim ? " meridian--dim" : ""}`} d={d} style={{ stroke }} />
                <path
                  className="hit"
                  d={d}
                  onPointerEnter={() => setHot(app)}
                  onFocus={() => setHot(app)}
                  onBlur={() => setHot(null)}
                />
                {labelVisible ? (
                  <text
                    className="label"
                    x={Math.round(eq.x + 12)}
                    y={Math.round(eq.y - 8)}
                    style={{ opacity: dim ? 0.25 : Math.min(1, Math.round(eq.z * 140) / 100) }}
                  >
                    {app.name}
                  </text>
                ) : null}
              </a>
            );
          })}
        </svg>
      </div>

      <div className="store__panel">
        <AnimatePresence mode="wait" initial={false}>
          {hot ? (
            <motion.div
              key={hot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="store__panel"
            >
              <p className="store__kicker">meridian {String(apps.findIndex((a) => a.id === hot.id) + 1).padStart(2, "0")} / 10</p>
              <h2 className="store__title">{hot.name}</h2>
              <p className="store__sub">{hot.tagline}</p>
              <p className="store__world">{hot.world}</p>
              <p className="store__sub" style={{ fontSize: 15, opacity: 0.75 }}>
                {hot.signature}
              </p>
              <a className="store__enter" href={appUrl(hot.id)}>
                Enter {hot.name} <span aria-hidden="true">→</span>
              </a>
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="store__panel"
            >
              <p className="store__kicker">a store of ten apps · powered by nansen</p>
              <h1 className="store__title">LONGITUDE</h1>
              <p className="store__sub">
                Ten meridians. Ten ways to read smart money. Hover a line to let its world in, click to step through.
              </p>
              <div className="store__credits">
                <div>
                  <b>
                    <NumberTicker value={total} />
                  </b>
                  <span>Nansen credits spent</span>
                </div>
                <div>
                  <b>
                    <NumberTicker value={credits.calls} />
                  </b>
                  <span>calls logged</span>
                </div>
                {credits.remaining !== undefined ? (
                  <div>
                    <b>
                      <NumberTicker value={credits.remaining} />
                    </b>
                    <span>credits left</span>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="store__index" aria-label="All apps">
        {apps.map((app, i) => (
          <a
            key={app.id}
            className="store__chip"
            href={appUrl(app.id)}
            data-hot={hot?.id === app.id}
            style={{ "--chip-accent": app.palette.accent === app.palette.ink ? app.palette.accent2 : app.palette.accent } as CSSProperties}
            onPointerEnter={() => setHot(app)}
            onPointerLeave={() => setHot(null)}
            onFocus={() => setHot(app)}
            onBlur={() => setHot(null)}
          >
            <i aria-hidden="true" />
            <span>
              {String(i + 1).padStart(2, "0")} {app.name}
            </span>
            <small>{status[app.id] ?? "soon"}</small>
          </a>
        ))}
      </nav>

      <div className="store__foot">
        <span>every app works on its own url · no login, ever</span>
        <span>built on the nansen api</span>
      </div>
    </motion.div>
  );
}
