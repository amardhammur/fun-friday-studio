import { beforeAll, describe, expect, it } from 'vitest';
import fixture from '../fixtures/event-v2.json';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { createEvent, createSegment, foldSegmentView, segmentView } from '../../src/core/event';
import { addEventPeople, leaveDemo, libraryLocked, prepareSegmentPeople, replaceEventPeople } from '../../src/core/people/event-library';
import { validateEvent } from '../../src/core/session';
import type { ImportedFacePairs } from '../../src/core/transfer';

beforeAll(discoverActivities);
function imported(): ImportedFacePairs {
  const event = validateEvent(fixture);
  return { people: event.people, facePairs: event.facePairs, assets: event.assets, photoSets: event.photoSets };
}

describe('event people library', () => {
  it.each(['lineup', 'segment', 'interstitial', 'wager', 'finale'] as const)('replaces the library from %s and resets every segment and bet', phase => {
    const event = validateEvent(fixture), second = structuredClone(event.segments[0]);
    second.id = 'second'; second.weight = 3; event.segments.push(second);
    event.segments[0].status = 'done'; event.currentSegmentIndex = 1; event.phase = phase;
    event.wager = { question: 'Question', answer: 'Answer', bets: { [event.teams[0].id]: 5 } };
    const teams = structuredClone(event.teams), settings = structuredClone(second.settings);
    replaceEventPeople(event, imported());
    expect(event.currentSegmentIndex).toBe(0);
    expect(event.phase).toBe(phase === 'lineup' ? 'lineup' : 'segment');
    expect(event.scoreEntries).toEqual([]);
    expect(event.wager).toEqual({ question: 'Question', answer: 'Answer', bets: {} });
    expect(event.teams).toEqual(teams);
    expect(event.segments[1]).toMatchObject({ id: 'second', settings, weight: 3, status: 'pending' });
    event.segments.forEach((_, i) => {
      const view = segmentView(event, i);
      expect(view.game.rounds).toEqual([]);
      expect(view.game.finale).toEqual({ wipePosition: 0 });
    });
    expect(event.segments[0].game).not.toBe(event.segments[1].game);
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('imports before any activities exist and prepares a later activity from shared people', () => {
    const event = createEvent(); replaceEventPeople(event, imported());
    expect(event.segments).toEqual([]); expect(event.phase).toBe('lineup');
    event.segments.push(createSegment(getActivity('childhood-vs-now')!));
    prepareSegmentPeople(event, 0);
    expect(event.segments[0].status).toBe('pending');
    expect(event.photoSets[0].nowImageId).toBe(event.facePairs[0].now!.sourceImageId);
    expect(validateEvent(event)).toEqual(event);
  });
  it('starting and restarting a segment keeps earlier awards and clears only its own awards', () => {
    const event = validateEvent(fixture), activity = getActivity('childhood-vs-now')!;
    const earlier = structuredClone(event.scoreEntries);
    event.segments.push(createSegment(activity)); prepareSegmentPeople(event, 1);
    const view = segmentView(event, 1);
    view.scoreEntries.push({ id: 'old-second', segmentId: view.segmentId, teamId: event.teams[0].id, kind: 'steal-award', points: 1, active: true });
    activity.startNewGame(view); foldSegmentView(event, 1, view);
    expect(event.scoreEntries).toEqual(earlier);
    expect(view.game.rounds).toHaveLength(1);
    expect(validateEvent(event)).toEqual(event);
  });
});

describe('adding to the people library', () => {
  const extra = (): ImportedFacePairs => {
    const source = imported();
    const set = { ...source.photoSets[0], id: 'set-2', name: 'Design', order: 1 };
    const pair = { ...source.facePairs[0], id: 'pair-2', number: 2, setId: 'set-2' };
    return { assets: {}, photoSets: [set], facePairs: [pair], people: [{ ...source.people[0], id: 'person-2', facePairId: 'pair-2', name: 'Priya' }] };
  };
  it('appends sets, pairs and people and keeps progress on an unlocked event', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    const scores = structuredClone(event.scoreEntries);
    addEventPeople(event, extra());
    expect(event.photoSets.map(s => s.name)).toEqual(['Group 1', 'Design']);
    expect(event.people.map(p => p.name)).toEqual(['Asha', 'Priya']);
    expect(event.scoreEntries).toEqual(scores);
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('refuses to add once an activity has started', () => {
    const event = validateEvent(fixture);
    expect(libraryLocked(event)).toBe(true);
    expect(() => addEventPeople(event, extra())).toThrow(/locked/);
  });
  it('never locks the demo, and leaving the demo resets progress but keeps the people', () => {
    const event = validateEvent(fixture); event.isDemo = true;
    expect(libraryLocked(event)).toBe(false);
    leaveDemo(event);
    expect(event.isDemo).toBe(false);
    expect(event.scoreEntries).toEqual([]);
    expect(event.segments[0].status).toBe('setup');
    expect(event.people).toHaveLength(1);
    expect(libraryLocked(event)).toBe(false);
  });
});
