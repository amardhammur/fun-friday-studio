import type { Asset, EventUpdate, FaceCrop, FacePair, PhotoSet, Rect } from '../types';
import { imageStore } from '../storage';
import { cropMany, detectFaces, inspectImage, scaleImage } from '../images/client';
import { defaultPadding } from '../images/math';
import { teamColors } from '../event';
import { pairFaces } from './pairing';
import { defaultIncluded, largestFace, wholeImageFace } from './photo-sets';
import { MAX_FACE_PAIRS, MAX_PEOPLE } from './limits';

export type LibraryDraft = Pick<EventUpdate, 'people' | 'facePairs' | 'photoSets' | 'assets' | 'isDemo'>;
export async function storeAsset(blob: Blob, name: string, width: number, height: number): Promise<Asset> {
  const id = await imageStore.put(blob); return { id, name, width, height, mime: blob.type || 'application/octet-stream' };
}
export async function storePhoto(blob: Blob, name: string) {
  const info = await inspectImage(blob);
  const asset = await storeAsset(blob, name, info.width, info.height);
  try {
    const scale = Math.min(1, 1600 / Math.max(info.width, info.height));
    const preview = await storeAsset(info.preview, `Preview - ${name}`, Math.round(info.width * scale), Math.round(info.height * scale));
    return { asset, preview };
  } catch (error) { await imageStore.delete(asset.id); throw error; }
}
export function makePairs(now: Rect[], then: Rect[], set: PhotoSet, tolerance: number, firstNumber = 1): FacePair[] {
  return pairFaces(now, then, tolerance).map((match, i) => {
    const number = firstNumber + i;
    return { id: crypto.randomUUID(), number, color: teamColors[(number - 1) % teamColors.length], setId: set.id, now: match.now === undefined ? undefined : { sourceImageId: set.nowImageId!, faceBox: now[match.now], padding: { ...defaultPadding } }, then: match.then === undefined ? undefined : { sourceImageId: set.thenImageId!, faceBox: then[match.then], padding: { ...defaultPadding } }, matchMethod: 'automatic', reviewStatus: match.now !== undefined && match.then !== undefined ? 'suggested' : 'unmatched' };
  });
}
export function syncPeople(library: Pick<LibraryDraft, 'people' | 'facePairs' | 'photoSets'>) {
  if (library.facePairs.length > MAX_FACE_PAIRS) throw new Error(`A people library holds up to ${MAX_FACE_PAIRS} face pairs.`);
  if (library.facePairs.length > MAX_PEOPLE) throw new Error(`A people library holds up to ${MAX_PEOPLE} people.`);
  const fresh = defaultIncluded(library);
  const people = library.facePairs.map(pair => {
    const existing = library.people.find(p => p.facePairId === pair.id);
    return existing ? { ...existing, included: Boolean(pair.now && pair.then && existing.included) } : { id: crypto.randomUUID(), facePairId: pair.id, name: '', funFact: '', included: fresh && Boolean(pair.now && pair.then) };
  });
  if (people.length > MAX_PEOPLE) throw new Error(`A people library holds up to ${MAX_PEOPLE} people.`);
  library.people = people;
}
export async function prepareCrops<T extends Pick<LibraryDraft, 'facePairs' | 'assets'>>(library: T, progress?: (s: string) => void): Promise<T> {
  const updated = structuredClone(library);
  const created: string[] = [];
  const groups = new Map<string, { face: FaceCrop; label: string }[]>();
  for (const pair of updated.facePairs) for (const side of ['now', 'then'] as const) {
    const face = pair[side]; if (!face || face.cropImageId) continue;
    const entries = groups.get(face.sourceImageId) ?? [];
    entries.push({ face, label: `Face ${pair.number} - ${side}.jpg` }); groups.set(face.sourceImageId, entries);
  }
  // Decode each source just once, even for a 50-person group.
  try {
    for (const [source, entries] of groups) {
      progress?.(`Preparing ${entries.length} face crops…`);
      const crops = await cropMany(await imageStore.get(source), entries.map(e => e.face));
      for (let i = 0; i < crops.length; i++) {
        const crop = crops[i], asset = await storeAsset(crop.blob, entries[i].label, crop.width, crop.height);
        created.push(asset.id); entries[i].face.cropImageId = asset.id; updated.assets[asset.id] = asset;
      }
    }
  } catch (error) { await Promise.allSettled(created.map(id => imageStore.delete(id))); throw error; }
  return updated;
}
// A group's childhood photo is scaled to the current photo's size so face boxes line up in the wipe.
export async function alignThen<T extends Pick<LibraryDraft, 'photoSets' | 'assets'>>(library: T, setId: string): Promise<T> {
  const set = library.photoSets.find(s => s.id === setId);
  const now = set?.nowImageId ? library.assets[set.nowImageId] : undefined, then = set?.thenImageId ? library.assets[set.thenImageId] : undefined;
  if (!set || set.kind !== 'group' || !now || !then || (now.width === then.width && now.height === then.height)) return library;
  const blob = await scaleImage(await imageStore.get(then.id), now.width, now.height);
  const { asset, preview } = await storePhoto(blob, 'Childhood - aligned.jpg');
  const updated = structuredClone(library), target = updated.photoSets.find(s => s.id === setId)!;
  updated.assets[asset.id] = asset; updated.assets[preview.id] = preview;
  delete target.previews[then.id];
  target.thenImageId = asset.id; target.previews[asset.id] = preview.id;
  return updated;
}
export async function suggestFace(blob: Blob): Promise<Pick<FaceCrop, 'faceBox' | 'padding'>> {
  try { const face = largestFace(await detectFaces(blob)); if (face) return { faceBox: face, padding: { ...defaultPadding } }; }
  catch { /* A single photo still works uncropped when the detector is unavailable. */ }
  return wholeImageFace();
}
