export interface Palette {
  /** Page background. */
  bg: string;
  /** Card / panel surface. */
  surface: string;
  /** Primary accent (glow color on the globe). */
  accent: string;
  /** Secondary accent. */
  accent2: string;
  /** Text color on bg. */
  ink: string;
}

export interface AppMeta {
  id: AppId;
  name: string;
  /** Dev port; production URLs come from NEXT_PUBLIC_APP_URL_TEMPLATE. */
  port: number;
  tagline: string;
  /** The one plain-language sentence shown on first load. */
  explainer: string;
  world: string;
  signature: string;
  palette: Palette;
  /** Meridian longitude on the store globe, degrees. */
  lon: number;
}

export type AppId =
  | "rookie-scout"
  | "two-faced"
  | "exit-clock"
  | "odds-vs-flow"
  | "last-ones-out"
  | "dynasties"
  | "menagerie"
  | "rewind"
  | "wallet-obituaries"
  | "as-the-chain-turns";

export const APPS: readonly AppMeta[] = [
  {
    id: "rookie-scout",
    name: "Rookie Scout",
    port: 4101,
    tagline: "Draft the next smart money before the label lands.",
    explainer:
      "These wallets trade like Nansen's proven smart money but don't carry the label yet. Flip a card to see how close each one is.",
    world: "Sports draft room: turf green, chalk lines, trading cards.",
    signature: "Prospect cards flip to reveal a scouting report with a similarity score to real smart money.",
    palette: { bg: "#0b3d1f", surface: "#10502a", accent: "#f3f4e6", accent2: "#d4af37", ink: "#f3f4e6" },
    lon: 0,
  },
  {
    id: "two-faced",
    name: "Two-Faced",
    port: 4102,
    tagline: "Every wallet wears two masks.",
    explainer:
      "One wallet, two personalities: how it trades tokens on the spot market versus how it bets with leverage on perps. Drag the slider to swap masks.",
    world: "Theater masks, a split screen that's light on one side and dark on the other.",
    signature: "Drag a slider across a wallet to morph its spot face into its perp face.",
    palette: { bg: "#14141a", surface: "#f5f0e6", accent: "#b3122e", accent2: "#f5f0e6", ink: "#f5f0e6" },
    lon: 36,
  },
  {
    id: "exit-clock",
    name: "Exit Clock",
    port: 4103,
    tagline: "Every holder is a hand. Every hand is counting down.",
    explainer:
      "Each hand is a smart money wallet holding this token, counting down to when it usually sells. When hands reach zero, the exits begin.",
    world: "Brutalist watchmaker: concrete, brass, precision dials.",
    signature: "Each smart money holder is a ticking hand counting down to its typical sell time.",
    palette: { bg: "#3b3b38", surface: "#6b6b66", accent: "#b08d57", accent2: "#e8e4d8", ink: "#f2efe6" },
    lon: 72,
  },
  {
    id: "odds-vs-flow",
    name: "Odds vs Flow",
    port: 4104,
    tagline: "The crowd bets. Smart money moves. Who's pulling harder?",
    explainer:
      "The crowd sets odds on prediction markets. Smart money moves real capital on-chain. The rope shows who is pulling harder right now.",
    world: "A betting slip on one side, a flowing river on the other.",
    signature: "A live tug of war rope between crowd odds and smart money flow.",
    palette: { bg: "#fbf6e3", surface: "#ffffff", accent: "#1c4f8c", accent2: "#d7263d", ink: "#1b1b1b" },
    lon: 108,
  },
  {
    id: "last-ones-out",
    name: "Last Ones Out",
    port: 4105,
    tagline: "Smart money left. Someone's still home.",
    explainer:
      "Every lit window is a token that retail still holds while smart money has already left. Watch the lights go out.",
    world: "A city skyline at night.",
    signature: "Each lit window is a token retail still holds; windows go dark as smart money leaves.",
    palette: { bg: "#060a1a", surface: "#0e1430", accent: "#ffc45c", accent2: "#5b6cff", ink: "#e9ecff" },
    lon: 144,
  },
  {
    id: "dynasties",
    name: "Dynasties",
    port: 4106,
    tagline: "Every wallet has a bloodline.",
    explainer:
      "Wallets have families: the wallet that first funded them and the wallets they fund. Each coat of arms is drawn from the address itself.",
    world: "Royal heraldry: navy, gold, generated coats of arms.",
    signature: "Family trees unfurl like tapestry; crests are generated from each address.",
    palette: { bg: "#0d1b3d", surface: "#132552", accent: "#c9a227", accent2: "#f1e7c9", ink: "#f1e7c9" },
    lon: 180,
  },
  {
    id: "menagerie",
    name: "MENAGERIE",
    port: 4107,
    tagline: "A field guide to the species of smart money.",
    explainer:
      "Smart money wallets sorted into species by how they behave. Tap an animal to read its field notes.",
    world: "Naturalist's field journal, ink and watercolor.",
    signature: "Animals roam a savanna; tap one to open its field notes.",
    palette: { bg: "#efe6cf", surface: "#f8f2e2", accent: "#6f8f4d", accent2: "#2b2118", ink: "#2b2118" },
    lon: 216,
  },
  {
    id: "rewind",
    name: "Rewind",
    port: 4108,
    tagline: "Go back. Make the call. Press play.",
    explainer:
      "Pick a real date in the past, guess which token smart money was right about, then press play to see what happened next.",
    world: "VHS tape deck, scan lines, chunky buttons.",
    signature: "Scrub a real past date with a tape wheel, lock your call, then hit play for the reveal.",
    palette: { bg: "#0a0a0a", surface: "#161616", accent: "#ff3ea5", accent2: "#2be0ff", ink: "#f2f2f2" },
    lon: 252,
  },
  {
    id: "wallet-obituaries",
    name: "Wallet Obituaries",
    port: 4109,
    tagline: "In memoriam: the wallets that sold it all.",
    explainer:
      "Today's front page remembers wallets that sold everything. Every headline is a real exit, typeset as it happened.",
    world: "Broadsheet newspaper, serif type, sepia.",
    signature: "A fresh front page each day; headlines typeset themselves in.",
    palette: { bg: "#e9dcc3", surface: "#f4ecd9", accent: "#8b0000", accent2: "#241f1a", ink: "#241f1a" },
    lon: 288,
  },
  {
    id: "as-the-chain-turns",
    name: "As The Chain Turns",
    port: 4110,
    tagline: "Tune in. The wallets have feelings.",
    explainer:
      "The last 24 hours of smart money trading, told as a daytime soap. The cast is real wallets and the drama is real trades.",
    world: "Daytime TV soap: title cards, dramatic zooms.",
    signature: "An episode player with cast cards for each wallet character.",
    palette: { bg: "#ffd6e0", surface: "#fff2f6", accent: "#2a6fdb", accent2: "#f5c518", ink: "#2a1a22" },
    lon: 324,
  },
];

export const APP_BY_ID: Readonly<Record<AppId, AppMeta>> = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<
  AppId,
  AppMeta
>;

export function getApp(id: AppId): AppMeta {
  return APP_BY_ID[id];
}
