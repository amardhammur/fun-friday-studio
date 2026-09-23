import { describe, expect, it } from 'vitest';
import { addSinglePerson, allPreviews, clearSetPairs, createPhotoSet, defaultIncluded, largestFace, MAX_PHOTO_SETS, nextPairNumber, orderedSets, pairsInSet, peopleInSet, playerIssues, primaryGroupSet, moveSet, removePhotoSet, renameSet, replaceSinglePhotos, setIncluded, wholeImageFace } from '../../src/core/people/photo-sets';
import { createEvent } from '../../src/core/event';
import { validateEvent } from '../../src/core/session';
import type { FacePair, Person, PhotoSet } from '../../src/core/types';

const pair = (id: string, setId: string, number: number): FacePair => ({ id, setId, number, color: '#f7d873', matchMethod: 'manual', reviewStatus: 'confirmed' });
const person = (id: string, facePairId: string): Person => ({ id, facePairId, name: id, funFact: '', included: true });
const library = () => ({ photoSets: [] as PhotoSet[], facePairs: [] as FacePair[], people: [] as Person[] });

describe('photo sets', () => {
  it('creates sets in order with trimmed names and a default name', () => {
    const lib = library();
    const first = createPhotoSet(lib, '  Engineering 2019  ', 'group');
    const second = createPhotoSet(lib, '   ', 'group');
    expect(first).toMatchObject({ name: 'Engineering 2019', kind: 'group', order: 0, previews: {} });
    expect(second).toMatchObject({ name: 'Group 2', order: 1 });
    expect(createPhotoSet(lib, 'x'.repeat(100), 'single').name).toHaveLength(80);
  });
  it(`refuses a set beyond ${MAX_PHOTO_SETS}`, () => {
    const lib = library();
    for (let i = 0; i < MAX_PHOTO_SETS; i++) createPhotoSet(lib, `Set ${i}`, 'group');
    expect(() => createPhotoSet(lib, 'One more', 'group')).toThrow(/20 photo sets/);
  });
  it('orders sets and finds the first group, skipping single sets', () => {
    const lib = library();
    const single = createPhotoSet(lib, 'Priya', 'single'), group = createPhotoSet(lib, 'Team', 'group');
    single.order = 5;
    expect(orderedSets(lib).map(s => s.id)).toEqual([group.id, single.id]);
    expect(primaryGroupSet(lib)?.id).toBe(group.id);
  });
  it('finds pairs and people by set, and the next pair number', () => {
    const lib = library();
    lib.facePairs.push(pair('a', 's1', 3), pair('b', 's2', 9));
    lib.people.push(person('pa', 'a'), person('pb', 'b'));
    expect(pairsInSet(lib, 's1').map(p => p.id)).toEqual(['a']);
    expect(peopleInSet(lib, 's2').map(p => p.id)).toEqual(['pb']);
    expect(nextPairNumber(lib.facePairs)).toBe(10);
    expect(nextPairNumber([])).toBe(1);
  });
  it('includes new people by default only while the library has at most one set', () => {
    const lib = library();
    expect(defaultIncluded(lib)).toBe(true);
    createPhotoSet(lib, 'One', 'group'); expect(defaultIncluded(lib)).toBe(true);
    createPhotoSet(lib, 'Two', 'group'); expect(defaultIncluded(lib)).toBe(false);
  });
  it('merges every set preview into one lookup', () => {
    const lib = library();
    createPhotoSet(lib, 'One', 'group').previews = { a: 'pa' };
    createPhotoSet(lib, 'Two', 'group').previews = { b: 'pb' };
    expect(allPreviews(lib)).toEqual({ a: 'pa', b: 'pb' });
  });
});
describe('set clean-up and player checks', () => {
  it('clears one set’s pairs, people and crop assets, leaving other sets alone', () => {
    const lib = { ...library(), assets: {} as Record<string, any> };
    const crop = (id: string) => ({ sourceImageId: 'src', faceBox: { x: 0, y: 0, width: .1, height: .1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 }, cropImageId: id });
    lib.facePairs.push({ ...pair('a', 's1', 1), now: crop('crop-a') }, pair('b', 's2', 2));
    lib.people.push(person('pa', 'a'), person('pb', 'b'));
    lib.assets['crop-a'] = { id: 'crop-a' };
    expect(clearSetPairs(lib, 's1')).toEqual(['crop-a']);
    expect(lib.facePairs.map(p => p.id)).toEqual(['b']);
    expect(lib.people.map(p => p.id)).toEqual(['pb']);
    expect(lib.assets).toEqual({});
  });
  it('needs at least one player and a name for every player', () => {
    const lib = library();
    expect(playerIssues(lib)).toHaveLength(1);
    lib.people.push({ ...person('p', 'a'), name: ' ' });
    expect(playerIssues(lib)).toHaveLength(1);
    lib.people[0].name = 'Asha';
    expect(playerIssues(lib)).toEqual([]);
    lib.people.push({ ...person('q', 'b'), name: '', included: false });
    expect(playerIssues(lib)).toEqual([]);
  });
});

describe('library set actions', () => {
  const crop = (id: string) => ({ sourceImageId: 'src', faceBox: { x: 0, y: 0, width: .1, height: .1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 }, cropImageId: id });
  const build = () => {
    const lib = { ...library(), assets: {} as Record<string, any> };
    const a = createPhotoSet(lib, 'A', 'group'), single = createPhotoSet(lib, 'Priya', 'single'), b = createPhotoSet(lib, 'B', 'group');
    a.nowImageId = 'a-now'; a.thenImageId = 'a-then'; a.previews = { 'a-now': 'a-now-preview' };
    lib.facePairs.push({ ...pair('pa', a.id, 1), now: crop('pa-crop'), then: crop('pa-crop-then') }, { ...pair('pb', a.id, 2), now: crop('pb-crop') }, pair('pc', b.id, 3));
    lib.people.push(person('A1', 'pa'), person('A2', 'pb'), person('B1', 'pc'));
    for (const id of ['a-now', 'a-then', 'a-now-preview', 'pa-crop', 'pa-crop-then', 'pb-crop']) lib.assets[id] = { id };
    return { lib, a, single, b };
  };
  it('switches a whole set in or out, but only people with both faces', () => {
    const { lib, a } = build();
    setIncluded(lib, a.id, false);
    expect(lib.people.map(p => p.included)).toEqual([false, false, true]);
    setIncluded(lib, a.id, true);
    expect(lib.people.map(p => p.included)).toEqual([true, false, true]);
  });
  it('moves a group past the next group, skipping single sets', () => {
    const { lib, a, b } = build();
    moveSet(lib, a.id, 1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
    moveSet(lib, a.id, 1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
    expect(new Set(lib.photoSets.map(s => s.order)).size).toBe(3);
    moveSet(lib, b.id, -1);
    expect(orderedSets(lib).filter(s => s.kind === 'group').map(s => s.name)).toEqual(['B', 'A']);
  });
  it('renames only to a non-empty trimmed name', () => {
    const { lib, a } = build();
    expect(renameSet(lib, a.id, '   ')).toBe(false);
    expect(a.name).toBe('A');
    expect(renameSet(lib, a.id, '  Design offsite  ')).toBe(true);
    expect(a.name).toBe('Design offsite');
  });
  it('removes a set with its people, faces and images, and closes the gap in the order', () => {
    const { lib, a } = build();
    expect(removePhotoSet(lib, a.id).sort()).toEqual(['a-now', 'a-now-preview', 'a-then', 'pa-crop', 'pa-crop-then', 'pb-crop']);
    expect(lib.people.map(p => p.id)).toEqual(['B1']);
    expect(lib.assets).toEqual({});
    expect(orderedSets(lib).map(s => [s.name, s.order])).toEqual([['Priya', 0], ['B', 1]]);
  });
});

describe('single-photo people', () => {
  const photo = (id: string) => ({ asset: { id, name: `${id}.jpg`, width: 600, height: 800, mime: 'image/jpeg' }, preview: { id: `${id}-preview`, name: 'p.jpg', width: 300, height: 400, mime: 'image/jpeg' }, face: { faceBox: { x: .2, y: .1, width: .4, height: .3 }, padding: { top: .4, right: .32, bottom: .7, left: .32 } } });
  it('adds a playing person in their own single set', () => {
    const event = createEvent();
    const person = addSinglePerson(event, { name: ' Priya ', funFact: 'Plays the tabla', now: photo('now'), then: photo('then') });
    expect(person).toMatchObject({ name: 'Priya', funFact: 'Plays the tabla', included: true });
    expect(event.photoSets).toEqual([{ id: expect.any(String), name: 'Priya', kind: 'single', nowImageId: 'now', thenImageId: 'then', previews: { now: 'now-preview', then: 'then-preview' }, order: 0 }]);
    expect(event.facePairs[0]).toMatchObject({ number: 1, setId: event.photoSets[0].id, reviewStatus: 'confirmed', now: { sourceImageId: 'now' }, then: { sourceImageId: 'then' } });
    expect(validateEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
  it('replaces both photos in place and returns the old image ids', () => {
    const event = createEvent();
    const person = addSinglePerson(event, { name: 'Priya', funFact: '', now: photo('now'), then: photo('then') });
    event.facePairs[0].now!.cropImageId = 'old-crop'; event.assets['old-crop'] = { id: 'old-crop', name: 'c', width: 1, height: 1, mime: 'image/jpeg' };
    const removed = replaceSinglePhotos(event, event.photoSets[0].id, photo('now2'), photo('then2'));
    expect(removed.sort()).toEqual(['now', 'now-preview', 'old-crop', 'then', 'then-preview']);
    expect(event.people).toEqual([person]);
    expect(event.facePairs[0].now).toEqual({ sourceImageId: 'now2', faceBox: { x: .2, y: .1, width: .4, height: .3 }, padding: { top: .4, right: .32, bottom: .7, left: .32 } });
    expect(Object.keys(event.assets).sort()).toEqual(['now2', 'now2-preview', 'then2', 'then2-preview']);
  });
  it('suggests the largest detected face, or the whole photo', () => {
    expect(largestFace([{ x: 0, y: 0, width: .1, height: .1 }, { x: .5, y: .5, width: .3, height: .2 }])).toEqual({ x: .5, y: .5, width: .3, height: .2 });
    expect(largestFace([])).toBeUndefined();
    expect(wholeImageFace()).toEqual({ faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  });
});
