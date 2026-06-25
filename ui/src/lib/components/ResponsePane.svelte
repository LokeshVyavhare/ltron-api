<script lang="ts">
  import type { ExecutionResult } from '../ipc/types';
  import type { Request, Example } from '../models';
  import { newId } from '../models';
  import { saveExample } from '../storage/store';
  import { appState } from '../state/app.svelte';

  interface Props {
    result: ExecutionResult | null;
    error: string | null;
    loading: boolean;
    activeRequest: Request | null;
    example?: Example | null;
  }
  let { result, error, loading, activeRequest, example = null }: Props = $props();

  let tab = $state<'body' | 'headers'>('body');
  let copied = $state(false);
  let savedExample = $state(false);

  // When an example is selected, build a synthetic display from it
  let displayResult = $derived.by((): ExecutionResult | null => {
    if (example) {
      return {
        execution_id: example.id,
        status: example.status_code,
        headers: example.headers,
        final_url: '',
        body_size: example.body.length,
        body_base64: btoa(unescape(encodeURIComponent(example.body))),
        body_is_text: example.body_is_text,
        latency_ms: 0,
        ttfb_ms: 0,
      };
    }
    return result;
  });

  let tab = $state<'body' | 'headers'>('body');
  let copied = $state(false);
  let savedExample = $state(false);

  function statusColor(s: number): string {
    if (s >= 200 && s < 300) return 'var(--ok)';
    if (s >= 300 && s < 400) return 'var(--accent)';
    if (s >= 400 && s < 500) return 'var(--warn)';
    if (s >= 500) return 'var(--err)';
    return 'var(--fg-3)';
  }

  function formatSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function decodeBody(b64: string): string {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      return '';
    }
  }

  let decodedBody = $derived(displayResult && displayResult.body_is_text ? decodeBody(displayResult.body_base64) : '');

  let isJson = $derived.by(() => {
    if (!displayResult) return false;
    const ct = (displayResult.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '').toLowerCase();
    return ct.includes('json') || ct.includes('+json');
  });

  let prettyBody = $derived.by(() => {
    if (!displayResult || !displayResult.body_is_text) return '';
    if (isJson) {
      try { return JSON.stringify(JSON.parse(decodedBody), null, 2); } catch { return decodedBody; }
    }
    return decodedBody;
  });

  // ── JSON syntax highlight ─────────────────────────────────────
  function highlight(json: string): string {
    return json.replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span class="jk">${match}</span>`;
          return `<span class="jv">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="jb">${match}</span>`;
        if (/null/.test(match)) return `<span class="jn">${match}</span>`;
        return `<span class="jnum">${match}</span>`;
      },
    );
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let highlightedBody = $derived(isJson && prettyBody ? highlight(escapeHtml(prettyBody)) : '');

  // ── Copy ─────────────────────────────────────────────────────
  async function onCopy() {
    const text = tab === 'body'
      ? prettyBody
      : result!.headers.map((h) => `${h.key}: ${h.value}`).join('\n');
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  // ── Save as Example ──────────────────────────────────────────
  async function onSaveExample() {
    if (!result || !activeRequest || !appState.workspace) return;
    const now = Date.now();
    const req = activeRequest;
    const example: import('../models').Example = {
      schema_version: 1,
      id: newId(),
      request_id: req.id,
      collection_id: req.collection_id,
      folder_id: req.folder_id,
      name: `${req.name} — ${result.status}`,
      status_code: result.status,
      headers: result.headers,
      body: prettyBody,
      body_is_text: result.body_is_text,
      created_at: now,
    };
    await saveExample(appState.workspace.id, example);
    appState.examples = [...appState.examples, example];
    savedExample = true;
    setTimeout(() => (savedExample = false), 2000);
  }
</script>

<section class="response">
  {#if example}
    <div class="example-banner">📌 Example: {example.name}</div>
  {/if}
  <div class="status-bar">
    {#if loading}
      <span class="dim">Sending…</span>
    {:else if error}
      <span class="err-msg">{error}</span>
    {:else if displayResult}
      <span class="status-badge" style:background={statusColor(displayResult.status) + '22'} style:color={statusColor(displayResult.status)}>
        {displayResult.status}
      </span>
      {#if !example}
        <span class="pill">{displayResult.latency_ms} ms</span>
      {/if}
      <span class="pill">{formatSize(displayResult.body_size)}</span>
      {#if displayResult.final_url}
        <span class="url-chip mono" title={displayResult.final_url}>{displayResult.final_url}</span>
      {/if}
      <div class="actions">
        <button class="action-btn" onclick={onCopy} title="Copy">
          {#if copied}✓ Copied{:else}Copy{/if}
        </button>
        {#if !example}
          <button class="action-btn save-btn" onclick={onSaveExample} title="Save as example">
            {#if savedExample}✓ Saved{:else}Save as Example{/if}
          </button>
        {/if}
      </div>
    {:else}
      <span class="muted">Send a request to see the response.</span>
    {/if}
  </div>

  {#if displayResult}
    <div class="tabs">
      <button class:active={tab === 'body'} onclick={() => (tab = 'body')}>Body</button>
      <button class:active={tab === 'headers'} onclick={() => (tab = 'headers')}>Headers ({displayResult.headers.length})</button>
    </div>

    {#if tab === 'body'}
      <div class="body-wrap">
        {#if !displayResult.body_is_text}
          <div class="empty-state muted">Binary body ({formatSize(displayResult.body_size)}). Text preview disabled.</div>
        {:else if isJson}
          <pre class="json-view mono">{@html highlightedBody}</pre>
        {:else}
          <pre class="plain-view mono">{prettyBody}</pre>
        {/if}
      </div>
    {:else}
      <div class="headers-wrap">
        <table>
          <tbody>
            {#each displayResult.headers as h}
              <tr>
                <td class="hk mono">{h.key}</td>
                <td class="hv mono">{h.value}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</section>

<style>
  .response {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--bg-1);
  }
  .example-banner {
    padding: 5px 12px;
    font-size: 11px;
    background: var(--accent-dim);
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    font-weight: 500;
    letter-spacing: 0.2px;
  }

  /* ── Status bar ── */
  .status-bar {
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    background: var(--bg-2);
    flex-shrink: 0;
    min-height: 38px;
  }
  .status-badge {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .pill {
    font-size: 11px;
    color: var(--fg-2);
    background: var(--bg-3);
    padding: 2px 7px;
    border-radius: 4px;
    flex-shrink: 0;
    font-family: var(--mono);
  }
  .url-chip {
    font-size: 11px;
    color: var(--fg-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .err-msg { color: var(--err); font-size: 12px; }
  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
    flex-shrink: 0;
  }
  .action-btn {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 4px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--fg-2);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .action-btn:hover { background: var(--bg-4); color: var(--fg-1); }
  .save-btn { color: var(--accent); border-color: var(--accent); }
  .save-btn:hover { background: var(--accent-dim); }

  /* ── Tabs ── */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg-2);
    flex-shrink: 0;
  }
  .tabs button {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 7px 16px;
    font-size: 12px;
    color: var(--fg-2);
    cursor: pointer;
  }
  .tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: var(--accent-dim);
  }

  /* ── Body ── */
  .body-wrap, .headers-wrap {
    flex: 1;
    overflow: auto;
    padding: 0;
  }
  .empty-state {
    padding: 20px;
    font-size: 12px;
  }
  pre {
    margin: 0;
    padding: 16px;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ── JSON syntax colors ── */
  :global(.json-view .jk)   { color: #818cf8; }   /* key   — indigo/accent */
  :global(.json-view .jv)   { color: #34d399; }   /* string value — emerald */
  :global(.json-view .jnum) { color: #fbbf24; }   /* number — amber */
  :global(.json-view .jb)   { color: #fb7185; }   /* boolean — rose */
  :global(.json-view .jn)   { color: #8888a0; }   /* null — muted */

  /* ── Headers table ── */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 5px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    font-size: 12px;
    word-break: break-all;
    line-height: 1.5;
  }
  td.hk {
    color: var(--accent);
    width: 30%;
    min-width: 140px;
    font-weight: 500;
  }
  td.hv { color: var(--fg-1); }
</style>
