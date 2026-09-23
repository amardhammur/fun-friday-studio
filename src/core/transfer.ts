import { inspectImage, rpc } from './images/client';
import { imageStore } from './storage';
import { validateEvent } from './session';
import {
  assertLibraryCapacity,
  bundlePaths,
  bundleSetName,
  FACE_PAIR_BUNDLE_VERSION,
  hasJpegSignature,
  normalizeName,
  pairCropPath,
  parseFacePairsBundleManifest,
  SET_IMAGE_FIELDS,
  setImagePath,
  setKey,
  type FacePairBundleEntry,
  type FacePairBundleImage,
  type FacePairBundleSet,
  type FacePairsBundleManifest,
} from './people/pairs';
import { orderedSets } from './people/photo-sets';
import { getActivity } from './registry';
import type { Asset, EventSession, FacePair, Person, PhotoSet } from './types';
const archiveJob = rpc(() => new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' }));
export interface ImportedFacePairs {
  assets: Record<string, Asset>;
  photoSets: PhotoSet[];
  facePairs: FacePair[];
  people: Person[];
}
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportSession(session: EventSession) {
  const files: Record<string, Uint8Array> = {};
  for (const id of Object.keys(session.assets)) files[`images/${id}`] = new Uint8Array(await (await imageStore.get(id)).arrayBuffer());
  const bytes = await archiveJob<Uint8Array>({ type: 'zip', files, manifest: session });
  download(bytes, `Fun Friday - ${new Date().toISOString().slice(0, 10)}.zip`);
}
export async function importSession(file: File): Promise<EventSession> {
  if (file.size > 512 * 1024 * 1024) throw new Error('Please use a session ZIP smaller than 512 MB.');
  const { manifest, files } = await archiveJob<{ manifest: unknown; files: Record<string, Uint8Array> }>({ type: 'unzip', bytes: new Uint8Array(await file.arrayBuffer()) });
  const session = validateEvent(manifest);
  for (const [id, asset] of Object.entries(session.assets)) {
    if (id !== asset.id || !files[`images/${id}`]) throw new Error('The session ZIP is missing one or more images.');
    if (!asset.mime.startsWith('image/')) throw new Error('The session contains an unsupported image type.');
  }
  // Stage every asset under a fresh ID; an invalid import never overwrites active images.
  const remap: Record<string, string> = {};
  for (const [id, asset] of Object.entries(session.assets)) remap[id] = await imageStore.put(new Blob([files[`images/${id}`] as BlobPart], { type: asset.mime }));
  session.assets = Object.fromEntries(Object.entries(session.assets).map(([id, asset]) => [remap[id], { ...asset, id: remap[id] }]));
  remapEventImages(session, remap);
  return validateEvent(session);
}
// Face pairs are shared at the event level, so they are remapped once, not per segment.
export function remapEventImages(event: EventSession, remap: Record<string, string>) {
  for (const pair of event.facePairs) for (const face of [pair.now, pair.then]) if (face) {
    face.sourceImageId = remap[face.sourceImageId] ?? face.sourceImageId;
    if (face.cropImageId) face.cropImageId = remap[face.cropImageId] ?? face.cropImageId;
  }
  for (const set of event.photoSets) {
    if (set.nowImageId) set.nowImageId = remap[set.nowImageId] ?? set.nowImageId;
    if (set.thenImageId) set.thenImageId = remap[set.thenImageId] ?? set.thenImageId;
    set.previews = Object.fromEntries(Object.entries(set.previews).map(([source, preview]) => [remap[source] ?? source, remap[preview] ?? preview]));
  }
  for (const segment of event.segments) {
    const activity = getActivity(segment.activityId);
    if (!activity) throw new Error(`This session uses an activity that is not installed: ${segment.activityId}.`);
    segment.game = activity.remapImages(segment.game, remap);
  }
}
export interface BundleImage { blob: Blob; name: string; mime: string; width: number; height: number }
export interface FacePairsBundle { manifest: FacePairsBundleManifest; images: Map<string, BundleImage> }
export interface StoreBundleOptions {
  startNumber: number;
  startOrder: number;
  current: { people: number; facePairs: number; photoSets: number };
  skipNames?: ReadonlySet<string>;
}

// Validates the ZIP and decodes every image without storing anything, so the host can still cancel.
export async function readFacePairsBundle(file: File): Promise<FacePairsBundle> {
  const zipMime = !file.type || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!file.name.toLocaleLowerCase().endsWith('.zip') || !zipMime) throw new Error('Please choose a ZIP file containing exported face pairs.');
  if (file.size > 512 * 1024 * 1024) throw new Error('Please use a face pair ZIP smaller than 512 MB.');
  const { manifest: sessionManifest, files } = await archiveJob<{ manifest?: unknown; files: Record<string, Uint8Array> }>({ type: 'unzip', bytes: new Uint8Array(await file.arrayBuffer()), allowMissingManifest: true });
  if (sessionManifest !== undefined) throw new Error('This is a full session ZIP. Import it with Import session ZIP.');
  const manifestBytes = files['face-pairs.json'];
  if (!manifestBytes) throw new Error('The face pair ZIP is missing face-pairs.json.');
  let manifest: FacePairsBundleManifest;
  try { manifest = parseFacePairsBundleManifest(JSON.parse(new TextDecoder().decode(manifestBytes)), bundleSetName(file.name)); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('face-pairs.json is not valid JSON.'); throw error; }
  const expected = new Set(['face-pairs.json', ...bundlePaths(manifest)]);
  const archivePaths = Object.keys(files).filter(path => !path.endsWith('/'));
  const missing = [...expected].filter(path => !files[path]), unknown = archivePaths.filter(path => !expected.has(path));
  if (missing.length || unknown.length) {
    const details = [missing.length ? `missing ${missing.join(', ')}` : '', unknown.length ? `unexpected ${unknown.join(', ')}` : ''].filter(Boolean).join('; ');
    throw new Error(`The face pair ZIP files do not exactly match face-pairs.json (${details}).`);
  }
  const specs: { path: string; name: string; mime: string; size?: { width: number; height: number }; crop: boolean }[] = [
    ...manifest.sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => { const image = set[field]; return image ? [{ path: image.path, name: image.name, mime: image.mime, size: { width: image.width, height: image.height }, crop: false }] : []; })),
    ...manifest.pairs.flatMap(pair => (['now', 'then'] as const).map(side => ({ path: pair[side].cropPath, name: `Face ${pair.number} - ${side}.jpg`, mime: 'image/jpeg', crop: true }))),
  ];
  for (const spec of specs) if (spec.crop && !hasJpegSignature(files[spec.path])) throw new Error(`${spec.path} is not a JPEG image.`);
  const images = new Map<string, BundleImage>();
  for (const spec of specs) {
    const blob = new Blob([files[spec.path] as BlobPart], { type: spec.mime });
    let width: number, height: number;
    try { ({ width, height } = await inspectImage(blob)); } catch { throw new Error(`Could not read ${spec.path} as an image.`); }
    if (spec.size && (width !== spec.size.width || height !== spec.size.height)) throw new Error(`${spec.path} dimensions do not match face-pairs.json.`);
    images.set(spec.path, { blob, name: spec.name, mime: spec.mime, width, height });
  }
  return { manifest, images };
}

export async function storeFacePairsBundle(bundle: FacePairsBundle, options: StoreBundleOptions): Promise<ImportedFacePairs> {
  const skip = options.skipNames ?? new Set<string>();
  const pairs = bundle.manifest.pairs.filter(pair => !skip.has(normalizeName(pair.name)));
  if (!pairs.length) throw new Error('Everyone in this file is already in your library.');
  const sets = bundle.manifest.sets.filter(set => pairs.some(pair => pair.set === set.key));
  assertLibraryCapacity({ pairs: pairs.length, sets: sets.length }, options.current);
  const paths = [...sets.flatMap(set => SET_IMAGE_FIELDS.flatMap(field => set[field] ? [set[field]!.path] : [])), ...pairs.flatMap(pair => [pair.now.cropPath, pair.then.cropPath])];
  const assets: Record<string, Asset> = {}, byPath = new Map<string, Asset>(), stored: string[] = [];
  try {
    for (const path of paths) {
      const image = bundle.images.get(path)!;
      let id: string;
      try { id = await imageStore.put(image.blob, undefined, { durable: true }); } catch { throw new Error(`Could not store ${path}. Check browser storage and try again.`); }
      stored.push(id);
      const asset: Asset = { id, name: image.name, width: image.width, height: image.height, mime: image.mime };
      assets[id] = asset; byPath.set(path, asset);
    }
    const idOf = (path: string) => byPath.get(path)!.id;
    const photoSets: PhotoSet[] = sets.map((set, index) => {
      const nowImageId = idOf(set.now.path), thenImageId = idOf(set.then.path), previews: Record<string, string> = {};
      if (set.nowPreview) previews[nowImageId] = idOf(set.nowPreview.path);
      if (set.thenPreview) previews[thenImageId] = idOf(set.thenPreview.path);
      return { id: crypto.randomUUID(), name: set.name, kind: set.kind, nowImageId, thenImageId, previews, order: options.startOrder + index };
    });
    const byKey = new Map(sets.map((set, index) => [set.key, photoSets[index]]));
    const facePairs: FacePair[] = pairs.map((pair, index) => {
      const set = byKey.get(pair.set)!;
      return {
        id: crypto.randomUUID(), number: options.startNumber + index + 1, color: pair.color, setId: set.id,
        now: { sourceImageId: set.nowImageId!, cropImageId: idOf(pair.now.cropPath), faceBox: pair.now.faceBox, padding: pair.now.padding },
        then: { sourceImageId: set.thenImageId!, cropImageId: idOf(pair.then.cropPath), faceBox: pair.then.faceBox, padding: pair.then.padding },
        matchMethod: 'manual', reviewStatus: 'confirmed',
      };
    });
    const people: Person[] = pairs.map((pair, index) => ({ id: crypto.randomUUID(), name: pair.name, funFact: pair.funFact, included: pair.included, facePairId: facePairs[index].id }));
    return { assets, photoSets, facePairs, people };
  } catch (error) {
    await Promise.allSettled(stored.map(id => imageStore.delete(id)));
    throw error instanceof Error ? error : new Error('Could not import face pairs.');
  }
}

export async function importFacePairs(file: File, options: StoreBundleOptions): Promise<ImportedFacePairs> {
  return storeFacePairsBundle(await readFacePairsBundle(file), options);
}

// Exports every set with at least one finished person. Pair numbers restart at 1 in export order.
export async function exportFacePairs(event: EventSession) {
  const finished = (pair: FacePair) => Boolean(pair.now?.cropImageId && pair.then?.cropImageId && event.people.some(p => p.facePairId === pair.id));
  const sets = orderedSets(event).filter(set => set.nowImageId && set.thenImageId && event.facePairs.some(pair => pair.setId === set.id && finished(pair)));
  if (!sets.length) throw new Error('Finish matching at least one person before exporting face pairs.');
  const files: Record<string, Uint8Array> = {}, manifestSets: FacePairBundleSet[] = [], manifestPairs: FacePairBundleEntry[] = [];
  const addImage = async (id: string, path: string): Promise<FacePairBundleImage> => {
    const asset = requireAsset(event, id, 'photo');
    files[path] = await assetBytes(id);
    return { path, name: asset.name, width: asset.width, height: asset.height, mime: asset.mime };
  };
  for (const [index, set] of sets.entries()) {
    const key = setKey(index), nowPreview = set.previews[set.nowImageId!], thenPreview = set.previews[set.thenImageId!];
    const entry: FacePairBundleSet = { key, name: set.name, kind: set.kind, now: await addImage(set.nowImageId!, setImagePath(key, 'now')), then: await addImage(set.thenImageId!, setImagePath(key, 'then')) };
    if (nowPreview) entry.nowPreview = await addImage(nowPreview, setImagePath(key, 'nowPreview'));
    if (thenPreview) entry.thenPreview = await addImage(thenPreview, setImagePath(key, 'thenPreview'));
    manifestSets.push(entry);
    for (const pair of event.facePairs.filter(p => p.setId === set.id && finished(p)).sort((a, b) => a.number - b.number)) {
      const person = event.people.find(p => p.facePairId === pair.id)!, number = manifestPairs.length + 1;
      const side = (s: 'now' | 'then') => ({ cropPath: pairCropPath(number, s), faceBox: pair[s]!.faceBox, padding: pair[s]!.padding });
      manifestPairs.push({ number, set: key, color: pair.color, name: person.name.trim() || `Person ${number}`, funFact: person.funFact, included: person.included, now: side('now'), then: side('then') });
      files[pairCropPath(number, 'now')] = await assetBytes(pair.now!.cropImageId!);
      files[pairCropPath(number, 'then')] = await assetBytes(pair.then!.cropImageId!);
    }
  }
  const manifest = parseFacePairsBundleManifest({ version: FACE_PAIR_BUNDLE_VERSION, sets: manifestSets, pairs: manifestPairs });
  files['face-pairs.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  download(await archiveJob<Uint8Array>({ type: 'zip', files }), 'Childhood vs Now - face pairs.zip');
}

function requireAsset(session: EventSession, id: string, label: string): Asset {
  const asset = session.assets[id];
  if (!asset) throw new Error(`The ${label} is missing from this session.`);
  return asset;
}

async function assetBytes(id: string) {
  return new Uint8Array(await (await imageStore.get(id)).arrayBuffer());
}
