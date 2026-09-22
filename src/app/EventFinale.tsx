import { Home as HomeIcon, RotateCcw, Trophy } from 'lucide-react';
import { standings } from '../core/scoring';
import type { EventSession } from '../core/types';

export function EventFinale({ event, onRestart, onHome }: { event: EventSession; onRestart: () => void; onHome: () => void }) {
  const ranking = standings(event.teams, event.scoreEntries), winners = ranking.filter(t => t.score === ranking[0].score);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  return <main className="finale"><div className="finale-confetti" aria-hidden="true">✧ <span>✦</span> ✧ <span>✷</span> ✧</div>
    <span className="eyebrow">{event.segments.length} ACTIVITIES. ONE LEADERBOARD.</span>
    <h1>{winners.length > 1 ? 'Sharing the trophy!' : 'Champions of the Friday!'}</h1>
    <p className="winner-name">{winners.map(t => t.name).join(' & ')}</p>
    <p className="handwritten finale-caption">Bragging rights until next Friday.</p>
    <div className="podium">{podium.map(t => { const place = ranking.findIndex(r => r.id === t.id) + 1, tiedPlace = ranking.findIndex(r => r.score === t.score) + 1;
      return <div className={`podium-place place-${place}`} key={t.id} style={{ '--team-color': t.color } as React.CSSProperties}>{place === 1 && <Trophy className="podium-trophy" size={42}/>}<h3>{t.name}</h3><strong>{t.score}<span> {t.score === 1 ? 'point' : 'points'}</span></strong><div className="podium-block"><b>{tiedPlace === 1 ? '1st' : tiedPlace === 2 ? '2nd' : '3rd'}</b><span>{tiedPlace === 1 ? '★' : '✧'}</span></div></div>;
    })}</div>
    {ranking.length > 3 && <div className="rest-results">{ranking.slice(3).map((t, i) => <span key={t.id}>{i + 4}. {t.name} <b>{t.score}</b></span>)}</div>}
    <div className="button-row centered"><button className="button primary large" onClick={onRestart}><RotateCcw size={19}/> Plan another event</button><button className="button subtle" onClick={onHome}><HomeIcon size={17}/> Activity library</button></div>
  </main>;
}
