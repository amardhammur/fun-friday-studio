import type { Player, Team } from '../types';
export function EventTeams({ teams, players }: { teams: readonly Team[]; players: readonly Player[] }) {
  return <div className="event-teams"><p className="muted">Your event teams carry across every activity. Manage them from the event overview.</p><ul>{teams.map(team => <li key={team.id}><span className="team-dot" style={{ background: team.color }}/><div><strong>{team.name}</strong>{team.memberIds.length > 0 && <p className="event-team-members">{team.memberIds.map(id => players.find(p => p.id === id)?.name).filter(Boolean).join(', ')}</p>}</div></li>)}</ul></div>;
}
