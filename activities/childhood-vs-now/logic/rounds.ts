import type { Person, Player, Team } from '../../../src/core/types';
import { setRoundAward } from '../../../src/core/scoring';
import { retractSteal, setStealAward } from '../../../src/core/play/steal';
import type { CVEventUpdate, CVSession, GameState } from '../types';
export function allocateRounds(people: readonly Person[], teams: readonly Team[], shuffle: boolean, random = Math.random, players: readonly Player[] = []): GameState['rounds'] {
  const pool = people.filter(p => p.included).map(p => p.id);
  if (!teams.length || !pool.length) return [];
  if (shuffle) for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const owners = photoOwners(teams, players);
  if (pool.some(id => owners.has(id))) {
    const capacities = teams.map((_, i) => Math.floor(pool.length / teams.length) + (i < pool.length % teams.length ? 1 : 0));
    const batches: string[][] = teams.map(() => []);
    // A capacitated bipartite matching. Reassign earlier photos along augmenting
    // paths so a flexible photo cannot consume a slot needed by a constrained one.
    const place = (personId: string, seen: Set<number>): boolean => {
      for (let i = 0; i < teams.length; i++) {
        if (seen.has(i) || owners.get(personId) === teams[i].id) continue;
        seen.add(i);
        if (batches[i].length < capacities[i]) { batches[i].push(personId); return true; }
        for (let j = 0; j < batches[i].length; j++) if (place(batches[i][j], seen)) {
          batches[i][j] = personId; return true;
        }
      }
      return false;
    };
    const unmatched = pool.filter(id => !place(id, new Set()));
    let remaining = 0;
    const order = new Map(pool.map((id, i) => [id, i]));
    return teams.flatMap((team, i) => {
      while (batches[i].length < capacities[i]) batches[i].push(unmatched[remaining++]);
      return batches[i].sort((a, b) => order.get(a)! - order.get(b)!).map(personId => ({ id: `round-${personId}`, personId, teamId: team.id, revealed: false, result: null }));
    });
  }
  const rounds: GameState['rounds'] = []; let offset = 0;
  teams.forEach((team, i) => {
    const count = Math.floor(pool.length / teams.length) + (i < pool.length % teams.length ? 1 : 0);
    for (const personId of pool.slice(offset, offset + count)) rounds.push({ id: `round-${personId}`, personId, teamId: team.id, revealed: false, result: null });
    offset += count;
  });
  return rounds;
}
function photoOwners(teams: readonly Team[], players: readonly Player[]) {
  const linked = new Map(players.filter(p => p.personId !== undefined).map(p => [p.id, p.personId!]));
  const owners = new Map<string, string>();
  for (const team of teams) for (const id of team.memberIds) {
    const personId = linked.get(id);
    if (personId !== undefined) owners.set(personId, team.id);
  }
  return owners;
}
export function ownPhotoCount(rounds: GameState['rounds'], teams: readonly Team[], players: readonly Player[]) {
  const owners = photoOwners(teams, players);
  return rounds.filter(round => owners.get(round.personId) === round.teamId).length;
}
export function startNewGame(session: CVSession, event?: CVEventUpdate) {
  const legacy = !event, old = session as any; event = event ?? { players: [], playersInitialized: false, people: old.people ?? [], facePairs: old.facePairs ?? [], teams: old.teams ?? [], scoreEntries: old.scoreEntries ?? [], assets: old.assets ?? {}, photoSets: old.photoSets ?? [], title: '', isDemo: false, phase: 'segment', correctPoints: old.points?.correct ?? 2, stealPoints: old.points?.steal ?? 1 };
  const included = event.people.filter(p => p.included);
  if (!included.length) throw new Error('Include at least one person before starting.');
  if (included.some(p => !p.name.trim())) throw new Error('Please name every included person before starting.');
  if (included.some(p => { const f = event.facePairs.find(f => f.id === p.facePairId); return !f?.now?.cropImageId || !f?.then?.cropImageId; })) throw new Error('Every included person needs both face crops. Return to Match people to finish them.');
  if (event.teams.some(t => !t.name.trim())) throw new Error('Give each team a name.');
  session.game.rounds = allocateRounds(event.people, event.teams, session.settings.shuffle, Math.random, event.players);
  session.game.currentRoundIndex = 0; event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== session.segmentId); if (legacy) (session as any).scoreEntries = event.scoreEntries; session.phase = 'play';
}
export const hasProgress = (game: GameState) => game.rounds.some(r => r.revealed || r.result !== null);
export const progressLabel = (game: GameState) => `${game.rounds.filter(r => r.result !== null).length} of ${game.rounds.length} photos played.`;
export function reveal(session: CVSession) { const round = session.game.rounds[session.game.currentRoundIndex]; if (round) round.revealed = true; }
export function markResult(session: CVSession, eventOrResult: CVEventUpdate | 'correct' | 'missed', resultArg?: 'correct' | 'missed') {
  const legacy = typeof eventOrResult === 'string'; const event = legacy ? ({ players: [], playersInitialized: false, people: [], facePairs: [], teams: [], scoreEntries: (session as any).scoreEntries ?? [], assets: {}, photoSets: [], title: '', isDemo: false, phase: 'segment', correctPoints: session.points.correct, stealPoints: session.points.steal } as CVEventUpdate) : eventOrResult; const result = (legacy ? eventOrResult : resultArg)!;
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed) return;
  round.result = result;
  event.scoreEntries = setRoundAward(event.scoreEntries, session.segmentId, round.id, round.teamId, result === 'correct', session.points.correct);
  if (result === 'correct') event.scoreEntries = retractSteal(event.scoreEntries, session.segmentId, round.id);
  if (legacy) (session as any).scoreEntries = event.scoreEntries;
}
export function markSteal(session: CVSession, eventOrTeam: CVEventUpdate | string | null, teamArg?: string | null) {
  const legacy = typeof eventOrTeam === 'string' || eventOrTeam === null; const event = legacy ? ({ players: [], playersInitialized: false, people: [], facePairs: [], teams: [], scoreEntries: (session as any).scoreEntries ?? [], assets: {}, photoSets: [], title: '', isDemo: false, phase: 'segment', correctPoints: session.points.correct, stealPoints: session.points.steal } as CVEventUpdate) : eventOrTeam; const teamId = legacy ? eventOrTeam as string | null : teamArg;
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed || round.result !== 'missed') return;
  event.scoreEntries = setStealAward(event.scoreEntries, session.segmentId, round.id, round.teamId, teamId ?? null, session.points.steal);
  if (legacy) (session as any).scoreEntries = event.scoreEntries;
}
// Played rounds can be revisited for corrections; ahead of them only the first unplayed round is reachable.
export function furthestRound(rounds: GameState['rounds']) { const i = rounds.findIndex(r => r.result === null); return i === -1 ? rounds.length - 1 : i; }
export function goToRound(session: CVSession, index: number) { if (index >= 0 && index <= furthestRound(session.game.rounds)) session.game.currentRoundIndex = index; }
export function moveRound(session: CVSession, delta: number) {
  const next = session.game.currentRoundIndex + delta;
  if (next >= 0 && next < session.game.rounds.length) goToRound(session, next);
  else if (next === session.game.rounds.length && session.game.rounds.every(r => r.result !== null)) session.phase = 'finale';
}
