import { useState } from 'react';
import { X } from 'lucide-react';
import { imageStore } from '../../storage';
import { addSinglePerson, peopleInSet, replaceSinglePhotos, type SinglePhoto } from '../photo-sets';
import { prepareCrops, storePhoto, suggestFace } from '../photos';
import { libraryDraft, type LibraryContext } from './context';

type Props = { ctx: LibraryContext; setId?: string; onClose: () => void };

export function AddPersonDialog({ ctx, setId, onClose }: Props) {
  const existing = setId ? peopleInSet(ctx.event, setId)[0] : undefined;
  const [name, setName] = useState(existing?.name ?? ''), [funFact, setFunFact] = useState(existing?.funFact ?? '');
  const [then, setThen] = useState<File>(), [now, setNow] = useState<File>();
  const save = () => void ctx.runTask(existing ? 'Replacing the photos…' : 'Adding your person…', async () => {
    const stored: string[] = [];
    const photo = async (file: File): Promise<SinglePhoto> => { const result = await storePhoto(file, file.name); stored.push(result.asset.id, result.preview.id); return { ...result, face: await suggestFace(file) }; };
    try {
      const nowPhoto = await photo(now!), thenPhoto = await photo(then!);
      let next = libraryDraft(ctx.event), removed: string[] = [];
      if (setId) removed = replaceSinglePhotos(next, setId, nowPhoto, thenPhoto);
      else addSinglePerson(next, { name, funFact, now: nowPhoto, then: thenPhoto });
      next = await prepareCrops(next);
      ctx.updateEvent(e => Object.assign(e, next));
      void Promise.allSettled(removed.map(id => imageStore.delete(id)));
    } catch (error) { await Promise.allSettled(stored.map(id => imageStore.delete(id))); throw error; }
    ctx.notify(existing ? 'Photos replaced.' : `${name.trim()} added.`);
    onClose();
  });
  return <div className="modal-backdrop"><section className="modal add-person" role="dialog" aria-modal="true" aria-labelledby="add-person-title"><button className="modal-close icon-button" aria-label="Close" onClick={onClose}><X/></button><span className="eyebrow">{existing ? 'NEW PHOTOS' : 'ONE MORE FACE'}</span><h2 id="add-person-title">{existing ? `New photos for ${existing.name || 'this person'}` : 'Add a person'}</h2>
    {!existing && <><label className="field"><span>Name</span><input aria-label="Person name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label><label className="field"><span>Fun fact (optional)</span><input aria-label="Person fun fact" maxLength={240} value={funFact} onChange={e => setFunFact(e.target.value)}/></label></>}
    <label className="field"><span>Childhood photo</span><input type="file" accept="image/*" aria-label="Childhood photo" onChange={e => setThen(e.target.files?.[0])}/></label>
    <label className="field"><span>Current photo</span><input type="file" accept="image/*" aria-label="Current photo" onChange={e => setNow(e.target.files?.[0])}/></label>
    <p className="muted">We suggest a face crop for each photo. Use Adjust crop in the library to change it.</p>
    <div className="button-row"><button className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={!now || !then || (!existing && !name.trim())} onClick={save}>{existing ? 'Replace photos' : 'Add person'}</button></div>
  </section></div>;
}
