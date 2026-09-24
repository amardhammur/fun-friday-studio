import { beforeEach, describe, expect, it, vi } from 'vitest';

const openDB = vi.fn();
vi.mock('idb', () => ({ openDB }));

describe('image storage durability', () => {
  beforeEach(() => {
    vi.resetModules();
    openDB.mockReset();
    openDB.mockRejectedValue(new Error('IndexedDB unavailable'));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: vi.fn() },
    });
  });

  it('keeps the general in-memory fallback available', async () => {
    const { imageStore } = await import('../../src/core/storage');
    const blob = new Blob(['temporary']);

    await expect(imageStore.put(blob, 'temporary-id')).resolves.toBe('temporary-id');
    await expect(imageStore.get('temporary-id')).resolves.toBe(blob);
  });

  it('throws instead of falling back when durable storage is required', async () => {
    const { imageStore } = await import('../../src/core/storage');

    await expect(imageStore.put(new Blob(['durable']), 'durable-id', { durable: true }))
      .rejects.toThrow(/Persistent image storage is unavailable or full/);
  });
});

describe('demo session isolation', () => {
  it('preserves the personal session through demo play, reload and exit', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    try {
      const storage = await import('../../src/core/storage');
      const { createEvent } = await import('../../src/core/event');
      const personal = createEvent(); personal.title = 'Imported team';
      storage.saveSession(personal);
      const demo = createEvent(); demo.isDemo = true;
      storage.saveSession(demo);
      expect(JSON.parse(values.get('fun-friday-studio.session.v1')!)).toEqual(personal);
      expect(storage.readSavedSession()).toEqual(demo);
      storage.saveSession(personal);
      expect(storage.readSavedSession()).toEqual(personal);
    } finally { vi.unstubAllGlobals(); }
  });
});
