<script lang="ts">
  import { appState, activeRequest } from '../state/app.svelte';
  import { saveRequest, deleteRequest } from '../storage/store';
  import { emptyRequest } from '../models';

  interface Props {
    onselect: (id: string) => void;
    onnew: () => void;
    ondelete: (id: string) => void;
    onopen_globals: () => void;
    onexport: () => void;
    onimport: () => void;
  }
  let { onselect, onnew, ondelete, onopen_globals, onexport, onimport }: Props = $props();

  let menuOpen = $state(false);

  function methodColor(m: string): string {
    switch (m) {
      case 'GET': return 'var(--ok)';
      case 'POST': return 'var(--accent)';
      case 'PUT': return 'var(--warn)';
      case 'PATCH': return 'var(--warn)';
      case 'DELETE': return 'var(--err)';
      default: return 'var(--fg-3)';
    }
  }
</script>

<aside class="sidebar">
  <div class="top">
    <div class="ws-name" title={appState.workspace?.name}>
      {appState.workspace?.name ?? '—'}
    </div>
    <button class="env-btn" onclick={onopen_globals} title="Edit global variables">{'{ }'}</button>
    <div class="menu-wrap">
      <button class="env-btn" onclick={() => (menuOpen = !menuOpen)} title="More">⋯</button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="menu" onclick={() => (menuOpen = false)}>
          <button onclick={onexport}>Export…</button>
          <button onclick={onimport}>Import…</button>
        </div>
      {/if}
    </div>
  </div>

  <div class="coll-header">
    <span class="coll-name">{appState.collection?.name ?? '—'}</span>
    <button class="add" onclick={onnew} title="New request">+</button>
  </div>

  <ul class="req-list">
    {#each appState.requests as r (r.id)}
      <li class:active={r.id === appState.activeRequestId}>
        <button class="req-item" onclick={() => onselect(r.id)}>
          <span class="method" style:color={methodColor(r.method)}>{r.method}</span>
          <span class="name" title={r.name}>{r.name}</span>
        </button>
        <button class="del" onclick={(e) => { e.stopPropagation(); ondelete(r.id); }} title="Delete">×</button>
      </li>
    {/each}
    {#if appState.requests.length === 0}
      <li class="empty muted">No saved requests</li>
    {/if}
  </ul>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--bg-2);
    border-right: 1px solid var(--border);
    overflow: hidden;
    height: 100%;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .ws-name {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .env-btn {
    padding: 2px 6px;
    font-family: var(--mono);
    font-size: 11px;
  }
  .menu-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 50;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .menu button {
    background: transparent;
    border: none;
    border-radius: 0;
    text-align: left;
    padding: 8px 12px;
    cursor: pointer;
  }
  .menu button:hover {
    background: var(--bg-3);
  }
  .coll-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    color: var(--fg-2);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .coll-name {
    flex: 1;
  }
  .add {
    width: 22px;
    height: 22px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
  }
  .req-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }
  .req-list li {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .req-list li.active {
    background: var(--bg-3);
  }
  .req-list li.empty {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    border-bottom: none;
  }
  .req-item {
    flex: 1;
    background: transparent;
    border: none;
    text-align: left;
    padding: 8px 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    cursor: pointer;
    color: inherit;
    border-radius: 0;
    overflow: hidden;
  }
  .req-item:hover {
    background: var(--bg-3);
  }
  .method {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    min-width: 44px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .del {
    background: transparent;
    border: none;
    color: var(--fg-3);
    font-size: 16px;
    padding: 0 8px;
    cursor: pointer;
  }
  .del:hover {
    color: var(--err);
  }
</style>
