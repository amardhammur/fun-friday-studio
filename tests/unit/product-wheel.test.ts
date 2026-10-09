import { beforeAll, expect, it } from 'vitest';
import { discoverActivities, getActivity } from '../../src/core/registry';
import { activityEvent, activitySegment, applyActivitySegment, createEvent, createSegment, eventDraft } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import { products } from '../../activities/product-in-disguise/content';
import * as play from '../../activities/product-in-disguise/performance/logic';
import type { Settings, Game } from '../../activities/product-in-disguise/performance/types';

beforeAll(discoverActivities);
function started() {
  const activity = getActivity('product-in-disguise')!;
  const event = createEvent(); event.segments = [createSegment(activity)];
  const segment = activitySegment<Settings, Game>(event, 0);
  activity.startNewGame(segment, eventDraft(activityEvent(event)));
  expect(segment.game.step).toBe('wheel');
  return { activity, event, segment };
}

it('gives every product an equal slice and ignores extra input during a spin', () => {
  for (let i = 0; i < products.length; i++) {
    const { segment } = started();
    play.spinProduct(segment, () => (i + .5) / products.length, 1000);
    expect(segment.game.product?.id).toBe(products[i].id);
    expect((segment.game.spin!.rotation + i * 360 / products.length) % 360).toBe(0);
    const before = structuredClone(segment.game);
    play.spinProduct(segment, () => 0, 2000);
    expect(segment.game).toEqual(before);
  }
});

it('blocks preparation until the spin finishes and starts its timer only on host action', () => {
  const { activity, segment } = started();
  play.spinProduct(segment, () => 0, 1000);
  play.advance(segment, 2000); play.finishSpin(segment, 4999);
  expect(segment.game.step).toBe('wheel');
  expect(segment.game.timer.deadlineAt).toBeUndefined();
  play.finishSpin(segment, 5000);
  expect(segment.game.step).toBe('product');
  play.advance(segment, 10_000);
  expect(segment.game.step).toBe('prepare');
  expect(segment.game.timer.deadlineAt).toBe(730_000);
  expect(activity.stateSchema.safeParse(segment.game).success).toBe(true);
});

it('lets the host respin a revealed product, excludes that product, and locks it at preparation', () => {
  const { activity, segment } = started();
  play.spinProduct(segment, () => 0, 1000); play.finishSpin(segment, 5000);
  expect(segment.game.product?.id).toBe('stapler');
  play.spinProduct(segment, () => 0, 6000);
  expect(segment.game.step).toBe('wheel');
  expect(segment.game.product?.id).toBe('umbrella');
  expect(segment.game.timer.deadlineAt).toBeUndefined();
  expect(activity.stateSchema.safeParse(segment.game).success).toBe(true);
  const before = structuredClone(segment.game);
  play.spinProduct(segment, () => .99, 7000); play.advance(segment, 7000);
  expect(segment.game).toEqual(before);
  play.finishSpin(segment, 10000); play.advance(segment, 11000);
  const prepared = structuredClone(segment.game);
  play.spinProduct(segment, () => .99, 12000);
  expect(segment.game).toEqual(prepared);
});

it('restores the chosen product and remaining animation after reload without a reroll', () => {
  const { activity, event, segment } = started();
  play.spinProduct(segment, () => .4, 1000);
  applyActivitySegment(event, 0, segment); event.phase = 'segment';
  const restored = validateEvent(JSON.parse(JSON.stringify(event)));
  const resumed = activitySegment<Settings, Game>(restored, 0);
  expect(resumed.game.product).toEqual(segment.game.product);
  expect(resumed.game.spin).toEqual(segment.game.spin);
  activity.onPause!(resumed); activity.onResume!(resumed);
  play.finishSpin(resumed, 5000);
  expect(resumed.game.step).toBe('product');
  expect(resumed.game.timer.deadlineAt).toBeUndefined();
});

it('rejects draws without snapshots and post-draw phases without a product', () => {
  const { activity, segment } = started();
  const noProduct = structuredClone(segment.game); noProduct.step = 'prepare';
  expect(activity.stateSchema.safeParse(noProduct).success).toBe(false);
  play.spinProduct(segment, () => 0, 1000);
  const missing = structuredClone(segment.game); delete missing.product;
  expect(activity.stateSchema.safeParse(missing).success).toBe(false);
  const badClock = structuredClone(segment.game); badClock.timer.deadlineAt = 2000;
  expect(activity.stateSchema.safeParse(badClock).success).toBe(false);
});

it('keeps a version-two game’s selected product, timer and performance progress during migration', () => {
  const { activity, event } = started();
  event.phase = 'segment'; event.segments[0].activityVersion = 2; event.segments[0].status = 'play';
  event.segments[0].settings = { mode: 'commercial-clash', productId: 'stapler', preparationMinutes: 12, performanceSeconds: 180, votingSeconds: 180 };
  const ids = event.teams.map(t => t.id);
  event.segments[0].game = { mode: 'commercial-clash', product: products[0], teamIds: ids, performanceIndex: 0, performedCount: 0, step: 'prepare', ballots: Object.fromEntries(ids.map(id => [id, { funniest: null, creative: null, pitch: null }])), ballotIndex: 0, awardIndex: 0, revealedCount: 0, timer: { durationMs: 720000, deadlineAt: 1234567 } };
  const restored = validateEvent(event);
  expect(restored.segments[0].activityVersion).toBe(4);
  expect(restored.segments[0].game).toMatchObject({ product: products[0], step: 'prepare', timer: { durationMs: 720000, deadlineAt: 1234567 }, performanceIndex: 0, performedCount: 0 });
  expect(restored.segments[0].game).not.toHaveProperty('ballots');
  expect(restored.segments[0].settings).not.toHaveProperty('productId');
  expect(activity.hasProgress!(restored.segments[0].game)).toBe(true);
});
