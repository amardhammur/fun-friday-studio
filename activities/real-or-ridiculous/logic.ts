import { pauseTimer, startTimer } from '../../src/core/play/timer';
import { setRoundAward } from '../../src/core/scoring';
import { eventDraft } from '../../src/core/event';
import type { EventUpdate } from '../../src/core/types';
import { inventions, availableRounds } from './content';
import { initialState, settingsSchema, type Context, type Segment, type Game, type Round } from './types';
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildDeck(count: number, demo = false): Round[] {
  if (count > availableRounds) throw new Error('Add more real inventions and fictional pitches before starting this many rounds.');
  const bank = structuredClone(inventions);
  const opening = demo ? ['tiny-cleaner', 'compliment-mug', 'designer-stick'] : [];
  const real = shuffled(bank.filter(c => c.kind === 'real' && !opening.includes(c.id)));
  const fiction = shuffled(bank.filter(c => c.kind === 'fiction' && !opening.includes(c.id)));
  const rounds: Round[] = [];
  if (demo) rounds.push({ id: 'sample-round', cards: opening.map(id => bank.find(c => c.id === id)!) as Round['cards'], clueIndex: 2 });
  while (rounds.length < count) {
    const fake = fiction.pop()!;
    rounds.push({ id: fake.id, cards: shuffled([real.pop()!, real.pop()!, fake]) as Round['cards'], clueIndex: Math.floor(Math.random() * 3) });
  }
  return rounds;
}
export function startNewGame(s: Segment, event?: EventUpdate) {
  const settings = settingsSchema.parse(s.settings);
  if (!event || event.teams.length < 2 || event.teams.some(t => !t.name.trim())) throw new Error('Add at least two named event teams first.');
  const deck = buildDeck(settings.rounds, event.isDemo);
  s.game = { ...initialState(), deck, timer: { durationMs: settings.seconds * 1000 } };
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== s.segmentId);
  s.phase = 'play';
}
export const discussing = (g: Game) => g.step === 'pitch' || g.step === 'clue';
export function advance(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || !s.game.deck.length) return;
  const g = s.game;
  if (g.step === 'pitch' || g.step === 'clue') {
    g.timer = pauseTimer(g.timer, now); delete g.clockHeld;
    g.step = g.step === 'pitch' ? 'vote' : 'finalVote'; return;
  }
  if (g.step !== 'rules' && g.step !== 'reveal') return;
  if (g.step === 'reveal') {
    if (g.index === g.deck.length - 1) { s.phase = 'finale'; return; }
    g.index++;
  }
  g.step = 'pitch'; delete g.clockHeld;
  g.timer = startTimer({ durationMs: s.settings.seconds * 1000 }, now);
}
export function showClue(s: Segment, now = Date.now()) {
  if (s.phase !== 'play' || s.game.step !== 'vote') return;
  s.game.step = 'clue'; s.game.timer = startTimer({ durationMs: 15000 }, now);
}
export function reveal(s: Segment) {
  if (s.phase !== 'play' || s.game.step !== 'finalVote') return;
  s.game.step = 'reveal';
}
export const awardId = (s: Segment, teamId: string) => `${s.game.deck[s.game.index]?.id}:${teamId}`;
export function scoreTeam(ctx: Context, index: number) {
  const s = ctx.segment, team = ctx.event.teams[index];
  if (s.phase !== 'play' || s.game.step !== 'reveal' || !team) return;
  ctx.updateEvent(e => {
    const roundId = awardId(s, team.id);
    const active = e.scoreEntries.some(entry => entry.segmentId === s.segmentId && entry.roundId === roundId && entry.active);
    e.scoreEntries = setRoundAward(e.scoreEntries, s.segmentId, roundId, team.id, !active, s.points.correct);
  });
}
export function start(ctx: Context) {
  const draft = eventDraft(ctx.event); let started = false;
  ctx.update(s => { startNewGame(s, draft); started = true; });
  if (started) ctx.updateEvent(e => { e.scoreEntries = draft.scoreEntries; });
}
export function holdClock(s: Segment, now = Date.now()) {
  if (discussing(s.game) && s.game.timer.deadlineAt !== undefined) { s.game.timer = pauseTimer(s.game.timer, now); s.game.clockHeld = true; }
}
export function releaseClock(s: Segment, now = Date.now()) {
  if (s.game.clockHeld) { s.game.timer = startTimer(s.game.timer, now); delete s.game.clockHeld; }
}
export function toggleClock(s: Segment) {
  if (s.phase !== 'play' || !discussing(s.game)) return;
  s.game.timer = s.game.timer.deadlineAt === undefined ? startTimer(s.game.timer, Date.now()) : pauseTimer(s.game.timer, Date.now());
}
