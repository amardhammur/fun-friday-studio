import { describe, expect, it } from 'vitest';
import { bundledPrompts, categories, promptsIn } from '../../activities/act-it-out/prompts';
import type { GameState, Settings, AIOSegment } from '../../activities/act-it-out/types';
import { initialState, stateSchema } from '../../activities/act-it-out/types';
import { allocateTurns, buildDeck, eligiblePrompts, endTurn, markGuessed, markSkipped, moveTurn, startNewGame, startTurn, undoLast } from '../../activities/act-it-out/logic/turns';
import { loadDemo } from '../../activities/act-it-out/logic/demo';
import { teamScore } from '../../src/core/scoring';
import type { EventUpdate, Team } from '../../src/core/types';

describe('the bundled prompt deck', () => {
  it('offers four categories with at least 25 prompts each', () => {
    expect(categories).toHaveLength(4);
    for (const category of categories) expect(promptsIn([category]).length).toBeGreaterThanOrEqual(25);
  });
  it('never repeats a prompt, even across categories', () => {
    const texts = bundledPrompts.map(p => p.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
  it('tags every prompt with a real category', () => {
    for (const prompt of bundledPrompts) {
      expect(prompt.text.trim()).toBe(prompt.text);
      expect(prompt.text.length).toBeGreaterThan(0);
      expect(categories).toContain(prompt.category);
    }
  });
  it('returns nothing for a category that is not selected', () => {
    expect(promptsIn([])).toEqual([]);
    expect(promptsIn(['Nonsense'])).toEqual([]);
  });
});

const turn = (over: Partial<GameState['turns'][number]> = {}) => ({ id: 't1', teamId: 'team-a', results: [], status: 'pending' as const, ...over });
const state = (over: Partial<GameState> = {}): GameState => ({ ...initialState(), deck: [{ text: 'Kettle', category: 'Around the House' }, { text: 'Jaws', category: 'Movies & TV' }], ...over });

describe('the game state schema', () => {
  it('accepts a coherent game', () => {
    expect(stateSchema.safeParse(state({ cursor: 1, turns: [turn({ results: [{ text: 'Kettle', outcome: 'guessed' }], status: 'acting' })] })).success).toBe(true);
  });
  it('rejects a cursor that does not match the cards played', () => {
    const result = stateSchema.safeParse(state({ cursor: 2, turns: [turn({ results: [{ text: 'Kettle', outcome: 'guessed' }] })] }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain('does not match');
  });
  it('rejects a cursor past the end of the deck', () => {
    expect(stateSchema.safeParse(state({ cursor: 3, turns: [turn({ results: [{ text: 'a', outcome: 'guessed' }, { text: 'b', outcome: 'skipped' }, { text: 'c', outcome: 'guessed' }] })] })).success).toBe(false);
  });
  it('rejects a current turn that does not exist', () => {
    expect(stateSchema.safeParse(state({ turns: [turn()], currentTurnIndex: 4 })).success).toBe(false);
  });
  it('rejects duplicate turn ids', () => {
    expect(stateSchema.safeParse(state({ turns: [turn(), turn()] })).success).toBe(false);
  });
  it('starts empty and valid', () => {
    expect(stateSchema.safeParse(initialState()).success).toBe(true);
  });
});

const teams: Team[] = [{ id: 'team-a', name: 'Coffee Breakers', color: '#f7d873' }, { id: 'team-b', name: 'Reply-All Crew', color: '#eea7bb' }];
const settings = (over: Partial<Settings> = {}): Settings => ({ categories: ['Office Life'], customPrompts: [], turnSeconds: 90, roundsPerTeam: 1, ...over });
const anEvent = (over: Partial<EventUpdate> = {}): EventUpdate => ({ title: 'Event', isDemo: false, phase: 'segment', wager: undefined, correctPoints: 2, stealPoints: 1, people: [], facePairs: [], teams, scoreEntries: [], assets: {}, ...over });
const aSegment = (over: Partial<Settings> = {}): AIOSegment => ({
  formatVersion: 1, id: 'e1', title: 'Event', activityId: 'act-it-out', activityVersion: 1, segmentId: 'seg-1',
  points: { correct: 2, steal: 1 }, createdAt: '', updatedAt: '', isDemo: false, phase: 'setup', setupStepId: 'game',
  settings: settings(over), game: initialState(), scoreEntries: [],
});
function started(over: Partial<Settings> = {}) {
  const segment = aSegment(over), event = anEvent();
  startNewGame(segment, event);
  return { segment, event };
}

describe('building the deck', () => {
  it('keeps only the chosen categories', () => {
    expect(eligiblePrompts(settings()).every(p => p.category === 'Office Life')).toBe(true);
  });
  it('puts the host own prompts in and trims blank lines', () => {
    const prompts = eligiblePrompts(settings({ customPrompts: ['  The 4pm deploy  ', '', '   '] }));
    expect(prompts.map(p => p.text)).toContain('The 4pm deploy');
    expect(prompts.some(p => p.text === '')).toBe(false);
  });
  it('drops a custom prompt that repeats a bundled one, keeping the host wording', () => {
    const prompts = eligiblePrompts(settings({ customPrompts: ['printer JAM'] }));
    expect(prompts.filter(p => p.text.toLowerCase() === 'printer jam')).toHaveLength(1);
    expect(prompts.find(p => p.text.toLowerCase() === 'printer jam')!.text).toBe('printer JAM');
  });
  it('shuffles without losing or duplicating a card', () => {
    const deck = buildDeck(settings(), () => 0.42), plain = eligiblePrompts(settings());
    expect(deck).toHaveLength(plain.length);
    expect(new Set(deck.map(p => p.text))).toEqual(new Set(plain.map(p => p.text)));
  });
});

describe('allocating turns', () => {
  it('runs every team once per round, in order', () => {
    const turns = allocateTurns(teams, 2);
    expect(turns.map(t => t.teamId)).toEqual(['team-a', 'team-b', 'team-a', 'team-b']);
    expect(new Set(turns.map(t => t.id)).size).toBe(4);
    expect(turns.every(t => t.status === 'pending' && t.results.length === 0)).toBe(true);
  });
});

describe('starting a new game', () => {
  it('deals a deck, allocates turns and enters play', () => {
    const { segment } = started();
    expect(segment.phase).toBe('play');
    expect(segment.game.turns).toHaveLength(2);
    expect(segment.game.cursor).toBe(0);
    expect(segment.game.deck.length).toBeGreaterThan(0);
    expect(segment.game.timer.durationMs).toBe(90_000);
  });
  it('refuses to start without enough prompts for every turn', () => {
    const segment = aSegment({ categories: [], customPrompts: ['One', 'Two'] });
    expect(() => startNewGame(segment, anEvent())).toThrow(/not enough prompts/i);
  });
  it('refuses to start with an unnamed team', () => {
    expect(() => startNewGame(aSegment(), anEvent({ teams: [{ id: 'team-a', name: '  ', color: '#fff' }] }))).toThrow(/name/i);
  });
  it('clears only this segment scores, never an earlier activity', () => {
    const segment = aSegment(), event = anEvent({ scoreEntries: [
      { id: 'other:award-1', teamId: 'team-a', segmentId: 'seg-other', kind: 'round-award', points: 6, active: true },
      { id: 'seg-1:award-old', teamId: 'team-a', segmentId: 'seg-1', kind: 'round-award', points: 4, active: true },
    ] });
    startNewGame(segment, event);
    expect(event.scoreEntries.map(e => e.segmentId)).toEqual(['seg-other']);
  });
});

describe('playing a turn', () => {
  it('ignores cards until the turn has started', () => {
    const { segment, event } = started();
    markGuessed(segment, event);
    expect(segment.game.cursor).toBe(0);
    expect(event.scoreEntries).toHaveLength(0);
  });
  it('scores each guessed card and advances the cursor', () => {
    const { segment, event } = started();
    startTurn(segment, 'Sam', 1_000);
    markGuessed(segment, event); markSkipped(segment, event); markGuessed(segment, event);
    expect(segment.game.cursor).toBe(3);
    expect(segment.game.turns[0].results.map(r => r.outcome)).toEqual(['guessed', 'skipped', 'guessed']);
    expect(teamScore(event.scoreEntries, 'team-a')).toBe(4);
    expect(event.scoreEntries).toHaveLength(1);
  });
  it('records the guesser and runs the clock from the turn length', () => {
    const { segment } = started();
    startTurn(segment, '  Sam  ', 1_000);
    expect(segment.game.turns[0].guesserName).toBe('Sam');
    expect(segment.game.turns[0].status).toBe('acting');
    expect(segment.game.timer.deadlineAt).toBe(91_000);
  });
  it('leaves the guesser unset when the host does not name one', () => {
    const { segment } = started();
    startTurn(segment, '   ', 1_000);
    expect(segment.game.turns[0].guesserName).toBeUndefined();
  });
  it('is idempotent: the entry is derived, never incremented', () => {
    const { segment, event } = started();
    startTurn(segment, '', 0);
    markGuessed(segment, event); markGuessed(segment, event);
    const first = teamScore(event.scoreEntries, 'team-a');
    undoLast(segment, event); undoLast(segment, event);
    expect(teamScore(event.scoreEntries, 'team-a')).toBe(0);
    expect(event.scoreEntries).toHaveLength(1);
    markGuessed(segment, event); markGuessed(segment, event);
    expect(teamScore(event.scoreEntries, 'team-a')).toBe(first);
  });
  it('undoes only the card most recently drawn, and only mid-turn', () => {
    const { segment, event } = started();
    startTurn(segment, '', 0);
    markGuessed(segment, event);
    undoLast(segment, event);
    expect(segment.game.cursor).toBe(0);
    expect(segment.game.turns[0].results).toHaveLength(0);
    undoLast(segment, event);
    expect(segment.game.cursor).toBe(0);
    markGuessed(segment, event); endTurn(segment, 5_000);
    undoLast(segment, event);
    expect(segment.game.cursor).toBe(1);
  });
  it('stops dealing once the deck is spent', () => {
    const segment = aSegment({ categories: [], customPrompts: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] }), event = anEvent();
    startNewGame(segment, event);
    startTurn(segment, '', 0);
    for (let i = 0; i < 10; i++) markGuessed(segment, event);
    expect(segment.game.cursor).toBe(6);
    expect(segment.game.turns[0].results).toHaveLength(6);
  });
  it('keeps the cursor equal to the cards played through every path', () => {
    const { segment, event } = started();
    startTurn(segment, '', 0); markGuessed(segment, event); markSkipped(segment, event); undoLast(segment, event); endTurn(segment, 1);
    moveTurn(segment, 1); startTurn(segment, '', 2); markGuessed(segment, event); endTurn(segment, 3);
    const played = segment.game.turns.reduce((n, t) => n + t.results.length, 0);
    expect(segment.game.cursor).toBe(played);
    expect(stateSchema.safeParse(segment.game).success).toBe(true);
  });
});

describe('moving between turns', () => {
  it('resets the clock for the next team', () => {
    const { segment } = started();
    startTurn(segment, '', 0); endTurn(segment, 1_000);
    moveTurn(segment, 1);
    expect(segment.game.currentTurnIndex).toBe(1);
    expect(segment.game.timer.deadlineAt).toBeUndefined();
    expect(segment.game.timer.durationMs).toBe(90_000);
  });
  it('will not run past the end until every turn is done', () => {
    const { segment } = started();
    startTurn(segment, '', 0); endTurn(segment, 1); moveTurn(segment, 1);
    moveTurn(segment, 1);
    expect(segment.phase).toBe('play');
    startTurn(segment, '', 2); endTurn(segment, 3); moveTurn(segment, 1);
    expect(segment.phase).toBe('finale');
  });
  it('will not move before the first turn', () => {
    const { segment } = started();
    moveTurn(segment, -1);
    expect(segment.game.currentTurnIndex).toBe(0);
  });
});

describe('the demo', () => {
  it('prepares a playable game with no images and no async work', async () => {
    const prepared = await loadDemo(aSegment(), anEvent());
    expect(prepared.event.isDemo).toBe(true);
    expect(prepared.event.assets).toEqual({});
    expect(prepared.event.teams.length).toBeGreaterThanOrEqual(2);
    startNewGame(prepared.segment, prepared.event);
    expect(prepared.segment.phase).toBe('play');
    expect(prepared.segment.game.turns.length).toBe(prepared.event.teams.length);
    expect(stateSchema.safeParse(prepared.segment.game).success).toBe(true);
  });
  it('leaves dealing the deck to startNewGame, as App.tsx expects', async () => {
    const prepared = await loadDemo(aSegment(), anEvent());
    expect(prepared.segment.game.deck).toEqual([]);
    expect(prepared.segment.phase).toBe('setup');
  });
});
