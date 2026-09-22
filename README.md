# Fun Friday Studio

A private, offline activity studio for office events. Built from an empty repository with React, TypeScript, Vite, and a chalkboard-style theme.

The first activity is **Childhood vs Now**. Each team gets its own unique batch of childhood portraits and plays its batch in turn. The host reveals the current portrait and name, then marks **Correct (+2)** or **Missed (0)**. A person appears **only once in the entire game**. There are no hints, clarity levels, zoom puzzles, or timers.

Activities run as an **event**: the host builds a line-up, and every activity shares one set of teams and one running leaderboard. Standings appear between activities, and the event can end with a final wager where teams bet their points on one last question.

## Quick start

Use Node.js 22.12+ (Node 24 LTS recommended).

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The first visit generates four paired cartoon portraits in a worker. **Try the demo** runs a complete sample game; **Set up your game** opens the host workflow.

Production build and local event server:

```sh
npm run build
npm run preview -- --port 4173
```

Open `http://127.0.0.1:4173`. The output is the standalone `dist/` directory; the preview server only serves static files. There is no application backend.

## Running offline

All runtime assets are local: JavaScript, fonts, the MediaPipe runtime, WASM, and the face detector model. No CDN or API key is needed. Photos are never sent to a server. The detection worker rejects external network requests, including telemetry from dependencies.

1. Install dependencies and build before the event. Internet is required for the initial `npm ci`, not for subsequent local use.
2. Run the production preview server at the same URL you used to prepare the game.
3. Wait for **Offline ready** in the header. This means the complete asset cache is installed and the page is controlled by the service worker.
4. Disconnect from the internet and reload once to check your event setup.
5. Export a session ZIP after preparing the photos. Keep it on the host laptop.

The development server does not install a service worker; it displays **Local & private**. Use a production build to test offline reloads. Opening `index.html` through `file://` is unsupported: use localhost or an HTTPS static site. An installed offline cache also allows the prepared production URL to reopen without its static server, as long as the browser retains that cache.

The face detector assets are included under `public/`. To refresh them after intentionally updating MediaPipe:

```sh
npm run prepare:assets
```

This copies the installed WASM files and downloads the pinned BlazeFace model only if missing. It needs internet only when a required model or license is absent. Build fails if essential model assets are missing.

## Prepare the two photos

- **Original group photo (now):** the full-resolution photo of your colleagues.
- **Childhood group photo (then):** the same photo, already edited to make everyone look 5–6 years old. This app does not generate childhood versions of real people.
- Keep the same scene, layout, and ordering. Small shifts or smaller childhood faces are fine.
- Prefer JPEG, PNG, or WebP. Convert HEIC/HEIF to JPEG first. Unreadable files produce a visible error without deleting the previous photos.
- Both source files are retained. A childhood working image is scaled to the original photo’s orientation-corrected dimensions when necessary. Avoid different aspect ratios: stretching matches the canvas size but cannot repair a changed composition.
- Full resolution is used for crops; 1600px previews keep the editor light. Exported face crops are JPEGs with an approximately 1100px long edge. Upscaling small source faces does not invent extra detail.

## Host workflow

0. **Build the line-up.** Choose the activities in running order, set a points multiplier for later rounds, name your teams, and optionally write one final wager question. Or start a single activity straight from its card on the home screen.
1. **Upload photos.** Drop one file into each zone. Replacing a photo clears its old matches and game progress after confirmation.
2. **Match people.** Detect both images locally. Overlapping image tiles help with small faces in a large group. Review all automatic suggestions; edited faces may be missed. Adjust the matching tolerance before detection if needed.
   - **Adjust:** select a box, drag it, or resize from its bottom-right handle. Numeric crop fields provide keyboard access.
   - **Add face:** draw a missing box; then connect it to the opposite photo using **Pair faces**.
   - **Pair faces:** click one face in each photo. Swapping a match never duplicates a face. Manual edits and confirmed pairs survive re-detection.
   - **Delete this face:** remove a false detection. Unmatched faces are visibly flagged and excluded by default.
   - **Overlay:** blend both photos and choose which layer to edit.
3. **Name people.** Enter names, optionally add a fun fact for after the reveal, adjust hair/shoulder padding, or exclude/delete people. Focusing a name highlights the same numbered person in both photos.
4. **Game setup.** Edit 1–8 teams (four by default), choose shuffle, and review photo counts. The first teams receive any remainder: 50 people across four teams yields 13, 13, 12, 12. For equal opportunities, choose a divisible number of people or teams. Each team needs at least one photo to start.
5. **Play.** Show the childhood portrait, reveal the current portrait and name, then mark the assigned team’s result. Correct is two points. If the assigned team misses, the round opens to the other teams and a steal is worth one point. Marking the owning team Correct afterwards retracts the steal, so a round can never pay out twice. The scoreboard also provides manual ±1 adjustments.
6. **Finale.** See the winner(s), podium, and other scores. The group reveal starts with the full childhood image. Move the slider to reveal the original photo, or spotlight a named person. Play again starts a new shuffled game and resets scores.
7. **Standings.** Between activities, the leaderboard shows the running total, what each team gained in that round, and the biggest climber.
8. **Final wager.** Each team bets between 0 and their current score (a team on zero may still bet 5), the question is revealed, and the host marks each team. Then the event finale crowns the winner.

Round squares let the host revisit any photo; filled/check-marked squares show revealed, missed, or correct rounds. Revisiting is for host corrections and does not allocate that photo to another team. All rounds need a recorded result before the finale is available.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Enter or Space | Reveal the current photo |
| C | Correct: award the round to the assigned team |
| M | Missed: award zero and open the round to a steal |
| Left / Right arrows | Previous / next photo |

Shortcuts are ignored in inputs, textareas, editable content, and dialogs. Native button Enter/Space behaviour is preserved. The header has a full-screen button. CSS respects reduced-motion preferences.

Awarding a steal needs a team, so it is a click rather than a key. Press `M`, then choose the team that got it from the steal panel.

### CSV names

Use a UTF-8 `.csv` with one name per row, optionally including `Name,Fun fact` headers. Quoted commas, doubled quotes, Unicode, CRLF, and a UTF-8 BOM are supported.

```csv
Name,Fun fact
Asha,The unofficial keeper of the snack drawer
"Dhammur, Amar",Always first on the dance floor
```

Names map by the horizontal centre of the **current** face, left to right (vertical position breaks ties). Review the numbered preview for multi-row photos. Counts must match before applying. Names and crops can still be edited afterward.

## Storage and backups

- Image blobs live in **IndexedDB** through `idb`.
- The line-up, names, settings, team definitions, score entries, and per-activity progress live in **localStorage** as a versioned event document. Sessions saved before the event format are not restored; set the game up again. Face crops and names survive independently via **Export pairs**.
- Every meaningful change is saved immediately. Refresh restores the game, revealed state, unique team assignment, and scores.
- Private browsing restrictions, quota errors, or blocked storage produce a persistent warning. The current session remains usable in memory; export before closing the tab.
- Browser storage belongs to the specific origin. Different ports, browsers, or deployment URLs have separate libraries. Move between them using a ZIP.
- Clearing site data or browser eviction can remove images. A ZIP is the portable backup. Source images are not copied into localStorage.

**Export session** includes the full source images, aligned image, previews, crops, and all game data in a `.zip`. Import validates the version, activity schemas, references, paths, and archive size before switching the session. Imported images are staged under fresh IDs so a failed import cannot overwrite the active photos. Maximum import: 512 MB compressed / 800 MB expanded.

**Export face pairs** downloads matched faces as `<Name> - then.jpg` and `<Name> - now.jpg`. Filename characters are sanitized; duplicate names receive suffixes. Exporting pairs does not export game progress.

The People library uses the same `Person` and `FacePair` records as the activity. Names can be edited there and shared face crops can be reused by future activities.

## How to add a new activity

Create a folder under `activities/<your-id>/`. Nothing in the core or home screen needs to change.

```text
activities/your-activity/
  index.ts
  activity.ts
  schema.ts
  setup/
  stage/
```

Export an `Activity<Settings, GameState>` definition in `activity.ts`. The interface is in `src/core/types.ts`. Provide:

- Unique `id`, `version`, `name`, `description`, and icon component.
- Ordered setup steps, each with an ID, title, React view, and validation function.
- Zod settings/state schemas and settings-field metadata.
- `Stage`, `Finale`, initial state/settings, new-game behaviour, keyboard shortcuts, and migration handling.
- `remapImages(game, ids)` to rewrite only your activity’s image references during ZIP import; preserve user-entered text.
- Optional session-reference validation, a home-card `Preview`, and a local `createDemo` generator.
- `Finale` is optional and closes your activity before the leaderboard; omit it to go straight to the standings.
- `estimatedMinutes` feeds the line-up builder’s runtime estimate.
- Shared play mechanics live in `src/core/play/`: `Timer`, `StealPanel`, `Wager`. Use them rather than writing your own — they keep the score ledger idempotent and segment-scoped.
- Write score entries through `src/core/scoring.ts`, passing `session.segmentId`, so two activities containing the same person cannot collide in the shared ledger.

Register it in `index.ts`:

```ts
import { registerActivity } from '../../src/core/registry';
import { yourActivity } from './activity';

registerActivity(yourActivity);
```

`import.meta.glob('../../activities/*/index.ts')` discovers entries at build time. Each activity is bundled separately; the production service worker precaches all chunks so discovery also works offline.

Views receive an `ActivityContext`: the typed session, an immutable-draft `update` action, `runTask` for async work, notifications, and navigation. Use the shared image store, worker client, People library, team editor, score ledger, projector controls, and ZIP tools. Keep heavy activity-specific work in that activity’s own worker; the core workers contain no imports from activity folders.

Do not put blobs, object URLs, DOM objects, or functions in a session. Keep runtime schemas aligned with serialized types. New activities with migrations should bump `version` and validate migrated data. Use the theme variables in `src/theme/styles.css` for consistent colours, fonts, spacing, focus, and reduced motion.

## Architecture

```text
activities/childhood-vs-now/  Activity registration, setup, rounds, demo, stage, finale
src/app/                    Home and application shell
src/components/             Shared controls, uploads, images, crop editor
src/core/                   Registry, sessions, storage, teams, people, ZIP transfer
src/core/play/              Timer, steal, final wager
src/workers/                Image decoding/cropping, local detection, ZIP processing
src/theme/                  Theme tokens and responsive presentation styles
public/                     Bundled model, WASM, and license notices
scripts/                    Asset preparation and complete offline-cache generation
tests/                      Pure logic and browser workflow tests
```

Face matching uses a one-to-one minimum-cost assignment with unmatched dummy slots and a positional tolerance. Coordinates are normalized in orientation-corrected source images. Image decoding, alignment, inference, JPEG generation, and ZIP processing use workers. The main thread handles the UI and lightweight SVG box interactions.

Scores are derived from an explicit ledger. Each round owns one award entry with an active flag, making repeated Correct clicks and refreshes idempotent. The exact shuffled order and team assignment are persisted, never recalculated on reload.

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Vitest covers pairing (including global assignment conflicts), crop boundaries and sizes, CSV parsing, safe filenames, scoring, unique balanced team sets, segment views, v2 document validation, steal and wager invariants, and line-up validation. Playwright uses the production build to cover a full game, refresh recovery, offline reload/detection, storage failures, setup editing, CSV, ZIP round-trips, invalid files, event standings, final wagers, and phone layouts. Screenshots are written into `test-results/`.

## Static deployment

Build with `npm run build`, then publish only `dist/` to an HTTPS static host. Relative asset URLs support deployment in a project subdirectory. There are no server routes to rewrite, environment secrets to configure, or runtime services to provision.

For a public GitHub repository, enable **Settings → Pages → Source: GitHub Actions**, then run the included **Deploy static site** workflow manually. It builds and publishes `dist/` to GitHub Pages. Creating this project does not publish it automatically.

The main host workflow targets current desktop Chrome/Edge with Web Workers, OffscreenCanvas, IndexedDB, and WebAssembly support. The layout is responsive on phones; browsers with unavailable detection can use manual matching. Automatic face detection on heavily edited, very small, or obscured faces is not guaranteed. Always review matches before the event.
