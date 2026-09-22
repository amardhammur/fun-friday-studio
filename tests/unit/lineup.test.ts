import { beforeAll, describe, expect, it } from 'vitest';
import { createEvent, createSegment } from '../../src/core/event';
import { discoverActivities, getActivities } from '../../src/core/registry';
import { estimatedMinutes, lineupIssues } from '../../src/app/lineup-logic';

beforeAll(async () => { await discoverActivities(); });

describe('line-up validation', () => {
  it('requires at least one activity', () => {
    expect(lineupIssues(createEvent())).toContain('Add at least one activity to your line-up.');
  });
  it('requires every team to be named', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    event.teams[0].name = '  ';
    expect(lineupIssues(event)).toContain('Every team needs a name.');
  });
  it('requires an answer when a wager question is written', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    event.wager = { question: 'How many biscuits?', answer: '', bets: {} };
    expect(lineupIssues(event)).toContain('Give the final wager an answer, or clear the question.');
  });
  it('accepts a complete line-up', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    expect(lineupIssues(event)).toEqual([]);
  });
  it('estimates runtime from the activities plus the standings beats', () => {
    const event = createEvent();
    const activity = getActivities()[0];
    event.segments = [createSegment(activity), createSegment(activity)];
    expect(estimatedMinutes(event)).toBe((activity.estimatedMinutes ?? 15) * 2 + 2 * 2);
  });
  it('adds the wager to the estimate only when one is set', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    const without = estimatedMinutes(event);
    event.wager = { question: 'Q', answer: 'A', bets: {} };
    expect(estimatedMinutes(event)).toBe(without + 10);
  });
});
