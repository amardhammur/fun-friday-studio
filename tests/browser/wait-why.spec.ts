import { test, expect } from '@playwright/test';
import { openWelcome, startDemo as startCurrentDemo } from './helpers';
import type { Page } from '@playwright/test';
// Old saves remain playable even though the activity is no longer in the library.
async function startDemo(page: Page, _activity: string) {
  const { default: puzzles } = await import('../../activities/wait-why/puzzles.json', { with: { type: 'json' } });
  await startCurrentDemo(page, 'Real or Ridiculous?');
  await page.evaluate(puzzles => {
    const key = 'fun-friday-studio.demo.v1', event = JSON.parse(localStorage.getItem(key)!);
    Object.assign(event.segments[0], { activityId: 'wait-why', activityVersion: 1, title: 'Wait, Why?', settings: { rounds: 8, seconds: 60 }, game: { deck: puzzles.slice(0, 8), index: 0, step: 'rules', timer: { durationMs: 60000 } } });
    localStorage.setItem(key, JSON.stringify(event));
  }, puzzles);
  await page.reload();
  await expect(page.locator('.why-brief')).toBeVisible();
}
for (const theme of ['afterhours', 'ink']) test(`Wait Why host flow and projector layout (${theme})`, async ({ page }) => {
  await page.addInitScript(theme => localStorage.setItem('studio-theme', theme), theme);
  await openWelcome(page); await startDemo(page, 'Wait, Why?');
  await expect(page.getByText('Small puzzles.')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.locator('.why-puzzle h1')).toBeVisible();
  await expect(page.locator('.why-explanation')).toHaveCount(0);
  await page.keyboard.press('n');
  await expect(page.locator('.why-top')).toContainText('ROUND 1 / 8');
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: 'Start the timer', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start the timer', exact: true })).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.locator('.why-explanation')).toBeVisible();
  await expect(page.getByRole('timer')).not.toContainText('00:00');
  await page.keyboard.press('1'); await page.keyboard.press('2');
  await expect(page.locator('.why-awards [aria-pressed="true"]')).toHaveCount(2);
  await page.keyboard.press('1');
  await expect(page.locator('.why-awards [aria-pressed="true"]')).toHaveCount(1);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.why-puzzle h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(27);
    const bounds = await page.locator('.why-actions').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.locator('.why-actions button').evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 2)); })).toBe(true);
    await page.screenshot({ path: `test-results/wait-why-${theme}-${viewport.width}.png`, fullPage: true });
  }
  await page.keyboard.press('n');
  await expect(page.locator('.why-top')).toContainText('ROUND 2 / 8');
  for (let i = 1; i < 8; i++) { await page.keyboard.press('r'); await page.keyboard.press('n'); }
  await expect(page.getByRole('heading', { name: 'Take an “aha!” with you.' })).toBeVisible();
});

test('all starter reveals fit a full room at 1080p', async ({ page }) => {
  const { default: puzzles } = await import('../../activities/wait-why/puzzles.json', { with: { type: 'json' } });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWelcome(page); await startDemo(page, 'Wait, Why?');
  await page.evaluate(puzzles => {
    const key = 'fun-friday-studio.demo.v1', saved = JSON.parse(localStorage.getItem(key)!);
    saved.teams = Array.from({ length: 8 }, (_, i) => ({ ...saved.teams[0], id: `team-${i}`, name: `Team ${i + 1}` }));
    saved.segments[0].game.deck = puzzles;
    localStorage.setItem(key, JSON.stringify(saved));
  }, puzzles);
  await page.reload(); await page.getByRole('button', { name: 'Start first round N' }).click();
  for (let i = 0; i < puzzles.length; i++) {
    await page.getByRole('button', { name: 'Reveal answer R' }).click();
    await expect(page.locator('.why-explanation')).toBeVisible();
    expect(await page.locator('.why-puzzle').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.locator('.scoreboard').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.keyboard.press('n');
  }
});
