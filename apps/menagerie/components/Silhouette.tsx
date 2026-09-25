"use client";
import { type Transition, motion, useReducedMotion } from "@longitude/motion";
import { useId } from "react";
import type { SpeciesId } from "@/lib/data";
import { SILHOUETTES } from "@/lib/silhouettes";

interface Props {
  species: SpeciesId;
  /** "solid" is the roaming ink shape; "sketch" is the journal's pen drawing, which draws itself in. */
  variant?: "solid" | "sketch";
  className?: string;
  /** Accessible name. Without one the drawing is decorative. */
  title?: string;
}

type Mark = NonNullable<SilhouetteSpec["marks"]>[number];
const markClass = (tone: Mark["tone"], stroke?: boolean) => `sil__mark sil__mark--${tone}${stroke ? " sil__mark--stroke" : ""}`;

export function Silhouette({ species, variant = "solid", className, title }: Props) {
  const cls = `sil sil--${species} sil--${variant}${className ? ` ${className}` : ""}`;
  if (variant === "sketch") return <Sketch species={species} className={cls} title={title} />;
  const spec = SILHOUETTES[species];
  return (
    <svg className={cls} viewBox="0 0 120 80" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title ? <title>{title}</title> : null}
      {spec.body.map((d, i) => (
        <path key={i} d={d} className="sil__ink" />
      ))}
      {spec.wing ? <path d={spec.wing} className="sil__ink sil__wing" /> : null}
      {spec.marks?.map((m, i) => (
        <path key={`m${i}`} d={m.d} className={markClass(m.tone, m.stroke)} />
      ))}
      {spec.eye ? <circle className="sil__eye" cx={spec.eye[0]} cy={spec.eye[1]} r={spec.eye[2]} /> : null}
    </svg>
  );
}

/** Pen-and-hatch drawing: each outline draws itself, then the hatching and details fade in. */
function Sketch({ species, className, title }: { species: SpeciesId; className: string; title?: string }) {
  const spec = SILHOUETTES[species];
  const reduce = useReducedMotion();
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const outlines = [...spec.body, ...(spec.wing ? [spec.wing] : [])];
  const lastInk = 0.15 + outlines.length * 0.22;

  const draw = (i: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, fillOpacity: 0 },
          animate: { pathLength: 1, fillOpacity: 1 },
          transition: {
            pathLength: { duration: 1.1, delay: 0.15 + i * 0.22, ease: "easeInOut" },
            fillOpacity: { duration: 0.6, delay: 0.85 + i * 0.22 },
          } as Transition,
        };
  const late = reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay: lastInk + 0.4 } as Transition };

  return (
    <svg className={className} viewBox="0 0 120 80" role="img" aria-label={title} focusable="false">
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width="4.5" height="4.5" patternTransform="rotate(-38)">
          <line x1="0" y1="0" x2="0" y2="4.5" className="sil__hatch" />
        </pattern>
      </defs>
      <motion.ellipse className="sil__wash" cx="62" cy="54" rx="50" ry="22" {...(reduce ? {} : { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.9 } })} />
      {outlines.map((d, i) => (
        <motion.path key={i} d={d} className="sil__pen" fill={`url(#${hatchId})`} {...draw(i)} />
      ))}
      {spec.marks?.map((m, i) => (
        <motion.path key={`m${i}`} d={m.d} className={markClass(m.tone, m.stroke)} {...late} />
      ))}
      {spec.eye ? <motion.circle className="sil__eye" cx={spec.eye[0]} cy={spec.eye[1]} r={spec.eye[2]} {...late} /> : null}
    </svg>
  );
}
