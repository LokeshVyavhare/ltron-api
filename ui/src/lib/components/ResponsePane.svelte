<script lang="ts">
  import type { ExecutionResult } from '../ipc/types';

  interface Props {
    result: ExecutionResult | null;
    error: string | null;
    loading: boolean;
  }
  let { result, error, loading }: Props = $props();

  let tab = $state<'body' | 'headers'>('body');

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

  let decodedBody = $derived(result && result.body_is_text ? decodeBody(result.body_base64) : '');

  let prettyBody = $derived.by(() => {
    if (!result || !result.body_is_text) return '';
    const ct = (result.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '').toLowerCase();
    if (ct.includes('json') || ct.includes('+json')) {
      try {
        return JSON.stringify(JSON.parse(decodedBody), null, 2);
      } catch {
        return decodedBody;
      }
    }
    return decodedBody;
  });
</script>

<section class="response">
  <div class="status-bar">
    {#if loading}
      <span class="dim">Sending…</span>
    {:else if error}
      <span class="err">{error}</span>
    {:else if result}
      <span class="status" style:color={statusColor(result.status)}>{result.status}</span>
      <span class="muted">{result.latency_ms} ms</span>
      <span class="muted">{formatSize(result.body_size)}</span>
      <span class="muted dim" title={result.final_url}>{result.final_url}</span>
    {:else}
      <span class="muted">Send a request to see the response.</span>
    {/if}
  </div>

  {#if result}
    <div class="tabs">
      <button class:active={tab === 'body'} onclick={() => (tab = 'body')}>Body</button>
      <button class:active={tab === 'headers'} onclick={() => (tab = 'headers')}>Headers ({result.headers.length})</button>
    </div>

    {#if tab === 'body'}
      <div class="body">
        {#if !result.body_is_text}
          <div class="muted">Binary body ({formatSize(result.body_size)}). Text preview disabled.</div>
        {:else}
          <pre class="mono">{prettyBody}</pre>
        {/if}
      </div>
    {:else}
      <div class="headers">
        <table>
          <tbody>
            {#each result.headers as h}
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
  .status-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    background: var(--bg-2);
  }
  .status {
    font-weight: 700;
    font-family: var(--mono);
  }
  .err {
    color: var(--err);
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg-2);
  }
  .tabs button {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 8px 16px;
    color: var(--fg-2);
    cursor: pointer;
  }
  .tabs button.active {
    color: var(--fg-1);
    border-bottom-color: var(--accent);
  }
  .body, .headers {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.5;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    font-size: 12px;
    word-break: break-all;
  }
  td.hk {
    color: var(--fg-2);
    width: 30%;
    min-width: 120px;
  }
</style>
