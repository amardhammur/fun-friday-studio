import { Trophy } from 'lucide-react';
import { standings } from '../../../src/core/scoring';
import { editScores } from './logic';
import type { Context } from './types';

export function Finale(ctx: Context) {
  const { event, segment } = ctx;
  const scores = standings([...event.teams], event.scoreEntries.filter(e => e.segmentId === segment.segmentId));
  const winners = scores.filter(t => t.score === scores[0]?.score);
  return <main className="cc-finale"><span className="eyebrow">COMMERCIAL CLASH</span><h1>That’s a wrap!</h1><p className="cc-champion"><Trophy/>{winners.map(t => t.name).join(' & ')}</p><p>Scores recorded by the host.</p><section className="panel cc-results" aria-label="Activity scores">{scores.map(t => <div key={t.id}><span className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><b>{t.score} pts</b></div>)}</section><button className="button subtle" onClick={() => editScores(ctx)}>Edit scores</button></main>;
}
