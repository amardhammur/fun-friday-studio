import { test, expect, type Page } from '@playwright/test';
import { openWelcome, startDemo } from './helpers';

const demoKey = 'fun-friday-studio.demo.v1';

// The show-mode type floor raises small text to 18/20px. It must never shrink display text: the
// Act It Out prompt, the turn timer and the scores are the whole point of the projected stage.
// This switches the floor rules off in the CSSOM, measures every element, switches them back on,
// and returns the elements the floor made smaller.
async function shrunkByFloor(page: Page) {
  return page.evaluate(() => {
    const floorRules: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList) => { for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.selectorText.includes('[data-mode="show"]') && /max\(var\(--show-floor/.test(rule.style.cssText)) floorRules.push(rule);
      if ('cssRules' in rule && !(rule instanceof CSSStyleRule)) walk((rule as CSSGroupingRule).cssRules);
    } };
    for (const sheet of document.styleSheets) walk(sheet.cssRules);
    const elements = [...document.querySelectorAll<HTMLElement>('.app *')].filter(el => el.offsetParent && el.textContent?.trim());
    const floored = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    const saved = floorRules.map(rule => rule.style.cssText);
    floorRules.forEach(rule => { rule.style.cssText = ''; });
    const natural = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    floorRules.forEach((rule, i) => { rule.style.cssText = saved[i]; });
    if (!floorRules.length) return ['no floor rules found'];
    return elements.flatMap((el, i) => floored[i] < natural[i] - .5 ? [`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent!.trim().slice(0, 24)}" ${natural[i]}px -> ${floored[i]}px`] : []);
  });
}
// Nothing the room can read may sit below 18px at 1920×1080. Only elements that hold text themselves count.
async function belowFloor(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.app *')]
    .filter(el => el.offsetParent && [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()) && !el.closest('.visually-hidden'))
    .flatMap(el => { const size = parseFloat(getComputedStyle(el).fontSize); return size < 17.5 ? [`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent!.trim().slice(0, 24)}" ${size}px`] : []; }));
}

for (const theme of ['afterhours', 'ink']) test(`the show-mode type floor lifts small text and never shrinks stage text (${theme})`, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(t => { if (t === 'afterhours') localStorage.removeItem('studio-theme'); else localStorage.setItem('studio-theme', t); }, theme);
  const shrunk: string[] = [], small: string[] = [];
  const check = async (screen: string) => {
    await expect(page.locator('.app')).toHaveAttribute('data-mode', 'show');
    shrunk.push(...(await shrunkByFloor(page)).map(s => `${screen}: ${s}`));
    small.push(...(await belowFloor(page)).map(s => `${screen}: ${s}`));
  };

  await openWelcome(page);
  await startDemo(page);
  await check('cvn question');
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();
  await check('cvn revealed');

  await page.locator('.host-key-rail').getByRole('button', { name: 'Exit demo' }).click();
  await startDemo(page, 'Act It Out');
  await check('aio ready');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();
  await check('aio acting');
  await page.getByRole('button', { name: 'End turn' }).click();
  await check('aio turn summary');
  await page.evaluate(key => {
    const doc = JSON.parse(localStorage.getItem(key)!), game = doc.segments[0].game;
    game.turns.forEach((turn: { status: string }) => { turn.status = 'done'; }); game.currentTurnIndex = game.turns.length - 1;
    doc.wager = { question: 'How many mugs live in the office kitchen?', answer: '42', bets: {} };
    localStorage.setItem(key, JSON.stringify(doc));
  }, demoKey);
  await page.reload();
  await page.getByRole('button', { name: 'Activity results' }).click();
  await check('activity finale');
  await page.getByRole('button', { name: 'View overall standings' }).click();
  await check('standings');
  await page.getByRole('button', { name: 'Continue to final wager' }).click();
  await check('wager bets');
  for (const input of await page.getByLabel(/^Wager for/).all()) await input.fill('1');
  await page.getByRole('button', { name: 'Reveal the question' }).click();
  await page.getByRole('button', { name: 'Reveal the answer' }).click();
  await check('wager answer');
  for (const button of await page.locator('.wager-bet').getByRole('button', { name: /^\+/ }).all()) await button.click();
  await page.getByRole('button', { name: 'The final results' }).click();
  await check('event finale');

  expect(shrunk).toEqual([]);
  expect(small).toEqual([]);
});

test('Ink: marking a photo correct lands the "+N CORRECT" stamp, and M changes it to missed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('studio-theme', 'ink'));
  await openWelcome(page);
  await startDemo(page);
  await page.keyboard.press('Enter');
  const stamp = page.locator('.correct-stamp');
  await expect(stamp).toHaveCount(0);
  await page.keyboard.press('c');
  await expect(stamp).toBeVisible();
  const team = (await page.locator('.active-team strong').textContent())!;
  await expect(stamp).toHaveText(`+2CORRECT${team}`);
  expect(await stamp.evaluate(el => { const s = getComputedStyle(el); return [s.animationName, s.animationDuration, s.animationTimingFunction]; })).toEqual(['ink-stamp', '0.18s', 'ease-out']);

  await page.keyboard.press('m');
  await expect(stamp).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), demoKey);
  expect(saved.segments[0].game.rounds[0].result).toBe('missed');
  await page.keyboard.press('c');
  await expect(stamp).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await stamp.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('the correct stamp is Ink-only: other themes render it hidden', async ({ page }) => {
  await openWelcome(page);
  await startDemo(page);
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();
  await expect(page.locator('.correct-stamp')).toHaveCount(1);
  await expect(page.locator('.correct-stamp')).toBeHidden();
});
