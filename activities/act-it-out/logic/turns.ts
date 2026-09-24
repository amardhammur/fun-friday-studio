import type { EventUpdate, Team } from '../../../src/core/types';
import { setRoundAward } from '../../../src/core/scoring';
import { pauseTimer, startTimer } from '../../../src/core/play/timer';
import { eventDraft } from '../../../src/core/event';
import type { Prompt } from '../prompts';
import type { AIOSegment, Context, GameState, Settings } from '../types';
type Turn = GameState['turns'][number];
// Three cards a turn is the floor at which a fast team does not run the room dry mid-turn. The setup
// steps, their validation and startNewGame all read it from here so they cannot drift apart.
export const MIN_CARDS_PER_TURN = 3;
export const cardsNeeded = (teamCount: number, roundsPerTeam: number) => Math.max(MIN_CARDS_PER_TURN, teamCount * roundsPerTeam * MIN_CARDS_PER_TURN);
// The host's own categories come first so a host who retypes a bundled prompt keeps their own wording.
export function eligiblePrompts(settings: Settings): Prompt[] {
  const on = settings.categories.filter(c => c.on), ordered = [...on.filter(c => !c.builtIn), ...on.filter(c => c.builtIn)];
  const prompts: Prompt[] = [], seen = new Set<string>();
  for (const c of ordered) {
    const category = c.name.trim() || 'Your own';
    for (const text of c.prompts.map(t => t.trim()).filter(Boolean)) {
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); prompts.push({ text, category });
    }
  }
  return prompts;
}
export function buildDeck(settings: Settings, random = Math.random): Prompt[] {
  const deck = eligiblePrompts(settings);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
export function allocateTurns(teams: Team[], roundsPerTeam: number): Turn[] {
  const turns: Turn[] = [];
  for (let round = 0; round < roundsPerTeam; round++) for (const team of teams) turns.push({ id: `turn-${round}-${team.id}`, teamId: team.id, results: [], status: 'pending' });
  return turns;
}
export function startNewGame(segment: AIOSegment, event?: EventUpdate) {
  if (!event) throw new Error('This activity needs the event teams to start.');
  const teams = event.teams as Team[];
  if (!teams.length) throw new Error('Add at least one team before starting.');
  if (teams.some(t => !t.name.trim())) throw new Error('Give each team a name.');
  const deck = buildDeck(segment.settings), turns = allocateTurns(teams, segment.settings.roundsPerTeam);
  if (deck.length < cardsNeeded(teams.length, segment.settings.roundsPerTeam)) throw new Error('There are not enough prompts for every turn. Choose more categories or add your own.');
  segment.game = { deck, cursor: 0, turns, currentTurnIndex: 0, timer: { durationMs: segment.settings.turnSeconds * 1000 } };
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== segment.segmentId);
  segment.phase = 'play';
}
export const currentTurn = (game: GameState): Turn | undefined => game.turns[game.currentTurnIndex];
export const currentPrompt = (game: GameState): Prompt | undefined => game.deck[game.cursor];
export const turnScore = (turn: Turn, correctPoints: number) => turn.results.filter(r => r.outcome === 'guessed').length * correctPoints;
export function startTurn(segment: AIOSegment, guesserName: string, now = Date.now()) {
  const turn = currentTurn(segment.game);
  if (!turn || turn.status !== 'pending') return;
  turn.guesserName = guesserName.trim() || undefined;
  turn.status = 'acting';
  segment.game.timer = startTimer({ durationMs: segment.settings.turnSeconds * 1000 }, now);
}
// The entry is DERIVED from the guessed count rather than incremented, so a double tap, a refresh
// and an undo all converge on the same number without any bookkeeping.
const award = (segment: AIOSegment, event: EventUpdate, turn: Turn) =>
  setRoundAward([...event.scoreEntries], segment.segmentId, turn.id, turn.teamId, true, turnScore(turn, segment.points.correct));
function record(segment: AIOSegment, event: EventUpdate, outcome: 'guessed' | 'skipped') {
  const game = segment.game, turn = currentTurn(game), prompt = currentPrompt(game);
  if (!turn || turn.status !== 'acting' || !prompt) return;
  turn.results.push({ text: prompt.text, outcome });
  game.cursor += 1;
  event.scoreEntries = award(segment, event, turn);
}
export const markGuessed = (segment: AIOSegment, event: EventUpdate) => record(segment, event, 'guessed');
export const markSkipped = (segment: AIOSegment, event: EventUpdate) => record(segment, event, 'skipped');
// Undo reaches back exactly one card, and only inside the turn that drew it. That restriction is what
// keeps `cursor` a truthful position in a single shared deck: a finished turn's cards are spent.
export function undoLast(segment: AIOSegment, event: EventUpdate) {
  const game = segment.game, turn = currentTurn(game);
  if (!turn || turn.status !== 'acting' || !turn.results.length) return;
  turn.results.pop();
  game.cursor -= 1;
  event.scoreEntries = award(segment, event, turn);
}
export function endTurn(segment: AIOSegment, now = Date.now()) {
  const turn = currentTurn(segment.game);
  if (!turn || turn.status !== 'acting') return;
  turn.status = 'done';
  segment.game.timer = pauseTimer(segment.game.timer, now);
}
export function moveTurn(segment: AIOSegment, delta: number) {
  const game = segment.game, next = game.currentTurnIndex + delta;
  if (next >= 0 && next < game.turns.length) { game.currentTurnIndex = next; game.timer = { durationMs: segment.settings.turnSeconds * 1000 }; }
  else if (next === game.turns.length && game.turns.every(t => t.status === 'done')) segment.phase = 'finale';
}
// A segment edit and an event edit are two separate atomic updates, so the score write is staged on a
// mutable copy and handed to updateEvent afterwards.
export function scoreChange(ctx: Context, fn: (s: AIOSegment, e: EventUpdate) => void) {
  const event: EventUpdate = eventDraft(ctx.event);
  ctx.update(s => fn(s, event));
  ctx.updateEvent(draft => { draft.scoreEntries = event.scoreEntries; });
}
