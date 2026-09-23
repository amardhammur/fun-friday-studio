import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, EyeOff, Play, SkipForward, Trophy, Undo2 } from 'lucide-react';
import { Timer } from '../../../src/core/play/TimerView';
import { Scoreboard } from '../../../src/core/teams/Scoreboard';
import { currentPrompt, currentTurn, endTurn, markGuessed, markSkipped, moveTurn, scoreChange, startTurn, turnScore, undoLast } from '../logic/turns';
import type { Context } from '../types';
export function Stage(context: Context) {
  const { segment, event, update, updateEvent } = context, game = segment.game, turn = currentTurn(game);
  const [guesser, setGuesser] = useState('');
  if (!turn) return <div className="empty-state"><h2>This game has no turns yet.</h2><button className="button primary" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Set up game</button></div>;
  const team = event.teams.find(t => t.id === turn.teamId);
  if (!team) return <div className="empty-state">This turn’s team is missing.</div>;
  const prompt = currentPrompt(game), guessed = turn.results.filter(r => r.outcome === 'guessed').length, skipped = turn.results.length - guessed;
  const next = game.turns[game.currentTurnIndex + 1], nextTeam = next && event.teams.find(t => t.id === next.teamId), complete = game.turns.every(t => t.status === 'done');
  const spent = !prompt;
  return <div className="stage-layout"><main className="game-stage">
    <div className="round-header">
      <div className="active-team" style={{ '--team-color': team.color } as React.CSSProperties}><span className="team-dot" style={{ background: team.color }}/><div><small>ON THEIR FEET</small><strong>{team.name}</strong></div></div>
      <div className="round-count"><span>Turn <b>{game.currentTurnIndex + 1}</b> of {game.turns.length}</span><small>{turn.guesserName ? `${turn.guesserName} is guessing` : 'One teammate faces away'}</small></div>
      <div className="point-stake"><b>{event.correctPoints}</b><span>POINTS<br/>PER PROMPT</span></div>
    </div>

    {turn.status === 'pending' && <div className="round-scene aio-ready">
      <div className="question-intro"><span className="eyebrow">NEXT UP</span><h1>{team.name}, you’re on.</h1><p className="muted">Pick one teammate to sit with their back to the screen. Everyone else acts. No talking, no spelling, no pointing at the words.</p></div>
      <label className="aio-guesser"><span className="eyebrow">WHO’S GUESSING?</span><input aria-label="Name of the person guessing" maxLength={40} placeholder="Optional" value={guesser} onChange={e => setGuesser(e.target.value)}/></label>
    </div>}

    {turn.status === 'acting' && <div className="round-scene aio-acting" key={game.cursor}>
      {spent ? <div className="prompt-card spent"><b>That’s the whole deck.</b><small>End the turn and the points are banked.</small></div> : <div className="prompt-card"><span className="eyebrow">{prompt!.category}</span><b>{prompt!.text}</b></div>}
      <div className="aio-clock"><Timer state={game.timer} label="Turn timer" onChange={timer => update(s => { s.game.timer = timer; })}/></div>
      <div className="turn-tally"><span><Check size={16}/> {guessed} guessed</span><span><SkipForward size={16}/> {skipped} skipped</span><span className="turn-running"><b>+{turnScore(turn, event.correctPoints)}</b> this turn</span></div>
    </div>}

    {turn.status === 'done' && <div className="round-scene aio-summary">
      <div className="question-intro"><span className="eyebrow">TIME</span><h1>{team.name} got {guessed}.</h1></div>
      <div className="turn-summary"><div><b>{guessed}</b><small>guessed</small></div><div><b>{skipped}</b><small>skipped</small></div><div className="turn-summary-points"><b>+{turnScore(turn, event.correctPoints)}</b><small>points</small></div></div>
      {!!turn.results.length && <ul className="turn-results">{turn.results.map((r, i) => <li key={`${r.text}-${i}`} className={r.outcome}>{r.outcome === 'guessed' ? <Check size={15}/> : <SkipForward size={15}/>}{r.text}</li>)}</ul>}
    </div>}

    <div className="round-actions">
      {turn.status === 'pending' && <button className="button primary large" onClick={() => { update(s => startTurn(s, guesser)); setGuesser(''); }}><Play size={20}/> Start the turn</button>}
      {turn.status === 'acting' && <>
        <div className="result-buttons">
          <button className="button primary large" disabled={spent} onClick={() => scoreChange(context, (s, e) => markGuessed(s, e))}><Check size={21}/> Got it <b>+{event.correctPoints}</b></button>
          <button className="button secondary large" disabled={spent} onClick={() => scoreChange(context, (s, e) => markSkipped(s, e))}><SkipForward size={19}/> Skip</button>
        </div>
        <div className="button-row centered">
          <button className="button subtle small-button" disabled={!turn.results.length} onClick={() => scoreChange(context, (s, e) => undoLast(s, e))}><Undo2 size={16}/> Undo</button>
          <button className="button secondary" onClick={() => update(s => endTurn(s))}><EyeOff size={17}/> End turn</button>
        </div>
      </>}
      {turn.status === 'done' && <button className="button primary large" disabled={!next && !complete} onClick={() => update(s => moveTurn(s, 1))}>{next ? `Next: ${nextTeam?.name ?? 'team'}` : 'Final results'}{next ? <ArrowRight size={18}/> : <Trophy size={18}/>}</button>}
    </div>

    <div className="round-navigation">
      <button className="icon-button" aria-label="Previous turn" disabled={game.currentTurnIndex === 0} onClick={() => update(s => moveTurn(s, -1))}><ArrowLeft size={18}/></button>
      <div className="round-squares">{game.turns.map((t, i) => <button key={t.id} aria-label={`Turn ${i + 1}`} onClick={() => update(s => { s.game.currentTurnIndex = i; })}>{t.status === 'done' ? t.results.filter(r => r.outcome === 'guessed').length : ''}</button>)}</div>
      <button className="icon-button" aria-label="Next turn" disabled={!next} onClick={() => update(s => moveTurn(s, 1))}><ArrowRight size={18}/></button>
    </div>
  </main><Scoreboard event={event} updateEvent={updateEvent} activeTeamId={team.id} playedCounts={Object.fromEntries(event.teams.map(t => [t.id, game.turns.filter(x => x.teamId === t.id && x.status === 'done').length]))}/></div>;
}
