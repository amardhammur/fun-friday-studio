import { z } from 'zod';
import { pauseTimer } from '../../../src/core/play/timer';
import { initialState, settingsSchema as currentSettings, stateSchema as currentState } from './types';
import { productSchema } from '../types';

const id = z.string().trim().min(1);
const awards = [
  { id: 'funniest', label: 'Funniest ad' },
  { id: 'creative', label: 'Most creative idea' },
  { id: 'pitch', label: 'Best sales pitch' },
] as const;
const ballotSchema = z.object({ funniest: id.nullable(), creative: id.nullable(), pitch: id.nullable() });
const settingsSchema = z.object({
  mode: z.literal('commercial-clash'),
  preparationMinutes: z.number().int().min(5).max(15),
  performanceSeconds: z.number().int().min(120).max(240),
  votingSeconds: z.number().int().min(60).max(300),
});
const stateSchema = z.object({
  mode: z.literal('commercial-clash'), product: productSchema.optional(),
  teamIds: z.array(id).max(8), performanceIndex: z.number().int().nonnegative(), performedCount: z.number().int().nonnegative(),
  step: z.enum(['wheel', 'product', 'prepare', 'perform', 'vote', 'ballots', 'reveal']),
  spin: z.object({ startedAt: z.number().finite(), endsAt: z.number().finite(), rotation: z.number().finite().positive() }).refine(s => s.endsAt > s.startedAt, 'The spin must have a positive duration.').optional(),
  ballots: z.record(id, ballotSchema), ballotIndex: z.number().int().nonnegative(),
  awardIndex: z.number().int().min(0).max(2), revealedCount: z.number().int().min(0).max(3),
  timer: z.object({ durationMs: z.number().int().positive(), deadlineAt: z.number().finite().optional(), pausedRemainingMs: z.number().finite().nonnegative().optional() }),
  clockHeld: z.literal(true).optional(),
}).superRefine((g, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const count = g.teamIds.length;
  if (new Set(g.teamIds).size !== count) issue('Each team performs once.');
  if (count === 0) {
    if (g.product || g.spin || g.step !== 'wheel' || g.performedCount || g.performanceIndex || g.ballotIndex || g.awardIndex || g.revealedCount || Object.keys(g.ballots).length || g.timer.deadlineAt !== undefined || g.clockHeld) issue('Invalid unstarted game.');
  } else {
    if (count < 3 || g.step !== 'wheel' && !g.product) issue('Use 3–8 teams and one shared product.');
    if (g.performanceIndex >= count || g.ballotIndex >= count || g.performedCount > count) issue('Invalid performance or ballot position.');
    if (Object.keys(g.ballots).length !== count || g.teamIds.some(t => !(t in g.ballots))) issue('Every team needs one ballot.');
    if (['wheel', 'product', 'prepare'].includes(g.step) && (g.performedCount || g.performanceIndex)) issue('The product draw and preparation precede performances.');
    if (g.step === 'perform' && g.performedCount !== g.performanceIndex) issue('Performances must follow the running order.');
    if (['vote', 'ballots', 'reveal'].includes(g.step) && (g.performedCount !== count || g.performanceIndex !== count - 1)) issue('Every team performs before voting.');
  }
  if (g.spin && !g.product || g.step === 'wheel' && !!g.product !== !!g.spin) issue('A spinning wheel needs its saved product.');
  if (g.step === 'product' && !g.spin) issue('Reveal the product after a completed spin.');
  for (const [voter, ballot] of Object.entries(g.ballots)) for (const recipient of Object.values(ballot)) {
    if (recipient === voter) issue('Teams cannot vote for themselves.');
    if (recipient !== null && !g.teamIds.includes(recipient)) issue('A vote names an unknown team.');
    if (recipient !== null && ['wheel', 'product', 'prepare', 'perform', 'vote'].includes(g.step)) issue('Start vote entry before recording choices.');
  }
  if (g.step === 'reveal') {
    if (!count || Object.values(g.ballots).some(b => Object.values(b).some(v => v === null))) issue('Complete all ballots before the awards.');
    if (g.revealedCount < g.awardIndex || g.revealedCount > g.awardIndex + 1) issue('Reveal awards in order.');
  } else if (g.awardIndex || g.revealedCount) issue('Awards cannot be revealed before votes are locked.');
  if (g.timer.deadlineAt !== undefined && g.timer.pausedRemainingMs !== undefined) issue('A timer cannot run and pause together.');
  if (!['prepare', 'perform', 'vote'].includes(g.step) && (g.timer.deadlineAt !== undefined || g.clockHeld)) issue('The ballot and reveal timers must be stopped.');
  if (g.clockHeld && g.timer.pausedRemainingMs === undefined) issue('A held timer needs its remaining time.');
});

// Validate the old voting format before converting it. Historical score entries
// remain in the event ledger; score drafts are filled from that ledger on Edit.
export function migrateVotingGame(saved: { settings: unknown; game: unknown; status?: string; phase?: string }, version: number) {
  const settings = currentSettings.parse(settingsSchema.parse(saved.settings));
  if (version === 2 && (saved.game as { teamIds?: unknown[] }).teamIds?.length === 0) return { settings, game: initialState() };
  const game = stateSchema.parse(saved.game);
  const afterPerformances = ['vote', 'ballots', 'reveal'].includes(game.step);
  const completed = game.step === 'reveal' && game.revealedCount === awards.length;
  return { settings, game: currentState.parse({
    ...game,
    step: afterPerformances ? completed ? 'results' : 'judging' : game.step,
    scores: Object.fromEntries(game.teamIds.map(id => [id, null])),
    timer: afterPerformances ? pauseTimer(game.timer, Date.now()) : game.timer,
    clockHeld: afterPerformances ? undefined : game.clockHeld,
  }) };
}
