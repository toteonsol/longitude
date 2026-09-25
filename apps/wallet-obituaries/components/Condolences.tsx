"use client";
import { ReactionBar, ShareButton, social, useIdentity } from "@longitude/kit";
import { shortAddress } from "@longitude/nansen";
import type { MouseEvent } from "react";
import type { Obituary as Notice } from "@/lib/data";

const KINDS = ["candle", "rose", "press"];
const GLYPHS: Record<string, string> = { candle: "Light a candle", rose: "Leave a rose", press: "Press F" };

/**
 * The condolence line under a notice: three reactions with tallies and a share link. Every call
 * behind it is fire-and-forget, so without the social API the notice reads exactly the same.
 */
export function Condolences({ o }: { o: Notice }) {
  const me = useIdentity();
  const target = `obit:${o.chain}:${o.address}`;
  const shareText = `${o.headline} — Wallet Obituaries, LONGITUDE, built on @nansen_ai`;

  // The kit's ReactionBar has no toggle callback. A capture-phase listener sees the candle button
  // before React flips it, so aria-pressed="false" means a candle is about to be lit, not put out.
  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    const button = (e.target as Element | null)?.closest("button.lg-reaction");
    if (!button || button.getAttribute("title") !== "candle" || button.getAttribute("aria-pressed") === "true") return;
    void social.event("react", `${me?.handle ?? "Someone"} lit a candle for ${shortAddress(o.address, 4)}`);
  };

  return (
    <div className="condolences">
      <span className="condolences__label">Condolences</span>
      <span className="condolences__bar" onClickCapture={onClickCapture}>
        <ReactionBar target={target} kinds={KINDS} glyphs={GLYPHS} />
      </span>
      <span className="condolences__share">
        <ShareButton text={shareText} label="Share notice" />
      </span>
    </div>
  );
}
