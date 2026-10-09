import type { ActivityEvent, EventUpdate } from '../../../src/core/types';
import { eventDraft } from '../../../src/core/event';
import { setRoundAward, teamScore } from '../../../src/core/scoring';
import { pauseTimer, startTimer } from '../../../src/core/play/timer';
import { products } from '../content';
import { initialState, settingsSchema, type Context, type Game, type Segment } from './types';

export const validTeams = (e: Pick<ActivityEvent, 'teams'>) => e.teams.length >= 3 && e.teams.length <= 8 && e.teams.every(t => t.name.trim());
const validScore = (score: unknown): score is number => typeof score === 'number' && Number.isSafeInteger(score) && score >= 0;
export const completeScores = (g: Game) => g.teamIds.length > 0 && g.teamIds.every(id => validScore(g.scores[id]));
export const timed = (g: Game) => ['prepare', 'perform'].includes(g.step);

export function startNewGame(s: Segment, e?: EventUpdate) {
  s.settings = settingsSchema.parse(s.settings);
  if (!e || !validTeams(e)) throw new Error('Use 3–8 named event teams.');
  s.game = { ...initialState(), teamIds: e.teams.map(t => t.id), scores: Object.fromEntries(e.teams.map(t => [t.id, null])), timer: { durationMs: s.settings.preparationMinutes * 60_000 } };
  e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== s.segmentId);
  s.phase = 'play';
}
export function start(ctx: Context) {
  const e = eventDraft(ctx.event);
  ctx.update(s => startNewGame(s, e));
  ctx.updateEvent(d => { d.scoreEntries = e.scoreEntries; });
}
function begin(s: Segment, step: Game['step'], milliseconds: number, now: number) {
  s.game.step = step; s.game.timer = startTimer({ durationMs: milliseconds }, now); delete s.game.clockHeld;
}
export function spinProduct(s: Segment, random = Math.random, now = Date.now(), duration = 4000) {
  if (s.phase !== 'play' || !s.game.teamIds.length || !(s.game.step === 'product' || s.game.step === 'wheel' && !s.game.spin)) return;
  const choices = s.game.step === 'product' ? products.filter(p => p.id !== s.game.product?.id) : products;
  const index = products.indexOf(choices[Math.floor(random() * choices.length)]);
  // Save each host-requested draw before animating; ignore extra input mid-spin.
  s.game.step = 'wheel';
  s.game.product = structuredClone(products[index]);
  s.game.spin = { startedAt: now, endsAt: now + duration, rotation: 1800 + (360 - index * 360 / products.length) % 360 };
}
export function spin(ctx: Context) {
  const duration = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 4000;
  ctx.update(s => spinProduct(s, Math.random, Date.now(), duration));
}
export function finishSpin(s: Segment, now = Date.now()) {
  if (s.phase === 'play' && s.game.step === 'wheel' && s.game.spin && now >= s.game.spin.endsAt) s.game.step = 'product';
}
export function advance(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !s.game.teamIds.length) return;
  const g = s.game;
  if (g.step === 'product' && g.product) begin(s, 'prepare', s.settings.preparationMinutes * 60_000, now);
  else if (g.step === 'prepare') begin(s, 'perform', s.settings.performanceSeconds * 1000, now);
  else if (g.step === 'perform') {
    g.performedCount = g.performanceIndex + 1;
    if (g.performedCount < g.teamIds.length) { g.performanceIndex++; begin(s, 'perform', s.settings.performanceSeconds * 1000, now); }
    else { g.step = 'judging'; g.timer = pauseTimer(g.timer, now); delete g.clockHeld; }
  }
}
export function next(ctx: Context) {
  if (ctx.segment.game.step === 'judging') finishJudging(ctx);
  else ctx.update(s => advance(s));
}
export function setJudgeScore(s: Segment, teamId: string, score: number | null) {
  if (s.phase !== 'play' || s.game.step !== 'judging' || !s.game.teamIds.includes(teamId) || score !== null && !validScore(score)) return;
  s.game.scores[teamId] = score;
}
export function finishJudging(ctx: Context) {
  const s = ctx.segment, g = s.game;
  if (s.phase !== 'play' || g.step !== 'judging' || !completeScores(g)) return;
  ctx.updateEvent(e => {
    // Replace any awards from a migrated voting game, retaining host adjustments.
    e.scoreEntries = e.scoreEntries.filter(entry => !(entry.segmentId === s.segmentId && entry.roundId?.startsWith('ballot:')));
    for (const teamId of g.teamIds) e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, `judge:${teamId}`, teamId, true, g.scores[teamId]!);
  });
  ctx.update(d => { d.game.step = 'results'; d.phase = 'finale'; });
}
export function editScores(ctx: Context) {
  if (ctx.segment.phase !== 'finale' || ctx.segment.game.step !== 'results') return;
  const entries = ctx.event.scoreEntries.filter(e => e.segmentId === ctx.segment.segmentId && e.kind === 'round-award');
  ctx.update(s => {
    s.phase = 'play'; s.game.step = 'judging';
    s.game.scores = Object.fromEntries(s.game.teamIds.map(id => [id, teamScore(entries, id)]));
  });
}
export function holdClock(s: Segment, now = Date.now()) {
  if (timed(s.game) && s.game.timer.deadlineAt !== undefined) { s.game.timer = pauseTimer(s.game.timer, now); s.game.clockHeld = true; }
}
export function releaseClock(s: Segment, now = Date.now()) {
  if (s.game.clockHeld) { s.game.timer = startTimer(s.game.timer, now); delete s.game.clockHeld; }
}
export function toggleClock(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !timed(s.game)) return;
  s.game.timer = s.game.timer.deadlineAt === undefined ? startTimer(s.game.timer, now) : pauseTimer(s.game.timer, now);
}
export const hasProgress = (g: Game) => g.teamIds.length > 0;
export const progressLabel = (g: Game) => g.step === 'wheel' ? g.spin ? 'The product wheel is spinning.' : 'Ready to spin the product wheel.' : g.step === 'product' ? `Your product: ${g.product?.name}.` : `${g.performedCount} of ${g.teamIds.length} ads performed.`;
export function validateSession(s: Segment, e: ActivityEvent) {
  if (s.phase === 'setup' && !hasProgress(s.game)) return [];
  if (!validTeams(e) || s.game.teamIds.length !== e.teams.length || s.game.teamIds.some(id => !e.teams.some(t => t.id === id))) return ['Every event team must have one performance.'];
  if (s.settings.mode !== s.game.mode) return ['The saved game and settings do not match.'];
  if (s.game.step !== 'wheel' && !s.game.product || Object.keys(s.game.scores).length !== s.game.teamIds.length || s.game.teamIds.some(id => !(id in s.game.scores))) return ['Every team needs a score field and a product after the draw.'];
  if (s.phase === 'finale' && s.game.step !== 'results') return ['Save the judge scores before finishing.'];
  return [];
}
