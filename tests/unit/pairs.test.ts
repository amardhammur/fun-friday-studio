import { describe, expect, it } from 'vitest';
import {
  assertFacePairImportCapacity,
  FACE_PAIR_BUNDLE_VERSION,
  hasJpegSignature,
  maxFacePairNumber,
  parseFacePairsBundleManifest,
  type FacePairsBundleManifest,
} from '../../src/core/people/pairs';

const defaultPadding = { top: 0.4, right: 0.32, bottom: 0.7, left: 0.32 };
const defaultFaceBox = { x: 0.1, y: 0.2, width: 0.05, height: 0.08 };

function pairSide(number: number, side: 'now' | 'then', faceBox = defaultFaceBox) {
  const suffix = String(number).padStart(3, '0');
  return {
    cropPath: `pairs/${suffix}-${side}.jpg`,
    faceBox,
    padding: { ...defaultPadding },
  };
}

function validManifest(overrides: {
  groups?: Record<string, unknown>;
  pairs?: unknown[];
  version?: number;
} = {}): unknown {
  return {
    version: overrides.version ?? FACE_PAIR_BUNDLE_VERSION,
    groups: {
      now: { path: 'groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
      then: { path: 'groups/then', name: 'Team childhood', width: 4000, height: 3000, mime: 'image/jpeg' },
      ...overrides.groups,
    },
    pairs: overrides.pairs ?? [
      {
        number: 1,
        color: '#f7d873',
        name: 'Asha',
        funFact: 'Loves chai',
        included: true,
        now: pairSide(1, 'now'),
        then: pairSide(1, 'then'),
      },
      {
        number: 2,
        color: '#eea7bb',
        name: 'Leo',
        funFact: '',
        included: false,
        now: pairSide(2, 'now'),
        then: pairSide(2, 'then'),
      },
    ],
  };
}

describe('face-pair JPEG bytes', () => {
  it('accepts JPEG signatures and rejects renamed PNG and WebP bytes', () => {
    expect(hasJpegSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasJpegSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(hasJpegSignature(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false);
    expect(hasJpegSignature(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe('face-pair bundle manifest', () => {
  it('accepts a valid multi-person manifest with optional group previews', () => {
    const raw = validManifest({
      groups: {
        nowPreview: { path: 'groups/now-preview', name: 'Team today preview', width: 1200, height: 900, mime: 'image/jpeg' },
        thenPreview: { path: 'groups/then-preview', name: 'Team childhood preview', width: 1200, height: 900, mime: 'image/jpeg' },
      },
    });
    expect(parseFacePairsBundleManifest(raw)).toEqual({
      version: 1,
      groups: {
        now: { path: 'groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
        then: { path: 'groups/then', name: 'Team childhood', width: 4000, height: 3000, mime: 'image/jpeg' },
        nowPreview: { path: 'groups/now-preview', name: 'Team today preview', width: 1200, height: 900, mime: 'image/jpeg' },
        thenPreview: { path: 'groups/then-preview', name: 'Team childhood preview', width: 1200, height: 900, mime: 'image/jpeg' },
      },
      pairs: [
        {
          number: 1,
          color: '#f7d873',
          name: 'Asha',
          funFact: 'Loves chai',
          included: true,
          now: pairSide(1, 'now'),
          then: pairSide(1, 'then'),
        },
        {
          number: 2,
          color: '#eea7bb',
          name: 'Leo',
          funFact: '',
          included: false,
          now: pairSide(2, 'now'),
          then: pairSide(2, 'then'),
        },
      ],
    } satisfies FacePairsBundleManifest);
  });

  it('rejects missing required group metadata and invalid group MIME types', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({ groups: { then: undefined } }))).toThrow(/group/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        now: { path: 'groups/now', name: '', width: 4000, height: 3000, mime: 'image/jpeg' },
      },
    }))).toThrow(/name/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        now: { path: 'groups/now', name: 'Team today', width: 0, height: 3000, mime: 'image/jpeg' },
      },
    }))).toThrow(/width/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        now: { path: 'groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'application/pdf' },
      },
    }))).toThrow(/image/i);
  });

  it('rejects missing pair sides and invalid person fields', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [{
        number: 1,
        color: '#f7d873',
        name: 'Asha',
        funFact: '',
        included: true,
        now: pairSide(1, 'now'),
      }],
    }))).toThrow(/then/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [{
        number: 1,
        color: '#f7d873',
        name: '',
        funFact: '',
        included: true,
        now: pairSide(1, 'now'),
        then: pairSide(1, 'then'),
      }],
    }))).toThrow(/name/i);
  });

  it('rejects invalid face boxes and padding', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [{
        number: 1,
        color: '#f7d873',
        name: 'Asha',
        funFact: '',
        included: true,
        now: pairSide(1, 'now', { x: 0.95, y: 0.1, width: 0.2, height: 0.1 }),
        then: pairSide(1, 'then'),
      }],
    }))).toThrow(/outside/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [{
        number: 1,
        color: '#f7d873',
        name: 'Asha',
        funFact: '',
        included: true,
        now: { ...pairSide(1, 'now'), padding: { ...defaultPadding, top: 4 } },
        then: pairSide(1, 'then'),
      }],
    }))).toThrow(/padding/i);
  });

  it('rejects unsupported manifest versions', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({ version: 2 }))).toThrow(/version/i);
  });

  it('rejects unsafe paths and paths that do not match fixed bundle locations', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        now: { path: '../groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
      },
    }))).toThrow(/path/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        now: { path: 'groups/now-evil', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
      },
    }))).toThrow(/groups\/now/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [{
        number: 1,
        color: '#f7d873',
        name: 'Asha',
        funFact: '',
        included: true,
        now: { ...pairSide(1, 'now'), cropPath: 'pairs/002-now.jpg' },
        then: pairSide(1, 'then'),
      }],
    }))).toThrow(/pairs\/001-now/i);
    expect(() => parseFacePairsBundleManifest(validManifest({
      groups: {
        nowPreview: { path: 'groups/then-preview', name: 'Preview', width: 1200, height: 900, mime: 'image/jpeg' },
      },
    }))).toThrow(/now-preview/i);
  });

  it('rejects duplicate file references across groups and pair crops', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [
        {
          number: 1,
          color: '#f7d873',
          name: 'Asha',
          funFact: '',
          included: true,
          now: pairSide(1, 'now'),
          then: pairSide(1, 'then'),
        },
        {
          number: 2,
          color: '#eea7bb',
          name: 'Leo',
          funFact: '',
          included: true,
          now: pairSide(1, 'now'),
          then: pairSide(2, 'then'),
        },
      ],
    }))).toThrow(/duplicate/i);
  });

  it('rejects duplicate pair numbers and mismatched crop numbering', () => {
    expect(() => parseFacePairsBundleManifest(validManifest({
      pairs: [
        {
          number: 1,
          color: '#f7d873',
          name: 'Asha',
          funFact: '',
          included: true,
          now: pairSide(1, 'now'),
          then: pairSide(1, 'then'),
        },
        {
          number: 1,
          color: '#eea7bb',
          name: 'Leo',
          funFact: '',
          included: true,
          now: pairSide(2, 'now'),
          then: pairSide(2, 'then'),
        },
      ],
    }))).toThrow(/number/i);
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

  it('uses manifest pair count at capacity boundaries', () => {
    const manifest = parseFacePairsBundleManifest(validManifest());
    expect(() => assertFacePairImportCapacity(manifest.pairs.length, { people: 498, facePairs: 998 })).not.toThrow();
    expect(() => assertFacePairImportCapacity(manifest.pairs.length, { people: 499, facePairs: 998 })).toThrow(/500 people/i);
    expect(() => assertFacePairImportCapacity(500, { people: 0, facePairs: 0 })).not.toThrow();
    expect(() => assertFacePairImportCapacity(501, { people: 0, facePairs: 0 })).toThrow(/500 people/i);
    expect(() => assertFacePairImportCapacity(500, { people: 0, facePairs: 500 })).not.toThrow();
    expect(() => assertFacePairImportCapacity(501, { people: 0, facePairs: 500 })).toThrow(/1000 face pairs/i);
  });

  it('starts numbering after the largest existing pair number', () => {
    expect(maxFacePairNumber([])).toBe(0);
    expect(maxFacePairNumber([1, 10, 3])).toBe(10);
  });
});
