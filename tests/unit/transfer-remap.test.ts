import { beforeAll, describe, expect, it } from 'vitest';
import eventDoc from '../fixtures/event-v2.json';
import { discoverActivities } from '../../src/core/registry';
import { validateEvent } from '../../src/core/session';
import { remapEventImages } from '../../src/core/transfer';

beforeAll(async () => { await discoverActivities(); });

describe('per-segment image remapping', () => {
  it('rewrites every segment game and leaves user text alone', () => {
    const event = validateEvent(eventDoc);
    event.segments.push({ ...event.segments[0], id: 'seg-b' });
    const remap = { 'img-now': 'new-now', 'img-then': 'new-then', 'img-now-crop': 'new-now-crop', 'img-then-crop': 'new-then-crop' };
    remapEventImages(event, remap);
    expect(event.photoSets[0].nowImageId).toBe('new-now');
    expect(event.photoSets[0].thenImageId).toBe('new-then');
    expect(event.people[0].funFact).toBe('Keeper of the snack drawer');
  });
  it('rewrites face crops on the shared face pairs exactly once', () => {
    const event = validateEvent(eventDoc);
    remapEventImages(event, { 'img-now': 'a', 'img-then': 'b', 'img-now-crop': 'c', 'img-then-crop': 'd' });
    expect(event.facePairs[0].now!.sourceImageId).toBe('a');
    expect(event.facePairs[0].now!.cropImageId).toBe('c');
    expect(event.facePairs[0].then!.sourceImageId).toBe('b');
    expect(event.facePairs[0].then!.cropImageId).toBe('d');
  });
  it('throws when an activity in the line-up is not installed', () => {
    const event = validateEvent(eventDoc);
    event.segments[0].activityId = 'not-real';
    expect(() => remapEventImages(event, {})).toThrow(/not installed/);
  });
});
