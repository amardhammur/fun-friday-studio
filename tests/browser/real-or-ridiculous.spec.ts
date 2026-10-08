import { test, expect, type Page } from '@playwright/test';
import { openWelcome, startDemo } from './helpers';
const demoKey = 'fun-friday-studio.demo.v1';
async function actionIsVisible(page: Page) {
  expect(await page.locator('.rr-actions button').evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 2));
  })).toBe(true);
}
for (const theme of ['afterhours', 'gameshow', 'ink']) test(`investigate, vote, switch and score (${theme})`, async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('studio-theme', t), theme);
  await openWelcome(page); await startDemo(page, 'Real or Ridiculous?');
  await expect(page.locator('.rr-brief')).toBeVisible();
  await actionIsVisible(page);
  await page.keyboard.press('r'); await expect(page.locator('.rr-brief')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.locator('.rr-card')).toHaveCount(3);
  await expect(page.locator('.rr-card').nth(0)).toContainText('The Tiny Cleaner');
  await expect(page.locator('.rr-card').nth(1)).toContainText('The Compliment Mug');
  await expect(page.locator('.rr-card').nth(2)).toContainText('The Designer Stick');
  await expect(page.locator('.rr-evidence')).toHaveCount(0);
  await expect(page.locator('.rr-clue')).toHaveCount(0);
  await page.screenshot({ path: `test-results/rr-${theme}-pitch.png` });
  await page.keyboard.press('r'); await expect(page.locator('.rr-evidence')).toHaveCount(0);
  await page.keyboard.press('n'); await expect(page.locator('.rr-step')).toContainText('FIRST VOTE');
  await page.keyboard.press('h'); await expect(page.locator('.rr-clue')).toContainText('sinking in water');
  await page.screenshot({ path: `test-results/rr-${theme}-clue.png` });
  expect(await page.locator('.rr-scene').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: 'Start the timer', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.rr-clue')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start the timer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /Resume/ }).click();
  await expect(page.locator('.rr-clue')).toBeVisible();
  await page.keyboard.press('n'); await expect(page.locator('.rr-step')).toContainText('FINAL VOTE');
  await page.keyboard.press('r');
  await expect(page.locator('.rr-question')).toContainText('B · The Compliment Mug is our fiction.');
  await expect(page.locator('.rr-evidence a')).toHaveCount(2);
  await page.keyboard.press('1'); await page.keyboard.press('2'); await page.keyboard.press('1');
  await expect(page.locator('.rr-awards [aria-pressed="true"]')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.rr-awards [aria-pressed="true"]')).toHaveCount(1);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport); await actionIsVisible(page);
    expect(await page.locator('.rr-scene').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.screenshot({ path: `test-results/rr-${theme}-${viewport.width}-reveal.png` });
  }
  await page.keyboard.press('n');
  for (let i = 1; i < 6; i++) {
    await page.getByRole('button', { name: 'Call first vote N' }).click();
    await page.getByRole('button', { name: 'One more clue H' }).click();
    await page.getByRole('button', { name: 'Call final vote N' }).click();
    await page.getByRole('button', { name: 'Reveal the truth R' }).click();
    await page.keyboard.press('n');
  }
  await expect(page.getByRole('heading', { name: 'Reality has range.' })).toBeVisible();
});

test('all 24 pitches fit an eight-team room at 1080p', async ({ page }) => {
  const { default: bank } = await import('../../activities/real-or-ridiculous/inventions.json', { with: { type: 'json' } });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWelcome(page); await startDemo(page, 'Real or Ridiculous?');
  await page.evaluate(({ bank, key }) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    const real = bank.filter(c => c.kind === 'real'), fake = bank.filter(c => c.kind === 'fiction');
    saved.teams = Array.from({ length: 8 }, (_, i) => ({ ...saved.teams[0], id: `team-${i}`, name: `Team ${i + 1}` }));
    saved.segments[0].game.deck = fake.map((f, i) => ({ id: f.id, cards: [real[i * 2], f, real[i * 2 + 1]], clueIndex: 2 }));
    saved.segments[0].settings.rounds = 8;
    localStorage.setItem(key, JSON.stringify(saved));
  }, { bank, key: demoKey });
  await page.reload(); await page.getByRole('button', { name: 'Start first round N' }).click();
  for (let i = 0; i < 8; i++) {
    expect(await page.locator('.rr-scene').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.getByRole('button', { name: 'Call first vote N' }).click();
    await page.getByRole('button', { name: 'One more clue H' }).click();
    expect(await page.locator('.rr-scene').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.getByRole('button', { name: 'Call final vote N' }).click();
    await page.getByRole('button', { name: 'Reveal the truth R' }).click();
    expect(await page.locator('.rr-scene').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.locator('.scoreboard').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await actionIsVisible(page); await page.keyboard.press('n');
  }
});

test('creates a personal game and waits for the host when the timer expires', async ({ page }) => {
  await openWelcome(page);
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wait, Why?', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Real or Ridiculous?', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await page.getByLabel('Number of rounds').selectOption('5');
  await page.getByLabel('Discussion seconds').selectOption('40');
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await page.getByRole('button', { name: 'Start first round N' }).click();
  await page.evaluate(() => {
    const key = 'fun-friday-studio.session.v1', saved = JSON.parse(localStorage.getItem(key)!);
    saved.segments[0].game.timer.deadlineAt = Date.now() - 1000;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('timer')).toContainText('00:00');
  await expect(page.locator('.rr-cue')).toContainText('Time!');
  await expect(page.locator('.rr-evidence')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Call first vote N' })).toBeVisible();
});
