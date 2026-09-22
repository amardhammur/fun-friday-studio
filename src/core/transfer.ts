import { inspectImage, rpc } from './images/client';
import { imageStore } from './storage';
import { teamColors, validateSession } from './session';
import { exportNames } from './people/csv';
import { parseFacePairFiles } from './people/pairs';
import { getActivity } from './registry';
import type { AnySession, Asset, FaceCrop, FacePair, Person } from './types';
const archiveJob = rpc(() => new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' }));
export interface ImportedFacePairs {
  assets: Record<string, Asset>;
  facePairs: FacePair[];
  people: Person[];
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
export async function importFacePairs(file: File, startNumber: number): Promise<ImportedFacePairs> {
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

  const pairs = parseFacePairFiles(Object.keys(files));
  const images: {
    fileName: string;
    blob: Blob;
    width: number;
    height: number;
  }[] = [];
  for (const pair of pairs) {
    for (const fileName of [pair.thenFile, pair.nowFile]) {
      const blob = new Blob([files[fileName] as BlobPart], { type: 'image/jpeg' });
      try {
        const { width, height } = await inspectImage(blob);
        images.push({ fileName, blob, width, height });
      } catch {
        throw new Error(`Could not read ${fileName} as a JPEG image.`);
      }
    }
  }

  const assets: Record<string, Asset> = {};
  const assetsByFile = new Map<string, Asset>();
  const storedIds: string[] = [];
  for (const image of images) {
    try {
      const id = await imageStore.put(image.blob);
      const asset: Asset = { id, name: image.fileName, width: image.width, height: image.height, mime: 'image/jpeg' };
      assets[id] = asset;
      assetsByFile.set(image.fileName, asset);
      storedIds.push(id);
    } catch {
      await Promise.allSettled(storedIds.map(id => imageStore.delete(id)));
      throw new Error(`Could not store ${image.fileName}. Check browser storage and try again.`);
    }
  }

  const crop = (asset: Asset): FaceCrop => ({
    sourceImageId: asset.id,
    cropImageId: asset.id,
    faceBox: { x: 0, y: 0, width: 1, height: 1 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  const facePairs: FacePair[] = [];
  const people: Person[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const imported = pairs[index];
    const pairId = crypto.randomUUID();
    facePairs.push({
      id: pairId,
      number: startNumber + index + 1,
      color: teamColors[(startNumber + index) % teamColors.length],
      then: crop(assetsByFile.get(imported.thenFile)!),
      now: crop(assetsByFile.get(imported.nowFile)!),
      matchMethod: 'manual',
      reviewStatus: 'confirmed',
    });
    people.push({ id: crypto.randomUUID(), name: imported.name, funFact: '', included: true, facePairId: pairId });
  }
  return { assets, facePairs, people };
}
export async function exportFacePairs(session: AnySession) {
  const people = session.people.filter(p => session.facePairs.some(f => f.id === p.facePairId && f.now?.cropImageId && f.then?.cropImageId));
  const names = exportNames(people.map(p => p.name));
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < people.length; i++) {
    const pair = session.facePairs.find(p => p.id === people[i].facePairId)!;
    for (const side of ['then', 'now'] as const) files[`${names[i]} - ${side}.jpg`] = new Uint8Array(await (await imageStore.get(pair[side]!.cropImageId!)).arrayBuffer());
  }
  if (!people.length) throw new Error('Finish matching at least one person before exporting face pairs.');
  download(await archiveJob<Uint8Array>({ type: 'zip', files }), 'Childhood vs Now - face pairs.zip');
}
