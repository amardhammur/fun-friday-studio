import { beforeAll, describe, expect, it } from 'vitest';
import { createEvent, activityEvent, eventDraft } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import { discoverActivities } from '../../src/core/registry';

beforeAll(discoverActivities);
const populated = () => {
  const event = createEvent();
  return { ...event, playersInitialized: true, players: [{ id: 'p1', name: 'Asha' }, { id: 'p2', name: 'Sam' }],
    teams: event.teams.map((t, i) => ({ ...t, memberIds: i === 0 ? ['p1'] : [], pinnedIds: i === 0 ? ['p1'] : [] })) };
};
describe('team roster schema', () => {
  it('F01: preserves players, unassigned players, membership and pins through reload', () => {
    const event = populated();
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('keeps roster fields in activity projections and independent drafts', () => {
    const event = populated(), view = activityEvent(event), draft = eventDraft(view);
    expect(view.players).toEqual(event.players);
    expect(draft.players).toEqual(event.players);
    expect(draft.players).not.toBe(event.players);
  });
  it('defaults new roster arrays and initialization state', () => {
    const event = validateEvent(createEvent());
    expect(event.players).toEqual([]);
    expect(event.playersInitialized).toBe(false);
    expect(event.teams.every(t => t.memberIds.length === 0 && t.pinnedIds.length === 0)).toBe(true);
  });
  it('rejects a missing player reference', () => {
    const event = populated(); event.teams[0].memberIds.push('ghost');
    expect(() => validateEvent(event)).toThrow(/player/i);
  });
  it('rejects membership in two teams or duplicate membership in one team', () => {
    const event = populated(); event.teams[1].memberIds = ['p1'];
    expect(() => validateEvent(event)).toThrow(/more than once/i);
    event.teams[1].memberIds = []; event.teams[0].memberIds.push('p1');
    expect(() => validateEvent(event)).toThrow(/more than once/i);
  });
  it('rejects a pin outside its team and duplicate pins', () => {
    const event = populated(); event.teams[0].pinnedIds = ['p2'];
    expect(() => validateEvent(event)).toThrow(/pin/i);
    event.teams[0].pinnedIds = ['p1', 'p1'];
    expect(() => validateEvent(event)).toThrow(/pin/i);
  });
  it('rejects duplicate players and dangling library links', () => {
    const event = populated(); event.players.push({ id: 'p1', name: 'Duplicate' });
    expect(() => validateEvent(event)).toThrow(/duplicate identifiers/i);
    event.players.pop(); Object.assign(event.players[0], { personId: 'missing-person' });
    expect(() => validateEvent(event)).toThrow(/library person/i);
  });
  it('rejects blank player names and trims surrounding whitespace', () => {
    const event = populated(); event.players[0].name = '  ';
    expect(() => validateEvent(event)).toThrow();
    event.players[0].name = '  Asha  ';
    expect(validateEvent(event).players[0].name).toBe('Asha');
  });
});
