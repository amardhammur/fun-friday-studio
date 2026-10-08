import { Sparkles, Trophy } from 'lucide-react';
import { segmentScore } from '../../src/core/scoring';
import type { Context } from './types';
export function Finale({ segment, event }: Context) {
  const scores = event.teams.map(t => ({ ...t, score: segmentScore([...event.scoreEntries], segment.segmentId, t.id) })).sort((a, b) => b.score - a.score);
  const real = segment.game.deck.flatMap(r => r.cards).filter(c => c.kind === 'real');
  return <main className="rr-finale"><span className="eyebrow">REAL OR RIDICULOUS? · CASE CLOSED</span><h1>Reality has range.</h1><p>Which real invention surprised you most? Pick one as a team.</p><div className="rr-finale-grid"><section className="panel"><div className="panel-heading"><Trophy size={24}/><h2>This activity’s scores</h2></div>{scores.map(t => <div className="aio-total" key={t.id}><span className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><b>{t.score} pts</b></div>)}</section><section className="panel"><div className="panel-heading"><Sparkles size={24}/><h2>Take a discovery with you</h2></div><p>{real.length} documented inventions. {segment.game.deck.length} fictional pitches. A few changed minds?</p><p>One final room vote: which invention deserves a place in the office?</p></section></div><details><summary>Revisit the real inventions & sources</summary><div className="rr-source-list">{real.map(c => <article key={c.id}><h3>{c.title} <small>· {c.status}</small></h3><p>{c.explanation}</p><a href={c.source.url} target="_blank" rel="noreferrer">{c.source.label} ↗</a></article>)}</div></details></main>;
}
