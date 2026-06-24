import { invoke } from '@tauri-apps/api/core';
import type { DirEntry, FileStat } from './types';

export const fsRead = (path: string) => invoke<string>('fs_read', { path });
export const fsReadBytesB64 = (path: string) => invoke<string>('fs_read_bytes', { path });
export const fsWrite = (path: string, content: string) =>
  invoke<void>('fs_write', { path, content });
export const fsWriteBytesB64 = (path: string, bytesB64: string) =>
  invoke<void>('fs_write_bytes', { path, bytesB64 });
export const fsList = (path: string) => invoke<DirEntry[]>('fs_list', { path });
export const fsDelete = (path: string, recursive = false) =>
  invoke<void>('fs_delete', { path, recursive });
export const fsMkdir = (path: string) => invoke<void>('fs_mkdir', { path });
export const fsRename = (from: string, to: string) => invoke<void>('fs_rename', { from, to });
export const fsExists = (path: string) => invoke<boolean>('fs_exists', { path });
export const fsStat = (path: string) => invoke<FileStat>('fs_stat', { path });
