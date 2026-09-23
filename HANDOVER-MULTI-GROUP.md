# Handover — multi-group people library (implementation complete)

Written 2026-09-23 for a Codex agent picking this up cold. Read `HANDOVER.md` first for the event
architecture (events, segments, activities, the shared people library).

## What is being built

The People library used to hold exactly one pair of group photos (a childhood "then" photo and a
current "now" photo, matched face by face). This work lets it hold **several photo sets**:

- a full group (then + now group photo),
- further groups where only some people play (their people start switched off),
- single people added from two individual photos,

all playing in one Childhood vs Now game. The whole team reveal shows one then/now wipe per group
that had players, then an "Also in the game" slide for single-photo people.

- **Spec (binding):** `docs/superpowers/specs/2026-09-23-multi-group-people-library-design.md`
- **Plan (step by step, with code):** `docs/superpowers/plans/2026-09-23-multi-group-people-library.md`

The plan gives complete code and tests for every task. Follow it. Where it disagrees with the spec,
the spec wins.

## Current status

Branch `feat/multi-group-people-library`, 14 commits on top of `main` (`37b4480`, which holds the
spec and plan). All eight plan tasks are complete and reviewed. `main` has not been touched, and
nothing is pushed.

| Plan task | Status | Commits |
|---|---|---|
| 0 Baseline | done | — (results below) |
| 1 Session format 3: photo sets in the library | done, reviewed | `27c5c5a`, fix `b311e18` |
| 2 Face-pair bundle version 2 | done, reviewed | `24d3621` |
| 3 Add to library (import menu, duplicates dialog) | done, reviewed | `c9135e5`, fix `df4abce` |
| 4 Set-scoped editor screens + Childhood vs Now People step | done, reviewed | `faa2bfd` |
| **5 The People library screen** | **done** | `0e3788f` |
| **6 Add a person with two single photos** | **done** | `9f6da71` |
| **7 A reveal slide for every group with players** | **done** | `17c2905` |
| **8 End-to-end browser coverage and docs** | **done** | `0cea506` |
| Broad review fixes | **done** | `dd9698b` |
| Add a group host-flow browser regression | **done** | `4a47528` |

The broad review added library-capacity guards across add, sync, import, and matching paths; validated
contiguous set order; and tightened photo cleanup when replacing photos, including aligned uploads
that no longer have a face-pair reference. Cleanup now preserves any image still referenced elsewhere.

On this branch, `npm test` passes 207 tests, `npx tsc -b` is clean, and `npm run build` passes. All
four new browser scenarios pass, including the focused host workflow: create a group, manually draw
and pair two faces, switch both people into play, add a single-photo person, play, and verify the two
group slides and final singles slide. The full Playwright suite has the same ten known startup helper
failures recorded below; no new failure was introduced.

## Completed work

Tasks 5–8 were implemented in plan order and committed separately. Task 8 adds browser coverage for
version 1 partial-group import and reveal, single-photo people through the final reveal slide, and
version 2 session migration. README and the main handover were updated. A follow-up browser test
covers creating a group in the library and playing it alongside a single-photo person.

## Deviations from the plan already in the code

These happened during Tasks 1–4. The plan text does not show them, so don't "restore" the plan's
version:

- **`migrateEventV2` (`src/core/migrate.ts`) picks the group photos differently.** It uses the Childhood
  vs Now game whose photo ids match the first complete face pair. Only if none matches does it fall
  back to the first game with both ids, and then to the pair's own photos. The plan's version took
  the first game, which could drop every person in an event where a later segment had re-uploaded
  photos. There is a test for it in `tests/unit/migrate.test.ts`.
- **`addEventPeople` (`src/core/people/event-library.ts`) merges the imported people first, then resets a
  demo event.** The plan reset first. The new order matches `replaceEventPeople`.
- **`activities/childhood-vs-now/logic/rounds.ts`**: three legacy `EventUpdate` fallback literals gained
  `photoSets: []` so the build compiles.
- **React 19 typing.** `useRef` values passed as refs need `React.RefObject<HTMLInputElement | null>`
  (see `src/core/people/ImportPairsMenu.tsx`). Expect the same in Task 6's dialog if you add refs.
- **Negative `validateEvent` tests** were added to `tests/unit/session.test.ts`: unknown set, a face on
  the wrong photo, duplicate set order, a missing image, and a single set with ≠1 person. The fallback
  for an unknown setup step is tested there too.

## Decisions already made (keep them)

- **Demo events are never locked.** The first structural change from the People library (add a group,
  add a person, remove a set, Add to library) calls `leaveDemo`. That turns the demo into a normal
  event and resets activity progress, but keeps the people. Inside Childhood vs Now setup, uploading
  over the demo replaces the demo group.
- **The match tolerance slider is local to the matching screen.** The old `matchingTolerance` setting
  stays in the settings schema, unused, so saved sessions keep validating.
- **Replacing only a group's current photo after its childhood photo was aligned** re-scales the
  already-aligned image. This is an accepted limitation.
- **There is no separate test for the Import pairs menu component.** Task 8's first browser test drives
  Add to library and the duplicate dialog end to end, so don't drop that part of Task 8.

## Browser tests: read this before trusting Playwright

At the baseline (before any of this work) **10 of 15 Playwright tests already failed**. Their `home()`
helper waits for the "What are we playing?" home screen, but a fresh browser boots straight into
a running demo game (`src/main.tsx`). The tests that pass use `aioHome()`, which clicks the
"Fun Friday Studio home" brand button first. Failing at baseline:

- full demo: unique sets, two-point scoring, refresh, finale and group wipe
- demo pair bundle replaces the library and restores the whole-team reveal
- setup edits, CSV mapping, local detection, crops, export and import
- offline reload and local model remain available with network disconnected
- unreadable files show a clear error without removing existing photos
- storage failures fall back to a playable temporary session with a warning
- phone layout stays usable without horizontal overflow
- 4200px uploads retain source resolution, align sizes and support manual boxes and pairing
- stealing, retracting a steal, and reaching the event finale through the standings
- three activities carry scores through ZIP restore and a wager changes the winner

In the final full run, 9 of 19 tests passed and 10 failed; those failures are the same ten baseline
failures listed above. All three Task 8 tests and the added Add a group host workflow passed. The bar
for this branch is **no new failures**, plus the Task 8 browser tests passing. Those tests use
`aioHome()`. Fixing `home()` is a separate change.

Run Playwright against the build: `npm run build && npx playwright test --reporter=line`. It serves
`npm run preview` on port 4173. Filter one test with `-g "<name>"`.

## Things to check while doing Tasks 5–8

These were the plan's "review focus" items. The implementation and tests were checked against them:

1. **Clearing a group's name** in the rename field must not save an empty name. The session schema
   requires 1–80 characters, and a saved empty name would make the whole session fail to load and fall
   back to the demo. `renameSet` refuses it, and the input only commits on blur (Task 5).
2. **A group with no finished people** (named, maybe uploaded, never matched) must be skipped by the
   reveal (Task 7). Export already skips it (Task 2).
3. **Duplicate names that differ only by case or spaces** are already handled (Task 2/3).
4. **A stored `slideIndex` past the last slide** must clamp (`clampSlide`, Task 7).
5. **← / → while the wipe slider has focus** must move the slider, not change slides (Task 7 code,
   Task 8 browser test).

## Minor issues deferred from reviews (triage before merge)

- The import menu doesn't close when you click outside it (`ImportPairsMenu.tsx`).
- The Add to library demo hint shows even when the demo library is empty.
- The v2 manifest error formatter relabels `sets.*` errors with a substring check. This is fragile, but
  it mirrors the existing `groups` branch (`src/core/people/pairs.ts`).
- Childhood vs Now `preparePeople` now always moves a segment to the `game` step when finished pairs
  exist. This came from the plan; `startNewGame` still enforces names.
- A half-finished v2 upload (one photo, no pairs) creates no set on migration, and that photo is
  orphaned. This came from the plan.
- `SetUpload` no longer resets `game.rounds` on a photo replace. This is harmless: `startNewGame`
  overwrites the rounds, and validation ignores rounds during setup.

## Completion checklist

1. `npx tsc -b`, `npm test`, `npm run build`, and full Playwright were run. TypeScript, unit tests,
   and build pass. The 10 Playwright failures match the baseline; Task 8's three and the focused host
   workflow pass.
2. The whole branch diff (`git diff main...HEAD`) was reviewed against the spec, with attention to:
   - saved-data safety: migration, `validateEvent`, and anything that could make a saved session fail
     to load;
   - image cleanup on every failure path;
   - the roster lock;
   - the deferred list above.
3. The host flow was exercised in the browser: added a group from the library, drew and paired two
   faces, switched both into play, added a person from two photos, played a game, and stepped through
   the group and singles reveal slides. Existing browser coverage exercises pair export/import,
   duplicate handling, and library replacement.
4. Nothing has been merged or pushed. Wait for the user's go-ahead before either action.

## Files worth knowing

- `src/core/people/photo-sets.ts`: pure library helpers (ordering, create/clear sets, player checks;
  Tasks 5–6 add more).
- `src/core/people/photos.ts`: image-side helpers (store, pair, crop, align; Task 6 adds `suggestFace`).
- `src/core/people/editor/`: `context.ts` (`LibraryContext`, `libraryDraft`), plus `SetUpload`,
  `SetMatch`, `SetNames` and `GroupWizard`. Task 6 adds `AddPersonDialog`.
- `src/core/people/ImportPairsMenu.tsx`, `src/core/people/event-library.ts`, `src/core/transfer.ts`,
  `src/core/people/pairs.ts`: import and export.
- `src/core/migrate.ts` and `src/core/session.ts`: session format 3, the migration, validation.
- `activities/childhood-vs-now/setup/PeopleStep.tsx`: the new first setup step.
- `activities/childhood-vs-now/stage/Finale.tsx`: rewritten by Task 7.
- `.superpowers/sdd/2026-09-23-multi-group-people-library/`: the per-task briefs, reports, review diffs
  and the progress ledger from Tasks 1–4. This folder is git-ignored scratch; everything that matters
  from it is in this file.
