import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GroupWizard } from '../../../src/core/people/editor/GroupWizard';
import type { LibraryContext } from '../../../src/core/people/editor/context';
import { playerIssues, primaryGroupSet, renameSet } from '../../../src/core/people/photo-sets';
import { PeoplePreview } from '../../../src/core/people/PeoplePreview';
import type { Context } from '../types';
// A first-time host builds their first group right here; everyone else
// sees who is playing and manages the roster in the People library.
export function PeopleStep({ event, update, updateEvent, runTask, notify, rosterLocked, openPeople }: Context) {
  const [building, setBuilding] = useState(() => !rosterLocked && !event.photoSets.length);
  const ctx: LibraryContext = { event, updateEvent, runTask, notify };
  const toGame = () => update(s => { s.setupStepId = 'game'; });
  if (building) return <GroupWizard ctx={ctx} setId={primaryGroupSet(event)?.id} doneLabel="Set up the game" onDone={() => { setBuilding(false); toGame(); }}/>;
  const players = event.people.filter(p => p.included), unnamed = players.filter(p => !p.name.trim()).length;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE CLASS LIST</span><h1>Who’s playing today<span className="accent">?</span></h1><p>Everyone switched on in your people library gets a photo in this game.</p></div>
    <PeoplePreview event={event} onRename={rosterLocked ? undefined : (setId, name) => updateEvent(draft => { renameSet(draft, setId, name); })}/>
    <p className={unnamed ? 'warning-text' : 'muted'}>{players.length} players ready{unnamed ? ` · ${unnamed} need a name` : ''}</p>
    <div className="setup-footer"><button className="button secondary" onClick={openPeople}>Open People library</button><button className="button primary" disabled={playerIssues(event).length > 0} onClick={toGame}>Set up the game <ArrowRight size={18}/></button></div>
  </div>;
}
