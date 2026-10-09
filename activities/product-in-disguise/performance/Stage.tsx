import { useEffect } from 'react';
import { ArrowRight, Clapperboard, RotateCw } from 'lucide-react';
import { Timer } from '../../../src/core/play/TimerView';
import { RevealAnswer } from '../../../src/components/RevealAnswer';
import { ProductPicture } from '../ProductPicture';
import { completeScores, finishSpin, next, setJudgeScore, spin, timed } from './logic';
import { ProductWheel } from './ProductWheel';
import type { Context } from './types';

export function Stage(ctx: Context) {
  const { segment, event, update } = ctx, g = segment.game;
  useEffect(() => {
    // The shared Resume control opens play, even when results were paused.
    if (g.step === 'results') { update(s => { s.phase = 'finale'; }); return; }
    if (g.step !== 'wheel' || !g.spin) return;
    const timeout = setTimeout(() => update(s => finishSpin(s)), Math.max(0, g.spin.endsAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [g.step, g.spin?.endsAt, update]);
  if (g.step === 'results') return null;
  if (!g.teamIds.length || g.step !== 'wheel' && !g.product) return <div className="empty-state"><h2>Set up your teams first.</h2><button className="button primary" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Game setup</button></div>;
  const team = event.teams.find(t => t.id === g.teamIds[g.performanceIndex]);
  const nextLabel = g.step === 'product' ? 'Start preparation' : g.step === 'prepare' ? 'Start first ad' : g.step === 'perform' ? g.performanceIndex === g.teamIds.length - 1 ? 'Enter judge scores' : 'Next team' : 'Save scores & see results';
  const blocked = g.step === 'judging' && !completeScores(g);
  return <div className="stage-layout cc-stage"><main className="game-stage">
    <header className="cc-head"><span className="eyebrow">{g.step === 'perform' ? `AD ${g.performanceIndex + 1} / ${g.teamIds.length}` : g.step === 'judging' ? 'JUDGE PANEL' : 'COMMERCIAL CLASH'}</span>{timed(g) && <Timer state={g.timer} label={g.step === 'prepare' ? 'Preparation timer' : 'Performance timer'} onChange={timer => update(s => { s.game.timer = timer; })}/>}</header>
    <section className="cc-scene">
      {g.step === 'wheel' ? <div className="cc-wheel-layout"><div><h1>Pick your product.</h1><p>Same product for every team.</p></div><ProductWheel spin={g.spin}/></div>
      : g.step === 'product' ? <div className="cc-product-reveal" role="status"><div className="polaroid now-reveal cc-drawn-product"><ProductPicture product={g.product!}/></div><RevealAnswer eyebrow="YOUR PRODUCT" title={g.product!.name}/></div>
      : g.step === 'prepare' ? <div className="cc-prepare"><div><h1>Make your ad.</h1><p>A ridiculous {segment.settings.performanceSeconds / 60}-minute commercial.</p><div className="cc-beats"><span>Problem</span><ArrowRight/><span>Demo</span><ArrowRight/><span>Tagline</span></div><p className="cc-role-note">Write, direct, act or make sound effects.</p></div><div className="cc-product"><ProductPicture product={g.product!}/><strong>{g.product!.name}</strong></div></div>
      : g.step === 'perform' ? <div className="cc-on-air"><span className="cc-air-sign"><Clapperboard size={25}/> ON AIR</span><h1 style={{ color: team?.color }}>{team?.name}</h1><p>Give {g.product!.name.toLowerCase()} its big moment.</p></div>
      : <div className="cc-judging"><h1>Judge scores.</h1><p>The judge panel scores offline. Host: enter each team’s total.</p><div className="cc-score-fields">{g.teamIds.map(id => {
        const scoredTeam = event.teams.find(t => t.id === id)!;
        return <label key={id}><span><span className="team-dot" style={{ background: scoredTeam.color }}/>{scoredTeam.name}</span><input type="number" min="0" step="1" inputMode="numeric" aria-label={`Score for ${scoredTeam.name}`} value={g.scores[id] ?? ''} placeholder="Points" onChange={e => update(s => setJudgeScore(s, id, e.target.value === '' || !e.target.validity.valid ? null : e.target.valueAsNumber))}/></label>;
      })}</div><p className="cc-score-note">Enter whole points, including 0. You can edit scores after saving.</p></div>}
    </section>
    <footer className="cc-actions"><div>{g.step === 'product' && <button className="button secondary" onClick={() => spin(ctx)}><RotateCw size={19}/> Spin again</button>}{g.step === 'prepare' && <span>Same product. Your own twist.</span>}</div>{g.step === 'wheel' ? <button className="button primary large" disabled={!!g.spin} onClick={() => spin(ctx)}><RotateCw size={19}/>{g.spin ? 'Spinning…' : 'Spin the wheel'}</button> : <button className="button primary large" disabled={blocked} onClick={() => next(ctx)}>{nextLabel}<ArrowRight size={19}/></button>}</footer>
  </main></div>;
}
