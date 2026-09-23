import type { FacePair, Person, PhotoSet } from '../types';

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
