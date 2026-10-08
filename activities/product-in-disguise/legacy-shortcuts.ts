import type { Activity } from '../../src/core/types';
import { confirmClues, lockGuesses, markRemainingMissed, scoreTeam } from './logic';
import type { Settings, Game, Context } from './types';

// Only the keys absent from the version-two host rail. N/R/T stay app-owned so
// a running legacy game never advances twice for one key press.
export const legacyExtraShortcuts: Pick<Activity<Settings, Game>, 'shortcuts'> = { shortcuts: [
  { key: 'c', label: 'Clues', run: ctx => ctx.update(s => confirmClues(s)) },
  { key: 'l', label: 'Lock', run: ctx => ctx.update(s => lockGuesses(s)) },
  { key: 'm', label: 'Missed', run: markRemainingMissed },
  ...Array.from({ length: 8 }, (_, i) => ({ key: String(i + 1), label: 'Award 1–8', run: (ctx: Context) => scoreTeam(ctx, i) })),
] };
