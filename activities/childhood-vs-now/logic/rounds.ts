import type { Person, Team } from '../../../src/core/types';
import { setRoundAward } from '../../../src/core/scoring';
import { retractSteal, setStealAward } from '../../../src/core/play/steal';
import type { CVEventUpdate, CVSession, GameState } from '../types';
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
export function startNewGame(session: CVSession, event?: CVEventUpdate) {
  const legacy = !event, old = session as any; event = event ?? { people: old.people ?? [], facePairs: old.facePairs ?? [], teams: old.teams ?? [], scoreEntries: old.scoreEntries ?? [], assets: old.assets ?? {}, photoSets: old.photoSets ?? [], title: '', isDemo: false, phase: 'segment', correctPoints: old.points?.correct ?? 2, stealPoints: old.points?.steal ?? 1 };
  const included = event.people.filter(p => p.included);
  if (!included.length) throw new Error('Include at least one person before starting.');
  if (included.some(p => !p.name.trim())) throw new Error('Please name every included person before starting.');
  if (included.some(p => { const f = event.facePairs.find(f => f.id === p.facePairId); return !f?.now?.cropImageId || !f?.then?.cropImageId; })) throw new Error('Every included person needs both face crops. Return to Match people to finish them.');
  if (event.teams.some(t => !t.name.trim())) throw new Error('Give each team a name.');
  session.game.rounds = allocateRounds(event.people as Person[], event.teams as Team[], session.settings.shuffle);
  session.game.currentRoundIndex = 0; event.scoreEntries = event.scoreEntries.filter(e => e.segmentId !== session.segmentId); if (legacy) (session as any).scoreEntries = event.scoreEntries; session.phase = 'play';
}
export function reveal(session: CVSession) { const round = session.game.rounds[session.game.currentRoundIndex]; if (round) round.revealed = true; }
export function markResult(session: CVSession, eventOrResult: CVEventUpdate | 'correct' | 'missed', resultArg?: 'correct' | 'missed') {
  const legacy = typeof eventOrResult === 'string'; const event = legacy ? ({ people: [], facePairs: [], teams: [], scoreEntries: (session as any).scoreEntries ?? [], assets: {}, photoSets: [], title: '', isDemo: false, phase: 'segment', correctPoints: session.points.correct, stealPoints: session.points.steal } as CVEventUpdate) : eventOrResult; const result = (legacy ? eventOrResult : resultArg)!;
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed) return;
  round.result = result;
  event.scoreEntries = setRoundAward(event.scoreEntries, session.segmentId, round.id, round.teamId, result === 'correct', session.points.correct);
  if (result === 'correct') event.scoreEntries = retractSteal(event.scoreEntries, session.segmentId, round.id);
  if (legacy) (session as any).scoreEntries = event.scoreEntries;
}
export function markSteal(session: CVSession, eventOrTeam: CVEventUpdate | string | null, teamArg?: string | null) {
  const legacy = typeof eventOrTeam === 'string' || eventOrTeam === null; const event = legacy ? ({ people: [], facePairs: [], teams: [], scoreEntries: (session as any).scoreEntries ?? [], assets: {}, photoSets: [], title: '', isDemo: false, phase: 'segment', correctPoints: session.points.correct, stealPoints: session.points.steal } as CVEventUpdate) : eventOrTeam; const teamId = legacy ? eventOrTeam as string | null : teamArg;
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed || round.result !== 'missed') return;
  event.scoreEntries = setStealAward(event.scoreEntries, session.segmentId, round.id, round.teamId, teamId ?? null, session.points.steal);
  if (legacy) (session as any).scoreEntries = event.scoreEntries;
}
export function moveRound(session: CVSession, delta: number) {
  const next = session.game.currentRoundIndex + delta;
  if (next >= 0 && next < session.game.rounds.length) session.game.currentRoundIndex = next;
  else if (next === session.game.rounds.length && session.game.rounds.every(r => r.result !== null)) session.phase = 'finale';
}
