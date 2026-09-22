import { Check, PencilLine, Sparkles } from 'lucide-react';
import { categories, promptsIn } from '../prompts';
import { eligiblePrompts } from '../logic/turns';
import type { Context } from '../types';
export function PromptsStep({ segment, event, update }: Context) {
  const { settings } = segment, available = eligiblePrompts(settings).length;
  const needed = Math.max(3, event.teams.length * settings.roundsPerTeam * 3);
  const toggle = (category: string) => update(s => { s.settings.categories = s.settings.categories.includes(category) ? s.settings.categories.filter(c => c !== category) : [...s.settings.categories, category]; });
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / STOCK THE DECK</span><h1>What are we acting<span className="accent">?</span></h1><p>Everything is ready to go. Turn a category off if it is not your crowd, or write your own for the in-jokes.</p></div>
    <div className="aio-setup-grid">
      <section className="panel"><div className="panel-heading"><Sparkles size={21}/><h2>Categories</h2></div><p className="muted">All four are on. That is the zero-prep setting.</p>
        <div className="category-grid">{categories.map(category => { const on = settings.categories.includes(category); return <button key={category} className={`category-tile ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(category)}><span className="category-check">{on && <Check size={15}/>}</span><b>{category}</b><small>{promptsIn([category]).length} prompts</small></button>; })}</div>
      </section>
      <section className="panel"><div className="panel-heading"><PencilLine size={21}/><h2>Your own</h2></div><p className="muted">One per line. These get dealt first if they repeat something already in the deck, so your wording wins.</p>
        <textarea aria-label="Your own prompts, one per line" rows={9} placeholder={'The 4pm deploy\nThe kitchen radio\nWhoever keeps booking the big room'} value={settings.customPrompts.join('\n')} onChange={e => update(s => { s.settings.customPrompts = e.target.value.split('\n'); })}/>
      </section>
    </div>
    <section className="allocation"><div><span className="eyebrow">YOUR DECK</span><h3>{available} prompts ready. {event.teams.length} teams, {settings.roundsPerTeam} turn{settings.roundsPerTeam === 1 ? '' : 's'} each.</h3></div>
      {available < needed && <p className="warning-text">You need at least {needed} so no team runs the deck dry. Add a category or write a few more.</p>}
    </section>
    <div className="setup-footer"><span className="privacy-note"><Check size={17}/> Everything is saved on this laptop</span><button className="button primary large" disabled={available < needed} onClick={() => update(s => { s.setupStepId = 'game'; })}>Next: game setup</button></div>
  </div>;
}
