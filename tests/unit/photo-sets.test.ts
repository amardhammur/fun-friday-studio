import { describe, expect, it } from 'vitest';
import { allPreviews, createPhotoSet, defaultIncluded, MAX_PHOTO_SETS, nextPairNumber, orderedSets, pairsInSet, peopleInSet, primaryGroupSet } from '../../src/core/people/photo-sets';
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
