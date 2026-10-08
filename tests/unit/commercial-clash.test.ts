import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { teamScore } from '../../src/core/scoring';
import { validateEvent } from '../../src/core/session';
import type { ActivityContext } from '../../src/core/types';
import type { Settings, Game, Ballot } from '../../activities/product-in-disguise/performance/types';
import type { Settings as LegacySettings, Game as LegacyGame } from '../../activities/product-in-disguise/types';
import { productInDisguise as legacy } from '../../activities/product-in-disguise/legacy';
import { awardResults, castVote, editVotes, finishSpin, spinProduct } from '../../activities/product-in-disguise/performance/logic';
import { clearSegmentProgress } from '../../src/core/people/event-library';

beforeAll(discoverActivities);
const awards = ['funniest', 'creative', 'pitch'];

function started() {
  const activity = getActivity('product-in-disguise')!;
  expect(activity.name).toBe('Commercial Clash');
  const event = createEvent(); event.segments = [createSegment(activity)];
  const segment = activitySegment<Settings, Game>(event, 0), draft = eventDraft(activityEvent(event));
  activity.startNewGame(segment, draft);
  const ctx: ActivityContext = { segment, event: { ...activityEvent(event), ...draft }, update: fn => fn(segment), updateEvent: fn => { fn(draft); Object.assign(ctx.event, draft); }, notify: () => {}, runTask: async (_label, task) => task(), goHome: () => {} };
  const key = (key: string) => activity.shortcuts.find(s => s.key === key)!.run(ctx);
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
  spinProduct(game.segment, () => 1.5 / 12, 0); finishSpin(game.segment, 4000);
  game.key('n');
}

function performAll(game: ReturnType<typeof started>) {
  if (game.segment.game.step === 'wheel') prepare(game);
  game.key('n');
  for (let i = 0; i < game.draft.teams.length; i++) game.key('n');
}

function fillVotes(game: ReturnType<typeof started>) {
  game.key('n'); // begin public voting and host entry
  game.draft.teams.forEach((team, i, teams) => {
    const recipient = teams[(i + 1) % teams.length].id;
    for (const award of awards) castVote(game.segment, team.id, award as keyof Ballot, recipient);
    game.key('n');
  });
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
  expect(segment.game.step).toBe('vote');
  expect(segment.game.performedCount).toBe(5);
  expect(draft.scoreEntries).toHaveLength(0);
});

it('locks complete ballots before revealing and awards each vote exactly once', () => {
  const game = started();
  game.key('r'); expect(game.draft.scoreEntries).toHaveLength(0);
  performAll(game); game.key('n'); game.key('n'); game.key('r');
  expect(game.segment.game.step).toBe('ballots');
  expect(game.draft.scoreEntries).toHaveLength(0);
  // Fill the real saved ballots while still in the host-entry phase.
  game.draft.teams.forEach((team, i, teams) => {
    game.segment.game.ballots[team.id] = Object.fromEntries(awards.map(a => [a, teams[(i + 1) % teams.length].id])) as Ballot;
    game.key('n');
  });
  expect(game.segment.game.step).toBe('reveal');
  expect(game.draft.scoreEntries).toHaveLength(0);
  game.key('n'); expect(game.segment.game.awardIndex).toBe(0);
  for (let i = 0; i < 3; i++) {
    game.key('r'); game.key('r');
    expect(game.segment.game.revealedCount).toBe(i + 1);
    expect(game.draft.scoreEntries).toHaveLength(5 * (i + 1));
    game.key('n');
  }
  expect(game.segment.phase).toBe('finale');
  for (const team of game.draft.teams) expect(teamScore(game.draft.scoreEntries, team.id)).toBe(6);
});

it('rejects self votes, unknown teams, and award reveals before all performances', () => {
  const game = started(); performAll(game); game.key('n');
  const selfVote = structuredClone(game.segment.game), first = game.draft.teams[0].id;
  selfVote.ballots[first].funniest = first;
  expect(game.activity.stateSchema.safeParse(selfVote).success).toBe(false);
  const premature = structuredClone(game.segment.game); premature.step = 'reveal';
  expect(game.activity.stateSchema.safeParse(premature).success).toBe(false);
  game.segment.game.ballots[first].pitch = 'missing-team';
  expect(game.activity.validateSession!(game.segment, game.ctx.event).length).toBeGreaterThan(0);
});

it('preserves paused preparation and votes across JSON reloads', () => {
  const game = started(); prepare(game); game.activity.onPause!(game.segment);
  const remaining = game.segment.game.timer.pausedRemainingMs;
  game.segment.game = game.activity.stateSchema.parse(JSON.parse(JSON.stringify(game.segment.game)));
  game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt! - Date.now()).toBeLessThanOrEqual(remaining!);
  game.key('t'); game.activity.onPause!(game.segment); game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt).toBeUndefined();
  performAll(game); fillVotes(game); game.key('r');
  const snapshot = JSON.parse(JSON.stringify(game.segment.game));
  expect(game.activity.stateSchema.parse(snapshot)).toEqual(game.segment.game);
});

it('applies the activity multiplier and restart only clears its own scores', () => {
  const game = started(); game.segment.points.correct = 6;
  performAll(game); fillVotes(game); game.key('r');
  for (const team of game.draft.teams) expect(teamScore(game.draft.scoreEntries, team.id)).toBe(6);
  game.draft.scoreEntries.push({ id: 'other', teamId: game.draft.teams[0].id, segmentId: 'other', kind: 'manual-adjustment', points: 9, active: true });
  game.activity.startNewGame(game.segment, game.draft);
  expect(game.draft.scoreEntries.map(e => e.id)).toEqual(['other']);
  expect(game.segment.game.step).toBe('wheel');
});

it('round-trips the saved event and lets an unstarted setup recover after team edits', () => {
  const game = started(); performAll(game); fillVotes(game); game.key('r');
  const event = { ...game.event, ...game.draft, phase: 'segment', segments: [{ ...game.event.segments[0], status: 'play', settings: game.segment.settings, game: game.segment.game }] };
  expect(validateEvent(JSON.parse(JSON.stringify(event))).segments[0].game).toEqual(game.segment.game);
  const fresh = started(); fresh.segment.phase = 'setup'; fresh.segment.game = fresh.activity.createInitialState(); fresh.draft.teams.pop();
  expect(fresh.activity.validateSession!(fresh.segment, fresh.ctx.event)).toEqual([]);
});

it('rejects ineligible votes through the host controls and shares tied awards', () => {
  const game = started(), [first, second] = game.draft.teams;
  castVote(game.segment, first.id, 'funniest', second.id);
  expect(game.segment.game.ballots[first.id].funniest).toBeNull();
  performAll(game); game.key('n');
  castVote(game.segment, first.id, 'funniest', first.id);
  castVote(game.segment, first.id, 'funniest', 'missing');
  castVote(game.segment, 'missing', 'funniest', first.id);
  expect(game.segment.game.ballots[first.id].funniest).toBeNull();
  for (const award of awards) castVote(game.segment, first.id, award as keyof Ballot, second.id);
  castVote(game.segment, first.id, 'funniest', null);
  game.key('n'); expect(game.segment.game.ballotIndex).toBe(0);
  game.draft.teams.forEach((team, i, teams) => {
    for (const award of awards) castVote(game.segment, team.id, award as keyof Ballot, teams[(i + 1) % teams.length].id);
    game.key('n');
  });
  expect(awardResults(game.segment.game, 'funniest')).toEqual(game.draft.teams.map(t => ({ teamId: t.id, votes: 1 })));
  const before = structuredClone(game.segment.game.ballots);
  castVote(game.segment, first.id, 'funniest', game.draft.teams[2].id);
  expect(game.segment.game.ballots).toEqual(before);
});

it('corrects a locked ballot without duplicate awards or losing host adjustments', () => {
  const game = started(); performAll(game); fillVotes(game); game.key('r');
  game.draft.scoreEntries.push({ id: 'manual', teamId: game.draft.teams[0].id, segmentId: game.segment.segmentId, kind: 'manual-adjustment', points: 1, active: true });
  editVotes(game.ctx as ActivityContext<Settings, Game>);
  expect(game.draft.scoreEntries.map(e => e.id)).toEqual(['manual']);
  castVote(game.segment, game.draft.teams[0].id, 'funniest', game.draft.teams[2].id);
  for (let i = 0; i < 5; i++) game.key('n');
  game.key('r'); game.key('r');
  expect(game.draft.scoreEntries).toHaveLength(6);
  expect(teamScore(game.draft.scoreEntries, game.draft.teams[1].id)).toBe(0);
  expect(teamScore(game.draft.scoreEntries, game.draft.teams[2].id)).toBe(4);
  expect(teamScore(game.draft.scoreEntries, game.draft.teams[0].id)).toBe(3);
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
  expect(loaded.segments[0].activityVersion).toBe(3);
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
