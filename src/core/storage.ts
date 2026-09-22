import { openDB, type IDBPDatabase } from 'idb';
import type { AnySession } from './types';

const SESSION_KEY = 'fun-friday-studio.session.v1';
let db: Promise<IDBPDatabase> | undefined;
const memory = new Map<string, Blob>();
const warnings = new Set<string>();
export const getStorageWarnings = () => [...warnings];
export function storageWarning(message: string) {
  warnings.add(message);
  window.dispatchEvent(new Event('studio-storage-warning'));
}
async function database() {
  db ??= openDB('fun-friday-studio-images', 1, {
    upgrade(database) { database.createObjectStore('images'); },
    blocked() { storageWarning('Image storage is blocked by another tab. Close other Studio tabs and reload.'); },
  });
  return db;
}
export interface ImagePutOptions {
  durable?: boolean;
}
export const imageStore = {
  async put(blob: Blob, id: string = crypto.randomUUID(), options: ImagePutOptions = {}): Promise<string> {
    try { await (await database()).put('images', blob, id); }
    catch {
      if (options.durable) throw new Error('Persistent image storage is unavailable or full.');
      memory.set(id, blob); storageWarning('Temporary images — browser storage is unavailable or full. Export your session before closing this tab.');
    }
    return id;
  },
  async get(id: string): Promise<Blob> {
    const temporary = memory.get(id);
    if (temporary) return temporary;
    try {
      const blob = await (await database()).get('images', id);
      if (blob instanceof Blob) return blob;
    } catch { storageWarning('Image storage could not be read. Restore a session ZIP if images are missing.'); }
    throw new Error('An image is missing from this browser. Restore your session ZIP or upload the photos again.');
  },
  async delete(id: string) {
    memory.delete(id);
    try { await (await database()).delete('images', id); } catch { /* Temporary cleanup is best effort. */ }
  },
};
export function saveSession(session: AnySession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch { storageWarning('Temporary game progress — saving is unavailable. Export your session before closing this tab.'); }
}
export function readSavedSession(): unknown | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch { storageWarning('Saved game progress could not be read. You can restore a session ZIP.'); return null; }
}
export async function checkStorage() {
  try { localStorage.setItem('studio-check', '1'); localStorage.removeItem('studio-check'); }
  catch { storageWarning('Temporary session — local storage is unavailable. Export before closing this tab.'); }
  const key = `probe-${crypto.randomUUID()}`;
  await imageStore.put(new Blob(['ok']), key);
  await imageStore.delete(key);
}
