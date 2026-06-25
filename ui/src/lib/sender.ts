import type { Request, HeaderRow, QueryRow } from './lib-types';
import type {
  ExecutionResult,
  KV,
  NativeBody,
  NativeRequest,
} from './ipc/types';
import { httpSend } from './ipc/http';
import { resolve, type VariableContext } from './interpolation';
import { SUBTYPE_CONTENT_TYPE } from './models';
import type { Variable } from './models';

/** Build variable context. Env vars override globals (env > global). */
export function buildVariableContext(
  globalVars: Variable[],
  envVars: Variable[] = [],
): VariableContext {
  const values: Record<string, string> = {};
  // Global first (lower precedence)
  for (const v of globalVars) {
    if (!v.enabled || !v.key) continue;
    values[v.key] = v.value;
  }
  // Env overrides
  for (const v of envVars) {
    if (!v.enabled || !v.key) continue;
    values[v.key] = v.value;
  }
  return { values };
}

function interpolateKV(rows: (HeaderRow | QueryRow)[], ctx: VariableContext): KV[] {
  return rows
    .filter((r) => r.enabled && r.key.length > 0)
    .map((r) => ({
      key: resolve(r.key, ctx),
      value: resolve(r.value, ctx),
    }));
}

function applyAuth(req: Request, ctx: VariableContext, headers: KV[], queryParams: KV[]): void {
  const auth = req.auth ?? { kind: 'none' };
  if (auth.kind === 'none') return;
  if (auth.kind === 'bearer') {
    const tok = resolve(auth.token, ctx);
    if (tok) headers.push({ key: 'Authorization', value: `Bearer ${tok}` });
    return;
  }
  if (auth.kind === 'basic') {
    const u = resolve(auth.username, ctx);
    const p = resolve(auth.password, ctx);
    if (u || p) {
      const credentials = btoa(`${u}:${p}`);
      headers.push({ key: 'Authorization', value: `Basic ${credentials}` });
    }
    return;
  }
  if (auth.kind === 'api_key') {
    const k = resolve(auth.key, ctx);
    const v = resolve(auth.value, ctx);
    if (!k) return;
    if (auth.in === 'header') headers.push({ key: k, value: v });
    else queryParams.push({ key: k, value: v });
  }
}

export function buildNativeRequest(req: Request, ctx: VariableContext): NativeRequest {
  const url = resolve(req.url, ctx);
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }
  const headers = interpolateKV(req.headers, ctx);
  const queryParams = interpolateKV(req.query_params, ctx);
  applyAuth(req, ctx, headers, queryParams);

  let body: NativeBody;
  if (req.body_mode === 'none' || req.body.kind === 'none') {
    body = { kind: 'none' };
  } else if (req.body_mode === 'raw' && req.body.kind === 'raw') {
    body = {
      kind: 'raw',
      content_type: SUBTYPE_CONTENT_TYPE[req.body.subtype],
      text: resolve(req.body.text, ctx),
    };
  } else if (req.body_mode === 'urlencoded' && req.body.kind === 'urlencoded') {
    body = {
      kind: 'urlencoded',
      fields: interpolateKV(req.body.fields, ctx),
    };
  } else {
    body = { kind: 'none' };
  }

  return {
    method: req.method,
    url,
    headers,
    query_params: queryParams,
    body,
    timeout_ms: req.timeout_ms,
    follow_redirects: req.follow_redirects,
    verify_tls: req.verify_tls,
  };
}

export async function send(req: Request, ctx: VariableContext): Promise<ExecutionResult> {
  const native = buildNativeRequest(req, ctx);
  return await httpSend(native);
}
