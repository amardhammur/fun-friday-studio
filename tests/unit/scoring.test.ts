import { describe, expect, it } from 'vitest';
import { setRoundAward, standings, teamScore } from '../../src/core/scoring';
import { allocateRounds, markResult, startNewGame } from '../../activities/childhood-vs-now/logic/rounds';
import type { Person, Team, ScoreEntry } from '../../src/core/types';
import type { CVSession } from '../../activities/childhood-vs-now/types';
const teams: Team[] = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, color: '#ffffff' }));
const people: Person[] = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, facePairId: `f${i}`, included: true, funFact: '' }));
describe('single-point scoring', () => {
  it('awards exactly one point and is idempotent', () => {
    let entries = setRoundAward([], 'r1', 't0', true);
    entries = setRoundAward(entries, 'r1', 't0', true);
    expect(teamScore(entries, 't0')).toBe(1); expect(entries).toHaveLength(1);
  });
  it('can change correct to missed and back without drift', () => {
    let entries = setRoundAward([], 'r1', 't0', true);
    entries = setRoundAward(entries, 'r1', 't0', false); expect(teamScore(entries, 't0')).toBe(0);
    entries = setRoundAward(entries, 'r1', 't0', true); expect(teamScore(entries, 't0')).toBe(1);
  });
  it('combines independent awards and manual adjustments', () => {
    const entries: ScoreEntry[] = [...setRoundAward([], 'r1', 't0', true), { id: 'm', teamId: 't0', kind: 'manual-adjustment', points: -1, active: true }];
    expect(teamScore(entries, 't0')).toBe(0); expect(standings(teams, entries).map(t => t.score)).toEqual([0, 0, 0, 0]);
  });
  it('prevents scoring before reveal and only credits the assigned team', () => {
    const s = { game: { rounds: allocateRounds(people, teams, false), currentRoundIndex: 0 }, scoreEntries: [] } as unknown as CVSession;
    markResult(s, 'correct'); expect(s.scoreEntries).toEqual([]);
    s.game.rounds[0].revealed = true; markResult(s, 'correct'); expect(teamScore(s.scoreEntries, 't0')).toBe(1); expect(teamScore(s.scoreEntries, 't1')).toBe(0);
  });
});
describe('non-repeating team sets', () => {
  it('splits 50 photos into 13,13,12,12 consecutive team sets', () => {
    const rounds = allocateRounds(people, teams, false);
    expect(rounds).toHaveLength(50); expect(new Set(rounds.map(r => r.personId)).size).toBe(50);
    expect(teams.map(t => rounds.filter(r => r.teamId === t.id).length)).toEqual([13, 13, 12, 12]);
    expect(rounds.slice(0, 13).every(r => r.teamId === 't0')).toBe(true);
    expect(rounds.slice(13, 26).every(r => r.teamId === 't1')).toBe(true);
  });
  it('shuffles each person once and omits excluded people', () => {
    const rounds = allocateRounds(people.map((p, i) => ({ ...p, included: i !== 0 })), teams, true, () => .42);
    expect(rounds).toHaveLength(49); expect(new Set(rounds.map(r => r.personId)).size).toBe(49); expect(rounds.some(r => r.personId === 'p0')).toBe(false);
  });
  it('handles empty sets', () => { expect(allocateRounds([], teams, false)).toEqual([]); expect(allocateRounds(people, [], false)).toEqual([]); });
  it('requires included people and names before a new game', () => {
    expect(() => startNewGame({ people: [] } as unknown as CVSession)).toThrow('Include');
    expect(() => startNewGame({ people: [{ ...people[0], name: '' }] } as unknown as CVSession)).toThrow('name');
  });
});
