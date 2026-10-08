import { ArrowRight, Eye, Lightbulb, Search, Sparkles } from 'lucide-react';
import { Scoreboard } from '../../src/core/teams/Scoreboard';
import { Timer } from '../../src/core/play/TimerView';
import { useCountdown } from '../../src/core/play/timer';
import { advance, awardId, discussing, reveal, scoreTeam, showClue } from './logic';
import { Rules } from './Rules';
import type { Card, Context, Game } from './types';
const steps: Record<Game['step'], string> = { rules: 'THE 30-SECOND BRIEF', pitch: 'INVESTIGATE', vote: 'FIRST VOTE', clue: 'STICK OR SWITCH', finalVote: 'FINAL VOTE', reveal: 'THE TRUTH' };
export function PitchCard({ card, index, revealed }: { card: Card; index: number; revealed: boolean }) {
  if (revealed && card.kind === 'real') return <article className="rr-proof" aria-label={`Pitch ${'ABC'[index]}`}>
    <div className="rr-proof-heading"><span className="rr-letter">{'ABC'[index]}</span><h2>{card.title}</h2><div className="rr-evidence"><b>{card.status}</b><a href={card.source.url} target="_blank" rel="noreferrer" title={card.source.label} aria-label={`Source for ${card.title}`}>Source ↗</a></div></div><p>{card.summary}</p>
  </article>;
  return <article className="rr-card" aria-label={`Pitch ${'ABC'[index]}`}>
    <div className="rr-card-top"><span className="rr-letter">{'ABC'[index]}</span><Search size={24} aria-hidden="true"/></div>
    <h2>{card.title}</h2><p>{card.pitch}</p>
  </article>;
}
export function Stage(ctx: Context) {
  const { segment, event, update, updateEvent } = ctx, g = segment.game, round = g.deck[g.index];
  const remaining = useCountdown(g.timer), seconds = Math.ceil(remaining / 1000), revealed = g.step === 'reveal';
  if (!round) return <div className="empty-state"><h2>Your invention bank is ready.</h2><button className="button primary" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Game setup</button></div>;
  const fakeIndex = round.cards.findIndex(c => c.kind === 'fiction'), fake = round.cards[fakeIndex];
  const subtitle = g.step === 'pitch' ? remaining === 0 ? 'Time! Agree on your first choice. Host: call the vote.' : remaining > g.timer.durationMs - 20000 ? 'Start in pairs: which pitch makes you suspicious, and why?' : 'Bring your ideas to the team. Agree on A, B or C.' : g.step === 'clue' ? remaining === 0 ? 'Time! Decide whether to stick or switch. Host: call the final vote.' : 'A little more information. Keep your choice—or change your mind.' : g.step === 'vote' ? 'Host: count 3, 2, 1. All teams show A / B / C together.' : g.step === 'finalVote' ? 'One last commitment. Host: count down; all teams show their FINAL choice.' : revealed ? 'Correct FINAL choices earn points. Switching has no penalty.' : 'Everyone plays every round. No props or specialist knowledge.';
  return <div className="stage-layout rr-stage"><main className="game-stage">
    <header className="rr-round-head"><div><span className="eyebrow">{g.step === 'rules' ? 'REAL OR RIDICULOUS?' : `ROUND ${g.index + 1} / ${g.deck.length}`}</span><div className="rr-step"><span className="rr-step-dot"/>{steps[g.step]}</div></div>{discussing(g) ? <Timer state={g.timer} onChange={timer => update(s => { s.game.timer = timer; })} label={g.step === 'clue' ? 'Stick or switch timer' : 'Discussion timer'}/> : <div className="rr-clock" role="timer" aria-label="Timer stopped"><b>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</b><small>{g.step === 'rules' ? 'per discussion' : 'stopped'}</small></div>}</header>
    <section className="rr-scene">
      {g.step === 'rules' ? <div className="rr-brief"><span className="eyebrow">SOMEBODY MADE THAT?</span><h1>Two are real.<br/><span className="accent">One is ours.</span></h1><Rules points={segment.points.correct}/><p className="rr-definition">Documented means a product, prototype, patent or announced concept—not necessarily something sold.</p><p>Signal 1 / 2 / 3 fingers, or say A / B / C. Stay seated or pass. Rotate discussion starters.</p></div> : <>
        <h1 className="rr-question">{revealed ? `${'ABC'[fakeIndex]} · ${fake.title} is our fiction.` : g.step === 'vote' ? 'First instinct. Commit together.' : g.step === 'finalVote' ? 'Stick or switch? Final choices.' : 'Which pitch did we make up?'}</h1>
        <div className={`rr-cards ${revealed ? "rr-reveal-cards" : ""}`}>{round.cards.map((card, i) => (!revealed || card.kind === 'real') && <PitchCard card={card} index={i} revealed={revealed} key={card.id}/>)}</div>
        {(g.step === 'clue' || g.step === 'finalVote') && <div className="rr-clue"><Lightbulb size={25}/><div><b>ONE MORE CLUE · {'ABC'[round.clueIndex]} · {round.cards[round.clueIndex].title}</b><p>{round.cards[round.clueIndex].clue}</p></div></div>}
        {revealed && fake.kind === 'fiction' && <div className="rr-wonder"><Sparkles size={24}/><p>{fake.wonder}</p></div>}
        {!revealed && <p className={`rr-cue ${g.step === 'vote' || g.step === 'finalVote' ? 'rr-vote-cue' : ''}`} aria-live="polite">{subtitle}</p>}
      </>}
    </section>
    {revealed && <div className="rr-awards" aria-label="Award correct teams"><span>Correct final votes · select again to undo</span><div>{event.teams.map((team, i) => {
      const awarded = event.scoreEntries.some(e => e.segmentId === segment.segmentId && e.roundId === awardId(segment, team.id) && e.active);
      return <button key={team.id} className="button secondary" title={team.name} aria-label={`Award ${team.name}`} aria-pressed={awarded} onClick={() => scoreTeam(ctx, i)}><kbd>{i + 1}</kbd><span>{team.name}</span><b>{awarded ? '✓' : `+${segment.points.correct}`}</b></button>;
    })}</div></div>}
    <footer className="rr-actions"><span>{revealed ? 'Discuss the discoveries, award points, then continue.' : g.step === 'vote' ? 'Collect every first vote before showing the clue.' : g.step === 'finalVote' ? 'Collect every final vote before revealing.' : 'The host controls the pace. Zero never reveals the answer.'}</span>
      {g.step === 'vote' ? <button className="button primary large" onClick={() => update(s => showClue(s))}><Lightbulb size={19}/> One more clue <kbd>H</kbd></button> : g.step === 'finalVote' ? <button className="button primary large" onClick={() => update(s => reveal(s))}><Eye size={19}/> Reveal the truth <kbd>R</kbd></button> : <button className="button primary large" onClick={() => update(s => advance(s))}>{g.step === 'rules' ? 'Start first round' : g.step === 'pitch' ? 'Call first vote' : g.step === 'clue' ? 'Call final vote' : g.index === g.deck.length - 1 ? 'Activity results' : 'Next round'}<ArrowRight size={19}/><kbd>N</kbd></button>}
    </footer>
  </main><Scoreboard event={event} updateEvent={updateEvent} segmentId={segment.segmentId} playedCounts={Object.fromEntries(event.teams.map(t => [t.id, g.index + (revealed ? 1 : 0)]))}/></div>;
}
