"use client";
import { type AppMeta, Captions, FeedTicker, Passport, appUrl, useIdentity, usePresence, withIdentity, withRecording } from "@longitude/kit";
import { AnimatePresence, NumberTicker, motion, useAnimationFrame, useReducedMotion } from "@longitude/motion";
import { type CSSProperties, useMemo, useRef, useState } from "react";
import { SearchBox } from "./SearchBox";

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
const r1 = (n: number) => Math.round(n * 10) / 10;

const DEFAULT_WORLD = { bg: "#07090f", surface: "#10141f", accent: "#7dd3fc", accent2: "#fbbf24", ink: "#eef1f7" };

/** Relative luminance of a hex colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

const tint = (app: AppMeta) => (app.palette.accent.toLowerCase() === app.palette.ink.toLowerCase() ? app.palette.accent2 : app.palette.accent);

export interface GlobeProps {
  apps: readonly AppMeta[];
  credits: { spent: number; apiCalls: number; cacheHits: number; remaining?: number };
  status: Record<string, "seeded" | "sample">;
}

export function Globe({ apps, credits, status }: GlobeProps) {
  const [rot, setRot] = useState(12);
  const [hot, setHotState] = useState<AppMeta | null>(null);
  const reduce = useReducedMotion();
  const hotRef = useRef<AppMeta | null>(null);
  hotRef.current = hot;
  // Leaving the globe or the panel only clears the selection after a pause, so the pointer can
  // travel from a meridian to its "Enter" button.
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClear = () => clearTimeout(clearTimer.current);
  const scheduleClear = () => {
    cancelClear();
    clearTimer.current = setTimeout(() => setHotState(null), 900);
  };
  const setHot = (app: AppMeta | null) => {
    cancelClear();
    setHotState(app);
  };
  const me = useIdentity();
  const presence = usePresence();
  const link = (id: AppMeta["id"]) => withIdentity(appUrl(id), me?.id);
  const enter = (id: AppMeta["id"]) => {
    window.location.href = withRecording(link(id));
  };

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
      apps.map((app, i) => {
        // Labels alternate above and below the equator so neighbours never collide, ride the
        // parallel's tangent, and hide near the limb where meridians bunch up.
        const lat = i % 2 === 0 ? 16 : -16;
        const a = project(lat, app.lon, rot);
        const b = project(lat, app.lon + 6, rot);
        let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        return { app, d: meridianPath(app.lon, rot), x: r1(a.x), y: r1(a.y), z: a.z, angle: r1(angle) };
      }),
    [apps, rot],
  );

  const world = hot?.palette ?? DEFAULT_WORLD;
  // Light worlds (cream, pink) get dark labels with a pale halo; dark worlds the reverse.
  const lightWorld = luminance(world.bg) > 0.4;
  const style = {
    "--world-bg": world.bg,
    "--world-surface": world.surface,
    "--world-accent": world.accent,
    "--world-accent2": world.accent2,
    "--world-ink": world.ink,
    "--label-fill": lightWorld ? "#14171d" : "#eef1f7",
    "--label-stroke": lightWorld ? "rgba(255, 252, 245, 0.85)" : "rgba(7, 9, 15, 0.75)",
  } as CSSProperties;

  return (
    <motion.div className="store" style={style} animate={{ backgroundColor: world.bg, color: world.ink }} transition={{ duration: 0.7 }}>
      <div className="store__globe" onPointerEnter={cancelClear} onPointerLeave={scheduleClear}>
        <svg
          viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
          role="img"
          aria-label="A rotating globe. Each glowing meridian is an app; click one to enter it."
          onClick={(e) => {
            if ((e.target as Element).classList?.contains("hit")) return;
            setHot(null);
          }}
        >
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
            <clipPath id="disk">
              <circle r={R - 2} />
            </clipPath>
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

          <g clipPath="url(#disk)">
            {lines.map(({ app, d, x, y, z, angle }) => {
              const isHot = hot?.id === app.id;
              const dim = hot !== null && !isHot;
              const color = tint(app);
              return (
                <g key={app.id}>
                  <path className={`meridian${isHot ? " meridian--hot" : ""}${dim ? " meridian--dim" : ""}`} d={d} style={{ stroke: color }} />
                  {z > 0.3 ? (
                    <text
                      className="label"
                      transform={`translate(${x} ${y}) rotate(${angle})`}
                      textAnchor="middle"
                      style={{ opacity: dim ? 0.5 : Math.min(1, Math.round(z * 140) / 100), fill: isHot ? color : undefined }}
                    >
                      {app.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>

          {/* Hit areas last so they sit on top of everything: click enters the world. */}
          {lines.map(({ app, d }) => (
            <path
              key={`hit-${app.id}`}
              className="hit"
              d={d}
              role="link"
              tabIndex={0}
              aria-label={`Enter ${app.name}`}
              onPointerEnter={() => setHot(app)}
              onFocus={() => setHot(app)}
              onBlur={scheduleClear}
              onClick={() => enter(app.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") enter(app.id);
              }}
            />
          ))}
        </svg>
        <p className="store__hint" aria-hidden="true">
          {hot ? `Click the line to enter ${hot.name}` : "Hover a meridian · click to enter"}
        </p>
      </div>

      <div className="store__panel" onPointerEnter={cancelClear} onPointerLeave={scheduleClear}>
        <AnimatePresence mode="wait" initial={false}>
          {hot ? (
            <motion.div key={hot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="store__panel">
              <p className="store__kicker">meridian {String(apps.findIndex((a) => a.id === hot.id) + 1).padStart(2, "0")} / 10</p>
              <h2 className="store__title">{hot.name}</h2>
              <p className="store__sub">{hot.tagline}</p>
              <p className="store__world">{hot.world}</p>
              <p className="store__sub" style={{ fontSize: 15, opacity: 0.75 }}>
                {hot.signature}
              </p>
              <a className="store__enter" href={link(hot.id)}>
                Enter {hot.name} <span aria-hidden="true">→</span>
              </a>
            </motion.div>
          ) : (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="store__panel">
              <p className="store__kicker">a store of ten apps · built on nansen</p>
              <h1 className="store__title">LONGITUDE</h1>
              <p className="store__sub">
                Ten small apps, each a different way to read what smart money is doing on-chain right now. The globe is the store: every glowing line is an app. Hover one to
                let its world in, click to step inside. No login, and your passport follows you between them.
              </p>
              <ol className="store__steps">
                <li>
                  <span>
                    <b>Pick a meridian.</b> Ten worlds, one question each.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Step in.</b> Real wallets, real trades, one plain sentence to start.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Come back.</b> Your drafts, calls and stamps are waiting on the globe.
                  </span>
                </li>
              </ol>
              <div className="store__credits">
                <div>
                  <b>
                    <NumberTicker value={credits.spent} />
                  </b>
                  <span>Nansen credits spent</span>
                </div>
                <div>
                  <b>
                    <NumberTicker value={credits.apiCalls} />
                  </b>
                  <span>API calls</span>
                </div>
                {credits.cacheHits > 0 ? (
                  <div>
                    <b>
                      <NumberTicker value={credits.cacheHits} />
                    </b>
                    <span>served from cache</span>
                  </div>
                ) : null}
                {credits.remaining !== undefined ? (
                  <div>
                    <b>
                      <NumberTicker value={credits.remaining} />
                    </b>
                    <span>credits left</span>
                  </div>
                ) : null}
                {presence ? (
                  <div>
                    <b>
                      <NumberTicker value={presence.global.count} />
                    </b>
                    <span>on the globe now</span>
                  </div>
                ) : null}
                {presence && presence.visitors > 0 ? (
                  <div>
                    <b>
                      <NumberTicker value={presence.visitors} />
                    </b>
                    <span>explorers so far</span>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="store__search">
        <SearchBox />
      </div>

      <div className="store__social">
        <Passport />
        {me ? (
          <span className="store__me">
            you are <b>{me.handle}</b>
          </span>
        ) : null}
      </div>
      <FeedTicker className="store__ticker" />

      <section className="store__worlds" aria-label="The ten worlds">
        <h2 className="store__worlds-title">The ten worlds</h2>
        <div className="store__grid">
          {apps.map((app, i) => (
            <a
              key={app.id}
              className="store__card"
              href={link(app.id)}
              data-hot={hot?.id === app.id}
              style={{ "--chip-accent": tint(app), "--chip-bg": app.palette.bg } as CSSProperties}
              onPointerEnter={() => setHot(app)}
              onPointerLeave={scheduleClear}
              onFocus={() => setHot(app)}
              onBlur={scheduleClear}
            >
              <span className="store__card-media">
                <img src={`${appUrl(app.id)}/og`} alt="" loading="lazy" width={1200} height={630} />
              </span>
              <span className="store__card-body">
                <span className="store__card-n">
                  {String(i + 1).padStart(2, "0")}
                  {presence?.byApp[app.id] ? ` · ${presence.byApp[app.id]} here` : ""}
                </span>
                <span className="store__card-name">{app.name}</span>
                <span className="store__card-tag">{app.tagline}</span>
                <small className="store__card-status">{status[app.id] ?? "soon"}</small>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="store__foot">
        <span>every app works on its own url · no login, ever</span>
        <a href="https://www.nansen.ai/api" target="_blank" rel="noopener noreferrer">
          built on the nansen api
        </a>
      </div>
      <Captions
        kicker="LONGITUDE"
        base="Ten apps built on the Nansen API. Each glowing line on the globe is one app: hover to preview it, click to step inside."
      />
    </motion.div>
  );
}
