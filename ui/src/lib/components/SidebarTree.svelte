<script lang="ts">
  import type { Collection, Folder, Request } from '../models';
  import { appState } from '../state/app.svelte';
  import { newId, emptyRequest } from '../models';
  import {
    saveCollection,
    deleteCollection,
    saveFolder,
    deleteFolder,
    saveRequest,
    deleteRequest,
  } from '../storage/store';

  interface Props {
    onselect: (id: string) => void;
  }
  let { onselect }: Props = $props();

  // ── expand / collapse ────────────────────────────────────────
  let expandedColls = $state<Set<string>>(new Set());
  let expandedFolders = $state<Set<string>>(new Set());

  function toggle(type: 'coll' | 'folder', id: string) {
    const s = type === 'coll' ? expandedColls : expandedFolders;
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (type === 'coll') expandedColls = next; else expandedFolders = next;
  }

  // ── rename ───────────────────────────────────────────────────
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');

  function startRename(id: string, current: string) {
    ctxMenu = null;
    renamingId = id;
    renameValue = current;
  }

  async function commitRename(id: string) {
    if (!appState.workspace) { renamingId = null; return; }
    const name = renameValue.trim() || 'Unnamed';
    const coll = appState.collections.find(c => c.id === id);
    if (coll) {
      const u = { ...coll, name, updated_at: Date.now() };
      appState.collections = appState.collections.map(c => c.id === id ? u : c);
      await saveCollection(u);
    }
    const folder = appState.folders.find(f => f.id === id);
    if (folder) {
      const u = { ...folder, name, updated_at: Date.now() };
      appState.folders = appState.folders.map(f => f.id === id ? u : f);
      await saveFolder(u);
    }
    renamingId = null;
  }

  // ── context menu ─────────────────────────────────────────────
  type CtxTarget =
    | { kind: 'collection'; item: Collection }
    | { kind: 'folder'; item: Folder }
    | { kind: 'request'; item: Request };

  let ctxMenu = $state<{ target: CtxTarget; x: number; y: number } | null>(null);

  function openMenu(e: MouseEvent, target: CtxTarget) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctxMenu = { target, x: rect.right, y: rect.bottom + 4 };
  }

  function closeMenu() { ctxMenu = null; }

  // ── CRUD operations ───────────────────────────────────────────
  async function addCollection() {
    if (!appState.workspace) return;
    const now = Date.now();
    const coll: Collection = {
      schema_version: 1, id: newId(),
      workspace_id: appState.workspace.id,
      name: `Collection ${appState.collections.length + 1}`,
      description: null,
      sort_index: now, created_at: now, updated_at: now,
    };
    await saveCollection(coll);
    appState.collections = [...appState.collections, coll];
    expandedColls = new Set([...expandedColls, coll.id]);
    startRename(coll.id, coll.name);
  }

  async function removeCollection(coll: Collection) {
    if (!appState.workspace) return;
    closeMenu();
    if (!confirm(`Delete collection "${coll.name}"? All requests inside will be deleted.`)) return;
    await deleteCollection(appState.workspace.id, coll.id);
    appState.collections = appState.collections.filter(c => c.id !== coll.id);
    appState.folders = appState.folders.filter(f => f.collection_id !== coll.id);
    appState.requests = appState.requests.filter(r => r.collection_id !== coll.id);
    if (appState.activeCollectionId === coll.id) appState.activeCollectionId = appState.collections[0]?.id ?? null;
  }

  async function addFolder(collId: string, parentFolderId: string | null = null) {
    if (!appState.workspace) return;
    closeMenu();
    const now = Date.now();
    const folder: Folder = {
      schema_version: 1, id: newId(),
      collection_id: collId,
      workspace_id: appState.workspace.id,
      parent_folder_id: parentFolderId,
      name: 'New Folder',
      sort_index: now, created_at: now, updated_at: now,
    };
    await saveFolder(folder);
    appState.folders = [...appState.folders, folder];
    // Expand the parent
    if (parentFolderId) expandedFolders = new Set([...expandedFolders, parentFolderId]);
    else expandedColls = new Set([...expandedColls, collId]);
    expandedFolders = new Set([...expandedFolders, folder.id]);
    startRename(folder.id, folder.name);
  }

  async function removeFolder(folder: Folder) {
    if (!appState.workspace) return;
    closeMenu();
    // Recursively collect all descendant folder ids
    function collectIds(id: string): string[] {
      const kids = appState.folders.filter(f => f.parent_folder_id === id).map(f => f.id);
      return [id, ...kids.flatMap(collectIds)];
    }
    const ids = collectIds(folder.id);
    // Move requests to parent or collection root
    for (const r of appState.requests.filter(r => ids.includes(r.folder_id ?? ''))) {
      const updated = { ...r, folder_id: folder.parent_folder_id };
      appState.requests = appState.requests.map(x => x.id === r.id ? updated : x);
      await saveRequest(appState.workspace.id, updated);
    }
    for (const id of ids) {
      await deleteFolder(appState.workspace.id, folder.collection_id, id);
    }
    appState.folders = appState.folders.filter(f => !ids.includes(f.id));
  }

  async function addRequest(collId: string, folderId: string | null = null) {
    if (!appState.workspace) return;
    closeMenu();
    const req = emptyRequest(collId);
    req.folder_id = folderId;
    req.sort_index = Date.now();
    appState.requests = [...appState.requests, req];
    await saveRequest(appState.workspace.id, req);
    appState.activeCollectionId = collId;
    onselect(req.id);
  }

  async function removeReq(req: Request) {
    if (!appState.workspace) return;
    closeMenu();
    await deleteRequest(appState.workspace.id, req.collection_id, req.id);
    appState.requests = appState.requests.filter(r => r.id !== req.id);
    if (appState.activeRequestId === req.id) appState.activeRequestId = appState.requests[0]?.id ?? null;
  }

  async function duplicateReq(req: Request) {
    if (!appState.workspace) return;
    closeMenu();
    const dup = { ...req, id: newId(), name: req.name + ' (copy)', sort_index: Date.now(), created_at: Date.now(), updated_at: Date.now() };
    appState.requests = [...appState.requests, dup];
    await saveRequest(appState.workspace.id, dup);
    onselect(dup.id);
  }

  // ── flat tree builder ─────────────────────────────────────────
  type TreeRow =
    | { kind: 'collection'; item: Collection; depth: 0 }
    | { kind: 'folder'; item: Folder; depth: number }
    | { kind: 'request'; item: Request; depth: number };

  function buildTree(): TreeRow[] {
    const rows: TreeRow[] = [];
    const colls = [...appState.collections].sort((a, b) => a.sort_index - b.sort_index);

    function addFolderContents(collId: string, parentFolderId: string | null, depth: number) {
      const subFolders = appState.folders
        .filter(f => f.collection_id === collId && f.parent_folder_id === parentFolderId)
        .sort((a, b) => a.sort_index - b.sort_index);
      const reqs = appState.requests
        .filter(r => r.collection_id === collId && r.folder_id === parentFolderId)
        .sort((a, b) => a.sort_index - b.sort_index);

      for (const folder of subFolders) {
        rows.push({ kind: 'folder', item: folder, depth });
        if (expandedFolders.has(folder.id)) addFolderContents(collId, folder.id, depth + 1);
      }
      for (const req of reqs) {
        rows.push({ kind: 'request', item: req, depth });
      }
    }

    for (const coll of colls) {
      rows.push({ kind: 'collection', item: coll, depth: 0 });
      if (expandedColls.has(coll.id)) addFolderContents(coll.id, null, 1);
    }
    return rows;
  }

  let tree = $derived(buildTree());

  function methodColor(m: string) {
    const map: Record<string, string> = {
      GET: 'var(--ok)', POST: 'var(--accent)', PUT: 'var(--warn)',
      PATCH: 'var(--warn)', DELETE: 'var(--err)',
    };
    return map[m] ?? 'var(--fg-3)';
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside class="sidebar">
  <div class="ws-header">
    <span class="ws-name">{appState.workspace?.name ?? '—'}</span>
  </div>

  <div class="tree" onclick={() => { if (ctxMenu) closeMenu(); }}>
    {#each tree as row (row.kind + '-' + row.item.id)}
      {@const indent = row.depth * 14}

      {#if row.kind === 'collection'}
        {@const coll = row.item}
        {@const expanded = expandedColls.has(coll.id)}
        <div
          class="row coll-row"
          class:row-active={appState.activeCollectionId === coll.id}
          style:padding-left="{4 + indent}px"
        >
          <button class="caret" onclick={() => toggle('coll', coll.id)}>{expanded ? '▾' : '▸'}</button>
          {#if renamingId === coll.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="rename-input" type="text" value={renameValue} autofocus
              oninput={(e) => (renameValue = (e.target as HTMLInputElement).value)}
              onblur={() => commitRename(coll.id)}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(coll.id); if (e.key === 'Escape') renamingId = null; }} />
          {:else}
            <span class="item-name coll-name" ondblclick={() => startRename(coll.id, coll.name)}>{coll.name}</span>
          {/if}
          <button class="dots" onclick={(e) => openMenu(e, { kind: 'collection', item: coll })}>•••</button>
        </div>

      {:else if row.kind === 'folder'}
        {@const folder = row.item}
        {@const expanded = expandedFolders.has(folder.id)}
        <div class="row folder-row" style:padding-left="{4 + indent}px">
          <button class="caret" onclick={() => toggle('folder', folder.id)}>{expanded ? '▾' : '▸'}</button>
          <span class="folder-icon">▼</span>
          {#if renamingId === folder.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="rename-input" type="text" value={renameValue} autofocus
              oninput={(e) => (renameValue = (e.target as HTMLInputElement).value)}
              onblur={() => commitRename(folder.id)}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(folder.id); if (e.key === 'Escape') renamingId = null; }} />
          {:else}
            <span class="item-name folder-name" ondblclick={() => startRename(folder.id, folder.name)}>{folder.name}</span>
          {/if}
          <button class="dots" onclick={(e) => openMenu(e, { kind: 'folder', item: folder })}>•••</button>
        </div>

      {:else}
        {@const req = row.item}
        <div
          class="row req-row"
          class:row-active={req.id === appState.activeRequestId}
          style:padding-left="{4 + indent}px"
        >
          <button class="req-btn" onclick={() => { appState.activeCollectionId = req.collection_id; onselect(req.id); }}>
            <span class="method-badge" style:color={methodColor(req.method)}>{req.method}</span>
            <span class="req-name" title={req.name}>{req.name}</span>
          </button>
          <button class="dots" onclick={(e) => openMenu(e, { kind: 'request', item: req })}>•••</button>
        </div>
      {/if}
    {/each}

    <button class="add-coll-btn" onclick={addCollection}>+ New Collection</button>
  </div>

  <!-- Context menu -->
  {#if ctxMenu}
    <div class="ctx-backdrop" onclick={closeMenu}></div>
    <div class="ctx-menu" style:left="{ctxMenu.x}px" style:top="{ctxMenu.y}px">
      {#if ctxMenu.target.kind === 'collection'}
        {@const coll = ctxMenu.target.item}
        <button onclick={() => { addRequest(coll.id); }}>Add Request</button>
        <button onclick={() => { addFolder(coll.id, null); }}>Add Folder</button>
        <hr />
        <button onclick={() => startRename(coll.id, coll.name)}>Rename</button>
        <hr />
        <button class="danger-item" onclick={() => removeCollection(coll)}>Delete Collection</button>

      {:else if ctxMenu.target.kind === 'folder'}
        {@const folder = ctxMenu.target.item}
        <button onclick={() => addRequest(folder.collection_id, folder.id)}>Add Request</button>
        <button onclick={() => addFolder(folder.collection_id, folder.id)}>Add Subfolder</button>
        <hr />
        <button onclick={() => startRename(folder.id, folder.name)}>Rename</button>
        <hr />
        <button class="danger-item" onclick={() => removeFolder(folder)}>Delete Folder</button>

      {:else}
        {@const req = ctxMenu.target.item}
        <button onclick={() => duplicateReq(req)}>Duplicate</button>
        <hr />
        <button class="danger-item" onclick={() => removeReq(req)}>Delete Request</button>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--bg-2);
    border-right: 1px solid var(--border);
    overflow: hidden;
    height: 100%;
    position: relative;
  }

  .ws-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ws-name {
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--fg-3);
  }

  .tree {
    overflow-y: auto;
    flex: 1;
    padding-bottom: 8px;
  }

  /* ── Generic row ── */
  .row {
    display: flex;
    align-items: center;
    gap: 2px;
    border-bottom: 1px solid var(--border);
    min-height: 32px;
    position: relative;
  }
  .row:hover { background: var(--bg-3); }
  .row-active { background: var(--bg-3); }

  /* Caret */
  .caret {
    background: transparent; border: none;
    padding: 0 4px; cursor: pointer;
    color: var(--fg-3); font-size: 10px; flex-shrink: 0;
    line-height: 1;
  }

  /* Collection */
  .coll-name {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--fg-2);
  }

  /* Folder */
  .folder-icon {
    font-size: 9px; color: var(--warn); flex-shrink: 0;
    transform: rotate(-90deg); display: inline-block;
  }
  .folder-name { font-size: 12px; color: var(--fg-2); }

  /* Shared label */
  .item-name {
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    cursor: default;
  }
  .rename-input {
    flex: 1; font-size: 12px; padding: 2px 4px;
    background: var(--bg-1); border: 1px solid var(--accent);
    border-radius: 3px; color: var(--fg-1);
  }

  /* Three-dot button */
  .dots {
    background: transparent; border: none;
    padding: 2px 6px; cursor: pointer;
    color: var(--fg-3); font-size: 11px;
    letter-spacing: 1px;
    opacity: 0; flex-shrink: 0;
    border-radius: 3px;
    transition: opacity 0.1s;
  }
  .row:hover .dots { opacity: 1; }
  .dots:hover { background: var(--bg-4); color: var(--fg-1); opacity: 1 !important; }

  /* Request row */
  .req-row { padding-right: 4px; }
  .req-btn {
    flex: 1; background: transparent; border: none;
    text-align: left; padding: 6px 4px 6px 0;
    display: flex; gap: 8px; align-items: center;
    cursor: pointer; color: inherit; border-radius: 0;
    overflow: hidden; min-width: 0;
  }
  .method-badge {
    font-family: var(--mono); font-size: 10px; font-weight: 700;
    min-width: 46px; flex-shrink: 0;
  }
  .req-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 12px; color: var(--fg-1);
  }

  /* Add collection button */
  .add-coll-btn {
    display: block; width: 100%;
    background: transparent; border: none; border-top: 1px solid var(--border);
    padding: 8px 14px; text-align: left;
    color: var(--fg-3); font-size: 12px;
    cursor: pointer; margin-top: 4px;
    border-radius: 0;
  }
  .add-coll-btn:hover { background: var(--bg-3); color: var(--fg-1); border-color: var(--border); }

  /* Context menu */
  .ctx-backdrop {
    position: fixed; inset: 0; z-index: 99;
  }
  .ctx-menu {
    position: fixed;
    z-index: 100;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 7px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    min-width: 160px;
    display: flex; flex-direction: column;
    overflow: hidden;
    padding: 4px 0;
  }
  .ctx-menu button {
    background: transparent; border: none; border-radius: 0;
    text-align: left; padding: 7px 14px;
    cursor: pointer; font-size: 12px; color: var(--fg-1);
    width: 100%;
  }
  .ctx-menu button:hover { background: var(--bg-3); }
  .ctx-menu hr { border: none; border-top: 1px solid var(--border); margin: 3px 0; }
  .ctx-menu .danger-item { color: var(--err); }
  .ctx-menu .danger-item:hover { background: color-mix(in srgb, var(--err) 10%, var(--bg-3)); }
</style>
