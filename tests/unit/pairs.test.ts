import { describe, expect, it } from 'vitest';
import { parseFacePairFiles } from '../../src/core/people/pairs';

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
