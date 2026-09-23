import { describe, expect, it } from 'vitest';
import { shortcutKeyLabel } from '../../src/core/projector';

describe('shortcut key labels', () => {
  it('names the keys that have no printable glyph', () => {
    expect(shortcutKeyLabel(' ')).toBe('Space');
    expect(shortcutKeyLabel('Enter')).toBe('↵');
    expect(shortcutKeyLabel('ArrowLeft')).toBe('←');
    expect(shortcutKeyLabel('ArrowRight')).toBe('→');
  });
  it('upper-cases a letter so the footer and the modal agree', () => {
    expect(shortcutKeyLabel('c')).toBe('C');
    expect(shortcutKeyLabel('s')).toBe('S');
  });
});
