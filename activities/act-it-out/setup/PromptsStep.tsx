import { useState } from 'react';
import { Check, PencilLine, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { builtInCategory, isBuiltIn } from '../prompts';
import { cardsNeeded, eligiblePrompts } from '../logic/turns';
import type { Category, Context } from '../types';
const count = (c: Category) => c.prompts.filter(t => t.trim()).length;
const isOriginal = (c: Category) => {
  if (!c.builtIn || !isBuiltIn(c.builtIn)) return false;
  const original = builtInCategory(c.builtIn);
  return c.name === original.name && c.prompts.length === original.prompts.length && c.prompts.every((t, i) => t === original.prompts[i]);
};
export function PromptsStep({ segment, event, update }: Context) {
  const { settings } = segment, available = eligiblePrompts(settings).length;
  const needed = cardsNeeded(event.teams.length, settings.roundsPerTeam);
  const [selectedId, setSelectedId] = useState<string | undefined>(settings.categories[0]?.id);
  const selected = settings.categories.find(c => c.id === selectedId) ?? settings.categories[0];
  const edit = (id: string, change: (c: Category) => void) => update(s => { const c = s.settings.categories.find(c => c.id === id); if (c) change(c); });
  const add = () => { const id = `custom:${crypto.randomUUID()}`; update(s => { s.settings.categories.push({ id, name: 'New category', on: true, prompts: [] }); }); setSelectedId(id); };
  const remove = (id: string) => { update(s => { s.settings.categories = s.settings.categories.filter(c => c.id !== id); }); setSelectedId(settings.categories.find(c => c.id !== id)?.id); };
  const reset = (c: Category) => { if (c.builtIn && isBuiltIn(c.builtIn)) { const original = builtInCategory(c.builtIn, c.on); edit(c.id, d => Object.assign(d, original)); } };
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / STOCK THE DECK</span><h1>What are we acting<span className="accent">?</span></h1><p>Everything is ready to go. Turn a category off if it is not your crowd, rewrite any prompt, or add a category of your own for the in-jokes.</p></div>
    <div className="aio-setup-grid">
      <section className="panel"><div className="panel-heading"><Sparkles size={21}/><h2>Categories</h2></div><p className="muted">Tick the ones to deal from. Pick one to edit its prompts.</p>
        <div className="category-grid">{settings.categories.map(c => <div key={c.id} className={`category-tile ${c.on ? 'on' : ''} ${c.id === selected?.id ? 'selected' : ''}`}>
          <button className="category-check" aria-pressed={c.on} aria-label={`Deal from ${c.name || 'this category'}`} onClick={() => edit(c.id, d => { d.on = !d.on; })}>{c.on && <Check size={15}/>}</button>
          <button className="category-name" aria-label={`Edit ${c.name || 'untitled category'}`} onClick={() => setSelectedId(c.id)}><b>{c.name || 'Untitled'}</b><small>{count(c)} prompts{c.builtIn && !isOriginal(c) ? ' · edited' : ''}</small></button>
        </div>)}
          <button className="category-tile category-new" onClick={add}><Plus size={18}/><b>New category</b><small>Your in-jokes</small></button>
        </div>
      </section>
      <section className="panel"><div className="panel-heading"><PencilLine size={21}/><h2>{selected ? `Edit ${selected.name || 'category'}` : 'Your prompts'}</h2></div>
        {selected ? <>
          <label className="aio-category-name"><span className="eyebrow">NAME</span><input aria-label="Category name" maxLength={40} value={selected.name} onChange={e => edit(selected.id, d => { d.name = e.target.value; })}/></label>
          <p className="muted">One prompt per line. Rewrite, delete or add freely. If two categories share a prompt, your own categories win.</p>
          <textarea aria-label={`Prompts in ${selected.name || 'this category'}, one per line`} rows={11} placeholder={'The 4pm deploy\nThe kitchen radio\nWhoever keeps booking the big room'} value={selected.prompts.join('\n')} onChange={e => edit(selected.id, d => { d.prompts = e.target.value.split('\n'); })}/>
          <div className="button-row">{selected.builtIn
            ? <button className="button subtle" disabled={isOriginal(selected)} onClick={() => reset(selected)}><RotateCcw size={16}/> Reset to original</button>
            : <button className="button subtle" onClick={() => remove(selected.id)}><Trash2 size={16}/> Delete category</button>}</div>
        </> : <p className="muted">No categories left. Add one to start the deck.</p>}
      </section>
    </div>
    <section className="allocation"><div><span className="eyebrow">YOUR DECK</span><h3>{available} prompts ready. {event.teams.length} teams, {settings.roundsPerTeam} turn{settings.roundsPerTeam === 1 ? '' : 's'} each.</h3></div>
      {available < needed && <p className="warning-text">You need at least {needed} so no team runs the deck dry. Add a category or write a few more.</p>}
    </section>
    <div className="setup-footer"><span className="privacy-note"><Check size={17}/> Everything is saved on this laptop</span><button className="button primary large" disabled={available < needed} onClick={() => update(s => { s.setupStepId = 'game'; })}>Next: game setup</button></div>
  </div>;
}
