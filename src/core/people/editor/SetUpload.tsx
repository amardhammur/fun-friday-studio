import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DropZone } from '../../../components/DropZone';
import { imageStore } from '../../storage';
import { clearSetPairs, forgetUnusedImages } from '../photo-sets';
import { alignThen, storePhoto } from '../photos';
import { libraryDraft, type LibraryContext } from './context';
export function SetUpload({ ctx, setId, footer }: { ctx: LibraryContext; setId: string; footer: ReactNode }) {
  const { event, updateEvent, runTask, notify } = ctx, set = event.photoSets.find(s => s.id === setId);
  const upload = (side: 'now' | 'then', file: File) => runTask('Opening your photo…', async () => {
    if (event.facePairs.some(p => p.setId === setId) && !window.confirm('Replacing a photo clears this group’s face matches and people. Continue?')) return;
    const stored = await storePhoto(file, file.name);
    let next: ReturnType<typeof libraryDraft> | undefined;
    try {
      next = libraryDraft(event);
      const target = next.photoSets.find(s => s.id === setId)!;
      const oldImages = [target.nowImageId, target.thenImageId, ...Object.keys(target.previews), ...Object.values(target.previews)].filter((id): id is string => Boolean(id));
      const crops = clearSetPairs(next, setId), previous = side === 'now' ? target.nowImageId : target.thenImageId;
      if (previous) delete target.previews[previous];
      next.assets[stored.asset.id] = stored.asset; next.assets[stored.preview.id] = stored.preview;
      target.previews[stored.asset.id] = stored.preview.id;
      if (side === 'now') target.nowImageId = stored.asset.id; else target.thenImageId = stored.asset.id;
      next = await alignThen(next, setId);
      const removed = forgetUnusedImages(next, [...oldImages, ...crops, stored.asset.id, stored.preview.id]);
      updateEvent(e => { Object.assign(e, next); });
      void Promise.allSettled(removed.map(id => imageStore.delete(id)));
      notify('Photo saved on this laptop.');
    } catch (error) {
      const created = new Set([stored.asset.id, stored.preview.id, ...Object.keys(next?.assets ?? {}).filter(id => !event.assets[id])]);
      await Promise.allSettled([...created].map(id => imageStore.delete(id)));
      throw error;
    }
  });
  const nowId = set?.nowImageId, thenId = set?.thenImageId;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE TEAM PHOTOS</span><h1>Let’s turn back the clock<span className="accent">.</span></h1><p>{set ? `${set.name}: same people, same places, a few decades apart.` : 'Same people. Same places. A few decades apart.'}</p></div>
    <div className="upload-grid"><DropZone label="THE GROWN-UPS" title="Original group photo (now)" subtitle="Your team, just as they are today." imageId={nowId && (set!.previews[nowId] || nowId)} onFile={f => void upload('now', f)}/><DropZone label="THE LITTLE ONES" title="Childhood group photo (then)" subtitle="The same photo, already edited into 5–6 year olds." imageId={thenId && (set!.previews[thenId] || thenId)} onFile={f => void upload('then', f)}/></div>
    <div className="info-strip"><ShieldCheck size={20}/><span>Your photos stay on this laptop. Full resolution is preserved; different image sizes are aligned automatically.</span></div>
    {footer}
  </div>;
}
