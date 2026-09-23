# Handover — Act It Out, and two things left open

Written 2026-09-23, at the end of the session that built the `act-it-out` branch.
Read `HANDOVER.md` first if you have not: it explains the event architecture this activity plugs into.

There are two pieces of work queued here, plus context you will need for both.

1. **Customisable prompts for Act It Out** — wanted, deliberately NOT designed or implemented yet.
2. **The Childhood vs Now "whole team reveal" is broken** — diagnosed in this session, not fixed.

---

## Where the branch is

Branch `act-it-out`, 14 commits from `dbe0955`. Worktree at `.worktrees/act-it-out`.

Act It Out is complete and playable: prompt deck, schemas, turn logic, registration, two setup steps,
play stage, activity finale, and an instant demo. `npm test` is 145/145. `npm run build` passes.
`npx tsc --noEmit -p .` is clean.

Built from `docs/superpowers/specs/2026-09-22-act-it-out-design.md` via
`docs/superpowers/plans/2026-09-22-act-it-out.md`. Every task was reviewed; the full audit trail,
including every ruling made and why, is in `.superpowers/sdd/2026-09-22-act-it-out/progress.md`.
That ledger is git-ignored scratch — read it before it disappears.

**Not done: Task 12, the README.** The user chose to skip it. So Act It Out ships undocumented:
hosts have no written instructions, and the README's "How to add a new activity" section does not
mention the two optional `Activity` fields this branch added (`order` and `card`, both below). The
plan's Task 12 contains the drafted prose if you want to finish it — but verify every number in it
against the code, because it was written before implementation.

### What this branch changed outside its own folder

Four changes to shared code, each forced by being the *second* activity. All were reviewed.

- **`Activity.card?: { label, eyebrow, tags }`** (`src/core/types.ts`). `Home.tsx` used to hardcode
  Childhood vs Now's card copy — "THE NOSTALGIA EDITION", "No repeated photos" — for every activity.
  Each activity now supplies its own; `Home` falls back to the old strings if one omits it.
- **`Activity.order?: number`** (`src/core/types.ts`, sorted in `src/core/registry.ts`). Discovery is
  `import.meta.glob`, which returns paths **alphabetically**, so `act-it-out` silently displaced
  `childhood-vs-now` as `getActivities()[0]` — the activity that greets a first-time visitor
  (`src/main.tsx`) and the default for the People-library setup path (`src/app/App.tsx`). Childhood
  vs Now is `order: 0`, Act It Out is `order: 1`. **If you add a third activity, give it an `order`**,
  or a filename will decide your running order.
- **`src/core/play/Timer.tsx` renamed to `TimerView.tsx`.** It differed from its sibling `timer.ts`
  only in casing, so on a case-insensitive filesystem (macOS default) TypeScript resolved the wrong
  file and the component was unimportable. Act It Out's stage is its first-ever consumer. Follows the
  existing `WagerView.tsx` precedent — `wager.ts`/`Wager.tsx` hit the same collision earlier.
  **`src/core/play/Wager.tsx` is still a dead 37-byte shim** with that same defect; nothing imports
  it and nothing can. Consider deleting it.
- **`App.tsx` decoupling**: the demo banner is now scoped to activities that have an `upload` step
  (its copy and its jump target are Childhood vs Now's), and the stage footer derives its shortcut
  hints from `activity.shortcuts` instead of hardcoding them.

---

## 1. Customisable prompts for Act It Out — NOT designed yet

The user wants this. It was explicitly deferred: **do not start coding it.** Run
`superpowers:brainstorming` first — this is a design question, not a typing question.

### What already exists

Act It Out already has basic customisation, and you should understand it before designing more:

- `Settings.customPrompts: string[]` — free text, one prompt per line, entered in the **Choose
  prompts** setup step (`activities/act-it-out/setup/PromptsStep.tsx`).
- Four bundled categories of 30 prompts each in `activities/act-it-out/prompts.ts`: Office Life,
  Movies & TV, Actions, Around the House. Each is individually toggleable.
- `eligiblePrompts()` in `activities/act-it-out/logic/turns.ts` merges them: custom prompts come
  **first**, then the selected bundled ones, then case-insensitive de-duplication — so a host who
  retypes a bundled prompt keeps their own wording.
- `buildDeck()` shuffles that list once at game start and persists the whole deck; turns draw from
  the front via a single `cursor`.

So "customise the prompts" is already partly true. The open question is what more is wanted.

### The decisions someone has to make

Ask the user which of these they actually mean — they lead to very different work:

- **Custom categories**, not just a flat list — so a host can group their in-jokes and toggle them.
  Requires `Settings.categories` to stop being a list of bundled names.
- **Editing or removing individual bundled prompts**, rather than only adding. Today a bundled
  prompt can only be suppressed by turning off its whole category or shadowing its exact text.
- **A reusable prompt library that survives the event**, the way the People library does. Today
  `customPrompts` lives in one segment's settings, so a second Act It Out segment starts empty and
  the text is lost when the event is rebuilt. This is probably the most valuable version and the
  most work — look at `src/core/people/` for the established shape of a shared, event-level library
  with import/export.
- **CSV import**, mirroring the existing names flow in `src/core/people/csv.ts`, which already
  handles quoting, CRLF and BOM. Cheapest path to bulk entry, and the parser is already written and
  tested (`tests/unit/csv.test.ts`).
- **Per-team prompt sets**, so no team sees another's cards. Note this changes the core model: the
  deck is currently ONE shared shuffled sequence with one cursor, and that single-deck assumption is
  load-bearing (see the invariant below).

### Constraints you must respect

- **The deck-cursor invariant.** `stateSchema.superRefine` in `activities/act-it-out/types.ts`
  asserts `cursor === total results across all turns`, and `cursor <= deck.length`. This is the only
  way the state can go quietly incoherent — a card silently skipped or dealt twice. Any change to
  how prompts are stored or drawn must keep that assertion true, or replace it with an equivalent.
- **Undo is deliberately scoped** to the current `acting` turn and reaches back exactly one card.
  That restriction is what keeps `cursor` a truthful position in a single shared deck.
- **Revisiting a finished turn is read-only** for the same reason. Past-turn corrections go through
  the scoreboard's manual ±1 adjustments, not through the deck.
- Everything is offline. No new dependencies, no network, no backend.
- `startNewGame` refuses to start below three cards per turn. That floor is currently duplicated
  across four sites — see the deferred minors below; fix it while you are in here.

---

## 2. BUG: the Childhood vs Now "whole team reveal" does nothing

**Confirmed this session. Pre-existing — `git log` shows the `act-it-out` branch never touched
`activities/childhood-vs-now/stage/Finale.tsx`.** This is not a regression from the new activity.

### Symptom

On the Childhood vs Now activity finale, **The whole team reveal** opens the group view, but:

- the **wipe slider does nothing** — the "now" photo covers the "then" photo completely, at every
  slider position;
- **clicking a person's name does nothing** — no spotlight appears.

### Diagnosis

`activities/childhood-vs-now/stage/Finale.tsx` writes both pieces of state and never reads either
one back for rendering:

- `segment.game.finale.wipePosition` is bound to the slider's `value` and updated `onChange`, but
  **nothing uses it to clip or size the `.wipe-now` overlay.** `.wipe-now` is styled
  `position: absolute; width: 100%; height: 100%; inset: 0`, so it always fully covers the childhood
  photo underneath.
- `spotlight` and `pair` are computed at the top of the component and then **never referenced in the
  JSX**. `pair` is an unused variable. There is no `.spotlight-box` element anywhere in the file.

The stylesheet is the evidence of what was intended. `src/theme/styles.css` (around line 62) fully
styles `.spotlight-box` (including its label callout and transitions), `.wipe-line` (a draggable
white line with a circular handle) and `.wipe-label.then` / `.wipe-label.now` — **none of which the
component renders**. It also sizes `.group-wipe` with
`width: min(100%, calc(var(--group-max-height, 52vh) * var(--photo-ratio)))`, but the component sets
an inline `aspectRatio` instead and never defines `--photo-ratio`, so that `calc()` is invalid and
the declaration is dropped.

The existing browser test agrees with the CSS, not the component. `tests/browser/app.spec.ts` in the
`full demo` test does:

```ts
await page.getByRole('slider', { name: 'Reveal original group photo' }).fill('65');
await page.getByRole('button', { name: 'Asha', exact: true }).click();
await expect(page.locator('.spotlight-box')).toBeVisible();
```

That assertion cannot pass against the current component. It is currently masked because all 10
pre-existing browser tests fail earlier, at navigation (see below).

### Where to start

`Finale.tsx` needs the group-reveal rendering restored: clip `.wipe-now` by `wipePosition`, render
`.wipe-line` at that position, render the `.wipe-label` pair, and render a `.spotlight-box`
positioned from the spotlit person's `FacePair` crop box when `spotlightPersonId` is set.

The geometry is already there and already correct: `paddedRect(pair.now)` from
`src/core/images/math.ts` returns the normalised rect (0–1) for that person's padded face, which is
exactly what `.spotlight-box` needs — multiply by the rendered image box and you have `left`, `top`,
`width`, `height`. `src/components/PhotoEditor.tsx` already positions boxes over an image this way
and is the closest working reference. Because the coordinates are normalised, they scale with the
rendered size for free.

Note the component computes `pair` from `spotlight?.facePairId` already — it is sitting there unused.
Much of the wiring exists; only the rendering is missing.

Do not guess the intended visual: the CSS tells you exactly what each element should look like.

---

## 3. Known pre-existing issue: the browser suite is red

**All 10 pre-existing Playwright tests fail, and did so before this branch.** Verified by building
the base commit `dbe0955` in a throwaway worktree and running the suite there — 10 failed,
identically.

Cause: every one of them starts with a `home()` helper that does `page.goto('/')` and expects the
heading "What are we playing?". But `src/main.tsx` boots by creating a demo segment and running
`createDemo` + `startNewGame`, which leaves the segment's status at `'play'` — and `App`'s initial
route is `'session'` unless the status is `'setup'`. So a fresh visit opens **inside a running demo
game**, never the home screen.

These tests presumably pass in CI (Linux), which would mean they only pass where the cartoon-
generating worker *fails*, leaving the segment in `setup`. Worth confirming.

The user decided to handle this separately, so this branch leaves them alone. The three **new** Act
It Out browser tests pass; they reach home explicitly via the header's `Fun Friday Studio home`
button, using an `aioHome()` helper rather than the shared broken one. Full suite is therefore
13 tests: 3 passing, 10 pre-existing failures.

Whoever fixes this must decide the real question: *should a first visit land on the home screen or
inside a demo?* Then fix either `main.tsx` or the tests to match. Do not just patch `home()` to click
through — that hides the product question.

---

## 4. Deferred minor findings

Logged during review, deliberately not fixed. Full text in
`.superpowers/sdd/2026-09-22-act-it-out/progress.md` (grep for `minor (deferred)`). The ones worth
your attention:

- **The cards-per-turn floor `3` is duplicated across four sites** that must agree:
  `PromptsStep.tsx`, `activity.ts`'s step `validate`, `GameSetupStep.tsx`'s `valid`, and
  `startNewGame` in `logic/turns.ts`. They agree today — verified — but nothing enforces it, and a
  drift lets a host pass a setup screen and then hit a thrown error. Hoist a `turnsFloor()` helper or
  a `MIN_CARDS_PER_TURN` constant into `logic/turns.ts`. **Do this when you touch prompt
  customisation**, since you will be editing those sites anyway.
- `moveTurn` resets the timer even when navigating *backward* into a finished turn, discarding its
  `pausedRemainingMs`. Inert today because a finished turn cannot be restarted; it would matter if a
  review-previous-turn UI ever read that timer.
- `award()` in `logic/turns.ts` copies `scoreEntries` before calling `setRoundAward`, which never
  mutates its input. A harmless extra allocation per Got it / Skip / Undo.
- `registry.test.ts` registers `order-test-*` fake activities with no `afterAll` cleanup. Confirmed
  not to leak across suites under vitest's default per-file isolation.
- Finale's "Not a single skip. Suspiciously good." also fires when a team played zero turns.

---

## 5. Things that cost this session time — read before you start

Three defects were found only because something tried to use shared code for the first time. Expect
more of this: much of `src/core/` had exactly one client until now.

- **Filesystem casing.** `Timer.tsx` vs `timer.ts` made the component unimportable on macOS, and had
  hidden a React 19 type error in its body from the compiler for as long as it existed. `Wager.tsx`
  still has the same defect. If you add a `Foo.tsx` component beside a `foo.ts` module, you have
  written a landmine.
- **`new Map(entries)` keeps the LAST duplicate key.** A one-line dedup in the plan would have
  silently changed Childhood vs Now's footer from "↵ Reveal" to "Space Reveal", because its shortcuts
  list Enter before Space under the same label. Use an order-preserving first-occurrence filter.
- **`getActivities()[0]` is load-bearing in two places** and was decided by alphabetical filename
  until this branch. Hence `order`.
