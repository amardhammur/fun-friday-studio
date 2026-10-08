import { beforeAll, describe, expect, it } from 'vitest';
import { selfieBottleChallenge as activity } from '../../activities/selfie-bottle-challenge/activity';
import { canVisitTurn, confirmCount, endTurn, expireTurn, hasProgress, holdClock, multiplier, releaseClock, setupIssues, showResults, startNewGame, startTurn, teamCount, toggleClock, validateSession, visitTurn } from '../../activities/selfie-bottle-challenge/logic';
import { settingsSchema, stateSchema, type GameState, type Settings } from '../../activities/selfie-bottle-challenge/types';
import { activityEvent, activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { clearSegmentProgress, segmentPaused } from '../../src/core/people/event-library';
import { remainingMs } from '../../src/core/play/timer';
import { discoverActivities } from '../../src/core/registry';
import { segmentScore } from '../../src/core/scoring';
import { validateEvent } from '../../src/core/session';
import { remapEventImages } from '../../src/core/transfer';
import { createDemoEvent } from '../../src/core/demo';

beforeAll(discoverActivities);
function fixture(playersPerTeam: 1 | 2 | 3 = 3, turnSeconds: 45 | 60 = 60, weight = 1, correctPoints = 2) {
  const event = createEvent(); event.teams = event.teams.slice(0, 2); event.playersInitialized = true; event.correctPoints = correctPoints;
  event.players = event.teams.flatMap((team, i) => Array.from({ length: 3 }, (_, j) => ({ id: `player-${i}-${j}`, name: `Player ${i} ${j}` })));
  event.teams.forEach((team, i) => { team.memberIds = event.players.slice(i * 3, i * 3 + 3).map(p => p.id); });
  event.segments = [createSegment(activity)]; event.segments[0].weight = weight; event.phase = 'segment';
  const segment = activitySegment<Settings, GameState>(event, 0), shared = eventDraft(event);
  segment.settings = { playersPerTeam, turnSeconds, turnOrder: 'round-robin', selections: {} };
  return { event, segment, shared };
}

describe('Selfie Bottle Challenge', () => {
  it('prepares all five element teams with three different demo players each', async () => {
    const event = await createDemoEvent(activity);
    expect(event.teams.map(team => team.name)).toEqual(['Earth', 'Water', 'Air', 'Fire', 'Space']);
    expect(event.teams.map(team => team.memberIds.length)).toEqual([3, 3, 3, 3, 3]);
    expect(event.players).toHaveLength(15);
    expect(validateEvent(event).segments[0].game).toEqual(event.segments[0].game);
    expect((event.segments[0].game as GameState).turns).toHaveLength(15);
  });

  it('defaults to three automatic roster players and sixty seconds, and still accepts older setup drafts', () => {
    expect(activity.defaultSettings()).toEqual({ playersPerTeam: 3, turnSeconds: 60, turnOrder: 'team-by-team', selections: {} });
    expect(settingsSchema.safeParse({ ...activity.defaultSettings(), selections: { team: ['', '', 'player'] } }).success).toBe(true);
    for (const value of [0, 4, 1.5]) expect(settingsSchema.safeParse({ ...activity.defaultSettings(), playersPerTeam: value }).success).toBe(false);
    for (const value of [30, 90]) expect(settingsSchema.safeParse({ ...activity.defaultSettings(), turnSeconds: value }).success).toBe(false);
  });

  it('requires enough roster players for equal participation before changing any progress', () => {
    const { segment, shared } = fixture();
    segment.settings.selections[shared.teams[0].id] = ['player-0-0', 'player-0-0', 'player-1-0'];
    shared.teams[0].memberIds = ['player-0-0'];
    const before = structuredClone({ segment, shared });
    expect(setupIssues(segment.settings, shared).length).toBeGreaterThan(0);
    expect(() => startNewGame(segment, shared)).toThrow();
    expect({ segment, shared }).toEqual(before);
    expect(setupIssues(segment.settings, shared).join(' ')).toContain('needs at least 3');
  });

  it('automatically snapshots different players in team roster order without changing the roster', () => {
    const { segment, shared } = fixture(2);
    shared.teams[0].memberIds = ['player-0-2', 'player-0-0', 'player-0-1'];
    segment.settings.selections = { [shared.teams[0].id]: ['stale-player', ''] };
    const before = structuredClone({ players: shared.players, teams: shared.teams });
    expect(setupIssues(segment.settings, shared)).toEqual([]);
    startNewGame(segment, shared);
    expect(segment.game.turns.map(turn => turn.playerId)).toEqual(['player-0-2', 'player-1-0', 'player-0-0', 'player-1-1']);
    expect({ players: shared.players, teams: shared.teams }).toEqual(before);
    // Restore must keep the chosen snapshot even if the roster has gained a member or changed order.
    shared.teams[0].memberIds.reverse();
    expect(validateSession(segment, { ...activityEvent(createEvent()), ...shared })).toEqual([]);
  });

  it.each([1, 2, 3] as const)('makes equal round-robin turns with %i players per team', n => {
    const { segment, shared } = fixture(n, 45); startNewGame(segment, shared);
    expect(segment.game.turns).toHaveLength(n * 2);
    expect(segment.game.turns.map(t => t.playerId)).toEqual(Array.from({ length: n }, (_, i) => [`player-0-${i}`, `player-1-${i}`]).flat());
    expect(segment.game.turns.every(t => t.timer.durationMs === 45_000 && !t.timer.deadlineAt)).toBe(true);
    expect(hasProgress(segment.game)).toBe(true);
    expect(canVisitTurn(segment.game, 1)).toBe(false);
  });

  it('can finish all players on one team before moving to the next team', () => {
    const { segment, shared } = fixture(); segment.settings.turnOrder = 'team-by-team'; startNewGame(segment, shared);
    expect(segment.game.turns.map(t => t.playerId)).toEqual(['player-0-0', 'player-0-1', 'player-0-2', 'player-1-0', 'player-1-1', 'player-1-2']);
  });

  it('keeps a deadline across serialization, expires at the buzzer, and does not restart expired turns', () => {
    const { segment, shared } = fixture(1); startNewGame(segment, shared); startTurn(segment, 1_000);
    startTurn(segment, 2_000);
    expect(segment.game.turns[0].timer.deadlineAt).toBe(61_000);
    segment.game = stateSchema.parse(JSON.parse(JSON.stringify(segment.game)));
    expireTurn(segment, 60_999); expect(segment.game.turns[0].status).toBe('playing');
    expireTurn(segment, 61_000); expect(segment.game.turns[0].status).toBe('counting');
    expect(remainingMs(segment.game.turns[0].timer, 62_000)).toBe(0);
    toggleClock(segment, segment.game.turns[0].id, 62_000); startTurn(segment, 62_000);
    expect(segment.game.turns[0].status).toBe('counting');
    expect(stateSchema.safeParse(segment.game).success).toBe(true);
  });

  it('holds a running clock while correcting a past result, but preserves an explicitly stopped clock', () => {
    const { segment, shared } = fixture(1); startNewGame(segment, shared); startTurn(segment, 1_000);
    endTurn(segment, segment.game.turns[0].id, 2_000); confirmCount(segment, shared, segment.game.turns[0].id, 2);
    visitTurn(segment, 1); startTurn(segment, 3_000); visitTurn(segment, 0);
    holdClock(segment, 13_000); expect(segment.game.clockHeld).toBe(true);
    expect(segment.game.turns[1].timer.pausedRemainingMs).toBe(50_000);
    releaseClock(segment, 100_000); expect(segment.game.turns[1].timer.deadlineAt).toBe(150_000);
    toggleClock(segment, segment.game.turns[1].id, 110_000);
    holdClock(segment, 120_000); releaseClock(segment, 140_000);
    expect(segment.game.turns[1].timer.deadlineAt).toBeUndefined();
    expect(segment.game.turns[1].timer.pausedRemainingMs).toBe(40_000);
    expect(stateSchema.safeParse(segment.game).success).toBe(true);
  });

  it.each([1, 2, 5])('sums valid toothpicks and applies multiplier %i once, independently of event quiz points', weight => {
    const { segment, shared } = fixture(3, 60, weight, 7); startNewGame(segment, shared);
    expect(multiplier(segment, shared)).toBe(weight);
    for (let i = 0; i < segment.game.turns.length; i++) {
      visitTurn(segment, i); startTurn(segment, 1_000 + i * 100_000); endTurn(segment, segment.game.turns[i].id, 2_000 + i * 100_000);
      confirmCount(segment, shared, segment.game.turns[i].id, i % 2 === 0 ? [0, 4, 10][Math.floor(i / 2)] : 0);
      confirmCount(segment, shared, segment.game.turns[i].id, segment.game.turns[i].count!);
    }
    expect(teamCount(segment.game, shared.teams[0].id)).toBe(14);
    expect(segmentScore(shared.scoreEntries, segment.segmentId, shared.teams[0].id)).toBe(14 * weight);
    expect(shared.scoreEntries.filter(e => e.segmentId === segment.segmentId)).toHaveLength(2);
    confirmCount(segment, shared, segment.game.turns[2].id, 1);
    expect(segmentScore(shared.scoreEntries, segment.segmentId, shared.teams[0].id)).toBe(11 * weight);
    for (const invalid of [-1, 11, 0.5, NaN]) confirmCount(segment, shared, segment.game.turns[2].id, invalid);
    expect(segment.game.turns[2].count).toBe(1);
    showResults(segment); expect(segment.phase).toBe('finale');
  });

  it('does not score pending or running turns and requires all counts before the finale', () => {
    const { segment, shared } = fixture(1); startNewGame(segment, shared);
    confirmCount(segment, shared, segment.game.turns[0].id, 10); expect(shared.scoreEntries).toEqual([]);
    startTurn(segment, 1_000); confirmCount(segment, shared, segment.game.turns[0].id, 10); expect(shared.scoreEntries).toEqual([]);
    showResults(segment); expect(segment.phase).toBe('play');
  });

  it('persists a paused game, count drafts and references through the same validation/remap boundary as ZIP import', () => {
    const { event, segment, shared } = fixture(1, 45, 3); startNewGame(segment, shared); startTurn(segment, 1_000); holdClock(segment, 11_000);
    segment.phase = 'setup'; applyActivitySegment(event, 0, segment); applyEventUpdate(event, shared);
    const restored = validateEvent(JSON.parse(JSON.stringify(event)));
    expect(segmentPaused(restored, 0)).toBe(true);
    expect((restored.segments[0].game as GameState).turns[0].timer.pausedRemainingMs).toBe(35_000);
    const resumed = activitySegment<Settings, GameState>(restored, 0); releaseClock(resumed, 100_000); resumed.phase = 'play'; endTurn(resumed, resumed.game.turns[0].id, 101_000); resumed.game.turns[0].countDraft = 0;
    applyActivitySegment(restored, 0, resumed); remapEventImages(restored, { 'player-0-0': 'not-an-image' });
    expect(validateEvent(restored).segments[0].game).toEqual(resumed.game);
    expect((restored.segments[0].game as GameState).turns[0].playerId).toBe('player-0-0');
    restored.players = restored.players.filter(p => p.id !== 'player-0-0'); restored.teams[0].memberIds = restored.teams[0].memberIds.filter(id => id !== 'player-0-0');
    expect(() => validateEvent(restored)).toThrow();
  });

  it('rejects inconsistent imports and clears only this activity on restart', () => {
    const { event, segment, shared } = fixture(1); startNewGame(segment, shared); startTurn(segment, 1_000); endTurn(segment, segment.game.turns[0].id, 2_000); confirmCount(segment, shared, segment.game.turns[0].id, 10);
    applyActivitySegment(event, 0, segment); applyEventUpdate(event, shared);
    expect(validateSession(segment, activityEvent(event))).toEqual([]);
    segment.game.turns[0].timer.durationMs = 45_000; expect(validateSession(segment, activityEvent(event)).join(' ')).toContain('same turn length'); segment.game.turns[0].timer.durationMs = 60_000;
    const bad = structuredClone(segment.game); bad.turns[1].status = 'done'; expect(stateSchema.safeParse(bad).success).toBe(false);
    event.segments.push(createSegment(activity));
    const other = { id: 'other', teamId: event.teams[0].id, segmentId: event.segments[1].id, kind: 'round-award' as const, points: 17, active: true };
    event.scoreEntries.push(other); const teams = structuredClone(event.teams), players = structuredClone(event.players);
    clearSegmentProgress(event, 0);
    expect(event.scoreEntries).toEqual([other]); expect(event.segments[0].game).toEqual(activity.createInitialState());
    expect(event.teams).toEqual(teams); expect(event.players).toEqual(players);
    expect(validateEvent(event).segments[0].status).toBe('setup');
  });

  it('rejects extra imported time and duplicate, missing or altered derived score awards', () => {
    const { event, segment, shared } = fixture(1); startNewGame(segment, shared); startTurn(segment, Date.now());
    segment.game.turns[0].timer.deadlineAt = Date.now() + 600_000;
    applyActivitySegment(event, 0, segment); applyEventUpdate(event, shared);
    expect(() => validateEvent(event)).toThrow(/agreed turn length/);
    segment.game.turns[0].timer.deadlineAt = Date.now() + 10_000;
    endTurn(segment, segment.game.turns[0].id); confirmCount(segment, shared, segment.game.turns[0].id, 4);
    applyActivitySegment(event, 0, segment); applyEventUpdate(event, shared);
    expect(validateEvent(event).scoreEntries).toHaveLength(1);
    const good = structuredClone(event);
    event.scoreEntries.push({ ...event.scoreEntries[0], id: 'duplicate-with-another-id' });
    expect(() => validateEvent(event)).toThrow(/score awards/);
    event.scoreEntries = []; expect(() => validateEvent(event)).toThrow(/score awards/);
    event.scoreEntries = good.scoreEntries; event.scoreEntries[0].points = 8;
    expect(() => validateEvent(event)).toThrow(/score awards/);
  });
});
