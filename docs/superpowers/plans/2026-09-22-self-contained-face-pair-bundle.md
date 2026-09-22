# Self-Contained Face Pair Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace crop-only pair exports with a versioned playable bundle that restores people, group photos, face boxes, and final-reveal references.

**Architecture:** A manifest-owned ZIP format separates user names from paths and carries the group-image metadata needed by the activity. The transfer layer validates the whole bundle, stores every image durably, and returns a complete replacement payload; the People library applies that payload as one update, replacing demo data automatically and requiring confirmation for real sessions.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Zod, `fflate`, `idb`, existing image/archive workers.

## Global Constraints

- This is a pre-ship format; the importer does not accept the previous flat crop-only ZIP format.
- Keep the archive worker's existing 512 MB compressed / 800 MB expanded / 2,000-file safety limits.
- Require a `.zip` input at the UI boundary.
- Reject unknown files, missing references, invalid manifests, invalid JPEGs, and unreadable images before mutating the session.
- Store imported images durably and remove all assets created by a failed import.
- Preserve the existing full-session ZIP import/export flow.
- Preserve current team definitions, but reset people, activity images, rounds, scores, and finale state on bundle replacement.

---

### Task 1: Define and validate the bundle manifest

**Files:**
- Modify: `src/core/people/pairs.ts`
- Test: `tests/unit/pairs.test.ts`

**Interfaces:**
- Export `FACE_PAIR_BUNDLE_VERSION = 1`.
- Export `FacePairsBundleManifest` and `parseFacePairsBundleManifest(raw: unknown): FacePairsBundleManifest`.
- Manifest paths are fixed safe paths under `groups/` and `pairs/`; no user-entered path is accepted.

- [ ] **Step 1: Replace flat filename tests with manifest tests**

Cover a valid multi-person manifest, missing required group metadata, missing pair sides, invalid rectangles/padding, unsupported manifest version, unsafe paths, duplicate file references, and capacity boundaries.

- [ ] **Step 2: Run the focused tests and confirm the old parser contract is intentionally removed**

Run: `npx vitest run tests/unit/pairs.test.ts`

Expected: FAIL until the new manifest parser exists; no test should require importing a legacy crop-only archive.

- [ ] **Step 3: Implement the Zod-backed manifest parser**

Validate the exact version, group source/preview metadata, pair names/facts/flags, safe fixed path patterns, face boxes, and padding. Return normalized data only after all checks pass.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/unit/pairs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/core/people/pairs.ts tests/unit/pairs.test.ts
git commit -m "test: define self-contained pair bundle manifest"
```

### Task 2: Export and import the complete bundle

**Files:**
- Modify: `src/core/transfer.ts`
- Modify: `src/core/storage.ts` only if the existing durable-write option needs to be reused
- Test: `tests/unit/pairs.test.ts`, `tests/unit/storage.test.ts`

**Interfaces:**
- `exportFacePairs(session: AnySession)` writes the manifest, group source/preview files, and crop files.
- `importFacePairs(file: File, options: FacePairImportOptions): Promise<ImportedFacePairs>` returns:

```ts
{
  assets: Record<string, Asset>;
  facePairs: FacePair[];
  people: Person[];
  originalImageId: string;
  childhoodImageId: string;
  childhoodUploadId: string;
  previews: Record<string, string>;
}
```

- [ ] **Step 1: Add export tests for group files and manifest relationships**

Use a prepared demo session and verify the ZIP contains `face-pairs.json`, both group source files, previews when present, and a crop file for every exported pair. Verify the manifest preserves names, fun facts, source face boxes, and padding.

- [ ] **Step 2: Implement bundle export**

Require both group source assets. Add all referenced group/crop bytes to the archive under fixed paths and serialize the manifest with no session IDs or absolute paths. Keep full-session export unchanged.

- [ ] **Step 3: Implement strict bundle import**

Require a ZIP and `face-pairs.json`; reject old flat archives. Validate that the manifest references exactly the archive's non-directory files, check session capacity before decoding/storage, validate JPEG signatures for crops, inspect all images, store durably, and clean up every stored asset on failure.

- [ ] **Step 4: Build restored records**

Use fresh asset IDs and record IDs. Set pair source IDs to restored group assets, crop IDs to restored portrait assets, and preserve face boxes/padding. Return group source IDs and preview mappings alongside people and pairs.

- [ ] **Step 5: Run tests and type-check**

Run:

```sh
npx vitest run tests/unit/pairs.test.ts tests/unit/storage.test.ts
npx tsc -b
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```sh
git add src/core/transfer.ts src/core/storage.ts tests/unit/pairs.test.ts tests/unit/storage.test.ts
git commit -m "feat: export and import playable pair bundles"
```

### Task 3: Replace demo data and restore final reveal in the UI

**Files:**
- Modify: `src/core/people/PeopleLibrary.tsx`
- Test: `tests/browser/app.spec.ts`

**Interfaces:**
- Demo sessions apply an imported bundle without confirmation.
- Non-demo sessions call `window.confirm` before replacement.
- The one `update` callback assigns imported assets/people/pairs, group references/previews, `isDemo = false`, setup phase/game step, empty rounds/scores, and a reset finale.

- [ ] **Step 1: Add replacement confirmation and atomic merge**

Use the existing task overlay and notifications. Preserve teams, replace all people/activity assets with the imported result, and leave the user in People library with the Game setup step ready.

- [ ] **Step 2: Update the browser regression**

Export the demo bundle, import it into the demo session, await the success notification, verify the imported people replace—not append to—the demo records, verify `game.originalImageId` and `game.childhoodImageId` reference restored assets, and verify the session is no longer marked as demo.

- [ ] **Step 3: Cover the final reveal path**

Use the imported setup to start a game, complete the rounds, open the whole-team reveal, and assert both restored group images are visible with no missing-image alert.

- [ ] **Step 4: Run browser tests**

Run: `npm run test:browser -- tests/browser/app.spec.ts`

Expected: all existing browser tests plus the bundle replacement/finale regression pass.

- [ ] **Step 5: Commit**

```sh
git add -p src/core/people/PeopleLibrary.tsx tests/browser/app.spec.ts
git commit -m "feat: restore group reveal from pair bundles"
```

### Task 4: Final verification and review

**Files:**
- Verify: `src/core/people/pairs.ts`, `src/core/transfer.ts`, `src/core/storage.ts`, `src/core/people/PeopleLibrary.tsx`, `tests/unit/pairs.test.ts`, `tests/unit/storage.test.ts`, `tests/browser/app.spec.ts`

- [ ] **Step 1: Run full verification**

```sh
npm test
npm run build
npm run test:browser
```

- [ ] **Step 2: Check diagnostics and diff hygiene**

Run editor diagnostics for changed files, `git diff --check`, and confirm unrelated existing edits are not included in feature commits.

- [ ] **Step 3: Perform a whole-branch review**

Review manifest validation, atomic durable storage, demo replacement, real-session confirmation, restored group references, and final reveal behavior.
