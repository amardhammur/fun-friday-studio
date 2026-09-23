import type { ActivityContext, ActivityEvent, EventUpdate } from '../../types';
import type { LibraryDraft } from '../photos';

// The slice of an event the library editors read. Both an activity's event view and the whole
// EventSession satisfy it, so the same screens serve Childhood vs Now setup and the People library.
export type LibraryEvent = Pick<ActivityEvent, 'people' | 'facePairs' | 'photoSets' | 'assets' | 'isDemo'>;
export interface LibraryContext {
  event: LibraryEvent;
  updateEvent: (change: (draft: EventUpdate) => void) => void;
  runTask: ActivityContext['runTask'];
  notify: ActivityContext['notify'];
}
export const libraryDraft = (event: LibraryEvent): LibraryDraft => structuredClone({ people: [...event.people], facePairs: [...event.facePairs], photoSets: [...event.photoSets], assets: { ...event.assets }, isDemo: event.isDemo });
