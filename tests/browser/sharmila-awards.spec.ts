import { expect, test, type Page } from '@playwright/test';
import { openWelcome, personalKey, resumeEvent } from './helpers';

async function setup(page: Page) {
  await openWelcome(page);
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('button', { name: 'Sharmila Awards', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wrong answers. Full confidence.', exact: true })).toBeVisible();
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!);
    event.teams = event.teams.slice(0, 2); event.correctPoints = 7; event.segments[0].weight = 3;
    event.segments.push({ id: 'other-segment', activityId: 'act-it-out', activityVersion: 2, title: 'Act It Out', status: 'pending', setupStepId: 'game', weight: 1, settings: { rule: 'act', categories: [], turnSeconds: 90, roundsPerTeam: 1 }, game: { deck: [], cursor: 0, turns: [], currentTurnIndex: 0, timer: { durationMs: 90_000 } } });
    event.scoreEntries = [{ id: 'other-score', segmentId: 'other-segment', teamId: event.teams[0].id, kind: 'manual-adjustment', points: 7, active: true }];
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload(); await resumeEvent(page);
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
const spin = (page: Page) => page.getByRole('button', { name: 'Spin', exact: true }).click();
const pointsGroup = (page: Page) => page.getByRole('group', { name: 'Points total', exact: true });
const pointLabel = (points: 0 | 1) => points === 1 ? 'Thumbs up: 1 point' : 'Thumbs down: 0 points';
const pointChoice = (page: Page, points: 0 | 1) => pointsGroup(page).getByRole('button', { name: pointLabel(points), exact: true });
const correctionChoice = (page: Page, team: string, points: 0 | 1) => page.getByRole('group', { name: `Points for ${team} · Round 1`, exact: true }).getByRole('button', { name: pointLabel(points), exact: true });
const next = (page: Page) => page.getByRole('button', { name: 'Save & Next team', exact: true });
async function saveTurn(page: Page, points: 0 | 1) {
  await spin(page); await pointChoice(page, points).click(); await next(page).click();
}

test('one round uses unique questions; zero, corrections, refresh and offline recovery award points once', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await expect(page.locator('.sa-turn-header h2')).toHaveText('Earth');
  await expect(page.locator('.sa-turn-header')).toContainText('Round 1 of 1');
  await expect(page.getByRole('img', { name: 'Question wheel', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await spin(page);
  await expect(next(page)).toBeDisabled();
  await expect(page.locator('.sa-stage input')).toHaveCount(0);
  await expect(pointsGroup(page).getByRole('button', { pressed: true })).toHaveCount(0);
  await pointChoice(page, 1).click(); await pointChoice(page, 1).click();
  expect((await saved(page)).scoreEntries).toHaveLength(1); // Only the other activity's score exists until Save.
  const drawn = (await saved(page)).segments[0].game.turns[0].draw;
  await page.reload();
  await expect(pointChoice(page, 1)).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).segments[0].game.turns[0].draw).toEqual(drawn);
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toHaveCount(0);
  // Two synchronous clicks exercise a stale handler after the first save advances the turn.
  await next(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.locator('.sa-turn-header h2')).toHaveText('Water');
  let event = await saved(page), id = event.segments[0].id;
  expect(event.scoreEntries.filter((e: any) => e.segmentId === id)).toHaveLength(1);
  expect(event.scoreEntries.find((e: any) => e.segmentId === id).points).toBe(3);
  await spin(page); await pointChoice(page, 0).click();
  await page.locator('.sa-saved-results summary').click();
  await correctionChoice(page, 'Earth', 0).click();
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save correction', exact: true })).toBeDisabled();
  await expect(pointChoice(page, 0)).toHaveAttribute('aria-pressed', 'true');
  event = await saved(page);
  expect(event.scoreEntries.filter((e: any) => e.segmentId === id)).toHaveLength(1);
  expect(event.scoreEntries.find((e: any) => e.segmentId === id).points).toBe(0);
  await correctionChoice(page, 'Earth', 1).click();
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.locator('.offline-status')).toHaveText('Offline ready');
  await page.context().setOffline(true); await page.reload();
  await expect(pointChoice(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Final team standings', exact: true })).toBeVisible();
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('Earth');
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('3 pts');
  await expect(page.locator('.sa-standings li').nth(1)).toContainText('0 pts');
  event = await saved(page);
  expect(event.segments[0].game.turns.map((t: any) => t.points)).toEqual([1, 0]);
  expect(new Set(event.segments[0].game.turns.map((t: any) => t.draw.questionId)).size).toBe(2);
  expect(event.scoreEntries.filter((e: any) => e.segmentId === id)).toHaveLength(2);
  expect(event.scoreEntries.find((e: any) => e.id === 'other-score').points).toBe(7);
  await page.reload();
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('3 pts');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.reload(); await resumeEvent(page);
  await page.getByRole('button', { name: 'Resume activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Final team standings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View overall standings', exact: true })).toBeVisible();
  expect((await saved(page)).segments[0].status).toBe('finale');
  await page.locator('.sa-saved-results summary').click();
  await correctionChoice(page, 'Earth', 0).click();
  await page.locator('.sa-correction').first().getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('0 pts');
  expect((await saved(page)).scoreEntries.filter((e: any) => e.segmentId === id)).toHaveLength(2);
  await page.screenshot({ path: 'test-results/sharmila-finale.png', fullPage: true });
  await page.getByRole('button', { name: 'View overall standings', exact: true }).click();
  await expect(page.locator('.interstitial')).toContainText('Sharmila Awards');
  await expect(page.locator('.interstitial-row').first().locator('.interstitial-total')).toHaveText('7');
  await page.context().setOffline(false);
});

test('ZIP restores a drawn question and draft, final corrections survive export, and restart is activity-scoped', async ({ page }, testInfo) => {
  await setup(page); await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await saveTurn(page, 1); await spin(page); await pointChoice(page, 0).click();
  const before = await saved(page);
  const downloadZip = async (name: string) => {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export event', exact: true }).last().click();
    const zip = testInfo.outputPath(name); await (await downloading).saveAs(zip); return zip;
  };
  const midway = await downloadZip('awards-midway.zip');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  let event = await saved(page);
  expect(event.segments[0].game.turns).toEqual([]);
  expect(event.scoreEntries.map((e: any) => e.id)).toEqual(['other-score']);
  await page.getByLabel('Choose session ZIP', { exact: true }).setInputFiles(midway);
  await expect(pointChoice(page, 0)).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).segments[0].game).toEqual(before.segments[0].game);
  await next(page).click();
  await page.locator('.sa-saved-results summary').click();
  await correctionChoice(page, 'Earth', 0).click();
  await page.locator('.sa-correction').first().getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.locator('.sa-winners')).toContainText('Earth & Water · 0 points each · shared win');
  const final = await downloadZip('awards-final.zip');
  event = await saved(page);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restart awards', exact: true }).click();
  const restarted = await saved(page);
  expect(restarted.scoreEntries.map((e: any) => e.id)).toEqual(['other-score']);
  expect(restarted.teams).toEqual(event.teams);
  expect(restarted.segments[1]).toEqual(event.segments[1]);
  expect(restarted.segments[0].settings).toEqual(event.segments[0].settings);
  await page.getByLabel('Choose session ZIP', { exact: true }).setInputFiles(final);
  await expect(page.getByRole('heading', { name: 'Final team standings', exact: true })).toBeVisible();
  expect((await saved(page)).segments[0].game).toEqual(event.segments[0].game);
  expect((await saved(page)).scoreEntries).toEqual(event.scoreEntries);
});

test('editable question list supports Telugu, skips duplicates, and blocks too few unique questions', async ({ page }) => {
  await setup(page); await page.locator('.sa-question-list summary').click();
  const questions = page.getByLabel('Questions (one per line)', { exact: true });
  await expect(questions).toContainText('What is Java?');
  await questions.fill('What is Java?\nWHAT IS JAVA?\n\nWhat is Java?');
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('at least 2 unique questions');
  await questions.fill('What is Java?\nవిద్యుత్ అంటే ఏమిటి?');
  await page.reload(); await resumeEvent(page);
  await page.locator('.sa-question-list summary').click();
  await expect(questions).toHaveValue('What is Java?\nవిద్యుత్ అంటే ఏమిటి?');
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await page.evaluate(() => { Math.random = () => 0; });
  await saveTurn(page, 0); await spin(page);
  await expect(page.locator('.sa-answer h1')).toHaveText('విద్యుత్ అంటే ఏమిటి?');
  await expect(page.locator('.sa-wheel-area')).toContainText('0 questions remaining');
  await pointChoice(page, 0).click(); await next(page).click();
  await expect(page.locator('.sa-winners')).toContainText('shared win');
});

test('refreshing an older save removes the unstarted second round and keeps the current question, draft, and scores', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await saveTurn(page, 1); await spin(page); await pointChoice(page, 1).click();
  const before = await saved(page);
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!), segment = event.segments[0];
    segment.activityVersion = 1;
    segment.game.turns.push(...event.teams.map((team: any) => ({ id: `2:${team.id}`, teamId: team.id, round: 2 })));
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload();
  await expect(pointChoice(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sa-turn-header')).toContainText('Round 1 of 1');
  const recovered = await saved(page);
  expect(recovered.segments[0].activityVersion).toBe(2);
  expect(recovered.segments[0].game).toEqual(before.segments[0].game);
  expect(recovered.scoreEntries).toEqual(before.scoreEntries);
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Final team standings', exact: true })).toBeVisible();
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('3 pts');
  await expect(page.locator('.sa-standings li').nth(1)).toContainText('3 pts');
});

test('older numeric scores stay intact, while new selections and corrections use only thumbs up or down', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await saveTurn(page, 1); await spin(page);
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!), segment = event.segments[0];
    segment.game.turns[0].points = 4;
    segment.game.turns[1].pointsDraft = '3';
    event.scoreEntries.find((entry: any) => entry.segmentId === segment.id).points = 12;
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload();
  await expect(page.locator('.sa-stage input')).toHaveCount(0);
  await expect(pointsGroup(page).getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(next(page)).toBeDisabled();
  let event = await saved(page), id = event.segments[0].id;
  expect(event.scoreEntries.find((entry: any) => entry.segmentId === id).points).toBe(12);
  await page.locator('.sa-saved-results summary').click();
  await expect(page.locator('.sa-correction h3')).toContainText('4 base points');
  await correctionChoice(page, 'Earth', 1).click();
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(next(page)).toBeDisabled();
  await pointChoice(page, 0).click(); await next(page).click();
  await expect(page.locator('.sa-standings li').nth(0)).toContainText('3 pts');
  event = await saved(page);
  expect(event.segments[0].game.turns.map((turn: any) => turn.points)).toEqual([1, 0]);
  expect(event.scoreEntries.filter((entry: any) => entry.segmentId === id)).toHaveLength(2);
});

for (const theme of ['afterhours', 'gameshow', 'ink']) test(`wheel, question, and score form fit desktop and mobile (${theme})`, async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('studio-theme', t), theme);
  await setup(page);
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeInViewport();
  await expect(page.getByRole('img', { name: 'Question wheel', exact: true })).toBeInViewport();
  await spin(page);
  await expect(pointChoice(page, 1)).toBeInViewport();
  await expect(pointChoice(page, 0)).toBeInViewport();
  await expect(next(page)).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('img', { name: 'Question wheel', exact: true }).evaluate(el => el.getAnimations().length)).toBe(0);
  await page.screenshot({ path: `test-results/sharmila-stage-${theme}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pointChoice(page, 0)).toBeVisible();
  await pointChoice(page, 0).click(); await next(page).click();
  await expect(page.locator('.sa-turn-header h2')).toHaveText('Water');
  await expect(page.locator('.sa-turn-header h2')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => {
    const brand = document.querySelector('.show-masthead-brand')!.getBoundingClientRect(), activity = document.querySelector('.show-masthead-activity')!.getBoundingClientRect();
    return brand.bottom <= activity.top;
  })).toBe(true);
  await page.screenshot({ path: `test-results/sharmila-mobile-${theme}.png`, fullPage: true });
});
