import { DEFAULT_STEAL_POINTS } from '../scoring';
import type { ScoreEntry } from '../types';
const stealId = (segmentId: string, roundId: string) => `${segmentId}:steal-${roundId}`;
export function stealTeamId(entries: ScoreEntry[], segmentId: string, roundId: string) {
  const entry = entries.find(e => e.id === stealId(segmentId, roundId));
  return entry?.active ? entry.teamId : undefined;
}
export function setStealAward(entries: ScoreEntry[], segmentId: string, roundId: string, ownerTeamId: string, stealingTeamId: string | null, points = DEFAULT_STEAL_POINTS): ScoreEntry[] {
  if (stealingTeamId === ownerTeamId) throw new Error('A team cannot steal its own round.');
  const id = stealId(segmentId, roundId);
  const next: ScoreEntry = { id, teamId: stealingTeamId ?? ownerTeamId, segmentId, roundId, kind: 'steal-award', points, active: stealingTeamId !== null };
  return entries.some(e => e.id === id) ? entries.map(e => e.id === id ? next : e) : [...entries, next];
}
// A steal only exists because the owning team missed. If the host corrects the owner to Correct,
// the steal must go with it, or the round pays out twice.
export function retractSteal(entries: ScoreEntry[], segmentId: string, roundId: string): ScoreEntry[] {
  return entries.map(e => e.id === stealId(segmentId, roundId) ? { ...e, active: false } : e);
}
