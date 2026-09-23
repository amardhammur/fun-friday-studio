import { beforeAll, describe, expect, it } from 'vitest';
import eventV2 from '../fixtures/event-v2.json';
import { discoverActivities } from '../../src/core/registry';
import { migrateEventV2 } from '../../src/core/migrate';
import { validateEvent } from '../../src/core/session';

beforeAll(async () => { await discoverActivities(); });
const v2 = () => structuredClone(eventV2) as Record<string, any>;

describe('migrateEventV2', () => {
  it('turns the Childhood vs Now group photos into Group 1 and assigns every face pair', () => {
    const migrated = migrateEventV2(v2());
    expect(migrated.formatVersion).toBe(3);
    expect(migrated.photoSets).toHaveLength(1);
    expect(migrated.photoSets[0]).toMatchObject({ name: 'Group 1', kind: 'group', nowImageId: 'img-now', thenImageId: 'img-then', order: 0 });
    expect(migrated.facePairs.every((p: any) => p.setId === migrated.photoSets[0].id)).toBe(true);
    for (const field of ['originalImageId', 'childhoodImageId', 'childhoodUploadId', 'previews']) expect(migrated.segments[0].game).not.toHaveProperty(field);
  });
  it('keeps only the previews of the two group photos', () => {
    const raw = v2();
    raw.segments[0].game.previews = { 'img-now': 'img-now-crop', 'raw-upload': 'img-then-crop' };
    expect(migrateEventV2(raw).photoSets[0].previews).toEqual({ 'img-now': 'img-now-crop' });
  });
  it('derives the set from the first complete face pair when no segment has photos', () => {
    const raw = v2();
    delete raw.segments[0].game.originalImageId; delete raw.segments[0].game.childhoodImageId;
    expect(migrateEventV2(raw).photoSets[0]).toMatchObject({ nowImageId: 'img-now', thenImageId: 'img-then' });
  });
  it('prefers the game whose photos match the face pairs over an earlier stale game', () => {
    const raw = v2();
    const second = { ...raw.segments[0], id: 'seg-2', game: { ...raw.segments[0].game, originalImageId: 'img-now-2', childhoodImageId: 'img-then-2' } };
    raw.segments.push(second);
    // The host re-uploaded in the second segment; the face pairs already point at its photos while
    // the first segment's game still holds the stale ones.
    raw.facePairs[0].now.sourceImageId = 'img-now-2';
    raw.facePairs[0].then.sourceImageId = 'img-then-2';
    const migrated = migrateEventV2(raw);
    expect(migrated.photoSets).toHaveLength(1);
    expect(migrated.photoSets[0]).toMatchObject({ nowImageId: 'img-now-2', thenImageId: 'img-then-2' });
    expect(migrated.facePairs).toHaveLength(1);
    expect(migrated.facePairs[0].id).toBe('f1');
    expect(migrated.facePairs[0].setId).toBe(migrated.photoSets[0].id);
    expect(migrated.people.map((p: any) => p.id)).toEqual(['p1']);
  });
  it('drops face pairs and people whose photos belong to neither group photo', () => {
    const raw = v2();
    raw.facePairs.push({ ...raw.facePairs[0], id: 'stray', now: { ...raw.facePairs[0].now, sourceImageId: 'elsewhere' } });
    raw.people.push({ ...raw.people[0], id: 'stray-person', facePairId: 'stray' });
    const migrated = migrateEventV2(raw);
    expect(migrated.facePairs.map((p: any) => p.id)).toEqual(['f1']);
    expect(migrated.people.map((p: any) => p.id)).toEqual(['p1']);
  });
  it('creates no set and keeps no pairs when there are no photos at all', () => {
    const raw = v2();
    delete raw.segments[0].game.originalImageId; delete raw.segments[0].game.childhoodImageId;
    raw.facePairs = [{ ...raw.facePairs[0], then: undefined }];
    const migrated = migrateEventV2(raw);
    expect(migrated.photoSets).toEqual([]); expect(migrated.facePairs).toEqual([]); expect(migrated.people).toEqual([]);
  });
  it('is applied by validateEvent, which returns a valid version 3 session', () => {
    const loaded = validateEvent(v2());
    expect(loaded.formatVersion).toBe(3);
    expect(loaded.photoSets).toHaveLength(1);
    expect(validateEvent(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
  });
});
