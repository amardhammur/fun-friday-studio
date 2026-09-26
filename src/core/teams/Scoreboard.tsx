import { Minus, Plus, Trophy } from 'lucide-react';
import type { ActivityContext } from '../types';
import { teamScore, segmentScore } from '../scoring';
export function Scoreboard({ event, updateEvent, activeTeamId, segmentId, playedCounts = {} }: Pick<ActivityContext, 'event' | 'updateEvent'> & { activeTeamId?: string; segmentId?: string; playedCounts?: Record<string, number> }) {
  const scores = event.teams.map(t => teamScore([...event.scoreEntries], t.id)), max = Math.max(1, ...scores), lead = Math.max(...scores);
  // Rank and team colour are exposed for themes that draw the row as a coloured slab ("● PLAYING NOW · 1ST").
  const rank = (i: number) => { const n = scores.filter(s => s > scores[i]).length + 1; return `${n}${n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH'}`; };
  return <aside className="scoreboard"><div className="scoreboard-title"><Trophy size={19}/><h3>Overall leaderboard</h3></div><p className="muted small">Across all activities · total points</p>
    {event.teams.map((team, i) => <div className={`score-row ${team.id === activeTeamId ? 'active' : ''}`} key={team.id} data-rank={rank(i)} style={{ '--team-color': team.color } as React.CSSProperties}>
      <div className="score-heading"><span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong><b>{scores[i]}</b></div>
      <div className="score-bar"><span style={{ background: team.color, width: `${Math.max(0, scores[i]) / max * 100}%` }}/></div>
      {segmentId && <p className="activity-score">{segmentScore([...event.scoreEntries], segmentId, team.id)} pts this activity · {playedCounts[team.id] ?? 0} turns played</p>}<div className="score-meta"><span>{team.id === activeTeamId ? 'YOUR TURN' : scores[i] === lead && lead > 0 ? 'LEAD' : 'EVENT TOTAL'}{team.id === activeTeamId && scores[i] === lead && lead > 0 ? ' · LEAD' : ''}</span><div><button aria-label={`Subtract one point from ${team.name}`} onClick={() => updateEvent(s => { s.scoreEntries.push({ id: crypto.randomUUID(), teamId: team.id, segmentId, kind: 'manual-adjustment', points: -1, active: true }); })}><Minus size={13}/></button><button aria-label={`Add one point to ${team.name}`} onClick={() => updateEvent(s => { s.scoreEntries.push({ id: crypto.randomUUID(), teamId: team.id, segmentId, kind: 'manual-adjustment', points: 1, active: true }); })}><Plus size={13}/></button></div></div>
    </div>)}<div className="scoreboard-note"><span>Every activity counts.<br/>Keep your eyes on the lead.</span></div>
  </aside>;
}
