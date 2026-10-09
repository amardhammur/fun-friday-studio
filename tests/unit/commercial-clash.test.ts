import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { teamScore } from '../../src/core/scoring';
import { validateEvent } from '../../src/core/session';
import type { ActivityContext } from '../../src/core/types';
import type { Settings, Game, Context } from '../../activities/product-in-disguise/performance/types';
import type { Settings as LegacySettings, Game as LegacyGame } from '../../activities/product-in-disguise/types';
import { productInDisguise as legacy } from '../../activities/product-in-disguise/legacy';
import * as play from '../../activities/product-in-disguise/performance/logic';
import { clearSegmentProgress } from '../../src/core/people/event-library';

beforeAll(discoverActivities);

function started() {
  const activity = getActivity('product-in-disguise')!;
  expect(activity.name).toBe('Commercial Clash');
  const event = createEvent(); event.segments = [createSegment(activity)];
  const segment = activitySegment<Settings, Game>(event, 0), draft = eventDraft(activityEvent(event));
  activity.startNewGame(segment, draft);
  const ctx: Context = { segment, event: { ...activityEvent(event), ...draft }, update: fn => fn(segment), updateEvent: fn => { fn(draft); Object.assign(ctx.event, draft); }, notify: () => {}, runTask: async (_label, task) => task(), goHome: () => {} };
  const key = (key: string) => activity.shortcuts.find(s => s.key === key)!.run(ctx as ActivityContext);
  return { activity, event, segment, draft, ctx, key };
}

it('opens the stage without choosing a product or starting the preparation timer', () => {
  const { segment, key } = started();
  expect(segment.game.step).toBe('wheel');
  expect(segment.game.product).toBeUndefined();
  expect(segment.game.timer.deadlineAt).toBeUndefined();
  key('n'); key('r'); key('t');
  expect(segment.game.step).toBe('wheel');
  expect(segment.game.product).toBeUndefined();
  expect(segment.game.timer.deadlineAt).toBeUndefined();
});

function prepare(game: ReturnType<typeof started>) {
  play.spinProduct(game.segment, () => 1.5 / 12, 0); play.finishSpin(game.segment, 4000);
  game.key('n');
}

function performAll(game: ReturnType<typeof started>) {
  if (game.segment.game.step === 'wheel') prepare(game);
  game.key('n');
  for (let i = 0; i < game.draft.teams.length; i++) game.key('n');
}

function enterScores(game: ReturnType<typeof started>) {
  game.draft.teams.forEach((team, i) => play.setJudgeScore(game.segment, team.id, i * 5));
}

it('starts shared preparation after the product draw and gives every team one performance', () => {
  const game = started(), { segment, draft, key } = game;
  prepare(game);
  expect(segment.game.step).toBe('prepare');
  expect(segment.game.product?.name).toBe('Umbrella');
  expect(segment.game.timer.durationMs).toBe(12 * 60_000);
  expect(segment.game.teamIds).toEqual(draft.teams.map(t => t.id));
  key('n');
  expect(segment.game.step).toBe('perform');
  expect(segment.game.timer.durationMs).toBe(180_000);
  for (let i = 0; i < 5; i++) {
    expect(segment.game.performanceIndex).toBe(i); key('n');
  }
  expect(segment.game.step).toBe('judging');
  expect(segment.game.performedCount).toBe(5);
  expect(segment.game.timer.deadlineAt).toBeUndefined();
  expect(draft.scoreEntries).toHaveLength(0);
});

it('requires every judge score, accepts zero and saves the exact totals once', () => {
  const game = started(); performAll(game);
  game.key('n'); game.key('r');
  expect(game.segment.phase).toBe('play');
  expect(game.draft.scoreEntries).toHaveLength(0);
  enterScores(game);
  game.segment.points.correct = 6;
  game.key('n'); game.key('r'); game.key('n');
  expect(game.segment.phase).toBe('finale');
  expect(game.segment.game.step).toBe('results');
  expect(game.draft.scoreEntries).toHaveLength(5);
  expect(game.draft.teams.map(t => teamScore(game.draft.scoreEntries, t.id))).toEqual([0, 5, 10, 15, 20]);
});

it('rejects premature score entry, unknown teams, negative and fractional scores', () => {
  const game = started(), first = game.draft.teams[0].id;
  play.setJudgeScore(game.segment, first, 7);
  expect(game.segment.game.scores[first]).toBeNull();
  performAll(game);
  for (const value of [-1, 1.5, NaN, Infinity]) play.setJudgeScore(game.segment, first, value);
  play.setJudgeScore(game.segment, 'missing', 10);
  expect(game.segment.game.scores[first]).toBeNull();
  expect(game.segment.game.scores).not.toHaveProperty('missing');
  const premature = structuredClone(game.segment.game); premature.performedCount = 1;
  expect(game.activity.stateSchema.safeParse(premature).success).toBe(false);
  const invalid = structuredClone(game.segment.game); invalid.scores[first] = -1;
  expect(game.activity.stateSchema.safeParse(invalid).success).toBe(false);
});

it('preserves paused preparation and partially entered scores across JSON reloads', () => {
  const game = started(); prepare(game); game.activity.onPause!(game.segment);
  const remaining = game.segment.game.timer.pausedRemainingMs;
  game.segment.game = game.activity.stateSchema.parse(JSON.parse(JSON.stringify(game.segment.game)));
  game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt! - Date.now()).toBeLessThanOrEqual(remaining!);
  game.key('t'); game.activity.onPause!(game.segment); game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt).toBeUndefined();
  performAll(game);
  play.setJudgeScore(game.segment, game.draft.teams[0].id, 17);
  const snapshot = JSON.parse(JSON.stringify(game.segment.game));
  expect(game.activity.stateSchema.parse(snapshot)).toEqual(game.segment.game);
  expect(snapshot.scores[game.draft.teams[0].id]).toBe(17);
  expect(snapshot.scores[game.draft.teams[1].id]).toBeNull();
});

it('updates corrected scores without duplication or losing manual adjustments', () => {
  const game = started(); performAll(game); enterScores(game); game.key('n');
  const [first, second] = game.draft.teams;
  game.draft.scoreEntries.push({ id: 'manual', teamId: first.id, segmentId: game.segment.segmentId, kind: 'manual-adjustment', points: 1, active: true });
  game.draft.scoreEntries.push({ id: 'other', teamId: first.id, segmentId: 'other', kind: 'manual-adjustment', points: 9, active: true });
  play.editScores(game.ctx);
  expect(game.segment.game.scores[first.id]).toBe(0);
  play.setJudgeScore(game.segment, second.id, 30);
  game.key('n'); game.key('n');
  expect(game.draft.scoreEntries).toHaveLength(7);
  expect(teamScore(game.draft.scoreEntries, second.id)).toBe(30);
  expect(teamScore(game.draft.scoreEntries, first.id)).toBe(10);
  game.activity.startNewGame(game.segment, game.draft);
  expect(game.draft.scoreEntries.map(e => e.id)).toEqual(['other']);
  expect(game.segment.game.step).toBe('wheel');
});

it('round-trips completed scores and lets an unstarted setup recover after team edits', () => {
  const game = started(); performAll(game); enterScores(game); game.key('n');
  applyActivitySegment(game.event, 0, game.segment); applyEventUpdate(game.event, game.draft);
  game.event.phase = 'segment';
  expect(validateEvent(JSON.parse(JSON.stringify(game.event))).segments[0].game).toEqual(game.segment.game);
  const fresh = started(); fresh.segment.phase = 'setup'; fresh.segment.game = fresh.activity.createInitialState(); fresh.draft.teams.pop();
  expect(fresh.activity.validateSession!(fresh.segment, fresh.ctx.event)).toEqual([]);
});

function votingEvent(completed = false) {
  const game = started(); performAll(game);
  applyActivitySegment(game.event, 0, game.segment); game.event.phase = 'segment';
  const s = game.event.segments[0], ids = game.event.teams.map(t => t.id);
  s.activityVersion = 3; s.status = completed ? 'finale' : 'play';
  s.settings = { ...game.segment.settings, votingSeconds: 180 };
  s.game = { ...game.segment.game, scores: undefined, step: completed ? 'reveal' : 'vote', ballots: Object.fromEntries(ids.map((id, i) => [id, Object.fromEntries(['funniest', 'creative', 'pitch'].map(a => [a, completed ? ids[(i + 1) % ids.length] : null]))])), ballotIndex: 0, awardIndex: completed ? 2 : 0, revealedCount: completed ? 3 : 0, timer: { durationMs: 180000, ...(completed ? { pausedRemainingMs: 0 } : { deadlineAt: 1234567 }) } };
  game.event.scoreEntries = [{ id: 'old-award', teamId: ids[0], segmentId: s.id, roundId: `ballot:${ids[1]}:funniest`, kind: 'round-award', points: 6, active: true }];
  return game.event;
}

it('moves saved voting sessions to judge entry while retaining prior scores', () => {
  const event = votingEvent(), loaded = validateEvent(event);
  expect(loaded.segments[0].game).toMatchObject({ step: 'judging', performedCount: 5 });
  expect((loaded.segments[0].game as Game).timer.deadlineAt).toBeUndefined();
  expect(loaded.scoreEntries).toEqual(event.scoreEntries);
});

it('keeps completed voting results and replaces old awards when the host edits scores', () => {
  const event = votingEvent(true), loaded = validateEvent(event);
  expect(loaded.segments[0].game).toMatchObject({ step: 'results' });
  expect(loaded.scoreEntries).toEqual(event.scoreEntries);
  const segment = activitySegment<Settings, Game>(loaded, 0), draft = eventDraft(activityEvent(loaded));
  const ctx: Context = { ...started().ctx, segment, event: activityEvent(loaded), update: fn => fn(segment), updateEvent: fn => fn(draft) };
  play.editScores(ctx);
  expect(segment.game.scores[loaded.teams[0].id]).toBe(6);
  play.setJudgeScore(segment, loaded.teams[0].id, 20);
  play.finishJudging(ctx);
  expect(draft.scoreEntries).toHaveLength(5);
  expect(teamScore(draft.scoreEntries, loaded.teams[0].id)).toBe(20);
});

it('keeps a paused completed voting game ready to reopen its saved results', () => {
  const event = votingEvent(true); event.segments[0].status = 'setup';
  const loaded = validateEvent(event);
  expect(loaded.segments[0].game).toMatchObject({ step: 'results' });
  expect(loaded.scoreEntries).toEqual(event.scoreEntries);
});

function legacyEvent() {
  const event = createEvent(); event.phase = 'segment'; event.segments = [createSegment(legacy)];
  const segment = activitySegment<LegacySettings, LegacyGame>(event, 0), draft = eventDraft(activityEvent(event));
  legacy.startNewGame(segment, draft);
  applyActivitySegment(event, 0, segment); applyEventUpdate(event, draft);
  return event;
}

it('preserves an older started game even before its first preparation timer', () => {
  const event = legacyEvent();
  expect(() => validateEvent(JSON.parse(JSON.stringify(event)))).not.toThrow();
  const loaded = validateEvent(JSON.parse(JSON.stringify(event)));
  expect(loaded.segments[0].activityVersion).toBe(4);
  expect(loaded.segments[0].game).toEqual(event.segments[0].game);
});

it('preserves older progress and scores, while Start over and unstarted setups upgrade', () => {
  const event = legacyEvent();
  const g = event.segments[0].game as LegacyGame; g.step = 'prepare';
  event.scoreEntries.push({ id: 'old-award', teamId: event.teams[0].id, segmentId: event.segments[0].id, kind: 'round-award', points: 2, active: true });
  const loaded = validateEvent(JSON.parse(JSON.stringify(event)));
  expect(loaded.scoreEntries).toEqual(event.scoreEntries);
  expect(loaded.segments[0].game).toEqual(g);
  clearSegmentProgress(loaded, 0);
  expect(loaded.segments[0].settings).toMatchObject({ mode: 'commercial-clash', preparationMinutes: 12 });
  expect(validateEvent(loaded).segments[0].game).toMatchObject({ mode: 'commercial-clash', teamIds: [] });
  const unstarted = legacyEvent(); unstarted.segments[0].status = 'setup';
  expect(validateEvent(unstarted).segments[0].settings).toMatchObject({ mode: 'commercial-clash' });
});
