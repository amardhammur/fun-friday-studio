import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
const key = 'fun-friday-studio.session.v1';
const saved = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem('fun-friday-studio.demo.v1') ?? localStorage.getItem(k)!), key);
async function home(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: 'What are we playing?' })).toBeVisible(); }
test('full demo: unique sets, two-point scoring, refresh, finale and group wipe', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await home(page); await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stage-desktop.png', fullPage: true, animations: 'disabled' });
  let session = await saved(page); expect(session.segments[0].game.rounds).toHaveLength(4); expect(new Set(session.segments[0].game.rounds.map((r: any) => r.personId)).size).toBe(4);
  await page.keyboard.press('Enter'); await page.keyboard.press('c'); await page.keyboard.press('c');
  session = await saved(page); expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(2);
  await page.reload(); await expect(page.getByRole('button', { name: /Correct/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/reveal-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /^Next team:/ }).click();
  for (let i = 1; i < 4; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: i < 3 ? /^Next team:/ : 'Final results' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Team of the month!' })).toBeVisible();
  await page.screenshot({ path: 'test-results/finale-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await page.getByRole('slider', { name: 'Reveal original group photo' }).fill('65');
  await page.getByRole('button', { name: 'Asha', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toBeVisible();
  await page.screenshot({ path: 'test-results/group-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});
test('demo pair bundle replaces the library and restores the whole-team reveal', async ({ page }) => {
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
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[aria-label="Import face pairs ZIP"]').setInputFiles({
    name: 'exported-face-pairs.zip',
    mimeType: 'application/zip',
    buffer: pairsBytes,
  });

  await expect(page.getByRole('status')).toContainText('4 people imported.');
  const imported = await saved(page); const importedGame = imported.segments[0].game;
  expect(imported.people).toHaveLength(4);
  expect(imported.facePairs).toHaveLength(4);
  expect(imported.teams).toEqual(demoSession.teams);
  expect(imported.isDemo).toBe(false);
  expect(imported.segments[0].status).toBe('setup');
  expect(imported.segments[0].setupStepId).toBe('game');
  expect(importedGame.rounds).toEqual([]);
  expect(imported.scoreEntries).toEqual([]);
  expect(importedGame.finale).toEqual({ wipePosition: 0, slideIndex: 0 });
  expect(Object.keys(imported.assets).some(id => demoSession.assets[id])).toBe(false);
  const set = imported.photoSets[0];
  expect(imported.assets[set.nowImageId]).toBeTruthy();
  expect(imported.assets[set.thenImageId]).toBeTruthy();
  expect(imported.assets[set.previews[set.nowImageId]]).toBeTruthy();
  expect(imported.assets[set.previews[set.thenImageId]]).toBeTruthy();
  expect(new Set(imported.people.map((person: any) => person.name))).toEqual(new Set(['Asha', 'Leo', 'Maya', 'Dev']));
  for (const person of imported.people) {
    const pair = imported.facePairs.find((candidate: any) => candidate.id === person.facePairId);
    expect(pair?.number).toBeGreaterThan(0);
    expect(imported.assets[pair!.then.cropImageId]).toBeTruthy();
    expect(imported.assets[pair!.now.cropImageId]).toBeTruthy();
  }
  await expect(page.getByRole('img', { name: 'Asha as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Asha now' })).toBeVisible();

  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: i < 3 ? /^Next team:/ : 'Final results' }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await expect(page.getByRole('img', { name: 'The whole team as children' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'The whole team today' })).toBeVisible();
  await expect(page.locator('.image-missing')).toHaveCount(0);
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
  await home(page); page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Set up your game' }).click();
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
  expect(session.assets[session.photoSets[0].nowImageId].width).toBe(4200);
  expect(session.assets[session.photoSets[0].thenImageId].width).toBe(4200);
  expect(session.assets[session.photoSets[0].thenImageId].height).toBe(2400);
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

test('stealing, retracting a steal, and reaching the event finale through the standings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await home(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();

  await page.keyboard.press('Enter'); await page.keyboard.press('c');
  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.locator('.steal-teams .button').first().click();
  let session = await saved(page);
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(3);
  expect(session.scoreEntries.some((e: any) => e.kind === 'steal-award' && e.active)).toBe(true);

  await page.getByRole('button', { name: /^Correct/ }).click();
  session = await saved(page);
  expect(session.scoreEntries.filter((e: any) => e.kind === 'steal-award' && e.active)).toHaveLength(0);
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(4);
  await page.getByRole('button', { name: /^Missed/ }).click();

  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.getByRole('button', { name: /^Next team:/ }).click();
  await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
  await page.getByRole('button', { name: /^Missed/ }).click();
  await page.getByRole('button', { name: 'Final results' }).click();
  await expect(page.getByRole('heading', { name: 'Team of the month!' })).toBeVisible();

  await page.getByRole('button', { name: /^Leaderboard/ }).click();
  await expect(page.getByText(/ROUND 1 OF 1/)).toBeVisible();
  await page.getByRole('button', { name: /On to the finish/ }).click();
  await expect(page.getByRole('heading', { name: /Champions of the Friday!|Sharing the trophy!/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('three activities carry scores through ZIP restore and a wager changes the winner', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await home(page);
  await page.getByRole('button', { name: /^Build an event/ }).click();
  await expect(page.getByRole('heading', { name: /Build your Friday/ })).toBeVisible();
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your people library/ })).toBeVisible();
  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: /^Build an event/ }).click();
  await page.getByRole('button', { name: 'Childhood vs Now' }).click();
  await page.getByRole('button', { name: 'Childhood vs Now' }).click();
  await page.getByRole('button', { name: 'Childhood vs Now' }).click();
  await page.getByLabel('Points multiplier for activity 2').selectOption('2');
  await page.getByRole('textbox', { name: 'Final wager question' }).fill('How many biscuits does this office get through a week?');
  await page.getByRole('textbox', { name: 'Final wager answer' }).fill('Far too many');
  await page.getByRole('button', { name: /Start the event/ }).click();
  let session = await saved(page);
  expect(session.segments).toHaveLength(3);
  expect(session.phase).toBe('segment');
  expect(session.segments[0].status).toBe('setup');
  expect(session.wager.question).toContain('biscuits');
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await expect(page.getByRole('button', { name: 'Continue event', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a new game', exact: true })).toBeVisible();
  await expect(page.getByText(/ACTIVE EVENT · Childhood vs Now · setup/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  const total = (s: any, teamId: string) => s.scoreEntries.filter((e: any) => e.active && e.teamId === teamId).reduce((n: number, e: any) => n + e.points, 0);
  const leader = session.teams[0], challenger = session.teams[1];
  for (let segment = 0; segment < 3; segment++) {
    await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
    await expect(page.getByText(`Correct = ${segment === 1 ? 4 : 2} points. Stolen = ${segment === 1 ? 2 : 1}. Missed = 0.`)).toBeVisible();
    if (segment > 0) {
      await expect(page.locator('.setup-steps').getByRole('button', { name: /People/ })).toBeDisabled();
      await expect(page.getByLabel('Team 1 name', { exact: true })).toBeDisabled();
    }
    await page.getByRole('button', { name: 'Start new game' }).click();
    session = await saved(page);
    expect(total(session, leader.id)).toBe([0, 2, 6][segment]);
    for (let round = 0; round < 4; round++) {
      await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
      await page.getByRole('button', { name: round === 0 ? /^Correct/ : /^Missed/ }).click();
      await page.getByRole('button', { name: round < 3 ? /^Next team:/ : 'Final results' }).click();
    }
    await page.getByRole('button', { name: /^Leaderboard/ }).click();
    await expect(page.getByText(`ROUND ${segment + 1} OF 3`, { exact: false })).toBeVisible();
    session = await saved(page);
    expect(total(session, leader.id)).toBe([2, 6, 8][segment]);
    if (segment === 1) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export session', exact: true }).click();
      const zip = await (await download).path();
      await page.getByLabel('Choose session ZIP').setInputFiles(zip!);
      await expect(page.getByRole('status')).toContainText('Session restored');
      await page.reload();
      const restored = await saved(page);
      expect(restored.scoreEntries).toEqual(session.scoreEntries);
      expect(restored.segments.map((s: any) => s.id)).toEqual(session.segments.map((s: any) => s.id));
      await expect(page.locator('.storage-warning')).toHaveCount(0);
    }
    await page.getByRole('button', { name: segment < 2 ? 'Next activity' : 'On to the finish' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Place your bets.' })).toBeVisible();
  for (const team of session.teams) await page.getByLabel(`Wager for ${team.name}`).fill(team.id === leader.id ? '8' : '5');
  await page.getByRole('button', { name: 'Reveal the question' }).click();
  for (const team of session.teams) {
    const row = page.locator('.wager-bet').filter({ has: page.getByText(team.name, { exact: true }) });
    await row.getByRole('button', { name: team.id === challenger.id ? '+5' : team.id === leader.id ? '−8' : '−5', exact: true }).click();
  }
  await page.getByRole('button', { name: 'The final results' }).click();
  await expect(page.locator('.winner-name')).toHaveText(challenger.name);
  session = await saved(page);
  expect(total(session, leader.id)).toBe(0); expect(total(session, challenger.id)).toBe(5);
  await page.reload();
  await expect(page.locator('.winner-name')).toHaveText(challenger.name);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const pairDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pairs', exact: true }).click();
  const pairs = await (await pairDownload).path();
  const replacementFile = { name: 'people.zip', mimeType: 'application/zip', buffer: await readFile(pairs!) };
  const beforeReplace = await saved(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByLabel('Import face pairs ZIP').setInputFiles(replacementFile);
  expect(await saved(page)).toEqual(beforeReplace);
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('All activity progress, scores, and wager bets'); await dialog.accept(); });
  await page.getByLabel('Import face pairs ZIP').setInputFiles(replacementFile);
  await expect(page.getByRole('status')).toContainText('4 people imported.');
  const replaced = await saved(page);
  expect(replaced.scoreEntries).toEqual([]); expect(replaced.wager.bets).toEqual({});
  expect(replaced.wager.question).toBe(beforeReplace.wager.question);
  expect(replaced.teams).toEqual(beforeReplace.teams);
  expect(replaced.currentSegmentIndex).toBe(0);
  expect(replaced.segments.map((s: any) => s.status)).toEqual(['setup', 'pending', 'pending']);
  for (const segment of replaced.segments) {
    expect(segment.game.rounds).toEqual([]);
  }
  expect(replaced.assets[replaced.photoSets[0].nowImageId]).toBeTruthy();
  expect(beforeReplace.assets[replaced.photoSets[0].nowImageId]).toBeUndefined();
  await page.reload();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
  expect(errors).toEqual([]);
});

// The boot session already lands on a running Childhood vs Now demo (main.tsx starts a game before
// App ever mounts), so a fresh load never shows the home screen home() expects. Reach it via the
// brand button instead, which is unaffected by whatever segment/status the boot demo left behind.
async function aioHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await expect(page.getByRole('heading', { name: 'What are we playing?' })).toBeVisible();
}
// Cards are rendered in registration order, which is whatever import.meta.glob returns — do not
// address them by index. Scope to the card that carries the heading instead.
const activityCard = (page: Page, name: string) => page.locator('.activity-card', { has: page.getByRole('heading', { name, level: 2 }) });

async function startDemo(page: Page, name: string) {
  await activityCard(page, name).getByRole('button', { name: /Try the demo|Try demo separately/ }).click();
}

async function playTurn(page: Page, { got, skip }: { got: number; skip: number }) {
  await page.getByRole('button', { name: 'Start the turn' }).click();
  for (let i = 0; i < got; i++) await page.getByRole('button', { name: /^Got it/ }).click();
  for (let i = 0; i < skip; i++) await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
}

test('act it out: a full demo run, scoring, undo and the finale', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await startDemo(page, 'Act It Out');
  await expect(page.getByRole('heading', { name: /you’re on\.$/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/aio-ready.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('textbox', { name: 'Name of the person guessing' }).fill('Sam');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await expect(page.getByText('Sam is guessing')).toBeVisible();
  await page.screenshot({ path: 'test-results/aio-acting.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: /^Got it/ }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();
  let session = await saved(page);
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(4);

  // Undo is derived, not decremented: the ledger keeps one entry and it falls to 2.
  await page.getByRole('button', { name: 'Undo' }).click();
  session = await saved(page);
  expect(session.scoreEntries).toHaveLength(1);
  expect(session.scoreEntries[0].points).toBe(2);
  expect(session.segments[0].game.cursor).toBe(1);

  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByRole('heading', { name: /got 1\.$/ })).toBeVisible();

  const teams = (await saved(page)).teams.length;
  await page.getByRole('button', { name: /^Next: / }).click();
  for (let i = 1; i < teams; i++) {
    await playTurn(page, { got: 1, skip: 1 });
    await page.getByRole('button', { name: i < teams - 1 ? /^Next: / : 'Final results' }).click();
  }
  await expect(page.getByRole('heading', { name: 'That’s a wrap.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nobody got these' })).toBeVisible();
  await page.screenshot({ path: 'test-results/aio-finale.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('act it out: a refresh mid-turn restores the clock, the cursor and the tally', async ({ page }) => {
  await aioHome(page);
  await startDemo(page, 'Act It Out');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();
  await page.getByRole('button', { name: 'Skip' }).click();

  const before = await saved(page);
  const prompt = before.segments[0].game.deck[before.segments[0].game.cursor].text;
  await page.reload();

  await expect(page.getByText('1 guessed')).toBeVisible();
  await expect(page.getByText('1 skipped')).toBeVisible();
  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  const after = await saved(page);
  expect(after.segments[0].game.cursor).toBe(2);
  // The timer persists a deadline, not a tick, so the clock does not restart on reload.
  expect(after.segments[0].game.timer.deadlineAt).toBe(before.segments[0].game.timer.deadlineAt);
});

test('an event runs two different activities on one leaderboard', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await page.getByRole('button', { name: /^Build an event/ }).click();
  await expect(page.getByRole('heading', { name: 'Build your Friday.' })).toBeVisible();

  await page.getByRole('button', { name: 'Act It Out', exact: true }).click();
  await page.getByRole('button', { name: 'Childhood vs Now', exact: true }).click();
  let session = await saved(page);
  expect(session.segments.map((s: any) => s.activityId)).toEqual(['act-it-out', 'childhood-vs-now']);
  await page.screenshot({ path: 'test-results/lineup-two-activities.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: 'Start the event' }).click();
  await expect(page.getByRole('heading', { name: /What are we acting\?$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next: game setup' }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();

  const teams = (await saved(page)).teams.length;
  for (let i = 0; i < teams; i++) {
    await playTurn(page, { got: 2, skip: 0 });
    await page.getByRole('button', { name: i < teams - 1 ? /^Next: / : 'Final results' }).click();
  }
  await page.getByRole('button', { name: /^Leaderboard/ }).click();
  session = await saved(page);
  const afterFirst = session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0);
  expect(afterFirst).toBe(teams * 2 * session.correctPoints);
  expect(new Set(session.scoreEntries.map((e: any) => e.segmentId))).toEqual(new Set([session.segments[0].id]));

  // Moving on must reach Childhood vs Now's setup with the roster locked, not strand the host.
  await page.getByRole('button', { name: /^Next activity/ }).click();
  await expect(page.locator('.setup-steps').getByRole('button', { name: /People/ })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
  session = await saved(page);
  expect(session.currentSegmentIndex).toBe(1);
  expect(session.segments[0].status).toBe('done');
  // The first activity's points survive the switch.
  expect(session.scoreEntries.filter((e: any) => e.active).reduce((n: number, e: any) => n + e.points, 0)).toBe(afterFirst);
  expect(errors).toEqual([]);
});

test('childhood vs now: the whole team reveal wipes between photos and spotlights a person', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await startDemo(page, 'Childhood vs Now');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  const slider = page.getByRole('slider', { name: 'Reveal original group photo' });
  await slider.fill('30');
  await expect(page.locator('.wipe-now')).toHaveCSS('clip-path', 'inset(0px 70% 0px 0px)');
  await expect(page.locator('.wipe-line')).toHaveAttribute('style', /left: 30%/);
  await expect(page.locator('.wipe-label.then')).toHaveText('THEN');
  await expect(page.locator('.wipe-label.now')).toHaveText('NOW');
  await expect(page.locator('.spotlight-box')).toHaveCount(0);
  await page.getByRole('button', { name: 'Asha', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toBeVisible();
  await expect(page.locator('.spotlight-box')).toHaveText('Asha');
  await page.getByRole('button', { name: 'Everyone', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('act it out: a custom category, an edited built-in and the describe-it rule', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await page.getByRole('button', { name: /^Build an event/ }).click();
  await page.getByRole('button', { name: 'Act It Out', exact: true }).click();
  await page.getByRole('button', { name: 'Start the event' }).click();
  await expect(page.getByRole('heading', { name: /What are we acting\?$/ })).toBeVisible();

  // Editing a built-in marks it as edited and offers the way back.
  await page.getByRole('button', { name: 'Edit Office Life' }).click();
  const reset = page.getByRole('button', { name: 'Reset to original' });
  await expect(reset).toBeDisabled();
  await page.getByRole('textbox', { name: 'Prompts in Office Life, one per line' }).fill('Printer jam\nThe 4pm deploy');
  await expect(page.getByRole('button', { name: 'Edit Office Life' })).toContainText('2 prompts · edited');
  await reset.click();
  await expect(reset).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Edit Office Life' })).toContainText('30 prompts');

  // Deal only from a category of the host's own.
  for (const name of ['Office Life', 'Movies & TV', 'Actions', 'Around the House']) await page.getByRole('button', { name: `Deal from ${name}` }).click();
  await expect(page.getByRole('button', { name: 'Next: game setup' })).toBeDisabled();
  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByRole('textbox', { name: 'Category name' }).fill('Kerala');
  const kerala = Array.from({ length: 30 }, (_, i) => i ? `Kerala prompt ${i}` : 'Kalaripayattu');
  await page.getByRole('textbox', { name: 'Prompts in Kerala, one per line' }).fill(kerala.join('\n'));
  await expect(page.getByRole('button', { name: 'Edit Kerala' })).toContainText('30 prompts');
  await page.getByRole('button', { name: 'Next: game setup' }).click();

  await page.getByRole('button', { name: /^Describe it/ }).click();
  await expect(page.getByText(/never say|except the words on the card/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.getByText(/Everyone else talks them to it/)).toBeVisible();
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await expect(page.locator('.prompt-card .eyebrow')).toHaveText('Kerala');
  await expect(page.locator('.prompt-card small')).toHaveText('Don’t say the words');
  await page.screenshot({ path: 'test-results/aio-describe.png', fullPage: true, animations: 'disabled' });

  const session = await saved(page);
  expect(session.segments[0].settings.rule).toBe('describe');
  expect(new Set(session.segments[0].game.deck.map((p: any) => p.category))).toEqual(new Set(['Kerala']));
  expect(errors).toEqual([]);
});

test('a partial second group from a version 1 file joins the game and gets its own reveal slide', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await aioHome(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  // Export the demo group and rebuild it as a version 1 bundle, the format older exports used.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pairs', exact: true }).click();
  const exported = unzipSync(await readFile((await (await download).path())!));
  const manifest = JSON.parse(strFromU8(exported['face-pairs.json'])), set = manifest.sets[0];
  const groups: Record<string, unknown> = { now: { ...set.now, path: 'groups/now' }, then: { ...set.then, path: 'groups/then' } };
  const files: Record<string, Uint8Array> = { 'groups/now': exported['sets/01/now'], 'groups/then': exported['sets/01/then'] };
  if (set.nowPreview) { groups.nowPreview = { ...set.nowPreview, path: 'groups/now-preview' }; files['groups/now-preview'] = exported['sets/01/now-preview']; }
  if (set.thenPreview) { groups.thenPreview = { ...set.thenPreview, path: 'groups/then-preview' }; files['groups/then-preview'] = exported['sets/01/then-preview']; }
  for (const pair of manifest.pairs) for (const side of ['now', 'then']) files[pair[side].cropPath] = exported[pair[side].cropPath];
  files['face-pairs.json'] = strToU8(JSON.stringify({ version: 1, groups, pairs: manifest.pairs.map(({ set: _set, ...pair }: any) => pair) }));

  await page.getByLabel('Add face pairs ZIP').setInputFiles({ name: 'Design offsite.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) });
  await expect(page.getByRole('heading', { name: 'Some names match' })).toBeVisible();
  await page.getByRole('button', { name: 'Add anyway' }).click();
  await expect(page.getByRole('status')).toContainText('4 people added.');
  const second = page.getByRole('region', { name: 'Design offsite' });
  await second.getByRole('button', { name: 'Everyone out' }).click();
  await second.getByRole('checkbox', { name: 'Include Asha' }).check();
  await second.getByRole('checkbox', { name: 'Include Leo' }).check();
  const session = await saved(page);
  expect(session.photoSets.map((s: any) => s.name)).toEqual(['Demo team', 'Design offsite']);
  expect(session.people.filter((p: any) => p.included)).toHaveLength(6);
  expect(session.isDemo).toBe(false);

  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await expect(page.getByText(/Demo team \(1 of 2\)/)).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Reveal original group photo' });
  await slider.focus(); await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1');
  await expect(page.getByText(/Demo team \(1 of 2\)/)).toBeVisible();
  await page.getByRole('heading', { name: 'Look how far we’ve come.' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/Design offsite \(2 of 2\)/)).toBeVisible();
  await expect(page.locator('.spotlight-controls button')).toHaveCount(3);
  await page.locator('.spotlight-controls').getByRole('button', { name: 'Leo', exact: true }).click();
  await expect(page.locator('.spotlight-box')).toHaveText('Leo');
  await expect(page.locator('.image-missing')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a person added from two single photos is revealed on the last slide', async ({ page }) => {
  test.setTimeout(120_000);
  await aioHome(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const makeImage = async (w: number, h: number) => Buffer.from(await page.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f1dfbf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c98f6b'; ctx.beginPath(); ctx.ellipse(w * .5, h * .4, w * .2, h * .18, 0, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL('image/jpeg', .9).split(',')[1];
  }, { w, h }), 'base64');
  await page.getByRole('button', { name: 'Add a person' }).click();
  await page.getByLabel('Person name').fill('Priya');
  await page.getByLabel('Childhood photo').setInputFiles({ name: 'priya-then.jpg', mimeType: 'image/jpeg', buffer: await makeImage(500, 700) });
  await page.getByLabel('Current photo').setInputFiles({ name: 'priya-now.jpg', mimeType: 'image/jpeg', buffer: await makeImage(600, 800) });
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByRole('status')).toContainText('Priya added.', { timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Single photos' }).getByRole('img', { name: 'Priya now' })).toBeVisible();

  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await page.getByRole('button', { name: 'Next reveal photo' }).click();
  await expect(page.getByRole('heading', { name: 'Also in the game' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Priya as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Priya now' })).toBeVisible();
});

test('a version 2 session saved before photo sets still opens with its people', async ({ page }) => {
  const doc = await readFile('tests/fixtures/event-v2.json', 'utf8');
  await page.addInitScript(([k, value]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, value); sessionStorage.setItem('seeded', '1'); } }, [key, doc] as const);
  await page.goto('/');
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Group 1' })).toBeVisible();
  await expect(page.getByLabel(/^Library name/)).toHaveValue('Asha');
});
