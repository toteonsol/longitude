"use client";

/** Bottom-centre in percent of the stage, height in percent of the stage. Depth order follows `y`. */
const TREES = [
  { x: 15, y: 45, h: 9 },
  { x: 57, y: 43.6, h: 6 },
  { x: 79, y: 46, h: 11 },
  { x: 92, y: 68, h: 24 },
];

/** The static plate: sky, sun, hills, horizon, ground, water hole and acacias. Everything scales with the stage. */
export function Scene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__sky" />
      <div className="scene__sun" />
      <svg className="scene__hills" viewBox="0 0 1000 120" preserveAspectRatio="none">
        <path className="scene__hill scene__hill--far" d="M0 120 L0 70 C120 40 260 46 380 62 C500 78 640 30 780 44 C880 54 950 80 1000 72 L1000 120 Z" />
        <path className="scene__hill scene__hill--near" d="M0 120 L0 96 C150 70 300 84 420 100 C560 118 700 76 860 92 C920 98 970 106 1000 100 L1000 120 Z" />
      </svg>
      <div className="scene__ground" />
      <div className="scene__grass" />
      <svg className="scene__horizon" viewBox="0 0 1000 12" preserveAspectRatio="none">
        <defs>
          <filter id="menagerie-wobble" x="-2%" y="-300%" width="104%" height="700%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.3" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
          </filter>
        </defs>
        <path filter="url(#menagerie-wobble)" d="M0 6 C120 4 220 8 340 6 C460 4 560 9 700 6 C820 3 900 8 1000 6" />
      </svg>
      <svg className="scene__lake" viewBox="0 0 400 80" preserveAspectRatio="none">
        <ellipse className="scene__water" cx="200" cy="40" rx="196" ry="34" />
        <path className="scene__ripple" d="M90 44 C120 38 150 38 180 44" />
        <path className="scene__ripple" d="M220 52 C250 46 280 46 310 52" />
        <path className="scene__ripple" d="M150 62 C170 58 190 58 210 62" />
      </svg>
      {TREES.map((t) => (
        <svg key={`${t.x}-${t.y}`} className="scene__tree" viewBox="0 0 100 100" style={{ left: `${t.x}%`, top: `${t.y}%`, height: `${t.h}%`, zIndex: Math.round(t.y) }}>
          <ellipse className="scene__canopywash" cx="52" cy="42" rx="46" ry="20" />
          <path className="scene__trunk" d="M47 100 L49 62 L40 48 L44 46 L51 58 L58 44 L62 46 L54 62 L56 100 Z" />
          <path className="scene__canopy" d="M8 48 C16 28 38 20 56 22 C76 18 94 28 96 42 C98 50 90 54 80 52 C62 58 32 58 12 54 C4 53 4 50 8 48 Z" />
        </svg>
      ))}
      <div className="scene__vignette" />
    </div>
  );
}
