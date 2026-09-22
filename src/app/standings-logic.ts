import { segmentScore, teamScore } from '../core/scoring';
import type { EventSession } from '../core/types';

export function segmentStandings(event: EventSession, segmentId: string) {
  return event.teams
    .map(team => ({ id: team.id, name: team.name, color: team.color, total: teamScore(event.scoreEntries, team.id), gained: segmentScore(event.scoreEntries, segmentId, team.id) }))
    .sort((a, b) => b.total - a.total);
}

export function advanceSegment(event: EventSession) {
  const segment = event.segments[event.currentSegmentIndex];
  if (segment) segment.status = 'done';
  const next = event.currentSegmentIndex + 1;
  if (next < event.segments.length) {
    event.currentSegmentIndex = next;
    event.segments[next].status = 'setup';
    event.phase = 'segment';
    return;
  }
  event.phase = event.wager?.question.trim() ? 'wager' : 'finale';
}
