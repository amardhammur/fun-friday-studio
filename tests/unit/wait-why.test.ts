import { expect, it } from 'vitest';
import { waitWhy } from '../../activities/wait-why/activity';
import { advance, reveal, toggleAward, holdClock, releaseClock } from '../../activities/wait-why/logic';
import { puzzles } from '../../activities/wait-why/content';
import { createEvent, createSegment, activitySegment, eventDraft, activityEvent } from '../../src/core/event';
import { teamScore } from '../../src/core/scoring';
function game() {
  const event = createEvent(); event.segments = [createSegment(waitWhy)];
  const segment = activitySegment(event, 0) as Parameters<typeof advance>[0];
  const draft = eventDraft(activityEvent(event));
  waitWhy.startNewGame(segment, draft);
  return { segment, event: draft };
}
it('deals unique puzzles, starts on rules, and refuses to skip an unrevealed round', () => {
  const { segment } = game();
  expect(segment.game.deck).toHaveLength(8);
  expect(new Set(segment.game.deck.map(p => p.id)).size).toBe(8);
  expect(segment.game.step).toBe('rules');
  advance(segment, 1000); expect(segment.game.step).toBe('question');
  advance(segment, 2000); expect(segment.game.index).toBe(0);
  reveal(segment, 3000); advance(segment, 4000);
  expect(segment.game.index).toBe(1);
  expect(segment.game.timer.deadlineAt).toBe(64000);
});
it('awards multiple teams independently and supports undo without duplicate points', () => {
  const { segment, event } = game();
  toggleAward(segment, event, 0); expect(event.scoreEntries).toHaveLength(0);
  advance(segment); reveal(segment);
  toggleAward(segment, event, 0); toggleAward(segment, event, 1);
  expect(teamScore(event.scoreEntries, event.teams[0].id)).toBe(segment.points.correct);
  expect(teamScore(event.scoreEntries, event.teams[1].id)).toBe(segment.points.correct);
  toggleAward(segment, event, 0); toggleAward(segment, event, 0);
  expect(event.scoreEntries).toHaveLength(2);
  expect(teamScore(event.scoreEntries, event.teams[0].id)).toBe(segment.points.correct);
});
it('holds the timer across pause, serialization and resume', () => {
  const { segment } = game(); advance(segment, 1000); holdClock(segment, 11000);
  segment.game = waitWhy.stateSchema.parse(JSON.parse(JSON.stringify(segment.game)));
  releaseClock(segment, 100000);
  expect(segment.game.timer.deadlineAt).toBe(150000);
});
it('finishes only after the final reveal and clears only its own scores on restart', () => {
  const { segment, event } = game(); advance(segment);
  for (let i = 0; i < 8; i++) { reveal(segment); toggleAward(segment, event, 0); advance(segment); }
  expect(segment.phase).toBe('finale');
  event.scoreEntries.push({ id: 'other', teamId: event.teams[0].id, segmentId: 'other', kind: 'manual-adjustment', points: 9, active: true });
  waitWhy.startNewGame(segment, event);
  expect(event.scoreEntries.map(e => e.id)).toEqual(['other']);
});
it('has at least fifteen complete puzzles and rejects invalid saved positions', () => {
  expect(puzzles.length).toBeGreaterThanOrEqual(15);
  expect(new Set(puzzles.map(p => p.id)).size).toBe(puzzles.length);
  for (const p of puzzles) { expect(p.options).toHaveLength(3); expect(p.options[p.answer]).toBeTruthy(); expect(p.explanation.length).toBeGreaterThan(30); }
  const { segment } = game(); segment.game.index = 100;
  expect(waitWhy.stateSchema.safeParse(segment.game).success).toBe(false);
});
