import { fsRead, fsWrite, fsList, fsExists, fsMkdir, fsDelete } from '../ipc/fs';

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!(await fsExists(path))) return null;
    const text = await fsRead(path);
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('readJson failed:', path, e);
    return null;
  }
}

export async function writeJson<T>(path: string, value: T): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  await fsWrite(path, text);
}

export async function listDir(path: string): Promise<{ name: string; is_dir: boolean }[]> {
  if (!(await fsExists(path))) return [];
  return await fsList(path);
}

export async function ensureDir(path: string): Promise<void> {
  await fsMkdir(path);
}

export async function appendJsonl<T>(path: string, value: T): Promise<void> {
  // Simple append: read existing, append line, write back. Atomic via fsWrite.
  // For higher throughput we'd add a Rust-side append command; this is fine for v0.
  let existing = '';
  if (await fsExists(path)) {
    existing = await fsRead(path);
    if (existing && !existing.endsWith('\n')) existing += '\n';
  }
  await fsWrite(path, existing + JSON.stringify(value) + '\n');
}

export async function readJsonl<T>(path: string): Promise<T[]> {
  if (!(await fsExists(path))) return [];
  const text = await fsRead(path);
  const out: T[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

export { fsDelete, fsExists };
