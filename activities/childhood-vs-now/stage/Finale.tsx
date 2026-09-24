import { useEffect, useState } from 'react';
import { Trophy, RotateCcw, Images, ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { standings } from '../../../src/core/scoring';
import { StoredImage } from '../../../src/components/Images';
import { eventDraft } from '../../../src/core/event';
import { startNewGame } from '../logic/rounds';
import { buildRevealSlides, clampSlide } from '../logic/reveal';
import type { Context, CVEventUpdate } from '../types';

export function Finale({ segment, event, update, updateEvent }: Context) {
  const [view, setView] = useState<'results' | 'group'>('results');
  const ranking = standings([...event.teams], [...event.scoreEntries]), winners = ranking.filter(t => t.score === ranking[0]?.score);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const { finale } = segment.game;
  const slides = buildRevealSlides(event, segment.game.rounds), index = clampSlide(finale.slideIndex, slides.length), slide = slides[index];
  const groupSlide = slide?.kind === 'group' ? slide : undefined;
  const spotlight = groupSlide?.players.find(p => p.person.id === finale.spotlightPersonId);
  const spot = spotlight && (finale.wipePosition >= 50 ? spotlight.pair.now?.faceBox : spotlight.pair.then?.faceBox);
  const image = groupSlide?.set.nowImageId ? event.assets[groupSlide.set.nowImageId] : undefined, ratio = image ? image.width / image.height : 16 / 9;
  const go = (delta: number) => update(s => { const next = clampSlide(index + delta, slides.length); if (next === index) return; s.game.finale.slideIndex = next; s.game.finale.wipePosition = 0; delete s.game.finale.spotlightPersonId; });
  // Arrow keys step through the photos, except while a control such as the wipe slider has focus.
  useEffect(() => {
    if (view !== 'group') return;
    const onKey = (e: KeyboardEvent) => { const target = e.target as HTMLElement | null; if (target?.closest('input, textarea, select, [contenteditable="true"]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const replay = () => { const e: CVEventUpdate = eventDraft(event); const s = structuredClone(segment); startNewGame(s, e); update(d => Object.assign(d, s)); updateEvent(d => Object.assign(d, e)); };
  return <main className="finale">{view === 'results' ? <>
    <div className="finale-confetti" aria-hidden="true">✧ <span>✦</span> ✧ <span>✷</span> ✧</div><span className="eyebrow">MEETING ADJOURNED. MEMORIES MADE.</span><h1>{winners.length > 1 ? 'Sharing the trophy!' : 'Team of the month!'}</h1><p className="winner-name">{winners.map(t => t.name).join(' & ')}</p><p className="handwritten finale-caption">Turns out, some faces you never forget.</p><div className="podium">{podium.map(t => {
      const place = ranking.findIndex(r => r.id === t.id) + 1, tiedPlace = ranking.findIndex(r => r.score === t.score) + 1;
      return <div className={`podium-place place-${place}`} key={t.id} style={{ '--team-color': t.color } as React.CSSProperties}>{place === 1 && <Trophy className="podium-trophy" size={42}/>}<h3>{t.name}</h3><strong>{t.score}<span> {t.score === 1 ? 'point' : 'points'}</span></strong><div className="podium-block"><b>{tiedPlace === 1 ? '1st' : tiedPlace === 2 ? '2nd' : '3rd'}</b><span>{tiedPlace === 1 ? '★' : '✧'}</span></div></div>;
    })}</div>{ranking.length > 3 && <div className="rest-results">{ranking.slice(3).map((t, i) => <span key={t.id}>{i + 4}. {t.name} <b>{t.score}</b></span>)}</div>}<div className="button-row centered"><button className="button primary large" onClick={() => setView('group')}><Images size={20}/> The whole team reveal</button><button className="button secondary" onClick={replay}><RotateCcw size={18}/> Play again</button><button className="button subtle" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Edit teams</button></div>
  </> : <>
    <div className="group-reveal-title"><button className="button subtle" onClick={() => setView('results')}><ArrowLeft size={18}/> Results</button><div><span className="eyebrow">ONE LAST THROWBACK{slide?.kind === 'group' ? ` · ${slide.set.name}` : ''}{slides.length > 1 ? ` (${index + 1} of ${slides.length})` : ''}</span><h1>{slide?.kind === 'singles' ? 'Also in the game' : 'Look how far we’ve come.'}</h1></div>{slides.length > 1 ? <div className="reveal-steps"><button className="icon-button" aria-label="Previous reveal photo" disabled={index === 0} onClick={() => go(-1)}><ChevronLeft size={20}/></button><button className="icon-button" aria-label="Next reveal photo" disabled={index === slides.length - 1} onClick={() => go(1)}><ChevronRight size={20}/></button></div> : <Sparkles size={30}/>}</div>
    {!slide && <div className="empty-state"><h2>No group photos to reveal.</h2></div>}
    {groupSlide && <><div className="group-wipe" style={{ aspectRatio: ratio, '--photo-ratio': ratio } as React.CSSProperties}><StoredImage id={groupSlide.set.thenImageId} alt="The whole team as children"/><div className="wipe-now" style={{ clipPath: `inset(0 ${100 - finale.wipePosition}% 0 0)` }}><StoredImage id={groupSlide.set.nowImageId} alt="The whole team today"/></div><div className="wipe-line" style={{ left: `${finale.wipePosition}%` }}><span>↔</span></div><span className="wipe-label then">THEN</span><span className="wipe-label now">NOW</span>{spot && spotlight && <div className="spotlight-box" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${spot.width * 100}%`, height: `${spot.height * 100}%` }}><span>{spotlight.person.name}</span></div>}</div>
      <label className="wipe-control"><span className="handwritten">Little legends</span><input aria-label="Reveal original group photo" type="range" min="0" max="100" value={finale.wipePosition} onChange={e => update(s => { s.game.finale.wipePosition = +e.target.value; })}/><span className="handwritten">All grown up</span></label>
      <div className="spotlight-controls"><span className="eyebrow">IN THE SPOTLIGHT</span><button className={`button small-button ${!spotlight ? 'primary' : 'secondary'}`} onClick={() => update(s => { delete s.game.finale.spotlightPersonId; })}>Everyone</button>{groupSlide.players.map(({ person }) => <button className={`button small-button ${spotlight?.person.id === person.id ? 'primary' : 'secondary'}`} key={person.id} onClick={() => update(s => { s.game.finale.spotlightPersonId = person.id; })}>{person.name}</button>)}</div></>}
    {slide?.kind === 'singles' && <div className="singles-reveal">{slide.players.map(({ person, pair }) => <div className="singles-card" key={person.id}><div className="polaroid"><StoredImage id={pair.then?.cropImageId} alt={`${person.name} as a child`}/><span className="handwritten polaroid-caption">back then</span></div><span className="reveal-arrow handwritten">→</span><div className="polaroid"><StoredImage id={pair.now?.cropImageId} alt={`${person.name} now`}/><span className="handwritten polaroid-caption">all grown up</span></div><strong>{person.name}</strong></div>)}</div>}
  </>}</main>;
}
