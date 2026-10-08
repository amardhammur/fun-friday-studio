import type { ActivityEvent, EventUpdate } from '../../src/core/types';
import { eventDraft } from '../../src/core/event';
import { setRoundAward } from '../../src/core/scoring';
import { pauseTimer, startTimer } from '../../src/core/play/timer';
import { products } from './content';
import { initialState, settingsSchema, type Context, type Game, type Round, type Segment } from './types';

export const currentRound = (g: Game) => g.rounds[g.index];
export const roundComplete = (r: Round) => r.revealed && Object.keys(r.results).length > 0 && Object.values(r.results).every(result => result !== null);
export const timed = (g: Game) => ['prepare', 'perform', 'guess'].includes(g.step) && !(g.step === 'guess' && currentRound(g)?.guessesLocked);

function freshRound(teamId: string, product: Round['product'], teamIds: string[]): Round {
  return { id: `commercial-${teamId}`, teamId, product: structuredClone(product), cluesConfirmed: false, guessesLocked: false, revealed: false, results: Object.fromEntries(teamIds.filter(id => id !== teamId).map(id => [id, null])) };
}
export function briefsMatch(g: Game, e: Pick<ActivityEvent, 'teams'>) {
  const ids = e.teams.map(t => t.id);
  return g.rounds.length === ids.length && new Set(g.rounds.map(r => r.teamId)).size === ids.length && g.rounds.every(r => ids.includes(r.teamId)) && new Set(g.rounds.map(r => r.product.id)).size === ids.length;
}
export function prepareBriefs(s: Segment, e: Pick<ActivityEvent, 'teams'>) {
  if (e.teams.length < 2 || e.teams.length > 8 || e.teams.some(t => !t.name.trim())) throw new Error('Use 2–8 named event teams.');
  const ids = e.teams.map(t => t.id);
  s.game = { ...initialState(), rounds: e.teams.map((team, i) => freshRound(team.id, products[i], ids)) };
  s.settings.briefsShared = false;
}
export function chooseProduct(s: Segment, teamId: string, productId: string) {
  if (s.phase !== 'setup' || s.game.step !== 'rules') return;
  const round = s.game.rounds.find(r => r.teamId === teamId), product = products.find(p => p.id === productId);
  if (!round || !product || s.game.rounds.some(r => r.teamId !== teamId && r.product.id === productId)) return;
  round.product = structuredClone(product); s.settings.briefsShared = false;
}
export function startNewGame(s: Segment, e?: EventUpdate) {
  settingsSchema.parse(s.settings);
  if (!e || e.teams.length < 2 || e.teams.length > 8 || e.teams.some(t => !t.name.trim())) throw new Error('Use 2–8 named event teams.');
  if (!briefsMatch(s.game, e)) prepareBriefs(s, e);
  const ids = e.teams.map(t => t.id);
  s.game = { ...initialState(), rounds: s.game.rounds.map(r => freshRound(r.teamId, r.product, ids)), timer: { durationMs: s.settings.preparationMinutes * 60000 } };
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
export function advance(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !s.game.rounds.length) return;
  const g = s.game, r = currentRound(g);
  if (g.step === 'rules') begin(s, 'prepare', s.settings.preparationMinutes * 60000, now);
  else if (g.step === 'prepare') begin(s, 'perform', s.settings.performanceSeconds * 1000, now);
  else if (g.step === 'perform' && r.cluesConfirmed) begin(s, 'guess', s.settings.guessSeconds * 1000, now);
  else if (g.step === 'reveal' && roundComplete(r)) {
    if (g.index === g.rounds.length - 1) { s.phase = 'finale'; return; }
    g.index++;
    if (currentRound(g).revealed) return;
    begin(s, 'perform', s.settings.performanceSeconds * 1000, now);
  }
}
export function confirmClues(s: Segment, confirmed = true) {
  if (s.phase === 'play' && s.game.step === 'perform') currentRound(s.game).cluesConfirmed = confirmed;
}
export function lockGuesses(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || s.game.step !== 'guess') return;
  const r = currentRound(s.game);
  if (!r.cluesConfirmed || r.guessesLocked) return;
  r.guessesLocked = true; s.game.timer = pauseTimer(s.game.timer, now); delete s.game.clockHeld;
}
export function reveal(s: Segment) {
  if (s.phase !== 'play' || s.game.step !== 'guess' || !currentRound(s.game)?.guessesLocked) return;
  currentRound(s.game).revealed = true; s.game.step = 'reveal';
}
export function scoreTeam(ctx: Context, index: number) {
  const s = ctx.segment, r = currentRound(s.game), team = ctx.event.teams[index];
  if (s.phase !== 'play' || s.game.step !== 'reveal' || !r?.revealed || !team || team.id === r.teamId || !(team.id in r.results)) return;
  const correct = r.results[team.id] !== 'correct';
  ctx.update(d => { currentRound(d.game).results[team.id] = correct ? 'correct' : 'missed'; });
  ctx.updateEvent(e => { e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, `${r.id}:${team.id}`, team.id, correct, s.points.correct); });
}
export function markRemainingMissed(ctx: Context) {
  const s = ctx.segment, r = currentRound(s.game);
  if (s.phase !== 'play' || s.game.step !== 'reveal' || !r?.revealed) return;
  const pending = Object.keys(r.results).filter(id => r.results[id] === null);
  ctx.update(d => { for (const id of pending) currentRound(d.game).results[id] = 'missed'; });
  ctx.updateEvent(e => { for (const id of pending) e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, `${r.id}:${id}`, id, false, s.points.correct); });
}
export function reviewRound(s: Segment, index: number) {
  if (s.phase === 'play' && s.game.step === 'reveal' && s.game.rounds[index]?.revealed) s.game.index = index;
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
export const hasProgress = (g: Game) => g.step !== 'rules';
export const progressLabel = (g: Game) => `${g.rounds.filter(roundComplete).length} of ${g.rounds.length} commercials completed.`;
export function validateSession(s: Segment, e: ActivityEvent) {
  // Prepared briefs may become stale while the event roster is still editable.
  // Setup disables Start and offers fresh briefs; retain the event on reload.
  if (s.phase === 'setup' && !hasProgress(s.game)) return [];
  if (!s.game.rounds.length) return s.phase === 'setup' ? [] : ['The saved activity has no commercials.'];
  if (!briefsMatch(s.game, e)) return ['Every event team must have exactly one commercial. Prepare new briefs after changing the teams.'];
  for (const r of s.game.rounds) {
    const audience = e.teams.filter(t => t.id !== r.teamId).map(t => t.id);
    if (Object.keys(r.results).length !== audience.length || audience.some(id => !(id in r.results))) return ['A commercial references an unknown guessing team.'];
  }
  if (s.phase === 'finale' && !s.game.rounds.every(roundComplete)) return ['Record all audience results before finishing.'];
  return [];
}
