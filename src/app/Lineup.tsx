import { ArrowDown, ArrowUp, Clock, Play, Plus, Trophy, X } from 'lucide-react';
import { createSegment } from '../core/event';
import { getActivities } from '../core/registry';
import { TeamEditor } from '../core/teams/TeamEditor';
import type { EventSession } from '../core/types';
import { estimatedMinutes, lineupIssues } from './lineup-logic';

export function Lineup({ event, onChange, onStart }: { event: EventSession; onChange: (change: (draft: EventSession) => void) => void; onStart: () => void }) {
  const issues = lineupIssues(event), minutes = estimatedMinutes(event);
  const move = (index: number, delta: number) => onChange(s => {
    const to = index + delta;
    if (to < 0 || to >= s.segments.length) return;
    [s.segments[index], s.segments[to]] = [s.segments[to], s.segments[index]];
  });
  return <main className="lineup-page">
    <div className="section-heading"><span className="eyebrow">THE RUNNING ORDER</span><h1>Build your Friday<span className="accent">.</span></h1><p>Pick your activities. One set of teams, one leaderboard, one winner.</p><label className="event-title-field"><span className="eyebrow">EVENT NAME</span><input aria-label="Event name" maxLength={80} value={event.title} onChange={e => onChange(s => { s.title = e.target.value; })}/></label></div>
    <div className="lineup-grid">
      <section className="panel"><div className="panel-heading"><Clock size={21}/><h2>Your line-up</h2><span className="pill">{minutes} min</span></div>
        {!event.segments.length && <p className="muted">Nothing here yet. Add an activity to get started.</p>}
        <ol className="lineup-list">{event.segments.map((segment, i) => <li key={segment.id}>
          <span className="step-badge yellow">{i + 1}</span>
          <input aria-label={`Name for activity ${i + 1}`} maxLength={60} value={segment.title} onChange={e => onChange(s => { s.segments[i].title = e.target.value; })}/>
          <label className="lineup-weight">Points ×<select aria-label={`Points multiplier for activity ${i + 1}`} value={segment.weight} onChange={e => onChange(s => { s.segments[i].weight = +e.target.value; })}>{[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}</select></label>
          <button className="icon-button" aria-label={`Move activity ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={17}/></button>
          <button className="icon-button" aria-label={`Move activity ${i + 1} later`} disabled={i === event.segments.length - 1} onClick={() => move(i, 1)}><ArrowDown size={17}/></button>
          <button className="icon-button danger" aria-label={`Remove activity ${i + 1}`} onClick={() => onChange(s => { s.segments.splice(i, 1); if (s.currentSegmentIndex >= s.segments.length) s.currentSegmentIndex = Math.max(0, s.segments.length - 1); })}><X size={17}/></button>
        </li>)}</ol>
        <div className="lineup-add">{getActivities().map(activity => <button key={activity.id} className="button subtle" disabled={event.segments.length >= 12} onClick={() => onChange(s => { s.segments.push(createSegment(activity)); })}><Plus size={16}/> {activity.name}</button>)}</div>
      </section>
      <section className="panel"><div className="panel-heading"><Trophy size={21}/><h2>The teams</h2></div><TeamEditor teams={event.teams} onChange={teams => onChange(s => { s.teams = teams; })}/>
        <div className="panel-heading wager-heading"><h2>The final wager</h2></div><p className="muted">Optional. Teams bet their points on one last question. Leave it blank to skip it.</p>
        <input aria-label="Final wager question" placeholder="One last question…" maxLength={240} value={event.wager?.question ?? ''} onChange={e => onChange(s => { s.wager = { question: e.target.value, answer: s.wager?.answer ?? '', bets: s.wager?.bets ?? {} }; })}/>
        <input aria-label="Final wager answer" placeholder="The answer" maxLength={240} value={event.wager?.answer ?? ''} onChange={e => onChange(s => { s.wager = { question: s.wager?.question ?? '', answer: e.target.value, bets: s.wager?.bets ?? {} }; })}/>
      </section>
    </div>
    <div className="setup-footer">{issues.map(issue => <p className="warning-text" key={issue}>{issue}</p>)}<button className="button primary large" disabled={issues.length > 0} onClick={onStart}><Play size={20}/> Start the event</button></div>
  </main>;
}
