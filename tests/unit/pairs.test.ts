import { describe, expect, it } from 'vitest';
import { hasJpegSignature, parseFacePairFiles } from '../../src/core/people/pairs';

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

  it('rejects incomplete, duplicate, malformed, and unsupported entries', () => {
    expect(() => parseFacePairFiles(['folder/'])).toThrow(/no face pairs/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg'])).toThrow(/missing.*now/i);
    expect(() => parseFacePairFiles(['Asha - then.jpg', 'Asha - THEN.jpg', 'Asha - now.jpg'])).toThrow(/duplicate/i);
    expect(() => parseFacePairFiles(['Asha.jpg', 'Asha - now.jpg'])).toThrow(/must end/i);
    expect(() => parseFacePairFiles(['Asha - then.png', 'Asha - now.jpg'])).toThrow(/JPEG/i);
  });
});
