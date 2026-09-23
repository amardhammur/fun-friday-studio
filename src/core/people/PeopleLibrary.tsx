import { useRef } from 'react';
import { Users, Download, Upload, ArrowRight } from 'lucide-react';
import type { ActivityContext, EventSession } from '../types';
import { StoredImage } from '../../components/Images';
import { exportFacePairs, importFacePairs } from '../transfer';
import { replaceEventPeople } from './event-library';
type PeopleLibraryProps = { session: EventSession; update: (change: (draft: EventSession) => void) => void; notify: ActivityContext['notify']; runTask: ActivityContext['runTask']; onSetup: () => void };
export function PeopleLibrary({ session, update, notify, runTask, onSetup }: PeopleLibraryProps) {
  const importInput = useRef<HTMLInputElement>(null);
  return <main className="library-page"><div className="section-heading"><span className="eyebrow">THE FAMILIAR FACES</span><h1>Your people library<span className="accent">.</span></h1><p>One team roster, ready for every activity. Names and face pairs travel with your session.</p></div><div className="names-toolbar"><span><Users size={18}/> {session.people.length} people in this session</span><div className="button-row"><button className="button secondary" disabled={!session.people.length} onClick={() => void runTask('Packing the face pairs…', () => exportFacePairs(session))}><Download size={16}/> Export pairs</button><button className="button secondary" onClick={() => importInput.current?.click()}><Upload size={16}/> Import pairs</button><input ref={importInput} type="file" accept=".zip,application/zip" className="visually-hidden" aria-label="Import face pairs ZIP" onChange={event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && (session.people.length > 0 || session.segments.length > 0) && !window.confirm('Replace the people library for this whole event? All activity progress, scores, and wager bets will be reset. Your line-up, activity settings, teams, and wager question will be kept.')) return;
    if (file) void runTask('Importing face pairs…', async () => {
      const imported = await importFacePairs(file, {
        startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 },
      });
      update(s => replaceEventPeople(s, imported));
      notify(`${imported.people.length} people imported.`);
    });
  }}/><button className="button primary" onClick={onSetup}>Manage people <ArrowRight size={17}/></button></div></div><div className="library-grid">{session.people.map(person => {
    const pair = session.facePairs.find(p => p.id === person.facePairId);
    return <article className="library-person" key={person.id}><div className="library-portraits"><StoredImage id={pair?.then?.cropImageId} alt={`${person.name || 'Unnamed person'} as a child`}/><StoredImage id={pair?.now?.cropImageId} alt={`${person.name || 'Unnamed person'} now`}/></div><input aria-label={`Library name ${person.id}`} maxLength={80} value={person.name} placeholder="Add a name" onChange={e => update(s => { s.people.find(p => p.id === person.id)!.name = e.target.value; })}/><p>{person.funFact || 'A face worth remembering.'}</p><span className={`pill ${person.included ? 'mint' : ''}`}>{person.included ? 'In the game' : 'Sitting this one out'}</span></article>;
  })}</div>{!session.people.length && <div className="empty-state"><Users size={42}/><h2>The roster is empty.</h2><p>Upload your two photos and match the faces to add your colleagues.</p></div>}</main>;
}
