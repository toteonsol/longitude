"use client";
import { ShareButton } from "@longitude/kit";
import { AnimatePresence, NumberTicker, Reveal, Stagger, StaggerItem, Typewriter, fmt, motion, springs, useReducedMotion } from "@longitude/motion";
import { useState } from "react";
import type { AsTheChainTurnsData, CastMember, Episode, Scene } from "@/lib/data";
import { episodeShareText, hhmm } from "@/lib/format";
import { FeaturedCard } from "./CastCard";
import { Portrait } from "./Portrait";

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.35 } },
  transition: { duration: 0.5 },
};

/** Opening title card: gold script over pink and blue, with a slow camera push-in. */
export function TitleCard({ episode }: { episode: Episode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className="screen__layer title" {...fade}>
      <motion.div className="title__zoom" initial={{ scale: 1 }} animate={{ scale: reduce ? 1 : 1.12 }} transition={{ duration: 7, ease: "easeOut" }}>
        <div className="title__bokeh" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="title__content">
          <Reveal delay={0.35} blur={12} y={16} scale={0.94} spring="slow">
            <div className="title__glow">
              <h2 className="title__logo script gold">As The Chain Turns</h2>
            </div>
          </Reveal>
          <Reveal delay={1.5} y={10} className="title__meta">
            <p className="title__ep">Episode {episode.number}</p>
            <p className="title__name">&ldquo;{episode.title}&rdquo;</p>
          </Reveal>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** "Previously on…": the three biggest beats, one after another. */
export function PreviouslyCard({ episode, castByAddress }: { episode: Episode; castByAddress: Map<string, CastMember> }) {
  return (
    <motion.div className="screen__layer previously" {...fade}>
      <p className="previously__kicker">
        Previously on <span className="script">As The Chain Turns</span>
      </p>
      <Stagger className="previously__lines" gap={1.4} delay={0.7}>
        {episode.previously.map((line, i) => {
          const m = castByAddress.get(line.wallet);
          return (
            <StaggerItem key={`${i}-${line.wallet}`} className="previously__line" y={12} spring="gentle">
              {m ? <Portrait member={m} className="previously__portrait" /> : null}
              <p>{line.text}</p>
            </StaggerItem>
          );
        })}
      </Stagger>
    </motion.div>
  );
}

interface StageProps {
  scene: Scene;
  actor: CastMember;
  coStar?: CastMember;
  total: number;
}

/** One scene: the camera finds the actor's card, the caption types in, then the numbers land. */
export function SceneStage({ scene, actor, coStar, total }: StageProps) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(false);
  const dramatic = scene.zoom === "dramatic";
  return (
    <motion.div className={`screen__layer stage stage--${scene.zoom}`} {...fade}>
      <motion.div
        className="stage__camera"
        initial={{ scale: 1 }}
        animate={{ scale: reduce ? 1 : dramatic ? 1.07 : 1.025 }}
        transition={{ duration: 8, ease: "easeOut" }}
      >
        <div className="stage__set" aria-hidden="true" />
        <div className="stage__shot">
          <motion.div
            className="stage__actor"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: dramatic ? 0.35 : 0.7, rotate: dramatic ? -14 : -4, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotate: dramatic ? 2.5 : 0, y: 0 }}
            transition={{ ...springs[dramatic ? "bouncy" : "gentle"], delay: 0.1 }}
          >
            <FeaturedCard member={actor} />
          </motion.div>
          <div className="stage__dialogue">
            <motion.div className="stage__chyron" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springs.snappy, delay: 0.25 }}>
              <span className="stage__scene-no">
                Scene {scene.index}/{total}
              </span>
              <span className="stage__scene-title">{scene.title}</span>
            </motion.div>
            <p className="stage__caption">
              <Typewriter text={scene.caption} speed={26} delay={550} cursor onDone={() => setTyped(true)} />
            </p>
            <AnimatePresence>
              {typed ? (
                <motion.dl className="stage__numbers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springs.snappy}>
                  <div className={`stage__num stage__num--${scene.action}`}>
                    <dt>{scene.action}</dt>
                    <dd>${scene.symbol}</dd>
                  </div>
                  <div className="stage__num">
                    <dt>Value</dt>
                    <dd>
                      <NumberTicker value={scene.valueUsd} format={fmt.usd} duration={1.1} />
                    </dd>
                  </div>
                  <div className="stage__num">
                    <dt>Amount</dt>
                    <dd>
                      {fmt.compact(scene.amount)} {scene.symbol}
                    </dd>
                  </div>
                  {scene.action === "swap" ? (
                    <div className="stage__num">
                      <dt>Out</dt>
                      <dd>
                        {fmt.compact(scene.pair.sold.amount)} {scene.pair.sold.symbol}
                      </dd>
                    </div>
                  ) : null}
                  <div className="stage__num">
                    <dt>Time</dt>
                    <dd>{hhmm(scene.at)} UTC</dd>
                  </div>
                  {coStar ? (
                    <div className="stage__num stage__num--costar">
                      <dt>With</dt>
                      <dd>
                        <Portrait member={coStar} className="stage__costar" />
                        {coStar.character.name}
                      </dd>
                    </div>
                  ) : null}
                </motion.dl>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Closing card. */
export function EndCard({ data, onReplay }: { data: AsTheChainTurnsData; onReplay: () => void }) {
  const total = data.scenes.reduce((s, x) => s + x.valueUsd, 0);
  return (
    <motion.div className="screen__layer end" {...fade}>
      <Reveal delay={0.2} blur={8} y={12} spring="slow">
        <div className="title__glow">
          <p className="end__title script gold">To be continued…</p>
        </div>
      </Reveal>
      <Reveal delay={0.9} y={8}>
        <p className="end__meta">Same chain. Same time.</p>
        <p className="end__stats">
          {data.scenes.length} scenes · {data.cast.length} wallets · {fmt.usd(total)} changed hands
        </p>
      </Reveal>
      <Reveal delay={1.3} y={8}>
        <div className="end__actions">
          <button type="button" className="tv__btn" onClick={onReplay}>
            Replay episode
          </button>
          <ShareButton text={episodeShareText(data.episode)} label="Share this episode" />
        </div>
      </Reveal>
    </motion.div>
  );
}
