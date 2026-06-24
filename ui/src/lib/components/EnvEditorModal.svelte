<script lang="ts">
  import type { Environment, Variable, Globals } from '../models';
  import { newId } from '../models';
  import { appState } from '../state/app.svelte';
  import { saveEnvironment, deleteEnvironment, saveGlobals } from '../storage/store';

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  // ── working copies (snapshot at open) ───────────────────────
  const GLOBAL_ID = '__global__';

  let globalVars = $state<Variable[]>(
    structuredClone($state.snapshot(appState.globals?.variables ?? [])) as Variable[],
  );
  let envs = $state<Environment[]>(
    structuredClone($state.snapshot(appState.environments)) as Environment[],
  );
  // Selected item — GLOBAL_ID or an env id
  let selectedId = $state<string>(GLOBAL_ID);

  function ensureTrailing(vars: Variable[]): Variable[] {
    const last = vars[vars.length - 1];
    if (!last || last.key || last.value)
      return [...vars, { key: '', value: '', is_secret: false, enabled: true }];
    return vars;
  }

  // ── selection helpers ────────────────────────────────────────
  let isGlobalSelected = $derived(selectedId === GLOBAL_ID);
  let activeEnv = $derived(envs.find((e) => e.id === selectedId) ?? null);
  let activeEnvIdx = $derived(envs.findIndex((e) => e.id === selectedId));

  // ── global var edits ─────────────────────────────────────────
  function updateGlobalVar(idx: number, patch: Partial<Variable>) {
    const next = globalVars.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    globalVars = ensureTrailing(next);
  }

  function removeGlobalVar(idx: number) {
    globalVars = ensureTrailing(globalVars.filter((_, i) => i !== idx));
  }

  // ── env CRUD ─────────────────────────────────────────────────
  function addEnv() {
    if (!appState.workspace) return;
    const now = Date.now();
    const env: Environment = {
      schema_version: 1,
      id: newId(),
      workspace_id: appState.workspace.id,
      name: `Environment ${envs.length + 1}`,
      sort_index: now,
      variables: [{ key: '', value: '', is_secret: false, enabled: true }],
    };
    envs = [...envs, env];
    selectedId = env.id;
  }

  async function removeEnv(envId: string) {
    if (!appState.workspace) return;
    const e = envs.find((x) => x.id === envId);
    if (!e) return;
    envs = envs.filter((x) => x.id !== envId);
    selectedId = GLOBAL_ID;
    try {
      await deleteEnvironment(appState.workspace.id, envId);
    } catch (err) {
      console.error('delete env failed', err);
    }
    appState.environments = appState.environments.filter((x) => x.id !== envId);
    if (appState.workspace.active_environment_id === envId) {
      appState.workspace = { ...appState.workspace, active_environment_id: null };
    }
  }

  function updateEnvVar(envIdx: number, varIdx: number, patch: Partial<Variable>) {
    envs = envs.map((e, i) => {
      if (i !== envIdx) return e;
      const newVars = e.variables.map((v, j) => (j === varIdx ? { ...v, ...patch } : v));
      return { ...e, variables: ensureTrailing(newVars) };
    });
  }

  function removeEnvVar(envIdx: number, varIdx: number) {
    envs = envs.map((e, i) => {
      if (i !== envIdx) return e;
      return { ...e, variables: ensureTrailing(e.variables.filter((_, j) => j !== varIdx)) };
    });
  }

  function renameEnv(envIdx: number, name: string) {
    envs = envs.map((e, i) => (i === envIdx ? { ...e, name } : e));
  }

  // ── save ─────────────────────────────────────────────────────
  async function save() {
    if (!appState.workspace) { onclose(); return; }

    // Save globals
    const cleanGlobals: Globals = {
      schema_version: 1,
      workspace_id: appState.workspace.id,
      variables: globalVars.filter((v) => v.key.trim().length > 0),
    };
    try { await saveGlobals(cleanGlobals); } catch (e) { console.error('save globals failed', e); }
    appState.globals = cleanGlobals;

    // Save custom environments
    for (const e of envs) {
      const cleaned = { ...e, variables: e.variables.filter((v) => v.key.trim().length > 0) };
      try { await saveEnvironment(cleaned); } catch (err) { console.error('save env failed', err); }
    }
    appState.environments = envs.map((e) => ({
      ...e,
      variables: e.variables.filter((v) => v.key.trim().length > 0),
    }));

    onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <header>
      <h2>Environments &amp; Variables</h2>
      <button class="x" onclick={onclose} aria-label="Close">×</button>
    </header>

    <div class="body">
      <!-- Left: env list -->
      <aside class="env-list">
        <!-- Global entry — always first, cannot be deleted -->
        <button
          class="env-entry global-entry"
          class:active={isGlobalSelected}
          onclick={() => (selectedId = GLOBAL_ID)}
        >
          <span class="entry-name">Global Variables</span>
          <span class="badge">Always on</span>
        </button>

        <div class="separator">Custom environments</div>

        {#each envs as e (e.id)}
          <button
            class="env-entry"
            class:active={selectedId === e.id}
            onclick={() => (selectedId = e.id)}
          >
            <span class="entry-name">{e.name || '(unnamed)'}</span>
            {#if appState.workspace?.active_environment_id === e.id}
              <span class="badge active-badge">Active</span>
            {/if}
          </button>
        {/each}

        <button class="add-env" onclick={addEnv}>+ New environment</button>
      </aside>

      <!-- Right: variable editor -->
      <section class="env-detail">
        {#if isGlobalSelected}
          <div class="detail-head">
            <div>
              <p class="detail-title">Global Variables</p>
              <p class="detail-note">Always available in every request. Custom environment variables override these when a custom environment is active.</p>
            </div>
          </div>

          <div class="vars">
            <div class="row header">
              <div class="cb"></div>
              <div>Key</div>
              <div>Value</div>
              <div class="sec">Secret</div>
              <div class="del"></div>
            </div>
            {#each ensureTrailing(globalVars) as v, j (j)}
              <div class="row" class:disabled={!v.enabled}>
                <div class="cb">
                  <input type="checkbox" checked={v.enabled}
                    onchange={(e) => updateGlobalVar(j, { enabled: (e.target as HTMLInputElement).checked })} />
                </div>
                <input type="text" value={v.key} placeholder="key"
                  oninput={(e) => updateGlobalVar(j, { key: (e.target as HTMLInputElement).value })} />
                <input type={v.is_secret ? 'password' : 'text'} value={v.value} placeholder="value"
                  oninput={(e) => updateGlobalVar(j, { value: (e.target as HTMLInputElement).value })} />
                <div class="sec">
                  <input type="checkbox" checked={v.is_secret}
                    onchange={(e) => updateGlobalVar(j, { is_secret: (e.target as HTMLInputElement).checked })} />
                </div>
                <div class="del">
                  {#if j < ensureTrailing(globalVars).length - 1 || v.key || v.value}
                    <button onclick={() => removeGlobalVar(j)}>×</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

        {:else if activeEnv}
          <div class="detail-head">
            <input class="env-name-input" type="text" value={activeEnv.name}
              oninput={(e) => renameEnv(activeEnvIdx, (e.target as HTMLInputElement).value)} />
            <button class="danger" onclick={() => removeEnv(activeEnv.id)}>Delete</button>
          </div>
          <p class="detail-note">Variables here override Global Variables when this environment is active.</p>

          <div class="vars">
            <div class="row header">
              <div class="cb"></div>
              <div>Key</div>
              <div>Value</div>
              <div class="sec">Secret</div>
              <div class="del"></div>
            </div>
            {#each activeEnv.variables as v, j (j)}
              <div class="row" class:disabled={!v.enabled}>
                <div class="cb">
                  <input type="checkbox" checked={v.enabled}
                    onchange={(e) => updateEnvVar(activeEnvIdx, j, { enabled: (e.target as HTMLInputElement).checked })} />
                </div>
                <input type="text" value={v.key} placeholder="key"
                  oninput={(e) => updateEnvVar(activeEnvIdx, j, { key: (e.target as HTMLInputElement).value })} />
                <input type={v.is_secret ? 'password' : 'text'} value={v.value} placeholder="value"
                  oninput={(e) => updateEnvVar(activeEnvIdx, j, { value: (e.target as HTMLInputElement).value })} />
                <div class="sec">
                  <input type="checkbox" checked={v.is_secret}
                    onchange={(e) => updateEnvVar(activeEnvIdx, j, { is_secret: (e.target as HTMLInputElement).checked })} />
                </div>
                <div class="del">
                  {#if j < activeEnv.variables.length - 1 || v.key || v.value}
                    <button onclick={() => removeEnvVar(activeEnvIdx, j)}>×</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

        {:else}
          <div class="empty muted">Select an environment on the left, or create a new one.</div>
        {/if}
      </section>
    </div>

    <footer>
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={save}>Save</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 920px; max-width: 95vw;
    height: 620px; max-height: 88vh;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex; align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  header h2 { flex: 1; margin: 0; font-size: 14px; }
  .x { width: 24px; height: 24px; padding: 0; font-size: 18px; line-height: 1; }

  .body {
    display: grid;
    grid-template-columns: 230px 1fr;
    flex: 1; overflow: hidden;
  }

  /* ── Left sidebar ── */
  .env-list {
    border-right: 1px solid var(--border);
    background: var(--bg-2);
    overflow-y: auto;
    display: flex; flex-direction: column;
  }
  .env-entry {
    background: transparent;
    border: none; border-bottom: 1px solid var(--border);
    padding: 10px 12px;
    text-align: left; border-radius: 0;
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
  }
  .env-entry:hover { background: var(--bg-3); }
  .env-entry.active { background: var(--bg-3); }
  .entry-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .global-entry .entry-name { font-weight: 600; color: var(--fg-1); }
  .badge {
    font-size: 10px; padding: 1px 6px;
    border-radius: 10px;
    background: var(--bg-4); color: var(--fg-3);
    white-space: nowrap; flex-shrink: 0;
  }
  .active-badge { background: color-mix(in srgb, var(--accent) 20%, var(--bg-3)); color: var(--accent); }
  .separator {
    padding: 8px 12px 4px;
    font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.6px; color: var(--fg-3);
  }
  .add-env {
    background: transparent; border: none; border-top: 1px solid var(--border);
    padding: 10px 12px; text-align: left; border-radius: 0;
    cursor: pointer; color: var(--fg-3); font-size: 12px;
    margin-top: auto;
  }
  .add-env:hover { background: var(--bg-3); color: var(--fg-1); border-color: var(--border); }

  /* ── Right detail ── */
  .env-detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
  .detail-head { display: flex; gap: 8px; align-items: flex-start; }
  .detail-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--fg-1); }
  .detail-note { margin: 0; font-size: 12px; color: var(--fg-3); line-height: 1.5; }
  .env-name-input { flex: 1; font-weight: 600; font-size: 14px; }

  /* ── Variable table ── */
  .vars { display: flex; flex-direction: column; gap: 4px; }
  .row {
    display: grid;
    grid-template-columns: 32px 1fr 1.5fr 60px 28px;
    gap: 6px; align-items: center;
  }
  .row.header {
    font-size: 11px; text-transform: uppercase; color: var(--fg-2);
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px; margin-bottom: 2px;
  }
  .row.disabled input[type="text"],
  .row.disabled input[type="password"] { color: var(--fg-3); }
  .cb, .sec, .del { display: flex; justify-content: center; }
  .del button { background: transparent; border: none; padding: 0 4px; color: var(--fg-3); cursor: pointer; font-size: 14px; }
  .del button:hover { color: var(--err); }

  .empty { padding: 40px; text-align: center; }

  footer {
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 12px 16px; border-top: 1px solid var(--border);
  }
</style>
