import { Check, Clock, Play } from 'lucide-react';
import { eventDraft } from '../../src/core/event';
import { multiplier, setupIssues, startNewGame } from './logic';
import type { Context } from './types';

export function Setup({ segment, event, update, updateEvent }: Context) {
  const { settings } = segment, issues = setupIssues(settings, event), weight = multiplier(segment, event);
  const start = () => {
    const staged = eventDraft(event); let started = false;
    update(s => { startNewGame(s, staged); started = true; });
    if (started) updateEvent(e => { e.scoreEntries = e.scoreEntries.filter(entry => entry.segmentId !== segment.segmentId); });
  };
  return <div className="setup-content bottle-setup">
    <div className="section-heading"><span className="eyebrow">SELFIE BOTTLE CHALLENGE · SETUP</span><h1>Eyes on the selfie<span className="accent">.</span></h1></div>
    <section className="bottle-start"><div><h3>{event.teams.length * settings.playersPerTeam} turns · {settings.turnSeconds} seconds each</h3><p className="muted">{settings.playersPerTeam} player{settings.playersPerTeam === 1 ? '' : 's'} per team · {settings.turnOrder === 'team-by-team' ? 'One team at a time' : 'Alternate teams'}</p></div><button className="button primary large" disabled={issues.length > 0} onClick={start}><Play size={20}/> Start activity</button></section>
    {issues.length > 0 && <div className="bottle-issues" role="status"><b>Before you start</b><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <details className="panel bottle-options"><summary><Clock size={20}/> Options</summary>
        <div className="bottle-plan-options">
        <fieldset className="bottle-option"><legend>Players per team</legend><div className="segmented" role="group" aria-label="Players per team">{([1, 2, 3] as const).map(n => <button key={n} aria-pressed={settings.playersPerTeam === n} onClick={() => update(s => { s.settings.playersPerTeam = n; })}>{n} player{n === 1 ? '' : 's'}{n === 3 ? ' · default' : ''}</button>)}</div></fieldset>
        <fieldset className="bottle-option"><legend>Time for every player</legend><div className="segmented" role="group" aria-label="Time for every player">{([60, 45] as const).map(seconds => <button key={seconds} aria-pressed={settings.turnSeconds === seconds} onClick={() => update(s => { s.settings.turnSeconds = seconds; })}>{seconds} seconds{seconds === 60 ? ' · default' : ''}</button>)}</div></fieldset>
        <fieldset className="bottle-option"><legend>Turn order</legend><div className="segmented" role="group" aria-label="Turn order">{([
          ['team-by-team', 'One team at a time'], ['round-robin', 'Alternate teams'],
        ] as const).map(([order, label]) => <button key={order} aria-pressed={settings.turnOrder === order} onClick={() => update(s => { s.settings.turnOrder = order; })}>{label}</button>)}</div></fieldset>
        </div>
        <p className="bottle-scoring-note">10 toothpicks per player · 1 base point each · ×{weight} multiplier</p>
    </details>
    <p className="privacy-note"><Check size={17}/> Saved on this laptop</p>
  </div>;
}
