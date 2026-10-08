import type { ActivityEvent, EventUpdate } from '../../../src/core/types';
import { eventDraft } from '../../../src/core/event';
import { setRoundAward } from '../../../src/core/scoring';
import { pauseTimer, startTimer } from '../../../src/core/play/timer';
import { products } from '../content';
import { awards, initialState, settingsSchema, type AwardId, type Ballot, type Context, type Game, type Segment } from './types';

export const validTeams = (e: Pick<ActivityEvent, 'teams'>) => e.teams.length >= 3 && e.teams.length <= 8 && e.teams.every(t => t.name.trim());
export const completeBallot = (ballot?: Ballot) => !!ballot && awards.every(a => ballot[a.id] !== null);
export const completeVotes = (g: Game) => g.teamIds.length > 0 && g.teamIds.every(id => completeBallot(g.ballots[id]));
export const timed = (g: Game) => ['prepare', 'perform', 'vote'].includes(g.step);

export function startNewGame(s: Segment, e?: EventUpdate) {
  s.settings = settingsSchema.parse(s.settings);
  if (!e || !validTeams(e)) throw new Error('Use 3–8 named event teams.');
  s.game = { ...initialState(), teamIds: e.teams.map(t => t.id), ballots: Object.fromEntries(e.teams.map(t => [t.id, { funniest: null, creative: null, pitch: null }])), timer: { durationMs: s.settings.preparationMinutes * 60_000 } };
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
    else begin(s, 'vote', s.settings.votingSeconds * 1000, now);
  } else if (g.step === 'vote') {
    g.step = 'ballots'; g.timer = pauseTimer(g.timer, now); delete g.clockHeld;
  } else if (g.step === 'ballots' && completeBallot(g.ballots[g.teamIds[g.ballotIndex]])) {
    if (g.ballotIndex < g.teamIds.length - 1) g.ballotIndex++;
    else if (completeVotes(g)) g.step = 'reveal';
  } else if (g.step === 'reveal' && g.revealedCount > g.awardIndex) {
    if (g.awardIndex < awards.length - 1) g.awardIndex++;
    else s.phase = 'finale';
  }
}
export function castVote(s: Segment, voterId: string, awardId: AwardId, recipientId: string | null) {
  if (s.phase !== 'play' || s.game.step !== 'ballots' || !s.game.teamIds.includes(voterId) || !awards.some(a => a.id === awardId) || recipientId === voterId || recipientId !== null && !s.game.teamIds.includes(recipientId)) return;
  s.game.ballots[voterId][awardId] = recipientId;
}
export function reveal(ctx: Context) {
  const s = ctx.segment, g = s.game;
  if (s.phase !== 'play' || g.step !== 'reveal' || !completeVotes(g) || g.revealedCount > g.awardIndex) return;
  const award = awards[g.awardIndex];
  ctx.update(d => { d.game.revealedCount = d.game.awardIndex + 1; });
  ctx.updateEvent(e => {
    for (const voter of g.teamIds) e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, `ballot:${voter}:${award.id}`, g.ballots[voter][award.id]!, true, s.points.correct);
  });
}
export function awardResults(g: Game, awardId: AwardId) {
  const counts = g.teamIds.map(teamId => ({ teamId, votes: Object.values(g.ballots).filter(b => b[awardId] === teamId).length }));
  const max = Math.max(0, ...counts.map(t => t.votes));
  return counts.filter(t => t.votes === max && max > 0);
}
export function editVotes(ctx: Context) {
  if (!['play', 'finale'].includes(ctx.segment.phase) || ctx.segment.game.step !== 'reveal') return;
  ctx.update(s => { s.phase = 'play'; s.game.step = 'ballots'; s.game.ballotIndex = 0; s.game.awardIndex = 0; s.game.revealedCount = 0; });
  // Remove only this game's vote awards; retain any host adjustments.
  ctx.updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => !(entry.segmentId === ctx.segment.segmentId && entry.roundId?.startsWith('ballot:'))); });
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
  if (s.game.step !== 'wheel' && !s.game.product || Object.keys(s.game.ballots).length !== s.game.teamIds.length || s.game.teamIds.some(id => !(id in s.game.ballots))) return ['Every team needs one ballot and a product after the draw.'];
  for (const [voter, ballot] of Object.entries(s.game.ballots)) for (const recipient of Object.values(ballot)) if (recipient !== null && (recipient === voter || !s.game.teamIds.includes(recipient))) return ['A vote names an ineligible team.'];
  if (s.phase === 'finale' && (s.game.step !== 'reveal' || s.game.revealedCount !== awards.length)) return ['Reveal every award before finishing.'];
  return [];
}
