import type { paths } from "./generated/openapi";

export type ApiPaths = paths;

/** Every path with a POST operation, e.g. "/api/v1/smart-money/netflow". */
export type PostEndpoint = { [P in keyof paths]: paths[P] extends { post: unknown } ? P : never }[keyof paths];
/** Every path with a GET operation, e.g. "/api/v1/account". */
export type GetEndpoint = { [P in keyof paths]: paths[P] extends { get: unknown } ? P : never }[keyof paths];

type Op<P extends keyof paths, M extends "get" | "post"> = paths[P] extends Record<M, infer O> ? O : never;

type JsonBodyOf<O> = O extends { requestBody: { content: { "application/json": infer B } } }
  ? B
  : O extends { requestBody?: { content: { "application/json": infer B } } }
    ? B | undefined
    : undefined;

type JsonResponseOf<O> = O extends { responses: { 200: { content: { "application/json": infer R } } } } ? R : unknown;

export type RequestBody<P extends PostEndpoint> = JsonBodyOf<Op<P, "post">>;
export type ResponseOf<P extends PostEndpoint> = JsonResponseOf<Op<P, "post">>;
export type GetResponseOf<P extends GetEndpoint> = JsonResponseOf<Op<P, "get">>;

/** Row type of a `{ data: T[] }` response. */
export type RowOf<P extends PostEndpoint> =
  ResponseOf<P> extends { data?: infer D } ? (D extends readonly (infer R)[] ? R : never) : never;

export interface Pagination {
  page?: number;
  per_page?: number;
}

export interface PageInfo {
  page?: number;
  per_page?: number;
  is_last_page?: boolean;
}

export interface OrderBy {
  field: string;
  direction: "ASC" | "DESC";
}

export interface DateRange {
  from: string;
  to: string;
}

/** Turn a docs-style short name ("smart-money/netflow", "beta/tgm/historical-top-holders") into a full path. */
export function fullPath(endpoint: string): string {
  if (endpoint.startsWith("/")) return endpoint;
  if (endpoint.startsWith("beta/")) return `/api/v1beta1/${endpoint.slice(5)}`;
  return `/api/v1/${endpoint}`;
}
