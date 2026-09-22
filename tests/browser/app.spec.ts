import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
const key = 'fun-friday-studio.session.v1';
const saved = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
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
  expect(importedGame.finale).toEqual({ wipePosition: 0 });
  expect(Object.keys(imported.assets).some(id => demoSession.assets[id])).toBe(false);
  expect(imported.assets[importedGame.originalImageId]).toBeTruthy();
  expect(imported.assets[importedGame.childhoodImageId]).toBeTruthy();
  expect(importedGame.childhoodUploadId).toBe(importedGame.childhoodImageId);
  expect(imported.assets[importedGame.previews[importedGame.originalImageId]]).toBeTruthy();
  expect(imported.assets[importedGame.previews[importedGame.childhoodImageId]]).toBeTruthy();
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
  expect(session.assets[session.segments[0].game.originalImageId].width).toBe(4200);
  expect(session.assets[session.segments[0].game.childhoodUploadId].width).toBe(2800);
  expect(session.assets[session.segments[0].game.childhoodImageId].width).toBe(4200);
  expect(session.assets[session.segments[0].game.childhoodImageId].height).toBe(2400);
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
      await expect(page.getByRole('button', { name: 'Upload photos', exact: false })).toBeDisabled();
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
    expect(replaced.assets[segment.game.originalImageId]).toBeTruthy();
    expect(beforeReplace.assets[segment.game.originalImageId]).toBeUndefined();
  }
  await page.reload();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
  expect(errors).toEqual([]);
});
