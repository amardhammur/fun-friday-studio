import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';

const countSchema = z.number().int().min(0).max(10);
export const settingsSchema = z.object({
  playersPerTeam: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  turnSeconds: z.union([z.literal(45), z.literal(60)]),
  turnOrder: z.enum(['team-by-team', 'round-robin']).default('team-by-team'),
  // Participant snapshots are filled from team rosters on start. Keep old setup drafts reloadable.
  selections: z.record(z.string(), z.array(z.string()).max(3)),
});
const timerSchema = z.object({
  durationMs: z.union([z.literal(45_000), z.literal(60_000)]),
  deadlineAt: z.number().int().nonnegative().optional(),
  pausedRemainingMs: z.number().int().nonnegative().optional(),
}).superRefine((timer, ctx) => {
  if (timer.deadlineAt !== undefined && timer.pausedRemainingMs !== undefined) ctx.addIssue({ code: 'custom', message: 'A timer cannot be running and paused together.' });
  if ((timer.pausedRemainingMs ?? 0) > timer.durationMs) ctx.addIssue({ code: 'custom', message: 'A turn cannot have extra time.' });
});
export const stateSchema = z.object({
  turns: z.array(z.object({
    id: z.string().min(1), teamId: z.string().min(1), playerId: z.string().min(1),
    status: z.enum(['pending', 'playing', 'counting', 'done']),
    timer: timerSchema, count: countSchema.optional(), countDraft: countSchema.optional(),
  })).max(24),
  currentTurnIndex: z.number().int().min(0),
  clockHeld: z.literal(true).optional(),
}).superRefine((game, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (game.currentTurnIndex >= Math.max(1, game.turns.length)) issue('Invalid current turn.');
  if (new Set(game.turns.map(t => t.id)).size !== game.turns.length || new Set(game.turns.map(t => t.playerId)).size !== game.turns.length) issue('Each selected player must have exactly one turn.');
  const frontier = game.turns.findIndex(t => t.status !== 'done');
  if (frontier !== -1 && game.turns.slice(frontier + 1).some(t => t.status !== 'pending')) issue('Turns must be played in order.');
  if (frontier !== -1 && game.currentTurnIndex > frontier) issue('An unplayed turn cannot be skipped.');
  for (const turn of game.turns) {
    if ((turn.status === 'done') !== (turn.count !== undefined)) issue('Only confirmed turns can have a count.');
    if (turn.status !== 'playing' && turn.timer.deadlineAt !== undefined) issue('Only a playing turn can run a timer.');
    if (turn.status === 'pending' && (turn.countDraft !== undefined || turn.timer.pausedRemainingMs !== undefined)) issue('A pending turn cannot have progress.');
    if (turn.status === 'playing' && (turn.countDraft !== undefined || (turn.timer.deadlineAt === undefined && !turn.timer.pausedRemainingMs))) issue('A playing turn must have a running or paused timer.');
  }
  if (game.clockHeld && !game.turns.some(t => t.status === 'playing' && t.timer.deadlineAt === undefined && (t.timer.pausedRemainingMs ?? 0) > 0)) issue('A held clock must belong to a paused player turn.');
});
export type Settings = z.infer<typeof settingsSchema>;
export type GameState = z.infer<typeof stateSchema>;
export type Turn = GameState['turns'][number];
export type BottleSegment = ActivitySegment<Settings, GameState>;
export type Context = ActivityContext<Settings, GameState>;
export const initialState = (): GameState => ({ turns: [], currentTurnIndex: 0 });
