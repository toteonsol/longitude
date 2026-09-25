"use client";
import { type CSSProperties, useMemo } from "react";
import { rng } from "@/lib/windows";

/** Stars, moon and horizon haze. Sits behind the skyline and never scrolls. */
export function Sky() {
  const stars = useMemo(() => {
    const rand = rng(1979);
    return Array.from({ length: 130 }, (_, id) => ({
      id,
      x: rand() * 1000,
      y: rand() * 430,
      r: 0.5 + rand() * 1.3,
      dur: 2.5 + rand() * 4.5,
      delay: rand() * 6,
      o: 0.3 + rand() * 0.7,
    }));
  }, []);

  return (
    <div className="sky" aria-hidden="true">
      <svg className="sky__stars" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMin slice">
        {stars.map((s) => (
          <circle key={s.id} className="star" cx={s.x} cy={s.y} r={s.r} style={{ "--dur": `${s.dur}s`, "--delay": `${s.delay}s`, "--o": s.o } as CSSProperties} />
        ))}
      </svg>
      <div className="moon">
        <span className="moon__crater moon__crater--1" />
        <span className="moon__crater moon__crater--2" />
        <span className="moon__crater moon__crater--3" />
      </div>
      <div className="sky__haze" />
    </div>
  );
}

/** A far, dark row of towers behind the real ones. Decorative; scrolls with the skyline. */
export function FarSkyline() {
  const blocks = useMemo(() => {
    const rand = rng(404);
    const out: { x: number; w: number; h: number }[] = [];
    let x = -10;
    while (x < 1010) {
      const w = 16 + rand() * 46;
      const h = 30 + rand() * 140;
      out.push({ x, w, h });
      x += w + 3 + rand() * 9;
    }
    return out;
  }, []);
  return (
    <svg className="skyline__far" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={200 - b.h} width={b.w} height={b.h} />
      ))}
    </svg>
  );
}
