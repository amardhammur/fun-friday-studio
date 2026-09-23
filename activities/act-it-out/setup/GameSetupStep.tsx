import { Check, Flag, Play, Users } from 'lucide-react';
import { TeamEditor } from '../../../src/core/teams/TeamEditor';
import { cardsNeeded, eligiblePrompts, startNewGame } from '../logic/turns';
import { rules } from '../rules';
import type { Context } from '../types';
export function GameSetupStep({ segment, event, update, updateEvent, rosterLocked }: Context) {
  const { settings } = segment, turns = event.teams.length * settings.roundsPerTeam;
  const valid = event.teams.length > 0 && event.teams.every(t => t.name.trim()) && eligiblePrompts(settings).length >= cardsNeeded(event.teams.length, settings.roundsPerTeam);
  const start = () => {
    const staged = { ...event, people: [...event.people], facePairs: [...event.facePairs], teams: [...event.teams], scoreEntries: [...event.scoreEntries], assets: { ...event.assets } };
    // update() reports a throw itself instead of rethrowing, so a rejected start is only visible from
    // inside the callback. Without this flag the scoreEntries write below would run anyway, and its
    // safety would rest on startNewGame's statement order rather than on anything here.
    let started = false;
    update(s => { startNewGame(s, staged); started = true; });
    if (started) updateEvent(d => { d.scoreEntries = staged.scoreEntries; });
  };
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">02 / SET THE CLOCK</span><h1>How long have they got<span className="accent">?</span></h1><p>{event.correctPoints} points for every prompt the guesser gets. Skips cost nothing, so keep moving.</p></div>
    <div className="aio-setup-grid">
      <section className="panel"><div className="panel-heading"><Users size={21}/><h2>Meet the teams</h2></div><p className="muted">Choose your names and wear your colours.</p>
        <fieldset disabled={rosterLocked} style={{ border: 0, padding: 0, margin: 0 }}><TeamEditor teams={[...event.teams]} onChange={teams => updateEvent(s => { s.teams = teams; })}/></fieldset>
        {rosterLocked && <p className="muted">People and teams stay the same across activities. Import a replacement people library to reset the whole event.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><Flag size={21}/><h2>The game plan</h2></div>
        <div className="segmented aio-rule" role="group" aria-label="How the team gives clues">{(['act', 'describe'] as const).map(rule => <button key={rule} aria-pressed={settings.rule === rule} onClick={() => update(s => { s.settings.rule = rule; })}><b>{rules[rule].label}</b><small>{rules[rule].hint}</small></button>)}</div>
        <div className="rule-card"><strong>01</strong><div><b>One teammate faces away</b><p>{rules[settings.rule].setup}</p></div></div>
        <div className="rule-card"><strong>02</strong><div><b>Race the clock</b><p>Get through as many as you can. {event.correctPoints} points each.</p></div></div>
        <div className="rule-card"><strong>03</strong><div><b>Skip freely</b><p>A skipped prompt is gone for good and costs nothing.</p></div></div>
        <label className="aio-number"><span><b>Turn length</b><small>Seconds on the clock</small></span><input type="number" aria-label="Turn length in seconds" min={15} max={300} step={15} value={settings.turnSeconds} onChange={e => update(s => { s.settings.turnSeconds = Math.min(300, Math.max(15, Math.round(+e.target.value || 90))); })}/></label>
        <label className="aio-number"><span><b>Turns per team</b><small>Everyone goes once per round</small></span><input type="number" aria-label="Turns per team" min={1} max={5} value={settings.roundsPerTeam} onChange={e => update(s => { s.settings.roundsPerTeam = Math.min(5, Math.max(1, Math.round(+e.target.value || 1))); })}/></label>
      </section>
    </div>
    <section className="allocation"><div><span className="eyebrow">THE RUNNING ORDER</span><h3>{turns} turns. About {Math.ceil(turns * (settings.turnSeconds + 40) / 60)} minutes.</h3></div>
      <div className="allocation-teams">{event.teams.map(t => <div key={t.id}><span className="team-dot" style={{ background: t.color }}/><span>{t.name || 'Unnamed team'}</span><b>{settings.roundsPerTeam} turn{settings.roundsPerTeam === 1 ? '' : 's'}</b></div>)}</div>
    </section>
    <div className="setup-footer"><span className="privacy-note"><Check size={17}/> Everything is saved on this laptop</span><button className="button primary large" disabled={!valid} onClick={start}><Play size={20}/> Start new game</button></div>
  </div>;
}
