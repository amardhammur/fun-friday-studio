import { Trophy } from 'lucide-react';
import { standings } from '../../src/core/scoring';
import { ProductPicture } from './ProductPicture';
import type { Context } from './types';

export function Finale({ segment, event }: Context) {
  const scores = standings([...event.teams], event.scoreEntries.filter(e => e.segmentId === segment.segmentId));
  const winners = scores.filter(t => t.score === scores[0]?.score);
  return <main className="pid-finale"><span className="eyebrow">PRODUCT IN DISGUISE · ACTIVITY COMPLETE</span><h1>That’s a wrap!</h1><p className="handwritten">Ordinary objects. Extraordinary ad agencies.</p><section className="panel pid-results"><div className="panel-heading"><Trophy size={24}/><h2>{winners.length > 1 ? 'Joint activity winners' : 'Activity winner'}: {winners.map(t => t.name).join(' & ')}</h2></div><p>Each team presented once and had {event.teams.length - 1} guessing opportunities. Scores reward correct guesses.</p>{scores.map(t => <div className="pid-result-row" key={t.id}><span className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><b>{t.score} pts</b></div>)}</section><section className="pid-recap" aria-label="Product recap">{segment.game.rounds.map(r => <article key={r.id} className="panel"><ProductPicture product={r.product}/><span className="eyebrow">{event.teams.find(t => t.id === r.teamId)?.name}</span><h2>{r.product.name}</h2><p>{r.product.tagline}</p></article>)}</section></main>;
}
