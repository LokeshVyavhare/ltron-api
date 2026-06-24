import { invoke } from '@tauri-apps/api/core';

let dataDirCache: string | null = null;
let configDirCache: string | null = null;
let cacheDirCache: string | null = null;

export async function appDataDir(): Promise<string> {
  if (dataDirCache === null) {
    dataDirCache = await invoke<string>('app_data_dir');
  }
  return dataDirCache;
}

export async function appConfigDir(): Promise<string> {
  if (configDirCache === null) {
    configDirCache = await invoke<string>('app_config_dir');
  }
  return configDirCache;
}

export async function appCacheDir(): Promise<string> {
  if (cacheDirCache === null) {
    cacheDirCache = await invoke<string>('app_cache_dir');
  }
  return cacheDirCache;
}

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).map((p) => p.replace(/\/+$/, '')).join('/');
}
