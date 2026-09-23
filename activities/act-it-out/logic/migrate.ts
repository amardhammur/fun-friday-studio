import { builtInCategory, categories } from '../prompts';
import type { Category, GameState, Settings } from '../types';
// Version 1 stored the bundled categories by name and the host's extras as one flat list. Version 2
// keeps every category as an editable copy, so rebuild v1 settings in that shape. The game state did
// not change: a v1 deck is already a list of { text, category } cards.
export function migrate(saved: unknown, fromVersion: number): { settings: Settings; game: GameState } {
  if (fromVersion !== 1) throw new Error('This session version is not supported.');
  const { settings, game } = saved as { settings: { categories?: unknown; customPrompts?: unknown; turnSeconds: number; roundsPerTeam: number }; game: GameState };
  const chosen = Array.isArray(settings.categories) ? settings.categories.filter((c): c is string => typeof c === 'string') : [];
  const custom = Array.isArray(settings.customPrompts) ? settings.customPrompts.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [];
  const upgraded: Category[] = categories.map(name => builtInCategory(name, chosen.includes(name)));
  if (custom.length) upgraded.unshift({ id: 'custom:your-own', name: 'Your own', on: true, prompts: custom });
  return { settings: { rule: 'act', categories: upgraded, turnSeconds: settings.turnSeconds, roundsPerTeam: settings.roundsPerTeam }, game };
}
