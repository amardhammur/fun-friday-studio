import { describe, it, expect } from 'vitest';
import { pairFaces, intersectionOverUnion } from '../../activities/childhood-vs-now/logic/pairing';
import type { Rect } from '../../src/core/types';
const box = (x: number, y = .3, size = .08): Rect => ({ x, y, width: size, height: size });
describe('position-based one-to-one face pairing', () => {
  it('pairs shifted and smaller childhood faces even in a different detection order', () => {
    const result = pairFaces([box(.1), box(.4), box(.7)], [box(.71, .32, .06), box(.12, .34, .06), box(.42, .33, .05)]);
    expect(result.map(p => p.then)).toEqual([1, 2, 0]);
  });
  it('does not reuse a childhood face for nearby adults', () => {
    const result = pairFaces([box(.1), box(.15)], [box(.12)]);
    expect(result.filter(p => p.then !== undefined)).toHaveLength(1);
    expect(result.filter(p => p.now !== undefined)).toHaveLength(2);
  });
  it('uses a global assignment where greedy nearest pairing would be worse', () => {
    const result = pairFaces([box(.1), box(.16)], [box(.14), box(.04)], .12);
    expect(result.map(r => r.then)).toEqual([1, 0]);
  });
  it('keeps out-of-tolerance detections unmatched on both sides', () => {
    expect(pairFaces([box(.1)], [box(.7)], .1)).toEqual([{ now: 0 }, { then: 0 }]);
  });
  it('handles empty sets and exact matches', () => {
    expect(pairFaces([], [])).toEqual([]);
    expect(pairFaces([], [box(.1)])).toEqual([{ then: 0 }]);
    expect(pairFaces([box(.1)], [])).toEqual([{ now: 0 }]);
    expect(pairFaces([box(.1)], [box(.1)])[0].distance).toBe(0);
  });
  it('distinguishes overlapping detections from neighbouring faces', () => {
    expect(intersectionOverUnion(box(.1), box(.1))).toBeCloseTo(1);
    expect(intersectionOverUnion(box(.1), box(.8))).toBe(0);
  });
});
