import { Zap } from 'lucide-react';
import type { ScoreEntry, Team } from '../types';
import { stealTeamId } from './steal';
export function StealPanel({ teams, ownerTeamId, segmentId, roundId, entries, onSteal, points }: { teams: Team[]; ownerTeamId: string; segmentId: string; roundId: string; entries: ScoreEntry[]; onSteal: (teamId: string | null) => void; points: number }) {
  const holder = stealTeamId(entries, segmentId, roundId), others = teams.filter(t => t.id !== ownerTeamId);
  if (!others.length) return null;
  return <div className="steal-panel"><div className="steal-heading"><Zap size={17}/><span className="eyebrow">UP FOR GRABS</span><small>Anyone else? <b>+{points}</b></small></div>
    <div className="steal-teams">{others.map(team => <button key={team.id} className={`button small-button ${holder === team.id ? 'primary' : 'secondary'}`} aria-pressed={holder === team.id} style={{ '--team-color': team.color } as React.CSSProperties} onClick={() => onSteal(holder === team.id ? null : team.id)}>{team.name}</button>)}
    {holder && <button className="button subtle small-button" onClick={() => onSteal(null)}>Nobody got it</button>}</div>
  </div>;
}
