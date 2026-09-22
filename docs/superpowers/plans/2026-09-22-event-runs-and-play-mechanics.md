# Event Runs and Shared Play Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one host run five or six activities back to back with shared teams, a single running leaderboard, and shared play mechanics (timer, steal, final wager).

**Architecture:** `Session` becomes the event and holds an ordered `Segment[]`; `people`, `facePairs`, `teams`, `scoreEntries`, and `assets` stay at the event level and are shared by every segment. Activities are *not* rewritten: core hands each one a shallow "segment view" that still exposes `game`/`settings`/`phase`/`setupStepId` at the top level, and folds writes back into the segment. New shared play primitives live in `src/core/play/`.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Zod 4, Vitest 4, Playwright 1.63, `idb`, `fflate`, `lucide-react`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-22-event-runs-and-play-mechanics-design.md`

## Global Constraints

- No backend, no network at play time. Nothing may add a server, join code, CDN fetch, or telemetry.
- No new npm dependencies. Everything ships from what is already in `package.json`.
- Offline must keep working: all assets local, service worker precaches every activity chunk.
- `ScoreEntry.points` stays `z.number().int()`. No fractional points anywhere.
- Base award is **2** points, steal is **1**. Both configurable via event settings.
- Wager per team is clamped to `0 .. Math.max(teamScore, 5)`.
- Teams: 1–8, enforced by the existing schema (`teams: z.array(...).min(1).max(8)`).
- Session document key stays `fun-friday-studio.session.v1` in localStorage (the key name is storage
  location, not format version; `formatVersion` inside the document goes to 2).
- Import limits stay 512 MB compressed / 800 MB expanded.
- Style: this codebase writes dense single-line JSX and multi-statement lines. Match the surrounding
  file. Use theme variables from `src/theme/styles.css`; never hardcode colours.
- Respect `prefers-reduced-motion` for any new animation.
- Copy is British-inflected and warm ("colours", "Recognise"). Match it.
- `npm test` must pass before **every** task's commit step, with no exceptions.
- `npx tsc -b` must pass before the commit step from **Task 5 onward**. Tasks 1–4 move the session
  model across four commits, so `src/app/App.tsx`, `src/core/transfer.ts` and `src/main.tsx` are
  knowingly red until Task 5 rewires them. (`main.tsx` was missing from this list until Task 3
  surfaced it: Task 3 deletes `createSession`/`validateSession`, which `main.tsx` imports.) Each of those tasks names the files expected to fail and why; a failure anywhere else, or a
  red `tsc` from Task 5 on, is a real break and must be fixed before committing.
  (Ruling by the human partner, 2026-09-22: staged refactor beats throwaway shims. The trade
  accepted is that commits for Tasks 1–4 do not compile and are not individually bisectable.)

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/core/event.ts` | `EventSession`/`Segment` types, `createEvent`, `createSegment`, `segmentView`, `foldSegmentView` |
| `src/core/play/timer.ts` | Headless countdown state + `useCountdown` hook |
| `src/core/play/Timer.tsx` | Projector countdown display and host controls |
| `src/core/play/steal.ts` | Steal award/retract ledger helpers |
| `src/core/play/StealPanel.tsx` | Host steal UI |
| `src/core/play/wager.ts` | Wager clamping and ledger helpers |
| `src/core/play/Wager.tsx` | Final wager bet entry and marking screens |
| `src/app/Lineup.tsx` | Lineup builder screen |
| `src/app/Interstitial.tsx` | Between-segment standings screen |
| `src/app/EventFinale.tsx` | Overall winner screen |
| `tests/unit/event.test.ts` | Segment view round-trips, `createEvent` |
| `tests/unit/migration.test.ts` | v1 → v2 migration |
| `tests/unit/play.test.ts` | Steal, wager, timer state |
| `tests/fixtures/session-v1.json` | Real v1 document for the migration test |

**Modified:**

| File | Change |
| --- | --- |
| `src/core/types.ts` | `ScoreEntry` gains `segmentId` + new kinds; `Session` becomes the segment view type; `Activity.Finale` optional, `estimatedMinutes` added |
| `src/core/scoring.ts` | `segmentId` threading, `segmentScore`, weight at award time |
| `src/core/session.ts` | v2 schema, per-segment validation, `migrateV1` |
| `src/core/transfer.ts` | Per-segment `remapImages` |
| `src/app/App.tsx` | Event phases, segment view in context, routing |
| `src/core/teams/Scoreboard.tsx` | Reads event-level scores (no functional change, prop rename only) |
| `activities/childhood-vs-now/logic/rounds.ts` | Pass `segmentId` to `setRoundAward`; steal support |
| `activities/childhood-vs-now/stage/Stage.tsx` | Steal panel, `+2` stake copy |
| `activities/childhood-vs-now/setup/GameSetupStep.tsx` | Scoring copy `1` → `2` |
| `src/app/Home.tsx` | "Build an event" entry; card copy `1 point` → `2 points` |
| `src/theme/styles.css` | Styles for lineup, interstitial, timer, steal, wager |
| `README.md` | Event runs, mechanics, updated shortcuts |

---

### Task 1: Scoring ledger — segment scoping and weights

**Files:**
- Modify: `src/core/types.ts:21` (`ScoreEntry`)
- Modify: `src/core/scoring.ts` (whole file)
- Test: `tests/unit/scoring.test.ts` (extend)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ScoreEntry` with `segmentId?: ID` and `kind: 'round-award' | 'steal-award' | 'manual-adjustment' | 'wager'`
  - `teamScore(entries: ScoreEntry[], teamId: string): number` (unchanged signature)
  - `standings(teams: Team[], entries: ScoreEntry[]): (Team & { score: number })[]` (unchanged)
  - `segmentScore(entries: ScoreEntry[], segmentId: string, teamId: string): number`
  - `setRoundAward(entries: ScoreEntry[], segmentId: string, roundId: string, teamId: string, correct: boolean, points?: number): ScoreEntry[]`
  - `DEFAULT_CORRECT_POINTS = 2`, `DEFAULT_STEAL_POINTS = 1`

Note the **breaking signature change**: `setRoundAward` gains `segmentId` as its second parameter.
Its only caller is `markResult` in `activities/childhood-vs-now/logic/rounds.ts`, updated in Step 5
below and revisited in Task 7.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/scoring.test.ts`. The file already imports `setRoundAward`, `standings`,
`teamScore` and the `ScoreEntry` type — extend those existing import statements rather than adding
duplicates:

```ts
// add to the existing import from '../../src/core/scoring':
//   segmentScore, DEFAULT_CORRECT_POINTS

describe('segment-scoped ledger', () => {
  it('namespaces entry ids so two segments can share a round id', () => {
    let entries = setRoundAward([], 'seg-a', 'round-p1', 't0', true);
    entries = setRoundAward(entries, 'seg-b', 'round-p1', 't0', true);
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.id)).toEqual(['seg-a:award-round-p1', 'seg-b:award-round-p1']);
    expect(teamScore(entries, 't0')).toBe(4);
  });
  it('stays idempotent within a segment', () => {
    let entries = setRoundAward([], 'seg-a', 'r1', 't0', true);
    entries = setRoundAward(entries, 'seg-a', 'r1', 't0', true);
    expect(entries).toHaveLength(1);
    expect(teamScore(entries, 't0')).toBe(DEFAULT_CORRECT_POINTS);
  });
  it('awards the configured points and defaults to two', () => {
    expect(teamScore(setRoundAward([], 's', 'r', 't0', true), 't0')).toBe(2);
    expect(teamScore(setRoundAward([], 's', 'r', 't0', true, 6), 't0')).toBe(6);
  });
  it('reports per-segment scores separately from the total', () => {
    let entries = setRoundAward([], 'seg-a', 'r1', 't0', true);
    entries = setRoundAward(entries, 'seg-b', 'r2', 't0', true, 5);
    expect(segmentScore(entries, 'seg-a', 't0')).toBe(2);
    expect(segmentScore(entries, 'seg-b', 't0')).toBe(5);
    expect(teamScore(entries, 't0')).toBe(7);
  });
  it('excludes manual adjustments from any segment total but keeps them in the event total', () => {
    const entries: ScoreEntry[] = [
      ...setRoundAward([], 'seg-a', 'r1', 't0', true),
      { id: 'm', teamId: 't0', kind: 'manual-adjustment', points: 3, active: true },
    ];
    expect(segmentScore(entries, 'seg-a', 't0')).toBe(2);
    expect(teamScore(entries, 't0')).toBe(5);
  });
});

```

The existing tests in this file call `setRoundAward(entries, 'r1', 't0', true)` with the old
signature and expect 1 point. Update every existing call to pass a segment id as the second argument,
and change the expected totals from `1` to `2` (and the `-1` manual adjustment case from `0` to `1`).
The `markResult` test at `tests/unit/scoring.test.ts:24` is revisited in Task 7; leave it for now by
giving its fake session a `segmentId: 'seg-a'` property:

```ts
const s = { segmentId: 'seg-a', game: { rounds: allocateRounds(people, teams, false), currentRoundIndex: 0 }, scoreEntries: [] } as unknown as CVSession;
```

and change its final expectation from `toBe(1)` to `toBe(2)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/scoring.test.ts`
Expected: FAIL. `segmentScore` is not exported, and `setRoundAward` receives
the wrong argument count.

- [ ] **Step 3: Extend `ScoreEntry`**

In `src/core/types.ts`, replace line 21:

```ts
export interface ScoreEntry { id: ID; teamId: ID; segmentId?: ID; roundId?: ID; kind: 'round-award' | 'steal-award' | 'manual-adjustment' | 'wager'; points: number; active: boolean }
```

- [ ] **Step 4: Rewrite `src/core/scoring.ts`**

```ts
import type { ScoreEntry, Team } from './types';
export const DEFAULT_CORRECT_POINTS = 2;
export const DEFAULT_STEAL_POINTS = 1;
export function teamScore(entries: ScoreEntry[], teamId: string) { return entries.reduce((total, entry) => total + (entry.teamId === teamId && entry.active ? entry.points : 0), 0); }
export function segmentScore(entries: ScoreEntry[], segmentId: string, teamId: string) { return entries.reduce((total, entry) => total + (entry.segmentId === segmentId && entry.teamId === teamId && entry.active ? entry.points : 0), 0); }
export function standings(teams: Team[], entries: ScoreEntry[]) { return teams.map(team => ({ ...team, score: teamScore(entries, team.id) })).sort((a, b) => b.score - a.score); }
// Every host action writes a deterministic id and updates in place, so repeated clicks,
// refreshes, and out-of-order corrections can never double-count.
function upsert(entries: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  return entries.some(e => e.id === entry.id) ? entries.map(e => e.id === entry.id ? { ...e, ...entry } : e) : [...entries, entry];
}
export function setRoundAward(entries: ScoreEntry[], segmentId: string, roundId: string, teamId: string, correct: boolean, points = DEFAULT_CORRECT_POINTS): ScoreEntry[] {
  return upsert(entries, { id: `${segmentId}:award-${roundId}`, teamId, segmentId, roundId, kind: 'round-award', points, active: correct });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/scoring.test.ts`
Expected: all scoring tests PASS.

`setRoundAward`'s only caller must be updated in this task, or the repo will not even typecheck the
activity. Make the one-line change now in `activities/childhood-vs-now/logic/rounds.ts:30`:

```ts
session.scoreEntries = setRoundAward(session.scoreEntries, session.segmentId, round.id, round.teamId, result === 'correct');
```

and add `segmentId: ID;` to the `Session` interface in `src/core/types.ts`, immediately after
`activityVersion`. Task 2 adds the companion `points` field; do not add it here.

Task 7 revisits this same line to spend `session.points.correct` and retract steals.

Then run `npx tsc -b`. Per the Global Constraints, `src/app/App.tsx` and `src/core/transfer.ts` are
expected to be red from here until Task 5 — they still reference the pre-segment session shape.
Errors in any other file are a real break: fix them before committing.

- [ ] **Step 6: Commit**

```bash
git add src/core/scoring.ts src/core/types.ts activities/childhood-vs-now/logic/rounds.ts tests/unit/scoring.test.ts
git commit -m "feat: scope the score ledger to segments"
```

---

### Task 2: Event model and segment view

**Files:**
- Create: `src/core/event.ts`
- Modify: `src/core/types.ts` (add `Segment`, `EventSession`, `segmentId` on `Session`, optional `Finale`, `estimatedMinutes`)
- Test: `tests/unit/event.test.ts`

**Interfaces:**
- Consumes: `ScoreEntry` from Task 1.
- Produces:
  - `Segment` and `EventSession` interfaces (see Step 3)
  - `createEvent(): EventSession`
  - `createSegment(activity: Activity): Segment`
  - `segmentView(event: EventSession, index: number): AnySession`
  - `foldSegmentView(event: EventSession, index: number, view: AnySession): void`
  - `currentSegment(event: EventSession): Segment | undefined`

`Session` keeps its current shape and becomes the *view* type activities consume. `EventSession` is
the new persisted document.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/event.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEvent, foldSegmentView, segmentView, type EventSession } from '../../src/core/event';
import type { AnySession, Segment } from '../../src/core/types';

const segment = (id: string, game: unknown): Segment => ({
  id, activityId: 'childhood-vs-now', activityVersion: 1, title: id,
  settings: { shuffle: true }, game, status: 'play', setupStepId: 'game', weight: 1,
});
const event = (): EventSession => ({
  ...createEvent(),
  segments: [segment('seg-a', { rounds: [{ id: 'r1' }] }), segment('seg-b', { rounds: [] })],
  currentSegmentIndex: 0,
  people: [{ id: 'p1', name: 'Asha', funFact: '', included: true, facePairId: 'f1' }],
});

function apply(source: EventSession, change: (view: AnySession) => void): EventSession {
  const next = structuredClone(source);
  const view = segmentView(next, next.currentSegmentIndex);
  change(view);
  foldSegmentView(next, next.currentSegmentIndex, view);
  return next;
}

describe('segment view', () => {
  it('projects the current segment onto the fields activities already read', () => {
    const view = segmentView(event(), 0);
    expect(view.activityId).toBe('childhood-vs-now');
    expect(view.phase).toBe('play');
    expect(view.setupStepId).toBe('game');
    expect(view.settings).toEqual({ shuffle: true });
    expect((view.game as { rounds: unknown[] }).rounds).toHaveLength(1);
    expect(view.segmentId).toBe('seg-a');
  });
  it('resolves the segment weight into the point values the activity awards', () => {
    const base = event();
    base.correctPoints = 2; base.stealPoints = 1; base.segments[0].weight = 3;
    expect(segmentView(base, 0).points).toEqual({ correct: 6, steal: 3 });
  });
  it('treats points as derived and never folds them back onto the segment', () => {
    const next = apply(event(), s => { s.points = { correct: 99, steal: 99 }; });
    expect(next.segments[0]).not.toHaveProperty('points');
    expect(next.correctPoints).toBe(2);
  });
  it('writes through in-place mutation of game state', () => {
    const next = apply(event(), s => { (s.game as { rounds: unknown[] }).rounds.push({ id: 'r2' }); });
    expect((next.segments[0].game as { rounds: unknown[] }).rounds).toHaveLength(2);
  });
  it('folds back whole-field assignment of game and settings', () => {
    const next = apply(event(), s => { s.game = { rounds: [] }; s.settings = { shuffle: false }; });
    expect(next.segments[0].game).toEqual({ rounds: [] });
    expect(next.segments[0].settings).toEqual({ shuffle: false });
  });
  it('folds back the Object.assign pattern the setup steps use', () => {
    const prepared = { ...segmentView(event(), 0), setupStepId: 'names', game: { rounds: [] }, people: [] };
    const next = apply(event(), s => { Object.assign(s, prepared); });
    expect(next.segments[0].setupStepId).toBe('names');
    expect(next.segments[0].game).toEqual({ rounds: [] });
    expect(next.people).toEqual([]);
  });
  it('maps phase onto segment status in both directions', () => {
    const next = apply(event(), s => { s.phase = 'finale'; });
    expect(next.segments[0].status).toBe('finale');
    expect(segmentView(next, 0).phase).toBe('finale');
  });
  it('sends shared fields to the event, not to the segment', () => {
    const next = apply(event(), s => {
      s.teams = [{ id: 't9', name: 'Nines', color: '#ffffff' }];
      s.scoreEntries = [{ id: 'e1', teamId: 't9', kind: 'manual-adjustment', points: 1, active: true }];
      s.people[0].name = 'Asha B';
    });
    expect(next.teams).toHaveLength(1);
    expect(next.scoreEntries).toHaveLength(1);
    expect(next.people[0].name).toBe('Asha B');
    expect(next.segments[0]).not.toHaveProperty('teams');
  });
  it('never leaks a write into another segment', () => {
    const next = apply(event(), s => { (s.game as { rounds: unknown[] }).rounds.push({ id: 'r2' }); });
    expect((next.segments[1].game as { rounds: unknown[] }).rounds).toHaveLength(0);
  });
});

describe('createEvent', () => {
  it('starts on the lineup with four teams and no segments', () => {
    const fresh = createEvent();
    expect(fresh.formatVersion).toBe(2);
    expect(fresh.phase).toBe('lineup');
    expect(fresh.segments).toEqual([]);
    expect(fresh.teams).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/event.test.ts`
Expected: FAIL with "Failed to resolve import ... src/core/event".

- [ ] **Step 3: Add the types**

In `src/core/types.ts`, add these two fields to `Session` (immediately after `activityVersion`) —
`segmentId` was added in Task 1, so only `points` is new here:

```ts
  segmentId: ID; points: { correct: number; steal: number };
```

`points` is where the segment's `weight` is resolved. The activity never multiplies anything: it
reads `session.points.correct` and the ledger records the final value, so re-clicking an award stays
idempotent and the ledger remains the single source of truth.

Then make `Finale` optional and add `estimatedMinutes` on `Activity`:

```ts
  Stage: ComponentType<ActivityContext<S, G>>; Finale?: ComponentType<ActivityContext<S, G>>;
  estimatedMinutes?: number;
```

Then append:

```ts
export interface Segment {
  id: ID; activityId: string; activityVersion: number; title: string;
  settings: unknown; game: unknown;
  status: 'pending' | 'setup' | 'play' | 'finale' | 'done';
  setupStepId: string; weight: number;
}
export interface EventWager { question: string; answer: string; bets: Record<ID, number> }
export interface EventSession {
  formatVersion: 2; id: ID; title: string; createdAt: string; updatedAt: string; isDemo: boolean;
  segments: Segment[]; currentSegmentIndex: number;
  phase: 'lineup' | 'segment' | 'interstitial' | 'wager' | 'finale';
  wager?: EventWager;
  correctPoints: number; stealPoints: number;
  people: Person[]; facePairs: FacePair[]; teams: Team[]; scoreEntries: ScoreEntry[];
  assets: Record<ID, Asset>;
}
```

- [ ] **Step 4: Create `src/core/event.ts`**

`teamColors` and `newTeams` move here from `session.ts`, because `session.ts` will import
`segmentView` from this file in Task 3 and the reverse import would be a cycle. Copy both
definitions verbatim out of `src/core/session.ts:5-6` and replace them there with
`export { newTeams, teamColors } from './event';`.

```ts
import type { Activity, AnySession, EventSession, Segment } from './types';
export const teamColors = ['#f7d873', '#eea7bb', '#8fcbe0', '#9edbbd', '#d2b5f2', '#f0b085', '#b8d685', '#c2c9ed'];
export const newTeams = () => ['Coffee Breakers', 'Reply-All Crew', 'Deadline Dodgers', 'Snack Drawer Squad'].map((name, i) => ({ id: crypto.randomUUID(), name, color: teamColors[i] }));
// Segment status and the phase activities read are the same vocabulary apart from
// 'pending' and 'done', which only the event itself ever sets.
const toPhase = (status: Segment['status']): AnySession['phase'] => status === 'pending' ? 'setup' : status === 'done' ? 'finale' : status;
export function createSegment(activity: Activity): Segment {
  return { id: crypto.randomUUID(), activityId: activity.id, activityVersion: activity.version, title: activity.name, settings: activity.defaultSettings(), game: activity.createInitialState(), status: 'pending', setupStepId: activity.setupSteps[0].id, weight: 1 };
}
export function createEvent(): EventSession {
  const now = new Date().toISOString();
  return { formatVersion: 2, id: crypto.randomUUID(), title: 'Our Fun Friday', createdAt: now, updatedAt: now, isDemo: false, segments: [], currentSegmentIndex: 0, phase: 'lineup', correctPoints: 2, stealPoints: 1, people: [], facePairs: [], teams: newTeams(), scoreEntries: [], assets: {} };
}
export const currentSegment = (event: EventSession) => event.segments[event.currentSegmentIndex];
// A shallow projection: shared arrays and the segment's game object are the SAME references the
// event holds, so in-place mutation writes through. foldSegmentView exists to catch whole-field
// assignment (s.game = ..., s.people = [...], Object.assign(s, prepared)).
export function segmentView(event: EventSession, index: number): AnySession {
  const segment = event.segments[index];
  if (!segment) throw new Error('This event has no activity at that position.');
  return {
    formatVersion: 1, id: event.id, title: event.title,
    segmentId: segment.id, activityId: segment.activityId, activityVersion: segment.activityVersion,
    points: { correct: event.correctPoints * segment.weight, steal: event.stealPoints * segment.weight },
    createdAt: event.createdAt, updatedAt: event.updatedAt, isDemo: event.isDemo,
    phase: toPhase(segment.status), setupStepId: segment.setupStepId,
    settings: segment.settings, game: segment.game,
    people: event.people, facePairs: event.facePairs, teams: event.teams,
    scoreEntries: event.scoreEntries, assets: event.assets,
  };
}
// `segmentId` and `points` are derived and deliberately NOT folded back: points is the segment
// weight already applied, and writing it back would let an activity edit the event's scoring rules.
export function foldSegmentView(event: EventSession, index: number, view: AnySession) {
  const segment = event.segments[index];
  if (!segment) throw new Error('This event has no activity at that position.');
  segment.settings = view.settings; segment.game = view.game; segment.setupStepId = view.setupStepId;
  // 'done' is terminal and event-owned: an activity writing 'setup' must never resurrect a
  // finished segment. 'pending' is a starting state, so a first fold legitimately advances it.
  if (segment.status !== 'done') segment.status = view.phase;
  event.people = view.people; event.facePairs = view.facePairs; event.teams = view.teams;
  event.scoreEntries = view.scoreEntries; event.assets = view.assets;
  event.isDemo = view.isDemo; event.title = view.title;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/event.test.ts && npx tsc -b`
Expected: all PASS, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/event.ts src/core/types.ts tests/unit/event.test.ts
git commit -m "feat: add the event model and the segment view activities read"
```

---

### Task 3: Session schema v2 and v1 migration

**Files:**
- Modify: `src/core/session.ts` (whole file)
- Create: `tests/fixtures/session-v1.json`
- Create: `tests/unit/migration.test.ts`

**Interfaces:**
- Consumes: `createEvent`, `segmentView` (Task 2); `Segment`, `EventSession` (Task 2).
- Produces:
  - `validateEvent(raw: unknown): EventSession` (replaces `validateSession`)
  - `migrateV1(raw: unknown): unknown` — shapes a v1 document into a v2 document before validation
  - `teamColors`, `newTeams` unchanged

- [ ] **Step 1: Create the v1 fixture**

Create `tests/fixtures/session-v1.json`. This is a minimal but *real* v1 document — one person, one
face pair, one played round, one score entry:

```json
{
  "formatVersion": 1,
  "id": "11111111-1111-4111-8111-111111111111",
  "title": "Our Fun Friday",
  "activityId": "childhood-vs-now",
  "activityVersion": 1,
  "createdAt": "2026-09-01T10:00:00.000Z",
  "updatedAt": "2026-09-01T11:00:00.000Z",
  "isDemo": false,
  "phase": "play",
  "setupStepId": "game",
  "people": [{ "id": "p1", "name": "Asha", "funFact": "Keeper of the snack drawer", "included": true, "facePairId": "f1" }],
  "facePairs": [{
    "id": "f1", "number": 1, "color": "#f7d873", "matchMethod": "manual", "reviewStatus": "confirmed",
    "now": { "sourceImageId": "img-now", "cropImageId": "img-now-crop", "faceBox": { "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2 }, "padding": { "top": 0.3, "right": 0.24, "bottom": 0.52, "left": 0.24 } },
    "then": { "sourceImageId": "img-then", "cropImageId": "img-then-crop", "faceBox": { "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2 }, "padding": { "top": 0.3, "right": 0.24, "bottom": 0.52, "left": 0.24 } }
  }],
  "teams": [{ "id": "t0", "name": "Coffee Breakers", "color": "#f7d873" }],
  "scoreEntries": [{ "id": "award-round-p1", "teamId": "t0", "roundId": "round-p1", "kind": "round-award", "points": 1, "active": true }],
  "settings": { "shuffle": true, "matchingTolerance": 0.12 },
  "game": {
    "originalImageId": "img-now", "childhoodImageId": "img-then", "childhoodUploadId": "img-then",
    "previews": {},
    "rounds": [{ "id": "round-p1", "personId": "p1", "teamId": "t0", "revealed": true, "result": "correct" }],
    "currentRoundIndex": 0,
    "finale": { "wipePosition": 0 }
  },
  "assets": {
    "img-now": { "id": "img-now", "name": "now.jpg", "width": 1200, "height": 800, "mime": "image/jpeg" },
    "img-then": { "id": "img-then", "name": "then.jpg", "width": 1200, "height": 800, "mime": "image/jpeg" },
    "img-now-crop": { "id": "img-now-crop", "name": "Face 1 - now.jpg", "width": 400, "height": 500, "mime": "image/jpeg" },
    "img-then-crop": { "id": "img-then-crop", "name": "Face 1 - then.jpg", "width": 400, "height": 500, "mime": "image/jpeg" }
  }
}
```

- [ ] **Step 2: Write the failing migration tests**

Create `tests/unit/migration.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import v1 from '../fixtures/session-v1.json';
import { discoverActivities } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });

describe('v1 to v2 migration', () => {
  it('wraps a v1 session as a single segment', () => {
    const event = validateEvent(v1);
    expect(event.formatVersion).toBe(2);
    expect(event.segments).toHaveLength(1);
    expect(event.segments[0].activityId).toBe('childhood-vs-now');
    expect(event.segments[0].settings).toEqual({ shuffle: true, matchingTolerance: 0.12 });
    expect((event.segments[0].game as { rounds: unknown[] }).rounds).toHaveLength(1);
    expect(event.currentSegmentIndex).toBe(0);
  });
  it('maps v1 play phase onto the segment and the event', () => {
    const event = validateEvent(v1);
    expect(event.segments[0].status).toBe('play');
    expect(event.phase).toBe('segment');
  });
  it('maps v1 finale onto a segment finale', () => {
    const event = validateEvent({ ...v1, phase: 'finale' });
    expect(event.segments[0].status).toBe('finale');
    expect(event.phase).toBe('segment');
  });
  it('keeps shared people, teams, scores and assets at the event level', () => {
    const event = validateEvent(v1);
    expect(event.people).toHaveLength(1);
    expect(event.teams).toHaveLength(1);
    expect(event.scoreEntries).toHaveLength(1);
    expect(Object.keys(event.assets)).toHaveLength(4);
  });
  it('carries a migrated event with no wager', () => {
    expect(validateEvent(v1).wager).toBeUndefined();
  });
  it('rejects a segment whose activity is not installed', () => {
    expect(() => validateEvent({ ...v1, activityId: 'not-real' })).toThrow(/not installed/);
  });
  it('rejects a score entry pointing at an unknown team', () => {
    const broken = { ...v1, scoreEntries: [{ ...v1.scoreEntries[0], teamId: 'ghost' }] };
    expect(() => validateEvent(broken)).toThrow(/unknown team/);
  });
});

describe('v2 round trip', () => {
  it('accepts its own output unchanged', () => {
    const once = validateEvent(v1);
    expect(validateEvent(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/migration.test.ts`
Expected: FAIL — `validateEvent` is not exported from `src/core/session`.

- [ ] **Step 4: Rewrite `src/core/session.ts`**

Keep `teamColors` and `newTeams` exactly as they are. Replace `createSession` and the schema:

```ts
import { z } from 'zod';
import { getActivity } from './registry';
import type { EventSession, Segment } from './types';
export const teamColors = ['#f7d873', '#eea7bb', '#8fcbe0', '#9edbbd', '#d2b5f2', '#f0b085', '#b8d685', '#c2c9ed'];
export const newTeams = () => ['Coffee Breakers', 'Reply-All Crew', 'Deadline Dodgers', 'Snack Drawer Squad'].map((name, i) => ({ id: crypto.randomUUID(), name, color: teamColors[i] }));
const rect = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine(r => r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001, 'Crop lies outside the image');
const crop = z.object({ sourceImageId: z.string(), faceBox: rect, padding: z.object({ top: z.number().min(0).max(3), right: z.number().min(0).max(3), bottom: z.number().min(0).max(3), left: z.number().min(0).max(3) }), cropImageId: z.string().optional() });
const segmentSchema = z.object({
  id: z.string(), activityId: z.string(), activityVersion: z.number().int().positive(), title: z.string(),
  settings: z.unknown(), game: z.unknown(),
  status: z.enum(['pending', 'setup', 'play', 'finale', 'done']), setupStepId: z.string(),
  weight: z.number().int().min(1).max(5),
});
const schema = z.object({
  formatVersion: z.literal(2), id: z.string(), title: z.string(), createdAt: z.string(), updatedAt: z.string(), isDemo: z.boolean(),
  segments: z.array(segmentSchema).max(12), currentSegmentIndex: z.number().int().min(0),
  phase: z.enum(['lineup', 'segment', 'interstitial', 'wager', 'finale']),
  wager: z.object({ question: z.string(), answer: z.string(), bets: z.record(z.string(), z.number().int().min(0)) }).optional(),
  correctPoints: z.number().int().min(1).max(10), stealPoints: z.number().int().min(0).max(10),
  people: z.array(z.object({ id: z.string(), name: z.string(), funFact: z.string(), included: z.boolean(), facePairId: z.string() })).max(500),
  facePairs: z.array(z.object({ id: z.string(), number: z.number().int().positive(), color: z.string(), now: crop.optional(), then: crop.optional(), matchMethod: z.enum(['automatic', 'manual']), reviewStatus: z.enum(['suggested', 'confirmed', 'unmatched']) })).max(1000),
  teams: z.array(z.object({ id: z.string(), name: z.string().min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i) })).min(1).max(8),
  scoreEntries: z.array(z.object({ id: z.string(), teamId: z.string(), segmentId: z.string().optional(), roundId: z.string().optional(), kind: z.enum(['round-award', 'steal-award', 'manual-adjustment', 'wager']), points: z.number().int(), active: z.boolean() })),
  assets: z.record(z.string(), z.object({ id: z.string(), name: z.string(), width: z.number().positive(), height: z.number().positive(), mime: z.string() })),
});
// A v1 document is one activity. Wrap it as a single segment so old sessions and old ZIPs keep
// opening; everything shared already sat at the top level and stays there.
export function migrateV1(raw: unknown): unknown {
  const v1 = raw as Record<string, any>;
  const segment = {
    id: crypto.randomUUID(), activityId: v1.activityId, activityVersion: v1.activityVersion,
    title: getActivity(v1.activityId)?.name ?? v1.activityId,
    settings: v1.settings, game: v1.game,
    status: v1.phase, setupStepId: v1.setupStepId, weight: 1,
  };
  const { activityId, activityVersion, settings, game, phase, setupStepId, ...shared } = v1;
  return { ...shared, formatVersion: 2, segments: [segment], currentSegmentIndex: 0, phase: 'segment', correctPoints: 2, stealPoints: 1 };
}
export function validateEvent(raw: unknown): EventSession {
  const version = (raw as { formatVersion?: unknown })?.formatVersion;
  if (version !== 1 && version !== 2) throw new Error('This session needs a newer version of Fun Friday Studio.');
  const event = schema.parse(version === 1 ? migrateV1(raw) : raw);
  const segments: Segment[] = event.segments.map(segment => {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`This session uses an activity that is not installed: ${segment.activityId}.`);
    if (segment.activityVersion > activity.version) throw new Error('This session needs a newer version of Fun Friday Studio.');
    const data = segment.activityVersion < activity.version ? activity.migrate(segment, segment.activityVersion) : segment;
    return { ...segment, activityVersion: activity.version, settings: activity.settingsSchema.parse(data.settings), game: activity.stateSchema.parse(data.game) };
  });
  const session: EventSession = { ...event, segments };
  if (session.segments.length && session.currentSegmentIndex >= session.segments.length) throw new Error('The event points at an activity that is not in its line-up.');
  for (const pair of session.facePairs) for (const face of [pair.now, pair.then]) {
    if (face && (!session.assets[face.sourceImageId] || (face.cropImageId && !session.assets[face.cropImageId]))) throw new Error('A face references a missing image in this session.');
  }
  if (session.people.some(p => !session.facePairs.some(f => f.id === p.facePairId))) throw new Error('A person references a missing face pair.');
  const ids = (items: { id: string }[]) => new Set(items.map(i => i.id)).size === items.length;
  if (![session.people, session.facePairs, session.teams, session.scoreEntries, session.segments].every(ids)) throw new Error('The session contains duplicate identifiers.');
  if (session.scoreEntries.some(e => !session.teams.some(t => t.id === e.teamId))) throw new Error('A score references an unknown team.');
  if (session.scoreEntries.some(e => e.segmentId && !session.segments.some(s => s.id === e.segmentId))) throw new Error('A score references an activity that is not in this event.');
  for (const [index, segment] of session.segments.entries()) {
    const issues = getActivity(segment.activityId)!.validateSession?.(segmentViewFor(session, index)) ?? [];
    if (issues.length) throw new Error(issues[0]);
  }
  return session;
}
```

`segmentViewFor` is `segmentView` from `src/core/event.ts`. Import it as:

```ts
import { segmentView as segmentViewFor } from './event';
```

`event.ts` imports `newTeams` from `session.ts` and `session.ts` imports `segmentView` from
`event.ts`. This is a cycle. Break it by moving `teamColors` and `newTeams` into `src/core/event.ts`
and re-exporting them from `session.ts` for the existing `TeamEditor` import:

In `src/core/event.ts` define `teamColors` and `newTeams` (moved verbatim from `session.ts`), and in
`src/core/session.ts` replace their definitions with:

```ts
export { newTeams, teamColors } from './event';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/migration.test.ts tests/unit/event.test.ts`
Expected: all PASS. `tsc -b` still fails on `App.tsx`/`transfer.ts` (they call the removed
`createSession`/`validateSession`) — that is expected and fixed in Tasks 4 and 5.

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/core/event.ts tests/fixtures/session-v1.json tests/unit/migration.test.ts
git commit -m "feat: validate and migrate v2 event documents"
```

---

### Task 4: ZIP transfer per segment

**Files:**
- Modify: `src/core/transfer.ts:38` (`exportSession`), `:41` (`importSession`), `:231` (`exportFacePairs` preview lookup)
- Test: `tests/unit/transfer-remap.test.ts` (create)

**Interfaces:**
- Consumes: `validateEvent` (Task 3), `segmentView` / `currentSegment` (Task 2).
- Produces: `exportSession(event: EventSession)`, `importSession(file: File): Promise<EventSession>` — same names, `EventSession` types.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer-remap.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import v1 from '../fixtures/session-v1.json';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';
import { remapEventImages } from '../../src/core/transfer';

beforeAll(async () => { await discoverActivities(); });

describe('per-segment image remapping', () => {
  it('rewrites every segment game and leaves user text alone', () => {
    const event = validateEvent(v1);
    event.segments.push({ ...event.segments[0], id: 'seg-b' });
    const remap = { 'img-now': 'new-now', 'img-then': 'new-then', 'img-now-crop': 'new-now-crop', 'img-then-crop': 'new-then-crop' };
    remapEventImages(event, remap);
    for (const segment of event.segments) {
      const game = segment.game as { originalImageId: string; childhoodImageId: string };
      expect(game.originalImageId).toBe('new-now');
      expect(game.childhoodImageId).toBe('new-then');
    }
    expect(event.people[0].funFact).toBe('Keeper of the snack drawer');
  });
  it('rewrites face crops on the shared face pairs exactly once', () => {
    const event = validateEvent(v1);
    remapEventImages(event, { 'img-now': 'a', 'img-then': 'b', 'img-now-crop': 'c', 'img-then-crop': 'd' });
    expect(event.facePairs[0].now!.sourceImageId).toBe('a');
    expect(event.facePairs[0].now!.cropImageId).toBe('c');
    expect(event.facePairs[0].then!.sourceImageId).toBe('b');
    expect(event.facePairs[0].then!.cropImageId).toBe('d');
  });
  it('throws when an activity in the line-up is not installed', () => {
    const event = validateEvent(v1);
    event.segments[0].activityId = 'not-real';
    expect(() => remapEventImages(event, {})).toThrow(/not installed/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/transfer-remap.test.ts`
Expected: FAIL — `remapEventImages` is not exported.

- [ ] **Step 3: Update `src/core/transfer.ts`**

Change the import line from `import { validateSession } from './session';` to
`import { validateEvent } from './session';`, and change `AnySession` to `EventSession` in the
`exportSession`, `importSession`, and `exportFacePairs` signatures.

Add the exported helper (note: face pairs are shared at the event level, so they are remapped once,
not per segment):

```ts
export function remapEventImages(event: EventSession, remap: Record<string, string>) {
  for (const pair of event.facePairs) for (const face of [pair.now, pair.then]) if (face) {
    face.sourceImageId = remap[face.sourceImageId] ?? face.sourceImageId;
    if (face.cropImageId) face.cropImageId = remap[face.cropImageId] ?? face.cropImageId;
  }
  for (const segment of event.segments) {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`This session uses an activity that is not installed: ${segment.activityId}.`);
    segment.game = activity.remapImages(segment.game, remap);
  }
}
```

Replace the body of `importSession` from the `// Stage every asset` comment to the `return` with:

```ts
  // Stage every asset under a fresh ID; an invalid import never overwrites active images.
  const remap: Record<string, string> = {};
  for (const [id, asset] of Object.entries(session.assets)) remap[id] = await imageStore.put(new Blob([files[`images/${id}`] as BlobPart], { type: asset.mime }));
  session.assets = Object.fromEntries(Object.entries(session.assets).map(([id, asset]) => [remap[id], { ...asset, id: remap[id] }]));
  remapEventImages(session, remap);
  return validateEvent(session);
```

and change `const session = validateSession(manifest);` to `const session = validateEvent(manifest);`.

In `exportFacePairs`, replace line 231:

```ts
  const previewIds = (currentSegment(session)?.game as { previews?: Record<string, string> } | undefined)?.previews ?? {};
```

importing `currentSegment` from `./event`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/transfer-remap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/transfer.ts tests/unit/transfer-remap.test.ts
git commit -m "feat: remap images per segment on session import"
```

---

### Task 5: Wire the app shell to segments

This task changes no behaviour a host can see. A one-segment event must behave exactly like today's
session. That is the point of the task — it is the regression checkpoint before any new screen lands.

**Files:**
- Modify: `src/app/App.tsx` (whole file)
- Modify: `src/main.tsx:23-30` (boot)
- Modify: `src/core/people/PeopleLibrary.tsx:30-33`
- Modify: `src/core/storage.ts:49` (`saveSession` type only)
- Test: `tests/browser/app.spec.ts` (existing suite must pass unchanged except the assertions listed below)

**Interfaces:**
- Consumes: `createEvent`, `createSegment`, `segmentView`, `foldSegmentView`, `currentSegment` (Task 2); `validateEvent` (Task 3).
- Produces: `App` takes `initialSession: EventSession`.

- [ ] **Step 1: Update boot in `src/main.tsx`**

Replace `createSession`/`validateSession` usage:

```ts
import { createEvent, createSegment } from './core/event';
import { validateEvent } from './core/session';
```

and in `boot()`:

```ts
  const saved = readSavedSession(); let session;
  if (saved) { try { session = validateEvent(saved); } catch { storageWarning('The saved session could not be restored. Import a session ZIP to recover it.'); } }
  if (!session) {
    const activity = getActivities()[0];
    session = createEvent(); session.segments = [createSegment(activity)]; session.phase = 'segment'; session.segments[0].status = 'setup';
    if (activity.createDemo) {
      try {
        const view = segmentView(session, 0);
        foldSegmentView(session, 0, await activity.createDemo(view));
      } catch (error) { storageWarning(`The demo could not load. You can still upload your own photos. ${(error as Error).message}`); }
    }
    saveSession(session);
  }
```

adding `segmentView, foldSegmentView` to the `./core/event` import.

- [ ] **Step 2: Update `App.tsx` state and context**

Change the signature and the derived values:

```ts
export function App({ initialSession }: { initialSession: EventSession }) {
  const [session, setSession] = useState(initialSession), sessionRef = useRef(initialSession);
  ...
  const segment = currentSegment(session);
  const activity = segment ? getActivity(segment.activityId) : undefined;
  const view = segment ? segmentView(session, session.currentSegmentIndex) : undefined;
```

Replace `update` so it runs the change against a view and folds it back:

```ts
  const update = useCallback<ActivityContext['update']>(change => {
    try {
      const next = structuredClone(sessionRef.current);
      const index = next.currentSegmentIndex;
      const draft = segmentView(next, index);
      change(draft);
      foldSegmentView(next, index, draft);
      install(next);
    } catch (error) { notify(error instanceof Error ? error.message : 'This change could not be applied.'); }
  }, [install, notify]);
```

Add a second updater for event-level changes (lineup, phase, wager), which does not go through a view:

```ts
  const updateEvent = useCallback((change: (draft: EventSession) => void) => {
    try { const next = structuredClone(sessionRef.current); change(next); install(next); }
    catch (error) { notify(error instanceof Error ? error.message : 'This change could not be applied.'); }
  }, [install, notify]);
```

Build the context from the view:

```ts
  const context: ActivityContext | undefined = view && { session: view, update, notify, runTask, goHome: () => setRoute('home') };
```

- [ ] **Step 3: Update the routing conditions**

Every `session.phase === 'setup' | 'play' | 'finale'` becomes a segment-status check. Replace:

```ts
  const [route, setRoute] = useState<'home' | 'session' | 'people'>(initialSession.phase === 'lineup' || currentSegment(initialSession)?.status === 'setup' ? 'home' : 'session');
  ...
  useEffect(() => { window.scrollTo(0, 0); }, [route, session.phase, segment?.status, segment?.setupStepId]);
  useShortcuts(activity, context, !!activity && !!context && route === 'session' && segment?.status === 'play' && !busy);
  ...
  const isStage = route === 'session' && session.phase === 'segment' && segment?.status !== 'setup';
```

and the render lines:

```ts
    {route === 'session' && session.phase === 'segment' && segment?.status === 'setup' && activity && context && <>…<currentStep.View {...context}/></>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'play' && activity && context && <activity.Stage {...context}/>}
    {route === 'session' && session.phase === 'segment' && segment?.status === 'finale' && activity && context && (activity.Finale ? <activity.Finale {...context}/> : null)}
```

`useShortcuts` must tolerate an undefined activity; change its guard in `src/core/projector.ts`:

```ts
export function useShortcuts(activity: Activity | undefined, context: ActivityContext | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !activity || !context) return;
```

- [ ] **Step 4: Update `beginSetup` and `demo`**

```ts
  const beginSetup = (chosen: Activity) => {
    const existing = currentSegment(session);
    if (!existing || existing.activityId !== chosen.id) updateEvent(s => { s.segments = [createSegment(chosen)]; s.currentSegmentIndex = 0; s.phase = 'segment'; s.segments[0].status = 'setup'; s.scoreEntries = []; });
    else if (existing.status !== 'setup') { if (!window.confirm('Return to setup? Starting a new game later will reset the scores.')) return; updateEvent(s => { s.segments[s.currentSegmentIndex].status = 'setup'; }); }
    setRoute('session');
  };
  const demo = (chosen: Activity) => void runTask('Drawing a little Friday nostalgia…', async () => {
    if (!session.isDemo && !window.confirm('Try a new demo session? Export your current session first if you want to keep it.')) return;
    if (!chosen.createDemo) throw new Error('This activity does not include a demo.');
    const next = createEvent(); next.segments = [createSegment(chosen)]; next.phase = 'segment';
    const prepared = await chosen.createDemo(segmentView(next, 0));
    chosen.startNewGame(prepared);
    foldSegmentView(next, 0, prepared);
    install(next); setRoute('session');
  });
```

- [ ] **Step 5: Update `PeopleLibrary.tsx`**

Lines 30–33 set `s.phase = 'setup'` on what is now a view, which the fold-back maps to segment
status. That already works. Leave the file unchanged unless `tsc` complains; if it does, the fix is
that `s.scoreEntries = []` and `s.phase`/`s.setupStepId` all exist on the view type.

- [ ] **Step 6: Update `saveSession` typing**

In `src/core/storage.ts`, change `import type { AnySession } from './types';` to
`import type { EventSession } from './types';` and `saveSession(session: AnySession)` to
`saveSession(session: EventSession)`.

- [ ] **Step 7: Update the two browser assertions that read moved fields**

In `tests/browser/app.spec.ts`, the session document is now an event. Change:

- line 12: `session.game.rounds` → `session.segments[0].game.rounds`
- lines 58–59: `imported.phase` → `imported.segments[0].status`, `imported.setupStepId` → `imported.segments[0].setupStepId`
- lines 171–174: `session.game.*` → `session.segments[0].game.*`
- line 14: expected total `1` → `2`

- [ ] **Step 8: Run the full suite**

Run: `npm test && npx tsc -b && npm run build && npx playwright test`
Expected: all unit tests PASS, `tsc` clean, build succeeds, all existing browser tests PASS.
A one-segment event behaves exactly like today's session.

- [ ] **Step 9: Commit**

```bash
git add src/app/App.tsx src/main.tsx src/core/storage.ts src/core/projector.ts tests/browser/app.spec.ts
git commit -m "feat: run the app shell against event segments"
```

---

### Task 6: Countdown timer primitive

**Files:**
- Create: `src/core/play/timer.ts`, `src/core/play/Timer.tsx`
- Modify: `src/theme/styles.css`
- Test: `tests/unit/play.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface TimerState { durationMs: number; deadlineAt?: number; pausedRemainingMs?: number }`
  - `startTimer(state: TimerState, now: number): TimerState`
  - `pauseTimer(state: TimerState, now: number): TimerState`
  - `resetTimer(state: TimerState): TimerState`
  - `remainingMs(state: TimerState, now: number): number`
  - `useCountdown(state: TimerState): number` — re-renders about 10×/second, returns remaining ms
  - `<Timer state onChange label />` — display plus host controls

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/play.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pauseTimer, remainingMs, resetTimer, startTimer, type TimerState } from '../../src/core/play/timer';

const fresh: TimerState = { durationMs: 60_000 };

describe('countdown timer state', () => {
  it('persists a deadline rather than a tick', () => {
    const started = startTimer(fresh, 1_000);
    expect(started.deadlineAt).toBe(61_000);
    expect(started).not.toHaveProperty('elapsedMs');
  });
  it('reports the remaining time from the deadline so a refresh restores it', () => {
    const started = startTimer(fresh, 1_000);
    expect(remainingMs(started, 21_000)).toBe(40_000);
  });
  it('never reports below zero', () => {
    expect(remainingMs(startTimer(fresh, 0), 90_000)).toBe(0);
  });
  it('holds the remaining time across a pause and resumes from it', () => {
    const paused = pauseTimer(startTimer(fresh, 0), 20_000);
    expect(paused.pausedRemainingMs).toBe(40_000);
    expect(paused.deadlineAt).toBeUndefined();
    expect(remainingMs(paused, 999_000)).toBe(40_000);
    const resumed = startTimer(paused, 100_000);
    expect(remainingMs(resumed, 100_000)).toBe(40_000);
    expect(remainingMs(resumed, 110_000)).toBe(30_000);
  });
  it('reports the full duration before it is started', () => {
    expect(remainingMs(fresh, 5_000)).toBe(60_000);
  });
  it('returns to the full duration on reset', () => {
    const reset = resetTimer(pauseTimer(startTimer(fresh, 0), 20_000));
    expect(remainingMs(reset, 50_000)).toBe(60_000);
    expect(reset.deadlineAt).toBeUndefined();
    expect(reset.pausedRemainingMs).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/play.test.ts`
Expected: FAIL — cannot resolve `src/core/play/timer`.

- [ ] **Step 3: Create `src/core/play/timer.ts`**

```ts
import { useEffect, useState } from 'react';
// Only the deadline is persisted. App.update writes to localStorage on every change, so storing a
// tick would write once a second for the whole event; storing the deadline also makes a mid-round
// refresh restore the true remaining time instead of restarting the round.
export interface TimerState { durationMs: number; deadlineAt?: number; pausedRemainingMs?: number }
export function remainingMs(state: TimerState, now: number) {
  if (state.deadlineAt !== undefined) return Math.max(0, state.deadlineAt - now);
  return state.pausedRemainingMs ?? state.durationMs;
}
export function startTimer(state: TimerState, now: number): TimerState {
  return { durationMs: state.durationMs, deadlineAt: now + remainingMs(state, now) };
}
export function pauseTimer(state: TimerState, now: number): TimerState {
  return { durationMs: state.durationMs, pausedRemainingMs: remainingMs(state, now) };
}
export function resetTimer(state: TimerState): TimerState { return { durationMs: state.durationMs }; }
export const isRunning = (state: TimerState) => state.deadlineAt !== undefined;
export function useCountdown(state: TimerState) {
  const [remaining, setRemaining] = useState(() => remainingMs(state, Date.now()));
  useEffect(() => {
    setRemaining(remainingMs(state, Date.now()));
    if (state.deadlineAt === undefined) return;
    const id = setInterval(() => setRemaining(remainingMs(state, Date.now())), 100);
    return () => clearInterval(id);
  }, [state.deadlineAt, state.pausedRemainingMs, state.durationMs]);
  return remaining;
}
```

- [ ] **Step 4: Create `src/core/play/Timer.tsx`**

The cue is generated, not loaded, so no audio asset is added and offline still holds. `AudioContext`
is created lazily inside the click handler chain because browsers block it before a gesture.

```tsx
import { useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { isRunning, pauseTimer, remainingMs, resetTimer, startTimer, useCountdown, type TimerState } from './timer';
let audio: AudioContext | undefined;
function beep(frequency: number) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.frequency.value = frequency; oscillator.type = 'sine';
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.2, audio.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .18);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .2);
  } catch { /* Audio is a flourish; a blocked context must never break the round. */ }
}
export function Timer({ state, onChange, label = 'Round timer' }: { state: TimerState; onChange: (next: TimerState) => void; label?: string }) {
  const remaining = useCountdown(state), seconds = Math.ceil(remaining / 1000), running = isRunning(state);
  const lastBeep = useRef<number>();
  useEffect(() => {
    if (!running || seconds > 5 || seconds < 0 || lastBeep.current === seconds) return;
    lastBeep.current = seconds; beep(seconds === 0 ? 420 : 880);
  }, [running, seconds]);
  useEffect(() => { if (!running) lastBeep.current = undefined; }, [running]);
  return <div className={`play-timer ${running ? 'running' : ''} ${seconds <= 5 && running ? 'urgent' : ''}`} role="timer" aria-label={label}>
    <strong aria-live="off">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>
    <div className="play-timer-controls">
      <button className="icon-button" aria-label={running ? 'Pause the timer' : 'Start the timer'} onClick={() => onChange(running ? pauseTimer(state, Date.now()) : startTimer(state, Date.now()))}>{running ? <Pause size={18}/> : <Play size={18}/>}</button>
      <button className="icon-button" aria-label="Reset the timer" disabled={remainingMs(state, Date.now()) === state.durationMs && !running} onClick={() => onChange(resetTimer(state))}><RotateCcw size={17}/></button>
    </div>
  </div>;
}
```

- [ ] **Step 5: Add the styles**

Append to `src/theme/styles.css`, using existing theme variables:

```css
.play-timer { display: flex; align-items: center; gap: var(--space-3); }
.play-timer strong { font-family: var(--font-display); font-size: clamp(2.4rem, 6vw, 4.4rem); font-variant-numeric: tabular-nums; line-height: 1; }
.play-timer.urgent strong { color: var(--color-warning); animation: timer-pulse .5s ease-in-out infinite alternate; }
.play-timer-controls { display: flex; gap: var(--space-1); }
@keyframes timer-pulse { to { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .play-timer.urgent strong { animation: none; } }
```

Check the exact variable names in `src/theme/styles.css` before writing this and substitute the real
ones — this codebase defines its own tokens and they must not be invented.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/play.test.ts && npx tsc -b`
Expected: PASS, `tsc` clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/play/timer.ts src/core/play/Timer.tsx src/theme/styles.css tests/unit/play.test.ts
git commit -m "feat: add a shared countdown timer that survives a refresh"
```

---

### Task 7: Steal on a miss

**Files:**
- Create: `src/core/play/steal.ts`, `src/core/play/StealPanel.tsx`
- Modify: `activities/childhood-vs-now/logic/rounds.ts`, `activities/childhood-vs-now/stage/Stage.tsx`, `activities/childhood-vs-now/activity.ts`, `src/theme/styles.css`
- Test: `tests/unit/play.test.ts` (extend)

**Interfaces:**
- Consumes: `setRoundAward`, `DEFAULT_STEAL_POINTS` (Task 1).
- Produces:
  - `setStealAward(entries: ScoreEntry[], segmentId: string, roundId: string, ownerTeamId: string, stealingTeamId: string | null, points?: number): ScoreEntry[]`
  - `retractSteal(entries: ScoreEntry[], segmentId: string, roundId: string): ScoreEntry[]`
  - `stealTeamId(entries: ScoreEntry[], segmentId: string, roundId: string): string | undefined`
  - `<StealPanel teams roundId segmentId ownerTeamId entries onChange points />`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/play.test.ts`:

```ts
import { retractSteal, setStealAward, stealTeamId } from '../../src/core/play/steal';
import { setRoundAward, teamScore } from '../../src/core/scoring';
import type { ScoreEntry } from '../../src/core/types';

describe('steal on a miss', () => {
  const missed = () => setRoundAward([], 'seg-a', 'r1', 't0', false);
  it('awards the stealing team one point', () => {
    const entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    expect(teamScore(entries, 't1')).toBe(1);
    expect(teamScore(entries, 't0')).toBe(0);
  });
  it('moves a steal between teams without duplicating it', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = setStealAward(entries, 'seg-a', 'r1', 't0', 't2');
    expect(teamScore(entries, 't1')).toBe(0);
    expect(teamScore(entries, 't2')).toBe(1);
    expect(entries.filter(e => e.kind === 'steal-award')).toHaveLength(1);
  });
  it('refuses to award a steal to the owning team', () => {
    expect(() => setStealAward(missed(), 'seg-a', 'r1', 't0', 't0')).toThrow(/own round/);
  });
  it('clears a steal when the host passes null', () => {
    const entries = setStealAward(setStealAward(missed(), 'seg-a', 'r1', 't0', 't1'), 'seg-a', 'r1', 't0', null);
    expect(teamScore(entries, 't1')).toBe(0);
    expect(stealTeamId(entries, 'seg-a', 'r1')).toBeUndefined();
  });
  it('retracts the steal when the owner is flipped back to correct', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = retractSteal(setRoundAward(entries, 'seg-a', 'r1', 't0', true), 'seg-a', 'r1');
    expect(teamScore(entries, 't0')).toBe(2);
    expect(teamScore(entries, 't1')).toBe(0);
  });
  it('reports which team holds the steal', () => {
    expect(stealTeamId(setStealAward(missed(), 'seg-a', 'r1', 't0', 't3'), 'seg-a', 'r1')).toBe('t3');
    expect(stealTeamId(missed(), 'seg-a', 'r1')).toBeUndefined();
  });
  it('keeps steals in different segments independent', () => {
    let entries = setStealAward(missed(), 'seg-a', 'r1', 't0', 't1');
    entries = setStealAward(entries, 'seg-b', 'r1', 't0', 't2');
    expect(teamScore(entries, 't1')).toBe(1);
    expect(teamScore(entries, 't2')).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/play.test.ts`
Expected: FAIL — cannot resolve `src/core/play/steal`.

- [ ] **Step 3: Create `src/core/play/steal.ts`**

```ts
import { DEFAULT_STEAL_POINTS } from '../scoring';
import type { ScoreEntry } from '../types';
const stealId = (segmentId: string, roundId: string) => `${segmentId}:steal-${roundId}`;
export function stealTeamId(entries: ScoreEntry[], segmentId: string, roundId: string) {
  const entry = entries.find(e => e.id === stealId(segmentId, roundId));
  return entry?.active ? entry.teamId : undefined;
}
export function setStealAward(entries: ScoreEntry[], segmentId: string, roundId: string, ownerTeamId: string, stealingTeamId: string | null, points = DEFAULT_STEAL_POINTS): ScoreEntry[] {
  if (stealingTeamId === ownerTeamId) throw new Error('A team cannot steal its own round.');
  const id = stealId(segmentId, roundId);
  const next: ScoreEntry = { id, teamId: stealingTeamId ?? ownerTeamId, segmentId, roundId, kind: 'steal-award', points, active: stealingTeamId !== null };
  return entries.some(e => e.id === id) ? entries.map(e => e.id === id ? next : e) : [...entries, next];
}
// A steal only exists because the owning team missed. If the host corrects the owner to Correct,
// the steal must go with it, or the round pays out twice.
export function retractSteal(entries: ScoreEntry[], segmentId: string, roundId: string): ScoreEntry[] {
  return entries.map(e => e.id === stealId(segmentId, roundId) ? { ...e, active: false } : e);
}
```

- [ ] **Step 4: Wire it into the activity's round logic**

In `activities/childhood-vs-now/logic/rounds.ts`, replace `markResult` and add `markSteal`:

```ts
export function markResult(session: CVSession, result: 'correct' | 'missed') {
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed) return;
  round.result = result;
  session.scoreEntries = setRoundAward(session.scoreEntries, session.segmentId, round.id, round.teamId, result === 'correct', session.points.correct);
  if (result === 'correct') session.scoreEntries = retractSteal(session.scoreEntries, session.segmentId, round.id);
}
export function markSteal(session: CVSession, teamId: string | null) {
  const round = session.game.rounds[session.game.currentRoundIndex];
  if (!round?.revealed || round.result !== 'missed') return;
  session.scoreEntries = setStealAward(session.scoreEntries, session.segmentId, round.id, round.teamId, teamId, session.points.steal);
}
```

`session.points` carries the segment weight already applied, so a `weight: 2` segment awards 4 and 2
without the activity knowing weights exist.

with `import { retractSteal, setStealAward } from '../../../src/core/play/steal';`.

- [ ] **Step 5: Create `src/core/play/StealPanel.tsx`**

```tsx
import { Zap } from 'lucide-react';
import type { ScoreEntry, Team } from '../types';
import { stealTeamId } from './steal';
export function StealPanel({ teams, ownerTeamId, segmentId, roundId, entries, onSteal, points }: { teams: Team[]; ownerTeamId: string; segmentId: string; roundId: string; entries: ScoreEntry[]; onSteal: (teamId: string | null) => void; points: number }) {
  const holder = stealTeamId(entries, segmentId, roundId), others = teams.filter(t => t.id !== ownerTeamId);
  if (!others.length) return null;
  return <div className="steal-panel"><div className="steal-heading"><Zap size={17}/><span className="eyebrow">UP FOR GRABS</span><small>Anyone else? <b>+{points}</b></small></div>
    <div className="steal-teams">{others.map(team => <button key={team.id} className={`button small-button ${holder === team.id ? 'primary' : 'secondary'}`} aria-pressed={holder === team.id} style={{ '--team-color': team.color } as React.CSSProperties} onClick={() => onSteal(holder === team.id ? null : team.id)}>{team.name}</button>)}
    {holder && <button className="button subtle small-button" onClick={() => onSteal(null)}>Nobody got it</button>}</div>
  </div>;
}
```

- [ ] **Step 6: Show it in the stage**

In `activities/childhood-vs-now/stage/Stage.tsx`, import `StealPanel` and `markSteal`, change the
point-stake block from `<b>1</b>` to `<b>{session.points.correct}</b>`, and render the panel after
the result buttons, inside the `round.revealed` branch:

```tsx
{round.result === 'missed' && <StealPanel teams={session.teams} ownerTeamId={team.id} segmentId={session.segmentId} roundId={round.id} entries={session.scoreEntries} points={session.points.steal} onSteal={id => update(s => markSteal(s, id))}/>}
```

Change the Correct button label from `<b>+1</b>` to `<b>+{session.points.correct}</b>`.

- [ ] **Step 7: Update the shortcut label**

In `activities/childhood-vs-now/activity.ts`, change the `c` shortcut label from `'Correct +1'` to
`'Correct'`. The exact value now depends on the segment weight, so the label must not state a number.

Do **not** add a steal keyboard shortcut. `M` already opens the steal (the panel appears whenever the
round result is `missed`), and awarding a steal requires naming a team, which a single key cannot do.

- [ ] **Step 8: Add the styles**

Append to `src/theme/styles.css`:

```css
.steal-panel { display: flex; flex-direction: column; gap: var(--space-2); align-items: center; margin-top: var(--space-3); }
.steal-heading { display: flex; align-items: center; gap: var(--space-2); }
.steal-teams { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
```

Substitute the real token names from `src/theme/styles.css`.

- [ ] **Step 9: Run the tests**

Run: `npm test && npx tsc -b`
Expected: PASS, `tsc` clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/play/steal.ts src/core/play/StealPanel.tsx activities/childhood-vs-now src/theme/styles.css tests/unit/play.test.ts
git commit -m "feat: let other teams steal a missed round"
```

---

### Task 8: Lineup builder

**Files:**
- Create: `src/app/Lineup.tsx`, `src/app/lineup-logic.ts`
- Modify: `src/app/App.tsx`, `src/app/Home.tsx`, `src/theme/styles.css`
- Test: `tests/unit/lineup.test.ts` (create)

**Interfaces:**
- Consumes: `createSegment`, `EventSession` (Task 2); `updateEvent` (Task 5).
- Produces:
  - `lineupIssues(event: EventSession): string[]`
  - `estimatedMinutes(event: EventSession): number`
  - `<Lineup event onChange onStart />` — `onChange` takes the same `(draft: EventSession) => void`
    callback shape as `updateEvent` from Task 5

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lineup.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createEvent, createSegment } from '../../src/core/event';
import { discoverActivities, getActivities } from '../../src/core/registry';
import { estimatedMinutes, lineupIssues } from '../../src/app/lineup-logic';

beforeAll(async () => { await discoverActivities(); });

describe('line-up validation', () => {
  it('requires at least one activity', () => {
    expect(lineupIssues(createEvent())).toContain('Add at least one activity to your line-up.');
  });
  it('requires every team to be named', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    event.teams[0].name = '  ';
    expect(lineupIssues(event)).toContain('Every team needs a name.');
  });
  it('requires an answer when a wager question is written', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    event.wager = { question: 'How many biscuits?', answer: '', bets: {} };
    expect(lineupIssues(event)).toContain('Give the final wager an answer, or clear the question.');
  });
  it('accepts a complete line-up', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    expect(lineupIssues(event)).toEqual([]);
  });
  it('estimates runtime from the activities plus the standings beats', () => {
    const event = createEvent();
    const activity = getActivities()[0];
    event.segments = [createSegment(activity), createSegment(activity)];
    expect(estimatedMinutes(event)).toBe((activity.estimatedMinutes ?? 15) * 2 + 2 * 2);
  });
  it('adds the wager to the estimate only when one is set', () => {
    const event = createEvent();
    event.segments = [createSegment(getActivities()[0])];
    const without = estimatedMinutes(event);
    event.wager = { question: 'Q', answer: 'A', bets: {} };
    expect(estimatedMinutes(event)).toBe(without + 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/lineup.test.ts`
Expected: FAIL — cannot resolve `src/app/lineup-logic`.

- [ ] **Step 3: Create `src/app/lineup-logic.ts`**

Logic lives beside the screen but in its own file so it is unit-testable without rendering React.

```ts
import { getActivity } from '../core/registry';
import type { EventSession } from '../core/types';
const DEFAULT_ACTIVITY_MINUTES = 15;
const INTERSTITIAL_MINUTES = 2;
const WAGER_MINUTES = 10;
export function lineupIssues(event: EventSession): string[] {
  const issues: string[] = [];
  if (!event.segments.length) issues.push('Add at least one activity to your line-up.');
  if (event.segments.some(s => !getActivity(s.activityId))) issues.push('One activity in your line-up is not installed.');
  if (event.teams.some(t => !t.name.trim())) issues.push('Every team needs a name.');
  if (event.wager?.question.trim() && !event.wager.answer.trim()) issues.push('Give the final wager an answer, or clear the question.');
  return issues;
}
export function estimatedMinutes(event: EventSession): number {
  const activities = event.segments.reduce((total, segment) => total + (getActivity(segment.activityId)?.estimatedMinutes ?? DEFAULT_ACTIVITY_MINUTES), 0);
  return activities + event.segments.length * INTERSTITIAL_MINUTES + (event.wager?.question.trim() ? WAGER_MINUTES : 0);
}
```

- [ ] **Step 4: Create `src/app/Lineup.tsx`**

```tsx
import { ArrowDown, ArrowUp, Clock, Play, Plus, Trophy, X } from 'lucide-react';
import { createSegment } from '../core/event';
import { getActivities } from '../core/registry';
import { TeamEditor } from '../core/teams/TeamEditor';
import type { EventSession } from '../core/types';
import { estimatedMinutes, lineupIssues } from './lineup-logic';
export function Lineup({ event, onChange, onStart }: { event: EventSession; onChange: (change: (draft: EventSession) => void) => void; onStart: () => void }) {
  const issues = lineupIssues(event), minutes = estimatedMinutes(event);
  const move = (index: number, delta: number) => onChange(s => { const to = index + delta; if (to < 0 || to >= s.segments.length) return; [s.segments[index], s.segments[to]] = [s.segments[to], s.segments[index]]; });
  return <main className="lineup-page">
    <div className="section-heading"><span className="eyebrow">THE RUNNING ORDER</span><h1>Build your Friday<span className="accent">.</span></h1><p>Pick your activities. One set of teams, one leaderboard, one winner.</p></div>
    <div className="lineup-grid">
      <section className="panel"><div className="panel-heading"><Clock size={21}/><h2>Your line-up</h2><span className="pill">{minutes} min</span></div>
        {!event.segments.length && <p className="muted">Nothing here yet. Add an activity to get started.</p>}
        <ol className="lineup-list">{event.segments.map((segment, i) => <li key={segment.id}>
          <span className="step-badge yellow">{i + 1}</span>
          <input aria-label={`Name for activity ${i + 1}`} maxLength={60} value={segment.title} onChange={e => onChange(s => { s.segments[i].title = e.target.value; })}/>
          <label className="lineup-weight">Points ×<select aria-label={`Points multiplier for activity ${i + 1}`} value={segment.weight} onChange={e => onChange(s => { s.segments[i].weight = +e.target.value; })}>{[1, 2, 3].map(w => <option key={w} value={w}>{w}</option>)}</select></label>
          <button className="icon-button" aria-label={`Move activity ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={17}/></button>
          <button className="icon-button" aria-label={`Move activity ${i + 1} later`} disabled={i === event.segments.length - 1} onClick={() => move(i, 1)}><ArrowDown size={17}/></button>
          <button className="icon-button danger" aria-label={`Remove activity ${i + 1}`} onClick={() => onChange(s => { s.segments.splice(i, 1); if (s.currentSegmentIndex >= s.segments.length) s.currentSegmentIndex = Math.max(0, s.segments.length - 1); })}><X size={17}/></button>
        </li>)}</ol>
        <div className="lineup-add">{getActivities().map(activity => <button key={activity.id} className="button subtle" disabled={event.segments.length >= 12} onClick={() => onChange(s => { s.segments.push(createSegment(activity)); })}><Plus size={16}/> {activity.name}</button>)}</div>
      </section>
      <section className="panel"><div className="panel-heading"><Trophy size={21}/><h2>The teams</h2></div><TeamEditor teams={event.teams} onChange={teams => onChange(s => { s.teams = teams; })}/>
        <div className="panel-heading wager-heading"><h2>The final wager</h2></div><p className="muted">Optional. Teams bet their points on one last question. Leave it blank to skip it.</p>
        <input aria-label="Final wager question" placeholder="One last question…" maxLength={240} value={event.wager?.question ?? ''} onChange={e => onChange(s => { s.wager = { question: e.target.value, answer: s.wager?.answer ?? '', bets: s.wager?.bets ?? {} }; })}/>
        <input aria-label="Final wager answer" placeholder="The answer" maxLength={240} value={event.wager?.answer ?? ''} onChange={e => onChange(s => { s.wager = { question: s.wager?.question ?? '', answer: e.target.value, bets: s.wager?.bets ?? {} }; })}/>
      </section>
    </div>
    <div className="setup-footer">{issues.map(issue => <p className="warning-text" key={issue}>{issue}</p>)}<button className="button primary large" disabled={issues.length > 0} onClick={onStart}><Play size={20}/> Start the event</button></div>
  </main>;
}
```

- [ ] **Step 5: Route it in `App.tsx`**

Add `'lineup'` handling. When `session.phase === 'lineup'` and `route === 'session'`, render:

```tsx
    {route === 'session' && session.phase === 'lineup' && <Lineup event={session} onChange={updateEvent} onStart={() => updateEvent(s => { s.phase = 'segment'; s.currentSegmentIndex = 0; s.segments[0].status = 'setup'; })}/>}
```

In `Home.tsx`, add a build-an-event button to the activity section header and pass a new
`onBuildEvent` prop wired to `() => { updateEvent(s => { s.phase = 'lineup'; }); setRoute('session'); }`:

```tsx
<button className="button primary" onClick={onBuildEvent}>Build an event <ArrowUpRight size={19}/></button>
```

Also change the activity card tag `<span>1 point per guess</span>` to `<span>2 points per guess</span>`.

- [ ] **Step 6: Add the styles**

```css
.lineup-page { display: flex; flex-direction: column; gap: var(--space-5); }
.lineup-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--space-4); }
.lineup-list { display: flex; flex-direction: column; gap: var(--space-2); list-style: none; padding: 0; }
.lineup-list li { display: flex; align-items: center; gap: var(--space-2); }
.lineup-list input { flex: 1; min-width: 0; }
.lineup-add { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
@media (max-width: 900px) { .lineup-grid { grid-template-columns: 1fr; } }
```

Substitute the real token names.

- [ ] **Step 7: Run the tests**

Run: `npm test && npx tsc -b && npm run build`
Expected: PASS, clean, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/app/Lineup.tsx src/app/lineup-logic.ts src/app/App.tsx src/app/Home.tsx src/theme/styles.css tests/unit/lineup.test.ts
git commit -m "feat: add the event line-up builder"
```

---

### Task 9: Interstitial standings and event finale

**Files:**
- Create: `src/app/Interstitial.tsx`, `src/app/EventFinale.tsx`, `src/app/standings-logic.ts`
- Modify: `src/app/App.tsx`, `src/theme/styles.css`
- Test: `tests/unit/standings.test.ts` (create)

**Interfaces:**
- Consumes: `standings`, `segmentScore` (Task 1); `EventSession` (Task 2).
- Produces:
  - `segmentStandings(event: EventSession, segmentId: string): { id: string; name: string; color: string; total: number; gained: number }[]`
  - `advanceSegment(event: EventSession): void` — closes the current segment and moves to the next phase
  - `<Interstitial event onContinue />`, `<EventFinale event onRestart onHome />`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/standings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEvent } from '../../src/core/event';
import { setRoundAward } from '../../src/core/scoring';
import { advanceSegment, segmentStandings } from '../../src/app/standings-logic';
import type { EventSession, Segment } from '../../src/core/types';

const segment = (id: string, status: Segment['status'] = 'play'): Segment => ({ id, activityId: 'childhood-vs-now', activityVersion: 1, title: id, settings: {}, game: {}, status, setupStepId: 'game', weight: 1 });
function event(): EventSession {
  const base = createEvent();
  base.teams = [{ id: 't0', name: 'A', color: '#ffffff' }, { id: 't1', name: 'B', color: '#000000' }];
  base.segments = [segment('seg-a'), segment('seg-b', 'pending')];
  let entries = setRoundAward([], 'seg-a', 'r1', 't0', true);   // t0 +2
  entries = setRoundAward(entries, 'seg-a', 'r2', 't1', true);  // t1 +2
  base.scoreEntries = entries;
  return base;
}

describe('segment standings', () => {
  it('reports the running total and what each team gained this activity', () => {
    const base = event();
    base.scoreEntries = setRoundAward(base.scoreEntries, 'seg-a', 'r3', 't0', true); // t0 +2, now 4
    base.scoreEntries.push({ id: 'm', teamId: 't0', kind: 'manual-adjustment', points: 10, active: true });
    const rows = segmentStandings(base, 'seg-a');
    expect(rows[0].id).toBe('t0');
    expect(rows[0].total).toBe(14);   // 4 from the segment plus the 10 manual
    expect(rows[0].gained).toBe(4);   // manual adjustments carry no segmentId
    expect(rows[1].gained).toBe(2);
  });
  it('sorts by running total, not by what was gained', () => {
    const base = event();
    base.scoreEntries.push({ id: 'm', teamId: 't1', kind: 'manual-adjustment', points: 50, active: true });
    expect(segmentStandings(base, 'seg-a')[0].id).toBe('t1');
  });
});

describe('advancing between segments', () => {
  it('marks the finished segment done and moves to the next one', () => {
    const base = event();
    advanceSegment(base);
    expect(base.segments[0].status).toBe('done');
    expect(base.currentSegmentIndex).toBe(1);
    expect(base.segments[1].status).toBe('setup');
    expect(base.phase).toBe('segment');
  });
  it('goes to the wager after the last segment when one is set', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    base.wager = { question: 'Q', answer: 'A', bets: {} };
    advanceSegment(base);
    expect(base.phase).toBe('wager');
  });
  it('goes straight to the finale after the last segment with no wager', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    advanceSegment(base);
    expect(base.phase).toBe('finale');
  });
  it('skips a blank wager question', () => {
    const base = event();
    base.segments = [segment('seg-a')];
    base.wager = { question: '   ', answer: '', bets: {} };
    advanceSegment(base);
    expect(base.phase).toBe('finale');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/standings.test.ts`
Expected: FAIL — cannot resolve `src/app/standings-logic`.

- [ ] **Step 3: Create `src/app/standings-logic.ts`**

```ts
import { segmentScore, teamScore } from '../core/scoring';
import type { EventSession } from '../core/types';
export function segmentStandings(event: EventSession, segmentId: string) {
  return event.teams
    .map(team => ({ id: team.id, name: team.name, color: team.color, total: teamScore(event.scoreEntries, team.id), gained: segmentScore(event.scoreEntries, segmentId, team.id) }))
    .sort((a, b) => b.total - a.total);
}
export function advanceSegment(event: EventSession) {
  const segment = event.segments[event.currentSegmentIndex];
  if (segment) segment.status = 'done';
  const next = event.currentSegmentIndex + 1;
  if (next < event.segments.length) { event.currentSegmentIndex = next; event.segments[next].status = 'setup'; event.phase = 'segment'; return; }
  event.phase = event.wager?.question.trim() ? 'wager' : 'finale';
}
```

- [ ] **Step 4: Create `src/app/Interstitial.tsx`**

```tsx
import { ArrowRight, TrendingUp } from 'lucide-react';
import type { EventSession } from '../core/types';
import { segmentStandings } from './standings-logic';
export function Interstitial({ event, onContinue }: { event: EventSession; onContinue: () => void }) {
  const segment = event.segments[event.currentSegmentIndex];
  const rows = segmentStandings(event, segment?.id ?? ''), max = Math.max(1, ...rows.map(r => r.total));
  const climber = [...rows].sort((a, b) => b.gained - a.gained)[0];
  const remaining = event.segments.length - event.currentSegmentIndex - 1;
  return <main className="interstitial"><span className="eyebrow">ROUND {event.currentSegmentIndex + 1} OF {event.segments.length} · {segment?.title}</span>
    <h1>{remaining > 0 ? 'Still anyone’s Friday.' : 'Last round done.'}</h1>
    {climber && climber.gained > 0 && <p className="handwritten"><TrendingUp size={18}/> Biggest climber: {climber.name}, +{climber.gained} this round.</p>}
    <div className="interstitial-board">{rows.map((row, i) => <div className="interstitial-row" key={row.id} style={{ '--team-color': row.color } as React.CSSProperties}>
      <b>{i + 1}</b><strong>{row.name}</strong>
      <div className="score-bar"><span style={{ background: row.color, width: `${Math.max(0, row.total) / max * 100}%` }}/></div>
      <span className="interstitial-gain">{row.gained > 0 ? `+${row.gained}` : '—'}</span><b className="interstitial-total">{row.total}</b>
    </div>)}</div>
    <button className="button primary large" onClick={onContinue}>{remaining > 0 ? 'Next activity' : 'On to the finish'} <ArrowRight size={19}/></button>
  </main>;
}
```

- [ ] **Step 5: Create `src/app/EventFinale.tsx`**

```tsx
import { Home as HomeIcon, RotateCcw, Trophy } from 'lucide-react';
import { standings } from '../core/scoring';
import type { EventSession } from '../core/types';
export function EventFinale({ event, onRestart, onHome }: { event: EventSession; onRestart: () => void; onHome: () => void }) {
  const ranking = standings(event.teams, event.scoreEntries), winners = ranking.filter(t => t.score === ranking[0].score);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  return <main className="finale"><div className="finale-confetti" aria-hidden="true">✧ <span>✦</span> ✧ <span>✷</span> ✧</div>
    <span className="eyebrow">{event.segments.length} ACTIVITIES. ONE LEADERBOARD.</span>
    <h1>{winners.length > 1 ? 'Sharing the trophy!' : 'Champions of the Friday!'}</h1>
    <p className="winner-name">{winners.map(t => t.name).join(' & ')}</p>
    <p className="handwritten finale-caption">Bragging rights until next Friday.</p>
    <div className="podium">{podium.map(t => { const place = ranking.findIndex(r => r.id === t.id) + 1, tiedPlace = ranking.findIndex(r => r.score === t.score) + 1;
      return <div className={`podium-place place-${place}`} key={t.id} style={{ '--team-color': t.color } as React.CSSProperties}>{place === 1 && <Trophy className="podium-trophy" size={42}/>}<h3>{t.name}</h3><strong>{t.score}<span> {t.score === 1 ? 'point' : 'points'}</span></strong><div className="podium-block"><b>{tiedPlace === 1 ? '1st' : tiedPlace === 2 ? '2nd' : '3rd'}</b><span>{tiedPlace === 1 ? '★' : '✧'}</span></div></div>; })}</div>
    {ranking.length > 3 && <div className="rest-results">{ranking.slice(3).map((t, i) => <span key={t.id}>{i + 4}. {t.name} <b>{t.score}</b></span>)}</div>}
    <div className="button-row centered"><button className="button primary large" onClick={onRestart}><RotateCcw size={19}/> Plan another event</button><button className="button subtle" onClick={onHome}><HomeIcon size={17}/> Activity library</button></div>
  </main>;
}
```

- [ ] **Step 6: Route both screens and close the segment finale**

In `App.tsx`:

```tsx
    {route === 'session' && session.phase === 'interstitial' && <Interstitial event={session} onContinue={() => updateEvent(advanceSegment)}/>}
    {route === 'session' && session.phase === 'finale' && <EventFinale event={session} onRestart={() => updateEvent(s => { s.phase = 'lineup'; s.scoreEntries = []; s.segments = []; s.currentSegmentIndex = 0; })} onHome={() => setRoute('home')}/>}
```

The activity's own finale needs a way out. Render a continue bar under it when the segment status is
`finale`:

```tsx
    {route === 'session' && session.phase === 'segment' && segment?.status === 'finale' && <div className="segment-finale-bar"><button className="button primary" onClick={() => updateEvent(s => { s.phase = 'interstitial'; })}>Leaderboard <ArrowRight size={18}/></button></div>}
```

A segment whose activity has no `Finale` must not strand the host. In `Stage`-to-finale transitions
the activity sets `phase = 'finale'`; when `activity.Finale` is undefined, render only the continue
bar (the conditional in Task 5 Step 3 already returns `null` for the missing component).

- [ ] **Step 7: Add the styles**

```css
.interstitial { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; }
.interstitial-board { display: flex; flex-direction: column; gap: var(--space-2); width: min(760px, 100%); }
.interstitial-row { display: grid; grid-template-columns: auto 1fr 3fr auto auto; align-items: center; gap: var(--space-3); }
.interstitial-row .score-bar span { transition: width .6s ease; }
.interstitial-total { font-family: var(--font-display); font-size: 1.5rem; }
.segment-finale-bar { display: flex; justify-content: center; padding: var(--space-3); }
@media (prefers-reduced-motion: reduce) { .interstitial-row .score-bar span { transition: none; } }
@media (max-width: 700px) { .interstitial-row { grid-template-columns: auto 1fr auto; } .interstitial-row .score-bar { grid-column: 1 / -1; } }
```

Substitute the real token names.

- [ ] **Step 8: Run the tests**

Run: `npm test && npx tsc -b && npm run build`
Expected: PASS, clean, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/app/Interstitial.tsx src/app/EventFinale.tsx src/app/standings-logic.ts src/app/App.tsx src/theme/styles.css tests/unit/standings.test.ts
git commit -m "feat: show standings between activities and crown an overall winner"
```

---

### Task 10: Final wager

**Files:**
- Create: `src/core/play/wager.ts`, `src/core/play/Wager.tsx`
- Modify: `src/app/App.tsx`, `src/theme/styles.css`
- Test: `tests/unit/play.test.ts` (extend)

**Interfaces:**
- Consumes: `teamScore` (Task 1); `EventWager` (Task 2).
- Produces:
  - `WAGER_FLOOR = 5`
  - `maxWager(entries: ScoreEntry[], teamId: string): number`
  - `clampWager(entries: ScoreEntry[], teamId: string, bet: number): number`
  - `setWagerResult(entries: ScoreEntry[], teamId: string, bet: number, correct: boolean): ScoreEntry[]`
  - `<Wager event onChange onFinish />`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/play.test.ts`:

```ts
import { clampWager, maxWager, setWagerResult, WAGER_FLOOR } from '../../src/core/play/wager';

describe('final wager', () => {
  const rich: ScoreEntry[] = [{ id: 'a', teamId: 't0', kind: 'manual-adjustment', points: 30, active: true }];
  it('caps a bet at the team score', () => {
    expect(maxWager(rich, 't0')).toBe(30);
    expect(clampWager(rich, 't0', 45)).toBe(30);
    expect(clampWager(rich, 't0', 12)).toBe(12);
  });
  it('lets a team on zero still bet the floor', () => {
    expect(maxWager([], 't9')).toBe(WAGER_FLOOR);
    expect(clampWager([], 't9', 5)).toBe(5);
    expect(clampWager([], 't9', 99)).toBe(WAGER_FLOOR);
  });
  it('never allows a negative bet', () => {
    expect(clampWager(rich, 't0', -8)).toBe(0);
  });
  it('treats a team below the floor as able to reach the floor', () => {
    const poor: ScoreEntry[] = [{ id: 'a', teamId: 't0', kind: 'manual-adjustment', points: 2, active: true }];
    expect(maxWager(poor, 't0')).toBe(WAGER_FLOOR);
  });
  it('adds the bet on a correct answer and subtracts it on a wrong one', () => {
    expect(teamScore(setWagerResult(rich, 't0', 10, true), 't0')).toBe(40);
    expect(teamScore(setWagerResult(rich, 't0', 10, false), 't0')).toBe(20);
  });
  it('is idempotent and reversible on re-marking', () => {
    let entries = setWagerResult(rich, 't0', 10, false);
    entries = setWagerResult(entries, 't0', 10, false);
    expect(teamScore(entries, 't0')).toBe(20);
    expect(entries.filter(e => e.kind === 'wager')).toHaveLength(1);
    entries = setWagerResult(entries, 't0', 10, true);
    expect(teamScore(entries, 't0')).toBe(40);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/play.test.ts`
Expected: FAIL — cannot resolve `src/core/play/wager`.

- [ ] **Step 3: Create `src/core/play/wager.ts`**

```ts
import { teamScore } from '../scoring';
import type { ScoreEntry } from '../types';
// A team on zero would otherwise be mathematically out before the final question, which is exactly
// when their interest needs to be highest. The floor keeps every team live to the last answer.
export const WAGER_FLOOR = 5;
export const maxWager = (entries: ScoreEntry[], teamId: string) => Math.max(teamScore(entries, teamId), WAGER_FLOOR);
export const clampWager = (entries: ScoreEntry[], teamId: string, bet: number) => Math.max(0, Math.min(Math.round(bet) || 0, maxWager(entries, teamId)));
export function setWagerResult(entries: ScoreEntry[], teamId: string, bet: number, correct: boolean): ScoreEntry[] {
  const id = `wager-${teamId}`;
  // The bet is scored against the standing BEFORE any wager entry, so re-marking is reversible.
  const withoutWager = entries.filter(e => e.id !== id);
  const points = correct ? clampWager(withoutWager, teamId, bet) : -clampWager(withoutWager, teamId, bet);
  return [...withoutWager, { id, teamId, kind: 'wager', points, active: true }];
}
```

- [ ] **Step 4: Create `src/core/play/Wager.tsx`**

```tsx
import { useState } from 'react';
import { Check, Coins, Eye, X } from 'lucide-react';
import { teamScore } from '../scoring';
import type { EventSession } from '../types';
import { clampWager, maxWager, setWagerResult } from './wager';
export function Wager({ event, onChange, onFinish }: { event: EventSession; onChange: (change: (draft: EventSession) => void) => void; onFinish: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const wager = event.wager!, bets = wager.bets;
  const allBetsIn = event.teams.every(t => bets[t.id] !== undefined);
  const marked = (teamId: string) => event.scoreEntries.find(e => e.id === `wager-${teamId}`);
  return <main className="wager-stage"><span className="eyebrow">THE FINAL WAGER</span>
    {!revealed ? <><h1>Place your bets<span className="accent">.</span></h1><p className="handwritten">Bet what you dare. Get it wrong and it’s gone.</p>
      <div className="wager-bets">{event.teams.map(team => { const cap = maxWager(event.scoreEntries, team.id);
        return <label className="wager-bet" key={team.id} style={{ '--team-color': team.color } as React.CSSProperties}>
          <span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong>
          <small>{teamScore(event.scoreEntries, team.id)} pts · max {cap}</small>
          <input type="number" min={0} max={cap} aria-label={`Wager for ${team.name}`} value={bets[team.id] ?? ''} onChange={e => onChange(s => { s.wager!.bets[team.id] = clampWager(s.scoreEntries, team.id, +e.target.value); })}/>
        </label>; })}</div>
      <button className="button primary large" disabled={!allBetsIn} onClick={() => setRevealed(true)}><Eye size={20}/> Reveal the question</button></>
    : <><h1>{wager.question}</h1><p className="wager-answer"><Coins size={19}/> {wager.answer}</p>
      <div className="wager-bets">{event.teams.map(team => { const entry = marked(team.id), bet = bets[team.id] ?? 0;
        return <div className="wager-bet" key={team.id} style={{ '--team-color': team.color } as React.CSSProperties}>
          <span className="team-dot" style={{ background: team.color }}/><strong>{team.name}</strong><small>bet {bet}</small>
          <button className={`button small-button ${entry && entry.points > 0 ? 'correct selected' : 'secondary'}`} aria-pressed={!!entry && entry.points > 0} onClick={() => onChange(s => { s.scoreEntries = setWagerResult(s.scoreEntries, team.id, bet, true); })}><Check size={17}/> +{bet}</button>
          <button className={`button small-button ${entry && entry.points <= 0 ? 'missed selected' : 'secondary'}`} aria-pressed={!!entry && entry.points <= 0} onClick={() => onChange(s => { s.scoreEntries = setWagerResult(s.scoreEntries, team.id, bet, false); })}><X size={17}/> −{bet}</button>
        </div>; })}</div>
      <button className="button primary large" disabled={event.teams.some(t => !marked(t.id))} onClick={onFinish}>The final results</button></>}
  </main>;
}
```

- [ ] **Step 5: Route it in `App.tsx`**

```tsx
    {route === 'session' && session.phase === 'wager' && session.wager && <Wager event={session} onChange={updateEvent} onFinish={() => updateEvent(s => { s.phase = 'finale'; })}/>}
```

- [ ] **Step 6: Add the styles**

```css
.wager-stage { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; }
.wager-bets { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); width: min(900px, 100%); }
.wager-bet { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); border: 2px solid var(--team-color); border-radius: var(--radius-md); }
.wager-bet input { width: 5rem; margin-left: auto; }
```

Substitute the real token names.

- [ ] **Step 7: Run the tests**

Run: `npm test && npx tsc -b && npm run build`
Expected: PASS, clean, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/core/play/wager.ts src/core/play/Wager.tsx src/app/App.tsx src/theme/styles.css tests/unit/play.test.ts
git commit -m "feat: add the final wager round"
```

---

### Task 11: Full event browser test and documentation

**Files:**
- Modify: `tests/browser/app.spec.ts`
- Modify: `README.md`
- Modify: `activities/childhood-vs-now/setup/GameSetupStep.tsx` (scoring copy)

**Interfaces:**
- Consumes: everything from Tasks 1–10.
- Produces: no new code interfaces.

- [ ] **Step 1: Fix the remaining scoring copy**

In `activities/childhood-vs-now/setup/GameSetupStep.tsx`, change the rule card text
`<p>Correct = 1 point. Missed = 0. No hints.</p>` to
`<p>Correct = 2 points. Stolen = 1. Missed = 0.</p>`, and the intro paragraph
`<p>Different photos for every team. One point for every familiar face.</p>` to
`<p>Different photos for every team. Two points for every familiar face — one if another team steals it.</p>`.

- [ ] **Step 2: Write the failing browser test**

Append to `tests/browser/app.spec.ts`:

```ts
test('stealing, retracting a steal, and reaching the event finale through the standings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await home(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();

  // Score the demo segment: one correct (+2), one stolen (+1), two missed.
  await page.keyboard.press('Enter'); await page.keyboard.press('c');
  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.locator('.steal-teams .button').first().click();
  let session = await saved(page);
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(3);
  expect(session.scoreEntries.some((e: any) => e.kind === 'steal-award' && e.active)).toBe(true);

  // Flipping the owner to Correct must retract the steal, not pay both.
  await page.getByRole('button', { name: /^Correct/ }).click();
  session = await saved(page);
  expect(session.scoreEntries.filter((e: any) => e.kind === 'steal-award' && e.active)).toHaveLength(0);
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(4);
  await page.getByRole('button', { name: /^Missed/ }).click();

  // The demo has four rounds, one per team. Rounds 1 and 2 are scored above; play out 3 and 4.
  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.getByRole('button', { name: 'Final results' }).click();
  await expect(page.getByRole('heading', { name: 'Team of the month!' })).toBeVisible();

  await page.getByRole('button', { name: /^Leaderboard/ }).click();
  await expect(page.getByText(/ROUND 1 OF 1/)).toBeVisible();
  await page.screenshot({ path: 'test-results/interstitial-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /On to the finish/ }).click();
  await expect(page.getByRole('heading', { name: /Champions of the Friday!|Sharing the trophy!/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/event-finale-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('the line-up builder runs two activities on one leaderboard', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: /^Build an event/ }).click();
  await expect(page.getByRole('heading', { name: /Build your Friday/ })).toBeVisible();
  await page.getByRole('button', { name: 'Childhood vs Now' }).click();
  await page.getByRole('button', { name: 'Childhood vs Now' }).click();
  await page.getByRole('textbox', { name: 'Final wager question' }).fill('How many biscuits does this office get through a week?');
  await page.getByRole('textbox', { name: 'Final wager answer' }).fill('Far too many');
  await page.screenshot({ path: 'test-results/lineup-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /Start the event/ }).click();
  const session = await saved(page);
  expect(session.segments).toHaveLength(2);
  expect(session.phase).toBe('segment');
  expect(session.segments[0].status).toBe('setup');
  expect(session.wager.question).toContain('biscuits');
});

test('a v1 session document still opens as a one-activity event', async ({ page }) => {
  const v1 = JSON.parse(await readFile('tests/fixtures/session-v1.json', 'utf8'));
  await page.goto('/');
  await page.evaluate(([k, doc]) => localStorage.setItem(k as string, JSON.stringify(doc)), [key, v1] as const);
  await page.reload();
  const session = await saved(page);
  expect(session.formatVersion).toBe(2);
  expect(session.segments).toHaveLength(1);
  expect(session.segments[0].activityId).toBe('childhood-vs-now');
});
```

The v1 fixture references image IDs that are not in IndexedDB, so the app will show a missing-image
warning rather than rendering crops. The test only asserts the migrated document shape, which is the
point.

- [ ] **Step 3: Run the browser suite to verify the new tests fail, then pass**

Run: `npm run build && npx playwright test`
Expected: the three new tests fail first if any wiring is missing; fix until all tests in the file
pass. Existing tests must also still pass.

- [ ] **Step 4: Update `README.md`**

Make these edits:

- In the opening description, after the Childhood vs Now paragraph, add:

```markdown
Activities run as an **event**: the host builds a line-up, and every activity shares one set of teams
and one running leaderboard. Standings appear between activities, and the event can end with a final
wager where teams bet their points on one last question.
```

- Replace the **Host workflow** intro with a numbered step 0:

```markdown
0. **Build the line-up.** Choose the activities in running order, set a points multiplier for later
   rounds, name your teams, and optionally write one final wager question. Or start a single activity
   straight from its card on the home screen.
```

- In step 5 (**Play**), replace the scoring sentence with:

```markdown
Correct is two points. If the assigned team misses, the round opens to the other teams and a steal is
worth one point. Marking the owning team Correct afterwards retracts the steal, so a round can never
pay out twice.
```

- Add after step 6:

```markdown
7. **Standings.** Between activities, the leaderboard shows the running total, what each team gained
   in that round, and the biggest climber.
8. **Final wager.** Each team bets between 0 and their current score (a team on zero may still bet 5),
   the question is revealed, and the host marks each team. Then the event finale crowns the winner.
```

- Under the keyboard shortcut table, change the `C` row action to "Correct: award the round to the
  assigned team" and the `M` row to "Missed: award zero and open the round to a steal", then add
  below the table:

```markdown
Awarding a steal needs a team, so it is a click rather than a key. Press `M`, then choose the team
that got it from the steal panel.
```

- In **Storage and backups**, change the first sentence of the localStorage bullet to:

```markdown
- The line-up, names, settings, team definitions, score entries, and per-activity progress live in
  **localStorage** as a versioned event document. Sessions saved by earlier versions are migrated to
  the event format the first time they are opened.
```

- In **How to add a new activity**, add to the `Activity` bullet list:

```markdown
- `Finale` is optional and closes your activity before the leaderboard; omit it to go straight to the
  standings.
- `estimatedMinutes` feeds the line-up builder's runtime estimate.
- Shared play mechanics live in `src/core/play/`: `Timer`, `StealPanel`, `Wager`. Use them
  rather than writing your own — they keep the score ledger idempotent and segment-scoped.
- Write score entries through `src/core/scoring.ts`, passing `session.segmentId`, so two activities
  containing the same person cannot collide in the shared ledger.
```

- In **Architecture**, add to the tree:

```text
src/core/play/              Timer, steal, final wager
```

- In **Tests**, add to the Vitest sentence: "segment views, v1→v2 migration, steal and wager
  invariants, and line-up validation".

- [ ] **Step 5: Run everything**

Run: `npm test && npx tsc -b && npm run build && npx playwright test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add tests/browser/app.spec.ts README.md activities/childhood-vs-now/setup/GameSetupStep.tsx
git commit -m "test: cover a full event run and document the event format"
```

---

## Verification

After Task 11, confirm by hand on a production build (`npm run build && npm run preview -- --port 4173`):

1. Home → **Build an event** → add two activities, name teams, write a wager → **Start the event**.
2. Set up and play the first activity. Check that a missed round offers the steal, and that marking
   the owner Correct afterwards removes the stolen point from the scoreboard.
3. Reach the segment finale, click **Leaderboard**, confirm the standings show running totals and the
   gain from that activity.
4. Continue into activity two, confirm the scoreboard still shows activity one's points.
5. Finish, place wagers, mark them, confirm the finale crowns the right team.
6. Reload the page mid-round and confirm the round, results and scores survive.
7. Disconnect the network and reload once; confirm **Offline ready** and that play continues.
