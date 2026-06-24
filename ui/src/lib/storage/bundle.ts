import type {
  Collection,
  Environment,
  Globals,
  Request,
  Variable,
  Workspace,
} from '../models';
import { newId, normalizeRequest } from '../models';
import {
  listWorkspaceIds,
  loadWorkspace,
  loadGlobals,
  loadAllEnvironments,
  listCollectionIds,
  loadCollection,
  listRequestIds,
  loadRequest,
  saveWorkspace,
  saveGlobals,
  saveEnvironment,
  saveCollection,
  saveRequest,
} from './store';

export const BUNDLE_VERSION = 1;

export interface ExportedBundle {
  ltron_export_version: number;
  exported_at: string;
  workspaces: ExportedWorkspace[];
}

interface ExportedWorkspace {
  id: string;
  name: string;
  active_environment_id: string | null;
  globals: Variable[];
  environments: Array<Pick<Environment, 'id' | 'name' | 'sort_index' | 'variables'>>;
  collections: ExportedCollection[];
}

interface ExportedCollection {
  id: string;
  name: string;
  description: string | null;
  sort_index: number;
  requests: Request[];
}

/** Build an in-memory export bundle of all workspaces. */
export async function exportAll(includeSecrets: boolean): Promise<ExportedBundle> {
  const wsIds = await listWorkspaceIds();
  const workspaces: ExportedWorkspace[] = [];

  for (const wsId of wsIds) {
    const ws = await loadWorkspace(wsId);
    if (!ws) continue;

    const globals = await loadGlobals(wsId);
    const environments = await loadAllEnvironments(wsId);
    const collIds = await listCollectionIds(wsId);

    const collections: ExportedCollection[] = [];
    for (const cid of collIds) {
      const c = await loadCollection(wsId, cid);
      if (!c) continue;
      const reqIds = await listRequestIds(wsId, cid);
      const requests: Request[] = [];
      for (const rid of reqIds) {
        const r = await loadRequest(wsId, cid, rid);
        if (r) requests.push(r);
      }
      requests.sort((a, b) => a.sort_index - b.sort_index);
      collections.push({
        id: c.id,
        name: c.name,
        description: c.description,
        sort_index: c.sort_index,
        requests,
      });
    }

    workspaces.push({
      id: ws.id,
      name: ws.name,
      active_environment_id: ws.active_environment_id,
      globals: filterSecrets(globals.variables, includeSecrets),
      environments: environments.map((e) => ({
        id: e.id,
        name: e.name,
        sort_index: e.sort_index,
        variables: filterSecrets(e.variables, includeSecrets),
      })),
      collections,
    });
  }

  return {
    ltron_export_version: BUNDLE_VERSION,
    exported_at: new Date().toISOString(),
    workspaces,
  };
}

function filterSecrets(vars: Variable[], includeSecrets: boolean): Variable[] {
  if (includeSecrets) return vars;
  return vars.map((v) => (v.is_secret ? { ...v, value: '' } : v));
}

export interface ImportReport {
  workspaces: number;
  collections: number;
  requests: number;
  environments: number;
}

/** Import a bundle, regenerating UUIDs so it never collides with existing data. */
export async function importBundle(bundle: any): Promise<ImportReport> {
  if (!bundle || typeof bundle !== 'object') throw new Error('Invalid bundle: not an object');
  if (bundle.ltron_export_version == null) throw new Error('Invalid bundle: missing version');
  if (bundle.ltron_export_version > BUNDLE_VERSION) {
    throw new Error(
      `Unsupported bundle version: ${bundle.ltron_export_version}. This app supports ≤ ${BUNDLE_VERSION}.`,
    );
  }
  if (!Array.isArray(bundle.workspaces)) throw new Error('Invalid bundle: workspaces is not an array');

  const report: ImportReport = { workspaces: 0, collections: 0, requests: 0, environments: 0 };
  const now = Date.now();

  for (const ews of bundle.workspaces as ExportedWorkspace[]) {
    const newWsId = newId();
    const ws: Workspace = {
      schema_version: 1,
      id: newWsId,
      name: ews.name ?? 'Imported',
      active_environment_id: null,
      created_at: now,
      updated_at: now,
    };
    await saveWorkspace(ws);
    report.workspaces++;

    // Globals
    const globals: Globals = {
      schema_version: 1,
      workspace_id: newWsId,
      variables: Array.isArray(ews.globals) ? ews.globals : [],
    };
    await saveGlobals(globals);

    // Environments
    const envIdMap = new Map<string, string>();
    for (const eenv of ews.environments ?? []) {
      const newEnvId = newId();
      envIdMap.set(eenv.id, newEnvId);
      const env: Environment = {
        schema_version: 1,
        id: newEnvId,
        workspace_id: newWsId,
        name: eenv.name ?? 'Environment',
        sort_index: eenv.sort_index ?? Date.now(),
        variables: Array.isArray(eenv.variables) ? eenv.variables : [],
      };
      await saveEnvironment(env);
      report.environments++;
    }

    // Activate the previously active env if present
    if (ews.active_environment_id && envIdMap.has(ews.active_environment_id)) {
      await saveWorkspace({
        ...ws,
        active_environment_id: envIdMap.get(ews.active_environment_id)!,
      });
    }

    // Collections + requests
    for (const ec of ews.collections ?? []) {
      const newCollId = newId();
      const coll: Collection = {
        schema_version: 1,
        id: newCollId,
        workspace_id: newWsId,
        name: ec.name ?? 'Imported Collection',
        description: ec.description ?? null,
        sort_index: ec.sort_index ?? Date.now(),
        created_at: now,
        updated_at: now,
      };
      await saveCollection(coll);
      report.collections++;

      for (const er of ec.requests ?? []) {
        const newReqId = newId();
        const req: Request = normalizeRequest({
          ...er,
          id: newReqId,
          collection_id: newCollId,
        });
        await saveRequest(newWsId, req);
        report.requests++;
      }
    }
  }

  return report;
}
