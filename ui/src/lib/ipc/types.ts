export type AppErrorKind =
  | 'Io'
  | 'NotFound'
  | 'Permission'
  | 'Validation'
  | 'Cancelled'
  | 'NetworkDns'
  | 'NetworkTls'
  | 'NetworkTimeout'
  | 'NetworkOther';

export interface AppErrorJson {
  kind: AppErrorKind;
  message: string;
}

export interface DirEntry {
  name: string;
  is_dir: boolean;
}

export interface FileStat {
  size: number;
  modified_ms: number;
  is_dir: boolean;
}

export interface KV {
  key: string;
  value: string;
}

export type NativeBody =
  | { kind: 'none' }
  | { kind: 'raw'; content_type: string; text: string }
  | { kind: 'urlencoded'; fields: KV[] };

export interface NativeRequest {
  method: string;
  url: string;
  headers: KV[];
  query_params: KV[];
  body: NativeBody;
  timeout_ms: number | null;
  follow_redirects: boolean;
  verify_tls: boolean;
}

export interface ExecutionResult {
  execution_id: string;
  status: number;
  headers: KV[];
  final_url: string;
  body_size: number;
  body_base64: string;
  body_is_text: boolean;
  latency_ms: number;
  ttfb_ms: number;
}
