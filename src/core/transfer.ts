import { inspectImage, rpc } from './images/client';
import { imageStore } from './storage';
import { validateSession } from './session';
import {
  assertFacePairImportCapacity,
  FACE_PAIR_BUNDLE_VERSION,
  hasJpegSignature,
  parseFacePairsBundleManifest,
  type FacePairBundleGroupImage,
  type FacePairsBundleManifest,
} from './people/pairs';
import { getActivity } from './registry';
import type { AnySession, Asset, FacePair, Person } from './types';
const archiveJob = rpc(() => new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' }));
export interface ImportedFacePairs {
  assets: Record<string, Asset>;
  facePairs: FacePair[];
  people: Person[];
  originalImageId: string;
  childhoodImageId: string;
  childhoodUploadId: string;
  previews: Record<string, string>;
}
export interface FacePairImportOptions {
  startNumber: number;
  currentPeopleCount: number;
  currentFacePairCount: number;
  replaceExisting?: boolean;
}
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportSession(session: AnySession) {
  const files: Record<string, Uint8Array> = {};
  for (const id of Object.keys(session.assets)) files[`images/${id}`] = new Uint8Array(await (await imageStore.get(id)).arrayBuffer());
  const bytes = await archiveJob<Uint8Array>({ type: 'zip', files, manifest: session });
  download(bytes, `Fun Friday - ${new Date().toISOString().slice(0, 10)}.zip`);
}
export async function importSession(file: File) {
  if (file.size > 512 * 1024 * 1024) throw new Error('Please use a session ZIP smaller than 512 MB.');
  const { manifest, files } = await archiveJob<{ manifest: unknown; files: Record<string, Uint8Array> }>({ type: 'unzip', bytes: new Uint8Array(await file.arrayBuffer()) });
  const session = validateSession(manifest);
  for (const [id, asset] of Object.entries(session.assets)) {
    if (id !== asset.id || !files[`images/${id}`]) throw new Error('The session ZIP is missing one or more images.');
    if (!asset.mime.startsWith('image/')) throw new Error('The session contains an unsupported image type.');
  }
  // Stage every asset under a fresh ID; an invalid import never overwrites active images.
  const remap: Record<string, string> = {};
  for (const [id, asset] of Object.entries(session.assets)) remap[id] = await imageStore.put(new Blob([files[`images/${id}`] as BlobPart], { type: asset.mime }));
  session.assets = Object.fromEntries(Object.entries(session.assets).map(([id, asset]) => [remap[id], { ...asset, id: remap[id] }]));
  for (const pair of session.facePairs) for (const face of [pair.now, pair.then]) if (face) {
    face.sourceImageId = remap[face.sourceImageId];
    if (face.cropImageId) face.cropImageId = remap[face.cropImageId];
  }
  session.game = getActivity(session.activityId)!.remapImages(session.game, remap);
  return validateSession(session);
}
export async function importFacePairs(file: File, options: FacePairImportOptions): Promise<ImportedFacePairs> {
  const zipMime = !file.type || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!file.name.toLocaleLowerCase().endsWith('.zip') || !zipMime) {
    throw new Error('Please choose a ZIP file containing exported face pairs.');
  }
  if (file.size > 512 * 1024 * 1024) throw new Error('Please use a face pair ZIP smaller than 512 MB.');

  const { manifest, files } = await archiveJob<{ manifest?: unknown; files: Record<string, Uint8Array> }>({
    type: 'unzip',
    bytes: new Uint8Array(await file.arrayBuffer()),
    allowMissingManifest: true,
  });
  if (manifest !== undefined) throw new Error('This is a full session ZIP. Import it with Import session ZIP.');

  const manifestBytes = files['face-pairs.json'];
  if (!manifestBytes) throw new Error('The face pair ZIP is missing face-pairs.json.');
  let bundle: FacePairsBundleManifest;
  try {
    bundle = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('face-pairs.json is not valid JSON.');
    throw error;
  }

  const referencedPaths = [
    bundle.groups.now.path,
    bundle.groups.then.path,
    ...(bundle.groups.nowPreview ? [bundle.groups.nowPreview.path] : []),
    ...(bundle.groups.thenPreview ? [bundle.groups.thenPreview.path] : []),
    ...bundle.pairs.flatMap(pair => [pair.now.cropPath, pair.then.cropPath]),
  ];
  const expectedPaths = new Set(['face-pairs.json', ...referencedPaths]);
  const archivePaths = Object.keys(files).filter(path => !path.endsWith('/'));
  const missing = [...expectedPaths].filter(path => !files[path]);
  const unknown = archivePaths.filter(path => !expectedPaths.has(path));
  if (missing.length || unknown.length) {
    const details = [
      missing.length ? `missing ${missing.join(', ')}` : '',
      unknown.length ? `unexpected ${unknown.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`The face pair ZIP files do not exactly match face-pairs.json (${details}).`);
  }

  const current = options.replaceExisting
    ? { people: 0, facePairs: 0 }
    : { people: options.currentPeopleCount, facePairs: options.currentFacePairCount };
  assertFacePairImportCapacity(bundle.pairs.length, current);

  const imageSpecs: {
    path: string;
    name: string;
    mime: string;
    expectedSize?: { width: number; height: number };
    crop: boolean;
  }[] = [
    groupSpec(bundle.groups.now),
    groupSpec(bundle.groups.then),
    ...(bundle.groups.nowPreview ? [groupSpec(bundle.groups.nowPreview)] : []),
    ...(bundle.groups.thenPreview ? [groupSpec(bundle.groups.thenPreview)] : []),
    ...bundle.pairs.flatMap(pair => [
      { path: pair.now.cropPath, name: `Face ${pair.number} - now.jpg`, mime: 'image/jpeg', crop: true },
      { path: pair.then.cropPath, name: `Face ${pair.number} - then.jpg`, mime: 'image/jpeg', crop: true },
    ]),
  ];
  for (const spec of imageSpecs) {
    if (spec.crop && !hasJpegSignature(files[spec.path])) throw new Error(`${spec.path} is not a JPEG image.`);
  }
  const images: {
    path: string;
    name: string;
    mime: string;
    blob: Blob;
    width: number;
    height: number;
  }[] = [];
  for (const spec of imageSpecs) {
    const bytes = files[spec.path];
    const blob = new Blob([bytes as BlobPart], { type: spec.mime });
    try {
      const { width, height } = await inspectImage(blob);
      if (spec.expectedSize && (width !== spec.expectedSize.width || height !== spec.expectedSize.height)) {
        throw new Error(`${spec.path} dimensions do not match face-pairs.json.`);
      }
      images.push({ path: spec.path, name: spec.name, mime: spec.mime, blob, width, height });
    } catch (error) {
      if (error instanceof Error && error.message.includes('dimensions do not match')) throw error;
      throw new Error(`Could not read ${spec.path} as an image.`);
    }
  }

  const assets: Record<string, Asset> = {};
  const assetsByPath = new Map<string, Asset>();
  const storedIds: string[] = [];
  try {
    for (const image of images) {
      try {
        const id = await imageStore.put(image.blob, undefined, { durable: true });
        const asset: Asset = {
          id,
          name: image.name,
          width: image.width,
          height: image.height,
          mime: image.mime,
        };
        assets[id] = asset;
        assetsByPath.set(image.path, asset);
        storedIds.push(id);
      } catch {
        throw new Error(`Could not store ${image.path}. Check browser storage and try again.`);
      }
    }

    const nowSource = assetsByPath.get(bundle.groups.now.path)!;
    const thenSource = assetsByPath.get(bundle.groups.then.path)!;
    const facePairs: FacePair[] = bundle.pairs.map((imported, index) => {
      const pairId = crypto.randomUUID();
      return {
        id: pairId,
        number: options.startNumber + index + 1,
        color: imported.color,
        now: {
          sourceImageId: nowSource.id,
          cropImageId: assetsByPath.get(imported.now.cropPath)!.id,
          faceBox: imported.now.faceBox,
          padding: imported.now.padding,
        },
        then: {
          sourceImageId: thenSource.id,
          cropImageId: assetsByPath.get(imported.then.cropPath)!.id,
          faceBox: imported.then.faceBox,
          padding: imported.then.padding,
        },
        matchMethod: 'manual',
        reviewStatus: 'confirmed',
      };
    });
    const people: Person[] = bundle.pairs.map((imported, index) => ({
      id: crypto.randomUUID(),
      name: imported.name,
      funFact: imported.funFact,
      included: imported.included,
      facePairId: facePairs[index].id,
    }));
    const previews: Record<string, string> = {};
    if (bundle.groups.nowPreview) previews[nowSource.id] = assetsByPath.get(bundle.groups.nowPreview.path)!.id;
    if (bundle.groups.thenPreview) previews[thenSource.id] = assetsByPath.get(bundle.groups.thenPreview.path)!.id;
    return {
      assets,
      facePairs,
      people,
      originalImageId: nowSource.id,
      childhoodImageId: thenSource.id,
      childhoodUploadId: thenSource.id,
      previews,
    };
  } catch (error) {
    await Promise.allSettled(storedIds.map(id => imageStore.delete(id)));
    throw error instanceof Error ? error : new Error('Could not import face pairs.');
  }
}
export async function exportFacePairs(session: AnySession) {
  const people = session.people.filter(p => session.facePairs.some(f => f.id === p.facePairId && f.now?.cropImageId && f.then?.cropImageId));
  if (!people.length) throw new Error('Finish matching at least one person before exporting face pairs.');
  const pairs = people.map(person => session.facePairs.find(pair => pair.id === person.facePairId)!);
  const nowSourceId = pairs[0].now!.sourceImageId;
  const thenSourceId = pairs[0].then!.sourceImageId;
  if (pairs.some(pair => pair.now!.sourceImageId !== nowSourceId || pair.then!.sourceImageId !== thenSourceId)) {
    throw new Error('All exported face pairs must reference the same two group photos.');
  }
  const nowSource = requireAsset(session, nowSourceId, 'current group photo');
  const thenSource = requireAsset(session, thenSourceId, 'childhood group photo');
  const previewIds = (session.game as { previews?: Record<string, string> }).previews ?? {};
  const nowPreview = optionalAsset(session, previewIds[nowSourceId]);
  const thenPreview = optionalAsset(session, previewIds[thenSourceId]);

  const manifest = parseFacePairsBundleManifest({
    version: FACE_PAIR_BUNDLE_VERSION,
    groups: {
      now: manifestGroup('groups/now', nowSource),
      then: manifestGroup('groups/then', thenSource),
      ...(nowPreview ? { nowPreview: manifestGroup('groups/now-preview', nowPreview) } : {}),
      ...(thenPreview ? { thenPreview: manifestGroup('groups/then-preview', thenPreview) } : {}),
    },
    pairs: people.map((person, index) => {
      const pair = pairs[index];
      return {
        number: pair.number,
        color: pair.color,
        name: person.name,
        funFact: person.funFact,
        included: person.included,
        now: {
          cropPath: cropPath(pair.number, 'now'),
          faceBox: pair.now!.faceBox,
          padding: pair.now!.padding,
        },
        then: {
          cropPath: cropPath(pair.number, 'then'),
          faceBox: pair.then!.faceBox,
          padding: pair.then!.padding,
        },
      };
    }),
  });

  const files: Record<string, Uint8Array> = {
    'face-pairs.json': new TextEncoder().encode(JSON.stringify(manifest)),
    [manifest.groups.now.path]: await assetBytes(nowSource.id),
    [manifest.groups.then.path]: await assetBytes(thenSource.id),
  };
  if (manifest.groups.nowPreview && nowPreview) files[manifest.groups.nowPreview.path] = await assetBytes(nowPreview.id);
  if (manifest.groups.thenPreview && thenPreview) files[manifest.groups.thenPreview.path] = await assetBytes(thenPreview.id);
  for (let index = 0; index < manifest.pairs.length; index++) {
    const pair = pairs[index];
    files[manifest.pairs[index].now.cropPath] = await assetBytes(pair.now!.cropImageId!);
    files[manifest.pairs[index].then.cropPath] = await assetBytes(pair.then!.cropImageId!);
  }
  download(await archiveJob<Uint8Array>({ type: 'zip', files }), 'Childhood vs Now - face pairs.zip');
}

function groupSpec(group: FacePairBundleGroupImage) {
  return {
    path: group.path,
    name: group.name,
    mime: group.mime,
    expectedSize: { width: group.width, height: group.height },
    crop: false,
  };
}

function cropPath(number: number, side: 'now' | 'then') {
  return `pairs/${String(number).padStart(3, '0')}-${side}.jpg`;
}

function requireAsset(session: AnySession, id: string, label: string): Asset {
  const asset = session.assets[id];
  if (!asset) throw new Error(`The ${label} is missing from this session.`);
  return asset;
}

function optionalAsset(session: AnySession, id: string | undefined): Asset | undefined {
  return id ? requireAsset(session, id, 'group preview') : undefined;
}

function manifestGroup(path: string, asset: Asset): FacePairBundleGroupImage {
  return { path, name: asset.name, width: asset.width, height: asset.height, mime: asset.mime };
}

async function assetBytes(id: string) {
  return new Uint8Array(await (await imageStore.get(id)).arrayBuffer());
}
