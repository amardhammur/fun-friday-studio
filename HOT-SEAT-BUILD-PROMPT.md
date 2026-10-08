# Prompt: Build "The Hot Seat" activity

You are a **senior full-stack engineer** on **Fun Friday Studio**, an offline React 19, TypeScript and Vite party-game app. Build the third activity, **The Hot Seat**, as specified in `docs/superpowers/specs/2026-09-27-hot-seat-design.md`. Read that spec fully first.

## Read before coding
- `README.md` §"How to add a new activity"
- `ARCHITECTURE-REVIEW.md` §7 (the "Adding activity #3" walkthrough) and `ARCHITECTURE-REVIEW-VERIFICATION.md` (the guarantees you must keep: F01–F03, N01–N03, F09)
- Both existing activities, `activities/act-it-out/*` and `activities/childhood-vs-now/*`, used as reference implementations
- `src/core/types.ts` (the `Activity` contract, including `hasProgress`/`progressLabel`/`onPause`/`onResume`), `src/core/scoring.ts`, `src/core/play/*`
- The team-builder work, if it has landed: `event.players` and `Team.memberIds`. If it hasn't landed, guests are typed by name; design so members can plug in later.
- `design_handoff_ink_paper/README.md`, for the show-mode and Ink & Paper styling rules

## Build order (one commit per step, write tests first)
1. **Types and logic:** `activities/hot-seat/types.ts` (zod settings and state, version 1) and `logic/*.ts`:
   - clue reveal
   - correct, wrong and lock-out, with 5/3/1 points by the number of clues shown
   - all teams can guess, including the guest's own; no points if nobody guesses
   - a shuffled guest order, with nothing on stage revealing the guest's team before the reveal
   - live answers, pass (one free), gong, star and undo, with the 10-point cap
   - the multiplier
   - deterministic, team-qualified ledger IDs
   - timer hold and release
   - `hasProgress` and `progressLabel`

   Unit tests must cover every scoring path, undo after each kind of action, a reload mid-live-round and a test that the Mystery card shows no team-identifying information.
2. **Question bank:** `prompts.ts` with the six default categories (about 15 office-safe questions each), kept to the spec's guardrails. Clue and live questions come from separate banks.
3. **Setup steps:** Guests → Green Room (on-laptop private form plus CSV template export and import, mapping headers by name) → Questions (switch categories on or off, custom questions) → Game setup (the last step's id must be `game`).
4. **Stage:** Mystery card → Reveal (with the library photo when the guest is linked to a person) → Live Rapid Fire → Guest wrap → optional Answer of the Night → `Finale.tsx`. Every host control goes through `shortcuts`, so the host rail and the shortcuts modal show them. Meet the show-mode type floor (at least 18px mono and 20px body at 1920×1080).
5. **Demo** (`logic/demo.ts`): four fictional guests with answers, isolated from the personal event.
6. **Browser test:** add Hot Seat to a lineup after Act It Out, run two guests through both beats (including a wrong guess, a gong, a pass and an undo), reload mid-live-round, finish, check the standings, then export and re-import the ZIP.

## Rules
- Stick to the plugin contract. The only core change you should need is the team-qualified award helper. If you need anything else in `src/`, stop and explain why first.
- Style it for all three themes. Ink & Paper rules go under `[data-theme="ink"]`.
- No network, no new dependencies and no audio in v1.
- Keep every guarantee listed in the verification report. `npm test`, `npm run build` and the full `npx playwright test` suite must all be green at the end.
- Update the README with the host workflow and the Green Room instructions.

## Done when
- [ ] Steps 1–6 are committed and green.
- [ ] There are screenshots of each stage screen in all three themes at 1920×1080 in `ux-review/hot-seat/`.
- [ ] There's a short summary covering what was built, any deviations from the spec, and follow-ups (sounds, team reveal).
