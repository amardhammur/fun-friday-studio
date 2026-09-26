import { test, expect } from '@playwright/test';
import { openWelcome, startDemo } from './helpers';

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
