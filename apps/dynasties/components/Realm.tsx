"use client";
import { NumberTicker, Reveal, fmt } from "@longitude/motion";
import type { DynastiesData } from "@/lib/data";
import { armsOf } from "@/lib/heraldry";
import { Crest } from "./Crest";
import { HouseTree } from "./HouseTree";
import { Rule } from "./Ornaments";

export function Realm({ data }: { data: DynastiesData }) {
  const { realm } = data;
  return (
    <div className="realm">
      <Reveal className="realm__head" spring="slow" y={18}>
        <p className="realm__eyebrow">
          {data.chain} · smart money · {data.timeframeDays}-day PnL leaderboard
        </p>
        <h2 className="realm__title">The Great Houses</h2>
        <Rule className="realm__rule" />
        <p className="realm__lede">
          The best smart money wallets of the month, each with the wallet that gave it its first coin and the wallets it has funded, fed or
          built beside. Every crest is drawn from the address that bears it.
        </p>
        <dl className="realm__stats">
          <div>
            <dd>
              <NumberTicker value={realm.houses} />
            </dd>
            <dt>houses</dt>
          </div>
          <div>
            <dd>
              <NumberTicker value={realm.members} />
            </dd>
            <dt>kin</dt>
          </div>
          <div>
            <dd>
              <NumberTicker value={realm.bloodlines} />
            </dd>
            <dt>bloodlines</dt>
          </div>
          <div>
            <dd>
              <NumberTicker value={realm.founders} />
            </dd>
            <dt>founders known</dt>
          </div>
        </dl>
      </Reveal>

      <div className="realm__houses">
        {data.houses.map((house) => (
          <HouseTree key={house.patriarch.address} house={house} total={data.houses.length} />
        ))}
      </div>

      <Reveal inView className="roll" y={12}>
        <Rule label="Roll of arms" />
        <ol className="roll__list">
          {data.houses.map((house) => {
            const arms = armsOf(house.patriarch.address);
            return (
              <li key={house.patriarch.address}>
                <Crest address={house.patriarch.address} size={34} />
                <div className="roll__text">
                  <b>House {house.name}</b>
                  <span>{arms.blazon}</span>
                </div>
                <span className={`roll__pnl${house.patriarch.pnlUsd < 0 ? " is-neg" : ""}`}>{fmt.usdSigned(house.patriarch.pnlUsd)}</span>
              </li>
            );
          })}
        </ol>
        <p className="roll__note">
          Arms are read off each address. Two bits of its hash choose the partition, the next four the metal and the colour, three more the
          charge, and one in four shields takes a bordure. The same wallet bears the same arms wherever it appears.
        </p>
      </Reveal>
    </div>
  );
}
