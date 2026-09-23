import { Ghost, Trophy } from 'lucide-react';
import { turnScore } from '../logic/turns';
import type { Context } from '../types';
export function Finale({ segment, event }: Context) {
  const game = segment.game;
  const totals = event.teams.map(team => {
    const turns = game.turns.filter(t => t.teamId === team.id);
    return { ...team, guessed: turns.reduce((n, t) => n + t.results.filter(r => r.outcome === 'guessed').length, 0), points: turns.reduce((n, t) => n + turnScore(t, event.correctPoints), 0) };
  }).sort((a, b) => b.points - a.points);
  const best = [...game.turns].sort((a, b) => turnScore(b, event.correctPoints) - turnScore(a, event.correctPoints))[0];
  const bestTeam = best && event.teams.find(t => t.id === best.teamId);
  const stumped = game.turns.flatMap(t => t.results.filter(r => r.outcome === 'skipped').map(r => r.text));
  return <main className="game-stage aio-finale">
    <div className="question-intro"><span className="eyebrow">CURTAIN CALL</span><h1>That’s a wrap<span className="accent">.</span></h1></div>
    <div className="aio-finale-grid">
      <section className="panel"><div className="panel-heading"><Trophy size={21}/><h2>This activity</h2></div>
        {totals.map(t => <div className="aio-total" key={t.id}><span className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><span className="muted">{t.guessed} guessed</span><b>+{t.points}</b></div>)}
        {best && bestTeam && turnScore(best, event.correctPoints) > 0 && <p className="muted">Turn of the night: <b>{bestTeam.name}</b>{best.guesserName ? `, with ${best.guesserName} guessing` : ''} — {best.results.filter(r => r.outcome === 'guessed').length} in one go.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><Ghost size={21}/><h2>Nobody got these</h2></div>
        {stumped.length ? <ul className="turn-results">{stumped.map((text, i) => <li key={`${text}-${i}`} className="skipped">{text}</li>)}</ul> : <p className="muted">Not a single skip. Suspiciously good.</p>}
      </section>
    </div>
  </main>;
}
