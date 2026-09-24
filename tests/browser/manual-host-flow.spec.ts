import { test, expect, type Page } from '@playwright/test';
const key = 'fun-friday-studio.session.v1';

async function aioHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fun Friday Studio home' }).click();
  await expect(page.getByRole('heading', { name: 'What are we playing?' })).toBeVisible();
}

async function image(page: Page, w: number, h: number) {
  return Buffer.from(await page.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#e7d9bd'; ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL('image/jpeg', .9).split(',')[1];
  }, { w, h }), 'base64');
}

test('manual host flow: add a group and a person, play, reveal all slides', async ({ page }) => {
  test.setTimeout(180_000);
  await aioHome(page);
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const initialPlayers = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).people.filter((p: any) => p.included).length, key);
  const firstPairNumber = await page.evaluate(k => Math.max(0, ...JSON.parse(localStorage.getItem(k)!).facePairs.map((p: any) => p.number)) + 1, key);
  await page.getByRole('button', { name: 'Add a group' }).click();
  await page.getByLabel('Group name').fill('Design offsite');
  await page.getByRole('button', { name: 'Continue' }).click();
  const now = await image(page, 900, 600), then = await image(page, 900, 600);
  await page.getByLabel('Original group photo (now)', { exact: true }).setInputFiles({ name: 'now.jpg', mimeType: 'image/jpeg', buffer: now });
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('Childhood group photo (then)', { exact: true }).setInputFiles({ name: 'then.jpg', mimeType: 'image/jpeg', buffer: then });
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Match people', exact: true }).click();

  const faceNumbers: Array<[string, number[]]> = [
    ['Original photo face editor', [firstPairNumber, firstPairNumber + 1]],
    ['Childhood photo face editor', [firstPairNumber + 2, firstPairNumber + 3]],
  ];
  for (const [label, numbers] of faceNumbers) {
    const box = await page.getByRole('group', { name: label }).boundingBox();
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Add face', exact: true }).click();
      const left = i === 0 ? .13 : .62;
      await page.mouse.move(box!.x + box!.width * left, box!.y + box!.height * .25);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width * (left + .15), box!.y + box!.height * .53, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByRole('button', { name: `${label.startsWith('Original') ? 'now' : 'then'} face ${numbers[i]}`, exact: true })).toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Pair faces', exact: true }).click();
  for (const [a, b] of [[firstPairNumber, firstPairNumber + 2], [firstPairNumber + 1, firstPairNumber + 3]]) {
    await page.getByRole('button', { name: `now face ${a}`, exact: true }).click();
    await page.getByRole('button', { name: `then face ${b}`, exact: true }).click();
  }
  await expect(page.locator('.match-summary')).toContainText('2 pairs');
  await page.getByRole('button', { name: 'Name people', exact: true }).click();
  await page.getByRole('textbox', { name: `Name for person ${firstPairNumber}`, exact: true }).fill('Priya');
  await page.getByRole('textbox', { name: `Name for person ${firstPairNumber + 1}`, exact: true }).fill('Noah');
  await page.getByRole('button', { name: 'Back to the library', exact: true }).click();
  const group = page.getByRole('region', { name: 'Design offsite' });
  await expect(group.getByRole('checkbox', { name: 'Include Priya' })).not.toBeChecked();
  await group.getByRole('checkbox', { name: 'Include Priya' }).check();
  await group.getByRole('checkbox', { name: 'Include Noah' }).check();

  await page.getByRole('button', { name: 'Add a person' }).click();
  await page.getByLabel('Person name').fill('Aarav');
  await page.getByLabel('Childhood photo').setInputFiles({ name: 'aarav-then.jpg', mimeType: 'image/jpeg', buffer: await image(page, 500, 700) });
  await page.getByLabel('Current photo').setInputFiles({ name: 'aarav-now.jpg', mimeType: 'image/jpeg', buffer: await image(page, 600, 800) });
  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Aarav added.', { timeout: 60_000 });

  const session = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  const playerCount = session.people.filter((p: any) => p.included).length;
  expect(playerCount).toBe(initialPlayers + 3);
  await page.getByRole('button', { name: 'Activity library', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
  await page.getByRole('button', { name: 'Start new game' }).click();
  for (let i = 0; i < playerCount; i++) {
    await page.getByRole('button', { name: /Reveal the grown-up/ }).click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /^(Next (?!photo)|Final results)/ }).click();
  }
  await page.getByRole('button', { name: 'The whole team reveal' }).click();
  await expect(page.getByText(/Demo team \(1 of 3\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Next reveal photo' }).click();
  await expect(page.getByText(/Design offsite \(2 of 3\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Next reveal photo' }).click();
  await expect(page.getByRole('heading', { name: 'Also in the game' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Aarav as a child' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Aarav now' })).toBeVisible();
});
