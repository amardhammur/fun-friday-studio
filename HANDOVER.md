# Handover — Event Runs and Shared Play Mechanics

**Date:** 2026-09-22 · **Branch:** `main` · **HEAD:** `30ea5d6` · **Status:** 7 of 11 tasks complete

Everything is committed. Working tree clean. `npx tsc -b` exits 0, `npm test` passes 83 tests across
10 files, `npx playwright test` passes 8/8.

---

## What this project is

Fun Friday Studio is a private, offline, projector-driven activity app for office events. It had one
activity, **Childhood vs Now**, and ran exactly one activity per session.

This project turns it into an **event** app: a host builds a line-up of several activities that share
one set of teams and one running leaderboard, with standings between activities and an optional final
wager.

**Spec:** `docs/superpowers/specs/2026-09-22-event-runs-and-play-mechanics-design.md`
**Plan:** `docs/superpowers/plans/2026-09-22-event-runs-and-play-mechanics.md` — 11 tasks, each with
file lists, interfaces, exact code and TDD steps. Tasks 8–11 are still to do and are written out in
full.

**Progress ledger:** `.superpowers/sdd/2026-09-22-event-runs-and-play-mechanics/progress.md`
(git-ignored). Per-task briefs and implementer reports live beside it. The ledger records every
ruling and why — read it before changing a decision.

---

## The user's requirements (from the original brainstorm)

- ~90 minute event, 5–6 activities, 20–40 people, 4 teams.
- **One event, one leaderboard** carried across activities.
- Teams shout answers; **the host adjudicates**. No player devices, no backend, fully offline.
- Mechanics chosen: **steal on a miss**, **countdown timer**, **all-team rounds**, **final wager**.
- Activity backlog, each its own future spec: **Act It Out** (zero prep), **Who Said It?** (People
  library), **Office Trivia + Closest Guess** (host-authored).

---

## Architecture — the four things to understand first

### 1. `Session` became the event; activities read a "segment view"

`EventSession` (in `src/core/types.ts`) holds an ordered `Segment[]` plus the shared `people`,
`facePairs`, `teams`, `scoreEntries`, `assets`. Each `Segment` owns its own `activityId`, `settings`,
`game`, `status` and `weight`.

**Activities were not rewritten.** There were ~35 call sites of `session.game` / `session.settings` /
`session.phase` across the activity. Instead, `src/core/event.ts` provides:

```ts
segmentView(event, index): AnySession      // shallow projection — activities see the old shape
foldSegmentView(event, index, view): void  // folds whole-field writes back into the segment
```

The view is **shallow**: shared arrays and the segment's `game` are the *same object references* the
event holds, so in-place mutation writes through automatically. The fold exists only to catch
whole-field assignment (`s.game = …`, `s.people = […]`, and the `Object.assign(s, next)` pattern the
setup steps use). `tests/unit/event.test.ts` pins this with reference-identity assertions — if you
ever make `segmentView` copy anything, those tests must fail.

`segmentId` and `points` on the view are **derived** and are deliberately never folded back.
`points` is `{ correct, steal }` with the segment's `weight` already multiplied in, so an activity
can never edit the event's scoring rules.

### 2. The score ledger is idempotent and segment-scoped

`src/core/scoring.ts`. Every host action writes a **deterministic entry id** and updates in place:

| Action | Entry id |
| --- | --- |
| round award | `${segmentId}:award-${roundId}` |
| steal | `${segmentId}:steal-${roundId}` |
| wager (Task 10) | `wager-${teamId}` |

Repeated clicks and refreshes can therefore never double-count. `points` is `z.number().int()` —
**no fractional points anywhere**, which is why a correct answer is worth **2** and a steal **1**
rather than 1 and 0.5. Both are configurable via `EventSession.correctPoints` / `stealPoints`.

The invariant that matters most: **a steal implies the owner missed.** If the host then flips the
owner to Correct, `retractSteal` deactivates the steal (`logic/rounds.ts:32`), or the round pays
twice.

### 3. There is no v1 migration — by decision

`validateEvent` accepts `formatVersion: 2` only. A v1 document is rejected with a message naming
**Export pairs** as the recovery route.

The rationale is in the spec under "No v1 migration": the app has never shipped, so v1 documents
exist only on the author's laptop, and the expensive prep (photos, face boxes, matching, names) is
independently recoverable through the pair-bundle path, which never touches the session schema.
Migration was protecting an evening's game state at the cost of permanent surface area — and a
Critical defect was found inside it. **Do not reinstate it without re-reading that section.**

### 4. `update` vs `updateEvent` in `App.tsx`

- `update(change)` — for activity edits. Clones the event, builds a view over the clone, runs the
  change, folds back, installs.
- `updateEvent(change)` — for event-level edits (line-up, phase, wager). Edits the event directly.

`install` is the sole writer of `updatedAt` and must keep running on the **event, after** the fold.
That is why `foldSegmentView` deliberately does not fold `updatedAt`.

---

## What is done (Tasks 1–7)

| # | Task | Commits |
| --- | --- | --- |
| 1 | Score ledger — segment scoping, weights, 2-point base | `a33d4f0`, `7f3e29b` |
| 2 | Event model + segment view | `5373c33`, `5cfda14` |
| 3 | v2 document schema (migration cut mid-task) | `86c747f` … `bee56ae` |
| 4 | ZIP transfer per segment | `dae6b22` |
| 5 | App shell wired to segments — **regression checkpoint** | `bd5c3ba` |
| 6 | Countdown timer primitive | `14fe342` |
| 7 | Steal on a miss (+ Childhood vs Now wiring) | `30ea5d6` |

Tasks 1–6 were reviewed clean. **Task 7's code is complete and verified by me (83 unit tests, 8/8
Playwright, `tsc` 0) but its code review had not run when the session ended** — see Next Steps.

Plan doc commits (`c04fc69`, `2c73ab0`, `5c8a24e`, `790110f`, `f78fc55`, `5e6ccaa`) record decisions
and plan corrections; they contain no code.

---

## What is left (Tasks 8–11)

All four are written out in full in the plan with exact code. They are additive — the risky
structural work is done.

- **Task 8 — Line-up builder.** `src/app/Lineup.tsx` + `src/app/lineup-logic.ts`. Choose and reorder
  activities, set per-segment weight, write the wager question, see estimated runtime. Also adds a
  "Build an event" entry on Home.
- **Task 9 — Interstitial standings + event finale.** `src/app/Interstitial.tsx`,
  `src/app/EventFinale.tsx`, `src/app/standings-logic.ts`. The between-activity leaderboard is the
  beat that makes five activities feel like one contest; it deserves real visual design.
- **Task 10 — Final wager.** `src/core/play/wager.ts` + `Wager.tsx`. Bets clamp to
  `0 .. max(teamScore, 5)`; the floor of 5 keeps a zero-score team mathematically alive into the last
  question.
- **Task 11 — Full event browser test + README.**

---

## ⚠️ Carry-forwards for Task 8 — read before starting

These are latent today and become **reachable the moment the line-up phase exists**. All three were
found by review and deliberately deferred to Task 8 rather than fixed in isolation.

1. **`src/app/App.tsx:66` — `isStage` is `status !== 'setup'`**, so it is true for `'pending'` and
   `'done'`, but the render branches at `:73–75` only match `setup`/`play`/`finale`. Result:
   presentation chrome over a blank page. Exact fix:
   `segment.status === 'play' || segment.status === 'finale'`.

2. **`src/app/App.tsx:72` — the People route renders nothing when `context` is undefined.** In the
   line-up phase there is no segment, so "People library" lands on a **blank page**. This needs a
   decision: either give `PeopleLibrary` an event-level path, or disable the nav entry with an
   explanation. A blank page is not acceptable. Note `exportFacePairs` already tolerates a missing
   `previews` map (`?? {}`), so an event-level path is feasible.

3. **`src/app/Home.tsx` still reads "1 point per guess"** while a correct answer now awards 2
   (weight-scaled). Task 8 Step 5 already schedules this — do not lose it. Consider wording that does
   not hardcode a number, since weight scales it per segment.

---

## Deferred minor findings (for a final pass before merge)

None block anything. Full context in the ledger.

- `scoring.ts` — `upsert`'s `{ ...e, ...entry }` is an effective full replace, not a merge.
- `event.test.ts:60-63` — cross-segment leak test is near-vacuous (two separate object literals).
- `event.ts` — `weight: number` unconstrained in the TS type (the Zod schema does constrain it to
  `int 1..5`); `createSegment`/`currentSegment` lack direct coverage; `createSegment` dereferences
  `activity.setupSteps[0].id` unguarded; `Segment` is not re-exported alongside `EventSession`.
- `session.ts` — the `currentSegmentIndex` bounds check is gated by `session.segments.length &&`, so
  a zero-segment event with a stray index passes.
- `transfer-remap.test.ts` — no single test combines multi-segment **and** facePairs-remapped-once.
- `App.tsx:48` — the activity-switch branch preserves `isDemo`/`title` where the old `createSession`
  reset them. Unreachable while only one activity exists.
- `main.tsx` — a non-v1 (Zod) restore failure surfaces its raw issue list in the storage warning.
  Verbose; worth wrapping in a friendlier message.
- `Timer.tsx` — reset-disabled recomputes `remainingMs` instead of reusing `remaining`;
  `void audio.resume()` has no `.catch`; the component/hook/audio have no direct test coverage.

---

## Next steps, in order

1. **Review Task 7** (`git diff 14fe342..30ea5d6`). Focus on the four steal invariants: retract on
   owner-correct, no self-steal, idempotent award/reassign/clear, and cross-segment independence.
   `tests/unit/play.test.ts` covers them — check they would genuinely fail if the behaviour broke.
2. **Task 8**, applying the three carry-forwards above.
3. Tasks 9, 10, 11.
4. A whole-branch review, triaging the deferred minors above.

---

## Commands

```sh
npm ci                 # Node 22.12+ (24 LTS recommended)
npm test               # Vitest — 83 tests, 10 files
npx tsc -b             # must exit 0
npm run build          # tsc + vite + service worker
npx playwright test    # 8 browser tests; needs npm run build first
npm run dev            # Vite dev server
npm run preview -- --port 4173   # production preview, used by Playwright
```

---

## Conventions that matter

- **No new npm dependencies.** No backend, no network at play time, fully offline. The timer's audio
  cue is a WebAudio oscillator precisely so no sound file ships.
- **Style:** dense single-line JSX and multi-statement lines. `App.tsx` and `Stage.tsx` are
  deliberately compact. Match the surrounding file; do not reformat.
- **Copy is British-inflected and warm** ("colours", "Recognise"). Match the voice.
- **CSS tokens:** `:root` defines `--board --board-deep --surface --surface-light --chalk --muted
  --line --yellow --pink --blue --mint --ink --heading --body --hand --radius`. There is **no spacing
  scale** — literal px gaps are correct here. Never hardcode a colour a token already names.
- Respect `prefers-reduced-motion` for any animation.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Lessons from this run

Every code review found something real, and **four of the five substantive defects were in the plan,
not in the implementation**. Two are worth knowing about because they nearly shipped:

- **A test that passes for the wrong reason.** Two tests named for the segment-view aliasing property
  would have passed even if `segmentView` deep-cloned. The fix was to assert reference identity with
  no fold, and to verify the test fails when `segmentView` is temporarily made to clone. Apply that
  standard to the wager and standings tests in Tasks 9–10.
- **A silent scoring bug beats a loud crash.** The cut migration minted a fresh segment id while
  leaving legacy award ids unprefixed, so re-marking a round would have double-counted it — and
  because `segmentScore` filters by `segmentId` while `teamScore` does not, the per-round display
  would have looked right while the event total was wrong. When touching the ledger, always ask what
  the *correction* path does, not just the happy path.

Implementers who stopped and asked instead of improvising were right every time.
