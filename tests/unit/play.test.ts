import { describe, expect, it } from 'vitest';
import { pauseTimer, remainingMs, resetTimer, startTimer, type TimerState } from '../../src/core/play/timer';
import { retractSteal, setStealAward, stealTeamId } from '../../src/core/play/steal';
import { setRoundAward, teamScore } from '../../src/core/scoring';
import type { ScoreEntry } from '../../src/core/types';

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

describe('steal on a miss', () => {
  const missed = () => setRoundAward([], 'seg-a', 'r1', 't0', false);
  it('awards the stealing team one point', () => {
    const entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    expect(teamScore(entries, 't1')).toBe(1);
    expect(teamScore(entries, 't0')).toBe(0);
  });
  it('moves a steal between teams without duplicating it', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = setStealAward(entries, 'seg-a', 'r1', 't0', 't2');
    expect(teamScore(entries, 't1')).toBe(0);
    expect(teamScore(entries, 't2')).toBe(1);
    expect(entries.filter(e => e.kind === 'steal-award')).toHaveLength(1);
  });
  it('refuses to award a steal to the owning team', () => {
    expect(() => setStealAward(missed(), 'seg-a', 'r1', 't0', 't0')).toThrow(/own round/);
  });
  it('clears a steal when the host passes null', () => {
    const entries = setStealAward(setStealAward(missed(), 'seg-a', 'r1', 't0', 't1'), 'seg-a', 'r1', 't0', null);
    expect(teamScore(entries, 't1')).toBe(0);
    expect(stealTeamId(entries, 'seg-a', 'r1')).toBeUndefined();
  });
  it('retracts the steal when the owner is flipped back to correct', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = retractSteal(setRoundAward(entries, 'seg-a', 'r1', 't0', true), 'seg-a', 'r1');
    expect(teamScore(entries, 't0')).toBe(2);
    expect(teamScore(entries, 't1')).toBe(0);
  });
  it('reports which team holds the steal', () => {
    expect(stealTeamId(setStealAward(missed(), 'seg-a', 'r1', 't0', 't3'), 'seg-a', 'r1')).toBe('t3');
    expect(stealTeamId(missed(), 'seg-a', 'r1')).toBeUndefined();
  });
  it('keeps steals in different segments independent', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = setStealAward(entries, 'seg-b', 'r1', 't0', 't2');
    expect(teamScore(entries, 't1')).toBe(1);
    expect(teamScore(entries, 't2')).toBe(1);
  });
});
