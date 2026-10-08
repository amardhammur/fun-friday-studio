import { pauseTimer, startTimer } from '../../src/core/play/timer';
import { setRoundAward } from '../../src/core/scoring';
import { eventDraft } from '../../src/core/event';
import type { EventUpdate } from '../../src/core/types';
import { puzzles } from './content';
import { initialState, settingsSchema, type Context, type Segment } from './types';
export function startNewGame(s: Segment, event?: EventUpdate) {
  const settings = settingsSchema.parse(s.settings);
  if (!event?.teams.length) throw new Error('Add at least one event team first.');
  const deck = structuredClone(puzzles);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.game = { ...initialState(), deck: deck.slice(0, settings.rounds), timer: { durationMs: settings.seconds * 1000 } };
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== s.segmentId);
  s.phase = 'play';
}
export function advance(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !s.game.deck.length || s.game.step === 'question') return;
  if (s.game.step === 'answer') {
    if (s.game.index === s.game.deck.length - 1) { s.phase = 'finale'; return; }
    s.game.index++;
  }
  s.game.step = 'question';
  s.game.timer = startTimer({ durationMs: s.settings.seconds * 1000 }, now);
}
export function reveal(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || s.game.step !== 'question') return;
  s.game.timer = pauseTimer(s.game.timer, now); s.game.step = 'answer';
}
export const awardId = (s: Segment, teamId: string) => `${s.game.deck[s.game.index]?.id}:${teamId}`;
export function toggleAward(s: Segment, event: EventUpdate, teamIndex: number) {
  const team = event.teams[teamIndex];
  if (s.phase !== 'play' || s.game.step !== 'answer' || !team) return;
  const roundId = awardId(s, team.id);
  const active = event.scoreEntries.some(e => e.segmentId === s.segmentId && e.roundId === roundId && e.active);
  event.scoreEntries = setRoundAward(event.scoreEntries, s.segmentId, roundId, team.id, !active, s.points.correct);
}
export function scoreTeam(ctx: Context, index: number) {
  ctx.updateEvent(event => toggleAward(ctx.segment, event, index));
}
export function start(ctx: Context) {
  const draft = eventDraft(ctx.event); let started = false;
  ctx.update(s => { startNewGame(s, draft); started = true; });
  if (started) ctx.updateEvent(e => { e.scoreEntries = draft.scoreEntries; });
}
export function holdClock(s: Segment, now = Date.now()) {
  if (s.game.step === 'question' && s.game.timer.deadlineAt !== undefined) { s.game.timer = pauseTimer(s.game.timer, now); s.game.clockHeld = true; }
}
export function releaseClock(s: Segment, now = Date.now()) {
  if (s.game.clockHeld) { s.game.timer = startTimer(s.game.timer, now); delete s.game.clockHeld; }
}
export function toggleClock(s: Segment) {
  if (s.phase !== 'play' || s.game.step !== 'question') return;
  s.game.timer = s.game.timer.deadlineAt === undefined ? startTimer(s.game.timer, Date.now()) : pauseTimer(s.game.timer, Date.now());
}
