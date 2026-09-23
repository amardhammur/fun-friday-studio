import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';
// A category is the host's own copy: built-in ones start as the bundled list and can then be edited
// freely. `builtIn` names the bundled list it came from, so it can be reset. Prompts are kept exactly
// as typed, blank lines included, so the editor does not fight the host mid-edit; eligiblePrompts()
// is where they get trimmed.
export const categorySchema = z.object({ id: z.string().min(1), name: z.string(), on: z.boolean(), builtIn: z.string().optional(), prompts: z.array(z.string()) });
export const settingsSchema = z.object({
  // 'act' is classic charades. 'describe' lets the team talk, as long as nobody says the words on the card.
  rule: z.enum(['act', 'describe']),
  categories: z.array(categorySchema),
  turnSeconds: z.number().int().min(15).max(300),
  roundsPerTeam: z.number().int().min(1).max(5),
});
export const stateSchema = z.object({
  deck: z.array(z.object({ text: z.string().min(1), category: z.string().min(1) })),
  cursor: z.number().int().min(0),
  turns: z.array(z.object({
    id: z.string(), teamId: z.string(), guesserName: z.string().optional(),
    results: z.array(z.object({ text: z.string(), outcome: z.enum(['guessed', 'skipped']) })),
    status: z.enum(['pending', 'acting', 'done']),
  })),
  currentTurnIndex: z.number().int().min(0),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().optional(), pausedRemainingMs: z.number().optional() }),
}).superRefine((s, ctx) => {
  // One deck, one cursor, many turns. If the cursor drifts from the cards actually played a card is
  // silently skipped or dealt twice, and nothing on the projector would show it. Catch it at the
  // schema boundary instead, which is where the registry and ZIP import both check.
  const played = s.turns.reduce((n, t) => n + t.results.length, 0);
  if (played !== s.cursor) ctx.addIssue({ code: 'custom', message: 'The prompt deck position does not match the cards played.' });
  if (s.cursor > s.deck.length) ctx.addIssue({ code: 'custom', message: 'The prompt deck position is past the end of the deck.' });
  if (s.turns.length && s.currentTurnIndex >= s.turns.length) ctx.addIssue({ code: 'custom', message: 'Invalid current turn.' });
  if (new Set(s.turns.map(t => t.id)).size !== s.turns.length) ctx.addIssue({ code: 'custom', message: 'The game contains duplicate turns.' });
});
export type Settings = z.infer<typeof settingsSchema>;
export type Category = z.infer<typeof categorySchema>;
export type GameState = z.infer<typeof stateSchema>;
export type AIOSegment = ActivitySegment<Settings, GameState>;
export type Context = ActivityContext<Settings, GameState>;
export const initialState = (): GameState => ({ deck: [], cursor: 0, turns: [], currentTurnIndex: 0, timer: { durationMs: 90_000 } });
