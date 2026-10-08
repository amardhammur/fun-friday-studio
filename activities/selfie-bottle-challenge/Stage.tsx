import { ArrowLeft, ArrowRight, Flag, Play, Trophy } from 'lucide-react';
import { Timer } from '../../src/core/play/TimerView';
import { Scoreboard } from '../../src/core/teams/Scoreboard';
import { canVisitTurn, currentTurn, endTurn, expireTurn, multiplier, playerNumber, playingTurn, showResults, startTurn, teamCount, toggleClock, visitTurn } from './logic';
import { ResultEntry } from './ResultEntry';
import { BottleGraphic } from './BottleGraphic';
import type { Context } from './types';

export function Stage(context: Context) {
  const { segment, event, update, updateEvent } = context, game = segment.game, turn = currentTurn(game), active = playingTurn(game);
  if (!turn) return <div className="empty-state"><h2>Set up the player turns first.</h2><button className="button primary" onClick={() => update(s => { s.phase = 'setup'; s.setupStepId = 'game'; })}>Set up challenge</button></div>;
  const team = event.teams.find(t => t.id === turn.teamId), player = event.players.find(p => p.id === turn.playerId);
  if (!team || !player) return <div className="empty-state">This turn’s roster player or team is missing.</div>;
  const next = game.turns[game.currentTurnIndex + 1], nextTeam = next && event.teams.find(t => t.id === next.teamId), complete = game.turns.every(t => t.status === 'done'), weight = multiplier(segment, event);
  const frontier = game.turns.findIndex(t => t.status !== 'done');
  return <div className="stage-layout bottle-stage"><main className="game-stage">
    <div className="round-header">
      <div className="active-team" style={{ '--team-color': team.color } as React.CSSProperties}><span className="team-dot" style={{ background: team.color }}/><div><small>AT THE BOTTLE</small><strong>{team.name}</strong></div></div>
      <div className="round-count"><span>Turn <b>{game.currentTurnIndex + 1}</b> of {game.turns.length}</span><small>Player {playerNumber(game, turn)} of {segment.settings.playersPerTeam}</small></div>
      <div className="point-stake"><b>1</b><span>BASE POINT<br/>PER TOOTHPICK · ×{weight}</span></div>
    </div>
    <div className="round-scene bottle-scene">
    {turn.status === 'pending' && <div className="bottle-ready">
      <BottleGraphic animated/>
      <div className="question-intro"><h1>Ready?</h1><p className="muted">10 toothpicks · {segment.settings.turnSeconds} seconds</p></div>
    </div>}
    {turn.status === 'playing' && <div className="bottle-playing">
      <p className="muted">10 toothpicks</p>
    </div>}
    {turn.status === 'counting' && <div className="bottle-counting">
      <div className="question-intro"><h1>Turn over.</h1></div>
      <ResultEntry context={context} turn={turn}/>
    </div>}
    {turn.status === 'done' && <div className="bottle-summary">
      <div className="question-intro"><span className="eyebrow">COUNT CONFIRMED</span><h1>{turn.count} / 10</h1><p className="muted">Team total: {teamCount(game, team.id)} ×{weight} = {teamCount(game, team.id) * weight} pts</p></div>
      <ResultEntry context={context} turn={turn}/>
    </div>}
    {active && <section className={`bottle-clock ${active.id !== turn.id ? 'bottle-live-clock' : ''}`} aria-label="Current player clock">
      {active.id !== turn.id && <p className="muted"><b>{event.teams.find(t => t.id === active.teamId)?.name}</b> · Player {playerNumber(game, active)}</p>}
      <Timer state={active.timer} label="Player turn timer" allowReset={false} onChange={() => update(s => toggleClock(s, active.id))} onExpire={() => update(s => expireTurn(s))}/>
      {active.timer.deadlineAt === undefined && <p role="status" className="warning-text">Paused</p>}
    </section>}
    </div>
    <div className="round-actions">
      {turn.status === 'pending' && <button className="button primary large" onClick={() => update(s => startTurn(s))}><Play size={20}/> Start turn</button>}
      {turn.status === 'playing' && <button className="button secondary" onClick={() => update(s => endTurn(s, turn.id))}><Flag size={18}/> Finish turn</button>}
      {turn.status === 'done' && <>
        {next && <button className="button primary large" onClick={() => update(s => visitTurn(s, s.game.currentTurnIndex + 1))}>Next: {nextTeam?.name ?? 'team'}<ArrowRight size={18}/></button>}
        {complete && <button className="button primary large" onClick={() => update(showResults)}><Trophy size={18}/> Activity results</button>}
      </>}
    </div>
    {frontier !== -1 && frontier !== game.currentTurnIndex && <button className="button subtle" onClick={() => update(s => visitTurn(s, frontier))}>Return to current player <ArrowRight size={17}/></button>}
    <div className="round-navigation" aria-label="Player turns">
      <button className="icon-button" aria-label="Previous player" disabled={!canVisitTurn(game, game.currentTurnIndex - 1)} onClick={() => update(s => visitTurn(s, s.game.currentTurnIndex - 1))}><ArrowLeft size={18}/></button>
      <div className="round-squares">{game.turns.map((t, i) => <button key={t.id} className={`round-square ${t.status === 'done' ? 'played' : ''}`} aria-label={`Player turn ${i + 1}${t.status === 'done' ? `: ${t.count} valid toothpicks` : ''}`} aria-current={i === game.currentTurnIndex ? 'step' : undefined} disabled={!canVisitTurn(game, i)} onClick={() => update(s => visitTurn(s, i))}>{t.count ?? ''}</button>)}</div>
      <button className="icon-button" aria-label="Next player" disabled={!canVisitTurn(game, game.currentTurnIndex + 1)} onClick={() => update(s => visitTurn(s, s.game.currentTurnIndex + 1))}><ArrowRight size={18}/></button>
    </div>
  </main><Scoreboard event={event} updateEvent={updateEvent} segmentId={segment.segmentId} activeTeamId={team.id} playedCounts={Object.fromEntries(event.teams.map(t => [t.id, game.turns.filter(x => x.teamId === t.id && x.status === 'done').length]))}/></div>;
}
