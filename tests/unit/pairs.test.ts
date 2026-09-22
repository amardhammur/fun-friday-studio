import { describe, expect, it } from 'vitest';
import { assertFacePairImportCapacity, hasJpegSignature, maxFacePairNumber, parseFacePairFiles } from '../../src/core/people/pairs';

describe('face-pair JPEG bytes', () => {
  it('accepts JPEG signatures and rejects renamed PNG and WebP bytes', () => {
    expect(hasJpegSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasJpegSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(hasJpegSignature(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false);
    expect(hasJpegSignature(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe('face-pair ZIP filenames', () => {
  it('pairs then and now files for multiple people', () => {
    expect(parseFacePairFiles([
      'Asha - then.jpg',
      'Asha - now.jpg',
      'Leo - now.jpeg',
      'Leo - then.JPEG',
    ])).toEqual([
      { name: 'Asha', thenFile: 'Asha - then.jpg', nowFile: 'Asha - now.jpg' },
      { name: 'Leo', thenFile: 'Leo - then.JPEG', nowFile: 'Leo - now.jpeg' },
    ]);
  });

  it('ignores directory entries and matches suffixes case-insensitively', () => {
    expect(parseFacePairFiles(['Maya - THEN.JPG', 'Maya - now.jpg', 'folder/'])).toEqual([
      { name: 'Maya', thenFile: 'Maya - THEN.JPG', nowFile: 'Maya - now.jpg' },
    ]);
  });

  it('rejects flat-path violations, empty names, and mixed valid and junk entries', () => {
    expect(() => parseFacePairFiles(['folder/Maya - then.jpg', 'Maya - now.jpg'])).toThrow(/flat/i);
    expect(() => parseFacePairFiles([' - then.jpg', 'Maya - now.jpg'])).toThrow(/person name/i);
    expect(() => parseFacePairFiles(['Maya - then.jpg', 'Maya - now.jpg', 'notes.txt'])).toThrow(/JPEG/i);
  });

  it('groups names case-insensitively while preserving the first display name', () => {
    expect(parseFacePairFiles(['Asha - then.jpg', 'asha - now.jpg'])).toEqual([
      { name: 'Asha', thenFile: 'Asha - then.jpg', nowFile: 'asha - now.jpg' },
    ]);
  });

  it('rejects incomplete, duplicate, malformed, and unsupported entries', () => {
    expect(() => parseFacePairFiles(['folder/'])).toThrow(/no face pairs/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg'])).toThrow(/missing.*now/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg', 'Asha - THEN.jpg', 'Asha - now.jpg'])).toThrow(/duplicate/i);
    expect(() => parseFacePairFiles(['Asha.jpg', 'Asha - now.jpg'])).toThrow(/must end/i);
    expect(() => parseFacePairFiles(['Asha - then.png', 'Asha - now.jpg'])).toThrow(/JPEG/i);
  });
});

describe('face-pair import limits', () => {
  it('rejects imports that exceed either session record limit', () => {
    expect(() => assertFacePairImportCapacity(1, { people: 500, facePairs: 0 })).toThrow(/500 people/i);
    expect(() => assertFacePairImportCapacity(1, { people: 0, facePairs: 1000 })).toThrow(/1000 face pairs/i);
    expect(() => assertFacePairImportCapacity(2, { people: 499, facePairs: 999 })).toThrow(/500 people.*1000 face pairs/i);
  });

  it('accepts imports within both session limits', () => {
    expect(() => assertFacePairImportCapacity(1, { people: 499, facePairs: 999 })).not.toThrow();
  });

  it('starts numbering after the largest existing pair number', () => {
    expect(maxFacePairNumber([])).toBe(0);
    expect(maxFacePairNumber([1, 10, 3])).toBe(10);
  });
});
