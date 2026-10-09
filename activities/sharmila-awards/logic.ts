import { eventDraft } from '../../src/core/event';
import { setRoundAward } from '../../src/core/scoring';
import type { ActivityEvent, EventUpdate } from '../../src/core/types';
import { questionList } from './questions';
import { initialState, type AwardsSegment, type Context, type GameState, type Settings, type Turn } from './types';

type Teams = Pick<ActivityEvent, 'teams'>;
export const currentTurn = (game: GameState) => game.turns[game.currentTurnIndex];
export const hasProgress = (game: GameState) => game.turns.length > 0;
export const progressLabel = (game: GameState) => `${game.turns.filter(t => t.points !== undefined).length} of ${game.turns.length} team turns saved.`;
// The shell's correct stake includes quiz points. These host-entered totals only take the lineup multiplier.
export const multiplier = (segment: AwardsSegment, event: Pick<ActivityEvent, 'correctPoints'>) => segment.points.correct / event.correctPoints;
export const teamPoints = (game: GameState, teamId: string) => game.turns.filter(t => t.teamId === teamId).reduce((sum, t) => sum + (t.points ?? 0), 0);
const turnId = (round: number, teamId: string) => `${round}:${teamId}`;
export function setupIssues(settings: Settings, event: Teams): string[] {
  const questions = questionList(settings.questionText), required = event.teams.length;
  const issues: string[] = [];
  if (event.teams.length < 2) issues.push('Set up at least two event teams.');
  if (event.teams.some(t => !t.name.trim())) issues.push('Every team needs a name.');
  if (questions.length < required) issues.push(`Add at least ${required} unique questions for one round. You have ${questions.length}.`);
  if (questions.length > 100) issues.push('Use up to 100 unique questions.');
  if (questions.some(q => q.length > 300)) issues.push('Keep each question to 300 characters or fewer.');
  return issues;
}
export function startNewGame(segment: AwardsSegment, event?: EventUpdate) {
  if (!event) throw new Error('Sharmila Awards needs the event teams.');
  const issues = setupIssues(segment.settings, event);
  if (issues.length) throw new Error(issues[0]);
  segment.game = {
    questions: questionList(segment.settings.questionText).map((text, i) => ({ id: `question-${i + 1}`, text })),
    turns: event.teams.map(team => ({ id: turnId(1, team.id), teamId: team.id, round: 1 })),
    currentTurnIndex: 0,
  };
  segment.phase = 'play';
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== segment.segmentId);
}
export const remainingQuestions = (game: GameState, turn: Turn) => {
  const used = new Set(game.turns.filter(t => t.id !== turn.id && t.draw).map(t => t.draw!.questionId));
  return game.questions.filter(q => !used.has(q.id));
};
export function spinQuestion(segment: AwardsSegment, id: string, random = Math.random, now = Date.now()) {
  const turn = currentTurn(segment.game);
  if (segment.phase !== 'play' || !turn || turn.id !== id || turn.draw) return;
  const questions = remainingQuestions(segment.game, turn), roll = random();
  if (!questions.length || !Number.isFinite(roll) || roll < 0 || roll >= 1) return;
  turn.draw = { questionId: questions[Math.floor(roll * questions.length)].id, startedAt: now };
}
export function parsePoints(raw: string): number | undefined {
  if (!/^\d+$/.test(raw.trim())) return undefined;
  const points = Number(raw.trim());
  return Number.isSafeInteger(points) ? points : undefined;
}
export function canSavePoints(segment: AwardsSegment, event: Pick<ActivityEvent, 'correctPoints'>, turn: Turn, points: number | undefined): points is number {
  return points !== undefined && Number.isSafeInteger(points) && points >= 0 && Boolean(turn.draw)
    && Number.isSafeInteger((teamPoints(segment.game, turn.teamId) - (turn.points ?? 0) + points) * multiplier(segment, event));
}
export function syncAwards(segment: AwardsSegment, event: EventUpdate) {
  for (const turn of segment.game.turns) if (turn.points !== undefined) {
    event.scoreEntries = setRoundAward(event.scoreEntries, segment.segmentId, turn.id, turn.teamId, true, turn.points * multiplier(segment, event));
  }
}
export function confirmPoints(segment: AwardsSegment, event: EventUpdate, id: string, points: number, advance = false): boolean {
  const turn = segment.game.turns.find(t => t.id === id);
  if (!turn || !canSavePoints(segment, event, turn, points)) return false;
  if (advance) {
    if (segment.phase !== 'play' || currentTurn(segment.game)?.id !== id || turn.points !== undefined) return false;
  } else if (turn.points === undefined) return false;
  turn.points = points;
  delete turn.pointsDraft;
  syncAwards(segment, event);
  if (advance) {
    if (segment.game.currentTurnIndex < segment.game.turns.length - 1) segment.game.currentTurnIndex++;
    else segment.phase = 'finale';
  }
  return true;
}
export function savePoints(context: Context, id: string, advance = false) {
  let saved: AwardsSegment | undefined;
  context.update(s => {
    const turn = s.game.turns.find(t => t.id === id), points = turn && parsePoints(turn.pointsDraft ?? String(turn.points ?? ''));
    // Older saved totals remain readable; the host's buttons now record only +1 or zero.
    if ((points === 0 || points === 1) && confirmPoints(s, eventDraft(context.event), id, points, advance)) saved = s;
  });
  // Merge into the latest shared ledger so a correction preserves other activities' awards.
  if (saved) context.updateEvent(e => syncAwards(saved!, e));
}
export function restart(context: Context) {
  context.update(s => { s.game = initialState(); s.phase = 'setup'; s.setupStepId = 'game'; });
  context.updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== context.segment.segmentId); });
}
export function validateSession(segment: AwardsSegment, event: ActivityEvent): string[] {
  const game = segment.game, awards = event.scoreEntries.filter(e => e.segmentId === segment.segmentId && (e.kind === 'round-award' || e.kind === 'steal-award'));
  if (!game.turns.length) return segment.phase === 'setup' && !awards.length ? [] : ['The saved awards activity has no team turns.'];
  const issues = setupIssues(segment.settings, event);
  if (issues.length) return issues;
  const questions = questionList(segment.settings.questionText);
  if (questions.length !== game.questions.length || game.questions.some((q, i) => q.id !== `question-${i + 1}` || q.text !== questions[i])) return ['The saved questions do not match this activity’s question list.'];
  if (game.questions.length < game.turns.length) return ['The saved activity needs a unique question for every turn.'];
  const rounds = game.legacyTwoRounds ? [1, 2] : [1];
  if (game.legacyTwoRounds && !game.turns.some(t => t.round === 2 && t.draw)) return ['An older second round must have saved progress.'];
  const expected = rounds.flatMap(round => event.teams.map(t => ({ id: turnId(round, t.id), teamId: t.id, round })));
  if (game.turns.length !== expected.length || game.turns.some((t, i) => t.id !== expected[i].id || t.teamId !== expected[i].teamId || t.round !== expected[i].round)) return ['Every team must have one turn per round.'];
  const confirmed = game.turns.filter(t => t.points !== undefined);
  if (awards.length !== confirmed.length || confirmed.some(t => {
    const award = awards.find(e => e.id === `${segment.segmentId}:award-${t.id}`);
    return !award || award.kind !== 'round-award' || !award.active || award.teamId !== t.teamId || award.roundId !== t.id || award.points !== t.points! * multiplier(segment, event);
  })) return ['The saved score awards do not match the confirmed points.'];
  if (confirmed.some(t => !canSavePoints(segment, event, t, t.points))) return ['The saved points total is too large.'];
  if (segment.phase === 'finale' && confirmed.length !== game.turns.length) return ['Save every team’s points before showing final standings.'];
  return [];
}
