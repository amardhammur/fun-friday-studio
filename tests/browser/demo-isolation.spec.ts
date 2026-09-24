import { test, expect } from '@playwright/test';
const key = 'fun-friday-studio.session.v1';

test('demo preserves an imported library through reload, exit and normal setup', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session', exact: true }).click();
  const path = await (await download).path();
  await page.locator('input[aria-label="Choose session ZIP"]').setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('Session restored');
  // Turn the imported sample into a personal event with a distinctive roster.
  await page.evaluate(k => {
    const event = JSON.parse(localStorage.getItem('fun-friday-studio.demo.v1') ?? localStorage.getItem(k)!);
    event.isDemo = false; event.people[0].name = 'Imported colleague';
    event.segments = []; event.phase = 'lineup'; event.scoreEntries = [];
    localStorage.setItem(k, JSON.stringify(event)); localStorage.removeItem('fun-friday-studio.demo.v1');
  }, key);
  await page.reload();
  const before = await page.evaluate(k => localStorage.getItem(k), key);
  await page.getByRole('button', { name: 'Try the demo', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(before);
  await page.reload();
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.locator('input[value="Imported colleague"]')).toBeVisible();
  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Try the demo', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Use my photos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Childhood vs Now', exact: true }) }).getByRole('button', { name: 'Set up your game', exact: true }).click();
  await page.getByRole('navigation', { name: 'Activity setup' }).getByRole('button', { name: /People/ }).click();
  await expect(page.getByRole('heading', { name: 'Who’s playing today?' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Imported colleague now', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Group name for Demo team', exact: true }).fill('Friday friends');
  await page.getByRole('textbox', { name: 'Group name for Demo team', exact: true }).press('Tab');
  await page.screenshot({ path: 'test-results/people-review-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Open People library', exact: true }).click();
  await expect(page.locator('input[value="Imported colleague"]')).toBeVisible();
  expect(JSON.parse((await page.evaluate(k => localStorage.getItem(k), key))!).people).toEqual(JSON.parse(before!).people);
  await page.getByRole('button', { name: 'Everyone out', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to game setup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your people library.' })).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button', { name: 'Everyone in', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to game setup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little team spirit.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Friday friends', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Imported colleague now', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/game-setup-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Start new game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  const playing = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(playing.isDemo).toBe(false);
  expect(playing.people).toEqual(JSON.parse(before!).people);
});

test('normal setup starts an empty group and requires real uploads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Use my photos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Childhood vs Now', exact: true }) }).getByRole('button', { name: 'Set up your game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Name this group.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Match people', exact: true })).toBeDisabled();
  const event = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(event.people).toEqual([]);
  expect(event.photoSets[0].nowImageId).toBeUndefined();
  expect(event.photoSets[0].thenImageId).toBeUndefined();
});


test('demo host settings show the prepared roster without reopening photo matching', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Host settings', exact: true }).click();
  await page.getByRole('navigation', { name: 'Activity setup' }).getByRole('button', { name: /People/ }).click();
  await expect(page.getByRole('heading', { name: 'Who’s playing today?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Match people', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open People library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The roster is empty.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toHaveCount(0);
});

test('non-photo activities share demo isolation and Exit demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  const before = await page.evaluate(k => localStorage.getItem(k), key);
  const card = page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Act It Out', exact: true }) });
  await card.getByRole('button', { name: 'Try the demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start the turn', exact: true })).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(before);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start the turn', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The roster is empty.' })).toBeVisible();
});

test('abandoned photo setup stays visibly incomplete and can be resumed or removed', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Use my photos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: 'Childhood vs Now', exact: true }) }).getByRole('button', { name: 'Set up your game', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const group = page.getByRole('region', { name: 'Group 1', exact: true });
  await expect(group.getByText('Incomplete · Add photos', { exact: true })).toBeVisible();
  await group.getByRole('button', { name: 'Resume setup', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Match people', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to the library', exact: true }).click();
  await expect(group).toBeVisible();
  await group.getByRole('button', { name: 'Remove Group 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The roster is empty.' })).toBeVisible();
});
