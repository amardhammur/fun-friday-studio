// Screenshots the two stage screens (Childhood vs Now revealed, Act It Out acting) at 1920 and 1280.
// Fast on purpose: one demo run per activity, then every theme is a data-attribute switch.
//
//   npm run build && npm run preview -- --port 4173   (in another terminal)
//   node ux-review/capture-stage.ts
//   BASE=http://127.0.0.1:4174/ OUT=/tmp/before THEMES=afterhours,gameshow node ux-review/capture-stage.ts
//
// The clock is frozen so the turn timer reads the same on every run and screenshots can be diffed.
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const OUT = process.env.OUT ?? 'ux-review/ink';
const THEMES = (process.env.THEMES ?? 'ink').split(',');
const SIZES = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }];
const NOW = Date.parse('2026-09-26T10:00:00Z');
const DEMO_KEY = 'fun-friday-studio.demo.v1';
const LONG_TEAMS = ['Deadline Dodgers Extended Remix', 'Merge Conflicts', 'Coffee Achievers', 'The Unmutables', 'Quarterly Legends', 'Ctrl Alt Elite', 'Spreadsheet Wizards of the North', 'Reply All'];
const COLORS = ['#ef5b3a', '#6f8cff', '#d8a640', '#86c29b', '#ef5b3a', '#6f8cff', '#d8a640', '#86c29b'];
mkdirSync(OUT, { recursive: true });

async function startDemo(page: Page, activity: string) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: activity, exact: true }) }).getByRole('button', { name: 'Try the demo', exact: true }).click();
  await page.locator('.stage-layout').waitFor();
}
async function edit(page: Page, change: string) {
  await page.evaluate(([key, body]) => { const doc = JSON.parse(localStorage.getItem(key)!); new Function('doc', body)(doc); localStorage.setItem(key, JSON.stringify(doc)); }, [DEMO_KEY, change] as const);
  await page.reload();
  await page.locator('.stage-layout').waitFor();
}
const eightTeams = `
  const names = ${JSON.stringify(LONG_TEAMS)}, colors = ${JSON.stringify(COLORS)};
  doc.teams[0].name = names[0];
  for (let i = doc.teams.length; i < 8; i++) doc.teams.push({ id: 'extra-' + i, name: names[i], color: colors[i] });
  doc.scoreEntries.push(...doc.teams.map((t, i) => ({ id: 'probe-' + i, teamId: t.id, kind: 'manual-adjustment', points: (i * 7) % 13, active: true })));`;
async function shoot(page: Page, name: string, width: number) {
  for (const theme of THEMES) {
    await page.evaluate(t => { if (t === 'afterhours') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }, theme);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    await page.waitForTimeout(350); // let the stamp animation (180ms) settle
    await page.screenshot({ path: `${OUT}/${name}-${width}--${theme}.png` });
  }
  console.log(`shot ${name}-${width}`);
}

const browser = await chromium.launch();
for (const size of SIZES) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('dialog', d => void d.accept());
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.clock.setFixedTime(NOW);
  // The demo shuffles who appears first; a seeded Math.random deals the same people on every run.
  await context.addInitScript(() => { let s = 42; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });

  await startDemo(page, 'Childhood vs Now');
  await shoot(page, 'cvn-question', size.width);
  await page.getByRole('button', { name: 'Reveal the grown-up' }).click();
  await page.getByRole('button', { name: /^Correct/ }).click();
  await shoot(page, 'cvn-reveal', size.width);
  await edit(page, eightTeams);
  await shoot(page, 'cvn-reveal-8teams', size.width);

  await startDemo(page, 'Act It Out');
  await page.getByLabel('Name of the person guessing').fill('Sam');
  await page.getByRole('button', { name: 'Start the turn' }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();
  await page.getByRole('button', { name: /^Got it/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await shoot(page, 'aio-acting', size.width);
  await edit(page, `doc.segments[0].game.timer = { durationMs: doc.segments[0].game.timer.durationMs, deadlineAt: ${NOW + 8_000} };`);
  await shoot(page, 'aio-urgent', size.width);
  await edit(page, eightTeams);
  await shoot(page, 'aio-urgent-8teams', size.width);
  await context.close();
}
await browser.close();
