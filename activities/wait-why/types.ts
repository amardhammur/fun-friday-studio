import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';
export const puzzleSchema = z.object({ id: z.string().min(1), category: z.string().min(1), question: z.string().min(1), options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]), answer: z.number().int().min(0).max(2), explanation: z.string().min(1), wonder: z.string().min(1) });
export const settingsSchema = z.object({ rounds: z.number().int().min(8).max(12), seconds: z.number().int().min(45).max(90) });
export const stateSchema = z.object({ deck: z.array(puzzleSchema), index: z.number().int().nonnegative(), step: z.enum(['rules', 'question', 'answer']), timer: z.object({ durationMs: z.number().positive(), deadlineAt: z.number().optional(), pausedRemainingMs: z.number().nonnegative().optional() }), clockHeld: z.boolean().optional() }).superRefine((g, ctx) => {
  if ((g.deck.length && g.index >= g.deck.length) || (!g.deck.length && (g.index !== 0 || g.step !== 'rules'))) ctx.addIssue({ code: 'custom', message: 'Invalid puzzle position.' });
  if (new Set(g.deck.map(p => p.id)).size !== g.deck.length) ctx.addIssue({ code: 'custom', message: 'Duplicate puzzles.' });
});
export type Settings = z.infer<typeof settingsSchema>;
export type Game = z.infer<typeof stateSchema>;
export type Context = ActivityContext<Settings, Game>;
export type Segment = ActivitySegment<Settings, Game>;
export const initialState = (): Game => ({ deck: [], index: 0, step: 'rules', timer: { durationMs: 60000 } });
