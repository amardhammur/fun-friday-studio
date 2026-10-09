import { test, expect, type Page } from '@playwright/test';
import { openWelcome, startDemo, resumeEvent, personalKey } from './helpers';
import { products } from '../../activities/product-in-disguise/content';
const demoKey = 'fun-friday-studio.demo.v1';
const saveLabel = 'Save scores & see results';

async function drawProduct(page: Page) {
  await page.getByRole('button', { name: 'Spin the wheel', exact: true }).click();
  await expect(page.locator('.cc-product-reveal')).toBeVisible();
  const product = await page.locator('.cc-product-reveal h1').innerText();
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  return product;
}
async function performAll(page: Page, count: number) {
  await page.getByRole('button', { name: 'Start first ad', exact: true }).click();
  for (let i = 0; i < count; i++) await page.getByRole('button', { name: i === count - 1 ? 'Enter judge scores' : 'Next team', exact: true }).click();
}
async function enterScores(page: Page, key: string) {
  const teams = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).teams, key);
  for (let i = 0; i < teams.length; i++) await page.getByRole('spinbutton', { name: `Score for ${teams[i].name}`, exact: true }).fill(String(i === 0 ? 20 : i === 1 ? 15 : 0));
  return teams;
}

for (const theme of ['afterhours', 'gameshow', 'ink']) test(`performance and host-entered offline judge scores (${theme})`, async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('studio-theme', t), theme);
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  const product = await drawProduct(page);
  await expect(page.getByRole('heading', { name: 'Make your ad.', exact: true })).toBeVisible();
  await expect(page.locator('.cc-stage')).toContainText(product);
  await page.screenshot({ path: `test-results/cc-${theme}-prepare.png` });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await performAll(page, 3);
  await expect(page.getByRole('heading', { name: 'Judge scores.', exact: true })).toBeVisible();
  await expect(page.locator('.cc-stage select')).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeDisabled();
  const teams = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).teams, demoKey);
  await page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true }).fill('20');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true })).toHaveValue('20');
  await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeDisabled();
  await enterScores(page, demoKey);
  const last = page.getByRole('spinbutton', { name: `Score for ${teams[2].name}`, exact: true });
  await last.fill('-1');
  await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeDisabled();
  await last.fill('0');
  await page.screenshot({ path: `test-results/cc-${theme}-judging.png` });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).scoreEntries.length, demoKey)).toBe(0);
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s a wrap!', exact: true })).toBeVisible();
  await expect(page.locator('.cc-champion')).toContainText(teams[0].name);
  await page.reload();
  await expect(page.locator('.cc-results')).toContainText('20 pts');
  await page.screenshot({ path: `test-results/cc-${theme}-results.png` });
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  await page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true }).fill('11');
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.locator('.cc-champion')).toContainText(teams[1].name);
  const event = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), demoKey);
  expect(event.scoreEntries.filter((e: any) => e.active)).toHaveLength(3);
  expect(event.scoreEntries.find((e: any) => e.teamId === teams[0].id).points).toBe(11);
});

test('resumes a version-one game with its old award keys and upgrades on Start over', async ({ page }) => {
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await page.evaluate(({ key, products }) => {
    const event = JSON.parse(localStorage.getItem(key)!);
    const segment = event.segments[0]; segment.activityVersion = 1;
    segment.settings = { preparationMinutes: 10, performanceSeconds: 75, guessSeconds: 45, briefsShared: true };
    segment.game = { rounds: event.teams.map((t: any, i: number) => ({ id: `commercial-${t.id}`, teamId: t.id, product: products[i], cluesConfirmed: true, guessesLocked: true, revealed: i === 0, results: Object.fromEntries(event.teams.filter((other: any) => other.id !== t.id).map((other: any) => [other.id, null])) })), index: 0, step: 'reveal', timer: { durationMs: 45000, pausedRemainingMs: 0 } };
    localStorage.setItem(key, JSON.stringify(event));
  }, { key: demoKey, products });
  await page.reload();
  await expect(page.locator('.pid-product-reveal')).toContainText('Stapler');
  await page.keyboard.press('2');
  await expect(page.locator('.pid-awards [aria-pressed="true"]')).toHaveCount(1);
  await page.keyboard.press('m'); await page.keyboard.press('n');
  await expect(page.getByRole('heading', { name: 'Your commercial starts now.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Commercial Clash.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await drawProduct(page);
  await expect(page.getByRole('heading', { name: 'Make your ad.', exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).scoreEntries.length, demoKey)).toBe(0);
});

test('host score corrections carry into real event standings', async ({ page }) => {
  await openWelcome(page);
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('button', { name: 'Commercial Clash', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Commercial Clash.', exact: true })).toBeVisible();
  await expect(page.getByLabel('Product', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  const product = await drawProduct(page);
  await expect(page.locator('.cc-product')).toContainText(product);
  await performAll(page, 5);
  const teams = await enterScores(page, personalKey);
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  await page.getByRole('spinbutton', { name: `Score for ${teams[0].name}`, exact: true }).fill('40');
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  const scored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  expect(scored.scoreEntries).toHaveLength(5);
  expect(scored.scoreEntries.find((e: any) => e.teamId === teams[0].id).points).toBe(40);
  await page.getByRole('button', { name: 'View overall standings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every activity complete.', exact: true })).toBeVisible();
  await expect(page.locator('.interstitial-board')).toContainText('40');
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!);
    event.segments[0].status = 'done';
    const next = structuredClone(event.segments[0]); next.id = crypto.randomUUID(); next.status = 'setup';
    next.game = { mode: 'commercial-clash', teamIds: [], performanceIndex: 0, performedCount: 0, step: 'wheel', scores: {}, timer: { durationMs: 720000 } };
    event.segments.push(next); event.currentSegmentIndex = 1; event.phase = 'segment';
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload(); await resumeEvent(page);
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
});

test('projector controls and judge score fields fit at 720p and 1080p', async ({ page }) => {
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    for (const step of ['wheel', 'product', 'prepare', 'perform', 'judging']) {
      if (step === 'product') { await page.keyboard.press('s'); await expect(page.locator('.cc-product-reveal')).toBeVisible(); }
      if (step === 'prepare') await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
      if (step === 'perform') await page.getByRole('button', { name: 'Start first ad', exact: true }).click();
      if (step === 'judging') for (let i = 0; i < 3; i++) await page.keyboard.press('n');
      const position = await page.locator('.cc-actions .primary').evaluate(el => {
        const r = el.getBoundingClientRect(), cover = document.elementFromPoint(r.x + r.width / 2, r.bottom - 2);
        return { visible: el.contains(cover), bottom: r.bottom, height: innerHeight };
      });
      expect(position.visible, `${viewport.width}px ${step}: ${JSON.stringify(position)}`).toBe(true);
      const dimensions = await page.locator('.cc-scene').evaluate(el => ({ content: el.scrollHeight, available: el.clientHeight }));
      expect(dimensions.content, `${viewport.width}px ${step}`).toBeLessThanOrEqual(dimensions.available + 1);
    }
    await page.screenshot({ path: `test-results/cc-projector-${viewport.width}-judging.png` });
    await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
    await startDemo(page, 'Commercial Clash');
  }
});

test('resumes saved results after pausing without reentering judge scores', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await drawProduct(page); await performAll(page, 3); await enterScores(page, demoKey);
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).scoreEntries, demoKey);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s a wrap!', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'That’s a wrap!', exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).scoreEntries, demoKey)).toEqual(saved);
  await page.getByRole('button', { name: 'View overall standings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every activity complete.', exact: true })).toBeVisible();
});

test('judge score entry stays usable on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await drawProduct(page); await performAll(page, 3);
  await enterScores(page, demoKey);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/cc-mobile-judging.png', fullPage: true });
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s a wrap!', exact: true })).toBeVisible();
});
