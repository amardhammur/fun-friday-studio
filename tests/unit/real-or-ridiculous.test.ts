import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivities, getActivity } from '../../src/core/registry';
import { createEvent, createSegment, activitySegment, activityEvent, eventDraft } from '../../src/core/event';
import { teamScore } from '../../src/core/scoring';
import type { ActivityContext } from '../../src/core/types';
import type { Settings, Game } from '../../activities/real-or-ridiculous/types';
beforeAll(discoverActivities);
function started(rounds = 6) {
  const activity = getActivity('real-or-ridiculous');
  expect(activity, 'the replacement activity is registered').toBeDefined();
  const event = createEvent(); event.segments = [createSegment(activity!)];
  const segment = activitySegment<Settings, Game>(event, 0), draft = eventDraft(activityEvent(event));
  segment.settings.rounds = rounds;
  activity!.startNewGame(segment, draft);
  const ctx: ActivityContext = { segment, event: { ...activityEvent(event), ...draft }, update: fn => fn(segment), updateEvent: fn => { fn(draft); Object.assign(ctx.event, draft); }, notify: () => {}, runTask: async (_label, task) => task(), goHome: () => {} };
  const key = (key: string) => activity!.shortcuts.find(s => s.key === key)!.run(ctx);
  return { activity: activity!, segment, draft, ctx, key };
}
it('replaces the library card but keeps the old activity available for saved events', () => {
  expect(getActivities().map(a => a.id)).toContain('real-or-ridiculous');
  expect(getActivities().map(a => a.id)).not.toContain('wait-why');
  expect(getActivity('wait-why')).toBeDefined();
});
it('deals two real pitches and one fiction without repeating any invention', () => {
  const { segment } = started(8);
  expect(segment.game.deck).toHaveLength(8);
  const cards = segment.game.deck.flatMap((r) => r.cards);
  expect(new Set(cards.map((c) => c.id)).size).toBe(24);
  for (const round of segment.game.deck) {
    expect(round.cards.filter((c) => c.kind === 'fiction')).toHaveLength(1);
    expect(round.cards.filter((c) => c.kind === 'real')).toHaveLength(2);
    for (const card of round.cards.filter((c) => c.kind === 'real')) expect(card.source.url).toMatch(/^https:\/\//);
  }
});
it('requires both votes and the clue before revealing or awarding points', () => {
  const { segment, draft, key } = started();
  key('r'); key('1'); expect(segment.game.step).toBe('rules'); expect(draft.scoreEntries).toHaveLength(0);
  key('n'); expect(segment.game.step).toBe('pitch');
  key('r'); expect(segment.game.step).toBe('pitch');
  key('n'); expect(segment.game.step).toBe('vote'); expect(segment.game.timer.deadlineAt).toBeUndefined();
  key('n'); expect(segment.game.step).toBe('vote');
  key('h'); expect(segment.game.step).toBe('clue'); expect(segment.game.timer.durationMs).toBe(15000);
  key('r'); key('1'); expect(draft.scoreEntries).toHaveLength(0);
  key('n'); expect(segment.game.step).toBe('finalVote');
  key('r'); expect(segment.game.step).toBe('reveal');
  key('1'); key('2'); key('1'); key('1');
  expect(draft.scoreEntries).toHaveLength(2);
  expect(teamScore(draft.scoreEntries, draft.teams[0].id)).toBe(2);
  expect(teamScore(draft.scoreEntries, draft.teams[1].id)).toBe(2);
  key('n'); expect(segment.game.index).toBe(1); expect(segment.game.step).toBe('pitch');
});
it('pauses a running clue timer through reload and leaves a manually stopped timer stopped', () => {
  const { activity, segment, key } = started();
  key('n'); key('n'); key('h');
  const before = segment.game.timer.deadlineAt;
  activity.onPause!(segment);
  const remaining = segment.game.timer.pausedRemainingMs;
  expect(remaining).toBeGreaterThan(0); expect(remaining).toBeLessThanOrEqual(15000);
  segment.game = activity.stateSchema.parse(JSON.parse(JSON.stringify(segment.game)));
  activity.onResume!(segment); expect(segment.game.timer.deadlineAt).toBeGreaterThanOrEqual(before! - 10);
  key('t'); activity.onPause!(segment); activity.onResume!(segment);
  expect(segment.game.timer.deadlineAt).toBeUndefined();
});
it('finishes after all reveals and restart only clears this activity’s scores', () => {
  const { activity, segment, draft, key } = started(); key('n');
  for (let i = 0; i < 6; i++) { key('n'); key('h'); key('n'); key('r'); key('1'); key('n'); }
  expect(segment.phase).toBe('finale'); expect(teamScore(draft.scoreEntries, draft.teams[0].id)).toBe(12);
  draft.scoreEntries.push({ id: 'other', teamId: draft.teams[0].id, segmentId: 'other', kind: 'manual-adjustment', points: 9, active: true });
  activity.startNewGame(segment, draft); expect(draft.scoreEntries.map(e => e.id)).toEqual(['other']);
});
it('rejects malformed saves and unsafe evidence links', () => {
  const { activity, segment } = started();
  const valid = structuredClone(segment.game);
  segment.game.index = 100; expect(activity.stateSchema.safeParse(segment.game).success).toBe(false);
  const real = valid.deck[0].cards.find(c => c.kind === 'real')!;
  real.source.url = 'javascript:alert(1)'; expect(activity.stateSchema.safeParse(valid).success).toBe(false);
});
