import type { PhotoSet } from './types';

const CHILDHOOD = 'childhood-vs-now';
const PHOTO_FIELDS = ['originalImageId', 'childhoodImageId', 'childhoodUploadId', 'previews'];

// Version 2 kept one pair of group photos inside each Childhood vs Now game. Version 3 moves them
// into the event's people library as one group set. Pure data: image storage is never touched.
export function migrateEventV2(raw: Record<string, any>): Record<string, any> {
  const event = structuredClone(raw);
  const segments: any[] = Array.isArray(event.segments) ? event.segments : [];
  const facePairs: any[] = Array.isArray(event.facePairs) ? event.facePairs : [];
  const people: any[] = Array.isArray(event.people) ? event.people : [];
  const source = segments.filter(s => s?.activityId === CHILDHOOD).map(s => s.game).find(g => g?.originalImageId && g?.childhoodImageId);
  const complete = facePairs.find(p => p?.now?.sourceImageId && p?.then?.sourceImageId);
  const nowImageId: string | undefined = source?.originalImageId ?? complete?.now.sourceImageId;
  const thenImageId: string | undefined = source?.childhoodImageId ?? complete?.then.sourceImageId;
  const photoSets: PhotoSet[] = [];
  if (nowImageId && thenImageId) {
    const previews = Object.fromEntries(Object.entries((source?.previews ?? {}) as Record<string, string>).filter(([id]) => id === nowImageId || id === thenImageId));
    photoSets.push({ id: crypto.randomUUID(), name: 'Group 1', kind: 'group', nowImageId, thenImageId, previews, order: 0 });
  }
  const set = photoSets[0];
  const belongs = (pair: any) => set && (!pair.now || pair.now.sourceImageId === set.nowImageId) && (!pair.then || pair.then.sourceImageId === set.thenImageId);
  event.facePairs = facePairs.filter(belongs).map(pair => ({ ...pair, setId: set!.id }));
  const kept = new Set(event.facePairs.map((pair: any) => pair.id));
  event.people = people.filter(person => kept.has(person.facePairId));
  event.photoSets = photoSets;
  for (const segment of segments) if (segment?.activityId === CHILDHOOD && segment.game) for (const field of PHOTO_FIELDS) delete segment.game[field];
  event.formatVersion = 3;
  return event;
}
