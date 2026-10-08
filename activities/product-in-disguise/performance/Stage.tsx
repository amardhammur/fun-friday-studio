import { useEffect } from 'react';
import { ArrowRight, Clapperboard, Eye, Laugh, Megaphone, RotateCw, Sparkles, Trophy } from 'lucide-react';
import { Timer } from '../../../src/core/play/TimerView';
import { RevealAnswer } from '../../../src/components/RevealAnswer';
import { ProductPicture } from '../ProductPicture';
import { advance, awardResults, castVote, completeBallot, completeVotes, editVotes, finishSpin, reveal, spin, timed } from './logic';
import { ProductWheel } from './ProductWheel';
import { awards, type Context } from './types';

const awardIcons = [Laugh, Sparkles, Megaphone];
export function Stage(ctx: Context) {
  const { segment, event, update } = ctx, g = segment.game;
  useEffect(() => {
    if (g.step !== 'wheel' || !g.spin) return;
    const timeout = setTimeout(() => update(s => finishSpin(s)), Math.max(0, g.spin.endsAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [g.step, g.spin?.endsAt, update]);
  if (!g.teamIds.length || g.step !== 'wheel' && !g.product) return <div className="empty-state"><h2>Set up your teams first.</h2><button className="button primary" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Game setup</button></div>;
  const team = event.teams.find(t => t.id === g.teamIds[g.performanceIndex]);
  const voter = event.teams.find(t => t.id === g.teamIds[g.ballotIndex]);
  const award = awards[g.awardIndex], revealed = g.revealedCount > g.awardIndex;
  const winners = revealed ? awardResults(g, award.id) : [];
  const nextLabel = g.step === 'product' ? 'Start preparation' : g.step === 'prepare' ? 'Start first ad' : g.step === 'perform' ? g.performanceIndex === g.teamIds.length - 1 ? 'Start voting' : 'Next team' : g.step === 'vote' ? 'Record votes' : g.step === 'ballots' ? g.ballotIndex === g.teamIds.length - 1 ? 'Lock votes' : 'Next ballot' : g.awardIndex === awards.length - 1 ? 'See results' : 'Next award';
  const blocked = g.step === 'ballots' && (!completeBallot(g.ballots[g.teamIds[g.ballotIndex]]) || g.ballotIndex === g.teamIds.length - 1 && !completeVotes(g));
  return <div className="stage-layout cc-stage"><main className="game-stage">
    <header className="cc-head"><span className="eyebrow">{g.step === 'perform' ? `AD ${g.performanceIndex + 1} / ${g.teamIds.length}` : g.step === 'ballots' ? `BALLOT ${g.ballotIndex + 1} / ${g.teamIds.length}` : g.step === 'reveal' ? `AWARD ${g.awardIndex + 1} / ${awards.length}` : 'COMMERCIAL CLASH'}</span>{timed(g) && <Timer state={g.timer} label={g.step === 'prepare' ? 'Preparation timer' : g.step === 'perform' ? 'Performance timer' : 'Voting timer'} onChange={timer => update(s => { s.game.timer = timer; })}/>}</header>
    <section className="cc-scene">
      {g.step === 'wheel' ? <div className="cc-wheel-layout"><div><h1>Pick your product.</h1><p>Same product for every team.</p></div><ProductWheel spin={g.spin}/></div>
      : g.step === 'product' ? <div className="cc-product-reveal" role="status"><div className="polaroid now-reveal cc-drawn-product"><ProductPicture product={g.product!}/></div><RevealAnswer eyebrow="YOUR PRODUCT" title={g.product!.name}/></div>
      : g.step === 'prepare' ? <div className="cc-prepare"><div><h1>Make your ad.</h1><p>A ridiculous {segment.settings.performanceSeconds / 60}-minute commercial.</p><div className="cc-beats"><span>Problem</span><ArrowRight/><span>Demo</span><ArrowRight/><span>Tagline</span></div><p className="cc-role-note">Write, direct, act or make sound effects.</p></div><div className="cc-product"><ProductPicture product={g.product!}/><strong>{g.product!.name}</strong></div></div>
      : g.step === 'perform' ? <div className="cc-on-air"><span className="cc-air-sign"><Clapperboard size={25}/> ON AIR</span><h1 style={{ color: team?.color }}>{team?.name}</h1><p>Give {g.product!.name.toLowerCase()} its big moment.</p></div>
      : g.step === 'vote' ? <div className="cc-vote"><h1>Vote.</h1><div className="cc-award-options">{awards.map((a, i) => { const Icon = awardIcons[i]; return <div key={a.id}><Icon size={35}/><h2>{a.label}</h2></div>; })}</div><p>One vote per award. Pick another team.</p><p className="cc-vote-note">Tell the host your choices when called.</p></div>
      : g.step === 'ballots' ? <div className="cc-ballots"><h1>{voter?.name}’s votes</h1><div>{awards.map(a => <label key={a.id}>{a.label}<select aria-label={a.label} value={g.ballots[voter!.id][a.id] ?? ''} onChange={e => update(s => castVote(s, voter!.id, a.id, e.target.value || null))}><option value="">Choose a team</option>{g.teamIds.filter(id => id !== voter?.id).map(id => <option key={id} value={id}>{event.teams.find(t => t.id === id)?.name}</option>)}</select></label>)}</div></div>
      : <div className={revealed ? 'cc-award-reveal' : 'cc-award-hidden'} key={`${g.awardIndex}:${revealed}`}><div className={`polaroid cc-award-card ${revealed ? 'now-reveal' : ''}`}><Trophy size={100}/><span className="handwritten">{revealed ? 'Take a bow.' : 'And the award goes to…'}</span></div>{revealed ? <RevealAnswer eyebrow={winners.length > 1 ? 'JOINT WINNERS' : 'AUDIENCE WINNER'} title={award.label}><p className="cc-winner-name">{winners.map(w => event.teams.find(t => t.id === w.teamId)?.name).join(' & ')}</p><p className="cc-winner-votes">{winners[0]?.votes} {winners[0]?.votes === 1 ? 'vote' : 'votes'} · +{(winners[0]?.votes ?? 0) * segment.points.correct} pts{winners.length === 1 ? '' : ' each'}</p></RevealAnswer> : <h1>{award.label}</h1>}</div>}
    </section>
    <footer className="cc-actions"><div>{g.step === 'product' && <button className="button secondary" onClick={() => spin(ctx)}><RotateCw size={19}/> Spin again</button>}{g.step === 'ballots' && g.ballotIndex > 0 && <button className="button subtle" onClick={() => update(s => { s.game.ballotIndex--; })}>Previous ballot</button>}{g.step === 'reveal' && <button className="button subtle" onClick={() => editVotes(ctx)}>Edit votes</button>}{g.step === 'vote' && <span>Each vote earns +{segment.points.correct}.</span>}{g.step === 'prepare' && <span>Same product. Your own twist.</span>}</div>{g.step === 'wheel' ? <button className="button primary large" disabled={!!g.spin} onClick={() => spin(ctx)}><RotateCw size={19}/>{g.spin ? 'Spinning…' : 'Spin the wheel'}</button> : g.step === 'reveal' && !revealed ? <button className="button primary large" onClick={() => reveal(ctx)}><Eye size={19}/> Reveal winner</button> : <button className="button primary large" disabled={blocked} onClick={() => update(s => advance(s))}>{nextLabel}<ArrowRight size={19}/></button>}</footer>
  </main></div>;
}
