import type { Person, Team } from '../../../src/core/types';
import { setRoundAward } from '../../../src/core/scoring';
import type { CVSession, GameState } from '../types';
export function allocateRounds(people: Person[], teams: Team[], shuffle: boolean, random = Math.random): GameState['rounds'] {
  const pool = people.filter(p => p.included).map(p => p.id);
  if (!teams.length || !pool.length) return [];
  if (shuffle) for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const rounds: GameState['rounds'] = []; let offset = 0;
  teams.forEach((team, i) => {
    const count = Math.floor(pool.length / teams.length) + (i < pool.length % teams.length ? 1 : 0);
    for (const personId of pool.slice(offset, offset + count)) rounds.push({ id: `round-${personId}`, personId, teamId: team.id, revealed: false, result: null });
    offset += count;
  });
  return rounds;
}
export function startNewGame(session: CVSession) {
  const included = session.people.filter(p => p.included);
  if (!included.length) throw new Error('Include at least one person before starting.');
  if (included.some(p => !p.name.trim())) throw new Error('Please name every included person before starting.');
  if (included.some(p => { const f = session.facePairs.find(f => f.id === p.facePairId); return !f?.now?.cropImageId || !f?.then?.cropImageId; })) throw new Error('Every included person needs both face crops. Return to Match people to finish them.');
  if (session.teams.some(t => !t.name.trim())) throw new Error('Give each team a name.');
  session.game.rounds = allocateRounds(session.people, session.teams, session.settings.shuffle);
  session.game.currentRoundIndex = 0; session.scoreEntries = []; session.phase = 'play';
}
export function reveal(session: CVSession) { const round = session.game.rounds[session.game.currentRoundIndex]; if (round) round.revealed = true; }
export function markResult(session: CVSession, result: 'correct' | 'missed') {
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed) return;
  round.result = result;
  session.scoreEntries = setRoundAward(session.scoreEntries, session.segmentId, round.id, round.teamId, result === 'correct');
}
export function moveRound(session: CVSession, delta: number) {
  const next = session.game.currentRoundIndex + delta;
  if (next >= 0 && next < session.game.rounds.length) session.game.currentRoundIndex = next;
  else if (next === session.game.rounds.length && session.game.rounds.every(r => r.result !== null)) session.phase = 'finale';
}
