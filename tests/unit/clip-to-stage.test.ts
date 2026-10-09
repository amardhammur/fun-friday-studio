import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import { teamScore } from '../../src/core/scoring';
import { editScores, setScore } from '../../activities/clip-to-stage/logic';
import { youtubeReference } from '../../activities/clip-to-stage/source';
import type { Context, Game, Settings } from '../../activities/clip-to-stage/types';

beforeAll(discoverActivities);

function started() {
  const activity = getActivity('clip-to-stage');
  expect(activity, 'Clip to Stage must be registered').toBeDefined();
  const event = createEvent(); event.segments = [createSegment(activity!)];
  const segment = activitySegment<Settings, Game>(event, 0), draft = eventDraft(activityEvent(event));
  segment.settings.youtubeUrl = 'https://www.youtube.com/shorts/M7lc1UVf-VE';
  activity!.startNewGame(segment, draft);
  const ctx: Context = { segment, event: { ...activityEvent(event), ...draft }, update: fn => fn(segment), updateEvent: fn => { fn(draft); Object.assign(ctx.event, draft); }, notify: () => {}, runTask: async (_label, task) => task(), goHome: () => {} };
  const key = (key: string) => activity!.shortcuts.find(s => s.key === key)!.run(ctx);
  return { activity: activity!, event, segment, draft, ctx, key };
}

function performAll(game: ReturnType<typeof started>) {
  game.key('n'); game.key('n');
  for (let i = 0; i < game.draft.teams.length; i++) game.key('n');
}

it('starts with the shared reference and waits for the host before timing practice', () => {
  const { segment, key } = started();
  expect(segment.game.step).toBe('watch');
  expect(segment.game.timer.deadlineAt).toBeUndefined();
  key('n');
  expect(segment.game.step).toBe('practise');
  expect(segment.game.timer.durationMs).toBe(600000);
  expect(segment.game.timer.deadlineAt).toBeGreaterThan(Date.now());
});

it('gives each team exactly one performance then opens untimed judge score entry', () => {
  const game = started(); game.key('n'); game.key('n');
  for (let i = 0; i < 5; i++) {
    expect(game.segment.game.performanceIndex).toBe(i);
    expect(game.segment.game.timer.durationMs).toBe(180000);
    game.key('n');
  }
  expect(game.segment.game.step).toBe('judging');
  expect(game.segment.game.performedCount).toBe(5);
  expect(game.segment.game.timer.deadlineAt).toBeUndefined();
  expect(game.draft.scoreEntries).toEqual([]);
});

it('requires all scores, accepts zero and awards exact totals once', () => {
  const game = started(); performAll(game); game.key('n');
  expect(game.segment.phase).toBe('play');
  game.draft.teams.forEach((t, i) => { game.segment.game.scores[t.id] = i * 7; });
  game.segment.points.correct = 10;
  game.key('n'); game.key('n');
  expect(game.segment.game.step).toBe('results');
  expect(game.segment.phase).toBe('finale');
  expect(game.draft.scoreEntries).toHaveLength(5);
  expect(game.draft.teams.map(t => teamScore(game.draft.scoreEntries, t.id))).toEqual([0, 7, 14, 21, 28]);
});

it('corrects judge totals in place while retaining manual adjustments and other activity scores', () => {
  const game = started(), team = game.draft.teams[0]; performAll(game);
  const existing = [
    { id: 'manual', teamId: team.id, segmentId: game.segment.segmentId, kind: 'manual-adjustment' as const, points: 2, active: true },
    { id: 'other', teamId: team.id, segmentId: 'other-activity', kind: 'round-award' as const, points: 9, active: true },
  ];
  game.draft.scoreEntries.push(...existing);
  game.draft.teams.forEach(t => setScore(game.segment, t.id, 20)); game.key('n');
  editScores(game.ctx); setScore(game.segment, team.id, 0); game.key('n'); game.key('n');
  expect(game.draft.scoreEntries).toHaveLength(7);
  expect(game.draft.scoreEntries.filter(e => ['manual', 'other'].includes(e.id))).toEqual(existing);
  expect(teamScore(game.draft.scoreEntries, team.id)).toBe(11);
  expect(game.segment.game.scores[team.id]).toBe(0);
});

it('rejects a completed save whose score ledger differs from the judge totals', () => {
  const game = started(); performAll(game);
  game.draft.teams.forEach(t => setScore(game.segment, t.id, 10)); game.key('n');
  applyActivitySegment(game.event, 0, game.segment); applyEventUpdate(game.event, game.draft); game.event.phase = 'segment';
  expect(() => validateEvent(game.event)).not.toThrow();
  game.event.scoreEntries[0].points = 99;
  expect(() => validateEvent(game.event)).toThrow(/judge totals/i);
});

it('canonicalizes supported YouTube links and treats clip links as external players', () => {
  for (const url of ['https://youtu.be/M7lc1UVf-VE', 'https://m.youtube.com/watch?v=M7lc1UVf-VE', 'https://www.youtube.com/shorts/M7lc1UVf-VE', 'https://youtube.com/embed/M7lc1UVf-VE', 'https://youtube.com/live/M7lc1UVf-VE']) {
    expect(youtubeReference(url)?.embedUrl).toBe('https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1');
  }
  expect(youtubeReference('https://youtu.be/M7lc1UVf-VE?t=1h2m3s')?.embedUrl).toContain('&start=3723');
  expect(youtubeReference('https://www.youtube.com/clip/Abc12345')).toEqual({ url: 'https://www.youtube.com/clip/Abc12345' });
  for (const url of ['https://user:pass@youtube.com/watch?v=M7lc1UVf-VE', 'https://youtube.com:8080/watch?v=M7lc1UVf-VE', 'https://youtu.be/M7lc1UVf-VE/extra', 'data:text/html,test']) expect(youtubeReference(url)).toBeUndefined();
});

it('keeps the remaining practice time and leaves a manually paused clock stopped', () => {
  const game = started(); game.key('n');
  game.activity.onPause!(game.segment);
  expect(game.segment.game.timer.deadlineAt).toBeUndefined();
  const remaining = game.segment.game.timer.pausedRemainingMs;
  game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt).toBeDefined();
  expect(game.segment.game.timer.deadlineAt! - Date.now()).toBeLessThanOrEqual(remaining!);
  game.key('t'); game.activity.onPause!(game.segment); game.activity.onResume!(game.segment);
  expect(game.segment.game.timer.deadlineAt).toBeUndefined();
});

it('round-trips partial score entry and completed totals', () => {
  const game = started(); performAll(game);
  game.segment.game.scores[game.draft.teams[0].id] = 12;
  game.event.phase = 'segment';
  applyActivitySegment(game.event, 0, game.segment); applyEventUpdate(game.event, game.draft);
  game.event.phase = 'segment';
  expect(validateEvent(JSON.parse(JSON.stringify(game.event))).segments[0].game).toEqual(game.segment.game);
  game.draft.teams.forEach(t => { game.segment.game.scores[t.id] = 12; }); game.key('n');
  applyActivitySegment(game.event, 0, game.segment); applyEventUpdate(game.event, game.draft); game.event.phase = 'segment';
  expect(validateEvent(JSON.parse(JSON.stringify(game.event))).scoreEntries).toEqual(game.draft.scoreEntries);
});

it('rejects invalid sources, missing local clips and scoring before performances finish', () => {
  const game = started();
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE', 'https://www.youtube.com/watch?v=bad', 'https://example.com/video']) {
    game.segment.settings.youtubeUrl = url;
    expect(() => game.activity.startNewGame(game.segment, game.draft)).toThrow();
  }
  game.segment.settings.source = 'local'; game.segment.settings.videoAssetId = 'missing';
  expect(() => game.activity.startNewGame(game.segment, game.draft)).toThrow(/video|clip/i);
  const premature = structuredClone(game.segment.game); premature.step = 'judging';
  expect(game.activity.stateSchema.safeParse(premature).success).toBe(false);
  const invalid = structuredClone(game.segment.game); invalid.scores[game.draft.teams[0].id] = -1;
  expect(game.activity.stateSchema.safeParse(invalid).success).toBe(false);
});
