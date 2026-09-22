import { beforeAll, describe, expect, it } from 'vitest';
import v1 from '../fixtures/session-v1.json';
import v1Windowed from '../fixtures/session-v1-windowed.json';
import { discoverActivities } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';
import { setRoundAward, teamScore } from '../../src/core/scoring';

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
  it('rebases a legacy round-award entry onto the migrated segment id', () => {
    const event = validateEvent(v1);
    const segmentId = event.segments[0].id;
    expect(event.scoreEntries[0].id).toBe(`${segmentId}:award-round-p1`);
    expect(event.scoreEntries[0].segmentId).toBe(segmentId);
  });
  it('lets a re-mark of an already-scored round upsert instead of double-counting', () => {
    const event = validateEvent(v1);
    const segmentId = event.segments[0].id;
    const before = event.scoreEntries.length;
    const next = setRoundAward(event.scoreEntries, segmentId, 'round-p1', 't0', true, event.scoreEntries[0].points);
    expect(next).toHaveLength(before);
    expect(teamScore(next, 't0')).toBe(teamScore(event.scoreEntries, 't0'));
  });
  it('rebases a Task1-3 window document carrying top-level segmentId/points onto the migrated segment', () => {
    const event = validateEvent(v1Windowed);
    expect(() => validateEvent(v1Windowed)).not.toThrow();
    const segmentId = event.segments[0].id;
    expect(segmentId).not.toBe('default');
    expect(event.scoreEntries[0].id).toBe(`${segmentId}:award-round-p1`);
    expect(event.scoreEntries[0].segmentId).toBe(segmentId);
    expect(event).not.toHaveProperty('segmentId');
    expect(event).not.toHaveProperty('points');
  });
});

describe('v2 round trip', () => {
  it('accepts its own output unchanged', () => {
    const once = validateEvent(v1);
    expect(validateEvent(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
