import { ArrowRight, TrendingUp } from 'lucide-react';
import type { EventSession } from '../core/types';
import { segmentStandings } from './standings-logic';

export function Interstitial({ event, onContinue }: { event: EventSession; onContinue: () => void }) {
  const segment = event.segments[event.currentSegmentIndex];
  const rows = segmentStandings(event, segment?.id ?? ''), max = Math.max(1, ...rows.map(r => r.total));
  const climber = [...rows].sort((a, b) => b.gained - a.gained)[0];
  const remaining = event.segments.length - event.currentSegmentIndex - 1;
  return <main className="interstitial"><span className="eyebrow">ROUND {event.currentSegmentIndex + 1} OF {event.segments.length} · {segment?.title}</span>
    <h1>{remaining > 0 ? 'Still anyone’s Friday.' : 'Last round done.'}</h1>
    {climber && climber.gained > 0 && <p className="handwritten"><TrendingUp size={18}/> Biggest climber: {climber.name}, +{climber.gained} this round.</p>}
    <div className="interstitial-board">{rows.map((row, i) => <div className="interstitial-row" key={row.id} style={{ '--team-color': row.color } as React.CSSProperties}>
      <b>{i + 1}</b><strong>{row.name}</strong>
      <div className="score-bar"><span style={{ background: row.color, width: `${Math.max(0, row.total) / max * 100}%` }}/></div>
      <span className="interstitial-gain">{row.gained > 0 ? `+${row.gained}` : '—'}</span><b className="interstitial-total">{row.total}</b>
    </div>)}</div>
    <button className="button primary large" onClick={onContinue}>{remaining > 0 ? 'Next activity' : 'On to the finish'} <ArrowRight size={19}/></button>
  </main>;
}
