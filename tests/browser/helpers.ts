import { expect, type Page } from '@playwright/test';

export const personalKey = 'fun-friday-studio.session.v1';
export async function openActivities(page: Page) {
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find your next crowd favourite.' })).toBeVisible();
}
export async function startDemo(page: Page, activity = 'Childhood vs Now') {
  await openActivities(page);
  await page.locator('.activity-card', { has: page.getByRole('heading', { name: activity, exact: true }) }).getByRole('button', { name: 'Try the demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
}
export async function openWelcome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good teams make great memories.' })).toBeVisible();
}
export function acceptNextConfirm(page: Page) {
  page.once('dialog', dialog => dialog.accept());
}
// Photo-editing tests need an editable personal fixture, not the isolated demo.
// Generate its real image blobs through the demo, then seed an unstarted personal event.
export async function personalPhotoEvent(page: Page) {
  await openWelcome(page);
  await startDemo(page);
  await page.evaluate(key => {
    const event = JSON.parse(localStorage.getItem('fun-friday-studio.demo.v1')!);
    event.isDemo = false; event.phase = 'segment'; event.scoreEntries = [];
    event.segments[0].status = 'setup'; event.segments[0].setupStepId = 'game';
    localStorage.setItem(key, JSON.stringify(event)); localStorage.removeItem('fun-friday-studio.demo.v1');
  }, personalKey);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good teams make great memories.' })).toBeVisible();
}
export async function resumeEvent(page: Page) {
  await page.getByRole('button', { name: 'Your event', exact: true }).click();
  await page.getByRole('button', { name: 'Continue event', exact: true }).click();
}
export async function setupPhotoEvent(page: Page) {
  await page.getByRole('button', { name: 'Build your Friday', exact: true }).click();
  await page.getByRole('button', { name: 'Childhood vs Now', exact: true }).click();
  await page.getByRole('button', { name: 'Set up first activity', exact: true }).click();
}
