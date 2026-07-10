<script lang="ts">
  import { appState, activeRequest, replaceRequest, removeRequest, activeEnvironment, activeCollection } from './lib/state/app.svelte';
  import {
    bootstrapIfEmpty,
    listRequestIds,
    loadRequest,
    saveRequest,
    deleteRequest as storeDelete,
    loadGlobals,
    loadAllEnvironments,
    loadAllCollections,
    loadAllFolders,
    saveWorkspace,
    appendHistory,
    loadHistory,
    loadAllExamples,
    loadSettings,
    saveSettings,
  } from './lib/storage/store';
  import { METHODS, emptyRequest, type HttpMethod, type BodyMode, type Body, type Auth } from './lib/models';
  import { newId } from './lib/models';
  import SidebarTree from './lib/components/SidebarTree.svelte';
  import KVTable from './lib/components/KVTable.svelte';
  import BodyEditor from './lib/components/BodyEditor.svelte';
  import AuthPanel from './lib/components/AuthPanel.svelte';
  import ResponsePane from './lib/components/ResponsePane.svelte';
  import EnvSwitcher from './lib/components/EnvSwitcher.svelte';
  import EnvEditorModal from './lib/components/EnvEditorModal.svelte';
  import TopBar from './lib/components/TopBar.svelte';
  import TutorialModal from './lib/components/TutorialModal.svelte';
  import VarSuggest from './lib/components/VarSuggest.svelte';
  import HistoryPane from './lib/components/HistoryPane.svelte';
  import { buildVariableContext, send } from './lib/sender';
  import { httpCancel } from './lib/ipc/http';
  import { exportAll, importBundle } from './lib/storage/bundle';
  import { fsWrite, fsRead } from './lib/ipc/fs';
  import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
  import type { ExecutionResult } from './lib/ipc/types';

  let tab = $state<'params' | 'headers' | 'body' | 'auth'>('params');
  let result = $state<ExecutionResult | null>(null);
  let error = $state<string | null>(null);
  let selectedExample = $state<import('./lib/models').Example | null>(null);
  let loading = $state(false);
  let activeExecutionId = $state<string | null>(null);
  let showEnvs = $state(false);
  let showHelp = $state(false);
  let toast = $state<string | null>(null);
  let showHistory = $state(false);

  // Apply theme class on boot and when settings change
  $effect(() => {
    const theme = appState.settings.theme;
    const cl = document.documentElement.classList;
    cl.remove('dark', 'light', 'system');
    if (theme !== 'dark') cl.add(theme);
  });

  function flashToast(msg: string, ms = 2500) {
    toast = msg;
    setTimeout(() => {
      if (toast === msg) toast = null;
    }, ms);
  }

  // ---------- bootstrap ----------
  $effect(() => {
    if (appState.booted) return;
    (async () => {
      try {
        appState.settings = await loadSettings();
        const { workspace, collection, request } = await bootstrapIfEmpty();
        appState.workspace = workspace;
        appState.globals = await loadGlobals(workspace.id);
        appState.environments = await loadAllEnvironments(workspace.id);

        // Load all collections
        const allColls = await loadAllCollections(workspace.id);
        appState.collections = allColls;
        appState.activeCollectionId = collection.id;

        // Load all folders + requests across all collections
        const allRequests: any[] = [];
        const allFolders: any[] = [];
        for (const coll of allColls) {
          const folders = await loadAllFolders(workspace.id, coll.id);
          allFolders.push(...folders);
          const reqIds = await listRequestIds(workspace.id, coll.id);
          for (const id of reqIds) {
            const r = await loadRequest(workspace.id, coll.id, id);
            if (r) allRequests.push(r);
          }
        }
        appState.folders = allFolders;
        if (!allRequests.find((r) => r.id === request.id)) allRequests.unshift(request);
        allRequests.sort((a, b) => a.sort_index - b.sort_index);
        appState.requests = allRequests;
        appState.activeRequestId = request.id;

        // Load all examples across all collections
        const allExamples: any[] = [];
        for (const coll of allColls) {
          const exs = await loadAllExamples(workspace.id, coll.id);
          allExamples.push(...exs);
        }
        appState.examples = allExamples;

        appState.settings.last_active_workspace_id = workspace.id;
        await saveSettings(appState.settings);
        appState.history = await loadHistory(workspace.id, 100);
        appState.booted = true;
      } catch (e) {
        console.error('boot failed', e);
        error = `Boot failed: ${e}`;
      }
    })();
  });

  // ---------- request mutation ----------
  function updateActive(patch: Partial<typeof current>) {
    const cur = activeRequest();
    if (!cur) return;
    const next = { ...cur, ...patch, updated_at: Date.now() };
    replaceRequest(next);
    if (appState.workspace) {
      saveRequest(appState.workspace.id, next).catch((e) => console.error('save failed', e));
    }
  }

  let current = $derived(activeRequest());

  function selectRequest(id: string) {
    appState.activeRequestId = id;
    appState.activeExampleId = null;
    selectedExample = null;
    result = null;
    error = null;
  }

  function selectExample(ex: import('./lib/models').Example) {
    appState.activeExampleId = ex.id;
    appState.activeRequestId = ex.request_id ?? appState.activeRequestId;
    selectedExample = ex;
    result = null;
    error = null;
  }

  async function newRequest() {
    const coll = activeCollection();
    if (!coll || !appState.workspace) return;
    const req = emptyRequest(coll.id);
    req.sort_index = Date.now();
    replaceRequest(req);
    await saveRequest(appState.workspace.id, req);
    selectRequest(req.id);
  }

  async function deleteRequest(id: string) {
    if (!appState.workspace) return;
    const req = appState.requests.find(r => r.id === id);
    if (!req) return;
    await storeDelete(appState.workspace.id, req.collection_id, req.id);
    removeRequest(id);
  }

  // ---------- env switching ----------
  async function switchEnv(envId: string | null) {
    if (!appState.workspace) return;
    const w = { ...appState.workspace, active_environment_id: envId };
    appState.workspace = w;
    await saveWorkspace(w);
  }

  async function reloadEnvs() {
    if (!appState.workspace) return;
    appState.environments = await loadAllEnvironments(appState.workspace.id);
  }

  // ---------- send / cancel ----------
  async function onSend() {
    if (!current || !appState.workspace) return;
    loading = true;
    error = null;
    result = null;
    const env = activeEnvironment();
    const ctx = buildVariableContext(
      appState.globals?.variables ?? [],
      env?.variables ?? [],
    );
    const startedAt = Date.now();
    try {
      const r = await send(current, ctx);
      activeExecutionId = r.execution_id;
      result = r;
      const entry: Parameters<typeof appendHistory>[0] = {
        id: newId(),
        workspace_id: appState.workspace.id,
        request_id: current.id,
        method: current.method,
        url: r.final_url,
        status_code: r.status,
        duration_ms: r.latency_ms,
        ttfb_ms: r.ttfb_ms,
        error_kind: null,
        executed_at: startedAt,
      };
      await appendHistory(entry);
      appState.history = [entry, ...appState.history].slice(0, appState.settings.history_limit);
    } catch (e: any) {
      const msg = e?.message ?? (typeof e === 'string' ? e : JSON.stringify(e));
      error = msg;
      try {
        const errEntry: Parameters<typeof appendHistory>[0] = {
          id: newId(),
          workspace_id: appState.workspace.id,
          request_id: current.id,
          method: current.method,
          url: current.url,
          status_code: null,
          duration_ms: null,
          ttfb_ms: null,
          error_kind: e?.kind ?? 'Error',
          executed_at: startedAt,
        };
        await appendHistory(errEntry);
        appState.history = [errEntry, ...appState.history].slice(0, appState.settings.history_limit);
      } catch {}
    } finally {
      loading = false;
      activeExecutionId = null;
    }
  }

  async function onCancel() {
    if (!activeExecutionId) return;
    try {
      await httpCancel(activeExecutionId);
    } catch (e) {
      console.error('cancel failed', e);
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (loading) onCancel();
      else onSend();
    }
  }

  // ---------- import / export ----------
  async function onExport() {
    try {
      const path = await saveDialog({
        title: 'Export Ltron bundle',
        defaultPath: `ltron-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return;
      const bundle = await exportAll(false); // secrets excluded by default
      await fsWrite(path, JSON.stringify(bundle, null, 2));
      flashToast(`Exported ${bundle.workspaces.length} workspace(s)`);
    } catch (e: any) {
      console.error('export failed', e);
      flashToast(`Export failed: ${e?.message ?? e}`);
    }
  }

  async function onImport() {
    try {
      const sel = await openDialog({
        title: 'Import Ltron bundle',
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      const path = typeof sel === 'string' ? sel : null;
      if (!path) return;
      const text = await fsRead(path);
      const bundle = JSON.parse(text);
      const report = await importBundle(bundle);
      flashToast(`Imported ${report.workspaces} ws, ${report.collections} coll, ${report.requests} req, ${report.environments} env`);
      // Note: we don't auto-switch to imported workspace in v0.1; user can refresh later.
    } catch (e: any) {
      console.error('import failed', e);
      flashToast(`Import failed: ${e?.message ?? e}`);
    }
  }

  function setMethod(m: HttpMethod) { updateActive({ method: m }); }
  function setUrl(url: string) { updateActive({ url }); }
  function setName(name: string) { updateActive({ name }); }
  function setBody(mode: BodyMode, body: Body) { updateActive({ body_mode: mode, body }); }
  function setAuth(auth: Auth) { updateActive({ auth }); }

  function loadRequestFromHistory(entry: import('./lib/models').HistoryEntry) {
    if (entry.request_id) {
      const req = appState.requests.find(r => r.id === entry.request_id);
      if (req) { selectRequest(req.id); return; }
    }
    // Request no longer exists — restore method+url into current active request
    const cur = activeRequest();
    if (!cur) return;
    updateActive({ method: entry.method as import('./lib/models').HttpMethod, url: entry.url });
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="app-shell">
  <TopBar
    onexport={onExport}
    onimport={onImport}
    onenvironments={() => (showEnvs = true)}
    onhelp={() => (showHelp = true)}
    onhistory={() => (showHistory = !showHistory)}
  />
<div class="app">
  <SidebarTree onselect={selectRequest} onselectexample={selectExample} />

  <main>
    {#if current}
      <header class="req-head">
        <input
          class="name"
          type="text"
          value={current.name}
          oninput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="Request name"
        />
        <EnvSwitcher
          environments={appState.environments}
          activeId={appState.workspace?.active_environment_id ?? null}
          onswitch={switchEnv}
          onmanage={() => (showEnvs = true)}
        />
      </header>

      <div class="url-bar">
        <select value={current.method} onchange={(e) => setMethod((e.target as HTMLSelectElement).value as HttpMethod)}>
          {#each METHODS as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
        <input
          class="url mono"
          type="text"
          value={current.url}
          oninput={(e) => setUrl((e.target as HTMLInputElement).value)}
          placeholder="https://api.example.com/users/1"
          spellcheck="false"
        />
        {#if loading}
          <button class="danger send" onclick={onCancel}>Cancel</button>
        {:else}
          <button class="primary send" onclick={onSend}>Send</button>
        {/if}
      </div>

      <div class="tabs">
        <button class:active={tab === 'params'} onclick={() => (tab = 'params')}>Params ({current.query_params.filter((p) => p.enabled && p.key).length})</button>
        <button class:active={tab === 'headers'} onclick={() => (tab = 'headers')}>Headers ({current.headers.filter((h) => h.enabled && h.key).length})</button>
        <button class:active={tab === 'body'} onclick={() => (tab = 'body')}>Body</button>
        <button class:active={tab === 'auth'} onclick={() => (tab = 'auth')}>Auth{current.auth?.kind && current.auth.kind !== 'none' ? ' •' : ''}</button>
      </div>

      <div class="tab-content">
        {#if tab === 'params'}
          <KVTable
            rows={current.query_params}
            onchange={(rows) => updateActive({ query_params: rows })}
            placeholderKey="param"
          />
        {:else if tab === 'headers'}
          <KVTable
            rows={current.headers}
            onchange={(rows) => updateActive({ headers: rows })}
            placeholderKey="header"
          />
        {:else if tab === 'body'}
          <BodyEditor
            bodyMode={current.body_mode}
            body={current.body}
            onchange={setBody}
          />
        {:else}
          <AuthPanel auth={current.auth ?? { kind: 'none' }} onchange={setAuth} />
        {/if}
      </div>

      <div class="response-wrap">
        <ResponsePane {result} {error} {loading} activeRequest={current} example={selectedExample} />
      </div>
      {#if showHistory}
        <div class="history-wrap">
          <HistoryPane entries={appState.history} onselect={loadRequestFromHistory} />
        </div>
      {/if}
    {:else}
      <div class="empty">Loading…</div>
    {/if}
  </main>
</div>
</div>

{#if showEnvs}
  <EnvEditorModal onclose={async () => { showEnvs = false; await reloadEnvs(); }} />
{/if}

{#if showHelp}
  <TutorialModal onclose={() => (showHelp = false)} />
{/if}

{#if toast}
  <div class="toast">{toast}</div>
{/if}

<VarSuggest />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  .app {
    display: grid;
    grid-template-columns: 260px 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  main {
    display: grid;
    grid-template-rows: auto auto auto auto 1fr auto;
    min-height: 0;
    overflow: hidden;
  }
  .req-head {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-2);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .req-head input.name {
    flex: 1;
    background: transparent;
    border: 1px solid transparent;
    padding: 4px 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .req-head input.name:hover { border-color: var(--border); }
  .req-head input.name:focus { border-color: var(--accent); background: var(--bg-1); }
  .url-bar {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    align-items: center;
  }
  .url-bar select {
    font-family: var(--mono);
    font-weight: 600;
  }
  .url-bar .url { flex: 1; }
  .send { min-width: 80px; }
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
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: var(--accent-dim);
  }
  .tab-content {
    padding: 12px;
    overflow-y: auto;
    border-bottom: 1px solid var(--border);
    min-height: 180px;
    max-height: 40%;
  }
  .response-wrap {
    min-height: 0;
    overflow: hidden;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-3);
    font-size: 14px;
  }
  .history-wrap {
    height: 180px;
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid var(--border);
  }
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    z-index: 200;
    font-size: 13px;
  }
</style>
