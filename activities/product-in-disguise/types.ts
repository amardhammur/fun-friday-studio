import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';

const text = z.string().trim().min(1);
export const productSchema = z.object({
  id: text, name: text, acceptedAnswers: z.array(text).min(1),
  clues: z.tuple([text, text]), tagline: text,
  illustration: z.enum(['stapler', 'umbrella', 'notes', 'lunchbox', 'band', 'torch', 'tape', 'comb', 'key', 'bottle', 'peg', 'whisk']),
});
export const resultSchema = z.enum(['correct', 'missed']).nullable();
export const roundSchema = z.object({
  id: text, teamId: text, product: productSchema,
  cluesConfirmed: z.boolean(), guessesLocked: z.boolean(), revealed: z.boolean(),
  results: z.record(text, resultSchema),
}).superRefine((r, ctx) => {
  if (r.teamId in r.results) ctx.addIssue({ code: 'custom', message: 'The presenting team cannot guess or score.' });
  if (r.guessesLocked && !r.cluesConfirmed) ctx.addIssue({ code: 'custom', message: 'Both clues must be included before guesses are locked.' });
  if (r.revealed && !r.guessesLocked) ctx.addIssue({ code: 'custom', message: 'Collect all guesses before revealing.' });
  if (!r.revealed && Object.values(r.results).some(result => result !== null)) ctx.addIssue({ code: 'custom', message: 'Results cannot be recorded before the reveal.' });
});
export const settingsSchema = z.object({
  preparationMinutes: z.number().int().min(5).max(15),
  performanceSeconds: z.number().int().min(60).max(90),
  guessSeconds: z.number().int().min(30).max(90),
  briefsShared: z.boolean(),
});
export const stateSchema = z.object({
  rounds: z.array(roundSchema), index: z.number().int().nonnegative(),
  step: z.enum(['rules', 'prepare', 'perform', 'guess', 'reveal']),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().finite().optional(), pausedRemainingMs: z.number().finite().nonnegative().optional() }),
  clockHeld: z.literal(true).optional(),
}).superRefine((g, ctx) => {
  if (g.rounds.length ? g.index >= g.rounds.length : g.index !== 0 || g.step !== 'rules') ctx.addIssue({ code: 'custom', message: 'Invalid commercial position.' });
  for (const key of ['id', 'teamId'] as const) if (new Set(g.rounds.map(r => r[key])).size !== g.rounds.length) ctx.addIssue({ code: 'custom', message: 'Each team must present exactly once.' });
  if (new Set(g.rounds.map(r => r.product.id)).size !== g.rounds.length) ctx.addIssue({ code: 'custom', message: 'Products must not repeat.' });
  if (g.step === 'reveal' && !g.rounds[g.index]?.revealed) ctx.addIssue({ code: 'custom', message: 'The reveal phase needs a revealed product.' });
  if (['perform', 'guess'].includes(g.step) && g.rounds[g.index]?.revealed) ctx.addIssue({ code: 'custom', message: 'A revealed commercial cannot be performed again.' });
  if (g.timer.deadlineAt !== undefined && g.timer.pausedRemainingMs !== undefined) ctx.addIssue({ code: 'custom', message: 'A timer cannot be running and paused together.' });
  if (!['prepare', 'perform', 'guess'].includes(g.step) && (g.timer.deadlineAt !== undefined || g.clockHeld)) ctx.addIssue({ code: 'custom', message: 'Only preparation, commercials, and guessing can run a timer.' });
  if (g.clockHeld && g.timer.pausedRemainingMs === undefined) ctx.addIssue({ code: 'custom', message: 'A held timer must retain its remaining time.' });
  if (g.step === 'guess' && g.rounds[g.index]?.guessesLocked && (g.timer.deadlineAt !== undefined || g.clockHeld)) ctx.addIssue({ code: 'custom', message: 'The timer must stop when guesses are locked.' });
});
export type Product = z.infer<typeof productSchema>;
export type Round = z.infer<typeof roundSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Game = z.infer<typeof stateSchema>;
export type Segment = ActivitySegment<Settings, Game>;
export type Context = ActivityContext<Settings, Game>;
export const initialState = (): Game => ({ rounds: [], index: 0, step: 'rules', timer: { durationMs: 60000 } });
