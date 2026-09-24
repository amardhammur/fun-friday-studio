import { segmentScore, standings, teamScore } from '../core/scoring';
import type { EventSession } from '../core/types';

export function EventStandings({ event, breakdown = false }: { event: EventSession; breakdown?: boolean }) {
  const ranking = standings(event.teams, event.scoreEntries);
  const wagers = event.scoreEntries.filter(e => e.kind === 'wager');
  const adjustments = event.scoreEntries.filter(e => !event.segments.some(s => s.id === e.segmentId) && e.kind !== 'wager');
  return <section className="event-standings" aria-label={breakdown ? 'Score breakdown' : 'Overall leaderboard'}>
    <div className="panel-heading"><h2>{breakdown ? 'Score breakdown' : 'Overall leaderboard'}</h2><span className="pill">Event points</span></div>
    <p className="muted">{breakdown ? 'Activity points include their multiplier. Every column contributes to the total.' : 'One leaderboard across every activity.'}</p>
    <div className="standings-scroll" tabIndex={0} role="region" aria-label="Team scores"><table className="event-score-table"><thead><tr><th scope="col">Rank</th><th scope="col">Team</th>{breakdown && event.segments.map(s => <th scope="col" key={s.id}>{s.title}<small>×{s.weight} points</small></th>)}{breakdown && wagers.some(e => e.active) && <th scope="col">Final wager</th>}{breakdown && adjustments.some(e => e.active) && <th scope="col">Adjustments</th>}<th scope="col">Total</th></tr></thead>
      <tbody>{ranking.map(team => <tr key={team.id}><td>{ranking.findIndex(t => t.score === team.score) + 1}</td><th scope="row"><span className="team-dot" style={{ background: team.color }}/>{team.name}</th>{breakdown && event.segments.map(s => <td key={s.id}>{segmentScore(event.scoreEntries.filter(e => e.kind !== 'wager'), s.id, team.id)}</td>)}{breakdown && wagers.some(e => e.active) && <td>{teamScore(wagers, team.id)}</td>}{breakdown && adjustments.some(e => e.active) && <td>{teamScore(adjustments, team.id)}</td>}<td><strong>{team.score}</strong></td></tr>)}</tbody>
    </table></div>
  </section>;
}
