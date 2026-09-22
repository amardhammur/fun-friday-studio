import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';
export const settingsSchema = z.object({
  categories: z.array(z.string()).min(1),
  customPrompts: z.array(z.string()),
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
export type GameState = z.infer<typeof stateSchema>;
export type AIOSegment = ActivitySegment<Settings, GameState>;
export type Context = ActivityContext<Settings, GameState>;
export const initialState = (): GameState => ({ deck: [], cursor: 0, turns: [], currentTurnIndex: 0, timer: { durationMs: 90_000 } });
