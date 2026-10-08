import { useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { isRunning, pauseTimer, remainingMs, resetTimer, startTimer, useCountdown, type TimerState } from './timer';
let audio: AudioContext | undefined;
function beep(frequency: number) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.frequency.value = frequency; oscillator.type = 'sine';
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.2, audio.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .18);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .2);
  } catch { /* Audio is a flourish; a blocked context must never break the round. */ }
}
// confirmReset: resetting mid-turn hands one team extra time, so the caller can ask the host first.
export function Timer({ state, onChange, label = 'Round timer', confirmReset, allowReset = true, onExpire }: { state: TimerState; onChange: (next: TimerState) => void; label?: string; confirmReset?: string; allowReset?: boolean; onExpire?: () => void }) {
  const remaining = useCountdown(state), seconds = Math.ceil(remaining / 1000), running = isRunning(state), hurry = running && seconds <= 10;
  const lastBeep = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!running || seconds > 5 || seconds < 0 || lastBeep.current === seconds) return;
    lastBeep.current = seconds; beep(seconds === 0 ? 420 : 880);
  }, [running, seconds]);
  // Notify after the zero-second beep effect so ending a turn cannot unmount its buzzer first.
  useEffect(() => { if (running && remaining === 0) onExpire?.(); }, [running, remaining, onExpire]);
  useEffect(() => { if (!running) lastBeep.current = undefined; }, [running]);
  // hurry (the last 10 seconds) drives the Ink urgent style and note; urgent (5 seconds) is the older pulse.
  return <div className={`play-timer ${running ? 'running' : ''} ${seconds <= 5 && running ? 'urgent' : ''} ${hurry ? 'hurry' : ''}`} role="timer" aria-label={label}>
    <strong aria-live="off">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>
    <div className="play-timer-controls">
      <button className="icon-button" aria-label={running ? 'Pause the timer' : 'Start the timer'} onClick={() => onChange(running ? pauseTimer(state, Date.now()) : startTimer(state, Date.now()))}>{running ? <Pause size={18}/> : <Play size={18}/>}</button>
      {allowReset && <button className="icon-button" aria-label="Reset the timer" disabled={remainingMs(state, Date.now()) === state.durationMs && !running} onClick={() => { if (!confirmReset || window.confirm(confirmReset)) onChange(resetTimer(state)); }}><RotateCcw size={17}/></button>}
    </div>
    {hurry && <span className="timer-note" aria-hidden="true">quick, quick, quick!</span>}
  </div>;
}
