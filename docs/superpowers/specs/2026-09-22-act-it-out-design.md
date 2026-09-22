# Act It Out Design

## Goal

Add the second activity to Fun Friday Studio: a reverse-charades round where one team acts a prompt
out while a nominated guesser from that team sits with their back to the screen.

This is the first activity from the backlog in `HANDOVER.md`. It is deliberately the one with zero
prep and zero photos, because it is also the first real test of whether the `Activity` contract
generalises. Every abstraction in `src/core/` currently has exactly one client, and that client is
photo-shaped.

## Why reverse charades

The app runs on one laptop driving one projector. Classic charades needs the actor to see a card the
guessers cannot, which on a single shared screen means either hiding the prompt behind a
hold-to-peek control or keeping the screen dark during the most visual activity in the line-up.

Reverse charades inverts the problem. The prompt goes full-screen, the whole team acts, and exactly
one person — the guesser — faces away. The shared screen becomes the point of the activity rather
than an obstacle, no one walks back and forth to the laptop, and the rest of the room can see what
the guesser is failing to.

## Format

- A **turn** belongs to one team and lasts `turnSeconds` (default 90).
- The team works through prompts back to back. The host taps **Got it** or **Skip**.
- Each prompt guessed scores the event's `correct` points. Skips are free and discarded.
- Turns run in team order, repeated `roundsPerTeam` times (default 1).
- No steal. A timed burst has no miss to steal from, and a second sub-phase per turn would cost more
  in pace than it returns in drama.

## Non-goals

- Player devices, a second screen, or anything that makes the guesser's phone part of the flow.
- Automatic turn ending when the timer expires. The host adjudicates everything else in this app;
  the timer goes red and beeps, and the host decides.
- Scoring the actors separately from the guesser. One team, one score.

## Data model

```ts
interface Prompt { text: string; category: string }

interface Settings {
  categories: string[];       // which bundled categories are in play
  customPrompts: string[];    // host additions, one per line
  turnSeconds: number;        // default 90
  roundsPerTeam: number;      // default 1
}

interface Turn {
  id: string;
  teamId: string;
  guesserName?: string;       // optional, shown on the pre-turn card
  results: { text: string; outcome: 'guessed' | 'skipped' }[];
  status: 'pending' | 'acting' | 'done';
}

interface GameState {
  deck: Prompt[];             // shuffled once at game start, then fixed
  cursor: number;             // index of the next undrawn card
  turns: Turn[];
  currentTurnIndex: number;
  timer: TimerState;          // from src/core/play/timer
}
```

### Why a shuffled deck plus a cursor

`startNewGame` collects the prompts from the selected categories plus the host's custom lines,
trims and drops blanks, removes case-insensitive duplicates so a host who retypes a bundled prompt
does not see it twice, shuffles once, and persists the result whole. Turns draw from the front by
advancing `cursor`.

This follows the rule the README already states: "The exact shuffled order and team assignment are
persisted, never recalculated on reload." It also handles the thing a burst turn does that a
Childhood vs Now round does not — consume an unknown number of cards. A fast team takes nine, a slow
team takes two, and neither starves the other.

Two alternatives were considered and rejected. Pre-allocating a fixed slice of prompts per turn
makes validation easier but either strands cards or runs a team dry mid-turn. Storing only an RNG
seed and deriving the deck keeps state small but recomputes on load, and a custom prompt added
between activities would resequence every later turn.

`results` stores the prompt **text**, not an index into `deck`. A turn's record stays readable in an
exported session and survives a host editing the prompt list between games.

### The one invariant worth asserting

`cursor` must equal the total number of results across all turns. That is the only way this state
can go quietly incoherent — a double-tap on Got it that advances the cursor twice would silently
skip a card. A zod `superRefine` on `stateSchema` pins it, so the corruption surfaces at the
registry and import boundary rather than on the projector.

Also asserted: `currentTurnIndex` is in range when `turns` is non-empty, and `cursor <= deck.length`.

## Scoring

One ledger entry per turn, upserted on every Got it and every undo:

```ts
setRoundAward(entries, segment.segmentId, turn.id, turn.teamId, true, guessed * points.correct)
```

No new function in `src/core/scoring.ts`. `setRoundAward` already takes variable `points`, and
because the entry is *derived from* the guessed count rather than incremented, it is idempotent for
free: refresh, undo, and repeated taps all converge on the same number. The entry is written with
`segment.segmentId`, so two activities can never collide in the shared ledger.

`points.correct` already has the segment's `weight` multiplied in by `activitySegment`, so a
line-up that doubles the last activity works with no extra handling here.

## Files

```text
activities/act-it-out/
  index.ts                  registerActivity
  activity.ts               the Activity<Settings, GameState> definition
  types.ts                  zod schemas, Settings, GameState, Context aliases
  prompts.ts                the bundled deck
  logic/turns.ts            allocateTurns, startTurn, markGuessed, markSkipped, undo, endTurn, moveTurn
  setup/PromptsStep.tsx     step id: 'prompts'
  setup/GameSetupStep.tsx   step id: 'game'
  stage/Stage.tsx
  stage/Finale.tsx
```

`remapImages` is the identity function and the activity registers no assets. That is the property
that makes this a genuine test of the contract.

### The bundled deck

`prompts.ts` exports four categories of roughly 40 prompts each: **Office Life**, **Movies & TV**,
**Actions**, **Around the House**. Plain TypeScript, not a JSON asset, so it code-splits into the
activity's own chunk and the service worker precaches it with everything else.

Office Life carries the theme; the other three exist so a room that has exhausted the in-jokes still
has somewhere to go. Prompts are short noun phrases or actions, not sentences.

## Setup steps

**1. `prompts` — Choose your prompts.** Category toggles with live counts, and a textarea for custom
prompts, one per line. Validation: at least `teams.length * roundsPerTeam * 3` prompts available, so
no team can run the deck dry inside a single turn.

**2. `game` — Game setup.** Turn length, rounds per team, and the shared `TeamEditor`. Ends with
**Start new game**, which calls `startNewGame`. Validation: every team named.

The second step **must** keep the id `game`. `App.tsx` hardcodes `id !== 'game'` in `jumpStep` and
in the step-nav `disabled` condition as the only step reachable once `rosterLocked` is true. An
activity whose steps are named anything else becomes unreachable after an earlier activity has been
played. This is a latent coupling in the core; see *Core changes* below.

## Play

Three sub-states inside `phase: 'play'`, driven off `turn.status`:

**pending** — "Deadline Dodgers, you're up." An optional guesser-name field, a reminder that the
guesser faces away from the screen, and a large **Start turn** button that starts the timer and
moves the turn to `acting`.

**acting** — the prompt at display size, the shared `Timer`, and **Got it** / **Skip**. A running
tally of the turn so far. Timer expiry turns the panel red and fires the existing five-second
countdown beeps; it does not end the turn.

**done** — the turn summary: guessed, skipped, points added. **Next team**, or **Final results** on
the last turn.

The shared `Scoreboard` sits alongside the stage as it does in Childhood vs Now, with the acting team
highlighted.

`moveTurn` lets the host step back to an earlier turn, matching the round-square affordance in
Childhood vs Now. Revisiting a completed turn is **read-only review**: it shows what that team got,
and nothing there can be edited. To correct a past turn, the host uses the Scoreboard's manual ±1
adjustments, which already exist and already write `manual-adjustment` entries to the ledger.

This matters because the cursor is a single position in one shared deck. Editing a finished turn's
results would either strand a card or hand a card to two teams. Keeping corrections in the ledger
rather than in the deck sidesteps that entirely.

Moving forward off the last turn, once every turn is `done`, sets `phase = 'finale'`.

### Shortcuts

| Key | Action |
| --- | --- |
| Space or Enter | Got it |
| S | Skip |
| Z | Undo the last card |
| Left / Right | Previous / next turn |

Undo removes the last entry in the **current** turn's `results`, decrements `cursor`, and re-upserts
the score entry. It is available only while `turn.status === 'acting'`, and only back to the start of
that turn — it can never reach into a finished turn. That restriction is what keeps `cursor` a
truthful position in the deck: the only card undo can return is the one most recently drawn.

It is the only control that moves the cursor backwards, and the `superRefine` invariant covers it.

## Finale

Per-team totals for the activity, the single best turn, and the prompts that were skipped — the
"nobody got these" list, which is reliably the funniest screen. Then the existing
`segment-finale-bar` carries the host to standings.

This is the lowest-value part of the spec. If the plan runs long, omit `Finale` and the event goes
straight to the leaderboard, which the contract already supports.

## Demo

`createDemo` builds a demo with no async work at all — no worker, no image generation, no photos.
It allocates turns against the default teams and pre-fills the first turn's results so the home-card
`Preview` and the demo path have something to show.

This is worth building specifically because the existing demo path is expensive and photo-bound. A
second, instant demo proves `createDemo` is not secretly a Childhood vs Now hook.

## Core changes

Three couplings to Childhood vs Now in `src/app/App.tsx` that a second activity exposes. All three
are small, and all three are the kind of thing that should be fixed by the activity that reveals
them rather than worked around inside it.

1. **`jumpStep` and the step nav hardcode `'game'`** (`App.tsx:87` and the `setup-steps` nav). The
   rule intended is "the roster-independent step stays reachable when the roster is locked." Keep
   the behaviour for now by naming our step `game`, and record the coupling. Generalising it needs a
   flag on `setupSteps` (`rosterIndependent: true`), which is a contract change and belongs in its
   own spec rather than riding along with this one.

2. **The demo banner is Childhood vs Now's** (`App.tsx:104`). It renders for any `isDemo` segment,
   says "These are locally generated cartoons", and jumps to `setupStepId = 'upload'` — a step Act
   It Out does not have, which would leave the host on a blank screen. Guard it so it only renders
   when the current activity has a step with id `upload`. One condition.

3. **The stage footer hardcodes CVN's shortcut hints** (`App.tsx:116`): `↵ Reveal`, `C Correct`,
   `M Missed`. Derive the hints from `activity.shortcuts` instead. The shortcuts modal already does
   exactly this, so the footer is just behind.

Nothing in `src/core/` changes. No schema version bumps. No migration: this is a new activity at
`version: 1`, and `migrate` throws as Childhood vs Now's does.

## Testing

**Unit (`tests/unit/act-it-out.test.ts`)**

- `allocateTurns` produces `teams.length * roundsPerTeam` turns in team order.
- The cursor invariant holds across guess, skip, and undo sequences, including undo at a turn
  boundary.
- A turn cannot consume past the end of the deck; the stage shows a spent-deck state rather than
  drawing `undefined`.
- Undo is refused once a turn is `done`, and cannot reach past the start of the current turn.
- `startNewGame` de-duplicates a custom prompt that repeats a bundled one.
- Scoring is idempotent: marking the same turn repeatedly, and undoing to zero, both converge.
- Score entries are segment-scoped — a second segment's entries never alter the first's total.
- `stateSchema` rejects a desynchronised cursor.

**Browser (`tests/browser/app.spec.ts`)**

- A full two-team Act It Out run from line-up through finale to standings.
- Refresh mid-turn restores the remaining time, the cursor, and the tally.
- An event with **both** activities in the line-up, confirming the shared leaderboard sums across
  them and that `rosterLocked` does not strand the host in Act It Out's setup. This is the test that
  actually validates the event architecture, and it does not exist today.

## Open question deferred

Assigning people to teams. The guesser is free text because `Person` has no `teamId` — the People
library is a flat roster. Naming the guesser from the library would need team membership, which is
an event-level model change affecting every activity. Free text costs nothing and can be replaced
later.
