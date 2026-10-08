import { test, expect } from '@playwright/test';
import { openWelcome, startDemo } from './helpers';
const demoKey = 'fun-friday-studio.demo.v1';

test('audience spin survives reload and preparation waits for the host', async ({ page }) => {
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await expect(page.getByRole('heading', { name: 'Pick your product.', exact: true })).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.cc-wheel-pointer')).toHaveCSS('border-top-style', 'solid');
  await page.screenshot({ path: 'test-results/cc-live-wheel.png' });
  await page.getByRole('button', { name: 'Spin the wheel', exact: true }).click();
  const drawn = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].game, demoKey);
  await expect(page.getByRole('button', { name: 'Spinning…', exact: true })).toBeDisabled();
  const animationDelay = await page.locator('.cc-wheel-svg').evaluate(el => getComputedStyle(el).animationDelay);
  await page.keyboard.press('s'); await page.keyboard.press('n');
  expect(await page.locator('.cc-wheel-svg').evaluate(el => getComputedStyle(el).animationDelay)).toBe(animationDelay);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].game.product, demoKey)).toEqual(drawn.product);
  await expect(page.getByRole('button', { name: 'Start preparation', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.cc-product-reveal')).toContainText(drawn.product.name);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).segments[0].game.product, demoKey)).toEqual(drawn.product);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/cc-live-product.png' });
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make your ad.', exact: true })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Preparation timer' })).toBeVisible();
});

test('reduced motion uses the same draw without a long spinning animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await page.keyboard.press('s');
  await expect(page.locator('.cc-product-reveal')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'Start preparation', exact: true })).toBeEnabled();
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('host can reject a product and respin before starting preparation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { Math.random = () => 0; });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await page.getByRole('button', { name: 'Spin the wheel', exact: true }).click();
  await expect(page.locator('.cc-product-reveal h1')).toHaveText('Stapler');
  await page.getByRole('button', { name: 'Spin again', exact: true }).click();
  await expect(page.locator('.cc-product-reveal h1')).toHaveText('Umbrella');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.cc-product-reveal h1')).toHaveText('Umbrella');
  await page.keyboard.press('s');
  await expect(page.locator('.cc-product-reveal h1')).toHaveText('Stapler');
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spin again', exact: true })).toHaveCount(0);
  await page.keyboard.press('s');
  await expect(page.locator('.cc-product')).toContainText('Stapler');
  await expect(page.getByRole('timer', { name: 'Preparation timer' })).toBeVisible();
});

test('wheel and product reveal remain usable on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await expect(page.getByRole('heading', { name: 'Pick your product.', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/cc-mobile-wheel.png', fullPage: true });
  await page.getByRole('button', { name: 'Spin the wheel', exact: true }).click();
  await expect(page.locator('.cc-product-reveal')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make your ad.', exact: true })).toBeVisible();
});

test('host controls remain reachable by scrolling on a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await openWelcome(page); await startDemo(page, 'Commercial Clash');
  await page.mouse.move(200, 400); await page.mouse.wheel(0, 900);
  await expect.poll(() => page.getByRole('button', { name: 'Pause', exact: true }).evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.bottom <= innerHeight;
  })).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume activity', exact: true })).toBeVisible();
});
