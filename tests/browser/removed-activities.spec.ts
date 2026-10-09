import { test, expect } from '@playwright/test';
import { openActivities, openWelcome, personalKey, personalPhotoEvent, resumeEvent } from './helpers';

test('the library and lineup offer the current activities', async ({ page }) => {
  await openWelcome(page); await openActivities(page);
  await expect(page.locator('.activity-card h2')).toHaveText(['Childhood vs Now', 'Act It Out', 'Commercial Clash', 'Selfie Bottle Challenge', 'Sharmila Awards', 'Clip to Stage']);
  await page.getByRole('button', { name: 'Welcome', exact: true }).click();
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await expect(page.locator('.lineup-add button')).toHaveText(['Childhood vs Now', 'Act It Out', 'Commercial Clash', 'Selfie Bottle Challenge', 'Sharmila Awards', 'Clip to Stage']);
  await page.getByRole('button', { name: 'Commercial Clash', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeEnabled();
});

test('an older event skips removed games without losing its photos, roster or remaining setup', async ({ page }) => {
  await personalPhotoEvent(page);
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem(key)!);
    const removed = (activityId: string) => ({ id: `old-${activityId}`, activityId, activityVersion: 1, title: activityId, status: 'play', setupStepId: 'game', weight: 1, settings: {}, game: {} });
    event.segments[0].status = 'pending';
    event.segments = [removed('wait-why'), removed('real-or-ridiculous'), event.segments[0]];
    event.currentSegmentIndex = 1; event.phase = 'segment';
    event.scoreEntries = [{ id: 'old-score', teamId: event.teams[0].id, segmentId: 'old-real-or-ridiculous', kind: 'round-award', points: 2, active: true }];
    localStorage.setItem(key, JSON.stringify(event));
  }, personalKey);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good teams make great memories.' })).toBeVisible();
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), personalKey);
  expect(restored.segments.map((s: any) => s.activityId)).toEqual(['childhood-vs-now']);
  expect(restored.currentSegmentIndex).toBe(0); expect(restored.segments[0].status).toBe('setup');
  expect(restored.scoreEntries).toEqual([]);
  for (const field of ['people', 'players', 'teams', 'facePairs', 'assets', 'photoSets']) expect(restored[field]).toEqual(before[field]);
  await resumeEvent(page);
  await expect(page.locator('.setup-topbar')).toContainText('Childhood vs Now');
  await expect(page.getByRole('navigation', { name: 'Activity setup', exact: true })).toBeVisible();
});
