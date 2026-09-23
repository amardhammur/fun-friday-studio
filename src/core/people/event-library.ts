import { activitySegment } from '../event';
import { getActivity } from '../registry';
import type { EventSession, EventUpdate } from '../types';
import type { ImportedFacePairs } from '../transfer';

export function prepareSegmentPeople(event: EventSession, index = 0) {
  const segment = event.segments[index], status = segment.status;
  const view = activitySegment(event, index), shared: EventUpdate = { title: event.title, isDemo: event.isDemo, phase: event.phase, wager: event.wager, correctPoints: event.correctPoints, stealPoints: event.stealPoints, people: event.people, facePairs: event.facePairs, teams: event.teams, scoreEntries: event.scoreEntries, assets: event.assets, photoSets: event.photoSets };
  getActivity(segment.activityId)?.preparePeople?.(view, shared);
  segment.settings = view.settings; segment.game = view.game; segment.setupStepId = view.setupStepId;
  Object.assign(event, shared);
  segment.status = status;
}

const STARTED: EventSession['segments'][number]['status'][] = ['play', 'finale', 'done'];
// Once any activity has run, people are shared history. The demo is throwaway, so it never locks.
export const libraryLocked = (event: EventSession) => !event.isDemo && event.segments.some(segment => STARTED.includes(segment.status));

// Clears scores, bets and every activity's game, keeping the line-up, settings, teams and people.
export function resetEventProgress(event: EventSession) {
  event.scoreEntries = []; event.isDemo = false;
  if (event.wager) event.wager.bets = {};
  event.currentSegmentIndex = 0;
  event.phase = event.phase === 'lineup' || !event.segments.length ? 'lineup' : 'segment';
  event.segments.forEach((segment, index) => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`Activity not installed: ${segment.activityId}`);
    segment.game = activity.createInitialState();
    segment.status = index === 0 && event.phase === 'segment' ? 'setup' : 'pending';
    segment.setupStepId = activity.setupSteps[0].id;
    prepareSegmentPeople(event, index);
  });
}
export function leaveDemo(event: EventSession) { if (event.isDemo) resetEventProgress(event); }

// Replacing shared identities invalidates every activity, including completed ones.
export function replaceEventPeople(event: EventSession, imported: ImportedFacePairs) {
  event.assets = imported.assets; event.photoSets = imported.photoSets; event.facePairs = imported.facePairs; event.people = imported.people;
  resetEventProgress(event);
}
export function addEventPeople(event: EventSession, imported: ImportedFacePairs) {
  if (libraryLocked(event)) throw new Error('The roster is locked after an activity starts. Replace the library to start over.');
  leaveDemo(event);
  Object.assign(event.assets, imported.assets);
  event.photoSets.push(...imported.photoSets); event.facePairs.push(...imported.facePairs); event.people.push(...imported.people);
}
