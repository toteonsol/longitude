import { APP_BY_ID, type AppId } from "./apps";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Where an app lives. Production: NEXT_PUBLIC_APP_URL_TEMPLATE with `{id}` replaced
 * (default https://longitude-{id}.vercel.app). Development: localhost on the app's port.
 */
export function appUrl(id: AppId): string {
  const explicit = process.env[`NEXT_PUBLIC_APP_URL_${id.toUpperCase().replace(/-/g, "_")}`];
  if (explicit) return explicit;
  if (isDev) return `http://localhost:${APP_BY_ID[id].port}`;
  // "||" on purpose: an empty value in .env must fall through to the default, not become new URL("").
  const template = process.env.NEXT_PUBLIC_APP_URL_TEMPLATE || "https://longitude-{id}.vercel.app";
  return template.replace("{id}", id);
}

export function storeUrl(): string {
  return process.env.NEXT_PUBLIC_STORE_URL || (isDev ? "http://localhost:3000" : "https://longitude.vercel.app");
}
