import { describe, expect, it } from 'vitest';
import { bundledPrompts, categories, promptsIn } from '../../activities/act-it-out/prompts';

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
