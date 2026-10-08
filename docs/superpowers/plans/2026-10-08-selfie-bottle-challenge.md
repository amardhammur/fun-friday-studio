# Selfie Bottle Challenge Implementation Plan

**Goal:** Add the requested physical challenge to the existing offline event studio.

**Architecture:** Register a self-contained activity with roster-based setup, configurable player turn order, per-turn shared deadline timers, host-confirmed results, and a finale. Derive one segment-scoped award per team from confirmed counts and the lineup multiplier.

**Spec:** The user's Selfie Bottle Challenge request in this session.

**Execution:** Implement directly in the current workspace, then verify; skip TDD as explicitly requested. No new dependencies or camera integration.

**User amendment:** Keep the screens simple, with no narrated rules or player names on stage/results. No manual player selection is needed; starting snapshots the first available roster players for equal participation. Start activity appears first, with player count, time and turn order inside an optional collapsed Options panel. Offer one team at a time (default) or alternate teams; preserve equal participation in both orders.

## Tasks

- [x] Implement schemas and turn logic in `activities/selfie-bottle-challenge/types.ts` and `logic.ts`: 3 unique roster players per team by default (1/2 options), equal 60-second turns (45 option), 10 toothpicks, persisted timer/result state, idempotent team awards, corrections, scoped restart, and import reference validation.
- [x] Add registration, setup, stage, saved count entry, preview, demo, and final standings under `activities/selfie-bottle-challenge/`. Reuse theme tokens, timer, scoreboard, pause hooks, and activity discovery. Add optional reset-control and expiry callbacks to the shared timer without changing existing callers.
- [x] Update activity-list expectations and host documentation. After implementation, verify the new physical-game flow, timer refresh/expiry/pause behavior, zero and ten counts, ties, repeated confirmations, corrections, session ZIP transfer, and restart isolation.
- [x] Run existing unit checks, activity-discovery check, relevant browser checks, and `npm run build`; review changes and address material findings.

## Review focus

- Undersized teams must prevent starting; stale setup selections are replaced automatically from team rosters. Saved participation snapshots remain stable across pause, refresh and import.
- Refreshing an expired timer must open count entry; pausing must preserve the remaining time.
- Visiting an earlier result must not reset or abandon another player's running timer.
- A zero count is confirmed participation, and repeated confirmation/correction must not duplicate points.
- Imported player references, turn order, timer lengths, and result states must stay consistent with the saved setup.

## Verification

- `npm test`: 33 files, 336 tests passed.
- Latest relevant Playwright suites (`selfie-bottle-challenge`, `event-welcome`, `demo-isolation`): 17 tests passed. Earlier registration and show-mode checks also passed.
- `node --test tests/dev/activity-discovery.test.mjs`: passed.
- `npm run build`: passed; offline cache contains 44 assets.
- `git diff --check`: passed.
- Reviewed stage, timer, finale, and mobile captures. All three themes have browser layout coverage.
- Independent review findings addressed: imported extra time and duplicate awards are rejected, and the active timer/buzzer remains mounted during prior-result corrections. A mocked audio browser check verifies the zero-second buzzer.
