import type { ScoreEntry, Team } from './types';
export function teamScore(entries: ScoreEntry[], teamId: string) { return entries.reduce((total, entry) => total + (entry.teamId === teamId && entry.active ? entry.points : 0), 0); }
export function standings(teams: Team[], entries: ScoreEntry[]) { return teams.map(team => ({ ...team, score: teamScore(entries, team.id) })).sort((a, b) => b.score - a.score); }
export function setRoundAward(entries: ScoreEntry[], roundId: string, teamId: string, correct: boolean): ScoreEntry[] {
  const id = `award-${roundId}`;
  const existing = entries.find(e => e.id === id);
  if (existing) return entries.map(e => e.id === id ? { ...e, teamId, points: 1, active: correct } : e);
  return [...entries, { id, teamId, roundId, kind: 'round-award', points: 1, active: correct }];
}
