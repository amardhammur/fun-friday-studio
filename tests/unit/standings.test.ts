import { describe, expect, it } from 'vitest';
import { createEvent } from '../../src/core/event';
import { setRoundAward } from '../../src/core/scoring';
import { advanceSegment, segmentStandings } from '../../src/app/standings-logic';
import type { EventSession, Segment } from '../../src/core/types';

const segment = (id: string, status: Segment['status'] = 'play'): Segment => ({ id, activityId: 'childhood-vs-now', activityVersion: 1, title: id, settings: {}, game: {}, status, setupStepId: 'game', weight: 1 });

function event(): EventSession {
  const base = createEvent();
  base.teams = [{ id: 't0', name: 'A', color: '#ffffff' }, { id: 't1', name: 'B', color: '#000000' }];
  base.segments = [segment('seg-a'), segment('seg-b', 'pending')];
  let entries = setRoundAward([], 'seg-a', 'r1', 't0', true);
  entries = setRoundAward(entries, 'seg-a', 'r2', 't1', true);
  base.scoreEntries = entries;
  return base;
}

describe('segment standings', () => {
  it('reports the running total and what each team gained this activity', () => {
    const base = event();
    base.scoreEntries = setRoundAward(base.scoreEntries, 'seg-a', 'r3', 't0', true);
    base.scoreEntries.push({ id: 'm', teamId: 't0', kind: 'manual-adjustment', points: 10, active: true });
    const rows = segmentStandings(base, 'seg-a');
    expect(rows[0].id).toBe('t0');
    expect(rows[0].total).toBe(14);
    expect(rows[0].gained).toBe(4);
    expect(rows[1].gained).toBe(2);
  });
  it('sorts by running total, not by what was gained', () => {
    const base = event();
    base.scoreEntries.push({ id: 'm', teamId: 't1', kind: 'manual-adjustment', points: 50, active: true });
    expect(segmentStandings(base, 'seg-a')[0].id).toBe('t1');
  });
});

describe('advancing between segments', () => {
  it('marks the finished segment done and moves to the next one', () => {
    const base = event();
    advanceSegment(base);
    expect(base.segments[0].status).toBe('done');
    expect(base.currentSegmentIndex).toBe(1);
    expect(base.segments[1].status).toBe('setup');
    expect(base.phase).toBe('segment');
  });
  it('goes to the wager after the last segment when one is set', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    base.wager = { question: 'Q', answer: 'A', bets: {} };
    advanceSegment(base);
    expect(base.phase).toBe('wager');
  });
  it('goes straight to the finale after the last segment with no wager', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    advanceSegment(base);
    expect(base.phase).toBe('finale');
  });
  it('skips a blank wager question', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    base.wager = { question: '   ', answer: '', bets: {} };
    advanceSegment(base);
    expect(base.phase).toBe('finale');
  });
});
