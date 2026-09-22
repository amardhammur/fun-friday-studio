import { useState } from 'react';
import { Check, Coins, Eye, X } from 'lucide-react';
import { teamScore } from '../scoring';
import type { EventSession } from '../types';
import { clampWager, maxWager, setWagerResult } from './wager';

export function Wager({ event, onChange, onFinish }: { event: EventSession; onChange: (change: (draft: EventSession) => void) => void; onFinish: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const wager = event.wager!, bets = wager.bets;
  const allBetsIn = event.teams.every(t => bets[t.id] !== undefined);
  const marked = (teamId: string) => event.scoreEntries.find(e => e.id === `wager-${teamId}`);
  return <main className="wager-stage"><span className="eyebrow">THE FINAL WAGER</span>
    {!revealed ? <><h1>Place your bets<span className="accent">.</span></h1><p className="handwritten">Bet what you dare. Get it wrong and it’s gone.</p>
      <div className="wager-bets">{event.teams.map(team => { const cap = maxWager(event.scoreEntries, team.id);
        return <label className="wager-bet" key={team.id} style={{ '--team-color': team.color } as React.CSSProperties}>
          <span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong>
          <small>{teamScore(event.scoreEntries, team.id)} pts · max {cap}</small>
          <input type="number" min={0} max={cap} aria-label={`Wager for ${team.name}`} value={bets[team.id] ?? ''} onChange={e => onChange(s => { s.wager!.bets[team.id] = clampWager(s.scoreEntries, team.id, +e.target.value); })}/>
        </label>;
      })}</div>
      <button className="button primary large" disabled={!allBetsIn} onClick={() => setRevealed(true)}><Eye size={20}/> Reveal the question</button></>
    : <><h1>{wager.question}</h1><p className="wager-answer"><Coins size={19}/> {wager.answer}</p>
      <div className="wager-bets">{event.teams.map(team => { const entry = marked(team.id), bet = bets[team.id] ?? 0;
        return <div className="wager-bet" key={team.id} style={{ '--team-color': team.color } as React.CSSProperties}>
          <span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong><small>bet {bet}</small>
          <button className={`button small-button ${entry && entry.points > 0 ? 'correct selected' : 'secondary'}`} aria-pressed={!!entry && entry.points > 0} onClick={() => onChange(s => { s.scoreEntries = setWagerResult(s.scoreEntries, team.id, bet, true); })}><Check size={17}/> +{bet}</button>
          <button className={`button small-button ${entry && entry.points <= 0 ? 'missed selected' : 'secondary'}`} aria-pressed={!!entry && entry.points <= 0} onClick={() => onChange(s => { s.scoreEntries = setWagerResult(s.scoreEntries, team.id, bet, false); })}><X size={17}/> −{bet}</button>
        </div>;
      })}</div>
      <button className="button primary large" disabled={event.teams.some(t => !marked(t.id))} onClick={onFinish}>The final results</button></>}
  </main>;
}
