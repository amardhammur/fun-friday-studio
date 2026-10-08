import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivities, getActivity } from '../../src/core/registry';
import { activityEvent, activitySegment, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import type { Segment } from '../../src/core/types';

beforeAll(discoverActivities);
function removed(id: string, status: Segment['status'] = 'pending'): Segment {
  const activity = getActivity(id);
  const fixture = createEvent();
  if (activity) fixture.segments = [createSegment(activity)];
  const segment = activity ? activitySegment(fixture, 0) : undefined;
  if (segment) activity!.startNewGame(segment, eventDraft(activityEvent(fixture)));
  return { id: `old-${id}`, activityId: id, activityVersion: 1, title: id, status, setupStepId: 'game', weight: 1, settings: segment?.settings ?? {}, game: segment?.game ?? {} };
}
function kept() { return createSegment(getActivity('act-it-out')!); }

it('removes both retired games from discovery and the installed registry', () => {
  expect(getActivities().map(a => a.name)).toEqual(['Childhood vs Now', 'Act It Out', 'Commercial Clash', 'Selfie Bottle Challenge']);
  expect(getActivity('wait-why')).toBeUndefined();
  expect(getActivity('real-or-ridiculous')).toBeUndefined();
});

it('loads an older lineup without retired segments while retaining teams, players and other scores', () => {
  const event = createEvent(), active = kept();
  event.players = [{ id: 'guest', name: 'Asha' }]; event.teams[0].memberIds = ['guest']; event.playersInitialized = true;
  event.segments = [removed('wait-why'), active, removed('real-or-ridiculous')];
  event.currentSegmentIndex = 1;
  event.scoreEntries = [
    { id: 'old', teamId: event.teams[0].id, segmentId: event.segments[0].id, kind: 'round-award', points: 2, active: true },
    { id: 'keep', teamId: event.teams[1].id, segmentId: active.id, kind: 'manual-adjustment', points: 3, active: true },
    { id: 'shared', teamId: event.teams[0].id, kind: 'manual-adjustment', points: 1, active: true },
  ];
  const snapshot = structuredClone(event);
  const loaded = validateEvent(JSON.parse(JSON.stringify(event)));
  expect(loaded.segments).toEqual([active]);
  expect(loaded.currentSegmentIndex).toBe(0);
  expect(loaded.scoreEntries.map(e => e.id)).toEqual(['keep', 'shared']);
  expect(loaded.teams).toEqual(event.teams); expect(loaded.players).toEqual(event.players);
  expect(event).toEqual(snapshot);
  expect(validateEvent(loaded)).toEqual(loaded);
});

it('preserves the current surviving game when a removed activity preceded it', () => {
  const event = createEvent(); event.phase = 'segment';
  const active = kept(); active.status = 'setup';
  event.segments = [removed('real-or-ridiculous', 'done'), active]; event.currentSegmentIndex = 1;
  const loaded = validateEvent(event);
  expect(loaded.currentSegmentIndex).toBe(0);
  expect(loaded.phase).toBe('segment');
  expect(loaded.segments[0]).toEqual(active);
});

it.each(['segment', 'interstitial'] as const)('opens the next surviving setup when the current retired activity is in %s', phase => {
  const event = createEvent(); event.phase = phase;
  const active = kept();
  event.segments = [removed('wait-why', 'play'), removed('real-or-ridiculous'), active];
  const loaded = validateEvent(event);
  expect(loaded.phase).toBe('segment'); expect(loaded.currentSegmentIndex).toBe(0);
  expect(loaded.segments[0].id).toBe(active.id); expect(loaded.segments[0].status).toBe('setup');
});

it('returns to surviving standings when the removed current game was last', () => {
  const event = createEvent(); event.phase = 'segment';
  const active = kept(); active.status = 'done';
  event.segments = [active, removed('real-or-ridiculous', 'play')]; event.currentSegmentIndex = 1;
  const loaded = validateEvent(event);
  expect(loaded.phase).toBe('interstitial'); expect(loaded.currentSegmentIndex).toBe(0);
  expect(loaded.segments[0].id).toBe(active.id);
});

it('returns a retired-only event to planning without losing its roster', () => {
  const event = createEvent(); event.phase = 'segment'; event.isDemo = true;
  event.segments = [removed('wait-why', 'play'), removed('real-or-ridiculous')];
  const loaded = validateEvent(event);
  expect(loaded.segments).toEqual([]); expect(loaded.currentSegmentIndex).toBe(0); expect(loaded.phase).toBe('lineup');
  expect(loaded.teams).toEqual(event.teams);
});

it('still rejects genuinely unknown activities and invalid saved positions', () => {
  const event = createEvent(); event.segments = [removed('not-installed')];
  expect(() => validateEvent(event)).toThrow(/not installed/);
  event.segments = [removed('wait-why')]; event.currentSegmentIndex = 5;
  expect(() => validateEvent(event)).toThrow(/not in its line-up/);
});
