import { rpc } from './images/client';
import { imageStore } from './storage';
import { validateSession } from './session';
import { exportNames } from './people/csv';
import { getActivity } from './registry';
import type { AnySession } from './types';
const archiveJob = rpc(() => new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' }));
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
