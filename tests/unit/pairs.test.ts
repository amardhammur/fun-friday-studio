import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertLibraryCapacity,
  bundleSetName,
  duplicateNames,
  duplicateSummary,
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
    version: overrides.version ?? 1,
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
    expect(parseFacePairsBundleManifest(raw, 'Team offsite')).toEqual({
      version: 2,
      sets: [{
        key: '01', name: 'Team offsite', kind: 'group',
        now: { path: 'groups/now', name: 'Team today', width: 4000, height: 3000, mime: 'image/jpeg' },
        then: { path: 'groups/then', name: 'Team childhood', width: 4000, height: 3000, mime: 'image/jpeg' },
        nowPreview: { path: 'groups/now-preview', name: 'Team today preview', width: 1200, height: 900, mime: 'image/jpeg' },
        thenPreview: { path: 'groups/then-preview', name: 'Team childhood preview', width: 1200, height: 900, mime: 'image/jpeg' },
      }],
      pairs: [
        { number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: true, now: pairSide(1, 'now'), then: pairSide(1, 'then') },
        { number: 2, set: '01', color: '#eea7bb', name: 'Leo', funFact: '', included: false, now: pairSide(2, 'now'), then: pairSide(2, 'then') },
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
    expect(() => parseFacePairsBundleManifest(validManifest({ version: 3 }))).toThrow(/version/i);
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
  const empty = { people: 0, facePairs: 0, photoSets: 0 };
  it('rejects imports that exceed any library limit', () => {
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, people: 500 })).toThrow(/500 people/i);
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, facePairs: 1000 })).toThrow(/1000 face pairs/i);
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { ...empty, photoSets: 20 })).toThrow(/20 photo sets/i);
    expect(() => assertLibraryCapacity({ pairs: 2, sets: 1 }, { people: 499, facePairs: 999, photoSets: 0 })).toThrow(/500 people.*1000 face pairs/i);
  });
  it('accepts imports exactly at the limits', () => {
    expect(() => assertLibraryCapacity({ pairs: 1, sets: 1 }, { people: 499, facePairs: 999, photoSets: 19 })).not.toThrow();
    expect(() => assertLibraryCapacity({ pairs: 500, sets: 20 }, empty)).not.toThrow();
  });
  it('starts numbering after the largest existing pair number', () => {
    expect(maxFacePairNumber([])).toBe(0);
    expect(maxFacePairNumber([1, 10, 3])).toBe(10);
  });
});

const image = (path: string, name = path) => ({ path, name, width: 4000, height: 3000, mime: 'image/jpeg' });
function v2Manifest(): any {
  return {
    version: 2,
    sets: [
      { key: '01', name: 'Engineering', kind: 'group', now: image('sets/01/now'), then: image('sets/01/then'), nowPreview: image('sets/01/now-preview') },
      { key: '02', name: 'Priya', kind: 'single', now: image('sets/02/now'), then: image('sets/02/then') },
    ],
    pairs: [
      { number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: '', included: true, now: pairSide(1, 'now'), then: pairSide(1, 'then') },
      { number: 2, set: '01', color: '#eea7bb', name: 'Leo', funFact: '', included: false, now: pairSide(2, 'now'), then: pairSide(2, 'then') },
      { number: 3, set: '02', color: '#8fcbe0', name: 'Priya', funFact: '', included: true, now: pairSide(3, 'now'), then: pairSide(3, 'then') },
    ],
  };
}

describe('face-pair bundle manifest version 2', () => {
  it('accepts several sets, including a single-photo set', () => {
    const manifest = parseFacePairsBundleManifest(v2Manifest());
    expect(manifest.sets.map(s => [s.key, s.kind])).toEqual([['01', 'group'], ['02', 'single']]);
    expect(manifest.pairs.map(p => p.set)).toEqual(['01', '01', '02']);
  });
  it('rejects set keys out of order and set images away from their fixed paths', () => {
    const wrongKey = v2Manifest(); wrongKey.sets[1].key = '03'; wrongKey.pairs[2].set = '03';
    expect(() => parseFacePairsBundleManifest(wrongKey)).toThrow(/key 02/);
    const wrongPath = v2Manifest(); wrongPath.sets[0].then = image('sets/02/then-copy');
    expect(() => parseFacePairsBundleManifest(wrongPath)).toThrow(/sets\/01\/then/);
  });
  it('rejects a pair naming an unknown set, an empty set and a crowded single set', () => {
    const unknown = v2Manifest(); unknown.pairs[0].set = '09';
    expect(() => parseFacePairsBundleManifest(unknown)).toThrow(/unknown photo set/i);
    const empty = v2Manifest(); empty.pairs[2].set = '01';
    expect(() => parseFacePairsBundleManifest(empty)).toThrow(/02 has no people/i);
    const crowded = v2Manifest(); crowded.pairs[1].set = '02';
    expect(() => parseFacePairsBundleManifest(crowded)).toThrow(/exactly one person/i);
  });
  it('rejects a set without a name', () => {
    const unnamed = v2Manifest(); unnamed.sets[0].name = '  ';
    expect(() => parseFacePairsBundleManifest(unnamed)).toThrow(/name/i);
  });
  it('names a version 1 set after its file', () => {
    expect(bundleSetName('Design offsite.zip')).toBe('Design offsite');
    expect(bundleSetName('.zip')).toBe('Imported group');
    expect(bundleSetName(`${'x'.repeat(90)}.ZIP`)).toHaveLength(80);
  });
});

describe('duplicate names', () => {
  it('matches names ignoring case and surrounding spaces', () => {
    const manifest = parseFacePairsBundleManifest(v2Manifest());
    const existing = [{ id: 'a', facePairId: 'x', name: ' asha ', funFact: '', included: true }, { id: 'b', facePairId: 'y', name: '', funFact: '', included: true }];
    expect(duplicateNames(existing, manifest)).toEqual(['Asha']);
  });
  it('summarises one, two and many names', () => {
    expect(duplicateSummary(['Asha'])).toBe('Asha is already in your library.');
    expect(duplicateSummary(['Asha', 'Leo'])).toBe('Asha and Leo are already in your library.');
    expect(duplicateSummary(['Asha', 'Leo', 'Maya', 'Dev', 'Priya'])).toBe('Asha, Leo and 3 more are already in your library.');
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
      'face-pairs.json', 'pairs/001-now.jpg', 'pairs/001-then.jpg',
      'sets/01/now', 'sets/01/now-preview', 'sets/01/then', 'sets/01/then-preview',
    ]);
    const manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(payload.files['face-pairs.json'])));
    expect(manifest.sets).toEqual([{
      key: '01', name: 'Engineering', kind: 'group',
      now: { path: 'sets/01/now', name: 'Today.png', width: 1000, height: 800, mime: 'image/png' },
      then: { path: 'sets/01/then', name: 'Childhood.webp', width: 1000, height: 800, mime: 'image/webp' },
      nowPreview: { path: 'sets/01/now-preview', name: 'Today preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
      thenPreview: { path: 'sets/01/then-preview', name: 'Childhood preview.jpg', width: 500, height: 400, mime: 'image/jpeg' },
    }]);
    expect(manifest.pairs[0]).toMatchObject({
      number: 1, set: '01', color: '#f7d873', name: 'Asha', funFact: 'Loves chai', included: false,
      now: { cropPath: 'pairs/001-now.jpg', faceBox: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 } },
      then: { cropPath: 'pairs/001-then.jpg', faceBox: { x: 0.3, y: 0.1, width: 0.25, height: 0.35 } },
    });
    expect(JSON.stringify(manifest)).not.toMatch(/session-id|pair-id|person-id|set-id|sourceImageId|cropImageId/);
  });

  it('exports every set in order, skips unfinished sets and names unnamed people', async () => {
    const event = demoSession();
    event.assets['single-now'] = { id: 'single-now', name: 'Priya now.jpg', width: 600, height: 800, mime: 'image/jpeg' };
    event.assets['single-then'] = { id: 'single-then', name: 'Priya then.jpg', width: 500, height: 700, mime: 'image/jpeg' };
    event.photoSets.push(
      { id: 'empty-set', name: 'Unfinished', kind: 'group', previews: {}, order: 1 },
      { id: 'single-set', name: 'Priya', kind: 'single', nowImageId: 'single-now', thenImageId: 'single-then', previews: {}, order: 2 },
    );
    event.facePairs.push({ id: 'single-pair', number: 12, color: '#8fcbe0', setId: 'single-set', matchMethod: 'manual', reviewStatus: 'confirmed',
      now: { sourceImageId: 'single-now', cropImageId: 'now-crop', faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      then: { sourceImageId: 'single-then', cropImageId: 'then-crop', faceBox: { x: 0, y: 0, width: 1, height: 1 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } } });
    event.people.push({ id: 'single-person', facePairId: 'single-pair', name: '  ', funFact: '', included: true });
    getImage.mockImplementation(async () => new Blob([new Uint8Array([1])]));
    archiveJob.mockResolvedValue(new Uint8Array([9]));
    const { exportFacePairs } = await import('../../src/core/transfer');

    await exportFacePairs(event);

    const payload = archiveJob.mock.calls[0][0] as { files: Record<string, Uint8Array> };
    const manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(payload.files['face-pairs.json'])));
    expect(manifest.sets.map(s => [s.key, s.name, s.kind])).toEqual([['01', 'Engineering', 'group'], ['02', 'Priya', 'single']]);
    expect(manifest.pairs.map(p => [p.number, p.set, p.name])).toEqual([[1, '01', 'Asha'], [2, '02', 'Person 2']]);
    expect(payload.files['sets/02/now']).toBeDefined();
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
      startNumber: 5, startOrder: 0, current: { people: 10, facePairs: 10, photoSets: 0 },
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
      startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 },
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
      startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 },
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
      startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 },
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
      startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 },
    })).rejects.toThrow(/store/i);
    expect(inspectImage).toHaveBeenCalledTimes(6);
    expect(deleteImage).toHaveBeenCalledTimes(2);
    expect(deleteImage).toHaveBeenCalledWith('stored-1');
    expect(deleteImage).toHaveBeenCalledWith('stored-2');
  });

  it('skips named duplicates, drops a set left empty, and stores only what remains', async () => {
    const manifest = v2Manifest();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
    const files: Record<string, Uint8Array> = { 'face-pairs.json': new TextEncoder().encode(JSON.stringify(manifest)) };
    for (const path of ['sets/01/now', 'sets/01/then', 'sets/01/now-preview', 'sets/02/now', 'sets/02/then', 'pairs/001-now.jpg', 'pairs/001-then.jpg', 'pairs/002-now.jpg', 'pairs/002-then.jpg', 'pairs/003-now.jpg', 'pairs/003-then.jpg']) files[path] = jpeg;
    archiveJob.mockResolvedValue({ manifest: undefined, files });
    inspectImage.mockResolvedValue({ width: 4000, height: 3000, preview: new Blob() });
    let id = 0; putImage.mockImplementation(async () => `stored-${++id}`);
    const { readFacePairsBundle, storeFacePairsBundle } = await import('../../src/core/transfer');

    const bundle = await readFacePairsBundle(new File([new Uint8Array([1])], 'more.zip'));
    const imported = await storeFacePairsBundle(bundle, { startNumber: 40, startOrder: 3, current: { people: 0, facePairs: 0, photoSets: 3 }, skipNames: new Set(['priya']) });

    expect(imported.photoSets.map(s => [s.name, s.order])).toEqual([['Engineering', 3]]);
    expect(imported.facePairs.map(p => p.number)).toEqual([41, 42]);
    expect(imported.facePairs.every(p => p.setId === imported.photoSets[0].id)).toBe(true);
    expect(putImage).toHaveBeenCalledTimes(7);
    await expect(storeFacePairsBundle(bundle, { startNumber: 0, startOrder: 0, current: { people: 0, facePairs: 0, photoSets: 0 }, skipNames: new Set(['asha', 'leo', 'priya']) })).rejects.toThrow(/already in your library/);
  });
});
