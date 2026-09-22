import { describe, expect, it } from 'vitest';
import { bundledPrompts, categories, promptsIn } from '../../activities/act-it-out/prompts';
import type { GameState } from '../../activities/act-it-out/types';
import { initialState, stateSchema } from '../../activities/act-it-out/types';

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
