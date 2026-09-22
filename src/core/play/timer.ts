import { useEffect, useState } from 'react';
// Only the deadline is persisted. App.update writes to localStorage on every change, so storing a
// tick would write once a second for the whole event; storing the deadline also makes a mid-round
// refresh restore the true remaining time instead of restarting the round.
export interface TimerState { durationMs: number; deadlineAt?: number; pausedRemainingMs?: number }
export function remainingMs(state: TimerState, now: number) {
  if (state.deadlineAt !== undefined) return Math.max(0, state.deadlineAt - now);
  return state.pausedRemainingMs ?? state.durationMs;
}
export function startTimer(state: TimerState, now: number): TimerState {
  return { durationMs: state.durationMs, deadlineAt: now + remainingMs(state, now) };
}
export function pauseTimer(state: TimerState, now: number): TimerState {
  return { durationMs: state.durationMs, pausedRemainingMs: remainingMs(state, now) };
}
export function resetTimer(state: TimerState): TimerState { return { durationMs: state.durationMs }; }
export const isRunning = (state: TimerState) => state.deadlineAt !== undefined;
export function useCountdown(state: TimerState) {
  const [remaining, setRemaining] = useState(() => remainingMs(state, Date.now()));
  useEffect(() => {
    setRemaining(remainingMs(state, Date.now()));
    if (state.deadlineAt === undefined) return;
    const id = setInterval(() => setRemaining(remainingMs(state, Date.now())), 100);
    return () => clearInterval(id);
  }, [state.deadlineAt, state.pausedRemainingMs, state.durationMs]);
  return remaining;
}
