import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
const key = 'fun-friday-studio.session.v1';
const saved = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
async function home(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: 'What are we playing?' })).toBeVisible(); }
test('full demo: unique sets, one-point scoring, refresh, finale and group wipe', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await home(page); await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stage-desktop.png', fullPage: true, animations: 'disabled' });
  let session = await saved(page); expect(session.game.rounds).toHaveLength(4); expect(new Set(session.game.rounds.map((r: any) => r.personId)).size).toBe(4);
  await page.keyboard.press('Enter'); await page.keyboard.press('c'); await page.keyboard.press('c');
  session = await saved(page); expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(1);
  await page.reload(); await expect(page.getByRole('button', { name: /Correct/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/reveal-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /^Next team:/ }).click();
  for (let i = 1; i < 4; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: i < 3 ? /^Next team:/ : 'Final results' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Top of the class!' })).toBeVisible();
  await page.screenshot({ path: 'test-results/finale-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'The whole class reveal' }).click();
  await page.getByRole('slider', { name: 'Reveal original group photo' }).fill('65');
  await page.getByRole('button', { name: 'Asha', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toBeVisible();
  await page.screenshot({ path: 'test-results/group-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});
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
  const pairsBytes = await readFile(pairsPath!);

  const demoSession = await saved(page);
  await page.evaluate(({ key, session }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      ...session,
      id: crypto.randomUUID(),
      isDemo: false,
      phase: 'setup',
      setupStepId: 'upload',
      people: [],
      facePairs: [],
      assets: {},
      game: { previews: {}, rounds: [], currentRoundIndex: 0, finale: { wipePosition: 0 } },
    }));
  }, { key, session: demoSession });
  await page.reload();
  await home(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await page.locator('input[aria-label="Import face pairs ZIP"]').setInputFiles({
    name: 'exported-face-pairs.zip',
    mimeType: 'application/zip',
    buffer: pairsBytes,
  });

  await expect(page.getByRole('status')).toContainText('4 people imported.');
  const imported = await saved(page);
  expect(imported.people).toHaveLength(4);
  expect(imported.facePairs).toHaveLength(4);
  expect(Object.keys(imported.assets)).toHaveLength(8);
  expect(new Set(imported.people.map((person: any) => person.name))).toEqual(new Set(['Asha', 'Leo', 'Maya', 'Dev']));
  for (const person of imported.people) {
    const pair = imported.facePairs.find((candidate: any) => candidate.id === person.facePairId);
    expect(pair?.number).toBeGreaterThan(0);
    expect(imported.assets[pair!.then.cropImageId]).toBeTruthy();
    expect(imported.assets[pair!.now.cropImageId]).toBeTruthy();
  }
  await expect(page.getByRole('img', { name: 'Asha as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Asha now' })).toBeVisible();
});
test('setup edits, CSV mapping, local detection, crops, export and import', async ({ page }) => {
  await home(page); await page.getByRole('button', { name: 'Set up your game' }).click();
  await page.getByRole('button', { name: 'Match people', exact: true }).click();
  await page.getByRole('button', { name: 'Detect faces' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole('status')).not.toContainText('unavailable');
  // Cartoon inference may suggest extra false detections; the host can remove them.
  const detected = await saved(page);
  for (const pair of detected.facePairs.filter((p: any) => p.number > 4)) {
    if (pair.now) { await page.getByRole('button', { name: `now face ${pair.number}`, exact: true }).click(); await page.getByRole('button', { name: 'Delete this face' }).click(); }
    if (pair.then) { await page.getByRole('button', { name: `then face ${pair.number}`, exact: true }).click(); await page.getByRole('button', { name: 'Delete this face' }).click(); }
  }
  await page.getByRole('button', { name: 'now face 1', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Crop x', exact: true }).fill('11');
  await page.getByRole('button', { name: 'Name people', exact: true }).click();
  await page.locator('input[aria-label="Import names CSV"]').setInputFiles({ name: 'names.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Fun fact\nAsha,An artist\nLeo,A dancer\nMaya,A reader\nDev,A runner') });
  await page.getByRole('button', { name: 'Apply names' }).click();
  await page.getByRole('textbox', { name: 'Name for person 1', exact: true }).fill('Asha Kumar');
  await page.getByRole('slider', { name: 'Crop padding for person 1', exact: true }).fill('0.6');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export face pairs' }).click();
  expect((await download).suggestedFilename()).toContain('face pairs.zip');
  await page.getByRole('button', { name: 'Set up the game', exact: true }).click();
  await page.getByRole('textbox', { name: 'Team 1 name', exact: true }).fill('The Legends');
  await page.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.locator('.active-team')).toContainText('The Legends');
  const exportWait = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export session', exact: true }).click();
  const exported = await exportWait; const path = await exported.path(); expect(path).toBeTruthy();
  await page.locator('input[aria-label="Choose session ZIP"]').setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('Session restored');
  expect((await saved(page)).teams[0].name).toBe('The Legends');
});
test('offline reload and local model remain available with network disconnected', async ({ page, context }) => {
  await home(page); await expect(page.locator('.offline-status')).toContainText('Offline ready', { timeout: 30_000 });
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'What are we playing?' })).toBeVisible();
  await page.getByRole('button', { name: 'Set up your game' }).click(); await page.getByRole('button', { name: 'Match people', exact: true }).click();
  await page.getByRole('button', { name: 'Detect faces' }).click(); await expect(page.getByRole('dialog')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole('status')).not.toContainText('unavailable');
});
test('unreadable files show a clear error without removing existing photos', async ({ page }) => {
  await home(page); await page.getByRole('button', { name: 'Set up your game' }).click();
  await page.getByLabel('Original group photo (now)', { exact: true }).setInputFiles({ name: 'broken.heic', mimeType: 'image/heic', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('status')).toContainText('Convert HEIC/HEIF photos to JPEG');
  expect((await saved(page)).facePairs).toHaveLength(4);
});
test('storage failures fall back to a playable temporary session with a warning', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); };
    IDBFactory.prototype.open = () => { throw new DOMException('Unavailable', 'SecurityError'); };
  });
  await home(page); await expect(page.locator('.storage-warning')).toContainText('Temporary');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('img', { name: 'The childhood face to guess' })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export now', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/Fun Friday.*zip/);
});
test('phone layout stays usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await home(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-phone.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Try the demo' }).click(); await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stage-phone.png', fullPage: true, animations: 'disabled' });
});
test('4200px uploads retain source resolution, align sizes and support manual boxes and pairing', async ({ page }) => {
  await home(page); await page.getByRole('button', { name: 'Set up your game' }).click();
  const makeImage = async (w: number, h: number) => Buffer.from(await page.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f1dfbf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c98f6b'; ctx.beginPath(); ctx.ellipse(w * .25, h * .4, w * .07, h * .12, 0, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL('image/jpeg', .9).split(',')[1];
  }, { w, h }), 'base64');
  const now = await makeImage(4200, 2400), then = await makeImage(2800, 1600);
  await page.getByLabel('Original group photo (now)', { exact: true }).setInputFiles({ name: 'team-now.jpg', mimeType: 'image/jpeg', buffer: now });
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('Childhood group photo (then)', { exact: true }).setInputFiles({ name: 'team-then.jpg', mimeType: 'image/jpeg', buffer: then });
  await expect(page.getByRole('dialog')).toBeHidden();
  let session = await saved(page);
  expect(session.assets[session.game.originalImageId].width).toBe(4200);
  expect(session.assets[session.game.childhoodUploadId].width).toBe(2800);
  expect(session.assets[session.game.childhoodImageId].width).toBe(4200);
  expect(session.assets[session.game.childhoodImageId].height).toBe(2400);
  await page.getByRole('button', { name: 'Match people', exact: true }).click();
  for (const label of ['Original photo face editor', 'Childhood photo face editor']) {
    await page.getByRole('button', { name: 'Add face', exact: true }).click();
    await page.getByRole('group', { name: label }).scrollIntoViewIfNeeded();
    const box = await page.getByRole('group', { name: label }).boundingBox();
    await page.mouse.move(box!.x + box!.width * .18, box!.y + box!.height * .27); await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * .32, box!.y + box!.height * .53, { steps: 12 }); await page.mouse.up();
    await expect(page.getByRole('button', { name: label.startsWith('Original') ? 'now face 1' : 'then face 2', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'now face 1', exact: true }).click();
  await expect(page.locator('.match-summary')).toContainText('1 pairs');
  session = await saved(page); expect(session.facePairs).toHaveLength(1); expect(session.people[0].included).toBe(true);
  await page.getByRole('button', { name: 'Adjust', exact: true }).click();
  await page.getByRole('button', { name: 'now face 1', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Crop width', exact: true }).fill('15');
  await page.screenshot({ path: 'test-results/matching-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Name people', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name for person 1', exact: true })).toBeVisible();
  session = await saved(page); const crop = session.assets[session.facePairs[0].then.cropImageId]; expect(Math.max(crop.width, crop.height)).toBe(1100);
  await page.getByRole('textbox', { name: 'Name for person 1', exact: true }).fill('Amar');
  await page.getByRole('button', { name: 'Set up the game', exact: true }).click();
  for (const i of [4, 3, 2]) await page.getByRole('button', { name: `Remove team ${i}`, exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.getByRole('img', { name: 'The childhood face to guess' })).toBeVisible();
});
