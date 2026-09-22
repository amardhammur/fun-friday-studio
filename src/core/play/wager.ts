import { teamScore } from '../scoring';
import type { ScoreEntry } from '../types';

export const WAGER_FLOOR = 5;

export const maxWager = (entries: ScoreEntry[], teamId: string) => Math.max(teamScore(entries, teamId), WAGER_FLOOR);
export const clampWager = (entries: ScoreEntry[], teamId: string, bet: number) => Math.max(0, Math.min(Math.round(bet) || 0, maxWager(entries, teamId)));

export function setWagerResult(entries: ScoreEntry[], teamId: string, bet: number, correct: boolean): ScoreEntry[] {
  const id = `wager-${teamId}`;
  const withoutWager = entries.filter(e => e.id !== id);
  const points = correct ? clampWager(withoutWager, teamId, bet) : -clampWager(withoutWager, teamId, bet);
  return [...withoutWager, { id, teamId, kind: 'wager', points, active: true }];
}
