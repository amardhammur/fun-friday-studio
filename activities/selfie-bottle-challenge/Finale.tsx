import { RotateCcw, Trophy } from 'lucide-react';
import { segmentScore } from '../../src/core/scoring';
import { multiplier, playerNumber, restart, teamCount } from './logic';
import { ResultEntry } from './ResultEntry';
import type { Context } from './types';

export function Finale(context: Context) {
  const { segment, event } = context, weight = multiplier(segment, event);
  const totals = event.teams.map(team => ({ ...team, base: teamCount(segment.game, team.id), points: segmentScore([...event.scoreEntries], segment.segmentId, team.id) })).sort((a, b) => b.points - a.points);
  const winners = totals.filter(t => t.points === totals[0]?.points);
  return <main className="game-stage bottle-finale">
    <div className="question-intro"><span className="eyebrow">SELFIE BOTTLE CHALLENGE · FINAL STANDINGS</span><h1>{winners.length > 1 ? 'A shared win.' : `${winners[0]?.name ?? 'Team'} takes it.`}</h1><p className="muted">{winners.map(t => t.name).join(' & ')} · {totals[0]?.points ?? 0} points{winners.length > 1 ? ' each · ties stand' : ''}</p></div>
    <section className="panel"><div className="panel-heading"><Trophy size={21}/><h2>This activity</h2></div>
      <div className="bottle-standings">{totals.map(team => <div className="bottle-standing" key={team.id}>
        <b className="bottle-rank">{totals.filter(t => t.points > team.points).length + 1}</b><span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong><span>{team.base} base ×{weight}</span><b>{team.points} pts</b>
        <details><summary>Player counts & corrections</summary>{segment.game.turns.filter(t => t.teamId === team.id).map(turn => <div className="bottle-player-result" key={turn.id}><h3>Player {playerNumber(segment.game, turn)} · {turn.count}/10</h3><ResultEntry context={context} turn={turn}/></div>)}</details>
      </div>)}</div>
    </section>
    <div className="button-row centered"><button className="button secondary" onClick={() => { if (window.confirm('Restart Selfie Bottle Challenge? This clears only this activity’s progress and points.')) restart(context); }}><RotateCcw size={17}/> Restart challenge</button></div>
  </main>;
}
