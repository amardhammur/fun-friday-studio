import { beforeAll, expect, it } from 'vitest';
import { discoverActivities } from '../../src/core/registry';
import { productInDisguise as legacyActivity } from '../../activities/product-in-disguise/legacy';
import { createEvent, createSegment, activitySegment, activityEvent, eventDraft } from '../../src/core/event';
import { teamScore } from '../../src/core/scoring';
import type { ActivityContext } from '../../src/core/types';
import type { Settings, Game } from '../../activities/product-in-disguise/types';
import { briefsArchive } from '../../activities/product-in-disguise/briefs';
import { reviewRound } from '../../activities/product-in-disguise/logic';
import { strFromU8, unzipSync } from 'fflate';

beforeAll(discoverActivities);

function started() {
  const activity = legacyActivity;
  const event = createEvent(); event.segments = [createSegment(activity!)];
  const segment = activitySegment<Settings, Game>(event, 0), draft = eventDraft(activityEvent(event));
  activity!.startNewGame(segment, draft);
  const ctx: ActivityContext = { segment, event: { ...activityEvent(event), ...draft }, update: fn => fn(segment), updateEvent: fn => { fn(draft); Object.assign(ctx.event, draft); }, notify: () => {}, runTask: async (_label, task) => task(), goHome: () => {} };
  const key = (key: string) => activity!.shortcuts.find(s => s.key === key)!.run(ctx);
  return { activity: activity!, segment, draft, ctx, key };
}

function revealFirst({ key }: ReturnType<typeof started>) {
  key('n'); // preparation
  key('n'); // first commercial
  key('c'); // host confirms both mandatory clues were communicated
  key('n'); // collect guesses
  key('l'); // all guesses collected
  key('r');
}

it('gives every team exactly one product and the same number of guessing opportunities', () => {
  const { segment, draft } = started();
  expect(segment.game.rounds).toHaveLength(5);
  expect(new Set(segment.game.rounds.map(r => r.product.id)).size).toBe(5);
  for (const team of draft.teams) {
    expect(segment.game.rounds.filter(r => r.teamId === team.id)).toHaveLength(1);
    expect(segment.game.rounds.filter(r => r.teamId !== team.id)).toHaveLength(4);
  }
});

it('requires the two clues and locked audience guesses before revealing', () => {
  const { segment, draft, key } = started();
  key('r'); key('1'); expect(segment.game.step).toBe('rules');
  key('n'); key('r'); expect(segment.game.step).toBe('prepare');
  key('n'); key('n'); key('r'); expect(segment.game.step).toBe('perform');
  key('c'); key('n'); expect(segment.game.step).toBe('guess');
  key('r'); key('2'); expect(segment.game.step).toBe('guess');
  expect(draft.scoreEntries).toHaveLength(0);
  key('l'); key('r'); expect(segment.game.step).toBe('reveal');
});

it('awards only guessing teams and keeps separate, undoable awards', () => {
  const game = started(); revealFirst(game);
  const { segment, draft, key } = game;
  key('1'); key('2'); key('3');
  expect(teamScore(draft.scoreEntries, draft.teams[0].id)).toBe(0);
  expect(teamScore(draft.scoreEntries, draft.teams[1].id)).toBe(2);
  expect(teamScore(draft.scoreEntries, draft.teams[2].id)).toBe(2);
  key('2'); expect(teamScore(draft.scoreEntries, draft.teams[1].id)).toBe(0);
  key('2'); expect(teamScore(draft.scoreEntries, draft.teams[1].id)).toBe(2);
  expect(draft.scoreEntries).toHaveLength(2);
  expect(segment.game.rounds[0].results[draft.teams[0].id]).toBeUndefined();
});

it('waits for every audience result before advancing and finishes after every team presents', () => {
  const game = started(); revealFirst(game);
  const { segment, draft, key } = game;
  key('n'); expect(segment.game.index).toBe(0);
  for (let round = 0; round < 5; round++) {
    const owner = segment.game.rounds[segment.game.index].teamId;
    for (let i = 0; i < 5; i++) if (draft.teams[i].id !== owner) key(String(i + 1));
    key('n');
    if (round < 4) { key('c'); key('n'); key('l'); key('r'); }
  }
  expect(segment.phase).toBe('finale');
  for (const team of draft.teams) expect(teamScore(draft.scoreEntries, team.id)).toBe(8);
});

it('preserves paused time and snapshot assignments across reloads', () => {
  const { activity, segment, key } = started(); key('n');
  activity.onPause!(segment);
  const remaining = segment.game.timer.pausedRemainingMs;
  const roundIds = segment.game.rounds.map(r => r.product.id);
  segment.game = activity.stateSchema.parse(JSON.parse(JSON.stringify(segment.game)));
  activity.onResume!(segment);
  expect(segment.game.timer.deadlineAt).toBeGreaterThan(Date.now());
  expect(segment.game.timer.deadlineAt! - Date.now()).toBeLessThanOrEqual(remaining!);
  expect(segment.game.rounds.map(r => r.product.id)).toEqual(roundIds);
  key('t'); activity.onPause!(segment); activity.onResume!(segment);
  expect(segment.game.timer.deadlineAt).toBeUndefined();
});

it('applies event points without a presenting bonus and restart preserves other activity scores', () => {
  const game = started(); game.segment.points.correct = 6; revealFirst(game);
  game.key('2');
  expect(teamScore(game.draft.scoreEntries, game.draft.teams[1].id)).toBe(6);
  game.draft.scoreEntries.push({ id: 'other', teamId: game.draft.teams[0].id, segmentId: 'other', kind: 'manual-adjustment', points: 9, active: true });
  game.activity.startNewGame(game.segment, game.draft);
  expect(game.draft.scoreEntries.map(e => e.id)).toEqual(['other']);
});

it('rejects duplicate products, unsafe reveal state, and unknown team references in saves', () => {
  const { activity, segment, draft } = started();
  const duplicate = structuredClone(segment.game);
  duplicate.rounds[1].product = duplicate.rounds[0].product;
  expect(activity.stateSchema.safeParse(duplicate).success).toBe(false);
  const unsafe = structuredClone(segment.game); unsafe.step = 'reveal';
  expect(activity.stateSchema.safeParse(unsafe).success).toBe(false);
  const scoredOwner = structuredClone(segment.game);
  scoredOwner.rounds[0].results[scoredOwner.rounds[0].teamId] = 'correct';
  expect(activity.stateSchema.safeParse(scoredOwner).success).toBe(false);
  segment.game.rounds[0].teamId = 'missing';
  expect(activity.validateSession!(segment, { ...activityEvent(createEvent()), ...draft }).length).toBeGreaterThan(0);
});

it('lets setup recover from changed event teams without rejecting the saved event', () => {
  const { activity, segment, draft } = started();
  segment.phase = 'setup';
  draft.teams.pop();
  expect(activity.validateSession!(segment, { ...activityEvent(createEvent()), ...draft })).toEqual([]);
});

it('exports one private brief per team with the correct product and both required clues', () => {
  const { segment, draft } = started();
  draft.teams[0].name = 'Ad/Agency'; draft.teams[1].name = 'Ad/Agency';
  const files = unzipSync(briefsArchive(segment.game.rounds, draft.teams, 75));
  expect(Object.keys(files)).toHaveLength(5);
  expect(Object.keys(files)).toContain('Ad-Agency.txt');
  expect(Object.keys(files)).toContain('Ad-Agency (2).txt');
  const first = strFromU8(files['Ad-Agency.txt']);
  expect(first).toContain('YOUR SECRET PRODUCT: Stapler');
  expect(first).toContain('It fastens sheets of paper together.');
  expect(first).toContain('Pressing it pushes a small metal fastener through the pages.');
  expect(first).not.toContain('YOUR SECRET PRODUCT: Umbrella');
});

it('corrects an earlier audience result without replaying or duplicating completed commercials', () => {
  const game = started(); revealFirst(game);
  game.key('m'); game.key('n');
  game.key('c'); game.key('n'); game.key('l'); game.key('r'); game.key('m');
  reviewRound(game.segment, 0); game.key('2');
  expect(teamScore(game.draft.scoreEntries, game.draft.teams[1].id)).toBe(2);
  game.key('n');
  expect(game.segment.game.index).toBe(1);
  expect(game.segment.game.step).toBe('reveal');
  expect(game.segment.game.rounds[1].product.id).toBe('umbrella');
  game.key('n');
  expect(game.segment.game.index).toBe(2);
  expect(game.segment.game.step).toBe('perform');
  expect(game.segment.game.rounds[2].cluesConfirmed).toBe(false);
  expect(game.draft.scoreEntries.filter(e => e.active)).toHaveLength(1);
});
