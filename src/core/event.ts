import type { Activity, AnySession, EventSession, Segment } from './types';
export type { EventSession } from './types';
export const teamColors = ['#f7d873', '#eea7bb', '#8fcbe0', '#9edbbd', '#d2b5f2', '#f0b085', '#b8d685', '#c2c9ed'];
export const newTeams = () => ['Coffee Breakers', 'Reply-All Crew', 'Deadline Dodgers', 'Snack Drawer Squad'].map((name, i) => ({ id: crypto.randomUUID(), name, color: teamColors[i] }));
// Segment status and the phase activities read are the same vocabulary apart from
// 'pending' and 'done', which only the event itself ever sets.
const toPhase = (status: Segment['status']): AnySession['phase'] => status === 'pending' ? 'setup' : status === 'done' ? 'finale' : status;
export function createSegment(activity: Activity): Segment {
  return { id: crypto.randomUUID(), activityId: activity.id, activityVersion: activity.version, title: activity.name, settings: activity.defaultSettings(), game: activity.createInitialState(), status: 'pending', setupStepId: activity.setupSteps[0].id, weight: 1 };
}
export function createEvent(): EventSession {
  const now = new Date().toISOString();
  return { formatVersion: 2, id: crypto.randomUUID(), title: 'Our Fun Friday', createdAt: now, updatedAt: now, isDemo: false, segments: [], currentSegmentIndex: 0, phase: 'lineup', correctPoints: 2, stealPoints: 1, people: [], facePairs: [], teams: newTeams(), scoreEntries: [], assets: {} };
}
export const currentSegment = (event: EventSession) => event.segments[event.currentSegmentIndex];
// A shallow projection: shared arrays and the segment's game object are the SAME references the
// event holds, so in-place mutation writes through. foldSegmentView exists to catch whole-field
// assignment (s.game = ..., s.people = [...], Object.assign(s, prepared)).
export function segmentView(event: EventSession, index: number): AnySession {
  const segment = event.segments[index];
  if (!segment) throw new Error('This event has no activity at that position.');
  return {
    formatVersion: 1, id: event.id, title: event.title,
    segmentId: segment.id, activityId: segment.activityId, activityVersion: segment.activityVersion,
    points: { correct: event.correctPoints * segment.weight, steal: event.stealPoints * segment.weight },
    createdAt: event.createdAt, updatedAt: event.updatedAt, isDemo: event.isDemo,
    phase: toPhase(segment.status), setupStepId: segment.setupStepId,
    settings: segment.settings, game: segment.game,
    people: event.people, facePairs: event.facePairs, teams: event.teams,
    scoreEntries: event.scoreEntries, assets: event.assets,
  };
}
// `segmentId` and `points` are derived and deliberately NOT folded back: points is the segment
// weight already applied, and writing it back would let an activity edit the event's scoring rules.
export function foldSegmentView(event: EventSession, index: number, view: AnySession) {
  const segment = event.segments[index];
  if (!segment) throw new Error('This event has no activity at that position.');
  segment.settings = view.settings; segment.game = view.game; segment.setupStepId = view.setupStepId;
  // 'pending' and 'done' are event-owned; an activity writing 'setup' must not resurrect a
  // finished segment, so only advance a segment that is already running.
  if (segment.status !== 'done') segment.status = view.phase;
  event.people = view.people; event.facePairs = view.facePairs; event.teams = view.teams;
  event.scoreEntries = view.scoreEntries; event.assets = view.assets;
  event.isDemo = view.isDemo; event.title = view.title;
}
