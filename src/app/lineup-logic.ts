import { getActivity } from '../core/registry';
import type { EventSession } from '../core/types';

const DEFAULT_ACTIVITY_MINUTES = 15;
const INTERSTITIAL_MINUTES = 2;
const WAGER_MINUTES = 10;

export interface LineupIssue { severity: 'error' | 'warning'; message: string }
export function lineupIssues(event: EventSession): LineupIssue[] {
  const issues: string[] = [];
  if (!event.segments.length) issues.push('Add at least one activity to your line-up.');
  if (event.segments.some(s => !getActivity(s.activityId))) issues.push('One activity in your line-up is not installed.');
  if (event.teams.some(t => !t.name.trim())) issues.push('Every team needs a name.');
  if (event.wager?.question.trim() && !event.wager.answer.trim()) issues.push('Give the final wager an answer, or clear the question.');
  const result: LineupIssue[] = issues.map(message => ({ severity: 'error', message }));
  const assigned = new Set(event.teams.flatMap(t => t.memberIds));
  const unassigned = event.players.filter(p => !assigned.has(p.id)).length;
  if (unassigned) result.push({ severity: 'warning', message: `${unassigned} ${unassigned === 1 ? 'player is' : 'players are'} not on a team.` });
  return result;
}

export function estimatedMinutes(event: EventSession): number {
  const activities = event.segments.reduce((total, segment) => total + (getActivity(segment.activityId)?.estimatedMinutes ?? DEFAULT_ACTIVITY_MINUTES), 0);
  return activities + event.segments.length * INTERSTITIAL_MINUTES + (event.wager?.question.trim() ? WAGER_MINUTES : 0);
}
