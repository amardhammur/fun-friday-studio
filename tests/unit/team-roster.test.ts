import { beforeAll, describe, expect, it } from 'vitest';
import { createEvent, createSegment } from '../../src/core/event';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { libraryLocked, replaceEventPeople } from '../../src/core/people/event-library';
import { addPlayers, initializePlayers, movePlayer, pullPlayers, removePlayer, setTeamCount, shuffleRoster, syncPlayers, togglePin } from '../../src/core/teams/roster';
import { lineupIssues } from '../../src/app/lineup-logic';
import { validateEvent } from '../../src/core/session';
import fixture from '../fixtures/event-v2.json';

beforeAll(discoverActivities);
const withPeople = () => { const e = validateEvent(fixture); e.phase = 'lineup'; e.segments = []; e.scoreEntries = []; return e; };
describe('event player roster', () => {
  it('prefills included library people once and an empty roster stays empty', () => {
    const e = withPeople(); initializePlayers(e);
    expect(e.players.map(p => [p.name, p.personId])).toEqual([['Asha', 'p1']]);
    const id = e.players[0].id; removePlayer(e, id); initializePlayers(e);
    expect(e.players).toEqual([]);
    const restored = validateEvent(JSON.parse(JSON.stringify(e))); initializePlayers(restored);
    expect(restored.players).toEqual([]);
    pullPlayers(restored); pullPlayers(restored);
    expect(restored.players).toHaveLength(1);
  });
  it('N02: pastes trimmed lines without blanks or case-insensitive duplicates, preserving commas', () => {
    const e = withPeople(); initializePlayers(e);
    addPlayers(e, ' Asha\r\n Sam \n\n sam\nDhammur, Amar\n José ');
    expect(e.players.map(p => p.name)).toEqual(['Asha', 'Sam', 'Dhammur, Amar', 'José']);
    expect(validateEvent(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
  it('updates linked names, survives blank library edits, and prunes excluded memberships and pins', () => {
    const e = withPeople(); initializePlayers(e); const id = e.players[0].id;
    movePlayer(e, id, e.teams[0].id); togglePin(e, id);
    e.people[0].name = '  Priya  '; syncPlayers(e);
    expect(e.players[0].name).toBe('Priya');
    e.people[0].name = ' '; syncPlayers(e);
    expect(validateEvent(e).players[0].name).toBe('Priya');
    e.people[0].included = false; syncPlayers(e);
    expect(e.players).toEqual([]); expect(e.teams[0].memberIds).toEqual([]); expect(e.teams[0].pinnedIds).toEqual([]);
  });
  it('uses a valid placeholder for unnamed included people and does not merge distinct people sharing a name', () => {
    const e = withPeople(); e.people[0].name = ''; initializePlayers(e);
    expect(e.players[0].name).toMatch(/^Person /);
    e.people[0].name = 'Sam'; e.people.push({ ...e.people[0], id: 'other' }); pullPlayers(e); syncPlayers(e);
    expect(e.players.map(p => p.name)).toEqual(['Sam', 'Sam']);
  });
  it('removing a roster player leaves the library and photos unchanged', () => {
    const e = withPeople(); initializePlayers(e);
    const before = structuredClone({ people: e.people, facePairs: e.facePairs, assets: e.assets });
    removePlayer(e, e.players[0].id); syncPlayers(e);
    expect({ people: e.people, facePairs: e.facePairs, assets: e.assets }).toEqual(before);
    expect(e.players).toEqual([]);
  });
  it('moves a pinned player only once and clears the pin when unassigned', () => {
    const e = withPeople(); initializePlayers(e); const id = e.players[0].id;
    movePlayer(e, id, e.teams[0].id); togglePin(e, id); movePlayer(e, id, e.teams[1].id);
    expect(e.teams[0].memberIds).toEqual([]); expect(e.teams[0].pinnedIds).toEqual([]);
    expect(e.teams[1].memberIds).toEqual([id]); expect(e.teams[1].pinnedIds).toEqual([id]);
    movePlayer(e, id); expect(e.teams[1].memberIds).toEqual([]); expect(e.teams[1].pinnedIds).toEqual([]);
  });
  it('library replacement removes linked players and preserves extra arrivals', () => {
    const e = withPeople(); initializePlayers(e); addPlayers(e, 'Extra', e.teams[0].id);
    replaceEventPeople(e, { people: [], facePairs: [], photoSets: [], assets: {} });
    expect(e.players.map(p => p.name)).toEqual(['Extra']);
    expect(validateEvent(e)).toEqual(e);
  });
  it('locks shuffle/removal/moves/pins/count and permits a late arrival directly onto a team', () => {
    const e = withPeople(); initializePlayers(e); const id = e.players[0].id;
    const segment = createSegment(getActivity('act-it-out')!); segment.status = 'play'; e.segments = [segment];
    expect(libraryLocked(e)).toBe(true);
    for (const action of [() => shuffleRoster(e), () => removePlayer(e, id), () => movePlayer(e, id, e.teams[0].id), () => togglePin(e, id), () => setTeamCount(e, 4), () => pullPlayers(e), () => addPlayers(e, 'Late')]) expect(action).toThrow();
    const before = structuredClone({ segments: e.segments, scores: e.scoreEntries });
    addPlayers(e, 'Late', e.teams[0].id);
    expect(e.teams[0].memberIds).toEqual([e.players.find(p => p.name === 'Late')!.id]);
    expect({ segments: e.segments, scores: e.scoreEntries }).toEqual(before);
  });
  it('warns about unassigned players without blocking a valid lineup', () => {
    const e = createEvent(); e.segments = [createSegment(getActivity('act-it-out')!)]; addPlayers(e, 'Sam');
    const issues = lineupIssues(e);
    expect(issues).toEqual([{ severity: 'warning', message: '1 player is not on a team.' }]);
    movePlayer(e, e.players[0].id, e.teams[0].id); expect(lineupIssues(e)).toEqual([]);
  });
});
