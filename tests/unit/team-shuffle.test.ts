import { describe, expect, it } from 'vitest';
import { newTeams } from '../../src/core/event';
import { pinBalanceIssue, resizeTeams, shuffleTeams } from '../../src/core/teams/shuffle';
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

describe('team shuffle', () => {
  it('assigns every player once with balanced sizes and preserves team identity', () => {
    const teams = newTeams(), before = structuredClone(teams);
    const result = shuffleTeams(players(13), teams, seeded(7));
    expect(result.map(t => t.memberIds.length).sort()).toEqual([2, 2, 3, 3, 3]);
    expect(result.flatMap(t => t.memberIds).sort()).toEqual(players(13).map(p => p.id).sort());
    expect(result.map(({ id, name, color }) => ({ id, name, color }))).toEqual(teams.map(({ id, name, color }) => ({ id, name, color })));
    expect(teams).toEqual(before);
  });
  it('places pins before dealing and fills the smallest teams', () => {
    const teams = newTeams(); teams[0].memberIds = ['p0', 'p1', 'p2']; teams[0].pinnedIds = ['p0', 'p1', 'p2'];
    const result = shuffleTeams(players(15), teams, seeded(1));
    expect(result[0].memberIds).toEqual(['p0', 'p1', 'p2']);
    expect(result[0].pinnedIds).toEqual(['p0', 'p1', 'p2']);
    expect(result.map(t => t.memberIds.length)).toEqual([3, 3, 3, 3, 3]);
  });
  it('reproduces seeded runs and uses new randomness on another shuffle', () => {
    const teams = newTeams();
    expect(shuffleTeams(players(16), teams, seeded(21))).toEqual(shuffleTeams(players(16), teams, seeded(21)));
    expect(shuffleTeams(players(16), teams, seeded(22))).not.toEqual(shuffleTeams(players(16), teams, seeded(21)));
  });
  it('rejects impossible pins atomically', () => {
    const teams = newTeams(); teams[0].memberIds = ['p0', 'p1', 'p2']; teams[0].pinnedIds = ['p0', 'p1', 'p2'];
    const before = structuredClone(teams);
    expect(pinBalanceIssue(players(8), teams)).toMatch(/unpin/i);
    expect(() => shuffleTeams(players(8), teams)).toThrow(/balance/i);
    expect(teams).toEqual(before);
  });
  it('rejects too many pinned teams requiring the extra slot', () => {
    const teams = newTeams();
    teams[0].memberIds = teams[0].pinnedIds = ['p0', 'p1', 'p2'];
    teams[1].memberIds = teams[1].pinnedIds = ['p3', 'p4', 'p5'];
    expect(() => shuffleTeams(players(9), teams)).toThrow(/balance/i);
  });
  it('handles a single player with eight teams and empty rosters', () => {
    const teams = resizeTeams(newTeams(), 8);
    expect(shuffleTeams(players(1), teams).map(t => t.memberIds.length)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(shuffleTeams([], teams).every(t => !t.memberIds.length)).toBe(true);
  });
  it('keeps existing identities and adds/removes from the end', () => {
    const teams = newTeams(), expanded = resizeTeams(teams, 7, false, (() => { let i = 0; return () => `new-${++i}`; })());
    expect(expanded.slice(0, 5)).toEqual(teams);
    expect(expanded.slice(5).map(t => t.id)).toEqual(['new-1', 'new-2']);
    expect(resizeTeams(expanded, 2)).toEqual(teams.slice(0, 2));
    expect(teams).toHaveLength(5);
    expect(() => resizeTeams(teams, 1)).toThrow(/2.*8/);
    expect(() => resizeTeams(teams, 9)).toThrow(/2.*8/);
  });
  it('names the default teams after the five elements, each in its own colour', () => {
    const teams = newTeams();
    expect(teams.map(t => t.name)).toEqual(['Earth', 'Water', 'Air', 'Fire', 'Space']);
    expect(new Set(teams.map(t => t.color)).size).toBe(5);
  });
  it('adds the next unused element name before falling back to numbered teams', () => {
    const renamed = newTeams().slice(0, 2); renamed[0].name = 'Earth Movers';
    expect(resizeTeams(renamed, 4).map(t => t.name)).toEqual(['Earth Movers', 'Water', 'Earth', 'Air']);
    const eight = resizeTeams(newTeams(), 8);
    expect(eight.map(t => t.name)).toEqual(['Earth', 'Water', 'Air', 'Fire', 'Space', 'Team 6', 'Team 7', 'Team 8']);
    expect(new Set(eight.map(t => t.color)).size).toBe(8);
  });
  it('requires confirmation to remove a team with pins', () => {
    const teams = newTeams(); teams[3].memberIds = teams[3].pinnedIds = ['p0'];
    expect(() => resizeTeams(teams, 3)).toThrow(/confirm/i);
    expect(teams[3].memberIds).toEqual(['p0']);
    expect(resizeTeams(teams, 3, true)).toEqual(teams.slice(0, 3));
  });
});
