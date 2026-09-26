import { describe, expect, it } from 'vitest';
import type { Person, Player, Team } from '../../src/core/types';
import { allocateRounds } from '../../activities/childhood-vs-now/logic/rounds';

function fixture(owners: number[], count: number) {
  const people: Person[] = owners.map((_, i) => ({ id: `person-${i}`, name: `Person ${i}`, funFact: '', included: true, facePairId: `face-${i}` }));
  const players: Player[] = owners.map((_, i) => ({ id: `player-${i}`, name: `Player ${i}`, personId: people[i].id }));
  const teams: Team[] = Array.from({ length: count }, (_, i) => ({ id: `team-${i}`, name: `Team ${i}`, color: '#ffffff', memberIds: players.filter((_, p) => owners[p] === i).map(p => p.id), pinnedIds: [] }));
  return { people, players, teams };
}
const own = (rounds: ReturnType<typeof allocateRounds>, owners: number[]) => rounds.filter(r => r.teamId === `team-${owners[+r.personId.split('-')[1]]}`).length;

describe('team-aware childhood photo allocation', () => {
  it('avoids all own-member photos while retaining balanced team quotas', () => {
    const owners = [0, 0, 1, 1, 2, 2, 3, 3], { people, teams, players } = fixture(owners, 4);
    const rounds = allocateRounds(people, teams, false, Math.random, players);
    expect(own(rounds, owners)).toBe(0);
    expect(teams.map(t => rounds.filter(r => r.teamId === t.id).length)).toEqual([2, 2, 2, 2]);
    expect(new Set(rounds.map(r => r.personId)).size).toBe(8);
  });
  it('finds the zero-conflict assignment when a greedy deal would consume the needed slots', () => {
    const owners = [-1, -1, 1, 1], { people, teams, players } = fixture(owners, 2);
    const rounds = allocateRounds(people, teams, false, Math.random, players);
    expect(own(rounds, owners)).toBe(0);
    expect(rounds.filter(r => r.teamId === 'team-0').map(r => r.personId).sort()).toEqual(['person-2', 'person-3']);
  });
  it('falls back to the minimum unavoidable own-member count without dropping photos', () => {
    const owners = [0, 0, 0, 0, 0, 0, 1], { people, teams, players } = fixture(owners, 3);
    const rounds = allocateRounds(people, teams, true, () => .25, players);
    expect(own(rounds, owners)).toBe(2);
    expect(teams.map(t => rounds.filter(r => r.teamId === t.id).length)).toEqual([3, 2, 2]);
    expect(rounds.map(r => r.personId).sort()).toEqual(people.map(p => p.id).sort());
  });
  it('matches the optimal count for every four-person ownership pattern across three teams', () => {
    // All legal quota [2,1,1] assignments, independently enumerated.
    const options: number[][] = [];
    for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) if (b !== c) options.push(Array.from({ length: 4 }, (_, i) => i === b ? 1 : i === c ? 2 : 0));
    for (let pattern = 0; pattern < 256; pattern++) {
      const owners = [0, 1, 2, 3].map(i => ((pattern >> (2 * i)) & 3) - 1);
      const { people, teams, players } = fixture(owners, 3);
      const rounds = allocateRounds(people, teams, false, Math.random, players);
      const minimum = Math.min(...options.map(a => a.filter((team, i) => team === owners[i]).length));
      expect(own(rounds, owners), `ownership: ${owners}`).toBe(minimum);
      expect(new Set(rounds.map(r => r.personId)).size).toBe(4);
    }
  });
  it('leaves no-members allocation exactly as before, including seeded shuffle ordering', () => {
    const { people, teams } = fixture([-1, -1, -1, -1, -1], 2);
    expect(allocateRounds(people, teams, false).map(r => [r.personId, r.teamId])).toEqual([
      ['person-0', 'team-0'], ['person-1', 'team-0'], ['person-2', 'team-0'], ['person-3', 'team-1'], ['person-4', 'team-1'],
    ]);
    expect(allocateRounds(people, teams, true, () => 0).map(r => r.personId)).toEqual(['person-1', 'person-2', 'person-3', 'person-4', 'person-0']);
  });
  it('N03: each activity still uses every included person exactly once', () => {
    const { people, teams, players } = fixture([0, 0, 1, 1, 2, 2, 3, 3], 4);
    people[0].included = false;
    for (const random of [() => .25, () => .75]) {
      const rounds = allocateRounds(people, teams, true, random, players);
      expect(rounds.map(r => r.personId).sort()).toEqual(['person-1', 'person-2', 'person-3', 'person-4', 'person-5', 'person-6', 'person-7']);
    }
  });
  it('handles the 500-person library limit with uneven quotas', () => {
    const owners = Array.from({ length: 500 }, (_, i) => i % 8), { people, teams, players } = fixture(owners, 8);
    const rounds = allocateRounds(people, teams, false, Math.random, players);
    expect(own(rounds, owners)).toBe(0);
    expect(teams.map(t => rounds.filter(r => r.teamId === t.id).length)).toEqual([63, 63, 63, 63, 62, 62, 62, 62]);
  });
});
