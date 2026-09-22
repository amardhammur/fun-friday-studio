import { describe, expect, it } from 'vitest';
import { clampRect, cropPixels, defaultPadding, outputSize, paddedRect } from '../../src/core/images/math';
import type { FaceCrop } from '../../src/core/types';
describe('crop geometry', () => {
  const face: FaceCrop = { sourceImageId: 'image', faceBox: { x: .2, y: .3, width: .1, height: .2 }, padding: defaultPadding };
  it('includes extra hair and shoulders', () => {
    const r = paddedRect(face); expect(r.y).toBeCloseTo(.22); expect(r.height).toBeCloseTo(.42); expect(r.width).toBeCloseTo(.164);
  });
  it('clamps padding at all image boundaries', () => {
    const r = paddedRect({ ...face, faceBox: { x: 0, y: 0, width: 1, height: 1 } }); expect(r).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  it('maps normalized geometry to large source pixels within bounds', () => {
    const r = cropPixels({ ...face, faceBox: { x: .95, y: .95, width: .05, height: .05 } }, 4200, 2800);
    expect(r.x + r.width).toBeLessThanOrEqual(4200); expect(r.y + r.height).toBeLessThanOrEqual(2800); expect(r.width).toBeGreaterThan(210);
  });
  it('keeps resized and dragged crop boxes inside the image', () => {
    expect(clampRect({ x: -.1, y: .9, width: 1.5, height: .5 })).toEqual({ x: 0, y: .9, width: 1, height: 1 - .9 });
  });
  it('exports a 1100px long edge without changing aspect ratio', () => {
    expect(outputSize(400, 800)).toEqual({ width: 550, height: 1100 });
    expect(outputSize(3000, 1500)).toEqual({ width: 1100, height: 550 });
    expect(outputSize(1, 4000)).toEqual({ width: 1, height: 1100 });
  });
});
