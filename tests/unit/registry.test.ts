import { beforeAll, describe, expect, it } from 'vitest';
import { discoverActivities, getActivities, registerActivity } from '../../src/core/registry';
import type { Activity } from '../../src/core/types';

// Real activities load once so the "first entry" test reflects the actual production
// registration path — the regression this file exists to catch was a filename-order bug
// in discoverActivities' glob, not something a hand-built fixture would reproduce.
beforeAll(discoverActivities);

// Sort only ever touches `id` and `order`; the rest of Activity is irrelevant noise here.
const fake = (id: string, order?: number) => ({ id, order } as unknown as Activity);

describe('activity ordering', () => {
  it('sorts activities by ascending order, regardless of registration order', () => {
    registerActivity(fake('order-test-c', 5));
    registerActivity(fake('order-test-a', 1));
    registerActivity(fake('order-test-b', 3));
    const ids = getActivities().map(a => a.id).filter(id => ['order-test-a', 'order-test-b', 'order-test-c'].includes(id));
    expect(ids).toEqual(['order-test-a', 'order-test-b', 'order-test-c']);
  });

  it('places an activity with no order after every activity that has one', () => {
    registerActivity(fake('order-test-unordered'));
    registerActivity(fake('order-test-with-order', 2));
    const ids = getActivities().map(a => a.id).filter(id => ['order-test-with-order', 'order-test-unordered'].includes(id));
    expect(ids).toEqual(['order-test-with-order', 'order-test-unordered']);
  });

  it('greets a first-time visitor with childhood-vs-now, the regression this file pins', () => {
    expect(getActivities()[0]?.id).toBe('childhood-vs-now');
  });
});
