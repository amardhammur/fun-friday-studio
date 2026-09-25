import { createEvent } from './event';
import { validateEvent } from './session';
import { SESSION_KEY, DEMO_KEY, storageWarning } from './storage';
import type { EventSession } from './types';
export interface RejectedSave { key: string; raw: string; error: string }
// Read both documents before any save can replace the personal event or remove the demo.
export function restoreStartup() {
  const rejected: RejectedSave[] = [];
  const read = (key: string): EventSession | undefined => {
    let raw: string | null;
    try { raw = localStorage.getItem(key); }
    catch { storageWarning('Saved game progress could not be read. Reload when browser storage is available.'); throw new Error('Saved game progress could not be read.'); }
    if (raw === null) return;
    try { return validateEvent(JSON.parse(raw)); }
    catch (error) { rejected.push({ key, raw, error: (error as Error).message }); }
  };
  const personal = read(SESSION_KEY), demo = read(DEMO_KEY);
  const personalSession = personal && !personal.isDemo ? personal : undefined;
  return { session: demo ?? personalSession ?? createEvent(), personalSession, rejected };
}
export function preserveRejected(rejected: RejectedSave[]) {
  for (const { key, raw } of rejected) localStorage.setItem(`${key}.rejected.${crypto.randomUUID()}`, raw);
}
