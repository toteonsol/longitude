"use client";
import { NumberTicker, Stagger, StaggerItem, fmt, motion, useInView, useReducedMotion } from "@longitude/motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { House } from "@/lib/data";
import { kindTitle } from "@/lib/data";
import { CrestNode, formatDate } from "./CrestNode";
import { Coronet } from "./Ornaments";

interface Props {
  house: House;
  total: number;
}

interface Pt {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  bottom: number;
}

interface Connector {
  id: string;
  d: string;
  delay: number;
  kind: "trunk" | "tick" | "vine" | "cord";
}

const STACK_QUERY = "(max-width: 720px)";
/** x of the left-hand trunk in stacked (mobile) layout; keep in sync with --trunk-x in globals.css. */
const TRUNK_X = 10;

const r1 = (n: number) => Math.round(n * 10) / 10;
const line = (a: Pt, b: Pt) => `M${r1(a.x)} ${r1(a.y)} L${r1(b.x)} ${r1(b.y)}`;
const curve = (a: Pt, b: Pt) => {
  const my = (a.y + b.y) / 2;
  return `M${r1(a.x)} ${r1(a.y)} C${r1(a.x)} ${r1(my)}, ${r1(b.x)} ${r1(my)}, ${r1(b.x)} ${r1(b.y)}`;
};

/** Layout position relative to `root`, summed up the offsetParent chain so transforms mid-animation do not skew it. */
function layoutBox(el: HTMLElement, root: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, bottom: y + h };
}

function useStacked(): boolean {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(STACK_QUERY);
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return stacked;
}

/**
 * One house: the tapestry unfurls as it scrolls into view, the founder and patriarch appear, then
 * each bloodline's ribbon and crests reveal in order while the connecting cords draw themselves.
 */
export function HouseTree({ house, total }: Props) {
  const section = useRef<HTMLElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const inView = useInView(section, { once: true, amount: 0.12 });
  const reduce = useReducedMotion();
  const stacked = useStacked();
  const [unfurled, setUnfurled] = useState(false);
  const [paths, setPaths] = useState<Connector[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const openId = hovered ?? pinned;
  const show = inView;

  const measure = useCallback(() => {
    const root = tree.current;
    if (!root) return;
    const all = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
    const head = root.querySelector<HTMLElement>('[data-node="patriarch"]');
    const headCrest = root.querySelector<HTMLElement>('[data-node="patriarch"] [data-crest]');
    if (!head || !headCrest) return;
    const P = layoutBox(head, root);
    const PC = layoutBox(headCrest, root);
    const out: Connector[] = [];

    const founderCrest = root.querySelector<HTMLElement>('[data-node="founder"] [data-crest]');
    if (founderCrest) {
      const F = layoutBox(founderCrest, root);
      out.push({ id: "founder", d: line({ x: F.cx, y: F.bottom + 2 }, { x: PC.cx, y: PC.y - 2 }), delay: 0.05, kind: "cord" });
    }

    const ribbons = all('[data-node="ribbon"]');
    const start: Pt = { x: P.cx, y: P.bottom };
    if (stacked && ribbons.length) {
      const first = layoutBox(ribbons[0] as HTMLElement, root);
      const last = layoutBox(ribbons[ribbons.length - 1] as HTMLElement, root);
      const d =
        `M${r1(start.x)} ${r1(start.y)} C${r1(start.x)} ${r1(start.y + 36)}, ${TRUNK_X} ${r1(first.cy - 40)}, ${TRUNK_X} ${r1(first.cy)}` +
        (ribbons.length > 1 ? ` V${r1(last.cy)}` : "");
      out.push({ id: "trunk", d, delay: 0.15, kind: "trunk" });
    }

    ribbons.forEach((rEl, i) => {
      const R = layoutBox(rEl, root);
      if (stacked) out.push({ id: `tick-${i}`, d: `M${TRUNK_X} ${r1(R.cy)} H${r1(R.x)}`, delay: 0.4 + i * 0.1, kind: "tick" });
      else out.push({ id: `vine-${i}`, d: curve(start, { x: R.cx, y: R.y }), delay: 0.2 + i * 0.09, kind: "vine" });

      const crests = all(`[data-node="member"][data-branch="${i}"] [data-crest]`);
      const firstCrest = crests[0] ? layoutBox(crests[0], root) : undefined;
      let prev: Pt = { x: stacked && firstCrest ? firstCrest.cx : R.cx, y: R.bottom };
      crests.forEach((cEl, j) => {
        const M = layoutBox(cEl, root);
        const end: Pt = { x: M.cx, y: M.y };
        out.push({
          id: `cord-${i}-${j}`,
          d: Math.abs(prev.x - end.x) < 2 ? line({ x: end.x, y: prev.y }, end) : curve(prev, end),
          delay: 0.5 + i * 0.09 + j * 0.1,
          kind: "cord",
        });
        prev = { x: M.cx, y: M.bottom };
      });
    });

    setSize({ w: root.offsetWidth, h: root.offsetHeight });
    setPaths(out);
  }, [stacked]);

  useLayoutEffect(() => {
    measure();
  }, [measure, house]);

  useEffect(() => {
    const root = tree.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    window.addEventListener("resize", measure);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // A pinned scroll closes on Escape or on a tap outside the house.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(null);
    };
    const onDown = (e: PointerEvent) => {
      const root = section.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [pinned]);

  const nodeProps = (id: string) => ({
    open: openId === id,
    onHover: (on: boolean) => setHovered((h) => (on ? id : h === id ? null : h)),
    onToggle: () => setPinned((p) => (p === id ? null : id)),
  });

  const p = house.patriarch;
  const facts = [
    { k: "PnL 30d", v: fmt.usdSigned(p.pnlUsd) },
    { k: "Win rate", v: `${p.winRate.toFixed(0)}%` },
    { k: "Trades", v: fmt.int(p.trades) },
    { k: "Tokens", v: fmt.int(p.tokens) },
  ];
  const tickerValue = (v: number) => (show ? v : 0);

  return (
    <section ref={section} className="house" data-unfurled={unfurled} aria-label={`House ${house.name}`}>
      <motion.div
        className="house__cloth"
        initial={reduce ? { opacity: 0 } : { clipPath: "inset(0px 0px 100% 0px)" }}
        animate={show ? (reduce ? { opacity: 1 } : { clipPath: "inset(0px 0px 0% 0px)" }) : undefined}
        transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={() => setUnfurled(true)}
      >
        <span className="house__corner house__corner--tl" aria-hidden="true" />
        <span className="house__corner house__corner--tr" aria-hidden="true" />
        <span className="house__corner house__corner--bl" aria-hidden="true" />
        <span className="house__corner house__corner--br" aria-hidden="true" />

        <Stagger className="house__inner" gap={0.07} delay={0.3} animate={show ? "shown" : "hidden"}>
          <div ref={tree} className="tree" data-layout={stacked ? "stacked" : "row"}>
            {size.w > 0 ? (
              <svg className="tree__lines" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
                {paths.map((c) => (
                  <motion.path
                    key={c.id}
                    className={`tree__line tree__line--${c.kind}`}
                    d={c.d}
                    initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                    animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{
                      pathLength: { duration: c.kind === "trunk" ? 1.1 : 0.75, delay: c.delay, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.25, delay: c.delay },
                    }}
                  />
                ))}
              </svg>
            ) : null}

            <div className="house__head" data-node="patriarch">
              {house.founder ? (
                <StaggerItem className="tree__founder" data-node="founder" y={-10}>
                  <span className="tree__eyebrow">Founded by</span>
                  <CrestNode
                    address={house.founder.address}
                    size={stacked ? 44 : 52}
                    role="Founder"
                    relation="First funder"
                    at={house.founder.at}
                    label={house.founder.label}
                    txHash={house.founder.txHash}
                    chain={house.founder.chain}
                    {...nodeProps(house.founder.address)}
                  />
                </StaggerItem>
              ) : null}

              <StaggerItem className="house__patriarch" scale={0.9} y={0} spring="bouncy">
                <Coronet />
                <CrestNode address={p.address} size={stacked ? 88 : 108} role="Patriarch" label={p.label} facts={facts} caption={false} {...nodeProps(p.address)} />
              </StaggerItem>

              <StaggerItem className="house__titles">
                <p className="house__eyebrow">
                  House {house.rank} of {total} · {p.label}
                </p>
                <h2 className="house__name">House {house.name}</h2>
                <p className="house__motto">“{house.motto}”</p>
              </StaggerItem>

              <StaggerItem className="house__stats">
                <div>
                  <b className={p.pnlUsd < 0 ? "is-neg" : ""}>
                    <NumberTicker value={tickerValue(p.pnlUsd)} format={fmt.usdSigned} />
                  </b>
                  <span>PnL 30d</span>
                </div>
                <div>
                  <b>
                    <NumberTicker value={tickerValue(p.winRate)} format={(n) => `${n.toFixed(0)}%`} />
                  </b>
                  <span>Win rate</span>
                </div>
                <div>
                  <b>
                    <NumberTicker value={tickerValue(p.trades)} />
                  </b>
                  <span>Trades</span>
                </div>
                <div>
                  <b>
                    <NumberTicker value={tickerValue(p.tokens)} />
                  </b>
                  <span>Tokens</span>
                </div>
              </StaggerItem>

              <StaggerItem className="house__line">
                {house.foundedAt ? <span>Line recorded since {formatDate(house.foundedAt)}</span> : <span>No dated ties on record</span>}
                <span className="house__dot" aria-hidden="true">
                  ·
                </span>
                <span>
                  {house.members.length} kin across {house.branches.length} {house.branches.length === 1 ? "bloodline" : "bloodlines"}
                </span>
              </StaggerItem>
            </div>

            {house.branches.length ? (
              <div className="tree__branches" style={{ "--branches": house.branches.length } as React.CSSProperties}>
                {house.branches.map((b, bi) => (
                  <div className="branch" key={b.relation} data-kind={b.kind}>
                    <StaggerItem className="branch__head" y={-8}>
                      <div className="ribbon" data-node="ribbon" title={b.epithet}>
                        <span className="ribbon__title">{b.title}</span>
                        <span className="ribbon__sub">
                          {b.relation} · {b.count}
                        </span>
                      </div>
                    </StaggerItem>
                    <ol className="branch__members">
                      {house.members
                        .filter((m) => m.relation === b.relation)
                        .map((m) => (
                          <li key={m.address} data-node="member" data-branch={bi}>
                            <StaggerItem scale={0.85} y={6} spring="bouncy">
                              <CrestNode
                                address={m.address}
                                size={stacked ? 48 : 56}
                                role={kindTitle(m.kind)}
                                relation={m.relation}
                                at={m.at}
                                label={m.label}
                                txHash={m.txHash}
                                chain="ethereum"
                                {...nodeProps(m.address)}
                              />
                              <span className="node__meta">
                                {m.label ? <b>{m.label}</b> : null}
                                <span>
                                  {m.relation}
                                  {m.at ? ` · ${formatDate(m.at)}` : ""}
                                </span>
                              </span>
                            </StaggerItem>
                          </li>
                        ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : (
              <StaggerItem className="tree__empty">The patriarch stands alone. No kin on record.</StaggerItem>
            )}
          </div>
        </Stagger>
      </motion.div>
    </section>
  );
}
