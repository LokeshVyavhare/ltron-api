import type {
  AppSettings,
  Collection,
  Example,
  Folder,
  Workspace,
  Request,
  Globals,
  HistoryEntry,
  Environment,
} from '../models';
import { DEFAULT_SETTINGS } from '../models';

export const appState = $state({
  settings: { ...DEFAULT_SETTINGS } as AppSettings,
  workspace: null as Workspace | null,
  collections: [] as Collection[],
  activeCollectionId: null as string | null,
  folders: [] as Folder[],
  globals: null as Globals | null,
  environments: [] as Environment[],
  requests: [] as Request[],
  examples: [] as Example[],
  activeRequestId: null as string | null,
  activeExampleId: null as string | null,
  history: [] as HistoryEntry[],
  booted: false,
});

/** Backwards-compat: returns the active collection */
export function activeCollection(): Collection | null {
  if (!appState.activeCollectionId) return null;
  return appState.collections.find((c) => c.id === appState.activeCollectionId) ?? null;
}

export function activeEnvironment(): Environment | null {
  if (!appState.workspace?.active_environment_id) return null;
  return (
    appState.environments.find((e) => e.id === appState.workspace!.active_environment_id) ?? null
  );
}

export function activeRequest(): Request | null {
  if (!appState.activeRequestId) return null;
  return appState.requests.find((r) => r.id === appState.activeRequestId) ?? null;
}

export function replaceRequest(req: Request): void {
  const idx = appState.requests.findIndex((r) => r.id === req.id);
  if (idx === -1) appState.requests = [...appState.requests, req];
  else {
    const next = [...appState.requests];
    next[idx] = req;
    appState.requests = next;
  }
}

export function removeRequest(id: string): void {
  appState.requests = appState.requests.filter((r) => r.id !== id);
  if (appState.activeRequestId === id) {
    appState.activeRequestId = appState.requests[0]?.id ?? null;
  }
}
