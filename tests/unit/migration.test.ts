import { beforeAll, describe, expect, it } from 'vitest';
import v1 from '../fixtures/session-v1.json';
import { discoverActivities } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });

describe('v1 to v2 migration', () => {
  it('wraps a v1 session as a single segment', () => {
    const event = validateEvent(v1);
    expect(event.formatVersion).toBe(2);
    expect(event.segments).toHaveLength(1);
    expect(event.segments[0].activityId).toBe('childhood-vs-now');
    expect(event.segments[0].settings).toEqual({ shuffle: true, matchingTolerance: 0.12 });
    expect((event.segments[0].game as { rounds: unknown[] }).rounds).toHaveLength(1);
    expect(event.currentSegmentIndex).toBe(0);
  });
  it('maps v1 play phase onto the segment and the event', () => {
    const event = validateEvent(v1);
    expect(event.segments[0].status).toBe('play');
    expect(event.phase).toBe('segment');
  });
  it('maps v1 finale onto a segment finale', () => {
    const event = validateEvent({ ...v1, phase: 'finale' });
    expect(event.segments[0].status).toBe('finale');
    expect(event.phase).toBe('segment');
  });
  it('keeps shared people, teams, scores and assets at the event level', () => {
    const event = validateEvent(v1);
    expect(event.people).toHaveLength(1);
    expect(event.teams).toHaveLength(1);
    expect(event.scoreEntries).toHaveLength(1);
    expect(Object.keys(event.assets)).toHaveLength(4);
  });
  it('carries a migrated event with no wager', () => {
    expect(validateEvent(v1).wager).toBeUndefined();
  });
  it('rejects a segment whose activity is not installed', () => {
    expect(() => validateEvent({ ...v1, activityId: 'not-real' })).toThrow(/not installed/);
  });
  it('rejects a score entry pointing at an unknown team', () => {
    const broken = { ...v1, scoreEntries: [{ ...v1.scoreEntries[0], teamId: 'ghost' }] };
    expect(() => validateEvent(broken)).toThrow(/unknown team/);
  });
});

describe('v2 round trip', () => {
  it('accepts its own output unchanged', () => {
    const once = validateEvent(v1);
    expect(validateEvent(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
