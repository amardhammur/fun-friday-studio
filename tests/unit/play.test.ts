import { describe, expect, it } from 'vitest';
import { pauseTimer, remainingMs, resetTimer, startTimer, type TimerState } from '../../src/core/play/timer';
import { retractSteal, setStealAward, stealTeamId } from '../../src/core/play/steal';
import { clampWager, maxWager, setWagerResult, WAGER_FLOOR } from '../../src/core/play/wager';
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

describe('final wager', () => {
  const rich: ScoreEntry[] = [{ id: 'a', teamId: 't0', kind: 'manual-adjustment', points: 30, active: true }];
  it('caps a bet at the team score', () => {
    expect(maxWager(rich, 't0')).toBe(30);
    expect(clampWager(rich, 't0', 45)).toBe(30);
    expect(clampWager(rich, 't0', 12)).toBe(12);
  });
  it('lets a team on zero still bet the floor', () => {
    expect(maxWager([], 't9')).toBe(WAGER_FLOOR);
    expect(clampWager([], 't9', 5)).toBe(5);
    expect(clampWager([], 't9', 99)).toBe(WAGER_FLOOR);
  });
  it('never allows a negative bet', () => {
    expect(clampWager(rich, 't0', -8)).toBe(0);
  });
  it('treats a team below the floor as able to reach the floor', () => {
    const poor: ScoreEntry[] = [{ id: 'a', teamId: 't0', kind: 'manual-adjustment', points: 2, active: true }];
    expect(maxWager(poor, 't0')).toBe(WAGER_FLOOR);
  });
  it('adds the bet on a correct answer and subtracts it on a wrong one', () => {
    expect(teamScore(setWagerResult(rich, 't0', 10, true), 't0')).toBe(40);
    expect(teamScore(setWagerResult(rich, 't0', 10, false), 't0')).toBe(20);
  });
  it('is idempotent and reversible on re-marking', () => {
    let entries = setWagerResult(rich, 't0', 10, false);
    entries = setWagerResult(entries, 't0', 10, false);
    expect(teamScore(entries, 't0')).toBe(20);
    expect(entries.filter(e => e.kind === 'wager')).toHaveLength(1);
    entries = setWagerResult(entries, 't0', 10, true);
    expect(teamScore(entries, 't0')).toBe(40);
  });
});
