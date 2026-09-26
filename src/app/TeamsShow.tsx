import { ArrowLeft } from 'lucide-react';
import type { EventSession, Player } from '../core/types';

const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);

/** Audience-facing team line-up: everyone finds their name and joins their teammates. */
export function TeamsShow({ event, returnLabel, onReturn }: { event: EventSession; returnLabel: string; onReturn: () => void }) {
  const { teams, players } = event;
  const assigned = new Set(teams.flatMap(t => t.memberIds));
  const unassigned = players.filter(p => !assigned.has(p.id)).sort(byName);
  return <main className="teams-show">
    <div className="teams-show-heading"><span className="eyebrow">{event.title} · {teams.length} teams</span><h1>Find your team.</h1><p className="muted">Look for your name, then go and stand with your teammates.</p></div>
    <div className="teams-show-grid" style={{ '--team-columns': Math.min(teams.length, 4) } as React.CSSProperties}>{teams.map((team, i) => {
      const members = team.memberIds.map(id => players.find(p => p.id === id)).filter((p): p is Player => !!p).sort(byName);
      const name = team.name || `Team ${i + 1}`;
      return <section className="teams-show-card" key={team.id} aria-label={`${name} members`} style={{ '--team-color': team.color } as React.CSSProperties}>
        <header><span className="team-dot"/><div><h2>{name}</h2><small>{members.length} {members.length === 1 ? 'player' : 'players'}</small></div></header>
        {members.length ? <ul className={members.length > 8 ? 'two-column' : undefined}>{members.map(p => <li key={p.id}>{p.name}</li>)}</ul> : <p className="muted">No players yet</p>}
      </section>;
    })}</div>
    {unassigned.length > 0 && <p className="teams-show-unassigned">Still finding a team: {unassigned.map(p => p.name).join(', ')}</p>}
    <button className="button secondary" onClick={onReturn}><ArrowLeft size={18}/> {returnLabel}</button>
  </main>;
}
