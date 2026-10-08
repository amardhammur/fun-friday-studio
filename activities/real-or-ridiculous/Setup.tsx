import { Check, Play, Users, Sparkles } from 'lucide-react';
import { EventTeams } from '../../src/core/teams/EventTeams';
import { inventions, availableRounds } from './content';
import { start } from './logic';
import { Rules } from './Rules';
import type { Context } from './types';
export function Setup(ctx: Context) {
  const { segment, event, update } = ctx;
  const minutes = Math.round(segment.settings.rounds * (segment.settings.seconds + 100) / 60);
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">TWO DOCUMENTED INVENTIONS. ONE FICTIONAL PITCH.</span><h1>Real or Ridiculous<span className="accent">?</span></h1><p>Somebody made that? Debate the pitches, follow a clue, and find our impostor.</p></div>
    <div className="aio-setup-grid"><section className="panel"><div className="panel-heading"><Users size={22}/><h2>Every team is in</h2></div><EventTeams teams={event.teams} players={event.players}/><p>For 10–40 colleagues, aim for 3–5 people per team. No props, phones or preparation.</p><div className="rr-note"><b>Make room for every voice</b><p>Start with pairs, then share with the team. Rotate who starts the discussion each round. Anyone can pass; everyone may stay seated.</p></div></section>
    <section className="panel"><div className="panel-heading"><Sparkles size={22}/><h2>The 30-second brief</h2></div><Rules points={segment.points.correct}/>
      <label className="aio-number"><span><b>Rounds</b><small>No repeated inventions within a session</small></span><select aria-label="Number of rounds" value={segment.settings.rounds} onChange={e => update(s => { s.settings.rounds = +e.target.value; })}>{[5, 6, 8].filter(n => n <= availableRounds).map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="aio-number"><span><b>First discussion</b><small>Then 15 seconds to stick or switch</small></span><select aria-label="Discussion seconds" value={segment.settings.seconds} onChange={e => update(s => { s.settings.seconds = +e.target.value; })}>{[40, 60, 90].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label><p>About {minutes}–{minutes + 4} minutes, including votes and discoveries.</p>
    </section></div><section className="rr-note"><b>What counts as real?</b><p>A documented product, prototype, patented design or announced concept. “Real” does not mean it was sold or proved successful. Reveals label the evidence and include sources. Fictional pitches and their clues are written for this game.</p></section>
    <div className="setup-footer"><span className="privacy-note"><Check size={18}/>{inventions.length} starter pitches · playable offline</span><button className="button primary large" disabled={event.teams.length < 2 || event.teams.some(t => !t.name.trim())} onClick={() => start(ctx)}><Play size={20}/> Start activity</button></div>
  </div>;
}
