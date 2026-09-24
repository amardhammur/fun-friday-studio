import { ArrowLeft, Trophy } from 'lucide-react';
import type { EventSession } from '../core/types';

export function EventContext({ event, onOverview }: { event: EventSession; onOverview: () => void }) {
  const current = event.segments[event.currentSegmentIndex];
  const label = event.phase === 'finale' ? 'Final results' : event.phase === 'wager' ? 'Final wager' : event.phase === 'interstitial' ? 'Overall standings' : `Activity ${event.currentSegmentIndex + 1} of ${event.segments.length}`;
  return <section className="event-context" aria-label="Event progress"><div className="event-context-heading"><button className="button subtle small-button" onClick={onOverview}><ArrowLeft size={16}/> {event.isDemo ? 'Back to welcome' : 'Event overview'}</button><strong>{event.title}</strong><span><Trophy size={15}/> {label}</span></div><ol>{event.segments.map((s, i) => <li key={s.id} className={s.id === current?.id ? 'current' : s.status === 'done' ? 'complete' : ''} aria-current={s.id === current?.id ? 'step' : undefined}><span>{i + 1}</span>{s.title}</li>)}</ol></section>;
}
