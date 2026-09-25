"use client";
import { motion, springs } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { CSSProperties } from "react";
import type { CastMember } from "@/lib/data";
import { Portrait } from "./Portrait";

/** The card the camera zooms into during a scene. */
export function FeaturedCard({ member }: { member: CastMember }) {
  const c = member.character;
  return (
    <div className="feat" style={{ "--hue": c.hue } as CSSProperties}>
      <Portrait member={member} className="feat__portrait" />
      <div className="feat__body">
        <h3 className="feat__name script">{c.name}</h3>
        <span className="feat__archetype">{c.archetype}</span>
        <p className="feat__role">{c.role}</p>
        <p className="feat__actor">
          played by <b>{member.label}</b> <span className="lg-addr">{shortAddress(member.address)}</span>
        </p>
      </div>
    </div>
  );
}

interface MiniCastProps {
  cast: CastMember[];
  activeAddress?: string;
  visible: boolean;
  onPick: (member: CastMember) => void;
}

/** The row of headshots along the bottom of the screen. The actor in the scene is lit; the others dim. */
export function MiniCast({ cast, activeAddress, visible, onPick }: MiniCastProps) {
  return (
    <div className={`minicast${visible ? "" : " minicast--hidden"}`} aria-hidden={!visible}>
      {cast.map((m) => {
        const active = m.address === activeAddress;
        return (
          <motion.button
            key={m.address}
            type="button"
            className={`minicast__item${active ? " is-active" : ""}`}
            onClick={() => onPick(m)}
            tabIndex={visible ? 0 : -1}
            aria-label={`Jump to ${m.character.name}`}
            title={m.character.name}
            animate={{
              opacity: active ? 1 : 0.42,
              scale: active ? 1.18 : 1,
              y: active ? -6 : 0,
              filter: active ? "grayscale(0)" : "grayscale(0.85)",
            }}
            transition={springs.snappy}
          >
            <Portrait member={m} className="minicast__portrait" />
          </motion.button>
        );
      })}
    </div>
  );
}
