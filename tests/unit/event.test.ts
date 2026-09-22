import { describe, expect, it } from 'vitest';
import { createEvent, foldSegmentView, segmentView, type EventSession } from '../../src/core/event';
import type { AnySession, Segment } from '../../src/core/types';

const segment = (id: string, game: unknown): Segment => ({
  id, activityId: 'childhood-vs-now', activityVersion: 1, title: id,
  settings: { shuffle: true }, game, status: 'play', setupStepId: 'game', weight: 1,
});
const event = (): EventSession => ({
  ...createEvent(),
  segments: [segment('seg-a', { rounds: [{ id: 'r1' }] }), segment('seg-b', { rounds: [] })],
  currentSegmentIndex: 0,
  people: [{ id: 'p1', name: 'Asha', funFact: '', included: true, facePairId: 'f1' }],
});

function apply(source: EventSession, change: (view: AnySession) => void): EventSession {
  const next = structuredClone(source);
  const view = segmentView(next, next.currentSegmentIndex);
  change(view);
  foldSegmentView(next, next.currentSegmentIndex, view);
  return next;
}

describe('segment view', () => {
  it('projects the current segment onto the fields activities already read', () => {
    const view = segmentView(event(), 0);
    expect(view.activityId).toBe('childhood-vs-now');
    expect(view.phase).toBe('play');
    expect(view.setupStepId).toBe('game');
    expect(view.settings).toEqual({ shuffle: true });
    expect((view.game as { rounds: unknown[] }).rounds).toHaveLength(1);
    expect(view.segmentId).toBe('seg-a');
  });
  it('resolves the segment weight into the point values the activity awards', () => {
    const base = event();
    base.correctPoints = 2; base.stealPoints = 1; base.segments[0].weight = 3;
    expect(segmentView(base, 0).points).toEqual({ correct: 6, steal: 3 });
  });
  it('treats points as derived and never folds them back onto the segment', () => {
    const next = apply(event(), s => { s.points = { correct: 99, steal: 99 }; });
    expect(next.segments[0]).not.toHaveProperty('points');
    expect(next.correctPoints).toBe(2);
  });
  it('writes through in-place mutation of game state', () => {
    const next = apply(event(), s => { (s.game as { rounds: unknown[] }).rounds.push({ id: 'r2' }); });
    expect((next.segments[0].game as { rounds: unknown[] }).rounds).toHaveLength(2);
  });
  it('folds back whole-field assignment of game and settings', () => {
    const next = apply(event(), s => { s.game = { rounds: [] }; s.settings = { shuffle: false }; });
    expect(next.segments[0].game).toEqual({ rounds: [] });
    expect(next.segments[0].settings).toEqual({ shuffle: false });
  });
  it('folds back the Object.assign pattern the setup steps use', () => {
    const prepared = { ...segmentView(event(), 0), setupStepId: 'names', game: { rounds: [] }, people: [] };
    const next = apply(event(), s => { Object.assign(s, prepared); });
    expect(next.segments[0].setupStepId).toBe('names');
    expect(next.segments[0].game).toEqual({ rounds: [] });
    expect(next.people).toEqual([]);
  });
  it('maps phase onto segment status in both directions', () => {
    const next = apply(event(), s => { s.phase = 'finale'; });
    expect(next.segments[0].status).toBe('finale');
    expect(segmentView(next, 0).phase).toBe('finale');
  });
  it('sends shared fields to the event, not to the segment', () => {
    const next = apply(event(), s => {
      s.teams = [{ id: 't9', name: 'Nines', color: '#ffffff' }];
      s.scoreEntries = [{ id: 'e1', teamId: 't9', kind: 'manual-adjustment', points: 1, active: true }];
      s.people[0].name = 'Asha B';
    });
    expect(next.teams).toHaveLength(1);
    expect(next.scoreEntries).toHaveLength(1);
    expect(next.people[0].name).toBe('Asha B');
    expect(next.segments[0]).not.toHaveProperty('teams');
  });
  it('never leaks a write into another segment', () => {
    const next = apply(event(), s => { (s.game as { rounds: unknown[] }).rounds.push({ id: 'r2' }); });
    expect((next.segments[1].game as { rounds: unknown[] }).rounds).toHaveLength(0);
  });
});

describe('createEvent', () => {
  it('starts on the lineup with four teams and no segments', () => {
    const fresh = createEvent();
    expect(fresh.formatVersion).toBe(2);
    expect(fresh.phase).toBe('lineup');
    expect(fresh.segments).toEqual([]);
    expect(fresh.teams).toHaveLength(4);
  });
});
