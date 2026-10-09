# Clip to Stage Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline. Steps use checkbox syntax for tracking.

**Goal:** Add a clip-based team performance activity with offline media, timers, and host-entered judge totals.

**Architecture:** Register an independent `activities/clip-to-stage` module. Keep configured media in settings and game progress in state, using the existing IndexedDB blob store and event ledger. Extend the archive's activity remapping with an optional settings hook for local video IDs.

**Tech Stack:** Existing React, TypeScript, Zod, IndexedDB, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-clip-to-stage-design.md`

## Global Constraints

- No dependency or backend is added.
- There are 2–8 named event teams.
- Scores are nonnegative whole points, including zero, entered as actual totals without a multiplier.
- Start timers only on host actions; expiry never advances a phase.
- Local clips are saved in IndexedDB, work offline, survive reloads, and are included in session ZIPs.
- Keep all existing activities and uncommitted changes.

## Review Focus

- Invalid or unsupported clip URLs cannot create an unsafe iframe or enable Start.
- Missing, oversized, or unplayable local clips show a useful error without losing the current selection.
- ZIP import remaps configured video IDs and supports actual offline playback after import.
- Pause/Resume retains remaining time and reopens finished results correctly.
- Corrections preserve manual adjustments and other activities and never duplicate awards.

## Task 1: Activity rules, state, and score ledger

**Files:** Create `activities/clip-to-stage/{types,logic,source,activity,index}.ts`; test `tests/unit/clip-to-stage.test.ts`.

**Interfaces:** Produces `Settings`, `Game`, `Context`, `defaultSettings`, `initialState`, `youtubeReference(url)`, `setupIssues`, `startNewGame`, `advance`, `next`, `setScore`, `saveScores`, `editScores`, timer pause/resume hooks, and `validateSession`.

- [x] Write tests for registration, source validation, ordered phases, explicit timers, all-score gating, exact totals, corrections, reloads, and missing assets.
- [x] Run `npm test -- tests/unit/clip-to-stage.test.ts`; expect failures before the activity exists.
- [x] Implement the module and activity registration with `order: 6`, name `Clip to Stage`, version 1.
- [x] Run unit tests and confirm all assertions pass.

## Task 2: Video storage, setup, and stage UI

**Files:** Create `activities/clip-to-stage/{Setup,Stage,Finale,ReferenceVideo,Preview}.tsx`, `media.ts`, `style.css`; modify `src/core/{types,transfer}.ts`, `src/core/people/event-library.ts`, and `index.html`; test `tests/browser/clip-to-stage.spec.ts` and `tests/unit/transfer-remap.test.ts`.

**Interfaces:** Consumes Task 1 types and logic; adds optional `Activity.remapSettings(settings, ids)` and calls it from `remapEventImages`. `storeVideo(file)` validates metadata and stores the clip durably, returning an existing `Asset` shape.

- [x] Add settings/media remapping tests and browser checks for local playback offline, refresh, export/import, invalid input, complete host flow, corrections, pause/resume, and mobile/projector layouts.
- [x] Run targeted checks and observe expected failures.
- [x] Implement source configuration, explicit YouTube load/fallback, local video controls, practice/performance screens, score fields, and results using existing UI patterns.
- [x] Verify tests and inspect screenshots.

## Task 3: Discovery, documentation, and final verification

**Files:** Update current activity lists in `tests/unit/removed-activities.test.ts`, `tests/browser/removed-activities.spec.ts`, and `tests/dev/activity-discovery.test.mjs`; update `README.md`; create `activities/clip-to-stage/README.md`.

- [x] Add the activity to library/lineup expectations without changing the existing order.
- [x] Document source requirements, offline playback, timing, scoring, corrections, and transfer.
- [x] Run `npm test`, `npm run build`, and focused Playwright suites; confirm success and inspect layouts.
- [x] Request one read-only final review and fix any material findings with regression coverage.

Execution record: work continues in the supplied shared workspace so existing uncommitted activities and fixes remain together for the user. No commit, branch integration, or publication is requested.

Verification: 363 unit tests pass; production build passes; 7 Clip to Stage, 2 activity discovery/restore, 8 Commercial Clash, and 2 photo library/ZIP browser checks pass. Development discovery check passes. Screenshots inspected in all three themes, on a 720p projector, and on mobile. One read-only final review found a photo-library replacement issue; its regression now passes with uploaded video assets retained. Live YouTube checks confirmed that the requested music video is rejected by both standard and privacy-enhanced embeds, while the official example loads. The activity offers an external YouTube fallback and retry control.
