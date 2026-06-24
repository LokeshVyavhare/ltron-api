import { appDataDir, joinPath } from '../ipc/paths';

export async function rootDir(): Promise<string> {
  return await appDataDir();
}

export async function appJsonPath(): Promise<string> {
  return joinPath(await rootDir(), 'app.json');
}

export async function workspacesDir(): Promise<string> {
  return joinPath(await rootDir(), 'workspaces');
}

export async function workspaceDir(workspaceId: string): Promise<string> {
  return joinPath(await workspacesDir(), workspaceId);
}

export async function workspaceJsonPath(workspaceId: string): Promise<string> {
  return joinPath(await workspaceDir(workspaceId), 'workspace.json');
}

export async function globalsJsonPath(workspaceId: string): Promise<string> {
  return joinPath(await workspaceDir(workspaceId), 'globals.json');
}

export async function collectionsDir(workspaceId: string): Promise<string> {
  return joinPath(await workspaceDir(workspaceId), 'collections');
}

export async function collectionDir(workspaceId: string, collectionId: string): Promise<string> {
  return joinPath(await collectionsDir(workspaceId), collectionId);
}

export async function collectionJsonPath(
  workspaceId: string,
  collectionId: string,
): Promise<string> {
  return joinPath(await collectionDir(workspaceId, collectionId), 'collection.json');
}

export async function requestsDir(workspaceId: string, collectionId: string): Promise<string> {
  return joinPath(await collectionDir(workspaceId, collectionId), 'requests');
}

export async function requestJsonPath(
  workspaceId: string,
  collectionId: string,
  requestId: string,
): Promise<string> {
  return joinPath(await requestsDir(workspaceId, collectionId), `${requestId}.json`);
}

export async function historyDir(workspaceId: string): Promise<string> {
  return joinPath(await workspaceDir(workspaceId), 'history');
}

export function todayJsonlName(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}.jsonl`;
}

export async function historyTodayPath(workspaceId: string): Promise<string> {
  return joinPath(await historyDir(workspaceId), todayJsonlName());
}

export async function foldersDir(workspaceId: string, collectionId: string): Promise<string> {
  return joinPath(await collectionDir(workspaceId, collectionId), 'folders');
}

export async function folderJsonPath(
  workspaceId: string,
  collectionId: string,
  folderId: string,
): Promise<string> {
  return joinPath(await foldersDir(workspaceId, collectionId), `${folderId}.json`);
}
