import { beforeAll, describe, expect, it } from 'vitest';
import fixture from '../fixtures/event-v2.json';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { createEvent, createSegment, foldSegmentView, segmentView } from '../../src/core/event';
import { addEventPeople, clearSegmentProgress, libraryLocked, prepareSegmentPeople, replaceEventPeople, segmentPaused } from '../../src/core/people/event-library';
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
      expect(view.game.finale).toEqual({ wipePosition: 0, slideIndex: 0 });
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
  it('keeps configured activity videos when replacing the photo library', () => {
    const event = validateEvent(fixture), activity = getActivity('clip-to-stage')!;
    const clip = createSegment(activity);
    clip.settings = { ...activity.defaultSettings(), source: 'local', videoAssetId: 'reference-video' };
    event.segments.push(clip);
    const video = { id: 'reference-video', name: 'Song.webm', mime: 'video/webm', width: 320, height: 180 };
    event.assets[video.id] = video;
    event.assets['retired-photo'] = { id: 'retired-photo', name: 'Old.jpg', mime: 'image/jpeg', width: 10, height: 10 };
    replaceEventPeople(event, imported());
    expect(event.assets[video.id]).toEqual(video);
    expect(event.assets['retired-photo']).toBeUndefined();
    expect(event.segments[1]).toMatchObject({ status: 'pending', settings: { source: 'local', videoAssetId: video.id } });
    expect(() => validateEvent(JSON.parse(JSON.stringify(event)))).not.toThrow();
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
  it('appends sets, pairs and people on an unlocked event', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    (event.segments[0].game as any).rounds[0] = { ...(event.segments[0].game as any).rounds[0], revealed: false, result: null };
    event.scoreEntries = [];
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
  it('adding to a demo event keeps both the old and new people and leaves the demo', () => {
    const event = validateEvent(fixture); event.isDemo = true;
    addEventPeople(event, extra());
    expect(event.people.map(p => p.name)).toEqual(['Asha', 'Priya']);
    expect(event.photoSets.map(s => s.name)).toEqual(['Group 1', 'Design']);
    expect(event.isDemo).toBe(false);
    expect(event.scoreEntries).toEqual([]);
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  // Pause returns a running game to setup; its rounds are already fixed, so the roster must stay put.
  it('stays locked while a started activity is paused in setup', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    expect(libraryLocked(event)).toBe(true);
    expect(() => addEventPeople(event, extra())).toThrow(/locked/);
  });
  it('counts a scored round as progress even before anything else is revealed', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    (event.segments[0].game as any).rounds[0] = { ...(event.segments[0].game as any).rounds[0], revealed: false, result: null };
    expect(libraryLocked(event)).toBe(true);
  });
  it('unlocks a paused activity once nothing in it has been played', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    (event.segments[0].game as any).rounds[0] = { ...(event.segments[0].game as any).rounds[0], revealed: false, result: null };
    event.scoreEntries = [];
    expect(libraryLocked(event)).toBe(false);
  });
  it('locks while a paused act-it-out game has progress', () => {
    const event = validateEvent(fixture), activity = getActivity('act-it-out')!;
    const segment = createSegment(activity); event.segments = [segment]; event.scoreEntries = [];
    expect(libraryLocked(event)).toBe(false);
    (segment.game as any).cursor = 1;
    expect(libraryLocked(event)).toBe(true);
  });
  it('never locks the demo', () => {
    const event = validateEvent(fixture); event.isDemo = true;
    expect(libraryLocked(event)).toBe(false);

  });
});

describe('pausing an activity', () => {
  it('is paused only while back in setup with progress', () => {
    const event = validateEvent(fixture);
    expect(segmentPaused(event, 0)).toBe(false);
    event.segments[0].status = 'setup';
    expect(segmentPaused(event, 0)).toBe(true);
  });
  it('start over clears only this activity and unlocks the roster when nothing else was played', () => {
    const event = validateEvent(fixture), other = structuredClone(event.segments[0]);
    other.id = 'other'; other.status = 'pending'; event.segments.push(other);
    event.scoreEntries.push({ ...event.scoreEntries[0], id: 'other-award', segmentId: 'other' });
    event.segments[0].status = 'setup';
    clearSegmentProgress(event, 0);
    expect(event.segments[0]).toMatchObject({ status: 'setup', setupStepId: 'game' });
    expect((event.segments[0].game as any).rounds).toEqual([]);
    expect(event.scoreEntries.map(e => e.segmentId)).toEqual(['other']);
    expect(segmentPaused(event, 0)).toBe(false);
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
});
