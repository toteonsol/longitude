const ADJECTIVES = [
  "Quiet", "Bold", "Patient", "Restless", "Golden", "Silver", "Midnight", "Amber", "Velvet", "Iron",
  "Lucky", "Clever", "Steady", "Wild", "Gentle", "Sharp", "Hidden", "Bright", "Frozen", "Swift",
  "Brave", "Calm", "Curious", "Dusty", "Electric", "Fearless", "Glass", "Humble", "Jade", "Keen",
  "Loyal", "Marble", "Nimble", "Oaken", "Proud", "Rapid", "Silent", "Tidal", "Vivid", "Wise",
] as const;

const ANIMALS = [
  "Fox", "Heron", "Otter", "Lynx", "Falcon", "Badger", "Whale", "Sparrow", "Wolf", "Tortoise",
  "Hare", "Raven", "Ibis", "Marten", "Puffin", "Stag", "Salmon", "Owl", "Bison", "Cobra",
  "Dolphin", "Eagle", "Ferret", "Gecko", "Hawk", "Jackal", "Koala", "Lemur", "Moose", "Newt",
  "Osprey", "Panda", "Quail", "Robin", "Seal", "Tapir", "Viper", "Walrus", "Yak", "Zebra",
] as const;

export const ID_RE = /^[a-z0-9-]{8,40}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

function fnv(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Deterministic, readable handle from an anonymous id: "Quiet Fox 42". */
export function handleFor(id: string): string {
  const h = fnv(id);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length];
  const num = (Math.floor(h / (ADJECTIVES.length * ANIMALS.length)) % 97) + 1;
  return `${adj} ${animal} ${num}`;
}

/** A fresh anonymous id. Uses Web Crypto when present (browser, Node 19+). */
export function newId(): string {
  const bytes = new Uint8Array(12);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => unknown } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortId(id: string): string {
  return id.slice(0, 6);
}
