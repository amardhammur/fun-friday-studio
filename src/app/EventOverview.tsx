import { ArrowRight, Monitor, Trophy } from 'lucide-react';
import type { EventSession } from '../core/types';
import { libraryLocked } from '../core/people/event-library';
import { EventStandings } from './EventStandings';

export function EventOverview({ event, onResume, onBuildEvent, onLibrary, onEdit, onTeams, onShowTeams }: { event: EventSession; onResume: () => void; onBuildEvent: () => void; onLibrary: () => void; onEdit: () => void; onTeams: () => void; onShowTeams: () => void }) {
  const active = !event.isDemo && (event.segments.length > 0 || event.phase !== 'lineup');
  const finished = event.phase === 'finale';
  const current = event.segments[event.currentSegmentIndex];
  const editable = !libraryLocked(event) && (event.phase === 'lineup' || (event.phase === 'segment' && !event.scoreEntries.length && event.segments.every(s => s.status === 'pending' || s.status === 'setup')));
  const action = finished ? 'View final results' : event.phase === 'lineup' ? 'Continue planning' : event.phase === 'interstitial' ? 'View standings' : event.phase === 'wager' ? 'Continue final wager' : 'Continue event';
  return <main className="home-page event-home">
    <section className="event-hero">
      <div><span className="eyebrow">FUN FRIDAY · YOUR EVENT HQ</span><h1>{active ? event.title : <>Bring your team.<br/><span>Make it a game night.</span></>}</h1><p>{active ? finished ? 'The results are in. See how every activity shaped the finish.' : 'Your teams, your running order, one shared leaderboard.' : 'Build a lineup of games, compete together, and crown your event champions. One activity or a whole evening—it’s your call.'}</p>
        <div className="button-row"><button className="button primary large" onClick={active ? onResume : onBuildEvent}>{active ? action : 'Create an event'} <ArrowRight size={19}/></button><button className="button secondary" onClick={onLibrary}>Explore activities</button></div>
        
      </div><div className="event-hero-art" aria-hidden="true"><div className="event-orbit"/><Trophy size={88} strokeWidth={1.3}/><span className="hero-ticket">ONE EVENT<br/><b>ALL TO PLAY FOR</b></span></div>
    </section>
    {active ? <>
      <div className="event-dashboard"><section className="panel event-running-order"><div className="panel-heading"><h2>Your lineup</h2>{editable && <button className="button subtle small-button" onClick={onEdit}>Edit lineup & teams</button>}{!editable && <button className="button subtle small-button" onClick={onTeams}>Manage teams</button>}{event.teams.some(t => t.memberIds.length) && <button className="button subtle small-button" onClick={onShowTeams}><Monitor size={15}/> Show teams</button>}</div><p className="muted">{finished ? 'Every activity contributed to the final result.' : current && event.phase !== 'lineup' ? `Current activity: ${current.title}` : 'Prepare your teams, then set up each activity as you go.'}</p><ol>{event.segments.map((s, i) => {
        const status = finished || s.status === 'done' ? 'Completed' : s.status === 'finale' || (i === event.currentSegmentIndex && event.phase === 'interstitial') ? 'Results ready' : s.status === 'play' ? 'Playing now' : s.status === 'setup' ? 'In setup' : 'Awaiting setup';
        return <li key={s.id} className={i === event.currentSegmentIndex && !finished ? 'current' : ''}><span className="lineup-number">{String(i + 1).padStart(2, '0')}</span><div><strong>{s.title}</strong><small>{status}</small></div><span className="pill">×{s.weight} points</span></li>;
      })}</ol>{event.wager?.question.trim() && <p className="event-wager-note"><Trophy size={16}/> Final wager after the last activity</p>}</section><EventStandings event={event}/></div>
      <div className="event-new"><span className="muted">Planning your next get-together?</span><button className="button subtle" onClick={onBuildEvent}>Start a new event <ArrowRight size={16}/></button></div>
    </> : <section className="event-formula"><div><span>01 / BUILD</span><h2>Set the lineup</h2><p>Pick your activities and the order. Go for a quick game or mix it up.</p></div><div><span>02 / PLAY</span><h2>Back your team</h2><p>Keep the same teams as the games change. Every point counts.</p></div><div><span>03 / CELEBRATE</span><h2>Crown the champions</h2><p>Follow the overall standings all the way to the final result.</p></div></section>}
  </main>;
}
