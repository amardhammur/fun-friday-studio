import { useRef, useState } from 'react';
import { ChevronDown, Upload } from 'lucide-react';
import type { ActivityContext, EventSession } from '../types';
import { importFacePairs, readFacePairsBundle, storeFacePairsBundle, type FacePairsBundle } from '../transfer';
import { duplicateNames, duplicateSummary, maxFacePairNumber, normalizeName } from './pairs';
import { addEventPeople, replaceEventPeople } from './event-library';
type Props = { session: EventSession; update: (change: (draft: EventSession) => void) => void; notify: ActivityContext['notify']; runTask: ActivityContext['runTask']; locked: boolean };
const REPLACE_WARNING = 'Replace the people library for this whole event? All activity progress, scores, and wager bets will be reset. Your line-up, activity settings, teams, and wager question will be kept.';
export function ImportPairsMenu({ session, update, notify, runTask, locked }: Props) {
  const replaceInput = useRef<HTMLInputElement>(null), addInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [pending, setPending] = useState<{ bundle: FacePairsBundle; names: string[] }>();
  const store = async (bundle: FacePairsBundle, skipNames: ReadonlySet<string>) => {
    const imported = await storeFacePairsBundle(bundle, { startNumber: maxFacePairNumber(session.facePairs.map(p => p.number)), startOrder: Math.max(-1, ...session.photoSets.map(s => s.order)) + 1, current: { people: session.people.length, facePairs: session.facePairs.length, photoSets: session.photoSets.length }, skipNames });
    update(s => addEventPeople(s, imported));
    notify(`${imported.people.length} people added.`);
  };
  const add = (file: File) => void runTask('Reading face pairs…', async () => {
    const bundle = await readFacePairsBundle(file), names = duplicateNames(session.people, bundle.manifest);
    if (names.length) setPending({ bundle, names }); else await store(bundle, new Set());
  });
  const replace = (file: File) => {
    if ((session.people.length > 0 || session.segments.length > 0) && !window.confirm(REPLACE_WARNING)) return;
    void runTask('Importing face pairs…', async () => {
      const imported = await importFacePairs(file, { startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 } });
      update(s => replaceEventPeople(s, imported));
      notify(`${imported.people.length} people imported.`);
    });
  };
  const resolve = (skip: boolean) => { if (!pending) return; const { bundle, names } = pending; setPending(undefined); void runTask('Adding face pairs…', () => store(bundle, skip ? new Set(names.map(normalizeName)) : new Set())); };
  const picker = (ref: React.RefObject<HTMLInputElement | null>, label: string, onFile: (file: File) => void) => <input ref={ref} type="file" accept=".zip,application/zip" className="visually-hidden" aria-label={label} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file); }}/>;
  return <div className="import-menu"><button className="button secondary" aria-expanded={open} onClick={() => setOpen(o => !o)}><Upload size={16}/> Import pairs <ChevronDown size={14}/></button>
    {open && <div className="import-menu-list" role="menu"><button role="menuitem" disabled={locked} onClick={() => { setOpen(false); addInput.current?.click(); }}><b>Add to library</b><small>{locked ? 'Locked after an activity starts.' : 'Keeps everyone already here.'}</small></button><button role="menuitem" onClick={() => { setOpen(false); replaceInput.current?.click(); }}><b>Replace library</b><small>Clears everyone and resets game progress.</small></button></div>}
    {picker(addInput, 'Add face pairs ZIP', add)}{picker(replaceInput, 'Import face pairs ZIP', replace)}
    {pending && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="duplicates-title"><span className="eyebrow">ALREADY HERE</span><h2 id="duplicates-title">Some names match</h2><p>{duplicateSummary(pending.names)}</p><div className="button-row"><button className="button primary" onClick={() => resolve(false)}>Add anyway</button><button className="button secondary" onClick={() => resolve(true)}>Skip duplicates</button><button className="button subtle" onClick={() => setPending(undefined)}>Cancel</button></div></section></div>}
  </div>;
}
