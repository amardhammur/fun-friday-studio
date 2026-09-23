import { describe, expect, it } from 'vitest';
import { buildRevealSlides, clampSlide } from '../../activities/childhood-vs-now/logic/reveal';
import type { FacePair, Person, PhotoSet } from '../../src/core/types';

const set = (id: string, kind: PhotoSet['kind'], order: number): PhotoSet => ({ id, name: id, kind, order, previews: {}, nowImageId: `${id}-now`, thenImageId: `${id}-then` });
const pair = (id: string, setId: string): FacePair => ({ id, setId, number: 1, color: '#f7d873', matchMethod: 'manual', reviewStatus: 'confirmed' });
const person = (id: string, facePairId: string): Person => ({ id, facePairId, name: id, funFact: '', included: true });
const event = {
  photoSets: [set('second', 'group', 1), set('first', 'group', 0), set('nobody', 'group', 2), set('priya', 'single', 3), set('omar', 'single', 4)],
  facePairs: [pair('f1', 'first'), pair('f2', 'first'), pair('s1', 'second'), pair('n1', 'nobody'), pair('p1', 'priya'), pair('o1', 'omar')],
  people: [person('Asha', 'f1'), person('Leo', 'f2'), person('Maya', 's1'), person('Sam', 'n1'), person('Priya', 'p1'), person('Omar', 'o1')],
};
const rounds = (...ids: string[]) => ids.map(personId => ({ personId }));

describe('reveal slides', () => {
  it('shows each group in library order with only its players, then one slide for single photos', () => {
    const slides = buildRevealSlides(event, rounds('Asha', 'Maya', 'Priya', 'Omar'));
    expect(slides.map(s => s.kind === 'group' ? s.set.id : 'singles')).toEqual(['first', 'second', 'singles']);
    expect(slides[0].players.map(p => p.person.id)).toEqual(['Asha']);
    expect(slides[2].players.map(p => p.person.id)).toEqual(['Priya', 'Omar']);
  });
  it('skips groups without players and leaves out the singles slide when nobody single played', () => {
    const slides = buildRevealSlides(event, rounds('Maya'));
    expect(slides.map(s => s.kind === 'group' ? s.set.id : 'singles')).toEqual(['second']);
  });
  it('can be only the singles slide', () => {
    expect(buildRevealSlides(event, rounds('Priya')).map(s => s.kind)).toEqual(['singles']);
  });
  it('clamps a stored slide index into range', () => {
    expect(clampSlide(5, 2)).toBe(1);
    expect(clampSlide(-1, 2)).toBe(0);
    expect(clampSlide(3, 0)).toBe(0);
  });
});
