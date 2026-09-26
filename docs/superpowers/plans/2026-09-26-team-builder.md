# Team Builder Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an event roster, shuffle persistent teams, and avoid own-member photos.
**Architecture:** Event-owned players and memberships, pure roster/shuffle operations, one reusable team editor, and constrained CVN allocation. Synchronize library edits before persisting event updates.
**Tech Stack:** React 19, TypeScript, Zod, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-09-26-team-builder-design.md`

## Global Constraints

- Teams: 2–8. Keep formatVersion 3. Backward compatibility is not required.
- Preserve pins; reject impossible balanced shuffles atomically.
- Reuse libraryLocked and segmentStarted, including pause semantics.
- No projector member list; only teams-panel Ink styles.
- Commit only task-owned files; preserve existing uncommitted review assets.

## Review Focus

- An empty roster after deliberate removals must stay empty after reload (task 3).
- Temporary blank library-name edits must not create invalid saves (task 3).
- Several pinned teams can require more ceiling-size slots than available (task 2).
- Opening team management during a game must preserve phase, timer, and scores (task 3 browser).
- A naive greedy photo assignment may create avoidable own-member photos (task 4).

### Task 1: Schema and event projections

Files: `src/core/types.ts`, `session.ts`, `event.ts`, `people/event-library.ts`, demo constructors and typed fixtures; `tests/unit/team-schema.test.ts`.
Produces: `Player`, required `EventSession.players/playersInitialized`, `Team.memberIds/pinnedIds`, and players in `ActivityEvent/EventUpdate`.

- [ ] Write tests: memberships/pins survive JSON validation; invalid references, duplicate membership, invalid pins and empty names reject; event projections retain roster.
- [ ] Run `npm test -- tests/unit/team-schema.test.ts`; observe missing-field/validation failures.
- [ ] Implement defaults and reference checks; update constructors and fixtures without altering activity behavior.
- [ ] Run `npm test` and `npm run build`; expect success.
- [ ] Commit `feat(teams): add players roster and team members to the event schema`.

### Task 2: Pure assignment

Files: `src/core/teams/shuffle.ts`, `tests/unit/team-shuffle.test.ts`.
Produces: `shuffleTeams(players, teams, random?)`, `resizeTeams(teams, count, confirmed?, makeId?)`, `pinBalanceIssue(players, teams)`.

- [ ] Write tests for unique balanced membership, immutable identity/pins, deterministic seeds, impossible pins including excess ceiling slots, count changes/confirmation and one player with eight teams.
- [ ] Run targeted tests; expect missing-module failure.
- [ ] Implement Fisher–Yates and smallest-team dealing, feasibility validation, and count changes.
- [ ] Run `npm test`; expect success.
- [ ] Commit `feat(teams): shuffle players into balanced teams`.

### Task 3: Roster, editor, navigation, locks

Files: `src/core/teams/roster.ts`, `TeamEditor.tsx`, `EventTeams.tsx`, `src/app/{App,Lineup,EventOverview}.tsx`, `lineup-logic.ts`, setup summaries, CSS; `tests/unit/team-roster.test.ts`, `tests/browser/team-builder.spec.ts`.
Consumes task 1 event types and task 2 operations. Produces pure pull/sync/add/remove/move/pin operations guarded by libraryLocked, and accessible UI.

- [ ] Write unit cases for prefill-once, explicit pull, duplicate paste, linked rename/exclusion/deletion, library replacement, locks and late additions, warning severity.
- [ ] Write browser cases for roster management, pin/cancel/removal, locked route preserving state, demo isolation, invalid input, theme screenshot capture.
- [ ] Run unit/browser cases before implementation; observe missing behavior.
- [ ] Implement roster operations, centralized reconciliation, team editor and non-mutating planning route; distinguish blockers from warnings. All buttons ≥44px.
- [ ] Run unit suite, build and targeted browser tests; expect success.
- [ ] Commit `feat(teams): build teams from the people library on the lineup`.

### Task 4: CVN allocation and completion

Files: CVN `logic/rounds.ts`, `setup/GameSetupStep.tsx`, allocation unit tests, browser journey, README and `ux-review/teams/`.
Consumes players/member IDs. Extends `allocateRounds` with optional players after existing random argument; exposes affected-photo count for setup.

- [ ] Write allocation cases for zero avoidable self photos, exact minimal fallback count, balanced quotas, a greedy trap, no repeats, and unchanged no-member output.
- [ ] Extend browser journey: pull → paste two → four teams → shuffle → pin → reshuffle → CVN → reload → ZIP round trip.
- [ ] Run tests; observe own-member assignment failures.
- [ ] Implement maximum matching to non-own photo slots, then fill unmatched slots and show fallback warning.
- [ ] Update Host workflow; run `npm test`, `npm run build`, full `npx playwright test`; capture all three themes at 1440px.
- [ ] Commit `feat(cvn): avoid dealing teams their own members' photos`.
- [ ] Review whole branch; fix material findings with failing regression tests. Record named tests and final counts.

## Execution ledger

- Baseline: 248 unit tests pass. Branch: feat/team-builder; work in the shared checkout to retain the supplied untracked design references.
- Approved: implementation and infeasible-pin rejection. Backward compatibility waived by user.
- Interface review: tasks 2–4 consume task 1 arrays; roster reconciliation must also prune pins; CVN consumes person links, not names.
