import type { EventSession } from './types';

const retired = new Set(['wait-why', 'real-or-ridiculous']);

/** Strip removed games when restoring a saved event or importing a session ZIP. */
export function removeRetiredActivities(event: EventSession) {
  const original = event.segments;
  const removedIds = new Set(original.filter(s => retired.has(s.activityId)).map(s => s.id));
  if (!removedIds.size) return;
  const cursor = event.currentSegmentIndex;
  const surviving = original.map((segment, index) => ({ segment, index })).filter(({ segment }) => !retired.has(segment.activityId));
  event.segments = surviving.map(({ segment }) => segment);
  event.scoreEntries = event.scoreEntries.filter(entry => !entry.segmentId || !removedIds.has(entry.segmentId));

  if (!surviving.length) {
    event.currentSegmentIndex = 0; event.phase = 'lineup';
    return;
  }
  const current = surviving.findIndex(({ index }) => index === cursor);
  if (current >= 0) { event.currentSegmentIndex = current; return; }

  const next = surviving.findIndex(({ index }) => index > cursor);
  event.currentSegmentIndex = next >= 0 ? next : surviving.length - 1;
  if (event.phase !== 'segment' && event.phase !== 'interstitial') return;
  if (next >= 0) {
    if (event.segments[next].status === 'pending') event.segments[next].status = 'setup';
    event.phase = 'segment';
  } else event.phase = 'interstitial';
}
