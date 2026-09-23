import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Crop, Download, ImagePlus, Plus, Trash2, Users, UserPlus } from 'lucide-react';
import type { ActivityContext, EventSession, Person } from '../types';
import { StoredImage } from '../../components/Images';
import { imageStore } from '../storage';
import { exportFacePairs } from '../transfer';
import { leaveDemo } from './event-library';
import { moveSet, orderedSets, peopleInSet, removePhotoSet, renameSet, setIncluded } from './photo-sets';
import { ImportPairsMenu } from './ImportPairsMenu';
import { GroupWizard } from './editor/GroupWizard';
import { SetMatch } from './editor/SetMatch';
import { AddPersonDialog } from './editor/AddPersonDialog';
import type { LibraryContext } from './editor/context';

type Props = { session: EventSession; update: (change: (draft: EventSession) => void) => void; notify: ActivityContext['notify']; runTask: ActivityContext['runTask']; locked: boolean };
type Editing = { kind: 'group'; setId?: string } | { kind: 'crop'; setId: string } | { kind: 'person'; setId?: string };

export function PeopleLibrary({ session, update, notify, runTask, locked }: Props) {
  const [editing, setEditing] = useState<Editing>();
  const ctx: LibraryContext = { event: session, updateEvent: change => update(s => change(s)), runTask, notify };
  // The demo is a playing game; the first real library change turns it into an ordinary event.
  const begin = (next: Editing) => { if (session.isDemo) update(leaveDemo); setEditing(next); };
  const close = () => setEditing(undefined);
  if (editing?.kind === 'group') return <main className="library-page"><GroupWizard ctx={ctx} setId={editing.setId} doneLabel="Back to the library" onDone={close} onCancel={close}/></main>;
  if (editing?.kind === 'crop') return <main className="library-page"><SetMatch ctx={ctx} setId={editing.setId} onBack={close} onNext={close} nextLabel="Save crop"/></main>;
  const remove = (setId: string, name: string) => {
    if (!window.confirm(`Remove ${name} and everyone in it from the library? Their photos are deleted from this laptop.`)) return;
    if (session.isDemo) update(leaveDemo);
    let removed: string[] = [];
    update(s => { removed = removePhotoSet(s, setId); });
    void Promise.allSettled(removed.map(id => imageStore.delete(id)));
    notify(`${name} removed.`);
  };
  const sets = orderedSets(session), groups = sets.filter(s => s.kind === 'group'), singles = sets.filter(s => s.kind === 'single');
  const card = (person: Person, actions?: ReactNode) => {
    const pair = session.facePairs.find(p => p.id === person.facePairId), complete = Boolean(pair?.now && pair.then);
    return <article className="library-person" key={person.id}><div className="library-portraits"><StoredImage id={pair?.then?.cropImageId} alt={`${person.name || 'Unnamed person'} as a child`}/><StoredImage id={pair?.now?.cropImageId} alt={`${person.name || 'Unnamed person'} now`}/></div><input aria-label={`Library name ${person.id}`} maxLength={80} value={person.name} placeholder="Add a name" onChange={e => update(s => { s.people.find(p => p.id === person.id)!.name = e.target.value; })}/><p>{person.funFact || 'A face worth remembering.'}</p><label className="library-switch"><input type="checkbox" className="switch" aria-label={`Include ${person.name || `person ${pair?.number ?? ''}`}`} checked={person.included} disabled={locked || !complete} onChange={e => update(s => { s.people.find(p => p.id === person.id)!.included = e.target.checked; })}/><span>{person.included ? 'In the game' : 'Sitting this one out'}</span></label>{actions}</article>;
  };
  return <main className="library-page"><div className="section-heading"><span className="eyebrow">THE FAMILIAR FACES</span><h1>Your people library<span className="accent">.</span></h1><p>One team roster, ready for every activity. Names and face pairs travel with your session.</p></div>
    <div className="names-toolbar"><span><Users size={18}/> {session.people.length} people · {session.people.filter(p => p.included).length} in the game</span><div className="button-row"><button className="button secondary" disabled={locked} onClick={() => begin({ kind: 'group' })}><Plus size={16}/> Add a group</button><button className="button secondary" disabled={locked} onClick={() => begin({ kind: 'person' })}><UserPlus size={16}/> Add a person</button><ImportPairsMenu session={session} update={update} notify={notify} runTask={runTask} locked={locked}/><button className="button secondary" disabled={!session.people.length} onClick={() => void runTask('Packing the face pairs…', () => exportFacePairs(session))}><Download size={16}/> Export pairs</button></div></div>
    {locked && <p className="muted library-locked">The roster is locked after an activity starts. Use Import pairs → Replace library to start over.</p>}
    {groups.map((set, index) => { const people = peopleInSet(session, set.id); return <section className="library-set" key={set.id} aria-label={set.name}><header className="library-set-header"><div><span className="eyebrow">GROUP {index + 1}</span><input key={set.name} className="library-set-name" aria-label={`Name for ${set.name}`} maxLength={80} defaultValue={set.name} disabled={locked} onBlur={e => { const value = e.target.value; if (value.trim() && value.trim() !== set.name) update(s => { renameSet(s, set.id, value); }); else e.target.value = set.name; }}/><small>{people.length} people · {people.filter(p => p.included).length} playing</small></div><div className="button-row"><button className="button subtle small-button" disabled={locked} onClick={() => update(s => setIncluded(s, set.id, true))}>Everyone in</button><button className="button subtle small-button" disabled={locked} onClick={() => update(s => setIncluded(s, set.id, false))}>Everyone out</button><button className="button secondary small-button" disabled={locked} onClick={() => begin({ kind: 'group', setId: set.id })}>Edit photos & matches</button><button className="icon-button" aria-label={`Move ${set.name} up`} disabled={locked || index === 0} onClick={() => update(s => moveSet(s, set.id, -1))}><ArrowUp size={16}/></button><button className="icon-button" aria-label={`Move ${set.name} down`} disabled={locked || index === groups.length - 1} onClick={() => update(s => moveSet(s, set.id, 1))}><ArrowDown size={16}/></button><button className="icon-button danger" aria-label={`Remove ${set.name}`} disabled={locked} onClick={() => remove(set.id, set.name)}><Trash2 size={16}/></button></div></header><div className="library-grid">{people.map(person => card(person))}</div>{!people.length && <p className="muted">No one here yet. Use Edit photos & matches to finish this group.</p>}</section>; })}
    {singles.length > 0 && <section className="library-set" aria-label="Single photos"><header className="library-set-header"><div><span className="eyebrow">SINGLE PHOTOS</span><small>{singles.length} people · {singles.filter(set => peopleInSet(session, set.id)[0]?.included).length} playing</small></div></header><div className="library-grid">{singles.map(set => { const person = peopleInSet(session, set.id)[0]; return person && card(person, <div className="button-row"><button className="button subtle small-button" disabled={locked} onClick={() => begin({ kind: 'person', setId: set.id })}><ImagePlus size={15}/> Replace photos</button><button className="button subtle small-button" disabled={locked} onClick={() => begin({ kind: 'crop', setId: set.id })}><Crop size={15}/> Adjust crop</button><button className="icon-button danger" aria-label={`Remove ${set.name}`} disabled={locked} onClick={() => remove(set.id, set.name)}><Trash2 size={16}/></button></div>); })}</div></section>}
    {!session.people.length && !sets.length && <div className="empty-state"><Users size={42}/><h2>The roster is empty.</h2><p>Add a group photo pair, or import face pairs someone exported.</p></div>}
    {editing?.kind === 'person' && <AddPersonDialog ctx={ctx} setId={editing.setId} onClose={close}/>}
  </main>;
}
