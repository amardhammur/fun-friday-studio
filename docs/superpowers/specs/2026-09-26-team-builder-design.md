# Team builder — 26 September 2026

Status: approved for implementation. Scope: `TEAM-BUILDER-PROMPT.md`, amended by the host's clarification that this app is pre-ship and backward compatibility is unnecessary.

## Outcome and data

Hosts build an event roster from included library people and extra names, then assign players to 2–8 persistent teams. Add `Player { id, name, personId? }`, `event.players`, and `Team.memberIds` / `Team.pinnedIds`. Keep `formatVersion: 3`; default arrays to `[]`, but do not preserve historical one-team events or add legacy compatibility tests. Every new save must validate after reload. Enforce unique player IDs, unique linked person IDs, existing person/member references, at most one team per player, and pins that belong to their team's members. Unassigned players and empty teams are valid.

## Roster and synchronization

Prefill on the first visit to the builder, recording `playersInitialized` (default `false`) so removing everyone stays effective after navigation or reload. “Pull from people library” explicitly adds missing included people, deduplicated by person ID; distinct people may share a name. Reconcile existing links on library changes: update names and remove excluded/deleted people from the roster, memberships, and pins. Automatic reconciliation never re-adds a deliberately removed player. Extras survive library replacement; obsolete linked players are removed.

New extras use one name per line, trimming whitespace and discarding blanks and case-insensitive duplicate names against the roster and paste. This does not use or modify CSV parsing. Commit only nonempty names. The library currently permits unnamed people and temporary blank edits: first pull uses a numbered “Person N” fallback; subsequent blank edits retain the player's last valid name until a nonblank name is supplied.

## Assignment algorithms

Pure functions in `src/core/teams/shuffle.ts` accept injected randomness. Place pins, Fisher–Yates shuffle remaining players, and deal to the currently smallest teams with a rotating tie-break. Preserve IDs, names, colours, and pins. A successful shuffle assigns each player exactly once and has maximum size minus minimum size ≤1. A repeat may coincidentally match a previous random split; pins or tiny rosters can also force a unique result.

**Approved policy:** pins can make balance impossible (8 players, 4 teams, 3 pinned to one team). Refuse that shuffle without modifying assignments and show “Unpin players or reduce the team count to balance these teams.” Check feasibility against floor/ceiling target sizes before dealing. This preserves both pin placement and the balance guarantee for successful shuffles.

Changing count preserves the first teams, adds/removes only at the end, and returns removed members to “Not on a team.” Confirm before removing pinned members' teams; cancelling changes nothing. Manual moves may be unbalanced and carry a player's pin to the destination; unassigning clears the pin.

Childhood vs Now retains the current allocation path exactly when there are no linked members. Otherwise use capacity-constrained matching of included people to the existing team photo quotas, maximizing assignments to teams other than their own. Fill unmatched capacity as fallback; report the minimum unavoidable own-member photo count in setup. Retain every person exactly once, earlier-team remainder quotas, and persisted rounds. Do not change repeated-face behavior across activities.

## UI and locking

The Lineup Event teams panel contains the roster, library badges, add/paste input, pull/remove actions, count stepper, Shuffle/Shuffle again, team cards with editable identity, pin buttons and move selects, and an unassigned tray. Setup `EventTeams` summaries include member names. Distinguish warning severity in `lineupIssues`; unassigned players never block starting.

Reuse `libraryLocked` / `segmentStarted`, including paused progress and the existing demo exception. Disable shuffle, count changes, remove, pin, and reassignment when locked; allow adding a new arrival directly to an existing team. Existing planning navigation is inaccessible during play: add an Event overview “Manage teams” entry opening the planning view without changing the persisted event phase, with other planning edits disabled and a return action. Preserve games, clocks, scores, and wager stage. Use the existing message: “The roster is locked after an activity starts. Use Import pairs → Replace library to start over.”

Use existing tokens, labelled keyboard controls, and buttons at least 44px high. Ink team rows use rules and 28px colour squares from the handoff README / final artboard; `ref/lineup.png` depicts the old theme, as documented in `INK-REVIEW.md`. Scope Ink styling to the teams panel. No projector member list or other Ink slices.

## Delivery and evidence

Follow the prompt's four test-first feature commits: schema; pure shuffle; roster UI/sync/locking; constrained photo allocation. Named coverage will include new-save validation, paste deduplication, seeded shuffle/balance/pins/impossible pins/count changes/one player with eight teams, linked-name and removal sync, late-arrival locking, demo roster isolation, and lossless roster/membership/pin session-ZIP import. Add the specified library → paste → four teams → pin/reshuffle → CVN → reload → ZIP browser journey, plus fallback-warning coverage. Re-run existing F02/F03/N01/N02/N03 regression tests, `npm test`, `npm run build`, and full `npx playwright test`; record actual passing test names at completion. Capture 1440px teams panels in all three themes under `ux-review/teams/` and update README Host workflow.

Follow-ups: team reveal moment. Act It Out member picker/rotation with “Other…” and string `guesserName` is stretch work only after all required work is green.
