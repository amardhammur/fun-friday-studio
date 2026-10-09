import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../../src/core/types';
import { productSchema } from '../types';

const id = z.string().trim().min(1);
export const settingsSchema = z.object({
  mode: z.literal('commercial-clash'),
  preparationMinutes: z.number().int().min(5).max(15),
  performanceSeconds: z.number().int().min(120).max(240),
});
export const stateSchema = z.object({
  mode: z.literal('commercial-clash'), product: productSchema.optional(),
  teamIds: z.array(id).max(8), performanceIndex: z.number().int().nonnegative(), performedCount: z.number().int().nonnegative(),
  step: z.enum(['wheel', 'product', 'prepare', 'perform', 'judging', 'results']),
  spin: z.object({ startedAt: z.number().finite(), endsAt: z.number().finite(), rotation: z.number().finite().positive() }).refine(s => s.endsAt > s.startedAt, 'The spin must have a positive duration.').optional(),
  scores: z.record(id, z.number().int().nonnegative().nullable()),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().finite().optional(), pausedRemainingMs: z.number().finite().nonnegative().optional() }),
  clockHeld: z.literal(true).optional(),
}).superRefine((g, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const count = g.teamIds.length;
  if (new Set(g.teamIds).size !== count) issue('Each team performs once.');
  if (Object.keys(g.scores).length !== count || g.teamIds.some(t => !(t in g.scores))) issue('Every team needs one judge score.');
  if (count === 0) {
    if (g.product || g.spin || g.step !== 'wheel' || g.performedCount || g.performanceIndex || g.timer.deadlineAt !== undefined || g.clockHeld) issue('Invalid unstarted game.');
  } else {
    if (count < 3 || g.step !== 'wheel' && !g.product) issue('Use 3–8 teams and one shared product.');
    if (g.performanceIndex >= count || g.performedCount > count) issue('Invalid performance position.');
    if (['wheel', 'product', 'prepare'].includes(g.step) && (g.performedCount || g.performanceIndex)) issue('The product draw and preparation precede performances.');
    if (g.step === 'perform' && g.performedCount !== g.performanceIndex) issue('Performances must follow the running order.');
    if (['judging', 'results'].includes(g.step) && (g.performedCount !== count || g.performanceIndex !== count - 1)) issue('Every team performs before judging.');
  }
  if (g.spin && !g.product || g.step === 'wheel' && !!g.product !== !!g.spin) issue('A spinning wheel needs its saved product.');
  if (g.step === 'product' && !g.spin) issue('Reveal the product after a completed spin.');
  if (!['judging', 'results'].includes(g.step) && Object.values(g.scores).some(score => score !== null)) issue('Finish performances before entering scores.');
  if (g.timer.deadlineAt !== undefined && g.timer.pausedRemainingMs !== undefined) issue('A timer cannot run and pause together.');
  if (!['prepare', 'perform'].includes(g.step) && (g.timer.deadlineAt !== undefined || g.clockHeld)) issue('Only preparation and performances can run a timer.');
  if (g.clockHeld && g.timer.pausedRemainingMs === undefined) issue('A held timer needs its remaining time.');
});
export type Settings = z.infer<typeof settingsSchema>;
export type Game = z.infer<typeof stateSchema>;
export type Segment = ActivitySegment<Settings, Game>;
export type Context = ActivityContext<Settings, Game>;
export const defaultSettings = (): Settings => ({ mode: 'commercial-clash', preparationMinutes: 12, performanceSeconds: 180 });
export const initialState = (): Game => ({ mode: 'commercial-clash', teamIds: [], performanceIndex: 0, performedCount: 0, step: 'wheel', scores: {}, timer: { durationMs: 720_000 } });
