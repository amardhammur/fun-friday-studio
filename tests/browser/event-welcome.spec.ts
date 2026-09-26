import { test, expect } from '@playwright/test';

test('welcome stays audience-facing with a saved event and on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good teams make great memories.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overall leaderboard' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/welcome-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event name', exact: true }).fill('Friday with the crew');
  await page.getByRole('button', { name: 'Act It Out', exact: true }).click();
  await page.getByRole('button', { name: 'Welcome', exact: true }).click();
  await expect(page.getByText('Friday with the crew', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overall leaderboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Let’s get together' }).click();
  await expect(page.getByRole('heading', { name: 'Your lineup' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overall leaderboard' })).toBeVisible();
  await page.screenshot({ path: 'test-results/event-overview.png', fullPage: true });
  await page.getByRole('button', { name: 'Welcome', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/welcome-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('two activities share teams and totals through the final breakdown', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  for (let n = 5; n > 2; n--) await page.getByRole('button', { name: `Remove team ${n}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Team 1 name' }).fill('Comets');
  await page.getByRole('button', { name: 'Act It Out', exact: true }).click();
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Act It Out', exact: true }) }).getByRole('button', { name: 'Add to event' }).click();
  await page.getByRole('textbox', { name: 'Name for activity 2', exact: true }).fill('Encore');
  await page.getByRole('combobox', { name: 'Points multiplier for activity 2' }).selectOption('3');
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'Next: game setup' }).click();
    await expect(page.getByRole('textbox', { name: 'Team 1 name' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Start activity', exact: true }).click();
    await expect(page.locator('.show-masthead-progress')).toHaveText(`${index + 1} / 2`);
    await expect(page.locator('.point-stake > b')).toHaveText(index === 0 ? '2' : '6');
    await page.getByRole('button', { name: 'Start the turn' }).click();
    await page.getByRole('button', { name: /^Got it/ }).click();
    await page.getByRole('button', { name: 'End turn' }).click();
    await page.getByRole('button', { name: /^Next:/ }).click();
    await page.getByRole('button', { name: 'Start the turn', exact: true }).click();
    await page.getByRole('button', { name: 'End turn', exact: true }).click();
    await page.getByRole('button', { name: 'Activity results', exact: true }).click();
    await expect(page.locator('.aio-total b').first()).toHaveText(index === 0 ? '+2' : '+6');
    await page.getByRole('button', { name: 'View overall standings' }).click();
    await expect(page.locator('.interstitial-total').first()).toHaveText(index === 0 ? '2' : '8');
    await page.getByRole('button', { name: index === 0 ? 'Set up next: Encore' : 'View final results', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Score breakdown' })).toBeVisible();
  const row = page.getByRole('row', { name: /Comets/ });
  await expect(row.getByRole('cell')).toHaveText(['1', '2', '6', '8']);
  await page.screenshot({ path: 'test-results/event-results.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('explicit demos preserve the planned event and return to the welcome screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event name', exact: true }).fill('Our Friday');
  await page.getByRole('button', { name: 'Act It Out', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('fun-friday-studio.session.v1'));
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Act It Out', exact: true }) }).getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('button', { name: 'Start the turn' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good teams make great memories.' })).toBeVisible();
  const after = JSON.parse((await page.evaluate(() => localStorage.getItem('fun-friday-studio.session.v1')))!);
  const original = JSON.parse(before!);
  // Restoring the saved event refreshes its timestamp, while preserving every content field.
  expect({ ...after, updatedAt: original.updatedAt }).toEqual(original);
});

test('the header switches themes and remembers the choice', async ({ page }) => {
  await page.goto('/');
  const board = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await board()).toBe('rgb(21, 24, 39)');
  await page.getByRole('button', { name: 'Switch to Game Show theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameshow');
  expect(await board()).toBe('rgb(26, 43, 122)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameshow');
  await page.screenshot({ path: 'test-results/welcome-gameshow.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to Ink & Paper theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink');
  expect(await board()).toBe('rgb(21, 19, 15)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink');
  await page.screenshot({ path: 'test-results/welcome-ink.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to After Hours theme' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await board()).toBe('rgb(21, 24, 39)');
});
