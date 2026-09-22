import { describe, expect, it } from 'vitest';
import { pauseTimer, remainingMs, resetTimer, startTimer, type TimerState } from '../../src/core/play/timer';

const fresh: TimerState = { durationMs: 60_000 };

describe('countdown timer state', () => {
  it('persists a deadline rather than a tick', () => {
    const started = startTimer(fresh, 1_000);
    expect(started.deadlineAt).toBe(61_000);
    expect(started).not.toHaveProperty('elapsedMs');
  });
  it('reports the remaining time from the deadline so a refresh restores it', () => {
    const started = startTimer(fresh, 1_000);
    expect(remainingMs(started, 21_000)).toBe(40_000);
  });
  it('never reports below zero', () => {
    expect(remainingMs(startTimer(fresh, 0), 90_000)).toBe(0);
  });
  it('holds the remaining time across a pause and resumes from it', () => {
    const paused = pauseTimer(startTimer(fresh, 0), 20_000);
    expect(paused.pausedRemainingMs).toBe(40_000);
    expect(paused.deadlineAt).toBeUndefined();
    expect(remainingMs(paused, 999_000)).toBe(40_000);
    const resumed = startTimer(paused, 100_000);
    expect(remainingMs(resumed, 100_000)).toBe(40_000);
    expect(remainingMs(resumed, 110_000)).toBe(30_000);
  });
  it('reports the full duration before it is started', () => {
    expect(remainingMs(fresh, 5_000)).toBe(60_000);
  });
  it('returns to the full duration on reset', () => {
    const reset = resetTimer(pauseTimer(startTimer(fresh, 0), 20_000));
    expect(remainingMs(reset, 50_000)).toBe(60_000);
    expect(reset.deadlineAt).toBeUndefined();
    expect(reset.pausedRemainingMs).toBeUndefined();
  });
});
