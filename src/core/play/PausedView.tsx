import { Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import { segmentScore } from '../scoring';
import type { Activity, ActivityContext } from '../types';

// A paused game is frozen: changing its setup mid-way would treat teams differently, so every
// change goes through Start over, which clears this activity and reopens its full setup.
export function PausedView({ activity, context, onStartOver }: { activity: Activity; context: ActivityContext; onStartOver: () => void }) {
  const { segment, event, update } = context;
  const scores = event.teams.map(team => ({ team, points: segmentScore([...event.scoreEntries], segment.segmentId, team.id) }));
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">GAME PAUSED</span><h1>Take a breather<span className="accent">.</span></h1><p>{activity.progressLabel?.(segment.game) ?? 'Your progress is saved.'} Everything picks up exactly where you left off.</p></div>
    <section className="panel" aria-label="Scores this activity"><div className="panel-heading"><Trophy size={21}/><h2>Scores so far</h2></div><div className="allocation-teams paused-scores">{scores.map(({ team, points }) => <div key={team.id}><span className="team-dot" style={{ background: team.color }}/><span>{team.name}</span><b>{points} pts</b></div>)}</div></section>
    <section className="allocation" aria-label="Start over"><div><span className="eyebrow">START OVER</span><h3>Want a different setup?</h3><p className="muted">The setup stays fixed mid-game so every team plays by the same rules. Starting over clears this activity’s scores and takes you back to its setup; change anything there, then start a fresh game.</p></div><button className="button secondary" onClick={() => { if (window.confirm(`Start ${activity.name} over? This clears its scores.`)) onStartOver(); }}><RotateCcw size={17}/> Start over</button></section>
    <div className="setup-footer"><span className="privacy-note"><Pause size={17}/> Paused · saved on this laptop</span><button className="button primary large" onClick={() => update(s => { activity.onResume?.(s); s.phase = 'play'; })}><Play size={20}/> Resume activity</button></div>
  </div>;
}
