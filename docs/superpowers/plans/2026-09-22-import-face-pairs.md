# Import Face Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a People library face-pairs ZIP back into the current People library as reusable people with locally stored portraits.

**Architecture:** Keep full-session ZIP import unchanged and add a pair-specific import path. A pure parser validates the flat `<name> - then/now.jpg` format, the transfer layer safely unzips and stores each portrait as an asset, and the People library merges the resulting records into the current session. Imported face crops use their own asset as both source and crop with a full-image face box, because the pair export does not contain original group-photo geometry.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, `fflate`, `idb`, existing image and archive workers.

## Global Constraints

- Keep the archive worker's existing 512 MB compressed / 800 MB expanded / 2,000-file safety limits.
- Require a `.zip` input at the UI boundary.
- Require at least one complete pair.
- Reject unsupported non-JPEG files and malformed names rather than silently importing partial data.
- Existing people are never overwritten; imported records always receive fresh IDs.
- The existing header **Import session ZIP** control remains dedicated to complete session exports.
- Keep imported face crops available to the People library and future activities, but do not claim that the original group photos can be reconstructed.

---

### Task 1: Add pure face-pair filename parsing

**Files:**
- Create: `src/core/people/pairs.ts`
- Test: `tests/unit/pairs.test.ts`

**Interfaces:**
- Produces `parseFacePairFiles(fileNames: string[]): ImportedPairFiles[]`.
- `ImportedPairFiles` contains `{ name: string; thenFile: string; nowFile: string }`.
- The parser ignores directory entries ending in `/`, rejects every other non-JPEG file, accepts `.jpg` and `.jpeg` case-insensitively, and pairs names case-insensitively while preserving the first filename's display casing.

- [ ] **Step 1: Write the failing parser tests**

Create tests covering successful pairing, case-insensitive extensions/suffixes, duplicate sides, missing sides, malformed names, unsupported files, directory entries, and multiple people:

```ts
import { describe, expect, it } from 'vitest';
import { parseFacePairFiles } from '../../src/core/people/pairs';

describe('face-pair ZIP filenames', () => {
  it('pairs then and now files for multiple people', () => {
    expect(parseFacePairFiles([
      'Asha - then.jpg',
      'Asha - now.jpg',
      'Leo - now.jpeg',
      'Leo - then.JPEG',
    ])).toEqual([
      { name: 'Asha', thenFile: 'Asha - then.jpg', nowFile: 'Asha - now.jpg' },
      { name: 'Leo', thenFile: 'Leo - then.JPEG', nowFile: 'Leo - now.jpeg' },
    ]);
  });

  it('ignores directory entries and matches suffixes case-insensitively', () => {
    expect(parseFacePairFiles(['Maya - THEN.JPG', 'Maya - now.jpg', 'folder/'])).toEqual([
      { name: 'Maya', thenFile: 'Maya - THEN.JPG', nowFile: 'Maya - now.jpg' },
    ]);
  });

  it('rejects incomplete, duplicate, malformed, and unsupported entries', () => {
    expect(() => parseFacePairFiles(['folder/'])).toThrow(/no face pairs/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg'])).toThrow(/missing.*now/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg', 'Asha - THEN.jpg', 'Asha - now.jpg'])).toThrow(/duplicate/i);
    expect(() => parseFacePairFiles(['Asha.jpg', 'Asha - now.jpg'])).toThrow(/must end/i);
    expect(() => parseFacePairFiles(['Asha - then.png', 'Asha - now.jpg'])).toThrow(/JPEG/i);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/unit/pairs.test.ts`

Expected: FAIL because `src/core/people/pairs.ts` and `parseFacePairFiles` do not exist.

- [ ] **Step 3: Implement the parser**

Create the parser with a `Map` keyed by `name.toLocaleLowerCase()`. For each non-directory entry, reject path separators, require a filename matching `/^(.*?)\s+-\s+(then|now)\.jpe?g$/i`, require a non-empty trimmed name, reject duplicate sides, then reject any entry missing either side. Preserve the original file keys in `thenFile` and `nowFile`; do not sort or rewrite them.

Use errors that identify the user's correction:

```ts
export interface ImportedPairFiles {
  name: string;
  thenFile: string;
  nowFile: string;
}

export function parseFacePairFiles(fileNames: string[]): ImportedPairFiles[] {
  const groups = new Map<string, { name: string; thenFile?: string; nowFile?: string }>();
  for (const file of fileNames) {
    if (file.endsWith('/')) continue;
    if (file.includes('/') || file.includes('\\')) throw new Error('Face pair ZIP entries must be flat files.');
    const match = /^(.*?)\s+-\s+(then|now)\.jpe?g$/i.exec(file);
    if (!match) throw new Error('Face pair files must be JPEGs ending in " - then.jpg" or " - now.jpg".');
    const name = match[1].trim();
    if (!name) throw new Error('Every face pair file needs a person name.');
    const key = name.toLocaleLowerCase();
    const group = groups.get(key) ?? { name };
    const side = match[2].toLocaleLowerCase() as 'then' | 'now';
    if (side === 'then') {
      if (group.thenFile) throw new Error(`Duplicate then file for ${group.name}.`);
      group.thenFile = file;
    } else {
      if (group.nowFile) throw new Error(`Duplicate now file for ${group.name}.`);
      group.nowFile = file;
    }
    groups.set(key, group);
  }
  if (!groups.size) throw new Error('The ZIP contains no face pairs.');
  return [...groups.values()].map(group => {
    if (!group.thenFile || !group.nowFile) throw new Error(`Missing then or now image for ${group.name}.`);
    return { name: group.name, thenFile: group.thenFile, nowFile: group.nowFile };
  });
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run tests/unit/pairs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the parser**

```sh
git add src/core/people/pairs.ts tests/unit/pairs.test.ts
git commit -m "test: validate face pair archive names"
```

### Task 2: Add pair ZIP extraction and local asset creation

**Files:**
- Modify: `src/workers/archive.worker.ts`
- Modify: `src/core/transfer.ts`

**Interfaces:**
- Consumes `parseFacePairFiles` from `src/core/people/pairs.ts`.
- Produces `importFacePairs(file: File, startNumber: number): Promise<ImportedFacePairs>`.
- `ImportedFacePairs` contains `assets: Record<string, Asset>`, `facePairs: FacePair[]`, and `people: Person[]`.

- [ ] **Step 1: Extend the archive worker without changing session imports**

Allow the existing unzip request to receive `allowMissingManifest: true`. Continue requiring and parsing `session.json` for normal session imports. For pair imports, omit the manifest only when that flag is set, remove `session.json` when present, and return `{ manifest: undefined, files }` when it is absent. Keep path validation and the existing total-size/file-count checks unchanged.

The normal path must continue to behave like this:

```ts
if (!files['session.json'] && !data.allowMissingManifest) {
  throw new Error('This is not a Fun Friday Studio session ZIP.');
}
const manifest = files['session.json']
  ? JSON.parse(strFromU8(files['session.json']))
  : undefined;
if (files['session.json']) delete files['session.json'];
worker.postMessage({ id: data.id, result: { manifest, files } }, Object.values(files).map(file => file.buffer));
```

- [ ] **Step 2: Add `importFacePairs` with a validation-before-storage sequence**

In `src/core/transfer.ts`:

1. Reject files whose MIME/name does not identify a ZIP.
2. Call `archiveJob` with `allowMissingManifest: true`.
3. Require that no manifest is present and pass `Object.keys(files)` to `parseFacePairFiles`.
4. Build JPEG `Blob`s for every `thenFile` and `nowFile` and call `inspectImage` on all of them before storing any asset.
5. Store each validated image with `imageStore.put`, create `Asset` metadata from the inspected dimensions, and use the filename as the asset name.
6. Create a confirmed pair whose `now` and `then` crops both use the stored asset as `sourceImageId` and `cropImageId`, with a full-image `faceBox` and zero padding.
7. Create an included `Person` with an empty `funFact`, a fresh ID, and the parsed name.
8. Assign `teamColors[(startNumber + index) % teamColors.length]` and `number: startNumber + index + 1`.
9. Return the assets and records without mutating the current session.

Use this shape for the constructed crop:

```ts
const crop = (asset: Asset): FaceCrop => ({
  sourceImageId: asset.id,
  cropImageId: asset.id,
  faceBox: { x: 0, y: 0, width: 1, height: 1 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
});
```

Throw clear errors for a manifest-bearing session ZIP, no complete pairs, decode failures from `inspectImage`, and storage failures. Do not partially merge records into the session when any validation step fails.

- [ ] **Step 3: Run unit tests and the type checker**

Run:

```sh
npx vitest run tests/unit/pairs.test.ts
npx tsc -b
```

Expected: PASS with no TypeScript errors. Existing `importSession` behavior must remain covered by the existing tests.

- [ ] **Step 4: Commit the transfer path**

```sh
git add src/workers/archive.worker.ts src/core/transfer.ts
git commit -m "feat: import exported face pairs"
```

### Task 3: Add People library controls and merge behavior

**Files:**
- Modify: `src/core/people/PeopleLibrary.tsx`
- Test: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes `importFacePairs(file, session.facePairs.length)` from `src/core/transfer.ts`.
- Merges the returned `assets`, `facePairs`, and `people` through the existing `update` callback.
- Uses the existing `runTask` busy overlay and `notify` error/success path.

- [ ] **Step 1: Add the import control**

Use `useRef<HTMLInputElement>` for a visually hidden input with `accept=".zip,application/zip"` and `aria-label="Import face pairs ZIP"`. Place an **Import pairs** button beside **Export pairs**. Reset `event.target.value` after selecting a file so the same ZIP can be selected again.

- [ ] **Step 2: Wire the atomic session merge**

On file selection, run:

```ts
void runTask('Importing face pairs…', async () => {
  const imported = await importFacePairs(file, session.facePairs.length);
  update(s => {
    Object.assign(s.assets, imported.assets);
    s.facePairs.push(...imported.facePairs);
    s.people.push(...imported.people);
  });
  notify(`${imported.people.length} people imported.`);
});
```

Use the existing `runTask` catch behavior for parser, archive, image, and storage errors. Do not change the header's full-session import input.

- [ ] **Step 3: Add a browser regression test**

Add a separate Playwright test that:

1. Runs the demo and opens People library.
2. Exports the demo's pairs ZIP and captures its download path.
3. Clears localStorage and reloads to create a clean session while retaining the downloaded file.
4. Opens People library and selects the captured ZIP through `input[aria-label="Import face pairs ZIP"]`.
5. Verifies four people appear and both portraits for Asha are visible.

```ts
test('exports and imports reusable face pairs', async ({ page }) => {
  await home(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await page.getByRole('button', { name: 'People library', exact: true }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pairs', exact: true }).click();
  const pairsPath = await (await download).path();
  expect(pairsPath).toBeTruthy();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await home(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await page.locator('input[aria-label="Import face pairs ZIP"]').setInputFiles(pairsPath!);

  await expect.poll(async () => (await saved(page)).people.length).toBe(4);
  await expect(page.getByRole('img', { name: 'Asha as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Asha now' })).toBeVisible();
});
```

- [ ] **Step 4: Run the browser regression**

Run: `npm run test:browser -- tests/browser/app.spec.ts`

Expected: the new import test and all existing browser tests pass.

- [ ] **Step 5: Commit the UI integration**

```sh
git add -p src/core/people/PeopleLibrary.tsx tests/browser/app.spec.ts
# Stage only the import-pair hunks; leave the existing terminology edits unstaged.
git commit -m "feat: add People library pair import"
```

### Task 4: Verify the completed feature

**Files:**
- Verify: `src/core/people/pairs.ts`, `src/core/transfer.ts`, `src/core/people/PeopleLibrary.tsx`, `src/workers/archive.worker.ts`, `tests/unit/pairs.test.ts`, `tests/browser/app.spec.ts`

- [ ] **Step 1: Recheck the approved import contract**

Confirm the implementation still distinguishes:

- **Export pairs / Import pairs:** reusable cropped `then`/`now` portraits, names from filenames, no fun facts or original group photos.
- **Export session / header Import session ZIP:** complete session state, images, people, and game progress.

- [ ] **Step 2: Run all verification commands**

Run:

```sh
npm test
npm run build
npm run test:browser
```

Expected: all unit tests, the production TypeScript/Vite build, service-worker generation, and browser workflows pass.

- [ ] **Step 3: Check edited-file diagnostics**

Run the editor linter check for the modified TypeScript/TSX files. Fix any diagnostics caused by the implementation, then repeat the relevant focused test.

- [ ] **Step 4: Inspect the final diff**

Run:

```sh
git diff --check
git status --short
git log --oneline -5
```

Confirm that the pair import commits contain only the planned implementation and tests. Do not stage or alter the user's pre-existing terminology edits in `README.md`, `PeopleLibrary.tsx`, or `tests/browser/app.spec.ts`; use `git add -p` when committing Task 3.
