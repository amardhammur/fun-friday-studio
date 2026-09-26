import { test, expect } from '@playwright/test';
import { openWelcome, personalPhotoEvent, startDemo } from './helpers';

const sessionKey = 'fun-friday-studio.demo.v1';

test('Host settings resumes Act It Out without clearing scores', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page, 'Act It Out');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  const prompt = before.segments[0].game.deck[before.segments[0].game.cursor].text;
  const activeScore = before.scoreEntries.filter((entry: any) => entry.active).reduce((sum: number, entry: any) => sum + entry.points, 0);
  expect(activeScore).toBeGreaterThan(0);

  let confirmText = '';
  page.once('dialog', dialog => { confirmText = dialog.message(); void dialog.accept(); });
  await page.getByRole('button', { name: 'Host settings', exact: true }).click();

  expect(confirmText).toContain('resume it there');
  expect(confirmText).toContain('restart to clear this activity’s scores');
  await expect(page.getByRole('button', { name: 'Resume activity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart activity (clears its scores)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();

  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(after.segments[0].status).toBe('play');
  expect(after.segments[0].game).toEqual(before.segments[0].game);
  expect(after.scoreEntries).toEqual(before.scoreEntries);
});

test('Host settings resumes Childhood vs Now without clearing scores', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page);
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  const round = before.segments[0].game.rounds[before.segments[0].game.currentRoundIndex];
  const person = before.people.find((candidate: any) => candidate.id === round.personId);

  page.once('dialog', dialog => { void dialog.accept(); });
  await page.getByRole('button', { name: 'Host settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume activity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();

  await expect(page.locator('.reveal-name h1')).toHaveText(person.name);
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), sessionKey);
  expect(after.segments[0].status).toBe('play');
  expect(after.segments[0].game).toEqual(before.segments[0].game);
  expect(after.scoreEntries).toEqual(before.scoreEntries);
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
