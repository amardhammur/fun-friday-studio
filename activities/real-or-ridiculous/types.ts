import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';
const text = z.string().trim().min(1);
const common = { id: text, title: text, pitch: text, clue: text, explanation: text };
export const cardSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('real'), summary: text, status: z.enum(['Product', 'Prototype', 'Patented design', 'Announced concept']), source: z.object({ label: text, url: z.string().url().refine(url => url.startsWith('https://'), 'Evidence links must use HTTPS.') }) }),
  z.object({ ...common, kind: z.literal('fiction'), wonder: text }),
]);
export const roundSchema = z.object({ id: text, cards: z.tuple([cardSchema, cardSchema, cardSchema]), clueIndex: z.number().int().min(0).max(2) }).superRefine((round, ctx) => {
  if (round.cards.filter(c => c.kind === 'fiction').length !== 1) ctx.addIssue({ code: 'custom', message: 'Each round needs two real inventions and one fictional pitch.' });
});
export const settingsSchema = z.object({ rounds: z.number().int().min(5).max(8), seconds: z.number().int().min(40).max(90) });
export const stateSchema = z.object({
  deck: z.array(roundSchema), index: z.number().int().nonnegative(),
  step: z.enum(['rules', 'pitch', 'vote', 'clue', 'finalVote', 'reveal']),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().finite().optional(), pausedRemainingMs: z.number().finite().nonnegative().optional() }),
  clockHeld: z.literal(true).optional(),
}).superRefine((g, ctx) => {
  if (g.deck.length ? g.index >= g.deck.length : g.index !== 0 || g.step !== 'rules') ctx.addIssue({ code: 'custom', message: 'Invalid round position.' });
  const ids = g.deck.flatMap(r => r.cards.map(c => c.id));
  if (new Set(ids).size !== ids.length || new Set(g.deck.map(r => r.id)).size !== g.deck.length) ctx.addIssue({ code: 'custom', message: 'A session must not repeat inventions or rounds.' });
  if (g.timer.deadlineAt !== undefined && g.timer.pausedRemainingMs !== undefined) ctx.addIssue({ code: 'custom', message: 'The clock cannot be running and paused together.' });
  if (!['pitch', 'clue'].includes(g.step) && (g.timer.deadlineAt !== undefined || g.clockHeld)) ctx.addIssue({ code: 'custom', message: 'Only discussion phases may run a clock.' });
});
export type Card = z.infer<typeof cardSchema>;
export type Round = z.infer<typeof roundSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Game = z.infer<typeof stateSchema>;
export type Segment = ActivitySegment<Settings, Game>;
export type Context = ActivityContext<Settings, Game>;
export const initialState = (): Game => ({ deck: [], index: 0, step: 'rules', timer: { durationMs: 60000 } });
