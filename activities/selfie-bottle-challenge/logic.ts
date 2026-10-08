import { isRunning, pauseTimer, remainingMs, startTimer } from '../../src/core/play/timer';
import { setRoundAward } from '../../src/core/scoring';
import { eventDraft } from '../../src/core/event';
import type { ActivityEvent, EventUpdate } from '../../src/core/types';
import { initialState, type BottleSegment, type Context, type GameState, type Settings, type Turn } from './types';

type Roster = Pick<ActivityEvent, 'players' | 'teams'>;
function rosterSelections(settings: Settings, event: Roster): Settings['selections'] {
  const players = new Set(event.players.map(player => player.id));
  return Object.fromEntries(event.teams.map(team => [team.id, [...new Set(team.memberIds)].filter(id => players.has(id)).slice(0, settings.playersPerTeam)]));
}
export function setupIssues(settings: Settings, event: Roster): string[] {
  return participationIssues(settings, event, rosterSelections(settings, event));
}
function participationIssues(settings: Settings, event: Roster, selections: Settings['selections']): string[] {
  if (event.teams.length < 2) return ['Select at least two event teams.'];
  const issues: string[] = [], selected = new Set<string>();
  for (const team of event.teams) {
    const ids = selections[team.id] ?? [];
    if (!team.name.trim()) issues.push('Every team needs a name.');
    const members = event.players.filter(p => team.memberIds.includes(p.id));
    if (members.length < settings.playersPerTeam) issues.push(`${team.name} needs at least ${settings.playersPerTeam} roster player${settings.playersPerTeam === 1 ? '' : 's'}. Add players in Event teams or choose fewer players for every team.`);
    if (ids.length !== settings.playersPerTeam && members.length >= settings.playersPerTeam) issues.push(`${team.name} must have ${settings.playersPerTeam} different participants. Every team must participate equally.`);
    for (const id of ids) {
      if (!members.some(p => p.id === id)) issues.push(`Choose players from ${team.name}’s current roster.`);
      if (selected.has(id)) issues.push('Each player can participate only once.');
      selected.add(id);
    }
  }
  return [...new Set(issues)];
}
export const currentTurn = (game: GameState) => game.turns[game.currentTurnIndex];
export const playingTurn = (game: GameState) => game.turns.find(t => t.status === 'playing');
export const hasProgress = (game: GameState) => game.turns.length > 0;
export const progressLabel = (game: GameState) => `${game.turns.filter(t => t.status === 'done').length} of ${game.turns.length} player counts confirmed.`;
// The context's correct stake includes the event's quiz base points. This physical challenge
// earns ONE base point per toothpick, so use just the lineup weight from that stake.
export const multiplier = (segment: BottleSegment, event: Pick<ActivityEvent, 'correctPoints'>) => segment.points.correct / event.correctPoints;
export const teamCount = (game: GameState, teamId: string) => game.turns.filter(t => t.teamId === teamId).reduce((sum, t) => sum + (t.count ?? 0), 0);
const turnId = (teamId: string, playerId: string) => `${teamId}:${playerId}`;
function orderedPlayers(settings: Settings, event: Roster) {
  const byTeam = event.teams.map(team => settings.selections[team.id].map(playerId => ({ teamId: team.id, playerId })));
  return settings.turnOrder === 'round-robin'
    ? Array.from({ length: settings.playersPerTeam }, (_, slot) => byTeam.map(players => players[slot])).flat()
    : byTeam.flat();
}
export const playerNumber = (game: GameState, turn: Turn) => game.turns.filter(t => t.teamId === turn.teamId).findIndex(t => t.id === turn.id) + 1;
export function startNewGame(segment: BottleSegment, event?: EventUpdate) {
  if (!event) throw new Error('This challenge needs the event roster.');
  const issues = setupIssues(segment.settings, event);
  if (issues.length) throw new Error(issues[0]);
  segment.settings.selections = rosterSelections(segment.settings, event);
  const turns: Turn[] = orderedPlayers(segment.settings, event).map(({ teamId, playerId }) => ({
    id: turnId(teamId, playerId), teamId, playerId, status: 'pending', timer: { durationMs: segment.settings.turnSeconds * 1000 as 45_000 | 60_000 },
  }));
  segment.game = { turns, currentTurnIndex: 0 };
  segment.phase = 'play';
  event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== segment.segmentId);
}
export function startTurn(segment: BottleSegment, now = Date.now()) {
  const turn = currentTurn(segment.game);
  if (segment.phase !== 'play' || !turn || turn.status !== 'pending' || segment.game.turns.slice(0, segment.game.currentTurnIndex).some(t => t.status !== 'done')) return;
  turn.status = 'playing';
  turn.timer = { ...startTimer(turn.timer, now), durationMs: turn.timer.durationMs };
}
export function endTurn(segment: BottleSegment, id: string, now = Date.now()) {
  const turn = segment.game.turns.find(t => t.id === id);
  if (segment.phase !== 'play' || !turn || turn.status !== 'playing') return;
  turn.timer = { ...pauseTimer(turn.timer, now), durationMs: turn.timer.durationMs };
  turn.status = 'counting';
  delete segment.game.clockHeld;
}
export function expireTurn(segment: BottleSegment, now = Date.now()) {
  const turn = playingTurn(segment.game);
  if (turn && isRunning(turn.timer) && remainingMs(turn.timer, now) === 0) endTurn(segment, turn.id, now);
}
export function toggleClock(segment: BottleSegment, id: string, now = Date.now()) {
  const turn = playingTurn(segment.game);
  if (segment.phase !== 'play' || !turn || turn.id !== id) return;
  if (remainingMs(turn.timer, now) === 0) { endTurn(segment, id, now); return; }
  turn.timer = { ...(isRunning(turn.timer) ? pauseTimer(turn.timer, now) : startTimer(turn.timer, now)), durationMs: turn.timer.durationMs };
}
export function holdClock(segment: BottleSegment, now = Date.now()) {
  expireTurn(segment, now);
  const turn = playingTurn(segment.game);
  if (!turn || !isRunning(turn.timer)) return;
  turn.timer = { ...pauseTimer(turn.timer, now), durationMs: turn.timer.durationMs };
  segment.game.clockHeld = true;
}
export function releaseClock(segment: BottleSegment, now = Date.now()) {
  if (!segment.game.clockHeld) return;
  delete segment.game.clockHeld;
  const turn = playingTurn(segment.game);
  if (turn) turn.timer = { ...startTimer(turn.timer, now), durationMs: turn.timer.durationMs };
}
export function confirmCount(segment: BottleSegment, event: EventUpdate, id: string, count: number) {
  const turn = segment.game.turns.find(t => t.id === id);
  if (!turn || !['counting', 'done'].includes(turn.status) || !Number.isInteger(count) || count < 0 || count > 10) return;
  turn.count = count; turn.status = 'done'; delete turn.countDraft;
  syncTeamAwards(segment, event);
}
export function syncTeamAwards(segment: BottleSegment, event: EventUpdate) {
  for (const team of event.teams) {
    if (!segment.game.turns.some(t => t.teamId === team.id && t.status === 'done')) continue;
    event.scoreEntries = setRoundAward(event.scoreEntries, segment.segmentId, `team:${team.id}`, team.id, true, teamCount(segment.game, team.id) * multiplier(segment, event));
  }
}
export function saveCount(context: Context, id: string) {
  let saved: BottleSegment | undefined;
  context.update(s => {
    const turn = s.game.turns.find(t => t.id === id), count = turn?.countDraft ?? turn?.count;
    if (count === undefined || !turn || !['counting', 'done'].includes(turn.status)) return;
    // The event update below uses the latest ledger, so a correction cannot overwrite
    // another activity's or a manual score entry.
    confirmCount(s, eventDraft(context.event), id, count);
    saved = s;
  });
  if (saved) context.updateEvent(e => syncTeamAwards(saved!, e));
}
export function canVisitTurn(game: GameState, index: number) {
  const frontier = game.turns.findIndex(t => t.status !== 'done');
  return Number.isInteger(index) && index >= 0 && index < game.turns.length && (frontier === -1 || index <= frontier);
}
export function visitTurn(segment: BottleSegment, index: number) {
  if (canVisitTurn(segment.game, index)) segment.game.currentTurnIndex = index;
}
export function showResults(segment: BottleSegment) {
  if (segment.game.turns.length && segment.game.turns.every(t => t.status === 'done')) segment.phase = 'finale';
}
export function restart(context: Context) {
  context.update(s => { s.game = initialState(); s.phase = 'setup'; s.setupStepId = 'game'; });
  context.updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== context.segment.segmentId); });
}
export function validateSession(segment: BottleSegment, event: ActivityEvent): string[] {
  const game = segment.game;
  if (!game.turns.length) return segment.phase === 'setup' ? [] : ['The saved challenge has no player turns.'];
  const issues = participationIssues(segment.settings, event, segment.settings.selections);
  if (issues.length) return issues;
  const expected = orderedPlayers(segment.settings, event).map(({ teamId, playerId }) => turnId(teamId, playerId));
  if (expected.length !== game.turns.length || game.turns.some((t, i) => t.id !== expected[i] || t.id !== turnId(t.teamId, t.playerId))) return ['The saved turns do not match the selected roster players.'];
  if (game.turns.some(t => t.timer.durationMs !== segment.settings.turnSeconds * 1000)) return ['Every player must have the same turn length.'];
  const now = Date.now();
  if (game.turns.some(t => t.timer.deadlineAt !== undefined && remainingMs(t.timer, now) > t.timer.durationMs)) return ['A saved player timer cannot have more than the agreed turn length remaining.'];
  // Only one derived award per team is legitimate. Reject duplicate, missing or edited
  // awards on import instead of allowing a second identifier to silently pay out twice.
  const awards = event.scoreEntries.filter(e => e.segmentId === segment.segmentId && e.kind === 'round-award');
  const confirmedTeams = event.teams.filter(team => game.turns.some(t => t.teamId === team.id && t.status === 'done'));
  if (awards.length !== confirmedTeams.length || confirmedTeams.some(team => {
    const roundId = `team:${team.id}`, id = `${segment.segmentId}:award-${roundId}`;
    const award = awards.find(e => e.id === id);
    return !award || award.teamId !== team.id || award.roundId !== roundId || !award.active || award.points !== teamCount(game, team.id) * multiplier(segment, event);
  })) return ['The saved challenge’s score awards do not match its confirmed player counts.'];
  if (segment.phase === 'finale' && game.turns.some(t => t.status !== 'done')) return ['Confirm every player’s count before viewing results.'];
  return [];
}
