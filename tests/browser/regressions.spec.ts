import { test, expect } from '@playwright/test';
import { openWelcome, personalKey, personalPhotoEvent, resumeEvent, startDemo } from './helpers';

const sessionKey = 'fun-friday-studio.demo.v1';

test('pausing Act It Out mid-turn keeps scores and holds the clock', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page, 'Act It Out');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  const prompt = before.segments[0].game.deck[before.segments[0].game.cursor].text;
  const activeScore = before.scoreEntries.filter((entry: any) => entry.active).reduce((sum: number, entry: any) => sum + entry.points, 0);
  expect(activeScore).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a breather.' })).toBeVisible();
  await expect(page.getByText(/Turn 1 of \d+ in progress/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start over', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Turn length in seconds' })).toHaveCount(0);
  const held = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(held.segments[0].game.clockHeld).toBe(true);
  expect(held.segments[0].game.timer.deadlineAt).toBeUndefined();
  const left = held.segments[0].game.timer.pausedRemainingMs;

  await page.waitForTimeout(1_500);
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();

  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  const after = await page.evaluate(key => ({ saved: JSON.parse(localStorage.getItem(key)!), now: Date.now() }), sessionKey);
  const { timer, ...game } = after.saved.segments[0].game, { timer: _timer, ...beforeGame } = before.segments[0].game;
  expect(after.saved.segments[0].status).toBe('play');
  expect(game).toEqual(beforeGame);
  expect(timer.deadlineAt - after.now).toBeGreaterThan(left - 1_000);
  expect(after.saved.scoreEntries).toEqual(before.scoreEntries);
});

test('resetting a running turn clock asks the host first', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page, 'Act It Out');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  const timer = async () => (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey)).segments[0].game.timer;
  const running = await timer();

  let message = '';
  page.once('dialog', dialog => { message = dialog.message(); void dialog.dismiss(); });
  await page.getByRole('button', { name: 'Reset the timer' }).click();
  expect(message).toContain('more time than other teams get');
  expect(await timer()).toEqual(running);

  page.once('dialog', dialog => { void dialog.accept(); });
  await page.getByRole('button', { name: 'Reset the timer' }).click();
  await expect.poll(timer).toEqual({ durationMs: running.durationMs });
});

test('pausing Childhood vs Now resumes without clearing scores', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page);
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  const round = before.segments[0].game.rounds[before.segments[0].game.currentRoundIndex];
  const person = before.people.find((candidate: any) => candidate.id === round.personId);

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText(/1 of \d+ photos played/)).toBeVisible();
  await expect(page.getByText('The setup stays fixed mid-game', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();

  await expect(page.locator('.reveal-name h1')).toHaveText(person.name);
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(after.segments[0].status).toBe('play');
  expect(after.segments[0].game).toEqual(before.segments[0].game);
  expect(after.scoreEntries).toEqual(before.scoreEntries);
});

test('a paused Childhood vs Now game keeps its roster locked until the host starts over', async ({ page }) => {
  await personalPhotoEvent(page);
  await resumeEvent(page);
  await expect(page.getByRole('button', { name: 'Manage people', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume activity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage people', exact: true })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: /Shuffle/ }).or(page.getByRole('checkbox', { name: /Shuffle/ }))).toHaveCount(0);

  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.locator('.library-locked')).toBeVisible();
  for (const toggle of await page.getByRole('checkbox', { name: /^Include / }).all()) await expect(toggle).toBeDisabled();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  expect(after.people).toEqual(before.people);
  expect(after.segments[0].game.rounds).toEqual(before.segments[0].game.rounds);

  await resumeEvent(page);
  page.once('dialog', dialog => { void dialog.accept(); });
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage people', exact: true })).toBeVisible();
  const cleared = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  expect(cleared.segments[0].game.rounds).toEqual([]);
  expect(cleared.scoreEntries).toEqual([]);
});

test('Act It Out arrow shortcuts cannot move away from an acting turn', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page, 'Act It Out');
  await page.getByRole('button', { name: 'Start the turn' }).click();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(before.segments[0].game.turns[0].status).toBe('acting');
  await expect(page.getByRole('button', { name: 'Previous turn', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next turn', exact: true })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');

  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(after.segments[0].game.currentTurnIndex).toBe(before.segments[0].game.currentTurnIndex);
  expect(after.segments[0].game.turns[0].status).toBe('acting');
  expect(after.segments[0].game.timer.deadlineAt).toBe(before.segments[0].game.timer.deadlineAt);
});

test('CSV import preview shows the fun facts that will be applied', async ({ page }) => {
  await personalPhotoEvent(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await page.getByRole('button', { name: 'Edit photos & matches' }).click();
  await page.getByRole('button', { name: 'Match people', exact: true }).click();
  await page.getByRole('button', { name: 'Name people', exact: true }).click();

  await page.locator('input[aria-label="Import names CSV"]').setInputFiles({
    name: 'names.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Name,Fun fact\nAsha,An artist\nLeo,A dancer\nMaya,A reader\nDev,A runner'),
  });

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('An artist', { exact: true })).toBeVisible();
});
