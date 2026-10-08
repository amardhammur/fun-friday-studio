import { Check, Clapperboard, Download, Play, Users } from 'lucide-react';
import { EventTeams } from '../../src/core/teams/EventTeams';
import { products } from './content';
import { downloadBriefs } from './briefs';
import { briefsMatch, chooseProduct, prepareBriefs, start } from './logic';
import { Rules } from './Rules';
import type { Context } from './types';

export function Setup(ctx: Context) {
  const { segment, event, update } = ctx, settings = segment.settings;
  const validTeams = event.teams.length >= 2 && event.teams.length <= 8 && event.teams.every(t => t.name.trim());
  const ready = validTeams && briefsMatch(segment.game, event);
  const minutes = Math.round(settings.preparationMinutes + event.teams.length * (settings.performanceSeconds + settings.guessSeconds + 135) / 60 + 4);
  return <div className="setup-content pid-setup"><div className="section-heading"><span className="eyebrow">ONE ORDINARY PRODUCT. ONE EXTRAORDINARY AD.</span><h1>Set the scene<span className="accent">.</span></h1><p>One team advertises. Everyone else guesses. Then comes the product reveal.</p></div>
    <div className="pid-setup-grid"><section className="panel"><div className="panel-heading"><Users size={22}/><h2>Your ad agencies</h2></div><EventTeams teams={event.teams} players={event.players}/><p>For 15–30 people, aim for five teams of 3–6. Every team presents once.</p><p className="pid-note">Choose roles freely: writer, director, narrator, actor or timekeeper. A single volunteer can narrate from their seat.</p><Rules points={segment.points.correct}/></section>
    <section className="panel"><div className="panel-heading"><Clapperboard size={22}/><h2>The running order</h2></div>
      <label className="pid-setting"><span><b>Preparation</b><small>All teams prepare together</small></span><select aria-label="Preparation minutes" value={settings.preparationMinutes} onChange={e => update(s => { s.settings.preparationMinutes = +e.target.value; })}>{[5, 8, 10, 15].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      <label className="pid-setting"><span><b>Each commercial</b><small>Problem → solution → tagline</small></span><select aria-label="Commercial seconds" value={settings.performanceSeconds} onChange={e => update(s => { s.settings.performanceSeconds = +e.target.value; s.settings.briefsShared = false; })}>{[60, 75, 90].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label>
      <label className="pid-setting"><span><b>Audience guesses</b><small>One final answer per team</small></span><select aria-label="Guessing seconds" value={settings.guessSeconds} onChange={e => update(s => { s.settings.guessSeconds = +e.target.value; })}>{[30, 45, 60, 90].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label>
      <p>About {minutes} minutes, including introductions, scoring and reveal discussion.</p><p className="pid-note">Hybrid: share the stage, prepare in team chats or breakout rooms, and send final guesses privately to the host.</p><p className="muted">The host controls the pace. Timer expiry never advances or reveals the product.</p>
    </section></div>
    <section className="panel pid-briefs" aria-label="Private team briefs"><div className="panel-heading"><Download size={22}/><h2>Private team briefs</h2></div><p>Before sharing your screen, give each team only its own brief. The ZIP contains one text file per team, ready to print or send privately.</p>
      {!ready ? <><p className="muted">Products come from a fixed pack of familiar everyday objects. Choose each assignment before sharing the briefs.</p><button className="button secondary" disabled={!validTeams} onClick={() => update(s => prepareBriefs(s, event))}>Prepare team briefs</button></> : <>
        <div className="pid-brief-grid">{segment.game.rounds.map(round => {
          const team = event.teams.find(t => t.id === round.teamId)!;
          return <details key={round.id} className="pid-brief"><summary>{team.name}’s brief <span className="small muted">HOST ONLY</span></summary><label>Secret product<select aria-label={`Product for ${team.name}`} value={round.product.id} onChange={e => update(s => chooseProduct(s, team.id, e.target.value))}>{products.map(p => <option key={p.id} value={p.id} disabled={segment.game.rounds.some(r => r.teamId !== team.id && r.product.id === p.id)}>{p.name}</option>)}</select></label><b>Both clues must be communicated</b><ol>{round.product.clues.map(clue => <li key={clue}>{clue}</li>)}</ol><p className="handwritten">Try pitching it as “{round.product.tagline}”.</p></details>;
        })}</div><button className="button secondary" onClick={() => downloadBriefs(segment.game.rounds, event.teams, settings.performanceSeconds)}><Download size={18}/> Download team briefs</button>
        <label className="pid-confirm"><input type="checkbox" checked={settings.briefsShared} onChange={e => update(s => { s.settings.briefsShared = e.target.checked; })}/> I have privately shared every team’s brief</label>
      </>}
      {!validTeams && <p className="warning-text">Add 2–8 named teams in event planning before preparing the briefs.</p>}
    </section>
    <div className="setup-footer"><span className="privacy-note"><Check size={17}/> Saved on this laptop · {Math.max(0, event.teams.length - 1)} guessing turns each</span><button className="button primary large" disabled={!ready || !settings.briefsShared} onClick={() => start(ctx)}><Play size={20}/> Start activity</button></div>
  </div>;
}
