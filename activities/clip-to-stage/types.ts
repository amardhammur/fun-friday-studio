import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';

const id = z.string().min(1);
export const settingsSchema = z.object({
  clipTitle: z.string().max(120), source: z.enum(['youtube', 'local']),
  youtubeUrl: z.string().max(2048), videoAssetId: id.optional(),
  performance: z.enum(['sing', 'dance', 'both']),
  practiceMinutes: z.number().int().min(1).max(30), performanceSeconds: z.number().int().min(30).max(600),
});
export const stateSchema = z.object({
  teamIds: z.array(id).max(8), step: z.enum(['watch', 'practise', 'perform', 'judging', 'results']),
  performanceIndex: z.number().int().nonnegative(), performedCount: z.number().int().nonnegative(),
  scores: z.record(id, z.number().int().nonnegative().nullable()),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().finite().optional(), pausedRemainingMs: z.number().finite().nonnegative().optional() }),
  clockHeld: z.literal(true).optional(),
}).superRefine((g, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const count = g.teamIds.length;
  if (new Set(g.teamIds).size !== count) issue('Each team must perform once.');
  if (Object.keys(g.scores).length !== count || g.teamIds.some(id => !(id in g.scores))) issue('Each team needs a score field.');
  if (!count && (g.step !== 'watch' || g.performanceIndex || g.performedCount)) issue('Invalid unstarted activity.');
  if (count && (count < 2 || g.performanceIndex >= count || g.performedCount > count)) issue('Invalid team performance order.');
  if (['watch', 'practise'].includes(g.step) && (g.performanceIndex || g.performedCount)) issue('Watch and practise before performing.');
  if (g.step === 'perform' && g.performedCount !== g.performanceIndex) issue('Performances must follow the team order.');
  if (['judging', 'results'].includes(g.step) && (!count || g.performedCount !== count || g.performanceIndex !== count - 1)) issue('All teams must perform before judging.');
  if (!['judging', 'results'].includes(g.step) && Object.values(g.scores).some(score => score !== null)) issue('Finish performances before entering scores.');
  if (g.step === 'results' && Object.values(g.scores).some(score => score === null)) issue('Save every judge score before showing results.');
  if (g.timer.deadlineAt !== undefined && g.timer.pausedRemainingMs !== undefined) issue('A timer cannot run and pause together.');
  if (!['practise', 'perform'].includes(g.step) && (g.timer.deadlineAt !== undefined || g.clockHeld)) issue('Only practice and performances have a timer.');
  if (g.clockHeld && g.timer.pausedRemainingMs === undefined) issue('A paused timer needs its remaining time.');
});
export type Settings = z.infer<typeof settingsSchema>;
export type Game = z.infer<typeof stateSchema>;
export type Segment = ActivitySegment<Settings, Game>;
export type Context = ActivityContext<Settings, Game>;
export const defaultSettings = (): Settings => ({ clipTitle: '', source: 'youtube', youtubeUrl: '', performance: 'both', practiceMinutes: 10, performanceSeconds: 180 });
export const initialState = (): Game => ({ teamIds: [], step: 'watch', performanceIndex: 0, performedCount: 0, scores: {}, timer: { durationMs: 600000 } });
