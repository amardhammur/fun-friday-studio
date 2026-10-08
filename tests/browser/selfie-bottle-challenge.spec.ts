import { expect, test, type Page } from '@playwright/test';
import { openWelcome, personalKey, resumeEvent, startDemo } from './helpers';

async function setup(page: Page, playersPerTeam: 1 | 3 = 1) {
  await openWelcome(page); await startDemo(page, 'Selfie Bottle Challenge');
  await page.evaluate(({ key, playersPerTeam }) => {
    const event = JSON.parse(localStorage.getItem('fun-friday-studio.demo.v1')!);
    event.isDemo = false; event.phase = 'segment'; event.correctPoints = 7;
    event.teams = event.teams.slice(0, 2); event.players = event.players.slice(0, 6);
    event.segments[0].status = 'setup'; event.segments[0].weight = 3;
    event.segments[0].settings = { playersPerTeam, turnSeconds: 60, turnOrder: 'team-by-team', selections: {} };
    event.segments[0].game = { turns: [], currentTurnIndex: 0 };
    event.segments.push({ id: 'other-segment', activityId: 'act-it-out', activityVersion: 2, title: 'Act It Out', status: 'pending', setupStepId: 'game', weight: 1, settings: { rule: 'act', categories: [], turnSeconds: 90, roundsPerTeam: 1 }, game: { deck: [], cursor: 0, turns: [], currentTurnIndex: 0, timer: { durationMs: 90_000 } } });
    event.scoreEntries = [{ id: 'other-score', segmentId: 'other-segment', teamId: event.teams[0].id, kind: 'manual-adjustment', points: 7, active: true }];
    localStorage.setItem(key, JSON.stringify(event)); localStorage.removeItem('fun-friday-studio.demo.v1');
  }, { key: personalKey, playersPerTeam });
  await page.reload(); await resumeEvent(page);
  await expect(page.getByRole('heading', { name: 'Eyes on the selfie.' })).toBeVisible();
}
async function openOptions(page: Page) {
  const options = page.locator('.bottle-options');
  if (await options.getAttribute('open') === null) await options.locator('summary').click();
}
async function quickStart(page: Page) {
  await expect(page.locator('.bottle-setup').getByRole('combobox')).toHaveCount(0);
  await openOptions(page);
  await page.getByRole('button', { name: '45 seconds', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await expect(page.locator('.bottle-stage')).not.toContainText('Asha');
  await expect(page.locator('.bottle-stage')).not.toContainText('Face away');
}
const startTurn = (page: Page) => page.getByRole('button', { name: 'Start turn', exact: true }).click();
const endTurn = (page: Page) => page.getByRole('button', { name: 'Finish turn', exact: true }).click();
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);

test('starts with defaults without player selection and preserves equal automatic participation across refresh', async ({ page }) => {
  await setup(page, 3);
  expect((await saved(page)).segments[0].settings).toMatchObject({ playersPerTeam: 3, turnSeconds: 60, turnOrder: 'team-by-team' });
  await expect(page.locator('.bottle-options')).not.toHaveAttribute('open');
  await expect(page.locator('.bottle-setup').getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  const started = await saved(page);
  expect(started.segments[0].game.turns).toHaveLength(6);
  expect(new Set(started.segments[0].game.turns.map((t: any) => t.playerId)).size).toBe(6);
  expect(started.segments[0].game.turns.map((t: any) => t.timer.durationMs)).toEqual(Array(6).fill(60_000));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready?', exact: true })).toBeVisible();
  expect((await saved(page)).segments[0].game.turns).toEqual(started.segments[0].game.turns);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await openOptions(page);
  await page.getByRole('button', { name: '1 player', exact: true }).click();
  await quickStart(page);
  const event = await saved(page);
  expect(event.segments[0].game.turns).toHaveLength(2);
  expect(event.segments[0].game.turns.map((t: any) => t.timer.durationMs)).toEqual([45_000, 45_000]);
  await expect(page.getByRole('heading', { name: 'Ready?', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/bottle-ready.png', fullPage: true });
});

test('timer and count drafts survive refresh, zero ties stand, corrections and ZIP restore score once, restart is scoped', async ({ page }, testInfo) => {
  await setup(page); await quickStart(page); await startTurn(page);
  await expect(page.getByRole('timer', { name: 'Player turn timer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset the timer', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause the timer', exact: true }).click();
  const remaining = (await saved(page)).segments[0].game.turns[0].timer.pausedRemainingMs;
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume activity', exact: true })).toBeVisible();
  await page.reload(); await resumeEvent(page); await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start the timer', exact: true })).toBeVisible();
  expect((await saved(page)).segments[0].game.turns[0].timer.pausedRemainingMs).toBe(remaining);
  await page.getByRole('button', { name: 'Start the timer', exact: true }).click();
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!); event.segments[0].game.turns[0].timer.deadlineAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Turn over.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm count', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '0 valid toothpicks', exact: true }).click(); await page.reload();
  await expect(page.getByRole('button', { name: '0 valid toothpicks', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Confirm count', exact: true }).click();
  await page.getByRole('button', { name: 'Next: Water', exact: true }).click(); await startTurn(page); await endTurn(page);
  await page.getByRole('button', { name: '0 valid toothpicks', exact: true }).click(); await page.getByRole('button', { name: 'Confirm count', exact: true }).click();
  await page.getByRole('button', { name: 'Activity results', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A shared win.', exact: true })).toBeVisible();
  await expect(page.getByText('Earth & Water · 0 points each · ties stand', { exact: true })).toBeVisible();
  const team = page.locator('.bottle-standing').filter({ hasText: 'Earth' });
  await team.getByText('Player counts & corrections', { exact: true }).click();
  await team.getByRole('button', { name: '10 valid toothpicks', exact: true }).click(); await team.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth takes it.', exact: true })).toBeVisible();
  let event = await saved(page);
  expect(event.scoreEntries.filter((e: any) => e.segmentId === event.segments[0].id)).toHaveLength(2);
  expect(event.scoreEntries.find((e: any) => e.segmentId === event.segments[0].id && e.teamId === event.teams[0].id).points).toBe(30);
  await page.screenshot({ path: 'test-results/bottle-finale.png', fullPage: true });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export event', exact: true }).last().click();
  const download = await downloading, zip = testInfo.outputPath('bottle-session.zip'); await download.saveAs(zip);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Restart challenge', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Eyes on the selfie.', exact: true })).toBeVisible();
  event = await saved(page); expect(event.scoreEntries.map((e: any) => e.id)).toEqual(['other-score']); expect(event.segments[0].game.turns).toEqual([]);
  await page.getByLabel('Choose session ZIP', { exact: true }).setInputFiles(zip);
  await expect(page.getByRole('heading', { name: 'Earth takes it.', exact: true })).toBeVisible();
  event = await saved(page); expect(event.scoreEntries.filter((e: any) => e.segmentId === event.segments[0].id)).toHaveLength(2);
  expect(event.segments[0].game.turns.map((t: any) => t.count)).toEqual([10, 0]);
});

test('a running turn expires while the host corrects an earlier count and remains usable offline', async ({ page }) => {
  await page.addInitScript(() => {
    const beeps: number[] = []; (window as any).bottleBeeps = beeps;
    (window as any).AudioContext = class {
      state = 'running'; currentTime = 0; destination = {};
      createOscillator() { const oscillator = { frequency: { value: 0 }, type: '', connect() {}, start() { beeps.push(oscillator.frequency.value); }, stop() {} }; return oscillator; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    };
  });
  await setup(page); await quickStart(page); await startTurn(page); await endTurn(page);
  await page.getByRole('button', { name: '4 valid toothpicks', exact: true }).click(); await page.getByRole('button', { name: 'Confirm count', exact: true }).click();
  await page.getByRole('button', { name: 'Next: Water', exact: true }).click(); await startTurn(page);
  await page.getByRole('button', { name: 'Previous player', exact: true }).click();
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!); event.segments[0].game.turns[1].timer.deadlineAt = Date.now() + 1_000; localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload();
  await expect(page.getByRole('timer', { name: 'Player turn timer' })).toBeVisible();
  await expect.poll(async () => (await saved(page)).segments[0].game.turns[1].status).toBe('counting');
  expect(await page.evaluate(() => (window as any).bottleBeeps)).toContain(420);
  await page.getByRole('button', { name: 'Return to current player', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Turn over.', exact: true })).toBeVisible();
  await expect(page.locator('.offline-status')).toHaveText('Offline ready');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.context().setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Turn over.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4 valid toothpicks', exact: true }).click(); await page.getByRole('button', { name: 'Confirm count', exact: true }).click();
  await page.getByRole('button', { name: 'Activity results', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A shared win.', exact: true })).toBeVisible();
  await page.context().setOffline(false);
});

test('both turn orders are available and the selected order is saved', async ({ page }) => {
  await setup(page, 3);
  await openOptions(page);
  await expect(page.getByRole('button', { name: 'One team at a time', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Alternate teams', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  let event = await saved(page);
  expect(event.segments[0].game.turns.map((t: any) => t.playerId)).toEqual(['bottle-demo-0-0', 'bottle-demo-1-0', 'bottle-demo-0-1', 'bottle-demo-1-1', 'bottle-demo-0-2', 'bottle-demo-1-2']);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await openOptions(page);
  await page.getByRole('button', { name: 'One team at a time', exact: true }).click(); await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  event = await saved(page);
  expect(event.segments[0].game.turns.map((t: any) => t.playerId)).toEqual(['bottle-demo-0-0', 'bottle-demo-0-1', 'bottle-demo-0-2', 'bottle-demo-1-0', 'bottle-demo-1-1', 'bottle-demo-1-2']);
});

for (const theme of ['afterhours', 'gameshow', 'ink']) test(`simple stage and count controls fit desktop and mobile (${theme})`, async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('studio-theme', t), theme);
  await setup(page);
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeInViewport();
  await page.screenshot({ path: `test-results/bottle-setup-${theme}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/bottle-setup-mobile-${theme}.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await quickStart(page);
  await expect(page.getByRole('heading', { name: 'Ready?', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Start turn', exact: true })).toBeInViewport();
  const graphic = page.getByRole('img', { name: 'A phone selfie preview and a toothpick dropping into a bottle', exact: true });
  await expect(graphic).toBeInViewport();
  expect(await graphic.evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await graphic.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.screenshot({ path: `test-results/bottle-ready-${theme}.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startTurn(page); await expect(page.getByRole('timer', { name: 'Player turn timer' })).toBeInViewport();
  await page.screenshot({ path: `test-results/bottle-clock-${theme}.png`, fullPage: true });
  await endTurn(page); await expect(page.getByRole('button', { name: '10 valid toothpicks', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Confirm count', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '10 valid toothpicks', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm count', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next: Water', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => {
    const main = document.querySelector('.bottle-stage .game-stage')!.getBoundingClientRect(), board = document.querySelector('.bottle-stage .scoreboard')!.getBoundingClientRect();
    const brand = document.querySelector('.show-masthead-brand')!.getBoundingClientRect(), activity = document.querySelector('.show-masthead-activity')!.getBoundingClientRect();
    return main.bottom <= board.top && brand.bottom <= activity.top;
  })).toBe(true);
  await page.screenshot({ path: `test-results/bottle-mobile-${theme}.png`, fullPage: true });
});
