import type { KV } from '../ipc/types';
export type { KV } from '../ipc/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export type BodyMode = 'none' | 'raw' | 'urlencoded';

export type RawSubtype = 'json' | 'xml' | 'html' | 'text';

export const SUBTYPE_CONTENT_TYPE: Record<RawSubtype, string> = {
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  text: 'text/plain',
};

export interface HeaderRow extends KV {
  enabled: boolean;
}

export interface QueryRow extends KV {
  enabled: boolean;
}

export type Body =
  | { kind: 'none' }
  | { kind: 'raw'; subtype: RawSubtype; text: string }
  | { kind: 'urlencoded'; fields: HeaderRow[] };

export type Auth =
  | { kind: 'none' }
  | { kind: 'bearer'; token: string }
  | { kind: 'basic'; username: string; password: string }
  | { kind: 'api_key'; key: string; value: string; in: 'header' | 'query' };

export interface Request {
  schema_version: 1;
  id: string;
  collection_id: string;
  folder_id: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderRow[];
  query_params: QueryRow[];
  body_mode: BodyMode;
  body: Body;
  auth: Auth;
  timeout_ms: number | null;
  follow_redirects: boolean;
  verify_tls: boolean;
  sort_index: number;
  created_at: number;
  updated_at: number;
}

export interface Environment {
  schema_version: 1;
  id: string;
  workspace_id: string;
  name: string;
  sort_index: number;
  variables: Variable[];
}

export interface Collection {
  schema_version: 1;
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  sort_index: number;
  created_at: number;
  updated_at: number;
}

export interface Folder {
  schema_version: 1;
  id: string;
  collection_id: string;
  workspace_id: string;
  parent_folder_id: string | null; // null = directly under collection
  name: string;
  sort_index: number;
  created_at: number;
  updated_at: number;
}

export interface Workspace {
  schema_version: 1;
  id: string;
  name: string;
  active_environment_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface Variable {
  key: string;
  value: string;
  is_secret: boolean;
  enabled: boolean;
}

export interface Globals {
  schema_version: 1;
  workspace_id: string;
  variables: Variable[];
}

export interface HistoryEntry {
  id: string;
  workspace_id: string;
  request_id: string | null;
  method: string;
  url: string;
  status_code: number | null;
  duration_ms: number | null;
  ttfb_ms: number | null;
  error_kind: string | null;
  executed_at: number;
}

export interface AppSettings {
  schema_version: 1;
  theme: 'system' | 'dark' | 'light';
  history_limit: number;
  default_timeout_ms: number;
  last_active_workspace_id: string | null;
  splitter_widths: { sidebar: number; response: number };
  window_size: { w: number; h: number };
  telemetry_enabled: false;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schema_version: 1,
  theme: 'system',
  history_limit: 1000,
  default_timeout_ms: 30000,
  last_active_workspace_id: null,
  splitter_widths: { sidebar: 260, response: 480 },
  window_size: { w: 1280, h: 800 },
  telemetry_enabled: false,
};

export function emptyRequest(collectionId: string): Request {
  const now = Date.now();
  return {
    schema_version: 1,
    id: newId(),
    collection_id: collectionId,
    folder_id: null,
    name: 'New Request',
    method: 'GET',
    url: 'https://httpbin.org/get',
    headers: [],
    query_params: [],
    body_mode: 'none',
    body: { kind: 'none' },
    auth: { kind: 'none' },
    timeout_ms: null,
    follow_redirects: true,
    verify_tls: true,
    sort_index: now,
    created_at: now,
    updated_at: now,
  };
}

/** Normalize a request loaded from disk that may be missing fields added in later versions. */
export function normalizeRequest(r: any): Request {
  return {
    schema_version: 1,
    id: r.id,
    collection_id: r.collection_id,
    folder_id: r.folder_id ?? null,
    name: r.name ?? 'New Request',
    method: r.method ?? 'GET',
    url: r.url ?? '',
    headers: Array.isArray(r.headers) ? r.headers : [],
    query_params: Array.isArray(r.query_params) ? r.query_params : [],
    body_mode: r.body_mode ?? 'none',
    body: r.body ?? { kind: 'none' },
    auth: r.auth ?? { kind: 'none' },
    timeout_ms: r.timeout_ms ?? null,
    follow_redirects: r.follow_redirects ?? true,
    verify_tls: r.verify_tls ?? true,
    sort_index: r.sort_index ?? Date.now(),
    created_at: r.created_at ?? Date.now(),
    updated_at: r.updated_at ?? Date.now(),
  };
}

export function newId(): string {
  // UUIDv7-ish: time-prefixed ID. Sortable enough for our sort_index defaults.
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${rand.slice(0, 3)}-${rand.slice(3, 7)}-${rand.slice(7, 19)}`;
}
