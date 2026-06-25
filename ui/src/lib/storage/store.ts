import {
  appJsonPath,
  workspaceDir,
  workspaceJsonPath,
  workspacesDir,
  globalsJsonPath,
  collectionsDir,
  collectionDir,
  collectionJsonPath,
  requestsDir,
  requestJsonPath,
  historyDir,
  historyTodayPath,
  foldersDir,
  folderJsonPath,
  examplesDir,
  exampleJsonPath,
} from './paths';
import {
  readJson,
  writeJson,
  listDir,
  ensureDir,
  appendJsonl,
  readJsonl,
  fsDelete,
  fsExists,
} from './io';
import {
  type AppSettings,
  type Collection,
  type Environment,
  type Example,
  type Folder,
  type Globals,
  type HistoryEntry,
  type Request,
  type Workspace,
  DEFAULT_SETTINGS,
  newId,
  emptyRequest,
  normalizeRequest,
} from '../models';
import { fsList } from '../ipc/fs';
import { joinPath } from '../ipc/paths';

// ---------- app settings ----------

export async function loadSettings(): Promise<AppSettings> {
  const path = await appJsonPath();
  const loaded = await readJson<AppSettings>(path);
  return loaded ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await writeJson(await appJsonPath(), s);
}

// ---------- workspaces ----------

export async function listWorkspaceIds(): Promise<string[]> {
  const entries = await listDir(await workspacesDir());
  return entries.filter((e) => e.is_dir).map((e) => e.name);
}

export async function loadWorkspace(id: string): Promise<Workspace | null> {
  return await readJson<Workspace>(await workspaceJsonPath(id));
}

export async function saveWorkspace(w: Workspace): Promise<void> {
  await ensureDir(await workspaceDir(w.id));
  await writeJson(await workspaceJsonPath(w.id), w);
}

export async function loadAllCollections(workspaceId: string): Promise<Collection[]> {
  const ids = await listCollectionIds(workspaceId);
  const out: Collection[] = [];
  for (const id of ids) {
    const c = await loadCollection(workspaceId, id);
    if (c) out.push(c);
  }
  out.sort((a, b) => a.sort_index - b.sort_index);
  return out;
}

export async function loadGlobals(workspaceId: string): Promise<Globals> {
  const path = await globalsJsonPath(workspaceId);
  const loaded = await readJson<Globals>(path);
  return loaded ?? { schema_version: 1, workspace_id: workspaceId, variables: [] };
}

export async function saveGlobals(g: Globals): Promise<void> {
  await writeJson(await globalsJsonPath(g.workspace_id), g);
}

// ---------- collections ----------

export async function listCollectionIds(workspaceId: string): Promise<string[]> {
  const entries = await listDir(await collectionsDir(workspaceId));
  return entries.filter((e) => e.is_dir).map((e) => e.name);
}

export async function loadCollection(
  workspaceId: string,
  collectionId: string,
): Promise<Collection | null> {
  return await readJson<Collection>(await collectionJsonPath(workspaceId, collectionId));
}

export async function saveCollection(c: Collection): Promise<void> {
  await ensureDir(await collectionDir(c.workspace_id, c.id));
  await writeJson(await collectionJsonPath(c.workspace_id, c.id), c);
}

export async function deleteCollection(workspaceId: string, collectionId: string): Promise<void> {
  await fsDelete(await collectionDir(workspaceId, collectionId), true);
}

// ---------- folders ----------

export async function listFolderIds(
  workspaceId: string,
  collectionId: string,
): Promise<string[]> {
  const dir = await foldersDir(workspaceId, collectionId);
  if (!(await fsExists(dir))) return [];
  const entries = await fsList(dir);
  return entries
    .filter((e) => !e.is_dir && e.name.endsWith('.json'))
    .map((e) => e.name.replace(/\.json$/, ''));
}

export async function loadFolder(
  workspaceId: string,
  collectionId: string,
  folderId: string,
): Promise<Folder | null> {
  return await readJson<Folder>(await folderJsonPath(workspaceId, collectionId, folderId));
}

export async function saveFolder(f: Folder): Promise<void> {
  await ensureDir(await foldersDir(f.workspace_id, f.collection_id));
  await writeJson(await folderJsonPath(f.workspace_id, f.collection_id, f.id), f);
}

export async function deleteFolder(
  workspaceId: string,
  collectionId: string,
  folderId: string,
): Promise<void> {
  await fsDelete(await folderJsonPath(workspaceId, collectionId, folderId), false);
}

export async function loadAllFolders(
  workspaceId: string,
  collectionId: string,
): Promise<Folder[]> {
  const ids = await listFolderIds(workspaceId, collectionId);
  const out: Folder[] = [];
  for (const id of ids) {
    const f = await loadFolder(workspaceId, collectionId, id);
    if (f) out.push(f);
  }
  out.sort((a, b) => a.sort_index - b.sort_index);
  return out;
}

// ---------- requests ----------

export async function listRequestIds(
  workspaceId: string,
  collectionId: string,
): Promise<string[]> {
  const path = await requestsDir(workspaceId, collectionId);
  if (!(await fsExists(path))) return [];
  const entries = await fsList(path);
  return entries
    .filter((e) => !e.is_dir && e.name.endsWith('.json'))
    .map((e) => e.name.replace(/\.json$/, ''));
}

export async function loadRequest(
  workspaceId: string,
  collectionId: string,
  requestId: string,
): Promise<Request | null> {
  const raw = await readJson<any>(await requestJsonPath(workspaceId, collectionId, requestId));
  if (!raw) return null;
  return normalizeRequest(raw);
}

// ---------- environments ----------

async function envsDir(workspaceId: string): Promise<string> {
  return joinPath(await workspaceDir(workspaceId), 'environments');
}

async function envJsonPath(workspaceId: string, envId: string): Promise<string> {
  return joinPath(await envsDir(workspaceId), `${envId}.json`);
}

export async function listEnvironmentIds(workspaceId: string): Promise<string[]> {
  const dir = await envsDir(workspaceId);
  if (!(await fsExists(dir))) return [];
  const entries = await fsList(dir);
  return entries
    .filter((e) => !e.is_dir && e.name.endsWith('.json'))
    .map((e) => e.name.replace(/\.json$/, ''));
}

export async function loadEnvironment(
  workspaceId: string,
  envId: string,
): Promise<Environment | null> {
  return await readJson<Environment>(await envJsonPath(workspaceId, envId));
}

export async function saveEnvironment(env: Environment): Promise<void> {
  await ensureDir(await envsDir(env.workspace_id));
  await writeJson(await envJsonPath(env.workspace_id, env.id), env);
}

export async function deleteEnvironment(workspaceId: string, envId: string): Promise<void> {
  await fsDelete(await envJsonPath(workspaceId, envId), false);
}

export async function loadAllEnvironments(workspaceId: string): Promise<Environment[]> {
  const ids = await listEnvironmentIds(workspaceId);
  const out: Environment[] = [];
  for (const id of ids) {
    const e = await loadEnvironment(workspaceId, id);
    if (e) out.push(e);
  }
  out.sort((a, b) => a.sort_index - b.sort_index);
  return out;
}

export async function saveRequest(workspaceId: string, req: Request): Promise<void> {
  await ensureDir(await requestsDir(workspaceId, req.collection_id));
  req.updated_at = Date.now();
  await writeJson(await requestJsonPath(workspaceId, req.collection_id, req.id), req);
}

export async function deleteRequest(
  workspaceId: string,
  collectionId: string,
  requestId: string,
): Promise<void> {
  await fsDelete(await requestJsonPath(workspaceId, collectionId, requestId), false);
}

// ---------- examples ----------

export async function loadAllExamples(workspaceId: string, collectionId: string): Promise<Example[]> {
  const dir = await examplesDir(workspaceId, collectionId);
  if (!(await fsExists(dir))) return [];
  const entries = await fsList(dir);
  const ids = entries.filter((e) => !e.is_dir && e.name.endsWith('.json')).map((e) => e.name.replace(/\.json$/, ''));
  const out: Example[] = [];
  for (const id of ids) {
    const ex = await readJson<Example>(await exampleJsonPath(workspaceId, collectionId, id));
    if (ex) out.push(ex);
  }
  out.sort((a, b) => a.created_at - b.created_at);
  return out;
}

export async function saveExample(workspaceId: string, example: Example): Promise<void> {
  await ensureDir(await examplesDir(workspaceId, example.collection_id));
  await writeJson(await exampleJsonPath(workspaceId, example.collection_id, example.id), example);
}

export async function deleteExample(workspaceId: string, collectionId: string, exampleId: string): Promise<void> {
  await fsDelete(await exampleJsonPath(workspaceId, collectionId, exampleId), false);
}

// ---------- history ----------

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await ensureDir(await historyDir(entry.workspace_id));
  await appendJsonl(await historyTodayPath(entry.workspace_id), entry);
}

export async function loadHistory(workspaceId: string, limit = 100): Promise<HistoryEntry[]> {
  const dir = await historyDir(workspaceId);
  if (!(await fsExists(dir))) return [];
  const entries = await fsList(dir);
  const files = entries
    .filter((e) => !e.is_dir && e.name.endsWith('.jsonl'))
    .map((e) => e.name)
    .sort()
    .reverse(); // newest first

  const out: HistoryEntry[] = [];
  for (const f of files) {
    if (out.length >= limit) break;
    const path = `${dir}/${f}`;
    const lines = await readJsonl<HistoryEntry>(path);
    // newest at the end of each file → reverse
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      out.push(lines[i]);
    }
  }
  return out;
}

// ---------- first-run bootstrap ----------

export async function bootstrapIfEmpty(): Promise<{
  workspace: Workspace;
  collection: Collection;
  request: Request;
}> {
  const existing = await listWorkspaceIds();
  if (existing.length > 0) {
    // Prefer the last active workspace if settings say so
    const settings = await loadSettings();
    const preferredId = settings.last_active_workspace_id;
    const wsId = (preferredId && existing.includes(preferredId)) ? preferredId : existing[0];
    const ws = await loadWorkspace(wsId);
    if (ws) {
      const collIds = await listCollectionIds(wsId);
      if (collIds.length > 0) {
        const coll = await loadCollection(wsId, collIds[0]);
        if (coll) {
          const reqIds = await listRequestIds(wsId, coll.id);
          if (reqIds.length > 0) {
            const req = await loadRequest(wsId, coll.id, reqIds[0]);
            if (req) return { workspace: ws, collection: coll, request: req };
          }
          // Have collection but no requests
          const req = emptyRequest(coll.id);
          await saveRequest(wsId, req);
          return { workspace: ws, collection: coll, request: req };
        }
      }
    }
  }

  // Brand new bootstrap
  const now = Date.now();
  const wsId = newId();
  const collId = newId();
  const ws: Workspace = {
    schema_version: 1,
    id: wsId,
    name: 'Default',
    active_environment_id: null,
    created_at: now,
    updated_at: now,
  };
  const coll: Collection = {
    schema_version: 1,
    id: collId,
    workspace_id: wsId,
    name: 'Scratch',
    description: null,
    sort_index: now,
    created_at: now,
    updated_at: now,
  };
  await saveWorkspace(ws);
  await saveCollection(coll);
  const req = emptyRequest(collId);
  req.name = 'GET httpbin';
  await saveRequest(wsId, req);
  return { workspace: ws, collection: coll, request: req };
}
