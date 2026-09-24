import type { Team } from '../types';
export function EventTeams({ teams }: { teams: readonly Team[] }) {
  return <div className="event-teams"><p className="muted">Your event teams carry across every activity. Manage them from the event overview before play begins.</p><ul>{teams.map(team => <li key={team.id}><span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong></li>)}</ul></div>;
}
