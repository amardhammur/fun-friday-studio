# Multi-Group People Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one people library hold several photo sets — full group photos, partial groups and single-person photos — with a merge-capable import, and a whole team reveal that steps through every group that has players.

**Architecture:** Photo sets become event-level library data (`EventSession.photoSets`, `FacePair.setId`) and the Childhood vs Now game stops owning group photos. Session format 3 migrates version 2 data on load. Upload, matching and naming screens move to `src/core/people/editor/` and work on one set at a time; the People library composes them, and Childhood vs Now's setup shrinks to People + Game setup. Face-pair bundles move to version 2 (a list of sets), with version 1 still importable.

**Tech Stack:** React 18 + TypeScript (strict), Vite, zod, idb, fflate (archive worker), Vitest (unit), Playwright (browser).

**Spec:** `docs/superpowers/specs/2026-09-23-multi-group-people-library-design.md`

## Global Constraints

- Limits: 500 people, 1000 face pairs, 20 photo sets (`MAX_PEOPLE`, `MAX_FACE_PAIRS`, `MAX_PHOTO_SETS`).
- A photo set name is 1–80 characters after trimming.
- Session `formatVersion` is `3`; version 2 documents migrate on load, version 1 documents still throw the existing "Export pairs" message.
- Face-pair bundle manifest `version` is `2`; version 1 bundles still import as one group set named after the ZIP file (extension removed, trimmed, 80 characters, fallback `Imported group`).
- Bundle v2 paths: `sets/NN/now`, `sets/NN/then`, `sets/NN/now-preview`, `sets/NN/then-preview` with `NN` = two-digit, 1-based set key in manifest order; crops stay `pairs/NNN-now.jpg` / `pairs/NNN-then.jpg`.
- People added through an in-app group start with `included = false`, except when the library has at most one set; people added with **Add a person** start with `included = true`; imported people keep the file's `included` flag.
- The library is locked (`libraryLocked`) when the event is not the demo and any segment is `play`, `finale` or `done`. While locked, only **Replace library** changes the roster.
- Copy strings (use exactly): `Add to library`, `Replace library`, `Your demo people will stay — choose Replace library to remove them.`, `Add anyway`, `Skip duplicates`, `Cancel`, `Also in the game`, `Everyone in`, `Everyone out`, `Edit photos & matches`, `Add a group`, `Add a person`, `Open People library`.
- Images are stored before records change; any failure deletes every image stored by that operation and leaves the session untouched.
- Code style: match the surrounding files — dense one-line JSX, `lucide-react` icons, no new dependencies.

**Clarification the spec leaves open (decided here):** the fresh-browser demo boots straight into a *playing* Childhood vs Now game. A demo event is never locked. The first structural library change made from the People library (add a group, add a person, remove a set, Add to library) first calls `leaveDemo`, which turns the demo into a normal event and resets activity progress exactly like Replace library does, while keeping the demo people. Inside Childhood vs Now's own setup, uploading a photo over the demo replaces the demo group, as it does today.

## Review Focus

1. **A cleared photo-set name** — a host deletes a group's name in the rename field. Saving an empty name would make the whole saved session fail validation on reload and silently fall back to the demo. Expected: the rename only commits a non-empty trimmed name; clearing it reverts. Pinned in Task 5 (`renameSet` test).
2. **A group set with no finished people** (host names a group, uploads, then abandons matching) — Export pairs, the reveal and validation must skip it rather than fail. Pinned in Task 2 (export skips sets without complete pairs) and Task 7 (slides skip sets with no players).
3. **Names that differ only by case or spaces** (`" asha "` vs `Asha`) on Add to library — they must count as duplicates, and Skip duplicates must drop a set left empty. Pinned in Task 2 (`duplicateNames`) and Task 3 (`storeFacePairsBundle` with `skipNames`).
4. **A stored `slideIndex` past the end** after the library changed between games — the finale must clamp to the last slide, never render nothing. Pinned in Task 7 (`clampSlide` test).
5. **Arrow keys while the wipe slider has focus** — ← and → must move the slider, not change slides. Pinned in Task 8 browser test.

---

## File map

| File | Responsibility |
|---|---|
| `src/core/types.ts` | `PhotoSet`, `FacePair.setId`, `EventSession.photoSets`, format 3, `ActivityContext.openPeople` |
| `src/core/people/photo-sets.ts` (new) | Pure library helpers: ordering, lookup, create/remove/move sets, include switches, single-person records, player checks |
| `src/core/migrate.ts` (new) | `migrateEventV2` — pure v2 → v3 transform |
| `src/core/session.ts` | v3 schema, migration hook, set validation, setup-step normalisation |
| `src/core/event.ts` | `createEvent` v3, `activityEvent` with sets, `eventDraft` |
| `src/core/people/pairing.ts` (moved) | Hungarian face pairing (from `activities/childhood-vs-now/logic/pairing.ts`) |
| `src/core/people/photos.ts` (new) | Image-side helpers: store photos, make pairs, sync people, crops, align, suggest a face |
| `src/core/people/pairs.ts` | Bundle v2 manifest parsing (v1 upgrade), capacity, duplicate names |
| `src/core/transfer.ts` | Read/store/import/export bundles; image remapping for sets |
| `src/core/people/event-library.ts` | Replace/add library, reset progress, lock, leave demo |
| `src/core/people/ImportPairsMenu.tsx` (new) | Import menu, duplicate dialog |
| `src/core/people/editor/*` (new) | `context.ts`, `SetUpload`, `SetMatch`, `SetNames`, `GroupWizard`, `AddPersonDialog` |
| `src/core/people/PeopleLibrary.tsx` | Sets layout, actions |
| `activities/childhood-vs-now/*` | Game state without photos, People step, reveal slides |
| `src/app/App.tsx`, `src/main.tsx` | Wiring |

---

## Task 0: Baseline

**Files:** none.

- [ ] **Step 1: Record the starting state**

Run:
```bash
npm test 2>&1 | tail -5
npx tsc -b && echo TSC_OK
npm run build >/dev/null && echo BUILD_OK
npx playwright test --reporter=line 2>&1 | tail -15
```
Expected: unit tests and `tsc` pass, build succeeds. Write down any Playwright test that already fails; those failures are not caused by this work, and the same tests must fail no worse at the end.

---
## Task 1: Session format 3 — photo sets in the library

Everything still behaves as today (one group), but group photos live in `event.photoSets` and every face pair names its set. This task is large because the type change ripples through every reader; it is one reviewable unit: "the app works unchanged on the new model".

**Files:**
- Modify: `src/core/types.ts`
- Create: `src/core/people/photo-sets.ts`, `src/core/migrate.ts`, `src/core/people/photos.ts`
- Move: `activities/childhood-vs-now/logic/pairing.ts` → `src/core/people/pairing.ts`
- Modify: `src/core/session.ts`, `src/core/event.ts`, `src/core/people/event-library.ts`, `src/core/transfer.ts`, `src/main.tsx`, `src/app/App.tsx`
- Modify: `activities/childhood-vs-now/{types.ts,activity.ts,logic/preparation.ts,setup/UploadStep.tsx,setup/MatchPeopleStep.tsx,setup/NamePeopleStep.tsx,setup/GameSetupStep.tsx,stage/Stage.tsx,stage/Finale.tsx}`
- Modify: `activities/act-it-out/{setup/GameSetupStep.tsx,logic/turns.ts}`
- Test: `tests/unit/photo-sets.test.ts` (new), `tests/unit/migrate.test.ts` (new), `tests/unit/session.test.ts`, `tests/unit/event.test.ts`, `tests/unit/event-library.test.ts`, `tests/unit/transfer-remap.test.ts`, `tests/unit/pairs.test.ts`, `tests/unit/pairing.test.ts`, `tests/unit/act-it-out.test.ts`, `tests/browser/app.spec.ts`

**Interfaces:**
- Produces (types): `PhotoSet { id; name; kind: 'group' | 'single'; nowImageId?; thenImageId?; previews: Record<ID, ID>; order: number }`; `FacePair.setId: ID`; `EventSession.formatVersion: 3`, `EventSession.photoSets: PhotoSet[]`; `EventUpdate` includes `'photoSets'`; `ActivityEvent.photoSets: readonly PhotoSet[]`; `Activity.preparePeople?: (segment, event: EventUpdate) => void` (no previews argument).
- Produces (`src/core/people/photo-sets.ts`): `MAX_PHOTO_SETS = 20`; `orderedSets(lib)`; `primaryGroupSet(lib): PhotoSet | undefined`; `pairsInSet(lib, setId): FacePair[]`; `peopleInSet(lib, setId): Person[]`; `nextPairNumber(facePairs): number`; `defaultIncluded(lib): boolean`; `allPreviews(lib): Record<string, string>`; `createPhotoSet(lib, name, kind): PhotoSet`.
- Produces (`src/core/migrate.ts`): `migrateEventV2(raw: Record<string, any>): Record<string, any>`.
- Produces (`src/core/event.ts`): `eventDraft(event: ActivityEvent): EventUpdate`.
- Produces (`src/core/people/photos.ts`): `LibraryDraft = Pick<EventUpdate, 'people' | 'facePairs' | 'photoSets' | 'assets' | 'isDemo'>`; `storeAsset`, `storePhoto(blob, name): Promise<{ asset: Asset; preview: Asset }>`; `makePairs(now: Rect[], then: Rect[], set: PhotoSet, tolerance: number, firstNumber = 1): FacePair[]`; `syncPeople(lib)`; `prepareCrops<T extends Pick<LibraryDraft, 'facePairs' | 'assets'>>(lib: T, progress?): Promise<T>`; `alignThen<T extends Pick<LibraryDraft, 'photoSets' | 'assets'>>(lib: T, setId): Promise<T>`.
- Produces (`src/core/transfer.ts`, interim): `ImportedFacePairs { assets; photoSets; facePairs; people }`; `exportFacePairs(event: EventSession)`.

- [ ] **Step 1: Write the failing photo-set helper tests**

Create `tests/unit/photo-sets.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { allPreviews, createPhotoSet, defaultIncluded, MAX_PHOTO_SETS, nextPairNumber, orderedSets, pairsInSet, peopleInSet, primaryGroupSet } from '../../src/core/people/photo-sets';
import type { FacePair, Person, PhotoSet } from '../../src/core/types';

const pair = (id: string, setId: string, number: number): FacePair => ({ id, setId, number, color: '#f7d873', matchMethod: 'manual', reviewStatus: 'confirmed' });
const person = (id: string, facePairId: string): Person => ({ id, facePairId, name: id, funFact: '', included: true });
const library = () => ({ photoSets: [] as PhotoSet[], facePairs: [] as FacePair[], people: [] as Person[] });

describe('photo sets', () => {
  it('creates sets in order with trimmed names and a default name', () => {
    const lib = library();
    const first = createPhotoSet(lib, '  Engineering 2019  ', 'group');
    const second = createPhotoSet(lib, '   ', 'group');
    expect(first).toMatchObject({ name: 'Engineering 2019', kind: 'group', order: 0, previews: {} });
    expect(second).toMatchObject({ name: 'Group 2', order: 1 });
    expect(createPhotoSet(lib, 'x'.repeat(100), 'single').name).toHaveLength(80);
  });
  it(`refuses a set beyond ${MAX_PHOTO_SETS}`, () => {
    const lib = library();
    for (let i = 0; i < MAX_PHOTO_SETS; i++) createPhotoSet(lib, `Set ${i}`, 'group');
    expect(() => createPhotoSet(lib, 'One more', 'group')).toThrow(/20 photo sets/);
  });
  it('orders sets and finds the first group, skipping single sets', () => {
    const lib = library();
    const single = createPhotoSet(lib, 'Priya', 'single'), group = createPhotoSet(lib, 'Team', 'group');
    single.order = 5;
    expect(orderedSets(lib).map(s => s.id)).toEqual([group.id, single.id]);
    expect(primaryGroupSet(lib)?.id).toBe(group.id);
  });
  it('finds pairs and people by set, and the next pair number', () => {
    const lib = library();
    lib.facePairs.push(pair('a', 's1', 3), pair('b', 's2', 9));
    lib.people.push(person('pa', 'a'), person('pb', 'b'));
    expect(pairsInSet(lib, 's1').map(p => p.id)).toEqual(['a']);
    expect(peopleInSet(lib, 's2').map(p => p.id)).toEqual(['pb']);
    expect(nextPairNumber(lib.facePairs)).toBe(10);
    expect(nextPairNumber([])).toBe(1);
  });
  it('includes new people by default only while the library has at most one set', () => {
    const lib = library();
    expect(defaultIncluded(lib)).toBe(true);
    createPhotoSet(lib, 'One', 'group'); expect(defaultIncluded(lib)).toBe(true);
    createPhotoSet(lib, 'Two', 'group'); expect(defaultIncluded(lib)).toBe(false);
  });
  it('merges every set preview into one lookup', () => {
    const lib = library();
    createPhotoSet(lib, 'One', 'group').previews = { a: 'pa' };
    createPhotoSet(lib, 'Two', 'group').previews = { b: 'pb' };
    expect(allPreviews(lib)).toEqual({ a: 'pa', b: 'pb' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: FAIL — cannot resolve `../../src/core/people/photo-sets`.

- [ ] **Step 3: Add the types**

In `src/core/types.ts`:

Replace the `FacePair` interface with:
```ts
export interface PhotoSet {
  id: ID; name: string; kind: 'group' | 'single';
  nowImageId?: ID; thenImageId?: ID;
  previews: Record<ID, ID>;
  order: number;
}
export interface FacePair {
  id: ID; number: number; color: string; setId: ID;
  now?: FaceCrop; then?: FaceCrop;
  matchMethod: 'automatic' | 'manual';
  reviewStatus: 'suggested' | 'confirmed' | 'unmatched';
}
```
In `ActivityEvent`, after `readonly assets: Readonly<Record<ID, Asset>>;` add:
```ts
  readonly photoSets: readonly PhotoSet[];
```
Change `EventUpdate` to:
```ts
export type EventUpdate = Pick<EventSession, 'title' | 'isDemo' | 'phase' | 'wager' | 'correctPoints' | 'stealPoints' | 'people' | 'facePairs' | 'teams' | 'scoreEntries' | 'assets' | 'photoSets'>;
```
Change the `preparePeople` line in `Activity` to:
```ts
  preparePeople?: (segment: ActivitySegment<S, G>, event: EventUpdate) => void;
```
In `EventSession` change `formatVersion: 2;` to `formatVersion: 3;` and after `assets: Record<ID, Asset>;` add `photoSets: PhotoSet[];`.

- [ ] **Step 4: Create the photo-set helpers**

Create `src/core/people/photo-sets.ts`:
```ts
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
```

- [ ] **Step 5: Run the helper tests**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing migration tests**

Create `tests/unit/migrate.test.ts`:
```ts
import { beforeAll, describe, expect, it } from 'vitest';
import eventV2 from '../fixtures/event-v2.json';
import { discoverActivities } from '../../src/core/registry';
import { migrateEventV2 } from '../../src/core/migrate';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });
const v2 = () => structuredClone(eventV2) as Record<string, any>;

describe('migrateEventV2', () => {
  it('turns the Childhood vs Now group photos into Group 1 and assigns every face pair', () => {
    const migrated = migrateEventV2(v2());
    expect(migrated.formatVersion).toBe(3);
    expect(migrated.photoSets).toHaveLength(1);
    expect(migrated.photoSets[0]).toMatchObject({ name: 'Group 1', kind: 'group', nowImageId: 'img-now', thenImageId: 'img-then', order: 0 });
    expect(migrated.facePairs.every((p: any) => p.setId === migrated.photoSets[0].id)).toBe(true);
    for (const field of ['originalImageId', 'childhoodImageId', 'childhoodUploadId', 'previews']) expect(migrated.segments[0].game).not.toHaveProperty(field);
  });
  it('keeps only the previews of the two group photos', () => {
    const raw = v2();
    raw.segments[0].game.previews = { 'img-now': 'img-now-crop', 'raw-upload': 'img-then-crop' };
    expect(migrateEventV2(raw).photoSets[0].previews).toEqual({ 'img-now': 'img-now-crop' });
  });
  it('derives the set from the first complete face pair when no segment has photos', () => {
    const raw = v2();
    delete raw.segments[0].game.originalImageId; delete raw.segments[0].game.childhoodImageId;
    expect(migrateEventV2(raw).photoSets[0]).toMatchObject({ nowImageId: 'img-now', thenImageId: 'img-then' });
  });
  it('drops face pairs and people whose photos belong to neither group photo', () => {
    const raw = v2();
    raw.facePairs.push({ ...raw.facePairs[0], id: 'stray', now: { ...raw.facePairs[0].now, sourceImageId: 'elsewhere' } });
    raw.people.push({ ...raw.people[0], id: 'stray-person', facePairId: 'stray' });
    const migrated = migrateEventV2(raw);
    expect(migrated.facePairs.map((p: any) => p.id)).toEqual(['f1']);
    expect(migrated.people.map((p: any) => p.id)).toEqual(['p1']);
  });
  it('creates no set and keeps no pairs when there are no photos at all', () => {
    const raw = v2();
    delete raw.segments[0].game.originalImageId; delete raw.segments[0].game.childhoodImageId;
    raw.facePairs = [{ ...raw.facePairs[0], then: undefined }];
    const migrated = migrateEventV2(raw);
    expect(migrated.photoSets).toEqual([]); expect(migrated.facePairs).toEqual([]); expect(migrated.people).toEqual([]);
  });
  it('is applied by validateEvent, which returns a valid version 3 session', () => {
    const loaded = validateEvent(v2());
    expect(loaded.formatVersion).toBe(3);
    expect(loaded.photoSets).toHaveLength(1);
    expect(validateEvent(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
  });
});
```
The fixture's round references `p1`, whose pair is kept, so the session stays valid.

- [ ] **Step 7: Run it to see it fail**

Run: `npx vitest run tests/unit/migrate.test.ts`
Expected: FAIL — cannot resolve `../../src/core/migrate`.

- [ ] **Step 8: Write the migration**

Create `src/core/migrate.ts`:
```ts
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
```

- [ ] **Step 9: Update the session schema and validation**

In `src/core/session.ts`:

Add imports:
```ts
import { migrateEventV2 } from './migrate';
import { MAX_PHOTO_SETS } from './people/photo-sets';
```
Before `const schema = z.object({` add:
```ts
const photoSet = z.object({ id: z.string(), name: z.string().trim().min(1).max(80), kind: z.enum(['group', 'single']), nowImageId: z.string().optional(), thenImageId: z.string().optional(), previews: z.record(z.string(), z.string()), order: z.number().int().min(0) });
```
In `schema`: change `formatVersion: z.literal(2)` to `formatVersion: z.literal(3)`; in the `facePairs` item object add `setId: z.string(),` after `color: z.string(),`; after the `assets` entry add `photoSets: z.array(photoSet).max(MAX_PHOTO_SETS),`.

Replace the first four lines of `validateEvent` (through `const event = schema.parse(raw);`) with:
```ts
export function validateEvent(input: unknown): EventSession {
  let raw = input;
  const version = (raw as { formatVersion?: unknown })?.formatVersion;
  if (version === 1) throw new Error('This session was saved before Fun Friday Studio learned to run events. Please set up your game again — your photos and names are safe in Export pairs.');
  if (version === 2) raw = migrateEventV2(raw as Record<string, unknown>);
  else if (version !== 3) throw new Error('This session needs a newer version of Fun Friday Studio.');
  const event = schema.parse(raw);
```
In the `segments` map, replace the `return { ...segment, activityVersion: ...` line with:
```ts
    // Setup steps can be renamed between versions; an unknown step falls back to the first one.
    const stepIds = activity.setupSteps.map(step => step.id);
    return { ...segment, setupStepId: stepIds.includes(segment.setupStepId) ? segment.setupStepId : stepIds[0], activityVersion: activity.version, settings: activity.settingsSchema.parse(data.settings), game: activity.stateSchema.parse(data.game) };
```
After the line `if (session.people.some(p => !session.facePairs.some(f => f.id === p.facePairId))) throw ...` add:
```ts
  for (const set of session.photoSets) for (const id of [set.nowImageId, set.thenImageId, ...Object.keys(set.previews), ...Object.values(set.previews)]) if (id && !session.assets[id]) throw new Error('A photo set references a missing image.');
  if (new Set(session.photoSets.map(set => set.order)).size !== session.photoSets.length) throw new Error('Two photo sets share a position.');
  for (const pair of session.facePairs) {
    const set = session.photoSets.find(s => s.id === pair.setId);
    if (!set) throw new Error('A face pair references an unknown photo set.');
    if ((pair.now && pair.now.sourceImageId !== set.nowImageId) || (pair.then && pair.then.sourceImageId !== set.thenImageId)) throw new Error('A face uses a photo from a different photo set.');
  }
  for (const set of session.photoSets) if (set.kind === 'single' && session.facePairs.filter(p => p.setId === set.id).length !== 1) throw new Error('A single-photo set must hold exactly one person.');
```
Change the duplicate-id line's array to include sets:
```ts
  if (![session.people, session.facePairs, session.teams, session.scoreEntries, session.segments, session.photoSets].every(ids)) throw new Error('The session contains duplicate identifiers.');
```

- [ ] **Step 10: Update the event helpers**

In `src/core/event.ts`:
- Change the import to `import type { Activity, ActivityEvent, ActivitySegment, AnySession, EventSession, EventUpdate, Segment } from './types';` (unchanged if already so).
- In `createEvent`, change `formatVersion: 2` to `formatVersion: 3` and add `photoSets: []` after `assets: {}`.
- In `activityEvent`, add `photoSets: event.photoSets` after `assets: event.assets`.
- After `activityEvent` add:
```ts
// A mutable copy of the event-level fields an activity may change. Arrays are copied one level deep,
// so assigning a whole field never leaks into the source; the items themselves are still shared.
export function eventDraft(event: ActivityEvent): EventUpdate {
  return { title: event.title, isDemo: event.isDemo, phase: event.phase, wager: event.wager, correctPoints: event.correctPoints, stealPoints: event.stealPoints, people: [...event.people], facePairs: [...event.facePairs], teams: [...event.teams], scoreEntries: [...event.scoreEntries], assets: { ...event.assets }, photoSets: [...event.photoSets] };
}
```

- [ ] **Step 11: Move pairing and create the photo helpers**

Run:
```bash
git mv activities/childhood-vs-now/logic/pairing.ts src/core/people/pairing.ts
```
In `src/core/people/pairing.ts` change `import type { Rect } from '../../../src/core/types';` to `import type { Rect } from '../types';` and `export { intersectionOverUnion } from '../../../src/core/images/math';` to `export { intersectionOverUnion } from '../images/math';`.

In `tests/unit/pairing.test.ts` change the import path `'../../activities/childhood-vs-now/logic/pairing'` to `'../../src/core/people/pairing'`.

Create `src/core/people/photos.ts`:
```ts
import type { Asset, EventUpdate, FaceCrop, FacePair, PhotoSet, Rect } from '../types';
import { imageStore } from '../storage';
import { cropMany, inspectImage, scaleImage } from '../images/client';
import { defaultPadding } from '../images/math';
import { teamColors } from '../event';
import { pairFaces } from './pairing';
import { defaultIncluded } from './photo-sets';

export type LibraryDraft = Pick<EventUpdate, 'people' | 'facePairs' | 'photoSets' | 'assets' | 'isDemo'>;
export async function storeAsset(blob: Blob, name: string, width: number, height: number): Promise<Asset> {
  const id = await imageStore.put(blob); return { id, name, width, height, mime: blob.type || 'application/octet-stream' };
}
export async function storePhoto(blob: Blob, name: string) {
  const info = await inspectImage(blob);
  const asset = await storeAsset(blob, name, info.width, info.height);
  const scale = Math.min(1, 1600 / Math.max(info.width, info.height));
  const preview = await storeAsset(info.preview, `Preview - ${name}`, Math.round(info.width * scale), Math.round(info.height * scale));
  return { asset, preview };
}
export function makePairs(now: Rect[], then: Rect[], set: PhotoSet, tolerance: number, firstNumber = 1): FacePair[] {
  return pairFaces(now, then, tolerance).map((match, i) => {
    const number = firstNumber + i;
    return { id: crypto.randomUUID(), number, color: teamColors[(number - 1) % teamColors.length], setId: set.id, now: match.now === undefined ? undefined : { sourceImageId: set.nowImageId!, faceBox: now[match.now], padding: { ...defaultPadding } }, then: match.then === undefined ? undefined : { sourceImageId: set.thenImageId!, faceBox: then[match.then], padding: { ...defaultPadding } }, matchMethod: 'automatic', reviewStatus: match.now !== undefined && match.then !== undefined ? 'suggested' : 'unmatched' };
  });
}
export function syncPeople(library: Pick<LibraryDraft, 'people' | 'facePairs' | 'photoSets'>) {
  const fresh = defaultIncluded(library);
  library.people = library.facePairs.map(pair => {
    const existing = library.people.find(p => p.facePairId === pair.id);
    return existing ? { ...existing, included: Boolean(pair.now && pair.then && existing.included) } : { id: crypto.randomUUID(), facePairId: pair.id, name: '', funFact: '', included: fresh && Boolean(pair.now && pair.then) };
  });
}
export async function prepareCrops<T extends Pick<LibraryDraft, 'facePairs' | 'assets'>>(library: T, progress?: (s: string) => void): Promise<T> {
  const updated = structuredClone(library);
  const groups = new Map<string, { face: FaceCrop; label: string }[]>();
  for (const pair of updated.facePairs) for (const side of ['now', 'then'] as const) {
    const face = pair[side]; if (!face || face.cropImageId) continue;
    const entries = groups.get(face.sourceImageId) ?? [];
    entries.push({ face, label: `Face ${pair.number} - ${side}.jpg` }); groups.set(face.sourceImageId, entries);
  }
  // Decode each source just once, even for a 50-person group.
  for (const [source, entries] of groups) {
    progress?.(`Preparing ${entries.length} face crops…`);
    const crops = await cropMany(await imageStore.get(source), entries.map(e => e.face));
    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i], asset = await storeAsset(crop.blob, entries[i].label, crop.width, crop.height);
      entries[i].face.cropImageId = asset.id; updated.assets[asset.id] = asset;
    }
  }
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
```
Replacing only the current photo after the childhood photo was aligned re-scales the already-aligned image; that is accepted (the old `childhoodUploadId` is gone).

- [ ] **Step 12: Update the Childhood vs Now game state and demo**

`activities/childhood-vs-now/types.ts` — replace the `stateSchema` object's first two lines (the three image ids and `previews`) so the schema starts with `rounds`:
```ts
export const stateSchema = z.object({
  rounds: z.array(z.object({ id: z.string(), personId: z.string(), teamId: z.string(), revealed: z.boolean(), result: z.enum(['correct', 'missed']).nullable() })),
```
and change `initialState` to:
```ts
export const initialState = (): GameState => ({ rounds: [], currentRoundIndex: 0, finale: { wipePosition: 0 } });
```

Replace `activities/childhood-vs-now/logic/preparation.ts` entirely with:
```ts
import type { PreparedActivity, Rect } from '../../../src/core/types';
import { rpc } from '../../../src/core/images/client';
import { createPhotoSet } from '../../../src/core/people/photo-sets';
import { makePairs, prepareCrops, storePhoto, syncPeople } from '../../../src/core/people/photos';
import type { CVEventUpdate, CVSession, GameState, Settings } from '../types';
const demoJob = rpc(() => new Worker(new URL('../demo/demo.worker.ts', import.meta.url), { type: 'module' }));
export async function loadDemo(segment: CVSession, event: CVEventUpdate): Promise<PreparedActivity<Settings, GameState>> {
  const demo = await demoJob<{ now: Blob; then: Blob; nowFaces: Rect[]; thenFaces: Rect[]; width: number; height: number }>({ type: 'demo' });
  const now = await storePhoto(demo.now, 'Demo team - now.jpg'), then = await storePhoto(demo.then, 'Demo team - then.jpg');
  const next = structuredClone(segment), nextEvent = structuredClone(event);
  for (const a of [now.asset, now.preview, then.asset, then.preview]) nextEvent.assets[a.id] = a;
  nextEvent.photoSets = [];
  const set = createPhotoSet(nextEvent, 'Demo team', 'group');
  set.nowImageId = now.asset.id; set.thenImageId = then.asset.id;
  set.previews = { [now.asset.id]: now.preview.id, [then.asset.id]: then.preview.id };
  nextEvent.facePairs = makePairs(demo.nowFaces, demo.thenFaces, set, .2);
  nextEvent.facePairs.forEach(p => { p.reviewStatus = 'confirmed'; }); nextEvent.people = []; syncPeople(nextEvent);
  const names = ['Asha', 'Leo', 'Maya', 'Dev']; const facts = ['Still the first one on the dance floor.', 'Has never met a puzzle he could resist.', 'The unofficial keeper of the snack drawer.', 'Always has a good story for the lunch table.'];
  nextEvent.people.forEach((p, i) => { p.name = names[i]; p.funFact = facts[i]; });
  nextEvent.isDemo = true;
  nextEvent.phase = 'segment'; next.setupStepId = 'upload'; next.game.rounds = []; next.game.currentRoundIndex = 0; nextEvent.scoreEntries = [];
  return { segment: next, event: await prepareCrops(nextEvent) };
}
```

In `activities/childhood-vs-now/activity.ts`:
- Add imports: `import { primaryGroupSet } from '../../src/core/people/photo-sets';` and `import { eventDraft } from '../../src/core/event';`.
- Replace the `upload` step's `validate` with `validate: (_s, e) => { const set = primaryGroupSet(e); return set?.nowImageId && set.thenImageId ? [] : ['Upload both group photos first.']; }`.
- Replace the whole `preparePeople: (s, e, previews) => { ... },` block with:
```ts
  preparePeople: (s, e) => { if (e.facePairs.some(p => p.now && p.then)) s.setupStepId = 'game'; },
```
- In `validateSession`, delete the first line (the `for (const id of [s.game.originalImageId, ...` loop).
- Replace `remapImages: (g, ids) => ({ ... }),` with `remapImages: g => g,` (the game no longer holds image ids).
- In the `c` and `m` shortcuts, replace `{ ...ctx.event, people: [...ctx.event.people], facePairs: [...ctx.event.facePairs], teams: [...ctx.event.teams], scoreEntries: [...ctx.event.scoreEntries], assets: { ...ctx.event.assets } }` with `eventDraft(ctx.event)`.

- [ ] **Step 13: Replace the inline event copies everywhere**

Run this once from the repository root; it rewrites every `{ ...X, people: [...X.people], …, assets: { ...X.assets } }` literal to `eventDraft(X)`:
```bash
perl -0pi -e 's/\{ \.\.\.([\w.]+), people: \[\.\.\.\1\.people\], facePairs: \[\.\.\.\1\.facePairs\], teams: \[\.\.\.\1\.teams\], scoreEntries: \[\.\.\.\1\.scoreEntries\], assets: \{ \.\.\.\1\.assets \} \}/eventDraft($1)/g' activities/childhood-vs-now/setup/NamePeopleStep.tsx activities/childhood-vs-now/setup/MatchPeopleStep.tsx activities/childhood-vs-now/setup/GameSetupStep.tsx activities/childhood-vs-now/stage/Stage.tsx activities/childhood-vs-now/stage/Finale.tsx activities/act-it-out/setup/GameSetupStep.tsx activities/act-it-out/logic/turns.ts
grep -rn "people: \[\.\.\." src activities
```
Expected: the grep prints only `activities/childhood-vs-now/setup/UploadStep.tsx` lines (rewritten in Step 14). Add `import { eventDraft } from '../../../src/core/event';` to each of the seven files above (for `activities/act-it-out/logic/turns.ts` the path is the same: `'../../../src/core/event'`). Where a file already imports from that module, add `eventDraft` to the existing import instead.

In `src/main.tsx`, replace the object literal assigned to `const evt: EventUpdate = { title: session.title, … assets: session.assets };` with `const evt: EventUpdate = eventDraft(session);` and add `eventDraft` to the `./core/event` import.

In `src/app/App.tsx`:
- line 55 (`updateActivityEvent`): replace the inline `const draft: EventUpdate = { title: next.title, … assets: next.assets };` with `const draft: EventUpdate = eventDraft(next);`.
- line 75 (`demo`): replace `const evt: EventUpdate = { title: next.title, … assets: next.assets };` with `const evt: EventUpdate = eventDraft(next);`.
- add `eventDraft` to the `../core/event` import.

- [ ] **Step 14: Point the Childhood vs Now screens at the primary group set**

Replace `activities/childhood-vs-now/setup/UploadStep.tsx` entirely with:
```tsx
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { DropZone } from '../../../src/components/DropZone';
import { eventDraft } from '../../../src/core/event';
import { createPhotoSet, primaryGroupSet } from '../../../src/core/people/photo-sets';
import { alignThen, storePhoto } from '../../../src/core/people/photos';
import { loadDemo } from '../logic/preparation';
import type { Context } from '../types';
export function UploadStep({ segment, event, update, updateEvent, runTask, notify }: Context) {
  const set = primaryGroupSet(event);
  const upload = (side: 'now' | 'then', file: File) => runTask('Opening your photo…', async () => {
    if (event.facePairs.length && !event.isDemo && !window.confirm('Replacing a group photo resets face matches and game progress. Continue?')) return;
    const stored = await storePhoto(file, file.name);
    let next = structuredClone(eventDraft(event));
    if (next.isDemo) { next.photoSets = []; next.assets = {}; }
    next.isDemo = false; next.facePairs = []; next.people = []; next.scoreEntries = [];
    const target = primaryGroupSet(next) ?? createPhotoSet(next, 'Group 1', 'group');
    next.assets[stored.asset.id] = stored.asset; next.assets[stored.preview.id] = stored.preview;
    target.previews[stored.asset.id] = stored.preview.id;
    if (side === 'now') target.nowImageId = stored.asset.id; else target.thenImageId = stored.asset.id;
    next = await alignThen(next, target.id);
    update(s => { s.game.rounds = []; s.game.currentRoundIndex = 0; }); updateEvent(e => Object.assign(e, next));
    notify('Photo saved on this laptop.');
  });
  const nowId = set?.nowImageId, thenId = set?.thenImageId;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE TEAM PHOTOS</span><h1>Let’s turn back the clock<span className="accent">.</span></h1><p>Same people. Same places. A few decades apart.</p></div>
    <div className="upload-grid"><DropZone label="THE GROWN-UPS" title="Original group photo (now)" subtitle="Your team, just as they are today." imageId={nowId && (set!.previews[nowId] || nowId)} onFile={f => void upload('now', f)}/><DropZone label="THE LITTLE ONES" title="Childhood group photo (then)" subtitle="The same photo, already edited into 5–6 year olds." imageId={thenId && (set!.previews[thenId] || thenId)} onFile={f => void upload('then', f)}/></div>
    <div className="info-strip"><ShieldCheck size={20}/><span>Your photos stay on this laptop. Full resolution is preserved; different image sizes are aligned automatically.</span></div>
    <div className="setup-footer"><button className="button subtle" onClick={() => void runTask('Drawing your demo team…', async () => { const next = await loadDemo(segment, eventDraft(event)); update(s => Object.assign(s, next.segment)); updateEvent(e => Object.assign(e, next.event)); })}><Sparkles size={17}/> Use demo photos</button><button className="button primary" disabled={!nowId || !thenId} onClick={() => update(s => { s.setupStepId = 'match'; })}>Match people <ArrowRight size={18}/></button></div>
  </div>;
}
```

In `activities/childhood-vs-now/setup/MatchPeopleStep.tsx`:
- Replace the imports of `makePairs, prepareCrops, syncPeople` and `intersectionOverUnion` with:
```ts
import { makePairs, prepareCrops, syncPeople } from '../../../src/core/people/photos';
import { intersectionOverUnion } from '../../../src/core/people/pairing';
import { defaultIncluded, primaryGroupSet } from '../../../src/core/people/photo-sets';
```
- Replace `const nowId = segment.game.originalImageId!, thenId = segment.game.childhoodImageId!;` with:
```ts
  const set = primaryGroupSet(event), nowId = set?.nowImageId ?? '', thenId = set?.thenImageId ?? '';
```
- Change the early-return guard `if (!now || !then) return` to `if (!set || !now || !then) return` (same JSX).
- In `select`, replace `person.included = true;` with `person.included = defaultIncluded(s);`.
- In `add`, inside the pushed object, add `setId: set.id,` after `color: teamColors[(number - 1) % teamColors.length],`.
- In `detect`, replace `makePairs(newNow, newThen, nowId, thenId, segment.settings.matchingTolerance)` with `makePairs(newNow, newThen, set, segment.settings.matchingTolerance)`.
- In `editor`, replace both `segment.game.previews[` with `set.previews[`.
- Replace the footer's primary button `onClick` with:
```tsx
onClick={() => void runTask('Preparing your face pairs…', async () => { const next = await prepareCrops(eventDraft(event)); update(s => { s.setupStepId = 'names'; }); updateEvent(s => Object.assign(s, next)); })}
```

In `activities/childhood-vs-now/setup/NamePeopleStep.tsx`:
- Replace `import { prepareCrops } from '../logic/preparation';` with:
```ts
import { prepareCrops } from '../../../src/core/people/photos';
import { allPreviews, primaryGroupSet } from '../../../src/core/people/photo-sets';
```
- Replace `const nowId = segment.game.originalImageId!, thenId = segment.game.childhoodImageId!, now = event.assets[nowId];` with:
```ts
  const set = primaryGroupSet(event), nowId = set?.nowImageId ?? '', thenId = set?.thenImageId ?? '', now = event.assets[nowId], previews = allPreviews(event);
```
- Replace every `segment.game.previews` with `previews`.
- In the "Prepare face pairs" button, change `await prepareCrops(segment, mutableEvent());` to `await prepareCrops(mutableEvent());` (`mutableEvent` is now `() => eventDraft(event)` after Step 13).
- Replace the "Set up the game" button `onClick` body with:
```tsx
onClick={() => void runTask('Saving the final crops…', async () => { const next = await prepareCrops(mutableEvent()); update(s => { s.setupStepId = 'game'; }); updateEvent(e => Object.assign(e, next)); })}
```

In `activities/childhood-vs-now/setup/GameSetupStep.tsx`:
- Replace `import { prepareCrops } from '../logic/preparation';` with `import { prepareCrops } from '../../../src/core/people/photos';`.
- Replace the Start button `onClick` body with:
```tsx
onClick={() => void runTask('Getting the team ready…', async () => { const prepared = await prepareCrops(mutableEvent()); const next = structuredClone(segment); startNewGame(next, prepared); update(s => Object.assign(s, next)); updateEvent(e => Object.assign(e, prepared)); })}
```

In `activities/childhood-vs-now/stage/Finale.tsx`:
- Add `import { primaryGroupSet } from '../../../src/core/people/photo-sets';`.
- Replace `const image = event.assets[segment.game.originalImageId!], ratio = ...` with:
```tsx
  const set = primaryGroupSet(event), image = set?.nowImageId ? event.assets[set.nowImageId] : undefined, ratio = image ? image.width / image.height : 16 / 9;
```
- Replace `id={segment.game.childhoodImageId}` with `id={set?.thenImageId}` and `id={segment.game.originalImageId}` with `id={set?.nowImageId}`.

- [ ] **Step 15: Update the library, import and export plumbing**

Replace `src/core/people/event-library.ts` with:
```ts
import { activitySegment } from '../event';
import { getActivity } from '../registry';
import type { EventSession, EventUpdate } from '../types';
import type { ImportedFacePairs } from '../transfer';

export function prepareSegmentPeople(event: EventSession, index = 0) {
  const segment = event.segments[index], status = segment.status;
  const view = activitySegment(event, index), shared: EventUpdate = { title: event.title, isDemo: event.isDemo, phase: event.phase, wager: event.wager, correctPoints: event.correctPoints, stealPoints: event.stealPoints, people: event.people, facePairs: event.facePairs, teams: event.teams, scoreEntries: event.scoreEntries, assets: event.assets, photoSets: event.photoSets };
  getActivity(segment.activityId)?.preparePeople?.(view, shared);
  segment.settings = view.settings; segment.game = view.game; segment.setupStepId = view.setupStepId;
  Object.assign(event, shared);
  segment.status = status;
}

// Replacing shared identities invalidates every activity, including completed ones.
export function replaceEventPeople(event: EventSession, imported: ImportedFacePairs) {
  event.assets = imported.assets; event.photoSets = imported.photoSets; event.facePairs = imported.facePairs; event.people = imported.people;
  event.scoreEntries = []; event.isDemo = false;
  if (event.wager) event.wager.bets = {};
  event.currentSegmentIndex = 0;
  event.phase = event.phase === 'lineup' || !event.segments.length ? 'lineup' : 'segment';
  event.segments.forEach((segment, index) => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`Activity not installed: ${segment.activityId}`);
    segment.game = activity.createInitialState();
    segment.status = index === 0 && event.phase === 'segment' ? 'setup' : 'pending';
    segment.setupStepId = activity.setupSteps[0].id;
    prepareSegmentPeople(event, index);
  });
}
```
(`resetEventProgress`, `addEventPeople` and the lock arrive in Task 3.)

In `src/app/standings-logic.ts` nothing changes (it calls `prepareSegmentPeople(event, next)`).

In `src/core/transfer.ts`:
- Change the types import to `import type { Asset, EventSession, FacePair, Person, PhotoSet } from './types';` (drop `AnySession`).
- Replace the `ImportedFacePairs` interface with:
```ts
export interface ImportedFacePairs {
  assets: Record<string, Asset>;
  photoSets: PhotoSet[];
  facePairs: FacePair[];
  people: Person[];
}
```
- In `remapEventImages`, before the `for (const segment of event.segments)` loop add:
```ts
  for (const set of event.photoSets) {
    if (set.nowImageId) set.nowImageId = remap[set.nowImageId] ?? set.nowImageId;
    if (set.thenImageId) set.thenImageId = remap[set.thenImageId] ?? set.thenImageId;
    set.previews = Object.fromEntries(Object.entries(set.previews).map(([source, preview]) => [remap[source] ?? source, remap[preview] ?? preview]));
  }
```
- In `importFacePairs`, replace everything from `const nowSource = assetsByPath.get(bundle.groups.now.path)!;` to the end of the `return { ... };` with:
```ts
    const nowSource = assetsByPath.get(bundle.groups.now.path)!;
    const thenSource = assetsByPath.get(bundle.groups.then.path)!;
    const previews: Record<string, string> = {};
    if (bundle.groups.nowPreview) previews[nowSource.id] = assetsByPath.get(bundle.groups.nowPreview.path)!.id;
    if (bundle.groups.thenPreview) previews[thenSource.id] = assetsByPath.get(bundle.groups.thenPreview.path)!.id;
    const set: PhotoSet = { id: crypto.randomUUID(), name: file.name.replace(/\.zip$/i, '').trim().slice(0, 80) || 'Imported group', kind: 'group', nowImageId: nowSource.id, thenImageId: thenSource.id, previews, order: 0 };
    const facePairs: FacePair[] = bundle.pairs.map((imported, index) => ({
      id: crypto.randomUUID(),
      number: options.startNumber + index + 1,
      color: imported.color,
      setId: set.id,
      now: { sourceImageId: nowSource.id, cropImageId: assetsByPath.get(imported.now.cropPath)!.id, faceBox: imported.now.faceBox, padding: imported.now.padding },
      then: { sourceImageId: thenSource.id, cropImageId: assetsByPath.get(imported.then.cropPath)!.id, faceBox: imported.then.faceBox, padding: imported.then.padding },
      matchMethod: 'manual',
      reviewStatus: 'confirmed',
    }));
    const people: Person[] = bundle.pairs.map((imported, index) => ({ id: crypto.randomUUID(), name: imported.name, funFact: imported.funFact, included: imported.included, facePairId: facePairs[index].id }));
    return { assets, photoSets: [set], facePairs, people };
```
- In `exportFacePairs`, change the signature to `export async function exportFacePairs(session: EventSession) {` and replace the `const previewIds = ...` line with:
```ts
  const previewIds = session.photoSets.find(set => set.id === pairs[0].setId)?.previews ?? {};
```
- Change the helper signatures `requireAsset(session: AnySession | EventSession, …)` and `optionalAsset(session: AnySession | EventSession, …)` to take `session: EventSession`.

In `src/app/App.tsx`, line 95 (`onSetup` of `PeopleLibrary`) is unchanged in this task.

- [ ] **Step 16: Update the existing unit tests**

`tests/unit/session.test.ts`, first test — change `expect(once.formatVersion).toBe(2);` to `expect(once.formatVersion).toBe(3);` and add `expect(once.photoSets).toHaveLength(1);`.

`tests/unit/event.test.ts` — change `expect(fresh.formatVersion).toBe(2);` to `expect(fresh.formatVersion).toBe(3);` and add `expect(fresh.photoSets).toEqual([]);`.

`tests/unit/act-it-out.test.ts` line 62 — add `photoSets: [],` after `assets: {},` in `anEvent`.

`tests/unit/event-library.test.ts`:
- Replace the `imported()` helper with:
```ts
function imported(): ImportedFacePairs {
  const event = validateEvent(fixture);
  return { people: event.people, facePairs: event.facePairs, assets: event.assets, photoSets: event.photoSets };
}
```
- In the first test delete the line `for (const s of event.segments) (s.game as any).originalImageId = 'obsolete';` and the assertion `expect(view.game.originalImageId).not.toBe('obsolete');`.
- In the second test replace `expect(segmentView(event, 0).game.originalImageId).toBe(event.facePairs[0].now!.sourceImageId);` with `expect(event.photoSets[0].nowImageId).toBe(event.facePairs[0].now!.sourceImageId);`.

`tests/unit/transfer-remap.test.ts`, first test — replace the loop over segments with:
```ts
    expect(event.photoSets[0].nowImageId).toBe('new-now');
    expect(event.photoSets[0].thenImageId).toBe('new-then');
```

`tests/unit/pairs.test.ts`:
- Change the types import to `import type { EventSession } from '../../src/core/types';`.
- Replace `function demoSession(): AnySession {` … `}` with:
```ts
function demoSession(): EventSession {
  const nowBox = { x: 0.1, y: 0.2, width: 0.2, height: 0.3 };
  const thenBox = { x: 0.3, y: 0.1, width: 0.25, height: 0.35 };
  const padding = { top: 0.4, right: 0.3, bottom: 0.7, left: 0.3 };
  return {
    formatVersion: 3, id: 'session-id', title: 'Demo', createdAt: '', updatedAt: '', isDemo: false,
    segments: [], currentSegmentIndex: 0, phase: 'lineup', correctPoints: 2, stealPoints: 1, teams: [], scoreEntries: [],
    assets: {
      'now-source': { id: 'now-source', name: 'Today.png', width: 1000, height: 800, mime: 'image/png' },
      'then-source': { id: 'then-source', name: 'Childhood.webp', width: 1000, height: 800, mime: 'image/webp' },
      'now-preview': { id: 'now-preview', name: 'Today preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      'then-preview': { id: 'then-preview', name: 'Childhood preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      'now-crop': { id: 'now-crop', name: 'Now crop.jpg', width: 200, height: 240, mime: 'image/jpeg' },
      'then-crop': { id: 'then-crop', name: 'Then crop.jpg', width: 210, height: 250, mime: 'image/jpeg' },
    },
    photoSets: [{ id: 'set-id', name: 'Engineering', kind: 'group', nowImageId: 'now-source', thenImageId: 'then-source', previews: { 'now-source': 'now-preview', 'then-source': 'then-preview' }, order: 0 }],
    facePairs: [{
      id: 'pair-id', number: 7, color: '#f7d873', setId: 'set-id', matchMethod: 'manual', reviewStatus: 'confirmed',
      now: { sourceImageId: 'now-source', cropImageId: 'now-crop', faceBox: nowBox, padding },
      then: { sourceImageId: 'then-source', cropImageId: 'then-crop', faceBox: thenBox, padding },
    }],
    people: [{ id: 'person-id', facePairId: 'pair-id', name: 'Asha', funFact: 'Loves chai', included: false }],
  };
}
```
- In `'strictly imports a complete bundle with fresh linked records'`, replace the four `imported.originalImageId` / `childhoodImageId` / `childhoodUploadId` / `previews` expectations with:
```ts
    expect(imported.photoSets).toEqual([{ id: expect.any(String), name: 'pairs', kind: 'group', nowImageId: 'fresh-1', thenImageId: 'fresh-2', previews: { 'fresh-1': 'fresh-3' }, order: 0 }]);
    expect(imported.facePairs[0].setId).toBe(imported.photoSets[0].id);
```

- [ ] **Step 17: Update the browser tests that read game photo fields**

In `tests/browser/app.spec.ts`:
- Lines 65–69 (the `importedGame.originalImageId` / `childhoodImageId` / `childhoodUploadId` / `previews` block) become:
```ts
  const set = imported.photoSets[0];
  expect(imported.assets[set.nowImageId]).toBeTruthy();
  expect(imported.assets[set.thenImageId]).toBeTruthy();
  expect(imported.assets[set.previews[set.nowImageId]]).toBeTruthy();
  expect(imported.assets[set.previews[set.thenImageId]]).toBeTruthy();
```
- Lines 172–175 become:
```ts
  expect(session.assets[session.photoSets[0].nowImageId].width).toBe(4200);
  expect(session.assets[session.photoSets[0].thenImageId].width).toBe(4200);
  expect(session.assets[session.photoSets[0].thenImageId].height).toBe(2400);
```
- In the loop at lines 331–335, replace the two `segment.game.originalImageId` assertions with (outside the loop, once):
```ts
  expect(replaced.assets[replaced.photoSets[0].nowImageId]).toBeTruthy();
  expect(beforeReplace.assets[replaced.photoSets[0].nowImageId]).toBeUndefined();
```
keeping `expect(segment.game.rounds).toEqual([]);` inside the loop.

- [ ] **Step 18: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && npx playwright test --reporter=line
```
Expected: `TSC_OK`; all unit tests pass (including the two new files); Playwright no worse than the Task 0 baseline. If `tsc` reports a remaining `originalImageId`, `childhoodImageId`, `childhoodUploadId` or `game.previews` reference, it is a reader missed above — point it at `primaryGroupSet(event)` the same way.

- [ ] **Step 19: Commit**

```bash
git add -A src activities tests
git commit -m "feat(people): keep group photos in the people library as photo sets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 2: Face-pair bundle version 2

Export writes every set; import reads version 1 or 2; reading (validation, image inspection) is split from storing so Task 3 can ask about duplicates before anything is stored.

**Files:**
- Modify: `src/core/people/pairs.ts` (rewrite)
- Modify: `src/core/transfer.ts` (face-pair import/export section)
- Modify: `src/core/people/PeopleLibrary.tsx` (one call site)
- Test: `tests/unit/pairs.test.ts`

**Interfaces:**
- Consumes: `orderedSets` (Task 1), `MAX_PHOTO_SETS` (Task 1), `ImportedFacePairs` (Task 1).
- Produces (`pairs.ts`): `FACE_PAIR_BUNDLE_VERSION = 2`; types `FacePairBundleImage`, `FacePairBundleSet { key; name; kind; now; then; nowPreview?; thenPreview? }`, `FacePairBundleEntry { number; set; color; name; funFact; included; now; then }`, `FacePairsBundleManifest { version: 2; sets; pairs }`; `SET_IMAGE_FIELDS`; `setKey(index)`; `setImagePath(key, field)`; `pairCropPath(number, side)`; `bundleSetName(fileName)`; `bundlePaths(manifest): string[]`; `parseFacePairsBundleManifest(raw, fallbackSetName = 'Imported group')`; `assertLibraryCapacity(adding: { pairs; sets }, current: { people; facePairs; photoSets })`; `maxFacePairNumber`; `hasJpegSignature`; `normalizeName(name)`; `duplicateNames(existing: readonly Person[], manifest): string[]`; `duplicateSummary(names): string`.
- Produces (`transfer.ts`): `FacePairsBundle { manifest; images: Map<string, BundleImage> }`; `StoreBundleOptions { startNumber; startOrder; current: { people; facePairs; photoSets }; skipNames?: ReadonlySet<string> }`; `readFacePairsBundle(file): Promise<FacePairsBundle>`; `storeFacePairsBundle(bundle, options): Promise<ImportedFacePairs>`; `importFacePairs(file, options: StoreBundleOptions)`; `exportFacePairs(event: EventSession)`.

- [ ] **Step 1: Update the existing manifest tests for the version 1 upgrade**

In `tests/unit/pairs.test.ts`:
- Replace the import block from `'../../src/core/people/pairs'` with:
```ts
import {
  assertLibraryCapacity,
  bundleSetName,
  duplicateNames,
  duplicateSummary,
  hasJpegSignature,
  maxFacePairNumber,
  parseFacePairsBundleManifest,
  type FacePairsBundleManifest,
} from '../../src/core/people/pairs';
```
- In `validManifest`, change `version: overrides.version ?? FACE_PAIR_BUNDLE_VERSION,` to `version: overrides.version ?? 1,`.
- In `'accepts a valid multi-person manifest with optional group previews'`, replace the whole `expect(parseFacePairsBundleManifest(raw)).toEqual({ … } satisfies FacePairsBundleManifest);` with:
```ts
    expect(parseFacePairsBundleManifest(raw, 'Team offsite')).toEqual({
      version: 2,
      sets: [{
        key: '01', name: 'Team offsite', kind: 'group',
        now: { path: 'groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
        then: { path: 'groups/then', name: 'Team childhood', width: 4000, height: 3000, mime: 'image/jpeg' },
        nowPreview: { path: 'groups/now-preview', name: 'Team today preview', width: 1200, height: 900, mime: 'image/jpeg' },
        thenPreview: { path: 'groups/then-preview', name: 'Team childhood preview', width: 1200, height: 900, mime: 'image/jpeg' },
      }],
      pairs: [
        { number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: true, now: pairSide(1, 'now'), then: pairSide(1, 'then') },
        { number: 2, set: '01', color: '#eea7bb', name: 'Leo', funFact: '', included: false, now: pairSide(2, 'now'), then: pairSide(2, 'then') },
      ],
    } satisfies FacePairsBundleManifest);
```
- In `'rejects unsupported manifest versions'`, change `validManifest({ version: 2 })` to `validManifest({ version: 3 })`.
- Replace the whole `describe('face-pair import limits', …)` block with:
```ts
describe('face-pair import limits', () => {
  const empty = { people: 0, facePairs: 0, photoSets: 0 };
  it('rejects imports that exceed any library limit', () => {
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, people: 500 })).toThrow(/500 people/i);
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, facePairs: 1000 })).toThrow(/1000 face pairs/i);
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, photoSets: 20 })).toThrow(/20 photo sets/i);
    expect(() => assertLibraryCapacity({ pairs: 2, sets: 1 }, { people: 499, facePairs: 999, photoSets: 0 })).toThrow(/500 people.*1000 face pairs/i);
  });
  it('accepts imports exactly at the limits', () => {
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { people: 499, facePairs: 999, photoSets: 19 })).not.toThrow();
    expect(() => assertLibraryCapacity({ pairs: 500, sets: 20 }, empty)).not.toThrow();
  });
  it('starts numbering after the largest existing pair number', () => {
    expect(maxFacePairNumber([])).toBe(0);
    expect(maxFacePairNumber([1, 10, 3])).toBe(10);
  });
});
```

- [ ] **Step 2: Add the failing version 2 and duplicate-name tests**

Append to `tests/unit/pairs.test.ts` (before `function demoSession`):
```ts
const image = (path: string, name = path) => ({ path, name, width: 4000, height: 3000, mime: 'image/jpeg' });
function v2Manifest(): any {
  return {
    version: 2,
    sets: [
      { key: '01', name: 'Engineering', kind: 'group', now: image('sets/01/now'), then: image('sets/01/then'), nowPreview: image('sets/01/now-preview') },
      { key: '02', name: 'Priya', kind: 'single', now: image('sets/02/now'), then: image('sets/02/then') },
    ],
    pairs: [
      { number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: '', included: true, now: pairSide(1, 'now'), then: pairSide(1, 'then') },
      { number: 2, set: '01', color: '#eea7bb', name: 'Leo', funFact: '', included: false, now: pairSide(2, 'now'), then: pairSide(2, 'then') },
      { number: 3, set: '02', color: '#8fcbe0', name: 'Priya', funFact: '', included: true, now: pairSide(3, 'now'), then: pairSide(3, 'then') },
    ],
  };
}

describe('face-pair bundle manifest version 2', () => {
  it('accepts several sets, including a single-photo set', () => {
    const manifest = parseFacePairsBundleManifest(v2Manifest());
    expect(manifest.sets.map(s => [s.key, s.kind])).toEqual([['01', 'group'], ['02', 'single']]);
    expect(manifest.pairs.map(p => p.set)).toEqual(['01', '01', '02']);
  });
  it('rejects set keys out of order and set images away from their fixed paths', () => {
    const wrongKey = v2Manifest(); wrongKey.sets[1].key = '03'; wrongKey.pairs[2].set = '03';
    expect(() => parseFacePairsBundleManifest(wrongKey)).toThrow(/key 02/);
    const wrongPath = v2Manifest(); wrongPath.sets[0].then = image('sets/02/then-copy');
    expect(() => parseFacePairsBundleManifest(wrongPath)).toThrow(/sets\/01\/then/);
  });
  it('rejects a pair naming an unknown set, an empty set and a crowded single set', () => {
    const unknown = v2Manifest(); unknown.pairs[0].set = '09';
    expect(() => parseFacePairsBundleManifest(unknown)).toThrow(/unknown photo set/i);
    const empty = v2Manifest(); empty.pairs[2].set = '01';
    expect(() => parseFacePairsBundleManifest(empty)).toThrow(/02 has no people/i);
    const crowded = v2Manifest(); crowded.pairs[1].set = '02';
    expect(() => parseFacePairsBundleManifest(crowded)).toThrow(/exactly one person/i);
  });
  it('rejects a set without a name', () => {
    const unnamed = v2Manifest(); unnamed.sets[0].name = '  ';
    expect(() => parseFacePairsBundleManifest(unnamed)).toThrow(/name/i);
  });
  it('names a version 1 set after its file', () => {
    expect(bundleSetName('Design offsite.zip')).toBe('Design offsite');
    expect(bundleSetName('.zip')).toBe('Imported group');
    expect(bundleSetName(`${'x'.repeat(90)}.ZIP`)).toHaveLength(80);
  });
});

describe('duplicate names', () => {
  it('matches names ignoring case and surrounding spaces', () => {
    const manifest = parseFacePairsBundleManifest(v2Manifest());
    const existing = [{ id: 'a', facePairId: 'x', name: ' asha ', funFact: '', included: true }, { id: 'b', facePairId: 'y', name: '', funFact: '', included: true }];
    expect(duplicateNames(existing, manifest)).toEqual(['Asha']);
  });
  it('summarises one, two and many names', () => {
    expect(duplicateSummary(['Asha'])).toBe('Asha is already in your library.');
    expect(duplicateSummary(['Asha', 'Leo'])).toBe('Asha and Leo are already in your library.');
    expect(duplicateSummary(['Asha', 'Leo', 'Maya', 'Dev', 'Priya'])).toBe('Asha, Leo and 3 more are already in your library.');
  });
});
```

- [ ] **Step 3: Run the manifest tests to see them fail**

Run: `npx vitest run tests/unit/pairs.test.ts`
Expected: FAIL — `assertLibraryCapacity`, `bundleSetName`, `duplicateNames`, `duplicateSummary` are not exported; the upgraded manifest shape does not match.

- [ ] **Step 4: Rewrite the manifest module**

Replace `src/core/people/pairs.ts` with:
```ts
import { z } from 'zod';
import type { Person, Rect } from '../types';
import { MAX_PHOTO_SETS } from './photo-sets';

export const MAX_PEOPLE = 500;
export const MAX_FACE_PAIRS = 1000;
export const FACE_PAIR_BUNDLE_VERSION = 2;

export interface FacePairBundlePadding { top: number; right: number; bottom: number; left: number }
export interface FacePairBundleFaceSide { cropPath: string; faceBox: Rect; padding: FacePairBundlePadding }
export interface FacePairBundleImage { path: string; name: string; width: number; height: number; mime: string }
export const SET_IMAGE_FIELDS = ['now', 'then', 'nowPreview', 'thenPreview'] as const;
export type SetImageField = typeof SET_IMAGE_FIELDS[number];
export interface FacePairBundleSet { key: string; name: string; kind: 'group' | 'single'; now: FacePairBundleImage; then: FacePairBundleImage; nowPreview?: FacePairBundleImage; thenPreview?: FacePairBundleImage }
export interface FacePairBundleEntry { number: number; set: string; color: string; name: string; funFact: string; included: boolean; now: FacePairBundleFaceSide; then: FacePairBundleFaceSide }
export interface FacePairsBundleManifest { version: 2; sets: FacePairBundleSet[]; pairs: FacePairBundleEntry[] }

export const setKey = (index: number) => String(index + 1).padStart(2, '0');
const FILE_NAMES: Record<SetImageField, string> = { now: 'now', then: 'then', nowPreview: 'now-preview', thenPreview: 'then-preview' };
export const setImagePath = (key: string, field: SetImageField) => `sets/${key}/${FILE_NAMES[field]}`;
const v1GroupPath = (field: SetImageField) => `groups/${FILE_NAMES[field]}`;
export const pairCropPath = (number: number, side: 'now' | 'then') => `pairs/${String(number).padStart(3, '0')}-${side}.jpg`;
export const bundleSetName = (fileName: string) => fileName.replace(/\.zip$/i, '').trim().slice(0, 80) || 'Imported group';

const paddingValue = z.number().min(0).max(3, { message: 'Crop padding must stay between 0 and 3.' });
const paddingSchema = z.object({ top: paddingValue, right: paddingValue, bottom: paddingValue, left: paddingValue });
const faceBoxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) })
  .refine(rect => rect.x + rect.width <= 1.00001 && rect.y + rect.height <= 1.00001, { message: 'Face box lies outside the image.' });
const imageSchema = z.object({
  path: z.string(),
  name: z.string().trim().min(1, 'Every group image needs a name.'),
  width: z.number().positive('Group image width must be positive.'),
  height: z.number().positive('Group image height must be positive.'),
  mime: z.string().refine(mime => mime.startsWith('image/'), { message: 'Group image MIME type must be an image.' }),
});
const faceSideSchema = z.object({ cropPath: z.string(), faceBox: faceBoxSchema, padding: paddingSchema });
const pairSchema = z.object({
  number: z.number().int().positive().max(MAX_FACE_PAIRS),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Each pair needs a hex color.'),
  name: z.string().trim().min(1, 'Every person needs a display name.'),
  funFact: z.string().max(240),
  included: z.boolean(),
  now: faceSideSchema,
  then: faceSideSchema,
});
const v1Schema = z.object({
  version: z.literal(1),
  groups: z.object({ now: imageSchema, then: imageSchema, nowPreview: imageSchema.optional(), thenPreview: imageSchema.optional() }),
  pairs: z.array(pairSchema).min(1, 'The bundle manifest must include at least one pair.').max(MAX_FACE_PAIRS),
});
const v2Schema = z.object({
  version: z.literal(2),
  sets: z.array(z.object({ key: z.string(), name: z.string().trim().min(1, 'Every photo set needs a name.').max(80), kind: z.enum(['group', 'single']), now: imageSchema, then: imageSchema, nowPreview: imageSchema.optional(), thenPreview: imageSchema.optional() }))
    .min(1, 'The bundle manifest must include at least one photo set.').max(MAX_PHOTO_SETS),
  pairs: z.array(pairSchema.extend({ set: z.string() })).min(1, 'The bundle manifest must include at least one pair.').max(MAX_FACE_PAIRS),
});

function formatManifestIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid face pair bundle manifest.';
  const path = issue.path.map(part => String(part)).join('.');
  if (path.startsWith('groups')) return issue.message.includes('group') ? issue.message : `Invalid group metadata: ${issue.message}`;
  if (path.startsWith('sets')) return issue.message.includes('set') ? issue.message : `Invalid photo set metadata: ${issue.message}`;
  if (path.includes('.then') || path.endsWith('then')) return `Missing or invalid then side: ${issue.message}`;
  return issue.message;
}
function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(formatManifestIssue(parsed.error));
  return parsed.data;
}
function assertSafeBundlePath(path: string) {
  if (!path || path.includes('\\') || path.startsWith('/') || path.includes('..') || path.includes('//')) throw new Error('Bundle manifest paths must stay under sets/, groups/ and pairs/.');
}
// Duplicate references are reported before fixed-location mismatches, so a copied path names the real problem.
function checkFiles(manifest: FacePairsBundleManifest, expected: (set: FacePairBundleSet, field: SetImageField) => string, label: (set: FacePairBundleSet) => string) {
  const seen = new Map<string, string>();
  const track = (path: string, what: string) => {
    assertSafeBundlePath(path);
    const previous = seen.get(path);
    if (previous) throw new Error(`Duplicate bundle file reference for ${path} (${previous} and ${what}).`);
    seen.set(path, what);
  };
  for (const set of manifest.sets) for (const field of SET_IMAGE_FIELDS) { const image = set[field]; if (image) track(image.path, `set ${set.key} ${field}`); }
  const numbers = new Set<number>();
  for (const pair of manifest.pairs) {
    if (numbers.has(pair.number)) throw new Error(`Duplicate pair number ${pair.number}.`);
    numbers.add(pair.number);
    track(pair.now.cropPath, `pair ${pair.number} now crop`); track(pair.then.cropPath, `pair ${pair.number} then crop`);
  }
  for (const set of manifest.sets) for (const field of SET_IMAGE_FIELDS) {
    const image = set[field], path = expected(set, field);
    if (image && image.path !== path) throw new Error(`${label(set)} path must be ${path}.`);
  }
  for (const pair of manifest.pairs) for (const side of ['now', 'then'] as const) {
    const path = pairCropPath(pair.number, side);
    if (pair[side].cropPath !== path) throw new Error(`Pair ${pair.number} ${side} crop path must be ${path}.`);
  }
}
function checkSets(manifest: FacePairsBundleManifest) {
  manifest.sets.forEach((set, index) => { if (set.key !== setKey(index)) throw new Error(`Photo set ${index + 1} must use key ${setKey(index)}.`); });
  const keys = new Set(manifest.sets.map(set => set.key));
  for (const pair of manifest.pairs) if (!keys.has(pair.set)) throw new Error(`Pair ${pair.number} names an unknown photo set ${pair.set}.`);
  for (const set of manifest.sets) {
    const count = manifest.pairs.filter(pair => pair.set === set.key).length;
    if (!count) throw new Error(`Photo set ${set.key} has no people.`);
    if (set.kind === 'single' && count !== 1) throw new Error(`Single-photo set ${set.key} must hold exactly one person.`);
  }
}

// Version 1 held one group; it becomes a version 2 manifest with a single set that keeps its groups/ paths.
export function parseFacePairsBundleManifest(raw: unknown, fallbackSetName = 'Imported group'): FacePairsBundleManifest {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 1) {
    const v1 = parseWith(v1Schema, raw);
    const manifest: FacePairsBundleManifest = { version: 2, sets: [{ key: '01', name: fallbackSetName, kind: 'group', ...v1.groups }], pairs: v1.pairs.map(pair => ({ ...pair, set: '01' })) };
    checkFiles(manifest, (_set, field) => v1GroupPath(field), () => 'Group image');
    return manifest;
  }
  if (version === 2) {
    const manifest = parseWith(v2Schema, raw) as FacePairsBundleManifest;
    checkSets(manifest);
    checkFiles(manifest, (set, field) => setImagePath(set.key, field), set => `Photo set ${set.key} image`);
    return manifest;
  }
  throw new Error('Unsupported face pair bundle manifest version.');
}
export function bundlePaths(manifest: FacePairsBundleManifest): string[] {
  return [
    ...manifest.sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => set[field] ? [set[field]!.path] : [])),
    ...manifest.pairs.flatMap(pair => [pair.now.cropPath, pair.then.cropPath]),
  ];
}

export function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
export function assertLibraryCapacity(adding: { pairs: number; sets: number }, current: { people: number; facePairs: number; photoSets: number }) {
  const exceeded: string[] = [];
  if (current.people + adding.pairs > MAX_PEOPLE) exceeded.push(`${MAX_PEOPLE} people`);
  if (current.facePairs + adding.pairs > MAX_FACE_PAIRS) exceeded.push(`${MAX_FACE_PAIRS} face pairs`);
  if (current.photoSets + adding.sets > MAX_PHOTO_SETS) exceeded.push(`${MAX_PHOTO_SETS} photo sets`);
  if (exceeded.length) throw new Error(`Cannot import ${adding.pairs} face pairs: this session would exceed its limit of ${exceeded.join(' and ')}.`);
}
export function maxFacePairNumber(numbers: readonly number[]): number {
  return numbers.reduce((max, number) => Math.max(max, number), 0);
}
export const normalizeName = (name: string) => name.trim().toLocaleLowerCase();
export function duplicateNames(existing: readonly Person[], manifest: FacePairsBundleManifest): string[] {
  const taken = new Set(existing.map(person => normalizeName(person.name)).filter(Boolean));
  return manifest.pairs.filter(pair => taken.has(normalizeName(pair.name))).map(pair => pair.name);
}
export function duplicateSummary(names: readonly string[]): string {
  if (names.length === 1) return `${names[0]} is already in your library.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are already in your library.`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are already in your library.`;
}
```
The deprecated `parseFacePairFiles` and `ImportedPairFiles` are removed; `grep -rn "parseFacePairFiles\|ImportedPairFiles\|assertFacePairImportCapacity" src activities tests` must print nothing afterwards.

- [ ] **Step 5: Run the manifest tests**

Run: `npx vitest run tests/unit/pairs.test.ts -t "manifest|limits|duplicate|JPEG"`
Expected: PASS for every manifest, limits and duplicate test (the transfer tests still fail until Step 8).

- [ ] **Step 6: Update the transfer tests for read/store and multi-set export**

In `tests/unit/pairs.test.ts`, inside `describe('face-pair bundle transfer', …)`:
- In `'exports group sources, previews, crops, and their manifest relationships'`, replace the expectations after `const payload = …` with:
```ts
    expect(Object.keys(payload.files).sort()).toEqual([
      'face-pairs.json', 'pairs/001-now.jpg', 'pairs/001-then.jpg',
      'sets/01/now', 'sets/01/now-preview', 'sets/01/then', 'sets/01/then-preview',
    ]);
    const manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(payload.files['face-pairs.json'])));
    expect(manifest.sets).toEqual([{
      key: '01', name: 'Engineering', kind: 'group',
      now: { path: 'sets/01/now', name: 'Today.png', width: 1000, height: 800, mime: 'image/png' },
      then: { path: 'sets/01/then', name: 'Childhood.webp', width: 1000, height: 800, mime: 'image/webp' },
      nowPreview: { path: 'sets/01/now-preview', name: 'Today preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      thenPreview: { path: 'sets/01/then-preview', name: 'Childhood preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
    }]);
    expect(manifest.pairs[0]).toMatchObject({
      number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: false,
      now: { cropPath: 'pairs/001-now.jpg', faceBox: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 } },
      then: { cropPath: 'pairs/001-then.jpg', faceBox: { x: 0.3, y: 0.1, width: 0.25, height: 0.35 } },
    });
    expect(JSON.stringify(manifest)).not.toMatch(/session-id|pair-id|person-id|set-id|sourceImageId|cropImageId/);
```
- Add a test after it:
```ts
  it('exports every set in order, skips unfinished sets and names unnamed people', async () => {
    const event = demoSession();
    event.assets['single-now'] = { id: 'single-now', name: 'Priya now.jpg', width: 600, height: 800, mime: 'image/jpeg' };
    event.assets['single-then'] = { id: 'single-then', name: 'Priya then.jpg', width: 500, height: 700, mime: 'image/jpeg' };
    event.photoSets.push(
      { id: 'empty-set', name: 'Unfinished', kind: 'group', previews: {}, order: 1 },
      { id: 'single-set', name: 'Priya', kind: 'single', nowImageId: 'single-now', thenImageId: 'single-then', previews: {}, order: 2 },
    );
    event.facePairs.push({ id: 'single-pair', number: 12, color: '#8fcbe0', setId: 'single-set', matchMethod: 'manual', reviewStatus: 'confirmed',
      now: { sourceImageId: 'single-now', cropImageId: 'now-crop', faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      then: { sourceImageId: 'single-then', cropImageId: 'then-crop', faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } } });
    event.people.push({ id: 'single-person', facePairId: 'single-pair', name: '  ', funFact: '', included: true });
    getImage.mockImplementation(async () => new Blob([new Uint8Array([1])]));
    archiveJob.mockResolvedValue(new Uint8Array([9]));
    const { exportFacePairs } = await import('../../src/core/transfer');

    await exportFacePairs(event);

    const payload = archiveJob.mock.calls[0][0] as { files: Record<string, Uint8Array> };
    const manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(payload.files['face-pairs.json'])));
    expect(manifest.sets.map(s => [s.key, s.name, s.kind])).toEqual([['01', 'Engineering', 'group'], ['02', 'Priya', 'single']]);
    expect(manifest.pairs.map(p => [p.number, p.set, p.name])).toEqual([[1, '01', 'Asha'], [2, '02', 'Person 2']]);
    expect(payload.files['sets/02/now']).toBeDefined();
  });
```
- In `'strictly imports a complete bundle with fresh linked records'`, change the call to:
```ts
    const imported = await importFacePairs(new File([new Uint8Array([1])], 'pairs.zip'), {
      startNumber: 5, startOrder: 0, current: { people: 10, facePairs: 10, photoSets: 0 },
    });
```
- In `'rejects file parity errors, old flat archives, and invalid JPEG crops before storage'`, change each options object to `{ startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 } }`.
- In `'checks replacement capacity and cleans up every stored image after a later failure'`, change the options to `{ startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 } }`.
- Add a test:
```ts
  it('skips named duplicates, drops a set left empty, and stores only what remains', async () => {
    const manifest = v2Manifest();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
    const files: Record<string, Uint8Array> = { 'face-pairs.json': new TextEncoder().encode(JSON.stringify(manifest)) };
    for (const path of ['sets/01/now', 'sets/01/then', 'sets/01/now-preview', 'sets/02/now', 'sets/02/then', 'pairs/001-now.jpg', 'pairs/001-then.jpg', 'pairs/002-now.jpg', 'pairs/002-then.jpg', 'pairs/003-now.jpg', 'pairs/003-then.jpg']) files[path] = jpeg;
    archiveJob.mockResolvedValue({ manifest: undefined, files });
    inspectImage.mockResolvedValue({ width: 4000, height: 3000, preview: new Blob() });
    let id = 0; putImage.mockImplementation(async () => `stored-${++id}`);
    const { readFacePairsBundle, storeFacePairsBundle } = await import('../../src/core/transfer');

    const bundle = await readFacePairsBundle(new File([new Uint8Array([1])], 'more.zip'));
    const imported = await storeFacePairsBundle(bundle, { startNumber: 40, startOrder: 3, current: { people: 0, facePairs: 0, photoSets: 3 }, skipNames: new Set(['priya']) });

    expect(imported.photoSets.map(s => [s.name, s.order])).toEqual([['Engineering', 3]]);
    expect(imported.facePairs.map(p => p.number)).toEqual([41, 42]);
    expect(imported.facePairs.every(p => p.setId === imported.photoSets[0].id)).toBe(true);
    expect(putImage).toHaveBeenCalledTimes(7);
    await expect(storeFacePairsBundle(bundle, { startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 }, skipNames: new Set(['asha', 'leo', 'priya']) })).rejects.toThrow(/already in your library/);
  });
```

- [ ] **Step 7: Run to see the transfer tests fail**

Run: `npx vitest run tests/unit/pairs.test.ts -t "transfer"`
Expected: FAIL — `readFacePairsBundle` / `storeFacePairsBundle` are not exported and the export still writes `groups/`.

- [ ] **Step 8: Rewrite the face-pair section of transfer.ts**

In `src/core/transfer.ts`:
- Replace the imports from `./people/pairs` and `./types` with:
```ts
import {
  assertLibraryCapacity,
  bundlePaths,
  bundleSetName,
  FACE_PAIR_BUNDLE_VERSION,
  hasJpegSignature,
  normalizeName,
  pairCropPath,
  parseFacePairsBundleManifest,
  SET_IMAGE_FIELDS,
  setImagePath,
  setKey,
  type FacePairBundleEntry,
  type FacePairBundleImage,
  type FacePairBundleSet,
  type FacePairsBundleManifest,
} from './people/pairs';
import { orderedSets } from './people/photo-sets';
import type { Asset, EventSession, FacePair, Person, PhotoSet } from './types';
```
- Delete `FacePairImportOptions`, the old `importFacePairs`, the old `exportFacePairs` and the helpers `groupSpec`, `cropPath`, `optionalAsset`, `manifestGroup`. Keep `download`, `exportSession`, `importSession`, `remapEventImages`, `requireAsset` (typed `session: EventSession`) and `assetBytes`.
- Add after `remapEventImages`:
```ts
export interface BundleImage { blob: Blob; name: string; mime: string; width: number; height: number }
export interface FacePairsBundle { manifest: FacePairsBundleManifest; images: Map<string, BundleImage> }
export interface StoreBundleOptions {
  startNumber: number;
  startOrder: number;
  current: { people: number; facePairs: number; photoSets: number };
  skipNames?: ReadonlySet<string>;
}

// Validates the ZIP and decodes every image without storing anything, so the host can still cancel.
export async function readFacePairsBundle(file: File): Promise<FacePairsBundle> {
  const zipMime = !file.type || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!file.name.toLocaleLowerCase().endsWith('.zip') || !zipMime) throw new Error('Please choose a ZIP file containing exported face pairs.');
  if (file.size > 512 * 1024 * 1024) throw new Error('Please use a face pair ZIP smaller than 512 MB.');
  const { manifest: sessionManifest, files } = await archiveJob<{ manifest?: unknown; files: Record<string, Uint8Array> }>({ type: 'unzip', bytes: new Uint8Array(await file.arrayBuffer()), allowMissingManifest: true });
  if (sessionManifest !== undefined) throw new Error('This is a full session ZIP. Import it with Import session ZIP.');
  const manifestBytes = files['face-pairs.json'];
  if (!manifestBytes) throw new Error('The face pair ZIP is missing face-pairs.json.');
  let manifest: FacePairsBundleManifest;
  try { manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(manifestBytes)), bundleSetName(file.name)); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('face-pairs.json is not valid JSON.'); throw error; }
  const expected = new Set(['face-pairs.json', ...bundlePaths(manifest)]);
  const archivePaths = Object.keys(files).filter(path => !path.endsWith('/'));
  const missing = [...expected].filter(path => !files[path]), unknown = archivePaths.filter(path => !expected.has(path));
  if (missing.length || unknown.length) {
    const details = [missing.length ? `missing ${missing.join(', ')}` : '', unknown.length ? `unexpected ${unknown.join(', ')}` : ''].filter(Boolean).join('; ');
    throw new Error(`The face pair ZIP files do not exactly match face-pairs.json (${details}).`);
  }
  const specs: { path: string; name: string; mime: string; size?: { width: number; height: number }; crop: boolean }[] = [
    ...manifest.sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => { const image = set[field]; return image ? [{ path: image.path, name: image.name, mime: image.mime, size: { width: image.width, height: image.height }, crop: false }] : []; })),
    ...manifest.pairs.flatMap(pair => (['now', 'then'] as const).map(side => ({ path: pair[side].cropPath, name: `Face ${pair.number} - ${side}.jpg`, mime: 'image/jpeg', crop: true }))),
  ];
  for (const spec of specs) if (spec.crop && !hasJpegSignature(files[spec.path])) throw new Error(`${spec.path} is not a JPEG image.`);
  const images = new Map<string, BundleImage>();
  for (const spec of specs) {
    const blob = new Blob([files[spec.path] as BlobPart], { type: spec.mime });
    let width: number, height: number;
    try { ({ width, height } = await inspectImage(blob)); } catch { throw new Error(`Could not read ${spec.path} as an image.`); }
    if (spec.size && (width !== spec.size.width || height !== spec.size.height)) throw new Error(`${spec.path} dimensions do not match face-pairs.json.`);
    images.set(spec.path, { blob, name: spec.name, mime: spec.mime, width, height });
  }
  return { manifest, images };
}

export async function storeFacePairsBundle(bundle: FacePairsBundle, options: StoreBundleOptions): Promise<ImportedFacePairs> {
  const skip = options.skipNames ?? new Set<string>();
  const pairs = bundle.manifest.pairs.filter(pair => !skip.has(normalizeName(pair.name)));
  if (!pairs.length) throw new Error('Everyone in this file is already in your library.');
  const sets = bundle.manifest.sets.filter(set => pairs.some(pair => pair.set === set.key));
  assertLibraryCapacity({ pairs: pairs.length, sets: sets.length }, options.current);
  const paths = [...sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => set[field] ? [set[field]!.path] : [])), ...pairs.flatMap(pair => [pair.now.cropPath, pair.then.cropPath])];
  const assets: Record<string, Asset> = {}, byPath = new Map<string, Asset>(), stored: string[] = [];
  try {
    for (const path of paths) {
      const image = bundle.images.get(path)!;
      let id: string;
      try { id = await imageStore.put(image.blob, undefined, { durable: true }); } catch { throw new Error(`Could not store ${path}. Check browser storage and try again.`); }
      stored.push(id);
      const asset: Asset = { id, name: image.name, width: image.width, height: image.height, mime: image.mime };
      assets[id] = asset; byPath.set(path, asset);
    }
    const idOf = (path: string) => byPath.get(path)!.id;
    const photoSets: PhotoSet[] = sets.map((set, index) => {
      const nowImageId = idOf(set.now.path), thenImageId = idOf(set.then.path), previews: Record<string, string> = {};
      if (set.nowPreview) previews[nowImageId] = idOf(set.nowPreview.path);
      if (set.thenPreview) previews[thenImageId] = idOf(set.thenPreview.path);
      return { id: crypto.randomUUID(), name: set.name, kind: set.kind, nowImageId, thenImageId, previews, order: options.startOrder + index };
    });
    const byKey = new Map(sets.map((set, index) => [set.key, photoSets[index]]));
    const facePairs: FacePair[] = pairs.map((pair, index) => {
      const set = byKey.get(pair.set)!;
      return {
        id: crypto.randomUUID(), number: options.startNumber + index + 1, color: pair.color, setId: set.id,
        now: { sourceImageId: set.nowImageId!, cropImageId: idOf(pair.now.cropPath), faceBox: pair.now.faceBox, padding: pair.now.padding },
        then: { sourceImageId: set.thenImageId!, cropImageId: idOf(pair.then.cropPath), faceBox: pair.then.faceBox, padding: pair.then.padding },
        matchMethod: 'manual', reviewStatus: 'confirmed',
      };
    });
    const people: Person[] = pairs.map((pair, index) => ({ id: crypto.randomUUID(), name: pair.name, funFact: pair.funFact, included: pair.included, facePairId: facePairs[index].id }));
    return { assets, photoSets, facePairs, people };
  } catch (error) {
    await Promise.allSettled(stored.map(id => imageStore.delete(id)));
    throw error instanceof Error ? error : new Error('Could not import face pairs.');
  }
}

export async function importFacePairs(file: File, options: StoreBundleOptions): Promise<ImportedFacePairs> {
  return storeFacePairsBundle(await readFacePairsBundle(file), options);
}

// Exports every set with at least one finished person. Pair numbers restart at 1 in export order.
export async function exportFacePairs(event: EventSession) {
  const finished = (pair: FacePair) => Boolean(pair.now?.cropImageId && pair.then?.cropImageId && event.people.some(p => p.facePairId === pair.id));
  const sets = orderedSets(event).filter(set => set.nowImageId && set.thenImageId && event.facePairs.some(pair => pair.setId === set.id && finished(pair)));
  if (!sets.length) throw new Error('Finish matching at least one person before exporting face pairs.');
  const files: Record<string, Uint8Array> = {}, manifestSets: FacePairBundleSet[] = [], manifestPairs: FacePairBundleEntry[] = [];
  const addImage = async (id: string, path: string): Promise<FacePairBundleImage> => {
    const asset = requireAsset(event, id, 'photo');
    files[path] = await assetBytes(id);
    return { path, name: asset.name, width: asset.width, height: asset.height, mime: asset.mime };
  };
  for (const [index, set] of sets.entries()) {
    const key = setKey(index), nowPreview = set.previews[set.nowImageId!], thenPreview = set.previews[set.thenImageId!];
    const entry: FacePairBundleSet = { key, name: set.name, kind: set.kind, now: await addImage(set.nowImageId!, setImagePath(key, 'now')), then: await addImage(set.thenImageId!, setImagePath(key, 'then')) };
    if (nowPreview) entry.nowPreview = await addImage(nowPreview, setImagePath(key, 'nowPreview'));
    if (thenPreview) entry.thenPreview = await addImage(thenPreview, setImagePath(key, 'thenPreview'));
    manifestSets.push(entry);
    for (const pair of event.facePairs.filter(p => p.setId === set.id && finished(p)).sort((a, b) => a.number - b.number)) {
      const person = event.people.find(p => p.facePairId === pair.id)!, number = manifestPairs.length + 1;
      const side = (s: 'now' | 'then') => ({ cropPath: pairCropPath(number, s), faceBox: pair[s]!.faceBox, padding: pair[s]!.padding });
      manifestPairs.push({ number, set: key, color: pair.color, name: person.name.trim() || `Person ${number}`, funFact: person.funFact, included: person.included, now: side('now'), then: side('then') });
      files[pairCropPath(number, 'now')] = await assetBytes(pair.now!.cropImageId!);
      files[pairCropPath(number, 'then')] = await assetBytes(pair.then!.cropImageId!);
    }
  }
  const manifest = parseFacePairsBundleManifest({ version: FACE_PAIR_BUNDLE_VERSION, sets: manifestSets, pairs: manifestPairs });
  files['face-pairs.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  download(await archiveJob<Uint8Array>({ type: 'zip', files }), 'Childhood vs Now - face pairs.zip');
}
```
In `src/core/people/PeopleLibrary.tsx`, change the `importFacePairs(file, { … })` options to `{ startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 } }`.

- [ ] **Step 9: Verify**

Run:
```bash
npx vitest run tests/unit/pairs.test.ts
npx tsc -b && echo TSC_OK
npm test
```
Expected: all pass, `TSC_OK`.

- [ ] **Step 10: Commit**

```bash
git add src/core/people/pairs.ts src/core/transfer.ts src/core/people/PeopleLibrary.tsx tests/unit/pairs.test.ts
git commit -m "feat(people): export and import face-pair bundles with several photo sets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 3: Add to library

**Files:**
- Modify: `src/core/people/event-library.ts`
- Create: `src/core/people/ImportPairsMenu.tsx`
- Modify: `src/core/people/PeopleLibrary.tsx`, `src/app/App.tsx`, `src/theme/styles.css`
- Test: `tests/unit/event-library.test.ts`

**Interfaces:**
- Consumes: `readFacePairsBundle`, `storeFacePairsBundle`, `importFacePairs`, `FacePairsBundle` (Task 2); `duplicateNames`, `duplicateSummary`, `normalizeName`, `maxFacePairNumber` (Task 2).
- Produces (`event-library.ts`): `libraryLocked(event: EventSession): boolean`; `resetEventProgress(event: EventSession)`; `leaveDemo(event: EventSession)`; `replaceEventPeople(event, imported)`; `addEventPeople(event, imported)`.
- Produces: `ImportPairsMenu({ session, update, notify, runTask, locked })`; `PeopleLibrary` gains a `locked: boolean` prop.

- [ ] **Step 1: Write the failing library tests**

Append to `tests/unit/event-library.test.ts` (and add `addEventPeople, leaveDemo, libraryLocked` to the `event-library` import):
```ts
describe('adding to the people library', () => {
  const extra = (): ImportedFacePairs => {
    const source = imported();
    const set = { ...source.photoSets[0], id: 'set-2', name: 'Design', order: 1 };
    const pair = { ...source.facePairs[0], id: 'pair-2', number: 2, setId: 'set-2' };
    return { assets: {}, photoSets: [set], facePairs: [pair], people: [{ ...source.people[0], id: 'person-2', facePairId: 'pair-2', name: 'Priya' }] };
  };
  it('appends sets, pairs and people and keeps progress on an unlocked event', () => {
    const event = validateEvent(fixture); event.segments[0].status = 'setup';
    const scores = structuredClone(event.scoreEntries);
    addEventPeople(event, extra());
    expect(event.photoSets.map(s => s.name)).toEqual(['Group 1', 'Design']);
    expect(event.people.map(p => p.name)).toEqual(['Asha', 'Priya']);
    expect(event.scoreEntries).toEqual(scores);
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('refuses to add once an activity has started', () => {
    const event = validateEvent(fixture);
    expect(libraryLocked(event)).toBe(true);
    expect(() => addEventPeople(event, extra())).toThrow(/locked/);
  });
  it('never locks the demo, and leaving the demo resets progress but keeps the people', () => {
    const event = validateEvent(fixture); event.isDemo = true;
    expect(libraryLocked(event)).toBe(false);
    leaveDemo(event);
    expect(event.isDemo).toBe(false);
    expect(event.scoreEntries).toEqual([]);
    expect(event.segments[0].status).toBe('setup');
    expect(event.people).toHaveLength(1);
    expect(libraryLocked(event)).toBe(false);
  });
});
```
The fixture's single segment is `play`, so it is locked unless it is a demo.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/event-library.test.ts`
Expected: FAIL — `addEventPeople`, `leaveDemo`, `libraryLocked` are not exported.

- [ ] **Step 3: Implement the library operations**

In `src/core/people/event-library.ts`, replace `replaceEventPeople` with:
```ts
const STARTED: EventSession['segments'][number]['status'][] = ['play', 'finale', 'done'];
// Once any activity has run, people are shared history. The demo is throwaway, so it never locks.
export const libraryLocked = (event: EventSession) => !event.isDemo && event.segments.some(segment => STARTED.includes(segment.status));

// Clears scores, bets and every activity's game, keeping the line-up, settings, teams and people.
export function resetEventProgress(event: EventSession) {
  event.scoreEntries = []; event.isDemo = false;
  if (event.wager) event.wager.bets = {};
  event.currentSegmentIndex = 0;
  event.phase = event.phase === 'lineup' || !event.segments.length ? 'lineup' : 'segment';
  event.segments.forEach((segment, index) => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`Activity not installed: ${segment.activityId}`);
    segment.game = activity.createInitialState();
    segment.status = index === 0 && event.phase === 'segment' ? 'setup' : 'pending';
    segment.setupStepId = activity.setupSteps[0].id;
    prepareSegmentPeople(event, index);
  });
}
export function leaveDemo(event: EventSession) { if (event.isDemo) resetEventProgress(event); }

// Replacing shared identities invalidates every activity, including completed ones.
export function replaceEventPeople(event: EventSession, imported: ImportedFacePairs) {
  event.assets = imported.assets; event.photoSets = imported.photoSets; event.facePairs = imported.facePairs; event.people = imported.people;
  resetEventProgress(event);
}
export function addEventPeople(event: EventSession, imported: ImportedFacePairs) {
  if (libraryLocked(event)) throw new Error('The roster is locked after an activity starts. Replace the library to start over.');
  leaveDemo(event);
  Object.assign(event.assets, imported.assets);
  event.photoSets.push(...imported.photoSets); event.facePairs.push(...imported.facePairs); event.people.push(...imported.people);
}
```

- [ ] **Step 4: Run the library tests**

Run: `npx vitest run tests/unit/event-library.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the import menu**

Create `src/core/people/ImportPairsMenu.tsx`:
```tsx
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
  const picker = (ref: React.RefObject<HTMLInputElement>, label: string, onFile: (file: File) => void) => <input ref={ref} type="file" accept=".zip,application/zip" className="visually-hidden" aria-label={label} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file); }}/>;
  return <div className="import-menu"><button className="button secondary" aria-expanded={open} onClick={() => setOpen(o => !o)}><Upload size={16}/> Import pairs <ChevronDown size={14}/></button>
    {open && <div className="import-menu-list" role="menu"><button role="menuitem" disabled={locked} onClick={() => { setOpen(false); addInput.current?.click(); }}><b>Add to library</b><small>{locked ? 'Locked after an activity starts.' : session.isDemo ? 'Your demo people will stay — choose Replace library to remove them.' : 'Keeps everyone already here.'}</small></button><button role="menuitem" onClick={() => { setOpen(false); replaceInput.current?.click(); }}><b>Replace library</b><small>Clears everyone and resets game progress.</small></button></div>}
    {picker(addInput, 'Add face pairs ZIP', add)}{picker(replaceInput, 'Import face pairs ZIP', replace)}
    {pending && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="duplicates-title"><span className="eyebrow">ALREADY HERE</span><h2 id="duplicates-title">Some names match</h2><p>{duplicateSummary(pending.names)}</p><div className="button-row"><button className="button primary" onClick={() => resolve(false)}>Add anyway</button><button className="button secondary" onClick={() => resolve(true)}>Skip duplicates</button><button className="button subtle" onClick={() => setPending(undefined)}>Cancel</button></div></section></div>}
  </div>;
}
```
`runTask` ignores a second task while one runs, so the no-duplicates path stores inside the reading task instead of starting a new one.

- [ ] **Step 6: Use the menu in the library**

In `src/core/people/PeopleLibrary.tsx`:
- Replace the imports of `useRef`, `Upload`, `exportFacePairs, importFacePairs` and `replaceEventPeople` with:
```tsx
import { Users, Download, ArrowRight } from 'lucide-react';
import { exportFacePairs } from '../transfer';
import { ImportPairsMenu } from './ImportPairsMenu';
```
- Add `locked: boolean` to `PeopleLibraryProps` and to the destructured props.
- Delete `const importInput = useRef<HTMLInputElement>(null);`.
- In the toolbar, replace the `Import pairs` button and the whole `<input ref={importInput} … />` element with `<ImportPairsMenu session={session} update={update} notify={notify} runTask={runTask} locked={locked}/>`.

In `src/app/App.tsx`, add `libraryLocked` to the `../core/people/event-library` import and pass `locked={libraryLocked(session)}` to `<PeopleLibrary …/>`.

Append to `src/theme/styles.css`:
```css
.import-menu { position: relative; } .import-menu-list { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; width: 290px; display: grid; background: var(--panel, #0d3327); border: 1px solid var(--line); border-radius: 9px; overflow: hidden; box-shadow: 0 14px 40px #0006; } .import-menu-list button { display: grid; gap: 3px; text-align: left; padding: 12px 15px; background: none; border: 0; color: inherit; cursor: pointer; } .import-menu-list button + button { border-top: 1px solid var(--line); } .import-menu-list button:hover:not(:disabled) { background: #ffffff0a; } .import-menu-list button:disabled { opacity: .5; cursor: not-allowed; } .import-menu-list small { color: var(--muted); font-size: 12px; }
```

- [ ] **Step 7: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && npx playwright test --reporter=line -g "replaces the library|three activities"
```
Expected: `TSC_OK`, unit tests pass, both browser tests pass (they still drive the Replace path through the `Import face pairs ZIP` input).

- [ ] **Step 8: Commit**

```bash
git add src/core/people src/app/App.tsx src/theme/styles.css tests/unit/event-library.test.ts
git commit -m "feat(people): add face pairs to the library without replacing it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 4: Set-scoped editor screens and the Childhood vs Now People step

The upload, matching and naming screens move to `src/core/people/editor/`, take a `setId`, and are composed by `GroupWizard`. Childhood vs Now's setup becomes **People → Game setup**.

**Files:**
- Modify: `src/core/people/photo-sets.ts`, `src/core/types.ts`
- Create: `src/core/people/editor/context.ts`, `src/core/people/editor/SetUpload.tsx`, `src/core/people/editor/SetMatch.tsx`, `src/core/people/editor/SetNames.tsx`, `src/core/people/editor/GroupWizard.tsx`
- Create: `activities/childhood-vs-now/setup/PeopleStep.tsx`
- Delete: `activities/childhood-vs-now/setup/UploadStep.tsx`, `activities/childhood-vs-now/setup/MatchPeopleStep.tsx`, `activities/childhood-vs-now/setup/NamePeopleStep.tsx`
- Modify: `activities/childhood-vs-now/activity.ts`, `activities/childhood-vs-now/logic/preparation.ts`, `src/app/App.tsx`, `src/theme/styles.css`
- Test: `tests/unit/photo-sets.test.ts`, `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `LibraryDraft`, `storePhoto`, `alignThen`, `makePairs`, `syncPeople`, `prepareCrops` (Task 1); `pairsInSet`, `peopleInSet`, `defaultIncluded`, `nextPairNumber`, `allPreviews`, `createPhotoSet`, `primaryGroupSet`, `orderedSets` (Task 1).
- Produces (`photo-sets.ts`): `clearSetPairs(lib: { photoSets; facePairs; people; assets }, setId): string[]` (removed crop image ids); `playerIssues(lib): string[]`.
- Produces (`editor/context.ts`): `LibraryEvent = Pick<ActivityEvent, 'people' | 'facePairs' | 'photoSets' | 'assets' | 'isDemo'>`; `LibraryContext { event: LibraryEvent; updateEvent: (change: (draft: EventUpdate) => void) => void; runTask; notify }`; `libraryDraft(event: LibraryEvent): LibraryDraft`.
- Produces (components): `SetUpload({ ctx, setId, footer })`, `SetMatch({ ctx, setId, onBack, onNext, nextLabel })`, `SetNames({ ctx, setId, onBack, onDone, doneLabel })`, `GroupWizard({ ctx, setId?, doneLabel, onDone, onCancel? })`.
- Produces (types): `ActivityContext.openPeople?: () => void`.

- [ ] **Step 1: Write the failing helper tests**

Append to `tests/unit/photo-sets.test.ts` (add `clearSetPairs, playerIssues` to the import):
```ts
describe('set clean-up and player checks', () => {
  it('clears one set’s pairs, people and crop assets, leaving other sets alone', () => {
    const lib = { ...library(), assets: {} as Record<string, any> };
    const crop = (id: string) => ({ sourceImageId: 'src', faceBox: { x: 0, y: 0, width: .1, height: .1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 }, cropImageId: id });
    lib.facePairs.push({ ...pair('a', 's1', 1), now: crop('crop-a') }, pair('b', 's2', 2));
    lib.people.push(person('pa', 'a'), person('pb', 'b'));
    lib.assets['crop-a'] = { id: 'crop-a' };
    expect(clearSetPairs(lib, 's1')).toEqual(['crop-a']);
    expect(lib.facePairs.map(p => p.id)).toEqual(['b']);
    expect(lib.people.map(p => p.id)).toEqual(['pb']);
    expect(lib.assets).toEqual({});
  });
  it('needs at least one player and a name for every player', () => {
    const lib = library();
    expect(playerIssues(lib)).toHaveLength(1);
    lib.people.push({ ...person('p', 'a'), name: ' ' });
    expect(playerIssues(lib)).toHaveLength(1);
    lib.people[0].name = 'Asha';
    expect(playerIssues(lib)).toEqual([]);
    lib.people.push({ ...person('q', 'b'), name: '', included: false });
    expect(playerIssues(lib)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: FAIL — `clearSetPairs` and `playerIssues` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/core/people/photo-sets.ts` (and change its first line to `import type { Asset, FacePair, Person, PhotoSet } from '../types';`):
```ts
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
export function playerIssues(library: { readonly people: readonly Person[] }): string[] {
  const players = library.people.filter(person => person.included);
  return players.length && players.every(person => person.name.trim()) ? [] : ['Include and name the people who will appear in the game.'];
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the editor context**

Create `src/core/people/editor/context.ts`:
```ts
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
```

- [ ] **Step 6: Create SetUpload**

Create `src/core/people/editor/SetUpload.tsx`:
```tsx
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DropZone } from '../../../components/DropZone';
import { clearSetPairs } from '../photo-sets';
import { alignThen, storePhoto } from '../photos';
import { libraryDraft, type LibraryContext } from './context';
export function SetUpload({ ctx, setId, footer }: { ctx: LibraryContext; setId: string; footer: ReactNode }) {
  const { event, updateEvent, runTask, notify } = ctx, set = event.photoSets.find(s => s.id === setId);
  const upload = (side: 'now' | 'then', file: File) => runTask('Opening your photo…', async () => {
    if (event.facePairs.some(p => p.setId === setId) && !event.isDemo && !window.confirm('Replacing a photo clears this group’s face matches and people. Continue?')) return;
    const stored = await storePhoto(file, file.name);
    let next = libraryDraft(event);
    const target = next.photoSets.find(s => s.id === setId)!, wasDemo = next.isDemo;
    // Your own photo replaces the whole demo group, as the demo banner promises.
    if (wasDemo) { target.nowImageId = undefined; target.thenImageId = undefined; target.previews = {}; target.name = 'Group 1'; next.isDemo = false; }
    clearSetPairs(next, setId);
    const previous = side === 'now' ? target.nowImageId : target.thenImageId;
    if (previous) delete target.previews[previous];
    next.assets[stored.asset.id] = stored.asset; next.assets[stored.preview.id] = stored.preview;
    target.previews[stored.asset.id] = stored.preview.id;
    if (side === 'now') target.nowImageId = stored.asset.id; else target.thenImageId = stored.asset.id;
    next = await alignThen(next, setId);
    updateEvent(e => { Object.assign(e, next); if (wasDemo) e.scoreEntries = []; });
    notify('Photo saved on this laptop.');
  });
  const nowId = set?.nowImageId, thenId = set?.thenImageId;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE TEAM PHOTOS</span><h1>Let’s turn back the clock<span className="accent">.</span></h1><p>{set ? `${set.name}: same people, same places, a few decades apart.` : 'Same people. Same places. A few decades apart.'}</p></div>
    <div className="upload-grid"><DropZone label="THE GROWN-UPS" title="Original group photo (now)" subtitle="Your team, just as they are today." imageId={nowId && (set!.previews[nowId] || nowId)} onFile={f => void upload('now', f)}/><DropZone label="THE LITTLE ONES" title="Childhood group photo (then)" subtitle="The same photo, already edited into 5–6 year olds." imageId={thenId && (set!.previews[thenId] || thenId)} onFile={f => void upload('then', f)}/></div>
    <div className="info-strip"><ShieldCheck size={20}/><span>Your photos stay on this laptop. Full resolution is preserved; different image sizes are aligned automatically.</span></div>
    {footer}
  </div>;
}
```

- [ ] **Step 7: Create SetMatch**

Create `src/core/people/editor/SetMatch.tsx` (the old `MatchPeopleStep`, scoped to one set; a single-photo set only offers crop adjustment):
```tsx
import { useState } from 'react';
import { ArrowRight, ScanFace, MousePointer2, Link, SquarePlus, Layers, Columns2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { PhotoEditor, type EditorMode } from '../../../components/PhotoEditor';
import { detectFaces } from '../../images/client';
import { imageStore } from '../../storage';
import { clampRect, defaultPadding } from '../../images/math';
import { teamColors } from '../../event';
import type { Rect } from '../../types';
import { intersectionOverUnion } from '../pairing';
import { defaultIncluded, nextPairNumber } from '../photo-sets';
import { makePairs, prepareCrops, syncPeople } from '../photos';
import { libraryDraft, type LibraryContext } from './context';
type Props = { ctx: LibraryContext; setId: string; onBack: () => void; onNext: () => void; nextLabel: string };
export function SetMatch({ ctx, setId, onBack, onNext, nextLabel }: Props) {
  const { event, updateEvent, runTask, notify } = ctx;
  const [mode, setMode] = useState<EditorMode>('select'), [overlay, setOverlay] = useState(false), [opacity, setOpacity] = useState(.5), [tolerance, setTolerance] = useState(.12);
  const [selected, setSelected] = useState<string>(), [side, setSide] = useState<'now' | 'then'>('now');
  const [pending, setPending] = useState<{ id: string; side: 'now' | 'then' }>();
  const [progress, setProgress] = useState('');
  const set = event.photoSets.find(s => s.id === setId), single = set?.kind === 'single';
  const nowId = set?.nowImageId ?? '', thenId = set?.thenImageId ?? '', now = event.assets[nowId], then = event.assets[thenId];
  if (!set || !now || !then) return <div className="empty-state"><h2>Two photos, one time machine.</h2><p>Upload both photos first.</p><button className="button primary" onClick={onBack}>Upload photos</button></div>;
  const pairs = event.facePairs.filter(p => p.setId === setId);
  const pair = pairs.find(p => p.id === selected), face = pair?.[side];
  const unmatched = pairs.filter(p => !p.now || !p.then).length;
  const select = (id: string, clickedSide: 'now' | 'then') => {
    setSelected(id); setSide(clickedSide);
    if (mode !== 'pair') return;
    if (!pending || pending.side === clickedSide) { setPending({ id, side: clickedSide }); return; }
    updateEvent(s => {
      const previouslyComplete = new Set(s.facePairs.filter(p => p.now && p.then).map(p => p.id));
      const nowPair = s.facePairs.find(p => p.id === (clickedSide === 'now' ? id : pending.id))!;
      const thenPair = s.facePairs.find(p => p.id === (clickedSide === 'then' ? id : pending.id))!;
      if (nowPair.id !== thenPair.id) [nowPair.then, thenPair.then] = [thenPair.then, nowPair.then];
      for (const p of [nowPair, thenPair]) { p.matchMethod = 'manual'; p.reviewStatus = p.now && p.then ? 'confirmed' : 'unmatched'; }
      s.facePairs = s.facePairs.filter(p => p.now || p.then); syncPeople(s);
      for (const person of s.people) { const p = s.facePairs.find(p => p.id === person.facePairId)!; if (p.now && p.then && !previouslyComplete.has(p.id)) person.included = defaultIncluded(s); }
    }); setPending(undefined); notify('Pair connected.');
  };
  const change = (id: string, imageSide: 'now' | 'then', rect: Rect) => updateEvent(s => {
    const p = s.facePairs.find(p => p.id === id)!; const f = p[imageSide]!;
    f.faceBox = clampRect(rect); f.cropImageId = undefined; p.matchMethod = 'manual';
  });
  const add = (imageSide: 'now' | 'then', rect: Rect) => {
    const id = crypto.randomUUID(), number = nextPairNumber(event.facePairs);
    updateEvent(s => { s.facePairs.push({ id, number, color: teamColors[(number - 1) % teamColors.length], setId, [imageSide]: { sourceImageId: imageSide === 'now' ? nowId : thenId, faceBox: rect, padding: { ...defaultPadding } }, matchMethod: 'manual', reviewStatus: 'unmatched' }); syncPeople(s); });
    setSelected(id); setSide(imageSide); setMode('pair'); setPending({ id, side: imageSide });
  };
  const detect = () => runTask('Finding the faces in your team…', async () => {
    try {
      setProgress('Loading the local face detector…');
      const nowFaces = await detectFaces(await imageStore.get(nowId), setProgress);
      const thenFaces = await detectFaces(await imageStore.get(thenId), setProgress);
      const locked = pairs.filter(p => p.matchMethod === 'manual' || p.reviewStatus === 'confirmed'), others = event.facePairs.filter(p => p.setId !== setId);
      const newNow = nowFaces.filter(r => !locked.some(p => p.now && intersectionOverUnion(p.now.faceBox, r) > .2));
      const newThen = thenFaces.filter(r => !locked.some(p => p.then && intersectionOverUnion(p.then.faceBox, r) > .2));
      const added = makePairs(newNow, newThen, set, tolerance, nextPairNumber([...others, ...locked]));
      updateEvent(s => { s.facePairs = [...others, ...locked, ...added]; syncPeople(s); });
      notify(added.length ? `Found ${nowFaces.length} current and ${thenFaces.length} childhood faces. Review the suggested matches.` : 'No new faces found. Use “Add face” to draw any missed faces.');
    } finally { setProgress(''); }
  });
  const aspect = (imageSide: 'now' | 'then') => imageSide === 'now' ? now.width / now.height : then.width / then.height;
  const editor = (imageSide: 'now' | 'then', isOverlay = false) => <PhotoEditor imageId={set.previews[isOverlay || imageSide === 'now' ? nowId : thenId] || (imageSide === 'now' ? nowId : thenId)} overlayId={isOverlay ? set.previews[thenId] || thenId : undefined} overlayOpacity={opacity} aspect={isOverlay ? aspect('now') : aspect(imageSide)} pairs={pairs} side={imageSide} mode={mode} selected={selected} onSelect={select} onChange={(id, rect) => change(id, imageSide, rect)} onAdd={rect => add(imageSide, rect)}/>;
  return <div className="setup-content wide"><div className="section-heading"><span className="eyebrow">02 / CONNECT THE DOTS</span><h1>{single ? 'Frame the face' : 'Same smile, different year'}<span className="accent">.</span></h1><p>{single ? 'Drag each box so it sits snugly around the face.' : 'Find the faces. Check the pairs. Make everyone part of the story.'}</p></div>
    {!single && <div className="match-toolbar"><button className="button primary" onClick={() => void detect()}><ScanFace size={18}/> Detect faces</button><div className="segmented">{([{ value: 'select', label: 'Adjust', Icon: MousePointer2 }, { value: 'add', label: 'Add face', Icon: SquarePlus }, { value: 'pair', label: 'Pair faces', Icon: Link }] as const).map(({ value, label, Icon }) => <button key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setPending(undefined); }}><Icon size={16}/>{label}</button>)}</div><div className="segmented"><button aria-pressed={!overlay} onClick={() => setOverlay(false)}><Columns2 size={17}/> Side by side</button><button aria-pressed={overlay} onClick={() => setOverlay(true)}><Layers size={17}/> Overlay</button></div></div>}
    <p className="instruction">{progress || (mode === 'add' ? 'Draw a box around a face. Then click its partner in the other photo.' : mode === 'pair' ? pending ? `Now click the matching face in the ${pending.side === 'now' ? 'childhood' : 'original'} photo.` : 'Click one face in each photo to connect them. Existing partners are swapped.' : 'Click a face to select it. Drag its box to move; drag the bottom-right handle to resize.')}</p>
    {overlay && !single ? <div className="overlay-editor"><div className="overlay-controls"><label>Childhood opacity <input aria-label="Childhood overlay opacity" type="range" min="0" max="1" step=".05" value={opacity} onChange={e => setOpacity(+e.target.value)}/></label><div className="segmented"><button aria-pressed={side === 'now'} onClick={() => setSide('now')}>Edit now</button><button aria-pressed={side === 'then'} onClick={() => setSide('then')}>Edit then</button></div></div>{editor(side, true)}</div> : <div className="photo-pair-grid"><div><div className="photo-label"><span>THE GROWN-UPS</span><b>Now</b></div>{editor('now')}</div><div><div className="photo-label"><span>THE LITTLE ONES</span><b>Then</b></div>{editor('then')}</div></div>}
    {!single && <div className="match-details"><div className="match-summary"><strong>{pairs.filter(p => p.now && p.then).length} pairs</strong><span className={unmatched ? 'warning-text' : 'mint-text'}>{unmatched ? <><AlertTriangle size={16}/> {unmatched} unmatched — pair or remove these faces</> : <><Check size={16}/> All faces paired</>}</span></div><label className="tolerance">Match tolerance <input aria-label="Match tolerance" type="range" min=".02" max=".25" step=".01" value={tolerance} onChange={e => setTolerance(+e.target.value)}/><span>{Math.round(tolerance * 100)}%</span></label></div>}
    {face && pair && <div className="crop-controls"><strong>Face {pair.number} · {side}</strong>{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{key}<input aria-label={`Crop ${key}`} type="number" step=".1" min="0" max="100" value={+(face.faceBox[key] * 100).toFixed(1)} onChange={e => change(pair.id, side, { ...face.faceBox, [key]: +e.target.value / 100 })}/></label>)}{!single && <><button className="button subtle" onClick={() => updateEvent(s => { const p = s.facePairs.find(p => p.id === pair.id)!; if (p.now && p.then) p.reviewStatus = 'confirmed'; })} disabled={!pair.now || !pair.then}><Check size={16}/> Confirm pair</button><button className="button danger subtle" onClick={() => { updateEvent(s => { const p = s.facePairs.find(p => p.id === pair.id)!; delete p[side]; p.reviewStatus = 'unmatched'; s.facePairs = s.facePairs.filter(f => f.now || f.then); syncPeople(s); }); setSelected(undefined); }}><Trash2 size={16}/> Delete this face</button></>}</div>}
    <div className="setup-footer"><button className="button subtle" onClick={onBack}>{single ? 'Back' : 'Back to photos'}</button><button className="button primary" disabled={!pairs.some(p => p.now && p.then)} onClick={() => void runTask('Preparing your face pairs…', async () => { const next = await prepareCrops(libraryDraft(event)); updateEvent(s => Object.assign(s, next)); onNext(); })}>{nextLabel} <ArrowRight size={18}/></button></div>
  </div>;
}
```
The match tolerance is local to the screen now; the unused `matchingTolerance` setting stays in Childhood vs Now's settings schema so saved sessions keep validating.

- [ ] **Step 8: Create SetNames**

Create `src/core/people/editor/SetNames.tsx` (the old `NamePeopleStep`, scoped to one set):
```tsx
import { useRef, useState } from 'react';
import { ArrowRight, Download, FileUp, Trash2, X } from 'lucide-react';
import { CropPreview } from '../../../components/Images';
import { PhotoEditor } from '../../../components/PhotoEditor';
import { parseNames } from '../csv';
import { allPreviews, peopleInSet } from '../photo-sets';
import { prepareCrops } from '../photos';
import { libraryDraft, type LibraryContext } from './context';
type Props = { ctx: LibraryContext; setId: string; onBack: () => void; onDone: () => void; doneLabel: string };
export function SetNames({ ctx, setId, onBack, onDone, doneLabel }: Props) {
  const { event, updateEvent, runTask, notify } = ctx, people = peopleInSet(event, setId);
  const [selected, setSelected] = useState(people[0]?.facePairId), [csv, setCsv] = useState<ReturnType<typeof parseNames>>();
  const input = useRef<HTMLInputElement>(null);
  const pairOf = (id: string) => event.facePairs.find(p => p.id === id);
  const sorted = [...people].sort((a, b) => { const x = pairOf(a.facePairId)?.now?.faceBox, y = pairOf(b.facePairId)?.now?.faceBox; return (x ? x.x + x.width / 2 : 2) - (y ? y.x + y.width / 2 : 2) || (x?.y ?? 0) - (y?.y ?? 0); });
  const set = event.photoSets.find(s => s.id === setId), nowId = set?.nowImageId ?? '', thenId = set?.thenImageId ?? '', now = event.assets[nowId], previews = allPreviews(event);
  const setPairs = event.facePairs.filter(p => p.setId === setId);
  const missing = people.filter(p => p.included && !p.name.trim()).length;
  const prepare = async () => { const next = await prepareCrops(libraryDraft(event)); updateEvent(e => Object.assign(e, next)); };
  return <div className="setup-content wide"><div className="section-heading"><span className="eyebrow">03 / TAKE ATTENDANCE</span><h1>Put a name to that face<span className="accent">.</span></h1><p>A familiar face deserves a proper introduction. Fun facts appear only after the reveal.</p></div>
    <div className="names-toolbar"><span>{people.filter(p => p.included).length} of {people.length} in the game {missing > 0 && <span className="warning-text">· {missing} need a name</span>}</span><div className="button-row"><input type="file" accept=".csv,text/csv" ref={input} className="visually-hidden" aria-label="Import names CSV" onChange={e => { const file = e.target.files?.[0]; if (file) void file.text().then(text => { try { const parsed = parseNames(text); if (!parsed.length) throw new Error('The CSV has no names.'); setCsv(parsed); } catch (error) { notify((error as Error).message); } }); e.target.value = ''; }}/><button className="button secondary" onClick={() => input.current?.click()}><FileUp size={16}/> Import names</button><button className="button secondary" onClick={() => void runTask('Packing your face pairs…', async () => { await prepare(); notify('Face pairs prepared.'); })}><Download size={16}/> Prepare face pairs</button></div></div>
    {now && set?.kind === 'group' && <details className="group-reference" open><summary>Find a person in the group photos</summary><div className="photo-pair-grid">{(['now', 'then'] as const).map(side => <div key={side}><span className="eyebrow">{side}</span><PhotoEditor imageId={set.previews[side === 'now' ? nowId : thenId] || (side === 'now' ? nowId : thenId)} aspect={now.width / now.height} pairs={setPairs} side={side} selected={selected} mode="pair" onSelect={setSelected} onChange={() => {}} onAdd={() => {}}/></div>)}</div></details>}
    <div className="people-table"><div className="people-table-heading"><span>THEN / NOW</span><span>NAME & AFTER-REVEAL FUN FACT</span><span>CROP PADDING</span><span>IN GAME</span></div>{sorted.map(person => { const pair = pairOf(person.facePairId)!; const padding = pair.then?.padding.top ?? .4; return <div className={`person-row ${selected === pair.id ? 'selected' : ''}`} key={person.id}><div className="person-crops" onClick={() => setSelected(pair.id)}><span className="person-number">{pair.number}</span><CropPreview face={pair.then} assets={event.assets} previews={previews} label={`Childhood face ${pair.number}`}/><CropPreview face={pair.now} assets={event.assets} previews={previews} label={`Current face ${pair.number}`}/></div><div className="person-fields"><input aria-label={`Name for person ${pair.number}`} placeholder="Who’s this?" maxLength={80} value={person.name} onFocus={() => setSelected(pair.id)} onChange={e => updateEvent(s => { s.people.find(p => p.id === person.id)!.name = e.target.value; })}/><input aria-label={`Fun fact for person ${pair.number}`} placeholder="A little fun fact (optional)" maxLength={240} value={person.funFact} onFocus={() => setSelected(pair.id)} onChange={e => updateEvent(s => { s.people.find(p => p.id === person.id)!.funFact = e.target.value; })}/>{(!pair.now || !pair.then) && <small className="warning-text">Missing a face — finish matching before including.</small>}</div><label className="padding-slider"><span>Hair & shoulders</span><input aria-label={`Crop padding for person ${pair.number}`} type="range" min="0" max="1" step=".05" value={padding} onChange={e => updateEvent(s => { const p = s.facePairs.find(p => p.id === pair.id)!; const v = +e.target.value; for (const f of [p.now, p.then]) if (f) { f.padding = { top: v, left: v * .8, right: v * .8, bottom: v * 1.75 }; f.cropImageId = undefined; } })}/></label><div className="person-actions"><input type="checkbox" className="switch" aria-label={`Include person ${pair.number}`} checked={person.included} disabled={!pair.now || !pair.then} onChange={e => updateEvent(s => { s.people.find(p => p.id === person.id)!.included = e.target.checked; })}/><button className="icon-button danger" aria-label={`Delete person ${pair.number}`} onClick={() => updateEvent(s => { s.people = s.people.filter(p => p.id !== person.id); s.facePairs = s.facePairs.filter(p => p.id !== pair.id); })}><Trash2 size={17}/></button></div></div>; })}</div>
    <div className="setup-footer"><button className="button subtle" onClick={onBack}>Back to matching</button><button className="button primary" disabled={missing > 0} onClick={() => void runTask('Saving the final crops…', async () => { await prepare(); onDone(); })}>{doneLabel} <ArrowRight size={18}/></button></div>
    {csv && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="csv-title"><button className="modal-close icon-button" aria-label="Close CSV preview" onClick={() => setCsv(undefined)}><X/></button><span className="eyebrow">CHECK THE ROSTER</span><h2 id="csv-title">Import names</h2><p>Names map to current faces from left to right. For multiple rows, check the numbered preview carefully.</p><div className="csv-preview">{csv.map((row, i) => <div key={i}><span>Face {pairOf(sorted[i]?.facePairId ?? '')?.number ?? '—'}</span><strong>{row.name || '(empty name)'}</strong></div>)}</div>{csv.length !== sorted.length && <p className="warning-text">{csv.length} names for {sorted.length} people. Update the CSV so the counts match.</p>}<button className="button primary" disabled={csv.length !== sorted.length || csv.some(n => !n.name)} onClick={() => { updateEvent(s => csv.forEach((row, i) => { const person = s.people.find(p => p.id === sorted[i].id)!; person.name = row.name; person.funFact = row.funFact; })); setCsv(undefined); notify('Class register updated.'); }}>Apply names</button></section></div>}
  </div>;
}
```
Unlike the old step, finishing no longer requires someone in *this* set to be included — a partial group may have nobody switched on yet. The Childhood vs Now People step checks the whole library instead.

- [ ] **Step 9: Create GroupWizard**

Create `src/core/people/editor/GroupWizard.tsx`:
```tsx
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createPhotoSet } from '../photo-sets';
import type { LibraryContext } from './context';
import { SetMatch } from './SetMatch';
import { SetNames } from './SetNames';
import { SetUpload } from './SetUpload';
type Props = { ctx: LibraryContext; setId?: string; doneLabel: string; onDone: () => void; onCancel?: () => void };
// Name → photos → matches → names. A set only exists once it is named, so every later screen can
// rely on it being in the event.
export function GroupWizard({ ctx, setId: initial, doneLabel, onDone, onCancel }: Props) {
  const [setId, setSetId] = useState(initial), [step, setStep] = useState<'upload' | 'match' | 'names'>('upload');
  const [name, setName] = useState(() => `Group ${ctx.event.photoSets.filter(s => s.kind === 'group').length + 1}`);
  const set = ctx.event.photoSets.find(s => s.id === setId);
  const create = () => { let created = ''; ctx.updateEvent(e => { created = createPhotoSet(e, name, 'group').id; }); if (created) setSetId(created); };
  if (!set) return <div className="setup-content"><div className="section-heading"><span className="eyebrow">A NEW GROUP</span><h1>Name this group<span className="accent">.</span></h1><p>A team, a year or an offsite — something you will recognise later.</p></div><label className="group-name-field"><span className="eyebrow">GROUP NAME</span><input aria-label="Group name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label><div className="setup-footer">{onCancel ? <button className="button subtle" onClick={onCancel}>Cancel</button> : <span/>}<button className="button primary" disabled={!name.trim()} onClick={create}>Continue <ArrowRight size={18}/></button></div></div>;
  if (step === 'match') return <SetMatch ctx={ctx} setId={set.id} onBack={() => setStep('upload')} onNext={() => setStep('names')} nextLabel="Name people"/>;
  if (step === 'names') return <SetNames ctx={ctx} setId={set.id} onBack={() => setStep('match')} onDone={onDone} doneLabel={doneLabel}/>;
  return <SetUpload ctx={ctx} setId={set.id} footer={<div className="setup-footer">{onCancel ? <button className="button subtle" onClick={onCancel}>Back to the library</button> : <span/>}<button className="button primary" disabled={!set.nowImageId || !set.thenImageId} onClick={() => setStep('match')}>Match people <ArrowRight size={18}/></button></div>}/>;
}
```

- [ ] **Step 10: Create the People step and wire it in**

Create `activities/childhood-vs-now/setup/PeopleStep.tsx`:
```tsx
import { useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { GroupWizard } from '../../../src/core/people/editor/GroupWizard';
import type { LibraryContext } from '../../../src/core/people/editor/context';
import { orderedSets, peopleInSet, playerIssues, primaryGroupSet } from '../../../src/core/people/photo-sets';
import type { Context } from '../types';
// A first-time host (or one replacing the demo) builds their first group right here; everyone else
// sees who is playing and manages the roster in the People library.
export function PeopleStep({ event, update, updateEvent, runTask, notify, rosterLocked, openPeople }: Context) {
  const [building, setBuilding] = useState(() => !rosterLocked && (event.isDemo || !event.photoSets.length));
  const ctx: LibraryContext = { event, updateEvent, runTask, notify };
  const toGame = () => update(s => { s.setupStepId = 'game'; });
  if (building) return <GroupWizard ctx={ctx} setId={primaryGroupSet(event)?.id} doneLabel="Set up the game" onDone={() => { setBuilding(false); toGame(); }}/>;
  const players = event.people.filter(p => p.included), unnamed = players.filter(p => !p.name.trim()).length;
  return <div className="setup-content"><div className="section-heading"><span className="eyebrow">01 / THE CLASS LIST</span><h1>Who’s playing today<span className="accent">?</span></h1><p>Everyone switched on in your people library gets a photo in this game.</p></div>
    <div className="people-summary">{orderedSets(event).map(set => { const people = peopleInSet(event, set.id); return <div className="people-summary-row" key={set.id}><Users size={17}/><strong>{set.name}</strong><span>{people.filter(p => p.included).length} of {people.length} playing</span></div>; })}</div>
    <p className={unnamed ? 'warning-text' : 'muted'}>{players.length} players ready{unnamed ? ` · ${unnamed} need a name` : ''}</p>
    <div className="setup-footer"><button className="button secondary" onClick={openPeople}>Open People library</button><button className="button primary" disabled={playerIssues(event).length > 0} onClick={toGame}>Set up the game <ArrowRight size={18}/></button></div>
  </div>;
}
```

In `src/core/types.ts`, add to `ActivityContext` after `goHome: () => void;`:
```ts
  openPeople?: () => void;
```

In `activities/childhood-vs-now/activity.ts`:
- Replace the imports of `UploadStep`, `MatchPeopleStep`, `NamePeopleStep` with `import { PeopleStep } from './setup/PeopleStep';`, and change the photo-sets import to `import { playerIssues } from '../../src/core/people/photo-sets';`.
- Replace the `setupSteps` array with:
```ts
  setupSteps: [
    { id: 'people', title: 'People', View: PeopleStep, validate: (_s, e) => playerIssues(e) },
    { id: 'game', title: 'Game setup', View: GameSetupStep, validate: (_s, e) => e.teams.every(t => t.name.trim()) ? [] : ['Every team needs a name.'] },
  ],
```

Delete the three old steps:
```bash
git rm activities/childhood-vs-now/setup/UploadStep.tsx activities/childhood-vs-now/setup/MatchPeopleStep.tsx activities/childhood-vs-now/setup/NamePeopleStep.tsx
```

In `activities/childhood-vs-now/logic/preparation.ts`, change `next.setupStepId = 'upload';` to `next.setupStepId = 'people';`.

In `src/app/App.tsx`:
- In `context`, add `openPeople: () => setRoute('people')` after `goHome: () => setRoute('home')`.
- In `beginSetup` (line 60), change `s.segments[s.currentSegmentIndex].setupStepId = 'upload';` to `… = 'people';`.
- In the demo banner (line 91), change `activity?.setupSteps.some(s => s.id === 'upload')` to `activity?.setupSteps.some(s => s.id === 'people')` and `s.setupStepId = 'upload';` to `s.setupStepId = 'people';`.
- In `PeopleLibrary`'s `onSetup` (line 95), change `current.setupStepId = s.facePairs.length ? 'names' : 'upload';` to `current.setupStepId = 'people';`.

Saved sessions whose Childhood vs Now segment still says `upload`, `match` or `names` load on `people` through the step normalisation added to `validateEvent` in Task 1.

Append to `src/theme/styles.css`:
```css
.people-summary { display: grid; gap: 8px; margin: 10px 0 18px; } .people-summary-row { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: 1px solid var(--line); border-radius: 9px; } .people-summary-row strong { flex: 1; } .people-summary-row span { color: var(--muted); font-size: 14px; } .group-name-field { display: grid; gap: 8px; max-width: 480px; margin: 10px 0 28px; } .group-name-field input { font-size: 20px; padding: 12px 14px; }
```

- [ ] **Step 11: Update the browser tests that used the old step names**

In `tests/browser/app.spec.ts`:
- line 271: `await expect(page.getByRole('button', { name: 'Upload photos', exact: false })).toBeDisabled();` becomes `await expect(page.locator('.setup-steps').getByRole('button', { name: /People/ })).toBeDisabled();`
- line 456: `await expect(page.getByRole('button', { name: /Upload photos/ })).toBeDisabled();` becomes `await expect(page.locator('.setup-steps').getByRole('button', { name: /People/ })).toBeDisabled();`

The demo-based setup tests (`Set up your game` → `Match people` → `Name people` → `Set up the game`) keep working: from the demo, the People step opens the wizard on the demo group's upload screen.

- [ ] **Step 12: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && npx playwright test --reporter=line
```
Expected: `TSC_OK`; unit tests pass; Playwright no worse than the Task 0 baseline. Then run the app (`npm run dev`), open `http://127.0.0.1:5173`, choose **Set up your game** from the demo and confirm the upload → match → names → game setup path works with the demo photos.

- [ ] **Step 13: Commit**

```bash
git add -A src activities tests
git commit -m "feat(people): edit one photo set at a time and give Childhood vs Now a People step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 5: The People library screen

**Files:**
- Modify: `src/core/people/photo-sets.ts`
- Modify: `src/core/people/PeopleLibrary.tsx` (rewrite)
- Modify: `src/app/App.tsx`, `src/theme/styles.css`
- Test: `tests/unit/photo-sets.test.ts`

**Interfaces:**
- Consumes: `GroupWizard`, `SetMatch`, `LibraryContext` (Task 4); `ImportPairsMenu`, `leaveDemo` (Task 3); `clearSetPairs`, `orderedSets`, `peopleInSet` (Tasks 1, 4).
- Produces (`photo-sets.ts`): `setIncluded(lib, setId, included: boolean)`; `moveSet(lib, setId, delta: -1 | 1)`; `renameSet(lib, setId, name): boolean`; `removePhotoSet(lib, setId): string[]` (every image id it forgot).
- Produces: `PeopleLibrary({ session, update, notify, runTask, locked })` — the `onSetup` prop is gone.

- [ ] **Step 1: Write the failing helper tests**

Append to `tests/unit/photo-sets.test.ts` (add `moveSet, removePhotoSet, renameSet, setIncluded` to the import):
```ts
describe('library set actions', () => {
  const crop = (id: string) => ({ sourceImageId: 'src', faceBox: { x: 0, y: 0, width: .1, height: .1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 }, cropImageId: id });
  const build = () => {
    const lib = { ...library(), assets: {} as Record<string, any> };
    const a = createPhotoSet(lib, 'A', 'group'), single = createPhotoSet(lib, 'Priya', 'single'), b = createPhotoSet(lib, 'B', 'group');
    a.nowImageId = 'a-now'; a.thenImageId = 'a-then'; a.previews = { 'a-now': 'a-now-preview' };
    lib.facePairs.push({ ...pair('pa', a.id, 1), now: crop('pa-crop'), then: crop('pa-crop-then') }, { ...pair('pb', a.id, 2), now: crop('pb-crop') }, pair('pc', b.id, 3));
    lib.people.push(person('A1', 'pa'), person('A2', 'pb'), person('B1', 'pc'));
    for (const id of ['a-now', 'a-then', 'a-now-preview', 'pa-crop', 'pa-crop-then', 'pb-crop']) lib.assets[id] = { id };
    return { lib, a, single, b };
  };
  it('switches a whole set in or out, but only people with both faces', () => {
    const { lib, a } = build();
    setIncluded(lib, a.id, false);
    expect(lib.people.map(p => p.included)).toEqual([false, false, true]);
    setIncluded(lib, a.id, true);
    expect(lib.people.map(p => p.included)).toEqual([true, false, true]);
  });
  it('moves a group past the next group, skipping single sets', () => {
    const { lib, a, b } = build();
    moveSet(lib, a.id, 1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
    moveSet(lib, a.id, 1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
    expect(new Set(lib.photoSets.map(s => s.order)).size).toBe(3);
    moveSet(lib, b.id, -1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
  });
  it('renames only to a non-empty trimmed name', () => {
    const { lib, a } = build();
    expect(renameSet(lib, a.id, '   ')).toBe(false);
    expect(a.name).toBe('A');
    expect(renameSet(lib, a.id, '  Design offsite  ')).toBe(true);
    expect(a.name).toBe('Design offsite');
  });
  it('removes a set with its people, faces and images, and closes the gap in the order', () => {
    const { lib, a } = build();
    expect(removePhotoSet(lib, a.id).sort()).toEqual(['a-now', 'a-now-preview', 'a-then', 'pa-crop', 'pa-crop-then', 'pb-crop']);
    expect(lib.people.map(p => p.id)).toEqual(['B1']);
    expect(lib.assets).toEqual({});
    expect(orderedSets(lib).map(s => [s.name, s.order])).toEqual([['Priya', 0], ['B', 1]]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: FAIL — the four helpers are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/core/people/photo-sets.ts`:
```ts
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
```

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the People library**

Replace `src/core/people/PeopleLibrary.tsx` with:
```tsx
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Crop, Download, Plus, Trash2, Users } from 'lucide-react';
import type { ActivityContext, EventSession, Person } from '../types';
import { StoredImage } from '../../components/Images';
import { imageStore } from '../storage';
import { exportFacePairs } from '../transfer';
import { leaveDemo } from './event-library';
import { moveSet, orderedSets, peopleInSet, removePhotoSet, renameSet, setIncluded } from './photo-sets';
import { ImportPairsMenu } from './ImportPairsMenu';
import { GroupWizard } from './editor/GroupWizard';
import { SetMatch } from './editor/SetMatch';
import type { LibraryContext } from './editor/context';
type Props = { session: EventSession; update: (change: (draft: EventSession) => void) => void; notify: ActivityContext['notify']; runTask: ActivityContext['runTask']; locked: boolean };
type Editing = { kind: 'group'; setId?: string } | { kind: 'crop'; setId: string };
export function PeopleLibrary({ session, update, notify, runTask, locked }: Props) {
  const [editing, setEditing] = useState<Editing>();
  const ctx: LibraryContext = { event: session, updateEvent: update, runTask, notify };
  // The demo is a playing game; the first real library change turns it into an ordinary event.
  const begin = (next: Editing) => { if (session.isDemo) update(leaveDemo); setEditing(next); };
  const close = () => setEditing(undefined);
  if (editing?.kind === 'group') return <main className="library-page"><GroupWizard ctx={ctx} setId={editing.setId} doneLabel="Back to the library" onDone={close} onCancel={close}/></main>;
  if (editing?.kind === 'crop') return <main className="library-page"><SetMatch ctx={ctx} setId={editing.setId} onBack={close} onNext={close} nextLabel="Save crop"/></main>;
  const remove = (setId: string, name: string) => {
    if (!window.confirm(`Remove ${name} and everyone in it from the library? Their photos are deleted from this laptop.`)) return;
    if (session.isDemo) update(leaveDemo);
    let removed: string[] = [];
    update(s => { removed = removePhotoSet(s, setId); });
    void Promise.allSettled(removed.map(id => imageStore.delete(id)));
    notify(`${name} removed.`);
  };
  const sets = orderedSets(session), groups = sets.filter(s => s.kind === 'group'), singles = sets.filter(s => s.kind === 'single');
  const card = (person: Person, actions?: ReactNode) => {
    const pair = session.facePairs.find(p => p.id === person.facePairId), complete = Boolean(pair?.now && pair.then);
    return <article className="library-person" key={person.id}><div className="library-portraits"><StoredImage id={pair?.then?.cropImageId} alt={`${person.name || 'Unnamed person'} as a child`}/><StoredImage id={pair?.now?.cropImageId} alt={`${person.name || 'Unnamed person'} now`}/></div><input aria-label={`Library name ${person.id}`} maxLength={80} value={person.name} placeholder="Add a name" onChange={e => update(s => { s.people.find(p => p.id === person.id)!.name = e.target.value; })}/><p>{person.funFact || 'A face worth remembering.'}</p><label className="library-switch"><input type="checkbox" className="switch" aria-label={`Include ${person.name || `person ${pair?.number ?? ''}`}`} checked={person.included} disabled={locked || !complete} onChange={e => update(s => { s.people.find(p => p.id === person.id)!.included = e.target.checked; })}/><span>{person.included ? 'In the game' : 'Sitting this one out'}</span></label>{actions}</article>;
  };
  return <main className="library-page"><div className="section-heading"><span className="eyebrow">THE FAMILIAR FACES</span><h1>Your people library<span className="accent">.</span></h1><p>One team roster, ready for every activity. Names and face pairs travel with your session.</p></div>
    <div className="names-toolbar"><span><Users size={18}/> {session.people.length} people · {session.people.filter(p => p.included).length} in the game</span><div className="button-row"><button className="button secondary" disabled={locked} onClick={() => begin({ kind: 'group' })}><Plus size={16}/> Add a group</button><ImportPairsMenu session={session} update={update} notify={notify} runTask={runTask} locked={locked}/><button className="button secondary" disabled={!session.people.length} onClick={() => void runTask('Packing the face pairs…', () => exportFacePairs(session))}><Download size={16}/> Export pairs</button></div></div>
    {locked && <p className="muted library-locked">The roster is locked after an activity starts. Use Import pairs → Replace library to start over.</p>}
    {groups.map((set, index) => { const people = peopleInSet(session, set.id); return <section className="library-set" key={set.id} aria-label={set.name}><header className="library-set-header"><div><span className="eyebrow">GROUP {index + 1}</span><input key={set.name} className="library-set-name" aria-label={`Name for ${set.name}`} maxLength={80} defaultValue={set.name} disabled={locked} onBlur={e => { const value = e.target.value; if (value.trim() && value.trim() !== set.name) update(s => { renameSet(s, set.id, value); }); else e.target.value = set.name; }}/><small>{people.length} people · {people.filter(p => p.included).length} playing</small></div><div className="button-row"><button className="button subtle small-button" disabled={locked} onClick={() => update(s => setIncluded(s, set.id, true))}>Everyone in</button><button className="button subtle small-button" disabled={locked} onClick={() => update(s => setIncluded(s, set.id, false))}>Everyone out</button><button className="button secondary small-button" disabled={locked} onClick={() => begin({ kind: 'group', setId: set.id })}>Edit photos & matches</button><button className="icon-button" aria-label={`Move ${set.name} up`} disabled={locked || index === 0} onClick={() => update(s => moveSet(s, set.id, -1))}><ArrowUp size={16}/></button><button className="icon-button" aria-label={`Move ${set.name} down`} disabled={locked || index === groups.length - 1} onClick={() => update(s => moveSet(s, set.id, 1))}><ArrowDown size={16}/></button><button className="icon-button danger" aria-label={`Remove ${set.name}`} disabled={locked} onClick={() => remove(set.id, set.name)}><Trash2 size={16}/></button></div></header><div className="library-grid">{people.map(person => card(person))}</div>{!people.length && <p className="muted">No one here yet. Use Edit photos & matches to finish this group.</p>}</section>; })}
    {singles.length > 0 && <section className="library-set" aria-label="Single photos"><header className="library-set-header"><div><span className="eyebrow">SINGLE PHOTOS</span><small>{singles.length} people · {singles.filter(set => peopleInSet(session, set.id)[0]?.included).length} playing</small></div></header><div className="library-grid">{singles.map(set => { const person = peopleInSet(session, set.id)[0]; return person && card(person, <div className="button-row"><button className="button subtle small-button" disabled={locked} onClick={() => begin({ kind: 'crop', setId: set.id })}><Crop size={15}/> Adjust crop</button><button className="icon-button danger" aria-label={`Remove ${set.name}`} disabled={locked} onClick={() => remove(set.id, set.name)}><Trash2 size={16}/></button></div>); })}</div></section>}
    {!session.people.length && !sets.length && <div className="empty-state"><Users size={42}/><h2>The roster is empty.</h2><p>Add a group photo pair, or import face pairs someone exported.</p></div>}
  </main>;
}
```
In `src/app/App.tsx`, replace the whole `{route === 'people' && <PeopleLibrary … onSetup={() => { … }}/>}` element with:
```tsx
    {route === 'people' && <PeopleLibrary session={session} update={updateEvent} notify={notify} runTask={runTask} locked={libraryLocked(session)}/>}
```

Append to `src/theme/styles.css`:
```css
.library-set { margin: 34px 0; } .library-set-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--line); flex-wrap: wrap; } .library-set-header > div:first-child { display: grid; gap: 4px; } .library-set-header small { color: var(--muted); font-size: 13px; } .library-set-name { font-family: var(--heading) !important; font-size: 26px !important; background: transparent !important; border: 1px solid transparent !important; padding: 2px 6px !important; margin-left: -7px; } .library-set-name:hover, .library-set-name:focus { border-color: var(--line) !important; } .library-set .library-grid { margin-top: 20px; } .library-switch { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--muted); margin-bottom: 8px; } .library-locked { margin: -6px 0 10px; }
```

- [ ] **Step 6: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && npx playwright test --reporter=line
```
Expected: `TSC_OK`; unit tests pass; Playwright no worse than baseline. The library tests assert on `img` names `Asha as a child` / `Asha now` and the `Export pairs` button, which are unchanged. Then in `npm run dev`, open the People library from the demo, press **Add a group**, name it, upload two photos, match, name, and check the new group appears with its people switched off.

- [ ] **Step 7: Commit**

```bash
git add src/core/people src/app/App.tsx src/theme/styles.css tests/unit/photo-sets.test.ts
git commit -m "feat(people): show the library as groups with add, edit, reorder and remove

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 6: Add a person with two single photos

**Files:**
- Modify: `src/core/people/photo-sets.ts`, `src/core/people/photos.ts`
- Create: `src/core/people/editor/AddPersonDialog.tsx`
- Modify: `src/core/people/PeopleLibrary.tsx`, `src/theme/styles.css`
- Test: `tests/unit/photo-sets.test.ts`

**Interfaces:**
- Consumes: `createPhotoSet`, `nextPairNumber`, `pairsInSet` (Task 1); `storePhoto`, `prepareCrops` (Task 1); `libraryDraft`, `LibraryContext` (Task 4).
- Produces (`photo-sets.ts`): `SinglePhoto { asset: Asset; preview: Asset; face: Pick<FaceCrop, 'faceBox' | 'padding'> }`; `addSinglePerson(lib, { name, funFact, now: SinglePhoto, then: SinglePhoto }): Person`; `replaceSinglePhotos(lib, setId, now, then): string[]`; `largestFace(faces: readonly Rect[]): Rect | undefined`; `wholeImageFace()`.
- Produces (`photos.ts`): `suggestFace(blob): Promise<Pick<FaceCrop, 'faceBox' | 'padding'>>`.
- Produces: `AddPersonDialog({ ctx, setId?, onClose })`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/photo-sets.test.ts` (add `addSinglePerson, largestFace, replaceSinglePhotos, wholeImageFace` to the photo-sets import, and add these imports):
```ts
import { createEvent } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
```
```ts
describe('single-photo people', () => {
  const photo = (id: string) => ({ asset: { id, name: `${id}.jpg`, width: 600, height: 800, mime: 'image/jpeg' }, preview: { id: `${id}-preview`, name: 'p.jpg', width: 300, height: 400, mime: 'image/jpeg' }, face: { faceBox: { x: .2, y: .1, width: .4, height: .3 }, padding: { top: .4, right: .32, bottom: .7, left: .32 } } });
  it('adds a playing person in their own single set', () => {
    const event = createEvent();
    const person = addSinglePerson(event, { name: ' Priya ', funFact: 'Plays the tabla', now: photo('now'), then: photo('then') });
    expect(person).toMatchObject({ name: 'Priya', funFact: 'Plays the tabla', included: true });
    expect(event.photoSets).toEqual([{ id: expect.any(String), name: 'Priya', kind: 'single', nowImageId: 'now', thenImageId: 'then', previews: { now: 'now-preview', then: 'then-preview' }, order: 0 }]);
    expect(event.facePairs[0]).toMatchObject({ number: 1, setId: event.photoSets[0].id, reviewStatus: 'confirmed', now: { sourceImageId: 'now' }, then: { sourceImageId: 'then' } });
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('replaces both photos in place and returns the old image ids', () => {
    const event = createEvent();
    const person = addSinglePerson(event, { name: 'Priya', funFact: '', now: photo('now'), then: photo('then') });
    event.facePairs[0].now!.cropImageId = 'old-crop'; event.assets['old-crop'] = { id: 'old-crop', name: 'c', width: 1, height: 1, mime: 'image/jpeg' };
    const removed = replaceSinglePhotos(event, event.photoSets[0].id, photo('now2'), photo('then2'));
    expect(removed.sort()).toEqual(['now', 'now-preview', 'old-crop', 'then', 'then-preview']);
    expect(event.people).toEqual([person]);
    expect(event.facePairs[0].now).toEqual({ sourceImageId: 'now2', faceBox: { x: .2, y: .1, width: .4, height: .3 }, padding: { top: .4, right: .32, bottom: .7, left: .32 } });
    expect(Object.keys(event.assets).sort()).toEqual(['now2', 'now2-preview', 'then2', 'then2-preview']);
  });
  it('suggests the largest detected face, or the whole photo', () => {
    expect(largestFace([{ x: 0, y: 0, width: .1, height: .1 }, { x: .5, y: .5, width: .3, height: .2 }])).toEqual({ x: .5, y: .5, width: .3, height: .2 });
    expect(largestFace([])).toBeUndefined();
    expect(wholeImageFace()).toEqual({ faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: FAIL — the new helpers are not exported.

- [ ] **Step 3: Implement the helpers**

In `src/core/people/photo-sets.ts`, change the first line to `import type { Asset, FaceCrop, FacePair, Person, PhotoSet, Rect } from '../types';`, add `import { teamColors } from '../event';`, and append:
```ts
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
```
In `src/core/people/photos.ts`, add `detectFaces` to the `../images/client` import, add `largestFace, wholeImageFace` to the `./photo-sets` import, and append:
```ts
export async function suggestFace(blob: Blob): Promise<Pick<FaceCrop, 'faceBox' | 'padding'>> {
  try { const face = largestFace(await detectFaces(blob)); if (face) return { faceBox: face, padding: { ...defaultPadding } }; }
  catch { /* A single photo still works uncropped when the detector is unavailable. */ }
  return wholeImageFace();
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/photo-sets.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the dialog**

Create `src/core/people/editor/AddPersonDialog.tsx`:
```tsx
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
```

- [ ] **Step 6: Wire it into the library**

In `src/core/people/PeopleLibrary.tsx`:
- Add `UserPlus` and `ImagePlus` to the `lucide-react` import and `import { AddPersonDialog } from './editor/AddPersonDialog';`.
- Change the `Editing` type to:
```ts
type Editing = { kind: 'group'; setId?: string } | { kind: 'crop'; setId: string } | { kind: 'person'; setId?: string };
```
- In the toolbar, after the **Add a group** button, add:
```tsx
<button className="button secondary" disabled={locked} onClick={() => begin({ kind: 'person' })}><UserPlus size={16}/> Add a person</button>
```
- In the single-photo card actions, before the **Adjust crop** button, add:
```tsx
<button className="button subtle small-button" disabled={locked} onClick={() => begin({ kind: 'person', setId: set.id })}><ImagePlus size={15}/> Replace photos</button>
```
- Immediately before the closing `</main>` of the main return, add:
```tsx
    {editing?.kind === 'person' && <AddPersonDialog ctx={ctx} setId={editing.setId} onClose={close}/>}
```

Append to `src/theme/styles.css`:
```css
.add-person .field { display: grid; gap: 6px; margin: 14px 0; } .add-person .field span { font-size: 12px; color: var(--muted); letter-spacing: .04em; } .add-person .field input[type='text'], .add-person .field input:not([type]) { padding: 10px 12px; } .add-person .button-row { justify-content: flex-end; margin-top: 18px; }
```

- [ ] **Step 7: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
```
Expected: `TSC_OK`, all unit tests pass. In `npm run dev`, open the People library, **Add a person** with two photos, and confirm a **Single photos** section appears with the person switched on; **Adjust crop** opens the crop editor with only the Adjust controls.

- [ ] **Step 8: Commit**

```bash
git add src/core/people src/theme/styles.css tests/unit/photo-sets.test.ts
git commit -m "feat(people): add a person from two single photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 7: A reveal slide for every group with players

**Files:**
- Create: `activities/childhood-vs-now/logic/reveal.ts`
- Modify: `activities/childhood-vs-now/types.ts`, `activities/childhood-vs-now/stage/Finale.tsx`, `src/theme/styles.css`
- Test: `tests/unit/reveal.test.ts` (new), `tests/unit/event-library.test.ts`, `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `orderedSets` (Task 1).
- Produces: `RevealPlayer { person: Person; pair: FacePair }`; `RevealSlide = { kind: 'group'; set: PhotoSet; players: RevealPlayer[] } | { kind: 'singles'; players: RevealPlayer[] }`; `buildRevealSlides(event, rounds): RevealSlide[]`; `clampSlide(index, count): number`; finale state gains `slideIndex: number` (default 0).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/reveal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildRevealSlides, clampSlide } from '../../activities/childhood-vs-now/logic/reveal';
import type { FacePair, Person, PhotoSet } from '../../src/core/types';

const set = (id: string, kind: PhotoSet['kind'], order: number): PhotoSet => ({ id, name: id, kind, order, previews: {}, nowImageId: `${id}-now`, thenImageId: `${id}-then` });
const pair = (id: string, setId: string): FacePair => ({ id, setId, number: 1, color: '#f7d873', matchMethod: 'manual', reviewStatus: 'confirmed' });
const person = (id: string, facePairId: string): Person => ({ id, facePairId, name: id, funFact: '', included: true });
const event = {
  photoSets: [set('second', 'group', 1), set('first', 'group', 0), set('nobody', 'group', 2), set('priya', 'single', 3), set('omar', 'single', 4)],
  facePairs: [pair('f1', 'first'), pair('f2', 'first'), pair('s1', 'second'), pair('n1', 'nobody'), pair('p1', 'priya'), pair('o1', 'omar')],
  people: [person('Asha', 'f1'), person('Leo', 'f2'), person('Maya', 's1'), person('Sam', 'n1'), person('Priya', 'p1'), person('Omar', 'o1')],
};
const rounds = (...ids: string[]) => ids.map(personId => ({ personId }));

describe('reveal slides', () => {
  it('shows each group in library order with only its players, then one slide for single photos', () => {
    const slides = buildRevealSlides(event, rounds('Asha', 'Maya', 'Priya', 'Omar'));
    expect(slides.map(s => s.kind === 'group' ? s.set.id : 'singles')).toEqual(['first', 'second', 'singles']);
    expect(slides[0].players.map(p => p.person.id)).toEqual(['Asha']);
    expect(slides[2].players.map(p => p.person.id)).toEqual(['Priya', 'Omar']);
  });
  it('skips groups without players and leaves out the singles slide when nobody single played', () => {
    const slides = buildRevealSlides(event, rounds('Maya'));
    expect(slides.map(s => s.kind === 'group' ? s.set.id : 'singles')).toEqual(['second']);
  });
  it('can be only the singles slide', () => {
    expect(buildRevealSlides(event, rounds('Priya')).map(s => s.kind)).toEqual(['singles']);
  });
  it('clamps a stored slide index into range', () => {
    expect(clampSlide(5, 2)).toBe(1);
    expect(clampSlide(-1, 2)).toBe(0);
    expect(clampSlide(3, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/reveal.test.ts`
Expected: FAIL — cannot resolve `logic/reveal`.

- [ ] **Step 3: Implement the slide builder**

Create `activities/childhood-vs-now/logic/reveal.ts`:
```ts
import type { FacePair, Person, PhotoSet } from '../../../src/core/types';
import { orderedSets } from '../../../src/core/people/photo-sets';

export interface RevealPlayer { person: Person; pair: FacePair }
export type RevealSlide = { kind: 'group'; set: PhotoSet; players: RevealPlayer[] } | { kind: 'singles'; players: RevealPlayer[] };
type Library = { readonly photoSets: readonly PhotoSet[]; readonly facePairs: readonly FacePair[]; readonly people: readonly Person[] };

// Only people who had a photo in this game are revealed; a group nobody played from is skipped.
export function buildRevealSlides(event: Library, rounds: readonly { personId: string }[]): RevealSlide[] {
  const inGame = new Set(rounds.map(round => round.personId));
  const players = event.people.filter(person => inGame.has(person.id)).flatMap(person => { const pair = event.facePairs.find(p => p.id === person.facePairId); return pair ? [{ person, pair }] : []; });
  const sets = orderedSets(event), slides: RevealSlide[] = [];
  for (const set of sets.filter(s => s.kind === 'group')) {
    const here = players.filter(player => player.pair.setId === set.id);
    if (here.length) slides.push({ kind: 'group', set, players: here });
  }
  const singles = sets.filter(s => s.kind === 'single').flatMap(set => players.filter(player => player.pair.setId === set.id));
  if (singles.length) slides.push({ kind: 'singles', players: singles });
  return slides;
}
export const clampSlide = (index: number, count: number) => Math.min(Math.max(0, index), Math.max(0, count - 1));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/reveal.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the slide index to the finale state**

In `activities/childhood-vs-now/types.ts`, change the `finale` entry of `stateSchema` to:
```ts
  finale: z.object({ wipePosition: z.number().min(0).max(100), slideIndex: z.number().int().min(0).default(0), spotlightPersonId: z.string().optional() }),
```
and `initialState`'s finale to `finale: { wipePosition: 0, slideIndex: 0 }`. The default fills in saved games from before this change.

In `activities/childhood-vs-now/logic/rounds.ts` nothing changes. In `tests/unit/event-library.test.ts` change `expect(view.game.finale).toEqual({ wipePosition: 0 });` to `expect(view.game.finale).toEqual({ wipePosition: 0, slideIndex: 0 });`. In `tests/browser/app.spec.ts` line 63 change `expect(importedGame.finale).toEqual({ wipePosition: 0 });` to `expect(importedGame.finale).toEqual({ wipePosition: 0, slideIndex: 0 });`.

- [ ] **Step 6: Rewrite the reveal view in the finale**

In `activities/childhood-vs-now/stage/Finale.tsx`:
- Change the React import to `import { useEffect, useState } from 'react';`, add `ChevronLeft, ChevronRight` to the `lucide-react` import, replace the `primaryGroupSet` import with `import { buildRevealSlides, clampSlide } from '../logic/reveal';`.
- Replace the lines from `const spotlight = event.people.find(…)` through `const image = …, ratio = …;` with:
```tsx
  const slides = buildRevealSlides(event, segment.game.rounds), index = clampSlide(finale.slideIndex, slides.length), slide = slides[index];
  const groupSlide = slide?.kind === 'group' ? slide : undefined;
  const spotlight = groupSlide?.players.find(p => p.person.id === finale.spotlightPersonId);
  const spot = spotlight && (finale.wipePosition >= 50 ? spotlight.pair.now?.faceBox : spotlight.pair.then?.faceBox);
  const image = groupSlide?.set.nowImageId ? event.assets[groupSlide.set.nowImageId] : undefined, ratio = image ? image.width / image.height : 16 / 9;
  const go = (delta: number) => update(s => { const next = clampSlide(index + delta, slides.length); if (next === index) return; s.game.finale.slideIndex = next; s.game.finale.wipePosition = 0; delete s.game.finale.spotlightPersonId; });
  // Arrow keys step through the photos, except while a control such as the wipe slider has focus.
  useEffect(() => {
    if (view !== 'group') return;
    const onKey = (e: KeyboardEvent) => { const target = e.target as HTMLElement | null; if (target?.closest('input, textarea, select, [contenteditable="true"]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
```
- Replace the whole group-view branch (everything after `: <>` up to the final `</>}</main>;`) with:
```tsx
<><div className="group-reveal-title"><button className="button subtle" onClick={() => setView('results')}><ArrowLeft size={18}/> Results</button><div><span className="eyebrow">ONE LAST THROWBACK{slide?.kind === 'group' ? ` · ${slide.set.name}` : ''}{slides.length > 1 ? ` (${index + 1} of ${slides.length})` : ''}</span><h1>{slide?.kind === 'singles' ? 'Also in the game' : 'Look how far we’ve come.'}</h1></div>{slides.length > 1 ? <div className="reveal-steps"><button className="icon-button" aria-label="Previous reveal photo" disabled={index === 0} onClick={() => go(-1)}><ChevronLeft size={20}/></button><button className="icon-button" aria-label="Next reveal photo" disabled={index === slides.length - 1} onClick={() => go(1)}><ChevronRight size={20}/></button></div> : <Sparkles size={30}/>}</div>
  {!slide && <div className="empty-state"><h2>No group photos to reveal.</h2></div>}
  {groupSlide && <><div className="group-wipe" style={{ aspectRatio: ratio, '--photo-ratio': ratio } as React.CSSProperties}><StoredImage id={groupSlide.set.thenImageId} alt="The whole team as children"/><div className="wipe-now" style={{ clipPath: `inset(0 ${100 - finale.wipePosition}% 0 0)` }}><StoredImage id={groupSlide.set.nowImageId} alt="The whole team today"/></div><div className="wipe-line" style={{ left: `${finale.wipePosition}%` }}><span>↔</span></div><span className="wipe-label then">THEN</span><span className="wipe-label now">NOW</span>{spot && spotlight && <div className="spotlight-box" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${spot.width * 100}%`, height: `${spot.height * 100}%` }}><span>{spotlight.person.name}</span></div>}</div>
    <label className="wipe-control"><span className="handwritten">Little legends</span><input aria-label="Reveal original group photo" type="range" min="0" max="100" value={finale.wipePosition} onChange={e => update(s => { s.game.finale.wipePosition = +e.target.value; })}/><span className="handwritten">All grown up</span></label>
    <div className="spotlight-controls"><span className="eyebrow">IN THE SPOTLIGHT</span><button className={`button small-button ${!spotlight ? 'primary' : 'secondary'}`} onClick={() => update(s => { delete s.game.finale.spotlightPersonId; })}>Everyone</button>{groupSlide.players.map(({ person }) => <button className={`button small-button ${spotlight?.person.id === person.id ? 'primary' : 'secondary'}`} key={person.id} onClick={() => update(s => { s.game.finale.spotlightPersonId = person.id; })}>{person.name}</button>)}</div></>}
  {slide?.kind === 'singles' && <div className="singles-reveal">{slide.players.map(({ person, pair }) => <div className="singles-card" key={person.id}><div className="polaroid"><StoredImage id={pair.then?.cropImageId} alt={`${person.name} as a child`}/><span className="handwritten polaroid-caption">back then</span></div><span className="reveal-arrow handwritten">→</span><div className="polaroid"><StoredImage id={pair.now?.cropImageId} alt={`${person.name} now`}/><span className="handwritten polaroid-caption">all grown up</span></div><strong>{person.name}</strong></div>)}</div>}
</>
```
`view` is declared before the `useEffect` (it is the component's first `useState`), and the effect has no dependency array on purpose so `go` always sees the current slide.

Append to `src/theme/styles.css`:
```css
.reveal-steps { display: flex; gap: 8px; } .singles-reveal { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 28px; margin-top: 26px; } .singles-card { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; } .singles-card .polaroid { width: 100%; } .singles-card > strong { grid-column: 1 / -1; text-align: center; font-family: var(--heading); font-size: 22px; }
```

- [ ] **Step 7: Verify**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && npx playwright test --reporter=line -g "reveal|full demo"
```
Expected: `TSC_OK`; unit tests pass; the demo reveal tests pass unchanged — a single-group game has one slide, no counter and no arrows.

- [ ] **Step 8: Commit**

```bash
git add activities/childhood-vs-now src/theme/styles.css tests/unit/reveal.test.ts tests/unit/event-library.test.ts tests/browser/app.spec.ts
git commit -m "feat(childhood-vs-now): reveal every group photo that had players

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Task 8: End-to-end browser coverage and docs

**Files:**
- Modify: `tests/browser/app.spec.ts`, `README.md`, `HANDOVER.md`

**Interfaces:**
- Consumes: every earlier task, through the UI. Existing helpers in `app.spec.ts`: `saved(page)`, `aioHome(page)`, `key`.

- [ ] **Step 1: Add the browser tests**

At the top of `tests/browser/app.spec.ts` add:
```ts
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
```
Append at the end of the file:
```ts
test('a partial second group from a version 1 file joins the game and gets its own reveal slide', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  // Export the demo group and rebuild it as a version 1 bundle, the format older exports used.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pairs', exact: true }).click();
  const exported = unzipSync(await readFile((await (await download).path())!));
  const manifest = JSON.parse(strFromU8(exported['face-pairs.json'])), set = manifest.sets[0];
  const groups: Record<string, unknown> = { now: { ...set.now, path: 'groups/now' }, then: { ...set.then, path: 'groups/then' } };
  const files: Record<string, Uint8Array> = { 'groups/now': exported['sets/01/now'], 'groups/then': exported['sets/01/then'] };
  if (set.nowPreview) { groups.nowPreview = { ...set.nowPreview, path: 'groups/now-preview' }; files['groups/now-preview'] = exported['sets/01/now-preview']; }
  if (set.thenPreview) { groups.thenPreview = { ...set.thenPreview, path: 'groups/then-preview' }; files['groups/then-preview'] = exported['sets/01/then-preview']; }
  for (const pair of manifest.pairs) for (const side of ['now', 'then']) files[pair[side].cropPath] = exported[pair[side].cropPath];
  files['face-pairs.json'] = strToU8(JSON.stringify({ version: 1, groups, pairs: manifest.pairs.map(({ set: _set, ...pair }: any) => pair) }));

  await page.getByLabel('Add face pairs ZIP').setInputFiles({ name: 'Design offsite.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) });
  await expect(page.getByRole('heading', { name: 'Some names match' })).toBeVisible();
  await page.getByRole('button', { name: 'Add anyway' }).click();
  await expect(page.getByRole('status')).toContainText('4 people added.');
  const second = page.getByRole('region', { name: 'Design offsite' });
  await second.getByRole('button', { name: 'Everyone out' }).click();
  await second.getByRole('checkbox', { name: 'Include Asha' }).check();
  await second.getByRole('checkbox', { name: 'Include Leo' }).check();
  const session = await saved(page);
  expect(session.photoSets.map((s: any) => s.name)).toEqual(['Demo team', 'Design offsite']);
  expect(session.people.filter((p: any) => p.included)).toHaveLength(6);
  expect(session.isDemo).toBe(false);

  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await expect(page.getByText(/Demo team \(1 of 2\)/)).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Reveal original group photo' });
  await slider.focus(); await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1');
  await expect(page.getByText(/Demo team \(1 of 2\)/)).toBeVisible();
  await page.getByRole('heading', { name: 'Look how far we’ve come.' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/Design offsite \(2 of 2\)/)).toBeVisible();
  await expect(page.locator('.spotlight-controls button')).toHaveCount(3);
  await page.locator('.spotlight-controls').getByRole('button', { name: 'Leo', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toHaveText('Leo');
  await expect(page.locator('.image-missing')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a person added from two single photos is revealed on the last slide', async ({ page }) => {
  test.setTimeout(120_000);
  await aioHome(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const makeImage = async (w: number, h: number) => Buffer.from(await page.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f1dfbf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c98f6b'; ctx.beginPath(); ctx.ellipse(w * .5, h * .4, w * .2, h * .18, 0, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL('image/jpeg', .9).split(',')[1];
  }, { w, h }), 'base64');
  await page.getByRole('button', { name: 'Add a person' }).click();
  await page.getByLabel('Person name').fill('Priya');
  await page.getByLabel('Childhood photo').setInputFiles({ name: 'priya-then.jpg', mimeType: 'image/jpeg', buffer: await makeImage(500, 700) });
  await page.getByLabel('Current photo').setInputFiles({ name: 'priya-now.jpg', mimeType: 'image/jpeg', buffer: await makeImage(600, 800) });
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByRole('status')).toContainText('Priya added.', { timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Single photos' }).getByRole('img', { name: 'Priya now' })).toBeVisible();

  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await page.getByRole('button', { name: 'Next reveal photo' }).click();
  await expect(page.getByRole('heading', { name: 'Also in the game' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Priya as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Priya now' })).toBeVisible();
});

test('a version 2 session saved before photo sets still opens with its people', async ({ page }) => {
  const doc = await readFile('tests/fixtures/event-v2.json', 'utf8');
  await page.addInitScript(([k, value]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, value); sessionStorage.setItem('seeded', '1'); } }, [key, doc] as const);
  await page.goto('/');
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Group 1' })).toBeVisible();
  await expect(page.getByLabel(/^Library name/)).toHaveValue('Asha');
});
```
The fixture's images are not in IndexedDB, so its portraits show the missing-image placeholder; the test checks only that the migrated session loads and lists its people.

- [ ] **Step 2: Run the new browser tests**

Run: `npm run build >/dev/null && npx playwright test --reporter=line -g "partial second group|single photos|version 2 session"`
Expected: 3 passed. If the duplicate dialog does not appear, check that `duplicateNames` compares against the demo names (`Asha`, `Leo`, `Maya`, `Dev`).

- [ ] **Step 3: Update the docs**

In `README.md`, replace the two paragraphs starting "The People library belongs to the whole event…" and "After an earlier activity has been played…" with:
```markdown
The People library belongs to the whole event and is available even before activities are added. It holds **photo sets**: groups (a childhood group photo and a current group photo, matched face by face) and single people (one childhood photo and one current photo each). **Add a group** runs upload → match → names for a new group; people in a second or later group start switched off, so for a partial group you switch on only the players (**Everyone in / Everyone out** do a whole group at once). **Add a person** adds someone from two single photos. Groups can be renamed, reordered, edited or removed.

**Export pairs** saves every set in one ZIP. **Import pairs → Add to library** adds a ZIP's sets after your own (matching names are flagged first: Add anyway, Skip duplicates or Cancel); **Replace library** swaps the whole library after confirmation and resets all activity progress, scores and wager bets, keeping the line-up, activity settings, teams and wager question. Older single-group exports still import; the group is named after the ZIP file.

After an activity has started, the roster is locked to protect its saved rounds; only Replace library changes it. Names can still be edited. Starting or replaying one activity clears only that segment's score entries. The Childhood vs Now whole team reveal shows one wipe per group that had players in the game, in library order, and a final "Also in the game" slide for people added from single photos.
```
Append to `HANDOVER.md`:
```markdown
## Addendum — multi-group people library (2026-09-23)

Spec: `docs/superpowers/specs/2026-09-23-multi-group-people-library-design.md`; plan: `docs/superpowers/plans/2026-09-23-multi-group-people-library.md`.

- Group photos moved out of the Childhood vs Now game into `EventSession.photoSets`; every `FacePair` has a `setId`. Session format is 3; `migrateEventV2` (`src/core/migrate.ts`) upgrades saved sessions and session ZIPs on load.
- Library helpers are pure functions in `src/core/people/photo-sets.ts`; image-side helpers in `src/core/people/photos.ts`; the set editors in `src/core/people/editor/`.
- Face-pair bundles are version 2 (`sets/NN/...`); version 1 imports as one set.
- `libraryLocked` (`event-library.ts`) never locks the demo; the first library change from the People library calls `leaveDemo`, which resets progress like Replace library but keeps the people.
- Childhood vs Now setup is People → Game setup. Unknown saved setup-step ids fall back to the first step in `validateEvent`.
- Known limit: replacing only a group's current photo after its childhood photo was aligned re-scales the aligned image rather than the original upload.
```

- [ ] **Step 4: Full verification**

Run:
```bash
npx tsc -b && echo TSC_OK
npm test
npm run build >/dev/null && echo BUILD_OK
npx playwright test --reporter=line
```
Expected: `TSC_OK`, all unit tests pass, `BUILD_OK`, and Playwright passes every test that passed in Task 0 plus the three new ones.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/app.spec.ts README.md HANDOVER.md
git commit -m "test: cover a partial second group, a single-photo person and a v2 session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
