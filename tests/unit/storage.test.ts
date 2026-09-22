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
