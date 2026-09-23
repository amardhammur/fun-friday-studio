import type { Asset, FaceCrop, FacePair, Person, PhotoSet, Rect } from '../types';
import { teamColors } from '../event';

export const MAX_PHOTO_SETS = 20;
type SetList = { readonly photoSets: readonly PhotoSet[] };
type PairList = { readonly facePairs: readonly FacePair[] };
type LibraryView = SetList & PairList & { readonly people: readonly Person[] };

// Sorted copies of the array; the set objects themselves are shared, so a draft can edit them in place.
export const orderedSets = (library: SetList): PhotoSet[] => [...library.photoSets].sort((a, b) => a.order - b.order);
export const primaryGroupSet = (library: SetList) => orderedSets(library).find(set => set.kind === 'group');
export const pairsInSet = (library: PairList, setId: string) => library.facePairs.filter(pair => pair.setId === setId);
export function peopleInSet(library: LibraryView, setId: string) {
  const ids = new Set(pairsInSet(library, setId).map(pair => pair.id));
  return library.people.filter(person => ids.has(person.facePairId));
}
export const nextPairNumber = (facePairs: readonly FacePair[]) => Math.max(0, ...facePairs.map(pair => pair.number)) + 1;
// The first group keeps today's "everyone plays" default; later groups are usually partial.
export const defaultIncluded = (library: SetList) => library.photoSets.length <= 1;
export const allPreviews = (library: SetList): Record<string, string> => Object.assign({}, ...library.photoSets.map(set => set.previews));
export function createPhotoSet(library: { photoSets: PhotoSet[] }, name: string, kind: PhotoSet['kind']): PhotoSet {
  if (library.photoSets.length >= MAX_PHOTO_SETS) throw new Error(`A people library holds up to ${MAX_PHOTO_SETS} photo sets.`);
  const fallback = kind === 'group' ? `Group ${library.photoSets.length + 1}` : 'Someone new';
  const set: PhotoSet = { id: crypto.randomUUID(), name: name.trim().slice(0, 80) || fallback, kind, previews: {}, order: Math.max(-1, ...library.photoSets.map(s => s.order)) + 1 };
  library.photoSets.push(set);
  return set;
}
type Library = { photoSets: PhotoSet[]; facePairs: FacePair[]; people: Person[]; assets: Record<string, Asset> };
// Removes a set's face pairs and people, and forgets their crop images. Returns the crop ids so the
// caller can delete the stored blobs.
export function clearSetPairs(library: Library, setId: string): string[] {
  const removed = pairsInSet(library, setId), ids = new Set(removed.map(pair => pair.id));
  library.facePairs = library.facePairs.filter(pair => !ids.has(pair.id));
  library.people = library.people.filter(person => !ids.has(person.facePairId));
  const crops = removed.flatMap(pair => [pair.now?.cropImageId, pair.then?.cropImageId]).filter((id): id is string => Boolean(id));
  for (const id of crops) delete library.assets[id];
  return crops;
}
export function setIncluded(library: Pick<Library, 'facePairs' | 'people'>, setId: string, included: boolean) {
  const pairs = new Map(pairsInSet(library, setId).map(pair => [pair.id, pair]));
  for (const person of library.people) {
    const pair = pairs.get(person.facePairId);
    if (pair) person.included = included && Boolean(pair.now && pair.then);
  }
}
// Groups and single photos are listed separately, so a set only swaps places with its own kind.
export function moveSet(library: Pick<Library, 'photoSets'>, setId: string, delta: -1 | 1) {
  const set = library.photoSets.find(s => s.id === setId);
  if (!set) return;
  const same = orderedSets(library).filter(s => s.kind === set.kind), index = same.indexOf(set), other = same[index + delta];
  if (other) [set.order, other.order] = [other.order, set.order];
}
// An empty name would make the saved session invalid, so it is refused rather than stored.
export function renameSet(library: Pick<Library, 'photoSets'>, setId: string, name: string): boolean {
  const set = library.photoSets.find(s => s.id === setId), clean = name.trim().slice(0, 80);
  if (!set || !clean) return false;
  set.name = clean;
  return true;
}
export function removePhotoSet(library: Library, setId: string): string[] {
  const set = library.photoSets.find(s => s.id === setId);
  if (!set) return [];
  const crops = clearSetPairs(library, setId);
  const images = [set.nowImageId, set.thenImageId, ...Object.values(set.previews)].filter((id): id is string => Boolean(id));
  for (const id of images) delete library.assets[id];
  library.photoSets = library.photoSets.filter(s => s.id !== setId);
  orderedSets(library).forEach((s, index) => { s.order = index; });
  return [...crops, ...images];
}
export function playerIssues(library: { readonly people: readonly Person[] }): string[] {
  const players = library.people.filter(person => person.included);
  return players.length && players.every(person => person.name.trim()) ? [] : ['Include and name the people who will appear in the game.'];
}
export interface SinglePhoto { asset: Asset; preview: Asset; face: Pick<FaceCrop, 'faceBox' | 'padding'> }
export const largestFace = (faces: readonly Rect[]): Rect | undefined => [...faces].sort((a, b) => b.width * b.height - a.width * a.height)[0];
export const wholeImageFace = (): Pick<FaceCrop, 'faceBox' | 'padding'> => ({ faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
function attachSinglePhotos(library: Library, set: PhotoSet, now: SinglePhoto, then: SinglePhoto) {
  for (const photo of [now, then]) { library.assets[photo.asset.id] = photo.asset; library.assets[photo.preview.id] = photo.preview; }
  set.nowImageId = now.asset.id; set.thenImageId = then.asset.id;
  set.previews = { [now.asset.id]: now.preview.id, [then.asset.id]: then.preview.id };
}
export function addSinglePerson(library: Library, input: { name: string; funFact: string; now: SinglePhoto; then: SinglePhoto }): Person {
  const set = createPhotoSet(library, input.name, 'single');
  attachSinglePhotos(library, set, input.now, input.then);
  const number = nextPairNumber(library.facePairs);
  const pair: FacePair = { id: crypto.randomUUID(), number, color: teamColors[(number - 1) % teamColors.length], setId: set.id, now: { sourceImageId: input.now.asset.id, ...input.now.face }, then: { sourceImageId: input.then.asset.id, ...input.then.face }, matchMethod: 'manual', reviewStatus: 'confirmed' };
  const person: Person = { id: crypto.randomUUID(), name: input.name.trim(), funFact: input.funFact.trim(), included: true, facePairId: pair.id };
  library.facePairs.push(pair); library.people.push(person);
  return person;
}
// Swaps a single person's photos, keeping their name, fun fact and place in any game.
export function replaceSinglePhotos(library: Library, setId: string, now: SinglePhoto, then: SinglePhoto): string[] {
  const set = library.photoSets.find(s => s.id === setId && s.kind === 'single'), pair = pairsInSet(library, setId)[0];
  if (!set || !pair) return [];
  const old = [set.nowImageId, set.thenImageId, ...Object.values(set.previews), pair.now?.cropImageId, pair.then?.cropImageId].filter((id): id is string => Boolean(id));
  for (const id of old) delete library.assets[id];
  attachSinglePhotos(library, set, now, then);
  pair.now = { sourceImageId: now.asset.id, ...now.face }; pair.then = { sourceImageId: then.asset.id, ...then.face };
  return old;
}
