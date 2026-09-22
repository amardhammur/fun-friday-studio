# Face-pair import final fix report

## Status

Implemented and committed the final face-pair import fix wave.

## Files changed by the fix commit

- `src/core/people/PeopleLibrary.tsx`
- `src/core/people/pairs.ts`
- `src/core/storage.ts`
- `src/core/transfer.ts`
- `tests/browser/app.spec.ts`
- `tests/unit/pairs.test.ts`
- `tests/unit/storage.test.ts`

The pre-existing terminology edits remain unstaged and unchanged in the working tree, including the terminology hunks in `src/core/people/PeopleLibrary.tsx` and `tests/browser/app.spec.ts`.

## Resolution of review findings

1. Capacity limits: pair filenames are parsed first, then the transfer layer rejects the entire import before image inspection or storage if current people would exceed 500 or current face pairs would exceed 1,000. The UI passes current people and pair counts into the transfer layer. The error identifies the exceeded session limit, and no session update occurs.

2. Browser isolation and awaiting: the regression now exports the ZIP, seeds local storage with a valid empty setup session instead of clearing into the automatic demo-session boot path, supplies explicit ZIP filename/MIME metadata to the file input, waits for the success status, and verifies four imported people, four pairs, eight assets, expected names, and asset-backed portraits.

3. Durable pair assets: `imageStore.put` now has an opt-in `{ durable: true }` mode. Pair imports use it, so IndexedDB failures throw instead of silently falling back to memory. All already-stored import assets are deleted on any subsequent import failure. Existing non-durable callers retain the general in-memory fallback.

4. Pair numbering: the People library computes the maximum existing pair number and starts imported numbering after it, avoiding duplicates after deletions.

5. Parser coverage: added tests for flat-path rejection, empty names, mixed valid/junk entries, case-insensitive name grouping, capacity boundaries, and max-based numbering.

## Verification

All commands were run from `/Users/amarnathdhammur/fun-friday-studio`.

- `npx vitest run tests/unit/pairs.test.ts tests/unit/storage.test.ts`
  - PASS: 2 files, 11 tests.
- `npx tsc -b`
  - PASS: no output/errors.
- `npm test`
  - PASS: 6 files, 36 tests.
- `npm run build`
  - PASS: Vite build completed; service worker generated for 29 assets.
- `git diff --check`
  - PASS: no whitespace errors.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/fun-friday-playwright-arm PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac26-arm64 npm run test:browser -- tests/browser/app.spec.ts --grep "exports and imports reusable face pairs"`
  - PASS: 1 test.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/fun-friday-playwright-arm PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac26-arm64 npm run test:browser -- tests/browser/app.spec.ts`
  - PASS: 8 tests in 9.2 seconds.
- IDE diagnostics via `ReadLints` for all changed implementation and test files
  - PASS: no linter errors.

## Browser environment caveat

The default `npm run test:browser -- tests/browser/app.spec.ts` attempted to launch the cached x64 Chromium and failed before tests with `spawn Unknown system error -86` on this ARM host. The working browser setup was:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/fun-friday-playwright-arm PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac26-arm64 npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/fun-friday-playwright-arm PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac26-arm64 npm run test:browser -- tests/browser/app.spec.ts
```

The ARM browser required running outside the Cursor sandbox; inside the sandbox the ARM Chromium process exited with `SIGSEGV`. With the isolated ARM install outside the sandbox, all browser tests passed.

## Commits

- `3d21b75` — `fix: harden face pair imports` (final fix wave)
- `0cbe73d` — `feat: add People library pair import` (feature head before this fix wave)
