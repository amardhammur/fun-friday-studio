import { Play } from 'lucide-react';
import { start, validTeams } from './logic';
import type { Context } from './types';

export function Setup(ctx: Context) {
  const { segment, event, update } = ctx, settings = segment.settings;
  const minutes = Math.round(settings.preparationMinutes + event.teams.length * settings.performanceSeconds / 60 + 7);
  return <div className="setup-content cc-setup">
    <div className="section-heading"><span className="eyebrow">THE AD BREAK</span><h1>Commercial Clash<span className="accent">.</span></h1><p>Make an ad. Perform. The judge panel scores offline.</p></div>
    <section className="panel cc-settings">
      <label>Preparation<select aria-label="Preparation" value={settings.preparationMinutes} onChange={e => update(s => { s.settings.preparationMinutes = +e.target.value; })}>{[5, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      <label>Each ad<select aria-label="Each ad" value={settings.performanceSeconds} onChange={e => update(s => { s.settings.performanceSeconds = +e.target.value; })}>{[120, 180, 240].map(n => <option key={n} value={n}>{n / 60} minutes</option>)}</select></label>
    </section>
    <p className="cc-team-summary">{event.teams.length} teams · about {minutes} minutes</p>
    <div className="cc-team-chips">{event.teams.map(t => <span key={t.id}><span className="team-dot" style={{ background: t.color }}/>{t.name}</span>)}</div>
    {!validTeams(event) && <p className="warning-text">Add 3–8 named teams in event planning.</p>}
    <div className="setup-footer"><span className="privacy-note">Spin for the product on stage</span><button className="button primary large" disabled={!validTeams(event)} onClick={() => start(ctx)}><Play size={20}/> Start activity</button></div>
  </div>;
}
