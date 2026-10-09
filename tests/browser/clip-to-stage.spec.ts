import { test, expect, type Page } from '@playwright/test';
import { openWelcome, personalKey } from './helpers';

const saveLabel = 'Save scores & see results';
async function setup(page: Page) {
  await openWelcome(page);
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('button', { name: 'Clip to Stage', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
}
async function startYouTube(page: Page) {
  await setup(page);
  await page.getByLabel('Clip title', { exact: true }).fill('Friday chorus');
  await page.getByLabel('YouTube link', { exact: true }).fill('https://www.youtube.com/shorts/M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
}
async function finishPerformances(page: Page) {
  await page.getByRole('button', { name: 'Start first performance', exact: true }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: i === 4 ? 'Enter judge scores' : 'Next team', exact: true }).click();
}
async function enterScores(page: Page) {
  const teams = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).teams, personalKey);
  for (let i = 0; i < teams.length; i++) await page.getByRole('spinbutton', { name: `Score for ${teams[i].name}`, exact: true }).fill(String(i === 0 ? 30 : i === 1 ? 25 : 0));
  return teams;
}
async function recordedVideo(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d')!, stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const finished = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
    const draw = () => { ctx.fillStyle = '#10192d'; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = '#f7d873'; ctx.font = '28px sans-serif'; ctx.fillText('Clap · Step · Sing', 45, 100); };
    draw(); recorder.start(); const frames = setInterval(draw, 100);
    await new Promise(resolve => setTimeout(resolve, 1000)); recorder.stop();
    const blob = await finished; clearInterval(frames); stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return { name: 'Friday chorus.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) };
}

for (const theme of ['afterhours', 'gameshow', 'ink']) test(`watch, practise, perform and correct judge scores (${theme})`, async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('studio-theme', t), theme);
  await startYouTube(page);
  await expect(page.getByRole('heading', { name: 'Watch the clip.', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.cts-stage iframe')).toHaveCount(0);
  await page.screenshot({ path: `test-results/cts-${theme}-watch.png` });
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Practice timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make it your own.', exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/cts-${theme}-practice.png` });
  await finishPerformances(page);
  await expect(page.getByRole('heading', { name: 'Judge scores.', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeDisabled();
  const teams = await enterScores(page);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true })).toHaveValue('30');
  const first = page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true });
  await first.fill('1.5'); await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeDisabled();
  await first.fill('30');
  await page.screenshot({ path: `test-results/cts-${theme}-judging.png` });
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.locator('.cts-champion')).toContainText(teams[0].name);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a bow!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  await page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true }).fill('15');
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.locator('.cts-champion')).toContainText(teams[1].name);
  const event = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  expect(event.scoreEntries).toHaveLength(5);
  expect(event.scoreEntries.find((e: any) => e.teamId === teams[0].id).points).toBe(15);
  await page.screenshot({ path: `test-results/cts-${theme}-results.png` });
  await page.getByRole('button', { name: 'View overall standings', exact: true }).click();
  await expect(page.locator('.interstitial-board')).toContainText('25');
});

test('validates sources and loads a canonical YouTube player only when requested', async ({ page }) => {
  await setup(page);
  const input = page.getByLabel('YouTube link', { exact: true }), start = page.getByRole('button', { name: 'Start activity', exact: true });
  await expect(start).toBeDisabled();
  for (const url of ['https://example.com/watch?v=M7lc1UVf-VE', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE', 'javascript:alert(1)']) {
    await input.fill(url); await expect(start).toBeDisabled();
  }
  await input.fill('https://youtu.be/M7lc1UVf-VE?t=1m5s'); await start.click();
  await expect(page.locator('.cts-stage iframe')).toHaveCount(0);
  let requests = 0;
  await page.route('https://www.youtube.com/embed/**', route => { requests++; return route.fulfill({ contentType: 'text/html', body: '<p>Player request received</p>' }); });
  await page.getByRole('button', { name: 'Load YouTube video', exact: true }).click();
  await expect(page.getByTitle('YouTube reference clip', { exact: true })).toHaveAttribute('src', 'https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1&start=65');
  await expect(page.frameLocator('iframe[title="YouTube reference clip"]').locator('body')).toContainText('Player request received');
  await expect(page.locator('.cts-source-links')).toContainText('Video unavailable?');
  await page.getByRole('button', { name: 'Retry YouTube player', exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByRole('link', { name: 'Open clip on YouTube', exact: true })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=65s');
  await page.screenshot({ path: 'test-results/cts-youtube-fallback.png' });
});

test('uploads a local clip, exports and imports it, and plays after an offline reload', async ({ page, context }) => {
  await setup(page);
  await page.getByLabel('Reference source', { exact: true }).selectOption('local');
  await page.getByLabel('Local video', { exact: true }).setInputFiles(await recordedVideo(page));
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  const video = page.getByLabel('Reference clip', { exact: true });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  const oldId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].settings.videoAssetId, personalKey);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export event', exact: true }).click();
  const download = await downloading;
  await page.getByLabel('Choose session ZIP', { exact: true }).setInputFiles((await download.path())!);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].settings.videoAssetId, personalKey)).not.toBe(oldId);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.offline-status')).toContainText('Offline ready');
  await context.setOffline(true); await page.reload();
  await expect.poll(() => page.getByLabel('Reference clip', { exact: true }).evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.getByLabel('Reference clip', { exact: true }).evaluate(async (v: HTMLVideoElement) => { v.muted = true; await v.play(); });
  await expect.poll(() => page.getByLabel('Reference clip', { exact: true }).evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await finishPerformances(page); await enterScores(page);
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a bow!', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('rejects an unplayable local video and preserves the selected clip on Start over', async ({ page }) => {
  await setup(page);
  await page.getByLabel('Reference source', { exact: true }).selectOption('local');
  await page.getByLabel('Local video', { exact: true }).setInputFiles({ name: 'broken.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not a video') });
  await expect(page.locator('.toast')).toContainText('cannot be played');
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeDisabled();
  await page.getByLabel('Local video', { exact: true }).setInputFiles(await recordedVideo(page));
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  const assetId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].settings.videoAssetId, personalKey);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].settings.videoAssetId, personalKey)).toBe(assetId);
});

test('projector screens fit at 720p and mobile score controls remain reachable', async ({ page }) => {
  await startYouTube(page);
  for (const step of ['watch', 'practise', 'perform', 'judging']) {
    if (step === 'practise') await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    if (step === 'perform') await page.getByRole('button', { name: 'Start first performance', exact: true }).click();
    if (step === 'judging') for (let i = 0; i < 5; i++) await page.getByRole('button', { name: i === 4 ? 'Enter judge scores' : 'Next team', exact: true }).click();
    const position = await page.locator('.cts-actions .primary').evaluate(el => { const r = el.getBoundingClientRect(); return { visible: el.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 2)), bottom: r.bottom }; });
    expect(position.visible, step).toBe(true);
    const dimensions = await page.locator('.cts-scene').evaluate(el => ({ content: el.scrollHeight, available: el.clientHeight }));
    expect(dimensions.content, step).toBeLessThanOrEqual(dimensions.available + 1);
  }
  await page.screenshot({ path: 'test-results/cts-projector-judging.png' });
  await enterScores(page); await page.getByRole('button', { name: saveLabel, exact: true }).click();
  const finale = await page.locator('.cts-finale').evaluate(el => ({ content: el.scrollHeight, available: el.clientHeight }));
  expect(finale.content).toBeLessThanOrEqual(finale.available + 1);
  await page.screenshot({ path: 'test-results/cts-projector-results.png' });
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 600 });
  await enterScores(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/cts-mobile-judging.png', fullPage: true });
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a bow!', exact: true })).toBeVisible();
});
