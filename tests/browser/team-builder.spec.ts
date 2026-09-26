import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { acceptNextConfirm, openWelcome, personalKey, personalPhotoEvent, startDemo } from './helpers';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
async function prepare(page: Page) {
  await personalPhotoEvent(page);
  await page.getByRole('button', { name: 'Your event', exact: true }).click();
  acceptNextConfirm(page);
  await page.getByRole('button', { name: 'Start a new event', exact: true }).click();
  await page.getByRole('button', { name: 'Childhood vs Now', exact: true }).click();
  await page.getByRole('button', { name: 'Pull from people library', exact: true }).click();
}

test('roster builder: library, paste, four teams, pin and reshuffle persist through reload and ZIP', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  const panel = page.getByRole('region', { name: 'Event teams', exact: true });
  await expect(panel.getByText('From library', { exact: true })).toHaveCount(4);
  await page.getByLabel('Player names', { exact: true }).fill(' Jordan \n\n Riley\n jordan ');
  await page.getByRole('button', { name: 'Add players', exact: true }).click();
  await expect(panel.getByText('6 players', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fewer teams', exact: true }).click();
  await page.getByRole('button', { name: 'More teams', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Team count' })).toHaveText('4 teams');
  const identities = (await saved(page)).teams.map(({ id, name, color }: any) => ({ id, name, color }));
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  await page.getByRole('button', { name: 'Pin Jordan', exact: true }).click();
  const first = await saved(page), pinnedTeam = first.teams.find((t: any) => t.pinnedIds.length);
  await page.getByRole('button', { name: 'Shuffle again', exact: true }).click();
  const shuffled = await saved(page);
  expect(shuffled.teams.find((t: any) => t.id === pinnedTeam.id).pinnedIds).toEqual(pinnedTeam.pinnedIds);
  expect(shuffled.teams.find((t: any) => t.id === pinnedTeam.id).memberIds).toContain(pinnedTeam.pinnedIds[0]);
  expect(shuffled.teams.map(({ id, name, color }: any) => ({ id, name, color }))).toEqual(identities);
  expect(shuffled.teams.map((t: any) => t.memberIds.length).sort()).toEqual([1, 1, 2, 2]);
  await mkdir('ux-review/teams', { recursive: true });
  for (const [theme, next] of [['afterhours', 'Game Show'], ['gameshow', 'Ink & Paper'], ['ink', 'After Hours']]) {
    await page.evaluate(() => document.fonts.ready);
    await panel.screenshot({ path: `ux-review/teams/${theme}-1440.png` });
    const small = await panel.locator('button').evaluateAll(buttons => buttons.filter(b => b.getBoundingClientRect().height < 44).map(b => b.getAttribute('aria-label') || b.textContent));
    expect(small).toEqual([]);
    await page.getByRole('button', { name: `Switch to ${next} theme`, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await page.getByRole('navigation', { name: 'Activity setup' }).getByRole('button', { name: /Game setup/ }).click();
  await expect(page.locator('.event-teams')).toContainText('Jordan');
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  const playing = await saved(page);
  for (const round of playing.segments[0].game.rounds) {
    const team = playing.teams.find((t: any) => t.id === round.teamId);
    const ownPeople = team.memberIds.map((id: string) => playing.players.find((p: any) => p.id === id)?.personId);
    expect(ownPeople).not.toContain(round.personId);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
  const reloaded = await saved(page);
  expect(reloaded.players).toEqual(playing.players); expect(reloaded.teams).toEqual(playing.teams);
  expect(reloaded.segments).toEqual(playing.segments);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export event', exact: true }).click();
  const file = await (await download).path();
  await page.getByLabel('Choose session ZIP', { exact: true }).setInputFiles(file!);
  await expect(page.getByRole('status')).toContainText('Session restored');
  const imported = await saved(page);
  expect(imported.players).toEqual(playing.players); expect(imported.teams).toEqual(playing.teams);
  expect(imported.segments[0].game.rounds).toEqual(playing.segments[0].game.rounds);
  // Active team management changes neither stage nor scores; late arrivals join directly.
  await page.getByRole('button', { name: 'Event overview', exact: true }).click();
  await page.getByRole('button', { name: 'Manage teams', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shuffle again', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove Jordan', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Move Jordan', { exact: true })).toBeDisabled();
  await expect(page.getByText('The roster is locked after an activity starts. Use Import pairs → Replace library to start over.')).toBeVisible();
  await page.getByLabel('Player names', { exact: true }).fill('Late arrival');
  await page.getByLabel('Add to team', { exact: true }).selectOption(imported.teams[0].id);
  await page.getByRole('button', { name: 'Add players', exact: true }).click();
  const late = await saved(page);
  expect(late.teams[0].memberIds).toContain(late.players.find((p: any) => p.name === 'Late arrival').id);
  expect(late.phase).toBe(playing.phase); expect(late.segments).toEqual(imported.segments); expect(late.scoreEntries).toEqual(imported.scoreEntries);
  await page.getByRole('button', { name: 'Return to event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recognise this little legend?' })).toBeVisible();
});

test('roster edits preserve library, blank inputs remain reloadable, and demos isolate players and teams', async ({ page }) => {
  await prepare(page);
  await page.getByLabel('Player names', { exact: true }).fill(' \n ');
  await expect(page.getByRole('button', { name: 'Add players', exact: true })).toBeDisabled();
  const before = await saved(page);
  await page.getByRole('button', { name: 'Remove Asha', exact: true }).click();
  const removed = await saved(page);
  expect(removed.people).toEqual(before.people);
  await page.reload();
  await page.getByRole('button', { name: 'Your event', exact: true }).click();
  await page.getByRole('button', { name: 'Continue planning', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Asha', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pull from people library', exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  const personal = await saved(page);
  await startDemo(page, 'Act It Out');
  const demo = await page.evaluate(() => JSON.parse(localStorage.getItem('fun-friday-studio.demo.v1')!));
  expect(demo.players).toEqual([]);
  expect(demo.teams.map((t: any) => t.id)).not.toEqual(personal.teams.map((t: any) => t.id));
  await page.reload();
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
  expect((await saved(page)).players).toEqual(personal.players);
  expect((await saved(page)).teams).toEqual(personal.teams);
});

test('pins explain impossible balance, team removal confirms, and library edits sync roster links', async ({ page }) => {
  await prepare(page);
  const initial = await saved(page), last = initial.teams[3].id;
  await page.getByLabel('Move Asha', { exact: true }).selectOption(last);
  await page.getByRole('button', { name: 'Pin Asha', exact: true }).press('Enter');
  const pinnedBefore = (await saved(page)).teams;
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Fewer teams', exact: true }).click();
  expect((await saved(page)).teams).toEqual(pinnedBefore);
  await expect(page.getByRole('status', { name: 'Team count' })).toHaveText('4 teams');
  acceptNextConfirm(page);
  await page.getByRole('button', { name: 'Fewer teams', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Not on a team', exact: true })).toContainText('Asha');
  for (const name of ['Asha', 'Leo', 'Maya']) {
    await page.getByLabel(`Move ${name}`, { exact: true }).selectOption(initial.teams[0].id);
    await page.getByRole('button', { name: `Pin ${name}`, exact: true }).click();
  }
  await expect(page.getByText('Unpin players or reduce the team count to balance these teams.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shuffle again', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Unpin Maya', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shuffle again', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'People library', exact: true }).click();
  const asha = initial.people.find((p: any) => p.name === 'Asha');
  await page.getByLabel(`Library name ${asha.id}`, { exact: true }).fill('Priya');
  expect((await saved(page)).players.find((p: any) => p.personId === asha.id).name).toBe('Priya');
  await page.getByRole('checkbox', { name: 'Include Priya', exact: true }).uncheck();
  const excluded = await saved(page), id = initial.players.find((p: any) => p.personId === asha.id).id;
  expect(excluded.players.some((p: any) => p.id === id)).toBe(false);
  expect(excluded.teams.flatMap((t: any) => [...t.memberIds, ...t.pinnedIds])).not.toContain(id);
  expect(excluded.people.find((p: any) => p.id === asha.id)).toMatchObject({ name: 'Priya', included: false });
});


test('CVN setup warns with the exact unavoidable own-member photo count', async ({ page }) => {
  await prepare(page);
  const event = await saved(page);
  for (const name of ['Asha', 'Leo', 'Maya', 'Dev']) await page.getByLabel(`Move ${name}`, { exact: true }).selectOption(event.teams[0].id);
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await page.getByRole('navigation', { name: 'Activity setup' }).getByRole('button', { name: /Game setup/ }).click();
  await expect(page.getByText('1 photo must be dealt to its own team to keep photo sets balanced.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start activity', exact: true }).click();
  const started = await saved(page);
  expect(started.segments[0].game.rounds).toHaveLength(4);
  expect(new Set(started.segments[0].game.rounds.map((r: any) => r.personId)).size).toBe(4);
});
