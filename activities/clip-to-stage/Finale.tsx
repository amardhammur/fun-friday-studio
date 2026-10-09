import { Trophy } from 'lucide-react';
import { standings } from '../../src/core/scoring';
import { editScores } from './logic';
import type { Context } from './types';

export function Finale(ctx: Context) {
  const scores = standings([...ctx.event.teams], ctx.event.scoreEntries.filter(e => e.segmentId === ctx.segment.segmentId));
  const winners = scores.filter(t => t.score === scores[0]?.score);
  return <main className="cts-finale"><span className="eyebrow">CLIP TO STAGE</span><h1>Take a bow!</h1><p className="cts-champion"><Trophy/>{winners.map(t => t.name).join(' & ')}</p><p>Scores entered by the host from the offline judge panel.</p><section className="panel cts-results" aria-label="Activity scores">{scores.map(t => <div key={t.id}><span className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><b>{t.score} pts</b></div>)}</section><button className="button subtle" onClick={() => editScores(ctx)}>Edit scores</button></main>;
}
