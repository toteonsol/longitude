import { handleFor, isValidId, newId } from "@longitude/social/identity";
import type { Identity } from "@longitude/social/types";

export const UID_COOKIE = "lg_uid";
export const UID_STORAGE = "longitude:uid";
export const UID_HEADER = "x-lg-uid";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1] as string) : undefined;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The visitor's anonymous identity on this origin. Order of truth: `?u=` in the URL (handed over
 * from the store or another app), the cookie, localStorage, else a fresh id. Persists to all three.
 * Browser only: call from effects.
 */
export function getIdentity(): Identity {
  let id: string | undefined;
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("u");
    if (isValidId(fromUrl)) id = fromUrl;
  } catch {
    /* not in a browser */
  }
  if (!id) {
    const c = readCookie(UID_COOKIE);
    if (isValidId(c)) id = c;
  }
  if (!id) {
    try {
      const s = localStorage.getItem(UID_STORAGE);
      if (isValidId(s)) id = s;
    } catch {
      /* private mode */
    }
  }
  if (!id) id = newId();
  writeCookie(UID_COOKIE, id);
  try {
    localStorage.setItem(UID_STORAGE, id);
  } catch {
    /* ignore */
  }
  return { id, handle: handleFor(id) };
}

/** Append the visitor id to a link to another LONGITUDE origin so the passport follows them. */
export function withIdentity(url: string, id: string | undefined): string {
  if (!id) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("u", id);
    return u.toString();
  } catch {
    return url;
  }
}
