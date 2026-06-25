<script lang="ts">
  import type { HistoryEntry } from '../models';

  interface Props {
    entries: HistoryEntry[];
    onselect: (entry: HistoryEntry) => void;
  }
  let { entries, onselect }: Props = $props();

  function statusColor(s: number | null): string {
    if (!s) return 'var(--err)';
    if (s >= 200 && s < 300) return 'var(--ok)';
    if (s >= 300 && s < 400) return 'var(--accent)';
    if (s >= 400 && s < 500) return 'var(--warn)';
    return 'var(--err)';
  }

  function methodColor(m: string): string {
    const map: Record<string, string> = {
      GET: 'var(--ok)', POST: 'var(--accent)', PUT: 'var(--warn)',
      PATCH: 'var(--warn)', DELETE: 'var(--err)',
    };
    return map[m] ?? 'var(--fg-3)';
  }

  function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }
</script>

<div class="history-pane">
  <div class="header">History</div>
  {#if entries.length === 0}
    <div class="empty muted">No history yet.</div>
  {:else}
    <ul class="list">
      {#each entries as entry (entry.id)}
        <li>
          <button class="item" onclick={() => onselect(entry)}>
            <span class="method" style:color={methodColor(entry.method)}>{entry.method}</span>
            <span class="url" title={entry.url}>{entry.url}</span>
            <span class="meta">
              {#if entry.status_code}
                <span style:color={statusColor(entry.status_code)}>{entry.status_code}</span>
              {:else}
                <span class="err">{entry.error_kind ?? 'err'}</span>
              {/if}
              <span class="dim">{relativeTime(entry.executed_at)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .history-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    border-top: 1px solid var(--border);
  }
  .header {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--fg-3);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .empty {
    padding: 12px;
    font-size: 12px;
    text-align: center;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 6px 10px;
    text-align: left;
    cursor: pointer;
    color: inherit;
    min-width: 0;
  }
  .item:hover { background: var(--accent-dim); }
  .method {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    min-width: 44px;
    flex-shrink: 0;
  }
  .url {
    flex: 1;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg-2);
    font-family: var(--mono);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    font-size: 11px;
    font-family: var(--mono);
  }
  .err { color: var(--err); }
  .dim { color: var(--fg-3); }
</style>
