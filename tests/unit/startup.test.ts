import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEvent } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import { preserveRejected, restoreStartup } from '../../src/core/startup';

const personalKey = 'fun-friday-studio.session.v1', demoKey = 'fun-friday-studio.demo.v1';
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());
it('round-trips an incomplete team-name edit', () => {
  const event = createEvent(); event.teams[0].name = '';
  expect(validateEvent(JSON.parse(JSON.stringify(event))).teams[0].name).toBe('');
});
it.each(['{broken JSON', JSON.stringify({ formatVersion: 99 })])('preserves rejected personal data for recovery: %s', raw => {
  values.set(personalKey, raw);
  const restored = restoreStartup();
  expect(values.get(personalKey)).toBe(raw);
  expect(restored.rejected).toEqual([expect.objectContaining({ key: personalKey, raw })]);
  expect(restored.session.isDemo).toBe(false);
});
it('recovers the personal event independently of a rejected demo', () => {
  const personal = createEvent(); personal.title = 'Keep my event';
  const raw = JSON.stringify(personal);
  values.set(personalKey, raw); values.set(demoKey, '{broken demo');
  const restored = restoreStartup();
  expect(restored.session).toEqual(personal);
  expect(restored.personalSession).toEqual(personal);
  expect(values.get(personalKey)).toBe(raw);
  expect(values.get(demoKey)).toBe('{broken demo');
  expect(restored.rejected[0].raw).toBe('{broken demo');
});
it('retains rejected personal data even while a valid demo resumes', () => {
  const demo = createEvent(); demo.isDemo = true;
  values.set(personalKey, 'bad personal'); values.set(demoKey, JSON.stringify(demo));
  const restored = restoreStartup();
  expect(restored.session).toEqual(demo);
  expect(restored.rejected[0].raw).toBe('bad personal');
  expect(values.get(personalKey)).toBe('bad personal');
});

it('archives rejected bytes before allowing subsequent saves', () => {
  values.set(personalKey, 'unreadable');
  const restored = restoreStartup();
  preserveRejected(restored.rejected);
  expect([...values.entries()].some(([key, raw]) => key.startsWith(`${personalKey}.rejected.`) && raw === 'unreadable')).toBe(true);
  expect(values.get(personalKey)).toBe('unreadable');
});
it('does not allow recovery to continue if the backup cannot be saved', () => {
  vi.stubGlobal('localStorage', { setItem: () => { throw new Error('full'); } });
  expect(() => preserveRejected([{ key: personalKey, raw: 'broken', error: 'invalid' }])).toThrow();
});
