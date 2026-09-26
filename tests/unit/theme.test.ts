import { describe, expect, it } from 'vitest';
import { THEMES, nextTheme, themeName } from '../../src/theme/theme';

describe('theme selection', () => {
  it('keeps the existing themes and adds Ink & Paper', () => {
    expect(THEMES.map(theme => theme.id)).toEqual(['afterhours', 'gameshow', 'ink']);
    expect(themeName('ink')).toBe('Ink & Paper');
  });

  it('cycles through all three themes', () => {
    expect(nextTheme('afterhours')).toBe('gameshow');
    expect(nextTheme('gameshow')).toBe('ink');
    expect(nextTheme('ink')).toBe('afterhours');
  });
});
