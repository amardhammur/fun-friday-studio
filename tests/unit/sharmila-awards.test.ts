import { beforeAll, describe, expect, it } from 'vitest';
import { sharmilaAwards as activity } from '../../activities/sharmila-awards/activity';
import { canSavePoints, confirmPoints, currentTurn, multiplier, parsePoints, setupIssues, spinQuestion, startNewGame, teamPoints } from '../../activities/sharmila-awards/logic';
import { questionList } from '../../activities/sharmila-awards/questions';
import { stateSchema, type GameState, type Settings } from '../../activities/sharmila-awards/types';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { clearSegmentProgress, segmentPaused } from '../../src/core/people/event-library';
import { createDemoEvent } from '../../src/core/demo';
import { discoverActivities } from '../../src/core/registry';
import { segmentScore } from '../../src/core/scoring';
import { validateEvent } from '../../src/core/session';
import { remapEventImages } from '../../src/core/transfer';

beforeAll(discoverActivities);
function fixture(teamCount = 2, weight = 1, correctPoints = 7) {
  const event = createEvent(); event.teams = event.teams.slice(0, teamCount); event.correctPoints = correctPoints;
  event.segments = [createSegment(activity)]; event.segments[0].weight = weight; event.phase = 'segment';
  const segment = activitySegment<Settings, GameState>(event, 0), shared = eventDraft(event);
  return { event, segment, shared };
}
function persist(f: ReturnType<typeof fixture>) {
  applyActivitySegment(f.event, 0, f.segment); applyEventUpdate(f.event, f.shared);
  return validateEvent(JSON.parse(JSON.stringify(f.event)));
}
function drawAndSave(f: ReturnType<typeof fixture>, points: number) {
  const id = currentTurn(f.segment.game).id;
  spinQuestion(f.segment, id, () => 0, 1_000);
  expect(confirmPoints(f.segment, f.shared, id, points, true)).toBe(true);
  return id;
}

describe('Sharmila Awards', () => {
  it('registers a playable demo with shared teams and no roster or photos required', async () => {
    const demo = await createDemoEvent(activity);
    expect((demo.segments[0].game as GameState).turns).toHaveLength(demo.teams.length);
    expect(validateEvent(demo).segments[0].activityId).toBe('sharmila-awards');
    expect(activity.settingsFields).toEqual([]);
    expect(activity.defaultSettings().questionText).toContain('What is Java?');
    expect(activity.defaultSettings().questionText).toContain('What is electricity?');
    expect(activity.defaultSettings().questionText).toContain('What is Newton’s third law?');
    expect(activity.defaultSettings().questionText).toContain('What is cloud computing?');
  });

  it('deduplicates edited English and Telugu lists and blocks shortages before changing progress', () => {
    expect(questionList(' Java? \r\n\nJAVA?\n విద్యుత్ అంటే ఏమిటి? \nవిద్యుత్ అంటే ఏమిటి?\nCloud  computing?\ncloud computing?')).toEqual(['Java?', 'విద్యుత్ అంటే ఏమిటి?', 'Cloud  computing?']);
    const f = fixture(); f.segment.settings.questionText = 'A\nA\na';
    const before = structuredClone(f);
    expect(setupIssues(f.segment.settings, f.shared).join(' ')).toContain('at least 2 unique questions');
    expect(() => startNewGame(f.segment, f.shared)).toThrow(/unique questions/);
    expect(f).toEqual(before);
    f.segment.settings.questionText = Array(101).fill(0).map((_, i) => `Q${i}`).join('\n');
    expect(setupIssues(f.segment.settings, f.shared).join(' ')).toContain('up to 100');
    f.segment.settings.questionText = activity.defaultSettings().questionText + '\n' + 'x'.repeat(301);
    expect(setupIssues(f.segment.settings, f.shared).join(' ')).toContain('300 characters');
  });

  it.each([2, 5])('gives every one of %i teams exactly one turn and draws without replacement', teams => {
    const f = fixture(teams); startNewGame(f.segment, f.shared);
    expect(f.segment.game.turns.map(t => [t.teamId, t.round])).toEqual(f.shared.teams.map(t => [t.id, 1]));
    const selected: string[] = [];
    for (let index = 0; index < teams; index++) {
      const turn = currentTurn(f.segment.game);
      spinQuestion(f.segment, turn.id, () => index % 2 ? .999999 : 0, 1_000);
      const draw = structuredClone(turn.draw); selected.push(draw!.questionId);
      spinQuestion(f.segment, turn.id, () => .5, 2_000);
      expect(turn.draw).toEqual(draw);
      expect(confirmPoints(f.segment, f.shared, turn.id, 0, true)).toBe(true);
      expect(stateSchema.safeParse(f.segment.game).success).toBe(true);
      expect(f.segment.phase).toBe(index === teams - 1 ? 'finale' : 'play');
    }
    expect(new Set(selected).size).toBe(teams);
    expect(persist(f).scoreEntries).toHaveLength(teams);
  });

  it('rejects empty, negative, fractional, exponent, and unsafe points but accepts zero and whole totals', () => {
    for (const raw of ['', ' ', '-1', '1.5', '1e3', '+5', 'NaN', 'Infinity', '9007199254740992']) expect(parsePoints(raw)).toBeUndefined();
    for (const raw of ['0', '17', ' 42 ', '0005']) expect(parsePoints(raw)).toBe(Number(raw));
    const f = fixture(2, 5); startNewGame(f.segment, f.shared);
    const turn = currentTurn(f.segment.game);
    expect(confirmPoints(f.segment, f.shared, turn.id, 10, true)).toBe(false);
    spinQuestion(f.segment, turn.id, () => 0);
    for (const points of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(confirmPoints(f.segment, f.shared, turn.id, points, true)).toBe(false);
    expect(canSavePoints(f.segment, f.shared, turn, 0)).toBe(true);
    expect(f.shared.scoreEntries).toEqual([]);
  });

  it.each([1, 3, 5])('adds totals with multiplier %i once, and corrections replace rather than duplicate awards', weight => {
    const f = fixture(2, weight); startNewGame(f.segment, f.shared);
    expect(multiplier(f.segment, f.shared)).toBe(weight);
    const first = drawAndSave(f, 1);
    expect(confirmPoints(f.segment, f.shared, first, 1, true)).toBe(false);
    expect(f.segment.game.currentTurnIndex).toBe(1);
    drawAndSave(f, 0);
    expect(teamPoints(f.segment.game, f.shared.teams[0].id)).toBe(1);
    expect(segmentScore(f.shared.scoreEntries, f.segment.segmentId, f.shared.teams[0].id)).toBe(weight);
    expect(f.shared.scoreEntries).toHaveLength(2);
    const before = f.segment.game.currentTurnIndex;
    expect(confirmPoints(f.segment, f.shared, first, 0)).toBe(true);
    expect(confirmPoints(f.segment, f.shared, first, 0)).toBe(true);
    expect(f.shared.scoreEntries).toHaveLength(2);
    expect(segmentScore(f.shared.scoreEntries, f.segment.segmentId, f.shared.teams[0].id)).toBe(0);
    expect(f.segment.game.currentTurnIndex).toBe(before);
    expect(confirmPoints(f.segment, f.shared, first, 1)).toBe(true);
    expect(segmentScore(f.shared.scoreEntries, f.segment.segmentId, f.shared.teams[0].id)).toBe(weight);
    expect(persist(f).segments[0].status).toBe('finale');
  });

  it('recovers selected questions and valid or invalid drafts through storage, pause, and import remapping', () => {
    const f = fixture(2, 3); startNewGame(f.segment, f.shared);
    drawAndSave(f, 4);
    const turn = currentTurn(f.segment.game); spinQuestion(f.segment, turn.id, () => .8, 1_000);
    turn.pointsDraft = '0';
    let recovered = persist(f);
    expect(recovered.segments[0].game).toEqual(f.segment.game);
    turn.pointsDraft = '-1'; f.segment.phase = 'setup'; recovered = persist(f);
    expect(segmentPaused(recovered, 0)).toBe(true);
    remapEventImages(recovered, { [turn.draw!.questionId]: 'not-an-image', [turn.teamId]: 'not-a-team' });
    expect(validateEvent(recovered).segments[0].game).toEqual(f.segment.game);
  });

  it('ignores stale spin/save clicks and prevents future turns from being awarded or skipped', () => {
    const f = fixture(); startNewGame(f.segment, f.shared);
    const later = f.segment.game.turns[1];
    spinQuestion(f.segment, later.id); expect(later.draw).toBeUndefined();
    expect(confirmPoints(f.segment, f.shared, later.id, 10, true)).toBe(false);
    const id = drawAndSave(f, 4);
    spinQuestion(f.segment, id); expect(currentTurn(f.segment.game).draw).toBeUndefined();
    expect(confirmPoints(f.segment, f.shared, id, 5, true)).toBe(false);
    const bad = structuredClone(f.segment.game); bad.currentTurnIndex = 2;
    expect(stateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects repeated or missing questions, inconsistent round order, and duplicate/missing/edited import awards', () => {
    const f = fixture(); startNewGame(f.segment, f.shared); drawAndSave(f, 4);
    spinQuestion(f.segment, currentTurn(f.segment.game).id, () => 0);
    const good = persist(f);
    const mutate = (change: (e: typeof good, game: GameState) => void) => {
      const bad = structuredClone(good); change(bad, bad.segments[0].game as GameState);
      expect(() => validateEvent(bad)).toThrow();
    };
    mutate((_, g) => { g.turns[1].draw = g.turns[0].draw; });
    mutate((_, g) => { g.turns[0].draw!.questionId = 'missing'; });
    mutate((_, g) => { g.turns[1].round = 2; });
    mutate(e => { e.scoreEntries.push({ ...e.scoreEntries[0], id: 'duplicate' }); });
    mutate(e => { e.scoreEntries.pop(); });
    mutate(e => { e.scoreEntries[0].points++; });
    mutate(e => { e.segments[0].status = 'finale'; });
    mutate((_, g) => { g.questions[0].text = 'Changed'; });
  });

  it('clears only its segment on restart, keeping the shared teams, other scores, and edited questions', () => {
    const f = fixture(); f.segment.settings.questionText += '\nతెలుగు ప్రశ్న?';
    startNewGame(f.segment, f.shared); drawAndSave(f, 4);
    const event = persist(f); event.segments.push(createSegment(activity));
    const other = { id: 'other', teamId: event.teams[0].id, segmentId: event.segments[1].id, kind: 'manual-adjustment' as const, points: 7, active: true };
    event.scoreEntries.push(other); const teams = structuredClone(event.teams);
    clearSegmentProgress(event, 0);
    expect(event.scoreEntries).toEqual([other]); expect(event.teams).toEqual(teams);
    expect(event.segments[0].settings).toEqual(f.segment.settings);
    expect(event.segments[0].game).toEqual(activity.createInitialState());
    expect(validateEvent(event).segments[0].status).toBe('setup');
  });

  it.each([false, true])('removes an unstarted second round from older saves, preserving first-round scores (first round complete: %s)', complete => {
    const f = fixture(2, 3); startNewGame(f.segment, f.shared);
    f.event.segments[0].activityVersion = 1;
    f.segment.game.turns.push(...f.shared.teams.map(t => ({ id: `2:${t.id}`, teamId: t.id, round: 2 as const })));
    drawAndSave(f, 4);
    if (complete) drawAndSave(f, 0);
    const recovered = persist(f), game = recovered.segments[0].game as GameState;
    expect(recovered.segments[0].activityVersion).toBe(2);
    expect(game.turns).toHaveLength(2);
    expect(game.turns.every(t => t.round === 1)).toBe(true);
    expect(game.currentTurnIndex).toBe(1);
    expect(game.legacyTwoRounds).toBeUndefined();
    expect(recovered.scoreEntries).toEqual(f.shared.scoreEntries);
    expect(validateEvent(recovered).segments[0].game).toEqual(game);
  });

  it('preserves an older second round that already has progress, then restarts with only one round', () => {
    const f = fixture(2, 3); startNewGame(f.segment, f.shared);
    f.event.segments[0].activityVersion = 1;
    f.segment.game.turns.push(...f.shared.teams.map(t => ({ id: `2:${t.id}`, teamId: t.id, round: 2 as const })));
    drawAndSave(f, 4); drawAndSave(f, 0); drawAndSave(f, 6);
    spinQuestion(f.segment, currentTurn(f.segment.game).id, () => 0);
    currentTurn(f.segment.game).pointsDraft = '3';
    const before = structuredClone(f.segment.game), recovered = persist(f);
    expect(recovered.segments[0].game).toEqual({ ...before, legacyTwoRounds: true });
    expect(recovered.scoreEntries).toEqual(f.shared.scoreEntries);
    expect(validateEvent(recovered).segments[0].game).toEqual(recovered.segments[0].game);
    const segment = activitySegment<Settings, GameState>(recovered, 0), shared = eventDraft(recovered);
    expect(confirmPoints(segment, shared, currentTurn(segment.game).id, 3, true)).toBe(true);
    expect(segment.phase).toBe('finale');
    expect(segmentScore(shared.scoreEntries, segment.segmentId, shared.teams[0].id)).toBe(30);
    startNewGame(segment, shared);
    expect(segment.game.turns).toHaveLength(2);
    expect(segment.game.legacyTwoRounds).toBeUndefined();
    expect(shared.scoreEntries).toEqual([]);
  });
});
