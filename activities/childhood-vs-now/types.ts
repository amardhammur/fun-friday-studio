import { z } from 'zod';
import type { ActivityContext, ActivityEvent, ActivitySegment, EventUpdate } from '../../src/core/types';
export const settingsSchema = z.object({ shuffle: z.boolean(), matchingTolerance: z.number().min(.01).max(.4) });
export const stateSchema = z.object({
  rounds: z.array(z.object({ id: z.string(), personId: z.string(), teamId: z.string(), revealed: z.boolean(), result: z.enum(['correct', 'missed']).nullable() })),
  currentRoundIndex: z.number().int().min(0),
  finale: z.object({ wipePosition: z.number().min(0).max(100), slideIndex: z.number().int().min(0).default(0), spotlightPersonId: z.string().optional() }),
}).superRefine((s, ctx) => {
  if (new Set(s.rounds.map(r => r.personId)).size !== s.rounds.length) ctx.addIssue({ code: 'custom', message: 'Photos must not repeat between teams.' });
  if (s.rounds.length && s.currentRoundIndex >= s.rounds.length) ctx.addIssue({ code: 'custom', message: 'Invalid current round.' });
});
export type Settings = z.infer<typeof settingsSchema>;
export type GameState = z.infer<typeof stateSchema>;
export type CVSession = ActivitySegment<Settings, GameState>;
export type CVEvent = ActivityEvent;
export type CVEventUpdate = EventUpdate;
export type Context = ActivityContext<Settings, GameState>;
export const initialState = (): GameState => ({ rounds: [], currentRoundIndex: 0, finale: { wipePosition: 0, slideIndex: 0 } });
