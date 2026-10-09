import { RotateCcw, Trophy } from 'lucide-react';
import { segmentScore } from '../../src/core/scoring';
import { multiplier, restart, teamPoints } from './logic';
import { SavedResults } from './SavedResults';
import type { Context } from './types';

export function Finale(context: Context) {
  const { segment, event } = context, weight = multiplier(segment, event);
  const totals = event.teams.map(team => ({ ...team, base: teamPoints(segment.game, team.id), score: segmentScore([...event.scoreEntries], segment.segmentId, team.id) })).sort((a, b) => b.score - a.score);
  const winners = totals.filter(t => t.score === totals[0]?.score);
  return <main className="game-stage sa-finale">
    <div className="section-heading"><span className="eyebrow">SHARMILA AWARDS · ACTIVITY COMPLETE</span><h1>Final team standings</h1><p className="handwritten">Wrong answers. Full confidence.</p></div>
    <p className="sa-winners"><Trophy size={24}/>{winners.map(t => t.name).join(' & ')} · {totals[0]?.score ?? 0} points{winners.length > 1 ? ' each · shared win' : ''}</p>
    <ol className="sa-standings" aria-label="Final team standings">{totals.map(team => <li key={team.id}>
      <b className="sa-rank">{totals.filter(t => t.score > team.score).length + 1}</b><span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong><span className="muted">{team.base} base ×{weight}</span><b>{team.score} pts</b>
    </li>)}</ol>
    <SavedResults context={context}/>
    <div className="button-row"><button className="button secondary" onClick={() => { if (window.confirm('Restart Sharmila Awards? This clears only this activity’s progress and points.')) restart(context); }}><RotateCcw size={17}/> Restart awards</button></div>
  </main>;
}
