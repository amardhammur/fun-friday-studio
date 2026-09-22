import { useRef } from 'react';
import { Users, Download, Upload, ArrowRight } from 'lucide-react';
import type { ActivityContext } from '../types';
import { StoredImage } from '../../components/Images';
import { exportFacePairs, importFacePairs } from '../transfer';
import { maxFacePairNumber } from './pairs';
export function PeopleLibrary({ session, update, notify, runTask, onSetup }: ActivityContext & { onSetup: () => void }) {
  const importInput = useRef<HTMLInputElement>(null);
  return <main className="library-page"><div className="section-heading"><span className="eyebrow">THE FAMILIAR FACES</span><h1>Your people library<span className="accent">.</span></h1><p>One team roster, ready for every activity. Names and face pairs travel with your session.</p></div><div className="names-toolbar"><span><Users size={18}/> {session.people.length} people in this session</span><div className="button-row"><button className="button secondary" disabled={!session.people.length} onClick={() => void runTask('Packing the face pairs…', () => exportFacePairs(session))}><Download size={16}/> Export pairs</button><button className="button secondary" onClick={() => importInput.current?.click()}><Upload size={16}/> Import pairs</button><input ref={importInput} type="file" accept=".zip,application/zip" className="visually-hidden" aria-label="Import face pairs ZIP" onChange={event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void runTask('Importing face pairs…', async () => {
      const imported = await importFacePairs(file, {
        startNumber: maxFacePairNumber(session.facePairs.map(pair => pair.number)),
        currentPeopleCount: session.people.length,
        currentFacePairCount: session.facePairs.length,
      });
      update(s => {
        Object.assign(s.assets, imported.assets);
        s.facePairs.push(...imported.facePairs);
        s.people.push(...imported.people);
      });
      notify(`${imported.people.length} people imported.`);
    });
  }}/><button className="button primary" onClick={onSetup}>Manage people <ArrowRight size={17}/></button></div></div><div className="library-grid">{session.people.map(person => {
    const pair = session.facePairs.find(p => p.id === person.facePairId);
    return <article className="library-person" key={person.id}><div className="library-portraits"><StoredImage id={pair?.then?.cropImageId} alt={`${person.name || 'Unnamed person'} as a child`}/><StoredImage id={pair?.now?.cropImageId} alt={`${person.name || 'Unnamed person'} now`}/></div><input aria-label={`Library name ${person.id}`} value={person.name} placeholder="Add a name" onChange={e => update(s => { s.people.find(p => p.id === person.id)!.name = e.target.value; })}/><p>{person.funFact || 'A face worth remembering.'}</p><span className={`pill ${person.included ? 'mint' : ''}`}>{person.included ? 'In the game' : 'Sitting this one out'}</span></article>;
  })}</div>{!session.people.length && <div className="empty-state"><Users size={42}/><h2>The roster is empty.</h2><p>Upload your two photos and match the faces to add your colleagues.</p></div>}</main>;
}
