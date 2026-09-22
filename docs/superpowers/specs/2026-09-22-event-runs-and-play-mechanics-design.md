# Event Runs and Shared Play Mechanics Design

## Goal

Turn Fun Friday Studio from a single-activity app into an **event** app. A host runs five or six
activities back to back for 20–40 people across roughly 90 minutes, with one set of teams, one
running leaderboard, and one crowning moment at the end.

This spec covers the event spine and the shared play mechanics only. Each new activity gets its own
spec, built on what this one delivers.

## Why this comes before new activities

Two properties of the current design limit engagement more than the number of activities does.

**Scores do not survive an activity change.** `App.tsx` `beginSetup` builds a fresh session when the
host picks a different activity. It carries `people`, `facePairs`, `assets`, and `teams`, and drops
`scoreEntries`. Five activities today means five unrelated scoreboards and no overall winner.

**Only one team plays at a time.** `allocateRounds` in `activities/childhood-vs-now/logic/rounds.ts`
assigns every round to exactly one team. For a 15-minute game that is fine. Across 90 minutes each
team is passive for about three quarters of the event, which is how a room goes quiet.

Building steal, all-team rounds, a timer, and a wager as core primitives fixes the second problem for
every activity at once, and makes each later activity a fraction of the work.

## Non-goals

- Player devices. The event stays one laptop, one projector, host-adjudicated, fully offline, no
  backend. Nothing here introduces a server, a join code, or network play.
- Paper answer collection as a first-class flow.
- Picture Reveal. Considered and cut; Childhood vs Now already owns the photo-recognition slot.

## Data model

The event is not a new top-level document. `Session` already owns exactly what segments should share
— `people`, `facePairs`, `teams`, `scoreEntries`, `assets` — so `Session` becomes the event, and the
activity-specific fields move into a segment.

```ts
interface Segment {
  id: ID;
  activityId: string;
  activityVersion: number;
  title: string;                 // host-renamable, e.g. "Round 3: Who Said It?"
  settings: unknown;
  game: unknown;
  status: 'pending' | 'setup' | 'play' | 'finale' | 'done';
  setupStepId: string;
  weight: number;                // points multiplier, default 1
}

interface Session {              // now an event
  formatVersion: 2;
  id; title; createdAt; updatedAt; isDemo;
  segments: Segment[];
  currentSegmentIndex: number;
  phase: 'lineup' | 'segment' | 'interstitial' | 'wager' | 'finale';
  wager?: { question: string; answer: string; bets: Record<ID, number> };
  people: Person[];
  facePairs: FacePair[];
  teams: Team[];
  scoreEntries: ScoreEntry[];
  assets: Record<ID, Asset>;
}
```

`activityId`, `activityVersion`, `settings`, `game`, and `setupStepId` leave the top level. The Zod
schema in `src/core/session.ts` validates `segments` and resolves each segment's activity through the
registry, running that activity's `settingsSchema`, `stateSchema`, and `validateSession` per segment.

### Segment view

Activities are not rewritten to read `segment.game`. There are about thirty-five call sites of
`session.game`, `session.settings`, `session.phase`, and `session.setupStepId` across
`logic/rounds.ts`, `stage/Stage.tsx`, `stage/Finale.tsx`, `logic/preparation.ts`, and the four setup
steps. Rewriting each by hand is a large mechanical change that no test would catch a miss in.

Instead the core hands each activity a **segment view**: a shallow projection of the event that still
exposes `game`, `settings`, `phase`, and `setupStepId` at the top level, alongside the shared
`people`, `facePairs`, `teams`, `scoreEntries`, and `assets`.

```ts
function segmentView(event: EventSession, index: number): SegmentSession;
function foldSegmentView(event: EventSession, index: number, view: SegmentSession): void;
```

`ActivityContext.update` clones the event, builds a view over the clone, runs the activity's change
against the view, then folds the view's top-level fields back into the segment. Because the view is a
shallow copy, in-place mutation (`s.people.find(…)!.name = x`, `s.game.rounds.push(…)`) already
writes through to the clone; the fold-back exists to catch whole-field assignment
(`s.game = …`, `s.people = […]`, and the `Object.assign(s, next)` pattern the setup steps use).

`Activity`, `ActivityContext`, and every existing activity file keep their current shape. The one
activity change required is described under Scoring below.

The view carries one added field, `segmentId: ID`, so activities can scope ledger writes.

### Migration

`formatVersion` goes 1 → 2. A v1 document becomes a one-segment event: the old
`activityId`/`settings`/`game`/`setupStepId` become segment 0, and the old `phase` maps as follows.

| v1 `phase` | segment 0 `status` | event `phase` |
| --- | --- | --- |
| `setup` | `setup` | `segment` |
| `play` | `play` | `segment` |
| `finale` | `finale` | `segment` |

A migrated event has no wager, so its event finale shows the single segment's standings. Existing
localStorage sessions and exported ZIPs keep working.

`Activity.migrate` keeps its current per-activity meaning and is unchanged.

## Scoring

`ScoreEntry` gains `segmentId` and two new kinds.

```ts
interface ScoreEntry {
  id: ID; teamId: ID;
  segmentId?: ID; roundId?: ID;
  kind: 'round-award' | 'steal-award' | 'manual-adjustment' | 'wager';
  points: number;                // integer, may be negative for wagers
  active: boolean;
}
```

`teamScore` and `standings` keep summing active entries and need no change. Add
`segmentScore(entries, segmentId, teamId)` for the interstitial breakdown.

**Ledger entry IDs become globally unique.** Round IDs are `round-${personId}`, unique only within
one activity, so two segments containing the same person would collide in the shared ledger. Rather
than rewriting activity round IDs, the scoring helpers take a `segmentId` and build entry IDs as
`${segmentId}:award-${roundId}`. The segment view exposes `segmentId`, so the only activity change is
one line in `logic/rounds.ts` passing it through to `setRoundAward`.

**The base award is 2 points; a steal is 1.** `points` is an integer, so a half-point steal is not
representable. Rescaling keeps the ledger integral and avoids float-comparison bugs. Both values are
event settings. The Home card copy "1 point per guess" changes to match.

**Weights apply at award time**, not at display time, so the ledger stays the single source of truth
and re-clicking an award stays idempotent.

### Ledger invariants

These are the correctness core of the feature and carry the heaviest unit tests.

1. Repeating any host action is idempotent. Every entry has a deterministic ID
   (`${segmentId}:award-${roundId}`, `${segmentId}:steal-${roundId}`,
   `${segmentId}:award-${roundId}-${teamId}`, `wager-${teamId}`) and is updated in place rather than
   appended, following the existing `setRoundAward` pattern.
2. A steal implies the owning team missed. If the host then flips the owner to Correct, the steal
   entry is deactivated.
3. A steal cannot be awarded to the round's owning team.
4. A wager is clamped to `0 .. max(teamScore, 5)`.

## Play primitives

New directory `src/core/play/`, headless logic beside presentational components, composed by
activities rather than reimplemented in each.

### Countdown timer

Host start, pause, reset. Projector-scale digits. An audible cue in the last five seconds from a
WebAudio oscillator, so no audio assets are added and the offline promise holds. Honours
`prefers-reduced-motion` like the rest of the theme.

`App.tsx` `update` writes to storage on every change, so a per-tick save would write to localStorage
once a second for the length of the event. The timer persists only `deadlineAt` and
`pausedRemaining`; the tick lives in React state. A refresh mid-round then restores the correct
remaining time rather than resetting the round.

### Steal

After a miss, the host opens a steal and awards it to any non-owning team, or closes it with no
award. Entry `steal-${roundId}`, reassignable between teams, subject to the invariants above.

### All-team round

One toggle per team; the host taps whichever teams answered correctly. One entry per team per round,
`award-${roundId}-${teamId}`. Number keys `1`–`8` toggle teams so the host stays on the keyboard;
with four teams and 40 people, host clicking is the pacing bottleneck.

### Final wager

Event-level, phase `wager`, owned by the spine rather than by any activity. Two steps: the host
enters each team's bet, then reveals the question and marks each team. Entries are `wager-${teamId}`
with signed points.

The `max(score, 5)` floor lets a team on zero still bet. Without it a trailing team is mathematically
eliminated before the final question, which is exactly when their interest needs to be highest.

## Host flow

```text
Home
  └─ Lineup builder
       └─ for each segment: setup → play → segment finale (optional) → interstitial
            └─ Final wager → Event finale
```

**Lineup builder** (`src/app/Lineup.tsx`, new core screen): choose and reorder activities, set
per-segment weight, write the wager question and answer, see estimated runtime.

The wager is optional. If the host leaves the wager question blank, the `wager` phase is skipped and
the last interstitial leads straight to the event finale. A segment whose activity has no `Finale`
likewise goes straight from `play` to the interstitial.

**Segment setup is unchanged.** It reuses `activity.setupSteps`, its validation, and its step
navigation exactly as today, scoped to the current segment. This is the payoff of the existing
plugin design and the reason the spine is affordable.

**Interstitial standings** between segments is the recurring beat that makes five activities feel
like one contest: animated bars, "Round 3 of 5", and the biggest climber since the last round. It
gets real visual design rather than a table.

**Single-activity path preserved.** The activity card on Home still offers a direct start, which
creates a one-segment event and skips the lineup builder. Running one activity does not get slower
because the app learned to run six.

### Activity interface changes

- `Finale` becomes optional (`Finale?:`). It is now the *segment* closer. Childhood vs Now keeps its
  group reveal; Act It Out will not need one.
- `remapImages` and `validateSession` are invoked per segment through a registry lookup during ZIP
  import and session validation.
- Optional `estimatedMinutes` for the lineup builder's runtime estimate.

Everything else in `Activity` and `ActivityContext` is unchanged, because of the segment view above.

## Activity backlog

Each is a separate spec and build, in this order.

1. **Act It Out** — zero prep. Bundled prompt deck, the timer primitive, a per-team counter. Used
   prompt IDs live in game state so nothing repeats across the event. Cheapest to build, and it
   validates the primitives.
2. **Who Said It?** — reuses `Person` and `FacePair` wholesale; prep is typing statements, with no
   new photo work. Rounds are statements rather than people, so an event can run more rounds than it
   has colleagues. It keeps its own `statements` list, optionally seeded from `Person.funFact`, and
   does not read `funFact` at play time: Childhood vs Now already reveals fun facts after each guess,
   so sharing the field would replay facts the room heard two activities ago.
3. **Office Trivia + Closest Guess** — host-authored question editor with CSV import following the
   `src/core/people/csv.ts` patterns. Multiple choice runs on the all-team primitive. Closest guess
   takes host-entered numbers and awards nearest without going over.

## Testing

Following the existing split.

**Vitest.** Ledger invariants 1–4 above, including repeated and out-of-order host clicks. Entry-ID
uniqueness across segments. Weight application at award time. Wager clamping at the floor and
ceiling. v1 → v2 migration against a checked-in v1 fixture. Lineup validation, including a segment
whose activity is not registered.

Segment view round-trips get their own suite, because they are the load-bearing piece for leaving
activities untouched: in-place mutation writes through, whole-field assignment folds back,
`Object.assign(s, next)` folds back, shared fields reach the event, and a write through one segment's
view never touches another segment's `game`.

**Playwright**, on the production build as today. A complete three-segment event through interstitials,
wager, and event finale. Refresh mid-round restoring the timer deadline rather than resetting it.
Multi-segment ZIP export and re-import. Import of a v1 ZIP migrating to a one-segment event. Phone
layout of the lineup builder and interstitial.

## Risks

**Migration.** Existing sessions and ZIPs must keep working. Mitigated by an explicit v1 → v2 step
and a checked-in v1 fixture exercised by both the unit and browser suites.

**Timer persistence.** A naive implementation would write to storage every second. Mitigated by
persisting the deadline rather than the tick, which is also what makes refresh recovery correct.

**Scope.** The spine touches `session.ts`, `storage.ts`, `transfer.ts`, `scoring.ts`, `App.tsx`, and
Childhood vs Now. It is deliberately one project, and the three activities are deliberately not in
it.
