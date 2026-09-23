import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertFacePairImportCapacity,
  FACE_PAIR_BUNDLE_VERSION,
  hasJpegSignature,
  maxFacePairNumber,
  parseFacePairsBundleManifest,
  type FacePairsBundleManifest,
} from '../../src/core/people/pairs';
import type { EventSession } from '../../src/core/types';

const archiveJob = vi.fn();
const inspectImage = vi.fn();
const getImage = vi.fn();
const putImage = vi.fn();
const deleteImage = vi.fn();

vi.mock('../../src/core/images/client', () => ({
  inspectImage,
  rpc: () => archiveJob,
}));
vi.mock('../../src/core/storage', () => ({
  imageStore: { get: getImage, put: putImage, delete: deleteImage },
}));

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

function demoSession(): EventSession {
  const nowBox = { x: 0.1, y: 0.2, width: 0.2, height: 0.3 };
  const thenBox = { x: 0.3, y: 0.1, width: 0.25, height: 0.35 };
  const padding = { top: 0.4, right: 0.3, bottom: 0.7, left: 0.3 };
  return {
    formatVersion: 3, id: 'session-id', title: 'Demo', createdAt: '', updatedAt: '', isDemo: false,
    segments: [], currentSegmentIndex: 0, phase: 'lineup', correctPoints: 2, stealPoints: 1, teams: [], scoreEntries: [],
    assets: {
      'now-source': { id: 'now-source', name: 'Today.png', width: 1000, height: 800, mime: 'image/png' },
      'then-source': { id: 'then-source', name: 'Childhood.webp', width: 1000, height: 800, mime: 'image/webp' },
      'now-preview': { id: 'now-preview', name: 'Today preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      'then-preview': { id: 'then-preview', name: 'Childhood preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      'now-crop': { id: 'now-crop', name: 'Now crop.jpg', width: 200, height: 240, mime: 'image/jpeg' },
      'then-crop': { id: 'then-crop', name: 'Then crop.jpg', width: 210, height: 250, mime: 'image/jpeg' },
    },
    photoSets: [{ id: 'set-id', name: 'Engineering', kind: 'group', nowImageId: 'now-source', thenImageId: 'then-source', previews: { 'now-source': 'now-preview', 'then-source': 'then-preview' }, order: 0 }],
    facePairs: [{
      id: 'pair-id', number: 7, color: '#f7d873', setId: 'set-id', matchMethod: 'manual', reviewStatus: 'confirmed',
      now: { sourceImageId: 'now-source', cropImageId: 'now-crop', faceBox: nowBox, padding },
      then: { sourceImageId: 'then-source', cropImageId: 'then-crop', faceBox: thenBox, padding },
    }],
    people: [{ id: 'person-id', facePairId: 'pair-id', name: 'Asha', funFact: 'Loves chai', included: false }],
  };
}

describe('face-pair bundle transfer', () => {
  beforeEach(() => {
    vi.resetModules();
    archiveJob.mockReset();
    inspectImage.mockReset();
    getImage.mockReset();
    putImage.mockReset();
    deleteImage.mockReset();
    vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('exports group sources, previews, crops, and their manifest relationships', async () => {
    const bytesById = new Map([
      ['now-source', new Uint8Array([1])], ['then-source', new Uint8Array([2])],
      ['now-preview', new Uint8Array([3])], ['then-preview', new Uint8Array([4])],
      ['now-crop', new Uint8Array([5])], ['then-crop', new Uint8Array([6])],
    ]);
    getImage.mockImplementation(async (id: string) => new Blob([bytesById.get(id)!]));
    archiveJob.mockResolvedValue(new Uint8Array([9]));
    const { exportFacePairs } = await import('../../src/core/transfer');

    await exportFacePairs(demoSession());

    const payload = archiveJob.mock.calls[0][0] as { type: string; files: Record<string, Uint8Array> };
    expect(Object.keys(payload.files).sort()).toEqual([
      'face-pairs.json', 'groups/now', 'groups/now-preview', 'groups/then',
      'groups/then-preview', 'pairs/007-now.jpg', 'pairs/007-then.jpg',
    ]);
    const manifest = parseFacePairsBundleManifest(
      JSON.parse(new TextDecoder().decode(payload.files['face-pairs.json'])),
    );
    expect(manifest.groups).toEqual({
      now: { path: 'groups/now', name: 'Today.png', width: 1000, height: 800, mime: 'image/png' },
      then: { path: 'groups/then', name: 'Childhood.webp', width: 1000, height: 800, mime: 'image/webp' },
      nowPreview: { path: 'groups/now-preview', name: 'Today preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      thenPreview: { path: 'groups/then-preview', name: 'Childhood preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
    });
    expect(manifest.pairs[0]).toMatchObject({
      number: 7, color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: false,
      now: { cropPath: 'pairs/007-now.jpg', faceBox: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 } },
      then: { cropPath: 'pairs/007-then.jpg', faceBox: { x: 0.3, y: 0.1, width: 0.25, height: 0.35 } },
    });
    expect(JSON.stringify(manifest)).not.toMatch(/session-id|pair-id|person-id|sourceImageId|cropImageId/);
  });

  it('strictly imports a complete bundle with fresh linked records', async () => {
    const manifest = validManifest({
      groups: {
        nowPreview: { path: 'groups/now-preview', name: 'Now preview', width: 40, height: 30, mime: 'image/jpeg' },
      },
      pairs: [{
        number: 1, color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: false,
        now: pairSide(1, 'now'), then: pairSide(1, 'then'),
      }],
    });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1]);
    archiveJob.mockResolvedValue({
      manifest: undefined,
      files: {
        'face-pairs.json': new TextEncoder().encode(JSON.stringify(manifest)),
        'groups/now': new Uint8Array([1]), 'groups/then': new Uint8Array([2]),
        'groups/now-preview': new Uint8Array([3]),
        'pairs/001-now.jpg': jpeg, 'pairs/001-then.jpg': jpeg,
      },
    });
    inspectImage.mockImplementation(async (blob: Blob) => {
      const byte = new Uint8Array(await blob.arrayBuffer())[0];
      if (byte === 1 || byte === 2) return { width: 4000, height: 3000, preview: new Blob() };
      if (byte === 3) return { width: 40, height: 30, preview: new Blob() };
      return { width: 100, height: 120, preview: new Blob() };
    });
    let id = 0;
    putImage.mockImplementation(async () => `fresh-${++id}`);
    const { importFacePairs } = await import('../../src/core/transfer');

    const imported = await importFacePairs(new File([new Uint8Array([1])], 'pairs.zip'), {
      startNumber: 5, currentPeopleCount: 10, currentFacePairCount: 10,
    });

    expect(inspectImage).toHaveBeenCalledTimes(5);
    expect(putImage).toHaveBeenCalledTimes(5);
    expect(imported.photoSets).toEqual([{ id: expect.any(String), name: 'pairs', kind: 'group', nowImageId: 'fresh-1', thenImageId: 'fresh-2', previews: { 'fresh-1': 'fresh-3' }, order: 0 }]);
    expect(imported.facePairs[0].setId).toBe(imported.photoSets[0].id);
    expect(imported.facePairs[0]).toMatchObject({
      number: 6, color: '#f7d873', matchMethod: 'manual', reviewStatus: 'confirmed',
      now: { sourceImageId: 'fresh-1', cropImageId: 'fresh-4', faceBox: defaultFaceBox, padding: defaultPadding },
      then: { sourceImageId: 'fresh-2', cropImageId: 'fresh-5', faceBox: defaultFaceBox, padding: defaultPadding },
    });
    expect(imported.people[0]).toMatchObject({ name: 'Asha', funFact: 'Loves chai', included: false });
    expect(imported.people[0].facePairId).toBe(imported.facePairs[0].id);
  });

  it('rejects file parity errors, old flat archives, and invalid JPEG crops before storage', async () => {
    const { importFacePairs } = await import('../../src/core/transfer');
    const file = new File([new Uint8Array([1])], 'pairs.zip');
    archiveJob.mockResolvedValueOnce({
      manifest: undefined,
      files: { 'Asha - now.jpg': new Uint8Array([1]), 'Asha - then.jpg': new Uint8Array([2]) },
    });
    await expect(importFacePairs(file, {
      startNumber: 0, currentPeopleCount: 0, currentFacePairCount: 0,
    })).rejects.toThrow(/face-pairs\.json/i);

    archiveJob.mockResolvedValueOnce({
      manifest: undefined,
      files: {
        'face-pairs.json': new TextEncoder().encode(JSON.stringify(validManifest())),
        'groups/now': new Uint8Array([1]), 'groups/then': new Uint8Array([2]),
        'pairs/001-now.jpg': new Uint8Array([0x89]), 'pairs/001-then.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
        'pairs/002-now.jpg': new Uint8Array([0xff, 0xd8, 0xff]), 'pairs/002-then.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
        'unknown.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
      },
    });
    await expect(importFacePairs(file, {
      startNumber: 0, currentPeopleCount: 0, currentFacePairCount: 0,
    })).rejects.toThrow(/unknown|exactly|unexpected/i);

    archiveJob.mockResolvedValueOnce({
      manifest: undefined,
      files: {
        'face-pairs.json': new TextEncoder().encode(JSON.stringify(validManifest())),
        'groups/now': new Uint8Array([1]), 'groups/then': new Uint8Array([2]),
        'pairs/001-now.jpg': new Uint8Array([0x89]), 'pairs/001-then.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
        'pairs/002-now.jpg': new Uint8Array([0xff, 0xd8, 0xff]), 'pairs/002-then.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
      },
    });
    await expect(importFacePairs(file, {
      startNumber: 0, currentPeopleCount: 0, currentFacePairCount: 0,
    })).rejects.toThrow(/pairs\/001-now\.jpg.*JPEG/i);
    expect(inspectImage).not.toHaveBeenCalled();
    expect(putImage).not.toHaveBeenCalled();
  });

  it('checks replacement capacity and cleans up every stored image after a later failure', async () => {
    const manifest = validManifest();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
    archiveJob.mockResolvedValue({
      manifest: undefined,
      files: {
        'face-pairs.json': new TextEncoder().encode(JSON.stringify(manifest)),
        'groups/now': jpeg, 'groups/then': jpeg,
        'pairs/001-now.jpg': jpeg, 'pairs/001-then.jpg': jpeg,
        'pairs/002-now.jpg': jpeg, 'pairs/002-then.jpg': jpeg,
      },
    });
    inspectImage.mockResolvedValue({ width: 4000, height: 3000, preview: new Blob() });
    putImage.mockResolvedValueOnce('stored-1').mockResolvedValueOnce('stored-2')
      .mockRejectedValueOnce(new Error('full'));
    const { importFacePairs } = await import('../../src/core/transfer');
    const file = new File([new Uint8Array([1])], 'pairs.zip');

    await expect(importFacePairs(file, {
      startNumber: 0, currentPeopleCount: 500, currentFacePairCount: 1000,
      replaceExisting: true,
    })).rejects.toThrow(/store/i);
    expect(inspectImage).toHaveBeenCalledTimes(6);
    expect(deleteImage).toHaveBeenCalledTimes(2);
    expect(deleteImage).toHaveBeenCalledWith('stored-1');
    expect(deleteImage).toHaveBeenCalledWith('stored-2');
  });
});
