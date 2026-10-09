import { z } from 'zod';
import type { ActivityContext, ActivitySegment } from '../../src/core/types';

export const settingsSchema = z.object({ questionText: z.string().max(60_000) });
export const stateSchema = z.object({
  questions: z.array(z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(300) })).max(100),
  turns: z.array(z.object({
    id: z.string().min(1), teamId: z.string().min(1), round: z.union([z.literal(1), z.literal(2)]),
    draw: z.object({ questionId: z.string().min(1), startedAt: z.number().int().nonnegative() }).optional(),
    points: z.number().int().nonnegative().optional(),
    pointsDraft: z.string().max(100).optional(),
  })).max(16),
  currentTurnIndex: z.number().int().nonnegative(),
  // Retain an already-played second round in older sessions; new games always have one round.
  legacyTwoRounds: z.literal(true).optional(),
}).superRefine((game, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (!game.legacyTwoRounds && game.turns.some(t => t.round !== 1)) issue('This activity has only one round.');
  if (!game.legacyTwoRounds && game.turns.length > 8) issue('Every team has only one turn.');
  if (game.currentTurnIndex >= Math.max(1, game.turns.length)) issue('Invalid current team turn.');
  if (!game.turns.length && game.questions.length) issue('Questions must belong to a started activity.');
  if (new Set(game.questions.map(q => q.id)).size !== game.questions.length || new Set(game.turns.map(t => t.id)).size !== game.turns.length) issue('Questions and turns need unique identifiers.');
  const drawn = game.turns.flatMap(t => t.draw ? [t.draw.questionId] : []);
  if (new Set(drawn).size !== drawn.length) issue('A question cannot be repeated.');
  const frontier = game.turns.findIndex(t => t.points === undefined);
  if (game.turns.length && game.currentTurnIndex !== (frontier === -1 ? game.turns.length - 1 : frontier)) issue('Every team must finish its turn in order.');
  for (const [index, turn] of game.turns.entries()) {
    if (turn.draw && !game.questions.some(q => q.id === turn.draw!.questionId)) issue('A turn references a missing question.');
    if ((turn.points !== undefined || turn.pointsDraft !== undefined) && !turn.draw) issue('Spin before entering points.');
    if (frontier !== -1 && index > frontier && (turn.draw || turn.points !== undefined || turn.pointsDraft !== undefined)) issue('Future turns cannot have progress.');
  }
});

export type Settings = z.infer<typeof settingsSchema>;
export type GameState = z.infer<typeof stateSchema>;
export type Turn = GameState['turns'][number];
export type AwardsSegment = ActivitySegment<Settings, GameState>;
export type Context = ActivityContext<Settings, GameState>;
export const initialState = (): GameState => ({ questions: [], turns: [], currentTurnIndex: 0 });
