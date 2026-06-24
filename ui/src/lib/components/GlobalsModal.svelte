<script lang="ts">
  import type { Variable } from '../models';
  import { appState } from '../state/app.svelte';
  import { saveGlobals } from '../storage/store';

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let vars = $state<Variable[]>(
    appState.globals
      ? [...appState.globals.variables, { key: '', value: '', is_secret: false, enabled: true }]
      : [{ key: '', value: '', is_secret: false, enabled: true }]
  );

  function ensureTrailing(next: Variable[]): Variable[] {
    const last = next[next.length - 1];
    if (!last || last.key || last.value) {
      return [...next, { key: '', value: '', is_secret: false, enabled: true }];
    }
    return next;
  }

  function update(i: number, patch: Partial<Variable>) {
    vars = ensureTrailing(vars.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function remove(i: number) {
    vars = ensureTrailing(vars.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!appState.globals) {
      onclose();
      return;
    }
    const cleaned = vars.filter((v) => v.key.trim().length > 0);
    const g = { ...appState.globals, variables: cleaned };
    await saveGlobals(g);
    appState.globals = g;
    onclose();
  }
</script>

<div class="overlay" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <header>
      <h2>Global Variables</h2>
      <button class="x" onclick={onclose} aria-label="Close">×</button>
    </header>
    <p class="muted">
      Use as <code>{'{{key}}'}</code> in URLs, headers, params, and body. Secret values are masked
      in this list and excluded from JSON exports by default.
    </p>
    <div class="vars">
      <div class="row header">
        <div class="cb"></div>
        <div>Key</div>
        <div>Value</div>
        <div class="sec">Secret</div>
        <div class="del"></div>
      </div>
      {#each vars as v, i (i)}
        <div class="row" class:disabled={!v.enabled}>
          <div class="cb">
            <input
              type="checkbox"
              checked={v.enabled}
              onchange={(e) => update(i, { enabled: (e.target as HTMLInputElement).checked })}
            />
          </div>
          <input
            type="text"
            value={v.key}
            placeholder="key"
            oninput={(e) => update(i, { key: (e.target as HTMLInputElement).value })}
          />
          <input
            type={v.is_secret ? 'password' : 'text'}
            value={v.value}
            placeholder="value"
            oninput={(e) => update(i, { value: (e.target as HTMLInputElement).value })}
          />
          <div class="sec">
            <input
              type="checkbox"
              checked={v.is_secret}
              onchange={(e) => update(i, { is_secret: (e.target as HTMLInputElement).checked })}
            />
          </div>
          <div class="del">
            {#if i < vars.length - 1 || v.key || v.value}
              <button onclick={() => remove(i)}>×</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <footer>
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={save}>Save</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 700px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  header h2 {
    flex: 1;
    margin: 0;
    font-size: 14px;
  }
  .x {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
  }
  p {
    margin: 12px 16px;
    font-size: 12px;
  }
  code {
    background: var(--bg-2);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: var(--mono);
  }
  .vars {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px;
  }
  .row {
    display: grid;
    grid-template-columns: 32px 1fr 1.5fr 60px 28px;
    gap: 6px;
    align-items: center;
    padding: 4px 0;
  }
  .row.header {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--fg-2);
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
    padding-bottom: 6px;
  }
  .row.disabled input[type="text"], .row.disabled input[type="password"] {
    color: var(--fg-3);
  }
  .cb, .sec, .del {
    display: flex;
    justify-content: center;
  }
  footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
</style>
