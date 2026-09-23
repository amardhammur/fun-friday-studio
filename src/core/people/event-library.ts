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

// Replacing shared identities invalidates every activity, including completed ones.
export function replaceEventPeople(event: EventSession, imported: ImportedFacePairs) {
  event.assets = imported.assets; event.photoSets = imported.photoSets; event.facePairs = imported.facePairs; event.people = imported.people;
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
