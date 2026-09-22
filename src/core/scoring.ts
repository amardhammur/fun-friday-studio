import type { ScoreEntry, Team } from './types';
export const DEFAULT_CORRECT_POINTS = 2;
export const DEFAULT_STEAL_POINTS = 1;
export function teamScore(entries: ScoreEntry[], teamId: string) { return entries.reduce((total, entry) => total + (entry.teamId === teamId && entry.active ? entry.points : 0), 0); }
export function segmentScore(entries: ScoreEntry[], segmentId: string, teamId: string) { return entries.reduce((total, entry) => total + (entry.segmentId === segmentId && entry.teamId === teamId && entry.active ? entry.points : 0), 0); }
export function standings(teams: Team[], entries: ScoreEntry[]) { return teams.map(team => ({ ...team, score: teamScore(entries, team.id) })).sort((a, b) => b.score - a.score); }
// Every host action writes a deterministic id and updates in place, so repeated clicks,
// refreshes, and out-of-order corrections can never double-count.
function upsert(entries: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  return entries.some(e => e.id === entry.id) ? entries.map(e => e.id === entry.id ? { ...e, ...entry } : e) : [...entries, entry];
}
export function setRoundAward(entries: ScoreEntry[], segmentId: string, roundId: string, teamId: string, correct: boolean, points = DEFAULT_CORRECT_POINTS): ScoreEntry[] {
  return upsert(entries, { id: `${segmentId}:award-${roundId}`, teamId, segmentId, roundId, kind: 'round-award', points, active: correct });
}
